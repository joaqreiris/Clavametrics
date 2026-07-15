/* Rehab Planner — data + view rendering + mode switching
   No framework; just DOM mutation. */

(function () {
  'use strict';

  function tt(key, fallbackEN, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
  }

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

  // ─── Data: preventive exercise library — loaded from gym_exercises ───
  let LIBRARY = [];          // mapped rows: { id, name, region, category, complexity, equipment, custom }
  let libCat = 'All';        // active category chip
  let libQuery  = '';        // search box
  let libLoaded = false;

  async function loadLibrary() {
    try {
      const clubId = await window.getClubId();
      const { data, error } = await window.sb.from('gym_exercises')
        .select('id,name,muscle_group,category,complexity,equipment,usable_in,is_default')
        .eq('club_id', clubId)
        .contains('usable_in', ['preventive'])
        .order('name');
      if (error) throw error;
      LIBRARY = (data || []).map(ex => ({
        id:         ex.id,
        name:       ex.name || 'Unnamed',
        region:     ex.muscle_group || 'Other',
        category:   ex.category || '',
        complexity: ex.complexity || '',
        equipment:  ex.equipment || '',
        custom:     !ex.is_default          // the 120 defaults are not "custom"; club-owned ones are
      }));
    } catch (err) {
      console.error('[rehab-planner] preventive library load failed:', err);
      LIBRARY = [];
    }
    libLoaded = true;
    renderLibChips();
    renderLibrary();
  }

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
  // Localized label lookups (re-resolve on each render / language change)
  const typeLabel = t => tt('rehab_planner.type_' + t, TYPE_LABEL[t] || t);
  const respLabel = r => tt('rehab_planner.resp_' + r, RESP_LABEL[r] || r);
  const modeLabel = m => tt('rehab_planner.mode_' + m, (MODE_PILL[m] && MODE_PILL[m][2]) || m);

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // ─── Render: preventive exercise library (region chips) ───
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  function renderLibChips() {
    const root = $('#lib-filters');
    if (!root) return;
    const cats = [...new Set(LIBRARY.map(e => e.category).filter(Boolean))].sort();
    root.innerHTML = ['All', ...cats].map(c =>
      `<button class="rp-lib-chip${libCat === c ? ' is-on' : ''}" data-cat="${c}">${c === 'All' ? tt('common.all', 'All') : (TYPE_LABEL[c] ? typeLabel(c) : cap(c))}</button>`
    ).join('');
    $$('#lib-filters .rp-lib-chip').forEach(b => b.addEventListener('click', () => {
      libCat = b.dataset.cat;
      renderLibChips();
      renderLibrary();
    }));
  }

  // ─── Render: preventive exercise library list ───
  function renderLibrary() {
    const root = $('#lib-list');
    if (!root) return;
    root.innerHTML = '';
    const q = libQuery.trim().toLowerCase();
    const rows = LIBRARY.filter(ex => {
      if (libCat !== 'All' && ex.category !== libCat) return false;
      if (q && !(ex.name + ' ' + ex.region + ' ' + ex.category).toLowerCase().includes(q)) return false;
      return true;
    });

    if (!rows.length) {
      root.innerHTML = `<div style="padding:18px 8px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${libLoaded ? tt('rehab_planner.no_exercises_match', 'No exercises match.') : tt('rehab_planner.loading_library', 'Loading library…')}</div>`;
      return;
    }

    rows.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'rp-lib-ex' + (ex.custom ? ' is-custom' : '');
      // The library has no real sets/reps — show muscle_group · category · complexity
      row.innerHTML = `
        <span class="grip"><i class="ti ti-grip-vertical"></i></span>
        <div class="body">
          <div class="name">${ex.name}</div>
          <div class="meta">
            <span>${ex.region}</span>
            ${ex.category ? `<span class="sep">·</span><span>${cap(ex.category)}</span>` : ''}
            ${ex.complexity ? `<span class="sep">·</span><span>${ex.complexity}</span>` : ''}
            ${ex.custom ? `<span class="tag">${tt('rehab_planner.custom_tag','Custom')}</span>` : ''}
          </div>
        </div>
        <button class="add-btn" title="${tt('rehab_planner.add_to_selected','Add to selected block')}"><i class="ti ti-plus"></i></button>
      `;
      root.appendChild(row);
      row.querySelector('.add-btn')?.addEventListener('click', () => window._rpAddExerciseToSelected?.(ex));
    });
  }

  // ─── Render: Kanban ───
  function renderKanban() {
    const root = $('#kanban');
    root.innerHTML = '';
    WEEK.forEach((day, di) => {
      const card = document.createElement('div');
      card.className = 'rp-day' + (day.rest ? ' is-rest' : '') + (day.today ? ' is-today' : '');
      if (day.iso) card.dataset.date = day.iso;
      // header
      const head = document.createElement('div');
      head.className = 'rp-day-h';
      head.innerHTML = `
        <div class="top">
          <span class="dow">${day.dow}${day.today ? ' · ' + tt('rehab_planner.today_tag','TODAY') : ''}</span>
          <span class="dom">${day.dom}</span>
        </div>
        <div class="pillrow">${(day.mode || []).map(m => {
          const [icon, cls] = MODE_PILL[m];
          return `<span class="rp-mini-pill ${cls}"><i class="ti ${icon}"></i>${modeLabel(m)}</span>`;
        }).join('')}</div>
      `;
      card.appendChild(head);

      // body
      const body = document.createElement('div');
      body.className = 'rp-day-body';
      if (day.rest) {
        body.innerHTML = `<i class="ti ti-bed"></i><span>${tt('rehab_planner.active_rest','Active rest')}</span><span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${tt('rehab_planner.wellness_check_only','Wellness check only')}</span>`;
      } else {
        let totalAu = 0, totalDur = 0;
        day.blocks.forEach((b, bi) => {
          totalAu += b.au || 0;
          totalDur += b.dur || 0;
          const block = document.createElement('div');
          block.className = 'rp-block t-' + b.type + (b.selected ? ' is-selected' : '');
          block.draggable = true;   // render-proof drag (block-actions)
          block.dataset.dayIdx   = di;
          block.dataset.blockIdx = bi;
          block.dataset.sessionId  = b._id || '';
          block.dataset.blockName  = b.name;
          block.dataset.blockType  = b.type;
          block.dataset.blockDur   = b.dur;
          block.dataset.blockEx    = b.exercises || 0;
          block.dataset.blockAu    = b.au || 0;
          block.dataset.blockNotes = b.notes || '';
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
              <span class="au">${b.au} ${tt('rehab_planner.col_au','AU')}</span>
              <span class="sep">·</span>
              <span>${tt('rehab_planner.n_ex','{count} ex', { count: b.exercises })}</span>
              <span class="sep">·</span>
              <span class="resp ${b.resp}"><span class="dot"></span>${respLabel(b.resp)}</span>
            </div>
            ${gpsHtml}
            ${contraHtml}
            ${b.target ? `<div class="rp-block-target"><i class="ti ti-target"></i>${tt('rehab_planner.targets_label','Targets')} · ${b.target}</div>` : ''}
          `;
          body.appendChild(block);
        });
        // add-block
        const addBtn = document.createElement('button');
        addBtn.className = 'rp-add-block';
        addBtn.innerHTML = `<i class="ti ti-plus"></i> ${tt('rehab_planner.add_block','Add block')}`;
        body.appendChild(addBtn);
        card.appendChild(body);

        // footer totals
        const foot = document.createElement('div');
        foot.className = 'rp-day-totals';
        foot.innerHTML = `<span><strong>${totalDur}'</strong> ${tt('rehab_planner.total','total')}</span> <span><strong>${totalAu}</strong> ${tt('rehab_planner.col_au','AU')}</span>`;
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
      dayRow.innerHTML = `<td colspan="8">${day.dow}, ${day.dom === 1 ? 'Jun' : 'May'} ${day.dom}${day.today ? ' · ' + tt('rehab_planner.today_tag','TODAY') : ''}</td>`;
      tbody.appendChild(dayRow);
      if (day.rest) {
        const r = document.createElement('tr');
        r.className = 'is-rest';
        r.innerHTML = `<td colspan="8">— ${tt('rehab_planner.active_rest','Active rest')} · ${tt('rehab_planner.wellness_check_only','Wellness check only').toLowerCase()}</td>`;
        tbody.appendChild(r);
        return;
      }
      day.blocks.forEach(b => {
        const r = document.createElement('tr');
        if (b.selected) r.style.background = 'var(--cm-bg-soft)';
        const gpsStr = (b.gps || []).map(g => `${g.l} ${g.v}`).join(' · ') || '—';
        r.innerHTML = `
          <td><span class="nm"><span class="swatch" style="background:${TYPE_COLOR[b.type]}"></span>${b.name}<span style="color:var(--cm-fg-muted);font-weight:400;margin-left:8px;font:500 10.5px/1 var(--cm-font-mono);letter-spacing:0.06em;text-transform:uppercase">${typeLabel(b.type)}</span></span></td>
          <td class="mono">${b.dur}'</td>
          <td><span style="display:inline-flex;align-items:center;gap:4px;font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg)"><span style="width:7px;height:7px;border-radius:50%;background:${b.resp==='physio'?'#B91C1C':b.resp==='sc'?'#1D4ED8':'#A16207'}"></span>${respLabel(b.resp)}</span></td>
          <td class="mono">${tt('rehab_planner.n_ex','{count} ex', { count: b.exercises })}</td>
          <td class="mono">${b.au < 50 ? tt('rehab_planner.intensity_low','Low') : b.au < 150 ? tt('rehab_planner.intensity_mod','Mod') : tt('rehab_planner.intensity_high','High')}</td>
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
      dayCol.innerHTML = `<span class="dow">${day.dow}</span> ${day.dom}<div class="since">${day.today ? 'D24 · ' + tt('rehab_planner.today_lc','today') : ''}</div>`;
      row.appendChild(dayCol);
      const track = document.createElement('div');
      track.className = 'rp-tl-track';
      if (day.rest) {
        track.innerHTML = `<span class="rp-tl-rest"><i class="ti ti-bed"></i> ${tt('rehab_planner.active_rest','Active rest')}</span>`;
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
      tag.innerHTML = '<i class="ti ti-activity-heartbeat"></i> ' + tt('rehab_planner.tag_rehab_rtp', 'Rehab · RTP');
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
      tag.innerHTML = '<i class="ti ti-trending-up"></i> ' + tt('rehab_planner.tag_performance', 'Performance');
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
      tag.innerHTML = '<i class="ti ti-shield-half-filled"></i> ' + tt('rehab_planner.preventive', 'Preventive');
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
    $('#crumb-now').textContent = tt('rehab_planner.new_plan', 'New plan');
  }

  // ─── Wire up ───
  document.addEventListener('DOMContentLoaded', () => {
    renderKanban();
    renderTable();
    renderTimeline();
    renderLibrary();     // paints "Loading library…" placeholder
    loadLibrary();       // fetch real preventive exercises, then re-render chips + list

    // Library search
    const libSearch = $('#lib-search');
    if (libSearch) libSearch.addEventListener('input', e => { libQuery = e.target.value; renderLibrary(); });

    // "New exercise" → centralized creation in Gym Library
    const goGymLib = () => { window.location.href = 'Gym Library.html'; };
    const libNewTop = $('#lib-new-top');
    const libNewFoot = $('#lib-new-foot');
    if (libNewTop) libNewTop.addEventListener('click', goGymLib);
    if (libNewFoot) libNewFoot.addEventListener('click', goGymLib);

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

    // ⌘K / Ctrl+K — open add-block drawer for today when planner is visible
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const kbdMod = document.getElementById('rp-kbd-mod');
    if (kbdMod) kbdMod.textContent = isMac ? '⌘' : 'Ctrl';

    document.addEventListener('keydown', (e) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return;
      if ($('#view-picker').classList.contains('rp-hidden') === false) return; // picker open
      e.preventDefault();
      const todayCard = document.querySelector('.rp-day.is-today');
      let day = '', dayDate = '';
      if (todayCard) {
        const dow = todayCard.querySelector('.dow');
        const dom = todayCard.querySelector('.dom');
        if (dow && dom) day = dow.textContent.replace(/·.*$/, '').trim() + ', ' + dom.textContent;
        dayDate = todayCard.dataset.date || '';
      }
      const ctx = document.body.dataset.rpMode === 'prev' ? 'prev' : 'rehab';
      window.openBlockDrawer({ context: ctx, day, dayDate });
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

    // Re-render dynamic chrome on language change (keeps DB-loaded data intact:
    // WEEK is whatever was last set, so re-rendering only re-localizes labels).
    document.addEventListener('cm:langchanged', () => {
      renderKanban();
      renderTable();
      renderTimeline();
      renderLibChips();
      renderLibrary();
      // Re-localize the mode tag label without clobbering DB-loaded context.
      const tag = $('#mode-tag');
      const mode = document.body.dataset.rpMode;
      if (tag && mode) {
        if (mode === 'rehab')      tag.innerHTML = '<i class="ti ti-activity-heartbeat"></i> ' + tt('rehab_planner.tag_rehab_rtp', 'Rehab · RTP');
        else if (mode === 'perf')  tag.innerHTML = '<i class="ti ti-trending-up"></i> ' + tt('rehab_planner.tag_performance', 'Performance');
        else if (mode === 'prev')  tag.innerHTML = '<i class="ti ti-shield-half-filled"></i> ' + tt('rehab_planner.preventive', 'Preventive');
      }
      // Re-run DB-driven builders if the plan is loaded (re-localizes phasebar/macro/gate/trainbar).
      if (typeof window._rpRefreshPhases === 'function') window._rpRefreshPhases();
      if (typeof window._rpRefreshTrainbar === 'function') window._rpRefreshTrainbar();
    });
  });
})();
