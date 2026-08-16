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
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
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
  function evIcon(cls) { return cls === 'match' ? 'ti-ball-football' : cls === 'gym' ? 'ti-barbell' : cls === 'recovery' ? 'ti-heart' : 'ti-soccer-field'; }
  function defaultTitle(cls) { return cls === 'gym' ? tt('club_overview.leg_gym', 'Gym') : cls === 'recovery' ? tt('club_overview.leg_recovery', 'Recovery') : cls === 'match' ? tt('club_overview.leg_match', 'Match') : tt('club_overview.leg_field', 'Field session'); }
  function fmtTime(t) { return t ? String(t).slice(0, 5) : ''; }
  function auOf(s) { return (s.duration && s.estimated_rpe) ? Math.round(s.duration * s.estimated_rpe) : 0; }
  function fmtHomeAway(h) { h = (h || '').toLowerCase(); return h === 'home' ? tt('common.home', 'Home') : h === 'away' ? tt('common.away', 'Away') : h === 'neutral' ? tt('common.neutral', 'Neutral') : ''; }

  // ── MD offset (por equipo y día) ──
  function mdDiffLabel(target, day) { const diff = Math.round((parseYMD(target) - parseYMD(day)) / 86400000); if (diff === 0) return 'MD'; if (diff > 0 && diff <= 10) return 'MD-' + diff; if (diff < 0 && diff >= -3) return 'MD+' + (-diff); return ''; }
  function mdFor(teamId, y) {
    const sess = (state.data.sessions || []).filter(s => s.team_id === teamId && s.session_date === y);
    for (const s of sess) { if (s.match_day_offset) return s.match_day_offset; }
    const mc = (state.data.micros || []).find(m => m.team_id === teamId && m.start_date <= y && m.end_date >= y);
    if (mc) {
      if (mc.md_overrides && mc.md_overrides[y]) return mc.md_overrides[y];
      if (mc.match_date) return mdDiffLabel(mc.match_date, y);
    }
    const wm = (state.data.matches || []).filter(x => x.team_id === teamId).map(x => x.date).sort();
    if (wm.length) return mdDiffLabel(wm[wm.length - 1], y);
    return '';
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
      evs.push({ cls, kind: 'session', title: s.title || defaultTitle(cls), time: fmtTime(s.session_time), dur: s.duration, au: auOf(s), sid: s.id, stype: s.session_type, gym: s.gym_content });
    });
    cM.forEach(m => evs.push({ cls: 'match', kind: 'match', title: m.opponent ? ('vs ' + m.opponent) : (m.title || tt('club_overview.leg_match', 'Match')), time: fmtTime(m.start_time), meta: m.home_away || '', mid: m.id }));
    evs.sort((a, b) => (a.cls === 'match' ? 1 : 0) - (b.cls === 'match' ? 1 : 0));
    return evs;
  }
  function rosterCount(teamId) { const s = new Set(); (state.data.pteams || []).forEach(p => { if (p.team_id === teamId) s.add(String(p.player_id)); }); return s.size; }

  // ── FETCH de la semana ──
  async function fetchWeek() {
    const cid = state.clubId, from = state.week[0].ymd, to = state.week[6].ymd, today = todayY();
    const run = p => p.then(r => (r && r.data) ? r.data : []).catch(() => []);

    let sessQ = sb().from('training_sessions').select('id,team_id,title,session_type,session_date,session_time,duration,estimated_rpe,match_day_offset,gym_content').eq('club_id', cid).eq('is_historical', false).gte('session_date', from).lte('session_date', to);
    let matchQ = sb().from('calendar_events').select('id,team_id,date,start_time,title,opponent,home_away,competition').eq('club_id', cid).eq('type', 'match').gte('date', from).lte('date', to);
    let mcQ = sb().from('microcycles').select('id,team_id,match_date,md_overrides,start_date,end_date').eq('club_id', cid).lte('start_date', to).gte('end_date', from);
    let lpQ = sb().from('load_plan').select('plan_date,metric,pct').eq('club_id', cid).gte('plan_date', from).lte('plan_date', to);
    if (state.scopeTeam) { sessQ = sessQ.eq('team_id', state.scopeTeam); matchQ = matchQ.eq('team_id', state.scopeTeam); mcQ = mcQ.eq('team_id', state.scopeTeam); lpQ = lpQ.eq('team_id', state.scopeTeam); }
    const ptQ = sb().from('player_teams').select('player_id,team_id').eq('club_id', cid);
    const avQ = sb().from('availability').select('player_id,status,team_id').eq('club_id', cid).eq('date', today);
    const rpeQ = sb().from('rpe').select('session_id,player_id,load,session_date').eq('club_id', cid).gte('session_date', from).lte('session_date', to);

    const [sessions, matches, micros, pteams, avail, rpe, lplan] = await Promise.all([run(sessQ), run(matchQ), run(mcQ), run(ptQ), run(avQ), run(rpeQ), run(lpQ)]);
    state.data = { sessions, matches, micros, pteams, avail, rpe, lplan, today };
  }

  // ── KPIs ──
  function computeKpis() {
    const D = state.data, teams = scopeTeams(), ids = new Set(teams.map(t => t.id));
    let events = 0, auSum = 0, auN = 0, noPlan = 0;
    teams.forEach(t => state.week.forEach(d => {
      const evs = cellEvents(t.id, d.ymd); events += evs.length;
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

    return { sessions: events, noPlan, avgLoad, total, available, out, injured, ep, epPct, comp };
  }

  function renderPulse() {
    const k = state.kpi || (state.kpi = computeKpis());
    const availSub = k.out === 0
      ? '<span class="co-chip good"><i class="ti ti-check"></i>' + tt('club_overview.all_available', 'All available') + '</span>'
      : (k.injured > 0 ? '<span class="co-chip warn">' + k.injured + ' ' + tt('club_overview.injured', 'injured') + '</span>' : '') + ((k.out - k.injured) > 0 ? '<span class="co-chip neutral">' + (k.out - k.injured) + ' ' + tt('club_overview.other', 'other') + '</span>' : '');
    const cards = [
      { ic: 'ti-calendar-stats', col: 'var(--cm-accent)', bg: 'var(--cm-accent-soft)', lbl: tt('club_overview.k_sessions', 'Sessions this week'), val: String(k.sessions), sub: k.noPlan > 0 ? '<span class="co-chip warn"><i class="ti ti-alert-triangle"></i>' + k.noPlan + ' ' + tt('club_overview.no_plan', 'no plan') + '</span>' : '<span class="co-chip good"><i class="ti ti-check"></i>' + tt('club_overview.all_planned', 'All planned') + '</span>' },
      { ic: 'ti-users-group', col: 'var(--cm-info)', bg: 'var(--cm-info-bg)', lbl: tt('club_overview.k_available', 'Squad available'), val: k.available + '<small>/' + k.total + '</small>', sub: availSub },
      { ic: 'ti-chart-line', col: 'var(--cm-violet)', bg: 'var(--cm-violet-bg)', lbl: tt('club_overview.k_load', 'Avg session load'), val: k.avgLoad + '<small> AU</small>', bar: { p: Math.min(100, k.avgLoad ? Math.round(k.avgLoad / 900 * 100) : 0), c: 'var(--cm-violet)' } },
      { ic: 'ti-chart-histogram', col: 'var(--cm-accent)', bg: 'var(--cm-accent-soft)', lbl: tt('club_overview.k_ep', 'Weekly E:P ratio'), val: k.ep, bar: k.ep !== '—' ? { p: k.epPct, c: 'var(--cm-accent)' } : null },
      { ic: 'ti-activity', col: 'var(--cm-danger)', bg: 'var(--cm-danger-bg)', lbl: tt('club_overview.k_rpe', 'RPE compliance'), val: (k.comp == null ? '—' : k.comp + '<small>%</small>'), bar: k.comp == null ? null : { p: k.comp, c: k.comp >= 85 ? 'var(--cm-success)' : 'var(--cm-warning)' } }
    ];
    document.getElementById('coPulse').innerHTML = cards.map(c => '<div class="co-kpi"><div class="kt"><div class="ki" style="background:' + c.bg + ';color:' + c.col + '"><i class="ti ' + c.ic + '"></i></div><div class="kl">' + c.lbl + '</div></div><div class="kv">' + c.val + '</div>' + (c.sub ? '<div class="ks">' + c.sub + '</div>' : '') + (c.bar ? '<div class="co-track"><span style="width:' + c.bar.p + '%;background:' + c.bar.c + '"></span></div>' : '') + '</div>').join('');
  }

  // ── SCHEDULE GRID ──
  function evHtml(e) {
    const meta = e.kind === 'match' ? [fmtHomeAway(e.meta), e.time].filter(Boolean).join(' · ') : [e.time, e.dur ? e.dur + '′' : '', e.au ? e.au + ' AU' : ''].filter(Boolean).join(' · ');
    return '<div class="co-ev ' + e.cls + '"><div class="et"><i class="ti ' + evIcon(e.cls) + '"></i>' + esc(e.title) + '</div>' + (meta ? '<div class="em">' + esc(meta) + '</div>' : '') + '</div>';
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
        const mdHtml = md ? '<span class="co-md' + (md === 'MD' ? ' md0' : '') + '">' + md + '</span>' : '';
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
  function gymBlocksHtml(gc) {
    let blocks = [];
    if (gc) { if (Array.isArray(gc.blocks)) blocks = gc.blocks; else if (Array.isArray(gc)) blocks = gc; else if (Array.isArray(gc.sections)) blocks = gc.sections; }
    if (!blocks.length) return '<div class="co-li gym"><span class="n"><i class="ti ti-barbell" style="font-size:11px"></i></span><span class="lt">' + tt('club_overview.leg_gym', 'Gym') + ' — ' + tt('club_overview.planned_load', 'session planned') + '</span></div>';
    return '<div class="co-list">' + blocks.slice(0, 6).map((b, i) => {
      const name = b.title || b.name || b.label || ('Block ' + (i + 1));
      const items = Array.isArray(b.exercises) ? b.exercises : Array.isArray(b.items) ? b.items : [];
      const sub = items.map(x => (typeof x === 'string' ? x : (x.name || x.title || x.exercise || ''))).filter(Boolean).slice(0, 4).join(' · ');
      return '<div class="co-li gym"><span class="n">' + (i + 1) + '</span><span class="lt">' + esc(name) + (sub ? ' — <span style="color:var(--cm-fg-muted)">' + esc(sub) + '</span>' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function teamWeekMaxAu(teamId) { let mx = 0; state.week.forEach(d => cellEvents(teamId, d.ymd).forEach(e => { if (e.au > mx) mx = e.au; })); return mx || 1; }
  function meterHtml(au, teamId) { const pct = Math.min(100, Math.round(au / teamWeekMaxAu(teamId) * 100)); return '<div class="co-meter"><div class="mr"><span class="ml">' + tt('club_overview.planned_load', 'Planned session load') + '</span><span class="mv">' + au + ' AU</span></div><div class="co-mtrack"><span style="width:' + pct + '%"></span></div></div>'; }

  async function loadDrills(sid) {
    let rows = [];
    try { const { data } = await sb().from('session_exercises').select('*').eq('session_id', sid).order('sort_order', { ascending: true }); rows = data || []; } catch (_) {}
    const el = document.getElementById('coDrills'); if (!el) return;
    if (!rows.length) { el.innerHTML = ''; return; }
    el.innerHTML = rows.slice(0, 8).map((r, i) => { const t = r.title || r.name || r.exercise_name || r.phase || ('Drill ' + (i + 1)); const dur = r.duration ? r.duration + '′' : ''; return '<div class="co-li"><span class="n">' + (i + 1) + '</span><span class="lt">' + esc(t) + '</span>' + (dur ? '<span class="ld">' + dur + '</span>' : '') + '</div>'; }).join('');
  }

  function renderDetail(teamId, y) {
    state.sel = { teamId, ymd: y };
    const team = state.teams.find(t => t.id === teamId);
    const evs = cellEvents(teamId, y), md = mdFor(teamId, y);
    document.getElementById('coDetailTitle').textContent = (team ? team.name : '') + ' · ' + longDate(y);
    const mdEl = document.getElementById('coDetailMd');
    if (md) { mdEl.style.display = ''; mdEl.textContent = md; mdEl.className = 'mdtag' + (md === 'MD' ? ' md0' : ''); } else mdEl.style.display = 'none';
    const body = document.getElementById('coDetailBody'), foot = document.getElementById('coDetailFoot');
    if (!evs.length) { body.innerHTML = '<div class="co-muted">' + tt('club_overview.empty_day', 'No sessions planned') + '</div>'; foot.style.display = 'none'; return; }
    const field = evs.find(e => e.cls === 'field'), gym = evs.find(e => e.cls === 'gym'), match = evs.find(e => e.cls === 'match'), rec = evs.find(e => e.cls === 'recovery');
    let html = '', totalAu = 0;
    if (match) html += sh('var(--cm-danger-bg)', 'var(--cm-danger)', 'ti-ball-football', tt('club_overview.matchday', 'Matchday') + ' — ' + match.title, [fmtHomeAway(match.meta), match.time].filter(Boolean).join(' · '));
    if (field) { html += sh('var(--cm-accent-soft)', 'var(--cm-accent)', 'ti-soccer-field', tt('club_overview.leg_field', 'Field') + ' · ' + field.title, [field.time, field.dur ? field.dur + '′' : '', field.au ? field.au + ' AU' : ''].filter(Boolean).join(' · ')); html += pitchHtml(); html += '<div class="co-list" id="coDrills"><div class="co-muted" style="padding:6px">' + tt('common.loading', 'Loading…') + '</div></div>'; totalAu += field.au || 0; }
    if (gym) { html += sh('var(--cm-info-bg)', 'var(--cm-info)', 'ti-barbell', tt('club_overview.leg_gym', 'Gym') + ' · ' + gym.title, [gym.time, gym.dur ? gym.dur + '′' : '', gym.au ? gym.au + ' AU' : ''].filter(Boolean).join(' · ')); html += gymBlocksHtml(gym.gym); totalAu += gym.au || 0; }
    if (rec) { html += sh('var(--cm-violet-bg)', 'var(--cm-violet)', 'ti-heart', tt('club_overview.leg_recovery', 'Recovery') + ' · ' + rec.title, [rec.time, rec.dur ? rec.dur + '′' : ''].filter(Boolean).join(' · ')); totalAu += rec.au || 0; }
    html += meterHtml(totalAu, teamId);
    body.innerHTML = html;
    foot.style.display = '';
    wireFoot(teamId, y);
    if (field && field.sid) loadDrills(field.sid);
  }
  function wireFoot(teamId, y) {
    const go = page => { try { sessionStorage.setItem('cal_active_team', teamId); localStorage.setItem('cal_active_team', teamId); } catch (_) {} location.href = page + '?date=' + y; };
    const f = document.getElementById('coOpenField'), g = document.getElementById('coOpenGym');
    f.onclick = e => { e.preventDefault(); go('Daily%20Planning.html'); };
    g.onclick = e => { e.preventDefault(); go('Gym%20Planner.html'); };
  }
  function resetDetail() {
    document.getElementById('coDetailTitle').textContent = tt('club_overview.weekly_schedule', 'Session detail');
    document.getElementById('coDetailMd').style.display = 'none';
    document.getElementById('coDetailBody').innerHTML = '<div class="co-muted">' + tt('club_overview.empty_day', 'Select a day to see its plan.') + '</div>';
    document.getElementById('coDetailFoot').style.display = 'none';
  }

  // ── ALERTS ──
  function renderAlerts() {
    const items = [], k = state.kpi || computeKpis();
    if (k.out > 0) items.push({ k: 'info', i: 'ti-user-exclamation', t: k.out + ' ' + tt('club_overview.players_out', 'players unavailable today'), d: k.injured + ' ' + tt('club_overview.injured', 'injured') + ' · ' + (k.out - k.injured) + ' ' + tt('club_overview.other', 'other'), time: tt('common.today', 'today') });
    scopeTeams().forEach(t => state.week.forEach(d => {
      if (!cellEvents(t.id, d.ymd).length && isPlanExpected(t.id, d.ymd)) items.push({ k: 'warn', i: 'ti-alert-triangle', t: t.name + ' · ' + shortDate(d.ymd) + ' — ' + tt('club_overview.no_plan', 'No plan yet'), d: (mdFor(t.id, d.ymd) || '') + ' · ' + tt('club_overview.no_plan', 'No session created yet.'), time: relDay(d.ymd) });
    }));
    const el = document.getElementById('coAlerts');
    if (!items.length) { el.innerHTML = '<div class="co-muted">' + tt('club_overview.no_alerts', 'All clear.') + '</div>'; return; }
    el.innerHTML = items.slice(0, 6).map(a => '<div class="co-alert ' + a.k + '"><div class="ai"><i class="ti ' + a.i + '"></i></div><div class="ab"><div class="at">' + esc(a.t) + '</div><div class="ad">' + esc(a.d) + '</div></div><div class="atime">' + esc(a.time || '') + '</div></div>').join('');
  }

  // ── ACTIVITY ──
  async function renderActivity() {
    const el = document.getElementById('coActivity'), cid = state.clubId;
    let rows = [];
    try { const { data } = await sb().from('activity_log').select('*').eq('club_id', cid).order('created_at', { ascending: false }).limit(6); rows = data || []; } catch (_) {}
    if (rows.length) {
      el.innerHTML = rows.map(r => { const who = r.actor_name || r.user_name || r.actor || ''; const act = r.action || r.description || r.summary || r.event || r.type || ''; return '<div class="co-act"><div class="av">' + esc(initials(who || '•')) + '</div><div class="tx">' + (who ? '<b>' + esc(who) + '</b> ' : '') + esc(String(act)) + '</div><div class="atime">' + relTime(r.created_at) + '</div></div>'; }).join('');
      return;
    }
    let s = [];
    try { const { data } = await sb().from('training_sessions').select('title,session_type,team_id,created_at').eq('club_id', cid).order('created_at', { ascending: false }).limit(6); s = data || []; } catch (_) {}
    if (!s.length) { el.innerHTML = '<div class="co-muted">' + tt('club_overview.no_activity', 'No staff activity yet today.') + '</div>'; return; }
    el.innerHTML = s.map(r => { const tm = (state.teams.find(t => t.id === r.team_id) || {}).name || ''; return '<div class="co-act"><div class="av"><i class="ti ti-calendar-plus" style="font-size:13px"></i></div><div class="tx"><b>' + esc(r.title || defaultTitle(evClass(r.session_type))) + '</b>' + (tm ? ' · ' + esc(tm) : '') + '</div><div class="atime">' + relTime(r.created_at) + '</div></div>'; }).join('');
  }

  // ── selección + navegación ──
  function selectCell(teamId, y) {
    document.querySelectorAll('.co-cell.sel').forEach(x => x.classList.remove('sel'));
    const c = document.querySelector('.co-cell[data-team="' + (window.CSS && CSS.escape ? CSS.escape(teamId) : teamId) + '"][data-ymd="' + y + '"]');
    if (c) c.classList.add('sel');
    renderDetail(teamId, y);
  }
  function autoSelect() {
    const teams = scopeTeams(); if (!teams.length) { resetDetail(); return; }
    const today = todayY();
    for (const t of teams) if (cellEvents(t.id, today).length && state.week.some(w => w.ymd === today)) { selectCell(t.id, today); return; }
    for (const t of teams) for (const d of state.week) if (cellEvents(t.id, d.ymd).length) { selectCell(t.id, d.ymd); return; }
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
    renderPulse(); renderGrid(); renderAlerts();
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

    if (club && club.name) document.getElementById('coClubName').textContent = club.name;
    if (!clubId) { document.getElementById('coSched').innerHTML = '<div class="co-muted" style="padding:24px">' + tt('club_overview.no_teams', 'No teams found for this club.') + '</div>'; return; }

    try { state.teams = (await window.getTeams(clubId)) || []; } catch (_) { state.teams = []; }
    const seas = (state.teams.find(t => t.season) || {}).season;
    document.getElementById('coSeasonLbl').textContent = seas ? (tt('common.season', 'Season') + ' ' + seas) : '';
    renderTeamSelect();

    document.getElementById('coSched').addEventListener('click', e => { const c = e.target.closest('.co-cell.clk'); if (c) selectCell(c.dataset.team, c.dataset.ymd); });
    document.getElementById('coPrevWeek').onclick = () => { state.refDate = addDays(mondayOf(state.refDate), -7); state.sel = null; refresh(); };
    document.getElementById('coNextWeek').onclick = () => { state.refDate = addDays(mondayOf(state.refDate), 7); state.sel = null; refresh(); };
    document.getElementById('coToday').onclick = () => { state.refDate = new Date(); state.sel = null; refresh(); };

    await refresh();
    await renderActivity();

    window.addEventListener('cm:langchanged', () => { renderTeamSelect(); renderPulse(); renderGrid(); renderAlerts(); if (state.sel) selectCell(state.sel.teamId, state.sel.ymd); else autoSelect(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
