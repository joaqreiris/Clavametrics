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
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  let _sessions = [], _clubId = null, _teamId = null;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function sessLabel(s){
    let d = '';
    if (s.session_date){ const dt = new Date(String(s.session_date).slice(0,10) + 'T00:00:00');
      d = isNaN(dt) ? String(s.session_date).slice(0,10) : `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`; }
    return [d, s.title].filter(Boolean).join(' · ') || 'Match session';
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
    `;
    const el = document.createElement('style'); el.id = 'mi-styles'; el.textContent = css;
    document.head.appendChild(el);
  }

  async function open(){
    const host = $('impForm');
    if (!host) return;
    showDrawer();
    injectStyles();
    host.innerHTML = '<div style="padding:18px 4px;color:var(--cm-fg-faint);font:var(--cm-body-sm)">Loading…</div>';
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
    const opts = ['<option value="">— No session (standalone) —</option>']
      .concat(_sessions.map(s => `<option value="${esc(s.id)}" data-date="${esc(s.session_date || '')}">${esc(sessLabel(s))}</option>`))
      .join('');
    host.innerHTML = `
      <div class="mi-form">
        <label class="mi-field"><span class="mi-l">Match session</span>
          <select id="miSession" class="cm-select">${opts}</select></label>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">Match date *</span><input id="miDate" type="date" class="cm-input" required></label>
          <label class="mi-field"><span class="mi-l">Home / Away</span>
            <select id="miHA" class="cm-select"><option value="">—</option><option value="home">Home</option><option value="away">Away</option></select></label>
        </div>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">Opponent</span><input id="miOpp" class="cm-input" placeholder="Opponent name"></label>
          <label class="mi-field"><span class="mi-l">Competition</span><input id="miComp" class="cm-input" placeholder="League · Cup…"></label>
        </div>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">Score for</span><input id="miSF" type="number" min="0" step="1" class="cm-input"></label>
          <label class="mi-field"><span class="mi-l">Score against</span><input id="miSA" type="number" min="0" step="1" class="cm-input"></label>
          <label class="mi-field"><span class="mi-l">Possession %</span><input id="miPos" type="number" min="0" max="100" step="1" class="cm-input"></label>
        </div>
        <div class="mi-row">
          <label class="mi-field"><span class="mi-l">Formation</span><input id="miForm" class="cm-input" placeholder="4-3-3"></label>
          <label class="mi-field"><span class="mi-l">Venue</span><input id="miVenue" class="cm-input"></label>
        </div>
        <label class="mi-field"><span class="mi-l">Notes</span><textarea id="miNotes" class="cm-input" rows="2"></textarea></label>
        <div class="mi-actions">
          <span id="miMsg" class="mi-msg"></span>
          <span style="flex:1"></span>
          <button id="miCancel" class="cm-btn is-outline is-sm" type="button">Cancel</button>
          <button id="miSave" class="cm-btn is-primary is-sm" type="button"><i class="ti ti-device-floppy" style="font-size:14px"></i>Save</button>
        </div>
      </div>`;
    $('miSession').addEventListener('change', onSessionChange);
    $('miCancel').addEventListener('click', close);
    $('miSave').addEventListener('click', save);
  }

  async function onSessionChange(e){
    const sel = e.target, sid = sel.value, opt = sel.options[sel.selectedIndex];
    if (sid) {
      if (opt && opt.dataset.date) $('miDate').value = String(opt.dataset.date).slice(0, 10);
      try {
        const { data } = await window.sb.from('match_results').select('*')
          .eq('club_id', _clubId).eq('session_id', sid).limit(1);
        fillFrom(data && data[0], true);   // edit mode (keep prefilled date if no row date)
      } catch (_) {}
    } else {
      fillFrom(null, false);
    }
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
    if (!date) { if (msg) msg.textContent = 'Match date is required'; return; }

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
        ? await window.sb.from('match_results').upsert(payload, { onConflict: 'session_id' })
        : await window.sb.from('match_results').insert(payload);
      if (res.error) throw res.error;
      if (msg){ msg.style.color = 'var(--cm-success)'; msg.textContent = '✓ Saved'; }
      close();
      location.reload();
    } catch (e) {
      if (msg){ msg.style.color = 'var(--cm-danger)'; msg.textContent = 'Error: ' + (e.message || e); }
    }
  }

  window.matchImport = { open, close };
})();
