/**
 * Supabase Edge Function — gps-sync (Ladrillo 2b-i + 2b-map + L2 CHAINED WORKER)
 *
 * Pulls Catapult activities in a date range, finds-or-creates one
 * training_session per activity (idempotent via external_activity_id), fetches
 * per-athlete stats, normalizes them and writes gps_reports
 * (+ gps_report_metrics for non-core metrics).
 *
 * DATA-DRIVEN MAPPING: parameter→target resolution comes from gps_column_mappings
 * (source_label='catapult'), the SAME table/vocabulary the CSV wizard uses.
 * SLUG_MAP below is ONLY the auto-seed for the 13 core columns — once seeded,
 * the club edits everything (incl. any extra Catapult metric) via "Map metrics".
 * Stats requests ALL mapped slugs, not a fixed list; unmapped slugs are reported
 * (unmapped_params), never silently dropped.
 *
 * ── L2: SERVER-SIDE CHAINED ORCHESTRATION ──────────────────────────────────
 * The client used to loop the monthly chunks itself (Admin.html), so navigating
 * away killed the sync. Now the SERVER owns the loop, driven by a gps_sync_jobs
 * row, and the client only fires "start" once + watches progress via Realtime.
 * Two invocation MODES on the same function:
 *
 *   • START  (client → default / mode:'start'):  authenticated by the caller's JWT.
 *     Checks the lock (one active job per integration), reaps a dead job, computes
 *     the chunk plan, INSERTs the job, responds 202 { job_id } IMMEDIATELY and kicks
 *     the first chunk in the background (EdgeRuntime.waitUntil). The client never waits.
 *
 *   • WORKER (server → itself, mode:'worker'):  authenticated by the SERVICE ROLE
 *     key in the Authorization header (only the server has it). Responds 202 fast and
 *     processes exactly ONE chunk in the background; when it finishes a chunk it
 *     RE-INVOKES itself (fetch to its own URL) for the next chunk — chaining by
 *     invocation so no single call exceeds the ~150s wall-clock. On the last chunk it
 *     marks the job 'done' and writes gps_integrations.last_sync_at (as before).
 *
 * RESUMABLE: sync is idempotent (delete+insert / upsert by external_activity_id), so a
 * killed job is resumed from job.chunks_done (its cursor) — re-processing a chunk is safe.
 * A dead 'running' job (heartbeat_at older than STALE_MS) is reclaimed atomically on the
 * next START and resumed as the SAME job (cleaner than error+new).
 *
 * Request  (POST JSON):
 *   START : { integration_id, from?, to?, mode?:'start' }
 *   WORKER: { mode:'worker', job_id }         (Authorization: Bearer <service_role_key>)
 * Response: START/WORKER → 202 { ok:true, job_id? }   ·   busy → 409 { already_running:true, job_id }
 *
 * Session grain → gps_reports. Period grain (per drill/task) → gps_period_reports.
 *
 * Deploy: supabase functions deploy gps-sync
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const CATAPULT_BASE: Record<string, string> = {
  au: 'https://connect-au.catapultsports.com/api/v6',
  us: 'https://connect-us.catapultsports.com/api/v6',
  eu: 'https://connect-eu.catapultsports.com/api/v6',
};

// A dead 'running' job (no heartbeat within this window) is considered crashed → reapable.
const STALE_MS = 5 * 60 * 1000;

// ── Canonical column units (must match the CSV-imported data convention) ────
//   ALL distances — INCLUDING total_distance — → METRES · player_load → AU
//   max_speed/avg_speed → km/h · time_played → min · distance_per_minute → m/min
//   ⚠️ total_distance was historically km (conv 1/1000) and that's why old rows are
//   small; it is now METRES everywhere (SLUG_MAP total_distance.conv = 1). PERIODS use
//   the SAME normalizeMetrics() as sessions, so period total_distance is metres too —
//   do NOT add a separate ×1000 / ÷1000 anywhere. (Legacy km rows are fixed by a
//   one-time per-club UPDATE; see migrations/107_normalize_gps_period_reports_metres.sql.)
// INT columns are rounded; the rest are stored toFixed(4).
const GPS_INT_COLS = new Set(['accelerations', 'decelerations', 'sprint_count', 'time_played']);

// Outlier defense (same contract as the CSV importer): total_distance in canonical
// metres above the physical session max = noise. Keep in sync with assets/gps-units.js.
const OUTLIER_MAX_M = 25000;

// ── Períodos SUPERPUESTOS (doble conteo) ─────────────────────────────────────
// En OpenField una actividad puede quedar con períodos redundantes que cubren la MISMA
// ventana de tiempo (ej. "1RST HALF"/"2ND HALF" + los genéricos "Period 1"/"Period 2").
// Catapult agrega la actividad SUMANDO sus períodos → los totales de sesión salen
// DUPLICADOS (partido de 10 km reportado como 20 km). Defensa: detectar por jugador los
// períodos cuya ventana [start,end] ya está cubierta (>50% de solape con los aceptados),
// marcarlos is_flagged='overlap_duplicate' (la vista de tasks ya excluye flaggeados) y
// RECALCULAR las columnas-suma del gps_report desde los períodos aceptados.
// Prioridad de aceptación: períodos con NOMBRE propio ganan a los genéricos "Period N";
// a igual tier, el más largo primero. Un período sin ventana temporal no se puede juzgar
// → se acepta (nunca descartamos datos que no podemos probar redundantes).
const isGenericPeriodName = (n: string | null) => !n || /^period\s*\d+$/i.test(String(n).trim());
// Columnas de ACUMULACIÓN (la agregación de actividad es la suma de períodos → son las
// que quedan dobladas y hay que recalcular). max_speed/avg_speed NO: el máx/ratio a nivel
// actividad no se duplica por solape.
const GPS_SUM_COLS = [
  'total_distance', 'high_speed_distance', 'very_high_speed_distance', 'sprint_distance',
  'sprint_count', 'accelerations', 'decelerations', 'player_load', 'hmld',
];

// Canonical gps_reports columns (the 13 core). target_metric values NOT in this
// set are treated as gps_metric_definitions keys → gps_report_metrics (EAV).
const GPS_REPORT_COLS = new Set([
  'total_distance', 'high_speed_distance', 'very_high_speed_distance',
  'sprint_distance', 'accelerations', 'decelerations', 'max_speed',
  'player_load', 'avg_speed', 'hmld', 'time_played', 'sprint_count', 'distance_per_minute',
]);

// Stats-row keys that are athlete/activity metadata, not metric parameters.
const METADATA_KEYS = new Set([
  'athlete_id', 'athlete', 'id', 'name', 'athlete_name', 'first_name', 'last_name',
  'jersey', 'jersey_number', 'number', 'position', 'activity_id', 'activity',
  'date', 'start_time', 'startTime', 'start', 'end_time', 'endTime', 'end',
  'period_id', 'period_name', 'period', 'player_id', 'parameters',
]);

// SLUG_MAP — AUTO-SEED ONLY. Catapult OpenField parameter slug → { col: canonical
// gps_reports column, conv: unit multiplier (Catapult returns SI) }. On first
// sync these 13 rows are seeded into gps_column_mappings so the core columns work
// with zero setup; afterwards the club owns the mapping via "Map metrics".
// ⚠️ Slugs VARY across OpenField versions — VERIFY against GET /parameters.
// ⚠️ ESPEJADO en CM_SLUG_SEED (Admin.html, modal "Mapear métricas"). Cualquier cambio
// acá va TAMBIÉN allá: ese modal hace upsert de todas las filas al guardar, así que una
// semilla desincronizada reescribe la conversión en la DB y rompe la ingesta.
const SLUG_MAP: Record<string, { col: string; conv: number }> = {
  // distances
  // Catapult returns SI (metres) for total_distance, same as every other distance.
  // Keep it in METRES — the canonical DB unit for all distances. (Was 1/1000 → km,
  // which made total_distance the odd one out and broke KPI/table parity.)
  total_distance:                     { col: 'total_distance',           conv: 1 },         // m
  total_high_speed_distance:          { col: 'high_speed_distance',      conv: 1 },         // m
  total_very_high_speed_distance:     { col: 'very_high_speed_distance', conv: 1 },         // m  (VERIFY slug)
  total_sprint_distance:              { col: 'sprint_distance',          conv: 1 },         // m  (VERIFY slug)
  total_high_metabolic_load_distance: { col: 'hmld',                     conv: 1 },         // m  (HMLD, VERIFY slug)
  meterage_per_minute:                { col: 'distance_per_minute',      conv: 1 },         // m/min
  // load
  total_player_load:                  { col: 'player_load',              conv: 1 },         // AU
  // velocities (m/s → km/h)
  max_velocity:                       { col: 'max_speed',                conv: 3.6 },
  mean_velocity:                      { col: 'avg_speed',                conv: 3.6 },        // (VERIFY slug: velocity_average?)
  // counts (kept as integers)
  acceleration_count:                 { col: 'accelerations',            conv: 1 },         // (VERIFY slug)
  deceleration_count:                 { col: 'decelerations',            conv: 1 },         // (VERIFY slug)
  sprint_count:                       { col: 'sprint_count',             conv: 1 },         // (VERIFY slug: total_sprint_events?)
  // time (s → min)
  duration:                           { col: 'time_played',              conv: 1 / 60 },    // (VERIFY slug: total_duration?)
};

// activity.start_time may be epoch seconds, ms, or an ISO string. → ms.
function toMs(v: unknown): number {
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const t = Date.parse(String(v ?? ''));
  return isNaN(t) ? NaN : t;
}
function toDate(v: unknown): string {
  const ms = toMs(v);
  return isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}
// Read a parameter value from a stats row defensively (top-level slug key, or
// nested {parameters:{slug:...}} / {slug:{value:...}} shapes).
function readParam(row: Record<string, unknown>, slug: string): number | null {
  let v: unknown = row[slug];
  if (v == null && row.parameters && typeof row.parameters === 'object') v = (row.parameters as Record<string, unknown>)[slug];
  if (v != null && typeof v === 'object') v = (v as Record<string, unknown>).value ?? (v as Record<string, unknown>).total;
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isFinite(n) ? n : null;
}

// time_played: OpenField devuelve el slug `duration` en 0 (verificado en datos reales: 4202
// de 4218 filas quedaron en 0), así que el mapeo SLUG_MAP no alcanza. Los minutos REALES del
// jugador se derivan del ritmo que Catapult sí calcula bien: distancia ÷ metros-por-minuto.
// Es el tiempo EN CANCHA, no la ventana del período: un suplente que entró a los 30' da sus
// minutos reales, mientras que la duración del período "SECOND HALF" daría el tiempo entero.
// Solo se deriva si el slug mapeado no trajo un valor propio (>0) — si algún día el club
// mapea el slug correcto, ese valor manda.
function deriveTimePlayed(core: Record<string, number | null>) {
  if (typeof core.time_played === 'number' && core.time_played > 0) return;
  const dist = core.total_distance, mpm = core.distance_per_minute;
  if (typeof dist !== 'number' || typeof mpm !== 'number' || mpm <= 0) return;
  const mins = Math.round(dist / mpm);
  if (mins > 0) core.time_played = mins;
}

// slug → canonical core column (with priority) or non-core EAV extra. Pure now (takes
// resolveMap/mappedSlugs + an unmappedParams sink) so it can run outside the request scope.
function normalizeMetrics(
  row: Record<string, unknown>,
  resolveMap: Map<string, { target: string; conv: number }>,
  mappedSlugs: string[],
  unmappedParams: Set<string>,
) {
  // GENERIC seed slug. "Generic" = a key of SLUG_MAP (the auto-seed vocabulary, e.g.
  // acceleration_count); anything else is a club-specific slug (e.g. gen2_acceleration_band…).
  const isGenericSeed = (slug: string) => Object.prototype.hasOwnProperty.call(SLUG_MAP, slug);
  const core: Record<string, number> = {};
  const coreScore: Record<string, number> = {};   // target → collision score of the slug that set it
  const extras: { metric_key: string; value: number }[] = [];
  const slugs = new Set<string>([...mappedSlugs, ...Object.keys(row)]);
  for (const slug of slugs) {
    const map = resolveMap.get(slug);
    if (!map || !map.target || map.target === '__ignore__') {
      // A real parameter value with no mapping → report, don't drop.
      if (!METADATA_KEYS.has(slug) && readParam(row, slug) != null) unmappedParams.add(slug);
      continue;
    }
    const raw = readParam(row, slug);
    if (raw == null) continue;   // slug ABSENT from the response (or unparseable) → never competes
    const num = raw * map.conv;
    if (!isFinite(num)) continue;
    if (GPS_REPORT_COLS.has(map.target)) {
      const val = GPS_INT_COLS.has(map.target) ? Math.round(num) : +num.toFixed(4);
      // TARGET COLLISION (several slugs → same core column). A slug absent from the API response
      // never reaches here (readParam returned null above), so it can NEVER overwrite a slug that
      // IS present. Among PRESENT slugs the winner is picked by SCORE, not by name/order:
      //   • club-specific slug beats the generic seed (specificity is primary), THEN
      //   • within the same tier, a present NON-ZERO reading beats a present ZERO — so a slug that
      //     returns 0 can no longer block a slug carrying the real value (the HSR/VHSR/Sprint bug
      //     from a2b39b8, where velocity_band* sorted last and lost to a 0-valued competitor), THEN
      //   • final ties keep the FIRST slug in the deterministic .order(source_column_name) fetch.
      // A legitimate 0 (e.g. a keeper with 0 sprint distance) is still written when its slug wins
      // (no collision, or every competing slug is 0).
      const score = (isGenericSeed(slug) ? 0 : 2) + (val !== 0 ? 1 : 0);
      if (coreScore[map.target] === undefined || score > coreScore[map.target]) {
        core[map.target] = val;
        coreScore[map.target] = score;
      }
    } else {
      extras.push({ metric_key: map.target, value: +num.toFixed(4) });
    }
  }
  return { core, extras };
}

// ── Sync context (everything a chunk needs), rebuilt per invocation from the job ──
interface Ctx {
  integrationId: string;
  clubId: string;
  teamId: string | null;
  baseUrl: string;
  authH: Record<string, string>;
  playerByExt: Map<string, string>;
  resolveMap: Map<string, { target: string; conv: number }>;
  mappedSlugs: string[];
  seasonStart: string | null;
}

async function loadContext(adminClient: Admin, integrationId: string): Promise<Ctx> {
  const { data: integration, error: intErr } = await adminClient
    .from('gps_integrations').select('id, club_id, provider, config').eq('id', integrationId).single();
  if (intErr || !integration) throw new Error('integration not found');
  if (integration.provider !== 'catapult') throw new Error('provider not supported');

  const clubId = integration.club_id as string;
  const cfg = (integration.config || {}) as Record<string, unknown>;
  const region = cfg.region as string | undefined;
  if (!region || !CATAPULT_BASE[region]) throw new Error('region not set');
  const teamId = (cfg.team_id as string | undefined) || null;
  const baseUrl = CATAPULT_BASE[region];

  const { data: secretRow } = await adminClient
    .from('gps_integration_secrets').select('credential').eq('integration_id', integrationId).single();
  const credential = secretRow?.credential;
  if (!credential) throw new Error('no credential');
  const authH = { Authorization: `Bearer ${credential}` };

  // Club roster: external_gps_id → player_id (adminClient bypasses RLS, scope by club_id).
  const { data: players } = await adminClient
    .from('players').select('id, external_gps_id').eq('club_id', clubId).not('external_gps_id', 'is', null);
  const playerByExt = new Map<string, string>();
  for (const p of (players || [])) if (p.external_gps_id) playerByExt.set(String(p.external_gps_id), p.id as string);

  // Season boundary: sessions BEFORE the club's first microcycle (MC 01) are "last season"
  // → is_historical; on/after it → current (visible by default). Fetched once. Replaces the
  // old "always historical" flag that hid freshly-synced data.
  const { data: _firstMc } = await adminClient
    .from('microcycles').select('start_date')
    .eq('club_id', clubId).not('start_date', 'is', null)
    .order('start_date', { ascending: true }).limit(1).maybeSingle();
  const seasonStart: string | null = (_firstMc?.start_date as string) ?? null;

  // Data-driven resolveMap: slug → { target_metric, unit_conversion }. PAGINATE: a club can have
  // >1000 rows in gps_column_mappings (every Catapult parameter gets a row), and a plain .select()
  // is truncated to ~1000 by PostgREST. With .order(source_column_name) the alphabetically-LAST
  // slugs (e.g. velocity_band*) fell past the cap → not loaded → the sync treated them as UNMAPPED
  // → HSR/VHSR/Sprint stayed 0 even though they were mapped. Page through .range() to get them all.
  const mappings: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await adminClient
      .from('gps_column_mappings')
      .select('source_column_name, target_metric, unit_conversion')
      .eq('club_id', clubId).eq('source_label', 'catapult')
      .order('source_column_name', { ascending: true })   // deterministic collision resolution
      .range(from, from + 999);
    if (error || !data || !data.length) break;
    mappings.push(...data);
    if (data.length < 1000) break;   // short page → last page
  }
  const resolveMap = new Map<string, { target: string; conv: number }>();
  for (const m of mappings) {
    resolveMap.set(String(m.source_column_name), {
      target: String(m.target_metric),
      conv: m.unit_conversion == null ? 1 : Number(m.unit_conversion),
    });
  }

  // AUTO-SEED the 13 core columns the first time (idempotent). Existing rows untouched.
  const seedRows = Object.entries(SLUG_MAP)
    .filter(([slug]) => !resolveMap.has(slug))
    .map(([slug, { col, conv }]) => ({
      club_id: clubId, source_label: 'catapult', source_column_name: slug,
      target_metric: col, unit_conversion: conv,
    }));
  if (seedRows.length) {
    await adminClient.from('gps_column_mappings')
      .upsert(seedRows, { onConflict: 'club_id,source_label,source_column_name', ignoreDuplicates: true });
    for (const r of seedRows) resolveMap.set(r.source_column_name, { target: r.target_metric, conv: r.unit_conversion });
  }

  // Slugs we actually request from /stats: every mapped slug except ignored.
  const mappedSlugs = [...resolveMap.entries()].filter(([, v]) => v.target && v.target !== '__ignore__').map(([s]) => s);

  return { integrationId, clubId, teamId, baseUrl, authH, playerByExt, resolveMap, mappedSlugs, seasonStart };
}

interface ChunkResult {
  act: number; rows: number; per: number; skip: number; flagged: number; pending: number;
  overlap: number;   // períodos redundantes detectados (doble conteo corregido)
  errs: string[]; unmapped: string[];
}

// ── Core sync for ONE [from,to] chunk. This is the SAME logic the function used to run
//    for the whole request; it just returns counters instead of an HTTP body. ──────────
// ── Catapult API call with rate-limit resilience ────────────────────────────
// Catapult is rate-limited. Wrap EVERY Catapult request with retry + exponential backoff
// (honoring Retry-After) on 429 and transient 5xx, so a rate-limit blip recovers instead of
// dropping the activity. PRE-REQ for parallelizing activities (L2): once several stats/period
// calls fly at once, 429s are expected and must self-heal. Non-retryable non-ok (400/401/404)
// is handed back to the caller unchanged (existing `!res.ok` handling stays intact). After the
// retries are exhausted it THROWS → the worker fails the job (never a silent hang).
const CATAPULT_MAX_RETRIES = 5;
const CATAPULT_RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const _sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Exponential backoff with jitter: ~500ms, 1s, 2s, 4s, 8s (+ up to 250ms random so parallel
// retries don't re-synchronize into a new burst).
const _backoffMs = (attempt: number) => 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
// Retry-After may be a seconds count or an HTTP date → ms, or null if unparseable.
function _retryAfterMs(h: string | null): number | null {
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(h);
  return isNaN(at) ? null : Math.max(0, at - Date.now());
}
async function fetchCatapult(url: string, opts?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= CATAPULT_MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      // Network/transport error → treat as transient and retry.
      if (attempt === CATAPULT_MAX_RETRIES) throw e;
      const wait = _backoffMs(attempt);
      console.log(`[gps-sync] fetch error, retrying in ${wait}ms (attempt ${attempt + 1}/${CATAPULT_MAX_RETRIES})`, String((e as Error)?.message || e));
      await _sleep(wait);
      continue;
    }
    if (res.ok || !CATAPULT_RETRY_STATUS.has(res.status)) return res;   // ok, or non-retryable → caller handles
    if (attempt === CATAPULT_MAX_RETRIES) throw new Error(`Catapult ${res.status} after ${CATAPULT_MAX_RETRIES} retries`);
    const wait = _retryAfterMs(res.headers.get('retry-after')) ?? _backoffMs(attempt);
    console.log(`[gps-sync] ${res.status}, retrying in ${wait}ms (attempt ${attempt + 1}/${CATAPULT_MAX_RETRIES})`);
    try { await res.arrayBuffer(); } catch (_) { /* drain body so the connection frees */ }
    await _sleep(wait);
  }
  throw new Error('Catapult request failed');   // unreachable (loop returns/throws), keeps TS happy
}

// onProgress: se llama al cerrar cada LOTE de actividades con el avance dentro del chunk. Sin
// esto la barra sólo se movía al terminar el chunk entero, y como casi todos los sync caben en
// UN chunk (los rangos de menos de 6 meses no se parten), la barra quedaba clavada hasta el
// final: un sync de 26 actividades y 1.747 períodos pasaba 62 s sin moverse y saltaba a 100%.
type ChunkProgress = { done: number; total: number; acc: ChunkResult };
async function syncRange(adminClient: Admin, ctx: Ctx, from: string, to: string, onlyActivityId?: string, tzOffsetMin = 0, onProgress?: (p: ChunkProgress) => Promise<void>): Promise<ChunkResult> {
  const { clubId, teamId, baseUrl, authH, playerByExt, resolveMap, mappedSlugs, seasonStart } = ctx;
  const unmappedParams = new Set<string>();
  // Zona horaria del que sincroniza (minutos al ESTE de UTC; +420 = UTC+7). El rango que elige el
  // usuario ("18/08") es un día LOCAL, no UTC → convertimos las fronteras y la fecha de la sesión a
  // su hora local para que "hoy" siempre entre (Catapult indexa en UTC). 0 = UTC (retrocompatible).
  const _offMs = (Number(tzOffsetMin) || 0) * 60000;
  const _localDate = (v: unknown): string => { const ms = toMs(v); return isNaN(ms) ? '' : new Date(ms + _offMs).toISOString().slice(0, 10); };
  let _statsCalls = 0;   // TEMP: count /stats requests this chunk (logged at chunk end; remove after)

  // ONE /stats request per grain: ask for ALL mapped parameters at once. The earlier 5-param
  // batching was added on a WRONG diagnosis (that Catapult drops params over a cap). There is NO
  // such cap in the API or the evidence: a single request with all mapped slugs returns them all,
  // and Catapult even returns the whole velocity family when any one member is requested. (The real
  // HSR/VHSR/Sprint = 0 bug was the truncated mappings read, fixed in loadContext.) We keep the
  // split+merge as a ZERO-COST SAFETY NET behind a LARGE batch: for any realistic club (a handful of
  // mapped slugs) this is exactly ONE request per grain; only a pathological >100-slug mapping splits.
  const STATS_PARAM_BATCH = 100;
  const _athKey = (rw: Record<string, unknown>) => String(rw.athlete_id ?? (rw.athlete as Record<string, unknown>)?.id ?? rw.id ?? '');
  async function fetchStats(activityId: string, extra: string[], groupBy: string[], keyOf: (rw: Record<string, unknown>) => string): Promise<Record<string, unknown>[]> {
    const params = [...mappedSlugs, ...extra];
    const batches: string[][] = [];
    for (let i = 0; i < params.length; i += STATS_PARAM_BATCH) batches.push(params.slice(i, i + STATS_PARAM_BATCH));
    const results = await Promise.all(batches.map(async (batch) => {
      _statsCalls++;   // TEMP: measure the call reduction
      const res = await fetchCatapult(`${baseUrl}/stats`, {
        method: 'POST', headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: [{ name: 'activity_id', comparison: '=', values: [activityId] }], parameters: batch, group_by: groupBy }),
      });
      if (!res.ok) throw new Error(`stats HTTP ${res.status}`);
      return (await res.json().catch(() => [])) as Record<string, unknown>[];
    }));
    const merged = new Map<string, Record<string, unknown>>();
    for (const rows of results) {
      for (const rw of (Array.isArray(rows) ? rows : [])) {
        const k = keyOf(rw);
        if (!k) continue;
        const m = merged.get(k) || {};
        Object.assign(m, rw);   // combine each batch's params into one row per group key
        merged.set(k, m);
      }
    }
    return [...merged.values()];
  }

  // Range in ms. `to` is a calendar date → toMs() gives its 00:00 UTC. The upper bound
  // must cover the WHOLE `to` day (up to the next midnight, exclusive), otherwise every
  // activity on the `to` day — i.e. TODAY's sessions — falls after 00:00 UTC and is
  // dropped, so a same-day sync imports nothing.
  const DAY_MS      = 86400000;
  // Fronteras del rango en UTC pero interpretando from/to como días LOCALES: medianoche local =
  // medianoche UTC − offset. Así "18/08 local" cubre la actividad aunque en UTC caiga el 17.
  const fromMsRange = toMs(from) - _offMs;
  const toMsRange   = toMs(to) + DAY_MS - _offMs;

  // ── 1. Fetch activities and filter to the range by start_time ───────────
  const actRes = await fetchCatapult(`${baseUrl}/activities`, { headers: authH });
  if (!actRes.ok) {
    // Bad credential/connection → also reflect it on the integration (as before).
    await adminClient.from('gps_integrations')
      .update({ status: 'error', last_error: `activities HTTP ${actRes.status}` }).eq('id', ctx.integrationId);
    throw new Error(`activities HTTP ${actRes.status}`);
  }
  const allActivities = (await actRes.json().catch(() => [])) as Record<string, unknown>[];
  const activities = (Array.isArray(allActivities) ? allActivities : []).filter(a => {
    // Modo dirigido (attach): filtrar por ID de actividad, sin rango de fecha → no depende de la
    // zona horaria (una actividad "del 17/08 local" puede ser 16/08 UTC y caer fuera del rango).
    if (onlyActivityId) return String(a.id ?? a.activity_id ?? '') === onlyActivityId;
    const ms = toMs(a.start_time ?? a.startTime ?? a.start);
    return !isNaN(ms) && ms >= fromMsRange && ms < toMsRange;   // [from 00:00, to+1day 00:00)
  });

  let syncedActivities = 0, syncedRows = 0, syncedPeriods = 0, skippedUnmapped = 0, flaggedPeriods = 0, pendingActivities = 0, overlapPeriods = 0;
  const errors: string[] = [];

  // Per-activity worker: returns its OWN counters (no shared-counter mutation under concurrency)
  // and appends to the shared unmappedParams Set (Set.add is safe on the single-threaded event
  // loop). NEVER throws — errors are collected in .errs — so one bad activity can't reject the
  // whole batch. Idempotent per activity: each writes only its OWN session's rows (delete/insert
  // scoped by session_id; upsert by unique key), so two activities in flight never touch the same
  // row. Within an activity the flow stays SEQUENTIAL (unchanged) to preserve the "no recs → skip
  // periods" semantics; the win comes from running SEVERAL activities at once.
  type ActRes = { act: number; rows: number; per: number; skip: number; flagged: number; pending: number; overlap: number; errs: string[] };
  async function processActivity(act: Record<string, unknown>): Promise<ActRes> {
    const r: ActRes = { act: 0, rows: 0, per: 0, skip: 0, flagged: 0, pending: 0, overlap: 0, errs: [] };
    const activityId = String(act.id ?? act.activity_id ?? '');
    if (!activityId) return r;
    const date = _localDate(act.start_time ?? act.startTime ?? act.start);   // fecha LOCAL del club, no UTC
    if (!date) { r.errs.push(`activity ${activityId}: unparseable start_time`); return r; }

    try {
      // ── 2. Find-or-create the training_session for this activity ────────
      let sessionId: string | null = null;
      const isHistorical = seasonStart ? (date < seasonStart) : false;
      // 2a. Already synced this activity? reuse it.
      const { data: existing } = await adminClient
        .from('training_sessions').select('id')
        .eq('club_id', clubId).eq('external_activity_id', activityId).limit(1);
      sessionId = existing?.[0]?.id as string || null;
      // 2b. Not synced yet — ADOPT a same-day session that has no activity yet (e.g. one created
      //     by hand in the calendar) instead of creating a duplicate. Avoids two sessions per day.
      //     TEAM-SCOPED: an integration belongs to exactly ONE team (config.team_id), so it may
      //     only adopt its OWN team's session — never steal/overwrite another team's same-day
      //     session (multi-team clubs train several teams the same day). When the integration has
      //     no team, only adopt an unassigned (team_id IS NULL) session. We therefore no longer
      //     rewrite team_id on adopt: the adopted row already belongs to the right team.
      if (!sessionId) {
        let adoptQ = adminClient
          .from('training_sessions').select('id, session_time')
          .eq('club_id', clubId).eq('session_date', date)
          .is('external_activity_id', null).neq('session_type', 'gym');
        adoptQ = teamId ? adoptQ.eq('team_id', teamId) : adoptQ.is('team_id', null);
        const { data: sameDay } = await adoptQ.order('created_at', { ascending: true });
        if (sameDay?.length) {
          // Día de doble sesión (AM + partido): adoptar la sesión cuya session_time esté MÁS
          // CERCA del inicio real de la actividad (hora local del club vía tz_offset). Antes se
          // adoptaba la primera creada, que podía ser la equivocada. Sin horas comparables
          // (actividad sin hora o sesiones sin session_time) el sort estable preserva el
          // comportamiento previo: primera por created_at.
          const actMs = toMs(act.start_time ?? act.startTime ?? act.start);
          const actMin = isNaN(actMs) ? null
            : (() => { const d = new Date(actMs + _offMs); return d.getUTCHours() * 60 + d.getUTCMinutes(); })();
          const dist = (st: unknown): number => {
            if (actMin == null || !st) return 24 * 60;
            const parts = String(st).split(':').map(Number);
            if (!isFinite(parts[0]) || !isFinite(parts[1])) return 24 * 60;
            return Math.abs(parts[0] * 60 + parts[1] - actMin);
          };
          const best = [...sameDay].sort((a, b) => dist(a.session_time) - dist(b.session_time))[0];
          sessionId = best.id as string;
          await adminClient.from('training_sessions')
            .update({ external_activity_id: activityId, is_historical: isHistorical })
            .eq('id', sessionId);
        }
      }
      // Si resolvimos sesión (2a/2b), limpiar cualquier pendiente previo de esta actividad
      // (el usuario ya creó/planificó la sesión → deja de estar "sin sesión").
      if (sessionId) {
        await adminClient.from('gps_pending_activities')
          .delete().eq('club_id', clubId).eq('external_activity_id', activityId);
      }
      // 2c. Nada que adoptar. Gateado por is_historical:
      //   · HISTÓRICO (import de temporada pasada): NO hay planificación ni la va a haber → la
      //     sesión GPS-only ES la representación correcta → se crea como siempre.
      //   · ACTUAL (temporada en curso): OPCIÓN A → NO crear evento fantasma; registrar la actividad
      //     como PENDIENTE (solo la referencia) para que el usuario cree la sesión + MD en GPS
      //     Analysis; un re-sync dirigido bajará después los gps_reports.
      if (!sessionId) {
        if (isHistorical) {
          const { data: newSess, error: sErr } = await adminClient
            .from('training_sessions')
            .insert({
              club_id: clubId,
              title: `Training · ${date}`,
              session_date: date,
              session_type: 'training',
              is_historical: true,
              external_activity_id: activityId,
              ...(teamId ? { team_id: teamId } : {}),
            })
            .select('id').single();
          if (sErr || !newSess) { r.errs.push(`session ${date}: ${sErr?.message || 'insert failed'}`); return r; }
          sessionId = newSess.id as string;
        } else {
          await adminClient.from('gps_pending_activities').upsert({
            club_id: clubId,
            team_id: teamId || null,
            session_date: date,
            external_activity_id: activityId,
            source: 'catapult',
            activity_name: act.name ? String(act.name) : null,
          }, { onConflict: 'club_id,external_activity_id' });
          r.pending = 1;
          return r;   // actual sin sesión → no se crea evento ni gps_reports; queda en la bandeja
        }
      }

      // ── 3. Per-athlete stats (one /stats call, all mapped params — see fetchStats) ──
      let statRows: Record<string, unknown>[];
      try { statRows = await fetchStats(activityId, [], ['athlete'], _athKey); }
      catch (e) { r.errs.push(`stats ${activityId}: ${String((e as Error)?.message || e)}`); return r; }

      // ── 4. Normalize → gps_reports recs + non-core EAV ──────────────────
      const recs: Record<string, unknown>[] = [];
      const extrasByPlayer = new Map<string, { metric_key: string; value: number }[]>();
      for (const row of (Array.isArray(statRows) ? statRows : [])) {
        const ext = String(row.athlete_id ?? (row.athlete as Record<string, unknown>)?.id ?? row.id ?? '');
        const playerId = ext ? playerByExt.get(ext) : undefined;
        if (!playerId) { r.skip++; continue; }

        const { core, extras } = normalizeMetrics(row, resolveMap, mappedSlugs, unmappedParams);

        // Outlier defense: total_distance above the physical session max = noise.
        // Insert but flag (OUTLIER_MAX_M, module const — shared with the overlap fix).
        const is_invalid = typeof core.total_distance === 'number' && core.total_distance > OUTLIER_MAX_M;
        // Speed spike defense: max_speed (km/h) at/above the human ceiling is a GPS
        // glitch (Catapult emits 45–82 km/h, or millions). NULL just that metric —
        // the rest of the row is usually fine — so it never feeds Vmax. Keep in sync
        // with assets/gps-units.js MAX_SPEED_KMH.
        const MAX_SPEED_KMH = 40;
        if (typeof core.max_speed === 'number' && core.max_speed >= MAX_SPEED_KMH) core.max_speed = null;
        deriveTimePlayed(core);
        recs.push({ club_id: clubId, session_id: sessionId, player_id: playerId, ...core, is_invalid });
        if (extras.length) extrasByPlayer.set(playerId, extras);
      }

      if (!recs.length) { r.act = 1; return r; }

      // ── 5. Idempotent replace: drop this session's rows, then insert fresh. ──
      // Session is API-owned (external_activity_id), so replacing its reports is safe.
      const batchPlayerIds = recs.map(rec => rec.player_id as string);
      await adminClient.from('gps_reports')
        .delete().eq('club_id', clubId).eq('session_id', sessionId).in('player_id', batchPlayerIds);

      const { data: inserted, error: insErr } = await adminClient
        .from('gps_reports').insert(recs).select('id, player_id');
      if (insErr) { r.errs.push(`reports ${activityId}: ${insErr.message}`); return r; }
      r.rows += (inserted || []).length;

      // ── 6. Non-core metrics → gps_report_metrics ────────────────────────
      const metricRows: Record<string, unknown>[] = [];
      for (const ins of (inserted || [])) {
        const extras = extrasByPlayer.get(ins.player_id as string);
        if (!extras?.length) continue;
        for (const ex of extras) metricRows.push({ report_id: ins.id, club_id: clubId, metric_key: ex.metric_key, value: ex.value });
      }
      if (metricRows.length) {
        const { error: mErr } = await adminClient.from('gps_report_metrics').insert(metricRows);
        if (mErr) r.errs.push(`metrics ${activityId}: ${mErr.message}`);
      }

      // ── 7. PERIOD-level stats (Ladrillo 2b-ii) ──────────────────────────
      // Second /stats for the same activity, broken down by period. Failure
      // here must NOT break the session-level result already written above.
      try {
        // One /stats call (all mapped params + start/end); merge is a no-op unless a >100-slug set splits.
        const perRows = await fetchStats(activityId, ['start_time', 'end_time'], ['period', 'athlete'],
          (rw) => _athKey(rw) + '|' + String(rw.period_id ?? ''));
        {
          const periodRecs: Record<string, unknown>[] = [];
          // Ventanas por jugador para la detección de solape (ver isGenericPeriodName arriba).
          type PerEntry = { start: number | null; end: number | null; name: string | null; rec: Record<string, unknown> };
          const perByPlayer = new Map<string, PerEntry[]>();
          for (const row of (Array.isArray(perRows) ? perRows : [])) {
            const ext = String(row.athlete_id ?? (row.athlete as Record<string, unknown>)?.id ?? row.id ?? '');
            const playerId = ext ? playerByExt.get(ext) : undefined;
            if (!playerId) { r.skip++; continue; }

            const periodId = String(row.period_id ?? '');
            if (!periodId) continue;   // can't form the unique key without it
            const periodName = row.period_name == null ? null : String(row.period_name);

            // duration_seconds: no period duration field → compute from end-start (epoch s).
            const startS = readParam(row, 'start_time');
            const endS   = readParam(row, 'end_time');
            const durationSeconds = (startS != null && endS != null && endS >= startS) ? (endS - startS) : null;

            const { core, extras } = normalizeMetrics(row, resolveMap, mappedSlugs, unmappedParams);
            const extra_metrics: Record<string, number> = {};
            for (const ex of extras) extra_metrics[ex.metric_key] = ex.value;

            // FLAG (don't drop): avg speed = total_distance(m)/duration(s). >13 m/s is noise.
            const _td  = typeof core.total_distance === 'number' ? core.total_distance : null;
            const _mps = (_td != null && durationSeconds != null && durationSeconds > 0) ? _td / durationSeconds : null;
            const isSpeedOutlier = _mps != null && _mps > 13;
            if (isSpeedOutlier) r.flagged++;
            // Same max_speed spike guard as the session level (keep in sync with 40 km/h).
            if (typeof core.max_speed === 'number' && core.max_speed >= 40) core.max_speed = null;
            deriveTimePlayed(core);   // minutos EN CANCHA del período, no su ventana

            const rec: Record<string, unknown> = {
              club_id: clubId, session_id: sessionId, player_id: playerId,
              period_id: periodId, period_name: periodName,
              duration_seconds: durationSeconds ?? null,
              ...core, extra_metrics,
              is_flagged: isSpeedOutlier,
              flag_reason: isSpeedOutlier ? 'speed_outlier' : null,
            };
            periodRecs.push(rec);
            if (!perByPlayer.has(playerId)) perByPlayer.set(playerId, []);
            perByPlayer.get(playerId)!.push({ start: startS, end: endS, name: periodName, rec });
          }

          // ── 7b. Períodos superpuestos → flag + recálculo del reporte de sesión ──
          // Greedy por jugador: aceptar en orden de prioridad (nombrado > genérico, largo >
          // corto); un período cuya ventana ya está cubierta >50% por los aceptados es
          // redundante. Con redundantes: se flaggean (quedan fuera de task analysis) y las
          // columnas-suma del gps_report se recalculan desde los aceptados — sin esto el
          // total de sesión que reporta Catapult viene DUPLICADO (suma todos los períodos).
          const reportFix = new Map<string, Record<string, unknown>>();
          for (const [pid, list] of perByPlayer) {
            if (list.length < 2) continue;
            const sorted = [...list].sort((a, b) =>
              (isGenericPeriodName(a.name) ? 1 : 0) - (isGenericPeriodName(b.name) ? 1 : 0)
              || (((b.end ?? 0) - (b.start ?? 0)) - ((a.end ?? 0) - (a.start ?? 0))));
            const accepted: PerEntry[] = [], redundant: PerEntry[] = [];
            for (const p of sorted) {
              if (p.start == null || p.end == null || p.end <= p.start) { accepted.push(p); continue; }
              const dur = p.end - p.start;
              let ov = 0;
              for (const a of accepted) {
                if (a.start == null || a.end == null) continue;
                ov += Math.max(0, Math.min(p.end, a.end) - Math.max(p.start, a.start));
              }
              if (ov > dur * 0.5) redundant.push(p); else accepted.push(p);
            }
            if (!redundant.length) continue;
            for (const p of redundant) {
              p.rec.is_flagged = true;
              p.rec.flag_reason = 'overlap_duplicate';
            }
            r.overlap += redundant.length;
            // Recalcular SOLO las columnas de acumulación desde los períodos aceptados
            // (max_speed/avg_speed a nivel actividad no se duplican por solape → intactas).
            const fix: Record<string, unknown> = {};
            for (const col of GPS_SUM_COLS) {
              let s = 0, any = false;
              for (const p of accepted) {
                const v = p.rec[col as keyof typeof p.rec];
                if (typeof v === 'number' && isFinite(v)) { s += v; any = true; }
              }
              if (any) fix[col] = GPS_INT_COLS.has(col) ? Math.round(s) : +s.toFixed(4);
            }
            // Minutos EN CANCHA de los períodos aceptados (distancia ÷ ritmo de cada uno), NO la
            // suma de sus ventanas: la ventana del período mide cuánto duró el bloque, no cuánto
            // estuvo el jugador dentro (un suplente comparte la ventana del 2º tiempo con los
            // titulares pero jugó una fracción). Fallback a las ventanas si falta el ritmo.
            const minReal = accepted.reduce((s, p) => {
              const d = p.rec.total_distance, m = p.rec.distance_per_minute;
              return s + ((typeof d === 'number' && typeof m === 'number' && m > 0) ? d / m : 0);
            }, 0);
            const durS = accepted.reduce((s, p) => s + (typeof p.rec.duration_seconds === 'number' ? p.rec.duration_seconds as number : 0), 0);
            const minFix = minReal > 0 ? minReal : (durS > 0 ? durS / 60 : 0);
            if (typeof fix.total_distance === 'number') {
              if (minFix > 0) {
                fix.distance_per_minute = +((fix.total_distance as number) / minFix).toFixed(4);
                fix.time_played = Math.round(minFix);
              }
              fix.is_invalid = (fix.total_distance as number) > OUTLIER_MAX_M;   // re-evaluar el outlier con el total corregido
            }
            if (Object.keys(fix).length) reportFix.set(pid, fix);
          }

          if (periodRecs.length) {
            const { error: pErr } = await adminClient.from('gps_period_reports')
              .upsert(periodRecs, { onConflict: 'club_id,session_id,period_id,player_id' });
            if (pErr) r.errs.push(`periods ${activityId}: ${pErr.message}`);
            else r.per += periodRecs.length;
          }
          if (reportFix.size) {
            console.log(`[gps-sync] overlap fix: activity ${activityId}, ${reportFix.size} player(s) recomputed from non-overlapping periods`);
            for (const [pid, fix] of reportFix) {
              const { error: fErr } = await adminClient.from('gps_reports')
                .update(fix).eq('club_id', clubId).eq('session_id', sessionId).eq('player_id', pid);
              if (fErr) r.errs.push(`overlap fix ${activityId}: ${fErr.message}`);
            }
          }

          // ── 7c. Top-up: trabajo EXTRA del jugador, no minutos de la sesión → se descuenta
          // de time_played. El work_context lo asigna un trigger de la DB al insertar el período
          // (gps_context_rules, por nombre), así que hay que RELEERLO — no está en periodRecs.
          // Solo top-up: rehab e individual sí son trabajo del jugador y siguen contando.
          try {
            const { data: topups } = await adminClient.from('gps_period_reports')
              .select('player_id,total_distance,distance_per_minute')
              .eq('club_id', clubId).eq('session_id', sessionId).eq('work_context', 'topup');
            const minsByPlayer = new Map<string, number>();
            for (const t of (topups || [])) {
              const d = t.total_distance as number | null, m = t.distance_per_minute as number | null;
              if (typeof d !== 'number' || typeof m !== 'number' || m <= 0) continue;
              const pid = t.player_id as string;
              minsByPlayer.set(pid, (minsByPlayer.get(pid) || 0) + d / m);
            }
            for (const [pid, mins] of minsByPlayer) {
              const { data: rep } = await adminClient.from('gps_reports')
                .select('time_played').eq('club_id', clubId).eq('session_id', sessionId).eq('player_id', pid).maybeSingle();
              const tp = rep?.time_played as number | null;
              if (typeof tp !== 'number' || tp <= 0) continue;
              const net = Math.round(tp - mins);
              if (net === tp) continue;
              await adminClient.from('gps_reports')
                .update({ time_played: net > 0 ? net : null })
                .eq('club_id', clubId).eq('session_id', sessionId).eq('player_id', pid);
            }
          } catch (te) {
            r.errs.push(`topup discount ${activityId}: ${String((te as Error)?.message || te)}`);
          }
        }
      } catch (pe) {
        r.errs.push(`periods ${activityId}: ${String((pe as Error)?.message || pe)}`);
      }

      r.act = 1;
      return r;
    } catch (e) {
      r.errs.push(`activity ${activityId}: ${String((e as Error)?.message || e)}`);
      return r;
    }
  }

  // ── Process activities in BOUNDED PARALLEL batches ──────────────────────
  // BATCH_SIZE activities run concurrently; each now fans out its /stats into several PARALLEL
  // parameter batches (see fetchStats), so peak in-flight ≈ BATCH_SIZE × (#param batches). Kept
  // low (3) to bound that against Catapult rate limits — any 429 that slips through self-heals via
  // fetchCatapult's backoff (L1). One activity-batch settles before the next starts.
  const BATCH_SIZE = 3;
  const _t0 = Date.now();
  for (let i = 0; i < activities.length; i += BATCH_SIZE) {
    const results = await Promise.all(activities.slice(i, i + BATCH_SIZE).map(processActivity));
    for (const rr of results) {
      syncedActivities += rr.act; syncedRows += rr.rows; syncedPeriods += rr.per;
      skippedUnmapped += rr.skip; flaggedPeriods += rr.flagged; pendingActivities += rr.pending;
      overlapPeriods += rr.overlap;
      if (rr.errs.length) errors.push(...rr.errs);
    }
    if (onProgress) {
      // Awaited a propósito: el callback viene throttleado, así que son pocos writes y no
      // conviene dejarlos sueltos compitiendo con el lote siguiente.
      await onProgress({
        done: Math.min(i + BATCH_SIZE, activities.length),
        total: activities.length,
        acc: { act: syncedActivities, rows: syncedRows, per: syncedPeriods, skip: skippedUnmapped,
               flagged: flaggedPeriods, pending: pendingActivities, overlap: overlapPeriods,
               errs: errors, unmapped: [...unmappedParams] },
      }).catch(() => { /* el progreso es cosmético: nunca debe tumbar el sync */ });
    }
  }

  console.log(`[gps-sync] chunk ${from}..${to} done in ${Date.now() - _t0}ms, ${activities.length} activities, ${_statsCalls} /stats calls, batch=${BATCH_SIZE}, flagged ${flaggedPeriods} periods, overlap ${overlapPeriods} periods`);
  return { act: syncedActivities, rows: syncedRows, per: syncedPeriods, skip: skippedUnmapped, flagged: flaggedPeriods, pending: pendingActivities, overlap: overlapPeriods, errs: errors, unmapped: [...unmappedParams] };
}

// ── job helpers ─────────────────────────────────────────────────────────────
const nowISO = () => new Date().toISOString();

// Fire-and-keep-alive: let a background promise outlive the HTTP response.
function background(p: Promise<unknown>) {
  const er = (globalThis as { EdgeRuntime?: { waitUntil(x: Promise<unknown>): void } }).EdgeRuntime;
  if (er && typeof er.waitUntil === 'function') { er.waitUntil(p); return; }
  p.catch((e) => console.error('[gps-sync] background error:', e));   // best-effort fallback
}

// Monthly [from,to] chunks (inclusive), identical to the old CLIENT chunker.
function monthlyChunks(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let s = new Date(from + 'T00:00:00Z'); const end = new Date(to + 'T00:00:00Z');
  if (isNaN(+s) || isNaN(+end) || s > end) return [[from, to]];
  while (s <= end) {
    let e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0)); // last day of s's month
    if (e > end) e = end;
    out.push([s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]);
    s = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate() + 1)); // next day
  }
  return out;
}
// >6 months → monthly chunks (rate limits); otherwise a single chunk. Same rule as before.
function computeChunks(from: string, to: string): [string, string][] {
  const SIX_MONTHS = 183 * 86400 * 1000;
  const big = (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) > SIX_MONTHS;
  return big ? monthlyChunks(from, to) : [[from, to]];
}

// Merge a chunk's counters into the job's running totals jsonb.
function mergeTotals(prev: Record<string, unknown> | null, p: ChunkResult): Record<string, unknown> {
  const q = (prev || {}) as Record<string, number | string[]>;
  const n = (k: string) => (typeof q[k] === 'number' ? q[k] as number : 0);
  const a = (k: string) => (Array.isArray(q[k]) ? q[k] as string[] : []);
  return {
    activities:        n('activities') + p.act,
    rows:              n('rows') + p.rows,
    periods:           n('periods') + p.per,
    skipped_unmapped:  n('skipped_unmapped') + p.skip,
    flagged_periods:   n('flagged_periods') + p.flagged,
    pending_activities: n('pending_activities') + p.pending,
    overlap_periods:   n('overlap_periods') + p.overlap,   // doble conteo detectado y corregido
    errors:            [...a('errors'), ...p.errs].slice(0, 200),   // cap the log
    unmapped_params:   [...new Set([...a('unmapped_params'), ...p.unmapped])],
  };
}

async function failJob(adminClient: Admin, jobId: string, message: string) {
  await adminClient.from('gps_sync_jobs')
    .update({ status: 'error', error: message.slice(0, 2000), heartbeat_at: nowISO(), finished_at: nowISO() })
    .eq('id', jobId);
  console.error('[gps-sync] job', jobId, 'failed:', message);
}

// Re-invoke SELF in worker mode for the next chunk (server-to-server, service role).
async function invokeWorker(jobId: string) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gps-sync`;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    // Await only the fast 202 (delivery guarantee); the worker processes the chunk in ITS
    // OWN background, so we never nest chunk-processing in memory (keeps each call < wall-clock).
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${svc}`, apikey: svc },
      body: JSON.stringify({ mode: 'worker', job_id: jobId }),
    });
  } catch (e) {
    console.error('[gps-sync] chain invoke failed for job', jobId, e);
  }
}

// Process ONE chunk of a job, then chain the next (or finalize). Runs in the background.
async function processChunk(adminClient: Admin, jobId: string) {
  const { data: job, error } = await adminClient.from('gps_sync_jobs').select('*').eq('id', jobId).single();
  if (error || !job) { console.warn('[gps-sync] processChunk: job not found', jobId, error?.message || ''); return; }
  console.log('[gps-sync] processChunk start', { jobId, status: job.status, chunksDone: job.chunks_done, chunksTotal: job.chunks_total });
  if (job.status !== 'running') return;   // cancelled / errored / done → stop the chain

  // Claim: bump heartbeat at pickup so the stale-reaper won't reclaim a chunk in flight.
  await adminClient.from('gps_sync_jobs').update({ heartbeat_at: nowISO() }).eq('id', jobId);

  let ctx: Ctx;
  try { ctx = await loadContext(adminClient, job.integration_id as string); }
  catch (e) { await failJob(adminClient, jobId, `context: ${String((e as Error)?.message || e)}`); return; }

  const chunks = computeChunks(job.range_from as string, job.range_to as string);
  const idx = job.chunks_done as number;      // next chunk to process (= cursor)
  const chunk = chunks[idx];
  if (!chunk) {                                // nothing left → finalize defensively
    await adminClient.from('gps_sync_jobs')
      .update({ status: 'done', cursor_from: null, cursor_to: null, heartbeat_at: nowISO(), finished_at: nowISO() })
      .eq('id', jobId);
    await adminClient.from('gps_integrations').update({ last_sync_at: nowISO(), last_error: null }).eq('id', job.integration_id);
    return;
  }

  console.log('[gps-sync] processing chunk', { jobId, idx, chunk });
  let partial: ChunkResult;
  // Progreso VIVO dentro del chunk: cada lote de actividades publica el avance (act_done /
  // act_total) y los contadores parciales en el mismo jsonb `totals`, que ya viaja por Realtime
  // a la barra. Va throttleado para no escribir en cada lote de un sync grande, y refresca el
  // heartbeat de paso, así un chunk largo no se marca como colgado.
  let _lastBeat = 0;
  const _onProgress = async (p: ChunkProgress) => {
    const now = Date.now();
    if (now - _lastBeat < 1200 && p.done < p.total) return;
    _lastBeat = now;
    const live = mergeTotals(job.totals as Record<string, unknown>, p.acc);
    live.act_done = p.done; live.act_total = p.total;
    await adminClient.from('gps_sync_jobs')
      .update({ totals: live, heartbeat_at: nowISO() }).eq('id', jobId);
  };
  try { partial = await syncRange(adminClient, ctx, chunk[0], chunk[1], undefined, (job.tz_offset as number) || 0, _onProgress); }
  catch (e) { await failJob(adminClient, jobId, `chunk ${chunk[0]}..${chunk[1]}: ${String((e as Error)?.message || e)}`); return; }

  const totals = mergeTotals(job.totals as Record<string, unknown>, partial);
  const chunksDone = idx + 1;
  const next = chunks[chunksDone];

  if (next) {
    await adminClient.from('gps_sync_jobs').update({
      chunks_done: chunksDone, cursor_from: next[0], cursor_to: next[1],
      totals, heartbeat_at: nowISO(),
    }).eq('id', jobId);
    console.log('[gps-sync] chunk done, chaining next', { jobId, chunksDone, next });
    // Fire-and-forget the NEXT chunk's worker (fresh isolate). NOT awaited: awaiting would make
    // this worker block until the WHOLE remaining chain finished (cascading wall-clock). waitUntil
    // just holds this isolate long enough to deliver the trigger fetch to the next worker.
    background(invokeWorker(jobId));
  } else {
    await adminClient.from('gps_sync_jobs').update({
      chunks_done: chunksDone, cursor_from: null, cursor_to: null,
      totals, status: 'done', heartbeat_at: nowISO(), finished_at: nowISO(),
    }).eq('id', jobId);
    // Mirror the old success side-effect: stamp last_sync_at on the integration.
    await adminClient.from('gps_integrations').update({ last_sync_at: nowISO(), last_error: null }).eq('id', job.integration_id);
    console.log('[gps-sync] job complete', { jobId, chunksDone, totals });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const authHeader = req.headers.get('Authorization') ?? '';

    // ══ WORKER MODE ═══════════════════════════════════════════════════════
    // Server-to-server chain step. Authenticated by the SERVICE ROLE key (only the
    // server has it); the browser can never enter this branch. Responds fast + runs
    // one chunk in the background.
    if (body.mode === 'worker') {
      const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!svc || bearer !== svc) return json({ error: 'Forbidden' }, 403);
      const jobId = body.job_id as string | undefined;
      if (!jobId) return json({ error: 'job_id is required' }, 400);
      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, svc);
      console.log('[gps-sync] worker mode invoked', { jobId });
      // SYNCHRONOUS: awaiting keeps THIS isolate alive for the entire chunk. The previous
      // design ran processChunk as post-response background (EdgeRuntime.waitUntil) and the
      // isolate was torn down on the 202 before any work ran → job stuck at chunks_done=0.
      // Now the heavy work runs inside a live request; processChunk fire-and-forgets the
      // NEXT chunk's worker itself (so chunks still chain across fresh isolates).
      await processChunk(adminClient, jobId);
      return json({ ok: true, done: true }, 200);
    }

    // ══ CANCEL MODE (client) ══════════════════════════════════════════════
    // A club admin/owner stops an in-progress sync (JWT — user action, not service role).
    // Cooperative: we only flip status→'cancelled'; the running worker sees status!='running'
    // at its next chunk check (processChunk) and stops chaining. The in-flight chunk finishes
    // (idempotent). 'cancelled' also leaves the (queued|running) partial-unique index → LOCK
    // FREED, so a new 'start' can immediately create a fresh job. Idempotent: no active job → ok.
    if (body.mode === 'cancel') {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Not authenticated' }, 401);
      const jobId = body.job_id as string | undefined;
      const integrationId = body.integration_id as string | undefined;
      if (!jobId && !integrationId) return json({ error: 'job_id or integration_id is required' }, 400);

      const { data: callerClub } = await userClient.rpc('get_user_club_id');
      const { data: isSuper } = await userClient.rpc('is_super_admin');
      if (!callerClub && !isSuper) return json({ error: 'No club found for caller' }, 403);

      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      // Role gate: only admin/owner of the club (or a platform super-admin) may cancel.
      const { data: prof } = await adminClient.from('profiles').select('role, club_role').eq('id', user.id).single();
      const role = String(prof?.role || '').toLowerCase(), clubRole = String(prof?.club_role || '').toLowerCase();
      const isAdminOwner = ['admin', 'owner'].includes(role) || ['admin', 'owner'].includes(clubRole);
      if (!isAdminOwner && !isSuper) return json({ error: 'Forbidden' }, 403);

      // Find the ACTIVE (queued|running) job — by id, else the latest for the integration.
      let q = adminClient.from('gps_sync_jobs').select('id, club_id, status').in('status', ['queued', 'running']);
      q = jobId ? q.eq('id', jobId) : q.eq('integration_id', integrationId!).order('created_at', { ascending: false }).limit(1);
      const { data: job } = await q.maybeSingle();
      if (!job) return json({ ok: true, cancelled: false, message: 'no active job' }, 200);   // idempotent
      if (job.club_id !== callerClub && !isSuper) return json({ error: 'Forbidden' }, 403);

      // Guard status in the UPDATE so we never overwrite a job that just finished on its own.
      const { data: updated } = await adminClient.from('gps_sync_jobs')
        .update({ status: 'cancelled', error: 'cancelled by user', heartbeat_at: nowISO(), finished_at: nowISO() })
        .eq('id', job.id).in('status', ['queued', 'running'])
        .select('id').maybeSingle();
      console.log('[gps-sync] cancel', { jobId: job.id, cancelled: !!updated });
      return json({ ok: true, cancelled: !!updated, job_id: job.id, status: 'cancelled' }, 200);
    }

    // ══ ATTACH MODE (client) — bajar UNA actividad y engancharla a UNA sesión ══════════
    // Para la bandeja "GPS sin sesión": el usuario creó/eligió la sesión; acá bajamos SOLO esa
    // actividad (filtrada por su ID, sin rango de fecha → sin problema de zona horaria) y la
    // escribimos en esa sesión. Pre-linkeamos server-side (service-role, sin RLS) para que
    // processActivity la adopte por external_activity_id (2a), saltando el team-match (2b) que
    // falla con integraciones team-less. Síncrono (una actividad) → el cliente no polea.
    if (body.mode === 'attach') {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Not authenticated' }, 401);
      const integrationId = body.integration_id as string | undefined;
      const activityId = body.external_activity_id as string | undefined;
      const sessionId = body.session_id as string | undefined;
      if (!integrationId || !activityId || !sessionId) return json({ error: 'integration_id, external_activity_id and session_id are required' }, 400);

      const { data: callerClub } = await userClient.rpc('get_user_club_id');
      const { data: isSuper } = await userClient.rpc('is_super_admin');
      if (!callerClub && !isSuper) return json({ error: 'No club found for caller' }, 403);

      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      // Role gate (igual que START): admin/owner + S&C.
      const _SYNC_ROLES = new Set(['admin', 'owner', 'sc_coach', 'fitness_coach']);
      const { data: prof } = await adminClient.from('profiles').select('role, club_role').eq('id', user.id).single();
      const role = String(prof?.role || '').toLowerCase(), clubRole = String(prof?.club_role || '').toLowerCase();
      if (!isSuper && !_SYNC_ROLES.has(role) && !_SYNC_ROLES.has(clubRole)) return json({ error: 'Forbidden' }, 403);

      const { data: integration } = await adminClient.from('gps_integrations').select('id, club_id, provider').eq('id', integrationId).single();
      if (!integration || (integration.club_id !== callerClub && !isSuper)) return json({ error: 'Integration not found' }, 404);
      if (integration.provider !== 'catapult') return json({ ok: false, message: 'Not supported for this provider yet' });
      const clubId = integration.club_id as string;
      const { data: sess } = await adminClient.from('training_sessions').select('id, club_id, session_date').eq('id', sessionId).single();
      if (!sess || sess.club_id !== clubId) return json({ error: 'Session not found' }, 404);

      // Pre-linkear la sesión a la actividad (service-role → sin RLS) para que 2a la adopte.
      await adminClient.from('training_sessions').update({ external_activity_id: activityId }).eq('id', sessionId);

      // Bajar SOLO esa actividad (filtro por id) y escribirla en la sesión.
      const ctx = await loadContext(adminClient, integrationId);
      const result = await syncRange(adminClient, ctx, String(sess.session_date), String(sess.session_date), activityId, Number(body.tz_offset) || 0);

      // Limpiar el pendiente por si processActivity no lo hizo (ej. la actividad no vino en la lista).
      await adminClient.from('gps_pending_activities').delete().eq('club_id', clubId).eq('external_activity_id', activityId);

      console.log('[gps-sync] attach', { activityId, sessionId, rows: result.rows, errs: result.errs });
      return json({ ok: true, rows: result.rows, periods: result.per, errs: result.errs }, 200);
    }

    // ══ START MODE (client) ═══════════════════════════════════════════════
    // Auth: resolve caller's club from JWT.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const integration_id = body.integration_id as string | undefined;
    const from = body.from as string | undefined;
    const to = body.to as string | undefined;
    const tzOffset = Number(body.tz_offset) || 0;   // minutos al este de UTC (browser del que sincroniza)
    if (!integration_id) return json({ error: 'integration_id is required' }, 400);

    const { data: callerClub } = await userClient.rpc('get_user_club_id');
    if (!callerClub) return json({ error: 'No club found for caller' }, 403);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: integration, error: intErr } = await adminClient
      .from('gps_integrations').select('id, club_id, provider').eq('id', integration_id).single();
    if (intErr || !integration) return json({ error: 'Integration not found' }, 404);
    if (integration.club_id !== callerClub) return json({ error: 'Forbidden' }, 403);
    if (integration.provider !== 'catapult') return json({ ok: false, message: 'Not supported for this provider yet' });
    const clubId = integration.club_id as string;

    // ── Role gate: who may TRIGGER a sync ────────────────────────────────────
    // Mirrors window.cmCanImportGps in the client: admin/owner + S&C (sc_coach/
    // fitness_coach). Config (connect/verify/map/token) stays admin-only in the UI;
    // this is the daily pull, opened to S&C so they aren't blocked on an admin.
    // Super-admins always pass. ⚠️ When "Head of performance" ships, add its slug here.
    const _SYNC_ROLES = new Set(['admin', 'owner', 'sc_coach', 'fitness_coach']);
    const { data: _isSuper } = await userClient.rpc('is_super_admin');
    const { data: _prof } = await adminClient.from('profiles').select('role, club_role').eq('id', user.id).single();
    const _role = String(_prof?.role || '').toLowerCase(), _clubRole = String(_prof?.club_role || '').toLowerCase();
    if (!_isSuper && !_SYNC_ROLES.has(_role) && !_SYNC_ROLES.has(_clubRole)) {
      return json({ ok: false, error: 'Forbidden', message: 'Not allowed to sync GPS data' }, 403);
    }

    // Range defaults MATCH the old client: empty picker → all-time (2010 → today).
    const range_from = from || '2010-01-01';
    const range_to   = to   || new Date().toISOString().slice(0, 10);
    if (range_from > range_to) return json({ ok: false, message: '"from" must be before "to"' }, 400);

    // ── LOCK + dead-job reap ──────────────────────────────────────────────
    const staleISO = new Date(Date.now() - STALE_MS).toISOString();
    const { data: active } = await adminClient.from('gps_sync_jobs')
      .select('id, status, heartbeat_at, chunks_done, chunks_total')
      .eq('integration_id', integration_id).in('status', ['queued', 'running'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (active) {
      const hbMs = active.heartbeat_at ? new Date(active.heartbeat_at as string).getTime() : 0;
      if (Date.now() - hbMs <= STALE_MS) {
        // Genuinely alive → do NOT start a second sync. Return the running job.
        return json({ ok: true, already_running: true, job_id: active.id, status: active.status,
                      chunks_done: active.chunks_done, chunks_total: active.chunks_total }, 409);
      }
      // Stale (worker died) → RESUME the SAME job from its cursor. Atomic reclaim: the
      // `.lt(heartbeat)` guard means only ONE concurrent reaper wins the update.
      const { data: claimed } = await adminClient.from('gps_sync_jobs')
        .update({ status: 'running', heartbeat_at: nowISO(), error: null })
        .eq('id', active.id).lt('heartbeat_at', staleISO)
        .select('id').maybeSingle();
      if (!claimed) return json({ ok: true, already_running: true, job_id: active.id }, 409);
      console.log('[gps-sync] start: resuming stale job, dispatching worker', { jobId: active.id });
      background(invokeWorker(active.id as string));
      return json({ ok: true, job_id: active.id, resumed: true }, 202);
    }

    // ── Create a fresh job ────────────────────────────────────────────────
    const chunks = computeChunks(range_from, range_to);
    const first = chunks[0];
    const { data: job, error: jErr } = await adminClient.from('gps_sync_jobs').insert({
      club_id: clubId, integration_id, status: 'running',
      range_from, range_to, cursor_from: first[0], cursor_to: first[1],
      chunks_total: chunks.length, chunks_done: 0, totals: {}, tz_offset: tzOffset,
      created_by: user.id, started_at: nowISO(), heartbeat_at: nowISO(),
    }).select('id').single();

    if (jErr) {
      // 23505 = unique_violation on gps_sync_jobs_one_active → a concurrent START won the race.
      if ((jErr as { code?: string }).code === '23505') {
        const { data: ex } = await adminClient.from('gps_sync_jobs').select('id, status')
          .eq('integration_id', integration_id).in('status', ['queued', 'running'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        return json({ ok: true, already_running: true, job_id: ex?.id }, 409);
      }
      throw jErr;
    }

    // Dispatch the FIRST chunk to a SEPARATE worker invocation (its own isolate + full request
    // budget), then return 202 at once. We do NOT process in this isolate — it dies on response.
    // waitUntil only has to keep THIS isolate alive long enough to deliver the trigger fetch.
    console.log('[gps-sync] start: job created, dispatching worker', { jobId: job.id, chunksTotal: chunks.length });
    background(invokeWorker(job.id as string));
    return json({ ok: true, job_id: job.id, chunks_total: chunks.length }, 202);

  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 502);
  }
});
