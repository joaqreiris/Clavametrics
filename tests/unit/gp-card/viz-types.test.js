import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VIZ_TYPES, VIZ_IDS } from '../../../lib/gp-card/viz-types.js';

describe('VIZ_TYPES', () => {
  // Contar tipos no protegía de nada: el lib se quedó en 8 mientras el builder dibujaba 17, y
  // el validador —que es autoritativo— rechazaba cards que la app crea y muestra a diario
  // (gauge, ACWR, monotonía…). Lo que hay que vigilar es que las DOS tablas digan lo mismo.
  it('conoce los mismos tipos que el builder, y con los mismos límites', () => {
    const src = readFileSync(
      new URL('../../../assets/gp-builder/gp-builder.js', import.meta.url), 'utf8');
    const bloque = src.slice(src.indexOf('const VIZ_TYPES = {'));
    const cuerpo = bloque.slice(0, bloque.indexOf('\n  };'));
    const delBuilder = new Map();
    for (const m of cuerpo.matchAll(/^\s{4}(\w+):\s*\{[^}]*?\bmin:\s*(\d+),\s*max:\s*(\d+)/gm)) {
      delBuilder.set(m[1], { min: +m[2], max: +m[3] });
    }
    expect(delBuilder.size, 'no se pudo leer VIZ_TYPES del builder').toBeGreaterThan(10);

    const faltan = [...delBuilder.keys()].filter(k => !VIZ_TYPES[k]);
    expect(faltan, 'tipos que el builder dibuja y el validador rechazaría').toEqual([]);

    const distintos = [...delBuilder.entries()]
      .filter(([k, d]) => VIZ_TYPES[k] && (VIZ_TYPES[k].min !== d.min || VIZ_TYPES[k].max !== d.max))
      .map(([k, d]) => `${k}: builder ${d.min}-${d.max} vs lib ${VIZ_TYPES[k].min}-${VIZ_TYPES[k].max}`);
    expect(distintos, 'límites de métricas que no coinciden').toEqual([]);
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
