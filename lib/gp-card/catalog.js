/**
 * Metric catalog fetcher — reads from gps_metric_definitions (Supabase).
 *
 * The catalog is the single source of truth for:
 *   • metric id / name / unit / kind (peak|accum)
 *   • whether it is custom (EAV) and whether it rolls up to squad level
 *
 * @module lib/gp-card/catalog
 */

/**
 * Fetches the metric catalog for a club (core + club-specific custom).
 * Returns a Map keyed by metric id for O(1) lookup in the validator/resolver.
 *
 * Requires that gps_metric_definitions has the `kind` and `squad_rollup`
 * columns added by migration 038_gp_card_domain.sql.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clubId
 * @returns {Promise<Map<string, import('./types.js').CatalogMetric>>}
 */
export async function fetchCatalog(supabase, clubId) {
  const { data, error } = await supabase
    .from('gps_metric_definitions')
    .select('key, label, unit, kind, category, is_core, squad_rollup, display_order')
    .eq('club_id', clubId)
    .order('display_order', { ascending: true });

  if (error) throw new Error(`fetchCatalog: ${error.message}`);

  const map = new Map();
  for (const row of data ?? []) {
    map.set(row.key, {
      id:           row.key,
      name:         row.label,
      unit:         row.unit ?? '',
      kind:         row.kind ?? 'accum',   // default accum for legacy rows without kind
      is_custom:    !row.is_core,
      squad_rollup: row.squad_rollup ?? true,
      group_name:   row.category ?? null,
    });
  }
  return map;
}

/**
 * Groups catalog metrics by their category for UI rendering.
 *
 * @param {Map<string, import('./types.js').CatalogMetric>} catalog
 * @returns {{ group: string, items: import('./types.js').CatalogMetric[] }[]}
 */
export function groupCatalog(catalog) {
  /** @type {Map<string, import('./types.js').CatalogMetric[]>} */
  const groups = new Map();
  for (const metric of catalog.values()) {
    const g = metric.group_name ?? 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(metric);
  }
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}
