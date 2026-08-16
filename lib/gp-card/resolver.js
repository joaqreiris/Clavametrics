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

import { evalFormulaRow, formulaBaseMetrics, isCalculated, formulaOf } from './calc-formula.js';

// ── Core columns that live in gps_reports ─────────────────────────────────
// ── Caché compartido entre cards (evita N+1: misma sesión/report pedido N veces) ──
// El cache se limpia por completo en cada refreshDashboard() (y vía cmInvalidateGpsCache()).
// El TTL suave es defensa extra para sesiones largas: si una entrada supera _CACHE_TTL_MS se
// trata como miss y se re-fetchea, así datos que cambiaron en el server no quedan stale
// indefinidamente sin recargar. NO rompe el fetch compartido: dentro del TTL, N cards con la
// misma key siguen compartiendo una sola promesa/fetch.
const _CACHE_TTL_MS = 5 * 60 * 1000;   // 5 min
function _cacheGet(key) {
  const c = (typeof window !== 'undefined' && window.__gpResolverCache) || null;
  if (!c || !c.has(key)) return undefined;
  const e = c.get(key);
  if (e && typeof e === 'object' && 't' in e) {
    const _now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    if (_now && _now - e.t > _CACHE_TTL_MS) { c.delete(key); return undefined; }
    return e.p;
  }
  return e;   // forma legacy (por compatibilidad si algo setea el promise directo)
}
function _cacheSet(key, promise) {
  if (typeof window !== 'undefined') {
    if (!window.__gpResolverCache) window.__gpResolverCache = new Map();
    const _now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    window.__gpResolverCache.set(key, { p: promise, t: _now });
  }
  return promise;
}

export const CORE_COLS = new Set([
  'total_distance', 'high_speed_distance', 'very_high_speed_distance',
  'sprint_distance', 'sprint_count', 'max_speed', 'avg_speed',
  'accelerations', 'decelerations', 'player_load', 'hmld',
  'time_played', 'distance_per_minute',
]);

// ── Built-in DERIVED metrics ─────────────────────────────────────────────────
// id → base columns to SUM per row, computed BEFORE aggregation (works in session AND
// task: in task the bases come from v_gps_task_analysis). Self-contained here so the card
// resolves regardless of whether the catalog/config carries a formula.
export const DERIVED = {
  acc_dec: ['accelerations', 'decelerations'],   // Accel + Decel
};

// Synthetic metrics computed entirely in rowVal (no DB column / no EAV row). They must be
// EXCLUDED from the select + EAV fetch, else a query for a non-existent metric_key can fail
// the whole card. n_instances = Σ(1); work_time/work_min = duration_seconds/60.
export const SYNTHETIC = new Set(['n_instances', 'work_time', 'work_min']);

// ── RPE source metrics (tabla `rpe`, join por player_id + session_id) ──
// No viven en gps_reports ni en gps_report_metrics. fetchRpeMetrics las trae y
// las mergea en el mismo eavMap que lee el agregador → aggregateSeries no cambia.
// `srpe` = columna `load` de la tabla rpe (load = rpe × duration).
export const RPE_COLS = new Set(['rpe', 'srpe']);
const RPE_COL_MAP = { rpe: 'rpe', srpe: 'load' };

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
export function applyAgg(vals, agg, weights) {
  // Time-weighted average: Σ(value×weight) / Σ(weight). weights[i] aligns with vals[i].
  if (agg === 'wavg') {
    let sw = 0, swv = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i], w = weights ? weights[i] : 1;
      if (v == null || isNaN(v) || !(w > 0)) continue;
      sw += w; swv += v * w;
    }
    return sw > 0 ? swv / sw : null;
  }
  const clean = vals.filter(v => v != null && !isNaN(v));
  // 'count' = how many values contributed. The main pipeline computes DISTINCT sessions upstream
  // (resolveSeries); this is the safe fallback for callers that route a count metric through applyAgg
  // directly (e.g. baselines), and returns 0 (not null) so an empty group reads as a real zero.
  if (agg === 'count') return clean.length;
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

/**
 * The base metric keys a config needs, split into core columns vs EAV keys.
 * Calculated metrics are NOT fetched directly (they have no column / EAV row);
 * instead we fetch the BASE metrics referenced by their formula so the formula
 * can be evaluated per session. A base metric used only inside a formula (not
 * "on screen") is still included here.
 *
 * @param {object} config
 * @param {Map<string,object>} catalog
 * @returns {{ core:string[], eav:string[] }}
 */
export function neededKeys(config, catalog) {
  const ids = new Set();
  for (const m of config.metrics || []) {
    if (SYNTHETIC.has(m.id)) continue;                   // computed in rowVal → no column / EAV fetch
    if (isCalculated(m, catalog)) {
      for (const base of formulaBaseMetrics(formulaOf(m, catalog) || '')) ids.add(base);
    } else if (DERIVED[m.id]) {
      for (const base of DERIVED[m.id]) ids.add(base);   // fetch the base columns, not the derived id
    } else {
      ids.add(m.id);
    }
  }
  return {
    core: [...ids].filter(id => CORE_COLS.has(id)),
    rpe:  [...ids].filter(id => RPE_COLS.has(id)),
    eav:  [...ids].filter(id => !CORE_COLS.has(id) && !RPE_COLS.has(id)),
  };
}

// ── Step 1: get session IDs for the requested range ───────────────────────

/**
 * The season ENTITY (seasons.id) that owns a date window, so season_id-linked sessions
 * whose date sits outside the window can still be pulled into the season view.
 * Overlap = season.start_date <= windowTo AND season.end_date >= windowFrom.
 * Preference among candidates: this team's season → a club-level (null-team) season →
 * latest by start_date. Fully defensive: any failure returns null (pure date filtering).
 *
 * @returns {Promise<string|null>}
 */
async function _seasonIdForWindow(from, to, ctx, sb) {
  try {
    if (!isUuid(ctx.clubId)) return null;
    const { data } = await sb.from('seasons')
      .select('id, team_id, start_date, end_date')
      .eq('club_id', ctx.clubId);
    if (!data || !data.length) return null;
    const winTo = to || '9999-12-31';
    const overlapping = data.filter(s =>
      String(s.start_date) <= winTo && String(s.end_date) >= from);
    const pool = overlapping.length ? overlapping : data;
    const byStartDesc = [...pool].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    const pick = (isUuid(ctx.teamId) && byStartDesc.find(s => String(s.team_id) === String(ctx.teamId)))
      || byStartDesc.find(s => s.team_id == null)
      || byStartDesc[0];
    return pick?.id || null;
  } catch { return null; }
}

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
  const _ck = `sids:${ctx.clubId}:${ctx.teamId||''}:${ctx.mcId||''}:${JSON.stringify(range)}`;
  const _hit = _cacheGet(_ck);
  if (_hit !== undefined) return _hit;
  return _cacheSet(_ck, (async () => {

  let q = sb
    .from('training_sessions')
    .select('id')
    .eq('club_id', ctx.clubId)
    .neq('session_type', 'rehab');

  // Team scope: this team's sessions PLUS legacy null-team sessions (imported / old
  // data has team_id = null). This keeps the season's HISTORICAL players visible
  // (they played the team's sessions) while OTHER teams' sessions stay out — no
  // category mixing. No teamId in context → club-wide (legacy fallback behaviour).
  if (isUuid(ctx.teamId)) q = q.or(`team_id.eq.${ctx.teamId},team_id.is.null`);

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
      // Resolve the season window [from, to]. Explicit range wins; else derive it from the
      // club/team's LATEST session, NOT from "today" (today breaks on migrated/historical
      // data, where the last session can be months old and a 183-day window from today
      // returns nothing). Season ≈ July 1 of that season.
      let from = range.from || null;
      let to   = range.from ? (range.to || null) : null;
      let pickedSeasonId = range.seasonId || null;
      // Global season filter picked on the dashboard (a specific seasons row): use its window
      // AND its id, so a `{type:'season'}` card follows the chosen season instead of deriving one.
      if (!from && ctx && ctx.seasonFrom) {
        from = ctx.seasonFrom; to = ctx.seasonTo || null; pickedSeasonId = ctx.seasonId || pickedSeasonId;
      }
      if (!from) {
        const { data: last } = await sb
          .from('training_sessions').select('session_date')
          .eq('club_id', ctx.clubId).neq('session_type', 'rehab')
          .order('session_date', { ascending: false }).limit(1).maybeSingle();
        if (!last) return [];
        const d = new Date(last.session_date);
        const startYear = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
        from = `${startYear}-07-01`;
      }
      // Honor explicit season links: sessions manually assigned (season_id) to the season that
      // owns this window are pulled in EVEN when their date falls outside it — that's how
      // imported / pre-season GPS days bucketed via "Assign rivals" show up in the season view.
      const seasonId = pickedSeasonId || await _seasonIdForWindow(from, to, ctx, sb);
      if (seasonId) {
        const dateArm = to
          ? `and(session_date.gte.${from},session_date.lte.${to})`
          : `session_date.gte.${from}`;
        q = q.or(`${dateArm},season_id.eq.${seasonId}`);
      } else {
        q = q.gte('session_date', from);
        if (to) q = q.lte('session_date', to);
      }
      break;
    }
    case 'custom': {
      if (range.from) q = q.gte('session_date', range.from);
      if (range.to)   q = q.lte('session_date', range.to);
      break;
    }
    case 'allTime': {
      // No date bounds — the whole club/team history (works for session AND task sources).
      break;
    }
  }

  const { data, error } = await q.order('session_date', { ascending: true });
  if (error) throw new Error(`getSessionIds: ${error.message}`);
  return (data || []).map(r => r.id);
  })());
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
  const _pid = config.scope.level === 'player' ? (config.scope.playerId || ctx.playerId || '') : 'squad';
  // Cache key does NOT include the per-card column list: we fetch the FULL core-column set
  // (see below), so one cached row-set serves every session-source card over the same
  // scope+sessions — N cards on a dashboard collapse to 1 paginated fetch instead of N.
  // (rowVal reads each metric by key; extra columns are ignored, so this is behaviour-safe.)
  // archivedPlayerIds.length entra en la clave: sin eso, togglear "incluir archivados"
  // devolvía el row-set cacheado del estado anterior y la card no cambiaba.
  const _ck = `rpts:${config.source||'session'}:${ctx.clubId}:${ctx.teamId||''}:${_pid}:${(ctx.teamPlayerIds||[]).length}:${(ctx.archivedPlayerIds||[]).length}:${sessionIds.slice().sort().join(',')}`;
  const _hit = _cacheGet(_ck);
  if (_hit !== undefined) return _hit;
  return _cacheSet(_ck, (async () => {

  // Fetch the FULL core-column set (not just this card's columns) so the cached row-set is
  // reusable by any other card over the same scope+sessions. 13 numeric cols per row is a
  // negligible payload increase vs. the round-trip cost of re-paginating the same rows.
  const coreNeeded = [...CORE_COLS];

  // source='task' reads v_gps_task_analysis (one row per period×player mapped to a drill),
  // which is FLAT: id/session_date/position/player_name/exercise_name/field_size/… plus the
  // same base metrics AND per-min columns. select '*' so any chosen metric/dimension column
  // is present. source='session' (default) keeps the nested gps_reports select.
  const isTask = config.source === 'task';
  const select = isTask ? '*' : [
    'id', 'player_id', 'session_id',
    // always fetch session date via join
    'training_sessions!inner(session_date, session_attributes, microcycle_id)',
    // always fetch player name
    'players!inner(id, first_name, last_name, position)',
    ...coreNeeded,
  ].join(',');

  // Use the CHOSEN player as-is — never silently swap to another (that hid a historical
  // player's data, or showed always the same one). Sessions are already team-scoped, so
  // the player only resolves within this team's data; no rows → empty, which is correct.
  const _pidScoped = config.scope.level === 'player';
  const _pid = _pidScoped ? (config.scope.playerId || ctx.playerId) : null;
  if (_pidScoped && !isUuid(_pid)) return [];   // null/"null"/invalid → no rows, never a uuid 400

  // Factory rebuilds a FRESH query per page (a builder is single-use).
  const buildQ = () => {
    let q = sb
      .from(isTask ? 'v_gps_task_analysis' : 'gps_reports')
      .select(select)
      .eq('club_id', ctx.clubId)
      .in('session_id', sessionIds);
    if (!isTask) q = q.eq('is_invalid', false);   // the view already excludes flagged periods
    if (_pidScoped) {
      q = q.eq('player_id', _pid);
    } else if (!isUuid(ctx.teamId) && Array.isArray(ctx.teamPlayerIds) && ctx.teamPlayerIds.length) {
      // Squad scope: only when there is NO team scope on the sessions do we still limit
      // to the active roster (legacy fallback). With a team scope the sessions already
      // bound the rows to THIS team (incl. players who left), so the roster filter would
      // hide exactly the historical data we want.
      q = q.in('player_id', ctx.teamPlayerIds);
    }
    // Jugadores archivados: se excluyen por id, NO restringiendo al roster activo. Filtrar
    // por roster escondería también a quien cambió de categoría sin estar archivado —
    // justo la data histórica que el scope por sesiones quiere conservar.
    // ctx.archivedPlayerIds llega vacío cuando el ajuste "incluir archivados" está ON.
    if (!_pidScoped && Array.isArray(ctx.archivedPlayerIds) && ctx.archivedPlayerIds.length) {
      q = q.not('player_id', 'in', `(${ctx.archivedPlayerIds.join(',')})`);
    }
    return q;
  };

  // Paginate: the server caps any query at ~1000 rows and silently truncates — squad /
  // long-range reads exceed that, which would yield INCOMPLETE aggregates in every card.
  try {
    if (typeof window !== 'undefined' && window.cmFetchAll) {
      return await window.cmFetchAll(buildQ, { label: 'resolver.fetchReports' });
    }
    const { data, error } = await buildQ();   // fallback (non-browser/test): single page
    if (error) throw new Error(`fetchReports: ${error.message}`);
    return data || [];
  } catch (e) {
    throw new Error(`fetchReports: ${e.message || e}`);
  }
  })());
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

  // report_id are 36-char UUIDs: a single .in() with thousands of them (squad table over a wide
  // date range) builds a URL past PostgREST's length limit → 400 → the whole card errors out with
  // "GPS query failed". Chunk the id list so each request URL stays well within limits and run the
  // chunks concurrently. NB: fetchReports paginates its OUTPUT (cmFetchAll); here we chunk the INPUT
  // id set — a different axis, no shared helper. The metric_key filter is small → stays on every chunk.
  const CHUNK = 150;   // 150 × ~37 chars ≈ 5.5 KB of ids in the URL — safely under PostgREST's cap
  const chunks = [];
  for (let i = 0; i < reportIds.length; i += CHUNK) chunks.push(reportIds.slice(i, i + CHUNK));

  const results = await Promise.all(chunks.map(async (ids) => {
    const { data, error } = await sb
      .from('gps_report_metrics')
      .select('report_id, metric_key, value')
      .eq('club_id', clubId)
      .in('report_id', ids)
      .in('metric_key', metricKeys);
    if (error) {
      // A failed chunk logs and yields nothing rather than tumbling the ENTIRE card via throw — the
      // other chunks (the bulk of the data) still render. Partial data beats "GPS query failed" on
      // the whole card. Chunking already removes the URL-length 400 in the normal path.
      console.warn(`fetchEavMetrics: chunk of ${ids.length} report_ids failed — skipping: ${error.message}`);
      return [];
    }
    return data || [];
  }));

  const map = new Map();
  for (const data of results) {
    for (const row of data) {
      if (!map.has(row.report_id)) map.set(row.report_id, {});
      map.get(row.report_id)[row.metric_key] = Number(row.value);
    }
  }
  return map;
}

/**
 * RPE-table metrics (rpe, srpe=load) para las filas de gps_reports dadas,
 * matcheadas por (player_id, session_id). Devuelve Map `report.id → { key: value }`
 * con la MISMA forma que fetchEavMetrics, para poder mergear.
 */
export async function fetchRpeMetrics(rows, rpeKeys, clubId, sb) {
  if (!rows.length || !rpeKeys.length || !isUuid(clubId)) return new Map();
  const sessionIds = [...new Set(rows.map(r => r.session_id).filter(Boolean))];
  const playerIds  = [...new Set(rows.map(r => r.player_id).filter(isUuid))];
  if (!sessionIds.length || !playerIds.length) return new Map();

  const { data, error } = await sb
    .from('rpe')
    .select('player_id, session_id, rpe, load')
    .eq('club_id', clubId)
    .in('session_id', sessionIds)
    .in('player_id', playerIds);
  if (error) throw new Error(`fetchRpeMetrics: ${error.message}`);

  const byPS = new Map();
  for (const r of data || []) byPS.set(`${r.player_id}|${r.session_id}`, r);

  const out = new Map();
  for (const row of rows) {
    const src = byPS.get(`${row.player_id}|${row.session_id}`);
    if (!src) continue;
    const entry = {};
    for (const k of rpeKeys) {
      const v = src[RPE_COL_MAP[k]];
      if (v != null && !isNaN(Number(v))) entry[k] = Number(v);
    }
    if (Object.keys(entry).length) out.set(row.id, entry);
  }
  return out;
}

/**
 * Trae EAV custom + RPE-table en un solo Map mergeado `report.id → { key: value }`,
 * consumido tal cual por el path EAV de aggregateSeries. Reemplaza a fetchEavMetrics
 * en todos los call sites del pipeline.
 */
export async function fetchExtraMetrics(rows, config, catalog, clubId, sb) {
  // source='task' reads v_gps_task_analysis: EVERY metric is a column (or computed in rowVal),
  // there is no EAV/RPE join. Skip it — otherwise an .in('report_id', [thousands of period ids])
  // query can fail (URL too long) and take the whole card down.
  if (config.source === 'task') return new Map();
  const { eav: eavKeys, rpe: rpeKeys } = neededKeys(config, catalog);
  const map = (eavKeys.length && rows.length)
    ? await fetchEavMetrics(rows.map(r => r.id), eavKeys, clubId, sb)
    : new Map();
  if (rpeKeys.length && rows.length) {
    const rpeMap = await fetchRpeMetrics(rows, rpeKeys, clubId, sb);
    for (const [rid, vals] of rpeMap) map.set(rid, { ...(map.get(rid) || {}), ...vals });
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
/** Project a stored position onto the active analysis granularity (assets/positions.js).
 *  Safe no-op when the shared vocabulary isn't loaded — returns the raw value. */
function _posAt(raw) {
  try {
    if (typeof window === 'undefined' || !window.cmPositionAt) return raw;
    return window.cmPositionAt(raw, window.cmPosGranularity || 'detailed');
  } catch (_e) { return raw; }
}

export function aggregateSeries(rows, eavMap, config, catalog) {
  // Grouping dimension comes from config.dimensions[0] when present; otherwise
  // we keep the legacy per-viz default (player for player-grouped vizzes, time
  // for line). See `keyOf` below.

  // source='task' rows come from v_gps_task_analysis: FLAT shape (every metric incl. per-min
  // is a direct column; player_name/position/session_date are columns, not nested joins).
  const isTask = config.source === 'task';

  // helper: get metric value from a single row
  function rowVal(row, metricId) {
    if (metricId === 'n_instances') return 1;            // count metric → Σ(1) per group = N
    // Work time in MINUTES (duration_seconds is seconds). Computed per row so the chosen agg
    // applies: sum = total time on the drill, avg = typical instance duration.
    if (metricId === 'work_time' || metricId === 'work_min') return (Number(row.duration_seconds) || 0) / 60;
    if (DERIVED[metricId]) return DERIVED[metricId].reduce((s, b) => s + (Number(row[b]) || 0), 0);
    if (isTask) return Number(row[metricId] ?? null);   // view exposes every metric as a column
    if (CORE_COLS.has(metricId)) return Number(row[metricId] ?? null);
    // EAV
    const eav = eavMap.get(row.id);
    return eav ? Number(eav[metricId] ?? null) : null;
  }

  // helper: row weight for time-weighted avg (and the auto N/time columns). task → period
  // duration (seconds); session → minutes played. The unit cancels out in wavg.
  function rowWeight(row) {
    const d = row.duration_seconds;
    if (d != null && !isNaN(d)) return Number(d);
    const tp = row.time_played;
    return (tp != null && !isNaN(tp)) ? Number(tp) : 0;
  }

  // helper: player label (nested gps_reports shape OR flat view shape)
  function playerLabel(row) {
    const p = row.players;
    if (p) {
      const last  = p.last_name  || '';
      const first = p.first_name || '';
      return `${last}${first ? ', ' + first[0] + '.' : ''}`.trim() || row.player_id;
    }
    return row.player_name || row.player_id;   // flat view
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
  // ADITIVO: además de {key,label} devuelve `fid` = el id que espera el FILTRO de la barra
  // para esa dimensión (cross-filter). Para casi todas fid === key; sólo microcycle y rival
  // difieren, porque ahí `key` es el DISPLAY y el filtro espera el id/clave normalizada.
  // Nada más cambia: mismos key/label ⇒ mismo agrupamiento, mismos valores.
  function dimGroup(row, dimId) {
    if (!dimId || dimId === 'player_name') return { key: row.player_id, label: playerLabel(row), fid: row.player_id };
    const attrs = row.training_sessions?.session_attributes || {};
    let v, fid;
    switch (dimId) {
      // position / session_date work for BOTH shapes (nested gps_reports OR flat view)
      // Grouped at the active analysis granularity (detailed / basic 6 / broad group) so the
      // dimension matches what the filter bar offers. Falls back to the raw value untouched.
      case 'position':     v = _posAt(row.players?.position ?? row.position); break;
      case 'session_date': v = (row.training_sessions?.session_date ?? row.session_date)?.slice(0, 10); break;
      // MD: md_code guardado en session_attributes primero; si no, el MD por fecha del filter bar
      // (guardado por Daily Planning ∪ DERIVADO del microciclo = partido + md_overrides), igual que
      // la columna Microcycle. Así las sesiones de GPS importadas (sin md_code) muestran su MD.
      case 'md_code': {
        const _sd = row.training_sessions?.session_date ?? row.session_date;
        const _dd = _sd ? String(_sd).slice(0, 10) : '';
        v = attrs.md_code
          || (typeof window !== 'undefined' && window._gpMdForDate ? window._gpMdForDate[_dd] : null)
          || (typeof window !== 'undefined' && window._gpMdDerived ? window._gpMdDerived(_dd) : null);
        break;
      }
      // display = nombre del MC. CRITERIO ÚNICO (idéntico a la barra de filtros _gpMcOfSession):
      // microcycle_id guardado SI cae en el scope del equipo, si no la ventana por fecha. El label
      // SIEMPRE sale de la tabla microcycles (_gpMcLabelById), NUNCA del texto libre
      // session_attributes.microcycle: así agrupar (tabla) == listar opción (filtro) == filtrar
      // (narrowing) resuelven el mismo id. Antes usaba microcycle_id crudo sin chequear scope y
      // priorizaba el texto libre → un MC salía en la tabla que el filtro no podía ofrecer.
      case 'microcycle':   {
        const _sd = row.training_sessions?.session_date ?? row.session_date;
        const _ts = row.training_sessions || { microcycle_id: row.microcycle_id, session_date: _sd };
        const _of = (typeof window !== 'undefined') ? window._gpMcOfSession : null;
        fid = _of ? (_of(_ts) || null)
                  : (row.training_sessions?.microcycle_id
                     ?? ((typeof window !== 'undefined' && window._gpMcForDate ? window._gpMcForDate(_sd) : '') || null));
        const _lbl = (typeof window !== 'undefined' && window._gpMcLabelById && fid != null) ? window._gpMcLabelById[fid] : null;
        v = _lbl || fid;
        break;
      }
      // display = texto crudo del rival; el filtro `rival` matchea por el nombre NORMALIZADO
      // (mismo normalizado que gp-filterbar: trim + lowercase)
      case 'rival':        v = attrs.rival || attrs.opponent;
                           fid = (v == null || v === '') ? null : String(v).trim().toLowerCase(); break;
      // task dimensions (flat view columns; source='task' only)
      case 'drill':          v = row.exercise_name; break;
      case 'field_size':     v = row.field_size; break;
      case 'players_format': v = row.players_format; break;
      default:             return { key: row.player_id, label: playerLabel(row), fid: row.player_id };
    }
    const lbl = (v == null || v === '') ? '—' : String(v);
    return { key: lbl, label: lbl, fid: fid !== undefined ? fid : lbl };   // por defecto fid === key
  }

  // Composite group key over ALL chosen dimensions (in order). Each point carries
  // `dims` = the display value of every dimension, so a table can render one
  // column per dimension (Name, Position, …). Legacy: no dimensions → player / time.
  const dimIds  = (config.dimensions || []).map(d => d.id).filter(Boolean);
  const GROUPED = ['bars', 'ranking', 'table', 'heatmap', 'scatter', 'line'].includes(config.viz);
  // Scatter default: one point per PLAYER (the entity); the dimension is a COLOUR
  // category — NOT a grouping axis. So it groups by player_id and carries `cat` =
  // the first dimension's value (for legend/colour).
  // EXCEPTION — dimension === 'rival': the scatter shows MATCH DEMANDS. Each point is
  // a MATCH (session_date × rival), aggregating across the squad, with the rival as
  // the colour/crest category. This drops players from the plot and lets the same
  // rival appear once per game played (repeat fixtures → repeat points/crests).
  const scatterMatchDemand = config.viz === 'scatter' && dimIds[0] === 'rival';
  const groupOf = scatterMatchDemand
    ? (row => {
        const rv   = dimGroup(row, 'rival').label;
        const date = (row.training_sessions?.session_date ?? row.session_date)?.slice(0, 10) || '';
        return { key: `${date} ¦ ${rv}`, label: date ? `${rv} · ${date}` : rv, dims: [rv], cat: rv };
      })
    : config.viz === 'scatter'
    ? (row => { const l = playerLabel(row);
                const cat = dimIds.length ? dimGroup(row, dimIds[0]).label : null;
                // pid → lets the scatter draw each point as the player's avatar (Phase 4).
                return { key: row.player_id, label: l, dims: [l], cat, pid: row.player_id }; })
    : dimIds.length
    ? (row => {
        const parts = dimIds.map(id => dimGroup(row, id));   // [{key,label,fid}, …]
        return { key:   parts.map(p => p.key).join(' ¦ '),   // composite stable key
                 label: parts.map(p => p.label).join(' · '), // composite x display
                 dims:  parts.map(p => p.label),             // per-dimension columns
                 // fid SOLO con una dimensión: un grupo compuesto ("Def · MC3") no mapea a
                 // un único valor de filtro → null ⇒ el cross-filter lo excluye.
                 fid:   dimIds.length === 1 ? parts[0].fid : null };
      })
    : (config.viz === 'line'
        ? (row => { const t = timeLabel(row); return { key: t, label: t, dims: [t] }; })
        : (row => { const l = playerLabel(row); return { key: row.player_id, label: l, dims: [l], fid: row.player_id }; }));

  return config.metrics.map(m => {
    const cat = catalog.get(m.id);

    // Calculated metric → per-session value = evaluate the formula with this row's
    // base values; the result feeds the SAME applyAgg as a base metric
    // (calculate-per-session → then aggregate). Sessions where the formula yields
    // null (division by zero / missing base metric) drop out before aggregating.
    const formula = isCalculated(m, catalog) ? formulaOf(m, catalog) : null;
    const valOf   = formula
      ? (row => evalFormulaRow(formula, baseId => rowVal(row, baseId)))
      : (row => rowVal(row, m.id));
    const name = cat?.name || m.name || m.id;
    const unit = cat?.unit || m.unit || '';

    // 'count' aggregation → number of DISTINCT training sessions in the group (not rows: a session
    // has one row per player, so counting rows would multiply by squad size). Session-independent of
    // the metric's value, so its unit is dropped and it reads as an integer. Falls back to the report
    // id only when no session id is present. See _aggName / AGGS.count in gp-builder.
    const isCount  = m.agg === 'count';
    const sessOf   = row => row.session_id ?? row.training_sessions?.id ?? row.id;
    const outUnit  = isCount ? '' : unit;

    if (GROUPED) {
      // group rows by the composite key → aggregate each metric within the group. We carry
      // the duration weight per contributing instance so 'wavg' (time-weighted average) works.
      const byKey = new Map();
      for (const row of rows) {
        const g = groupOf(row);
        if (!byKey.has(g.key)) byKey.set(g.key, { label: g.label, dims: g.dims, cat: g.cat, pid: g.pid, fid: g.fid, vals: [], weights: [], sids: isCount ? new Set() : null });
        const e = byKey.get(g.key);
        if (isCount) { const sid = sessOf(row); if (sid != null) e.sids.add(sid); continue; }
        const v = valOf(row);
        if (v != null && !isNaN(v)) { e.vals.push(v); e.weights.push(rowWeight(row)); }
      }
      const points = Array.from(byKey.values())
        .map(({ label, dims, cat, pid, fid, vals, weights, sids }) =>
          ({ x: label, dims, cat, pid, fid, y: isCount ? sids.size : (applyAgg(vals, m.agg, weights) ?? 0) }));

      if (config.viz === 'ranking') points.sort((a, b) => b.y - a.y);

      return { label: m.id, name, unit: outUnit, points };
    }

    // kpi / radar: single aggregate across all rows
    if (isCount) {
      const sids = new Set();
      for (const row of rows) { const sid = sessOf(row); if (sid != null) sids.add(sid); }
      return { label: m.id, name, unit: '', points: [{ x: 'all', y: sids.size }] };
    }

    // Two-level squad rollup (level 2): aggregate per player with the metric's own agg (level 1),
    // then combine the per-player results with scope.rollup (avg / total / max / min / median). Only
    // for single-value cards at squad scope; 'pooled' or absent → the legacy single-pass path below
    // (all rows aggregated at once) runs unchanged, so existing cards keep their exact values.
    const rollup = config.scope?.level === 'squad' ? config.scope?.rollup : null;
    if (rollup && rollup !== 'pooled') {
      const byPlayer = new Map();
      for (const row of rows) {
        const v = valOf(row);
        if (v == null || isNaN(v)) continue;
        const pid = row.player_id ?? playerLabel(row);
        if (!byPlayer.has(pid)) byPlayer.set(pid, { vals: [], weights: [] });
        const e = byPlayer.get(pid);
        e.vals.push(v); e.weights.push(rowWeight(row));
      }
      const perPlayer = [];
      for (const { vals, weights } of byPlayer.values()) {
        const pv = applyAgg(vals, m.agg, weights);   // level 1: this player's value over the range
        if (pv != null && !isNaN(pv)) perPlayer.push(pv);
      }
      const y = applyAgg(perPlayer, rollup) ?? 0;     // level 2: combine across players
      return { label: m.id, name, unit, points: [{ x: 'all', y }] };
    }

    const vals = [], weights = [];
    for (const row of rows) { const v = valOf(row); if (v != null && !isNaN(v)) { vals.push(v); weights.push(rowWeight(row)); } }
    const y = applyAgg(vals, m.agg, weights) ?? 0;
    return { label: m.id, name, unit, points: [{ x: 'all', y }] };
  });
}

// ── FAST-PATH: agregación POR JUGADOR en Postgres (RPC gps_player_agg) ────────────────
// Reconstruye EXACTAMENTE la salida de aggregateSeries para el caso "plantel, agrupado por
// jugador, métricas core, agg simple, sin comparación/relativo" — evitando traer
// jugadores×sesiones de filas crudas. Si algo no encaja, canUsePlayerAgg devuelve false y el
// caller usa el path crudo (idéntico a antes). Los números coinciden porque el RPC replica la
// semántica de applyAgg + rowVal (NULL→0 vía coalesce, n=count(*), w=time_played>0).

const _PLAYER_AGG_AGGS = new Set(['total', 'avg', 'max', 'min', 'wavg']);

/** ¿El card encaja en el fast-path por jugador? (mismo resultado exacto que el path crudo). */
export function canUsePlayerAgg(config, catalog) {
  if (!config || config.source === 'task') return false;
  if (config.scope?.level !== 'squad') return false;
  if (config.comparison?.baseline && config.comparison.baseline !== 'none') return false;  // vs mc/role/match → crudo
  const viz = config.viz;
  const isKpi = viz === 'kpi' || viz === 'gauge';   // gauge = valor único plantel, igual que kpi
  const isScatter = viz === 'scatter';              // scatter plantel = un punto por jugador (2 métricas)
  // GROUPED (tabla/barras/ranking por jugador), KPI/GAUGE plantel, o SCATTER (por jugador, sin dim).
  // line/heatmap/radar → crudo (agrupamiento temporal/otro no reconstruible desde por-jugador).
  if (!isKpi && !isScatter && !['table', 'bars', 'ranking'].includes(viz)) return false;
  const dimIds = (config.dimensions || []).map(d => d.id).filter(Boolean);
  if (isKpi || isScatter) {
    if (dimIds.length) return false;                       // KPI/scatter con dimensión (rival/pos) → crudo
  } else if (dimIds.length && !(dimIds.length === 1 && dimIds[0] === 'player_name')) {
    return false;                                          // grouped: sólo agrupado por jugador
  }
  const ms = config.metrics || [];
  if (!ms.length) return false;
  for (const m of ms) {
    if (m.rel) return false;                              // Δ% vs MD/MC → crudo
    if (m.agg === 'count') {                              // count = sesiones distintas (n_sessions), ignora la columna
      if (isKpi) return false;                            //   KPI count = distinct global, no reconstruible desde grupos → crudo
      continue;                                           //   grouped: OK, sin chequear el id de la métrica
    }
    if (SYNTHETIC.has(m.id)) return false;                // n_instances/work_time → crudo
    const bases = _paBases(m, catalog);                   // acc_dec (derivada) o intensity (calculada suma-pura)
    if (bases) {                                          // suma de columnas base → total/avg/wavg reconstruibles
      if (!(m.agg === 'total' || m.agg === 'avg' || m.agg === 'wavg')) return false;  // max/min de la suma no
      continue;
    }
    if (isCalculated(m, catalog)) return false;           // calculada NO suma-pura (ratio/producto) → crudo
    if (!_PLAYER_AGG_AGGS.has(m.agg)) return false;       // median → crudo (nivel 1 no reconstruible)
    if (!CORE_COLS.has(m.id)) return false;               // EAV / no-core → crudo
  }
  return true;
}

/** Etiqueta de jugador IDÉNTICA a playerLabel de aggregateSeries. */
function _paPlayerLabel(row) {
  const last = row.last_name || '', first = row.first_name || '';
  return `${last}${first ? ', ' + first[0] + '.' : ''}`.trim() || row.player_id;
}

// Bases [ids core] de una métrica reconstruible como suma de columnas base: DERIVADA (acc_dec) o
// CALCULADA cuya fórmula es una SUMA PURA de columnas core (coef. 1, sin constante ni /·funciones).
// null = métrica core común (usa su propia columna). Verifica la linealidad evaluando la fórmula
// con vectores unitarios → nunca agarra un ratio/producto (que NO se reconstruye desde sumas).
function _paBases(m, catalog) {
  if (DERIVED[m.id]) return DERIVED[m.id];
  if (!isCalculated(m, catalog)) return null;
  const f = formulaOf(m, catalog);
  if (!f) return null;
  const bases = formulaBaseMetrics(f);
  if (!bases.length || !bases.every(b => CORE_COLS.has(b))) return null;   // bases deben ser core
  const _ev = vals => evalFormulaRow(f, id => (id in vals ? vals[id] : 0));
  const z = {}; bases.forEach(b => z[b] = 0);
  if (_ev(z) !== 0) return null;                                           // constante ≠ 0 o división por 0 → no lineal
  for (const b of bases) { const u = {}; bases.forEach(x => u[x] = x === b ? 1 : 0); if (_ev(u) !== 1) return null; }  // coef. unitario
  const a = {}; bases.forEach(b => a[b] = 1);
  if (_ev(a) !== bases.length) return null;                               // sin términos cruzados → suma pura
  return bases;
}

// Σ de una métrica en el grupo. bases (array) → suma de las columnas base; null → columna propia.
function _paSum(row, bases, id) {
  return bases ? bases.reduce((s, x) => s + (Number(row[`${x}_sum`]) || 0), 0) : (Number(row[`${id}_sum`]) || 0);
}
// Σ(valor·peso) de una métrica en el grupo (idem, para wavg).
function _paSwv(row, bases, id) {
  return bases ? bases.reduce((s, x) => s + (Number(row[`${x}_swv`]) || 0), 0) : (Number(row[`${id}_swv`]) || 0);
}

/** Valor de una métrica para un jugador, reconstruido de los bloques del RPC = applyAgg exacto.
 *  Soporta core, DERIVADAS (acc_dec) y CALCULADAS-suma-pura (intensity) para total/avg/wavg. max/min
 *  de una suma NO se reconstruye → el guard lo excluye, así que aquí max/min sólo llega a core. */
function _paMetricValue(row, m, bases) {
  const n = Number(row.n_rows) || 0;
  if (!n) return null;                                    // grupo vacío → applyAgg devuelve null
  if (m.agg === 'count') return Number(row.n_sessions) || 0;   // count = sesiones DISTINTAS del grupo
  switch (m.agg) {
    case 'total': return _paSum(row, bases, m.id);                            // Σ coalesce(x,0)
    case 'avg':   return _paSum(row, bases, m.id) / n;                        // Σ / count(*) (NULL cuenta como 0)
    case 'max':   { const v = row[`${m.id}_max`]; return v == null ? null : Number(v); }
    case 'min':   { const v = row[`${m.id}_min`]; return v == null ? null : Number(v); }
    case 'wavg':  { const sw = Number(row.w_sum) || 0; return sw > 0 ? _paSwv(row, bases, m.id) / sw : null; }
    default:      return null;
  }
}

/** Valor POOLED de una métrica sobre todos los jugadores (KPI plantel, rollup pooled/ausente) =
 *  applyAgg sobre TODAS las filas crudas, reconstruido de los bloques. */
function _paPooled(rows, m, bases) {
  const id = m.id;
  let sum = 0, n = 0, sw = 0, swv = 0, mx = null, mn = null, any = false;
  for (const row of rows) {
    const rn = Number(row.n_rows) || 0;
    if (!rn) continue;
    any = true;
    sum += _paSum(row, bases, id);
    n   += rn;
    sw  += Number(row.w_sum) || 0;
    swv += _paSwv(row, bases, id);
    const rmx = row[`${id}_max`], rmn = row[`${id}_min`];
    if (rmx != null) { const v = Number(rmx); if (mx == null || v > mx) mx = v; }
    if (rmn != null) { const v = Number(rmn); if (mn == null || v < mn) mn = v; }
  }
  if (!any) return null;                                   // applyAgg sobre vacío → null
  switch (m.agg) {
    case 'total': return sum;
    case 'avg':   return n > 0 ? sum / n : null;
    case 'max':   return mx;
    case 'min':   return mn;
    case 'wavg':  return sw > 0 ? swv / sw : null;
    default:      return null;
  }
}

/** Construye la serie desde las filas del RPC. GROUPED (tabla/barras/ranking) → un punto por
 *  jugador; KPI plantel → un único punto (pooled, o rollup 2-niveles sobre los valores por jugador).
 *  Misma forma y mismos números que aggregateSeries. */
function _buildPlayerAggSeries(aggRows, config, catalog) {
  const rows = aggRows || [];
  const isKpi = config.viz === 'kpi' || config.viz === 'gauge';   // gauge = valor único, misma serie que kpi
  const rollup = (isKpi && config.scope?.rollup && config.scope.rollup !== 'pooled') ? config.scope.rollup : null;
  return (config.metrics || []).map(m => {
    const cat = catalog.get(m.id);
    const name = cat?.name || m.name || m.id;
    const unit = m.agg === 'count' ? '' : (cat?.unit || m.unit || '');   // count → sin unidad (igual que aggregateSeries)
    const bases = _paBases(m, catalog);   // derivada/calculada-suma → columnas base; null → core común
    // Sin filas → puntos vacíos (hasData=false → estado "no data", igual que el path crudo).
    if (!rows.length) return { label: m.id, name, unit, points: [] };
    if (isKpi) {
      let y;
      if (rollup) {
        // 2 niveles: valor por jugador (nivel 1) → combinar con rollup (nivel 2). Tengo TODOS los
        // valores por jugador, así que 'median' de rollup también es exacto.
        const perPlayer = [];
        for (const row of rows) { const v = _paMetricValue(row, m, bases); if (v != null && !isNaN(v)) perPlayer.push(v); }
        y = applyAgg(perPlayer, rollup) ?? 0;
      } else {
        y = _paPooled(rows, m, bases) ?? 0;
      }
      return { label: m.id, name, unit, points: [{ x: 'all', y: (y == null || isNaN(y)) ? 0 : y }] };
    }
    // Scatter plantel (sin dimensión): un punto por jugador con pid + cat:null, igual que
    // aggregateSeries. El renderer combina metrics[0] (x) y metrics[1] (y) por jugador.
    if (config.viz === 'scatter') {
      const points = rows.map(row => {
        const label = _paPlayerLabel(row);
        const y = _paMetricValue(row, m, bases);
        return { x: label, dims: [label], cat: null, pid: row.player_id, y: (y == null || isNaN(y)) ? 0 : y };
      });
      return { label: m.id, name, unit, points };
    }
    const points = rows.map(row => {
      const label = _paPlayerLabel(row);
      const y = _paMetricValue(row, m, bases);
      return { x: label, dims: [label], fid: row.player_id, y: (y == null || isNaN(y)) ? 0 : y };
    });
    if (config.viz === 'ranking') points.sort((a, b) => b.y - a.y);
    return { label: m.id, name, unit, points };
  });
}

/**
 * Fast-path: resuelve la serie plantel-por-jugador vía RPC gps_player_agg (~1 fila/jugador).
 * Devuelve la serie (misma forma que aggregateSeries) o `null` si el RPC no está disponible/falla
 * → el caller cae al path crudo. Probe una vez por carga (window.__cmRpcAvail.gps_player_agg).
 * IMPORTANTE: el llamador ya debe haber chequeado canUsePlayerAgg + que NO haya filtros de
 * player/position/microcycle activos en el bar (esos se filtran a nivel fila, no en sessionIds).
 */
export async function resolvePlayerAggSeries(sessionIds, config, ctx, catalog, sb) {
  if (!sessionIds.length) return [];
  if (typeof window !== 'undefined' && window.__cmRpcAvail && window.__cmRpcAvail.gps_player_agg === false) return null;
  // include/exclude EXACTAMENTE como buildQ (squad): include sólo si NO hay team scope en las
  // sesiones y hay roster; exclude = archivados. Así el conjunto de filas coincide con el crudo.
  const include = (!isUuid(ctx.teamId) && Array.isArray(ctx.teamPlayerIds) && ctx.teamPlayerIds.length)
    ? ctx.teamPlayerIds : null;
  const exclude = (Array.isArray(ctx.archivedPlayerIds) && ctx.archivedPlayerIds.length)
    ? ctx.archivedPlayerIds : null;

  const _ck = `pagg:${ctx.clubId}:${ctx.teamId || ''}:${(include || []).length}:${(exclude || []).length}:${sessionIds.slice().sort().join(',')}`;
  let rowsP = _cacheGet(_ck);
  if (rowsP === undefined) {
    rowsP = _cacheSet(_ck, (async () => {
      const { data, error } = await sb.rpc('gps_player_agg', {
        p_club_id: ctx.clubId, p_session_ids: sessionIds, p_player_ids: include, p_exclude_ids: exclude,
      });
      if (error) throw error;
      return data || [];
    })());
  }
  let aggRows;
  try { aggRows = await rowsP; }
  catch (e) {
    if (typeof window !== 'undefined') { window.__cmRpcAvail = window.__cmRpcAvail || {}; window.__cmRpcAvail.gps_player_agg = false; }
    if (typeof window !== 'undefined' && window.__gpResolverCache) window.__gpResolverCache.delete(_ck);   // no reusar el rechazo
    console.warn('gps_player_agg RPC unavailable — raw fallback:', e?.message || e);
    return null;
  }
  if (typeof window !== 'undefined') { window.__cmRpcAvail = window.__cmRpcAvail || {}; window.__cmRpcAvail.gps_player_agg = true; }
  return _buildPlayerAggSeries(aggRows, config, catalog);
}

// ── FAST-PATH por JUGADOR × MICROCICLO (tabla ALL VALUES con columna MC) ──────────────
/** ¿Encaja el fast-path jugador×microciclo? dims = exactamente {player_name, microcycle}. */
export function canUsePlayerMcAgg(config, catalog) {
  if (!config || config.source === 'task') return false;
  if (config.scope?.level !== 'squad') return false;
  if (config.comparison?.baseline && config.comparison.baseline !== 'none') return false;
  if (!['table', 'bars', 'ranking'].includes(config.viz)) return false;
  const dimIds = (config.dimensions || []).map(d => d.id).filter(Boolean);
  if (dimIds.length !== 2) return false;
  const s = new Set(dimIds);
  if (!(s.has('player_name') && s.has('microcycle'))) return false;
  const ms = config.metrics || [];
  if (!ms.length) return false;
  for (const m of ms) {
    if (m.rel) return false;
    if (m.agg === 'count') continue;                      // count = sesiones distintas (n_sessions), siempre grouped acá
    if (SYNTHETIC.has(m.id)) return false;
    const bases = _paBases(m, catalog);                   // acc_dec (derivada) o intensity (calculada suma-pura)
    if (bases) {
      if (!(m.agg === 'total' || m.agg === 'avg' || m.agg === 'wavg')) return false;
      continue;
    }
    if (isCalculated(m, catalog)) return false;
    if (!_PLAYER_AGG_AGGS.has(m.agg)) return false;
    if (!CORE_COLS.has(m.id)) return false;
  }
  return true;
}

/** Etiqueta de microciclo idéntica a dimGroup('microcycle'): nombre de la tabla, '' → '—'. */
function _paMcLabel(mcKey) {
  if (mcKey == null || mcKey === '') return '—';
  const lbl = (typeof window !== 'undefined' && window._gpMcLabelById) ? window._gpMcLabelById[mcKey] : null;
  return lbl || mcKey;
}

/** Serie jugador×microciclo desde las filas del RPC. dims en el orden de config.dimensions. */
function _buildPlayerMcAggSeries(aggRows, config, catalog) {
  const rows = aggRows || [];
  const dimIds = (config.dimensions || []).map(d => d.id).filter(Boolean);
  const isRanking = config.viz === 'ranking';
  return (config.metrics || []).map(m => {
    const cat = catalog.get(m.id);
    const name = cat?.name || m.name || m.id;
    const unit = m.agg === 'count' ? '' : (cat?.unit || m.unit || '');   // count → sin unidad
    const bases = _paBases(m, catalog);
    if (!rows.length) return { label: m.id, name, unit, points: [] };
    const points = rows.map(row => {
      const playerLabel = _paPlayerLabel(row);
      const mcLabel = _paMcLabel(row.mc_key);
      const parts = dimIds.map(id => id === 'microcycle' ? mcLabel : playerLabel);   // orden de las dimensiones
      const y = _paMetricValue(row, m, bases);
      return { x: parts.join(' · '), dims: parts, fid: null, y: (y == null || isNaN(y)) ? 0 : y };
    });
    if (isRanking) points.sort((a, b) => b.y - a.y);
    return { label: m.id, name, unit, points };
  });
}

/**
 * Fast-path jugador×microciclo. El microciclo lo deriva el CLIENTE (window._gpMcOfSession, misma
 * lógica que la tabla) y se pasa como mapa session→mc al RPC gps_player_mc_agg. '' = sin microciclo
 * (datos importados) → bucket "—", no falla. Devuelve la serie o null (→ caller cae a crudo).
 */
export async function resolvePlayerMcAggSeries(sessionIds, config, ctx, catalog, sb) {
  if (!sessionIds.length) return [];
  if (typeof window === 'undefined' || typeof window._gpMcOfSession !== 'function') return null;  // sin resolver de mc → crudo
  if (window.__cmRpcAvail && window.__cmRpcAvail.gps_player_mc_agg === false) return null;

  // 1) mapa session_id → microciclo ('' = ninguno), MISMO _gpMcOfSession que la tabla. Cacheado.
  const _mck = `smc:${ctx.clubId}:${ctx.teamId || ''}:${sessionIds.slice().sort().join(',')}`;
  let mapP = _cacheGet(_mck);
  if (mapP === undefined) {
    mapP = _cacheSet(_mck, (async () => {
      const q = () => sb.from('training_sessions').select('id, microcycle_id, session_date').in('id', sessionIds);
      const data = (typeof window !== 'undefined' && window.cmFetchAll)
        ? await window.cmFetchAll(q, { label: 'playerMcAgg.sessions' })
        : ((await q()).data || []);
      const m = new Map();
      for (const srow of (data || [])) m.set(String(srow.id), String(window._gpMcOfSession(srow) || ''));
      return m;
    })());
  }
  let sessMap;
  try { sessMap = await mapP; }
  catch (e) {
    if (typeof window !== 'undefined' && window.__gpResolverCache) window.__gpResolverCache.delete(_mck);
    console.warn('playerMcAgg session→mc map failed — raw fallback:', e?.message || e);
    return null;
  }
  const p_session_ids = [], p_session_mcs = [];
  for (const sid of sessionIds) { p_session_ids.push(sid); p_session_mcs.push(sessMap.get(String(sid)) || ''); }

  const include = (!isUuid(ctx.teamId) && Array.isArray(ctx.teamPlayerIds) && ctx.teamPlayerIds.length) ? ctx.teamPlayerIds : null;
  const exclude = (Array.isArray(ctx.archivedPlayerIds) && ctx.archivedPlayerIds.length) ? ctx.archivedPlayerIds : null;

  const _ck = `pmcagg:${ctx.clubId}:${ctx.teamId || ''}:${(include || []).length}:${(exclude || []).length}:${p_session_ids.slice().sort().join(',')}`;
  let rowsP = _cacheGet(_ck);
  if (rowsP === undefined) {
    rowsP = _cacheSet(_ck, (async () => {
      const { data, error } = await sb.rpc('gps_player_mc_agg', {
        p_club_id: ctx.clubId, p_session_ids, p_session_mcs, p_player_ids: include, p_exclude_ids: exclude,
      });
      if (error) throw error;
      return data || [];
    })());
  }
  let aggRows;
  try { aggRows = await rowsP; }
  catch (e) {
    if (typeof window !== 'undefined') { window.__cmRpcAvail = window.__cmRpcAvail || {}; window.__cmRpcAvail.gps_player_mc_agg = false; }
    if (typeof window !== 'undefined' && window.__gpResolverCache) window.__gpResolverCache.delete(_ck);
    console.warn('gps_player_mc_agg RPC unavailable — raw fallback:', e?.message || e);
    return null;
  }
  if (typeof window !== 'undefined') { window.__cmRpcAvail = window.__cmRpcAvail || {}; window.__cmRpcAvail.gps_player_mc_agg = true; }
  return _buildPlayerMcAggSeries(aggRows, config, catalog);
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

  // Scoped player's position → role group (fall back to whole squad if unknown). Compared at
  // the active granularity: with ~20 detailed positions in a 25-man squad an exact match often
  // leaves ONE player, i.e. the "position average" was the player himself. Rolling up to the
  // basic 6 / broad group gives a reference set with a real sample.
  const myPos = _posAt(rows.find(r => r.player_id === pid)?.players?.position ?? null);
  const group = rows.filter(r => myPos == null || _posAt(r.players?.position) === myPos);
  if (!group.length) return new Map();

  // EAV for custom metrics
  const eavMap = await fetchExtraMetrics(group, config, catalog, ctx.clubId, sb);
  const cellVal = (row, id) => CORE_COLS.has(id)
    ? Number(row[id] ?? null)
    : Number(eavMap.get(row.id)?.[id] ?? null);

  const out = new Map();
  for (const m of config.metrics) {
    // per-player aggregate, then mean across the group (calc metric → per-row formula)
    const formula = isCalculated(m, catalog) ? formulaOf(m, catalog) : null;
    const cell = formula ? (row => evalFormulaRow(formula, b => cellVal(row, b))) : (row => cellVal(row, m.id));
    const byPlayer = new Map();
    for (const row of group) {
      const v = cell(row);
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

/**
 * Per-metric "vs MD code" baseline for the scoped player.
 *
 * baseline(metric) = the AVERAGE of the scoped player's own reports on sessions that
 * share the SAME md_code as the card's current selection, over the last N
 * (config.comparison.opts.mdLookback ?? 4) such sessions. Implements the never-wired
 * "vs MD code" comparison — benefits radar / kpi / gauge / heatmap alike.
 *
 * Steps: read the md_code(s) covered by the current `sessionIds`; fetch the player's
 * reports over a season window (fetchReports honours config.scope → player-scoped);
 * group by md_code, keep the last N distinct sessions per code, pool their rows and
 * take the per-metric mean.
 *
 * @returns {Promise<Map<string, number|null>>}  metricId → baseline mean (null if none)
 */
export async function fetchMdBaseline(sessionIds, config, ctx, catalog, sb) {
  if (!sessionIds.length || !isUuid(ctx.clubId)) return new Map();

  // 1) md_code(s) covered by the CURRENT selection.
  const { data: curTs, error: e1 } = await sb.from('training_sessions')
    .select('id,session_attributes').in('id', sessionIds);
  if (e1) throw new Error(`fetchMdBaseline: ${e1.message}`);
  const wantMd = new Set();
  for (const s of (curTs || [])) {
    const mc = s.session_attributes?.md_code;
    if (mc != null && mc !== '') wantMd.add(String(mc));
  }
  if (!wantMd.size) return new Map();

  // 2) Season window of this club/team's sessions → the player's reports over it.
  const seasonIds = await getSessionIds({ type: 'season' }, ctx, sb);
  if (!seasonIds.length) return new Map();
  const rows = await fetchReports(seasonIds, config, ctx, catalog, sb);
  if (!rows.length) return new Map();

  // 3) Group by md_code (only those present in the current selection); within each code
  //    keep the last N DISTINCT sessions (by date desc) and pool their rows.
  const lookback = config.comparison?.opts?.mdLookback ?? 4;
  const byMd = new Map();   // md_code → Map(sessionId → { date, rows:[] })
  for (const row of rows) {
    const mc = row.training_sessions?.session_attributes?.md_code;
    if (mc == null || mc === '') continue;
    const key = String(mc);
    if (!wantMd.has(key)) continue;
    const sid  = row.session_id ?? row.training_sessions?.id ?? '';
    const date = row.training_sessions?.session_date || '';
    if (!byMd.has(key)) byMd.set(key, new Map());
    const sess = byMd.get(key);
    if (!sess.has(sid)) sess.set(sid, { date, rows: [] });
    sess.get(sid).rows.push(row);
  }
  const pool = [];
  for (const sess of byMd.values()) {
    const lastN = Array.from(sess.values())
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, lookback);
    for (const s of lastN) pool.push(...s.rows);
  }
  if (!pool.length) return new Map();

  // EAV for custom metrics on the pooled rows.
  const eavMap  = await fetchExtraMetrics(pool, config, catalog, ctx.clubId, sb);
  const cellVal = (row, id) => CORE_COLS.has(id)
    ? Number(row[id] ?? null)
    : Number(eavMap.get(row.id)?.[id] ?? null);

  const out = new Map();
  for (const m of config.metrics) {
    const formula = isCalculated(m, catalog) ? formulaOf(m, catalog) : null;
    const cell = formula ? (row => evalFormulaRow(formula, b => cellVal(row, b))) : (row => cellVal(row, m.id));
    const vals = [];
    for (const row of pool) { const v = cell(row); if (v != null && !isNaN(v)) vals.push(v); }
    out.set(m.id, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
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
  const refEav = await fetchExtraMetrics(refRows, config, catalog, ctx.clubId, sb);
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

    // EAV fetch (custom metrics + base EAV metrics referenced by calc formulas) + RPE
    const eavMap = await fetchExtraMetrics(rows, config, catalog, ctx.clubId, sb);

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
