/* =============================================================
   sanctions-sync.js — keeps the accumulated-sanction counters up to date and warns.

   Sits between "a match was saved" and "someone needs to know". The RULES are in
   assets/sanctions.js (pure, testable); this file is the plumbing: read the league, add
   the match, write the counter, notify the staff.

   TWO THINGS IT IS CAREFUL ABOUT

   1. Re-importing the same match must not double-count. Player stats are upserted, so a
      corrected import overwrites the row rather than adding to it — the counter is
      therefore RECOMPUTED from every match of the competition, never incremented blind.

   2. It must not cry wolf. A player who is one card away stays one card away every time
      anyone opens the screen; the alert fires once per count, tracked in
      card_accumulations.notified_count.

   Usage, after writing player_match_stats:
     await window.cmSanctionsSync.afterMatchSaved({ clubId, teamId, matchId });
   ============================================================= */
(function () {
  'use strict';
  if (window.cmSanctionsSync) return;   // idempotent

  const sb = () => window.sb;
  function tt(key, fb, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fb != null ? fb : key);
  }

  /** The competition rules in force for a club. Falls back to null, which makes the rules
   *  engine use the sport's own defaults. */
  async function leagueFor(clubId, leagueId) {
    try {
      let q = sb().from('league_configs')
        .select('id,name,rules,yellow_threshold,yellow_ban_games,red_direct_games,red_serious_games,reset_date,active')
        .eq('club_id', clubId);
      q = leagueId ? q.eq('id', leagueId) : q.eq('active', true);
      const { data } = await q.limit(1);
      return (data && data[0]) || null;
    } catch (_e) { return null; }
  }

  /** How many of each sanction a player has picked up in this competition.
   *
   *  Recomputed from the match rows rather than incremented, so re-importing a match with
   *  a correction lands on the right number instead of adding a second time.
   *
   *  Only the sanctions the SPORT accumulates are counted, and only from matches on or
   *  after the league's reset date. */
  async function recount(clubId, league) {
    const S = window.cmSanctions;
    const acc = S ? S.accumulating() : [];
    if (!acc.length) return {};

    let rows = [];
    try {
      let q = sb().from('player_match_stats')
        .select('player_id, yellow_cards, red_cards, extra, match:match_results!inner(match_date, competition)')
        .eq('club_id', clubId);
      const { data } = await q;
      rows = data || [];
    } catch (_e) { return {}; }

    const from = league && league.reset_date ? league.reset_date : null;
    const out = {};   // player_id → { sanction: n }
    rows.forEach(r => {
      const date = r.match && r.match.match_date;
      if (from && date && date < from) return;   // before the counter was reset
      const per = (out[r.player_id] = out[r.player_id] || {});
      // Where each sanction lives on the row is the sport's business: football keeps
      // yellows in a column, basketball keeps technicals in `extra`. cmMatchStats knows.
      const counts = window.cmMatchStats
        ? window.cmMatchStats.sanctionCounts(r)
        : { yellow: +r.yellow_cards || 0, red: +r.red_cards || 0 };
      acc.forEach(t => {
        const n = +counts[t.key] || 0;
        if (n) per[t.key] = (per[t.key] || 0) + n;
      });
    });
    return out;
  }

  /** Write the counters and return the rows as they now stand, with what was already
   *  notified, so the caller can tell a new alert from a repeat. */
  async function persist(clubId, league, byPlayer) {
    const leagueId = league ? league.id : null;
    let existing = [];
    try {
      const { data } = await sb().from('card_accumulations')
        .select('player_id, counts, yellow_count, notified_count')
        .eq('club_id', clubId)
        .eq('league_config_id', leagueId);
      existing = data || [];
    } catch (_e) {}
    const prev = Object.fromEntries(existing.map(r => [r.player_id, r]));

    const payload = Object.entries(byPlayer).map(([player_id, counts]) => ({
      club_id: clubId,
      league_config_id: leagueId,
      player_id,
      counts,
      // Keep the legacy single counter in step: other code may still read it.
      yellow_count: +counts.yellow || 0,
      updated_at: new Date().toISOString(),
    }));
    if (payload.length) {
      try {
        await sb().from('card_accumulations')
          .upsert(payload, { onConflict: 'club_id,player_id,league_config_id' });
      } catch (e) { console.warn('[sanctions] upsert failed:', e.message || e); }
    }
    return Object.entries(byPlayer).map(([player_id, counts]) => ({
      player_id, counts, notified_count: prev[player_id] ? prev[player_id].notified_count : null,
    }));
  }

  /** Notify coaching staff about players who just crossed a line. */
  async function notify(clubId, league, rows, playerNames) {
    const S = window.cmSanctions;
    if (!S) return [];
    const alerts = S.alerts(league, rows.map(r => ({
      player_id: r.player_id, name: playerNames[r.player_id] || '—', counts: r.counts,
    })));
    // Skip anyone already told at this exact count: a player one card away stays one card
    // away, and nobody needs that in their bell on every save.
    const byPlayer = Object.fromEntries(rows.map(r => [r.player_id, r]));
    const fresh = alerts.filter(a => !S.alreadyNotified(byPlayer[a.player_id], a.count));
    if (!fresh.length) return [];

    let staff = [];
    try {
      staff = await window.cmStaffByBuckets(clubId, ['admin', 'coach', 'direction']);
    } catch (_e) { return fresh; }
    if (!staff.length) return fresh;

    const label = k => {
      const t = S.typeOf(k);
      return t ? tt(t.i18n, k) : k;
    };
    const notifications = [];
    fresh.forEach(a => {
      const title = a.status === 'reached'
        ? tt('sanctions.notif_suspended', '{player} misses {n} match(es)', { player: a.name, n: a.banGames })
        : tt('sanctions.notif_one_away', '{player} is one {sanction} from a suspension',
             { player: a.name, sanction: label(a.sanction) });
      const body = tt('sanctions.notif_body', '{count} of {threshold} {sanction} in {league}',
        { count: a.count, threshold: a.threshold, sanction: label(a.sanction),
          league: (league && league.name) || tt('sanctions.this_competition', 'this competition') });
      staff.forEach(s => notifications.push({
        user_id: s.id, club_id: clubId, type: 'sanction_accumulation',
        title, body, link: '/Match Reports.html',
      }));
    });
    try {
      const { error } = await sb().from('notifications').insert(notifications);
      if (error) console.warn('[sanctions] notify failed:', error.message);
    } catch (e) { console.warn('[sanctions] notify failed:', e.message || e); }

    // Remember what we said, so the same count never fires twice.
    try {
      await Promise.all(fresh.map(a => sb().from('card_accumulations')
        .update({ notified_at: new Date().toISOString(), notified_count: a.count })
        .eq('club_id', clubId).eq('player_id', a.player_id)
        .eq('league_config_id', league ? league.id : null)));
    } catch (_e) {}
    return fresh;
  }

  /**
   * Recount, store and warn. Safe to call after any save; never throws.
   * @returns {Array} the alerts raised this time (empty when there is nothing new)
   */
  async function afterMatchSaved({ clubId, leagueId, playerNames } = {}) {
    try {
      if (!clubId || !window.cmSanctions) return [];
      if (!window.cmSanctions.accumulating().length) return [];   // sport counts nothing
      const league   = await leagueFor(clubId, leagueId);
      const byPlayer = await recount(clubId, league);
      if (!Object.keys(byPlayer).length) return [];
      const rows = await persist(clubId, league, byPlayer);
      return await notify(clubId, league, rows, playerNames || {});
    } catch (e) {
      console.warn('[sanctions] sync failed:', e.message || e);
      return [];
    }
  }

  /** Current standing for the squad, for a screen that wants to show it. */
  async function standings(clubId, leagueId) {
    try {
      const league = await leagueFor(clubId, leagueId);
      const { data } = await sb().from('card_accumulations')
        .select('player_id, counts, yellow_count')
        .eq('club_id', clubId)
        .eq('league_config_id', league ? league.id : null);
      return { league, rows: data || [] };
    } catch (_e) { return { league: null, rows: [] }; }
  }

  window.cmSanctionsSync = { afterMatchSaved, standings, leagueFor, recount };
})();
