import { describe, it, expect } from 'vitest';
import { validateCardSchema, validateCardRules, validateCard } from '../../../lib/gp-card/validate.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid gp.card/v1 config. */
function makeConfig(overrides = {}) {
  return {
    schema: 'gp.card/v1',
    viz: 'bars',
    scope: { level: 'player' },
    metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum' }],
    range: { type: 'mc' },
    comparison: null,
    style: { size: 'md' },
    ...overrides,
  };
}

/** Minimal catalog with total_distance (accum) and max_speed (peak). */
function makeCatalog(extra = []) {
  return new Map([
    ['total_distance', { id: 'total_distance', name: 'Total Distance', unit: 'm',    kind: 'accum', is_custom: false, squad_rollup: true }],
    ['max_speed',      { id: 'max_speed',      name: 'Max Speed',      unit: 'km/h', kind: 'peak',  is_custom: false, squad_rollup: true }],
    ['cst_asym',       { id: 'cst_asym',       name: 'Asymmetry',      unit: '%',    kind: 'peak',  is_custom: true,  squad_rollup: false }],
    ...extra,
  ]);
}

// ── validateCardSchema ────────────────────────────────────────────────────────

describe('validateCardSchema', () => {
  it('accepts a minimal valid config', () => {
    expect(validateCardSchema(makeConfig())).toHaveLength(0);
  });

  it('rejects missing required fields', () => {
    const { viz: _, ...noViz } = makeConfig();
    expect(validateCardSchema(noViz).length).toBeGreaterThan(0);
  });

  it('rejects invalid viz enum', () => {
    expect(validateCardSchema(makeConfig({ viz: 'pie' })).length).toBeGreaterThan(0);
  });

  it('rejects invalid range type', () => {
    expect(validateCardSchema(makeConfig({ range: { type: 'yesterday' } })).length).toBeGreaterThan(0);
  });

  it('rejects custom range missing dates', () => {
    const cfg = makeConfig({ range: { type: 'custom' } });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });

  it('accepts custom range with dates', () => {
    const cfg = makeConfig({ range: { type: 'custom', from: '2026-01-01', to: '2026-01-31' } });
    expect(validateCardSchema(cfg)).toHaveLength(0);
  });

  it('rejects scatter with 1 metric (schema min=2)', () => {
    const cfg = makeConfig({ viz: 'scatter', metrics: [{ id: 'total_distance', agg: 'total' }] });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });

  it('rejects kpi with 2 metrics (schema max=1)', () => {
    const cfg = makeConfig({
      viz: 'kpi',
      metrics: [
        { id: 'total_distance', agg: 'total' },
        { id: 'max_speed',      agg: 'avg'   },
      ],
    });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });

  it('enforces peak rule in JSON Schema (total on peak metric)', () => {
    const cfg = makeConfig({
      metrics: [{ id: 'max_speed', agg: 'total', kind: 'peak' }],
    });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });

  it('accepts peak metric with avg', () => {
    const cfg = makeConfig({
      metrics: [{ id: 'max_speed', agg: 'avg', kind: 'peak' }],
    });
    expect(validateCardSchema(cfg)).toHaveLength(0);
  });

  it('accepts a table metric with per-column conditional format', () => {
    const cfg = makeConfig({
      viz: 'table', dimensions: [{ id: 'player_name' }],
      metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum',
        format: { mode: 'icon', dir: 'band', dec: 2, heatScale: 'gyr', iconStyle: 'arrow', barColor: null, thr: { lo: 0.8, hi: 1.3 } } }],
    });
    expect(validateCardSchema(cfg)).toHaveLength(0);
  });

  it('rejects an unknown format mode', () => {
    const cfg = makeConfig({
      viz: 'table',
      metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', format: { mode: 'sparkles' } }],
    });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });

  it('accepts a presentation-only table sort', () => {
    const cfg = makeConfig({ viz: 'table', sort: { col: 'met:total_distance', dir: 'desc' } });
    expect(validateCardSchema(cfg)).toHaveLength(0);
  });

  it('rejects a sort with an invalid direction', () => {
    const cfg = makeConfig({ viz: 'table', sort: { col: 'met:total_distance', dir: 'sideways' } });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });

  it('accepts bar variant style (orientation/stacked) + a combo line metric', () => {
    const cfg = makeConfig({
      viz: 'bars',
      style: { size: 'md', orientation: 'horizontal', stacked: true },
      metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum' }, { id: 'max_speed', agg: 'avg', kind: 'peak', line: true }],
    });
    expect(validateCardSchema(cfg)).toHaveLength(0);
  });

  it('rejects an invalid orientation', () => {
    const cfg = makeConfig({ viz: 'bars', style: { size: 'md', orientation: 'diagonal' } });
    expect(validateCardSchema(cfg).length).toBeGreaterThan(0);
  });
});

// ── validateCardRules ─────────────────────────────────────────────────────────

describe('validateCardRules', () => {
  it('passes a valid config + catalog', () => {
    expect(validateCardRules(makeConfig(), makeCatalog())).toHaveLength(0);
  });

  it('errors on unknown metric id', () => {
    const cfg = makeConfig({ metrics: [{ id: 'ghost_metric', agg: 'avg' }] });
    const errs = validateCardRules(cfg, makeCatalog());
    expect(errs.some(e => e.message.includes('unknown metric'))).toBe(true);
  });

  it('errors when peak metric uses total (from catalog kind)', () => {
    const cfg = makeConfig({ metrics: [{ id: 'max_speed', agg: 'total' }] });
    const errs = validateCardRules(cfg, makeCatalog());
    expect(errs.some(e => e.path.includes('agg'))).toBe(true);
  });

  it('errors when squad scope uses non-rollup custom metric', () => {
    const cfg = makeConfig({
      scope: { level: 'squad' },
      metrics: [{ id: 'cst_asym', agg: 'avg' }],
    });
    const errs = validateCardRules(cfg, makeCatalog());
    expect(errs.some(e => e.message.includes('no squad-level rollup'))).toBe(true);
  });

  it('allows squad scope with rollup-enabled metrics', () => {
    const cfg = makeConfig({ scope: { level: 'squad' } });
    expect(validateCardRules(cfg, makeCatalog())).toHaveLength(0);
  });

  it('errors on metric count violation (kpi with 2 metrics)', () => {
    const cfg = makeConfig({
      viz: 'kpi',
      metrics: [
        { id: 'total_distance', agg: 'total', kind: 'accum' },
        { id: 'max_speed',      agg: 'avg',   kind: 'peak'  },
      ],
    });
    const errs = validateCardRules(cfg, makeCatalog());
    expect(errs.some(e => e.path === 'metrics')).toBe(true);
  });
});

// ── validateCard (full) ───────────────────────────────────────────────────────

describe('validateCard', () => {
  it('returns empty for a fully valid config', () => {
    expect(validateCard(makeConfig(), makeCatalog())).toHaveLength(0);
  });

  it('short-circuits to schema errors when schema is invalid', () => {
    const errs = validateCard({ schema: 'gp.card/v1', viz: 'pie' }, makeCatalog());
    expect(errs.length).toBeGreaterThan(0);
  });

  it('catches business-rule error after schema passes', () => {
    const cfg = makeConfig({ metrics: [{ id: 'max_speed', agg: 'total' }] });
    const errs = validateCard(cfg, makeCatalog());
    expect(errs.some(e => e.path.includes('agg'))).toBe(true);
  });
});

describe('validateCardSchema — dimensions', () => {
  it('accepts a config with no dimensions (backward compatible)', () => {
    expect(validateCardSchema(makeConfig())).toHaveLength(0);
  });
  it('accepts a known dimension', () => {
    expect(validateCardSchema(makeConfig({ dimensions: [{ id: 'position' }] }))).toHaveLength(0);
  });
  it('rejects an unknown dimension id', () => {
    expect(validateCardSchema(makeConfig({ dimensions: [{ id: 'shoe_size' }] })).length).toBeGreaterThan(0);
  });
  it('accepts several dimensions (table can combine them)', () => {
    expect(validateCardSchema(makeConfig({ dimensions: [{ id: 'player_name' }, { id: 'position' }] }))).toHaveLength(0);
  });
  it('rejects more than four dimensions', () => {
    const five = ['player_name', 'position', 'session_date', 'md_code', 'microcycle'].map(id => ({ id }));
    expect(validateCardSchema(makeConfig({ dimensions: five })).length).toBeGreaterThan(0);
  });
});
