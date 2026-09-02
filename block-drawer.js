/* ============================================================
   Block Drawer — slide-out for creating/editing a block
   Vanilla JS. Self-installs on .rp-add-block clicks.
   Public API: window.openBlockDrawer({ context, day, block })
   ============================================================ */

(function () {
  'use strict';

  // ─── Data: block types (defaults match kanban) ───
  const TYPES = [
    { id: 'warmup', label: 'Warm-up',    icon: 'ti-flame',         defaults: '4 ex · 12 min · RPE 3' },
    { id: 'myo',    label: 'Myofascial', icon: 'ti-massage',       defaults: '3 ex · 10 min · RPE 2' },
    { id: 'mob',    label: 'Mobility',   icon: 'ti-stretching',    defaults: '5 ex · 14 min · RPE 3' },
    { id: 'act',    label: 'Activation', icon: 'ti-yoga',          defaults: '5 ex · 18 min · RPE 4' },
    { id: 'str',    label: 'Strength',   icon: 'ti-barbell',       defaults: '4 ex · 30 min · RPE 7' },
    { id: 'plyo',   label: 'Plyometrics',icon: 'ti-bounce-right',  defaults: '4 ex · 18 min · RPE 7' },
    { id: 'skills', label: 'Skills',     icon: 'ti-ball-football', defaults: '3 ex · 25 min · RPE 6' },
    { id: 'field',  label: 'On-field',   icon: 'ti-soccer-field',  defaults: '3 ex · 30 min · RPE 7' },
    { id: 'cond',   label: 'Conditioning', icon: 'ti-run',         defaults: '3 ex · 30 min · RPE 8' },
    { id: 'cool',   label: 'Cooldown',   icon: 'ti-droplet',       defaults: '2 ex · 8 min · RPE 2' },
    { id: 'assess', label: 'Assessment', icon: 'ti-target',        defaults: '1 ex · 12 min · RPE 4' }
  ];

  // ─── Data: shared exercise library — loaded from gym_exercises per context ───
  // Mapped picker shape: { id, exercise_id, name, region, equip, type, complexity, custom }
  let LIB = [];
  let REGIONS = ['All'];
  let EQUIPS  = ['Any'];
  const libCache = {};                                  // context -> mapped array (fetched once per context)
  const CTX_USABLE = { ip: 'individual', rehab: 'rehab', prev: 'preventive' };

  function _tt(key, en) { if (window.CM_I18N && CM_I18N.t) { const v = CM_I18N.t(key); if (v && v !== key) return v; } return en; }

  // ── Risk-aware suggestions (preventive plans) ──────────────────────────────
  // Map an injury body_area (side-stripped) → gym_exercises muscle_group values.
  // Normalized (lowercase, letters only) so it matches tokens ('hip_flexors') or
  // labels ('Hip Flexors'). Unmapped zones simply don't prioritize.
  const _norm     = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const _normZone = s => String(s || '').toLowerCase().replace(/^(left|right)\s+/, '').replace(/[^a-z]/g, '');
  const _SEV_RANK = { minor: 1, moderate: 2, severe: 3 };
  const ZONE_MUSCLES = {
    hamstring: ['hamstrings'],
    adductor:  ['adductors'],
    groin:     ['adductors', 'hipflexors'],
    calf:      ['calves', 'soleus'],
    shin:      ['tibialisanterior'],
    knee:      ['quadriceps', 'hamstrings'],
    thigh:     ['quadriceps', 'hamstrings'],
    hip:       ['hipflexors', 'glutes', 'glutemed'],
    glute:     ['glutes', 'glutemed'],
    ankle:     ['calves', 'soleus', 'tibialisanterior'],
    achilles:  ['calves', 'soleus'],
    chest:     ['chest'],
    shoulder:  ['shoulders', 'rotatorcuff'],
    arm:       ['biceps', 'triceps'],
    lowerback: ['spinalerectors', 'erectors', 'ql', 'core'],
    upperback: ['upperback', 'lats'],
    abdomen:   ['core', 'obliques']
  };
  // riskZones: [{zone, count, maxSeverity}] → { normalizedMuscle: { score, label } }
  function buildRiskMap(riskZones) {
    if (!Array.isArray(riskZones) || !riskZones.length) return null;
    const m = {};
    riskZones.forEach(z => {
      const muscles = ZONE_MUSCLES[_normZone(z.zone)];
      if (!muscles) return;
      const score = (Number(z.count) || 1) * 10 + (_SEV_RANK[String(z.maxSeverity || '').toLowerCase()] || 0);
      muscles.forEach(mk => { if (!m[mk] || score > m[mk].score) m[mk] = { score, label: z.zone }; });
    });
    return Object.keys(m).length ? m : null;
  }
  function riskFor(ex) {
    if (!state.riskMap) return null;
    const r = _norm(ex.region);
    if (!r) return null;
    let best = null;
    for (const mk in state.riskMap) {
      if (r === mk || r.includes(mk)) { const c = state.riskMap[mk]; if (!best || c.score > best.score) best = c; }
    }
    return best;
  }

  // YouTube id extractor (mirrors Gym Planner's resolver)
  function youtubeId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  // Resolve a thumbnail per library item (image signed URL > YouTube thumb > null), stashed as e._thumb.
  async function resolveThumbs(mapped) {
    const paths = [], byPath = {};
    mapped.forEach(e => { if (e.media_type === 'image' && e.media_ref) { paths.push(e.media_ref); byPath[e.media_ref] = e; } });
    if (paths.length) {
      const urls = await window.cmSignedUrls('gym-exercise-media', paths);
      Object.keys(urls).forEach(p => { if (byPath[p]) byPath[p]._thumb = urls[p]; });
    }
    mapped.forEach(e => {
      if (e._thumb) return;
      const yt = youtubeId(e.video_url);
      e._thumb = yt ? `https://img.youtube.com/vi/${yt}/mqdefault.jpg` : null;
    });
  }

  function recomputeFilterOpts() {
    REGIONS = ['All', ...[...new Set(LIB.map(e => e.type).filter(Boolean))].sort()];  // ahora = categorías (ex.type)
    EQUIPS  = ['Any', ...[...new Set(LIB.map(e => e.equip).filter(Boolean))].sort()];
  }

  async function ensureLibrary(context) {
    if (libCache[context]) { LIB = libCache[context].slice(); recomputeFilterOpts(); return; }
    const want = CTX_USABLE[context] || 'rehab';
    let rows = [];
    try {
      const clubId = await window.getClubId();
      const { data, error } = await window.sb.from('gym_exercises')
        .select('id,name,muscle_group,category,complexity,equipment,usable_in,is_default,media_type,media_ref,video_url')
        .eq('club_id', clubId)
        .contains('usable_in', [want])
        .order('name');
      if (error) throw error;
      rows = data || [];
    } catch (err) {
      console.error('[block-drawer] exercise library load failed:', err);
      rows = [];
    }
    const mapped = rows.map(e => ({
      id:          e.id,
      exercise_id: e.id,
      name:        e.name || 'Unnamed',
      region:      e.muscle_group || 'Other',
      equip:       e.equipment || 'None',
      type:        e.category || '',
      complexity:  e.complexity || '',
      custom:      !e.is_default,         // club-owned exercises (not the seeded defaults)
      media_type:  e.media_type || null,
      media_ref:   e.media_ref || null,
      video_url:   e.video_url || null,
      _thumb:      null                   // resolved below (image signed URL > YouTube thumb > null)
    }));
    await resolveThumbs(mapped);
    libCache[context] = mapped;
    LIB = mapped.slice();
    recomputeFilterOpts();
  }


  // ─── State ───
  let state = {
    open: false,
    mode: 'create',     // 'create' | 'edit'
    step: 1,            // 1=type, 2=exercises, 3=parameters
    context: 'rehab',   // 'rehab' | 'prev' | 'ip'
    dayLabel: '',
    type: null,         // type id
    region: 'All',
    equip: 'Any',
    customOnly: false,
    query: '',
    selected: [],       // exercise ids
    // Parameters
    blockName: '',
    duration: 20,
    owner: 'sc',        // role bucket: 'sc' | 'physio' | 'coach'
    ownerId: null,      // profiles.id of the staff member in charge (optional)
    ownerName: '',
    rpe: 7,
    notes: '',
    ctxField: '',       // contraindication (rehab) / target (prev) / goal (ip)
    sets: {},           // exId -> [{reps,time,load,tempo,rest,note}]
    freeNames: {},      // __free__N -> name string
    exExtras: {},       // exId -> {side, flag}
    exModes: {},        // exId -> 'reps' | 'time'
    freeCount: 0
  };

  // ─── Club staff (owner picker) ───
  // [{ id, name, owner }] where owner is the block's role bucket. Loaded once.
  let STAFF = null;
  const OWNER_FROM_BUCKET = { sc: 'sc', medical: 'physio', coach: 'coach' };
  async function ensureStaff() {
    if (STAFF) return STAFF;
    try {
      const clubId = await window.getClubId();
      const { data } = await window.sb.from('profiles')
        .select('id, full_name, first_name, last_name, role, club_role')
        .eq('club_id', clubId);
      STAFF = (data || [])
        .filter(p => (p.role || '').toLowerCase() !== 'player')
        .map(p => {
          const buckets = window.cmRoleBuckets ? window.cmRoleBuckets(p) : new Set([p.role]);
          // A dual-role member lands in the most hands-on area they cover.
          let owner = null;
          ['sc', 'medical', 'coach'].forEach(b => { if (!owner && buckets.has(b)) owner = OWNER_FROM_BUCKET[b]; });
          const name = (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '').trim();
          return owner && name ? { id: p.id, name, owner } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn('[block-drawer] staff load failed:', err);
      STAFF = [];
    }
    return STAFF;
  }

  // ─── Helpers ───
  const h = (tag, attrs, ...children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v != null) el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  };

  const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.id, t]));
  // Type names are already translated for the planners — reuse those keys.
  const typeLabel = t => _tt('individual_planner.type_' + t.id, t.label);
  const TYPE_COLOR = {
    warmup:'#10B981', myo:'#A78BFA', mob:'#06B6D4', act:'#22C55E',
    str:'#DC2626', plyo:'#F59E0B', skills:'#3B82F6', field:'#15803D',
    cond:'#EA580C', cool:'#64748B', assess:'#0EA5E9'
  };

  // ─── Build skeleton once ───
  let root, backdrop, drawer, headTitle, headSub, stepsEl, bodyEl, footEl;

  function build() {
    if (root) return;
    backdrop = h('div', { class: 'bd-backdrop', onclick: close });
    drawer = h('div', { class: 'bd-drawer', role: 'dialog', 'aria-modal': 'true' });

    const closeBtn = h('button', { class: 'close-btn', onclick: close, title: 'Close (Esc)' }, h('i', { class: 'ti ti-x' }));
    headTitle = h('h2', null, 'New block');
    headSub   = h('span', { class: 'sub' }, '—');
    const head = h('div', { class: 'bd-head' },
      h('div', { class: 'title' }, headTitle, headSub),
      h('div', { class: 'actions' }, closeBtn)
    );

    stepsEl = h('div', { class: 'bd-steps' });
    bodyEl  = h('div', { class: 'bd-body' });
    footEl  = h('div', { class: 'bd-foot' });

    drawer.appendChild(head);
    drawer.appendChild(stepsEl);
    drawer.appendChild(bodyEl);
    drawer.appendChild(footEl);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    root = drawer;

    document.addEventListener('keydown', (e) => {
      if (!state.open) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
    });
  }

  // ─── Renderers ───
  function renderSteps() {
    stepsEl.innerHTML = '';
    const labels = [_tt('block_drawer.step_type', 'Type'), _tt('block_drawer.exercises', 'Exercises'), _tt('block_drawer.step_params', 'Parameters')];
    labels.forEach((lbl, i) => {
      const n = i + 1;
      const cls = ['bd-step'];
      if (n < state.step) cls.push('is-done');
      if (n === state.step) cls.push('is-current');
      if (n > state.step && !canAdvanceTo(n)) cls.push('is-locked');
      const step = h('div', {
        class: cls.join(' '),
        onclick: () => { if (canAdvanceTo(n)) { state.step = n; renderAll(); } }
      },
        h('span', { class: 'num' }, String(n)),
        h('span', null, lbl)
      );
      stepsEl.appendChild(step);
      if (i < labels.length - 1) stepsEl.appendChild(h('div', { class: 'bd-step-rule' }));
    });
  }

  function canAdvanceTo(n) {
    if (n === 1) return true;
    if (n === 2) return !!state.type;
    if (n === 3) return !!state.type && state.selected.length > 0;
    return false;
  }

  function renderBody() {
    bodyEl.innerHTML = '';
    if (state.step === 1) bodyEl.appendChild(renderStep1());
    else if (state.step === 2) bodyEl.appendChild(renderStep2());
    else bodyEl.appendChild(renderStep3());
  }

  function renderStep1() {
    const grid = h('div', { class: 'bd-type-grid' });
    TYPES.forEach(t => {
      const card = h('button', {
        class: 'bd-type-card t-' + t.id + (state.type === t.id ? ' is-on' : ''),
        onclick: () => {
          state.type = t.id;
          // seed defaults
          const [exN, mins, rpe] = parseDefaults(t.defaults);
          state.duration = mins;
          state.rpe = rpe;
          state.blockName = typeLabel(t);
          renderAll();
        }
      },
        h('div', { class: 'head' },
          h('div', { class: 'glyph' }, h('i', { class: 'ti ' + t.icon })),
          h('h4', null, typeLabel(t))
        ),
        h('div', { class: 'defaults' }, t.defaults)
      );
      grid.appendChild(card);
    });
    return h('div', { class: 'bd-step-content' },
      h('div', { class: 'bd-section-h' }, _tt('block_drawer.pick_type', 'Block type · pick one')),
      grid
    );
  }

  function parseDefaults(str) {
    // "4 ex · 12 min · RPE 3"
    const m = str.match(/(\d+) ex.*?(\d+) min.*?RPE (\d+)/);
    if (!m) return [4, 20, 5];
    return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  }

  // ─── Step 2 · exercise picker ───
  // The list repaints on its own (refreshExList) instead of re-rendering the whole
  // step: rebuilding the body on every keystroke destroyed the search input, which
  // lost focus and swallowed the next letters.
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const exInitials = n => String(n || '—').split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '—';
  const THUMB_BOX = 'width:28px;height:28px;flex:0 0 auto;border-radius:6px;overflow:hidden;background:var(--cm-bg-soft);display:flex;align-items:center;justify-content:center';
  const initialsThumb = ex => h('span', { class: 'bd-ex-thumb', style: THUMB_BOX + ';font:600 10px/1 var(--cm-font-sans);color:var(--cm-fg-muted)' }, exInitials(ex.name));
  // Thumb with graceful degradation: YouTube's img.youtube.com is blocked by some
  // ad/privacy blockers and corporate DNS — retry on i.ytimg.com (same CDN, different
  // host), then fall back to the initials chip so the row never shows a broken image.
  const exThumb = ex => {
    if (!ex._thumb) return initialsThumb(ex);
    const box = h('span', { class: 'bd-ex-thumb', style: THUMB_BOX });
    const img = h('img', {
      src: ex._thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer',
      style: 'width:100%;height:100%;object-fit:cover;display:block'
    });
    img.addEventListener('error', () => {
      const alt = String(ex._thumb).replace('https://img.youtube.com/', 'https://i.ytimg.com/');
      if (alt !== img.getAttribute('src') && !img.dataset.retried) { img.dataset.retried = '1'; img.src = alt; return; }
      box.replaceWith(initialsThumb(ex));
    });
    box.appendChild(img);
    return box;
  };

  let _exListBox = null;   // live .bd-ex-list node, repainted in place

  function filteredLib() {
    const q = state.query.trim().toLowerCase();
    const out = LIB.filter(ex => {
      if (state.region !== 'All' && ex.type !== state.region) return false;   // state.region = category
      if (state.equip !== 'Any' && ex.equip !== state.equip) return false;
      if (state.customOnly && !ex.custom) return false;
      if (q && !((ex.name + ' ' + ex.region + ' ' + ex.type).toLowerCase().includes(q))) return false;
      return true;
    });
    // Preventive risk suggestion: float risk-relevant exercises to the top.
    if (state.riskMap) out.sort((a, b) => ((riskFor(b) ? riskFor(b).score : 0) - (riskFor(a) ? riskFor(a).score : 0)));
    return out;
  }

  function exListItems() {
    if (!libCache[state.context]) {
      return [h('div', { class: 'bd-empty' },
        h('i', { class: 'ti ti-loader-2' }),
        h('div', null, _tt('block_drawer.loading_library', 'Loading exercise library…')))];
    }
    const filtered = filteredLib();
    if (!filtered.length) {
      return [h('div', { class: 'bd-empty' },
        h('i', { class: 'ti ti-mood-empty' }),
        h('div', null, _tt('block_drawer.no_match', 'No exercises match these filters.')),
        h('div', { style: 'margin-top:6px' }, _tt('block_drawer.no_match_hint', 'Try widening the category or equipment.')))];
    }
    return filtered.map(ex => {
      const on = state.selected.includes(ex.id);
      return h('div', {
        class: 'bd-ex' + (on ? ' is-on' : '') + (ex.custom ? ' is-custom' : ''),
        onclick: () => {
          const i = state.selected.indexOf(ex.id);
          if (i >= 0) { state.selected.splice(i, 1); delete state.sets[ex.id]; }
          else {
            state.selected.push(ex.id);
            state.sets[ex.id] = seedSets(ex);        // sets belong to the plan, not the library
          }
          refreshExList(); renderFooter(); renderSteps();
        }
      },
        h('div', { class: 'check' }),
        exThumb(ex),
        h('div', { class: 'body' },
          h('div', { class: 'name' }, ex.name),
          (function () {
            const rk = riskFor(ex);
            return rk ? h('span', {
              class: 'bd-risk-chip',
              title: _tt('block_drawer.risk_suggested', 'Suggested — injury history'),
              style: 'display:inline-flex;align-items:center;gap:3px;margin-top:3px;font:600 9.5px/1 var(--cm-font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--cm-danger,#DC2626);background:rgba(220,38,38,.1);padding:3px 6px;border-radius:5px'
            }, '⚠ ' + rk.label) : null;
          })(),
          h('div', { class: 'meta' },
            h('span', null, ex.region),
            ex.equip ? h('span', { class: 'sep' }, '·') : null,
            ex.equip ? h('span', null, ex.equip) : null,
            ex.type ? h('span', { class: 'sep' }, '·') : null,
            ex.type ? h('span', null, cap(ex.type)) : null
          )
        ),
        ex.complexity ? h('div', { class: 'defaults' }, ex.complexity) : null
      );
    });
  }

  function refreshExList() {
    if (!_exListBox || !_exListBox.isConnected) return;
    _exListBox.innerHTML = '';
    exListItems().forEach(n => _exListBox.appendChild(n));
  }

  // ─── Step 2b · quick "new exercise" ───
  // Compact mirror of the Gym Library form: same table, same payload shape, minus
  // the optional attribute clouds, folders and AI auto-tag (those stay in the full
  // library screen). Needs lib/exercise-taxonomy.js — without it the button hides.
  const NEWEX_CATEGORIES = ['strength', 'power', 'olympic', 'mobility', 'activation', 'core', 'balance', 'conditioning', 'prehab', 'speed', 'cooldown'];
  const NEWEX_COMPLEXITY = [['Low', 'complexity_low'], ['Medium', 'complexity_medium'], ['High', 'complexity_high']];

  let CUSTOM_EQUIP = null;                       // club materials: slug -> label (loaded once)
  async function ensureCustomEquip() {
    if (CUSTOM_EQUIP) return CUSTOM_EQUIP;
    CUSTOM_EQUIP = {};
    try {
      const clubId = await window.getClubId();
      const { data } = await window.sb.from('club_equipment').select('slug,label').eq('club_id', clubId);
      (data || []).forEach(r => { CUSTOM_EQUIP[r.slug] = r.label; });
    } catch (_) {}
    return CUSTOM_EQUIP;
  }
  const equipLabel = t => (CUSTOM_EQUIP && CUSTOM_EQUIP[t]) || window.CMTaxonomy.label('equipment', t);

  const readCloud = box => Array.from(box.querySelectorAll('.bd-chip.is-on')).map(b => b.dataset.token);
  function chipCloud(dimension) {
    const box = h('div', { class: 'bd-chips' });
    (window.CMTaxonomy.LISTS[dimension] || []).forEach(it => box.appendChild(newexChip(it.token, it.label)));
    return box;
  }
  function newexChip(token, label) {
    const b = h('button', { type: 'button', class: 'bd-chip', 'data-token': token },
      label);
    b.addEventListener('click', () => b.classList.toggle('is-on'));
    return b;
  }
  // Equipment = taxonomy + the club's own materials + a "+" that adds one inline.
  function equipCloud() {
    const box = h('div', { class: 'bd-chips' });
    (window.CMTaxonomy.LISTS.equipment || []).forEach(it => box.appendChild(newexChip(it.token, it.label)));
    Object.keys(CUSTOM_EQUIP || {}).forEach(slug => box.appendChild(newexChip(slug, CUSTOM_EQUIP[slug])));
    const addBtn = h('button', { type: 'button', class: 'bd-chip-add', title: _tt('gym_library.add_material', 'Add material') },
      h('i', { class: 'ti ti-plus', style: 'font-size:13px' }));
    const input = h('input', { type: 'text', class: 'bd-chip-new', maxlength: '40', style: 'display:none', placeholder: _tt('gym_library.add_material', 'Add material') });
    addBtn.addEventListener('click', () => { input.style.display = ''; input.focus(); });
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') { input.value = ''; input.style.display = 'none'; return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      // Known material? Reuse its token instead of creating a duplicate.
      const taxoTok = window.CMTaxonomy.resolve('equipment', name);
      const existing = taxoTok || Object.keys(CUSTOM_EQUIP).find(s => CUSTOM_EQUIP[s].toLowerCase() === name.toLowerCase());
      if (existing) {
        const chip = box.querySelector(`.bd-chip[data-token="${existing}"]`);
        if (chip) chip.classList.add('is-on');
        input.value = ''; input.style.display = 'none';
        return;
      }
      const slug = 'c_' + name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      if (!slug || slug === 'c_') return;
      input.disabled = true;
      const clubId = await window.getClubId();
      const { error } = await window.sb.from('club_equipment').insert({ club_id: clubId, slug, label: name });
      input.disabled = false;
      if (error) { alert(_tt('gym_library.material_save_failed', 'Could not save material:') + ' ' + error.message); return; }
      CUSTOM_EQUIP[slug] = name;
      const chip = newexChip(slug, name);
      chip.classList.add('is-on');
      box.insertBefore(chip, addBtn);
      input.value = ''; input.style.display = 'none';
    });
    box.appendChild(addBtn);
    box.appendChild(input);
    return box;
  }

  async function openNewExercise() {
    await ensureCustomEquip();
    const T = window.CMTaxonomy;
    const wantCtx = CTX_USABLE[state.context] || 'rehab';
    const field = (labelNode, ctrl) => h('div', { class: 'bd-field' }, h('label', null, labelNode), ctrl);
    const reqLabel = (txt) => [txt, ' ', h('span', { class: 'bd-req' }, '*')];

    const nameIn = h('input', { type: 'text', maxlength: '120', placeholder: _tt('gym_library.name_ph', 'e.g. Back squat') });
    const purposeSel = h('select', null,
      h('option', { value: '' }, _tt('gym_library.select_ph', 'Select…')),
      ...T.PURPOSE.map(p => h('option', { value: p.token }, p.label))
    );
    const catSel = h('select', null, ...NEWEX_CATEGORIES.map(c =>
      h('option', { value: c }, _tt('gym_library.type_' + c, cap(c)))));
    const cxSel = h('select', null, ...NEWEX_COMPLEXITY.map(([v, k]) =>
      h('option', { value: v }, _tt('gym_library.' + k, v))));
    const muscleBox  = chipCloud('muscle_group');
    const patternBox = chipCloud('movement_pattern');
    const equipBox   = equipCloud();
    const descIn  = h('textarea', { rows: '2', maxlength: '600', placeholder: _tt('gym_library.description_ph', 'Coaching cues, execution notes…') });
    const videoIn = h('input', { type: 'text', maxlength: '500', placeholder: _tt('gym_library.video_url_ph', 'https://youtube.com/…') });
    const mediaIn = h('input', { type: 'file', accept: 'image/png,image/gif,image/jpeg,image/webp' });

    // Usable in — the module you're planning from is pre-ticked, plus Gym.
    const MODULES = [['gym', 'module_gym'], ['individual', 'module_individual'], ['rehab', 'module_rehab'], ['preventive', 'module_preventive']];
    const usableBox = h('div', { class: 'bd-usable' });
    const usableCbs = MODULES.map(([val, k]) => {
      const cb = h('input', { type: 'checkbox', value: val });
      cb.checked = (val === 'gym' || val === wantCtx);
      // The module you're planning from stays locked on: creating an exercise here
      // that this planner can't see would be a dead end.
      if (val === wantCtx) cb.disabled = true;
      usableBox.appendChild(h('label', null, cb, h('span', null, _tt('gym_library.' + k, cap(val)))));
      return cb;
    });

    const errEl = h('div', { class: 'bd-newex-err', style: 'display:none' });
    const cancelBtn = h('button', { class: 'cm-btn is-ghost is-sm', type: 'button' }, _tt('common.cancel', 'Cancel'));
    const saveBtn   = h('button', { class: 'cm-btn is-primary is-sm', type: 'button' }, _tt('common.create', 'Create'));
    const closeX    = h('button', { class: 'x', type: 'button' }, h('i', { class: 'ti ti-x' }));

    const box = h('div', { class: 'bd-newex' },
      h('div', { class: 'bd-newex-h' },
        h('h3', null, _tt('gym_library.new_exercise', 'New exercise')),
        closeX
      ),
      h('div', { class: 'bd-newex-b' },
        field(reqLabel(_tt('gym_library.field_name', 'Name')), nameIn),
        h('div', { class: 'bd-newex-g2' },
          field(reqLabel(_tt('gym_library.primary_purpose', 'Primary purpose')), purposeSel),
          field(_tt('gym_library.type', 'Type'), catSel)
        ),
        h('div', { class: 'bd-newex-g2' },
          field(_tt('gym_library.complexity', 'Complexity'), cxSel),
          field(_tt('gym_library.video_url', 'Video URL'), videoIn)
        ),
        field(reqLabel(_tt('gym_library.muscle_groups', 'Muscle groups')), muscleBox),
        field(_tt('gym_library.movement_patterns', 'Movement patterns'), patternBox),
        field(_tt('gym_library.equipment', 'Equipment'), equipBox),
        field(_tt('gym_library.usable_in', 'Usable in'), usableBox),
        field(_tt('gym_library.description', 'Description'), descIn),
        field(_tt('gym_library.image_gif', 'Image / GIF'), mediaIn),
        errEl
      ),
      h('div', { class: 'bd-newex-f' }, h('div', { class: 'spacer' }), cancelBtn, saveBtn)
    );
    const back = h('div', { class: 'bd-newex-back' }, box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) closeNewEx(); });
    // Esc closes this modal, not the drawer underneath.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeNewEx(); } };
    function closeNewEx() { document.removeEventListener('keydown', onKey, true); back.remove(); }
    document.addEventListener('keydown', onKey, true);
    closeX.addEventListener('click', closeNewEx);
    cancelBtn.addEventListener('click', closeNewEx);

    const fail = (msg) => { errEl.textContent = msg; errEl.style.display = ''; };

    saveBtn.addEventListener('click', async () => {
      errEl.style.display = 'none';
      const name = nameIn.value.trim();
      if (!name) { nameIn.focus(); return fail(_tt('block_drawer.name_required', 'Give the exercise a name.')); }
      const primaryPurpose = purposeSel.value;
      if (!primaryPurpose) return fail(_tt('gym_library.pick_primary_purpose', 'Pick a primary purpose.'));
      const muscleGroups = readCloud(muscleBox);
      if (!muscleGroups.length) return fail(_tt('gym_library.pick_muscle_group', 'Pick at least one muscle group.'));

      let usableIn = usableCbs.filter(cb => cb.checked).map(cb => cb.value);
      if (!usableIn.length) usableIn = ['gym'];
      const eqTags = readCloud(equipBox).length ? readCloud(equipBox) : ['bodyweight'];
      const patterns = readCloud(patternBox);
      const lbl = (dim, toks) => toks.map(t => dim === 'equipment' ? equipLabel(t) : T.label(dim, t));

      const clubId = await window.getClubId();
      const payload = {
        club_id: clubId,
        name,
        category: catSel.value,
        complexity: cxSel.value,
        usable_in: usableIn,
        description: descIn.value.trim() || null,
        video_url: videoIn.value.trim() || null,
        primary_purpose: primaryPurpose,
        purposes: [primaryPurpose],
        muscle_groups: muscleGroups,
        movement_patterns: patterns.length ? patterns : null,
        equipment_tags: eqTags,
        muscle_group: lbl('muscle_group', muscleGroups).join(' / ') || null,
        equipment: lbl('equipment', eqTags.filter(t => t !== 'bodyweight')).join(' / ') || null
      };

      saveBtn.disabled = true;
      saveBtn.textContent = _tt('gym_library.creating', 'Creating…');
      const { data: row, error } = await window.sb.from('gym_exercises').insert(payload).select('id').single();
      if (error) {
        saveBtn.disabled = false;
        saveBtn.textContent = _tt('common.create', 'Create');
        // _tt has no interpolation — the shared key carries a {msg} placeholder.
        return fail(_tt('gym_library.error_saving', 'Error saving exercise: {msg}').replace('{msg}', error.message));
      }

      // Media is best-effort: the exercise stays created even if the upload fails.
      let mediaRef = null;
      const file0 = mediaIn.files && mediaIn.files[0];
      if (file0) {
        try {
          const file = await window.cmShrinkImage(file0, { maxDim: 1200, maxBytes: 400 * 1024 });
          const ext = (file.name.split('.').pop() || 'png').toLowerCase();
          const path = `${clubId}/${row.id}-${Date.now().toString(36)}.${ext}`;
          const up = await window.sb.storage.from('gym-exercise-media').upload(path, file, { upsert: true, contentType: file.type, cacheControl: window.CM_CACHE_IMMUTABLE });
          if (!up.error) {
            await window.sb.from('gym_exercises').update({ media_type: 'image', media_ref: path }).eq('id', row.id).eq('club_id', clubId);
            mediaRef = path;
          }
        } catch (_) {}
      }

      const mapped = {
        id: row.id, exercise_id: row.id, name,
        region: payload.muscle_group || 'Other',
        equip: payload.equipment || 'None',
        type: payload.category || '',
        complexity: payload.complexity || '',
        custom: true,
        media_type: mediaRef ? 'image' : null,
        media_ref: mediaRef,
        video_url: payload.video_url,
        _thumb: null
      };
      await resolveThumbs([mapped]);

      // Other contexts refetch on next open; this one gets the row grafted in.
      Object.keys(libCache).forEach(c => { if (c !== state.context) delete libCache[c]; });
      if (usableIn.includes(wantCtx) && libCache[state.context]) {
        libCache[state.context].unshift(mapped);
        LIB = libCache[state.context].slice();
        recomputeFilterOpts();
        // Pre-select it and clear the filters that would hide it from the list.
        state.selected.push(mapped.id);
        state.sets[mapped.id] = seedSets(mapped);
        state.query = ''; state.region = 'All'; state.equip = 'Any';
      }
      closeNewEx();
      renderAll();
    });

    document.body.appendChild(back);
    setTimeout(() => { try { nameIn.focus(); } catch (_) {} }, 30);
  }

  function renderStep2() {
    // filters — chips update their own state so the search box keeps focus/caret
    const chipRow = (values, get, set) => {
      const row = h('div', { class: 'chips' });
      values.forEach(v => {
        const chip = h('button', {
          class: 'bd-filter-chip' + (get() === v ? ' is-on' : ''),
          onclick: () => {
            set(v);
            Array.from(row.children).forEach(c => c.classList.toggle('is-on', c === chip));
            refreshExList();
          }
        }, v === 'All' ? _tt('block_drawer.all', 'All') : v === 'Any' ? _tt('block_drawer.any', 'Any') : cap(v));
        row.appendChild(chip);
      });
      return row;
    };
    const regionChips = chipRow(REGIONS, () => state.region, v => { state.region = v; });
    const equipChips  = chipRow(EQUIPS,  () => state.equip,  v => { state.equip  = v; });
    const customTog = h('div', { class: 'bd-toggle-row' },
      h('span', { class: 'lbl' }, _tt('block_drawer.club_custom_only', 'Club custom only')),
      h('div', { class: 'bd-toggle' + (state.customOnly ? ' is-on' : '') })
    );
    customTog.addEventListener('click', () => {
      state.customOnly = !state.customOnly;
      customTog.querySelector('.bd-toggle').classList.toggle('is-on', state.customOnly);
      refreshExList();
    });
    const filters = h('div', { class: 'bd-filters' },
      h('div', null, h('div', { class: 'group-l' }, _tt('block_drawer.category', 'Category')), regionChips),
      h('div', null, h('div', { class: 'group-l' }, _tt('block_drawer.equipment', 'Equipment')), equipChips),
      h('div', null, h('div', { class: 'group-l' }, _tt('block_drawer.source', 'Source')), customTog)
    );

    _exListBox = h('div', { class: 'bd-ex-list' }, ...exListItems());
    const searchInput = h('input', {
      type: 'text',
      placeholder: _tt('block_drawer.search_exercises', 'Search exercises…'),
      value: state.query,
      oninput: (e) => { state.query = e.target.value; refreshExList(); }
    });
    // "New exercise" writes to the same gym_exercises table the library reads —
    // needs the taxonomy lists, so it only shows where that script is loaded.
    const newExBtn = window.CMTaxonomy ? h('button', {
      class: 'bd-newex-btn', type: 'button',
      title: _tt('gym_library.new_exercise', 'New exercise'),
      onclick: () => { openNewExercise(); }
    }, h('i', { class: 'ti ti-plus' }), _tt('gym_library.new_exercise', 'New exercise')) : null;
    const list = h('div', { class: 'bd-list-col' },
      h('div', { class: 'bd-search-row' },
        h('div', { class: 'bd-search' },
          h('i', { class: 'ti ti-search' }),
          searchInput,
          h('span', { class: 'cm-kbd' }, '/')
        ),
        newExBtn
      ),
      _exListBox
    );
    setTimeout(() => { try { searchInput.focus(); } catch (_) {} }, 30);

    return h('div', { class: 'bd-step-content' },
      h('div', { class: 'bd-pick' }, filters, list)
    );
  }

  function seedSets(/* ex */) {
    // The real library has no sets/reps — those are block parameters.
    // Seed 3 blank rows the coach fills in.
    return [blankSet(), blankSet(), blankSet()];
  }

  // ─── Step 3 · block parameters ───
  // Prescription mode per exercise: reps (sets × reps) or time (sets × duration).
  const EX_MODES = [
    { id: 'reps', label: () => _tt('block_drawer.mode_reps', 'Reps'), icon: 'ti-repeat' },
    { id: 'time', label: () => _tt('block_drawer.mode_time', 'Time'), icon: 'ti-stopwatch' }
  ];
  const exMode = exId => state.exModes[exId] || 'reps';

  function renderStep3() {
    const ctxLabel = state.context === 'rehab' ? _tt('block_drawer.contraindications', 'Contraindications')
                  : state.context === 'prev'  ? _tt('block_drawer.targets_risk', 'Targets risk flag')
                  : _tt('block_drawer.goal_target', 'Goal · target');
    const ctxPh = state.context === 'rehab' ? _tt('block_drawer.ph_contra', 'e.g. Avoid deep ROM')
                : state.context === 'prev'  ? _tt('block_drawer.ph_risk', 'e.g. Hamstring')
                : _tt('block_drawer.ph_goal', 'e.g. 80% 1RM · 0.45 m/s');

    const durField = h('div', { class: 'bd-field' },
      h('label', null, _tt('block_drawer.duration', 'Duration')),
      h('div', { class: 'bd-input-suffix' },
        h('input', {
          type: 'number', value: state.duration, min: '1', step: '1',
          oninput: (e) => { state.duration = parseInt(e.target.value) || 0; renderFooter(); }
        }),
        h('span', null, _tt('block_drawer.min', 'min'))
      )
    );

    // RPE 1–10 as a scale of buttons — faster than typing and it reads as an intensity.
    const rpeScale = h('div', { class: 'bd-rpe-scale' });
    for (let n = 1; n <= 10; n++) {
      const b = h('button', {
        class: 'bd-rpe-dot' + (state.rpe === n ? ' is-on' : ''),
        'data-lvl': n <= 3 ? 'low' : n <= 6 ? 'mod' : n <= 8 ? 'high' : 'max',
        title: 'RPE ' + n,
        onclick: () => {
          state.rpe = n;
          Array.from(rpeScale.children).forEach(c => c.classList.toggle('is-on', c === b));
          renderFooter();
        }
      }, String(n));
      rpeScale.appendChild(b);
    }
    const rpeField = h('div', { class: 'bd-field' },
      h('label', null, _tt('block_drawer.rpe_target', 'RPE target')),
      rpeScale
    );

    const blockHead = h('div', { class: 'bd-block-h' },
      h('div', { class: 'bd-field with-stripe', style: '--bd-stripe:' + TYPE_COLOR[state.type] },
        h('label', null, _tt('block_drawer.block_name', 'Block name')),
        h('input', {
          type: 'text',
          placeholder: TYPE_MAP[state.type] ? typeLabel(TYPE_MAP[state.type]) : '',
          value: state.blockName,
          oninput: (e) => { state.blockName = e.target.value; }
        })
      ),
      durField,
      h('div', { class: 'bd-field' },
        h('label', null, _tt('block_drawer.owner', 'Owner')),
        ownerSelect()
      )
    );

    const ctxRow = h('div', { class: 'bd-context-row' },
      h('div', { class: 'bd-field' },
        h('label', null, ctxLabel),
        h('input', {
          type: 'text', placeholder: ctxPh, value: state.ctxField,
          oninput: (e) => { state.ctxField = e.target.value; }
        })
      ),
      h('div', { class: 'bd-field' },
        h('label', null, _tt('block_drawer.notes_athlete', 'Notes for athlete')),
        h('input', {
          type: 'text', placeholder: _tt('block_drawer.ph_notes', 'Optional cue / instruction'), value: state.notes,
          oninput: (e) => { state.notes = e.target.value; }
        })
      )
    );

    const exCards = state.selected.map((exId, exIdx) => renderExCard(exId, exIdx));

    return h('div', { class: 'bd-step-content' },
      blockHead,
      h('div', { class: 'bd-rpe-row' }, rpeField),
      ctxRow,
      h('div', { class: 'bd-section-h' }, _tt('block_drawer.exercises', 'Exercises') + ' · ' + state.selected.length),
      ...exCards,
      h('button', {
        class: 'bd-add-ex',
        onclick: () => { state.step = 2; renderAll(); }
      }, h('i', { class: 'ti ti-plus' }), ' ' + _tt('block_drawer.add_from_library', 'Add from library')),
      h('button', {
        class: 'bd-add-ex',
        onclick: () => {
          const fid = '__free__' + state.freeCount++;
          state.selected.push(fid);
          state.freeNames[fid] = '';
          state.exExtras[fid]  = { side: '', flag: '' };
          state.exModes[fid]   = 'reps';
          state.sets[fid]      = [blankSet()];
          renderBody(); renderFooter();
        }
      }, h('i', { class: 'ti ti-pencil' }), ' ' + _tt('block_drawer.add_free_text', 'Add free-text exercise'))
    );
  }

  // ── Owner: real club staff, grouped by area ──────────────────────────────────
  // Falls back to plain role options when the staff list can't be read.
  function ownerSelect() {
    const sel = h('select', {
      onchange: (e) => {
        const opt = e.target.selectedOptions[0];
        const v = e.target.value;
        state.ownerId   = (v && v.indexOf('role:') !== 0) ? v : null;   // 'role:*' = role-only fallback
        state.owner     = (opt && opt.dataset.owner) || 'sc';
        state.ownerName = (opt && opt.dataset.name) || '';
      }
    });
    const GROUPS = [
      { key: 'sc',     label: _tt('block_drawer.owner_sc', 'S&C') },
      { key: 'physio', label: _tt('block_drawer.owner_physio', 'Physio / medical') },
      { key: 'coach',  label: _tt('block_drawer.owner_coach', 'Coaching staff') }
    ];
    sel.appendChild(h('option', { value: '', 'data-owner': state.owner || 'sc', 'data-name': '' },
      '— ' + _tt('block_drawer.owner_unassigned', 'Unassigned') + ' —'));
    if (STAFF && STAFF.length) {
      GROUPS.forEach(g => {
        const people = STAFF.filter(p => p.owner === g.key);
        if (!people.length) return;
        const og = h('optgroup', { label: g.label });
        people.forEach(p => og.appendChild(h('option', { value: p.id, 'data-owner': p.owner, 'data-name': p.name }, p.name)));
        sel.appendChild(og);
      });
      sel.value = state.ownerId && STAFF.some(p => p.id === state.ownerId) ? state.ownerId : '';
    } else {
      // No staff list yet (still loading, or no permission): plain role choices.
      GROUPS.forEach(g => sel.appendChild(h('option', { value: 'role:' + g.key, 'data-owner': g.key, 'data-name': '' }, g.label)));
      sel.value = 'role:' + (state.owner || 'sc');
    }
    return sel;
  }

  const blankSet = () => ({ reps: '', time: '', load: '', tempo: '', rest: '', note: '' });

  function renderExCard(exId, exIdx) {
    const isFree = exId.startsWith('__free__');
    const ex     = isFree ? null : LIB.find(e => e.id === exId);
    const sets   = state.sets[exId] || (state.sets[exId] = [blankSet()]);
    const extras = state.exExtras[exId] || (state.exExtras[exId] = { side: '', flag: '' });
    const mode   = exMode(exId);

    const nameEl = isFree
      ? h('input', {
          type: 'text', class: 'bd-free-name', placeholder: _tt('block_drawer.ph_ex_name', 'Exercise name…'),
          value: state.freeNames[exId] || '',
          oninput: (e) => { state.freeNames[exId] = e.target.value; }
        })
      : document.createTextNode(ex ? ex.name : exId);

    // Prescription mode switch — repaints just this card, so the page keeps its scroll.
    const modeSeg = h('div', { class: 'bd-mode-seg' });
    EX_MODES.forEach(m => {
      modeSeg.appendChild(h('button', {
        class: 'bd-mode-btn' + (mode === m.id ? ' is-on' : ''),
        onclick: () => {
          if (exMode(exId) === m.id) return;
          state.exModes[exId] = m.id;
          const fresh = renderExCard(exId, exIdx);
          card.replaceWith(fresh);
        }
      }, h('i', { class: 'ti ' + m.icon }), m.label()));
    });

    const head = h('div', { class: 'bd-ex-card-h' },
      h('div', { class: 'n' }, String(exIdx + 1)),
      h('div', { class: 'name' }, nameEl),
      modeSeg,
      isFree ? null : h('button', { class: 'ic', title: _tt('block_drawer.duplicate', 'Duplicate'), onclick: () => duplicateEx(exId) }, h('i', { class: 'ti ti-copy' })),
      h('button', { class: 'ic', title: _tt('block_drawer.remove', 'Remove'), onclick: () => removeEx(exId) }, h('i', { class: 'ti ti-trash' }))
    );

    // Side as chips (was free text) + flag note.
    const SIDES = [
      { v: '',      l: _tt('block_drawer.side_none', '—') },
      { v: 'L',     l: _tt('block_drawer.side_l', 'L') },
      { v: 'R',     l: _tt('block_drawer.side_r', 'R') },
      { v: 'Both',  l: _tt('block_drawer.side_both', 'Both') }
    ];
    const sideRow = h('div', { class: 'bd-side-chips' });
    SIDES.forEach(s => {
      const b = h('button', {
        class: 'bd-side-chip' + ((extras.side || '') === s.v ? ' is-on' : ''),
        onclick: () => {
          extras.side = s.v;
          Array.from(sideRow.children).forEach(c => c.classList.toggle('is-on', c === b));
        }
      }, s.l);
      sideRow.appendChild(b);
    });
    const extrasRow = h('div', { class: 'bd-ex-extras' },
      h('div', { class: 'bd-field-mini' }, h('label', null, _tt('block_drawer.side', 'Side')), sideRow),
      h('div', { class: 'bd-field-mini is-grow' },
        h('label', null, _tt('block_drawer.flag', 'Flag')),
        h('input', { type: 'text', placeholder: _tt('block_drawer.ph_flag', 'e.g. Avoid lockout'), value: extras.flag,
          oninput: (e) => { extras.flag = e.target.value; } })
      )
    );

    // Columns per mode: reps → reps/load/tempo/rest, time → time/load/rest.
    const COLS = mode === 'time'
      ? [ { k: 'time', l: _tt('block_drawer.col_time', 'Time'),  ph: '30 s' },
          { k: 'load', l: _tt('block_drawer.col_load', 'Load'),  ph: '10 kg' },
          { k: 'rest', l: _tt('block_drawer.col_rest', 'Rest'),  ph: '60 s' } ]
      : [ { k: 'reps',  l: _tt('block_drawer.col_reps', 'Reps'),  ph: '10' },
          { k: 'load',  l: _tt('block_drawer.col_load', 'Load'),  ph: '60 kg · 70%' },
          { k: 'tempo', l: _tt('block_drawer.col_tempo', 'Tempo'), ph: '3-1-1' },
          { k: 'rest',  l: _tt('block_drawer.col_rest', 'Rest'),  ph: '90 s' } ];

    const tbl = h('table', { class: 'bd-sets-tbl' },
      h('thead', null,
        h('tr', null,
          h('th', { class: 'set-n' }, _tt('block_drawer.col_set', 'Set')),
          ...COLS.map(c => h('th', null, c.l)),
          h('th', { class: 'note-col' }, _tt('block_drawer.col_note', 'Note')),
          h('th', { style: 'width:58px' })
        )
      ),
      h('tbody', null,
        ...sets.map((s, i) => h('tr', null,
          h('td', { class: 'set-n' }, h('div', { class: 'set-n-badge' }, String(i + 1))),
          ...COLS.map(c => h('td', null, h('input', {
            value: s[c.k] || '', placeholder: c.ph,
            oninput: (e) => { s[c.k] = e.target.value; }
          }))),
          h('td', { class: 'note-col' }, h('input', {
            value: s.note || '', placeholder: _tt('block_drawer.ph_set_note', 'optional'),
            oninput: (e) => { s.note = e.target.value; }
          })),
          h('td', { style: 'white-space:nowrap' },
            h('button', { class: 'rm-row', title: _tt('block_drawer.copy_down', 'Copy this set to the ones below'),
              style: i === sets.length - 1 ? 'opacity:.3;pointer-events:none' : '',
              onclick: () => {
                for (let j = i + 1; j < sets.length; j++) Object.assign(sets[j], s);
                card.replaceWith(renderExCard(exId, exIdx));
              }
            }, h('i', { class: 'ti ti-arrow-bar-to-down' })),
            h('button', { class: 'rm-row', title: _tt('block_drawer.remove_set', 'Remove set'),
              onclick: () => { sets.splice(i, 1); card.replaceWith(renderExCard(exId, exIdx)); renderFooter(); }
            }, h('i', { class: 'ti ti-x' }))
          )
        ))
      )
    );
    const addSet = h('button', {
      class: 'bd-add-set',
      onclick: () => {
        const last = sets[sets.length - 1];
        sets.push(last ? Object.assign(blankSet(), last, { note: '' }) : blankSet());   // repeat the last set
        card.replaceWith(renderExCard(exId, exIdx));
        renderFooter();
      }
    }, h('i', { class: 'ti ti-plus' }), ' ' + _tt('block_drawer.add_set', 'Add set'));

    const card = h('div', { class: 'bd-ex-card' }, head, extrasRow, tbl, addSet);
    return card;
  }

  function duplicateEx(exId) {
    // append the same ex again with the same sets pattern
    const ex = LIB.find(e => e.id === exId);
    if (!ex) return;
    // give a unique key for the second instance — use exId + index
    const newKey = exId + '__' + (state.selected.filter(s => s.startsWith(exId)).length);
    state.selected.push(newKey);
    state.sets[newKey] = JSON.parse(JSON.stringify(state.sets[exId] || seedSets(ex)));
    state.exModes[newKey] = exMode(exId);
    state.exExtras[newKey] = { ...(state.exExtras[exId] || { side: '', flag: '' }) };
    // map the new key back to the original entry for lookup
    LIB.push({ ...ex, id: newKey });
    renderBody(); renderFooter();
  }
  function removeEx(exId) {
    const i = state.selected.indexOf(exId);
    if (i < 0) return;
    state.selected.splice(i, 1);
    delete state.sets[exId];
    delete state.exModes[exId];
    delete state.exExtras[exId];
    renderBody(); renderFooter();
  }

  // A set row counts only once the coach has actually filled something in.
  const filledSets = arr => (arr || []).filter(s => Object.keys(s).some(k => String(s[k] || '').trim()));

  function computeAU() {
    // Simple model: duration (min) * RPE, plus 4 per filled set as a small bias.
    let setCount = 0;
    Object.values(state.sets).forEach(arr => setCount += filledSets(arr).length);
    return Math.round(state.duration * state.rpe * 1.0 + setCount * 4);
  }

  function renderFooter() {
    footEl.innerHTML = '';
    const au = computeAU();
    footEl.appendChild(h('div', { class: 'stat' }, h('strong', null, String(state.duration)), 'min'));
    footEl.appendChild(h('div', { class: 'stat-sep' }));
    footEl.appendChild(h('div', { class: 'stat' }, h('strong', null, String(state.selected.length)), 'ex'));
    footEl.appendChild(h('div', { class: 'stat-sep' }));
    footEl.appendChild(h('div', { class: 'stat' }, h('strong', null, String(au)), 'AU'));
    footEl.appendChild(h('div', { class: 'stat-sep' }));
    footEl.appendChild(h('div', { class: 'stat' }, h('strong', null, 'RPE ' + state.rpe), 'target'));
    footEl.appendChild(h('div', { class: 'spacer' }));

    const cancel = h('button', { class: 'cm-btn is-ghost', onclick: close }, _tt('block_drawer.cancel', 'Cancel'));
    footEl.appendChild(cancel);

    // Delete action — only in edit mode at any step
    if (state.mode === 'edit') {
      const del = h('button', {
        class: 'cm-btn is-ghost',
        style: 'color:#B91C1C',
        onclick: doDelete
      }, h('i', { class: 'ti ti-trash', style: 'margin-right:5px' }), _tt('block_drawer.delete', 'Delete'));
      footEl.appendChild(del);
    }

    if (state.step < 3) {
      const next = h('button', {
        class: 'cm-btn is-primary' + (canAdvanceTo(state.step + 1) ? '' : ' is-disabled'),
        disabled: canAdvanceTo(state.step + 1) ? null : '',
        onclick: () => { if (canAdvanceTo(state.step + 1)) { state.step++; renderAll(); } }
      }, _tt('block_drawer.next', 'Next'), h('i', { class: 'ti ti-arrow-right', style: 'margin-left:6px' }));
      footEl.appendChild(next);
    } else {
      const saveLabel = state.mode === 'edit' ? _tt('block_drawer.save_changes', 'Save changes') : _tt('block_drawer.add_block', 'Add block');
      const save = h('button', {
        class: 'cm-btn is-primary',
        onclick: doSave
      }, h('i', { class: 'ti ti-device-floppy', style: 'margin-right:6px' }), saveLabel);
      footEl.appendChild(save);
    }
  }

  function renderAll() {
    renderSteps(); renderBody(); renderFooter();
  }

  // ─── Open / Close / Save ───
  async function open(opts) {
    build();
    opts = opts || {};
    const existing = opts.existing;
    const ctx = opts.context || 'rehab';
    // Preventive plans prioritize risk-relevant exercises; zones come from the caller
    // (opts.riskZones) or the planner global. Other contexts stay unprioritized.
    const riskZones = opts.riskZones || (ctx === 'prev' ? window.__rpRiskZones : null);
    state = {
      open: true,
      mode: existing ? 'edit' : 'create',
      step: existing ? 3 : 1,
      context: ctx,
      riskMap: buildRiskMap(riskZones),
      dayLabel: opts.day || (existing && existing.day) || '',
      dayDate:  opts.dayDate || '',
      type: existing ? existing.type : null,
      region: 'All', equip: 'Any', customOnly: false, query: '',
      selected: existing && existing.exerciseIds ? existing.exerciseIds.slice() : [],
      blockName: existing ? (existing.name || '') : '',
      duration: existing ? (existing.duration || 20) : 20,
      owner: existing ? (existing.owner || 'sc') : 'sc',
      ownerId: existing ? (existing.ownerId || null) : null,
      ownerName: existing ? (existing.ownerName || '') : '',
      rpe: existing ? (existing.rpe || 7) : 7,
      notes: existing ? (existing.notes || '') : '',
      ctxField: existing ? (existing.ctxField || '') : '',
      sets: {},
      freeNames: {}, exExtras: {}, exModes: {}, freeCount: 0
    };
    // Seed from DB exercises jsonb (edit flow — free-text). Does not need the library.
    if (existing?.exercises?.length) {
      existing.exercises.forEach((ex, i) => {
        const fid = '__free__' + i;
        state.freeCount = Math.max(state.freeCount, i + 1);
        state.selected.push(fid);
        state.freeNames[fid] = ex.name || '';
        state.exExtras[fid]  = { side: ex.side || '', flag: ex.flag || '' };
        state.exModes[fid]   = ex.mode === 'time' ? 'time' : 'reps';
        state.sets[fid]      = (Array.isArray(ex.sets) ? ex.sets : []).map(s => Object.assign(blankSet(), s));
      });
    }
    headTitle.textContent = state.mode === 'edit' ? _tt('block_drawer.edit_block', 'Edit block') : _tt('block_drawer.new_block', 'New block');
    headSub.textContent = (state.dayLabel ? state.dayLabel + ' · ' : '') +
      ({ rehab: _tt('block_drawer.ctx_rehab', 'Rehab plan'), prev: _tt('block_drawer.ctx_prev', 'Preventive plan'), ip: _tt('block_drawer.ctx_ip', 'Individual S&C') }[state.context] || '');
    renderAll();
    setTimeout(() => {
      backdrop.classList.add('is-open');
      drawer.classList.add('is-open');
    }, 0);

    // Load the shared library for this context + the club staff (owner picker),
    // then seed library-linked sets and refresh.
    await Promise.all([ensureLibrary(state.context), ensureStaff()]);
    if (!state.open) return;
    if (existing && existing.exerciseIds) {
      existing.exerciseIds.forEach(exId => {
        const ex = LIB.find(e => e.id === exId);
        if (ex && !state.sets[exId]) state.sets[exId] = (existing.sets && existing.sets[exId]) || seedSets(ex);
      });
    }
    renderAll();
  }

  function close() {
    if (!root) return;
    state.open = false;
    backdrop.classList.remove('is-open');
    drawer.classList.remove('is-open');
  }

  function doSave() {
    let totalSets = 0;
    state.selected.forEach(exId => { totalSets += filledSets(state.sets[exId]).length; });

    const payload = {
      mode:         state.mode,
      type:         state.type,
      name:         state.blockName || (TYPE_MAP[state.type] ? typeLabel(TYPE_MAP[state.type]) : 'Block'),
      duration:     state.duration,
      rpe:          state.rpe,
      owner:        state.owner,
      owner_id:     state.ownerId || null,     // profiles.id — ignored by callers that don't store it
      owner_name:   state.ownerName || '',
      notes:        state.notes,
      ctxField:     state.ctxField,
      context_note: state.ctxField,
      volume_sets:  totalSets,
      au:           computeAU(),
      dayDate:      state.dayDate,
      exercises: state.selected.map(exId => {
        const isFree = exId.startsWith('__free__');
        const ex     = isFree ? null : LIB.find(e => e.id === exId);
        const extras = state.exExtras[exId] || {};
        // Drop set rows the coach left completely empty.
        const sets = filledSets(state.sets[exId]);
        return {
          name: isFree ? (state.freeNames[exId] || '') : (ex?.name || exId),
          exercise_id: isFree ? null : (ex?.exercise_id || null),  // linked to gym_exercises
          mode: exMode(exId),
          sets,
          side: extras.side  || null,
          flag: extras.flag  || null
        };
      })
    };
    window.dispatchEvent(new CustomEvent('blockdrawer:save', { detail: payload }));
    close();
  }

  function doDelete() {
    if (!confirm(_tt('block_drawer.delete_confirm', 'Delete this block? This cannot be undone.'))) return;
    window.dispatchEvent(new CustomEvent('blockdrawer:delete', {
      detail: { type: state.type, name: state.blockName }
    }));
    close();
  }

  // ─── Wire up: auto-install on .rp-add-block clicks ───
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.rp-add-block');
    if (!btn) return;
    e.preventDefault();
    // Infer context from current module
    let ctx = 'rehab';
    if (document.body.dataset.rpMode === 'prev') ctx = 'prev';
    if (window.__ipApi) ctx = 'ip';
    // Try to grab the day from the parent .rp-day header
    const dayCard = btn.closest('.rp-day');
    let day = '';
    if (dayCard) {
      const dow = dayCard.querySelector('.dow');
      const dom = dayCard.querySelector('.dom');
      if (dow && dom) day = dow.textContent.replace(/·.*$/,'').trim() + ', ' + dom.textContent;
    }
    open({ context: ctx, day, dayDate: dayCard?.dataset.date || '' });
  });

  // ─── Public API ───
  window.openBlockDrawer = open;

})();
