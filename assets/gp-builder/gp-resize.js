/* =============================================================
   gp-resize.js — Card width helpers (12-col span) + span seeding.

   The INTERACTIVE resize handle lives in the canvas engine
   (gp-canvas.js, .gp-rh — 8 handles + "X col" badge, free w/h resize).
   This file no longer renders a handle; it only owns the span ↔ size
   mapping and seeds --gp-span so width persistence keeps working:
     Persistence: saveLayout() reads gpSpanOf(el) → layout[].span
     Restore:     applyLayoutToView() / canvas placeCards → gpApplySpan
   ============================================================= */
(function () {
  'use strict';

  const COLS    = 12;
  const MIN_REG = 3;   // regular cards: never thinner than a quarter
  const MIN_TBL = 6;   // tables need width to stay legible

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
    // Width is canonical from the coord w (dataset.w): derive span FROM w whenever it exists so span
    // is never an independent source that can contradict the real width. Fall back to the stored span
    // / size bucket only for coordless (auto-flow) cards.
    const w = parseInt(card.dataset.w, 10);
    if (w >= 1 && w <= COLS) return w;
    const s = parseInt(card.dataset.span, 10);
    if (s >= 1 && s <= COLS) return s;
    return spanFromSize(card.dataset.size || 'md', card.classList.contains('is-table'));
  }

  function reflowCard(card) {
    requestAnimationFrame(() => {
      card.querySelectorAll('canvas').forEach(cv => {
        try { window.Chart?.getChart?.(cv)?.resize(); } catch {}
      });
      void card.querySelector('.gp-c-b')?.offsetHeight; // force reflow for non-Chart bodies
    });
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

  // ── init a card: seed --gp-span from span/size (NO handle here) ────
  function initCard(card) {
    if (!card || card.classList.contains('gp-add')) return;
    // Prefer the canonical coord width (dataset.w): seed span FROM w so the legacy --gp-span path
    // agrees with the real width. This observer can fire AFTER the coords are applied; without this it
    // would clobber --gp-span back to the size bucket (6) and re-break a full-width (w:12) card.
    const w = parseInt(card.dataset.w, 10);
    if (w >= 1 && w <= COLS) {
      card.dataset.span = String(w);
    } else if (!card.dataset.span) {
      card.dataset.span = String(spanFromSize(card.dataset.size || 'md', card.classList.contains('is-table')));
    }
    card.style.setProperty('--gp-span', card.dataset.span);
    card.dataset.size = sizeFromSpan(parseInt(card.dataset.span, 10));
  }

  // ── init a subtree (or the whole document) ────────────────────────
  function gpInitResize(root) {
    (root || document).querySelectorAll('.gp-c').forEach(initCard);
  }

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
  window.gpSpanOf       = gpSpanOf;
  window.gpApplySpan    = gpApplySpan;
  window.gpInitResize   = gpInitResize;
  window.gpSpanFromSize = spanFromSize;
})();
