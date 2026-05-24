-- ============================================================
-- MIGRATION: Clavametrics Old → New Schema
-- ============================================================
-- IMPORTANTE: Ejecutar en orden exacto. Cada sección puede tomar tiempo.
-- Monitorear con: SELECT * FROM pg_stat_activity;
-- ============================================================

-- ============================================================
-- FASE 1: BACKUPS Y VALIDACIÓN (MANUAL)
-- ============================================================
-- ✅ TODO (MANUAL): Full database backup via Supabase dashboard
-- ✅ TODO (MANUAL): Export JSON backups of critical tables
-- ✅ TODO (MANUAL): Verify referential integrity with checks

-- Verificar integridad referencial ANTES de iniciar
DO $$
DECLARE
  orphan_count INT := 0;
BEGIN
  -- Check wellness records with missing players
  SELECT COUNT(*) INTO orphan_count
  FROM wellness w
  WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = w.player_id);
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN RECORDS FOUND: % wellness records with missing players', orphan_count;
  END IF;

  -- Check injuries with missing players
  SELECT COUNT(*) INTO orphan_count
  FROM injuries i
  WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = i.player_id);
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN RECORDS FOUND: % injury records with missing players', orphan_count;
  END IF;

  RAISE NOTICE 'Referential integrity check complete.';
END $$;

-- ============================================================
-- FASE 2: PREPARACIÓN - Agregar columnas nuevas
-- ============================================================
-- Duración: ~1 minuto (depende del tamaño de players)

-- 2.1: PLAYERS - Agregar nuevas columnas
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS height NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS dominant_foot TEXT CHECK (dominant_foot IN ('left', 'right', 'both')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available' CHECK (status IN ('available', 'injured', 'modified', 'unavailable'));

-- Crear índice para status (usado frecuentemente para filtros)
CREATE INDEX IF NOT EXISTS players_status_idx ON players(club_id, status);

-- 2.2: TRAINING_SESSIONS - Verificar estructura (sin cambios requeridos)
-- ✓ Esta tabla mantiene su estructura

-- 2.3: EVALUATIONS - Agregar columnas para normalización
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS test_date DATE,
  ADD COLUMN IF NOT EXISTS value NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- 2.4: CREAR TABLA rpe (nueva, renombrada de rpe_sessions)
CREATE TABLE IF NOT EXISTS rpe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  rpe NUMERIC(5,2) NOT NULL,
  duration INTEGER NOT NULL,
  load NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, session_id)
);

ALTER TABLE rpe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpe_all" ON rpe FOR ALL
  USING (
    player_id IN (
      SELECT id FROM players
      WHERE club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE INDEX IF NOT EXISTS rpe_player_id_idx ON rpe(player_id);
CREATE INDEX IF NOT EXISTS rpe_session_id_idx ON rpe(session_id);
CREATE INDEX IF NOT EXISTS rpe_created_idx ON rpe(created_at DESC);

-- 2.5: CREAR TABLA gps_reports (nueva)
CREATE TABLE IF NOT EXISTS gps_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  total_distance NUMERIC(10,2),
  high_speed_distance NUMERIC(10,2),
  sprint_distance NUMERIC(10,2),
  accelerations NUMERIC(10,2),
  decelerations NUMERIC(10,2),
  max_speed NUMERIC(10,2),
  player_load NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, session_id)
);

ALTER TABLE gps_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gps_reports_all" ON gps_reports FOR ALL
  USING (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE INDEX IF NOT EXISTS gps_reports_player_id_idx ON gps_reports(player_id);
CREATE INDEX IF NOT EXISTS gps_reports_session_id_idx ON gps_reports(session_id);
CREATE INDEX IF NOT EXISTS gps_reports_club_id_idx ON gps_reports(club_id);
CREATE INDEX IF NOT EXISTS gps_reports_created_idx ON gps_reports(created_at DESC);

-- 2.6: CREAR TABLA nutrition (nueva, consolidada)
CREATE TABLE IF NOT EXISTS nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  calories NUMERIC(10,2),
  protein NUMERIC(10,2),
  carbs NUMERIC(10,2),
  fats NUMERIC(10,2),
  hydration NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_all" ON nutrition FOR ALL
  USING (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE INDEX IF NOT EXISTS nutrition_player_id_idx ON nutrition(player_id);
CREATE INDEX IF NOT EXISTS nutrition_club_id_idx ON nutrition(club_id);
CREATE INDEX IF NOT EXISTS nutrition_created_idx ON nutrition(created_at DESC);

-- ============================================================
-- FASE 3: MIGRACIÓN DE DATOS
-- ============================================================
-- ADVERTENCIA: Esta fase puede tomar tiempo si hay muchos registros.
-- Monitor con: SELECT pg_sleep(5);

-- 3.1: MIGRAR availability → players.status
-- IMPORTANTE: availability debería tener registros con player_id. Si no, esta migración es vacía.
UPDATE players
SET status = 'injured'
WHERE id IN (SELECT player_id FROM availability WHERE status = 'injured')
  AND status = 'available';

UPDATE players
SET status = 'unavailable'
WHERE id IN (SELECT player_id FROM availability WHERE status = 'unavailable')
  AND status = 'available';

-- Log de migración
DO $$
DECLARE
  migrated_count INT;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM players WHERE status != 'available';
  RAISE NOTICE 'Migrated % player availability records', migrated_count;
END $$;

-- 3.2: MIGRAR rpe_sessions → rpe (copia de datos)
-- PASO 1: Copiar todos los registros
INSERT INTO rpe (id, player_id, session_id, rpe, duration, load, created_at)
SELECT id, player_id, session_id, rpe, duration, load, created_at
FROM rpe_sessions
ON CONFLICT (player_id, session_id) DO NOTHING;

-- PASO 2: Validar migración
DO $$
DECLARE
  old_count INT;
  new_count INT;
BEGIN
  SELECT COUNT(*) INTO old_count FROM rpe_sessions;
  SELECT COUNT(*) INTO new_count FROM rpe;
  RAISE NOTICE 'RPE Migration: old=%, new=%', old_count, new_count;
  IF old_count != new_count THEN
    RAISE WARNING 'RPE Count mismatch! Check for duplicate (player_id, session_id) pairs.';
  END IF;
END $$;

-- 3.3: MIGRAR athlete_sessions → gps_reports (COMPLEJA - requiere matching)
-- NOTA: Esta es una migración complicada. Requiere:
-- 1. Extraer metrics JSON
-- 2. Matchear player_name con players.first_name + last_name
-- 3. Matchear session_date con training_sessions

-- PASO 1: Crear tabla temporal para staging
CREATE TEMP TABLE gps_staging AS
SELECT
  gen_random_uuid() as id,
  NULL::UUID as player_id,
  NULL::UUID as session_id,
  (metrics->>'total_distance')::NUMERIC as total_distance,
  (metrics->>'high_speed_distance')::NUMERIC as high_speed_distance,
  (metrics->>'sprint_distance')::NUMERIC as sprint_distance,
  (metrics->>'accelerations')::NUMERIC as accelerations,
  (metrics->>'decelerations')::NUMERIC as decelerations,
  (metrics->>'max_speed')::NUMERIC as max_speed,
  (metrics->>'player_load')::NUMERIC as player_load,
  club_id,
  player_name,
  session_date,
  created_at
FROM athlete_sessions
WHERE metrics IS NOT NULL;

-- PASO 2: Resolver player_id mediante fuzzy matching
UPDATE gps_staging gs
SET player_id = p.id
FROM players p
WHERE gs.player_name ILIKE (p.first_name || ' ' || p.last_name)
  AND gs.club_id = p.club_id;

-- PASO 3: Resolver session_id
UPDATE gps_staging gs
SET session_id = ts.id
FROM training_sessions ts
WHERE gs.session_date = ts.session_date
  AND gs.club_id = ts.club_id
  AND gs.session_id IS NULL
LIMIT 1; -- Si múltiples sesiones en mismo día, solo tomar primera

-- PASO 4: Insert en gps_reports (solo registros con ambos IDs resueltos)
INSERT INTO gps_reports (
  id, player_id, session_id, club_id,
  total_distance, high_speed_distance, sprint_distance,
  accelerations, decelerations, max_speed, player_load, created_at
)
SELECT
  id, player_id, session_id, club_id,
  total_distance, high_speed_distance, sprint_distance,
  accelerations, decelerations, max_speed, player_load, created_at
FROM gps_staging
WHERE player_id IS NOT NULL AND session_id IS NOT NULL
ON CONFLICT (player_id, session_id) DO NOTHING;

-- PASO 5: Validar migración
DO $$
DECLARE
  matched INT;
  unmatched INT;
BEGIN
  SELECT COUNT(*) INTO matched FROM gps_reports;
  SELECT COUNT(*) INTO unmatched FROM gps_staging
  WHERE player_id IS NULL OR session_id IS NULL;
  RAISE NOTICE 'GPS Migration: matched=%, unmatched=%', matched, unmatched;
  IF unmatched > 0 THEN
    RAISE WARNING 'GPS: % records could not be matched (check athlete_sessions)';
  END IF;
END $$;

-- PASO 6: Limpiar tabla temporal
DROP TABLE IF EXISTS gps_staging;

-- 3.4: MIGRAR evaluations - Normalizar JSONB → columnas
-- PASO 1: Copiar date → test_date
UPDATE evaluations
SET test_date = date
WHERE test_date IS NULL AND date IS NOT NULL;

-- PASO 2: Extraer value del JSONB
-- Assumption: data tiene formato {'value': X}
UPDATE evaluations
SET value = (data->>'value')::NUMERIC
WHERE value IS NULL
  AND data->>'value' IS NOT NULL;

-- PASO 3: Extraer unit si existe
UPDATE evaluations
SET unit = data->>'unit'
WHERE unit IS NULL
  AND data->>'unit' IS NOT NULL;

-- PASO 4: Validar migración
DO $$
DECLARE
  with_values INT;
  without_values INT;
BEGIN
  SELECT COUNT(*) INTO with_values FROM evaluations WHERE value IS NOT NULL;
  SELECT COUNT(*) INTO without_values FROM evaluations WHERE value IS NULL;
  RAISE NOTICE 'Evaluations: with_values=%, without_values=%', with_values, without_values;
END $$;

-- 3.5: MIGRAR nutrition - Consolidar desde 3 tablas
-- ADVERTENCIA: Esta es destructiva. nutrition_profiles, nutrition_plans, weight_log se pierden.
-- PASO 1: Copiar datos de nutrition_profiles (si existen datos nutricionales simples)
-- Nota: nutrition_profiles tiene goals y targets, pero nutrition nueva solo tiene macros
-- Solo copiar weight si está disponible

-- Backup de datos nutricionales complejos (RECOMENDADO ANTES DE EJECUTAR)
-- EXECUTE: 
--   \COPY (SELECT * FROM nutrition_profiles) TO 'nutrition_profiles_backup.csv' WITH (FORMAT csv, HEADER);
--   \COPY (SELECT * FROM nutrition_plans) TO 'nutrition_plans_backup.csv' WITH (FORMAT csv, HEADER);

-- Insert básico (los datos nutricionales pertenecen a qué días?)
-- Por ahora, esta tabla estará vacía y se llenará manualmente desde el frontend

-- ============================================================
-- FASE 4: VALIDACIÓN POST-MIGRACIÓN
-- ============================================================

-- 4.1: Verificar integridad referencial en nuevas tablas
DO $$
DECLARE
  orphan_count INT := 0;
BEGIN
  -- Check rpe
  SELECT COUNT(*) INTO orphan_count FROM rpe
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = rpe.player_id);
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN RPE RECORDS: %', orphan_count;
  END IF;

  -- Check gps_reports
  SELECT COUNT(*) INTO orphan_count FROM gps_reports
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = gps_reports.player_id);
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN GPS RECORDS: %', orphan_count;
  END IF;

  -- Check nutrition
  SELECT COUNT(*) INTO orphan_count FROM nutrition
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = nutrition.player_id);
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN NUTRITION RECORDS: %', orphan_count;
  END IF;

  RAISE NOTICE 'Referential integrity validation complete';
END $$;

-- 4.2: Verificar índices
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO idx_count FROM pg_indexes
  WHERE tablename IN ('players', 'rpe', 'gps_reports', 'nutrition', 'evaluations');
  RAISE NOTICE 'Active indexes: %', idx_count;
END $$;

-- 4.3: Vacuum y analyze para optimizar queries
VACUUM ANALYZE players;
VACUUM ANALYZE rpe;
VACUUM ANALYZE gps_reports;
VACUUM ANALYZE nutrition;
VACUUM ANALYZE evaluations;

-- 4.4: Mostrar estadísticas finales
DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION STATISTICS ===';
  RAISE NOTICE 'Players: % records', (SELECT COUNT(*) FROM players);
  RAISE NOTICE 'RPE: % records', (SELECT COUNT(*) FROM rpe);
  RAISE NOTICE 'GPS Reports: % records', (SELECT COUNT(*) FROM gps_reports);
  RAISE NOTICE 'Nutrition: % records', (SELECT COUNT(*) FROM nutrition);
  RAISE NOTICE 'Evaluations: % records', (SELECT COUNT(*) FROM evaluations);
  RAISE NOTICE '============================';
END $$;

-- ============================================================
-- FASE 5: LIMPIEZA Y DEPRECACIÓN (EJECUTAR MANUALMENTE DESPUÉS DE VERIFICACIÓN)
-- ============================================================
-- ⚠️ NO EJECUTAR AUTOMÁTICAMENTE - Verificar aplicación primero

-- 5.1: Renombrar tablas antiguas (en caso de necesitar rollback rápido)
-- ALTER TABLE rpe_sessions RENAME TO rpe_sessions_deprecated;
-- ALTER TABLE athlete_sessions RENAME TO athlete_sessions_deprecated;
-- ALTER TABLE nutrition_profiles RENAME TO nutrition_profiles_deprecated;
-- ALTER TABLE nutrition_plans RENAME TO nutrition_plans_deprecated;
-- ALTER TABLE weight_log RENAME TO weight_log_deprecated;
-- ALTER TABLE availability RENAME TO availability_deprecated;

-- 5.2: Después de 24-48 horas de monitoreo, dropear tablas (si todo funciona)
-- DROP TABLE IF EXISTS rpe_sessions_deprecated;
-- DROP TABLE IF EXISTS athlete_sessions_deprecated;
-- DROP TABLE IF EXISTS nutrition_profiles_deprecated;
-- DROP TABLE IF EXISTS nutrition_plans_deprecated;
-- DROP TABLE IF EXISTS weight_log_deprecated;
-- DROP TABLE IF EXISTS availability_deprecated;

-- 5.3: Dropear tablas completamente obsoletas (después de verificación completa)
-- DROP TABLE IF EXISTS daily_plans;
-- DROP TABLE IF EXISTS gym_plans;
-- DROP TABLE IF EXISTS gym_exercises;
-- DROP TABLE IF EXISTS gym_groups;
-- DROP TABLE IF EXISTS gym_sections;
-- DROP TABLE IF EXISTS messages;
-- DROP TABLE IF EXISTS message_reads;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS club_data_sources;
-- DROP TABLE IF EXISTS dashboard_widgets;
-- DROP TABLE IF EXISTS microcycles;

-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================

