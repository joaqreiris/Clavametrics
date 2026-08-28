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
      keys.add(p.i18n);
      if (!p.positions) return;
      p.positions.groups.forEach(g => keys.add(g.i18n));
      Object.values(p.positions.labels).forEach(l => keys.add(l.i18n));
    });
    const missing = [];
    locales.forEach(([lang, dict]) =>
      keys.forEach(k => { if (k && !(k in dict)) missing.push(`${lang}: ${k}`); }));
    expect(missing).toEqual([]);
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
