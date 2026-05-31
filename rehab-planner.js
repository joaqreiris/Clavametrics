/* Rehab Planner — data + view rendering + mode switching
   No framework; just DOM mutation. */

(function () {
  'use strict';

  // ─── Data: REHAB week 4, Mon → Sun ───
  // type codes match CSS .t-* classes
  const WEEK_REHAB = [
    {
      dow: 'Mon', dom: 26, mode: ['gym', 'physio'],
      blocks: [
        { type: 'mob', name: 'Hip mobility flow', dur: 12, exercises: 5, au: 28, resp: 'physio', restr: null,
          gps: [], notes: 'Light. Daily check first.' },
        { type: 'act', name: 'Glute / core activation', dur: 18, exercises: 6, au: 64, resp: 'physio', restr: null,
          gps: [] },
        { type: 'str', name: 'Posterior chain — light', dur: 28, exercises: 4, au: 180, resp: 'sc', restr: 'No deep ROM',
          gps: [] },
        { type: 'cool', name: 'Cooldown · breathwork', dur: 8, exercises: 2, au: 12, resp: 'physio' }
      ]
    },
    {
      dow: 'Tue', dom: 27, mode: ['pitch', 'recov'],
      blocks: [
        { type: 'warmup', name: 'RAMP warm-up', dur: 12, exercises: 4, au: 24, resp: 'sc' },
        { type: 'plyo', name: 'Sub-max plyos · bilateral', dur: 18, exercises: 4, au: 88, resp: 'sc', restr: null,
          gps: [{ l: 'TD', v: '0.4 km' }] },
        { type: 'cond', name: 'Linear running · 70%', dur: 22, exercises: 3, au: 156, resp: 'sc',
          gps: [{ l: 'Vmax', v: '5.8 m/s' }, { l: 'HSR', v: '120 m', warn: false }, { l: 'TD', v: '1.8 km' }],
          notes: 'Cap Vmax at 75% of baseline.' },
        { type: 'cool', name: 'Cooldown · ice bath', dur: 10, exercises: 1, au: 8, resp: 'physio' }
      ]
    },
    {
      dow: 'Wed', dom: 28, rest: true
    },
    {
      dow: 'Thu', dom: 29, mode: ['gym'], today: true,
      blocks: [
        { type: 'warmup', name: 'RAMP — lower body', dur: 10, exercises: 4, au: 18, resp: 'sc' },
        { type: 'myo', name: 'Myofascial · foam', dur: 8, exercises: 3, au: 10, resp: 'physio' },
        { type: 'str', name: 'Posterior chain strength', dur: 32, exercises: 4, au: 224, resp: 'sc', selected: true,
          notes: 'Nordic emphasis · film set 3' },
        { type: 'assess', name: 'Iso-strength test', dur: 12, exercises: 1, au: 22, resp: 'physio', restr: null,
          gps: [] },
        { type: 'cool', name: 'Cooldown', dur: 6, exercises: 1, au: 6, resp: 'sc' }
      ]
    },
    {
      dow: 'Fri', dom: 30, mode: ['pitch'],
      blocks: [
        { type: 'warmup', name: 'Movement prep', dur: 12, exercises: 5, au: 22, resp: 'sc' },
        { type: 'plyo', name: 'Plyo · unilateral', dur: 16, exercises: 5, au: 96, resp: 'sc',
          gps: [{ l: 'TD', v: '0.5 km' }] },
        { type: 'cond', name: 'COD · low-amplitude', dur: 24, exercises: 4, au: 168, resp: 'sc',
          gps: [{ l: 'Vmax', v: '6.2 m/s' }, { l: 'HSR', v: '180 m' }, { l: 'TD', v: '2.4 km' }],
          notes: 'Decel reps in protected ROM.' },
        { type: 'skills', name: 'Ball reintegration', dur: 16, exercises: 3, au: 72, resp: 'coach',
          gps: [] },
        { type: 'cool', name: 'Cooldown', dur: 8, exercises: 1, au: 8, resp: 'physio' }
      ]
    },
    {
      dow: 'Sat', dom: 31, mode: ['gym', 'recov'],
      blocks: [
        { type: 'mob', name: 'Mobility flow', dur: 14, exercises: 5, au: 22, resp: 'physio' },
        { type: 'str', name: 'Upper body push/pull', dur: 28, exercises: 5, au: 168, resp: 'sc',
          notes: 'Maintenance — UB unaffected.' },
        { type: 'cool', name: 'Sauna + stretch', dur: 20, exercises: 2, au: 14, resp: 'physio' }
      ]
    },
    {
      dow: 'Sun', dom: 1, rest: true
    }
  ];

  // ─── Data: PREVENTIVE week 4, Mon → Sun ───
  const WEEK_PREV = [
    {
      dow: 'Mon', dom: 26, mode: ['gym'],
      blocks: [
        { type: 'warmup', name: 'Movement prep', dur: 10, exercises: 4, au: 18, resp: 'sc' },
        { type: 'act', name: 'Glute / hamstring activation', dur: 14, exercises: 5, au: 48, resp: 'physio', target: 'Hamstring' },
        { type: 'str', name: 'Posterior chain — Nordic emphasis', dur: 26, exercises: 4, au: 196, resp: 'physio', target: 'Hamstring', notes: 'Add tempo set on Nordic.' },
        { type: 'cool', name: 'Mobility cooldown', dur: 8, exercises: 2, au: 12, resp: 'physio' }
      ]
    },
    {
      dow: 'Tue', dom: 27, mode: ['pitch'],
      blocks: [
        { type: 'warmup', name: 'RAMP', dur: 12, exercises: 4, au: 22, resp: 'sc' },
        { type: 'skills', name: 'Team session — full', dur: 75, exercises: 0, au: 420, resp: 'coach', notes: 'No restriction. Monitor RPE.' }
      ]
    },
    {
      dow: 'Wed', dom: 28, mode: ['gym'],
      blocks: [
        { type: 'warmup', name: 'Movement prep', dur: 8, exercises: 4, au: 16, resp: 'sc' },
        { type: 'plyo', name: 'Plyometrics — bilateral', dur: 16, exercises: 4, au: 88, resp: 'sc' },
        { type: 'str', name: 'Hip / adductor strength', dur: 24, exercises: 4, au: 172, resp: 'physio', target: 'Adductor', notes: 'Copenhagen + Cossack squat.' },
        { type: 'cool', name: 'Cooldown', dur: 6, exercises: 1, au: 6, resp: 'sc' }
      ]
    },
    {
      dow: 'Thu', dom: 29, mode: ['pitch'], today: true,
      blocks: [
        { type: 'warmup', name: 'RAMP', dur: 12, exercises: 4, au: 22, resp: 'sc' },
        { type: 'skills', name: 'Team session — tactical', dur: 65, exercises: 0, au: 360, resp: 'coach' },
        { type: 'str', name: 'Supplementary — Nordic + RDL', dur: 18, exercises: 2, au: 132, resp: 'physio', target: 'Hamstring', notes: 'After session, in gym.' }
      ]
    },
    {
      dow: 'Fri', dom: 30, mode: ['pitch'],
      blocks: [
        { type: 'warmup', name: 'RAMP', dur: 10, exercises: 4, au: 20, resp: 'sc' },
        { type: 'skills', name: 'Team session — set pieces', dur: 60, exercises: 0, au: 320, resp: 'coach' },
        { type: 'cool', name: 'Cooldown + stretch', dur: 12, exercises: 2, au: 14, resp: 'physio' }
      ]
    },
    {
      dow: 'Sat', dom: 31, mode: ['pitch'],
      blocks: [
        { type: 'warmup', name: 'Match warm-up', dur: 25, exercises: 5, au: 80, resp: 'sc' },
        { type: 'skills', name: 'Match — vs. River', dur: 95, exercises: 0, au: 720, resp: 'coach', notes: 'Track HSR.' }
      ]
    },
    {
      dow: 'Sun', dom: 1, mode: ['recov'],
      blocks: [
        { type: 'cool', name: 'Active recovery', dur: 30, exercises: 3, au: 36, resp: 'physio', notes: 'Pool + mobility.' }
      ]
    }
  ];

  // Active week — swapped by applyMode
  let WEEK = WEEK_REHAB;

  // ─── Data: physio's exercise library ───
  const LIBRARY = [
    { name: 'Nordic hamstring lower', region: 'Hamstring', sets: 4, reps: 6, custom: false },
    { name: 'Single-leg RDL — KB', region: 'Hamstring', sets: 4, reps: 8, custom: false },
    { name: 'Copenhagen adductor — eccentric', region: 'Adductor', sets: 3, reps: 8, custom: true },
    { name: 'Hip thrust — barbell', region: 'Glute', sets: 5, reps: 5, custom: false },
    { name: 'Cossack squat — loaded', region: 'Adductor', sets: 3, reps: 6, custom: false },
    { name: 'RM hamstring switch — single-leg', region: 'Hamstring', sets: 3, reps: 10, custom: true },
    { name: 'Pallof press — anti-rotation', region: 'Core', sets: 3, reps: 12, custom: false },
    { name: 'Hip 90/90 isometric hold', region: 'Glute', sets: 3, reps: '30s', custom: false },
    { name: 'Single-leg bridge — banded', region: 'Glute', sets: 3, reps: 12, custom: true },
    { name: 'Side plank w/ adduction', region: 'Core', sets: 3, reps: '40s', custom: false }
  ];

  // ─── Helpers ───
  const TYPE_LABEL = {
    warmup: 'Warm-up', myo: 'Myofascial', mob: 'Mobility', act: 'Activation',
    str: 'Strength', plyo: 'Plyometrics', skills: 'Skills', field: 'On-field',
    cond: 'Conditioning', cool: 'Cooldown', assess: 'Assessment'
  };
  const TYPE_COLOR = {
    warmup: '#10B981', myo: '#A78BFA', mob: '#06B6D4', act: '#22C55E',
    str: '#DC2626', plyo: '#F59E0B', skills: '#3B82F6', field: '#15803D',
    cond: '#EA580C', cool: '#64748B', assess: '#0EA5E9'
  };
  const RESP_LABEL = { physio: 'Physio', sc: 'S&C', coach: 'Coach' };
  const MODE_PILL = {
    pitch:  ['ti-soccer-field', 'is-pitch',  'Pitch'],
    gym:    ['ti-barbell',      'is-gym',    'Gym'],
    physio: ['ti-stethoscope',  'is-physio', 'Physio'],
    recov:  ['ti-droplet',      'is-recov',  'Recov']
  };

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // ─── Render: physio exercise library ───
  function renderLibrary() {
    const root = $('#lib-list');
    if (!root) return;
    root.innerHTML = '';
    LIBRARY.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'rp-lib-ex' + (ex.custom ? ' is-custom' : '');
      row.innerHTML = `
        <span class="grip"><i class="ti ti-grip-vertical"></i></span>
        <div class="body">
          <div class="name">${ex.name}</div>
          <div class="meta">
            <span>${ex.region}</span>
            <span class="sep">·</span>
            <span>${ex.sets}×${ex.reps}</span>
            ${ex.custom ? '<span class="tag">Custom</span>' : ''}
          </div>
        </div>
        <button class="add-btn" title="Add to selected block"><i class="ti ti-plus"></i></button>
      `;
      root.appendChild(row);
    });
  }

  // ─── Render: Kanban ───
  function renderKanban() {
    const root = $('#kanban');
    root.innerHTML = '';
    WEEK.forEach((day, di) => {
      const card = document.createElement('div');
      card.className = 'rp-day' + (day.rest ? ' is-rest' : '') + (day.today ? ' is-today' : '');
      // header
      const head = document.createElement('div');
      head.className = 'rp-day-h';
      head.innerHTML = `
        <div class="top">
          <span class="dow">${day.dow}${day.today ? ' · TODAY' : ''}</span>
          <span class="dom">${day.dom}</span>
        </div>
        <div class="pillrow">${(day.mode || []).map(m => {
          const [icon, cls, label] = MODE_PILL[m];
          return `<span class="rp-mini-pill ${cls}"><i class="ti ${icon}"></i>${label}</span>`;
        }).join('')}</div>
      `;
      card.appendChild(head);

      // body
      const body = document.createElement('div');
      body.className = 'rp-day-body';
      if (day.rest) {
        body.innerHTML = `<i class="ti ti-bed"></i><span>Active rest</span><span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">Wellness check only</span>`;
      } else {
        let totalAu = 0, totalDur = 0;
        day.blocks.forEach((b, bi) => {
          totalAu += b.au || 0;
          totalDur += b.dur || 0;
          const block = document.createElement('div');
          block.className = 'rp-block t-' + b.type + (b.selected ? ' is-selected' : '');
          block.dataset.dayIdx = di;
          block.dataset.blockIdx = bi;
          let gpsHtml = '';
          if (b.gps && b.gps.length) {
            gpsHtml = `<div class="rp-block-gps">${b.gps.map(g => `<span class="rp-gps-pill${g.warn ? ' warn' : ''}"><span class="l">${g.l}</span><span class="v">${g.v}</span></span>`).join('')}</div>`;
          }
          const contraHtml = b.restr
            ? `<div class="rp-block-contra"><i class="ti ti-alert-triangle"></i>${b.restr}</div>` : '';
          block.innerHTML = `
            <div class="rp-block-stripe"></div>
            <div class="rp-block-h">
              <div class="rp-block-name">${b.name}</div>
              <div class="rp-block-time">${b.dur}'</div>
            </div>
            <div class="rp-block-meta">
              <span class="au">${b.au} AU</span>
              <span class="sep">·</span>
              <span>${b.exercises} ex</span>
              <span class="sep">·</span>
              <span class="resp ${b.resp}"><span class="dot"></span>${RESP_LABEL[b.resp]}</span>
            </div>
            ${gpsHtml}
            ${contraHtml}
            ${b.target ? `<div class="rp-block-target"><i class="ti ti-target"></i>Targets · ${b.target}</div>` : ''}
          `;
          body.appendChild(block);
        });
        // add-block
        const addBtn = document.createElement('button');
        addBtn.className = 'rp-add-block';
        addBtn.innerHTML = `<i class="ti ti-plus"></i> Add block`;
        body.appendChild(addBtn);
        card.appendChild(body);

        // footer totals
        const foot = document.createElement('div');
        foot.className = 'rp-day-totals';
        foot.innerHTML = `<span><strong>${totalDur}'</strong> total</span> <span><strong>${totalAu}</strong> AU</span>`;
        card.appendChild(foot);
        return root.appendChild(card);
      }
      card.appendChild(body);
      root.appendChild(card);
    });
  }

  // ─── Render: Table ───
  function renderTable() {
    const tbody = $('#tbody');
    tbody.innerHTML = '';
    WEEK.forEach(day => {
      const dayRow = document.createElement('tr');
      dayRow.className = 'is-day-h';
      dayRow.innerHTML = `<td colspan="8">${day.dow}, ${day.dom === 1 ? 'Jun' : 'May'} ${day.dom}${day.today ? ' · TODAY' : ''}</td>`;
      tbody.appendChild(dayRow);
      if (day.rest) {
        const r = document.createElement('tr');
        r.className = 'is-rest';
        r.innerHTML = `<td colspan="8">— Active rest · wellness check only</td>`;
        tbody.appendChild(r);
        return;
      }
      day.blocks.forEach(b => {
        const r = document.createElement('tr');
        if (b.selected) r.style.background = 'var(--cm-bg-soft)';
        const gpsStr = (b.gps || []).map(g => `${g.l} ${g.v}`).join(' · ') || '—';
        r.innerHTML = `
          <td><span class="nm"><span class="swatch" style="background:${TYPE_COLOR[b.type]}"></span>${b.name}<span style="color:var(--cm-fg-muted);font-weight:400;margin-left:8px;font:500 10.5px/1 var(--cm-font-mono);letter-spacing:0.06em;text-transform:uppercase">${TYPE_LABEL[b.type]}</span></span></td>
          <td class="mono">${b.dur}'</td>
          <td><span style="display:inline-flex;align-items:center;gap:4px;font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg)"><span style="width:7px;height:7px;border-radius:50%;background:${b.resp==='physio'?'#B91C1C':b.resp==='sc'?'#1D4ED8':'#A16207'}"></span>${RESP_LABEL[b.resp]}</span></td>
          <td class="mono">${b.exercises} ex</td>
          <td class="mono">${b.au < 50 ? 'Low' : b.au < 150 ? 'Mod' : 'High'}</td>
          <td class="mono" style="color:var(--cm-fg-muted)">${gpsStr}</td>
          <td class="mono" style="color:var(--cm-fg-strong);font-weight:600">${b.au}</td>
          <td style="color:var(--cm-fg-muted);font:var(--cm-body-sm)">${b.restr ? '<span style="color:#B91C1C"><i class="ti ti-alert-triangle"></i> ' + b.restr + '</span>' : (b.notes || '—')}</td>
        `;
        tbody.appendChild(r);
      });
    });
  }

  // ─── Render: Timeline ───
  function renderTimeline() {
    const root = $('#tl-rows');
    root.innerHTML = '';
    // we'll use minutes/90 * width for each block; 90 min = full row
    WEEK.forEach(day => {
      const row = document.createElement('div');
      row.className = 'rp-tl-row';
      const dayCol = document.createElement('div');
      dayCol.className = 'day';
      dayCol.innerHTML = `<span class="dow">${day.dow}</span> ${day.dom}<div class="since">${day.today ? 'D24 · today' : ''}</div>`;
      row.appendChild(dayCol);
      const track = document.createElement('div');
      track.className = 'rp-tl-track';
      if (day.rest) {
        track.innerHTML = `<span class="rp-tl-rest"><i class="ti ti-bed"></i> Active rest</span>`;
      } else {
        day.blocks.forEach(b => {
          const w = (b.dur / 90) * 100;
          const block = document.createElement('div');
          block.className = 'rp-tl-block t-' + b.type;
          block.style.flexBasis = w + '%';
          block.style.flexGrow = '0';
          block.innerHTML = `${b.name.length > 22 ? b.name.slice(0, 21) + '…' : b.name} <span class="du">${b.dur}'</span>`;
          track.appendChild(block);
        });
      }
      row.appendChild(track);
      root.appendChild(row);
    });
  }

  // ─── View switching ───
  function showView(view) {
    $$('#view-seg button').forEach(b => b.classList.toggle('is-on', b.dataset.view === view));
    $('#view-kanban').classList.toggle('rp-hidden', view !== 'kanban');
    $('#view-table').classList.toggle('rp-hidden', view !== 'table');
    $('#view-timeline').classList.toggle('rp-hidden', view !== 'timeline');
  }

  // ─── Mode switching (picker → planner & between modes) ───
  function applyMode(mode) {
    document.body.dataset.rpMode = mode;
    const tag = $('#mode-tag');
    const phasebar = $('#phasebar');
    const trainbar = $('#trainbar');
    const criteriaCard = $('#criteria-card');
    const libraryCard = $('#library-card');
    const linkRehab = $('#linkrow-rehab');
    const linkPrev = $('#linkrow-prev');
    const ctx = $('#athlete-ctx');
    const crumb = $('#crumb-now');

    if (mode === 'rehab') {
      WEEK = WEEK_REHAB;
      tag.className = 'mode-tag is-rehab';
      tag.innerHTML = '<i class="ti ti-activity-heartbeat"></i> Rehab · RTP';
      phasebar.style.display = '';
      trainbar.classList.add('rp-hidden');
      $('#macro').style.display = '';
      criteriaCard.classList.remove('rp-hidden');
      libraryCard.classList.add('rp-hidden');
      linkRehab.style.display = '';
      linkPrev.hidden = true;
      ctx.innerHTML = `
        <span><strong>RF</strong> · #18</span>
        <span class="sep">·</span>
        <span>Hamstring (BFlh) grade II</span>
        <span class="sep">·</span>
        <span>Sustained <strong>May 03</strong> · vs. Boca</span>
        <span class="sep">·</span>
        <span>Day <strong>24</strong> of rehab</span>`;
      crumb.textContent = 'Mateó Fernández · Rehab plan';
    } else if (mode === 'perf') {
      WEEK = WEEK_REHAB; // unused in this module now
      tag.className = 'mode-tag is-perf';
      tag.innerHTML = '<i class="ti ti-trending-up"></i> Performance';
      phasebar.style.display = 'none';
      trainbar.classList.add('rp-hidden');
      criteriaCard.classList.add('rp-hidden');
      libraryCard.classList.add('rp-hidden');
      linkRehab.style.display = 'none';
      linkPrev.hidden = true;
      ctx.innerHTML = `
        <span><strong>RF</strong> · #18</span>
        <span class="sep">·</span>
        <span>Performance block · in-season</span>`;
      crumb.textContent = 'Mateo Fernández · Performance plan';
    } else { // prev
      WEEK = WEEK_PREV;
      tag.className = 'mode-tag is-prev';
      tag.innerHTML = '<i class="ti ti-shield-half-filled"></i> Preventive';
      phasebar.style.display = 'none';
      trainbar.classList.remove('rp-hidden');
      $('#macro').style.display = 'none';
      criteriaCard.classList.add('rp-hidden');
      libraryCard.classList.remove('rp-hidden');
      linkRehab.style.display = 'none';
      linkPrev.hidden = false;
      linkPrev.style.display = 'flex';
      ctx.innerHTML = `
        <span><strong>RF</strong> · #18</span>
        <span class="sep">·</span>
        <span>Risk flag · hamstring (history)</span>
        <span class="sep">·</span>
        <span>Programme week <strong>4</strong> of 8</span>
        <span class="sep">·</span>
        <span>Parallel to team MC 14</span>`;
      crumb.textContent = 'Mateo Fernández · Preventive plan';
    }

    // Re-render views with new WEEK
    renderKanban();
    renderTable();
    renderTimeline();

    // Tweaks panel may be open and stale — let it re-read
    window.dispatchEvent(new CustomEvent('rp-mode-change', { detail: { mode } }));
  }

  function showPlanner() {
    $('#view-picker').classList.add('rp-hidden');
    $('#view-planner').classList.remove('rp-hidden');
    $('#back-to-picker').style.display = '';
  }
  function showPicker() {
    $('#view-planner').classList.add('rp-hidden');
    $('#view-picker').classList.remove('rp-hidden');
    $('#back-to-picker').style.display = 'none';
    $('#crumb-now').textContent = 'New plan';
  }

  // ─── Wire up ───
  document.addEventListener('DOMContentLoaded', () => {
    renderKanban();
    renderTable();
    renderTimeline();
    renderLibrary();

    // picker → planner
    $$('.rp-type').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        applyMode(mode);
        showPlanner();
      });
    });
    // keyboard shortcuts for picker (1/2)
    document.addEventListener('keydown', (e) => {
      if ($('#view-picker').classList.contains('rp-hidden')) return;
      if (e.key === '1' || e.key === '2') {
        const map = { '1': 'prev', '2': 'rehab' };
        const mode = map[e.key];
        applyMode(mode);
        showPlanner();
      } else if (e.key === 'Escape') {
        // no-op: cancel target could route back to Hub
      }
    });

    // back to picker
    $('#back-to-picker').addEventListener('click', showPicker);

    // view seg
    $$('#view-seg button').forEach(b => {
      b.addEventListener('click', () => showView(b.dataset.view));
    });

    // block click → select (simple selection demo)
    document.addEventListener('click', (e) => {
      const block = e.target.closest('.rp-block');
      if (!block) return;
      $$('.rp-block.is-selected').forEach(b => b.classList.remove('is-selected'));
      block.classList.add('is-selected');
    });

    // Expose for tweaks panel + Supabase wiring
    window.__rpApi = {
      setMode: applyMode,
      showView,
      showPlanner,
      showPicker,
      setWeekData: (data) => { WEEK = data; renderKanban(); renderTable(); renderTimeline(); },
      setShowPhasebar: (on) => { $('#phasebar').style.display = on ? '' : 'none'; },
      setShowCriteria: (on) => {
        const c = $('#criteria-card');
        if (document.body.dataset.rpMode === 'rehab') {
          c.classList.toggle('rp-hidden', !on);
        }
      },
      setShowSidePanel: (on) => {
        $('#side-panel').style.display = on ? '' : 'none';
        $('#workspace').classList.toggle('no-side', !on);
      },
      setDensity: (d) => { document.body.dataset.rpDensity = d; },
      setShowMacro: (on) => { $('#macro').style.display = on ? '' : 'none'; }
    };
  });
})();
