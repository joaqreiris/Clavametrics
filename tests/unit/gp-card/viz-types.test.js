import { describe, it, expect } from 'vitest';
import { VIZ_TYPES, VIZ_IDS } from '../../../lib/gp-card/viz-types.js';

describe('VIZ_TYPES', () => {
  it('defines all 8 viz types', () => {
    expect(VIZ_IDS).toHaveLength(8);
  });

  it('each type has valid min <= max', () => {
    for (const [id, def] of Object.entries(VIZ_TYPES)) {
      expect(def.min, `${id}.min`).toBeGreaterThanOrEqual(1);
      expect(def.max, `${id}.max`).toBeGreaterThanOrEqual(def.min);
    }
  });

  it('kpi and ranking allow only 1 metric', () => {
    expect(VIZ_TYPES.kpi.max).toBe(1);
    expect(VIZ_TYPES.ranking.max).toBe(1);
  });

  it('scatter requires exactly 2 metrics', () => {
    expect(VIZ_TYPES.scatter.min).toBe(2);
    expect(VIZ_TYPES.scatter.max).toBe(2);
  });

  it('radar requires at least 3 metrics', () => {
    expect(VIZ_TYPES.radar.min).toBe(3);
  });
});
