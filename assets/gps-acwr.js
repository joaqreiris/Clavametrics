/**
 * gps-acwr.js — Acute:Chronic Workload Ratio engine (unified, extensible).
 * Exposed on window.gpsACWR
 *
 * Design notes (evidence-based):
 *  - Model:  EWMA by default (Williams et al. 2017, Br J Sports Med) — more
 *            sensitive than the rolling average and free of the acute-window
 *            "spike" artefact. Rolling average ('ra') kept as an option.
 *  - Coupling: UNCOUPLED by default (chronic window excludes the acute window)
 *            to avoid the spurious mathematical coupling documented by Lolli
 *            et al. 2019 and Windt & Gabbett 2019. Coupled ('coupled:true') kept
 *            for backward comparability.
 *  - Metrics: internal (s-RPE load) AND external (GPS) are complementary — the
 *            literature recommends monitoring both rather than choosing one.
 *            Metrics are declared in METRICS and are fully extensible: add a
 *            row (with `source` and optional `derive`) and it appears everywhere.
 *  - ACWR is a *flag*, not a verdict. Squad averages hide at-risk individuals,
 *            so callers should surface per-player values + a risk count too.
 *
 * Acute  window = 7 days   ·  Chronic window = 28 days.
 * Daily loads are zero-filled (non-training days = 0) so the EWMA decays
 * correctly across rest days.
 */
(function () {
  'use strict';

  // ── Metric registry (extensible) ────────────────────────────────────────
  // source: 'gps'  → column(s) on gps_reports
  //         'rpe'  → column on rpe (session-RPE load)
  // derive(row) optional → compute a value from several columns.
  // To add a metric, push a row here; it appears in every ACWR surface.
  const METRICS = [
    { key: 'srpe_load',           label: 's-RPE Load',      unit: 'AU', source: 'rpe', column: 'load' },
    { key: 'player_load',         label: 'Player Load',     unit: 'AU', source: 'gps' },
    { key: 'total_distance',      label: 'Total Distance',  unit: 'm',  source: 'gps' },
    { key: 'high_speed_distance', label: 'HSR',             unit: 'm',  source: 'gps' },
    { key: 'sprint_distance',     label: 'Sprint Distance', unit: 'm',  source: 'gps' },
    { key: 'sprint_count',        label: 'Sprints',         unit: '',   source: 'gps' },
    { key: 'accel_decel',         label: 'Accel + Decel',   unit: '',   source: 'gps',
      columns: ['accelerations', 'decelerations'],
      derive: r => (Number(r.accelerations) || 0) + (Number(r.decelerations) || 0) },
  ];

  const ZONES = [
    { from: 0,   to: 0.8,  label: 'Underloaded', cls: 'under'   },
    { from: 0.8, to: 1.3,  label: 'Sweet spot',  cls: 'sweet'   },
    { from: 1.3, to: 1.5,  label: 'Overreach',   cls: 'caution' },
    { from: 1.5, to: 99,   label: 'High risk',   cls: 'risk'    },
  ];

  // Default engine configuration. Callers can override per-call.
  const CONFIG = { acuteDays: 7, chronicDays: 28, model: 'ewma', coupled: false, minSessions: 4 };

  // Merge overrides onto CONFIG WITHOUT letting an explicit `undefined` clobber a default. Callers
  // routinely pass { model, coupled } where those are undefined → they must fall back to CONFIG
  // (the club-configured model), not reset it to the hard default.
  function _opts(overrides) {
    const o = Object.assign({}, CONFIG);
    if (overrides) for (const k in overrides) if (overrides[k] !== undefined) o[k] = overrides[k];
    return o;
  }

  // ── Unified model source (single source of truth across ALL surfaces) ────────────────────────
  // The model (ra|ewma) comes from the club setting club_gps_settings.acwr_model. configure() sets
  // it directly (when the caller already holds the setting, e.g. GPS Analysis' window._gpSettings);
  // loadClubModel() lazily fetches + caches it per club so pages that DON'T load _gpSettings (Player,
  // Dossier, Gym Planner, Hub, Load Monitor) converge on the same value. The high-level calculators
  // below call _ensureModel(clubId) so every surface picks up the club model with zero per-page wiring.
  // Coupling stays UNCOUPLED (methodological decision): CONFIG.coupled defaults to false.
  const _clubModelCache = new Map();     // clubId → 'ra'|'ewma'
  const _clubModelPending = new Map();   // clubId → Promise (dedupe concurrent loads)
  function configure(opts) {
    if (opts && (opts.model === 'ra' || opts.model === 'ewma')) CONFIG.model = opts.model;
    if (opts && typeof opts.coupled === 'boolean') CONFIG.coupled = opts.coupled;
    return CONFIG.model;
  }
  async function loadClubModel(clubId) {
    if (!clubId || !window.sb) return CONFIG.model;
    if (_clubModelCache.has(clubId)) { CONFIG.model = _clubModelCache.get(clubId); return CONFIG.model; }
    if (_clubModelPending.has(clubId)) return _clubModelPending.get(clubId);
    const p = (async () => {
      let model = 'ewma';
      try {
        const { data } = await window.sb.from('club_gps_settings')
          .select('acwr_model').eq('club_id', clubId).maybeSingle();
        if (data && (data.acwr_model === 'ra' || data.acwr_model === 'ewma')) model = data.acwr_model;
      } catch { /* default ewma on error */ }
      _clubModelCache.set(clubId, model);
      _clubModelPending.delete(clubId);
      CONFIG.model = model;
      return model;
    })();
    _clubModelPending.set(clubId, p);
    return p;
  }
  const _ensureModel = loadClubModel;   // alias for readability at call sites

  function getMetric(key) { return METRICS.find(m => m.key === key) || METRICS[0]; }
  function metricValue(metric, row) {
    if (typeof metric.derive === 'function') return metric.derive(row);
    return Number(row[metric.column || metric.key]);
  }

  function getZone(acwr) {
    if (acwr == null || isNaN(acwr)) return null;
    for (const z of ZONES) if (acwr >= z.from && acwr < z.to) return z;
    return ZONES[ZONES.length - 1];
  }

  // ── Date helpers ─────────────────────────────────────────────────────────
  function _dateStr(d) { return d.toISOString().slice(0, 10); }
  function _offsetDate(refStr, days) {
    const d = new Date(refStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return _dateStr(d);
  }
  function _enumDays(fromStr, toStr) {
    const out = [];
    const cur = new Date(fromStr + 'T00:00:00');
    const end = new Date(toStr + 'T00:00:00');
    let guard = 0;
    while (cur <= end && guard++ < 4000) { out.push(_dateStr(cur)); cur.setDate(cur.getDate() + 1); }
    return out;
  }

  // ── Pure math core (unit-testable, no network) ───────────────────────────
  // Build a zero-filled daily-load array over [fromStr..toStr].
  // records: [{ date:'YYYY-MM-DD', value:Number }]  (multiple per day are summed).
  function dailyFill(records, fromStr, toStr) {
    const byDay = {};
    for (const r of records) {
      if (r.value == null || isNaN(r.value)) continue;
      byDay[r.date] = (byDay[r.date] || 0) + Number(r.value);
    }
    return _enumDays(fromStr, toStr).map(d => ({ date: d, load: byDay[d] || 0 }));
  }

  // ACWR from a zero-filled daily series, evaluated at the LAST day.
  // opts: { model:'ewma'|'ra', coupled:bool, acuteDays, chronicDays }
  function acwrFromDaily(daily, opts) {
    const o = _opts(opts);
    if (!daily.length) return null;

    if (o.model === 'ra') {
      const n = daily.length;
      const acuteSlice = daily.slice(Math.max(0, n - o.acuteDays));
      const chronicSlice = o.coupled
        ? daily.slice(Math.max(0, n - o.chronicDays))
        : daily.slice(Math.max(0, n - o.chronicDays), Math.max(0, n - o.acuteDays));
      const mean = a => a.length ? a.reduce((s, x) => s + x.load, 0) / a.length : 0;
      const acute = mean(acuteSlice), chronic = mean(chronicSlice);
      return chronic > 0 ? acute / chronic : null;
    }

    // EWMA (Williams 2017): λ = 2 / (N + 1)
    const la = 2 / (o.acuteDays + 1);
    const lc = 2 / (o.chronicDays + 1);
    let acute = daily[0].load, chronic = daily[0].load;
    for (let i = 1; i < daily.length; i++) {
      acute   = daily[i].load * la + acute   * (1 - la);
      chronic = daily[i].load * lc + chronic * (1 - lc);
    }
    return chronic > 0 ? acute / chronic : null;
  }

  // Convenience: ACWR for a player's raw records at a reference date.
  function acwrForRecords(records, refStr, opts) {
    const o = _opts(opts);
    const from = _offsetDate(refStr, -(o.chronicDays - 1));
    return acwrFromDaily(dailyFill(records, from, refStr), o);
  }

  // ── Data access (Supabase) ───────────────────────────────────────────────
  async function _fetchGps(clubId, metric, from, to) {
    const { data: sessions } = await window.sb
      .from('training_sessions')
      .select('id, session_date')
      .eq('club_id', clubId)
      .gte('session_date', from).lte('session_date', to);
    if (!sessions?.length) return {};

    const sessDate = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));
    const cols = ['player_id', 'session_id']
      .concat(metric.columns || [metric.column || metric.key]);
    const ids = sessions.map(s => s.id);

    let rows;
    if (window.cmFetchAll) {
      rows = await window.cmFetchAll(() => window.sb.from('gps_reports')
        .select(cols.join(','))
        .eq('club_id', clubId)
        .in('session_id', ids), { label: 'acwr.gps' });
    } else {
      rows = (await window.sb.from('gps_reports')
        .select(cols.join(','))
        .eq('club_id', clubId)
        .in('session_id', ids)).data || [];
    }

    const byPlayer = {};
    for (const r of (rows || [])) {
      const date = sessDate[r.session_id];
      if (!date) continue;
      const v = metricValue(metric, r);
      if (v == null || isNaN(v)) continue;
      (byPlayer[r.player_id] || (byPlayer[r.player_id] = [])).push({ date, value: v });
    }
    return byPlayer;
  }

  async function _fetchRpe(clubId, metric, from, to) {
    // rpe rows carry session_date; fall back to the joined session date.
    const { data } = await window.sb
      .from('rpe')
      .select('player_id, load, rpe, session_date, training_sessions(session_date)')
      .eq('club_id', clubId)
      .gte('session_date', from).lte('session_date', to);
    const byPlayer = {};
    for (const r of (data || [])) {
      const date = r.session_date || r.training_sessions?.session_date;
      if (!date) continue;
      const v = metricValue(metric, r);
      if (v == null || isNaN(v)) continue;
      (byPlayer[r.player_id] || (byPlayer[r.player_id] = [])).push({ date, value: v });
    }
    return byPlayer;
  }

  async function fetchByPlayer({ clubId, metricKey, from, to }) {
    const metric = getMetric(metricKey);
    return metric.source === 'rpe'
      ? _fetchRpe(clubId, metric, from, to)
      : _fetchGps(clubId, metric, from, to);
  }

  // Raw fetch of ALL columns once, so multi-metric callers (player/team cards)
  // don't issue one query per metric. Returns { gps:[rows], rpe:[rows] } with a
  // `date` attached to each row.
  const GPS_COLUMNS = ['player_id', 'session_id', 'player_load', 'total_distance',
    'high_speed_distance', 'sprint_distance', 'sprint_count', 'accelerations', 'decelerations'];

  async function _fetchRaw(clubId, from, to, sources) {
    const out = { gps: [], rpe: [] };
    if (sources.has('gps')) {
      const { data: sessions } = await window.sb.from('training_sessions')
        .select('id, session_date').eq('club_id', clubId)
        .gte('session_date', from).lte('session_date', to);
      if (sessions?.length) {
        const sessDate = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));
        const ids = sessions.map(s => s.id);
        let rows;
        if (window.cmFetchAll) {
          rows = await window.cmFetchAll(() => window.sb.from('gps_reports')
            .select(GPS_COLUMNS.join(',')).eq('club_id', clubId).in('session_id', ids), { label: 'acwr.gpsRaw' });
        } else {
          rows = (await window.sb.from('gps_reports')
            .select(GPS_COLUMNS.join(',')).eq('club_id', clubId).in('session_id', ids)).data || [];
        }
        out.gps = (rows || []).map(r => ({ ...r, date: sessDate[r.session_id] })).filter(r => r.date);
      }
    }
    if (sources.has('rpe')) {
      const { data } = await window.sb.from('rpe')
        .select('player_id, load, rpe, session_date, training_sessions(session_date)')
        .eq('club_id', clubId).gte('session_date', from).lte('session_date', to);
      out.rpe = (data || []).map(r => ({ ...r, date: r.session_date || r.training_sessions?.session_date }))
        .filter(r => r.date);
    }
    return out;
  }

  function _recordsForMetric(metric, raw) {
    const rows = metric.source === 'rpe' ? raw.rpe : raw.gps;
    const byPlayer = {};
    for (const r of rows) {
      const v = metricValue(metric, r);
      if (v == null || isNaN(v)) continue;
      (byPlayer[r.player_id] || (byPlayer[r.player_id] = [])).push({ date: r.date, value: v });
    }
    return byPlayer;
  }

  // ── High-level API ───────────────────────────────────────────────────────
  /**
   * calculateSquad({ clubId, refDate?, metricKey?, model?, coupled? })
   * → { squadAcwr, perPlayer:{ [id]:{ acwr, sessions, insufficient } },
   *     counts:{ under, sweet, over, risk, noData }, meta }
   * squadAcwr = MEAN of individual ACWRs (never pool the squad into one series).
   */
  async function calculateSquad({ clubId, refDate, metricKey, model, coupled }) {
    await _ensureModel(clubId);
    const o = _opts({ model, coupled });
    const ref = refDate || _dateStr(new Date());
    const from = _offsetDate(ref, -(o.chronicDays - 1));
    const byPlayer = await fetchByPlayer({ clubId, metricKey: metricKey || METRICS[0].key, from, to: ref });

    const perPlayer = {};
    const acwrs = [];
    const counts = { under: 0, sweet: 0, over: 0, risk: 0, noData: 0 };

    for (const [pid, recs] of Object.entries(byPlayer)) {
      const sessions = new Set(recs.map(r => r.date)).size;
      const insufficient = sessions < o.minSessions;
      const acwr = insufficient ? null : acwrForRecords(recs, ref, o);
      perPlayer[pid] = { acwr: acwr != null ? +acwr.toFixed(2) : null, sessions, insufficient };
      if (acwr == null) { counts.noData++; continue; }
      acwrs.push(acwr);
      const z = getZone(acwr);
      if (z.cls === 'under') counts.under++;
      else if (z.cls === 'sweet') counts.sweet++;
      else if (z.cls === 'caution') counts.over++;
      else counts.risk++;
    }
    const squadAcwr = acwrs.length ? +(acwrs.reduce((s, v) => s + v, 0) / acwrs.length).toFixed(2) : null;
    return { squadAcwr, perPlayer, counts, meta: { ...o, metricKey: metricKey || METRICS[0].key, ref } };
  }

  /**
   * calculateSquadTimeline({ clubId, fromDate, toDate?, metricKey?, model?, coupled? })
   * → { dates:[], squadAcwr:[], squadLoad:[] } — squad-average ACWR per day plus
   *   the total daily session load, for the trend chart.
   */
  // Pure per-player→mean timeline from ALREADY-FETCHED records. Same engine (acwrFromDaily) so the
  // curve matches the point values everywhere. `fillFrom` (default dayFrom) is the daily-fill start:
  // pass an earlier date to give the first plotted day a populated chronic window; keep it = dayFrom
  // to hard-stop the look-back at a season boundary. Callers that pre-scope players (team/filter) get
  // that scope respected — this function never fetches.
  function squadTimeline(byPlayer, dayFrom, dayTo, opts, fillFrom) {
    const o = _opts(opts);
    const _fill = fillFrom || dayFrom;
    const days = _enumDays(dayFrom, dayTo);
    const perPlayerDaily = {};
    for (const [pid, recs] of Object.entries(byPlayer || {}))
      perPlayerDaily[pid] = dailyFill(recs, _fill, dayTo);

    const dates = [], squadAcwr = [], squadLoad = [];
    for (const day of days) {
      const vals = [];
      let dayLoad = 0;
      for (const daily of Object.values(perPlayerDaily)) {
        const upto = daily.filter(d => d.date <= day);
        const a = acwrFromDaily(upto, o);
        if (a != null) vals.push(a);
        const today = daily.find(d => d.date === day);
        if (today) dayLoad += today.load;
      }
      dates.push(day);
      squadAcwr.push(vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null);
      squadLoad.push(+dayLoad.toFixed(0));
    }
    return { dates, squadAcwr, squadLoad };
  }

  async function calculateSquadTimeline({ clubId, fromDate, toDate, metricKey, model, coupled }) {
    await _ensureModel(clubId);
    const o = _opts({ model, coupled });
    const to = toDate || _dateStr(new Date());
    // Look back an extra chronic window so the earliest chart points have a
    // fully-populated chronic baseline (otherwise the initial ACWR is inflated).
    const fetchFrom = _offsetDate(fromDate, -(o.chronicDays - 1));
    const byPlayer = await fetchByPlayer({ clubId, metricKey: metricKey || METRICS[0].key, from: fetchFrom, to });
    return squadTimeline(byPlayer, fromDate, to, o, fetchFrom);
  }

  // ── Backward-compatible wrappers (used by player-load.js et al.) ──────────
  // Both compute every metric from a SINGLE raw fetch per source (2 queries max).
  async function calculateTeamACWR({ clubId, refDate, model, coupled }) {
    await _ensureModel(clubId);
    const o = _opts({ model, coupled });
    const ref = refDate || _dateStr(new Date());
    const from = _offsetDate(ref, -(o.chronicDays - 1));
    const raw = await _fetchRaw(clubId, from, ref, new Set(METRICS.map(m => m.source)));
    const out = {};
    for (const m of METRICS) {
      const byPlayer = _recordsForMetric(m, raw);
      const acwrs = [];
      for (const recs of Object.values(byPlayer)) {
        const sessions = new Set(recs.map(r => r.date)).size;
        if (sessions < o.minSessions) continue;
        const a = acwrForRecords(recs, ref, o);
        if (a != null) acwrs.push(a);
      }
      out[m.key] = acwrs.length ? +(acwrs.reduce((s, v) => s + v, 0) / acwrs.length).toFixed(2) : null;
    }
    return out;
  }
  async function calculatePlayerACWR({ clubId, refDate, model, coupled }) {
    // Returns { [player_id]: { sessCount, insufficient, <metric>:ratio, ... } }
    await _ensureModel(clubId);
    const o = _opts({ model, coupled });
    const ref = refDate || _dateStr(new Date());
    const from = _offsetDate(ref, -(o.chronicDays - 1));
    const raw = await _fetchRaw(clubId, from, ref, new Set(METRICS.map(m => m.source)));
    const result = {};
    for (const m of METRICS) {
      const byPlayer = _recordsForMetric(m, raw);
      for (const [pid, recs] of Object.entries(byPlayer)) {
        const sessions = new Set(recs.map(r => r.date)).size;
        if (!result[pid]) result[pid] = { sessCount: 0, insufficient: true };
        result[pid].sessCount = Math.max(result[pid].sessCount, sessions);
        result[pid].insufficient = result[pid].sessCount < o.minSessions;
        const a = result[pid].insufficient ? null : acwrForRecords(recs, ref, o);
        result[pid][m.key] = a != null ? +a.toFixed(2) : null;
      }
    }
    return result;
  }

  window.gpsACWR = {
    // config + metadata
    METRICS, ZONES, CONFIG, getMetric, getZone,
    // unified model source (single source of truth: club_gps_settings.acwr_model)
    configure, loadClubModel,
    // pure core
    dailyFill, acwrFromDaily, acwrForRecords, squadTimeline,
    // data + high level
    fetchByPlayer, calculateSquad, calculateSquadTimeline,
    // legacy
    ACWR_METRICS: METRICS, ACWR_ZONES: ZONES, calculateTeamACWR, calculatePlayerACWR,
  };
})();
