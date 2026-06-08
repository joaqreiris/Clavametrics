/* =============================================================
   GPS Analysis — inline-SVG fallback for Tabler icons.
   The preview sandbox can't load the @tabler webfont (cross-origin),
   so every <i class="ti ti-NAME"> renders blank. This swaps each one
   for a clean inline SVG (Tabler-style outline) at runtime, inheriting
   currentColor + font-size. In production the webfont still works;
   this just guarantees the reference looks right in review.
   ============================================================= */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  // path data: each entry is an array of <path>/<circle>/<line> specs.
  // 'p:...' = path d; 'c:cx,cy,r' = circle (stroke); 'cf:cx,cy,r' = filled circle; 'l:x1,y1,x2,y2' = line.
  const I = {
    home: ['p:M5 12l-2 0l9 -9l9 9l-2 0', 'p:M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7', 'p:M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6'],
    'calendar-stats': ['p:M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4', 'p:M18 14v4h4', 'c:18,18,4', 'l:15,3,15,7', 'l:9,3,9,7', 'l:3,11,17,11'],
    'message-circle': ['p:M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1'],
    heartbeat: ['p:M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572', 'p:M3 12h3l1 -2l3 4l2 -7l2 5h4'],
    'chart-line': ['p:M4 19l16 0', 'p:M4 15l4 -6l4 2l4 -5l4 4'],
    'current-location': ['c:12,12,3', 'p:M12 2v2', 'p:M12 20v2', 'p:M20 12h2', 'p:M2 12h2', 'c:12,12,8'],
    bandage: ['p:M9 9l6 6', 'p:M3.5 9.5l6 -6a3 3 0 0 1 4 0l3 3a3 3 0 0 1 0 4l-6 6a3 3 0 0 1 -4 0l-3 -3a3 3 0 0 1 0 -4', 'cf:10,10,0.6', 'cf:13,13,0.6', 'cf:13,10,0.6', 'cf:10,13,0.6'],
    stethoscope: ['p:M6 4h-1a1 1 0 0 0 -1 1v3.5a4 4 0 0 0 8 0v-3.5a1 1 0 0 0 -1 -1h-1', 'p:M8 12.5v1.5a4 4 0 0 0 8 0v-2', 'c:17,11,2'],
    selector: ['p:M8 9l4 -4l4 4', 'p:M16 15l-4 4l-4 -4'],
    dots: ['cf:5,12,1.4', 'cf:12,12,1.4', 'cf:19,12,1.4'],
    'target-arrow': ['c:12,12,1', 'c:12,12,5', 'c:12,12,9', 'p:M12 7v-4', 'p:M7 12h-4'],
    'axis-y': ['p:M4 4v16', 'p:M4 20h16', 'p:M4 8h3', 'p:M4 13h3', 'p:M4 18h3'],
    'axis-x': ['p:M4 20h16', 'p:M4 20v-16', 'p:M9 20v-3', 'p:M14 20v-3', 'p:M19 20v-3'],
    'grid-dots': ['cf:5,5,1', 'cf:12,5,1', 'cf:19,5,1', 'cf:5,12,1', 'cf:12,12,1', 'cf:19,12,1', 'cf:5,19,1', 'cf:12,19,1', 'cf:19,19,1'],
    'grid-pattern': ['p:M4 4h16v16h-16z', 'p:M4 12h16', 'p:M12 4v16'],
    list: ['p:M9 6h11', 'p:M9 12h11', 'p:M9 18h11', 'l:5,6,5,6', 'l:5,12,5,12', 'l:5,18,5,18', 'cf:5,6,1', 'cf:5,12,1', 'cf:5,18,1'],
    'list-numbers': ['p:M11 6h9', 'p:M11 12h9', 'p:M11 18h9', 'p:M4 8v-4l-1 1', 'p:M3.5 16a1 1 0 1 1 1.5 .8l-2 1.2h2.5'],
    'number-123': ['p:M3 10l1 -1v4', 'p:M9 9a1 1 0 1 1 1.6 1.2l-1.6 1.8h2', 'p:M14 9a1 1 0 1 1 1 1.5a1 1 0 1 1 -1 1.5'],
    tag: ['p:M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'p:M3 6v5.172a2 2 0 0 0 .586 1.414l7.414 7.414a2 2 0 0 0 2.828 0l5.172 -5.172a2 2 0 0 0 0 -2.828l-7.414 -7.414a2 2 0 0 0 -1.414 -.586h-5.172a2 2 0 0 0 -2 2'],
    'stack-2': ['p:M12 4l-8 4l8 4l8 -4l-8 -4', 'p:M4 12l8 4l8 -4', 'p:M4 16l8 4l8 -4'],
    palette: ['p:M12 21a9 9 0 1 1 0 -18a8 7 0 0 1 8 7a3.5 3.5 0 0 1 -3.5 3.5h-1.8a1.8 1.8 0 0 0 -1.2 3a1.5 1.5 0 0 1 -1.5 1.5', 'cf:7.5,10.5,1', 'cf:12,7.5,1', 'cf:16.5,10.5,1'],
    point: ['cf:12,12,3'],
    circle: ['c:12,12,8'],
    'line-dashed': ['p:M5 12h2', 'p:M11 12h2', 'p:M17 12h2'],
    'chart-area-line': ['p:M4 19l16 0', 'p:M4 15l4 -6l4 2l4 -5', 'p:M4 15l4 -6l4 2l4 -5v9h-12z'],
    'chart-histogram': ['p:M4 4v16h16', 'p:M4 12l4 -4l4 3l5 -6', 'p:M8 20v-6', 'p:M12 20v-5', 'p:M16 20v-7'],
    'chart-bar': ['p:M4 4v16h16', 'p:M8 16v-5', 'p:M12 16v-9', 'p:M16 16v-3'],
    'chart-dots': ['p:M4 4v16h16', 'cf:9,15,1.3', 'cf:13,10,1.3', 'cf:17,13,1.3'],
    plus: ['p:M12 5v14', 'p:M5 12h14'],
    minus: ['p:M5 12h14'],
    check: ['p:M5 12l5 5l9 -9'],
    'arrow-up-right': ['p:M17 7l-10 10', 'p:M8 7h9v9'],
    'arrow-down-right': ['p:M7 7l10 10', 'p:M17 8v9h-9'],
    'arrow-right': ['p:M5 12h14', 'p:M13 6l6 6l-6 6'],
    'arrow-autofit-height': ['p:M12 4l0 16', 'p:M9 7l3 -3l3 3', 'p:M9 17l3 3l3 -3'],
    'layout-navbar': ['p:M4 5h16v14h-16z', 'p:M4 9h16'],
    route: ['c:6,18,2', 'c:18,6,2', 'p:M8 18h7a3 3 0 0 0 0 -6h-6a3 3 0 0 1 0 -6h7'],
    bolt: ['p:M13 3l-9 11h7l-1 7l9 -11h-7z'],
    flame: ['p:M12 3c1 4 4 5 4 9a4 4 0 0 1 -8 0c0 -2 1 -3 1 -5c1 1 2 1 3 -4'],
    'arrows-up-down': ['p:M7 3v18', 'p:M4 6l3 -3l3 3', 'p:M17 21v-18', 'p:M14 18l3 3l3 -3'],
    'brand-speedtest': ['p:M5.6 18a9 9 0 1 1 12.8 0', 'p:M12 14l4 -4'],
    'battery-3': ['p:M4 8h12a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2', 'p:M22 11v2', 'p:M6 11v2', 'p:M9 11v2', 'p:M12 11v2'],
    temperature: ['p:M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5', 'p:M10 9h4'],
    'traffic-lights': ['p:M8 3h8a1 1 0 0 1 1 1v15a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-15a1 1 0 0 1 1 -1', 'c:12,7,1.3', 'c:12,12,1.3', 'c:12,17,1.3'],
    percentage: ['p:M17 5l-12 14', 'c:7.5,7.5,1.5', 'c:16.5,16.5,1.5'],
    adjustments: ['p:M6 4v6', 'p:M6 14v6', 'c:6,12,2', 'p:M12 4v10', 'p:M12 18v2', 'c:12,16,2', 'p:M18 4v2', 'p:M18 10v10', 'c:18,8,2'],
    'adjustments-horizontal': ['p:M4 6h8', 'p:M16 6h4', 'c:14,6,2', 'p:M4 12h2', 'p:M10 12h10', 'c:8,12,2', 'p:M4 18h10', 'p:M18 18h2', 'c:16,18,2'],
    eye: ['p:M12 5c-5 0 -9 4.5 -10 7c1 2.5 5 7 10 7s9 -4.5 10 -7c-1 -2.5 -5 -7 -10 -7', 'c:12,12,2.5'],
    'table-options': ['p:M4 4h16v16h-16z', 'p:M4 10h16', 'p:M10 4v16', 'p:M14 14l6 6', 'p:M20 14l-6 6'],
    'info-circle': ['c:12,12,9', 'p:M12 8h.01', 'p:M11 12h1v4h1'],
    'chevron-down': ['p:M6 9l6 6l6 -6'],
    copy: ['p:M8 8h10v10a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2', 'p:M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2'],
  };

  const FALLBACK = ['cf:12,12,2'];

  function build(spec, sizePx) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', sizePx); svg.setAttribute('height', sizePx);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'inline-block';
    svg.style.verticalAlign = '-0.15em';
    svg.style.flexShrink = '0';
    spec.forEach(s => {
      const [t, v] = s.split(/:(.+)/);
      let el;
      if (t === 'p') { el = document.createElementNS(NS, 'path'); el.setAttribute('d', v); }
      else if (t === 'l') { const [x1, y1, x2, y2] = v.split(','); el = document.createElementNS(NS, 'line'); el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); }
      else if (t === 'c') { const [cx, cy, r] = v.split(','); el = document.createElementNS(NS, 'circle'); el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r); }
      else if (t === 'cf') { const [cx, cy, r] = v.split(','); el = document.createElementNS(NS, 'circle'); el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r); el.setAttribute('fill', 'currentColor'); el.setAttribute('stroke', 'none'); }
      if (el) svg.appendChild(el);
    });
    return svg;
  }

  function nameOf(node) {
    for (const c of node.classList) if (c.startsWith('ti-')) return c.slice(3);
    return null;
  }

  function swap(node) {
    if (node.dataset.svgd) return;
    const name = nameOf(node);
    if (!name) return;
    const cs = getComputedStyle(node);
    let size = parseFloat(cs.fontSize) || 16;
    const svg = build(I[name] || FALLBACK, Math.round(size));
    svg.setAttribute('class', node.className);
    svg.dataset.svgd = '1';
    if (cs.color) svg.style.color = cs.color;
    node.replaceWith(svg);
  }

  function run(root) {
    (root || document).querySelectorAll('i.ti').forEach(swap);
  }

  // initial + observe (sections render their charts via JS after load)
  document.addEventListener('DOMContentLoaded', () => {
    run();
    const mo = new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches('i.ti')) swap(n);
        if (n.querySelectorAll) n.querySelectorAll('i.ti').forEach(swap);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.__refIcons = run;
  });
})();
