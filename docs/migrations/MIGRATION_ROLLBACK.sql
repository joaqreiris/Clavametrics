-- ============================================================
-- ROLLBACK: Revertir migración Clavametrics Old → New Schema
-- ============================================================
-- ⚠️ ADVERTENCIA: Este script REVIERTE la migración.
-- Solo ejecutar si la migración falló o necesita revertirse completamente.
-- TIEMPO ESTIMADO: 30-60 minutos (depende de volumen de datos)
-- ============================================================

-- ============================================================
-- PASO 0: BACKUP ANTES DE ROLLBACK
-- ============================================================
-- ✅ IMPORTANTE: Hacer backup de tablas nuevas antes de revertir
-- Ejecutar en terminal:
-- \COPY (SELECT * FROM rpe) TO 'rpe_backup_rollback.csv' WITH (FORMAT csv, HEADER);
-- \COPY (SELECT * FROM gps_reports) TO 'gps_reports_backup_rollback.csv' WITH (FORMAT csv, HEADER);
-- \COPY (SELECT * FROM nutrition) TO 'nutrition_backup_rollback.csv' WITH (FORMAT csv, HEADER);

-- ============================================================
-- FASE ROLLBACK 1: REVERTIR MIGRACIONES DE DATOS
-- ============================================================

-- 1.1: REVERTIR players.status → availability (si se necesita)
-- Primero, restablecer availability table desde backup
-- Luego, borrar status de players
ALTER TABLE players
  DROP COLUMN IF EXISTS status;

-- 1.2: Borrar rpe table (creada en migration)
-- Primero, salvar datos si se necesitan
-- CREATE TABLE rpe_migration_backup AS SELECT * FROM rpe;
DROP TABLE IF EXISTS rpe CASCADE;

-- 1.3: Borrar gps_reports table (creada en migration)
-- CREATE TABLE gps_reports_migration_backup AS SELECT * FROM gps_reports;
DROP TABLE IF EXISTS gps_reports CASCADE;

-- 1.4: Borrar nutrition table (creada en migration)
-- CREATE TABLE nutrition_migration_backup AS SELECT * FROM nutrition;
DROP TABLE IF EXISTS nutrition CASCADE;

-- 1.5: Revertir cambios a evaluations (remover columnas añadidas)
ALTER TABLE evaluations
  DROP COLUMN IF EXISTS test_date,
  DROP COLUMN IF EXISTS value,
  DROP COLUMN IF EXISTS unit;

-- 1.6: Revertir cambios a players (remover columnas añadidas)
ALTER TABLE players
  DROP COLUMN IF EXISTS height,
  DROP COLUMN IF EXISTS weight,
  DROP COLUMN IF EXISTS dominant_foot;

-- ============================================================
-- FASE ROLLBACK 2: RESTABLECER TABLAS ANTIGUAS
-- ============================================================
-- Estas tablas fueron renombradas a _deprecated durante migración.
-- Reversionar al nombre original.

ALTER TABLE IF EXISTS rpe_sessions_deprecated RENAME TO rpe_sessions;
ALTER TABLE IF EXISTS athlete_sessions_deprecated RENAME TO athlete_sessions;
ALTER TABLE IF EXISTS nutrition_profiles_deprecated RENAME TO nutrition_profiles;
ALTER TABLE IF EXISTS nutrition_plans_deprecated RENAME TO nutrition_plans;
ALTER TABLE IF EXISTS weight_log_deprecated RENAME TO weight_log;
ALTER TABLE IF EXISTS availability_deprecated RENAME TO availability;

-- ============================================================
-- FASE ROLLBACK 3: RESTABLECER ÍNDICES ANTIGUOS
-- ============================================================

-- Índices para rpe_sessions (si fue recreado)
CREATE INDEX IF NOT EXISTS rpe_sessions_club_id_idx ON rpe_sessions(club_id);
CREATE INDEX IF NOT EXISTS rpe_sessions_player_id_idx ON rpe_sessions(player_id);
CREATE INDEX IF NOT EXISTS rpe_sessions_created_idx ON rpe_sessions(created_at DESC);

-- Índices para athlete_sessions
CREATE INDEX IF NOT EXISTS idx_athlete_sessions_club_date ON athlete_sessions(club_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_athlete_sessions_player ON athlete_sessions(club_id, player_name);

-- Índices para availability
CREATE INDEX IF NOT EXISTS idx_availability_club_player ON availability(club_id, player_id);

-- Índices para nutrition_profiles
CREATE INDEX IF NOT EXISTS idx_nutrition_profiles_club_player ON nutrition_profiles(club_id, player_id);

-- Índices para nutrition_plans
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_club_player ON nutrition_plans(club_id, player_id, day_type);

-- Índices para weight_log
CREATE INDEX IF NOT EXISTS idx_weight_log_club_player ON weight_log(club_id, player_id, log_date DESC);

-- ============================================================
-- FASE ROLLBACK 4: VALIDACIÓN
-- ============================================================

-- 4.1: Verificar que tablas antiguas fueron restauradas
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables
  WHERE table_name IN (
    'rpe_sessions', 'athlete_sessions', 'nutrition_profiles',
    'nutrition_plans', 'weight_log', 'availability'
  );
  
  RAISE NOTICE 'Rollback Status: % of 6 expected old tables exist', table_count;
  
  IF table_count != 6 THEN
    RAISE WARNING 'INCOMPLETE ROLLBACK: Not all old tables are present';
  ELSE
    RAISE NOTICE 'Old table structure successfully restored';
  END IF;
END $$;

-- 4.2: Verificar que tablas nuevas fueron eliminadas
DO $$
DECLARE
  new_table_count INT;
BEGIN
  SELECT COUNT(*) INTO new_table_count FROM information_schema.tables
  WHERE table_name IN ('rpe', 'gps_reports', 'nutrition');
  
  IF new_table_count > 0 THEN
    RAISE WARNING 'ROLLBACK INCOMPLETE: % new tables still exist', new_table_count;
  ELSE
    RAISE NOTICE 'New tables successfully removed';
  END IF;
END $$;

-- 4.3: Vacuumar y analizar para recuperar performance
VACUUM ANALYZE;

-- ============================================================
-- PASO FINAL: VALIDACIÓN MANUAL
-- ============================================================
-- ✅ VERIFICAR:
-- 1. Query en applicación con datos antiguos
-- 2. Confirmar que rpe_sessions devuelve datos
-- 3. Confirmar que athlete_sessions devuelve datos
-- 4. Confirmar que nutrition_profiles devuelve datos
-- 5. Monitorear logs de aplicación por errores de schema

-- ============================================================
-- ROLLBACK COMPLETADO
-- ============================================================

-- Log final
DO $$
BEGIN
  RAISE NOTICE '====== ROLLBACK COMPLETE ======';
  RAISE NOTICE 'Status: Schema reverted to pre-migration state';
  RAISE NOTICE 'Old tables restored: ✓';
  RAISE NOTICE 'New tables removed: ✓';
  RAISE NOTICE 'Next: Verify application with old schema';
  RAISE NOTICE '================================';
END $$;

