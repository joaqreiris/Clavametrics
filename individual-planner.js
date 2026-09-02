/* Individual S&C Planner — data + rendering.
   Reuses same DOM shape as rehab-planner.js for kanban/table/timeline. */

(function () {
  'use strict';

  function tt(key, fallbackEN, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
  }

  // ─── Module state: the plan currently loaded into the engine ───
  window.__ipData = window.__ipData || { plan: null, phases: [] };

  // ─── Real calendar week for the plan ───
  // The week grid comes from the plan's start_date (+ its current programme week),
  // never from wall-clock "now" and never from hardcoded sample dates.
  const ipLocale = () => (window.CM_I18N && window.CM_I18N.current) || 'en-GB';
  const ipYMD = (d) => (window.cmYMD ? window.cmYMD(d)
    : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  const ipToday = () => (window.cmToday ? window.cmToday() : ipYMD(new Date()));

  // 'YYYY-MM-DD' → local Date (never `new Date(str)`, which parses date-only as UTC).
  function ipParseYMD(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  // Monday of the week the plan's current programme week falls on.
  function ipWeekMonday() {
    const plan = window.__ipData && window.__ipData.plan;
    const base = ipParseYMD(plan && plan.start_date) || new Date();
    const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));        // back to Monday
    const wk = Math.max(1, Number(plan && plan.programme_week) || 1);
    mon.setDate(mon.getDate() + (wk - 1) * 7);                    // + programme-week offset
    return mon;
  }

  // 7 day headers { dow, dom, date, monthShort, today } for the plan's current week.
  function ipWeekDates() {
    const mon = ipWeekMonday(), today = ipToday(), loc = ipLocale();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      let dow, monthShort;
      try {
        dow = d.toLocaleDateString(loc, { weekday: 'short' });
        monthShort = d.toLocaleDateString(loc, { month: 'short' });
      } catch (_) {
        dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
        monthShort = String(d.getMonth() + 1);
      }
      const date = ipYMD(d);
      return { dow, dom: d.getDate(), date, monthShort, today: date === today };
    });
  }

  // Empty week scaffold (7 day cards, no blocks) — used when a plan has no content yet.
  const emptyWeek = () => ipWeekDates().map(d => ({
    dow: d.dow, dom: d.dom, date: d.date, monthShort: d.monthShort, today: d.today, mode: [], blocks: []
  }));

  // Resolve the day/blocks array the views render from: plan.content (array or {days:[…]})
  // falling back to the empty scaffold so an empty/new plan still renders a week grid.
  // Day headers are re-stamped from the real calendar week on every read, so content
  // saved earlier never shows stale day numbers or a stale TODAY marker.
  function weekData() {
    const c = window.__ipData && window.__ipData.plan ? window.__ipData.plan.content : null;
    const days = Array.isArray(c) ? c : (c && Array.isArray(c.days) ? c.days : null);
    if (!days || !days.length) return emptyWeek();
    const dates = ipWeekDates();
    return days.map((d, i) => {
      const dt = dates[i];
      return dt ? Object.assign({}, d, {
        dow: dt.dow, dom: dt.dom, date: dt.date, monthShort: dt.monthShort, today: dt.today
      }) : d;
    });
  }

  // Materialize plan.content.days from the scaffold on first edit, so mutations persist.
  function ensureDays() {
    const plan = window.__ipData && window.__ipData.plan;
    if (!plan) return null;
    let c = plan.content;
    if (!c || typeof c !== 'object') c = {};
    if (Array.isArray(c)) c = { days: c };
    if (!Array.isArray(c.days) || !c.days.length) c.days = emptyWeek();
    plan.content = c;
    return c.days;
  }

  // ─── Edit/persistence plumbing ───
  let _contentChangeCbs = [];
  let _editingRef = null;   // { di, bi } while editing an existing block via block-drawer
  let _selectedRef = null;  // { di, bi } currently selected block (drives the side panel)
  let _kpiScope = 'week';   // 'week' | 'programme' for the internal-load KPIs
  function _fireContentChange() {
    _contentChangeCbs.forEach(cb => { try { cb(); } catch (e) { console.error('[individual-sc] onContentChange cb', e); } });
  }

  // block-drawer save payload → stored block (renderer shape; exList keeps full exercises for round-trip)
  function payloadToBlock(p) {
    return {
      type: p.type,
      name: p.name,
      dur: p.duration || 0,
      au: p.au || 0,
      resp: p.owner || 'sc',
      respId: p.owner_id || undefined,        // staff member in charge (profiles.id)
      respName: p.owner_name || undefined,
      rpe: p.rpe,
      exercises: (p.exercises || []).length,
      exList: p.exercises || [],
      goal: p.ctxField || undefined,
      notes: p.notes || undefined
    };
  }
  // stored block → block-drawer `existing` (free-text round-trip of the exercise list)
  function blockToExisting(b, dayLabel, di) {
    return {
      type: b.type, name: b.name, duration: b.dur, rpe: b.rpe, owner: b.resp,
      ownerId: b.respId || null, ownerName: b.respName || '',
      notes: b.notes || '', ctxField: b.goal || '',
      exercises: b.exList || [],
      day: dayLabel, dayDate: String(di)
    };
  }

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
    weekData().forEach((day, di) => {
      const card = document.createElement('div');
      card.className = 'rp-day' + (day.rest ? ' is-rest' : '') + (day.today ? ' is-today' : '');
      card.dataset.date = String(di);   // block-drawer reads dataset.date → routes new blocks to this day
      card.dataset.di = String(di);     // numeric day index for block-actions getDayIndex
      const head = document.createElement('div');
      head.className = 'rp-day-h';
      head.innerHTML = `
        <div class="top">
          <span class="dow">${esc(day.dow)}${day.today ? ' · ' + tt('individual_planner.today_upper', 'TODAY') : ''}</span>
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
        block.dataset.di = String(di); block.dataset.bi = String(bi);
        block.draggable = true;   // render-proof drag (block-actions)
        const gpsHtml = (b.gps && b.gps.length)
          ? `<div class="rp-block-gps">${b.gps.map(g => `<span class="rp-gps-pill"><span class="l">${esc(g.l)}</span><span class="v">${esc(g.v)}</span></span>`).join('')}</div>`
          : '';
        const goalHtml = b.goal
          ? `<div class="rp-block-goal"><i class="ti ti-target"></i>${esc(b.goal)}</div>` : '';
        block.innerHTML = `
          <div class="rp-block-stripe"></div>
          <div class="rp-block-h">
            <div class="rp-block-name">${esc(b.name)}</div>
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
    weekData().forEach(day => {
      const dh = document.createElement('tr');
      dh.className = 'is-day-h';
      dh.innerHTML = `<td colspan="8">${esc(day.dow)}, ${esc(day.monthShort || '')} ${day.dom}${day.today ? ' · ' + tt('individual_planner.today_upper', 'TODAY') : ''}</td>`;
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
        const gpsStr = (b.gps || []).map(g => `${esc(g.l)} ${esc(g.v)}`).join(' · ') || '—';
        r.innerHTML = `
          <td><span class="nm"><span class="swatch" style="background:${TYPE_COLOR[b.type]}"></span>${esc(b.name)}<span style="color:var(--cm-fg-muted);font-weight:400;margin-left:8px;font:500 10.5px/1 var(--cm-font-mono);letter-spacing:0.06em;text-transform:uppercase">${typeLabel(b.type)}</span></span></td>
          <td class="mono">${b.dur}'</td>
          <td><span style="display:inline-flex;align-items:center;gap:4px;font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg)"><span style="width:7px;height:7px;border-radius:50%;background:${b.resp==='physio'?'#B91C1C':b.resp==='sc'?'#1D4ED8':'#A16207'}"></span>${respLabel(b.resp)}</span></td>
          <td class="mono">${b.exercises || 0} ${tt('individual_planner.ex_short', 'ex')}</td>
          <td class="mono">${b.au < 50 ? tt('individual_planner.int_low', 'Low') : b.au < 200 ? tt('individual_planner.int_mod', 'Mod') : tt('individual_planner.int_high', 'High')}</td>
          <td class="mono" style="color:var(--cm-fg-muted)">${gpsStr}</td>
          <td class="mono" style="color:var(--cm-fg-strong);font-weight:600">${b.au}</td>
          <td style="color:var(--cm-fg-muted);font:var(--cm-body-sm)">${b.goal ? '<span style="color:#1D4ED8"><i class="ti ti-target"></i> ' + esc(b.goal) + '</span>' : esc(b.notes || '—')}</td>
        `;
        tbody.appendChild(r);
      });
    });
  }

  function renderTimeline() {
    const root = $('#tl-rows'); root.innerHTML = '';
    weekData().forEach(day => {
      const row = document.createElement('div');
      row.className = 'rp-tl-row';
      const dayCol = document.createElement('div');
      dayCol.className = 'day';
      dayCol.innerHTML = `<span class="dow">${esc(day.dow)}</span> ${day.dom}<div class="since">${day.today ? tt('individual_planner.today_lower', 'today') : ''}</div>`;
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
          block.innerHTML = `${esc(b.name.length > 22 ? b.name.slice(0, 21) + '…' : b.name)} <span class="du">${b.dur}'</span>`;
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

  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // Repaint the programme phase bar from __ipData.phases (mirror of rehab's trainbar).
  function renderPhasebar() {
    const track = $('.rp-trainbar .rp-train-track');
    if (!track) return;
    const phases = (window.__ipData && window.__ipData.phases) || [];
    const plan = window.__ipData && window.__ipData.plan;
    // Summary line
    const summary = $('.rp-trainbar-h .summary');
    if (summary) {
      const total = (plan && plan.programme_total_weeks) || 1;
      const cur = (plan && plan.programme_week) || 1;
      const goal = plan && plan.goal ? plan.goal : (plan && plan.focus ? plan.focus : '');
      let html = tt('individual_planner.programme_summary_dyn', `<strong>${total}</strong>-week programme · Week <strong>${cur}</strong> of ${total}`, { total, cur });
      if (goal) html += ' · ' + tt('individual_planner.goal_label', 'goal') + ': <strong>' + esc(goal) + '</strong>';
      summary.innerHTML = html;
    }
    if (!phases.length) {
      track.style.gridTemplateColumns = '1fr';
      track.innerHTML = `<div class="rp-train-seg"><span class="dot"></span><span>${tt('individual_planner.no_phases_yet', 'No phases yet — use "Edit phases" to add them.')}</span></div>`;
      return;
    }
    const cur = Number(plan && plan.programme_week) || 0;
    const spans = phases.map(p => Math.max(1, (Number(p.week_end) || 1) - (Number(p.week_start) || 1) + 1));
    track.style.gridTemplateColumns = spans.map(s => s + 'fr').join(' ');
    track.innerHTML = phases.map(p => {
      const ws = Number(p.week_start) || 1, we = Number(p.week_end) || ws;
      const status = (we < cur) ? 'is-done' : (cur >= ws && cur <= we) ? 'is-current' : '';
      const wk = ws === we ? `W${ws}` : `W${ws}–${we}`;
      const nowTag = status === 'is-current' ? ' · ' + tt('individual_planner.now_tag', 'NOW') : '';
      const dotSty = p.color ? ` style="background:${esc(p.color)}"` : '';
      const tip = p.objective ? ` title="${esc(p.objective)}"` : '';
      return `<div class="rp-train-seg ${status}"${tip}><span class="dot"${dotSty}></span>${esc(p.name)}<span class="wk">${wk}${nowTag}</span></div>`;
    }).join('');
  }

  // Week pager label ← real programme week + the calendar dates it covers.
  function updatePager() {
    const plan = window.__ipData && window.__ipData.plan;
    const wk = (plan && plan.programme_week) || 1;
    const el = document.getElementById('ip-pager-week');
    if (!el) return;
    let label = tt('individual_planner.week_n', 'Week ' + wk, { n: wk });
    const days = ipWeekDates();
    const a = days[0], b = days[6];
    if (a && b) label += ` · ${a.dom} ${a.monthShort} – ${b.dom} ${b.monthShort}`;
    el.textContent = label;
  }

  // Block-detail side panel ← the selected real block, or an empty state.
  function renderBlockPanel(block, di) {
    const root = document.getElementById('ip-block-detail');
    if (!root) return;
    if (!block) {
      const msg = (window.__ipData && window.__ipData.plan)
        ? tt('individual_planner.select_block', 'Select a block to see its details')
        : tt('individual_planner.no_blocks_yet', 'No blocks yet');
      root.innerHTML = `<div style="padding:22px 14px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${msg}</div>`;
      return;
    }
    const day = weekData()[di] || {};
    const color = TYPE_COLOR[block.type] || '#64748B';
    const exs = Array.isArray(block.exList) ? block.exList : [];
    const sub = [];
    if (day.dow) sub.push(esc(day.dow));
    sub.push(esc(typeLabel(block.type)));
    if (block.dur) sub.push(block.dur + ' ' + tt('individual_planner.min_short', 'min'));
    if (block.resp) sub.push(esc(respLabel(block.resp) + (block.respName ? ' · ' + block.respName : '')));
    const metrics = `<div class="rp-bd-metrics">
      <div class="rp-bd-metric"><div class="l">${tt('individual_planner.duration', 'Duration')}</div><div class="v">${block.dur || 0}<sub>${tt('individual_planner.min_short', 'min')}</sub></div></div>
      <div class="rp-bd-metric"><div class="l">${tt('individual_planner.rpe_target', 'RPE target')}</div><div class="v">${block.rpe != null ? block.rpe : '—'}<sub>/10</sub></div></div>
      <div class="rp-bd-metric"><div class="l">${tt('individual_planner.au', 'AU')}</div><div class="v">${block.au || 0}</div></div>
    </div>`;
    const exHtml = exs.length ? exs.map((ex, i) => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      // One line per set: only the fields the coach actually filled in.
      const params = sets.map(s => {
        const bits = [];
        const add = (k, label) => { if (s[k]) bits.push(`<span class="p"><span class="l">${label}</span>${esc(s[k])}</span>`); };
        add('reps',  tt('individual_planner.param_reps',  'reps'));
        add('time',  tt('individual_planner.param_time',  'time'));
        add('load',  tt('individual_planner.param_load',  'load'));
        add('tempo', tt('individual_planner.param_tempo', 'tempo'));
        add('rest',  tt('individual_planner.param_rest',  'rest'));
        if (s.note) bits.push(`<span class="p" style="color:var(--cm-fg-muted)">${esc(s.note)}</span>`);
        return bits.join('');
      }).join('');
      const extra = [ex.side, ex.flag].filter(Boolean).map(esc).join(' · ');
      return `<div class="rp-bd-ex"><div class="n">${i + 1}</div><div class="body"><div class="name">${esc(ex.name || '—')}</div><div class="params">${params}${extra ? `<span class="p">${extra}</span>` : ''}</div></div></div>`;
    }).join('') : `<div style="color:var(--cm-fg-muted);font:var(--cm-body-sm);padding:4px 0">${tt('individual_planner.no_exercises', 'No exercises')}</div>`;
    const goal = block.goal ? `<div class="rp-bd-section"><div class="rp-bd-section-h">${tt('individual_planner.targets', 'Targets')}</div><div style="font:var(--cm-body-sm);color:#1D4ED8"><i class="ti ti-target"></i> ${esc(block.goal)}</div></div>` : '';
    const notes = block.notes ? `<div class="rp-bd-section"><div class="rp-bd-section-h">${tt('individual_planner.notes', 'Notes')}</div><div style="font:var(--cm-body-sm);color:var(--cm-fg-muted);line-height:1.45">${esc(block.notes)}</div></div>` : '';
    root.innerHTML = `
      <div class="rp-bd-title"><span class="swatch" style="background:${color}"></span>${esc(block.name || '—')}</div>
      <div class="rp-bd-sub">${sub.join('<span class="sep">·</span>')}</div>
      ${metrics}
      <div class="rp-bd-section"><div class="rp-bd-section-h">${tt('individual_planner.exercises_n', 'Exercises · ' + exs.length, { n: exs.length })}</div>${exHtml}</div>
      ${goal}${notes}`;
  }

  function renderBlockPanelFromSel() {
    if (!_selectedRef) return renderBlockPanel(null);
    const days = weekData();
    const b = (days[_selectedRef.di] && Array.isArray(days[_selectedRef.di].blocks)) ? days[_selectedRef.di].blocks[_selectedRef.bi] : null;
    if (!b) { _selectedRef = null; return renderBlockPanel(null); }
    renderBlockPanel(b, _selectedRef.di);
  }

  // ─── Internal-load KPIs (computed from real plan blocks) ───
  const KPI_COLOR = { str:'#1E40AF', pow:'#7C3AED', cond:'#B45309', speed:'#0E7490', mob:'#15803D', prev:'#B91C1C' };
  const KPI_LABEL_EN = { str:'Strength', pow:'Power', cond:'Conditioning', speed:'Speed', mob:'Mobility', prev:'Prevention', other:'Other' };
  const focusColor = (b) => KPI_COLOR[b] || '#6B7280';
  const focusLabel = (b) => tt('individual_planner.type_' + b, KPI_LABEL_EN[b] || b);

  // All days across the plan content (programme scope); [] when empty (no scaffold fallback).
  function programmeDays() {
    const c = window.__ipData && window.__ipData.plan ? window.__ipData.plan.content : null;
    const days = Array.isArray(c) ? c : (c && Array.isArray(c.days) ? c.days : null);
    return days || [];
  }

  // Pure: sum sessions (block count), AU (Σ block.au, fallback dur*rpe) and AU by block type.
  function ipComputeLoad(days) {
    let sessions = 0, au = 0; const byType = {};
    (days || []).forEach(d => {
      const blocks = (d && Array.isArray(d.blocks)) ? d.blocks : [];
      blocks.forEach(b => {
        sessions++;
        const a = (b.au != null) ? Number(b.au) || 0 : Math.round((Number(b.dur) || 0) * (Number(b.rpe) || 0));
        au += a;
        const t = b.type || 'other';
        byType[t] = (byType[t] || 0) + a;
      });
    });
    return { sessions, au, byType };
  }

  function renderKpis() {
    const days = _kpiScope === 'programme' ? programmeDays() : weekData();
    const { sessions, au, byType } = ipComputeLoad(days);
    const sEl = document.getElementById('ip-kpi-sessions');
    const lEl = document.getElementById('ip-kpi-load');
    const bar = document.getElementById('ip-focus-bar');
    const leg = document.getElementById('ip-focus-legend');
    if (sEl) sEl.textContent = sessions > 0 ? String(sessions) : '—';
    if (lEl) lEl.innerHTML = au > 0 ? (au.toLocaleString() + `<sub>${tt('individual_planner.au', 'AU')}</sub>`) : '—';

    // Bucket AU into the 6 known focus types + "other".
    const buckets = {};
    Object.keys(byType).forEach(t => { const b = KPI_COLOR[t] ? t : 'other'; buckets[b] = (buckets[b] || 0) + byType[t]; });
    const entries = Object.entries(buckets).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    if (bar) {
      bar.innerHTML = total > 0 ? entries.map(([b, v]) => `<span class="seg" title="${esc(focusLabel(b))}" style="width:${(v / total * 100).toFixed(1)}%;background:${focusColor(b)}"></span>`).join('') : '';
      bar.classList.toggle('is-empty', total <= 0);
    }
    if (leg) {
      leg.innerHTML = total > 0
        ? entries.map(([b, v]) => `<span class="it"><span class="sw" style="background:${focusColor(b)}"></span>${esc(focusLabel(b))} <span class="pct">${Math.round(v / total * 100)}%</span></span>`).join('')
        : `<span class="it">—</span>`;
    }
  }

  function renderAll() { renderKanban(); renderTable(); renderTimeline(); renderPhasebar(); updatePager(); renderBlockPanelFromSel(); renderKpis(); }

  // ─── Route block-drawer saves into __ipData.plan.content (create/edit) ───
  window.addEventListener('blockdrawer:save', (e) => {
    if (!(window.__ipData && window.__ipData.plan)) return;   // only when a plan is loaded in this engine
    const p = e.detail || {};
    const days = ensureDays();
    if (!days) return;
    const block = payloadToBlock(p);
    if (p.mode === 'edit') {
      if (!_editingRef) return;                                // e.g. demo side-panel button — ignore
      const { di, bi } = _editingRef;
      if (days[di] && Array.isArray(days[di].blocks) && days[di].blocks[bi] != null) days[di].blocks[bi] = block;
      _editingRef = null;
    } else {
      const di = parseInt(p.dayDate, 10);
      _editingRef = null;
      if (isNaN(di) || !days[di]) return;
      if (!Array.isArray(days[di].blocks)) days[di].blocks = [];
      days[di].blocks.push(block);
    }
    renderAll();
    _fireContentChange();
  });
  window.addEventListener('blockdrawer:delete', () => {
    if (!(window.__ipData && window.__ipData.plan) || !_editingRef) return;
    const days = ensureDays();
    const { di, bi } = _editingRef;
    _editingRef = null;
    if (days && days[di] && Array.isArray(days[di].blocks)) days[di].blocks.splice(bi, 1);
    renderAll();
    _fireContentChange();
  });
  // A fresh "Add block" click is always a create — clear any stale edit ref.
  document.addEventListener('click', (e) => { if (e.target.closest('.rp-add-block')) _editingRef = null; });

  document.addEventListener('cm:langchanged', renderAll);

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();

    $$('#view-seg button').forEach(b => {
      b.addEventListener('click', () => showView(b.dataset.view));
    });

    // Week ⇄ Programme scope toggle for the internal-load KPIs
    $$('#ip-kpi-scope button').forEach(b => {
      b.addEventListener('click', () => {
        _kpiScope = b.dataset.scope === 'programme' ? 'programme' : 'week';
        $$('#ip-kpi-scope button').forEach(x => x.classList.toggle('is-on', x.dataset.scope === _kpiScope));
        renderKpis();
      });
    });

    document.addEventListener('click', (e) => {
      const blockEl = e.target.closest('.rp-block');
      if (!blockEl) return;
      $$('.rp-block.is-selected').forEach(b => b.classList.remove('is-selected'));
      blockEl.classList.add('is-selected');
      // Open the block drawer in edit mode for this block
      const di = parseInt(blockEl.dataset.di, 10), bi = parseInt(blockEl.dataset.bi, 10);
      if (isNaN(di) || isNaN(bi) || !window.openBlockDrawer) return;
      const days = weekData();
      const b = days[di] && Array.isArray(days[di].blocks) ? days[di].blocks[bi] : null;
      if (!b) return;
      _selectedRef = { di, bi };
      renderBlockPanelFromSel();
      _editingRef = { di, bi };
      window.openBlockDrawer({ context: 'ip', existing: blockToExisting(b, days[di].dow || '', di) });
    });

    window.__ipApi = {
      showView,
      loadPlan: (plan, phases) => {
        window.__ipData = { plan: plan || null, phases: phases || [] };
        _editingRef = null;
        _selectedRef = null;
        renderAll();
      },
      setPhases: (phases) => {
        if (window.__ipData) window.__ipData.phases = phases || [];
        renderPhasebar();
      },
      getContent: () => (window.__ipData && window.__ipData.plan ? window.__ipData.plan.content : null),
      getPlan: () => (window.__ipData ? window.__ipData.plan : null),
      onContentChange: (cb) => { if (typeof cb === 'function') _contentChangeCbs.push(cb); },
      setShowKpis: (on) => { const el = document.querySelector('.ip-loadkpis'); if (el) el.style.display = on ? '' : 'none'; },
      setShowTrainbar: (on) => { document.querySelector('.rp-trainbar').style.display = on ? '' : 'none'; },
      setShowSidePanel: (on) => {
        document.querySelector('.rp-side-panel').style.display = on ? '' : 'none';
        document.getElementById('workspace').classList.toggle('no-side', !on);
      },
      setDensity: (d) => { document.body.dataset.ipDensity = d; }
    };

    // ─── Shared block copy/paste/duplicate/drag (block-actions.js) ───
    if (window.BlockActions) {
      window.BlockActions.install({
        root: document.getElementById('kanban'),
        blockSelector: '.rp-block',
        daySelector: '.rp-day',
        getIds: (el) => {
          const d = parseInt(el.dataset.di, 10), b = parseInt(el.dataset.bi, 10);
          return (isNaN(d) || isNaN(b)) ? null : { day: d, block: b };
        },
        getDayIndex: (el) => { const d = parseInt(el.dataset.di, 10); return isNaN(d) ? null : d; },
        getBlock: (day, block) => {
          const days = ensureDays();
          const b = (days && days[day] && Array.isArray(days[day].blocks)) ? days[day].blocks[block] : null;
          return b ? JSON.parse(JSON.stringify(b)) : null;
        },
        insertBlock: (day, data) => {
          const days = ensureDays();
          if (!days || !days[day] || !data) return;
          if (!Array.isArray(days[day].blocks)) days[day].blocks = [];
          days[day].blocks.push(data);
          renderAll();
        },
        moveBlock: (from, fromBlock, to) => {
          const days = ensureDays();
          if (!days || !days[from] || !days[to] || !Array.isArray(days[from].blocks)) return;
          const [b] = days[from].blocks.splice(fromBlock, 1);
          if (!b) return;
          if (!Array.isArray(days[to].blocks)) days[to].blocks = [];
          days[to].blocks.push(b);
          renderAll();
        },
        onChange: () => _fireContentChange()
      });
    }
  });
})();
