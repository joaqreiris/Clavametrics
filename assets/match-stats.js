/* =============================================================
   match-stats.js — a player's line in the box score, per sport.

   player_match_stats has six football columns (minutes, goals, assists, yellow_cards,
   red_cards, rating) plus an `extra` jsonb that was already there and unused. A basketball
   line needs seventeen fields; a rugby line needs tries and tackles. Rather than adding a
   column per sport forever, the sport pack declares its box score and this file maps it
   onto the row: a field with `column` goes to that column, everything else to `extra`.

   Football's six ARE the columns, so nothing about football moves — that matters, because
   the Dossier and Match Reports read goals and assists straight off the row.

   Points deliberately do NOT reuse `goals`: the Dossier sums that column as goals scored,
   and a basketball player with 400 "goals" would be nonsense.
   ============================================================= */
(function () {
  'use strict';
  if (window.cmMatchStats) return;   // idempotent

  function tt(key, fb, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fb != null ? fb : key);
  }

  // The six football columns, used when no pack is loaded on the page.
  const FALLBACK = [
    { key: 'minutes',      i18n: 'stat.minutes',      column: 'minutes' },
    { key: 'goals',        i18n: 'stat.goals',        column: 'goals' },
    { key: 'assists',      i18n: 'stat.assists',      column: 'assists' },
    { key: 'yellow_cards', i18n: 'stat.yellow_cards', column: 'yellow_cards', sanction: 'yellow' },
    { key: 'red_cards',    i18n: 'stat.red_cards',    column: 'red_cards',    sanction: 'red' },
    { key: 'rating',       i18n: 'stat.rating',       column: 'rating', decimals: 1 },
  ];

  /** The box score of the active sport. Never empty. */
  function fields() {
    try {
      const f = window.CMSport && window.CMSport.at('match.playerStats', null);
      return (Array.isArray(f) && f.length) ? f : FALLBACK;
    } catch (_e) { return FALLBACK; }
  }

  function field(key) { return fields().find(f => f.key === key) || null; }

  /** Translated name of one stat. */
  function label(key) {
    const f = field(key);
    return f ? tt(f.i18n, key) : key;
  }

  /** Read one stat off a player_match_stats row, wherever it lives. */
  function get(row, key) {
    if (!row) return null;
    const f = field(key);
    if (!f) return null;
    if (f.column) return row[f.column];
    const extra = row.extra && typeof row.extra === 'object' ? row.extra : null;
    return extra ? extra[key] : null;
  }

  /** Every stat of the sport, read off a row: { key: value }. */
  function read(row) {
    const out = {};
    fields().forEach(f => { out[f.key] = get(row, f.key); });
    return out;
  }

  /**
   * Turn { key: value } into a row ready to upsert. Columns go to columns, the rest into
   * `extra` — and `extra` keeps anything already there that this sport does not name, so
   * an import that mapped extra columns of its own is not wiped by an edit.
   */
  function toRow(values, base) {
    const row = Object.assign({}, base || {});
    const extra = Object.assign({}, (base && base.extra) || {});
    fields().forEach(f => {
      if (!(f.key in (values || {}))) return;
      let v = values[f.key];
      if (v === '' || v == null) v = null;
      else if (f.decimals) v = parseFloat(v);
      else if (f.signed || /^-/.test(String(v))) v = parseInt(v, 10);
      else v = parseInt(v, 10);
      if (typeof v === 'number' && isNaN(v)) v = null;
      if (f.column) row[f.column] = v;
      else if (v == null) delete extra[f.key];
      else extra[f.key] = v;
    });
    row.extra = extra;
    return row;
  }

  /** What a player picked up in THIS match, keyed by sanction, for the accumulation
   *  engine. Reads the sport's own mapping instead of assuming yellow_cards/red_cards. */
  function sanctionCounts(row) {
    const out = {};
    fields().forEach(f => {
      if (!f.sanction) return;
      const n = +get(row, f.key) || 0;
      if (n) out[f.sanction] = (out[f.sanction] || 0) + n;
    });
    return out;
  }

  /** The stats worth showing as a compact table: everything except the ones a screen
   *  already renders on its own (minutes and rating usually sit in their own columns). */
  function tableFields(exclude) {
    const skip = new Set(exclude || []);
    return fields().filter(f => !skip.has(f.key));
  }

  window.cmMatchStats = { fields, field, label, get, read, toRow, sanctionCounts, tableFields };
})();
