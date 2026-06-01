/* =============================================================
   gp-ai.js — Fase 4: AI chart generator modal.

   Flow:
     "Ask AI" button → modal → user types prompt → invoke Edge Function
     → validate/fallback → window.openBuilderWithConfig(config)
     → user reviews in builder panel → "Add card"

   Fallback: if the Edge Function is unavailable or returns 422,
   parsePromptHeuristic() is used instead (same output shape).

   Privacy: only catalog metadata + the prompt are sent to Claude.
   No athlete PII leaves the client.
   ============================================================= */
(function () {
  'use strict';

  let _clubId = null;

  // ── Heuristic fallback parser (ported from GPS Builder prototype) ──────
  // Uses window.GpBuilder.catalogMap for metric lookup.

  const METRIC_KW = [
    ['total_distance',           ['total distance','distance','km','volume']],
    ['high_speed_distance',      ['hsr','high speed','high-speed']],
    ['very_high_speed_distance', ['vhsr','very high','very-high']],
    ['sprint_distance',          ['sprint distance']],
    ['sprint_count',             ['sprints','sprint count','sprint']],
    ['max_speed',                ['max speed','top speed','max velocity','max v','peak speed','velocity']],
    ['avg_speed',                ['avg speed','average speed']],
    ['accelerations',            ['accelerations','accel']],
    ['decelerations',            ['decelerations','decel']],
    ['player_load',              ['player load','internal load','int load','load']],
    ['hmld',                     ['hml','high metabolic','metabolic load','hmld']],
    ['time_played',              ['time played','minutes played','mins played']],
    ['distance_per_minute',      ['meters per min','m/min','meterage','work rate','distance per min']],
  ];

  function parsePromptHeuristic(text) {
    const GB = window.GpBuilder || {};
    const catalogMap = GB.catalogMap || new Map();
    const VIZ = GB.VIZ_TYPES || {};
    const agg_by_id = GB.AGG || {};
    const defAgg = GB.defaultAgg || (k => k === 'peak' ? 'avg' : 'total');

    const raw  = text.toLowerCase();
    let   work = ' ' + raw + ' ';

    // 1 — match metrics
    const found = [];
    METRIC_KW.forEach(([id, kws]) => {
      for (const kw of kws) {
        if (work.includes(kw)) { found.push({ id, pos: raw.indexOf(kw) }); work = work.split(kw).join('  '); break; }
      }
    });
    // also check catalog for custom metrics by label keywords
    for (const [id, m] of catalogMap) {
      if (found.some(f => f.id === id)) continue;
      const label = m.name?.toLowerCase() || '';
      if (label && work.includes(label)) { found.push({ id, pos: raw.indexOf(label) }); work = work.split(label).join('  '); }
    }
    found.sort((a, b) => a.pos - b.pos);
    let ids = found.map(f => f.id).filter(id => catalogMap.has(id));
    if (!ids.length) ids = ['total_distance'];

    // 2 — agg hint
    let aggHint = null;
    if (/\b(average|avg|mean)\b/.test(raw))           aggHint = 'avg';
    else if (/\b(total|sum|aggregate)\b/.test(raw))   aggHint = 'total';
    else if (/\b(max|maximum|peak|fastest|best)\b/.test(raw)) aggHint = 'max';
    else if (/\b(min|minimum|lowest)\b/.test(raw))    aggHint = 'min';
    else if (/\bmedian\b/.test(raw))                  aggHint = 'median';

    // 3 — viz type
    let type;
    if (/\b(rank|ranking|top|leader|best|most|highest)\b/.test(raw))               type = 'ranking';
    else if (/\b(trend|over time|evolution|timeline|day by day|history|last \d+)\b/.test(raw)) type = 'line';
    else if (/( vs | versus | against |correlat|relationship)/.test(raw) && ids.length >= 2) type = 'scatter';
    else if (/\b(radar|profile|spider)\b/.test(raw))  type = 'radar';
    else if (/\b(heatmap|matrix|z-score|zscore)\b/.test(raw)) type = 'heatmap';
    else if (/\b(table|grid|readout)\b/.test(raw))    type = 'table';
    else if (/\b(by player|each player|per player|compare|across players)\b/.test(raw)) type = 'bars';
    else type = ids.length >= 3 ? 'table' : ids.length === 2 ? 'scatter' : 'kpi';

    // 4 — reconcile type vs metric count
    const viz = VIZ[type] || { min:1, max:12 };
    if (ids.length < viz.min) {
      if (type === 'scatter' || type === 'radar') type = ids.length >= 1 ? 'bars' : 'kpi';
    }

    // 5 — metrics
    const vizBound = (VIZ[type] || { max: 12 }).max;
    const metrics = ids.slice(0, vizBound).map(id => {
      const cat = catalogMap.get(id);
      let agg = aggHint || defAgg(cat?.kind || 'accum');
      const aggDef = agg_by_id[agg];
      if (cat?.kind === 'peak' && aggDef && !aggDef.peakOk) agg = 'avg';
      return { id, agg };
    });

    // 6 — scope
    let scope = 'player';
    if (/\b(squad|team|all players|every player|by player|each player|per player|across players)\b/.test(raw)) scope = 'squad';
    if (['ranking','heatmap','table'].includes(type)) scope = 'squad';

    // 7 — comparison
    let compare = 'none';
    if (/\b(no baseline|raw|absolute)\b/.test(raw))       compare = 'none';
    else if (/\b(vs match|match peak|% ?match)\b/.test(raw)) compare = 'match';
    else if (/\b(md code|same md|matchday code)\b/.test(raw)) compare = 'md';
    else if (/\b(role|position|positional)\b/.test(raw)) compare = 'role';
    else compare = type === 'scatter' ? 'none' : 'role';

    // 8 — range
    let range = 'mc';
    if (/\b(season|all season)\b/.test(raw))              range = 'season';
    else if (/\b(last 30|30 days|month)\b/.test(raw))     range = 'w30';
    else if (/\b(last 7|7 days|this week)\b/.test(raw))   range = 'w7';

    // 9 — size
    const sizeMap = { heatmap:'full', table:'full', line:'full', kpi:'sm', radar:'lg' };
    const size = sizeMap[type] || 'md';

    // 10 — title
    let title = text.trim().replace(/\s+/g, ' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length > 52) title = title.slice(0, 50).trim() + '…';

    return {
      schema: 'gp.card/v1', title, viz: type,
      scope: { level: scope },
      metrics,
      range: { type: range },
      comparison: compare === 'none' ? null : { baseline: compare },
      style: { size, color:'#15803D', palette:'pitch', axes:true, legend:true, dataLabels:false },
    };
  }

  // ── Edge Function call ─────────────────────────────────────────────────

  async function callGenerateCard(prompt, clubId) {
    if (!window.sb) throw new Error('Supabase client not available');
    const { data, error } = await window.sb.functions.invoke('generate-card', {
      body: { prompt, clubId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.config;
  }

  // ── DOM injection ──────────────────────────────────────────────────────

  function injectModal() {
    if (document.getElementById('gpaiModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="gpaiBk"  class="gpai-bk"></div>
      <div id="gpaiModal" class="gpai-modal" hidden>
        <div class="gpai-h">
          <span class="t">Ask AI</span>
          <span class="badge"><i class="ti ti-sparkles"></i>Claude</span>
          <button class="x" id="gpaiClose"><i class="ti ti-x"></i></button>
        </div>
        <div class="gpai-body" id="gpaiBody">
          <div class="gpai-prompt-wrap">
            <textarea id="gpaiPrompt" class="gpai-prompt"
              placeholder="Describe the chart you want — e.g. &quot;Top sprinters this microcycle vs role baseline&quot;"
              rows="3" maxlength="400"></textarea>
          </div>
          <div class="gpai-chips" id="gpaiChips">
            <button class="gpai-chip">Top sprinters this MC</button>
            <button class="gpai-chip">Load vs HSR by player</button>
            <button class="gpai-chip">Squad physical profile radar</button>
            <button class="gpai-chip">Distance trend last 30 days</button>
            <button class="gpai-chip">Heatmap season squad</button>
          </div>
          <div class="gpai-think" id="gpaiThink">
            <div class="gpai-step" id="gpaiStep0"><i class="ti ti-loader-2"></i>Reading prompt…</div>
            <div class="gpai-step" id="gpaiStep1"><i class="ti ti-list-search"></i>Matching metrics…</div>
            <div class="gpai-step" id="gpaiStep2"><i class="ti ti-braces"></i>Building config…</div>
            <div class="gpai-step" id="gpaiStep3"><i class="ti ti-shield-check"></i>Validating…</div>
          </div>
        </div>
        <div class="gpai-foot" id="gpaiFoot">
          <span class="hint"><i class="ti ti-lock"></i>Only catalog metadata is sent — no athlete data</span>
          <div style="flex:1"></div>
          <button class="cm-btn is-outline is-sm" id="gpaiCancel">Cancel</button>
          <button class="cm-btn is-primary is-sm" id="gpaiGen">
            <i class="ti ti-sparkles" style="font-size:13px"></i>Generate
          </button>
        </div>
      </div>
    `);

    // wire chip clicks
    document.querySelectorAll('.gpai-chip').forEach(c => {
      c.onclick = () => {
        document.getElementById('gpaiPrompt').value = c.textContent.trim();
        document.getElementById('gpaiPrompt').focus();
      };
    });

    // close buttons
    document.getElementById('gpaiClose').onclick  = closeModal;
    document.getElementById('gpaiCancel').onclick = closeModal;
    document.getElementById('gpaiBk').onclick     = closeModal;

    // Cmd/Ctrl+Enter → generate
    document.getElementById('gpaiPrompt').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); document.getElementById('gpaiGen').click(); }
    });

    document.getElementById('gpaiGen').onclick = generate;
  }

  function openModal() {
    const modal = document.getElementById('gpaiModal');
    const bk    = document.getElementById('gpaiBk');
    if (!modal) { injectModal(); return openModal(); }
    document.getElementById('gpaiPrompt').value = '';
    setThinking(false);
    modal.removeAttribute('hidden');
    bk.classList.add('is-on');
    setTimeout(() => document.getElementById('gpaiPrompt').focus(), 80);
  }

  function closeModal() {
    document.getElementById('gpaiModal')?.setAttribute('hidden', '');
    document.getElementById('gpaiBk')?.classList.remove('is-on');
  }

  // ── Thinking animation ────────────────────────────────────────────────

  let _thinkInterval = null;

  function setThinking(on) {
    document.getElementById('gpaiBody')?.classList.toggle('is-thinking', on);
    document.getElementById('gpaiFoot')?.classList.toggle('is-thinking', on);
    document.querySelectorAll('.gpai-step').forEach(s => s.classList.remove('is-on'));
    clearInterval(_thinkInterval);
    if (!on) return;
    const steps = document.querySelectorAll('.gpai-step');
    let i = 0;
    _thinkInterval = setInterval(() => {
      if (i < steps.length) { steps[i].classList.add('is-on'); i++; }
    }, 480);
  }

  // ── Generate ──────────────────────────────────────────────────────────

  async function generate() {
    const prompt = document.getElementById('gpaiPrompt')?.value.trim();
    if (!prompt) {
      document.getElementById('gpaiPrompt')?.animate(
        [{ transform:'translateX(0)' },{ transform:'translateX(-5px)' },{ transform:'translateX(5px)' },{ transform:'translateX(0)' }],
        { duration: 240 }
      );
      return;
    }

    setThinking(true);

    let config = null;
    let usedFallback = false;

    try {
      config = await callGenerateCard(prompt, _clubId);
    } catch (e) {
      console.warn('gp-ai: Edge Function failed, using heuristic fallback:', e.message);
      config = parsePromptHeuristic(prompt);
      usedFallback = true;
    }

    clearInterval(_thinkInterval);
    closeModal();

    if (typeof window.openBuilderWithConfig === 'function') {
      window.openBuilderWithConfig(config);
      if (usedFallback) {
        setTimeout(() => {
          // brief toast to tell user it used fallback
          const toast = document.getElementById('gpbToast');
          if (toast) {
            document.getElementById('gpbToastTitle').textContent = 'AI drafted this card (offline)';
            document.getElementById('gpbToastSub').textContent = 'Claude unavailable — used heuristic parser. Review and tweak before saving.';
            document.getElementById('gpbToastAct').textContent = 'OK';
            toast.classList.add('is-on');
            setTimeout(() => toast.classList.remove('is-on'), 5000);
          }
        }, 300);
      }
    }
  }

  // ── Add "Ask AI" button to .gp-bar ────────────────────────────────────

  function addAIButton() {
    if (document.getElementById('gpaiOpenBtn')) return;
    const rightBar = document.querySelector('.gp-bar .right');
    if (!rightBar) return;

    const btn = document.createElement('button');
    btn.id = 'gpaiOpenBtn';
    btn.className = 'cm-btn is-ghost is-sm gpai-open-btn';
    btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:14px"></i>Ask AI';
    btn.style.cssText = 'margin-left:2px';
    btn.onclick = openModal;

    // insert before the "Chart builder" button if it exists
    const builderBtn = document.getElementById('gpbOpenBtn');
    if (builderBtn) builderBtn.before(btn);
    else rightBar.appendChild(btn);
  }

  // ── Wait helpers ──────────────────────────────────────────────────────

  function waitForClubId(maxMs = 12000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check() {
        if (window._gpClubId) return resolve(window._gpClubId);
        if (Date.now() - t0 > maxMs) return reject(new Error('gpai: timeout'));
        setTimeout(check, 300);
      })();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────

  async function init() {
    if (!window.sb) { setTimeout(init, 400); return; }
    try {
      _clubId = await waitForClubId();
      injectModal();
      addAIButton();
    } catch (e) {
      console.warn('[gp-ai] init failed:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => init());
  if (document.readyState !== 'loading') init();

})();
