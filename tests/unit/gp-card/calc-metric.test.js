import { describe, it, expect } from 'vitest';
import { aggregateSeries, neededKeys } from '../../../lib/gp-card/resolver.js';
import { evalFormulaRow, formulaBaseMetrics } from '../../../lib/gp-card/calc-formula.js';

const FORMULA = 'high_speed_distance / time_played';
const catalog = new Map([
  ['high_speed_distance', { name: 'HSR', unit: 'm' }],
  ['time_played',         { name: 'Min', unit: 'min' }],
  ['hsr_per_min',         { name: 'HSR por minuto', unit: 'm/min', kind: 'calculated', calculated: true, formula: FORMULA }],
]);
const calcMetric = (agg) => ({ id: 'hsr_per_min', agg, kind: 'calculated', formula: FORMULA });
const row = (id, pid, last, hsd, time) => ({
  id, player_id: pid, players: { last_name: last, first_name: 'X', position: 'MF' },
  training_sessions: { session_date: '2026-06-0' + id, session_attributes: {} },
  high_speed_distance: hsd, time_played: time,
});
// r1=7.5  r2=10  r3=div0→null  r4=10   (A:r1,r4  B:r2,r3)
const rows = [ row(1,'A','Aaa',600,80), row(2,'B','Bbb',900,90), row(3,'B','Bbb',500,0), row(4,'A','Aaa',700,70) ];

describe('calc-formula · evalFormulaRow', () => {
  it('computes per row', () => expect(evalFormulaRow(FORMULA, id => ({ high_speed_distance: 612, time_played: 78 }[id]))).toBeCloseTo(612/78, 9));
  it('division by zero → null', () => expect(evalFormulaRow(FORMULA, id => ({ high_speed_distance: 500, time_played: 0 }[id]))).toBeNull());
  it('missing metric → null (not 0)', () => expect(evalFormulaRow(FORMULA, id => ({ high_speed_distance: null, time_played: 80 }[id]))).toBeNull());
  it('formulaBaseMetrics', () => expect(formulaBaseMetrics(FORMULA).sort()).toEqual(['high_speed_distance','time_played']));
});

describe('resolver · neededKeys (fetch base deps of calc formulas)', () => {
  it('fetches the base metrics, not the calc id', () => {
    const cfg = { viz: 'kpi', metrics: [calcMetric('avg')], dimensions: [], scope: { level: 'squad' } };
    expect(neededKeys(cfg, catalog)).toEqual({ core: ['high_speed_distance', 'time_played'], eav: [] });
  });
});

describe('resolver · aggregateSeries with a calculated metric', () => {
  it('KPI squad = AVG over sessions of (per-session calc); div0 excluded', () => {
    const cfg = { viz: 'kpi', metrics: [calcMetric('avg')], dimensions: [], scope: { level: 'squad' } };
    const s = aggregateSeries(rows, new Map(), cfg, catalog);
    expect(s[0].name).toBe('HSR por minuto');
    expect(s[0].unit).toBe('m/min');
    expect(s[0].points[0].y).toBeCloseTo((7.5 + 10 + 10) / 3, 9);   // r3 (div0) excluded
  });
  it('MAX agg changes coherently', () => {
    const cfg = { viz: 'kpi', metrics: [calcMetric('max')], dimensions: [], scope: { level: 'squad' } };
    expect(aggregateSeries(rows, new Map(), cfg, catalog)[0].points[0].y).toBe(10);
  });
  it('table per player → each row its own value', () => {
    const cfg = { viz: 'table', metrics: [calcMetric('avg')], dimensions: [{ id: 'player_name' }], scope: { level: 'squad' } };
    const pts = aggregateSeries(rows, new Map(), cfg, catalog)[0].points;
    const byName = Object.fromEntries(pts.map(p => [p.x, p.y]));
    expect(byName['Aaa, X.']).toBeCloseTo((7.5 + 10) / 2, 9);   // A: r1,r4
    expect(byName['Bbb, X.']).toBeCloseTo(10, 9);               // B: r2 (r3 div0 excluded)
  });
  it('reads the formula from the catalog when the config metric omits it', () => {
    const cfg = { viz: 'kpi', metrics: [{ id: 'hsr_per_min', agg: 'avg' }], dimensions: [], scope: { level: 'squad' } };
    expect(aggregateSeries(rows, new Map(), cfg, catalog)[0].points[0].y).toBeCloseTo((7.5 + 10 + 10) / 3, 9);
  });
  it('a base metric is still resolved even if only used inside the formula', () => {
    // config only has the calc metric; base deps come via neededKeys/fetch
    const cfg = { viz: 'kpi', metrics: [calcMetric('avg')], dimensions: [], scope: { level: 'squad' } };
    expect(neededKeys(cfg, catalog).core).toContain('time_played');
  });
});
