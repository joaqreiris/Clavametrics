/* =============================================================
   GPS Analysis — Conditional formatting table (Power BI style)
   State-driven: each column has a `mode`; the rules pane edits it
   live. Illustrative data — real binding is done in code.
   ============================================================= */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtNum = (v, d) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const mix = (c1, c2, t) => `color-mix(in srgb, ${c2} ${Math.round(t * 100)}%, ${c1})`;

  /* heat: t in [0,1] (0 = low, 1 = high) → soft tinted bg.
     scales: 'gyr' green-high, 'ryg' reversed, 'seq' single-hue accent */
  function heatBg(t, scale) {
    t = clamp(t, 0, 1);
    const S = 'var(--cm-surface)';
    if (scale === 'seq') return mix(S, 'var(--cm-accent)', 0.06 + t * 0.30);
    // diverging red→amber→green at low strength
    let hue;
    if (scale === 'ryg') t = 1 - t;
    if (t < 0.5) hue = mix('var(--cm-danger)', 'var(--cm-warning)', t / 0.5);
    else hue = mix('var(--cm-warning)', 'var(--cm-success)', (t - 0.5) / 0.5);
    return mix(S, hue, 0.30);
  }

  /* ---------- players ---------- */
  const AV = ['var(--cm-accent)', 'var(--cm-info)', 'var(--cm-violet)', 'var(--cm-warning)', 'var(--cm-success)', 'var(--cm-danger)', 'var(--cm-neutral)'];
  const PLAYERS = [
    { nm: 'R. Vega', po: 'RW · #7' }, { nm: 'S. Rivas', po: 'ST · #9' },
    { nm: 'T. López', po: 'CM · #11' }, { nm: 'F. Domínguez', po: 'AM · #10' },
    { nm: 'J. Cardozo', po: 'CM · #8' }, { nm: 'M. Paredes', po: 'DM · #6' },
    { nm: 'I. Barreiro', po: 'CB · #18' }, { nm: 'G. Ríos', po: 'CB · #3' },
    { nm: 'D. Aguirre', po: 'LB · #22' }, { nm: 'E. Galarza', po: 'GK · #1' },
  ];
  const initials = nm => nm.replace(/[^A-ZÁÉÍÓÚ. ]/gi, '').split(/[. ]+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase();

  /* ---------- columns (each starts in a different mode) ---------- */
  const COLS = [
    {
      id: 'dist', label: 'Distance', unit: 'km', dec: 1, goodHigh: true,
      mode: 'bar', barColor: 'var(--cm-accent)',
      vals: [10.9, 10.4, 11.2, 9.8, 10.1, 9.2, 8.7, 8.4, 9.6, 5.1],
    },
    {
      id: 'hsr', label: 'HSR', unit: 'm', dec: 0, goodHigh: true,
      mode: 'heat', heatScale: 'gyr',
      vals: [812, 760, 694, 624, 648, 588, 560, 520, 470, 95],
    },
    {
      id: 'sprints', label: 'Sprints', unit: 'n', dec: 0, goodHigh: true,
      mode: 'icon', iconStyle: 'dot', thr: { hi: 22, lo: 14 },
      vals: [28, 24, 19, 16, 21, 13, 11, 9, 17, 2],
    },
    {
      id: 'acwr', label: 'ACWR', unit: '', dec: 2, goodHigh: null,
      mode: 'icon', iconStyle: 'arrow', thr: { hi: 1.3, lo: 0.8 },
      vals: [1.42, 1.18, 0.95, 1.05, 1.28, 0.78, 1.10, 0.88, 1.35, 0.72],
    },
    {
      id: 'ready', label: 'Readiness', unit: '%', dec: 0, goodHigh: true,
      mode: 'pct',
      vals: [92, 88, 81, 76, 84, 69, 72, 66, 58, 95],
    },
  ];

  const MODE_META = {
    plain: { ic: 'ti-minus', lab: 'Sin formato', short: 'Plano', cls: 'mode-plain' },
    bar:   { ic: 'ti-chart-bar', lab: 'Barra de dato', short: 'Barra', cls: 'mode-bar' },
    heat:  { ic: 'ti-temperature', lab: 'Escala de color', short: 'Heat', cls: 'mode-heat' },
    icon:  { ic: 'ti-traffic-lights', lab: 'Ícono por umbral', short: 'Semáforo', cls: 'mode-icon' },
    pct:   { ic: 'ti-percentage', lab: 'Valor como %', short: 'Valor %', cls: 'mode-pct' },
  };
  const SWATCHES = ['var(--cm-accent)', 'var(--cm-info)', 'var(--cm-violet)', 'var(--cm-warning)'];

  const stat = vals => ({ min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) });

  /* ---------- cell renderer ---------- */
  function cell(col, v) {
    const { min, max } = stat(col.vals);
    const t = max === min ? 1 : (v - min) / (max - min);
    const num = fmtNum(v, col.dec);

    if (col.mode === 'bar') {
      const w = (8 + t * 88).toFixed(1);
      return { cls: '', html: `<div class="tf-c bar" style="--bc:${col.barColor}"><span class="fill" style="width:calc(${w}% - 16px)"></span><span class="num">${num}</span></div>` };
    }
    if (col.mode === 'heat') {
      return { cls: 'heat-cell', style: `background:${heatBg(t, col.heatScale)}`, html: `<div class="tf-c heat"><span class="num">${num}</span></div>` };
    }
    if (col.mode === 'icon') {
      // classify by thresholds; goodHigh metrics: >=hi good; band metrics (acwr): inside [lo,hi] good
      let g; // 'g'|'a'|'r'
      if (col.goodHigh === null) g = (v >= col.thr.hi) ? 'r' : (v < col.thr.lo) ? 'a' : 'g';
      else g = (v >= col.thr.hi) ? 'g' : (v >= col.thr.lo) ? 'a' : 'r';
      let ic;
      if (col.iconStyle === 'arrow') {
        if (col.goodHigh === null) {
          // band metric (e.g. ACWR): inside [lo,hi] = ok
          ic = v >= col.thr.hi ? '<i class="ti ti-arrow-up-right"></i>'
             : v < col.thr.lo ? '<i class="ti ti-arrow-down-right"></i>'
             : '<i class="ti ti-check"></i>';
        } else {
          ic = g === 'g' ? '<i class="ti ti-arrow-up-right"></i>' : g === 'a' ? '<i class="ti ti-arrow-right"></i>' : '<i class="ti ti-arrow-down-right"></i>';
        }
        return { cls: '', html: `<div class="tf-c icon"><span class="ic tf-ic-${g}">${ic}</span><span class="num">${num}</span></div>` };
      }
      return { cls: '', html: `<div class="tf-c icon"><span class="ic"><span class="dot tf-ic-${g}"></span></span><span class="num">${num}</span></div>` };
    }
    if (col.mode === 'pct') {
      return { cls: '', html: `<div class="tf-c pct"><span class="num">${num}<span style="color:var(--cm-fg-muted)">%</span></span><span class="track"><i style="width:${clamp(v, 0, 100)}%"></i></span></div>` };
    }
    return { cls: '', html: `<div class="tf-c"><span class="num">${num}</span></div>` };
  }

  /* ---------- table render ---------- */
  function renderTable(flashId) {
    const head = `<tr><th class="l"><span class="hlab">Jugador</span></th>` + COLS.map(c => {
      const m = MODE_META[c.mode];
      let short = m.short;
      if (c.mode === 'icon') short = c.iconStyle === 'arrow' ? 'Flecha' : 'Semáforo';
      return `<th><span class="hlab">${c.label}${c.unit ? ` <span style="color:var(--cm-fg-faint)">${c.unit}</span>` : ''}</span>`
        + `<span class="mode ${m.cls}"><i class="ti ${m.ic}"></i>${short}</span></th>`;
    }).join('') + `</tr>`;

    const body = PLAYERS.map((p, ri) => {
      const cells = COLS.map(c => {
        const r = cell(c, c.vals[ri]);
        const fl = (flashId && c.id === flashId) ? ' flash' : '';
        return `<td class="${r.cls}${fl}" style="${r.style || ''}">${r.html}</td>`;
      }).join('');
      return `<tr><td><div class="tf-pl"><span class="av" style="background:${AV[ri % AV.length]}">${initials(p.nm)}</span>`
        + `<span class="who"><span class="nm">${p.nm}</span><span class="po">${p.po}</span></span></div></td>${cells}</tr>`;
    }).join('');

    document.getElementById('tfTbl').innerHTML = `<colgroup><col class="c-pl">${COLS.map(() => '<col>').join('')}</colgroup><thead>${head}</thead><tbody>${body}</tbody>`;
  }

  /* ---------- rules pane render ---------- */
  let openCol = COLS[0].id;

  function modeSeg(col) {
    return `<div class="tf-seg" data-seg="${col.id}">` + ['plain', 'bar', 'heat', 'icon', 'pct'].map(m => {
      const meta = MODE_META[m];
      const on = col.mode === m ? `on c-${m}` : '';
      return `<button class="${on}" data-mode="${m}" title="${meta.lab}"><i class="ti ${meta.ic}"></i></button>`;
    }).join('') + `</div>`;
  }

  function modeOptions(col) {
    if (col.mode === 'bar') {
      return `<div class="tf-field"><label>Color de barra</label><div class="tf-swatches" data-swatch="${col.id}">`
        + SWATCHES.map(s => `<button class="${col.barColor === s ? 'on' : ''}" data-color="${s}" style="background:${s}"></button>`).join('')
        + `</div></div>`
        + `<div class="tf-hint"><i class="ti ti-info-circle"></i><p>Barra dentro de la celda, proporcional al valor (mín→máx de la columna).</p></div>`;
    }
    if (col.mode === 'heat') {
      const scales = { gyr: ['var(--cm-danger)', 'var(--cm-warning)', 'var(--cm-success)'], ryg: ['var(--cm-success)', 'var(--cm-warning)', 'var(--cm-danger)'], seq: ['var(--cm-surface)', mix('var(--cm-surface)', 'var(--cm-accent)', 0.18), 'var(--cm-accent)'] };
      const cur = scales[col.heatScale] || scales.gyr;
      return `<div class="tf-field"><label>Escala de color</label>`
        + `<div class="tf-heatbar" style="--lo:${cur[0]};--mid:${cur[1]};--hi:${cur[2]}"></div>`
        + `<div class="tf-heatends"><span>bajo</span><span>alto</span></div></div>`
        + `<div class="tf-field"><label>Paleta</label><div class="tf-swatches" data-heat="${col.id}">`
        + Object.keys(scales).map(k => {
          const sc = scales[k];
          return `<button class="${col.heatScale === k ? 'on' : ''}" data-scale="${k}" style="background:linear-gradient(90deg,${sc[0]},${sc[1]},${sc[2]});width:54px"></button>`;
        }).join('')
        + `</div></div>`;
    }
    if (col.mode === 'icon') {
      const band = col.goodHigh === null;
      const styleSel = `<div class="tf-field"><label>Estilo de ícono</label><div class="tf-seg" style="grid-template-columns:repeat(2,1fr)" data-istyle="${col.id}">`
        + `<button class="${col.iconStyle === 'dot' ? 'on c-icon' : ''}" data-istyle-v="dot"><i class="ti ti-traffic-lights"></i></button>`
        + `<button class="${col.iconStyle === 'arrow' ? 'on c-icon' : ''}" data-istyle-v="arrow"><i class="ti ti-arrow-up-right"></i></button>`
        + `</div></div>`;
      const thr = `<div class="tf-field"><label>${band ? 'Umbrales (zona segura)' : 'Umbrales'}</label><div class="tf-thr" data-thr="${col.id}">`
        + `<div class="tf-thr-row"><span class="dot tf-ic-${band ? 'r' : 'g'}" style="background:${band ? 'var(--cm-danger)' : 'var(--cm-success)'}"></span><span class="lab">${band ? 'Alto / riesgo' : 'Verde'}</span><span class="op">≥</span><input type="number" step="${col.dec ? '0.01' : '1'}" value="${col.thr.hi}" data-thr-k="hi"></div>`
        + `<div class="tf-thr-row"><span class="dot tf-ic-a" style="background:var(--cm-warning)"></span><span class="lab">${band ? 'Bajo' : 'Ámbar'}</span><span class="op">≥</span><input type="number" step="${col.dec ? '0.01' : '1'}" value="${col.thr.lo}" data-thr-k="lo"></div>`
        + `</div></div>`;
      return styleSel + thr;
    }
    if (col.mode === 'pct') {
      return `<div class="tf-field"><label>Decimales</label><div class="tf-step" data-dec="${col.id}"><button data-d="-1">−</button><span class="val">${col.dec}</span><button data-d="1">+</button></div></div>`
        + `<div class="tf-hint"><i class="ti ti-info-circle"></i><p>Muestra el valor con signo % y una mini-barra de progreso 0–100.</p></div>`;
    }
    return `<div class="tf-hint"><i class="ti ti-info-circle"></i><p>Sin formato condicional — sólo el número, alineado a la derecha.</p></div>`;
  }

  function renderPane() {
    const body = COLS.map(c => {
      const m = MODE_META[c.mode];
      const open = c.id === openCol;
      const sw = c.mode === 'bar' ? c.barColor : c.mode === 'heat' ? 'var(--cm-warning)' : c.mode === 'icon' ? 'var(--cm-info)' : c.mode === 'pct' ? 'var(--cm-violet)' : 'var(--cm-border-strong)';
      return `<div class="tf-rule ${open ? 'open' : ''}" data-rule="${c.id}">`
        + `<div class="tf-rule-h" data-toggle="${c.id}"><span class="swatch" style="background:${sw}"></span>`
        + `<span class="meta"><span class="nm">${c.label}${c.unit ? ` · ${c.unit}` : ''}</span><span class="md"><i class="ti ${m.ic}" style="font-size:11px;vertical-align:-1px"></i> ${m.lab}</span></span>`
        + `<i class="ti ti-chevron-down chev"></i></div>`
        + `<div class="tf-rule-b"><div class="tf-field"><label>Formato condicional</label>${modeSeg(c)}</div>${modeOptions(c)}</div>`
        + `</div>`;
    }).join('');
    document.getElementById('tfPane').innerHTML = body;
  }

  function colById(id) { return COLS.find(c => c.id === id); }

  /* ---------- interactions ---------- */
  function wire() {
    const pane = document.getElementById('tfPane');
    pane.addEventListener('click', e => {
      const tgl = e.target.closest('[data-toggle]');
      if (tgl) { openCol = (openCol === tgl.dataset.toggle) ? null : tgl.dataset.toggle; renderPane(); return; }

      const seg = e.target.closest('[data-seg] button');
      if (seg) {
        const id = seg.closest('[data-seg]').dataset.seg, col = colById(id);
        col.mode = seg.dataset.mode;
        if (col.mode === 'icon' && !col.iconStyle) col.iconStyle = 'dot';
        if (col.mode === 'icon' && !col.thr) { const s = stat(col.vals); col.thr = { hi: Math.round(s.max * 0.8), lo: Math.round(s.max * 0.55) }; }
        if (col.mode === 'heat' && !col.heatScale) col.heatScale = 'gyr';
        openCol = id; renderPane(); renderTable(id); return;
      }
      const sw = e.target.closest('[data-swatch] button');
      if (sw) { const id = sw.closest('[data-swatch]').dataset.swatch; colById(id).barColor = sw.dataset.color; renderPane(); renderTable(id); return; }

      const hs = e.target.closest('[data-heat] button');
      if (hs) { const id = hs.closest('[data-heat]').dataset.heat; colById(id).heatScale = hs.dataset.scale; renderPane(); renderTable(id); return; }

      const ist = e.target.closest('[data-istyle] button');
      if (ist) { const id = ist.closest('[data-istyle]').dataset.istyle; colById(id).iconStyle = ist.dataset.istyleV; renderPane(); renderTable(id); return; }

      const dec = e.target.closest('[data-dec] button');
      if (dec) { const id = dec.closest('[data-dec]').dataset.dec, col = colById(id); col.dec = clamp(col.dec + (+dec.dataset.d), 0, 2); renderPane(); renderTable(id); return; }
    });

    pane.addEventListener('change', e => {
      const inp = e.target.closest('[data-thr] input');
      if (inp) { const id = inp.closest('[data-thr]').dataset.thr, col = colById(id); col.thr[inp.dataset.thrK] = parseFloat(inp.value); renderTable(id); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('tfTbl')) return;
    renderTable(); renderPane(); wire();
  });
})();
