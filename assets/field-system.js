/* ============================================================
   ClavaMetrics — Planner Field System
   Switchable, vector (SVG) pitch renderer for the tactical board.

   Replaces the fixed assets/field.jpg background with a crisp,
   theme-aware SVG that scales sharp at any zoom and supports
   multiple sports + variants (Full / Half / Blank).

   No external libraries — native SVG only.

   PUBLIC API (window.CMField):
     FIELDS                       → the extensible field model
     renderField(host, sport, variant)
                                  → paints the pitch into `host` (a DOM node)
     options()                    → [{sport,label,variants:[...]}] for the UI

   Coordinate note: the SVG is fully self-contained and letterboxed
   (preserveAspectRatio="xMidYMid meet") on top of a full-bleed grass
   layer. Tactical objects keep their own %-based coordinate system on
   the container, so changing the field never moves or clears them.
   ============================================================ */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  /* ---- tiny SVG builders ------------------------------------ */
  function n(tag, attrs, kids) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(c => c && e.appendChild(c));
    return e;
  }
  const line  = (x1, y1, x2, y2) => n('line',   { x1, y1, x2, y2 });
  const rect  = (x, y, w, h, extra) => n('rect', Object.assign({ x, y, width: w, height: h }, extra || {}));
  const circ  = (cx, cy, r, extra) => n('circle', Object.assign({ cx, cy, r }, extra || {}));
  const path  = (d, extra) => n('path', Object.assign({ d }, extra || {}));

  /* ============================================================
     FOOTBALL — full markings (horizontal pitch)
     viewBox 1050 × 680 ; playing rect inset to leave a runoff
     margin of grass around the lines.
     ============================================================ */
  const FB = { vbW: 1050, vbH: 680, x0: 30, y0: 30, x1: 1020, y1: 650 };
  FB.pw = FB.x1 - FB.x0;      // 990
  FB.ph = FB.y1 - FB.y0;      // 620
  FB.cx = (FB.x0 + FB.x1) / 2; // 525
  FB.cy = (FB.y0 + FB.y1) / 2; // 340

  function footballMarkings(half) {
    const g = n('g', {
      fill: 'none',
      stroke: 'var(--pf-line)',
      'stroke-width': 2.4,
      'stroke-linejoin': 'round'
    });
    const dot = n('g', { fill: 'var(--pf-line)', stroke: 'none' });

    const { x0, y0, x1, y1, pw, ph, cx, cy } = FB;

    // Outer boundary
    g.appendChild(rect(x0, y0, pw, ph));
    // Halfway line
    g.appendChild(line(cx, y0, cx, y1));
    // Centre circle + spot
    g.appendChild(circ(cx, cy, 92));
    dot.appendChild(circ(cx, cy, 3.2));

    // Penalty + goal areas, spots, arcs (left, then mirror for right)
    const boxDepth = 155, boxHalf = 184;   // 16.5m area
    const gaDepth  = 52,  gaHalf  = 84;    // 5.5m area
    const spotIn   = 104;                  // 11m penalty spot
    const arcR     = 92;

    function endZone(side) {
      const dir = side === 'left' ? 1 : -1;
      const gx  = side === 'left' ? x0 : x1;            // goal line x
      // Penalty area
      g.appendChild(rect(side === 'left' ? x0 : x1 - boxDepth, cy - boxHalf, boxDepth, boxHalf * 2));
      // Goal area
      g.appendChild(rect(side === 'left' ? x0 : x1 - gaDepth, cy - gaHalf, gaDepth, gaHalf * 2));
      // Penalty spot
      const sx = gx + dir * spotIn;
      dot.appendChild(circ(sx, cy, 3.2));
      // Penalty arc (D) — only the segment outside the box
      const boxEdge = gx + dir * boxDepth;
      const dx = Math.abs(boxEdge - sx);
      const dy = Math.sqrt(Math.max(0, arcR * arcR - dx * dx));
      const sweep = side === 'left' ? 1 : 0;
      g.appendChild(path(
        `M ${boxEdge} ${cy - dy} A ${arcR} ${arcR} 0 0 ${sweep} ${boxEdge} ${cy + dy}`
      ));
      // Goal (behind the line)
      const goalH = 44, goalD = 14;
      g.appendChild(rect(side === 'left' ? x0 - goalD : x1, cy - goalH / 2, goalD, goalH,
        { stroke: 'var(--pf-line)', 'stroke-width': 1.8 }));
    }

    endZone('left');
    if (!half) endZone('right');

    // Corner arcs
    const cr = 11;
    const corners = half
      ? [[x0, y0, 1], [x0, y1, 2]]
      : [[x0, y0, 1], [x1, y0, 2], [x1, y1, 3], [x0, y1, 4]];
    corners.forEach(([cxp, cyp, q]) => {
      const sx = cxp + (q === 2 || q === 3 ? -cr : cr);
      const ex = cxp;
      const sy = cyp;
      const ey = cyp + (q === 3 || q === 4 ? -cr : cr);
      g.appendChild(path(`M ${sx} ${sy} A ${cr} ${cr} 0 0 1 ${ex} ${ey}`));
    });

    return [g, dot];
  }

  /* ============================================================
     SPORT STUBS — declared & selectable, drawn as a clean blank
     surface with a faint "coming soon" note. Implement real
     markings here later WITHOUT touching the rest of the system.
     ============================================================ */

  /* ---- shared helpers for sport markings -------------------- */
  function mkG(extra) {
    return n('g', Object.assign({
      fill: 'none', stroke: 'var(--pf-line)', 'stroke-width': 2.4,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, extra || {}));
  }
  function mkDots() { return n('g', { fill: 'var(--pf-line)', stroke: 'none' }); }
  // pitch rect from a viewBox, leaving a runoff margin of grass
  function pr(vbW, vbH, m) {
    m = (m == null) ? 30 : m;
    const x0 = m, y0 = m, x1 = vbW - m, y1 = vbH - m;
    return { x0, y0, x1, y1, pw: x1 - x0, ph: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  // "D"-shaped area: two quarter-arcs of radius R from the goalposts,
  // joined by a straight line (futsal / hockey shooting circle).
  function dArea(g, P, dir, gh, R) {
    const gx = dir > 0 ? P.x0 : P.x1;
    const cy = P.cy, sweep = dir > 0 ? 1 : 0, ix = gx + dir * R;
    g.appendChild(path(
      `M ${gx} ${cy - gh - R} A ${R} ${R} 0 0 ${sweep} ${ix} ${cy - gh} ` +
      `L ${ix} ${cy + gh} A ${R} ${R} 0 0 ${sweep} ${gx} ${cy + gh + R}`
    ));
  }
  function goalBox(g, P, dir, gh, depth) {
    const gx = dir > 0 ? P.x0 : P.x1;
    g.appendChild(rect(dir > 0 ? gx - depth : gx, P.cy - gh, depth, gh * 2,
      { 'stroke-width': 1.8 }));
  }

  /* ---- FUTSAL (40×20 court) --------------------------------- */
  function futsalMarkings() {
    const P = pr(1060, 560), g = mkG(), d = mkDots();
    const gh = P.ph * 0.075, R = P.pw * 0.15;
    g.appendChild(rect(P.x0, P.y0, P.pw, P.ph));
    g.appendChild(line(P.cx, P.y0, P.cx, P.y1));
    g.appendChild(circ(P.cx, P.cy, P.pw * 0.075));
    d.appendChild(circ(P.cx, P.cy, 3));
    [1, -1].forEach(dir => {
      const gx = dir > 0 ? P.x0 : P.x1;
      dArea(g, P, dir, gh, R);
      goalBox(g, P, dir, gh, P.pw * 0.012);
      d.appendChild(circ(gx + dir * R, P.cy, 3));            // 6m penalty mark
      d.appendChild(circ(gx + dir * P.pw * 0.25, P.cy, 3));  // 10m second mark
    });
    // substitution zones — ticks on the bench-side touchline (5m gap + 5m zones)
    [0.125, 0.25].forEach(f => [1, -1].forEach(s => {
      const x = P.cx + s * P.pw * f;
      g.appendChild(line(x, P.y0 - 9, x, P.y0 + 9));
    }));
    return [g, d];
  }

  /* ---- BASKETBALL (28×15 court) ----------------------------- */
  function basketballMarkings() {
    const P = pr(1060, 596), g = mkG(), d = mkDots();
    g.appendChild(rect(P.x0, P.y0, P.pw, P.ph));
    g.appendChild(line(P.cx, P.y0, P.cx, P.y1));
    g.appendChild(circ(P.cx, P.cy, P.ph * 0.12));
    d.appendChild(circ(P.cx, P.cy, 3));
    const keyDepth = P.pw * 0.207, keyHalf = P.ph * 0.163;
    const R3 = P.pw * 0.30, cH = P.ph * 0.45;
    [1, -1].forEach(dir => {
      const gx = dir > 0 ? P.x0 : P.x1;
      const hoopX = gx + dir * P.pw * 0.056;
      // key + free-throw circle
      g.appendChild(rect(dir > 0 ? gx : gx - keyDepth, P.cy - keyHalf, keyDepth, keyHalf * 2));
      g.appendChild(circ(gx + dir * keyDepth, P.cy, P.ph * 0.12));
      // backboard + hoop
      g.appendChild(line(gx + dir * P.pw * 0.043, P.cy - P.ph * 0.06, gx + dir * P.pw * 0.043, P.cy + P.ph * 0.06));
      g.appendChild(circ(hoopX, P.cy, P.ph * 0.027));
      // restricted-area (no-charge) semicircle under the hoop
      const rr = P.pw * 0.045;
      g.appendChild(path(`M ${hoopX} ${P.cy - rr} A ${rr} ${rr} 0 0 ${sweep} ${hoopX} ${P.cy + rr}`));
      // three-point line: corner straights + arc
      const dxArc = Math.sqrt(Math.max(0, R3 * R3 - cH * cH));
      const ax = hoopX + dir * dxArc, sweep = dir > 0 ? 1 : 0;
      g.appendChild(line(gx, P.cy - cH, ax, P.cy - cH));
      g.appendChild(line(gx, P.cy + cH, ax, P.cy + cH));
      g.appendChild(path(`M ${ax} ${P.cy - cH} A ${R3} ${R3} 0 0 ${sweep} ${ax} ${P.cy + cH}`));
    });
    return [g, d];
  }

  /* ---- FIELD HOCKEY (91.4×55) ------------------------------- */
  function hockeyMarkings() {
    const P = pr(1060, 662), g = mkG(), gd = mkG({ 'stroke-dasharray': '7 9' }), d = mkDots();
    const gh = P.ph * 0.033, R = P.pw * 0.16;
    g.appendChild(rect(P.x0, P.y0, P.pw, P.ph));
    g.appendChild(line(P.cx, P.y0, P.cx, P.y1));
    d.appendChild(circ(P.cx, P.cy, 3));
    [1, -1].forEach(dir => {
      const gx = dir > 0 ? P.x0 : P.x1;
      // 23m lines
      const x23 = gx + dir * P.pw * 0.252;
      g.appendChild(line(x23, P.y0, x23, P.y1));
      // shooting circle (D) + dashed outer line 5m beyond + goal + penalty spot
      dArea(g, P, dir, gh, R);
      dArea(gd, P, dir, gh, R + P.pw * 0.055);
      goalBox(g, P, dir, gh, P.pw * 0.011);
      d.appendChild(circ(gx + dir * P.pw * 0.07, P.cy, 3)); // 6.4m penalty spot
    });
    return [g, gd, d];
  }

  /* ---- RUGBY (100m play + 8m in-goal each end, 68m wide) ---- */
  function rugbyMarkings() {
    const P = pr(1060, 646), g = mkG(), d = mkDots();
    const dash = { 'stroke-dasharray': '10 9' };
    g.appendChild(rect(P.x0, P.y0, P.pw, P.ph));          // dead-ball boundary
    const inGoal = P.pw * 0.069;
    const tL = P.x0 + inGoal, tR = P.x1 - inGoal, play = tR - tL;
    g.appendChild(line(tL, P.y0, tL, P.y1));              // try lines
    g.appendChild(line(tR, P.y0, tR, P.y1));
    g.appendChild(line(P.cx, P.y0, P.cx, P.y1));          // halfway
    [tL + play * 0.22, tR - play * 0.22].forEach(x =>     // 22m lines
      g.appendChild(line(x, P.y0, x, P.y1, dash)));
    [P.cx - play * 0.10, P.cx + play * 0.10].forEach(x => // 10m lines
      g.appendChild(line(x, P.y0, x, P.y1, dash)));
    // 5m & 15m lines parallel to the touchlines (lengthwise, broken)
    [0.073, 0.22].forEach(fr =>
      [P.y0 + P.ph * fr, P.y1 - P.ph * fr].forEach(y =>
        g.appendChild(line(tL, y, tR, y, dash))));
    // 5m lines inside each try line (broken, parallel to goal line)
    [tL + play * 0.05, tR - play * 0.05].forEach(x =>
      g.appendChild(line(x, P.y0, x, P.y1, dash)));
    const postHalf = P.ph * 0.041;
    [tL, tR].forEach(x => {                               // H goalposts
      g.appendChild(line(x, P.cy - postHalf, x, P.cy + postHalf, { 'stroke-width': 3 }));
      const dir = x === tL ? 1 : -1;
      g.appendChild(line(x, P.cy - postHalf, x + dir * P.pw * 0.02, P.cy - postHalf, { 'stroke-width': 3 }));
      g.appendChild(line(x, P.cy + postHalf, x + dir * P.pw * 0.02, P.cy + postHalf, { 'stroke-width': 3 }));
    });
    return [g, d];
  }

  /* ============================================================
     FIELD MODEL — extensible registry.
       aspect : width/height ratio of the markings viewBox
       draw(variant) → array of <g> SVG nodes for the markings layer
       variants     → which variants the sport exposes
     'blank' is transversal: every sport supports a marks-free
     surface (for activations / free sessions).
     ============================================================ */
  const FIELDS = {
    football: {
      label: 'Football',
      variants: ['full', 'half', 'blank'],
      vb: { full: [0, 0, 1050, 680], half: [0, 0, 555, 680], blank: [0, 0, 1050, 680] },
      aspect: { full: 1050 / 680, half: 555 / 680 },
      draw(variant) {
        if (variant === 'blank') return [];
        return footballMarkings(variant === 'half');
      }
    },

    /* ---- additional sports ---------------------------------- */
    futsal: {
      label: 'Futsal',
      variants: ['full', 'half', 'blank'],
      vb: { full: [0, 0, 1060, 560], half: [0, 0, 565, 560], blank: [0, 0, 1060, 560] },
      aspect: { full: 1060 / 560, half: 565 / 560 },
      draw(v) { return v === 'blank' ? [] : futsalMarkings(); }
    },
    basketball: {
      label: 'Basketball',
      variants: ['full', 'half', 'blank'],
      vb: { full: [0, 0, 1060, 596], half: [0, 0, 565, 596], blank: [0, 0, 1060, 596] },
      aspect: { full: 1060 / 596, half: 565 / 596 },
      draw(v) { return v === 'blank' ? [] : basketballMarkings(); }
    },
    hockey: {
      label: 'Field hockey',
      variants: ['full', 'half', 'blank'],
      vb: { full: [0, 0, 1060, 662], half: [0, 0, 565, 662], blank: [0, 0, 1060, 662] },
      aspect: { full: 1060 / 662, half: 565 / 662 },
      draw(v) { return v === 'blank' ? [] : hockeyMarkings(); }
    },
    rugby: {
      label: 'Rugby',
      variants: ['full', 'half', 'blank'],
      vb: { full: [0, 0, 1060, 646], half: [0, 0, 565, 646], blank: [0, 0, 1060, 646] },
      aspect: { full: 1060 / 646, half: 565 / 646 },
      draw(v) { return v === 'blank' ? [] : rugbyMarkings(); }
    },
    blank: {
      label: 'Blank surface', surfaceOnly: true,
      variants: ['blank'],
      vb: { blank: [0, 0, 1050, 680] },
      aspect: {},
      draw() { return []; }
    }
  };

  /* ---- normalise a (sport, variant, orient) request --------- */
  function resolve(sport, variant, orient) {
    const f = FIELDS[sport] ? sport : 'football';
    const def = FIELDS[f];
    const v = def.variants.includes(variant) ? variant : def.variants[0];
    const o = orient === 'v' ? 'v' : 'h';
    return { sport: f, variant: v, orient: o };
  }

  /* ---- render the pitch into `host` ------------------------- */
  function renderField(host, sport, variant, orient) {
    if (!host) return;
    const r = resolve(sport, variant, orient);
    const def = FIELDS[r.sport];
    host.innerHTML = '';
    host.setAttribute('data-sport', r.sport);
    host.setAttribute('data-variant', r.variant);
    host.setAttribute('data-orient', r.orient);

    // Grass + mowing stripes come from CSS on the host (themeable).
    // Markings layer (skipped for blank — pure surface).
    const box = def.vb[r.variant] || def.vb[def.variants[0]] || [0, 0, 1050, 680];
    const vbW = box[2], vbH = box[3];
    // Vertical: swap the viewBox and rotate the markings group into it,
    // so the same drawing serves both orientations (objects never move).
    const vb = r.orient === 'v' ? `0 0 ${vbH} ${vbW}` : box.join(' ');
    const svg = n('svg', {
      class: 'pf-lines',
      viewBox: vb,
      preserveAspectRatio: 'xMidYMid meet'
    });
    const nodes = def.draw(r.variant);
    if (r.orient === 'v') {
      const wrap = n('g', { transform: `translate(${vbH} 0) rotate(90)` });
      nodes.forEach(node => wrap.appendChild(node));
      svg.appendChild(wrap);
    } else {
      nodes.forEach(node => svg.appendChild(node));
    }
    host.appendChild(svg);
    return r;
  }

  /* ---- options for the selector UI -------------------------- */
  function options() {
    return Object.keys(FIELDS).map(k => ({
      sport: k,
      label: FIELDS[k].label,
      stub: !!FIELDS[k].stub,
      variants: FIELDS[k].variants
    }));
  }

  window.CMField = { FIELDS, renderField, options, resolve };
})();
