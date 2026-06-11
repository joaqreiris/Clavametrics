/* =============================================================
   Availability — Evolución temporal (línea % disponible + heatmap)
   SVG puro, sin dependencias. NO calcula datos: recibe la serie ya
   armada y solo dibuja. Expuesto como window.AvEvolution.render().

   API:
     window.AvEvolution.render(container, days, opts)
       container : nodo que contiene los #aev-* (no se usa para query,
                   los IDs son únicos en la página; se acepta por claridad)
       days      : array ORDENADO por fecha de
                   { date:Date, disp, mod, les, enf, sel, aus, total, pct, match }
       opts.total: N del plantel (denominador); default days[0].total
   ============================================================= */
(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";

  const STATUS = [
    { key: "disp", label: "Disponible",  v: "--st-disp" },
    { key: "mod",  label: "Modificado",  v: "--st-mod"  },
    { key: "les",  label: "Lesión",      v: "--st-les"  },
    { key: "enf",  label: "Enfermedad",  v: "--st-enf"  },
    { key: "sel",  label: "Selección",   v: "--st-sel"  },
    { key: "aus",  label: "Ausente",     v: "--st-aus"  },
  ];
  const STACK = ["disp", "mod", "les", "enf", "sel", "aus"];

  const DOW  = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const DOW1 = ["L", "M", "X", "J", "V", "S", "D"]; // lunes primero
  const MON  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fShort = (d) => `${d.getDate()} ${MON[d.getMonth()]}`;
  const fFull  = (d) => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
  const monday = (d) => (d.getDay() + 6) % 7; // 0 = lunes

  function colorOf(key) {
    const meta = STATUS.find((s) => s.key === key);
    return getComputedStyle(document.documentElement).getPropertyValue(meta.v).trim();
  }

  /* ─── Estado del render (seteado por render()) ──────────── */
  let data = [];
  let N = 0;

  /* ─── SVG helpers ───────────────────────────────────────── */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function makeSvg(host, w, h) {
    host.innerHTML = "";
    const s = el("svg", { class: "aev-svg", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "xMidYMid meet" });
    s.style.width = "100%";
    host.appendChild(s);
    return s;
  }

  /* ─── Tooltip (el #aev-tip se busca en cada render: el markup
         se recrea dentro de avRenderStats() cada vez) ───────── */
  function tipEl() { return document.getElementById("aev-tip"); }
  function showTip(html, x, y) {
    const tip = tipEl();
    if (!tip) return;
    tip.innerHTML = html;
    tip.classList.add("on");
    const r = tip.getBoundingClientRect();
    let nx = x + 14, ny = y - r.height - 10;
    if (nx + r.width > window.innerWidth - 8) nx = x - r.width - 14;
    if (ny < 8) ny = y + 16;
    tip.style.left = nx + "px";
    tip.style.top = ny + "px";
  }
  function hideTip() { const tip = tipEl(); if (tip) tip.classList.remove("on"); }
  function tipRows(row, keys) {
    let h = `<div class="tc">${fFull(row.date)}${row.match ? " · partido" : ""}</div>`;
    (keys || STACK).forEach((k) => {
      if (row[k] <= 0) return;
      const m = STATUS.find((s) => s.key === k);
      h += `<div class="tr"><i style="background:${colorOf(k)}"></i>${m.label}<b>${row[k]}</b></div>`;
    });
    return h;
  }

  function nearestIndex(svg, clientX, pad, plotW, w, n) {
    const r = svg.getBoundingClientRect();
    const vbX = ((clientX - r.left) / r.width) * w;
    const i = Math.round(((vbX - pad.l) / plotW) * (n - 1));
    return clamp(i, 0, n - 1);
  }

  /* ─── Variante B — Línea de % + zona saludable ──────────── */
  function renderLine(host, opts) {
    if (!host) return;
    opts = opts || {};
    const w = opts.w || 960, h = opts.h || 300, compact = !!opts.compact;
    const pad = compact ? { l: 26, r: 10, t: 10, b: 18 } : { l: 36, r: 16, t: 16, b: 26 };
    const n = data.length;
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
    const LO = 50, HI = 100;
    const svg = makeSvg(host, w, h);
    const X = (i) => pad.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const Y = (p) => pad.t + plotH - ((clamp(p, LO, HI) - LO) / (HI - LO)) * plotH;

    el("rect", { class: "zone-ok",   x: pad.l, width: plotW, y: Y(HI), height: Y(85) - Y(HI) }, svg);
    el("rect", { class: "zone-warn", x: pad.l, width: plotW, y: Y(85), height: Y(70) - Y(85) }, svg);
    el("rect", { class: "zone-crit", x: pad.l, width: plotW, y: Y(70), height: Y(LO) - Y(70) }, svg);

    let sa = -1, sb = -1;
    data.forEach((r, i) => { if (r.sel > 0) { if (sa < 0) sa = i; sb = i; } });
    if (sa >= 0) {
      const x1 = X(sa), x2 = X(sb);
      el("rect", { class: "annot-band", x: x1, width: Math.max(2, x2 - x1), y: pad.t, height: plotH }, svg);
      el("line", { class: "annot-line", x1, x2: x1, y1: pad.t, y2: pad.t + plotH }, svg);
      el("line", { class: "annot-line", x1: x2, x2, y1: pad.t, y2: pad.t + plotH }, svg);
      if (!compact) el("text", { class: "annot-txt", x: (x1 + x2) / 2, y: pad.t + 11, "text-anchor": "middle" }, svg).textContent = "Parón selecciones";
    }

    const ticks = compact ? [70, 85, 100] : [60, 70, 80, 85, 90, 100];
    ticks.forEach((p) => {
      el("line", { class: "grid-line", x1: pad.l, x2: pad.l + plotW, y1: Y(p), y2: Y(p) }, svg);
      if (!compact) el("text", { class: "axis-txt", x: pad.l - 6, y: Y(p) + 3, "text-anchor": "end" }, svg).textContent = p;
    });
    el("line", { class: "thresh", x1: pad.l, x2: pad.l + plotW, y1: Y(85), y2: Y(85) }, svg);
    if (!compact) el("text", { class: "thresh-lbl", x: pad.l + plotW - 2, y: Y(85) - 5, "text-anchor": "end" }, svg).textContent = "85% objetivo";

    if (!compact) {
      const step = n <= 14 ? 2 : n <= 30 ? 5 : 7;
      for (let i = 0; i < n; i += step) {
        el("text", { class: "axis-txt", x: X(i), y: h - 6, "text-anchor": "middle" }, svg).textContent = fShort(data[i].date);
      }
    }

    let area = `M ${X(0)} ${Y(LO)}`;
    data.forEach((r, i) => (area += ` L ${X(i)} ${Y(r.pct)}`));
    area += ` L ${X(n - 1)} ${Y(LO)} Z`;
    el("path", { class: "pct-area", d: area }, svg);
    let line = "";
    data.forEach((r, i) => (line += (i ? " L " : "M ") + X(i) + " " + Y(r.pct)));
    el("path", { class: "pct-line", d: line }, svg);

    const showAll = n <= 16;
    data.forEach((r, i) => {
      if (showAll || r.pct < 85) el("circle", { class: "pct-dot" + (r.pct < 85 ? " lo" : ""), cx: X(i), cy: Y(r.pct), r: compact ? 2.5 : 3.5 }, svg);
    });

    const guide = el("line", { class: "hover-guide", y1: pad.t, y2: pad.t + plotH }, svg);
    const mk = el("circle", { class: "hover-marker", r: 4.5, fill: "var(--cm-surface)", stroke: "var(--cm-fg-strong)", "stroke-width": 2.25 }, svg);
    const hit = el("rect", { class: "aev-hit", x: pad.l, y: pad.t, width: plotW, height: plotH }, svg);
    hit.addEventListener("mousemove", (e) => {
      const i = nearestIndex(svg, e.clientX, pad, plotW, w, n);
      const r = data[i];
      guide.setAttribute("x1", X(i)); guide.setAttribute("x2", X(i)); guide.classList.add("on");
      mk.setAttribute("cx", X(i)); mk.setAttribute("cy", Y(r.pct)); mk.classList.add("on");
      mk.setAttribute("stroke", r.pct < 85 ? colorOf("les") : "var(--cm-fg-strong)");
      const head = `<div class="tc">${fFull(r.date)}</div><div class="tr"><i style="background:${colorOf("disp")}"></i>Disponible<b>${r.pct}%</b></div><div class="tr"><i style="background:var(--cm-fg-faint)"></i>Jugadores<b>${r.disp}/${N}</b></div>`;
      showTip(head, e.clientX, e.clientY);
    });
    hit.addEventListener("mouseleave", () => { guide.classList.remove("on"); mk.classList.remove("on"); hideTip(); });
  }

  /* ─── Variante C — Heatmap calendario ───────────────────── */
  function bucket(pct) {
    if (pct < 70) return { c: colorOf("les"), lab: "Crítico" };
    if (pct < 80) return { c: colorOf("mod"), lab: "Bajo" };
    if (pct < 90) return { c: "#84CC16",      lab: "Aceptable" };
    return { c: colorOf("disp"), lab: "Óptimo" };
  }
  function renderHeatmap() {
    const grid = document.getElementById("aev-c-grid");
    if (!grid) return;
    grid.innerHTML = "";
    DOW1.forEach((d) => {
      const h = document.createElement("div"); h.className = "hm-dow"; h.textContent = d; grid.appendChild(h);
    });
    const lead = monday(data[0].date);
    for (let k = 0; k < lead; k++) {
      const c = document.createElement("div"); c.className = "hm-cell empty"; grid.appendChild(c);
    }
    data.forEach((r) => {
      const b = bucket(r.pct);
      const cell = document.createElement("div");
      cell.className = "hm-cell" + (r.match ? " is-match" : "");
      cell.style.background = `color-mix(in srgb, ${b.c} 16%, var(--cm-surface))`;
      cell.style.borderColor = `color-mix(in srgb, ${b.c} 35%, var(--cm-border))`;
      cell.style.color = b.c;
      cell.innerHTML =
        `<div class="d" style="color:var(--cm-fg-strong)">${r.date.getDate()}</div>` +
        `<div class="p">${r.pct}%</div>` +
        `<div class="sub">${r.disp}/${N}</div>`;
      cell.addEventListener("mouseenter", (e) => showTip(tipRows(r), e.clientX, e.clientY));
      cell.addEventListener("mousemove", (e) => showTip(tipRows(r), e.clientX, e.clientY));
      cell.addEventListener("mouseleave", hideTip);
      grid.appendChild(cell);
    });

    const rows = document.getElementById("aev-c-rows");
    if (!rows) return;
    rows.innerHTML = "";
    [
      { c: colorOf("disp"), b: "Óptimo", r: "≥ 90%" },
      { c: "#84CC16",       b: "Aceptable", r: "80–89%" },
      { c: colorOf("mod"),  b: "Bajo", r: "70–79%" },
      { c: colorOf("les"),  b: "Crítico", r: "< 70%" },
    ].forEach((x) => {
      const d = document.createElement("div"); d.className = "r";
      d.innerHTML = `<span class="ch" style="background:${x.c}"></span><span><b>${x.b}</b> · ${x.r}</span>`;
      rows.appendChild(d);
    });
  }

  /* ─── Stats de cabecera ─────────────────────────────────── */
  function renderStats() {
    const n = data.length, last = data[n - 1];
    const avg = Math.round(data.reduce((a, r) => a + r.pct, 0) / n);
    let min = data[0], max = data[0];
    data.forEach((r) => { if (r.pct < min.pct) min = r; if (r.pct > max.pct) max = r; });

    const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    set("aev-b-stat-now", last.pct + "%");
    set("aev-b-stat-avg", avg + "%");
    set("aev-b-stat-min", min.pct + "%");
    set("aev-c-sub", `${fShort(data[0].date)} → ${fShort(last.date)}`);
    set("aev-c-stat-best", max.pct + "%");
    set("aev-c-stat-worst", min.pct + "%");

    const meta = document.getElementById("aev-range-meta");
    if (meta) meta.innerHTML =
      `<b>${fShort(data[0].date)}</b> → <b>${fShort(last.date)}</b> · ${n} días · ${data.filter((r) => r.match).length} partidos`;
  }

  /* ─── Leyenda ───────────────────────────────────────────── */
  function renderLegend() {
    const lg = document.getElementById("aev-legend");
    if (!lg) return;
    lg.innerHTML = "";
    STATUS.forEach((s) => {
      const it = document.createElement("span"); it.className = "it";
      it.innerHTML = `<span class="sw" style="background:${colorOf(s.key)}"></span>${s.label}`;
      lg.appendChild(it);
    });
  }

  /* ─── API pública ───────────────────────────────────────── */
  window.AvEvolution = {
    render(container, days, opts) {
      opts = opts || {};
      data = Array.isArray(days) ? days : [];
      N = opts.total != null ? opts.total : (data[0] ? data[0].total : 0);
      if (!data.length) return;
      renderLegend();
      renderStats();
      renderLine(document.getElementById("aev-b-body"));
      renderHeatmap();
    }
  };
})();
