/**
 * lib/gp-card/resolver.js
 *
 * Turns a validated gp.card/v1 CONFIG into a normalized Dataset by
 * querying the Supabase tables directly (no separate backend).
 *
 * Tables used (read-only):
 *   training_sessions  — range filtering (microcycle_id, session_date)
 *   gps_reports        — core metric columns
 *   gps_report_metrics — EAV custom metrics
 *   players            — display_name for dimension labels
 *
 * Pipeline:
 *   config → getSessionIds() → fetchReports() → fetchEavMetrics()
 *          → aggregateSeries() → Dataset
 *
 * @module lib/gp-card/resolver
 */

// ── Core columns that live in gps_reports ─────────────────────────────────
export const CORE_COLS = new Set([
  'total_distance', 'high_speed_distance', 'very_high_speed_distance',
  'sprint_distance', 'sprint_count', 'max_speed', 'avg_speed',
  'accelerations', 'decelerations', 'player_load', 'hmld',
  'time_played', 'distance_per_minute',
]);

/**
 * @typedef {import('./types.js').CardConfig} CardConfig
 * @typedef {import('./types.js').CatalogMetric} CatalogMetric
 *
 * @typedef {{ clubId:string, playerId?:string, mcId?:string, asOf?:string }} ResolveCtx
 *
 * @typedef {{ label:string, unit?:string, points:{x:string|number,y:number}[] }} Series
 *
 * @typedef {{ state:'ok', series:Series[], meta:object }
 *           |{ state:'no_data', reason:string }
 *           |{ state:'error',   reason:string }} Dataset
 */

// ── Aggregation helpers ────────────────────────────────────────────────────

/**
 * True only for a real UUID string. Guards every uuid-typed query input so a
 * null / "null" / undefined / empty id is NEVER sent to Postgres (which would
 * 400 with "invalid input syntax for type uuid: null").
 * @param {unknown} v
 * @returns {boolean}
 */
export function isUuid(v) {
  return typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * True for a usable text id (e.g. microcycles.id / training_sessions.microcycle_id,
 * which are TEXT — not uuid). Rejects null / "null" / "" so they never reach a query,
 * but accepts any other non-empty id (uuid-shaped or not).
 * @param {unknown} v
 * @returns {boolean}
 */
export function isNonNullId(v) {
  return typeof v === 'string' && v !== '' && v !== 'null' && v !== 'undefined';
}

/**
 * Applies an aggregation to an array of numeric values.
 * @param {number[]} vals
 * @param {string}   agg
 * @returns {number|null}
 */
export function applyAgg(vals, agg) {
  const clean = vals.filter(v => v != null && !isNaN(v));
  if (!clean.length) return null;
  switch (agg) {
    case 'total':  return clean.reduce((a, b) => a + b, 0);
    case 'avg':    return clean.reduce((a, b) => a + b, 0) / clean.length;
    case 'max':    return Math.max(...clean);
    case 'min':    return Math.min(...clean);
    case 'median': {
      const s = [...clean].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    default: return null;
  }
}

// ── Step 1: get session IDs for the requested range ───────────────────────

/**
 * Returns training_session ids matching config.range for the club.
 * Excludes sessions with session_type = 'rehab'.
 *
 * @param {CardConfig['range']} range
 * @param {ResolveCtx}           ctx
 * @param {object}               sb   Supabase client
 * @returns {Promise<string[]>}
 */
export async function getSessionIds(range, ctx, sb) {
  // Tenant id must be a real uuid — never send null/"null" to a uuid column.
  if (!isUuid(ctx.clubId)) return [];

  let q = sb
    .from('training_sessions')
    .select('id')
    .eq('club_id', ctx.clubId)
    .neq('session_type', 'rehab');

  switch (range.type) {
    case 'mc': {
      if (isNonNullId(ctx.mcId)) {            // microcycle_id is TEXT, not uuid
        q = q.eq('microcycle_id', ctx.mcId);
      } else {
        // No mcId in context — derive the most recent microcycle as the ISO week
        // surrounding the club's last session date.
        const { data: last } = await sb
          .from('training_sessions')
          .select('session_date')
          .eq('club_id', ctx.clubId)
          .neq('session_type', 'rehab')
          .order('session_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!last) return [];
        const d   = new Date(last.session_date);
        const dow = d.getDay() || 7;             // 1 Mon … 7 Sun
        const mon = new Date(d); mon.setDate(d.getDate() - dow + 1);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const fmt = (dt) => dt.toISOString().slice(0, 10);
        q = q.gte('session_date', fmt(mon)).lte('session_date', fmt(sun));
      }
      break;
    }
    case 'w7': {
      const from = _daysBack(ctx.asOf, 7);
      q = q.gte('session_date', from);
      break;
    }
    case 'w30': {
      const from = _daysBack(ctx.asOf, 30);
      q = q.gte('session_date', from);
      break;
    }
    case 'season': {
      // Fallback: use a 6-month window if no explicit season start
      const from = range.from || _daysBack(ctx.asOf, 183);
      q = q.gte('session_date', from);
      if (range.to) q = q.lte('session_date', range.to);
      break;
    }
    case 'custom': {
      if (range.from) q = q.gte('session_date', range.from);
      if (range.to)   q = q.lte('session_date', range.to);
      break;
    }
  }

  const { data, error } = await q.order('session_date', { ascending: true });
  if (error) throw new Error(`getSessionIds: ${error.message}`);
  return (data || []).map(r => r.id);
}

/**
 * Session IDs that belong to a specific microcycle — used as the REFERENCE side
 * of a `comparison.baseline === 'mc'` card (diff vs another microcycle).
 * Ignores the card's own range: the reference set is the whole chosen MC.
 *
 * @param {string}     refMcId  microcycles.id to use as the comparison baseline
 * @param {ResolveCtx} ctx
 * @param {object}     sb
 * @returns {Promise<string[]>}
 */
export async function getMcSessionIds(refMcId, ctx, sb) {
  // refMcId is a TEXT microcycle id (not uuid); club_id IS a uuid. Reject null/"null"
  // so nothing bogus reaches the query — caller degrades to no comparison.
  if (!isNonNullId(refMcId) || !isUuid(ctx.clubId)) return [];
  const { data, error } = await sb
    .from('training_sessions')
    .select('id')
    .eq('club_id', ctx.clubId)
    .neq('session_type', 'rehab')
    .eq('microcycle_id', refMcId)
    .order('session_date', { ascending: true });
  if (error) throw new Error(`getMcSessionIds: ${error.message}`);
  return (data || []).map(r => r.id);
}

// ── Step 2: fetch raw gps_reports rows ────────────────────────────────────

/**
 * Fetches gps_reports for the given sessions, optionally filtered by player.
 * Returns raw rows plus player display_name joined via players table.
 *
 * @param {string[]} sessionIds
 * @param {object}   config
 * @param {ResolveCtx} ctx
 * @param {Map<string,CatalogMetric>} catalog
 * @param {object}   sb
 * @returns {Promise<object[]>}   raw report rows
 */
export async function fetchReports(sessionIds, config, ctx, catalog, sb) {
  if (!sessionIds.length) return [];

  // Which core columns do we need?
  const coreNeeded = config.metrics
    .filter(m => CORE_COLS.has(m.id))
    .map(m => m.id);

  const select = [
    'id', 'player_id', 'session_id',
    // always fetch session date via join
    'training_sessions!inner(session_date, session_attributes, microcycle_id)',
    // always fetch player name
    'players!inner(id, first_name, last_name, position)',
    ...coreNeeded,
  ].join(',');

  let q = sb
    .from('gps_reports')
    .select(select)
    .eq('club_id', ctx.clubId)
    .in('session_id', sessionIds);

  if (config.scope.level === 'player') {
    const pid = config.scope.playerId || ctx.playerId;
    if (!isUuid(pid)) return [];          // null/"null"/invalid → no rows, never a uuid 400
    q = q.eq('player_id', pid);
  }

  const { data, error } = await q;
  if (error) throw new Error(`fetchReports: ${error.message}`);
  return data || [];
}

// ── Step 3: fetch EAV custom metrics ─────────────────────────────────────

/**
 * Fetches gps_report_metrics for the given report IDs and custom metric keys.
 * Returns a Map of `reportId → { metricKey → value }`.
 *
 * @param {string[]} reportIds
 * @param {string[]} metricKeys
 * @param {string}   clubId
 * @param {object}   sb
 * @returns {Promise<Map<string, Record<string, number>>>}
 */
export async function fetchEavMetrics(reportIds, metricKeys, clubId, sb) {
  if (!reportIds.length || !metricKeys.length) return new Map();

  const { data, error } = await sb
    .from('gps_report_metrics')
    .select('report_id, metric_key, value')
    .eq('club_id', clubId)
    .in('report_id', reportIds)
    .in('metric_key', metricKeys);

  if (error) throw new Error(`fetchEavMetrics: ${error.message}`);

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.report_id)) map.set(row.report_id, {});
    map.get(row.report_id)[row.metric_key] = Number(row.value);
  }
  return map;
}

// ── Step 4: aggregate into series ─────────────────────────────────────────

/**
 * Aggregates raw gps_reports rows into the Series format consumed by charts.
 *
 * Grouping strategy:
 *  - bars/ranking/table/heatmap/scatter → group by player
 *  - line                               → group by session_date
 *  - kpi/radar                          → single aggregate (no group)
 *
 * @param {object[]}                     rows    gps_reports rows
 * @param {Map<string,Record<string,number>>} eavMap  output of fetchEavMetrics
 * @param {CardConfig}                   config
 * @param {Map<string,CatalogMetric>}    catalog
 * @returns {Series[]}
 */
export function aggregateSeries(rows, eavMap, config, catalog) {
  // Grouping dimension comes from config.dimensions[0] when present; otherwise
  // we keep the legacy per-viz default (player for player-grouped vizzes, time
  // for line). See `keyOf` below.

  // helper: get metric value from a single row
  function rowVal(row, metricId) {
    if (CORE_COLS.has(metricId)) return Number(row[metricId] ?? null);
    // EAV
    const eav = eavMap.get(row.id);
    return eav ? Number(eav[metricId] ?? null) : null;
  }

  // helper: player label
  function playerLabel(row) {
    const p = row.players;
    if (!p) return row.player_id;
    const last  = p.last_name  || '';
    const first = p.first_name || '';
    return `${last}${first ? ', ' + first[0] + '.' : ''}`.trim() || row.player_id;
  }

  // helper: time label
  function timeLabel(row) {
    const attrs = row.training_sessions?.session_attributes || {};
    if (attrs.md_code) return attrs.md_code;
    if (attrs.microcycle) return attrs.microcycle;
    return row.training_sessions?.session_date?.slice(0, 10) || '?';
  }

  // helper: dimension → { key (stable group id), label (display) } for a row.
  // player_name groups by player_id (stable) but displays the name, so distinct
  // players that share a display name don't collapse together.
  function dimGroup(row, dimId) {
    if (!dimId || dimId === 'player_name') return { key: row.player_id, label: playerLabel(row) };
    const attrs = row.training_sessions?.session_attributes || {};
    let v;
    switch (dimId) {
      case 'position':     v = row.players?.position; break;
      case 'session_date': v = row.training_sessions?.session_date?.slice(0, 10); break;
      case 'md_code':      v = attrs.md_code; break;
      case 'microcycle':   v = attrs.microcycle || row.training_sessions?.microcycle_id; break;
      case 'rival':        v = attrs.rival || attrs.opponent; break;
      default:             return { key: row.player_id, label: playerLabel(row) };
    }
    const lbl = (v == null || v === '') ? '—' : String(v);
    return { key: lbl, label: lbl };
  }

  // Composite group key over ALL chosen dimensions (in order). Each point carries
  // `dims` = the display value of every dimension, so a table can render one
  // column per dimension (Name, Position, …). Legacy: no dimensions → player / time.
  const dimIds  = (config.dimensions || []).map(d => d.id).filter(Boolean);
  const GROUPED = ['bars', 'ranking', 'table', 'heatmap', 'scatter', 'line'].includes(config.viz);
  // Scatter is special: it always plots one point per PLAYER (the entity), and its
  // dimension is a COLOR category — NOT a grouping axis. So scatter always groups
  // by player_id and carries `cat` = the first dimension's value (for legend/colour).
  const groupOf = config.viz === 'scatter'
    ? (row => { const l = playerLabel(row);
                const cat = dimIds.length ? dimGroup(row, dimIds[0]).label : null;
                return { key: row.player_id, label: l, dims: [l], cat }; })
    : dimIds.length
    ? (row => {
        const parts = dimIds.map(id => dimGroup(row, id));   // [{key,label}, …]
        return { key:   parts.map(p => p.key).join(' ¦ '),   // composite stable key
                 label: parts.map(p => p.label).join(' · '), // composite x display
                 dims:  parts.map(p => p.label) };           // per-dimension columns
      })
    : (config.viz === 'line'
        ? (row => { const t = timeLabel(row); return { key: t, label: t, dims: [t] }; })
        : (row => { const l = playerLabel(row); return { key: row.player_id, label: l, dims: [l] }; }));

  return config.metrics.map(m => {
    const cat = catalog.get(m.id);

    if (GROUPED) {
      // group rows by the composite key → aggregate each metric within the group
      const byKey = new Map();
      for (const row of rows) {
        const g = groupOf(row);
        if (!byKey.has(g.key)) byKey.set(g.key, { label: g.label, dims: g.dims, cat: g.cat, vals: [] });
        const v = rowVal(row, m.id);
        if (v != null && !isNaN(v)) byKey.get(g.key).vals.push(v);
      }
      const points = Array.from(byKey.values())
        .map(({ label, dims, cat, vals }) => ({ x: label, dims, cat, y: applyAgg(vals, m.agg) ?? 0 }));

      if (config.viz === 'ranking') points.sort((a, b) => b.y - a.y);

      return { label: m.id, name: cat?.name || m.id, unit: cat?.unit || '', points };
    }

    // kpi / radar: single aggregate across all rows
    const vals = rows.map(row => rowVal(row, m.id)).filter(v => v != null && !isNaN(v));
    const y    = applyAgg(vals, m.agg) ?? 0;
    return { label: m.id, name: cat?.name || m.id, unit: cat?.unit || '', points: [{ x: 'all', y }] };
  });
}

/**
 * Per-metric ROLE baseline for player-scope radar/kpi comparisons.
 *
 * The role baseline = average, across the scoped player's position group, of
 * each team-mate's own aggregate over the same sessions. Used by the radar to
 * normalize each axis as a % of its own baseline (so metrics of very different
 * magnitudes don't collapse against one shared scale).
 *
 * Reuses fetchReports (squad scope ⇒ no player filter) + fetchEavMetrics +
 * applyAgg — same query patterns as the main pipeline.
 *
 * @returns {Promise<Map<string, number|null>>}  metricId → baseline (null if no group data)
 */
export async function fetchRoleBaseline(sessionIds, config, ctx, catalog, sb) {
  if (!sessionIds.length) return new Map();
  const pid = config.scope.playerId || ctx.playerId;

  // squad-wide fetch (no player filter) over the same sessions + same metrics
  const squadCfg = { ...config, scope: { level: 'squad' } };
  const rows = await fetchReports(sessionIds, squadCfg, ctx, catalog, sb);
  if (!rows.length) return new Map();

  // scoped player's position → role group (fall back to whole squad if unknown)
  const myPos = rows.find(r => r.player_id === pid)?.players?.position ?? null;
  const group = rows.filter(r => myPos == null || r.players?.position === myPos);
  if (!group.length) return new Map();

  // EAV for custom metrics
  const customKeys = config.metrics.filter(m => !CORE_COLS.has(m.id)).map(m => m.id);
  const eavMap = customKeys.length
    ? await fetchEavMetrics(group.map(r => r.id), customKeys, ctx.clubId, sb)
    : new Map();
  const cellVal = (row, id) => CORE_COLS.has(id)
    ? Number(row[id] ?? null)
    : Number(eavMap.get(row.id)?.[id] ?? null);

  const out = new Map();
  for (const m of config.metrics) {
    // per-player aggregate, then mean across the group
    const byPlayer = new Map();
    for (const row of group) {
      const v = cellVal(row, m.id);
      if (v != null && !isNaN(v)) {
        if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, []);
        byPlayer.get(row.player_id).push(v);
      }
    }
    const perPlayer = Array.from(byPlayer.values())
      .map(vals => applyAgg(vals, m.agg))
      .filter(v => v != null && !isNaN(v));
    out.set(m.id, perPlayer.length ? perPlayer.reduce((a, b) => a + b, 0) / perPlayer.length : null);
  }
  return out;
}

// ── "vs microciclo" comparison ────────────────────────────────────────────

/**
 * Aligns a CURRENT series set with a REFERENCE series set (same metrics, same
 * category keys) and attaches { cur, ref, diff } to every current-series point,
 * where diff = percentage change of current vs reference. Match key is
 * (series.label = metric id, point.x = category/player).
 *
 * @param {Series[]} series     current-MC series
 * @param {Series[]} refSeries  reference-MC series
 * @returns {Series[]} the current series with enriched points
 */
export function enrichMcDiff(series, refSeries) {
  const refIdx = new Map();                       // metricId → Map(x → refValue)
  for (const rs of (refSeries || [])) {
    const m = new Map();
    for (const p of rs.points) m.set(p.x, p.y);
    refIdx.set(rs.label, m);
  }
  return (series || []).map(s => {
    const rm = refIdx.get(s.label);
    return { ...s, points: s.points.map(p => {
      const rv = rm ? rm.get(p.x) : null;
      const diff = (rv != null && rv !== 0 && !isNaN(rv)) ? (p.y - rv) / rv * 100 : null;
      return { ...p, cur: p.y, ref: (rv == null ? null : rv), diff };
    }) };
  });
}

/**
 * Resolves the REFERENCE microcycle's series through the same pipeline as the
 * current side (sessions → reports → EAV → aggregate). Returns [] if the refMcId
 * is invalid or has no data (caller degrades to no comparison).
 *
 * @returns {Promise<Series[]>}
 */
export async function resolveMcReference(refMcId, config, ctx, catalog, sb) {
  if (!isUuid(refMcId)) return [];
  const refSessions = await getMcSessionIds(refMcId, ctx, sb);
  if (!refSessions.length) return [];
  const refRows = await fetchReports(refSessions, config, ctx, catalog, sb);
  if (!refRows.length) return [];
  const customKeys = config.metrics.filter(m => !CORE_COLS.has(m.id)).map(m => m.id);
  const refEav = customKeys.length
    ? await fetchEavMetrics(refRows.map(r => r.id), customKeys, ctx.clubId, sb)
    : new Map();
  return aggregateSeries(refRows, refEav, config, catalog);
}

// ── Top-level orchestrator ────────────────────────────────────────────────

/**
 * Full pipeline: config + context → Dataset.
 * Authoritative for all card data requests.
 *
 * @param {CardConfig}               config
 * @param {ResolveCtx}               ctx
 * @param {Map<string,CatalogMetric>} catalog
 * @param {object}                   sb   Supabase client
 * @returns {Promise<Dataset>}
 */
export async function resolveCard(config, ctx, catalog, sb) {
  try {
    // no-data guard: custom EAV without squad rollup
    if (config.scope.level === 'squad') {
      const bad = config.metrics.find(m => {
        const cat = catalog.get(m.id);
        return cat && cat.is_custom && !cat.squad_rollup;
      });
      if (bad) {
        const cat = catalog.get(bad.id);
        return { state: 'no_data', reason: `"${cat.name}" has no squad-level rollup.` };
      }
    }

    const sessionIds = await getSessionIds(config.range, ctx, sb);
    if (!sessionIds.length) {
      return { state: 'no_data', reason: 'No sessions found for this range.' };
    }

    const rows = await fetchReports(sessionIds, config, ctx, catalog, sb);
    if (!rows.length) {
      return { state: 'no_data', reason: 'No GPS data for this player / range combination.' };
    }

    // EAV fetch (only if custom metrics requested)
    const customKeys = config.metrics
      .filter(m => !CORE_COLS.has(m.id))
      .map(m => m.id);

    const eavMap = customKeys.length
      ? await fetchEavMetrics(rows.map(r => r.id), customKeys, ctx.clubId, sb)
      : new Map();

    const series = aggregateSeries(rows, eavMap, config, catalog);

    // "vs microciclo": bring the REFERENCE microcycle through the same pipeline and
    // attach { cur, ref, diff } to every current point so the bar engine can draw two
    // grouped bars (current + reference) with the diff% over each pair. Any other
    // comparison (role/match/none) or an invalid/empty refMcId → a single series,
    // unchanged.
    let outSeries = series, refSeries = null, mcDiffs = null;
    if (config.comparison?.baseline === 'mc' && isNonNullId(config.comparison?.refMcId)) {
      try {
        const ref = await resolveMcReference(config.comparison.refMcId, config, ctx, catalog, sb);
        if (ref.some(s => s.points && s.points.length)) {
          refSeries  = ref;
          outSeries  = enrichMcDiff(series, ref);
          // diff% per category from the first metric (cross-check vs Exposure context)
          mcDiffs = (outSeries[0]?.points || []).map(p => ({ x: p.x, diff: p.diff }));
        }
      } catch (e) { /* degrade to a single series (no comparison) */ }
    }

    return {
      state: 'ok',
      series: outSeries,
      refSeries,                                   // null unless an MC comparison with data
      meta: {
        range:    config.range.type,
        scope:    config.scope.level,
        baseline: config.comparison?.baseline ?? null,
        refMcId:  config.comparison?.refMcId ?? null,
        mcDiffs,                                    // [{ x, diff }] per category, or null
      },
    };
  } catch (e) {
    return { state: 'error', reason: e?.message || 'resolver failed' };
  }
}

// ── Private helpers ───────────────────────────────────────────────────────

function _daysBack(asOf, days) {
  const d = asOf ? new Date(asOf) : new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
