/**
 * Aggregation definitions + peak/accum rule — ported from gp-core.js.
 * @module lib/gp-card/aggs
 */

/**
 * @typedef {Object} AggDef
 * @property {import('./types.js').Agg} id
 * @property {string} name
 * @property {string} short
 * @property {boolean} peakOk  — true = allowed for peak metrics
 */

/** @type {AggDef[]} */
export const AGGS = [
  { id: 'avg',    name: 'Average',             short: 'AVG',  peakOk: true  },
  { id: 'wavg',   name: 'Weighted avg (time)', short: 'WAVG', peakOk: false },
  { id: 'total',  name: 'Total (sum)',         short: 'SUM',  peakOk: false },
  { id: 'median', name: 'Median',              short: 'MED',  peakOk: false },
  { id: 'max',    name: 'Maximum',             short: 'MAX',  peakOk: true  },
  { id: 'min',    name: 'Minimum',             short: 'MIN',  peakOk: true  },
  // Count of DISTINCT sessions in each group (value-independent → valid for every kind).
  { id: 'count',  name: 'Count (sessions)',    short: 'N',    peakOk: true  },
];

/** Fast lookup by id. */
export const AGG_BY_ID = Object.fromEntries(AGGS.map(a => [a.id, a]));

/**
 * Returns true when the aggregation is valid for the given metric kind.
 * Peak metrics only allow avg/max/min (sum or median across instants is meaningless).
 *
 * @param {import('./types.js').Agg}  agg
 * @param {import('./types.js').Kind} kind
 * @returns {boolean}
 */
export function isAggValidForKind(agg, kind) {
  if (kind === 'peak') return AGG_BY_ID[agg]?.peakOk ?? false;
  return true; // accum metrics accept all aggregations
}

/**
 * Returns the default aggregation for a metric kind.
 * Peak → avg (instantaneous average over sessions is the natural choice).
 * Accum → total (sum across sessions).
 *
 * @param {import('./types.js').Kind} kind
 * @returns {import('./types.js').Agg}
 */
export function defaultAgg(kind) {
  return kind === 'peak' ? 'avg' : 'total';
}
