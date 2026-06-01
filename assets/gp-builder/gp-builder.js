/* =============================================================
   GPS Builder — Fase 1
   Initialises only when club_gps_settings.gps_builder_enabled = true.
   All DOM is injected at runtime; GPS Analysis.html is unchanged
   beyond the <link>/<script> tags.

   Rollback: set gps_builder_enabled = false → the whole module
   is a no-op, existing cards are untouched.
   ============================================================= */
(function () {
  'use strict';

  // ── Domain constants (mirrors lib/gp-card/) ────────────────

  const VIZ_TYPES = {
    kpi:     { name: 'KPI',     icon: 'ti-number-123',   min: 1, max: 1  },
    bars:    { name: 'Bars',    icon: 'ti-chart-bar',    min: 1, max: 2  },
    line:    { name: 'Line',    icon: 'ti-chart-line',   min: 1, max: 6  },
    scatter: { name: 'Scatter', icon: 'ti-chart-dots',   min: 2, max: 2  },
    radar:   { name: 'Radar',   icon: 'ti-chart-radar',  min: 3, max: 8  },
    ranking: { name: 'Ranking', icon: 'ti-list-numbers', min: 1, max: 1  },
    table:   { name: 'Table',   icon: 'ti-table',        min: 1, max: 12 },
    heatmap: { name: 'Heatmap', icon: 'ti-layout-grid',  min: 1, max: 12 },
  };
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
    { id:'md',    name:'vs same MD code',  icon:'ti-calendar-event', d:'Matchday-minus code' },
    { id:'none',  name:'No comparison',   icon:'ti-circle-off',     d:'Raw values only' },
  ];

  // Icon/sample value by category (for mock rendering)
  const CAT_ICON = {
    distance:'ti-route', speed:'ti-brand-speedtest', acceleration:'ti-trending-up',
    load:'ti-battery-3', time:'ti-clock', count:'ti-hash', custom:'ti-puzzle',
  };
  const CAT_SAMPLE = {
    distance:1000, speed:28.5, acceleration:4.2, load:1200, time:85, count:45, custom:10,
  };

  // ── Runtime state ──────────────────────────────────────────

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
        return { id:m.id, agg:m.agg, kind:cat.kind||'accum', unit:cat.unit||'', custom:!!cat.is_custom };
      }),
      range:      { type: S.range },
      comparison: S.compare === 'none' ? null : { baseline: S.compare },
      style: { size:S.size, color:S.color, palette:S.palette, axes:S.axes, legend:S.legend, dataLabels:S.labels },
    };
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
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--cm-border);background:var(--cm-bg-soft);flex-shrink:0">
          <button class="cm-btn is-ghost is-sm" id="gpbConfigBtn"><i class="ti ti-braces" style="font-size:13px"></i>Config</button>
          <div style="flex:1"></div>
          <button class="cm-btn is-outline is-sm" id="gpbCancel">Cancel</button>
          <button class="cm-btn is-primary is-sm" id="gpbSave" disabled>Add card</button>
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
    return { type:'bars', metrics:[], scope:'player', compare:'role', range:'mc',
             size:'md', color:'#15803D', palette:'pitch', title:'', axes:true, legend:true, labels:false };
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
        if (sz) { S.size = sz; draftCard.dataset.size = sz; syncStyle(); }
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
    draftCard?.remove();
    draftCard = null;
    S = null;
    closePanel();
    document.querySelector('.gp-view.is-on .gp-grid')?.classList.remove('is-building');
  }

  function saveCard() {
    if (!S || !draftCard) return;
    const t = VIZ_TYPES[S.type];
    if (S.metrics.length < t.min) return;

    draftCard.__cfg = JSON.parse(JSON.stringify(S));
    draftCard.dataset.card = 'chart';
    draftCard.classList.remove('is-draft', 'is-editing');
    draftCard.dataset.size = S.size;
    draftCard.style.setProperty('--cm-accent', S.color);

    // final render (no pulse animation)
    const body = draftCard.querySelector('#gpbDraftBody') || draftCard.querySelector('.gp-c-b');
    if (body) {
      body.id = '';
      body.className = bodyClass(S.type);
      body.innerHTML = renderType(S);
    }
    updateDraftHeader();
    syncSizeToggle();
    const grid = draftCard.closest('.gp-grid');
    if (grid) grid.classList.remove('is-building');

    draftCard = null;
    S = null;
    closePanel();
    showToast('Chart added', 'Drag to reorder · click edit to tweak.', 'Done');
  }

  // ── Panel open / close ─────────────────────────────────────

  function openPanel() {
    panelEl.removeAttribute('hidden');
    panelEl.classList.add('is-open');
    document.body.classList.add('gpb-open');
    document.getElementById('gpbTitle').value = S.title || '';
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

    // tabs
    panelEl.querySelectorAll('.es-tabs button').forEach(btn => {
      btn.onclick = () => {
        panelEl.querySelectorAll('.es-tabs button').forEach(o => o.classList.toggle('is-on', o===btn));
        panelEl.querySelectorAll('.es-p-b .pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === btn.dataset.tab));
      };
    });

    // scope
    document.getElementById('gpbScope').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        if (!S) return;
        document.getElementById('gpbScope').querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o===b));
        S.scope = b.dataset.scope;
        document.getElementById('gpbDimName').textContent = S.scope === 'squad' ? 'Squad' : 'Player';
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

  // ── Sync functions ────────────────────────────────────────

  function syncAll() { syncTypes(); renderMetrics(); syncSelects(); syncStyle(); syncHeader(); syncSizeToggle(); renderCard(); }

  function syncTypes() {
    if (!S) return;
    document.getElementById('gpbTypes').querySelectorAll('[data-type]').forEach(b =>
      b.classList.toggle('is-on', b.dataset.type === S.type)
    );
    document.getElementById('gpbMetHint').textContent = VIZ_REQ_LBL[S.type];
    document.getElementById('gpbDimName').textContent = S.scope === 'squad' ? 'Squad' : 'Player';
    document.getElementById('gpbScope').querySelectorAll('button').forEach(b =>
      b.classList.toggle('is-on', b.dataset.scope === S.scope)
    );
  }

  function syncSelects() {
    if (!S) return;
    document.getElementById('gpbRangeName').textContent   = RANGES.find(r=>r.id===S.range)?.name  || S.range;
    document.getElementById('gpbCompareName').textContent = COMPARES.find(c=>c.id===S.compare)?.name || S.compare;
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

  function renderMetrics() {
    if (!S) return;
    const wrap = document.getElementById('gpbMetrics');
    wrap.innerHTML = S.metrics.map((m, i) => {
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
          <button class="es-aggchip" data-agg-for="${esc(m.id)}">
            <i class="ti ${agg.icon}"></i>${agg.short}<i class="ti ti-chevron-down" style="font-size:11px"></i>
          </button>
          <button class="frm" data-rm="${esc(m.id)}"><i class="ti ti-x"></i></button>
        </div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => addMetric(b.dataset.rm));
    wrap.querySelectorAll('[data-agg-for]').forEach(b => {
      b.onclick = () => {
        popEl.dataset.field = b.dataset.aggFor;
        if (popOwner === b) { closePop(); return; }
        closePop();
        openPop(popHTML('agg'), b, 'agg');
      };
    });

    // reorder by drag
    wrap.querySelectorAll('.es-field').forEach((el, i) => {
      el.addEventListener('dragstart', e => { e.stopPropagation(); reorderFrom = i; el.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
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
    const t = VIZ_TYPES[S.type];
    draftCard.dataset.size = S.size;
    draftCard.style.setProperty('--cm-accent', S.color);
    updateDraftHeader();
    syncHeader();

    const valid = S.metrics.length >= t.min;
    document.getElementById('gpbSave').disabled = !valid;

    const body = document.getElementById('gpbDraftBody') || draftCard.querySelector('.gp-c-b');
    if (!body) return;

    const nd = noDataReason(S);
    if (!valid) { showState(body, 'await'); return; }
    if (nd)     { showState(body, 'nodata', nd); return; }
    if (pulseNext) { pulseNext = false; showState(body, 'load'); setTimeout(renderCard, 460); return; }

    draftCard.classList.remove('is-draft');
    body.className = bodyClass(S.type);
    body.innerHTML = renderType(S);
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

  // ── Mock chart rendering (Phase 1 — sample data) ──────────

  function renderType(S) {
    const type = S.type;
    const ms = S.metrics.map(m => catalogMap.get(m.id)).filter(Boolean);
    const color = S.color || '#15803D';
    const axes = S.axes !== false, legend = S.legend !== false, labels = !!S.labels;
    const rangeName = RANGES.find(r=>r.id===S.range)?.name || S.range;
    const cmp = S.compare === 'none' ? '' : (COMPARES.find(c=>c.id===S.compare)?.name || '');
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
        const rows = [['R. Vega · #7',96],['T. López · #4',82],['I. Barreiro · #18',74],['S. Rivas · #6',61],['M. Paredes · #8',47]];
        return `<div class="gp-rank">${rows.map((r,i)=>`<div class="gp-rank-row"><span class="ax">${i+1}</span><span class="gp-rank-bar"><span class="gp-rank-fill ${i<1?'':i<3?'med':'low'}" style="width:${r[1]}%">${esc(r[0])}</span></span><span style="text-align:right;font:600 12px/1 var(--cm-font-mono);color:var(--cm-fg)">${labels?fmt(Math.round(s0*r[1]/100)):''}</span></div>`).join('')}</div>`;
      }
      case 'bars': {
        const hs = [58,72,90,46,80,64,98];
        const m1 = ms[1];
        return `<div class="gp-bars">${hs.map((h,i)=>`<div class="gr"><div class="stack">${m1?`<div class="b prev" style="height:${h-12}%"></div>`:''}<div class="b curr" style="height:${h}%"></div></div>${axes?`<span class="lbl">${['Vega','López','Barr','Rivas','Pdes','Sosa','Mtz'][i]}</span>`:''}</div>`).join('')}</div>
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
        const players = ['R. Vega','T. López','I. Barreiro','S. Rivas','M. Paredes'];
        return `<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">Player</th>${cols.map(m=>`<th>${esc(m.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${players.map((p,r)=>`<tr><td class="pc" style="padding:8px 14px;font:500 12px/1 var(--cm-font-sans)">${esc(p)}</td>${cols.map((m,c)=>`<td>${fmt(Math.round(metSample(m)*(0.8+.08*((r+c)%4))))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      case 'heatmap': {
        const cols = ms.slice(0,6);
        const players = ['R. Vega','T. López','I. Barreiro','S. Rivas','M. Paredes'];
        const cls = ['vlow','mlow','low','neu','warn','mhigh','high'];
        return `<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">Player</th>${cols.map(m=>`<th>${esc(m.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${players.map((p,r)=>`<tr><td class="pc" style="padding:6px 14px;font:500 12px/1 var(--cm-font-sans)">${esc(p)}</td>${cols.map((m,c)=>{const z=(Math.sin(r*1.6+c*.9)*2);const ci=Math.max(0,Math.min(6,Math.round(z+3)));return `<td><span class="gp-zc ${cls[ci]}">${labels?(z>=0?'+':'')+z.toFixed(1):''}</span></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
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
      return `<div class="rb-pop-h"><div class="t">${kind==='range'?'Time range':'Comparison / baseline'}</div></div><div class="rb-pop-b">${rows}</div>`;
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
    popEl.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      if (kind === 'range') S.range = b.dataset.pick;
      else S.compare = b.dataset.pick;
      syncSelects(); pulseNext = true; renderCard(); closePop();
    });
    popEl.querySelectorAll('[data-agg]').forEach(b => b.onclick = () => {
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
    let html = '', shown = 0;
    catalogGroups.forEach(grp => {
      const items = grp.items.filter(m => !q || m.name.toLowerCase().includes(q) || m.id.includes(q));
      if (!items.length) return;
      shown += items.length;
      html += `<div class="es-fly-grp ${grp.custom?'cust':''}">${esc(grp.g)}</div>`;
      items.forEach(m => {
        const on  = S.metrics.some(f => f.id === m.id);
        const dis = !on && full;
        html += `<div class="es-fly-row ${on?'is-on':''} ${dis?'is-disabled':''}" data-mid="${esc(m.id)}" draggable="true">
          <span class="ic"><i class="ti ${metIcon(m)}"></i></span>
          <span class="nm">
            <span class="t">${esc(m.name)}${m.is_custom?' <span style="font-size:9px;color:var(--cm-violet,#7C3AED)">EAV</span>':''}</span>
            <span class="s">${esc(m.unit)}</span>
          </span>
          <span class="kind ${m.kind}">${m.kind==='peak'?'PEAK':'ACC'}</span>
        </div>`;
      });
    });
    const body = document.getElementById('gpbFlyBody');
    body.innerHTML = shown ? html : `<div style="padding:22px;text-align:center;color:var(--cm-fg-muted);font:500 12px/1.5 var(--cm-font-sans)">No fields match "${esc(q)}"</div>`;
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
    if (!window.sb) { setTimeout(init, 500); return; }
    try {
      const clubId = await waitForClubId();
      if (!clubId) return;

      const enabled = await checkFlag(clubId);
      if (!enabled) return;

      await loadCatalog(clubId);

      injectDOM();
      wireDOMRefs();
      wireEvents();
      buildStaticPanel();
      addBuilderButton();
    } catch (e) {
      console.warn('[gp-builder] init failed:', e);
    }
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

})();
