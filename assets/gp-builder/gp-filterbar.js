/* ─────────────────────────────────────────────────────────────────────────
   gp-filterbar.js — Dashboard filter bar (GPS Chart Reference §6)
   PARTE A: UI + estado en memoria. Las opciones salen de DATOS REALES del club
   (MD codes, jugadores y posiciones reales). Por ahora NO filtra las cards:
   solo mantiene la selección y la expone para que la Parte B la enganche.

   API pública:
     window.gpFilterBar.getState()      → snapshot limpio de los filtros
     window.gpFilterBar.onChange(fn)     → suscribirse a cambios (devuelve unsub)
     window.gpFilterBar.reload()         → recargar opciones desde Supabase
     window.gpFilterBar.clearAll()       → resetear todo
   Evento DOM: document → 'gpfilter:change' (detail = getState()).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.gpFilterBar) return;

  // ── Config de los desplegables (orden de la referencia) ─────────────────
  const DROPS = [
    { key: 'md_code',    icon: 'ti-calendar-event', placeholder: 'All MD',          multi: true },
    { key: 'date',       icon: 'ti-calendar-range', placeholder: 'Any date',        date: true  },
    { key: 'player',     icon: 'ti-user',           placeholder: 'All players',     multi: true },
    { key: 'position',   icon: 'ti-shirt-sport',    placeholder: 'All positions',   multi: true },
    { key: 'microcycle', icon: 'ti-calendar-week',  placeholder: 'All microcycles', multi: true },
  ];

  // English labels for the Add-filter menu (placeholders quedan en su idioma actual).
  const FILTER_LABELS = {
    md_code: 'Matchday', date: 'Date', player: 'Players',
    position: 'Positions', microcycle: 'Microcycle',
  };

  const DATE_PRESETS = [
    { id: '7',     label: 'Last 7 days',  days: 7   },
    { id: '30',    label: 'Last 30 days', days: 30  },
    { id: '90',    label: 'Last 90 days', days: 90  },
    { id: 'season',label: 'Season',       days: 365 },
  ];

  // ── Estado (en memoria) ─────────────────────────────────────────────────
  const state = {
    md_code:    [],                            // valores seleccionados
    player:     [],                            // ids de jugador
    position:   [],                            // posiciones
    microcycle: [],                            // ids de microciclo
    date:       { preset: null, from: null, to: null },
    visibleFilters: DROPS.map(d => d.key),     // qué filtros se muestran en la barra
  };
  function isFilterVisible(key) { return state.visibleFilters.includes(key); }
  // opciones reales por desplegable: [{ value, label }]
  const options = { md_code: [], player: [], position: [], microcycle: [] };

  // ── Filtros encadenados ───────────────────────────────────────────────────
  // Relación REAL del club: un gps_report por fila (date/md/mc/jugador/posición).
  // Permite, al seleccionar un filtro, acotar las opciones válidas del resto según
  // las sesiones reales (no cálculos derivados tipo getISOWeek).
  let _rows = [];            // [{ d, md, mc, p, pos }]
  let _validCache = null;    // { md_code:Set, microcycle:Set, player:Set, position:Set } | null (sin filtros)
  const _FIELD = { md_code: 'md', microcycle: 'mc', player: 'p', position: 'pos' };

  function _anyFilterActive() {
    return !!(state.md_code.length || state.player.length || state.position.length || state.microcycle.length
      || state.date.preset || state.date.from || state.date.to);
  }
  function _dateBounds() {
    const dt = state.date;
    if (dt.preset) {
      const p = DATE_PRESETS.find(x => x.id === dt.preset);
      const back = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
      return { from: p ? back(p.days) : null, to: null };
    }
    return { from: dt.from || null, to: dt.to || null };
  }
  // ¿la fila cumple TODOS los filtros activos, salvo el del propio desplegado (exceptKey)?
  function _rowMatches(r, exceptKey) {
    if (exceptKey !== 'date') {
      const { from, to } = _dateBounds();
      if (from && r.d < from) return false;
      if (to   && r.d > to)   return false;
    }
    if (exceptKey !== 'md_code'    && state.md_code.length    && !state.md_code.includes(r.md))    return false;
    if (exceptKey !== 'microcycle' && state.microcycle.length && !state.microcycle.includes(r.mc)) return false;
    if (exceptKey !== 'player'     && state.player.length     && !state.player.includes(r.p))      return false;
    if (exceptKey !== 'position'   && state.position.length   && !state.position.includes(r.pos))  return false;
    return true;
  }
  function _computeValidSets() {
    const out = { md_code: new Set(), microcycle: new Set(), player: new Set(), position: new Set() };
    for (const r of _rows) {
      for (const key in _FIELD) if (_rowMatches(r, key)) out[key].add(r[_FIELD[key]]);
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
        const before = state[key].length;
        state[key] = state[key].filter(val => v[key].has(val));
        if (state[key].length !== before) pruned = true;
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
  const drafts = {};         // selección provisional mientras el panel está abierto

  // ── Helpers de estado ───────────────────────────────────────────────────
  function isActive(key) {
    if (key === 'date') return !!(state.date.preset || state.date.from || state.date.to);
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
        microcycle: state.microcycle, date: state.date,
        visibleFilters: state.visibleFilters,
      }));
    } catch (e) { /* storage no disponible */ }
  }
  function resetStateSilent() {
    state.md_code = []; state.player = []; state.position = []; state.microcycle = [];
    state.date = { preset: null, from: null, to: null };
    state.visibleFilters = DROPS.map(d => d.key);
  }
  /** Carga los filtros guardados del dashboard activo (sin disparar fire). */
  function restore() {
    resetStateSilent();
    try {
      const raw = localStorage.getItem(storeKey());
      if (raw) {
        const s = JSON.parse(raw) || {};
        state.md_code    = Array.isArray(s.md_code)    ? s.md_code    : [];
        state.player     = Array.isArray(s.player)     ? s.player     : [];
        state.position   = Array.isArray(s.position)   ? s.position   : [];
        state.microcycle = Array.isArray(s.microcycle) ? s.microcycle : [];
        state.date     = (s.date && typeof s.date === 'object')
          ? { preset: s.date.preset || null, from: s.date.from || null, to: s.date.to || null }
          : { preset: null, from: null, to: null };
        state.visibleFilters = (Array.isArray(s.visibleFilters) && s.visibleFilters.length)
          ? s.visibleFilters.filter(k => DROPS.some(d => d.key === k))
          : DROPS.map(d => d.key);
      }
    } catch (e) { /* ignore */ }
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
      grip.title = 'Drag to reorder';
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
        `<span class="fb-trigger-label">${cfg.placeholder}</span>` +
        `<span class="fb-count"></span>` +
        `<span class="fb-clear" role="button" title="Clear"><i class="ti ti-x"></i></span>` +
        `<i class="ti ti-chevron-down fb-caret"></i>`;
      drop.appendChild(trig);
      drop.appendChild(cfg.date ? buildDatePanel() : buildMultiPanel(cfg));

      // botón de QUITAR el filtro de la barra (distinto de la ✕ de limpiar selección)
      const remove = el('span', 'fb-remove', `<i class="ti ti-x"></i>`);
      remove.setAttribute('role', 'button');
      remove.title = 'Remove filter';
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
    const addBtn = el('button', 'fb-addfilter', `<i class="ti ti-plus"></i><span>Add filter</span>`);
    addBtn.type = 'button';
    const addMenu = el('div', 'fb-addmenu');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !addMenu.classList.contains('is-open');
      closePanel();
      addMenu.classList.toggle('is-open', willOpen);
      if (willOpen) refreshAddMenu();
    });
    addMenu.addEventListener('click', e => e.stopPropagation());
    addWrap.appendChild(addBtn);
    addWrap.appendChild(addMenu);
    drops.appendChild(addWrap);

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
    const global = el('span', 'fb-global', `<i class="ti ti-filter"></i><span class="fb-global-txt">No filters</span>`);
    const clearAll = el('button', 'fb-clear-all', `<i class="ti ti-x"></i>Clear`);
    clearAll.type = 'button';
    clearAll.addEventListener('click', clearAll_);
    right.appendChild(global);
    right.appendChild(clearAll);

    bar.appendChild(drops);
    bar.appendChild(right);
    return bar;
  }

  function buildMultiPanel(cfg) {
    // Sin botón "Aplicar": cada check/uncheck (y Seleccionar todo / Limpiar) aplica
    // al instante. El panel queda abierto para seguir tildando varias opciones.
    const panel = el('div', 'fb-panel');
    panel.innerHTML =
      `<div class="fb-search"><i class="ti ti-search"></i><input type="text" placeholder="Search…"></div>` +
      `<div class="fb-actions-top">` +
        `<button class="fb-link" type="button" data-act="all">Select all</button>` +
        `<button class="fb-link" type="button" data-act="none">Clear</button>` +
      `</div>` +
      `<div class="fb-list"><div class="fb-empty">Loading…</div></div>`;

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('.fb-search input').addEventListener('input', e => filterList(cfg.key, e.target.value));
    panel.querySelector('[data-act="all"]').addEventListener('click', () => selectAll(cfg.key, true));
    panel.querySelector('[data-act="none"]').addEventListener('click', () => selectAll(cfg.key, false));
    return panel;
  }

  function buildDatePanel() {
    const panel = el('div', 'fb-panel fb-panel-date');
    panel.innerHTML =
      `<div class="fb-presets">` +
        DATE_PRESETS.map(p => `<button class="fb-preset" type="button" data-preset="${p.id}">${p.label}</button>`).join('') +
      `</div>` +
      `<div class="fb-date-h">Range</div>` +
      `<div class="fb-range">` +
        `<label>From<input type="date" class="fb-date-from"></label>` +
        `<label>To<input type="date" class="fb-date-to"></label>` +
      `</div>` +
      `<div class="fb-date-h">Single day</div>` +
      `<div class="fb-range">` +
        `<label>Date<input type="date" class="fb-date-single"></label>` +
      `</div>` +
      `<div class="fb-foot">` +
        `<button class="fb-link" type="button" data-act="none">Clear</button>` +
      `</div>`;

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelectorAll('.fb-preset').forEach(btn => btn.addEventListener('click', () => {
      const on = !btn.classList.contains('is-on');
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      if (on) btn.classList.add('is-on');
      // preset, rango manual y día puntual son mutuamente excluyentes
      panel.querySelector('.fb-date-from').value = '';
      panel.querySelector('.fb-date-to').value = '';
      panel.querySelector('.fb-date-single').value = '';
      commitDate(panel);                          // aplica al instante
    }));
    const onRangeInput = () => {
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      panel.querySelector('.fb-date-single').value = '';   // rango y día son excluyentes
      commitDate(panel);
    };
    panel.querySelector('.fb-date-from').addEventListener('input', onRangeInput);
    panel.querySelector('.fb-date-to').addEventListener('input', onRangeInput);
    // Día puntual → filtra solo las sesiones de ESE día (from === to).
    panel.querySelector('.fb-date-single').addEventListener('input', () => {
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      panel.querySelector('.fb-date-from').value = '';
      panel.querySelector('.fb-date-to').value = '';
      commitDate(panel);
    });
    panel.querySelector('[data-act="none"]').addEventListener('click', () => { clearOne('date'); syncDatePanel(); });
    return panel;
  }

  // ── Render de la lista de checkboxes desde datos reales ─────────────────
  function renderList(key) {
    const list = root.querySelector(`.fb-drop[data-key="${key}"] .fb-list`);
    if (!list) return;
    const opts = options[key] || [];
    if (!opts.length) { list.innerHTML = `<div class="fb-empty">No club data yet.</div>`; return; }
    const draft = drafts[key] || new Set();
    const valid = _validCache && _validCache[key];   // Set de valores posibles según los OTROS filtros
    // Mostrar SOLO lo elegible: las opciones imposibles no se renderizan (las ya elegidas
    // se mantienen). Se recuperan al limpiar o quitar la selección que acota.
    const shown = opts.filter(o => !valid || valid.has(o.value) || draft.has(o.value));
    if (!shown.length) { list.innerHTML = `<div class="fb-empty">Sin opciones para los filtros actuales.</div>`; return; }
    list.innerHTML = shown.map(o =>
      `<label class="fb-opt"><input type="checkbox" value="${escAttr(o.value)}"${draft.has(o.value) ? ' checked' : ''}>` +
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
  function commitDate(panel) {
    const presetBtn = panel.querySelector('.fb-preset.is-on');
    const single = panel.querySelector('.fb-date-single').value || null;
    const from = panel.querySelector('.fb-date-from').value || null;
    const to   = panel.querySelector('.fb-date-to').value || null;
    // Prioridad: preset > día puntual (from===to) > rango manual. Excluyentes.
    state.date = presetBtn
      ? { preset: presetBtn.dataset.preset, from: null, to: null }
      : single
        ? { preset: null, from: single, to: single }
        : { preset: null, from, to };
    _afterChange();   // la fecha también acota MD/jugador/posición/microciclo
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

    if (!active) { labelEl.textContent = cfg.placeholder; return; }

    if (key === 'date') {
      labelEl.textContent = dateLabel();
      return;
    }
    const sel = state[key];
    const map = new Map((options[key] || []).map(o => [o.value, o.label]));
    if (sel.length === 1) {
      labelEl.textContent = map.get(sel[0]) || sel[0];
    } else {
      labelEl.textContent = map.get(sel[0]) || sel[0];
      countEl.textContent = String(sel.length);
      drop.classList.add('is-multi');
    }
  }

  function dateLabel() {
    if (state.date.preset) {
      const p = DATE_PRESETS.find(x => x.id === state.date.preset);
      return p ? p.label : state.date.preset;
    }
    const f = state.date.from, t = state.date.to;
    if (f && t && f === t) return `Day: ${f}`;     // fecha individual
    if (f && t) return `${f} → ${t}`;
    if (f) return `From ${f}`;
    if (t) return `To ${t}`;
    return '';
  }

  function updateGlobal() {
    const n = activeCount();
    const g = root.querySelector('.fb-global');
    g.querySelector('.fb-global-txt').textContent =
      n === 0 ? 'No filters' : (n === 1 ? '1 active filter' : `${n} active filters`);
    g.classList.toggle('is-on', n > 0);
    root.querySelector('.fb-clear-all').disabled = n === 0;
  }

  // ── Limpiar ─────────────────────────────────────────────────────────────
  function clearOne(key) {
    if (key === 'date') state.date = { preset: null, from: null, to: null };
    else state[key] = [];
    drafts[key] = key === 'date' ? null : new Set();
    applyChaining();                                  // recalcula opciones válidas (al limpiar, se amplían)
    if (openKey === key) { renderListOrDate(key); }
    DROPS.forEach(d => updateTrigger(d.key));
    updateGlobal();
    fire();
  }
  function clearAll_() {
    DROPS.forEach(d => {
      if (d.key === 'date') state.date = { preset: null, from: null, to: null };
      else state[d.key] = [];
      drafts[d.key] = d.date ? null : new Set();
    });
    applyChaining();                                  // sin filtros → _validCache null → todas habilitadas
    DROPS.forEach(d => updateTrigger(d.key));
    updateGlobal();
    closePanel();
    fire();
  }

  // ── Apertura / cierre de paneles ────────────────────────────────────────
  function togglePanel(key) { (openKey === key) ? closePanel() : openPanel(key); }

  function openPanel(key) {
    closePanel();
    openKey = key;
    const drop = root.querySelector(`.fb-drop[data-key="${key}"]`);
    drop.classList.add('is-open');
    applyChaining();                              // _validCache fresco → opciones imposibles deshabilitadas
    // arranca el draft desde el estado actual
    if (key !== 'date') drafts[key] = new Set(state[key]);
    renderListOrDate(key);
    const focusable = drop.querySelector('.fb-search input, .fb-preset');
    if (focusable) setTimeout(() => focusable.focus(), 0);
  }
  function closePanel() {
    root?.querySelector('.fb-addmenu.is-open')?.classList.remove('is-open');
    if (!openKey) return;
    const drop = root.querySelector(`.fb-drop[data-key="${openKey}"]`);
    if (drop) {
      drop.classList.remove('is-open');
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
      menu.innerHTML = `<div class="fb-addempty">All filters added</div>`;
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
    panel.querySelectorAll('.fb-preset').forEach(b =>
      b.classList.toggle('is-on', state.date.preset === b.dataset.preset));
    const f = state.date.from, t = state.date.to;
    const isSingle = f && t && f === t;            // fecha individual → va en su input
    panel.querySelector('.fb-date-from').value   = isSingle ? '' : (f || '');
    panel.querySelector('.fb-date-to').value     = isSingle ? '' : (t || '');
    panel.querySelector('.fb-date-single').value = isSingle ? f  : '';
  }

  // ── Carga de opciones REALES desde Supabase ─────────────────────────────
  async function loadData() {
    const clubId = await window.getClubId?.();
    if (!clubId || !window.sb) return;

    const _gpTeam = window._gpTeamId || null;
    const _plQ = window.sb.from('players').select('id,first_name,last_name,number,position,positions')
      .eq('club_id', clubId).neq('status', 'inactive');
    const _seQ = window.sb.from('training_sessions').select('session_attributes')
      .eq('club_id', clubId).limit(3000);
    const _mcQ = window.sb.from('microcycles').select('id,name,start_date')
      .eq('club_id', clubId);
    const [{ data: players }, { data: sessions }, { data: mcs }, { data: reports }] = await Promise.all([
      (_gpTeam ? _plQ.eq('team_id', _gpTeam) : _plQ).order('last_name'),
      (_gpTeam ? _seQ.eq('team_id', _gpTeam) : _seQ),
      (_gpTeam ? _mcQ.eq('team_id', _gpTeam) : _mcQ).order('start_date', { ascending: false }),
      window.sb.from('gps_reports')
        .select('player_id, training_sessions!inner(session_date, session_attributes, microcycle_id), players!inner(position)')
        .eq('club_id', clubId).limit(20000),
    ]);

    // Jugadores reales
    options.player = (players || []).map(p => ({
      value: p.id,
      label: `${p.last_name || ''} ${(p.first_name || '')[0] || ''}.${p.number ? ' #' + p.number : ''}`.trim()
              || p.id,
    }));

    // Posiciones reales (distintas, no vacías)
    const posSet = new Set();
    (players || []).forEach(p => {
      if (p.position) posSet.add(p.position);
      if (Array.isArray(p.positions)) p.positions.forEach(x => x && posSet.add(x));
    });
    options.position = Array.from(posSet).sort().map(v => ({ value: v, label: v }));

    // MD codes reales desde session_attributes.md_code
    const mdSet = new Set();
    (sessions || []).forEach(s => {
      const v = s.session_attributes && s.session_attributes.md_code;
      if (v) mdSet.add(String(v));
    });
    options.md_code = Array.from(mdSet).sort(mdCompare).map(v => ({ value: v, label: v }));

    // Microciclos reales del club — etiqueta REAL del MC (mc.name), no getISOWeek.
    // value = id (los reports filtran por training_sessions.microcycle_id).
    options.microcycle = (mcs || []).map(m => ({
      value: m.id,
      label: m.name || (m.start_date ? `MC ${String(m.start_date).slice(0, 10)}` : m.id),
    }));

    // Relación real (un gps_report por fila) para el encadenado de filtros.
    _rows = (reports || []).map(r => {
      const ts = r.training_sessions || {};
      return {
        d:   ts.session_date || '',
        md:  String(ts.session_attributes?.md_code ?? '') || '',
        mc:  ts.microcycle_id != null ? String(ts.microcycle_id) : '',
        p:   r.player_id,
        pos: r.players?.position || '',
      };
    }).filter(x => x.d);

    applyChaining();   // si había filtros restaurados, deja _validCache listo

    // re-render del panel abierto si corresponde
    if (openKey && openKey !== 'date') renderList(openKey);
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

    // cambiar de dashboard (tab) → cargar los filtros guardados de ese dashboard
    document.getElementById('sections')?.addEventListener('click', e => {
      if (e.target.closest('.gp-sec')) setTimeout(onDashChange, 0);
    });
  }

  // espera a tener sesión/club y carga datos (la barra ya está visible mientras)
  async function boot() {
    mount();
    if (!root) return;
    for (let i = 0; i < 50; i++) {
      if (window.sb && window.getClubId) {
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
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    clearAll: clearAll_,
    async reload() { try { await loadData(); } catch (e) { console.warn('gpFilterBar reload:', e); } },
    _state: state,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
