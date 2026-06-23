/* gp-canvas.js — Free-canvas dashboard engine.
   F0: feature flag + legacy<->canvas schema bridge.
   F1: render cards from {x,y,w,h} via explicit CSS-grid placement (flag-gated).
       No move/resize interaction yet — that's F2/F3. With the flag OFF nothing
       changes; with it ON the active grids switch to canvas placement. */
(function () {
  'use strict';
  if (window.gpCanvas) return;

  // ── Master switch. KEEP FALSE in the repo. Flip to true to see/develop F1+.
  const ENABLED = false;

  const COLS   = 12;   // grid columns (same scale as the current --gp-span)
  const ROW_PX = 36;   // px height of one row unit (must match the CSS auto-rows)
  const SIZE_ROWS = { sm: 7, md: 11, lg: 15, full: 19 };

  function spanOf(item) {
    const s = parseInt(item.span, 10);
    return (s >= 1 && s <= COLS) ? s : 6;
  }
  function rowsOf(item) {
    return SIZE_ROWS[item.size] || SIZE_ROWS.md;
  }
  function hasCoords(item) {
    return !!item
      && Number.isFinite(item.x) && Number.isFinite(item.y)
      && Number.isFinite(item.w) && Number.isFinite(item.h);
  }

  /* Derive {x,y,w,h} for a legacy layout by flowing cards left->right into a
     COLS-wide grid, wrapping to a new row when a card doesn't fit. Order via
     `position`. Items that already have coords are kept as-is (stable). */
  function toCanvasLayout(layout) {
    if (!Array.isArray(layout)) return [];
    const ordered = layout.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    let cx = 0, cy = 0, rowH = 0;
    return ordered.map(item => {
      if (hasCoords(item)) {
        cx = item.x; cy = item.y; rowH = Math.max(rowH, item.h);
        return { ...item };
      }
      const w = Math.min(COLS, spanOf(item));
      const h = rowsOf(item);
      if (cx + w > COLS) { cx = 0; cy += (rowH || h); rowH = 0; }
      const placed = { ...item, x: cx, y: cy, w, h };
      cx += w;
      rowH = Math.max(rowH, h);
      return placed;
    });
  }

  function syncLegacyFields(item) {
    if (!hasCoords(item)) return item;
    const span = Math.max(1, Math.min(COLS, item.w));
    const size = span <= 4 ? 'sm' : span <= 6 ? 'md' : span <= 8 ? 'lg' : 'full';
    return { ...item, span, size };
  }

  // ── F1: apply coords to a card (dataset + CSS vars) ──────────────────────
  function applyCoords(card, item) {
    if (!card) return;
    card.dataset.x = item.x; card.dataset.y = item.y;
    card.dataset.w = item.w; card.dataset.h = item.h;
    card.style.setProperty('--gp-x', item.x);
    card.style.setProperty('--gp-y', item.y);
    card.style.setProperty('--gp-w', item.w);
    card.style.setProperty('--gp-h', item.h);
  }

  // ── F1: render one grid in canvas mode ───────────────────────────────────
  function renderGrid(grid) {
    if (!ENABLED || !grid) return;
    const cards = [...grid.querySelectorAll(':scope > .gp-c, :scope > .gp-add')];
    if (!cards.length) { grid.classList.remove('is-canvas'); return; }
    const items = cards.map((el, idx) => {
      const span = window.gpSpanOf ? window.gpSpanOf(el)
                 : (parseInt(el.dataset.span, 10) || (el.classList.contains('gp-add') ? 4 : 6));
      const it = { _el: el, position: idx, span, size: el.dataset.size || 'md' };
      const c = { x: +el.dataset.x, y: +el.dataset.y, w: +el.dataset.w, h: +el.dataset.h };
      if (hasCoords(c)) Object.assign(it, c);
      return it;
    });
    toCanvasLayout(items).forEach(it => applyCoords(it._el, it));
    grid.classList.add('is-canvas');
  }

  function renderAll() {
    document.querySelectorAll('.gp-grid').forEach(renderGrid);
  }

  // ── self-boot (only when enabled): render + re-render on card add/remove ──
  function boot() {
    if (!ENABLED) return;
    renderAll();
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        const touched = [...m.addedNodes, ...m.removedNodes].some(
          n => n.nodeType === 1 && (n.classList?.contains('gp-c') || n.classList?.contains('gp-add')));
        if (touched) renderGrid(m.target.closest ? (m.target.closest('.gp-grid') || m.target) : m.target);
      }
    });
    document.querySelectorAll('.gp-grid').forEach(g => obs.observe(g, { childList: true }));
    document.getElementById('sections')?.addEventListener('click', () => setTimeout(renderAll, 80));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.gpCanvas = {
    get enabled() { return ENABLED; },
    COLS, ROW_PX,
    hasCoords, toCanvasLayout, syncLegacyFields,
    applyCoords, renderGrid, renderAll,
  };
})();
