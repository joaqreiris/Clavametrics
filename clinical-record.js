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

  // ── Overview injury heatmap state (fetched once, re-rendered on toggle) ──────
  let _injuries = [];
  let _bodyView = 'front';
  const SEV_RANK = { minor: 1, moderate: 2, severe: 3 };
  const SEV_COLOR = { severe: 'var(--cm-danger)', moderate: 'var(--cm-warning)', minor: '#EA580C' };

  function renderOverviewHeatmap(view) {
    const svg = document.getElementById('cr-bodySvg');
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
      html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color +
        '" stroke="var(--cm-surface)" stroke-width="1.5" class="hot-dot' + pulseCls + '"><title>' + esc(tip) + '</title></circle>';
      if (g.total > 1) {
        html += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" ' +
          'font-size="5.5" font-weight="700" fill="white" pointer-events="none">' + (g.total > 9 ? '9+' : g.total) + '</text>';
      }
    });
    svg.innerHTML = html;
  }

  // ── Synchronous reset: blank every mock/data-driven region BEFORE any fetch ──
  function resetRegions() {
    const m = mainEl(); if (m) m.classList.add('is-loading');

    // identity band
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
    setHTML('cr-bodySvg', ''); // clear hotspots only — keep the silhouette img

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

  // ── Overview heatmap Front/Back toggle ──────────────────────────────────────
  document.querySelectorAll('#bodymap-overview .bm-toggle button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view === 'back' ? 'back' : 'front';
      _bodyView = view;
      document.querySelectorAll('#bodymap-overview .bm-toggle button')
        .forEach(b => b.classList.toggle('is-active', b === btn));
      const img = document.getElementById('cr-bodyImg');
      if (img) img.src = view === 'back' ? 'assets/body-male-back.png' : 'assets/body-male-front.png';
      renderOverviewHeatmap(view);
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

      let clubId = null;
      try { clubId = await window.getClubId(); } catch (_) {}
      if (!clubId) { showError('No club found for this account.'); return; }

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

      // ── Medical profile (1 row) — feeds review dates, baseline & alerts ──
      let profile = null;
      try {
        const { data } = await window.sb.from('player_medical_profile')
          .select('blood_type,blood_phenotype,allergies,chronic_conditions,family_history,emergency_contact,treating_physician,insurance,last_review_date,next_review_date')
          .eq('club_id', clubId).eq('player_id', playerId).maybeSingle();
        profile = data;
      } catch (_) {}
      const p = profile || {};
      renderReview(p);
      renderBaseline(p);
      renderAlerts(p);

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

      // ── Injuries → Overview body heatmap (fetched once) ──
      try {
        const { data } = await window.sb.from('injuries')
          .select('body_area,severity,status')
          .eq('club_id', clubId).eq('player_id', playerId);
        _injuries = arr(data);
      } catch (_) { _injuries = []; }
      renderOverviewHeatmap(_bodyView);
    } finally {
      doneLoading();
    }
  }

  resetRegions();
  boot();
})();
