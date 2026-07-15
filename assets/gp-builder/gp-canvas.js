/* gp-canvas.js — Free-canvas dashboard engine.
   F0: feature flag + legacy<->canvas schema bridge.
   F1: render cards from {x,y,w,h} via explicit CSS-grid placement (flag-gated).
   F2: free resize — drag any of the 8 handles to change w/h (and x/y on N/W).
   F3: free move — drag the card header to reposition; colliding cards get
       pushed DOWN (float mode: untouched cards stay put, gaps allowed). Native
       HTML5 reorder is suppressed in canvas mode. Persists on drop.
   F3.1: collision push on RESIZE + overlaps auto-resolved on render.
   F4: charts reflow on box change (ResizeObserver); content CSS in GPS Analysis.html.
   F5: page formats (fit/16:9/A4) + Compactar (gravity-up); controls injected in the bar. */
(function () {
  'use strict';
  if (window.gpCanvas) return;

  // ── Master switch. KEEP FALSE in the repo. Flip to true to see/develop F1+.
  const ENABLED = true;

  const COLS   = 12;
  const ROW_PX = 36;
  const MINW   = 2;
  const MINH   = 3;
  const MOBILE = 1000;
  const DRAG_THRESH = 5;   // px the pointer must travel before a move starts (vs a click)
  const SIZE_ROWS = { sm: 5, md: 7, lg: 10, full: 13 };
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
      // _autoFlow: these coords are INVENTED by this pass (the item had none). They must be
      // re-derivable — a later authoritative pass (once the saved layout is loaded/reordered)
      // has to be free to re-flow them in the CURRENT order instead of treating them as final.
      const placed = { ...item, x: cx, y: cy, w, h, _autoFlow: true };
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
    // A write through applyCoords is a REAL placement (user drag/resize/compact, a paste, or a
    // restored saved layout) → drop any provisional mark. placeCards RE-SETS dataset.autoFlow
    // right after, but only for the items IT auto-invented (item._autoFlow), so invented coords
    // stay flagged and real ones don't.
    delete card.dataset.autoFlow;
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
  function observeCard(card) {
    if (card.__gpRO || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => reflowCard(card));
    ro.observe(card);
    card.__gpRO = ro;
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
    return [...grid.querySelectorAll(':scope > .gp-c')]
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

  // ── F5: page formats + compact ───────────────────────────────────────────
  const FORMATS = {
    fit:  { w: null, h: null },
    wide: { w: 1280, h: 720 },
    a4l:  { w: 1123, h: 794 },
    a4p:  { w: 794,  h: 1123 },
  };
  const PAGE_KEY = v => `cm_gp_page_${window._gpUserId || '?'}_${v || 'default'}`;

  function applyPage(grid, key) {
    const f = FORMATS[key] || FORMATS.fit;
    if (f.w) {
      grid.style.maxWidth = f.w + 'px';
      grid.style.marginLeft = 'auto'; grid.style.marginRight = 'auto';
      grid.style.setProperty('--gp-page-h', f.h + 'px');
      grid.classList.add('gp-paged');
    } else {
      grid.style.maxWidth = ''; grid.style.marginLeft = ''; grid.style.marginRight = '';
      grid.style.removeProperty('--gp-page-h');
      grid.classList.remove('gp-paged');
    }
  }
  function activeGrid() { return document.querySelector('.gp-view.is-on .gp-grid'); }
  function activeView() { const v = document.querySelector('.gp-view.is-on'); return v ? v.dataset.view : null; }

  function applyStoredPage(grid) {
    const vEl = grid.closest('.gp-view');
    const view = vEl && vEl.dataset.view;
    let key = 'fit';
    try { key = localStorage.getItem(PAGE_KEY(view)) || 'fit'; } catch (e) {}
    applyPage(grid, key);
    const sel = document.querySelector('.gp-page-sel');
    if (sel && vEl && vEl.classList.contains('is-on')) sel.value = key;
  }

  function compact(grid) {
    if (!grid) return;
    const items = snapshot(grid).sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const placed = [];
    for (const it of items) {
      let ny = it.y;
      while (ny > 0) {
        const test = { ...it, y: ny - 1 };
        if (placed.some(p => collide(test, p))) break;
        ny--;
      }
      it.y = ny; placed.push(it); applyCoords(it.el, it);
    }
    if (window._gpLayoutReady === false) return;   // don't cement positions mid-load (same as persist)
    const view = grid.closest('.gp-view') && grid.closest('.gp-view').dataset.view;
    if (view && typeof window.saveLayout === 'function') window.saveLayout(view).catch(() => {});
  }

  function ensureToolbar() {
    const right = document.querySelector('.gp-dash-bar .right');
    if (!right || right.querySelector('.gp-page-sel')) return;
    const sel = document.createElement('select');
    sel.className = 'pill gp-page-sel';
    sel.innerHTML = '<option value="fit">Fit width</option>'
                  + '<option value="wide">16:9</option>'
                  + '<option value="a4l">A4 landscape</option>'
                  + '<option value="a4p">A4 portrait</option>';
    sel.addEventListener('change', () => {
      const g = activeGrid(); if (!g) return;
      try { localStorage.setItem(PAGE_KEY(activeView()), sel.value); } catch (e) {}
      applyPage(g, sel.value);
    });
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill gp-compact-btn';
    btn.innerHTML = '<i class="ti ti-arrow-bar-to-up"></i>Compact';
    btn.addEventListener('click', () => { const g = activeGrid(); if (g) compact(g); });
    // Group the layout actions (Fit width, Compact) WITH Save layout / Saved views / Add card
    // instead of dropping them at the left of the cluster, ahead of the filter pills.
    const anchor = right.querySelector('#saveLayoutBtn') || null;
    right.insertBefore(sel, anchor);
    right.insertBefore(btn, anchor);
    // NB: no injected "Add card" here — the static dashboard-bar pill already covers it
    // (avoids the duplicate button). The in-grid .gp-add tile remains the insert target.
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
  let mvPending = null;   // armed on pointerdown; promotes to `mv` once past DRAG_THRESH

  function canInteract(grid) {
    // Always editable now — no edit mode, no lock. Just canvas + desktop width.
    return grid && grid.classList.contains('is-canvas') && window.innerWidth > MOBILE;
  }

  function onDown(e) {
    if (e.button !== 0 || !e.target.closest) return;
    const handle = e.target.closest('.gp-rh');
    if (handle) {
      const card = handle.closest('.gp-c'); const grid = card && card.closest('.gp-grid');
      if (!canInteract(grid)) return;
      card.style.zIndex = 2000 + (window.__gpZ = (window.__gpZ || 0) + 1);
      e.preventDefault(); e.stopPropagation();
      const dir = HANDLES.find(h => h.k === handle.dataset.dir) || {};
      const badge = document.createElement('div'); badge.className = 'gp-rh-badge'; card.appendChild(badge);
      card.classList.add('gp-rh-active');
      const prevDraggable = card.getAttribute('draggable'); card.setAttribute('draggable', 'false');
      rz = { card, grid, dir, badge, prevDraggable, m: gridMetrics(grid), base: snapshot(grid) };
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      resizeMove(e); return;
    }
    // Move: grab anywhere on the card (body OR header) EXCEPT interactive content,
    // resize handles, or the floating KPI actions — so dropdowns / pencil / ✕ and a
    // short click keep working. Activation is DEFERRED to onMove (DRAG_THRESH) so a
    // click under 5px never moves the card; no preventDefault here for the same reason.
    if (e.target.closest('button, a, select, input, textarea, [role=button], .gp-c-pick, .gp-c-picks, .gp-rh, .gp-kpi-actions')) return;
    const card = e.target.closest('.gp-c');
    if (!card || card.classList.contains('gp-add')) return;
    const grid = card.closest('.gp-grid');
    if (!canInteract(grid)) return;
    const base = snapshot(grid);
    const mover = base.find(b => b.el === card);
    if (!mover) return;
    mvPending = { card, grid, base, mover, startPX: e.clientX, startPY: e.clientY, pointerId: e.pointerId };
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
    applyCoords(card, { x, y, w, h });
    badge.textContent = `${w} × ${h}`;
  }

  function moveMove(e) {
    if (!mv) return;
    const { m, mover, startX, startY, startPX, startPY, card } = mv;
    const tx = clamp(startX + Math.round((e.clientX - startPX) / m.colStep), 0, COLS - mover.w);
    const ty = Math.max(0, startY + Math.round((e.clientY - startPY) / m.rowStep));
    applyCoords(card, { x: tx, y: ty, w: mover.w, h: mover.h });
  }

  function onMove(e) {
    if (rz) { resizeMove(e); return; }
    if (mv) { moveMove(e); return; }
    if (!mvPending) return;
    const dx = e.clientX - mvPending.startPX, dy = e.clientY - mvPending.startPY;
    if (dx * dx + dy * dy < DRAG_THRESH * DRAG_THRESH) return;   // still a click, not a drag
    const { card, grid, base, mover, startPX, startPY, pointerId } = mvPending;
    mvPending = null;
    card.style.zIndex = 2000 + (window.__gpZ = (window.__gpZ || 0) + 1);
    card.classList.add('gp-mv-active');
    const prevDraggable = card.getAttribute('draggable'); card.setAttribute('draggable', 'false');
    mv = { card, grid, m: gridMetrics(grid), base, mover, prevDraggable,
           startX: mover.x, startY: mover.y, startPX, startPY };
    try { card.setPointerCapture(pointerId); } catch (_) {}
    try { window.getSelection().removeAllRanges(); } catch (_) {}
    moveMove(e);
  }

  function endResize() {
    if (!rz) return;
    const { card, badge, prevDraggable } = rz;
    badge.remove(); card.classList.remove('gp-rh-active', 'is-dragging');
    card.style.removeProperty('z-index');   // drop the lift set in onDown
    if (prevDraggable == null) card.removeAttribute('draggable'); else card.setAttribute('draggable', prevDraggable);
    reflowCard(card); persist(card); rz = null;
  }
  function endMove() {
    if (!mv) return;
    const { card, prevDraggable } = mv;
    // Also drop 'is-dragging' (native HTML5 DnD skin, opacity:0.4) in case a native
    // dragstart fired before we took over with pointer capture and its dragend never ran.
    card.classList.remove('gp-mv-active', 'is-dragging');
    card.style.removeProperty('z-index');   // drop the lift set in onMove → back below the bars
    if (prevDraggable == null) card.removeAttribute('draggable'); else card.setAttribute('draggable', prevDraggable);
    reflowCard(card); persist(card); mv = null;
  }
  function onUp(e) {
    // Click-to-SELECT: a real click is a pointerup whose press armed mvPending but NEVER
    // crossed DRAG_THRESH (so it was never promoted to mv/rz). onDown already excluded
    // interactive controls, so mvPending only exists for a press on the card body → select
    // that card (double-click opens the editor — see gpOpenCardEditor on dblclick). Drags
    // (mv/rz) and pointercancel/lostpointercapture never select.
    const clickCard = (e && e.type === 'pointerup' && mvPending && !mv && !rz) ? mvPending.card : null;
    if (rz) endResize(); if (mv) endMove(); mvPending = null;
    // Defensive: clear edit-active state + the inline lift on EVERY card (not just the
    // one we tracked), so a card whose pointer stream was hijacked never stays "pegada"
    // (faded/rotated) nor elevated above the bars. Also catches a stale z-index left
    // without the class.
    document.querySelectorAll('.gp-mv-active, .gp-rh-active, .is-dragging, .gpt-dragging, .gpt-drag-over, .gp-c[style*="z-index"]')
      .forEach(c => { c.classList.remove('gp-mv-active', 'gp-rh-active', 'is-dragging', 'gpt-dragging', 'gpt-drag-over'); c.style.removeProperty('z-index'); });
    if (clickCard && !clickCard.classList.contains('gp-add') && typeof window.gpSelectCard === 'function') {
      window.gpSelectCard(clickCard);
    }
  }

  function persist(card) {
    // Never autosave while a load is still resolving the saved layout: cards may still hold
    // provisional auto-flow coords, and saving now would cement a scrambled state. The host page
    // sets window._gpLayoutReady=false during load and true once the authoritative pass ran.
    // (=== false only — undefined means "no host gating" → persist normally.)
    if (window._gpLayoutReady === false) return;
    const view = card.closest('.gp-view') && card.closest('.gp-view').dataset.view;
    if (view && typeof window.saveLayout === 'function') window.saveLayout(view).catch(() => {});
  }

  // ── render ───────────────────────────────────────────────────────────────
  function drawSnapGrid(grid) {
    if (!grid) return;
    let ov = grid.querySelector(':scope > .gp-snapgrid');
    if (!grid.classList.contains('is-edit')) { if (ov) ov.remove(); return; }
    if (!ov) { ov = document.createElement('div'); ov.className = 'gp-snapgrid'; ov.setAttribute('aria-hidden', 'true'); grid.prepend(ov); }
    const m = gridMetrics(grid);
    let html = '';
    for (let i = 0; i <= COLS; i++) { html += '<i style="left:' + Math.round(i * m.colStep) + 'px"></i>'; }
    grid.style.setProperty('--row-step', m.rowStep + 'px');
    ov.innerHTML = html;
  }

  function placeCards(grid) {
    const cards = [...grid.querySelectorAll(':scope > .gp-c')];
    if (!cards.length) { grid.classList.remove('is-canvas'); return; }
    const items = cards.map((el, idx) => {
      const span = window.gpSpanOf ? window.gpSpanOf(el)
                 : (parseInt(el.dataset.span, 10) || (el.classList.contains('gp-add') ? 4 : 6));
      const it = { _el: el, position: idx, span, size: el.dataset.size || 'md' };
      const c = { x: +el.dataset.x, y: +el.dataset.y, w: +el.dataset.w, h: +el.dataset.h };
      // Only REAL coords freeze a card's position. Provisional auto-flow coords (dataset.autoFlow),
      // written by an EARLY pass before the saved layout loaded, are treated as "no coords" so this
      // pass re-derives them in the current DOM order → a late saved layout / reorder wins instead
      // of the frozen raw-HTML order. This is the 3rd scramble trigger (beyond reset + mount race).
      if (hasCoords(c) && el.dataset.autoFlow !== '1') Object.assign(it, c);
      return it;
    });
    const placed = toCanvasLayout(items);
    placed.forEach(it => {
      applyCoords(it._el, it);                       // clears dataset.autoFlow
      if (it._autoFlow) it._el.dataset.autoFlow = '1';  // …re-flag only the ones we just invented
      if (it._el.classList.contains('gp-c')) { ensureHandles(it._el); observeCard(it._el); }
    });
    grid.classList.add('is-canvas');
  }
  function syncEditClass() {
    // Layout is always editable now (no edit mode, no lock). The edit skin (.is-edit)
    // stays on so hover handles / outlines are available on every card.
    document.querySelectorAll('.gp-grid').forEach(g => g.classList.add('is-edit'));
    document.querySelectorAll('.gp-grid.is-canvas').forEach(drawSnapGrid);
  }
  function renderGrid(grid) {
    if (!ENABLED || !grid) return;
    placeCards(grid);
    ensureToolbar();        // F5: page selector + Compactar in the (shared) dashboard bar
    applyStoredPage(grid);  // F5: restore the saved page format
    syncEditClass();
  }
  function renderAll() { document.querySelectorAll('.gp-grid').forEach(renderGrid); }

  // ── self-boot (only when enabled) ────────────────────────────────────────
  function boot() {
    if (!ENABLED) return;
    renderAll();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    // End a move/resize in the CAPTURE phase (+ lostpointercapture) so a bespoke
    // card that stops propagation on its own pointerup (e.g. the ACWR metric
    // dropdown) can never prevent onUp from running. Otherwise mv/rz stay set and
    // the card keeps following the cursor on the next pointermove ("trabada").
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('lostpointercapture', onUp, true);
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
    // Always-editable: keep the edit skin on from boot (lock per grid suppresses it).
    document.querySelectorAll('.gp-grid').forEach(g => g.classList.add('is-edit'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.gpCanvas = {
    get enabled() { return ENABLED; },
    COLS, ROW_PX, MINW, MINH,
    hasCoords, toCanvasLayout, syncLegacyFields, applyCoords, renderGrid, renderAll, compact, applyPage,
  };
})();
