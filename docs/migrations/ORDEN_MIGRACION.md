# ORDEN CORRECTO DE MIGRACIÓN

**Fecha**: 19 de mayo de 2026  
**Documento**: Secuencia paso a paso para migración  
**Duración Estimada**: 4-6 horas (depende de volumen de datos)

---

## ✅ PRE-MIGRACIÓN (Manual - Día antes)

### 1. Backups Completos

```bash
# Backup vía Supabase dashboard
# 1. Ir a: https://app.supabase.com → Backups
# 2. Click "Create Backup" 
# 3. Esperar ~30 minutos hasta que complete
# 4. Guardar backup URL

# Backup local de tablas críticas
for table in players wellness injuries training_sessions rpe_sessions \
             athlete_sessions nutrition_profiles nutrition_plans weight_log \
             evaluations gym_exercises gym_plans availability; do
  
  psql -h $DB_HOST -U $DB_USER -d clavametrics \
    -c "\\COPY (SELECT * FROM $table) TO STDOUT WITH (FORMAT csv, HEADER)" \
    > ./backups/pre_migration_${table}_$(date +%Y%m%d).csv
done

# Backup de definiciones
psql -h $DB_HOST -U $DB_USER -d clavametrics \
  -c "\\COPY (SELECT * FROM pg_tables WHERE schemaname = 'public') \
      TO STDOUT WITH (FORMAT csv, HEADER)" \
  > ./backups/pre_migration_schema_$(date +%Y%m%d).csv
```

### 2. Verificación de Integridad

```bash
# Script de validación PRE-migración
psql -h $DB_HOST -U $DB_USER -d clavametrics << 'EOF'

-- Verificar que no hay registros huérfanos
DO $$
DECLARE
  orphan_count INT := 0;
BEGIN
  -- Check wellness
  SELECT COUNT(*) INTO orphan_count FROM wellness 
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = wellness.player_id);
  RAISE NOTICE 'Orphan wellness: %', orphan_count;

  -- Check injuries
  SELECT COUNT(*) INTO orphan_count FROM injuries 
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = injuries.player_id);
  RAISE NOTICE 'Orphan injuries: %', orphan_count;

  -- Check RPE
  SELECT COUNT(*) INTO orphan_count FROM rpe_sessions 
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = rpe_sessions.player_id)
    OR NOT EXISTS (SELECT 1 FROM training_sessions WHERE id = rpe_sessions.session_id);
  RAISE NOTICE 'Orphan RPE: %', orphan_count;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found orphan records. Investigate before proceeding!';
  ELSE
    RAISE NOTICE 'All referential integrity checks PASSED ✓';
  END IF;
END $$;

EOF
```

### 3. Comunicación a Equipo

```bash
# Notificar a equipo dev
echo "Sending notification..."

# Enlazar documentos
echo "Migration docs ready:"
echo "- SCHEMA_COMPARISON.md (análisis)"
echo "- MIGRATION_FORWARD.sql (scripts)"
echo "- MIGRATION_ROLLBACK.sql (plan revertir)"
echo "- MIGRATION_RISKS.md (riesgos)"
echo "- ORDEN_MIGRACION.md (este archivo)"

# Confirmar:
# ✓ Código actualizado para nuevos nombres de columnas
# ✓ Vistas de compatibilidad creadas (si necesario)
# ✓ Equipo de soporte notificado
```

---

## 🚀 MIGRACIÓN (Ejecutar en orden exacto)

### FASE 1: Validación Pre-Flight (5 min)

```bash
# 1.1: Conectar a BD de staging/producción
export DB_HOST=db.supabase.co
export DB_PORT=5432
export DB_NAME=clavametrics
export DB_USER=postgres

# 1.2: Test conexión
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"

# 1.3: Obtener estadísticas pre-migración
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
SELECT 
  'players' as table_name, COUNT(*) as record_count FROM players
UNION ALL SELECT 'wellness', COUNT(*) FROM wellness
UNION ALL SELECT 'injuries', COUNT(*) FROM injuries
UNION ALL SELECT 'rpe_sessions', COUNT(*) FROM rpe_sessions
UNION ALL SELECT 'athlete_sessions', COUNT(*) FROM athlete_sessions
UNION ALL SELECT 'nutrition_profiles', COUNT(*) FROM nutrition_profiles
UNION ALL SELECT 'evaluations', COUNT(*) FROM evaluations
ORDER BY table_name;
EOF

# Guardar salida como pre_stats.txt para comparación post-migración
```

### FASE 2: Preparación - Agregar Columnas Nuevas (15 min)

**Objetivo**: Agregar columnas nuevas sin mover datos aún.

```sql
-- Conectar a BD
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

-- 2.1 PLAYERS: Agregar columnas
BEGIN TRANSACTION;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS height NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS dominant_foot TEXT 
    CHECK (dominant_foot IN ('left', 'right', 'both')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available' 
    CHECK (status IN ('available', 'injured', 'modified', 'unavailable'));

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS players_status_idx ON players(club_id, status);
CREATE INDEX IF NOT EXISTS players_height_idx ON players(height);

-- Validación
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='players' AND column_name IN ('height', 'weight', 'dominant_foot', 'status');

COMMIT;

-- 2.2 EVALUATIONS: Agregar columnas para normalización
BEGIN TRANSACTION;

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS test_date DATE,
  ADD COLUMN IF NOT EXISTS value NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- Validación
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='evaluations' AND column_name IN ('test_date', 'value', 'unit');

COMMIT;

-- 2.3 Crear tabla RPE nueva
BEGIN TRANSACTION;

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

-- Validación
SELECT COUNT(*) FROM rpe;  -- Debe ser 0

COMMIT;

-- 2.4 Crear tabla GPS_REPORTS nueva
BEGIN TRANSACTION;

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

-- Validación
SELECT COUNT(*) FROM gps_reports;  -- Debe ser 0

COMMIT;

-- 2.5 Crear tabla NUTRITION nueva
BEGIN TRANSACTION;

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

-- Validación
SELECT COUNT(*) FROM nutrition;  -- Debe ser 0

COMMIT;
```

### FASE 3: Migración de Datos (90-120 min)

**Objetivo**: Copiar datos de tablas antiguas a nuevas.

```sql
-- 3.1 MIGRAR availability → players.status
BEGIN TRANSACTION;
  
UPDATE players
SET status = 'injured'
WHERE id IN (SELECT DISTINCT player_id FROM availability WHERE status = 'injured')
  AND status = 'available';

UPDATE players
SET status = 'unavailable'
WHERE id IN (SELECT DISTINCT player_id FROM availability WHERE status = 'unavailable')
  AND status = 'available';

-- Verificación
SELECT COUNT(DISTINCT player_id) as players_with_status
FROM players WHERE status != 'available';

COMMIT;

-- 3.2 MIGRAR rpe_sessions → rpe (copia masiva)
BEGIN TRANSACTION;

-- Copiar datos
INSERT INTO rpe (id, player_id, session_id, rpe, duration, load, created_at)
SELECT id, player_id, session_id, rpe, duration, load, created_at
FROM rpe_sessions
ON CONFLICT (player_id, session_id) DO NOTHING;

-- Verificación de conteos
DO $$
DECLARE
  old_count INT := (SELECT COUNT(*) FROM rpe_sessions);
  new_count INT := (SELECT COUNT(*) FROM rpe);
BEGIN
  RAISE NOTICE 'RPE Migration: old_count=%, new_count=%', old_count, new_count;
  IF old_count = new_count THEN
    RAISE NOTICE '✓ RPE migration successful';
  ELSE
    RAISE WARNING '⚠ RPE count mismatch - investigate!';
  END IF;
END $$;

COMMIT;

-- 3.3 MIGRAR athlete_sessions → gps_reports (COMPLEJA)
BEGIN TRANSACTION;

-- Paso 1: Crear tabla staging
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

-- Paso 2: Resolver player_id
UPDATE gps_staging gs
SET player_id = p.id
FROM players p
WHERE gs.player_name ILIKE CONCAT(p.first_name, ' ', p.last_name)
  AND gs.club_id = p.club_id;

-- Paso 3: Resolver session_id (tomar primera sesión si hay múltiples)
UPDATE gps_staging gs
SET session_id = (
  SELECT id FROM training_sessions ts
  WHERE gs.session_date = ts.session_date
    AND gs.club_id = ts.club_id
  LIMIT 1
)
WHERE gs.session_id IS NULL;

-- Paso 4: Insert en gps_reports
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

-- Paso 5: Auditoría de unmatched records
INSERT INTO gps_migration_unmatched (player_name, session_date, reason)
SELECT 
  player_name, 
  session_date,
  CASE 
    WHEN player_id IS NULL THEN 'Player not found'
    WHEN session_id IS NULL THEN 'Session not found'
    ELSE 'Unknown'
  END
FROM gps_staging
WHERE player_id IS NULL OR session_id IS NULL;

-- Verificación
DO $$
DECLARE
  matched INT := (SELECT COUNT(*) FROM gps_reports);
  unmatched INT := (SELECT COUNT(*) FROM gps_migration_unmatched);
BEGIN
  RAISE NOTICE 'GPS Migration: matched=%, unmatched=%', matched, unmatched;
  IF unmatched > 0 THEN
    RAISE WARNING '⚠ % GPS records could not be matched', unmatched;
  END IF;
END $$;

COMMIT;

-- 3.4 MIGRAR evaluations - Normalizar JSONB
BEGIN TRANSACTION;

-- Copiar dates
UPDATE evaluations
SET test_date = date
WHERE test_date IS NULL AND date IS NOT NULL;

-- Extraer values
UPDATE evaluations
SET value = (data->>'value')::NUMERIC,
    unit = COALESCE(data->>'unit', 'unknown')
WHERE value IS NULL AND data->>'value' IS NOT NULL;

-- Verificación
DO $$
BEGIN
  RAISE NOTICE 'Evaluations with values: %', (SELECT COUNT(*) FROM evaluations WHERE value IS NOT NULL);
  RAISE NOTICE 'Evaluations without values: %', (SELECT COUNT(*) FROM evaluations WHERE value IS NULL);
END $$;

COMMIT;

-- 3.5 NUTRITION - Tabla nueva (vacía inicialmente)
-- Los datos nutricionales se migran desde:
-- - nutrition_profiles (goals, targets)
-- - nutrition_plans (meals)
-- - weight_log (histórico)
-- Por ahora, esta tabla está vacía y se llenará desde frontend

-- (Opcionalmente) Crear tabla de respaldo
CREATE TABLE nutrition_data_backup AS
SELECT 'profiles' as source, np.* FROM nutrition_profiles np
UNION ALL
SELECT 'plans', np.* FROM nutrition_plans np
UNION ALL
SELECT 'weight', wl.* FROM weight_log wl;

COMMIT;
```

### FASE 4: Validación Post-Migración (20 min)

```sql
-- 4.1 Verificar integridad referencial
DO $$
DECLARE
  orphan_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM rpe
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = rpe.player_id);
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN RPE RECORDS: %', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count FROM gps_reports
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = gps_reports.player_id);
  IF orphan_count > 0 THEN
    RAISE WARNING 'ORPHAN GPS RECORDS: %', orphan_count;
  END IF;

  RAISE NOTICE '✓ Referential integrity validation complete';
END $$;

-- 4.2 Comparar conteos pre/post migración
SELECT 'players' as table_name, COUNT(*) as record_count FROM players
UNION ALL SELECT 'wellness', COUNT(*) FROM wellness
UNION ALL SELECT 'injuries', COUNT(*) FROM injuries
UNION ALL SELECT 'rpe', COUNT(*) FROM rpe
UNION ALL SELECT 'gps_reports', COUNT(*) FROM gps_reports
UNION ALL SELECT 'nutrition', COUNT(*) FROM nutrition
UNION ALL SELECT 'evaluations', COUNT(*) FROM evaluations
ORDER BY table_name;

-- 4.3 Verificar índices
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('players', 'rpe', 'gps_reports', 'nutrition')
ORDER BY tablename;

-- 4.4 VACUUM y ANALYZE
VACUUM ANALYZE players;
VACUUM ANALYZE rpe;
VACUUM ANALYZE gps_reports;
VACUUM ANALYZE nutrition;
VACUUM ANALYZE evaluations;

-- 4.5 Test de queries críticas
-- Test RLS
SELECT * FROM rpe LIMIT 1;
SELECT * FROM gps_reports LIMIT 1;
SELECT * FROM nutrition LIMIT 1;

-- Test de joins
SELECT p.first_name, r.rpe 
FROM rpe r 
JOIN players p ON r.player_id = p.id 
LIMIT 5;

-- Test de performance
EXPLAIN ANALYZE SELECT * FROM rpe WHERE player_id = (SELECT id FROM players LIMIT 1);
EXPLAIN ANALYZE SELECT * FROM gps_reports WHERE club_id = (SELECT id FROM clubs LIMIT 1);
```

### FASE 5: Deprecación de Tablas Antiguas (Manual - Día siguiente)

```sql
-- SOLO después de 24 horas de monitoreo exitoso

-- 5.1 Renombrar tablas antiguas (fase 1 de deprecación)
BEGIN TRANSACTION;

ALTER TABLE rpe_sessions RENAME TO rpe_sessions_deprecated;
ALTER TABLE athlete_sessions RENAME TO athlete_sessions_deprecated;
ALTER TABLE nutrition_profiles RENAME TO nutrition_profiles_deprecated;
ALTER TABLE nutrition_plans RENAME TO nutrition_plans_deprecated;
ALTER TABLE weight_log RENAME TO weight_log_deprecated;
ALTER TABLE availability RENAME TO availability_deprecated;

COMMIT;

-- 5.2 Después de 7 días de operación exitosa, dropear
-- (ESTE PASO NO SE DEBE HACER HASTA CONFIRMAR QUE TODO FUNCIONA)
-- DROP TABLE IF EXISTS rpe_sessions_deprecated;
-- DROP TABLE IF EXISTS athlete_sessions_deprecated;
-- DROP TABLE IF EXISTS nutrition_profiles_deprecated;
-- DROP TABLE IF EXISTS nutrition_plans_deprecated;
-- DROP TABLE IF EXISTS weight_log_deprecated;
-- DROP TABLE IF EXISTS availability_deprecated;
```

---

## 📊 Monitoreo Durante Migración

```bash
# Terminal 1: Monitorear progreso
watch -n 5 'psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT pg_stat_activity.pid, query, state FROM pg_stat_activity 
   WHERE query ILIKE '%COPY%' OR query ILIKE '%INSERT%' OR query ILIKE '%UPDATE%';"'

# Terminal 2: Monitorear tamaño BD
watch -n 10 'psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) 
   FROM pg_database WHERE datname = current_database();"'

# Terminal 3: Monitorear conexiones
watch -n 5 'psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"'
```

---

## ✅ Verificación Post-Migración (24 horas después)

```bash
# Script de smoke tests
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'

-- 1. Verificar que aplicación puede conectar y hacer queries
SELECT 'App connectivity test' as test, COUNT(*) as result FROM players;
SELECT 'RPE data accessible' as test, COUNT(*) FROM rpe;
SELECT 'GPS data accessible' as test, COUNT(*) FROM gps_reports;

-- 2. Verificar RLS está funcionando
SET ROLE authenticated;
SET role jwt.claims ->> 'sub' to 'user-uuid';
SELECT COUNT(*) FROM players;  -- Debería estar limitado por club_id

-- 3. Verificar que queries antiguas que referenciaban tablas deletedas dan error
-- (Esto es intencional - código debe ser actualizado)
-- SELECT * FROM rpe_sessions;  -- Debería dar error: table doesn't exist

-- 4. Performance check
EXPLAIN ANALYZE SELECT * FROM rpe WHERE player_id IS NOT NULL LIMIT 100;
EXPLAIN ANALYZE SELECT * FROM gps_reports WHERE club_id IS NOT NULL LIMIT 100;

EOF
```

---

## 🚨 Si Algo Sale Mal

### Signos de Problema

```
❌ Queries lentas (>5 segundos)
❌ Memory usage muy alto (>80%)
❌ Conexiones pendientes sin completar
❌ Orphan records encontrados
❌ Índices no creados
```

### Acción Inmediata: ROLLBACK

```bash
# Si la migración falla:
# 1. Detener queries: COMMIT TRANSACTION inmediatamente
# 2. Ejecutar MIGRATION_ROLLBACK.sql
# 3. Verificar que datos son correctos
# 4. Comunicar a stakeholders
# 5. Analizar qué salió mal
# 6. Intentar de nuevo (o escalar)

psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f ./MIGRATION_ROLLBACK.sql
```

---

## 📋 Resumen de Tiempos

| Fase | Actividad | Duración |
|------|-----------|----------|
| Pre | Backups + validación | 30 min |
| 1 | Validación pre-flight | 5 min |
| 2 | Agregar columnas + crear tablas | 15 min |
| 3 | Migrar datos (principalmente GPS parsing) | 90-120 min |
| 4 | Validación post-migración | 20 min |
| 5 | Deprecación (manual, día siguiente) | 15 min |
| **TOTAL** | | **4.5-5.5 horas** |

---

## ✅ Checklist Final

**Antes de empezar**:
- [ ] Backups completos
- [ ] Código de app actualizado
- [ ] Equipo notificado
- [ ] Ventana de downtime confirmada
- [ ] Rollback scripts listos

**Durante**:
- [ ] Monitoreo activo
- [ ] Conexión con equipo
- [ ] Logs monitoreados

**Después**:
- [ ] Validaciones completadas
- [ ] Performance verificada
- [ ] RLS funcionando
- [ ] Smoke tests pasados
- [ ] Notificación a usuarios
- [ ] Documentación actualizada

