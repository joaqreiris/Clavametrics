/* ============================================================
   Club Overview — motor de datos (real, desde Supabase).
   Agrega por SEMANA × EQUIPO: campo + gimnasio + partidos + carga.
   Fuentes: training_sessions, calendar_events(type=match), microcycles,
   player_teams, availability, rpe, load_plan, session_exercises.
   Acceso: solo dirección (bucket 'direction') + admin/owner + super-admin.
   ============================================================ */
(function () {
  'use strict';
  const sb = () => window.sb;
  function tt(k, fb, vars) { const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(k, vars) : null; return (v && v !== k) ? v : (fb != null ? fb : k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function safeUrl(u) { const s = String(u == null ? '' : u).trim(); return /^(https?:\/\/|\/|\.\/|#)/i.test(s) ? s : '#'; }
  function initials(n) { n = String(n || '').trim(); if (!n) return '•'; const p = n.split(/\s+/); return ((p[0][0] || '') + (p[1] ? p[1][0] : '')).toUpperCase(); }

  const state = { clubId: null, profile: null, teams: [], scopeTeam: '', refDate: new Date(), week: [], data: null, sel: null, kpi: null };

  // ── date helpers (locales, nunca UTC) ──
  function ymd(d) { return window.cmYMD ? window.cmYMD(d) : (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  function parseYMD(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { const off = (d.getDay() + 6) % 7; return addDays(d, -off); }
  function todayY() { return window.cmToday ? window.cmToday() : ymd(new Date()); }
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DOWFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function shortDate(y) { const d = parseYMD(y); return MON[d.getMonth()] + ' ' + d.getDate(); }
  function longDate(y) { const d = parseYMD(y); return tt('dowfull.' + d.getDay(), DOWFULL[d.getDay()]); }
  function relTime(ts) { if (!ts) return ''; try { const diff = (Date.now() - new Date(ts).getTime()) / 1000; if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm'; if (diff < 86400) return Math.round(diff / 3600) + 'h'; return Math.round(diff / 86400) + 'd'; } catch (_) { return ''; } }
  function relDay(y) { const t = todayY(); if (y === t) return tt('common.today', 'today'); return shortDate(y); }

  function buildWeek() { const mon = mondayOf(state.refDate); state.week = []; for (let i = 0; i < 7; i++) { const d = addDays(mon, i); state.week.push({ ymd: ymd(d), dn: DOW[i], dd: d.getDate() }); } }
  function weekLabel() { const a = parseYMD(state.week[0].ymd), b = parseYMD(state.week[6].ymd); if (a.getMonth() === b.getMonth()) return MON[a.getMonth()] + ' ' + a.getDate() + '–' + b.getDate(); return MON[a.getMonth()] + ' ' + a.getDate() + ' – ' + MON[b.getMonth()] + ' ' + b.getDate(); }
  function scopeTeams() { return state.scopeTeam ? state.teams.filter(t => t.id === state.scopeTeam) : state.teams; }

  // ── session type → clase visual + icono ──
  function evClass(t) { t = (t || '').toLowerCase(); if (t === 'match') return 'match'; if (t === 'gym') return 'gym'; if (t === 'recovery') return 'recovery'; return 'field'; }
  function evIcon(cls) { return cls === 'match' ? 'ti-ball-football' : cls === 'gym' ? 'ti-barbell' : cls === 'recovery' ? 'ti-heart' : cls === 'travel' ? 'ti-plane' : cls === 'other' ? 'ti-calendar-event' : 'ti-soccer-field'; }

  // ── calendar_events (no-partido) → bucket visual + icono + etiqueta ──
  // Bucket agrupa para color/leyenda; el icono es específico del tipo real.
  function calBucket(t) {
    t = (t || '').toLowerCase();
    if (t === 'recovery') return 'recovery';
    if (t === 'gym') return 'gym';
    if (t === 'tactical' || t === 'beach' || t === 'outdoor') return 'field';
    if (t === 'travel' || t === 'bus_departure' || t === 'bus_arrival' || t === 'hotel_checkin' || t === 'hotel_checkout') return 'travel';
    return 'other'; // meeting, meals, day_off, press, medical_check, video_session, walkthrough, scouting, evaluation, other
  }
  const CAL_ICONS = {
    travel: 'ti-plane', bus_departure: 'ti-bus', bus_arrival: 'ti-bus', hotel_checkin: 'ti-bed', hotel_checkout: 'ti-bed',
    meeting: 'ti-users', evaluation: 'ti-clipboard-list', video_session: 'ti-device-desktop',
    breakfast: 'ti-coffee', lunch: 'ti-soup', dinner: 'ti-tools-kitchen',
    press: 'ti-microphone', medical_check: 'ti-stethoscope', physio: 'ti-physotherapist', walkthrough: 'ti-walk', scouting: 'ti-binoculars',
    day_off: 'ti-beach', recovery: 'ti-heart-rate-monitor', gym: 'ti-barbell', tactical: 'ti-soccer-field', beach: 'ti-beach', outdoor: 'ti-run'
  };
  function calIcon(t) { t = (t || '').toLowerCase(); return CAL_ICONS[t] || 'ti-calendar-event'; }
  function calLabel(t) { t = (t || '').toLowerCase(); return tt('calendar.type_' + t, t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())); } // reusa etiquetas del Calendar
  function defaultTitle(cls) { return cls === 'gym' ? tt('club_overview.leg_gym', 'Gym') : cls === 'recovery' ? tt('club_overview.leg_recovery', 'Recovery') : cls === 'match' ? tt('club_overview.leg_match', 'Match') : tt('club_overview.leg_field', 'Field session'); }
  function fmtTime(t) { return t ? String(t).slice(0, 5) : ''; }
  function auOf(s) { return (s.duration && s.estimated_rpe) ? Math.round(s.duration * s.estimated_rpe) : 0; }
  function fmtHomeAway(h) { h = (h || '').toLowerCase(); return h === 'home' ? tt('common.home', 'Home') : h === 'away' ? tt('common.away', 'Away') : h === 'neutral' ? tt('common.neutral', 'Neutral') : ''; }

  // ── MD offset (por equipo y día) ──
  function mdDiffLabel(target, day) { const diff = Math.round((parseYMD(target) - parseYMD(day)) / 86400000); if (diff === 0) return 'MD'; if (diff > 0 && diff <= 10) return 'MD-' + diff; if (diff < 0 && diff >= -3) return 'MD+' + (-diff); return ''; }
  function mdNorm(v) { return window.cmMdNorm ? window.cmMdNorm(v) : String(v || ''); }
  // MD del día = la dinámica DEL EQUIPO: microciclo primero (override manual → fecha de partido),
  // igual que Calendar. El match_day_offset de cada sesión es la dinámica de ESE grupo (puede
  // haber dos el mismo día, ej. pretemporada) y se muestra aparte vía groupMdsFor()/mdBadge.
  function mdFor(teamId, y) {
    const mc = (state.data.micros || []).find(m => m.team_id === teamId && m.start_date <= y && m.end_date >= y);
    if (mc) {
      if (mc.md_overrides && mc.md_overrides[y]) return mdNorm(mc.md_overrides[y]);
      if (mc.match_date) return mdDiffLabel(mc.match_date, y);
    }
    const sess = (state.data.sessions || []).filter(s => s.team_id === teamId && s.session_date === y);
    for (const s of sess) { if (s.match_day_offset) return mdNorm(s.match_day_offset); }
    const wm = (state.data.matches || []).filter(x => x.team_id === teamId).map(x => x.date).sort();
    if (wm.length) return mdDiffLabel(wm[wm.length - 1], y);
    return '';
  }
  // MDs de grupo del día: los match_day_offset (normalizados) distintos del MD del día.
  function groupMdsFor(teamId, y, dayMd) {
    const out = [];
    (state.data.sessions || []).forEach(s => {
      if (s.team_id !== teamId || s.session_date !== y || !s.match_day_offset) return;
      const v = mdNorm(s.match_day_offset);
      if (v && v !== dayMd && !out.includes(v)) out.push(v);
    });
    return out;
  }
  function isPlanExpected(teamId, y) {
    const mc = (state.data.micros || []).find(m => m.team_id === teamId && m.start_date <= y && m.end_date >= y);
    if (!mc || !mc.match_date || y >= mc.match_date) return false;
    const md = mdDiffLabel(mc.match_date, y);
    return md === 'MD-1' || md === 'MD-2' || md === 'MD-3' || md === 'MD-4';
  }

  // ── eventos por celda (con dedup de partido calendar vs session) ──
  function cellEvents(teamId, y) {
    const evs = [];
    const cM = (state.data.matches || []).filter(m => m.team_id === teamId && m.date === y);
    const hasCal = cM.length > 0;
    (state.data.sessions || []).filter(s => s.team_id === teamId && s.session_date === y).forEach(s => {
      const cls = evClass(s.session_type);
      if (cls === 'match' && hasCal) return;
      evs.push({ cls, kind: 'session', icon: evIcon(cls), title: s.title || defaultTitle(cls), time: fmtTime(s.session_time), dur: s.duration, au: auOf(s), sid: s.id, stype: s.session_type, gym: s.gym_content, mdo: s.match_day_offset || null });
    });
    // Resto de eventos del calendario: viajes, comidas, reuniones, día libre, etc.
    (state.data.calevents || []).filter(c => c.team_id === teamId && c.date === y).forEach(c => {
      const cls = calBucket(c.type);
      evs.push({ cls, kind: 'cal', info: true, icon: calIcon(c.type), title: c.title || calLabel(c.type), time: fmtTime(c.start_time), endTime: fmtTime(c.end_time), etype: c.type, loc: c.location || '', notes: c.notes || '', dur: c.duration_minutes || null, cid: c.id });
    });
    cM.forEach(m => evs.push({ cls: 'match', kind: 'match', info: true, icon: 'ti-ball-football', title: m.opponent ? ('vs ' + m.opponent) : (m.title || tt('club_overview.leg_match', 'Match')), time: fmtTime(m.start_time), meta: m.home_away || '', loc: m.location || '', mid: m.id }));
    // Orden: cronológico por hora (sin hora → al final); a igual hora: sesión → logística → partido.
    const rank = e => e.kind === 'match' ? 2 : e.kind === 'cal' ? 1 : 0;
    evs.sort((a, b) => { const ta = a.time || '99:99', tb = b.time || '99:99'; return ta < tb ? -1 : ta > tb ? 1 : rank(a) - rank(b); });
    // Badge MD de grupo: cuando la sesión tiene su propio MD distinto del MD del día.
    const dayMd = mdFor(teamId, y);
    evs.forEach(ev => { if (ev.kind === 'session' && ev.mdo) { const v = mdNorm(ev.mdo); if (v && v !== dayMd) ev.mdBadge = v; } });
    return evs;
  }
  function rosterCount(teamId) { const s = new Set(); (state.data.pteams || []).forEach(p => { if (p.team_id === teamId) s.add(String(p.player_id)); }); return s.size; }

  // ── FETCH de la semana ──
  async function fetchWeek() {
    const cid = state.clubId, from = state.week[0].ymd, to = state.week[6].ymd, today = todayY();
    const run = p => p.then(r => (r && r.data) ? r.data : []).catch(() => []);

    let sessQ = sb().from('training_sessions').select('id,team_id,title,session_type,session_date,session_time,duration,estimated_rpe,match_day_offset,gym_content').eq('club_id', cid).eq('is_historical', false).gte('session_date', from).lte('session_date', to);
    // Todos los eventos del calendario (no solo partidos): viajes, comidas, reuniones, día libre, etc.
    let calQ = sb().from('calendar_events').select('id,team_id,date,start_time,end_time,title,opponent,home_away,competition,type,location,notes,duration_minutes').eq('club_id', cid).gte('date', from).lte('date', to);
    let mcQ = sb().from('microcycles').select('id,team_id,match_date,md_overrides,start_date,end_date').eq('club_id', cid).lte('start_date', to).gte('end_date', from);
    let lpQ = sb().from('load_plan').select('plan_date,metric,pct').eq('club_id', cid).gte('plan_date', from).lte('plan_date', to);
    if (state.scopeTeam) { sessQ = sessQ.eq('team_id', state.scopeTeam); calQ = calQ.eq('team_id', state.scopeTeam); mcQ = mcQ.eq('team_id', state.scopeTeam); lpQ = lpQ.eq('team_id', state.scopeTeam); }
    const ptQ = sb().from('player_teams').select('player_id,team_id').eq('club_id', cid);
    const avQ = sb().from('availability').select('player_id,status,team_id,notes').eq('club_id', cid).eq('date', today);
    const rpeQ = sb().from('rpe').select('session_id,player_id,load,session_date').eq('club_id', cid).gte('session_date', from).lte('session_date', to);
    const plQ = sb().from('players').select('id,first_name,last_name,position,team_id').eq('club_id', cid).is('archived_at', null);
    // Lesiones abiertas (para el panel de regreso): club-wide, no acotadas a la semana; scope por equipo client-side.
    const injQ = sb().from('injuries').select('player_id,injury_type,body_area,severity,status,expected_return,start_date').eq('club_id', cid).in('status', ['active', 'returning']);
    // Wellness de hoy vía RPC: ya excluye a quien no se esperaba que responda (enfermo/no disponible/selección).
    const tzoff = new Date().getTimezoneOffset();
    const wellQ = sb().rpc('wellness_status', { p_club_id: cid, p_team_id: state.scopeTeam || null, p_date: today, p_tz_offset: tzoff });

    const [sessions, cal, micros, pteams, avail, rpe, lplan, players, injuries, wellness] = await Promise.all([run(sessQ), run(calQ), run(mcQ), run(ptQ), run(avQ), run(rpeQ), run(lpQ), run(plQ), run(injQ), run(wellQ)]);
    const isMatch = e => (e.type || '').toLowerCase() === 'match';
    const matches = (cal || []).filter(isMatch);       // subconjunto de partidos (dedup + mdFor)
    const calevents = (cal || []).filter(e => !isMatch(e)); // resto: viajes, comidas, reuniones, etc.
    const pmap = {}; (players || []).forEach(p => { pmap[String(p.id)] = p; });
    state.data = { sessions, matches, calevents, micros, pteams, avail, rpe, lplan, players, injuries, wellness, pmap, today };
  }
  function playerName(id) { const p = state.data && state.data.pmap ? state.data.pmap[String(id)] : null; if (!p) return ''; return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || ''; }

  // ── KPIs ──
  function computeKpis() {
    const D = state.data, teams = scopeTeams(), ids = new Set(teams.map(t => t.id));
    let events = 0, auSum = 0, auN = 0, noPlan = 0;
    teams.forEach(t => state.week.forEach(d => {
      const evs = cellEvents(t.id, d.ymd); events += evs.filter(e => e.kind !== 'cal').length; // logística no cuenta como sesión
      evs.forEach(e => { if (e.au) { auSum += e.au; auN++; } });
      if (!evs.length && isPlanExpected(t.id, d.ymd)) noPlan++;
    }));
    const avgLoad = auN ? Math.round(auSum / auN) : 0;

    const roster = new Set(); (D.pteams || []).forEach(p => { if (ids.has(p.team_id)) roster.add(String(p.player_id)); });
    const total = roster.size;
    const OUT = new Set(['injured', 'sick', 'unavailable', 'away']), INJ = new Set(['injured', 'sick']);
    const outSet = new Set(), injSet = new Set();
    (D.avail || []).forEach(a => { const pid = String(a.player_id); if (!roster.has(pid)) return; const st = (a.status || '').toLowerCase(); if (OUT.has(st)) outSet.add(pid); if (INJ.has(st)) injSet.add(pid); });
    const out = outSet.size, injured = injSet.size, available = Math.max(0, total - out);
    const injIds = [...injSet], otherIds = [...outSet].filter(id => !injSet.has(id));

    let ep = '—', epPct = 0;
    if ((D.lplan || []).length) { const avg = D.lplan.reduce((a, r) => a + (Number(r.pct) || 0), 0) / D.lplan.length; ep = (avg / 100).toFixed(2); epPct = Math.max(0, Math.min(100, Math.round(avg))); }

    const rosterByTeam = {}; (D.pteams || []).forEach(p => { (rosterByTeam[p.team_id] = rosterByTeam[p.team_id] || new Set()).add(String(p.player_id)); });
    const rpeBySession = {}; (D.rpe || []).forEach(r => { if (!r.session_id) return; (rpeBySession[r.session_id] = rpeBySession[r.session_id] || new Set()).add(String(r.player_id)); });
    let exp = 0, got = 0;
    (D.sessions || []).filter(s => evClass(s.session_type) !== 'match' && ids.has(s.team_id) && s.session_date <= D.today).forEach(s => {
      const n = (rosterByTeam[s.team_id] ? rosterByTeam[s.team_id].size : 0); exp += n;
      got += Math.min(n, rpeBySession[s.id] ? rpeBySession[s.id].size : 0);
    });
    const comp = exp ? Math.round(got / exp * 100) : null;

    return { sessions: events, noPlan, avgLoad, total, available, out, injured, injIds, otherIds, ep, epPct, comp };
  }

  // ── Wellness de hoy (readiness = estado; distinto del cumplimiento de RPE) ──
  function wellnessStats() {
    const W = state.data && state.data.wellness ? state.data.wellness : [];
    const responded = W.filter(w => w.responded);
    const rd = responded.map(w => Number(w.readiness)).filter(n => !isNaN(n));
    const avg = rd.length ? (rd.reduce((a, b) => a + b, 0) / rd.length) : null;
    const flags = responded.filter(w => w.readiness != null && Number(w.readiness) <= 4);
    return { total: W.length, respN: responded.length, avg: avg, flags: flags };
  }

  function renderPulse() {
    const k = state.kpi || (state.kpi = computeKpis());
    const w = wellnessStats();
    const wSub = (w.respN === 0
      ? '<span class="co-chip neutral">' + tt('club_overview.no_wellness', 'No check-ins') + '</span>'
      : (w.flags.length > 0
        ? '<span class="co-chip bad"><i class="ti ti-alert-triangle"></i>' + w.flags.length + ' ' + tt('club_overview.w_flags', 'in the red') + '</span>'
        : '<span class="co-chip good"><i class="ti ti-check"></i>' + tt('club_overview.w_ok', 'All green') + '</span>')
      ) + '<span class="co-chip neutral">' + w.respN + '/' + w.total + '</span>';
    const availSub = k.out === 0
      ? '<span class="co-chip good"><i class="ti ti-check"></i>' + tt('club_overview.all_available', 'All available') + '</span>'
      : (k.injured > 0 ? '<span class="co-chip warn">' + k.injured + ' ' + tt('club_overview.injured', 'injured') + '</span>' : '') + ((k.out - k.injured) > 0 ? '<span class="co-chip neutral">' + (k.out - k.injured) + ' ' + tt('club_overview.other', 'other') + '</span>' : '');
    const cards = [
      { ic: 'ti-calendar-stats', col: 'var(--cm-accent)', bg: 'var(--cm-accent-soft)', lbl: tt('club_overview.k_sessions', 'Sessions this week'), val: String(k.sessions), sub: k.noPlan > 0 ? '<span class="co-chip warn"><i class="ti ti-alert-triangle"></i>' + k.noPlan + ' ' + tt('club_overview.no_plan', 'no plan') + '</span>' : '<span class="co-chip good"><i class="ti ti-check"></i>' + tt('club_overview.all_planned', 'All planned') + '</span>' },
      { ic: 'ti-users-group', col: 'var(--cm-info)', bg: 'var(--cm-info-bg)', lbl: tt('club_overview.k_available', 'Squad available'), val: k.available + '<small>/' + k.total + '</small>', sub: availSub },
      { ic: 'ti-chart-line', col: 'var(--cm-violet)', bg: 'var(--cm-violet-bg)', lbl: tt('club_overview.k_load', 'Avg session load'), val: k.avgLoad + '<small> AU</small>', bar: { p: Math.min(100, k.avgLoad ? Math.round(k.avgLoad / 900 * 100) : 0), c: 'var(--cm-violet)' } },
      { ic: 'ti-chart-histogram', col: 'var(--cm-accent)', bg: 'var(--cm-accent-soft)', lbl: tt('club_overview.k_ep', 'Weekly E:P ratio'), val: k.ep, bar: k.ep !== '—' ? { p: k.epPct, c: 'var(--cm-accent)' } : null },
      { ic: 'ti-activity', col: 'var(--cm-danger)', bg: 'var(--cm-danger-bg)', lbl: tt('club_overview.k_rpe', 'RPE compliance'), val: (k.comp == null ? '—' : k.comp + '<small>%</small>'), bar: k.comp == null ? null : { p: k.comp, c: k.comp >= 85 ? 'var(--cm-success)' : 'var(--cm-warning)' } },
      { ic: 'ti-battery-charging', col: 'var(--cm-info)', bg: 'var(--cm-info-bg)', lbl: tt('club_overview.k_wellness', 'Wellness / readiness'), val: (w.avg == null ? '—' : w.avg.toFixed(1) + '<small>/10</small>'), sub: wSub, bar: w.avg == null ? null : { p: Math.round(w.avg * 10), c: w.avg >= 6 ? 'var(--cm-success)' : w.avg >= 4 ? 'var(--cm-warning)' : 'var(--cm-danger)' } }
    ];
    document.getElementById('coPulse').innerHTML = cards.map(c => '<div class="co-kpi"><div class="kt"><div class="ki" style="background:' + c.bg + ';color:' + c.col + '"><i class="ti ' + c.ic + '"></i></div><div class="kl">' + c.lbl + '</div></div><div class="kv">' + c.val + '</div>' + (c.sub ? '<div class="ks">' + c.sub + '</div>' : '') + (c.bar ? '<div class="co-track"><span style="width:' + c.bar.p + '%;background:' + c.bar.c + '"></span></div>' : '') + '</div>').join('');
  }

  // ── SCHEDULE GRID ──
  function evKey(e) { return e.sid ? ('s:' + e.sid) : (e.mid ? ('m:' + e.mid) : (e.cid ? ('c:' + e.cid) : '')); }
  function evMeta(e) {
    if (e.kind === 'match') return [fmtHomeAway(e.meta), e.time].filter(Boolean).join(' · ');
    if (e.kind === 'cal') return [e.time, e.loc].filter(Boolean).join(' · ');
    return [e.mdBadge, e.time, e.dur ? e.dur + '′' : '', e.au ? e.au + ' AU' : ''].filter(Boolean).join(' · ');
  }
  function evHtml(e) {
    const meta = evMeta(e);
    return '<div class="co-ev ' + e.cls + '" data-key="' + evKey(e) + '" role="button" tabindex="0"><div class="et"><i class="ti ' + (e.icon || evIcon(e.cls)) + '"></i>' + esc(e.title) + '</div>' + (meta ? '<div class="em">' + esc(meta) + '</div>' : '') + '</div>';
  }
  function renderGrid() {
    const teams = scopeTeams();
    let h = '<div class="co-row head"><div class="co-dc"></div>';
    state.week.forEach(d => { h += '<div class="co-dc"><div class="dn">' + tt('dow.' + d.dn.toLowerCase(), d.dn) + '</div><div class="dd">' + d.dd + '</div></div>'; });
    h += '</div>';
    if (!teams.length) { document.getElementById('coSched').innerHTML = h + '<div class="co-muted" style="padding:24px">' + tt('club_overview.no_teams', 'No teams found.') + '</div>'; return; }
    teams.forEach(t => {
      h += '<div class="co-row"><div class="co-rl"><div class="tn">' + esc(t.name) + '</div><div class="tm">' + rosterCount(t.id) + ' ' + tt('common.players', 'players') + '</div></div>';
      state.week.forEach(d => {
        const evs = cellEvents(t.id, d.ymd), md = mdFor(t.id, d.ymd);
        const gmds = groupMdsFor(t.id, d.ymd, md);
        const mdHtml = (md ? '<span class="co-md' + (md === 'MD' ? ' md0' : '') + '">' + md + '</span>' : '')
          + gmds.map(v => '<span class="co-md md2" title="' + tt('club_overview.group_md_hint', 'Group MD — set per session in Daily Planning') + '">' + v + '</span>').join('');
        let inner;
        if (evs.length) inner = evs.map(evHtml).join('');
        else if (isPlanExpected(t.id, d.ymd)) inner = '<div class="co-noplan"><i class="ti ti-alert-triangle"></i>' + tt('club_overview.no_plan', 'No plan yet') + '</div>';
        else inner = '<div class="co-empty-cell"></div>';
        h += '<div class="co-cell' + (evs.length ? ' clk' : '') + '" data-team="' + t.id + '" data-ymd="' + d.ymd + '">' + mdHtml + inner + '</div>';
      });
      h += '</div>';
    });
    document.getElementById('coSched').innerHTML = h;
  }

  // ── DAY DETAIL ──
  function sh(bg, col, icon, title, sub) { return '<div class="co-sh"><div class="si" style="background:' + bg + ';color:' + col + '"><i class="ti ' + icon + '"></i></div><div class="st">' + esc(title) + '</div>' + (sub ? '<div class="sd">' + esc(sub) + '</div>' : '') + '</div>'; }
  function pitchHtml() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const turf = dark ? '#0e2417' : '#e7f4ec', line = dark ? 'rgba(255,255,255,.35)' : 'rgba(21,128,61,.5)';
    return '<div class="co-pitch"><svg viewBox="0 0 100 62" preserveAspectRatio="none" style="width:100%;height:100%;background:' + turf + '"><g stroke="' + line + '" stroke-width="0.8" fill="none"><rect x="2" y="2" width="96" height="58"/><line x1="50" y1="2" x2="50" y2="60"/><circle cx="50" cy="31" r="9"/><rect x="2" y="16" width="14" height="30"/><rect x="84" y="16" width="14" height="30"/><rect x="2" y="24" width="6" height="14"/><rect x="92" y="24" width="6" height="14"/></g></svg></div>';
  }
  // gym_content real: { warmup:{min,blocks:[{label,rows}]}, plyo:{min,rows}, main:{min,rows} }.
  // Cada row {v:[name,sets,reps,load,rest,...], exId}. v[0] = nombre.
  function gymSectionRows(sec) { if (!sec) return []; if (Array.isArray(sec.blocks)) { const out = []; sec.blocks.forEach(b => (b.rows || []).forEach(r => out.push(r))); return out; } return sec.rows || []; }
  function gymRowsFlat(gc) {
    if (!gc || typeof gc !== 'object') return [];
    const secs = [['warmup', tt('club_overview.gym_warmup', 'Warm-up')], ['plyo', tt('club_overview.gym_plyo', 'Plyometrics')], ['main', tt('club_overview.gym_main', 'Main work')]];
    const out = [];
    secs.forEach(pair => gymSectionRows(gc[pair[0]]).forEach(r => {
      const v = Array.isArray(r) ? r : (r && r.v) || [];
      const name = (v[0] != null ? String(v[0]) : '').trim() || (r && r.libName) || '';
      if (!name) return;
      const params = v.slice(1).map(x => x == null ? '' : String(x).trim()).filter(Boolean).join(' · ');
      out.push({ secKey: pair[0], section: pair[1], name: name, params: params, exId: (r && r.exId) || null });
    }));
    return out;
  }
  // Secciones de campo (por training_sessions phase). GK siempre al final.
  const FIELD_PHASES = [['warmup', 'gym_warmup', 'Warm-up'], ['activation', 'ph_activation', 'Activation'], ['main', 'gym_main', 'Main work'], ['cooldown', 'cooldown', 'Cooldown'], ['goalkeepers', 'gk', 'GKs']];
  function fieldPhase(ph) { ph = (ph || 'main').toLowerCase(); return FIELD_PHASES.find(p => p[0] === ph) || FIELD_PHASES[2]; }
  function fieldSecKey(ph) { return fieldPhase(ph)[0]; }
  function fieldPhaseLabel(ph) { const p = fieldPhase(ph); return tt('club_overview.' + p[1], p[2]); }
  const FIELD_ORDER = { warmup: 0, activation: 1, main: 2, cooldown: 3, goalkeepers: 4 };
  function teamWeekMaxAu(teamId) { let mx = 0; state.week.forEach(d => cellEvents(teamId, d.ymd).forEach(e => { if (e.au > mx) mx = e.au; })); return mx || 1; }
  function meterHtml(au, teamId) { const pct = Math.min(100, Math.round(au / teamWeekMaxAu(teamId) * 100)); return '<div class="co-meter"><div class="mr"><span class="ml">' + tt('club_overview.planned_load', 'Planned session load') + '</span><span class="mv">' + au + ' AU</span></div><div class="co-mtrack"><span style="width:' + pct + '%"></span></div></div>'; }

  // ── preview images (drills → bucket drill-previews; gym → gym-exercise-media) ──
  const _pngCache = {}, _gxCache = {}, _gymImg = {};
  async function resolveDrillPngs(ids) {
    const need = [...new Set((ids || []).filter(id => id && !(id in _pngCache)))];
    if (!need.length) return;
    try {
      const { data: rows } = await sb().from('exercises').select('id,preview_path,preview_png').eq('club_id', state.clubId).in('id', need);
      const paths = (rows || []).filter(r => r.preview_path).map(r => r.preview_path);
      let signed = {};
      if (paths.length) { const { data: urls } = await sb().storage.from('drill-previews').createSignedUrls(paths, 3600); (urls || []).forEach(u => { if (u && u.path && u.signedUrl) signed[u.path] = u.signedUrl; }); }
      (rows || []).forEach(r => { _pngCache[r.id] = r.preview_path ? (signed[r.preview_path] || null) : (r.preview_png || null); });
    } catch (_) {}
    need.forEach(id => { if (!(id in _pngCache)) _pngCache[id] = null; });
  }
  async function resolveGymImgs(exIds) {
    const need = [...new Set((exIds || []).filter(id => id && !(id in _gxCache)))];
    if (need.length) { try { const { data } = await sb().from('gym_exercises').select('id,name,media_type,media_ref,video_id,video_url').in('id', need); (data || []).forEach(g => { _gxCache[g.id] = g; }); } catch (_) {} need.forEach(id => { if (!(id in _gxCache)) _gxCache[id] = null; }); }
    const refs = [...new Set((exIds || []).map(id => _gxCache[id]).filter(g => g && g.media_type === 'image' && g.media_ref && !(g.media_ref in _gymImg)).map(g => g.media_ref))];
    if (refs.length) { try { const { data: urls } = await sb().storage.from('gym-exercise-media').createSignedUrls(refs, 3600); (urls || []).forEach(u => { if (u && u.path) _gymImg[u.path] = u.signedUrl; }); } catch (_) {} }
  }
  function videoEmbed(url) {
    const u = String(url || '').trim(); if (!u) return null;
    let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return { embed: 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&mute=1&rel=0&playsinline=1', yt: m[1] };
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { embed: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1&muted=1' };
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) return { embed: u, file: true };
    return null;
  }
  // Media de un ejercicio de gym: preferimos VIDEO si hay; si no, imagen.
  function gymMediaFor(exId) {
    const g = _gxCache[exId]; if (!g) return null;
    let emb = null, yt = null, file = false;
    if (g.video_url) { const v = videoEmbed(g.video_url); if (v) { emb = v.embed; yt = v.yt || null; file = !!v.file; } }
    if (!emb && g.video_id) { emb = 'https://www.youtube.com/embed/' + g.video_id + '?autoplay=1&mute=1&rel=0&playsinline=1'; yt = g.video_id; }
    const imgSrc = (g.media_type === 'image' && g.media_ref) ? (_gymImg[g.media_ref] || null) : null;
    if (emb) return { type: 'video', embed: emb, file: file, thumb: yt ? ('https://img.youtube.com/vi/' + yt + '/mqdefault.jpg') : imgSrc };
    if (imgSrc) return { type: 'image', src: imgSrc };
    return null;
  }
  function imgHtml(src) { return '<img src="' + esc(src) + '" alt="" style="width:100%;height:100%;object-fit:contain;background:var(--cm-bg-sunk)">'; }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s); }

  function drillParams(r) {
    if (r.series && r.work_time) return r.series + '×' + r.work_time + ' ' + tt('club_overview.work', 'work') + ' + ' + (r.rest_time || '—') + ' ' + tt('club_overview.rest', 'rest');
    if ((r.dose_mode === 'reps') || (r.series && r.reps != null && r.reps !== '')) return (r.series || '') + '×' + (r.reps || '') + ' ' + tt('club_overview.reps', 'reps') + (r.duration ? (' · ' + r.duration + '′') : '');
    return r.duration ? (r.duration + '′') : '';
  }
  function paramPanel(pairs) { const list = pairs.filter(p => p[1] != null && p[1] !== ''); if (!list.length) return ''; return '<div class="co-params">' + list.map(p => '<div class="pp"><span class="k">' + esc(p[0]) + '</span><span class="v">' + esc(p[1]) + '</span></div>').join('') + '</div>'; }
  function exRow(i, name, params) { return '<button class="co-exrow" data-i="' + i + '"><span class="rn">' + (i + 1) + '</span><span class="rl"><b>' + esc(name) + '</b>' + (params ? '<span class="pm">' + esc(params) + '</span>' : '') + '</span><i class="ti ti-chevron-right rc"></i></button>'; }

  async function loadFieldEx(sid) {
    const list = document.getElementById('coExList'); if (!list) return;
    list.innerHTML = '<div class="co-muted" style="padding:8px">' + tt('common.loading', 'Loading…') + '</div>';
    let rows = [];
    try { const { data } = await sb().from('session_exercises').select('id,name,phase,duration,series,work_time,rest_time,dose_mode,reps,intensity,field_width,field_height,players_count,planner_exercise_id').eq('session_id', sid).order('position', { ascending: true }); rows = data || []; } catch (_) {}
    if (state._sid !== sid) return;
    if (!rows.length) { list.innerHTML = '<div class="co-muted" style="padding:8px">' + tt('club_overview.no_exercises', 'No exercises in this session yet.') + '</div>'; document.getElementById('coExParams').innerHTML = ''; return; }
    rows.forEach(r => { r.secKey = fieldSecKey(r.phase); r.section = fieldPhaseLabel(r.phase); });
    rows.sort((a, b) => (FIELD_ORDER[a.secKey] - FIELD_ORDER[b.secKey]));   // Array.sort estable → mantiene position dentro de cada fase
    state._ex = rows; state._exKind = 'field';
    resolveDrillPngs(rows.map(r => r.planner_exercise_id));
    renderExList();
  }
  function selectFieldDrill(i) {
    const r = (state._ex || [])[i]; if (!r) return;
    state._exSel = i;
    document.querySelectorAll('.co-exrow.on').forEach(x => x.classList.remove('on'));
    const btn = document.querySelector('.co-exrow[data-i="' + i + '"]'); if (btn) btn.classList.add('on');
    const pv = document.getElementById('coPreview'), pid = r.planner_exercise_id, png = pid ? _pngCache[pid] : null;
    if (png) pv.innerHTML = imgHtml(png);
    else if (pid && !(pid in _pngCache)) { pv.innerHTML = pitchHtml(); resolveDrillPngs([pid]).then(() => { if (state._exSel === i) { const u = _pngCache[pid]; if (u) pv.innerHTML = imgHtml(u); } }); }
    else pv.innerHTML = pitchHtml();
    const fld = (r.field_width && r.field_height) ? (r.field_width + '×' + r.field_height + 'm') : '';
    document.getElementById('coExParams').innerHTML = paramPanel([
      [tt('club_overview.series', 'Series'), r.series], [tt('club_overview.work', 'Work'), r.work_time], [tt('club_overview.rest', 'Rest'), r.rest_time],
      [tt('club_overview.reps', 'Reps'), (r.reps != null && r.reps !== '') ? r.reps : ''], [tt('common.duration', 'Duration'), r.duration ? r.duration + '′' : ''],
      [tt('club_overview.intensity', 'Intensity'), r.intensity], [tt('club_overview.players_n', 'Players'), r.players_count], [tt('club_overview.area', 'Area'), fld]
    ]);
  }
  function renderGymEx(gc) {
    const rows = gymRowsFlat(gc);
    if (!rows.length) { document.getElementById('coExList').innerHTML = '<div class="co-muted" style="padding:8px">' + tt('club_overview.gym_planned', 'Gym session planned') + '</div>'; document.getElementById('coExParams').innerHTML = ''; return; }
    state._ex = rows; state._exKind = 'gym';
    resolveGymImgs(rows.map(r => r.exId)).then(() => { if (state._exKind === 'gym' && state._exSel != null) selectGymEx(state._exSel); });
    renderExList();
  }
  // Lista agrupada por sección + barra de filtro + scroll. Común a campo y gimnasio.
  function loadHiddenSecs() { try { return new Set(JSON.parse(localStorage.getItem('co_hide_sec') || '[]')); } catch (_) { return new Set(); } }
  function saveHiddenSecs(set) { try { localStorage.setItem('co_hide_sec', JSON.stringify([...set])); } catch (_) {} }
  function renderExList() {
    const list = document.getElementById('coExList'); if (!list) return;
    const rows = state._ex || [];
    if (!rows.length) { list.innerHTML = ''; return; }
    const hidden = loadHiddenSecs(), order = [], lbl = {};
    rows.forEach(r => { if (!(r.secKey in lbl)) { lbl[r.secKey] = r.section; order.push(r.secKey); } });
    let bar = '';
    if (order.length > 1) bar = '<div class="co-secbar">' + order.map(k => '<button class="co-secchip' + (hidden.has(k) ? '' : ' on') + '" data-sec="' + esc(k) + '">' + esc(lbl[k]) + '</button>').join('') + '</div>';
    let cur = null, h = '';
    rows.forEach((r, i) => { if (hidden.has(r.secKey)) return; if (r.secKey !== cur) { cur = r.secKey; h += '<div class="co-exsec">' + esc(r.section) + '</div>'; } h += exRow(i, r.name || ('Drill ' + (i + 1)), state._exKind === 'gym' ? r.params : drillParams(r)); });
    if (!h) h = '<div class="co-muted" style="padding:8px">' + tt('club_overview.section_hidden', 'All sections hidden.') + '</div>';
    list.innerHTML = bar + '<div class="co-exscroll">' + h + '</div>';
    const first = rows.findIndex(r => !hidden.has(r.secKey));
    if (first >= 0) { state._exKind === 'gym' ? selectGymEx(first) : selectFieldDrill(first); }
    else { document.getElementById('coExParams').innerHTML = ''; const pv = document.getElementById('coPreview'); if (pv) pv.innerHTML = state._exKind === 'gym' ? '<div class="co-pvph"><i class="ti ti-barbell"></i></div>' : pitchHtml(); }
  }
  function toggleSection(secKey) {
    const hidden = loadHiddenSecs();
    if (hidden.has(secKey)) hidden.delete(secKey); else hidden.add(secKey);
    saveHiddenSecs(hidden); renderExList();
  }
  function selectGymEx(i) {
    const r = (state._ex || [])[i]; if (!r) return;
    state._exSel = i;
    document.querySelectorAll('.co-exrow.on').forEach(x => x.classList.remove('on'));
    const btn = document.querySelector('.co-exrow[data-i="' + i + '"]'); if (btn) btn.classList.add('on');
    const pv = document.getElementById('coPreview'), media = r.exId ? gymMediaFor(r.exId) : null;
    if (media && media.type === 'video') {
      const poster = media.thumb ? '<img src="' + esc(media.thumb) + '" alt="">' : '<div class="co-pvph"><i class="ti ti-barbell"></i></div>';
      pv.innerHTML = '<div class="co-vidwrap" data-embed="' + encodeURIComponent(media.embed) + '" data-file="' + (media.file ? 1 : 0) + '">' + poster + '<button class="co-play" aria-label="' + esc(tt('club_overview.play', 'Play video')) + '"><i class="ti ti-player-play-filled"></i></button></div>';
    } else if (media && media.type === 'image') { pv.innerHTML = imgHtml(media.src); }
    else pv.innerHTML = '<div class="co-pvph"><i class="ti ti-barbell"></i></div>';
    document.getElementById('coExParams').innerHTML = r.params ? paramPanel([[r.section, r.params]]) : '';
  }

  function evColors(cls) {
    if (cls === 'match') return ['var(--cm-danger-bg)', 'var(--cm-danger)'];
    if (cls === 'gym') return ['var(--cm-info-bg)', 'var(--cm-info)'];
    if (cls === 'recovery') return ['var(--cm-violet-bg)', 'var(--cm-violet)'];
    if (cls === 'travel') return ['var(--cm-warning-bg)', 'var(--cm-warning)'];
    if (cls === 'other') return ['var(--cm-neutral-bg)', 'var(--cm-neutral)'];
    return ['var(--cm-accent-soft)', 'var(--cm-accent)'];
  }
  // Detalle de un evento sin ejercicios (partido / logística): lugar, horario, notas.
  function infoEventHtml(e) {
    const [bg, col] = evColors(e.cls);
    const isMatch = e.kind === 'match';
    const label = isMatch ? tt('club_overview.matchday', 'Matchday') : calLabel(e.etype);
    const timeStr = [e.time, e.endTime].filter(Boolean).join(' – ');
    const metaTop = isMatch ? [fmtHomeAway(e.meta), timeStr].filter(Boolean).join(' · ') : timeStr;
    let html = sh(bg, col, e.icon || evIcon(e.cls), label + ' · ' + e.title, metaTop);
    const rows = [];
    if (isMatch && e.meta) rows.push([tt('club_overview.venue', 'Venue'), fmtHomeAway(e.meta)]);
    if (e.loc) rows.push([tt('common.location', 'Location'), e.loc]);
    if (!isMatch && e.dur) rows.push([tt('common.duration', 'Duration'), e.dur + '′']);
    let list = rows.length ? '<div class="co-list">' + rows.map(r => '<div class="co-li"><span class="lt">' + esc(r[0]) + '</span><span class="ld">' + esc(r[1]) + '</span></div>').join('') + '</div>' : '';
    if (e.notes) list += '<div class="co-evnote">' + esc(e.notes) + '</div>';
    if (!list) list = '<div class="co-muted" style="padding:12px">' + tt('club_overview.no_detail', 'No extra detail for this event.') + '</div>';
    return html + list;
  }
  function renderSession(e, teamId, y) {
    const team = state.teams.find(t => t.id === teamId), md = mdFor(teamId, y);
    document.getElementById('coDetailTitle').textContent = (team ? team.name : '') + ' · ' + longDate(y);
    const mdEl = document.getElementById('coDetailMd');
    if (md) { mdEl.style.display = ''; mdEl.textContent = md; mdEl.className = 'mdtag' + (md === 'MD' ? ' md0' : ''); } else mdEl.style.display = 'none';
    const body = document.getElementById('coDetailBody'), foot = document.getElementById('coDetailFoot');
    if (!e) { body.innerHTML = '<div class="co-muted">' + tt('club_overview.empty_day', 'No sessions planned') + '</div>'; foot.style.display = 'none'; return; }
    // Partido / logística: ficha de info (sin cancha ni ejercicios).
    if (e.info) { body.innerHTML = infoEventHtml(e); foot.style.display = ''; wireCalFoot(teamId, y); state._sid = null; state._ex = []; state._exSel = null; state._exKind = null; return; }
    const cls = e.cls;
    const bg = cls === 'match' ? 'var(--cm-danger-bg)' : cls === 'gym' ? 'var(--cm-info-bg)' : cls === 'recovery' ? 'var(--cm-violet-bg)' : 'var(--cm-accent-soft)';
    const col = cls === 'match' ? 'var(--cm-danger)' : cls === 'gym' ? 'var(--cm-info)' : cls === 'recovery' ? 'var(--cm-violet)' : 'var(--cm-accent)';
    const label = cls === 'match' ? tt('club_overview.matchday', 'Matchday') : cls === 'gym' ? tt('club_overview.leg_gym', 'Gym') : cls === 'recovery' ? tt('club_overview.leg_recovery', 'Recovery') : tt('club_overview.leg_field', 'Field');
    const meta = e.kind === 'match' ? [fmtHomeAway(e.meta), e.time].filter(Boolean).join(' · ') : [e.mdBadge, e.time, e.dur ? e.dur + '′' : '', e.au ? e.au + ' AU' : ''].filter(Boolean).join(' · ');
    let html = sh(bg, col, evIcon(cls), label + ' · ' + e.title, meta);
    html += '<div class="co-preview" id="coPreview">' + (cls === 'gym' ? '<div class="co-pvph"><i class="ti ti-barbell"></i></div>' : pitchHtml()) + '</div>';
    html += '<div class="co-exlist" id="coExList"></div><div id="coExParams"></div>';
    html += meterHtml(e.au || 0, teamId);
    body.innerHTML = html;
    foot.style.display = '';
    wireFoot(teamId, y);
    state._sid = e.sid || null; state._ex = []; state._exSel = null; state._exKind = null;
    if (cls === 'gym') renderGymEx(e.gym);
    else if (e.sid) loadFieldEx(e.sid);
    else { document.getElementById('coExList').innerHTML = ''; }
  }
  function goCal(page, teamId, y) { try { sessionStorage.setItem('cal_active_team', teamId); localStorage.setItem('cal_active_team', teamId); } catch (_) {} location.href = page + '?date=' + y; }
  function wireFoot(teamId, y) {
    const f = document.getElementById('coOpenField'), g = document.getElementById('coOpenGym');
    g.style.display = ''; // restaurar tras un evento de logística
    const fi = f.querySelector('i'), fs = f.querySelector('span');
    if (fi) fi.className = 'ti ti-eye';
    if (fs) fs.textContent = tt('club_overview.open_field', 'Open Daily Planning');
    f.onclick = e => { e.preventDefault(); goCal('Daily%20Planning.html', teamId, y); };
    g.onclick = e => { e.preventDefault(); goCal('Gym%20Planner.html', teamId, y); };
  }
  // Pie para partidos/logística: un solo botón hacia el Calendar.
  function wireCalFoot(teamId, y) {
    const f = document.getElementById('coOpenField'), g = document.getElementById('coOpenGym');
    g.style.display = 'none';
    const fi = f.querySelector('i'), fs = f.querySelector('span');
    if (fi) fi.className = 'ti ti-calendar';
    if (fs) fs.textContent = tt('club_overview.open_calendar', 'Open Calendar');
    f.onclick = e => { e.preventDefault(); goCal('Calendar.html', teamId, y); };
  }
  function resetDetail() {
    document.getElementById('coDetailTitle').textContent = tt('club_overview.weekly_schedule', 'Session detail');
    document.getElementById('coDetailMd').style.display = 'none';
    document.getElementById('coDetailBody').innerHTML = '<div class="co-muted">' + tt('club_overview.empty_day', 'Select a day to see its plan.') + '</div>';
    document.getElementById('coDetailFoot').style.display = 'none';
  }

  // ── ALERTS ──
  function statusLabel(st) { st = (st || '').toLowerCase(); const m = { unavailable: tt('club_overview.st_unavailable', 'Unavailable'), away: tt('club_overview.st_away', 'National team / away'), sick: tt('club_overview.st_sick', 'Sick'), injured: tt('club_overview.injured_one', 'Injured') }; return m[st] || (st ? st.charAt(0).toUpperCase() + st.slice(1) : tt('club_overview.st_unavailable', 'Unavailable')); }
  function playerTeamName(id) { const p = state.data.pmap ? state.data.pmap[String(id)] : null; return p ? ((state.teams.find(t => t.id === p.team_id) || {}).name || '') : ''; }
  // RPE del día por equipo: cuántos jugadores lo rellenaron vs. plantel (solo días con sesión).
  function rpeTodayByTeam() {
    const D = state.data, today = D.today, res = [];
    scopeTeams().forEach(t => {
      const daySess = (D.sessions || []).filter(s => s.team_id === t.id && s.session_date === today && evClass(s.session_type) !== 'match');
      if (!daySess.length) return;
      const sids = new Set(daySess.map(s => s.id)), roster = new Set();
      (D.pteams || []).forEach(p => { if (p.team_id === t.id) roster.add(String(p.player_id)); });
      const sub = new Set();
      (D.rpe || []).forEach(r => { const pid = String(r.player_id); if (!roster.has(pid)) return; if (r.session_date === today || (r.session_id && sids.has(r.session_id))) sub.add(pid); });
      res.push({ team: t, sub: sub.size, total: roster.size });
    });
    return res;
  }
  function renderAlerts() {
    const items = [], k = state.kpi || computeKpis();
    // Rojos de wellness hoy (lo más accionable → primero).
    wellnessStats().flags.slice(0, 4).forEach(f => {
      const extra = (f.soreness != null && Number(f.soreness) >= 7) ? (' · ' + tt('club_overview.w_sore', 'high soreness')) : '';
      items.push({ k: 'bad', i: 'ti-battery-1', t: f.player_name || tt('club_overview.a_player', 'Player'), d: tt('club_overview.w_low_readiness', 'Low readiness') + ' · ' + f.readiness + '/10' + extra, time: tt('common.today', 'today') });
    });
    (k.injIds || []).slice(0, 5).forEach(id => { const p = state.data.pmap[String(id)]; items.push({ k: 'bad', i: 'ti-bandage', t: playerName(id) || tt('club_overview.a_player', 'Player'), d: [tt('club_overview.injured_one', 'Injured'), p && p.position ? p.position : '', playerTeamName(id)].filter(Boolean).join(' · '), time: tt('common.today', 'today') }); });
    if ((k.injIds || []).length > 5) items.push({ k: 'bad', i: 'ti-bandage', t: '+' + (k.injIds.length - 5) + ' ' + tt('club_overview.more_injured', 'more injured'), d: '', time: tt('common.today', 'today') });
    (k.otherIds || []).slice(0, 3).forEach(id => { const p = state.data.pmap[String(id)]; const st = ((state.data.avail || []).find(a => String(a.player_id) === String(id)) || {}).status || ''; items.push({ k: 'warn', i: 'ti-user-off', t: playerName(id) || tt('club_overview.a_player', 'Player'), d: [statusLabel(st), p && p.position ? p.position : '', playerTeamName(id)].filter(Boolean).join(' · '), time: tt('common.today', 'today') }); });
    rpeTodayByTeam().forEach(r => { if (r.total === 0 || r.sub >= r.total) return; const pct = Math.round(r.sub / r.total * 100); items.push({ k: pct < 70 ? 'warn' : 'info', i: 'ti-activity', t: r.team.name + ' · ' + tt('club_overview.rpe_today', 'RPE today') + ' ' + r.sub + '/' + r.total, d: (r.total - r.sub) + ' ' + tt('club_overview.rpe_pending', 'still to submit'), time: tt('common.today', 'today') }); });
    scopeTeams().forEach(t => state.week.forEach(d => { if (!cellEvents(t.id, d.ymd).length && isPlanExpected(t.id, d.ymd)) items.push({ k: 'warn', i: 'ti-alert-triangle', t: t.name + ' · ' + shortDate(d.ymd) + ' — ' + tt('club_overview.no_plan', 'No plan yet'), d: (mdFor(t.id, d.ymd) || '') + ' · ' + tt('club_overview.no_session_yet', 'No session created yet.'), time: relDay(d.ymd) }); }));
    const el = document.getElementById('coAlerts');
    if (!items.length) { el.innerHTML = '<div class="co-muted">' + tt('club_overview.no_alerts', 'All clear.') + '</div>'; return; }
    el.innerHTML = items.slice(0, 10).map(a => '<div class="co-alert ' + a.k + '"><div class="ai"><i class="ti ' + a.i + '"></i></div><div class="ab"><div class="at">' + esc(a.t) + '</div>' + (a.d ? '<div class="ad">' + esc(a.d) + '</div>' : '') + '</div><div class="atime">' + esc(a.time || '') + '</div></div>').join('');
  }

  // ── RETURN TO PLAY (regreso de lesionados) ──
  function daysUntil(y) { if (!y) return null; return Math.round((parseYMD(y) - parseYMD(todayY())) / 86400000); }
  function sevLabel(s) { s = (s || '').toLowerCase(); return tt('club_overview.sev_' + s, s === 'minor' ? 'Minor' : s === 'moderate' ? 'Moderate' : s === 'severe' ? 'Severe' : s); }
  function renderReturns() {
    const el = document.getElementById('coReturns'); if (!el) return;
    const cnt = document.getElementById('coReturnsCount');
    const inScope = pid => { if (!state.scopeTeam) return true; return (state.data.pteams || []).some(p => p.team_id === state.scopeTeam && String(p.player_id) === String(pid)); };
    const inj = (state.data.injuries || []).filter(x => inScope(x.player_id)).slice();
    inj.sort((a, b) => { const da = a.expected_return || '9999-99-99', db = b.expected_return || '9999-99-99'; return da < db ? -1 : da > db ? 1 : 0; });
    if (!inj.length) { el.innerHTML = '<div class="co-muted">' + tt('club_overview.no_returns', 'No active injuries. Full squad healthy.') + '</div>'; if (cnt) cnt.textContent = ''; return; }
    if (cnt) cnt.textContent = inj.length + ' ' + tt('club_overview.out_count', 'out');
    el.innerHTML = inj.map(x => {
      const d = daysUntil(x.expected_return);
      let cls, chip;
      if (x.status === 'returning') { cls = 'good'; chip = '<i class="ti ti-run"></i>' + tt('club_overview.rtp_returning', 'Returning'); }
      else if (d == null) { cls = 'neutral'; chip = tt('club_overview.rtp_none', 'No ETA'); }
      else if (d < 0) { cls = 'bad'; chip = '<i class="ti ti-alert-triangle"></i>' + tt('club_overview.rtp_overdue', 'Overdue'); }
      else if (d === 0) { cls = 'info'; chip = tt('common.today', 'Today'); }
      else if (d <= 7) { cls = 'info'; chip = tt('club_overview.rtp_in', 'In') + ' ' + d + 'd'; }
      else { cls = 'neutral'; chip = shortDate(x.expected_return); }
      const meta = [x.body_area, sevLabel(x.severity), playerTeamName(x.player_id)].filter(Boolean).join(' · ');
      const nm = playerName(x.player_id) || tt('club_overview.a_player', 'Player');
      return '<div class="co-ret"><div class="rn2">' + esc(initials(nm)) + '</div><div class="rb"><div class="rt">' + esc(nm) + '</div><div class="rd">' + esc(meta) + '</div></div><span class="co-chip ' + cls + '">' + chip + '</span></div>';
    }).join('');
  }

  // ── ACTIVITY ──
  function humanAction(a) {
    const map = {
      'rpe.submitted': tt('club_overview.act_rpe', 'submitted an RPE'),
      'wellness.submitted': tt('club_overview.act_wellness', 'submitted a wellness check'),
      'session.created': tt('club_overview.act_session_new', 'created a session'),
      'session.updated': tt('club_overview.act_session_upd', 'updated a session'),
      'session.published': tt('club_overview.act_session_pub', 'published a session'),
      'availability.updated': tt('club_overview.act_avail', 'updated availability'),
      'injury.created': tt('club_overview.act_injury', 'logged an injury'),
      'gym.updated': tt('club_overview.act_gym', 'updated a gym session')
    };
    if (map[a]) return map[a];
    const p = String(a || '').split('.');
    return p.length === 2 ? (p[1].replace(/_/g, ' ') + ' ' + p[0].replace(/_/g, ' ')) : String(a || '');
  }
  function actIcon(a) { a = String(a || ''); if (a.indexOf('rpe') === 0 || a.indexOf('wellness') === 0) return 'ti-activity'; if (a.indexOf('session') === 0 || a.indexOf('gym') === 0) return 'ti-calendar-event'; if (a.indexOf('availab') === 0 || a.indexOf('injur') === 0) return 'ti-bandage'; return 'ti-point'; }
  async function renderActivity() {
    const el = document.getElementById('coActivity'), cid = state.clubId;
    let rows = [];
    try { const { data } = await sb().from('activity_log').select('actor_label,action,team_id,player_id,created_at').eq('club_id', cid).order('created_at', { ascending: false }).limit(8); rows = data || []; } catch (_) {}
    if (rows.length) {
      el.innerHTML = rows.map(r => {
        const who = r.actor_label || playerName(r.player_id) || '';
        const team = (state.teams.find(t => t.id === r.team_id) || {}).name || '';
        const av = who ? esc(initials(who)) : '<i class="ti ' + actIcon(r.action) + '" style="font-size:13px"></i>';
        const txt = (who ? '<b>' + esc(who) + '</b> ' : '') + esc([humanAction(r.action), team].filter(Boolean).join(' · '));
        return '<div class="co-act"><div class="av">' + av + '</div><div class="tx">' + txt + '</div><div class="atime">' + relTime(r.created_at) + '</div></div>';
      }).join('');
      return;
    }
    let s = [];
    try { const { data } = await sb().from('training_sessions').select('title,session_type,team_id,created_at').eq('club_id', cid).order('created_at', { ascending: false }).limit(6); s = data || []; } catch (_) {}
    if (!s.length) { el.innerHTML = '<div class="co-muted">' + tt('club_overview.no_activity', 'No staff activity yet today.') + '</div>'; return; }
    el.innerHTML = s.map(r => { const tm = (state.teams.find(t => t.id === r.team_id) || {}).name || ''; return '<div class="co-act"><div class="av"><i class="ti ti-calendar-plus" style="font-size:13px"></i></div><div class="tx"><b>' + esc(r.title || defaultTitle(evClass(r.session_type))) + '</b>' + (tm ? ' · ' + esc(tm) : '') + '</div><div class="atime">' + relTime(r.created_at) + '</div></div>'; }).join('');
  }

  // ── selección + navegación ──
  function findEvOf(teamId, y, key) {
    const evs = cellEvents(teamId, y);
    if (key && key.indexOf('s:') === 0) return evs.find(x => x.sid === key.slice(2)) || evs[0] || null;
    if (key && key.indexOf('m:') === 0) return evs.find(x => x.mid === key.slice(2)) || evs[0] || null;
    if (key && key.indexOf('c:') === 0) return evs.find(x => x.cid === key.slice(2)) || evs[0] || null;
    return evs[0] || null;
  }
  function selectEvent(teamId, y, key) {
    document.querySelectorAll('.co-ev.sel').forEach(x => x.classList.remove('sel'));
    const cell = document.querySelector('.co-cell[data-team="' + cssEsc(teamId) + '"][data-ymd="' + y + '"]');
    if (cell && key) { const card = cell.querySelector('.co-ev[data-key="' + key + '"]'); if (card) card.classList.add('sel'); }
    state.sel = { team: teamId, ymd: y, key: key };
    renderSession(findEvOf(teamId, y, key), teamId, y);
  }
  function autoSelect() {
    const teams = scopeTeams(); if (!teams.length) { resetDetail(); return; }
    const today = todayY();
    for (const t of teams) { const evs = cellEvents(t.id, today); if (evs.length && state.week.some(w => w.ymd === today)) { selectEvent(t.id, today, evKey(evs[0])); return; } }
    for (const t of teams) for (const d of state.week) { const evs = cellEvents(t.id, d.ymd); if (evs.length) { selectEvent(t.id, d.ymd, evKey(evs[0])); return; } }
    resetDetail();
  }

  function renderTeamSelect() {
    const sel = document.getElementById('coTeamSelect');
    sel.innerHTML = ['<option value="">' + esc(tt('club_overview.all_teams', 'All teams')) + '</option>'].concat(state.teams.map(t => '<option value="' + t.id + '">' + esc(t.name) + '</option>')).join('');
    sel.value = state.scopeTeam;
    sel.onchange = () => { state.scopeTeam = sel.value; state.sel = null; refresh(); };
  }

  async function refresh() {
    buildWeek();
    document.getElementById('coWeekLbl').textContent = weekLabel();
    await fetchWeek();
    state.kpi = computeKpis();
    renderPulse(); renderGrid(); renderAlerts(); renderReturns();
    autoSelect();
  }

  async function boot() {
    if (window.requireAuth && !(await window.requireAuth())) return;
    let profile = null, club = null, clubId = null;
    try { [profile, club] = await Promise.all([window.getProfile ? window.getProfile() : null, window.getClub ? window.getClub() : null]); } catch (_) {}
    try { clubId = await window.getClubId(); } catch (_) {}
    try { window.applyClubTheme && window.applyClubTheme(); } catch (_) {}
    state.profile = profile; state.clubId = clubId;

    let allowed = false;
    try { const b = window.cmRoleBuckets ? window.cmRoleBuckets(profile) : new Set(); allowed = b.has('admin') || b.has('direction'); if (!allowed && window.isSuperAdmin) allowed = await window.isSuperAdmin(); } catch (_) {}
    if (!allowed) { location.replace('Hub.html'); return; }

    // Gate de plan: Club Overview es feature del plan Full. Super-admin exento
    // (planAllows ya devuelve true si el gating maestro está OFF).
    try {
      if (window.planAllows && !(await window.planAllows('club-overview'))) {
        let _isSuper = false;
        try { _isSuper = window.isSuperAdmin ? await window.isSuperAdmin() : false; } catch (_) {}
        if (!_isSuper) { location.replace('Plan Picker.html'); return; }
      }
    } catch (_) {}

    if (club && club.name) document.getElementById('coClubName').textContent = club.name;
    if (!clubId) { document.getElementById('coSched').innerHTML = '<div class="co-muted" style="padding:24px">' + tt('club_overview.no_teams', 'No teams found for this club.') + '</div>'; return; }

    try { state.teams = (await window.getTeams(clubId)) || []; } catch (_) { state.teams = []; }
    const seas = (state.teams.find(t => t.season) || {}).season;
    document.getElementById('coSeasonLbl').textContent = seas ? (tt('common.season', 'Season') + ' ' + seas) : '';
    renderTeamSelect();

    document.getElementById('coSched').addEventListener('click', e => { const card = e.target.closest('.co-ev[data-key]'); if (!card) return; const cell = card.closest('.co-cell'); if (cell) selectEvent(cell.dataset.team, cell.dataset.ymd, card.dataset.key); });
    const detailPanel = document.querySelector('.co-detail');
    if (detailPanel) detailPanel.addEventListener('click', e => {
      const play = e.target.closest('.co-play');
      if (play) { const w = play.closest('.co-vidwrap'); if (w) { const emb = safeUrl(decodeURIComponent(w.dataset.embed || '')); const pv = document.getElementById('coPreview'); pv.innerHTML = w.dataset.file === '1' ? ('<video src="' + esc(emb) + '" controls autoplay muted playsinline style="width:100%;height:100%;object-fit:contain;background:#000"></video>') : ('<iframe src="' + esc(emb) + '" allow="autoplay; encrypted-media; fullscreen" allowfullscreen style="width:100%;height:100%;border:0;background:#000"></iframe>'); } return; }
      const chip = e.target.closest('.co-secchip[data-sec]'); if (chip) { toggleSection(chip.dataset.sec); return; }
      const row = e.target.closest('.co-exrow[data-i]'); if (!row) return;
      const i = parseInt(row.dataset.i, 10); if (state._exKind === 'gym') selectGymEx(i); else selectFieldDrill(i);
    });
    document.getElementById('coPrevWeek').onclick = () => { state.refDate = addDays(mondayOf(state.refDate), -7); state.sel = null; refresh(); };
    document.getElementById('coNextWeek').onclick = () => { state.refDate = addDays(mondayOf(state.refDate), 7); state.sel = null; refresh(); };
    document.getElementById('coToday').onclick = () => { state.refDate = new Date(); state.sel = null; refresh(); };

    await refresh();
    await renderActivity();

    window.addEventListener('cm:langchanged', () => { renderTeamSelect(); renderPulse(); renderGrid(); renderAlerts(); renderReturns(); if (state.sel) selectEvent(state.sel.team, state.sel.ymd, state.sel.key); else autoSelect(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
