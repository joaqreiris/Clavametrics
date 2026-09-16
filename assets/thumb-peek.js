/* thumb-peek.js — hover preview for exercise thumbnails in the pickers.
 *
 * The picker rows show a 44–64px thumb, which is too small to tell one drill
 * from another: coaches were clicking a row just to see what it was, which adds
 * the exercise and loses the filters they had typed. Hovering the thumb now
 * blows it up in a floating panel — no click, the list keeps its state, and the
 * panel never eats the pointer so the row underneath stays clickable.
 *
 * Usage: mark the thumb element with the attributes this helper builds:
 *   <div ${CMThumbPeek.attr(imgUrl, name)}> … </div>
 * or set data-peek-src / data-peek-label by hand. Elements whose src resolves
 * later (signed URLs) can just be re-rendered — the lookup happens on hover.
 *
 * Pointer-only: devices without hover (tablet touch) get nothing, because there
 * a "hover" is a tap and a tap must keep meaning "add this exercise".
 */
(function () {
  if (window.CMThumbPeek) return;

  var SHOW_DELAY = 140;        // enough to sweep a list without strobing panels
  var GAP        = 14;         // px between the anchor and the panel
  var MIN_W      = 220;        // below this the enlargement stops being worth it
  var box = null, img = null, cap = null;
  var timer = null, current = null, visible = false;

  var canHover = function () {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    catch (_) { return true; }
  };

  function ensure() {
    if (box) return box;
    box = document.createElement('div');
    box.id = 'cmThumbPeek';
    box.style.cssText = 'position:fixed;z-index:4000;pointer-events:none;opacity:0;box-sizing:border-box;' +
      'transition:opacity .1s ease;background:var(--cm-surface,#fff);' +
      'border:1px solid var(--cm-border,rgba(0,0,0,.12));border-radius:12px;padding:6px;' +
      'box-shadow:0 18px 48px rgba(8,10,12,.22);display:none';
    img = document.createElement('img');
    img.alt = '';
    img.style.cssText = 'display:block;width:100%;height:auto;max-height:64vh;object-fit:contain;' +
      'border-radius:8px;background:#2f7d4c';
    cap = document.createElement('div');
    cap.style.cssText = 'font:600 12px/1.25 var(--cm-font-sans,system-ui);color:var(--cm-fg-strong,#111);' +
      'padding:6px 4px 2px;text-align:center;word-break:break-word';
    box.appendChild(img); box.appendChild(cap);
    document.body.appendChild(box);
    return box;
  }

  // Prefer a panel that fits in the margin beside the dialog, shrinking down to
  // MIN_W before giving up and sitting on top of the list.
  function width(el) {
    var vw  = window.innerWidth;
    var max = Math.max(MIN_W, Math.min(360, Math.round(vw * 0.28)));
    var a   = el.closest('[data-peek-anchor]');
    if (a) {
      var ar   = a.getBoundingClientRect();
      var side = Math.max(ar.left, vw - ar.right) - GAP - 8;
      if (side >= MIN_W) return Math.min(max, Math.floor(side));
    }
    return max;
  }

  // The panel sits beside the dialog the thumb lives in (mark it with
  // data-peek-anchor), not beside the thumb: dropping it on top of the list would
  // cover the very rows the coach is scanning. Falls back to the thumb itself when
  // there is no anchor, and to an on-top position when neither side fits.
  function place(el) {
    var r = el.getBoundingClientRect();
    var a = el.closest('[data-peek-anchor]');
    var ar = a ? a.getBoundingClientRect() : r;
    var w = box.offsetWidth, h = box.offsetHeight;
    var left = ar.right + GAP;
    if (left + w > window.innerWidth - 8) left = ar.left - GAP - w;     // flip to the other side
    if (left < 8) left = Math.max(8, Math.min(r.right + GAP, window.innerWidth - w - 8));
    var top = r.top + r.height / 2 - h / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    box.style.left = Math.round(left) + 'px';
    box.style.top  = Math.round(top)  + 'px';
  }

  function show(el, src, label) {
    ensure();
    box.style.width = width(el) + 'px';
    cap.textContent = label || '';
    cap.style.display = label ? '' : 'none';
    box.style.display = 'block';
    var done = function () { if (current === el) { place(el); box.style.opacity = '1'; visible = true; } };
    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) { done(); return; }
    img.onload  = done;
    img.onerror = function () { if (current === el) hide(); };
    img.src = src;
    if (img.complete && img.naturalWidth) done();
  }

  function hide() {
    clearTimeout(timer); timer = null; current = null; visible = false;
    if (!box) return;
    box.style.opacity = '0';
    box.style.display = 'none';
  }

  function onOver(ev) {
    if (!canHover()) return;
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-peek-src]') : null;
    if (!el || el === current) return;
    var src = el.getAttribute('data-peek-src');
    if (!src) { hide(); return; }
    var label = el.getAttribute('data-peek-label') || '';
    current = el;
    clearTimeout(timer);
    if (visible) show(el, src, label);                                  // already open: swap instantly
    else timer = setTimeout(function () { show(el, src, label); }, SHOW_DELAY);
  }

  function onOut(ev) {
    if (!current) return;
    var to = ev.relatedTarget;
    if (to && to.closest && to.closest('[data-peek-src]') === current) return;
    hide();
  }

  document.addEventListener('mouseover', onOver, true);
  document.addEventListener('mouseout',  onOut,  true);
  document.addEventListener('scroll', function () { if (current) hide(); }, true);
  document.addEventListener('click', function () { if (current) hide(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); }, true);
  window.addEventListener('resize', function () { if (current) hide(); });
  window.addEventListener('blur',   function () { if (current) hide(); });

  var escA = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  window.CMThumbPeek = {
    // Attribute string for a thumb element; returns '' when there is nothing to enlarge.
    attr: function (src, label) {
      if (!src) return '';
      return 'data-peek-src="' + escA(src) + '"' +
             (label ? ' data-peek-label="' + escA(label) + '"' : '');
    },
    hide: hide
  };
})();
