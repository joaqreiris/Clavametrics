/* ─────────────────────────────────────────────────────────────────────────
   gps-analysis.js — parte principal de la página GPS Analysis.

   Estaba escrito dentro de GPS Analysis.html: entre los cuatro archivos eran
   418 KB de los 545 KB de la página, y viajaban enteros en cada visita porque
   el HTML no se cachea nunca.

   Va con defer. Comprobado antes de mover nada:
     · No queda NINGÚN elemento del DOM por debajo de donde estaban escritos
       (todo el markup termina en la línea 1443), así que los selectores ven
       exactamente lo mismo.
     · Los 9 scripts sueltos que quedan por debajo (gps-import-wizard,
       gps-player-week, gps-mc-compare, …) no usan al cargarse ninguna de las
       984 variables globales que definen estos bloques.
     · El orden entre los cuatro archivos se conserva: defer respeta el orden
       del documento, y no había scripts intercalados dentro de cada grupo.
   ──────────────────────────────────────────────────────────────────────── */
// ══════════════════════════════════════════════════════════════
// GPS Analysis — Interactive controls
// ══════════════════════════════════════════════════════════════

// ── i18n helper for JS-painted (dynamic) UI labels ────────────
function tt(key, fallbackEN, vars){ const v=(window.CM_I18N&&CM_I18N.t)?CM_I18N.t(key,vars):null; return (v&&v!==key)?v:(fallbackEN!=null?fallbackEN:key); }

// ── State ─────────────────────────────────────────────────────
window.gpState = {
  datePreset: 'last30',
  dateFrom: null,
  dateTo: null,
  includeHistorical: false,
  microcycle: 'All',
  mcId: null,
  playerId: null,
  // NOT a global comparison control anymore (the top-bar baseline pill is gone; comparison
  // is per card via config.comparison). Kept as an internal default that the z-normalized
  // radar / profile cards still read (vs Role) — do not resurrect it as a global filter.
  baseline: 'vs Role',
  view: 'ind',
};

// ── Date range helpers ────────────────────────────────────────
function _fmtDate(d) { return window.cmYMD ? window.cmYMD(d) : d.toISOString().slice(0, 10); }  // LOCAL date (not UTC → no off-by-one east of UTC)

function getDateRange(state) {
  const now = new Date();
  const s = state || window.gpState;
  switch (s.datePreset) {
    case 'last7':  { const f = new Date(now); f.setDate(f.getDate()-7);  return { from: _fmtDate(f), to: _fmtDate(now) }; }
    case 'last30': { const f = new Date(now); f.setDate(f.getDate()-30); return { from: _fmtDate(f), to: _fmtDate(now) }; }
    case 'last90': { const f = new Date(now); f.setDate(f.getDate()-90); return { from: _fmtDate(f), to: _fmtDate(now) }; }
    case 'currentMC': {
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: _fmtDate(mon), to: _fmtDate(sun) };
    }
    case 'currentMonth': {
      return { from: _fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: _fmtDate(now) };
    }
    case 'currentSeason': {
      const seasonStart = now.getMonth() >= 6
        ? new Date(now.getFullYear(), 6, 1)
        : new Date(now.getFullYear() - 1, 6, 1);
      return { from: _fmtDate(seasonStart), to: _fmtDate(now) };
    }
    case 'season': {
      // A specific seasons row picked from the date pill. Use its exact window; fall back to
      // the current-season heuristic if the stored dates went missing.
      if (s.seasonFrom && s.seasonTo) return { from: s.seasonFrom, to: s.seasonTo };
      const ss = now.getMonth() >= 6 ? new Date(now.getFullYear(), 6, 1) : new Date(now.getFullYear() - 1, 6, 1);
      return { from: _fmtDate(ss), to: _fmtDate(now) };
    }
    case 'allTime': return { from: '2000-01-01', to: _fmtDate(now) };
    case 'custom':  return { from: s.dateFrom || _fmtDate(new Date(now.getFullYear(), 0, 1)), to: s.dateTo || _fmtDate(now) };
    default:        { const f = new Date(now); f.setDate(f.getDate()-30); return { from: _fmtDate(f), to: _fmtDate(now) }; }
  }
}

function getDatePresetLabel(state) {
  const s = state || window.gpState;
  const m = { last7:tt('gps_analysis.preset_last7','Last 7 days'), last30:tt('gps_analysis.preset_last30','Last 30 days'), last90:tt('gps_analysis.preset_last90','Last 90 days'), currentMC:tt('gps_analysis.preset_current_mc','Current MC'),
               currentMonth:tt('gps_analysis.preset_current_month','Current month'), currentSeason:tt('gps_analysis.preset_current_season','Current season'), allTime:tt('gps_analysis.preset_all_time','All time') };
  if (s.datePreset === 'custom') return `${s.dateFrom || '?'} — ${s.dateTo || '?'}`;
  if (s.datePreset === 'season') return s.seasonName || tt('gps_analysis.preset_current_season','Current season');
  return m[s.datePreset] || tt('gps_analysis.preset_last30','Last 30 days');
}

// ── Prefs persistence — by (clubId, userId) ────────────────────
function _gpPrefsKey() {
  return `cm_gps_prefs_${window._gpClubId||'?'}_${window._gpUserId||'?'}`;
}
function saveGpsPrefs() {
  const s = window.gpState;
  const v = { datePreset:s.datePreset, dateFrom:s.dateFrom, dateTo:s.dateTo,
              seasonId:s.seasonId, seasonFrom:s.seasonFrom, seasonTo:s.seasonTo, seasonName:s.seasonName,
              includeHistorical:s.includeHistorical, microcycle:s.microcycle,
              playerId:s.playerId, playerName:s.playerName, baseline:s.baseline };
  try { localStorage.setItem(_gpPrefsKey(), JSON.stringify(v)); } catch(_) {}
}
function loadGpsPrefs() {
  try {
    const raw = localStorage.getItem(_gpPrefsKey());
    return raw ? JSON.parse(raw) : null;
  } catch(_) { return null; }
}
function applyGpsPrefs(prefs) {
  if (!prefs) return;
  Object.assign(window.gpState, prefs);
  const drLabel = document.getElementById('dateRangeLabel');
  if (drLabel) drLabel.textContent = getDatePresetLabel();
  const mcLabel = document.getElementById('mcLabel');
  if (mcLabel) mcLabel.textContent = (window.gpState.microcycle && window.gpState.microcycle !== 'All') ? window.gpState.microcycle : tt('gps_analysis.all_mcs','All MCs');
  const plLabel = document.getElementById('playerLabel');
  if (plLabel) plLabel.textContent = window.gpState.playerName || tt('gps_analysis.filter_all_players','All players');
  const histPill = document.getElementById('histPill');
  if (histPill) histPill.classList.toggle('is-on', !!window.gpState.includeHistorical);
}

// ── UI: update filter subtitle in gpSub ───────────────────────
function _updateGpSub(playerCount, sessionCount) {
  const sub = document.getElementById('gpSub');
  if (!sub) return;
  window._gpLastCounts = { playerCount, sessionCount };
  const label = getDatePresetLabel();
  const hist  = window.gpState.includeHistorical ? ` · ${tt('gps_analysis.including_historical','including historical')}` : '';
  sub.dataset.gpFilled = '1';
  sub.textContent = `${tt('gps_analysis.gp_sub_counts','{players} players · {sessions} sessions', { players: playerCount ?? '—', sessions: sessionCount ?? '—' })} · ${label}${hist}`;
}

// ── Re-paint JS-painted filter labels on language change ───────
// Re-applies the date/MC/player pills from current state (idempotent)
// and the subtitle from the last known counts. Does NOT touch builder state.
window.addEventListener('cm:langchanged', () => {
  try { applyGpsPrefs(window.gpState); } catch(_) {}
  if (window._gpLastCounts) {
    _updateGpSub(window._gpLastCounts.playerCount, window._gpLastCounts.sessionCount);
  }
  // Chart.js draws labels onto a canvas, so data-i18n can't reach them — re-render the
  // active dashboard's cards so radar/bar/etc. legends + tooltips pick up the new language.
  try { window.GpBuilder?.rerenderActiveCards?.(); } catch(_) {}
});

// ── Helpers ───────────────────────────────────────────────────
function getISOWeek(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt - y0) / 86400000) + 1) / 7);
}

// Size is now changed by dragging the card corner (see gp-resize.js).
// This shim keeps the old call sites working: it seeds --gp-span and
// injects the resize handle on the given subtree's cards.
function initSizeToggles(root) {
  if (!root) return;
  if (window.gpInitResize) { window.gpInitResize(root); return; }
  // gp-resize.js not ready yet — retry once on next frame
  requestAnimationFrame(() => window.gpInitResize?.(root));
}

// ── Popover ───────────────────────────────────────────────────
let _pop = null;
let _popAnchor = null;

function closePop() { _pop?.remove(); _pop = null; _popAnchor = null; }

document.addEventListener('click', e => {
  // Close on any outside click — but NOT on the popover's own anchor, so the anchor's own
  // handler owns the toggle (capture runs before the anchor's click handler, and closing here
  // first would let an async handler reopen it → the "can't close / can't reopen" glitch).
  if (_pop && !_pop.contains(e.target)
      && e.target !== _popAnchor && !(_popAnchor && _popAnchor.contains(e.target))) closePop();
}, true);

function _posPopover(pop, anchor) {
  const r = anchor.getBoundingClientRect();
  pop.style.top  = (r.bottom + 4) + 'px';
  pop.style.left = r.left + 'px';
  document.body.appendChild(pop);
  _pop = pop;
  _popAnchor = anchor;
  requestAnimationFrame(() => {
    const pr = pop.getBoundingClientRect();
    if (pr.right > innerWidth - 8) pop.style.left = (innerWidth - pr.width - 8) + 'px';
    // Listas largas: abrir hacia el lado con más aire y limitar la altura al espacio
    // disponible, para que el popover pueda scrollear en vez de quedar cortado.
    const GAP = 8;
    const below = innerHeight - r.bottom - GAP;
    const above = r.top - GAP;
    if (pr.height > below && above > below) {                 // flip hacia arriba
      pop.style.maxHeight = Math.max(120, above - 4) + 'px';
      pop.style.top = 'auto';
      pop.style.bottom = (innerHeight - r.top + 4) + 'px';
    } else {
      pop.style.maxHeight = Math.max(120, below - 4) + 'px';
    }
  });
}

function makePopover(anchor, items, onSelect) {
  closePop();
  const pop = document.createElement('div');
  pop.className = 'gp-popover';
  items.forEach(item => {
    if (item.sep) { const hr = document.createElement('div'); hr.className = 'gp-popover-sep'; pop.appendChild(hr); return; }
    const btn = document.createElement('button');
    btn.className = 'gp-popover-item';
    if (item.icon) { const i = document.createElement('i'); i.className = `ti ${item.icon}`; btn.appendChild(i); }
    btn.appendChild(document.createTextNode(item.label));
    btn.addEventListener('click', e => { e.stopPropagation(); closePop(); onSelect(item); });
    pop.appendChild(btn);
  });
  _posPopover(pop, anchor);
}


// ── Modal ─────────────────────────────────────────────────────
function makeModal(title, bodyHTML) {
  closePop();
  const ov = document.createElement('div');
  ov.className = 'gp-modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'gp-modal';
  modal.innerHTML = `<div class="gp-modal-h"><h3></h3><button class="gp-modal-x"><i class="ti ti-x"></i></button></div><div class="gp-modal-body"></div>`;
  modal.querySelector('h3').textContent = title;
  modal.querySelector('.gp-modal-body').innerHTML = bodyHTML;
  modal.querySelector('.gp-modal-x').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.appendChild(modal);
  document.body.appendChild(ov);
  return ov;
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'gp-toast';
  if (isError) t.style.cssText = 'border-color:var(--cm-danger,#ef4444);color:var(--cm-danger,#ef4444)';
  t.textContent = msg;
  document.body.appendChild(t);
  const delay = isError ? 4000 : 2200;
  setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 400); }, delay);
}

// ── Card catalog ──────────────────────────────────────────────
// Each entry: { name, id (DOM element id), stub }
// stub:true → no implementation yet, shown disabled
const GP_CARD_DEFS = {
  ind: [
    { name: 'Radar profile',           id: 'card-radar',        stub: false },
    { name: '× match max',             id: 'card-xmatch',       stub: false },
    { name: 'Weekly bars',             id: 'card-weekly-bars',  stub: false },
    { name: 'ACWR chart',              id: 'card-acwr',         stub: false },
    { name: 'Speed zones',             id: 'card-vzones',       stub: false },
    { name: 'Fitness · Fatiga · Forma',id: 'card-tsb',          stub: false },
    { name: 'Accel/Decel asym',        id: null,                stub: true  },
    { name: 'Personal baseline trend', id: null,                stub: true  },
  ],
  grp: [
    // ── Default-visible card (científica de ejemplo) ──
    { name: 'Outliers',                 id: 'card-outliers',             stub: false },
    // ── Bespoke stasheadas (recuperables vía Add card) ──
    { name: 'Variation vs equivalents',id: 'card-sc-zscore-temporal',   stub: false },
    { name: 'vs sesión',               id: 'card-sc-vs-session',        stub: false },
    { name: 'Z-score matrix',           id: 'card-zscore-matrix',        stub: false },
    { name: 'Microcycle heatmap',       id: 'card-mc-heat',              stub: false },
    { name: 'Position profile',         id: 'card-pos-radar',            stub: false },
    // ── Not yet implemented ──
    { name: 'Position box plot',        id: null,                        stub: true },
    { name: 'Squad readiness',          id: null,                        stub: true },
  ],
  mind: [
    { name: 'Player card',     id: 'card-mp-player', stub: false },
    { name: 'Match metric',    id: 'card-mp-td', stub: false },
    { name: 'Velocity zones',  id: 'card-mp-hi', stub: false },
    // Próximamente — requiere eventos/granularidad de partido:
    { name: 'Halves drop-off', id: null,         stub: true  },
  ],
  mgrp: [
    // ── Default-visible card (científica de ejemplo) ──
    { name: 'ACWR gauges',                    id: 'card-lm-gauges',      stub: false },
    // ── Not yet implemented ──
    { name: 'Us vs opponent',                 id: null, stub: true },
  ],
  mc: [
    // ── Default-visible cards (genérica + científica) ──
    { name: 'MC diff table',   id: 'card-mc-table',       stub: false },
    { name: 'Monotonía & strain', id: 'card-mc-monotony', stub: false },
    // ── Bespoke stasheadas (recuperables vía Add card) ──
    { name: 'Exposure context',   id: 'card-mc-exposure', stub: false },
    { name: 'Biggest movers',     id: 'card-mc-movers',   stub: false },
    { name: 'Microcycle shape',   id: 'card-mc-shape',    stub: false },
    // Weekly volume · wk-on-wk vive en 'ind' pero es una comparación de microciclos:
    // se permite también acá (ver _EXTRA_CARD_OWNERS) para que persista en este dashboard.
    { name: 'Weekly bars',        id: 'card-weekly-bars', stub: false },
  ],
};

// Stash: card elements removed from dashboard but recoverable
const _cardStash = new Map(); // cardId → HTMLElement
window.gpCardStash = _cardStash;   // gp-tabs lo consulta al adoptar una card en un dashboard propio

// REMOVED — the one-time "layout reset (v2)" mechanism. It was gated by a localStorage flag
// (gpsLayoutReset_v2_<view>), so clearing the browser cache / "Clear site data" wiped the flag and
// re-triggered the reset EVERY time — destructively overwriting the user's saved Supabase layout
// with the defaults. A destructive migration must never depend on volatile localStorage. The
// migration is long done; the persisted layout (gps_dashboard_layouts) is the single source of truth.

// Stash every card in the grid whose data-card-id is NOT in activeIds.
// GRID-SCOPED (not catalog-scoped): iterates the ACTUAL .gp-c in the view's grid instead of only the
// GP_CARD_DEFS catalog. A static card hardcoded in the HTML but ABSENT from GP_CARD_DEFS (e.g.
// card-gen-week-kpi) was unreachable by the old catalog loop → it survived an empty layout, leaving
// the dashboard non-empty after the user cleared it. Grid-scoped makes the saved layout the single
// source of truth: activeIds empty → every card is absent → grid emptied.
// TIMING: every load-flow caller (applyDefault*/applyLayoutToView) runs this BEFORE
// _mountSavedBuilderCards, so at this point the grid holds ONLY static cards → builder cards are
// never stashed by mistake here. (The one after-mount caller is _svLoad, where stashing builder
// cards absent from the loaded snapshot is the intended saved-views semantics.)
function _stashAbsentCards(viewKey, activeIds) {
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;
  grid.querySelectorAll('.gp-c[data-card-id]').forEach(card => {
    const cid = card.dataset.cardId || '';
    if (!activeIds.has(cid)) {
      _cardStash.set(card.id || cid, card);   // key = element id (catalog cards) so _unstashToGrid finds them
      card.remove();
    }
  });
}

// Bring cards from stash into grid for every card_id present in activeIds.
function _unstashToGrid(viewKey, activeIds, grid) {
  const defs = (GP_CARD_DEFS[viewKey] || []).filter(d => d.id && !d.stub);
  const addBtn = grid.querySelector('.gp-add');
  for (const def of defs) {
    const stashed = _cardStash.get(def.id);
    if (!stashed) continue;
    if (!activeIds.has(stashed.dataset.cardId || '')) continue;
    if (grid.querySelector(`[data-card-id="${stashed.dataset.cardId}"]`)) continue;
    _cardStash.delete(def.id);
    if (addBtn) grid.insertBefore(stashed, addBtn); else grid.appendChild(stashed);
  }
}


// ── "Agregar gráfico" panel (dos caminos + galería de evidencia) ──────────────
// Look portado de assets/chart-reference/add-chart.css/js (aprobado). Reemplaza al
// "Add card" como único punto de "agregar". NO borra nada: solo instala el panel.
//
// PLANTILLAS CIENTÍFICAS — editá SOLO este array. cardId = id de la science card
// bespoke (la que ya existe) que inserta el botón "Agregar".
const AC_TPLS = [
  { id:'acwr', cardId:'card-acwr', nm:'ACWR — Acute:chronic load',
    ds:'Acute (7d) : chronic (28d) ratio with a safety zone. Selectable base metric (Player Load by default).',
    cite:'Gabbett 2016', type:'Line + band', icon:'ti-activity-heartbeat', color:'var(--cm-accent)',
    info:'selectable base metric',
    ref:{ title:'Acute:Chronic Workload Ratio', author:'Gabbett, T. (2016) · Br J Sports Med',
      body:'Relates recent load (acute, ~7 days) to habitual load (chronic, ~28 days). Values between 0.8 and 1.3 are associated with lower injury risk; spikes above 1.5 raise the risk.',
      doi:'10.1136/bjsports-2015-095788' } },
  { id:'monotony', cardId:'card-mc-monotony', nm:'Monotony / Strain',
    ds:'Daily monotony (mean/SD) and weekly strain from the Foster method.',
    cite:'Foster 1998', type:'Bars + KPI', icon:'ti-wave-sine', color:'var(--cm-info)',
    info:'commonly used for load',
    ref:{ title:'Training Monotony & Strain', author:'Foster, C. (1998) · Med Sci Sports Exerc',
      body:'Monotony is the mean daily load divided by its standard deviation. Strain multiplies the weekly load by the monotony. Sustained high monotony is linked to staleness and illness.',
      doi:'10.1097/00005768-199807000-00023' } },
  { id:'ff', cardId:'card-tsb', nm:'Fitness · Fatigue · Form',
    ds:'CTL / ATL / TSB model to read condition and freshness.',
    cite:'Banister', type:'Multi-line', icon:'ti-chart-line', color:'var(--cm-violet)',
    info:'commonly used for planning',
    ref:{ title:'Fitness-Fatigue model (CTL/ATL/TSB)', author:'Banister, E. (1991) · impulse-response',
      body:'CTL (fitness) is the chronic load; ATL (fatigue) the acute; TSB (form) is their difference. Positive TSB indicates freshness; strongly negative, accumulated fatigue.',
      doi:'—' } },
  { id:'zones', cardId:'card-vzones', nm:'Speed zones',
    ds:'Distance by speed threshold (walk → sprint).',
    cite:'Dwyer 2012', type:'Stacked bars', icon:'ti-stack-2', color:'var(--cm-success)',
    info:'commonly used for GPS',
    ref:{ title:'Speed Zone Distribution', author:'Dwyer & Gabbett (2012) · J Strength Cond Res',
      body:'Splits the distance covered into speed thresholds. It separates low-intensity volume from high-speed and sprint work, key to dosing exposure.',
      doi:'10.1519/JSC.0b013e318236a3d2' } },
  { id:'zscore', cardId:'card-outliers', nm:'Outliers z-score',
    ds:'Player deviations from their own mean (±z).',
    cite:'z-score', type:'Scatter + ref', icon:'ti-chart-dots', color:'var(--cm-warning)',
    info:'commonly used for monitoring',
    ref:{ title:'Standardized deviation (z-score)', author:'Standard statistics',
      body:'Expresses how many typical deviations a value sits from their own mean. |z| ≥ 2 flags atypical sessions worth reviewing (unusual load or data error).',
      doi:'—' } },
  { id:'variation', cardId:'card-pos-radar', nm:'Variation vs equivalents',
    ds:'Compares the player against their position or role group.',
    cite:'Benchmark', type:'Bars + Δ', icon:'ti-arrows-diff', color:'var(--cm-neutral)',
    info:'commonly used for comparisons',
    ref:{ title:'Comparison with equivalents', author:'Positional benchmark',
      body:'Places the metric against the median of players in the same position or role, showing the delta. Useful to spot who is loading above or below their group.',
      doi:'—' } },
  { id:'xmatch', cardId:'card-xmatch', nm:'× match avg',
    ds:'Training volume as multiples of match demand.',
    cite:'Stevens 2017', type:'Bars + ×', icon:'ti-ball-football', color:'var(--cm-info)',
    info:'commonly used for dosing',
    ref:{ title:'Training relative to match demand (× match)', author:'Stevens, T. et al. (2017) · Science and Medicine in Football',
      body:'Expresses the volume of each session as a multiple of average match demand (e.g. 0.6× distance, 1.2× sprint). It helps dose weekly exposure relative to what competing requires.',
      doi:'10.1080/24733938.2017.1282163' } },
  { id:'radar', cardId:'card-radar', nm:'Radar profile',
    ds:'Multivariable z-normalized player profile vs baseline.',
    cite:'z-profile', type:'Radar', icon:'ti-chart-radar', color:'var(--cm-violet)',
    info:'commonly used for profiling',
    ref:{ title:'Multivariable profile (z-normalized radar)', author:'Normalized profile vs baseline',
      body:'Shows several metrics at once, each axis normalized (z-score) against their baseline, to read at a glance where they are above or below their usual.',
      doi:'—' } },
  { id:'weekly', cardId:'card-weekly-bars', nm:'Weekly volume · wk-on-wk',
    ds:'Week-by-week volume to track progression and spikes.',
    cite:'wk-on-wk', type:'Weekly bars', icon:'ti-chart-bar', color:'var(--cm-accent)',
    info:'commonly used for load',
    ref:{ title:'Week-by-week volume', author:'Weekly load monitoring',
      body:'Compares the aggregate volume of each week with the previous one. Sharp week-to-week jumps (high acute load) are an early sign of overload; it helps smooth progression.',
      doi:'—' } },
  { id:'playercard', cardId:'card-mp-player', nm:'Player card',
    ds:'Photo, name and identity of the filtered player — turns Match Performance into a per-player report.',
    cite:'identity', type:'Identity card', icon:'ti-id-badge-2', color:'var(--cm-accent)',
    info:'Match Performance dashboard',
    ref:{ title:'Player identity card', author:'Report header',
      body:'Shows the photo, name, number, position and match count of the player selected in the filter bar. Add it to Match Performance and filter by a single player to build an individual match report.',
      doi:'—' } },
];

const _AC_DASH_NAMES = { ind:'Player Week Report', grp:'Session Control',
  mind:'Match Performance', mgrp:'Load Monitoring', mc:'Microcycle Compare' };

function _acEsc(s) { return String(s==null?'':s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

function _acHeader(dashName) {
  return `<div class="ac-head"><span class="ic"><i class="ti ti-chart-histogram"></i></span>
    <span class="tt"><h2>Add chart</h2>
      <span class="sub"><i class="ti ti-layout-dashboard"></i>on dashboard · <b>${_acEsc(dashName)}</b></span></span>
    <button class="ac-x" type="button"><i class="ti ti-x"></i></button></div>`;
}
function _acPaths(active) {
  const card = (icon, nm, ds, badge, on, path) => `<button class="ac-path${on?' is-on':''}" type="button" data-acpath="${path}">
      <span class="pic"><i class="ti ${icon}"></i></span>
      <span class="pbody"><span class="nm">${nm}${badge?`<span class="badge">${badge}</span>`:''}</span><span class="ds">${ds}</span></span>
      <span class="tick"><i class="ti ti-check"></i></span></button>`;
  return `<div class="ac-paths">
    ${card('ti-flask','Evidence-based template','Ready cards, scientifically validated.','recommended',active==='tpl','tpl')}
    ${card('ti-adjustments-alt','Build custom','Pick metrics, type and aggregation · opens the Chart builder.','',active==='custom','custom')}</div>`;
}
// Dashboard donde vive hoy la card de una plantilla (su elemento existe una sola vez en el HTML),
// o null si no tiene casa fija. NO es un bloqueo: la plantilla se puede agregar a cualquier
// dashboard y la card se MUEVE hasta ahí — una card estática es un único elemento del DOM con su
// lógica atada a ese id, así que puede estar en un dashboard a la vez, pero el club elige en cuál.
// La galería lo usa para sugerir dónde encaja mejor, no para impedir nada.
function _acTplOwner(t) {
  const cid = String(t.cardId || '').replace(/^card-/, '');
  return _STATIC_CARD_OWNER.get(cid) || null;
}
function _acTplForeign(t, view) {
  const owner = _acTplOwner(t);
  if (!owner || owner === view) return null;
  const cid = String(t.cardId || '').replace(/^card-/, '');
  if (_EXTRA_CARD_OWNERS[cid]?.has(view)) return null;
  return _AC_DASH_NAMES[owner] || owner;
}
function _acTplCard(t, view) {
  const foreign = _acTplForeign(t, view);
  return `<div class="ac-tpl" data-actpl="${t.id}">
    <div class="ac-tpl-top">
      <span class="spark" style="background:color-mix(in srgb, ${t.color} 14%, var(--cm-surface)); color:${t.color}"><i class="ti ${t.icon}"></i></span>
      <span class="nm">${_acEsc(t.nm)}</span>
      <button class="ac-help" type="button" title="View scientific reference"><i class="ti ti-help"></i></button>
    </div>
    <div class="ds">${_acEsc(t.ds)}</div>
    <div class="ac-tpl-tags"><span class="ac-cite"><i class="ti ti-quote"></i>${_acEsc(t.cite)}</span>
      <span class="ac-info"><i class="ti ti-info-circle"></i>${_acEsc(t.info)}</span></div>
    <div class="ac-tpl-foot"><span class="type"><i class="ti ti-chart-histogram"></i>${_acEsc(t.type)}</span>
      ${foreign
        ? `<span class="ac-owned" title="${_acEsc(tt('gps_analysis.tpl_suggested_hint', 'Right now this card is on {dash}. If you add it here, it moves.', { dash: foreign }).replace('{dash}', foreign))}"><i class="ti ti-bulb"></i>${_acEsc(tt('gps_analysis.tpl_suggested', 'Suggested on {dash}', { dash: foreign }).replace('{dash}', foreign))}</span>`
        : ''}
      <button class="ac-add" type="button"><i class="ti ti-plus"></i>${_acEsc(tt('gps_analysis.tpl_add', 'Add'))}</button></div>
    <div class="ac-refpop" hidden>
      <div class="ac-refpop-h"><span class="ic"><i class="ti ti-book"></i></span>
        <span class="m"><span class="t">${_acEsc(t.ref.title)}</span><span class="a">${_acEsc(t.ref.author)}</span></span></div>
      <div class="ac-refpop-b"><p>${_acEsc(t.ref.body)}</p>
        <span class="doi"><i class="ti ti-link"></i>DOI <a href="#" onclick="return false">${_acEsc(t.ref.doi)}</a></span></div>
    </div></div>`;
}
function _acPanel(active, dashName, view) {
  if (active === 'custom') {
    return `<div class="ac-panel" style="width:600px">${_acHeader(dashName)}${_acPaths('custom')}
      <div class="ac-custom"><span class="ic"><i class="ti ti-adjustments-alt"></i></span>
        <span class="t">Build custom</span>
        <span class="d">Pick the metrics, chart type and aggregation. The Chart builder opens with a blank canvas.</span>
        <button class="go ac-open-builder" type="button"><i class="ti ti-arrow-right"></i>Open Chart builder</button></div>
      <div class="ac-foot"><span class="hint"><i class="ti ti-bulb"></i>Not sure where to start? Try an evidence-based template.</span>
        <span class="btns"><button class="ac-btn-ghost ac-cancel" type="button">Cancel</button></span></div></div>`;
  }
  // Todas las plantillas se pueden agregar en cualquier dashboard: el contador es el total.
  const _avail = AC_TPLS.length;
  return `<div class="ac-panel">${_acHeader(dashName)}${_acPaths('tpl')}
    <div class="ac-gallery"><div class="ac-gallery-h"><span class="t">Templates</span><span class="n">${_avail}</span>
      <span class="all"><i class="ti ti-circle-check"></i>${_acEsc(tt('gps_analysis.tpl_all_here', 'All of them can go on this dashboard'))}</span></div>
      <div class="ac-grid">${AC_TPLS.map(t => _acTplCard(t, view)).join('')}</div></div>
    <div class="ac-foot"><span class="hint"><i class="ti ti-bulb"></i>Templates come with metrics, type and thresholds preconfigured.</span>
      <span class="btns"><button class="ac-btn-ghost ac-cancel" type="button">Cancel</button></span></div></div>`;
}

let _acOverlay = null;
function _acClose() { if (_acOverlay) { _acOverlay.remove(); _acOverlay = null; } }
function _acDashName() { return _AC_DASH_NAMES[document.querySelector('.gp-view.is-on')?.dataset.view] || 'este dashboard'; }

// Inserta la science card bespoke (la que ya existe) en el dashboard ACTUAL. Si hoy está en otro
// dashboard, se MUEVE hasta acá: el elemento es único en el HTML, así que vive donde el club
// decida. Se registra la adopción para que saveLayout no la descarte por venir de otra vista, y
// se re-guarda el layout de origen para que allá deje de figurar.
function _acInsertCard(cardId, name) {
  const grid = document.querySelector('.gp-view.is-on .gp-grid');
  if (!grid) { showToast('No active dashboard', true); return; }
  const cid = cardId.replace(/^card-/, '');
  if (grid.querySelector('#' + cardId + ', [data-card-id="' + cid + '"]')) {
    showToast(`${name} ya está en este dashboard`); return;
  }
  let card = document.getElementById(cardId) || _cardStash.get(cardId);
  if (!card) { showToast(`${name}: card unavailable`, true); return; }
  const from = card.closest ? (card.closest('.gp-view')?.dataset.view || null) : null;
  _cardStash.delete(cardId);
  const addBtn = grid.querySelector('.gp-add');
  if (addBtn) grid.insertBefore(card, addBtn); else grid.appendChild(card);
  _acClose();
  const v = document.querySelector('.gp-view.is-on')?.dataset.view;
  const owner = _STATIC_CARD_OWNER.get(cid);
  if (v && owner && owner !== v) _gpAdopt(cid, v);
  const fromName = (from && from !== v) ? (_AC_DASH_NAMES[from] || '') : '';
  showToast(fromName ? `${name}: movida desde ${fromName}` : `${name} agregada`);
  try { window.refreshDashboard?.(); } catch (e) { /* best-effort repaint */ }
  if (from && from !== v) saveLayout(from).catch(e => console.warn('saveLayout (add-chart, origen):', e));
  if (v) saveLayout(v).catch(e => console.warn('saveLayout (add-chart):', e));
  // Dashboard propio del club: su contenido no vive en gps_dashboard_layouts sino en
  // dashboard_cards, así que la card queda anotada ahí como card de catálogo adoptada.
  if (v && v.startsWith('db-') && window.insertCardIntoDashboard && window.sb && !card.dataset.rowId) {
    window.insertCardIntoDashboard({ schema: 'gp.static/v1', staticId: cardId, title: name },
      v.slice(3), window._gpUserId || null, window.sb)
      .then(rowId => { if (rowId) card.dataset.rowId = rowId; })
      .catch(e => console.warn('add-chart (dashboard propio):', e));
  }
}

function _acRender(active) {
  if (!_acOverlay) return;
  _acOverlay.innerHTML = _acPanel(active, _acDashName(), document.querySelector('.gp-view.is-on')?.dataset.view || '');
  // header / cancel / backdrop close
  _acOverlay.querySelector('.ac-x')?.addEventListener('click', _acClose);
  _acOverlay.querySelectorAll('.ac-cancel').forEach(b => b.addEventListener('click', _acClose));
  // path switching
  _acOverlay.querySelectorAll('[data-acpath]').forEach(b =>
    b.addEventListener('click', () => _acRender(b.dataset.acpath)));
  // custom → Chart builder (lienzo en blanco)
  _acOverlay.querySelector('.ac-open-builder')?.addEventListener('click', () => {
    _acClose();
    if (window.GpBuilder?.startNew) window.GpBuilder.startNew();
    else showToast('Chart builder hasn’t loaded yet', true);
  });
  // template cards: "?" popover + "Agregar"
  _acOverlay.querySelectorAll('.ac-tpl').forEach(tpl => {
    const t = AC_TPLS.find(x => x.id === tpl.dataset.actpl);
    tpl.querySelector('.ac-help')?.addEventListener('click', e => {
      e.stopPropagation();
      const pop = tpl.querySelector('.ac-refpop'), wasOpen = !pop.hidden;
      _acOverlay.querySelectorAll('.ac-refpop').forEach(p => { p.hidden = true; p.closest('.ac-tpl').classList.remove('has-pop'); });
      if (!wasOpen) { pop.hidden = false; tpl.classList.add('has-pop'); }
    });
    tpl.querySelector('.ac-add')?.addEventListener('click', () => t && _acInsertCard(t.cardId, t.nm));
  });
}

function openAddChart() {
  _acClose();
  _acOverlay = document.createElement('div');
  _acOverlay.className = 'ac-overlay';
  _acOverlay.addEventListener('click', e => { if (e.target === _acOverlay) _acClose(); });
  document.body.appendChild(_acOverlay);
  _acRender('tpl');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && _acOverlay) _acClose(); });

// ── Dashboard layout persistence ──────────────────────────────
const _DASHBOARD_IDS = {
  ind: 'player_week', grp: 'session_control',
  mind: 'match_performance', mgrp: 'load_monitoring', mc: 'microcycle_compare',
};

// Static card ownership, captured ONCE from the PRISTINE HTML at parse time (this script runs after
// the .gp-view markup, and before applyLayout/paste can move anything). Maps each static card's
// data-card-id → its owning view. saveLayout uses it to NEVER persist a static card under a dashboard
// it doesn't belong to (the cross-dashboard contamination: cards pasted/leaked into the wrong grid,
// then cemented under the wrong dashboard_id, compounding "peor cada vez"). Builder cards (UUIDs) have
// no static owner here → they pass through (their real dashboard can't be read from the DOM — see note).
const _STATIC_CARD_OWNER = (() => {
  const m = new Map();
  document.querySelectorAll('.gp-view[data-view]').forEach(v => {
    const view = v.dataset.view;
    v.querySelectorAll('.gp-grid .gp-c[data-card-id]').forEach(c => {
      if (c.dataset.cardId) m.set(c.dataset.cardId, view);
    });
  });
  return m;
})();

// Cards que legítimamente pueden vivir en MÁS de un dashboard (no son contaminación):
// su HTML-home está en una vista pero se ofrecen en el catálogo de otra. saveLayout NO
// debe descartarlas cuando el usuario las agrega a esa vista extra. weekly-bars vive en
// 'ind' pero es una comparación de microciclos → también válida en 'mc'.
const _EXTRA_CARD_OWNERS = { 'weekly-bars': new Set(['ind', 'mc']) };

// Cards de catálogo que el USUARIO llevó a otro dashboard. Antes la galería las bloqueaba fuera
// de su vista dueña ("On Player Week Report") porque saveLayout descartaba cualquier card estática
// que apareciera en un dashboard ajeno — un guard contra la contaminación cruzada que también
// impedía la decisión legítima de moverla. Ahora se distinguen los dos casos: la que se filtró
// por un bug se sigue descartando; la que el usuario eligió mover queda registrada acá, y el
// registro viaja en el layout (item.adopted) para sobrevivir a la recarga.
const _gpAdopted = new Map();   // card_id (sin el prefijo "card-") → Set(viewKey)
function _gpAdopt(cardId, view) {
  if (!cardId || !view) return;
  if (!_gpAdopted.has(cardId)) _gpAdopted.set(cardId, new Set());
  _gpAdopted.get(cardId).add(view);
}
function _gpIsAdopted(cardId, view) {
  const s = cardId ? _gpAdopted.get(cardId) : null;
  return !!(s && s.has(view));
}
/** Trae al grid las cards que este dashboard adoptó y que hoy viven en el HTML de otra vista. */
function _gpBringAdopted(grid, viewKey, layout) {
  if (!grid || !Array.isArray(layout)) return;
  for (const it of layout) {
    if (!it || !it.adopted || !it.card_id) continue;
    _gpAdopt(it.card_id, viewKey);
    if (grid.querySelector(`[data-card-id="${it.card_id}"]`)) continue;
    const el = _cardStash.get('card-' + it.card_id)
      || document.querySelector(`.gp-c[data-card-id="${it.card_id}"]`);
    if (!el) continue;
    _cardStash.delete('card-' + it.card_id);
    const addBtn = grid.querySelector('.gp-add');
    if (addBtn) grid.insertBefore(el, addBtn); else grid.appendChild(el);
  }
}

// Tamaño y posición EFECTIVOS de una card, que es lo que hay que guardar: lo que se ve.
// Los tiles compactos (KPI y gauge de una métrica) llevan su ancho y alto en el CSS con
// !important —2×3, 180 px—, así que su dataset seguía diciendo el bucket con el que nacieron
// (6×7) y era eso lo que se persistía: el layout reservaba para esa card un hueco tres veces
// más grande del que ocupa, y las vecinas se colocaban contra un tamaño que nadie ve.
// Se lee primero el valor computado de la variable (el que gana), y sólo si no hay, el dataset.
window.gpCoord = _gpCoord;   // gp-builder lo usa al re-adjuntar el layout de una card editada
function _gpCoord(el, key) {
  if (!el) return NaN;
  let v = NaN;
  try { v = parseInt(getComputedStyle(el).getPropertyValue('--gp-' + key), 10); } catch (_) { v = NaN; }
  if (Number.isFinite(v)) return v;
  const d = parseInt(el.dataset[key], 10);
  if (Number.isFinite(d)) return d;
  const inline = parseInt(el.style.getPropertyValue('--gp-' + key), 10);
  return Number.isFinite(inline) ? inline : NaN;
}

// Custom dashboards (viewKey "db-<uuid>") store their layout GLOBALLY on the dashboard: the
// {x,y,w,h,size} of each card is written into that card's own config in dashboard_cards. That way
// the arrangement is shared by everyone who opens the dashboard, travels on duplicate (the config
// is copied verbatim), and survives reloads — unlike the per-user gps_dashboard_layouts table that
// only backs the 5 fixed dashboards. Non-editors' writes are blocked by RLS and swallowed quietly.
async function _saveCustomDashboardLayout(viewKey) {
  if (!window.sb) return;
  if (window._gpLayoutReady === false) return;   // don't cement provisional coords mid-load
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.gp-c[data-card-id]')];
  if (!cards.length) return;
  const _coord = (el, key) => _gpCoord(el, key);
  try {
    await Promise.all(cards.map((el, idx) => {
      // Never write a card whose live config we don't hold — that would clobber its metrics/config
      // with a style-only object. All builder-mounted cards carry __config (gp-tabs _buildCardElement,
      // builder save); a card without it is skipped (its coords persist on the next reload).
      // Card de catálogo adoptada: no tiene __config (su contenido lo maneja la página), pero sí
      // una fila propia. Se le guarda qué card es y dónde quedó, para que vuelva a su sitio.
      if ((!el.__config || typeof el.__config !== 'object') && el.dataset.rowId && el.id) {
        const sx = _coord(el, 'x'), sy = _coord(el, 'y'), sw = _coord(el, 'w'), sh = _coord(el, 'h');
        const scfg = { schema: 'gp.static/v1', staticId: el.id,
          style: { size: el.dataset.size || 'md',
            ...([sx, sy, sw, sh].every(Number.isFinite)
              ? { canvas: { x: sx, y: sy, w: sw, h: sh, size: el.dataset.size || 'md' } } : {}) } };
        return window.sb.from('dashboard_cards')
          .update({ config: scfg, size: el.dataset.size || 'md', position: idx })
          .eq('id', el.dataset.rowId);
      }
      if (!el.__config || typeof el.__config !== 'object') return Promise.resolve();
      const cfg = { ...el.__config };
      const style = { ...(cfg.style || {}) };
      const size = el.dataset.size || 'md';
      const x = _coord(el, 'x'), y = _coord(el, 'y'), w = _coord(el, 'w'), h = _coord(el, 'h');
      if ([x, y, w, h].every(Number.isFinite)) {
        style.canvas = { x, y, w, h, size };
        style.span = Math.max(1, Math.min(12, w));   // keep legacy width in sync
      }
      style.size = size;
      cfg.style = style;
      el.__config = cfg;
      // RLS enforces edit permission; a viewer's update just returns an error we ignore.
      return window.sb.from('dashboard_cards').update({ config: cfg, size, position: idx }).eq('id', el.dataset.cardId);
    }));
  } catch (err) { console.warn(`saveLayout(${viewKey}): custom layout save failed:`, err); }
}

async function saveLayout(viewKey, overrideDid) {
  // Custom dashboards keep a global, per-card layout (see _saveCustomDashboardLayout).
  if (!overrideDid && typeof viewKey === 'string' && viewKey.startsWith('db-')) return _saveCustomDashboardLayout(viewKey);
  const did = overrideDid || _DASHBOARD_IDS[viewKey];
  if (!did) { console.warn(`saveLayout(${viewKey}): unknown viewKey`); return; }
  if (!window.sb) { console.warn(`saveLayout(${viewKey}): Supabase not ready`); return; }
  try {
    const uid = await gpsGetUserId();
    const cid = await window.getClubId?.();
    if (!uid || !cid) { console.warn(`saveLayout(${viewKey}): uid=${uid} cid=${cid} — skipping`); return; }
    const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
    if (!grid) { console.warn(`saveLayout(${viewKey}): grid not found`); return; }
    // OWNERSHIP FILTER (root-cause fix): never persist a card that belongs to ANOTHER dashboard.
    // A static card whose HTML-fixed owner (_STATIC_CARD_OWNER) is a DIFFERENT view leaked into this
    // grid (paste/contaminated mount) → drop it, don't cement it under this dashboard_id. This is
    // DEFENSIVE: even if a foreign card is in the grid, saveLayout stops the compounding corruption.
    // (Builder UUIDs have no static owner → kept; their true dashboard isn't readable from the DOM.)
    const _kept = [...grid.querySelectorAll('.gp-c')].filter(el => {
      const owner = _STATIC_CARD_OWNER.get(el.dataset.cardId);
      const _allowedExtra = _EXTRA_CARD_OWNERS[el.dataset.cardId]?.has(viewKey);
      if (owner && owner !== viewKey && !_allowedExtra && !_gpIsAdopted(el.dataset.cardId, viewKey)) { console.warn(`saveLayout(${viewKey}): dropping foreign card "${el.dataset.cardId}" (owner=${owner})`); return false; }
      return true;
    });
    const layout = _kept.map((el, idx) => {
      const _cid = _deriveCardId(el, idx);
      const _own = _STATIC_CARD_OWNER.get(_cid);
      const item = {
        card_id: _cid,
        // La card vive en el HTML de otra vista y está acá porque el usuario la trajo: se anota,
        // para poder volver a traerla en la próxima carga (ver _gpBringAdopted).
        ...(_own && _own !== viewKey ? { adopted: true } : {}),
        size: el.dataset.size || 'md',
        // `span` is NO LONGER persisted as an independent width source — it used to contradict the
        // coord `w` (stale span:6 vs w:12) and win at mount, painting cards half-width (auto-flow look).
        // Width is driven solely by w/x/y/h below; legacy readers derive span from w (see gpSpanOf).
        position: idx,
        config: { ...(() => { try { return JSON.parse(el.dataset.config || '{}'); } catch { return {}; } })(), ...(el.dataset.metricKey ? { metric_key: el.dataset.metricKey } : {}) },
      };
      // Carry the free-canvas coordinates. Read the EFFECTIVE value: dataset first, else
      // the live CSS var that actually drives the grid placement (--gp-x/y/w/h). This keeps
      // the save correct even if dataset and the CSS var ever desync — the size/position the
      // user SEES is what gets persisted.
      const _coord = (key) => _gpCoord(el, key);
      const x = _coord('x'), y = _coord('y'), w = _coord('w'), h = _coord('h');
      // Persist the on-screen coords of EVERY card. The auto-flow flag (dataset.autoFlow, set by
      // gp-canvas for an invented position) only matters DURING load — there we must NOT freeze a
      // provisional pre-saved-layout order (gate=false → keep those cards coordless so they re-flow).
      // But once the layout is READY (gate=true = a USER-driven save: drag/resize drop or Save button),
      // the auto-flowed position IS the intended layout, so freeze it too. Without this, a card the
      // user never dragged stayed coordless and re-flowed on reload → only the dragged card persisted
      // ("2 cards / 1 con coords") and the arrangement wasn't reproduced.
      const _committed = window._gpLayoutReady !== false;   // true after load = a real user save
      if ((_committed || el.dataset.autoFlow !== '1') && [x, y, w, h].every(Number.isFinite)) {
        Object.assign(item, { x, y, w, h });
      }
      return item;
    });
    const { error } = await window.sb.from('gps_dashboard_layouts').upsert(
      { user_id: uid, club_id: cid, dashboard_id: did, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,club_id,dashboard_id' }
    );
    if (error) {
      console.error('saveLayout: Supabase error:', error);
      showToast('Failed to save layout — check the console', true);
    }
    // Automático: si el usuario tiene permiso (admin/owner/fitness/S&C), su layout ADEMÁS se vuelve el
    // default del club → los usuarios que no tienen layout propio lo heredan. La RPC valida el rol
    // server-side (el chequeo de bucket acá solo evita una llamada que fallaría para el resto).
    try {
      const _prof = await window.getProfile?.();
      const _buckets = window.cmRoleBuckets ? window.cmRoleBuckets(_prof) : new Set();
      if (_buckets.has('admin') || _buckets.has('sc')) {
        const { error: cdErr } = await window.sb.rpc('gps_set_club_default_layout', { p_dashboard_id: did, p_layout: layout });
        if (cdErr) console.warn('saveLayout: club-default update failed:', cdErr.message);
      }
    } catch (e) { console.warn('saveLayout club-default:', e); }
  } catch (err) {
    console.error('saveLayout:', err);
    showToast('Failed to save layout — check the console', true);
  }
}

async function loadLayout(viewKey) {
  const did = _DASHBOARD_IDS[viewKey];
  if (!did || !window.sb) return null;
  try {
    const uid = await gpsGetUserId();
    const cid = await window.getClubId?.();
    if (!uid || !cid) return null;
    const { data, error } = await window.sb.from('gps_dashboard_layouts')
      .select('layout').eq('user_id', uid).eq('club_id', cid).eq('dashboard_id', did).maybeSingle();
    if (error) { console.warn('loadLayout: DB error (using defaults):', error.message); return null; }
    return data?.layout || null;
  } catch (err) { console.warn('loadLayout: unexpected error (using defaults):', err); return null; }
}

// Like loadLayout() but DISTINGUISHES "genuinely no saved row" (first-time user) from "couldn't
// load" (uid/cid not ready, or DB/network error). Returns { loaded, layout }:
//   loaded:false            → load failed / not ready → callers MUST NOT write defaults (would
//                             destroy a saved layout on a transient failure).
//   loaded:true, layout:[…] → a saved layout exists → apply it.
//   loaded:true, layout:null→ CONFIRMED no saved row → genuine first-time → apply + persist defaults.
// Used by applyDefault* so a null load can never overwrite the persisted layout with defaults.
//
// In-memory cache of the LAST SUCCESSFUL strict load per viewKey (array or null). Written only on
// loaded:true — a transient failure (loaded:false) never overwrites a good value. This is the SINGLE
// SOURCE OF TRUTH for the builder-card reorder: _mountSavedBuilderCards reads it instead of firing a
// second loadLayout() that could return null on a cold/slow load and make the reorder silently skip.
const _layoutStrictCache = new Map();   // viewKey → layout (array | null), last successful load
// viewKeys cuyo layout aplicado vino del DEFAULT DEL CLUB (no del usuario). No se re-persisten como
// fila personal (ver _reconcileLayoutWithGrid) para que los cambios futuros del admin sigan propagando.
const _clubSourcedViews = new Set();
// Lee el layout POR DEFECTO DEL CLUB de un dashboard (fila '<did>~clubdefault', legible por todos los
// miembros vía RLS). Devuelve el array o null. Es el fallback cuando el usuario no tiene layout propio.
async function _loadClubDefaultLayout(did) {
  try {
    const cid = await window.getClubId?.();
    if (!cid || !window.sb || !did) return null;
    const { data, error } = await window.sb.from('gps_dashboard_layouts')
      .select('layout').eq('club_id', cid).eq('dashboard_id', did + '~clubdefault').maybeSingle();
    if (error) { console.warn('_loadClubDefaultLayout: DB error:', error.message); return null; }
    return Array.isArray(data?.layout) ? data.layout : null;
  } catch (err) { console.warn('_loadClubDefaultLayout:', err); return null; }
}
async function _loadLayoutStrict(viewKey) {
  const did = _DASHBOARD_IDS[viewKey];
  if (!did || !window.sb) return { loaded: false, layout: null };
  // RETRY transient failures (uid/cid not ready yet, or a slow/contended DB — e.g. while a GPS sync
  // is writing) before giving up. A loaded:false makes callers SKIP the reorder → cards reveal in raw
  // dashboard_cards order = the post-sync scramble. Retrying (short backoff) keeps that from happening.
  // Only a loaded:true (with layout array OR a genuine null = no saved layout) is authoritative.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const uid = await gpsGetUserId();
      const cid = await window.getClubId?.();
      if (uid && cid) {
        const { data, error } = await window.sb.from('gps_dashboard_layouts')
          .select('layout').eq('user_id', uid).eq('club_id', cid).eq('dashboard_id', did).maybeSingle();
        if (!error) {
          // Distinguish an EMPTY layout [] (the user CLEARED the dashboard → respect it, show nothing)
          // from a genuinely absent row/column (first-time → seed defaults). Collapsing []→null made
          // "delete every card" look identical to first-time and re-injected the default cards. Keep []
          // as a valid empty layout; return null ONLY when there is no row / no layout column at all.
          const raw = data?.layout;
          let layout = Array.isArray(raw) ? raw : null;
          _clubSourcedViews.delete(viewKey);
          // Fallback al DEFAULT DEL CLUB: se hereda el layout que dejó el admin/fitness/S&C cuando el
          // usuario NO tiene una disposición propia real. "Real" = al menos una card con coordenadas
          // (x/y/w/h) finitas. Esto cubre: sin fila (null), fila vacía ([]) Y la fila auto-sembrada en
          // el primer load (tiene las cards pero SIN coords → se ven en auto-flow "desordenadas"). En
          // cuanto el usuario arrastra/redimensiona una card, su fila pasa a tener coords → mantiene la
          // suya y deja de heredar. Un layout propio con coords siempre gana.
          const _hasRealCoords = Array.isArray(layout)
            && layout.some(c => [c.x, c.y, c.w, c.h].every(v => Number.isFinite(v)));
          if (!_hasRealCoords) {
            const clubLayout = await _loadClubDefaultLayout(did);
            if (clubLayout && clubLayout.length) { layout = clubLayout; _clubSourcedViews.add(viewKey); }
          }
          _layoutStrictCache.set(viewKey, layout);   // [] empty · array w/ data · null = no saved row
          return { loaded: true, layout };
        }
        console.warn(`_loadLayoutStrict(${viewKey}): DB error (attempt ${attempt + 1}/3):`, error.message);
      }
    } catch (err) { console.warn(`_loadLayoutStrict(${viewKey}): load failed (attempt ${attempt + 1}/3):`, err); }
    if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));   // backoff, then retry
  }
  return { loaded: false, layout: null };   // persistent failure → callers must NOT reorder in raw order
}

// ── Restore helpers (size + order) ─────────────────────────────
// Restaura las coords guardadas de una card PASANDO POR gpCanvas.applyCoords. Escribir
// card.dataset.x/y/w/h a mano NO alcanza: gp-canvas marca dataset.autoFlow='1' en su primer
// pintado (que corre ANTES de que llegue el layout de la red) y applyCoords es lo ÚNICO que
// borra esa marca. Si queda puesta, el renderGrid inmediatamente posterior trata las coords
// recién restauradas como provisionales (gp-canvas.js:387) y vuelve a auto-acomodar la card
// → en cada recarga se perdían posición y alto, y sobrevivía sólo el ancho. Afectaba a las
// cards estáticas de las 5 vistas; las del builder ya usaban applyCoords y por eso andaban.
function _restoreCardCoords(card, x, y, w, h) {
  if (!card || ![x, y, w, h].every(Number.isFinite)) return;
  if (window.gpCanvas?.applyCoords) { window.gpCanvas.applyCoords(card, { x, y, w, h }); return; }
  card.dataset.x = x; card.dataset.y = y; card.dataset.w = w; card.dataset.h = h;
  delete card.dataset.autoFlow;
}

// MIGRACIÓN de layouts viejos: _deriveCardId cae al TÍTULO cuando la card no tiene
// data-card-id, así que una card que lo ganó después (lm-gauges) quedó persistida bajo su
// título TRADUCIDO. Sin esto, al estrenar su data-card-id el layout no la reconocería y
// _stashAbsentCards la ocultaría. El primer saveLayout reescribe el id real y se auto-sana.
function _cardTitleKey(card) { return card.querySelector('.ttl')?.textContent?.trim() || ''; }
function _cardByTitleKey(grid, key) {
  if (!key) return null;
  return [...grid.querySelectorAll('.gp-c[data-card-id]')].find(c => _cardTitleKey(c) === key) || null;
}
function _migrateTitleKeyedIds(grid, activeIds) {
  grid.querySelectorAll('.gp-c[data-card-id]').forEach(c => {
    const k = _cardTitleKey(c);
    if (k && activeIds.has(k)) activeIds.add(c.dataset.cardId);
  });
}

function _applyCardSize(card, size, span) {
  if (!card) return;
  // Prefer the saved fine-grained span; fall back to the legacy size bucket.
  const n = span || (window.gpSpanFromSize
    ? window.gpSpanFromSize(size || 'md', card.classList.contains('is-table'))
    : null);
  if (n && window.gpApplySpan) { window.gpApplySpan(card, n); return; }
  if (size) card.dataset.size = size;
}

function _deriveCardId(el, idx) {
  return el.dataset.cardId || el.querySelector('.ttl')?.textContent?.trim() || String(idx);
}

function _reorderGrid(grid, layout) {
  if (!grid || !layout?.length) return;
  const posMap = new Map(layout.map(c => [c.card_id, c.position]));
  const cards  = [...grid.querySelectorAll('.gp-c')];
  // Derive each card's key + sort position ONCE, up front. Calling cards.indexOf(el) INSIDE the
  // sort comparator read a live index from the array being mutated in place → an unstable fallback
  // key for any card missing dataset.cardId/.ttl, so the order came out different across reloads.
  // Tie-break by original index so cards that miss the layout (→9999) keep their prior relative order.
  const keyed = cards.map((el, i) => ({ el, pos: posMap.get(_deriveCardId(el, i)) ?? 9999, i }));
  keyed.sort((a, b) => (a.pos - b.pos) || (a.i - b.i));
  const addBtn = grid.querySelector('.gp-add');
  keyed.forEach(k => grid.appendChild(k.el));
  if (addBtn) grid.appendChild(addBtn);
}

// ── Self-heal: reconcile the saved layout with the ACTUAL cards in the grid ──────
// STRUCTURAL FIX for the scramble. The whole restore pipeline (reorder + coords) keys off card_id.
// If the saved layout holds ids that no longer exist in the grid (the dashboard's cards changed but
// the layout kept the OLD ids = STALE), every card_id lookup misses → cards fall to position 9999 /
// coordless auto-flow = scramble. Until now sync happened only on create/delete (8edac09), never on
// LOAD, so a layout that went stale by any other path stayed broken forever.
//
// This runs AFTER all cards are mounted (static + builder) and BEFORE the reveal: it prunes dead ids
// and adds cards missing from the layout, then RE-PERSISTS so the DB is healed and the NEXT load is
// stable. Safeguards, so it composes with the existing 6 fixes instead of replacing them:
//   • Only touches a view whose layout LOADED successfully (cache present). A transient failure
//     (retry×3 exhausted → not cached) is skipped → never rewrites the layout on a failed load.
//   • Foreign cards (another dashboard's, per _STATIC_CARD_OWNER — 6b0b1d5) are EXCLUDED from the
//     grid set, so reconciliation never pulls a leaked card into this dashboard.
//   • Re-persist reuses saveLayout → same ownership filter + same real-vs-invented coord rule
//     (5efc269): cards that already carry real coords (set by applyDefault*/mount) keep them; new/
//     stale cards stay coordless = deterministic auto-flow. No coords are ever lost on a healthy view
//     (a healthy view is already in sync → no rewrite fires at all).
async function _reconcileLayoutWithGrid(viewKey) {
  if (!_layoutStrictCache.has(viewKey)) return;   // load failed / not ready → never rewrite
  if (_clubSourcedViews.has(viewKey)) return;      // layout heredado del club → no capturarlo como fila personal
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;
  // Grid card_ids that saveLayout WOULD keep (same ownership filter as 6b0b1d5 — skip foreign).
  const gridIds = new Set();
  [...grid.querySelectorAll('.gp-c')].forEach((el, i) => {
    const owner = _STATIC_CARD_OWNER.get(el.dataset.cardId);
    if (owner && owner !== viewKey) return;        // foreign card → not this dashboard's
    gridIds.add(_deriveCardId(el, i));
  });
  const layout    = _layoutStrictCache.get(viewKey) || [];
  const layoutIds = new Set(layout.map(c => String(c.card_id)));
  const hasDead    = [...layoutIds].some(id => !gridIds.has(id));   // layout entry with no card in the grid
  const hasMissing = [...gridIds].some(id => !layoutIds.has(id));   // grid card absent from the layout
  if (!hasDead && !hasMissing) return;             // already in sync → don't touch
  console.warn(`_reconcileLayoutWithGrid(${viewKey}): healing stale layout (dead=${hasDead}, missing=${hasMissing})`);
  // Re-persist from the CURRENT grid: saveLayout serializes the present .gp-c (auto-pruning dead ids —
  // they're not in the DOM — and adding current ones), keyed by the real card_id (_deriveCardId).
  await saveLayout(viewKey).catch(e => console.warn(`_reconcileLayoutWithGrid(${viewKey}) save:`, e));
}

// ── Apply saved layout to a view (metric_key per card) ─────────
async function applyLayoutToView(viewKey) {
  const layout = await loadLayout(viewKey);
  if (!layout?.length) return;
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;
  const activeIds = new Set(layout.map(c => c.card_id));
  _gpBringAdopted(grid, viewKey, layout);
  _stashAbsentCards(viewKey, activeIds);
  for (const { card_id, size, span, config, x, y, w, h } of layout) {
    const card = grid.querySelector(`[data-card-id="${card_id}"]`);
    if (!card) continue;
    _applyCardSize(card, size, span);
    // Canvas: restore free-placement coords so the editor reopens exactly as left.
    _restoreCardCoords(card, x, y, w, h);
    if (!config) continue;
    if (config.metric_key) card.dataset.metricKey = config.metric_key;
    if (card_id === 'weekly-bars' && (config.wkok_yellow != null || config.wkok_red != null)) {
      const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
      if (config.wkok_yellow != null) existing.wkok_yellow = config.wkok_yellow;
      if (config.wkok_red    != null) existing.wkok_red    = config.wkok_red;
      card.dataset.config = JSON.stringify(existing);
    }
    if (card_id === 'xmatch' && config.metrics?.length) {
      const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
      card.dataset.config = JSON.stringify({ ...existing, metrics: config.metrics });
    }
    if (card_id === 'sc-zscore-temporal' && config.metrics?.length) {
      const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
      card.dataset.config = JSON.stringify({ ...existing, metrics: config.metrics });
    }
  }
  _reorderGrid(grid, layout);
}

// ── Grp view: apply default visibility + restore stash state ─────
// Default visible: card-outliers (científica) + card-gen-session-table (genérica builder).
// On first load (no saved layout): stash the rest + save defaults.
// On subsequent loads: stash any card absent from saved layout.
// Dashboards vacíos por defecto: en el primer load NO se muestra ninguna card;
// el dueño agrega las que quiera. (Antes venían con algunas cards por defecto.)
const _GRP_DEFAULTS = new Set([]);

async function applyGrpDefaultLayout() {
  const grid = document.querySelector('.gp-view[data-view="grp"] .gp-grid');
  if (!grid) return;
  const defs = (GP_CARD_DEFS.grp || []).filter(d => d.id && !d.stub);

  try {
    const { loaded, layout } = await _loadLayoutStrict('grp');
    if (!loaded) return;   // load failed / not ready → never overwrite the saved layout with defaults

    if (layout == null) {   // null = no saved row (first-time). [] = user cleared it → fall through, seed NOTHING.
      // Confirmed no saved layout → genuine first-time: apply the minimal default + persist it once.
      for (const def of defs) {
        if (_GRP_DEFAULTS.has(def.id)) continue;
        const card = document.getElementById(def.id);
        if (card) { _cardStash.set(def.id, card); card.remove(); }
      }
      await saveLayout('grp').catch(e => console.warn('applyGrpDefaultLayout save:', e));
      return;
    }

    // Restore: stash cards not present in saved layout
    const activeIds = new Set(layout.map(c => c.card_id));
    _gpBringAdopted(grid, 'grp', layout);
    _stashAbsentCards('grp', activeIds);

    // Restore metric_key / config per card (delegates to applyLayoutToView logic)
    for (const { card_id, size, config, x, y, w, h } of layout) {
      const card = grid.querySelector(`[data-card-id="${card_id}"]`);
      if (!card) continue;
      _applyCardSize(card, size);
      _restoreCardCoords(card, x, y, w, h);
      if (!config) continue;
      if (config.metric_key) card.dataset.metricKey = config.metric_key;
      if ((card_id === 'sc-zscore-temporal' || card_id === 'sc-vs-session' || card_id === 'outliers') && config.metrics?.length) {
        const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
        card.dataset.config = JSON.stringify({ ...existing, metrics: config.metrics });
      }
    }
    _reorderGrid(grid, layout);
    if (window.gpCanvas && window.gpCanvas.renderGrid) window.gpCanvas.renderGrid(grid);
  } catch (e) { console.warn('applyGrpDefaultLayout:', e); }
}

// ── Mc view: apply default visibility + restore stash state ──────
// Default visible: card-mc-table (genérica builder) + card-mc-monotony (científica).
// On first load (no saved layout): stash the rest + save defaults.
const _MC_DEFAULTS = new Set([]);   // dashboard vacío por defecto

async function applyMcDefaultLayout() {
  const grid = document.querySelector('.gp-view[data-view="mc"] .gp-grid');
  if (!grid) return;
  const defs = (GP_CARD_DEFS.mc || []).filter(d => d.id && !d.stub);

  try {
    const { loaded, layout } = await _loadLayoutStrict('mc');
    if (!loaded) return;   // load failed / not ready → never overwrite the saved layout with defaults

    if (layout == null) {   // null = no saved row (first-time). [] = user cleared it → fall through, seed NOTHING.
      // Confirmed no saved layout → genuine first-time: apply the minimal default + persist it once.
      for (const def of defs) {
        if (_MC_DEFAULTS.has(def.id)) continue;
        const card = document.getElementById(def.id);
        if (card) { _cardStash.set(def.id, card); card.remove(); }
      }
      await saveLayout('mc').catch(e => console.warn('applyMcDefaultLayout save:', e));
      return;
    }

    // Restore: stash cards not present in saved layout
    const activeIds = new Set(layout.map(c => c.card_id));
    _gpBringAdopted(grid, 'mc', layout);
    _stashAbsentCards('mc', activeIds);

    for (const { card_id, size, config, x, y, w, h } of layout) {
      const card = grid.querySelector(`[data-card-id="${card_id}"]`);
      if (!card) continue;
      _applyCardSize(card, size);
      if (config?.metric_key) card.dataset.metricKey = config.metric_key;   // mc no lo restauraba
      _restoreCardCoords(card, x, y, w, h);
    }
    _reorderGrid(grid, layout);
    if (window.gpCanvas && window.gpCanvas.renderGrid) window.gpCanvas.renderGrid(grid);
  } catch (e) { console.warn('applyMcDefaultLayout:', e); }
}

// ── Generic default-visibility (ind / mgrp) ─────────────────────
// Same first-load minimization as grp/mc, parametrized by a defaults Set.
// On first load: stash every catalog card whose id is not in defaultsSet.
// Dashboards vacíos por defecto (ver nota en _GRP_DEFAULTS).
const _IND_DEFAULTS  = new Set([]);
const _MGRP_DEFAULTS = new Set([]);
const _MIND_DEFAULTS = new Set([]);

async function applyDefaultLayoutGeneric(viewKey, defaultsSet) {
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;
  const defs = (GP_CARD_DEFS[viewKey] || []).filter(d => d.id && !d.stub);
  try {
    const { loaded, layout } = await _loadLayoutStrict(viewKey);
    if (!loaded) return;   // load failed / not ready → never overwrite the saved layout with defaults
    if (layout == null) {   // null = no saved row (first-time). [] = user cleared it → fall through, seed NOTHING.
      // Confirmed no saved layout → genuine first-time: apply the minimal default + persist it once.
      for (const def of defs) {
        if (defaultsSet.has(def.id)) continue;
        const card = document.getElementById(def.id);
        if (card) { _cardStash.set(def.id, card); card.remove(); }
      }
      await saveLayout(viewKey).catch(e => console.warn(`applyDefaultLayout(${viewKey}) save:`, e));
      return;
    }
    // Subsequent loads — stash absent, apply size/metric_key, reorder
    const activeIds = new Set(layout.map(c => c.card_id));
    _migrateTitleKeyedIds(grid, activeIds);
    _gpBringAdopted(grid, viewKey, layout);
    _stashAbsentCards(viewKey, activeIds);
    for (const { card_id, size, config, x, y, w, h } of layout) {
      const card = grid.querySelector(`[data-card-id="${card_id}"]`) || _cardByTitleKey(grid, card_id);
      if (!card) continue;
      _applyCardSize(card, size);
      if (config?.metric_key) card.dataset.metricKey = config.metric_key;
      _restoreCardCoords(card, x, y, w, h);
    }
    _reorderGrid(grid, layout);
    if (window.gpCanvas && window.gpCanvas.renderGrid) window.gpCanvas.renderGrid(grid);
  } catch (e) { console.warn(`applyDefaultLayoutGeneric(${viewKey}):`, e); }
}

// ── Saved views (named snapshots over gps_dashboard_layouts) ─────
// Each snapshot is stored as an extra row with dashboard_id = "{base}__snap__{name}"

async function _svGetCtx(viewKey) {
  const did = _DASHBOARD_IDS[viewKey];
  if (!did || !window.sb) return null;
  const uid = await gpsGetUserId();
  const cid = await window.getClubId?.();
  if (!uid || !cid) return null;
  return { uid, cid, did };
}

async function _svList(viewKey) {
  const ctx = await _svGetCtx(viewKey);
  if (!ctx) return [];
  const prefix = `${ctx.did}__snap__`;
  const { data } = await window.sb.from('gps_dashboard_layouts')
    .select('dashboard_id,updated_at')
    .eq('user_id', ctx.uid).eq('club_id', ctx.cid)
    .like('dashboard_id', `${prefix}%`)
    .order('updated_at', { ascending: false });
  return (data || []).map(r => ({
    name: decodeURIComponent(r.dashboard_id.slice(prefix.length)),
    snapDid: r.dashboard_id,
  }));
}

async function _svSave(viewKey, name) {
  const ctx = await _svGetCtx(viewKey);
  if (!ctx) { showToast('Failed to save — session unavailable', true); return; }
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;
  const layout = [...grid.querySelectorAll('.gp-c')].map((el, idx) => ({
    card_id: el.dataset.cardId || el.querySelector('.ttl')?.textContent?.trim() || String(idx),
    size: el.dataset.size || 'md',
    position: idx,
    config: { ...(() => { try { return JSON.parse(el.dataset.config || '{}'); } catch { return {}; } })(),
              ...(el.dataset.metricKey ? { metric_key: el.dataset.metricKey } : {}) },
  }));
  const snapDid = `${ctx.did}__snap__${encodeURIComponent(name)}`;
  const { error } = await window.sb.from('gps_dashboard_layouts').upsert(
    { user_id: ctx.uid, club_id: ctx.cid, dashboard_id: snapDid, layout, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,club_id,dashboard_id' }
  );
  if (error) { console.error('_svSave:', error); showToast('Failed to save view', true); return; }
  showToast(`View "${name}" saved`);
}

async function _svDelete(viewKey, snapDid) {
  const ctx = await _svGetCtx(viewKey);
  if (!ctx) return;
  await window.sb.from('gps_dashboard_layouts')
    .delete().eq('user_id', ctx.uid).eq('club_id', ctx.cid).eq('dashboard_id', snapDid);
}

async function _svLoad(viewKey, snapDid, name) {
  const ctx = await _svGetCtx(viewKey);
  if (!ctx) { showToast('Failed to load — session unavailable', true); return; }
  const { data, error } = await window.sb.from('gps_dashboard_layouts')
    .select('layout').eq('user_id', ctx.uid).eq('club_id', ctx.cid).eq('dashboard_id', snapDid).maybeSingle();
  if (error || !data?.layout?.length) { showToast('View not found', true); return; }
  const snapLayout = data.layout;
  const grid = document.querySelector(`.gp-view[data-view="${viewKey}"] .gp-grid`);
  if (!grid) return;

  const activeIds = new Set(snapLayout.map(c => c.card_id));

  // Stash cards absent from snapshot, un-stash cards required by snapshot
  _gpBringAdopted(grid, viewKey, snapLayout);
  _stashAbsentCards(viewKey, activeIds);
  _unstashToGrid(viewKey, activeIds, grid);

  // Apply size + config
  for (const { card_id, size, config } of snapLayout) {
    const card = grid.querySelector(`[data-card-id="${card_id}"]`);
    if (!card) continue;
    _applyCardSize(card, size);
    if (!config) continue;
    if (config.metric_key) card.dataset.metricKey = config.metric_key;
    if (config.metrics?.length) {
      const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
      card.dataset.config = JSON.stringify({ ...existing, metrics: config.metrics });
    }
    if (card_id === 'weekly-bars' && (config.wkok_yellow != null || config.wkok_red != null)) {
      const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
      if (config.wkok_yellow != null) existing.wkok_yellow = config.wkok_yellow;
      if (config.wkok_red    != null) existing.wkok_red    = config.wkok_red;
      card.dataset.config = JSON.stringify(existing);
    }
    if (card_id === 'xmatch' && config.metrics?.length) {
      const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
      card.dataset.config = JSON.stringify({ ...existing, metrics: config.metrics });
    }
  }
  _reorderGrid(grid, snapLayout);

  // Persist snapshot as the new live layout
  await saveLayout(viewKey);

  window.renderView?.();
  window.refreshDashboard?.();
  showToast(`View "${name}" loaded`);
}

// ── KPI card rendering helpers ──────────────────────────────────
const _KPI_CORE_COLS = new Set([
  'total_distance','high_speed_distance','very_high_speed_distance',
  'sprint_distance','accelerations','decelerations','max_speed',
  'player_load','avg_speed','hmld','time_played','sprint_count','distance_per_minute',
]);

// ── Canonical metric formatter, by metric TYPE (single source of truth) ──────
// DB canonical units: ALL distances in METERS, velocities in km/h, counts as
// integers, player_load in AU. No /1000 heuristics, no name autodetection.
const _GP_DIST  = new Set(['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','hmld']);
const _GP_SPEED = new Set(['max_speed','avg_speed']);
const _GP_COUNT = new Set(['accelerations','decelerations','sprint_count']);
// Returns a formatted string for the known categories, or null for an unknown
// metric (caller falls back to the catalog unit). sub=true wraps the unit in <sub>.
window.gpFmtMetric = (key, v, sub) => {
  if (v == null || isNaN(+v)) return '—';
  const n = +v;
  const wrap = (val, unit) => sub ? `${val} <sub>${unit}</sub>` : `${val} ${unit}`;
  if (_GP_DIST.has(key))     return wrap(Math.round(n).toLocaleString('en'), 'm');   // metres, 0 dec
  if (_GP_SPEED.has(key))    return wrap(n.toFixed(1), 'km/h');                       // km/h, 1 dec
  if (_GP_COUNT.has(key))    return `${Math.round(n)}`;                               // integer count, no unit
  if (key === 'player_load') return `${n.toFixed(1)}`;                               // AU, 1 dec
  return null;                                                                        // unknown → caller decides
};
// Distance shorthand (plain "3,480 m") kept for existing call sites.
window.gpFmtDist = (m) => (m == null || isNaN(+m)) ? '—' : window.gpFmtMetric('total_distance', m, false);

function _fmtKpiValue(value, unit, metricKey) {
  if (value == null) return '—';
  const canon = window.gpFmtMetric(metricKey, value, true);
  if (canon !== null) return canon;
  // Unknown metric (custom/EAV, e.g. distance_per_minute m/min) → use its catalog unit.
  if (unit) return `${+value % 1 === 0 ? Math.round(value) : (+value).toFixed(1)} <sub>${unit}</sub>`;
  return `${Math.round(value)}`;
}

async function renderKpiCard(cardEl, metricKey, sel) {
  if (!cardEl || !sel) return;
  const kpi = cardEl.querySelector('.gp-kpi');
  if (!kpi) return;

  let value;
  if (_KPI_CORE_COLS.has(metricKey)) {
    value = sel[metricKey] ?? null;
  } else {
    try {
      const cid = window._gpClubId;
      const { from, to } = getDateRange();
      const rpts = await window.cmFetchAll(() => window.sb.from('gps_reports')
        .select('id, training_sessions!inner(session_date)')
        .eq('is_invalid', false)
        .eq('club_id', cid).eq('player_id', sel.player_id)
        .gte('training_sessions.session_date', from)
        .lte('training_sessions.session_date', to), { label: 'player-range' }).catch(() => []);
      const rids = (rpts || []).map(r => r.id);
      if (rids.length) {
        const { data: rows } = await window.sb.from('gps_report_metrics')
          .select('value').in('report_id', rids).eq('metric_key', metricKey);
        const vals = (rows || []).map(r => r.value).filter(v => v != null);
        value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
    } catch (e) { console.warn('renderKpiCard custom fetch:', e); }
  }

  const catalog = window._gpCatalog || [];
  const entry = catalog.find(m => m.key === metricKey);
  const label = entry?.label || metricKey.replace(/_/g, ' ');
  const unit  = entry?.unit  || '';

  const ttl = cardEl.querySelector('.ttl');
  if (ttl) ttl.textContent = label;

  const vEl = kpi.querySelector('.v');
  if (vEl) vEl.innerHTML = _fmtKpiValue(value, unit, metricKey);

  const tEl = kpi.querySelector('.t');
  if (tEl) tEl.innerHTML = '';
}

// ACWR · selector de MÉTRICA BASE (único parámetro elegible). Cambia solo la métrica
// sobre la que se calcula la carga aguda:crónica; bandas, umbrales y cálculo quedan
// bespoke. Re-render vía refreshDashboard → gpRenderScienceCards (lee data-metric-key).
// ── Assign rival / match to GPS days (Phase 2 · A1 historical container) ──────
// Idempotent: a day that already has a session REUSES it — sets the rival in its
// attributes if missing, never overwriting session_id / type / is_historical. A
// day whose reports have NO session gets a historical 'match' container created
// and its reports linked. Historical containers are excluded from Calendar/Planner.
// ¿Qué sesiones del club tienen GPS? Vía RPC liviana (distinct server-side). Antes se bajaban
// TODOS los gps_reports del club bajo la RLS por-fila → el panel se colgaba en "Loading GPS days…".
// Fallback al fetch viejo si la RPC todavía no está deployada. Devuelve [{session_id, n}].
async function _arGpsCounts(clubId) {
  try {
    const { data, error } = await window.sb.rpc('gps_session_ids_with_data', { p_club_id: clubId });
    if (!error && Array.isArray(data)) return data;
  } catch (_e) { /* RPC ausente → fallback */ }
  const rows = await window.cmFetchAll(() => window.sb.from('gps_reports').select('session_id').eq('club_id', clubId), { label: 'assign-rivals.reports' });
  const m = new Map();
  (rows || []).forEach(r => { if (r.session_id) m.set(r.session_id, (m.get(r.session_id) || 0) + 1); });
  return [...m.entries()].map(([session_id, n]) => ({ session_id, n }));
}
async function _gpOpenAssignRivals(opts) {
  const onlyOutsideDefault = !!(opts && opts.onlyOutside);
  const clubId = window._gpClubId || (await window.getClubId?.());
  if (!clubId) { showToast('No club selected', true); return; }
  const teamId = window._gpTeamId || null;
  const ov   = makeModal(tt('gps_analysis.ar_title','Assign rivals & seasons'), '<div id="arBody" style="min-width:600px;max-width:720px"><div style="padding:24px;color:var(--cm-fg-muted)">Loading GPS days…</div></div>');
  const body = ov.querySelector('#arBody');
  try {
    // NO team filter here: the real inclusion criterion is "the session has GPS
    // reports of THIS club" (cnt.has below) + "no rival yet". Imported / container
    // sessions often have team_id null or a different team — filtering by the active
    // team hid exactly the days that need a rival. Club-scoped only.
    const [sessions, gpsCnt, { data: opps }] = await Promise.all([
      // Paginated (server caps at ~1000): big clubs would otherwise lose sessions here too.
      window.cmFetchAll(() => window.sb.from('training_sessions')
        .select('id, session_date, session_type, is_historical, season_id, session_attributes')
        .eq('club_id', clubId), { label: 'assign-rivals.sessions' }),
      // ¿Qué sesiones tienen GPS? RPC liviana (distinct server-side) en vez de bajar miles de
      // gps_reports bajo la RLS por-fila (lo que colgaba el panel). Ver _arGpsCounts.
      _arGpsCounts(clubId),
      window.sb.from('opponent_branding').select('id, opponent_name, crest_url').eq('club_id', clubId).order('opponent_name'),
    ]);
    await _gpLoadSeasons(clubId, teamId);
    const cnt = new Map();
    (gpsCnt || []).forEach(r => { if (r.session_id) cnt.set(r.session_id, r.n || 1); });
    const gpsDays = (sessions || []).filter(s => cnt.has(s.id));                              // sessions w/ valid GPS
    const _rivalOf = s => s.session_attributes?.rival || s.session_attributes?.opponent || null;
    const _haOf = s => s.session_attributes?.home_away || null;
    const rows = gpsDays
      .filter(s => !_rivalOf(s))                                                              // no rival yet
      .map(s => ({ id: s.id, date: s.session_date, type: s.session_type, players: cnt.get(s.id), seasonId: s.season_id || null }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));                          // newest first (paging is id-ordered)
    // Days you can UNDO a rival on: GPS days that already carry a rival, plus historical
    // 'match' containers we created just to hold a rival (which may have no GPS of their own).
    // Real planned/future matches (is_historical=false) are intentionally NOT listed here.
    const assignedRows = (sessions || [])
      .filter(s => _rivalOf(s))
      .filter(s => cnt.has(s.id) || (s.is_historical === true && s.session_type === 'match'))
      .map(s => ({ id: s.id, date: s.session_date, type: s.session_type, rival: _rivalOf(s), ha: _haOf(s), seasonId: s.season_id || null }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // Diagnostics: if a known GPS day is missing from `rows`, this tells you whether it has
    // no valid GPS (excluded by is_invalid) or it already carries a rival.
    console.info(`[AssignRivals] club sessions=${sessions?.length || 0} · GPS days=${gpsDays.length} · unassigned=${rows.length} · assigned(removable)=${assignedRows.length} · seasons=${(window.__gpSeasons||[]).length}`);
    window.__gpOpponents = opps || [];
    if (!gpsDays.length && !assignedRows.length) { body.innerHTML = `<div style="padding:24px;color:var(--cm-fg-muted)">${tt('gps_analysis.ar_no_gps_days','No GPS days yet.')}</div>`; return; }
    // A day is "outside season" when it carries no season_id AND its date matches no season range.
    const _out = r => !r.seasonId && !_gpDateInAnySeason(r.date);
    const outsideCount = [...rows, ...assignedRows].filter(_out).length;
    const _seasonCell = (r) => {
      const s = r.seasonId ? _gpSeasonById(r.seasonId) : null;
      const out = _out(r);
      const label = s ? _gpEsc(s.name) : (out ? tt('gps_analysis.ar_no_season','No season') : tt('gps_analysis.ar_set_season','Set season'));
      const style = (out && !s) ? 'border-color:var(--cm-warn,#d97706);color:var(--cm-warn,#d97706)' : '';
      return `<button class="cm-btn is-outline is-sm ar-season" data-sid="${r.id}" data-season="${r.seasonId||''}" data-date="${r.date||''}" style="${style}"><i class="ti ti-calendar-stats" style="font-size:14px"></i>${label}</button>`;
    };
    const _haLabel = ha => ha === 'home' ? tt('gps_analysis.ar_home','Home') : ha === 'away' ? tt('gps_analysis.ar_away','Away') : ha === 'neutral' ? tt('gps_analysis.ar_neutral','Neutral') : '—';
    body.innerHTML = `
      <p style="font:500 11.5px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 12px">${tt('gps_analysis.ar_intro','Assign a rival to turn a GPS day into a match (the session is reused — Calendar/Planner unaffected), set Home/Away, and/or bucket the day into a season so imported/pre-season data shows in season views. Removing a rival keeps all GPS data.')}</p>
      ${outsideCount ? `<div style="display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:9px 12px;border:1px solid var(--cm-warn,#d97706);border-radius:8px;background:var(--cm-warn-soft,rgba(217,119,6,.08));color:var(--cm-warn,#d97706);font:500 11.5px/1.5 var(--cm-font-sans)"><i class="ti ti-alert-triangle" style="font-size:15px;flex-shrink:0"></i><span>${tt('gps_analysis.ar_outside_banner', `${outsideCount} imported day(s) fall outside every season — assign a season so they appear in season views.`, { count: outsideCount })}</span></div>` : ''}
      <div style="display:flex;gap:8px;margin:0 0 10px">
        <input id="arSearch" type="text" placeholder="${tt('gps_analysis.ar_search','Search date…')}" style="flex:1;padding:8px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-surface-2);color:var(--cm-fg);font:500 12px/1.4 var(--cm-font-mono);box-sizing:border-box">
        <button id="arOutToggle" class="cm-btn ${onlyOutsideDefault?'is-filled':'is-outline'} is-sm" data-on="${onlyOutsideDefault?'1':'0'}"><i class="ti ti-filter" style="font-size:14px"></i>${tt('gps_analysis.ar_only_outside','Only outside season')}</button>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin:0 0 10px;padding:7px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg-soft)">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg)"><input type="checkbox" id="arSelAll" style="cursor:pointer">${tt('gps_analysis.ar_select_all_shown','Select all shown')}</label>
        <span id="arSelCount" style="font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${tt('gps_analysis.ar_selected','0 selected',{n:0})}</span>
        <button id="arBulkSeason" class="cm-btn is-filled is-sm" disabled style="margin-left:auto"><i class="ti ti-calendar-stats" style="font-size:14px"></i>${tt('gps_analysis.ar_bulk_assign_season','Assign season')}</button>
      </div>
      <div style="max-height:48vh;overflow:auto">
      ${rows.length ? `
        <div style="font:600 10.5px/1 var(--cm-font-sans);text-transform:uppercase;letter-spacing:.06em;color:var(--cm-fg-muted);margin:0 0 6px">${tt('gps_analysis.ar_no_rival_yet','Days with no rival yet')}</div>
        <table class="gp-map-table" style="width:100%">
        <thead><tr><th style="width:26px"></th><th>${tt('gps_analysis.ar_col_date','Date')}</th><th>${tt('gps_analysis.ar_col_type','Type')}</th><th>${tt('gps_analysis.ar_col_players','Players')}</th><th>${tt('gps_analysis.ar_col_season','Season')}</th><th style="text-align:right">${tt('gps_analysis.ar_col_rival','Rival')}</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr data-sid="${r.id}" data-date="${r.date}" data-out="${_out(r)?'1':'0'}" data-search="${(r.date + ' ' + (r.type || '')).toLowerCase()}">
            <td><input type="checkbox" class="ar-check" data-sid="${r.id}" style="cursor:pointer"></td>
            <td style="font:600 12px/1 var(--cm-font-mono)">${r.date}</td>
            <td style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${r.type || '—'}</td>
            <td style="font:500 11.5px/1 var(--cm-font-mono)">${r.players}</td>
            <td>${_seasonCell(r)}</td>
            <td style="text-align:right"><button class="cm-btn is-outline is-sm ar-assign" data-sid="${r.id}" data-date="${r.date}" data-season="${r.seasonId||''}"><i class="ti ti-ball-football" style="font-size:14px"></i>${tt('gps_analysis.ar_assign_rival','Assign rival')}</button></td>
          </tr>`).join('')}</tbody>
        </table>` : ''}
      ${assignedRows.length ? `
        <div style="font:600 10.5px/1 var(--cm-font-sans);text-transform:uppercase;letter-spacing:.06em;color:var(--cm-fg-muted);margin:${rows.length ? '16px' : '0'} 0 6px">${tt('gps_analysis.ar_with_rival','Days with a rival')}</div>
        <table class="gp-map-table" style="width:100%">
        <thead><tr><th style="width:26px"></th><th>${tt('gps_analysis.ar_col_date','Date')}</th><th>${tt('gps_analysis.ar_col_type','Type')}</th><th>${tt('gps_analysis.ar_col_rival','Rival')}</th><th>${tt('gps_analysis.ar_col_ha','H/A')}</th><th>${tt('gps_analysis.ar_col_season','Season')}</th><th style="text-align:right">${tt('gps_analysis.ar_col_action','Action')}</th></tr></thead>
        <tbody>${assignedRows.map(r => `
          <tr data-sid="${r.id}" data-date="${r.date}" data-out="${_out(r)?'1':'0'}" data-search="${_gpEsc((r.date + ' ' + (r.type || '') + ' ' + (r.rival || '')).toLowerCase())}">
            <td><input type="checkbox" class="ar-check" data-sid="${r.id}" style="cursor:pointer"></td>
            <td style="font:600 12px/1 var(--cm-font-mono)">${r.date}</td>
            <td style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${_gpEsc(r.type || '—')}</td>
            <td style="font:600 11.5px/1 var(--cm-font-sans)">${_gpEsc(r.rival || '—')}</td>
            <td style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${_haLabel(r.ha)}</td>
            <td>${_seasonCell(r)}</td>
            <td style="text-align:right"><button class="cm-btn is-outline is-sm ar-remove" data-sid="${r.id}" data-rival="${_gpEsc(r.rival || '')}"><i class="ti ti-x" style="font-size:14px"></i>${tt('gps_analysis.ar_remove_rival','Remove rival')}</button></td>
          </tr>`).join('')}</tbody>
        </table>` : ''}
      <div id="arNoMatch" style="display:none;padding:18px;text-align:center;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${tt('gps_analysis.ar_no_days_match','No days match.')}</div></div>`;
    body.querySelectorAll('.ar-assign').forEach(btn =>
      btn.addEventListener('click', () => _gpAssignMatchForm(clubId, teamId, btn.dataset.sid, btn.dataset.date, btn.dataset.season || null)));
    body.querySelectorAll('.ar-remove').forEach(btn =>
      btn.addEventListener('click', () => _gpRemoveRivalFromDay(clubId, btn.dataset.sid, btn.dataset.rival)));
    body.querySelectorAll('.ar-season').forEach(btn =>
      btn.addEventListener('click', () => _gpSeasonPicker(btn, clubId, teamId, btn.dataset.sid, btn.dataset.season || null, btn.dataset.date || null)));
    const arSearch = body.querySelector('#arSearch');
    const arOut    = body.querySelector('#arOutToggle');
    const arRows   = [...body.querySelectorAll('tbody tr')];
    const arEmpty  = body.querySelector('#arNoMatch');
    // ── Bulk season selection: checkboxes + a header "select all shown" that respects the
    //    active search / outside-season filter, so you can season-tag hundreds of days at once.
    const arChecks   = [...body.querySelectorAll('.ar-check')];
    const arSelAll   = body.querySelector('#arSelAll');
    const arSelCount = body.querySelector('#arSelCount');
    const arBulkBtn  = body.querySelector('#arBulkSeason');
    const _visible   = c => c.closest('tr').style.display !== 'none';
    const _selected  = () => arChecks.filter(c => c.checked && _visible(c)).map(c => c.dataset.sid);
    const syncSel = () => {
      const sel = _selected();
      arSelCount.textContent = tt('gps_analysis.ar_selected', `${sel.length} selected`, { n: sel.length });
      arBulkBtn.disabled = sel.length === 0;
      const vis = arChecks.filter(_visible);
      arSelAll.checked = vis.length > 0 && vis.every(c => c.checked);
      arSelAll.indeterminate = !arSelAll.checked && vis.some(c => c.checked);
    };
    arChecks.forEach(c => c.addEventListener('change', syncSel));
    arSelAll.addEventListener('change', () => {
      arChecks.filter(_visible).forEach(c => { c.checked = arSelAll.checked; });
      syncSel();
    });
    arBulkBtn.addEventListener('click', () => {
      const sids = _selected();
      if (!sids.length) return;
      const seed = sids.map(id => body.querySelector(`tr[data-sid="${id}"]`)?.dataset.date).filter(Boolean).sort()[0] || null;
      _gpBulkSeasonPicker(arBulkBtn, clubId, teamId, sids, seed);
    });
    const applyFilter = () => {
      const q = arSearch.value.trim().toLowerCase();
      const onlyOut = arOut.dataset.on === '1';
      let shown = 0;
      arRows.forEach(tr => {
        const hit = (!q || tr.dataset.search.includes(q)) && (!onlyOut || tr.dataset.out === '1');
        tr.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      arEmpty.style.display = shown ? 'none' : '';
      syncSel();   // hidden rows drop out of the selection count / select-all state
    };
    arSearch.addEventListener('input', applyFilter);
    arOut.addEventListener('click', () => {
      const on = arOut.dataset.on === '1' ? '0' : '1';
      arOut.dataset.on = on;
      arOut.classList.toggle('is-filled', on === '1');
      arOut.classList.toggle('is-outline', on === '0');
      applyFilter();
    });
    applyFilter();
  } catch (e) {
    body.innerHTML = `<div style="padding:24px;color:var(--cm-danger)">${e.message}</div>`;
  }
}

// Minimal HTML escape for user-controlled text/attrs (no global esc in this file).
function _gpEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── Seasons (assign a GPS day to a season entity) ─────────────────────────────
// Seasons scoped to the club, team-or-null (mirrors how session ids are scoped in the
// resolver). Cached on window for the open modal. Newest first.
async function _gpLoadSeasons(clubId, teamId) {
  const { data } = await window.sb.from('seasons')
    .select('id, name, team_id, start_date, end_date, status')
    .eq('club_id', clubId)
    .order('start_date', { ascending: false });
  const all = data || [];
  const scoped = all.filter(s => !teamId || s.team_id == null || String(s.team_id) === String(teamId));
  window.__gpSeasons = scoped.length ? scoped : all;
  return window.__gpSeasons;
}
function _gpSeasonById(id) { return (window.__gpSeasons || []).find(s => String(s.id) === String(id)) || null; }
// Does a date fall inside ANY known season range? Drives the "outside season" flag that
// surfaces sync-imported days that no season recognises.
function _gpDateInAnySeason(date) {
  if (!date) return false;
  return (window.__gpSeasons || []).some(s => String(s.start_date) <= date && date <= String(s.end_date));
}

// Per-row season picker (popover): pick an existing season, clear it, or create a new one.
function _gpSeasonPicker(anchor, clubId, teamId, sessionId, currentSeasonId, date) {
  const seasons = window.__gpSeasons || [];
  const items = [
    ...(currentSeasonId ? [{ label: '✕ ' + tt('gps_analysis.ar_clear_season','Clear season'), _clear: true }] : []),
    ...seasons.map(s => ({ label: (String(s.id) === String(currentSeasonId) ? '✓ ' : '') + `${s.name} (${s.start_date} → ${s.end_date})`, seasonId: s.id })),
    { label: '＋ ' + tt('gps_analysis.ar_new_season','New season…'), _new: true },
  ];
  makePopover(anchor, items, item => {
    if (item._new) return _gpNewSeasonForm(clubId, teamId, s => _gpAssignSeasonToDay(clubId, sessionId, s.id), date);
    _gpAssignSeasonToDay(clubId, sessionId, item._clear ? null : item.seasonId);
  });
}

// Create a season inline (name + start + end) → seasons row → onCreated(season). Same
// insert shape as the Annual Planner so a season created here is a first-class season.
function _gpNewSeasonForm(clubId, teamId, onCreated, seedDate) {
  const _lbl = 'font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)';
  const _inp = 'margin-top:6px;width:100%;padding:8px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-surface-2);color:var(--cm-fg);font:500 13px/1.4 var(--cm-font-sans);box-sizing:border-box';
  // Prefill a sensible football-season window (Jul→Jun) around the day being bucketed. Native
  // <input type="date"> reads back '' when a segment (often the year) is left incomplete, so a
  // hand-typed date can silently fail validation — prefilling means the fields are never blank
  // and the user just adjusts. Defaults come from the day's date, else today.
  const _sd = (seedDate && /^\d{4}-\d{2}-\d{2}$/.test(seedDate)) ? seedDate
            : (window.cmToday ? window.cmToday() : (new Date().getFullYear() + '-01-01'));
  const _y = +_sd.slice(0, 4), _m = +_sd.slice(5, 7);
  const _sy = _m >= 7 ? _y : _y - 1;                       // season anchored to ~July
  const _defStart = `${_sy}-07-01`, _defEnd = `${_sy + 1}-06-30`;
  const _defName = `${_sy}/${String((_sy + 1) % 100).padStart(2, '0')}`;
  const ov = makeModal(tt('gps_analysis.ar_new_season_title','New season'), `
    <div style="min-width:360px;display:flex;flex-direction:column;gap:12px">
      <label style="${_lbl}">${tt('gps_analysis.ar_season_name','Season name')}
        <input id="arSeasonName" type="text" value="${_defName}" placeholder="${tt('gps_analysis.ar_season_name_ph','e.g. 2024/25')}" style="${_inp}"></label>
      <div style="display:flex;gap:10px">
        <label style="${_lbl};flex:1">${tt('gps_analysis.ar_start_date','Start date')}
          <input id="arSeasonStart" type="date" value="${_defStart}" style="${_inp}"></label>
        <label style="${_lbl};flex:1">${tt('gps_analysis.ar_end_date','End date')}
          <input id="arSeasonEnd" type="date" value="${_defEnd}" style="${_inp}"></label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="arSeasonCancel" class="cm-btn is-outline is-sm">${tt('gps_analysis.ar_cancel','Cancel')}</button>
        <button id="arSeasonSave" class="cm-btn is-filled is-sm">${tt('gps_analysis.ar_create_assign','Create & assign')}</button>
      </div>
    </div>`);
  ov.querySelector('#arSeasonCancel').onclick = () => ov.remove();
  ov.querySelector('#arSeasonSave').onclick = async () => {
    const name  = ov.querySelector('#arSeasonName').value.trim();
    const start = ov.querySelector('#arSeasonStart').value;
    const end   = ov.querySelector('#arSeasonEnd').value;
    // Report the SPECIFIC missing field(s): a native <input type="date"> reads back '' when the
    // typed value never validated (locale format mismatch), so "everything's filled" can still fail.
    const missing = [];
    if (!name)  missing.push(tt('gps_analysis.ar_season_name','Season name'));
    if (!start) missing.push(tt('gps_analysis.ar_start_date','Start date'));
    if (!end)   missing.push(tt('gps_analysis.ar_end_date','End date'));
    if (missing.length) { showToast(`${tt('gps_analysis.ar_season_fields','Name, start and end are required')} — ${missing.join(', ')}`, true); return; }
    if (start > end) { showToast(tt('gps_analysis.ar_season_order','Start date must be before end date'), true); return; }
    const btn = ov.querySelector('#arSeasonSave'); btn.disabled = true;
    try {
      const { data, error } = await window.sb.from('seasons').insert({
        club_id: clubId, team_id: teamId || null, name, start_date: start, end_date: end,
        status: 'active', planning_model: 'tactical'
      }).select('id, name, team_id, start_date, end_date, status').single();
      if (error) throw error;
      window.__gpSeasons = [data, ...(window.__gpSeasons || [])];
      ov.remove();
      onCreated?.(data);
    } catch (e) { showToast(`${tt('gps_analysis.ar_season_failed','Season action failed')}: ${e.message}`, true); btn.disabled = false; }
  };
}

// Persist a season_id on the day's session (no type change — a training stays a training).
async function _gpAssignSeasonToDay(clubId, sessionId, seasonId) {
  try {
    const { error } = await window.sb.from('training_sessions')
      .update({ season_id: seasonId || null }).eq('id', sessionId).eq('club_id', clubId);
    if (error) throw error;
    showToast(seasonId ? tt('gps_analysis.ar_season_set','Season assigned') : tt('gps_analysis.ar_season_cleared','Season cleared'));
    try { window.cmInvalidateGpsCache?.(); window.invalidateBaselineCache?.(); } catch {}
    try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
    try { await window.refreshDashboard?.(); } catch {}
    document.querySelector('.gp-modal-overlay')?.remove();
    _gpOpenAssignRivals();
  } catch (e) { showToast(`${tt('gps_analysis.ar_season_failed','Season assign failed')}: ${e.message}`, true); }
}

// ── Clean up empty sessions ───────────────────────────────────────────────────
// Imported/historical sessions that carry NO GPS data (no gps_reports, or every report's
// total_distance is 0/null) are dead weight. Here the user reviews and deletes them.
// Deleting a training_sessions row CASCADES gps_reports/metrics/period_reports (safe) but
// ALSO rpe + session_exercises + video_sessions — so we protect any session that has RPE
// (locked, not deletable) and exclude sessions carrying a rival (intentional match markers).
async function _gpOpenEmptySessions() {
  const clubId = window._gpClubId || (await window.getClubId?.());
  if (!clubId) { showToast('No club selected', true); return; }
  const ov = makeModal(tt('gps_analysis.es_title','Clean up empty sessions'), '<div id="esBody" style="min-width:600px;max-width:760px"><div style="padding:24px;color:var(--cm-fg-muted)">Loading…</div></div>');
  const body = ov.querySelector('#esBody');
  try {
    const today = window.cmToday ? window.cmToday() : new Date().toISOString().slice(0, 10);
    const [sessions, reps, rpes] = await Promise.all([
      window.cmFetchAll(() => {
        let q = window.sb.from('training_sessions')
          .select('id, session_date, session_type, is_historical, external_activity_id, title, session_attributes')
          .eq('club_id', clubId);
        const tId = window._gpTeamId; if (tId) q = q.or(`team_id.eq.${tId},team_id.is.null`);
        return q;
      }, { label: 'empty-sessions.sessions' }),
      window.cmFetchAll(() => _scopeTeam(window.sb.from('gps_reports').select('session_id, total_distance').eq('club_id', clubId)), { label: 'empty-sessions.reports' }),
      window.cmFetchAll(() => window.sb.from('rpe').select('session_id').eq('club_id', clubId), { label: 'empty-sessions.rpe' }),
    ]);
    const repCount = new Map(), anyData = new Set();
    (reps || []).forEach(r => {
      if (!r.session_id) return;
      repCount.set(r.session_id, (repCount.get(r.session_id) || 0) + 1);
      if (r.total_distance != null && Number(r.total_distance) > 0) anyData.add(r.session_id);
    });
    const hasRpe = new Set((rpes || []).map(r => r.session_id).filter(Boolean));
    const _imported = s => !!s.external_activity_id || s.is_historical === true;
    const _rival = s => s.session_attributes?.rival || s.session_attributes?.opponent;
    const cand = (sessions || [])
      .filter(s => _imported(s) && !anyData.has(s.id) && !_rival(s) && String(s.session_date) <= today)
      .map(s => ({ id: s.id, date: s.session_date, type: s.session_type, title: s.title || '',
                   reports: repCount.get(s.id) || 0, rpe: hasRpe.has(s.id) }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    console.info(`[EmptySessions] club sessions=${sessions?.length || 0} · candidates=${cand.length} · rpe-locked=${cand.filter(c => c.rpe).length}`);
    if (!cand.length) { body.innerHTML = `<div style="padding:24px;color:var(--cm-fg-muted)">${tt('gps_analysis.es_none','No empty imported sessions found.')}</div>`; return; }
    const _dataCell = c => c.reports ? tt('gps_analysis.es_all_zero', `${c.reports} · all 0`, { n: c.reports }) : tt('gps_analysis.es_no_records', 'No records');
    body.innerHTML = `
      <p style="font:500 11.5px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 12px">${tt('gps_analysis.es_intro','Imported/historical sessions with no GPS data (no records, or all values 0). Deleting removes the session and any empty GPS rows — it cannot be undone. Sessions that carry an RPE score are locked to protect that data.')}</p>
      <div style="display:flex;gap:8px;margin:0 0 10px">
        <input id="esSearch" type="text" placeholder="${tt('gps_analysis.ar_search','Search date…')}" style="flex:1;padding:8px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-surface-2);color:var(--cm-fg);font:500 12px/1.4 var(--cm-font-mono);box-sizing:border-box">
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin:0 0 10px;padding:7px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg-soft)">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg)"><input type="checkbox" id="esSelAll" style="cursor:pointer">${tt('gps_analysis.ar_select_all_shown','Select all shown')}</label>
        <span id="esSelCount" style="font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${tt('gps_analysis.ar_selected','0 selected',{n:0})}</span>
        <button id="esDelBtn" class="cm-btn is-sm" disabled style="margin-left:auto;background:var(--cm-danger);color:#fff;border-color:var(--cm-danger)"><i class="ti ti-trash" style="font-size:14px"></i>${tt('gps_analysis.es_delete_selected','Delete selected')}</button>
      </div>
      <div style="max-height:48vh;overflow:auto">
        <table class="gp-map-table" style="width:100%">
        <thead><tr><th style="width:26px"></th><th>${tt('gps_analysis.ar_col_date','Date')}</th><th>${tt('gps_analysis.ar_col_type','Type')}</th><th>${tt('gps_analysis.es_col_title','Title')}</th><th>${tt('gps_analysis.es_col_data','Data')}</th></tr></thead>
        <tbody>${cand.map(c => `
          <tr data-sid="${c.id}" data-search="${_gpEsc((c.date + ' ' + (c.type || '') + ' ' + (c.title || '')).toLowerCase())}">
            <td>${c.rpe ? `<span title="${tt('gps_analysis.es_locked_rpe','Has RPE — kept')}" style="color:var(--cm-fg-muted)"><i class="ti ti-lock" style="font-size:14px"></i></span>` : `<input type="checkbox" class="es-check" data-sid="${c.id}" style="cursor:pointer">`}</td>
            <td style="font:600 12px/1 var(--cm-font-mono)">${c.date}</td>
            <td style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${_gpEsc(c.type || '—')}</td>
            <td style="font:500 11.5px/1 var(--cm-font-sans)">${_gpEsc(c.title || '—')}</td>
            <td style="font:500 11px/1 var(--cm-font-sans);color:${c.reports ? 'var(--cm-warn,#d97706)' : 'var(--cm-fg-muted)'}">${_dataCell(c)}${c.rpe ? ` · <span style="color:var(--cm-fg-muted)">${tt('gps_analysis.es_locked_rpe','Has RPE — kept')}</span>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table>
        <div id="esNoMatch" style="display:none;padding:18px;text-align:center;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${tt('gps_analysis.ar_no_days_match','No days match.')}</div>
      </div>`;
    const esSearch = body.querySelector('#esSearch');
    const esRows   = [...body.querySelectorAll('tbody tr')];
    const esEmpty  = body.querySelector('#esNoMatch');
    const esChecks = [...body.querySelectorAll('.es-check')];
    const esSelAll = body.querySelector('#esSelAll');
    const esCount  = body.querySelector('#esSelCount');
    const esDel    = body.querySelector('#esDelBtn');
    const _vis = c => c.closest('tr').style.display !== 'none';
    const _sel = () => esChecks.filter(c => c.checked && _vis(c)).map(c => c.dataset.sid);
    const syncSel = () => {
      const sel = _sel();
      esCount.textContent = tt('gps_analysis.ar_selected', `${sel.length} selected`, { n: sel.length });
      esDel.disabled = sel.length === 0;
      const vis = esChecks.filter(_vis);
      esSelAll.checked = vis.length > 0 && vis.every(c => c.checked);
      esSelAll.indeterminate = !esSelAll.checked && vis.some(c => c.checked);
    };
    esChecks.forEach(c => c.addEventListener('change', syncSel));
    esSelAll.addEventListener('change', () => { esChecks.filter(_vis).forEach(c => { c.checked = esSelAll.checked; }); syncSel(); });
    esSearch.addEventListener('input', () => {
      const q = esSearch.value.trim().toLowerCase();
      let shown = 0;
      esRows.forEach(tr => { const hit = !q || tr.dataset.search.includes(q); tr.style.display = hit ? '' : 'none'; if (hit) shown++; });
      esEmpty.style.display = shown ? 'none' : '';
      syncSel();
    });
    esDel.addEventListener('click', () => _gpConfirmDeleteSessions(clubId, _sel()));
  } catch (e) {
    body.innerHTML = `<div style="padding:24px;color:var(--cm-danger)">${e.message}</div>`;
  }
}

// Confirm + delete (chunked). Cascades handle GPS rows; sessions with RPE were never offered.
function _gpConfirmDeleteSessions(clubId, ids) {
  if (!ids || !ids.length) return;
  const ov = makeModal(tt('gps_analysis.es_confirm_title','Delete sessions'), `
    <div style="min-width:380px;max-width:460px;display:flex;flex-direction:column;gap:14px">
      <p style="font:400 12.5px/1.6 var(--cm-font-sans);color:var(--cm-fg);margin:0">${tt('gps_analysis.es_confirm_body', `Delete ${ids.length} session(s) permanently? This removes the sessions and any linked GPS rows. This cannot be undone.`, { n: ids.length })}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="esCancel" class="cm-btn is-outline is-sm">${tt('gps_analysis.ar_cancel','Cancel')}</button>
        <button id="esConfirm" class="cm-btn is-sm" style="background:var(--cm-danger);color:#fff;border-color:var(--cm-danger)">${tt('gps_analysis.es_delete_selected','Delete selected')}</button>
      </div>
    </div>`);
  ov.querySelector('#esCancel').onclick = () => ov.remove();
  ov.querySelector('#esConfirm').onclick = async () => {
    const btn = ov.querySelector('#esConfirm'); btn.disabled = true;
    try {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await window.sb.from('training_sessions').delete().eq('club_id', clubId).in('id', chunk);
        if (error) throw error;
      }
      showToast(tt('gps_analysis.es_deleted', `${ids.length} sessions deleted`, { n: ids.length }));
      try { window.cmInvalidateGpsCache?.(); window.invalidateMatchDatesCache?.(clubId); window.invalidateBaselineCache?.(); } catch {}
      try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
      try { await window.refreshDashboard?.(); } catch {}
      ov.remove();
      document.querySelector('.gp-modal-overlay')?.remove();
      _gpOpenEmptySessions();
    } catch (e) { showToast(`${tt('gps_analysis.es_delete_failed','Delete failed')}: ${e.message}`, true); btn.disabled = false; }
  };
}

// Bulk season picker: same list as the per-row one, but assigns to MANY sessions at once.
// seedDate primes a New season with a sensible window (earliest selected day).
function _gpBulkSeasonPicker(anchor, clubId, teamId, sids, seedDate) {
  if (!sids || !sids.length) { showToast(tt('gps_analysis.ar_pick_rows','Pick at least one day'), true); return; }
  const seasons = window.__gpSeasons || [];
  const items = [
    { label: '✕ ' + tt('gps_analysis.ar_clear_season','Clear season'), _clear: true },
    ...seasons.map(s => ({ label: `${s.name} (${s.start_date} → ${s.end_date})`, seasonId: s.id })),
    { label: '＋ ' + tt('gps_analysis.ar_new_season','New season…'), _new: true },
  ];
  makePopover(anchor, items, item => {
    if (item._new) return _gpNewSeasonForm(clubId, teamId, s => _gpBulkAssignSeason(clubId, sids, s.id), seedDate);
    _gpBulkAssignSeason(clubId, sids, item._clear ? null : item.seasonId);
  });
}

// One season_id write over many sessions (chunked so the id list never blows the URL/param cap).
async function _gpBulkAssignSeason(clubId, sids, seasonId) {
  try {
    for (let i = 0; i < sids.length; i += 200) {
      const chunk = sids.slice(i, i + 200);
      const { error } = await window.sb.from('training_sessions')
        .update({ season_id: seasonId || null }).eq('club_id', clubId).in('id', chunk);
      if (error) throw error;
    }
    showToast(seasonId
      ? tt('gps_analysis.ar_season_set_n', `Season assigned to ${sids.length} days`, { n: sids.length })
      : tt('gps_analysis.ar_season_cleared_n', `Season cleared on ${sids.length} days`, { n: sids.length }));
    try { window.cmInvalidateGpsCache?.(); window.invalidateBaselineCache?.(); } catch {}
    try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
    try { await window.refreshDashboard?.(); } catch {}
    document.querySelector('.gp-modal-overlay')?.remove();
    _gpOpenAssignRivals();
  } catch (e) { showToast(`${tt('gps_analysis.ar_season_failed','Season assign failed')}: ${e.message}`, true); }
}

// ── Assign a match to a day: rival (existing/new + crest) + Home/Away + Season, one modal.
function _gpAssignMatchForm(clubId, teamId, sessionId, date, currentSeasonId) {
  const opps = window.__gpOpponents || [];
  const seasons = window.__gpSeasons || [];
  const _lbl = 'font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)';
  const _inp = 'margin-top:6px;width:100%;padding:8px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-surface-2);color:var(--cm-fg);font:500 13px/1.4 var(--cm-font-sans);box-sizing:border-box';
  const haBtn = (v, lbl, on) => `<button type="button" class="cm-btn ${on?'is-filled':'is-outline'} is-sm ar-ha" data-ha="${v}" style="flex:1;justify-content:center">${lbl}</button>`;
  const ov = makeModal(tt('gps_analysis.ar_assign_match','Assign match'), `
    <div style="min-width:400px;max-width:460px;display:flex;flex-direction:column;gap:14px">
      <div style="font:600 12px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${_gpEsc(date || '')}</div>
      <label style="${_lbl}">${tt('gps_analysis.ar_rival','Rival')}
        <select id="arRivalSel" style="${_inp}">
          ${opps.map(o => `<option value="${o.id}" data-name="${_gpEsc(o.opponent_name)}" data-crest="${_gpEsc(o.crest_url||'')}">${_gpEsc(o.opponent_name)}</option>`).join('')}
          <option value="__new__">${tt('gps_analysis.ar_new_rival','＋ New rival…')}</option>
        </select></label>
      <div id="arNewWrap" style="display:none;flex-direction:column;gap:10px">
        <label style="${_lbl}">${tt('gps_analysis.ar_rival_name','Rival name')}
          <input id="arName" type="text" placeholder="${tt('gps_analysis.ar_rival_name_ph','e.g. Polvorín FC')}" style="${_inp}"></label>
        <div style="${_lbl}">${tt('gps_analysis.ar_crest_optional','Crest (optional)')}</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div id="arCrestPrev" style="width:48px;height:48px;flex-shrink:0;border:1px dashed var(--cm-border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--cm-surface-2);color:var(--cm-fg-muted);overflow:hidden"><i class="ti ti-shield" style="font-size:18px"></i></div>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1">
            <label class="cm-btn is-outline is-sm" style="cursor:pointer;align-self:flex-start">
              <i class="ti ti-upload" style="font-size:14px"></i><span id="arUpLbl">${tt('gps_analysis.ar_upload','Upload from computer')}</span>
              <input id="arFile" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none">
            </label>
            <input id="arCrest" type="text" placeholder="${tt('gps_analysis.ar_crest_url','…or paste a crest URL')}" style="width:100%;padding:7px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-surface-2);color:var(--cm-fg);font:500 12px/1.4 var(--cm-font-mono);box-sizing:border-box">
          </div>
        </div>
      </div>
      <div>
        <div style="${_lbl};margin-bottom:6px">${tt('gps_analysis.ar_home_away','Home / Away')}</div>
        <div style="display:flex;gap:6px">${haBtn('home', tt('gps_analysis.ar_home','Home'), true)}${haBtn('away', tt('gps_analysis.ar_away','Away'), false)}${haBtn('neutral', tt('gps_analysis.ar_neutral','Neutral'), false)}</div>
      </div>
      <label style="${_lbl}">${tt('gps_analysis.ar_season','Season')}
        <select id="arSeasonSel" style="${_inp}">
          <option value="">${tt('gps_analysis.ar_no_season_opt','— No season —')}</option>
          ${seasons.map(s => `<option value="${s.id}" ${String(s.id)===String(currentSeasonId)?'selected':''}>${_gpEsc(s.name)} (${s.start_date} → ${s.end_date})</option>`).join('')}
          <option value="__new__">${tt('gps_analysis.ar_new_season','＋ New season…')}</option>
        </select></label>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="arCancel" class="cm-btn is-outline is-sm">${tt('gps_analysis.ar_cancel','Cancel')}</button>
        <button id="arSave" class="cm-btn is-filled is-sm">${tt('gps_analysis.ar_save_assign','Save & assign')}</button>
      </div>
    </div>`);
  let ha = 'home';
  let seasonPrev = String(currentSeasonId || '');
  const rivalSel = ov.querySelector('#arRivalSel');
  const newWrap  = ov.querySelector('#arNewWrap');
  const seasonSel= ov.querySelector('#arSeasonSel');
  const prev     = ov.querySelector('#arCrestPrev');
  const crestIn  = ov.querySelector('#arCrest');
  const fileIn   = ov.querySelector('#arFile');
  const upLbl    = ov.querySelector('#arUpLbl');
  const saveBtn  = ov.querySelector('#arSave');
  if (!opps.length) rivalSel.value = '__new__';
  const syncNew = () => { newWrap.style.display = rivalSel.value === '__new__' ? 'flex' : 'none'; };
  syncNew();
  rivalSel.addEventListener('change', syncNew);
  ov.querySelectorAll('.ar-ha').forEach(b => b.addEventListener('click', () => {
    ha = b.dataset.ha;
    ov.querySelectorAll('.ar-ha').forEach(x => { const on = x.dataset.ha === ha; x.classList.toggle('is-filled', on); x.classList.toggle('is-outline', !on); });
  }));
  seasonSel.addEventListener('change', () => {
    if (seasonSel.value === '__new__') {
      _gpNewSeasonForm(clubId, teamId, s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = `${s.name} (${s.start_date} → ${s.end_date})`;
        seasonSel.insertBefore(opt, seasonSel.lastElementChild);
        seasonSel.value = s.id; seasonPrev = s.id;
      }, date);
      seasonSel.value = seasonPrev;   // revert until the new season actually lands
    } else { seasonPrev = seasonSel.value; }
  });
  const showPrev = url => { prev.innerHTML = url ? `<img src="${_gpEsc(url)}" style="width:100%;height:100%;object-fit:contain">` : '<i class="ti ti-shield" style="font-size:18px"></i>'; };
  crestIn.addEventListener('input', () => showPrev(crestIn.value.trim()));
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files?.[0];
    if (!file) return;
    showPrev(URL.createObjectURL(file));
    upLbl.textContent = tt('gps_analysis.ar_uploading','Uploading…'); saveBtn.disabled = true;
    try {
      const opName = ov.querySelector('#arName').value.trim() || 'rival';
      const slug   = window.slugifyOpponent ? window.slugifyOpponent(opName) : 'rival';
      const small  = await window.cmShrinkImage(file, { maxDim: 256, maxBytes: 60 * 1024 });
      const ext    = (small.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path   = `opponent-crests/${clubId}/${slug}.${ext}`;
      const { error } = await window.sb.storage.from('club-assets').upload(path, small, { upsert: true, contentType: small.type, cacheControl: window.CM_CACHE_IMMUTABLE });
      if (error) throw error;
      // Canonical path → same URL on re-upload; version it so the new crest wins the cache.
      const { data: { publicUrl: _rawUrl } } = window.sb.storage.from('club-assets').getPublicUrl(path);
      const publicUrl = _rawUrl + '?v=' + Date.now();
      crestIn.value = publicUrl; showPrev(publicUrl);
      upLbl.textContent = tt('gps_analysis.ar_replace_crest','Replace crest');
    } catch (e) {
      showToast(`${tt('gps_analysis.ar_upload_failed','Upload failed')}: ${e.message}`, true);
      upLbl.textContent = tt('gps_analysis.ar_upload','Upload from computer');
    } finally { saveBtn.disabled = false; }
  });
  ov.querySelector('#arCancel').onclick = () => ov.remove();
  saveBtn.onclick = async () => {
    let name, crest = null, oppId = null;
    if (rivalSel.value === '__new__') {
      name  = ov.querySelector('#arName').value.trim();
      crest = crestIn.value.trim() || null;
      if (!name) { showToast(tt('gps_analysis.ar_enter_rival','Enter a rival name'), true); return; }
    } else {
      const opt = rivalSel.selectedOptions[0];
      name  = opt?.dataset.name || opt?.textContent || '';
      crest = opt?.dataset.crest || null;
      oppId = rivalSel.value || null;
      if (!name) { showToast(tt('gps_analysis.ar_pick_rival','Pick a rival'), true); return; }
    }
    const seasonId = (seasonSel.value && seasonSel.value !== '__new__') ? seasonSel.value : null;
    ov.remove();
    await _gpAssignRivalToDay(clubId, teamId, sessionId, date, name, crest, oppId, ha, seasonId);
  };
}

// Persist: reuse opponent_branding (insert if new), then tag the day's session
// (idempotent) or create a historical container if the day has no session.
async function _gpAssignRivalToDay(clubId, teamId, sessionId, date, rivalName, crestUrl, knownOppId, homeAway, seasonId) {
  try {
    // home_away lives in session_attributes (like `rival`); only for matches. season_id is a
    // real column so the season-range filter can pull the day in even off its date window.
    const ha = (homeAway === 'home' || homeAway === 'away' || homeAway === 'neutral') ? homeAway : null;
    const sid = seasonId || null;
    // 1. opponent_branding (club catalog) — reuse by (club, name); insert if missing, fill
    //    crest if given. We CAPTURE its id so the day references the entity, not just text:
    //    that's what makes the same rival comparable across seasons/sources.
    let oppId = knownOppId || null;
    const { data: existsOpp } = await window.sb.from('opponent_branding')
      .select('id, crest_url').eq('club_id', clubId).ilike('opponent_name', rivalName).maybeSingle();
    if (!existsOpp) {
      const { data: ins } = await window.sb.from('opponent_branding')
        .insert({ club_id: clubId, opponent_name: rivalName, crest_url: crestUrl || null })
        .select('id').maybeSingle();
      oppId = ins?.id || oppId;
    } else {
      oppId = existsOpp.id;
      if (crestUrl && !existsOpp.crest_url) {
        await window.sb.from('opponent_branding').update({ crest_url: crestUrl }).eq('id', existsOpp.id).catch(() => {});
      }
    }
    const finalCrest = crestUrl || existsOpp?.crest_url || null;
    // session_attributes carries BOTH: rival (text, back-compat) + opponent_id (the real relation).
    const rivalAttrs = { rival: rivalName, ...(oppId ? { opponent_id: oppId } : {}), ...(finalCrest ? { rival_crest_url: finalCrest } : {}), ...(ha ? { home_away: ha } : {}) };

    if (sessionId) {
      // 2a. Existing session → merge rival AND mark the day as a MATCH. A day with a rival
      //     IS a match; without session_type='match' the vs-Match baseline (getMatchBaseline
      //     filters session_type='match') never sees it → 0 matches. We remember the prior
      //     type in _rivalPrevType so Remove can revert it. is_historical is left untouched.
      const { data: s } = await window.sb.from('training_sessions').select('session_type, session_attributes').eq('id', sessionId).maybeSingle();
      const prevType = s?.session_type || 'training';
      const attrs = { ...(s?.session_attributes || {}), ...rivalAttrs };
      if (prevType !== 'match' && attrs._rivalPrevType == null) attrs._rivalPrevType = prevType;
      const upd = { session_attributes: attrs, session_type: 'match' };
      if (sid) upd.season_id = sid;   // only overwrite season when one was chosen — never clear it here
      const { error } = await window.sb.from('training_sessions')
        .update(upd).eq('id', sessionId);
      if (error) throw error;
    } else if (date) {
      // 2b. No session for this day → create a HISTORICAL match container (invisible in
      //     Calendar/Planner) and link the day's reports. (Reports without a session have
      //     no date, so this path only fires when a caller passes a concrete date.)
      const { data: created, error } = await window.sb.from('training_sessions')
        .insert({ club_id: clubId, ...(teamId ? { team_id: teamId } : {}), session_date: date,
                  session_type: 'match', is_historical: true, title: `Match vs ${rivalName}`,
                  ...(sid ? { season_id: sid } : {}), session_attributes: rivalAttrs })
        .select('id').maybeSingle();
      if (error) throw error;
      // (linking null-session reports to `created.id` would require a date on those rows)
    }
    showToast(`Rival → ${rivalName}`);
    // The day is now a match → the vs-Match baseline (match-days cache) must refresh.
    try { window.invalidateMatchDatesCache?.(clubId); window.invalidateBaselineCache?.(); } catch {}
    try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
    try { await window.refreshDashboard?.(); } catch {}
    document.querySelector('.gp-modal-overlay')?.remove();
    _gpOpenAssignRivals();   // reopen with the row gone
  } catch (e) {
    showToast(`Assign failed: ${e.message}`, true);
  }
}

// Undo a rival on a GPS day WITHOUT losing real data. Two cases, decided fresh at click:
//  · Case B — the day exists ONLY as a rival container we created (is_historical 'match'
//    with NO gps_reports of its own) → delete the empty container session.
//  · Case A — a real session that pre-existed → strip only the rival keys from
//    session_attributes, leaving the session + its GPS intact.
// Safety: a session with ANY linked gps_reports is NEVER deleted — we strip instead.
// opponent_branding is left untouched (the catalog rival is reused by other days/seasons).
function _gpRemoveRivalFromDay(clubId, sessionId, rivalName) {
  if (!sessionId) return;
  const ov = makeModal('Remove rival', `
    <div style="min-width:360px;max-width:430px;display:flex;flex-direction:column;gap:14px">
      <p style="font:400 12.5px/1.6 var(--cm-font-sans);color:var(--cm-fg);margin:0">
        Remove <strong>${_gpEsc(rivalName || 'the rival')}</strong> from this day? GPS data is kept — only the rival link is removed. If the day is just an empty match container, it is deleted.
      </p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="rrCancel" class="cm-btn is-outline is-sm">Cancel</button>
        <button id="rrConfirm" class="cm-btn is-sm" style="background:var(--cm-danger);color:#fff;border-color:var(--cm-danger)">Remove rival</button>
      </div>
    </div>`);
  ov.querySelector('#rrCancel').onclick = () => ov.remove();
  ov.querySelector('#rrConfirm').onclick = async () => {
    const btn = ov.querySelector('#rrConfirm'); btn.disabled = true; btn.textContent = 'Removing…';
    try {
      const { data: s, error: selErr } = await window.sb.from('training_sessions')
        .select('session_type, is_historical, session_attributes').eq('id', sessionId).maybeSingle();
      if (selErr) throw selErr;
      if (!s) throw new Error('Session not found');
      // Presence check: invalid rows count too — deletion must be conservative.
      const { count: gpsCount, error: cntErr } = await window.sb.from('gps_reports')
        .select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('session_id', sessionId);
      if (cntErr) throw cntErr;
      const isContainer = s.is_historical === true && s.session_type === 'match' && !gpsCount;
      if (isContainer) {
        const { error } = await window.sb.from('training_sessions').delete().eq('id', sessionId).eq('club_id', clubId);
        if (error) throw error;
      } else {
        const attrs = { ...(s.session_attributes || {}) };
        // Revert the session_type we flipped to 'match' back to the stored original (only
        // when WE flipped it — a genuine pre-existing match has no _rivalPrevType and stays).
        const prevType = attrs._rivalPrevType;
        delete attrs.rival; delete attrs.opponent; delete attrs.opponent_id; delete attrs.rival_crest_url; delete attrs._rivalPrevType;
        const upd = { session_attributes: attrs };
        if (prevType && s.session_type === 'match') upd.session_type = prevType;
        const { error } = await window.sb.from('training_sessions').update(upd).eq('id', sessionId).eq('club_id', clubId);
        if (error) throw error;
      }
      showToast('Rival removed');
      try { window.cmInvalidateGpsCache?.(); window.invalidateMatchDatesCache?.(clubId); window.invalidateBaselineCache?.(); } catch {}
      try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
      try { await window.refreshDashboard?.(); } catch {}
      ov.remove();
      document.querySelector('.gp-modal-overlay')?.remove();   // close the Assign modal…
      _gpOpenAssignRivals();                                   // …reopen fresh (row moved/gone)
    } catch (e) {
      showToast(`Remove failed: ${e.message}`, true);
      btn.disabled = false; btn.textContent = 'Remove rival';
    }
  };
}

// ── Per-card player picker (scope.level='player') · mixed dashboards ──────────
// PRECEDENCE (mirrors the resolver, resolver.js: config.scope.playerId || ctx.playerId):
//   · card HAS scope.playerId → that player wins — the card is PINNED to it,
//     independent of the global player filter.
//   · card has NO playerId    → follows the global player filter; if none, the
//     resolver shows the first player in range. The visible chip avoids the old
//     silent "reports[0]" confusion (the user can pin a player from it).
function _gpPlayerLabelById(id) {
  if (!id) return null;
  const opt = (window.gpFilterBar?.getPlayerOptions?.() || []).find(o => o.value === id);
  return opt ? opt.label : id;
}

// Render / refresh the player chip on a player-scope card (remove it otherwise).
window._gpEnsureCardPlayerPicker = function (cardEl, config) {
  if (!cardEl) return;
  const isPlayer = config?.scope?.level === 'player';
  const existing = cardEl.querySelector(':scope .gp-card-player-pick');
  if (!isPlayer) { existing?.remove(); return; }

  const pid   = config.scope.playerId || null;
  const gIds  = window.gpFilterBar?.getState?.().playerIds || [];

  let chip = existing;
  if (!chip) {
    chip = document.createElement('span');
    chip.className = 'gp-c-pick gp-card-player-pick';
    chip.setAttribute('data-card-player-pick', '');
    const head = cardEl.querySelector(':scope > .gp-c-h');
    if (head) {
      let picks = head.querySelector('.gp-c-picks');
      if (!picks) {
        picks = document.createElement('div');
        picks.className = 'gp-c-picks';
        picks.style.cssText = 'margin-left:6px';
        (head.querySelector('.sub') || head.querySelector('.ttl'))?.after(picks);
      }
      picks.appendChild(chip);
    } else {
      chip.classList.add('gp-card-player-pick-float');   // KPI (no header) → float top-left
      cardEl.appendChild(chip);
    }
  }
  // Two unambiguous states — the chip is a PIN, never a parallel filter:
  //  · PINNED (config.scope.playerId set) → accent chip with a pin icon + name + an unpin
  //    ✕ (clears the pin so the card follows the bar again). The chevron still opens the
  //    picker to switch the pinned player.
  //  · NOT PINNED → muted "Following filter" chip (+ the global player when the bar has
  //    exactly one selected), making clear the card OBEYS the bar filter, not its own.
  chip.classList.toggle('is-accent', !!pid);
  if (pid) {
    const label = _gpPlayerLabelById(pid);
    chip.title = `Pinned to ${label} — ignores dashboard filters. ✕ to follow the bar filter`;
    chip.innerHTML = `<i class="ti ti-pin"></i>${label}`
      + `<button class="gp-c-unpin" data-card-unpin title="Unpin — follow the bar filter"><i class="ti ti-x"></i></button>`
      + `<i class="ti ti-chevron-down"></i>`;
  } else {
    const gLabel = gIds.length === 1 ? _gpPlayerLabelById(gIds[0]) : null;
    chip.title = 'Following the bar filter — click to pin this card to a player';
    chip.innerHTML = `<i class="ti ti-filter"></i>Following filter${gLabel ? ` · ${gLabel}` : ''} <i class="ti ti-chevron-down"></i>`;
  }
};

// Popover to PIN this card to a player (or "Follow the bar filter" → clear the pin).
// The bar (gpFilterBar) is the only player FILTER; this only sets an explicit per-card pin.
function _openCardPlayerPicker(anchor, cardEl) {
  const config = cardEl?.__config;
  if (!config) return;
  const cur     = config.scope?.playerId || null;
  const players = window.gpFilterBar?.getPlayerOptions?.() || [];
  const opts = [{ value: null, label: tt('gps_analysis.follow_bar_filter','Follow the bar filter') },
                ...players.map(p => ({ value: p.value, label: p.label }))];
  makePopover(anchor, opts.map(o => ({ label: (o.value === cur ? '✓ ' : '') + o.label, value: o.value })), async item => {
    config.scope = config.scope || { level: 'player' };
    if (item.value) config.scope.playerId = item.value; else delete config.scope.playerId;
    _persistCardScope(cardEl, config);
    showToast(item.value ? tt('gps_analysis.card_pinned','Card pinned → {name}',{name:item.label}) : tt('gps_analysis.card_follows_filter','Card follows the bar filter'));
  });
}

// Clear a card's player pin → it follows the bar filter again. Wired to the chip's ✕.
function _unpinCardPlayer(cardEl) {
  const config = cardEl?.__config;
  if (!config?.scope) return;
  delete config.scope.playerId;
  _persistCardScope(cardEl, config);
  showToast(tt('gps_analysis.card_follows_filter','Card follows the bar filter'));
}

// Shared: refresh the chip, persist (saved cards only) and re-resolve just this card.
function _persistCardScope(cardEl, config) {
  cardEl.__config = config;
  window._gpEnsureCardPlayerPicker(cardEl, config);
  const cardId = cardEl.dataset.cardId;
  if (cardId && window.updateDashboardCard) {       // persists for saved (uuid) cards; no-op for slugs
    window.updateDashboardCard(cardId, config, window.sb).catch(e => console.warn('card scope persist:', e));
  }
  window.GpBuilder?.resolveAndRenderCard?.(cardEl, config);   // re-resolve ONLY this card
}

function _openAcwrMetricPicker(anchor, card) {
  const cat = window._gpCatalog || [];
  const SKIP = new Set(['time_played', 'distance_per_minute', 'max_speed', 'avg_speed']);
  const opts = cat.length
    ? cat.filter(d => !SKIP.has(d.key)).map(d => ({ label: d.label, metric: d.key }))
    : [
        { label: 'Player Load',    metric: 'player_load' },
        { label: 'Total Distance', metric: 'total_distance' },
        { label: 'HSR',            metric: 'high_speed_distance' },
        { label: 'Sprint Distance',metric: 'sprint_distance' },
        { label: 'Accelerations',  metric: 'accelerations' },
      ];
  const cur = card.dataset.metricKey || 'player_load';
  makePopover(anchor, opts.map(o => ({ label: (o.metric === cur ? '✓ ' : '') + o.label, metric: o.metric })), async item => {
    const lbl = item.label.replace('✓ ', '');
    card.dataset.metricKey = item.metric;
    const chip = card.querySelector('[data-acwr-metric-pick]');
    if (chip) chip.innerHTML = `${lbl} <i class="ti ti-chevron-down"></i>`;   // refleja la elección en el chip
    try { await window.refreshDashboard?.(); } catch (e) { console.warn('acwr metric refresh:', e); }
    const view = document.querySelector('.gp-view.is-on')?.dataset.view || 'ind';
    saveLayout(view).catch(e => console.warn('saveLayout (acwr metric):', e));
    showToast('ACWR · base metric → ' + lbl);
  });
}

async function openChangeMetricModal(card) {
  const clubId  = window._gpClubId || await window.getClubId?.();
  const catalog = typeof window.getCatalog === 'function' ? await window.getCatalog(clubId) : [];
  const current = card.dataset.metricKey || 'total_distance';
  const opts = catalog
    .filter(m => m.category !== 'date')
    .map(m => `<option value="${_gpEsc(m.key)}"${m.key === current ? ' selected' : ''}>${_gpEsc(m.label)}${m.unit ? ' (' + _gpEsc(m.unit) + ')' : ''}</option>`)
    .join('');

  const ov = makeModal('Change metric',
    `<div style="padding:4px 0 12px">
      <label style="font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted);display:block;margin-bottom:8px">Select metric</label>
      <select id="_cmMetricSel" style="width:100%;padding:8px 10px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-surface-2);color:var(--cm-fg);font:500 13px/1.4 var(--cm-font-sans)">${opts}</select>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="_cmMetricCancel" class="cm-btn is-outline" style="font-size:13px">Cancel</button>
      <button id="_cmMetricApply"  class="cm-btn is-filled"  style="font-size:13px">Apply</button>
    </div>`
  );

  ov.querySelector('#_cmMetricCancel')?.addEventListener('click', () => ov.remove());
  ov.querySelector('#_cmMetricApply')?.addEventListener('click', async () => {
    const newMetric = ov.querySelector('#_cmMetricSel')?.value;
    if (!newMetric) return;
    ov.remove();
    card.dataset.metricKey = newMetric;
    // ACWR: solo la MÉTRICA BASE es configurable; el resto (bandas, cálculo
    // aguda:crónica, umbrales) queda bespoke. Re-render vía el refresh del dashboard.
    if (card.id === 'card-acwr') {
      try { await window.refreshDashboard?.(); } catch (e) { console.warn('acwr metric refresh:', e); }
      const view = document.querySelector('.gp-view.is-on')?.dataset.view || 'mgrp';
      await saveLayout(view);
      showToast('ACWR · base metric updated');
      return;
    }
    const selPlayer = (window._gpReports || []).find(r => r.player_id === window.gpState?.playerId)
                   || (window._gpReports || [])[0];
    if (selPlayer) await renderKpiCard(card, newMetric, selPlayer);
    if (typeof annotateKpiCards === 'function') await annotateKpiCards();
    const view = document.querySelector('.gp-view.is-on')?.dataset.view || 'ind';
    await saveLayout(view);
    showToast('Metric updated · saved');
  });
}

// ── Drag & drop for card grids ─────────────────────────────────
// Defensive cleanup: a canvas move (.gp-mv-active) or resize (.gp-rh-active) can be
// interrupted — the pointer stream is hijacked, capture is lost, or a handler throws
// mid-gesture — leaving a card stuck. Sweep these off ALL cards on every gesture-end
// path so nothing stays "pegado".
const _GP_STUCK = ['gp-mv-active', 'gp-rh-active', 'is-dragging', 'gpt-dragging', 'gpt-drag-over', 'is-multi-dragging'];
function _gpClearDragArtifacts() {
  // Clear the stuck edit classes AND the inline z-index lift the canvas engine sets
  // while moving/resizing (card.style.zIndex = 2000+…), so a card never stays faded
  // nor elevated above the filter bars after an interrupted drop.
  document.querySelectorAll('.' + _GP_STUCK.join(', .') + ', .gp-c[style*="z-index"]')
    .forEach(c => { c.classList.remove(..._GP_STUCK); c.style.removeProperty('z-index'); });
}
// Bound on BOTH window and document in the CAPTURE phase so a bespoke card that
// stops propagation on its own pointer handlers (e.g. the ACWR metric dropdown)
// can never swallow the cleanup. `lostpointercapture` covers a child (Chart.js
// canvas) stealing the pointer mid-drag; `pointerdown` clears any stale state at
// the START of the next interaction, so nothing can stay "pegado" through a click.
['pointerdown', 'pointerup', 'mouseup', 'dragend', 'drop', 'pointercancel', 'lostpointercapture'].forEach(evt => {
  window.addEventListener(evt, _gpClearDragArtifacts, { capture: true });
  document.addEventListener(evt, _gpClearDragArtifacts, { capture: true });
});

function initGridDragDrop(gridEl, viewKey) {
  // Card moves are 100% pointer-based (gp-canvas.js). The old native HTML5 DnD
  // reorder was removed: its 'dragstart' re-added .is-dragging (opacity:0.4) via a
  // setTimeout AFTER endMove/sweep had cleaned up — and gp-canvas preventDefaults the
  // native drag, so its 'dragend' never fired → the card stayed faded. Nothing here
  // now; cards never carry draggable="true" either.
}

document.querySelectorAll('.gp-view').forEach(view => {
  const grid = view.querySelector('.gp-grid');
  if (grid) initGridDragDrop(grid, view.dataset.view);
});

// ── 0. Settings (⚙) menu — consolidates the setup actions (data sources, GPS settings,
//       metrics catalog). Items delegate to the hidden buttons so handlers stay intact.
// ── Refresh: re-trae los datos GPS sin recargar el navegador ─────────────────────────
// Invalida el cache del resolver + recarga las opciones del filterbar (fechas/sesiones que
// hayan entrado por un sync) + re-renderiza las cards. Ícono girando mientras corre.
const gpRefreshBtn = document.getElementById('gpRefreshBtn');
gpRefreshBtn?.addEventListener('click', async () => {
  if (gpRefreshBtn.disabled) return;
  const ic = gpRefreshBtn.querySelector('i');
  gpRefreshBtn.disabled = true; if (ic) ic.style.animation = 'gp-spin 1s linear infinite';
  try {
    window.cmInvalidateGpsCache?.();
    try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
    try { await window.refreshDashboard?.(); } catch {}
    showToast(tt('gps_analysis.refreshed', 'Data refreshed'));
  } catch (e) { showToast(tt('gps_analysis.refresh_failed', 'Refresh failed'), true); }
  finally { gpRefreshBtn.disabled = false; if (ic) ic.style.animation = ''; }
});

const gpGearBtn = document.getElementById('gpGearBtn');
gpGearBtn?.addEventListener('click', e => {
  e.stopPropagation();
  if (_pop && _popAnchor === gpGearBtn) { closePop(); return; }   // toggle: second click closes
  const n  = window._gpSessionCount;
  const fc = window._gpFlaggedN || 0;   // cached — open the menu NOW; don't block on a DB count
  const oc = window._gpOutsideN || 0;   // cached "imported days without a season" count
  const pc = window._gpPendingN || 0;   // cached "GPS activities without a session" count
  Promise.resolve(_gpFlaggedCount()).catch(() => {});   // refresh the count in the background for next open
  Promise.resolve(_gpOutsideSeasonCount()).catch(() => {});
  Promise.resolve(_gpPendingCount()).catch(() => {});
  makePopover(gpGearBtn, [
    { label: tt('gps_analysis.data_sources','Data sources') + (Number.isFinite(n) ? ` · ${tt('gps_analysis.n_gps_sessions','{n} GPS sessions',{n})}` : ''), icon: 'ti-cloud-download', act: 'srcBtn' },
    { label: tt('gps_analysis.gps_settings','GPS settings'),    icon: 'ti-adjustments-horizontal', act: 'gpSettingsBtn' },
    { label: tt('gps_analysis.metrics_catalog','Metrics catalog'), icon: 'ti-list',                   act: 'gpCatalogBtn' },
    { label: tt('gps_analysis.assign_rivals','Assign rivals & seasons') + (oc ? ` · ${tt('gps_analysis.n_need_season','{n} need a season',{n:oc})}` : ''),   icon: 'ti-ball-football',          act: oc ? 'rivals_outside' : 'rivals' },
    { label: tt('gps_analysis.pending_menu','GPS days without a session') + (pc ? ` · ${tt('gps_analysis.n_pending','{n} pending',{n:pc})}` : ''), icon: 'ti-calendar-plus', act: 'pending' },
    { sep: true },
    { label: tt('gps_analysis.ctx_menu','Rehab / individual / top-up'), icon: 'ti-tag', act: 'context' },
    { label: tt('gps_analysis.pctx_menu','Tag periods (drills / top-up)'), icon: 'ti-timeline-event', act: 'pcontext' },
    { label: tt('gps_analysis.flagged_periods','Flagged periods') + (fc ? ` · ${tt('gps_analysis.n_need_review','{n} need review',{n:fc})}` : ''), icon: 'ti-flag', act: 'flagged' },
    { label: tt('gps_analysis.es_title','Clean up empty sessions'), icon: 'ti-trash', act: 'empty_sessions' },
  ], item => {
    if (item.act === 'flagged') _gpOpenFlaggedPanel();
    else if (item.act === 'pending') _gpOpenPendingPanel();
    else if (item.act === 'context') _gpOpenContextPanel();
    else if (item.act === 'pcontext') _gpOpenPeriodPanel();
    else if (item.act === 'rivals') _gpOpenAssignRivals();
    else if (item.act === 'rivals_outside') _gpOpenAssignRivals({ onlyOutside: true });
    else if (item.act === 'empty_sessions') _gpOpenEmptySessions();
    else document.getElementById(item.act)?.click();
  });
});

// ── GPS days without a session (Opción A · Etapa 3) ──────────────────────────────
// La sync ya NO crea sesiones fantasma para la temporada actual: un día con GPS pero sin
// sesión planificada queda en gps_pending_activities. Acá el usuario CREA la sesión (+ MD) →
// dispara un re-sync dirigido de ese día → la sync ADOPTA la sesión, baja los gps_reports y
// borra el pendiente solo. El team_id de la sesión creada debe coincidir con el del pendiente
// para que la sync la adopte (mismo criterio que gps-sync 2a/2b).
window._gpPendingN = window._gpPendingN || 0;
async function _gpPendingCount() {
  const clubId = window._gpClubId || await window.getClubId?.();
  if (!clubId || !window.sb) return 0;
  let cq = window.sb.from('gps_pending_activities')
    .select('id', { count: 'exact', head: true }).eq('club_id', clubId);
  const tId = window._gpTeamId; if (tId) cq = cq.or(`team_id.eq.${tId},team_id.is.null`);
  const { count } = await cq;
  window._gpPendingN = count || 0;
  return window._gpPendingN;
}
// Day codes of the active sport (assets/sport-packs.js). The match-day value keeps the
// 'MD0' form the sessions table stores; cmMdNorm collapses it with 'MD' on read.
function _gpMdOpts() {
  const anchor = window.cmMdWindow ? window.cmMdWindow().anchor : 'MD';
  const codes = window.cmMdOptions ? window.cmMdOptions() : ['MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2'];
  return ['', ...codes.map(c => (c === anchor ? anchor + '0' : c))];
}
function _gpMdLabel(v) {
  if (v === '') return tt('gps_analysis.pending_not_md', '— Not a match day —');
  const anchor = window.cmMdWindow ? window.cmMdWindow().anchor : 'MD';
  return v === anchor + '0' ? anchor : v;
}
// Tipos de sesión ofrecidos al crear desde la bandeja (los que tienen sentido con GPS de campo).
const _GP_ST_LIST = ['training', 'match', 'outdoor', 'conditioning', 'recovery'];
const _GP_ST_EN = { training: 'Training', match: 'Match', outdoor: 'Outdoor', conditioning: 'Conditioning', recovery: 'Recovery' };
function _gpStLabel(t) { return tt('gps_analysis.st_' + t, _GP_ST_EN[t] || t); }
function _gpMdOptsSel(sel) { return _gpMdOpts().map(v => `<option value="${v}" ${v === sel ? 'selected' : ''}>${_gpMdLabel(v)}</option>`).join(''); }

async function _gpOpenPendingPanel() {
  const clubId = window._gpClubId || await window.getClubId?.();
  if (!clubId) { showToast(tt('gps_analysis.no_club_selected', 'No club selected'), true); return; }
  const ov = makeModal(tt('gps_analysis.pending_title', 'GPS days without a session'),
    `<div id="pendBody" style="width:100%"><div style="padding:24px;color:var(--cm-fg-muted)">${tt('common.loading', 'Loading…')}</div></div>`);
  const _m = ov.querySelector('.gp-modal'); if (_m) _m.style.width = 'min(96vw, 900px)';
  await _gpRenderPending(clubId, ov.querySelector('#pendBody'), ov);
}

async function _gpRenderPending(clubId, body, ov) {
  // AISLAMIENTO POR EQUIPO. El modal puede abrirse antes de que el dashboard resuelva _gpTeamId →
  // sin equipo activo las queries quedaban sin filtro = cross-team. Aseguramos el equipo primero.
  if (!window._gpTeamId && typeof window.gpsInitTeamSwitch === 'function') { try { await window.gpsInitTeamSwitch(); } catch {} }
  const tId = window._gpTeamId || null;
  // Pendientes: equipo activo O sin equipo (los imports de Catapult caen con team_id null).
  const _teamOrNull = q => tId ? q.or(`team_id.eq.${tId},team_id.is.null`) : q;
  // Sesiones/partidos PLANIFICADOS: siempre pertenecen a un equipo (el Calendar filtra por team_id) →
  // filtro ESTRICTO, para no colar sesiones de otra categoría del club.
  const _teamStrict = q => tId ? q.eq('team_id', tId) : q;
  let rows; const teams = {}; let plans = [], matches = [];
  try {
    rows = await window.cmFetchAll(() => _teamOrNull(window.sb.from('gps_pending_activities')
      .select('id, session_date, external_activity_id, activity_name, team_id, n_athletes')
      .eq('club_id', clubId)), { label: 'pending-activities' });
    rows.sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)));
    const { data: ts } = await window.sb.from('teams').select('id, name').eq('club_id', clubId);
    (ts || []).forEach(t => teams[t.id] = t.name);
    if (rows.length) {
      const dates = [...new Set(rows.map(r => r.session_date))];
      // Sesiones planificadas ADOPTABLES (no gym, sin GPS aún) esos días → sugerir ASOCIAR.
      // Traemos session_attributes para poder mostrar el rival fresco en las de tipo 'match'.
      const { data: ps } = await _teamStrict(window.sb.from('training_sessions')
        .select('id, session_date, session_type, session_time, match_day_offset, team_id, title, session_attributes')
        .eq('club_id', clubId).in('session_date', dates)
        .eq('is_historical', false).is('external_activity_id', null).neq('session_type', 'gym'));
      plans = ps || [];
      // Partidos del Calendar (calendar_events type=match) esos días → sugerir crear 'match'.
      const { data: ms } = await _teamStrict(window.sb.from('calendar_events')
        .select('date, opponent, home_away, team_id, title').eq('club_id', clubId)
        .in('date', dates).eq('type', 'match'));
      matches = ms || [];
    }
  } catch (e) { body.innerHTML = `<div style="padding:24px;color:var(--cm-danger)">${e.message}</div>`; return; }
  window._gpPendingN = rows.length;
  if (!rows.length) { body.innerHTML = `<div style="padding:24px;color:var(--cm-fg-muted)">${tt('gps_analysis.pending_empty', 'No GPS days waiting for a session. 🎉')}</div>`; return; }

  const _teamOk = (a, b) => !a || !b || String(a) === String(b);
  const _findPlans = r => plans.filter(p => p.session_date === r.session_date && _teamOk(p.team_id, r.team_id));
  const _findMatch = r => matches.find(m => m.date === r.session_date && _teamOk(m.team_id, r.team_id));
  // Nombre del rival de una sesión 'match': el title está congelado (snapshot); la verdad fresca es
  // calendar_events.opponent (renombrable) y, si no, session_attributes.rival.
  const _rivalOf = s => s?.session_attributes?.rival || s?.session_attributes?.opponent || null;
  const _planLabel = (p, mEvt) => {
    // Hora al frente: en días de doble sesión (AM/PM) dos "TRAINING" serían indistinguibles.
    const tm = p.session_time ? `${String(p.session_time).slice(0, 5)} · ` : '';
    if (p.session_type === 'match') {
      const riv = (mEvt && mEvt.opponent) || _rivalOf(p);
      return tm + (riv ? `${_gpStLabel('match')} · ${riv}` : (p.title || _gpStLabel('match')));
    }
    return tm + (p.title || _gpStLabel(p.session_type));
  };

  const rowHtml = (r) => {
    const cands = _findPlans(r), mEvt = _findMatch(r);
    const name = _gpEsc(r.activity_name || '—');
    const teamNm = r.team_id ? _gpEsc(teams[r.team_id] || '—') : tt('gps_analysis.pending_no_team', 'No team');
    const nAth = r.n_athletes ? ` · ${r.n_athletes} ${tt('gps_analysis.pending_athletes', 'players')}` : '';
    const isMatch = !!mEvt;
    // Selector unificado: ASOCIAR a cualquiera de las sesiones planificadas del día (menos gym, ya
    // filtradas por equipo), o CREAR una sesión nueva por tipo. Pre-selecciona 'match' si hay partido
    // en Calendar y no hay candidatas. Así un día con partido + compensatorio deja elegir a cuál va el GPS.
    const assocOpts = cands.map(p => {
      const md = p.match_day_offset ? ` · ${_gpMdLabel(p.match_day_offset)}` : '';
      return `<option value="s:${p.id}">${_gpEsc(_planLabel(p, mEvt))}${md}</option>`;
    }).join('');
    const createOpts = _GP_ST_LIST.map(t => `<option value="c:${t}" ${(!cands.length && isMatch && t === 'match') ? 'selected' : ''}>+ ${_gpStLabel(t)}</option>`).join('');
    const targetSel = `<select class="pend-target gp-pend-sel">${assocOpts ? `<optgroup label="${tt('gps_analysis.pending_assoc_group', 'Associate to session')}">${assocOpts}</optgroup>` : ''}<optgroup label="${tt('gps_analysis.pending_create_group', 'Create new session')}">${createOpts}</optgroup></select>`;
    const matchChip = mEvt ? `<span class="gp-pend-match"><i class="ti ti-ball-football"></i> ${tt('gps_analysis.pending_match_found', 'Match in calendar')}${mEvt.opponent ? ' · ' + _gpEsc(mEvt.opponent) : ''}</span>` : '';
    return `<div class="gp-pend-row" data-pend="${r.id}" data-date="${r.session_date}" data-team="${r.team_id || ''}" data-aid="${_gpEsc(r.external_activity_id || '')}">
      <div class="gp-pend-when"><i class="ti ti-satellite"></i><b>${r.session_date || '—'}</b></div>
      <div class="gp-pend-body">
        <div class="gp-pend-name">${name}</div>
        <div class="gp-pend-meta">${teamNm}${nAth}</div>
        ${matchChip}
      </div>
      <div class="gp-pend-actions">
        ${targetSel}
        <select class="pend-md gp-pend-sel" style="max-width:150px">${_gpMdOptsSel(isMatch && !cands.length ? 'MD0' : '')}</select>
        <button class="cm-btn is-primary is-sm pend-go"></button>
      </div>
    </div>`;
  };

  body.innerHTML = `
    <style>
      .gp-pend{display:flex;flex-direction:column;gap:8px;padding:2px}
      .gp-pend-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--cm-border);border-radius:12px;background:var(--cm-bg-subtle,var(--cm-bg));transition:border-color .15s ease,box-shadow .15s ease}
      .gp-pend-row:hover{border-color:var(--cm-accent,#6366f1);box-shadow:0 1px 6px rgba(0,0,0,.05)}
      .gp-pend-when{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:104px;padding:8px 10px;border-radius:10px;background:var(--cm-bg);border:1px solid var(--cm-border);color:var(--cm-fg-muted)}
      .gp-pend-when i{font-size:14px;opacity:.7}
      .gp-pend-when b{font-family:var(--cm-font-mono);font-size:12px;color:var(--cm-fg-strong);white-space:nowrap;letter-spacing:-.2px}
      .gp-pend-body{flex:1 1 200px;min-width:160px;display:flex;flex-direction:column;gap:3px}
      .gp-pend-name{font-weight:600;font-size:13px;color:var(--cm-fg-strong);word-break:break-word}
      .gp-pend-meta{font-size:11px;color:var(--cm-fg-muted)}
      .gp-pend-match{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;margin-top:1px;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;color:var(--cm-accent,#6366f1);background:color-mix(in srgb,var(--cm-accent,#6366f1) 13%,transparent)}
      .gp-pend-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
      .gp-pend-sel{height:34px;padding:0 10px;border:1px solid var(--cm-border);border-radius:9px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;font-size:12.5px;max-width:230px;cursor:pointer;transition:border-color .12s ease,box-shadow .12s ease}
      .gp-pend-sel:hover{border-color:var(--cm-fg-muted)}
      .gp-pend-sel:focus{outline:none;border-color:var(--cm-accent,#6366f1);box-shadow:0 0 0 3px color-mix(in srgb,var(--cm-accent,#6366f1) 22%,transparent)}
      .gp-pend-sel:disabled{opacity:.4;cursor:not-allowed}
      .gp-pend-row .pend-go{height:34px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
    </style>
    <div style="font:500 12px/1.55 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 14px">${tt('gps_analysis.pending_sub2', 'These days have GPS but no linked session. If a planned session/match already exists that day, associate the GPS to it; otherwise create the session (matchday / training / outdoor).')}</div>
    <div class="gp-pend" style="max-height:56vh;overflow-y:auto;overflow-x:hidden">${rows.map(rowHtml).join('')}</div>`;
  // Sincroniza label del botón (Asociar vs Crear) y habilita el MD solo al crear.
  body.querySelectorAll('.pend-target').forEach(sel => {
    const sync = () => {
      const tr = sel.closest('[data-pend]');
      const isCreate = String(sel.value).startsWith('c:');
      const md = tr.querySelector('.pend-md');
      md.disabled = !isCreate; md.style.opacity = isCreate ? '' : '.4';
      tr.querySelector('.pend-go').innerHTML = isCreate
        ? `<i class="ti ti-calendar-plus" style="font-size:14px"></i>${tt('gps_analysis.pending_create', 'Create + sync')}`
        : `<i class="ti ti-link" style="font-size:14px"></i>${tt('gps_analysis.pending_associate', 'Associate')}`;
    };
    sel.addEventListener('change', sync); sync();
  });
  body.querySelectorAll('.pend-go').forEach(btn => btn.addEventListener('click', () => {
    const tr = btn.closest('[data-pend]');
    const val = String(tr.querySelector('.pend-target').value);
    const base = { pendId: tr.dataset.pend, date: tr.dataset.date, activityId: tr.dataset.aid || null };
    if (val.startsWith('s:')) {
      _gpResolvePending(clubId, { ...base, sessionId: val.slice(2), create: false }, body, ov, btn);
    } else {
      _gpResolvePending(clubId, { ...base, teamId: tr.dataset.team || window._gpTeamId || null, sessionType: val.slice(2), md: tr.querySelector('.pend-md').value, create: true }, body, ov, btn);
    }
  }));
}

// Resuelve un pendiente: CREA la sesión (si create=true) o solo ASOCIA la ya planificada, y en
// ambos casos dispara el re-sync dirigido (START acotado al día) → la sync adopta la sesión, baja
// gps_reports y borra el pendiente solo. Para ASOCIAR la sesión ya existe → solo hay que re-syncar.
async function _gpResolvePending(clubId, p, body, ov, btn) {
  btn.disabled = true; const _lbl = btn.innerHTML;
  try {
    let sessionId = p.sessionId || null;   // ASOCIAR → id de la sesión planificada detectada
    if (p.create) {
      btn.textContent = tt('gps_analysis.pending_creating', 'Creating…');
      // is_historical:true → la sesión sostiene el GPS (gps_reports.session_id la necesita) y aparece
      // en GPS Analysis / Sessions history, pero NO se dibuja en el Calendar de planificación (que
      // filtra is_historical=false). Es un registro retroactivo de un día ya jugado, no un evento
      // planificado: no ensucia el calendario. Si querés que SÍ aparezca, planificalo en el Calendar
      // y usá "Asociar" en vez de "Crear".
      const ins = {
        club_id: clubId, session_date: p.date, session_type: p.sessionType, is_historical: true,
        title: `${_GP_ST_EN[p.sessionType] || 'Session'} · ${p.date}`,
        ...(p.teamId ? { team_id: p.teamId } : {}),
        ...(p.md ? { match_day_offset: p.md } : {}),
      };
      const { data: newSess, error: sErr } = await window.sb.from('training_sessions').insert(ins).select('id').single();
      if (sErr) throw sErr;
      sessionId = newSess?.id || null;
    }
    // Fallback (asociar): si no vino el id de la sesión (HTML viejo cacheado), re-buscar la sesión
    // planificada adoptable de ese día → nunca falla con "no session" por un data-attr vacío.
    if (!sessionId && !p.create) {
      let fq = window.sb.from('training_sessions')
        .select('id').eq('club_id', clubId).eq('session_date', p.date)
        .eq('is_historical', false).is('external_activity_id', null).neq('session_type', 'gym');
      const tId = window._gpTeamId; if (tId) fq = fq.eq('team_id', tId);
      const { data: pl } = await fq.limit(2);
      // Día con VARIAS sesiones adoptables y sin id explícito (HTML viejo cacheado): no adivinar
      // a cuál va el GPS — pedir recargar y elegir en el selector.
      if (pl && pl.length > 1) throw new Error(tt('gps_analysis.pending_ambiguous', 'Several sessions that day — reload the page and pick one in the selector.'));
      sessionId = (pl && pl[0] && pl[0].id) || null;
    }
    if (!sessionId) throw new Error(tt('gps_analysis.pending_no_session', 'No session for that day'));
    // Actividad del pendiente: del dataset o RE-FETCH (robusto ante HTML viejo cacheado sin data-aid).
    let activityId = p.activityId || null;
    if (!activityId && p.pendId) {
      const { data: pend } = await window.sb.from('gps_pending_activities').select('external_activity_id').eq('id', p.pendId).maybeSingle();
      activityId = (pend && pend.external_activity_id) || null;
    }
    const { data: intgs } = await window.sb.from('gps_integrations').select('id').eq('provider', 'catapult').limit(1);
    const intId = intgs && intgs[0] && intgs[0].id;
    if (!intId) throw new Error(tt('gps_analysis.pending_no_integration', 'No provider connected — a re-sync is needed to attach the GPS.'));
    if (!activityId) throw new Error(tt('gps_analysis.pending_no_activity', 'Missing activity reference — re-sync to re-create it.'));
    // MODO DIRIGIDO: gps-sync baja SOLO esta actividad (por su id, sin rango → sin problema de zona
    // horaria) y la escribe en ESTA sesión, server-side y síncrono. NO borramos el pendiente acá:
    // lo borra el SERVER recién tras bajar los datos → nunca se pierde el pendiente sin haber bajado.
    btn.textContent = tt('gps_analysis.pending_syncing', 'Syncing…');
    const { data: res, error: aErr } = await window.sb.functions.invoke('gps-sync', {
      body: { mode: 'attach', integration_id: intId, external_activity_id: activityId, session_id: sessionId, from: p.date, to: p.date, tz_offset: -new Date().getTimezoneOffset() },
    });
    if (aErr) { let msg = aErr.message || 'error'; try { const b = await aErr.context?.json?.(); if (b && (b.error || b.message)) msg = b.error || b.message; } catch (_) {} throw new Error(msg); }
    if (res && res.ok === false) throw new Error(res.message || 'attach failed');
    // El modo 'attach' devuelve {rows}. Si vuelve {job_id} en su lugar → el gps-sync desplegado NO
    // tiene el modo dirigido (cayó a START) → avisar que falta deployar (y NO tocar el pendiente).
    if (res && res.job_id != null && res.rows == null) {
      showToast(tt('gps_analysis.pending_deploy', 'Deploy the GPS sync on the server (supabase functions deploy gps-sync) — the direct attach is not live yet.'), true);
      btn.disabled = false; btn.innerHTML = _lbl; return;
    }
    if (res && Number(res.rows) === 0) {
      showToast(tt('gps_analysis.pending_zero', 'Linked, but 0 GPS rows came down — check the metric mapping or that the activity has data.'), true);
    }
    showToast(p.create ? tt('gps_analysis.pending_done', 'Session created — GPS attached') : tt('gps_analysis.pending_assoc_done', 'GPS attached to the session'));
    window.cmInvalidateGpsCache?.();
    // Recargar las OPCIONES del filterbar (fechas/sesiones) — cargaron al abrir la página, antes
    // del attach, así que la fecha recién enganchada no aparecía en el selector hasta recargarlas.
    try { await window.gpFilterBar?.reload?.({ force: true }); } catch {}
    try { window.refreshDashboard?.(); } catch {}
    await _gpRenderPending(clubId, body, ov);
  } catch (e) { showToast(tt('gps_analysis.ctx_failed', 'Failed: {msg}', { msg: e.message }), true); btn.disabled = false; btn.innerHTML = _lbl; }
}

async function _gpPollPendingGone(clubId, pendId) {
  for (let i = 0; i < 30; i++) {   // ~60s (30 × 2s): el worker encadenado suele terminar un día de una
    await new Promise(r => setTimeout(r, 2000));
    const { data } = await window.sb.from('gps_pending_activities').select('id').eq('id', pendId).maybeSingle();
    if (!data) return true;
  }
  return false;
}

// ── Flagged periods — review panel (Fase 3·B) ────────────────────────────────
// Periods the importer marked is_flagged (speed_outlier) are EXCLUDED from analysis
// (v_gps_task_analysis) but kept in the table. Here the user reviews each one and either
// Deletes it (confirmed noise) or Keeps it (un-flag → back into analysis).
window._gpFlaggedN = window._gpFlaggedN || 0;
async function _gpFlaggedCount() {
  const clubId = window._gpClubId || await window.getClubId?.();
  if (!clubId || !window.sb) return 0;
  const { count } = await window.sb.from('gps_period_reports')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId).eq('is_flagged', true);
  window._gpFlaggedN = count || 0;
  return window._gpFlaggedN;
}
// Cheap "post-sync review" signal: sessions the sync imported as historical that still carry
// no season (season_id null). Surfaced as a badge on the Assign rivals menu item so the user
// knows there are imported days to bucket into a season. Head-count only (no rows fetched).
async function _gpOutsideSeasonCount() {
  const clubId = window._gpClubId || await window.getClubId?.();
  if (!clubId || !window.sb) return 0;
  const { count } = await window.sb.from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId).eq('is_historical', true).is('season_id', null);
  window._gpOutsideN = count || 0;
  return window._gpOutsideN;
}
async function _gpOpenFlaggedPanel() {
  const clubId = window._gpClubId || await window.getClubId?.();
  if (!clubId) { showToast('No club selected', true); return; }
  const ov = makeModal('Flagged periods', '<div id="flaggedBody" style="min-width:660px;max-width:880px"><div style="padding:24px;color:var(--cm-fg-muted)">Loading…</div></div>');
  await _gpRenderFlagged(clubId, ov.querySelector('#flaggedBody'), ov);
}
async function _gpRenderFlagged(clubId, body, ov) {
  let rows;
  try {
    // Aislar por equipo: solo periodos de jugadores del roster activo (gps_period_reports tiene player_id).
    rows = await window.cmFetchAll(() => _scopeTeam(window.sb.from('gps_period_reports')
      .select('id, period_name, duration_seconds, total_distance, flag_reason, training_sessions(session_date), players(first_name,last_name)')
      .eq('club_id', clubId).eq('is_flagged', true)), { label: 'flagged-periods' });
  } catch (e) { body.innerHTML = `<div style="padding:24px;color:var(--cm-danger)">${e.message}</div>`; return; }
  if (!rows.length) {
    body.innerHTML = '<div style="padding:24px;color:var(--cm-fg-muted)">No flagged periods. 🎉</div>';
    window._gpFlaggedN = 0; return;
  }
  window._gpFlaggedN = rows.length;
  const mps = r => (r.total_distance != null && r.duration_seconds) ? (r.total_distance / r.duration_seconds).toFixed(1) : '—';
  const num = 'text-align:right;font-family:var(--cm-font-mono);font-variant-numeric:tabular-nums';
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap">
      <span style="font:600 12.5px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">${rows.length} periods need review</span>
      <span style="font:500 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)">Impossible speed (&gt;13 m/s) — likely GPS noise. Delete the noise; keep the rest (returns to analysis).</span>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="cm-btn is-outline is-sm" id="flagKeepAll"><i class="ti ti-check"></i>Keep all</button>
        <button class="cm-btn is-outline is-sm" id="flagDelAll" style="color:var(--cm-danger);border-color:var(--cm-danger)"><i class="ti ti-trash"></i>Delete all</button>
      </div>
    </div>
    <div class="gp-imp-preview" style="max-height:54vh;overflow:auto"><table>
      <thead><tr><th>Date</th><th>Player</th><th>Period</th><th style="text-align:right">Dur (s)</th><th style="text-align:right">Total (m)</th><th style="text-align:right">m/s</th><th>Reason</th><th></th></tr></thead>
      <tbody>${rows.map(r => `
        <tr data-id="${r.id}">
          <td style="font-family:var(--cm-font-mono)">${r.training_sessions?.session_date || '—'}</td>
          <td>${_gpEsc([r.players?.first_name, r.players?.last_name].filter(Boolean).join(' ') || '—')}</td>
          <td>${_gpEsc(r.period_name || '—')}</td>
          <td style="${num}">${r.duration_seconds != null ? Math.round(r.duration_seconds) : '—'}</td>
          <td style="${num}">${r.total_distance != null ? Math.round(r.total_distance) : '—'}</td>
          <td style="${num};color:var(--cm-danger)">${mps(r)}</td>
          <td style="color:var(--cm-fg-muted)">${_gpEsc(r.flag_reason || '—')}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="cm-btn is-ghost is-sm flag-keep" data-id="${r.id}" title="Un-flag · return to analysis"><i class="ti ti-check"></i>Keep</button>
            <button class="cm-btn is-ghost is-sm flag-del"  data-id="${r.id}" title="Delete this period" style="color:var(--cm-danger)"><i class="ti ti-trash"></i>Delete</button>
          </td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  body.querySelectorAll('.flag-keep').forEach(b => b.addEventListener('click', () => _gpFlagAction(clubId, body, ov, [b.dataset.id], 'keep')));
  body.querySelectorAll('.flag-del').forEach(b => b.addEventListener('click', () => _gpFlagAction(clubId, body, ov, [b.dataset.id], 'delete')));
  body.querySelector('#flagKeepAll').addEventListener('click', () => _gpFlagAction(clubId, body, ov, rows.map(r => r.id), 'keep'));
  body.querySelector('#flagDelAll').addEventListener('click', () => _gpFlagAction(clubId, body, ov, rows.map(r => r.id), 'delete'));
}
async function _gpFlagAction(clubId, body, ov, ids, mode) {
  if (!ids.length) return;
  try {
    if (mode === 'delete') {
      const { error } = await window.sb.from('gps_period_reports').delete().eq('club_id', clubId).in('id', ids);
      if (error) throw error;
      showToast(ids.length > 1 ? `Deleted ${ids.length} periods` : 'Period deleted');
    } else {
      const { error } = await window.sb.from('gps_period_reports').update({ is_flagged: false, flag_reason: null }).eq('club_id', clubId).in('id', ids);
      if (error) throw error;
      showToast(ids.length > 1 ? `Kept ${ids.length} periods` : 'Period kept');
    }
  } catch (e) { showToast(`Action failed: ${e.message}`, true); return; }
  await _gpRenderFlagged(clubId, body, ov);          // re-query → reflects the change
  try { window.refreshDashboard?.(); } catch {}      // un-flagged data re-enters the analysis
}

// ── Training context (rehab / individual / top-up) ───────────────────────────
// Marca por jugador×sesión (una fila de gps_reports). El default es 'team'; todo lo
// que NO sea 'team' se excluye de las medias de plantel (gps_session_agg filtra
// work_context='team'), así rehab/individual/top-up no ensucian el promedio del equipo.
// Los datos del jugador NO se borran: cambiar el contexto solo los saca de la media.
const _CTX_VALUES = ['team', 'rehab', 'individual', 'topup'];
function _ctxLabel(v) { return tt('gps_analysis.ctx_' + v, ({ team: 'Team', rehab: 'Rehab', individual: 'Individual', topup: 'Top-up' })[v] || v); }

async function _gpOpenContextPanel() {
  const clubId = window._gpClubId || await window.getClubId?.();
  const teamId = window._gpTeamId || null;
  if (!clubId) { showToast(tt('gps_analysis.no_club_selected', 'No club selected'), true); return; }
  const ov = makeModal(tt('gps_analysis.ctx_title', 'Training context'),
    `<div id="ctxBody" style="width:100%"><div style="padding:24px;color:var(--cm-fg-muted)">${tt('common.loading', 'Loading…')}</div></div>`);
  const _m = ov.querySelector('.gp-modal'); if (_m) _m.style.width = 'min(96vw, 940px)';   // el modal base es 560px → ampliarlo
  await _gpRenderContext(clubId, teamId, ov.querySelector('#ctxBody'), ov);
}

async function _gpRenderContext(clubId, teamId, body, ov) {
  let rows;
  try {
    // Team isolation: only the active team's roster (gps_reports has no team_id → scope via player_teams).
    let pids = null;
    if (teamId) {
      const { data: pt } = await window.sb.from('player_teams').select('player_id').eq('team_id', teamId);
      pids = (pt || []).map(x => x.player_id);
      if (!pids.length) pids = ['00000000-0000-0000-0000-000000000000'];   // roster empty → no rows
    }
    // Date scoping: last 60 days of sessions (keeps the list manageable).
    const from = window.cmYMD(new Date(Date.now() - 60 * 86400 * 1000));
    const { data: sess } = await window.sb.from('training_sessions')
      .select('id, session_date, session_type').eq('club_id', clubId).gte('session_date', from)
      .order('session_date', { ascending: false });
    const sids = (sess || []).map(s => s.id);
    const sById = {}; (sess || []).forEach(s => sById[s.id] = s);
    if (!sids.length) { body.innerHTML = `<div style="padding:24px;color:var(--cm-fg-muted)">${tt('gps_analysis.ctx_empty', 'No GPS data in the last 60 days.')}</div>`; return; }
    rows = await window.cmFetchAll(() => {
      let q = window.sb.from('gps_reports')
        .select('id, player_id, session_id, work_context, total_distance, players(first_name,last_name)')
        .eq('club_id', clubId).in('session_id', sids);
      if (pids) q = q.in('player_id', pids);
      return q;
    }, { label: 'ctx-rows' });
    rows.forEach(r => { r._date = sById[r.session_id]?.session_date || ''; r._st = sById[r.session_id]?.session_type || ''; });
    rows.sort((a, b) => (b._date || '').localeCompare(a._date || ''));
  } catch (e) { body.innerHTML = `<div style="padding:24px;color:var(--cm-danger)">${e.message}</div>`; return; }
  if (!rows.length) { body.innerHTML = `<div style="padding:24px;color:var(--cm-fg-muted)">${tt('gps_analysis.ctx_empty', 'No GPS data in the last 60 days.')}</div>`; return; }

  const num = 'text-align:right;font-family:var(--cm-font-mono);font-variant-numeric:tabular-nums';
  const opts = v => _CTX_VALUES.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${_ctxLabel(x)}</option>`).join('');
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap">
      <span style="font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);max-width:560px">${tt('gps_analysis.ctx_sub', 'Mark player-sessions that are NOT team training. Anything other than “Team” is excluded from squad averages, so rehab / individual / top-up work doesn’t skew the mean.')}</span>
      <input id="ctxSearch" placeholder="${tt('gps_analysis.ctx_search', 'Search player…')}" style="margin-left:auto;height:30px;padding:0 10px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
    </div>
    <div class="gp-imp-preview" style="max-height:56vh;overflow:auto"><table>
      <thead><tr><th>${tt('gps_analysis.ctx_date', 'Date')}</th><th>${tt('gps_analysis.ctx_player', 'Player')}</th><th>${tt('gps_analysis.ctx_session', 'Session')}</th><th style="text-align:right">${tt('gps_analysis.ctx_td', 'Total (m)')}</th><th>${tt('gps_analysis.ctx_col', 'Context')}</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr data-crow data-name="${_gpEsc(([r.players?.first_name, r.players?.last_name].filter(Boolean).join(' ') || '').toLowerCase())}">
          <td style="font-family:var(--cm-font-mono)">${r._date || '—'}</td>
          <td>${_gpEsc([r.players?.first_name, r.players?.last_name].filter(Boolean).join(' ') || '—')}</td>
          <td style="color:var(--cm-fg-muted)">${r._st || '—'}</td>
          <td style="${num}">${r.total_distance != null ? Math.round(r.total_distance) : '—'}</td>
          <td><select class="ctx-sel" data-id="${r.id}" style="height:30px;padding:0 8px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">${opts(r.work_context || 'team')}</select></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  body.querySelectorAll('.ctx-sel').forEach(sel => sel.addEventListener('change', () => _gpSetContext(clubId, sel.dataset.id, sel.value)));
  const search = body.querySelector('#ctxSearch');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    body.querySelectorAll('[data-crow]').forEach(tr => { tr.style.display = (!q || tr.dataset.name.includes(q)) ? '' : 'none'; });
  });
}

async function _gpSetContext(clubId, id, ctx) {
  try {
    const { error } = await window.sb.from('gps_reports').update({ work_context: ctx }).eq('club_id', clubId).eq('id', id);
    if (error) throw error;
    showToast(tt('gps_analysis.ctx_saved', 'Context updated'));
    window.cmInvalidateGpsCache?.();
    try { window.refreshDashboard?.(); } catch {}   // recompute means without the reclassified row
  } catch (e) { showToast(tt('gps_analysis.ctx_failed', 'Failed: {msg}', { msg: e.message }), true); }
}

// ── Period context (Fase 2) — rehab / top-up DENTRO de una sesión de equipo ────
// Caso: un jugador juega 60' + hace top-up en la MISMA actividad de Catapult. El total
// de sesión (gps_reports) mezcla los dos; acá se marca el PERÍODO ("Rehab PISETH", "Top-up")
// y en la media el período no-team se RESTA del total (Fase 2b). Grano: gps_period_reports.
let _pctxFrom = null, _pctxTo = null;   // rango de fechas del panel de períodos (persiste entre re-renders)
async function _gpOpenPeriodPanel() {
  const clubId = window._gpClubId || await window.getClubId?.();
  const teamId = window._gpTeamId || null;
  if (!clubId) { showToast(tt('gps_analysis.no_club_selected', 'No club selected'), true); return; }
  _pctxFrom = null; _pctxTo = null;   // reset al abrir → default últimos 60 días
  const ov = makeModal(tt('gps_analysis.pctx_title', 'Period context'),
    `<div id="pctxBody" style="width:100%"><div style="padding:24px;color:var(--cm-fg-muted)">${tt('common.loading', 'Loading…')}</div></div>`);
  const _m = ov.querySelector('.gp-modal'); if (_m) _m.style.width = 'min(96vw, 940px)';   // el modal base es 560px → ampliarlo
  await _gpRenderPeriods(clubId, teamId, ov.querySelector('#pctxBody'), ov);
}

// Patrones POR DEFECTO — espejo de public.apply_gps_context_rule() (migración 130). Solo
// informativos acá: los aplica el trigger cuando NINGUNA regla del club matchea. Para anular
// uno, el club crea una regla con el mismo nombre y contexto "Team".
const _CTX_DEFAULT_RULES = [
  { pattern: '%top up%', work_context: 'topup' },
  { pattern: '%top-up%', work_context: 'topup' },
  { pattern: '%topup%', work_context: 'topup' },
  { pattern: '%complementar%', work_context: 'topup' },
  { pattern: '%complemento%', work_context: 'topup' },
  { pattern: '%compensator%', work_context: 'topup' },
  { pattern: '%compensac%', work_context: 'topup' },
  { pattern: '%rehab%', work_context: 'rehab' },
  { pattern: '%readapt%', work_context: 'rehab' },
  { pattern: '%reatlet%', work_context: 'rehab' },
  { pattern: '%individual%', work_context: 'individual' },
];

// Barra de reglas de auto-etiquetado: chips (patrón → contexto, borrable) + alta inline.
// El nombre que escribís se guarda como '%nombre%' (contains) salvo que ya pongas %.
function _gpRulesBarHTML(rules) {
  const esc = s => String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  const chips = (rules || []).map(r => `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid var(--cm-border);border-radius:99px;font-size:11.5px;background:var(--cm-bg)"><b>${esc(r.pattern)}</b> → ${_ctxLabel(r.work_context)} <button class="rule-del" data-rule="${r.id}" title="${tt('common.delete','Delete')}" style="border:0;background:none;color:var(--cm-fg-muted);cursor:pointer;font-size:14px;line-height:1;padding:0">×</button></span>`).join('');
  // Defaults: mismo chip, atenuado y sin ×. Se ocultan los que el club ya anuló con una regla propia.
  const own = new Set((rules || []).map(r => String(r.pattern).toLowerCase()));
  const defChips = _CTX_DEFAULT_RULES.filter(d => !own.has(d.pattern)).map(d =>
    `<span title="${tt('gps_analysis.rules_default_hint', 'Built-in rule. To override it, add a rule with the same name and context Team.')}" style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border:1px dashed var(--cm-border);border-radius:99px;font-size:11.5px;color:var(--cm-fg-muted);background:transparent"><b>${esc(d.pattern)}</b> → ${_ctxLabel(d.work_context)}</span>`).join('');
  // 'team' = anulación ("esto SÍ es trabajo de equipo"), no un contexto que se etiquete.
  const ctxOpts = ['topup', 'rehab', 'individual', 'team'].map(c => `<option value="${c}">${c === 'team' ? tt('gps_analysis.rules_ctx_team', 'Team (ignore)') : _ctxLabel(c)}</option>`).join('');
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--cm-border);border-radius:10px;margin-bottom:12px;background:var(--cm-surface)">
    <span style="font:600 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-strong)">${tt('gps_analysis.rules_title', 'Auto-tag by period name')}</span>
    ${chips}${defChips}${(chips || defChips) ? '' : `<span style="font-size:11.5px;color:var(--cm-fg-muted)">${tt('gps_analysis.rules_empty', 'No rules yet')}</span>`}
    <span style="margin-left:auto;display:inline-flex;gap:6px;align-items:center">
      <input id="ruleName" placeholder="${tt('gps_analysis.rules_name_ph', 'name contains… e.g. Rehab')}" style="height:28px;padding:0 8px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;width:190px">
      <select id="ruleCtx" style="height:28px;padding:0 6px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">${ctxOpts}</select>
      <button class="cm-btn is-outline is-sm" id="ruleAdd" style="height:28px">${tt('gps_analysis.rules_add', 'Add rule')}</button>
    </span>
  </div>`;
}
function _gpWireRulesBar(body, clubId, teamId, ov) {
  body.querySelectorAll('.rule-del').forEach(b => b.addEventListener('click', () => _gpDelContextRule(clubId, teamId, b.dataset.rule, body, ov)));
  const add = body.querySelector('#ruleAdd');
  add?.addEventListener('click', async () => {
    const name = (body.querySelector('#ruleName')?.value || '').trim();
    const ctx = body.querySelector('#ruleCtx')?.value || 'topup';   // 'team' = anular un default
    if (!name) { showToast(tt('gps_analysis.rules_need_name', 'Type a name first'), true); return; }
    const pat = /%/.test(name) ? name : '%' + name + '%';   // "Rehab" → "%Rehab%" (contains)
    await _gpAddContextRule(clubId, teamId, pat, ctx, body, ov);
  });
}
async function _gpAddContextRule(clubId, teamId, pattern, ctx, body, ov) {
  try {
    const { error } = await window.sb.from('gps_context_rules').insert({ club_id: clubId, pattern, work_context: ctx });
    if (error) throw error;
    // Back-fill: aplicar a los períodos YA importados que matchean y siguen en 'team'.
    // Una regla 'team' es una ANULACIÓN de un patrón por defecto: devuelve a 'team' lo que el
    // trigger había etiquetado solo (nunca toca lo que ya estaba en 'team').
    if (ctx === 'team') {
      await window.sb.from('gps_period_reports').update({ work_context: 'team' })
        .eq('club_id', clubId).neq('work_context', 'team').ilike('period_name', pattern);
    } else {
      await window.sb.from('gps_period_reports').update({ work_context: ctx })
        .eq('club_id', clubId).eq('work_context', 'team').ilike('period_name', pattern);
    }
    showToast(tt('gps_analysis.rules_added', 'Rule added'));
    window.cmInvalidateGpsCache?.();
    try { window.refreshDashboard?.(); } catch {}
    await _gpRenderPeriods(clubId, teamId, body, ov);   // refresca chips + tabla
  } catch (e) { showToast(tt('gps_analysis.ctx_failed', 'Failed: {msg}', { msg: e.message }), true); }
}
async function _gpDelContextRule(clubId, teamId, id, body, ov) {
  try {
    // Borra la regla (los períodos ya etiquetados quedan como están; solo corta el auto a futuro).
    const { error } = await window.sb.from('gps_context_rules').delete().eq('club_id', clubId).eq('id', id);
    if (error) throw error;
    showToast(tt('gps_analysis.rules_removed', 'Rule removed'));
    await _gpRenderPeriods(clubId, teamId, body, ov);
  } catch (e) { showToast(tt('gps_analysis.ctx_failed', 'Failed: {msg}', { msg: e.message }), true); }
}

async function _gpRenderPeriods(clubId, teamId, body, ov) {
  const _to = _pctxTo || window.cmToday();
  const _from = _pctxFrom || window.cmYMD(new Date(Date.now() - 60 * 86400 * 1000));
  let rows = [], rules = [];
  try {
    const { data: rl } = await window.sb.from('gps_context_rules')
      .select('id, pattern, work_context').eq('club_id', clubId).order('created_at', { ascending: true });
    rules = rl || [];
    let pids = null;
    if (teamId) {
      const { data: pt } = await window.sb.from('player_teams').select('player_id').eq('team_id', teamId);
      pids = (pt || []).map(x => x.player_id);
      if (!pids.length) pids = ['00000000-0000-0000-0000-000000000000'];
    }
    const { data: sess } = await window.sb.from('training_sessions')
      .select('id, session_date').eq('club_id', clubId).gte('session_date', _from).lte('session_date', _to)
      .order('session_date', { ascending: false });
    const sids = (sess || []).map(s => s.id);
    const sById = {}; (sess || []).forEach(s => sById[s.id] = s);
    if (sids.length) {
      rows = await window.cmFetchAll(() => {
        let q = window.sb.from('gps_period_reports')
          .select('id, player_id, session_id, period_name, work_context, duration_seconds, total_distance, players(first_name,last_name)')
          .eq('club_id', clubId).in('session_id', sids);
        if (pids) q = q.in('player_id', pids);
        return q;
      }, { label: 'pctx-rows' });
      rows.forEach(r => { r._date = sById[r.session_id]?.session_date || ''; });
      rows.sort((a, b) => (b._date || '').localeCompare(a._date || '') || (a.period_name || '').localeCompare(b.period_name || ''));
    }
  } catch (e) { body.innerHTML = `<div style="padding:24px;color:var(--cm-danger)">${e.message}</div>`; return; }

  const rulesBar = _gpRulesBarHTML(rules);
  const inp = 'height:30px;padding:0 8px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit';
  const today = window.cmToday();
  const dateHeader = `
    <div style="display:flex;align-items:center;gap:8px;margin:0 0 8px;flex-wrap:wrap">
      <label style="font-size:11.5px;color:var(--cm-fg-muted);display:inline-flex;align-items:center;gap:4px">${tt('gps_analysis.sync_from', 'From')}<input type="date" id="pctxFrom" value="${_from}" max="${today}" style="${inp}"></label>
      <label style="font-size:11.5px;color:var(--cm-fg-muted);display:inline-flex;align-items:center;gap:4px">${tt('gps_analysis.sync_to', 'To')}<input type="date" id="pctxTo" value="${_to}" max="${today}" style="${inp}"></label>
      <input id="pctxSearch" placeholder="${tt('gps_analysis.pctx_search', 'Search player or period…')}" style="margin-left:auto;${inp};min-width:180px;flex:1 1 180px">
    </div>`;
  const _wireHeader = () => {
    const f = body.querySelector('#pctxFrom'), t = body.querySelector('#pctxTo');
    const onDate = () => { _pctxFrom = f?.value || null; _pctxTo = t?.value || null; _gpRenderPeriods(clubId, teamId, body, ov); };
    f?.addEventListener('change', onDate); t?.addEventListener('change', onDate);
    const search = body.querySelector('#pctxSearch');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      body.querySelectorAll('[data-prow]').forEach(tr => { tr.style.display = (!q || tr.dataset.name.includes(q)) ? '' : 'none'; });
    });
  };

  if (!rows.length) {
    body.innerHTML = rulesBar + dateHeader + `<div style="padding:20px 4px;color:var(--cm-fg-muted);font-size:12.5px">${tt('gps_analysis.pctx_empty', 'No periods in this date range.')}</div>`;
    _gpWireRulesBar(body, clubId, teamId, ov); _wireHeader();
    return;
  }

  const num = 'text-align:right;font-family:var(--cm-font-mono);font-variant-numeric:tabular-nums;white-space:nowrap';
  const opts = v => _CTX_VALUES.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${_ctxLabel(x)}</option>`).join('');
  body.innerHTML = rulesBar + dateHeader + `
    <div style="font:500 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0 0 8px">${tt('gps_analysis.pctx_sub', 'Mark a PERIOD (drill) as rehab / individual / top-up — e.g. a top-up done after the match in the SAME session. Non-team periods are subtracted from the team mean.')}</div>
    <div class="gp-imp-preview" style="max-height:52vh;overflow-y:auto;overflow-x:hidden"><table style="width:100%;table-layout:auto">
      <thead><tr><th>${tt('gps_analysis.ctx_date', 'Date')}</th><th>${tt('gps_analysis.ctx_player', 'Player')}</th><th>${tt('gps_analysis.pctx_period', 'Period')}</th><th style="text-align:right">${tt('gps_analysis.pctx_dur', 'Dur (s)')}</th><th style="text-align:right">${tt('gps_analysis.ctx_td', 'Total (m)')}</th><th>${tt('gps_analysis.ctx_col', 'Context')}</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr data-prow data-name="${_gpEsc(([r.players?.first_name, r.players?.last_name].filter(Boolean).join(' ') + ' ' + (r.period_name || '')).toLowerCase())}">
          <td style="font-family:var(--cm-font-mono);white-space:nowrap">${r._date || '—'}</td>
          <td style="white-space:normal;word-break:break-word">${_gpEsc([r.players?.first_name, r.players?.last_name].filter(Boolean).join(' ') || '—')}</td>
          <td style="white-space:normal;word-break:break-word">${_gpEsc(r.period_name || '—')}</td>
          <td style="${num}">${r.duration_seconds != null ? Math.round(r.duration_seconds) : '—'}</td>
          <td style="${num}">${r.total_distance != null ? Math.round(r.total_distance) : '—'}</td>
          <td><select class="pctx-sel" data-id="${r.id}" style="height:30px;padding:0 6px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">${opts(r.work_context || 'team')}</select></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  body.querySelectorAll('.pctx-sel').forEach(sel => sel.addEventListener('change', () => _gpSetPeriodContext(clubId, sel.dataset.id, sel.value)));
  _gpWireRulesBar(body, clubId, teamId, ov);
  _wireHeader();
}

async function _gpSetPeriodContext(clubId, id, ctx) {
  try {
    const { error } = await window.sb.from('gps_period_reports').update({ work_context: ctx }).eq('club_id', clubId).eq('id', id);
    if (error) throw error;
    showToast(tt('gps_analysis.ctx_saved', 'Context updated'));
    window.cmInvalidateGpsCache?.();
    try { window.refreshDashboard?.(); } catch {}
  } catch (e) { showToast(tt('gps_analysis.ctx_failed', 'Failed: {msg}', { msg: e.message }), true); }
}

// ── 1. Export button ──────────────────────────────────────────
const exportBtn = document.querySelector('.gp-bar .right .cm-btn.is-outline');
exportBtn?.addEventListener('click', e => {
  e.stopPropagation();
  makePopover(exportBtn, [
    { label: tt('gps_analysis.export_pdf','PDF report'),         icon: 'ti-file-type-pdf', act: 'pdf' },
    { label: tt('gps_analysis.export_csv','CSV · current view'), icon: 'ti-table-export', act: 'csv' },
    { label: tt('gps_analysis.export_png','PNG snapshot'),       icon: 'ti-photo-down', act: 'png' },
    { label: tt('gps_analysis.export_share','Share link'),       icon: 'ti-link', act: 'share' },
  ], item => {
    if (item.act === 'csv') {
      const ths = [...document.querySelectorAll('.gp-view.is-on .gp-zt thead th')];
      const trs = [...document.querySelectorAll('.gp-view.is-on .gp-zt tbody tr')];
      if (!trs.length) { showToast(tt('gps_analysis.no_table_data','No table data in this view')); return; }
      const lines = [ths.map(h => `"${h.textContent.trim()}"`).join(',')];
      trs.forEach(tr => lines.push([...tr.querySelectorAll('td')].map(td => `"${td.textContent.trim().replace(/\s+/g,' ')}"`).join(',')));
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })),
        download: 'gps_export.csv',
      });
      a.click();
      showToast(tt('gps_analysis.csv_exported','CSV exported'));
    } else if (item.act === 'share') {
      navigator.clipboard.writeText(location.href).then(() => showToast(tt('gps_analysis.link_copied','Link copied')));
    } else {
      console.log('TODO:', item.act);
      showToast(tt('gps_analysis.coming_soon_item','{item} — coming soon',{item:item.label}));
    }
  });
});

// ── 2. Dashboard bar pills ────────────────────────────────────
document.querySelector('.gp-dash-bar')?.addEventListener('click', async e => {
  const pill = e.target.closest('.pill');
  if (!pill || pill.id === 'saveLayoutBtn') return;
  e.stopPropagation();
  const ic = pill.querySelector('.ti')?.className || '';

  // ── Date range pill ────────────────────────────────────────
  if (pill.id === 'dateRangePill') {
    const INP_STYLE = 'padding:5px 8px;border:1px solid var(--cm-border);border-radius:5px;background:var(--cm-bg-soft);color:var(--cm-fg);font:500 11px/1 var(--cm-font-sans);width:100%;box-sizing:border-box';
    const pop = document.createElement('div');
    pop.className = 'gp-popover';
    pop.style.minWidth = '220px';

    // Real seasons for a "pick a specific season" section (lazy, team-scoped). With 2+ seasons
    // the generic "Current season" heuristic isn't enough — the user needs to choose which one.
    let _seasons = Array.isArray(window.__gpSeasons) ? window.__gpSeasons : null;
    if (!_seasons) { try { _seasons = await _gpLoadSeasons(window._gpClubId || await window.getClubId(), window._gpTeamId || null); } catch { _seasons = []; } }

    const presets = [
      { preset: 'last7',         label: tt('gps_analysis.preset_last7','Last 7 days') },
      { preset: 'last30',        label: tt('gps_analysis.preset_last30','Last 30 days') },
      { preset: 'last90',        label: tt('gps_analysis.preset_last90','Last 90 days') },
      { preset: 'currentMC',     label: tt('gps_analysis.preset_current_microcycle','Current microcycle') },
      { preset: 'currentMonth',  label: tt('gps_analysis.preset_current_month','Current month') },
      { preset: 'currentSeason', label: tt('gps_analysis.preset_current_season','Current season') },
      { preset: 'allTime',       label: tt('gps_analysis.preset_all_time','All time') },
    ];
    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'gp-popover-item';
      btn.innerHTML = `<i class="ti ti-calendar" style="font-size:13px"></i>${p.label}`;
      if (window.gpState.datePreset === p.preset) btn.style.fontWeight = '700';
      btn.addEventListener('click', e => {
        e.stopPropagation(); closePop();
        window.gpState.datePreset = p.preset;
        document.getElementById('dateRangeLabel').textContent = getDatePresetLabel();
        saveGpsPrefs();
        window.renderView?.();
        window.refreshDashboard?.();
      });
      pop.appendChild(btn);
    });

    // ── Pick a specific season (real seasons rows) ──
    if (_seasons && _seasons.length) {
      const ssep = document.createElement('div'); ssep.className = 'gp-popover-sep'; pop.appendChild(ssep);
      const hdr = document.createElement('div');
      hdr.style.cssText = 'padding:4px 10px;font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em';
      hdr.textContent = tt('gps_analysis.filter_by_season','Season');
      pop.appendChild(hdr);
      _seasons.forEach(sn => {
        const b = document.createElement('button');
        b.className = 'gp-popover-item';
        b.innerHTML = `<i class="ti ti-calendar-stats" style="font-size:13px"></i>${_gpEsc(sn.name)} <span style="color:var(--cm-fg-muted);font-size:10px">(${sn.start_date} → ${sn.end_date})</span>`;
        if (window.gpState.datePreset === 'season' && String(window.gpState.seasonId) === String(sn.id)) b.style.fontWeight = '700';
        b.addEventListener('click', e => {
          e.stopPropagation(); closePop();
          Object.assign(window.gpState, { datePreset: 'season', seasonId: sn.id, seasonFrom: sn.start_date, seasonTo: sn.end_date, seasonName: sn.name });
          document.getElementById('dateRangeLabel').textContent = getDatePresetLabel();
          saveGpsPrefs();
          window.renderView?.();
          window.refreshDashboard?.();
        });
        pop.appendChild(b);
      });
    }

    const sep = document.createElement('div'); sep.className = 'gp-popover-sep'; pop.appendChild(sep);

    const customWrap = document.createElement('div');
    customWrap.style.cssText = 'padding:6px 10px 8px';
    const curFrom = window.gpState.datePreset === 'custom' ? (window.gpState.dateFrom || '') : '';
    const curTo   = window.gpState.datePreset === 'custom' ? (window.gpState.dateTo || '') : '';
    customWrap.innerHTML = `
      <div style="font:500 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Custom range</div>
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:7px">
        <input type="date" id="drFrom" value="${curFrom}" style="${INP_STYLE}">
        <span style="color:var(--cm-fg-muted);flex-shrink:0;font-size:11px">—</span>
        <input type="date" id="drTo" value="${curTo}" style="${INP_STYLE}">
      </div>
      <button id="drApply" style="width:100%;height:26px;border-radius:5px;border:1px solid var(--cm-accent);background:var(--cm-accent-soft);color:var(--cm-fg-strong);font:600 11.5px/1 var(--cm-font-sans);cursor:pointer">Apply</button>`;
    pop.appendChild(customWrap);

    customWrap.querySelector('#drApply').addEventListener('click', e => {
      e.stopPropagation();
      const f = customWrap.querySelector('#drFrom').value;
      const t = customWrap.querySelector('#drTo').value;
      if (!f || !t) { showToast('Select both dates'); return; }
      if (f > t) { showToast('From must be before To'); return; }
      closePop();
      window.gpState.datePreset = 'custom';
      window.gpState.dateFrom   = f;
      window.gpState.dateTo     = t;
      document.getElementById('dateRangeLabel').textContent = `${f} — ${t}`;
      saveGpsPrefs();
      window.renderView?.();
      window.refreshDashboard?.();
    });

    _posPopover(pop, pill);
    _pop = pop;
    return;
  }

  // ── MC pill ────────────────────────────────────────────────
  if (pill.id === 'mcPill') {
    const clubId = await window.getClubId();
    const { from, to } = getDateRange();
    const qry = window.sb.from('training_sessions')
      .select('session_date,microcycle_id').eq('club_id', clubId)
      .gte('session_date', from).lte('session_date', to)
      .order('session_date', { ascending: false }).limit(120);
    const { data: sessions } = await qry;
    const weeks = {};
    (sessions || []).forEach(s => {
      const d = new Date(s.session_date);
      const k = `MC ${getISOWeek(d)}`;
      if (!weeks[k]) weeks[k] = { label: k, date: s.session_date, mcId: s.microcycle_id || null };
    });
    const mcItems = [{ label: tt('gps_analysis.all_mcs','All MCs'), mc: 'All', mcId: null }, ...Object.values(weeks).slice(0, 12).map(w => ({ label: `${w.label}  ·  ${w.date}`, mc: w.label, mcId: w.mcId }))];
    makePopover(pill, mcItems, item => {
      window.gpState.microcycle = item.mc;
      window.gpState.mcId = item.mcId || null;
      document.getElementById('mcLabel').textContent = item.mc === 'All' ? tt('gps_analysis.all_mcs','All MCs') : item.mc;
      showToast(`Microcycle → ${item.mc}`);
      saveGpsPrefs();
      window.renderView?.();
    });
    return;
  }

  // ── Player pill ────────────────────────────────────────────
  if (pill.id === 'playerPill') {
    const clubId = await window.getClubId();
    const { data: players } = await _gpRoster(clubId, window._gpTeamId);
    if (!players?.length) { showToast(tt('gps_analysis.no_players_found','No players found')); return; }
    // Inject "All players" option into search popover via wrapper
    closePop();
    const pop = document.createElement('div');
    pop.className = 'gp-popover';
    pop.style.minWidth = '250px';
    const wrap = document.createElement('div');
    wrap.style.padding = '4px 4px 2px';
    const inp = document.createElement('input');
    inp.className = 'gp-pop-search'; inp.placeholder = 'Search player…';
    wrap.appendChild(inp); pop.appendChild(wrap);
    const list = document.createElement('div');
    list.style.cssText = 'max-height:220px;overflow-y:auto'; pop.appendChild(list);
    function renderPlList(q) {
      list.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.className = 'gp-popover-item';
      allBtn.textContent = tt('gps_analysis.filter_all_players','All players');
      allBtn.addEventListener('click', evt => {
        evt.stopPropagation(); closePop();
        window.gpState.playerId   = null;
        window.gpState.playerName = null;
        document.getElementById('playerLabel').textContent = tt('gps_analysis.filter_all_players','All players');
        saveGpsPrefs(); window.renderView?.();
      });
      list.appendChild(allBtn);
      const filt = q ? players.filter(p => `${p.first_name} ${p.last_name} ${p.position||''}`.toLowerCase().includes(q.toLowerCase())) : players;
      if (!filt.length && q) {
        const em = document.createElement('div');
        em.style.cssText = 'padding:8px 10px;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted)';
        em.textContent = tt('gps_analysis.no_players_found','No players found'); list.appendChild(em); return;
      }
      filt.slice(0, 20).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'gp-popover-item';
        btn.textContent = `${p.first_name[0]}. ${p.last_name} · #${p.number || '?'} · ${p.position || '—'}`;
        btn.addEventListener('click', evt => {
          evt.stopPropagation(); closePop();
          const name = `${p.first_name[0]}. ${p.last_name}`;
          window.gpState.playerId   = p.id;
          window.gpState.playerName = name;
          document.getElementById('playerLabel').textContent = name;
          showToast(`Player → ${name}`);
          saveGpsPrefs(); window.renderView?.();
        });
        list.appendChild(btn);
      });
    }
    renderPlList('');
    inp.addEventListener('input', () => renderPlList(inp.value));
    _posPopover(pop, pill); _pop = pop;
    requestAnimationFrame(() => inp.focus());
    return;
  }

  // ── Historical toggle pill ─────────────────────────────────
  if (pill.id === 'histPill') {
    window.gpState.includeHistorical = !window.gpState.includeHistorical;
    pill.classList.toggle('is-on', window.gpState.includeHistorical);
    const banner = document.getElementById('histBanner');
    // Banner only shown when auto-defaulted to historical; toggle manually hides it
    if (banner) banner.classList.remove('is-on');
    showToast(`Historical data → ${window.gpState.includeHistorical ? 'included' : 'excluded'}`);
    saveGpsPrefs();
    window.renderView?.();
    window.refreshDashboard?.();
    return;
  }

  // ── Saved views pill ───────────────────────────────────────
  if (ic.includes('ti-bookmark')) {
    const view = document.querySelector('.gp-view.is-on')?.dataset.view || 'ind';
    _svList(view).then(saved => {
      const svItems = [{ label: tt('gps_analysis.save_current_view','Save current view…'), icon: 'ti-device-floppy', action: 'save' }];
      if (saved.length) {
        svItems.push({ sep: true });
        saved.forEach(v => {
          svItems.push({ label: v.name, icon: 'ti-bookmark', action: 'load', data: v });
          svItems.push({ label: tt('gps_analysis.delete_view','Delete "{name}"',{name:v.name}), icon: 'ti-trash', action: 'delete', data: v });
        });
      }
      makePopover(pill, svItems, async item => {
        if (item.action === 'save') {
          const name = prompt(tt('gps_analysis.view_name_prompt','View name:'));
          if (!name?.trim()) return;
          await _svSave(view, name.trim());
        } else if (item.action === 'load') {
          await _svLoad(view, item.data.snapDid, item.data.name);
        } else if (item.action === 'delete') {
          await _svDelete(view, item.data.snapDid);
          showToast(tt('gps_analysis.view_deleted','View "{name}" deleted',{name:item.data.name}));
        }
      });
    }).catch(e => { console.error('_svList:', e); showToast(tt('gps_analysis.failed_load_views','Failed to load views'), true); });
    return;
  }

  // ── Add card pill → panel "Agregar gráfico" ─────────────────
  if (ic.includes('ti-plus')) {
    openAddChart();
  }
});

// ── 3. Add card buttons → panel "Agregar gráfico" (único punto de "agregar") ──
document.querySelectorAll('.gp-add').forEach(btn => btn.addEventListener('click', openAddChart));

// ── 4. Card menu (ti-dots) — delegated from .gp-page ─────────
document.querySelector('.gp-page')?.addEventListener('click', e => {
  const btn = e.target.closest('.gp-c-h .right > button');
  if (!btn?.querySelector('.ti-dots')) return;
  e.stopPropagation();
  const card = btn.closest('.gp-c');
  const isPwTable  = card?.id === 'card-pw-table';
  const isWkOnWk   = card?.id === 'card-weekly-bars';
  const isXmatch   = card?.id === 'card-xmatch';
  const isAcwr     = card?.id === 'card-acwr';
  makePopover(btn, [
    { label: tt('gps_analysis.card_menu_duplicate','Duplicate'),     icon: 'ti-copy', act: 'duplicate' },
    ...(!isPwTable && !isXmatch && !isAcwr ? [{ label: tt('gps_analysis.card_menu_change_metric','Change metric'), icon: 'ti-chart-bar', act: 'change_metric' }] : []),
    ...(isWkOnWk   ? [{ label: tt('gps_analysis.card_menu_edit_thresholds','Edit thresholds'), icon: 'ti-adjustments-horizontal', act: 'edit_thresholds' }] : []),
    ...(isXmatch   ? [{ label: tt('gps_analysis.card_menu_edit_metrics','Edit metrics'),    icon: 'ti-layout-list', act: 'edit_metrics' }] : []),
    { label: tt('gps_analysis.card_menu_remove','Remove'),        icon: 'ti-trash', act: 'remove' },
  ], item => {
    if (item.act === 'duplicate') {
      // Builder cards → clone the gp.card/v1 CONFIG + new id (persisted, editable
      // independently). Science cards keep the legacy DOM clone (not config-backed).
      if (_gpIsBuilderCard(card)) {
        const view = card.closest('.gp-view')?.dataset.view
                  || document.querySelector('.gp-view.is-on')?.dataset.view;
        const grid = card.closest('.gp-grid') || document.querySelector('.gp-view.is-on .gp-grid');
        _gpInsertConfigIntoView(card.__config, view, grid, _gpCardSize(card)).then(el => el && showToast(tt('gps_analysis.card_duplicated','Card duplicated')));
      } else {
        const clone = card.cloneNode(true);
        initSizeToggles(clone);
        card.after(clone);
        showToast(tt('gps_analysis.card_duplicated','Card duplicated'));
      }
    } else if (item.act === 'remove') {
      _gpRemoveCardCoherent(card);   // catalog → stash; custom/pasted → delete row. Same as Delete key.
    } else if (item.act === 'change_metric') {
      if (!card.dataset.cardId) { showToast(tt('gps_analysis.change_metric_na','Change metric not available for this card')); return; }
      openChangeMetricModal(card);
    } else if (item.act === 'edit_thresholds') {
      _openWkThreshEditor(card, btn);
    } else if (item.act === 'edit_metrics') {
      _openXmatchMetricsEditor(card, btn);
    } else {
      console.log('TODO:', item.act);
      showToast(tt('gps_analysis.coming_soon_item','{item} — coming soon',{item:item.label}));
    }
  });
});

// ── 4b. Direct-manipulation card editing — click a card body to edit it ───────
// No pencil: a short click on a card BODY opens that card's editor. gp-canvas.js calls
// this ONLY for genuine clicks (never a drag, never on an interactive control). Builder
// cards → the chart builder; science cards → their own editor; the rest → the "…" menu.
function _gpCardAnchor(card) { return card.querySelector('.gp-c-h .right > button') || card; }
window.gpOpenCardEditor = function (card) {
  if (!card || card.classList.contains('gp-add')) return;
  if (window._gpSelection && window._gpSelection.size > 1) return;   // multi-selection → no editor
  // 1) Builder / chart cards (gp.card/v1) → the chart builder.
  if (card.dataset.card === 'chart' || card.__config) { window.GpBuilder?.openForEdit?.(card); return; }
  // 2) Science cards with a dedicated editor → open it directly (what the pencil used to do).
  const ed = window._gpScEdit || {};
  const SCI = {
    'card-outliers':           () => ed.outliers && ed.outliers(),
    'card-sc-zscore-temporal': () => ed.zt && ed.zt(),
    'card-sc-vs-session':      () => ed.vs && ed.vs(),
    'card-weekly-bars':        () => _openWkThreshEditor(card, _gpCardAnchor(card)),
    'card-xmatch':             () => _openXmatchMetricsEditor(card, _gpCardAnchor(card)),
    'card-acwr':               () => _openAcwrMetricPicker(card.querySelector('[data-acwr-metric-pick]') || _gpCardAnchor(card), card),
  };
  if (SCI[card.id]) { SCI[card.id](); return; }
  // 3) Any other card → open its "…" menu (Duplicate / Change metric / Remove …).
  const dots = [...card.querySelectorAll('.gp-c-h .right > button')].find(b => b.querySelector('.ti-dots'));
  if (dots) dots.click();
};

// ── 4b·2. Selection model (Power BI / Figma) — single click selects, dbl-click edits ──
// A short click SELECTS a card (accent ring); double-click opens its editor. Only one card
// is selected at a time. Selection drives Cmd+C/X/V/D. Held in a live element ref (pasted
// cards may lack an id attribute), mirrored to window.__gpSelectedCardId for compatibility.
let _gpSelectedCard = null;
// MULTI-SELECT: the selection is a SET of card elements. size===1 is the classic single-select
// (keeps .gp-c-selected + _gpSelectedCard so the editor + Cmd+C/X/V/D keep working); size>=2 marks
// .is-multi-selected and clears _gpSelectedCard (editor/clipboard act on a single card only).
window._gpSelection = window._gpSelection || new Set();
let _gpMarquee = null;     // rubber-band state (declared here so the empty-canvas handler below can use it)
let _gpGroupDrag = null;   // group-drag state
let _gpGroupResize = null; // group-resize state (scale all selected cards from one card's handle)
function _gpSyncSelection() {
  const arr = [...window._gpSelection].filter(el => el && el.isConnected && !el.classList.contains('gp-add'));
  window._gpSelection = new Set(arr);
  document.querySelectorAll('.gp-c-selected, .gp-c.is-multi-selected')
    .forEach(c => c.classList.remove('gp-c-selected', 'is-multi-selected'));
  if (arr.length === 1) {
    arr[0].classList.add('gp-c-selected');
    _gpSelectedCard = arr[0];
    window.__gpSelectedCardId = arr[0].id || arr[0].dataset.cardId || null;
  } else {
    arr.forEach(el => el.classList.add('is-multi-selected'));
    _gpSelectedCard = null;
    window.__gpSelectedCardId = null;
  }
}
window.gpSelectCard = function (card) {
  if (!card || card.classList.contains('gp-add')) return;
  window._gpSelection = new Set([card]);
  _gpSyncSelection();
};
window.gpDeselectCards = function () {
  window._gpSelection = new Set();
  _gpSyncSelection();
};
// Grid metrics (px per column/row) — same formula as gp-canvas.gridMetrics, recomputed here so the
// group drag snaps to the SAME grid without touching the engine.
function _gpGridMetrics(grid) {
  const COLS = window.gpCanvas?.COLS || 12, ROW_PX = window.gpCanvas?.ROW_PX || 36;
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap || cs.gap) || 14;
  const rowGap = parseFloat(cs.rowGap || cs.gap) || 14;
  const colW = (grid.clientWidth - colGap * (COLS - 1)) / COLS;
  return { colStep: colW + colGap, rowStep: ROW_PX + rowGap, COLS };
}
// Double-click → open the editor (no need to select first). Same exclusions as drag/select
// so internal controls keep their own behavior.
document.addEventListener('dblclick', e => {
  const card = e.target.closest?.('.gp-c');
  if (!card || card.classList.contains('gp-add')) return;
  if (e.target.closest('button, a, select, input, textarea, [role=button], .gp-c-pick, .gp-c-picks, .gp-rh, .gp-kpi-actions')) return;
  e.preventDefault();
  window.gpSelectCard(card);
  window.gpOpenCardEditor(card);
});
// Pointerdown on empty dashboard area (not a card / control / panel / toolbar) → start a rubber-band
// MARQUEE. A plain click (no drag) deselects on pointerup (previous behaviour); a drag selects the
// intersected cards (Shift adds to the current selection).
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (e.button !== 0 || !t.closest) return;
  if (t.closest('.gp-c')) return;                                                    // a card → handled by the card pointerdown below
  if (t.closest('#gpbPanel, .gp-modal-overlay, .gp-popover, .gp-src-drawer, .gp-dash-bar, .hub-topbar, .hub-sidebar')) return;
  _gpMarquee = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, additive: e.shiftKey, moved: false, overlay: null };
  document.body.classList.add('gp-selecting'); try { window.getSelection().removeAllRanges(); } catch (_) {}
}, true);
// ESC → deselect; close transient card editors (popovers + the topmost modal). The builder
// panel owns its own ESC / click-outside (gp-builder.js).
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  window.gpDeselectCards();
  closePop();
  const ov = [...document.querySelectorAll('.gp-modal-overlay')].pop();
  if (ov) ov.remove();
});

// ── 4b·3. MULTI-SELECT: Cmd/Ctrl-click toggle + group drag (marquee finishes below) ──────────────
// Additive to the single-select engine: reuses window.gpCanvas.applyCoords (move) + saveLayout
// (persist, which already freezes ALL cards' coords). Does NOT touch gp-canvas.js and never
// reintroduces `span`. We only PRE-EMPT gp-canvas (stopPropagation) in the two multi cases below;
// every other press falls through untouched to the existing single-card path.
const _GP_CTRL_SEL = 'button, a, select, input, textarea, [role=button], .gp-c-pick, .gp-c-picks, .gp-rh, .gp-kpi-actions';
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !e.target.closest) return;
  const card = e.target.closest('.gp-c');
  if (!card || card.classList.contains('gp-add')) return;
  // Group RESIZE: grab a resize handle of a card in a 2+ selection → SCALE the whole group (each card
  // by the SAME factor, anchored at its own top-left, snapped + clamped). KPI cards (fixed size,
  // handles hidden) never participate. Any other handle press falls through to gp-canvas single-resize.
  const _rh = e.target.closest('.gp-rh');
  if (_rh) {
    if (window._gpSelection.has(card) && window._gpSelection.size >= 2) {
      const grid = card.closest('.gp-grid');
      if (grid && grid.classList.contains('is-canvas') && window.innerWidth > 1000) {
        const { colStep, rowStep, COLS } = _gpGridMetrics(grid);
        const cards = [...window._gpSelection]
          .filter(el => el.isConnected && el.closest('.gp-grid') === grid && !el.querySelector(':scope > .gp-c-b.gp-kpi'))
          .map(el => ({ el, x: +el.dataset.x || 0, y: +el.dataset.y || 0, w: +el.dataset.w || 2, h: +el.dataset.h || 3 }));
        const anchor = cards.find(c => c.el === card);
        if (anchor && cards.length >= 2) {
          e.stopPropagation();
          _gpGroupResize = { pointerId: e.pointerId, startPX: e.clientX, startPY: e.clientY, colStep, rowStep, COLS,
                             MINW: window.gpCanvas?.MINW || 2, MINH: window.gpCanvas?.MINH || 3,
                             dir: _rh.dataset.dir || 'se', aStartW: anchor.w, aStartH: anchor.h,
                             view: grid.closest('.gp-view')?.dataset.view, cards, moved: false };
          cards.forEach(c => c.el.classList.add('is-multi-dragging'));
          document.body.classList.add('gp-selecting'); try { window.getSelection().removeAllRanges(); } catch (_) {}
          try { _rh.setPointerCapture?.(e.pointerId); } catch (_) {}
        }
      }
    }
    return;   // handle press: handled as group, or left to gp-canvas's single resize
  }
  if (e.target.closest(_GP_CTRL_SEL)) return;   // other controls → engine / native behaviour
  // Cmd/Ctrl-click → toggle membership; no editor, no single-select.
  if (e.metaKey || e.ctrlKey) {
    e.stopPropagation();
    if (window._gpSelection.has(card)) window._gpSelection.delete(card); else window._gpSelection.add(card);
    _gpSyncSelection();
    return;
  }
  // Press on a card that's part of a 2+ selection → drag the WHOLE group.
  if (window._gpSelection.has(card) && window._gpSelection.size >= 2) {
    const grid = card.closest('.gp-grid');
    if (!grid || !grid.classList.contains('is-canvas') || window.innerWidth <= 1000) return;   // match gp-canvas canInteract
    e.stopPropagation();
    const { colStep, rowStep, COLS } = _gpGridMetrics(grid);
    const cards = [...window._gpSelection]
      .filter(el => el.isConnected && el.closest('.gp-grid') === grid)
      .map(el => ({ el, x: +el.dataset.x || 0, y: +el.dataset.y || 0, w: +el.dataset.w || 2, h: +el.dataset.h || 3 }));
    _gpGroupDrag = { pointerId: e.pointerId, startPX: e.clientX, startPY: e.clientY, colStep, rowStep, COLS,
                     view: grid.closest('.gp-view')?.dataset.view, anchor: card, cards, moved: false };
    cards.forEach(c => c.el.classList.add('is-multi-dragging'));
    document.body.classList.add('gp-selecting'); try { window.getSelection().removeAllRanges(); } catch (_) {}
    try { card.setPointerCapture(e.pointerId); } catch (_) {}
    return;
  }
  // Press on a card OUTSIDE an active multi-selection → collapse to just this card, then let
  // gp-canvas drag/select it as usual. Scoped to size>=2 so single-card use is byte-for-byte unchanged.
  if (window._gpSelection.size >= 2) window.gpSelectCard(card);   // no stopPropagation → engine handles the drag/click
}, true);

// ── 4b·4. CROSS-FILTER: click en un DATO de una card → setea el filtro en la BARRA ───────────────
// Mismo patrón que el bloque de arriba: capture-phase, y solo PRE-EMPTAMOS gp-canvas
// (stopPropagation) en el caso que nos toca — press que pega en un elemento de datos. Como
// gp-canvas escucha en BUBBLE, detener la propagación en capture evita que arme mvPending →
// ese click no selecciona ni arrastra la card. Cualquier press que NO pegue en un dato cae
// intacto al engine (drag / select / marquee / group). gp-canvas.js NO se toca.
// additive:false → cada click REEMPLAZA (la card fuente también se filtra, así que no quedan
// otros elementos que sumar). toggle:true → re-click en lo ya filtrado limpia.
// v1: scatter → `player` (el punto lleva `pid`).
// v2: barras → la dimensión de la card decide el filtro; el id sale de `fid` (aditivo del
//     resolver) vía chart.$gpCatFids[índice de categoría]. Sólo dimensión ÚNICA: una barra
//     compuesta ("Def · MC3") no mapea a un valor único → fid null ⇒ excluida.
const _GP_DIM2FILTER = { player_name:'player', position:'position', md_code:'md_code',
                         microcycle:'microcycle', rival:'rival' };   // session_date → fuera de v2
// v2b: tabla → sólo la celda de la DIMENSIÓN (lleva data-fid) es clickeable; las celdas de
//      valor no pre-emptan, así la card table se sigue arrastrando por el cuerpo.
// Dimensión efectiva de una card (barras/tabla): sin dimensiones el resolver agrupa por jugador.
function _gpCardFilterKey(config) {
  const dims = (config && config.dimensions) || [];
  if (dims.length === 0) return 'player';
  if (dims.length !== 1) return null;                 // compuesta → no cross-filtrable
  return _GP_DIM2FILTER[dims[0].id] || null;          // session_date/drill/… → null
}
let _gpXFilter = null;
const _gpXClear = () => { _gpXFilter = null; };
document.addEventListener('pointerdown', e => {
  _gpXFilter = null;
  if (e.button !== 0 || !e.target.closest) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // modificadores → multi-select / marquee
  // TABLA: sólo la celda de dimensión (data-fid, escrita por mountTableCard). Un press en una
  // celda de valor / header / chip NO matchea → return → engine intacto (drag, sort, selección
  // de texto, scroll). Elegibilidad completa ANTES de pre-emptar, igual que en los charts.
  const cell = e.target.closest('td[data-fid]');
  if (cell) {
    const tCard = cell.closest('.gp-c'); if (!tCard) return;
    const tKey = _gpCardFilterKey(tCard.__config);
    const tVal = cell.getAttribute('data-fid');
    if (!tKey || !tVal) return;        // no cross-filtrable → engine de siempre
    e.stopPropagation();               // pre-empt gp-canvas SOLO en esta celda
    _gpXFilter = { pointerId: e.pointerId, fkey: tKey, fval: tVal, startX: e.clientX, startY: e.clientY };
    return;
  }
  const canvas = e.target.closest('canvas'); if (!canvas) return;
  const card = canvas.closest('.gp-c'); if (!card || card.classList.contains('gp-add')) return;
  const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(canvas) : null;
  if (!chart) return;
  const viz = card.__config && card.__config.viz;
  if (viz !== 'scatter' && viz !== 'bars') return;    // resto de vizzes: sin cross-filter
  // ZOOM AL GRUPO (Fase B): en barras anidadas, un press sobre el CORCHETE del piso superior
  // NO es cross-filter, es zoom LOCAL de la card (no toca la barra compartida). Se testea
  // ANTES de la barra: el corchete vive fuera del chartArea, así que getElementsAtEventForMode
  // no lo devolvería. offsetX/Y del canvas == espacio en que el plugin registró las regiones.
  if (viz === 'bars' && chart.$gpNested) {
    const brk = window.gpBarBracketAt && window.gpBarBracketAt(chart, e.offsetX, e.offsetY);
    if (brk != null) {
      e.stopPropagation();             // pre-empt gp-canvas: no selecciona ni arrastra la card
      _gpXFilter = { pointerId: e.pointerId, kind: 'zoom', card, group: brk, startX: e.clientX, startY: e.clientY };
      return;
    }
  }
  // Chart.js 4.x: getRelativePosition lee offsetX/offsetY del evento y un PointerEvent los trae
  // → getElementsAtEventForMode funciona con pointerdown sin convertir nada.
  let hit = null;
  try { hit = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)[0] || null; }
  catch (_) { return; }
  if (!hit) return;                    // área vacía del chart → engine de siempre (drag/select)
  // Elegibilidad COMPLETA acá, ANTES de pre-emptar: si no vamos a filtrar de verdad, no hay
  // que robarle el evento al engine. (Si no, el click quedaría en un hueco muerto: pre-emptado
  // ⇒ no selecciona la card, y sin id ⇒ tampoco filtra.)
  let fkey = null, fval = null;
  if (viz === 'scatter') {
    const _ds  = chart.data && chart.data.datasets && chart.data.datasets[hit.datasetIndex];
    const _raw = _ds && _ds.data && _ds.data[hit.index];
    if (_raw && _raw.pid) { fkey = 'player'; fval = _raw.pid; }
  } else {                             // bars: hit.index = índice de CATEGORÍA
    const k = _gpCardFilterKey(card.__config);
    const f = chart.$gpCatFids && chart.$gpCatFids[hit.index];
    if (k && f != null) { fkey = k; fval = f; }
  }
  if (!fkey || fval == null) return;    // no cross-filtrable → engine de siempre
  e.stopPropagation();                 // pre-empt gp-canvas (bubble): sin mvPending → sin select/drag
  _gpXFilter = { pointerId: e.pointerId, fkey, fval, startX: e.clientX, startY: e.clientY };
}, true);
// Filtrar en pointerup y SOLO si fue un click real (<5px). Si el usuario arrastró desde el punto,
// el gesto muere acá sin filtrar (y sin mover: ya pre-emptamos). No usamos setPointerCapture, así
// que no hay captura que liberar; el único estado es _gpXFilter y se limpia en TODOS los caminos.
document.addEventListener('pointerup', e => {
  const g = _gpXFilter; _gpXFilter = null;
  if (!g || e.pointerId !== g.pointerId) return;
  const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
  if (dx * dx + dy * dy > 25) return;                       // >5px → gesto abortado, no filtra
  if (g.kind === 'zoom') {
    // Toggle LOCAL de la card (no toca la barra). Re-click en el grupo ya zoomeado → salir.
    const card = g.card; if (!card || !card.__config) return;
    card.__zoomGroup = (String(card.__zoomGroup) === String(g.group)) ? null : g.group;
    window.GpBuilder && window.GpBuilder.resolveAndRenderCard &&
      window.GpBuilder.resolveAndRenderCard(card, card.__config);
    return;
  }
  window.gpFilterBar && window.gpFilterBar.setValue &&
    window.gpFilterBar.setValue(g.fkey, g.fval, { additive: false, toggle: true });
}, true);
document.addEventListener('pointercancel', _gpXClear, true);
document.addEventListener('lostpointercapture', _gpXClear, true);

document.addEventListener('pointermove', e => {
  if (_gpGroupResize && e.pointerId === _gpGroupResize.pointerId) {
    const g = _gpGroupResize;
    const dCol = Math.round((e.clientX - g.startPX) / g.colStep);
    const dRow = Math.round((e.clientY - g.startPY) / g.rowStep);
    const dW = g.dir.includes('e') ? dCol : g.dir.includes('w') ? -dCol : 0;   // top-left anchored: size only
    const dH = g.dir.includes('s') ? dRow : g.dir.includes('n') ? -dRow : 0;
    const scaleW = Math.max(g.MINW, g.aStartW + dW) / g.aStartW;   // factor from the grabbed card
    const scaleH = Math.max(g.MINH, g.aStartH + dH) / g.aStartH;
    if (dW || dH) g.moved = true;
    g.cards.forEach(c => {
      const nw = Math.max(g.MINW, Math.min(Math.round(c.w * scaleW), g.COLS - c.x));   // each clamped to its own min / grid
      const nh = Math.max(g.MINH, Math.round(c.h * scaleH));
      window.gpCanvas?.applyCoords?.(c.el, { x: c.x, y: c.y, w: nw, h: nh });
    });
    return;
  }
  if (_gpGroupDrag && e.pointerId === _gpGroupDrag.pointerId) {
    const g = _gpGroupDrag;
    const dCol = Math.round((e.clientX - g.startPX) / g.colStep);
    const dRow = Math.round((e.clientY - g.startPY) / g.rowStep);
    if (dCol || dRow) g.moved = true;
    g.cards.forEach(c => {                                     // per-card clamp — each stays in-grid; overlaps allowed (as single-card today)
      const nx = Math.max(0, Math.min(c.x + dCol, g.COLS - c.w));
      const ny = Math.max(0, c.y + dRow);
      window.gpCanvas?.applyCoords?.(c.el, { x: nx, y: ny, w: c.w, h: c.h });
    });
    return;
  }
  if (_gpMarquee && e.pointerId === _gpMarquee.pointerId) {
    const m = _gpMarquee;
    if (Math.abs(e.clientX - m.startX) > 4 || Math.abs(e.clientY - m.startY) > 4) m.moved = true;
    if (!m.moved) return;
    if (!m.overlay) { m.overlay = document.createElement('div'); m.overlay.className = 'gp-marquee'; document.body.appendChild(m.overlay); }
    const x = Math.min(e.clientX, m.startX), y = Math.min(e.clientY, m.startY);
    const w = Math.abs(e.clientX - m.startX), h = Math.abs(e.clientY - m.startY);
    m.overlay.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const grid = document.querySelector('.gp-view.is-on .gp-grid');
    if (grid) grid.querySelectorAll('.gp-c:not(.gp-add)').forEach(cardEl => {
      const r = cardEl.getBoundingClientRect();
      cardEl.classList.toggle('is-marquee-hit', !(r.right < x || r.left > x + w || r.bottom < y || r.top > y + h));
    });
  }
});

function _gpMultiPointerUp(e) {
  document.body.classList.remove('gp-selecting');   // re-enable text selection after any gesture ends
  if (_gpGroupResize && (e.pointerId == null || e.pointerId === _gpGroupResize.pointerId)) {
    const g = _gpGroupResize; _gpGroupResize = null;
    g.cards.forEach(c => c.el.classList.remove('is-multi-dragging'));
    if (g.moved && g.view && typeof window.saveLayout === 'function') window.saveLayout(g.view).catch(() => {});
  }
  if (_gpGroupDrag && (e.pointerId == null || e.pointerId === _gpGroupDrag.pointerId)) {
    const g = _gpGroupDrag; _gpGroupDrag = null;
    g.cards.forEach(c => c.el.classList.remove('is-multi-dragging'));
    if (g.moved && g.view && typeof window.saveLayout === 'function') window.saveLayout(g.view).catch(() => {});
    else if (!g.moved) window.gpSelectCard(g.anchor);          // click (no drag) on a grouped card → collapse to single
  }
  if (_gpMarquee && (e.pointerId == null || e.pointerId === _gpMarquee.pointerId)) {
    const m = _gpMarquee; _gpMarquee = null;
    if (m.overlay) m.overlay.remove();
    const grid = document.querySelector('.gp-view.is-on .gp-grid');
    if (m.moved && grid) {
      const hits = [...grid.querySelectorAll('.gp-c.is-marquee-hit')];
      grid.querySelectorAll('.is-marquee-hit').forEach(c => c.classList.remove('is-marquee-hit'));
      if (!m.additive) window._gpSelection = new Set();
      hits.forEach(c => window._gpSelection.add(c));
      _gpSyncSelection();
    } else {
      window.gpDeselectCards();                                // plain click on empty canvas → deselect (previous behaviour)
    }
  }
}
document.addEventListener('pointerup', _gpMultiPointerUp, true);
document.addEventListener('pointercancel', _gpMultiPointerUp, true);
document.addEventListener('lostpointercapture', _gpMultiPointerUp, true);

// ── 4c. Copy / cut / paste builder cards (Cmd/Ctrl + C / X / V) ───────────────
// Operates on the gp.card/v1 CONFIG (the source of truth), not the DOM node. Internal
// clipboard (window.__gpCardClipboard) survives view switches in-session. Science cards
// are not gp.card/v1 → excluded. The active target is the last card clicked/hovered.
window.__gpCardClipboard = window.__gpCardClipboard || null;
window.__gpSelectedCardId = window.__gpSelectedCardId || null;
// Copy/cut/paste/duplicate operate on the SELECTED card (single click), held as a live
// element ref (pasted cards may lack an id attribute), with an id fallback.
function _gpActiveCard() {
  if (_gpSelectedCard && _gpSelectedCard.isConnected) return _gpSelectedCard;
  return window.__gpSelectedCardId ? document.getElementById(window.__gpSelectedCardId) : null;
}
function _gpIsBuilderCard(card) {
  return !!card && card.dataset.card === 'chart' && card.__config && card.__config.schema === 'gp.card/v1';
}
// Snapshot the free-canvas geometry of a card (lives in the DOM, NOT in __config).
function _gpCardSize(card) {
  if (!card) return null;
  const num = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  return { w: num(card.dataset.w), h: num(card.dataset.h),
           x: num(card.dataset.x), y: num(card.dataset.y),
           dataSize: card.dataset.size || null };
}
// Place a freshly-built card BESIDE the source (right; else first free row in its column),
// clamped to the canvas, reusing the captured w/h. Explicit coords → the canvas engine
// keeps them (toCanvasLayout respects coords) instead of auto-flowing to a default size.
function _gpPlacePasted(el, grid, size) {
  if (!size || (!size.w && !size.h)) return;
  const C = (window.gpCanvas && window.gpCanvas.COLS) || 12;
  const w = size.w || parseInt(el.dataset.w, 10) || 6;
  const h = size.h || parseInt(el.dataset.h, 10) || 7;
  const sx = Number.isFinite(size.x) ? size.x : 0;
  const sy = Number.isFinite(size.y) ? size.y : 0;
  const occ = [...grid.querySelectorAll(':scope > .gp-c')].filter(c => c !== el)
    .map(c => ({ x: +c.dataset.x, y: +c.dataset.y, w: +c.dataset.w, h: +c.dataset.h }))
    .filter(r => [r.x, r.y, r.w, r.h].every(Number.isFinite));
  const free = (x, y) => x >= 0 && x + w <= C && !occ.some(r => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
  let x, y;
  if (free(sx + w, sy)) { x = sx + w; y = sy; }                    // beside (right)
  else { x = Math.max(0, Math.min(sx, C - w)); y = sy; let g = 0; while (!free(x, y) && g++ < 500) y++; }  // first free row below
  if (window.gpCanvas?.applyCoords) window.gpCanvas.applyCoords(el, { x, y, w, h });
  else { el.dataset.x = x; el.dataset.y = y; el.dataset.w = w; el.dataset.h = h; }
  if (size.dataSize) el.dataset.size = size.dataSize;
}
// Insert a config as a NEW card into a view's grid: persist → build DOM → size+place → render.
async function _gpInsertConfigIntoView(srcConfig, view, grid, size) {
  if (!srcConfig || !view || !grid) return null;
  const config = (typeof structuredClone === 'function') ? structuredClone(srcConfig) : JSON.parse(JSON.stringify(srcConfig));
  delete config.id;
  let newId = null;
  try {
    const clubId = window._gpClubId || await window.getClubId?.();
    const uid = await window.gpsGetUserId?.();
    if (clubId && window.saveDashboardCard) newId = await window.saveDashboardCard(config, clubId, view, uid, window.sb);
  } catch (e) { console.warn('paste/duplicate persist:', e); }
  newId = newId || ('paste-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  const el = window.gpBuildBuilderCardEl(config, newId);
  // Keep the source's size and drop it beside the original (coords set BEFORE append so the
  // canvas engine respects them). Without a size, fall back to the auto-flow default.
  _gpPlacePasted(el, grid, size);
  const addBtn = grid.querySelector('.gp-add');
  if (addBtn) grid.insertBefore(el, addBtn); else grid.appendChild(el);
  const clubId = window._gpClubId || await window.getClubId?.();
  if (window.GpBuilder?.resolveAndRenderCard) window.GpBuilder.resolveAndRenderCard(el, config);
  else if (typeof _resolveAndRenderSavedCard === 'function') _resolveAndRenderSavedCard(el, config, clubId).catch(() => {});
  if (config.viz === 'kpi') window.gpbStripKpiHeader?.(el);
  saveLayout(view).catch(() => {});
  return el;
}
function _gpCopyCard(card) {
  if (!_gpIsBuilderCard(card)) return false;
  const cfg = (typeof structuredClone === 'function') ? structuredClone(card.__config) : JSON.parse(JSON.stringify(card.__config));
  delete cfg.id;
  window.__gpCardClipboard = { cfg, size: _gpCardSize(card) };   // size lives in the DOM, not cfg
  return true;
}
// Coherent removal — single source of truth for the "…" Remove, Cmd+X and the Delete key.
// Catalog (HTML) cards → stash + saveLayout (recoverable via Add card). Custom/pasted cards
// → remove + delete their dashboard_cards row. Always clears selection + persists layout.
function _gpRemoveCardCoherent(card, opts) {
  if (!card) return;
  const silent = opts && opts.silent;
  const view = card.closest('.gp-view')?.dataset.view || document.querySelector('.gp-view.is-on')?.dataset.view;
  const defs = GP_CARD_DEFS[view] || [];
  // Card de catálogo = la que vive en el HTML, la reconozca o no ESTE dashboard: desde que se
  // pueden mover entre dashboards, mirar sólo el catálogo de la vista activa la dejaba fuera del
  // stash (se borraba del DOM y no había forma de recuperarla).
  const isCatalogCard = !!card.id
    && (defs.some(d => d.id === card.id) || _STATIC_CARD_OWNER.has(card.dataset.cardId || ''));
  // Estaba anotada en un dashboard propio → esa fila se va con ella.
  const rowId = card.dataset.rowId;
  if (rowId && window.deleteDashboardCard && window.sb) {
    window.deleteDashboardCard(rowId, window.sb).catch(e => console.warn('remove (fila adoptada):', e));
    delete card.dataset.rowId;
  }
  if (card === _gpSelectedCard) window.gpDeselectCards();
  if (isCatalogCard) {
    _cardStash.set(card.id, card);
    card.remove();
    if (!silent) showToast('Card removed — recoverable via Add card');
  } else {
    const cid = card.dataset.cardId;
    card.remove();
    if (window.deleteDashboardCard && cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
      window.deleteDashboardCard(cid, window.sb).catch(e => console.warn('deleteDashboardCard:', e));
    }
    if (!silent) showToast('Card removed');
  }
  if (view) saveLayout(view).catch(e => console.warn('saveLayout on remove:', e));
}
async function _gpPasteCard() {
  const clip = window.__gpCardClipboard;
  if (!clip) return;
  const cfg  = clip.cfg || clip;            // tolerate an older flat-config clipboard
  const size = clip.size || null;
  const view = document.querySelector('.gp-view.is-on')?.dataset.view;
  const grid = document.querySelector('.gp-view.is-on .gp-grid');
  if (!view || !grid) { showToast('No active dashboard', true); return; }
  const el = await _gpInsertConfigIntoView(cfg, view, grid, size);
  if (el) showToast('Card pasted');
}
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== 'c' && k !== 'x' && k !== 'v') return;
  const t = e.target;
  // never hijack typing, nor fire while a modal / the builder panel / the source drawer is open
  if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelector('.gp-modal-overlay, .es-panel.is-open, .gp-src-drawer.is-open')) return;
  if (k === 'v') {
    if (!window.__gpCardClipboard) return;          // nothing to paste → let the OS handle it
    e.preventDefault(); _gpPasteCard(); return;
  }
  // C / X need a builder-card target; let real text selections copy normally
  if (k === 'c' && window.getSelection && String(window.getSelection()).trim()) return;
  const card = _gpActiveCard();
  if (!card) return;
  if (!_gpIsBuilderCard(card)) {
    if (card.classList.contains('gp-c')) { e.preventDefault(); showToast('Only builder cards can be copied'); }
    return;
  }
  e.preventDefault();
  if (k === 'c') { if (_gpCopyCard(card)) showToast('Card copied'); }
  else { if (_gpCopyCard(card)) { _gpRemoveCardCoherent(card, { silent: true }); showToast('Card cut'); } }
});
// Cmd/Ctrl+D = duplicate (config + new id). While the BUILDER is open → duplicate the
// in-progress config (the brief's "Duplicate inside the builder"). Otherwise → duplicate
// the SELECTED card. Never hijacks typing.
document.addEventListener('keydown', async e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'd') return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const builderOpen = !!document.querySelector('.es-panel.is-open');
  if (builderOpen) {
    const cfg = window.GpBuilder?.currentConfig?.();
    if (!cfg) return;
    e.preventDefault();
    const view = document.querySelector('.gp-view.is-on')?.dataset.view;
    const grid = document.querySelector('.gp-view.is-on .gp-grid');
    const el = await _gpInsertConfigIntoView(cfg, view, grid, _gpCardSize(_gpActiveCard()));
    if (el) showToast('Card duplicated');
    return;
  }
  const card = _gpActiveCard();
  if (!_gpIsBuilderCard(card)) return;
  e.preventDefault();
  const view = card.closest('.gp-view')?.dataset.view || document.querySelector('.gp-view.is-on')?.dataset.view;
  const grid = card.closest('.gp-grid') || document.querySelector('.gp-view.is-on .gp-grid');
  const el = await _gpInsertConfigIntoView(card.__config, view, grid, _gpCardSize(card));
  if (el) showToast('Card duplicated');
});
// Delete / Backspace → remove the SELECTED card (reuses the coherent Remove logic).
// Never when typing in a field, or while a modal / builder / drawer is open.
document.addEventListener('keydown', e => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelector('.gp-modal-overlay, .es-panel.is-open, .gp-src-drawer.is-open')) return;
  const card = _gpActiveCard();
  if (!card || !card.classList.contains('gp-c')) return;
  e.preventDefault();
  _gpRemoveCardCoherent(card);
});

// ── 5. Z-score matrix sort ────────────────────────────────────
let _zSortBtn = null;
document.querySelectorAll('.gp-c-h .right > button').forEach(b => { if (b.querySelector('.ti-arrows-sort')) _zSortBtn = b; });
if (_zSortBtn) {
  let _zSt = { col: 0, dir: 1 };
  _zSortBtn.addEventListener('click', e => {
    const Z_COLS = ['Player', ...(typeof _getChartMetrics === 'function' ? _getChartMetrics() : []).map(d => d.label)];
    e.stopPropagation();
    _zSt.dir *= -1;
    if (_zSt.dir === 1) _zSt.col = (_zSt.col + 1) % Z_COLS.length;
    const tbody = document.querySelector('.gp-view[data-view="grp"] .gp-zt tbody');
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr')];
    rows.sort((a, b) => {
      const v = tr => {
        const cells = tr.querySelectorAll('td');
        if (_zSt.col === 0) return cells[0]?.querySelector('.gp-mn')?.textContent || '';
        return parseFloat(cells[_zSt.col]?.querySelector('.gp-zc')?.textContent) || 0;
      };
      const va = v(a), vb = v(b);
      return _zSt.dir * (typeof va === 'string' ? va.localeCompare(vb) : va - vb);
    });
    rows.forEach(r => tbody.appendChild(r));
    showToast(`Sort: ${Z_COLS[_zSt.col]} ${_zSt.dir > 0 ? '↑' : '↓'}`);
  });
}

// ── 6. .gp-c-pick chips — delegated from .gp-page ────────────
document.querySelector('.gp-page')?.addEventListener('click', e => {
  // Unpin ✕ inside a player chip: clear the pin (runs before the chevron guard below,
  // since the pinned chip's ✕ is not a chevron).
  const unpin = e.target.closest('[data-card-unpin]');
  if (unpin) { e.stopPropagation(); _unpinCardPlayer(unpin.closest('.gp-c')); return; }
  const pick = e.target.closest('.gp-c-pick');
  if (!pick?.querySelector('.ti-chevron-down')) return;
  e.stopPropagation();
  const txt = pick.textContent.trim();

  // Per-card player pick (builder cards with scope.level='player')
  if (pick.hasAttribute('data-card-player-pick')) {
    _openCardPlayerPicker(pick, pick.closest('.gp-c'));
    return;
  }

  // ACWR base-metric pick — dropdown dentro del chart (no en el menú ⋯)
  if (pick.hasAttribute('data-acwr-metric-pick')) {
    _openAcwrMetricPicker(pick, pick.closest('.gp-c'));
    return;
  }

  // Weekly bars metric pick — resolved by attribute, not text
  if (pick.hasAttribute('data-wb-metric-pick')) {
    const cat  = window._gpCatalog || [];
    const opts = cat.length
      ? cat.filter(d => !['time_played','distance_per_minute'].includes(d.key)).map(d => ({ label: d.label, metric: d.key }))
      : [{ label: 'Player load', metric: 'player_load' },{ label: 'Total Distance', metric: 'total_distance' },{ label: 'HSR', metric: 'high_speed_distance' }];
    makePopover(pick, opts, item => {
      const wbCard = document.getElementById('card-weekly-bars');
      if (wbCard) wbCard.dataset.metricKey = item.metric;
      renderWeeklyBars(window.gpState).catch(e => console.warn('renderWeeklyBars:', e));
      saveLayout('ind');
      showToast(`Weekly bars → ${item.label}`);
    });
    return;
  }

  if (/Role|Squad|Self|Match peak/i.test(txt)) {
    makePopover(pick, ['vs Role','vs Squad','vs Self (28d)','vs Match peak'].map(m => ({ label: m })), item => {
      // Legacy static-card label only. Comparison is NOT global anymore — it lives per card
      // in config.comparison (builder Comparison dropdown). This picker no longer mutates state.
      pick.innerHTML = `${item.label} <i class="ti ti-chevron-down"></i>`;
    });
  } else if (/MC\s*\d+\s*vs/i.test(txt)) {
    makePopover(pick, ['MC 14 vs MC 13','MC 13 vs MC 12','MC 12 vs MC 11'].map(m => ({ label: m })), item => {
      pick.innerHTML = `${item.label} <i class="ti ti-chevron-down"></i>`;
      // TODO: re-render weekly bars comparison
    });
  } else if (/Bars|Lines/i.test(txt)) {
    makePopover(pick, [{ label: 'Bars' }, { label: 'Lines' }], item => {
      pick.innerHTML = `${item.label} <i class="ti ti-chevron-down"></i>`;
      // TODO: switch chart type
    });
  } else if (/Player load|HSR|Distance|Sprints|Accelerations|Decel|Max speed|VHSR|HMLD/i.test(txt)) {
    const _catalog = window._gpCatalog || [];
    const RANK_OPTS = _catalog.length
      ? _catalog
          .filter(d => !['time_played','distance_per_minute','sprint_count'].includes(d.key))
          .map(d => ({ label: d.label, metric: d.key }))
      : [
          { label: 'HSR',           metric: 'high_speed_distance' },
          { label: 'Total dist',    metric: 'total_distance' },
          { label: 'Sprints',       metric: 'sprint_distance' },
          { label: 'VHSR',          metric: 'very_high_speed_distance' },
          { label: 'Player load',   metric: 'player_load' },
          { label: 'Accelerations', metric: 'accelerations' },
          { label: 'Max speed',     metric: 'max_speed' },
          { label: 'HMLD',          metric: 'hmld' },
        ];
    makePopover(pick, RANK_OPTS.map(o => ({ label: o.label, metric: o.metric })), item => {
      pick.innerHTML = `${_gpEsc(item.label)} <i class="ti ti-chevron-down"></i>`;
      pick.classList.add('is-accent');
      if (pick.closest('#card-squad-rank') && window._gpReports?.length) {
        _updateSquadRanking(window._gpReports, item.metric);
      }
      if (pick.closest('#card-weekly-bars')) {
        const wbCard = document.getElementById('card-weekly-bars');
        if (wbCard) wbCard.dataset.metricKey = item.metric;
        renderWeeklyBars(window.gpState).catch(e => console.warn('renderWeeklyBars:', e));
        saveLayout('ind');
      }
      showToast(`Metric → ${item.label}`);
    });
  } else {
    showToast('Configuration — coming soon');
  }
});

// ── 7. Drawer buttons ─────────────────────────────────────────
const _drops = document.querySelectorAll('.gp-drop');

// Download template
_drops[0]?.querySelector('.cm-btn.is-ghost')?.addEventListener('click', e => {
  e.stopPropagation();
  const csv = 'player_name,session_date,total_distance,high_speed_distance,sprint_distance,accelerations,decelerations,max_speed,player_load\n';
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: 'gps_template.csv',
  });
  a.click();
  showToast('Template downloaded');
});

// Sync now
const _syncBtn = _drops[1]?.querySelector('.cm-btn.is-outline');
_syncBtn?.addEventListener('click', e => {
  e.stopPropagation();
  _syncBtn.disabled = true;
  const orig = _syncBtn.innerHTML;
  _syncBtn.innerHTML = '<i class="ti ti-loader-2" style="font-size:14px;animation:gp-spin 1s linear infinite"></i> Syncing…';
  setTimeout(() => { _syncBtn.innerHTML = orig; _syncBtn.disabled = false; showToast('Sync complete · no new files'); }, 1500);
});

// Webhook settings
_drops[1]?.querySelector('.cm-btn.is-ghost')?.addEventListener('click', async e => {
  e.stopPropagation();
  const clubId = (await window.getClubId()) || 'YOUR_CLUB_ID';
  const modal = makeModal('Webhook settings', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <p style="font:500 12.5px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0">Point your GPS provider's webhook to this endpoint. Each POST auto-imports a GPS session.</p>
      <div>
        <label style="display:block;font:600 11px/1 var(--cm-font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--cm-fg-muted);margin-bottom:6px">Endpoint URL</label>
        <input id="gp-webhook-url" readonly onclick="this.select()"
          style="width:100%;padding:9px 12px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-mono);box-sizing:border-box">
      </div>
      <p style="font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin:0">Provider selector and secret key configuration — coming soon.</p>
    </div>`);
  modal.querySelector('#gp-webhook-url').value = `https://api.clavametrics.app/webhooks/gps/${clubId}`;
});

// ── 8. Provider cards ─────────────────────────────────────────
document.querySelector('.gp-conns')?.addEventListener('click', e => {
  const card = e.target.closest('.gp-conn');
  if (!card) return;
  const name = card.querySelector('h5')?.textContent || 'Provider';
  console.log('Connect flow:', name);
  showToast(`${name} — connect flow coming soon`);
});

// Build a builder-card (.gp-c) DOM element from a gp.card/v1 config. Single source of
// truth for both the saved-card mount loop and copy/paste/duplicate. Wires the size-toggle
// and the ✕ delete (removes DOM + its dashboard_cards row when persisted). Editing is via
// click-to-edit (no pencil). The caller appends it and triggers the render.
window.gpBuildBuilderCardEl = function (config, cardId) {
  const el = document.createElement('div');
  el.className = 'gp-c';
  el.dataset.size     = config.style?.size || 'md';
  el.dataset.card     = 'chart';
  el.dataset.cardId   = cardId;
  el.__config         = config;
  el.style.setProperty('--cm-accent', config.style?.color || '#15803D');
  // KPI cards render WITHOUT the .gp-c-h header (the tile carries its own label); their
  // ✕ lives in a floating overlay. Charts/tables keep the full header.
  const _isKpi = config.viz === 'kpi';
  const _safeTitle = (config.title || config.viz || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  if (_isKpi) el.dataset.cardTitle = config.title || '';   // keep title for example-card dedup
  el.innerHTML = _isKpi
    ? `<div class="gp-kpi-actions">
            <button data-del title="Remove card"><i class="ti ti-x"></i></button>
      </div>
      <div class="gp-c-b">
        <div class="cb2-state load" style="min-height:100px"><div class="cb2-spin"></div><div class="t">Loading…</div></div>
      </div>`
    : `<div class="gp-c-h">
        <span class="ttl">${_safeTitle}</span>
        <span class="sub">${config.viz || ''} · ${config.scope?.level || ''}</span>
        <div class="right">
          <div class="size-toggle">
            <button>S</button><button>M</button><button>L</button><button style="width:30px">FULL</button>
          </div>
          <button data-del title="Remove card"><i class="ti ti-x"></i></button>
        </div>
      </div>
      <div class="gp-c-b" style="min-height:160px;align-items:center;justify-content:center">
        <div class="cb2-state load" style="min-height:120px"><div class="cb2-spin"></div><div class="t">Loading…</div></div>
      </div>`;
  // sync size-toggle selection (charts only; KPI has no toggle)
  const sizeMap = { sm:'S', md:'M', lg:'L', full:'FULL' };
  el.querySelectorAll('.size-toggle button').forEach(b =>
    b.classList.toggle('is-on', b.textContent.trim() === (sizeMap[el.dataset.size] || 'M')));
  // delete → remove DOM + its dashboard_cards row (only when it's a persisted UUID)
  el.querySelector('[data-del]')?.addEventListener('click', () => {
    const cid = el.dataset.cardId;
    el.remove();
    if (window.deleteDashboardCard && cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
      window.deleteDashboardCard(cid, window.sb).catch(e => console.warn('deleteDashboardCard:', e));
    }
    const v = document.querySelector('.gp-view.is-on')?.dataset.view;
    if (v) saveLayout(v).catch(() => {});
  });
  return el;
};

// ── GPS Builder Fase 2: mount saved builder cards onto each view's grid ──
// Dual-read: existing predefined cards (HTML) stay unchanged.
// Builder cards stored in dashboard_cards are appended to the same grid.
async function _mountSavedBuilderCards(clubId) {
  if (!window.sb || !window.loadCardsForView) return;
  if (window.__gptMountingCards) return;
  window.__gptMountingCards = true;
  const VIEWS = ['ind', 'grp', 'mind', 'mgrp', 'mc'];
  const REPORT_TYPES = { ind:'ind', grp:'grp', mind:'mind', mgrp:'mgrp', mc:'mc' };

  try {
  for (const view of VIEWS) {
    const grid = document.querySelector(`.gp-view[data-view="${view}"] .gp-grid`);
    if (!grid) continue;

    let cards;
    try {
      cards = await window.loadCardsForView(clubId, REPORT_TYPES[view], window.sb);
    } catch (e) { console.warn('_mountSavedBuilderCards:', view, e); continue; }

    if (!cards?.length) continue;

    // filter to only 'builder' source cards (catalog defaults shown via old HTML)
    const builderCards = cards.filter(c => c.source === 'builder');
    if (!builderCards.length) continue;

    // Free-canvas coords for these builder cards from the saved layout. They mount HERE,
    // async, possibly AFTER applyDefaultLayoutGeneric already ran — so without re-applying
    // their x/y/w/h they'd lose size/position and fall back to the CSS default (span 6 /
    // row 11). Keyed by card_id (= the card's UUID = dataset.cardId).
    //
    // SINGLE SOURCE OF TRUTH: reuse the layout applyDefault*/_loadLayoutStrict already resolved for
    // this view (cached in _layoutStrictCache) instead of firing a SECOND loadLayout() here. That
    // second fetch could return null on a cold/slow load (or a transient uid/cid-not-ready) and make
    // the reorder below silently skip → builder cards left in dashboard_cards order = "scrambled".
    // Falling back to loadLayout() only when the cache has no entry (mount ran outside the init flow).
    let _coordsById = null;
    let _lay = null;
    try {
      // Use the retried strict load (same source applyDefault* cached) — NOT a bare loadLayout(),
      // whose single transient null would skip the reorder below → raw-order scramble. A genuine
      // "no saved layout" returns null too, but then there is nothing to reorder to (defaults apply).
      _lay = _layoutStrictCache.has(view) ? _layoutStrictCache.get(view) : (await _loadLayoutStrict(view)).layout;
      _coordsById = new Map((_lay || [])
        .filter(c => [c.x, c.y, c.w, c.h].every(Number.isFinite))
        .map(c => [String(c.card_id), { x: c.x, y: c.y, w: c.w, h: c.h }]));
    } catch (e) { /* no layout → cards flow to defaults, still functional */ }

    // ¿La card se va a renderizar como tile angosto (KPI o gauge de valor único)? Se detecta
    // desde el config para reservar el ancho chico ya en el skeleton (evita la explosión al cargar).
    // Coincide con las reglas :has(.gp-kpi) / :has(.gp-gauge-single): KPI siempre; gauge sólo cuando
    // es single (squad + 1 métrica → gp-gauge-single).
    const _isKpiSlot = (cfg) => cfg?.viz === 'kpi'
      || (cfg?.viz === 'gauge' && cfg?.scope?.level === 'squad' && (cfg?.metrics?.length ?? 1) <= 1);

    for (const card of builderCards) {
      const config = card.config;
      if (!config || config.schema !== 'gp.card/v1') continue;

      // Already mounted? gp-tabs.js appends builder cards during TAB RENDER (before this runs) WITHOUT
      // applying the saved layout coords — so the card can already be in the grid here. Don't re-create
      // it, but DO apply its saved coords to the existing element; otherwise it keeps the default size
      // (size:full → width 12) and the user's saved w/x/y/h never loads (the "reverts to 12" bug).
      const _existing = grid.querySelector(`.gp-c[data-card-id="${(window.CSS?.escape?.(card.id)) || card.id}"]`);
      if (_existing) {
        if (_isKpiSlot(config)) _existing.classList.add('gp-c-kpi-slot');
        const _coEx = _coordsById?.get(String(card.id));
        if (_coEx && window.gpCanvas?.applyCoords) window.gpCanvas.applyCoords(_existing, _coEx);
        continue;
      }

      const el = window.gpBuildBuilderCardEl(config, card.id);
      if (_isKpiSlot(config)) el.classList.add('gp-c-kpi-slot');
      el.dataset.size = card.size || config.style?.size || 'md';
      el.querySelectorAll('.size-toggle button').forEach(b =>
        b.classList.toggle('is-on', b.textContent.trim() === ({ sm:'S', md:'M', lg:'L', full:'FULL' }[el.dataset.size] || 'M')));
      // Restore saved free-canvas coords (dataset + --gp-* vars) BEFORE append, so the
      // first paint + placeCards keep the exact size/position instead of auto-flowing.
      const _co = _coordsById?.get(String(card.id));
      if (_co) {
        if (window.gpCanvas?.applyCoords) window.gpCanvas.applyCoords(el, _co);
        else { el.dataset.x = _co.x; el.dataset.y = _co.y; el.dataset.w = _co.w; el.dataset.h = _co.h; }
      } else {
        // No saved coords: seed the SIZE bucket so the card is born at its real WIDTH; gp-canvas only
        // auto-flows x/y. Write dataset.w/h (not just the CSS vars) so placeCards reads real numbers
        // instead of NaN, and mirror --gp-span to w so the legacy CSS width path agrees. x/y stay
        // unset on purpose (no saved position → deterministic auto-flow places it).
        const _sz = el.dataset.size || 'md';
        const _w = { sm:4, md:6, lg:8, full:12 }[_sz] || 6;
        const _h = { sm:5, md:7, lg:10, full:13 }[_sz] || 7;
        el.dataset.w = _w; el.dataset.h = _h;
        el.dataset.span = String(_w);
        el.style.setProperty('--gp-w', _w);
        el.style.setProperty('--gp-h', _h);
        el.style.setProperty('--gp-span', _w);
      }

      grid.appendChild(el);
      grid.dataset.gptBuilderMounted = '1';

      // resolve real data (async, non-blocking)
      _resolveAndRenderSavedCard(el, config, clubId).catch(e => console.warn('resolve saved card:', e));
    }
    // Builder cards were just appended at the END of the grid. The static-card reorder ran earlier
    // (applyDefaultLayoutGeneric, before these existed), so without re-applying it here the builder
    // cards keep dashboard_cards append order — and late mounts (after the 1500ms reveal race) land
    // scrambled. Re-sort the full grid by the user's saved gps_dashboard_layouts order.
    if (_lay?.length) _reorderGrid(grid, _lay);
  }
  } finally {
    window.__gptMountingCards = false;
  }
}

/** Resolves a saved card's data and renders it using the same pipeline as the builder. */
// KPI cards render WITHOUT the full card header (.gp-c-h). The tile already
// carries its own small label (.gp-kpi .l), so a header title would duplicate it
// and eat ~2/3 of the card. We physically REMOVE the header from the DOM (not
// hide it via CSS) and relocate its edit/delete buttons into a compact floating
// overlay revealed on hover — listeners ride along with the moved nodes.
// Idempotent; skipped while the card is the live builder draft. Callers guard
// with config.viz === 'kpi'.
window.gpbStripKpiHeader = function (cardEl) {
  if (!cardEl || cardEl.classList.contains('is-editing') || cardEl.classList.contains('is-draft')) return;
  const head = cardEl.querySelector(':scope > .gp-c-h');
  if (head) {
    const ttl = head.querySelector('.ttl')?.textContent?.trim();
    if (ttl) cardEl.dataset.cardTitle = ttl;          // keep title for example-card dedup
    let actions = cardEl.querySelector(':scope > .gp-kpi-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'gp-kpi-actions';
      cardEl.appendChild(actions);
    }
    head.querySelectorAll('[data-edit],[data-del]').forEach(btn => {
      btn.style.cssText = '';                          // normalize → use .gp-kpi-actions styling
      actions.appendChild(btn);
    });
    head.remove();
  }
  // Drop the loading-state body centering/min-height so the KPI sizes to content.
  const body = cardEl.querySelector(':scope > .gp-c-b');
  if (body) {
    body.style.removeProperty('min-height');
    body.style.removeProperty('align-items');
    body.style.removeProperty('justify-content');
  }
};

async function _resolveAndRenderSavedCard(cardEl, config, clubId) {
  const body = cardEl.querySelector('.gp-c-b');
  if (!body) return;
  // Tabla, ranking, caja, heatmap y scatter comparan jugadores ENTRE SÍ: guardadas con alcance de
  // jugador quedaban con una marca sola o vacías. Se leen como plantel — sólo el dibujo; en la
  // base no se toca nada. Mismo criterio que el builder (window.gpbSquadOnlyViz).
  if (window.gpbSquadOnlyViz?.(config?.viz) && config?.scope?.level === 'player') {
    config = { ...config, scope: { ...(config.scope || {}), level: 'squad' } };
  }
  try {
    const { applyAgg, aggregateSeries, getSessionIds, fetchReports, fetchEavMetrics, CORE_COLS, neededKeys } =
      await import('./lib/gp-card/resolver.js').catch(() => ({}));
    if (!aggregateSeries) return; // resolver not available as module in this context

    const _gs = window.gpState || {};
    // Mismo arreglo que en gp-builder: el jugador sale de la barra de filtros,
    // que es la única fuente de filtrado. gpState.playerId sólo lo escribe el
    // selector viejo (#playerPill), oculto por CSS en todas las vistas, así que
    // una card de nivel "player" quedaba siempre sin jugador y sin datos.
    const _fbPids3 = window.gpFilterBar?.getState?.()?.playerIds || [];
    const ctx = { clubId,
                  playerId: (_fbPids3.length === 1 ? _fbPids3[0] : null) || window.gpState?.playerId || null,
                  mcId: window.gpState?.mcId || null,
                  teamId: window._gpTeamId || null,
                  teamPlayerIds: Array.isArray(window._gpPlayerIds) ? window._gpPlayerIds : null,
                  archivedPlayerIds: Array.isArray(window._gpArchivedPlayerIds) ? window._gpArchivedPlayerIds : [],
                  // Global season filter → a `{type:'season'}` card follows the chosen season.
                  ...(_gs.datePreset === 'season' && _gs.seasonId ? { seasonId: _gs.seasonId, seasonFrom: _gs.seasonFrom, seasonTo: _gs.seasonTo } : {}),
                  asOf: cmToday() };
    const sessionIds = await getSessionIds(config.range, ctx, window.sb);
    if (!sessionIds.length) { body.innerHTML = '<div class="cb2-state empty" style="min-height:100px"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No sessions in range</div></div>'; return; }
    const rows = await fetchReports(sessionIds, config, ctx, new Map(), window.sb);
    if (!rows.length) { body.innerHTML = '<div class="cb2-state empty" style="min-height:100px"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No GPS data</div></div>'; return; }
    const catalog = new Map((window._gpCatalog||[]).map(c => [c.key, { id:c.key, name:c.label, unit:c.unit||'', kind:c.kind||'accum', is_custom:!c.is_core, squad_rollup:c.squad_rollup??true }]));
    // EAV keys via the resolver's neededKeys (excludes synthetic/derived like work_time,
    // n_instances, acc_dec → they're computed in rowVal, NOT looked up in gps_report_metrics).
    // source='task' has no EAV at all (the view exposes every metric as a column).
    const customKeys = (config.source === 'task')
      ? []
      : (neededKeys ? neededKeys(config, catalog).eav
                    : (config.metrics||[]).filter(m => !CORE_COLS.has(m.id)).map(m => m.id));
    const eavMap = customKeys.length ? await fetchEavMetrics(rows.map(r=>r.id), customKeys, clubId, window.sb) : new Map();
    const series = aggregateSeries(rows, eavMap, config, catalog);
    if (!series.some(s=>s.points.length)) { body.innerHTML = '<div class="cb2-state empty" style="min-height:100px"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No data</div></div>'; return; }
    // basic render (builder will do full render when builder is loaded)
    body.innerHTML = `<div style="padding:14px;font:500 12px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)">${series[0]?.points?.length} point${series[0]?.points?.length!==1?'s':''} · ${config.viz}</div>`;
    body.className = 'gp-c-b';
    cardEl.classList.remove('is-draft');
  } catch (e) {
    console.warn('_resolveAndRenderSavedCard:', e);
    body.innerHTML = '<div class="cb2-state empty" style="min-height:100px"><div class="ic"><i class="ti ti-alert-triangle"></i></div><div class="t">Could not load</div></div>';
  }
}

// ── Roster cache por (club, team) ─────────────────────────────
// Devuelve { data, error } como Supabase (drop-in). Vive por carga;
// cambiar de equipo hace location.reload() → sin datos viejos.
window._gpRosterCache = window._gpRosterCache || new Map();
function _gpRoster(clubId, teamId) {
  const key = `${clubId}|${teamId || '_all'}`;
  if (window._gpRosterCache.has(key)) return window._gpRosterCache.get(key);
  // Roster por membresía (junction player_teams), no por players.team_id primario.
  const q = window.cmTeamPlayers(teamId, 'id,first_name,last_name,number,position,team_id')
    .neq('status', 'inactive');
  const p = q.order('last_name').then(res => {
    if (res.error) window._gpRosterCache.delete(key); // permití reintento si falló
    return res;
  });
  window._gpRosterCache.set(key, p);
  return p;
}
window._gpRoster = _gpRoster;

// ── refreshDashboard — reusable after import ──────────────────
// opts.sessionId: if provided, update date range to cover that session
window.refreshDashboard = async function (opts = {}) {
  // Invalidate the shared resolver cache so a refresh always reads fresh data (post-import,
  // post-flag, etc.). cmInvalidateGpsCache is the single entry point (supabase-init.js).
  (window.cmInvalidateGpsCache || (() => window.__gpResolverCache?.clear()))();
  const clubId = window._gpClubId || (await window.getClubId());
  if (!clubId) return;
  window._gpClubId = clubId;
  if (!window._gpTeamId && document.getElementById('gpsTeamSelect')) { await window.gpsInitTeamSwitch(); }
  if (window._gpTeamId && window._gpPlayerIds === null) { await window.gpsResolvePlayerIds(); }

  // If a specific session was just imported, ensure the date range covers it
  if (opts.sessionId) {
    const { data: sess } = await window.sb.from('training_sessions')
      .select('id,session_date,is_historical').eq('id', opts.sessionId).single();
    if (sess) {
      const sessDate  = sess.session_date;
      const { from, to } = getDateRange();
      // If session falls outside current range, switch to allTime + enable historical if needed
      if (sessDate < from || sessDate > to) {
        window.gpState.datePreset = 'allTime';
        document.getElementById('dateRangeLabel').textContent = tt('gps_analysis.preset_all_time','All time');
      }
      if (sess.is_historical && !window.gpState.includeHistorical) {
        window.gpState.includeHistorical = true;
        document.getElementById('histPill')?.classList.add('is-on');
      }
    }
  }

  // Fetch sessions in active date range (for subtitle counts)
  const { from, to } = getDateRange();
  let sessQry = window.sb.from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId);
  if (window.gpState.datePreset === 'season' && window.gpState.seasonId) {
    sessQry = sessQry.or(`and(session_date.gte.${from},session_date.lte.${to}),season_id.eq.${window.gpState.seasonId}`);
  } else {
    sessQry = sessQry.gte('session_date', from).lte('session_date', to);
  }
  if (window._gpTeamId) sessQry = sessQry.eq('team_id', window._gpTeamId);
  if (!window.gpState.includeHistorical) sessQry = sessQry.eq('is_historical', false);
  const { count: sessionCount } = await sessQry;

  // Count consistente con el roster por membresía (junction) cuando hay categoría activa.
  let _pcQ = window.sb.from('players')
    .select(window._gpTeamId ? 'id, player_teams!inner(team_id)' : 'id', { count: 'exact', head: true })
    .neq('status', 'inactive').is('archived_at', null);
  if (window._gpTeamId) _pcQ = _pcQ.eq('player_teams.team_id', window._gpTeamId);
  else _pcQ = _pcQ.eq('club_id', clubId);
  const { count: playerCount } = await _pcQ;

  _updateGpSub(playerCount, sessionCount);

  // Fetch GPS reports using the active filter state
  const reports = await _fetchReports(window.gpState);

  if (!reports?.length) {
    // Show informative empty state
    const sub = document.getElementById('gpSub');
    if (sub && sub.dataset.gpFilled !== '1') {
      _updateGpSub(playerCount, 0);
    }
    return;
  }
  window._gpReports = reports;

  // Z-score table (Group view) — SOLO la tabla estática legacy, NUNCA una card del builder.
  // Antes: document.querySelector('.gp-zt tbody') agarraba la primera .gp-zt del DOM (hoy
  // una card del builder) y le pisaba el tbody con esta estructura vieja de 7 columnas,
  // desincronizando header/body. Excluir las cards del builder lo evita.
  const _legacyZTable = [...document.querySelectorAll('.gp-zt')].find(t => !t.closest('.gp-c[data-card-id]'));
  const tbody = _legacyZTable ? _legacyZTable.querySelector('tbody') : null;
  if (tbody) {
    tbody.innerHTML = reports.map(r => {
      const p = r.players;
      const fn       = p ? (((p.first_name||'')[0]||'') + '. ' + (p.last_name||'')) : '—';
      const initials = p ? (((p.first_name||'')[0]||'') + ((p.last_name||'')[0]||'')).toUpperCase() : '?';
      const num  = p?.number ? `#${p.number}` : '';
      const pos  = p?.position || '—';
      const dist = r.total_distance       ? window.gpFmtMetric('total_distance', r.total_distance)         : '—';
      const hsr  = r.high_speed_distance  ? window.gpFmtMetric('high_speed_distance', r.high_speed_distance) : '—';
      const spr  = r.sprint_distance      ? window.gpFmtMetric('sprint_distance', r.sprint_distance)       : '—';
      const spd  = r.max_speed            ? window.gpFmtMetric('max_speed', r.max_speed)                   : '—';
      const acc  = r.accelerations != null ? window.gpFmtMetric('accelerations', r.accelerations)         : '—';
      const load = r.player_load  != null ? window.gpFmtMetric('player_load', r.player_load)               : '—';
      return `<tr>
        <td class="pc"><div class="gp-mini-pl"><div class="gp-mav"${p?.id?` data-cm-photo="${p.id}"`:''}>${initials}</div>
          <div><div class="gp-mn">${fn}</div><div class="gp-md">${num} · ${pos}</div></div></div></td>
        <td><span class="gp-zc neu">${dist}</span></td>
        <td><span class="gp-zc neu">${hsr}</span></td>
        <td><span class="gp-zc neu">${spr}</span></td>
        <td><span class="gp-zc neu">${spd}</span></td>
        <td><span class="gp-zc neu">${acc}</span></td>
        <td><span class="gp-zc neu">${load}</span></td>
      </tr>`;
    }).join('');
  }

  // Individual KPIs (first / selected player)
  const sel = (window.gpState.playerId ? reports.find(r => r.player_id === window.gpState.playerId) : null) || reports[0];
  if (sel) {
    // (Descriptor "jugador · posición · rango" removido de la fila "Dashboard":
    //  el contexto de datos ahora lo da exclusivamente la barra de filtros.)
    const kpiVals = document.querySelectorAll('.gp-view[data-view="ind"] .gp-kpi .v');
    const distCard = document.querySelector('.gp-view[data-view="ind"] .gp-c[data-card-id="kpi-distance"]');
    if (distCard) renderKpiCard(distCard, distCard.dataset.metricKey || 'total_distance', sel);
    else if (kpiVals[0]) kpiVals[0].innerHTML = `${sel.total_distance ? Math.round(sel.total_distance).toLocaleString('en') : '—'} <sub>m</sub>`;
    if (kpiVals[1]) kpiVals[1].innerHTML = `${sel.high_speed_distance != null ? Math.round(sel.high_speed_distance) : '—'} <sub>m</sub>`;
    if (kpiVals[2]) kpiVals[2].innerHTML = `${sel.sprint_distance != null ? Math.round(sel.sprint_distance) : '—'}`;
  }

  // Radar chart
  if (typeof _updateRadar === 'function') {
    _updateRadar(reports, window.gpState);
  }

  // Match group KPIs
  const totDist = reports.reduce((s,r) => s+(r.total_distance||0), 0);
  const totHsr  = reports.reduce((s,r) => s+(r.high_speed_distance||0), 0);
  const totSpr  = reports.reduce((s,r) => s+(r.sprint_distance||0), 0);
  const grpKpis = document.querySelectorAll('.gp-view[data-view="mgrp"] .gp-kpi .v');
  if (grpKpis[0]) grpKpis[0].innerHTML = `${Math.round(totDist).toLocaleString('en')} <sub>m</sub>`;
  if (grpKpis[1]) grpKpis[1].innerHTML = `${totHsr.toLocaleString()} <sub>m</sub>`;
  if (grpKpis[2]) grpKpis[2].innerHTML = `${totSpr.toLocaleString()}`;

  // Science cards
  if (typeof window.gpRenderScienceCards === 'function') {
    window.gpRenderScienceCards(reports, clubId);
  }

  // Generic builder example cards (one per dashboard)
  _renderGenericExampleCards();
};

// ── Generic builder example cards ───────────────────────────────
// Cards editables de ejemplo (gp.card/v1) que demuestran el camino
// "Crear a medida". Mismo patrón que mp-td / mc-table: semilla __config +
// resolveAndRenderCard + lápiz → openForEdit. Tras editar y guardar, el
// builder reemplaza la semilla por la card guardada en dashboard_cards.
const _GEN_EXAMPLE_CONFIGS = {
  'card-gen-week-kpi': () => ({
    schema: 'gp.card/v1', title: 'Total distance', viz: 'kpi',
    // squad → no depende de que haya un jugador seleccionado; season → ventana amplia
    // (la card de ejemplo siempre muestra un dato). El usuario lo acota con el lápiz.
    scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' }],
    range: { type: 'season' }, comparison: null,
    style: { size: 'sm', color: '#15803D', palette: 'pitch', axes: true, legend: true, dataLabels: false },
  }),
  'card-gen-session-table': () => ({
    schema: 'gp.card/v1', title: 'Session table', viz: 'table',
    scope: { level: 'squad' },
    metrics: [
      { id: 'total_distance',      agg: 'total', kind: 'accum', unit: 'm' },
      { id: 'high_speed_distance', agg: 'total', kind: 'accum', unit: 'm' },
      { id: 'player_load',         agg: 'total', kind: 'accum', unit: 'AU' },
    ],
    dimensions: [{ id: 'player_name' }],
    range: { type: 'season' }, comparison: null,
    style: { size: 'full', color: '#15803D', palette: 'pitch', axes: true, legend: true, dataLabels: false },
  }),
  'card-gen-match-kpi': () => ({
    schema: 'gp.card/v1', title: 'Match KPIs', viz: 'kpi',
    // squad → no depende de gpState.playerId (que solo lo setea el dashboard ind).
    scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' }],
    range: { type: 'season' }, comparison: null,
    style: { size: 'sm', color: '#15803D', palette: 'pitch', axes: true, legend: true, dataLabels: false },
  }),
  'card-gen-weekly-load': () => ({
    schema: 'gp.card/v1', title: 'Weekly load', viz: 'bars',
    scope: { level: 'squad' },
    metrics: [{ id: 'player_load', agg: 'total', kind: 'accum', unit: 'AU' }],
    range: { type: 'season' }, comparison: null,
    style: { size: 'full', color: '#15803D', palette: 'pitch', axes: true, legend: true, dataLabels: false },
  }),
};

function _renderGenericExampleCards() {
  if (!window.GpBuilder?.resolveAndRenderCard) return;
  for (const [cardId, mkCfg] of Object.entries(_GEN_EXAMPLE_CONFIGS)) {
    const el = document.getElementById(cardId);
    if (!el) continue;                          // stasheada o eliminada → skip
    const cfg = el.__config || mkCfg();
    // Dedup tras editar+guardar: si ya hay una card GUARDADA (montada desde
    // dashboard_cards) con el mismo título en la grilla, la semilla estática sobra.
    const grid = el.closest('.gp-grid');
    const saved = grid && [...grid.querySelectorAll('.gp-c[data-card-id]')]
      .some(c => c !== el && ((c.querySelector('.ttl')?.textContent.trim()) || c.dataset.cardTitle || '') === cfg.title);
    if (saved) { el.remove(); continue; }
    if (!el.__config) el.__config = cfg;         // semilla; el builder la reemplaza al editar+guardar
    const pen = el.querySelector('[data-edit]');
    if (pen && !pen.__genBound) {
      pen.__genBound = true;
      pen.addEventListener('click', () => window.GpBuilder.openForEdit?.(el));
    }
    const del = el.querySelector('[data-del]');
    if (del && !del.__genBound) {
      del.__genBound = true;
      del.addEventListener('click', () => {
        el.remove();
        const view = document.querySelector('.gp-view.is-on')?.dataset.view;
        if (view) saveLayout(view).catch(e => console.warn('saveLayout on example card delete:', e));
      });
    }
    window.GpBuilder.resolveAndRenderCard(el, el.__config);
  }
}
// Las genéricas de ejemplo responden a la barra de filtros como el resto de cards.
document.addEventListener('gpfilter:change', () => _renderGenericExampleCards());

// ── Smart default — detect what data is available ─────────────
async function _detectSmartDefault(clubId, userId) {
  // 1. Try saved prefs (by club + user)
  window._gpClubId = clubId;
  window._gpUserId = userId;
  const saved = loadGpsPrefs();
  if (saved) return saved;

  // 2. Recent activity? (ANY session in the last 30 days — not just non-historical, so a
  //    club actively training lands on the familiar Last-30 view.)
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const { count: recentCount } = await window.sb.from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .gte('session_date', d30.toISOString().slice(0, 10));

  if (recentCount > 0) {
    return { datePreset: 'last30', includeHistorical: false, microcycle: 'All' };
  }

  // 3. No recent activity but there IS data (migrated / historical, regardless of the
  //    is_historical flag) → show ALL of it so the dashboard never starts empty.
  const { count: anyCount } = await window.sb.from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId);

  if (anyCount > 0) {
    return { datePreset: 'allTime', includeHistorical: true, microcycle: 'All', _showHistBanner: true };
  }

  // 4. No data at all — default to last30, historical OFF
  return { datePreset: 'last30', includeHistorical: false, microcycle: 'All' };
}

// ── Initial page load ─────────────────────────────────────────
(async () => {
  if (!(await window.guardModule())) return;
  const [profile, club] = await Promise.all([window.getProfile(), window.getClub()]);
  const clubId = await window.getClubId();
  if (club) window.applyClubTheme();
  window._gpClubId = clubId;
  window._gpUserId = profile?.id || null;
  // Ceba la caché de fotos de jugador (id→foto) para pintar caras en las tablas (data-cm-photo). Fire-and-forget.
  window.cmLoadPlayerPhotos?.(clubId);

  // Load per-club GPS settings (baseline N, mode, active metrics, ACWR model)
  if (typeof loadGpsSettings === 'function') {
    window._gpSettings = await loadGpsSettings(clubId);
  }
  // Feed the club-configured ACWR model into the single engine so EVERY surface on this page
  // (chart, gauges, table) computes the SAME ratio. UNCOUPLED always (methodological decision).
  window.gpsACWR?.configure?.({ model: window._gpSettings?.acwr_model || 'ewma', coupled: false });
  // Depende de _gpSettings (lee include_archived) → va DESPUÉS de cargar los ajustes.
  await window.gpsResolveArchivedIds?.();

  // Load metric catalog (used by charts for dynamic labels/units)
  if (typeof window.getCatalog === 'function') {
    window._gpCatalog = await window.getCatalog(clubId);
  }

  // GPS Builder — Fase 2: seed default dashboards + mount saved builder cards
  if (typeof window.ensureDefaultDashboards === 'function' && window.sb) {
    window.ensureDefaultDashboards(clubId, profile?.id, window.sb).catch(e => console.warn('ensureDefaultDashboards:', e));
  }
  // NB: saved builder cards are mounted INSIDE the layout phase below (before the grid is
  // revealed), not here — mounting them late into an already-visible grid made them pop in
  // at the default size and then jump to their real slot.

  // Apply smart default / saved prefs
  const prefs = await _detectSmartDefault(clubId, window._gpUserId);
  applyGpsPrefs(prefs);

  // Show historical banner if auto-detected
  if (prefs._showHistBanner) {
    const banner = document.getElementById('histBanner');
    if (banner) banner.classList.add('is-on');
  }

  // GATE: mark the layout as NOT ready for the whole load. While false, gp-canvas won't autosave
  // (persist/compact) and won't cement provisional auto-flow coords. Flipped true in the finally
  // once every view's saved layout is loaded, reordered and the cards are mounted — then the
  // authoritative renderAll() places everything in the saved order.
  window._gpLayoutReady = false;
  try {
    await Promise.all([
      applyDefaultLayoutGeneric('ind', _IND_DEFAULTS),
      applyGrpDefaultLayout(),
      applyDefaultLayoutGeneric('mind', _MIND_DEFAULTS),
      applyDefaultLayoutGeneric('mgrp', _MGRP_DEFAULTS),
      applyMcDefaultLayout()
    ]);
    // Mount saved builder cards BEFORE the grid is revealed, so they appear directly at their
    // final size/position (skeleton inside) instead of mounting late into a visible grid and
    // then being re-placed — the "explosion" on load.
    //
    // WAIT FOR THE REAL MOUNT: previously this was Promise.race(mount, 1500ms). On a cold load
    // (e.g. navigating Admin→GPS) the mount + reorder often took longer than 1500ms, so the grid
    // was revealed mid-mount → builder cards appeared before _reorderGrid ran = scrambled. Now we
    // AWAIT the mount so the user only ever sees the grid AFTER it is fully ordered. The high
    // timeout is a SAFETY NET only (a hung fetch can't blank the dashboard forever) — the normal
    // flow resolves on the real mount, well before it fires.
    if (window.loadCardsForView && window.sb) {
      // AWAIT the real mount (incl. its final _reorderGrid) so the reveal in the finally NEVER shows a
      // pre-reorder (raw dashboard_cards) order. The timeout is an EMERGENCY net only (a hung fetch
      // can't blank the dashboard forever) — raised WELL ABOVE any slow-but-real load (e.g. a DB
      // contended by a running GPS sync), so the normal flow always resolves on the actual mount, not
      // the timeout. If the DB makes the mount take 12s, we wait 12s and reveal ordered — never
      // scrambled at 9s. Only a genuine >30s hang falls back to revealing without the reorder.
      await Promise.race([
        _mountSavedBuilderCards(clubId).catch(e => console.warn('_mountSavedBuilderCards:', e)),
        new Promise(r => setTimeout(r, 30000)),   // emergency net only
      ]);
    }
    // SELF-HEAL (structural fix): now that every card is mounted (static + builder), reconcile each
    // view's saved layout with the cards actually in its grid — prune dead ids, add missing cards,
    // re-persist. Without this, a STALE layout (ids that no longer match the grid) makes the whole
    // reorder/coords pipeline miss → auto-flow scramble. Runs BEFORE the reveal so the DB is healed
    // for the next load; this load already shows a deterministic order. Composes with the existing
    // fixes (respects the load-success cache + the ownership filter) — see _reconcileLayoutWithGrid.
    await Promise.all(
      ['ind', 'grp', 'mind', 'mgrp', 'mc'].map(v =>
        _reconcileLayoutWithGrid(v).catch(e => console.warn('_reconcileLayoutWithGrid:', v, e)))
    );
  } catch (e) {
    console.warn('applyLayout:', e);
  } finally {
    // Layout is now fully resolved (all views loaded + reordered + cards mounted). Flip the gate
    // ON, THEN run the single authoritative placement pass: coordless cards auto-flow in the saved
    // ORDER (the DOM is already reordered), real coords are honoured, and autosave is unblocked.
    window._gpLayoutReady = true;
    // Final placement pass: every card (static + builder) gets its --gp-w/h/x/y set BEFORE the
    // grid fades in, so nothing paints at the CSS default (span 6 / row 11) and then jumps.
    window.gpCanvas?.renderAll?.();
    // Skeletons en bodies vacíos → el grid aparece con shimmer en vez de blanco
    document.querySelectorAll('.gp-c-b').forEach(b => {
      if (b.children.length || b.textContent.trim()) return;
      const skel = document.createElement('div');
      skel.className = 'gp-skel';
      b.appendChild(skel);
      const obs = new MutationObserver(() => {
        if ([...b.children].some(c => c !== skel)) { skel.remove(); obs.disconnect(); }
      });
      obs.observe(b, { childList: true });
    });
    document.querySelectorAll('.gp-grid').forEach(g => g.classList.add('layout-ready'));
  }
  // ── TEMP FLASH DIAG: log any card whose size/placement changes AFTER reveal, to pinpoint
  // the load "explosion". Remove once fixed. ────────────────────────────────────────────
  try {
    const _g = document.querySelector('.gp-view.is-on .gp-grid');
    if (_g) {
      const _snap = () => [...(_g.querySelectorAll(':scope > .gp-c'))].map(c => {
        const cs = getComputedStyle(c);
        return { id: c.dataset.cardId || c.id || '?', w: c.style.getPropertyValue('--gp-w').trim(),
          h: c.style.getPropertyValue('--gp-h').trim(), span: c.style.getPropertyValue('--gp-span').trim(),
          gc: cs.gridColumn, gr: cs.gridRow, ow: c.offsetWidth, oh: c.offsetHeight };
      });
      let _prev = JSON.stringify(_snap());
      console.log('[FLASH DIAG t0 reveal] is-canvas=' + _g.classList.contains('is-canvas'), _snap());
      const _iv = setInterval(() => {
        const now = _snap(), s = JSON.stringify(now);
        if (s !== _prev) { console.log('[FLASH DIAG change] is-canvas=' + _g.classList.contains('is-canvas'), now); _prev = s; }
      }, 80);
      setTimeout(() => { clearInterval(_iv); console.log('[FLASH DIAG done]'); }, 4500);
    }
  } catch (e) { console.warn('[FLASH DIAG]', e); }
  await window.refreshDashboard();
  // Backstop: saca cualquier skeleton huérfano (card que nunca renderizó)
  setTimeout(() => document.querySelectorAll('.gp-skel').forEach(s => s.remove()), 8000);
  // GpBuilder puede cargar después del primer refresh → reintento para las cards de ejemplo.
  setTimeout(() => _renderGenericExampleCards(), 1200);
})();

  window._gpTeamId = null;
  window._gpPlayerIds = null;
  window.gpsInitTeamSwitch = async function gpsInitTeamSwitch() {
    const clubId = window._gpClubId || await window.getClubId();
    const prof = await window.getProfile();
    const bucket = (prof?.role || prof?.club_role || '').toLowerCase();
    let full = bucket === 'admin' || bucket === 'owner';
    if (!full && window.isSuperAdmin) { try { full = await window.isSuperAdmin(); } catch {} }
    let teams = await window.getTeams(clubId);
    if (!full) { let mine=[]; try{mine=(await window.sb.rpc('my_team_ids')).data||[];}catch{} const s=new Set(mine); teams=teams.filter(t=>s.has(t.id)); }
    const sel = document.getElementById('gpsTeamSelect');
    // dataset.gpsReady = "esta resolución YA terminó". Lo lee el filterbar para distinguir
    // «todavía no se resolvió el equipo» (esperar: el reload de abajo será la única carga, con
    // el scope correcto) de «este usuario no tiene categorías» (cargar sin equipo es lo correcto).
    // Sin esa señal, el filterbar tenía que adivinar por tiempo y cargaba club-wide de más.
    if (!teams.length) { sel.innerHTML='<option value="">No teams</option>'; sel.dataset.gpsReady = 'noteams'; return; }
    const saved = sessionStorage.getItem('cal_active_team');
    window._gpTeamId = (saved && teams.some(t=>t.id===saved)) ? saved : teams[0].id;
    sel.innerHTML = teams.map(t=>`<option value="${_gpEsc(t.id)}" ${t.id===window._gpTeamId?'selected':''}>${_gpEsc(t.name)}</option>`).join('');
    await gpsResolvePlayerIds();
    // El filterbar pudo haber cargado antes de tener la categoría: recargarlo ahora
    if (window.gpFilterBar && typeof window.gpFilterBar.reload === 'function') {
      try { await window.gpFilterBar.reload(); } catch (e) { console.warn('filterbar reload:', e); }
    }
  }
  // Ids de players archivados del club. Los usa el resolver para excluirlos de las cards
  // (scope squad). Queda VACÍO si el ajuste "incluir archivados" está ON → sin exclusión.
  window._gpArchivedPlayerIds = [];
  window.gpsResolveArchivedIds = async function gpsResolveArchivedIds() {
    if (window._gpSettings?.include_archived) { window._gpArchivedPlayerIds = []; return; }
    try {
      const { data } = await window.sb.from('players')
        .select('id').eq('club_id', window._gpClubId).not('archived_at', 'is', null);
      window._gpArchivedPlayerIds = (data || []).map(r => r.id);
    } catch { window._gpArchivedPlayerIds = []; }   // ante error, no filtrar (no romper cards)
  };
  window.gpsResolvePlayerIds = async function gpsResolvePlayerIds() {
    if (!window._gpTeamId) { window._gpPlayerIds = null; return; }
    try {
      // Player IDs de la categoría activa por membresía (incluye secundarias).
      const { data } = await window.cmTeamPlayers(window._gpTeamId, 'id');
      window._gpPlayerIds = (data||[]).map(r => r.id);
    } catch { window._gpPlayerIds = null; }
  }
  function gpsOnTeamChange(){ window._gpTeamId=document.getElementById('gpsTeamSelect').value; sessionStorage.setItem('cal_active_team',window._gpTeamId); location.reload(); }
  window.gpsOnTeamChange = gpsOnTeamChange;
  window.gpsResolvePlayerIds = gpsResolvePlayerIds;

  let _gpsUserIdPromise = null;
  async function gpsGetUserId() {
    if (window._gpUserId) return window._gpUserId;
    if (!_gpsUserIdPromise) {
      _gpsUserIdPromise = window.sb.auth.getUser().then(r => {
        const uid = r?.data?.user?.id || null;
        if (uid) window._gpUserId = uid;
        return uid;
      });
    }
    return _gpsUserIdPromise;
  }
  window.gpsGetUserId = gpsGetUserId;

// ══════════════════════════════════════════════════════════════
// GPS Science Cards — render with real DB data
// ══════════════════════════════════════════════════════════════

// Chart.js accent helper
function _accentHex() {
  return getComputedStyle(document.documentElement).getPropertyValue('--cm-accent').trim() || '#22c55e';
}

// Returns MetricDef[] for chart METRICS axes, driven by catalog + active_metrics setting.
// Falls back to hardcoded defaults when catalog has not been seeded yet.
function _getChartMetrics() {
  const catalog = window._gpCatalog || [];
  const active  = window._gpSettings?.active_metrics;
  if (catalog.length) {
    if (active?.length) {
      const defs = active.map(k => catalog.find(d => d.key === k)).filter(Boolean);
      if (defs.length) return defs;
    }
    const DEFAULT_KEYS = ['total_distance','high_speed_distance','sprint_distance','max_speed','accelerations','player_load'];
    const defs = DEFAULT_KEYS.map(k => catalog.find(d => d.key === k)).filter(Boolean);
    if (defs.length) return defs;
  }
  return [
    { key: 'total_distance',      label: 'Distance',  unit: 'm',    decimals: 0 },
    { key: 'high_speed_distance', label: 'HSR',       unit: 'm',    decimals: 0 },
    { key: 'sprint_distance',     label: 'Sprints',   unit: 'm',    decimals: 0 },
    { key: 'max_speed',           label: 'Top speed', unit: 'km/h', decimals: 1 },
    { key: 'accelerations',       label: 'Accel',     unit: '',     decimals: 0 },
    { key: 'player_load',         label: 'Load',      unit: 'AU',   decimals: 1 },
  ];
}

// Format a metric value by TYPE (gpFmtMetric); unknown metrics fall back to the
// catalog decimals/unit, then to _RANK_METRIC_UNITS.
function _fmtMetricVal(key, value) {
  const v = value || 0;
  const canon = window.gpFmtMetric(key, v, false);
  if (canon !== null) return canon;
  const def = (window._gpCatalog || []).find(d => d.key === key);
  if (def) {
    const r = def.decimals === 0 ? Math.round(v) : +v.toFixed(def.decimals);
    return r + (def.unit ? ' ' + def.unit : '');
  }
  const unit = _RANK_METRIC_UNITS[key] ?? '';
  return Math.round(v) + (unit ? ' ' + unit : '');
}

// ── ACWR bands plugin ─────────────────────────────────────────
const _acwrBandsPlugin = {
  id: 'acwrBands',
  beforeDraw(chart) {
    const { ctx, chartArea, scales: { y } } = chart;
    if (!chartArea || !y) return;
    const { top, bottom, left, right } = chartArea;
    [
      [0,   0.8,  'rgba(59,130,246,0.07)'],
      [0.8, 1.3,  'rgba(34,197,94,0.08)'],
      [1.3, 1.5,  'rgba(245,158,11,0.10)'],
      [1.5, 2.5,  'rgba(239,68,68,0.09)'],
    ].forEach(([lo, hi, col]) => {
      const yTop = Math.max(y.getPixelForValue(hi), top);
      const yBot = Math.min(y.getPixelForValue(lo), bottom);
      if (yBot <= yTop) return;
      ctx.fillStyle = col;
      ctx.fillRect(left, yTop, right - left, yBot - yTop);
    });
  }
};

// ── Chart defaults ────────────────────────────────────────────
const _chartDefaults = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(128,128,128,0.7)', font: { size: 10 } } },
    y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(128,128,128,0.7)', font: { size: 10 } } },
  },
};

// ── Velocity zones ────────────────────────────────────────────
function _renderVzones(reports) {
  const body = document.getElementById('vzonesBody');
  if (!body || !reports.length || !window.gpScience) return;

  // squad average zones
  const sum = { z1:0, z2:0, z3:0, z4:0, z5:0, total:0 };
  reports.forEach(r => {
    const z = window.gpScience.velocityZones(r);
    z.forEach((zone, i) => { sum['z'+(i+1)] += zone.dist; });
    sum.total += r.total_distance || 0;
  });
  const n  = reports.length;
  const avg = [sum.z1, sum.z2, sum.z3, sum.z4, sum.z5].map(v => Math.round(v / n));
  const tot = avg.reduce((a, b) => a + b, 0) || 1;
  const labels = ['Z1 <7', 'Z2 7-14', 'Z3 14-20', 'Z4 20-25', 'Z5 >25'];
  const colors = ['#64748b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  // label row
  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px';
  labels.forEach((l, i) => {
    const sp = document.createElement('span');
    sp.style.cssText = `display:inline-flex;align-items:center;gap:4px;font:500 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted)`;
    sp.innerHTML = `<span style="width:8px;height:8px;border-radius:2px;background:${colors[i]};display:inline-block"></span>${l}`;
    labelRow.appendChild(sp);
  });
  body.appendChild(labelRow);

  // stacked bar
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;height:22px;border-radius:5px;overflow:hidden;width:100%';
  avg.forEach((v, i) => {
    const seg = document.createElement('div');
    seg.style.cssText = `flex:${v || 0.01};background:${colors[i]};transition:flex 400ms ease`;
    seg.title = `${labels[i]}: ${v} m`;
    bar.appendChild(seg);
  });
  body.appendChild(bar);

  // values row
  const valRow = document.createElement('div');
  valRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
  avg.forEach((v, i) => {
    const sp = document.createElement('span');
    sp.style.cssText = `font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg)`;
    sp.textContent = `${v} m`;
    sp.title = labels[i];
    valRow.appendChild(sp);
  });
  body.appendChild(valRow);
}

// ── Outliers ──────────────────────────────────────────────────
function _renderOutliers(reports) {
  const body = document.getElementById('outliersBody');
  if (!body || !window.gpScience) return;

  const _odefs  = _getChartMetrics();
  const METRICS = _odefs.map(d => d.key);
  const LABELS  = Object.fromEntries(_odefs.map(d => [d.key, d.label]));
  const flags   = window.gpScience.outliers(reports, METRICS, 2);

  if (!flags.length) {
    const em = document.createElement('div');
    em.style.cssText = 'display:flex;align-items:center;gap:8px;font:500 12px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);padding:10px 0';
    em.innerHTML = `<i class="ti ti-circle-check" style="color:var(--cm-success);font-size:16px"></i>No outliers (z ≤ |2|) in this session`;
    body.appendChild(em);
    return;
  }

  flags.forEach(f => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--cm-border-soft)';
    const p = f.player;
    const name = p ? `${(p.first_name||'')[0]}. ${p.last_name||''}` : '—';
    const pos  = p?.position || '—';
    const dir  = f.z > 0 ? 'ti-arrow-up-right' : 'ti-arrow-down-right';
    const col  = Math.abs(f.z) >= 3 ? 'var(--cm-danger)' : 'var(--cm-warning)';
    row.innerHTML = `
      <div class="gp-mav"${p?.id?` data-cm-photo="${_gpEsc(p.id)}"`:''} style="flex-shrink:0">${_gpEsc(name.split(' ')[0][0]||'?')}${_gpEsc((p?.last_name||'?')[0])}</div>
      <div style="flex:1;min-width:0">
        <div style="font:500 12.5px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">${_gpEsc(name)}</div>
        <div style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:2px">${_gpEsc(pos)} · ${_gpEsc(LABELS[f.metric] || f.metric)}</div>
      </div>
      <div style="text-align:right">
        <div style="font:600 12px/1 var(--cm-font-mono);color:${col}"><i class="ti ${dir}" style="font-size:11px"></i>${f.z > 0 ? '+' : ''}${f.z}</div>
        <div style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:2px">${f.value.toLocaleString()}</div>
      </div>`;
    body.appendChild(row);
  });
}

// ── Position radar ────────────────────────────────────────────
function _renderPosRadar(reports) {
  const canvas = document.getElementById('canvasPosRadar');
  if (!canvas || !window.gpScience) return;

  const POS = ['GK','CB','FB','MF','WG','ST'];
  const _pdefs  = _getChartMetrics().filter(d => window.gpScience.baselineByRole('MF', d.key) != null);
  const METRICS = _pdefs.map(d => d.key);
  const LABELS  = _pdefs.map(d => d.label);

  function normPos(raw) {
    const p = (raw||'').toUpperCase();
    if (/GK|GOAL|ARQ|PORT/.test(p)) return 'GK';
    if (/CB|CENTR|CENT.B/.test(p)) return 'CB';
    if (/FB|WB|LAT/.test(p))       return 'FB';
    if (/WG|WING|EXT/.test(p))     return 'WG';
    if (/ST|CF|STR|FWD|DEL/.test(p)) return 'ST';
    return 'MF';
  }

  const groups = {};
  POS.forEach(p => { groups[p] = []; });
  reports.forEach(r => {
    const pk = normPos(r.players?.position);
    if (groups[pk]) groups[pk].push(r);
  });

  const colors = ['#6366f1','#ef4444','#f59e0b','#22c55e','#06b6d4','#f97316'];
  const datasets = [];
  POS.forEach((pos, pi) => {
    const grp = groups[pos];
    if (!grp.length) return;
    const vals = METRICS.map((m, mi) => {
      const avg = grp.reduce((s, r) => s + (+(r[m]||0)), 0) / grp.length;
      const baseline = window.gpScience.baselineByRole(pos, m) || 1;
      return Math.min(+(avg / baseline * 100).toFixed(1), 150); // % of baseline, capped at axis max
    });
    datasets.push({
      label: pos,
      data: vals,
      borderColor: colors[pi],
      backgroundColor: colors[pi].replace(')', ',0.05)').replace('rgb', 'rgba'),
      borderWidth: 1.8,
      pointRadius: 3,
      pointBackgroundColor: colors[pi],
    });
  });

  if (!datasets.length) return;

  Chart.getChart(canvas)?.destroy();
  new Chart(canvas, {
    type: 'radar',
    data: { labels: LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0, max: 150,
          ticks: { display: false, stepSize: 50 },
          grid: { color: 'rgba(128,128,128,0.15)' },
          angleLines: { color: 'rgba(128,128,128,0.15)' },
          pointLabels: { color: 'rgba(128,128,128,0.8)', font: { size: 10 } },
        }
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.r}% of baseline` } },
      },
    }
  });
}

// ── Async rendering (needs DB fetches) ────────────────────────
function _showCardError(cardId, err) {
  const card = document.getElementById(cardId);
  const body = card?.querySelector('.gp-c-b');
  if (body) body.innerHTML = '<div style="display:flex;align-items:center;gap:6px;padding:14px;color:var(--cm-danger);font:500 11.5px/1.4 var(--cm-font-sans)"><i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0"></i>Failed to load this card</div>';
  console.error('[GPS card ' + cardId + ']', err);
}

// Soft empty state: not an error, just no data to chart (keeps the card from going gray).
function _showCardEmpty(cardId, msg) {
  const card = document.getElementById(cardId);
  const body = card?.querySelector('.gp-c-b');
  if (body) body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:80px;padding:14px;color:var(--cm-fg-muted);font:500 11.5px/1.4 var(--cm-font-sans)">' + (msg || tt('gps_analysis.no_data','No data')) + '</div>';
}

window.gpRenderScienceCards = async function (reports, clubId) {
  // Synchronous cards first — each isolated so one failure never cascades
  try { _renderVzones(reports);   } catch(e) { _showCardError('card-vzones', e); }
  try { _renderOutliers(reports); } catch(e) { _showCardError('card-outliers', e); }
  try { _renderPosRadar(reports); } catch(e) { _showCardError('card-pos-radar', e); }

  // ── Historical data for ACWR / TSB / MC heatmap / Match vs Training
  // Always use a 84-day window (or full range if allTime) for these time-series charts.
  // Baselines always include historical matches regardless of the toggle — more data = more accurate.
  const { from: rangeFrom, to: rangeTo } = getDateRange(window.gpState);
  const d84 = new Date();
  d84.setDate(d84.getDate() - 84);
  // Use the earlier of the active range start or 84 days ago so trend charts always have context
  const cutoff = rangeFrom < d84.toISOString().slice(0, 10) ? rangeFrom : d84.toISOString().slice(0, 10);

  let sciQry = window.sb.from('training_sessions')
    .select('id,session_date,session_type,notes')
    .eq('club_id', clubId)
    .gte('session_date', cutoff)
    .order('session_date', { ascending: true });
  // Science/trend cards always fetch both historical and non-historical for trend accuracy
  // (baselines benefit from more data regardless of the dashboard toggle)

  const [{ data: histSessions }, ] = await Promise.all([sciQry]);

  if (!histSessions?.length) return;

  const hids = histSessions.map(s => s.id);
  // ACWR base metric is configurable (card-acwr[data-metric-key]); default player_load.
  // The shared `daily` below stays player_load (TSB et al. depend on it); a separate
  // `acwrDaily` drives the ACWR chart when a different base metric is chosen.
  let acwrMetric = document.getElementById('card-acwr')?.dataset.metricKey || 'player_load';
  const _acwrCols  = acwrMetric !== 'player_load' ? `,${acwrMetric}` : '';
  // Paginated (server caps at ~1000 rows): up to 400 sessions × squad → thousands of rows.
  let histLoads;
  try {
    histLoads = await window.cmFetchAll(() => _scopeTeam(window.sb.from('gps_reports')
      .select(`session_id,player_id,player_load${_acwrCols},players!inner(position)`)
      .eq('club_id', clubId)
      .eq('is_invalid', false)
      .in('session_id', hids.slice(0, 400))), { label: 'acwr.histLoads' });
  } catch (histLoadsErr) {
    // If the chosen ACWR base-metric column doesn't exist (legacy/bad metricKey), the
    // select errors — fall back to player_load so the cards still render.
    if (_acwrCols) {
      console.error('[GPS ACWR] base-metric "' + acwrMetric + '" select failed, falling back to player_load:', histLoadsErr);
      acwrMetric = 'player_load';
      histLoads = await window.cmFetchAll(() => _scopeTeam(window.sb.from('gps_reports')
        .select('session_id,player_id,player_load,players!inner(position)')
        .eq('club_id', clubId)
        .eq('is_invalid', false)
        .in('session_id', hids.slice(0, 400))), { label: 'acwr.histLoads.fallback' }).catch(() => []);
    } else {
      console.error('[GPS ACWR] histLoads query failed:', histLoadsErr);
      histLoads = [];
    }
  }

  // Build session → avg load map
  const loadBySession = {};
  (histLoads || []).forEach(r => {
    if (!loadBySession[r.session_id]) loadBySession[r.session_id] = [];
    loadBySession[r.session_id].push(r.player_load || 0);
  });

  const _dailyFrom = (key) => histSessions
    .filter(s => (loadBySession[s.id]?.length))
    .map(s => {
      const arr = (histLoads || []).filter(r => r.session_id === s.id).map(r => Number(r[key]) || 0);
      return { date: s.session_date, load: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0, type: s.session_type, notes: s.notes || '' };
    });

  const daily = histSessions
    .filter(s => loadBySession[s.id]?.length)
    .map(s => {
      const arr = loadBySession[s.id];
      return { date: s.session_date, load: arr.reduce((a, b) => a + b, 0) / arr.length, type: s.session_type, notes: s.notes || '' };
    });
  const acwrDaily = acwrMetric === 'player_load' ? daily : _dailyFrom(acwrMetric);

  // No load history → the trend charts can't be computed. Mark the ACWR card with an
  // explicit "No data" state instead of leaving it gray, then stop.
  if (!daily.length) { _showCardEmpty('card-acwr', 'No data'); return; }

  // ── ACWR methodology: season boundary + chronic stabilization ─────────────
  // A) The chronic (28d) must NOT pull load from before the active season's start — the
  //    off-season/pre-season gap would distort the ratio. B) Until the chronic has ~28
  //    days of history, the ratio is "building baseline": shown but flagged, not actionable.
  let _seasonStart = null;
  try {
    const { data: _seasonRows } = await window.sb.from('seasons')
      .select('start_date,end_date,team_id')
      .eq('club_id', clubId).lte('start_date', rangeTo).gte('end_date', rangeTo);
    // Prefer the active team's season, else a club-level (team-null) one, else any match.
    const _season = (_seasonRows || []).find(s => window._gpTeamId && String(s.team_id) === String(window._gpTeamId))
                 || (_seasonRows || []).find(s => s.team_id == null)
                 || (_seasonRows || [])[0] || null;
    _seasonStart = _season?.start_date || null;   // null ⇒ migration case: anchor to data
  } catch (e) { console.warn('[ACWR] season lookup failed; using data range:', e); }

  // Build the ACWR input window. Season present → never cross season.start (and cap the
  // look-back at to−84d). No season (migrated/loose history) → use the data as-is so the
  // curve stays one continuous block.
  const _isoMinus = (iso, n) => { const dd = new Date(iso); dd.setDate(dd.getDate() - n); return dd.toISOString().slice(0, 10); };
  let acwrInput = acwrDaily;
  if (_seasonStart) {
    const _lower = _seasonStart > _isoMinus(rangeTo, 84) ? _seasonStart : _isoMinus(rangeTo, 84);
    acwrInput = acwrDaily.filter(d => d.date >= _lower && d.date <= rangeTo);
  }
  // Stabilization clock anchor: season start, else the first available datapoint.
  const _baselineAnchor = _seasonStart || acwrInput[0]?.date || null;

  // ── ACWR chart ────────────────────────────────────────────
  try {
  const canvasACWR = document.getElementById('canvasACWR');
  // UNIFIED ENGINE: per-player → squad mean via window.gpsACWR (same engine as gauges/table/Player/
  // Dossier/Gym), with the club-configured model and UNCOUPLED always. Replaces the old
  // gpScience.acwr (RA, coupled, squad-POOLED) so the chart matches every other ACWR surface.
  // Base metric stays per-card (card-acwr[data-metric-key]); season window + stabilization kept.
  const _acwrModel = window._gpSettings?.acwr_model || 'ewma';
  const _sessDateById = Object.fromEntries(histSessions.map(s => [s.id, s.session_date]));
  // Respect the ACTIVE player/position filter (was ignored before → chart showed the whole squad
  // regardless of the filter). Same predicate as the Load-Monitoring gauges/table.
  const _acwrPred = _gpAcwrEffective();
  const _byPlayerAcwr = {};
  (histLoads || []).forEach(r => {
    const _d = _sessDateById[r.session_id];
    if (!_d || !r.player_id) return;
    if (!_acwrPred(r.player_id, r.players?.position)) return;
    const _v = Number(r[acwrMetric]);
    if (!Number.isFinite(_v)) return;
    (_byPlayerAcwr[r.player_id] || (_byPlayerAcwr[r.player_id] = [])).push({ date: _d, value: _v });
  });
  // Season boundary preserved: window starts at acwrInput[0] (already season-capped above) and the
  // daily-fill hard-stops there (no look-back across the season start). Fall back through rangeFrom
  // → rangeTo so a never-undefined start date reaches squadTimeline (which is itself now crash-safe
  // on bad dates, but we keep the caller clean too).
  const _acwrFrom = acwrInput[0]?.date || rangeFrom || rangeTo;
  const _acwrSeries = (window.gpsACWR?.squadTimeline && _acwrFrom && rangeTo)
    ? window.gpsACWR.squadTimeline(_byPlayerAcwr, _acwrFrom, rangeTo, { model: _acwrModel, coupled: false })
    : { dates: [], squadAcwr: [] };
  const acwrData = _acwrSeries.dates.map((date, i) => ({ date, ratio: _acwrSeries.squadAcwr[i] }));
  // Flag provisional points: chronic has < 28 days of history since the baseline anchor.
  if (_baselineAnchor) acwrData.forEach(d => {
    d.provisional = Math.round((new Date(d.date) - new Date(_baselineAnchor)) / 86400000) < 28;
  });
  const _firstReliable = acwrData.findIndex(d => !d.provisional);   // -1 ⇒ all provisional
  if (canvasACWR && !acwrData.length) {
    // Computed but nothing to plot → soft empty state (don't abort the other cards).
    _showCardEmpty('card-acwr', 'No data');
  } else if (canvasACWR) {
    Chart.getChart(canvasACWR)?.destroy();
    // Reflect the chosen base metric in the in-chart dropdown chip.
    const _acwrChip = document.querySelector('#card-acwr [data-acwr-metric-pick]');
    if (_acwrChip) {
      const _lbl = (window._gpCatalog || []).find(c => c.key === acwrMetric)?.label
        || acwrMetric.replace(/_/g, ' ');
      _acwrChip.innerHTML = `${_gpEsc(_lbl)} <i class="ti ti-chevron-down"></i>`;
    }
    const accent   = _accentHex();
    // Shade the "building baseline" stretch (leading provisional points) and label it.
    const _stabPlugin = {
      id: 'acwrStabilize',
      beforeDraw(chart) {
        const provisionalCount = _firstReliable === -1 ? acwrData.length : _firstReliable;
        if (provisionalCount <= 0) return;
        const { ctx, chartArea, scales: { x } } = chart;
        if (!chartArea || !x) return;
        const xRight = _firstReliable === -1 ? chartArea.right
          : Math.min(chartArea.right, x.getPixelForValue(_firstReliable - 0.5));
        if (xRight <= chartArea.left) return;
        ctx.save();
        ctx.fillStyle = 'rgba(120,120,120,0.12)';
        ctx.fillRect(chartArea.left, chartArea.top, xRight - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.fillStyle = 'rgba(120,120,120,0.75)';
        ctx.font = '600 9px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText('Stabilizing · chronic < 4 wks', chartArea.left + 5, chartArea.top + 4);
        ctx.restore();
      }
    };
    new Chart(canvasACWR, {
      type: 'line',
      plugins: [_acwrBandsPlugin, _stabPlugin],
      data: {
        labels: acwrData.map(d => d.date.slice(5)), // MM-DD
        datasets: [{
          label: 'ACWR',
          data: acwrData.map(d => d.ratio),
          borderColor: accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          // Provisional points are muted; reliable points keep the risk-band colors.
          pointBackgroundColor: acwrData.map(d =>
            d.provisional ? 'rgba(120,120,120,0.45)' :
            !d.ratio ? 'transparent' :
            d.ratio > 1.5 ? '#ef4444' :
            d.ratio > 1.3 ? '#f59e0b' : accent
          ),
          // Fade + dash the line while the chronic is still building.
          segment: {
            borderColor: ctx => (acwrData[ctx.p1DataIndex]?.provisional ? 'rgba(120,120,120,0.55)' : accent),
            borderDash:  ctx => (acwrData[ctx.p1DataIndex]?.provisional ? [4, 3] : undefined),
          },
          tension: 0.35,
        }]
      },
      options: {
        ..._chartDefaults,
        maintainAspectRatio: false,   // fill the card height; resize redraws to the box
        scales: {
          // small card → don't crop dates: keep them horizontal and auto-skip overlap
          x: { ..._chartDefaults.scales.x,
               ticks: { ..._chartDefaults.scales.x.ticks, autoSkip: true, maxRotation: 0, autoSkipPadding: 10 } },
          y: { ..._chartDefaults.scales.y, min: 0, max: 2,
               ticks: { ..._chartDefaults.scales.y.ticks, stepSize: 0.5,
                        callback: v => v === 0.8 ? '0.8 ✓' : v === 1.3 ? '1.3 ⚠' : v === 1.5 ? '1.5 ✗' : v } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: ctx => ` ACWR ${ctx.parsed.y}`,
            footer: items => (items.some(it => acwrData[it.dataIndex]?.provisional)
              ? 'Building baseline · chronic < 4 weeks (provisional)' : ''),
          } },
        },
      }
    });
    // Bespoke card: guarantee the chart redraws to the card size on resize
    // (debounced). The canvas-grid ResizeObserver also covers it, but binding once
    // to the stable card box — looking up the live chart each time — survives the
    // card's own re-renders (Chart is destroyed+recreated on each data refresh).
    const _acwrCard = document.getElementById('card-acwr');
    if (_acwrCard && typeof ResizeObserver !== 'undefined' && !_acwrCard.__acwrRO) {
      let _t;
      const ro = new ResizeObserver(() => {
        clearTimeout(_t);
        _t = setTimeout(() => { try { Chart.getChart(canvasACWR)?.resize(); } catch (e) {} }, 60);
      });
      ro.observe(_acwrCard);
      _acwrCard.__acwrRO = ro;
    }
  }
  } catch(e) { _showCardError('card-acwr', e); }

  // ── Fitness · Fatigue · Form (CTL/ATL/TSB) ───────────────
  try {
  const canvasTSB = document.getElementById('canvasTSB');
  if (canvasTSB && window.gpScience) {
    Chart.getChart(canvasTSB)?.destroy();
    const tsbData = window.gpScience.trainingStressBalance(daily);
    new Chart(canvasTSB, {
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
  } catch(e) { _showCardError('card-tsb', e); }

  // ── MC heatmap ────────────────────────────────────────────
  try {
  const mcBody = document.getElementById('mcHeatBody');
  if (mcBody && daily.length) {
    const last8 = daily.slice(-8);
    const maxLoad = Math.max(...last8.map(d => d.load), 1);
    const tbl = document.createElement('table');
    tbl.style.cssText = 'border-collapse:separate;border-spacing:6px;width:100%';
    const thead = tbl.createTHead();
    const hrow  = thead.insertRow();
    hrow.insertCell().innerHTML = '<th style="font:500 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-align:left;padding:0 2px">Session</th>';
    last8.forEach(d => {
      const th = document.createElement('th');
      th.style.cssText = 'font:500 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-align:center;white-space:nowrap;padding:0 2px';
      th.textContent = d.date.slice(5);
      hrow.appendChild(th);
    });
    const tbody = tbl.createTBody();

    // row per metric
    [
      ['Load', 'player_load'],
    ].forEach(([label]) => {
      const tr = tbody.insertRow();
      const td0 = tr.insertCell();
      td0.style.cssText = 'font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);white-space:nowrap;padding:2px';
      td0.textContent = label;
      last8.forEach(d => {
        const td = tr.insertCell();
        const pct = d.load / maxLoad;
        const r = Math.round(34 + pct * 205);
        const g = Math.round(197 - pct * 163);
        const b = 94;
        td.style.cssText = `background:rgba(${r},${g},${b},0.75);border-radius:5px;text-align:center;padding:6px 4px`;
        td.innerHTML = `<span style="font:600 10px/1 var(--cm-font-mono);color:#fff">${Math.round(d.load)}</span>`;
        td.title = `${d.date} · ${d.type || ''} · avg load ${Math.round(d.load)}`;
      });
    });

    // second row: session type
    const tr2 = tbody.insertRow();
    tr2.insertCell().style.cssText = 'padding:2px';
    last8.forEach(d => {
      const td = tr2.insertCell();
      td.style.cssText = 'text-align:center;padding:2px';
      const label = d.notes.includes('[SEED]') || d.type === 'Match' ? 'MD' :
                    d.type === 'Recovery' ? 'MD+1' : d.type || '—';
      td.innerHTML = `<span style="font:500 9.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${label}</span>`;
    });

    mcBody.appendChild(tbl);
  }
  } catch(e) { _showCardError('card-mc-heat', e); }

  // ── Match demands vs training delivered ───────────────────
  try {
  const canvasMvT = document.getElementById('canvasMatchVsTrain');
  if (canvasMvT && daily.length) {
    // Last MD session (highest load, or session_type='Match')
    const matchSession = [...daily].reverse().find(d => d.type === 'Match') || daily[daily.length - 1];
    // Training sessions from same MC (last 6 non-match sessions before the match)
    const trainSessions = daily.filter(d => d !== matchSession && d.type !== 'Match').slice(-6);
    const trainAvg = trainSessions.length
      ? trainSessions.reduce((s, d) => s + d.load, 0) / trainSessions.length
      : 0;

    // Use current reports for match vs training comparison per metric
    const METS    = ['total_distance','high_speed_distance','sprint_distance','accelerations','player_load'];
    const MLABELS = ['Distance','HSR','Sprint','Accel','Load'];
    const SCALES  = [1, 1, 1, 1, 1];   // all distances stored in meters → no km scaling
    const UNITS   = ['m','m','m','n','AU'];

    // For match: avg of current reports (assume current session = latest available)
    const matchVals = METS.map(m => {
      const avg = reports.reduce((s, r) => s + (+(r[m]||0)), 0) / (reports.length || 1);
      return avg;
    });

    // For training baseline: use phase multipliers vs match values
    const trainRatio = trainAvg && matchSession.load ? (trainAvg / matchSession.load) : 0.7;
    const trainVals  = matchVals.map(v => v * trainRatio);

    Chart.getChart(canvasMvT)?.destroy();
    new Chart(canvasMvT, {
      type: 'bar',
      data: {
        labels: MLABELS,
        datasets: [
          {
            label: 'Match',
            data: matchVals.map((v, i) => +(v / SCALES[i]).toFixed(1)),
            backgroundColor: 'rgba(99,102,241,0.7)',
            borderRadius: 4,
          },
          {
            label: 'Training avg',
            data: trainVals.map((v, i) => +(v / SCALES[i]).toFixed(1)),
            backgroundColor: 'rgba(34,197,94,0.5)',
            borderRadius: 4,
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true, position: 'top',
            labels: { font: { size: 11 }, boxWidth: 12, padding: 10, color: 'rgba(128,128,128,0.8)' } },
          tooltip: { callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} ${UNITS[ctx.dataIndex] || ''}`
          } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(128,128,128,0.7)', font: { size: 11 } } },
          y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(128,128,128,0.7)', font: { size: 10 } } },
        },
      }
    });
  }
  } catch(e) { _showCardError('card-match-vs-train', e); }

  // init size toggles for all new cards
  document.querySelectorAll('#card-acwr, #card-tsb, #card-vzones, #card-mc-heat, #card-pos-radar, #card-outliers, #card-half-drop, #card-vel-profile, #card-match-vs-train, #card-mc-diff-metric, #card-mc-table, #card-mc-scatter').forEach(c => initSizeToggles(c));
};

// Self-trigger: if the async IIFE already completed before this script ran
// (happens when Supabase calls resolve synchronously, e.g. in test environments),
// kick off rendering now with the stored data.
if (window._gpReports && window._gpClubId) {
  window.gpRenderScienceCards(window._gpReports, window._gpClubId);
}

// Re-render the bespoke science cards (incl. the ACWR chart) when the filters change, so the ACWR
// surface tracks the active player/position filter like the builder cards do. The ACWR chart
// re-fetches with the current filter state (via _gpAcwrEffective), so a stale _gpReports is fine.
document.addEventListener('gpfilter:change', () => {
  if (window._gpReports && window._gpClubId && typeof window.gpRenderScienceCards === 'function') {
    window.gpRenderScienceCards(window._gpReports, window._gpClubId);
  }
});

// ══════════════════════════════════════════════════════════════
// renderView() — re-fetches and re-renders all cards when
// microcycle / player / baseline pills change
// ══════════════════════════════════════════════════════════════

// Limita una query de gps_reports al roster del equipo activo (window._gpPlayerIds).
//  · null  → roster NO resuelto todavía → no-op (no romper el primer render).
//  · []    → equipo resuelto SIN jugadores → devolver NADA (aislamiento estricto: si el equipo no
//            tiene datos, no se muestra el club entero). Antes esto hacía no-op = fuga cross-team.
function _scopeTeam(q) {
  if (!Array.isArray(window._gpPlayerIds)) return q;
  if (!window._gpPlayerIds.length) return q.in('player_id', ['00000000-0000-0000-0000-000000000000']);
  return q.in('player_id', window._gpPlayerIds);
}
window._scopeTeam = _scopeTeam;

// Effective-player predicate for the ACWR surfaces — the SINGLE source of scope so the bespoke
// science chart and the Load-Monitoring gauges/table respect the active filter IDENTICALLY:
//   team roster (window._gpPlayerIds)  ∩  ( selected player (gpState.playerId)
//                                           | filter-bar players (getState().playerIds)
//                                           | filter-bar positions (getState().positions) )
// Mirrors the resolver precedence: a single selected player wins over the multi-select filters.
// `posOf(pid)` maps a playerId → position (needed only when a position filter is active and the
// caller doesn't already carry the position on the row).
function _gpAcwrEffective(posOf) {
  const FB    = window.gpFilterBar?.getState?.() || null;
  const sel   = window.gpState?.playerId || null;
  const team  = (Array.isArray(window._gpPlayerIds) && window._gpPlayerIds.length) ? new Set(window._gpPlayerIds) : null;
  const fbP   = FB?.playerIds?.length ? new Set(FB.playerIds) : null;
  const fbPos = FB?.positions?.length ? new Set(FB.positions) : null;
  return (pid, pos) => {
    if (!pid) return false;
    if (team && !team.has(pid)) return false;
    if (sel) return pid === sel;                 // one selected player → only that player
    if (fbP && !fbP.has(pid)) return false;
    if (fbPos) { const p = pos !== undefined ? pos : (posOf ? posOf(pid) : undefined); if (!fbPos.has(p)) return false; }
    return true;
  };
}
window._gpAcwrEffective = _gpAcwrEffective;

async function _fetchReports(state) {
  const clubId = window._gpClubId;
  if (!clubId) return [];
  const s = state || window.gpState;
  const { from, to } = getDateRange(s);

  let qry = window.sb.from('training_sessions')
    .select('id,session_date').eq('club_id', clubId);
  // Specific season → include days linked by season_id even if their date falls outside the
  // season window (imported/pre-season data bucketed via Assign rivals), mirroring the resolver.
  if (s.datePreset === 'season' && s.seasonId) {
    qry = qry.or(`and(session_date.gte.${from},session_date.lte.${to}),season_id.eq.${s.seasonId}`);
  } else {
    qry = qry.gte('session_date', from).lte('session_date', to);
  }
  // AISLAMIENTO POR EQUIPO: la tabla/gauges deben reflejar SOLO las sesiones del equipo activo,
  // igual que el contador del subtítulo (.eq('team_id')). Sin esto se agregaban gps_reports de
  // sesiones de OTRAS categorías del club para jugadores compartidos entre equipos.
  if (window._gpTeamId) qry = qry.eq('team_id', window._gpTeamId);
  qry = qry.order('session_date', { ascending: false }).limit(200);

  if (!s.includeHistorical) qry = qry.eq('is_historical', false);

  const { data: sessions } = await qry;

  let sessionIds = (sessions || []).map(sess => sess.id);

  // optional MC sub-filter
  if (s.microcycle && s.microcycle !== 'All') {
    const weekNum = parseInt((s.microcycle || '').replace(/\D/g, ''), 10);
    if (!isNaN(weekNum)) {
      sessionIds = (sessions || [])
        .filter(sess => getISOWeek(new Date(sess.session_date)) === weekNum)
        .map(sess => sess.id);
    }
  }

  if (!sessionIds.length) { window._gpSessionCount = 0; return []; }

  window._gpSessionCount = sessionIds.length;

  // fetch in chunks of 400 session ids; EACH chunk can still exceed the server's ~1000-row
  // cap (400 sessions × squad), so paginate within the chunk (cmFetchAll, ordered by id).
  const CHUNK = 400;
  let allReports = [];
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const chunk = await window.cmFetchAll(() => _scopeTeam(window.sb.from('gps_reports')
      .select('player_id,session_id,total_distance,high_speed_distance,very_high_speed_distance,sprint_distance,sprint_count,accelerations,decelerations,max_speed,avg_speed,player_load,hmld,time_played,distance_per_minute,players(first_name,last_name,number,position,positions)')
      .eq('club_id', clubId)
      .eq('is_invalid', false)
      .in('session_id', sessionIds.slice(i, i + CHUNK))), { label: '_fetchReports.chunk' })
      .catch(e => { console.error('[_fetchReports] chunk query failed:', e); return []; });
    if (chunk?.length) allReports = allReports.concat(chunk);
  }

  // Aggregate per player (avg across sessions in range)
  const byPlayer = {};
  allReports.forEach(r => {
    const pid = r.player_id || `_${r.session_id}`;
    if (!byPlayer[pid]) {
      byPlayer[pid] = { ...r, _count: 1 };
    } else {
      const agg = byPlayer[pid];
      ['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','sprint_count','accelerations','decelerations','max_speed','avg_speed','player_load','hmld','time_played','distance_per_minute'].forEach(m => {
        if (r[m] != null) agg[m] = (agg[m] || 0) + r[m];
      });
      agg._count++;
    }
  });
  const aggregated = Object.values(byPlayer).map(r => {
    const n = r._count || 1;
    ['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','sprint_count','accelerations','decelerations','max_speed','avg_speed','player_load','hmld','time_played','distance_per_minute'].forEach(m => {
      if (r[m] != null) r[m] = +(r[m] / n).toFixed(2);
    });
    return r;
  });

  aggregated.sort((a, b) => (b.total_distance || 0) - (a.total_distance || 0));
  return aggregated;
}

function _updateIndKpis(reports, state) {
  const s = state || window.gpState;
  const sel = (s.playerId ? reports.find(r => r.player_id === s.playerId) : null) || reports[0];
  if (!sel) return;
  const p = sel.players;
  const fname = p ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim() : '—';
  const kv = document.querySelectorAll('.gp-view[data-view="ind"] .gp-kpi .v');
  if (kv[0]) kv[0].innerHTML = `${sel.total_distance ? Math.round(sel.total_distance).toLocaleString('en') : '—'} <sub>m</sub>`;
  if (kv[1]) kv[1].innerHTML = `${sel.high_speed_distance != null ? Math.round(sel.high_speed_distance) : '—'} <sub>m</sub>`;
  if (kv[2]) kv[2].innerHTML = `${sel.sprint_distance != null ? Math.round(sel.sprint_distance) : '—'}`;
}

async function _updateRadar(reports, state) {
  const canvas     = document.getElementById('gpsRadar');
  const radarEmpty = document.getElementById('gpsRadarEmpty');
  if (!canvas) return;
  Chart.getChart(canvas)?.destroy();

  const _cmDefs = _getChartMetrics();
  const METRICS = _cmDefs.map(d => d.key);
  const LABELS  = _cmDefs.map(d => d.label);
  const sel     = (state.playerId ? reports.find(r => r.player_id === state.playerId) : null) || reports[0];
  const accent  = _accentHex();

  const usePersonal = (
    (window._gpSettings?.baseline_mode === 'personal' || state.baseline === 'vs Personal') &&
    sel?.player_id && window._gpClubId &&
    typeof window.getMatchBaseline === 'function'
  );

  if (usePersonal) {
    // Fetch personal baselines in parallel
    const baselines = {};
    await Promise.all(METRICS.map(async m => {
      baselines[m] = await window.getMatchBaseline(sel.player_id, m, window._gpClubId);
    }));

    const hasSome = METRICS.some(m => baselines[m]?.baseline != null);
    if (!hasSome) {
      canvas.style.display = 'none';
      if (radarEmpty) {
        radarEmpty.textContent = tt('gps_analysis.personal_baseline_hint','Personal baseline available after 3 official matches (Miguel et al. 2022)');
        radarEmpty.style.display = 'block';
      }
      return;
    }

    // ratio = player_value / baseline; fallback to squad z-norm if no baseline for that metric
    const mu_fn  = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd_fn  = (arr, mu) => Math.sqrt(arr.map(v => (v - mu) ** 2).reduce((a, b) => a + b, 0) / arr.length) || 1;
    const sqStats = METRICS.map(m => { const v = reports.map(r => +(r[m]||0)); const mu = mu_fn(v); return { mu, sigma: sd_fn(v, mu) }; });

    const playerData = METRICS.map((m, i) => {
      const val = +(sel[m] || 0);
      const bl  = baselines[m];
      if (bl?.baseline) return +(val / bl.baseline).toFixed(2);
      // Fallback: remap z-score from [-3,3] → [0,2] so scale is consistent
      const z = (val - sqStats[i].mu) / sqStats[i].sigma;
      return +(Math.max(0, z + 1)).toFixed(2); // shift so mean≈1
    });

    const selName = sel.players ? `${(sel.players.first_name||'')[0]}. ${sel.players.last_name||''}` : 'Player';
    canvas.style.display = '';
    if (radarEmpty) radarEmpty.style.display = 'none';

    // Re-check AFTER the async baseline fetch: a concurrent _updateRadar() call
    // may have created a chart on this canvas while we awaited (avoids the
    // "canvas is already in use" error when session/player/mode change fast).
    Chart.getChart(canvas)?.destroy();
    new Chart(canvas, {
      type: 'radar',
      data: { labels: LABELS, datasets: [
        { label: 'Personal baseline', data: Array(6).fill(1),
          borderColor: 'rgba(128,128,128,0.35)', backgroundColor: 'rgba(128,128,128,0.05)',
          borderDash: [4, 3], borderWidth: 1.5, pointRadius: 0 },
        { label: selName, data: playerData, borderColor: accent,
          backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2,
          pointRadius: 4, pointBackgroundColor: accent, pointBorderColor: '#fff', pointBorderWidth: 1.5 },
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 2, ticks: { display: false, stepSize: 0.5 },
          grid: { color: 'rgba(128,128,128,0.18)' },
          angleLines: { color: 'rgba(128,128,128,0.18)' },
          pointLabels: { color: 'rgba(128,128,128,0.8)', font: { size: 11 } } } },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            if (ctx.datasetIndex === 0) return ' Personal baseline (1.0×)';
            const m   = METRICS[ctx.dataIndex];
            const bl  = baselines[m];
            const cnt = bl?.count ?? 0;
            const conf = bl?.confidence === 'high' ? '✓' : bl?.confidence === 'medium' ? '~' : '—';
            return ` ${ctx.parsed.r.toFixed(2)}× baseline (${cnt} matches ${conf}) · Miguel et al. 2022`;
          }}}},
      },
    });
    return;
  }

  // ── Default: squad z-score mode ───────────────────────────────
  if (reports.length < 2) {
    canvas.style.display = 'none';
    if (radarEmpty) { radarEmpty.textContent = 'No GPS data for this session'; radarEmpty.style.display = 'block'; }
    return;
  }
  const mu_fn  = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const sd_fn  = (arr, mu) => Math.sqrt(arr.map(v => (v - mu) ** 2).reduce((a, b) => a + b, 0) / arr.length) || 1;
  const stats  = METRICS.map(m => { const vals = reports.map(r => +(r[m]||0)); const mu = mu_fn(vals); return { mu, sigma: sd_fn(vals, mu) }; });
  const zs     = METRICS.map((m, i) => +((+(sel[m]||0) - stats[i].mu) / stats[i].sigma).toFixed(2));
  canvas.style.display = '';
  if (radarEmpty) radarEmpty.style.display = 'none';
  Chart.getChart(canvas)?.destroy();   // guard before reuse (concurrent renders)
  new Chart(canvas, {
    type: 'radar',
    data: { labels: LABELS, datasets: [
      { label: 'Squad avg', data: Array(6).fill(0), borderColor: 'rgba(128,128,128,0.3)', backgroundColor: 'rgba(128,128,128,0.06)', borderDash: [4, 3], borderWidth: 1.5, pointRadius: 0 },
      { label: sel.players ? `${(sel.players.first_name||'')[0]}. ${sel.players.last_name||''}` : 'Player',
        data: zs, borderColor: accent, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2,
        pointRadius: 4, pointBackgroundColor: accent, pointBorderColor: '#fff', pointBorderWidth: 1.5 },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      scales: { r: { min: -3, max: 3, ticks: { display: false, stepSize: 1 },
        grid: { color: 'rgba(128,128,128,0.18)' }, angleLines: { color: 'rgba(128,128,128,0.18)' },
        pointLabels: { color: 'rgba(128,128,128,0.8)', font: { size: 11 } } } },
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` z = ${ctx.parsed.r > 0 ? '+' : ''}${ctx.parsed.r.toFixed(2)}` } } },
    },
  });
}

function _updateZTable(reports, state) {
  const tbody = document.querySelector('.gp-view[data-view="ind"] .gp-zt tbody');
  if (!tbody) return;
  const _ztDefs = _getChartMetrics();
  const METRICS = _ztDefs.map(d => d.key);
  // Update thead labels from catalog
  const _ztHead = document.querySelector('.gp-view[data-view="ind"] .gp-zt thead tr');
  if (_ztHead) {
    _ztHead.innerHTML = '<th class="pc">Player</th>' + _ztDefs.map(d => `<th>${_gpEsc(d.label)}</th>`).join('');
  }
  const useRole = state.baseline === 'vs Role';
  const mu_fn   = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  const sd_fn   = (arr,m) => Math.sqrt(arr.map(v=>(v-m)**2).reduce((a,b)=>a+b,0)/arr.length) || 1;
  const sqStats = METRICS.map(m => { const vals=reports.map(r=>+(r[m]||0)); const mu=mu_fn(vals); return {mu,sigma:sd_fn(vals,mu)}; });

  function zClass(z) {
    if (z == null || isNaN(z)) return 'neu';
    if (z >= 2)   return 'high';
    if (z >= 1.5) return 'mhigh';
    if (z >= 0.5) return 'warn';
    if (z > -0.5) return 'neu';
    if (z > -1)   return 'low';
    if (z > -1.5) return 'mlow';
    return 'vlow';
  }

  tbody.innerHTML = reports.map(r => {
    const p = r.players;
    const fn = p ? (((p.first_name||'')[0]||'')+'. '+(p.last_name||'')) : '—';
    const initials = p ? (((p.first_name||'')[0]||'')+((p.last_name||'')[0]||'')).toUpperCase() : '?';
    const num = p?.number ? `#${p.number}` : '';
    const pos = p?.position || '—';
    const cells = METRICS.map((m,i) => {
      let z;
      if (useRole) {
        const base = window.gpScience.baselineByRole(pos, m);
        z = (base > 0) ? (+(r[m]||0) - base) / (base * 0.2) : null;
      } else {
        z = window.gpScience.zScore(+(r[m]||0), sqStats[i].mu, sqStats[i].sigma);
      }
      const fmtZ = z != null ? (z > 0 ? '+' : '') + (+z).toFixed(1) : '—';
      return `<td><span class="gp-zc ${zClass(z)}">${fmtZ}</span></td>`;
    });
    return `<tr>
      <td class="pc"><div class="gp-mini-pl"><div class="gp-mav"${p?.id?` data-cm-photo="${p.id}"`:''}>${initials}</div>
        <div><div class="gp-mn">${fn}</div><div class="gp-md">${num} · ${pos}</div></div></div></td>
      ${cells.join('')}
    </tr>`;
  }).join('');
}

const _RANK_METRIC_UNITS = {
  high_speed_distance: 'm', very_high_speed_distance: 'm', sprint_distance: 'm',
  hmld: 'm', total_distance: 'm', player_load: 'AU',
  accelerations: '', decelerations: '', max_speed: 'km/h',
};

function _updateSquadRanking(reports, metric = 'high_speed_distance') {
  const body = document.getElementById('squadRankBody');
  if (!body) return;
  if (!reports?.length) {
    body.innerHTML = '<div style="padding:12px;font:500 12.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">No data for this period</div>';
    return;
  }
  const sorted = [...reports].sort((a, b) => (b[metric]||0) - (a[metric]||0));
  const maxVal = sorted[0]?.[metric] || 1;
  const cls    = pct => pct >= 85 ? '' : pct >= 60 ? ' med' : ' low';
  const fmt    = (r) => _fmtMetricVal(metric, r[metric] || 0);
  body.innerHTML = `<div class="gp-rank">${sorted.slice(0, 10).map((r, i) => {
    const p    = r.players;
    const name = p ? `${(p.first_name||'')[0]}. ${p.last_name||''}` : '—';
    const num  = p?.number ? ` · #${p.number}` : '';
    const pct  = Math.round(((r[metric]||0) / maxVal) * 100);
    return `<div class="gp-rank-row"><span class="ax">${i+1}</span><span class="gp-rank-bar"><span class="gp-rank-fill${cls(pct)}" style="width:${Math.max(pct,3)}%">${_gpEsc(name)}${num}</span></span><span class="gp-rank-v">${fmt(r)}</span></div>`;
  }).join('')}</div>`;
}

function _renderScatter(reports) {
  const container = document.querySelector('.gp-view[data-view="grp"] .gp-scatter');
  if (!container) return;

  const pts = (reports || [])
    .filter(r => r.player_load > 0 && r.high_speed_distance >= 0)
    .map(r => ({
      x: +(r.player_load || 0),
      y: +(r.high_speed_distance || 0),
      initials: r.players
        ? ((r.players.first_name||'')[0] + (r.players.last_name||'')[0]).toUpperCase()
        : '?',
    }));

  if (!pts.length) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font:500 12.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">No GPS data for this period</div>';
    return;
  }

  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  const padX  = (maxX - minX) * 0.12 || 10;
  const padY  = (maxY - minY) * 0.12 || 10;
  const x0 = minX - padX, x1 = maxX + padX;
  const y0 = minY - padY, y1 = maxY + padY;
  const W = 480, H = 240;
  const L = 44, R = 16, T = 20, B = 28;
  const toX = v => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const toY = v => H - B - ((v - y0) / (y1 - y0)) * (H - T - B);

  const meanX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const mxSvg = toX(meanX).toFixed(1);
  const mySvg = toY(meanY).toFixed(1);

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cm-accent').trim() || '#22c55e';

  const dotsHTML = pts.map(p => {
    const cx   = toX(p.x).toFixed(1);
    const cy   = toY(p.y).toFixed(1);
    const fill = (p.x >= meanX && p.y >= meanY) ? accent : '#3b82f6';
    return `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}"/><text x="${cx}" y="${(+cy + 4).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${p.initials}</text>`;
  }).join('');

  const fmtX = v => Math.round(v);
  const fmtY = v => Math.round(v);

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" font-family="Geist, ui-sans-serif" style="display:block;width:100%;height:100%">
    <g stroke="var(--cm-border-soft)" stroke-width="1">
      <line x1="${L}" y1="${T}"   x2="${W-R}" y2="${T}"/>
      <line x1="${L}" y1="${((H-B+T)/2).toFixed(0)}" x2="${W-R}" y2="${((H-B+T)/2).toFixed(0)}"/>
      <line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/>
      <line x1="${L}" y1="${T}"   x2="${L}"   y2="${H-B}"/>
    </g>
    <line x1="${mxSvg}" y1="${T}"   x2="${mxSvg}" y2="${H-B}" stroke="var(--cm-border)" stroke-width="1" stroke-dasharray="3 3"/>
    <line x1="${L}"     y1="${mySvg}" x2="${W-R}" y2="${mySvg}" stroke="var(--cm-border)" stroke-width="1" stroke-dasharray="3 3"/>
    <g>${dotsHTML}</g>
    <g font-size="10" font-family="Geist Mono, ui-monospace, monospace" fill="var(--cm-fg-muted)">
      <text x="${L}"   y="${H}">${fmtX(x0)}</text>
      <text x="${mxSvg}" y="${H}" text-anchor="middle">${fmtX(meanX)}</text>
      <text x="${W-R}" y="${H}" text-anchor="end">${fmtX(x1)} AU</text>
    </g>
    <g font-size="10" font-family="Geist Mono, ui-monospace, monospace" fill="var(--cm-fg-muted)">
      <text x="${L-4}" y="${H-B}" text-anchor="end" dominant-baseline="middle">${fmtY(y0)}</text>
      <text x="${L-4}" y="${T+4}" text-anchor="end" dominant-baseline="middle">${fmtY(y1)} m</text>
    </g>
    <text x="${((L+W-R)/2).toFixed(0)}" y="13" text-anchor="middle" font-size="10" fill="var(--cm-fg-muted)">HSR (m) ↑ · Player load →</text>
  </svg>`;
}

function _rerenderScienceCards(reports, clubId) {
  ['canvasACWR','canvasTSB','canvasPosRadar','canvasVelProfile','canvasMatchVsTrain'].forEach(id => {
    const el = document.getElementById(id);
    if (el) Chart.getChart(el)?.destroy();
  });
  ['vzonesBody','mcHeatBody','outliersBody','halfDropBody'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  window.gpRenderScienceCards(reports, clubId);
}

window.renderView = async function () {
  const state   = window.gpState;
  const clubId  = window._gpClubId;
  if (!clubId) return;
  const reports = await _fetchReports(state);

  // Count unique sessions and players for subtitle
  const uniquePlayers = new Set(reports.map(r => r.player_id).filter(Boolean)).size;
  _updateGpSub(uniquePlayers || null, window._gpSessionCount || null);

  if (!reports.length) return;
  window._gpReports = reports;
  _updateIndKpis(reports, state);
  await _updateRadar(reports, state);
  _updateZTable(reports, state);
  _updateSquadRanking(reports);
  _renderScatter(reports);
  const totDist = reports.reduce((s,r) => s+(r.total_distance||0), 0);
  const totHsr  = reports.reduce((s,r) => s+(r.high_speed_distance||0), 0);
  const totSpr  = reports.reduce((s,r) => s+(r.sprint_distance||0), 0);
  const grpKpis = document.querySelectorAll('.gp-view[data-view="mgrp"] .gp-kpi .v');
  if (grpKpis[0]) grpKpis[0].innerHTML = `${Math.round(totDist).toLocaleString('en')} <sub>m</sub>`;
  if (grpKpis[1]) grpKpis[1].innerHTML = `${totHsr.toLocaleString()} <sub>m</sub>`;
  if (grpKpis[2]) grpKpis[2].innerHTML = `${totSpr.toLocaleString()}`;
  _rerenderScienceCards(reports, clubId);
};
