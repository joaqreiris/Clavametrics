import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The sport packs are plain data loaded via a <script> tag, so we evaluate the file the
// same way the browser does and inspect what it hangs off window.
const ROOT = path.resolve(__dirname, '../..');
const load = (rel) => {
  (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
};

let PACKS, SUPPORTED;

beforeAll(() => {
  globalThis.window = { addEventListener() {}, document: { readyState: 'complete' } };
  globalThis.document = globalThis.window.document;
  globalThis.document.documentElement = {
    _a: {},
    setAttribute(k, v) { this._a[k] = v; },
    getAttribute(k) { return this._a[k] ?? null; },
  };
  globalThis.localStorage = {
    _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; },
  };
  load('assets/sport-packs.js');
  load('assets/sport.js');
  load('assets/positions.js');
  PACKS = window.CM_SPORT_PACKS;
  SUPPORTED = window.CM_SPORT_SUPPORTED;
});

const withPositions = () => Object.entries(PACKS).filter(([, p]) => p.positions);

describe('sport packs · integrity', () => {
  it('every supported sport has a pack', () => {
    SUPPORTED.forEach(k => expect(PACKS[k], `missing pack: ${k}`).toBeTruthy());
  });

  it('every pack points at a surface the field system can draw', () => {
    // Mirrors the FIELDS registry in assets/field-system.js.
    const KNOWN = ['football', 'futsal', 'basketball', 'hockey', 'rugby', 'blank'];
    Object.entries(PACKS).forEach(([k, p]) =>
      expect(KNOWN, `${k}`).toContain(p.field.type));
  });

  it('aliases resolve to real codes', () => {
    withPositions().forEach(([k, p]) => {
      const codes = new Set(Object.keys(p.positions.cfg));
      Object.entries(p.positions.aliases).forEach(([a, target]) =>
        expect(codes.has(target), `${k}: alias "${a}" → "${target}"`).toBe(true));
    });
  });

  it('every code declares a known group and a known roll-up', () => {
    withPositions().forEach(([k, p]) => {
      const groups = new Set(p.positions.groups.map(g => g.key));
      const basics = new Set(p.positions.basics);
      Object.entries(p.positions.cfg).forEach(([code, v]) => {
        expect(groups.has(v.group), `${k}.${code}.group=${v.group}`).toBe(true);
        expect(basics.has(v.basic), `${k}.${code}.basic=${v.basic}`).toBe(true);
      });
    });
  });

  it('every roll-up is reachable and has a colour class', () => {
    withPositions().forEach(([k, p]) => {
      // An unreachable roll-up would render a filter pill that can never match anyone.
      const reachable = new Set(Object.values(p.positions.cfg).map(v => v.basic));
      p.positions.basics.forEach(b => {
        expect(reachable.has(b), `${k}: roll-up "${b}" unreachable`).toBe(true);
        expect(p.positions.cssByBasic[b], `${k}: roll-up "${b}" has no colour`).toBeTruthy();
      });
    });
  });

  it('selectable codes exist and are labelled, and labels are selectable', () => {
    withPositions().forEach(([k, p]) => {
      const codes = new Set(Object.keys(p.positions.cfg));
      p.positions.selectable.forEach(c => {
        expect(codes.has(c), `${k}: selectable "${c}" is not a code`).toBe(true);
        expect(p.positions.labels[c], `${k}: selectable "${c}" has no label`).toBeTruthy();
      });
      Object.keys(p.positions.labels).forEach(c =>
        expect(p.positions.selectable, `${k}: label "${c}"`).toContain(c));
    });
  });
});

describe('sport packs · i18n', () => {
  const locales = ['en', 'es', 'pt'].map(l => [
    l, JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', `${l}.json`), 'utf8')),
  ]);

  it('group and position keys are translated in every language', () => {
    const keys = new Set();
    Object.values(PACKS).forEach(p => {
      if (!p.positions) return;
      p.positions.groups.forEach(g => keys.add(g.i18n));
      Object.values(p.positions.labels).forEach(l => keys.add(l.i18n));
    });
    const missing = [];
    locales.forEach(([lang, dict]) =>
      keys.forEach(k => { if (k && !(k in dict)) missing.push(`${lang}: ${k}`); }));
    expect(missing).toEqual([]);
  });

  it('every sport name is translated', () => {
    const missing = [];
    locales.forEach(([lang, dict]) =>
      Object.values(PACKS).forEach(p => {
        if (typeof p.i18n === 'string' && !(p.i18n in dict)) missing.push(`${lang}: ${p.i18n}`);
      }));
    // Sport names live under sport.<key>; the per-pack `i18n` field is the override map.
    locales.forEach(([lang, dict]) =>
      Object.keys(PACKS).forEach(k => {
        if (!(`sport.${k}` in dict)) missing.push(`${lang}: sport.${k}`);
      }));
    expect(missing).toEqual([]);
  });

  it('i18n overrides point from a real key to a real key, in every language', () => {
    const problems = [];
    locales.forEach(([lang, dict]) =>
      Object.entries(PACKS).forEach(([sport, p]) =>
        Object.entries(p.i18n || {}).forEach(([from, to]) => {
          if (!(from in dict)) problems.push(`${lang}: ${sport} overrides unknown key ${from}`);
          if (!(to in dict))   problems.push(`${lang}: ${sport} points at missing key ${to}`);
        })));
    expect(problems).toEqual([]);
  });

  it('every vocab term has a word key, singular and plural', () => {
    const missing = [];
    locales.forEach(([lang, dict]) =>
      Object.entries(PACKS).forEach(([sport, p]) =>
        Object.values(p.vocab || {}).forEach(term => {
          if (!(`sport.word.${term}` in dict))        missing.push(`${lang}: ${sport} → sport.word.${term}`);
          if (!(`sport.word.${term}_plural` in dict)) missing.push(`${lang}: ${sport} → sport.word.${term}_plural`);
        })));
    expect(missing).toEqual([]);
  });
});

describe('sport packs · navigation', () => {
  // Mirrors the module keys in assets/sidebar.js NAV_GROUPS.
  const NAV_KEYS = new Set([
    'club-overview','annual-planner','chat-tasks','planner','sessions-lib','daily-planning',
    'tactical-planning','sessions-history','video-room','squad','lineup','availability',
    'match-reports','evaluations','wellness','rpe','load-monitor','load-planner','gps',
    'gym-planner','individual-sc','top-up','gym-library','clinical','injuries','treatments',
    'rehab','nutrition',
  ]);

  it('hides only modules that actually exist in the nav', () => {
    Object.entries(PACKS).forEach(([sport, p]) =>
      (p.nav.hidden || []).forEach(k =>
        expect(NAV_KEYS.has(k), `${sport} hides unknown module "${k}"`).toBe(true)));
  });

  it('swaps icons only on modules that exist', () => {
    Object.entries(PACKS).forEach(([sport, p]) =>
      Object.keys(p.nav.icons || {}).forEach(k =>
        expect(NAV_KEYS.has(k), `${sport} re-icons unknown module "${k}"`).toBe(true)));
  });

  it('football hides nothing — it is the baseline the app was written in', () => {
    expect(PACKS.football.nav.hidden).toEqual([]);
    expect(PACKS.football.i18n).toEqual({});
  });

  it('indoor sports hide the Top-Up calculator', () => {
    // Its whole model is % of Vmax with 19.8/25.2 km/h fallbacks — unreachable on a court.
    ['basketball', 'futsal'].forEach(k => {
      expect(PACKS[k].load.topUpEnabled).toBe(false);
      expect(PACKS[k].nav.hidden).toContain('top-up');
    });
    // …and every pack that hides it must actually have it disabled, and vice versa.
    Object.entries(PACKS).forEach(([sport, p]) =>
      expect(p.nav.hidden.includes('top-up'), `${sport}`).toBe(p.load.topUpEnabled === false));
  });

  it('a sport with no lineup or match model hides those modules', () => {
    expect(PACKS.other.lineup.enabled).toBe(false);
    expect(PACKS.other.nav.hidden).toEqual(expect.arrayContaining(['lineup', 'match-reports']));
  });
});

describe('CMSport.word · sport vocabulary', () => {
  const useSport = (key) => {
    localStorage.setItem('cm_sport', key);
    delete window.CMSport;
    document.documentElement._a = {};
    load('assets/sport.js');
  };

  it('falls back to English when no i18n runtime is present', () => {
    useSport('football');
    expect(window.CMSport.word('match')).toBe('Match');
    expect(window.CMSport.word('surface')).toBe('Pitch');
    expect(window.CMSport.word('score')).toBe('Goal');
  });

  it('basketball plays a game on a court for points', () => {
    useSport('basketball');
    expect(window.CMSport.word('match')).toBe('Game');
    expect(window.CMSport.word('surface')).toBe('Court');
    expect(window.CMSport.word('score')).toBe('Point');
  });

  it('pluralises', () => {
    useSport('basketball');
    expect(window.CMSport.word('match', { plural: true })).toBe('Games');
    useSport('football');
    expect(window.CMSport.word('match', { plural: true })).toBe('Matches');
  });

  it('returns nothing for a concept the pack does not name', () => {
    useSport('football');
    expect(window.CMSport.word('nonsense')).toBe('');
  });

  it('redirects i18n keys only where the pack says so', () => {
    useSport('basketball');
    expect(window.CMSport.i18nKey('shell.nav.match-reports')).toBe('shell.nav.game_reports');
    expect(window.CMSport.i18nKey('shell.nav.squad')).toBe('shell.nav.squad');
    useSport('football');
    expect(window.CMSport.i18nKey('shell.nav.match-reports')).toBe('shell.nav.match-reports');
  });
});

describe('positions · football parity', () => {
  // The exact roll-up Squad.html and assets/positions.js carried before the sport packs
  // existed. Football must not have shifted by a single code.
  const OLD = {
    GK:'GK', CB:'CB', LB:'FB', RB:'FB', FB:'FB', WB:'FB', LWB:'FB', RWB:'FB',
    DM:'MF', CDM:'MF', CM:'MF', MF:'MF', CAM:'MF', AM:'MF',
    LM:'WG', RM:'WG', WG:'WG', LW:'WG', RW:'WG',
    ST:'ST', CF:'ST', SS:'ST', '9':'ST',
    GOALKEEPER:'GK', DEFENDER:'CB', MIDFIELDER:'MF', WINGER:'WG', FORWARD:'ST',
  };

  it('rolls every football code up exactly as before', () => {
    Object.entries(OLD).forEach(([code, basic]) =>
      expect(window.cmPositionBasic(code), code).toBe(basic));
  });

  it('still normalises free text from imports', () => {
    expect(window.cmNormalizePosition('Lateral izquierdo')).toBe('LB');
    expect(window.cmNormalizePosition('arquero')).toBe('GK');
    expect(window.cmNormalizePosition('Enganche')).toBe('CAM');
    expect(window.cmNormalizePosition('tuba')).toBe(null);
  });
});

describe('positions · switching sport', () => {
  const useSport = (key) => {
    localStorage.setItem('cm_sport', key);
    delete window.CMSport; delete window.CM_POSITIONS;
    load('assets/sport.js'); load('assets/positions.js');
  };

  it('basketball speaks guards / wings / bigs', () => {
    useSport('basketball');
    expect(window.cmNormalizePosition('Base')).toBe('PG');
    expect(window.cmPositionBasic('ala-pivot')).toBe('B');
    expect(window.cmPositionGroup('5')).toBe('Bigs');
    expect(window.CM_POSITIONS.BASIC).toEqual(['G', 'W', 'B']);
  });

  it('rugby splits the pack from the backs', () => {
    useSport('rugby');
    expect(window.cmPositionGroup('Hooker')).toBe('Pack');
    expect(window.cmPositionGroup('apertura')).toBe('Backs');
    expect(window.cmNormalizePosition('9')).toBe('SH');
    expect(window.cmNormalizePosition('15')).toBe('FB');
  });

  it('an unmodelled sport keeps free-text positions instead of dropping them', () => {
    useSport('other');
    expect(window.CM_POSITIONS.HAS_POSITIONS).toBe(false);
    expect(window.cmPositionAt('Setter', 'detailed')).toBe('Setter');
    expect(window.cmPositionAt('Setter', 'basic')).toBe(null);
  });

  it('falls back to football for an unknown sport', () => {
    useSport('quidditch');
    expect(window.CMSport.key()).toBe('football');
    expect(window.cmPositionBasic('LB')).toBe('FB');
  });
});

describe('CMSport · surface is decided before the first frame', () => {
  const useSport = (key) => {
    localStorage.setItem('cm_sport', key);
    delete window.CMSport;
    document.documentElement._a = {};
    load('assets/sport.js');
  };

  // The drill board paints its ground from CSS, but the sport only arrives with the JS.
  // sport.js stamps <html> as it is parsed — before .pl-field even exists — so the first
  // paint is already right. Without it the page showed grass and swapped to parquet a
  // beat later, in front of the user.
  it('stamps the sport and its surface on <html> at load time', () => {
    useSport('basketball');
    expect(document.documentElement.getAttribute('data-sport')).toBe('basketball');
    expect(document.documentElement.getAttribute('data-surface')).toBe('wood');
  });

  it('grass sports stay on grass', () => {
    ['football', 'rugby', 'hockey'].forEach(k => {
      useSport(k);
      expect(document.documentElement.getAttribute('data-surface'), k).toBe('grass');
    });
  });

  it('futsal is played indoors on boards too', () => {
    useSport('futsal');
    expect(document.documentElement.getAttribute('data-surface')).toBe('wood');
  });

  it('an unknown sport falls back to football, and so does its surface', () => {
    useSport('quidditch');
    expect(document.documentElement.getAttribute('data-sport')).toBe('football');
    expect(document.documentElement.getAttribute('data-surface')).toBe('grass');
  });

  it('can be re-stamped for a drill saved on another pitch', () => {
    useSport('basketball');
    window.CMSport.stampSurface('football');
    expect(document.documentElement.getAttribute('data-surface')).toBe('grass');
    // …and the club's own sport is unchanged underneath.
    expect(window.CMSport.key()).toBe('basketball');
  });

  it('every pack declares a surface the stylesheet knows how to paint', () => {
    const KNOWN = ['grass', 'wood', 'neutral'];
    Object.entries(PACKS).forEach(([sport, p]) =>
      expect(KNOWN, `${sport}`).toContain(p.field.surface));
  });
});

describe('sport packs · drill board kit', () => {
  // Mirrors PL_OBJ_BTN in Planner.html: every key must map to a button that exists.
  const OBJECT_KEYS = new Set([
    'ball','cone','pole','barrier','goal','goalpost','mannequin',
    'hoop','chair','ladder','tackle_bag','ruck_pad',
  ]);

  it('every declared object has a button behind it', () => {
    Object.entries(PACKS).forEach(([sport, p]) =>
      (p.drills.objects || []).forEach(k =>
        expect(OBJECT_KEYS.has(k), `${sport} asks for unknown object "${k}"`).toBe(true)));
  });

  it('every object is translated in all three languages', () => {
    const locales = ['en', 'es', 'pt'].map(l =>
      [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', `${l}.json`), 'utf8'))]);
    const used = new Set();
    Object.values(PACKS).forEach(p => (p.drills.objects || []).forEach(k => used.add(k)));
    const missing = [];
    locales.forEach(([lang, dict]) => used.forEach(k => {
      if (!(`planner.obj_${k}` in dict)) missing.push(`${lang}: planner.obj_${k}`);
    }));
    expect(missing).toEqual([]);
  });

  it('the universal kit is in every sport', () => {
    // A cone and a ball are kit nobody trains without.
    Object.entries(PACKS).forEach(([sport, p]) =>
      ['ball', 'cone', 'pole', 'barrier'].forEach(k =>
        expect(p.drills.objects, `${sport}`).toContain(k)));
  });

  it('goals go to sports that have them, hoops to basketball', () => {
    expect(PACKS.basketball.drills.objects).toContain('hoop');
    expect(PACKS.basketball.drills.objects).not.toContain('goal');
    expect(PACKS.basketball.drills.objects).not.toContain('goalpost');
    expect(PACKS.football.drills.objects).toContain('goal');
    expect(PACKS.football.drills.objects).not.toContain('hoop');
    expect(PACKS.rugby.drills.objects).toEqual(expect.arrayContaining(['tackle_bag', 'ruck_pad']));
  });

  it('a sport with no goalkeeper is not offered goalkeeper kit', () => {
    Object.entries(PACKS).forEach(([sport, p]) => {
      if (p.roster.hasGoalkeeper) return;
      expect(p.drills.objects, `${sport}`).not.toContain('goalpost');
    });
  });

  it('small-sided formats are declared for every sport that plays them', () => {
    ['football', 'futsal', 'basketball', 'rugby', 'hockey'].forEach(k =>
      expect(PACKS[k].drills.gameTypes.length, k).toBeGreaterThan(0));
  });
});

describe('sport packs · lineup shapes', () => {
  const withLineup = () => Object.entries(PACKS).filter(([, p]) => p.lineup.enabled);

  it('every shape fields exactly as many players as the sport starts', () => {
    withLineup().forEach(([sport, p]) =>
      Object.entries(p.lineup.shapes).forEach(([name, spots]) =>
        expect(spots.length, `${sport} · ${name}`).toBe(p.lineup.slots)));
  });

  it('every spot sits on the pitch and names a real roll-up', () => {
    withLineup().forEach(([sport, p]) => {
      const basics = new Set(p.positions ? p.positions.basics : []);
      Object.entries(p.lineup.shapes).forEach(([name, spots]) =>
        spots.forEach((sp, i) => {
          expect(sp.x >= 0 && sp.x <= 100, `${sport}/${name}[${i}].x=${sp.x}`).toBe(true);
          expect(sp.y >= 0 && sp.y <= 100, `${sport}/${name}[${i}].y=${sp.y}`).toBe(true);
          expect(basics.has(sp.role), `${sport}/${name}[${i}].role=${sp.role}`).toBe(true);
        }));
    });
  });

  it('a sport with a goalkeeper puts exactly one in every shape', () => {
    withLineup().forEach(([sport, p]) => {
      if (!p.roster.hasGoalkeeper) return;
      Object.entries(p.lineup.shapes).forEach(([name, spots]) =>
        expect(spots.filter(s => s.role === 'GK').length, `${sport} · ${name}`).toBe(1));
    });
  });

  it('a sport without a goalkeeper has none anywhere', () => {
    withLineup().forEach(([sport, p]) => {
      if (p.roster.hasGoalkeeper) return;
      Object.values(p.lineup.shapes).forEach(spots =>
        expect(spots.some(s => s.role === 'GK'), sport).toBe(false));
    });
  });

  it('the shapes match the sport, not football', () => {
    expect(Object.keys(PACKS.basketball.lineup.shapes)).toEqual(['5-out', '4-out-1-in', '3-out-2-in']);
    expect(Object.keys(PACKS.futsal.lineup.shapes)).toEqual(['3-1', '2-2', '4-0']);
    // Rugby genuinely has one shape: the fifteen shirts are the positions.
    expect(Object.keys(PACKS.rugby.lineup.shapes)).toEqual(['XV']);
    expect(Object.keys(PACKS.football.lineup.shapes)).toContain('4-3-3');
  });

  it('every sport with a lineup offers at least one shape', () => {
    withLineup().forEach(([sport, p]) =>
      expect(Object.keys(p.lineup.shapes).length, sport).toBeGreaterThan(0));
  });

  it('no two spots land on top of each other', () => {
    withLineup().forEach(([sport, p]) =>
      Object.entries(p.lineup.shapes).forEach(([name, spots]) => {
        const seen = new Set(spots.map(s => `${s.x},${s.y}`));
        expect(seen.size, `${sport} · ${name} has overlapping spots`).toBe(spots.length);
      }));
  });
});

describe('sport packs · body measurements', () => {
  it('names a dominant side the player form can label', () => {
    Object.entries(PACKS).forEach(([sport, p]) =>
      expect(['foot', 'hand'], sport).toContain(p.anthro.dominantSide));
  });

  it('stick and ball-in-hand sports ask for the hand, not the foot', () => {
    ['basketball', 'hockey'].forEach(k => expect(PACKS[k].anthro.dominantSide, k).toBe('hand'));
    ['football', 'futsal', 'rugby'].forEach(k => expect(PACKS[k].anthro.dominantSide, k).toBe('foot'));
  });

  it('extra measurements map to real player columns', () => {
    // Mirrors the columns added to players in db/schema.sql.
    const COLUMNS = new Set(['wingspan', 'standing_reach']);
    Object.entries(PACKS).forEach(([sport, p]) =>
      (p.anthro.extra || []).forEach(k =>
        expect(COLUMNS.has(k), `${sport} asks for unknown measurement "${k}"`).toBe(true)));
  });

  it('every extra measurement is labelled in all three languages', () => {
    const locales = ['en', 'es', 'pt'].map(l =>
      [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', `${l}.json`), 'utf8'))]);
    const used = new Set();
    Object.values(PACKS).forEach(p => (p.anthro.extra || []).forEach(k => used.add(k)));
    const missing = [];
    locales.forEach(([lang, dict]) => used.forEach(k => {
      if (!(`squad.${k}` in dict)) missing.push(`${lang}: squad.${k}`);
    }));
    expect(missing).toEqual([]);
  });

  it('a sport that recruits on reach asks for it', () => {
    // Basketball scouts wingspan and standing reach; football has no use for either.
    expect(PACKS.basketball.anthro.extra).toEqual(['wingspan', 'standing_reach']);
    expect(PACKS.football.anthro.extra).toEqual([]);
  });
});

describe('sport packs · Training:Match bands', () => {
  it('football carries the published ranges', () => {
    const b = PACKS.football.load.epBands;
    expect(b).toBeTruthy();
    // You can run three matches' worth of distance in a week; three matches' worth of
    // sprints is what tears hamstrings. The bands are not one number for everything.
    expect(b.total_distance).toEqual([2.5, 3.5]);
    expect(b.sprint_distance).toEqual([1.5, 2.5]);
    expect(b.sprint_distance[1]).toBeLessThan(b.total_distance[1]);
  });

  it('no other sport gets football ranges by default', () => {
    ['futsal', 'basketball', 'rugby', 'hockey', 'other'].forEach(k =>
      expect(PACKS[k].load.epBands, k).toBeNull());
  });

  it('every band is a sane [low, high] pair on an accumulating metric', () => {
    const bands = PACKS.football.load.epBands;
    Object.entries(bands).forEach(([key, band]) => {
      expect(Array.isArray(band), key).toBe(true);
      expect(band.length, key).toBe(2);
      expect(band[0], key).toBeGreaterThan(0);
      expect(band[1], `${key} high must exceed low`).toBeGreaterThan(band[0]);
      // A ratio only means something on something you accumulate.
      expect(['max_speed', 'avg_speed', 'distance_per_minute'], key).not.toContain(key);
    });
  });
});

describe('sport packs · endurance reference bands', () => {
  it('football carries the published norms', () => {
    const b = PACKS.football.testBands;
    expect(b).toBeTruthy();
    expect(Object.keys(b)).toEqual(['ift', 'yoyo1', 'yoyo2', 'cooper']);
    expect(b.yoyo1.bands[0]).toEqual(['elite', 2400, Infinity]);
  });

  it('no other sport inherits them', () => {
    // The Yo-Yo IR1 was built on footballers. Judging a centre against "elite ≥ 2400 m"
    // would put every one of them in the red for no reason at all.
    ['futsal', 'basketball', 'rugby', 'hockey', 'other'].forEach(k =>
      expect(PACKS[k].testBands, k).toBeNull());
  });

  it('bands are ordered, contiguous and cover the whole range', () => {
    Object.entries(PACKS.football.testBands).forEach(([key, spec]) => {
      expect(spec.unit, key).toBeTruthy();
      const bands = spec.bands;
      expect(bands.map(b => b[0]), key).toEqual(['elite', 'advanced', 'intermediate', 'developing']);
      // Top band is open-ended, bottom starts at zero, and each one hands over to the next.
      expect(bands[0][2], key).toBe(Infinity);
      expect(bands[bands.length - 1][1], key).toBe(0);
      for (let i = 0; i < bands.length - 1; i++) {
        expect(bands[i][1], `${key} band ${i}`).toBe(bands[i + 1][2]);
      }
    });
  });

  it('null means "this sport has no norms", not "not configured yet"', () => {
    // CMSport.at() collapses null onto its fallback, so evaluations.js reads pack()
    // directly. If that ever changes, basketball silently gets football's bands back.
    expect('testBands' in PACKS.basketball).toBe(true);
    expect(PACKS.basketball.testBands).toBeNull();
  });
});

describe('sport packs · area-per-player bands', () => {
  const bands = k => PACKS[k].drills.m2Bands;

  it('full-size fields keep the football scale', () => {
    // Football 105×68, rugby 100×70, hockey 91×55 — the same order of magnitude, so all
    // four bands are reachable.
    ['football', 'rugby', 'hockey'].forEach(k =>
      expect(bands(k), k).toEqual([40, 80, 160]));
  });

  it('court sports get none', () => {
    // Basketball 28×15 and futsal 40×20: every session lands in the bottom two bands, and
    // the relationship inverts (less space = MORE intensity), so the axis measures
    // something else. No label beats a confident wrong one.
    ['futsal', 'basketball', 'other'].forEach(k =>
      expect(bands(k), k).toBeNull());
  });

  it('bands are three ascending cuts', () => {
    ['football', 'rugby', 'hockey'].forEach(k => {
      const b = bands(k);
      expect(b.length, k).toBe(3);
      expect(b[0], k).toBeLessThan(b[1]);
      expect(b[1], k).toBeLessThan(b[2]);
    });
  });

  it('a real basketball session would fall in the bottom band, which is the point', () => {
    // 5v5 on a full court: 28 × 15 ÷ 10 = 42 m²/player → "strength" on the football scale.
    // A full-court five-a-side is not strength work.
    const m2 = Math.round((28 * 15) / 10);
    expect(m2).toBe(42);
    expect(bands('basketball')).toBeNull();   // …so no label is offered at all
  });
});
