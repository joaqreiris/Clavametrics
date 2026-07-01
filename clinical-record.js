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
  const arr = v => Array.isArray(v) ? v : [];
  const emptyRow = cols => '<tr><td colspan="' + cols + '" class="cr-empty">No records</td></tr>';
  const emptyBlock = () => '<div class="cr-empty">No records</div>';

  const _today = new Date(); _today.setHours(0, 0, 0, 0);
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
      tbody.innerHTML = '<tr><td colspan="6" class="cr-empty">No procedures recorded</td></tr>';
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
        '</tr>';
    }).join('');
  }

  // ── Illness & episodes tab (illness/other → table, concussion → GRTP log) ────
  const EP_STATUS_PILL = { active: ['is-danger', 'Active'], monitoring: ['is-warning', 'Monitoring'], resolved: ['is-success', 'Resolved'] };
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

  function grtpLadder(detail) {
    const gmap = {};
    arr(detail && detail.grtp).forEach(s => { if (s && s.step != null) gmap[s.step] = s; });
    let html = '<div class="cr-grtp">';
    for (let i = 1; i <= 6; i++) {
      const step = gmap[i] || {};
      const label = step.label || GRTP_STEPS[i - 1];
      const done = step.done === true;
      const date = step.date ? (fmtDate(step.date) || '') : '';
      html += '<div class="cr-grtp-step' + (done ? ' is-done' : '') + '">' +
        '<div class="cr-grtp-n">' + i + '</div>' +
        '<div class="cr-grtp-l">' + esc(label) + '</div>' +
        '<div class="cr-grtp-d">' + esc(date) + '</div>' +
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
        tbody.innerHTML = '<tr><td colspan="5" class="cr-empty">No episodes recorded</td></tr>';
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
            '<div class="cr-kv"><span>Concussion</span><b>' + esc(fmtDate(e.start_date) || '—') + '</b></div>' +
            '<div class="cr-kv"><span>Days lost</span><b' + warn + '>' + esc(days) + '</b></div>' +
            '<div class="cr-kv" style="margin-bottom:6px"><span>Status</span><b>' + statusPill + '</b></div>' +
            scatHtml(e.detail && e.detail.scat) +
            '<div class="cr-mini-lab" style="margin:12px 0 8px">Graduated return to play</div>' +
            grtpLadder(e.detail) +
            '</div>';
        }).join('') + '</div>';
      }
    }
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
      const isImg = s.file_url && IMG_RE.test(String(s.file_url));
      const thumb = isImg
        ? '<div class="cr-img-thumb" style="background-image:url(\'' + esc(s.file_url) + '\');background-size:cover;background-position:center"></div>'
        : '<div class="cr-img-thumb"><i class="ti ' + (MODALITY_ICON[s.modality] || 'ti-photo') + '"></i></div>';
      const find = s.finding
        ? '<div class="cr-img-find" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(s.finding) + '</div>'
        : '';
      const open = s.file_url
        ? '<a class="cr-img-open" href="' + esc(s.file_url) + '" target="_blank" rel="noopener" style="font:500 12px/1 var(--cm-font-sans)">Open</a>'
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
        open +
        '</div>';
    }).join('');
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
        (hasFile ? '<i class="ti ti-external-link" style="color:var(--cm-fg-faint);margin-left:auto"></i>' : '') +
        '</div>';
    }).join('');
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
    setHTML('ill-tbody', emptyRow(5));
    setHTML('surg-tbody', emptyRow(6));
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

  // ── Documents: open on click via on-demand signed URL (delegated) ───────────
  (function () {
    const list = document.getElementById('doc-list');
    if (!list) return;
    list.addEventListener('click', async e => {
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

      // ── Medications & supplements ──
      try {
        const { data } = await window.sb.from('player_medications')
          .select('name,dose,frequency,reason,is_supplement,tue,active')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('active', { ascending: false }).order('name');
        renderMeds(data);
      } catch (_) { renderMeds([]); }

      // ── Cardiac & PCMA screenings ──
      try {
        const { data } = await window.sb.from('medical_screenings')
          .select('type,performed_on,result,status,next_due')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('performed_on', { ascending: false });
        renderScreenings(data);
      } catch (_) { renderScreenings([]); }

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

      // ── Surgical history tab (fetched once; related injury looked up in _injuries) ──
      try {
        const { data } = await window.sb.from('surgeries')
          .select('procedure,surgery_date,laterality,surgeon,clinic,implants,outcome,related_injury_id,notes')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('surgery_date', { ascending: false });
        renderSurgeries(data);
      } catch (_) { renderSurgeries([]); }

      // ── Illness & episodes + concussion log (fetched once) ──
      try {
        const { data } = await window.sb.from('medical_episodes')
          .select('category,system,diagnosis,start_date,end_date,days_lost,status,detail,notes')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('start_date', { ascending: false });
        renderEpisodes(data);
      } catch (_) { renderEpisodes([]); }

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

      // ── Imaging & studies (fetched once) ──
      try {
        const { data } = await window.sb.from('medical_studies')
          .select('modality,study_date,body_area,finding,file_url,related_injury_id')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('study_date', { ascending: false });
        renderStudies(data);
      } catch (_) { renderStudies([]); }

      // ── Documents (fetched once; signed URLs generated on click) ──
      try {
        const { data } = await window.sb.from('medical_documents')
          .select('type,title,file_path,doc_date,uploaded_by')
          .eq('club_id', clubId).eq('player_id', playerId)
          .order('doc_date', { ascending: false });
        renderDocuments(data);
      } catch (_) { renderDocuments([]); }
    } finally {
      doneLoading();
    }
  }

  resetRegions();
  boot();
})();
