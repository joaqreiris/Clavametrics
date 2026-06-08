/* =============================================================
   GPS Analysis — Chart reference renderer
   Pure look reference: builds the professional bar-chart card at
   S / M / L for one series and several series. Data is illustrative
   (the real connection is done in code via the gp.card/v1 resolver).
   ============================================================= */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const fmt = n => n >= 1000 ? n.toLocaleString('en-US') : (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const tickFmt = n => n >= 1000 ? (n % 1000 === 0 ? (n / 1000) + 'k' : (n / 1000).toFixed(1) + 'k') : String(n);

  // nice rounded scale → ticks top→bottom, niceMax ≥ max (leaves headroom)
  function niceScale(max, count) {
    count = count || 5;
    const raw = max / (count - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    step *= mag;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = niceMax; v > -1e-9; v -= step) ticks.push(Math.round(v * 100) / 100);
    return { niceMax, ticks };
  }

  // evenly spaced ticks (top→bottom) for a chosen max + count
  function evenTicks(max, count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) out.push(Math.round(max * i / (count - 1) * 100) / 100);
    return out;
  }

  const SZVARS = {
    sm: { yw: 30, gap: 7,  bw: 24, bargap: 2 },
    md: { yw: 36, gap: 12, bw: 30, bargap: 3 },
    lg: { yw: 38, gap: 16, bw: 34, bargap: 4 },
  };

  /* ---------- the bar chart ---------- */
  function barChart(cfg) {
    const size = cfg.size || 'md';
    const ticksWanted = cfg.ticks || (size === 'sm' ? 4 : 5);
    const all = cfg.data.flat();
    const { niceMax, ticks } = niceScale(Math.max.apply(null, all), ticksWanted);
    const v = Object.assign({}, SZVARS[size]);
    if (niceMax >= 1000) v.yw += 5;

    const yax = ticks.map(t => `<span>${tickFmt(t)}</span>`).join('');
    const grid = ticks.map(() => '<i></i>').join('');

    const cats = cfg.data.map((row, ci) => {
      const bars = row.map((val, si) => {
        const s = cfg.series[si];
        const h = (val / niceMax * 100).toFixed(2);
        const style = `--h:${h}%;` + (s.color ? `--c:${s.color};` : '');
        return `<div class="bc-bar ${s.muted ? 'is-mut' : ''}" style="${style}"`
          + ` data-cat="${cfg.cats[ci]}" data-series="${s.name}" data-color="${s.color || 'var(--cm-accent)'}"`
          + ` data-muted="${s.muted ? 1 : 0}" data-val="${fmt(val)} ${cfg.unit}">`
          + (cfg.dataLabels ? `<span class="v">${fmt(val)}</span>` : '')
          + `</div>`;
      }).join('');
      return `<div class="bc-cat">${bars}</div>`;
    }).join('');

    const xax = cfg.cats.map(c => `<span>${c}</span>`).join('');

    const legend = cfg.series.map(s =>
      `<span class="bc-leg"><i class="${s.muted ? 'is-mut' : ''}" style="${s.color ? `--c:${s.color};` : ''}"></i>${s.name}</span>`
    ).join('') + `<span class="unit">${cfg.unit}</span>`;

    const vars = `--bc-yw:${v.yw}px;--bc-gap:${v.gap}px;--bc-bw:${v.bw}px;--bc-bargap:${v.bargap}px;`;
    return `<div class="bc" style="${vars}">`
      + `<div class="bc-yax">${yax}</div>`
      + `<div class="bc-plot"><div class="bc-grid">${grid}</div><div class="bc-cats">${cats}</div></div>`
      + `<div class="bc-xax">${xax}</div>`
      + `<div class="bc-legend">${legend}</div>`
      + `</div>`;
  }

  /* ---------- combo: bars + line (secondary axis) ---------- */
  function comboChart(cfg) {
    const size = cfg.size || 'md';
    const count = cfg.count || (size === 'sm' ? 3 : 5);
    const lc = cfg.lineColor || 'var(--cm-info)';
    const v = Object.assign({}, SZVARS[size]);
    if (cfg.leftMax >= 1000) v.yw += 4;
    const n = cfg.cats.length;

    const lTicks = evenTicks(cfg.leftMax, count);
    const rTicks = evenTicks(cfg.rightMax, count);
    const yaxL = lTicks.map(t => `<span>${tickFmt(t)}</span>`).join('');
    const yaxR = rTicks.map(t => `<span>${tickFmt(t)}</span>`).join('');
    const grid = lTicks.map(() => '<i></i>').join('');

    const cats = cfg.bars.map((val, i) => {
      const h = (val / cfg.leftMax * 100).toFixed(2);
      return `<div class="bc-cat"><div class="bc-bar" style="--h:${h}%"`
        + ` data-cat="${cfg.cats[i]}" data-series="${cfg.barName}" data-color="var(--cm-accent)" data-muted="0"`
        + ` data-val="${fmt(val)} ${cfg.unitL}"></div></div>`;
    }).join('');

    const pts = cfg.line.map((val, i) => {
      const x = ((i + 0.5) / n * 100).toFixed(2);
      const y = (100 - val / cfg.rightMax * 100).toFixed(2);
      return `${x},${y}`;
    }).join(' ');
    const dots = cfg.line.map((val, i) => {
      const x = ((i + 0.5) / n * 100).toFixed(2);
      const by = (val / cfg.rightMax * 100).toFixed(2);
      return `<span class="bc-dot" style="left:${x}%;bottom:${by}%;--lc:${lc}"`
        + ` data-cat="${cfg.cats[i]}" data-series="${cfg.lineName}" data-color="${lc}" data-muted="0"`
        + ` data-val="${fmt(val)} ${cfg.unitR}">`
        + (cfg.lineLabels ? `<span class="v">${fmt(val)}</span>` : '') + `</span>`;
    }).join('');

    const xax = cfg.cats.map(c => `<span>${c}</span>`).join('');
    const legend =
      `<span class="bc-leg"><i style="--c:var(--cm-accent)"></i>${cfg.barName} <span style="color:var(--cm-fg-faint)">${cfg.unitL}</span></span>`
      + `<span class="bc-leg"><i class="ln" style="--c:${lc}"></i>${cfg.lineName} <span style="color:var(--cm-fg-faint)">${cfg.unitR}</span></span>`;

    const vars = `--bc-yw:${v.yw}px;--bc-yw2:${v.yw + 2}px;--bc-gap:${v.gap}px;--bc-bw:${v.bw}px;--bc-bargap:${v.bargap}px;--lc:${lc};`;
    return `<div class="bc is-combo" style="${vars}">`
      + `<div class="bc-yax">${yaxL}</div>`
      + `<div class="bc-plot"><div class="bc-grid">${grid}</div><div class="bc-cats">${cats}</div>`
      + `<svg class="bc-line" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}"/></svg>${dots}</div>`
      + `<div class="bc-yax r">${yaxR}</div>`
      + `<div class="bc-xax">${xax}</div>`
      + `<div class="bc-legend">${legend}</div>`
      + `</div>`;
  }

  /* ---------- line / temporal: multi-series, points, optional area ---------- */
  function lineChart(cfg) {
    const size = cfg.size || 'md';
    const count = cfg.count || (size === 'sm' ? 4 : 5);
    const all = [];
    cfg.series.forEach(s => s.values.forEach(x => all.push(x)));
    const { niceMax, ticks } = niceScale(Math.max.apply(null, all), count);
    const v = Object.assign({}, SZVARS[size]);
    if (niceMax >= 1000) v.yw += 4;
    const n = cfg.cats.length;
    const P = 2.5;                                   // edge padding (%)
    const X = i => (P + i / (n - 1) * (100 - 2 * P)).toFixed(2);
    const Y = val => (100 - val / niceMax * 100).toFixed(2);

    const yax = ticks.map(t => `<span>${tickFmt(t)}</span>`).join('');
    const grid = ticks.map(() => '<i></i>').join('');

    let areas = '', lines = '', dots = '';
    cfg.series.forEach(s => {
      const pts = s.values.map((val, i) => `${X(i)},${Y(val)}`).join(' ');
      if (s.area) areas += `<polygon points="${pts} ${X(n - 1)},100 ${X(0)},100" style="fill:${s.color};fill-opacity:0.12"></polygon>`;
      lines += `<polyline class="${s.dashed ? 'dash' : ''}" points="${pts}" style="stroke:${s.color}"></polyline>`;
      if (!s.noDots) s.values.forEach((val, i) => {
        dots += `<span class="bc-dot" style="left:${X(i)}%;bottom:${(val / niceMax * 100).toFixed(2)}%;--lc:${s.color}"`
          + ` data-cat="MC ${cfg.cats[i]}" data-series="${s.name}" data-color="${s.color}" data-muted="0"`
          + ` data-val="${fmt(val)} ${cfg.unit}"></span>`;
      });
    });

    const xax = cfg.cats.map((c, i) =>
      `<span class="${i === 0 ? 'first' : i === n - 1 ? 'last' : ''}" style="left:${X(i)}%">${c}</span>`).join('');
    const legend = cfg.series.map(s =>
      `<span class="bc-leg"><i class="ln ${s.dashed ? 'dash' : ''}" style="--c:${s.color}"></i>${s.name}</span>`).join('')
      + `<span class="unit">${cfg.unit}</span>`;

    const vars = `--bc-yw:${v.yw}px;`;
    return `<div class="bc is-line" style="${vars}">`
      + `<div class="bc-yax">${yax}</div>`
      + `<div class="bc-plot"><div class="bc-grid">${grid}</div>`
      + `<svg class="lc-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${areas}${lines}</svg>${dots}</div>`
      + `<div class="bc-xax">${xax}</div>`
      + `<div class="bc-legend">${legend}</div>`
      + `</div>`;
  }

  /* ---------- scatter: labeled axes, color by category, avg lines ---------- */
  function scatterChart(cfg) {
    const size = cfg.size || 'md';
    const count = cfg.count || (size === 'sm' ? 4 : 5);
    const catMap = {};
    cfg.cats.forEach(c => catMap[c.id] = c);
    const px = v => (v - cfg.xMin) / (cfg.xMax - cfg.xMin) * 100;
    const py = v => (v - cfg.yMin) / (cfg.yMax - cfg.yMin) * 100;

    const xticks = [], yticks = [];
    for (let i = 0; i < count; i++) xticks.push(cfg.xMin + (cfg.xMax - cfg.xMin) * i / (count - 1));
    for (let i = count - 1; i >= 0; i--) yticks.push(cfg.yMin + (cfg.yMax - cfg.yMin) * i / (count - 1));

    const yax = yticks.map(t => `<span>${tickFmt(Math.round(t))}</span>`).join('');
    const grid = yticks.map(() => '<i></i>').join('');
    const vgrid = xticks.map(() => '<i></i>').join('');

    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const ax = px(mean(cfg.points.map(p => p.x))).toFixed(2);
    const ay = py(mean(cfg.points.map(p => p.y))).toFixed(2);

    const dots = cfg.points.map(p => {
      const c = catMap[p.cat] || cfg.cats[0];
      return `<span class="sc-dot" style="left:${px(p.x).toFixed(2)}%;bottom:${py(p.y).toFixed(2)}%;--c:${c.color}"`
        + ` data-cat="${p.name}" data-series="${c.name}" data-color="${c.color}" data-muted="0"`
        + ` data-val="${fmt(p.x)} ${cfg.xUnit} · ${fmt(p.y)} ${cfg.yUnit}"></span>`;
    }).join('');

    const xax = xticks.map((t, i) =>
      `<span class="${i === 0 ? 'first' : i === count - 1 ? 'last' : ''}" style="left:${(i / (count - 1) * 100).toFixed(2)}%">${tickFmt(Math.round(t))}</span>`).join('');
    const legend = cfg.cats.map(c => `<span class="bc-leg"><i class="dot" style="--c:${c.color}"></i>${c.name}</span>`).join('')
      + `<span class="unit">${cfg.xUnit} × ${cfg.yUnit}</span>`;

    const v = Object.assign({}, SZVARS[size]);
    const vars = `--sc-yw:${(cfg.yMax >= 1000 ? 36 : 32)}px;`;
    return `<div class="bc sc" style="${vars}">`
      + `<div class="sc-yt">${cfg.yTitle} ↑</div>`
      + `<div class="bc-yax">${yax}</div>`
      + `<div class="bc-plot">`
      + `<div class="bc-grid">${grid}</div><div class="sc-vgrid">${vgrid}</div>`
      + `<div class="sc-avg-y" style="bottom:${ay}%"><span class="lbl">avg</span></div>`
      + `<div class="sc-avg-x" style="left:${ax}%"><span class="lbl">avg</span></div>`
      + `${dots}</div>`
      + `<div class="sc-xax">${xax}</div>`
      + `<div class="sc-xt">${cfg.xTitle} →</div>`
      + `<div class="bc-legend">${legend}</div>`
      + `</div>`;
  }

  /* ---------- ranking: horizontal bars ---------- */
  function rankChart(cfg) {
    const size = cfg.size || 'md';
    const count = cfg.count || (size === 'sm' ? 5 : size === 'md' ? 8 : 11);
    const rows = cfg.rows.slice(0, count);
    const max = Math.max.apply(null, cfg.rows.map(r => r.val));
    const nw = size === 'sm' ? 92 : 122;
    const body = rows.map((r, i) => {
      const w = (r.val / max * 100).toFixed(1);
      let mv = '';
      if (cfg.moves && r.move !== undefined) {
        const cls = r.move > 0 ? 'up' : r.move < 0 ? 'down' : 'eq';
        const ic = r.move > 0 ? 'ti-caret-up-filled' : r.move < 0 ? 'ti-caret-down-filled' : 'ti-minus';
        mv = `<span class="rk-mv ${cls}"><i class="ti ${ic}"></i>${r.move ? Math.abs(r.move) : ''}</span>`;
      }
      return `<div class="rk-row ${i === 0 ? 'top' : ''}" style="--rk-nw:${nw}px">`
        + `<span class="rk-ix">${i + 1}</span>`
        + `<span class="rk-nm"><span class="t">${r.name}</span><span class="p">${r.pos}</span></span>`
        + `<span class="rk-track"><span class="rk-fill" style="width:${w}%"></span></span>`
        + `<span class="rk-end">${mv}<span class="rk-val">${fmt(r.val)}</span></span>`
        + `</div>`;
    }).join('');
    return `<div class="rk">${body}</div>`;
  }

  /* ---------- KPI: big number + delta + sparkline ---------- */
  function kpiCard(cfg) {
    const size = cfg.size || 'md';
    const fs = size === 'sm' ? 32 : size === 'md' ? 40 : 48;
    const sv = cfg.spark, n = sv.length;
    const mn = Math.min.apply(null, sv), mx = Math.max.apply(null, sv);
    const pad = (mx - mn) * 0.12 || 1;
    const lo = mn - pad, hi = mx + pad;
    const X = i => (i / (n - 1) * 100).toFixed(2);
    const Y = v => (100 - (v - lo) / (hi - lo) * 100).toFixed(2);
    const pts = sv.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    const area = `${pts} 100,100 0,100`;
    const lastX = X(n - 1), lastY = (sv[n - 1] - lo) / (hi - lo) * 100;
    const showSpark = true;
    const d = cfg.delta;
    const deltaHtml = d ? `<span class="kp-delta ${d.dir}"><i class="ti ${d.dir === 'down' ? 'ti-arrow-down-right' : 'ti-arrow-up-right'}"></i>${d.pct}${d.cmp ? `<span class="cmp">${d.cmp}</span>` : ''}</span>` : '';
    const foot = (size === 'lg' && cfg.foot) ? `<div class="kp-foot">${cfg.foot.map(f => `<div class="it"><div class="k">${f.k}</div><div class="v">${f.v}</div></div>`).join('')}</div>` : '';
    return `<div class="kp">`
      + `<div class="kp-lab"><i class="ti ${cfg.icon}"></i>${cfg.label}<span class="rng">${cfg.range}</span></div>`
      + `<div class="kp-valrow"><span class="kp-val" style="--kp-fs:${fs}px">${cfg.value}<span class="u">${cfg.unit}</span></span>${deltaHtml}</div>`
      + (cfg.sub ? `<div class="kp-sub">${cfg.sub}</div>` : '')
      + (showSpark ? `<div class="kp-spark"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${area}"></polygon><polyline points="${pts}"></polyline></svg><span class="dot" style="left:${lastX}%;bottom:${lastY.toFixed(2)}%"></span></div>` : '')
      + foot
      + `</div>`;
  }

  /* ---------- KPI strip: composed mini-KPIs ---------- */
  function sparkSVG(values, color) {
    const n = values.length;
    const mn = Math.min.apply(null, values), mx = Math.max.apply(null, values);
    const pad = (mx - mn) * 0.18 || 1, lo = mn - pad, hi = mx + pad;
    const pts = values.map((v, i) => `${(i / (n - 1) * 100).toFixed(2)},${(100 - (v - lo) / (hi - lo) * 100).toFixed(2)}`).join(' ');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="--c:${color}"><polygon points="${pts} 100,100 0,100"></polygon><polyline points="${pts}"></polyline></svg>`;
  }
  function kpiStrip(cfg) {
    const size = cfg.size || 'md';
    const count = cfg.count || (size === 'sm' ? 3 : size === 'md' ? 4 : 6);
    const spark = size !== 'sm';
    const items = cfg.items.slice(0, count).map(it => {
      const d = it.d;
      const dh = d ? `<span class="kps-d ${d.dir}"><i class="ti ${d.dir === 'down' ? 'ti-arrow-down-right' : 'ti-arrow-up-right'}"></i>${d.pct}</span>` : '';
      const sp = (spark && it.spark) ? `<div class="kps-spark">${sparkSVG(it.spark, d && d.dir === 'down' ? 'var(--cm-danger)' : 'var(--cm-accent)')}</div>` : '';
      return `<div class="kps-it"><div class="kps-k"><i class="ti ${it.icon}"></i>${it.k}</div>`
        + `<div class="kps-v">${it.v}${it.u ? `<span class="u">${it.u}</span>` : ''}</div>${dh}${sp}</div>`;
    }).join('');
    return `<div class="kps ${spark ? 'has-spark' : ''}">${items}</div>`;
  }

  /* ---------- card chrome ---------- */
  const SZLABEL = { sm: 'S', md: 'M', lg: 'L' };
  function sizeToggle(active) {
    return '<div class="size-toggle">' + ['sm', 'md', 'lg'].map(s =>
      `<button class="${s === active ? 'is-on' : ''}">${SZLABEL[s]}</button>`).join('') + '</div>';
  }
  function card(title, sub, size, bodyHTML) {
    return `<div class="gp-c" data-size="${size}">`
      + `<div class="gp-c-h"><span class="ttl">${title}</span><span class="sub">${sub}</span>`
      + `<div class="right">${sizeToggle(size)}<button><i class="ti ti-dots"></i></button></div></div>`
      + `<div class="gp-c-b">${bodyHTML}</div></div>`;
  }
  function frame(size, dim, span, tag, cardHTML) {
    return `<div class="ref-frame" data-sz="${size}">`
      + `<div class="ref-cap"><span class="sz">${SZLABEL[size]}</span><span class="dim">${dim}</span>`
      + `<span class="tag">${span}</span>${tag ? `<span class="tag">· ${tag}</span>` : ''}</div>`
      + cardHTML + `</div>`;
  }

  /* ---------- data (illustrative) ---------- */
  const SINGLE = {
    cats: ['Vega', 'López', 'Barr.', 'Rivas', 'Pdes', 'Sosa', 'Mtz'],
    series: [{ name: 'High-speed running', color: 'var(--cm-accent)' }],
    data: [[812], [694], [640], [588], [528], [412], [388]],
    unit: 'm',
  };
  const MULTI = {
    cats: ['Vega', 'López', 'Barr.', 'Rivas', 'Pdes', 'Sosa'],
    series: [{ name: 'MC 46', color: 'var(--cm-accent)' }, { name: 'MC 45', muted: true }],
    data: [[812, 742], [694, 648], [640, 705], [588, 521], [528, 560], [412, 470]],
    unit: 'm',
  };

  const COMBO = {
    cats: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    bars: [5160, 10735, 9597, 6845, 4593, 9545, 3023],   // total distance (m)
    line: [98, 132, 126, 118, 102, 138, 88],             // intensity (m/min)
    barName: 'Total distance', unitL: 'm', leftMax: 12000,
    lineName: 'Intensidad', unitR: 'm/min', rightMax: 160,
  };

  function withSize(base, over) { return Object.assign({}, base, over); }

  /* ---------- line data (illustrative) ---------- */
  const MC = ['39', '40', '41', '42', '43', '44', '45', '46'];
  const LINE_MULTI = {
    cats: MC, unit: 'm',
    series: [
      { name: 'R. Vega · #7', color: 'var(--cm-accent)', values: [620, 680, 710, 760, 705, 790, 812, 742] },
      { name: 'F. Domínguez · #10', color: 'var(--cm-info)', values: [540, 590, 610, 640, 600, 628, 624, 648] },
      { name: 'S. Rivas · #9', color: 'var(--cm-violet)', values: [470, 520, 560, 588, 540, 600, 588, 521] },
    ],
  };
  const LINE_AREA = {
    cats: MC, unit: 'm',
    series: [
      { name: 'Squad avg HSR', color: 'var(--cm-accent)', area: true, values: [560, 600, 630, 662, 615, 672, 675, 637] },
      { name: 'Role baseline', color: 'var(--cm-fg-faint)', dashed: true, noDots: true, values: [600, 600, 615, 615, 625, 625, 635, 635] },
    ],
  };

  /* ---------- build the Bar section ---------- */
  function buildBars(root) {
    const dims = { sm: '300 × 212', md: '464 × 256', lg: '624 × 312' };
    const spans = { sm: 'span 4/12', md: 'span 6/12', lg: 'span 8/12' };

    // Block A — one series
    const a = [
      frame('sm', dims.sm, spans.sm, 'value labels off',
        card('High-speed running', 'HSR (m) · MC 46', 'sm', barChart(withSize(SINGLE, { size: 'sm', dataLabels: false })))),
      frame('md', dims.md, spans.md, 'value labels on',
        card('High-speed running', 'HSR (m) · MC 46', 'md', barChart(withSize(SINGLE, { size: 'md', dataLabels: true })))),
      frame('lg', dims.lg, spans.lg, 'value labels on',
        card('High-speed running', 'HSR (m) · MC 46 · vs role', 'lg', barChart(withSize(SINGLE, { size: 'lg', dataLabels: true })))),
    ].join('');

    // Block B — several series (grouped)
    const b = [
      frame('sm', dims.sm, spans.sm, 'value labels off',
        card('HSR — week on week', 'MC 46 vs 45', 'sm', barChart(withSize(MULTI, { size: 'sm', dataLabels: false })))),
      frame('md', dims.md, spans.md, 'value labels off',
        card('HSR — week on week', 'MC 46 vs MC 45 (m)', 'md', barChart(withSize(MULTI, { size: 'md', dataLabels: false })))),
      frame('lg', dims.lg, spans.lg, 'value labels on',
        card('HSR — week on week', 'MC 46 vs MC 45 (m)', 'lg', barChart(withSize(MULTI, { size: 'lg', dataLabels: true })))),
    ].join('');

    // Block C — combo (bars + line, secondary axis)
    const c = [
      frame('sm', dims.sm, spans.sm, 'línea sin labels',
        card('Carga + intensidad', 'TD (m) + m/min', 'sm', comboChart(withSize(COMBO, { size: 'sm', lineLabels: false })))),
      frame('md', dims.md, spans.md, 'eje secundario',
        card('Carga + intensidad', 'TD (m) · m/min · MC 46', 'md', comboChart(withSize(COMBO, { size: 'md', lineLabels: false })))),
      frame('lg', dims.lg, spans.lg, 'línea con labels',
        card('Carga + intensidad', 'TD (m) · m/min · MC 46', 'lg', comboChart(withSize(COMBO, { size: 'lg', lineLabels: true })))),
    ].join('');

    root.innerHTML =
      `<div class="ref-block">
         <div class="ref-block-h"><span class="t">Una serie</span><span class="d">single metric · vertical bars</span>
           <span class="note"><i class="ti ti-arrow-autofit-height"></i>El plot rellena la altura — sin bandas vacías en ningún tamaño</span></div>
         <div class="ref-shelf">${a}</div>
       </div>
       <div class="ref-block">
         <div class="ref-block-h"><span class="t">Varias series · agrupadas</span><span class="d">grouped · current vs previous</span>
           <span class="note"><i class="ti ti-palette"></i>3+ series escalan igual con la paleta del proyecto</span></div>
         <div class="ref-shelf">${b}</div>
       </div>
       <div class="ref-block">
         <div class="ref-block-h"><span class="t">Mixto · barras + línea</span><span class="d">combo · secondary axis</span>
           <span class="note"><i class="ti ti-chart-histogram"></i>Barra = volumen (eje izq) · línea = intensidad (eje der)</span></div>
         <div class="ref-shelf">${c}</div>
       </div>`;
  }

  /* ---------- build the Line section ---------- */
  function buildLines(root) {
    const dims = { sm: '300 × 212', md: '464 × 256', lg: '624 × 312' };
    const spans = { sm: 'span 4/12', md: 'span 6/12', lg: 'span 8/12' };

    const a = [
      frame('sm', dims.sm, spans.sm, 'puntos',
        card('HSR trend', 'HSR (m) · por jugador', 'sm', lineChart(withSize(LINE_MULTI, { size: 'sm' })))),
      frame('md', dims.md, spans.md, 'multi-serie',
        card('HSR trend', 'HSR (m) · últimos 8 MC', 'md', lineChart(withSize(LINE_MULTI, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, 'leyenda + ejes',
        card('HSR trend', 'HSR (m) · últimos 8 MC · 3 jugadores', 'lg', lineChart(withSize(LINE_MULTI, { size: 'lg' })))),
    ].join('');
    const b = [
      frame('sm', dims.sm, spans.sm, 'área on',
        card('Squad HSR · área', 'avg vs role', 'sm', lineChart(withSize(LINE_AREA, { size: 'sm' })))),
      frame('md', dims.md, spans.md, 'baseline punteada',
        card('Squad HSR · área', 'avg vs role baseline', 'md', lineChart(withSize(LINE_AREA, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, 'área + baseline',
        card('Squad HSR · área', 'avg vs role baseline · MC 39–46', 'lg', lineChart(withSize(LINE_AREA, { size: 'lg' })))),
    ].join('');

    root.innerHTML =
      `<div class="ref-block">
         <div class="ref-block-h"><span class="t">Multi-serie</span><span class="d">temporal · líneas + puntos</span>
           <span class="note"><i class="ti ti-line-dashed"></i>Paleta categórica del proyecto · un color por serie</span></div>
         <div class="ref-shelf">${a}</div>
       </div>
       <div class="ref-block">
         <div class="ref-block-h"><span class="t">Con área · opcional</span><span class="d">area fill + baseline</span>
           <span class="note"><i class="ti ti-chart-area-line"></i>Relleno suave bajo la serie principal · baseline punteada</span></div>
         <div class="ref-shelf">${b}</div>
       </div>`;
  }

  /* ---------- scatter data (illustrative) ---------- */
  const SC_CATS = [
    { id: 'def', name: 'Defenders', color: 'var(--cm-info)' },
    { id: 'mid', name: 'Midfielders', color: 'var(--cm-accent)' },
    { id: 'fwd', name: 'Forwards', color: 'var(--cm-warning)' },
    { id: 'gk', name: 'Goalkeeper', color: 'var(--cm-danger)' },
  ];
  const SC_POINTS = [
    { name: 'R. Vega', cat: 'fwd', x: 478, y: 812 },
    { name: 'S. Rivas', cat: 'fwd', x: 455, y: 760 },
    { name: 'P. Núñez', cat: 'fwd', x: 462, y: 705 },
    { name: 'L. Méndez', cat: 'fwd', x: 430, y: 668 },
    { name: 'T. López', cat: 'mid', x: 432, y: 694 },
    { name: 'J. Cardozo', cat: 'mid', x: 440, y: 648 },
    { name: 'F. Domínguez', cat: 'mid', x: 450, y: 624 },
    { name: 'M. Paredes', cat: 'mid', x: 415, y: 588 },
    { name: 'I. Barreiro', cat: 'def', x: 408, y: 560 },
    { name: 'G. Ríos', cat: 'def', x: 380, y: 520 },
    { name: 'D. Aguirre', cat: 'def', x: 390, y: 470 },
    { name: 'R. Sosa', cat: 'def', x: 372, y: 412 },
    { name: 'N. Ferreyra', cat: 'def', x: 360, y: 388 },
    { name: 'E. Galarza', cat: 'gk', x: 250, y: 95 },
  ];
  const SCATTER = {
    cats: SC_CATS, points: SC_POINTS,
    xMin: 200, xMax: 520, yMin: 0, yMax: 1000,
    xTitle: 'Player load · AU', yTitle: 'HSR · m', xUnit: 'AU', yUnit: 'm',
  };

  /* ---------- build the Scatter section ---------- */
  function buildScatter(root) {
    const dims = { sm: '300 × 212', md: '464 × 256', lg: '624 × 312' };
    const spans = { sm: 'span 4/12', md: 'span 6/12', lg: 'span 8/12' };
    const mono = Object.assign({}, SCATTER, { cats: [{ id: 'all', name: 'Players', color: 'var(--cm-accent)' }], points: SC_POINTS.map(p => Object.assign({}, p, { cat: 'all' })) });

    const a = [
      frame('sm', dims.sm, spans.sm, 'líneas avg',
        card('Load × HSR', 'por posición', 'sm', scatterChart(withSize(SCATTER, { size: 'sm' })))),
      frame('md', dims.md, spans.md, '4 categorías',
        card('Load × HSR', 'por posición · MC 46', 'md', scatterChart(withSize(SCATTER, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, 'cuadrantes avg',
        card('Load × HSR', 'por posición · MC 46 · 14 jugadores', 'lg', scatterChart(withSize(SCATTER, { size: 'lg' })))),
    ].join('');
    const b = [
      frame('sm', dims.sm, spans.sm, 'mono',
        card('Load × HSR', 'sin categorías', 'sm', scatterChart(withSize(mono, { size: 'sm' })))),
      frame('md', dims.md, spans.md, 'una serie',
        card('Load × HSR', 'plantel · MC 46', 'md', scatterChart(withSize(mono, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, 'líneas de referencia',
        card('Load × HSR', 'plantel · promedio X/Y', 'lg', scatterChart(withSize(mono, { size: 'lg' })))),
    ].join('');

    root.innerHTML =
      `<div class="ref-block">
         <div class="ref-block-h"><span class="t">Color por categoría</span><span class="d">position groups · avg lines</span>
           <span class="note"><i class="ti ti-grid-pattern"></i>Líneas de promedio X/Y → cuatro cuadrantes de lectura</span></div>
         <div class="ref-shelf">${a}</div>
       </div>
       <div class="ref-block">
         <div class="ref-block-h"><span class="t">Una categoría</span><span class="d">mono · reference lines</span>
           <span class="note"><i class="ti ti-circle"></i>Sin grupos: un solo color + líneas de referencia</span></div>
         <div class="ref-shelf">${b}</div>
       </div>`;
  }

  /* ---------- ranking + KPI data (illustrative) ---------- */
  const RANK = {
    rows: [
      { name: 'R. Vega', pos: '#7', val: 812, move: 0 },
      { name: 'S. Rivas', pos: '#9', val: 760, move: 1 },
      { name: 'P. Núñez', pos: '#19', val: 705, move: 2 },
      { name: 'T. López', pos: '#11', val: 694, move: -1 },
      { name: 'L. Méndez', pos: '#17', val: 668, move: 0 },
      { name: 'J. Cardozo', pos: '#8', val: 648, move: 3 },
      { name: 'F. Domínguez', pos: '#10', val: 624, move: -2 },
      { name: 'M. Paredes', pos: '#6', val: 588, move: -1 },
      { name: 'I. Barreiro', pos: '#18', val: 560, move: 1 },
      { name: 'G. Ríos', pos: '#3', val: 520, move: 0 },
      { name: 'D. Aguirre', pos: '#22', val: 470, move: -3 },
    ],
  };
  const KPI = {
    icon: 'ti-route', label: 'Total distance', range: 'MC 46', value: '49.5', unit: 'km',
    delta: { dir: 'up', pct: '+8%', cmp: 'vs MC 45' },
    sub: '<b>z = +0.6</b> vs role baseline · 7 sessions',
    spark: [42.1, 45.3, 47.0, 49.2, 46.4, 50.1, 48.7, 49.5],
    foot: [{ k: 'Peak', v: '10.7 km' }, { k: 'Avg/sess', v: '7.1 km' }, { k: 'Sessions', v: '7' }],
  };
  const KSTRIP = {
    items: [
      { icon: 'ti-battery-3', k: 'Int load', v: '3,961', u: 'AU', d: { dir: 'up', pct: '+6%' }, spark: [3600, 3720, 3810, 3900, 3850, 3940, 3961] },
      { icon: 'ti-route', k: 'Distance', v: '49.5', u: 'km', d: { dir: 'up', pct: '+8%' }, spark: [46, 47.5, 48, 49, 47.8, 50.1, 49.5] },
      { icon: 'ti-bolt', k: 'HSR', v: '3,464', u: 'm', d: { dir: 'up', pct: '+12%' }, spark: [3100, 3200, 3300, 3400, 3350, 3450, 3464] },
      { icon: 'ti-flame', k: 'Sprints', v: '96', u: '', d: { dir: 'down', pct: '−5%' }, spark: [110, 104, 100, 98, 101, 99, 96] },
      { icon: 'ti-arrows-up-down', k: 'Acc+dec', v: '402', u: '', d: { dir: 'down', pct: '−3%' }, spark: [430, 420, 415, 410, 412, 408, 402] },
      { icon: 'ti-brand-speedtest', k: 'Max vel', v: '30.9', u: 'km/h', d: { dir: 'up', pct: '+0.4' }, spark: [30.2, 30.5, 30.6, 30.8, 30.7, 30.9, 30.9] },
    ],
  };

  /* ---------- build the Ranking + KPI section ---------- */
  function buildRankKpi(root) {
    const dims = { sm: '300 × 212', md: '464 × 256', lg: '624 × 312' };
    const spans = { sm: 'span 4/12', md: 'span 6/12', lg: 'span 8/12' };

    const a = [
      frame('sm', dims.sm, spans.sm, 'top 5',
        card('HSR ranking', 'MC 46 · m', 'sm', rankChart(withSize(RANK, { size: 'sm' })))),
      frame('md', dims.md, spans.md, 'top 8',
        card('HSR ranking', 'MC 46 · m', 'md', rankChart(withSize(RANK, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, 'top 11 · Δ puesto',
        card('HSR ranking', 'MC 46 · m · Δ vs MC 45', 'lg', rankChart(withSize(RANK, { size: 'lg', moves: true })))),
    ].join('');
    const b = [
      frame('sm', dims.sm, spans.sm, 'número + delta',
        card('KPI · Total distance', 'MC 46', 'sm', kpiCard(withSize(KPI, { size: 'sm' })))),
      frame('md', dims.md, spans.md, '+ sparkline',
        card('KPI · Total distance', 'MC 46 · vs MC 45', 'md', kpiCard(withSize(KPI, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, '+ contexto',
        card('KPI · Total distance', 'MC 46 · vs MC 45', 'lg', kpiCard(withSize(KPI, { size: 'lg' })))),
    ].join('');
    const c = [
      frame('sm', dims.sm, spans.sm, '3 KPIs',
        card('Player week KPIs', 'strip', 'sm', kpiStrip(withSize(KSTRIP, { size: 'sm' })))),
      frame('md', dims.md, spans.md, '4 KPIs',
        card('Player week KPIs', 'strip · vs MC 45', 'md', kpiStrip(withSize(KSTRIP, { size: 'md' })))),
      frame('lg', dims.lg, spans.lg, '6 KPIs · +/−',
        card('Player week KPIs', 'strip · vs MC 45', 'lg', kpiStrip(withSize(KSTRIP, { size: 'lg' })))),
    ].join('');

    root.innerHTML =
      `<div class="ref-block">
         <div class="ref-block-h"><span class="t">Ranking horizontal</span><span class="d">name · bar · value</span>
           <span class="note"><i class="ti ti-arrow-autofit-height"></i>Las filas crecen para llenar la altura · más puestos al agrandar</span></div>
         <div class="ref-shelf">${a}</div>
       </div>
       <div class="ref-block">
         <div class="ref-block-h"><span class="t">KPI</span><span class="d">big number · label · delta + sparkline</span>
           <span class="note"><i class="ti ti-arrow-up-right"></i>Delta vs comparación con flecha · verde sube / rojo baja</span></div>
         <div class="ref-shelf">${b}</div>
       </div>
       <div class="ref-block">
         <div class="ref-block-h"><span class="t">KPI strip · compuesto</span><span class="d">mini-KPIs · +/−</span>
           <span class="note"><i class="ti ti-layout-navbar"></i>La cabecera real de Player Week · más KPIs entran al agrandar</span></div>
         <div class="ref-shelf">${c}</div>
       </div>`;
  }

  /* ---------- tooltip (shared) ---------- */
  function initTooltip() {
    const tip = document.createElement('div');
    tip.className = 'bc-tip';
    document.body.appendChild(tip);
    let active = null;
    document.addEventListener('mouseover', e => {
      const bar = e.target.closest && e.target.closest('.bc-bar, .bc-dot');
      if (!bar) return;
      active = bar;
      const muted = bar.dataset.muted === '1';
      const sw = muted ? 'background:var(--cm-bg-sunk);border:1px solid var(--cm-border-strong)' : `background:${bar.dataset.color}`;
      tip.innerHTML = `<div class="tc">${bar.dataset.cat}</div>`
        + `<div class="tr"><i style="${sw}"></i>${bar.dataset.series}<b>${bar.dataset.val}</b></div>`;
      tip.classList.add('on');
    });
    document.addEventListener('mousemove', e => {
      if (!tip.classList.contains('on')) return;
      let x = e.clientX + 14, y = e.clientY + 14;
      const r = tip.getBoundingClientRect();
      if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    document.addEventListener('mouseout', e => {
      if (active && (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.bc-bar, .bc-dot'))) {
        tip.classList.remove('on'); active = null;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.getElementById('barSection');
    if (bar) buildBars(bar);
    const line = document.getElementById('lineSection');
    if (line) buildLines(line);
    const scatter = document.getElementById('scatterSection');
    if (scatter) buildScatter(scatter);
    const rankkpi = document.getElementById('rankKpiSection');
    if (rankkpi) buildRankKpi(rankkpi);
    initTooltip();

    // section tabs
    const nav = document.querySelector('.ref-nav');
    if (nav) nav.addEventListener('click', e => {
      const b = e.target.closest('button[data-sec]');
      if (!b) return;
      nav.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      document.querySelectorAll('.ref-sec').forEach(s => s.classList.toggle('is-on', s.dataset.sec === b.dataset.sec));
      window.scrollTo(0, 0);
    });
  });
})();
