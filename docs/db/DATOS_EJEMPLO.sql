-- ============================================================
-- CLAVAMETRICS: Datos Iniciales de Prueba
-- ============================================================
-- Ejecutar DESPUÉS de SCHEMA_NUEVO_DESDE_CERO.sql
-- Para poblar la BD con datos de ejemplo para testing
-- ============================================================

-- ============================================================
-- 1. Crear datos de clubs de ejemplo
-- ============================================================
INSERT INTO public.clubs (name, logo_url, primary_color, secondary_color, country)
VALUES 
  ('MOI Kompong Dewa FC', 'https://example.com/logo-mkd.png', '#C9A84C', '#FFFFFF', 'Cambodia'),
  ('Sample FC', 'https://example.com/logo-sample.png', '#0066CC', '#FFFFFF', 'USA'),
  ('Test United', 'https://example.com/logo-test.png', '#FF0000', '#FFFFFF', 'UK')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Crear perfiles de usuarios de prueba
-- ============================================================
-- NOTA: Los usuarios deben existir en auth.users (Supabase Auth)
-- Estos son datos de ejemplo - reemplazar con UUIDs reales

-- Para crear usuarios reales, usar Supabase Dashboard:
-- 1. Authentication → Users
-- 2. Click "Add user"
-- 3. Email: coach@example.com, Password: [generated]
-- 4. Copiar el UUID generado
-- 5. Luego ejecutar el INSERT abajo

-- Ejemplo de estructura (comentado - requiere UUIDs reales):
/*
INSERT INTO public.profiles (id, club_id, email, full_name, role, created_at)
VALUES 
  ('USER_UUID_1', (SELECT id FROM clubs LIMIT 1), 'admin@mkd.com', 'Admin MKD', 'admin', NOW()),
  ('USER_UUID_2', (SELECT id FROM clubs LIMIT 1), 'coach@mkd.com', 'Coach Principal', 'coach', NOW()),
  ('USER_UUID_3', (SELECT id FROM clubs LIMIT 1), 'physio@mkd.com', 'Fisioterapeuta', 'physio', NOW()),
  ('USER_UUID_4', (SELECT id FROM clubs LIMIT 1), 'analyst@mkd.com', 'Analista', 'analyst', NOW()),
  ('USER_UUID_5', (SELECT id FROM clubs LIMIT 1), 'nutritionist@mkd.com', 'Nutricionista', 'nutritionist', NOW());
*/

-- ============================================================
-- 3. Crear jugadores de ejemplo
-- ============================================================
INSERT INTO public.players (
  club_id, first_name, last_name, position, date_of_birth, 
  nationality, height, weight, dominant_foot, status
)
SELECT 
  c.id,
  name_first,
  name_last,
  position,
  dob,
  nationality,
  height,
  weight,
  dominant_foot,
  'available'
FROM (
  VALUES
    ('Juan', 'García', 'Forward', '1998-03-15'::date, 'Spanish', 185.5::numeric, 78.0::numeric, 'right'),
    ('Carlos', 'López', 'Midfielder', '1999-07-22'::date, 'Spanish', 178.0::numeric, 72.0::numeric, 'left'),
    ('Miguel', 'Rodríguez', 'Defender', '1997-11-08'::date, 'Spanish', 187.0::numeric, 82.0::numeric, 'right'),
    ('Pedro', 'Martínez', 'Goalkeeper', '1996-05-30'::date, 'Spanish', 190.0::numeric, 88.0::numeric, 'left'),
    ('Diego', 'Fernández', 'Forward', '2000-02-14'::date, 'Spanish', 182.0::numeric, 76.0::numeric, 'right'),
    ('Alex', 'Sánchez', 'Midfielder', '1999-09-19'::date, 'Spanish', 176.0::numeric, 70.0::numeric, 'right'),
    ('Javier', 'Gómez', 'Defender', '1998-01-25'::date, 'Spanish', 186.0::numeric, 80.0::numeric, 'left'),
    ('Ricardo', 'Díaz', 'Forward', '2001-06-10'::date, 'Spanish', 181.0::numeric, 75.0::numeric, 'right')
) AS players_data(name_first, name_last, position, dob, nationality, height, weight, dominant_foot)
CROSS JOIN public.clubs c
WHERE c.name = 'MOI Kompong Dewa FC'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Crear sesiones de entrenamiento de ejemplo
-- ============================================================
INSERT INTO public.training_sessions (
  club_id, title, session_date, session_time, duration, session_type, location, notes
)
SELECT
  c.id,
  title,
  session_date,
  session_time,
  duration,
  session_type,
  location,
  notes
FROM (
  VALUES
    ('Entrenamiento Técnico', CURRENT_DATE, '10:00'::time, 90, 'tactical', 'Cancha Principal', 'Trabajo táctico pre-match'),
    ('Sesión de Fuerza', CURRENT_DATE - 1, '14:00'::time, 60, 'gym', 'Gimnasio', 'Upper body focus'),
    ('Recuperación Activa', CURRENT_DATE - 2, '10:30'::time, 30, 'recovery', 'Piscina', 'Light recovery session'),
    ('Acondicionamiento', CURRENT_DATE - 3, '15:00'::time, 45, 'conditioning', 'Cancha Principal', 'Fitness work'),
    ('Partido Amistoso', CURRENT_DATE + 2, '20:00'::time, 90, 'match', 'Estadio', 'Friendly match')
) AS sessions_data(title, session_date, session_time, duration, session_type, location, notes)
CROSS JOIN public.clubs c
WHERE c.name = 'MOI Kompong Dewa FC'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Crear wellness entries de ejemplo
-- ============================================================
INSERT INTO public.wellness (
  player_id, club_id, sleep_quality, fatigue, soreness, 
  stress, mood, readiness, submitted_at
)
SELECT
  p.id,
  p.club_id,
  (FLOOR(random() * 9) + 1)::INTEGER, -- 1-9
  (FLOOR(random() * 9) + 1)::INTEGER,
  (FLOOR(random() * 9) + 1)::INTEGER,
  (FLOOR(random() * 9) + 1)::INTEGER,
  (FLOOR(random() * 9) + 1)::INTEGER,
  (FLOOR(random() * 9) + 1)::INTEGER,
  NOW() - (random() * 7)::integer * INTERVAL '1 day'
FROM public.players p
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
LIMIT 30
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Crear algunas lesiones de ejemplo
-- ============================================================
INSERT INTO public.injuries (
  player_id, club_id, injury_type, body_area, severity, 
  status, start_date, expected_return, notes
)
SELECT
  p.id,
  p.club_id,
  'muscle',
  'Hamstring',
  'moderate',
  'recovery',
  CURRENT_DATE - 7,
  CURRENT_DATE + 7,
  'Strain from previous session'
FROM public.players p
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
LIMIT 2
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Crear datos de GPS de ejemplo
-- ============================================================
INSERT INTO public.gps_reports (
  player_id, session_id, club_id,
  total_distance, high_speed_distance, sprint_distance,
  accelerations, decelerations, max_speed, player_load, avg_speed
)
SELECT
  p.id,
  ts.id,
  p.club_id,
  5000 + random() * 2000,  -- 5000-7000m
  800 + random() * 400,     -- 800-1200m
  200 + random() * 300,     -- 200-500m
  30 + random() * 20,       -- 30-50
  25 + random() * 15,       -- 25-40
  24 + random() * 6,        -- 24-30 km/h
  500 + random() * 300,     -- 500-800
  6 + random() * 2          -- 6-8 km/h avg
FROM public.players p
CROSS JOIN public.training_sessions ts
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
  AND ts.club_id = p.club_id
  AND ts.session_type IN ('tactical', 'conditioning', 'match')
LIMIT 15
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. Crear datos RPE de ejemplo
-- ============================================================
INSERT INTO public.rpe (
  player_id, session_id, rpe, duration, load
)
SELECT
  p.id,
  ts.id,
  3 + random() * 7,  -- 3-10 RPE scale
  COALESCE(ts.duration, 60),
  NULL  -- Will be calculated by trigger
FROM public.players p
CROSS JOIN public.training_sessions ts
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
  AND ts.club_id = p.club_id
  AND ts.session_type IN ('tactical', 'conditioning', 'gym')
LIMIT 20
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Crear datos de evaluaciones de ejemplo
-- ============================================================
INSERT INTO public.evaluations (
  player_id, club_id, evaluation_type, test_date, value, unit, notes
)
SELECT
  p.id,
  p.club_id,
  eval_type,
  CURRENT_DATE - (random() * 30)::integer,
  CASE eval_type
    WHEN 'CMJ' THEN 50 + random() * 20
    WHEN 'sprint' THEN 3 + random() * 0.5
    WHEN 'vo2' THEN 50 + random() * 15
    WHEN 'strength' THEN 100 + random() * 50
    ELSE 75 + random() * 25
  END,
  CASE eval_type
    WHEN 'CMJ' THEN 'cm'
    WHEN 'sprint' THEN 'sec'
    WHEN 'vo2' THEN 'ml/kg/min'
    WHEN 'strength' THEN 'kg'
    ELSE 'points'
  END,
  'Baseline assessment'
FROM public.players p
CROSS JOIN (
  VALUES ('CMJ'), ('sprint'), ('vo2'), ('strength'), ('mobility')
) AS eval_types(eval_type)
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
LIMIT 40
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Crear datos de nutrición de ejemplo
-- ============================================================
INSERT INTO public.nutrition (
  player_id, club_id, log_date, calories, protein, carbs, fats, hydration, notes
)
SELECT
  p.id,
  p.club_id,
  CURRENT_DATE - (random() * 7)::integer,
  2500 + random() * 500,
  100 + random() * 30,
  350 + random() * 50,
  80 + random() * 20,
  3 + random() * 1,
  'Regular intake'
FROM public.players p
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
LIMIT 30
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. Crear datos de antropometría de ejemplo
-- ============================================================
INSERT INTO public.player_anthropometrics (
  player_id, club_id, measurement_date, weight, height, body_fat_pct, muscle_mass, notes
)
SELECT
  p.id,
  p.club_id,
  CURRENT_DATE - 30,
  p.weight,
  p.height,
  12 + random() * 8,  -- 12-20% body fat
  p.weight * 0.4,     -- Approx muscle mass
  'Initial measurement'
FROM public.players p
WHERE p.club_id = (SELECT id FROM clubs WHERE name = 'MOI Kompong Dewa FC')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. Crear mensajes de chat de ejemplo
-- ============================================================
INSERT INTO public.chat_messages (
  club_id, sender_id, sender_name, content, message_type
)
SELECT
  c.id,
  pr.id,
  pr.full_name,
  message,
  'text'
FROM public.clubs c
CROSS JOIN public.profiles pr
CROSS JOIN (
  VALUES
    ('Buenos días equipo, ¿preparados para el entreno?'),
    ('Todos deben traer hidratación extra hoy'),
    ('Buen trabajo en la última sesión'),
    ('Remember: Recovery is part of training'),
    ('Próximo partido en 3 días')
) AS messages(message)
WHERE c.name = 'MOI Kompong Dewa FC'
  AND pr.club_id = c.id
LIMIT 10
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. Crear tareas de ejemplo
-- ============================================================
INSERT INTO public.tasks (
  club_id, created_by, created_by_name, title, description,
  due_date, priority, status
)
SELECT
  c.id,
  pr.id,
  pr.full_name,
  title,
  description,
  due_date,
  priority,
  'pending'
FROM public.clubs c
CROSS JOIN public.profiles pr
CROSS JOIN (
  VALUES
    ('Evaluar CMJ de nuevos jugadores', 'Complete fitness testing', CURRENT_DATE + 7, 'high'),
    ('Actualizar planes nutricionales', 'Review and update nutrition plans', CURRENT_DATE + 14, 'medium'),
    ('Revisión de lesiones', 'Check injury status updates', CURRENT_DATE + 3, 'high'),
    ('Análisis de video de match', 'Review tactics from last match', CURRENT_DATE + 5, 'medium'),
    ('Planificación de semana', 'Plan training sessions', CURRENT_DATE + 1, 'urgent')
) AS tasks_data(title, description, due_date, priority)
WHERE c.name = 'MOI Kompong Dewa FC'
  AND pr.club_id = c.id
  AND pr.role = 'coach'
LIMIT 5
ON CONFLICT DO NOTHING;

-- ============================================================
-- ESTADÍSTICAS FINALES
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Test Data Initialization ✓';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Data inserted:';
  RAISE NOTICE '  ✓ Clubs: %', (SELECT COUNT(*) FROM clubs);
  RAISE NOTICE '  ✓ Players: %', (SELECT COUNT(*) FROM players);
  RAISE NOTICE '  ✓ Training Sessions: %', (SELECT COUNT(*) FROM training_sessions);
  RAISE NOTICE '  ✓ Wellness Entries: %', (SELECT COUNT(*) FROM wellness);
  RAISE NOTICE '  ✓ Injuries: %', (SELECT COUNT(*) FROM injuries);
  RAISE NOTICE '  ✓ GPS Reports: %', (SELECT COUNT(*) FROM gps_reports);
  RAISE NOTICE '  ✓ RPE Records: %', (SELECT COUNT(*) FROM rpe);
  RAISE NOTICE '  ✓ Evaluations: %', (SELECT COUNT(*) FROM evaluations);
  RAISE NOTICE '  ✓ Nutrition: %', (SELECT COUNT(*) FROM nutrition);
  RAISE NOTICE '  ✓ Chat Messages: %', (SELECT COUNT(*) FROM chat_messages);
  RAISE NOTICE '  ✓ Tasks: %', (SELECT COUNT(*) FROM tasks);
  RAISE NOTICE '  ✓ Anthropometrics: %', (SELECT COUNT(*) FROM player_anthropometrics);
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for testing ✓';
  RAISE NOTICE '====================================';
END $$;

