import { describe, it, expect } from 'vitest';
import { isAggValidForKind, defaultAgg, AGG_BY_ID } from '../../../lib/gp-card/aggs.js';

describe('isAggValidForKind', () => {
  it('allows avg/max/min for peak metrics', () => {
    expect(isAggValidForKind('avg', 'peak')).toBe(true);
    expect(isAggValidForKind('max', 'peak')).toBe(true);
    expect(isAggValidForKind('min', 'peak')).toBe(true);
  });

  it('blocks total and median for peak metrics', () => {
    expect(isAggValidForKind('total',  'peak')).toBe(false);
    expect(isAggValidForKind('median', 'peak')).toBe(false);
  });

  it('allows all aggs for accum metrics', () => {
    for (const id of Object.keys(AGG_BY_ID)) {
      expect(isAggValidForKind(id, 'accum')).toBe(true);
    }
  });
});

describe('defaultAgg', () => {
  it('returns total for accum', () => expect(defaultAgg('accum')).toBe('total'));
  it('returns avg for peak',   () => expect(defaultAgg('peak')).toBe('avg'));
});
