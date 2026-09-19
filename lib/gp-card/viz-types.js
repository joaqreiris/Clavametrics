/**
 * Visualization types catalogue.
 * Each entry defines the allowed metric count range.
 *
 * Esta tabla y la del builder (assets/gp-builder/gp-builder.js) describen LO MISMO, y se habían
 * separado: acá faltaban nueve tipos que el producto ya dibuja (gauge, box, demand, dumbbell,
 * diverging, acwr, tsb, monotonia, control) y las barras seguían topadas en 2 métricas cuando el
 * builder admite 6. Como el validador es autoritativo, rechazaba cards que la app crea y muestra
 * todos los días. Si se añade un tipo allá, hay que añadirlo acá.
 * @module lib/gp-card/viz-types
 */

/** @type {Record<import('./types.js').Viz, {name:string, min:number, max:number}>} */
export const VIZ_TYPES = {
  kpi:      { name: 'KPI',           min: 1, max: 1  },
  gauge:    { name: 'Gauge',         min: 1, max: 1  },
  bars:     { name: 'Bars',          min: 1, max: 6  },
  line:     { name: 'Line',          min: 1, max: 6  },
  scatter:  { name: 'Scatter',       min: 2, max: 2  },
  radar:    { name: 'Radar',         min: 3, max: 8  },
  ranking:  { name: 'Ranking',       min: 1, max: 1  },
  table:    { name: 'Table',         min: 1, max: 12 },
  heatmap:  { name: 'Heatmap',       min: 1, max: 12 },
  box:      { name: 'Box plot',      min: 1, max: 1  },
  demand:   { name: 'Match demand',  min: 1, max: 8  },
  dumbbell: { name: 'Change',        min: 1, max: 1  },
  diverging:{ name: 'Facing',        min: 2, max: 2  },
  acwr:     { name: 'ACWR',          min: 1, max: 1  },
  tsb:      { name: 'Form',          min: 1, max: 1  },
  monotonia:{ name: 'Monotony',      min: 1, max: 1  },
  control:  { name: 'Control chart', min: 1, max: 1  },
};

/** All valid viz identifiers. */
export const VIZ_IDS = /** @type {import('./types.js').Viz[]} */ (Object.keys(VIZ_TYPES));
