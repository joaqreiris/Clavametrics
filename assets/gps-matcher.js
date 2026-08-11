/**
 * gps-matcher.js — shared athlete↔squad matching core.
 *
 * Single source of truth for the fuzzy matcher used by:
 *   - GPS Analysis.html  (CSV import wizard, step 3 "Match players")
 *   - Admin.html         (Integrations → "Map athletes", Catapult)
 *
 * Exposes window.CMGpsMatch. Pure logic only — no DOM, no Supabase. The two
 * callers keep their own UX; they MUST NOT re-implement scoring/categorization.
 *
 * findBestMatch(rawName, rawJersey, rawExtGpsId, squad) → { player, score, confidence }
 *   squad rows shape: { id, first_name, last_name, number, position, external_gps_id }
 * categorize(match) → 'matched' | 'verify' | 'unmatched'
 */
(function () {
  'use strict';

  function normName(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function lev(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => i ? (j ? 0 : i) : j));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  function sim(a, b) {
    a = normName(a); b = normName(b);
    const mx = Math.max(a.length, b.length);
    return mx ? 1 - lev(a, b) / mx : 1;
  }

  // Score a single source player against a squad. Priority:
  //   1. external_gps_id exact (1.1)
  //   2. jersey + name COMBINED — jersey is strong but NOT unique (duplicate numbers happen),
  //      so the name breaks the tie between two same-number players. jersey+name ⇒ up to 1.0;
  //      jersey with a disagreeing name ⇒ 0.7 (drops to "verify" so it isn't auto-confirmed).
  //   3. name only (both orders + initial+last) ⇒ nameSim.
  function findBestMatch(rawName, rawJersey, rawExtGpsId, squad) {
    let best = null, bestScore = 0;
    (squad || []).forEach(p => {
      let score = 0;

      if (rawExtGpsId && p.external_gps_id && p.external_gps_id === rawExtGpsId) {
        score = 1.1;
      } else {
        let nameSim = 0;
        if (rawName) {
          const n = normName(rawName);
          nameSim = Math.max(
            sim(n, normName(p.first_name + ' ' + p.last_name)),
            sim(n, normName(p.last_name + ' ' + p.first_name)),
            sim(n, normName((p.first_name?.[0] || '') + ' ' + p.last_name)));
        }
        const jerseyOk = rawJersey && p.number &&
          String(p.number) === rawJersey.replace(/\D/g, '');
        // Jersey alone = 0.7 (verify, not auto-confirm); name refines it up to 1.0 so the
        // correctly-named same-number player always outranks a mere number collision.
        score = jerseyOk ? 0.7 + 0.3 * nameSim : nameSim;
      }
      if (score > bestScore) { bestScore = score; best = p; }
    });
    const confidence = bestScore >= 1.0 ? 'high' : bestScore > 0.65 ? 'medium' : 'low';
    return { player: best, score: bestScore, confidence };
  }

  // UX category thresholds — shared so both wizards bucket identically.
  const S3_HIGH = 0.85;
  const S3_MED  = 0.60;

  function categorize(match) {
    const s = (match && match.score) || 0;
    return s > S3_HIGH ? 'matched' : s >= S3_MED ? 'verify' : 'unmatched';
  }

  window.CMGpsMatch = { normName, lev, sim, findBestMatch, categorize, S3_HIGH, S3_MED };
})();
