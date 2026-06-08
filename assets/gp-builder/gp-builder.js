/* =============================================================
   GPS Builder — Fase 1/2
   Initialises only when club_gps_settings.gps_builder_enabled = true.
   All DOM is injected at runtime; GPS Analysis.html is unchanged
   beyond the <link>/<script> tags.

   Fase 2 additions:
     • saveCard() writes to dashboard_cards (via window.saveDashboardCard)
     • renderCard() calls resolveAndRender() for real data after save
     • resolveAndRender() uses the browser-side resolver (aggregateSeries)
       with data fetched from Supabase

   Rollback: set gps_builder_enabled = false → the whole module
   is a no-op, existing cards are untouched.
   ============================================================= */
(function () {
  'use strict';

  // ── Domain constants (mirrors lib/gp-card/) ────────────────

  // dimMax = how many DIMENSIONS (grouping/axis fields) this viz accepts.
  // The row/X dimension defaults to player_name in the resolver when none picked.
  const VIZ_TYPES = {
    kpi:     { name: 'KPI',     icon: 'ti-number-123',   min: 1, max: 8,  dimMax: 0 },
    bars:    { name: 'Bars',    icon: 'ti-chart-bar',    min: 1, max: 2,  dimMax: 1 },
    line:    { name: 'Line',    icon: 'ti-chart-line',   min: 1, max: 6,  dimMax: 1 },
    scatter: { name: 'Scatter', icon: 'ti-chart-dots',   min: 2, max: 2,  dimMax: 1 },
    radar:   { name: 'Radar',   icon: 'ti-chart-radar',  min: 3, max: 8,  dimMax: 0 },
    ranking: { name: 'Ranking', icon: 'ti-list-numbers', min: 1, max: 1,  dimMax: 1 },
    table:   { name: 'Table',   icon: 'ti-table',        min: 1, max: 12, dimMax: 4 },
    heatmap: { name: 'Heatmap', icon: 'ti-layout-grid',  min: 1, max: 12, dimMax: 1 },
  };

  // DIMENSIONS — fields you group / label / filter by (no aggregation).
  // Mirror of the keys the resolver understands (lib/gp-card/resolver.js dimGroup).
  const DIMENSIONS = [
    { id:'player_name',  name:'Player name', icon:'ti-user',           group:'Identity' },
    { id:'position',     name:'Position',    icon:'ti-shirt-sport',    group:'Identity' },
    { id:'session_date', name:'Date',        icon:'ti-calendar',       group:'Time' },
    { id:'md_code',      name:'MD code',     icon:'ti-calendar-event', group:'Time' },
    { id:'microcycle',   name:'Microcycle',  icon:'ti-calendar-week',  group:'Time' },
    { id:'rival',        name:'Rival',       icon:'ti-ball-football',  group:'Context' },
  ];
  const DIM_MAP = new Map(DIMENSIONS.map(d => [d.id, d]));
  // Mock row labels per dimension — only for the builder's pre-save preview.
  const DIM_MOCK = {
    player_name:  ['R. Vega','T. López','I. Barreiro','S. Rivas','M. Paredes'],
    position:     ['GK','CB','FB','CM','ST'],
    session_date: ['Mon','Tue','Wed','Thu','Fri'],
    md_code:      ['MD-3','MD-2','MD-1','MD'],
    microcycle:   ['MC 44','MC 45','MC 46'],
    rival:        ['Polvorín','Arenteiro','Ourense','Compostela'],
  };
  function dimRowId(S)     { return (S.dimensions && S.dimensions[0]?.id) || 'player_name'; }
  function dimRowName(S)   { return DIM_MAP.get(dimRowId(S))?.name || 'Player'; }
  function dimMockLabels(S){ return DIM_MOCK[dimRowId(S)] || DIM_MOCK.player_name; }
  // multi-dimension helpers (tables): the chosen dimensions in order (default player_name)
  function dimList(S)      { return (S.dimensions && S.dimensions.length) ? S.dimensions.map(d => d.id) : ['player_name']; }
  function dimNames(S)     { return dimList(S).map(id => DIM_MAP.get(id)?.name || id); }
  function dimMockRows(S, n = 5) {
    const ids = dimList(S);
    return Array.from({ length: n }, (_, r) => ids.map(id => { const a = DIM_MOCK[id] || DIM_MOCK.player_name; return a[r % a.length]; }));
  }
  const VIZ_FULLNAME  = { kpi:'KPI', bars:'Bar chart', line:'Line / temporal', scatter:'Scatter', radar:'Radar', ranking:'Ranking', table:'Table', heatmap:'Heatmap' };
  const VIZ_REQ_LBL   = { kpi:'pick 1', ranking:'pick 1', scatter:'pick 2 (X,Y)', bars:'pick 1–2', line:'pick 1+', radar:'pick 3+', table:'pick 1+', heatmap:'pick 1+' };

  const AGGS = [
    { id:'avg',    name:'Average',     short:'AVG', icon:'ti-divide',     peakOk:true  },
    { id:'total',  name:'Total (sum)', short:'SUM', icon:'ti-sigma',      peakOk:false },
    { id:'median', name:'Median',      short:'MED', icon:'ti-chart-dots', peakOk:false },
    { id:'max',    name:'Maximum',     short:'MAX', icon:'ti-arrow-up',   peakOk:true  },
    { id:'min',    name:'Minimum',     short:'MIN', icon:'ti-arrow-down', peakOk:true  },
  ];
  const AGG = Object.fromEntries(AGGS.map(a => [a.id, a]));

  const COLORS = [
    { id:'green',  hex:'#15803D' }, { id:'blue',   hex:'#2563EB' },
    { id:'amber',  hex:'#D97706' }, { id:'violet', hex:'#7C3AED' },
    { id:'rose',   hex:'#E11D48' }, { id:'slate',  hex:'#475569' },
  ];
  const PALETTES = [
    { id:'pitch', cols:['#15803D','#22C55E','#86EFAC','#D9F2E1'] },
    { id:'heat',  cols:['#1D4ED8','#60A5FA','#FCD34D','#DC2626'] },
    { id:'cool',  cols:['#0E7490','#0891B2','#22D3EE','#A5F3FC'] },
    { id:'mono',  cols:['#1F2937','#4B5563','#9CA3AF','#E5E7EB'] },
  ];
  const RANGES = [
    { id:'mc',     name:'MC (current)',  icon:'ti-calendar-week',  d:'Current microcycle' },
    { id:'w7',     name:'Last 7 days',   icon:'ti-calendar',       d:'Rolling week' },
    { id:'w30',    name:'Last 30 days',  icon:'ti-calendar-month', d:'Rolling month' },
    { id:'season', name:'Season to date',icon:'ti-calendar-stats', d:'Current season' },
  ];
  const COMPARES = [
    { id:'role',  name:'vs role baseline', icon:'ti-users',          d:'Same position group' },
    { id:'match', name:'vs match peak',    icon:'ti-ball-football',  d:'Last match reference' },
    { id:'mc',    name:'vs microciclo',    icon:'ti-calendar-stats', d:'Diferencia vs otro MC' },
    { id:'md',    name:'vs same MD code',  icon:'ti-calendar-event', d:'Matchday-minus code' },
    { id:'none',  name:'No comparison',   icon:'ti-circle-off',     d:'Raw values only' },
  ];

  // Real microcycles for the "vs microciclo" reference picker — { id, name, start_date },
  // newest first. Loaded once in init() from the `microcycles` table.
  let _mcList = [];

  /** True only for a real UUID string (guards uuid query inputs — see resolver.isUuid). */
  function _isUuid(v) {
    return typeof v === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }

  /** True for a usable microcycle id. microcycles.id is TEXT (not uuid) → accept any
   *  non-empty id, reject only null / "null" / "". Mirrors resolver.isNonNullId. */
  function _validMcId(v) {
    return typeof v === 'string' && v !== '' && v !== 'null' && v !== 'undefined';
  }

  /** gp.card/v1 `comparison` block for the active state (centralizes mc + refMcId). */
  function cmpConfig(S) {
    if (!S || S.compare === 'none') return null;
    if (S.compare === 'mc') return { baseline: 'mc', refMcId: _validMcId(S.refMcId) ? S.refMcId : null };
    return { baseline: S.compare };
  }

  /** Current microcycle id (from the page context), if any. */
  function currentMcId() { return window._gpMcId || window.gpState?.mcId || null; }

  /** Default reference MC = the one immediately BEFORE the current MC (else newest). */
  function prevMcId() {
    if (!_mcList.length) return null;
    const cur = currentMcId();
    if (cur) {
      const i = _mcList.findIndex(m => String(m.id) === String(cur));
      if (i >= 0 && i + 1 < _mcList.length) return _mcList[i + 1].id;   // list is newest→oldest
    }
    // no current MC in context → first MC that isn't the current one
    return (_mcList.find(m => String(m.id) !== String(cur)) || _mcList[0]).id;
  }

  function mcLabel(id) {
    const m = _mcList.find(x => String(x.id) === String(id));
    return m ? (m.name || (m.start_date ? `MC ${String(m.start_date).slice(0,10)}` : id)) : (id || '—');
  }

  // Icon/sample value by category (for mock rendering)
  const CAT_ICON = {
    distance:'ti-route', speed:'ti-brand-speedtest', acceleration:'ti-trending-up',
    load:'ti-battery-3', time:'ti-clock', count:'ti-hash', custom:'ti-puzzle',
  };
  const CAT_SAMPLE = {
    distance:1000, speed:28.5, acceleration:4.2, load:1200, time:85, count:45, custom:10,
  };

  // ── Runtime state ──────────────────────────────────────────

  let _initStarted = false; // prevents double-init (defer fires + DOMContentLoaded listener)
  let S = null;           // active builder config (null when closed)
  let draftCard = null;   // the .gp-c draft DOM node
  let catalogMap = new Map();   // id → enriched metric def
  let catalogGroups = [];       // [ { g, custom, items } ]
  let pulseNext = false;
  let reorderFrom = null;
  let dragMetricId = null;
  let popOwner = null;
  let toastTimer = null;
  let staticBuilt = false;
  let _clubId = null;   // set during init, used by saveCard & resolveAndRender
  let _userId = null;
  let _editCardId      = null;  // cardId being edited (null = new card mode)
  let _editCardDom     = null;  // DOM element being edited
  let _editCardOrigTtl    = '';
  let _editCardOrigSub    = '';
  let _editCardOrigSize   = 'md';
  let _editCardOrigAccent = '#15803D';

  // ── DOM refs populated after injectDOM() ──────────────────

  let panelEl, flyEl, flyBk, popEl, popBk, cfgBk, cfgDrawer, toastEl;

  // ── Helpers ───────────────────────────────────────────────

  function esc(s) { return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
  function fmt(n) { return n >= 1000 ? n.toLocaleString('en-US') : (Number.isInteger(n) ? n : n.toFixed(1)); }
  function defaultAgg(kind) { return kind === 'peak' ? 'avg' : 'total'; }
  function isAggOk(agg, kind) { return kind !== 'peak' || (AGG[agg] && AGG[agg].peakOk); }
  function metIcon(m) { return CAT_ICON[m.group_name] || 'ti-chart-bar'; }
  function metSample(m) { return CAT_SAMPLE[m.group_name] || 100; }

  function autoTitle(S) {
    if (S.title) return S.title;
    if (!S.metrics.length) return VIZ_FULLNAME[S.type];
    const m0 = catalogMap.get(S.metrics[0].id);
    if (!m0) return VIZ_FULLNAME[S.type];
    if (S.type === 'kpi')     return m0.name;
    if (S.type === 'ranking') return 'Ranking · ' + m0.name;
    if (S.type === 'scatter' && S.metrics[1]) return m0.name + ' vs ' + (catalogMap.get(S.metrics[1].id)?.name || '?');
    return m0.name + (S.metrics.length > 1 ? ` +${S.metrics.length - 1}` : '');
  }

  function buildConfig(S) {
    return {
      schema: 'gp.card/v1',
      title:  autoTitle(S) || null,
      viz:    S.type,
      scope:  { level: S.scope },
      metrics: S.metrics.map(m => {
        const cat = catalogMap.get(m.id) || {};
        const out = { id:m.id, agg:m.agg, kind:cat.kind||'accum', unit:cat.unit||'', custom:!!cat.is_custom };
        // Per-column conditional format (table viz). Persist the user's rule, or a
        // sensible default for table cards so the formatting survives save/reload.
        if (m.format) out.format = m.format;
        else if (S.type === 'table') out.format = _defaultFormat(cat);
        if (m.line) out.line = true;               // combo: render this metric as a line (2nd axis)
        return out;
      }),
      dimensions: (S.dimensions || []).map(d => ({ id:d.id })),
      range:      { type: S.range },
      comparison: cmpConfig(S),
      style: { size:S.size, color:S.color, palette:S.palette, axes:S.axes, legend:S.legend, dataLabels:S.labels, area:S.area, points:S.points,
               orientation: S.horizontal ? 'horizontal' : 'vertical', stacked: !!S.stacked },
      // Presentation-only column sort (table viz). Persisted so the order survives reload.
      ...(S.type === 'table' && S.sort ? { sort: S.sort } : {}),
    };
  }

  /** Signature of the data-affecting parts of a config (style excluded). Lets the
   *  live preview re-render style changes from cached series without re-querying. */
  function _dataSig(config) {
    return JSON.stringify({
      viz: config.viz, scope: config.scope, range: config.range,
      metrics: (config.metrics || []).map(m => [m.id, m.agg]),
      dims: (config.dimensions || []).map(d => d.id),
      cmp: config.comparison?.baseline || null,
      ref: config.comparison?.refMcId || null,
    });
  }

  function hlJSON(obj) {
    let j = JSON.stringify(obj, null, 2).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    return j.replace(/("(\\.|[^"\\])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?)/g, m => {
      const cls = /^"/.test(m) ? (/:$/.test(m) ? 'k' : 's') : (/true|false|null/.test(m) ? 'b' : 'n');
      return `<span class="${cls}">${m}</span>`;
    });
  }

  function noDataReason(S) {
    if (S.scope === 'squad') {
      const bad = S.metrics.find(m => {
        const cat = catalogMap.get(m.id);
        return cat && cat.is_custom && !cat.squad_rollup;
      });
      if (bad) {
        const cat = catalogMap.get(bad.id);
        return `"${cat.name}" is a custom metric without squad rollup.`;
      }
    }
    return null;
  }

  // ── Waiting helpers ────────────────────────────────────────

  function waitForClubId(maxMs = 10000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check() {
        if (window._gpClubId) return resolve(window._gpClubId);
        if (Date.now() - t0 > maxMs) return reject(new Error('gpb: timeout waiting for _gpClubId'));
        setTimeout(check, 300);
      })();
    });
  }

  // ── Flag & catalog fetch ───────────────────────────────────

  async function checkFlag(clubId) {
    try {
      const { data } = await window.sb
        .from('club_gps_settings')
        .select('gps_builder_enabled')
        .eq('club_id', clubId)
        .maybeSingle();
      // Opt-out model: enabled unless explicitly set to false.
      // No settings row → enabled (new clubs get builder by default).
      return data?.gps_builder_enabled !== false;
    } catch { return true; }
  }

  async function loadCatalog(clubId) {
    const { data } = await window.sb
      .from('gps_metric_definitions')
      .select('key,label,unit,category,decimals,is_core,kind,squad_rollup,display_order')
      .eq('club_id', clubId)
      .order('display_order', { ascending: true });

    const rows = data || [];
    catalogMap = new Map();

    // group for flyout
    const groupOrder = [];
    const groupMap   = {};
    for (const row of rows) {
      const m = {
        id:          row.key,
        name:        row.label,
        unit:        row.unit || '',
        kind:        row.kind || 'accum',
        group_name:  row.category || 'custom',
        is_custom:   !row.is_core,
        squad_rollup:row.squad_rollup ?? true,
        decimals:    row.decimals ?? 1,
      };
      catalogMap.set(m.id, m);
      const g = row.category || 'custom';
      if (!groupMap[g]) { groupMap[g] = []; groupOrder.push(g); }
      groupMap[g].push(m);
    }
    catalogGroups = groupOrder.map(g => ({
      g,
      custom: !rows.find(r => r.category === g)?.is_core,
      items:  groupMap[g],
    }));
  }

  // ── DOM injection ──────────────────────────────────────────

  function injectDOM() {
    if (document.getElementById('gpbPanel')) return; // guard against double-init
    document.body.insertAdjacentHTML('beforeend', `
      <!-- GPS Builder panel -->
      <div id="gpbPanel" class="es-panel" hidden>
        <div class="es-p-h">
          <div class="es-p-sel">
            <span class="ic" id="gpbSelIcon"><i class="ti ti-chart-bar"></i></span>
            <span class="tx">
              <span class="t" id="gpbSelName">New chart</span>
              <span class="s" id="gpbSelKind">bars · draft</span>
            </span>
          </div>
          <div class="es-mode" id="gpbMode">
            <button class="is-on" data-mode="classic"><i class="ti ti-adjustments-alt"></i>Clásico</button>
            <button data-mode="dd"><i class="ti ti-drag-drop"></i>Drag &amp; drop</button>
          </div>
          <div class="es-tabs" id="gpbTabs">
            <button class="is-on" data-tab="setup"><i class="ti ti-settings-2"></i>Setup</button>
            <button data-tab="style"><i class="ti ti-palette"></i>Style</button>
          </div>
        </div>
        <div class="es-p-b" id="gpbPaneBody">
          <div class="pane is-on" data-pane="setup">
            <div class="es-sec">
              <div class="lab">Title</div>
              <input class="es-input" id="gpbTitle" placeholder="Auto-generated">
            </div>
            <div class="es-sec">
              <div class="lab">
                Chart type
                <span class="req" id="gpbMetReq">*</span>
                <span class="hint" id="gpbMetHint">pick 1</span>
              </div>
              <div class="es-types" id="gpbTypes"></div>
            </div>
            <div class="es-sec">
              <div class="lab">Scope</div>
              <div class="es-seg" id="gpbScope">
                <button class="is-on" data-scope="player"><i class="ti ti-user"></i><span id="gpbDimName">Player</span></button>
                <button data-scope="squad"><i class="ti ti-users"></i>Squad</button>
              </div>
            </div>
            <div class="es-sec">
              <div class="lab">Metrics</div>
              <div class="es-fields" id="gpbMetrics"></div>
              <div id="gpbMetZone" style="min-height:6px"></div>
              <button class="es-add" id="gpbAddMetric"><i class="ti ti-plus"></i>Add metric</button>
            </div>
            <div class="es-sec">
              <div class="lab">Time range</div>
              <button class="es-select" id="gpbRange">
                <i class="ti ti-calendar-week"></i>
                <span id="gpbRangeName">MC (current)</span>
                <i class="ti ti-chevron-down cv"></i>
              </button>
            </div>
            <div class="es-sec">
              <div class="lab">Comparison</div>
              <button class="es-select" id="gpbCompare">
                <i class="ti ti-target"></i>
                <span id="gpbCompareName">vs role baseline</span>
                <i class="ti ti-chevron-down cv"></i>
              </button>
            </div>
          </div>
          <div class="pane" data-pane="style">
            <div class="es-sec">
              <div class="lab">Accent color</div>
              <div class="es-swatches" id="gpbColors"></div>
            </div>
            <div class="es-sec">
              <div class="lab">Chart palette</div>
              <div class="es-swatches" id="gpbPalettes"></div>
            </div>
            <div class="es-sec">
              <div class="lab">Card size</div>
              <div class="es-seg" id="gpbSize">
                <button data-size="sm">S</button>
                <button class="is-on" data-size="md">M</button>
                <button data-size="lg">L</button>
                <button data-size="full">Full</button>
              </div>
            </div>
            <div class="es-sec">
              <div class="es-toggle">
                <span class="tx"><span class="t">Axes</span><span class="s">Show axis lines &amp; labels</span></span>
                <button class="es-sw-t is-on" data-toggle="axes"></button>
              </div>
              <div class="es-toggle">
                <span class="tx"><span class="t">Legend</span><span class="s">Show metric legend</span></span>
                <button class="es-sw-t is-on" data-toggle="legend"></button>
              </div>
              <div class="es-toggle">
                <span class="tx"><span class="t">Data labels</span><span class="s">Show values on chart</span></span>
                <button class="es-sw-t" data-toggle="labels"></button>
              </div>
              <div class="es-toggle" data-only="bars">
                <span class="tx"><span class="t">Horizontal</span><span class="s">Barras horizontales</span></span>
                <button class="es-sw-t" data-toggle="horizontal"></button>
              </div>
              <div class="es-toggle" data-only="bars">
                <span class="tx"><span class="t">Apilado</span><span class="s">Sumar las series en una barra</span></span>
                <button class="es-sw-t" data-toggle="stacked"></button>
              </div>
              <div class="es-toggle" data-only="line">
                <span class="tx"><span class="t">Points</span><span class="s">Mark each vertex (line)</span></span>
                <button class="es-sw-t is-on" data-toggle="points"></button>
              </div>
              <div class="es-toggle" data-only="line">
                <span class="tx"><span class="t">Area fill</span><span class="s">Soft fill under the line</span></span>
                <button class="es-sw-t" data-toggle="area"></button>
              </div>
            </div>
          </div>
          <div class="pane" data-pane="dd"><div class="bdd-wrap" id="gpbDDPane"></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--cm-border);background:var(--cm-bg-soft);flex-shrink:0">
          <button class="cm-btn is-ghost is-sm" id="gpbConfigBtn"><i class="ti ti-braces" style="font-size:13px"></i>Config</button>
          <div style="flex:1"></div>
          <span id="gpbSaveHint" style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);display:none">← add a metric first</span>
          <button class="cm-btn is-outline is-sm" id="gpbCancel">Cancel</button>
          <button class="cm-btn is-primary is-sm" id="gpbSave" disabled title="Add at least one metric to enable">Add card</button>
        </div>
      </div>

      <!-- fields flyout -->
      <div id="gpbFly" class="es-fly">
        <div class="es-fly-h">
          <div class="row"><span class="t">Add metric</span>
            <button class="x" id="gpbFlyClose"><i class="ti ti-x"></i></button>
          </div>
          <div class="es-fly-search">
            <i class="ti ti-search"></i>
            <input id="gpbFlySearch" placeholder="Search metrics…">
          </div>
        </div>
        <div class="es-fly-b" id="gpbFlyBody"></div>
      </div>
      <div id="gpbFlyBk" class="es-fly-bk"></div>

      <!-- popover (range / compare / agg) -->
      <div id="gpbPop" class="gpb-pop"></div>
      <div id="gpbPopBk" class="gpb-pop-bk"></div>

      <!-- config drawer -->
      <div id="gpbCfgBk" class="gpb-cfg-bk"></div>
      <div id="gpbCfgDrawer" class="gpb-cfg-drawer">
        <div class="cfg-h">
          <span class="ic">{ }</span>
          <span class="tx">
            <span class="t">gp.card/v1</span>
            <span class="s">Card config — copy to use in seeds or AI</span>
          </span>
          <button class="x" id="gpbCfgClose"><i class="ti ti-x"></i></button>
        </div>
        <div class="cfg-contract">
          <i class="ti ti-shield-check"></i>
          <span>This object is the <b>single contract</b> shared by the builder, the AI generator and the resolver. Validate with Ajv before saving.</span>
        </div>
        <div class="cfg-body">
          <pre class="cfg-json" id="gpbCfgJson"></pre>
        </div>
        <div class="cfg-foot">
          <span class="meta">schema: <b>gp.card/v1</b></span>
          <span class="sp"></span>
          <button class="cm-btn is-ghost is-sm" id="gpbCfgCopy"><i class="ti ti-copy" style="font-size:13px"></i>Copy</button>
          <button class="cm-btn is-primary is-sm" id="gpbCfgSave">Add card</button>
        </div>
      </div>

      <!-- save toast -->
      <div id="gpbToast" class="gpb-toast">
        <span class="ic"><i class="ti ti-check"></i></span>
        <span class="tx">
          <span class="t" id="gpbToastTitle"></span>
          <span class="s" id="gpbToastSub"></span>
        </span>
        <button class="act" id="gpbToastAct">Done</button>
      </div>
    `);
  }

  function wireDOMRefs() {
    panelEl    = document.getElementById('gpbPanel');
    flyEl      = document.getElementById('gpbFly');
    flyBk      = document.getElementById('gpbFlyBk');
    popEl      = document.getElementById('gpbPop');
    popBk      = document.getElementById('gpbPopBk');
    cfgBk      = document.getElementById('gpbCfgBk');
    cfgDrawer  = document.getElementById('gpbCfgDrawer');
    toastEl    = document.getElementById('gpbToast');
  }

  // ── Add builder button to existing .gp-bar ────────────────

  function addBuilderButton() {
    const rightBar = document.querySelector('.gp-bar .right');
    if (!rightBar) return;
    const btn = document.createElement('button');
    btn.id = 'gpbOpenBtn';
    btn.className = 'cm-btn is-primary is-sm';
    btn.innerHTML = '<i class="ti ti-layout-grid-add" style="font-size:14px"></i>Chart builder';
    btn.style.cssText = 'margin-left:4px';
    btn.onclick = startBuild;
    rightBar.appendChild(btn);
  }

  // ── Build / cancel / save ─────────────────────────────────

  function freshState() {
    // Inherit time range from page filter; avoid 'mc' default (needs mcId)
    let range = 'w30';
    const p = window.gpState?.datePreset;
    if (p === 'last7') range = 'w7';
    else if (p === 'currentMC' && (window._gpMcId || window.gpState?.mcId)) range = 'mc';
    return { type:'bars', metrics:[], dimensions:[], scope:'player', compare:'role', refMcId:null, range,
             size:'md', color:'#15803D', palette:'pitch', title:'', axes:true, legend:true, labels:false,
             points:true, area:false, horizontal:false, stacked:false, sort:null };
  }

  function startBuild() {
    if (S) cancelBuild();
    S = freshState();
    pulseNext = false;

    // create draft card in current active view's grid
    const grid = document.querySelector('.gp-view.is-on .gp-grid');
    if (!grid) return;

    draftCard = document.createElement('div');
    draftCard.className = 'gp-c is-draft is-editing';
    draftCard.dataset.card = 'draft';
    draftCard.dataset.size = 'md';
    draftCard.style.setProperty('--cm-accent', '#15803D');
    draftCard.innerHTML = `
      <div class="gp-c-h">
        <span class="ttl" id="gpbDraftTitle">New chart</span>
        <span class="sub" id="gpbDraftSub">bars · draft</span>
        <div class="right">
          <div class="size-toggle" id="gpbDraftSizeToggle">
            <button>S</button><button class="is-on">M</button><button>L</button><button style="width:30px">FULL</button>
          </div>
          <button data-del title="Remove card"><i class="ti ti-x"></i></button>
        </div>
      </div>
      <div class="gp-c-b" id="gpbDraftBody"></div>`;
    grid.appendChild(draftCard);
    grid.classList.add('is-building');

    draftCard.querySelector('[data-del]').onclick = cancelBuild;

    // size-toggle on the card itself
    draftCard.querySelector('.size-toggle').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
        const sz = map[b.textContent.trim()];
        if (sz) { S.size = sz; draftCard.dataset.size = sz; syncStyle(); renderCard(); }
      };
    });

    openPanel();
    buildStaticPanel();
    syncAll();

    // cancel when view switches
    document.getElementById('sections')?.addEventListener('click', _onViewSwitch, { once:true });
  }

  function _onViewSwitch() { if (S) cancelBuild(); }

  function cancelBuild() {
    if (_editCardDom) {
      // Edit mode: restore the card to its saved state, don't remove it
      const card = _editCardDom;
      card.classList.remove('is-draft', 'is-editing');
      card.dataset.size = _editCardOrigSize;
      card.style.setProperty('--cm-accent', _editCardOrigAccent);
      const ttlEl = card.querySelector('.ttl');
      const subEl = card.querySelector('.sub');
      if (ttlEl) ttlEl.textContent = _editCardOrigTtl;
      if (subEl) subEl.textContent = _editCardOrigSub;

      // Restore X → delete, show pencil
      const delBtn = card.querySelector('[data-del]');
      if (delBtn) {
        const fresh = delBtn.cloneNode(true);
        const cardRef = card;
        fresh.addEventListener('click', () => {
          cardRef.remove();
          if (window.deleteDashboardCard && _isUuid(cardRef.dataset.cardId)) {
            window.deleteDashboardCard(cardRef.dataset.cardId, window.sb)
              .catch(e => console.warn('gpb: deleteDashboardCard failed:', e));
          }
        });
        delBtn.replaceWith(fresh);
      }
      card.querySelector('[data-edit]')?.style.removeProperty('display');

      // Restore body from saved config. Clear draftCard FIRST so the restored card
      // renders read-only (no format chip / sort affordance — editing is over).
      draftCard = null;
      if (card.__config) resolveAndRenderCard(card, card.__config);

      card.closest('.gp-grid')?.classList.remove('is-building');

      _editCardId = null;
      _editCardDom = null;
      _editCardOrigTtl = '';
      _editCardOrigSub = '';
      _editCardOrigSize   = 'md';
      _editCardOrigAccent = '#15803D';
    } else {
      // New card mode: remove draft node
      draftCard?.remove();
      document.querySelector('.gp-view.is-on .gp-grid')?.classList.remove('is-building');
    }
    draftCard = null;
    S = null;
    closePanel();
    const saveBtn = document.getElementById('gpbSave');
    if (saveBtn) saveBtn.textContent = 'Add card';
  }

  async function saveCard() {
    if (!S || !draftCard) return;
    const t = VIZ_TYPES[S.type];
    if (S.metrics.length < t.min) return;

    const config = buildConfig(S);

    if (_editCardDom) {
      // ── Edit mode: update the card in place (draftCard === _editCardDom). The card
      // may not have a DB row yet (migrated MP card) → the first save creates it. ──
      const targetCard = _editCardDom;
      const cardId     = _editCardId;

      targetCard.__cfg    = JSON.parse(JSON.stringify(S));
      targetCard.__config = JSON.parse(JSON.stringify(config));
      targetCard.dataset.card = 'chart';
      targetCard.dataset.size = S.size;
      targetCard.style.setProperty('--cm-accent', S.color);

      const titleElE = targetCard.querySelector('.ttl');
      const subElE   = targetCard.querySelector('.sub');
      if (titleElE) titleElE.textContent = autoTitle(S);
      if (subElE) {
        const agg0 = S.metrics[0] ? (AGG[S.metrics[0].agg]?.short.toLowerCase() || '') : '';
        subElE.textContent = `${VIZ_FULLNAME[S.type].toLowerCase()}${agg0?' · '+agg0:''} · ${S.scope}`;
      }
      const mapSz = { S:'sm', M:'md', L:'lg', FULL:'full' };
      targetCard.querySelectorAll('.size-toggle button').forEach(b =>
        b.classList.toggle('is-on', mapSz[b.textContent.trim()] === S.size)
      );

      // Remove editing state (don't remove the card from DOM!)
      targetCard.classList.remove('is-draft', 'is-editing');
      targetCard.closest('.gp-grid')?.classList.remove('is-building');

      // Restore X → delete, show pencil
      const delBtnE = targetCard.querySelector('[data-del]');
      if (delBtnE) {
        const freshE = delBtnE.cloneNode(true);
        const cardRefE = targetCard;
        freshE.addEventListener('click', () => {
          const host = cardRefE.closest('.gp-view');
          const cardId = cardRefE.dataset.cardId;
          cardRefE.remove();
          window.gptSyncEmptyState?.(host);   // re-show empty-state + drop tab count
          if (window.deleteDashboardCard && _isUuid(cardId)) {
            window.deleteDashboardCard(cardId, window.sb)
              .catch(e => console.warn('gpb: deleteDashboardCard failed:', e));
          }
        });
        delBtnE.replaceWith(freshE);
      }
      targetCard.querySelector('[data-edit]')?.style.removeProperty('display');

      draftCard = null;
      _editCardId  = null;
      _editCardDom = null;
      _editCardOrigTtl = '';
      _editCardOrigSub = '';
      _editCardOrigSize   = 'md';
      _editCardOrigAccent = '#15803D';

      const saveBtnE = document.getElementById('gpbSave');
      if (saveBtnE) saveBtnE.textContent = 'Add card';
      S = null;
      closePanel();

      if (_isUuid(cardId) && typeof window.updateDashboardCard === 'function') {
        window.updateDashboardCard(cardId, config, window.sb)
          .catch(e => console.warn('gpb: updateDashboardCard failed:', e));
      } else if (!_isUuid(cardId) && _clubId && typeof window.saveDashboardCard === 'function') {
        // Sin row en DB todavía (sin id, o card de EJEMPLO con id no-uuid/slug tipo
        // "gen-week-kpi") → crear. saveDashboardCard inserta y devuelve un uuid real;
        // reemplazamos el slug por ese uuid y la card pasa a comportarse como cualquier
        // card del usuario (el filter bar la re-renderiza, futuros saves la actualizan).
        targetCard.dataset.card = 'chart';
        window.saveDashboardCard(config, _clubId, _currentView(), _userId, window.sb)
          .then(newId => { if (newId) targetCard.dataset.cardId = newId; })
          .catch(e => console.warn('gpb: saveDashboardCard (in-place) failed:', e));
      }
      resolveAndRenderCard(targetCard, config);
      showToast(cardId ? 'Card updated' : 'Card saved', 'Real data loading…', 'Done');
      return;
    }

    // ── New card mode ─────────────────────────────────────────
    const savedCard = draftCard;

    savedCard.__cfg    = JSON.parse(JSON.stringify(S));
    savedCard.__config = JSON.parse(JSON.stringify(config));
    savedCard.dataset.card = 'chart';
    savedCard.classList.remove('is-draft', 'is-editing');
    savedCard.dataset.size = S.size;
    savedCard.style.setProperty('--cm-accent', S.color);
    savedCard.setAttribute('draggable', 'true');

    const titleEl = savedCard.querySelector('.ttl');
    const subEl   = savedCard.querySelector('.sub');
    if (titleEl) titleEl.textContent = autoTitle(S);
    if (subEl) {
      const agg0 = S.metrics[0] ? (AGG[S.metrics[0].agg]?.short.toLowerCase() || '') : '';
      subEl.textContent = `${VIZ_FULLNAME[S.type].toLowerCase()}${agg0?' · '+agg0:''} · ${S.scope}`;
    }

    const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
    savedCard.querySelectorAll('.size-toggle button').forEach(b =>
      b.classList.toggle('is-on', map[b.textContent.trim()] === S.size)
    );

    // Re-wire X → delete from DB; add Edit button before it
    const delBtn = savedCard.querySelector('[data-del]');
    if (delBtn) {
      const fresh = delBtn.cloneNode(true);
      delBtn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        const host = savedCard.closest('.gp-view');
        const cardId = savedCard.dataset.cardId;
        savedCard.remove();
        window.gptSyncEmptyState?.(host);   // re-show empty-state + drop tab count
        if (window.deleteDashboardCard && cardId) {
          window.deleteDashboardCard(cardId, window.sb)
            .catch(e => console.warn('gpb: deleteDashboardCard failed:', e));
        }
      });
      const editBtn = document.createElement('button');
      editBtn.title = 'Edit card';
      editBtn.dataset.edit = '';
      editBtn.innerHTML = '<i class="ti ti-pencil"></i>';
      editBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px 6px;color:var(--cm-fg-muted)';
      fresh.parentNode.insertBefore(editBtn, fresh);
      editBtn.addEventListener('click', () => openBuilderForEdit(savedCard));
    }

    const grid = savedCard.closest('.gp-grid');
    if (grid) grid.classList.remove('is-building');
    window.gptSyncEmptyState?.(savedCard);   // hide empty-state + bump tab count

    draftCard = null;
    S = null;
    closePanel();

    const viewKey = _currentView();
    const _PREDEFINED = new Set(['ind', 'grp', 'mind', 'mgrp', 'mc']);
    if (_PREDEFINED.has(viewKey)) {
      if (_clubId && typeof window.saveDashboardCard === 'function') {
        window.saveDashboardCard(config, _clubId, viewKey, _userId, window.sb)
          .then(cardId => { savedCard.dataset.cardId = cardId; })
          .catch(e => console.warn('gpb: saveDashboardCard failed:', e));
      }
    } else if (viewKey.startsWith('db-')) {
      const dashId = viewKey.slice(3);
      if (typeof window.insertCardIntoDashboard === 'function') {
        window.insertCardIntoDashboard(config, dashId, _userId, window.sb)
          .then(cardId => { savedCard.dataset.cardId = cardId; })
          .catch(e => console.warn('gpb: insertCardIntoDashboard failed:', e));
      }
    }

    resolveAndRenderCard(savedCard, config);
    showToast('Chart added', 'Real data loading…', 'Done');
  }

  // ── Edit existing card ────────────────────────────────────
  // Reuses _editCardDom as draftCard — no second card is created.
  function openBuilderForEdit(cardEl) {
    if (!panelEl) return;
    // A card may not have a DB row yet (e.g. a migrated Match Performance card seeded
    // with __config). Editing is allowed; the first save creates the row in place.
    if (!cardEl || (!cardEl.dataset.cardId && !cardEl.__config)) return;
    const cardId = cardEl.dataset.cardId || null;

    if (S) cancelBuild();

    // Save original visual state so cancelBuild can restore it
    _editCardOrigTtl    = cardEl.querySelector('.ttl')?.textContent || '';
    _editCardOrigSub    = cardEl.querySelector('.sub')?.textContent || '';
    _editCardOrigSize   = cardEl.dataset.size || 'md';
    _editCardOrigAccent = cardEl.style.getPropertyValue('--cm-accent') || '#15803D';

    _editCardId  = cardId;
    _editCardDom = cardEl;

    // Use the existing card as the live draft — no new DOM node
    S = freshState();
    pulseNext = false;
    draftCard = cardEl;

    cardEl.classList.add('is-draft', 'is-editing');
    const grid = cardEl.closest('.gp-grid');
    if (grid) grid.classList.add('is-building');

    // Clone X button to strip old listeners, then wire to cancelBuild
    const delBtn = cardEl.querySelector('[data-del]');
    if (delBtn) {
      const fresh = delBtn.cloneNode(true);
      fresh.onclick = cancelBuild;
      delBtn.replaceWith(fresh);
    }
    // Hide pencil while editing
    cardEl.querySelector('[data-edit]')?.style.setProperty('display', 'none');

    // Wire size-toggle on the card. The handler stays bound after the builder closes,
    // so guard against firing when this card is no longer the active draft (S is null
    // once the builder closes → "Cannot set properties of null (setting 'size')").
    cardEl.querySelector('.size-toggle')?.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        if (!S || draftCard !== cardEl) return;   // not editing this card → ignore
        const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
        const sz = map[b.textContent.trim()];
        if (sz) { S.size = sz; draftCard.dataset.size = sz; syncStyle(); renderCard(); }
      };
    });

    document.getElementById('sections')?.addEventListener('click', _onViewSwitch, { once:true });

    openPanel();
    buildStaticPanel();

    // Seed S from stored config
    const cfg       = cardEl.__cfg;
    const rawConfig = cardEl.__config;

    if (cfg) {
      S.type    = cfg.type;
      S.scope   = cfg.scope;
      S.range   = cfg.range;
      S.compare = cfg.compare;
      S.refMcId = cfg.refMcId || null;
      S.size    = cfg.size;
      S.color   = cfg.color;
      S.palette = cfg.palette;
      S.axes    = cfg.axes !== false;
      S.legend  = cfg.legend !== false;
      S.labels  = !!cfg.labels;
      S.points  = cfg.points !== false;
      S.area    = !!cfg.area;
      S.horizontal = !!cfg.horizontal;
      S.stacked    = !!cfg.stacked;
      S.sort    = cfg.sort || null;
      S.title   = cfg.title || '';
      S.metrics = JSON.parse(JSON.stringify(cfg.metrics || []));
      S.dimensions = (cfg.dimensions || []).filter(d => DIM_MAP.has(d.id)).map(d => ({ id:d.id }));
    } else if (rawConfig?.schema === 'gp.card/v1') {
      S.type    = rawConfig.viz                  || 'bars';
      S.scope   = rawConfig.scope?.level         || 'player';
      S.range   = rawConfig.range?.type          || 'mc';
      S.compare = rawConfig.comparison?.baseline || 'none';
      S.refMcId = rawConfig.comparison?.refMcId  || null;
      S.size    = rawConfig.style?.size          || 'md';
      S.color   = rawConfig.style?.color         || '#15803D';
      S.palette = rawConfig.style?.palette       || 'pitch';
      S.axes    = rawConfig.style?.axes   !== false;
      S.legend  = rawConfig.style?.legend !== false;
      S.labels  = !!rawConfig.style?.dataLabels;
      S.points  = rawConfig.style?.points !== false;
      S.area    = !!rawConfig.style?.area;
      S.horizontal = rawConfig.style?.orientation === 'horizontal';
      S.stacked    = !!rawConfig.style?.stacked;
      S.sort    = rawConfig.sort || null;
      S.title   = rawConfig.title || '';
      S.metrics = (rawConfig.metrics || [])
        .map(m => ({ id: m.id, agg: m.agg, ...(m.format ? { format: m.format } : {}), ...(m.line ? { line: true } : {}) }))
        .filter(m => catalogMap.has(m.id))
        .map(m => {
          const cat = catalogMap.get(m.id);
          if (cat?.kind === 'peak' && !AGG[m.agg]?.peakOk) m.agg = 'avg';
          return m;
        });
      S.dimensions = (rawConfig.dimensions || []).filter(d => DIM_MAP.has(d.id)).map(d => ({ id:d.id }));
    } else {
      cancelBuild();
      return;
    }

    // clamp dimensions to what this viz accepts (backward-compat: none → default)
    const _vt = VIZ_TYPES[S.type] || VIZ_TYPES.bars;
    if (!S.dimensions) S.dimensions = [];
    if (S.dimensions.length > (_vt.dimMax || 0)) S.dimensions = S.dimensions.slice(0, _vt.dimMax || 0);

    const saveBtn = document.getElementById('gpbSave');
    if (saveBtn) saveBtn.textContent = 'Update card';

    document.getElementById('gpbTitle').value = S.title;
    pulseNext = true;
    syncAll();
  }

  // ── Panel open / close ─────────────────────────────────────

  function openPanel() {
    panelEl.removeAttribute('hidden');
    panelEl.classList.add('is-open');
    document.body.classList.add('gpb-open');
    document.getElementById('gpbTitle').value = S.title || '';
    // default = modo clásico (red de seguridad); el D&D es opcional vía el toggle
    _bMode = 'classic';
    panelEl.classList.remove('is-ddmode');
    panelEl.querySelectorAll('#gpbMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === 'classic'));
    // switch to setup tab
    panelEl.querySelector('.es-tabs button[data-tab="setup"]')?.click();
  }

  function closePanel() {
    panelEl.classList.remove('is-open');
    document.body.classList.remove('gpb-open');
    setTimeout(() => { if (!S) panelEl.setAttribute('hidden',''); }, 220);
    closePop();
    closeFly();
    closeCfg();
  }

  // ── Static panel wiring (runs once) ───────────────────────

  function buildStaticPanel() {
    if (staticBuilt) return;
    staticBuilt = true;

    // viz type buttons
    document.getElementById('gpbTypes').innerHTML = Object.entries(VIZ_TYPES).map(([id,t]) =>
      `<button class="es-tswatch" data-type="${esc(id)}"><i class="ti ${t.icon}"></i><span>${t.name}</span></button>`
    ).join('');
    document.getElementById('gpbTypes').querySelectorAll('[data-type]').forEach(b =>
      b.onclick = () => setType(b.dataset.type)
    );

    // colors
    document.getElementById('gpbColors').innerHTML = COLORS.map(c =>
      `<button class="es-sw" data-color="${esc(c.hex)}" style="background:${c.hex}"></button>`
    ).join('');
    document.getElementById('gpbColors').querySelectorAll('[data-color]').forEach(b =>
      b.onclick = () => { if (!S) return; S.color = b.dataset.color; syncStyle(); renderCard(); }
    );

    // palettes
    document.getElementById('gpbPalettes').innerHTML = PALETTES.map(p =>
      `<button class="es-pal" data-pal="${esc(p.id)}">${p.cols.map(c=>`<i style="background:${c}"></i>`).join('')}</button>`
    ).join('');
    document.getElementById('gpbPalettes').querySelectorAll('[data-pal]').forEach(b =>
      b.onclick = () => { if (!S) return; S.palette = b.dataset.pal; syncStyle(); renderCard(); }
    );

    // tabs (sólo relevantes en modo clásico; el toggle de modo oculta .es-tabs en D&D)
    panelEl.querySelectorAll('.es-tabs button').forEach(btn => {
      btn.onclick = () => {
        panelEl.querySelectorAll('.es-tabs button').forEach(o => o.classList.toggle('is-on', o===btn));
        panelEl.querySelectorAll('.es-p-b .pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === btn.dataset.tab));
      };
    });

    // toggle de modo de construcción: Clásico ↔ Drag & drop (mismo S)
    panelEl.querySelectorAll('#gpbMode button').forEach(btn => {
      btn.onclick = () => setBuilderMode(btn.dataset.mode);
    });

    // Eventos del modo D&D, delegados en el host estable #gpbDDPane (su innerHTML
    // se reemplaza en cada re-render, por eso se delega en el contenedor).
    const ddPane = document.getElementById('gpbDDPane');
    if (ddPane) {
      // buscador del panel de campos — filtra la lista, no toca S
      ddPane.addEventListener('input', e => {
        const s = e.target.closest('#gpbDDSearch');
        if (!s) return;
        _ddQuery = s.value;
        renderDDPanelOnly();
        const ns = document.getElementById('gpbDDSearch');
        if (ns) { ns.focus(); const v = ns.value; ns.setSelectionRange(v.length, v.length); }
      });

      // inicio del arrastre (campo del panel o chip ya colocado)
      ddPane.addEventListener('dragstart', e => {
        const el = e.target.closest('.bdd-field, .bdd-chip');
        if (!el || el.classList.contains('is-placed')) return;
        _ddDrag = { id: el.dataset.id, kind: el.dataset.kind, from: el.closest('.bdd-drop') ? 'zone' : 'panel' };
        el.classList.add('is-dragging');
        try { e.dataTransfer.setData('text/plain', el.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
      });
      ddPane.addEventListener('dragend', () => {
        ddPane.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging'));
        _ddClearFx();
        _ddDrag = null;
      });

      // validación de zona + línea de inserción
      ddPane.addEventListener('dragover', e => {
        const zone = e.target.closest('.bdd-zone');
        if (!zone || !_ddDrag) return;
        _ddClearFx();
        if (_ddDrag.kind === zone.dataset.accept) {
          e.preventDefault();                              // compatible → permite soltar
          e.dataTransfer.dropEffect = 'move';
          zone.classList.add('is-over');
          const drop  = zone.querySelector('.bdd-drop');
          const chips = drop.querySelectorAll('.bdd-chip');
          if (chips.length) {                              // línea de inserción entre chips
            const idx = _ddInsertIndex(drop, e.clientY);
            const ins = document.createElement('div');
            ins.className = 'bdd-ins';
            if (idx >= chips.length) drop.appendChild(ins); else drop.insertBefore(ins, chips[idx]);
          }
        } else {
          zone.classList.add('is-bad');                    // incompatible → no preventDefault (not-allowed)
        }
      });
      ddPane.addEventListener('dragleave', e => {
        const zone = e.target.closest('.bdd-zone');
        if (zone && !zone.contains(e.relatedTarget)) {
          zone.classList.remove('is-over', 'is-bad');
          zone.querySelectorAll('.bdd-ins').forEach(i => i.remove());
        }
      });
      ddPane.addEventListener('drop', e => {
        const zone = e.target.closest('.bdd-zone');
        if (!zone || !_ddDrag || _ddDrag.kind !== zone.dataset.accept) { _ddClearFx(); return; }
        e.preventDefault();
        const idx = _ddInsertIndex(zone.querySelector('.bdd-drop'), e.clientY);
        if (_ddDrag.from === 'zone') ddMoveWithin(_ddDrag.kind, _ddDrag.id, idx);
        else                         ddAddField(_ddDrag.kind, _ddDrag.id, idx);
        _ddDrag = null;
        ddSyncFromS();
      });

      // quitar chip (×) + cambiar tipo (segmented)
      ddPane.addEventListener('click', e => {
        const typeBtn = e.target.closest('#gpbDDSeg button[data-type]');
        if (typeBtn) { ddSetType(typeBtn.dataset.type); return; }
        const rmDim = e.target.closest('[data-rmdim]');
        if (rmDim) { S.dimensions = (S.dimensions || []).filter(d => d.id !== rmDim.dataset.rmdim); ddSyncFromS(); return; }
        const rmMet = e.target.closest('[data-rm]');
        if (rmMet) { S.metrics = (S.metrics || []).filter(m => m.id !== rmMet.dataset.rm); ddSyncFromS(); return; }
      });

      // cambiar agregación del chip de métrica → actualiza S y re-renderiza la card en vivo
      ddPane.addEventListener('change', e => {
        const sel = e.target.closest('[data-agg-for]');
        if (!sel) return;
        const it = (S.metrics || []).find(m => m.id === sel.dataset.aggFor);
        if (it) { it.agg = sel.value; ddSyncFromS(); }
      });
    }

    // scope
    document.getElementById('gpbScope').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        if (!S) return;
        document.getElementById('gpbScope').querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o===b));
        S.scope = b.dataset.scope;
        pulseNext = true; renderCard();
      };
    });

    // size
    document.getElementById('gpbSize').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        if (!S) return;
        document.getElementById('gpbSize').querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o===b));
        S.size = b.dataset.size;
        if (draftCard) draftCard.dataset.size = S.size;
        syncSizeToggle();
        renderCard();
      };
    });

    // toggles
    panelEl.querySelectorAll('[data-toggle]').forEach(b => {
      b.onclick = () => {
        if (!S) return;
        S[b.dataset.toggle] = !S[b.dataset.toggle];
        b.classList.toggle('is-on', S[b.dataset.toggle]);
        renderCard();
      };
    });

    // title input
    document.getElementById('gpbTitle').addEventListener('input', e => {
      if (!S) return; S.title = e.target.value; renderCard();
    });

    // add metric
    document.getElementById('gpbAddMetric').onclick = e => { closePop(); openFly(e.currentTarget); };

    // range / compare selects
    document.getElementById('gpbRange').onclick = e => togglePop(e.currentTarget, 'range');
    document.getElementById('gpbCompare').onclick = e => togglePop(e.currentTarget, 'compare');

    // drag-to-metric-well
    const metZone = document.getElementById('gpbMetZone');
    metZone.addEventListener('dragover', e => { if (dragMetricId) { e.preventDefault(); metZone.classList.add('drag-over'); } });
    metZone.addEventListener('dragleave', () => metZone.classList.remove('drag-over'));
    metZone.addEventListener('drop', e => { if (!dragMetricId) return; e.preventDefault(); addMetric(dragMetricId); metZone.classList.remove('drag-over'); });

    // buttons
    document.getElementById('gpbCancel').onclick = cancelBuild;
    document.getElementById('gpbSave').onclick = saveCard;
    document.getElementById('gpbConfigBtn').onclick = openCfg;

    // flyout close
    document.getElementById('gpbFlyClose').onclick = closeFly;
    flyBk.onclick = closeFly;
    document.getElementById('gpbFlySearch').addEventListener('input', e => renderFlyBody(e.target.value.trim().toLowerCase()));

    // popover close
    popBk.onclick = closePop;
    // Clicks INSIDE the popover must never bubble out — otherwise an option click can
    // reach an outside-click / view-switch handler and close the whole builder panel.
    popEl.addEventListener('click', e => e.stopPropagation());

    // cfg drawer
    document.getElementById('gpbCfgClose').onclick = closeCfg;
    cfgBk.onclick = closeCfg;
    document.getElementById('gpbCfgCopy').onclick = () => {
      const txt = JSON.stringify(buildConfig(S), null, 2);
      navigator.clipboard?.writeText(txt).catch(()=>{});
      const b = document.getElementById('gpbCfgCopy');
      const o = b.innerHTML; b.innerHTML = '<i class="ti ti-check" style="font-size:13px"></i>Copied';
      setTimeout(()=>b.innerHTML=o, 1400);
    };
    document.getElementById('gpbCfgSave').onclick = () => { closeCfg(); saveCard(); };

    // toast
    document.getElementById('gpbToastAct').onclick = () => toastEl.classList.remove('is-on');

    // ESC key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closePop(); closeFly(); }
    });
  }

  // ── Type / metric management ──────────────────────────────

  function setType(id) {
    if (!S) return;
    pulseNext = true;
    S.type = id;
    const t = VIZ_TYPES[id];
    if (S.metrics.length > t.max) S.metrics = S.metrics.slice(0, t.max);
    S.metrics.forEach(m => { const cat = catalogMap.get(m.id); if (cat?.kind === 'peak' && !AGG[m.agg]?.peakOk) m.agg = 'avg'; });
    if (!S.dimensions) S.dimensions = [];
    if (S.dimensions.length > (t.dimMax || 0)) S.dimensions = S.dimensions.slice(0, t.dimMax || 0);
    syncAll();
  }

  function addMetric(id) {
    if (!S) return;
    pulseNext = true;
    const t = VIZ_TYPES[S.type];
    const idx = S.metrics.findIndex(m => m.id === id);
    if (idx >= 0) {
      S.metrics.splice(idx, 1);
    } else if (t.max === 1) {
      const cat = catalogMap.get(id);
      S.metrics = [{ id, agg: defaultAgg(cat?.kind || 'accum') }];
    } else if (S.metrics.length < t.max) {
      const cat = catalogMap.get(id);
      S.metrics.push({ id, agg: defaultAgg(cat?.kind || 'accum') });
    }
    syncAll();
  }

  function addDimension(id) {
    if (!S || !DIM_MAP.has(id)) return;
    pulseNext = true;
    const dmax = VIZ_TYPES[S.type].dimMax || 0;
    if (!S.dimensions) S.dimensions = [];
    const idx = S.dimensions.findIndex(d => d.id === id);
    if (idx >= 0)            S.dimensions.splice(idx, 1);   // toggle off
    else if (dmax === 0)     return;                        // viz takes no dimensions
    else if (dmax === 1)     S.dimensions = [{ id }];       // single → replace
    else if (S.dimensions.length < dmax) S.dimensions.push({ id });
    syncAll();
  }

  // ── Sync functions ────────────────────────────────────────

  function syncAll() { syncTypes(); renderMetrics(); syncSelects(); syncStyle(); syncHeader(); syncSizeToggle(); renderCard(); }

  function syncTypes() {
    if (!S) return;
    document.getElementById('gpbTypes').querySelectorAll('[data-type]').forEach(b =>
      b.classList.toggle('is-on', b.dataset.type === S.type)
    );
    document.getElementById('gpbMetHint').textContent = VIZ_REQ_LBL[S.type];
    document.getElementById('gpbScope').querySelectorAll('button').forEach(b =>
      b.classList.toggle('is-on', b.dataset.scope === S.scope)
    );
  }

  function syncSelects() {
    if (!S) return;
    document.getElementById('gpbRangeName').textContent   = RANGES.find(r=>r.id===S.range)?.name  || S.range;
    document.getElementById('gpbCompareName').textContent =
      (S.compare === 'mc')
        ? `vs ${mcLabel(S.refMcId)}`
        : (COMPARES.find(c=>c.id===S.compare)?.name || S.compare);
  }

  function syncStyle() {
    if (!S) return;
    document.getElementById('gpbColors').querySelectorAll('[data-color]').forEach(b =>
      b.classList.toggle('is-on', b.dataset.color === S.color)
    );
    document.getElementById('gpbPalettes').querySelectorAll('[data-pal]').forEach(b =>
      b.classList.toggle('is-on', b.dataset.pal === S.palette)
    );
    document.getElementById('gpbSize').querySelectorAll('button').forEach(b =>
      b.classList.toggle('is-on', b.dataset.size === S.size)
    );
    panelEl.querySelectorAll('[data-toggle]').forEach(b =>
      b.classList.toggle('is-on', !!S[b.dataset.toggle])
    );
    // viz-specific style options (data-only="line" / "bars") hidden for other types
    panelEl.querySelectorAll('[data-only]').forEach(el =>
      el.style.display = el.dataset.only.split(',').includes(S.type) ? '' : 'none'
    );
    if (draftCard) draftCard.style.setProperty('--cm-accent', S.color);
  }

  function syncHeader() {
    if (!S) return;
    const t = VIZ_TYPES[S.type];
    document.getElementById('gpbSelIcon').innerHTML = `<i class="ti ${t.icon}"></i>`;
    document.getElementById('gpbSelName').textContent = autoTitle(S);
    document.getElementById('gpbSelKind').textContent = VIZ_FULLNAME[S.type].toLowerCase() + ' · draft';
  }

  function syncSizeToggle() {
    if (!draftCard || !S) return;
    const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
    draftCard.querySelectorAll('.size-toggle button').forEach(b =>
      b.classList.toggle('is-on', map[b.textContent.trim()] === S.size)
    );
    draftCard.dataset.size = S.size;
  }

  function dimBadge() {
    if (S.type === 'scatter') return 'color';
    if (S.type === 'table')   return 'row';
    return 'X';   // bars / line / ranking / heatmap → category axis
  }

  function renderMetrics() {
    if (!S) return;
    const wrap = document.getElementById('gpbMetrics');
    if (!S.dimensions) S.dimensions = [];
    const dimsHtml = S.dimensions.map(d => {
      const def = DIM_MAP.get(d.id);
      if (!def) return '';
      return `<div class="es-field is-dim" data-dim="${esc(d.id)}">
        <span class="ftype dim">${dimBadge()}</span>
        <div class="fnm">
          <div class="t">${esc(def.name)}</div>
          <div class="s"><i class="ti ti-dimensions" style="font-size:11px;opacity:.6"></i> dimension</div>
        </div>
        <button class="frm" data-rmdim="${esc(d.id)}"><i class="ti ti-x"></i></button>
      </div>`;
    }).join('');
    wrap.innerHTML = dimsHtml + S.metrics.map((m, i) => {
      const cat = catalogMap.get(m.id);
      if (!cat) return '';
      const role = S.type === 'scatter' ? (i===0?'X':'Y') : (i+1);
      const agg  = AGG[m.agg] || { icon:'ti-hash', short:'?' };
      return `<div class="es-field" draggable="true" data-idx="${i}" data-id="${esc(m.id)}">
        <span class="ftype met">${role}</span>
        <div class="fnm">
          <div class="t">${esc(cat.name)}</div>
          <div class="s"><span class="pk ${cat.kind}"></span>${esc(cat.unit)} · ${cat.kind}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          ${S.type === 'bars' ? `<button data-line-for="${esc(m.id)}" title="Mostrar como línea (eje secundario)" style="border:1px solid var(--cm-border);background:${m.line?'var(--cm-accent)':'var(--cm-bg-soft)'};color:${m.line?'var(--cm-fg-on-accent)':'var(--cm-fg-muted)'};border-radius:5px;width:20px;height:20px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center"><i class="ti ti-chart-line" style="font-size:12px"></i></button>` : ''}
          <button class="es-aggchip" data-agg-for="${esc(m.id)}">
            <i class="ti ${agg.icon}"></i>${agg.short}<i class="ti ti-chevron-down" style="font-size:11px"></i>
          </button>
          <button class="frm" data-rm="${esc(m.id)}"><i class="ti ti-x"></i></button>
        </div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-line-for]').forEach(b => b.onclick = () => {
      const m = S.metrics.find(x => x.id === b.dataset.lineFor);
      if (m) { m.line = !m.line; renderMetrics(); renderCard(); }
    });
    wrap.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => addMetric(b.dataset.rm));
    wrap.querySelectorAll('[data-rmdim]').forEach(b => b.onclick = () => addDimension(b.dataset.rmdim));
    wrap.querySelectorAll('[data-agg-for]').forEach(b => {
      b.onclick = () => {
        popEl.dataset.field = b.dataset.aggFor;
        if (popOwner === b) { closePop(); return; }
        closePop();
        openPop(popHTML('agg'), b, 'agg');
      };
    });

    // reorder by drag (metric fields only — dimension chips aren't reorderable)
    wrap.querySelectorAll('.es-field:not(.is-dim)').forEach(el => {
      el.addEventListener('dragstart', e => { e.stopPropagation(); reorderFrom = +el.dataset.idx; el.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend',   () => { el.classList.remove('is-dragging'); reorderFrom = null; wrap.querySelectorAll('.drop-before').forEach(n=>n.classList.remove('drop-before')); });
      el.addEventListener('dragover',  e => { if (reorderFrom===null) return; e.preventDefault(); wrap.querySelectorAll('.drop-before').forEach(n=>n.classList.remove('drop-before')); el.classList.add('drop-before'); });
      el.addEventListener('drop',      e => {
        if (reorderFrom === null) return; e.preventDefault();
        const to = +el.dataset.idx;
        if (to !== reorderFrom) { const [moved] = S.metrics.splice(reorderFrom, 1); S.metrics.splice(to, 0, moved); pulseNext = true; syncAll(); }
      });
    });

    const t = VIZ_TYPES[S.type];
    document.getElementById('gpbAddMetric').classList.toggle('disabled', S.metrics.length >= t.max && t.max > 1);
    document.getElementById('gpbMetReq').style.opacity = S.metrics.length >= t.min ? '.25' : '1';
  }

  // ── Card rendering ────────────────────────────────────────

  function bodyClass(type) {
    if (type === 'kpi')     return 'gp-c-b gp-kpi';
    if (type === 'radar')   return 'gp-c-b gp-radar';
    if (type === 'scatter') return 'gp-c-b gp-scatter';
    if (type === 'line')    return 'gp-c-b gp-ts';
    return 'gp-c-b';
  }

  function renderCard() {
    if (!S || !draftCard) return;
    closeTfPane();   // structural change (viz/metrics/dims/style) → drop any open column-rules panel
    const t = VIZ_TYPES[S.type];
    draftCard.dataset.size = S.size;
    draftCard.style.setProperty('--cm-accent', S.color);
    updateDraftHeader();
    syncHeader();

    const valid = S.metrics.length >= t.min;
    const saveBtn  = document.getElementById('gpbSave');
    const saveHint = document.getElementById('gpbSaveHint');
    const addBtn   = document.getElementById('gpbAddMetric');
    if (saveBtn)  saveBtn.disabled = !valid;
    if (saveHint) saveHint.style.display = valid ? 'none' : 'inline';
    // pulse "Add metric" button when no metrics and panel is on Setup tab
    if (addBtn) addBtn.classList.toggle('gpb-pulse', !valid && S.metrics.length === 0);

    const body = document.getElementById('gpbDraftBody') || draftCard.querySelector('.gp-c-b');
    if (!body) return;
    destroyBodyChart(body);

    const nd = noDataReason(S);
    if (!valid) { showState(body, 'await'); return; }
    if (nd)     { showState(body, 'nodata', nd); return; }
    if (pulseNext) { pulseNext = false; showState(body, 'load'); setTimeout(renderCard, 460); return; }

    draftCard.classList.remove('is-draft');
    body.className = bodyClass(S.type);
    if (S.type === 'radar') mountRadarPreview(body, S);
    else if (S.type === 'bars') mountBarsPreview(body, S);
    else if (S.type === 'line') mountLinePreview(body, S);
    else if (S.type === 'scatter') mountScatterPreview(body, S);
    else if (S.type === 'kpi') mountKpiPreview(body, S);
    else if (S.type === 'ranking') mountRankingPreview(body, S);
    else if (S.type === 'table') mountTablePreview(body, S);
    else body.innerHTML = renderType(S);
  }

  function showState(body, kind, msg) {
    draftCard.classList.add('is-draft');
    body.className = 'gp-c-b';
    const t = VIZ_TYPES[S.type];
    if (kind === 'await') {
      body.innerHTML = `<div class="cb2-await"><div class="ic"><i class="ti ${t.icon}"></i></div><div class="t">${VIZ_FULLNAME[S.type]} — ${VIZ_REQ_LBL[S.type]}</div><div class="d">Add metrics from the Setup panel.</div></div>`;
    } else if (kind === 'load') {
      body.innerHTML = `<div class="cb2-state load"><div class="cb2-spin"></div><div class="t">Querying GPS data…</div><div class="d">${esc(autoTitle(S))} · ${RANGES.find(r=>r.id===S.range)?.name||S.range}</div></div>`;
    } else if (kind === 'nodata') {
      body.innerHTML = `<div class="cb2-state empty"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No data for this selection</div><div class="d">${esc(msg)}</div><button class="cm-btn is-outline is-sm" id="gpbFixScope" style="margin-top:4px"><i class="ti ti-user" style="font-size:14px"></i>Switch to Player</button></div>`;
      document.getElementById('gpbFixScope')?.addEventListener('click', () => {
        S.scope = 'player';
        document.getElementById('gpbScope').querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.scope==='player'));
        document.getElementById('gpbDimName').textContent = 'Player';
        pulseNext = true; renderCard();
      }, { once:true });
    }
  }

  function updateDraftHeader() {
    if (!draftCard || !S) return;
    const titleEl = document.getElementById('gpbDraftTitle') || draftCard.querySelector('.ttl');
    const subEl   = document.getElementById('gpbDraftSub')   || draftCard.querySelector('.sub');
    if (titleEl) titleEl.textContent = autoTitle(S);
    if (subEl) {
      const agg0 = S.metrics[0] ? (AGG[S.metrics[0].agg]?.short.toLowerCase() || '') : '';
      subEl.textContent = `${VIZ_FULLNAME[S.type].toLowerCase()}${agg0?' · '+agg0:''} · ${S.scope}`;
    }
  }

  // ── Current view helper ──────────────────────────────────────

  function _currentView() {
    return document.querySelector('.gp-view.is-on')?.dataset.view || 'ind';
  }

  // ── Shared drawing engine (window.GpRender.renderCard) ────────────────
  // Pure DRAW: takes a gp.card/v1 `config` + already-prepared `series` and renders
  // into `container`. NEVER queries the DB. Any DB-derived extras (role baseline,
  // KPI delta/sparkline, line reference series) are computed by the caller and
  // handed in via `opts` so this engine stays reusable across dashboards.
  //
  //   opts = { baselineMap, mcNames, lineSeries, baselineMap (kpi), mcRefName, sparkSeries, editable, example }
  //
  // Supports every builder viz: kpi, bars, line, scatter, radar, ranking, table
  // (table includes conditional formatting + column sort). Each mountX handles its
  // own unique-canvas + previous-chart destroy.
  function _renderCardInto(container, config, series, opts = {}) {
    // Apply the body viz-class without clobbering host classes (add base + swap modifier).
    container.classList.add('gp-c-b');
    container.classList.remove('gp-kpi', 'gp-radar', 'gp-scatter', 'gp-ts');
    const mod = config.viz === 'kpi' ? 'gp-kpi' : config.viz === 'radar' ? 'gp-radar'
              : config.viz === 'scatter' ? 'gp-scatter' : config.viz === 'line' ? 'gp-ts' : null;
    if (mod) container.classList.add(mod);

    switch (config.viz) {
      case 'radar':   mountRadarChart(container, config, series, opts.baselineMap || null); break;
      case 'bars':    mountBarsChart(container, config, series, opts.mcNames || null); break;
      case 'line':    mountLineChart(container, config, opts.lineSeries || series); break;
      case 'scatter': mountScatterChart(container, config, series); break;
      case 'kpi':     mountKpiCard(container, config, series, { baselineMap: opts.baselineMap || null, mcRefName: opts.mcRefName || null, sparkSeries: opts.sparkSeries || null, example: opts.example }); break;
      case 'ranking': mountRankingCard(container, config, series); break;
      case 'table':   mountTableCard(container, config, series, { editable: !!opts.editable, example: opts.example }); break;
      default:        destroyBodyChart(container); container.innerHTML = renderTypeFromDataset(config, series, opts);
    }
  }

  // ── Resolve real data and re-render a saved card ──────────────────────

  /**
   * One-line diagnostics for an empty/odd render, labelled by card TITLE so two
   * cards on the same dashboard can be compared (e.g. "Match metric" finds matches,
   * "High intensity per match" doesn't → compare their range/filters/sessionIds).
   * Silenced with window.GPB_DEBUG = false.
   */
  function _gpbDiag(config, FB, ctx, extra) {
    if (window.GPB_DEBUG === false) return;
    try {
      const filters = FB ? {
        date:        FB.date?.preset || FB.date?.from || FB.date?.to || null,
        mdCodes:     FB.mdCodes?.length     ? FB.mdCodes     : null,
        players:     FB.playerIds?.length   || 0,
        positions:   FB.positions?.length   ? FB.positions   : null,
        microcycles: FB.microcycleIds?.length || 0,
      } : '(filter bar not mounted)';
      console.log(`[gpb:diag] «${config.title || config.viz}»`, {
        viz: config.viz, scope: config.scope?.level, range: config.range?.type,
        metrics: (config.metrics || []).map(m => m.id),
        dims: (config.dimensions || []).map(d => d.id),
        comparison: config.comparison || null,
        mcId: ctx?.mcId || null, filters, ...extra,
      });
    } catch { /* diagnostics must never break a render */ }
  }

  /**
   * Fetches real GPS data for a saved card and re-renders its body.
   * Fires asynchronously — the card body shows a loading spinner first.
   *
   * @param {HTMLElement} cardEl  the .gp-c element
   * @param {object}      config  gp.card/v1 object
   */
  async function resolveAndRenderCard(cardEl, config) {
    const body = cardEl.querySelector('.gp-c-b');
    if (!body) return;

    // Per-element request token: the live builder preview re-resolves on every change,
    // so an older (slower) query must not overwrite a newer one. Saved cards each have
    // their own element, so this never cancels across cards.
    const seq   = (cardEl.__resolveSeq = (cardEl.__resolveSeq || 0) + 1);
    const stale = () => cardEl.__resolveSeq !== seq;

    // Show loading spinner
    destroyBodyChart(body);
    body.className = 'gp-c-b';
    body.innerHTML = `<div class="cb2-state load"><div class="cb2-spin"></div><div class="t">Loading GPS data…</div></div>`;

    try {
      // Context readiness (TIMING): a card can be rendered during dashboard boot —
      // before the club context is resolved. Wait, showing the spinner, for clubId +
      // Supabase so the FIRST render uses the SAME context as a later filter re-render.
      // A card that mounts early is never left stuck on an empty result: it resolves
      // as soon as the context is ready (just like a filter change would).
      for (let i = 0; i < 80; i++) {
        if (stale()) return;
        if ((_clubId || window._gpClubId) && window.sb) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (stale()) return;

      const { applyAgg, aggregateSeries, getSessionIds, getMcSessionIds, fetchReports, fetchEavMetrics, fetchRoleBaseline, enrichMcDiff, CORE_COLS } = await _importResolver();
      if (stale()) return;
      if (!applyAgg) return; // resolver not available

      const ctx = {
        clubId:   _clubId || window._gpClubId || null,
        playerId: window._gpPlayerId || window.gpState?.playerId || null,
        mcId:     window._gpMcId     || window.gpState?.mcId     || null,
        asOf:     new Date().toISOString().slice(0, 10),
      };

      const sb = window.sb;

      // Dashboard filter bar (GPS Chart Reference §6, Parte B): the active filters are
      // the single source of "what data am I seeing". Every active filter is AND-ed
      // (Power-BI style):
      //   · date     → overrides the card's own range (only when active)
      //   · MD       → narrows sessions to the chosen md_code set (session level, so
      //                reports AND role baselines stay consistent)
      //   · player   → narrows gps_reports rows to the chosen players
      //   · position → narrows rows to players in the chosen positions
      //   · microcycle → narrows rows to the chosen microcycle_id set
      const FB = window.gpFilterBar?.getState?.() || null;

      // Step 1: session IDs — a date filter, if active, wins over the card range.
      let sessionIds = await getSessionIds(_fbEffectiveRange(FB, config.range), ctx, sb);
      if (stale()) return;
      if (FB?.mdCodes?.length && sessionIds.length) {
        const want = new Set(FB.mdCodes.map(String));
        const { data: ts } = await sb.from('training_sessions')
          .select('id,session_attributes').in('id', sessionIds);
        if (stale()) return;
        sessionIds = (ts || [])
          .filter(s => want.has(String(s.session_attributes?.md_code ?? '')))
          .map(s => s.id);
      }
      if (!sessionIds.length) {
        _gpbDiag(config, FB, ctx, { stage: 'NO SESSIONS', effectiveRange: _fbEffectiveRange(FB, config.range), sessionIds: 0 });
        _showCardState(cardEl, body, 'nodata', 'No sessions match the active filters.', config);
        return;
      }

      // Step 2: reports — then narrow rows by player / position (AND).
      const rawRows = await fetchReports(sessionIds, config, ctx, catalogMap, sb);
      const rows = _fbFilterRows(rawRows, FB);
      if (stale()) return;
      if (!rows.length) {
        _gpbDiag(config, FB, ctx, { stage: 'NO ROWS', sessionIds: sessionIds.length, rowsBeforeFbFilter: rawRows.length, rowsAfter: 0 });
        _showCardState(cardEl, body, 'nodata', 'No GPS data for this selection.', config);
        return;
      }

      // Step 3: EAV
      const customKeys = config.metrics.filter(m => !CORE_COLS.has(m.id)).map(m => m.id);
      const eavMap = customKeys.length
        ? await fetchEavMetrics(rows.map(r => r.id), customKeys, _clubId, sb)
        : new Map();
      if (stale()) return;

      // Step 4: aggregate
      let series = aggregateSeries(rows, eavMap, config, catalogMap);

      // Diagnostics: prove the series is 100% real (gps_reports/Supabase) and let you
      // cross-check the total against Session Control. Silence with window.GPB_DEBUG=false.
      if (window.GPB_DEBUG !== false) {
        try {
          const rawTotal = mid => {
            let sum = 0, n = 0;
            for (const r of rows) {
              const v = CORE_COLS.has(mid) ? Number(r[mid]) : Number(eavMap.get(r.id)?.[mid]);
              if (v != null && !isNaN(v)) { sum += v; n++; }
            }
            return { metric: catalogMap.get(mid)?.name || mid, rows_with_value: n, raw_total: Math.round(sum * 10) / 10 };
          };
          const scopeLbl = `${config.scope?.level || '?'}${ctx.playerId ? ' · ' + ctx.playerId : ''}`;
          console.groupCollapsed(`[gpb] «${config.title || config.viz}» · ${config.viz} · ${(config.metrics || []).map(m => m.id).join(', ')} · ${scopeLbl}`);
          console.log('range:', config.range?.type, '→ sessionIds (getSessionIds):', sessionIds.length, sessionIds);
          console.log('rows from gps_reports (fetchReports):', rows.length);
          console.table((config.metrics || []).map(m => rawTotal(m.id)));
          console.log('aggregated series (what the chart plots):',
            series.map(s => ({ metric: s.name, agg: config.metrics.find(m => m.id === s.label)?.agg, points: s.points.length,
                               x: s.points.map(p => p.x), y: s.points.map(p => p.y) })));
          // Line wants a temporal X. Empty dimensions → resolver groups by time (correct).
          // A non-Time dimension means the X axis isn't temporal — warn loudly.
          if (config.viz === 'line') {
            const d0 = config.dimensions?.[0]?.id;
            const TIME_DIMS = new Set(['session_date', 'md_code', 'microcycle']);
            if (!d0) console.log('line X dimension: (none) → grouped by session/MD/microcycle (temporal default) ✓');
            else if (TIME_DIMS.has(d0)) console.log('line X dimension:', d0, '(temporal) ✓');
            else console.warn(`line X dimension is "${d0}" — NOT temporal. A line/temporal chart expects microcycle/date; pick a Time dimension (or none).`);
          }
          console.groupEnd();
        } catch (e) { /* diagnostics must never break a render */ }
      }

      // Step 5: render
      if (stale()) return;
      const hasData = series.some(s => s.points.length > 0);
      if (!hasData) {
        _gpbDiag(config, FB, ctx, { stage: 'NO HASDATA', sessionIds: sessionIds.length, rows: rows.length,
          seriesPoints: series.map(s => ({ metric: s.label, points: s.points.length })) });
        _showCardState(cardEl, body, 'nodata', 'No rows match the current scope, range and filters.', config);
        return;
      }

      // Step 5a: "vs microciclo" — the current series above is the card's own range;
      // here we resolve the REFERENCE microcycle through the same pipeline and reshape
      // `series` into per-metric/per-player diff% (vs ref). Bars/ranking/table/scatter
      // then render the diff straight from the reshaped series. Other comparisons
      // (role/match/none) and other vizzes are untouched.
      // GUARD: this path runs ONLY for a card that explicitly asks for an MC diff
      // (baseline 'mc' + a refMcId) on a viz that uses it. Every other card —
      // role/match/md/none, or no comparison at all — skips this block entirely and
      // the resolver behaves exactly as before. If anything here fails, we DEGRADE to
      // no comparison (keep the already-computed `series`) and never tumble the card.
      const MC_VIZ = new Set(['bars', 'ranking', 'table', 'scatter', 'kpi', 'heatmap']);
      let mcNamesForDraw = null;   // MC legend labels (bars) / ref name (kpi)
      if (window.GPB_DEBUG !== false) console.log('[gpb:mc-gate]', config.title, {
        baselineIsMc: config.comparison?.baseline === 'mc',
        refMcId: config.comparison?.refMcId,
        refValid: _validMcId(config.comparison?.refMcId),   // microcycle id is TEXT, not uuid
        hasFn: typeof getMcSessionIds === 'function',
        vizOk: MC_VIZ.has(config.viz),
        viz: config.viz,
      });
      if (config.comparison?.baseline === 'mc' && _validMcId(config.comparison?.refMcId)
          && typeof getMcSessionIds === 'function' && MC_VIZ.has(config.viz)) {
        try {
          let refSessions = await getMcSessionIds(config.comparison.refMcId, ctx, sb);
          if (stale()) return;
          // Same MD-code narrowing as the current side (session level), but NOT the
          // microcycle filter — the reference set IS a specific microcycle.
          if (FB?.mdCodes?.length && refSessions.length) {
            const want = new Set(FB.mdCodes.map(String));
            const { data: ts } = await sb.from('training_sessions')
              .select('id,session_attributes').in('id', refSessions);
            if (stale()) return;
            refSessions = (ts || [])
              .filter(s => want.has(String(s.session_attributes?.md_code ?? '')))
              .map(s => s.id);
          }
          let refSeries = [];
          if (refSessions.length) {
            const refFB = FB ? { ...FB, microcycleIds: [] } : null;   // keep player/position parity
            const refRows = _fbFilterRows(await fetchReports(refSessions, config, ctx, catalogMap, sb), refFB);
            if (stale()) return;
            if (refRows.length) {
              const refEav = customKeys.length
                ? await fetchEavMetrics(refRows.map(r => r.id), customKeys, _clubId, sb)
                : new Map();
              if (stale()) return;
              refSeries = aggregateSeries(refRows, refEav, config, catalogMap);
            }
          }
          // Only apply when the reference actually has data — otherwise degrade to no
          // comparison (render the current values) instead of all-zero bars.
          if (refSeries.some(s => s.points && s.points.length)) {
            // Names for the two sides. The CURRENT side is whatever the card shows
            // (filter bar's single-MC filter if active, else the card's current MC);
            // the REFERENCE side is the card's comparison.refMcId. These are kept
            // separate on purpose: the filter narrows what's current, the comparison
            // brings the second MC to contrast against.
            const curMcId = (FB?.microcycleIds?.length === 1 ? FB.microcycleIds[0] : null) || ctx.mcId;
            const mcNames = { cur: curMcId ? mcLabel(curMcId) : 'Actual', ref: mcLabel(config.comparison.refMcId) };
            const enriched = (enrichMcDiff || _enrichMcDiff)(series, refSeries);   // resolver helper (shared), local fallback
            if (config.viz === 'bars' || config.viz === 'kpi' || config.viz === 'heatmap') {
              // Keep ONE series per metric, enriched (cur/ref/diff on each point). The
              // bar engine splits cur/ref bars; the KPI reads point.diff per metric; the
              // heatmap colours each cell by point.diff. Logic lives in those renderers.
              series = enriched;
              mcNamesForDraw = mcNames;
            } else {
              const reshaped = _mcReshape(config, enriched, mcNames);   // ranking/table/scatter
              if (Array.isArray(reshaped) && reshaped.length) series = reshaped;
            }
          } else {
            console.warn('gpb mc comparison: reference microcycle has no data — degrading to no comparison');
          }
        } catch (e) {
          console.warn('gpb mc comparison failed — degrading to no comparison:', e);
        }
        if (stale()) return;
      }

      // Step 5b: compute the DB-derived extras this card needs, then hand the actual
      // drawing to the shared engine (_renderCardInto / GpRender.renderCard).
      const drawOpts = { editable: cardEl === draftCard, mcNames: mcNamesForDraw };

      if (config.viz === 'radar') {
        // Per-axis role baseline drives the radial scale (so axes don't collapse).
        // Fetched for any player-scope radar; the baseline RING is only drawn when
        // comparison ≠ none (radarChartData keys that off config.comparison).
        if (config.scope.level === 'player' && fetchRoleBaseline) {
          try { drawOpts.baselineMap = await fetchRoleBaseline(sessionIds, config, ctx, catalogMap, sb); }
          catch (e) { console.warn('gpb role baseline:', e); }
        }
      } else if (config.viz === 'line') {
        // Single-metric, player-scope line vs role → append a flat dashed reference
        // line at the role baseline. Multi-metric is left un-referenced (mixed units).
        let lineSeries = series;
        if (config.comparison?.baseline === 'role' && config.scope.level === 'player'
            && fetchRoleBaseline && series.length === 1 && series[0].points.length) {
          try {
            const bmap = await fetchRoleBaseline(sessionIds, config, ctx, catalogMap, sb);
            const bval = bmap?.get(series[0].label);
            if (bval != null && bval > 0) lineSeries = [series[0], {
              label: '__baseline', name: 'Role baseline', unit: series[0].unit, dashed: true,
              points: series[0].points.map(p => ({ x: p.x, y: bval })),
            }];
          } catch (e) { console.warn('gpb line baseline:', e); }
        }
        if (stale()) return;
        // Cache real series so the builder preview can re-render style-only changes
        // (color, area, points) instantly, without hitting Supabase again.
        cardEl.__previewCache = { sig: _dataSig(config), series: lineSeries };
        drawOpts.lineSeries = lineSeries;
      } else if (config.viz === 'kpi') {
        // Per-metric delta from the EXISTING comparison block:
        //  · mc    → already on the series points (.diff), enriched by Step 5a above.
        //  · role  → fetchRoleBaseline returns a per-metric map (use it directly).
        //  · match → getMatchBaseline per metric (player scope) → map.
        // mc's ref name (for the "vs MC ref" caption) comes from Step 5a.
        const cmp = config.comparison?.baseline;
        drawOpts.mcRefName = mcNamesForDraw?.ref || null;
        if ((cmp === 'role' || cmp === 'match') && config.metrics?.length) {
          const bmap = new Map();
          try {
            if (cmp === 'role' && fetchRoleBaseline) {
              const rb = await fetchRoleBaseline(sessionIds, config, ctx, catalogMap, sb);
              if (rb) for (const m of config.metrics) { const v = rb.get(m.id); if (v != null) bmap.set(m.id, v); }
            } else if (cmp === 'match' && config.scope.level === 'player' && ctx.playerId && window.getMatchBaseline) {
              for (const m of config.metrics) {
                const r = await window.getMatchBaseline(ctx.playerId, m.id, _clubId, {});
                if (r && r.baseline != null) bmap.set(m.id, r.baseline);
              }
            }
          } catch (e) { console.warn('gpb kpi baseline:', e); }
          if (bmap.size) drawOpts.baselineMap = bmap;
        }
        if (stale()) return;
        // Sparkline (single-metric KPI only) = metrics[0] re-aggregated over time.
        if (config.metrics?.length === 1) {
          try {
            const trend = aggregateSeries(rows, eavMap, { ...config, viz: 'line', dimensions: [] }, catalogMap);
            const tp = trend?.[0]?.points || [];
            if (tp.length >= 2) {
              const byX = new Map(tp.map(p => [p.x, p]));
              drawOpts.sparkSeries = lineSortCats(tp.map(p => p.x)).map(c => byX.get(c)).filter(Boolean);
            }
          } catch (e) { /* sparkline is optional — never break the KPI */ }
        }
      } else if (config.viz === 'heatmap') {
        // Heatmap colours each cell by diff% when a comparison is set. mc already
        // enriched the points (.diff) in Step 5a; role/match need a per-metric
        // baseline map — same source as the KPI — handed to the renderer via opts.
        const cmp = config.comparison?.baseline;
        if ((cmp === 'role' || cmp === 'match') && config.metrics?.length) {
          const bmap = new Map();
          try {
            if (cmp === 'role' && fetchRoleBaseline) {
              const rb = await fetchRoleBaseline(sessionIds, config, ctx, catalogMap, sb);
              if (rb) for (const m of config.metrics) { const v = rb.get(m.id); if (v != null) bmap.set(m.id, v); }
            } else if (cmp === 'match' && config.scope.level === 'player' && ctx.playerId && window.getMatchBaseline) {
              for (const m of config.metrics) {
                const r = await window.getMatchBaseline(ctx.playerId, m.id, _clubId, {});
                if (r && r.baseline != null) bmap.set(m.id, r.baseline);
              }
            }
          } catch (e) { console.warn('gpb heatmap baseline:', e); }
          if (bmap.size) drawOpts.baselineMap = bmap;
        }
        if (stale()) return;
      }

      if (stale()) return;
      _renderCardInto(body, config, series, drawOpts);
      cardEl.classList.remove('is-draft');

    } catch (e) {
      console.warn('gpb resolveAndRenderCard:', e);
      _showCardState(cardEl, body, 'err', 'GPS query failed. Your config is saved — try refreshing.', config);
    }
  }

  // ── "vs microciclo" diff helpers ──────────────────────────────────────────
  // Both series sets come from the SAME pipeline (same metrics, same grouping), so
  // a point matches its reference by (series.label = metric id, point.x = group key).

  /** Attach { cur, ref, diff% } to every current-series point using the reference series. */
  function _enrichMcDiff(series, refSeries) {
    const refIdx = new Map();                      // metricId → Map(x → refValue)
    for (const rs of (refSeries || [])) {
      const m = new Map();
      for (const p of rs.points) m.set(p.x, p.y);
      refIdx.set(rs.label, m);
    }
    return (series || []).map(s => {
      const rm = refIdx.get(s.label);
      const points = s.points.map(p => {
        const rv = rm ? rm.get(p.x) : null;
        const diff = (rv != null && rv !== 0 && !isNaN(rv)) ? (p.y - rv) / rv * 100 : null;
        return { ...p, cur: p.y, ref: (rv == null ? null : rv), diff };
      });
      return { ...s, points };
    });
  }

  /**
   * Reshape enriched series for non-bar vizzes (bars are handled inside barsChartData):
   *   · ranking / table → value becomes diff% (cur/ref kept for tooltips)
   *   · scatter         → two synthetic series for metric 0: X = diff%, Y = current
   * @param {{cur:string, ref:string}} mcNames  legend labels for the two MC sides
   */
  function _mcReshape(config, enriched, mcNames) {
    mcNames = mcNames || { cur: 'Actual', ref: 'Referencia' };
    if (config.viz === 'scatter') {
      const s0 = enriched[0];
      if (!s0) return enriched;
      const name = s0.name || s0.label;
      const diffPts = s0.points.map(p => ({ x: p.x, y: p.diff == null ? 0 : p.diff, cat: p.cat ?? null }));
      const curPts  = s0.points.map(p => ({ x: p.x, y: p.cur == null ? 0 : p.cur,  cat: p.cat ?? null }));
      return [
        { label: s0.label + '__mcdiff', name: `Δ% vs ${mcNames.ref}`, unit: '%', points: diffPts },
        { label: s0.label + '__mccur',  name: `${name} (actual)`, unit: s0.unit || '', points: curPts },
      ];
    }
    // ranking / table: plot the diff%, but carry cur/ref for tooltips/labels.
    return enriched.map(s => ({
      ...s, unit: '%', _mcDiff: true,
      points: s.points.map(p => ({ ...p, y: p.diff == null ? 0 : p.diff })),
    }));
  }

  /** Lazy-imports the resolver from lib/gp-card/resolver.js if available. */
  async function _importResolver() {
    try {
      return await import('../../lib/gp-card/resolver.js');
    } catch {
      return {};
    }
  }

  // ── Dashboard filter bar wiring (GPS Chart Reference §6, Parte B) ─────────
  function _fbDaysBack(days) {
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
  /** Date filter (if active) overrides the card's own range; else keep card range. */
  function _fbEffectiveRange(FB, cardRange) {
    const d = FB?.date;
    if (!d || (!d.preset && !d.from && !d.to)) return cardRange;
    switch (d.preset) {
      case '7':      return { type: 'w7' };
      case '30':     return { type: 'w30' };
      case '90':     return { type: 'custom', from: _fbDaysBack(90) };
      case 'season': return { type: 'season' };
    }
    const r = { type: 'custom' };
    if (d.from) r.from = d.from;
    if (d.to)   r.to   = d.to;
    return r;
  }
  /** Narrow report rows by the player / position / microcycle filters (AND). */
  function _fbFilterRows(rows, FB) {
    if (!FB) return rows;
    let out = rows;
    if (FB.playerIds?.length) { const s = new Set(FB.playerIds); out = out.filter(r => s.has(r.player_id)); }
    if (FB.positions?.length) { const s = new Set(FB.positions); out = out.filter(r => s.has(r.players?.position)); }
    if (FB.microcycleIds?.length) { const s = new Set(FB.microcycleIds.map(String)); out = out.filter(r => s.has(String(r.training_sessions?.microcycle_id ?? ''))); }
    return out;
  }
  /** Re-render every builder card in the active dashboard (called on filter change). */
  function rerenderActiveCards() {
    const grid = document.querySelector('.gp-view.is-on .gp-grid');
    if (!grid) return;
    grid.querySelectorAll('.gp-c[data-card-id]').forEach(el => {
      if (el.__config) resolveAndRenderCard(el, el.__config);
    });
  }

  function _bodyClassFromViz(viz) {
    if (viz === 'kpi')     return 'gp-c-b gp-kpi';
    if (viz === 'radar')   return 'gp-c-b gp-radar';
    if (viz === 'scatter') return 'gp-c-b gp-scatter';
    if (viz === 'line')    return 'gp-c-b gp-ts';
    return 'gp-c-b';
  }

  function _showCardState(cardEl, body, kind, msg, config) {
    cardEl.classList.add('is-draft');
    body.className = 'gp-c-b';
    const vizIcon = VIZ_TYPES[config.viz]?.icon || 'ti-chart-bar';
    if (kind === 'nodata') {
      body.innerHTML = `<div class="cb2-state empty"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No data for this selection</div><div class="d">${esc(msg)}</div></div>`;
    } else if (kind === 'err') {
      body.innerHTML = `<div class="cb2-state err"><div class="ic"><i class="ti ti-alert-triangle"></i></div><div class="t">Couldn't load this card</div><div class="d">${esc(msg)}</div></div>`;
    }
  }

  // ── Radar (Chart.js) ──────────────────────────────────────────
  // Per-axis normalization fixes the "spike" collapse: each metric is shown as
  // a % of its OWN role baseline, so metrics of wildly different magnitudes
  // (Total Distance ~thousands of m vs Distance/Min ~70) share one radial scale
  // without the large one pinning everything else to the centre. The value that
  // is SHOWN (tooltip / data label) stays the REAL value, not the percentage.

  function destroyBodyChart(body) {
    if (body && body.__chart) { try { body.__chart.destroy(); } catch (e) {} body.__chart = null; }
  }
  function showEmptyBody(body, msg) {
    body.innerHTML = `<div class="cb2-state empty"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No data for this selection</div><div class="d">${esc(msg)}</div></div>`;
  }

  /** Draws the REAL value (e.g. "5.2 km") over each player point. No plugin dep. */
  const _radarLabelPlugin = {
    id: 'gpbRadarLabels',
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.show || !opts.labels) return;
      const meta = chart.getDatasetMeta(0);
      if (!meta) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 9px Geist, Inter, sans-serif';
      ctx.fillStyle = opts.color || '#374151';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      meta.data.forEach((pt, i) => { if (opts.labels[i] != null) ctx.fillText(opts.labels[i], pt.x, pt.y - 5); });
      ctx.restore();
    },
  };

  /**
   * Pure: (config, series, baselineMap) → Chart.js radar payload.
   * Each axis normalized as % of its baseline (fallback: own value → 100%).
   * @param {Map<string,number>|null} baselineMap  metricId → baseline value
   */
  function radarChartData(config, series, baselineMap) {
    const color    = config.style?.color || '#15803D';
    const showAxes = config.style?.axes   !== false;
    const showLeg  = config.style?.legend !== false;
    const showLbl  = !!config.style?.dataLabels;
    const hasBaseline  = !!config.comparison?.baseline;
    // Readable names so the 100% reference is obvious at a glance:
    //   ring → gray legend label ("Pico de partido (100%)")
    //   of   → tooltip suffix ("78% del pico")
    const BASELINE_LABELS = {
      role:  { ring: 'Media del puesto (100%)', of: 'de la media' },
      match: { ring: 'Pico de partido (100%)',  of: 'del pico' },
      md:    { ring: 'Mismo MD (100%)',          of: 'del MD' },
    };
    const baselineInfo = hasBaseline ? BASELINE_LABELS[config.comparison.baseline] : null;
    const baselineName = baselineInfo
      ? baselineInfo.ring
      : (hasBaseline ? (COMPARES.find(c => c.id === config.comparison.baseline)?.name || 'Baseline') : null);
    const baselineOf   = baselineInfo ? baselineInfo.of : 'del baseline';

    const ms        = (series || []).filter(s => s.points && s.points.length);
    const labels    = ms.map(s => (s.name || s.label || '').split(' ').slice(0, 2).join(' '));
    const units     = ms.map(s => s.unit || '');
    const realVals  = ms.map(s => s.points[0]?.y ?? 0);
    const refs      = ms.map((s, i) => {
      const b = baselineMap ? baselineMap.get(s.label) : null;
      return (b != null && b > 0) ? b : (realVals[i] || 1);   // fallback: own value → 100%
    });
    const pct        = realVals.map((v, i) => Math.round((v / refs[i]) * 100));
    const realLabels = realVals.map((v, i) => fmt(Math.round(v * 10) / 10) + (units[i] ? ' ' + units[i] : ''));
    const rMax       = Math.ceil(Math.max(120, ...(pct.length ? pct : [120])) / 30) * 30;

    return { labels, pct, realLabels, units, realVals, refs, hasBaseline, baselineName, baselineOf, rMax, color, showAxes, showLeg, showLbl };
  }

  /** Mounts (or re-mounts) a Chart.js radar into `body`. Destroys any prior instance. */
  function mountRadarChart(body, config, series, baselineMap) {
    const d = radarChartData(config, series, baselineMap);
    if (!d.labels.length) { destroyBodyChart(body); body.innerHTML = ''; showEmptyBody(body, 'No rows match the current scope, range and filters.'); return; }
    if (typeof Chart === 'undefined') { destroyBodyChart(body); body.innerHTML = renderTypeFromDataset(config, series); return; }

    // Token cancels any earlier pending mount. The builder preview re-renders on
    // every change, so rapid calls must not each create a chart on the canvas.
    const token = (body.__radarToken = (body.__radarToken || 0) + 1);

    // Chart.js needs the container laid out; defer until it has width.
    const mount = () => {
      if (!body.isConnected || body.__radarToken !== token) return;   // superseded by a newer render
      if (!body.clientWidth) { requestAnimationFrame(mount); return; }
      // Atomic: destroy prior instance, clear DOM, then create a fresh canvas + chart.
      destroyBodyChart(body);
      body.innerHTML = '';
      const canvas = document.createElement('canvas');   // no global id — unique per card body
      canvas.style.maxHeight = '270px';
      body.appendChild(canvas);
      Chart.getChart(canvas)?.destroy();                 // belt-and-suspenders before reuse

      const datasets = [{
        label: 'Jugador',
        data: d.pct,
        borderColor: d.color,
        backgroundColor: d.color + '26',
        borderWidth: 2.4,
        pointRadius: 4, pointHoverRadius: 6,
        pointBackgroundColor: d.color, pointBorderColor: '#fff', pointBorderWidth: 1.5,
      }];
      if (d.hasBaseline) datasets.push({
        label: d.baselineName,
        data: d.pct.map(() => 100),
        borderColor: 'rgba(148,163,184,0.75)',
        backgroundColor: 'transparent',
        borderWidth: 1.5, borderDash: [5, 3],
        pointRadius: 2, pointBackgroundColor: 'rgba(148,163,184,0.75)', pointBorderColor: '#fff',
      });

      body.__chart = new Chart(canvas, {
        type: 'radar',
        data: { labels: d.labels, datasets },
        plugins: [_radarLabelPlugin],
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 320 },
          plugins: {
            legend: { display: d.showLeg && d.hasBaseline, position: 'bottom',
                      labels: { boxWidth: 10, padding: 12, font: { size: 10 }, usePointStyle: true } },
            tooltip: { callbacks: { label: ctx => {
              if (ctx.datasetIndex !== 0) return `${ctx.dataset.label}: ${ctx.raw}%`;
              // Real value + % of baseline, e.g. "HSR: 640 m · 78% del pico"
              const lbl = ctx.chart.data.labels[ctx.dataIndex], real = d.realLabels[ctx.dataIndex];
              return d.hasBaseline ? `${lbl}: ${real} · ${ctx.raw}% ${d.baselineOf}` : `${lbl}: ${real}`;
            } } },
            gpbRadarLabels: { show: d.showLbl, labels: d.realLabels, color: d.color },
          },
          scales: {
            r: {
              min: 0, max: d.rMax,
              ticks: { display: d.showAxes, stepSize: 30, font: { size: 9 }, color: '#9CA3AF',
                       backdropColor: 'transparent', callback: v => v + '%' },
              grid: { color: 'rgba(148,163,184,0.18)' },
              angleLines: { color: 'rgba(148,163,184,0.22)' },
              pointLabels: { display: d.showAxes, font: { size: 10, weight: '600' }, color: '#4B5563' },
            },
          },
        },
      });
    };
    mount();
  }

  /** Builder preview radar — same Chart.js renderer, mock per-metric values. */
  function mountRadarPreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    if (ms.length < 3) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    const series = ms.map((m, i) => ({
      label: m.id, name: m.name, unit: m.unit,
      points: [{ x: 'all', y: +(metSample(m) * (0.55 + 0.4 * Math.abs(Math.sin(i * 1.3 + 1)))).toFixed(1) }],
    }));
    const baselineMap = new Map(ms.map(m => [m.id, metSample(m)]));
    const cfg = {
      viz: 'radar',
      comparison: cmpConfig(S),
      style: { color: S.color, axes: S.axes, legend: S.legend, dataLabels: S.labels },
    };
    mountRadarChart(body, cfg, series, baselineMap);
  }

  // ── Bars (Chart.js) — "GPS Chart Reference §1" professional look ──────────
  function _cssVar(name, fallback) {
    try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }
    catch (e) { return fallback; }
  }
  /** thousands → "1k" / "2.5k", else plain (Y-axis ticks). */
  function kfmt(v) {
    if (Math.abs(v) >= 1000) { const k = v / 1000; return (Number.isInteger(k) ? k : +k.toFixed(1)) + 'k'; }
    return String(+(+v).toFixed(2));
  }
  /** A "nice" axis: max with ~10% headroom, snapped to a 1/2/2.5/5 step × ticks. */
  function niceScale(maxVal, ticks) {
    if (!(maxVal > 0)) return { max: ticks, step: 1 };
    const raw = (maxVal * 1.1) / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    const step = nice * mag;
    return { max: step * ticks, step };
  }
  /** Draws fmt(value) above each bar. No plugin dependency. */
  const _barLabelPlugin = {
    id: 'gpbBarLabels',
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.show) return;
      const { ctx } = chart;
      const horizontal = !!opts.horizontal, stacked = !!opts.stacked;
      ctx.save();
      ctx.font = '600 9px Geist, Inter, sans-serif';
      chart.data.datasets.forEach((ds, di) => {
        if (ds._isLine) return;                     // combo line: leave unlabelled (keeps it clean)
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((bar, i) => {
          const v = ds.data[i];
          if (v == null) return;
          const txt = fmt(Math.round(v * 10) / 10);
          if (stacked) {
            // centre each segment, white for contrast; skip segments too small to fit
            const seg = horizontal ? Math.abs(bar.x - bar.base) : Math.abs(bar.base - bar.y);
            if (seg < 18) return;
            const c = bar.getCenterPoint();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, c.x, c.y);
          } else if (horizontal) {
            ctx.fillStyle = opts.color || '#6B7280'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, bar.x + 4, bar.y);
          } else {
            ctx.fillStyle = opts.color || '#6B7280'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(txt, bar.x, bar.y - 3);
          }
        });
      });
      ctx.restore();
    },
  };

  /**
   * "vs microciclo": draws the diff% (current vs reference) above each category PAIR,
   * coloured by sign (green up / red down). Sits above the taller bar of the pair so
   * it reads as a single label per X category.
   */
  const _mcDiffLabelPlugin = {
    id: 'gpbMcDiff',
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.show || !opts.diffs) return;
      const { ctx } = chart;
      const horizontal = !!opts.horizontal;
      const lift = opts.withValues ? 16 : 6;        // clear the per-bar value label when shown
      const metas = chart.data.datasets.map((_, di) => chart.getDatasetMeta(di)).filter(m => !m.hidden);
      ctx.save();
      ctx.font = '700 10px Geist, Inter, sans-serif';
      opts.diffs.forEach((diff, i) => {
        if (diff == null) return;
        let px, py;
        if (!horizontal) {                          // label above the topmost bar of the pair
          let minY = Infinity, sumX = 0, n = 0;
          for (const m of metas) { const b = m.data[i]; if (!b) continue; minY = Math.min(minY, b.y); sumX += b.x; n++; }
          if (!n) return; px = sumX / n; py = minY - lift;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        } else {                                     // label to the right of the longest bar
          let maxX = -Infinity, sumY = 0, n = 0;
          for (const m of metas) { const b = m.data[i]; if (!b) continue; maxX = Math.max(maxX, b.x); sumY += b.y; n++; }
          if (!n) return; px = maxX + 6; py = sumY / n;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        }
        ctx.fillStyle = diff >= 0 ? (opts.upCol || '#16A34A') : (opts.dnCol || '#DC2626');
        ctx.fillText(`${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10}%`, px, py);
      });
      ctx.restore();
    },
  };

  const _BAR_SIZE_H = { sm: 150, md: 210, lg: 270, full: 320 };

  /** Per-series colors: 1→accent, 2→accent+grey(prev), 3+→categorical palette. */
  function barColors(config, n) {
    const accent = config.style?.color || _cssVar('--cm-accent', '#15803D');
    const grey   = 'rgba(148,163,184,0.6)';
    if (n <= 1) return [accent];
    if (n === 2) return [accent, grey];                    // main + comparison/prev (grey)
    const pal = PALETTES.find(p => p.id === config.style?.palette);
    const base = (pal && pal.id !== 'pitch')
      ? [accent, ...pal.cols]                              // honor a non-default style.palette
      : [accent, _cssVar('--cm-info', '#2563EB'), _cssVar('--cm-violet', '#7C3AED'), _cssVar('--cm-warning', '#D97706')];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  }

  /**
   * Pure: (config, series) → Chart.js bar payload. Variants (not new viz types):
   *   style.orientation: 'vertical' (default) | 'horizontal'
   *   style.stacked:     false (grouped) | true (segments summed into one bar)
   *   combo: a series flagged `line` (or config.metrics[i].line) is drawn as a LINE
   *          on a secondary value axis (y1) over the bars.
   */
  function barsChartData(config, series, mcNames) {
    const size       = config.style?.size || 'md';
    const showAxes   = config.style?.axes   !== false;
    const showLeg    = config.style?.legend !== false;
    const showLbl    = !!config.style?.dataLabels || size !== 'sm';   // OFF in S, ON in M/L, toggle forces ON
    const horizontal = config.style?.orientation === 'horizontal';
    const accent     = config.style?.color || _cssVar('--cm-accent', '#15803D');
    const ss         = (series || []).filter(s => s.points && s.points.length);

    // categories = the dimension values (x), in first-series order
    const cats = [];
    ss.forEach(s => s.points.forEach(p => { if (!cats.includes(p.x)) cats.push(p.x); }));

    // "vs microciclo": the resolver enriches each point with { cur, ref, diff }. When the
    // card asks for an MC comparison (and the points carry both values) we draw TWO bars
    // per category — current MC (accent) + reference MC (grey) — grouped side by side,
    // plus a diff% label over each pair. Any other comparison/scope → the normal path
    // below is left completely untouched (point 4).
    const mcOn = config.comparison?.baseline === 'mc' && ss.some(s => s.points.some(p => p.cur !== undefined));

    const ticks = size === 'sm' ? 4 : 5;
    let datasets, mcDiffs = null, hasLine = false, max1 = null, step1 = null, stacked = !!config.style?.stacked;

    if (mcOn) {
      stacked = false;                              // current-vs-ref is always grouped
      const grey   = 'rgba(148,163,184,0.65)';
      const names  = mcNames || { cur: 'Actual', ref: mcLabel(config.comparison?.refMcId) };
      const single = ss.length === 1;
      const mk = (s, label, key, col) => ({
        type: 'bar', label, unit: s.unit || '',
        data: cats.map(c => { const p = s.points.find(q => q.x === c); return (p && p[key] != null) ? p[key] : null; }),
        backgroundColor: col, borderColor: col, borderWidth: 0, borderRadius: 4,
        borderSkipped: horizontal ? 'left' : 'bottom', maxBarThickness: 46, categoryPercentage: 0.7, barPercentage: 0.9,
      });
      datasets = [];
      for (const s of ss) {
        const base = s.name || s.label;
        datasets.push(mk(s, single ? names.cur : `${base} · ${names.cur}`, 'cur', accent));
        datasets.push(mk(s, single ? names.ref : `${base} · ${names.ref}`, 'ref', grey));
      }
      // diff% per category from the first metric (label over each pair)
      const s0 = ss[0];
      mcDiffs = cats.map(c => { const p = s0.points.find(q => q.x === c); return p ? (p.diff ?? null) : null; });
    } else {
      const isLine  = ss.map((s, i) => !!(s.line || config.metrics?.[i]?.line));
      const barCols = barColors(config, isLine.filter(f => !f).length || 1);
      const lineCol = _cssVar('--cm-warning', '#D97706');
      let bi = 0;
      datasets = ss.map((s, i) => {
        const data = cats.map(c => { const p = s.points.find(q => q.x === c); return p ? p.y : null; });
        if (isLine[i]) {                            // combo: line on the secondary axis
          return { type: 'line', label: s.name || s.label, unit: s.unit || '', data,
            yAxisID: 'y1', borderColor: lineCol, backgroundColor: 'transparent',
            borderWidth: 2.4, tension: 0.25, pointRadius: 3.5, pointHoverRadius: 5.5,
            pointBackgroundColor: lineCol, pointBorderColor: '#fff', pointBorderWidth: 1.2, _isLine: true };
        }
        const col = barCols[bi++];
        return { type: 'bar', label: s.name || s.label, unit: s.unit || '', data,
          backgroundColor: col, borderColor: col, borderWidth: 0,
          borderRadius: stacked ? 2 : 4, borderSkipped: horizontal ? 'left' : 'bottom',
          maxBarThickness: 46, categoryPercentage: 0.7, barPercentage: 0.9,
          stack: stacked ? 'stk' : undefined };
      });
      datasets.sort((a, b) => (a._isLine ? 1 : 0) - (b._isLine ? 1 : 0));   // bars first → line drawn on top
      hasLine = datasets.some(d => d._isLine);
      if (hasLine) {
        const lineVals = datasets.filter(d => d._isLine).flatMap(d => d.data.filter(v => v != null));
        ({ max: max1, step: step1 } = niceScale(Math.max(0, ...lineVals), ticks));
      }
    }

    const barDs  = datasets.filter(d => !d._isLine);
    const allBarVals = barDs.flatMap(d => d.data.filter(v => v != null));
    const maxVal = stacked
      ? Math.max(0, ...cats.map((_, ci) => barDs.reduce((sum, d) => sum + (d.data[ci] || 0), 0)))
      : Math.max(0, ...allBarVals);
    const { max, step } = niceScale(maxVal, ticks);

    const baseH  = _BAR_SIZE_H[size] || 210;
    const height = horizontal ? Math.max(baseH, cats.length * 26 + 48) : baseH;   // grow for many horizontal bars

    return { cats, datasets, max, step, ticks, showAxes, showLeg, showLbl,
             isMcGrouped: mcOn, mcDiffs,
             mcUpCol: mcOn ? _cssVar('--cm-success', '#16A34A') : null,
             mcDnCol: mcOn ? _cssVar('--cm-danger',  '#DC2626') : null,
             horizontal, stacked, hasLine, max1, step1,
             height, color: accent };
  }

  /** Mounts (or re-mounts) a Chart.js bar chart into `body`. Same renderer for preview + saved card. */
  function mountBarsChart(body, config, series, mcNames) {
    const d = barsChartData(config, series, mcNames);
    if (!d.cats.length || !d.datasets.length) { destroyBodyChart(body); body.innerHTML = ''; showEmptyBody(body, 'No rows match the current scope, range and filters.'); return; }
    if (typeof Chart === 'undefined') { destroyBodyChart(body); body.innerHTML = renderTypeFromDataset(config, series); return; }

    const token = (body.__barsToken = (body.__barsToken || 0) + 1);
    const mount = () => {
      if (!body.isConnected || body.__barsToken !== token) return;   // superseded by a newer render
      if (!body.clientWidth) { requestAnimationFrame(mount); return; }
      destroyBodyChart(body);
      body.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = `position:relative;width:100%;height:${d.height}px`;
      const canvas = document.createElement('canvas');   // no global id — unique per card body
      wrap.appendChild(canvas);
      body.appendChild(wrap);
      Chart.getChart(canvas)?.destroy();                  // belt-and-suspenders before reuse

      const gridCol = 'rgba(148,163,184,0.18)';
      const valueScale = {
        display: d.showAxes, beginAtZero: true, max: d.max, stacked: d.stacked,
        grid: { display: d.showAxes, color: gridCol, drawTicks: false },
        border: { display: false },
        ticks: { stepSize: d.step, font: { size: 10 }, color: '#9CA3AF', padding: 6, callback: v => kfmt(v) },
      };
      const catScale = {
        display: d.showAxes, stacked: d.stacked,
        grid: { display: false, drawTicks: false },
        ticks: { font: { size: 10.5 }, color: '#6B7280', maxRotation: 0, autoSkip: true },
        border: { display: d.showAxes },
      };
      const scales = {};
      scales[d.horizontal ? 'x' : 'y'] = valueScale;     // value axis follows orientation
      scales[d.horizontal ? 'y' : 'x'] = catScale;       // category axis
      if (d.hasLine) {                                    // combo: secondary value axis for the line
        scales.y1 = { display: d.showAxes, position: 'right', beginAtZero: true, max: d.max1, stacked: false,
          grid: { drawOnChartArea: false }, border: { display: false },
          ticks: { stepSize: d.step1, font: { size: 10 }, color: '#9CA3AF', padding: 6, callback: v => kfmt(v) } };
      }

      body.__chart = new Chart(canvas, {
        type: 'bar',
        data: { labels: d.cats, datasets: d.datasets },
        plugins: [_barLabelPlugin, _mcDiffLabelPlugin],
        options: {
          indexAxis: d.horizontal ? 'y' : 'x',
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 320 },
          layout: { padding: {
            top:   !d.horizontal ? (d.isMcGrouped ? 28 : (d.showLbl ? 14 : 6)) : 6,
            right:  d.horizontal ? (d.isMcGrouped ? 46 : (d.showLbl ? 30 : 8)) : 8,
          } },
          plugins: {
            legend: {
              display: d.showLeg, position: 'bottom',
              labels: { boxWidth: 12, boxHeight: 12, padding: 14, usePointStyle: true,
                        font: { size: 11 },
                        generateLabels: ch => ch.data.datasets.map((ds, i) => ({
                          text: ds.unit ? `${ds.label} (${ds.unit})` : ds.label,
                          fillStyle:   ds._isLine ? ds.borderColor : ds.backgroundColor,
                          strokeStyle: ds._isLine ? ds.borderColor : ds.backgroundColor,
                          lineWidth:   ds._isLine ? 2 : 0,
                          pointStyle:  ds._isLine ? 'line' : 'rectRounded',
                          hidden: !ch.isDatasetVisible(i), datasetIndex: i,
                        })) },
              onClick: (e, item, legend) => {
                const ci = legend.chart; ci.setDatasetVisibility(item.datasetIndex, !ci.isDatasetVisible(item.datasetIndex)); ci.update();
              },
            },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const v = d.horizontal ? ctx.parsed.x : ctx.parsed.y;
                  const base = `${ctx.dataset.label}: ${fmt(Math.round(v * 10) / 10)}${ctx.dataset.unit ? ' ' + ctx.dataset.unit : ''}`;
                  // MC grouped: append the diff% vs reference on the current series' bar.
                  if (d.isMcGrouped && d.mcDiffs) {
                    const diff = d.mcDiffs[ctx.dataIndex];
                    if (diff != null) return [base, `Δ vs ref: ${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10}%`];
                  }
                  return base;
                },
              },
            },
            gpbBarLabels: { show: d.showLbl, color: '#6B7280', horizontal: d.horizontal, stacked: d.stacked },
            gpbMcDiff: { show: d.isMcGrouped, diffs: d.mcDiffs, horizontal: d.horizontal, upCol: d.mcUpCol, dnCol: d.mcDnCol, withValues: d.showLbl },
          },
          scales,
        },
      });
    };
    mount();
  }

  /** Builder preview bars — same Chart.js renderer, mock per-category values. */
  function mountBarsPreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    if (!ms.length) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    // Real data when we have a backend + club context — identical to the saved card
    // (and required for "vs microciclo", whose diff% comes from the resolver).
    if (window.sb && _clubId) { resolveAndRenderCard(draftCard, buildConfig(S)); return; }
    mountBarsMockPreview(body, S, ms);
  }

  /** Fallback bars preview with example values (no backend) — mock series, mock cats. */
  function mountBarsMockPreview(body, S, ms) {
    const cats = dimMockLabels(S);   // X categories = the chosen dimension
    // One series per measure — same shape the resolver feeds the saved card, so
    // preview and saved card render identically. 2 series → 2nd in grey.
    const series = ms.map((m, idx) => ({ label: m.id, name: m.name, unit: m.unit, line: !!S.metrics[idx]?.line,
      points: cats.map((c, r) => ({ x: c, y: Math.round(metSample(m) * (0.5 + 0.42 * Math.abs(Math.sin(r * 1.3 + idx + 1)))) })) }));
    const cfg = {
      viz: 'bars',
      dimensions: S.dimensions,
      comparison: cmpConfig(S),
      style: { size: S.size, color: S.color, palette: S.palette, axes: S.axes, legend: S.legend, dataLabels: S.labels,
               orientation: S.horizontal ? 'horizontal' : 'vertical', stacked: !!S.stacked },
    };
    mountBarsChart(body, cfg, series);
  }

  // ── Line / temporal (Chart.js) — "GPS Chart Reference §2" professional look ──
  const _LINE_SIZE_H = { sm: 160, md: 220, lg: 280, full: 330 };

  /** Per-series colors: 1→accent, 2+→categorical palette (accent, info, violet, warning). */
  function lineColors(config, n) {
    const accent = config.style?.color || _cssVar('--cm-accent', '#15803D');
    if (n <= 1) return [accent];
    const pal = PALETTES.find(p => p.id === config.style?.palette);
    const base = (pal && pal.id !== 'pitch')
      ? [accent, ...pal.cols]                               // honor a non-default style.palette
      : [accent, _cssVar('--cm-info', '#2563EB'), _cssVar('--cm-violet', '#7C3AED'), _cssVar('--cm-warning', '#D97706')];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  }

  /** Chronological order for time dimensions; keeps insertion order if labels aren't time-like. */
  function lineSortCats(cats) {
    const key = c => {
      const s = String(c); let m;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;                          // ISO date → lexical
      if ((m = s.match(/^MD(?:[\s-]?(\d+))?$/i))) return m[1] ? -(+m[1]) : 0;  // MD-3 < MD-2 < … < MD
      if ((m = s.match(/(-?\d+(?:\.\d+)?)/))) return +m[1];                // "MC 45" → 45
      return null;
    };
    const keyed = cats.map(c => [c, key(c)]);
    if (keyed.some(([, k]) => k === null)) return cats;                    // unknown → don't reorder
    return keyed.slice().sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(x => x[0]);
  }

  /** Draws fmt(value) above each point (measure series only). No plugin dependency. */
  const _lineLabelPlugin = {
    id: 'gpbLineLabels',
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.show) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 9px Geist, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      chart.data.datasets.forEach((ds, di) => {
        if (ds._dashed) return;                            // never label the reference line
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        ctx.fillStyle = ds.borderColor || '#6B7280';
        meta.data.forEach((pt, i) => {
          const v = ds.data[i];
          if (v == null) return;
          ctx.fillText(fmt(Math.round(v * 10) / 10), pt.x, pt.y - 6);
        });
      });
      ctx.restore();
    },
  };

  /**
   * Pure: (config, series) → Chart.js line payload (X = temporal dimension, series = measures).
   * A series flagged `dashed:true` renders as a grey dotted reference line, no points, no fill,
   * and is skipped in palette indexing.
   */
  function lineChartData(config, series) {
    const size     = config.style?.size || 'md';
    const showAxes = config.style?.axes   !== false;
    const showLeg  = config.style?.legend !== false;
    const showLbl  = !!config.style?.dataLabels;        // values over points — OFF by default
    const showArea = !!config.style?.area;
    const showPts  = config.style?.points !== false;    // points ON by default
    const ss       = (series || []).filter(s => s.points && s.points.length);

    // X categories = the temporal dimension values, chronologically ordered
    const catsRaw = [];
    ss.forEach(s => s.points.forEach(p => { if (!catsRaw.includes(p.x)) catsRaw.push(p.x); }));
    const cats = lineSortCats(catsRaw);

    const measureCount = ss.filter(s => !s.dashed).length;
    const colors = lineColors(config, measureCount);
    let ci = 0;
    const datasets = ss.map(s => {
      const isRef = !!s.dashed;
      const col   = isRef ? 'rgba(148,163,184,0.9)' : colors[ci++];
      return {
        label: s.name || s.label,
        unit:  s.unit || '',
        data:  cats.map(c => { const p = s.points.find(q => q.x === c); return p ? p.y : null; }),
        borderColor: col,
        backgroundColor: (!isRef && showArea) ? col + '1F' : 'transparent',   // fill-opacity ~0.12
        borderWidth: isRef ? 1.6 : 2.4,
        borderDash: isRef ? [5, 4] : [],
        fill: (!isRef && showArea) ? 'origin' : false,
        tension: 0.25,
        pointRadius: isRef ? 0 : (showPts ? 3.5 : 0),
        pointHoverRadius: isRef ? 0 : 5.5,
        pointBackgroundColor: col, pointBorderColor: '#fff', pointBorderWidth: 1.4,
        spanGaps: true,
        _dashed: isRef,
      };
    });

    const maxVal = Math.max(0, ...datasets.flatMap(d => d.data.filter(v => v != null)));
    const ticks  = size === 'sm' ? 4 : 5;
    const { max, step } = niceScale(maxVal, ticks);

    return { cats, datasets, max, step, showAxes, showLeg, showLbl, height: _LINE_SIZE_H[size] || 220 };
  }

  /** Mounts (or re-mounts) a Chart.js line chart into `body`. Same renderer for preview + saved card. */
  function mountLineChart(body, config, series) {
    const d = lineChartData(config, series);
    if (!d.cats.length || !d.datasets.length) { destroyBodyChart(body); body.innerHTML = ''; showEmptyBody(body, 'No rows match the current scope, range and filters.'); return; }
    if (typeof Chart === 'undefined') { destroyBodyChart(body); body.innerHTML = renderTypeFromDataset(config, series); return; }

    const token = (body.__lineToken = (body.__lineToken || 0) + 1);
    const mount = () => {
      if (!body.isConnected || body.__lineToken !== token) return;   // superseded by a newer render
      if (!body.clientWidth) { requestAnimationFrame(mount); return; }
      destroyBodyChart(body);
      body.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = `position:relative;width:100%;height:${d.height}px`;
      const canvas = document.createElement('canvas');   // no global id — unique per card body
      wrap.appendChild(canvas);
      // Example-data badge: shown only when the builder preview can't reach real data
      // (no Supabase context), so example values are never mistaken for the real card.
      if (config.__example) {
        const badge = document.createElement('div');
        badge.textContent = 'datos de ejemplo';
        badge.style.cssText = 'position:absolute;top:4px;right:6px;z-index:2;font:600 9px/1 var(--cm-font-sans,sans-serif);'
          + 'color:#9CA3AF;background:rgba(148,163,184,0.14);padding:3px 7px;border-radius:999px;pointer-events:none';
        wrap.appendChild(badge);
      }
      body.appendChild(wrap);
      Chart.getChart(canvas)?.destroy();                  // belt-and-suspenders before reuse

      body.__chart = new Chart(canvas, {
        type: 'line',
        data: { labels: d.cats, datasets: d.datasets },
        plugins: [_lineLabelPlugin],
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 320 },
          layout: { padding: { top: d.showLbl ? 16 : 6, right: 8 } },
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: {
              display: d.showLeg, position: 'bottom',
              labels: { boxWidth: 20, boxHeight: 0, padding: 14, usePointStyle: true, pointStyle: 'line',
                        font: { size: 11 },
                        generateLabels: ch => ch.data.datasets.map((ds, i) => ({
                          text: ds.unit ? `${ds.label} (${ds.unit})` : ds.label,
                          strokeStyle: ds.borderColor, fillStyle: ds.borderColor,
                          lineWidth: 2, lineDash: ds._dashed ? [4, 3] : [],
                          hidden: !ch.isDatasetVisible(i), datasetIndex: i,
                        })) },
              onClick: (e, item, legend) => {
                const ci = legend.chart; ci.setDatasetVisibility(item.datasetIndex, !ci.isDatasetVisible(item.datasetIndex)); ci.update();
              },
            },
            tooltip: {
              callbacks: {
                title: items => items.length ? String(items[0].label) : '',
                label: ctx => `${ctx.dataset.label}: ${fmt(Math.round(ctx.parsed.y * 10) / 10)}${ctx.dataset.unit ? ' ' + ctx.dataset.unit : ''}`,
              },
            },
            gpbLineLabels: { show: d.showLbl },
          },
          scales: {
            x: {
              display: d.showAxes,
              grid: { display: false, drawTicks: false },
              ticks: { font: { size: 10.5 }, color: '#6B7280', maxRotation: 0, autoSkip: true },
              border: { display: d.showAxes },
            },
            y: {
              display: d.showAxes, beginAtZero: true, max: d.max,
              grid: { display: d.showAxes, color: 'rgba(148,163,184,0.18)', drawTicks: false },
              border: { display: false },
              ticks: { stepSize: d.step, font: { size: 10 }, color: '#9CA3AF', padding: 6, callback: v => kfmt(v) },
            },
          },
        },
      });
    };
    mount();
  }

  /**
   * Builder preview line. Resolves REAL GPS data through the same pipeline as the
   * saved card (so the draft shows actual metres and a temporal X), and only falls
   * back to clearly-labelled example data when there's no Supabase context.
   */
  function mountLinePreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    if (!ms.length) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    // Real data when we have a backend + club context — identical to the saved card.
    if (window.sb && _clubId) {
      const cfg = buildConfig(S);
      const cache = draftCard.__previewCache;
      if (cache && cache.sig === _dataSig(cfg) && cache.series) {
        mountLineChart(body, cfg, cache.series);   // style-only change → instant, no re-query
      } else {
        resolveAndRenderCard(draftCard, cfg);
      }
      return;
    }
    mountLineMockPreview(body, S);
  }

  /** Fallback line preview with example values (no backend) — badged "datos de ejemplo". */
  function mountLineMockPreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    // X = the chosen temporal dimension; default to microcycles when none picked yet
    const cats = (S.dimensions && S.dimensions.length) ? dimMockLabels(S) : DIM_MOCK.microcycle;
    const series = ms.map((m, idx) => ({ label: m.id, name: m.name, unit: m.unit,
      points: cats.map((c, r) => ({ x: c, y: Math.round(metSample(m) * (0.5 + 0.42 * Math.abs(Math.sin(r * 1.1 + idx + 1)))) })) }));
    // single-metric + role comparison → flat dashed reference line, mirrors the saved card
    if (S.compare === 'role' && ms.length === 1) {
      const base = Math.round(metSample(ms[0]) * 0.7);
      series.push({ label: '__baseline', name: 'Role baseline', unit: ms[0].unit, dashed: true,
        points: cats.map(c => ({ x: c, y: base })) });
    }
    const cfg = {
      viz: 'line',
      dimensions: S.dimensions,
      comparison: cmpConfig(S),
      style: { size: S.size, color: S.color, palette: S.palette, axes: S.axes, legend: S.legend, dataLabels: S.labels, area: S.area, points: S.points },
      __example: true,
    };
    mountLineChart(body, cfg, series);
  }

  // ── Scatter (Chart.js) — "GPS Chart Reference §3" professional look ──
  // One point per entity (player): X = metrics[0], Y = metrics[1]. An optional
  // colour dimension (dimensions[0]) splits the points into categorical groups
  // with a legend. Average reference lines (vertical = avg X, horizontal = avg Y)
  // cut the plot into quadrants. Same renderer for builder preview + saved card.
  const _SCATTER_SIZE_H = { sm: 180, md: 240, lg: 300, full: 340 };

  /** Per-category colors: 1→accent, 2+→categorical palette (honors style.palette). */
  function scatterColors(config, n) {
    const accent = config.style?.color || _cssVar('--cm-accent', '#15803D');
    if (n <= 1) return [accent];
    const pal = PALETTES.find(p => p.id === config.style?.palette);
    const base = (pal && pal.id !== 'pitch')
      ? [accent, ...pal.cols]                               // honor a non-default style.palette
      : [accent, _cssVar('--cm-info', '#2563EB'), _cssVar('--cm-violet', '#7C3AED'),
         _cssVar('--cm-warning', '#D97706'), _cssVar('--cm-rose', '#E11D48'), _cssVar('--cm-fg-muted', '#64748B')];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  }

  /** Draws the point's name beside each dot (off by default). No plugin dependency. */
  const _scatterLabelPlugin = {
    id: 'gpbScatterLabels',
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.show) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 9px Geist, Inter, sans-serif';
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((pt, i) => {
          const nm = ds.data[i]?.name;
          if (nm) ctx.fillText(String(nm), pt.x + 8, pt.y);
        });
      });
      ctx.restore();
    },
  };

  /** Draws the average reference lines (vertical avg-X, horizontal avg-Y) as a thin dashed grey cross. */
  const _scatterAvgPlugin = {
    id: 'gpbScatterAvg',
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || opts.avgX == null || opts.avgY == null) return;
      const { ctx, chartArea, scales } = chart;
      const px = scales.x.getPixelForValue(opts.avgX);
      const py = scales.y.getPixelForValue(opts.avgY);
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      if (px >= chartArea.left && px <= chartArea.right) {
        ctx.beginPath(); ctx.moveTo(px, chartArea.top); ctx.lineTo(px, chartArea.bottom); ctx.stroke();
      }
      if (py >= chartArea.top && py <= chartArea.bottom) {
        ctx.beginPath(); ctx.moveTo(chartArea.left, py); ctx.lineTo(chartArea.right, py); ctx.stroke();
      }
      ctx.restore();
    },
  };

  /** Pure: (config, series) → Chart.js scatter payload (datasets per category, averages, axis titles). */
  function scatterChartData(config, series) {
    const size     = config.style?.size || 'md';
    const showAxes = config.style?.axes   !== false;
    const showLbl  = !!config.style?.dataLabels;     // point name labels — OFF by default
    const sX = series && series[0];
    const sY = series && series[1];
    const empty = { datasets: [], avgX: null, avgY: null, showAxes, showLbl, showLeg: false,
                    xName: '', yName: '', xUnit: '', yUnit: '', xTitle: '', yTitle: '',
                    height: _SCATTER_SIZE_H[size] || 240 };
    if (!sX || !sY || !sX.points?.length || !sY.points?.length) return empty;

    // Pair X and Y per entity. The resolver builds every metric's points in the same
    // group order (same keys, same row iteration), so we pair by index — robust even
    // when two players share a display name. Category = the colour-dimension value
    // carried on the point (resolver attaches `cat` for scatter).
    const n = Math.min(sX.points.length, sY.points.length);
    const paired = [];
    for (let i = 0; i < n; i++) {
      const px = sX.points[i], py = sY.points[i];
      paired.push({ name: px.x, x: px.y, y: py.y, cat: px.cat ?? null });   // px.y = X-axis value, py.y = Y-axis value
    }
    if (!paired.length) return empty;

    const hasCat = paired.some(p => p.cat != null);
    const cats   = hasCat ? [...new Set(paired.map(p => p.cat ?? '—'))] : [null];
    const colors = scatterColors(config, cats.length);
    const datasets = cats.map((c, i) => {
      const col = colors[i];
      const pts = paired
        .filter(p => (hasCat ? (p.cat ?? '—') : null) === c)
        .map(p => ({ x: p.x, y: p.y, name: p.name }));
      return {
        label: c ?? (sX.name + ' vs ' + sY.name),
        data: pts,
        backgroundColor: col + 'CC',                 // ~80% fill so overlaps read
        borderColor: '#fff',
        borderWidth: 1.2,
        pointRadius: 5.5,
        pointHoverRadius: 7.5,
        pointHoverBackgroundColor: col,
        pointHoverBorderColor: col,
      };
    });

    const avgX = paired.reduce((a, p) => a + p.x, 0) / paired.length;
    const avgY = paired.reduce((a, p) => a + p.y, 0) / paired.length;
    const xUnit = sX.unit || '', yUnit = sY.unit || '';

    return {
      datasets, avgX, avgY, showAxes, showLbl,
      showLeg: hasCat && config.style?.legend !== false,
      xName: sX.name, yName: sY.name, xUnit, yUnit,
      xTitle: sX.name + (xUnit ? ` (${xUnit})` : ''),
      yTitle: sY.name + (yUnit ? ` (${yUnit})` : ''),
      height: _SCATTER_SIZE_H[size] || 240,
    };
  }

  /** Mounts (or re-mounts) a Chart.js scatter into `body`. Same renderer for preview + saved card. */
  function mountScatterChart(body, config, series) {
    const d = scatterChartData(config, series);
    if (!d.datasets.length) { destroyBodyChart(body); body.innerHTML = ''; showEmptyBody(body, 'Scatter needs two measures with overlapping entities.'); return; }
    if (typeof Chart === 'undefined') { destroyBodyChart(body); body.innerHTML = renderTypeFromDataset(config, series); return; }

    const token = (body.__scatterToken = (body.__scatterToken || 0) + 1);
    const mount = () => {
      if (!body.isConnected || body.__scatterToken !== token) return;   // superseded by a newer render
      if (!body.clientWidth) { requestAnimationFrame(mount); return; }
      destroyBodyChart(body);
      body.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = `position:relative;width:100%;height:${d.height}px`;
      const canvas = document.createElement('canvas');   // no global id — unique per card body
      wrap.appendChild(canvas);
      // Example-data badge — only when the preview couldn't reach real GPS data.
      if (config.__example) {
        const badge = document.createElement('div');
        badge.textContent = 'datos de ejemplo';
        badge.style.cssText = 'position:absolute;top:4px;right:6px;z-index:2;font:600 9px/1 var(--cm-font-sans,sans-serif);'
          + 'color:#9CA3AF;background:rgba(148,163,184,0.14);padding:3px 7px;border-radius:999px;pointer-events:none';
        wrap.appendChild(badge);
      }
      body.appendChild(wrap);
      Chart.getChart(canvas)?.destroy();                  // belt-and-suspenders before reuse

      const gridCol = 'rgba(148,163,184,0.18)';
      body.__chart = new Chart(canvas, {
        type: 'scatter',
        data: { datasets: d.datasets },
        plugins: [_scatterAvgPlugin, _scatterLabelPlugin],
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 320 },
          layout: { padding: { top: 6, right: 12 } },
          plugins: {
            legend: {
              display: d.showLeg, position: 'bottom',
              labels: { boxWidth: 10, boxHeight: 10, padding: 14, usePointStyle: true, pointStyle: 'circle',
                        font: { size: 11 },
                        generateLabels: ch => ch.data.datasets.map((ds, i) => ({
                          text: ds.label,
                          fillStyle: ds.pointHoverBackgroundColor || ds.backgroundColor,
                          strokeStyle: ds.pointHoverBackgroundColor || ds.backgroundColor, lineWidth: 0,
                          hidden: !ch.isDatasetVisible(i), datasetIndex: i,
                        })) },
              onClick: (e, item, legend) => {
                const ci = legend.chart; ci.setDatasetVisibility(item.datasetIndex, !ci.isDatasetVisible(item.datasetIndex)); ci.update();
              },
            },
            tooltip: {
              callbacks: {
                title: items => (items.length && items[0].raw?.name) ? String(items[0].raw.name) : '',
                label: ctx => {
                  const x = Math.round(ctx.parsed.x * 10) / 10, y = Math.round(ctx.parsed.y * 10) / 10;
                  return [`${d.xName}: ${fmt(x)}${d.xUnit ? ' ' + d.xUnit : ''}`,
                          `${d.yName}: ${fmt(y)}${d.yUnit ? ' ' + d.yUnit : ''}`];
                },
              },
            },
            gpbScatterAvg:    { avgX: d.avgX, avgY: d.avgY },
            gpbScatterLabels: { show: d.showLbl },
          },
          scales: {
            x: {
              display: d.showAxes, grace: '6%',
              title: { display: d.showAxes && !!d.xTitle, text: d.xTitle, font: { size: 11, weight: '600' }, color: '#6B7280', padding: { top: 4 } },
              grid: { display: d.showAxes, color: gridCol, drawTicks: false },
              ticks: { font: { size: 10 }, color: '#9CA3AF', padding: 6, callback: v => kfmt(v) },
              border: { display: d.showAxes },
            },
            y: {
              display: d.showAxes, grace: '6%',
              title: { display: d.showAxes && !!d.yTitle, text: d.yTitle, font: { size: 11, weight: '600' }, color: '#6B7280' },
              grid: { display: d.showAxes, color: gridCol, drawTicks: false },
              ticks: { font: { size: 10 }, color: '#9CA3AF', padding: 6, callback: v => kfmt(v) },
              border: { display: false },
            },
          },
        },
      });
    };
    mount();
  }

  /**
   * Builder preview scatter. Resolves REAL GPS data through the same pipeline as the
   * saved card, and only falls back to clearly-labelled example data when there's no
   * Supabase context.
   */
  function mountScatterPreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    // "vs microciclo" scatter derives both axes (Δ% vs ref, current value) from ONE metric.
    const minMetrics = S.compare === 'mc' ? 1 : 2;
    if (ms.length < minMetrics) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    if (window.sb && _clubId) { resolveAndRenderCard(draftCard, buildConfig(S)); return; }
    mountScatterMockPreview(body, S);
  }

  /** Fallback scatter preview with example values (no backend) — badged "datos de ejemplo". */
  function mountScatterMockPreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    const [mX, mY] = ms;
    const names    = DIM_MOCK.player_name;
    const colorDim = S.dimensions?.[0]?.id;
    const catPool  = colorDim ? (DIM_MOCK[colorDim] || null) : null;
    // Same series shape the resolver feeds the saved card → preview renders identically.
    const ptOf = (m, r, ph) => ({ x: names[r], cat: catPool ? catPool[r % catPool.length] : null,
      y: Math.round(metSample(m) * (0.55 + 0.42 * Math.abs(Math.sin(r * ph + 1)))) });
    const series = [
      { label: mX.id, name: mX.name, unit: mX.unit, points: names.map((_, r) => ptOf(mX, r, 1.7)) },
      { label: mY.id, name: mY.name, unit: mY.unit, points: names.map((_, r) => ptOf(mY, r, 2.3)) },
    ];
    const cfg = {
      viz: 'scatter',
      dimensions: S.dimensions,
      style: { size: S.size, color: S.color, palette: S.palette, axes: S.axes, legend: S.legend, dataLabels: S.labels },
      __example: true,
    };
    mountScatterChart(body, cfg, series);
  }

  // ── KPI + Ranking (HTML/CSS, no Chart.js except the KPI sparkline) ──
  // "GPS Chart Reference §4" look. Both share one renderer for preview + saved card.
  // Delta/rank-change assume higher = better (no per-metric direction in the catalog).

  /** Small absolutely-positioned "datos de ejemplo" badge for the no-backend previews. */
  function _appendExampleBadge(el) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const badge = document.createElement('div');
    badge.textContent = 'datos de ejemplo';
    badge.style.cssText = 'position:absolute;top:4px;right:6px;z-index:2;font:600 9px/1 var(--cm-font-sans,sans-serif);'
      + 'color:#9CA3AF;background:rgba(148,163,184,0.14);padding:3px 7px;border-radius:999px;pointer-events:none';
    el.appendChild(badge);
  }

  /**
   * Pure: (config, series, opts) → KPI view model. ONE item per metric (multi-metric
   * KPI = compact row). Per-metric delta comes from the EXISTING comparison block:
   *   · vs microciclo → point carries { diff } (enriched by the mc pipeline)
   *   · role / match  → opts.baselineMap (metricId → baseline value)
   *   · none          → no delta.
   * opts: { baselineMap, mcRefName }.
   */
  function kpiCardData(config, series, opts = {}) {
    const baselineMap = opts.baselineMap || null;
    const cmpId   = config.comparison?.baseline || null;
    const cmpName = cmpId === 'mc'
      ? (opts.mcRefName ? `vs ${opts.mcRefName}` : '')          // empty if ref MC had no data (degraded)
      : (cmpId ? (COMPARES.find(c => c.id === cmpId)?.name || '') : '');
    const scope   = config.scope?.level || '';

    const items = (series || []).map((s, i) => {
      const m       = config.metrics?.[i] || {};
      const p       = s?.points?.[0] || {};
      const value   = (p.cur != null ? p.cur : p.y) ?? 0;
      const unit    = s?.unit || '';
      const name    = s?.name || m.id || '';
      const aggName = AGG[m.agg]?.name || '';
      const cat     = catalogMap.get(m.id);
      const icon    = cat ? metIcon(cat) : VIZ_TYPES.kpi.icon;
      let delta = null;
      if (p.diff != null && isFinite(p.diff)) {                    // vs microciclo
        delta = { dir: p.diff >= 0 ? 'up' : 'down', pct: p.diff };
      } else if (baselineMap) {                                    // role / match
        const bv = baselineMap.get(m.id);
        if (bv != null && bv > 0 && isFinite(value)) {
          const diff = value - bv;
          delta = { dir: diff >= 0 ? 'up' : 'down', pct: (diff / bv) * 100 };
        }
      }
      return { value, unit, name, aggName, scope, icon, cmpName, delta };
    });
    return { items, single: items.length <= 1 };
  }

  /** Single-KPI markup (1 metric). `spark` adds an empty sparkline canvas. */
  function kpiHtml(d, spark) {
    const lLabel = [d.aggName, d.scope].filter(Boolean).join(' · ');
    let tLine = '';
    if (d.delta) {
      const sign = d.delta.dir === 'up' ? '+' : '−';
      tLine = `<div class="t"><span class="d ${d.delta.dir}"><i class="ti ti-arrow-${d.delta.dir}-right"></i>${sign}${Math.abs(d.delta.pct).toFixed(0)}%</span>${d.cmpName ? ' ' + esc(d.cmpName) : ''}</div>`;
    } else if (d.cmpName) {
      tLine = `<div class="t">${esc(d.cmpName)}</div>`;
    } else if (d.name) {
      tLine = `<div class="t">${esc(d.name)}</div>`;
    }
    const sparkHtml = spark ? `<div class="gp-kpi-spark" style="margin-top:12px;height:36px;position:relative"><canvas></canvas></div>` : '';
    return `<div class="l"><i class="ti ${d.icon}"></i>${esc(lLabel)}</div>
      <div class="v">${fmt(Math.round(d.value * 10) / 10)}${d.unit ? ` <sub>${esc(d.unit)}</sub>` : ''}</div>
      ${tLine}${sparkHtml}`;
  }

  /** Multi-KPI markup (N metrics) — compact grid, one tile per metric (like Player KPIs). */
  function kpiMultiHtml(items) {
    return `<div class="gp-kpi-multi">${items.map(it => {
      const lab = [it.name, it.aggName].filter(Boolean).join(' · ');
      let t = '';
      if (it.delta) {
        const sign = it.delta.dir === 'up' ? '+' : '−';
        t = `<div class="kt"><span class="kd ${it.delta.dir}"><i class="ti ti-arrow-${it.delta.dir}-right"></i>${sign}${Math.abs(it.delta.pct).toFixed(0)}%</span>${it.cmpName ? ' ' + esc(it.cmpName) : ''}</div>`;
      } else if (it.cmpName) {
        t = `<div class="kt">${esc(it.cmpName)}</div>`;
      }
      return `<div class="gp-kpi-tile">
        <div class="kl"><i class="ti ${it.icon}"></i>${esc(lab)}</div>
        <div class="kv">${fmt(Math.round(it.value * 10) / 10)}${it.unit ? ` <sub>${esc(it.unit)}</sub>` : ''}</div>
        ${t}</div>`;
    }).join('')}</div>`;
  }

  /** Mounts a KPI card. 1 metric → single KPI (+ optional sparkline); N → compact row.
   *  opts: { baselineMap, mcRefName, sparkSeries, example }. */
  function mountKpiCard(body, config, series, opts = {}) {
    destroyBodyChart(body);
    const d = kpiCardData(config, series, opts);
    if (!d.single) {                                  // multi-metric → row of KPIs, no sparkline
      body.innerHTML = kpiMultiHtml(d.items);
      if (opts.example) _appendExampleBadge(body);
      return;
    }
    const item = d.items[0] || { value: 0, unit: '', name: '', aggName: '', scope: config.scope?.level || '', icon: VIZ_TYPES.kpi.icon, cmpName: '', delta: null };
    const spark = Array.isArray(opts.sparkSeries) && opts.sparkSeries.length >= 2;
    body.innerHTML = kpiHtml(item, spark);
    if (opts.example) _appendExampleBadge(body);
    if (!spark || typeof Chart === 'undefined') return;

    const color  = config.style?.color || _cssVar('--cm-accent', '#15803D');
    const ys     = opts.sparkSeries.map(p => (typeof p === 'number' ? p : p.y));
    const token  = (body.__kpiToken = (body.__kpiToken || 0) + 1);
    const mount = () => {
      const canvas = body.querySelector('.gp-kpi-spark canvas');
      if (!canvas || !body.isConnected || body.__kpiToken !== token) return;   // superseded
      if (!canvas.clientWidth) { requestAnimationFrame(mount); return; }
      Chart.getChart(canvas)?.destroy();
      body.__chart = new Chart(canvas, {
        type: 'line',
        data: { labels: ys.map(() => ''), datasets: [{
          data: ys, borderColor: color, borderWidth: 2,
          backgroundColor: color + '1A', fill: true,
          pointRadius: 0, pointHoverRadius: 0, tension: 0.35,
        }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, grace: '12%' } },
        },
      });
    };
    mount();
  }

  /** Pure: (config, series) → ranking view model (sorted rows + bar widths). */
  function rankingCardData(config, series) {
    const size    = config.style?.size || 'md';
    const color   = config.style?.color || _cssVar('--cm-accent', '#15803D');
    const showVal = !!config.style?.dataLabels || size !== 'sm';   // OFF only in S w/o toggle (mirrors bars)
    const unit    = series?.[0]?.unit || '';
    // "vs microciclo" ranking = biggest movers: order by |diff%|, bar width by |value|.
    const isMc    = !!series?.[0]?._mcDiff;
    const pts     = [...(series?.[0]?.points || [])].sort((a, b) => isMc ? (Math.abs(b.y) - Math.abs(a.y)) : (b.y - a.y));
    const max     = Math.max(...pts.map(p => isMc ? Math.abs(p.y) : p.y), 1);
    const rows = pts.map((p, i) => ({
      rank: i + 1, name: String(p.x), value: p.y, isMc,
      pct: Math.max(3, Math.round((isMc ? Math.abs(p.y) : p.y) / max * 100)),
      barCol: isMc ? (p.y >= 0 ? _cssVar('--cm-success', '#16A34A') : _cssVar('--cm-danger', '#DC2626')) : color,
      change: (p.change == null ? null : p.change),    // +n = climbed, −n = dropped (preview only)
    }));
    return { rows, color, showVal, unit, isMc };
  }

  /** Optional rank-change badge (▲/▼ + positions). */
  function _rankChangeHtml(change) {
    if (change == null || change === 0) return '';
    const up = change > 0;
    return `<span style="margin-left:6px;font:600 10px/1 var(--cm-font-mono);color:${up ? 'var(--cm-success)' : 'var(--cm-danger)'}">`
      + `<i class="ti ti-arrow-${up ? 'up' : 'down'}" style="font-size:10px"></i>${Math.abs(change)}</span>`;
  }

  /** Ranking markup — sorted desc, proportional bars in style.color, value on the right. */
  function rankingHtml(d) {
    const valTxt = r => {
      const v = Math.round(r.value * 10) / 10;
      return r.isMc ? `${v > 0 ? '+' : ''}${esc(fmt(v))}%` : esc(fmt(v)) + (d.unit ? ' ' + esc(d.unit) : '');
    };
    return `<div class="gp-rank">${d.rows.map(r => `
      <div class="gp-rank-row">
        <span class="ax">${r.rank}</span>
        <span class="gp-rank-bar"><span class="gp-rank-fill" style="width:${r.pct}%;background:${r.barCol || d.color}">${esc(r.name)}</span></span>
        <span class="gp-rank-v">${d.showVal ? valTxt(r) : ''}${_rankChangeHtml(r.change)}</span>
      </div>`).join('')}</div>`;
  }

  /** Mounts a ranking card. opts: { example }. */
  function mountRankingCard(body, config, series, opts = {}) {
    destroyBodyChart(body);
    const d = rankingCardData(config, series);
    if (!d.rows.length) { body.innerHTML = ''; showEmptyBody(body, 'No rows match the current scope, range and filters.'); return; }
    body.innerHTML = rankingHtml(d);
    if (opts.example) _appendExampleBadge(body);
  }

  /** Builder preview KPI — real data when a backend is present, else a badged mock. */
  function mountKpiPreview(body, S) {
    const m0 = catalogMap.get(S.metrics[0]?.id);
    if (!m0) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    if (window.sb && _clubId) { resolveAndRenderCard(draftCard, buildConfig(S)); return; }
    mountKpiMockPreview(body, S);
  }

  function mountKpiMockPreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    if (!ms.length) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    // One mock series per metric (so the multi-metric KPI shows without a backend).
    const series = S.metrics.map(m => {
      const cat = catalogMap.get(m.id), base = metSample(cat);
      return { label: m.id, name: cat.name, unit: cat.unit, points: [{ x: 'all', y: Math.round(base * 1.04) }] };
    });
    const config = {
      viz: 'kpi', metrics: S.metrics, scope: { level: S.scope },
      comparison: cmpConfig(S),
      style: { size: S.size, color: S.color, palette: S.palette, axes: S.axes, legend: S.legend, dataLabels: S.labels },
      __example: true,
    };
    let baselineMap = null, mcRefName = null;
    if (S.compare !== 'none') {                                   // mock → ~+4% delta per metric
      baselineMap = new Map(S.metrics.map(m => [m.id, Math.round(metSample(catalogMap.get(m.id)))]));
      if (S.compare === 'mc') mcRefName = mcLabel(S.refMcId);
    }
    const spark = S.metrics.length === 1
      ? DIM_MOCK.microcycle.concat(['', '']).slice(0, 6)
          .map((_, r) => ({ x: r, y: Math.round(metSample(ms[0]) * (0.82 + 0.16 * Math.abs(Math.sin(r * 1.3 + 1)))) }))
      : null;
    mountKpiCard(body, config, series, { baselineMap, mcRefName, sparkSeries: spark, example: true });
  }

  /** Builder preview ranking — real data when a backend is present, else a badged mock. */
  function mountRankingPreview(body, S) {
    const m0 = catalogMap.get(S.metrics[0]?.id);
    if (!m0) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    if (window.sb && _clubId) { resolveAndRenderCard(draftCard, buildConfig(S)); return; }
    mountRankingMockPreview(body, S);
  }

  function mountRankingMockPreview(body, S) {
    const m0    = catalogMap.get(S.metrics[0].id);
    const names = dimMockLabels(S);                       // entity = dimension[0] (default player_name)
    const base  = metSample(m0);
    const ws    = [0.96, 0.8, 0.72, 0.61, 0.47, 0.33, 0.28];
    const chg   = [0, 1, -1, 2, -2, 0, 1];
    const pts   = names.map((nm, i) => ({ x: nm, y: Math.round(base * (ws[i] ?? 0.3)),
      change: S.compare === 'none' ? null : (chg[i % chg.length]) }));
    const series = [{ label: m0.id, name: m0.name, unit: m0.unit, points: pts }];
    const config = {
      viz: 'ranking', dimensions: S.dimensions,
      style: { size: S.size, color: S.color, palette: S.palette, axes: S.axes, legend: S.legend, dataLabels: S.labels },
      __example: true,
    };
    mountRankingCard(body, config, series, { example: true });
  }

  // ── Conditional table formatting (GPS Chart Reference §5) ──
  // Per-column cell modes (bar / heat / icon / pct / plain). Min/max and icon
  // thresholds are derived from the REAL data of each column (never hardcoded).
  // The rule per column lives in metric.format and is persisted in gp.card/v1.

  let _tfPane = null;   // the open per-column rules panel (builder draft only)

  /** Sensible default format for a metric, by unit / group / name. User edits it after. */
  function _defaultFormat(cat) {
    const unit = (cat?.unit || '').toLowerCase();
    const name = (cat?.name || '').toLowerCase();
    const id   = (cat?.id || cat?.key || '').toLowerCase();
    const grp  = (cat?.group_name || '').toLowerCase();
    let mode = 'plain', dir = 'high', dec = 0;
    if (/acwr|ratio/.test(name) || /acwr|ratio/.test(id)) { mode = 'icon'; dir = 'band'; dec = 2; }      // load ratio band
    else if (unit === '%' || /readiness|wellness|availab/.test(name)) { mode = 'pct'; dec = 0; }          // % / readiness
    else if (grp === 'distance' || unit === 'm' || unit === 'km') { mode = 'bar'; }                       // distance / volume
    else if (grp === 'count' || unit === 'n' || /count|sprint/.test(name)) { mode = 'bar'; }              // counts
    return { mode, dir, dec, barColor: null, heatScale: 'gyr', iconStyle: 'dot', thr: null };
  }

  function _round3(n) { return Math.round(n * 1000) / 1000; }

  /** Quantile-based default thresholds from a column's real values. */
  function _colThr(vals, dir) {
    const s = vals.filter(v => isFinite(v)).sort((a, b) => a - b);
    if (!s.length) return { hi: 1, lo: 0 };
    const q = p => { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
    return dir === 'band'
      ? { lo: _round3(q(0.25)), hi: _round3(q(0.75)) }    // middle half = ok zone
      : { lo: _round3(q(0.34)), hi: _round3(q(0.67)) };   // high-good: ≥hi green, ≥lo amber
  }

  function _hex2rgb(h) { const m = h.replace('#', ''); const n = parseInt(m.length === 3 ? m.replace(/./g, c => c + c) : m, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function _rgb2hex(r) { return '#' + r.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
  function _lerpHex(a, b, t) { const x = _hex2rgb(a), y = _hex2rgb(b); return _rgb2hex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t)); }
  /** Interpolated heat colour for t∈[0,1] across the chosen scale. */
  function _heatColor(t, scale) {
    t = Math.max(0, Math.min(1, t));
    const stops = scale === 'ryg' ? ['#DC2626', '#F59E0B', '#15803D']
                : scale === 'seq' ? ['#DCFCE7', '#16A34A', '#14532D']
                : ['#15803D', '#F59E0B', '#DC2626'];                 // gyr (default)
    const seg = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(seg));
    return _lerpHex(stops[i], stops[i + 1], seg - i);
  }
  /** Readable text colour over a given background. */
  function _textOn(hex) { const [r, g, b] = _hex2rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1F2937' : '#fff'; }

  // ── Heatmap colour scales ──────────────────────────────────────────────
  // Two criteria, mirroring bars/KPI: by VALUE (no comparison) or by DIFF% (vs a
  // baseline). Both return saturated stops (not the washed-out .gp-zc classes) so
  // the gradient actually reads. Each column normalizes on its own range.

  /** Sequential low→high colour for t∈[0,1]. Default heatmap (no comparison): blue→red. */
  function _heatVal(t) {
    t = Math.max(0, Math.min(1, t));
    const stops = ['#1D4ED8', '#60A5FA', '#FDE68A', '#F87171', '#DC2626']; // blue → warm → red
    const seg = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(seg));
    return _lerpHex(stops[i], stops[i + 1], seg - i);
  }
  /** Divergent diff% colour for t∈[-1,1], centred on 0. Down→blue, up→red. */
  function _heatDiff(t) {
    t = Math.max(-1, Math.min(1, t));
    return t >= 0 ? _lerpHex('#F1F5F9', '#DC2626', t) : _lerpHex('#F1F5F9', '#1D4ED8', -t);
  }

  function _fmtNum(v, dec) { return dec > 0 ? (+v).toFixed(dec) : fmt(Math.round(v)); }

  const _TF_ARROW      = { good: 'ti-trending-up', warn: 'ti-minus', bad: 'ti-trending-down' };
  const _TF_ARROW_BAND = { good: 'ti-circle-check', bad: 'ti-alert-triangle' };

  function _iconStatus(v, thr, dir) {
    if (dir === 'band') return (v >= thr.lo && v <= thr.hi) ? 'good' : 'bad';
    return v >= thr.hi ? 'good' : v >= thr.lo ? 'warn' : 'bad';
  }

  /** Builds the inner HTML for one measure cell, per its column format + real stats. */
  function tableCellHtml(value, f, stats) {
    if (value == null || !isFinite(value)) return `<span class="tf-c plain">—</span>`;
    const valTxt = esc(_fmtNum(value, f.dec ?? 0));
    const { min, max, accent } = stats;
    switch (f.mode) {
      case 'bar': {
        const w = max > min ? Math.max(2, Math.round((value - min) / (max - min) * 100)) : 100;
        return `<span class="tf-c bar"><span class="tf-fill" style="width:${w}%;background:${f.barColor || accent}"></span><span class="tf-val">${valTxt}</span></span>`;
      }
      case 'heat': {
        const t  = max > min ? (value - min) / (max - min) : 0.5;
        const bg = _heatColor(t, f.heatScale || 'gyr');
        return `<span class="tf-c heat heat-cell" style="background:${bg};color:${_textOn(bg)}">${valTxt}</span>`;
      }
      case 'icon': {
        const thr = f.thr || stats.thr;
        const st  = _iconStatus(value, thr, f.dir || 'high');
        const inner = (f.iconStyle === 'arrow')
          ? `<i class="ti ${(f.dir === 'band' ? _TF_ARROW_BAND : _TF_ARROW)[st] || 'ti-minus'}"></i>`
          : `<span class="tf-dot"></span>`;
        return `<span class="tf-c icon ${st}">${inner}<span class="tf-val">${valTxt}</span></span>`;
      }
      case 'pct': {
        const w = Math.max(0, Math.min(100, value));
        return `<span class="tf-c pct"><span class="tf-track"><span style="width:${w}%;background:${f.barColor || accent}"></span></span><span class="tf-val">${valTxt}%</span></span>`;
      }
      default:
        return `<span class="tf-c plain">${valTxt}</span>`;
    }
  }

  /** Per-column effective format + real-data stats (min/max/thr) for the table. */
  function _tableColumns(config, series, accent) {
    return series.map((s, i) => {
      const cat  = catalogMap.get(config.metrics?.[i]?.id) || {};
      const f    = config.metrics?.[i]?.format || _defaultFormat(cat);
      const vals = s.points.map(p => p.y).filter(v => isFinite(v));
      const min  = vals.length ? Math.min(...vals) : 0;
      const max  = vals.length ? Math.max(...vals) : 1;
      return { s, cat, f, stats: { min, max, accent, thr: f.thr || _colThr(vals, f.dir || 'high') } };
    });
  }

  /** Natural-order key for matchday/microcycle labels (MD-3 < … < MD, "MC 45" → 45). */
  function _temporalKey(s) {
    s = String(s); let m;
    if ((m = s.match(/^MD(?:[\s-]?(\d+))?$/i))) return m[1] ? -(+m[1]) : 0;
    if ((m = s.match(/(-?\d+(?:\.\d+)?)/))) return +m[1];
    return 0;
  }

  /** Sort identifier for a column: measures → "met:<metricId>", dims → "dim:<dimId>". */
  function _dimSortId(config, j) { return 'dim:' + (config.dimensions?.[j]?.id || '__row'); }

  /** Default first-click direction: numbers & dates descending, text ascending (A→Z). */
  function _defaultSortDir(colId) {
    if (colId.startsWith('met:')) return 'desc';
    const id = colId.slice(4);
    return (id === 'session_date' || id === 'md_code' || id === 'microcycle') ? 'desc' : 'asc';
  }

  /** (sort, config, series) → row comparator, or null if the column no longer exists. */
  function _rowComparator(sort, config, series) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    let get, type;
    if (sort.col.startsWith('met:')) {
      const si = (config.metrics || []).findIndex(m => m.id === sort.col.slice(4));
      if (si < 0 || !series[si]) return null;
      const map = new Map(series[si].points.map(p => [p.x, p.y]));
      get = p => map.get(p.x); type = 'number';
    } else {
      const id = sort.col.slice(4);
      const j  = id === '__row' ? 0 : (config.dimensions || []).findIndex(d => d.id === id);
      if (j < 0) return null;
      get = p => (p.dims ? p.dims[j] : p.x) ?? p.x;
      type = id === 'session_date' ? 'date' : (id === 'md_code' || id === 'microcycle') ? 'temporal' : 'text';
    }
    return (a, b) => {
      const va = get(a), vb = get(b); let c;
      if (type === 'number')        { const na = +va, nb = +vb; c = (isFinite(na) ? na : -Infinity) - (isFinite(nb) ? nb : -Infinity); }
      else if (type === 'date')     { c = String(va).localeCompare(String(vb)); }
      else if (type === 'temporal') { c = _temporalKey(va) - _temporalKey(vb); }
      else                          { c = String(va).localeCompare(String(vb), undefined, { numeric: true }); }
      return dir * c;
    };
  }

  /** Cycles the table sort for a column (desc/asc → opposite → original) and re-renders live. */
  function _toggleSort(colId) {
    const cur = S.sort, first = _defaultSortDir(colId);
    if (!cur || cur.col !== colId) S.sort = { col: colId, dir: first };
    else if (cur.dir === first)    S.sort = { col: colId, dir: first === 'asc' ? 'desc' : 'asc' };
    else                           S.sort = null;   // third click → back to original order
    _rerenderDraftTable();
  }

  /**
   * Renders the conditional-format table. opts: { editable, example }.
   * Sorting (header click) is ALWAYS available — on the live dashboard card and in
   * the editor preview. `editable` (the builder draft) additionally shows the format
   * chip per measure column; live cards never expose format editing.
   */
  function mountTableCard(body, config, series, opts = {}) {
    destroyBodyChart(body);
    const editable = !!opts.editable;
    const rowPts = series?.[0]?.points || [];
    if (!series?.length || !rowPts.length) { body.innerHTML = ''; showEmptyBody(body, 'No rows match the current scope, range and filters.'); return; }

    const accent  = config.style?.color || _cssVar('--cm-accent', '#15803D');
    const dimCols = (config.dimensions || []).map(d => DIM_MAP.get(d.id)?.name || d.id);
    if (!dimCols.length) dimCols.push(config.dimensions?.[0] ? 'Group' : 'Player');   // legacy single identity
    const cols = _tableColumns(config, series, accent);

    // Presentation-only ordering (header click). Falls back to original order if the
    // sorted column was removed.
    const sort = config.sort && config.sort.col ? config.sort : null;
    let orderedRows = rowPts;
    if (sort) { const cmp = _rowComparator(sort, config, series); if (cmp) orderedRows = [...rowPts].sort(cmp); }
    const arrow = id => (sort && sort.col === id)
      ? ` <i class="ti ti-${sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} tf-sort-arr"></i>` : '';

    const dimHead = dimCols.map((n, j) => {
      const sid = _dimSortId(config, j);
      return `<th class="${j === 0 ? 'pc' : 'dc'} tf-sortable" data-sort="${sid}" title="Ordenar por esta columna">${esc(n)}${arrow(sid)}</th>`;
    }).join('');
    const metHead = cols.map((c, i) => {
      const sid  = 'met:' + (config.metrics?.[i]?.id || i);
      const name = esc(c.s.name.split(' ')[0]);
      const chip = editable ? `<span class="tf-fbtn" data-mi="${i}" title="Formato condicional"><i class="ti ti-adjustments"></i></span>` : '';
      return `<th class="tf-sortable${editable ? ' tf-h' : ''}" data-sort="${sid}" title="Ordenar por esta columna">${name}${arrow(sid)}${chip}</th>`;
    }).join('');
    const head = `<tr>${dimHead}${metHead}</tr>`;

    const rows = orderedRows.map(p => {
      const dimCells = (p.dims || [p.x]).map((v, i) => `<td class="${i === 0 ? 'pc' : 'dc'}">${esc(v)}</td>`).join('');
      const valCells = cols.map(c => {
        const pt = c.s.points.find(q => q.x === p.x);
        return `<td class="tf">${tableCellHtml(pt ? pt.y : null, c.f, c.stats)}</td>`;
      }).join('');
      return `<tr>${dimCells}${valCells}</tr>`;
    }).join('');

    body.innerHTML = `<div class="gp-zwrap"><table class="gp-zt"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    if (opts.example) _appendExampleBadge(body);
    body.__tf = { series };   // cache real series so format/sort edits re-render without re-querying

    // Sorting: always on. Clic en el nombre/encabezado → ordena (draft o card en vivo);
    // el chip de formato (solo editor) hace su propio clic.
    body.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', e => {
      if (e.target.closest('.tf-fbtn')) return;   // format chip handles its own click
      _onTableSortClick(body, th.dataset.sort);
    }));
    if (editable) {
      body.querySelectorAll('.tf-fbtn[data-mi]').forEach(chip => chip.addEventListener('click', e => {
        e.stopPropagation(); openTfPane(+chip.dataset.mi, chip.closest('th'));
      }));
    }
  }

  /**
   * Header-click sort dispatch. In the builder draft it mutates S.sort and re-renders
   * from cache (persisted when the card is saved). On a live dashboard card it mutates
   * that card's stored config, re-renders, and persists immediately via updateDashboardCard.
   */
  function _onTableSortClick(body, colId) {
    const cardEl = body.closest('.gp-c');
    if (cardEl && cardEl === draftCard) _toggleSort(colId);          // editor preview
    else if (cardEl) _toggleSavedCardSort(cardEl, colId);           // live saved card
  }

  /** Cycles + persists the sort of an already-saved dashboard card (no builder context). */
  function _toggleSavedCardSort(cardEl, colId) {
    const config = cardEl.__config;
    if (!config) return;
    const cur = config.sort && config.sort.col ? config.sort : null, first = _defaultSortDir(colId);
    let next;
    if (!cur || cur.col !== colId) next = { col: colId, dir: first };
    else if (cur.dir === first)    next = { col: colId, dir: first === 'asc' ? 'desc' : 'asc' };
    else                           next = null;   // third click → original order
    if (next) config.sort = next; else delete config.sort;
    if (cardEl.__cfg) cardEl.__cfg.sort = next || null;             // keep internal mirror in sync

    const body = cardEl.querySelector('.gp-c-b');
    if (body && body.__tf) mountTableCard(body, config, body.__tf.series, { editable: false });   // instant, no re-query
    else resolveAndRenderCard(cardEl, config);

    const cardId = cardEl.dataset.cardId;
    if (_isUuid(cardId) && typeof window.updateDashboardCard === 'function') {
      window.updateDashboardCard(cardId, config, window.sb).catch(e => console.warn('gpb: sort persist failed:', e));
    }
  }

  /** Re-renders the draft table from cached series with the current S formats (live, no re-query). */
  function _rerenderDraftTable() {
    const body = draftCard?.querySelector('.gp-c-b');
    if (!body || !body.__tf) return;
    mountTableCard(body, buildConfig(S), body.__tf.series, { editable: true });
  }

  // ── Per-column rules panel (.tf-pane) ──

  function closeTfPane() {
    if (_tfPane) { _tfPane.remove(); _tfPane = null; }
    document.removeEventListener('mousedown', _tfOutside, true);
    document.removeEventListener('keydown', _tfEsc, true);
  }
  function _tfOutside(e) { if (_tfPane && !_tfPane.contains(e.target)) closeTfPane(); }
  function _tfEsc(e) { if (e.key === 'Escape') closeTfPane(); }

  function openTfPane(mi, anchor) {
    closeTfPane();
    const m = S.metrics[mi]; if (!m) return;
    const cat = catalogMap.get(m.id) || {};
    if (!m.format) m.format = _defaultFormat(cat);   // materialize default so the edit persists
    _tfPane = document.createElement('div');
    _tfPane.className = 'tf-pane';
    document.body.appendChild(_tfPane);
    _renderTfPane(mi);
    _positionPane(_tfPane, anchor);
    setTimeout(() => {
      document.addEventListener('mousedown', _tfOutside, true);
      document.addEventListener('keydown', _tfEsc, true);
    }, 0);
  }

  function _positionPane(pane, anchor) {
    const r = anchor.getBoundingClientRect();
    let left = Math.min(r.left, innerWidth - pane.offsetWidth - 12);
    let top  = r.bottom + 6;
    if (top + pane.offsetHeight > innerHeight - 12) top = Math.max(12, r.top - pane.offsetHeight - 6);
    pane.style.left = Math.max(12, left) + 'px';
    pane.style.top  = top + 'px';
  }

  function _renderTfPane(mi) {
    const m = S.metrics[mi], cat = catalogMap.get(m.id) || {}, f = m.format;
    const ser  = (draftCard?.querySelector('.gp-c-b')?.__tf?.series || [])[mi];
    const vals = ser ? ser.points.map(p => p.y).filter(isFinite) : [];
    const thr  = f.thr || _colThr(vals, f.dir || 'high');
    _tfPane.innerHTML = _tfPaneHtml(cat, f, thr);
    _bindTfPane(mi);
  }

  function _tfPaneHtml(cat, f, thr) {
    const seg = (attr, opts, cur) => `<div class="tf-seg">${opts.map(o => `<button data-${attr}="${o.v}" class="${cur === o.v ? 'is-on' : ''}">${o.l}</button>`).join('')}</div>`;
    const modeSeg = seg('mode', [{ v: 'plain', l: 'plain' }, { v: 'bar', l: 'bar' }, { v: 'heat', l: 'heat' }, { v: 'icon', l: 'icon' }, { v: 'pct', l: 'pct' }], f.mode);
    let cond = '';
    if (f.mode === 'bar' || f.mode === 'pct') {
      cond = `<div class="tf-row"><span class="lab">Color</span><div class="tf-sw">${COLORS.map(c => `<button data-col="${c.hex}" class="${(f.barColor || '') === c.hex ? 'is-on' : ''}" style="background:${c.hex}"></button>`).join('')}</div></div>`;
    } else if (f.mode === 'heat') {
      cond = `<div class="tf-row"><span class="lab">Escala</span><select data-scale>
        <option value="gyr" ${f.heatScale === 'gyr' ? 'selected' : ''}>Verde → Rojo (alto malo)</option>
        <option value="ryg" ${f.heatScale === 'ryg' ? 'selected' : ''}>Rojo → Verde (alto bueno)</option>
        <option value="seq" ${f.heatScale === 'seq' ? 'selected' : ''}>Secuencial (acento)</option></select></div>`;
    } else if (f.mode === 'icon') {
      const band = (f.dir || 'high') === 'band';
      cond = `<div class="tf-row"><span class="lab">Estilo</span>${seg('istyle', [{ v: 'dot', l: 'semáforo' }, { v: 'arrow', l: 'flecha' }], f.iconStyle || 'dot')}</div>
        <div class="tf-row"><span class="lab">Lógica</span>${seg('dir', [{ v: 'high', l: 'alto = bueno' }, { v: 'band', l: 'banda' }], f.dir || 'high')}</div>
        <div class="tf-row"><span class="lab">Umbrales ${band ? '(zona ok)' : ''}</span><div class="tf-thr">
          <label>${band ? 'mín' : 'ámbar ≥'}<input type="number" step="any" data-thr="lo" value="${_round3(thr.lo)}"></label>
          <label>${band ? 'máx' : 'verde ≥'}<input type="number" step="any" data-thr="hi" value="${_round3(thr.hi)}"></label>
        </div></div>`;
    }
    const decRow = `<div class="tf-row"><span class="lab">Decimales</span><input type="number" min="0" max="3" data-dec value="${f.dec ?? 0}"></div>`;
    return `<div class="tf-hd"><span class="t">${esc(cat.name || 'Columna')}</span><button class="x"><i class="ti ti-x"></i></button></div>
      <div class="tf-row"><span class="lab">Formato</span>${modeSeg}</div>${cond}${decRow}`;
  }

  function _bindTfPane(mi) {
    const pane = _tfPane, f = S.metrics[mi].format;
    pane.querySelector('.x').onclick = closeTfPane;
    pane.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { f.mode = b.dataset.mode; _renderTfPane(mi); _rerenderDraftTable(); });
    pane.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => { f.dir = b.dataset.dir; f.thr = null; _renderTfPane(mi); _rerenderDraftTable(); });
    pane.querySelectorAll('[data-istyle]').forEach(b => b.onclick = () => { f.iconStyle = b.dataset.istyle; _renderTfPane(mi); _rerenderDraftTable(); });
    pane.querySelectorAll('[data-col]').forEach(b => b.onclick = () => {
      f.barColor = b.dataset.col;
      pane.querySelectorAll('[data-col]').forEach(x => x.classList.toggle('is-on', x === b));
      _rerenderDraftTable();
    });
    const scale = pane.querySelector('[data-scale]');
    if (scale) scale.onchange = () => { f.heatScale = scale.value; _rerenderDraftTable(); };
    const hi = pane.querySelector('[data-thr="hi"]'), lo = pane.querySelector('[data-thr="lo"]');
    const applyThr = () => { const h = parseFloat(hi.value), l = parseFloat(lo.value); if (isFinite(h) && isFinite(l)) { f.thr = { hi: h, lo: l }; _rerenderDraftTable(); } };
    if (hi) hi.oninput = applyThr;
    if (lo) lo.oninput = applyThr;
    const dec = pane.querySelector('[data-dec]');
    if (dec) dec.oninput = () => { const d = parseInt(dec.value, 10); if (isFinite(d)) { f.dec = Math.max(0, Math.min(3, d)); _rerenderDraftTable(); } };
  }

  /** Builder preview table — real data when a backend is present, else a badged mock. */
  function mountTablePreview(body, S) {
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    if (!ms.length) { destroyBodyChart(body); body.innerHTML = renderType(S); return; }
    if (window.sb && _clubId) { resolveAndRenderCard(draftCard, buildConfig(S)); return; }
    mountTableMockPreview(body, S);
  }

  function mountTableMockPreview(body, S) {
    const rows = dimMockRows(S, 6);                       // [[dimVals…], …]
    const series = S.metrics.map((m, mi) => {
      const cat  = catalogMap.get(m.id);
      const base = metSample(cat);
      const band = /acwr|ratio/.test((cat?.name || '').toLowerCase()) || /acwr|ratio/.test((cat?.id || '').toLowerCase());
      const points = rows.map((dv, r) => ({
        x: dv.join(' · '), dims: dv,
        y: band ? Math.round((0.7 + 0.7 * Math.abs(Math.sin(r * 1.4 + mi + 1))) * 100) / 100
                : Math.round(base * (0.45 + 0.5 * Math.abs(Math.sin(r * 1.4 + mi + 1)))),
      }));
      return { label: m.id, name: cat.name, unit: cat.unit, points };
    });
    const config = buildConfig(S);
    mountTableCard(body, config, series, { editable: true, example: true });
  }

  /**
   * Renders a chart body from a real Dataset (series with actual data points).
   * Mirrors renderType() but uses series data instead of hardcoded samples.
   *
   * @param {object}   config  gp.card/v1
   * @param {object[]} series  aggregateSeries() output
   * @param {object}   opts    draw extras (e.g. baselineMap for the heatmap)
   * @returns {string} innerHTML
   */
  function renderTypeFromDataset(config, series, opts = {}) {
    const viz   = config.viz;
    const color = config.style?.color || '#15803D';
    const axes  = config.style?.axes !== false;
    const legend= config.style?.legend !== false;
    const labels= !!config.style?.dataLabels;
    const rowDimName = config.dimensions?.[0] ? (DIM_MAP.get(config.dimensions[0].id)?.name || 'Group') : 'Player';
    const s0    = series[0];
    const s1    = series[1];

    function fmtY(y) { return fmt(Math.round(y * 10) / 10); }

    switch (viz) {
      case 'kpi': {
        const val  = s0?.points[0]?.y ?? 0;
        const unit = s0?.unit || '';
        const aggName = AGG[config.metrics[0]?.agg]?.name || '';
        const rangeName = RANGES.find(r => r.id === config.range?.type)?.name || '';
        return `<div class="l"><i class="ti ${VIZ_TYPES.kpi.icon}"></i>${aggName} · ${rangeName}</div>
          <div class="v">${fmtY(val)} <sub>${esc(unit)}</sub></div>
          <div class="t">${esc(s0?.name || '')}</div>`;
      }

      case 'ranking': {
        const pts = [...(s0?.points || [])];
        const max = Math.max(...pts.map(p => p.y), 1);
        return `<div class="gp-rank">${pts.map((p, i) => `
          <div class="gp-rank-row">
            <span class="ax">${i + 1}</span>
            <span class="gp-rank-bar">
              <span class="gp-rank-fill ${i < 1?'':i<3?'med':'low'}" style="width:${Math.round(p.y/max*100)}%">${esc(p.x)}</span>
            </span>
            <span style="text-align:right;font:600 12px/1 var(--cm-font-mono);color:var(--cm-fg)">${labels ? fmtY(p.y) : ''}</span>
          </div>`).join('')}</div>`;
      }

      case 'bars': {
        const pts0 = s0?.points || [];
        const pts1 = s1?.points || [];
        const maxY = Math.max(...pts0.map(p => p.y), ...pts1.map(p => p.y), 1);
        return `<div class="gp-bars">${pts0.map((p, i) => {
          const h0 = Math.max(3, Math.round(p.y / maxY * 98));
          const h1 = pts1[i] ? Math.max(2, Math.round(pts1[i].y / maxY * 98)) : 0;
          return `<div class="gr"><div class="stack">
            ${h1 ? `<div class="b prev" style="height:${h1}%"></div>` : ''}
            <div class="b curr" style="height:${h0}%"></div></div>
            ${axes ? `<span class="lbl">${esc((p.x||'').split(',')[0].slice(0,6))}</span>` : ''}
          </div>`;
        }).join('')}</div>
        ${legend && s0 ? `<div style="display:flex;gap:14px;margin-top:10px;font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">
          <span style="display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:2px;background:var(--cm-accent)"></i>${esc(s0.name)}</span>
          ${s1 ? `<span style="display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:2px;background:var(--cm-bg-sunk);border:1px solid var(--cm-border)"></i>${esc(s1.name)}</span>` : ''}
        </div>` : ''}`;
      }

      case 'line': {
        const pts = s0?.points || [];
        if (!pts.length) return '<div style="padding:20px;color:var(--cm-fg-muted)">No data</div>';
        const maxY = Math.max(...pts.map(p => p.y), 1);
        const W = 380, H = 180, pad = 28;
        const xStep = pts.length > 1 ? (W - pad * 2) / (pts.length - 1) : 0;
        const yScale = (H - pad) / maxY;
        const svgPts = pts.map((p, i) => `${pad + i * xStep},${H - p.y * yScale}`).join(' ');
        const pts2 = s1?.points || [];
        const svgPts2 = pts2.length > 1
          ? pts2.map((p, i) => `${pad + i * xStep},${H - p.y * yScale}`).join(' ')
          : null;
        return `<svg viewBox="0 0 ${W} ${legend?210:H+10}" font-family="Geist,Inter,sans-serif">
          ${axes ? `<g stroke="var(--cm-border-soft)" stroke-width="1"><line x1="${pad}" y1="${H}" x2="${W-pad}" y2="${H}"/></g>` : ''}
          <polyline fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" points="${svgPts}"/>
          ${svgPts2 ? `<polyline fill="none" stroke="var(--cm-info,#3B82F6)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7" points="${svgPts2}"/>` : ''}
          ${legend ? `<g font-size="10" font-weight="600" fill="var(--cm-fg-muted)">
            ${[s0,s1].filter(Boolean).map((s,i)=>`<text x="${pad+i*150}" y="200">${esc(s.name.split(' ')[0])}</text>`).join('')}
          </g>` : ''}</svg>`;
      }

      case 'scatter': {
        if (!s0 || !s1) return renderType({ ...config, type:'scatter' }); // fallback to mock
        const xs = s0.points.map(p => p.y);
        const ys = s1.points.map(p => p.y);
        const xMax = Math.max(...xs, 1), yMax = Math.max(...ys, 1);
        const W = 380, H = 230, pL = 44, pB = 34;
        const svgDots = xs.map((x, i) => {
          const cx = pL + (x / xMax) * (W - pL - 16);
          const cy = H - pB - (ys[i] / yMax) * (H - pB - 16);
          return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="${color}" opacity=".7"/>`;
        }).join('');
        return `<svg viewBox="0 0 ${W} ${H}" font-family="Geist,Inter,sans-serif">
          ${axes ? `<g stroke="var(--cm-border-soft)" stroke-width="1"><line x1="${pL}" y1="16" x2="${pL}" y2="${H-pB}"/><line x1="${pL}" y1="${H-pB}" x2="${W-16}" y2="${H-pB}"/></g>
          <text x="${W/2}" y="${H}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--cm-fg-muted)">${esc(s0.name)} →</text>
          <text x="14" y="${(H-pB)/2}" transform="rotate(-90 14 ${(H-pB)/2})" text-anchor="middle" font-size="10" font-weight="600" fill="var(--cm-fg-muted)">${esc(s1.name)} ↑</text>` : ''}
          ${svgDots}</svg>`;
      }

      case 'radar':
        // Radar is rendered via Chart.js (mountRadarChart) straight into the body,
        // with per-axis baseline normalization — never the old global-max SVG and
        // never a mock fallback. If reached here, show an empty state.
        return `<div class="cb2-state empty"><div class="ic"><i class="ti ti-chart-radar"></i></div><div class="t">Radar needs ≥3 metrics</div></div>`;

      case 'table': {
        // one column per chosen dimension (in order) + one per measure
        const dimCols = (config.dimensions || []).map(d => DIM_MAP.get(d.id)?.name || d.id);
        if (!dimCols.length) dimCols.push(rowDimName);   // legacy: single identity column
        const rowPts = series[0]?.points || [];          // rows (with composite key + per-dim values)
        return `<div class="gp-zwrap"><table class="gp-zt"><thead><tr>
          ${dimCols.map((n, i) => `<th class="${i === 0 ? 'pc' : 'dc'}">${esc(n)}</th>`).join('')}
          ${series.map(s => `<th>${esc(s.name.split(' ')[0])}</th>`).join('')}
        </tr></thead><tbody>${rowPts.map(p => `<tr>
          ${(p.dims || [p.x]).map((v, i) => `<td class="${i === 0 ? 'pc' : 'dc'}">${esc(v)}</td>`).join('')}
          ${series.map(s => { const pt = s.points.find(q => q.x === p.x); return `<td>${pt ? fmtY(pt.y) : '—'}</td>`; }).join('')}
        </tr>`).join('')}</tbody></table></div>`;
      }

      case 'heatmap': {
        const allX = [...new Set(series.flatMap(s => s.points.map(p => p.x)))];
        // Same criterion as bars/KPI: colour by VALUE when there's no comparison, by
        // DIFF% when one is set. mc carries .diff per point (enriched upstream);
        // role/match come as a per-metric baseline map handed in via opts.baselineMap.
        const cmp = config.comparison?.baseline || null;          // null | mc | role | match | md
        const baselineMap = opts.baselineMap || null;
        const unitOf = s => s.unit ? ` ${s.unit}` : '';
        // diff% for one cell, by comparison mode (null = no reference available).
        const diffOf = (s, pt) => {
          if (!pt) return null;
          if (cmp === 'mc') return (pt.diff != null && isFinite(pt.diff)) ? pt.diff : null;
          const bv = baselineMap ? baselineMap.get(s.label) : null;
          if (bv != null && bv > 0 && pt.y != null && isFinite(pt.y)) return (pt.y - bv) / bv * 100;
          return null;
        };
        // A comparison only colours by diff% if the reference actually resolved (mc
        // enriched points, or a role/match baseline arrived). Otherwise — e.g. 'md',
        // or a degraded mc — fall back to value colouring instead of an all-grey grid.
        const useDiff = !!cmp && series.some(s => s.points.some(p => diffOf(s, p) != null));
        // Per-COLUMN scale so every metric reads on its own range (point 2):
        //  · value → real min→max of the column
        //  · diff  → symmetric ±maxAbs centred on 0 (min 1% so faint diffs still show)
        const colMeta = series.map(s => {
          if (useDiff) {
            const ds = s.points.map(p => diffOf(s, p)).filter(d => d != null && isFinite(d));
            return { maxAbs: Math.max(1, ...ds.map(Math.abs)) };
          }
          const vs = s.points.map(p => p.y).filter(v => v != null && isFinite(v));
          const min = vs.length ? Math.min(...vs) : 0, max = vs.length ? Math.max(...vs) : 0;
          return { min, span: (max - min) || 1 };
        });
        return `<div class="gp-zwrap"><table class="gp-zt"><thead><tr>
          <th class="pc">${esc(rowDimName)}</th>
          ${series.map(s => `<th>${esc(s.name.split(' ')[0])}</th>`).join('')}
        </tr></thead><tbody>${allX.map(x => `<tr>
          <td class="pc" style="padding:6px 14px;font:500 12px/1 var(--cm-font-sans)">${esc(x)}</td>
          ${series.map((s, ci) => {
            const pt  = s.points.find(p => p.x === x);
            const val = pt?.y;
            const m   = colMeta[ci];
            // The NUMBER always shows on top of the colour (like the table "heat"
            // format) — colour alone isn't legible. Value mode → the metric value;
            // diff mode → the signed diff%. Tooltip always carries the real value.
            let bg, fg, lbl, tip;
            if (val == null || !isFinite(val)) {
              bg = 'var(--cm-bg-soft)'; fg = 'var(--cm-fg-muted)'; lbl = '—';
              tip = `${x} · ${s.name}: sin datos`;
            } else if (useDiff) {
              const d = diffOf(s, pt);
              if (d == null) {
                bg = 'var(--cm-bg-soft)'; fg = 'var(--cm-fg-muted)'; lbl = fmtY(val);
                tip = `${x} · ${s.name}: ${fmtY(val)}${unitOf(s)} (sin referencia)`;
              } else {
                bg = _heatDiff(d / m.maxAbs); fg = _textOn(bg);
                lbl = (d >= 0 ? '+' : '') + d.toFixed(d >= 10 || d <= -10 ? 0 : 1) + '%';
                tip = `${x} · ${s.name}: ${fmtY(val)}${unitOf(s)} · Δ ${(d >= 0 ? '+' : '') + d.toFixed(1)}%`;
              }
            } else {
              bg = _heatVal((val - m.min) / m.span); fg = _textOn(bg);
              lbl = fmtY(val);
              tip = `${x} · ${s.name}: ${fmtY(val)}${unitOf(s)}`;
            }
            return `<td><span class="gp-zc" style="background:${bg};color:${fg};width:auto;min-width:46px;padding:0 8px" title="${esc(tip)}">${esc(lbl)}</span></td>`;
          }).join('')}
        </tr>`).join('')}</tbody></table></div>`;
      }

      default:
        return renderType({ ...config, type: viz }); // fallback to mock
    }
  }

  // ── Mock chart rendering (Phase 1 — sample data) ──────────

  function renderType(S) {
    const type = S.type;
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    const color = S.color || '#15803D';
    const axes = S.axes !== false, legend = S.legend !== false, labels = !!S.labels;
    const rangeName = RANGES.find(r=>r.id===S.range)?.name || S.range;
    const cmp = S.compare === 'none' ? ''
      : (S.compare === 'mc' ? `vs ${mcLabel(S.refMcId)}` : (COMPARES.find(c=>c.id===S.compare)?.name || ''));
    const m0 = ms[0];
    const s0 = m0 ? metSample(m0) : 100;

    switch (type) {
      case 'kpi': {
        const agg = AGG[S.metrics[0].agg];
        return `<div class="l"><i class="ti ${metIcon(m0)}"></i>${cmp || ((agg?.short||'') + ' · ' + rangeName)}</div>
          <div class="v">${fmt(s0)} <sub>${esc(m0.unit)}</sub></div>
          ${cmp ? `<div class="t"><span class="d up"><i class="ti ti-arrow-up-right"></i>+8%</span> · z = +0.6</div>` : `<div class="t">${agg?.name||''} · ${rangeName}</div>`}`;
      }
      case 'ranking': {
        const rl = dimMockLabels(S);
        const ws = [96,82,74,61,47,33,28];
        const rows = rl.map((nm,i) => [nm, ws[i] ?? 30]);
        return `<div class="gp-rank">${rows.map((r,i)=>`<div class="gp-rank-row"><span class="ax">${i+1}</span><span class="gp-rank-bar"><span class="gp-rank-fill ${i<1?'':i<3?'med':'low'}" style="width:${r[1]}%">${esc(r[0])}</span></span><span style="text-align:right;font:600 12px/1 var(--cm-font-mono);color:var(--cm-fg)">${labels?fmt(Math.round(s0*r[1]/100)):''}</span></div>`).join('')}</div>`;
      }
      case 'bars': {
        const hs = [58,72,90,46,80,64,98];
        const m1 = ms[1];
        const bl = dimMockLabels(S);
        return `<div class="gp-bars">${hs.map((h,i)=>`<div class="gr"><div class="stack">${m1?`<div class="b prev" style="height:${h-12}%"></div>`:''}<div class="b curr" style="height:${h}%"></div></div>${axes?`<span class="lbl">${esc((bl[i]||'').split(' ')[0])}</span>`:''}</div>`).join('')}</div>
          ${legend?`<div style="display:flex;gap:14px;margin-top:10px;font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">
            <span style="display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:2px;background:var(--cm-accent)"></i>${esc(m0.name)}</span>
            ${m1?`<span style="display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:2px;background:var(--cm-bg-sunk);border:1px solid var(--cm-border)"></i>${esc(m1.name)}</span>`:''}</div>`:''}`;
      }
      case 'line': {
        const pts1 = '28,150 86,120 144,134 202,92 260,108 318,64 360,80';
        const pts2 = '28,170 86,156 144,160 202,140 260,146 318,128 360,134';
        return `<svg viewBox="0 0 380 ${legend?210:190}" font-family="Geist,Inter,sans-serif">
          ${axes?'<g stroke="var(--cm-border-soft)" stroke-width="1"><line x1="20" y1="180" x2="370" y2="180"/></g>':''}
          <polyline fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" points="${pts1}"/>
          ${ms[1]?`<polyline fill="none" stroke="var(--cm-info,#3B82F6)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7" points="${pts2}"/>`:''}
          ${legend?`<g font-size="10" font-weight="600" fill="var(--cm-fg-muted)">${ms.slice(0,2).map((m,i)=>`<text x="${24+i*150}" y="200">${esc(m.name.split(' ')[0])}</text>`).join('')}</g>`:''}</svg>`;
      }
      case 'scatter': {
        const pts = [[110,150],[160,120],[210,135],[260,90],[200,70],[320,60],[140,165],[290,110]];
        const m1 = ms[1];
        return `<svg viewBox="0 0 380 230" font-family="Geist,Inter,sans-serif">
          ${axes?'<g stroke="var(--cm-border-soft)" stroke-width="1"><line x1="44" y1="16" x2="44" y2="196"/><line x1="44" y1="196" x2="368" y2="196"/></g>':''}
          ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${color}" opacity="${i===2?1:.6}"/>`).join('')}
          ${axes?`<text x="206" y="220" text-anchor="middle" font-size="10" font-weight="600" fill="var(--cm-fg-muted)">${esc(m0.name)} →</text>
            <text x="16" y="106" transform="rotate(-90 16 106)" text-anchor="middle" font-size="10" font-weight="600" fill="var(--cm-fg-muted)">${m1?esc(m1.name):''} ↑</text>`:''}</svg>`;
      }
      case 'radar': {
        const n = ms.length, cx = 190, cy = 140, R = 98;
        const pt = (i,r) => [cx + r*Math.sin(i/n*2*Math.PI), cy - r*Math.cos(i/n*2*Math.PI)];
        const ring = rr => `<polygon fill="none" stroke="var(--cm-border-soft)" stroke-width="1" points="${Array.from({length:n},(_,i)=>pt(i,rr).map(v=>v.toFixed(0)).join(',')).join(' ')}"/>`;
        const shape = Array.from({length:n},(_,i)=>pt(i,R*(0.5+0.4*Math.abs(Math.sin(i*1.3+1)))).map(v=>v.toFixed(0)).join(',')).join(' ');
        const lbls = axes ? ms.map((m,i)=>{ const [x,y]=pt(i,R+22); return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--cm-fg-muted)">${esc(m.name.split(' ')[0])}</text>`; }).join('') : '';
        return `<svg viewBox="0 0 380 290" font-family="Geist,Inter,sans-serif">${ring(R)}${ring(R*.6)}<polygon points="${shape}" fill="${color}22" stroke="${color}" stroke-width="2.2"/>${lbls}</svg>`;
      }
      case 'table': {
        const cols = ms.slice(0,5);
        const names = dimNames(S);
        const rows  = dimMockRows(S);
        return `<div class="gp-zwrap"><table class="gp-zt"><thead><tr>${names.map((n,i)=>`<th class="${i===0?'pc':'dc'}">${esc(n)}</th>`).join('')}${cols.map(m=>`<th>${esc(m.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((dimVals,r)=>`<tr>${dimVals.map((v,i)=>`<td class="${i===0?'pc':'dc'}">${esc(v)}</td>`).join('')}${cols.map((m,c)=>`<td>${fmt(Math.round(metSample(m)*(0.8+.08*((r+c)%4))))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      case 'heatmap': {
        const cols = ms.slice(0,6);
        const rowsL = dimMockLabels(S);
        // Mirror the real renderer's two criteria so the preview matches what ships:
        // no comparison → vivid value scale; any comparison → divergent diff% (down
        // blue / up red, centred on 0). Mock values come from a deterministic wave.
        const useDiff = S.compare && S.compare !== 'none';
        return `<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">${esc(dimRowName(S))}</th>${cols.map(m=>`<th>${esc(m.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${rowsL.map((p,r)=>`<tr><td class="pc" style="padding:6px 14px;font:500 12px/1 var(--cm-font-sans)">${esc(p)}</td>${cols.map((m,c)=>{
            const w = Math.sin(r*1.6+c*.9);                 // [-1,1] deterministic
            let bg, fg, lbl;                                 // number always on top of colour
            if (useDiff) { const d = w*30; bg=_heatDiff(d/30); fg=_textOn(bg); lbl=(d>=0?'+':'')+d.toFixed(0)+'%'; }
            else { const t=(w+1)/2; bg=_heatVal(t); fg=_textOn(bg); lbl=fmt(Math.round(metSample(m)*(0.7+0.5*t))); }
            return `<td><span class="gp-zc" style="background:${bg};color:${fg};width:auto;min-width:46px;padding:0 8px">${lbl}</span></td>`;
          }).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      default: return '';
    }
  }

  // ── Popovers ─────────────────────────────────────────────

  function openPop(html, trigger, kind) {
    popEl.innerHTML = html;
    popEl.dataset.kind = kind;
    popBk.classList.add('is-on');
    popEl.style.visibility = 'hidden';
    popEl.classList.add('is-open');
    const r = trigger.getBoundingClientRect();
    const pw = popEl.offsetWidth;
    let left = r.right - pw; if (left < 12) left = 12; if (left + pw > innerWidth - 12) left = innerWidth - pw - 12;
    let top  = r.bottom + 6; if (top + popEl.offsetHeight > innerHeight - 12) top = Math.max(70, r.top - popEl.offsetHeight - 6);
    popEl.style.left = left + 'px';
    popEl.style.top  = top  + 'px';
    popEl.style.visibility = '';
    trigger.classList.add('is-open');
    popOwner = trigger;
    bindPop(kind);
  }

  function closePop() {
    popEl.classList.remove('is-open');
    popBk.classList.remove('is-on');
    if (popOwner) popOwner.classList.remove('is-open');
    popOwner = null;
  }

  function togglePop(btn, kind) {
    if (popOwner === btn) { closePop(); return; }
    closePop(); openPop(popHTML(kind), btn, kind);
  }

  function popHTML(kind) {
    if (kind === 'range' || kind === 'compare') {
      const list = kind === 'range' ? RANGES : COMPARES;
      const cur  = kind === 'range' ? S.range : S.compare;
      const rows = list.map(c => `<button class="rb-opt ${cur===c.id?'is-on':''}" data-pick="${esc(c.id)}">
        <span class="ic"><i class="ti ${c.icon}"></i></span>
        <span class="tx"><span class="t">${esc(c.name)}</span><span class="d">${esc(c.d)}</span></span>
        <i class="ti ti-check ck"></i></button>`).join('');
      // "vs microciclo" reveals a reference-MC sub-list (the MC we diff against).
      let mcPicker = '';
      if (kind === 'compare' && S.compare === 'mc') {
        const curId = currentMcId();
        const mcRows = _mcList.length
          ? _mcList.map(m => {
              const isCur = String(m.id) === String(curId);
              const lbl = m.name || (m.start_date ? `MC ${String(m.start_date).slice(0,10)}` : m.id);
              return `<button class="rb-opt ${String(S.refMcId)===String(m.id)?'is-on':''} ${isCur?'is-disabled':''}" data-mc="${esc(m.id)}">
                <span class="ic"><i class="ti ti-calendar-week"></i></span>
                <span class="tx"><span class="t">${esc(lbl)}</span>${isCur?'<span class="d">microciclo actual</span>':''}</span>
                ${isCur?'<span class="tag no">actual</span>':'<i class="ti ti-check ck"></i>'}</button>`;
            }).join('')
          : `<div class="rb-note"><i class="ti ti-info-circle"></i>No hay microciclos cargados.</div>`;
        mcPicker = `<div class="rb-pop-h" style="margin-top:6px"><div class="t">Microciclo de referencia</div></div><div class="rb-pop-b">${mcRows}</div>`;
      }
      return `<div class="rb-pop-h"><div class="t">${kind==='range'?'Time range':'Comparison / baseline'}</div></div><div class="rb-pop-b">${rows}</div>${mcPicker}`;
    }
    if (kind === 'agg') {
      const field = S.metrics.find(m => m.id === popEl.dataset.field);
      if (!field) return '';
      const cat  = catalogMap.get(field.id);
      const peak = cat?.kind === 'peak';
      const rows = AGGS.map(a => {
        const dis = peak && !a.peakOk;
        return `<button class="rb-opt ${field.agg===a.id?'is-on':''} ${dis?'is-disabled':''}" data-agg="${esc(a.id)}">
          <span class="ic"><i class="ti ${a.icon}"></i></span>
          <span class="tx"><span class="t">${esc(a.name)}</span>${dis?'<span class="d">invalid for peak metric</span>':''}</span>
          ${dis?'<span class="tag no">N/A</span>':'<i class="ti ti-check ck"></i>'}
        </button>`;
      }).join('');
      const note = peak ? `<div class="rb-note"><i class="ti ti-info-circle"></i><b>${esc(cat.name)}</b> is a <b>peak</b> metric — only avg / max / min apply.</div>` : '';
      return `<div class="rb-pop-h"><div class="t">Aggregate ${cat?esc(cat.name):''}</div></div><div class="rb-pop-b">${rows}</div>${note}`;
    }
    return '';
  }

  function bindPop(kind) {
    popEl.querySelectorAll('[data-pick]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (kind === 'range') { S.range = b.dataset.pick; syncSelects(); pulseNext = true; renderCard(); closePop(); return; }
      S.compare = b.dataset.pick;
      if (S.compare === 'mc') {
        // Keep the popover open and reveal the reference-MC list (default = previous MC).
        if (!S.refMcId) S.refMcId = prevMcId();
        const owner = popOwner;
        syncSelects(); pulseNext = true; renderCard();
        openPop(popHTML('compare'), owner, 'compare');
        return;
      }
      syncSelects(); pulseNext = true; renderCard(); closePop();
    });
    popEl.querySelectorAll('[data-mc]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (b.classList.contains('is-disabled')) return;   // can't compare a MC against itself
      S.refMcId = b.dataset.mc;
      // Select → close ONLY the dropdown; the builder stays open and the label updates.
      syncSelects(); pulseNext = true; renderCard(); closePop();
    });
    popEl.querySelectorAll('[data-agg]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (b.classList.contains('is-disabled')) return;
      const f = S.metrics.find(m => m.id === popEl.dataset.field);
      if (f) f.agg = b.dataset.agg;
      renderMetrics(); pulseNext = true; renderCard(); closePop();
    });
  }

  // ── Fields flyout ─────────────────────────────────────────

  function openFly(trigger) {
    document.getElementById('gpbFlySearch').value = '';
    renderFlyBody('');
    flyBk.classList.add('is-on');
    flyEl.style.visibility = 'hidden';
    flyEl.classList.add('is-open');
    const r = trigger.getBoundingClientRect();
    const fw = flyEl.offsetWidth;
    let left = r.left - fw - 10; if (left < 12) left = 12;
    let top  = r.top; if (top + flyEl.offsetHeight > innerHeight - 12) top = Math.max(70, innerHeight - flyEl.offsetHeight - 12);
    flyEl.style.left = left + 'px';
    flyEl.style.top  = top  + 'px';
    flyEl.style.visibility = '';
    setTimeout(() => document.getElementById('gpbFlySearch').focus(), 50);
  }

  function closeFly() {
    flyEl.classList.remove('is-open');
    flyBk.classList.remove('is-on');
  }

  function renderFlyBody(q) {
    if (!S) return;
    const t    = VIZ_TYPES[S.type];
    const full = S.metrics.length >= t.max && t.max > 1;
    const dmax = t.dimMax || 0;
    // like measures: a single-slot dimension is replaceable (don't disable the others)
    const dimFull = S.dimensions && S.dimensions.length >= dmax && dmax > 1;
    let html = '', shown = 0;

    // ── DIMENSIONS section (only for vizzes that group by a dimension) ──
    if (dmax > 0) {
      const dims = DIMENSIONS.filter(d => !q || d.name.toLowerCase().includes(q) || d.id.includes(q));
      if (dims.length) {
        shown += dims.length;
        html += `<div class="es-fly-grp dim">Dimensiones</div>`;
        dims.forEach(d => {
          const on  = (S.dimensions || []).some(x => x.id === d.id);
          const dis = !on && dimFull;
          html += `<div class="es-fly-row dim-row ${on?'is-on':''} ${dis?'is-disabled':''}" data-did="${esc(d.id)}">
            <span class="ic"><i class="ti ${d.icon}"></i></span>
            <span class="nm">
              <span class="t">${esc(d.name)}</span>
              <span class="s">${esc(d.group)}</span>
            </span>
            <span class="kind dim">DIM</span>
          </div>`;
        });
      }
    }

    // ── MEASURES section (the gps_metric_definitions catalog) ──
    let measuresHtml = '';
    catalogGroups.forEach(grp => {
      const items = grp.items.filter(m => !q || m.name.toLowerCase().includes(q) || m.id.includes(q));
      if (!items.length) return;
      shown += items.length;
      measuresHtml += `<div class="es-fly-grp ${grp.custom?'cust':''}">${esc(grp.g)}</div>`;
      items.forEach(m => {
        const on  = S.metrics.some(f => f.id === m.id);
        const dis = !on && full;
        measuresHtml += `<div class="es-fly-row ${on?'is-on':''} ${dis?'is-disabled':''}" data-mid="${esc(m.id)}" draggable="true">
          <span class="ic"><i class="ti ${metIcon(m)}"></i></span>
          <span class="nm">
            <span class="t">${esc(m.name)}${m.is_custom?' <span style="font-size:9px;color:var(--cm-violet,#7C3AED)">EAV</span>':''}</span>
            <span class="s">${esc(m.unit)}</span>
          </span>
          <span class="kind ${m.kind}">${m.kind==='peak'?'PEAK':'ACC'}</span>
        </div>`;
      });
    });
    if (measuresHtml) html += `<div class="es-fly-grp meas">Medidas</div>` + measuresHtml;

    const body = document.getElementById('gpbFlyBody');
    body.innerHTML = shown ? html : `<div style="padding:22px;text-align:center;color:var(--cm-fg-muted);font:500 12px/1.5 var(--cm-font-sans)">No fields match "${esc(q)}"</div>`;

    // dimension rows → toggle dimension (click only, no drag)
    body.querySelectorAll('[data-did]').forEach(row => {
      row.onclick = () => {
        if (row.classList.contains('is-disabled')) return;
        addDimension(row.dataset.did);
        renderFlyBody(document.getElementById('gpbFlySearch').value.trim().toLowerCase());
        if (dmax === 1) closeFly();
      };
    });

    body.querySelectorAll('[data-mid]').forEach(row => {
      row.onclick = () => {
        if (row.classList.contains('is-disabled')) return;
        addMetric(row.dataset.mid);
        renderFlyBody(document.getElementById('gpbFlySearch').value.trim().toLowerCase());
        if (VIZ_TYPES[S.type].max === 1) closeFly();
      };
      row.addEventListener('dragstart', e => {
        if (row.classList.contains('is-disabled')) { e.preventDefault(); return; }
        dragMetricId = row.dataset.mid;
        row.classList.add('is-dragging');
        flyBk.style.pointerEvents = 'none';
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', row.dataset.mid);
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        dragMetricId = null;
        flyBk.style.pointerEvents = '';
        document.getElementById('gpbMetZone')?.classList.remove('drag-over');
      });
    });
  }

  // ── Config JSON drawer ─────────────────────────────────────

  function openCfg() {
    if (!S) return;
    document.getElementById('gpbCfgJson').innerHTML = hlJSON(buildConfig(S));
    cfgBk.classList.add('is-on');
    cfgDrawer.classList.add('is-on');
  }

  function closeCfg() {
    cfgBk.classList.remove('is-on');
    cfgDrawer.classList.remove('is-on');
  }

  // ── Toast ──────────────────────────────────────────────────

  function showToast(title, sub, label) {
    document.getElementById('gpbToastTitle').textContent = title;
    document.getElementById('gpbToastSub').textContent   = sub;
    document.getElementById('gpbToastAct').textContent   = label || 'Done';
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 4800);
  }

  // ── Entry point ────────────────────────────────────────────

  async function init() {
    if (_initStarted) return;
    _initStarted = true;
    if (!window.sb) { _initStarted = false; setTimeout(init, 500); return; }
    try {
      const clubId = await waitForClubId();
      if (!clubId) return;

      const enabled = await checkFlag(clubId);
      if (!enabled) return;

      _clubId = clubId;
      _userId = window._gpUserId || null;

      await loadCatalog(clubId);
      loadMicrocycles(clubId);   // non-blocking: only needed when the compare popover opens

      injectDOM();
      wireDOMRefs();
      wireEvents();
      buildStaticPanel();
      addBuilderButton();
    } catch (e) {
      console.warn('[gp-builder] init failed:', e);
    }
  }

  /** Loads the club's microcycles (newest first) for the "vs microciclo" reference picker. */
  async function loadMicrocycles(clubId) {
    try {
      const { data } = await window.sb.from('microcycles')
        .select('id,name,start_date')
        .eq('club_id', clubId)
        .order('start_date', { ascending: false });
      _mcList = data || [];
    } catch (e) { console.warn('[gp-builder] loadMicrocycles:', e); _mcList = []; }
  }

  function wireEvents() {
    // cancel build on view switch
    document.getElementById('sections')?.addEventListener('click', e => {
      if (e.target.closest('.gp-sec') && S) cancelBuild();
    });
  }

  document.addEventListener('DOMContentLoaded', () => { init(); });
  // Also try immediately in case DOM is already loaded
  if (document.readyState !== 'loading') init();

  // ══════════════════════════════════════════════════════════════════════
  //  CHART BUILDER · MODO DRAG & DROP (dentro del builder — Prompt 1, solo UI)
  //  Forma alternativa de armar el MISMO gráfico, vía un toggle Clásico/D&D
  //  dentro del drawer. Ambos modos editan el MISMO state S → la misma config
  //  gp.card/v1, y comparten el preview (la draft card del grid). El clásico
  //  es el default. Por ahora el D&D es visual: refleja S (campos colocados +
  //  chips en las zonas) pero todavía NO arrastra ni muta S (eso es Prompt 2).
  // ══════════════════════════════════════════════════════════════════════

  // Etiquetas de eje por tipo (sólo las que muestra el toolbar D&D, como la
  // maqueta). Para tipos fuera de estos 3 se usan las de barras por defecto.
  const DD_TYPES = {
    bars:  { name:'Barras', icon:'ti-chart-bar',  dimAx:'eje X · categorías',    metAx:'eje Y · valores' },
    line:  { name:'Línea',  icon:'ti-chart-line', dimAx:'eje X · tiempo / dim.', metAx:'series · valores' },
    table: { name:'Tabla',  icon:'ti-table',      dimAx:'filas',                 metAx:'columnas' },
  };
  let _bMode   = 'classic';  // modo de construcción del builder: 'classic' | 'dd'
  let _ddQuery = '';         // texto del buscador del panel de campos

  function _ddAxes()    { return DD_TYPES[S && S.type] || DD_TYPES.bars; }
  function _dimPlaced(id){ return !!(S && (S.dimensions || []).some(d => d.id === id)); }
  function _metPlaced(id){ return !!(S && (S.metrics    || []).some(m => m.id === id)); }

  // Fila arrastrable del panel. Las ya colocadas (is-placed) no se arrastran.
  function ddFieldRow(id, kind, name, icon, unit, placed) {
    return `<div class="bdd-field${placed ? ' is-placed' : ''}" draggable="${placed ? 'false' : 'true'}" data-id="${esc(id)}" data-kind="${kind}">
      <span class="grip"><i class="ti ti-grip-vertical"></i></span>
      <span class="ic"><i class="ti ${esc(icon)}"></i></span>
      <span class="nm">${esc(name)}</span>${unit ? `<span class="u">${esc(unit)}</span>` : ''}
    </div>`;
  }

  // Panel poblado con el catálogo REAL del builder: DIMENSIONS + catalogMap.
  function ddPanelHTML() {
    const mets  = [...catalogMap.values()];
    const total = DIMENSIONS.length + mets.length;
    const q = _ddQuery.trim().toLowerCase();
    const hit = (id, name) => !q || name.toLowerCase().includes(q) || id.toLowerCase().includes(q);
    const dimRows = DIMENSIONS.filter(d => hit(d.id, d.name)).map(d => ddFieldRow(d.id, 'dim', d.name, d.icon, '', _dimPlaced(d.id)));
    const metRows = mets.filter(m => hit(m.id, m.name)).map(m => ddFieldRow(m.id, 'metric', m.name, metIcon(m), m.unit, _metPlaced(m.id)));
    const none = '<div class="bdd-grp-h"><span class="hint">sin coincidencias</span></div>';
    return `
      <div class="bdd-col-h"><i class="ti ti-list-details"></i><span class="t">Campos</span><span class="ct">${total}</span></div>
      <div class="bdd-search"><i class="ti ti-search"></i><input id="gpbDDSearch" type="text" placeholder="Buscar campo…" value="${esc(_ddQuery)}"></div>
      <div class="bdd-fields" id="gpbDDFields">
        <div class="bdd-grp-h"><span class="k">Dimensiones</span><span class="ln"></span><span class="hint">cómo se agrupan</span></div>
        ${dimRows.join('') || none}
        <div class="bdd-grp-h"><span class="k">Métricas</span><span class="ln"></span><span class="hint">qué se mide</span></div>
        ${metRows.join('') || none}
      </div>`;
  }

  // Chips colocados (reflejan S). Arrastrables para reordenar dentro de la zona.
  function ddDimChip(id) {
    const d = DIM_MAP.get(id) || { name: id, icon: 'ti-category-2' };
    return `<div class="bdd-chip" data-kind="dim" data-id="${esc(id)}" draggable="true">
      <span class="grip"><i class="ti ti-grip-vertical"></i></span>
      <span class="ic"><i class="ti ${esc(d.icon || 'ti-category-2')}"></i></span>
      <span class="nm">${esc(d.name)}</span>
      <button class="x" data-rmdim="${esc(id)}" aria-label="Quitar"><i class="ti ti-x"></i></button>
    </div>`;
  }
  function ddMetChip(m) {
    const cat  = catalogMap.get(m.id) || { name: m.id, unit: '', group_name: 'custom' };
    const opts = AGGS.map(a => `<option value="${a.id}" ${a.id === m.agg ? 'selected' : ''}>${a.short}</option>`).join('');
    return `<div class="bdd-chip" data-kind="metric" data-id="${esc(m.id)}" draggable="true">
      <span class="grip"><i class="ti ti-grip-vertical"></i></span>
      <span class="ic"><i class="ti ${esc(metIcon(cat))}"></i></span>
      <span class="nm">${esc(cat.name)}</span>
      <span class="bdd-agg"><select data-agg-for="${esc(m.id)}">${opts}</select><i class="ti ti-selector car"></i></span>
      <button class="x" data-rm="${esc(m.id)}" aria-label="Quitar"><i class="ti ti-x"></i></button>
    </div>`;
  }

  function ddZoneHTML(accept) {
    const ax    = _ddAxes();
    const isDim = accept === 'dim';
    const items = isDim ? (S ? S.dimensions || [] : []) : (S ? S.metrics || [] : []);
    const title = isDim ? 'Dimensiones' : 'Métricas';
    const axLbl = isDim ? ax.dimAx : ax.metAx;
    const badge = isDim ? 'ti-category-2' : 'ti-ruler-measure';
    const what  = isDim ? 'dimensiones' : 'métricas';
    const body  = items.length
      ? (isDim ? items.map(d => ddDimChip(d.id)).join('') : items.map(m => ddMetChip(m)).join(''))
      : `<div class="bdd-empty"><i class="ti ti-arrow-down-to-arc"></i><span class="m">arrastrá ${what} aquí</span></div>`;
    return `<div class="bdd-zone" data-accept="${accept}">
      <div class="bdd-zone-h"><span class="badge"><i class="ti ${badge}"></i></span><span class="t">${title}</span><span class="ax">${axLbl}</span><span class="ct">${items.length}</span></div>
      <div class="bdd-drop" data-accept="${accept}">${body}</div>
    </div>`;
  }
  function ddZonesHTML() { return `<div class="bdd-zones">${ddZoneHTML('dim')}${ddZoneHTML('metric')}</div>`; }

  // Toolbar: segmented de tipo (refleja S.type; cosmético por ahora) + badge.
  function ddToolbarHTML() {
    const cur = S && S.type;
    return `<div class="bdd-bar">
      <span class="lbl">Tipo</span>
      <div class="bdd-seg" id="gpbDDSeg">${Object.keys(DD_TYPES).map(k =>
        `<button data-type="${k}" class="${k === cur ? 'is-on' : ''}"><i class="ti ${DD_TYPES[k].icon}"></i>${DD_TYPES[k].name}</button>`).join('')}</div>
      <span class="spacer"></span>
      <span class="bdd-cfg"><i class="ti ti-code"></i>config&nbsp;<b>gp.card/v1</b>&nbsp;· misma salida</span>
    </div>`;
  }

  // Render del pane D&D dentro del drawer (stack vertical: toolbar + panel + zonas).
  // El preview es la draft card del grid (compartida con el clásico).
  function renderDDPane() {
    const host = document.getElementById('gpbDDPane');
    if (!host) return;
    host.innerHTML = ddToolbarHTML() +
      `<div class="bdd-dock">
        <div class="bdd-col bdd-panel" id="gpbDDPanel">${ddPanelHTML()}</div>
        ${ddZonesHTML()}
      </div>`;
  }
  function renderDDPanelOnly() {
    const p = document.getElementById('gpbDDPanel');
    if (p) p.innerHTML = ddPanelHTML();
  }

  // ── D&D · mutaciones sobre el MISMO S + sync (sin renderizar el gráfico) ──
  let _ddDrag = null;   // { id, kind, from:'panel'|'zone' } durante un arrastre

  // Refleja S tras un cambio por D&D. Usa EL MISMO camino que el builder clásico
  // (syncAll → renderCard → S→buildConfig(S)→resolveAndRenderCard): la card del
  // dashboard se re-renderiza EN VIVO con datos reales del resolver, idéntico a
  // armar con dropdowns. renderDDPane() repinta además las zonas/panel del D&D.
  function ddSyncFromS() {
    if (!S) return;
    syncAll();
    renderDDPane();
  }

  // Cambio de tipo (segmented D&D): misma mutación que el setType clásico
  // (clamps de métricas/dimensiones según VIZ_TYPES) pero sin renderizar el gráfico.
  function ddSetType(id) {
    if (!S || !VIZ_TYPES[id]) return;
    S.type = id;
    const t = VIZ_TYPES[id];
    if (S.metrics.length > t.max) S.metrics = S.metrics.slice(0, t.max);
    S.metrics.forEach(m => { const cat = catalogMap.get(m.id); if (cat?.kind === 'peak' && !AGG[m.agg]?.peakOk) m.agg = 'avg'; });
    if (!S.dimensions) S.dimensions = [];
    if (S.dimensions.length > (t.dimMax || 0)) S.dimensions = S.dimensions.slice(0, t.dimMax || 0);
    ddSyncFromS();
  }

  // Agrega un campo a S respetando las restricciones reales del tipo (VIZ_TYPES).
  // Default de agg = defaultAgg(kind), idéntico al builder clásico → mismo S.
  function ddAddField(kind, id, atIndex) {
    if (!S) return;
    const t = VIZ_TYPES[S.type];
    if (kind === 'dim') {
      if (!DIM_MAP.has(id)) return;
      if (!S.dimensions) S.dimensions = [];
      if (S.dimensions.some(d => d.id === id)) return;
      const dmax = t.dimMax || 0;
      if (dmax === 0) return;                               // este tipo no toma dimensiones
      if (dmax === 1) { S.dimensions = [{ id }]; return; }  // una sola → reemplaza
      if (S.dimensions.length >= dmax) return;
      const i = atIndex == null ? S.dimensions.length : Math.max(0, Math.min(atIndex, S.dimensions.length));
      S.dimensions.splice(i, 0, { id });
    } else {
      const cat = catalogMap.get(id);
      if (!cat) return;
      if (S.metrics.some(m => m.id === id)) return;
      const agg = defaultAgg(cat.kind || 'accum');
      if (t.max === 1) { S.metrics = [{ id, agg }]; return; }  // métrica única → reemplaza
      if (S.metrics.length >= t.max) return;
      const i = atIndex == null ? S.metrics.length : Math.max(0, Math.min(atIndex, S.metrics.length));
      S.metrics.splice(i, 0, { id, agg });
    }
  }

  // Reordena un chip ya colocado dentro de su array de S.
  function ddMoveWithin(kind, id, atIndex) {
    const arr = kind === 'dim' ? S.dimensions : S.metrics;
    if (!arr) return;
    const cur = arr.findIndex(x => x.id === id);
    if (cur < 0) return;
    const [it] = arr.splice(cur, 1);
    let idx = atIndex == null ? arr.length : atIndex;
    if (cur < idx) idx -= 1;                                 // compensa el splice previo
    idx = Math.max(0, Math.min(idx, arr.length));
    arr.splice(idx, 0, it);
  }

  function _ddClearFx() {
    const host = document.getElementById('gpbDDPane');
    if (!host) return;
    host.querySelectorAll('.bdd-zone').forEach(z => z.classList.remove('is-over', 'is-bad'));
    host.querySelectorAll('.bdd-ins').forEach(i => i.remove());
  }
  // Índice de inserción según la Y del cursor entre los chips de una zona.
  function _ddInsertIndex(dropEl, y) {
    const chips = [...dropEl.querySelectorAll('.bdd-chip')];
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return chips.length;
  }

  // Cambia el modo de construcción. Ambos modos editan el MISMO S → al volver
  // a clásico, syncAll() repinta los controles desde S; al entrar a D&D,
  // renderDDPane() refleja S. Nada se pierde porque el state es el mismo.
  function setBuilderMode(m) {
    if (!panelEl) return;
    _bMode = m;
    panelEl.classList.toggle('is-ddmode', m === 'dd');
    panelEl.querySelectorAll('#gpbMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === m));
    if (m === 'dd') {
      panelEl.querySelectorAll('.es-p-b > .pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === 'dd'));
      renderDDPane();
    } else {
      const tab = panelEl.querySelector('.es-tabs button.is-on')?.dataset.tab || 'setup';
      panelEl.querySelectorAll('.es-p-b > .pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === tab));
      if (S) syncAll();
    }
  }

  // ── Public API (used by gp-ai.js) ─────────────────────────────────────

  /**
   * Opens the builder panel pre-seeded with a gp.card/v1 config.
   * Called by the AI generator after it produces a valid config.
   * The user reviews and tweaks before clicking "Add card".
   *
   * @param {object} config  gp.card/v1 object
   */
  window.openBuilderWithConfig = function (config) {
    if (!config || config.schema !== 'gp.card/v1') return;

    // Ensure builder has been initialised
    if (!panelEl) {
      // builder not yet inited — store config and retry after init
      const orig = init;
      init = async function () {
        await orig();
        window.openBuilderWithConfig(config);
        init = orig;
      };
      return;
    }

    if (S) cancelBuild();
    startBuild();
    if (!S) return;

    // Map gp.card/v1 → internal state S
    S.type    = config.viz                        || 'bars';
    S.scope   = config.scope?.level               || 'player';
    S.range   = config.range?.type                || 'mc';
    S.compare = config.comparison?.baseline       || 'none';
    S.refMcId = config.comparison?.refMcId        || null;
    S.size    = config.style?.size                || 'md';
    S.color   = config.style?.color               || '#15803D';
    S.palette = config.style?.palette             || 'pitch';
    S.axes    = config.style?.axes    !== false;
    S.legend  = config.style?.legend  !== false;
    S.labels  = !!config.style?.dataLabels;
    S.points  = config.style?.points  !== false;
    S.area    = !!config.style?.area;
    S.horizontal = config.style?.orientation === 'horizontal';
    S.stacked    = !!config.style?.stacked;
    S.sort    = config.sort || null;
    S.title   = config.title || '';
    S.metrics = (config.metrics || []).map(m => ({ id: m.id, agg: m.agg, ...(m.format ? { format: m.format } : {}), ...(m.line ? { line: true } : {}) }));

    // keep only metrics that exist in catalog; fix invalid peak aggs
    S.metrics = S.metrics.filter(m => catalogMap.has(m.id)).map(m => {
      const cat = catalogMap.get(m.id);
      if (cat?.kind === 'peak' && !AGG[m.agg]?.peakOk) m.agg = 'avg';
      return m;
    });

    document.getElementById('gpbTitle').value = S.title;
    pulseNext = true;
    syncAll();
  };

  /**
   * Namespace exposed for gp-ai.js (fallback heuristic needs VIZ_TYPES + catalog).
   */
  window.GpBuilder = {
    get catalogMap() { return catalogMap; },
    get VIZ_TYPES()  { return VIZ_TYPES;  },
    get AGG()        { return AGG;        },
    defaultAgg,
    resolveAndRenderCard,
    rerenderActiveCards,   // filter bar (Parte B) re-renders the active dashboard
    radarChartData,   // exposed for tests
    mountRadarChart,  // exposed for tests
    barsChartData,    // exposed for tests
    mountBarsChart,   // exposed for tests
    lineChartData,    // exposed for tests
    mountLineChart,   // exposed for tests
    scatterChartData, // exposed for tests
    mountScatterChart,// exposed for tests
    kpiCardData,      // exposed for tests
    rankingCardData,  // exposed for tests
    currentConfig: () => (S ? buildConfig(S) : null),  // exposed for tests
    openForEdit: function (cardEl) { openBuilderForEdit(cardEl); },
    startNew: function () { startBuild(); },   // blank canvas — "Crear a medida" del panel Agregar gráfico
  };

  // Shared render engine for OTHER dashboards (e.g. Match Performance pilot). Draw-only:
  //   GpRender.renderCard(container, config /* gp.card/v1 */, series, opts?)
  // `series` must already be prepared (this never queries Supabase).
  window.GpRender = window.GpRender || { renderCard: _renderCardInto };

})();
