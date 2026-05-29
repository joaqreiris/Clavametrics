// assets/gps-baseline.js
// Match-reference baseline per player.
// Reference: Miguel et al. (2022), Frontiers in Sports and Active Living
// — baseline = mean of the N best values recorded in official matches.
// Ammann & Altmann (2023) — player-specific references outperform position-specific
// for individualised load monitoring.
//
// Public API:
//   window.getMatchBaseline(player_id, metric, clubId, opts)
//   window.getMatchBaselineBatch(player_ids, metric, clubId, opts)
//   window.getAllBaselines(player_id, clubId, opts)
//   window.invalidateBaselineCache(player_id?)
//   window.invalidateSettingsCache(clubId?)
//   window.BASELINE_METRICS, window.BASELINE_MIN_MATCHES, window.BASELINE_DEFAULT_N

(function () {
  'use strict';

  const DEFAULT_N    = 5;
  const MIN_MATCHES  = 3;
  const CACHE_TTL_MS = 120_000; // 2 min

  // Whitelist — prevents metric injection into SQL column name
  const BASELINE_METRICS = [
    'total_distance', 'high_speed_distance', 'very_high_speed_distance',
    'sprint_distance', 'accelerations', 'decelerations',
    'max_speed', 'hmld', 'player_load',
    'time_played', 'sprint_count', 'avg_speed', 'distance_per_minute',
  ];

  // Cache: cacheKey → { result, ts }
  const _cache = {};
  // Settings cache: clubId → { baseline_n, baseline_mode, active_metrics }
  const _settingsCache = {};

  function _cacheKey(pid, metric, n) { return `${pid}:${metric}:${n}`; }

  // ── Club settings ──────────────────────────────────────────────
  async function _loadClubSettings(clubId) {
    if (_settingsCache[clubId]) return _settingsCache[clubId];
    try {
      const { data } = await window.sb
        .from('club_gps_settings')
        .select('baseline_n, baseline_mode, active_metrics')
        .eq('club_id', clubId)
        .maybeSingle();
      const settings = data || { baseline_n: DEFAULT_N, baseline_mode: 'personal', active_metrics: null };
      _settingsCache[clubId] = settings;
      return settings;
    } catch {
      const def = { baseline_n: DEFAULT_N, baseline_mode: 'personal', active_metrics: null };
      _settingsCache[clubId] = def;
      return def;
    }
  }

  window.invalidateSettingsCache = function (clubId) {
    if (clubId) delete _settingsCache[clubId];
    else Object.keys(_settingsCache).forEach(k => delete _settingsCache[k]);
  };

  // ── Cache invalidation ─────────────────────────────────────────
  window.invalidateBaselineCache = function (player_id) {
    const prefix = player_id ? player_id + ':' : null;
    Object.keys(_cache).forEach(k => {
      if (!prefix || k.startsWith(prefix)) delete _cache[k];
    });
  };

  // Listen for import events (fired by GPS import pipeline after UPSERT)
  window.addEventListener('gps:reports:updated', (e) => {
    window.invalidateBaselineCache();
    if (e.detail?.clubId) window.invalidateSettingsCache(e.detail.clubId);
  });

  // ── Single player, single metric ──────────────────────────────
  /**
   * Returns match-reference baseline.
   * { baseline: number|null, count: number, source: 'full'|'partial'|'insufficient_data',
   *   confidence: 'high'|'medium'|'none', warning: string|null }
   * baseline_n is read from club_gps_settings; opts.n overrides it.
   */
  window.getMatchBaseline = async function (player_id, metric, clubId, opts) {
    if (!player_id || !metric || !clubId) {
      return { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
               warning: 'Missing arguments' };
    }
    if (!BASELINE_METRICS.includes(metric)) {
      return { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
               warning: `Unknown metric: ${metric}` };
    }

    const settings = await _loadClubSettings(clubId);
    const n   = (opts && opts.n) || settings.baseline_n || DEFAULT_N;
    const key = _cacheKey(player_id, metric, n);
    const now = Date.now();
    if (_cache[key] && now - _cache[key].ts < CACHE_TTL_MS) return _cache[key].result;

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
      return { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
               warning: error?.message || 'Query failed' };
    }

    const count = data.length;
    let result;
    if (count < MIN_MATCHES) {
      result = {
        baseline: null, count, confidence: 'none', source: 'insufficient_data',
        warning: `Insufficient match data (${count} match${count !== 1 ? 'es' : ''} available, need at least ${MIN_MATCHES})`,
      };
    } else {
      const mean       = data.reduce((s, r) => s + (+(r[metric] || 0)), 0) / count;
      const confidence = count >= n ? 'high' : 'medium';
      const source     = count >= n ? 'full' : 'partial';
      const warning    = count < n ? `Baseline from ${count} matches (recommended: ${n})` : null;
      result = { baseline: +mean.toFixed(2), count, confidence, source, warning };
    }

    _cache[key] = { result, ts: now };
    return result;
  };

  // ── Bulk: multiple players, single metric (one round-trip) ────
  /**
   * Returns { [player_id]: { baseline, count, confidence, source, warning } }
   * Fetches all rows for all player_ids, then computes per-player top-N mean.
   */
  window.getMatchBaselineBatch = async function (player_ids, metric, clubId, opts) {
    if (!player_ids?.length || !metric || !clubId) return {};
    if (!BASELINE_METRICS.includes(metric)) return {};

    const settings = await _loadClubSettings(clubId);
    const n = (opts && opts.n) || settings.baseline_n || DEFAULT_N;

    const { data, error } = await window.sb
      .from('gps_reports')
      .select(`player_id, ${metric}, training_sessions!inner(session_type)`)
      .in('player_id', player_ids)
      .eq('club_id', clubId)
      .eq('training_sessions.session_type', 'match')
      .not(metric, 'is', null)
      .order(metric, { ascending: false });

    if (error || !data) return {};

    // Group by player_id, keep top-N per player
    const byPlayer = {};
    data.forEach(r => {
      if (!byPlayer[r.player_id]) byPlayer[r.player_id] = [];
      if (byPlayer[r.player_id].length < n) byPlayer[r.player_id].push(+(r[metric] || 0));
    });

    const out = {};
    player_ids.forEach(pid => {
      const vals  = byPlayer[pid] || [];
      const count = vals.length;
      if (count < MIN_MATCHES) {
        out[pid] = { baseline: null, count, confidence: 'none', source: 'insufficient_data',
          warning: `Insufficient match data (${count}/${MIN_MATCHES} minimum)` };
      } else {
        const mean = vals.reduce((s, v) => s + v, 0) / count;
        const confidence = count >= n ? 'high' : 'medium';
        out[pid] = {
          baseline: +mean.toFixed(2), count, confidence,
          source: count >= n ? 'full' : 'partial',
          warning: count < n ? `Baseline from ${count} matches (recommended: ${n})` : null,
        };
      }
      // Populate cache for individual lookups
      const key = _cacheKey(pid, metric, n);
      if (!_cache[key]) _cache[key] = { result: out[pid], ts: Date.now() };
    });

    return out;
  };

  // ── All metrics for one player ─────────────────────────────────
  window.getAllBaselines = async function (player_id, clubId, opts) {
    const results = {};
    await Promise.all(BASELINE_METRICS.map(async m => {
      results[m] = await window.getMatchBaseline(player_id, m, clubId, opts);
    }));
    return results;
  };

  // ── Expose constants ───────────────────────────────────────────
  window.BASELINE_METRICS     = BASELINE_METRICS;
  window.BASELINE_MIN_MATCHES = MIN_MATCHES;
  window.BASELINE_DEFAULT_N   = DEFAULT_N;
})();
