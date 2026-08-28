// ClavaMetrics — Shared position vocabulary (single source of truth)
// Requires assets/sport-packs.js (and, on app pages, assets/sport.js) loaded BEFORE this:
//   <script src="assets/sport-packs.js"></script>
//   <script src="assets/sport.js"></script>
//   <script src="assets/positions.js"></script>
//
// MODEL: one canonical DETAILED code is what gets STORED in players.position; the coarser
// levels are DERIVED, never stored — so analysis can roll up without ever losing detail:
//
//   detailed (LB, CDM, LW…)  →  basic (GK CB FB MF WG ST)  →  group (Goalkeepers, …)
//
// Why derive instead of letting the user pick one vocabulary: a 25-man squad spread over
// ~20 detailed positions leaves ~1 player per position, which makes the "vs Position"
// baseline compare a player against himself. Rolling up gives a real reference set —
// while the detailed code stays available for squad/lineup views.
//
// MULTI-SPORT: the tables themselves now come from the ACTIVE SPORT PACK
// (assets/sport-packs.js), not from this file. Football keeps exactly the vocabulary it
// always had; basketball rolls up to guards/wings/bigs, rugby to the pack/backs split
// the load literature requires, and so on. Everything below is sport-agnostic plumbing.
//
// The exports are live getters, not snapshots: if the club's sport is confirmed after
// first paint (see assets/sport.js), CM_POSITIONS.CFG reflects it without a reload.

(function () {
  if (window.CM_POSITIONS) return;   // idempotent

  var DEFAULT_SPORT = window.CM_SPORT_DEFAULT || 'football';

  /** The active pack's `positions` block, or null for sports with no position model
   *  ('other' — free text, never normalised, never rolled up). */
  function P() {
    try {
      var pack = window.CMSport
        ? window.CMSport.pack()
        : (window.CM_SPORT_PACKS || {})[DEFAULT_SPORT];
      return (pack && pack.positions) || null;
    } catch (_e) { return null; }
  }

  function cfg()        { var p = P(); return (p && p.cfg)        || {}; }
  function aliases()    { var p = P(); return (p && p.aliases)    || {}; }
  function selectable() { var p = P(); return (p && p.selectable) || []; }
  function labels()     { var p = P(); return (p && p.labels)     || {}; }
  function basics()     { var p = P(); return (p && p.basics)     || []; }
  function groupDefs()  { var p = P(); return (p && p.groups)     || []; }

  /** Group display keys in pack order, with the catch-all last (unchanged behaviour). */
  function groups() {
    return groupDefs().map(function (g) { return g.key; }).concat(['Other']);
  }

  /** Group key → { key, i18n, icon }. 'Other' has no pack entry; callers fall back. */
  function groupMeta(key) {
    var found = null;
    groupDefs().forEach(function (g) { if (g.key === key) found = g; });
    return found;
  }

  /** Long display name for a code: { i18n, en }. Falls back to the bare code. */
  function labelFor(code) {
    var c = normalize(code) || String(code == null ? '' : code).trim().toUpperCase();
    return labels()[c] || { i18n: '', en: c };
  }

  /** Detailed code → one of the six colour classes Squad already styles. */
  function cssFor(code) {
    var b = basic(code);
    return b ? cssForBasic(b) : '';
  }

  /** Basic (roll-up) code → colour class. Chips and legends key off the roll-up, not
   *  the detailed code, so they need this entry point directly. */
  function cssForBasic(b) {
    var p = P(); if (!p || !p.cssByBasic || !b) return '';
    return p.cssByBasic[b] || '';
  }

  /** Free text → canonical detailed code, or null when unknown/empty.
   *  Returns null (never a guess) so callers don't invent a position. */
  function normalize(raw) {
    try {
      if (raw == null) return null;
      var k = String(raw).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toUpperCase().replace(/\s+/g, ' ');
      if (!k) return null;
      // ALIASES first: the full names (GOALKEEPER, DEFENDER, …) exist in BOTH tables, and we
      // want them collapsed to the short code (GK, CB, …) rather than stored verbatim —
      // otherwise "GK" and "GOALKEEPER" become two separate values all over again.
      // No bare short code is an alias key, so valid codes still fall through to CFG.
      var A = aliases(), C = cfg();
      if (A[k]) return A[k];
      if (C[k]) return k;
      return null;
    } catch (_e) { return null; }
  }

  /** Detailed code (or free text) → basic roll-up code, or null. */
  function basic(code) {
    var c = normalize(code), C = cfg();
    return (c && C[c] && C[c].basic) || null;
  }

  /** Detailed code (or free text) → broad group label, 'Other' when unknown. */
  function group(code) {
    var c = normalize(code), C = cfg();
    return (c && C[c] && C[c].group) || 'Other';
  }

  /** Sort index within the squad list (front of the field first). 999 when unknown. */
  function order(code) {
    var c = normalize(code), C = cfg();
    return (c && C[c] && typeof C[c].order === 'number') ? C[c].order : 999;
  }

  /** Project a stored position onto the ACTIVE analysis granularity.
   *  'detailed' → canonical code, or the RAW value when we don't know it (so a club's
   *               custom position never disappears from a filter that showed it before);
   *  'basic'    → the roll-up;  'group' → broad group. Unknown → null in those two,
   *  because there's nothing sound to roll an unrecognised value up to. */
  function at(code, granularity) {
    if (code == null || code === '') return null;
    if (granularity === 'basic') return basic(code);
    if (granularity === 'group') { var g = group(code); return g === 'Other' ? null : g; }
    return normalize(code) || String(code).trim() || null;
  }

  var GRANULARITIES = ['detailed', 'basic', 'group'];

  // Live view over the active pack. Defined with getters so a sport confirmed after
  // first paint (cm:sport-change) is picked up without reloading the page.
  var API = {};
  Object.defineProperties(API, {
    CFG:           { enumerable: true, get: cfg },
    ALIASES:       { enumerable: true, get: aliases },
    SELECTABLE:    { enumerable: true, get: selectable },
    LABELS:        { enumerable: true, get: labels },
    BASIC:         { enumerable: true, get: basics },
    GROUPS:        { enumerable: true, get: groups },
    GROUP_DEFS:    { enumerable: true, get: groupDefs },
    GRANULARITIES: { enumerable: true, get: function () { return GRANULARITIES.slice(); } },
    /** False for sports with no position model — hide position pickers and filters. */
    HAS_POSITIONS: { enumerable: true, get: function () { return !!P(); } },
  });

  window.CM_POSITIONS = API;
  window.cmPositionAt        = at;
  window.cmNormalizePosition = normalize;
  window.cmPositionBasic     = basic;
  window.cmPositionGroup     = group;
  window.cmPositionOrder     = order;
  window.cmPositionCss       = cssFor;
  window.cmPositionCssBasic  = cssForBasic;
  window.cmPositionGroupMeta = groupMeta;
  window.cmPositionLabel     = labelFor;
})();
