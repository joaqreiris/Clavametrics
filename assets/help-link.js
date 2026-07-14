/* =============================================================
   ClavaMetrics — contextual help button
   Wires the topbar "?" (i.ti-help) to the public support center:
   opens /support/<slug> for the current app page in a new tab, or
   /support (the hub) when the page has no doc yet.

   The app_page → slug map is GENERATED (support/help-map.json, emitted
   by scripts/build-support.mjs from each doc's frontmatter) — never
   hand-maintained here, so it can't drift from the docs.

   No dependencies. If a page has no "?" button, one is injected into the
   topbar using the exact same markup Hub.html uses, so only the <script>
   include is needed per page (no per-page markup edits, no logic touched).
   ============================================================= */
(function () {
  "use strict";

  var MAP = null; // app_page -> slug, once loaded

  function currentFile() {
    var last = (location.pathname.split("/").pop() || "");
    try { last = decodeURIComponent(last); } catch (e) {}
    return last;
  }

  function i18nText(key, fallback) {
    try {
      if (window.CM_I18N && typeof window.CM_I18N.tt === "function") {
        var v = window.CM_I18N.tt(key, fallback);
        if (v) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function makeHelpButton() {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cm-icon-btn";
    b.setAttribute("title", "Help");
    b.setAttribute("aria-label", "Help");
    b.setAttribute("data-i18n-attr", "title:hub.help;aria-label:hub.help");
    b.innerHTML = '<i class="ti ti-help"></i>';
    return b;
  }

  // Return the existing help button(s); if none, inject one into the topbar.
  function findOrInjectButtons() {
    var found = [];
    var icons = document.querySelectorAll(".ti-help");
    for (var i = 0; i < icons.length; i++) {
      var btn = icons[i].closest("button, a");
      if (btn) found.push(btn);
    }
    if (found.length) return found;

    // Inject next to the Settings button (the consistent topbar anchor).
    var settings = document.querySelector("[data-open-settings]");
    var btn2 = makeHelpButton();
    if (settings && settings.parentElement) {
      settings.parentElement.insertBefore(btn2, settings);
      return [btn2];
    }
    // Fallback: any topbar/toolbar actions container (e.g. Dossier's toolbar).
    var bar = document.querySelector(".toolbar, .actions, .cm-topbar, .topbar, .top-actions");
    if (bar) {
      bar.appendChild(btn2);
      return [btn2];
    }
    return [];
  }

  function wire(buttons) {
    var file = currentFile();
    var slug = MAP && MAP[file] ? MAP[file] : null;
    var href = slug ? "/support/" + slug : "/support";

    buttons.forEach(function (btn) {
      if (btn.dataset.helpWired === "1") {
        // Already wired earlier (before the map loaded) — just refresh the target.
        btn.__helpHref = href;
        return;
      }
      btn.dataset.helpWired = "1";
      btn.__helpHref = href;

      if (slug) {
        var label = i18nText("help.open_docs", "Open docs for this page");
        btn.setAttribute("title", label);
        btn.setAttribute("aria-label", label);
        // Keep it translatable on later language switches.
        btn.setAttribute("data-i18n-attr", "title:help.open_docs;aria-label:help.open_docs");
      }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        window.open(btn.__helpHref || "/support", "_blank", "noopener");
      });
    });
  }

  function init() {
    var buttons = findOrInjectButtons();
    if (!buttons.length) return;
    // Wire immediately (falls back to /support until the map resolves).
    wire(buttons);
    // Load the generated map, then refine the target + tooltip.
    fetch("/support/help-map.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) { MAP = m || {}; wire(buttons); })
      .catch(function () { /* offline / missing map → stays on /support */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
