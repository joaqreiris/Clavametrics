// assets/gps-reader.js
// Unified GPS reader — abstracts the hybrid core/EAV model so callers
// never have to know whether a metric lives in gps_reports columns or
// in the gps_report_metrics EAV table.
//
// Public API (window.*):
//   getCatalog(clubId)
//     → Promise<MetricDef[]>  ordered by display_order
//     → MetricDef: { key, label, unit, category, decimals, is_core, display_order }
//
//   invalidateCatalogCache(clubId?)
//     → void  (call after creating / editing / deleting a metric definition)
//
//   getReportsForSession({ clubId, sessionId, metricKeys? })
//     → Promise<ReportRow[]>
//     → ReportRow: { player_id, player: { name, number, position }, metrics: { key: value } }
//     → metricKeys = null  → all metrics in catalog
//     → metricKeys = [...]  → only those keys (core + custom, any mix)

(function () {
  'use strict';

  // Core columns: metrics stored as columns in gps_reports
  const CORE_COLS = new Set([
    'total_distance', 'high_speed_distance', 'very_high_speed_distance',
    'sprint_distance', 'accelerations', 'decelerations', 'max_speed',
    'player_load', 'avg_speed', 'hmld', 'time_played', 'sprint_count',
    'distance_per_minute',
  ]);

  const CORE_SELECT = Array.from(CORE_COLS).join(',');

  // ── Catalog cache ─────────────────────────────────────────────────
  const _catalogCache = {}; // clubId → { data, ts }
  const CATALOG_TTL_MS = 300_000; // 5 min — catalog changes infrequently

  window.getCatalog = async function (clubId) {
    const now = Date.now();
    const cached = _catalogCache[clubId];
    if (cached && now - cached.ts < CATALOG_TTL_MS) return cached.data;

    const { data, error } = await window.sb
      .from('gps_metric_definitions')
      .select('key,label,unit,category,decimals,is_core,display_order')
      .eq('club_id', clubId)
      .order('display_order', { ascending: true });

    if (error) return [];
    const result = data || [];
    _catalogCache[clubId] = { data: result, ts: now };
    return result;
  };

  window.invalidateCatalogCache = function (clubId) {
    if (clubId) delete _catalogCache[clubId];
    else Object.keys(_catalogCache).forEach(k => delete _catalogCache[k]);
  };

  // ── getReportsForSession ──────────────────────────────────────────
  /**
   * Fetches one GPS report per player for a given session, merging core
   * columns and EAV custom metrics into a flat metrics dict.
   *
   * If metricKeys is null, returns every metric that exists in the DB for
   * this session (core columns that are non-null + all custom EAV rows).
   * If metricKeys is an array, returns only those keys (avoids fetching
   * unused columns — useful for targeted chart queries).
   */
  window.getReportsForSession = async function ({ clubId, sessionId, metricKeys = null }) {
    if (!clubId || !sessionId) return [];

    // Build the SELECT string for gps_reports
    let corePart;
    if (metricKeys === null) {
      corePart = CORE_SELECT;
    } else {
      const coreRequested = metricKeys.filter(k => CORE_COLS.has(k));
      corePart = coreRequested.length ? coreRequested.join(',') : null;
    }
    const selectStr = ['id', 'player_id', corePart, 'players(first_name,last_name,number,position)']
      .filter(Boolean).join(',');

    // 1. Core rows — always fetched (we need the report id for EAV lookup)
    const { data: coreRows, error: coreErr } = await window.sb
      .from('gps_reports')
      .select(selectStr)
      .eq('session_id', sessionId)
      .eq('club_id', clubId);

    if (coreErr || !coreRows?.length) return [];

    // 2. Custom EAV metrics
    const customKeysToFetch = metricKeys === null
      ? null  // all custom values
      : metricKeys.filter(k => !CORE_COLS.has(k));

    const customByReport = {};

    const needCustom = customKeysToFetch === null || customKeysToFetch.length > 0;
    if (needCustom) {
      const reportIds = coreRows.map(r => r.id).filter(Boolean);
      if (reportIds.length) {
        let q = window.sb
          .from('gps_report_metrics')
          .select('report_id,metric_key,value')
          .in('report_id', reportIds)
          .eq('club_id', clubId);

        if (customKeysToFetch !== null) {
          q = q.in('metric_key', customKeysToFetch);
        }

        const { data: customRows } = await q;
        for (const row of (customRows || [])) {
          if (!customByReport[row.report_id]) customByReport[row.report_id] = {};
          customByReport[row.report_id][row.metric_key] = row.value;
        }
      }
    }

    // 3. Merge into uniform structure
    return coreRows.map(r => {
      const p = r.players;
      const metrics = {};

      // Core — only include non-null values
      for (const key of CORE_COLS) {
        if (r[key] != null) metrics[key] = r[key];
      }

      // Custom EAV
      const extras = customByReport[r.id] || {};
      Object.assign(metrics, extras);

      // Filter to requested keys (when metricKeys is an array)
      const finalMetrics = metricKeys !== null
        ? Object.fromEntries(metricKeys.filter(k => metrics[k] != null).map(k => [k, metrics[k]]))
        : metrics;

      return {
        player_id: r.player_id,
        player: p ? {
          name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim(),
          number: p.number,
          position: p.position,
          first_name: p.first_name,
          last_name: p.last_name,
        } : null,
        metrics: finalMetrics,
      };
    });
  };

  // Invalidate catalog when metric definitions change (fired by Settings panel in step 7)
  window.addEventListener('gps:catalog:updated', e => {
    window.invalidateCatalogCache(e.detail?.clubId);
  });

})();
