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
    host.innerHTML = `<div style="padding:18px 4px;color:var(--cm-fg-faint);font:var(--cm-body-sm)">${esc(tt('common.loading', 'Loading…'))}</div>`;
    try {
      _clubId = await window.getClubId();
      const teamSel = $('mrTeamSelect');
      _teamId = (teamSel && teamSel.value) || null;
      let q = window.sb.from('training_sessions')
        .select('id, title, session_date')
        .eq('club_id', _clubId).eq('session_type', 'Match')
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
  const STAT_TARGETS = [
    ['player_name','Player name (match)'],
    ['player_first','First name (match)'],
    ['player_last','Last name (match)'],
    ['jersey','Jersey # (match)'],
    ['minutes','Minutes'],
    ['goals','Goals'],
    ['assists','Assists'],
    ['yellow_cards','Yellow cards'],
    ['red_cards','Red cards'],
    ['rating','Rating'],
    ['position','Position'],
  ];
  // Localized display label for a stat target key (falls back to the EN label above).
  function statLabel(k, fallbackEN){ return tt('match_reports.stat_' + k, fallbackEN); }
  const TARGET_ORDER = STAT_TARGETS.map(t => t[0]); // autoMap priority
  const ALIASES_GENERIC = {
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
  };
  // Wyscout preset = generic + Wyscout's exact export headers.
  const ALIASES_WYSCOUT = (function(){
    const w = {}; for (const k in ALIASES_GENERIC) w[k] = ALIASES_GENERIC[k].slice();
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
    for (const key of TARGET_ORDER){ if ((dict[key]||[]).map(_norm).includes(nh)) return key; }
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

  async function parseFile(file){
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.tsv') || file.type === 'text/csv'){
      await loadPapa();
      return new Promise((res, rej) => {
        window.Papa.parse(file, { header: true, skipEmptyLines: true,
          complete: r => res({ headers: (r.meta && r.meta.fields) || [], rows: r.data || [] }),
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
    return { headers: rawHeaders.filter(h => h !== ''), rows };
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
      host.innerHTML = `<div class="mi-stats-h">${esc(tt('match_reports.player_stats_import', 'Player stats import'))}</div>
        <div style="color:var(--cm-fg-faint);font:var(--cm-body-sm)">${esc(tt('match_reports.save_details_first', 'Save the match details first.'))}</div>`;
      return;
    }
    host.innerHTML = `
      <div class="mi-stats-h">${esc(tt('match_reports.player_stats_import', 'Player stats import'))}</div>
      <div class="mi-row" style="align-items:flex-end">
        <label class="mi-field" style="flex:0 0 150px"><span class="mi-l">${esc(tt('match_reports.provider', 'Provider'))}</span>
          <select id="miProvider" class="cm-select"><option value="generic">${esc(tt('match_reports.provider_generic', 'Generic'))}</option><option value="wyscout">Wyscout</option></select></label>
        <label class="mi-field"><span class="mi-l">${esc(tt('match_reports.file_csv_xlsx', 'File (.csv / .xlsx)'))}</span>
          <input id="miFile" type="file" accept=".csv,.xlsx,.xls" class="cm-input"></label>
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
    try {
      await fetchPlayers();
      _parsed = await parseFile(file);
      if (!_parsed.headers.length){ if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.no_columns_found', 'No columns found in file.'); } return; }
      autoMapAll();
      renderMapping();
      if (msg) msg.textContent = '';
    } catch (err){ if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = tt('match_reports.parse_error', 'Parse error: {msg}', { msg: (err.message || err) }); } }
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
      const gi = t => { const n = toInt(g(t)); return n == null ? 0 : n; };
      byPlayer[r.id] = {
        club_id: _clubId, match_id: _matchId, player_id: r.id,
        minutes: toInt(g('minutes')),
        goals: gi('goals'), assists: gi('assists'),
        yellow_cards: gi('yellow_cards'), red_cards: gi('red_cards'),
        rating: toFloat(g('rating')),
        position: g('position') || null,
        extra,
      };
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
