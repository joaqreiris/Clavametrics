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
  // Match-day cache: clubId → { set:Set<'YYYY-MM-DD'>, ts }
  const _matchDatesCache = {};

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

  // ── Match days — the SINGLE source of truth for "is this day a match?" ──────
  // A day counts as a match if ANY source marks it: a training_sessions row with
  // session_type='match' (Assign rivals, GPS import) OR a calendar_events row with
  // type='match' (the Planner). Baselines, match reports and filters should all read
  // matchness from here so a match is never invisible depending on where it came from.
  async function _loadMatchDates(clubId) {
    const cached = _matchDatesCache[clubId];
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.set;
    const set = new Set();
    try {
      const [ce, ms] = await Promise.all([
        window.sb.from('calendar_events').select('date').eq('club_id', clubId).eq('type', 'match'),
        window.sb.from('training_sessions').select('session_date').eq('club_id', clubId).eq('session_type', 'match'),
      ]);
      (ce.data || []).forEach(r => { if (r.date)          set.add(r.date); });
      (ms.data || []).forEach(r => { if (r.session_date)  set.add(r.session_date); });
    } catch { /* degrade: empty set → treated as "no matches" (insufficient) */ }
    _matchDatesCache[clubId] = { set, ts: Date.now() };
    return set;
  }
  // Public helpers so any consumer resolves matchness the SAME way.
  window.gpsGetMatchDates = _loadMatchDates;                                  // → Promise<Set>
  window.gpsIsMatchDay    = async (date, clubId) => (await _loadMatchDates(clubId)).has(date);
  window.invalidateMatchDatesCache = function (clubId) {
    if (clubId) delete _matchDatesCache[clubId];
    else Object.keys(_matchDatesCache).forEach(k => delete _matchDatesCache[k]);
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
    window.invalidateMatchDatesCache(e.detail?.clubId);   // new sessions/matches may have arrived
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

    const isCore = BASELINE_METRICS.includes(metric);

    const settings = await _loadClubSettings(clubId);
    const n   = (opts && opts.n) || settings.baseline_n || DEFAULT_N;
    const key = _cacheKey(player_id, metric, n);
    const now = Date.now();
    if (_cache[key] && now - _cache[key].ts < CACHE_TTL_MS) return _cache[key].result;

    let vals = [];
    let queryError = null;

    // A report counts as "match" if its session falls on a match DAY (either source).
    const matchDates = await _loadMatchDates(clubId);
    if (!matchDates.size) {
      const result = { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
                       warning: 'No match days on record' };
      _cache[key] = { result, ts: now };
      return result;
    }
    const _datesArr = [...matchDates];

    if (isCore) {
      // Core metric — column in gps_reports
      const { data, error } = await window.sb
        .from('gps_reports')
        .select(`${metric}, training_sessions!inner(session_date)`)
        .eq('player_id', player_id)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr)
        .not(metric, 'is', null)
        .order(metric, { ascending: false })
        .limit(n);
      queryError = error;
      vals = (data || []).map(r => +(r[metric] || 0));
    } else {
      // Custom metric — EAV in gps_report_metrics
      // Step 1: get report IDs for the player's reports on match days
      const { data: matchReports, error: e1 } = await window.sb
        .from('gps_reports')
        .select('id, training_sessions!inner(session_date)')
        .eq('player_id', player_id)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr);
      queryError = e1;
      const reportIds = (matchReports || []).map(r => r.id);
      if (reportIds.length) {
        const { data: eav, error: e2 } = await window.sb
          .from('gps_report_metrics')
          .select('value')
          .in('report_id', reportIds)
          .eq('metric_key', metric)
          .not('value', 'is', null)
          .order('value', { ascending: false })
          .limit(n);
        if (!queryError) queryError = e2;
        vals = (eav || []).map(r => +(r.value || 0));
      }
    }

    if (queryError) {
      return { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
               warning: queryError.message || 'Query failed' };
    }

    const count = vals.length;
    let result;
    if (count < MIN_MATCHES) {
      result = {
        baseline: null, count, confidence: 'none', source: 'insufficient_data',
        warning: `Insufficient match data (${count} match${count !== 1 ? 'es' : ''} available, need at least ${MIN_MATCHES})`,
      };
    } else {
      const mean       = vals.reduce((s, v) => s + v, 0) / count;
      const confidence = count >= n ? 'high' : 'medium';
      const source     = count >= n ? 'full' : 'partial';
      result = { baseline: +mean.toFixed(2), count, confidence, source,
                 warning: count < n ? `Baseline from ${count} matches (recommended: ${n})` : null };
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

    const isCore = BASELINE_METRICS.includes(metric);
    const settings = await _loadClubSettings(clubId);
    const n = (opts && opts.n) || settings.baseline_n || DEFAULT_N;

    // Match days = the single source of truth (session_type='match' OR calendar match).
    const matchDates = await _loadMatchDates(clubId);
    if (!matchDates.size) return {};
    const _datesArr = [...matchDates];

    // byPlayer: player_id → number[] (top-N values, descending)
    const byPlayer = {};

    if (isCore) {
      // Paginated (server caps at ~1000): a full squad of match rows exceeds that and would
      // truncate some players' baselines. Paging is id-ordered, so do the top-n-by-value
      // selection client-side (same result as the old server .order(metric).slice(n)).
      const data = await window.cmFetchAll(() => window.sb
        .from('gps_reports')
        .select(`player_id, ${metric}, training_sessions!inner(session_date)`)
        .in('player_id', player_ids)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr)
        .not(metric, 'is', null), { label: 'baseline.squad-core' }).catch(() => null);
      if (!data) return {};
      const _vals = {};
      data.forEach(r => { (_vals[r.player_id] = _vals[r.player_id] || []).push(+(r[metric] || 0)); });
      Object.keys(_vals).forEach(pid => { byPlayer[pid] = _vals[pid].sort((a, b) => b - a).slice(0, n); });
    } else {
      // Custom metric — two-step via gps_report_metrics
      // Paginated: full-squad match reports can exceed the server's ~1000-row cap →
      // truncated report-id set → incomplete custom-metric baselines.
      const matchReports = await window.cmFetchAll(() => window.sb
        .from('gps_reports')
        .select('id, player_id, training_sessions!inner(session_date)')
        .in('player_id', player_ids)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr), { label: 'baseline.squad-eav' }).catch(() => null);
      if (!matchReports?.length) return {};

      const reportToPlayer = {};
      matchReports.forEach(r => { reportToPlayer[r.id] = r.player_id; });
      const allReportIds = matchReports.map(r => r.id);

      const { data: eav, error: e2 } = await window.sb
        .from('gps_report_metrics')
        .select('report_id, value')
        .in('report_id', allReportIds)
        .eq('metric_key', metric)
        .not('value', 'is', null)
        .order('value', { ascending: false });
      if (e2 || !eav) return {};

      eav.forEach(row => {
        const pid = reportToPlayer[row.report_id];
        if (!pid) return;
        if (!byPlayer[pid]) byPlayer[pid] = [];
        if (byPlayer[pid].length < n) byPlayer[pid].push(+(row.value || 0));
      });
    }

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
