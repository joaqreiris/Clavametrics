import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const load = rel => { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };

function boot(sport) {
  globalThis.window = { addEventListener() {} };
  globalThis.document = { readyState: 'complete', addEventListener() {},
                          documentElement: { setAttribute() {}, getAttribute() {} },
                          querySelectorAll: () => [] };
  globalThis.localStorage = {
    _d: sport ? { cm_sport: sport } : {},
    getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; },
  };
  if (sport) { load('assets/sport-packs.js'); load('assets/sport.js'); }
  load('assets/match-stats.js');
  return window.cmMatchStats;
}

describe('match stats · football does not move', () => {
  let M;
  beforeEach(() => { M = boot('football'); });

  it('keeps all six values in real columns, never in extra', () => {
    const row = M.toRow({ minutes: 90, goals: 2, assists: 1, yellow_cards: 1, red_cards: 0, rating: 7.5 });
    expect(row.minutes).toBe(90);
    expect(row.goals).toBe(2);
    expect(row.assists).toBe(1);
    expect(row.yellow_cards).toBe(1);
    expect(row.rating).toBe(7.5);
    expect(row.extra).toEqual({});   // the Dossier and Match Reports read the columns
  });

  it('reads a row the old importer wrote', () => {
    expect(M.get({ goals: 3 }, 'goals')).toBe(3);
    expect(M.read({ minutes: 90, goals: 1 }).goals).toBe(1);
  });

  it('keeps decimals only where the sport asks for them', () => {
    const row = M.toRow({ rating: '7.4', goals: '2' });
    expect(row.rating).toBe(7.4);
    expect(row.goals).toBe(2);
  });
});

describe('match stats · a basketball box score', () => {
  let M;
  beforeEach(() => { M = boot('basketball'); });

  it('records what basketball actually records', () => {
    const keys = M.fields().map(f => f.key);
    expect(keys).toEqual(expect.arrayContaining(
      ['points', 'rebounds_off', 'rebounds_def', 'steals', 'blocks', 'turnovers', 'fouls']));
    expect(keys).not.toContain('goals');
  });

  it('puts points in extra, not in the goals column', () => {
    // The Dossier sums `goals` as goals scored; a player with 400 of them would be absurd.
    const row = M.toRow({ minutes: 32, points: 18, rebounds_def: 7, assists: 4 });
    expect(row.goals).toBeUndefined();
    expect(row.extra.points).toBe(18);
    expect(row.extra.rebounds_def).toBe(7);
    // …while minutes and assists still use the columns they always had.
    expect(row.minutes).toBe(32);
    expect(row.assists).toBe(4);
  });

  it('reads them back out of extra', () => {
    const row = { minutes: 32, assists: 4, extra: { points: 18, steals: 2 } };
    expect(M.get(row, 'points')).toBe(18);
    expect(M.get(row, 'assists')).toBe(4);
    expect(M.read(row).steals).toBe(2);
  });

  it('handles a signed plus/minus', () => {
    expect(M.toRow({ plus_minus: '-7' }).extra.plus_minus).toBe(-7);
    expect(M.toRow({ plus_minus: '12' }).extra.plus_minus).toBe(12);
  });

  it('does not wipe extra keys it does not own', () => {
    // An import can map spare columns into extra; editing one stat must not delete them.
    const base = { extra: { custom_thing: 'keep me', points: 10 } };
    const row = M.toRow({ points: 12 }, base);
    expect(row.extra.points).toBe(12);
    expect(row.extra.custom_thing).toBe('keep me');
  });

  it('clears a stat that is emptied', () => {
    const base = { extra: { points: 10 } };
    expect(M.toRow({ points: '' }, base).extra.points).toBeUndefined();
  });
});

describe('match stats · sanctions come off the sport, not off column names', () => {
  it('football reads the yellow card column', () => {
    const M = boot('football');
    expect(M.sanctionCounts({ yellow_cards: 2, red_cards: 1 })).toEqual({ yellow: 2, red: 1 });
  });

  it('basketball reads technicals out of extra', () => {
    const M = boot('basketball');
    // Fouls are NOT a sanction that accumulates — only technicals are declared as one.
    expect(M.sanctionCounts({ extra: { technical: 1, fouls: 4 } })).toEqual({ technical: 1 });
  });

  it('hockey counts its three cards', () => {
    const M = boot('hockey');
    const counts = M.sanctionCounts({ yellow_cards: 1, red_cards: 0, extra: { green_cards: 2 } });
    expect(counts).toEqual({ yellow: 1, green: 2 });
  });

  it('a clean match reports nothing', () => {
    const M = boot('football');
    expect(M.sanctionCounts({ yellow_cards: 0, red_cards: 0 })).toEqual({});
  });
});

describe('match stats · no pack on the page', () => {
  it('falls back to the six football columns', () => {
    const M = boot(null);
    expect(M.fields().map(f => f.key)).toEqual(
      ['minutes', 'goals', 'assists', 'yellow_cards', 'red_cards', 'rating']);
  });
});
