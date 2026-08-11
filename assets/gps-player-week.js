// ══════════════════════════════════════════════════════════════
// Player Week (vista ind) — tabla semanal + carga por jugador/microciclo.
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en la
// misma posición → timing idéntico. IIFE: expone window._pwInit/_pwLoad/_pwReapply/
// _pwMcKey/_pwMcList/_pwMcMap. OJO cross-block: _pwMcKey y _pwMcList los LEEN otros
// bloques (science-cards); el timing plano-misma-posición preserva ese contrato.
// ══════════════════════════════════════════════════════════════
(function () {
  const fmtN = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });


  function mdCode(sessionDate, matchDate) {
    if (!matchDate) return null;
    const diff = Math.round((new Date(matchDate + 'T00:00:00') - new Date(sessionDate + 'T00:00:00')) / 86400000);
    if (diff === 0) return 'MD';
    if (diff > 0)  return `MD-${diff}`;
    return `MD+${Math.abs(diff)}`;
  }

  function _mdCodeForSession(s, matchDate) {
    if (s.match_day_offset != null) {
      const n = s.match_day_offset;
      // DB stores the value as a formatted string ("MD", "MD-5", "MD+1") or a number
      if (typeof n === 'string') return n || '—';
      if (n === 0) return 'MD';
      return n < 0 ? `MD${n}` : `MD+${n}`;
    }
    const attrCode = s.session_attributes?.md_code;
    if (attrCode) return attrCode;
    return mdCode(s.session_date, matchDate);
  }

  function mdCssKey(code) {
    if (!code) return 'md-plus';
    if (code === 'MD')    return 'md-0';
    const m = code.match(/^MD-(\d+)$/);
    if (m) { const n = parseInt(m[1]); return n <= 5 ? `md-${n}` : 'md-plus'; }
    return 'md-plus';
  }

  function rpeCls(v) {
    if (!v) return '';
    if (v <= 3)  return 'r-low';
    if (v <= 6)  return 'r-mid';
    if (v <= 8)  return 'r-high';
    return 'r-max';
  }

  function pctCls(pct) {
    if (pct < 30)  return 'p-low';
    if (pct < 60)  return 'p-mid';
    if (pct < 90)  return 'p-high';
    return 'p-over';
  }

  // ── state ────────────────────────────────────────────────────
  const _pw = { playerId: null, mcKey: null, chartInst: null, playersList: [] };
  let _pwInited    = false;
  let _mcList      = [];
  let _mcMap       = {};
  let _pwCurrentRows   = [];
  let _pwCurrentClubId = null;
  // Per-slot metric-key overrides (idx → metricKey). Persists for the page session.
  const _pwKpiOverride = {};

  // Default chip config (6 slots, matches original hardcoded kpis array)
  const _PW_DEFAULT_CHIPS = [
    { key: 'player_load',         label: 'Int Load',       unit: 'AU',   dec: 0, agg: 'sum'   },
    { key: 'total_distance',      label: 'Total Distance', unit: 'm',    dec: 0, agg: 'sum'   },
    { key: 'high_speed_distance', label: 'Total HSR',      unit: 'm',    dec: 0, agg: 'sum'   },
    { key: 'sprint_count',        label: 'Total Sprints',  unit: '',     dec: 0, agg: 'sum'   },
    { key: 'acc_dec',             label: 'Acc + Dec',      unit: '',     dec: 0, agg: 'accdec'},
    { key: 'max_speed',           label: 'Max Velocity',   unit: 'km/h', dec: 1, agg: 'max'   },
  ];

  // ── Table column state ────────────────────────────────────────
  // Fixed columns (always shown, not removable/reorderable)
  const _PW_FIXED_COLS = [
    { key: 'date',   label: 'Date',    fixed: true },
    { key: 'mdcode', label: 'MD Code', fixed: true },
    { key: 'rpe',    label: 'RPE',     fixed: true },
  ];

  // Default metric columns (mirrors the original hardcoded table)
  const _PW_DEFAULT_METRIC_COLS = [
    { key: 'player_load',         label: 'Load',    type: 'metric' },
    { key: 'total_distance',      label: 'TD (m)',  type: 'metric' },
    { key: 'high_speed_distance', label: 'HSR (m)', type: 'metric' },
    { key: 'sprint_count',        label: 'SPR (n)', type: 'metric' },
    { key: 'acc_dec',             label: 'Acc+Dec', type: 'metric' },
  ];

  // Mutable per-session copy; loaded from layout on init
  let _pwTableMetricCols  = _PW_DEFAULT_METRIC_COLS.map(c => ({ ...c }));
  let _pwCurrentBaseline  = null;

  // ── DOM ──────────────────────────────────────────────────────
  // Filtros viejos (pw-player-sel / pw-mc-sel / pw-next-match) eliminados: la barra
  // de desplegables (gpFilterBar) es la ÚNICA fuente de filtrado. Jugador/microciclo
  // se derivan de ella. nextMatch/kpiBody/tblBody/pwCanvas pueden ser null.
  const nextMatch  = document.getElementById('pw-next-match');
  const kpiBody    = document.getElementById('pw-kpi-body');
  const tblBody    = document.getElementById('pw-tbl-body');
  const pwCanvas   = document.getElementById('canvasPWChart');
  if (!document.querySelector('.gp-view[data-view="ind"] .gp-grid')) return;

  // Jugador/microciclo derivados de la barra (con defaults sensatos).
  function _pwBarPlayerId() {
    const FB = window.gpFilterBar?.getState?.() || null;
    const list = _pw.playersList || [];
    const fromBar = (FB?.playerIds || []).find(id => list.some(p => p.id === id));
    return fromBar || list[0]?.id || null;
  }
  function _pwBarMcKey() {
    const FB = window.gpFilterBar?.getState?.() || null;
    const fromBar = (FB?.microcycleIds || []).map(String).find(id => _mcMap[id]);
    return fromBar || _mcList[0]?.id || null;   // _mcList ordenado desc → [0] = más reciente
  }
  // Mapea la fecha de la barra → window.gpState (para radar / science vía refreshDashboard).
  function _pwApplyBarDate() {
    if (!window.gpState) return;
    const d = (window.gpFilterBar?.getState?.() || {}).date || {};
    if (d.preset === '7')            window.gpState.datePreset = 'last7';
    else if (d.preset === '30')      window.gpState.datePreset = 'last30';
    else if (d.preset === '90')      window.gpState.datePreset = 'last90';
    else if (d.preset === 'season')  window.gpState.datePreset = 'currentSeason';
    else if (d.from || d.to) { window.gpState.datePreset = 'custom'; window.gpState.dateFrom = d.from || null; window.gpState.dateTo = d.to || null; }
  }

  function _pwSyncLabel() {
    // (Descriptor "jugador · posición" removido de la fila "Dashboard": el contexto
    //  de datos lo da la barra de filtros. Mantengo el subtítulo genérico de la vista.)
    const indSub = document.getElementById('secSub');
    if (indSub) indSub.textContent = '— ' + tt('gps_analysis.sec_ind_sub','week vs match reference');
  }

  // ── init ─────────────────────────────────────────────────────
  async function pwInit() {
    if (_pwInited) return;
    _pwInited = true;
    try {
      const clubId = await window.getClubId?.();
      if (!clubId || !window.sb) return;

      let _mcQ = window.sb.from('microcycles').select('id,name,start_date,end_date,match_date,rival,season_id,team_id')
        .eq('club_id', clubId);
      if (window._gpTeamId) _mcQ = _mcQ.eq('team_id', window._gpTeamId);   // solo microciclos del equipo activo
      const [{ data: players }, { data: mcs }] = await Promise.all([
        _gpRoster(clubId, window._gpTeamId),
        _mcQ.order('start_date', { ascending: false }).limit(50),
      ]);

      _mcList = mcs || [];
      _mcMap  = Object.fromEntries(_mcList.map(mc => [mc.id, mc]));
      window._pwMcList = _mcList;
      window._pwMcMap  = _mcMap;

      _pw.playersList = players || [];

      // Jugador/microciclo iniciales derivados de la barra (o defaults: 1er jugador / MC más reciente).
      _pwApplyBarDate();
      _pw.playerId = _pwBarPlayerId();
      _pw.mcKey    = _pwBarMcKey();
      window._pwMcKey = _pw.mcKey;
      if (window.gpState) window.gpState.playerId = _pw.playerId;
      _pwSyncLabel();
      await _pwInitTableCols();
      if (_pw.playerId && _pw.mcKey) await _pwLoad();
      await renderWeeklyBars({ ...window.gpState, playerId: _pw.playerId });
      if (_pw.playerId) _pwUpdateAcwr(_pw.playerId).catch(e => console.warn('_pwUpdateAcwr (init):', e));
      if (_pw.playerId) _pwUpdateTsb(_pw.playerId).catch(e => console.warn('_pwUpdateTsb (init):', e));
    } catch (e) { console.error('pwInit:', e); }
  }

  // ── load data ────────────────────────────────────────────────
  async function _pwLoad() {
    const { playerId, mcKey } = _pw;
    if (!playerId || !mcKey) return;
    try {
      const clubId = await window.getClubId?.();
      if (!clubId) return;

      const mc        = _mcMap[mcKey];
      const matchDate = mc?.match_date || null;
      // TODO(cross-season): microcycles.rival is still free TEXT. GPS days now reference the
      // opponent catalog via session_attributes.opponent_id; the planner should migrate
      // microcycles.rival → opponent_id too so MC rivals compare to GPS rivals by entity.
      const rival     = mc?.rival     || '';

      if (nextMatch) nextMatch.innerHTML = matchDate
        ? `vs <strong>${rival || 'match'}</strong> · MD on ${matchDate}`
        : 'No match in this MC';

      // Sessions for this microcycle via microcycle_id FK
      const { data: sessList } = await window.sb
        .from('training_sessions')
        .select('id,session_date,session_type,session_attributes,match_day_offset')
        .eq('club_id', clubId).eq('microcycle_id', mcKey)
        .order('session_date');

      const sessions = sessList || [];

      if (!sessions.length) {
        if (kpiBody) kpiBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No sessions in this microcycle.</div>';
        if (tblBody) tblBody.innerHTML = '';
        _pwRenderVzones([]);
        return;
      }

      const sessIds = sessions.map(s => s.id);

      // GPS reports + RPE in parallel
      const [reports, { data: rpeRows }] = await Promise.all([
        window.cmFetchAll(() => window.sb.from('gps_reports')
          .select('id,session_id,total_distance,high_speed_distance,very_high_speed_distance,sprint_distance,sprint_count,max_speed,accelerations,decelerations,player_load,time_played')
          .eq('is_invalid', false)
          .eq('player_id', playerId).eq('club_id', clubId).in('session_id', sessIds), { label: 'player-profile' }).catch(() => []),
        window.sb.from('rpe')
          .select('session_id,rpe,load')
          .eq('player_id', playerId).in('session_id', sessIds),
      ]);

      const rpeMap = Object.fromEntries((rpeRows || []).map(r => [r.session_id, r.rpe]));

      const rows = sessions.map(s => ({
        session: s,
        report:  (reports || []).find(r => r.session_id === s.id) || null,
        rpe:     rpeMap[s.id] ?? null,
        mdCode:  _mdCodeForSession(s, matchDate),
      }));

      _pwCurrentRows   = rows;
      _pwCurrentClubId = clubId;

      // Match baseline for %Game — fetch for every active pct column's baseKey
      let baseline = {};
      if (typeof window.getMatchBaseline === 'function') {
        try {
          const pctKeys = [...new Set(
            _pwTableMetricCols
              .filter(c => c.type === 'pct' && c.baseKey)
              .map(c => c.baseKey)
          )];
          if (pctKeys.length) {
            const results = await Promise.all(
              pctKeys.map(k => window.getMatchBaseline(playerId, k, clubId))
            );
            pctKeys.forEach((k, i) => { baseline[k] = results[i]; });
          }
        } catch { baseline = {}; }
      }

      _pwRenderKPIs(rows);
      _pwRenderTable(rows, baseline);
      _pwRenderChart(rows);
      _pwRenderVzones(rows);
    } catch (e) { console.error('_pwLoad:', e); }
  }

  // ── KPI helpers ───────────────────────────────────────────────
  function _pwResolveChipDef(idx) {
    const override = _pwKpiOverride[idx];
    if (!override) return _PW_DEFAULT_CHIPS[idx];
    const cat = (window._gpCatalog || []).find(d => d.key === override);
    return {
      key:   override,
      label: cat?.label || override,
      unit:  override === 'total_distance' ? 'm' : (cat?.unit || ''),
      dec:   override === 'total_distance' ? 0    : (cat?.decimals ?? 0),
      agg:   override === 'max_speed' ? 'max' : 'sum',
    };
  }

  function _pwAggVal(reports, def) {
    if (!reports.length) return 0;
    if (def.agg === 'accdec') return reports.reduce((s, r) => s + (r.accelerations || 0) + (r.decelerations || 0), 0);
    if (def.agg === 'max')    return Math.max(...reports.map(r => r[def.key] || 0));
    const raw = reports.reduce((s, r) => s + (r[def.key] || 0), 0);
    return raw;   // distances stored in meters → sum as-is (no km conversion)
  }

  function _pwValHtml(val, def) {
    return `${fmtN(val, def.dec)}${def.unit ? `<sub>${def.unit}</sub>` : ''}`;
  }

  // ── KPIs ─────────────────────────────────────────────────────
  function _pwRenderKPIs(rows) {
    if (!kpiBody) return;   // card eliminada (genérica) → no-op
    const reports = rows.map(r => r.report).filter(Boolean);
    if (!reports.length) { kpiBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No GPS data for this player in this microcycle.</div>'; return; }

    const chips = _PW_DEFAULT_CHIPS.map((_, idx) => {
      const def = _pwResolveChipDef(idx);
      const val = _pwAggVal(reports, def);
      return `<div class="pw-kpi" data-kpi-idx="${idx}" data-metric-key="${def.key}">
        <span class="k-label">${def.label}</span>
        <span class="k-val">${_pwValHtml(val, def)}</span>
        <button class="pw-kpi-menu-btn" title="Change metric"><i class="ti ti-dots-vertical"></i></button>
      </div>`;
    });

    kpiBody.innerHTML = `<div class="pw-kpis">${chips.join('')}</div>`;
  }

  // ── Change-metric popup ───────────────────────────────────────
  let _pwKmPopup = null;
  let _pwKmTargetIdx = -1;

  function _pwShowKmPopup(idx, anchorEl) {
    _pwCloseKmPopup();
    _pwKmTargetIdx = idx;
    const catalog = window._gpCatalog || [];
    if (!catalog.length) return;

    const currentKey = _pwKpiOverride[idx] || _PW_DEFAULT_CHIPS[idx]?.key;

    const popup = document.createElement('div');
    popup.className = 'pw-km-popup';
    popup.innerHTML = `<div class="pw-km-popup-hd">Change metric</div>` +
      catalog.map(d =>
        `<div class="pw-km-item${d.key === currentKey ? ' is-on' : ''}" data-key="${d.key}">
          ${d.label}
          <span class="km-tag">${d.unit || ''}</span>
        </div>`
      ).join('');

    document.body.appendChild(popup);
    _pwKmPopup = popup;

    const rect = anchorEl.getBoundingClientRect();
    const top  = rect.bottom + 4;
    const left = Math.min(rect.left, window.innerWidth - 230);
    popup.style.top  = `${top}px`;
    popup.style.left = `${left}px`;

    popup.addEventListener('click', async e => {
      const item = e.target.closest('.pw-km-item');
      if (!item) return;
      await _pwSelectMetric(_pwKmTargetIdx, item.dataset.key);
      _pwCloseKmPopup();
    });

    setTimeout(() => document.addEventListener('click', _pwKmOutsideClick, { once: true }), 0);
  }

  function _pwKmOutsideClick(e) {
    if (_pwKmPopup && !_pwKmPopup.contains(e.target)) _pwCloseKmPopup();
  }

  function _pwCloseKmPopup() {
    _pwKmPopup?.remove();
    _pwKmPopup = null;
    document.removeEventListener('click', _pwKmOutsideClick);
  }

  // ── Apply metric change to a single chip ──────────────────────
  async function _pwSelectMetric(idx, metricKey) {
    _pwKpiOverride[idx] = metricKey;
    const chip = kpiBody.querySelector(`[data-kpi-idx="${idx}"]`);
    if (!chip) return;

    const cat     = (window._gpCatalog || []).find(d => d.key === metricKey);
    const isCore  = !cat || cat.is_core;
    const def     = _pwResolveChipDef(idx);

    let val = null;
    if (isCore) {
      const reports = _pwCurrentRows.map(r => r.report).filter(Boolean);
      val = _pwAggVal(reports, def);
    } else {
      // Custom metric: fetch from gps_report_metrics via report IDs
      const reportIds = _pwCurrentRows.map(r => r.report?.id).filter(Boolean);
      if (reportIds.length && _pwCurrentClubId) {
        const { data: eav } = await window.sb
          .from('gps_report_metrics')
          .select('value')
          .in('report_id', reportIds)
          .eq('metric_key', metricKey)
          .eq('club_id', _pwCurrentClubId);
        val = (eav || []).reduce((s, r) => s + (+r.value || 0), 0);
      }
    }

    chip.dataset.metricKey = metricKey;
    chip.querySelector('.k-label').textContent = def.label;
    chip.querySelector('.k-val').innerHTML = _pwValHtml(val ?? 0, def);
  }

  // Delegate "..." click on kpiBody
  kpiBody?.addEventListener('click', e => {
    const btn = e.target.closest('.pw-kpi-menu-btn');
    if (!btn) return;
    e.stopPropagation();
    const chip = btn.closest('[data-kpi-idx]');
    if (!chip) return;
    _pwShowKmPopup(+chip.dataset.kpiIdx, btn);
  });

  // ── Table cell renderer (one cell, given a column def and row) ──
  function _pwCellHtml(col, row, baseline) {
    const r = row.report;
    if (col.key === 'date')   return row.session.session_date;
    if (col.key === 'mdcode') {
      const code = row.mdCode || '—';
      return `<span class="pw-md ${mdCssKey(row.mdCode)}">${code}</span>`;
    }
    if (col.key === 'rpe') return row.rpe != null ? `<span class="pw-rpe ${rpeCls(row.rpe)}">${row.rpe}</span>` : '—';
    if (!r) return '—';
    if (col.key === 'acc_dec') return fmtN((r.accelerations || 0) + (r.decelerations || 0), 0);
    if (col.type === 'pct') {
      const bl = baseline?.[col.baseKey]?.baseline;
      const raw = r[col.baseKey];
      if (!bl || raw == null) return '—';
      const pct = Math.round(raw / bl * 100);
      return `<span class="pw-pct ${pctCls(pct)}">${pct}%</span>`;
    }
    // Regular metric column
    const cat = (window._gpCatalog || []).find(d => d.key === col.key);
    const dec = cat?.decimals ?? 0;
    const val = r[col.key];
    return val != null ? fmtN(val, dec) : '—';
  }

  // ── Table ────────────────────────────────────────────────────
  function _pwRenderTable(rows, baseline) {
    if (!tblBody) return;   // card eliminada (genérica) → no-op
    _pwCurrentBaseline = baseline;
    const allCols = [..._PW_FIXED_COLS, ..._pwTableMetricCols];

    const thAlign = col => (col.key === 'date' ? 'text-align:left' : col.key === 'mdcode' ? 'text-align:center' : 'text-align:right');
    const tdAlign = col => (col.key === 'date' ? 'text-align:left' : col.key === 'mdcode' ? 'text-align:center' : 'text-align:right');

    const header = `<tr>${allCols.map(c => `<th style="${thAlign(c)}">${c.label}</th>`).join('')}</tr>`;

    const body = rows.map(row => {
      const cells = allCols.map(c =>
        `<td style="${tdAlign(c)}">${_pwCellHtml(c, row, baseline)}</td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    tblBody.innerHTML = `<table class="pw-tbl"><thead>${header}</thead><tbody>${body}</tbody></table>`;
    requestAnimationFrame(() => {
      const ths = tblBody.querySelectorAll('.pw-tbl thead th');
      if (ths.length >= 2) {
        const l1 = ths[0].offsetWidth;
        const l2 = l1 + ths[1].offsetWidth;
        tblBody.querySelectorAll('.pw-tbl tr > :nth-child(2)').forEach(el => { el.style.left = l1 + 'px'; });
        tblBody.querySelectorAll('.pw-tbl tr > :nth-child(3)').forEach(el => { el.style.left = l2 + 'px'; });
      }
    });
  }

  // ── Column panel — load / save ────────────────────────────────
  async function _pwInitTableCols() {
    try {
      const layout = await loadLayout('ind');
      const card   = layout?.find(c => c.card_id === 'pw-table');
      if (card?.config?.columns?.length) {
        _pwTableMetricCols = card.config.columns;
        return;
      }
    } catch (e) { console.warn('_pwInitTableCols: using defaults:', e); }
    _pwTableMetricCols = _PW_DEFAULT_METRIC_COLS.map(c => ({ ...c }));
  }

  function _pwSaveTableCols() {
    const cardEl = document.getElementById('card-pw-table');
    if (cardEl) cardEl.dataset.config = JSON.stringify({ columns: _pwTableMetricCols });
    saveLayout('ind');
  }

  // ── Column panel — UI ─────────────────────────────────────────
  let _pwColPanel  = null;
  let _pwColDragSrc = null;

  function _pwOpenColPanel() {
    if (_pwColPanel) { _pwCloseColPanel(); return; }
    document.getElementById('pw-col-btn')?.classList.add('is-open');

    const catalog = window._gpCatalog || [];
    const activeKeys = new Set(_pwTableMetricCols.map(c => c.key));

    // Build available catalog items (not already active, not fixed)
    const fixedKeys = new Set(_PW_FIXED_COLS.map(c => c.key).concat(['acc_dec']));
    const available = [
      { key: 'acc_dec', label: 'Acc+Dec', type: 'metric', group: 'core' },
      ...catalog.map(d => ({
        key: d.key, label: `${d.label}${d.unit ? ' ('+d.unit+')' : ''}`,
        type: 'metric', group: d.is_core ? 'core' : 'custom',
      })),
      // %Game variants for all numeric catalog metrics (step B will use these)
      ...catalog.filter(d => d.unit).map(d => ({
        key: d.key + '_pct', label: `${d.label} %Game`,
        type: 'pct', baseKey: d.key, group: 'pct',
      })),
    ].filter(d => !activeKeys.has(d.key));

    const byGroup = g => available.filter(d => d.group === g);

    const renderActive = () => [
      ..._PW_FIXED_COLS.map(c => `
        <div class="pw-col-item is-fixed">
          <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
          <span class="col-lbl">${c.label}</span>
          <span class="col-tag">fixed</span>
        </div>`),
      ..._pwTableMetricCols.map((c, i) => `
        <div class="pw-col-item" draggable="true" data-col-idx="${i}">
          <i class="ti ti-grip-vertical drag-h"></i>
          <span class="col-lbl">${c.label}</span>
          <span class="col-tag">${c.type === 'pct' ? '%' : ''}</span>
          <button class="col-rm" data-rm-idx="${i}" title="Remove"><i class="ti ti-x" style="font-size:10px"></i></button>
        </div>`),
    ].join('');

    const renderAvailGroup = (items, title) => !items.length ? '' : `
      <div class="pw-col-sect">${title}</div>
      ${items.map(d => `
        <div class="pw-col-item" data-add-key="${d.key}" data-add-label="${d.label}" data-add-type="${d.type}" data-add-base="${d.baseKey || ''}">
          <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
          <span class="col-lbl">${d.label}</span>
          <button class="col-add" title="Add column"><i class="ti ti-plus" style="font-size:10px"></i></button>
        </div>`).join('')}`;

    const panel = document.createElement('div');
    panel.className = 'pw-col-panel';
    panel.id = 'pw-col-panel-el';
    panel.innerHTML = `
      <div class="pw-col-ph">
        <span class="ttl">Table columns</span>
        <button class="x-btn" id="pw-col-x"><i class="ti ti-x"></i></button>
      </div>
      <div class="pw-col-body" id="pw-col-body">
        <div class="pw-col-sect">Active columns</div>
        <div id="pw-col-active">${renderActive()}</div>
        <div class="pw-col-sect" style="margin-top:10px">Add column</div>
        ${renderAvailGroup(byGroup('core'),   'Core metrics')}
        ${renderAvailGroup(byGroup('custom'), 'Custom metrics')}
        ${renderAvailGroup(byGroup('pct'),    '% of Match')}
      </div>
      <div class="pw-col-footer">
        <button class="btn-reset" id="pw-col-reset">Reset</button>
        <button class="btn-save"  id="pw-col-save">Save &amp; apply</button>
      </div>`;

    document.body.appendChild(panel);
    _pwColPanel = panel;

    // Position below the Columns button, clamped to viewport
    const btn  = document.getElementById('pw-col-btn');
    const rect = btn?.getBoundingClientRect();
    if (rect) {
      const panelW = 272, vw = window.innerWidth, margin = 8;
      // Right-align panel to button's right edge, clamped so it never exits viewport
      const left = Math.max(margin, Math.min(rect.right - panelW, vw - panelW - margin));
      const maxH = Math.max(200, window.innerHeight - rect.bottom - 12);
      panel.style.top     = `${rect.bottom + 6}px`;
      panel.style.left    = `${left}px`;
      panel.style.maxHeight = `min(80vh, ${maxH}px)`;
    }

    _pwBindColPanel(panel);
    setTimeout(() => document.addEventListener('click', _pwColOutside, { once: true }), 0);
  }

  function _pwBindColPanel(panel) {
    const activeEl = panel.querySelector('#pw-col-active');

    // Remove column
    panel.addEventListener('click', e => {
      const rmBtn = e.target.closest('[data-rm-idx]');
      if (rmBtn) {
        e.stopPropagation();
        const idx = +rmBtn.dataset.rmIdx;
        _pwTableMetricCols.splice(idx, 1);
        _pwRefreshColPanel();
        return;
      }
      // Add column
      const addEl = e.target.closest('[data-add-key]');
      if (addEl) {
        e.stopPropagation();
        _pwTableMetricCols.push({
          key:     addEl.dataset.addKey,
          label:   addEl.dataset.addLabel,
          type:    addEl.dataset.addType,
          baseKey: addEl.dataset.addBase || undefined,
        });
        _pwRefreshColPanel();
        return;
      }
      // Footer buttons
      if (e.target.closest('#pw-col-x')) { _pwCloseColPanel(); return; }
      if (e.target.closest('#pw-col-save')) {
        _pwSaveTableCols();
        // Re-run full load so baselines for new %Game columns are fetched
        if (_pw.playerId && _pw.mcKey) _pwLoad();
        else if (_pwCurrentRows.length) _pwRenderTable(_pwCurrentRows, _pwCurrentBaseline);
        _pwCloseColPanel();
        return;
      }
      if (e.target.closest('#pw-col-reset')) {
        e.stopPropagation();
        _pwTableMetricCols = _PW_DEFAULT_METRIC_COLS.map(c => ({ ...c }));
        _pwRefreshColPanel();
        return;
      }
    });

    // Drag-and-drop reordering of active columns
    panel.addEventListener('dragstart', e => {
      const item = e.target.closest('[draggable][data-col-idx]');
      if (!item) return;
      _pwColDragSrc = +item.dataset.colIdx;
      item.classList.add('dragging');
    });
    panel.addEventListener('dragend', e => {
      const item = e.target.closest('[draggable]');
      item?.classList.remove('dragging');
      panel.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    panel.addEventListener('dragover', e => {
      e.preventDefault();
      const item = e.target.closest('[draggable][data-col-idx]');
      if (!item || +item.dataset.colIdx === _pwColDragSrc) return;
      panel.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    panel.addEventListener('drop', e => {
      e.preventDefault();
      const item = e.target.closest('[draggable][data-col-idx]');
      if (!item) return;
      const dst = +item.dataset.colIdx;
      if (_pwColDragSrc === dst) return;
      const moved = _pwTableMetricCols.splice(_pwColDragSrc, 1)[0];
      _pwTableMetricCols.splice(dst, 0, moved);
      _pwColDragSrc = null;
      _pwRefreshColPanel();
    });
  }

  function _pwRefreshColPanel() {
    if (!_pwColPanel) return;
    const catalog   = window._gpCatalog || [];
    const activeKeys = new Set(_pwTableMetricCols.map(c => c.key));
    const fixedKeys  = new Set(_PW_FIXED_COLS.map(c => c.key).concat(['acc_dec']));

    const available = [
      { key: 'acc_dec', label: 'Acc+Dec', type: 'metric', group: 'core' },
      ...catalog.map(d => ({
        key: d.key, label: `${d.label}${d.unit ? ' ('+d.unit+')' : ''}`,
        type: 'metric', group: d.is_core ? 'core' : 'custom',
      })),
      ...catalog.filter(d => d.unit).map(d => ({
        key: d.key + '_pct', label: `${d.label} %Game`,
        type: 'pct', baseKey: d.key, group: 'pct',
      })),
    ].filter(d => !activeKeys.has(d.key));

    const byGroup = g => available.filter(d => d.group === g);

    const renderAvailGroup = (items, title) => !items.length ? '' : `
      <div class="pw-col-sect">${title}</div>
      ${items.map(d => `
        <div class="pw-col-item" data-add-key="${d.key}" data-add-label="${d.label}" data-add-type="${d.type}" data-add-base="${d.baseKey || ''}">
          <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
          <span class="col-lbl">${d.label}</span>
          <button class="col-add" title="Add column"><i class="ti ti-plus" style="font-size:10px"></i></button>
        </div>`).join('')}`;

    const activeEl = _pwColPanel.querySelector('#pw-col-active');
    if (activeEl) activeEl.innerHTML = [
      ..._PW_FIXED_COLS.map(c => `
        <div class="pw-col-item is-fixed">
          <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
          <span class="col-lbl">${c.label}</span>
          <span class="col-tag">fixed</span>
        </div>`),
      ..._pwTableMetricCols.map((c, i) => `
        <div class="pw-col-item" draggable="true" data-col-idx="${i}">
          <i class="ti ti-grip-vertical drag-h"></i>
          <span class="col-lbl">${c.label}</span>
          <span class="col-tag">${c.type === 'pct' ? '%' : ''}</span>
          <button class="col-rm" data-rm-idx="${i}" title="Remove"><i class="ti ti-x" style="font-size:10px"></i></button>
        </div>`),
    ].join('');

    // Refresh available section (below the active list)
    const body = _pwColPanel.querySelector('#pw-col-body');
    // Remove all elements after #pw-col-active
    const activeNode = body.querySelector('#pw-col-active');
    while (activeNode.nextSibling) activeNode.nextSibling.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = `
      <div class="pw-col-sect" style="margin-top:10px">Add column</div>
      ${renderAvailGroup(byGroup('core'),   'Core metrics')}
      ${renderAvailGroup(byGroup('custom'), 'Custom metrics')}
      ${renderAvailGroup(byGroup('pct'),    '% of Match')}`;
    while (tmp.firstChild) body.appendChild(tmp.firstChild);
  }

  function _pwCloseColPanel() {
    _pwColPanel?.remove();
    _pwColPanel = null;
    document.getElementById('pw-col-btn')?.classList.remove('is-open');
    document.removeEventListener('click', _pwColOutside);
  }

  function _pwColOutside(e) {
    if (_pwColPanel && !_pwColPanel.contains(e.target) && e.target.id !== 'pw-col-btn' && !e.target.closest('#pw-col-btn')) {
      _pwCloseColPanel();
    }
  }

  document.getElementById('pw-col-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    _pwOpenColPanel();
  });

  // ── Chart ────────────────────────────────────────────────────
  function _pwRenderChart(rows) {
    if (!pwCanvas || typeof Chart === 'undefined') return;
    if (_pw.chartInst) { _pw.chartInst.destroy(); _pw.chartInst = null; }

    const labels = rows.map(r => r.mdCode || r.session.session_date);
    const hsr    = rows.map(r => r.report?.high_speed_distance || 0);
    const vhsr   = rows.map(r => r.report?.very_high_speed_distance || 0);
    const spr    = rows.map(r => r.report?.sprint_distance || 0);
    const accDec = rows.map(r => r.report ? (r.report.accelerations || 0) + (r.report.decelerations || 0) : 0);

    _pw.chartInst = new Chart(pwCanvas, {
      data: {
        labels,
        datasets: [
          { type: 'bar',  label: 'HSR (m)',    data: hsr,    backgroundColor: 'rgba(251,191,36,.7)',  stack: 'hi' },
          { type: 'bar',  label: 'VHSR (m)',   data: vhsr,   backgroundColor: 'rgba(232,121,249,.7)', stack: 'hi' },
          { type: 'bar',  label: 'Sprint (m)', data: spr,    backgroundColor: 'rgba(74,222,128,.7)',  stack: 'hi' },
          { type: 'line', label: 'Acc+Dec',    data: accDec, borderColor: 'var(--cm-accent)', backgroundColor: 'transparent', yAxisID: 'y1', tension: 0.3, pointRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y:  { stacked: true, beginAtZero: true, title: { display: true, text: 'HSR + VHSR + SPR (m)' } },
          y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Acc+Dec' }, grid: { drawOnChartArea: false } },
        },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      },
    });
  }

  // ── Velocity zones — player × MC scope ──────────────────────
  function _pwRenderVzones(rows) {
    const body = document.getElementById('vzonesBody');
    if (!body || !window.gpScience) return;

    body.innerHTML = '';
    const sub = document.querySelector('#card-vzones .sub');

    const reports = rows.map(r => r.report).filter(Boolean);
    if (!reports.length) {
      if (sub) sub.textContent = 'player · MC week';
      body.innerHTML = '<div style="color:var(--cm-fg-muted);font:500 11px/1.4 var(--cm-font-sans);padding:12px 0">No GPS data for this MC.</div>';
      return;
    }

    const mc = _mcMap[_pw.mcKey];
    if (sub) sub.textContent = `MC total · ${mc?.name || 'week'}`;

    const totals = [0, 0, 0, 0, 0];
    reports.forEach(r => {
      window.gpScience.velocityZones(r).forEach((z, i) => { totals[i] += z.dist; });
    });

    const labels = ['Z1 <7', 'Z2 7-14', 'Z3 14-20', 'Z4 20-25', 'Z5 >25'];
    const colors = ['#64748b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

    const labelRow = document.createElement('div');
    labelRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px';
    labels.forEach((l, i) => {
      const sp = document.createElement('span');
      sp.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font:500 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted)';
      sp.innerHTML = `<span style="width:8px;height:8px;border-radius:2px;background:${colors[i]};display:inline-block"></span>${l}`;
      labelRow.appendChild(sp);
    });
    body.appendChild(labelRow);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;height:22px;border-radius:5px;overflow:hidden;width:100%';
    totals.forEach((v, i) => {
      const seg = document.createElement('div');
      seg.style.cssText = `flex:${v || 0.01};background:${colors[i]};transition:flex 400ms ease`;
      seg.title = `${labels[i]}: ${v} m`;
      bar.appendChild(seg);
    });
    body.appendChild(bar);

    const valRow = document.createElement('div');
    valRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
    totals.forEach((v, i) => {
      const sp = document.createElement('span');
      sp.style.cssText = 'font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg)';
      sp.textContent = `${v} m`;
      sp.title = labels[i];
      valRow.appendChild(sp);
    });
    body.appendChild(valRow);
  }

  // ── ACWR chart — player scope ────────────────────────────────
  async function _pwUpdateAcwr(playerId) {
    const canvas = document.getElementById('canvasACWR');
    if (!canvas || !window.gpScience || !window.sb) return;
    const clubId = await window.getClubId?.();
    if (!clubId || !playerId) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 56);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: sessions } = await window.sb
      .from('training_sessions')
      .select('id,session_date')
      .eq('club_id', clubId)
      .gte('session_date', cutoffStr)
      .order('session_date', { ascending: true });

    if (!sessions?.length) return;
    const sessDateMap = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));

    const rpts = await window.cmFetchAll(() => window.sb
      .from('gps_reports')
      .select('session_id,player_load')
      .eq('is_invalid', false)
      .eq('club_id', clubId)
      .eq('player_id', playerId)
      .in('session_id', sessions.map(s => s.id)), { label: 'player-load-series' }).catch(() => []);

    const daily = (rpts || [])
      .map(r => ({ date: sessDateMap[r.session_id], load: r.player_load || 0 }))
      .filter(d => d.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const sub = document.querySelector('#card-acwr .sub');
    if (sub) sub.textContent = '8-week · player load';

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    if (!daily.length) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Unified engine: this single player's series via window.gpsACWR (club model, uncoupled) — same
    // math as the squad chart/gauges/table, just scoped to one player. Replaces gpScience.acwr.
    const _pwModel = window._gpSettings?.acwr_model || 'ewma';
    const _pwByPlayer = { [playerId]: daily.map(d => ({ date: d.date, value: d.load })) };
    const _pwSeries = window.gpsACWR?.squadTimeline
      ? window.gpsACWR.squadTimeline(_pwByPlayer, daily[0].date, daily[daily.length - 1].date, { model: _pwModel, coupled: false })
      : { dates: [], squadAcwr: [] };
    const acwrData = _pwSeries.dates.map((date, i) => ({ date, ratio: _pwSeries.squadAcwr[i] }));
    const accent   = _accentHex();
    new Chart(canvas, {
      type: 'line',
      plugins: [_acwrBandsPlugin],
      data: {
        labels: acwrData.map(d => d.date.slice(5)),
        datasets: [{
          label: 'ACWR',
          data: acwrData.map(d => d.ratio),
          borderColor: accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: acwrData.map(d =>
            !d.ratio ? 'transparent' :
            d.ratio > 1.5 ? '#ef4444' :
            d.ratio > 1.3 ? '#f59e0b' : accent
          ),
          tension: 0.35,
        }],
      },
      options: {
        ..._chartDefaults,
        maintainAspectRatio: false,   // fill the card height; resize redraws to the box
        scales: {
          x: { ..._chartDefaults.scales.x,
               ticks: { ..._chartDefaults.scales.x.ticks, autoSkip: true, maxRotation: 0, autoSkipPadding: 10 } },
          y: { ..._chartDefaults.scales.y, min: 0, max: 2,
               ticks: { ..._chartDefaults.scales.y.ticks, stepSize: 0.5,
                        callback: v => v === 0.8 ? '0.8 ✓' : v === 1.3 ? '1.3 ⚠' : v === 1.5 ? '1.5 ✗' : v } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ACWR ${ctx.parsed.y?.toFixed(2)}` } },
        },
      },
    });
  }

  // ── Fitness · Fatigue · Form — per-player TSB ────────────────
  async function _pwUpdateTsb(playerId) {
    const canvas = document.getElementById('canvasTSB');
    if (!canvas || !window.gpScience || !window.sb) return;
    const clubId = await window.getClubId?.();
    if (!clubId || !playerId) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 84);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: sessions } = await window.sb
      .from('training_sessions')
      .select('id,session_date')
      .eq('club_id', clubId)
      .gte('session_date', cutoffStr)
      .order('session_date', { ascending: true });

    if (!sessions?.length) return;
    const sessDateMap = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));

    const rpts = await window.cmFetchAll(() => window.sb
      .from('gps_reports')
      .select('session_id,player_load')
      .eq('is_invalid', false)
      .eq('club_id', clubId)
      .eq('player_id', playerId)
      .in('session_id', sessions.map(s => s.id)), { label: 'player-load-series' }).catch(() => []);

    const daily = (rpts || [])
      .map(r => ({ date: sessDateMap[r.session_id], load: r.player_load || 0 }))
      .filter(d => d.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const sub = document.querySelector('#card-tsb .sub');

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    if (!daily.length) {
      if (sub) sub.textContent = 'CTL / ATL / TSB';
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (sub) sub.textContent = '12-week · player load';

    const tsbData = window.gpScience.trainingStressBalance(daily);
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: tsbData.map(d => d.date.slice(5)),
        datasets: [
          {
            label: 'CTL (Fitness)',
            data: tsbData.map(d => d.ctl),
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            borderWidth: 2, pointRadius: 0, tension: 0.35,
          },
          {
            label: 'ATL (Fatigue)',
            data: tsbData.map(d => d.atl),
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2, pointRadius: 0, tension: 0.35,
          },
          {
            label: 'TSB (Form)',
            data: tsbData.map(d => d.tsb),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.07)',
            fill: true,
            borderWidth: 1.5, pointRadius: 0, tension: 0.35,
          },
        ]
      },
      options: {
        ..._chartDefaults,
        plugins: {
          legend: { display: true, position: 'bottom',
            labels: { font: { size: 10 }, boxWidth: 12, padding: 8, color: 'rgba(128,128,128,0.8)' } },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { ..._chartDefaults.scales.x },
          y: { ..._chartDefaults.scales.y },
        },
      }
    });
  }

  // ── events ───────────────────────────────────────────────────
  // La barra de desplegables es la única fuente: re-derivar jugador/MC y re-render.
  async function _pwReapply() {
    _pwApplyBarDate();
    _pw.playerId = _pwBarPlayerId();
    _pw.mcKey    = _pwBarMcKey();
    window._pwMcKey = _pw.mcKey;
    if (window.gpState) window.gpState.playerId = _pw.playerId;
    _pwSyncLabel();
    if (_pw.playerId && _pw.mcKey) await _pwLoad().catch(e => console.warn('_pwLoad (bar):', e));
    await renderWeeklyBars({ ...window.gpState, playerId: _pw.playerId })
      .catch(e => console.warn('renderWeeklyBars (bar):', e));
    if (_pw.playerId) _pwUpdateAcwr(_pw.playerId).catch(e => console.warn('_pwUpdateAcwr:', e));
    if (_pw.playerId) _pwUpdateTsb(_pw.playerId).catch(e => console.warn('_pwUpdateTsb:', e));
    window.refreshDashboard?.();   // radar / science cards siguen al jugador y fecha de la barra
  }
  window._pwReapply = _pwReapply;

  window._pwInit = pwInit;
  window._pwLoad = _pwLoad;

  // Cambios en la barra → re-derivar (solo cuando ind está activo).
  document.addEventListener('gpfilter:change', () => {
    if (!document.querySelector('.gp-view[data-view="ind"].is-on')) return;
    if (!_pwInited) pwInit(); else _pwReapply();
  });

  document.getElementById('sections')?.addEventListener('click', e => {
    if (!e.target.closest('.gp-sec[data-view="ind"]')) return;
    if (!_pwInited) { setTimeout(pwInit, 0); return; }
    _pwReapply();
  });

  if (document.querySelector('.gp-view[data-view="ind"].is-on')) pwInit();
})();
