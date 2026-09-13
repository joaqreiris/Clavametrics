import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// Both modules are browser scripts; evaluate them the way a <script> tag would
// and read what they hang off window.
globalThis.window = globalThis.window || {};
const load = rel => { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };
load('lib/exercise-taxonomy.js');
load('lib/exercise-filter.js');
const TAX = globalThis.window.CMTaxonomy;
const EF = globalThis.window.CMExerciseFilter;

// A small library standing in for the real one: a few fully tagged exercises,
// one tagged only on the legacy scalar columns, one tagged on nothing.
const LIB = [
  {
    id: 'copen', name: 'Adductor: Copenhagen plank', description: 'Side plank on the bench',
    purposes: ['activation', 'prevention'], muscle_groups: ['adductors'],
    equipment_tags: ['bench'], movement_patterns: ['anti_lateral_flexion'],
    contraction_types: ['iso_hold'], planes: ['frontal'], complexity: 'Low',
  },
  {
    id: 'rdl', name: 'Romanian Deadlift', description: 'Hip hinge with a barbell',
    purposes: ['strength'], muscle_groups: ['hamstrings', 'glutes'],
    equipment_tags: ['barbell'], movement_patterns: ['hinge'],
    myofascial_chains: ['superficial_back_line'], planes: ['sagittal'], complexity: 'Medium',
  },
  {
    id: 'roll', name: 'Hamstring foam roll', description: '',
    purposes: ['release'], muscle_groups: ['hamstrings'],
    equipment_tags: ['foam_roller'], myofascial_chains: ['superficial_back_line'],
    complexity: 'Low',
  },
  {
    id: 'band', name: 'ADD+QUAD KICKS WITH BAND', description: '',
    purposes: ['activation'], muscle_groups: ['adductors', 'quadriceps'],
    equipment_tags: ['band', 'mini_band'], complexity: 'Low',
  },
  // Legacy-only: pre-taxonomy row, scalar columns and no arrays.
  {
    id: 'legacy', name: 'Old Back Squat', description: '',
    primary_purpose: 'strength', muscle_group: 'quadriceps', complexity: 'High',
  },
  // Tagged on nothing at all.
  { id: 'bare', name: 'Mystery drill', description: '' },
];

const ids = list => list.map(e => e.id).sort();

describe('tagsOf', () => {
  it('reads the array column', () => {
    expect(EF.tagsOf(LIB[1], 'muscle_group')).toEqual(['hamstrings', 'glutes']);
  });

  it('falls back to the legacy scalar when the array is empty', () => {
    const legacy = LIB.find(e => e.id === 'legacy');
    expect(EF.tagsOf(legacy, 'muscle_group')).toEqual(['quadriceps']);
    expect(EF.tagsOf(legacy, 'purpose')).toEqual(['strength']);
  });

  it('returns nothing for an untagged exercise', () => {
    expect(EF.tagsOf(LIB.find(e => e.id === 'bare'), 'purpose')).toEqual([]);
  });

  it('reads complexity as a scalar dimension', () => {
    expect(EF.tagsOf(LIB[0], 'complexity')).toEqual(['Low']);
  });
});

describe('parseQuery', () => {
  it('resolves a Spanish alias to its canonical token', () => {
    const { terms } = EF.parseQuery('isquios');
    expect(terms).toHaveLength(1);
    expect(terms[0].tags).toContainEqual({ key: 'muscle_group', token: 'hamstrings' });
  });

  it('resolves a Portuguese alias', () => {
    const { terms } = EF.parseQuery('aquecimento');
    expect(terms[0].tags).toContainEqual({ key: 'purpose', token: 'rise_temperature' });
  });

  it('keeps a multi-word alias as one term', () => {
    const { terms } = EF.parseQuery('cadena posterior');
    expect(terms).toHaveLength(1);
    expect(terms[0].text).toBe('cadena posterior');
    expect(terms[0].tags).toContainEqual({ key: 'myofascial_chain', token: 'superficial_back_line' });
  });

  it('splits several tag terms', () => {
    const { terms } = EF.parseQuery('banda aductores activacion');
    expect(terms).toHaveLength(3);
    expect(terms.every(t => t.tags.length > 0)).toBe(true);
  });

  it('leaves unknown words as plain text terms', () => {
    const { terms } = EF.parseQuery('copenhague');
    expect(terms[0].tags).toEqual([]);
  });

  it('treats a quoted phrase as literal text', () => {
    const { terms } = EF.parseQuery('"foam roll"');
    expect(terms[0].literal).toBe(true);
    expect(terms[0].text).toBe('foam roll');
  });

  it('resolves a term that lands on more than one dimension', () => {
    // "hinge" is a movement pattern; "peso muerto" is one of its aliases.
    const { terms } = EF.parseQuery('peso muerto');
    expect(terms[0].tags).toContainEqual({ key: 'movement_pattern', token: 'hinge' });
  });
});

describe('filter — free-text search', () => {
  it('finds by name when the word is not a tag', () => {
    expect(ids(EF.filter(LIB, { search: 'copenhagen' }))).toEqual(['copen']);
  });

  it('finds by tag when the word is not in the name', () => {
    // Nothing is called "isquios"; two exercises are tagged hamstrings.
    expect(ids(EF.filter(LIB, { search: 'isquios' }))).toEqual(['rdl', 'roll']);
  });

  it('is accent and case insensitive', () => {
    expect(ids(EF.filter(LIB, { search: 'ACTIVACIÓN' }))).toEqual(['band', 'copen']);
  });

  it('ANDs several terms', () => {
    expect(ids(EF.filter(LIB, { search: 'aductores activacion' }))).toEqual(['band', 'copen']);
    expect(ids(EF.filter(LIB, { search: 'aductores banda' }))).toEqual(['band']);
  });

  it('matches a term by name OR by tag, not only by tag', () => {
    // "band" is an equipment token AND appears in another exercise's name.
    expect(ids(EF.filter(LIB, { search: 'band' }))).toEqual(['band']);
  });

  it('searches the description too', () => {
    expect(ids(EF.filter(LIB, { search: '"on the bench"' }))).toEqual(['copen']);
  });

  it('matches a half-typed tag by prefix, so the list never empties mid-word', () => {
    // "cadena" is no alias on its own; it prefixes "cadena posterior".
    expect(ids(EF.filter(LIB, { search: 'cadena' }))).toEqual(['rdl', 'roll']);
    // "aduc" prefixes "aductores".
    expect(ids(EF.filter(LIB, { search: 'aduc' }))).toEqual(['band', 'copen']);
  });

  it('only prefixes from the start of a tag name', () => {
    // "posterior" is the second word of the alias "cadena posterior"; matching
    // mid-phrase would also make "glute activation" answer to "glu".
    expect(EF.filter(LIB, { search: 'posterior' })).toHaveLength(0);
  });

  it('ignores tag prefixes under three characters', () => {
    // "is" prefixes several isometric tokens but appears in no name; a
    // two-letter fragment must not pull them in. Three letters may.
    expect(EF.filter(LIB, { search: 'is' })).toHaveLength(0);
    expect(ids(EF.filter(LIB, { search: 'iso' }))).toEqual(['copen']);
  });

  it('a quoted fragment stays literal and does not prefix-match tags', () => {
    expect(EF.filter(LIB, { search: '"aduc"' })).toHaveLength(0);
  });

  it('returns everything for an empty search', () => {
    expect(EF.filter(LIB, { search: '' })).toHaveLength(LIB.length);
  });

  it('reaches legacy-tagged rows through their scalar columns', () => {
    expect(ids(EF.filter(LIB, { search: 'cuadriceps' }))).toEqual(['band', 'legacy']);
  });
});

describe('filter — chips', () => {
  it('ORs tokens inside one dimension', () => {
    const chips = { purpose: ['release', 'strength'] };
    expect(ids(EF.filter(LIB, { chips }))).toEqual(['legacy', 'rdl', 'roll']);
  });

  it('ANDs across dimensions', () => {
    const chips = { purpose: ['activation'], equipment: ['band'] };
    expect(ids(EF.filter(LIB, { chips }))).toEqual(['band']);
  });

  it('combines chips with free text', () => {
    const chips = { muscle_group: ['hamstrings'] };
    expect(ids(EF.filter(LIB, { chips, search: 'foam' }))).toEqual(['roll']);
  });

  it('filters the untagged sentinel', () => {
    const chips = { myofascial_chain: [EF.UNTAGGED] };
    expect(ids(EF.filter(LIB, { chips }))).toEqual(['band', 'bare', 'copen', 'legacy']);
  });

  it('ignores a dimension with no chips', () => {
    expect(EF.filter(LIB, { chips: { plane: [] } })).toHaveLength(LIB.length);
  });
});

describe('optionsFor', () => {
  it('counts tokens present and orders them by the taxonomy', () => {
    const { options } = EF.optionsFor(LIB, 'purpose');
    const order = options.map(o => o.token);
    // Taxonomy order is release → activation → strength → prevention.
    expect(order).toEqual(['release', 'activation', 'strength', 'prevention']);
    expect(options.find(o => o.token === 'activation').count).toBe(2);
    expect(options.find(o => o.token === 'strength').count).toBe(2); // incl. legacy
  });

  it('reports how many are untagged on that axis', () => {
    const { untagged } = EF.optionsFor(LIB, 'myofascial_chain');
    expect(untagged).toBe(4);
  });

  it('drops tokens nothing carries', () => {
    const { options } = EF.optionsFor(LIB, 'purpose');
    expect(options.find(o => o.token === 'cooldown')).toBeUndefined();
  });

  it('keeps non-taxonomy tokens as extras', () => {
    const withCustom = [...LIB, { id: 'x', name: 'X', equipment_tags: ['club_custom_rig'] }];
    const { options } = EF.optionsFor(withCustom, 'equipment');
    expect(options.map(o => o.token)).toContain('club_custom_rig');
  });
});

describe('filterExcept', () => {
  it('drops one dimension so its counts stay honest', () => {
    const state = { chips: { purpose: ['activation'], equipment: ['band'] } };
    // Counting equipment options must ignore the equipment chip itself.
    const pool = EF.filterExcept(LIB, state, 'equipment');
    expect(ids(pool)).toEqual(['band', 'copen']);
    const { options } = EF.optionsFor(pool, 'equipment');
    expect(options.map(o => o.token).sort()).toEqual(['band', 'bench', 'mini_band']);
  });
});

describe('explainEmpty', () => {
  it('names the chip that killed the result', () => {
    const state = { chips: { purpose: ['activation'], equipment: ['barbell'] } };
    expect(EF.filter(LIB, state)).toHaveLength(0);
    const why = EF.explainEmpty(LIB, state);
    expect(why.reason).toBe('chip');
    expect(['purpose', 'equipment']).toContain(why.key);
  });

  it('blames the search when chips alone would match', () => {
    const state = { chips: { purpose: ['release'] }, search: 'zzzz' };
    const why = EF.explainEmpty(LIB, state);
    expect(why.reason).toBe('search');
  });

  it('narrows to the single term at fault', () => {
    const state = { search: 'isquios zzzz' };
    const why = EF.explainEmpty(LIB, state);
    expect(why.reason).toBe('term');
    expect(why.term).toBe('zzzz');
  });

  it('reports an empty library', () => {
    expect(EF.explainEmpty([], { search: 'x' }).reason).toBe('empty_library');
  });

  it('blames a lone unmatched word on the search', () => {
    expect(EF.explainEmpty(LIB, { search: 'zzzz' }).reason).toBe('search');
  });

  it('reports a plain no-match when nothing the coach set can be undone', () => {
    // An external constraint (the caller's own predicate) excludes everything.
    expect(EF.explainEmpty(LIB, { extra: () => false }).reason).toBe('no_match');
  });
});

describe('suggest', () => {
  it('completes the last word with typed dimensions and counts', () => {
    const out = EF.suggest('aduc', LIB);
    const hit = out.find(s => s.token === 'adductors');
    expect(hit).toBeTruthy();
    expect(hit.key).toBe('muscle_group');
    expect(hit.count).toBe(2);
  });

  it('ranks an exact alias first', () => {
    const out = EF.suggest('banda', LIB);
    expect(out[0].token).toBe('band');
  });

  it('never suggests a tag nothing carries', () => {
    expect(EF.suggest('kettle', LIB)).toHaveLength(0);
  });

  it('skips tokens already pinned as chips', () => {
    const out = EF.suggest('aduc', LIB, { chips: { muscle_group: ['adductors'] } });
    expect(out.find(s => s.token === 'adductors')).toBeUndefined();
  });

  it('stays quiet under two characters', () => {
    expect(EF.suggest('a', LIB)).toHaveLength(0);
  });

  it('only completes the word being typed', () => {
    const out = EF.suggest('aductores acti', LIB);
    expect(out.every(s => s.token !== 'adductors')).toBe(true);
    expect(out.find(s => s.token === 'activation')).toBeTruthy();
  });

  it('counts against the pool the caller already narrowed', () => {
    const pool = EF.filter(LIB, { chips: { equipment: ['band'] } });
    const out = EF.suggest('aduc', LIB, { pool });
    expect(out.find(s => s.token === 'adductors').count).toBe(1);
  });
});

describe('stripLastWord', () => {
  it('removes the fragment a suggestion replaces', () => {
    expect(EF.stripLastWord('aductores acti')).toBe('aductores ');
    expect(EF.stripLastWord('acti')).toBe('');
  });
});

describe('toggleChip', () => {
  it('adds, then removes, then prunes the empty dimension', () => {
    let chips = EF.toggleChip({}, 'purpose', 'release');
    expect(chips).toEqual({ purpose: ['release'] });
    chips = EF.toggleChip(chips, 'purpose', 'activation');
    expect(chips.purpose).toEqual(['release', 'activation']);
    chips = EF.toggleChip(chips, 'purpose', 'release');
    expect(chips.purpose).toEqual(['activation']);
    chips = EF.toggleChip(chips, 'purpose', 'activation');
    expect(chips.purpose).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const before = { purpose: ['release'] };
    EF.toggleChip(before, 'purpose', 'activation');
    expect(before).toEqual({ purpose: ['release'] });
  });
});

describe('countChips', () => {
  it('totals tokens across dimensions', () => {
    expect(EF.countChips({ purpose: ['a', 'b'], equipment: ['c'] })).toBe(3);
    expect(EF.countChips({})).toBe(0);
  });
});

describe('dimension coverage', () => {
  it('exposes every taxonomy dimension that exercises can carry', () => {
    const taxDims = Object.keys(TAX.DIMENSIONS);
    const filterDims = EF.DIMENSIONS.filter(d => d.dim).map(d => d.dim);
    expect(filterDims.sort()).toEqual(taxDims.sort());
  });

  it('points every dimension at the column the taxonomy declares', () => {
    EF.DIMENSIONS.filter(d => d.dim).forEach(d => {
      expect(d.column).toBe(TAX.DIMENSIONS[d.dim].column);
    });
  });
});
