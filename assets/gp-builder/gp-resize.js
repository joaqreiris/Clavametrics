/* =============================================================
   gp-resize.js — Draggable card resize that snaps to the 12-col grid
   Replaces the old S/M/L/FULL .size-toggle. The card width is driven
   by --gp-span (3..12 columns); data-size stays as a derived bucket
   so the existing max-height rules and persistence keep working.

   Width source of truth:  el.dataset.span  +  el.style --gp-span
   Persistence:            saveLayout() reads gpSpanOf(el) → layout[].span
   Restore:                applyLayoutToView() → gpApplySpan(card, span)

   Interaction: pointer-drag the bottom-right handle. The card snaps,
   live, to the nearest whole column; a guide overlay (¼ ⅓ ½ ¾ full)
   and a width badge give feedback. On release the span is saved.
   ============================================================= */
(function () {
  'use strict';

  const COLS    = 12;
  const MIN_REG = 3;   // regular cards: never thinner than a quarter
  const MIN_TBL = 6;   // tables need width to stay legible
  const MOBILE  = 1000; // below this the grid collapses to 1 column

  // named stops shown on the ruler while dragging
  const STOPS = [
    { span: 3,  pct: 25,  label: '¼'   },
    { span: 4,  pct: 33.33, label: '⅓' },
    { span: 6,  pct: 50,  label: '½'   },
    { span: 9,  pct: 75,  label: '¾'   },
    { span: 12, pct: 100, label: 'full' },
  ];

  // ── span ↔ size bucket (size kept for max-height + back-compat) ──
  function sizeFromSpan(span) {
    if (span <= 4) return 'sm';
    if (span <= 6) return 'md';
    if (span <= 8) return 'lg';
    return 'full';
  }
  function spanFromSize(size, isTable) {
    const base = { sm: 4, md: 6, lg: 8, full: 12 }[size] || 6;
    return isTable ? Math.max(base, MIN_TBL) : base;
  }
  function minSpan(card) { return card.classList.contains('is-table') ? MIN_TBL : MIN_REG; }
  function clampSpan(n, card) { return Math.max(minSpan(card), Math.min(COLS, Math.round(n))); }

  // ── public: read the current span of a card ──────────────────────
  function gpSpanOf(card) {
    const s = parseInt(card.dataset.span, 10);
    if (s >= 1 && s <= COLS) return s;
    return spanFromSize(card.dataset.size || 'md', card.classList.contains('is-table'));
  }

  // ── public: apply a span to a card (width + bucket + chart reflow) ─
  function gpApplySpan(card, span, opts) {
    if (!card) return;
    span = clampSpan(span, card);
    card.dataset.span = String(span);
    card.style.setProperty('--gp-span', span);
    card.dataset.size = sizeFromSpan(span);
    if (!opts || opts.reflow !== false) reflowCard(card);
  }

  function reflowCard(card) {
    requestAnimationFrame(() => {
      card.querySelectorAll('canvas').forEach(cv => {
        try { window.Chart?.getChart?.(cv)?.resize(); } catch {}
      });
      void card.querySelector('.gp-c-b')?.offsetHeight; // force reflow for non-Chart bodies
    });
  }

  // ── init a card: seed --gp-span from span/size, inject the handle ──
  function initCard(card) {
    if (!card || card.classList.contains('gp-add')) return;
    if (!card.dataset.span) {
      const span = spanFromSize(card.dataset.size || 'md', card.classList.contains('is-table'));
      card.dataset.span = String(span);
    }
    card.style.setProperty('--gp-span', card.dataset.span);
    card.dataset.size = sizeFromSpan(parseInt(card.dataset.span, 10));
    if (!card.querySelector(':scope > .gp-rz')) {
      const h = document.createElement('span');
      h.className = 'gp-rz';
      h.title = 'Estirar para redimensionar';
      card.appendChild(h);
    }
  }

  // ── init a subtree (or the whole document) ────────────────────────
  function gpInitResize(root) {
    (root || document).querySelectorAll('.gp-c').forEach(initCard);
  }

  // ── drag state ────────────────────────────────────────────────────
  let drag = null;

  function gridMetrics(grid) {
    const cs   = getComputedStyle(grid);
    const gap  = parseFloat(cs.columnGap || cs.gap) || 14;
    const width = grid.clientWidth;
    const colUnit = (width - gap * (COLS - 1)) / COLS; // px width of one column
    return { gap, width, colUnit, step: colUnit + gap };
  }

  function buildOverlay(grid) {
    const ov = document.createElement('div');
    ov.className = 'gp-rz-ov';
    ov.setAttribute('aria-hidden', 'true');
    let html = '';
    for (let i = 0; i < COLS; i++) html += '<i></i>';
    html += STOPS.map(s =>
      `<span class="gp-rz-mk" data-span="${s.span}" style="left:${s.pct}%">${s.label}</span>`).join('');
    ov.innerHTML = html;
    grid.appendChild(ov);
    return ov;
  }

  function onDown(e) {
    const handle = e.target.closest('.gp-rz');
    if (!handle || e.button !== 0) return;
    const card = handle.closest('.gp-c');
    const grid = card?.closest('.gp-grid');
    if (!card || !grid || !grid.classList.contains('is-edit')) return;
    if (window.innerWidth <= MOBILE) return; // grid is single-column; nothing to snap

    e.preventDefault();
    e.stopPropagation();
    const m = gridMetrics(grid);
    grid.classList.add('is-resizing');
    card.classList.add('gp-rz-active');

    const badge = document.createElement('div');
    badge.className = 'gp-rz-badge';
    card.appendChild(badge);

    // suspend HTML5 drag-to-reorder so dragging the handle can't also
    // start a card move
    const wasDraggable = card.getAttribute('draggable');
    card.setAttribute('draggable', 'false');

    drag = {
      card, grid, m, badge, wasDraggable,
      overlay: buildOverlay(grid),
      startSpan: gpSpanOf(card),
      cardLeft: card.getBoundingClientRect().left,
    };
    try { handle.setPointerCapture(e.pointerId); } catch {}
    drag.pointerId = e.pointerId;
    drag.handle = handle;
    updateDrag(e.clientX);
  }

  function updateDrag(clientX) {
    if (!drag) return;
    const { card, m } = drag;
    const desiredW = clientX - drag.cardLeft + 6;            // +6 ≈ handle half-width
    let span = clampSpan((desiredW + m.gap) / m.step, card);
    if (span !== gpSpanOf(card)) gpApplySpan(card, span, { reflow: false });
    // feedback
    const stop = STOPS.find(s => s.span === span);
    drag.badge.textContent = stop ? `${span} col · ${stop.label}` : `${span} col`;
    drag.overlay.querySelectorAll('.gp-rz-mk').forEach(mk =>
      mk.classList.toggle('is-on', parseInt(mk.dataset.span, 10) === span));
  }

  function onMove(e) { if (drag) updateDrag(e.clientX); }

  function endDrag() {
    if (!drag) return;
    const { card, grid, overlay, badge, wasDraggable } = drag;
    overlay?.remove();
    badge?.remove();
    grid.classList.remove('is-resizing');
    card.classList.remove('gp-rz-active');
    if (wasDraggable == null) card.removeAttribute('draggable');
    else card.setAttribute('draggable', wasDraggable);
    reflowCard(card);
    // persist via the same path the old size-toggle used
    const view = card.closest('.gp-view')?.dataset.view;
    if (view && typeof window.saveLayout === 'function') {
      window.saveLayout(view).catch(() => {});
    }
    drag = null;
  }

  // ── wiring (delegated, covers dynamically-added cards) ────────────
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  // seed existing cards + watch for new ones (custom dashboards)
  function boot() {
    gpInitResize(document);
    const obs = new MutationObserver(muts => {
      muts.forEach(mt => mt.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList?.contains('gp-c')) initCard(n);
        n.querySelectorAll?.('.gp-c').forEach(initCard);
      }));
    });
    document.querySelectorAll('.gp-grid').forEach(g => obs.observe(g, { childList: true }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // ── exports ───────────────────────────────────────────────────────
  window.gpSpanOf     = gpSpanOf;
  window.gpApplySpan  = gpApplySpan;
  window.gpInitResize = gpInitResize;
  window.gpSpanFromSize = spanFromSize;
})();
