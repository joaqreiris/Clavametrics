/**
 * JSDoc types for gp.card/v1 — GPS Analysis card contract.
 * Shared by the manual builder, the catalog, and the AI generator.
 * @module lib/gp-card/types
 */

/**
 * @typedef {'kpi'|'bars'|'line'|'scatter'|'radar'|'ranking'|'table'|'heatmap'} Viz
 */

/**
 * @typedef {'avg'|'total'|'median'|'max'|'min'} Agg
 */

/**
 * @typedef {'accum'|'peak'} Kind
 * accum = distance/count/load — can be summed across time.
 * peak  = instantaneous value (speed, ratio) — sum is meaningless; avg/max/min only.
 */

/**
 * @typedef {Object} MetricRef
 * @property {string}   id
 * @property {Agg}      agg
 * @property {Kind}     [kind]
 * @property {string}   [unit]
 * @property {boolean}  [custom]
 */

/**
 * @typedef {Object} CardConfig
 * @property {'gp.card/v1'}                   schema
 * @property {string}                          [title]
 * @property {Viz}                             viz
 * @property {{ level: 'player'|'squad', playerId?: string|null }} scope
 * @property {MetricRef[]}                     metrics
 * @property {{ type: 'mc'|'w7'|'w30'|'season'|'custom', from?: string, to?: string, mcCode?: string|null }} range
 * @property {null|{ baseline: 'role'|'match'|'md' }}              comparison
 * @property {{ size: 'sm'|'md'|'lg'|'full', color?: string, palette?: string, axes?: boolean, legend?: boolean, dataLabels?: boolean }} style
 */

/**
 * @typedef {Object} CatalogMetric
 * @property {string}  id
 * @property {string}  name
 * @property {string}  unit
 * @property {Kind}    kind
 * @property {boolean} is_custom
 * @property {boolean} squad_rollup
 * @property {string}  [group_name]
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} path
 * @property {string} message
 */

/**
 * @typedef {Object} ResolveContext
 * @property {string}  clubId
 * @property {string}  [playerId]
 * @property {string}  [mcCode]
 * @property {string}  [asOf]   ISO date string
 */
