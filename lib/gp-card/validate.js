/**
 * Card validation — two layers:
 *   1. JSON Schema (shape + peak rule per metric + metric count per viz type)
 *   2. Business rules that need live catalog data (unknown metrics, squad rollup)
 *
 * Both layers are used server-side (authoritative).
 * The client may use validateCardSchema alone for fast UX feedback.
 *
 * @module lib/gp-card/validate
 */

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './schema.json' with { type: 'json' };
import { VIZ_TYPES } from './viz-types.js';
import { isAggValidForKind } from './aggs.js';

// Single shared Ajv instance (compile once). Must use 2020 build for $schema draft/2020-12.
// strictTypes: false — schema uses allOf/then without repeating "type":"array" in each branch, which is valid draft-2020 but triggers Ajv strict warnings.
const ajv = new Ajv2020({ allErrors: true, strictTypes: false });
addFormats(ajv);
const _ajvValidate = ajv.compile(schema);

/**
 * Layer 1 — validates CONFIG shape against the JSON Schema.
 * Returns an array of errors (empty = valid).
 *
 * @param {unknown} config
 * @returns {{ path: string, message: string }[]}
 */
export function validateCardSchema(config) {
  const ok = _ajvValidate(config);
  if (ok) return [];
  return (_ajvValidate.errors ?? []).map(e => ({
    path: e.instancePath || e.schemaPath,
    message: e.message ?? 'schema violation',
  }));
}

/**
 * Layer 2 — validates business rules that require the live metric catalog.
 *
 * Rules enforced:
 *   • Every metric id must exist in the catalog.
 *   • Peak metrics may only use avg/max/min.
 *   • Custom EAV metrics cannot be squad-level aggregated when squad_rollup=false.
 *   • Metric count per viz type (redundant with schema but checked here for
 *     clear error messages).
 *
 * @param {import('./types.js').CardConfig} config
 * @param {Map<string, import('./types.js').CatalogMetric>} catalog
 * @returns {import('./types.js').ValidationError[]}
 */
export function validateCardRules(config, catalog) {
  const errors = [];

  // Metric count per viz
  const { min, max } = VIZ_TYPES[config.viz] ?? { min: 1, max: 12 };
  const count = config.metrics.length;
  if (count < min || count > max) {
    errors.push({
      path: 'metrics',
      message: `${config.viz} expects ${min}–${max} metrics, got ${count}`,
    });
  }

  config.metrics.forEach((m, i) => {
    const cat = catalog.get(m.id);

    if (!cat) {
      errors.push({ path: `metrics[${i}].id`, message: `unknown metric "${m.id}"` });
      return;
    }

    // Use catalog kind if the metric ref doesn't carry it (older configs).
    const kind = m.kind ?? cat.kind;

    if (!isAggValidForKind(m.agg, kind)) {
      errors.push({
        path: `metrics[${i}].agg`,
        message: `"${m.id}" is a peak metric; "${m.agg}" is not allowed (use avg/max/min)`,
      });
    }

    if (config.scope.level === 'squad' && cat.is_custom && !cat.squad_rollup) {
      errors.push({
        path: `metrics[${i}].id`,
        message: `"${cat.name}" is a custom (EAV) metric with no squad-level rollup`,
      });
    }
  });

  return errors;
}

/**
 * Full validation — schema + business rules. Authoritative server-side check.
 *
 * @param {unknown} config
 * @param {Map<string, import('./types.js').CatalogMetric>} catalog
 * @returns {import('./types.js').ValidationError[]}
 */
export function validateCard(config, catalog) {
  const schemaErrors = validateCardSchema(config);
  if (schemaErrors.length) return schemaErrors;
  return validateCardRules(/** @type {import('./types.js').CardConfig} */ (config), catalog);
}
