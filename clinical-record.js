// clinical-record.js — Clinical record (player) bootstrap.
// Header + left rail wired to real data (migration 113 tables, club-scoped, gated to
// medical role by RLS). To avoid a flash of the preview's hardcoded mock values,
// resetRegions() runs SYNCHRONOUSLY before any fetch and blanks every data-driven
// region to a neutral placeholder ("—" / "No records" / hidden). Real values are
// written only after each query resolves; an empty/RLS-denied query keeps the
// placeholder, never the preview value.
// Tabs work; KPIs, timeline, body map and the right-hand panels stay in their empty
// state for now — wired in later steps.
(function () {
  'use strict';

  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const EMPTY = '<span style="font:var(--cm-body-sm);color:var(--cm-fg-faint)">None recorded</span>';
  const DASH = '<span style="font:var(--cm-body-sm);color:var(--cm-fg-faint)">—</span>';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const setHTML = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v == null ? '' : v); };
  const setChk = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };
  const arr = v => Array.isArray(v) ? v : [];
  const emptyRow = cols => '<tr><td colspan="' + cols + '" class="cr-empty">No records</td></tr>';
  const emptyBlock = () => '<div class="cr-empty">No records</div>';

  const _today = new Date(); _today.setHours(0, 0, 0, 0);
  const todayISO = () => _today.getFullYear() + '-' +
    String(_today.getMonth() + 1).padStart(2, '0') + '-' + String(_today.getDate()).padStart(2, '0');
  function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
  }
  function daysFromToday(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((d - _today) / 86400000);
  }
  const isSevere = a => /(sever|anaph)/i.test((a && a.severity) || '');

  const mainEl = () => document.querySelector('.hub-main');
  const doneLoading = () => { const m = mainEl(); if (m) m.classList.remove('is-loading'); };

  // ── Body-map coordinates (copied VERBATIM from Injuries.html — do not edit) ──
const BODY_COORDS = {
  'head':             { ant:[50,10],  post:[50,10]  },
  'neck':             { ant:[50,21],  post:[50,21]  },
  'chest':            { ant:[50,46],  post:null       },
  'upper back':       { ant:null,     post:[50,41]  },
  'abdomen':          { ant:[50,62],  post:null       },
  'lower back':       { ant:null,     post:[50,65]  },
  'groin':            { ant:[50,78],  post:null       },
  'right shoulder':   { ant:[29,32],  post:[71,32]  },
  'left shoulder':    { ant:[71,32],  post:[29,32]  },
  'shoulder':         { ant:[50,32],  post:[50,32]  },
  'right arm':        { ant:[26,52],  post:[74,52]  },
  'left arm':         { ant:[74,52],  post:[26,52]  },
  'right elbow':      { ant:[24,63],  post:[76,63]  },
  'left elbow':       { ant:[76,63],  post:[24,63]  },
  'right wrist':      { ant:[22,73],  post:[78,73]  },
  'left wrist':       { ant:[78,73],  post:[22,73]  },
  'right hip':        { ant:[37,90],  post:[63,90]  },
  'left hip':         { ant:[63,90],  post:[37,90]  },
  'hip':              { ant:[50,90],  post:[50,90]  },
  'right glute':      { ant:null,     post:[38,100] },
  'left glute':       { ant:null,     post:[62,100] },
  'glute':            { ant:null,     post:[50,100] },
  'right thigh':      { ant:[39,113], post:null      },
  'left thigh':       { ant:[61,113], post:null      },
  'thigh':            { ant:[50,113], post:null      },
  'right adductor':   { ant:[42,110], post:null      },
  'left adductor':    { ant:[58,110], post:null      },
  'adductor':         { ant:[50,110], post:null      },
  'right hamstring':  { ant:null,     post:[39,118] },
  'left hamstring':   { ant:null,     post:[61,118] },
  'hamstring':        { ant:null,     post:[50,118] },
  'right knee':       { ant:[39,137], post:[39,137] },
  'left knee':        { ant:[61,137], post:[61,137] },
  'knee':             { ant:[50,137], post:[50,137] },
  'right calf':       { ant:null,     post:[39,157] },
  'left calf':        { ant:null,     post:[61,157] },
  'calf':             { ant:null,     post:[50,157] },
  'right shin':       { ant:[39,154], post:null      },
  'left shin':        { ant:[61,154], post:null      },
  'shin':             { ant:[50,154], post:null      },
  'right achilles':   { ant:null,     post:[39,169] },
  'left achilles':    { ant:null,     post:[61,169] },
  'achilles':         { ant:null,     post:[50,169] },
  'right ankle':      { ant:[39,180], post:[39,180] },
  'left ankle':       { ant:[61,180], post:[61,180] },
  'ankle':            { ant:[50,180], post:[50,180] },
  'right foot':       { ant:[39,193], post:[39,193] },
  'left foot':        { ant:[61,193], post:[61,193] },
  'foot':             { ant:[50,193], post:[50,193] },
};

function getBodyCoords(area) {
  if (!area) return null;
  const k = area.toLowerCase().trim();
  if (BODY_COORDS[k]) return BODY_COORDS[k];
  for (const [key, val] of Object.entries(BODY_COORDS)) {
    if (k.includes(key) || key.includes(k)) return val;
  }
  return null;
}

  // ── Body heatmap + injury-history state (injuries fetched once, in the Overview) ──
  let _injuries = [];
  let _bodyView = 'front';      // #bodymap-overview Front/Back view
  let _injView = 'front';       // #bodymap-injuries Front/Back view
  let _profile = null;          // player_medical_profile row (reused for sex)
  let _bodySex = 'male';        // silhouette sex: 'male' | 'female'
  let _playerId = null;
  let _clubId = null;
  let _meds = [];               // player_medications rows (for the manage modal)
  let _editingMedId = null;     // id being edited in the meds form, or null (insert)
  let _screenings = [];         // medical_screenings rows (for the manage modal)
  let _editingScrId = null;     // id being edited in the screenings form, or null (insert)
  let _episodes = [];           // medical_episodes rows
  let _editingEpId = null;      // id being edited in the episode form, or null (insert)
  let _editingEpDetail = null;  // existing detail jsonb preserved across an edit
  let _surgeries = [];          // surgeries rows
  let _editingSurgId = null;    // id being edited in the surgery form, or null (insert)
  let _studies = [];            // medical_studies rows
  let _editingStudyId = null;   // id being edited in the study form, or null (insert)
  let _documents = [];          // medical_documents rows
  let _editingDocId = null;     // id being edited in the document form, or null (insert)

  // shared "— None — + one option per player injury" filler for related-injury selects
  function fillInjurySelect(selId, selected) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const opts = ['<option value="">— None —</option>'];
    arr(_injuries).forEach(i => {
      if (!i || !i.id) return;
      const label = (i.sub_classification || i.injury_type || 'Injury') +
        (i.body_area ? ' · ' + i.body_area : '') + (i.start_date ? ' · ' + (fmtDate(i.start_date) || '') : '');
      opts.push('<option value="' + esc(i.id) + '"' + (String(selected) === String(i.id) ? ' selected' : '') + '>' + esc(label) + '</option>');
    });
    sel.innerHTML = opts.join('');
  }

  // small inline edit (pencil) button for table rows — data-id + given class
  const editBtn = (id, cls) => '<button type="button" class="' + cls + '" data-id="' + esc(id) +
    '" title="Edit" style="border:1px solid var(--cm-border);background:transparent;color:var(--cm-fg-muted);border-radius:var(--cm-r-2);width:28px;height:28px;cursor:pointer;line-height:1"><i class="ti ti-pencil"></i></button>';
  const SEV_RANK = { minor: 1, moderate: 2, severe: 3 };
  const SEV_COLOR = { severe: 'var(--cm-danger)', moderate: 'var(--cm-warning)', minor: '#EA580C' };

  const overviewCard = () => document.getElementById('bodymap-overview');
  const injuriesCard = () => document.getElementById('bodymap-injuries');

  // Sex is 'female' only if the profile row explicitly says so; anything else
  // (male, null, no row) falls back to 'male'.
  const currentBodySex = () => (_profile && _profile.sex === 'female') ? 'female' : 'male';
  function setSilhouette(card, view) {
    const img = card && card.querySelector('.body-img');
    if (img) img.src = 'assets/body-' + _bodySex + '-' + view + '.png';
  }
  function applySexActive() {
    document.querySelectorAll('#cr-sexToggle button[data-sex]')
      .forEach(b => b.classList.toggle('is-active', b.dataset.sex === _bodySex));
  }

  // Draw the injury heatmap into a given #bodymap-* card, looking up its own
  // .body-img / .body-hotspots (no fixed ids). Hotspots are identical across
  // cards; only the silhouette changes with sex/view.
  function renderHeatmap(card, view) {
    const svg = card && card.querySelector('.body-hotspots');
    if (!svg) return;
    const groups = {};
    arr(_injuries).forEach(inj => {
      if (!inj || !inj.body_area) return;
      const k = String(inj.body_area).toLowerCase().trim();
      if (!k) return;
      const g = groups[k] || (groups[k] = { area: inj.body_area, total: 0, worst: 'minor', active: false });
      g.total++;
      const sev = String(inj.severity || 'minor').toLowerCase();
      if ((SEV_RANK[sev] || 0) > (SEV_RANK[g.worst] || 0)) g.worst = sev;
      if (inj.status === 'active' || inj.status === 'returning') g.active = true;
    });

    let html = '';
    Object.values(groups).forEach(g => {
      const coords = getBodyCoords(g.area);
      if (!coords) return;
      const pt = view === 'back' ? coords.post : coords.ant;
      if (!pt) return;
      const color = SEV_COLOR[g.worst] || '#EA580C';
      const r = g.total >= 3 ? 5.5 : 4;
      const pulseCls = g.active ? ' pulse' : '';
      const tip = g.area + ' · ' + g.total + ' ' + (g.total === 1 ? 'injury' : 'injuries') + ' · worst: ' + g.worst;
      const cx = pt[0], cy = pt[1];
      html += '<circle data-area="' + esc(g.area) + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color +
        '" stroke="var(--cm-surface)" stroke-width="1.5" class="hot-dot' + pulseCls + '"><title>' + esc(tip) + '</title></circle>';
      if (g.total > 1) {
        html += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" ' +
          'font-size="5.5" font-weight="700" fill="white" pointer-events="none">' + (g.total > 9 ? '9+' : g.total) + '</text>';
      }
    });
    svg.innerHTML = html;
  }

  function paintCard(card, view) { setSilhouette(card, view); renderHeatmap(card, view); }

  // ── Injury-history tab: mappings, season helper, filters & table ────────────
  const TISSUE = { muscular: 'Muscle', acl: 'ACL', ligament: 'Ligament', tendon: 'Tendon', bone: 'Bone', other: 'Other' };
  const MECH = { contact: 'Contact', non_contact: 'Non-contact', overuse: 'Overuse', unknown: '—' };
  const SEV_PILL = { minor: '', moderate: 'is-warning', severe: 'is-danger' };
  const STATUS_PILL = { active: ['is-danger', 'Active'], returning: ['is-warning', 'Returning'], cleared: ['is-success', 'Resolved'] };
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  // Football season (Aug 1 → Jul 31) label from a date → "2025/26".
  function seasonLabel(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const startY = d.getMonth() >= 7 ? y : y - 1; // month index 7 = Aug
    return startY + '/' + String(startY + 1).slice(2);
  }

  function tissueLabel(inj) { return inj.injury_category ? (TISSUE[inj.injury_category] || 'Other') : null; }

  function mechLabel(inj) {
    if (inj.injury_mechanism) return MECH[inj.injury_mechanism] || '—';
    if (inj.mechanism) return inj.mechanism;
    return '—';
  }

  function daysOut(inj) {
    const start = new Date((inj.start_date || '') + 'T00:00:00');
    if (isNaN(start.getTime())) return 0;
    let end;
    if (inj.returned_date) end = new Date(inj.returned_date + 'T00:00:00');
    else if (inj.status !== 'cleared') end = new Date(_today.getTime());
    else end = inj.expected_return ? new Date(inj.expected_return + 'T00:00:00') : new Date(_today.getTime());
    if (isNaN(end.getTime())) end = new Date(_today.getTime());
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  const selVal = id => { const e = document.getElementById(id); return e ? e.value : 'all'; };

  function fillSelect(id, allLabel, values) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="all">' + allLabel + '</option>' +
      values.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    if (cur && [].some.call(sel.options, o => o.value === cur)) sel.value = cur;
  }

  function populateInjuryFilters() {
    const seasons = new Set(), zones = new Set(), tissues = new Set();
    arr(_injuries).forEach(inj => {
      const s = seasonLabel(inj.start_date); if (s) seasons.add(s);
      if (inj.body_area) zones.add(inj.body_area);
      const t = tissueLabel(inj); if (t) tissues.add(t);
    });
    fillSelect('flt-season', 'All seasons', [...seasons].sort().reverse());
    fillSelect('flt-zone', 'All zones', [...zones].sort());
    fillSelect('flt-tissue', 'All tissue', [...tissues].sort());
  }

  function filteredInjuries() {
    const season = selVal('flt-season'), zone = selVal('flt-zone'), tissue = selVal('flt-tissue');
    return arr(_injuries).filter(inj => {
      if (season && season !== 'all' && seasonLabel(inj.start_date) !== season) return false;
      if (zone && zone !== 'all' && inj.body_area !== zone) return false;
      if (tissue && tissue !== 'all' && tissueLabel(inj) !== tissue) return false;
      return true;
    });
  }

  function renderInjuryTable() {
    const tbody = document.getElementById('inj-tbody');
    if (!tbody) return;
    const rows = filteredInjuries().slice()
      .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
    setText('inj-count', rows.length + ' ' + (rows.length === 1 ? 'injury' : 'injuries'));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="cr-empty">No injuries recorded</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(inj => {
      const sev = String(inj.severity || 'minor').toLowerCase();
      const sevPill = '<span class="cm-pill ' + (SEV_PILL[sev] || '') + '"><span class="cm-dot"></span>' + esc(cap(sev)) + '</span>';
      const st = STATUS_PILL[inj.status] || ['', inj.status || '—'];
      const statusPill = '<span class="cm-pill ' + st[0] + '"><span class="cm-dot"></span>' + esc(st[1]) + '</span>';
      const rtp = inj.returned_date ? esc(fmtDate(inj.returned_date))
        : (inj.expected_return ? '~' + esc(fmtDate(inj.expected_return)) : '—');
      const diagnosis = inj.sub_classification || inj.injury_type || '—';
      return '<tr>' +
        '<td class="c-date">' + esc(fmtDate(inj.start_date) || '—') + '</td>' +
        '<td class="cr-zone">' + esc(inj.body_area || '—') + '</td>' +
        '<td>' + esc(tissueLabel(inj) || '—') + '</td>' +
        '<td class="c-dx">' + esc(diagnosis) + '</td>' +
        '<td class="c-muted">' + esc(mechLabel(inj)) + '</td>' +
        '<td>' + sevPill + '</td>' +
        '<td class="num">' + daysOut(inj) + '</td>' +
        '<td>' + rtp + '</td>' +
        '<td>' + statusPill + '</td>' +
        '</tr>';
    }).join('');
  }

  // ── Surgical history tab ────────────────────────────────────────────────────
  const LAT_SUFFIX = { left: ' · L', right: ' · R', bilateral: ' · Bilateral' };
  function renderSurgeries(rows) {
    rows = arr(rows);
    const tbody = document.getElementById('surg-tbody');
    if (!tbody) return;
    setText('surg-count', rows.length + ' ' + (rows.length === 1 ? 'procedure' : 'procedures'));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="cr-empty">No procedures recorded</td></tr>';
      return;
    }
    const byId = {};
    arr(_injuries).forEach(i => { if (i && i.id) byId[i.id] = i; });
    tbody.innerHTML = rows.map(s => {
      const proc = esc(s.procedure || '—') + (LAT_SUFFIX[s.laterality] || '');
      const sc = [s.surgeon, s.clinic].filter(Boolean).join(' · ');
      let rel = '—';
      if (s.related_injury_id && byId[s.related_injury_id]) {
        const inj = byId[s.related_injury_id];
        rel = esc((inj.sub_classification || inj.injury_type || '—') + ' · ' + (inj.body_area || '—'));
      }
      return '<tr>' +
        '<td class="c-date">' + esc(fmtDate(s.surgery_date) || '—') + '</td>' +
        '<td class="c-dx">' + proc + '</td>' +
        '<td>' + (sc ? esc(sc) : '—') + '</td>' +
        '<td>' + (s.implants ? esc(s.implants) : '—') + '</td>' +
        '<td>' + (s.outcome ? esc(s.outcome) : '—') + '</td>' +
        '<td class="c-muted">' + rel + '</td>' +
        '<td style="text-align:right;width:1%">' + editBtn(s.id, 'surg-edit-btn') + '</td>' +
        '</tr>';
    }).join('');
  }

  // ── Surgical history management (CRUD) modal ────────────────────────────────
  async function loadSurgeries() {
    try {
      const { data } = await window.sb.from('surgeries')
        .select('id,procedure,surgery_date,laterality,surgeon,clinic,implants,outcome,related_injury_id,notes')
        .eq('club_id', _clubId).eq('player_id', _playerId)
        .order('surgery_date', { ascending: false });
      _surgeries = arr(data);
    } catch (_) { _surgeries = []; }
    renderSurgeries(_surgeries);
  }

  function openSurgeryModal(id) {
    const err = document.getElementById('surg-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const s = (id != null) ? (arr(_surgeries).find(x => String(x.id) === String(id)) || null) : null;
    _editingSurgId = s ? s.id : null;
    setVal('surg-procedure', s ? s.procedure : '');
    setVal('surg-date', s ? s.surgery_date : '');
    setVal('surg-laterality', s ? (s.laterality === 'na' ? '' : s.laterality) : '');
    setVal('surg-surgeon', s ? s.surgeon : '');
    setVal('surg-clinic', s ? s.clinic : '');
    setVal('surg-implants', s ? s.implants : '');
    setVal('surg-outcome', s ? s.outcome : '');
    fillInjurySelect('surg-injury', s ? s.related_injury_id : '');
    setVal('surg-notes', s ? s.notes : '');
    const title = document.getElementById('surg-modal-title'); if (title) title.textContent = s ? 'Edit procedure' : 'Add procedure';
    const del = document.getElementById('surg-delete'); if (del) del.style.display = s ? '' : 'none';
    const ov = document.getElementById('modalSurgery'); if (ov) ov.classList.add('is-open');
  }
  function closeSurgeryModal() {
    const ov = document.getElementById('modalSurgery'); if (ov) ov.classList.remove('is-open');
  }

  async function saveSurgery() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const nn = s => (s === '' ? null : s);
    const err = document.getElementById('surg-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }

    const procedure = val('surg-procedure');
    if (!procedure) { if (err) { err.textContent = 'Procedure is required.'; err.style.display = 'block'; } return; }

    const lat = val('surg-laterality');
    const fields = {
      procedure: procedure,
      surgery_date: nn(val('surg-date')),
      laterality: lat === '' ? 'na' : lat,
      surgeon: nn(val('surg-surgeon')),
      clinic: nn(val('surg-clinic')),
      implants: nn(val('surg-implants')),
      outcome: nn(val('surg-outcome')),
      related_injury_id: nn(val('surg-injury')),
      notes: nn(val('surg-notes')),
    };

    const btn = document.getElementById('surg-save'); if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');
      let error;
      if (_editingSurgId) {
        ({ error } = await window.sb.from('surgeries').update(fields).eq('id', _editingSurgId));
      } else {
        ({ error } = await window.sb.from('surgeries')
          .insert(Object.assign({ club_id: _clubId, player_id: _playerId }, fields)));
      }
      if (error) throw error;
      closeSurgeryModal();
      await loadSurgeries();
    } catch (e) {
      console.error('[Clinical record] save surgery failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteSurgery(id) {
    if (!window.confirm('Delete this procedure?')) return;
    const err = document.getElementById('surg-error');
    try {
      const { error } = await window.sb.from('surgeries').delete().eq('id', id);
      if (error) throw error;
      closeSurgeryModal();
      await loadSurgeries();
    } catch (e) {
      console.error('[Clinical record] delete surgery failed', e);
      if (err) { err.textContent = 'Could not delete: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    }
  }

  // ── Illness & episodes tab (illness/other → table, concussion → GRTP log) ────
  const EP_STATUS_PILL = { active: ['is-danger', 'Active'], monitoring: ['is-warning', 'Monitoring'], resolved: ['is-success', 'Resolved'] };
  const epEditBtn = id => '<button type="button" class="ep-edit-btn" data-id="' + esc(id) +
    '" title="Edit" style="border:1px solid var(--cm-border);background:transparent;color:var(--cm-fg-muted);border-radius:var(--cm-r-2);width:28px;height:28px;cursor:pointer;line-height:1"><i class="ti ti-pencil"></i></button>';
  const GRTP_STEPS = [
    'Symptom-limited activity', 'Light aerobic', 'Sport-specific',
    'Non-contact drills', 'Full-contact practice', 'Return to sport',
  ];

  function daysBetween(startIso, endIso) {
    const a = new Date((startIso || '') + 'T00:00:00'), b = new Date((endIso || '') + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  function scatHtml(scat) {
    if (!scat || typeof scat !== 'object') return '';
    const parts = [];
    const push = (label, val) => {
      if (val === undefined || val === null || val === '') return;
      parts.push('<div><div class="cr-mini-lab">' + esc(label) + '</div>' +
        '<div style="font:var(--cm-body-sm);color:var(--cm-fg-strong)">' + esc(String(val)) + '</div></div>');
    };
    push('SCAT baseline', scat.baseline);
    push('SCAT score', scat.score);
    if (!parts.length) return '';
    return '<div style="display:flex;gap:24px;margin:12px 0 4px">' + parts.join('') + '</div>';
  }

  // Editable GRTP ladder — .cr-grtp-n toggles done, .cr-grtp-d holds a date input
  // when done. Each step carries data-ep / data-step so the handlers can locate it.
  function grtpLadder(detail, epId) {
    const gmap = {};
    arr(detail && detail.grtp).forEach(s => { if (s && s.step != null) gmap[s.step] = s; });
    const ep = esc(epId);
    let html = '<div class="cr-grtp">';
    for (let i = 1; i <= 6; i++) {
      const step = gmap[i] || {};
      const label = step.label || GRTP_STEPS[i - 1];
      const done = step.done === true;
      const dateCell = done
        ? '<input type="date" class="cm-input grtp-date" data-ep="' + ep + '" data-step="' + i + '" value="' +
            esc(step.date || todayISO()) + '" style="height:26px;padding:0 6px;font-size:11px">'
        : '<span style="color:var(--cm-fg-faint)">—</span>';
      html += '<div class="cr-grtp-step' + (done ? ' is-done' : '') + '" data-ep="' + ep + '" data-step="' + i + '">' +
        '<div class="cr-grtp-n grtp-toggle" data-ep="' + ep + '" data-step="' + i + '" style="cursor:pointer" title="Toggle step">' + i + '</div>' +
        '<div class="cr-grtp-l">' + esc(label) + '</div>' +
        '<div class="cr-grtp-d">' + dateCell + '</div>' +
        '</div>';
    }
    return html + '</div>';
  }

  function renderEpisodes(rows) {
    rows = arr(rows);
    const illness = rows.filter(e => e && (e.category === 'illness' || e.category === 'other'));
    const concussions = rows.filter(e => e && e.category === 'concussion');

    // ── Illness table ──
    const tbody = document.getElementById('ill-tbody');
    if (tbody) {
      setText('ill-count', illness.length + ' ' + (illness.length === 1 ? 'episode' : 'episodes'));
      if (!illness.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="cr-empty">No episodes recorded</td></tr>';
      } else {
        tbody.innerHTML = illness.map(e => {
          const st = EP_STATUS_PILL[e.status] || ['', e.status || '—'];
          const statusPill = '<span class="cm-pill ' + st[0] + '"><span class="cm-dot"></span>' + esc(st[1]) + '</span>';
          const days = (e.days_lost != null) ? e.days_lost
            : (e.end_date ? (daysBetween(e.start_date, e.end_date) ?? '—') : '—');
          return '<tr>' +
            '<td class="c-date">' + esc(fmtDate(e.start_date) || '—') + '</td>' +
            '<td>' + esc(e.system || '—') + '</td>' +
            '<td class="c-dx">' + esc(e.diagnosis || '—') + '</td>' +
            '<td class="num">' + esc(String(days)) + '</td>' +
            '<td>' + statusPill + '</td>' +
            '<td style="text-align:right;width:1%">' + epEditBtn(e.id) + '</td>' +
            '</tr>';
        }).join('');
      }
    }

    // ── Concussion log ──
    const cbody = document.getElementById('concussion-body');
    if (cbody) {
      if (!concussions.length) {
        cbody.innerHTML = '<div class="cr-empty" style="padding:8px 0">No concussions recorded</div>';
      } else {
        cbody.innerHTML = '<div style="display:flex;flex-direction:column;gap:12px">' + concussions.map(e => {
          const st = EP_STATUS_PILL[e.status] || ['', e.status || '—'];
          const statusPill = '<span class="cm-pill ' + st[0] + '"><span class="cm-dot"></span>' + esc(st[1]) + '</span>';
          const days = (e.days_lost != null) ? String(e.days_lost)
            : (e.end_date ? String(daysBetween(e.start_date, e.end_date) ?? '—') : '—');
          const warn = e.status !== 'resolved' ? ' class="is-warn"' : '';
          return '<div class="cr-conc-card">' +
            '<div style="display:flex;justify-content:flex-end;margin-bottom:2px">' + epEditBtn(e.id) + '</div>' +
            '<div class="cr-kv"><span>Concussion</span><b>' + esc(fmtDate(e.start_date) || '—') + '</b></div>' +
            '<div class="cr-kv"><span>Days lost</span><b' + warn + '>' + esc(days) + '</b></div>' +
            '<div class="cr-kv" style="margin-bottom:6px"><span>Status</span><b>' + statusPill + '</b></div>' +
            scatHtml(e.detail && e.detail.scat) +
            '<div class="cr-mini-lab" style="margin:12px 0 8px">Graduated return to play</div>' +
            grtpLadder(e.detail, e.id) +
            '</div>';
        }).join('') + '</div>';
      }
    }
  }

  // ── Medical episodes management (CRUD) modal ────────────────────────────────
  const CONC_GRTP_INIT = () => ({
    grtp: [
      { step: 1, label: 'Symptom-limited activity', done: false, date: null },
      { step: 2, label: 'Light aerobic exercise', done: false, date: null },
      { step: 3, label: 'Sport-specific exercise', done: false, date: null },
      { step: 4, label: 'Non-contact training drills', done: false, date: null },
      { step: 5, label: 'Full-contact practice', done: false, date: null },
      { step: 6, label: 'Return to sport', done: false, date: null },
    ],
  });

  async function loadEpisodes() {
    try {
      const { data } = await window.sb.from('medical_episodes')
        .select('id,category,system,diagnosis,start_date,end_date,days_lost,status,detail,notes')
        .eq('club_id', _clubId).eq('player_id', _playerId)
        .order('start_date', { ascending: false });
      _episodes = arr(data);
    } catch (_) { _episodes = []; }
    renderEpisodes(_episodes);
  }

  function epToggleCategory() {
    const cat = (document.getElementById('ep-category') || {}).value;
    const sf = document.getElementById('ep-system-field'); if (sf) sf.style.display = cat === 'concussion' ? 'none' : '';
    const note = document.getElementById('ep-conc-note'); if (note) note.style.display = cat === 'concussion' ? 'block' : 'none';
  }

  function openEpisodeModal(id) {
    const err = document.getElementById('ep-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const ep = (id != null) ? (arr(_episodes).find(x => String(x.id) === String(id)) || null) : null;
    _editingEpId = ep ? ep.id : null;
    _editingEpDetail = ep ? (ep.detail || null) : null;
    setVal('ep-category', ep ? (ep.category || 'illness') : 'illness');
    setVal('ep-status', ep ? (ep.status || 'active') : 'active');
    setVal('ep-system', ep ? ep.system : '');
    setVal('ep-diagnosis', ep ? ep.diagnosis : '');
    setVal('ep-start', ep ? ep.start_date : '');
    setVal('ep-end', ep ? ep.end_date : '');
    setVal('ep-days', ep && ep.days_lost != null ? ep.days_lost : '');
    setVal('ep-notes', ep ? ep.notes : '');
    const title = document.getElementById('ep-modal-title'); if (title) title.textContent = ep ? 'Edit episode' : 'Add episode';
    const del = document.getElementById('ep-delete'); if (del) del.style.display = ep ? '' : 'none';
    epToggleCategory();
    const ov = document.getElementById('modalEpisode'); if (ov) ov.classList.add('is-open');
  }
  function closeEpisodeModal() {
    const ov = document.getElementById('modalEpisode'); if (ov) ov.classList.remove('is-open');
  }

  async function saveEpisode() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const nn = s => (s === '' ? null : s);
    const err = document.getElementById('ep-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }

    const category = val('ep-category'), diagnosis = val('ep-diagnosis'), start = val('ep-start'), status = val('ep-status');
    if (!category || !diagnosis || !start || !status) {
      if (err) { err.textContent = 'Category, diagnosis, start date and status are required.'; err.style.display = 'block'; }
      return;
    }
    const end = nn(val('ep-end'));
    let days_lost;
    const daysRaw = val('ep-days');
    if (daysRaw !== '') { const n = parseInt(daysRaw, 10); days_lost = isNaN(n) ? null : Math.max(0, n); }
    else if (end) { days_lost = daysBetween(start, end); }
    else days_lost = null;

    let detail;
    if (_editingEpId) detail = _editingEpDetail || null;                  // preserve on edit
    else if (category === 'concussion') detail = CONC_GRTP_INIT();        // seed GRTP on new concussion
    else detail = null;

    const fields = {
      category: category,
      system: category === 'concussion' ? null : nn(val('ep-system')),
      diagnosis: diagnosis,
      start_date: start,
      end_date: end,
      days_lost: days_lost,
      status: status,
      detail: detail,
      notes: nn(val('ep-notes')),
    };

    const btn = document.getElementById('ep-save'); if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');
      let error;
      if (_editingEpId) {
        ({ error } = await window.sb.from('medical_episodes').update(fields).eq('id', _editingEpId));
      } else {
        ({ error } = await window.sb.from('medical_episodes')
          .insert(Object.assign({ club_id: _clubId, player_id: _playerId }, fields)));
      }
      if (error) throw error;
      closeEpisodeModal();
      await loadEpisodes();
    } catch (e) {
      console.error('[Clinical record] save episode failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteEpisode(id) {
    if (!window.confirm('Delete this episode?')) return;
    const err = document.getElementById('ep-error');
    try {
      const { error } = await window.sb.from('medical_episodes').delete().eq('id', id);
      if (error) throw error;
      closeEpisodeModal();
      await loadEpisodes();
    } catch (e) {
      console.error('[Clinical record] delete episode failed', e);
      if (err) { err.textContent = 'Could not delete: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    }
  }

  // ── GRTP ladder inline editing (persists medical_episodes.detail) ───────────
  async function persistEpisodeDetail(ep, prevDetail) {
    try {
      const { error } = await window.sb.from('medical_episodes')
        .update({ detail: ep.detail }).eq('id', ep.id).eq('club_id', _clubId);
      if (error) throw error;
    } catch (e) {
      console.error('[Clinical record] GRTP persist failed', e);
      ep.detail = prevDetail;          // revert in-memory change
      renderEpisodes(_episodes);       // re-render to reflect the revert
    }
  }

  function grtpToggle(epId, stepNum) {
    const ep = arr(_episodes).find(x => String(x.id) === String(epId));
    if (!ep || !(stepNum >= 1 && stepNum <= 6)) return;
    const prevDetail = ep.detail ? JSON.parse(JSON.stringify(ep.detail)) : null;
    let detail = ep.detail || {};
    if (!Array.isArray(detail.grtp)) detail = Object.assign({}, detail, CONC_GRTP_INIT()); // seed 6 steps, keep other keys
    ep.detail = detail;
    const stepObj = detail.grtp.find(s => s && s.step === stepNum);
    if (!stepObj) return;
    const nowDone = !(stepObj.done === true);
    stepObj.done = nowDone;
    stepObj.date = nowDone ? (stepObj.date || todayISO()) : null;
    renderEpisodes(_episodes);
    persistEpisodeDetail(ep, prevDetail);
  }

  function grtpDateChange(epId, stepNum, value) {
    const ep = arr(_episodes).find(x => String(x.id) === String(epId));
    if (!ep || !ep.detail || !Array.isArray(ep.detail.grtp)) return;
    const stepObj = ep.detail.grtp.find(s => s && s.step === stepNum);
    if (!stepObj) return;
    const prevDetail = JSON.parse(JSON.stringify(ep.detail));
    stepObj.date = value || null;
    persistEpisodeDetail(ep, prevDetail);
  }

  // ── Treatment log tab ───────────────────────────────────────────────────────
  const RESP_PILL = { improving: ['is-success', 'Improving'], stable: ['', 'Stable'], worsening: ['is-danger', 'Worsening'] };
  function modalitiesLabel(m) {
    if (!Array.isArray(m)) return '—';
    const parts = m.map(x => {
      if (x == null) return null;
      if (typeof x === 'string') return x;
      if (typeof x === 'object') return x.name || x.label || null;
      return String(x);
    }).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }
  function renderTreatments(rows, nameMap) {
    rows = arr(rows); nameMap = nameMap || {};
    const tbody = document.getElementById('tx-tbody');
    if (!tbody) return;
    setText('tx-count', rows.length + ' ' + (rows.length === 1 ? 'treatment' : 'treatments'));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="cr-empty">No treatments recorded</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(t => {
      const type = t.type || (t.treatment_type === 'preventive' ? 'Preventive' : 'Rehab');
      let pain = '—';
      if (t.pain_pre != null && t.pain_post != null) {
        const color = t.pain_post < t.pain_pre ? 'var(--cm-success)'
          : t.pain_post > t.pain_pre ? 'var(--cm-danger)' : 'var(--cm-fg-strong)';
        pain = '<span style="font:600 13px/1 var(--cm-font-mono);color:' + color + '">' + t.pain_pre + ' → ' + t.pain_post + '</span>';
      }
      const who = nameMap[t.performed_by || t.physio_id] || '—';
      const rp = RESP_PILL[t.player_status];
      const resp = rp ? '<span class="cm-pill ' + rp[0] + '"><span class="cm-dot"></span>' + rp[1] + '</span>' : '—';
      return '<tr>' +
        '<td class="c-date">' + esc(fmtDate(t.date) || '—') + '</td>' +
        '<td>' + esc(type) + '</td>' +
        '<td class="c-muted">' + esc(modalitiesLabel(t.modalities)) + '</td>' +
        '<td class="num">' + pain + '</td>' +
        '<td>' + esc(who) + '</td>' +
        '<td>' + resp + '</td>' +
        '</tr>';
    }).join('');
  }

  // ── Imaging & studies tab ───────────────────────────────────────────────────
  const MODALITY_LABEL = { mri: 'MRI', ultrasound: 'Ultrasound', xray: 'X-ray', ct: 'CT', lab: 'Lab', other: 'Other' };
  const MODALITY_ICON = { mri: 'ti-scan', ultrasound: 'ti-wave-sine', xray: 'ti-bone', ct: 'ti-body-scan', lab: 'ti-test-pipe', other: 'ti-file-description' };
  const IMG_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i;
  function renderStudies(rows) {
    rows = arr(rows);
    const grid = document.getElementById('img-grid');
    if (!grid) return;
    setText('img-count', rows.length + ' ' + (rows.length === 1 ? 'study' : 'studies'));
    if (!rows.length) {
      grid.innerHTML = '<div class="cr-empty" style="padding:8px 0">No studies recorded</div>';
      return;
    }
    grid.innerHTML = rows.map(s => {
      const label = MODALITY_LABEL[s.modality] || (s.modality ? cap(s.modality) : 'Study');
      // file_url is a bucket PATH; only legacy http(s) links are used as a thumbnail
      const isHttp = s.file_url && /^https?:\/\//i.test(String(s.file_url));
      const thumb = isHttp
        ? '<div class="cr-img-thumb" style="background-image:url(\'' + esc(s.file_url) + '\');background-size:cover;background-position:center"></div>'
        : '<div class="cr-img-thumb"><i class="ti ' + (MODALITY_ICON[s.modality] || 'ti-photo') + '"></i></div>';
      const find = s.finding
        ? '<div class="cr-img-find" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(s.finding) + '</div>'
        : '';
      const open = s.file_url
        ? '<span class="cr-img-open study-open" data-url="' + esc(s.file_url) + '" style="cursor:pointer;font:500 12px/1 var(--cm-font-sans)">Open</span>'
        : '';
      return '<div class="cm-card cr-img-card">' +
        thumb +
        '<div class="cr-img-body">' +
          '<div class="cr-img-top">' +
            '<span style="font:600 13px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">' + esc(label) + '</span>' +
            '<span class="cr-img-date">' + esc(fmtDate(s.study_date) || '—') + '</span>' +
          '</div>' +
          '<div class="cr-img-area">' + esc(s.body_area || '—') + '</div>' +
          find +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 12px">' +
          open + editBtn(s.id, 'study-edit-btn') +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Imaging studies management (CRUD) modal, with file upload ───────────────
  const MEDIA_BUCKET = 'medical-documents';
  const studyFileName = url => (String(url || '').split('/').pop() || '').split('?')[0] || String(url || '');
  function sanitizeName(name) {
    let base = String(name || 'file');
    if (base.normalize) base = base.normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip accents
    return base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'file';
  }

  async function loadStudies() {
    try {
      const { data } = await window.sb.from('medical_studies')
        .select('id,modality,study_date,body_area,finding,file_url,related_injury_id,notes')
        .eq('club_id', _clubId).eq('player_id', _playerId)
        .order('study_date', { ascending: false });
      _studies = arr(data);
    } catch (_) { _studies = []; }
    renderStudies(_studies);
  }

  function openStudyModal(id) {
    const err = document.getElementById('study-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const s = (id != null) ? (arr(_studies).find(x => String(x.id) === String(id)) || null) : null;
    _editingStudyId = s ? s.id : null;
    setVal('study-modality', s ? (s.modality || '') : '');
    setVal('study-date', s ? s.study_date : '');
    setVal('study-area', s ? s.body_area : '');
    setVal('study-finding', s ? s.finding : '');
    fillInjurySelect('study-injury', s ? s.related_injury_id : '');
    setVal('study-notes', s ? s.notes : '');
    const fileInput = document.getElementById('study-file'); if (fileInput) fileInput.value = '';
    const cur = document.getElementById('study-current');
    if (cur) {
      if (s && s.file_url) { cur.style.display = ''; cur.textContent = 'Current file: ' + studyFileName(s.file_url) + ' — uploading a new file replaces it.'; }
      else { cur.style.display = 'none'; cur.textContent = ''; }
    }
    const title = document.getElementById('study-modal-title'); if (title) title.textContent = s ? 'Edit study' : 'Add study';
    const del = document.getElementById('study-delete'); if (del) del.style.display = s ? '' : 'none';
    const ov = document.getElementById('modalStudy'); if (ov) ov.classList.add('is-open');
  }
  function closeStudyModal() {
    const ov = document.getElementById('modalStudy'); if (ov) ov.classList.remove('is-open');
  }

  async function saveStudy() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const nn = s => (s === '' ? null : s);
    const err = document.getElementById('study-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } };

    const modality = val('study-modality');
    if (!modality) { fail('Modality is required.'); return; }

    const fileInput = document.getElementById('study-file');
    const file = (fileInput && fileInput.files && fileInput.files[0]) || null;

    const btn = document.getElementById('study-save'); if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');

      let file_url;
      if (file) {
        const okType = /^image\//.test(file.type) || file.type === 'application/pdf';
        if (!okType) { fail('File must be an image or PDF.'); return; }
        if (file.size > 15 * 1024 * 1024) { fail('File must be ≤ 15MB.'); return; }
        const path = _clubId + '/' + _playerId + '/studies/' + Date.now() + '_' + sanitizeName(file.name);
        const { error: upErr } = await window.sb.storage.from(MEDIA_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) { fail('Upload failed: ' + ((upErr && upErr.message) || 'unknown error')); return; }
        file_url = path;
      } else if (_editingStudyId) {
        const cur = arr(_studies).find(x => String(x.id) === String(_editingStudyId)) || {};
        file_url = cur.file_url || null; // preserve existing on edit
      } else {
        file_url = null;
      }

      const fields = {
        modality: modality,
        study_date: nn(val('study-date')),
        body_area: nn(val('study-area')),
        finding: nn(val('study-finding')),
        related_injury_id: nn(val('study-injury')),
        file_url: file_url,
        notes: nn(val('study-notes')),
      };

      let error;
      if (_editingStudyId) {
        ({ error } = await window.sb.from('medical_studies').update(fields).eq('id', _editingStudyId));
      } else {
        ({ error } = await window.sb.from('medical_studies')
          .insert(Object.assign({ club_id: _clubId, player_id: _playerId }, fields)));
      }
      if (error) throw error;
      closeStudyModal();
      await loadStudies();
    } catch (e) {
      console.error('[Clinical record] save study failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteStudy(id) {
    if (!window.confirm('Delete this study?')) return;
    const s = arr(_studies).find(x => String(x.id) === String(id));
    const err = document.getElementById('study-error');
    try {
      const { error } = await window.sb.from('medical_studies').delete().eq('id', id);
      if (error) throw error;
      // best-effort: remove the stored file (bucket paths only, not legacy http links)
      if (s && s.file_url && !/^https?:\/\//i.test(s.file_url)) {
        try { await window.sb.storage.from(MEDIA_BUCKET).remove([s.file_url]); }
        catch (remErr) { console.warn('[Clinical record] study file remove failed', remErr); }
      }
      closeStudyModal();
      await loadStudies();
    } catch (e) {
      console.error('[Clinical record] delete study failed', e);
      if (err) { err.textContent = 'Could not delete: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    }
  }

  // ── Documents tab (signed URLs generated on-demand at click) ────────────────
  const DOC_ICON = { report: 'ti-file-text', consent: 'ti-file-check', certificate: 'ti-certificate', insurance: 'ti-shield', other: 'ti-file' };
  const DOC_LABEL = { report: 'Report', consent: 'Consent', certificate: 'Certificate', insurance: 'Insurance', other: 'Other' };
  function renderDocuments(rows) {
    rows = arr(rows);
    const list = document.getElementById('doc-list');
    if (!list) return;
    setText('doc-count', rows.length + ' ' + (rows.length === 1 ? 'file' : 'files'));
    if (!rows.length) {
      list.innerHTML = '<div class="cr-empty" style="padding:8px 0">No documents</div>';
      return;
    }
    list.innerHTML = rows.map(d => {
      const icon = DOC_ICON[d.type] || 'ti-file';
      const label = DOC_LABEL[d.type] || (d.type ? cap(d.type) : 'Document');
      const meta = [label, fmtDate(d.doc_date)].filter(Boolean).join(' · ');
      const hasFile = !!d.file_path;
      const attrs = hasFile
        ? ' data-path="' + esc(d.file_path) + '" style="cursor:pointer"'
        : ' style="cursor:default;opacity:.6" title="No file attached"';
      return '<div class="cr-doc"' + attrs + '>' +
        '<div class="cr-doc-ic"><i class="ti ' + icon + '"></i></div>' +
        '<div class="cr-doc-main">' +
          '<div class="cr-doc-name">' + esc(d.title || 'Untitled') + '</div>' +
          '<div class="cr-doc-meta">' + esc(meta || '—') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-left:auto">' +
          (hasFile ? '<i class="ti ti-external-link" style="color:var(--cm-fg-faint);margin-right:2px"></i>' : '') +
          editBtn(d.id, 'doc-edit-btn') +
          '<button type="button" class="doc-del-btn" data-id="' + esc(d.id) + '" title="Delete" style="border:1px solid var(--cm-border);background:transparent;color:var(--cm-fg-muted);border-radius:var(--cm-r-2);width:28px;height:28px;cursor:pointer;line-height:1"><i class="ti ti-trash"></i></button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Documents management (add with upload, edit metadata, delete) ───────────
  async function loadDocs() {
    try {
      const { data } = await window.sb.from('medical_documents')
        .select('id,type,title,file_path,doc_date,uploaded_by,notes')
        .eq('club_id', _clubId).eq('player_id', _playerId)
        .order('doc_date', { ascending: false });
      _documents = arr(data);
    } catch (_) { _documents = []; }
    renderDocuments(_documents);
  }

  function openDocModal(id) {
    const err = document.getElementById('doc-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const d = (id != null) ? (arr(_documents).find(x => String(x.id) === String(id)) || null) : null;
    _editingDocId = d ? d.id : null;
    setVal('doc-type', d ? (d.type || '') : '');
    setVal('doc-title', d ? d.title : '');
    setVal('doc-date', d ? d.doc_date : '');
    setVal('doc-notes', d ? d.notes : '');
    const fileInput = document.getElementById('doc-file'); if (fileInput) fileInput.value = '';
    const cur = document.getElementById('doc-current');
    if (cur) {
      if (d && d.file_path) { cur.style.display = ''; cur.textContent = 'Current file: ' + studyFileName(d.file_path) + ' — uploading a new file replaces it.'; }
      else { cur.style.display = 'none'; cur.textContent = ''; }
    }
    const title = document.getElementById('doc-modal-title'); if (title) title.textContent = d ? 'Edit document' : 'Add document';
    const ov = document.getElementById('modalDoc'); if (ov) ov.classList.add('is-open');
  }
  function closeDocModal() {
    const ov = document.getElementById('modalDoc'); if (ov) ov.classList.remove('is-open');
  }

  async function saveDoc() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const nn = s => (s === '' ? null : s);
    const err = document.getElementById('doc-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } };

    const type = val('doc-type'), title = val('doc-title');
    if (!type || !title) { fail('Type and title are required.'); return; }

    const fileInput = document.getElementById('doc-file');
    const file = (fileInput && fileInput.files && fileInput.files[0]) || null;
    if (!_editingDocId && !file) { fail('A file is required.'); return; }

    const btn = document.getElementById('doc-save'); if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');

      let file_path = null;
      if (file) {
        const okType = /^image\//.test(file.type) || file.type === 'application/pdf' || /\.docx?$/i.test(file.name) ||
          file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (!okType) { fail('File must be an image, PDF or Word document.'); return; }
        if (file.size > 15 * 1024 * 1024) { fail('File must be ≤ 15MB.'); return; }
        const path = _clubId + '/' + _playerId + '/docs/' + Date.now() + '_' + sanitizeName(file.name);
        const { error: upErr } = await window.sb.storage.from(MEDIA_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) { fail('Upload failed: ' + ((upErr && upErr.message) || 'unknown error')); return; }
        file_path = path;
      }

      const base = { type: type, title: title, doc_date: nn(val('doc-date')), notes: nn(val('doc-notes')) };
      let error;
      if (_editingDocId) {
        const upd = Object.assign({}, base);
        if (file_path) upd.file_path = file_path; // only replace when a new file was uploaded
        ({ error } = await window.sb.from('medical_documents').update(upd).eq('id', _editingDocId));
      } else {
        let uploadedBy = null;
        try { const prof = window.getProfile ? await window.getProfile() : null; uploadedBy = (prof && prof.id) || null; } catch (_) {}
        ({ error } = await window.sb.from('medical_documents')
          .insert(Object.assign({ club_id: _clubId, player_id: _playerId, file_path: file_path, uploaded_by: uploadedBy }, base)));
      }
      if (error) throw error;
      closeDocModal();
      await loadDocs();
    } catch (e) {
      console.error('[Clinical record] save document failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteDoc(id) {
    if (!window.confirm('Delete this document?')) return;
    const d = arr(_documents).find(x => String(x.id) === String(id));
    try {
      const { error } = await window.sb.from('medical_documents').delete().eq('id', id);
      if (error) throw error;
      if (d && d.file_path) {
        try { await window.sb.storage.from(MEDIA_BUCKET).remove([d.file_path]); }
        catch (remErr) { console.warn('[Clinical record] document file remove failed', remErr); }
      }
      await loadDocs();
    } catch (e) {
      console.error('[Clinical record] delete document failed', e);
      window.alert('Could not delete the document.');
    }
  }

  // ── Overview: identity meta, current status, active issue, KPIs, timeline ───
  const PLAYER_STATUS = { available: ['is-success', 'Available'], injured: ['is-danger', 'Injured'], modified: ['is-warning', 'Modified'], unavailable: ['', 'Unavailable'] };

  function fmtDateLong(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  }
  function ageFrom(dob) {
    if (!dob) return null;
    const d = new Date(dob + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    let a = _today.getFullYear() - d.getFullYear();
    const m = _today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && _today.getDate() < d.getDate())) a--;
    return a >= 0 ? a : null;
  }
  function kpiCard(label, icon, num, unit, sub, numCls) {
    return '<div class="cr-kpi">' +
      '<div class="lab">' + (icon ? '<i class="ti ' + icon + '"></i>' : '') + esc(label) + '</div>' +
      '<div class="big"><span class="num' + (numCls ? ' ' + numCls : '') + '">' + esc(String(num)) + '</span>' +
        (unit ? '<span class="unit">' + esc(unit) + '</span>' : '') + '</div>' +
      '<div class="sub">' + esc(sub) + '</div>' +
      '</div>';
  }

  function renderOverview(player) {
    player = player || {};

    // identity meta — position pill + age · date of birth (height/weight/team not fetched)
    let meta = '';
    if (player.position) meta += '<span class="cm-pill">' + esc(player.position) + '</span>';
    const age = ageFrom(player.date_of_birth);
    const dob = player.date_of_birth ? fmtDateLong(player.date_of_birth) : null;
    const ageDob = [age != null ? age + ' yrs' : null, dob].filter(Boolean).join(' · ');
    if (ageDob) meta += (meta ? '<span class="sep">·</span>' : '') + '<span>' + esc(ageDob) + '</span>';
    setHTML('cr-id-meta', meta || DASH);

    // most recent open injury (active or returning)
    const open = arr(_injuries)
      .filter(i => i.status === 'active' || i.status === 'returning')
      .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))[0] || null;

    // current status card (from player.status)
    const ps = PLAYER_STATUS[player.status] || ['', 'Unknown'];
    const big = player.status === 'available' ? 'Full training' : (open ? 'Managing active issue' : ps[1]);
    setHTML('cr-cur-status', '<span class="cm-pill ' + ps[0] + '"><span class="cm-dot"></span>' + esc(ps[1]) +
      '</span><span class="big">' + esc(big) + '</span>');
    const subEl = document.querySelector('.cr-status-sub');
    if (subEl) subEl.innerHTML = open && open.expected_return
      ? 'Expected return · <b style="color:var(--cm-fg-strong)">' + esc(fmtDate(open.expected_return) || '—') + '</b>'
      : '';

    // active issue card
    const issueEl = document.querySelector('.cr-issue');
    if (issueEl) {
      if (open) {
        const diag = open.sub_classification || open.injury_type || 'Active injury';
        const p = 'Onset ' + (fmtDate(open.start_date) || '—') + ' · ' + daysOut(open) + ' days · ' + (open.status || '');
        issueEl.innerHTML = '<div class="cr-issue-ic"><i class="ti ti-bandage"></i></div>' +
          '<div><h3>' + esc(diag) + '</h3><p>' + esc(p) + '</p></div>';
      } else {
        issueEl.innerHTML = '<div class="cr-issue-ic" style="background:var(--cm-success-bg);color:var(--cm-success);border-color:var(--cm-success-bd)">' +
          '<i class="ti ti-check"></i></div><div><h3>No active issue</h3></div>';
      }
    }

    // career KPIs (from injuries)
    const krow = document.getElementById('kpi-row');
    if (krow) {
      const injs = arr(_injuries);
      const total = injs.length;
      const daysLost = injs.reduce((s, i) => s + daysOut(i), 0);
      const activeN = injs.filter(i => i.status === 'active' || i.status === 'returning').length;
      const severeN = injs.filter(i => String(i.severity || '').toLowerCase() === 'severe').length;
      const avgDays = total ? Math.round(daysLost / total) : 0;
      const lastStart = injs.map(i => i.start_date).filter(Boolean).sort().reverse()[0];
      const sinceLast = lastStart ? Math.max(0, Math.round((_today - new Date(lastStart + 'T00:00:00')) / 86400000)) : null;
      krow.innerHTML =
        kpiCard('Injuries', 'ti-bandage', total, '', 'career') +
        kpiCard('Days lost', 'ti-calendar-off', daysLost, 'd', 'career') +
        kpiCard('Active', 'ti-alert-triangle', activeN, '', 'now', activeN > 0 ? 'is-warn' : '') +
        kpiCard('Severe', 'ti-urgent', severeN, '', 'career') +
        kpiCard('Avg days', 'ti-clock', avgDays, 'd', 'per injury') +
        kpiCard('Since last', 'ti-history', sinceLast == null ? '—' : sinceLast, sinceLast == null ? '' : 'd', 'ago');
    }

    renderTimeline();
  }

  // Per-season (Aug→Jul) injury timeline with severity-coloured marks.
  const TL_MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const TL_SEV = { minor: 'mild', moderate: 'moderate', severe: 'severe' };
  function renderTimeline() {
    const el = document.getElementById('timeline');
    if (!el) return;
    const injs = arr(_injuries).filter(i => i.start_date);
    if (!injs.length) {
      el.innerHTML = '<div class="cr-empty" style="padding:8px 0">No injuries recorded</div>';
      return;
    }
    const bySeason = {};
    injs.forEach(i => { const s = seasonLabel(i.start_date); if (s) (bySeason[s] = bySeason[s] || []).push(i); });
    const seasons = Object.keys(bySeason).sort().reverse();

    let html = '<div class="tl-grid">';
    html += '<div></div><div class="tl-track tl-months">' + TL_MONTHS.map(m => '<span>' + m + '</span>').join('') + '</div>';
    seasons.forEach(s => {
      html += '<div class="tl-rowhead">' + esc(s) + '</div><div class="tl-track">';
      for (let c = 0; c < 12; c++) html += '<div class="tl-cell"></div>';
      bySeason[s].forEach(i => {
        const d = new Date(i.start_date + 'T00:00:00');
        if (isNaN(d.getTime())) return;
        const mi = (d.getMonth() - 7 + 12) % 12;
        const left = ((mi + 0.5) / 12 * 100).toFixed(2);
        const cls = TL_SEV[String(i.severity || 'minor').toLowerCase()] || 'mild';
        const tip = (i.sub_classification || i.injury_type || 'Injury') +
          (i.body_area ? ' · ' + i.body_area : '') + ' · ' + (fmtDate(i.start_date) || '');
        html += '<button class="tl-mark ' + cls + '" style="left:' + left + '%" title="' + esc(tip) + '"><span class="tl-mark-dot"></span></button>';
      });
      html += '</div>';
    });
    el.innerHTML = html + '</div>';
  }

  // ── Edit modal · Medical baseline ───────────────────────────────────────────
  function sevOpt(v, cur) {
    return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + cap(v) + '</option>';
  }
  function allergyRowHtml(a) {
    a = a || {};
    return '<div class="cr-rep-row">' +
      '<input class="cm-input bf-al-sub" placeholder="Substance" value="' + esc(a.substance || '') + '">' +
      '<input class="cm-input bf-al-rx" placeholder="Reaction" value="' + esc(a.reaction || '') + '">' +
      '<select class="cm-select bf-al-sev" style="max-width:130px">' +
        sevOpt('mild', a.severity) + sevOpt('moderate', a.severity) + sevOpt('severe', a.severity) +
      '</select>' +
      '<button type="button" class="cr-rep-del" title="Remove"><i class="ti ti-trash"></i></button>' +
      '</div>';
  }
  function chronicRowHtml(c) {
    c = c || {};
    return '<div class="cr-rep-row">' +
      '<input class="cm-input bf-ch-name" placeholder="Condition" value="' + esc(c.name || '') + '">' +
      '<input class="cm-input bf-ch-notes" placeholder="Notes" value="' + esc(c.notes || '') + '">' +
      '<button type="button" class="cr-rep-del" title="Remove"><i class="ti ti-trash"></i></button>' +
      '</div>';
  }

  function openBaselineModal() {
    const p = _profile || {};
    const setV = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v == null ? '' : v); };
    setV('bf-blood', p.blood_type);
    setV('bf-phenotype', p.blood_phenotype);
    setV('bf-sex', p.sex);
    setV('bf-family', p.family_history);
    const ec = p.emergency_contact || {};
    setV('bf-ec-name', ec.name); setV('bf-ec-relation', ec.relation); setV('bf-ec-phone', ec.phone);
    setV('bf-physician', p.treating_physician);
    setV('bf-insurance', p.insurance);
    setV('bf-last-review', p.last_review_date);
    setV('bf-next-review', p.next_review_date);
    const al = document.getElementById('bf-allergies');
    if (al) al.innerHTML = arr(p.allergies).map(allergyRowHtml).join('');
    const ch = document.getElementById('bf-chronic');
    if (ch) ch.innerHTML = arr(p.chronic_conditions).map(chronicRowHtml).join('');
    const err = document.getElementById('bf-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    const ov = document.getElementById('modalBaseline'); if (ov) ov.classList.add('is-open');
  }
  function closeBaselineModal() {
    const ov = document.getElementById('modalBaseline'); if (ov) ov.classList.remove('is-open');
  }

  async function saveBaseline() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const nn = s => (s === '' ? null : s);

    const allergies = [];
    document.querySelectorAll('#bf-allergies .cr-rep-row').forEach(r => {
      const sub = r.querySelector('.bf-al-sub').value.trim();
      const rx = r.querySelector('.bf-al-rx').value.trim();
      const sev = r.querySelector('.bf-al-sev').value;
      if (!sub && !rx) return; // discard empty rows
      allergies.push({ substance: sub, reaction: rx || null, severity: sev || null });
    });
    const chronic = [];
    document.querySelectorAll('#bf-chronic .cr-rep-row').forEach(r => {
      const name = r.querySelector('.bf-ch-name').value.trim();
      const notes = r.querySelector('.bf-ch-notes').value.trim();
      if (!name && !notes) return;
      chronic.push({ name: name, notes: notes || null });
    });
    const ecName = val('bf-ec-name'), ecRel = val('bf-ec-relation'), ecPhone = val('bf-ec-phone');
    const emergency = (ecName || ecRel || ecPhone)
      ? { name: ecName || null, relation: ecRel || null, phone: ecPhone || null } : null;

    const payload = {
      club_id: _clubId, player_id: _playerId,
      blood_type: nn(val('bf-blood')),
      blood_phenotype: nn(val('bf-phenotype')),
      sex: nn(val('bf-sex')),
      allergies: allergies,
      chronic_conditions: chronic,
      family_history: nn(val('bf-family')),
      emergency_contact: emergency,
      treating_physician: nn(val('bf-physician')),
      insurance: nn(val('bf-insurance')),
      last_review_date: nn(val('bf-last-review')),
      next_review_date: nn(val('bf-next-review')),
    };

    const err = document.getElementById('bf-error');
    const btn = document.getElementById('bf-save');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');
      const { data, error } = await window.sb.from('player_medical_profile')
        .upsert(payload, { onConflict: 'player_id' })
        .select('blood_type,blood_phenotype,allergies,chronic_conditions,family_history,emergency_contact,treating_physician,insurance,last_review_date,next_review_date,sex')
        .maybeSingle();
      if (error) throw error;

      _profile = data || payload;
      const p = _profile;
      renderReview(p);     // identity band review dates + physician
      renderBaseline(p);   // baseline card
      renderAlerts(p);     // alerts strip

      const newSex = currentBodySex();
      if (newSex !== _bodySex) {
        _bodySex = newSex;
        applySexActive();
        paintCard(overviewCard(), _bodyView);
        paintCard(injuriesCard(), _injView);
      }
      closeBaselineModal();
    } catch (e) {
      console.error('[Clinical record] baseline save failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) ? e.message : 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Medications management (CRUD) modal ─────────────────────────────────────
  async function loadMeds() {
    try {
      const { data } = await window.sb.from('player_medications').select('*')
        .eq('club_id', _clubId).eq('player_id', _playerId)
        .order('active', { ascending: false }).order('name');
      _meds = arr(data);
    } catch (_) { _meds = []; }
    renderMedsList();
    renderMeds(_meds); // re-render the baseline card chips (prompt 3 fn, reused)
  }

  function renderMedsList() {
    const list = document.getElementById('meds-list');
    if (!list) return;
    const rows = arr(_meds);
    if (!rows.length) {
      list.innerHTML = '<div class="cr-empty" style="padding:8px 0">No medications recorded</div>';
      return;
    }
    list.innerHTML = rows.map(m => {
      const meta = [m.dose, m.frequency, m.reason].filter(Boolean).join(' · ');
      const tue = m.tue ? ' <span class="cr-tue">TUE</span>' : '';
      const inactive = m.active === false
        ? ' <span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint)">Inactive</span>' : '';
      return '<div class="cr-med-row" data-id="' + esc(m.id) + '" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--cm-border-soft)">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font:600 13px/1.3 var(--cm-font-sans);color:var(--cm-fg-strong)">' + esc(m.name || '—') + tue + inactive + '</div>' +
          (meta ? '<div style="font:500 11.5px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:3px">' + esc(meta) + '</div>' : '') +
        '</div>' +
        '<button type="button" class="cr-rep-del bf-med-edit" title="Edit"><i class="ti ti-pencil"></i></button>' +
        '<button type="button" class="cr-rep-del bf-med-del" title="Delete"><i class="ti ti-trash"></i></button>' +
        '</div>';
    }).join('');
  }

  function clearMedForm() {
    _editingMedId = null;
    ['med-name', 'med-dose', 'med-freq', 'med-reason', 'med-start', 'med-end', 'med-notes'].forEach(id => setVal(id, ''));
    setChk('med-supp', false); setChk('med-tue', false); setChk('med-active', true);
    const btn = document.getElementById('med-save'); if (btn) btn.textContent = 'Save medication';
    const err = document.getElementById('med-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
  }

  function editMed(id) {
    const m = arr(_meds).find(x => String(x.id) === String(id));
    if (!m) return;
    _editingMedId = m.id;
    setVal('med-name', m.name); setVal('med-dose', m.dose); setVal('med-freq', m.frequency);
    setVal('med-reason', m.reason); setVal('med-start', m.start_date); setVal('med-end', m.end_date);
    setChk('med-supp', m.is_supplement); setChk('med-tue', m.tue); setChk('med-active', m.active !== false);
    setVal('med-notes', m.notes);
    const btn = document.getElementById('med-save'); if (btn) btn.textContent = 'Update medication';
    const form = document.getElementById('med-form'); if (form && form.scrollIntoView) form.scrollIntoView({ block: 'nearest' });
  }

  async function deleteMed(id) {
    if (!window.confirm('Delete this medication?')) return;
    const err = document.getElementById('med-error');
    try {
      const { error } = await window.sb.from('player_medications').delete().eq('id', id);
      if (error) throw error;
      if (String(_editingMedId) === String(id)) clearMedForm();
      await loadMeds();
    } catch (e) {
      console.error('[Clinical record] delete medication failed', e);
      if (err) { err.textContent = 'Could not delete: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    }
  }

  async function saveMed() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const chk = id => { const e = document.getElementById(id); return !!(e && e.checked); };
    const nn = s => (s === '' ? null : s);
    const err = document.getElementById('med-error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }

    const name = val('med-name');
    if (!name) { if (err) { err.textContent = 'Name is required.'; err.style.display = 'block'; } return; }

    const fields = {
      name: name,
      dose: nn(val('med-dose')),
      frequency: nn(val('med-freq')),
      reason: nn(val('med-reason')),
      start_date: nn(val('med-start')),
      end_date: nn(val('med-end')),
      is_supplement: chk('med-supp'),
      tue: chk('med-tue'),
      active: chk('med-active'),
      notes: nn(val('med-notes')),
    };

    const btn = document.getElementById('med-save'); if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');
      let error;
      if (_editingMedId) {
        ({ error } = await window.sb.from('player_medications').update(fields).eq('id', _editingMedId));
      } else {
        ({ error } = await window.sb.from('player_medications')
          .insert(Object.assign({ club_id: _clubId, player_id: _playerId }, fields)));
      }
      if (error) throw error;
      clearMedForm();
      await loadMeds();
    } catch (e) {
      console.error('[Clinical record] save medication failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function openMedsModal() {
    clearMedForm();
    renderMedsList();
    const ov = document.getElementById('modalMeds'); if (ov) ov.classList.add('is-open');
  }
  function closeMedsModal() {
    const ov = document.getElementById('modalMeds'); if (ov) ov.classList.remove('is-open');
  }

  // ── PCMA screenings management (CRUD) modal ─────────────────────────────────
  async function loadScreenings() {
    try {
      const { data } = await window.sb.from('medical_screenings').select('*')
        .eq('club_id', _clubId).eq('player_id', _playerId)
        .order('performed_on', { ascending: false });
      _screenings = arr(data);
    } catch (_) { _screenings = []; }
    renderScrList();
    renderScreenings(_screenings); // re-render the PCMA card rows (prompt 3 fn, reused)
  }

  function renderScrList() {
    const list = document.getElementById('scr-list');
    if (!list) return;
    const rows = arr(_screenings);
    if (!rows.length) {
      list.innerHTML = '<div class="cr-empty" style="padding:8px 0">No screenings recorded</div>';
      return;
    }
    list.innerHTML = rows.map(s => {
      const tl = SCREEN_TL[s.status] || 'ok';
      const dotColor = tl === 'bad' ? 'var(--cm-danger)' : tl === 'warn' ? 'var(--cm-warning)' : 'var(--cm-success)';
      const name = SCREEN_LABEL[s.type] || (s.type ? cap(s.type) : '—');
      const perf = fmtDate(s.performed_on);
      let due = '';
      if (s.next_due) {
        const d = daysFromToday(s.next_due);
        due = d < 0 ? '<span style="color:var(--cm-warning)">Overdue</span>' : 'Due ' + esc(fmtDate(s.next_due) || '');
      }
      const bits = [];
      if (s.result) bits.push(esc(s.result));
      if (perf) bits.push(esc(perf));
      let meta = bits.join(' · ');
      if (due) meta += (meta ? ' · ' : '') + due;
      if (!meta) meta = '—';
      return '<div class="cr-scr-row" data-id="' + esc(s.id) + '" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--cm-border-soft)">' +
        '<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:' + dotColor + '"></span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font:600 13px/1.3 var(--cm-font-sans);color:var(--cm-fg-strong)">' + esc(name) + '</div>' +
          '<div style="font:500 11.5px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:3px">' + meta + '</div>' +
        '</div>' +
        '<button type="button" class="cr-rep-del bf-scr-edit" title="Edit"><i class="ti ti-pencil"></i></button>' +
        '<button type="button" class="cr-rep-del bf-scr-del" title="Delete"><i class="ti ti-trash"></i></button>' +
        '</div>';
    }).join('');
  }

  function clearScrForm() {
    _editingScrId = null;
    ['scr-performed', 'scr-result', 'scr-next', 'scr-docurl', 'scr-notes'].forEach(id => setVal(id, ''));
    setVal('scr-type', '');
    setVal('scr-status', 'ok');
    const btn = document.getElementById('scr-save'); if (btn) btn.textContent = 'Save screening';
    const err = document.getElementById('scr-error'); if (err) { err.style.display = 'none'; err.textContent = ''; }
  }

  function editScreening(id) {
    const s = arr(_screenings).find(x => String(x.id) === String(id));
    if (!s) return;
    _editingScrId = s.id;
    setVal('scr-type', s.type); setVal('scr-status', s.status || 'ok');
    setVal('scr-performed', s.performed_on); setVal('scr-result', s.result);
    setVal('scr-next', s.next_due); setVal('scr-docurl', s.doc_url); setVal('scr-notes', s.notes);
    const btn = document.getElementById('scr-save'); if (btn) btn.textContent = 'Update screening';
    const form = document.getElementById('scr-form'); if (form && form.scrollIntoView) form.scrollIntoView({ block: 'nearest' });
  }

  async function deleteScreening(id) {
    if (!window.confirm('Delete this screening?')) return;
    const err = document.getElementById('scr-error');
    try {
      const { error } = await window.sb.from('medical_screenings').delete().eq('id', id);
      if (error) throw error;
      if (String(_editingScrId) === String(id)) clearScrForm();
      await loadScreenings();
    } catch (e) {
      console.error('[Clinical record] delete screening failed', e);
      if (err) { err.textContent = 'Could not delete: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    }
  }

  async function saveScreening() {
    const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const nn = s => (s === '' ? null : s);
    const err = document.getElementById('scr-error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }

    const type = val('scr-type'), status = val('scr-status');
    if (!type || !status) { if (err) { err.textContent = 'Type and status are required.'; err.style.display = 'block'; } return; }

    const fields = {
      type: type,
      status: status,
      performed_on: nn(val('scr-performed')),
      result: nn(val('scr-result')),
      next_due: nn(val('scr-next')),
      doc_url: nn(val('scr-docurl')),
      notes: nn(val('scr-notes')),
    };

    const btn = document.getElementById('scr-save'); if (btn) btn.disabled = true;
    try {
      if (!_clubId || !_playerId) throw new Error('Missing club or player context.');
      let error;
      if (_editingScrId) {
        ({ error } = await window.sb.from('medical_screenings').update(fields).eq('id', _editingScrId));
      } else {
        ({ error } = await window.sb.from('medical_screenings')
          .insert(Object.assign({ club_id: _clubId, player_id: _playerId }, fields)));
      }
      if (error) throw error;
      clearScrForm();
      await loadScreenings();
    } catch (e) {
      console.error('[Clinical record] save screening failed', e);
      if (err) { err.textContent = 'Could not save: ' + ((e && e.message) || 'unknown error'); err.style.display = 'block'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function openScreeningsModal() {
    clearScrForm();
    renderScrList();
    const ov = document.getElementById('modalScreenings'); if (ov) ov.classList.add('is-open');
  }
  function closeScreeningsModal() {
    const ov = document.getElementById('modalScreenings'); if (ov) ov.classList.remove('is-open');
  }

  // ── Synchronous reset: blank every mock/data-driven region BEFORE any fetch ──
  function resetRegions() {
    const m = mainEl(); if (m) m.classList.add('is-loading');

    // identity band
    setText('cr-name', '—'); setText('cr-num', '');
    const photo = document.getElementById('cr-photo');
    if (photo) { photo.textContent = ''; photo.style.backgroundImage = ''; }
    setHTML('cr-id-meta', DASH);
    setText('cr-med-status', '—'); setText('cr-medstatus-sub', '');
    setText('cr-last-review', '—'); setText('cr-last-review-note', '');
    setText('next-review', '—'); setText('next-review-note', '');
    const nrs = document.getElementById('cr-next-review-stat'); if (nrs) nrs.classList.remove('is-soon', 'is-overdue');
    setText('cr-physician', '—'); setText('cr-physician-sub', '');

    // medical baseline card
    setText('cr-blood', '—');
    setHTML('cr-allergies', DASH);
    setHTML('cr-chronic', DASH);
    setHTML('cr-meds', DASH);
    setHTML('cr-ec', '<span>—</span>');
    setHTML('cr-insurance', '<span>—</span>');

    // alerts strip — hidden until we know it has chips
    const alerts = document.getElementById('cr-alerts'); if (alerts) alerts.style.display = 'none';

    // PCMA rows
    setHTML('cr-pcma', '');

    // overview panel (not yet wired)
    setHTML('cr-cur-status', DASH);
    const sub = document.querySelector('.cr-status-sub'); if (sub) sub.innerHTML = '';
    const issue = document.querySelector('.cr-issue');
    if (issue) issue.innerHTML = '<div class="cr-issue-ic"><i class="ti ti-check"></i></div><div><h3>No active issue</h3></div>';
    setHTML('kpi-row', '');
    setHTML('timeline', '');
    document.querySelectorAll('.body-hotspots').forEach(s => { s.innerHTML = ''; }); // clear hotspots, keep silhouettes

    // detail tables (not yet wired) → empty state
    setHTML('inj-tbody', emptyRow(9));
    setHTML('ill-tbody', emptyRow(6));
    setHTML('surg-tbody', emptyRow(7));
    setHTML('tx-tbody', emptyRow(6));
    setHTML('img-grid', emptyBlock());
    setHTML('doc-list', emptyBlock());
    setHTML('concussion-body', emptyBlock());

    // clear hardcoded record counts
    document.querySelectorAll('.cr-table-head .count').forEach(c => { c.textContent = ''; });
    setText('inj-count', '');
  }

  // ── Tab switching (the preview shipped this in an external clinical-record.js
  //    we don't have, so it's reimplemented here) ──────────────────────────────
  document.querySelectorAll('.cr-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.cr-tab').forEach(b => b.classList.toggle('is-active', b === btn));
      document.querySelectorAll('.cr-panel').forEach(p =>
        p.classList.toggle('is-active', p.id === 'panel-' + tab));
    });
  });

  // ── Per-card Front/Back toggles (Overview + Injury history) ─────────────────
  function wireViewToggle(cardId, getView, setView) {
    document.querySelectorAll('#' + cardId + ' .bm-toggle button[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view === 'back' ? 'back' : 'front';
        setView(view);
        document.querySelectorAll('#' + cardId + ' .bm-toggle button[data-view]')
          .forEach(b => b.classList.toggle('is-active', b === btn));
        paintCard(document.getElementById(cardId), view);
      });
    });
  }
  wireViewToggle('bodymap-overview', () => _bodyView, v => { _bodyView = v; });
  wireViewToggle('bodymap-injuries', () => _injView, v => { _injView = v; });

  // ── Injury heatmap click-to-filter (injuries card only) ─────────────────────
  (function () {
    const card = injuriesCard();
    const svg = card && card.querySelector('.body-hotspots');
    if (!svg) return;
    svg.addEventListener('click', e => {
      const c = e.target.closest('[data-area]');
      if (!c) return;
      const area = c.getAttribute('data-area');
      const sel = document.getElementById('flt-zone');
      if (sel) sel.value = [].some.call(sel.options, o => o.value === area) ? area : 'all';
      renderInjuryTable();
    });
  })();

  // ── Injury history filters → re-render table ────────────────────────────────
  ['flt-season', 'flt-zone', 'flt-tissue'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.addEventListener('change', renderInjuryTable);
  });

  // ── Documents: add/edit/delete triggers + open on click (delegated) ─────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-doc-add', 'click', () => openDocModal());
    on('doc-close', 'click', closeDocModal);
    on('doc-cancel', 'click', closeDocModal);
    on('doc-save', 'click', saveDoc);
    on('modalDoc', 'click', e => { if (e.target.id === 'modalDoc') closeDocModal(); });

    const list = document.getElementById('doc-list');
    if (!list) return;
    list.addEventListener('click', async e => {
      // edit / delete buttons take precedence over the row's open-on-click
      const edit = e.target.closest('.doc-edit-btn');
      if (edit) { openDocModal(edit.getAttribute('data-id')); return; }
      const del = e.target.closest('.doc-del-btn');
      if (del) { deleteDoc(del.getAttribute('data-id')); return; }
      const row = e.target.closest('.cr-doc[data-path]');
      if (!row) return;
      const path = row.getAttribute('data-path');
      if (!path) return;
      try {
        const { data } = await window.sb.storage.from('medical-documents').createSignedUrl(path, 3600);
        if (data && data.signedUrl) window.open(data.signedUrl, '_blank');
      } catch (err) {
        console.error('[Clinical record] could not open document', err);
      }
    });
  })();

  // ── Medical baseline edit modal wiring ──────────────────────────────────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-baseline-edit', 'click', openBaselineModal);
    on('cr-baseline-close', 'click', closeBaselineModal);
    on('bf-cancel', 'click', closeBaselineModal);
    on('bf-save', 'click', saveBaseline);
    on('bf-add-allergy', 'click', () => {
      const l = document.getElementById('bf-allergies'); if (l) l.insertAdjacentHTML('beforeend', allergyRowHtml({}));
    });
    on('bf-add-chronic', 'click', () => {
      const l = document.getElementById('bf-chronic'); if (l) l.insertAdjacentHTML('beforeend', chronicRowHtml({}));
    });
    ['bf-allergies', 'bf-chronic'].forEach(id => {
      const list = document.getElementById(id);
      if (list) list.addEventListener('click', e => {
        const del = e.target.closest('.cr-rep-del');
        if (del) { const row = del.closest('.cr-rep-row'); if (row) row.remove(); }
      });
    });
    // click on the dimmed backdrop closes the modal
    on('modalBaseline', 'click', e => { if (e.target.id === 'modalBaseline') closeBaselineModal(); });
  })();

  // ── Medications manage modal wiring ─────────────────────────────────────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-meds-edit', 'click', openMedsModal);
    on('cr-meds-close', 'click', closeMedsModal);
    on('cr-meds-close2', 'click', closeMedsModal);
    on('med-save', 'click', saveMed);
    on('med-clear', 'click', clearMedForm);
    const list = document.getElementById('meds-list');
    if (list) list.addEventListener('click', e => {
      const row = e.target.closest('.cr-med-row');
      if (!row) return;
      const id = row.getAttribute('data-id');
      if (!id) return;
      if (e.target.closest('.bf-med-edit')) editMed(id);
      else if (e.target.closest('.bf-med-del')) deleteMed(id);
    });
    on('modalMeds', 'click', e => { if (e.target.id === 'modalMeds') closeMedsModal(); });
  })();

  // ── PCMA screenings manage modal wiring ─────────────────────────────────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-scr-edit', 'click', openScreeningsModal);
    on('cr-scr-close', 'click', closeScreeningsModal);
    on('cr-scr-close2', 'click', closeScreeningsModal);
    on('scr-save', 'click', saveScreening);
    on('scr-clear', 'click', clearScrForm);
    const list = document.getElementById('scr-list');
    if (list) list.addEventListener('click', e => {
      const row = e.target.closest('.cr-scr-row');
      if (!row) return;
      const id = row.getAttribute('data-id');
      if (!id) return;
      if (e.target.closest('.bf-scr-edit')) editScreening(id);
      else if (e.target.closest('.bf-scr-del')) deleteScreening(id);
    });
    on('modalScreenings', 'click', e => { if (e.target.id === 'modalScreenings') closeScreeningsModal(); });
  })();

  // ── Medical episode modal wiring ────────────────────────────────────────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-ep-add', 'click', () => openEpisodeModal());
    on('ep-close', 'click', closeEpisodeModal);
    on('ep-cancel', 'click', closeEpisodeModal);
    on('ep-save', 'click', saveEpisode);
    on('ep-delete', 'click', () => { if (_editingEpId) deleteEpisode(_editingEpId); });
    on('ep-category', 'change', epToggleCategory);
    on('modalEpisode', 'click', e => { if (e.target.id === 'modalEpisode') closeEpisodeModal(); });
    // edit buttons live inside the illness table and concussion cards (delegated)
    ['ill-tbody', 'concussion-body'].forEach(id => {
      const host = document.getElementById(id);
      if (host) host.addEventListener('click', e => {
        const b = e.target.closest('.ep-edit-btn');
        if (b) openEpisodeModal(b.getAttribute('data-id'));
      });
    });
    // GRTP ladder inline editing (concussion cards)
    const cbody = document.getElementById('concussion-body');
    if (cbody) {
      cbody.addEventListener('click', e => {
        const n = e.target.closest('.grtp-toggle');
        if (n) grtpToggle(n.getAttribute('data-ep'), parseInt(n.getAttribute('data-step'), 10));
      });
      cbody.addEventListener('change', e => {
        const inp = e.target.closest('.grtp-date');
        if (inp) grtpDateChange(inp.getAttribute('data-ep'), parseInt(inp.getAttribute('data-step'), 10), inp.value);
      });
    }
  })();

  // ── Surgery modal wiring ────────────────────────────────────────────────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-surg-add', 'click', () => openSurgeryModal());
    on('surg-close', 'click', closeSurgeryModal);
    on('surg-cancel', 'click', closeSurgeryModal);
    on('surg-save', 'click', saveSurgery);
    on('surg-delete', 'click', () => { if (_editingSurgId) deleteSurgery(_editingSurgId); });
    on('modalSurgery', 'click', e => { if (e.target.id === 'modalSurgery') closeSurgeryModal(); });
    const host = document.getElementById('surg-tbody');
    if (host) host.addEventListener('click', e => {
      const b = e.target.closest('.surg-edit-btn');
      if (b) openSurgeryModal(b.getAttribute('data-id'));
    });
  })();

  // ── Imaging study modal wiring ──────────────────────────────────────────────
  (function () {
    const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('cr-study-add', 'click', () => openStudyModal());
    on('study-close', 'click', closeStudyModal);
    on('study-cancel', 'click', closeStudyModal);
    on('study-save', 'click', saveStudy);
    on('study-delete', 'click', () => { if (_editingStudyId) deleteStudy(_editingStudyId); });
    on('modalStudy', 'click', e => { if (e.target.id === 'modalStudy') closeStudyModal(); });
    const grid = document.getElementById('img-grid');
    if (grid) grid.addEventListener('click', async e => {
      const open = e.target.closest('.study-open');
      if (open) {
        const url = open.getAttribute('data-url');
        if (!url) return;
        if (/^https?:\/\//i.test(url)) { window.open(url, '_blank'); return; }
        try {
          const { data } = await window.sb.storage.from(MEDIA_BUCKET).createSignedUrl(url, 3600);
          if (data && data.signedUrl) window.open(data.signedUrl, '_blank');
        } catch (err) { console.error('[Clinical record] open study failed', err); }
        return;
      }
      const edit = e.target.closest('.study-edit-btn');
      if (edit) openStudyModal(edit.getAttribute('data-id'));
    });
  })();

  // ── Overview heatmap Male/Female silhouette toggle (persisted on profile) ────
  applySexActive(); // default 'male' active until the profile row resolves
  document.querySelectorAll('#cr-sexToggle button[data-sex]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sex = btn.dataset.sex === 'female' ? 'female' : 'male';
      if (sex === _bodySex) return;
      const prev = _bodySex;
      _bodySex = sex;
      applySexActive();
      // silhouette is shared by both cards; repaint each with its own view
      paintCard(overviewCard(), _bodyView);
      paintCard(injuriesCard(), _injView);

      if (!_clubId || !_playerId) return;
      try {
        const { error } = await window.sb.from('player_medical_profile')
          .upsert({ club_id: _clubId, player_id: _playerId, sex: _bodySex }, { onConflict: 'player_id' });
        if (error) throw error;
        if (_profile) _profile.sex = _bodySex;
      } catch (e) {
        console.error('[Clinical record] could not persist body sex', e);
        _bodySex = prev; // revert on failure (e.g. no write permission)
        applySexActive();
        paintCard(overviewCard(), _bodyView);
        paintCard(injuriesCard(), _injView);
      }
    });
  });

  function showError(msg) {
    const who = document.querySelector('.cr-id-who');
    if (who) who.innerHTML = '<h1 style="color:var(--cm-danger)">' + esc(msg) + '</h1>';
    setText('cr-crumb-name', '—');
    doneLoading();
  }

  // ── Identity band · review dates + treating physician ───────────────────────
  function renderReview(p) {
    const last = p.last_review_date, next = p.next_review_date;

    setText('cr-last-review', fmtDate(last) || '—');
    if (last) { const d = daysFromToday(last); setText('cr-last-review-note', d === 0 ? 'today' : (d < 0 ? (-d) + ' days ago' : 'in ' + d + 'd')); }
    else setText('cr-last-review-note', '');

    setText('next-review', fmtDate(next) || '—');
    const stat = document.getElementById('cr-next-review-stat');
    if (stat) stat.classList.remove('is-soon', 'is-overdue');
    if (next) {
      const d = daysFromToday(next);
      setText('next-review-note', d < 0 ? 'overdue' : (d === 0 ? 'today' : 'in ' + d + 'd'));
      if (stat) { if (d < 0) stat.classList.add('is-overdue'); else if (d <= 14) stat.classList.add('is-soon'); }
    } else setText('next-review-note', '');

    if (p.treating_physician) setText('cr-physician', p.treating_physician);
  }

  // ── Medical baseline card ───────────────────────────────────────────────────
  function renderBaseline(p) {
    setText('cr-blood', p.blood_type ? (p.blood_type + (p.blood_phenotype ? ' · ' + p.blood_phenotype : '')) : '—');

    const al = arr(p.allergies);
    setHTML('cr-allergies', al.length ? al.map(a => {
      const sev = isSevere(a);
      const t = [a.reaction, a.severity].filter(Boolean).join(' — ');
      return '<span class="cr-tag' + (sev ? ' is-danger' : '') + '"' + (t ? ' title="' + esc(t) + '"' : '') + '>' +
        (sev ? '<i class="ti ti-alert-triangle-filled" style="font-size:13px;"></i>' : '') + esc(a.substance || '—') + '</span>';
    }).join('') : EMPTY);

    const ch = arr(p.chronic_conditions);
    setHTML('cr-chronic', ch.length ? ch.map(c =>
      '<span class="cr-tag"' + (c.notes ? ' title="' + esc(c.notes) + '"' : '') + '>' + esc(c.name || '—') + '</span>'
    ).join('') : EMPTY);

    const ec = p.emergency_contact || null;
    if (ec && (ec.name || ec.phone)) {
      const who = [ec.name, ec.relation].filter(Boolean).join(' · ');
      setHTML('cr-ec', '<span>' + esc(who || '—') + '</span><b>' + esc(ec.phone || '—') + '</b>');
    } else setHTML('cr-ec', '<span>—</span>');

    setHTML('cr-insurance', p.insurance ? '<span>' + esc(p.insurance) + '</span>' : '<span>—</span>');
  }

  // ── Medical alerts strip (allergies → chronic → blood; severe first) ─────────
  function renderAlerts(p) {
    const row = document.getElementById('cr-alerts');
    if (!row) return;
    const al = arr(p.allergies);
    const chips = [];
    al.filter(isSevere).forEach(a =>
      chips.push('<span class="cr-chip is-danger"><i class="ti ti-alert-triangle-filled"></i>' +
        esc([a.substance, a.severity].filter(Boolean).join(' · ')) + '</span>'));
    al.filter(a => !isSevere(a)).forEach(a =>
      chips.push('<span class="cr-chip is-warning"><i class="ti ti-alert-triangle"></i>' +
        esc([a.substance, a.severity || a.reaction].filter(Boolean).join(' · ')) + '</span>'));
    arr(p.chronic_conditions).forEach(c =>
      chips.push('<span class="cr-chip"><i class="ti ti-activity"></i>' + esc(c.name || '') + '</span>'));
    if (p.blood_type)
      chips.push('<span class="cr-chip is-mono"><i class="ti ti-droplet"></i>Blood <b>' + esc(p.blood_type) + '</b></span>');

    if (!chips.length) { row.style.display = 'none'; return; }
    row.style.display = '';
    row.innerHTML = '<span class="cr-alerts-lab"><i class="ti ti-urgent"></i>Medical alerts</span>' + chips.join('');
  }

  // ── Medications & supplements (baseline card) ───────────────────────────────
  function renderMeds(rows) {
    rows = arr(rows);
    if (!rows.length) { setHTML('cr-meds', EMPTY); return; }
    setHTML('cr-meds', rows.map(m => {
      const txt = esc(m.name || '—') + (m.frequency ? ' · ' + esc(m.frequency) : '');
      const tue = m.tue ? ' <span class="cr-tue">TUE</span>' : '';
      const title = [m.dose, m.reason].filter(Boolean).join(' · ');
      const op = m.active === false ? ' style="opacity:.55"' : '';
      return '<span class="cr-tag"' + op + (title ? ' title="' + esc(title) + '"' : '') + '>' + txt + tue + '</span>';
    }).join(''));
  }

  // ── Cardiac & PCMA screening (traffic-light rows) ───────────────────────────
  const SCREEN_LABEL = { ecg: 'ECG · 12-lead', echo: 'Echocardiogram', stress_test: 'Stress test', vision: 'Vision', dental: 'Dental', other: 'Other' };
  const SCREEN_TL = { ok: 'ok', warning: 'warn', abnormal: 'bad' };
  function renderScreenings(rows) {
    rows = arr(rows);
    const body = document.getElementById('cr-pcma');
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<div style="padding:14px 0;text-align:center;font:var(--cm-body-sm);color:var(--cm-fg-faint)">No screenings recorded</div>';
      return;
    }
    body.innerHTML = rows.map(s => {
      const tl = SCREEN_TL[s.status] || 'ok';
      const name = SCREEN_LABEL[s.type] || esc(s.type || '—');
      const perf = fmtDate(s.performed_on) || '—';
      let due = '';
      if (s.next_due) {
        const d = daysFromToday(s.next_due);
        due = d < 0 ? '<b style="color:var(--cm-warning)">Overdue</b>' : '<b>Due ' + esc(fmtDate(s.next_due)) + '</b>';
      }
      return '<div class="cr-pcma-row">' +
        '<span class="cr-pcma-name"><span class="cr-tl ' + tl + '"></span>' + name + '</span>' +
        '<span class="cr-pcma-res">' + esc(s.result || '—') + '</span>' +
        '<span class="cr-pcma-dates">' + esc(perf) + (due ? '<br>' + due : '') + '</span>' +
        '</div>';
    }).join('');
  }

  async function boot() {
    // URL guard: inherit the parent module permission (Clinical Records). Redirects to Hub if no access.
    if (!(await window.guardModule('clinical'))) return;
    try {
      const playerId = new URLSearchParams(location.search).get('player');
      if (!playerId) { showError('No player specified.'); return; }
      _playerId = playerId;

      let clubId = null;
      try { clubId = await window.getClubId(); } catch (_) {}
      if (!clubId) { showError('No club found for this account.'); return; }
      _clubId = clubId;

      let player = null;
      try {
        const { data } = await window.sb.from('players')
          .select('id,first_name,last_name,number,position,date_of_birth,photo_url,status')
          .eq('id', playerId).single();
        player = data;
      } catch (_) {}
      if (!player) { showError('Player not found.'); return; }

      const name = (((player.first_name || '') + ' ' + (player.last_name || '')).trim()) || '—';
      const num = (player.number ?? '') === '' ? '' : ('#' + player.number);
      setText('cr-name', name);
      setText('cr-num', num);
      setText('cr-crumb-name', name);
      document.title = 'Clinical record — ' + name + ' · ClavaMetrics';

      const photo = document.getElementById('cr-photo');
      if (photo) {
        if (player.photo_url) {
          photo.style.backgroundImage = "url('" + esc(player.photo_url) + "')";
          photo.style.backgroundSize = 'cover';
          photo.style.backgroundPosition = 'center';
          photo.textContent = '';
        } else {
          photo.textContent = (((player.first_name || '').trim()[0] || '') + ((player.last_name || '').trim()[0] || '')) || '—';
        }
      }

      // ── Medical profile (1 row) — feeds review dates, baseline & alerts ──
      let profile = null;
      try {
        const { data } = await window.sb.from('player_medical_profile')
          .select('blood_type,blood_phenotype,allergies,chronic_conditions,family_history,emergency_contact,treating_physician,insurance,last_review_date,next_review_date,sex')
          .eq('club_id', clubId).eq('player_id', playerId).maybeSingle();
        profile = data;
      } catch (_) {}
      const p = profile || {};
      _profile = profile;
      renderReview(p);
      renderBaseline(p);
      renderAlerts(p);

      // silhouette sex from the profile row (reused, no extra fetch)
      _bodySex = currentBodySex();
      applySexActive();
      setSilhouette(overviewCard(), _bodyView);
      setSilhouette(injuriesCard(), _injView);

      // ── Medications & supplements (loads _meds, baseline chips + manage list) ──
      await loadMeds();

      // ── Cardiac & PCMA screenings (loads _screenings, card rows + manage list) ──
      await loadScreenings();

      // ── Injuries → Overview heatmap + Injury history tab (fetched once) ──
      try {
        const { data } = await window.sb.from('injuries')
          .select('id,start_date,body_area,severity,status,injury_category,sub_classification,injury_type,injury_mechanism,mechanism,returned_date,expected_return')
          .eq('club_id', clubId).eq('player_id', playerId);
        _injuries = arr(data);
      } catch (_) { _injuries = []; }
      paintCard(overviewCard(), _bodyView);
      paintCard(injuriesCard(), _injView);
      populateInjuryFilters();
      renderInjuryTable();
      renderOverview(player);

      // ── Surgical history (loads _surgeries; related injury looked up in _injuries) ──
      await loadSurgeries();

      // ── Illness & episodes + concussion log (loads _episodes, table + log) ──
      await loadEpisodes();

      // ── Treatment log (fetched once; performer names resolved from profiles) ──
      try {
        const { data: txs } = await window.sb.from('treatments')
          .select('date,type,treatment_type,modalities,pain_pre,pain_post,performed_by,physio_id,player_status,adaptation_notes')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('date', { ascending: false });
        const rows = arr(txs);
        const ids = [...new Set(rows.map(t => t.performed_by || t.physio_id).filter(Boolean))];
        const nameMap = {};
        if (ids.length) {
          try {
            const { data: profs } = await window.sb.from('profiles').select('id,full_name').in('id', ids);
            arr(profs).forEach(pr => { if (pr && pr.id) nameMap[pr.id] = pr.full_name || '—'; });
          } catch (_) {}
        }
        renderTreatments(rows, nameMap);
      } catch (_) { renderTreatments([], {}); }

      // ── Imaging & studies (loads _studies, renders #img-grid) ──
      await loadStudies();

      // ── Documents (loads _documents, renders #doc-list) ──
      await loadDocs();
    } finally {
      doneLoading();
    }
  }

  resetRegions();
  boot();
})();
