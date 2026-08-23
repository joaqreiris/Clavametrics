/* ─────────────────────────────────────────────────────────────────────────
   gp-filterbar.js — Dashboard filter bar (GPS Chart Reference §6)
   PARTE A: UI + estado en memoria. Las opciones salen de DATOS REALES del club
   (MD codes, jugadores y posiciones reales). Por ahora NO filtra las cards:
   solo mantiene la selección y la expone para que la Parte B la enganche.

   API pública:
     window.gpFilterBar.getState()      → snapshot limpio de los filtros
     window.gpFilterBar.onChange(fn)     → suscribirse a cambios (devuelve unsub)
     window.gpFilterBar.reload()         → recargar opciones desde Supabase (dedupe por equipo;
                                           pasar {force:true} tras mutar datos con el mismo equipo)
     window.gpFilterBar.clearAll()       → resetear todo
   Evento DOM: document → 'gpfilter:change' (detail = getState()).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.gpFilterBar) return;

  // ── Config de los desplegables (orden de la referencia) ─────────────────
  const DROPS = [
    { key: 'md_code',    icon: 'ti-calendar-event', placeholder: 'All MD',          multi: true },
    { key: 'date',       icon: 'ti-calendar-range', placeholder: 'All time',        date: true  },
    { key: 'player',     icon: 'ti-user',           placeholder: 'All players',     multi: true },
    { key: 'position',   icon: 'ti-shirt-sport',    placeholder: 'All positions',   multi: true },
    { key: 'microcycle', icon: 'ti-calendar-week',  placeholder: 'All microcycles', multi: true },
    { key: 'rival',      icon: 'ti-ball-football',   placeholder: 'All rivals',      multi: true },
    { key: 'session_type', icon: 'ti-run',           placeholder: 'All types',       multi: true },
    { key: 'work_context', icon: 'ti-tag',           placeholder: 'All contexts',    multi: true },
  ];

  // English labels for the Add-filter menu (placeholders quedan en su idioma actual).
  const FILTER_LABELS = {
    md_code: 'Matchday', date: 'Date', player: 'Players',
    position: 'Positions', microcycle: 'Microcycle', rival: 'Rival', session_type: 'Session type',
    work_context: 'Context',
  };

  // Training-context value → i18n label (gps_reports.work_context). Raw value stays the filter
  // key (what the resolver matches); only the display label is translated. Reuses the ctx_*
  // keys from the manual tagging panel so both read identically.
  const _WC_EN = { team: 'Team', rehab: 'Rehab', individual: 'Individual', topup: 'Top-up' };
  function _wcLabel(v) {
    const en = _WC_EN[v] || v, k = 'gps_analysis.ctx_' + v;
    const t = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(k) : null;
    return (t && t !== k) ? t : en;
  }

  // Session-type value → i18n label (training_sessions.session_type). Raw value stays the
  // filter key (what the resolver matches); only the display label is translated.
  const _ST_LABELS = {
    match:'filterbar.type_match', training:'filterbar.type_training', rehab:'filterbar.type_rehab',
    conditioning:'filterbar.type_conditioning', recovery:'filterbar.type_recovery',
    tactical:'filterbar.type_tactical', gym:'filterbar.type_gym', other:'filterbar.type_other',
  };
  const _ST_EN = { match:'Match', training:'Training', rehab:'Rehab', conditioning:'Conditioning',
                   recovery:'Recovery', tactical:'Tactical', gym:'Gym', other:'Other' };
  function _stLabel(v) {
    const en = _ST_EN[v] || v, k = _ST_LABELS[v];
    if (!k) return en;
    const t = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(k) : null;
    return (t && t !== k) ? t : en;
  }

  const DATE_PRESETS = [
    { id: '7',     label: 'Last 7 days',  days: 7   },
    { id: '30',    label: 'Last 30 days', days: 30  },
    { id: '90',    label: 'Last 90 days', days: 90  },
    { id: 'season',label: 'Season',       days: 365 },
    { id: 'all',   label: 'All time',     days: null },
  ];

  // ── i18n: solo LABELS de UI (los key/id/valores de lógica quedan en inglés) ──
  const _FB_I18N = {
    'All MD':'filterbar.all_md','All time':'filterbar.all_time','All players':'filterbar.all_players',
    'All positions':'filterbar.all_positions','All microcycles':'filterbar.all_microcycles','All rivals':'filterbar.all_rivals','All types':'filterbar.all_types','All contexts':'filterbar.all_contexts',
    'Last 7 days':'filterbar.last_7','Last 30 days':'filterbar.last_30','Last 90 days':'filterbar.last_90','Season':'filterbar.season',
    'Add filter':'filterbar.add_filter','No filters':'filterbar.no_filters','Clear':'filterbar.clear',
    'All filters added':'filterbar.all_added','Remove filter':'filterbar.remove_filter','Drag to reorder':'filterbar.drag_reorder',
    'Search…':'filterbar.search','Search date…':'filterbar.search_date','No club data yet.':'filterbar.no_club_data',
    'No dates with data yet.':'filterbar.no_dates_data','No dates for the current filters.':'filterbar.no_dates_filter',
    'No options for the current filters.':'filterbar.no_options',
    'Detail':'filterbar.detail','Detailed':'filterbar.detailed','Basic':'filterbar.basic','Group':'filterbar.group',
    'Goalkeepers':'filterbar.pos_goalkeepers','Defenders':'filterbar.pos_defenders','Midfielders':'filterbar.pos_midfielders',
    'Wingers':'filterbar.pos_wingers','Forwards':'filterbar.pos_forwards'
  };
  function T(en){ const k=_FB_I18N[en]; if(!k) return en; const v=(window.CM_I18N&&CM_I18N.t)?CM_I18N.t(k):null; return (v&&v!==k)?v:en; }
  function _fbActive(n){ if(window.CM_I18N&&CM_I18N.t){ const v=CM_I18N.t('filterbar.active_filters',{count:n}); if(v&&v!=='filterbar.active_filters') return v; } return n===1?'1 active filter':`${n} active filters`; }
  // Pista discreta al pie del panel: cuántas opciones ocultó la cascada de filtros.
  function _fbHiddenHint(n){ if(window.CM_I18N&&CM_I18N.t){ const v=CM_I18N.t('filterbar.hidden_by_filters',{count:n}); if(v&&v!=='filterbar.hidden_by_filters') return v; } return n===1?'1 hidden by active filters':`${n} hidden by active filters`; }

  // ── Estado (en memoria) ─────────────────────────────────────────────────
  const state = {
    md_code:    [],                            // valores seleccionados
    player:     [],                            // ids de jugador
    position:   [],                            // posiciones
    microcycle: [],                            // ids de microciclo
    rival:      [],                            // nombres de rival (session_attributes.rival)
    session_type: [],                          // training_sessions.session_type (match/training/rehab/…)
    work_context: [],                          // gps_reports.work_context (team/rehab/individual/topup). [] = solo 'team'
    posGranularity: 'detailed',                // 'detailed' | 'basic' | 'group' — analysis roll-up
    // date: preset (Last 7/30/…) XOR days (specific real dates, multi-select) XOR a manual
    // from/to custom range. `days` is the primary picker; from/to are also set to the
    // days' min/max as a compat bound for consumers that only read from/to.
    date:       { preset: null, from: null, to: null, days: [] },
    // work_context VISIBLE por defecto (filtro "Context"): el usuario tiene que poder acotar
    // por team/rehab/individual/top-up sin cavar. Sus opciones se llenan con el set conocido
    // aunque todavía no haya datos etiquetados (ver options.work_context).
    visibleFilters: DROPS.map(d => d.key),
  };
  function isFilterVisible(key) { return state.visibleFilters.includes(key); }
  // opciones reales por desplegable: [{ value, label }]
  const options = { md_code: [], player: [], position: [], microcycle: [], rival: [], session_type: [], work_context: [], date: [] };
  // Real seasons rows (team-scoped), for a "pick a specific season" section in the date panel.
  let _seasons = [];

  // ── DEFAULT AUTOMÁTICO DE FECHA ──────────────────────────────────────────────
  // Producto: NO arrancar en "All time" (barre toda la historia → todas las cards lentas). El
  // default es la TEMPORADA actual (si existe) o los últimos 90 días. Acota el volumen → cualquier
  // card (cubierta o no por RPC) va rápida. Sólo aplica si el usuario NO fijó fecha (_dateUserSet):
  // una elección guardada (incluido "All time" explícito) manda.
  let _dateUserSet = false;
  function _dateIsSet(d) {
    return !!(d && (d.preset || d.seasonId || (Array.isArray(d.days) && d.days.length) || d.from || d.to));
  }
  function _defaultDateState() {
    const today = (typeof window !== 'undefined' && window.cmToday) ? window.cmToday() : new Date().toISOString().slice(0, 10);
    // Temporada que contiene HOY; si ninguna, la más reciente (_seasons ya viene ordenado desc).
    const s = (_seasons || []).find(x => {
      const st = String(x.start_date).slice(0, 10), en = x.end_date ? String(x.end_date).slice(0, 10) : null;
      return st <= today && (!en || today <= en);
    }) || (_seasons || [])[0];
    if (s) return { preset: 'season', from: String(s.start_date).slice(0, 10),
                    to: s.end_date ? String(s.end_date).slice(0, 10) : null, days: [], seasonId: s.id, seasonName: s.name };
    return { preset: '90', from: null, to: null, days: [] };   // sin temporadas → últimos 90 días
  }

  // 'YYYY-MM-DD' → '25 Apr 2026' (consistent, human-readable date label).
  const _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function _fmtDateLabel(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${parseInt(m[3], 10)} ${_MON[parseInt(m[2], 10) - 1]} ${m[1]}` : (iso || '');
  }

  // ── Filtros encadenados ───────────────────────────────────────────────────
  // Relación REAL del club: un gps_report por fila (date/md/mc/jugador/posición).
  // Permite, al seleccionar un filtro, acotar las opciones válidas del resto según
  // las sesiones reales (no cálculos derivados tipo getISOWeek).
  let _rows = [];            // [{ d, md, mc, p, pos }]
  let _validCache = null;    // { md_code:Set, microcycle:Set, player:Set, position:Set } | null (sin filtros)
  // position points at `posv` — the position already PROJECTED onto the active granularity —
  // so matching, the cascade and the valid-sets all work unchanged, with zero special-casing.
  const _FIELD = { md_code: 'md', microcycle: 'mc', player: 'p', position: 'posv', rival: 'rv', session_type: 'st', work_context: 'wc' };

  let _posRaw = [];   // every distinct raw position seen (primary + secondary), pre-projection
  function _posAt(raw) {
    return window.cmPositionAt ? window.cmPositionAt(raw, state.posGranularity) : (raw || null);
  }
  /** Re-project every row + rebuild the Position options for the active granularity. */
  function _applyPosGranularity() {
    _rows.forEach(r => { r.posv = _posAt(r.pos) || ''; });
    const set = new Set();
    (_posRaw || []).forEach(raw => { const v = _posAt(raw); if (v) set.add(v); });
    options.position = [...set].sort().map(v => ({ value: v, label: T(v) }));
    try { window.cmPosGranularity = state.posGranularity; } catch (_e) {}
  }
  /** Switch granularity. The selected values mean something different per level, so the
   *  position selection is cleared rather than silently mismatching. */
  function setPosGranularity(g) {
    if (!g || g === state.posGranularity) return;
    state.posGranularity = g;
    state.position = [];
    _applyPosGranularity();
    _syncGranButtons();
    renderList('position');
    _afterChange();
  }
  function _syncGranButtons() {
    root?.querySelectorAll('.fb-drop[data-key="position"] [data-gran]').forEach(b =>
      b.classList.toggle('is-on', b.dataset.gran === state.posGranularity));
  }

  function _anyFilterActive() {
    return !!(state.md_code.length || state.player.length || state.position.length || state.microcycle.length
      || state.rival.length || state.session_type.length || state.work_context.length
      || state.date.preset || state.date.from || state.date.to || (state.date.days && state.date.days.length));
  }
  // Keep from/to = min/max of the selected days, so consumers that only read from/to get
  // a correct bounding window (exact-day narrowing happens downstream in the resolver).
  function _syncDaysBounds() {
    const days = state.date.days || [];
    if (!days.length) return;
    const sorted = days.slice().sort();   // ascending 'YYYY-MM-DD'
    state.date.from = sorted[0];
    state.date.to   = sorted[sorted.length - 1];
  }
  function _dateBounds() {
    const dt = state.date;
    if (dt.seasonId && dt.from) return { from: dt.from, to: dt.to || null };   // specific season window
    if (dt.preset) {
      const p = DATE_PRESETS.find(x => x.id === dt.preset);
      const back = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
      // days == null → "All time" → no lower bound (don't collapse to today).
      return { from: (p && p.days != null) ? back(p.days) : null, to: null };
    }
    return { from: dt.from || null, to: dt.to || null };
  }
  // ¿la fila cumple TODOS los filtros activos, salvo el del propio desplegado (exceptKey)?
  function _rowMatches(r, exceptKey) {
    if (exceptKey !== 'date') {
      const days = state.date.days;
      if (days && days.length) {                          // specific dates → exact match
        if (!days.includes(r.d)) return false;
      } else {                                            // preset / custom range → bounds
        // Temporada = ventana de fechas ∪ season_id, IGUAL que el resolver (getSessionIds
        // hace `date-window OR season_id`). Las GPS importadas se linkean por season_id con
        // fecha fuera de la ventana declarada; sin esta unión la cascada las podaba y el MC de
        // esas sesiones no aparecía como opción aunque el gráfico sí las mostraba.
        const sid = state.date.seasonId;
        const bySeason = sid && r.sid && String(r.sid) === String(sid);
        if (!bySeason) {
          const { from, to } = _dateBounds();
          if (from && r.d < from) return false;
          if (to   && r.d > to)   return false;
        }
      }
    }
    if (exceptKey !== 'md_code'    && state.md_code.length    && !state.md_code.includes(r.md))    return false;
    if (exceptKey !== 'microcycle' && state.microcycle.length && !state.microcycle.includes(r.mc)) return false;
    if (exceptKey !== 'player'     && state.player.length     && !state.player.includes(r.p))      return false;
    if (exceptKey !== 'position'   && state.position.length   && !state.position.includes(r.pos))  return false;
    if (exceptKey !== 'rival'      && state.rival.length      && !state.rival.includes(r.rv))      return false;
    if (exceptKey !== 'session_type' && state.session_type.length && !state.session_type.includes(r.st)) return false;
    // work_context: default (sin selección) = SOLO 'team' (rehab/individual/top-up ocultos);
    // con selección, los contextos elegidos. Espeja el default del resolver (empty → team).
    if (exceptKey !== 'work_context') {
      if (state.work_context.length) {
        // Con contextos no-team seleccionados NO se filtra por la etiqueta de sesión: rehab/
        // individual/top-up viven en PERÍODOS (r.wc acá es casi siempre 'team'), y filtrar por
        // ella dejaba la cascada VACÍA (dropdowns sin opciones + poda de otras selecciones).
        const nonTeam = state.work_context.some(c => c !== 'team');
        if (!nonTeam && !state.work_context.includes(r.wc)) return false;
      }
      else if (r.wc && r.wc !== 'team') return false;
    }
    return true;
  }
  function _computeValidSets() {
    // OJO: TODA key de _FIELD debe tener su Set acá, si no `out[key].add` explota y rompe la cascada
    // (→ todos los filtros). work_context se agregó a _FIELD (filtro Contexto) pero faltaba acá.
    const out = { md_code: new Set(), microcycle: new Set(), player: new Set(), position: new Set(), rival: new Set(), session_type: new Set(), work_context: new Set(), date: new Set() };
    for (const r of _rows) {
      for (const key in _FIELD) if (_rowMatches(r, key)) out[key].add(r[_FIELD[key]]);
      // Date valid-set: the dates possible under the OTHER active filters → prunes the
      // date list the same way (choose rival=X ⇒ only X's dates remain selectable).
      if (r.d && _rowMatches(r, 'date')) out.date.add(r.d);
    }
    return out;
  }
  // Recalcula _validCache y poda selecciones que quedaron IMPOSIBLES (cascada estable).
  function applyChaining() {
    if (!_rows.length || !_anyFilterActive()) { _validCache = null; return; }
    for (let pass = 0; pass < 6; pass++) {
      const v = _computeValidSets();
      let pruned = false;
      for (const key in _FIELD) {
        // work_context NO se poda: sus valores (rehab/individual/top-up) viven en datos de PERÍODO,
        // no en _rows (sesión, todo 'team') → la poda los borraba del estado y la selección de
        // contextos no llegaba al resolver (bug: seleccionar los 4 no sumaba el volumen).
        if (key === 'work_context') continue;
        const before = state[key].length;
        state[key] = state[key].filter(val => v[key].has(val));
        if (state[key].length !== before) pruned = true;
      }
      // Prune selected specific dates that became impossible under the other filters.
      if (state.date.days && state.date.days.length) {
        const before = state.date.days.length;
        state.date.days = state.date.days.filter(dd => v.date.has(dd));
        if (state.date.days.length !== before) { _syncDaysBounds(); pruned = true; }
      }
      if (!pruned) break;
    }
    _validCache = _anyFilterActive() ? _computeValidSets() : null;
  }
  // Tras cualquier cambio de filtro: recalcular encadenado, refrescar todos los triggers y emitir.
  function _afterChange() {
    applyChaining();
    DROPS.forEach(d => updateTrigger(d.key));
    updateGlobal();
    fire();
  }

  const listeners = new Set();
  let root = null;
  let openKey = null;        // key del panel abierto
  let _optionsLoaded = false; // true una vez que loadData construyó las opciones (habilita la poda de valores stale)
  let _loadedTeamId = null;   // equipo con el que se completó el último loadData (null = todavía ninguno). Evita
                              // el DOBLE barrido de gps_reports en boot: boot() y el reload() de gpsInitTeamSwitch
                              // corrían loadData cada uno; con esto el segundo se saltea el fetch si el equipo no cambió.
  const drafts = {};         // selección provisional mientras el panel está abierto

  // ── Helpers de estado ───────────────────────────────────────────────────
  function isActive(key) {
    if (key === 'date') return !!(state.date.preset || state.date.from || state.date.to || (state.date.days && state.date.days.length));
    return state[key].length > 0;
  }
  function activeCount() {
    return DROPS.reduce((n, d) => n + (isActive(d.key) ? 1 : 0), 0);
  }
  function getState() {
    return {
      mdCodes:       state.md_code.slice(),
      playerIds:     state.player.slice(),
      positions:     state.position.slice(),
      microcycleIds: state.microcycle.slice(),
      rivals:        state.rival.slice(),
      sessionTypes:  state.session_type.slice(),
      workContexts:  state.work_context.slice(),   // [] = solo 'team' (default); resolver excluye no-team
      posGranularity: state.posGranularity,
      date:          { ...state.date },
      activeCount: activeCount(),
    };
  }
  // Aplicar automático: cada clic en una opción coalesce con los siguientes en una
  // sola pasada (~170 ms) para no recalcular las cards 5 veces seguidas.
  let _fireT = null;
  function fire() {
    clearTimeout(_fireT);
    _fireT = setTimeout(() => { _fireT = null; fireNow(); }, 170);
  }
  function fireNow() {
    clearTimeout(_fireT); _fireT = null;
    // El filtro ya tiene estado confiable (equipo resuelto + opciones cargadas): habilita a las
    // cards del builder a resolver (esperan este flag para no renderizar con estado provisional).
    if (typeof window !== 'undefined') window._gpFiltersReady = true;
    const snap = getState();
    persist();                                   // recuerda los filtros por dashboard
    listeners.forEach(fn => { try { fn(snap); } catch (e) { console.warn('gpFilterBar listener:', e); } });
    document.dispatchEvent(new CustomEvent('gpfilter:change', { detail: snap }));
    // Parte B: re-renderiza TODAS las cards del dashboard activo con el nuevo set.
    if (window.GpBuilder && window.GpBuilder.rerenderActiveCards) window.GpBuilder.rerenderActiveCards();
  }

  // ── Persistencia por usuario + dashboard_id (localStorage) ──────────────
  function dashId() {
    return document.querySelector('#sections .gp-sec.is-on')?.dataset.dashboardId
        || document.querySelector('.gp-view.is-on')?.dataset.view
        || 'default';
  }
  function storeKey() { return `cm_gpfilters_${window._gpUserId || '?'}_${dashId()}`; }

  function persist() {
    try {
      localStorage.setItem(storeKey(), JSON.stringify({
        md_code: state.md_code, player: state.player, position: state.position,
        microcycle: state.microcycle, rival: state.rival, session_type: state.session_type,
        work_context: state.work_context,
        // NO persistir el default automático de fecha (temporada/90d): sólo la elección real del
        // usuario. Así el default se recalcula cada carga (temporada ACTUAL) y no queda pegado.
        date: _dateUserSet ? state.date : { preset: null, from: null, to: null, days: [] },
        posGranularity: state.posGranularity,
        visibleFilters: state.visibleFilters,
      }));
    } catch (e) { /* storage no disponible */ }
  }
  function resetStateSilent() {
    state.md_code = []; state.player = []; state.position = []; state.microcycle = []; state.rival = []; state.session_type = []; state.work_context = [];
    state.date = { preset: null, from: null, to: null, days: [] };
    state.posGranularity = 'detailed';
    state.visibleFilters = DROPS.map(d => d.key);
  }
  /** Carga los filtros guardados del dashboard activo (sin disparar fire). */
  function restore() {
    resetStateSilent();
    _dateUserSet = false;
    try {
      const raw = localStorage.getItem(storeKey());
      if (raw) {
        const s = JSON.parse(raw) || {};
        state.md_code    = Array.isArray(s.md_code)    ? s.md_code    : [];
        state.player     = Array.isArray(s.player)     ? s.player     : [];
        state.position   = Array.isArray(s.position)   ? s.position   : [];
        state.microcycle = Array.isArray(s.microcycle) ? s.microcycle : [];
        state.rival      = Array.isArray(s.rival)      ? s.rival      : [];
        state.session_type = Array.isArray(s.session_type) ? s.session_type : [];
        state.work_context = Array.isArray(s.work_context) ? s.work_context : [];
        state.posGranularity = ['detailed','basic','group'].includes(s.posGranularity) ? s.posGranularity : 'detailed';
        // Fecha guardada por el usuario (incluido "All time" explícito) manda; si no hay, default abajo.
        if (s.date && typeof s.date === 'object' && _dateIsSet(s.date)) {
          state.date = { preset: s.date.preset || null, from: s.date.from || null, to: s.date.to || null, days: Array.isArray(s.date.days) ? s.date.days : [],
            seasonId: s.date.seasonId || null, seasonName: s.date.seasonName || null };
          _dateUserSet = true;
        }
        state.visibleFilters = (Array.isArray(s.visibleFilters) && s.visibleFilters.length)
          ? s.visibleFilters.filter(k => DROPS.some(d => d.key === k))
          : DROPS.map(d => d.key);
      }
    } catch (e) { /* ignore */ }
    // Sin fecha elegida por el usuario → default inteligente (temporada actual o 90 días).
    if (!_dateUserSet) state.date = _defaultDateState();
    if (root) {
      DROPS.forEach(d => updateTrigger(d.key));
      DROPS.forEach(d => root.querySelector(`.fb-drop[data-key="${d.key}"]`)?.classList.toggle('fb-hidden', !isFilterVisible(d.key)));
      refreshAddMenu();
      applyFilterOrder();
      updateGlobal();
    }
  }
  /** Al cambiar de dashboard: cierra panel, carga sus filtros y re-renderiza. */
  function onDashChange() {
    closePanel();
    restore();
    if (window.GpBuilder && window.GpBuilder.rerenderActiveCards) {
      setTimeout(() => window.GpBuilder.rerenderActiveCards(), 60);
    }
  }

  // ── Construcción del DOM ────────────────────────────────────────────────
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function buildBar() {
    const bar = el('div', 'gp-fbar');
    bar.id = 'gpFilterBar';
    const drops = el('div', 'gp-fbar-drops');

    DROPS.forEach(cfg => {
      const drop = el('div', 'fb-drop');
      drop.dataset.key = cfg.key;

      // handle de arrastre: el drag se inicia SOLO desde el grip (no rompe el click del trigger)
      const grip = el('span', 'fb-grip', `<i class="ti ti-grip-vertical"></i>`);
      grip.title = T('Drag to reorder');
      grip.addEventListener('mousedown', () => { drop.draggable = true; });
      drop.prepend(grip);
      drop.addEventListener('dragstart', e => {
        drop.classList.add('fb-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cfg.key);
      });
      drop.addEventListener('dragend', () => {
        drop.classList.remove('fb-dragging');
        drop.draggable = false;
        commitOrderFromDOM();
      });

      const trig = el('button', 'fb-trigger');
      trig.type = 'button';
      trig.innerHTML =
        `<i class="ti ${cfg.icon}"></i>` +
        `<span class="fb-trigger-label">${T(cfg.placeholder)}</span>` +
        `<span class="fb-count"></span>` +
        `<span class="fb-clear" role="button" title="${T('Clear')}"><i class="ti ti-x"></i></span>` +
        `<i class="ti ti-chevron-down fb-caret"></i>`;
      drop.appendChild(trig);
      drop.appendChild(cfg.date ? buildDatePanel() : buildMultiPanel(cfg));

      // botón de QUITAR el filtro de la barra (distinto de la ✕ de limpiar selección)
      const remove = el('span', 'fb-remove', `<i class="ti ti-x"></i>`);
      remove.setAttribute('role', 'button');
      remove.title = T('Remove filter');
      remove.addEventListener('click', (e) => { e.stopPropagation(); removeFilter(cfg.key); });
      drop.appendChild(remove);

      if (!isFilterVisible(cfg.key)) drop.classList.add('fb-hidden');
      drops.appendChild(drop);

      // toggle abrir/cerrar (no si tocan la ✕)
      trig.addEventListener('click', (e) => {
        if (e.target.closest('.fb-clear')) { clearOne(cfg.key); e.stopPropagation(); return; }
        togglePanel(cfg.key);
      });
    });

    // "+ Add filter": muestra los filtros ocultos para volver a agregarlos.
    const addWrap = el('div', 'fb-addwrap');
    const addBtn = el('button', 'fb-addfilter', `<i class="ti ti-plus"></i><span>${T('Add filter')}</span>`);
    addBtn.type = 'button';
    const addMenu = el('div', 'fb-addmenu');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !addMenu.classList.contains('is-open');
      closePanel();
      addMenu.classList.toggle('is-open', willOpen);
      if (willOpen) { refreshAddMenu(); _positionFloat(addBtn, addMenu); }
      else _clearFloat(addMenu);
    });
    addMenu.addEventListener('click', e => e.stopPropagation());
    addWrap.appendChild(addBtn);
    addWrap.appendChild(addMenu);
    // NOTE: addWrap lives OUTSIDE .gp-fbar-drops (appended to the bar below) so the
    // "+ Add filter" button stays visible instead of scrolling off with the pills.

    // reordenar por drag: mover el drop arrastrado según la posición horizontal del cursor
    drops.addEventListener('dragover', e => {
      const dragging = drops.querySelector('.fb-dragging'); if (!dragging) return;
      e.preventDefault();
      const aw = drops.querySelector('.fb-addwrap');
      const after = getDragAfterElement(drops, e.clientX);
      if (after == null) { if (aw) drops.insertBefore(dragging, aw); else drops.appendChild(dragging); }
      else drops.insertBefore(dragging, after);
    });

    applyFilterOrder();

    const right = el('div', 'gp-fbar-right');
    const global = el('span', 'fb-global', `<i class="ti ti-filter"></i><span class="fb-global-txt">${T('No filters')}</span>`);
    const clearAll = el('button', 'fb-clear-all', `<i class="ti ti-x"></i>${T('Clear')}`);
    clearAll.type = 'button';
    clearAll.addEventListener('click', clearAll_);
    right.appendChild(global);
    right.appendChild(clearAll);

    bar.appendChild(drops);
    bar.appendChild(addWrap);   // between the scrolling pills and the right-side controls
    bar.appendChild(right);
    return bar;
  }

  function buildMultiPanel(cfg) {
    // Sin botón "Aplicar": cada check/uncheck (y Seleccionar todo / Limpiar) aplica
    // al instante. El panel queda abierto para seguir tildando varias opciones.
    const panel = el('div', 'fb-panel');
    // Position gets an extra granularity switch: the SAME stored detailed code can be analysed
    // as-is, rolled up to the basic 6, or to broad groups — so baselines have a real sample
    // (a 25-man squad over ~20 detailed positions leaves ~1 player per position).
    const granHtml = cfg.key !== 'position' ? '' :
      `<div class="fb-gran">` +
        `<span class="fb-gran-l">${T('Detail')}</span>` +
        `<div class="fb-gran-seg">` +
          `<button type="button" data-gran="detailed">${T('Detailed')}</button>` +
          `<button type="button" data-gran="basic">${T('Basic')}</button>` +
          `<button type="button" data-gran="group">${T('Group')}</button>` +
        `</div>` +
      `</div>`;
    panel.innerHTML =
      `<div class="fb-search"><i class="ti ti-search"></i><input type="text" placeholder="${T('Search…')}"></div>` +
      granHtml +
      `<div class="fb-actions-top">` +
        `<button class="fb-link" type="button" data-act="all">Select all</button>` +
        `<button class="fb-link" type="button" data-act="none">Clear</button>` +
      `</div>` +
      `<div class="fb-list"><div class="fb-empty">Loading…</div></div>` +
      `<div class="fb-hidden-hint"></div>`;

    panel.addEventListener('click', e => e.stopPropagation());
    if (cfg.key === 'position') {
      panel.querySelectorAll('[data-gran]').forEach(b => {
        b.addEventListener('click', () => setPosGranularity(b.dataset.gran));
      });
    }
    panel.querySelector('.fb-search input').addEventListener('input', e => filterList(cfg.key, e.target.value));
    panel.querySelector('[data-act="all"]').addEventListener('click', () => selectAll(cfg.key, true));
    panel.querySelector('[data-act="none"]').addEventListener('click', () => selectAll(cfg.key, false));
    return panel;
  }

  function buildDatePanel() {
    const panel = el('div', 'fb-panel fb-panel-date');
    panel.innerHTML =
      `<div class="fb-presets">` +
        DATE_PRESETS.map(p => `<button class="fb-preset" type="button" data-preset="${p.id}">${T(p.label)}</button>`).join('') +
      `</div>` +
      `<div class="fb-seasons-wrap"></div>` +
      `<div class="fb-date-h">Specific dates</div>` +
      `<div class="fb-search"><i class="ti ti-search"></i><input type="text" placeholder="${T('Search date…')}"></div>` +
      `<div class="fb-actions-top">` +
        `<button class="fb-link" type="button" data-act="all">Select all</button>` +
        `<button class="fb-link" type="button" data-act="none">Clear</button>` +
      `</div>` +
      `<div class="fb-list fb-date-list"><div class="fb-empty">Loading…</div></div>` +
      `<div class="fb-hidden-hint"></div>` +
      `<details class="fb-custom">` +
        `<summary>Custom range</summary>` +
        `<div class="fb-range">` +
          `<label>From<input type="date" class="fb-date-from"></label>` +
          `<label>To<input type="date" class="fb-date-to"></label>` +
        `</div>` +
      `</details>`;

    panel.addEventListener('click', e => e.stopPropagation());
    // Presets: mutually exclusive with the date list + custom range.
    panel.querySelectorAll('.fb-preset').forEach(btn => btn.addEventListener('click', () => {
      const on = !btn.classList.contains('is-on');
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      if (on) btn.classList.add('is-on');
      drafts.date = new Set();                     // clear specific-date selection
      panel.querySelector('.fb-date-from').value = '';
      panel.querySelector('.fb-date-to').value = '';
      commitDate(panel);
      renderDateList();
    }));
    // Specific-date list: search + select all / clear.
    panel.querySelector('.fb-search input').addEventListener('input', e => filterList('date', e.target.value));
    panel.querySelector('[data-act="all"]').addEventListener('click', () => dateSelectAll(true));
    panel.querySelector('[data-act="none"]').addEventListener('click', () => dateSelectAll(false));
    // Custom range → mutually exclusive with preset + date list.
    const onRangeInput = () => {
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      drafts.date = new Set();
      renderDateList();
      commitDate(panel);
    };
    panel.querySelector('.fb-date-from').addEventListener('input', onRangeInput);
    panel.querySelector('.fb-date-to').addEventListener('input', onRangeInput);
    return panel;
  }

  // Render the real-dates checkbox list, pruned by the cascade (like rival/position).
  function renderDateList() {
    const list = root?.querySelector('.fb-drop[data-key="date"] .fb-date-list');
    if (!list) return;
    const opts = options.date || [];
    if (!opts.length) { list.innerHTML = `<div class="fb-empty">${T('No dates with data yet.')}</div>`; return; }
    const draft = drafts.date || (drafts.date = new Set());
    const valid = _validCache && _validCache.date;    // dates possible under the OTHER filters
    const shown = opts.filter(o => !valid || valid.has(o.value) || draft.has(o.value));
    _setHiddenHint('date', valid ? opts.filter(o => !valid.has(o.value) && !draft.has(o.value)).length : 0);
    if (!shown.length) { list.innerHTML = `<div class="fb-empty">${T('No dates for the current filters.')}</div>`; return; }
    list.innerHTML = shown.map(o =>
      `<label class="fb-opt"><input type="checkbox" value="${escAttr(o.value)}"${draft.has(o.value) ? ' checked' : ''}>` +
      `<span>${escHtml(o.label)}</span></label>`
    ).join('');
    list.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
      if (inp.checked) draft.add(inp.value); else draft.delete(inp.value);
      const panel = list.closest('.fb-panel');
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));  // days ⇒ no preset
      panel.querySelector('.fb-date-from').value = '';
      panel.querySelector('.fb-date-to').value = '';
      commitDate(panel);
    }));
  }

  function dateSelectAll(on) {
    const draft = drafts.date || (drafts.date = new Set());
    const panel = root.querySelector('.fb-drop[data-key="date"] .fb-panel');
    panel.querySelectorAll('.fb-date-list .fb-opt').forEach(opt => {
      if (opt.classList.contains('is-hidden')) return;   // respect the search filter
      const inp = opt.querySelector('input');
      inp.checked = on;
      if (on) draft.add(inp.value); else draft.delete(inp.value);
    });
    panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
    panel.querySelector('.fb-date-from').value = '';
    panel.querySelector('.fb-date-to').value = '';
    commitDate(panel);
  }

  // Real seasons as pick-one buttons in the date panel. With 2+ seasons the generic "Season"
  // preset (a 365-day / derived window) is ambiguous, so we hide it and let the user choose an
  // actual seasons row → the exact [start,end] window AND its id flow to the resolver.
  function renderSeasonBtns() {
    const dateDrop = root?.querySelector('.fb-drop[data-key="date"]');
    if (!dateDrop) return;
    const wrap = dateDrop.querySelector('.fb-seasons-wrap');
    if (!wrap) return;
    const genericSeason = dateDrop.querySelector('.fb-preset[data-preset="season"]');
    if (genericSeason) genericSeason.style.display = _seasons.length ? 'none' : '';
    if (!_seasons.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `<div class="fb-date-h">${T('Season')}</div><div class="fb-presets">` +
      _seasons.map(s => `<button class="fb-preset fb-season" type="button" data-id="${escAttr(s.id)}" data-from="${escAttr(s.start_date)}" data-to="${escAttr(s.end_date)}" data-name="${escAttr(s.name)}">${escHtml(s.name)}</button>`).join('') +
      `</div>`;
    wrap.querySelectorAll('.fb-season').forEach(btn => {
      if (state.date.seasonId && String(state.date.seasonId) === String(btn.dataset.id)) btn.classList.add('is-on');
      btn.addEventListener('click', () => {
        const on = !btn.classList.contains('is-on');
        const panel = btn.closest('.fb-panel');
        panel.querySelectorAll('.fb-preset, .fb-season').forEach(b => b.classList.remove('is-on'));
        drafts.date = new Set();
        panel.querySelector('.fb-date-from').value = '';
        panel.querySelector('.fb-date-to').value = '';
        if (on) {
          btn.classList.add('is-on');
          state.date = { preset: 'season', from: btn.dataset.from, to: btn.dataset.to, days: [], seasonId: btn.dataset.id, seasonName: btn.dataset.name };
        } else {
          state.date = { preset: null, from: null, to: null, days: [] };
        }
        _dateUserSet = true;   // el usuario eligió/deseleccionó fecha → su elección manda
        _afterChange();
        renderDateList();
      });
    });
  }

  // ── Render de la lista de checkboxes desde datos reales ─────────────────
  // Escribe (o limpia) la pista de "N ocultas" al pie del panel de `key`. n=0 → vacío
  // → la regla .fb-hidden-hint:empty lo colapsa, sin ocupar espacio.
  function _setHiddenHint(key, n) {
    const hint = root?.querySelector(`.fb-drop[data-key="${key}"] .fb-hidden-hint`);
    if (hint) hint.textContent = n > 0 ? _fbHiddenHint(n) : '';
  }

  function renderList(key) {
    const list = root.querySelector(`.fb-drop[data-key="${key}"] .fb-list`);
    if (!list) return;
    const opts = options[key] || [];
    if (!opts.length) { list.innerHTML = `<div class="fb-empty">${T('No club data yet.')}</div>`; return; }
    const draft = drafts[key] || new Set();
    // work_context es especial: sus valores viven en datos de PERÍODO (gps_period_reports), no en
    // los _rows de sesión del filterbar → la cascada nunca los validaría y quedarían "ocultos".
    // Se exime de la cascada: siempre se muestran todos los contextos sembrados.
    const noCascade = key === 'work_context';
    const valid = noCascade ? null : (_validCache && _validCache[key]);   // Set de valores posibles según los OTROS filtros
    // Mostrar SOLO lo elegible: las opciones imposibles no se renderizan (las ya elegidas
    // se mantienen). Se recuperan al limpiar o quitar la selección que acota.
    const shown = opts.filter(o => !valid || valid.has(o.value) || draft.has(o.value));
    // Ocultas por la cascada: excluidas por _validCache y NO ya elegidas (una selección que
    // se volvió imposible sigue visible/tildada → no cuenta). La búsqueda de texto NO suma acá.
    _setHiddenHint(key, valid ? opts.filter(o => !valid.has(o.value) && !draft.has(o.value)).length : 0);
    if (!shown.length) { list.innerHTML = `<div class="fb-empty">${T('No options for the current filters.')}</div>`; return; }
    list.innerHTML = shown.map(o =>
      `<label class="fb-opt"><input type="checkbox" value="${escAttr(o.value)}"${draft.has(o.value) ? ' checked' : ''}>` +
      (o.crest ? `<img src="${escAttr(o.crest)}" alt="" style="width:16px;height:16px;object-fit:contain;border-radius:2px;margin-right:2px" onerror="this.remove()">` : '') +
      `<span>${escHtml(o.label)}</span></label>`
    ).join('');
    list.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
      if (inp.checked) draft.add(inp.value); else draft.delete(inp.value);
      commit(key);                               // aplica al instante (debounced), panel sigue abierto
    }));
  }

  function filterList(key, q) {
    const norm = (q || '').toLowerCase().trim();
    const list = root.querySelector(`.fb-drop[data-key="${key}"] .fb-list`);
    if (!list) return;
    let anyVisible = false;
    list.querySelectorAll('.fb-opt').forEach(opt => {
      const hit = !norm || opt.textContent.toLowerCase().includes(norm);
      opt.classList.toggle('is-hidden', !hit);
      if (hit) anyVisible = true;
    });
    // Vacío claro si la búsqueda no matchea ninguna opción elegible.
    let nomatch = list.querySelector('.fb-nomatch');
    if (norm && !anyVisible) {
      if (!nomatch) { nomatch = document.createElement('div'); nomatch.className = 'fb-empty fb-nomatch'; nomatch.textContent = 'Sin coincidencias'; list.appendChild(nomatch); }
    } else if (nomatch) { nomatch.remove(); }
  }

  function selectAll(key, on) {
    const draft = drafts[key] || (drafts[key] = new Set());
    root.querySelectorAll(`.fb-drop[data-key="${key}"] .fb-opt`).forEach(opt => {
      if (opt.classList.contains('is-hidden')) return;          // respeta el filtro de búsqueda
      const inp = opt.querySelector('input');
      inp.checked = on;
      if (on) draft.add(inp.value); else draft.delete(inp.value);
    });
    commit(key);                                                // aplica al instante (debounced)
  }

  // ── Commit (Aplicar) ────────────────────────────────────────────────────
  function commit(key) {
    state[key] = Array.from(drafts[key] || []);
    _afterChange();   // recalcula opciones válidas del resto + poda imposibles
  }
  // Set PROGRAMÁTICO de un filtro — MISMO pipeline que tildar un checkbox del panel:
  // drafts → state → _afterChange (cascada de dependientes + triggers/chips + fire + rerender).
  // Lo usa el cross-filter (click en un dato de una card). NUNCA mutar `state` desde afuera:
  // saltearía drafts (el panel quedaría desincronizado), la cascada y el fire.
  //   additive:false (default) → REEMPLAZA la selección por [value]
  //   additive:true            → suma/quita sobre la selección actual
  //   toggle:true    (default) → si ya estaba filtrado por ese valor, lo limpia (undo)
  // 'date' no se soporta: su commit es especial (preset XOR days XOR rango) → commitDate.
  function setValue(key, value, opts = {}) {
    if (key === 'date' || value == null || !Array.isArray(state[key])) return false;
    const v = String(value);
    const additive = opts.additive === true;
    const toggle   = opts.toggle !== false;
    const cur = new Set((state[key] || []).map(String));
    const has = cur.has(v);
    let next;
    if (additive) { next = new Set(cur); if (toggle && has) next.delete(v); else next.add(v); }
    else          { next = (toggle && has && cur.size === 1) ? new Set() : new Set([v]); }
    drafts[key] = next;
    state[key]  = [...next];
    _afterChange();
    return true;
  }
  function commitDate(panel) {
    const presetBtn = panel.querySelector('.fb-preset.is-on');
    const days = Array.from(drafts.date || []).sort((a, b) => b.localeCompare(a));   // newest first
    const from = panel.querySelector('.fb-date-from')?.value || null;
    const to   = panel.querySelector('.fb-date-to')?.value || null;
    // Priority: preset > specific days > custom range. Mutually exclusive. When days are
    // selected, from/to are set to their min/max as a compat bound for from/to-only consumers.
    state.date = presetBtn
      ? { preset: presetBtn.dataset.preset, from: null, to: null, days: [] }
      : days.length
        ? { preset: null, from: days[days.length - 1], to: days[0], days }
        : { preset: null, from, to, days: [] };
    _dateUserSet = true;   // el usuario aplicó una fecha (preset/rango/días) → su elección manda
    _afterChange();   // date also narrows MD/player/position/microcycle/rival (symmetric cascade)
  }

  // ── Triggers (estados cerrado/activo) ───────────────────────────────────
  function updateTrigger(key) {
    const drop = root.querySelector(`.fb-drop[data-key="${key}"]`);
    const cfg  = DROPS.find(d => d.key === key);
    const labelEl = drop.querySelector('.fb-trigger-label');
    const countEl = drop.querySelector('.fb-count');
    const active  = isActive(key);
    drop.classList.toggle('is-active', active);
    drop.classList.remove('is-multi');

    if (!active) { labelEl.textContent = T(cfg.placeholder); return; }

    if (key === 'date') {
      labelEl.textContent = dateLabel();
      return;
    }
    let sel = state[key];
    const map = new Map((options[key] || []).map(o => [String(o.value), o.label]));
    // Red de seguridad: con las opciones ya cargadas, un valor seleccionado que NO existe en
    // ellas es stale (p. ej. un microciclo viejo) → lo descartamos en vez de mostrar el id crudo
    // y filtrar todo. Reejecuta las cards ya sin el filtro fantasma.
    if (_optionsLoaded && sel.length && sel.some(v => !map.has(String(v)))) {
      sel = state[key] = sel.filter(v => map.has(String(v)));
      try { persist(); } catch (_) {}
      fire();
      if (!sel.length) { drop.classList.remove('is-active'); labelEl.textContent = T(cfg.placeholder); updateGlobal(); return; }
    }
    if (sel.length === 1) {
      labelEl.textContent = map.get(String(sel[0])) || sel[0];
    } else {
      labelEl.textContent = map.get(String(sel[0])) || sel[0];
      countEl.textContent = String(sel.length);
      drop.classList.add('is-multi');
    }
  }

  function dateLabel() {
    const days = state.date.days || [];
    if (days.length) {
      if (days.length === 1) return _fmtDateLabel(days[0]);
      return `${days.length} dates`;
    }
    if (state.date.seasonId && state.date.seasonName) return state.date.seasonName;
    if (state.date.preset) {
      const p = DATE_PRESETS.find(x => x.id === state.date.preset);
      return p ? T(p.label) : state.date.preset;
    }
    const f = state.date.from, t = state.date.to;
    if (f && t && f === t) return _fmtDateLabel(f);     // single day
    if (f && t) return `${_fmtDateLabel(f)} → ${_fmtDateLabel(t)}`;
    if (f) return `From ${_fmtDateLabel(f)}`;
    if (t) return `To ${_fmtDateLabel(t)}`;
    return '';
  }

  function updateGlobal() {
    const n = activeCount();
    const g = root.querySelector('.fb-global');
    g.querySelector('.fb-global-txt').textContent =
      n === 0 ? T('No filters') : _fbActive(n);
    g.classList.toggle('is-on', n > 0);
    root.querySelector('.fb-clear-all').disabled = n === 0;
  }

  // ── Limpiar ─────────────────────────────────────────────────────────────
  function clearOne(key) {
    if (key === 'date') { state.date = { preset: null, from: null, to: null, days: [] }; _dateUserSet = true; }   // limpiar = all-time explícito (esta sesión)
    else state[key] = [];
    drafts[key] = new Set();
    applyChaining();                                  // recalcula opciones válidas (al limpiar, se amplían)
    if (openKey === key) { renderListOrDate(key); }
    DROPS.forEach(d => updateTrigger(d.key));
    updateGlobal();
    fire();
  }
  function clearAll_() {
    DROPS.forEach(d => {
      if (d.key === 'date') { state.date = { preset: null, from: null, to: null, days: [] }; _dateUserSet = true; }
      else state[d.key] = [];
      drafts[d.key] = new Set();
    });
    applyChaining();                                  // sin filtros → _validCache null → todas habilitadas
    DROPS.forEach(d => updateTrigger(d.key));
    updateGlobal();
    closePanel();
    fire();
  }

  // ── Apertura / cierre de paneles ────────────────────────────────────────
  function togglePanel(key) { (openKey === key) ? closePanel() : openPanel(key); }

  // Floating panels escape the horizontal-scroll clip: `.gp-fbar-drops` has overflow-x:auto,
  // which forces overflow-y:auto and would clip an absolutely-positioned dropdown. So we pin
  // the panel with position:fixed under its trigger, clamped to the viewport, and reposition
  // on scroll/resize (see mount()). Inline styles are cleared on close to restore the CSS.
  function _positionFloat(anchor, floatEl) {
    if (!anchor || !floatEl) return;
    const r  = anchor.getBoundingClientRect();
    const pw = floatEl.offsetWidth || 248;
    const vw = document.documentElement.clientWidth;
    let left = r.left;
    if (left + pw > vw - 8) left = Math.max(8, vw - 8 - pw);
    floatEl.style.position = 'fixed';
    floatEl.style.top  = Math.round(r.bottom + 6) + 'px';
    floatEl.style.left = Math.round(left) + 'px';
  }
  function _clearFloat(floatEl) {
    if (!floatEl) return;
    floatEl.style.position = ''; floatEl.style.top = ''; floatEl.style.left = '';
  }
  function _repositionFloats() {
    if (openKey) {
      const drop = root?.querySelector(`.fb-drop[data-key="${openKey}"]`);
      if (drop) _positionFloat(drop.querySelector('.fb-trigger'), drop.querySelector('.fb-panel'));
    }
    const am = root?.querySelector('.fb-addmenu.is-open');
    if (am) _positionFloat(am.closest('.fb-addwrap')?.querySelector('.fb-addfilter'), am);
  }

  function openPanel(key) {
    closePanel();
    openKey = key;
    const drop = root.querySelector(`.fb-drop[data-key="${key}"]`);
    drop.classList.add('is-open');
    applyChaining();                              // _validCache fresco → opciones imposibles deshabilitadas
    // arranca el draft desde el estado actual
    if (key !== 'date') drafts[key] = new Set(state[key]);
    renderListOrDate(key);
    if (key === 'position') _syncGranButtons();
    _positionFloat(drop.querySelector('.fb-trigger'), drop.querySelector('.fb-panel'));
    const focusable = drop.querySelector('.fb-search input, .fb-preset');
    if (focusable) setTimeout(() => focusable.focus(), 0);
  }
  function closePanel() {
    const am = root?.querySelector('.fb-addmenu.is-open');
    if (am) { am.classList.remove('is-open'); _clearFloat(am); }
    if (!openKey) return;
    const drop = root.querySelector(`.fb-drop[data-key="${openKey}"]`);
    if (drop) {
      drop.classList.remove('is-open');
      _clearFloat(drop.querySelector('.fb-panel'));
      const s = drop.querySelector('.fb-search input');
      if (s) { s.value = ''; filterList(openKey, ''); }
    }
    openKey = null;
  }

  // ── Visibilidad + orden de filtros ──────────────────────────────────────
  // Reordena los .fb-drop del DOM para reflejar state.visibleFilters (visibles primero
  // en su orden), luego los ocultos, y deja el "+ Add filter" siempre al final.
  function applyFilterOrder() {
    const drops = root?.querySelector('.gp-fbar-drops'); if (!drops) return;
    const addWrap = drops.querySelector('.fb-addwrap');
    state.visibleFilters.forEach(key => {
      const d = drops.querySelector(`.fb-drop[data-key="${key}"]`); if (d) drops.appendChild(d);
    });
    DROPS.forEach(cfg => { if (!isFilterVisible(cfg.key)) { const d = drops.querySelector(`.fb-drop[data-key="${cfg.key}"]`); if (d) drops.appendChild(d); } });
    if (addWrap) drops.appendChild(addWrap);
  }
  function getDragAfterElement(container, x) {
    const els = [...container.querySelectorAll('.fb-drop:not(.fb-dragging):not(.fb-hidden)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: -Infinity, element: null }).element;
  }
  function commitOrderFromDOM() {
    const drops = root.querySelector('.gp-fbar-drops');
    // SOLO las keys visibles, en el nuevo orden del DOM (los ocultos no van en visibleFilters)
    const visibleOrder = [...drops.querySelectorAll('.fb-drop:not(.fb-hidden)')].map(d => d.dataset.key);
    state.visibleFilters = visibleOrder.filter(k => DROPS.some(d => d.key === k));
    persist();
  }

  function removeFilter(key) {
    state.visibleFilters = state.visibleFilters.filter(k => k !== key);
    root?.querySelector(`.fb-drop[data-key="${key}"]`)?.classList.add('fb-hidden');
    closePanel();
    persist();
    refreshAddMenu();
    applyFilterOrder();
  }
  function addFilter(key) {
    if (!state.visibleFilters.includes(key)) state.visibleFilters.push(key);
    root?.querySelector(`.fb-drop[data-key="${key}"]`)?.classList.remove('fb-hidden');
    persist();
    refreshAddMenu();
    applyFilterOrder();
  }
  function refreshAddMenu() {
    const menu = root?.querySelector('.fb-addmenu');
    if (!menu) return;
    const hidden = DROPS.filter(d => !isFilterVisible(d.key));
    if (!hidden.length) {
      menu.innerHTML = `<div class="fb-addempty">${T('All filters added')}</div>`;
      return;
    }
    menu.innerHTML = hidden.map(d =>
      `<button class="fb-additem" type="button" data-key="${d.key}"><i class="ti ${d.icon}"></i><span>${FILTER_LABELS[d.key] || d.key}</span></button>`
    ).join('');
    menu.querySelectorAll('.fb-additem').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      addFilter(b.dataset.key);
      menu.classList.remove('is-open');
    }));
  }

  function renderListOrDate(key) {
    if (key === 'date') syncDatePanel();
    else renderList(key);
  }
  function syncDatePanel() {
    const panel = root.querySelector('.fb-drop[data-key="date"] .fb-panel');
    if (!panel) return;
    // Generic presets only (season buttons carry no data-preset; they're handled below).
    panel.querySelectorAll('.fb-preset:not(.fb-season)').forEach(b =>
      b.classList.toggle('is-on', !state.date.seasonId && state.date.preset === b.dataset.preset));
    renderSeasonBtns();   // rebuild the season buttons + mark the active one from state
    const days = state.date.days || [];
    // Custom range inputs only reflect a manual from/to (not the days' compat bound).
    const isCustom = !state.date.preset && !days.length && (state.date.from || state.date.to);
    panel.querySelector('.fb-date-from').value = isCustom ? (state.date.from || '') : '';
    panel.querySelector('.fb-date-to').value   = isCustom ? (state.date.to   || '') : '';
    // Date list draft mirrors the selected days.
    drafts.date = new Set(days);
    renderDateList();
  }

  // ── Carga de opciones REALES desde Supabase ─────────────────────────────
  // SINGLE-FLIGHT: boot() (fallback de 6s) y reload() (team-switch) pueden llamar loadData casi a
  // la vez; como la query de opciones es lenta, arrancaban DOS cargas en paralelo y cada una
  // disparaba fireNow → doble render separado en el tiempo. Si ya hay una carga en curso, se
  // reusa la misma promesa: una sola loadData, y los fireNow de ambos callers caen juntos (el
  // debounce de rerenderActiveCards los coalesce en un solo pase).
  let _loadDataP = null;
  function loadData() {
    if (_loadDataP) return _loadDataP;
    _loadDataP = _loadDataImpl().finally(() => { _loadDataP = null; });
    return _loadDataP;
  }
  async function _loadDataImpl() {
    const clubId = await window.getClubId?.();
    if (!clubId || !window.sb) return;

    const _gpTeam = window._gpTeamId || null;
    // Roster del equipo activo (por membresía player_teams, incluye secundarias e importados).
    // Se usa para ACOTAR la query de gps_reports por player_id: sin esto la consulta barre TODO el
    // club y, para un usuario con RLS restringida (p. ej. físio), evaluar las políticas anidadas
    // (session_has_my_gps → gps_reports, my_player_ids, my_team_ids) fila por fila sobre miles de
    // registros se vuelve pesado/lento → la query falla y el .catch la deja vacía → "No club data
    // yet" en TODOS los desplegables aunque las cards (que sí acotan por sesión) muestren datos.
    let _teamPlayerIds = _gpTeam ? (Array.isArray(window._gpPlayerIds) ? window._gpPlayerIds : null) : null;
    if (_gpTeam && (!_teamPlayerIds || !_teamPlayerIds.length)) {
      try { const { data: _tp } = await window.cmTeamPlayers(_gpTeam, 'id'); _teamPlayerIds = (_tp || []).map(r => r.id); }
      catch (_e) { _teamPlayerIds = null; }
    }
    const _plQ = window.sb.from('players').select('id,first_name,last_name,number,position,positions,archived_at')
      .eq('club_id', clubId).is('archived_at', null);   // exclude ARCHIVED players (players.status has no 'inactive')
    const _seQ = window.sb.from('training_sessions').select('session_date, session_attributes, match_day_offset')
      .eq('club_id', clubId).limit(3000);
    const _mcQ = window.sb.from('microcycles').select('id,name,start_date,end_date,team_id,match_date,md_overrides')
      .eq('club_id', clubId);
    // Fechas de PARTIDO para derivar el MD por fecha igual que Calendar/Load Planner (el MD no se
    // guarda por sesión: es propiedad del microciclo = partido + md_overrides). Fuentes: eventos de
    // calendario type=match + sesiones session_type=match (∪ microcycles.match_date más abajo).
    const _meQ = window.sb.from('calendar_events').select('date, team_id')
      .eq('club_id', clubId).eq('type', 'match');
    const _msQ = window.sb.from('training_sessions').select('session_date, team_id')
      .eq('club_id', clubId).eq('session_type', 'match');
    // Opponent catalog: lets the Rival dimension group by ENTITY (opponent_id / canonical
    // name) instead of the raw string, so the same rival unifies across seasons/sources.
    const _obQ = window.sb.from('opponent_branding').select('id, opponent_name, crest_url')
      .eq('club_id', clubId);
    // Real seasons for the date panel's "pick a season" section (team-or-null scope below).
    const _snQ = window.sb.from('seasons').select('id, name, team_id, start_date, end_date')
      .eq('club_id', clubId).order('start_date', { ascending: false });
    // Each query is made rejection-proof: if ANY fails, loadData still completes and reaches the
    // stale-filter prune below — otherwise a single failed query aborts the whole build and a
    // phantom persisted filter (e.g. an old microcycle id) never gets cleared.
    // AUDIT: una query Supabase con error RLS NO rechaza — resuelve con { data:null, error:{...} }.
    // Antes ese .error se descartaba en silencio → no se sabía cuál lectura dejaba vacío el filter bar
    // para un rol restringido (físio). Ahora _safe loguea el .error con su etiqueta.
    const _safe = (p, label) => Promise.resolve(p).then(
      r => { if (r && r.error) console.warn(`[gpFilterBar] ${label} error:`, r.error.message || r.error); return r; },
      e => { console.warn(`[gpFilterBar] ${label} rejected:`, e); return { data: [] }; }
    );
    const [{ data: players }, { data: sessions }, { data: _mcsRaw }, reports, { data: opponents }, { data: seasons }, { data: matchEvents }, { data: matchSess }] = await Promise.all([
      // Acotar por MEMBRESÍA (_teamPlayerIds, junction player_teams), NO por players.team_id
      // (equipo primario). Así un jugador del 2º equipo que entrena con el 1º —membresía
      // secundaria en player_teams— aparece en la lista y no queda excluido por su team_id
      // primario. Sus datos GPS ya llegaban (reports se acota con los mismos _teamPlayerIds);
      // el hueco era esta lista, que alimenta _activeIds y por tanto el player picker/posiciones.
      // Fallback a team_id primario solo si la resolución por membresía falló (RLS), para no
      // filtrar de más ni barrer todo el club.
      _safe((
        _gpTeam
          ? ((_teamPlayerIds && _teamPlayerIds.length) ? _plQ.in('id', _teamPlayerIds) : _plQ.eq('team_id', _gpTeam))
          : _plQ
      ).order('last_name'), 'players'),
      _safe(_gpTeam ? _seQ.eq('team_id', _gpTeam) : _seQ, 'sessions'),
      _safe((_gpTeam ? _mcQ.or(`team_id.eq.${_gpTeam},team_id.is.null`) : _mcQ.is('team_id', null)).order('start_date', { ascending: false }), 'microcycles'),
      // Paginated: the server caps at ~1000 rows (.limit(20000) is ignored). This feeds
      // EVERY filter dimension (md codes, rivals, players, microcycles) — truncation here
      // silently hid filter options on big clubs.
      (async () => {
        // RPC gps_filter_rows: UNA query DEFINER (sin embed anidado ni paginación, sin RLS anidada)
        // que reemplaza el barrido paginado de ~40s. Se reshapea a la forma anidada que espera el
        // mapeo de abajo. Fallback al barrido crudo si el RPC no está desplegado o falla.
        if (!(window.__cmRpcAvail && window.__cmRpcAvail.gps_filter_rows === false)) {
          try {
            const { data, error } = await window.sb.rpc('gps_filter_rows', {
              p_club_id: clubId, p_player_ids: (_teamPlayerIds && _teamPlayerIds.length) ? _teamPlayerIds : null,
            });
            if (error) throw error;
            window.__cmRpcAvail = window.__cmRpcAvail || {}; window.__cmRpcAvail.gps_filter_rows = true;
            return (data || []).map(r => ({
              player_id: r.player_id,
              work_context: r.work_context || 'team',
              training_sessions: { id: r.session_id, session_date: r.session_date, session_attributes: r.session_attributes,
                match_day_offset: r.match_day_offset, microcycle_id: r.microcycle_id, team_id: r.team_id,
                session_type: r.session_type, season_id: r.season_id },
              players: { id: r.player_id, first_name: r.first_name, last_name: r.last_name, number: r.number, position: r.player_position },
            }));
          } catch (e) {
            window.__cmRpcAvail = window.__cmRpcAvail || {}; window.__cmRpcAvail.gps_filter_rows = false;
            console.warn('[gpFilterBar] gps_filter_rows RPC unavailable — raw fallback:', e?.message || e);
          }
        }
        return window.cmFetchAll(() => {
          let _q = window.sb.from('gps_reports')
            .select('player_id, work_context, training_sessions!inner(session_date, session_attributes, match_day_offset, microcycle_id, team_id, session_type, season_id), players!inner(id, first_name, last_name, number, position)')
            .eq('club_id', clubId).eq('is_invalid', false);
          if (_teamPlayerIds && _teamPlayerIds.length) _q = _q.in('player_id', _teamPlayerIds);
          return _q;
        }, { label: 'filterbar.reports' }).catch((e) => { console.warn('[gpFilterBar] reports query failed:', e); return []; });
      })(),
      _safe(_obQ, 'opponents'),
      _safe(_snQ, 'seasons'),
      _safe(_meQ, 'matchEvents'),
      _safe(_msQ, 'matchSess'),
    ]);
    // AUDIT: resumen de lo que cada lectura trajo. Con el físio logueado + consola abierta, esta línea
    // dice EXACTAMENTE dónde está el vacío (p. ej. teamPlayers:0 → cmTeamPlayers/RLS de players/player_teams;
    // reports:0 con teamPlayers>0 → RLS de gps_reports; seasons:0 → RLS de seasons). Quitar tras diagnosticar.
    console.info('[gpFilterBar] diag', {
      clubId, team: _gpTeam, teamPlayers: (_teamPlayerIds || []).length,
      players: (players || []).length, sessions: (sessions || []).length,
      microcycles: (_mcsRaw || []).length, reports: (reports || []).length,
      seasons: (seasons || []).length, opponents: (opponents || []).length,
    });
    // Aislamiento por equipo (defensa en profundidad): aunque la query ya scopea con
    // .or(team_id.eq,is.null), si _gpTeam llegara null por una race la query traería TODO el
    // club y se colarían microciclos de OTROS equipos (mismo nombre «MC 01», ventanas de fecha
    // solapadas → las sesiones GPS sin microcycle_id se bucketean al MC ajeno). Filtramos acá
    // por team-or-null para que nunca aparezca un MC de otro equipo.
    // ESTRICTO: null (compartido) siempre pasa; el equipo actual pasa; otro equipo NUNCA — ni
    // siquiera si _gpTeam llegó null por una race (antes `!_gpTeam` dejaba pasar TODOS → se
    // colaban los «MC 01» de otros equipos). Si _gpTeam es null se ven solo los null-team hasta
    // que reload() corra con el equipo resuelto.
    const _mcTeamOk = m => m.team_id == null || (!!_gpTeam && String(m.team_id) === String(_gpTeam));
    const mcs = (_mcsRaw || []).filter(_mcTeamOk);
    // Team-or-null seasons, newest first — the "pick a season" list in the date panel.
    // Dedup: la tabla `seasons` NO tiene unique constraint y se crean filas con el mismo
    // nombre desde varios lados (Annual Planner, el "New season" de GPS, o una por equipo) →
    // «2026/27» aparecía 3 veces. Colapsamos por (nombre|inicio|fin) prefiriendo la fila del
    // equipo sobre la club-wide (null) — misma regla "el equipo gana" que _mcForDate.
    {
      const _snKey = s => `${s.name}|${String(s.start_date).slice(0, 10)}|${s.end_date ? String(s.end_date).slice(0, 10) : ''}`;
      const _isTeamSn = s => _gpTeam != null && s.team_id != null && String(s.team_id) === String(_gpTeam);
      const _snMap = new Map();
      (seasons || [])
        .filter(s => !_gpTeam || s.team_id == null || String(s.team_id) === String(_gpTeam))
        .forEach(s => {
          const k = _snKey(s), prev = _snMap.get(k);
          if (!prev || (_isTeamSn(s) && !_isTeamSn(prev))) _snMap.set(k, s);   // el del equipo desplaza al NULL
        });
      _seasons = [..._snMap.values()].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    }
    renderSeasonBtns();
    // Con las temporadas ya cargadas, (re)aplicar el default de fecha si el usuario no fijó una.
    // Cubre el path deferred (restore corrió antes de tener temporadas → default cayó a 90d) →
    // acá se hace upgrade a la temporada actual. Si el usuario eligió fecha, _dateUserSet manda.
    if (!_dateUserSet) state.date = _defaultDateState();

    // Entity resolver: opponent_id (catalog) wins; else match raw text to a catalog row
    // by name; else fall back to the normalized text. Returns a stable { key, label, crest }
    // so two "Sevilla" (any season/source) collapse to one bucket. The matcher in
    // gp-builder.js derives the SAME key from the raw text (we always store both).
    const _obById   = new Map();   // id    → { name, crest }
    const _obByName = new Map();   // lower → { id, name, crest }
    (opponents || []).forEach(o => {
      _obById.set(o.id, { name: o.opponent_name, crest: o.crest_url || null });
      _obByName.set((o.opponent_name || '').trim().toLowerCase(), { id: o.id, name: o.opponent_name, crest: o.crest_url || null });
    });
    function _rivalEntity(a) {
      a = a || {};
      let name = a.rival || a.opponent || '';
      let crest = a.rival_crest_url || null;
      const cat = a.opponent_id ? _obById.get(a.opponent_id) : null;
      if (cat) { name = cat.name || name; crest = cat.crest || crest; }
      if (!name) return null;
      const norm = name.trim().toLowerCase();
      const byName = _obByName.get(norm);
      return { key: norm, label: (cat && cat.name) || (byName && byName.name) || name, crest: crest || (byName && byName.crest) || null };
    }

    // A report belongs to this team if its session is the team's, or legacy null-team
    // (imported/old data). No active team → club-wide (fallback).
    const _teamOk = (tid) => !_gpTeam || tid == null || String(tid) === String(_gpTeam);

    // Jugadores seleccionables = SOLO los que tienen datos GPS (aparecen en gps_reports) y NO están
    // archivados. (Antes era todo el roster ∪ con-datos → aparecían jugadores del plantel sin datos
    // y jugadores archivados.) Dedup por id.
    const _activeIds = new Set((players || []).map(p => p.id));   // non-archived roster (from _plQ above)
    const _pMap = new Map();
    (reports || []).forEach(r => {
      const pl = r.players, tid = r.training_sessions?.team_id;
      if (pl && _teamOk(tid) && _activeIds.has(pl.id) && !_pMap.has(pl.id)) _pMap.set(pl.id, pl);
    });
    options.player = [..._pMap.values()]
      .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
      .map(p => ({
        value: p.id,
        label: `${p.last_name || ''} ${(p.first_name || '')[0] || ''}.${p.number ? ' #' + p.number : ''}`.trim()
                || p.id,
      }));

    // Posiciones reales (distintas, no vacías). Se guardan CRUDAS; las opciones se derivan
    // en _applyPosGranularity() según el nivel de detalle activo.
    const posSet = new Set();
    (players || []).forEach(p => {
      if (p.position) posSet.add(p.position);
      if (Array.isArray(p.positions)) p.positions.forEach(x => x && posSet.add(x));
    });
    _posRaw = Array.from(posSet);

    // MD code de una sesión: la COLUMNA match_day_offset primero (lo que escribe Daily
    // Planning), luego session_attributes.md_code como fallback. Mismo orden de prioridad
    // que _getMcMdCode() en GPS Analysis, para que el filtro y el análisis coincidan.
    const _mdRaw = (ts) => {
      const off = ts && ts.match_day_offset;
      if (off != null) {
        if (typeof off === 'string') return off || '';
        if (off === 0) return 'MD';
        return off < 0 ? `MD${off}` : `MD+${off}`;
      }
      return (ts && ts.session_attributes && ts.session_attributes.md_code) || '';
    };
    // MD by DATE, mirroring the microcycle-by-date derivation: the MD is assigned in
    // Calendar / Daily Planning (on the planned session), but the imported GPS day is usually
    // a different row with match_day_offset NULL. Map date → MD from every session that HAS an
    // MD, so a GPS day inherits the MD of the planned session on the same date. First MD wins.
    window._gpMdForDate = {};
    (sessions || []).forEach(s => {
      const v = _mdRaw(s);
      const d = s && s.session_date ? String(s.session_date).slice(0, 10) : '';
      if (v && d && !window._gpMdForDate[d]) window._gpMdForDate[d] = v;
    });
    const _mdOf = (ts) => _mdRaw(ts) || (ts && ts.session_date ? (window._gpMdForDate[String(ts.session_date).slice(0, 10)] || '') : '');
    // options.md_code se construye MÁS ABAJO (tras _rows), para incluir los MD DERIVADOS del
    // microciclo (partido + md_overrides), no solo los guardados por Daily Planning.

    // Asociación por FECHA: los training_sessions casi nunca traen microcycle_id seteado, así
    // que un GPS pertenece al microciclo cuya ventana [start_date, end_date] contiene su
    // session_date. Resolver: de los MC con start <= d, el de mayor start que aún contenga d
    // (end null = abierto). Se expone en window para que gp-builder filtre igual.
    const _mcRanges = (mcs || [])
      .filter(m => m.start_date)
      .map(m => ({
        id:    String(m.id),
        start: String(m.start_date).slice(0, 10),
        end:   m.end_date ? String(m.end_date).slice(0, 10) : null,
        team:  m.team_id != null ? String(m.team_id) : null,
      }))
      .sort((a, b) => a.start.localeCompare(b.start));
    // Un día puede caer dentro de un MC del equipo Y de uno club-wide (team_id NULL) con la
    // MISMA ventana → antes se elegían ambos y el filtro mostraba «MC 01» duplicado. Regla:
    // el MC del equipo SIEMPRE gana; el NULL solo aplica a fechas que ningún MC del equipo cubre.
    const _gpTeamS = _gpTeam != null ? String(_gpTeam) : null;
    function _mcForDate(d) {
      if (!d) return '';
      d = String(d).slice(0, 10);
      let hit = '', hitTeam = false;
      for (const m of _mcRanges) {
        if (m.start > d) break;                        // orden asc → no hay match más adelante
        if (m.end == null || d <= m.end) {             // mayor start <= d que aún contiene d
          const isTeam = _gpTeamS != null && m.team === _gpTeamS;
          if (isTeam && !hitTeam) { hit = m.id; hitTeam = true; }   // el del equipo desplaza al NULL previo
          else if (isTeam === hitTeam) hit = m.id;                  // misma prioridad → gana el de start más tardío
        }
      }
      return hit;
    }
    window._gpMcForDate = _mcForDate;

    // ── MD derivado del microciclo (igual que Calendar/Load Planner) ──────────────
    // El MD NO se guarda por sesión: es propiedad del microciclo = fecha(s) de partido + md_overrides
    // (Calendar `applyMdChoice` escribe md_overrides, no la sesión). Para que el MD aparezca en GPS
    // sin asignarlo a mano, lo derivamos por fecha: el override del microciclo que contiene el día
    // gana; si no, se calcula por cercanía al partido con el MISMO algoritmo/umbrales que
    // mdLabelFromSet de Load Planner. Formato ASCII ('MD-2'/'MD+1'/'MD'), consistente con lo guardado.
    const _mcById = {}; (mcs || []).forEach(m => { _mcById[String(m.id)] = m; });
    const _mTeamOk = tid => !_gpTeamS || tid == null || String(tid) === _gpTeamS;
    const _matchSet = new Set();
    (mcs || []).forEach(m => { if (m.match_date) _matchSet.add(String(m.match_date).slice(0, 10)); });
    (matchEvents || []).forEach(r => { if (r.date && _mTeamOk(r.team_id)) _matchSet.add(String(r.date).slice(0, 10)); });
    (matchSess   || []).forEach(r => { if (r.session_date && _mTeamOk(r.team_id)) _matchSet.add(String(r.session_date).slice(0, 10)); });
    const _matchArr = [..._matchSet].sort();
    const _dDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
    function _mdFromMatches(ds) {
      if (!_matchArr.length) return '';
      if (_matchArr.indexOf(ds) >= 0) return 'MD';
      const next = _matchArr.find(d => d > ds), prev = [..._matchArr].reverse().find(d => d < ds);
      const cand = [];
      if (next) { const dn = _dDiff(ds, next); if (dn >= 1 && dn <= 10) cand.push({ v: dn, lbl: 'MD-' + dn }); }
      if (prev) { const dp = _dDiff(prev, ds); if (dp >= 1 && dp <= 3) cand.push({ v: dp, lbl: 'MD+' + dp }); }
      if (!cand.length) return '';
      cand.sort((a, b) => a.v - b.v);
      return cand[0].lbl;
    }
    function _mdDerived(ds) {
      if (!ds) return '';
      ds = String(ds).slice(0, 10);
      const mc = _mcById[_mcForDate(ds)];
      const ov = mc && mc.md_overrides ? mc.md_overrides[ds] : null;
      if (ov) return ov === 'OFF' ? '' : String(ov);   // override del usuario gana; OFF = sin MD
      return _mdFromMatches(ds);
    }
    window._gpMdDerived = _mdDerived;
    // Rellenar fecha→MD con el derivado donde NO haya MD guardado (las sesiones de GPS importadas
    // no lo tienen). El guardado por Daily Planning conserva prioridad (ya está en el mapa).
    (reports || []).forEach(r => {
      const d = r.training_sessions && r.training_sessions.session_date ? String(r.training_sessions.session_date).slice(0, 10) : '';
      if (d && !window._gpMdForDate[d]) { const v = _mdDerived(d); if (v) window._gpMdForDate[d] = v; }
    });

    // Resolución del MC de una sesión: el microcycle_id GUARDADO manda (fuente autoritativa;
    // apunta a UN microciclo, sin ambigüedad ni duplicados) SIEMPRE que ese id exista en el
    // scope team-or-null. Solo si viene NULL o apunta fuera de scope se cae a la ventana de
    // fechas. Antes era 100% por fecha, y si las ventanas [start,end] no cubrían las fechas
    // reales de los entrenamientos el filtro quedaba vacío aunque las sesiones tuvieran su MC.
    const _validMcIds = new Set((mcs || []).map(m => String(m.id)));
    function _mcOfSession(ts) {
      const raw = ts && ts.microcycle_id != null ? String(ts.microcycle_id) : '';
      if (raw && _validMcIds.has(raw)) return raw;
      return _mcForDate(ts && ts.session_date);
    }
    window._gpMcOfSession = _mcOfSession;

    // Microciclos SELECCIONABLES = solo los que tienen datos GPS. value = id; etiqueta REAL (mc.name).
    // De paso registramos el rango REAL de fechas observado en las sesiones de cada MC (por
    // microcycle_id), para ampliar su ventana de fetch más abajo.
    const _mcWithData = new Set();
    const _mcObs = {};   // id → { min, max } de session_date reales
    (reports || []).filter(r => _teamOk(r.training_sessions?.team_id)).forEach(r => {
      const ts = r.training_sessions;
      const id = _mcOfSession(ts);
      if (!id) return;
      _mcWithData.add(id);
      const d = ts && ts.session_date ? String(ts.session_date).slice(0, 10) : '';
      if (d) {
        const o = _mcObs[id] || (_mcObs[id] = { min: d, max: d });
        if (d < o.min) o.min = d;
        if (d > o.max) o.max = d;
      }
    });

    // id → ventana [start,end] del microciclo para que gp-builder scopee el FETCH por FECHA
    // cuando el bar tiene microciclo(s) elegido(s). Es la UNIÓN de la ventana declarada
    // [start_date,end_date] y el rango real observado en las sesiones: si el MC se guardó con
    // fechas que no cubren sus entrenamientos, el fetch por ventana igual los alcanza.
    window._gpMcRangeById = {};
    _mcRanges.forEach(m => { window._gpMcRangeById[m.id] = { start: m.start, end: m.end }; });
    Object.keys(_mcObs).forEach(id => {
      const cur = window._gpMcRangeById[id];
      const obs = _mcObs[id];
      if (!cur) { window._gpMcRangeById[id] = { start: obs.min, end: obs.max }; return; }
      if (obs.min < cur.start) cur.start = obs.min;
      if (cur.end != null && obs.max > cur.end) cur.end = obs.max;   // end null = abierto, ya cubre
    });
    const _mcLabel = m => m.name || (m.start_date ? `MC ${String(m.start_date).slice(0, 10)}` : String(m.id));
    options.microcycle = (mcs || [])
      .filter(m => _mcWithData.has(String(m.id)))
      .map(m => ({ value: String(m.id), label: _mcLabel(m) }));
    // id → etiqueta para que el resolver muestre el NOMBRE del MC en la columna Microcycle
    // (la asociación es por fecha vía _gpMcForDate). Incluye todos los MC, no solo con datos.
    window._gpMcLabelById = {};
    (mcs || []).forEach(m => { window._gpMcLabelById[String(m.id)] = _mcLabel(m); });

    // Relación real (un gps_report por fila) para el encadenado de filtros — scopeada
    // al equipo (team-or-null), igual que los datos que muestra el resolver.
    _rows = (reports || []).filter(r => _teamOk(r.training_sessions?.team_id)).map(r => {
      const ts = r.training_sessions || {};
      return {
        d:   ts.session_date || '',
        sid: ts.season_id != null ? String(ts.season_id) : '',   // link explícito a temporada (GPS importadas)
        md:  _mdOf(ts),
        mc:  _mcOfSession(ts),   // microcycle_id guardado primero; fecha como fallback
        p:   r.player_id,
        pos: r.players?.position || '',
        rv:  _rivalEntity(ts.session_attributes)?.key || '',
        st:  ts.session_type || '',
        wc:  r.work_context || 'team',   // contexto del dato (team/rehab/individual/topup), por registro
      };
    }).filter(x => x.d);
    _applyPosGranularity();   // fills row.posv + options.position for the active level

    // MD codes de las opciones = los MD resueltos de las filas GPS (guardado ∪ derivado del
    // microciclo), para que el filtro ofrezca lo mismo que muestran las cards.
    options.md_code = [...new Set(_rows.map(r => r.md))].filter(Boolean)
      .sort(mdCompare).map(v => ({ value: v, label: v }));

    // Session types reales (distintos, no vacíos) — value = raw type, label = traducido.
    options.session_type = [...new Set(_rows.map(r => r.st))].filter(Boolean)
      .sort((a, b) => _stLabel(a).localeCompare(_stLabel(b)))
      .map(v => ({ value: v, label: _stLabel(v) }));

    // Training context: set conocido (team/rehab/individual/topup) UNIÓN lo que haya en datos,
    // así el filtro "Context" es usable aunque todavía no se haya etiquetado nada. 'team' primero;
    // el resto alfabético. value = raw, label = traducido.
    options.work_context = [...new Set(['team', 'rehab', 'individual', 'topup', ..._rows.map(r => r.wc)])].filter(Boolean)
      .sort((a, b) => (a === 'team' ? -1 : b === 'team' ? 1 : _wcLabel(a).localeCompare(_wcLabel(b))))
      .map(v => ({ value: v, label: _wcLabel(v) }));

    // Real dates with data → the date filter's list (distinct, newest first).
    options.date = [...new Set(_rows.map(r => r.d))].filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .map(d => ({ value: d, label: _fmtDateLabel(d) }));

    // Rivals reales agrupados por ENTIDAD (opponent_id / nombre canónico), con escudo.
    // key = nombre normalizado (lo que matchea el resolver); label = nombre canónico.
    const rivalMap = new Map();   // key → { label, crest }
    (reports || []).filter(r => _teamOk(r.training_sessions?.team_id)).forEach(r => {
      const ent = _rivalEntity(r.training_sessions?.session_attributes);
      if (ent && !rivalMap.has(ent.key)) rivalMap.set(ent.key, { label: ent.label, crest: ent.crest });
    });
    options.rival = [...rivalMap.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([key, v]) => ({ value: key, label: v.label, crest: v.crest }));

    // Auto-sanado: descartar cualquier valor persistido/restaurado que ya NO exista en las
    // opciones actuales (p. ej. un id de microciclo viejo o sin datos). Si no, el chip muestra
    // el id crudo (UUID) y filtra todo → "No data".
    let _pruned = false;
    ['md_code','player','position','microcycle','rival','session_type','work_context'].forEach(k => {
      if (!Array.isArray(state[k]) || !state[k].length) return;
      const valid = new Set((options[k] || []).map(o => String(o.value)));
      const before = state[k].length;
      state[k] = state[k].filter(v => valid.has(String(v)));
      if (state[k].length !== before) _pruned = true;
    });

    _optionsLoaded = true;   // habilita la red de seguridad del chip (updateTrigger)
    _loadedTeamId = _gpTeam != null ? String(_gpTeam) : '__none__';   // scope con el que quedaron cargadas las opciones
    applyChaining();   // si había filtros restaurados, deja _validCache listo
    if (_pruned) {
      try { persist(); } catch (_) {}
      if (root) { DROPS.forEach(d => updateTrigger(d.key)); updateGlobal(); }
      fire();          // re-corre las cards ya sin el filtro fantasma
    }

    // re-render del panel abierto si corresponde
    if (openKey === 'date') syncDatePanel();
    else if (openKey) renderList(openKey);
  }

  // Orden natural de MD codes: MD-4 < MD-3 < … < MD < MD+1 < MD+2
  function mdCompare(a, b) {
    const off = s => {
      const m = /MD\s*([+-]?\d+)?/i.exec(s);
      if (!m) return 999;
      return m[1] ? parseInt(m[1], 10) : 0;
    };
    const d = off(a) - off(b);
    return d !== 0 ? d : a.localeCompare(b);
  }

  // ── util ────────────────────────────────────────────────────────────────
  function escHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  // ── Montaje ─────────────────────────────────────────────────────────────
  function mount() {
    if (root) return;
    const page = document.querySelector('.gp-page');
    if (!page) return;
    root = buildBar();
    // arriba de la grilla: justo después de la barra de dashboard existente
    const anchor = page.querySelector('.gp-dash-bar') || page.querySelector('.gp-view');
    if (anchor) anchor.insertAdjacentElement('afterend', root);
    else page.appendChild(root);

    DROPS.forEach(d => updateTrigger(d.key));
    updateGlobal();

    // cerrar al click fuera / Escape
    document.addEventListener('click', e => { if (root && !root.contains(e.target)) closePanel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
    // keep fixed-positioned panels glued to their trigger while the bar scrolls or the window resizes
    window.addEventListener('resize', _repositionFloats);
    window.addEventListener('scroll', _repositionFloats, true);   // capture: catches the .gp-fbar-drops scroll too

    // cambiar de dashboard (tab) → cargar los filtros guardados de ese dashboard
    document.getElementById('sections')?.addEventListener('click', e => {
      if (e.target.closest('.gp-sec')) setTimeout(onDashChange, 0);
    });

    // re-traducir labels de UI al cambiar idioma (sin re-fetch; preserva estado/selección)
    document.addEventListener('cm:langchanged', () => {
      try {
        options.session_type = options.session_type.map(o => ({ value: o.value, label: _stLabel(o.value) }));
        DROPS.forEach(d => updateTrigger(d.key));
        updateGlobal();
        if (openKey === 'session_type') renderList('session_type');
        const ab = root.querySelector('.fb-addfilter span'); if (ab) ab.textContent = T('Add filter');
        const ca = root.querySelector('.fb-clear-all'); if (ca && ca.lastChild) ca.lastChild.textContent = T('Clear');
        root.querySelectorAll('.fb-clear').forEach(c => c.title = T('Clear'));
        root.querySelectorAll('.fb-remove').forEach(c => c.title = T('Remove filter'));
      } catch (e) {}
    });
  }

  // espera a tener sesión/club y carga datos (la barra ya está visible mientras)
  async function boot() {
    mount();
    if (!root) return;
    for (let i = 0; i < 50; i++) {
      if (window.sb && window.getClubId) {
        // Aislamiento por equipo: si la página tiene selector de equipo (gpsTeamSelect) esperamos
        // a que _gpTeamId quede resuelto ANTES de la primera carga. Sin esto, loadData corre con
        // _gpTeamId=null → trae microciclos/datos de TODO el club (se colaban MC de otros equipos).
        const _hasTeamSel = !!document.getElementById('gpsTeamSelect');
        if (_hasTeamSel && !window._gpTeamId) {
          for (let j = 0; j < 25 && !window._gpTeamId; j++) await new Promise(r => setTimeout(r, 100));
        }
        // Si hay selector de equipo y el equipo TODAVÍA no se resolvió, NO cargamos con scope
        // whole-club: sería un barrido pesado de gps_reports con datos de TODOS los equipos que
        // después hay que descartar, y gpsInitTeamSwitch llamará reload() apenas resuelva el
        // equipo → esa sería la ÚNICA carga (con el scope correcto). Dejamos los filtros
        // restaurados y las cards en su estado "Loading…" (sin flash de datos equivocados).
        if (_hasTeamSel && !window._gpTeamId) {
          restore();
          // Red de seguridad: si por lo que sea reload() nunca llega, cargamos igual a los 6s.
          setTimeout(() => {
            if (_loadedTeamId == null) {
              loadData().then(() => { try { fireNow(); } catch (_) {} }).catch(e => console.warn('gpFilterBar boot-fallback:', e));
            }
          }, 6000);
          return;
        }
        try { await loadData(); } catch (e) { console.warn('gpFilterBar loadData:', e); }
        // restaurar filtros persistidos del dashboard activo + re-render
        restore();
        // El bar ya está listo (sb + club + opciones + filtros restaurados): notificar
        // SIEMPRE (no solo si hay filtros activos) para que TODAS las cards se rendericen
        // con el contexto correcto. Despierta cualquier card que montó antes de tiempo
        // (incluidas las que escuchan 'gpfilter:change', no solo las data-card-id).
        setTimeout(() => { try { fireNow(); } catch (e) { console.warn('gpFilterBar boot fire:', e); } }, 120);
        return;
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }
  function isAnyActive() { return DROPS.some(d => isActive(d.key)); }

  // ── API pública ─────────────────────────────────────────────────────────
  window.gpFilterBar = {
    getState,
    // Player options shown in the global filter (current roster ∪ anyone with GPS
    // data in this team's sessions). Reused by the per-card player picker.
    getPlayerOptions() { return options.player.slice(); },   // [{ value:id, label }]
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setValue,   // set programático (cross-filter) — mismo pipeline que un click de checkbox
    clearAll: clearAll_,
    // reload() recarga las opciones/rangos (p.ej. tras resolverse el equipo o mutar datos) Y
    // re-dispara el render de las cards: si no, la agregación queda con los microciclos de la
    // carga anterior (whole-club antes de resolver el equipo) y sesiones sin microcycle_id se
    // bucketean por fecha al MC equivocado (ej. el «MC 01» de otro equipo con ventana solapada).
    async reload(opts) {
      // Dedupe del doble barrido en boot: si loadData YA corrió con este mismo equipo (p. ej.
      // boot() cargó con el equipo ya resuelto), no repetimos el fetch pesado de gps_reports —
      // solo re-disparamos el render. Si el equipo cambió (o boot difirió), sí recargamos.
      // force:true (refresh manual / post-sync / post-attach): los DATOS mutaron con el mismo
      // equipo activo, así que el dedupe convertía el reload en no-op y las cards quedaban
      // stale hasta un F5 — con force siempre se recarga y se re-dispara el render.
      const _tid = window._gpTeamId != null ? String(window._gpTeamId) : '__none__';
      if (opts?.force || _loadedTeamId !== _tid) {
        try { await loadData(); } catch (e) { console.warn('gpFilterBar reload:', e); }
        // fireNow SOLO si recargamos: si loadData ya había corrido con este equipo, boot() ya
        // disparó el render con este mismo estado → un fireNow acá sería una SEGUNDA pasada
        // (el «carga doble»). Reload existe para renderizar cuando boot difirió o el equipo cambió.
        try { fireNow(); } catch (e) { console.warn('gpFilterBar reload fire:', e); }
      }
    },
    _state: state,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
