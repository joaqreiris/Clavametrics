/* gp-canvas.js — Free-canvas dashboard engine.
   F0: feature flag + legacy<->canvas schema bridge.
   F1: render cards from {x,y,w,h} via explicit CSS-grid placement (flag-gated).
   F2: free resize — drag any of the 8 handles to change w/h (and x/y on N/W).
   F3: free move — drag the card header to reposition; colliding cards get
       pushed DOWN (float mode: untouched cards stay put, gaps allowed). Native
       HTML5 reorder is suppressed in canvas mode. Persists on drop.
   F3.1: collision push also applied on RESIZE + overlaps auto-resolved on render. */
(function () {
  'use strict';
  if (window.gpCanvas) return;

  // ── Master switch. KEEP FALSE in the repo. Flip to true to see/develop F1+.
  const ENABLED = false;

  const COLS   = 12;
  const ROW_PX = 36;
  const MINW   = 2;
  const MINH   = 3;
  const MOBILE = 1000;
  const SIZE_ROWS = { sm: 7, md: 11, lg: 15, full: 19 };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function spanOf(item) { const s = parseInt(item.span, 10); return (s >= 1 && s <= COLS) ? s : 6; }
  function rowsOf(item) { return SIZE_ROWS[item.size] || SIZE_ROWS.md; }
  function hasCoords(item) {
    return !!item && Number.isFinite(item.x) && Number.isFinite(item.y)
        && Number.isFinite(item.w) && Number.isFinite(item.h);
  }

  function toCanvasLayout(layout) {
    if (!Array.isArray(layout)) return [];
    const ordered = layout.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    let cx = 0, cy = 0, rowH = 0;
    return ordered.map(item => {
      if (hasCoords(item)) { cx = item.x; cy = item.y; rowH = Math.max(rowH, item.h); return { ...item }; }
      const w = Math.min(COLS, spanOf(item));
      const h = rowsOf(item);
      if (cx + w > COLS) { cx = 0; cy += (rowH || h); rowH = 0; }
      const placed = { ...item, x: cx, y: cy, w, h };
      cx += w; rowH = Math.max(rowH, h);
      return placed;
    });
  }
  function syncLegacyFields(item) {
    if (!hasCoords(item)) return item;
    const span = Math.max(1, Math.min(COLS, item.w));
    const size = span <= 4 ? 'sm' : span <= 6 ? 'md' : span <= 8 ? 'lg' : 'full';
    return { ...item, span, size };
  }

  // ── coords I/O ───────────────────────────────────────────────────────────
  function applyCoords(card, item) {
    if (!card) return;
    card.dataset.x = item.x; card.dataset.y = item.y;
    card.dataset.w = item.w; card.dataset.h = item.h;
    card.style.setProperty('--gp-x', item.x);
    card.style.setProperty('--gp-y', item.y);
    card.style.setProperty('--gp-w', item.w);
    card.style.setProperty('--gp-h', item.h);
  }
  function readCoords(card) {
    return { x: +card.dataset.x || 0, y: +card.dataset.y || 0,
             w: +card.dataset.w || MINW, h: +card.dataset.h || MINH };
  }
  function reflowCard(card) {
    requestAnimationFrame(() => {
      card.querySelectorAll('canvas').forEach(cv => {
        try { window.Chart && window.Chart.getChart && window.Chart.getChart(cv)?.resize(); } catch (e) {}
      });
    });
  }
  function gridMetrics(grid) {
    const cs = getComputedStyle(grid);
    const colGap = parseFloat(cs.columnGap || cs.gap) || 14;
    const rowGap = parseFloat(cs.rowGap || cs.gap) || 14;
    const rect = grid.getBoundingClientRect();
    const colW = (grid.clientWidth - colGap * (COLS - 1)) / COLS;
    return { rect, colStep: colW + colGap, rowStep: ROW_PX + rowGap };
  }
  function snapshot(grid) {
    return [...grid.querySelectorAll(':scope > .gp-c, :scope > .gp-add')]
      .map(el => ({ el, ...readCoords(el) }));
  }

  // ── collision push (float mode, push DOWN only) ──────────────────────────
  function collide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pushAway(items, mover) {
    const queue = [mover]; let guard = 0;
    while (queue.length && guard++ < 800) {
      const a = queue.shift();
      for (const b of items) {
        if (b === a || b === mover) continue;
        if (collide(a, b)) {
          const ny = a.y + a.h;
          if (ny > b.y) { b.y = ny; queue.push(b); }
        }
      }
    }
  }
  // Deterministic overlap removal (top-to-bottom): each card is pushed below
  // any earlier-placed card it collides with. Idempotent on clean layouts.
  function resolveAll(items) {
    const placed = [];
    items.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x)).forEach(it => {
      let moved = true, g = 0;
      while (moved && g++ < 200) {
        moved = false;
        for (const p of placed) { if (collide(it, p)) { it.y = p.y + p.h; moved = true; } }
      }
      placed.push(it);
    });
  }

  // ── resize handles ───────────────────────────────────────────────────────
  const HANDLES = [
    { k: 'n', T: 1 }, { k: 'e', R: 1 }, { k: 's', B: 1 }, { k: 'w', L: 1 },
    { k: 'nw', T: 1, L: 1 }, { k: 'ne', T: 1, R: 1 }, { k: 'sw', B: 1, L: 1 }, { k: 'se', B: 1, R: 1 },
  ];
  function ensureHandles(card) {
    if (card.querySelector(':scope > .gp-rh')) return;
    HANDLES.forEach(h => {
      const el = document.createElement('span');
      el.className = `gp-rh gp-rh-${h.k}`;
      el.dataset.dir = h.k;
      card.appendChild(el);
    });
  }

  // ── unified pointer interaction (resize OR move) ─────────────────────────
  let rz = null;
  let mv = null;

  function canInteract(grid) {
    return grid && grid.classList.contains('is-canvas') && grid.classList.contains('is-edit')
        && window.innerWidth > MOBILE;
  }

  function onDown(e) {
    if (e.button !== 0 || !e.target.closest) return;
    const handle = e.target.closest('.gp-rh');
    if (handle) {
      const card = handle.closest('.gp-c'); const grid = card && card.closest('.gp-grid');
      if (!canInteract(grid)) return;
      e.preventDefault(); e.stopPropagation();
      const dir = HANDLES.find(h => h.k === handle.dataset.dir) || {};
      const badge = document.createElement('div'); badge.className = 'gp-rh-badge'; card.appendChild(badge);
      card.classList.add('gp-rh-active');
      const prevDraggable = card.getAttribute('draggable'); card.setAttribute('draggable', 'false');
      rz = { card, grid, dir, badge, prevDraggable, m: gridMetrics(grid), base: snapshot(grid) };
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      resizeMove(e); return;
    }
    const head = e.target.closest('.gp-c-h');
    if (head && !e.target.closest('button, a, select, input, [role=button], .gp-c-pick')) {
      const card = head.closest('.gp-c'); const grid = card && card.closest('.gp-grid');
      if (!canInteract(grid)) return;
      e.preventDefault();
      const base = snapshot(grid);
      const mover = base.find(b => b.el === card);
      if (!mover) return;
      card.classList.add('gp-mv-active');
      const prevDraggable = card.getAttribute('draggable'); card.setAttribute('draggable', 'false');
      mv = { card, grid, m: gridMetrics(grid), base, mover, prevDraggable,
             startX: mover.x, startY: mover.y, startPX: e.clientX, startPY: e.clientY };
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function resizeMove(e) {
    if (!rz) return;
    const { card, dir, m, badge, base } = rz;
    const mb = base.find(b => b.el === card) || readCoords(card);
    let { x, y, w, h } = { x: mb.x, y: mb.y, w: mb.w, h: mb.h };
    const col = clamp(Math.round((e.clientX - m.rect.left) / m.colStep), 0, COLS);
    const row = Math.max(0, Math.round((e.clientY - m.rect.top) / m.rowStep));
    if (dir.R) w = clamp(col - x, MINW, COLS - x);
    if (dir.B) h = Math.max(MINH, row - y);
    if (dir.L) { const right = x + w; const nx = clamp(col, 0, right - MINW); x = nx; w = right - nx; }
    if (dir.T) { const bot = y + h;   const ny = clamp(row, 0, bot - MINH);   y = ny; h = bot - ny; }
    const work = base.map(b => ({ ...b }));
    const m2 = work.find(b => b.el === card); m2.x = x; m2.y = y; m2.w = w; m2.h = h;
    pushAway(work, m2);
    work.forEach(b => applyCoords(b.el, b));
    badge.textContent = `${w} × ${h}`;
  }

  function moveMove(e) {
    if (!mv) return;
    const { m, base, mover, startX, startY, startPX, startPY, card } = mv;
    const dCol = Math.round((e.clientX - startPX) / m.colStep);
    const dRow = Math.round((e.clientY - startPY) / m.rowStep);
    const tx = clamp(startX + dCol, 0, COLS - mover.w);
    const ty = Math.max(0, startY + dRow);
    const work = base.map(b => ({ ...b }));
    const m2 = work.find(b => b.el === card); m2.x = tx; m2.y = ty;
    pushAway(work, m2);
    work.forEach(b => applyCoords(b.el, b));
  }

  function onMove(e) { if (rz) resizeMove(e); else if (mv) moveMove(e); }

  function endResize() {
    if (!rz) return;
    const { card, badge, prevDraggable } = rz;
    badge.remove(); card.classList.remove('gp-rh-active');
    if (prevDraggable == null) card.removeAttribute('draggable'); else card.setAttribute('draggable', prevDraggable);
    reflowCard(card); persist(card); rz = null;
  }
  function endMove() {
    if (!mv) return;
    const { card, prevDraggable } = mv;
    card.classList.remove('gp-mv-active');
    if (prevDraggable == null) card.removeAttribute('draggable'); else card.setAttribute('draggable', prevDraggable);
    reflowCard(card); persist(card); mv = null;
  }
  function onUp() { if (rz) endResize(); if (mv) endMove(); }

  function persist(card) {
    const view = card.closest('.gp-view') && card.closest('.gp-view').dataset.view;
    if (view && typeof window.saveLayout === 'function') window.saveLayout(view).catch(() => {});
  }

  // ── render one grid in canvas mode (F1) + handles (F2) + de-overlap ──────
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
    const placed = toCanvasLayout(items);
    resolveAll(placed);
    placed.forEach(it => {
      applyCoords(it._el, it);
      if (it._el.classList.contains('gp-c')) ensureHandles(it._el);
    });
    grid.classList.add('is-canvas');
  }
  function renderAll() { document.querySelectorAll('.gp-grid').forEach(renderGrid); }

  // ── self-boot (only when enabled) ────────────────────────────────────────
  function boot() {
    if (!ENABLED) return;
    renderAll();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    document.addEventListener('dragstart', e => {
      if (e.target.closest && e.target.closest('.gp-grid.is-canvas')) e.preventDefault();
    }, true);
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
    COLS, ROW_PX, MINW, MINH,
    hasCoords, toCanvasLayout, syncLegacyFields, applyCoords, renderGrid, renderAll,
  };
})();
