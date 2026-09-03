import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const load = rel => { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };

// The catalogue is a browser script; give it the smallest world it needs and a fake
// Supabase whose reply we control per test.
function boot(rows, opts = {}) {
  const o = opts || {};
  globalThis.window = {
    addEventListener() {}, dispatchEvent() {},
    getClubId: () => Promise.resolve(o.noClub ? null : 'club-1'),
    // The list reads through gps-reader's cached getCatalog, not a query of its own.
    getCatalog: () => {
      o.calls = (o.calls || 0) + 1;
      return o.error ? Promise.reject(new Error('boom')) : Promise.resolve(rows);
    },
    invalidateCatalogCache() { o.invalidated = true; },
  };
  globalThis.document = { readyState: 'complete', addEventListener() {} };
  globalThis.CustomEvent = function () {};
  load('assets/gps-units.js');
  load('assets/gps-catalog.js');
  return window.cmGpsCatalog;
}

// What MOI Kompong DEWA actually has in gps_metric_definitions: the thirteen football
// columns plus two the club added itself. `kind` is NULL on every row — that column came
// later — so the aggregation has to be inferred.
const MOI_ROWS = [
  { key:'total_distance', label:'Total Distance', unit:'m', category:'distance', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:1 },
  { key:'high_speed_distance', label:'HSR', unit:'m', category:'distance', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:2 },
  { key:'very_high_speed_distance', label:'VHSR', unit:'m', category:'distance', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:3 },
  { key:'sprint_distance', label:'Sprint Distance', unit:'m', category:'distance', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:4 },
  { key:'sprint_count', label:'Sprint Count', unit:'n', category:'count', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:5 },
  { key:'max_speed', label:'Max Speed', unit:'km/h', category:'speed', kind:null, decimals:2, is_core:true, squad_rollup:true, display_order:6 },
  { key:'avg_speed', label:'Avg Speed', unit:'km/h', category:'speed', kind:null, decimals:1, is_core:true, squad_rollup:true, display_order:7 },
  { key:'accelerations', label:'Accelerations', unit:'n', category:'count', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:8 },
  { key:'decelerations', label:'Decelerations', unit:'n', category:'count', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:9 },
  { key:'player_load', label:'Player Load', unit:'AU', category:'load', kind:null, decimals:1, is_core:true, squad_rollup:true, display_order:10 },
  { key:'hmld', label:'HMLD', unit:'m', category:'load', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:11 },
  { key:'time_played', label:'Time Played', unit:'min', category:'time', kind:null, decimals:0, is_core:true, squad_rollup:true, display_order:12 },
  { key:'distance_per_minute', label:'Distance / Min', unit:'m/min', category:'distance', kind:null, decimals:1, is_core:true, squad_rollup:true, display_order:13 },
  { key:'max_hr', label:'Max HR', unit:'Nº', category:'custom', kind:null, decimals:2, is_core:false, squad_rollup:true, display_order:200 },
  { key:'max_vel_pct', label:'% Max Vel', unit:'%', category:'speed', kind:null, decimals:2, is_core:false, squad_rollup:true, display_order:201 },
];

// The hand-written list Load Monitor carried (COL_ELIGIBLE). Nothing a football club
// could pick before may vanish now.
const LOAD_MONITOR_ELIGIBLE = [
  'total_distance', 'high_speed_distance', 'very_high_speed_distance', 'sprint_distance',
  'sprint_count', 'accelerations', 'decelerations', 'player_load', 'distance_per_minute', 'hmld',
];

describe('gps catalogue · a football club loses nothing', () => {
  let cat;
  beforeEach(async () => { cat = boot(MOI_ROWS); await cat.ready(); });

  it('still offers every metric Load Monitor used to hardcode', () => {
    const keys = cat.keys();
    LOAD_MONITOR_ELIGIBLE.forEach(k => expect(keys, k).toContain(k));
  });

  it('keeps the club label, not our own wording', () => {
    expect(cat.label('high_speed_distance')).toBe('HSR');
    expect(cat.label('distance_per_minute')).toBe('Distance / Min');
  });

  it('respects the decimals the club chose', () => {
    expect(cat.decimals('max_speed')).toBe(2);   // MOI set 2, the unit contract says 1
    expect(cat.decimals('total_distance')).toBe(0);
  });

  it('keeps the club order', () => {
    expect(cat.keys().slice(0, 4)).toEqual([
      'total_distance', 'high_speed_distance', 'very_high_speed_distance', 'sprint_distance']);
  });

  it('surfaces the two metrics the club added and nothing showed', () => {
    // This is the point: MOI put Max HR and % Max Vel in the catalogue and no screen
    // read the table, so they were invisible everywhere.
    expect(cat.keys()).toContain('max_hr');
    expect(cat.keys()).toContain('max_vel_pct');
    expect(cat.label('max_hr')).toBe('Max HR');
  });
});

describe('gps catalogue · aggregation is inferred when the club never set it', () => {
  let cat;
  beforeEach(async () => { cat = boot(MOI_ROWS); await cat.ready(); });

  it('adds up the things you add up', () => {
    ['total_distance', 'high_speed_distance', 'sprint_count', 'accelerations', 'player_load',
     'time_played'].forEach(k => expect(cat.agg(k), k).toBe('sum'));
  });

  it('never sums a peak', () => {
    // Adding max speeds across a week is the classic meaningless number.
    expect(cat.agg('max_speed')).toBe('max');
    expect(cat.agg('max_hr')).toBe('max');
    expect(cat.isAccum('max_speed')).toBe(false);
  });

  it('never sums a rate or a percentage', () => {
    expect(cat.agg('distance_per_minute')).toBe('avg');
    expect(cat.agg('avg_speed')).toBe('avg');
    expect(cat.agg('max_vel_pct')).toBe('max');   // max_ prefix wins: it IS a peak
  });

  it('an explicit kind from the club beats the guess', () => {
    const c = boot([{ key:'total_distance', kind:'peak', display_order:1 },
                    { key:'max_speed',      kind:'accum', display_order:2 }]);
    return c.ready().then(() => {
      expect(c.agg('total_distance')).toBe('max');
      expect(c.agg('max_speed')).toBe('sum');
    });
  });
});

describe('gps catalogue · where a value lives', () => {
  let cat;
  beforeEach(async () => { cat = boot(MOI_ROWS); await cat.ready(); });

  it('knows which metrics are real columns and which are key/value', () => {
    expect(cat.source('total_distance')).toBe('column');
    expect(cat.source('max_hr')).toBe('custom');
    expect(cat.columns()).toContain('player_load');
    expect(cat.columns()).not.toContain('max_hr');
    expect(cat.customKeys()).toEqual(['max_hr', 'max_vel_pct']);
  });

  it('classifies an unknown key as key/value rather than throwing', () => {
    expect(cat.source('jump_count')).toBe('custom');
  });
});

describe('gps catalogue · never leaves a screen empty', () => {
  it('falls back to the fixed columns when the club has no catalogue', async () => {
    const cat = boot([]);
    await cat.ready();
    expect(cat.keys()).toEqual(cat.FIXED_COLUMNS);
    expect(cat.label('total_distance')).toBe('Total Distance');
  });

  it('falls back when the query fails', async () => {
    const cat = boot(null, { error: true });
    await cat.ready();
    expect(cat.keys().length).toBe(13);
  });

  it('answers before the DB has replied at all', () => {
    const cat = boot(MOI_ROWS);
    // No await: this is the first frame.
    expect(cat.isLoaded()).toBe(false);
    expect(cat.keys().length).toBe(13);
    expect(cat.label('hmld')).toBe('HMLD');
  });

  it('with no session it keeps the fallback and stays retryable', async () => {
    const cat = boot(MOI_ROWS, { noClub: true });
    await cat.ready();
    expect(cat.keys().length).toBe(13);
    expect(cat.isLoaded()).toBe(false);   // so a later call tries again
  });
});

describe('gps catalogue · a basketball club', () => {
  it('reads its own metrics, not football ones', async () => {
    const cat = boot([
      { key:'player_load', label:'Player Load', unit:'AU', category:'load', decimals:1, display_order:1 },
      { key:'jump_count',  label:'Jumps',       unit:'n',  category:'count', decimals:0, display_order:2 },
      { key:'change_of_direction', label:'CoD', unit:'n',  category:'count', decimals:0, display_order:3 },
      { key:'time_played', label:'Minutes',     unit:'min',category:'time',  decimals:0, display_order:4 },
    ]);
    await cat.ready();
    expect(cat.keys()).toEqual(['player_load', 'jump_count', 'change_of_direction', 'time_played']);
    expect(cat.keys()).not.toContain('high_speed_distance');
    expect(cat.label('time_played')).toBe('Minutes');
    // Jumps and direction changes are counted up; they live in the key/value table.
    expect(cat.agg('jump_count')).toBe('sum');
    expect(cat.source('jump_count')).toBe('custom');
  });
});

describe('gps catalogue · it does not query on its own', () => {
  it('reads through gps-reader\'s cached getCatalog, once', async () => {
    const opts = { calls: 0 };
    const cat = boot(MOI_ROWS, opts);
    // boot() already kicked one load off; wait for it, then check no consumer adds more.
    await cat.ready();
    const after = opts.calls;
    await cat.ready();
    await cat.ready();
    expect(after).toBe(1);
    expect(opts.calls).toBe(1);
  });

  it('drops the shared cache on refresh, or it would serve stale definitions', async () => {
    const opts = {};
    const cat = boot(MOI_ROWS, opts);
    await cat.ready();
    await cat.refresh();
    expect(opts.invalidated).toBe(true);
  });
});
