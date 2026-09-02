/* ============================================================
   Block Actions — shared copy / paste / duplicate / drag-to-duplicate
   for the kanban planners (rehab, preventive, individual).

   One implementation, wired by each engine via an adapter:

     window.BlockActions.install({
       root,                          // the kanban container element
       blockSelector,                 // CSS for a block card  (e.g. '.rp-block')
       daySelector,                   // CSS for a day column   (e.g. '.rp-day')
       getIds(blockEl) -> {day,block},// read the engine's dataset attrs (indices)
       getDayIndex(dayEl) -> number,  // day index for a day column
       getBlock(day,block) -> obj,    // return that block's data (module deep-clones it)
       insertBlock(day, blockData, at),  // insert a clone into that day → persist + re-render
       moveBlock(from, fromBlock, to, at),// move a block between days → persist + re-render
       reorderBlock(day, fromIdx, at),   // optional: reorder within one day
       dayCopy: true,                 // optional: whole-day copy (⧉ on the column)
       dayLabel(dayEl) -> string,     // optional: how a day reads in the copy menu
       onChange()                     // optional extra persist/re-render hook
     });

   Plain drag = MOVE. Alt/Option-drag (or drag from the ⧉ grip) = COPY.
   Cmd/Ctrl+C on a hovered block copies; Cmd/Ctrl+V on a hovered day pastes.
   With `dayCopy`, the column gets a ⧉ that copies every block of that day into
   another one, and Cmd/Ctrl+Shift+C / +V do the same over a hovered day.
   All clones are deep copies with per-instance ids regenerated.

   `at` is the drop position: the index the block should land on, counted in the
   day's CURRENT list (so dropping on top of the 2nd card gives at=1). It is
   undefined when the drop lands on empty space → append. Adapters that ignore
   the argument keep the old append-only behaviour; `reorderBlock` is optional
   too — planners without a stored order (rehab_sessions has no sort column)
   simply don't reorder.
   ============================================================ */

(function () {
  'use strict';

  function tt(key, en) {
    if (window.CM_I18N && CM_I18N.t) { const v = CM_I18N.t(key); if (v && v !== key) return v; }
    return en;
  }

  // ─── Shared CSS (injected once; consistent in every planner) ───
  function injectCSS() {
    if (document.getElementById('ba-css')) return;
    const s = document.createElement('style');
    s.id = 'ba-css';
    s.textContent = `
.ba-block{ position:relative; cursor:grab; }
.ba-block.ba-dragging{ opacity:.45; cursor:grabbing; }
.ba-dup-btn{ position:absolute; top:6px; right:6px; width:22px; height:22px; display:none; align-items:center; justify-content:center; padding:0; border:1px solid var(--cm-border); background:var(--cm-surface); color:var(--cm-fg-muted); border-radius:6px; cursor:pointer; z-index:3; }
.ba-block:hover .ba-dup-btn{ display:inline-flex; }
.ba-dup-btn:hover{ color:var(--cm-fg-strong); border-color:var(--cm-accent,#16A34A); }
.ba-dup-btn .ti{ font-size:13px; }
.ba-drop-target{ outline:2px dashed var(--cm-accent,#16A34A); outline-offset:-3px; border-radius:10px; background:rgba(22,163,74,.06); }
/* whole-day copy */
.ba-day{ position:relative; }
.ba-day-copy{ position:absolute; top:7px; right:7px; width:24px; height:24px; display:none; align-items:center; justify-content:center; padding:0; border:1px solid var(--cm-border); background:var(--cm-surface); color:var(--cm-fg-muted); border-radius:6px; cursor:pointer; z-index:5; }
.ba-day:hover .ba-day-copy, .ba-day-copy.is-open{ display:inline-flex; }
.ba-day-copy:hover, .ba-day-copy.is-open{ color:var(--cm-fg-strong); border-color:var(--cm-accent,#16A34A); }
.ba-day-copy .ti{ font-size:14px; }
.ba-menu{ position:fixed; z-index:12001; min-width:190px; max-height:60vh; overflow-y:auto; padding:5px; background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:10px; box-shadow:0 12px 34px rgba(15,17,22,.18); }
.ba-menu .hd{ font:600 10px/1 var(--cm-font-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--cm-fg-muted); padding:7px 9px 5px; }
.ba-menu .sep{ height:1px; background:var(--cm-border-soft,var(--cm-border)); margin:4px 2px; }
.ba-menu button{ display:flex; align-items:center; gap:8px; width:100%; padding:7px 9px; border:0; border-radius:7px; background:transparent; color:var(--cm-fg); font:500 12.5px/1.2 var(--cm-font-sans); text-align:left; cursor:pointer; }
.ba-menu button:hover{ background:var(--cm-bg-soft); }
.ba-menu button .ti{ font-size:14px; color:var(--cm-fg-muted); flex:none; }
.ba-menu button .n{ margin-left:auto; font:500 10.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
/* insertion caret — where the card will land */
.ba-block.ba-drop-before::before,
.ba-block.ba-drop-after::after{
  content:''; position:absolute; left:0; right:0; height:3px; border-radius:2px;
  background:var(--cm-accent,#16A34A); box-shadow:0 0 0 2px rgba(22,163,74,.18); z-index:4;
}
.ba-block.ba-drop-before::before{ top:-5px; }
.ba-block.ba-drop-after::after{ bottom:-5px; }`;
    (document.head || document.documentElement).appendChild(s);
  }

  // ─── Minimal toast (self-contained; shared across planners) ───
  function toast(msg) {
    let t = document.getElementById('baToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'baToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:12000;background:#15181D;color:#fff;font:500 13px/1.4 var(--cm-font-sans);padding:10px 16px;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;max-width:80vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
  }

  // ─── Clone helpers ───
  function deepClone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (_) { return null; } }
  function stripIds(b) {
    if (b && typeof b === 'object') {
      if ('_id' in b) b._id = null;      // rehab session id → null so a fresh row is created
      if ('id' in b) b.id = null;
      if ('_sid' in b) b._sid = null;
      if ('selected' in b) b.selected = false;
    }
    return b;
  }
  function freshClone(b) { const c = deepClone(b); return c ? stripIds(c) : null; }

  // ─── Module-level clipboard (survives across days within the session) ───
  const clip = { block: null, day: null };

  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function install(adapter) {
    if (!adapter || !adapter.root) return;
    const A = adapter;
    if (A.root._baInstalled) return;   // idempotent per root
    A.root._baInstalled = true;
    injectCSS();

    // Day/block "tokens" are opaque: individual uses numeric indices, rehab uses
    // ISO date + session id. Only test presence/equality — never arithmetic.
    const hasDay = (d) => d != null && d !== '';

    const persist = () => { try { A.onChange && A.onChange(); } catch (e) { console.error('[block-actions] onChange', e); } };

    let hoverBlock = null, hoverDay = null;
    let drag = null, dropDay = null;

    // ── Decorate block cards: draggable + duplicate grip (re-applied after each render) ──
    function decorate() {
      A.root.querySelectorAll(A.blockSelector).forEach(el => {
        if (el._baReady) return;
        el._baReady = true;
        el.draggable = true;
        el.classList.add('ba-block');
        if (!el.querySelector('.ba-dup-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ba-dup-btn';
          btn.title = tt('block_actions.duplicate', 'Duplicate');
          btn.setAttribute('aria-label', tt('block_actions.duplicate', 'Duplicate'));
          btn.innerHTML = '<i class="ti ti-copy"></i>';
          el.appendChild(btn);
        }
      });
      if (!A.dayCopy) return;
      A.root.querySelectorAll(A.daySelector).forEach(el => {
        el.classList.add('ba-day');
        if (el.querySelector('.ba-day-copy')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ba-day-copy';
        btn.title = tt('block_actions.copy_day_to', 'Copy day to…');
        btn.setAttribute('aria-label', tt('block_actions.copy_day_to', 'Copy day to…'));
        btn.innerHTML = '<i class="ti ti-copy"></i>';
        el.appendChild(btn);
      });
    }
    decorate();
    const obs = new MutationObserver(() => decorate());
    obs.observe(A.root, { childList: true, subtree: true });

    // ── Track hover for keyboard copy/paste ──
    A.root.addEventListener('mouseover', (e) => {
      hoverBlock = e.target.closest(A.blockSelector) || null;
      hoverDay = e.target.closest(A.daySelector) || null;
    });
    A.root.addEventListener('mouseleave', () => { hoverBlock = null; hoverDay = null; });

    // ── Duplicate button ──
    A.root.addEventListener('click', (e) => {
      const dup = e.target.closest('.ba-dup-btn');
      if (!dup) return;
      e.preventDefault();
      e.stopPropagation();               // don't trigger the engine's block-click (edit)
      const blockEl = dup.closest(A.blockSelector);
      const ids = blockEl && A.getIds(blockEl);
      if (!ids) return;
      const data = freshClone(A.getBlock(ids.day, ids.block));
      if (!data) return;
      A.insertBlock(ids.day, data);
      persist();
      toast(tt('block_actions.duplicated', 'Block duplicated'));
    });

    // ── Whole-day copy: grab every block of a column and drop them into another ──
    function dayLabel(dayEl) {
      if (A.dayLabel) { try { return A.dayLabel(dayEl) || ''; } catch (_) {} }
      return String(dayEl.textContent || '').trim().split('\n')[0].slice(0, 24);
    }
    function collectDay(dayEl) {
      const out = [];
      dayCards(dayEl).forEach(card => {
        const ids = A.getIds(card);
        const data = ids && freshClone(A.getBlock(ids.day, ids.block));
        if (data) out.push(data);
      });
      return out;
    }
    // Blocks are appended in order; adapters that persist per block may be async,
    // so await each insert instead of firing them all at once.
    async function pasteDayInto(dayEl, blocks) {
      const to = A.getDayIndex(dayEl);
      if (!hasDay(to) || !blocks || !blocks.length) return 0;
      for (const b of blocks) {
        const r = A.insertBlock(to, freshClone(b));
        if (r && typeof r.then === 'function') await r;
      }
      persist();
      return blocks.length;
    }

    let dayMenu = null;
    function closeDayMenu() {
      if (!dayMenu) return;
      A.root.querySelectorAll('.ba-day-copy.is-open').forEach(b => b.classList.remove('is-open'));
      dayMenu.remove(); dayMenu = null;
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('keydown', onMenuKey, true);
    }
    const onDocDown = (e) => { if (dayMenu && !dayMenu.contains(e.target)) closeDayMenu(); };
    const onMenuKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeDayMenu(); } };

    function openDayMenu(btn, dayEl) {
      closeDayMenu();
      const blocks = collectDay(dayEl);
      if (!blocks.length) { toast(tt('block_actions.day_empty', 'This day has no blocks')); return; }
      const from = A.getDayIndex(dayEl);
      dayMenu = document.createElement('div');
      dayMenu.className = 'ba-menu';
      const head = document.createElement('div');
      head.className = 'hd';
      head.textContent = tt('block_actions.copy_day_to', 'Copy day to…');
      dayMenu.appendChild(head);

      Array.from(A.root.querySelectorAll(A.daySelector))
        .filter(d => String(A.getDayIndex(d)) !== String(from))
        .forEach(d => {
          const item = document.createElement('button');
          item.type = 'button';
          const n = dayCards(d).length;
          item.innerHTML = '<i class="ti ti-calendar-plus"></i>';
          item.appendChild(document.createTextNode(dayLabel(d)));
          if (n) { const c = document.createElement('span'); c.className = 'n'; c.textContent = '+' + n; item.appendChild(c); }
          item.addEventListener('click', async () => {
            closeDayMenu();
            const n2 = await pasteDayInto(d, blocks);
            if (n2) toast(tt('block_actions.day_pasted', 'Day copied') + ' · ' + n2);
          });
          dayMenu.appendChild(item);
        });

      const sep = document.createElement('div'); sep.className = 'sep'; dayMenu.appendChild(sep);
      const clipItem = document.createElement('button');
      clipItem.type = 'button';
      clipItem.innerHTML = '<i class="ti ti-clipboard-copy"></i>';
      clipItem.appendChild(document.createTextNode(tt('block_actions.copy_day', 'Copy day')));
      clipItem.addEventListener('click', () => {
        clip.day = blocks; closeDayMenu();
        toast(tt('block_actions.day_copied', 'Day copied') + ' · ' + blocks.length);
      });
      dayMenu.appendChild(clipItem);

      document.body.appendChild(dayMenu);
      const r = btn.getBoundingClientRect(), m = dayMenu.getBoundingClientRect();
      dayMenu.style.left = Math.max(8, Math.min(r.right - m.width, window.innerWidth - m.width - 8)) + 'px';
      dayMenu.style.top  = (r.bottom + 6 + m.height > window.innerHeight ? Math.max(8, r.top - m.height - 6) : r.bottom + 6) + 'px';
      btn.classList.add('is-open');
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onMenuKey, true);
    }

    A.root.addEventListener('click', (e) => {
      const btn = e.target.closest('.ba-day-copy');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const dayEl = btn.closest(A.daySelector);
      if (dayEl) openDayMenu(btn, dayEl);
    });

    // ── Keyboard copy / paste (scoped: only when hovering the kanban, not typing) ──
    document.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = (e.key || '').toLowerCase();
      if (k !== 'c' && k !== 'v') return;
      if (isTyping()) return;
      // Shift = whole day (⌘⇧C over a day copies it, ⌘⇧V pastes it into another)
      if (e.shiftKey && A.dayCopy) {
        if (!hoverDay) return;
        e.preventDefault();
        if (k === 'c') {
          const blocks = collectDay(hoverDay);
          if (!blocks.length) { toast(tt('block_actions.day_empty', 'This day has no blocks')); return; }
          clip.day = blocks;
          toast(tt('block_actions.day_copied', 'Day copied') + ' · ' + blocks.length);
        } else if (clip.day) {
          pasteDayInto(hoverDay, clip.day).then(n => {
            if (n) toast(tt('block_actions.day_pasted', 'Day copied') + ' · ' + n);
          });
        }
        return;
      }
      if (k === 'c') {
        if (window.getSelection && String(window.getSelection())) return; // let real text-copy through
        if (!hoverBlock) return;
        const ids = A.getIds(hoverBlock);
        const data = ids && freshClone(A.getBlock(ids.day, ids.block));
        if (!data) return;
        clip.block = data;
        e.preventDefault();
        toast(tt('block_actions.copied', 'Block copied'));
      } else {
        if (!clip.block || !hoverDay) return;
        const di = A.getDayIndex(hoverDay);
        if (!hasDay(di)) return;
        e.preventDefault();
        A.insertBlock(di, freshClone(clip.block));
        persist();
        toast(tt('block_actions.pasted', 'Block pasted'));
      }
    });

    // ── Drag: plain = move, Alt/grip = copy; the drop position sets the order ──
    let dropAt;                       // index the card will land on (undefined = append)
    function clearCaret() {
      A.root.querySelectorAll('.ba-drop-before,.ba-drop-after')
        .forEach(el => el.classList.remove('ba-drop-before', 'ba-drop-after'));
      dropAt = undefined;
    }
    function clearDrop() { clearCaret(); if (dropDay) { dropDay.classList.remove('ba-drop-target'); dropDay = null; } }
    function cleanupDrag() {
      clearDrop();
      A.root.querySelectorAll('.ba-dragging').forEach(el => el.classList.remove('ba-dragging'));
      drag = null;
    }
    // Cards render in list order, so the card's position among its siblings is
    // its index in the data — no need to read the engine's own ids here.
    function dayCards(dayEl) { return Array.from(dayEl.querySelectorAll(A.blockSelector)); }
    function paintCaret(dayEl, e) {
      clearCaret();
      // Only planners that store an order get the insertion caret — showing one
      // where the drop always appends would be a lie (rehab_sessions has no
      // sort column, so its adapter provides no reorderBlock).
      if (!A.reorderBlock) return;
      const cards = dayCards(dayEl);
      const over = e.target.closest(A.blockSelector);
      if (!over || !cards.includes(over)) {
        // Empty space (or the "add block" button) → land at the end.
        dropAt = undefined;
        return;
      }
      const r = over.getBoundingClientRect();
      const after = (e.clientY - r.top) > r.height / 2;
      over.classList.add(after ? 'ba-drop-after' : 'ba-drop-before');
      dropAt = cards.indexOf(over) + (after ? 1 : 0);
    }

    A.root.addEventListener('dragstart', (e) => {
      const blockEl = e.target.closest(A.blockSelector);
      const ids = blockEl && A.getIds(blockEl);
      if (!ids) return;
      drag = { day: ids.day, block: ids.block, fromGrip: !!e.target.closest('.ba-dup-btn') };
      try { e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', 'ba-block'); } catch (_) {}
      blockEl.classList.add('ba-dragging');
    });

    A.root.addEventListener('dragover', (e) => {
      if (!drag) return;
      const dayEl = e.target.closest(A.daySelector);
      if (!dayEl) return;
      e.preventDefault();
      const copy = e.altKey || drag.fromGrip;
      try { e.dataTransfer.dropEffect = copy ? 'copy' : 'move'; } catch (_) {}
      if (dropDay !== dayEl) { clearDrop(); dropDay = dayEl; dayEl.classList.add('ba-drop-target'); }
      paintCaret(dayEl, e);
    });

    A.root.addEventListener('dragleave', (e) => {
      const dayEl = e.target.closest(A.daySelector);
      if (dayEl && dayEl === dropDay && !dayEl.contains(e.relatedTarget)) clearDrop();
    });

    A.root.addEventListener('drop', (e) => {
      if (!drag) return;
      const dayEl = e.target.closest(A.daySelector);
      e.preventDefault();
      const to = dayEl ? A.getDayIndex(dayEl) : null;
      const copy = e.altKey || drag.fromGrip;
      const at = dropAt;
      if (hasDay(to)) {
        let changed = true;
        if (copy) {
          const data = freshClone(A.getBlock(drag.day, drag.block));
          if (data) { A.insertBlock(to, data, at); toast(tt('block_actions.duplicated', 'Block duplicated')); }
          else changed = false;
        } else if (String(to) !== String(drag.day) && A.moveBlock) {
          A.moveBlock(drag.day, drag.block, to, at);
          toast(tt('block_actions.moved', 'Block moved'));
        } else if (String(to) === String(drag.day) && A.reorderBlock && at != null) {
          // Dropping either side of its own gap leaves the order untouched.
          const from = Number(drag.block);
          if (!isNaN(from) && (at === from || at === from + 1)) changed = false;
          else { A.reorderBlock(drag.day, drag.block, at); toast(tt('block_actions.reordered', 'Order updated')); }
        } else {
          changed = false;
        }
        if (changed) persist();
      }
      cleanupDrag();
    });

    A.root.addEventListener('dragend', cleanupDrag);
  }

  window.BlockActions = { install, _clip: clip };
})();
