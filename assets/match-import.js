/* ────────────────────────────────────────────────────────────────────────
   match-import.js — "Match details" manual-entry form for Match Reports.
   Exposes window.matchImport.{ open(), close() }.

   Renders a form into #impForm (inside the import drawer). Creates/updates a
   public.match_results row for the active team's club; upserts by session_id
   when a match session is chosen, otherwise inserts a standalone row.
   Multi-tenant: every query/write filtered by club_id. Resilient: never throws.
   (CSV import is Step 3b — this step is manual entry only.)
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  function tt(key, fallbackEN, vars){
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
  }
  function miLocale(){ return (window.CM_I18N && CM_I18N.current) || document.documentElement.lang || 'en'; }
  function miMonthDay(dt){ try { return new Intl.DateTimeFormat(miLocale(), { day:'numeric', month:'short', year:'numeric' }).format(dt); } catch(_) { return dt.toDateString(); } }

  let _sessions = [], _clubId = null, _teamId = null;
  // player-stats import state
  let _matchId = null, _players = null, _parsed = null, _provider = 'generic', _mapping = {};
  // El export de equipo de Wyscout, ya parseado y esperando confirmación.
  let _teamStats = null;
  // El mismo export cuando trae varias jornadas acumuladas: la lista de partidos que
  // se encontraron, ya cruzada contra lo que hay en la base.
  let _teamBatch = null;
  // El partido del archivo cuando es uno solo, para poder avisar si no es el abierto.
  let _teamStatsMatch = null;
  // Cómo se llama nuestro equipo, para saber cuál de las filas del archivo somos.
  let _ourName;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function sessLabel(s){
    let d = '';
    if (s.session_date){ const dt = new Date(String(s.session_date).slice(0,10) + 'T00:00:00');
      d = isNaN(dt) ? String(s.session_date).slice(0,10) : miMonthDay(dt); }
    return [d, s.title].filter(Boolean).join(' · ') || tt('match_reports.match_session', 'Match session');
  }

  function showDrawer(){ const d=$('impDrawer'), o=$('impOverlay'); if(d)d.classList.add('is-open'); if(o)o.classList.add('is-open'); }
  function close(){ const d=$('impDrawer'), o=$('impOverlay'); if(d)d.classList.remove('is-open'); if(o)o.classList.remove('is-open'); }

  function injectStyles(){
    if ($('mi-styles')) return;
    const css = `
      .mi-form { display:flex; flex-direction:column; gap:12px; }
      .mi-field { display:flex; flex-direction:column; gap:5px; flex:1; min-width:0; }
      .mi-field .mi-l { font:600 11px/1 var(--cm-font-sans); letter-spacing:.04em; text-transform:uppercase; color:var(--cm-fg-muted); }
      .mi-row { display:flex; gap:12px; flex-wrap:wrap; }
      .mi-actions { display:flex; align-items:center; gap:10px; margin-top:6px; }
      .mi-msg { font:600 12px/1.3 var(--cm-font-sans); }
      .mi-stats { margin-top:18px; padding-top:18px; border-top:1px solid var(--cm-border-soft); }
      .mi-stats-h { font:600 12px/1 var(--cm-font-sans); letter-spacing:.04em; text-transform:uppercase; color:var(--cm-fg-strong); margin-bottom:10px; }
      .mi-hint { margin:-4px 0 10px; font:400 12px/1.5 var(--cm-font-sans); color:var(--cm-fg-muted); }
      .mi-locked { display:flex; align-items:flex-start; gap:7px; margin:10px 0 0; padding:9px 11px; border:1px solid var(--cm-border); border-radius:var(--cm-r-2); background:var(--cm-bg-soft); font:500 12px/1.5 var(--cm-font-sans); color:var(--cm-fg-muted); }
      .mi-locked .ti { flex:0 0 auto; margin-top:1px; font-size:14px; color:var(--cm-fg-faint); }
      .mi-stats [disabled] { opacity:.55; cursor:not-allowed; }

      /* Export de equipo de Wyscout: se confirma lo detectado, no se mapea columna a columna. */
      .mi-ts { margin-top:12px; padding:12px 13px; border:1px solid var(--cm-info-bd); background:var(--cm-info-bg); border-radius:var(--cm-r-3); display:flex; flex-direction:column; gap:8px; }
      .mi-ts-h { display:flex; align-items:center; gap:7px; font:600 12.5px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
      .mi-ts-h .ti { font-size:15px; color:var(--cm-info); }
      .mi-ts-p { margin:0; font:400 12px/1.55 var(--cm-font-sans); color:var(--cm-fg-muted); }
      .mi-ts-side { display:flex; align-items:center; gap:8px; padding:7px 9px; background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:var(--cm-r-2); }
      .mi-ts-side b { font:600 13px/1 var(--cm-font-sans); color:var(--cm-fg-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mi-ts-tag { flex:0 0 auto; padding:2px 7px; border-radius:var(--cm-r-1); background:var(--cm-bg-sunk); border:1px solid var(--cm-border); font:600 10px/1.5 var(--cm-font-sans); letter-spacing:.04em; text-transform:uppercase; color:var(--cm-fg-muted); }
      .mi-ts-tag.is-us { background:var(--cm-accent); border-color:var(--cm-accent); color:var(--cm-fg-on-accent); }
      .mi-ts-form { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-muted); }
      .mi-ts-n { margin-left:auto; flex:0 0 auto; font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
      .mi-ts-peeks { display:flex; flex-wrap:wrap; gap:6px; }
      .mi-ts-peek { display:inline-flex; align-items:baseline; gap:6px; padding:4px 8px; background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:var(--cm-r-2); }
      .mi-ts-peek i { font-style:normal; font:400 11px/1 var(--cm-font-sans); color:var(--cm-fg-muted); }
      .mi-ts-peek b { font:600 12px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }
      .mi-ts-peek u { text-decoration:none; color:var(--cm-fg-faint); }
      .mi-ts-warn { margin:0; font:500 12px/1.5 var(--cm-font-sans); color:var(--cm-warning); }

      /* Export acumulado: una fila por partido, tildable. */
      .mi-ts-tools { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .mi-ts-tools .mi-ts-lnk { border:0; background:none; padding:2px 4px; cursor:pointer; font:600 11.5px/1 var(--cm-font-sans); color:var(--cm-info); }
      .mi-ts-tools .mi-ts-lnk:hover { text-decoration:underline; }
      .mi-ts-tools .mi-ts-sep { color:var(--cm-fg-faint); font-size:11px; }
      .mi-ts-list { display:flex; flex-direction:column; gap:5px; max-height:290px; overflow:auto; padding:1px; }
      .mi-ts-m { display:flex; align-items:center; gap:9px; padding:7px 9px; background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:var(--cm-r-2); cursor:pointer; }
      .mi-ts-m.is-off { opacity:.62; }
      .mi-ts-m.is-dead { cursor:not-allowed; opacity:.5; }
      .mi-ts-m input { flex:0 0 auto; margin:0; accent-color:var(--cm-accent); }
      .mi-ts-m .mi-ts-d { flex:0 0 auto; font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-muted); }
      /* min-width:0 para que el nombre se recorte en vez de empujar al badge fuera de la
         fila: un flex item no baja de su ancho de contenido sin esto, y en español los
         rótulos ya vienen un cuarto más largos que en inglés. */
      .mi-ts-m b { flex:1 1 auto; min-width:0; font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mi-ts-m .mi-ts-ha { flex:0 0 auto; font:500 11px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
      .mi-ts-badge { flex:0 0 auto; margin-left:auto; padding:2px 7px; border-radius:var(--cm-r-1); border:1px solid var(--cm-border); background:var(--cm-bg-sunk); font:600 10px/1.5 var(--cm-font-sans); letter-spacing:.03em; text-transform:uppercase; color:var(--cm-fg-muted); white-space:nowrap; }
      .mi-ts-badge.is-new { border-color:var(--cm-accent); color:var(--cm-accent); background:transparent; }
      .mi-ts-badge.is-dead { border-color:var(--cm-danger); color:var(--cm-danger); background:transparent; }
    `;
    const el = document.createElement('style'); el.id = 'mi-styles'; el.textContent = css;
    document.head.appendChild(el);
  }

  async function open(){
    const host = $('impForm');
    if (!host) return;
    showDrawer();
    injectStyles();
    _matchId = null; _parsed = null; _players = null; _provider = 'generic'; _mapping = {};
    _teamStats = null; _teamBatch = null; _teamStatsMatch = null; _ourName = undefined;
    host.innerHTML = `<div style="padding:18px 4px;color:var(--cm-fg-faint);font:var(--cm-body-sm)">${esc(tt('common.loading', 'Loading…'))}</div>`;
    try {
      _clubId = await window.getClubId();
      const teamSel = $('mrTeamSelect');
      _teamId = (teamSel && teamSel.value) || null;
      let q = window.sb.from('training_sessions')
        .select('id, title, session_date')
        // 'match' en minúscula: es como lo guarda el calendario y como lo lee el resto
        // de la app. Con 'Match' este selector salía siempre vacío.
        .eq('club_id', _clubId).eq('session_type', 'match')
        .order('session_date', { ascending: false }).limit(30);
      if (_teamId) q = q.eq('team_id', _teamId);
      const { data } = await q;
      _sessions = data || [];
    } catch (_) { _sessions = []; }
    renderForm(host);
  }

  function renderForm(host){
    const opts = [`<option value="">${esc(tt('match_reports.no_session_standalone', '— No session (standalone) —'))}</option>`]
      .concat(_sessions.map(s => `<option value="${esc(s.id)}" data-date="${esc(s.session_date || '')}">${esc(sessLabel(s))}</option>`))
      .join('');
    host.innerHTML = `
      <div class="mi-form">
        <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.match_session', 'Match session'))}</span>
          <select id="miSession" class="cm-select">${opts}</select></label>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.match_date_req', 'Match date *'))}</span><input id="miDate" type="date" class="cm-input" required></label>
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.home_away', 'Home / Away'))}</span>
            <select id="miHA" class="cm-select"><option value="">—</option><option value="home">${esc(tt('match_reports.home', 'Home'))}</option><option value="away">${esc(tt('match_reports.away', 'Away'))}</option></select></label>
        </div>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.opponent', 'Opponent'))}</span><input id="miOpp" class="cm-input" placeholder="${esc(tt('match_reports.opponent_name', 'Opponent name'))}"></label>
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.competition', 'Competition'))}</span><input id="miComp" class="cm-input" placeholder="${esc(tt('match_reports.league_cup_ph', 'League · Cup…'))}"></label>
        </div>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.score_for', 'Score for'))}</span><input id="miSF" type="number" min="0" step="1" class="cm-input"></label>
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.score_against', 'Score against'))}</span><input id="miSA" type="number" min="0" step="1" class="cm-input"></label>
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.possession_label', 'Possession %'))}</span><input id="miPos" type="number" min="0" max="100" step="1" class="cm-input"></label>
        </div>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.formation', 'Formation'))}</span><input id="miForm" class="cm-input" placeholder="4-3-3"></label>
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.venue', 'Venue'))}</span><input id="miVenue" class="cm-input"></label>
        </div>
        <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.notes', 'Notes'))}</span><textarea id="miNotes" class="cm-input" rows="2"></textarea></label>
        <div class="mi-actions">
          <span id="miMsg" class="mi-msg"></span>
          <span style="flex:1"></span>
          <button id="miCancel" class="cm-btn is-outline is-sm" type="button">${esc(tt('common.cancel', 'Cancel'))}</button>
          <button id="miSave" class="cm-btn is-primary is-sm" type="button"><i class="ti ti-device-floppy" style="font-size:14px"></i>${esc(tt('common.save', 'Save'))}</button>
        </div>
        <div id="miStatsSection" class="mi-stats"></div>
      </div>`;
    $('miSession').addEventListener('change', onSessionChange);
    $('miCancel').addEventListener('click', close);
    $('miSave').addEventListener('click', save);
    updateStatsSection();
  }

  async function onSessionChange(e){
    const sel = e.target, sid = sel.value, opt = sel.options[sel.selectedIndex];
    if (sid) {
      if (opt && opt.dataset.date) $('miDate').value = String(opt.dataset.date).slice(0, 10);
      try {
        const { data } = await window.sb.from('match_results').select('*')
          .eq('club_id', _clubId).eq('session_id', sid).limit(1);
        const r = data && data[0];
        _matchId = r ? r.id : null;
        fillFrom(r, true);   // edit mode (keep prefilled date if no row date)
      } catch (_) { _matchId = null; }
    } else {
      _matchId = null;
      fillFrom(null, false);
    }
    updateStatsSection();
  }

  function fillFrom(r, keepDate){
    const set = (id, v) => { const el = $(id); if (el) el.value = (v == null ? '' : v); };
    if (r) {
      if (r.match_date) set('miDate', String(r.match_date).slice(0, 10));
      set('miOpp', r.opponent); set('miComp', r.competition); set('miHA', r.home_away || '');
      set('miSF', r.score_for); set('miSA', r.score_against); set('miPos', r.possession);
      set('miForm', r.formation); set('miVenue', r.venue); set('miNotes', r.notes);
    } else {
      ['miOpp','miComp','miSF','miSA','miPos','miForm','miVenue','miNotes'].forEach(id => set(id, ''));
      set('miHA', '');
      if (!keepDate) set('miDate', '');
    }
  }

  function numOrNull(id){ const el = $(id); const v = el && el.value.trim(); if (!v) return null; const n = Number(v); return isFinite(n) ? n : null; }
  function txtOrNull(id){ const el = $(id); const v = el && el.value.trim(); return v ? v : null; }

  async function save(){
    const msg = $('miMsg'); if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = ''; }
    const date = $('miDate') && $('miDate').value;
    if (!date) { if (msg) msg.textContent = tt('match_reports.match_date_required', 'Match date is required'); return; }

    let uid = null; try { uid = (await window.sb.auth.getUser()).data.user?.id || null; } catch (_) {}
    const sid = ($('miSession') && $('miSession').value) || null;
    const payload = {
      club_id: _clubId,
      team_id: _teamId || null,
      session_id: sid || null,
      match_date: date,
      competition: txtOrNull('miComp'),
      opponent: txtOrNull('miOpp'),
      home_away: ($('miHA') && $('miHA').value) || null,
      score_for: numOrNull('miSF'),
      score_against: numOrNull('miSA'),
      possession: numOrNull('miPos'),
      formation: txtOrNull('miForm'),
      venue: txtOrNull('miVenue'),
      notes: txtOrNull('miNotes'),
      created_by: uid,
    };
    try {
      const res = sid
        ? await window.sb.from('match_results').upsert(payload, { onConflict: 'session_id' }).select('id').single()
        : await window.sb.from('match_results').insert(payload).select('id').single();
      if (res.error) throw res.error;
      _matchId = (res.data && res.data.id) || _matchId;
      if (msg){ msg.style.color = 'var(--cm-success)'; msg.textContent = tt('match_reports.saved_import_below', '✓ Saved — you can now import player stats below'); }
      updateStatsSection();   // reveal the player-stats import with matchId in scope
    } catch (e) {
      if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.error_prefix', 'Error: {msg}', { msg: (e.message || e) }); }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Player stats import — CSV/XLSX → player_match_stats for _matchId
  // ════════════════════════════════════════════════════════════════
  function _norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
  function _slug(s){ return _norm(s).replace(/ /g,'_') || 'col'; }

  // Target fields the user can map a source column to.
  // Who the player is — the same in every sport.
  const IDENTITY_TARGETS = [
    ['player_name','Player name (match)'],
    ['player_first','First name (match)'],
    ['player_last','Last name (match)'],
    ['jersey','Jersey # (match)'],
    ['position','Position'],
  ];
  // The stat columns a file can be mapped onto come from the SPORT (match.playerStats):
  // football's goals and cards, basketball's points and rebounds, rugby's tries and
  // tackles. This used to be eleven football keys, so a basketball box score had nowhere
  // to land — every column would have been dropped as unmapped.
  function statTargets() {
    const fields = window.cmMatchStats ? window.cmMatchStats.fields() : [];
    const fromSport = fields.map(f => [f.key, window.cmMatchStats.label(f.key)]);
    return IDENTITY_TARGETS.slice(0, 4).concat(fromSport, [IDENTITY_TARGETS[4]]);
  }
  // Kept as a live getter so existing call sites keep working unchanged.
  const STAT_TARGETS = new Proxy([], {
    get(_t, prop) {
      const arr = statTargets();
      const v = arr[prop];
      return typeof v === 'function' ? v.bind(arr) : v;
    },
    has(_t, prop) { return prop in statTargets(); },
    ownKeys() { return Reflect.ownKeys(statTargets()); },
    getOwnPropertyDescriptor(_t, prop) {
      return Object.getOwnPropertyDescriptor(statTargets(), prop);
    },
  });
  // Localized display label for a stat target key (falls back to the EN label above).
  function statLabel(k, fallbackEN){ return tt('match_reports.stat_' + k, fallbackEN); }
  function targetOrder(){ return statTargets().map(t => t[0]); }   // autoMap priority
  // Header spellings we know. The identity rows and the football stats were here from the
  // start; the rest is generated from the sport's own keys so a basketball export maps on
  // its column names without anyone maintaining a second table.
  const ALIASES_BASE = {
    player_name:['player','name','player name','jugador','nombre','full name'],
    player_first:['first name','nombre'],
    player_last:['last name','apellido','surname'],
    jersey:['number','jersey','shirt','dorsal','#','no'],
    minutes:['minutes','minutes played','min','mins','minutos'],
    goals:['goals','goal','goles','g'],
    assists:['assists','assist','asistencias','a'],
    yellow_cards:['yellow cards','yellow','amarillas','yc'],
    red_cards:['red cards','red','rojas','rc'],
    rating:['rating','rate','nota','score'],
    position:['position','pos','posición','posicion'],
    // basketball
    points:['points','pts','puntos'], rebounds_off:['offensive rebounds','oreb','reb of'],
    rebounds_def:['defensive rebounds','dreb','reb def'], steals:['steals','stl','robos'],
    blocks:['blocks','blk','tapones'], turnovers:['turnovers','to','pérdidas','perdidas'],
    fouls:['fouls','pf','faltas'], technical:['technical fouls','technicals','técnicas','tecnicas'],
    fg2m:['2pm','fg2m','2 points made'], fg2a:['2pa','fg2a','2 points attempted'],
    fg3m:['3pm','fg3m','3 points made'], fg3a:['3pa','fg3a','3 points attempted'],
    ftm:['ftm','free throws made','libres'], fta:['fta','free throws attempted'],
    plus_minus:['+/-','plus minus','plusminus'],
    // rugby
    tries:['tries','try','ensayos'], conversions:['conversions','conv'],
    penalties:['penalties','pens'], tackles:['tackles','tkl'],
    missed_tackles:['missed tackles','tackles missed'],
    green_cards:['green cards','green','verdes'],
  };
  function aliasesFor(keys) {
    const out = {};
    keys.forEach(k => { out[k] = (ALIASES_BASE[k] || [k.replace(/_/g, ' ')]).slice(); });
    return out;
  }
  const ALIASES_GENERIC = new Proxy({}, {
    get(_t, k) { return (ALIASES_BASE[k] || [String(k).replace(/_/g, ' ')]); },
    has(_t, k) { return targetOrder().includes(k) || k in ALIASES_BASE; },
    ownKeys() { return targetOrder(); },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
  });
  // Wyscout preset = generic + Wyscout's exact export headers.
  const ALIASES_WYSCOUT = (function(){
    const w = aliasesFor(Object.keys(ALIASES_BASE));
    w.player_name = w.player_name.concat(['player']);
    w.minutes = w.minutes.concat(['minutes played','minutes on field','min played']);
    w.goals = w.goals.concat(['goals']);
    w.assists = w.assists.concat(['assists']);
    w.yellow_cards = w.yellow_cards.concat(['yellow cards']);
    w.red_cards = w.red_cards.concat(['red cards']);
    return w;
  })();
  function aliasDict(){ return _provider === 'wyscout' ? ALIASES_WYSCOUT : ALIASES_GENERIC; }
  function autoMapHeader(header){
    const nh = _norm(header), dict = aliasDict();
    for (const key of targetOrder()){ if ((dict[key]||[]).map(_norm).includes(nh)) return key; }
    return '__extra__';
  }
  function autoMapAll(){ _mapping = {}; (_parsed.headers||[]).forEach(h => { _mapping[h] = autoMapHeader(h); }); }

  // ── lazy loaders (mirror the GPS importer) ──
  let _xlsxLoading = false, _papaLoading = false;
  function loadXLSX(){ return new Promise((res, rej) => {
    if (window.XLSX) { res(); return; }
    if (_xlsxLoading) { const t = setInterval(() => { if (window.XLSX) { clearInterval(t); res(); } }, 50); return; }
    _xlsxLoading = true; const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => res(); s.onerror = rej; document.head.appendChild(s);
  }); }
  function loadPapa(){ return new Promise((res, rej) => {
    if (window.Papa) { res(); return; }
    if (_papaLoading) { const t = setInterval(() => { if (window.Papa) { clearInterval(t); res(); } }, 50); return; }
    _papaLoading = true; const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    s.onload = () => res(); s.onerror = rej; document.head.appendChild(s);
  }); }

  /* Wyscout escribe su XML de eventos en UTF-16 y sin BOM, así que `file.text()` lo
     devuelve como caracteres chinos. Se mira el primer par de bytes: en UTF-16LE los
     impares de un texto ASCII son 0x00. */
  function decodeText(buf){
    const b = new Uint8Array(buf);
    if (b.length > 1){
      if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
      if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
      if (b[1] === 0x00) return new TextDecoder('utf-16le').decode(buf);
      if (b[0] === 0x00) return new TextDecoder('utf-16be').decode(buf);
    }
    return new TextDecoder('utf-8').decode(buf);
  }

  /* El XML de eventos de Wyscout es una playlist de vídeo: una <instance> por clip, con
     el jugador en <code> ("(9) Nombre") y el tipo de jugada en <label><text>. No es una
     tabla, así que acá se cuenta cuántas veces hizo cada jugador cada cosa y se arma una
     fila por jugador — la forma que el resto del importador ya sabe mapear.
     Las cuatro instancias sin <code> son las marcas de inicio y fin de cada tiempo:
     no son jugadores, pero sirven para pasar los segundos de vídeo a minuto de partido. */
  function parseWyscoutEvents(text){
    let doc;
    try { doc = new DOMParser().parseFromString(text, 'application/xml'); } catch (_e){ return null; }
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    const inst = doc.getElementsByTagName('instance');
    if (!inst.length || !doc.getElementsByTagName('ALL_INSTANCES').length) return null;

    const txt = (el, tag) => { const n = el.getElementsByTagName(tag)[0]; return n ? (n.textContent || '').trim() : ''; };
    const counts = {}, order = [], labels = {}, marks = {}, events = [];

    for (let i = 0; i < inst.length; i++){
      const el = inst[i];
      const code = txt(el, 'code');
      const lab = txt(el, 'text');
      const start = parseFloat(txt(el, 'start'));
      if (!lab) continue;
      if (!code){ marks[lab.toLowerCase()] = start; continue; }   // marca de período
      if (!counts[code]){ counts[code] = {}; order.push(code); }
      counts[code][lab] = (counts[code][lab] || 0) + 1;
      labels[lab] = (labels[lab] || 0) + 1;
      events.push({ code: code, label: lab, start: start });
    }
    if (!order.length) return null;

    // Columnas: identidad primero, después los tipos de evento por frecuencia.
    const byFreq = Object.keys(labels).sort((a, b) => labels[b] - labels[a]);
    const headers = ['Number', 'Player'].concat(byFreq);
    const rows = order
      .sort((a, b) => {
        const s = c => Object.keys(counts[c]).reduce((t, k) => t + counts[c][k], 0);
        return s(b) - s(a);
      })
      .map(code => {
        const m = code.match(/^\((\d+)\)\s*(.+)$/);       // "(9) Nombre" → dorsal + nombre
        const o = { Number: m ? m[1] : '', Player: m ? m[2] : code };
        byFreq.forEach(l => { o[l] = counts[code][l] || 0; });
        return o;
      });

    return { headers: headers, rows: rows, events: events, marks: marks, labels: byFreq };
  }

  async function parseFile(file){
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.xml')){
      const parsed = parseWyscoutEvents(decodeText(await file.arrayBuffer()));
      if (!parsed) throw new Error(tt('match_reports.xml_not_wyscout',
        'This XML is not a Wyscout event export.'));
      return Object.assign({ kind: 'events' }, parsed);
    }

    if (name.endsWith('.csv') || name.endsWith('.tsv') || file.type === 'text/csv'){
      await loadPapa();
      return new Promise((res, rej) => {
        window.Papa.parse(file, { header: true, skipEmptyLines: true,
          complete: r => res({ kind: 'table', headers: (r.meta && r.meta.fields) || [], rows: r.data || [],
                               grid: [(r.meta && r.meta.fields) || []].concat((r.data || []).map(o => Object.values(o))) }),
          error: rej });
      });
    }

    await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const arr = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const rawHeaders = (arr[0] || []).map(h => String(h).trim());
    const rows = arr.slice(1).map(r => { const o = {}; rawHeaders.forEach((h, i) => { if (h !== '') o[h] = r[i]; }); return o; });
    // `grid` va aparte: el export de equipo de Wyscout tiene encabezados que abarcan
    // varias columnas, y esa forma se pierde al pasarla a objetos por nombre de columna.
    return { kind: 'table', headers: rawHeaders.filter(h => h !== ''), rows, grid: arr };
  }

  async function fetchPlayers(){
    if (_players) return _players;
    try {
      let q = window.sb.from('players').select('id, first_name, last_name, number').eq('club_id', _clubId).is('archived_at', null);
      if (_teamId) q = q.eq('team_id', _teamId);
      const { data } = await q;
      _players = data || [];
    } catch (_) { _players = []; }
    return _players;
  }
  function playerLookups(){
    const nameToId = {}, numToId = {};
    (_players || []).forEach(p => {
      const full = _norm(`${p.first_name || ''} ${p.last_name || ''}`);
      if (full) nameToId[full] = p.id;
      if (p.number != null && String(p.number).trim() !== '') numToId[String(p.number).trim()] = p.id;
    });
    return { nameToId, numToId };
  }
  function mappedVal(row, target){
    for (const h in _mapping){ if (_mapping[h] === target){ const v = row[h]; if (v != null && String(v).trim() !== '') return String(v).trim(); } }
    return null;
  }
  function resolvePlayer(row, lk){
    let name = mappedVal(row, 'player_name');
    if (!name){ const f = mappedVal(row, 'player_first'), l = mappedVal(row, 'player_last'); if (f || l) name = `${f || ''} ${l || ''}`.trim(); }
    if (name){ const id = lk.nameToId[_norm(name)]; if (id) return { id, name }; }
    const jersey = mappedVal(row, 'jersey');
    if (jersey){ const id = lk.numToId[String(jersey).replace(/[^0-9]/g, '')] || lk.numToId[String(jersey).trim()]; if (id) return { id, name: name || ('#' + jersey) }; }
    return { id: null, name: name || (jersey ? ('#' + jersey) : tt('match_reports.unnamed', '(unnamed)')) };
  }
  function computeMatch(lk){
    let matched = 0, unmatched = 0; const unmatchedNames = [];
    (_parsed.rows || []).forEach(row => { const r = resolvePlayer(row, lk);
      if (r.id) matched++; else { unmatched++; if (unmatchedNames.length < 5) unmatchedNames.push(r.name); } });
    return { matched, unmatched, unmatchedNames, total: (_parsed.rows || []).length };
  }
  function toInt(v){ if (v == null || String(v).trim() === '') return null; const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10); return isFinite(n) ? n : null; }
  function toFloat(v){ if (v == null || String(v).trim() === '') return null; const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : null; }

  function updateStatsSection(){
    const host = $('miStatsSection'); if (!host) return;
    if (!_matchId){
      // El campo se muestra igual, apagado. Antes acá sólo había una línea gris que se
      // leía como un aviso y no como un paso: quedaba la sensación de que la opción de
      // subir el archivo no existía.
      host.innerHTML = `
        <div class="mi-stats-h">${esc(tt('match_reports.stats_import', 'Import stats'))}</div>
        <p class="mi-hint">${esc(tt('match_reports.stats_import_hint',
          'Player stats (CSV/Excel, or a Wyscout event XML), or a Wyscout Team Stats export for team metrics. The file is recognised on its own.'))}</p>
        <div class="mi-row" style="align-items:flex-end">
          <label class="mi-field" style="flex:0 0 150px"><span class="mi-l">${esc(tt('match_reports.provider', 'Provider'))}</span>
            <select class="cm-select" disabled><option>${esc(tt('match_reports.provider_generic', 'Generic'))}</option></select></label>
          <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.file_csv_xlsx_xml', 'File (.csv / .xlsx / .xml)'))}</span>
            <input type="file" class="cm-input" disabled></label>
        </div>
        <p class="mi-locked"><i class="ti ti-lock"></i>${esc(tt('match_reports.save_details_first',
          'Fill in the match date and opponent above, then Save — the file upload unlocks right after.'))}</p>`;
      return;
    }
    host.innerHTML = `
      <div class="mi-stats-h">${esc(tt('match_reports.stats_import', 'Import stats'))}</div>
      <p class="mi-hint">${esc(tt('match_reports.stats_import_hint',
        'Player stats (CSV/Excel, or a Wyscout event XML), or a Wyscout Team Stats export for team metrics. The file is recognised on its own.'))}</p>
      <div class="mi-row" style="align-items:flex-end">
        <label class="mi-field" style="flex:0 0 150px"><span class="mi-l">${esc(tt('match_reports.provider', 'Provider'))}</span>
          <select id="miProvider" class="cm-select"><option value="generic">${esc(tt('match_reports.provider_generic', 'Generic'))}</option><option value="wyscout">Wyscout</option></select></label>
        <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.file_csv_xlsx_xml', 'File (.csv / .xlsx / .xml)'))}</span>
          <input id="miFile" type="file" accept=".csv,.tsv,.xlsx,.xls,.xml" class="cm-input"></label>
      </div>
      <div id="miMapWrap" style="display:none"></div>
      <div id="miStatsMsg" class="mi-msg" style="margin-top:8px"></div>`;
    $('miProvider').value = _provider;
    $('miProvider').addEventListener('change', e => { _provider = e.target.value; if (_parsed){ autoMapAll(); renderMapping(); } });
    $('miFile').addEventListener('change', onFile);
  }

  async function onFile(e){
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const msg = $('miStatsMsg'); if (msg){ msg.style.color = 'var(--cm-fg-muted)'; msg.textContent = tt('match_reports.parsing', 'Parsing…'); }
    _teamStats = null; _teamBatch = null; _teamStatsMatch = null;
    try {
      await fetchPlayers();
      _parsed = await parseFile(file);

      // Wyscout tiene dos exports por partido y hacen cosas distintas. El de equipo no
      // se mapea columna por columna: sus 103 métricas ya se conocen por nombre, así que
      // en vez del diálogo de asignación se muestra lo que se encontró y se confirma.
      const W = window.cmWyscoutTeamStats;
      if (W && _parsed.grid && W.looks(_parsed.grid[0] || [])){
        // El mismo archivo puede traer una jornada o media temporada. Se mira primero
        // cuántos partidos hay: con más de uno, tomar las dos primeras filas como los
        // dos lados de un partido le pega al partido abierto las estadísticas de otro.
        const batch = W.parseMatches
          ? W.parseMatches(_parsed.grid, currentOpponentName(), await ourTeamName())
          : null;
        if (batch && batch.matches.length > 1){
          _teamBatch = batch;
          if (msg) msg.textContent = tt('match_reports.ts_batch_checking', 'Checking which ones are already in…');
          await reconcileBatch();
          renderTeamBatch();
          if (msg) msg.textContent = '';
          return;
        }
        const ts = W.parse(_parsed.grid, currentOpponentName());
        if (ts && ts.sides.length){
          _teamStats = ts;
          _teamStatsMatch = (batch && batch.matches[0]) || null;
          renderTeamStats();
          if (msg) msg.textContent = '';
          return;
        }
      }

      if (!_parsed.headers.length){ if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.no_columns_found', 'No columns found in file.'); } return; }
      autoMapAll();
      renderMapping();
      if (msg) msg.textContent = '';
    } catch (err){ if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.parse_error', 'Parse error: {msg}', { msg: (err.message || err) }); } }
  }

  /* El rival ya está escrito en el partido; se usa para saber cuál de las dos filas del
     Excel somos nosotros sin preguntarlo. */
  function currentOpponentName(){
    const el = $('miOpp');                 // el campo "Rival" del formulario de arriba
    return (el && el.value.trim()) || null;
  }

  /* Cómo nos llamamos. Con el rival alcanzaba mientras el archivo traía un partido: el
     otro equipo éramos nosotros. En un acumulado hay ocho rivales distintos y el único
     nombre estable es el propio, así que se lo pregunta a la base una vez. */
  async function ourTeamName(){
    if (_ourName !== undefined) return _ourName;
    _ourName = null;
    try {
      if (_teamId){
        const { data } = await window.sb.from('teams').select('name').eq('id', _teamId).limit(1);
        if (data && data[0]) _ourName = data[0].name || null;
      }
      if (!_ourName && _clubId){
        const { data } = await window.sb.from('clubs').select('name').eq('id', _clubId).limit(1);
        if (data && data[0]) _ourName = data[0].name || null;
      }
    } catch (_e) { _ourName = null; }
    return _ourName;
  }

  /* ── El export acumulado: varios partidos en un archivo ─────────────────────
     Wyscout deja pedir el Team Stats por rango de jornadas y el archivo se ve igual que
     el de un partido, sólo que con más filas. Elegir sin mirar dejaba las estadísticas
     de un rival colgadas de otro partido, y nada en la pantalla lo decía.

     Acá se muestran los partidos que trae el archivo y se cruza cada uno contra la base
     antes de escribir nada: el que ya tiene estadísticas viene destildado, el que existe
     sin ellas se actualiza, y el que no existe se crea con lo que el propio Excel sabe
     (fecha, rival, competición, marcador).
     ────────────────────────────────────────────────────────────────────────── */

  /** Fecha ISO → "5 sep 2026", en el idioma de quien mira. */
  function miDayLabel(iso){
    if (!iso) return '—';
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? String(iso).slice(0, 10) : miMonthDay(d);
  }

  /** Busca cada partido del archivo en la base y decide qué va a pasar con él. */
  async function reconcileBatch(){
    const b = _teamBatch; if (!b) return;
    const dates = b.matches.map(m => m.match_date).filter(Boolean).sort();

    // Se busca por club y rango de fechas, SIN filtrar por equipo: un partido cargado
    // antes de que existieran los equipos tiene team_id en null, y filtrarlo lo dejaría
    // fuera — es decir, lo volvería a crear duplicado.
    let rows = [];
    try {
      let q = window.sb.from('match_results')
        .select('id, match_date, opponent, competition, score_for, score_against, possession')
        .eq('club_id', _clubId);
      if (dates.length) q = q.gte('match_date', dates[0]).lte('match_date', dates[dates.length - 1]);
      const { data } = await q;
      rows = data || [];
    } catch (_e) { rows = []; }

    const taken = {};
    b.matches.forEach(m => {
      m.existing = null;
      if (!m.match_date) return;
      const sameDay = rows.filter(r => String(r.match_date).slice(0, 10) === m.match_date && !taken[r.id]);
      let hit = null;
      if (m.opponent){
        const want = _norm(m.opponent);
        hit = sameDay.find(r => {
          const have = _norm(r.opponent || '');
          return have && (have === want || have.indexOf(want) !== -1 || want.indexOf(have) !== -1);
        }) || null;
      }
      // Un partido de ese día al que nunca se le puso rival: es ése, no hay otro
      // candidato. Con dos sin rival el mismo día no se adivina y se crea uno nuevo.
      if (!hit && sameDay.length === 1 && !sameDay[0].opponent) hit = sameDay[0];
      if (hit){ taken[hit.id] = true; m.existing = hit; }
    });

    const ids = b.matches.map(m => m.existing && m.existing.id).filter(Boolean);
    const withStats = {};
    if (ids.length){
      try {
        const { data } = await window.sb.from('team_match_stats').select('match_id').in('match_id', ids);
        (data || []).forEach(r => { withStats[r.match_id] = true; });
      } catch (_e) {}
    }

    b.matches.forEach(m => {
      if (!m.match_date && !m.existing){ m.state = 'nodate'; m.selected = false; return; }
      m.state = (m.existing && withStats[m.existing.id]) ? 'imported'
              : (m.existing ? 'existing' : 'new');
      // El que ya está cargado viene destildado, pero se puede volver a tildar: subir de
      // nuevo el archivo corregido es la forma de arreglar una importación mal hecha.
      m.selected = m.state !== 'imported';
    });
  }

  function batchSelected(){ return (_teamBatch ? _teamBatch.matches : []).filter(m => m.selected); }

  function renderTeamBatch(){
    const wrap = $('miMapWrap'); if (!wrap || !_teamBatch) return;
    const b = _teamBatch;
    const nAlready = b.matches.filter(m => m.state === 'imported').length;

    // La clase dice el estado además del texto: es lo que mira el test, que no puede
    // depender del idioma en el que esté abierta la app.
    const BADGE = {
      imported: ['is-in',  tt('match_reports.ts_badge_imported', 'already in')],
      existing: ['is-upd', tt('match_reports.ts_badge_update', 'will update')],
      new:      ['is-new', tt('match_reports.ts_badge_create', 'will create')],
      nodate:   ['is-dead', tt('match_reports.ts_badge_nodate', 'no date')],
    };

    const rowHTML = (m, i) => {
      const dead = m.state === 'nodate';
      const badge = BADGE[m.state] || BADGE.new;
      const nMetrics = m.sides.reduce((n, sd) => Math.max(n, Object.keys(sd.stats).length), 0);
      const who = m.opponent
        ? tt('match_reports.ts_vs_name', 'vs {name}', { name: m.opponent })
        : (m.match_label || tt('match_reports.ts_unknown_match', 'Unknown match'));
      const ha = m.home_away === 'home' ? tt('match_reports.home', 'Home')
               : (m.home_away === 'away' ? tt('match_reports.away', 'Away') : '');
      return `
        <label class="mi-ts-m ${dead ? 'is-dead' : (m.selected ? '' : 'is-off')}" data-i="${i}">
          <input type="checkbox" data-i="${i}" ${m.selected ? 'checked' : ''} ${dead ? 'disabled' : ''}>
          <span class="mi-ts-d">${esc(miDayLabel(m.match_date))}</span>
          <b>${esc(who)}</b>
          ${ha ? `<span class="mi-ts-ha">${esc(ha)}</span>` : ''}
          <span class="mi-ts-badge ${badge[0]}">${esc(badge[1])}</span>
          <span class="mi-ts-n">${nMetrics}</span>
        </label>`;
    };

    wrap.style.display = '';
    wrap.innerHTML = `
      <div class="mi-ts">
        <div class="mi-ts-h"><i class="ti ti-stack-2"></i>${esc(tt('match_reports.ts_batch_title',
          '{count} matches in this file', { count: b.matches.length }))}</div>
        <p class="mi-ts-p">${esc(tt('match_reports.ts_batch_hint',
          'This Wyscout export is cumulative — it carries several matches, not just the one you are editing. Pick which ones to import.'))}</p>
        ${nAlready ? `<p class="mi-ts-warn">${esc(tt('match_reports.ts_batch_already',
          '{count} of them already have team stats and come unticked. Tick one to overwrite it.',
          { count: nAlready }))}</p>` : ''}
        ${b.ourTeam ? `<p class="mi-ts-p">${esc(tt('match_reports.ts_batch_ourteam',
          'Our team in the file: {name}', { name: b.ourTeam }))}</p>`
          : `<p class="mi-ts-warn">${esc(tt('match_reports.ts_batch_noteam',
          'Could not tell which side is ours, so the first row of each match was taken as ours. Check before importing.'))}</p>`}
        <div class="mi-ts-tools">
          <button class="mi-ts-lnk" data-sel="all" type="button">${esc(tt('match_reports.ts_sel_all', 'Select all'))}</button><span class="mi-ts-sep">·</span>
          <button class="mi-ts-lnk" data-sel="none" type="button">${esc(tt('match_reports.ts_sel_none', 'Select none'))}</button><span class="mi-ts-sep">·</span>
          <button class="mi-ts-lnk" data-sel="missing" type="button">${esc(tt('match_reports.ts_sel_missing', 'Only the ones missing'))}</button>
        </div>
        <div class="mi-ts-list">${b.matches.map(rowHTML).join('')}</div>
        ${b.unknown && b.unknown.length ? `<p class="mi-ts-warn">${esc(tt('match_reports.ts_unknown_cols',
          '{count} column(s) not recognised and skipped: {list}',
          { count: b.unknown.length, list: b.unknown.slice(0, 3).join(', ') }))}</p>` : ''}
      </div>
      <div class="mi-actions" style="margin-top:10px">
        <span style="flex:1"></span>
        <button id="miImportCancel" class="cm-btn is-outline is-sm" type="button">${esc(tt('common.cancel', 'Cancel'))}</button>
        <button id="miImportTS" class="cm-btn is-primary is-sm" type="button"><i class="ti ti-database-import" style="font-size:14px"></i>${
          esc(tt('match_reports.ts_import_matches', 'Import {count} matches', { count: batchSelected().length }))}</button>
      </div>`;

    wrap.querySelectorAll('.mi-ts-m input').forEach(cb => cb.addEventListener('change', ev => {
      const m = b.matches[Number(ev.target.dataset.i)];
      if (m){ m.selected = ev.target.checked; }
      const row = ev.target.closest('.mi-ts-m');
      if (row) row.classList.toggle('is-off', !ev.target.checked);
      syncBatchBtn();
    }));
    wrap.querySelectorAll('.mi-ts-lnk').forEach(btn => btn.addEventListener('click', () => {
      const how = btn.dataset.sel;
      b.matches.forEach(m => {
        if (m.state === 'nodate'){ m.selected = false; return; }
        m.selected = how === 'all' ? true : (how === 'none' ? false : m.state !== 'imported');
      });
      renderTeamBatch();
    }));
    $('miImportCancel').addEventListener('click', close);
    $('miImportTS').addEventListener('click', doImportBatch);
    syncBatchBtn();
    // La lista aparece al pie de un formulario largo: sin esto queda abajo del pliegue y
    // el aviso de que el archivo trae varias jornadas no lo lee nadie.
    try { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_e) {}
  }

  function syncBatchBtn(){
    const btn = $('miImportTS'); if (!btn) return;
    const n = batchSelected().length;
    btn.disabled = n === 0;
    btn.innerHTML = `<i class="ti ti-database-import" style="font-size:14px"></i>${
      esc(tt('match_reports.ts_import_matches', 'Import {count} matches', { count: n }))}`;
  }

  function tsInt(v){ return (v == null || !isFinite(v)) ? null : Math.round(v); }

  async function doImportBatch(){
    const b = _teamBatch, msg = $('miStatsMsg');
    if (!b) return;
    const sel = batchSelected();
    if (!sel.length) return;
    const btn = $('miImportTS'); if (btn) btn.disabled = true;
    if (msg){ msg.style.color = 'var(--cm-fg-muted)'; msg.textContent = tt('match_reports.ts_batch_importing', 'Importing…'); }

    let uid = null; try { uid = (await window.sb.auth.getUser()).data.user?.id || null; } catch (_e) {}
    let done = 0, created = 0; const failed = [];

    // De a uno: cada partido puede necesitar que antes se cree su fila en match_results,
    // y si uno falla los demás igual entran. Un lote entero que se cae por un partido
    // raro obliga a repetir todo el trabajo.
    for (const m of sel){
      const us = m.sides.find(sd => sd.side === 'us');
      const them = m.sides.find(sd => sd.side === 'them') || null;
      try {
        let matchId = m.existing ? m.existing.id : null;
        if (!matchId){
          if (!m.match_date) throw new Error(tt('match_reports.ts_badge_nodate', 'no date'));
          const gf = us ? us.stats.goals : null;
          const ga = (them && them.stats.goals != null) ? them.stats.goals : (us ? us.stats.conceded_goals : null);
          const res = await window.sb.from('match_results').insert({
            club_id: _clubId, team_id: _teamId || null,
            match_date: m.match_date,
            competition: m.competition || null,
            opponent: m.opponent || null,
            home_away: m.home_away || null,
            score_for: tsInt(gf), score_against: tsInt(ga),
            possession: us && us.stats.possession_pct != null ? Math.round(us.stats.possession_pct) : null,
            formation: (us && us.formation) || null,
            created_by: uid,
          }).select('id').single();
          if (res.error) throw res.error;
          matchId = res.data.id;
          created++;
        } else {
          // El partido ya estaba: se completan sólo los huecos, nunca se pisa un dato
          // que alguien cargó a mano.
          await fillMatchFromSides(matchId, us, them);
        }

        const payloads = m.sides.map(sd => ({
          club_id: _clubId, match_id: matchId, side: sd.side,
          team_name: sd.team_name || null, formation: sd.formation || null,
          stats: sd.stats, source: 'wyscout_xlsx',
        }));
        const up = await window.sb.from('team_match_stats').upsert(payloads, { onConflict: 'match_id,side' });
        if (up.error) throw up.error;
        m.existing = m.existing || { id: matchId };
        m.state = 'imported'; m.selected = false;
        done++;
      } catch (e){
        failed.push((m.opponent || miDayLabel(m.match_date)) + ': ' + (e.message || e));
      }
    }

    if (msg){
      const parts = [];
      if (done) parts.push(tt('match_reports.ts_batch_done', '✓ {count} matches imported', { count: done }));
      if (created) parts.push(tt('match_reports.ts_batch_created', '{count} created', { count: created }));
      if (failed.length) parts.push(tt('match_reports.ts_batch_failed', '{count} failed: {list}',
        { count: failed.length, list: failed.slice(0, 2).join(' · ') }));
      msg.style.color = failed.length ? 'var(--cm-danger)' : 'var(--cm-success)';
      msg.textContent = parts.join(' · ');
    }
    if (done && !failed.length){ close(); location.reload(); return; }
    // Con algo fallado no se recarga: la lista se vuelve a dibujar con lo que sí entró
    // ya destildado, para poder reintentar sólo lo que quedó afuera. El mensaje vive
    // fuera de #miMapWrap, así que sobrevive al redibujado.
    renderTeamBatch();
  }

  /* ── El export de equipo: confirmar, no mapear ─────────────────────────────── */
  function renderTeamStats(){
    const wrap = $('miMapWrap'); if (!wrap || !_teamStats) return;
    const W = window.cmWyscoutTeamStats;
    const sides = _teamStats.sides;
    const nMetrics = sides.reduce((m, s) => Math.max(m, Object.keys(s.stats).length), 0);

    const sideRow = s => `
      <div class="mi-ts-side">
        <span class="mi-ts-tag ${s.side === 'us' ? 'is-us' : ''}">${esc(s.side === 'us'
          ? tt('match_reports.ts_our_team', 'Our team')
          : tt('match_reports.ts_opponent', 'Opponent'))}</span>
        <b>${esc(s.team_name)}</b>
        ${s.formation ? `<span class="mi-ts-form">${esc(s.formation)}</span>` : ''}
        <span class="mi-ts-n">${Object.keys(s.stats).length}</span>
      </div>`;

    // Un vistazo a tres métricas, para que se vea que los números llegaron bien antes
    // de guardar nada.
    const peek = ['possession_pct', 'xg', 'ppda'].filter(k => sides.some(s => s.stats[k] != null));
    const peekHTML = peek.map(k => `<span class="mi-ts-peek"><i>${esc(W.label(k))}</i>${
      sides.map(s => `<b>${esc(W.format(k, s.stats[k]))}</b>`).join('<u>·</u>')}</span>`).join('');

    wrap.style.display = '';
    wrap.innerHTML = `
      <div class="mi-ts">
        <div class="mi-ts-h"><i class="ti ti-table-import"></i>${esc(tt('match_reports.ts_detected', 'Wyscout team stats'))}</div>
        <p class="mi-ts-p">${esc(tt('match_reports.ts_detected_hint',
          'Team-level metrics for both sides. They fill the match comparison and the season trend — player stats are not touched.'))}</p>
        ${sides.map(sideRow).join('')}
        ${_teamStats.matched ? '' : `<p class="mi-ts-warn">${esc(tt('match_reports.ts_guessed_sides',
          'Could not match either team to this match’s opponent, so the first row was taken as ours. Check before importing.'))}</p>`}
        ${mismatchWarning()}
        <div class="mi-ts-peeks">${peekHTML}</div>
        ${_teamStats.unknown && _teamStats.unknown.length ? `<p class="mi-ts-warn">${esc(tt('match_reports.ts_unknown_cols',
          '{count} column(s) not recognised and skipped: {list}',
          { count: _teamStats.unknown.length, list: _teamStats.unknown.slice(0, 3).join(', ') }))}</p>` : ''}
      </div>
      <div class="mi-actions" style="margin-top:10px">
        <span style="flex:1"></span>
        <button id="miImportCancel" class="cm-btn is-outline is-sm" type="button">${esc(tt('common.cancel', 'Cancel'))}</button>
        <button id="miImportTS" class="cm-btn is-primary is-sm" type="button"><i class="ti ti-database-import" style="font-size:14px"></i>${
          esc(tt('match_reports.ts_import_n', `Import ${nMetrics} metrics`, { count: nMetrics }))}</button>
      </div>`;
    $('miImportCancel').addEventListener('click', close);
    $('miImportTS').addEventListener('click', doImportTeamStats);
  }

  /* El archivo trae un solo partido, pero puede no ser el que está abierto: el analista
     baja el export de la última jornada y lo sube desde el partido anterior, y hasta acá
     eso escribía las estadísticas de un partido en otro sin decir nada. Se compara la
     fecha del archivo con la del formulario y se avisa — no se bloquea, porque un
     partido cargado con la fecha corrida es un caso legítimo. */
  function mismatchWarning(){
    const m = _teamStatsMatch; if (!m || !m.match_date) return '';
    const open = ($('miDate') && $('miDate').value || '').slice(0, 10);
    if (!open || open === m.match_date) return '';
    return `<p class="mi-ts-warn">${esc(tt('match_reports.ts_other_match',
      'This file is for the match on {file}{opp}, but the match open here is on {open}. Check before importing.',
      { file: miDayLabel(m.match_date),
        opp: m.opponent ? ' (' + tt('match_reports.ts_vs_name', 'vs {name}', { name: m.opponent }) + ')' : '',
        open: miDayLabel(open) }))}</p>`;
  }

  /**
   * Pasa al partido lo que el export de equipo sabe y el informe todavía no: el marcador
   * y la posesión. Sólo rellena huecos — un valor ya cargado no se pisa, porque puede
   * ser una corrección deliberada de lo que dice el proveedor.
   * @returns {Promise<string[]>} los campos que quedaron completados, para avisar.
   */
  async function fillMatchFromTeamStats(){
    if (!_teamStats || !_matchId) return [];
    return fillMatchFromSides(_matchId,
      _teamStats.sides.find(s => s.side === 'us'),
      _teamStats.sides.find(s => s.side === 'them'));
  }

  /** Lo mismo, para un partido cualquiera del lote. @see fillMatchFromTeamStats */
  async function fillMatchFromSides(matchId, us, them){
    if (!matchId || !us) return [];

    let current = null;
    try {
      const { data } = await window.sb.from('match_results')
        .select('score_for, score_against, possession, competition')
        .eq('id', matchId).limit(1);
      current = (data && data[0]) || null;
    } catch (_e) { return []; }
    if (!current) return [];

    const patch = {}, names = [];
    const gf = us.stats.goals;
    // Los goles en contra salen del rival; si el archivo trajo un solo equipo, los
    // encajados del nuestro dicen lo mismo.
    const ga = (them && them.stats.goals != null) ? them.stats.goals : us.stats.conceded_goals;

    if (current.score_for == null && gf != null && current.score_against == null && ga != null){
      patch.score_for = Math.round(gf);
      patch.score_against = Math.round(ga);
      names.push(tt('match_reports.score', 'score'));
    }
    if (current.possession == null && us.stats.possession_pct != null){
      patch.possession = Math.round(us.stats.possession_pct);
      names.push(tt('match_reports.possession_label', 'possession'));
    }
    if (!names.length) return [];

    try {
      const { error } = await window.sb.from('match_results').update(patch).eq('id', matchId);
      if (error) return [];
    } catch (_e) { return []; }
    return names;
  }

  async function doImportTeamStats(){
    const msg = $('miStatsMsg'); if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = ''; }
    if (!_matchId){ if (msg) msg.textContent = tt('match_reports.save_match_first', 'Save the match first.'); return; }
    if (!_teamStats){ return; }
    const btn = $('miImportTS'); if (btn) btn.disabled = true;
    try {
      const payloads = _teamStats.sides.map(s => ({
        club_id: _clubId, match_id: _matchId, side: s.side,
        team_name: s.team_name || null, formation: s.formation || null,
        stats: s.stats, source: 'wyscout_xlsx',
      }));
      const res = await window.sb.from('team_match_stats')
        .upsert(payloads, { onConflict: 'match_id,side' });
      if (res.error) throw res.error;

      // El archivo también trae el marcador y la posesión, y el partido puede tenerlos
      // en blanco: el encabezado quedaba con dos guiones al lado de una card llena de
      // datos. Se completa SÓLO lo que falte — lo que se cargó a mano manda.
      const filled = await fillMatchFromTeamStats();

      if (msg){
        msg.style.color = 'var(--cm-success)';
        msg.textContent = tt('match_reports.ts_imported', '✓ Team stats imported')
          + (filled.length ? ' · ' + tt('match_reports.ts_also_filled',
              'also filled in: {fields}', { fields: filled.join(', ') }) : '');
      }
      close();
      location.reload();
    } catch (e){
      if (btn) btn.disabled = false;
      if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.import_error', 'Import error: {msg}', { msg: (e.message || e) }); }
    }
  }

  function renderMapping(){
    const wrap = $('miMapWrap'); if (!wrap || !_parsed) return;
    const optionsFor = sel => {
      let o = '';
      STAT_TARGETS.forEach(([k, lab]) => o += `<option value="${k}" ${sel === k ? 'selected' : ''}>${esc(statLabel(k, lab))}</option>`);
      o += `<option value="__extra__" ${sel === '__extra__' ? 'selected' : ''}>${esc(tt('match_reports.map_extra', 'Extra (store in jsonb)'))}</option>`;
      o += `<option value="__ignore__" ${sel === '__ignore__' ? 'selected' : ''}>${esc(tt('match_reports.map_ignore', '— Ignore —'))}</option>`;
      return o;
    };
    const th = 'text-align:left;padding:6px 8px;font:600 10px/1 var(--cm-font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--cm-fg-muted);background:var(--cm-bg-soft)';
    const rowsHTML = (_parsed.headers || []).map(h => `<tr>
        <td style="padding:4px 8px;font:500 12px/1 var(--cm-font-mono);color:var(--cm-fg)">${esc(h)}</td>
        <td style="padding:4px 8px"><select class="cm-select mi-map" data-h="${esc(h)}" style="width:100%">${optionsFor(_mapping[h])}</select></td>
      </tr>`).join('');
    wrap.style.display = '';
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin:12px 0 6px">
        <span class="mi-l">${esc(tt('match_reports.column_mapping', 'Column mapping'))}</span><span style="flex:1"></span>
        <button id="miReset" class="cm-btn is-outline is-sm" type="button">${esc(tt('match_reports.reset_to_auto', 'Reset to auto'))}</button>
      </div>
      <div style="max-height:240px;overflow:auto;border:1px solid var(--cm-border);border-radius:var(--cm-r-3)">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="${th}">${esc(tt('match_reports.source_column', 'Source column'))}</th><th style="${th}">${esc(tt('match_reports.maps_to', 'Maps to'))}</th></tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <div id="miPreview" style="margin-top:8px;font:500 12px/1.4 var(--cm-font-mono);color:var(--cm-fg-muted)"></div>
      <div class="mi-actions" style="margin-top:8px">
        <span style="flex:1"></span>
        <button id="miImportCancel" class="cm-btn is-outline is-sm" type="button">${esc(tt('common.cancel', 'Cancel'))}</button>
        <button id="miImport" class="cm-btn is-primary is-sm" type="button"><i class="ti ti-database-import" style="font-size:14px"></i>${esc(tt('match_reports.import_btn', 'Import'))}</button>
      </div>`;
    wrap.querySelectorAll('.mi-map').forEach(s => s.addEventListener('change', ev => { _mapping[ev.target.dataset.h] = ev.target.value; updatePreview(); }));
    $('miReset').addEventListener('click', () => { autoMapAll(); renderMapping(); });
    $('miImportCancel').addEventListener('click', close);
    $('miImport').addEventListener('click', doImport);
    updatePreview();
  }

  function updatePreview(){
    const lk = playerLookups(), st = computeMatch(lk), pv = $('miPreview');
    if (pv) pv.innerHTML = tt('match_reports.preview_summary', `${st.total} rows · ${st.matched} players matched · ${st.unmatched} unmatched`, { total: st.total, matched: st.matched, unmatched: st.unmatched })
      + (st.unmatchedNames.length ? ` <span style="color:var(--cm-fg-faint)">(${st.unmatchedNames.map(esc).join(', ')}${st.unmatched > st.unmatchedNames.length ? '…' : ''})</span>` : '');
    const btn = $('miImport'); if (btn) { btn.disabled = st.matched < 1; btn.textContent = ''; btn.innerHTML = `<i class="ti ti-database-import" style="font-size:14px"></i>${esc(tt('match_reports.import_n_players', `Import ${st.matched} player${st.matched === 1 ? '' : 's'}`, { count: st.matched }))}`; }
  }

  async function doImport(){
    const msg = $('miStatsMsg'); if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = ''; }
    if (!_matchId){ if (msg) msg.textContent = tt('match_reports.save_match_first', 'Save the match first.'); return; }
    const lk = playerLookups();
    const byPlayer = {}; // dedupe by player_id — last row wins
    (_parsed.rows || []).forEach(row => {
      const r = resolvePlayer(row, lk); if (!r.id) return;
      const extra = {};
      for (const h in _mapping){ if (_mapping[h] === '__extra__'){ const v = row[h]; if (v != null && String(v).trim() !== '') extra[_slug(h)] = String(v).trim(); } }
      const g = t => mappedVal(row, t);
      // Build the row from the SPORT's box score: cmMatchStats puts each value in its
      // column when there is one, and in `extra` otherwise. Unmapped columns the user
      // flagged as extra are preserved alongside.
      const values = {};
      (window.cmMatchStats ? window.cmMatchStats.fields() : []).forEach(f => {
        const raw = g(f.key);
        if (raw != null && String(raw).trim() !== '') values[f.key] = raw;
      });
      const base = { club_id: _clubId, match_id: _matchId, player_id: r.id,
                     position: g('position') || null, extra };
      byPlayer[r.id] = window.cmMatchStats
        ? window.cmMatchStats.toRow(values, base)
        : Object.assign(base, {
            minutes: toInt(g('minutes')),
            goals: toInt(g('goals')) || 0, assists: toInt(g('assists')) || 0,
            yellow_cards: toInt(g('yellow_cards')) || 0, red_cards: toInt(g('red_cards')) || 0,
            rating: toFloat(g('rating')),
          });
    });
    const payloads = Object.values(byPlayer);
    if (!payloads.length){ if (msg) msg.textContent = tt('match_reports.no_matched_players', 'No matched players to import.'); return; }
    try {
      const res = await window.sb.from('player_match_stats').upsert(payloads, { onConflict: 'match_id,player_id' });
      if (res.error) throw res.error;

      // Recount accumulated sanctions and warn the staff about anyone who just reached a
      // suspension — or is one card away. Until this existed you could record a yellow and
      // nothing anywhere added it up. Never blocks the import: if it fails, the stats are
      // still saved.
      let alerts = [];
      try {
        const names = {};
        (_players || []).forEach(p => { names[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' '); });
        alerts = await window.cmSanctionsSync?.afterMatchSaved({ clubId: _clubId, playerNames: names }) || [];
      } catch (_e) {}

      if (msg){
        msg.style.color = 'var(--cm-success)';
        let txt = tt('match_reports.imported_n_players', `✓ Imported ${payloads.length} player${payloads.length === 1 ? '' : 's'}`, { count: payloads.length });
        if (alerts.length) txt += ' · ' + tt('sanctions.n_alerts', `${alerts.length} sanction alert(s)`, { count: alerts.length });
        msg.textContent = txt;
      }
      close();
      location.reload();
    } catch (e){ if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.import_error', 'Import error: {msg}', { msg: (e.message || e) }); } }
  }

  window.matchImport = { open, close };
})();
