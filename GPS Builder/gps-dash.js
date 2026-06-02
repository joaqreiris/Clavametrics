/* =============================================================
   GPS Analysis dashboard — builder integration logic
   Edit layout (reorder/delete) · Add card → Build chart →
   live draft → Save inserts a real card. Uses window.GP.
   ============================================================= */
const GP = window.GP;

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('grid');
  const panel = document.getElementById('esPanel');
  const tools = document.getElementById('gaTools');
  const addSlot = document.getElementById('addSlot');
  const emptyState = document.getElementById('emptyState');

  /* draft template (captured, then removed from DOM) */
  const draftTpl = document.getElementById('draftCard').outerHTML.replace(' hidden=""','').replace(' hidden','');
  document.getElementById('draftCard').remove();

  /* current builder state + the card being edited */
  let S = null;          // builder config (null when not editing)
  let card = null;       // DOM node being built/edited
  let pulseNext = false;
  let layoutMode = false;
  let chartSeq = 0;
  let lastDeleted = null;
  let dragMetricId = null;   // dragging a catalog field
  let reorderFrom = null;    // dragging a metric chip to reorder

  /* ---------------- LAYOUT MODE ---------------- */
  function setLayout(on) {
    layoutMode = on;
    grid.classList.toggle('is-layout', on);
    tools.classList.toggle('is-edit', on);
    document.getElementById('btnEditLayout').classList.toggle('is-on', on);
    addSlot.hidden = !on;
    grid.querySelectorAll('.gp-c').forEach(c => c.setAttribute('draggable', on ? 'true' : 'false'));
    if (!on && S) cancelBuild();
  }
  document.getElementById('btnEditLayout').onclick = () => setLayout(!layoutMode);
  document.getElementById('btnSaveLayout').onclick = () => { setLayout(false); toast('Layout saved', 'Your dashboard arrangement is stored for this view.', 'OK'); };

  /* ---------------- ENTRY MENU ---------------- */
  const overlay = document.getElementById('acOverlay'), menu = document.getElementById('acMenu'), anchor = document.getElementById('acAnchor');
  const openEntry = () => { overlay.classList.add('is-open'); menu.classList.add('is-open'); anchor.classList.add('is-open'); };
  const closeEntry = () => { overlay.classList.remove('is-open'); menu.classList.remove('is-open'); anchor.classList.remove('is-open'); };
  overlay.addEventListener('click', closeEntry);
  document.getElementById('btnAddCard').onclick = openEntry;
  addSlot.onclick = openEntry;
  document.getElementById('acBuild').onclick = () => { closeEntry(); if (!layoutMode) setLayout(true); startBuild(); };

  /* ---------------- AI GENERATOR (prompt → CONFIG → editor) ---------------- */
  const aiBk = document.getElementById('aiBk'), aiModal = document.getElementById('aiModal');
  function openAi() {
    document.getElementById('aiPrompt').value = '';
    document.getElementById('aiBody').classList.remove('is-thinking');
    document.getElementById('aiFoot').classList.remove('is-thinking');
    document.getElementById('aiThink').classList.remove('is-on');
    aiBk.classList.add('is-on'); aiModal.classList.add('is-on');
    setTimeout(() => document.getElementById('aiPrompt').focus(), 80);
  }
  function closeAi() { aiBk.classList.remove('is-on'); aiModal.classList.remove('is-on'); }
  document.getElementById('acAI').onclick = () => { closeEntry(); openAi(); };
  document.getElementById('aiClose').onclick = closeAi;
  document.getElementById('aiCancel').onclick = closeAi;
  aiBk.addEventListener('click', closeAi);
  document.getElementById('aiChips').querySelectorAll('.ai-chip').forEach(c => c.onclick = () => {
    document.getElementById('aiPrompt').value = c.textContent.trim(); document.getElementById('aiPrompt').focus();
  });
  document.getElementById('aiPrompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); document.getElementById('aiGen').click(); } });
  document.getElementById('aiGen').onclick = () => {
    const text = document.getElementById('aiPrompt').value.trim();
    if (!text) { document.getElementById('aiPrompt').animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}], {duration:240}); return; }
    const cfg = parsePrompt(text);
    // thinking animation
    document.getElementById('aiBody').classList.add('is-thinking');
    document.getElementById('aiFoot').classList.add('is-thinking');
    document.getElementById('aiThink').classList.add('is-on');
    const steps = [...document.getElementById('aiSteps').querySelectorAll('.ai-step')];
    steps.forEach(s => s.classList.remove('is-on'));
    let i = 0;
    const t = setInterval(() => {
      if (i < steps.length) { steps[i].classList.add('is-on'); i++; }
      else { clearInterval(t); closeAi(); if (!layoutMode) setLayout(true); seedBuild(cfg); }
    }, 430);
  };

  function seedBuild(cfg) {
    startBuild();
    Object.assign(S, cfg);
    document.getElementById('esTitle').value = S.title || '';
    pulseNext = true; syncAll();
    toast('AI drafted this card', 'Review the metrics, aggregation &amp; scope — then <b>Add</b>. You stay in control.', 'OK');
  }

  /* tiny NL parser → cfg (same gp.card/v1 the manual builder makes) */
  const METRIC_KW = [
    ['cst_acwr', ['acwr','load ratio','acute chronic','acute:chronic']],
    ['cst_asym_index', ['asymmetry','asym']],
    ['cst_anaerobic_idx', ['anaerobic']],
    ['hml_distance', ['hml','high metabolic','metabolic load']],
    ['high_intensity_efforts', ['high intensity efforts','high-intensity efforts','hie','efforts']],
    ['max_acceleration', ['max acceleration','max accel','peak accel']],
    ['max_speed', ['max speed','top speed','max velocity','max v','peak speed','velocity']],
    ['very_high_speed_distance', ['vhsr','very high','very-high']],
    ['high_speed_distance', ['hsr','high speed','high-speed']],
    ['sprint_distance', ['sprint distance']],
    ['sprint_count', ['sprints','sprint count','sprint']],
    ['meters_per_min', ['meters per min','m/min','meterage','work rate']],
    ['time_played', ['time played','minutes played','mins played']],
    ['acc_dec', ['acc+dec','acc + dec','acc/dec','accel + decel','accelerations','decelerations','accel','decel']],
    ['player_load', ['player load','internal load','int load','load']],
    ['total_distance', ['total distance','distance','km','volume']],
  ];
  function parsePrompt(text) {
    const cfg = freshCfg();
    const raw = text.toLowerCase();
    let work = ' ' + raw + ' ';
    // metrics (consume matches so generic words don't double-hit)
    const found = [];
    METRIC_KW.forEach(([id, kws]) => {
      for (const kw of kws) {
        if (work.includes(kw)) { found.push({ id, pos: raw.indexOf(kw) }); work = work.split(kw).join('  '); break; }
      }
    });
    found.sort((a, b) => a.pos - b.pos);
    let ids = found.map(f => f.id);
    if (!ids.length) ids = ['total_distance'];

    // aggregation hint
    let aggHint = null;
    if (/\b(average|avg|mean)\b/.test(raw)) aggHint = 'avg';
    else if (/\b(total|sum|sum of|aggregate)\b/.test(raw)) aggHint = 'total';
    else if (/\b(max|maximum|peak|highest|fastest|best)\b/.test(raw)) aggHint = 'max';
    else if (/\b(min|minimum|lowest)\b/.test(raw)) aggHint = 'min';
    else if (/\bmedian\b/.test(raw)) aggHint = 'median';

    // type
    let type;
    if (/\b(rank|ranking|top|leader|best|most|highest)\b/.test(raw)) type = 'ranking';
    else if (/\b(trend|over time|over the|evolution|timeline|day by day|across mc|per mc|last \d+|history)\b/.test(raw)) type = 'line';
    else if (/( vs | versus | against |correlat|relationship)/.test(raw) && ids.length >= 2) type = 'scatter';
    else if (/\b(radar|profile|spider)\b/.test(raw)) type = 'radar';
    else if (/\b(heatmap|matrix|z-score|zscore|z score)\b/.test(raw)) type = 'heatmap';
    else if (/\b(table|grid|readout)\b/.test(raw)) type = 'table';
    else if (/\b(by player|each player|per player|compare|across players)\b/.test(raw)) type = 'bars';
    else type = ids.length >= 3 ? 'table' : (ids.length === 2 ? 'scatter' : 'kpi');

    // reconcile type vs available metrics
    const need = GP.TYPES[type].min;
    if (ids.length < need) {
      if (type === 'scatter') type = ids.length >= 1 ? 'bars' : 'kpi';
      else if (type === 'radar') type = ids.length >= 1 ? 'bars' : 'kpi';
    }
    if (type === 'ranking' || type === 'bars') { /* single/dual ok */ }
    cfg.type = type;
    cfg.metrics = ids.slice(0, GP.TYPES[type].max).map(id => {
      let agg = aggHint || GP.defaultAgg(GP.M[id]);
      if (GP.M[id].kind === 'peak' && !GP.AGG[agg].peakOk) agg = 'avg';
      return { id, agg };
    });

    // scope
    if (/\b(squad|team|all players|every player|by player|each player|per player|across players|roster)\b/.test(raw)) cfg.scope = 'squad';
    else cfg.scope = 'player';
    if (type === 'ranking' || type === 'heatmap' || type === 'table') cfg.scope = 'squad';

    // comparison
    if (/\b(no baseline|raw|just the value|absolute)\b/.test(raw)) cfg.compare = 'none';
    else if (/\b(match baseline|vs match|match peak|% ?match|of match)\b/.test(raw)) cfg.compare = 'match';
    else if (/\b(md code|same md|matchday code)\b/.test(raw)) cfg.compare = 'md';
    else if (/\b(role|position|positional)\b/.test(raw)) cfg.compare = 'role';
    else cfg.compare = type === 'scatter' ? 'none' : 'role';

    // range
    if (/\b(season|all season|2025|2026)\b/.test(raw)) cfg.range = 'season';
    else if (/\b(last 30|30 days|month|monthly)\b/.test(raw)) cfg.range = 'w30';
    else if (/\b(last 7|7 days|this week|weekly|past week)\b/.test(raw)) cfg.range = 'w7';
    else cfg.range = 'mc';

    // size heuristic
    cfg.size = (type === 'heatmap' || type === 'table' || type === 'line') ? 'full' : (type === 'kpi' ? 'sm' : (type === 'radar' ? 'lg' : 'md'));

    // title from prompt
    let title = text.trim().replace(/\s+/g, ' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length > 52) title = title.slice(0, 50).trim() + '…';
    cfg.title = title;
    return cfg;
  }

  /* ---------------- BUILD / EDIT ---------------- */
  function freshCfg() {
    return { type:'bars', metrics:[], scope:'player', compare:'role', range:'mc', size:'md', color:'#15803D', palette:'pitch', title:'', axes:true, legend:true, labels:false, previewState:'auto' };
  }
  function startBuild() {
    S = freshCfg(); pulseNext = false;
    // create a fresh draft node
    const tmp = document.createElement('div'); tmp.innerHTML = draftTpl.trim();
    card = tmp.firstElementChild; card.removeAttribute('hidden'); card.id = '';
    card.classList.add('is-editing'); card.dataset.card = 'draft';
    grid.insertBefore(card, addSlot);
    openPanel(); buildStatic(); syncAll();
  }
  function editCard(node) {
    if (!node.__cfg) return;
    S = Object.assign(freshCfg(), JSON.parse(JSON.stringify(node.__cfg)));
    pulseNext = false; card = node;
    grid.querySelectorAll('.gp-c').forEach(c => c.classList.remove('is-editing'));
    card.classList.add('is-editing');
    openPanel(); buildStatic(); syncAll();
  }
  function openPanel() {
    panel.hidden = false;
    grid.classList.add('is-building');
    document.getElementById('esTitle').value = S.title || '';
    document.querySelector('.es-tabs button[data-tab="setup"]').click();
  }
  function closePanel() {
    panel.hidden = true;
    grid.classList.remove('is-building');
    grid.querySelectorAll('.gp-c').forEach(c => c.classList.remove('is-editing'));
    closePop(); closeFly(); closeCfg();
    S = null; card = null;
  }
  function cancelBuild() {
    if (card && card.dataset.card === 'draft') card.remove();  // discard unsaved draft
    closePanel();
  }
  document.getElementById('esCancel').onclick = cancelBuild;

  /* ---------------- STATIC PANEL CONTROLS ---------------- */
  let built = false;
  function buildStatic() {
    if (built) return; built = true;
    document.getElementById('esTypes').innerHTML = Object.entries(GP.TYPES).map(([id,t]) =>
      `<button class="es-tswatch" data-type="${id}"><i class="ti ${t.icon}"></i><span>${t.name}</span></button>`).join('');
    document.getElementById('esColors').innerHTML = GP.COLORS.map(c => `<button class="es-sw" data-color="${c.hex}" style="background:${c.hex}"></button>`).join('');
    document.getElementById('esPalettes').innerHTML = GP.PALETTES.map(p => `<button class="es-pal" data-pal="${p.id}">${p.cols.map(c=>`<i style="background:${c}"></i>`).join('')}</button>`).join('');

    document.getElementById('esTypes').querySelectorAll('[data-type]').forEach(b => b.onclick = () => setType(b.dataset.type));
    document.getElementById('esColors').querySelectorAll('[data-color]').forEach(b => b.onclick = () => { S.color = b.dataset.color; syncStyle(); renderCard(); });
    document.getElementById('esPalettes').querySelectorAll('[data-pal]').forEach(b => b.onclick = () => { S.palette = b.dataset.pal; syncStyle(); renderCard(); });

    document.querySelectorAll('.es-tabs button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.es-tabs button').forEach(o => o.classList.toggle('is-on', o===b));
      document.querySelectorAll('.es-p-b .pane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === b.dataset.tab));
    });
    document.getElementById('esScope').querySelectorAll('button').forEach(b => b.onclick = () => {
      document.getElementById('esScope').querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o===b));
      S.scope = b.dataset.scope; document.getElementById('dimName').textContent = S.scope==='squad'?'Squad players':'Player'; pulseNext = true; renderCard();
    });
    document.getElementById('esSize').querySelectorAll('button').forEach(b => b.onclick = () => {
      document.getElementById('esSize').querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o===b));
      S.size = b.dataset.size; if (card) card.dataset.size = S.size; syncCardSizeToggle();
    });
    document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { S[b.dataset.toggle] = !S[b.dataset.toggle]; b.classList.toggle('is-on', S[b.dataset.toggle]); renderCard(); });
    document.getElementById('esTitle').addEventListener('input', e => { S.title = e.target.value; renderCard(); });
    document.getElementById('esAddMetric').onclick = e => { closePop(); openFly(e.currentTarget); };
    document.getElementById('esRange').onclick = e => togglePop(e.currentTarget, 'range');
    document.getElementById('esCompare').onclick = e => togglePop(e.currentTarget, 'compare');

    /* ---- drag & drop: catalog field → metric well / card ---- */
    const metZone = document.getElementById('metZone');
    metZone.addEventListener('dragover', e => { if (dragMetricId) { e.preventDefault(); metZone.classList.add('drag-over'); } });
    metZone.addEventListener('dragleave', e => { if (!metZone.contains(e.relatedTarget)) metZone.classList.remove('drag-over'); });
    metZone.addEventListener('drop', e => { if (dragMetricId) { e.preventDefault(); addMetric(dragMetricId); metZone.classList.remove('drag-over'); } });
    grid.addEventListener('dragover', e => { if (dragMetricId && card) { const over = e.target.closest('.gp-c'); if (over === card) { e.preventDefault(); card.classList.add('is-droptarget'); } } });
    grid.addEventListener('dragleave', e => { if (dragMetricId && card && !card.contains(e.relatedTarget)) card.classList.remove('is-droptarget'); });
    grid.addEventListener('drop', e => { if (dragMetricId) { const over = e.target.closest('.gp-c'); if (over === card) { e.preventDefault(); addMetric(dragMetricId); } if (card) card.classList.remove('is-droptarget'); } });
  }

  function setType(id) {
    pulseNext = true; S.type = id;
    const t = GP.TYPES[id];
    if (S.metrics.length > t.max) S.metrics = S.metrics.slice(0, t.max);
    S.metrics.forEach(f => { if (GP.M[f.id].kind==='peak' && !GP.AGG[f.agg].peakOk) f.agg = 'avg'; });
    syncAll();
  }
  function addMetric(id) {
    pulseNext = true;
    const t = GP.TYPES[S.type];
    const i = S.metrics.findIndex(f => f.id === id);
    if (i >= 0) S.metrics.splice(i, 1);
    else if (t.max === 1) S.metrics = [{ id, agg:GP.defaultAgg(GP.M[id]) }];
    else if (S.metrics.length < t.max) S.metrics.push({ id, agg:GP.defaultAgg(GP.M[id]) });
    syncAll();
  }

  /* ---------------- SYNC PANEL ---------------- */
  function syncAll() { syncTypes(); renderMetrics(); syncSelects(); syncStyle(); syncHeader(); syncCardSizeToggle(); renderCard(); }
  function syncTypes() {
    document.getElementById('esTypes').querySelectorAll('[data-type]').forEach(b => b.classList.toggle('is-on', b.dataset.type === S.type));
    document.getElementById('metHint').textContent = GP.REQ_LBL[S.type];
    document.getElementById('dimName').textContent = S.scope==='squad'?'Squad players':'Player';
    document.getElementById('esScope').querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.scope===S.scope));
  }
  function syncSelects() {
    document.getElementById('esRangeName').textContent = GP.RANGES.find(r=>r.id===S.range).name;
    document.getElementById('esCompareName').textContent = GP.COMPARES.find(c=>c.id===S.compare).name;
  }
  function syncStyle() {
    document.getElementById('esColors').querySelectorAll('[data-color]').forEach(b => b.classList.toggle('is-on', b.dataset.color === S.color));
    document.getElementById('esPalettes').querySelectorAll('[data-pal]').forEach(b => b.classList.toggle('is-on', b.dataset.pal === S.palette));
    document.getElementById('esSize').querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.size === S.size));
    document.querySelectorAll('[data-toggle]').forEach(b => b.classList.toggle('is-on', !!S[b.dataset.toggle]));
  }
  function syncHeader() {
    document.getElementById('selIcon').className = 'ti ' + GP.TYPES[S.type].icon;
    document.getElementById('selName').textContent = GP.autoTitle(S);
    document.getElementById('selKind').textContent = GP.FULLNAME[S.type].toLowerCase() + (card && card.dataset.card==='draft' ? ' · draft' : ' · editing');
  }
  function syncCardSizeToggle() {
    if (!card) return;
    const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
    card.querySelectorAll('.size-toggle button').forEach(b => b.classList.toggle('is-on', map[b.textContent.trim()] === S.size));
  }
  function renderMetrics() {
    const wrap = document.getElementById('esMetrics');
    wrap.innerHTML = S.metrics.map((f,i) => {
      const m = GP.M[f.id]; const role = S.type==='scatter' ? (i===0?'X':'Y') : (i+1);
      return `<div class="es-field" data-id="${f.id}"><span class="ftype met">${role}</span>
        <div class="fnm"><div class="t">${GP.esc(m.name)}</div><div class="s"><span class="pk ${m.kind}"></span>${GP.esc(m.unit)} · ${m.kind==='peak'?'peak':'accum'}</div></div>
        <div style="display:flex;align-items:center;gap:4px">
          <button class="es-aggchip" data-agg-for="${f.id}"><i class="ti ${GP.AGG[f.agg].icon}"></i>${GP.AGG[f.agg].short}<i class="ti ti-chevron-down" style="font-size:11px"></i></button>
          <button class="frm" data-rm="${f.id}"><i class="ti ti-x"></i></button></div></div>`;
    }).join('');
    wrap.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => addMetric(b.dataset.rm));
    wrap.querySelectorAll('[data-agg-for]').forEach(b => b.onclick = () => {
      pop.dataset.field = b.dataset.aggFor;
      if (popOwner === b) { closePop(); return; }
      closePop(); openPop(popHTML('agg'), b, 'agg');
    });
    /* drag chips to reorder */
    wrap.querySelectorAll('.es-field').forEach((el, i) => {
      el.setAttribute('draggable', 'true'); el.dataset.idx = i;
      el.addEventListener('dragstart', e => { e.stopPropagation(); reorderFrom = i; el.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => { el.classList.remove('is-dragging'); reorderFrom = null; wrap.querySelectorAll('.drop-before').forEach(n => n.classList.remove('drop-before')); });
      el.addEventListener('dragover', e => { if (reorderFrom === null) return; e.preventDefault(); wrap.querySelectorAll('.drop-before').forEach(n => n.classList.remove('drop-before')); el.classList.add('drop-before'); });
      el.addEventListener('drop', e => { if (reorderFrom === null) return; e.preventDefault(); const to = +el.dataset.idx; if (to !== reorderFrom) { const [m] = S.metrics.splice(reorderFrom, 1); S.metrics.splice(to, 0, m); pulseNext = true; syncAll(); } });
    });
    const t = GP.TYPES[S.type];
    document.getElementById('esAddMetric').classList.toggle('disabled', S.metrics.length >= t.max && t.max > 1);
    document.getElementById('metReqStar').style.opacity = S.metrics.length >= t.min ? '0.25' : '1';
  }

  /* ---------------- RENDER CARD (live) ---------------- */
  function body() { return card.querySelector('.gp-c-b'); }
  function setTitleSub() {
    card.querySelector('.ttl').textContent = GP.autoTitle(S);
    const agg0 = S.metrics[0] ? GP.AGG[S.metrics[0].agg].short.toLowerCase() : '';
    card.querySelector('.sub').textContent = `${GP.FULLNAME[S.type].toLowerCase()}${agg0?' · '+agg0:''} · ${S.scope}`;
  }
  function renderCard() {
    if (!card) return;
    const t = GP.TYPES[S.type];
    card.dataset.size = S.size; card.style.setProperty('--cm-accent', S.color);
    setTitleSub(); syncHeader();
    const valid = S.metrics.length >= t.min;
    document.getElementById('esSave').disabled = !valid;

    if (S.previewState === 'loading') return showState('load');
    if (S.previewState === 'empty')   return showState('empty');
    if (S.previewState === 'error')   return showState('err');
    if (S.previewState === 'nodata')  return showState('nodata', GP.noDataReason(S) || 'No rows match the current scope, range and filters.');

    if (!valid) { pulseNext = false; return showState('await'); }
    const nd = GP.noDataReason(S);
    if (nd) { pulseNext = false; return showState('nodata', nd); }
    if (pulseNext) { pulseNext = false; showState('load'); setTimeout(renderCard, 460); return; }
    card.classList.remove('is-draft');
    body().className = GP.bodyClass(S.type);
    GP.renderChart(body(), S);
  }
  function showState(kind, msg) {
    const b = body(); card.classList.add('is-draft'); b.className = 'gp-c-b';
    const t = GP.TYPES[S.type];
    if (kind === 'await') b.innerHTML = `<div class="cb2-await"><div class="ic"><i class="ti ${t.icon}"></i></div><div class="t">${GP.FULLNAME[S.type]} — ${GP.REQ_LBL[S.type]}</div><div class="d">Add metrics from the <b>Setup</b> panel. The card renders live.</div></div>`;
    else if (kind === 'empty') b.innerHTML = `<div class="cb2-await"><div class="ic"><i class="ti ti-circle-dashed"></i></div><div class="t">Empty card</div><div class="d">Nothing configured yet.</div></div>`;
    else if (kind === 'load') b.innerHTML = `<div class="cb2-state load"><div class="cb2-spin"></div><div class="t">Querying GPS data…</div><div class="d">${GP.esc(GP.autoTitle(S))} · ${GP.RANGES.find(r=>r.id===S.range).name}</div></div>`;
    else if (kind === 'err') b.innerHTML = `<div class="cb2-state err"><div class="ic"><i class="ti ti-alert-triangle"></i></div><div class="t">Couldn’t load this card</div><div class="d">The GPS query timed out. Your config is safe — try again.</div></div>`;
    else if (kind === 'nodata') b.innerHTML = `<div class="cb2-state empty"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No data for this selection</div><div class="d">${GP.esc(msg)}</div><button class="cm-btn is-outline is-sm" data-ndfix style="margin-top:4px"><i class="ti ti-user" style="font-size:14px"></i>Switch scope to Player</button></div>`;
    const fix = b.querySelector('[data-ndfix]'); if (fix) fix.onclick = () => {
      S.scope='player'; document.getElementById('esScope').querySelectorAll('button').forEach(o=>o.classList.toggle('is-on',o.dataset.scope==='player')); document.getElementById('dimName').textContent='Player'; pulseNext=true; renderCard();
    };
  }

  /* ---------------- POPOVERS ---------------- */
  const pop = document.getElementById('pop'), popBk = document.getElementById('popBk');
  let popOwner = null;
  function openPop(html, trigger, kind) {
    pop.innerHTML = html; pop.dataset.kind = kind; popBk.classList.add('is-on');
    pop.style.visibility='hidden'; pop.classList.add('is-open');
    const r = trigger.getBoundingClientRect(); const pw = pop.offsetWidth;
    let left = r.right - pw; if (left < 12) left = 12; if (left + pw > innerWidth - 12) left = innerWidth - pw - 12;
    let top = r.bottom + 6; if (top + pop.offsetHeight > innerHeight - 12) top = Math.max(70, r.top - pop.offsetHeight - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility='';
    trigger.classList.add('is-open'); popOwner = trigger; bindPop(kind);
  }
  function closePop() { pop.classList.remove('is-open'); popBk.classList.remove('is-on'); if(popOwner) popOwner.classList.remove('is-open'); popOwner=null; }
  popBk.addEventListener('click', closePop);
  document.addEventListener('keydown', e => { if (e.key==='Escape'){ closePop(); closeFly(); } });
  function togglePop(btn, kind) { if (popOwner===btn){closePop();return;} closePop(); openPop(popHTML(kind), btn, kind); }

  function popHTML(kind) {
    if (kind === 'range' || kind === 'compare') {
      const list = kind==='range'?GP.RANGES:GP.COMPARES; const cur = kind==='range'?S.range:S.compare;
      const rows = list.map(c => `<button class="rb-opt ${cur===c.id?'is-on':''}" data-pick="${c.id}"><span class="ic"><i class="ti ${c.icon}"></i></span><span class="tx"><span class="t">${c.name}</span><span class="d">${c.d}</span></span><i class="ti ti-check ck"></i></button>`).join('');
      return `<div class="rb-pop-h"><div class="t">${kind==='range'?'Time range / MC':'Comparison / baseline'}</div></div><div class="rb-pop-b">${rows}</div>`;
    }
    if (kind === 'agg') {
      const field = S.metrics.find(f => f.id === pop.dataset.field); if (!field) return '';
      const peak = GP.M[field.id].kind === 'peak';
      const rows = GP.AGGS.map(a => { const dis = peak && !a.peakOk;
        return `<button class="rb-opt ${field.agg===a.id?'is-on':''} ${dis?'is-disabled':''}" data-agg="${a.id}"><span class="ic"><i class="ti ${a.icon}"></i></span><span class="tx"><span class="t">${a.name}</span>${dis?'<span class="d">invalid for a peak metric</span>':''}</span>${dis?'<span class="tag no">N/A</span>':'<i class="ti ti-check ck"></i>'}</button>`; }).join('');
      const note = peak ? `<div class="rb-note"><i class="ti ti-info-circle"></i><b>${GP.esc(GP.M[field.id].name)}</b> is a <b>peak</b> metric — sum &amp; median don't apply. Only avg / max / min.</div>` : '';
      return `<div class="rb-pop-h"><div class="t">Aggregate ${GP.esc(GP.M[field.id].name)}</div></div><div class="rb-pop-b">${rows}</div>${note}`;
    }
    if (kind === 'state') {
      const STATES = [['auto','Auto · live','ti-wand'],['loading','Loading','ti-loader-2'],['empty','Empty','ti-circle-dashed'],['nodata','No data','ti-database-off'],['error','Error','ti-alert-triangle']];
      const rows = STATES.map(s => `<button class="rb-opt ${S.previewState===s[0]?'is-on':''}" data-state="${s[0]}"><span class="ic"><i class="ti ${s[2]}"></i></span><span class="tx"><span class="t">${s[1]}</span></span><i class="ti ti-check ck"></i></button>`).join('');
      return `<div class="rb-pop-h"><div class="t">Preview state</div><div class="s">Review every state of the card.</div></div><div class="rb-pop-b">${rows}</div>`;
    }
    return '';
  }
  function bindPop(kind) {
    pop.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { if (kind==='range') S.range=b.dataset.pick; else S.compare=b.dataset.pick; syncSelects(); pulseNext=true; renderCard(); closePop(); });
    pop.querySelectorAll('[data-agg]').forEach(b => b.onclick = () => { if (b.classList.contains('is-disabled')) return; const f = S.metrics.find(x=>x.id===pop.dataset.field); if (f) f.agg=b.dataset.agg; renderMetrics(); pulseNext=true; renderCard(); closePop(); });
    pop.querySelectorAll('[data-state]').forEach(b => b.onclick = () => { S.previewState=b.dataset.state; syncStateChip(); pulseNext=(b.dataset.state==='auto'); renderCard(); closePop(); });
  }

  function syncStateChip() {
    const chip = document.getElementById('esStateBtn');
    const names = { auto:'Auto', loading:'Loading', empty:'Empty', nodata:'No data', error:'Error' };
    chip.className = 'es-tool state' + (S.previewState==='nodata'||S.previewState==='loading'?' warn':S.previewState==='error'?' err':'');
    chip.innerHTML = `<span class="dotn"></span>${names[S.previewState]}<i class="ti ti-chevron-down cv"></i>`;
  }
  document.getElementById('esStateBtn').onclick = e => { if (!S) return; if (popOwner===e.currentTarget){closePop();return;} closePop(); openPop(popHTML('state'), e.currentTarget, 'state'); };

  /* ---------------- FIELDS FLYOUT ---------------- */
  const fly = document.getElementById('fly'), flyBk = document.getElementById('flyBk');
  function openFly(trigger) {
    document.getElementById('flySearch').value = ''; renderFlyBody('');
    flyBk.classList.add('is-on'); fly.style.visibility='hidden'; fly.classList.add('is-open');
    const r = trigger.getBoundingClientRect(); const fw = fly.offsetWidth;
    let left = r.left - fw - 10; if (left < 12) left = 12;
    let top = r.top; if (top + fly.offsetHeight > innerHeight - 12) top = Math.max(70, innerHeight - fly.offsetHeight - 12);
    fly.style.left = left + 'px'; fly.style.top = top + 'px'; fly.style.visibility='';
    setTimeout(() => document.getElementById('flySearch').focus(), 50);
  }
  function closeFly() { fly.classList.remove('is-open'); flyBk.classList.remove('is-on'); }
  flyBk.addEventListener('click', closeFly);
  document.getElementById('flyClose').onclick = closeFly;
  document.getElementById('flySearch').addEventListener('input', e => renderFlyBody(e.target.value.trim().toLowerCase()));
  function renderFlyBody(q) {
    const t = GP.TYPES[S.type]; const full = S.metrics.length >= t.max && t.max > 1;
    let html = '', shown = 0;
    GP.CATALOG.forEach(g => {
      const items = g.items.filter(m => !q || m.name.toLowerCase().includes(q) || (m.abbr||'').toLowerCase().includes(q) || m.id.includes(q));
      if (!items.length) return; shown += items.length;
      html += `<div class="es-fly-grp ${g.custom?'cust':''}">${GP.esc(g.g)}</div>`;
      items.forEach(m => { const on = S.metrics.some(f=>f.id===m.id); const dis = !on && full;
        html += `<div class="es-fly-row ${on?'is-on':''} ${dis?'is-disabled':''}" data-mid="${m.id}"><span class="ic"><i class="ti ${m.icon}"></i></span><span class="nm"><span class="t">${GP.esc(m.name)}${m.custom?' · EAV':''}</span><span class="s">${GP.esc(m.unit)}${m.abbr?' · '+GP.esc(m.abbr):''}</span></span><span class="kind ${m.kind}">${m.kind==='peak'?'PEAK':'ACC'}</span></div>`; });
    });
    document.getElementById('flyBody').innerHTML = shown ? html : `<div style="padding:22px;text-align:center;color:var(--cm-fg-muted);font:500 12px/1.5 var(--cm-font-sans)">No fields match “${GP.esc(q)}”.</div>`;
    document.getElementById('flyBody').querySelectorAll('[data-mid]').forEach(row => {
      row.onclick = () => {
        if (row.classList.contains('is-disabled')) return;
        addMetric(row.dataset.mid);
        renderFlyBody(document.getElementById('flySearch').value.trim().toLowerCase());
        if (GP.TYPES[S.type].max === 1) closeFly();
      };
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', e => {
        if (row.classList.contains('is-disabled')) { e.preventDefault(); return; }
        dragMetricId = row.dataset.mid; row.classList.add('is-dragging');
        flyBk.style.pointerEvents = 'none';
        e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', row.dataset.mid);
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging'); dragMetricId = null; flyBk.style.pointerEvents = '';
        document.getElementById('metZone').classList.remove('drag-over');
        if (card) card.classList.remove('is-droptarget');
      });
    });
  }

  /* ---------------- CONFIG DRAWER ---------------- */
  const cfgDrawer = document.getElementById('cfgDrawer'), cfgBk = document.getElementById('cfgBk');
  function openCfg() { if (!S) return; document.getElementById('cfgJson').innerHTML = GP.hlJSON(GP.buildConfig(S)); cfgBk.classList.add('is-on'); cfgDrawer.classList.add('is-on'); }
  function closeCfg() { cfgBk.classList.remove('is-on'); cfgDrawer.classList.remove('is-on'); }
  document.getElementById('esConfigBtn').onclick = openCfg;
  document.getElementById('cfgClose').onclick = closeCfg;
  cfgBk.addEventListener('click', closeCfg);
  document.getElementById('cfgCopy').onclick = () => { const txt = JSON.stringify(GP.buildConfig(S), null, 2); if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(()=>{}); const b=document.getElementById('cfgCopy'); const o=b.innerHTML; b.innerHTML='<i class="ti ti-check" style="font-size:14px"></i>Copied'; setTimeout(()=>b.innerHTML=o,1400); };
  document.getElementById('cfgSave').onclick = () => { closeCfg(); saveCard(); };

  /* ---------------- SAVE ---------------- */
  function saveCard() {
    if (!S || S.metrics.length < GP.TYPES[S.type].min) return;
    const isNew = card.dataset.card === 'draft';
    card.__cfg = JSON.parse(JSON.stringify(S));
    card.dataset.card = 'chart';
    card.classList.remove('is-draft','is-editing');
    if (!card.id) card.id = 'chart-' + (++chartSeq);
    card.setAttribute('draggable', layoutMode ? 'true' : 'false');
    // final paint (no pulse)
    S.previewState = 'auto'; pulseNext = false;
    card.dataset.size = S.size; card.style.setProperty('--cm-accent', S.color);
    setTitleSubFor(card, card.__cfg);
    card.querySelector('.gp-c-b').className = GP.bodyClass(card.__cfg.type);
    GP.renderChart(card.querySelector('.gp-c-b'), card.__cfg);
    syncCardSizeToggleFor(card, card.__cfg);
    updateEmpty();
    closePanel();
    toast(isNew ? 'Card added to dashboard' : 'Card updated', isNew ? 'On <b>Individual</b> · also saved to <b>Add card → catalog</b>' : 'Your changes are live on the dashboard.', 'Done');
  }
  document.getElementById('esSave').onclick = saveCard;

  function setTitleSubFor(node, cfg) {
    node.querySelector('.ttl').textContent = GP.autoTitle(cfg);
    const agg0 = cfg.metrics[0] ? GP.AGG[cfg.metrics[0].agg].short.toLowerCase() : '';
    node.querySelector('.sub').textContent = `${GP.FULLNAME[cfg.type].toLowerCase()}${agg0?' · '+agg0:''} · ${cfg.scope}`;
  }
  function syncCardSizeToggleFor(node, cfg) {
    const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
    node.querySelectorAll('.size-toggle button').forEach(b => b.classList.toggle('is-on', map[b.textContent.trim()] === cfg.size));
  }

  /* ---------------- CARD ACTIONS (delegated) ---------------- */
  grid.addEventListener('click', e => {
    const node = e.target.closest('.gp-c'); if (!node) return;
    const del = e.target.closest('[data-del]');
    const edit = e.target.closest('[data-edit]');
    const sizeBtn = e.target.closest('.size-toggle button');
    if (del) { e.stopPropagation(); deleteCard(node); return; }
    if (edit) { e.stopPropagation(); if (node.__cfg) editCard(node); return; }
    if (sizeBtn && layoutMode) {
      const map = { S:'sm', M:'md', L:'lg', FULL:'full' };
      node.dataset.size = map[sizeBtn.textContent.trim()];
      node.querySelectorAll('.size-toggle button').forEach(b => b.classList.toggle('is-on', b===sizeBtn));
      if (node === card && S) { S.size = node.dataset.size; syncStyle(); }
      return;
    }
  });

  function deleteCard(node) {
    const next = node.nextElementSibling; const parent = node.parentNode;
    lastDeleted = { node, next, parent };
    if (node === card) cancelBuild();
    node.remove(); updateEmpty();
    toast('Card removed', 'It’s off the dashboard.', 'Undo', () => {
      if (!lastDeleted) return;
      lastDeleted.parent.insertBefore(lastDeleted.node, lastDeleted.next);
      lastDeleted = null; updateEmpty();
    });
  }

  /* ---------------- DRAG REORDER (layout mode) ---------------- */
  let dragEl = null;
  grid.addEventListener('dragstart', e => {
    if (!layoutMode) return;
    const node = e.target.closest('.gp-c'); if (!node) { e.preventDefault(); return; }
    dragEl = node; node.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move';
  });
  grid.addEventListener('dragend', () => { if (dragEl) dragEl.classList.remove('is-drag'); dragEl = null; grid.querySelectorAll('.is-dropafter').forEach(n=>n.classList.remove('is-dropafter')); });
  grid.addEventListener('dragover', e => {
    if (!layoutMode || !dragEl) return; e.preventDefault();
    const over = e.target.closest('.gp-c'); if (!over || over === dragEl) return;
    grid.querySelectorAll('.is-dropafter').forEach(n=>n.classList.remove('is-dropafter'));
    const r = over.getBoundingClientRect(); const after = (e.clientX - r.left) > r.width/2;
    over.classList.add('is-dropafter');
    grid.insertBefore(dragEl, after ? over.nextElementSibling : over);
    if (addSlot.previousElementSibling !== addSlot) grid.appendChild(addSlot); // keep slot last
  });

  /* ---------------- DASHBOARDS (create / switch / rename / delete) ---------------- */
  let dashboards = [], current = 'ind', dashSeq = 0;
  const getCur = () => dashboards.find(d => d.id === current);
  const getDash = id => dashboards.find(d => d.id === id);

  function buildCardNode(d) {
    if (d.kind === 'html') { const w = document.createElement('div'); w.innerHTML = d.html.trim(); const n = w.firstElementChild; n.classList.remove('is-editing','is-drag'); n.setAttribute('draggable', layoutMode ? 'true':'false'); return n; }
    const tmp = document.createElement('div'); tmp.innerHTML = draftTpl.trim();
    const n = tmp.firstElementChild; n.removeAttribute('hidden'); n.id = 'chart-' + (++chartSeq);
    n.dataset.card = 'chart'; n.classList.remove('is-draft','is-editing');
    n.__cfg = JSON.parse(JSON.stringify(d.cfg));
    n.dataset.size = d.cfg.size; n.style.setProperty('--cm-accent', d.cfg.color);
    setTitleSubFor(n, d.cfg);
    n.querySelector('.gp-c-b').className = GP.bodyClass(d.cfg.type);
    /* Render chart once the node is connected to the DOM (Chart.js needs layout dimensions). */
    const _body = n.querySelector('.gp-c-b'), _cfg = d.cfg;
    (function raf() { _body.isConnected ? GP.renderChart(_body, _cfg) : requestAnimationFrame(raf); })();
    syncCardSizeToggleFor(n, d.cfg);
    n.setAttribute('draggable', layoutMode ? 'true':'false');
    return n;
  }
  function captureGrid() {
    return [...grid.querySelectorAll('.gp-c')].filter(n => n.dataset.card !== 'draft').map(n =>
      n.dataset.card === 'chart' ? { kind:'chart', cfg: JSON.parse(JSON.stringify(n.__cfg)) } : { kind:'html', html: n.outerHTML });
  }
  function loadDashboard(dash) {
    grid.querySelectorAll('.gp-c').forEach(n => n.remove());
    dash.cards.forEach(d => grid.insertBefore(buildCardNode(d), emptyState));
    updateEmpty();
  }
  function updateEmpty() {
    const n = [...grid.querySelectorAll('.gp-c')].filter(c => c.dataset.card !== 'draft').length;
    emptyState.hidden = n > 0;
  }
  function captureCurrent() { const d = getCur(); if (d) d.cards = captureGrid(); }

  function switchTo(id) {
    if (id === current) return;
    if (S) cancelBuild();
    captureCurrent();
    current = id; const d = getCur();
    loadDashboard(d);
    document.getElementById('dashName').textContent = d.name;
    renderTabs();
  }
  function newDashboard(name) {
    if (S) cancelBuild();
    captureCurrent();
    const id = 'd' + (++dashSeq);
    dashboards.push({ id, name, sub:'custom', icon:'ti-layout-dashboard', cards:[] });
    current = id; const d = getCur();
    loadDashboard(d);
    document.getElementById('dashName').textContent = d.name;
    renderTabs();
    if (!layoutMode) setLayout(true);
    toast('Dashboard created', `“${GP.esc(name)}” is empty — add cards to build it.`, 'OK');
  }
  function deleteDashboard(id) {
    if (dashboards.length <= 1) return;
    const idx = dashboards.findIndex(d => d.id === id); const removed = dashboards[idx];
    dashboards.splice(idx, 1);
    if (current === id) { current = dashboards[Math.max(0, idx-1)].id; const d = getCur(); loadDashboard(d); document.getElementById('dashName').textContent = d.name; }
    renderTabs();
    toast('Dashboard deleted', `“${GP.esc(removed.name)}” was removed.`, 'Undo', () => { dashboards.splice(idx, 0, removed); current = removed.id; loadDashboard(removed); document.getElementById('dashName').textContent = removed.name; renderTabs(); });
  }

  function duplicateDashboard(id) {
    if (S) cancelBuild();
    captureCurrent();
    const idx = dashboards.findIndex(d => d.id === id); const src = dashboards[idx];
    const copy = { id:'d' + (++dashSeq), name: src.name + ' copy', sub:'custom', icon:src.icon, cards: JSON.parse(JSON.stringify(src.cards)) };
    dashboards.splice(idx + 1, 0, copy);
    current = copy.id; loadDashboard(copy);
    document.getElementById('dashName').textContent = copy.name;
    renderTabs();
    toast('Dashboard duplicated', `Created “${GP.esc(copy.name)}”.`, 'OK');
  }
  function createDashboardFlow() {
    newDashboard('New dashboard');
    startRenameTab(current);
  }

  /* inline rename on the tab itself */
  function startRenameTab(id) {
    const tab = document.querySelector(`#gaTabs .ga-tab[data-dash="${id}"]`); if (!tab) return;
    const d = getDash(id); const tx = tab.querySelector('.tx');
    tx.innerHTML = `<input type="text">`; const inp = tx.querySelector('input'); inp.value = d.name; inp.focus(); inp.select();
    let done = false;
    const commit = () => { if (done) return; done = true; const v = inp.value.trim(); if (v) d.name = v; if (id === current) document.getElementById('dashName').textContent = d.name; renderTabs(); };
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key==='Enter'){ e.preventDefault(); commit(); } if (e.key==='Escape'){ done=true; renderTabs(); } });
    inp.addEventListener('blur', commit);
  }

  /* tab options menu (rename / duplicate / delete) */
  function openTabMenu(trigger, id) {
    if (popOwner === trigger) { closePop(); return; }
    closePop();
    const html = `<div class="rb-pop-b" style="min-width:184px">
      <button class="rb-opt" data-tabact="rename"><span class="ic"><i class="ti ti-pencil"></i></span><span class="tx"><span class="t">Rename</span></span></button>
      <button class="rb-opt" data-tabact="duplicate"><span class="ic"><i class="ti ti-copy"></i></span><span class="tx"><span class="t">Duplicate</span></span></button>
      ${dashboards.length>1?'<button class="rb-opt" data-tabact="delete"><span class="ic"><i class="ti ti-trash"></i></span><span class="tx"><span class="t" style="color:var(--cm-danger)">Delete dashboard</span></span></button>':''}
    </div>`;
    openPop(html, trigger, 'tabmenu');
    pop.querySelectorAll('[data-tabact]').forEach(b => b.onclick = () => {
      const act = b.dataset.tabact; closePop();
      if (act === 'rename') { if (id !== current) switchTo(id); startRenameTab(id); }
      else if (act === 'duplicate') duplicateDashboard(id);
      else if (act === 'delete') deleteDashboard(id);
    });
  }

  function renderTabs() {
    const strip = document.getElementById('gaTabs');
    strip.innerHTML = dashboards.map(d => `
      <button class="ga-tab ${d.id===current?'is-on':''}" data-dash="${d.id}">
        <i class="ti ${d.icon||'ti-layout-dashboard'}"></i>
        <div class="tx"><div class="t">${GP.esc(d.name)}</div><div class="s">${d.sub?GP.esc(d.sub):d.cards.length+' card'+(d.cards.length!==1?'s':'')}</div></div>
        <span class="kebab" data-kebab title="Options"><i class="ti ti-dots"></i></span>
      </button>`).join('') + `<button class="ga-addtab" id="addDashTab" title="New dashboard"><i class="ti ti-plus"></i><span class="lbl">New</span></button>`;
    strip.querySelectorAll('.ga-tab').forEach(tab => {
      const id = tab.dataset.dash;
      tab.addEventListener('click', e => { if (e.target.closest('[data-kebab]') || tab.querySelector('.tx input')) return; switchTo(id); });
      const k = tab.querySelector('[data-kebab]'); if (k) k.onclick = e => { e.stopPropagation(); openTabMenu(k, id); };
    });
    strip.querySelector('#addDashTab').onclick = createDashboardFlow;
  }

  document.getElementById('emptyAdd').onclick = openEntry;

  function initDashboards() {
    dashboards = [
      { id:'pw', name:'Player Week Report', sub:'week vs match reference', icon:'ti-user-bolt', cards: captureGrid() },
      { id:'sc', name:'Session Control', sub:'daily training review', icon:'ti-calendar-event', cards:[
        { kind:'chart', cfg:{ type:'bars', metrics:[{id:'player_load',agg:'total'}], scope:'squad', compare:'none', range:'w7', size:'full', color:'#15803D', palette:'pitch', title:'Session load by player', axes:true, legend:true, labels:false } },
        { kind:'chart', cfg:{ type:'kpi', metrics:[{id:'total_distance',agg:'total'}], scope:'squad', compare:'none', range:'w7', size:'sm', color:'#15803D', palette:'pitch', title:'', axes:true, legend:true, labels:false } },
      ]},
      { id:'mp', name:'Match Performance', sub:'per-player season', icon:'ti-ball-football', cards:[
        { kind:'chart', cfg:{ type:'radar', metrics:[{id:'total_distance',agg:'avg'},{id:'high_speed_distance',agg:'avg'},{id:'sprint_count',agg:'total'},{id:'player_load',agg:'avg'},{id:'acc_dec',agg:'total'},{id:'max_speed',agg:'max'}], scope:'player', compare:'role', range:'season', size:'lg', color:'#15803D', palette:'pitch', title:'Match physical profile', axes:true, legend:true, labels:false } },
        { kind:'chart', cfg:{ type:'scatter', metrics:[{id:'player_load',agg:'avg'},{id:'high_speed_distance',agg:'avg'}], scope:'squad', compare:'none', range:'season', size:'md', color:'#2563EB', palette:'cool', title:'Load vs HSR', axes:true, legend:true, labels:false } },
      ]},
      { id:'lm', name:'Load Monitoring', sub:'ACWR & risk zones', icon:'ti-activity', cards:[
        { kind:'chart', cfg:{ type:'line', metrics:[{id:'cst_acwr',agg:'avg'}], scope:'player', compare:'none', range:'w30', size:'full', color:'#D97706', palette:'heat', title:'ACWR trend', axes:true, legend:true, labels:false } },
        { kind:'chart', cfg:{ type:'ranking', metrics:[{id:'player_load',agg:'total'}], scope:'squad', compare:'role', range:'mc', size:'md', color:'#15803D', palette:'pitch', title:'Load ranking', axes:true, legend:true, labels:true } },
      ]},
      { id:'mcc', name:'Microcycle Compare', sub:'MC vs MC diff', icon:'ti-arrows-diff', cards:[
        { kind:'chart', cfg:{ type:'heatmap', metrics:[{id:'total_distance',agg:'total'},{id:'high_speed_distance',agg:'total'},{id:'player_load',agg:'avg'},{id:'sprint_count',agg:'total'},{id:'acc_dec',agg:'total'},{id:'max_speed',agg:'max'}], scope:'squad', compare:'role', range:'mc', size:'full', color:'#15803D', palette:'heat', title:'Squad z-matrix', axes:true, legend:true, labels:true } },
        { kind:'chart', cfg:{ type:'bars', metrics:[{id:'total_distance',agg:'total'},{id:'high_speed_distance',agg:'total'}], scope:'squad', compare:'md', range:'mc', size:'full', color:'#15803D', palette:'pitch', title:'MC totals vs prev', axes:true, legend:true, labels:false } },
      ]},
    ];
    current = 'pw';
    document.getElementById('dashName').textContent = 'Player Week Report';
    renderTabs(); updateEmpty();
  }
  initDashboards();

  /* ---------------- TOAST ---------------- */
  const toastEl = document.getElementById('saveToast');
  let toastT;
  function toast(title, sub, actLabel, actFn) {
    toastEl.querySelector('.t').textContent = title;
    toastEl.querySelector('.s').innerHTML = sub;
    const act = document.getElementById('toastView');
    act.textContent = actLabel || 'Done';
    act.onclick = () => { toastEl.classList.remove('is-on'); if (actFn) actFn(); };
    toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 4600);
  }
});
