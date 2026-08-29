// lib/day-context.js
//
// THE MATCH-DAY ENGINE — one implementation, used by every screen.
//
// Before this file owned it, "which MD is this day?" was written SIX times (Calendar,
// Load Planner, Annual Planner, Club overview, Daily Planning, Gym Planner) with rules
// that did not agree. Three of them looked at every match in range and picked the nearest
// one; three looked only at microcycles.match_date, i.e. at ONE match per week. The
// windows differed too (10/3, 5/2, unbounded). On a cup-week — Wednesday cup, Sunday
// league — the Calendar called Thursday MD+1 while Daily Planning called it MD−3, for the
// very same date. That is a football bug, not a multi-sport one.
//
// The rules, now in one place:
//   1. A manual override for the date always wins (microcycles.md_overrides).
//   2. A day that IS a match day is the anchor itself ('MD' / 'GD').
//   3. Otherwise the NEAREST match wins — before or after — within the sport's window.
//   4. On an exact tie (equidistant from a previous and a next match) we return
//      `ambiguous: true` and default to the upcoming match, because planning looks
//      forward. Screens surface that so the user can settle it with an override rather
//      than have the app quietly pick for them.
//
// The anchor and the window come from the active sport pack (assets/sport-packs.js):
// football counts MD−6…MD+3, basketball GD−3…GD+2. With no pack loaded it falls back to
// football, so pages that never load sport-packs.js keep working unchanged.

(function () {
  function daysBetween(a, b) {
    const d1 = new Date(a + 'T12:00:00'), d2 = new Date(b + 'T12:00:00');
    return Math.round((d2 - d1) / 86400000);   // (b − a), same as Calendar
  }

  // Football's codes, used when no sport pack is present on the page.
  const FALLBACK_MICRO = {
    anchor: 'MD',
    dayCodes: ['MD-6','MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2','MD+3'],
  };

  function microCfg() {
    try {
      const m = window.CMSport && window.CMSport.at('micro', null);
      return (m && m.dayCodes && m.dayCodes.length) ? m : FALLBACK_MICRO;
    } catch (_e) { return FALLBACK_MICRO; }
  }

  /** How far the labels reach, derived from the pack's dayCodes so there is no second
   *  place to keep in sync: { anchor:'MD', pre:6, post:3 }. */
  function mdWindow() {
    const cfg = microCfg();
    const anchor = cfg.anchor || 'MD';
    let pre = 0, post = 0;
    (cfg.dayCodes || []).forEach(code => {
      const m = /^[A-Z]+([+-])(\d+)$/.exec(String(code).replace(/−/g, '-'));
      if (!m) return;
      const n = parseInt(m[2], 10);
      if (m[1] === '-') pre = Math.max(pre, n); else post = Math.max(post, n);
    });
    return { anchor, pre: pre || 6, post: post || 3 };
  }
  window.cmMdWindow = mdWindow;

  /** The day codes a picker should offer, in chronological order (pack-driven). */
  window.cmMdOptions = function () { return (microCfg().dayCodes || []).slice(); };

  // Forma canónica de una etiqueta MD. En la app conviven tres codificaciones del mismo
  // concepto: string ASCII ('MD-2', lo que persisten Calendar/Daily Planning), string con
  // U+2212 ('MD−2', lo que emiten los derivadores de display), y offset numérico
  // (negativo = pre-partido, como en gp-builder). Canónica: ASCII, y día de partido = 'MD'
  // (nunca 'MD0'). Usar SIEMPRE al comparar/keyear etiquetas MD entre fuentes distintas.
  window.cmMdNorm = function (v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return v === 0 ? 'MD' : (v > 0 ? 'MD+' + v : 'MD' + v);
    const s = String(v).trim().replace(/−/g, '-');
    return (s === 'MD0' || s === 'MD-0' || s === 'MD+0') ? 'MD' : s;
  };

  /**
   * THE resolver. Pure: give it a date and the match dates around it.
   *
   * @param {string}   dateStr     'YYYY-MM-DD'
   * @param {string[]} matchDates  every match date in range (any order, duplicates ok)
   * @param {object}   [opts]      { overrides, display }
   *        overrides  microcycles.md_overrides — { 'YYYY-MM-DD': 'MD-2' }
   *        display    true → render the minus sign as U+2212 ('MD−2'), which is what the
   *                   old display helpers emitted. Default is ASCII, the canonical form.
   * @returns {{label:string, offset:number|null, anchor:string, ambiguous:boolean,
   *            matchDate:string|null, source:'override'|'match'|'derived'|'none'}}
   */
  function mdForDate(dateStr, matchDates, opts) {
    const o = opts || {};
    const { anchor, pre, post } = mdWindow();
    const out = { label: '', offset: null, anchor, ambiguous: false, matchDate: null, source: 'none' };
    if (!dateStr) return out;

    // 1. A manual override always wins — that is the whole point of an override.
    const ov = o.overrides && o.overrides[dateStr];
    if (ov) return { label: String(ov), offset: null, anchor, ambiguous: false, matchDate: null, source: 'override' };

    const dates = [...new Set((matchDates || []).filter(Boolean))].sort();
    if (!dates.length) return out;

    // 2. The day itself is a match day.
    if (dates.indexOf(dateStr) >= 0)
      return { label: anchor, offset: 0, anchor, ambiguous: false, matchDate: dateStr, source: 'match' };

    // 3. Nearest match within the window, forwards or backwards.
    const next = dates.find(d => d > dateStr);
    const prev = [...dates].reverse().find(d => d < dateStr);
    const cand = [];
    if (next) { const dn = daysBetween(dateStr, next); if (dn >= 1 && dn <= pre)  cand.push({ dist: dn, offset: -dn, date: next }); }
    if (prev) { const dp = daysBetween(prev, dateStr); if (dp >= 1 && dp <= post) cand.push({ dist: dp, offset:  dp, date: prev }); }
    if (!cand.length) return out;

    // 4. Tie → flag it and lean forward. Never silently swallow the ambiguity: the screens
    //    mark the day so the user can pin it down with an override.
    const ambiguous = cand.length === 2 && cand[0].dist === cand[1].dist;
    cand.sort((a, b) => a.dist - b.dist || a.offset - b.offset);   // equal distance → the negative (upcoming) offset first
    const win = cand[0];
    const sign = win.offset < 0 ? (o.display ? '−' : '-') : '+';
    return {
      label: anchor + sign + Math.abs(win.offset),
      offset: win.offset, anchor, ambiguous, matchDate: win.date, source: 'derived',
    };
  }
  window.cmMdForDate = mdForDate;

  /** Just the label — the shape the old call sites expected. */
  window.cmMdLabel = function (dateStr, matchDates, opts) {
    return mdForDate(dateStr, matchDates, opts).label;
  };

  /* ── Match dates for a range ────────────────────────────────────────────────
     A match reaches the app through three doors — a microcycle's match_date, a
     calendar_events row of type 'match', and a training_sessions row of type 'match' —
     and different screens used to read different subsets, which is half of why their
     labels disagreed. This reads all three, deduped, and caches per (club, team, range)
     so a page asking day by day pays for one round trip.                              */
  const _mdCache = new Map();
  window.cmMatchDates = async function (clubId, teamId, from, to) {
    if (!clubId || !from || !to) return [];
    const key = [clubId, teamId || '*', from, to].join('|');
    if (_mdCache.has(key)) return _mdCache.get(key);
    const p = (async () => {
      try {
        // Rows with team_id NULL are club-wide and count for every team (same rule the
        // Load Planner already applied by hand).
        const scope = q => (teamId ? q.or(`team_id.eq.${teamId},team_id.is.null`) : q);
        const [ce, ts, mc] = await Promise.all([
          scope(window.sb.from('calendar_events').select('date,team_id')
            .eq('club_id', clubId).eq('type', 'match').gte('date', from).lte('date', to)),
          scope(window.sb.from('training_sessions').select('session_date,team_id')
            .eq('club_id', clubId).eq('session_type', 'match').gte('session_date', from).lte('session_date', to)),
          scope(window.sb.from('microcycles').select('match_date,team_id')
            .eq('club_id', clubId).not('match_date', 'is', null).gte('match_date', from).lte('match_date', to)),
        ]);
        const set = new Set();
        (ce.data || []).forEach(r => r.date && set.add(r.date));
        (ts.data || []).forEach(r => r.session_date && set.add(r.session_date));
        (mc.data || []).forEach(r => r.match_date && set.add(r.match_date));
        return [...set].sort();
      } catch (e) { console.error('cmMatchDates', e); _mdCache.delete(key); return []; }
    })();
    _mdCache.set(key, p);
    return p;
  };
  /** Drop the cache after creating/moving/deleting a match. */
  window.cmMatchDatesReset = function () { _mdCache.clear(); };

  /** Widen a date to the range that can still influence its label. */
  window.cmMdRangeFor = function (dateStr) {
    const { pre, post } = mdWindow();
    // Local YMD on purpose: toISOString() is UTC and shifts the date by one day east of
    // Greenwich, which would silently drop a match from the window.
    const shift = n => {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + n);
      const p = v => String(v).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    return { from: shift(-post), to: shift(pre) };
  };

  // Returns { microcycle:{id,name}|null, md, start_time, duration, estimated_rpe, opponent, rival, home_away, hasEvent }
  window.cmResolveDayContext = async function (dateStr, teamId, clubId) {
    const out = { microcycle:null, md:'', mdAmbiguous:false, start_time:null, duration:null, estimated_rpe:null, opponent:null, rival:null, home_away:null, hasEvent:false, dayOff:false, dayOffPlayerIds:[] };
    if (!dateStr || !clubId) return out;
    try {
      // microcycle covering the date
      let mq = window.sb.from('microcycles')
        .select('id,name,start_date,end_date,match_date,rival,home_away,md_overrides')
        .eq('club_id', clubId).lte('start_date', dateStr).gte('end_date', dateStr);
      if (teamId) mq = mq.eq('team_id', teamId);
      const { data: mcs } = await mq.limit(1);
      const mc = (mcs && mcs[0]) || null;
      if (mc) { out.microcycle = { id: mc.id, name: mc.name }; out.rival = mc.rival||null; out.home_away = mc.home_away||null; }
      // MD against EVERY match around the date, not just the microcycle's own match_date:
      // on a two-match week the nearest one is what the day actually hangs off.
      const range = window.cmMdRangeFor(dateStr);
      const dates = await window.cmMatchDates(clubId, teamId, range.from, range.to);
      const md = window.cmMdForDate(dateStr, dates, { overrides: mc && mc.md_overrides, display: true });
      out.md = md.label;
      out.mdAmbiguous = md.ambiguous;
      // calendar event for the date (prefer training)
      const evQ = cols => {
        let q = window.sb.from('calendar_events').select(cols).eq('club_id', clubId).eq('date', dateStr);
        return teamId ? q.eq('team_id', teamId) : q;
      };
      const COLS = 'type,start_time,duration_minutes,estimated_rpe,opponent,title,location';
      let evRes = await evQ(COLS + ',player_ids');
      if (evRes.error && /player_ids/.test(evRes.error.message || '')) evRes = await evQ(COLS);
      const list = evRes.data || [];
      // dayOff = day off de equipo ENTERO. Un day off parcial (player_ids con ids) no bloquea
      // el día: esos jugadores quedan fuera vía availability (status='day_off').
      out.dayOff = list.some(e => (e.type||e.session_type) === 'day_off' && !(Array.isArray(e.player_ids) && e.player_ids.length));
      out.dayOffPlayerIds = list
        .filter(e => (e.type||e.session_type) === 'day_off' && Array.isArray(e.player_ids))
        .flatMap(e => e.player_ids.map(String));
      const ev = list.find(e => (e.type||e.session_type) === 'training') || list.find(e => (e.type||e.session_type) !== 'match') || list[0] || null;
      if (ev) { out.hasEvent = true; out.start_time = ev.start_time||null; out.duration = ev.duration_minutes||null; out.estimated_rpe = ev.estimated_rpe||null; out.opponent = ev.opponent||out.rival; }
    } catch (e) { console.error('cmResolveDayContext', e); }
    return out;
  };
})();
