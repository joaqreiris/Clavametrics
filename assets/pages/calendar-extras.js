/* ─────────────────────────────────────────────────────────────────────────
   calendar-extras.js — segunda mitad de la página Calendar.

   Estaba escrito dentro de Calendar.html. Entre este archivo y su pareja eran
   296 KB de los 426 KB de la página, y viajaban enteros en cada visita porque
   el HTML no se cachea. En un archivo aparte el navegador los guarda.

   Va con defer. Comprobado antes de moverlo: los 28 elementos que engancha sin
   protección están todos por encima de donde estaba escrito, y el único
   elemento nuevo que vería el querySelectorAll de .cm-btn.is-primary es el
   botón "Save settings", que no pasa su filtro (exige la palabra "event").
   ──────────────────────────────────────────────────────────────────────── */
// ── Competition helpers ───────────────────────────────────────
function compClass(raw) {
  const c = (raw || '').toLowerCase();
  if (/copa|cup/i.test(c))            return 'copa';
  if (/inter|champion|world|mundial/i.test(c)) return 'inter';
  if (/amistoso|friendly/i.test(c))   return 'amistoso';
  return 'liga';
}
function compIcon(cls) {
  if (cls === 'copa')     return 'ti-trophy';
  if (cls === 'inter')    return 'ti-world';
  if (cls === 'amistoso') return 'ti-handshake';
  return 'ti-ball-football';
}
function compLabel(cls) {
  if (cls === 'copa')     return tt('calendar.comp_label_copa','Copa');
  if (cls === 'inter')    return tt('calendar.comp_label_inter','Internacional');
  if (cls === 'amistoso') return tt('calendar.comp_label_amistoso','Amistoso');
  return tt('calendar.comp_label_liga','Liga');
}

// ── Season Ribbon ─────────────────────────────────────────────
// Resolve a microcycle's match from calendar_events (via _matchSessions),
// to replace reads of mc.match_date/rival/etc.
function mcMatch(mc) {
  if (!mc) return null;
  const inRange = (_matchSessions || []).filter(
    s => s.session_date >= mc.start_date && s.session_date <= mc.end_date);
  if (!inRange.length) return null;
  inRange.sort((a, b) => a.session_date > b.session_date ? 1 : -1);
  return inRange[inRange.length - 1]; // el último del MC = el partido "target"
}
function mcMatchDate(mc) { return mcMatch(mc)?.session_date || null; }

// Load the active season + its competitions and phases (from Annual Planner model)
async function loadCalCompetitions() {
  _calComps = []; _calSeasonId = null; _calSeason = null; _calPlanModel = 'tactical'; _calPhases = [];
  if (!_clubId || !_activeTeamId) return;
  const { data: seasons } = await window.sb
    .from('seasons').select('*')
    .eq('club_id', _clubId).eq('team_id', _activeTeamId)
    .neq('status', 'archived')
    .order('start_date', { ascending: false });
  if (!seasons || !seasons.length) return;
  const current = seasons.find(s => s.start_date <= TODAY && s.end_date >= TODAY);
  _calSeason = current || seasons[0];
  _calSeasonId = _calSeason.id;
  _calPlanModel = _calSeason.planning_model || 'tactical';
  const [{ data: comps }, { data: phases }] = await Promise.all([
    window.sb.from('competitions').select('id,name,comp_type,color')
      .eq('season_id', _calSeasonId).order('created_at'),
    window.sb.from('season_phases').select('id,name,color,start_date,end_date,counts_availability,is_overlay')
      .eq('season_id', _calSeasonId).order('start_date')
  ]);
  _calComps  = comps || [];
  _calPhases = (phases || []).filter(p => p.start_date && p.end_date);
}

// Refetch match events + re-render ribbon/KPIs/upcoming (after event CRUD)
async function refreshRibbonMatches() {
  const { data: ms } = await window.sb.from('calendar_events')
    .select('id,title,date,opponent,home_away,competition,rival_crest_url,start_time,location')
    .eq('club_id', _clubId).eq('team_id', _activeTeamId)
    .eq('type', 'match').order('date');
  _matchSessions = (ms || []).map(s => ({
    ...s,
    source: 'event', session_type: 'match',
    session_date: (s.date || '').split('T')[0],
    title: s.title || (s.opponent ? `vs ${s.opponent}` : tt('calendar.match_word','Match'))
  }));
  renderSeasonRibbon(_allMCs, _matchSessions);
  renderCalKPIs(_allMCs);
  renderUpcoming();
}

function renderSeasonRibbon(mcs, extraMatches) {
  extraMatches = extraMatches || _matchSessions;
  if (!mcs.length) return;
  document.getElementById('calRibbonV2').hidden = false;
  renderSeasonRibbonV2(mcs, extraMatches);
}

// ── Season ribbon V2 (px-per-day engine, behind RIBBON_V2) ─────
// Reuses the v1 range/marker logic; only the geometry differs (px-per-day
// instead of percentages). Toggled by the RIBBON_V2 guard in renderSeasonRibbon.
function renderSeasonRibbonV2(mcs, extraMatches) {
  extraMatches = extraMatches || _matchSessions;
  if (!mcs.length) return;

  const ordered = mcs.slice().sort((a, b) => a.start_date > b.start_date ? 1 : -1);
  const firstMcStart = new Date(ordered[0].start_date + 'T00:00:00');
  const lastMcEnd    = new Date(ordered[ordered.length - 1].end_date + 'T00:00:00');

  // Same range resolution as renderSeasonRibbon
  let ribbonStart = _ribbonViewRange?.from
    ? new Date(_ribbonViewRange.from + 'T00:00:00')
    : _calSeason?.start_date
      ? new Date(_calSeason.start_date + 'T00:00:00')
      : firstMcStart;
  let ribbonEnd = _ribbonViewRange?.to
    ? new Date(_ribbonViewRange.to + 'T00:00:00')
    : _calSeason?.end_date
      ? new Date(_calSeason.end_date + 'T00:00:00')
      : new Date(lastMcEnd.getFullYear(), lastMcEnd.getMonth() + 1, 0);
  // Never crop before the real content (active season end can precede the last MC / today)
  if (!_ribbonViewRange) {
    const todayDate = new Date(TODAY + 'T00:00:00');
    if (lastMcEnd > ribbonEnd)      ribbonEnd   = lastMcEnd;
    if (todayDate > ribbonEnd)      ribbonEnd   = todayDate;
    if (firstMcStart < ribbonStart) ribbonStart = firstMcStart;
  }
  if (ribbonEnd - ribbonStart <= 0) return;

  // Expose range for the px-engine controls IIFE
  _ribbonV2Meta = { ribbonStart, ribbonEnd };

  // Reset button visibility (same behaviour as v1)
  const resetBtn = document.getElementById('calRibbonReset');
  if (resetBtn) resetBtn.style.display = _ribbonViewRange ? '' : 'none';

  // ── px-per-day geometry ──
  const ppd = RIBBON_ZOOM[_ribbonZoomIdx];
  document.documentElement.style.setProperty('--cm-px-day', ppd + 'px');
  // accepts a 'YYYY-MM-DD' string or a Date (ribbonEnd is a Date)
  const dayOffset = d => Math.round(((d instanceof Date ? d : new Date(d + 'T00:00:00')) - ribbonStart) / 86400000);
  const totalDays = dayOffset(ribbonEnd) + 1;

  const track = document.getElementById('calV2Track');
  if (track) track.style.width = (totalDays * ppd + RIBBON_GUTTER * 2) + 'px';

  const fmtDay = ds => {
    const d = new Date(ds + 'T00:00:00');
    return String(d.getDate()).padStart(2, '0') + ' ' + monthShort(d);
  };
  const chipGeom = mc => {
    const left = dayOffset(mc.start_date) * ppd;
    const lenDays = dayOffset(mc.end_date) - dayOffset(mc.start_date) + 1;
    return { left, width: Math.max(30, lenDays * ppd - RIBBON_GAP) };
  };

  // ── Months (sticky) ──
  const monthsEl = document.getElementById('calV2Months');
  if (monthsEl) {
    monthsEl.innerHTML = '';
    const TICK_DAYS = [5, 10, 15, 20, 25];
    let cur = new Date(ribbonStart.getFullYear(), ribbonStart.getMonth(), 1);
    while (cur <= ribbonEnd) {
      const mo = new Date(cur);
      const daysInMonth = new Date(mo.getFullYear(), mo.getMonth() + 1, 0).getDate();
      const cell = document.createElement('div');
      cell.className = 'month';
      cell.style.left = (dayOffset(mo) * ppd) + 'px';
      cell.style.width = (daysInMonth * ppd) + 'px';
      cell.style.cursor = 'pointer';
      const yr = String(mo.getFullYear()).slice(2);
      const ticks = TICK_DAYS
        .filter(day => day <= daysInMonth)
        .map(day => `<span class="tick" style="left:${(day - 1) * ppd}px"><span class="tick__n">${day}</span></span>`)
        .join('');
      cell.innerHTML =
        `<span class="month__label">${monthShort(mo)} '${yr}</span>` +
        `<span class="month__ticks">${ticks}</span>`;
      cell.addEventListener('click', () => {
        _monthY = mo.getFullYear(); _monthM = mo.getMonth();
        document.querySelectorAll('.cal-segs .cal-seg').forEach(s => s.classList.toggle('is-on', s.dataset.view === 'month'));
        switchView('month');
      });
      monthsEl.appendChild(cell);
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  // ── Phase rail (etapas de la temporada) ──
  // Riel fino sobre el eje de meses + un corte vertical en cada frontera.
  // Sin fases cargadas la fila mide 0 y el ribbon queda exactamente como antes.
  const phasesEl = document.getElementById('calV2Phases');
  const linesEl  = document.getElementById('calV2PhaseLines');
  if (phasesEl && linesEl) {
    const ymd = d => window.cmYMD ? window.cmYMD(d)
      : (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    const rbFrom = ymd(ribbonStart), rbTo = ymd(ribbonEnd);
    // Solo las fases que asoman en el rango visible, recortadas a él
    const visible = (_calPhases || [])
      .filter(p => p.end_date >= rbFrom && p.start_date <= rbTo)
      .sort((a, b) => a.start_date > b.start_date ? 1 : -1)
      .map(p => ({ ...p, _from: p.start_date < rbFrom ? rbFrom : p.start_date,
                          _to:   p.end_date   > rbTo   ? rbTo   : p.end_date }))
      // Las superpuestas (parón FIFA) al final: se pintan sobre su fase anfitriona
      .sort((a, b) => (a.is_overlay ? 1 : 0) - (b.is_overlay ? 1 : 0));

    phasesEl.innerHTML = '';
    linesEl.innerHTML  = '';
    if (track) track.classList.toggle('has-phases', visible.length > 0);

    const bounds = new Set();
    visible.forEach(p => {
      const off  = dayOffset(p._from);
      const days = dayOffset(p._to) - off + 1;
      const isNow   = p.start_date <= TODAY && p.end_date >= TODAY;
      const isFocus = _ribbonViewRange
        && _ribbonViewRange.from === p.start_date && _ribbonViewRange.to === p.end_date;
      const counts  = p.counts_availability !== false;
      const overlay = !!p.is_overlay;

      const seg = document.createElement('div');
      seg.className = 'phase-seg'
        + (overlay ? ' phase-seg--overlay' : (counts ? '' : ' phase-seg--off'))
        + (isNow && !overlay ? ' phase-seg--now' : '')
        + (isFocus ? ' phase-seg--focus' : '');
      seg.style.setProperty('--ph', p.color || 'var(--cm-border-strong)');
      seg.style.left  = (off * ppd) + 'px';
      seg.style.width = Math.max(6, days * ppd - 2) + 'px';
      seg.title = `${p.name} · ${_fmtDateStr(p.start_date)} → ${_fmtDateStr(p.end_date)}`
        + (counts ? '' : ' · ' + tt('calendar.phase_not_counted','Doesn\'t count for availability'))
        + '\n' + (isFocus
            ? tt('calendar.phase_click_out','Click to see the whole season again')
            : tt('calendar.phase_click_in','Click to zoom the ribbon into this phase'));
      // El nombre sólo cuando hay lugar para leerlo; si no, queda el tooltip
      const room = days * ppd;
      if (overlay && room >= 26) {
        const ic = document.createElement('i');
        ic.className = 'ti ti-world phase-seg__icon';
        seg.appendChild(ic);
      }
      if (room >= (overlay ? 74 : 56)) {
        const nm = document.createElement('span');
        nm.className = 'phase-seg__name';
        nm.textContent = p.name;
        seg.appendChild(nm);
      }
      seg.addEventListener('click', () => {
        _ribbonViewRange = isFocus ? null : { from: p.start_date, to: p.end_date };
        renderSeasonRibbon(_allMCs, _matchSessions);
        const vp = document.getElementById('calRibbonV2');
        if (!vp) return;
        if (_ribbonViewRange) { vp.scrollLeft = 0; }
        else if (_ribbonV2Meta) {
          // Al volver a la temporada completa, recentrar en hoy
          const p2 = RIBBON_ZOOM[_ribbonZoomIdx];
          requestAnimationFrame(() => {
            const t = (Math.round((new Date(TODAY + 'T00:00:00') - _ribbonV2Meta.ribbonStart) / 86400000)) * p2
                      + RIBBON_GUTTER - vp.clientWidth / 2;
            vp.scrollTo({ left: Math.max(0, t), behavior: 'smooth' });
          });
        }
      });
      phasesEl.appendChild(seg);

      // Fronteras: inicio de cada fase y, si la siguiente no encadena, su fin.
      // Una superpuesta marca sus dos bordes (interrumpe, no separa etapas).
      const nextDay = new Date(new Date(p._to + 'T00:00:00').getTime() + 86400000);
      bounds.add(JSON.stringify([off, p.color, overlay]));
      if (nextDay <= ribbonEnd && (overlay || !visible.some(q => !q.is_overlay && q._from === ymd(nextDay)))) {
        bounds.add(JSON.stringify([dayOffset(nextDay), p.color, overlay]));
      }
    });

    bounds.forEach(key => {
      const [off, color, isOv] = JSON.parse(key);
      if (off <= 0) return; // el borde izquierdo del track ya es un corte
      const line = document.createElement('div');
      line.className = 'phase-line' + (isOv ? ' phase-line--overlay' : '');
      line.style.setProperty('--ph', color || 'var(--cm-border-strong)');
      line.style.left = (off * ppd + RIBBON_GUTTER) + 'px';
      linesEl.appendChild(line);
    });
  }

  // ── Microcycles ──
  const cyclesEl = document.getElementById('calV2Cycles');
  let mdCounter = 0;
  if (cyclesEl) {
    cyclesEl.innerHTML = '';
    ordered.forEach((mc, ordIdx) => {
      const { left, width } = chipGeom(mc);
      const hasMatch = !!mcMatch(mc);
      const isToday  = mc.start_date <= TODAY && mc.end_date >= TODAY;
      const isActive = _allMCs[_mcIdx] && mc.id === _allMCs[_mcIdx].id;
      const chip = document.createElement('div');
      chip.className = 'mc-chip' + (hasMatch ? '' : ' mc-chip--rest') + (isToday ? ' mc-chip--today' : '') + (isActive ? ' mc-chip--active' : '');
      chip.style.left = left + 'px';
      chip.style.width = width + 'px';
      const mcNo = 'MC' + (ordIdx + 1);
      if (hasMatch) {
        mdCounter++;
        chip.innerHTML =
          `<div class="mc-chip__top"><span class="mc-chip__no">${mcNo}</span>` +
          `<span class="mc-chip__md">MD ${mdCounter}</span></div>` +
          `<div class="mc-chip__foot"><span class="mc-chip__dot"></span>` +
          `<span class="mc-chip__date">${fmtDay(mc.start_date)}</span></div>`;
      } else {
        chip.innerHTML =
          `<div class="mc-chip__top"><span class="mc-chip__no">${mcNo}</span></div>` +
          `<div class="mc-chip__rest-tag"><i class="ti ti-zzz"></i>${tt('calendar.rest','Rest')}</div>`;
      }
      chip.addEventListener('click', async () => {
        const realIdx = _allMCs.findIndex(m => m.id === mc.id);
        if (realIdx >= 0) {
          _mcIdx = realIdx; _weekOffset = 0;
          // Move the blue ring to the clicked chip right away (loadSessions doesn't re-render the ribbon)
          if (cyclesEl) cyclesEl.querySelectorAll('.mc-chip').forEach(c => c.classList.remove('mc-chip--active'));
          chip.classList.add('mc-chip--active');
          document.querySelectorAll('.cal-segs .cal-seg').forEach(s => s.classList.toggle('is-on', s.dataset.view === 'microcycle'));
          switchView('microcycle');
          await loadSessions();
        }
      });
      const editBtn = document.createElement('button');
      editBtn.className = 'mc-chip__edit';
      editBtn.title = tt('calendar.edit_microcycle','Edit microcycle');
      editBtn.innerHTML = '<i class="ti ti-pencil"></i>';
      editBtn.addEventListener('click', e => { e.stopPropagation(); openMcModal(mc); });
      chip.appendChild(editBtn);
      cyclesEl.appendChild(chip);
    });
  }

  // ── Match pills (same dedupe/resolution as v1, aligned to each match's MC) ──
  const matchesEl = document.getElementById('calV2Matches');
  if (matchesEl) {
    matchesEl.innerHTML = '';
    const seenDates = new Set();
    const rawMarkers = [];
    (extraMatches || []).forEach(s => {
      const d = s.session_date;
      if (!seenDates.has(d)) {
        seenDates.add(d);
        let isAway, compStr;
        if (s.home_away !== undefined) {
          isAway  = s.home_away === 'away';
          compStr = s.competition || '';
        } else {
          const noteParts = (s.notes || '').split(' · ');
          isAway  = /away/i.test(noteParts.find(p => /^(home|away)$/i.test(p)) || '');
          compStr = noteParts.find(p => !/^(home|away)$/i.test(p)) || '';
        }
        const rival = s.opponent || (s.title || tt('calendar.match_word','Match')).replace(/^vs\s+/i, '');
        rawMarkers.push({ date: d, id: s.id, isAway, comp: compClass(compStr), rival, isFromMc: false, mcData: null, crestUrl: s.rival_crest_url || null, start_time: s.start_time || null, location: s.location || null });
      }
    });

    // Resolve each marker's MC and group by week (one pill per MC; "+N" when 2+)
    const groups = [];
    const byKey = new Map();
    rawMarkers
      .filter(m => m.date >= ordered[0].start_date && m.date <= ordered[ordered.length - 1].end_date)
      .sort((a, b) => a.date > b.date ? 1 : -1)
      .forEach(m => {
        const mc = m.mcData || ordered.find(x => x.start_date <= m.date && x.end_date >= m.date);
        const key = mc ? 'mc:' + mc.id : 'd:' + m.date;
        let g = byKey.get(key);
        if (!g) { g = { mc, items: [] }; byKey.set(key, g); groups.push(g); }
        g.items.push(m);
      });

    groups.forEach(g => {
      const first = g.items[0];
      const extra = g.items.length - 1;
      const geom = g.mc
        ? chipGeom(g.mc)
        : { left: dayOffset(first.date) * ppd, width: Math.max(30, 7 * ppd - RIBBON_GAP) };
      const pill = document.createElement('div');
      pill.className = 'match-pill ' + (first.isAway ? 'match-pill--away' : 'match-pill--home') + ' is-' + (first.comp || 'liga');
      pill.style.left = geom.left + 'px';
      pill.style.width = geom.width + 'px';
      pill.title = g.items.map(i => `${i.rival} · ${i.isAway ? tt('calendar.away','Away') : tt('calendar.home','Home')}`).join(' | ');
      const lead = first.crestUrl
        ? `<img src="${_esc(first.crestUrl)}" style="width:14px;height:14px;border-radius:50%;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="">`
        : `<span class="match-pill__ha">${first.isAway ? 'A' : 'H'}</span>`;
      pill.innerHTML =
        lead +
        `<span class="match-pill__opp">${_esc(first.rival)}</span>` +
        `<span class="match-pill__slot">${extra ? '+' + extra : 'vs'}</span>`;
      pill.addEventListener('click', e => { e.stopPropagation(); showMatchPopover(pill, g.items); });
      matchesEl.appendChild(pill);
    });
  }

  // ── Today marker ──
  const todayEl = document.getElementById('calV2Today');
  if (todayEl) todayEl.style.left = (dayOffset(TODAY) * ppd + RIBBON_GUTTER) + 'px';

  // ── Season start/end markers + out-of-season shading ──
  const sStart = document.getElementById('calV2SeasonStart');
  const sEnd   = document.getElementById('calV2SeasonEnd');
  const shB = document.getElementById('calV2SeasonShadeBefore');
  const shA = document.getElementById('calV2SeasonShadeAfter');
  if (_calSeason?.start_date && _calSeason?.end_date) {
    const trackWidth = totalDays * ppd + RIBBON_GUTTER * 2;
    const startX = dayOffset(_calSeason.start_date) * ppd + RIBBON_GUTTER;
    const endX   = dayOffset(_calSeason.end_date)   * ppd + RIBBON_GUTTER;
    sStart.style.left = startX + 'px'; sStart.hidden = false;
    sEnd.style.left   = endX   + 'px'; sEnd.hidden   = false;
    shB.style.left = '0px';       shB.style.width = Math.max(0, startX) + 'px';             shB.hidden = false;
    shA.style.left = endX + 'px'; shA.style.width = Math.max(0, trackWidth - endX) + 'px';  shA.hidden = false;
  } else {
    [sStart, sEnd, shB, shA].forEach(el => el && (el.hidden = true));
  }

  // Initial auto-scroll to today — once (so a later re-render doesn't yank the scroll)
  if (!_ribbonV2Centered && !_ribbonViewRange) {
    const vp = document.getElementById('calRibbonV2');
    requestAnimationFrame(() => {
      const target = dayOffset(TODAY) * ppd + RIBBON_GUTTER - vp.clientWidth / 2;
      vp.scrollLeft = Math.max(0, target);
      _ribbonV2Centered = true;
    });
  }
}

// ── Match chip popover (uses unified .cal-epop) ───────────────
let _matchPop = null;
function closeMatchPopover() { if (_matchPop) { _matchPop.remove(); _matchPop = null; } }

function showMatchPopover(anchor, items) {
  closeEvtPopover();
  closeMatchPopover();

  const pop = document.createElement('div');
  pop.className = 'cal-epop';

  const first = items[0];
  const headCrest = first.crestUrl
    ? `<img class="ep-crest" src="${_esc(first.crestUrl)}" onerror="this.style.display='none'" alt="">`
    : `<span class="ep-icon"><i class="ti ti-ball-football"></i></span>`;

  const itemsHtml = items.map((item, i) => {
    const cc      = item.comp || 'liga';
    const haIcon  = item.isAway ? 'ti-plane' : 'ti-home';
    const haLbl   = item.isAway ? tt('calendar.away','Away') : tt('calendar.home','Home');
    const haBg    = item.isAway ? 'var(--cm-info-bg)'    : 'var(--cm-success-bg)';
    const haClr   = item.isAway ? 'var(--cm-info)'       : 'var(--cm-success)';
    const haBd    = item.isAway ? 'var(--cm-info-bd)'    : 'var(--cm-success-bd)';
    const dateFmt = _fmtDateStr(item.date);
    const timeStr = item.start_time ? ' · ' + item.start_time.slice(0,5) : '';
    const border  = i > 0 ? 'border-top:1px solid var(--cm-border-soft);' : '';
    // All markers come from calendar_events → editable by their own id
    const editEvtBtn = item.id
      ? `<button class="cm-btn is-primary is-sm" style="height:26px;font-size:11.5px" data-pop-edit-evt="${item.id}"><i class="ti ti-edit" style="font-size:11px"></i>${tt('calendar.edit_event_btn','Edit event')}</button>`
      : '';
    const rowCrest = item.crestUrl
      ? `<img src="${_esc(item.crestUrl)}" style="width:18px;height:18px;border-radius:50%;object-fit:contain;flex-shrink:0;background:var(--cm-bg-soft)" onerror="this.style.display='none'" alt="">`
      : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--cm-bg-soft);flex-shrink:0"><i class="ti ti-ball-football" style="font-size:11px;color:var(--cm-fg-faint)"></i></span>`;
    return `<div style="padding:10px 12px;${border}">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
        ${rowCrest}
        <span style="font:600 13px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);flex:1">vs ${_esc(item.rival)}</span>
        <span style="display:inline-flex;align-items:center;gap:3px;height:17px;padding:0 5px;border-radius:3px;font:600 9px/1 var(--cm-font-mono);background:${haBg};color:${haClr};border:1px solid ${haBd}"><i class="ti ${haIcon}" style="font-size:9px"></i>${haLbl}</span>
      </div>
      <div class="cal-epop-row"><i class="ti ${compIcon(cc)}"></i><span>${compLabel(cc)} · ${dateFmt}${timeStr}</span></div>
      ${item.location ? `<div class="cal-epop-row"><i class="ti ti-map-pin"></i><span>${_esc(item.location)}</span></div>` : ''}
      ${editEvtBtn ? `<div style="display:flex;gap:5px;margin-top:6px">${editEvtBtn}</div>` : ''}
    </div>`;
  }).join('');

  pop.innerHTML = `
    <div class="cal-epop-head">
      ${headCrest}
      <div style="min-width:0;flex:1">
        <div class="cal-epop-title">${items.length > 1 ? tt('calendar.matches_n','Matches ({n})',{n:items.length}) : tt('calendar.match_single','Match')}</div>
        <div class="cal-epop-type">${tt('calendar.season_ribbon_sub','Season Ribbon')}</div>
      </div>
    </div>
    <div style="max-height:320px;overflow-y:auto">${itemsHtml}</div>
  `;

  document.body.appendChild(pop);
  _matchPop = pop;
  _evtPop   = pop; // share slot so click-outside logic in _positionPop closes it

  pop.querySelectorAll('[data-pop-edit-evt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const evtId = btn.dataset.popEditEvt;
      closeMatchPopover();
      const { data } = await window.sb.from('calendar_events').select('*').eq('id', evtId).single();
      if (data) openEvtModal({ ...data, source: 'event', session_type: 'match',
                               session_date: (data.date || '').split('T')[0] });
    });
  });

  _positionPop(pop, anchor, 320);
}

// ── Upcoming Events ───────────────────────────────────────────
// ── Upcoming filters ──────────────────────────────────────────
const UPCOMING_FILTER_GROUPS = [
  { label:'Training',  key:'calendar.grp_training',  types:['training','gym','recovery','walkthrough','prehab','warmup'] },
  { label:'Match',     key:'calendar.grp_match',     types:['match'] },
  { label:'Meals',     key:'calendar.grp_meals',     types:['breakfast','lunch','dinner','snack'] },
  { label:'Logistics', key:'calendar.grp_logistics', types:['hotel_checkin','hotel_checkout','bus_departure','bus_arrival','travel'] },
  { label:'Other',     key:'calendar.grp_other',     types:['prevention','press','medical_check','physio','scouting','video_session','meeting','evaluation','day_off','other'] },
];
const UPCOMING_ALL_TYPES     = UPCOMING_FILTER_GROUPS.flatMap(g => g.types);
const UPCOMING_DEFAULT_HIDDEN = new Set(['breakfast','lunch','dinner','snack']);
let _upcomingAllItems    = [];
let _upcomingActFilters  = null; // Set of visible types (lazily loaded)

function _upcomingFiltersKey() {
  return `clava.upcoming.filters.${_clubId||'x'}.${_currentUserId||'x'}`;
}
function _loadUpcomingFilters() {
  if (_upcomingActFilters) return _upcomingActFilters;
  try {
    const raw = localStorage.getItem(_upcomingFiltersKey());
    if (raw) { _upcomingActFilters = new Set(JSON.parse(raw)); return _upcomingActFilters; }
  } catch {}
  _upcomingActFilters = new Set(UPCOMING_ALL_TYPES.filter(t => !UPCOMING_DEFAULT_HIDDEN.has(t)));
  return _upcomingActFilters;
}
function _saveUpcomingFilters() {
  try { localStorage.setItem(_upcomingFiltersKey(), JSON.stringify([..._upcomingActFilters])); } catch {}
}
function _updateUpcomingFilterBadge() {
  const badge = document.getElementById('upcomingFilterBadge');
  if (!badge) return;
  const hidden = UPCOMING_ALL_TYPES.filter(t => !_upcomingActFilters?.has(t)).length;
  badge.textContent = hidden;
  badge.style.display = hidden > 0 ? '' : 'none';
}

const _UPCOMING_TYPE_KEYS = {
  match:'calendar.type_match', training:'calendar.filter_training', gym:'calendar.type_gym', travel:'calendar.type_travel', recovery:'calendar.type_recovery',
  tactical:'calendar.filter_training', conditioning:'calendar.filter_training', physical:'calendar.filter_training', other:'calendar.type_other',
  breakfast:'calendar.type_breakfast', lunch:'calendar.type_lunch', dinner:'calendar.type_dinner', snack:'calendar.type_snack',
  hotel_checkin:'calendar.type_hotel_checkin', hotel_checkout:'calendar.type_hotel_checkout',
  bus_departure:'calendar.type_bus_departure', bus_arrival:'calendar.type_bus_arrival',
  press:'calendar.type_press', medical_check:'calendar.type_medical_check', physio:'calendar.type_physio',
  prevention:'calendar.type_prevention', prehab:'calendar.type_prehab_short', warmup:'calendar.type_warmup',
  walkthrough:'calendar.type_walkthrough_short', scouting:'calendar.type_scouting',
  day_off:'calendar.type_day_off', meeting:'calendar.type_meeting', evaluation:'calendar.type_evaluation', video_session:'calendar.type_video_session',
};
function upcomingTypeLabel(type) {
  const key = _UPCOMING_TYPE_KEYS[type];
  const raw = key ? tt(key, type) : (type || 'event');
  return String(raw).toUpperCase();
}

function _renderUpcomingFiltered() {
  const container = document.getElementById('calUpcomingList');
  if (!container) return;
  const filters = _loadUpcomingFilters();
  // legacy 'tactical'/'conditioning' items show under the unified 'training' filter
  const visible = _upcomingAllItems.filter(item => {
    const t = item.type;
    return filters.has(t) || ((t === 'conditioning' || t === 'tactical') && filters.has('training'));
  });
  if (!visible.length) {
    container.innerHTML = _upcomingAllItems.length
      ? `<div style="padding:16px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('calendar.no_events_match_filters','No events match current filters')}</div>`
      : `<div style="padding:16px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('calendar.no_upcoming_14','No upcoming events in the next 14 days')}</div>`;
    _updateUpcomingFilterBadge();
    return;
  }
  container.innerHTML = visible.slice(0, 6).map(item => {
    const d        = new Date(item.date + 'T12:00:00');
    const month    = d.toLocaleString(ttLocale(), { month: 'short' }).toUpperCase();
    const day      = d.getDate();
    const label    = upcomingTypeLabel(item.type);
    const cat      = focusToClass(item.type);
    const badgeBg  = EVT_BG[cat]  || EVT_BG.training;
    const badgeClr = EVT_CLR[cat] || EVT_CLR.training;
    const isMatch  = item.type === 'match';
    const dStyle   = isMatch ? 'background:var(--cm-danger-bg);border-color:var(--cm-danger-bd)' : '';
    const mStyle   = isMatch ? 'color:var(--cm-danger)' : '';
    const loc      = isMatch ? (item.isAway ? tt('calendar.away','Away') : tt('calendar.home','Home')) : '';
    const timeChip = item.start_time ? `<span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-left:4px">${item.start_time.slice(0,5)}</span>` : '';
    const crestChip = (isMatch && item.rival_crest_url)
      ? `<img src="${_esc(item.rival_crest_url)}" style="width:16px;height:16px;border-radius:50%;object-fit:contain;flex-shrink:0;margin-right:2px;vertical-align:middle" onerror="this.style.display='none'" alt="">`
      : '';
    const evtIdAttr = (item.source === 'event' && item.id) ? ` data-evt-id="${item.id}"` : '';
    return `
      <div class="upcoming-row"${evtIdAttr}>
        <div class="upcoming-date" style="${dStyle}"><div class="m" style="${mStyle}">${month}</div><div class="d" style="${mStyle}">${day}</div></div>
        <div class="upcoming-body">
          <div class="upcoming-title" style="display:flex;align-items:center;gap:5px">${crestChip}${_esc(item.title)}</div>
          <div class="upcoming-meta"><span class="badge" style="background:${badgeBg};color:${badgeClr}">${label}</span>${loc}${timeChip}</div>
        </div>
        <div></div>
      </div>`;
  }).join('');
  _updateUpcomingFilterBadge();
}

function _initUpcomingFilter() {
  const btn = document.getElementById('upcomingFilterBtn');
  if (!btn) return;
  _loadUpcomingFilters();
  _updateUpcomingFilterBadge();

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const existing = document.getElementById('upcomingFilterDrop');
    if (existing) { existing.remove(); return; }

    const drop = document.createElement('div');
    drop.id = 'upcomingFilterDrop';
    drop.className = 'upcoming-filter-drop';

    let html = `<div class="upcoming-filt-acts">
      <span class="upcoming-filt-act" id="ufSelAll">${tt('calendar.select_all','Select all')}</span>
      <span class="upcoming-filt-act" id="ufSelNone">${tt('calendar.select_none','Select none')}</span>
    </div>`;
    UPCOMING_FILTER_GROUPS.forEach(grp => {
      html += `<div class="upcoming-filt-group">${tt(grp.key, grp.label)}</div>`;
      grp.types.forEach(type => {
        const chk = _upcomingActFilters?.has(type) ? 'checked' : '';
        const _tl = (_UPCOMING_TYPE_KEYS[type] ? tt(_UPCOMING_TYPE_KEYS[type], type) : type.replace(/_/g,' '));
        html += `<label class="upcoming-filt-row"><input type="checkbox" data-type="${type}" ${chk}><span>${_tl}</span></label>`;
      });
    });
    drop.innerHTML = html;

    // Position fixed, right-aligned below button
    const r = btn.getBoundingClientRect();
    drop.style.cssText = `position:fixed;right:${Math.round(window.innerWidth-r.right)}px;top:${Math.round(r.bottom+4)}px;width:190px`;
    document.body.appendChild(drop);

    drop.querySelectorAll('input[data-type]').forEach(chk => {
      chk.addEventListener('change', () => {
        const t = chk.dataset.type;
        if (chk.checked) _upcomingActFilters.add(t); else _upcomingActFilters.delete(t);
        _saveUpcomingFilters();
        _renderUpcomingFiltered();
      });
    });
    drop.querySelector('#ufSelAll')?.addEventListener('click', () => {
      UPCOMING_ALL_TYPES.forEach(t => _upcomingActFilters.add(t));
      _saveUpcomingFilters();
      _renderUpcomingFiltered();
      drop.querySelectorAll('input[data-type]').forEach(c => { c.checked = true; });
    });
    drop.querySelector('#ufSelNone')?.addEventListener('click', () => {
      _upcomingActFilters.clear();
      _saveUpcomingFilters();
      _renderUpcomingFiltered();
      drop.querySelectorAll('input[data-type]').forEach(c => { c.checked = false; });
    });

    const closeDrop = ev => {
      if (!drop.contains(ev.target) && ev.target !== btn) { drop.remove(); document.removeEventListener('click', closeDrop); }
    };
    setTimeout(() => document.addEventListener('click', closeDrop), 0);
  });
}

async function renderUpcoming() {
  const container = document.getElementById('calUpcomingList');
  if (!container) return;

  // Anchor the forward window to the period being VIEWED (not the real today), so e.g. a
  // preseason month/microcycle shows its events instead of "none". From = start of the
  // visible range; To = +14 days from that or the visible range end, whichever is later.
  let from = TODAY, rangeEnd = null;
  if (_calView === 'month') {
    from = `${_monthY}-${String(_monthM + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(_monthY, _monthM + 1, 0).getDate();
    rangeEnd = `${_monthY}-${String(_monthM + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    const mc = _allMCs[_mcIdx];
    if (mc && mc.start_date) { from = mc.start_date; rangeEnd = mc.end_date || null; }
  }
  const plus14 = new Date(new Date(from + 'T00:00:00').getTime() + 14 * 86400000).toISOString().split('T')[0];
  const to = (rangeEnd && rangeEnd > plus14) ? rangeEnd : plus14;
  const { data: sessions } = await fetchAllEvents(from, to);

  _upcomingAllItems = [];
  (sessions || []).forEach(s => {
    _upcomingAllItems.push({ id: s.id || null, source: s.source || null, date: s.session_date, title: s.title, type: s.session_type, start_time: s.start_time || null, rival_crest_url: s.rival_crest_url || null });
  });
  _upcomingAllItems.sort((a, b) => a.date > b.date ? 1 : -1);

  _loadUpcomingFilters();
  _renderUpcomingFiltered();
}

// ── Calendar KPIs ─────────────────────────────────────────────
function renderCalKPIs(mcs) {
  const today = new Date();
  const in21d = cmYMD(new Date(Date.now() + 21 * 86400000));

  // Next match: nearest calendar_event match from today onward
  const nextMatch = _matchSessions
    .filter(s => s.session_date >= TODAY)
    .map(s => ({ date: s.session_date, label: (s.opponent || (s.title||tt('calendar.match_word','Match')).replace(/^vs\s*/i,'')) + (s.home_away ? ' · '+(s.home_away==='home'?tt('calendar.home','Home'):s.home_away==='away'?tt('calendar.away','Away'):tt('calendar.neutral','Neutral')) : '') }))
    .sort((a,b) => a.date > b.date ? 1 : -1)[0];
  const kpiNext  = document.querySelector('.cal-kpi:nth-child(1) .cal-kpi-v');
  const kpiNextT = document.querySelector('.cal-kpi:nth-child(1) .cal-kpi-t');
  if (kpiNext && nextMatch) {
    const d    = new Date(nextMatch.date + 'T12:00:00');
    const diff = Math.round((d - today) / 86400000);
    kpiNext.textContent  = d.toLocaleDateString(ttLocale(), { weekday: 'short', month: 'short', day: 'numeric' });
    kpiNextT.textContent = `${nextMatch.label} · ${tt('calendar.in_days','in {n} day|in {n} days',{n:diff,count:diff})}`;
  } else if (kpiNext) {
    kpiNext.textContent  = '—';
    kpiNextT.textContent = tt('calendar.no_upcoming_matches','No upcoming matches');
  }

  (async () => {
    const loadV = document.getElementById('calLoadV');
    const loadT = document.getElementById('calLoadT');
    if (!loadV) return;
    const sorted = [...mcs].sort((a,b) => a.start_date > b.start_date ? 1 : -1);
    const ci = sorted.findIndex(m => m.start_date <= TODAY && m.end_date >= TODAY);
    const curIdx = ci >= 0 ? ci : sorted.length - 1;
    const cur = sorted[curIdx];
    const prev = sorted[curIdx - 1];
    if (!cur) { loadV.innerHTML = `— <sub>${tt('calendar.au','AU')}</sub>`; loadT.textContent = tt('calendar.no_microcycle','No microcycle'); return; }
    async function mcAu(mc) {
      if (!mc) return null;
      const [s, e] = await Promise.all([
        window.sb.from('training_sessions').select('duration,estimated_rpe')
          .eq('club_id', _clubId).eq('team_id', _activeTeamId).eq('is_historical', false)
          .gte('session_date', mc.start_date).lte('session_date', mc.end_date),
        window.sb.from('calendar_events').select('duration_minutes,estimated_rpe')
          .eq('club_id', _clubId).eq('team_id', _activeTeamId)
          .gte('date', mc.start_date).lte('date', mc.end_date)
      ]);
      const au = [...(s.data||[]).map(r=>({d:r.duration,r:r.estimated_rpe})),
                  ...(e.data||[]).map(r=>({d:r.duration_minutes,r:r.estimated_rpe}))]
        .filter(x => x.d && x.r).reduce((sum,x) => sum + x.d * x.r, 0);
      return au;
    }
    const curAu = await mcAu(cur);
    const prevAu = await mcAu(prev);
    loadV.innerHTML = `${curAu.toLocaleString(ttLocale())} <sub>${tt('calendar.au','AU')}</sub>`;
    if (prevAu && prevAu > 0) {
      const pct = Math.round(((curAu - prevAu) / prevAu) * 100);
      const color = pct <= 0 ? 'var(--cm-success)' : 'var(--cm-warning)';
      loadT.innerHTML = `<span style="color:${color};font:600 12px/1 var(--cm-font-mono)">${tt('calendar.vs_prev_mc','{pct}% vs prev MC',{pct:(pct>=0?'+':'')+pct})}</span>`;
    } else {
      loadT.textContent = tt('calendar.no_prev_mc_compare','No prev MC to compare');
    }
  })();

  // Match density: matches from calendar_events in the next 21 days
  const matchCount = _matchSessions
    .filter(s => s.session_date >= TODAY && s.session_date <= in21d).length;
  const kpiDV = document.getElementById('calDensityV');
  const kpiDT = document.getElementById('calDensityT');
  if (kpiDV) kpiDV.innerHTML = matchCount ? `${matchCount} <sub>${tt('calendar.in_21d','in 21d')}</sub>` : `— <sub>${tt('calendar.in_21d','in 21d')}</sub>`;
  if (kpiDT) {
    if (matchCount === 0) {
      kpiDT.textContent = tt('calendar.no_matches_next_21','No matches in next 21 days');
      kpiDT.style.color = '';
    } else {
      const density = (matchCount / 3).toFixed(1);
      kpiDT.textContent = tt('calendar.density_line','~{density}/week · {n} match|~{density}/week · {n} matches',{density,n:matchCount,count:matchCount});
      kpiDT.style.color = matchCount > 3 ? 'var(--cm-warning)' : '';
    }
  }
}

// ── Import Fixtures ───────────────────────────────────────────
let _importParsed = []; // currently parsed fixtures

async function showImportPreview(fixtures) {
  _importParsed = fixtures;
  if (!fixtures.length) {
    showCalToast(tt('calendar.no_valid_fixtures','No valid fixtures found.'));
    return;
  }
  // Check conflicts
  const dates = fixtures.map(f => f.date);
  const { data: existing } = await window.sb.from('calendar_events')
    .select('date').eq('club_id', _clubId).eq('team_id', _activeTeamId).eq('type','match').in('date', dates);
  const conflictDates = new Set((existing||[]).map(s => (s.date||'').split('T')[0]));

  const previewEl = document.getElementById('calImportPreview');
  const bodyEl    = document.getElementById('calImportPreviewBody');
  const titleEl   = document.getElementById('calImportPreviewTitle');
  previewEl.style.display = '';
  const _parsed = tt('calendar.fixtures_parsed','{n} fixture parsed|{n} fixtures parsed',{n:fixtures.length,count:fixtures.length});
  const _conf   = conflictDates.size ? tt('calendar.conflicts_suffix',' · {n} conflict| · {n} conflicts',{n:conflictDates.size,count:conflictDates.size}) : '';
  titleEl.textContent = _parsed + _conf;
  const confBtn = document.getElementById('calImportConfirm');
  confBtn.style.display = '';
  confBtn.textContent = tt('calendar.import_n_fixtures','Import {n} fixture|Import {n} fixtures',{n:fixtures.length,count:fixtures.length});

  bodyEl.innerHTML = fixtures.map(f => {
    const isConflict = conflictDates.has(f.date);
    return `<tr class="${isConflict?'conflict':''}">
      <td>${f.date}</td>
      <td>${_esc(f.opponent)}</td>
      <td><span class="badge-ha ${f.home_away}">${f.home_away==='home'?'<i class="ti ti-home" style="font-size:9px"></i> '+tt('calendar.home','Home'):'<i class="ti ti-plane" style="font-size:9px"></i> '+tt('calendar.away','Away')}</span></td>
      <td style="color:var(--cm-fg-muted)">${_esc(f.competition||'—')}</td>
      <td>${isConflict?`<span class="badge-conflict">${tt('calendar.conflict','conflict')}</span>`:''}</td>
    </tr>`;
  }).join('');
}

(function() {
  const backdrop = document.getElementById('calImportBackdrop');
  const openImport = () => {
    _importParsed = [];
    document.getElementById('calImportPasteArea').value = '';
    document.getElementById('calImportPreview').style.display = 'none';
    document.getElementById('calImportConfirm').style.display = 'none';
    document.getElementById('calImportSaving').style.display = 'none';
    backdrop.classList.add('is-open');
    document.getElementById('calImportPasteArea').focus();
  };
  const closeImport = () => backdrop.classList.remove('is-open');

  document.getElementById('calImportBtn').addEventListener('click', openImport);
  document.getElementById('calImportClose').addEventListener('click', closeImport);
  document.getElementById('calImportCancel').addEventListener('click', closeImport);
  backdrop.addEventListener('click', e => { if (e.target === e.currentTarget) closeImport(); });

  // Tab switching
  backdrop.querySelectorAll('.cal-import-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      backdrop.querySelectorAll('.cal-import-tab').forEach(t => t.classList.remove('is-on'));
      tab.classList.add('is-on');
      document.getElementById('calImportPasteTab').style.display = tab.dataset.tab === 'paste' ? '' : 'none';
      document.getElementById('calImportCsvTab').style.display   = tab.dataset.tab === 'csv'   ? '' : 'none';
    });
  });

  // Parse paste
  document.getElementById('calImportParseBtn').addEventListener('click', () => {
    const text = document.getElementById('calImportPasteArea').value;
    const fixtures = CMFixtures.parseDelimited(text).filter(r => r.valid);
    showImportPreview(fixtures);
  });

  // CSV file
  document.getElementById('calImportFile').addEventListener('change', async function() {
    if (!this.files[0]) return;
    document.getElementById('calImportFileLabel').textContent = this.files[0].name;
    const text = await this.files[0].text();
    const fixtures = CMFixtures.parseDelimited(text).filter(r => r.valid);
    showImportPreview(fixtures);
  });

  // Confirm import
  document.getElementById('calImportConfirm').addEventListener('click', async () => {
    if (!_importParsed.length) return;
    const saving = document.getElementById('calImportSaving');
    const confBtn = document.getElementById('calImportConfirm');
    saving.style.display = 'inline'; confBtn.disabled = true;

    const newComps = CMFixtures.detectNewCompetitions(_importParsed, _calComps);
    const res = await CMFixtures.confirmImport({
      sb: window.sb, clubId: _clubId, teamId: _activeTeamId, seasonId: _calSeasonId,
      existingComps: _calComps, rows: _importParsed,
      newCompNames: newComps, overwrite: document.getElementById('calImportOverwrite').checked,
      newCompColor: '#64748b' });
    saving.style.display = 'none'; confBtn.disabled = false;
    if (res.error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:res.error.message})); return; }

    closeImport();
    showCalToast(tt('calendar.fixtures_imported','{n} fixture imported.|{n} fixtures imported.',{n:res.inserted,count:res.inserted}));
    // Reload match events and re-render ribbon + KPIs
    await refreshRibbonMatches();
  });
})();

// ── Share with players ────────────────────────────────────────
// El link es por microciclo Y por equipo: un mismo MC puede estar compartido con varias
// categorías y cada una tiene que ver solo su agenda. Los links viejos se guardaron sin
// team_id, así que también valen para el equipo activo (la RPC los acota por el equipo
// del microciclo) — por eso el filtro acepta el equipo actual o nulo.
async function loadShareLink() {
  if (!_clubId) return;
  const mc = _allMCs[_mcIdx];
  if (!mc) { _activeShareLink = null; return; }
  const { data } = await window.sb.from('share_links')
    .select('*')
    .eq('club_id', _clubId)
    .eq('scope', 'players')
    .eq('revoked', false)
    .eq('mc_id', mc.id)
    .or(_activeTeamId ? `team_id.eq.${_activeTeamId},team_id.is.null` : 'team_id.is.null')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  _activeShareLink = data || null;
  renderPublishState();
}

function renderShareLinkSection() {
  const el = document.getElementById('calShareLinkSection');
  if (!el) return;
  if (_activeShareLink) {
    const url = `${location.origin}/shared.html?token=${_activeShareLink.token}`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px">
        <input class="share-link-input" type="text" value="${url}" readonly id="calShareLinkInput">
        <button class="cm-btn is-ghost is-sm" id="calShareCopyBtn" title="${tt('calendar.copy_link','Copy link')}"><i class="ti ti-copy" style="font-size:13px"></i></button>
        <button class="cm-btn is-danger is-sm" id="calShareRevokeBtn"><i class="ti ti-trash" style="font-size:12px"></i>${tt('calendar.revoke','Revoke')}</button>
      </div>`;
    document.getElementById('calShareCopyBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => showCalToast(tt('calendar.link_copied','Link copied.'))).catch(() => {
        const inp = document.getElementById('calShareLinkInput');
        if (inp) { inp.select(); document.execCommand('copy'); showCalToast(tt('calendar.link_copied','Link copied.')); }
      });
    });
    document.getElementById('calShareRevokeBtn')?.addEventListener('click', revokeShareLink);
  } else {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="flex:1;font:var(--cm-body-sm);color:var(--cm-fg-muted)">${tt('calendar.no_active_link','No active link for this microcycle.')}</span>
        <button class="cm-btn is-primary is-sm" id="calShareGenBtn"><i class="ti ti-link" style="font-size:13px"></i>${tt('calendar.generate_link','Generate link')}</button>
      </div>`;
    document.getElementById('calShareGenBtn')?.addEventListener('click', generateShareLink);
  }
}

function openShareModal() {
  renderShareLinkSection();
  document.getElementById('calShareBackdrop').classList.add('is-open');
}

function closeShareModal() {
  document.getElementById('calShareBackdrop').classList.remove('is-open');
}

async function generateShareLink() {
  const mc = _allMCs[_mcIdx];
  if (!mc || !_clubId) return;
  const token = crypto.randomUUID();
  const { data, error } = await window.sb.from('share_links').insert({
    club_id: _clubId, scope: 'players', token, mc_id: mc.id, team_id: _activeTeamId || null,
  }).select().single();
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  _activeShareLink = data;
  renderPublishState();
  renderShareLinkSection();
  showCalToast(tt('calendar.share_link_generated','Share link generated.'));
}

async function revokeShareLink() {
  if (!_activeShareLink) return;
  if (!confirm(tt('calendar.revoke_confirm','Revoke this link? Anyone who has it will lose access.'))) return;
  const { error } = await window.sb.from('share_links').update({ revoked: true }).eq('id', _activeShareLink.id);
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  _activeShareLink = null;
  renderPublishState();
  renderShareLinkSection();
  showCalToast(tt('calendar.link_revoked','Link revoked.'));
}

// ── Dedicated print sheets (ClavaMetrics "Microcycle Week Plan") ──
// Todo tipo que se pueda cargar en el calendario tiene que estar acá: lo que cae en
// _fallback se imprime con un punto anónimo, y en una hoja llena de eventos de logística
// («llegada al hotel», «salida del bus») ese punto no dice nada.
const CAL_TYPE_META = {
  training:   { abbr:'TRA',   fg:'#1E40AF', bg:'#EFF4FF', bd:'#C7D7FE', label:'Training' },
  tactical:   { abbr:'TRA',   fg:'#1E40AF', bg:'#EFF4FF', bd:'#C7D7FE', label:'Training' },
  conditioning:{abbr:'TRA',   fg:'#1E40AF', bg:'#EFF4FF', bd:'#C7D7FE', label:'Training' },
  beach:      { abbr:'BEACH', fg:'#92400E', bg:'#FEF4E6', bd:'#F3D9A6', label:'Beach session' },
  outdoor:    { abbr:'OUT',   fg:'#0F766E', bg:'#ECFDF5', bd:'#A7F3D0', label:'Outdoor endurance' },
  gym:        { abbr:'GYM',   fg:'#5B21B6', bg:'#F5F2FF', bd:'#DDD3FB', label:'Gym' },
  prevention: { abbr:'PREV',  fg:'#9D174D', bg:'#FDF2F8', bd:'#FBCFE8', label:'Prevention work' },
  prehab:     { abbr:'PREHAB',fg:'#A21CAF', bg:'#FDF4FF', bd:'#F0ABFC', label:'Prehab' },
  warmup:     { abbr:'W-UP',  fg:'#C2410C', bg:'#FFF7ED', bd:'#FED7AA', label:'Warm-up' },
  match:      { abbr:'MATCH', fg:'#991B1B', bg:'#FCE9E9', bd:'#F1B9B9', label:'Match' },
  recovery:   { abbr:'REC',   fg:'#14532D', bg:'#ECFBF1', bd:'#BBEBCB', label:'Recovery' },
  walkthrough:{ abbr:'ACT',   fg:'#1D4ED8', bg:'#F5F8FF', bd:'#DCE6FD', label:'Walkthrough' },
  travel:     { abbr:'TRV',   fg:'#155E75', bg:'#ECFEFF', bd:'#A5F3FC', label:'Travel' },
  bus_departure:{abbr:'BUS',  fg:'#155E75', bg:'#ECFEFF', bd:'#A5F3FC', label:'Bus departure' },
  bus_arrival:{ abbr:'BUS',   fg:'#155E75', bg:'#ECFEFF', bd:'#A5F3FC', label:'Bus arrival' },
  hotel_checkin:{abbr:'HOTEL',fg:'#475569', bg:'#F1F5F9', bd:'#CBD5E1', label:'Hotel check-in' },
  hotel_checkout:{abbr:'HOTEL',fg:'#475569',bg:'#F1F5F9', bd:'#CBD5E1', label:'Hotel check-out' },
  meeting:    { abbr:'MTG',   fg:'#1E3A8A', bg:'#EFF6FF', bd:'#BFDBFE', label:'Meeting' },
  evaluation: { abbr:'EVA',   fg:'#14532D', bg:'#F0FDF4', bd:'#BBF7D0', label:'Evaluation' },
  video:      { abbr:'VID',   fg:'#334155', bg:'#F1F4F8', bd:'#D8E0EA', label:'Video' },
  video_session:{abbr:'VID',  fg:'#334155', bg:'#F1F4F8', bd:'#D8E0EA', label:'Video' },
  scouting:   { abbr:'SCO',   fg:'#334155', bg:'#F1F4F8', bd:'#D8E0EA', label:'Scouting' },
  press:      { abbr:'PRESS', fg:'#334155', bg:'#F1F4F8', bd:'#D8E0EA', label:'Press conference' },
  medical_check:{abbr:'MED',  fg:'#9F1239', bg:'#FFF1F2', bd:'#FECDD3', label:'Medical check' },
  breakfast:  { abbr:'MEAL',  fg:'#92400E', bg:'#FEF4E6', bd:'#F3D9A6', label:'Meal' },
  lunch:      { abbr:'MEAL',  fg:'#92400E', bg:'#FEF4E6', bd:'#F3D9A6', label:'Meal' },
  dinner:     { abbr:'MEAL',  fg:'#92400E', bg:'#FEF4E6', bd:'#F3D9A6', label:'Meal' },
  snack:      { abbr:'SNACK', fg:'#3F6212', bg:'#F7FEE7', bd:'#D9F99D', label:'Snack' },
  day_off:    { abbr:'OFF',   fg:'#9CA3AF', bg:'#F3F4F6', bd:'#D8DCE0', label:'Day off' },
  physio:     { abbr:'PHY',   fg:'#155E75', bg:'#ECFEFF', bd:'#A5F3FC', label:'Physio' },
  other:      { abbr:'EVT',   fg:'#475569', bg:'#F1F5F9', bd:'#CBD5E1', label:'Event' },
  // Preventivo obligatorio: no es un tipo aparte, es cómo se pinta 'prevention' cuando
  // la asistencia no se negocia (ver calCardMeta).
  _mandatory: { abbr:'PREV', fg:'#B91C1C', bg:'#FEF2F2', bd:'#FCA5A5', label:'Prevention work' },
  _fallback:  { abbr:'•',     fg:'#475569', bg:'#F1F5F9', bd:'#CBD5E1', label:'Event' }
};
// Meta de un evento concreto: igual que CAL_TYPE_META[tipo], salvo el preventivo
// obligatorio, que va en rojo.
function calCardMeta(e) {
  if (e && e.session_type === 'prevention' && e.is_mandatory) return CAL_TYPE_META._mandatory;
  return CAL_TYPE_META[e && e.session_type] || CAL_TYPE_META._fallback;
}
// ¿La hoja tiene algún preventivo obligatorio? Decide si se imprime la nota al pie que
// explica el asterisco. Recibe el mapa fecha → eventos que ya arman las dos hojas.
function calHasMandatory(byDay) {
  return Object.values(byDay || {}).some(list =>
    (list || []).some(e => e.session_type === 'prevention' && e.is_mandatory));
}
const CAL_TYPE_LABEL_KEY = {
  training:'calendar.type_label_training', tactical:'calendar.type_label_training', conditioning:'calendar.type_label_training',
  beach:'calendar.type_beach', outdoor:'calendar.type_outdoor',
  gym:'calendar.type_label_gym', prevention:'calendar.type_prevention', match:'calendar.type_label_match',
  prehab:'calendar.type_prehab_short', warmup:'calendar.type_warmup',
  recovery:'calendar.type_label_recovery', walkthrough:'calendar.type_walkthrough_short',
  travel:'calendar.type_label_travel', bus_departure:'calendar.type_bus_departure', bus_arrival:'calendar.type_bus_arrival',
  hotel_checkin:'calendar.type_hotel_checkin', hotel_checkout:'calendar.type_hotel_checkout',
  meeting:'calendar.type_label_meeting',
  evaluation:'calendar.type_label_evaluation', video:'calendar.type_label_video', video_session:'calendar.type_label_video',
  scouting:'calendar.type_scouting', press:'calendar.type_press', medical_check:'calendar.type_medical_check',
  breakfast:'calendar.type_label_meal', lunch:'calendar.type_label_meal', dinner:'calendar.type_label_meal',
  snack:'calendar.type_label_snack',
  day_off:'calendar.type_label_day_off', physio:'calendar.type_label_physio',
  other:'calendar.type_label_event',
  _mandatory:'calendar.type_prevention', _fallback:'calendar.type_label_event',
};
function calMetaLabel(type){
  const meta = CAL_TYPE_META[type] || CAL_TYPE_META._fallback;
  const key = CAL_TYPE_LABEL_KEY[type] || CAL_TYPE_LABEL_KEY._fallback;
  // A basketball club plays a game, not a match. Every other event type is the same
  // word in every sport, so only this one is swapped (assets/sport-packs.js → vocab).
  if (type === 'match' && window.CMSport) {
    const w = window.CMSport.word('match');
    if (w) return w;
  }
  return tt(key, meta.label);
}
function calEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function calCurrentMc(){ return _allMCs[_mcIdx] || null; }
// MD label for a date, through the shared engine (lib/day-context.js). It used to diff
// against mc.match_date alone — one match per week — so on a cup week the printed week
// sheet and the day sheet disagreed with the calendar grid right next to them. Now every
// match in _matchSessions counts and the nearest one wins, which is what the grid does.
// display:true keeps the typographic minus these printed sheets have always shown.
function calMdForDate(dateStr, mc){
  const dates = (_matchSessions || []).map(s => s.session_date).filter(Boolean);
  return window.cmMdForDate(dateStr, dates, {
    overrides: mc && mc.md_overrides, display: true,
  }).label;
}
function calFmtRange(a, b){
  try {
    const da = new Date(a+'T12:00:00'), db = new Date(b+'T12:00:00');
    const mA = da.toLocaleDateString(ttLocale(),{month:'short'}), mB = db.toLocaleDateString(ttLocale(),{month:'short'});
    return mA === mB ? `${da.getDate()}–${db.getDate()} ${mB}` : `${da.getDate()} ${mA} – ${db.getDate()} ${mB}`;
  } catch(_) { return ''; }
}

async function calBuildWeekSheet(){
  const host = document.getElementById('calPrintSheet');
  if (!host) return;
  try {
    const FONT = "'Geist',system-ui,sans-serif", MONO = "'Geist Mono',ui-monospace,monospace";
    const esc = calEsc;
    const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
    const addDays = (s,n) => { const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; };
    const fmtDow = ds => { try { return new Date(ds+'T12:00:00').toLocaleDateString(ttLocale(),{weekday:'short',day:'numeric',month:'short'}); } catch(_){ return ds; } };
    const mono = n => { const w=(n||'').trim().split(/\s+/).filter(Boolean); return ((((w[0]||'')[0]||'')+((w[1]||'')[0]||''))||(n||'?').slice(0,2)).toUpperCase(); };
    const haLabel = ha => ha ? (ha==='home'?tt('calendar.home','Home'):ha==='away'?tt('calendar.away','Away'):cap(ha)) : '';

    const club = window._calClub || {};
    let accent = club.primary_color || club.accent_color || '';
    accent = /^#?[0-9a-fA-F]{6}$/.test(accent) ? (accent[0]==='#'?accent:'#'+accent) : '#15803D';
    const clubName = club.name || tt('calendar.print_club_fallback','Club');
    const teamName = (_myTeams||[]).find(t=>t.id===_activeTeamId)?.name || '';
    const mc = calCurrentMc();

    // 7 (or N) days of the microcycle
    const days = [];
    if (mc && mc.start_date && mc.end_date) {
      let d = mc.start_date;
      for (let i=0; i<14 && d <= mc.end_date; i++) { days.push(d); d = addDays(d,1); }
    }

    // events for the MC
    let events = [];
    if (mc) { try { const r = await fetchAllEvents(mc.start_date, mc.end_date); events = (r && r.data) || []; } catch(_){} }
    const byDay = {};
    days.forEach(d => byDay[d] = []);
    events.forEach(e => { const d = e.session_date; if (d) (byDay[d] = byDay[d] || []).push(e); });
    Object.values(byDay).forEach(arr => arr.sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')));
    const sessCount = events.filter(e => e.session_type !== 'day_off').length;

    // 1) Letterhead
    const crest = club.logo_url
      ? `<img src="${esc(club.logo_url)}" alt="" style="width:46px;height:46px;border-radius:50%;object-fit:cover;display:block">`
      : `<div style="width:46px;height:46px;border-radius:50%;background:var(--club-accent);color:#fff;display:flex;align-items:center;justify-content:center;font:700 17px ${FONT}">${esc(mono(clubName))}</div>`;
    const head = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div style="display:flex;align-items:center;gap:12px">${crest}
        <div><div style="font:700 16px ${FONT};color:#15181D">${esc(clubName)}</div>
        ${teamName?`<div style="font:600 10.5px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#8A93A0;margin-top:2px">${esc(teamName)}</div>`:''}</div>
      </div>
      <div style="text-align:right">
        <div style="font:800 13px ${FONT};letter-spacing:.1em;text-transform:uppercase;color:var(--club-accent)">${esc(tt('calendar.print_microcycle','Microcycle'))}</div>
        ${mc?.name?`<div style="font:700 15px ${FONT};color:#15181D;margin-top:2px">${esc(mc.name)}</div>`:''}
        ${mc?`<div style="font:500 11px ${MONO};color:#5B6470;margin-top:2px">${esc(calFmtRange(mc.start_date,mc.end_date))}</div>`:''}
      </div>
    </div><div style="height:2px;background:#15181D;margin:10px 0 12px"></div>`;

    // 2) Micro summary strip
    const stripDefs = [];
    if (mc?.rival) {
      const bits = [haLabel(mc.home_away), mc.match_date?fmtDow(mc.match_date):'', mc.match_time?_fmtTime(mc.match_time):''].filter(Boolean);
      stripDefs.push({ fr:2, html:`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="background:#FCE9E9;color:#991B1B;border:1px solid #F1B9B9;font:700 8.5px ${MONO};letter-spacing:.05em;padding:2px 6px;border-radius:4px">MATCH</span>
        <span style="font:700 12px ${FONT};color:#15181D">vs ${esc(mc.rival)}</span>
        ${bits.length?`<span style="font:500 11px ${MONO};color:#5B6470">· ${esc(bits.join(' · '))}</span>`:''}
      </div>` });
    }
    if (sessCount) {
      stripDefs.push({ fr:1, html:`<div style="font:600 8px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">${esc(tt('calendar.print_sessions','Sessions'))}</div>
        <div style="font:700 13px ${MONO};color:#15181D;margin-top:2px">${sessCount} <span style="color:#9CA3AF;font-weight:500;font-size:10px">${esc(tt('calendar.print_in_days','in {n} days',{n:days.length||7}))}</span></div>` });
    }
    const microStrip = stripDefs.length ? `<div style="display:grid;grid-template-columns:${stripDefs.map(d=>d.fr+'fr').join(' ')};gap:1px;background:#E7E7E4;border:1px solid #E7E7E4;border-radius:9px;overflow:hidden;margin-bottom:12px">
      ${stripDefs.map(d=>`<div style="background:#fff;padding:8px 12px">${d.html}</div>`).join('')}</div>` : '';

    // 3) Week grid
    const dayOffCard = `<div style="border:1px dashed #D8DCE0;border-radius:6px;padding:6px 8px;display:flex;align-items:center;justify-content:space-between;gap:6px">
      <span style="font:italic 500 10px ${FONT};color:#9CA3AF">${esc(tt('calendar.print_day_off','Day off'))}</span>
      <span style="font:700 7.5px ${MONO};color:#9CA3AF;border:1px dashed #C9CDD3;padding:1px 5px;border-radius:3px">OFF</span></div>`;
    const cardHtml = e => {
      const meta = calCardMeta(e);
      const isMatch = e.session_type === 'match';
      const isMand  = e.session_type === 'prevention' && e.is_mandatory;
      const time = _fmtTime(e.start_time);
      const title = isMatch ? `vs ${esc(e.opponent || e.title || tt('calendar.match_word','Match'))}` : esc(e.title || calMetaLabel(e.session_type));
      const subRaw = isMatch
        ? [haLabel(e.home_away), e.competition||''].filter(Boolean).join(' · ')
        : (e.notes || '');
      // El preventivo obligatorio se lee como el partido: fondo y texto en rojo, más un
      // asterisco que remite a la nota al pie (junto a la leyenda de colores).
      return `<div style="background:${isMand?meta.bg:'#FBFBFA'};border:1px solid ${isMand?meta.bd:'#ECECE9'};border-left:3px solid ${meta.fg};border-radius:6px;padding:6px 8px;break-inside:avoid">
        <div style="display:flex;align-items:center;gap:5px">
          ${time?`<span style="font:500 9.5px ${MONO};color:${isMand?meta.fg:'#8A93A0'}">${esc(time)}</span>`:''}
          <span style="margin-left:auto;background:${isMand?'#fff':meta.bg};color:${meta.fg};border:1px solid ${meta.bd};font:700 7.5px ${MONO};letter-spacing:.04em;padding:1px 5px;border-radius:3px">${esc(meta.abbr)}${isMand?' *':''}</span>
        </div>
        <div style="font:${isMand?700:600} 11px ${FONT};color:${isMatch||isMand?meta.fg:'#15181D'};margin-top:3px">${title}${isMand?' *':''}</div>
        ${subRaw?`<div style="font:500 8.5px ${MONO};color:${isMand?meta.fg:'#9CA3AF'};margin-top:2px">${esc(subRaw)}</div>`:''}
      </div>`;
    };
    const dayCol = ds => {
      const dt = new Date(ds+'T12:00:00');
      const wd = dt.toLocaleDateString(ttLocale(),{weekday:'short'}).toUpperCase();
      const md = calMdForDate(ds, mc);
      const list = byDay[ds] || [];
      const cards = list.filter(e => !_isFullDayOff(e)).map(cardHtml).join('');
      const body = cards || dayOffCard;
      return `<div style="background:#fff;display:flex;flex-direction:column">
        <div style="background:#FAFAF8;padding:6px 7px;border-bottom:1px solid #ECECE9;display:flex;align-items:center;justify-content:space-between;gap:4px">
          <span style="font:600 8.5px ${MONO};letter-spacing:.05em;text-transform:uppercase;color:#9CA3AF">${esc(wd)}</span>
          <span style="display:flex;align-items:center;gap:5px">${md?`<span style="font:600 8px ${MONO};background:#EFEFEC;color:#5B6470;padding:1px 5px;border-radius:4px">${esc(md)}</span>`:''}<span style="font:700 14px ${MONO};color:#15181D">${dt.getDate()}</span></span>
        </div>
        <div style="padding:5px;display:flex;flex-direction:column;gap:5px;flex:1">${body}</div>
      </div>`;
    };
    const weekGrid = days.length
      ? `<div style="display:grid;grid-template-columns:repeat(${days.length},1fr);gap:1px;background:#E7E7E4;border:1px solid #E7E7E4;border-radius:9px;overflow:hidden;margin-bottom:12px">${days.map(dayCol).join('')}</div>`
      : `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font:500 12px ${FONT}">${esc(tt('calendar.print_no_mc_selected','No microcycle selected.'))}</div>`;

    // 4) Footer (legend + club·team, then mono line)
    const legendTypes = [['Training','training'],['Gym','gym'],['Match','match'],['Recovery','recovery'],['Prevention','prevention'],['Meeting','meeting'],['Meal','breakfast'],['Video','video']];
    const legend = legendTypes.map(([lab,t])=>{ const m=CAL_TYPE_META[t]; return `<span style="display:inline-flex;align-items:center;gap:4px;font:500 9px ${FONT};color:#5B6470"><span style="width:9px;height:9px;border-radius:2px;background:${m.bg};border:1px solid ${m.bd}"></span>${esc(calMetaLabel(t))}</span>`; }).join('')
      // El asterisco de la tarjeta se explica acá, al lado de los colores, y solo si la
      // semana tiene algún preventivo obligatorio.
      + (calHasMandatory(byDay) ? `<span style="display:inline-flex;align-items:center;gap:4px;font:600 9px ${FONT};color:${CAL_TYPE_META._mandatory.fg}"><span style="font:700 10px ${MONO}">*</span>${esc(tt('calendar.mandatory_attendance','Attendance is mandatory'))}</span>` : '');
    const footMid = [];
    if (mc?.name) footMid.push(mc.name);
    if (mc) footMid.push(calFmtRange(mc.start_date, mc.end_date));
    if (mc?.rival) footMid.push(`vs ${mc.rival}${mc.home_away?` (${mc.home_away==='home'?'H':'A'})`:''}`);
    const footer = `<div style="margin-top:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
        <div style="display:flex;flex-wrap:wrap;gap:10px">${legend}</div>
        <div style="font:600 9.5px ${MONO};color:#8A93A0">${esc(clubName)}${teamName?' · '+esc(teamName):''}</div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px;padding-top:8px;border-top:1px solid #E7E7E4;font:500 9.5px ${MONO};color:#A3AAB3">
        <span>${esc(tt('calendar.print_footer_week','ClavaMetrics · Microcycle Week Plan'))}</span>
        <span>${esc(footMid.join(' · '))}</span>
      </div>
    </div>`;

    host.innerHTML = `<div class="cal-sheet" style="--club-accent:${accent};width:1123px;height:794px;background:#fff;padding:30px 34px 22px;box-sizing:border-box;font:400 12px/1.45 ${FONT};color:#15181D;display:flex;flex-direction:column;margin:0 auto">
      ${head}${microStrip}${weekGrid}${footer}
    </div>`;
  } catch (e) {
    console.warn('calBuildWeekSheet failed', e);
  }
}

async function calBuildMonthSheet(){
  const host = document.getElementById('calPrintSheet');
  if (!host) return;
  try {
    const FONT = "'Geist',system-ui,sans-serif", MONO = "'Geist Mono',ui-monospace,monospace";
    const esc = calEsc;
    const pad = n => String(n).padStart(2,'0');
    const mono = n => { const w=(n||'').trim().split(/\s+/).filter(Boolean); return ((((w[0]||'')[0]||'')+((w[1]||'')[0]||''))||(n||'?').slice(0,2)).toUpperCase(); };

    const club = window._calClub || {};
    let accent = club.primary_color || club.accent_color || '';
    accent = /^#?[0-9a-fA-F]{6}$/.test(accent) ? (accent[0]==='#'?accent:'#'+accent) : '#15803D';
    const clubName = club.name || tt('calendar.print_club_fallback','Club');
    const teamName = (_myTeams||[]).find(t=>t.id===_activeTeamId)?.name || '';

    const y = _monthY, m = _monthM;
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();
    const monthStart = `${y}-${pad(m+1)}-01`;
    const monthEnd   = `${y}-${pad(m+1)}-${pad(daysInMonth)}`;
    const monthLabel = new Date(y, m, 1).toLocaleDateString(ttLocale(),{month:'long',year:'numeric'});
    const leadingBlanks = (new Date(y, m, 1).getDay()+6)%7;   // Monday-first
    const _t = new Date(); const todayStr = `${_t.getFullYear()}-${pad(_t.getMonth()+1)}-${pad(_t.getDate())}`;

    // events for the month
    let events = [];
    try { const r = await fetchAllEvents(monthStart, monthEnd); events = (r && r.data) || []; } catch(_){}
    const byDay = {};
    events.forEach(e => { const d = e.session_date; if (d) (byDay[d] = byDay[d] || []).push(e); });
    Object.values(byDay).forEach(arr => arr.sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')));
    const mcForDate = ds => (_allMCs||[]).find(x => x.start_date <= ds && ds <= x.end_date) || null;

    // build cells: leading (prev month) + in-month + trailing (next month), padded to whole weeks
    const cells = [];
    for (let i=0;i<leadingBlanks;i++) cells.push({ day: prevMonthDays - leadingBlanks + 1 + i, inMonth:false });
    for (let d=1; d<=daysInMonth; d++) cells.push({ day:d, inMonth:true, ds:`${y}-${pad(m+1)}-${pad(d)}` });
    let tnext = 1;
    while (cells.length % 7 !== 0) cells.push({ day: tnext++, inMonth:false });

    // 1) Letterhead
    const crest = club.logo_url
      ? `<img src="${esc(club.logo_url)}" alt="" style="width:46px;height:46px;border-radius:50%;object-fit:cover;display:block">`
      : `<div style="width:46px;height:46px;border-radius:50%;background:var(--club-accent);color:#fff;display:flex;align-items:center;justify-content:center;font:700 17px ${FONT}">${esc(mono(clubName))}</div>`;
    const head = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div style="display:flex;align-items:center;gap:12px">${crest}
        <div><div style="font:700 16px ${FONT};color:#15181D">${esc(clubName)}</div>
        ${teamName?`<div style="font:600 10.5px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#8A93A0;margin-top:2px">${esc(teamName)}</div>`:''}</div>
      </div>
      <div style="text-align:right">
        <div style="font:800 13px ${FONT};letter-spacing:.1em;text-transform:uppercase;color:var(--club-accent)">${esc(tt('calendar.print_training_plan','Training plan'))}</div>
        <div style="font:700 15px ${MONO};color:#15181D;margin-top:2px">${esc(monthLabel)}</div>
      </div>
    </div><div style="height:2px;background:#15181D;margin:10px 0 12px"></div>`;

    // 2) Weekday header (Mon-first, SAT accented)
    const wds = [1,2,3,4,5,6,0].map(dow => dayShort(dow).toUpperCase());
    const wdHeader = `<div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px">${
      wds.map((w,i)=>`<div style="font:700 9.5px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:${i===5?'var(--club-accent)':'#9CA3AF'};padding:0 7px">${w}</div>`).join('')}</div>`;

    // 3) Month grid
    const dayOffPill = `<div style="display:flex;align-items:center;padding:2px 5px;border-radius:5px;border:1px dashed #D8DCE0;color:#9CA3AF;font:italic 600 9px ${FONT}">OFF</div>`;
    const pill = e => {
      if (_isFullDayOff(e)) return dayOffPill;
      const meta = calCardMeta(e);
      const t = _fmtTime(e.start_time);
      const nm = (e.session_type === 'match'
        ? ('vs ' + (e.opponent || e.title || tt('calendar.match_word','Match')))
        : (e.title || calMetaLabel(e.session_type) || meta.abbr))
        + (e.session_type === 'prevention' && e.is_mandatory ? ' *' : '');
      const marker = (e.session_type === 'match' && e.rival_crest_url)
        ? `<img src="${esc(e.rival_crest_url)}" alt="" style="width:11px;height:11px;border-radius:2px;object-fit:contain;flex:none;background:#fff">`
        : `<span style="width:6px;height:6px;border-radius:50%;background:${meta.fg};flex:none"></span>`;
      return `<div style="display:flex;align-items:center;gap:4px;padding:2px 5px;border-radius:5px;background:${meta.bg};border:1px solid ${meta.bd};color:${meta.fg};font:600 9px ${FONT};overflow:hidden;white-space:nowrap">
        ${marker}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1">${esc(nm)}</span>
        ${t?`<span style="margin-left:auto;font:500 8.5px ${MONO};opacity:.7;flex:none">${esc(t)}</span>`:''}
      </div>`;
    };
    const CAP = 4;
    const dayCell = c => {
      if (!c.inMonth) return `<div style="background:#fff;padding:7px"><div style="font:600 12px ${MONO};color:#C8CDD3">${c.day}</div></div>`;
      const list = byDay[c.ds] || [];
      const isToday = c.ds === todayStr;
      const hasMatch = list.some(e => e.session_type === 'match');
      const md = hasMatch ? (calMdForDate(c.ds, mcForDate(c.ds)) || 'MD') : '';
      const shown = list.slice(0, CAP);
      const extra = list.length - shown.length;
      return `<div style="background:#fff;padding:7px;display:flex;flex-direction:column;gap:3px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
          <span style="font:600 12px ${MONO};color:${isToday?'var(--club-accent)':'#15181D'}">${c.day}</span>
          ${md?`<span style="font:600 8px ${MONO};background:#EFEFEC;color:#5B6470;padding:1px 5px;border-radius:4px">${esc(md)}</span>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;overflow:hidden">${shown.map(pill).join('')}${extra>0?`<div style="font:600 8.5px ${MONO};color:#9CA3AF;padding:1px 5px">+${extra}</div>`:''}</div>
      </div>`;
    };
    const grid = `<div style="flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:1px;background:#E7E7E4;border:1px solid #E7E7E4;border-radius:8px;overflow:hidden;margin-bottom:12px">${cells.map(dayCell).join('')}</div>`;

    // 4) Footer
    const legendTypes = [['Training','training'],['Gym','gym'],['Match','match'],['Recovery','recovery'],['Prevention','prevention'],['Meeting','meeting'],['Meal','breakfast'],['Video','video']];
    const legend = legendTypes.map(([lab,t])=>{ const meta=CAL_TYPE_META[t]; return `<span style="display:inline-flex;align-items:center;gap:4px;font:500 9px ${FONT};color:#5B6470"><span style="width:9px;height:9px;border-radius:2px;background:${meta.bg};border:1px solid ${meta.bd}"></span>${esc(calMetaLabel(t))}</span>`; }).join('')
      + (calHasMandatory(byDay) ? `<span style="display:inline-flex;align-items:center;gap:4px;font:600 9px ${FONT};color:${CAL_TYPE_META._mandatory.fg}"><span style="font:700 10px ${MONO}">*</span>${esc(tt('calendar.mandatory_attendance','Attendance is mandatory'))}</span>` : '');
    const footer = `<div style="margin-top:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
        <div style="display:flex;flex-wrap:wrap;gap:10px">${legend}</div>
        <div style="font:600 9.5px ${MONO};color:#8A93A0">${esc(clubName)}${teamName?' · '+esc(teamName):''}</div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px;padding-top:8px;border-top:1px solid #E7E7E4;font:500 9.5px ${MONO};color:#A3AAB3">
        <span>${esc(tt('calendar.print_footer_month','ClavaMetrics · Monthly Training Plan'))}</span>
        <span>${esc(monthLabel)}</span>
        <span>${esc(clubName)}${teamName?' · '+esc(teamName):''}</span>
      </div>
    </div>`;

    host.innerHTML = `<div class="cal-sheet" style="--club-accent:${accent};width:1123px;height:794px;background:#fff;padding:30px 34px 22px;box-sizing:border-box;font:400 12px/1.45 ${FONT};color:#15181D;display:flex;flex-direction:column;margin:0 auto">
      ${head}${wdHeader}${grid}${footer}
    </div>`;
  } catch (e) {
    console.warn('calBuildMonthSheet failed', e);
  }
}

async function calRenderPrintSheet(){
  if (_calView === 'month') await calBuildMonthSheet();
  else await calBuildWeekSheet();   // microcycle / list / player
}

async function exportPDF() {
  await calRenderPrintSheet();
  window.print();
}
window.addEventListener('beforeprint', () => { calRenderPrintSheet(); });

async function exportPNG() {
  // Lazy-load html2canvas
  if (!window.html2canvas) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('html2canvas load failed'));
      document.head.appendChild(s);
    }).catch(() => null);
  }
  if (!window.html2canvas) { showCalToast(tt('calendar.export_lib_failed','Could not load image export library.')); return; }

  const prevView = _calView;
  if (_calView !== 'player') { _calView = 'player'; renderGrid(); }

  const grid = document.getElementById('calDaysGrid');
  try {
    const canvas = await window.html2canvas(grid, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const mc = _allMCs[_mcIdx];
    const link = document.createElement('a');
    link.download = `schedule-players-${mc?.name || 'week'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showCalToast(tt('calendar.image_exported','Image exported.'));
  } catch (e) {
    showCalToast(tt('calendar.export_failed','Export failed: {msg}',{msg:e.message}));
  }

  if (prevView !== 'player') { setTimeout(() => { _calView = prevView; renderGrid(); }, 100); }
}

// ═══════════════════════════════════════════════════════════════
//  Day Sheet — build tomorrow's plan to send players (PNG / PDF)
// ═══════════════════════════════════════════════════════════════
let _dsState = null, _dsBound = false;

// Iconos de la hoja del día: los oficiales de Tabler, los mismos que usan los eventos del
// Calendar. Van inline (no por webfont) porque la hoja se exporta con html2canvas y un
// glifo de fuente no siempre sobrevive al clon. El comentario dice de qué ti-* sale cada uno.
const DS_ICONS = {
  departure:'<path d="M6 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M18 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M4 17h-2v-11a1 1 0 0 1 1 -1h14a5 7 0 0 1 5 7v5h-2m-4 0h-8"/> <path d="M16 5l1.5 7l4.5 0"/> <path d="M2 10l15 0"/> <path d="M7 5l0 5"/> <path d="M12 5l0 5"/>', // ti-bus
  arrival:'<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/> <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>', // ti-map-pin
  activation:'<path d="M3 12h4l3 8l4 -16l3 8h4"/>', // ti-activity
  training:'<path d="M21 5.002v.5l-8.13 14.99a1 1 0 0 1 -1.74 0l-8.13 -14.989v-.5c0 -1.659 4.03 -3.003 9 -3.003s9 1.344 9 3.002"/>', // ti-cone-2
  gym:'<path d="M2 12h1"/> <path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/> <path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z"/> <path d="M9 12h6"/> <path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z"/> <path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/> <path d="M22 12h-1"/>', // ti-barbell
  meal:'<path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zm0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"/>', // ti-tools-kitchen-2
  meeting:'<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/> <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/> <path d="M16 3.13a4 4 0 0 1 0 7.75"/> <path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/>', // ti-users
  video:'<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z"/> <path d="M7 20h10"/> <path d="M9 16v4"/> <path d="M15 16v4"/>', // ti-device-desktop
  travel:'<path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3z"/>', // ti-plane
  kickoff:'<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/> <path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55z"/> <path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45"/>', // ti-ball-football
  recovery:'<path d="M3 4m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/> <path d="M7 20h10"/> <path d="M9 16v4"/> <path d="M15 16v4"/> <path d="M7 10h2l2 3l2 -6l1 3h3"/>', // ti-heart-rate-monitor
  meds:'<path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1"/> <path d="M8 15a6 6 0 1 0 12 0v-3"/> <path d="M11 3v2"/> <path d="M6 3v2"/> <path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>', // ti-stethoscope
  physio:'<path d="M9 15l-1 -3l4 -2l4 1h3.5"/> <path d="M4 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M12 6m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M12 17v-7"/> <path d="M8 20h7l1 -4l4 -2"/> <path d="M18 20h3"/>', // ti-physotherapist
  custom:'<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>', // ti-circle-dot
  // --- extra glyphs, pickable per timeline row (override the type icon) ---
  bus:'<path d="M6 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M18 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M4 17h-2v-11a1 1 0 0 1 1 -1h14a5 7 0 0 1 5 7v5h-2m-4 0h-8"/> <path d="M16 5l1.5 7l4.5 0"/> <path d="M2 10l15 0"/> <path d="M7 5l0 5"/> <path d="M12 5l0 5"/>', // ti-bus
  car:'<path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/>', // ti-car
  train:'<path d="M21 13c0 -3.87 -3.37 -7 -10 -7h-8"/> <path d="M3 15h16a2 2 0 0 0 2 -2"/> <path d="M3 6v5h17.5"/> <path d="M3 10l0 4"/> <path d="M8 11l0 -5"/> <path d="M13 11l0 -4.5"/> <path d="M3 19l18 0"/>', // ti-train
  hotel:'<path d="M7 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/> <path d="M22 17v-3h-20"/> <path d="M2 8v9"/> <path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5z"/>', // ti-bed
  coffee:'<path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1"/> <path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/> <path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/> <path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z"/> <path d="M16.746 16.726a3 3 0 1 0 .252 -5.555"/>', // ti-coffee
  water:'<path d="M10 5h4v-2a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v2z"/> <path d="M14 3.5c0 1.626 .507 3.212 1.45 4.537l.05 .07a8.093 8.093 0 0 1 1.5 4.694v6.199a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-6.2c0 -1.682 .524 -3.322 1.5 -4.693l.05 -.07a7.823 7.823 0 0 0 1.45 -4.537"/> <path d="M7 14.803a2.4 2.4 0 0 0 1 -.803a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 1 -.805"/>', // ti-bottle
  snack:'<path d="M4 11.319c0 3.102 .444 5.319 2.222 7.978c1.351 1.797 3.156 2.247 5.08 .988c.426 -.268 .97 -.268 1.397 0c1.923 1.26 3.728 .809 5.079 -.988c1.778 -2.66 2.222 -4.876 2.222 -7.977c0 -2.661 -1.99 -5.32 -4.444 -5.32c-1.267 0 -2.41 .693 -3.22 1.44a.5 .5 0 0 1 -.672 0c-.809 -.746 -1.953 -1.44 -3.22 -1.44c-2.454 0 -4.444 2.66 -4.444 5.319"/> <path d="M7 12c0 -1.47 .454 -2.34 1.5 -3"/> <path d="M12 7c0 -1.2 .867 -4 3 -4"/>', // ti-apple
  ice:'<path d="M10 4l2 1l2 -1"/> <path d="M12 2v6.5l3 1.72"/> <path d="M17.928 6.268l.134 2.232l1.866 1.232"/> <path d="M20.66 7l-5.629 3.25l.01 3.458"/> <path d="M19.928 14.268l-1.866 1.232l-.134 2.232"/> <path d="M20.66 17l-5.629 -3.25l-2.99 1.738"/> <path d="M14 20l-2 -1l-2 1"/> <path d="M12 22v-6.5l-3 -1.72"/> <path d="M6.072 17.732l-.134 -2.232l-1.866 -1.232"/> <path d="M3.34 17l5.629 -3.25l-.01 -3.458"/> <path d="M4.072 9.732l1.866 -1.232l.134 -2.232"/> <path d="M3.34 7l5.629 3.25l2.99 -1.738"/>', // ti-snowflake
  pitch:'<path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/> <path d="M3 9h3v6h-3z"/> <path d="M18 9h3v6h-3z"/> <path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/> <path d="M12 5l0 14"/>', // ti-soccer-field
  run:'<path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M4 17l5 1l.75 -1.5"/> <path d="M15 21l0 -4l-4 -3l1 -6"/> <path d="M7 12l0 -3l5 -1l3 3l3 1"/>', // ti-run
  stretch:'<path d="M16 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M5 20l5 -.5l1 -2"/> <path d="M18 20v-5h-5.5l2.5 -6.5l-5.5 1l1.5 2"/>', // ti-stretching
  bolt:'<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>', // ti-bolt
  tactics:'<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/> <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/> <path d="M9 12l.01 0"/> <path d="M13 12l2 0"/> <path d="M9 16l.01 0"/> <path d="M13 16l2 0"/>', // ti-clipboard-list
  mic:'<path d="M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z"/> <path d="M5 10a7 7 0 0 0 14 0"/> <path d="M8 21l8 0"/> <path d="M12 17l0 4"/>', // ti-microphone
  flag:'<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z"/> <path d="M5 21v-7"/>', // ti-flag
  sun:'<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/> <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>', // ti-sun
  moon:'<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>', // ti-moon
  clock:'<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/> <path d="M12 7v5l3 3"/>', // ti-clock
};
const DS_TYPES = ['departure','arrival','activation','training','gym','meal','meeting','video','travel','kickoff','recovery','meds','custom'];
// Icon picker: order shown in the per-moment popover ('' = follow the type).
const DS_ICON_CHOICES = ['bus','car','train','travel','hotel','meal','coffee','water','snack','ice','training','pitch','gym','kickoff','run','stretch','bolt','activation','recovery','meds','physio','meeting','video','tactics','mic','flag','sun','moon','clock','departure','arrival','custom'];
function dsGlyph(key){ return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${DS_ICONS[key]||DS_ICONS.custom}</svg>`; }
function dsRowIcon(r){ return dsGlyph(r.icon || (r.match ? 'kickoff' : r.type)); }
const DS_SWATCHES = ['#2F5FD0','#8AC4EA','#12833E','#C81E3A','#0E1C3F','#E8820C','#111827','#7A2AA8'];

function dsTypeLabel(t){ return tt('calendar.daysheet.type_'+t, ({departure:'Departure',arrival:'Arrival',activation:'Activation',training:'Training',gym:'Gym',meal:'Meal',meeting:'Meeting',video:'Video',travel:'Travel',kickoff:'Kick-off',recovery:'Recovery',meds:'Medical',custom:'Other'})[t] || t); }
function dsAddDays(ymd, n){ const d = new Date(ymd+'T12:00:00'); d.setDate(d.getDate()+n); return cmYMD(d); }
// Default day-sheet date: keep showing TODAY until today's planned training has finished,
// then roll to tomorrow. End = start_time + duration; if no duration, start + 3h. A day with
// no scheduled training (e.g. match day / day off) rolls to tomorrow as before.
async function dsDefaultDate(){
  try {
    const r = await fetchAllEvents(TODAY, TODAY);
    const trainings = ((r && r.data) || []).filter(e =>
      e.source === 'session' && e.start_time && !['match','day_off'].includes(e.session_type));
    if (trainings.length){
      const now = new Date();
      let latestEnd = null;
      trainings.forEach(e => {
        const [hh, mm] = String(e.start_time).slice(0,5).split(':').map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh||0, mm||0, 0, 0);
        const dur = Number(e.duration) > 0 ? Number(e.duration) : 180;
        const end = new Date(start.getTime() + dur*60000);
        if (!latestEnd || end > latestEnd) latestEnd = end;
      });
      if (latestEnd && now < latestEnd) return TODAY;
    }
  } catch(_){}
  return dsAddDays(TODAY, 1);
}
function dsReadableOn(hex){ const h=hex.replace('#',''); const f=i=>parseInt(h.slice(i,i+2),16)/255; const lin=c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4); const L=.2126*lin(f(0))+.7152*lin(f(2))+.0722*lin(f(4)); return L>.55?'#14171C':'#ffffff'; }
function dsInitials(name){ const w=(name||'').trim().split(/\s+/); return (((w[0]||'')[0]||'')+((w[1]||'')[0]||'')||(name||'?').slice(0,2)).toUpperCase(); }
function dsTint(hex, amt){ const h=/^#[0-9a-fA-F]{6}$/.test(hex)?hex:'#2F5FD0'; const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); const m=c.map(v=>Math.round(v*amt+255*(1-amt))); return '#'+m.map(v=>v.toString(16).padStart(2,'0')).join(''); }
// ── Kit / uniforme ────────────────────────────────────────────
// Bloque fijo de la hoja (se incluye o no con un botón): camiseta, pantalón y
// calcetines, cada prenda con su color. Un juego para el calentamiento y otro
// para el partido — el de partido sólo se dibuja los días que hay partido.
const DS_KIT_PIECES = ['shirt','shorts','socks'];
const DS_KIT_GROUPS = ['warmup','match','gkWarmup','gkMatch'];
const DS_KIT_SVG = {
  shirt: '<path d="M17.5 5 23 3c1.1 2.6 6.9 2.6 8 0l5.5 2 8.5 5.2-4.6 8.2-3.4-2V43H14.5V16.4l-3.4 2L6.5 10.2 15 5Z"/>',
  shorts:'<path d="M8.5 12h31l3 30H28.5l-4.5-17-4.5 17H5.5Z"/>',
  socks: '<path d="M10.5 6h10v31a5 5 0 0 1-10 0Z"/><path d="M27.5 6h10v31a5 5 0 0 1-10 0Z"/><path d="M10.5 12.5h10M27.5 12.5h10" stroke-width="1.4"/>',
};
// El golero lleva la camiseta de manga larga: misma silueta, mangas hasta el puño,
// para que se distinga de un vistazo de la del jugador de campo.
const DS_GK_SVG = {
  shirt: '<path d="M16 5 21 3c1.2 2.6 7.6 2.6 8.8 0L35 5 45 10.5 40.5 38 35.4 37.2 35 18V43H16V18l-.4 19.2L10.5 38 6 10.5Z"/>',
};
// Paleta fija de colores de camiseta (los habituales del fútbol) para no tener que
// buscar el tono en el cuadrante del selector nativo cada vez.
const DS_KIT_COLOURS = ['#FFFFFF','#E8E8E8','#9AA0A6','#111111','#C81E3A','#7E1220','#E8820C','#F2C230','#D8F53A','#1FA84C','#0B5C2E','#8AC4EA','#2F5FD0','#0E1C3F','#7A2AA8','#8C5A2B'];
function dsKitDefaults(accent){
  const a = /^#[0-9a-fA-F]{6}$/.test(accent||'') ? accent : '#2F5FD0';
  const gk = { shirt:'#1FA84C', shorts:'#111111', socks:'#111111' };
  return { on:true, matchOn:true, gkOn:true,
    warmup:{ shirt:a, shorts:'#FFFFFF', socks:a },
    match: { shirt:a, shorts:'#FFFFFF', socks:a },
    gkWarmup:{ ...gk }, gkMatch:{ ...gk } };
}
function dsKitNorm(k, accent){
  const d = dsKitDefaults(accent);
  const out = { on:k ? k.on !== false : true, matchOn:k ? k.matchOn !== false : true, gkOn:k ? k.gkOn !== false : true };
  DS_KIT_GROUPS.forEach(g => {
    out[g] = { ...d[g] };
    DS_KIT_PIECES.forEach(p => {
      const v = k && k[g] && k[g][p];
      if (/^#[0-9a-fA-F]{6}$/.test(v||'')) out[g][p] = v;
    });
  });
  return out;
}
function dsKitIsGk(group){ return String(group||'').startsWith('gk'); }
function dsKitGkGroup(group){ return group === 'match' ? 'gkMatch' : 'gkWarmup'; }
// Prenda dibujada: relleno del color elegido + contorno que se vea sobre claro y oscuro.
function dsKitPiece(piece, colour, size, gk){
  const c = /^#[0-9a-fA-F]{6}$/.test(colour||'') ? colour : '#FFFFFF';
  const stroke = dsReadableOn(c) === '#14171C' ? '#A9AFB8' : 'rgba(255,255,255,.45)';
  const path = (gk && DS_GK_SVG[piece]) || DS_KIT_SVG[piece];
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="${c}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round">${path}</svg>`;
}
// Colores guardados por el club (se persisten con la plantilla del equipo).
function dsPalette(){ return (_dsState && Array.isArray(_dsState.kitPalette)) ? _dsState.kitPalette : []; }
function dsPaletteAdd(hex){
  if (!/^#[0-9a-fA-F]{6}$/.test(hex||'')) return;
  const h = hex.toUpperCase();
  const list = dsPalette().filter(c => c.toUpperCase() !== h);
  list.unshift(h);
  _dsState.kitPalette = list.slice(0, 12);
}
function dsPaletteRemove(hex){
  _dsState.kitPalette = dsPalette().filter(c => c.toUpperCase() !== String(hex||'').toUpperCase());
}
// Tras re-renderizar el editor, dejar abierta la paleta de la prenda que se estaba tocando.
function dsReopenKitPop(id){
  if (!id) return;
  const pop = document.querySelector(`#dsEditor .ds-kitpop[data-kitpop="${id}"]`);
  if (pop){ pop.hidden = false; try { pop.scrollIntoView({ block:'nearest' }); } catch(_){} }
}
function dsMapType(st){ return ({training:'training',tactical:'training',beach:'training',outdoor:'training',gym:'gym',match:'kickoff',recovery:'recovery',travel:'travel',meeting:'meeting',video:'video',video_session:'video',breakfast:'meal',lunch:'meal',dinner:'meal',snack:'meal',bus_departure:'departure',bus_arrival:'arrival',hotel_checkin:'travel',hotel_checkout:'travel',press:'meeting',medical_check:'meds',physio:'meds',prevention:'gym',prehab:'activation',warmup:'activation',walkthrough:'meeting',scouting:'meeting',evaluation:'custom',day_off:'custom'})[st] || 'custom'; }
// Icono específico por tipo de evento del Calendar (pisa el icono genérico del type)
const DS_EVT_ICONS = { bus_departure:'bus', bus_arrival:'bus', hotel_checkin:'hotel', hotel_checkout:'hotel', press:'mic', physio:'physio', walkthrough:'tactics', scouting:'flag', evaluation:'bolt', day_off:'sun', snack:'snack', prehab:'stretch', warmup:'run' };
function dsEvLabel(e){ if (e.session_type === 'match') return (tt('calendar.daysheet.vs','vs')+' '+(e.opponent||e.title||'')).trim(); return e.title || calMetaLabel(e.session_type); }

async function dsInlineImg(url){
  if (!url || url.startsWith('data:')) return url;
  try {
    const r = await fetch(url, { mode:'cors' }); const b = await r.blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(url); fr.readAsDataURL(b); });
  } catch(_) { return url; }
}

function dsMcForDate(dateStr){ return (_allMCs||[]).find(m => m.start_date && m.end_date && m.start_date <= dateStr && dateStr <= m.end_date) || null; }
function dsSyncDate(){
  const ds = _dsState.date;
  try { _dsState.dateLine = new Date(ds+'T12:00:00').toLocaleDateString(dsLang(), { weekday:'long', day:'numeric', month:'long' }).replace(/^\w/, c => c.toUpperCase()); } catch(_){ _dsState.dateLine = ds; }
  _dsState.tag = calMdForDate(ds, dsMcForDate(ds)) || '';
}

async function dsPrefillFromEvents(){
  let data = [];
  try { const r = await fetchAllEvents(_dsState.date, _dsState.date); data = (r && r.data) || []; } catch(_){}
  const evs = data.filter(e => e.session_type !== 'day_off');
  // Match of the day → dedicated block with rival crest (not a timeline row)
  const matchEv = evs.find(e => e.session_type === 'match');
  if (matchEv){
    _dsState.match = {
      opponent: matchEv.opponent || matchEv.title || '',
      crest: await dsInlineImg(matchEv.rival_crest_url || null),
      homeAway: matchEv.home_away || '', competition: matchEv.competition || '',
      time: _fmtTime(matchEv.start_time) || '',
    };
  } else _dsState.match = null;
  const timed = evs.filter(e => e.start_time && e.session_type !== 'match').sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));
  _dsState.tl = timed.map(e => ({ t:_fmtTime(e.start_time), type:dsMapType(e.session_type), icon:DS_EVT_ICONS[e.session_type]||'', label:dsEvLabel(e), sub:e.notes || e.location || '' }));
  // Partido con hora → además del bloque destacado, una fila de kick-off en su horario:
  // el jugador lee el día entero en una sola lista (activación, calentamiento, kick-off).
  // Se arma desde matchEv y no desde el filtro para no repetirla si el partido llega
  // duplicado (vive a la vez en calendar_events y en training_sessions).
  if (matchEv && matchEv.start_time){
    const ko = { t:_fmtTime(matchEv.start_time), type:'kickoff', icon:'kickoff',
      label: dsT('kickoff') + ' · ' + dsEvLabel(matchEv),
      sub: matchEv.location || matchEv.notes || '' };
    const at = _dsState.tl.findIndex(r => (r.t||'') > ko.t);
    if (at < 0) _dsState.tl.push(ko); else _dsState.tl.splice(at, 0, ko);
  }
  // Day off (total o parcial) → fila al inicio del cronograma; el parcial lista los jugadores libres
  const offs = data.filter(e => e.session_type === 'day_off');
  if (offs.length){
    let sq = [];
    if (offs.some(o => Array.isArray(o.player_ids) && o.player_ids.length)){ try { sq = await calGetSquad(); } catch(_){} }
    offs.forEach(o => {
      const partial = Array.isArray(o.player_ids) && o.player_ids.length;
      const names = partial ? o.player_ids
        .map(id => sq.find(p => String(p.id) === String(id))).filter(Boolean)
        .map(p => `${p.first_name||''} ${p.last_name||''}`.trim()).filter(Boolean) : [];
      _dsState.tl.unshift({ t:_fmtTime(o.start_time) || '', type:'custom', icon:'sun',
        label: o.title || calMetaLabel('day_off'),
        sub: [names.join(', '), o.notes || ''].filter(Boolean).join(' — ') });
    });
  }
  // Drop any stale event-derived info from a previous open, then re-append this day's
  // untimed events (e.g. a pre-departure smoothie) as editable, non-persisted items.
  _dsState.info = (_dsState.info || []).filter(i => !i._ev);
  evs.filter(e => !e.start_time && e.session_type !== 'match').forEach(e => _dsState.info.push({ k:calMetaLabel(e.session_type), v:dsEvLabel(e) + (e.notes?(' — '+e.notes):''), wide:true, _ev:true }));
}

// Fixed sheet labels, translatable to a chosen output language regardless of the app locale.
const DS_L = {
  en:{ daily_plan:'Daily plan', schedule:'Schedule', no_events:'No timed events for this day yet.', vs:'vs', home:'Home', away:'Away', directions:'Get directions', scan:'Scan or tap to open Maps', match:'Match', kickoff:'Kick-off', kit:'Kit', kit_warmup:'Warm-up', kit_match:'Match', kit_players:'Outfield', kit_gk:'Goalkeeper' },
  es:{ daily_plan:'Plan del día', schedule:'Cronograma', no_events:'Todavía no hay eventos con hora para este día.', vs:'vs', home:'Local', away:'Visitante', directions:'Cómo llegar', scan:'Escaneá o tocá para abrir Maps', match:'Partido', kickoff:'Kick-off', kit:'Uniforme', kit_warmup:'Calentamiento', kit_match:'Partido', kit_players:'Jugadores', kit_gk:'Portero' },
  pt:{ daily_plan:'Plano do dia', schedule:'Cronograma', no_events:'Ainda não há eventos com horário para este dia.', vs:'vs', home:'Casa', away:'Fora', directions:'Como chegar', scan:'Escaneie ou toque para abrir o Maps', match:'Jogo', kickoff:'Kick-off', kit:'Uniforme', kit_warmup:'Aquecimento', kit_match:'Jogo', kit_players:'Jogadores', kit_gk:'Goleiro' },
};
function dsLang(){ const l = _dsState && _dsState.lang; if (l && l !== 'auto') return l; try { return (ttLocale()||'en').slice(0,2); } catch(_){ return 'en'; } }
function dsT(k){ const l = dsLang(); return (DS_L[l] && DS_L[l][k]) || DS_L.en[k] || k; }

// Persist the manual parts (title, accent, fixed info, venue link, format, language)
// per club+team so the coach doesn't retype them. Cloud (Supabase) + local cache;
// only date / MD tag / match / timeline refresh each open.
function dsTmplKey(){ return `cm_daysheet_tmpl_${_clubId||''}_${_activeTeamId||''}`; }
function dsTmplData(){ return { title:_dsState.title, accent:_dsState.accent, info:(_dsState.info||[]).filter(i => !i._ev), kit:_dsState.kit, kitPalette:dsPalette(), venueUrl:_dsState.venueUrl||'', format:_dsState.format||'a4', lang:_dsState.lang||'auto' }; }
let _dsSaveTimer = null, _dsQrTimer = null;
function dsSaveTmpl(){
  if (!_dsState) return;
  const data = dsTmplData();
  try { localStorage.setItem(dsTmplKey(), JSON.stringify(data)); } catch(_){}
  clearTimeout(_dsSaveTimer);
  const cid = _clubId, tid = _activeTeamId;
  _dsSaveTimer = setTimeout(() => {
    try { window.sb && window.sb.from('day_sheet_templates').upsert({ club_id:cid, team_id:tid, data, updated_at:new Date().toISOString() }, { onConflict:'club_id,team_id' }).then(()=>{}, ()=>{}); } catch(_){}
  }, 700);
}
function dsLoadTmplLocal(){ try { const r = localStorage.getItem(dsTmplKey()); return r ? JSON.parse(r) : null; } catch(_){ return null; } }
async function dsLoadTmplDB(){ try { const { data } = await window.sb.from('day_sheet_templates').select('data').eq('club_id',_clubId).eq('team_id',_activeTeamId).maybeSingle(); return (data && data.data) || null; } catch(_){ return null; } }
function dsApplyTmpl(t){
  if (!t) return;
  if (/^#[0-9a-fA-F]{6}$/.test(t.accent||'')) _dsState.accent = t.accent;
  if (t.title) _dsState.title = t.title;
  if (Array.isArray(t.info)) _dsState.info = t.info.map(i => ({ ...i }));
  // Plantillas viejas: la camiseta era un info item con color suelto. Se convierte
  // una sola vez al bloque de uniforme y el item se retira para no duplicarlo.
  if (!t.kit){
    const legacy = (_dsState.info||[]).find(i => i.kit && !i._ev);
    if (legacy){
      _dsState.kit = dsKitDefaults(_dsState.accent);
      _dsState.kit.warmup.shirt = legacy.kit;
      _dsState.kit.match.shirt  = legacy.kit;
      _dsState.info = _dsState.info.filter(i => i !== legacy);
    } else if (!_dsState.kit) _dsState.kit = dsKitDefaults(_dsState.accent);
  } else _dsState.kit = dsKitNorm(t.kit, _dsState.accent);
  if (Array.isArray(t.kitPalette)) _dsState.kitPalette = t.kitPalette.filter(c => /^#[0-9a-fA-F]{6}$/.test(c||'')).map(c => c.toUpperCase()).slice(0, 12);
  if (typeof t.venueUrl === 'string') _dsState.venueUrl = t.venueUrl;
  if (t.format) _dsState.format = t.format;
  if (t.lang) _dsState.lang = t.lang;
}

// ── Named saved plannings ──────────────────────────────────────
// Beyond the single per-team auto-save above, the coach can store as many
// reusable plannings as they want (e.g. "Home matchday", "MD-1"), load any of
// them on any day and tweak from there. A named plan snapshots the manual parts
// PLUS the timeline; the date / MD tag / match / logo still refresh on open.
let _dsPlans = [], _dsCurrentPlanId = null, _dsPlanName = '';
function dsPlansKey(){ return `cm_daysheet_plans_${_clubId||''}_${_activeTeamId||''}`; }
function dsPlansPersistLocal(){ try { localStorage.setItem(dsPlansKey(), JSON.stringify(_dsPlans)); } catch(_){} }
function dsPlanData(){ return { ...dsTmplData(), tl:(_dsState.tl||[]).map(r => ({ ...r })) }; }
function dsApplyPlan(t){ if (!t) return; dsApplyTmpl(t); if (Array.isArray(t.tl)) _dsState.tl = t.tl.map(r => ({ ...r })); }
async function dsLoadPlans(){
  try { const r = localStorage.getItem(dsPlansKey()); if (r) _dsPlans = JSON.parse(r) || []; } catch(_){}
  try {
    const { data } = await window.sb.from('day_sheet_plans').select('id,name,data,updated_at').eq('club_id',_clubId).eq('team_id',_activeTeamId).order('updated_at',{ ascending:false });
    if (Array.isArray(data)){ _dsPlans = data; dsPlansPersistLocal(); }
  } catch(_){}
}
// Merge the day's own timeline (from the calendar) with a template's saved
// moments: dedupe exact time+label matches, then sort timed rows ascending and
// keep untimed ones at the end. Rows that only share the time (different label)
// are kept side by side on purpose so the coach can see the clash and edit.
function dsMergeTl(dayRows, tplRows){
  const norm = s => (s==null?'':String(s)).trim();
  const key = r => norm(r.t)+'|'+norm(r.label).toLowerCase();
  const seen = new Set(), out = [];
  [...(dayRows||[]), ...(tplRows||[])].forEach(r => { const k = key(r); if (seen.has(k)) return; seen.add(k); out.push({ ...r }); });
  const timed = out.filter(r => norm(r.t)), untimed = out.filter(r => !norm(r.t));
  timed.sort((a,b) => norm(a.t).localeCompare(norm(b.t)));
  return [...timed, ...untimed];
}
// 3-way choice dialog when loading a template over a day that already shows
// events: combine both / replace with the template / cancel.
function dsAskLoadChoice(dayCount, tplCount, clashCount){
  const esc = s => (s==null?'':String(s)).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'ds-ask-backdrop';
    const clashLine = clashCount ? `<div class="ds-ask-warn"><i class="ti ti-alert-triangle"></i>${esc(tt('calendar.daysheet.load_clash_times','{x} coincide in time — they will appear together.').replace('{x}', clashCount))}</div>` : '';
    wrap.innerHTML = `<div class="ds-ask" role="dialog" aria-modal="true">
      <h4>${esc(tt('calendar.daysheet.load_clash_title','This day already has events'))}</h4>
      <p>${esc(tt('calendar.daysheet.load_clash_body','The template has {n} saved moment(s) and this day already shows {d} from the calendar.').replace('{n}', tplCount).replace('{d}', dayCount))}</p>
      ${clashLine}
      <div class="ds-ask-btns">
        <button type="button" data-c="merge" class="cm-btn is-primary is-sm">${esc(tt('calendar.daysheet.load_merge','Add both (keep the day\'s events)'))}</button>
        <button type="button" data-c="replace" class="cm-btn is-sm">${esc(tt('calendar.daysheet.load_replace','Use only the template'))}</button>
        <button type="button" data-c="cancel" class="cm-btn is-ghost is-sm">${esc(tt('common.cancel','Cancel'))}</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const done = c => { wrap.remove(); resolve(c); };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) done(b.dataset.c); else if (e.target === wrap) done('cancel'); });
  });
}
async function dsLoadPlanById(id){
  if (!id){ _dsCurrentPlanId = null; return; }
  const p = _dsPlans.find(x => x.id === id); if (!p) return;
  // Snapshot what the day currently shows (calendar-derived) before the template overwrites it.
  const dayTl = (_dsState.tl || []).map(r => ({ ...r }));
  const dayInfoEv = (_dsState.info || []).filter(i => i._ev).map(i => ({ ...i }));
  const tplTl = Array.isArray(p.data && p.data.tl) ? p.data.tl : [];
  let mode = 'replace';
  if (dayTl.length && tplTl.length){
    const tset = new Set(dayTl.map(r => (r.t||'').trim()).filter(Boolean));
    const clash = tplTl.filter(r => tset.has((r.t||'').trim())).length;
    mode = await dsAskLoadChoice(dayTl.length, tplTl.length, clash);
    if (mode === 'cancel') return;
  }
  dsApplyPlan(p.data); _dsCurrentPlanId = id; _dsPlanName = p.name || '';
  if (mode === 'merge'){
    _dsState.tl = dsMergeTl(dayTl, tplTl);
    // keep the day's untimed event items (e.g. a pre-departure smoothie) too
    if (dayInfoEv.length) _dsState.info = [...(_dsState.info || []), ...dayInfoEv];
  }
  dsSyncDate(); dsRenderEditor(); dsRenderSheet(); dsSaveTmpl();
  dsRegenQr().then(() => dsRenderSheet());
  showCalToast(tt('calendar.daysheet.plan_loaded','Template loaded'));
}
function dsFocusPlanName(){
  const inp = document.getElementById('dsPlanName');
  if (!inp){ return; }
  try { inp.scrollIntoView({ block:'center', behavior:'smooth' }); } catch(_){ inp.scrollIntoView(); }
  inp.focus();
  inp.classList.add('ds-flash');
  setTimeout(() => inp.classList.remove('ds-flash'), 1400);
}
async function dsSavePlan(){
  const name = (_dsPlanName||'').trim();
  if (!name){ showCalToast(tt('calendar.daysheet.plan_need_name','Give the template a name first')); dsFocusPlanName(); return; }
  const data = dsPlanData(), now = new Date().toISOString();
  const ex = _dsPlans.find(p => (p.name||'').trim().toLowerCase() === name.toLowerCase());
  if (ex){
    ex.data = data; ex.name = name; ex.updated_at = now; _dsCurrentPlanId = ex.id;
    try { window.sb && await window.sb.from('day_sheet_plans').update({ data, name, updated_at:now }).eq('id', ex.id); } catch(_){}
  } else {
    let id = null;
    try { const { data:ins } = await window.sb.from('day_sheet_plans').insert({ club_id:_clubId, team_id:_activeTeamId, name, data }).select('id').maybeSingle(); id = ins && ins.id; } catch(_){}
    if (!id){ try { id = crypto.randomUUID(); } catch(_){ id = 'loc-'+now; } }
    _dsPlans.unshift({ id, name, data, updated_at:now }); _dsCurrentPlanId = id;
  }
  dsPlansPersistLocal(); dsRenderEditor();
  showCalToast(tt('calendar.daysheet.plan_saved','Template saved'));
}
async function dsDeletePlan(id){
  if (!id) return;
  if (!confirm(tt('calendar.daysheet.plan_delete_confirm','Delete this saved template?'))) return;
  _dsPlans = _dsPlans.filter(p => p.id !== id);
  if (_dsCurrentPlanId === id){ _dsCurrentPlanId = null; _dsPlanName = ''; }
  try { window.sb && await window.sb.from('day_sheet_plans').delete().eq('id', id); } catch(_){}
  dsPlansPersistLocal(); dsRenderEditor();
  showCalToast(tt('calendar.daysheet.plan_deleted','Template deleted'));
}
async function dsRegenQr(){
  const url = (_dsState.venueUrl||'').trim(); _dsState.venueQr = '';
  if (!url) return;
  try {
    if (!window.qrcode) await dsLoadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','qrcode').catch(()=>{});
    if (typeof window.qrcode === 'function'){ const qr = window.qrcode(0,'M'); qr.addData(url); qr.make(); _dsState.venueQr = qr.createDataURL(6,6); }
  } catch(_){ _dsState.venueQr = ''; }
}

async function openDaySheet(){
  const club = window._calClub || {};
  let accent = (club.primary_color || '').trim();
  accent = /^#?[0-9a-fA-F]{6}$/.test(accent) ? (accent[0]==='#'?accent:'#'+accent) : '#2F5FD0';
  const teamName = (_myTeams||[]).find(t => t.id === _activeTeamId)?.name || '';
  const clubName = teamName || club.name || tt('calendar.print_club_fallback','Club');
  _dsState = {
    date: dsAddDays(TODAY, 1), club: clubName, logo: null, accent,
    title: tt('calendar.daysheet.default_title','Tomorrow schedule'),
    tag:'', dateLine:'',
    info: [
      { k: tt('calendar.daysheet.info_venue','Training venue'), v:'', wide:true },
    ],
    kit: dsKitDefaults(accent), kitPalette: [],
    tl: [], match: null, venueUrl:'', venueQr:'', format:'a4', lang:'auto',
  };
  _dsCurrentPlanId = null; _dsPlanName = '';
  dsApplyTmpl(dsLoadTmplLocal());   // instant paint from local cache
  dsSyncDate();
  document.getElementById('dsBackdrop').classList.add('is-open');
  dsBindOnce();
  dsRenderEditor(); dsRenderSheet();
  _dsState.date = await dsDefaultDate();   // stay on today until today's training ends, then roll to tomorrow
  dsSyncDate();
  _dsState.logo = await dsInlineImg(club.logo_url || null);
  dsApplyTmpl(await dsLoadTmplDB());  // authoritative (shared across staff/devices)
  await dsLoadPlans();                // named reusable plannings for this team
  await dsPrefillFromEvents();
  await dsRegenQr();
  dsSyncDate();
  dsRenderEditor(); dsRenderSheet();
}
function closeDaySheet(){ dsSaveTmpl(); document.getElementById('dsBackdrop').classList.remove('is-open'); }

function dsRenderSheet(){
  const s = _dsState; if (!s) return;
  const FONT = "'Geist',ui-sans-serif,system-ui,sans-serif", MONO = "'Geist Mono',ui-monospace,monospace";
  const esc = calEsc, ink='#161A20', sub='#6A727E', line='#ECEDEA', paper='#FFFFFF';
  const safeUrl = u => { const v=String(u==null?'':u).trim(); return /^(https?:\/\/|\/|\.\/|#)/i.test(v) ? v : '#'; };
  const onAcc = dsReadableOn(s.accent);
  const crest = s.logo
    ? `<div style="width:48px;height:48px;border-radius:11px;overflow:hidden;flex:none"><img src="${esc(s.logo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
    : `<div style="width:48px;height:48px;border-radius:11px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.16);color:${onAcc};font:800 18px ${FONT}">${esc(dsInitials(s.club))}</div>`;
  let _col = 0;
  const info = (s.info||[]).map((i,ix,arr) => {
    let wide = !!i.wide;
    if (!wide && ix === arr.length - 1 && _col === 0) wide = true;   // no lone half-cell / empty box
    if (wide) _col = 0; else _col = (_col + 1) % 2;
    return `<div style="background:${paper};padding:11px 13px;${wide?'grid-column:1/-1;':''}">
      <div style="font:700 9px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${sub}">${esc(i.k)}</div>
      <div style="margin-top:5px;font:600 13.5px/1.3 ${FONT};color:${ink};display:flex;align-items:center;gap:7px">${i.kit?`<span style="width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.15);flex:none;background:${esc(i.kit)}"></span>`:''}${esc(i.v)||'<span style="color:#C4C8CD">—</span>'}</div>
    </div>`;
  }).join('');
  const tl = (s.tl||[]).map(r => {
    const ico = dsRowIcon(r);
    if (r.match) return `<div style="display:grid;grid-template-columns:52px 34px 1fr;align-items:center;gap:9px;padding:9px 8px;margin:4px 0;position:relative;background:${dsTint(s.accent,.09)};border-radius:12px">
      <div style="font:700 13px ${MONO};color:${s.accent};text-align:right;font-variant-numeric:tabular-nums;letter-spacing:-.02em">${esc(r.t)}</div>
      <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${s.accent};color:${onAcc};z-index:1;box-shadow:0 0 0 4px ${paper}">${ico}</div>
      <div><b style="display:block;font:700 14.5px/1.25 ${FONT};color:${ink}">${esc(r.label)}</b>${r.sub?`<span style="display:block;margin-top:1px;font:500 11.5px/1.3 ${MONO};color:${s.accent}">${esc(r.sub)}</span>`:''}</div>
    </div>`;
    return `<div style="display:grid;grid-template-columns:52px 34px 1fr;align-items:center;gap:9px;padding:7px 0;position:relative">
      <div style="font:700 13px ${MONO};color:${ink};text-align:right;font-variant-numeric:tabular-nums;letter-spacing:-.02em">${esc(r.t)}</div>
      <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${dsTint(s.accent,.12)};color:${s.accent};z-index:1;box-shadow:0 0 0 4px ${paper}">${ico}</div>
      <div><b style="display:block;font:650 14px/1.25 ${FONT};color:${ink}">${esc(r.label)}</b>${r.sub?`<span style="display:block;margin-top:1px;font:400 11.5px/1.3 ${FONT};color:${sub}">${esc(r.sub)}</span>`:''}</div>
    </div>`;
  }).join('');
  const story = s.format === 'story';
  const W = story ? 460 : 680;
  const gridCols = story ? '1fr' : '1fr 1fr';
  // Match block (rival crest + kick-off) on match days
  const m = s.match;
  const ha = m ? (m.homeAway==='home'?dsT('home'):m.homeAway==='away'?dsT('away'):'') : '';
  const matchBlock = m ? `<div style="display:flex;align-items:center;gap:14px;background:${dsTint(s.accent,.09)};border:1px solid ${dsTint(s.accent,.30)};border-radius:14px;padding:14px 16px;margin-bottom:20px">
      ${m.crest?`<img src="${esc(m.crest)}" alt="" style="width:46px;height:46px;object-fit:contain;flex:none">`:`<div style="width:46px;height:46px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;background:${s.accent};color:${onAcc};font:800 15px ${FONT}">${esc(dsInitials(m.opponent||'?'))}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font:700 9px/1 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${s.accent}">${esc(dsT('match'))}${ha?' · '+esc(ha):''}${m.competition?' · '+esc(m.competition):''}</div>
        <div style="margin-top:4px;font:800 ${story?18:20}px/1.1 ${FONT};color:${ink}">${esc(dsT('vs'))} ${esc(m.opponent||'')}</div>
      </div>
      ${m.time?`<div style="text-align:right"><div style="font:700 8.5px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${sub}">${esc(dsT('kickoff'))}</div><div style="font:800 22px ${MONO};color:${ink};margin-top:2px">${esc(m.time)}</div></div>`:''}
    </div>` : '';
  // Kit block: warm-up always, match kit only on match days
  const k = s.kit || dsKitDefaults(s.accent);
  const showGk = k.gkOn !== false;
  const kitRow = (set, size, gk) => `<div style="display:flex;align-items:flex-end;justify-content:center;gap:12px">${DS_KIT_PIECES.map(p => dsKitPiece(p, (set||{})[p], size, gk)).join('')}</div>`;
  const kitCol = (label, group) => `<div style="background:${paper};padding:12px 13px;text-align:center">
      <div style="font:700 9px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${sub}">${esc(label)}</div>
      ${showGk ? `<div style="margin-top:8px;font:600 8px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${sub};opacity:.75">${esc(dsT('kit_players'))}</div>` : ''}
      <div style="margin-top:${showGk?6:9}px">${kitRow(k[group], story?36:42, false)}</div>
      ${showGk ? `<div style="margin-top:11px;padding-top:10px;border-top:1px dashed ${line}">
        <div style="font:600 8px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${sub};opacity:.75">${esc(dsT('kit_gk'))}</div>
        <div style="margin-top:6px">${kitRow(k[dsKitGkGroup(group)], story?30:36, true)}</div>
      </div>` : ''}
    </div>`;
  const showMatchKit = k.matchOn !== false && !!m;
  const kitBlock = k.on === false ? '' : `<div style="margin-bottom:20px">
      <div style="font:700 10px/1 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${sub};margin:0 0 10px;display:flex;align-items:center;gap:9px">${esc(dsT('kit'))}<span style="flex:1;height:1px;background:${line}"></span></div>
      <div style="display:grid;grid-template-columns:${showMatchKit && !story ? '1fr 1fr' : '1fr'};gap:1px;background:${line};border:1px solid ${line};border-radius:11px;overflow:hidden">
        ${kitCol(dsT('kit_warmup'), 'warmup')}${showMatchKit ? kitCol(dsT('kit_match'), 'match') : ''}
      </div>
    </div>`;
  // Directions block (QR survives PNG; link is clickable in the live sheet)
  const dirBlock = (s.venueUrl||'').trim() ? `<a href="${esc(safeUrl(s.venueUrl))}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:14px;text-decoration:none;border:1px solid ${line};border-radius:12px;padding:12px 14px;margin-bottom:20px">
      ${s.venueQr?`<img src="${esc(s.venueQr)}" alt="QR" style="width:66px;height:66px;flex:none;border-radius:6px">`:''}
      <div style="min-width:0">
        <div style="font:700 9px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${sub}">${esc(dsT('directions'))}</div>
        <div style="margin-top:4px;font:600 13px ${FONT};color:${s.accent};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((s.venueUrl||'').replace(/^https?:\/\//,''))}</div>
        <div style="margin-top:2px;font:400 10.5px ${FONT};color:${sub}">${esc(dsT('scan'))}</div>
      </div>
    </a>` : '';
  document.getElementById('dsSheet').innerHTML = `
  <div style="width:${W}px;background:${paper};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(20,23,29,.10);font-family:${FONT}">
    <div style="background:${s.accent};color:${onAcc};padding:22px 26px 20px">
      <div style="display:flex;align-items:center;gap:13px">
        ${crest}
        <div style="flex:1;min-width:0"><b style="display:block;font:700 15.5px/1.1 ${FONT};letter-spacing:-.01em">${esc(s.club)}</b><span style="display:block;margin-top:3px;font:600 10px/1 ${MONO};letter-spacing:.14em;text-transform:uppercase;opacity:.72">${esc(dsT('daily_plan'))}</span></div>
        ${s.tag?`<div style="font:700 9.5px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;background:rgba(255,255,255,.18);padding:5px 9px;border-radius:999px;white-space:nowrap">${esc(s.tag)}</div>`:''}
      </div>
      <h1 style="margin:16px 0 0;font:800 ${story?24:27}px/1.05 ${FONT};letter-spacing:-.02em">${esc(s.title)}</h1>
      ${s.dateLine?`<div style="margin-top:5px;font:600 12px ${MONO};opacity:.82">${esc(s.dateLine)}</div>`:''}
    </div>
    <div style="padding:20px 26px 8px">
      ${matchBlock}
      ${info?`<div style="display:grid;grid-template-columns:${gridCols};gap:1px;background:${line};border:1px solid ${line};border-radius:11px;overflow:hidden;margin-bottom:20px">${info}</div>`:''}
      ${kitBlock}
      ${dirBlock}
      <div style="font:700 10px/1 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${sub};margin:0 0 12px;display:flex;align-items:center;gap:9px">${esc(dsT('schedule'))}<span style="flex:1;height:1px;background:${line}"></span></div>
      <div style="position:relative;margin-left:6px">${tl?`<div style="position:absolute;left:77px;top:10px;bottom:10px;width:2px;background:${line}"></div>`:''}${tl || `<div style="color:#C4C8CD;font:400 12.5px ${FONT};padding:8px 0">${esc(dsT('no_events'))}</div>`}</div>
    </div>
    <div style="margin-top:14px;padding:14px 26px;border-top:1px solid ${line};display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="font:600 10.5px ${MONO};color:${sub}">${esc(s.club)}</div>
      <div style="font:600 10px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${sub};opacity:.8">ClavaMetrics</div>
    </div>
  </div>`;
}

function dsRenderEditor(){
  const s = _dsState; if (!s) return; const esc = calEsc;
  const swatches = DS_SWATCHES.map(c => `<button class="ds-sw${s.accent.toLowerCase()===c.toLowerCase()?' on':''}" style="background:${c}" data-sw="${c}" title="${c}"></button>`).join('');
  const infoRows = (s.info||[]).map((i,ix) => `
    <div class="ds-item" data-scope="info" data-i="${ix}">
      <span class="ds-grip" draggable="true" title="${esc(tt('calendar.daysheet.drag','Drag to reorder'))}"><i class="ti ti-grip-vertical"></i></span>
      <div class="fields">
        <input class="ds-mini" data-scope="info" data-i="${ix}" data-f="k" placeholder="${esc(tt('calendar.daysheet.ph_label','Label'))}" value="${esc(i.k)}">
        <input class="ds-mini" data-scope="info" data-i="${ix}" data-f="v" placeholder="${esc(tt('calendar.daysheet.ph_value','Value'))}" value="${esc(i.v)}">
        <div class="ds-colwrap">
          <button class="ds-colbtn" type="button" data-colbtn="${ix}">${i.kit?`<span class="ds-coldot" style="background:${esc(i.kit)}"></span>`:'<i class="ti ti-palette"></i>'}${esc(i.kit?tt('calendar.daysheet.colour','Colour'):tt('calendar.daysheet.add_colour','Add colour'))}</button>
          <div class="ds-colpop" data-pop="${ix}" hidden>
            ${DS_SWATCHES.map(c => `<button type="button" class="ds-swm${(i.kit||'').toLowerCase()===c.toLowerCase()?' on':''}" style="background:${c}" data-swkit="${c}" data-i="${ix}"></button>`).join('')}
            <input type="color" class="ds-color" data-scope="info" data-i="${ix}" data-f="kit" value="${esc(i.kit||s.accent)}">
            <button type="button" class="ds-none" data-swkit="__none" data-i="${ix}">${esc(tt('calendar.daysheet.none','None'))}</button>
          </div>
        </div>
      </div>
      <button class="del" data-del="info" data-i="${ix}" title="${esc(tt('common.remove','Remove'))}"><i class="ti ti-trash"></i></button>
    </div>`).join('');
  const kit = s.kit || (s.kit = dsKitDefaults(s.accent));
  const pieceLbl = { shirt:tt('calendar.daysheet.kit_shirt','Shirt'), shorts:tt('calendar.daysheet.kit_shorts','Shorts'), socks:tt('calendar.daysheet.kit_socks','Socks') };
  const kitOff = g => g === 'match' && kit.matchOn === false;   // apagado: sólo el título y su botón
  // Cada prenda abre una paleta: colores fijos de camiseta + los que guardó el club,
  // y abajo el selector nativo por si hace falta un tono exacto.
  const kitPop = (g, p) => {
    const cur = (kit[g][p] || '#FFFFFF').toUpperCase();
    const id = `${g}:${p}`;
    const sw = (c, saved) => `<span class="ds-swwrap">
        <button type="button" class="ds-swm${cur === c.toUpperCase() ? ' on' : ''}" style="background:${c}" data-kitcol="${id}|${c}" title="${c}"></button>
        ${saved ? `<button type="button" class="ds-swx" data-palrm="${c}" data-kitpop="${id}" title="${esc(tt('calendar.daysheet.kit_colour_forget','Remove from my colours'))}"><i class="ti ti-x"></i></button>` : ''}
      </span>`;
    const mine = dsPalette();
    return `<div class="ds-colpop ds-kitpop" data-kitpop="${id}" hidden>
      <div class="ds-popsec">${esc(tt('calendar.daysheet.kit_colours_preset','Common colours'))}</div>
      <div class="ds-swrow">${sw(s.accent, false)}${DS_KIT_COLOURS.map(c => sw(c, false)).join('')}</div>
      <div class="ds-popsec">${esc(tt('calendar.daysheet.kit_colours_mine','My colours'))}</div>
      <div class="ds-swrow">
        ${mine.length ? mine.map(c => sw(c, true)).join('') : `<span class="ds-popempty">${esc(tt('calendar.daysheet.kit_colours_none','Save a colour to reuse it'))}</span>`}
      </div>
      <div class="ds-poprow">
        <input type="color" class="ds-color" data-kitset="${g}" data-kitpiece="${p}" value="${esc(cur)}">
        <button type="button" class="ds-savecol" data-paladd="${id}"><i class="ti ti-plus"></i>${esc(tt('calendar.daysheet.kit_colour_save','Save this colour'))}</button>
      </div>
    </div>`;
  };
  const kitPieces = g => `<div class="ds-kitpieces">
      ${DS_KIT_PIECES.map(p => `<div class="ds-kitpiece">
        <button type="button" class="ds-kitbtn" data-kitopen="${g}:${p}" title="${esc(tt('calendar.daysheet.kit_pick','Change colour'))}">${dsKitPiece(p, kit[g][p], 34, dsKitIsGk(g))}</button>
        <span>${esc(pieceLbl[p])}</span>
        ${kitPop(g, p)}
      </div>`).join('')}
    </div>`;
  const kitSet = (g, label, extra) => `<div class="ds-kitset">
      <div class="ds-kithead"${kitOff(g)?' style="margin:0"':''}><span>${esc(label)}</span>${extra}</div>
      ${kitOff(g) ? '' : `
        ${kit.gkOn !== false ? `<div class="ds-kitrowlbl">${esc(tt('calendar.daysheet.kit_players','Outfield players'))}</div>` : ''}
        ${kitPieces(g)}
        ${kit.gkOn !== false ? `<div class="ds-kitgk">
          <div class="ds-kitrowlbl">${esc(tt('calendar.daysheet.kit_gk','Goalkeeper'))}</div>
          ${kitPieces(dsKitGkGroup(g))}
        </div>` : ''}`}
    </div>`;
  const typeOpts = t => DS_TYPES.map(v => `<option value="${v}" ${t===v?'selected':''}>${esc(dsTypeLabel(v))}</option>`).join('');
  const tlRows = (s.tl||[]).map((r,ix) => `
    <div class="ds-item" data-scope="tl" data-i="${ix}">
      <span class="ds-grip" draggable="true" title="${esc(tt('calendar.daysheet.drag','Drag to reorder'))}"><i class="ti ti-grip-vertical"></i></span>
      <div class="fields">
        <div class="ds-timerow">
          <input class="ds-mini" data-scope="tl" data-i="${ix}" data-f="t" placeholder="08:30" value="${esc(r.t)}">
          <select class="ds-mini" data-scope="tl" data-i="${ix}" data-f="type">${typeOpts(r.type)}</select>
          <div class="ds-icowrap">
            <button class="ds-icobtn${r.icon?' on':''}" type="button" data-icobtn="${ix}" title="${esc(tt('calendar.daysheet.pick_icon','Change icon'))}">${dsGlyph(r.icon || (r.match?'kickoff':r.type))}</button>
            <div class="ds-icopop" data-icopop="${ix}" hidden>
              <button type="button" class="ds-icom ds-icoauto${!r.icon?' on':''}" data-icoset="__auto" data-i="${ix}" title="${esc(tt('calendar.daysheet.icon_auto','Automatic (by type)'))}"><i class="ti ti-wand"></i></button>
              ${DS_ICON_CHOICES.map(k => `<button type="button" class="ds-icom${r.icon===k?' on':''}" data-icoset="${k}" data-i="${ix}" title="${esc(k)}">${dsGlyph(k)}</button>`).join('')}
            </div>
          </div>
        </div>
        <input class="ds-mini" data-scope="tl" data-i="${ix}" data-f="label" placeholder="${esc(tt('calendar.daysheet.ph_moment','What happens'))}" value="${esc(r.label)}">
        <input class="ds-mini" data-scope="tl" data-i="${ix}" data-f="sub" placeholder="${esc(tt('calendar.daysheet.ph_detail','Detail (optional)'))}" value="${esc(r.sub)}">
      </div>
      <button class="del" data-dup="tl" data-i="${ix}" title="${esc(tt('common.duplicate','Duplicate'))}"><i class="ti ti-copy"></i></button>
      <button class="del" data-del="tl" data-i="${ix}" title="${esc(tt('common.remove','Remove'))}"><i class="ti ti-trash"></i></button>
    </div>`).join('');
  document.getElementById('dsEditor').innerHTML = `
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_plans','Saved templates'))}</h3>
      <div class="ds-hint">${esc(tt('calendar.daysheet.plans_hint','Save this plan with a name to reuse it any day — load it and tweak from there.'))}</div>
      ${(_dsPlans||[]).length ? `<div class="ds-fld"><label>${esc(tt('calendar.daysheet.plan_load','Load a saved template'))}</label>
        <div class="ds-planlist">
          ${(_dsPlans||[]).map(p => `<div class="ds-planrow${_dsCurrentPlanId===p.id?' is-active':''}">
            <button type="button" class="ds-planpick" data-planload="${esc(p.id)}" title="${esc(p.name||'—')}">${esc(p.name||'—')}</button>
            <button type="button" class="ds-plandel" data-plan="delete" data-id="${esc(p.id)}" aria-label="${esc(tt('calendar.daysheet.plan_delete','Delete template'))}" title="${esc(tt('calendar.daysheet.plan_delete','Delete template'))}"><i class="ti ti-trash"></i></button>
          </div>`).join('')}
        </div></div>` : ''}
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.plan_name','Template name'))}</label><input class="ds-in" id="dsPlanName" placeholder="${esc(tt('calendar.daysheet.plan_name_ph','e.g. Home matchday, MD-1…'))}" value="${esc(_dsPlanName||'')}"></div>
    </div>
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_header','Header'))}</h3>
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.date','Day'))}</label><input class="ds-in" type="date" data-k="date" value="${esc(s.date)}"></div>
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.club','Club / team'))}</label><input class="ds-in" data-k="club" value="${esc(s.club)}"></div>
      <div class="ds-row2">
        <div class="ds-fld"><label>${esc(tt('calendar.daysheet.title_lbl','Title'))}</label><input class="ds-in" data-k="title" value="${esc(s.title)}"></div>
        <div class="ds-fld"><label>${esc(tt('calendar.daysheet.tag','Tag'))}</label><input class="ds-in" data-k="tag" value="${esc(s.tag)}"></div>
      </div>
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.date_line','Date line'))}</label><input class="ds-in" data-k="dateLine" value="${esc(s.dateLine)}"></div>
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.maps_link','Venue — Google Maps link'))}</label><input class="ds-in" type="url" data-k="venueUrl" placeholder="https://maps.app.goo.gl/…" value="${esc(s.venueUrl||'')}"><span class="ds-hint" style="margin:0">${esc(tt('calendar.daysheet.maps_hint','Adds a scannable QR + clickable directions.'))}</span></div>
    </div>
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_colour','Club colour'))}</h3>
      <div class="ds-swatches">${swatches}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:11px"><input type="color" class="ds-color" data-k="accent" value="${/^#[0-9a-fA-F]{6}$/.test(s.accent)?esc(s.accent):'#2F5FD0'}"><label style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${esc(tt('calendar.daysheet.custom_accent','Custom accent'))}</label></div>
    </div>
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_kit','Kit'))}</h3>
      <div class="ds-hint">${esc(tt('calendar.daysheet.kit_hint','Shirt, shorts and socks with their colour. The match kit only shows on match days.'))}</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:${kit.on === false ? '0' : '12px'}">
        <div class="ds-seg">
          <button type="button" data-kiton="1" class="${kit.on !== false ? 'on' : ''}"><i class="ti ti-shirt"></i>${esc(tt('calendar.daysheet.kit_show','Include'))}</button>
          <button type="button" data-kiton="0" class="${kit.on === false ? 'on' : ''}"><i class="ti ti-eye-off"></i>${esc(tt('calendar.daysheet.kit_hide','Hide'))}</button>
        </div>
        ${kit.on === false ? '' : `<div class="ds-seg ds-seg-xs">
          <button type="button" data-kitgk="1" class="${kit.gkOn !== false ? 'on' : ''}">${esc(tt('calendar.daysheet.kit_gk_show','With goalkeeper'))}</button>
          <button type="button" data-kitgk="0" class="${kit.gkOn === false ? 'on' : ''}">${esc(tt('calendar.daysheet.kit_gk_hide','Outfield only'))}</button>
        </div>`}
      </div>
      ${kit.on === false ? '' : `
        ${kitSet('warmup', tt('calendar.daysheet.kit_warmup','Warm-up'), '')}
        ${kitSet('match', tt('calendar.daysheet.kit_match','Match'), `<div class="ds-seg ds-seg-xs">
            <button type="button" data-kitmatch="1" class="${kit.matchOn !== false ? 'on' : ''}">${esc(tt('calendar.daysheet.kit_show','Include'))}</button>
            <button type="button" data-kitmatch="0" class="${kit.matchOn === false ? 'on' : ''}">${esc(tt('calendar.daysheet.kit_hide','Hide'))}</button>
          </div>`)}`}
    </div>
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_output','Format & language'))}</h3>
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.format','Format'))}</label>
        <div class="ds-seg">
          <button type="button" data-fmt="a4" class="${s.format!=='story'?'on':''}"><i class="ti ti-file-horizontal"></i>${esc(tt('calendar.daysheet.fmt_a4','Sheet'))}</button>
          <button type="button" data-fmt="story" class="${s.format==='story'?'on':''}"><i class="ti ti-device-mobile"></i>${esc(tt('calendar.daysheet.fmt_story','Phone'))}</button>
        </div>
      </div>
      <div class="ds-fld"><label>${esc(tt('calendar.daysheet.language','Sheet language'))}</label>
        <select class="ds-in" data-k="lang">
          <option value="auto" ${s.lang==='auto'?'selected':''}>${esc(tt('calendar.daysheet.lang_auto','Same as app'))}</option>
          <option value="es" ${s.lang==='es'?'selected':''}>Español</option>
          <option value="en" ${s.lang==='en'?'selected':''}>English</option>
          <option value="pt" ${s.lang==='pt'?'selected':''}>Português</option>
        </select>
      </div>
    </div>
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_info','Info items'))}</h3>
      <div class="ds-hint">${esc(tt('calendar.daysheet.info_hint','Fixed facts with no time — venue, kit colour, what to bring, pre-departure notes.'))}</div>
      <div class="ds-presets">
        <button class="ds-preset" type="button" data-preset="bring"><i class="ti ti-briefcase"></i>${esc(tt('calendar.daysheet.preset_bring','What to bring'))}</button>
        <button class="ds-preset" type="button" data-preset="meal"><i class="ti ti-cup"></i>${esc(tt('calendar.daysheet.preset_meal','Nutrition'))}</button>
        <button class="ds-preset" type="button" data-preset="medical"><i class="ti ti-first-aid-kit"></i>${esc(tt('calendar.daysheet.preset_medical','Medical notes'))}</button>
        <button class="ds-preset" type="button" data-preset="dress"><i class="ti ti-shirt"></i>${esc(tt('calendar.daysheet.preset_dress','Dress code'))}</button>
      </div>
      ${infoRows}
      <button class="ds-add" data-add="info" type="button"><i class="ti ti-plus"></i> ${esc(tt('calendar.daysheet.add_info','Add info item'))}</button>
    </div>
    <div class="ds-grp">
      <h3>${esc(tt('calendar.daysheet.grp_timeline','Timeline'))}</h3>
      <div class="ds-hint">${esc(tt('calendar.daysheet.tl_hint','Timed moments — pulled from the calendar (bus departure, meals, kick-off…).'))}</div>
      <button class="ds-add" type="button" data-tlrefresh style="margin:0 0 8px"><i class="ti ti-refresh"></i> ${esc(tt('calendar.daysheet.tl_reload','Re-read from calendar'))}</button>
      ${tlRows}
      <button class="ds-add" data-add="tl" type="button"><i class="ti ti-plus"></i> ${esc(tt('calendar.daysheet.add_tl','Add timeline row'))}</button>
    </div>`;
}

function dsBindOnce(){
  if (_dsBound) return; _dsBound = true;
  const ed = document.getElementById('dsEditor');
  ed.addEventListener('input', e => {
    const t = e.target; if (t.type === 'checkbox' || t.tagName === 'SELECT' || t.type === 'file' || t.type === 'date') return;
    if (t.id === 'dsPlanName'){ _dsPlanName = t.value; return; }
    // Colores del uniforme: pintar en vivo sin re-render del editor (el picker nativo
    // sigue abierto mientras se arrastra el color).
    if (t.dataset.kitset){
      const g = t.dataset.kitset;
      _dsState.kit[g][t.dataset.kitpiece] = t.value;
      const prev = t.closest('.ds-kitpiece')?.querySelector('.ds-kitbtn svg');
      if (prev) prev.outerHTML = dsKitPiece(t.dataset.kitpiece, t.value, 34, dsKitIsGk(g));
      dsRenderSheet(); dsSaveTmpl(); return;
    }
    if (t.dataset.k){
      if (t.dataset.k === 'accent'){ _dsState.accent = t.value; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
      if (t.dataset.k === 'venueUrl'){ _dsState.venueUrl = t.value; dsSaveTmpl(); clearTimeout(_dsQrTimer); _dsQrTimer = setTimeout(async () => { await dsRegenQr(); dsRenderSheet(); }, 500); return; }
      _dsState[t.dataset.k] = t.value; dsRenderSheet(); dsSaveTmpl(); return;
    }
    if (t.dataset.scope){ _dsState[t.dataset.scope][+t.dataset.i][t.dataset.f] = t.value; dsRenderSheet(); if (t.dataset.scope === 'info') dsSaveTmpl(); }
  });
  ed.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.k === 'date'){ _dsState.date = t.value; dsSyncDate(); dsRenderEditor(); dsRenderSheet(); await dsPrefillFromEvents(); dsRenderEditor(); dsRenderSheet(); return; }
    if (t.dataset.scope && t.dataset.f === 'kit'){ _dsState[t.dataset.scope][+t.dataset.i].kit = t.value; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    if (t.dataset.scope && t.dataset.f === 'type'){ const row = _dsState[t.dataset.scope][+t.dataset.i]; row.type = t.value; if (!row.icon) dsRenderEditor(); dsRenderSheet(); }
    if (t.dataset.k === 'lang'){ _dsState.lang = t.value; dsSyncDate(); dsRenderSheet(); dsSaveTmpl(); }
  });
  ed.addEventListener('click', e => {
    const plld = e.target.closest('[data-planload]');
    if (plld){ dsLoadPlanById(plld.dataset.planload); return; }
    const pl = e.target.closest('[data-plan]');
    if (pl){ if (pl.dataset.plan === 'save') dsSavePlan(); else if (pl.dataset.plan === 'delete') dsDeletePlan(pl.dataset.id || _dsCurrentPlanId); return; }
    const tlr = e.target.closest('[data-tlrefresh]');
    if (tlr){ dsPrefillFromEvents().then(() => { dsSyncDate(); dsRenderEditor(); dsRenderSheet(); showCalToast(tt('calendar.daysheet.tl_reloaded','Timeline reloaded from the calendar')); }); return; }
    // ── Uniforme: paleta por prenda ──
    const kop = e.target.closest('[data-kitopen]');
    if (kop){ const id = kop.dataset.kitopen; const pop = ed.querySelector(`.ds-kitpop[data-kitpop="${id}"]`); const wasOpen = pop && !pop.hidden; ed.querySelectorAll('.ds-colpop,.ds-icopop').forEach(p => p.hidden = true); if (pop) pop.hidden = wasOpen; return; }
    const kcol = e.target.closest('[data-kitcol]');
    if (kcol){
      const [id, c] = kcol.dataset.kitcol.split('|');
      const [g, p] = id.split(':');
      _dsState.kit[g][p] = c;
      dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); dsReopenKitPop(id); return;
    }
    const padd = e.target.closest('[data-paladd]');
    if (padd){
      const [g, p] = padd.dataset.paladd.split(':');
      dsPaletteAdd(_dsState.kit[g][p]);
      dsRenderEditor(); dsSaveTmpl(); dsReopenKitPop(padd.dataset.paladd);
      showCalToast(tt('calendar.daysheet.kit_colour_saved','Colour saved to your palette')); return;
    }
    const prm = e.target.closest('[data-palrm]');
    if (prm){ dsPaletteRemove(prm.dataset.palrm); dsRenderEditor(); dsSaveTmpl(); dsReopenKitPop(prm.dataset.kitpop); return; }
    const cb = e.target.closest('[data-colbtn]');
    if (cb){ const ix = cb.dataset.colbtn; const pop = ed.querySelector(`.ds-colpop[data-pop="${ix}"]`); const wasOpen = pop && !pop.hidden; ed.querySelectorAll('.ds-colpop,.ds-icopop').forEach(p => p.hidden = true); if (pop) pop.hidden = wasOpen; return; }
    const icb = e.target.closest('[data-icobtn]');
    if (icb){ const ix = icb.dataset.icobtn; const pop = ed.querySelector(`.ds-icopop[data-icopop="${ix}"]`); const wasOpen = pop && !pop.hidden; ed.querySelectorAll('.ds-colpop,.ds-icopop').forEach(p => p.hidden = true); if (pop) pop.hidden = wasOpen; return; }
    const ics = e.target.closest('[data-icoset]');
    if (ics){ const row = _dsState.tl[+ics.dataset.i]; row.icon = ics.dataset.icoset === '__auto' ? null : ics.dataset.icoset; dsRenderEditor(); dsRenderSheet(); return; }
    const swk = e.target.closest('[data-swkit]');
    if (swk){ const it = _dsState.info[+swk.dataset.i]; it.kit = swk.dataset.swkit === '__none' ? null : swk.dataset.swkit; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    const sw = e.target.closest('[data-sw]'); if (sw){ _dsState.accent = sw.dataset.sw; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    const dup = e.target.closest('[data-dup]'); if (dup){ const arr = _dsState[dup.dataset.dup], i = +dup.dataset.i; arr.splice(i+1, 0, { ...arr[i] }); dsRenderEditor(); dsRenderSheet(); if (dup.dataset.dup === 'info') dsSaveTmpl(); return; }
    const del = e.target.closest('[data-del]'); if (del){ _dsState[del.dataset.del].splice(+del.dataset.i,1); dsRenderEditor(); dsRenderSheet(); if (del.dataset.del === 'info') dsSaveTmpl(); return; }
    const add = e.target.closest('[data-add]'); if (add){ if (add.dataset.add === 'info'){ _dsState.info.push({ k:tt('calendar.daysheet.new_item','New item'), v:'', wide:true }); dsSaveTmpl(); } else _dsState.tl.push({ t:'', type:'custom', label:tt('calendar.daysheet.new_moment','New moment'), sub:'' }); dsRenderEditor(); dsRenderSheet(); return; }
    const kon = e.target.closest('[data-kiton]'); if (kon){ _dsState.kit.on = kon.dataset.kiton === '1'; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    const kmt = e.target.closest('[data-kitmatch]'); if (kmt){ _dsState.kit.matchOn = kmt.dataset.kitmatch === '1'; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    const kgk = e.target.closest('[data-kitgk]'); if (kgk){ _dsState.kit.gkOn = kgk.dataset.kitgk === '1'; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    const fmt = e.target.closest('[data-fmt]'); if (fmt){ _dsState.format = fmt.dataset.fmt; dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
    const pre = e.target.closest('[data-preset]'); if (pre){ const L = { bring:tt('calendar.daysheet.preset_bring','What to bring'), meal:tt('calendar.daysheet.preset_meal','Nutrition'), medical:tt('calendar.daysheet.preset_medical','Medical notes'), dress:tt('calendar.daysheet.preset_dress','Dress code') }; _dsState.info.push({ k:L[pre.dataset.preset]||pre.dataset.preset, v:'', wide:true }); dsRenderEditor(); dsRenderSheet(); dsSaveTmpl(); return; }
  });
  // Drag-to-reorder (grips only, so inputs stay editable)
  let _dsDrag = null;
  ed.addEventListener('dragstart', e => { const g = e.target.closest('.ds-grip'); if (!g){ e.preventDefault(); return; } const it = g.closest('.ds-item'); _dsDrag = { scope: it.dataset.scope, i: +it.dataset.i }; it.classList.add('ds-dragging'); e.dataTransfer.effectAllowed = 'move'; });
  ed.addEventListener('dragover', e => { if (!_dsDrag) return; const it = e.target.closest('.ds-item'); if (!it || it.dataset.scope !== _dsDrag.scope) return; e.preventDefault(); ed.querySelectorAll('.ds-over').forEach(n => n.classList.remove('ds-over')); it.classList.add('ds-over'); });
  ed.addEventListener('drop', e => { if (!_dsDrag) return; const it = e.target.closest('.ds-item'); if (!it || it.dataset.scope !== _dsDrag.scope){ _dsDrag = null; return; } e.preventDefault(); const to = +it.dataset.i, arr = _dsState[_dsDrag.scope]; const [moved] = arr.splice(_dsDrag.i, 1); arr.splice(to, 0, moved); _dsDrag = null; dsRenderEditor(); dsRenderSheet(); if (arr === _dsState.info) dsSaveTmpl(); });
  ed.addEventListener('dragend', () => { _dsDrag = null; ed.querySelectorAll('.ds-dragging,.ds-over').forEach(n => n.classList.remove('ds-dragging','ds-over')); });
  document.getElementById('dsSaveTop')?.addEventListener('click', dsSavePlan);
  document.getElementById('dsShare')?.addEventListener('click', dsShare);
  document.getElementById('dsClose')?.addEventListener('click', closeDaySheet);
  document.getElementById('dsBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDaySheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('dsBackdrop')?.classList.contains('is-open')) closeDaySheet(); });
  document.getElementById('dsExportPng')?.addEventListener('click', () => dsExport('png'));
  document.getElementById('dsExportPdf')?.addEventListener('click', () => dsExport('pdf'));
}

async function dsLoadScript(src, glob){ if (window[glob]) return; await new Promise((res,rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); }
async function dsExport(kind){
  try {
    if (!window.html2canvas) await dsLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas').catch(()=>{});
    if (kind === 'pdf' && !window.jspdf) await dsLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jspdf').catch(()=>{});
    if (!window.html2canvas){ showCalToast(tt('calendar.export_lib_failed','Could not load image export library.')); return; }
    const node = document.getElementById('dsSheet').firstElementChild;
    const canvas = await window.html2canvas(node, { backgroundColor:'#ffffff', scale:2, useCORS:true });
    const fname = `daysheet-${_dsState.date}`;
    if (kind === 'png'){
      const a = document.createElement('a'); a.download = fname+'.png'; a.href = canvas.toDataURL('image/png'); a.click();
      showCalToast(tt('calendar.image_exported','Image exported.')); return;
    }
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF){ showCalToast(tt('calendar.export_lib_failed','Could not load image export library.')); return; }
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW, fullH = canvas.height * imgW / canvas.width;
    if (fullH <= pageH){ pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,imgW,fullH); }
    else {
      const sliceH = Math.floor(canvas.width * pageH / pageW); let pos = 0;
      while (pos < canvas.height){
        const h = Math.min(sliceH, canvas.height - pos);
        const c = document.createElement('canvas'); c.width = canvas.width; c.height = h;
        c.getContext('2d').drawImage(canvas, 0, pos, canvas.width, h, 0, 0, canvas.width, h);
        if (pos > 0) pdf.addPage();
        pdf.addImage(c.toDataURL('image/png'),'PNG',0,0,imgW, h * imgW / canvas.width);
        pos += h;
      }
    }
    pdf.save(fname+'.pdf');
    showCalToast(tt('calendar.daysheet.pdf_saved','PDF saved.'));
  } catch(e){ showCalToast(tt('calendar.export_failed','Export failed: {msg}',{msg:e.message})); }
}

// Send the sheet as an image: native share sheet (mobile → WhatsApp/Telegram with the
// image attached); on desktop / unsupported, fall back to downloading the PNG.
async function dsShare(){
  try {
    if (!window.html2canvas) await dsLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas').catch(()=>{});
    if (!window.html2canvas){ showCalToast(tt('calendar.export_lib_failed','Could not load image export library.')); return; }
    const node = document.getElementById('dsSheet').firstElementChild;
    const canvas = await window.html2canvas(node, { backgroundColor:'#ffffff', scale:2, useCORS:true });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!blob) return dsExport('png');
    const file = new File([blob], `daysheet-${_dsState.date}.png`, { type:'image/png' });
    if (navigator.canShare && navigator.canShare({ files:[file] }) && navigator.share){
      await navigator.share({ files:[file], title:_dsState.title || 'Day sheet', text:_dsState.title || '' });
    } else {
      const a = document.createElement('a'); a.download = file.name; a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
      showCalToast(tt('calendar.daysheet.share_fallback','Sharing isn’t available here — image downloaded so you can attach it.'));
    }
  } catch(e){ if (e && e.name === 'AbortError') return; showCalToast(tt('calendar.export_failed','Export failed: {msg}',{msg:e.message})); }
}

// Wire share modal
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('calShareClose')?.addEventListener('click', closeShareModal);
  document.getElementById('calShareCancel')?.addEventListener('click', closeShareModal);
  document.getElementById('calShareBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeShareModal(); });
  document.getElementById('calShareExportPdf')?.addEventListener('click', () => { closeShareModal(); exportPDF(); });
  document.getElementById('calShareExportPng')?.addEventListener('click', () => { closeShareModal(); exportPNG(); });
});

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  const ok = await window.requireAuth();
  if (!ok) return;

  const [profile, club] = await Promise.all([window.getProfile(), window.getClub()]);
  window._calClub = club;
  _clubId = await window.getClubId();
  await initTeamSwitch();
  _currentUserId   = profile?.id        || null;
  _currentUserName = profile?.full_name || null;
  if (club) window.applyClubTheme();

  // Counts
  const [playersRes, injRes, medRes, boardRes] = await Promise.all([
    // Count por MEMBRESÍA (player_teams!inner) para incluir secundarios del equipo activo.
    // UNIQUE(player_id,team_id) garantiza 1 fila por jugador para ese team_id → head:true no infla.
    window.sb.from('players').select('id, player_teams!inner(team_id)', { count: 'exact', head: true }).eq('club_id', _clubId).eq('player_teams.team_id', _activeTeamId).is('archived_at', null),
    window.sb.from('injuries').select('id', { count: 'exact', head: true }).eq('club_id', _clubId),
    window.sb.from('profiles').select('id', { count: 'exact', head: true }).eq('club_id', _clubId).eq('role', 'medical'),
    window.sb.from('profiles').select('id', { count: 'exact', head: true }).eq('club_id', _clubId).eq('role', 'board'),
  ]);
  _pubMedCount   = medRes.count   ?? 0;
  _pubBoardCount = boardRes.count ?? 0;
  const el1 = document.getElementById('sideInjCount'); if (el1) el1.textContent = injRes.count || '';
  const el2 = document.getElementById('calSquadCt');   if (el2) el2.textContent = `${tt('calendar.players_ct','Players')} · ${playersRes.count ?? 0}`;
  const el3 = document.getElementById('calPubMedCt');  if (el3) el3.textContent = `${tt('calendar.medical_ct','Medical')} · ${_pubMedCount}`;
  const el4 = document.getElementById('calPubBoardCt'); if (el4) el4.textContent = `${tt('calendar.club_board_ct','Club board')} · ${_pubBoardCount}`;

  // Load all MCs ordered by start_date desc for ribbon
  let { data: mcs, error: mcLoadErr } = await window.sb.from('microcycles')
    .select(MC_FULL_SELECT).eq('club_id', _clubId).eq('team_id', _activeTeamId).order('start_date', { ascending: false });
  if (mcLoadErr) {
    // Fallback if publish columns not yet added (migration pending)
    const { data: mcsBase } = await window.sb.from('microcycles')
      .select(MC_BASE_SELECT).eq('club_id', _clubId).eq('team_id', _activeTeamId).order('start_date', { ascending: false });
    mcs = mcsBase;
  }

  _allMCs = mcs || [];

  // Load match events from calendar_events for ribbon
  const { data: matchSess } = await window.sb.from('calendar_events')
    .select('id,title,date,opponent,home_away,competition,rival_crest_url,start_time,location')
    .eq('club_id', _clubId).eq('team_id', _activeTeamId)
    .eq('type', 'match')
    .order('date');
  _matchSessions = (matchSess||[]).map(s => ({
    ...s,
    source: 'event', session_type: 'match',
    session_date: (s.date||'').split('T')[0],
    title: s.title || (s.opponent ? `vs ${s.opponent}` : tt('calendar.match_word','Match'))
  }));

  // Load season config, then render ribbon and KPIs
  await loadCalCompetitions();
  renderSeasonRibbon(_allMCs, _matchSessions);
  renderCalKPIs(_allMCs);
  _initUpcomingFilter();
  renderUpcoming(); // async, loads sessions from DB

  // Default to current/most recent MC
  _mcIdx = 0;
  const todayMcIdx = _allMCs.findIndex(m => m.start_date <= TODAY && m.end_date >= TODAY);
  if (todayMcIdx >= 0) _mcIdx = todayMcIdx;

  // Deep-link: ?mc=<id> navigates to that microcycle
  const _urlParams = new URLSearchParams(location.search);
  const _urlMcId   = _urlParams.get('mc');
  const _urlHlId   = _urlParams.get('highlight');
  const _urlDate   = _urlParams.get('date');
  if (_urlMcId) {
    const idx = _allMCs.findIndex(m => m.id === _urlMcId);
    if (idx >= 0) _mcIdx = idx;
  } else if (_urlHlId && _urlDate) {
    const evtDate = _urlDate.slice(0, 7); // YYYY-MM
    const idx = _allMCs.findIndex(m => m.start_date && m.start_date.slice(0, 7) <= evtDate && m.end_date && m.end_date.slice(0, 7) >= evtDate);
    if (idx >= 0) _mcIdx = idx;
  } else if (_urlDate) {
    // Solo ?date= (ej. desde el import de GPS: «este día no está en ningún microciclo»): saltar al
    // microciclo que contiene esa fecha si existe; si no, dejar la vista por defecto para crear uno.
    const idx = _allMCs.findIndex(m => m.start_date && m.end_date && m.start_date <= _urlDate && m.end_date >= _urlDate);
    if (idx >= 0) _mcIdx = idx;
  }

  if (_allMCs.length === 0) {
    document.getElementById('calDaysGrid').innerHTML =
      `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--cm-fg-muted)">${tt('calendar.no_microcycles_found','No microcycles found. Create one to get started.')}</div>`;
    return;
  }

  await loadSessions();
  await loadShareLink();

  // ── Refresco en vivo ──────────────────────────────────────────
  // Si otra persona (u otra pestaña) crea, mueve o borra algo del equipo activo,
  // esta pantalla se repinta sola. Ver assets/cm-realtime.js.
  if (window.cmLive && _clubId) {
    window.cmLive.watch({
      name: 'calendar',
      tables: [
        { table: 'training_sessions', filter: `club_id=eq.${_clubId}` },
        { table: 'calendar_events',   filter: `club_id=eq.${_clubId}` },
        { table: 'microcycles',       filter: `club_id=eq.${_clubId}` },
      ],
      // team_id null = fila vieja sin equipo: se deja pasar y decide el refetch.
      relevant: row => !row.team_id || row.team_id === _activeTeamId,
      onRefresh: async () => {
        if (_calView === 'month')     { await renderMonthView(); return; }
        if (_calView === 'list')      { await renderListView();  return; }
        await loadSessions({ silent: true });
        await refreshRibbonMatches();
      },
    });
  }

  // Deep-link: scroll to and highlight specific event
  if (_urlHlId) requestAnimationFrame(() => {
    const el = document.querySelector(`.mc-evt[data-id="${_urlHlId}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('gs-highlight'); }
  });

  // Wire "+ New event" topbar button
  const newEvtBtn = document.querySelector('.hub-topbar .cm-btn.is-primary');
  if (newEvtBtn) newEvtBtn.addEventListener('click', () => openEvtModal(null));
})().catch(console.error);

// Re-render JS-built UI (grid, ribbon, KPIs, current view, month/day names via Intl)
// when the language changes. Static [data-i18n] is re-applied by sidebar.js.
document.addEventListener('cm:langchanged', () => {
  try {
    if (!_allMCs || !_allMCs.length) return;
    renderSeasonRibbon(_allMCs, _matchSessions);
    renderCalKPIs(_allMCs);
    renderUpcoming();
    _updateUpcomingFilterBadge();
    if (_calView === 'month') renderMonthView();
    else if (_calView === 'list') renderListView();
    else renderGrid();      // microcycle / player — also refreshes publish/workload strings
    renderWorkload();
    renderPublishState();
  } catch (e) { console.warn('cal langchanged re-render failed', e); }
});

  async function initTeamSwitch() {
    _clubId = _clubId || await window.getClubId();
    const profile = await window.getProfile();
    const bucket = (profile?.role || profile?.club_role || '').toLowerCase();
    let fullAccess = bucket === 'admin' || bucket === 'owner';
    if (!fullAccess && window.isSuperAdmin) { try { fullAccess = await window.isSuperAdmin(); } catch {} }
    let teams = await window.getTeams(_clubId);
    if (!fullAccess) {
      let mine = []; try { mine = (await window.sb.rpc('my_team_ids')).data || []; } catch {}
      const s = new Set(mine); teams = teams.filter(t => s.has(t.id));
    }
    _myTeams = teams;
    const sel = document.getElementById('calTeamSelect');
    if (!teams.length) { sel.innerHTML = `<option value="">${tt('calendar.no_teams','No teams')}</option>`; return; }
    const saved = sessionStorage.getItem('cal_active_team');
    _activeTeamId = (saved && teams.some(t => t.id === saved)) ? saved : teams[0].id;
    sel.innerHTML = teams.map(t => `<option value="${calEsc(t.id)}" ${t.id===_activeTeamId?'selected':''}>${calEsc(t.name)}</option>`).join('');
  }
  function onTeamChange() {
    _activeTeamId = document.getElementById('calTeamSelect').value;
    _ribbonV2Centered = false; // re-center ribbon on the new team
    sessionStorage.setItem('cal_active_team', _activeTeamId);
    location.reload();
  }
  window.onTeamChange = onTeamChange;
