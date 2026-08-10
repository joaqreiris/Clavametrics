// ══════════════════════════════════════════════════════════════
// Match Performance (vista mind) — KPIs de partido + TD chart + HI chart.
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en la
// misma posición → timing idéntico. IIFE autocontenido: expone solo window._mpInit
// (sin consumidores externos).
// ══════════════════════════════════════════════════════════════
(function () {
  const fmtN = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en', { maximumFractionDigits: d });

  // ── state & DOM ──────────────────────────────────────────────
  const _mp = { playerId: null, tdChart: null, hiChart: null };
  let _mpInited = false;
  let _mpCurrentRows = [];

  // Filtros viejos (mp-player-sel / mp-range-sel / mp-info) eliminados: la ÚNICA
  // fuente de filtrado es la barra de desplegables (gpFilterBar).
  const kpiBody = document.getElementById('mp-kpi-body');   // card mp-kpi eliminada (genérica) → puede ser null
  if (!document.querySelector('.gp-view[data-view="mind"] .gp-grid')) return;

  // ── KPI chip config (mirrors SC pattern) ─────────────────────
  const _mpKpiOverride = {};
  const _MP_PEAK_KEYS  = new Set(['max_speed','avg_speed','max_acceleration','max_deceleration','peak_speed']);
  const _MP_DEFAULT_CHIPS = [
    { key: 'total_distance',           unit: 'm',    dec: 0, agg: 'avg'   },
    { key: 'high_speed_distance',      unit: 'm',    dec: 0, agg: 'avg'   },
    { key: 'very_high_speed_distance', unit: 'm',    dec: 0, agg: 'avg'   },
    { key: 'sprint_count',             unit: '',     dec: 1, agg: 'avg'   },
    { key: 'acc_dec',                  unit: '',     dec: 1, agg: 'avg'   },
    { key: 'player_load',              unit: 'AU',   dec: 1, agg: 'avg'   },
    { key: 'max_speed',                unit: 'km/h', dec: 1, agg: 'max'   },
  ];
  const _MP_METRIC_NAMES = {
    total_distance:'Distance', high_speed_distance:'HSR',
    very_high_speed_distance:'VHSR', sprint_count:'Sprints',
    sprint_distance:'Sprint dist', acc_dec:'Acc+Dec',
    player_load:'Load', max_speed:'Speed',
    accelerations:'Accels', decelerations:'Decels', time_played:'Time',
  };
  const _MP_AGG_LABELS = { avg:'Avg', total:'Total', median:'Median', max:'Max', min:'Min' };

  function _mpChipLabel(key, agg) {
    const cat  = (window._gpCatalog || []).find(d => d.key === key);
    const base = _MP_METRIC_NAMES[key] || cat?.label || key.replace(/_/g,' ');
    return `${_MP_AGG_LABELS[agg] || 'Avg'} ${base}`;
  }
  function _mpAllowedAggs(key) {
    return _MP_PEAK_KEYS.has(key) ? ['avg','max','min'] : ['avg','total','median','max','min'];
  }
  function _mpDefaultAgg(key) { return _MP_PEAK_KEYS.has(key) ? 'max' : 'avg'; }
  function _mpResolveChipDef(idx) {
    const ov   = _mpKpiOverride[idx];
    const base = _MP_DEFAULT_CHIPS[idx] || _MP_DEFAULT_CHIPS[0];
    if (!ov) return { ...base, label: _mpChipLabel(base.key, base.agg) };
    const key = typeof ov === 'string' ? ov : ov.key;
    const agg = typeof ov === 'string' ? _mpDefaultAgg(key) : (ov.agg || _mpDefaultAgg(key));
    const cat = (window._gpCatalog || []).find(d => d.key === key);
    return { key, agg, label: _mpChipLabel(key, agg), unit: key === 'acc_dec' ? '' : (cat?.unit || ''), dec: cat?.decimals ?? 0 };
  }
  function _mpAggVal(rows, def) {
    const vals = rows.map(r => def.key === 'acc_dec' ? (r.accelerations||0)+(r.decelerations||0) : r[def.key])
      .filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    switch (def.agg) {
      case 'total':  return vals.reduce((s,v)=>s+v,0);
      case 'max':    return Math.max(...vals);
      case 'min':    return Math.min(...vals);
      case 'median': { const s=[...vals].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2===0?(s[m-1]+s[m])/2:s[m]; }
      default:       return vals.reduce((s,v)=>s+v,0)/vals.length;
    }
  }

  // KPI change-metric popup
  let _mpKmPopup = null;
  let _mpKmTargetIdx = -1;
  function _mpShowKmPopup(idx, anchorEl) {
    _mpCloseKmPopup();
    _mpKmTargetIdx = idx;
    const catalog = window._gpCatalog || [];
    if (!catalog.length) return;
    const def        = _mpResolveChipDef(idx);
    const currentKey = def.key;
    const currentAgg = def.agg;
    const allowed    = _mpAllowedAggs(currentKey);
    const popup = document.createElement('div');
    popup.className  = 'pw-km-popup';
    popup.style.minWidth = '220px';
    const aggHTML = `<div class="pw-km-popup-hd">Aggregation</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;padding:4px 6px 8px">
        ${allowed.map(a =>
          `<button class="sc-agg-btn${a===currentAgg?' is-on':''}" data-agg="${a}"
            style="flex:1;min-width:52px;height:24px;border-radius:4px;border:1px solid var(--cm-border);
            background:${a===currentAgg?'var(--cm-accent-soft)':'transparent'};
            color:${a===currentAgg?'var(--cm-fg-strong)':'var(--cm-fg-muted)'};
            font:600 11px/1 var(--cm-font-mono);cursor:pointer;padding:0 4px">
            ${_MP_AGG_LABELS[a]}</button>`).join('')}
      </div>`;
    const metricHTML = `<div class="pw-km-popup-hd" style="border-top:1px solid var(--cm-border-soft);padding-top:8px;margin-top:2px">Metric</div>` +
      catalog.map(d =>
        `<div class="pw-km-item${d.key===currentKey?' is-on':''}" data-key="${d.key}">
          ${d.label}<span class="km-tag">${d.unit||''}</span>
        </div>`).join('');
    popup.innerHTML = aggHTML + metricHTML;
    document.body.appendChild(popup);
    _mpKmPopup = popup;
    const rect = anchorEl.getBoundingClientRect();
    popup.style.top  = `${rect.bottom+4}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth-230)}px`;
    popup.addEventListener('click', e => {
      const aggBtn = e.target.closest('[data-agg]');
      if (aggBtn) { _mpSelectAgg(_mpKmTargetIdx, aggBtn.dataset.agg); _mpCloseKmPopup(); return; }
      const item = e.target.closest('.pw-km-item[data-key]');
      if (item) { _mpSelectMetric(_mpKmTargetIdx, item.dataset.key); _mpCloseKmPopup(); }
    });
    setTimeout(() => document.addEventListener('click', _mpKmOutside, { once: true }), 0);
  }
  function _mpKmOutside(e) { if (_mpKmPopup && !_mpKmPopup.contains(e.target)) _mpCloseKmPopup(); }
  function _mpCloseKmPopup() { _mpKmPopup?.remove(); _mpKmPopup = null; document.removeEventListener('click', _mpKmOutside); }
  function _mpSelectAgg(idx, agg) {
    const prev = _mpKpiOverride[idx];
    const key  = typeof prev === 'object' ? prev.key : (typeof prev === 'string' ? prev : _MP_DEFAULT_CHIPS[idx]?.key);
    _mpKpiOverride[idx] = { key, agg };
    _mpRefreshChip(idx);
    _mpSaveKpiSlots();
  }
  function _mpSelectMetric(idx, metricKey) {
    const prev   = _mpKpiOverride[idx];
    const oldAgg = typeof prev === 'object' ? prev.agg : _mpDefaultAgg(metricKey);
    const agg    = _mpAllowedAggs(metricKey).includes(oldAgg) ? oldAgg : _mpDefaultAgg(metricKey);
    _mpKpiOverride[idx] = { key: metricKey, agg };
    _mpRefreshChip(idx);
    _mpSaveKpiSlots();
  }
  function _mpRefreshChip(idx) {
    const chip = kpiBody.querySelector(`[data-kpi-idx="${idx}"]`);
    if (!chip) return;
    const def = _mpResolveChipDef(idx);
    const val = _mpAggVal(_mpCurrentRows, def);
    chip.dataset.metricKey = def.key;
    chip.querySelector('.k-label').textContent = def.label;
    chip.querySelector('.k-val').innerHTML = `${val!=null?fmtN(val,def.dec):'—'}${def.unit?`<sub>${def.unit}</sub>`:''}`;
  }

  // KPI layout persistence
  async function _mpInitKpiSlots() {
    try {
      const layout = await loadLayout('mind');
      const card = layout?.find(c => c.card_id === 'mp-kpi');
      if (card?.config?.kpi_overrides) Object.assign(_mpKpiOverride, card.config.kpi_overrides);
    } catch {}
  }
  function _mpSaveKpiSlots() {
    const cardEl = document.getElementById('card-mp-kpi');
    if (cardEl) cardEl.dataset.config = JSON.stringify({ kpi_overrides: _mpKpiOverride });
    saveLayout('mind');
  }

  // TD chart metric state
  let _mpTdMetric = 'total_distance';
  let _mpTdPopup  = null;
  function _mpShowTdMetricPopup(anchorEl) {
    _mpTdPopup?.remove(); _mpTdPopup = null;
    const catalog = window._gpCatalog || [];
    if (!catalog.length) return;
    const popup = document.createElement('div');
    popup.className = 'pw-km-popup';
    popup.innerHTML = `<div class="pw-km-popup-hd">Chart metric</div>` +
      catalog.map(d =>
        `<div class="pw-km-item${d.key===_mpTdMetric?' is-on':''}" data-key="${d.key}">
          ${d.label}<span class="km-tag">${d.unit||''}</span>
        </div>`).join('');
    document.body.appendChild(popup);
    _mpTdPopup = popup;
    const rect = anchorEl.getBoundingClientRect();
    popup.style.top  = `${rect.bottom+4}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth-230)}px`;
    popup.addEventListener('click', e => {
      const item = e.target.closest('.pw-km-item[data-key]');
      if (!item) return;
      _mpTdMetric = item.dataset.key;
      const cat = catalog.find(d => d.key === _mpTdMetric);
      const lbl = cat?.label || _mpTdMetric.replace(/_/g,' ');
      document.getElementById('mp-td-metric-label').textContent = lbl;
      const sub = document.getElementById('mp-td-sub');
      if (sub) sub.textContent = tt('gps_analysis.mp_td_sub','{metric} · minutes played line', { metric: lbl });
      _mpTdPopup?.remove(); _mpTdPopup = null;
      document.removeEventListener('click', _mpTdOutside);
      _mpRenderTDChart(_mpCurrentRows);
      _mpRenderHIChart();
    });
    setTimeout(() => document.addEventListener('click', _mpTdOutside, { once: true }), 0);
  }
  function _mpTdOutside(e) { if (_mpTdPopup && !_mpTdPopup.contains(e.target)) { _mpTdPopup?.remove(); _mpTdPopup=null; } }


  // ── init ─────────────────────────────────────────────────────
  async function mpInit() {
    if (_mpInited) return;
    _mpInited = true;
    try {
      const clubId = await window.getClubId?.();
      if (!clubId || !window.sb) return;
      await _mpInitKpiSlots();
      await _mpLoad();
    } catch (e) { console.error('mpInit:', e); }
  }

  // Rango de fechas pedido por la barra (gpFilterBar). Sin filtro de fecha → temporada
  // (~6 meses), igual que el range 'season' de las cards TD/HI.
  function _mpBarDateRange(FB) {
    const back = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    const d = FB?.date;
    if (!d || (!d.preset && !d.from && !d.to)) return { from: back(183), to: null };
    switch (d.preset) {
      case '7':      return { from: back(7),   to: null };
      case '30':     return { from: back(30),  to: null };
      case '90':     return { from: back(90),  to: null };
      case 'season': return { from: back(183), to: null };
    }
    return { from: d.from || null, to: d.to || null };
  }

  // ── KPIs de partido: alcance intrínseco = sesiones de PARTIDO; el ÚNICO filtrado
  //    del usuario es la barra de desplegables (player/posición/MD/microciclo/fecha).
  async function _mpLoad() {
    if (!kpiBody) return;
    kpiBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">Loading…</div>';
    try {
      const clubId = await window.getClubId?.();
      if (!clubId) return;
      const FB = window.gpFilterBar?.getState?.() || null;

      const { data: sessions } = await window.sb
        .from('training_sessions')
        .select('id,session_date,session_attributes,microcycle_id')
        .eq('club_id', clubId).eq('session_type', 'match')
        .order('session_date', { ascending: true });

      let matchSessions = sessions || [];
      const { from, to } = _mpBarDateRange(FB);
      if (from) matchSessions = matchSessions.filter(s => s.session_date >= from);
      if (to)   matchSessions = matchSessions.filter(s => s.session_date <= to);
      if (FB?.microcycleIds?.length) { const mc = new Set(FB.microcycleIds.map(String)); matchSessions = matchSessions.filter(s => mc.has(String(s.microcycle_id))); }
      if (FB?.mdCodes?.length)       { const md = new Set(FB.mdCodes.map(String));       matchSessions = matchSessions.filter(s => md.has(String(s.session_attributes?.md_code ?? ''))); }

      if (!matchSessions.length) { _mpCurrentRows = []; kpiBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No matches for the active filters.</div>'; return; }

      const sessIds = matchSessions.map(s => s.id);
      const reports = await window.cmFetchAll(() => _scopeTeam(window.sb
        .from('gps_reports')
        .select('session_id,player_id,total_distance,high_speed_distance,very_high_speed_distance,sprint_distance,sprint_count,max_speed,accelerations,decelerations,player_load,time_played,players!inner(position)')
        .eq('club_id', clubId)
        .eq('is_invalid', false)
        .in('session_id', sessIds)), { label: 'pos-report' })
        .catch(e => { console.error('[pos report] query failed:', e); return []; });

      let rows = reports || [];
      if (FB?.playerIds?.length) { const p = new Set(FB.playerIds);  rows = rows.filter(r => p.has(r.player_id)); }
      if (FB?.positions?.length) { const ps = new Set(FB.positions); rows = rows.filter(r => ps.has(r.players?.position)); }

      _mpCurrentRows = rows;
      _mpRenderKPIs(rows);
    } catch (e) { console.error('_mpLoad:', e); kpiBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">Error loading data.</div>'; }
  }

  // ── KPIs (configurable chips) ─────────────────────────────────
  function _mpRenderKPIs(rows) {
    if (!rows.length) {
      kpiBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No GPS data found for this player in matches.</div>'; return;
    }
    // Prepend fixed "Games" chip then configurable chips
    const gamesChip = `<div class="pw-kpi">
      <span class="k-label">Games</span>
      <span class="k-val">${rows.length}</span>
    </div>`;
    const chips = _MP_DEFAULT_CHIPS.map((_, idx) => {
      const def = _mpResolveChipDef(idx);
      const val = _mpAggVal(rows, def);
      return `<div class="pw-kpi" data-kpi-idx="${idx}" data-metric-key="${def.key}">
        <span class="k-label">${def.label}</span>
        <span class="k-val">${val!=null?fmtN(val,def.dec):'—'}${def.unit?`<sub>${def.unit}</sub>`:''}</span>
        <button class="pw-kpi-menu-btn" title="Change metric"><i class="ti ti-dots-vertical"></i></button>
      </div>`;
    });
    kpiBody.innerHTML = `<div class="pw-kpis">${gamesChip}${chips.join('')}</div>`;
  }

  // ── TD per match (métrica dinámica) — COMBO barras + línea ─────
  // Migrada al motor compartido: la métrica elegida va como BARRAS y los minutos
  // jugados como LÍNEA sobre un eje Y secundario (window.GpRender.renderCard).
  // El dato sale de los mismos `rows` de _mpLoad; sólo cambia cómo se dibuja.
  // ── Capa 2: TD y HI son cards EDITABLES del builder ───────────
  // Cada una es un config gp.card/v1 real alimentado por el RESOLVER (no por la carga
  // bespoke). Se filtran con los menús desplegables (gpFilterBar); el lápiz abre el
  // Chart builder. El primer guardado crea su fila en dashboard_cards (in-place) y
  // luego se comportan como cualquier card del usuario.
  function _mpRenderTDChart() { _mpRenderBuilderCard('#card-mp-td', _mpTdConfig); }
  function _mpRenderHIChart() { _mpRenderBuilderCard('#card-mp-hi', _mpHiConfig); }

  // Configs por defecto (semilla). 'Match metric' = COMBO (barras + minutos línea, eje
  // 2º); 'High intensity' = barras HORIZONTALES APILADAS. dimension session_date → una
  // barra por sesión; el usuario filtra jugador / matchday con los desplegables.
  function _mpTdConfig() {
    return { schema: 'gp.card/v1', title: 'Match metric', viz: 'bars', scope: { level: 'squad' },
      metrics: [{ id: 'total_distance', agg: 'avg' }, { id: 'time_played', agg: 'avg', line: true }],
      dimensions: [{ id: 'session_date' }], range: { type: 'season' }, comparison: null,
      style: { size: 'full', color: '#15803D', palette: 'pitch', axes: true, legend: true, dataLabels: false, orientation: 'vertical', stacked: false } };
  }
  function _mpHiConfig() {
    return { schema: 'gp.card/v1', title: 'Velocity zones', viz: 'bars', scope: { level: 'squad' },
      metrics: [{ id: 'high_speed_distance', agg: 'avg' }, { id: 'very_high_speed_distance', agg: 'avg' }, { id: 'sprint_distance', agg: 'avg' }],
      dimensions: [{ id: 'session_date' }], range: { type: 'season' }, comparison: null,
      style: { size: 'full', color: '#15803D', palette: 'pitch', axes: true, legend: true, dataLabels: false, orientation: 'vertical', stacked: true } };
  }

  function _mpRenderBuilderCard(cardSel, defaultCfg) {
    const el = document.querySelector(cardSel);
    if (!el || !window.GpBuilder?.resolveAndRenderCard) return;
    const cfg = defaultCfg();
    // Dedup tras recarga: si esta sigue siendo la placeholder estática (sin
    // data-card-id) pero ya existe una card GUARDADA con el mismo título en la grilla
    // (montada por gp-tabs desde dashboard_cards), la estática sobra → la quitamos.
    if (!el.dataset.cardId) {
      const grid = el.closest('.gp-grid');
      const saved = grid && [...grid.querySelectorAll('.gp-c[data-card-id] .ttl')]
        .some(t => t.textContent.trim() === cfg.title);
      if (saved) { el.remove(); return; }
    }
    if (!el.__config) el.__config = cfg;                   // semilla; tras editar+guardar el builder la reemplaza
    const pen = el.querySelector('[data-edit]');
    if (pen && !pen.__mpBound) { pen.__mpBound = true; pen.addEventListener('click', () => window.GpBuilder.openForEdit?.(el)); }
    window.GpBuilder.resolveAndRenderCard(el, el.__config);
  }


  // ── events ───────────────────────────────────────────────────
  // (Sin listeners de filtros propios: los selectores viejos se eliminaron.)

  // KPI chip menu (mp-kpi card eliminada → kpiBody puede ser null)
  kpiBody?.addEventListener('click', e => {
    const btn = e.target.closest('.pw-kpi-menu-btn');
    if (!btn) return;
    e.stopPropagation();
    const chip = btn.closest('[data-kpi-idx]');
    if (chip) _mpShowKmPopup(+chip.dataset.kpiIdx, btn);
  });

  // TD chart metric button
  document.getElementById('mp-td-metric-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    _mpShowTdMetricPopup(e.currentTarget);
  });

  // Todas las cards responden SOLO a la barra de desplegables: al cambiar un filtro
  // se refrescan los KPIs (bespoke) y se re-renderizan TD/HI (resolver). (Una vez
  // guardadas en dashboard_cards, el filter bar también re-renderiza TD/HI por
  // data-card-id; el doble render es inocuo.)
  document.addEventListener('gpfilter:change', () => { _mpLoad(); _mpRenderTDChart(); _mpRenderHIChart(); });
  setTimeout(() => { _mpRenderTDChart(); _mpRenderHIChart(); }, 1000);

  window._mpInit = mpInit;

  document.getElementById('sections')?.addEventListener('click', e => {
    if (e.target.closest('.gp-sec[data-view="mind"]')) setTimeout(mpInit, 0);
  });
})();
