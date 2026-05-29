// assets/gps-baseline.js
// Match-reference baseline per player.
// Reference: Miguel et al. (2022), Frontiers in Sports and Active Living
// — baseline = mean of the N best values across official matches.
// Exposed as window.getMatchBaseline(player_id, metric, clubId, options)
(function () {
  'use strict';

  const DEFAULT_N = 5;
  const MIN_MATCHES = 3;

  // Canonical metrics that support baseline calculation
  const BASELINE_METRICS = [
    'total_distance', 'high_speed_distance', 'very_high_speed_distance',
    'sprint_distance', 'accelerations', 'decelerations',
    'max_speed', 'hmld', 'player_load',
  ];

  // Cache: player_id → metric → { baseline, count, confidence, ts }
  const _cache = {};

  function _cacheKey(pid, metric, n) { return `${pid}:${metric}:${n}`; }

  /**
   * Returns match-reference baseline for a player/metric.
   * { baseline: number|null, count: number, confidence: 'high'|'medium'|'none', warning: string|null }
   */
  window.getMatchBaseline = async function (player_id, metric, clubId, opts) {
    if (!player_id || !metric || !clubId) return { baseline: null, count: 0, confidence: 'none', warning: 'Missing arguments' };
    const n    = (opts && opts.n) || DEFAULT_N;
    const key  = _cacheKey(player_id, metric, n);
    const now  = Date.now();
    if (_cache[key] && now - _cache[key].ts < 120_000) return _cache[key].result;

    const { data, error } = await window.sb
      .from('gps_reports')
      .select(`${metric}, training_sessions!inner(session_type)`)
      .eq('player_id', player_id)
      .eq('club_id', clubId)
      .eq('training_sessions.session_type', 'match')
      .not(metric, 'is', null)
      .order(metric, { ascending: false })
      .limit(n);

    if (error || !data) {
      return { baseline: null, count: 0, confidence: 'none', warning: error?.message || 'Query failed' };
    }

    const count = data.length;
    let result;
    if (count < MIN_MATCHES) {
      result = { baseline: null, count, confidence: 'none',
        warning: `Insufficient match data (${count} match${count !== 1 ? 'es' : ''} available, need at least ${MIN_MATCHES})` };
    } else {
      const mean = data.reduce((s, r) => s + (+(r[metric] || 0)), 0) / count;
      const confidence = count >= n ? 'high' : 'medium';
      const warning = count < n
        ? `Baseline from ${count} matches (recommended: ${n})`
        : null;
      result = { baseline: +mean.toFixed(2), count, confidence, warning };
    }

    _cache[key] = { result, ts: now };
    return result;
  };

  /** Invalidate cache for a player (e.g. after new data import) */
  window.invalidateBaselineCache = function (player_id) {
    Object.keys(_cache).forEach(k => { if (k.startsWith(player_id + ':')) delete _cache[k]; });
  };

  /** Bulk-fetch baselines for a player across all standard metrics */
  window.getAllBaselines = async function (player_id, clubId, opts) {
    const results = {};
    await Promise.all(BASELINE_METRICS.map(async m => {
      results[m] = await window.getMatchBaseline(player_id, m, clubId, opts);
    }));
    return results;
  };

  window.BASELINE_METRICS = BASELINE_METRICS;
  window.BASELINE_MIN_MATCHES = MIN_MATCHES;
  window.BASELINE_DEFAULT_N   = DEFAULT_N;
})();
