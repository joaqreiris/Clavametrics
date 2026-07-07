/* Individual S&C Planner — data + rendering.
   Reuses same DOM shape as rehab-planner.js for kanban/table/timeline. */

(function () {
  'use strict';

  function tt(key, fallbackEN, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
  }

  // ─── Sample week: Lautaro Vergara · CB · Capacity block W4 ───
  const WEEK = [
    {
      dow: 'Mon', dom: 26, mode: ['gym', 'recov'],
      blocks: [
        { type: 'mob', name: 'Recovery mobility', dur: 18, exercises: 5, au: 28, resp: 'physio',
          notes: 'Day after high-load session.' },
        { type: 'str', name: 'Posterior chain · accessory', dur: 24, exercises: 4, au: 152, resp: 'sc',
          goal: 'Maintenance · 65% 1RM' },
        { type: 'cool', name: 'Cooldown · stretch', dur: 8, exercises: 2, au: 10, resp: 'sc' }
      ]
    },
    {
      dow: 'Tue', dom: 27, mode: ['pitch', 'gym'],
      blocks: [
        { type: 'warmup', name: 'RAMP', dur: 12, exercises: 4, au: 22, resp: 'sc' },
        { type: 'skills', name: 'Team session · tactical', dur: 75, exercises: 0, au: 420, resp: 'coach',
          gps: [{ l: 'TD', v: '5.2 km' }, { l: 'HSR', v: '320 m' }] },
        { type: 'str', name: 'Strength · upper body', dur: 32, exercises: 5, au: 224, resp: 'sc',
          goal: '80% 1RM · velocity 0.45 m/s' }
      ]
    },
    {
      dow: 'Wed', dom: 28, mode: ['pitch'], today: true,
      blocks: [
        { type: 'warmup', name: 'Movement prep · running', dur: 14, exercises: 5, au: 28, resp: 'sc' },
        { type: 'cond', name: 'Aerobic capacity intervals', dur: 42, exercises: 3, au: 412, resp: 'sc', selected: true,
          goal: '15:15 · 90% MAS',
          gps: [{ l: 'TD', v: '3.6 km' }, { l: 'HSR', v: '680 m' }, { l: 'Vmax', v: '7.4 m/s' }, { l: 'Sprints', v: '14' }],
          notes: 'Outdoor. Re-test MAS end of W5.' },
        { type: 'cool', name: 'Cooldown', dur: 8, exercises: 1, au: 10, resp: 'sc' }
      ]
    },
    {
      dow: 'Thu', dom: 29, mode: ['pitch', 'gym'],
      blocks: [
        { type: 'warmup', name: 'RAMP', dur: 12, exercises: 4, au: 22, resp: 'sc' },
        { type: 'skills', name: 'Team session · finishing', dur: 65, exercises: 0, au: 360, resp: 'coach',
          gps: [{ l: 'TD', v: '4.6 km' }, { l: 'HSR', v: '280 m' }] },
        { type: 'str', name: 'Strength · lower body', dur: 38, exercises: 5, au: 286, resp: 'sc',
          goal: '85% 1RM · CMJ post-block',
          notes: 'Cluster sets on back squat.' }
      ]
    },
    {
      dow: 'Fri', dom: 30, mode: ['pitch'],
      blocks: [
        { type: 'warmup', name: 'Activation', dur: 14, exercises: 5, au: 24, resp: 'sc' },
        { type: 'skills', name: 'Team session · set pieces', dur: 55, exercises: 0, au: 280, resp: 'coach' },
        { type: 'cool', name: 'Cooldown', dur: 10, exercises: 2, au: 12, resp: 'physio' }
      ]
    },
    {
      dow: 'Sat', dom: 31, rest: true
    },
    {
      dow: 'Sun', dom: 1, mode: ['pitch'],
      blocks: [
        { type: 'warmup', name: 'Match warm-up', dur: 25, exercises: 5, au: 80, resp: 'sc' },
        { type: 'skills', name: 'Match · vs. River', dur: 95, exercises: 0, au: 720, resp: 'coach',
          gps: [{ l: 'TD', v: '10.4 km' }, { l: 'HSR', v: '720 m' }, { l: 'Sprints', v: '22' }] }
      ]
    }
  ];

  const TYPE_LABEL_EN = {
    warmup: 'Warm-up', myo: 'Myofascial', mob: 'Mobility', act: 'Activation',
    str: 'Strength', plyo: 'Plyometrics', skills: 'Skills', field: 'On-field',
    cond: 'Conditioning', cool: 'Cooldown', assess: 'Assessment'
  };
  const typeLabel = (t) => tt('individual_planner.type_' + t, TYPE_LABEL_EN[t] || t);
  const TYPE_COLOR = {
    warmup: '#10B981', myo: '#A78BFA', mob: '#06B6D4', act: '#22C55E',
    str: '#DC2626', plyo: '#F59E0B', skills: '#3B82F6', field: '#15803D',
    cond: '#EA580C', cool: '#64748B', assess: '#0EA5E9'
  };
  const RESP_LABEL_EN = { physio: 'Physio', sc: 'S&C', coach: 'Coach' };
  const respLabel = (r) => tt('individual_planner.resp_' + r, RESP_LABEL_EN[r] || r);
  const MODE_PILL = {
    pitch:  ['ti-soccer-field', 'is-pitch',  'Pitch'],
    gym:    ['ti-barbell',      'is-gym',    'Gym'],
    physio: ['ti-stethoscope',  'is-physio', 'Physio'],
    recov:  ['ti-droplet',      'is-recov',  'Recov']
  };
  const modeLabel = (m) => tt('individual_planner.mode_' + m, (MODE_PILL[m] && MODE_PILL[m][2]) || m);

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  function renderKanban() {
    const root = $('#kanban'); root.innerHTML = '';
    WEEK.forEach((day, di) => {
      const card = document.createElement('div');
      card.className = 'rp-day' + (day.rest ? ' is-rest' : '') + (day.today ? ' is-today' : '');
      const head = document.createElement('div');
      head.className = 'rp-day-h';
      head.innerHTML = `
        <div class="top">
          <span class="dow">${day.dow}${day.today ? ' · ' + tt('individual_planner.today_upper', 'TODAY') : ''}</span>
          <span class="dom">${day.dom}</span>
        </div>
        <div class="pillrow">${(day.mode || []).map(m => {
          const [icon, cls] = MODE_PILL[m];
          return `<span class="rp-mini-pill ${cls}"><i class="ti ${icon}"></i>${modeLabel(m)}</span>`;
        }).join('')}</div>`;
      card.appendChild(head);

      const body = document.createElement('div');
      body.className = 'rp-day-body';
      if (day.rest) {
        body.innerHTML = `<i class="ti ti-bed"></i><span>${tt('individual_planner.rest_day', 'Rest day')}</span><span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${tt('individual_planner.wellness_check_only', 'Wellness check only')}</span>`;
        card.appendChild(body);
        return root.appendChild(card);
      }
      let totalAu = 0, totalDur = 0;
      day.blocks.forEach((b, bi) => {
        totalAu += b.au || 0; totalDur += b.dur || 0;
        const block = document.createElement('div');
        block.className = 'rp-block t-' + b.type + (b.selected ? ' is-selected' : '');
        const gpsHtml = (b.gps && b.gps.length)
          ? `<div class="rp-block-gps">${b.gps.map(g => `<span class="rp-gps-pill"><span class="l">${g.l}</span><span class="v">${g.v}</span></span>`).join('')}</div>`
          : '';
        const goalHtml = b.goal
          ? `<div class="rp-block-goal"><i class="ti ti-target"></i>${b.goal}</div>` : '';
        block.innerHTML = `
          <div class="rp-block-stripe"></div>
          <div class="rp-block-h">
            <div class="rp-block-name">${b.name}</div>
            <div class="rp-block-time">${b.dur}'</div>
          </div>
          <div class="rp-block-meta">
            <span class="au">${b.au} ${tt('individual_planner.au', 'AU')}</span>
            <span class="sep">·</span>
            <span>${b.exercises || 0} ${tt('individual_planner.ex_short', 'ex')}</span>
            <span class="sep">·</span>
            <span class="resp ${b.resp}"><span class="dot"></span>${respLabel(b.resp)}</span>
          </div>
          ${gpsHtml}
          ${goalHtml}
        `;
        body.appendChild(block);
      });
      const add = document.createElement('button');
      add.className = 'rp-add-block';
      add.innerHTML = `<i class="ti ti-plus"></i> ${tt('individual_planner.add_block', 'Add block')}`;
      body.appendChild(add);
      card.appendChild(body);

      const foot = document.createElement('div');
      foot.className = 'rp-day-totals';
      foot.innerHTML = `<span><strong>${totalDur}'</strong> ${tt('individual_planner.total_short', 'total')}</span> <span><strong>${totalAu}</strong> ${tt('individual_planner.au', 'AU')}</span>`;
      card.appendChild(foot);
      root.appendChild(card);
    });
  }

  function renderTable() {
    const tbody = $('#tbody'); tbody.innerHTML = '';
    WEEK.forEach(day => {
      const dh = document.createElement('tr');
      dh.className = 'is-day-h';
      dh.innerHTML = `<td colspan="8">${day.dow}, ${day.dom === 1 ? 'Jun' : 'May'} ${day.dom}${day.today ? ' · ' + tt('individual_planner.today_upper', 'TODAY') : ''}</td>`;
      tbody.appendChild(dh);
      if (day.rest) {
        const r = document.createElement('tr');
        r.className = 'is-rest';
        r.innerHTML = `<td colspan="8">— ${tt('individual_planner.rest_wellness_only', 'Rest · wellness check only')}</td>`;
        tbody.appendChild(r); return;
      }
      day.blocks.forEach(b => {
        const r = document.createElement('tr');
        if (b.selected) r.style.background = 'var(--cm-bg-soft)';
        const gpsStr = (b.gps || []).map(g => `${g.l} ${g.v}`).join(' · ') || '—';
        r.innerHTML = `
          <td><span class="nm"><span class="swatch" style="background:${TYPE_COLOR[b.type]}"></span>${b.name}<span style="color:var(--cm-fg-muted);font-weight:400;margin-left:8px;font:500 10.5px/1 var(--cm-font-mono);letter-spacing:0.06em;text-transform:uppercase">${typeLabel(b.type)}</span></span></td>
          <td class="mono">${b.dur}'</td>
          <td><span style="display:inline-flex;align-items:center;gap:4px;font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg)"><span style="width:7px;height:7px;border-radius:50%;background:${b.resp==='physio'?'#B91C1C':b.resp==='sc'?'#1D4ED8':'#A16207'}"></span>${respLabel(b.resp)}</span></td>
          <td class="mono">${b.exercises || 0} ${tt('individual_planner.ex_short', 'ex')}</td>
          <td class="mono">${b.au < 50 ? tt('individual_planner.int_low', 'Low') : b.au < 200 ? tt('individual_planner.int_mod', 'Mod') : tt('individual_planner.int_high', 'High')}</td>
          <td class="mono" style="color:var(--cm-fg-muted)">${gpsStr}</td>
          <td class="mono" style="color:var(--cm-fg-strong);font-weight:600">${b.au}</td>
          <td style="color:var(--cm-fg-muted);font:var(--cm-body-sm)">${b.goal ? '<span style="color:#1D4ED8"><i class="ti ti-target"></i> ' + b.goal + '</span>' : (b.notes || '—')}</td>
        `;
        tbody.appendChild(r);
      });
    });
  }

  function renderTimeline() {
    const root = $('#tl-rows'); root.innerHTML = '';
    WEEK.forEach(day => {
      const row = document.createElement('div');
      row.className = 'rp-tl-row';
      const dayCol = document.createElement('div');
      dayCol.className = 'day';
      dayCol.innerHTML = `<span class="dow">${day.dow}</span> ${day.dom}<div class="since">${day.today ? tt('individual_planner.today_lower', 'today') : ''}</div>`;
      row.appendChild(dayCol);
      const track = document.createElement('div');
      track.className = 'rp-tl-track';
      if (day.rest) {
        track.innerHTML = `<span class="rp-tl-rest"><i class="ti ti-bed"></i> ${tt('individual_planner.rest_day', 'Rest day')}</span>`;
      } else {
        day.blocks.forEach(b => {
          const w = (b.dur / 120) * 100;
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

  function showView(view) {
    $$('#view-seg button').forEach(b => b.classList.toggle('is-on', b.dataset.view === view));
    $('#view-kanban').classList.toggle('rp-hidden', view !== 'kanban');
    $('#view-table').classList.toggle('rp-hidden', view !== 'table');
    $('#view-timeline').classList.toggle('rp-hidden', view !== 'timeline');
  }

  function renderAll() { renderKanban(); renderTable(); renderTimeline(); }

  document.addEventListener('cm:langchanged', renderAll);

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();

    $$('#view-seg button').forEach(b => {
      b.addEventListener('click', () => showView(b.dataset.view));
    });

    document.addEventListener('click', (e) => {
      const block = e.target.closest('.rp-block');
      if (!block) return;
      $$('.rp-block.is-selected').forEach(b => b.classList.remove('is-selected'));
      block.classList.add('is-selected');
    });

    window.__ipApi = {
      showView,
      setShowKpis: (on) => { document.querySelector('.ip-kpis').style.display = on ? '' : 'none'; },
      setShowTrainbar: (on) => { document.querySelector('.rp-trainbar').style.display = on ? '' : 'none'; },
      setShowSidePanel: (on) => {
        document.querySelector('.rp-side-panel').style.display = on ? '' : 'none';
        document.getElementById('workspace').classList.toggle('no-side', !on);
      },
      setDensity: (d) => { document.body.dataset.ipDensity = d; }
    };
  });
})();
