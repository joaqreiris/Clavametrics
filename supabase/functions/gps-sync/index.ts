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
  // Ties within the same tier resolve to the FIRST slug in the deterministic .order() fetch
  // → the winner never depends on Postgres row order. Non-core (EAV) keep append semantics.
  const isGenericSeed = (slug: string) => Object.prototype.hasOwnProperty.call(SLUG_MAP, slug);
  const core: Record<string, number> = {};
  const corePrio: Record<string, number> = {};   // target → specificity of the slug that set it
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
    if (raw == null) continue;
    const num = raw * map.conv;
    if (!isFinite(num)) continue;
    if (GPS_REPORT_COLS.has(map.target)) {
      const val = GPS_INT_COLS.has(map.target) ? Math.round(num) : +num.toFixed(4);
      const prio = isGenericSeed(slug) ? 0 : 1;   // 1 = club-specific → beats the generic seed
      if (corePrio[map.target] === undefined || prio > corePrio[map.target]) {
        core[map.target] = val;
        corePrio[map.target] = prio;
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

  // Data-driven resolveMap: slug → { target_metric, unit_conversion } (same table as the CSV).
  const { data: mappings } = await adminClient
    .from('gps_column_mappings')
    .select('source_column_name, target_metric, unit_conversion')
    .eq('club_id', clubId).eq('source_label', 'catapult')
    .order('source_column_name', { ascending: true });   // deterministic collision resolution
  const resolveMap = new Map<string, { target: string; conv: number }>();
  for (const m of (mappings || [])) {
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

  return { integrationId, clubId, teamId, baseUrl, authH, playerByExt, resolveMap, mappedSlugs };
}

interface ChunkResult {
  act: number; rows: number; per: number; skip: number; flagged: number;
  errs: string[]; unmapped: string[];
}

// ── Core sync for ONE [from,to] chunk. This is the SAME logic the function used to run
//    for the whole request; it just returns counters instead of an HTTP body. ──────────
async function syncRange(adminClient: Admin, ctx: Ctx, from: string, to: string): Promise<ChunkResult> {
  const { clubId, teamId, baseUrl, authH, playerByExt, resolveMap, mappedSlugs } = ctx;
  const unmappedParams = new Set<string>();

  // Range in ms (identical semantics to the previous per-request implementation).
  const toMsRange   = toMs(to);
  const fromMsRange = toMs(from);

  // ── 1. Fetch activities and filter to the range by start_time ───────────
  const actRes = await fetch(`${baseUrl}/activities`, { headers: authH });
  if (!actRes.ok) {
    // Bad credential/connection → also reflect it on the integration (as before).
    await adminClient.from('gps_integrations')
      .update({ status: 'error', last_error: `activities HTTP ${actRes.status}` }).eq('id', ctx.integrationId);
    throw new Error(`activities HTTP ${actRes.status}`);
  }
  const allActivities = (await actRes.json().catch(() => [])) as Record<string, unknown>[];
  const activities = (Array.isArray(allActivities) ? allActivities : []).filter(a => {
    const ms = toMs(a.start_time ?? a.startTime ?? a.start);
    return !isNaN(ms) && ms >= fromMsRange && ms <= toMsRange;
  });

  let syncedActivities = 0, syncedRows = 0, syncedPeriods = 0, skippedUnmapped = 0, flaggedPeriods = 0;
  const errors: string[] = [];

  for (const act of activities) {
    const activityId = String(act.id ?? act.activity_id ?? '');
    if (!activityId) continue;
    const date = toDate(act.start_time ?? act.startTime ?? act.start);
    if (!date) { errors.push(`activity ${activityId}: unparseable start_time`); continue; }

    try {
      // ── 2. Find-or-create the training_session for this activity ────────
      let sessionId: string | null = null;
      const { data: existing } = await adminClient
        .from('training_sessions').select('id')
        .eq('club_id', clubId).eq('external_activity_id', activityId).limit(1);
      sessionId = existing?.[0]?.id as string || null;
      if (!sessionId) {
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
        if (sErr || !newSess) { errors.push(`session ${date}: ${sErr?.message || 'insert failed'}`); continue; }
        sessionId = newSess.id as string;
      }

      // ── 3. Per-athlete stats for this activity ──────────────────────────
      const statsRes = await fetch(`${baseUrl}/stats`, {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [{ name: 'activity_id', comparison: '=', values: [activityId] }],
          parameters: mappedSlugs,
          group_by: ['athlete'],
        }),
      });
      if (!statsRes.ok) { errors.push(`stats ${activityId}: HTTP ${statsRes.status}`); continue; }
      const statRows = (await statsRes.json().catch(() => [])) as Record<string, unknown>[];

      // ── 4. Normalize → gps_reports recs + non-core EAV ──────────────────
      const recs: Record<string, unknown>[] = [];
      const extrasByPlayer = new Map<string, { metric_key: string; value: number }[]>();
      for (const row of (Array.isArray(statRows) ? statRows : [])) {
        const ext = String(row.athlete_id ?? (row.athlete as Record<string, unknown>)?.id ?? row.id ?? '');
        const playerId = ext ? playerByExt.get(ext) : undefined;
        if (!playerId) { skippedUnmapped++; continue; }

        const { core, extras } = normalizeMetrics(row, resolveMap, mappedSlugs, unmappedParams);
        // Outlier defense (same contract as the CSV importer): total_distance in
        // canonical metres above the physical session max = noise. Insert but flag.
        const OUTLIER_MAX_M = 25000; // keep in sync with assets/gps-units.js
        const is_invalid = typeof core.total_distance === 'number' && core.total_distance > OUTLIER_MAX_M;
        recs.push({ club_id: clubId, session_id: sessionId, player_id: playerId, ...core, is_invalid });
        if (extras.length) extrasByPlayer.set(playerId, extras);
      }

      if (!recs.length) { syncedActivities++; continue; }

      // ── 5. Idempotent replace: drop this batch's rows for the session, ──
      //       then insert fresh. Session is API-owned (external_activity_id),
      //       so replacing its reports is safe. Cascade clears old EAV rows.
      const batchPlayerIds = recs.map(r => r.player_id as string);
      await adminClient.from('gps_reports')
        .delete().eq('club_id', clubId).eq('session_id', sessionId).in('player_id', batchPlayerIds);

      const { data: inserted, error: insErr } = await adminClient
        .from('gps_reports').insert(recs).select('id, player_id');
      if (insErr) { errors.push(`reports ${activityId}: ${insErr.message}`); continue; }
      syncedRows += (inserted || []).length;

      // ── 6. Non-core metrics → gps_report_metrics ────────────────────────
      const metricRows: Record<string, unknown>[] = [];
      for (const r of (inserted || [])) {
        const extras = extrasByPlayer.get(r.player_id as string);
        if (!extras?.length) continue;
        for (const ex of extras) metricRows.push({ report_id: r.id, club_id: clubId, metric_key: ex.metric_key, value: ex.value });
      }
      if (metricRows.length) {
        const { error: mErr } = await adminClient.from('gps_report_metrics').insert(metricRows);
        if (mErr) errors.push(`metrics ${activityId}: ${mErr.message}`);
      }

      // ── 7. PERIOD-level stats (Ladrillo 2b-ii) ──────────────────────────
      // Second /stats for the same activity, broken down by period. Failure
      // here must NOT break the session-level result already written above.
      try {
        const perRes = await fetch(`${baseUrl}/stats`, {
          method: 'POST',
          headers: { ...authH, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: [{ name: 'activity_id', comparison: '=', values: [activityId] }],
            parameters: [...mappedSlugs, 'start_time', 'end_time'],
            group_by: ['period', 'athlete'],
          }),
        });
        if (!perRes.ok) {
          errors.push(`periods ${activityId}: HTTP ${perRes.status}`);   // unsupported / no breakdown → skip
        } else {
          const perRows = (await perRes.json().catch(() => [])) as Record<string, unknown>[];
          const periodRecs: Record<string, unknown>[] = [];
          for (const row of (Array.isArray(perRows) ? perRows : [])) {
            const ext = String(row.athlete_id ?? (row.athlete as Record<string, unknown>)?.id ?? row.id ?? '');
            const playerId = ext ? playerByExt.get(ext) : undefined;
            if (!playerId) { skippedUnmapped++; continue; }

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
            if (isSpeedOutlier) flaggedPeriods++;

            periodRecs.push({
              club_id: clubId, session_id: sessionId, player_id: playerId,
              period_id: periodId, period_name: periodName,
              duration_seconds: durationSeconds ?? null,
              ...core, extra_metrics,
              is_flagged: isSpeedOutlier,
              flag_reason: isSpeedOutlier ? 'speed_outlier' : null,
            });
          }
          if (periodRecs.length) {
            const { error: pErr } = await adminClient.from('gps_period_reports')
              .upsert(periodRecs, { onConflict: 'club_id,session_id,period_id,player_id' });
            if (pErr) errors.push(`periods ${activityId}: ${pErr.message}`);
            else syncedPeriods += periodRecs.length;
          }
        }
      } catch (pe) {
        errors.push(`periods ${activityId}: ${String((pe as Error)?.message || pe)}`);
      }

      syncedActivities++;
    } catch (e) {
      errors.push(`activity ${activityId}: ${String((e as Error)?.message || e)}`);
    }
  }

  console.log(`[gps-sync] chunk ${from}..${to}: flagged ${flaggedPeriods} periods speed_outlier`);
  return { act: syncedActivities, rows: syncedRows, per: syncedPeriods, skip: skippedUnmapped, flagged: flaggedPeriods, errs: errors, unmapped: [...unmappedParams] };
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
  try { partial = await syncRange(adminClient, ctx, chunk[0], chunk[1]); }
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
      chunks_total: chunks.length, chunks_done: 0, totals: {},
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
