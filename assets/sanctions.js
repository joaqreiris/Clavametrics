/* =============================================================
   sanctions.js — accumulated sanctions and when they cost a match.

   WHY
   The app could record that a player got a yellow, and that was the end of it: nothing
   added them up, nothing warned anyone, and there was nowhere to say that this league
   suspends at three. Both tables for it (league_configs, card_accumulations) had existed
   for months without a single line of code touching them, which is most likely why nobody
   bothered filling in match reports — the data went into a hole.

   WHAT COUNTS AS A SANCTION IS THE SPORT'S CALL, THE THRESHOLD IS THE LEAGUE'S
   Football counts yellows, basketball technicals (personal fouls reset every game, so they
   never accumulate), hockey has a third card. The sport pack declares which sanctions
   exist and which accumulate; the league config says how many cost a game. Cambodia
   suspends at 3 yellows, most leagues at 5 — same sport, different rule, so it cannot live
   in the pack.

   PURE
   No DOM and no network here: these are the rules. The caller supplies the league config
   and the counts, and gets back what to do.
   ============================================================= */
(function () {
  'use strict';
  if (window.cmSanctions) return;   // idempotent

  /** The sanction types this sport recognises, from the pack. */
  function types() {
    try {
      const t = window.CMSport && window.CMSport.at('match.sanctionTypes', null);
      return Array.isArray(t) ? t : [];
    } catch (_e) { return []; }
  }

  /** Just the ones that pile up across matches. Personal fouls in basketball reset every
   *  game and are deliberately not here. */
  function accumulating() { return types().filter(t => t.accumulates); }

  function typeOf(key) { return types().find(t => t.key === key) || null; }

  /**
   * The rule in force for one sanction, resolved in the order that respects who decides
   * what: the league's own setting, then the sport's default, then nothing.
   *
   * @param {object|null} league  a league_configs row
   * @param {string} sanction     'yellow' | 'technical' | …
   * @returns {{threshold:number|null, banGames:number, accumulates:boolean}|null}
   */
  function ruleFor(league, sanction) {
    const type = typeOf(sanction);
    if (!type) return null;

    // 1. An explicit rule in league_configs.rules wins.
    const rules = (league && Array.isArray(league.rules)) ? league.rules : [];
    const row = rules.find(r => r && r.sanction === sanction);
    if (row) {
      return {
        accumulates: row.accumulates !== undefined ? !!row.accumulates : !!type.accumulates,
        threshold:   row.threshold != null ? +row.threshold : (type.threshold ?? null),
        banGames:    row.ban_games != null ? +row.ban_games : (type.banGames ?? 0),
      };
    }
    // 2. The legacy football columns, for a league row saved before `rules` existed.
    if (league && sanction === 'yellow' && league.yellow_threshold != null) {
      return { accumulates: true, threshold: +league.yellow_threshold,
               banGames: league.yellow_ban_games != null ? +league.yellow_ban_games : 1 };
    }
    if (league && sanction === 'red' && league.red_direct_games != null) {
      return { accumulates: false, threshold: null, banGames: +league.red_direct_games };
    }
    // 3. The sport's own default.
    return { accumulates: !!type.accumulates, threshold: type.threshold ?? null,
             banGames: type.banGames ?? 0 };
  }

  /** Read a player's running count for one sanction out of a card_accumulations row.
   *  Falls back to yellow_count, which was the only counter the table had. */
  function countOf(row, sanction) {
    if (!row) return 0;
    const counts = row.counts && typeof row.counts === 'object' ? row.counts : null;
    if (counts && counts[sanction] != null) return +counts[sanction] || 0;
    if (sanction === 'yellow' && row.yellow_count != null) return +row.yellow_count || 0;
    return 0;
  }

  /**
   * Where a player stands after a match.
   *
   * @returns {{sanction, count, threshold, banGames, status, remaining}}
   *   status: 'ok'        nothing to say
   *           'approaching' one away from the ban — the point of the whole feature is to
   *                         warn BEFORE the player is unavailable, not after
   *           'reached'   the threshold is met: the player misses banGames
   */
  function evaluate(league, sanction, count) {
    const rule = ruleFor(league, sanction);
    const out = { sanction, count: +count || 0, threshold: null, banGames: 0,
                  status: 'ok', remaining: null };
    if (!rule || !rule.accumulates || !rule.threshold) return out;
    out.threshold = rule.threshold;
    out.banGames  = rule.banGames;
    out.remaining = Math.max(0, rule.threshold - out.count);
    if (out.count >= rule.threshold)   out.status = 'reached';
    else if (out.remaining === 1)      out.status = 'approaching';
    return out;
  }

  /**
   * Everything worth telling the staff after a match, for a whole squad.
   *
   * @param {object} league
   * @param {Array}  rows  [{ player_id, name, counts }] — counts keyed by sanction
   * @returns {Array} the players at 'approaching' or 'reached', worst first
   */
  function alerts(league, rows) {
    const out = [];
    (rows || []).forEach(r => {
      accumulating().forEach(t => {
        const ev = evaluate(league, t.key, countOf(r, t.key));
        if (ev.status === 'ok') return;
        out.push(Object.assign({ player_id: r.player_id, name: r.name }, ev));
      });
    });
    // Reached before approaching; within each, the higher count first.
    const rank = s => (s === 'reached' ? 0 : 1);
    return out.sort((a, b) => rank(a.status) - rank(b.status) || b.count - a.count);
  }

  /** Apply one match's sanctions to a running count. Returns the new counts object.
   *  `matchCounts` is what the player picked up in THIS match: { yellow: 1 }. */
  function apply(current, matchCounts) {
    const next = Object.assign({}, (current && typeof current === 'object') ? current : {});
    Object.entries(matchCounts || {}).forEach(([k, n]) => {
      const add = +n || 0;
      if (!add) return;
      next[k] = (+next[k] || 0) + add;
    });
    return next;
  }

  /** After serving a ban the counter goes back to zero for that sanction — the league
   *  resets it, the player does not carry the same yellows into the next suspension. */
  function reset(current, sanction) {
    const next = Object.assign({}, current || {});
    next[sanction] = 0;
    return next;
  }

  /** True when this alert was already sent at this count, so a second save of the same
   *  match does not notify twice. */
  function alreadyNotified(row, count) {
    return !!(row && row.notified_count != null && +row.notified_count >= +count);
  }

  window.cmSanctions = {
    types, accumulating, typeOf, ruleFor, countOf,
    evaluate, alerts, apply, reset, alreadyNotified,
  };
})();
