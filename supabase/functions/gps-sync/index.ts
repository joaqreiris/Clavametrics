/**
 * Supabase Edge Function — gps-sync (Ladrillo 2b-i + 2b-map, SESSION-level sync)
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
 * Mirror of gps-verify: CORS, userClient for per-club authz, adminClient
 * (service role) for all reads/writes, CATAPULT_BASE per region.
 *
 * Request  (POST JSON): { integration_id, from?, to? }   (ISO; default last 30d)
 * Response (200 JSON):
 *   { ok:true, synced_activities, synced_rows, synced_periods, skipped_unmapped,
 *     unmapped_params:[], errors:[] }
 *
 * Session grain → gps_reports. Period grain (per drill/task) → gps_period_reports
 * (totals + duration_seconds; per-minute & period↔drill link are Ladrillo 2c).
 *
 * Deploy: supabase functions deploy gps-sync
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

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

// ── Canonical column units (must match the CSV-imported data convention) ────
//   total_distance → km · other distances → m · player_load → AU
//   max_speed/avg_speed → km/h · time_played → min · distance_per_minute → m/min
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
  'date', 'start_time', 'startTime', 'start', 'player_id', 'parameters',
]);

// SLUG_MAP — AUTO-SEED ONLY. Catapult OpenField parameter slug → { col: canonical
// gps_reports column, conv: unit multiplier (Catapult returns SI) }. On first
// sync these 13 rows are seeded into gps_column_mappings so the core columns work
// with zero setup; afterwards the club owns the mapping via "Map metrics".
// ⚠️ Slugs VARY across OpenField versions — VERIFY against GET /parameters.
const SLUG_MAP: Record<string, { col: string; conv: number }> = {
  // distances
  total_distance:                     { col: 'total_distance',           conv: 1 / 1000 }, // m → km
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  let adminClient: ReturnType<typeof createClient> | null = null;
  let integrationId: string | null = null;

  try {
    // ── Auth: resolve caller's club from JWT ────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { integration_id, from, to } = await req.json().catch(() => ({}));
    if (!integration_id) return json({ error: 'integration_id is required' }, 400);
    integrationId = integration_id;

    const { data: callerClub } = await userClient.rpc('get_user_club_id');
    if (!callerClub) return json({ error: 'No club found for caller' }, 403);

    adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: integration, error: intErr } = await adminClient
      .from('gps_integrations')
      .select('id, club_id, provider, config')
      .eq('id', integration_id)
      .single();
    if (intErr || !integration) return json({ error: 'Integration not found' }, 404);
    if (integration.club_id !== callerClub) return json({ error: 'Forbidden' }, 403);
    if (integration.provider !== 'catapult') return json({ ok: false, message: 'Not supported for this provider yet' });

    const clubId = integration.club_id as string;
    const cfg = (integration.config || {}) as Record<string, unknown>;
    const region = cfg.region as string | undefined;
    if (!region || !CATAPULT_BASE[region]) return json({ error: 'region not set' }, 400);
    const teamId = (cfg.team_id as string | undefined) || null;
    const baseUrl = CATAPULT_BASE[region];

    const { data: secretRow } = await adminClient
      .from('gps_integration_secrets').select('credential').eq('integration_id', integration_id).single();
    const credential = secretRow?.credential;
    if (!credential) return json({ error: 'no credential' }, 400);
    const authH = { Authorization: `Bearer ${credential}` };

    // Date range (default: last 30 days)
    const toMsRange   = to   ? toMs(to)   : Date.now();
    const fromMsRange = from ? toMs(from) : (toMsRange - 30 * 86400 * 1000);

    // Club roster: external_gps_id → player_id (adminClient bypasses RLS, so
    // scope by club_id manually).
    const { data: players } = await adminClient
      .from('players').select('id, external_gps_id').eq('club_id', clubId).not('external_gps_id', 'is', null);
    const playerByExt = new Map<string, string>();
    for (const p of (players || [])) if (p.external_gps_id) playerByExt.set(String(p.external_gps_id), p.id as string);

    // ── Data-driven resolveMap: slug → { target_metric, unit_conversion } ───
    // Read the club's Catapult mappings (same table/vocabulary as the CSV).
    const { data: mappings } = await adminClient
      .from('gps_column_mappings')
      .select('source_column_name, target_metric, unit_conversion')
      .eq('club_id', clubId).eq('source_label', 'catapult');
    const resolveMap = new Map<string, { target: string; conv: number }>();
    for (const m of (mappings || [])) {
      resolveMap.set(String(m.source_column_name), {
        target: String(m.target_metric),
        conv: m.unit_conversion == null ? 1 : Number(m.unit_conversion),
      });
    }

    // AUTO-SEED the 13 core columns the first time (idempotent). Any SLUG_MAP
    // slug not yet mapped for this club is inserted; existing rows are untouched.
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
    const unmappedParams = new Set<string>();

    // Shared normalizer — turns a /stats row into { core, extras } via the same
    // resolveMap + unit_conversion, for BOTH session and period grains.
    const normalizeMetrics = (row: Record<string, unknown>) => {
      const core: Record<string, number> = {};
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
          core[map.target] = GPS_INT_COLS.has(map.target) ? Math.round(num) : +num.toFixed(4);
        } else {
          extras.push({ metric_key: map.target, value: +num.toFixed(4) });
        }
      }
      return { core, extras };
    };

    // ── 1. Fetch activities and filter to the range by start_time ───────────
    const actRes = await fetch(`${baseUrl}/activities`, { headers: authH });
    if (!actRes.ok) {
      await adminClient.from('gps_integrations').update({ status: 'error', last_error: `activities HTTP ${actRes.status}` }).eq('id', integration_id);
      return json({ ok: false, http_status: actRes.status });
    }
    const allActivities = (await actRes.json().catch(() => [])) as Record<string, unknown>[];
    const activities = (Array.isArray(allActivities) ? allActivities : []).filter(a => {
      const ms = toMs(a.start_time ?? a.startTime ?? a.start);
      return !isNaN(ms) && ms >= fromMsRange && ms <= toMsRange;
    });

    let syncedActivities = 0, syncedRows = 0, syncedPeriods = 0, skippedUnmapped = 0;
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
          // TODO (2b-ii / type detection): detect 'match' from activity tags.
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
            parameters: mappedSlugs,              // VERIFY: some versions want [{parameter: slug}]
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

          const { core, extras } = normalizeMetrics(row);
          recs.push({ club_id: clubId, session_id: sessionId, player_id: playerId, ...core });
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
              parameters: mappedSlugs,
              group_by: ['period', 'athlete'],   // VERIFY group_by vocabulary per OpenField version
            }),
          });
          if (!perRes.ok) {
            errors.push(`periods ${activityId}: HTTP ${perRes.status}`);   // unsupported / no breakdown → skip, don't break
          } else {
            const perRows = (await perRes.json().catch(() => [])) as Record<string, unknown>[];
            const periodRecs: Record<string, unknown>[] = [];
            for (const row of (Array.isArray(perRows) ? perRows : [])) {
              const ext = String(row.athlete_id ?? (row.athlete as Record<string, unknown>)?.id ?? row.id ?? '');
              const playerId = ext ? playerByExt.get(ext) : undefined;
              if (!playerId) { skippedUnmapped++; continue; }

              // Period identity (field names vary across versions → defensive)
              const period = (row.period ?? {}) as Record<string, unknown>;
              const periodId   = String(row.period_id ?? period.id ?? period.name ?? row.period_name ?? row.period ?? '');
              if (!periodId) continue;   // can't form the unique key without it
              const periodName = String(row.period_name ?? period.name ?? row.period ?? periodId);

              // Raw duration in SECONDS (denominator for per-minute, computed in 2c).
              // Read 'duration' raw (independent of its mapping to time_played);
              // fall back to start/end delta.
              let durationSeconds = readParam(row, 'duration') ?? readParam(row, 'total_duration') ?? readParam(row, 'period_duration');
              if (durationSeconds == null) {
                const s = toMs(row.start_time ?? period.start_time ?? row.start);
                const e = toMs(row.end_time   ?? period.end_time   ?? row.end);
                if (!isNaN(s) && !isNaN(e) && e >= s) durationSeconds = (e - s) / 1000;
              }

              const { core, extras } = normalizeMetrics(row);
              const extra_metrics: Record<string, number> = {};
              for (const ex of extras) extra_metrics[ex.metric_key] = ex.value;

              periodRecs.push({
                club_id: clubId, session_id: sessionId, player_id: playerId,
                period_id: periodId, period_name: periodName,
                duration_seconds: durationSeconds ?? null,
                ...core, extra_metrics,
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

    await adminClient.from('gps_integrations')
      .update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('id', integration_id);

    return json({ ok: true, synced_activities: syncedActivities, synced_rows: syncedRows, synced_periods: syncedPeriods, skipped_unmapped: skippedUnmapped, unmapped_params: [...unmappedParams], errors });

  } catch (err) {
    const message = String((err as Error)?.message || err);
    if (adminClient && integrationId) {
      await adminClient.from('gps_integrations').update({ status: 'error', last_error: message }).eq('id', integrationId);
    }
    return json({ ok: false, error: message }, 502);
  }
});
