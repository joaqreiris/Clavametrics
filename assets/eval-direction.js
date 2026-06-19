/* ────────────────────────────────────────────────────────────────────────
   eval-direction.js — shared "direction-of-better" helper for test deltas.
   Exposes window.evalDir.{ isLowerBetter(type, unit), deltaDir(delta, type, unit) }.
   Used by the Player profile (overview physical card + tests records table) to
   color a signed delta green/red according to whether higher or lower is better.
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  // LOWER value = better (timed sprints/agility, etc.)
  function isLowerBetter(type, unit){
    const u = String(unit||'').trim().toLowerCase();
    if (['s','sec','secs','second','seconds','ms','msec'].includes(u)) return true;
    const t = String(type||'').toLowerCase();
    return /(sprint|agilit|t-?test|5-?0-?5|\b505\b|rsa|\btime\b|\d+\s?m\b)/.test(t);
  }
  // 'pos' = improved, 'neg' = worse, 'flat' = no change/unknown
  function deltaDir(delta, type, unit){
    if (delta == null || isNaN(delta) || Number(delta) === 0) return 'flat';
    const improved = isLowerBetter(type, unit) ? Number(delta) < 0 : Number(delta) > 0;
    return improved ? 'pos' : 'neg';
  }
  window.evalDir = { isLowerBetter, deltaDir };
})();
