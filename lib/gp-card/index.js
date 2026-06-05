/**
 * lib/gp-card — GPS card domain layer (gp.card/v1 contract).
 *
 * Public surface:
 *   validateCardSchema  — JSON Schema check only (client-side UX)
 *   validateCardRules   — business rules requiring catalog (server-side)
 *   validateCard        — both combined (authoritative)
 *   fetchCatalog        — load metric catalog from Supabase
 *   groupCatalog        — group catalog by category for UI
 *   VIZ_TYPES           — visualization definitions with metric count bounds
 *   VIZ_IDS             — list of valid viz identifiers
 *   AGGS                — aggregation definitions
 *   AGG_BY_ID           — fast agg lookup
 *   isAggValidForKind   — peak/accum rule
 *   defaultAgg          — default agg for a metric kind
 *
 * @module lib/gp-card
 */

export { validateCardSchema, validateCardRules, validateCard } from './validate.js';
export { fetchCatalog, groupCatalog } from './catalog.js';
export { VIZ_TYPES, VIZ_IDS } from './viz-types.js';
export { AGGS, AGG_BY_ID, isAggValidForKind, defaultAgg } from './aggs.js';
export { resolveCard, getSessionIds, getMcSessionIds, fetchReports, fetchEavMetrics, aggregateSeries, applyAgg, isUuid, isNonNullId, enrichMcDiff, resolveMcReference, CORE_COLS } from './resolver.js';
