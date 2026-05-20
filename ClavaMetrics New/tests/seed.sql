-- ─────────────────────────────────────────────────────────────────────────────
-- ClavaMetrics — Test seed data
-- Club: RC Celta Testing
--
-- Run in Supabase SQL Editor with service-role key (bypasses RLS).
-- Fixed UUIDs are used for rows referenced by foreign keys so that
-- subsequent inserts can reference them directly.
-- gen_random_uuid() is used for leaf rows (wellness, rpe, gps, evals, nutrition).
--
-- FK insert order:
--   clubs → profiles → players → training_sessions
--   → injuries → wellness → rpe → gps_reports → evaluations → nutrition
--
-- To tear down: DELETE FROM clubs WHERE id = 'c3740000-0000-0000-0000-000000000001';
-- (CASCADE will remove all dependent rows.)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. CLUB ─────────────────────────────────────────────────────────────────

INSERT INTO clubs (id, name, primary_color, secondary_color, country, sport, plan)
VALUES (
  'c3740000-0000-0000-0000-000000000001',
  'RC Celta Testing',
  '#79A0C8',
  '#FFFFFF',
  'Spain',
  'football',
  'pro'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. PROFILES ─────────────────────────────────────────────────────────────
-- profiles.id must match an auth.users entry when RLS is active.
-- With service-role key these rows insert without an auth user (useful for testing).

INSERT INTO profiles (id, club_id, email, full_name, role, club_role, last_seen_at)
VALUES
  (
    'a1110000-0000-0000-0000-000000000001',
    'c3740000-0000-0000-0000-000000000001',
    'marcos.alonso@celta-test.es',
    'Marcos Alonso García',
    'coach',
    'Head Coach',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'a1110000-0000-0000-0000-000000000002',
    'c3740000-0000-0000-0000-000000000001',
    'laura.rodriguez@celta-test.es',
    'Laura Rodríguez Pena',
    'physio',
    'Head Physiotherapist',
    NOW() - INTERVAL '2 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 3. PLAYERS ──────────────────────────────────────────────────────────────
-- Statuses: available (6), modified (2), injured (2)
-- Positions: GK CB RB LB CDM CM CAM ST ST LW

INSERT INTO players (id, club_id, first_name, last_name, position, date_of_birth, nationality, height, weight, dominant_foot, status)
VALUES
  ('p1110000-0000-0000-0000-000000000001', 'c3740000-0000-0000-0000-000000000001', 'Óscar',  'Iglesias Rodríguez', 'GK',  '1994-03-15', 'Spanish',  188, 82, 'right', 'available'),
  ('p1110000-0000-0000-0000-000000000002', 'c3740000-0000-0000-0000-000000000001', 'Adrián', 'Mosquera López',     'CB',  '2002-05-20', 'Spanish',  185, 80, 'right', 'available'),
  ('p1110000-0000-0000-0000-000000000003', 'c3740000-0000-0000-0000-000000000001', 'Hugo',   'Álvarez García',     'RB',  '1999-11-08', 'Spanish',  179, 74, 'right', 'modified'),
  ('p1110000-0000-0000-0000-000000000004', 'c3740000-0000-0000-0000-000000000001', 'Javier', 'Mínguez Fernández',  'LB',  '1997-07-22', 'Spanish',  176, 73, 'left',  'available'),
  ('p1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 'Miguel', 'Torres Vega',        'CDM', '1998-09-04', 'Spanish',  181, 78, 'right', 'available'),
  ('p1110000-0000-0000-0000-000000000006', 'c3740000-0000-0000-0000-000000000001', 'Sergio', 'Carballo Paz',       'CM',  '2001-02-14', 'Spanish',  177, 72, 'right', 'available'),
  ('p1110000-0000-0000-0000-000000000007', 'c3740000-0000-0000-0000-000000000001', 'Brais',  'Cernadas Núñez',     'CAM', '2000-06-30', 'Spanish',  175, 71, 'right', 'injured'),
  ('p1110000-0000-0000-0000-000000000008', 'c3740000-0000-0000-0000-000000000001', 'Lucas',  'Buydens Alonso',     'ST',  '2003-01-17', 'Belgian',  186, 82, 'right', 'available'),
  ('p1110000-0000-0000-0000-000000000009', 'c3740000-0000-0000-0000-000000000001', 'Iker',   'Beltrán González',   'ST',  '1996-10-11', 'Spanish',  183, 79, 'right', 'modified'),
  ('p1110000-0000-0000-0000-000000000010', 'c3740000-0000-0000-0000-000000000001', 'Diego',  'Domínguez Soto',     'LW',  '2004-08-25', 'Spanish',  174, 69, 'left',  'injured')
ON CONFLICT (id) DO NOTHING;

-- ─── 4. TRAINING SESSIONS ────────────────────────────────────────────────────
-- Types: tactical / gym / recovery / conditioning / match

INSERT INTO training_sessions (id, club_id, title, session_date, session_time, duration, session_type, coach_id, location, notes)
VALUES
  (
    's1110000-0000-0000-0000-000000000001',
    'c3740000-0000-0000-0000-000000000001',
    'Trabajo táctico defensivo',
    CURRENT_DATE - 5, '10:00', 90, 'tactical',
    'a1110000-0000-0000-0000-000000000001',
    'Ciudad Deportiva A Madroa',
    'Presión alta y salida de balón desde portería. Bloques de 4v4+2 y 8v8 posicional.'
  ),
  (
    's1110000-0000-0000-0000-000000000002',
    'c3740000-0000-0000-0000-000000000001',
    'Fuerza y potencia en sala',
    CURRENT_DATE - 4, '09:00', 60, 'gym',
    'a1110000-0000-0000-0000-000000000001',
    'Gimnasio A Madroa',
    'Fuerza máxima: sentadilla trasera y peso muerto. Series 4x4 al 85% 1RM.'
  ),
  (
    's1110000-0000-0000-0000-000000000003',
    'c3740000-0000-0000-0000-000000000001',
    'Recuperación activa post-partido',
    CURRENT_DATE - 3, '11:00', 45, 'recovery',
    'a1110000-0000-0000-0000-000000000001',
    'Piscina A Madroa',
    'Regeneración en piscina, movilidad articular y estiramientos asistidos.'
  ),
  (
    's1110000-0000-0000-0000-000000000004',
    'c3740000-0000-0000-0000-000000000001',
    'Resistencia aeróbica MD-3',
    CURRENT_DATE - 2, '10:00', 75, 'conditioning',
    'a1110000-0000-0000-0000-000000000001',
    'Campo de Balaídos',
    'Bloque aeróbico: rondos de posesión y carrera continua por encima del umbral aeróbico.'
  ),
  (
    's1110000-0000-0000-0000-000000000005',
    'c3740000-0000-0000-0000-000000000001',
    'Partido de entrenamiento 11v11',
    CURRENT_DATE - 1, '11:00', 120, 'match',
    'a1110000-0000-0000-0000-000000000001',
    'Campo de Balaídos',
    'Amistoso interno para evaluar automatismos ofensivos y presión en bloque alto.'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 5. INJURIES ─────────────────────────────────────────────────────────────
-- active (2) → players 7, 10 (status: injured)
-- recovery (2) → players 3, 9 (status: modified)
-- cleared (1) → player 2 (status: available, historical)

INSERT INTO injuries (id, player_id, club_id, injury_type, body_area, severity, status, start_date, expected_return, returned_date, treatment, notes)
VALUES
  (
    'i1110000-0000-0000-0000-000000000001',
    'p1110000-0000-0000-0000-000000000007',
    'c3740000-0000-0000-0000-000000000001',
    'muscle', 'Isquiotibial derecho', 'severe', 'active',
    CURRENT_DATE - 14, CURRENT_DATE + 10, NULL,
    'Reposo relativo, fisioterapia diaria y crioterapia',
    'Rotura de grado II confirmada por ecografía. Sin participación en sesiones grupales.'
  ),
  (
    'i1110000-0000-0000-0000-000000000002',
    'p1110000-0000-0000-0000-000000000010',
    'c3740000-0000-0000-0000-000000000001',
    'joint', 'Tobillo izquierdo', 'moderate', 'active',
    CURRENT_DATE - 7, CURRENT_DATE + 5, NULL,
    'Electroterapia, vendaje funcional y propioceptivo',
    'Esguince grado I tras contacto en entrenamiento. Carga progresiva en piscina.'
  ),
  (
    'i1110000-0000-0000-0000-000000000003',
    'p1110000-0000-0000-0000-000000000003',
    'c3740000-0000-0000-0000-000000000001',
    'muscle', 'Cuádriceps izquierdo', 'minor', 'recovery',
    CURRENT_DATE - 10, CURRENT_DATE + 2, NULL,
    'Fortalecimiento excéntrico, cardio de bajo impacto en bicicleta',
    'Sobrecarga muscular sin rotura confirmada. Entrenamiento adaptado sin carrera.'
  ),
  (
    'i1110000-0000-0000-0000-000000000004',
    'p1110000-0000-0000-0000-000000000009',
    'c3740000-0000-0000-0000-000000000001',
    'muscle', 'Gemelo derecho', 'minor', 'recovery',
    CURRENT_DATE - 6, CURRENT_DATE + 1, NULL,
    'Masaje terapéutico, trabajo propioceptivo y estiramientos',
    'Distensión de bajo grado. Participa en sesiones modificadas sin sprint.'
  ),
  (
    'i1110000-0000-0000-0000-000000000005',
    'p1110000-0000-0000-0000-000000000002',
    'c3740000-0000-0000-0000-000000000001',
    'bone', 'Quinto metatarsiano derecho', 'moderate', 'cleared',
    CURRENT_DATE - 45, CURRENT_DATE - 5, CURRENT_DATE - 5,
    'Inmovilización 3 semanas y fisioterapia de reintegración progresiva',
    'Alta médica confirmada. Reintegración total completada sin limitaciones.'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 6. WELLNESS ─────────────────────────────────────────────────────────────
-- 10 entries, last 7 days, 6 different players
-- Scale 1–10: higher = better (readiness, sleep, mood); lower = better (fatigue, soreness, stress)

INSERT INTO wellness (id, player_id, club_id, sleep_quality, fatigue, soreness, stress, mood, readiness, notes, submitted_at)
VALUES
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000001', 'c3740000-0000-0000-0000-000000000001', 8, 2, 2, 2, 9, 9, NULL,                                           CURRENT_DATE - 6),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000002', 'c3740000-0000-0000-0000-000000000001', 7, 3, 3, 3, 7, 7, 'Algo de cansancio acumulado de la semana',    CURRENT_DATE - 5),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 9, 1, 1, 1, 10, 10, NULL,                                          CURRENT_DATE - 5),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000006', 'c3740000-0000-0000-0000-000000000001', 6, 5, 4, 4, 6, 6, 'Piernas cargadas tras el bloque de fuerza',    CURRENT_DATE - 4),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000008', 'c3740000-0000-0000-0000-000000000001', 8, 3, 3, 2, 8, 8, NULL,                                           CURRENT_DATE - 4),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000004', 'c3740000-0000-0000-0000-000000000001', 7, 4, 4, 3, 7, 7, NULL,                                           CURRENT_DATE - 3),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000001', 'c3740000-0000-0000-0000-000000000001', 9, 2, 1, 1, 9, 9, NULL,                                           CURRENT_DATE - 2),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 8, 3, 3, 2, 8, 8, NULL,                                           CURRENT_DATE - 2),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000006', 'c3740000-0000-0000-0000-000000000001', 7, 4, 5, 3, 7, 7, 'Sensación de piernas pesadas, algo de agujetas', CURRENT_DATE - 1),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000008', 'c3740000-0000-0000-0000-000000000001', 8, 2, 2, 2, 9, 9, NULL,                                           CURRENT_DATE - 1);

-- ─── 7. RPE ──────────────────────────────────────────────────────────────────
-- 10 entries across all 5 sessions, various players
-- load = rpe * duration (trigger may recompute this in production)

INSERT INTO rpe (id, player_id, session_id, club_id, rpe, duration, load, notes)
VALUES
  -- Tactical session (s1) — 2 entries
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000001', 's1110000-0000-0000-0000-000000000001', 'c3740000-0000-0000-0000-000000000001', 7, 90,  630,  NULL),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000002', 's1110000-0000-0000-0000-000000000001', 'c3740000-0000-0000-0000-000000000001', 6, 90,  540,  NULL),
  -- Gym session (s2) — 2 entries
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000005', 's1110000-0000-0000-0000-000000000002', 'c3740000-0000-0000-0000-000000000001', 8, 60,  480,  'Trabajo intenso de fuerza máxima'),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000006', 's1110000-0000-0000-0000-000000000002', 'c3740000-0000-0000-0000-000000000001', 7, 60,  420,  NULL),
  -- Recovery session (s3) — 2 entries
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000004', 's1110000-0000-0000-0000-000000000003', 'c3740000-0000-0000-0000-000000000001', 3, 45,  135,  NULL),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000008', 's1110000-0000-0000-0000-000000000003', 'c3740000-0000-0000-0000-000000000001', 3, 45,  135,  NULL),
  -- Conditioning session (s4) — 2 entries
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000001', 's1110000-0000-0000-0000-000000000004', 'c3740000-0000-0000-0000-000000000001', 6, 75,  450,  NULL),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000005', 's1110000-0000-0000-0000-000000000004', 'c3740000-0000-0000-0000-000000000001', 7, 75,  525,  NULL),
  -- Match session (s5) — 2 entries
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000006', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 8, 120, 960,  'Buen ritmo durante todo el partido'),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000008', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 9, 120, 1080, 'Participación completa; presión alta sostenida');

-- ─── 8. GPS REPORTS ──────────────────────────────────────────────────────────
-- 5 entries, all linked to the 11v11 match session (s5)
-- Distances in metres, speeds in km/h, player_load arbitrary units

INSERT INTO gps_reports (id, player_id, session_id, club_id, total_distance, high_speed_distance, sprint_distance, accelerations, decelerations, max_speed, player_load, avg_speed)
VALUES
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000001', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001',  6820,  380, 145, 28, 31, 24.1,  810, 10.2),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000002', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 10450, 1120, 430, 42, 38, 30.8, 1240, 14.6),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000005', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 11230,  980, 360, 51, 47, 29.3, 1350, 15.2),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000006', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 10870, 1050, 395, 48, 44, 30.2, 1290, 14.9),
  (gen_random_uuid(), 'p1110000-0000-0000-0000-000000000008', 's1110000-0000-0000-0000-000000000005', 'c3740000-0000-0000-0000-000000000001', 11640, 1380, 510, 55, 49, 33.4, 1420, 15.8);

-- ─── 9. EVALUATIONS ──────────────────────────────────────────────────────────
-- CMJ (cm), sprint 30m (s), VO2max (ml/kg/min)

INSERT INTO evaluations (id, player_id, club_id, evaluation_type, test_date, value, unit, notes)
VALUES
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000005',
    'c3740000-0000-0000-0000-000000000001',
    'CMJ', CURRENT_DATE - 3, 42.8, 'cm',
    'Plataforma de fuerza Kistler. Mejor de 3 intentos con 3 min de recuperación.'
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000008',
    'c3740000-0000-0000-0000-000000000001',
    'sprint', CURRENT_DATE - 3, 4.18, 's',
    'Sprint 30m con fotocélulas Smartspeed. Mejor marca de 3 intentos.'
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000006',
    'c3740000-0000-0000-0000-000000000001',
    'vo2', CURRENT_DATE - 10, 59.2, 'ml/kg/min',
    'Test Vam-Eval en campo. Estimación indirecta a partir de velocidad aeróbica máxima.'
  );

-- ─── 10. NUTRITION ───────────────────────────────────────────────────────────
-- 7 entries, 5 players, last 4 days
-- calories kcal · protein/carbs/fats in grams · hydration in litres

INSERT INTO nutrition (id, player_id, club_id, log_date, calories, protein, carbs, fats, hydration, notes)
VALUES
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000001',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 4, 2850, 185, 310, 78, 3.2,
    'Carga de hidratos previa a la sesión táctica del día siguiente.'
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000002',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 4, 3100, 200, 340, 85, 3.5,
    NULL
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000005',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 3, 3200, 210, 360, 88, 3.8,
    'Post sesión de fuerza. Énfasis en proteínas y ventana anabólica de 30 min.'
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000006',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 3, 2950, 190, 320, 80, 3.3,
    NULL
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000008',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 2, 3350, 220, 375, 90, 4.0,
    'Carga máxima 24h antes del partido de entrenamiento.'
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000004',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 2, 2700, 175, 295, 72, 3.0,
    NULL
  ),
  (
    gen_random_uuid(),
    'p1110000-0000-0000-0000-000000000001',
    'c3740000-0000-0000-0000-000000000001',
    CURRENT_DATE - 1, 2600, 170, 275, 68, 2.8,
    'Día de recuperación. Ingesta reducida; sin entrenamiento de fuerza.'
  );

COMMIT;
