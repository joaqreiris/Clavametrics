import { describe, it, expect } from 'vitest';
import { applyAgg, aggregateSeries, CORE_COLS } from '../../../lib/gp-card/resolver.js';

// ── applyAgg ─────────────────────────────────────────────────────────────────

describe('applyAgg', () => {
  const v = [10, 20, 30, 40, 50];

  it('total = sum', () => expect(applyAgg(v, 'total')).toBe(150));
  it('avg = mean',  () => expect(applyAgg(v, 'avg')).toBe(30));
  it('max',        () => expect(applyAgg(v, 'max')).toBe(50));
  it('min',        () => expect(applyAgg(v, 'min')).toBe(10));
  it('median odd', () => expect(applyAgg(v, 'median')).toBe(30));
  it('median even',() => expect(applyAgg([10, 20, 30, 40], 'median')).toBe(25));
  it('empty → null', () => expect(applyAgg([], 'total')).toBeNull());
  it('ignores nulls',() => expect(applyAgg([null, 10, null, 20], 'total')).toBe(30));
  it('unknown agg → null', () => expect(applyAgg(v, 'stddev')).toBeNull());
});

// ── CORE_COLS ────────────────────────────────────────────────────────────────

describe('CORE_COLS', () => {
  it('includes the 13 core metrics', () => {
    for (const key of [
      'total_distance','high_speed_distance','very_high_speed_distance',
      'sprint_distance','sprint_count','max_speed','avg_speed',
      'accelerations','decelerations','player_load','hmld',
      'time_played','distance_per_minute',
    ]) {
      expect(CORE_COLS.has(key), key).toBe(true);
    }
  });
});

// ── aggregateSeries ──────────────────────────────────────────────────────────

function makeCatalog(entries) {
  return new Map(entries.map(e => [e.id, e]));
}

/** Builds a minimal gps_reports row. */
function makeRow({ playerId = 'p1', sessionId = 's1', reportId = 'r1', date = '2026-05-01',
                   mdCode = null, total_distance = 10000, max_speed = 30, ...extra } = {}) {
  return {
    id: reportId,
    player_id: playerId,
    session_id: sessionId,
    total_distance,
    max_speed,
    ...extra,
    training_sessions: {
      session_date: date,
      session_attributes: mdCode ? { md_code: mdCode } : {},
    },
    players: { id: playerId, first_name: 'R.', last_name: 'Vega', position: 'CM' },
  };
}

const catalog = makeCatalog([
  { id: 'total_distance', name: 'Total Distance', unit: 'm',    kind: 'accum', is_custom: false, squad_rollup: true },
  { id: 'max_speed',      name: 'Max Speed',      unit: 'km/h', kind: 'peak',  is_custom: false, squad_rollup: true },
  { id: 'cst_asymmetry',  name: 'Asymmetry',      unit: '%',    kind: 'peak',  is_custom: true,  squad_rollup: false },
]);

describe('aggregateSeries — kpi (single aggregate)', () => {
  const rows = [
    makeRow({ playerId:'p1', total_distance:10000 }),
    makeRow({ playerId:'p1', sessionId:'s2', reportId:'r2', total_distance:12000 }),
  ];
  const config = {
    viz: 'kpi',
    scope: { level: 'player' },
    metrics: [{ id: 'total_distance', agg: 'total' }],
  };

  it('returns one series with one point (total=22000)', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(1);
    expect(s.points[0].y).toBe(22000);
  });

  it('unit and name from catalog', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.unit).toBe('m');
    expect(s.name).toBe('Total Distance');
  });
});

describe('aggregateSeries — bars (group by player)', () => {
  const rows = [
    makeRow({ playerId:'p1', reportId:'r1', total_distance:10000 }),
    makeRow({ playerId:'p1', reportId:'r2', sessionId:'s2', total_distance:12000 }),
    makeRow({ playerId:'p2', reportId:'r3', sessionId:'s3', total_distance: 8000 }),
  ];
  const config = {
    viz: 'bars',
    scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'total' }],
  };

  it('produces one point per player', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(2);
  });

  it('p1 total = 22000', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    const p1 = s.points.find(p => p.x.startsWith('Vega'));
    expect(p1?.y).toBe(22000);
  });
});

describe('aggregateSeries — ranking (sorted desc)', () => {
  const rows = [
    makeRow({ playerId:'p1', reportId:'r1', max_speed:30 }),
    makeRow({ playerId:'p2', reportId:'r2', sessionId:'s2', max_speed:35 }),
    makeRow({ playerId:'p3', reportId:'r3', sessionId:'s3', max_speed:28 }),
  ];
  const config = {
    viz: 'ranking',
    scope: { level: 'squad' },
    metrics: [{ id: 'max_speed', agg: 'max' }],
  };

  it('sorted highest first', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points[0].y).toBe(35);
    expect(s.points[2].y).toBe(28);
  });
});

describe('aggregateSeries — line (group by time)', () => {
  const rows = [
    makeRow({ playerId:'p1', reportId:'r1', date:'2026-05-01', total_distance:10000 }),
    makeRow({ playerId:'p1', reportId:'r2', sessionId:'s2', date:'2026-05-03', total_distance:12000 }),
    makeRow({ playerId:'p1', reportId:'r3', sessionId:'s3', date:'2026-05-05', total_distance: 9000 }),
  ];
  const config = {
    viz: 'line',
    scope: { level: 'player' },
    metrics: [{ id: 'total_distance', agg: 'total' }],
  };

  it('one point per distinct date', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(3);
  });

  it('x = session_date', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points.map(p=>p.x)).toEqual(['2026-05-01','2026-05-03','2026-05-05']);
  });
});

describe('aggregateSeries — EAV custom metric', () => {
  const rows = [
    makeRow({ playerId:'p1', reportId:'r1', total_distance:10000 }),
    makeRow({ playerId:'p1', reportId:'r2', sessionId:'s2', total_distance:12000 }),
  ];
  // EAV map: report → { metric_key: value }
  const eavMap = new Map([
    ['r1', { cst_asymmetry: 5.5 }],
    ['r2', { cst_asymmetry: 7.0 }],
  ]);
  const config = {
    viz: 'kpi',
    scope: { level: 'player' },
    metrics: [{ id: 'cst_asymmetry', agg: 'avg' }],
  };

  it('reads EAV values correctly', () => {
    const [s] = aggregateSeries(rows, eavMap, config, catalog);
    expect(s.points[0].y).toBeCloseTo(6.25);
  });
});

describe('aggregateSeries — line uses md_code label', () => {
  const rows = [
    makeRow({ reportId:'r1', date:'2026-05-01', mdCode:'MD-3', total_distance:9000 }),
    makeRow({ reportId:'r2', sessionId:'s2', date:'2026-05-03', mdCode:'MD-1', total_distance:11000 }),
  ];
  const config = {
    viz: 'line',
    scope: { level: 'player' },
    metrics: [{ id: 'total_distance', agg: 'total' }],
  };

  it('x labels are md_code when present', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points.map(p=>p.x)).toContain('MD-3');
    expect(s.points.map(p=>p.x)).toContain('MD-1');
  });
});

describe('aggregateSeries — group by chosen dimension', () => {
  const withPos = (row, pos) => { row.players = { ...row.players, position: pos }; return row; };
  const rows = [
    withPos(makeRow({ playerId:'p1', reportId:'r1', total_distance:10000 }), 'CB'),
    withPos(makeRow({ playerId:'p2', reportId:'r2', sessionId:'s2', total_distance:12000 }), 'CB'),
    withPos(makeRow({ playerId:'p3', reportId:'r3', sessionId:'s3', total_distance: 8000 }), 'ST'),
  ];

  it('table grouped by position aggregates within each position', () => {
    const config = { viz:'table', scope:{ level:'squad' }, dimensions:[{ id:'position' }],
                     metrics:[{ id:'total_distance', agg:'total' }] };
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(2);
    expect(s.points.find(p => p.x === 'CB').y).toBe(22000);
    expect(s.points.find(p => p.x === 'ST').y).toBe(8000);
  });

  it('table grouped by player_name → one row per player (distinct ids, shared name)', () => {
    const config = { viz:'table', scope:{ level:'squad' }, dimensions:[{ id:'player_name' }],
                     metrics:[{ id:'total_distance', agg:'total' }] };
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(3);
  });

  it('no dimensions[] → legacy default (one row per player)', () => {
    const config = { viz:'table', scope:{ level:'squad' }, metrics:[{ id:'total_distance', agg:'total' }] };
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(3);
  });

  it('single dimension still carries dims:[value] on each point', () => {
    const config = { viz:'table', scope:{ level:'squad' }, dimensions:[{ id:'position' }],
                     metrics:[{ id:'total_distance', agg:'total' }] };
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points.find(p => p.x === 'CB').dims).toEqual(['CB']);
  });
});

describe('aggregateSeries — multi-dimension table (composite key + columns)', () => {
  const withPos = (row, pos) => { row.players = { ...row.players, position: pos }; return row; };
  // p1 & p2 both CB (distinct ids), p3 ST — each player appears once
  const rows = [
    withPos(makeRow({ playerId:'p1', reportId:'r1', total_distance:10000 }), 'CB'),
    withPos(makeRow({ playerId:'p2', reportId:'r2', sessionId:'s2', total_distance:12000 }), 'CB'),
    withPos(makeRow({ playerId:'p3', reportId:'r3', sessionId:'s3', total_distance: 8000 }), 'ST'),
  ];
  const config = {
    viz: 'table', scope: { level: 'squad' },
    dimensions: [{ id: 'player_name' }, { id: 'position' }],
    metrics: [{ id: 'total_distance', agg: 'total' }],
  };

  it('keeps Name+Position as separate rows (composite key does not collapse)', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    expect(s.points).toHaveLength(3);            // one row per player, not merged by name
  });

  it('each row exposes a value per dimension in order [name, position]', () => {
    const [s] = aggregateSeries(rows, new Map(), config, catalog);
    s.points.forEach(p => expect(p.dims).toHaveLength(2));
    const cbPlayer = s.points.find(p => p.dims[1] === 'CB');
    expect(cbPlayer.dims[0]).toMatch(/Vega/);    // name column
    expect(cbPlayer.y).toBe(10000);              // its measure
  });
});

describe('aggregateSeries — scatter (one point per player; dimension = colour category)', () => {
  const withPos = (row, pos) => { row.players = { ...row.players, position: pos }; return row; };
  // Two CB players, one ST. A scatter's dimension must NOT collapse them by position —
  // every player stays its own point, and carries `cat` = the dimension value for colour.
  const rows = [
    withPos(makeRow({ playerId:'p1', reportId:'r1', total_distance:10000 }), 'CB'),
    withPos(makeRow({ playerId:'p2', reportId:'r2', sessionId:'s2', total_distance:12000 }), 'CB'),
    withPos(makeRow({ playerId:'p3', reportId:'r3', sessionId:'s3', total_distance: 8000 }), 'ST'),
  ];
  const config = {
    viz: 'scatter', scope: { level: 'squad' },
    dimensions: [{ id: 'position' }],
    metrics: [{ id: 'total_distance', agg: 'total' }, { id: 'max_speed', agg: 'max' }],
  };

  it('keeps one point per player even though a position dimension is set', () => {
    const [sx] = aggregateSeries(rows, new Map(), config, catalog);
    expect(sx.points).toHaveLength(3);           // not 2 — position does NOT group
  });

  it('carries cat = the colour-dimension value on each point', () => {
    const [sx] = aggregateSeries(rows, new Map(), config, catalog);
    const cats = sx.points.map(p => p.cat).sort();
    expect(cats).toEqual(['CB', 'CB', 'ST']);
  });

  it('cat is null when no dimension is chosen', () => {
    const [sx] = aggregateSeries(rows, new Map(), { ...config, dimensions: [] }, catalog);
    expect(sx.points).toHaveLength(3);
    sx.points.forEach(p => expect(p.cat).toBeNull());
  });
});
