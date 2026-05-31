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

  // ─── Data: shared exercise library (region / equipment / patterns) ───
  const LIB = [
    { id: 'nord',  name: 'Nordic hamstring lower', region: 'Hamstring', equip: 'Bodyweight', custom: false, sets: 4, reps: 6,    load: 'BW',     tempo: '4-0-1', rest: '2:00' },
    { id: 'rdl',   name: 'Single-leg RDL',         region: 'Hamstring', equip: 'KB',         custom: false, sets: 4, reps: 8,    load: '20kg',   tempo: '3-1-1', rest: '1:30' },
    { id: 'cop',   name: 'Copenhagen adductor',    region: 'Adductor',  equip: 'Bodyweight', custom: true,  sets: 3, reps: 8,    load: 'BW',     tempo: '5-0-1', rest: '1:30' },
    { id: 'hipt',  name: 'Hip thrust',             region: 'Glute',     equip: 'Barbell',    custom: false, sets: 5, reps: 5,    load: '60% 1RM',tempo: '2-1-1', rest: '2:30' },
    { id: 'sqt',   name: 'Back squat',             region: 'Quad',      equip: 'Barbell',    custom: false, sets: 5, reps: 5,    load: '80% 1RM',tempo: '3-0-1', rest: '3:00' },
    { id: 'cossk', name: 'Cossack squat',          region: 'Adductor',  equip: 'KB',         custom: false, sets: 3, reps: 6,    load: '16kg',   tempo: '3-1-1', rest: '1:30' },
    { id: 'bench', name: 'Bench press',            region: 'Push',      equip: 'Barbell',    custom: false, sets: 5, reps: 5,    load: '75% 1RM',tempo: '2-1-1', rest: '2:30' },
    { id: 'row',   name: 'Bent-over row',          region: 'Pull',      equip: 'Barbell',    custom: false, sets: 4, reps: 8,    load: '70% 1RM',tempo: '2-1-1', rest: '2:00' },
    { id: 'pall',  name: 'Pallof press',           region: 'Core',      equip: 'Cable',      custom: false, sets: 3, reps: 12,   load: '10kg',   tempo: '2-2-1', rest: '1:00' },
    { id: 'plk',   name: 'Side plank w/ adduction',region: 'Core',      equip: 'Bodyweight', custom: false, sets: 3, reps: '40s',load: 'BW',     tempo: '—',     rest: '1:00' },
    { id: 'hop',   name: 'Hop & stick',            region: 'Power',     equip: 'Bodyweight', custom: false, sets: 4, reps: 4,    load: 'BW',     tempo: '—',     rest: '1:30' },
    { id: 'sled',  name: 'Sled push',              region: 'Power',     equip: 'Sled',       custom: false, sets: 4, reps: '15m',load: '40 kg',  tempo: '—',     rest: '2:00' },
    { id: 'shut',  name: 'Shuttle 20m',            region: 'Cond.',     equip: 'None',       custom: false, sets: 4, reps: 6,    load: '—',      tempo: '—',     rest: '1:30' },
    { id: 'fbow',  name: 'Foam roll · posterior chain', region: 'Mobility', equip: 'Roller', custom: false, sets: 1, reps: '3 min',load: '—',    tempo: '—',     rest: '0:30' },
    { id: 'iso',   name: 'Hamstring isometric hold (90°)', region: 'Hamstring', equip: 'Bodyweight', custom: true, sets: 3, reps: '30s', load: 'BW', tempo: '—', rest: '1:00' },
    { id: 'hsw',   name: 'Hamstring switch · single-leg', region: 'Hamstring', equip: 'Cable', custom: true, sets: 3, reps: 10, load: '15 kg', tempo: '3-0-1', rest: '1:30' },
    { id: 'int1515', name: '15:15 intervals · 90% MAS', region: 'Cond.', equip: 'None', custom: false, sets: 8, reps: '15s', load: '5.4 m/s', tempo: '—', rest: '15s' },
    { id: 'tempo', name: 'Tempo continuous · 70% HRmax', region: 'Cond.', equip: 'None', custom: false, sets: 1, reps: '12 min', load: '140 bpm', tempo: '—', rest: '—' }
  ];
  const REGIONS = ['All','Hamstring','Adductor','Glute','Quad','Core','Push','Pull','Power','Cond.','Mobility'];
  const EQUIPS  = ['Any','Barbell','KB','Bodyweight','Cable','Sled','Roller'];

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
    owner: 'sc',
    rpe: 7,
    notes: '',
    ctxField: '',       // contraindication (rehab) / target (prev) / goal (ip)
    sets: {}            // exId -> [{reps,load,tempo,rest}]
  };

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
    const labels = ['Type', 'Exercises', 'Parameters'];
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
          state.blockName = t.label;
          renderAll();
        }
      },
        h('div', { class: 'head' },
          h('div', { class: 'glyph' }, h('i', { class: 'ti ' + t.icon })),
          h('h4', null, t.label)
        ),
        h('div', { class: 'defaults' }, t.defaults)
      );
      grid.appendChild(card);
    });
    return h('div', { class: 'bd-step-content' },
      h('div', { class: 'bd-section-h' }, 'Block type · pick one'),
      grid
    );
  }

  function parseDefaults(str) {
    // "4 ex · 12 min · RPE 3"
    const m = str.match(/(\d+) ex.*?(\d+) min.*?RPE (\d+)/);
    if (!m) return [4, 20, 5];
    return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  }

  function renderStep2() {
    // filters
    const regionChips = REGIONS.map(r => h('button', {
      class: 'bd-filter-chip' + (state.region === r ? ' is-on' : ''),
      onclick: () => { state.region = r; renderBody(); renderFooter(); }
    }, r));
    const equipChips = EQUIPS.map(eq => h('button', {
      class: 'bd-filter-chip' + (state.equip === eq ? ' is-on' : ''),
      onclick: () => { state.equip = eq; renderBody(); renderFooter(); }
    }, eq));
    const customTog = h('div', { class: 'bd-toggle-row' },
      h('span', { class: 'lbl' }, 'Custom by physio only'),
      h('div', {
        class: 'bd-toggle' + (state.customOnly ? ' is-on' : ''),
        onclick: () => { state.customOnly = !state.customOnly; renderBody(); }
      })
    );
    const filters = h('div', { class: 'bd-filters' },
      h('div', null, h('div', { class: 'group-l' }, 'Region'), h('div', { class: 'chips' }, ...regionChips)),
      h('div', null, h('div', { class: 'group-l' }, 'Equipment'), h('div', { class: 'chips' }, ...equipChips)),
      h('div', null, h('div', { class: 'group-l' }, 'Source'), customTog)
    );

    // list
    const filtered = LIB.filter(ex => {
      if (state.region !== 'All' && ex.region !== state.region) return false;
      if (state.equip !== 'Any' && ex.equip !== state.equip) return false;
      if (state.customOnly && !ex.custom) return false;
      if (state.query && !ex.name.toLowerCase().includes(state.query.toLowerCase())) return false;
      return true;
    });

    const listInner = filtered.length === 0
      ? h('div', { class: 'bd-empty' },
          h('i', { class: 'ti ti-mood-empty' }),
          h('div', null, 'No exercises match these filters.'),
          h('div', { style: 'margin-top:6px' }, 'Try widening the region or equipment.'))
      : filtered.map(ex => {
          const on = state.selected.includes(ex.id);
          return h('div', {
            class: 'bd-ex' + (on ? ' is-on' : '') + (ex.custom ? ' is-custom' : ''),
            onclick: () => {
              const i = state.selected.indexOf(ex.id);
              if (i >= 0) {
                state.selected.splice(i, 1);
                delete state.sets[ex.id];
              } else {
                state.selected.push(ex.id);
                // seed default sets
                state.sets[ex.id] = seedSets(ex);
              }
              renderBody(); renderFooter();
            }
          },
            h('div', { class: 'check' }),
            h('div', { class: 'body' },
              h('div', { class: 'name' }, ex.name),
              h('div', { class: 'meta' },
                h('span', null, ex.region),
                h('span', { class: 'sep' }, '·'),
                h('span', null, ex.equip),
                h('span', { class: 'sep' }, '·'),
                h('span', null, ex.sets + '×' + ex.reps),
                ex.custom ? h('span', { class: 'tag' }, 'Custom') : null
              )
            ),
            h('div', { class: 'defaults' }, ex.sets + '×' + ex.reps)
          );
        });

    const list = h('div', { class: 'bd-list-col' },
      h('div', { class: 'bd-search' },
        h('i', { class: 'ti ti-search' }),
        h('input', {
          type: 'text',
          placeholder: 'Search exercises…',
          value: state.query,
          oninput: (e) => { state.query = e.target.value; renderBody(); }
        }),
        h('span', { class: 'cm-kbd' }, '/')
      ),
      h('div', { class: 'bd-ex-list' }, ...(Array.isArray(listInner) ? listInner : [listInner]))
    );

    return h('div', { class: 'bd-step-content' },
      h('div', { class: 'bd-pick' }, filters, list)
    );
  }

  function seedSets(ex) {
    const setRows = [];
    const n = typeof ex.sets === 'number' ? ex.sets : 3;
    for (let i = 0; i < n; i++) {
      setRows.push({ reps: ex.reps, load: ex.load, tempo: ex.tempo, rest: ex.rest });
    }
    return setRows;
  }

  function renderStep3() {
    const type = TYPE_MAP[state.type];
    const ctxLabel = state.context === 'rehab' ? 'Contraindications'
                  : state.context === 'prev'  ? 'Targets risk flag'
                  : 'Goal · VBT target';
    const ctxPh = state.context === 'rehab' ? 'e.g. Avoid deep ROM'
                : state.context === 'prev'  ? 'e.g. Hamstring'
                : 'e.g. 80% 1RM · 0.45 m/s';

    const blockHead = h('div', { class: 'bd-block-h' },
      h('div', { class: 'bd-field with-stripe', style: '--bd-stripe:' + TYPE_COLOR[state.type] },
        h('label', null, 'Block name'),
        h('input', {
          type: 'text',
          value: state.blockName,
          oninput: (e) => { state.blockName = e.target.value; }
        })
      ),
      h('div', { class: 'bd-field' },
        h('label', null, 'Duration'),
        h('input', {
          type: 'number',
          value: state.duration,
          min: '1',
          oninput: (e) => { state.duration = parseInt(e.target.value) || 0; renderFooter(); }
        })
      ),
      h('div', { class: 'bd-field' },
        h('label', null, 'RPE target'),
        h('input', {
          type: 'number',
          value: state.rpe,
          min: '1', max: '10',
          oninput: (e) => { state.rpe = parseInt(e.target.value) || 5; renderFooter(); }
        })
      ),
      h('div', { class: 'bd-field' },
        h('label', null, 'Owner'),
        ownerSelect()
      )
    );

    // colour the stripe by type — handled via --bd-stripe CSS var on the field

    const ctxRow = h('div', { class: 'bd-context-row' },
      h('div', { class: 'bd-field' },
        h('label', null, ctxLabel),
        h('input', {
          type: 'text', placeholder: ctxPh, value: state.ctxField,
          oninput: (e) => { state.ctxField = e.target.value; }
        })
      ),
      h('div', { class: 'bd-field' },
        h('label', null, 'Notes for athlete'),
        h('input', {
          type: 'text', placeholder: 'Optional cue / instruction', value: state.notes,
          oninput: (e) => { state.notes = e.target.value; }
        })
      )
    );

    const exCards = state.selected.map((exId, exIdx) => renderExCard(exId, exIdx));

    return h('div', { class: 'bd-step-content' },
      blockHead,
      ctxRow,
      h('div', { class: 'bd-section-h' }, `Exercises · ${state.selected.length}`),
      ...exCards,
      h('button', {
        class: 'bd-add-ex',
        onclick: () => { state.step = 2; renderAll(); }
      },
        h('i', { class: 'ti ti-plus' }),
        ' Add another exercise'
      )
    );
  }

  function ownerSelect() {
    const sel = h('select', { onchange: (e) => { state.owner = e.target.value; } },
      h('option', { value: 'sc' }, 'S&C · L. Pérez'),
      h('option', { value: 'physio' }, 'Physio · R. Martínez'),
      h('option', { value: 'coach' }, 'Coach · D. Valdez')
    );
    sel.value = state.owner;
    return sel;
  }

  function renderExCard(exId, exIdx) {
    const ex = LIB.find(e => e.id === exId);
    const sets = state.sets[exId] || [];
    const head = h('div', { class: 'bd-ex-card-h' },
      h('div', { class: 'n' }, String(exIdx + 1)),
      h('div', { class: 'name' }, ex.name),
      h('button', { class: 'ic', title: 'Duplicate', onclick: () => duplicateEx(exId) }, h('i', { class: 'ti ti-copy' })),
      h('button', { class: 'ic', title: 'Remove', onclick: () => removeEx(exId) }, h('i', { class: 'ti ti-trash' }))
    );
    const tbl = h('table', { class: 'bd-sets-tbl' },
      h('thead', null,
        h('tr', null,
          h('th', { class: 'set-n' }, 'Set'),
          h('th', null, 'Reps'),
          h('th', null, 'Load'),
          h('th', null, 'Tempo'),
          h('th', null, 'Rest'),
          h('th', { style: 'width:32px' })
        )
      ),
      h('tbody', null,
        ...sets.map((s, i) => h('tr', null,
          h('td', { class: 'set-n' }, h('input', { value: i + 1, readonly: '' })),
          h('td', null, h('input', { value: s.reps, oninput: (e) => s.reps = e.target.value })),
          h('td', null, h('input', { value: s.load, oninput: (e) => s.load = e.target.value })),
          h('td', null, h('input', { value: s.tempo, oninput: (e) => s.tempo = e.target.value })),
          h('td', null, h('input', { value: s.rest, oninput: (e) => s.rest = e.target.value })),
          h('td', null, h('button', { class: 'rm-row', onclick: () => { sets.splice(i, 1); renderBody(); renderFooter(); } }, h('i', { class: 'ti ti-x' })))
        ))
      )
    );
    const addSet = h('button', {
      class: 'bd-add-set',
      onclick: () => {
        sets.push({ reps: ex.reps, load: ex.load, tempo: ex.tempo, rest: ex.rest });
        renderBody(); renderFooter();
      }
    }, h('i', { class: 'ti ti-plus' }), ' Add set');
    return h('div', { class: 'bd-ex-card' }, head, tbl, addSet);
  }

  function duplicateEx(exId) {
    // append the same ex again with the same sets pattern
    const ex = LIB.find(e => e.id === exId);
    if (!ex) return;
    // give a unique key for the second instance — use exId + index
    const newKey = exId + '__' + (state.selected.filter(s => s.startsWith(exId)).length);
    state.selected.push(newKey);
    state.sets[newKey] = JSON.parse(JSON.stringify(state.sets[exId] || seedSets(ex)));
    // map the new key back to the original entry for lookup
    LIB.push({ ...ex, id: newKey });
    renderBody(); renderFooter();
  }
  function removeEx(exId) {
    const i = state.selected.indexOf(exId);
    if (i < 0) return;
    state.selected.splice(i, 1);
    delete state.sets[exId];
    renderBody(); renderFooter();
  }

  function computeAU() {
    // Simple model: duration (min) * RPE * 1.2
    // Plus 4 per set as a small bias.
    let setCount = 0;
    Object.values(state.sets).forEach(arr => setCount += arr.length);
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

    const cancel = h('button', { class: 'cm-btn is-ghost', onclick: close }, 'Cancel');
    footEl.appendChild(cancel);

    // Delete action — only in edit mode at any step
    if (state.mode === 'edit') {
      const del = h('button', {
        class: 'cm-btn is-ghost',
        style: 'color:#B91C1C',
        onclick: doDelete
      }, h('i', { class: 'ti ti-trash', style: 'margin-right:5px' }), 'Delete');
      footEl.appendChild(del);
    }

    if (state.step < 3) {
      const next = h('button', {
        class: 'cm-btn is-primary' + (canAdvanceTo(state.step + 1) ? '' : ' is-disabled'),
        disabled: canAdvanceTo(state.step + 1) ? null : '',
        onclick: () => { if (canAdvanceTo(state.step + 1)) { state.step++; renderAll(); } }
      }, 'Next', h('i', { class: 'ti ti-arrow-right', style: 'margin-left:6px' }));
      footEl.appendChild(next);
    } else {
      const saveLabel = state.mode === 'edit' ? 'Save changes' : 'Add block';
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
  function open(opts) {
    build();
    opts = opts || {};
    const existing = opts.existing;
    state = {
      open: true,
      mode: existing ? 'edit' : 'create',
      step: existing ? 3 : 1,   // jump straight to parameters when editing
      context: opts.context || 'rehab',
      dayLabel: opts.day || (existing && existing.day) || '',
      dayDate:  opts.dayDate || '',
      type: existing ? existing.type : null,
      region: 'All', equip: 'Any', customOnly: false, query: '',
      selected: existing && existing.exerciseIds ? existing.exerciseIds.slice() : [],
      blockName: existing ? (existing.name || '') : '',
      duration: existing ? (existing.duration || 20) : 20,
      owner: existing ? (existing.owner || 'sc') : 'sc',
      rpe: existing ? (existing.rpe || 7) : 7,
      notes: existing ? (existing.notes || '') : '',
      ctxField: existing ? (existing.ctxField || '') : '',
      sets: {}
    };
    // Seed sets for each existing exercise
    if (existing && existing.exerciseIds) {
      existing.exerciseIds.forEach(exId => {
        const ex = LIB.find(e => e.id === exId);
        if (ex) state.sets[exId] = (existing.sets && existing.sets[exId]) || seedSets(ex);
      });
    }
    headTitle.textContent = state.mode === 'edit' ? 'Edit block' : 'New block';
    headSub.textContent = (state.dayLabel ? state.dayLabel + ' · ' : '') +
      ({ rehab: 'Rehab plan', prev: 'Preventive plan', ip: 'Individual S&C' }[state.context] || '');
    renderAll();
    setTimeout(() => {
      backdrop.classList.add('is-open');
      drawer.classList.add('is-open');
    }, 0);
  }

  function close() {
    if (!root) return;
    state.open = false;
    backdrop.classList.remove('is-open');
    drawer.classList.remove('is-open');
  }

  function doSave() {
    // No-op write — fire custom event so the host can react.
    const payload = {
      mode: state.mode,
      type: state.type,
      name: state.blockName || TYPE_MAP[state.type].label,
      duration: state.duration,
      rpe: state.rpe,
      owner: state.owner,
      notes: state.notes,
      ctxField: state.ctxField,
      exercises: state.selected.map((exId, i) => {
        const ex = LIB.find(e => e.id === exId);
        return {
          name: ex.name,
          region: ex.region,
          sets: state.sets[exId] || []
        };
      }),
      au: computeAU()
    };
    payload.dayDate = state.dayDate;
    window.dispatchEvent(new CustomEvent('blockdrawer:save', { detail: payload }));
    close();
  }

  function doDelete() {
    if (!confirm('Delete this block? This cannot be undone.')) return;
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
