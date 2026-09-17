-- Migración 179: el RPE y el s-RPE, disponibles de verdad en el Chart Builder.
--
-- La 048 los agregó a gps_metric_definitions "para todos los clubes", pero en la base sólo
-- los tiene el club demo: o se aplicó cuando era el único que existía, o no llegó a correr.
-- Los otros cinco clubes no los ven en el builder — el catálogo se lee de esta tabla por club.
--
-- Y su propia nota dejaba pendiente el follow-up: seed_core_metrics_for_club (el trigger que
-- siembra las métricas de un club nuevo) tampoco los incluye, así que ningún club creado desde
-- entonces los habría recibido.
--
-- Esta migración cierra las dos puntas: los clubes que ya existen y los que vengan.
-- Idempotente por ON CONFLICT (club_id, key).

-- 1. Los clubes que ya existen.
INSERT INTO gps_metric_definitions
  (club_id, key, label, unit, category, decimals, is_core, kind, squad_rollup, display_order)
SELECT clubs.id, t.key, t.label, t.unit, t.category, t.decimals::integer,
       true, t.kind, true, t.ord::integer
FROM clubs,
(VALUES
  ('rpe',  'RPE',                  'AU', 'load', '1', 'peak',  '14'),
  ('srpe', 'Session Load (s-RPE)', 'AU', 'load', '0', 'accum', '15')
) AS t(key, label, unit, category, decimals, kind, ord)
ON CONFLICT (club_id, key) DO NOTHING;

-- 2. Los clubes nuevos. Se reescribe el trigger entero con las dos filas al final; kind y
--    squad_rollup pasan a ser explícitos (antes iban por defecto) porque el RPE es 'peak' y el
--    s-RPE 'accum', y con el valor por defecto el builder los agregaría mal.
CREATE OR REPLACE FUNCTION public.seed_core_metrics_for_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  set local row_security = off;   -- seeding de sistema: saltea la RLS de usuario
  INSERT INTO gps_metric_definitions
    (club_id, key, label, unit, category, decimals, is_core, kind, squad_rollup, display_order)
  VALUES
    (NEW.id, 'total_distance',           'Total Distance',  'm',     'distance', 0,  true, 'accum', true,  1),
    (NEW.id, 'high_speed_distance',      'HSR',             'm',     'distance', 0,  true, 'accum', true,  2),
    (NEW.id, 'very_high_speed_distance', 'VHSR',            'm',     'distance', 0,  true, 'accum', true,  3),
    (NEW.id, 'sprint_distance',          'Sprint Distance', 'm',     'distance', 0,  true, 'accum', true,  4),
    (NEW.id, 'sprint_count',             'Sprint Count',    'n',     'count',    0,  true, 'accum', true,  5),
    (NEW.id, 'max_speed',                'Max Speed',       'km/h',  'speed',    1,  true, 'peak',  true,  6),
    (NEW.id, 'avg_speed',                'Avg Speed',       'km/h',  'speed',    1,  true, 'peak',  true,  7),
    (NEW.id, 'accelerations',            'Accelerations',   'n',     'count',    0,  true, 'accum', true,  8),
    (NEW.id, 'decelerations',            'Decelerations',   'n',     'count',    0,  true, 'accum', true,  9),
    (NEW.id, 'player_load',              'Player Load',     'AU',    'load',     1,  true, 'accum', true, 10),
    (NEW.id, 'hmld',                     'HMLD',            'm',     'load',     0,  true, 'accum', true, 11),
    (NEW.id, 'time_played',              'Time Played',     'min',   'time',     0,  true, 'accum', true, 12),
    (NEW.id, 'distance_per_minute',      'Distance / Min',  'm/min', 'distance', 1,  true, 'peak',  true, 13),
    (NEW.id, 'rpe',                      'RPE',             'AU',    'load',     1,  true, 'peak',  true, 14),
    (NEW.id, 'srpe',                     'Session Load (s-RPE)', 'AU', 'load',   0,  true, 'accum', true, 15)
  ON CONFLICT (club_id, key) DO NOTHING;
  RETURN NEW;
END;
$function$;
