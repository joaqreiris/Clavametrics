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
    { key: 'md_code',    icon: 'ti-calendar-event', placeholder: 'Todos los MD',          multi: true },
    { key: 'date',       icon: 'ti-calendar-range', placeholder: 'Cualquier fecha',       date: true  },
    { key: 'player',     icon: 'ti-user',           placeholder: 'Todos los jugadores',   multi: true },
    { key: 'position',   icon: 'ti-shirt-sport',    placeholder: 'Todas las posiciones',  multi: true },
    { key: 'microcycle', icon: 'ti-calendar-week',  placeholder: 'Todos los microciclos', multi: true },
  ];

  const DATE_PRESETS = [
    { id: '7',     label: 'Últimos 7 días',  days: 7   },
    { id: '30',    label: 'Últimos 30 días', days: 30  },
    { id: '90',    label: 'Últimos 90 días', days: 90  },
    { id: 'season',label: 'Temporada',       days: 365 },
  ];

  // ── Estado (en memoria) ─────────────────────────────────────────────────
  const state = {
    md_code:    [],                            // valores seleccionados
    player:     [],                            // ids de jugador
    position:   [],                            // posiciones
    microcycle: [],                            // ids de microciclo
    date:       { preset: null, from: null, to: null },
  };
  // opciones reales por desplegable: [{ value, label }]
  const options = { md_code: [], player: [], position: [], microcycle: [] };

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
      }));
    } catch (e) { /* storage no disponible */ }
  }
  function resetStateSilent() {
    state.md_code = []; state.player = []; state.position = []; state.microcycle = [];
    state.date = { preset: null, from: null, to: null };
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
      }
    } catch (e) { /* ignore */ }
    if (root) { DROPS.forEach(d => updateTrigger(d.key)); updateGlobal(); }
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

      const trig = el('button', 'fb-trigger');
      trig.type = 'button';
      trig.innerHTML =
        `<i class="ti ${cfg.icon}"></i>` +
        `<span class="fb-trigger-label">${cfg.placeholder}</span>` +
        `<span class="fb-count"></span>` +
        `<span class="fb-clear" role="button" title="Limpiar"><i class="ti ti-x"></i></span>` +
        `<i class="ti ti-chevron-down fb-caret"></i>`;
      drop.appendChild(trig);
      drop.appendChild(cfg.date ? buildDatePanel() : buildMultiPanel(cfg));
      drops.appendChild(drop);

      // toggle abrir/cerrar (no si tocan la ✕)
      trig.addEventListener('click', (e) => {
        if (e.target.closest('.fb-clear')) { clearOne(cfg.key); e.stopPropagation(); return; }
        togglePanel(cfg.key);
      });
    });

    const right = el('div', 'gp-fbar-right');
    const global = el('span', 'fb-global', `<i class="ti ti-filter"></i><span class="fb-global-txt">Sin filtros</span>`);
    const clearAll = el('button', 'fb-clear-all', `<i class="ti ti-x"></i>Limpiar`);
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
      `<div class="fb-search"><i class="ti ti-search"></i><input type="text" placeholder="Buscar…"></div>` +
      `<div class="fb-actions-top">` +
        `<button class="fb-link" type="button" data-act="all">Seleccionar todo</button>` +
        `<button class="fb-link" type="button" data-act="none">Limpiar</button>` +
      `</div>` +
      `<div class="fb-list"><div class="fb-empty">Cargando…</div></div>`;

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
      `<div class="fb-range">` +
        `<label>Desde<input type="date" class="fb-date-from"></label>` +
        `<label>Hasta<input type="date" class="fb-date-to"></label>` +
      `</div>` +
      `<div class="fb-foot">` +
        `<button class="fb-link" type="button" data-act="none">Limpiar</button>` +
      `</div>`;

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelectorAll('.fb-preset').forEach(btn => btn.addEventListener('click', () => {
      const on = !btn.classList.contains('is-on');
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      if (on) btn.classList.add('is-on');
      // preset y rango manual son excluyentes
      panel.querySelector('.fb-date-from').value = '';
      panel.querySelector('.fb-date-to').value = '';
      commitDate(panel);                          // aplica al instante
    }));
    const onRangeInput = () => {
      panel.querySelectorAll('.fb-preset').forEach(b => b.classList.remove('is-on'));
      commitDate(panel);
    };
    panel.querySelector('.fb-date-from').addEventListener('input', onRangeInput);
    panel.querySelector('.fb-date-to').addEventListener('input', onRangeInput);
    panel.querySelector('[data-act="none"]').addEventListener('click', () => { clearOne('date'); syncDatePanel(); });
    return panel;
  }

  // ── Render de la lista de checkboxes desde datos reales ─────────────────
  function renderList(key) {
    const list = root.querySelector(`.fb-drop[data-key="${key}"] .fb-list`);
    if (!list) return;
    const opts = options[key] || [];
    if (!opts.length) { list.innerHTML = `<div class="fb-empty">Sin datos del club todavía.</div>`; return; }
    const draft = drafts[key] || new Set();
    list.innerHTML = opts.map(o =>
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
    root.querySelectorAll(`.fb-drop[data-key="${key}"] .fb-opt`).forEach(opt => {
      const txt = opt.textContent.toLowerCase();
      opt.classList.toggle('is-hidden', norm && !txt.includes(norm));
    });
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
    updateTrigger(key);
    updateGlobal();
    fire();
  }
  function commitDate(panel) {
    const presetBtn = panel.querySelector('.fb-preset.is-on');
    const from = panel.querySelector('.fb-date-from').value || null;
    const to   = panel.querySelector('.fb-date-to').value || null;
    state.date = presetBtn
      ? { preset: presetBtn.dataset.preset, from: null, to: null }
      : { preset: null, from, to };
    updateTrigger('date');
    updateGlobal();
    fire();
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
    if (f && t) return `${f} → ${t}`;
    if (f) return `Desde ${f}`;
    if (t) return `Hasta ${t}`;
    return '';
  }

  function updateGlobal() {
    const n = activeCount();
    const g = root.querySelector('.fb-global');
    g.querySelector('.fb-global-txt').textContent =
      n === 0 ? 'Sin filtros' : (n === 1 ? '1 filtro activo' : `${n} filtros activos`);
    g.classList.toggle('is-on', n > 0);
    root.querySelector('.fb-clear-all').disabled = n === 0;
  }

  // ── Limpiar ─────────────────────────────────────────────────────────────
  function clearOne(key) {
    if (key === 'date') state.date = { preset: null, from: null, to: null };
    else state[key] = [];
    drafts[key] = key === 'date' ? null : new Set();
    if (openKey === key) { renderListOrDate(key); }
    updateTrigger(key);
    updateGlobal();
    fire();
  }
  function clearAll_() {
    DROPS.forEach(d => {
      if (d.key === 'date') state.date = { preset: null, from: null, to: null };
      else state[d.key] = [];
      drafts[d.key] = d.date ? null : new Set();
      updateTrigger(d.key);
    });
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
    // arranca el draft desde el estado actual
    if (key !== 'date') drafts[key] = new Set(state[key]);
    renderListOrDate(key);
    const focusable = drop.querySelector('.fb-search input, .fb-preset');
    if (focusable) setTimeout(() => focusable.focus(), 0);
  }
  function closePanel() {
    if (!openKey) return;
    const drop = root.querySelector(`.fb-drop[data-key="${openKey}"]`);
    if (drop) {
      drop.classList.remove('is-open');
      const s = drop.querySelector('.fb-search input');
      if (s) { s.value = ''; filterList(openKey, ''); }
    }
    openKey = null;
  }
  function renderListOrDate(key) {
    if (key === 'date') syncDatePanel();
    else renderList(key);
  }
  function syncDatePanel() {
    const panel = root.querySelector('.fb-drop[data-key="date"] .fb-panel');
    panel.querySelectorAll('.fb-preset').forEach(b =>
      b.classList.toggle('is-on', state.date.preset === b.dataset.preset));
    panel.querySelector('.fb-date-from').value = state.date.from || '';
    panel.querySelector('.fb-date-to').value   = state.date.to   || '';
  }

  // ── Carga de opciones REALES desde Supabase ─────────────────────────────
  async function loadData() {
    const clubId = await window.getClubId?.();
    if (!clubId || !window.sb) return;

    const [{ data: players }, { data: sessions }, { data: mcs }] = await Promise.all([
      window.sb.from('players').select('id,first_name,last_name,number,position')
        .eq('club_id', clubId).neq('status', 'inactive').order('last_name'),
      window.sb.from('training_sessions').select('session_attributes')
        .eq('club_id', clubId).limit(3000),
      window.sb.from('microcycles').select('id,name,start_date')
        .eq('club_id', clubId).order('start_date', { ascending: false }),
    ]);

    // Jugadores reales
    options.player = (players || []).map(p => ({
      value: p.id,
      label: `${p.last_name || ''} ${(p.first_name || '')[0] || ''}.${p.number ? ' #' + p.number : ''}`.trim()
              || p.id,
    }));

    // Posiciones reales (distintas, no vacías)
    const posSet = new Set();
    (players || []).forEach(p => { if (p.position) posSet.add(p.position); });
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
        if (isAnyActive() && window.GpBuilder && window.GpBuilder.rerenderActiveCards) {
          setTimeout(() => window.GpBuilder.rerenderActiveCards(), 120);
        }
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
