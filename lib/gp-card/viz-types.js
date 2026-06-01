/**
 * Visualization types catalogue — ported from gp-core.js.
 * Each entry defines the allowed metric count range.
 * @module lib/gp-card/viz-types
 */

/** @type {Record<import('./types.js').Viz, {name:string, min:number, max:number}>} */
export const VIZ_TYPES = {
  kpi:     { name: 'KPI',     min: 1, max: 1 },
  bars:    { name: 'Bars',    min: 1, max: 2 },
  line:    { name: 'Line',    min: 1, max: 6 },
  scatter: { name: 'Scatter', min: 2, max: 2 },
  radar:   { name: 'Radar',   min: 3, max: 8 },
  ranking: { name: 'Ranking', min: 1, max: 1 },
  table:   { name: 'Table',   min: 1, max: 12 },
  heatmap: { name: 'Heatmap', min: 1, max: 12 },
};

/** All valid viz identifiers. */
export const VIZ_IDS = /** @type {import('./types.js').Viz[]} */ (Object.keys(VIZ_TYPES));
