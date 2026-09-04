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
    _d: { cm_sport: sport }, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; },
  };
  load('assets/sport-packs.js');
  load('assets/sport.js');
  load('assets/sanctions.js');
  return window.cmSanctions;
}

describe('sanctions · what accumulates is the sport\'s call', () => {
  it('football counts yellows, and reds are served directly', () => {
    const S = boot('football');
    expect(S.accumulating().map(t => t.key)).toEqual(['yellow']);
    expect(S.typeOf('red').accumulates).toBe(false);
  });

  it('basketball counts technicals, never personal fouls', () => {
    // Personal fouls reset every single game: accumulating them across a season would be
    // counting something that does not exist.
    const S = boot('basketball');
    expect(S.accumulating().map(t => t.key)).toEqual(['technical']);
    expect(S.typeOf('yellow')).toBeNull();
  });

  it('hockey has three cards and only one of them accumulates', () => {
    const S = boot('hockey');
    expect(S.types().map(t => t.key)).toEqual(['green', 'yellow', 'red']);
    expect(S.accumulating().map(t => t.key)).toEqual(['yellow']);
  });

  it('a sport with no model claims no sanctions', () => {
    const S = boot('other');
    expect(S.types()).toEqual([]);
    expect(S.accumulating()).toEqual([]);
  });
});

describe('sanctions · the threshold belongs to the league, not the sport', () => {
  let S;
  beforeEach(() => { S = boot('football'); });

  it('uses the sport default when the league says nothing', () => {
    expect(S.ruleFor(null, 'yellow')).toEqual({ accumulates: true, threshold: 5, banGames: 1 });
  });

  it('the league overrides it — Cambodia suspends at three', () => {
    const cambodia = { rules: [{ sanction: 'yellow', accumulates: true, threshold: 3, ban_games: 1 }] };
    expect(S.ruleFor(cambodia, 'yellow').threshold).toBe(3);
  });

  it('reads a league row saved before `rules` existed', () => {
    const legacy = { yellow_threshold: 4, yellow_ban_games: 2, red_direct_games: 3 };
    expect(S.ruleFor(legacy, 'yellow')).toEqual({ accumulates: true, threshold: 4, banGames: 2 });
    expect(S.ruleFor(legacy, 'red').banGames).toBe(3);
  });

  it('an explicit rule beats the legacy column', () => {
    const both = { yellow_threshold: 5, rules: [{ sanction: 'yellow', threshold: 3 }] };
    expect(S.ruleFor(both, 'yellow').threshold).toBe(3);
  });

  it('a sanction this sport does not have has no rule at all', () => {
    expect(S.ruleFor({}, 'technical')).toBeNull();
  });
});

describe('sanctions · warning before the player is unavailable', () => {
  let S;
  const cambodia = { rules: [{ sanction: 'yellow', accumulates: true, threshold: 3, ban_games: 1 }] };
  beforeEach(() => { S = boot('football'); });

  it('says nothing while the player is far from it', () => {
    expect(S.evaluate(cambodia, 'yellow', 1).status).toBe('ok');
  });

  it('warns one away — the whole point is to know BEFORE, not after', () => {
    const ev = S.evaluate(cambodia, 'yellow', 2);
    expect(ev.status).toBe('approaching');
    expect(ev.remaining).toBe(1);
  });

  it('reports the ban once the threshold is met', () => {
    const ev = S.evaluate(cambodia, 'yellow', 3);
    expect(ev.status).toBe('reached');
    expect(ev.banGames).toBe(1);
    expect(ev.remaining).toBe(0);
  });

  it('stays reached past the threshold', () => {
    expect(S.evaluate(cambodia, 'yellow', 4).status).toBe('reached');
  });

  it('never fires for a sanction that does not accumulate', () => {
    expect(S.evaluate(cambodia, 'red', 9).status).toBe('ok');
  });
});

describe('sanctions · counting', () => {
  let S;
  beforeEach(() => { S = boot('football'); });

  it('reads the per-sanction counter', () => {
    expect(S.countOf({ counts: { yellow: 2 } }, 'yellow')).toBe(2);
  });

  it('falls back to the old single yellow_count column', () => {
    expect(S.countOf({ yellow_count: 3 }, 'yellow')).toBe(3);
    expect(S.countOf({ yellow_count: 3 }, 'red')).toBe(0);
  });

  it('adds a match onto the running total', () => {
    expect(S.apply({ yellow: 2 }, { yellow: 1 })).toEqual({ yellow: 3 });
    expect(S.apply({}, { yellow: 1, red: 1 })).toEqual({ yellow: 1, red: 1 });
  });

  it('ignores a match with nothing in it', () => {
    expect(S.apply({ yellow: 2 }, {})).toEqual({ yellow: 2 });
    expect(S.apply({ yellow: 2 }, { yellow: 0 })).toEqual({ yellow: 2 });
  });

  it('zeroes the counter once the ban is served', () => {
    expect(S.reset({ yellow: 3, red: 1 }, 'yellow')).toEqual({ yellow: 0, red: 1 });
  });

  it('does not notify twice for the same count', () => {
    expect(S.alreadyNotified({ notified_count: 3 }, 3)).toBe(true);
    expect(S.alreadyNotified({ notified_count: 3 }, 4)).toBe(false);
    expect(S.alreadyNotified(null, 3)).toBe(false);
  });
});

describe('sanctions · the squad alert list', () => {
  const cambodia = { rules: [{ sanction: 'yellow', accumulates: true, threshold: 3, ban_games: 1 }] };

  it('lists only who needs attention, suspended first', () => {
    const S = boot('football');
    const out = S.alerts(cambodia, [
      { player_id: 'a', name: 'Ana',  counts: { yellow: 1 } },   // quiet
      { player_id: 'b', name: 'Beto', counts: { yellow: 2 } },   // one away
      { player_id: 'c', name: 'Caro', counts: { yellow: 3 } },   // banned
      { player_id: 'd', name: 'Dani', counts: { yellow: 4 } },   // banned, more cards
    ]);
    expect(out.map(o => o.name)).toEqual(['Dani', 'Caro', 'Beto']);
    expect(out[0].status).toBe('reached');
    expect(out[2].status).toBe('approaching');
  });

  it('a basketball squad is judged on technicals', () => {
    const S = boot('basketball');
    const out = S.alerts({ rules: [{ sanction: 'technical', accumulates: true, threshold: 2, ban_games: 1 }] },
      [{ player_id: 'a', name: 'Ana', counts: { technical: 2, yellow: 9 } }]);
    expect(out.length).toBe(1);
    expect(out[0].sanction).toBe('technical');   // the nine yellows are not a thing here
  });

  it('says nothing for a sport with no sanction model', () => {
    const S = boot('other');
    expect(S.alerts({}, [{ player_id: 'a', name: 'Ana', counts: { yellow: 9 } }])).toEqual([]);
  });
});
