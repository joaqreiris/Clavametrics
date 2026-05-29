-- ============================================================
-- Bloque 7 — Paso 2: Seed de métricas core + trigger para clubs nuevos
-- ============================================================

-- Seed para clubs existentes (ON CONFLICT DO NOTHING = idempotente)
INSERT INTO gps_metric_definitions
  (club_id, key, label, unit, category, decimals, is_core, display_order)
SELECT
  clubs.id,
  t.key, t.label, t.unit, t.category, t.decimals::integer, true, t.ord::integer
FROM clubs,
(VALUES
  ('total_distance',           'Total Distance',  'm',     'distance',     '0',  '1'),
  ('high_speed_distance',      'HSR',             'm',     'distance',     '0',  '2'),
  ('very_high_speed_distance', 'VHSR',            'm',     'distance',     '0',  '3'),
  ('sprint_distance',          'Sprint Distance', 'm',     'distance',     '0',  '4'),
  ('sprint_count',             'Sprint Count',    'n',     'count',        '0',  '5'),
  ('max_speed',                'Max Speed',       'km/h',  'speed',        '1',  '6'),
  ('avg_speed',                'Avg Speed',       'km/h',  'speed',        '1',  '7'),
  ('accelerations',            'Accelerations',   'n',     'count',        '0',  '8'),
  ('decelerations',            'Decelerations',   'n',     'count',        '0',  '9'),
  ('player_load',              'Player Load',     'AU',    'load',         '1', '10'),
  ('hmld',                     'HMLD',            'm',     'load',         '0', '11'),
  ('time_played',              'Time Played',     'min',   'time',         '0', '12'),
  ('distance_per_minute',      'Distance / Min',  'm/min', 'distance',     '1', '13')
) AS t(key, label, unit, category, decimals, ord)
ON CONFLICT (club_id, key) DO NOTHING;

-- Trigger: sembrar métricas core automáticamente al crear un club nuevo
CREATE OR REPLACE FUNCTION seed_core_metrics_for_club()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gps_metric_definitions
    (club_id, key, label, unit, category, decimals, is_core, display_order)
  VALUES
    (NEW.id, 'total_distance',           'Total Distance',  'm',     'distance', 0,  true,  1),
    (NEW.id, 'high_speed_distance',      'HSR',             'm',     'distance', 0,  true,  2),
    (NEW.id, 'very_high_speed_distance', 'VHSR',            'm',     'distance', 0,  true,  3),
    (NEW.id, 'sprint_distance',          'Sprint Distance', 'm',     'distance', 0,  true,  4),
    (NEW.id, 'sprint_count',             'Sprint Count',    'n',     'count',    0,  true,  5),
    (NEW.id, 'max_speed',                'Max Speed',       'km/h',  'speed',    1,  true,  6),
    (NEW.id, 'avg_speed',                'Avg Speed',       'km/h',  'speed',    1,  true,  7),
    (NEW.id, 'accelerations',            'Accelerations',   'n',     'count',    0,  true,  8),
    (NEW.id, 'decelerations',            'Decelerations',   'n',     'count',    0,  true,  9),
    (NEW.id, 'player_load',              'Player Load',     'AU',    'load',     1,  true, 10),
    (NEW.id, 'hmld',                     'HMLD',            'm',     'load',     0,  true, 11),
    (NEW.id, 'time_played',              'Time Played',     'min',   'time',     0,  true, 12),
    (NEW.id, 'distance_per_minute',      'Distance / Min',  'm/min', 'distance', 1,  true, 13)
  ON CONFLICT (club_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_core_metrics
  AFTER INSERT ON clubs
  FOR EACH ROW EXECUTE FUNCTION seed_core_metrics_for_club();
