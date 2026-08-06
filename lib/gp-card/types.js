/**
 * JSDoc types for gp.card/v1 — GPS Analysis card contract.
 * Shared by the manual builder, the catalog, and the AI generator.
 * @module lib/gp-card/types
 */

/**
 * @typedef {'kpi'|'bars'|'line'|'scatter'|'radar'|'ranking'|'table'|'heatmap'} Viz
 */

/**
 * @typedef {'avg'|'total'|'median'|'max'|'min'|'wavg'|'count'} Agg
 *   'wavg' = time-weighted average: Σ(value×duration) / Σ(duration). For source='task' the
 *   weight is the period duration (a 40-min drill outweighs a 10-min one).
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
 * @property {'session'|'task'}                [source]  data source. 'session' (default when
 *   absent ⇒ existing cards keep working) reads gps_reports (one row per session×player).
 *   'task' reads v_gps_task_analysis (one row per period×player mapped to a drill) and
 *   unlocks the task dimensions + per-minute metrics.
 * @property {{ level: 'player'|'squad', playerId?: string|null }} scope
 * @property {MetricRef[]}                     metrics
 * @property {{ id: 'player_name'|'position'|'session_date'|'md_code'|'microcycle'|'rival'|'drill'|'field_size'|'players_format' }[]} [dimensions]
 *   grouping/label fields (no aggregation); empty ⇒ row/X defaults to player_name.
 *   'drill'|'field_size'|'players_format' are valid ONLY when source==='task';
 *   'md_code'|'microcycle'|'rival' apply to source==='session'.
 * @property {{ type: 'mc'|'w7'|'w30'|'season'|'custom'|'allTime', from?: string, to?: string, mcCode?: string|null }} range
 * @property {null|{ baseline: 'position'|'match'|'md'|'self'|'mc', method?: 'avg'|'wavg'|'zscore', refWindow?: ({ type: 'season' }|{ type: 'lastN', days: number }|null), opts?: { topN?: number, mdLookback?: number }, refMcId?: (string|null) }} comparison
 *   Unified comparison model. `baseline` selects the reference (legacy 'role' ⇒ 'position',
 *   same position-group logic). `method` is how the reference set is aggregated. `refWindow`
 *   is the reference's OWN fixed time window (independent of the card's visible range) so the
 *   baseline doesn't move. `opts` holds per-type settings (match→topN, md→mdLookback). `refMcId`
 *   applies only when baseline==='mc'.
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
