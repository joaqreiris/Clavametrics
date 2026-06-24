/**
 * Supabase Edge Function — gps-sync (Ladrillo 2b-i, SESSION-level sync)
 *
 * Pulls Catapult activities in a date range, finds-or-creates one
 * training_session per activity (idempotent via external_activity_id), fetches
 * per-athlete stats, normalizes them to our canonical units, and writes
 * gps_reports (+ gps_report_metrics for non-core params known to the club).
 *
 * Mirror of gps-verify: CORS, userClient for per-club authz, adminClient
 * (service role) for all reads/writes, CATAPULT_BASE per region.
 *
 * Request  (POST JSON): { integration_id, from?, to? }   (ISO; default last 30d)
 * Response (200 JSON):
 *   { ok:true, synced_activities, synced_rows, skipped_unmapped, errors:[] }
 *
 * NOTE: period/rollup metrics are NOT computed here — that is Ladrillo 2b-ii.
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

// SLUG_MAP — Catapult OpenField parameter slug → { col: canonical gps_reports
// column, conv: multiplier to reach our unit }. Catapult returns SI units.
// ⚠️ Slugs VARY across OpenField versions — VERIFY each against GET /parameters
// and adjust. Anything not here but present in gps_metric_definitions goes to
// gps_report_metrics; anything else is ignored.
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
const DEFAULT_PARAMS = Object.keys(SLUG_MAP);

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

    // Club's non-core metric definitions (EAV passthrough for unmapped params).
    const { data: defs } = await adminClient
      .from('gps_metric_definitions').select('key').eq('club_id', clubId).eq('is_core', false);
    const customKeys = new Set((defs || []).map(d => String(d.key)));

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

    let syncedActivities = 0, syncedRows = 0, skippedUnmapped = 0;
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
            parameters: DEFAULT_PARAMS,           // VERIFY: some versions want [{parameter: slug}]
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

          const rec: Record<string, unknown> = { club_id: clubId, session_id: sessionId, player_id: playerId };
          const extras: { metric_key: string; value: number }[] = [];

          // iterate every slug the stats row offers
          const slugs = new Set<string>([...DEFAULT_PARAMS, ...Object.keys(row)]);
          for (const slug of slugs) {
            const map = SLUG_MAP[slug];
            if (map) {
              const raw = readParam(row, slug);
              if (raw == null) continue;
              const num = raw * map.conv;
              if (!isFinite(num)) continue;
              rec[map.col] = GPS_INT_COLS.has(map.col) ? Math.round(num) : +num.toFixed(4);
            } else if (customKeys.has(slug)) {
              const raw = readParam(row, slug);
              if (raw == null) continue;
              extras.push({ metric_key: slug, value: +raw.toFixed(4) });
            }
            // unknown slug → ignore
          }
          recs.push(rec);
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

        syncedActivities++;
      } catch (e) {
        errors.push(`activity ${activityId}: ${String((e as Error)?.message || e)}`);
      }
    }

    await adminClient.from('gps_integrations')
      .update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('id', integration_id);

    return json({ ok: true, synced_activities: syncedActivities, synced_rows: syncedRows, skipped_unmapped: skippedUnmapped, errors });

  } catch (err) {
    const message = String((err as Error)?.message || err);
    if (adminClient && integrationId) {
      await adminClient.from('gps_integrations').update({ status: 'error', last_error: message }).eq('id', integrationId);
    }
    return json({ ok: false, error: message }, 502);
  }
});
