/* =============================================================
   ClavaMetrics — Support center client script
   Client-side search over /support/search-index.json, mobile sidebar
   toggle, and TOC scroll-spy. No build step, no dependencies.
   Source: support-site/templates/docs.js → copied to /support/docs.js.
   ============================================================= */
(function () {
  "use strict";

  /* ── Search ── */
  var input = document.getElementById("dxSearchInput");
  var box = document.getElementById("dxResults");
  var index = null;
  var cursor = -1;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetch("/support/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; return index; })
      .catch(function () { index = []; return index; });
  }

  function score(page, q) {
    var t = page.title.toLowerCase();
    var h = (page.headings || []).join(" ").toLowerCase();
    var body = (page.text || "").toLowerCase();
    if (t.indexOf(q) === 0) return 100;
    if (t.indexOf(q) !== -1) return 70;
    if (h.indexOf(q) !== -1) return 45;
    if (body.indexOf(q) !== -1) return 20;
    return 0;
  }

  function render(results, q) {
    if (!results.length) {
      box.innerHTML = '<div class="r-empty">No results for “' + escapeHtml(q) + '”.</div>';
      box.hidden = false;
      return;
    }
    box.innerHTML = results.map(function (p, i) {
      return '<a href="/support/' + p.slug + '" data-i="' + i + '">' +
        '<span class="r-world">' + escapeHtml(p.worldTitle || p.world) + '</span>' +
        '<span class="r-title">' + escapeHtml(p.title) + '</span></a>';
    }).join("");
    box.hidden = false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function search() {
    var q = (input.value || "").trim().toLowerCase();
    cursor = -1;
    if (q.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
    loadIndex().then(function (pages) {
      var scored = pages
        .map(function (p) { return { p: p, s: score(p, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 8)
        .map(function (x) { return x.p; });
      render(scored, q);
    });
  }

  if (input && box) {
    input.addEventListener("input", search);
    input.addEventListener("focus", function () { if (input.value.trim().length >= 2) search(); });
    input.addEventListener("keydown", function (e) {
      var items = box.querySelectorAll("a");
      if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(cursor + 1, items.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(cursor - 1, 0); }
      else if (e.key === "Enter") { if (items[cursor]) { e.preventDefault(); location.href = items[cursor].href; } return; }
      else if (e.key === "Escape") { box.hidden = true; input.blur(); return; }
      else return;
      items.forEach(function (a, i) { a.classList.toggle("is-cursor", i === cursor); });
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
    // "/" focuses search
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  /* ── Mobile sidebar toggle ──
     The sidebar is visible by default (CSS) and only collapses on narrow
     screens, where this toggle re-opens it via the `is-open` class. No JS
     is needed on desktop, so the nav degrades gracefully. */
  var toggle = document.querySelector(".dx-side-toggle");
  var side = document.getElementById("dxSide");
  if (toggle && side) {
    toggle.addEventListener("click", function () {
      var open = side.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* ── TOC scroll-spy ── */
  var toc = document.getElementById("dxToc");
  if (toc) {
    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    if (targets.length && "IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
          }
        });
      }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });
      targets.forEach(function (t) { obs.observe(t); });
    }
  }
})();
