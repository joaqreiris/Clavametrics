-- Migration 048: RPE + s-RPE como métricas seleccionables en gps_metric_definitions,
-- para que el Chart Builder pueda usar carga interna (RPE) junto a las métricas GPS.
-- Idempotente (ON CONFLICT DO NOTHING). Solo clubs existentes; el trigger de club
-- nuevo (seed_core_metrics_for_club) se extiende aparte en un follow-up.

INSERT INTO gps_metric_definitions
  (club_id, key, label, unit, category, decimals, is_core, kind, squad_rollup, display_order)
SELECT
  clubs.id,
  t.key, t.label, t.unit, t.category, t.decimals::integer, true, t.kind, true, t.ord::integer
FROM clubs,
(VALUES
  ('rpe',  'RPE',                  'AU', 'load', '1', 'peak',  '14'),
  ('srpe', 'Session Load (s-RPE)', 'AU', 'load', '0', 'accum', '15')
) AS t(key, label, unit, category, decimals, kind, ord)
ON CONFLICT (club_id, key) DO NOTHING;
