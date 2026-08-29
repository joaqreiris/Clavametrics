import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const load = rel => { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };

// The engine is a browser script; evaluate it the way a <script> tag would.
const boot = (sport) => {
  globalThis.window = { addEventListener() {}, document: { readyState: 'complete' } };
  globalThis.document = globalThis.window.document;
  globalThis.localStorage = {
    _d: sport ? { cm_sport: sport } : {},
    getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; },
  };
  if (sport) { load('assets/sport-packs.js'); load('assets/sport.js'); }
  load('lib/day-context.js');
};

describe('cmMdForDate · football window (MD−6 … MD+3)', () => {
  beforeEach(() => boot('football'));

  const MATCH = ['2026-09-13'];   // a Sunday

  it('labels the match day with the anchor', () => {
    expect(window.cmMdForDate('2026-09-13', MATCH).label).toBe('MD');
    expect(window.cmMdForDate('2026-09-13', MATCH).offset).toBe(0);
  });

  it('counts down to the match and up from it', () => {
    expect(window.cmMdForDate('2026-09-12', MATCH).label).toBe('MD-1');
    expect(window.cmMdForDate('2026-09-07', MATCH).label).toBe('MD-6');
    expect(window.cmMdForDate('2026-09-14', MATCH).label).toBe('MD+1');
    expect(window.cmMdForDate('2026-09-16', MATCH).label).toBe('MD+3');
  });

  it('goes quiet outside the window instead of inventing MD−14', () => {
    // Daily Planning used to print labels with no upper bound at all.
    expect(window.cmMdForDate('2026-09-06', MATCH).label).toBe('');
    expect(window.cmMdForDate('2026-09-17', MATCH).label).toBe('');
    expect(window.cmMdForDate('2026-08-30', MATCH).label).toBe('');
  });

  it('emits ASCII by default and the typographic minus on request', () => {
    expect(window.cmMdForDate('2026-09-12', MATCH).label).toBe('MD-1');
    expect(window.cmMdForDate('2026-09-12', MATCH, { display: true }).label).toBe('MD−1');
    // The plus sign is the same either way.
    expect(window.cmMdForDate('2026-09-14', MATCH, { display: true }).label).toBe('MD+1');
  });

  it('has no label when there is no match in range', () => {
    expect(window.cmMdForDate('2026-09-13', []).label).toBe('');
    expect(window.cmMdForDate('2026-09-13', null).label).toBe('');
  });
});

describe('cmMdForDate · the cup-week bug this engine exists to fix', () => {
  beforeEach(() => boot('football'));

  // Wednesday cup + Sunday league. The Calendar said MD+1 for Thursday, Daily Planning
  // and the Gym Planner said MD−3, for the same date.
  const WEEK = ['2026-09-09', '2026-09-13'];

  it('hangs each day off the NEAREST match, not off the microcycle match_date', () => {
    expect(window.cmMdForDate('2026-09-10', WEEK).label).toBe('MD+1');   // day after the cup
    expect(window.cmMdForDate('2026-09-12', WEEK).label).toBe('MD-1');   // day before the league game
    expect(window.cmMdForDate('2026-09-08', WEEK).label).toBe('MD-1');   // day before the cup
  });

  it('reports which match the label refers to', () => {
    expect(window.cmMdForDate('2026-09-10', WEEK).matchDate).toBe('2026-09-09');
    expect(window.cmMdForDate('2026-09-12', WEEK).matchDate).toBe('2026-09-13');
  });

  it('both match days keep the anchor', () => {
    expect(window.cmMdForDate('2026-09-09', WEEK).label).toBe('MD');
    expect(window.cmMdForDate('2026-09-13', WEEK).label).toBe('MD');
  });
});

describe('cmMdForDate · ties are flagged, not silently resolved', () => {
  beforeEach(() => boot('football'));

  const TUE_THU = ['2026-09-08', '2026-09-10'];   // Tuesday and Thursday

  it('marks the equidistant day as ambiguous', () => {
    const r = window.cmMdForDate('2026-09-09', TUE_THU);
    expect(r.ambiguous).toBe(true);
  });

  it('leans forward by default — planning looks at the next match', () => {
    expect(window.cmMdForDate('2026-09-09', TUE_THU).label).toBe('MD-1');
  });

  it('does not flag a day that is genuinely closer to one match', () => {
    expect(window.cmMdForDate('2026-09-12', ['2026-09-09', '2026-09-13']).ambiguous).toBe(false);
  });
});

describe('cmMdForDate · manual overrides', () => {
  beforeEach(() => boot('football'));

  it('an override beats everything, including a match day', () => {
    const opts = { overrides: { '2026-09-13': 'MD+2', '2026-09-11': 'OFF' } };
    expect(window.cmMdForDate('2026-09-13', ['2026-09-13'], opts).label).toBe('MD+2');
    expect(window.cmMdForDate('2026-09-13', ['2026-09-13'], opts).source).toBe('override');
    expect(window.cmMdForDate('2026-09-11', ['2026-09-13'], opts).label).toBe('OFF');
  });

  it('a date with no override falls through to the derived label', () => {
    const opts = { overrides: { '2026-09-11': 'OFF' } };
    expect(window.cmMdForDate('2026-09-12', ['2026-09-13'], opts).label).toBe('MD-1');
  });
});

describe('cmMdForDate · the window follows the sport', () => {
  it('basketball anchors on GD and reaches GD−3 … GD+2', () => {
    boot('basketball');
    expect(window.cmMdWindow()).toEqual({ anchor: 'GD', pre: 3, post: 2 });
    const games = ['2026-09-13'];
    expect(window.cmMdForDate('2026-09-13', games).label).toBe('GD');
    expect(window.cmMdForDate('2026-09-10', games).label).toBe('GD-3');
    expect(window.cmMdForDate('2026-09-15', games).label).toBe('GD+2');
    // Outside basketball's tighter window, where football would still label.
    expect(window.cmMdForDate('2026-09-09', games).label).toBe('');
    expect(window.cmMdForDate('2026-09-16', games).label).toBe('');
  });

  it('a three-game basketball week labels every gap off its nearest game', () => {
    boot('basketball');
    const games = ['2026-09-08', '2026-09-11', '2026-09-13'];
    expect(window.cmMdForDate('2026-09-09', games).label).toBe('GD+1');
    expect(window.cmMdForDate('2026-09-10', games).label).toBe('GD-1');
    expect(window.cmMdForDate('2026-09-12', games).label).toBe('GD-1');
  });

  it('falls back to football when no sport pack is loaded at all', () => {
    boot(null);   // pages that never load sport-packs.js must keep working
    expect(window.cmMdWindow()).toEqual({ anchor: 'MD', pre: 6, post: 3 });
    expect(window.cmMdForDate('2026-09-07', ['2026-09-13']).label).toBe('MD-6');
  });

  it('offers the picker the codes of the active sport', () => {
    boot('basketball');
    expect(window.cmMdOptions()).toEqual(['GD-3','GD-2','GD-1','GD','GD+1','GD+2']);
    boot('football');
    expect(window.cmMdOptions()).toContain('MD-6');
    expect(window.cmMdOptions()).toContain('MD+3');
  });
});

describe('cmMdNorm · unchanged canonical form', () => {
  beforeEach(() => boot('football'));

  it('collapses the three encodings that coexist in the app', () => {
    expect(window.cmMdNorm('MD−2')).toBe('MD-2');
    expect(window.cmMdNorm('MD0')).toBe('MD');
    expect(window.cmMdNorm('MD-0')).toBe('MD');
    expect(window.cmMdNorm(0)).toBe('MD');
    expect(window.cmMdNorm(-2)).toBe('MD-2');
    expect(window.cmMdNorm(1)).toBe('MD+1');
    expect(window.cmMdNorm('')).toBe('');
    expect(window.cmMdNorm(null)).toBe('');
  });
});

describe('cmMdRangeFor · how far to look for matches', () => {
  it('covers the whole football window around the date', () => {
    boot('football');
    expect(window.cmMdRangeFor('2026-09-13')).toEqual({ from: '2026-09-10', to: '2026-09-19' });
  });

  it('shrinks with the sport', () => {
    boot('basketball');
    expect(window.cmMdRangeFor('2026-09-13')).toEqual({ from: '2026-09-11', to: '2026-09-16' });
  });

  it('crosses a month boundary without drifting a day', () => {
    boot('football');
    // Local date maths — toISOString() would shift this east of Greenwich.
    expect(window.cmMdRangeFor('2026-03-01')).toEqual({ from: '2026-02-26', to: '2026-03-07' });
  });
});
