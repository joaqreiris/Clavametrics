/* =============================================================
 * config-to-query.ts  —  production stub
 *
 * Turns a validated gp.card/v1 CONFIG into a query over your GPS
 * warehouse, runs it, and returns a normalized dataset for your
 * existing chart components. Framework-agnostic skeleton: wire the
 * `db` calls and table/column names to your schema.
 *
 * Pipeline:  CONFIG → validateConfig() → configToQuery() → db →
 *            normalize() → dataset  (or { state:'no_data', reason })
 * ============================================================= */

// ---- Types (mirror gp.card/v1) -------------------------------------------
export type Viz = 'kpi' | 'bars' | 'line' | 'scatter' | 'radar' | 'ranking' | 'table' | 'heatmap';
export type Agg = 'avg' | 'total' | 'median' | 'max' | 'min';
export type Kind = 'accum' | 'peak';

export interface MetricRef { id: string; agg: Agg; kind?: Kind; unit?: string; custom?: boolean; }
export interface CardConfig {
  schema: 'gp.card/v1';
  title?: string;
  viz: Viz;
  scope: { level: 'player' | 'squad'; playerId?: string | null };
  metrics: MetricRef[];
  range: { type: 'mc' | 'w7' | 'w30' | 'season' | 'custom'; from?: string; to?: string; mcCode?: string | null };
  comparison: null | { baseline: 'role' | 'match' | 'md' };
  style: Record<string, unknown>;
}

export interface ResolveContext {
  clubId: string;
  playerId?: string;        // active player for player-scope cards
  mcCode?: string;          // current microcycle, used when range.type === 'mc'
  asOf?: string;            // ISO date "today" for rolling ranges
}

// A metric as it lives in metric_catalog (core + custom EAV)
export interface CatalogMetric {
  id: string; name: string; unit: string; kind: Kind;
  is_custom: boolean; squad_rollup: boolean; // squad_rollup=false ⇒ no squad aggregation
  column?: string; eav_attr_id?: string;     // how to read it from the warehouse
}

export type Dataset =
  | { state: 'ok'; viz: Viz; series: Series[]; meta: Meta }
  | { state: 'no_data'; reason: string }
  | { state: 'error'; reason: string };

interface Series { label: string; points: { x: string | number; y: number }[]; unit?: string; }
interface Meta { baseline?: string; range: string; scope: string; }

// ---- Aggregation rule (peak vs accumulable) ------------------------------
const PEAK_OK: Record<Agg, boolean> = { avg: true, max: true, min: true, total: false, median: false };

const AGG_SQL: Record<Agg, (col: string) => string> = {
  avg:    (c) => `AVG(${c})`,
  total:  (c) => `SUM(${c})`,
  median: (c) => `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${c})`,
  max:    (c) => `MAX(${c})`,
  min:    (c) => `MIN(${c})`,
};

// =========================================================================
// 1) VALIDATION  (schema is checked separately with Ajv; this adds the
//    business rules that JSON Schema can't fully express against live data)
// =========================================================================
export interface ValidationError { path: string; message: string; }

export function validateConfig(cfg: CardConfig, catalog: Map<string, CatalogMetric>): ValidationError[] {
  const errors: ValidationError[] = [];
  const COUNT: Record<Viz, [number, number]> = {
    kpi: [1, 1], ranking: [1, 1], scatter: [2, 2], bars: [1, 2],
    line: [1, 6], radar: [3, 8], table: [1, 12], heatmap: [1, 12],
  };
  const [min, max] = COUNT[cfg.viz];
  if (cfg.metrics.length < min || cfg.metrics.length > max)
    errors.push({ path: 'metrics', message: `${cfg.viz} expects ${min}–${max} metrics, got ${cfg.metrics.length}` });

  cfg.metrics.forEach((m, i) => {
    const cat = catalog.get(m.id);
    if (!cat) { errors.push({ path: `metrics[${i}].id`, message: `unknown metric "${m.id}"` }); return; }
    if (cat.kind === 'peak' && !PEAK_OK[m.agg])
      errors.push({ path: `metrics[${i}].agg`, message: `"${m.id}" is a peak metric; "${m.agg}" is not allowed (use avg/max/min)` });
  });
  return errors;
}

// =========================================================================
// 2) NO-DATA detection  (mirrors the UI "no data for this selection" state)
// =========================================================================
export function noDataReason(cfg: CardConfig, catalog: Map<string, CatalogMetric>): string | null {
  if (cfg.scope.level === 'squad') {
    const custom = cfg.metrics.find((m) => { const c = catalog.get(m.id); return c && c.is_custom && !c.squad_rollup; });
    if (custom) {
      const c = catalog.get(custom.id)!;
      return `"${c.name}" is a custom (EAV) metric captured per player — no squad-level rollup for this selection.`;
    }
  }
  return null;
}

// =========================================================================
// 3) CONFIG → SQL
//    Replace `gps_session_facts` and the column/join names with yours.
//    The shape below assumes one row per (player, session, metric-or-columns).
// =========================================================================
export interface BuiltQuery { sql: string; params: Record<string, unknown>; }

export function configToQuery(cfg: CardConfig, ctx: ResolveContext, catalog: Map<string, CatalogMetric>): BuiltQuery {
  const params: Record<string, unknown> = { clubId: ctx.clubId };

  // --- WHERE: scope -------------------------------------------------------
  const where: string[] = ['f.club_id = :clubId'];
  if (cfg.scope.level === 'player') {
    params.playerId = cfg.scope.playerId ?? ctx.playerId;
    where.push('f.player_id = :playerId');
  }
  // squad ⇒ no player filter (aggregates across the roster)

  // --- WHERE: range -------------------------------------------------------
  switch (cfg.range.type) {
    case 'mc':     params.mcCode = cfg.range.mcCode ?? ctx.mcCode; where.push('f.mc_code = :mcCode'); break;
    case 'w7':     where.push("f.session_date >= (:asOf::date - INTERVAL '7 days')"); params.asOf = ctx.asOf; break;
    case 'w30':    where.push("f.session_date >= (:asOf::date - INTERVAL '30 days')"); params.asOf = ctx.asOf; break;
    case 'season': where.push('f.season_id = current_season(:clubId)'); break;
    case 'custom': where.push('f.session_date BETWEEN :from AND :to'); params.from = cfg.range.from; params.to = cfg.range.to; break;
  }

  // --- SELECT: one aggregated column per metric ---------------------------
  // Grouping dimension depends on viz:
  //   ranking/bars/table/heatmap/scatter → per player
  //   line                                → per time bucket (MC/day/week)
  //   kpi/radar                           → single aggregate (no group, or per metric)
  const groupByPlayer = ['ranking', 'bars', 'table', 'heatmap', 'scatter'].includes(cfg.viz);
  const groupByTime   = cfg.viz === 'line';

  const cols = cfg.metrics.map((m, i) => {
    const cat = catalog.get(m.id)!;
    const src = cat.column ? `f.${cat.column}` : `eav_value(f.id, '${cat.eav_attr_id}')`; // adapt EAV read
    return `${AGG_SQL[m.agg](src)} AS m${i}`;
  });

  const dim =
    groupByPlayer ? 'f.player_id AS dim, p.display_name AS dim_label' :
    groupByTime   ? "to_char(f.session_date, 'YYYY-MM-DD') AS dim, f.mc_code AS dim_label" :
    "'all' AS dim, 'all' AS dim_label";

  const groupBy = groupByPlayer ? 'GROUP BY f.player_id, p.display_name'
                : groupByTime   ? 'GROUP BY 1, f.mc_code'
                : '';
  const orderBy = cfg.viz === 'ranking' ? 'ORDER BY m0 DESC' : groupByTime ? 'ORDER BY dim' : '';
  const join = groupByPlayer ? 'JOIN players p ON p.id = f.player_id' : '';

  const sql = `
    SELECT ${dim}, ${cols.join(', ')}
    FROM gps_session_facts f
    ${join}
    WHERE ${where.join(' AND ')}
    ${groupBy}
    ${orderBy}
  `.trim();

  return { sql, params };
  // NB: baseline/comparison (role/match/md) is a second query or a window
  // function joined on the same grain — compute the baseline value and pass
  // it in `meta` so the chart can draw the reference. Left as a TODO hook.
}

// =========================================================================
// 4) RESOLVE  (orchestrates the above; this is what /api/cards/resolve calls)
// =========================================================================
export async function resolveCard(
  cfg: CardConfig,
  ctx: ResolveContext,
  catalog: Map<string, CatalogMetric>,
  db: { query: (sql: string, params: Record<string, unknown>) => Promise<any[]> },
): Promise<Dataset> {
  const errs = validateConfig(cfg, catalog);
  if (errs.length) return { state: 'error', reason: errs.map((e) => `${e.path}: ${e.message}`).join('; ') };

  const nd = noDataReason(cfg, catalog);
  if (nd) return { state: 'no_data', reason: nd };

  try {
    const { sql, params } = configToQuery(cfg, ctx, catalog);
    const rows = await db.query(sql, params);
    if (!rows.length) return { state: 'no_data', reason: 'No rows match the current scope, range and filters.' };
    return normalize(cfg, rows);
  } catch (e: any) {
    return { state: 'error', reason: e?.message ?? 'query failed' };
  }
}

// =========================================================================
// 5) NORMALIZE  (rows → series your existing chart components consume)
// =========================================================================
function normalize(cfg: CardConfig, rows: any[]): Dataset {
  const series: Series[] = cfg.metrics.map((m, i) => ({
    label: m.id,
    unit: m.unit,
    points: rows.map((r) => ({ x: r.dim_label ?? r.dim, y: Number(r[`m${i}`]) })),
  }));
  return {
    state: 'ok',
    viz: cfg.viz,
    series,
    meta: {
      range: cfg.range.type,
      scope: cfg.scope.level,
      baseline: cfg.comparison?.baseline,
    },
  };
}
