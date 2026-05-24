# RIESGOS POTENCIALES Y MITIGACIÓN

**Fecha**: 19 de mayo de 2026  
**Crítica**: Documento de análisis de riesgos  
**Relacionado**: SCHEMA_COMPARISON.md, MIGRATION_FORWARD.sql

---

## 🔴 RIESGOS CRÍTICOS

### 1. Pérdida Permanente de Datos Nutricionales

**Problema**:
- Consolidación de 3 tablas complejas → 1 tabla simple
- Datos que desaparecen:
  - `nutrition_profiles`: goals, target_weight, weekly_rate, gender, birth_date
  - `nutrition_plans`: meals JSONB (meal names, descriptions, macros by day type)
  - `weight_log`: body_fat_pct, historical weight tracking
- Nueva tabla solo tiene: calories, protein, carbs, fats, hydration, notes

**Impacto**:
- 🔴 **CRÍTICO**: Funcionalidad nutricional degradada
- Entrenadores no podrán acceder a planes de nutrición personalizados
- Pérdida de datos históricos de peso
- Goals de nutrición perdidos

**Mitigación ANTES de ejecutar**:
```bash
# 1. Exportar todos los datos nutricionales
psql -h [host] -U [user] -d clavametrics -c \
  "COPY nutrition_profiles TO STDOUT WITH (FORMAT csv, HEADER)" \
  > nutrition_profiles_backup_$(date +%Y%m%d_%H%M%S).csv

psql -h [host] -U [user] -d clavametrics -c \
  "COPY nutrition_plans TO STDOUT WITH (FORMAT csv, HEADER)" \
  > nutrition_plans_backup_$(date +%Y%m%d_%H%M%S).csv

psql -h [host] -U [user] -d clavametrics -c \
  "COPY weight_log TO STDOUT WITH (FORMAT csv, HEADER)" \
  > weight_log_backup_$(date +%Y%m%d_%H%M%S).csv

# 2. Crear tabla de respaldo persistente
CREATE TABLE nutrition_data_backup AS
  SELECT 'profiles' as source, * FROM nutrition_profiles
  UNION ALL
  SELECT 'plans', * FROM nutrition_plans
  UNION ALL
  SELECT 'weight', * FROM weight_log;

# 3. Documentar en logs
INSERT INTO migration_log (table_name, record_count, backup_path)
VALUES
  ('nutrition_profiles', (SELECT COUNT(*) FROM nutrition_profiles), 'nutrition_profiles_backup_*.csv'),
  ('nutrition_plans', (SELECT COUNT(*) FROM nutrition_plans), 'nutrition_plans_backup_*.csv'),
  ('weight_log', (SELECT COUNT(*) FROM weight_log), 'weight_log_backup_*.csv');
```

**Cuando ejecutar migración**:
- ❌ NO: Durante temporada activa de clubs
- ✅ SÍ: Fuera de temporada cuando datos nutricionales no son críticos

---

### 2. Migración Complicada de GPS/Analytics (JSONB Parsing)

**Problema**:
- Datos en `athlete_sessions.metrics` (JSONB) desorganizado
- Estructura variable: no garantiza que todos los campos existan
- Ejemplo de variabilidad:
  ```json
  {"total_distance": 5000, "max_speed": 25}  -- incompleto
  {"total_distance": 5000, "metrics": {...}} -- estructura diferente
  ```
- Matching por nombre de jugador: frágil (puede haber variaciones)
- Matching por fecha: múltiples sesiones en mismo día → ambigüedad

**Ejemplo de Riesgos**:
```sql
-- Problema 1: Player name no coincide exactamente
SELECT * FROM athlete_sessions WHERE player_name = 'John Smith';
-- Pero en players está: 'John', 'smith' (apellido separado)
-- O: 'João Smith' (acentos)

-- Problema 2: Múltiples sesiones mismo día
SELECT COUNT(*) FROM training_sessions 
WHERE club_id = 'xxx' AND session_date = '2024-05-19';
-- Resultado: 3 sesiones
-- ¿Cuál la correcta para athlete_sessions con esa fecha?

-- Problema 3: JSONB incompleto
SELECT metrics FROM athlete_sessions LIMIT 10;
-- Resultado: variedad de estructuras, campos faltantes
```

**Impacto**:
- 🔴 **CRÍTICO**: Registros no matched = datos huérfanos
- GPS data incompleto o incorrecto
- Queries de performance rompen

**Mitigación**:

1. **Análisis previo de datos**:
```sql
-- Analizar estructura JSONB
SELECT 
  jsonb_object_keys(metrics) as key,
  COUNT(*) as frequency
FROM athlete_sessions
WHERE metrics IS NOT NULL
GROUP BY key
ORDER BY frequency DESC;

-- Analizar variaciones de nombres
SELECT DISTINCT player_name FROM athlete_sessions
ORDER BY player_name;

-- Comparar con players
SELECT * FROM (
  SELECT DISTINCT player_name FROM athlete_sessions
) a
LEFT JOIN (
  SELECT first_name || ' ' || last_name as full_name FROM players
) p ON a.player_name ILIKE p.full_name
WHERE p.full_name IS NULL;
```

2. **Crear tabla de staging con validación**:
```sql
-- Tabla con flags de validación
CREATE TABLE gps_migration_log (
  athlete_session_id UUID,
  player_name TEXT,
  player_id UUID,
  match_score NUMERIC, -- 0.0-1.0
  session_date DATE,
  session_id UUID,
  gps_inserted BOOLEAN,
  notes TEXT
);

-- Registrar cada intento de matching
INSERT INTO gps_migration_log (athlete_session_id, player_name, match_score, notes)
SELECT id, player_name, 0.0, 'NO MATCH'
FROM athlete_sessions
WHERE id NOT IN (SELECT athlete_session_id FROM gps_migration_log WHERE gps_inserted);
```

3. **Validar después de migración**:
```sql
-- Auditar datos faltantes
SELECT COUNT(*) FROM athlete_sessions
WHERE id NOT IN (
  SELECT athlete_session_id FROM gps_migration_log WHERE gps_inserted = true
);
```

---

### 3. Renombramiento de Columnas Sin Downtime

**Problema**:
- `players.dob` → `players.date_of_birth`
- `evaluations.date` → `evaluations.test_date`
- `evaluations.eval_type` → `evaluations.evaluation_type`
- Código en producción referencia nombres antiguos
- Queries cacheadas pueden quebrar

**Impacto**:
- 🔴 **CRÍTICO**: Application errors si no se actualiza código
- Queries en stored procedures rompen
- Datos inconsistentes durante transición

**Mitigación**:

1. **Crear vistas de compatibilidad backwards**:
```sql
-- Crear vistas que mapean nombres viejos a nuevos
CREATE OR REPLACE VIEW players_v1 AS
SELECT
  id,
  club_id,
  first_name,
  last_name,
  position,
  dob AS date_of_birth,  -- Mapear
  nationality,
  height,
  weight,
  dominant_foot,
  status,
  photo_url,
  created_at
FROM players;

CREATE OR REPLACE VIEW evaluations_v1 AS
SELECT
  id,
  club_id,
  player_id,
  date AS test_date,  -- Mapear
  category,
  eval_type AS evaluation_type,  -- Mapear
  eval_subtype,
  data,
  notes,
  created_at
FROM evaluations;

-- Las aplicaciones viejas usan vistas, las nuevas usan tablas directo
```

2. **Ejecutar durante ventana de mantenimiento**:
   - Solo durante downtime planificado
   - NO durante horas de entrenamiento activo
   - Máx 1-2 horas de downtime

3. **Notificar a equipo de desarrollo**:
   - Actualizar queries antes de migration
   - Verificar en staging primero
   - Plan de rollback inmediato

---

## ⚠️ RIESGOS ALTOS

### 4. Eliminación de Tablas de Gimnasio (Sin Reemplazo)

**Problema**:
```
gym_plans          -- Planes de entrenamiento en gimnasio
gym_exercises      -- Librería de ejercicios
gym_groups         -- Grupos de jugadores por zona de carga
gym_sections       -- Secciones de entrenamiento
```
- Completamente descontinuadas en nuevo schema
- Sin tabla equivalente en nuevo schema
- Si hay datos activos: **PÉRDIDA TOTAL**

**Preguntas a responder ANTES de migración**:
```sql
-- ¿Hay datos activos?
SELECT COUNT(*) FROM gym_plans WHERE updated_at > NOW() - INTERVAL '30 days';
SELECT COUNT(*) FROM gym_exercises WHERE created_at > NOW() - INTERVAL '30 days';
SELECT COUNT(*) FROM gym_groups WHERE updated_at > NOW() - INTERVAL '30 days';

-- ¿Hay referencias en el código?
-- (Búsqueda en codebase necesaria)
```

**Impacto**:
- ⚠️ **ALTO**: Si hay datos activos, se pierden
- Funcionalidad de gym planner desaparece
- Ejercicios de librería desaparecen

**Mitigación**:

1. **Decisión comercial primero**:
   - ¿Se descontinúa realmente la funcionalidad de gym?
   - ¿O es un error en el nuevo schema?

2. **Si se descontinúa**:
```bash
# Exportar todos los datos de gimnasio
for table in gym_plans gym_exercises gym_groups gym_sections; do
  psql -h [host] -U [user] -d clavametrics -c \
    "COPY $table TO STDOUT WITH (FORMAT csv, HEADER)" \
    > ${table}_full_backup_$(date +%Y%m%d).csv
done

# Crear tabla de archivo para auditoría
CREATE TABLE gym_data_deprecated_archive AS
  SELECT 'gym_plans' as source, * FROM gym_plans
  UNION ALL
  SELECT 'gym_exercises', * FROM gym_exercises
  UNION ALL
  SELECT 'gym_groups', * FROM gym_groups
  UNION ALL
  SELECT 'gym_sections', * FROM gym_sections;

-- Guardar por 2 años mínimo para auditoría
```

---

### 5. Migración de RPE - Eliminación de club_id

**Problema**:
- Tabla antigua: `rpe_sessions` con `club_id` directo
- Nueva tabla: `rpe` sin `club_id`
- `club_id` debe derivarse via JOIN con `players`

**Impacto en Performance**:
```sql
-- ANTES (rápido):
SELECT * FROM rpe_sessions WHERE club_id = 'xxx' AND rpe > 7;

-- DESPUÉS (más lento - requiere JOIN):
SELECT r.* FROM rpe r
JOIN players p ON r.player_id = p.id
WHERE p.club_id = 'xxx' AND r.rpe > 7;
```

**Riesgo**:
- ⚠️ **ALTO**: Queries de performance degradada
- Sin índice en `rpe(player_id)` pueden ser muy lentas
- RLS más compleja

**Mitigación**:

1. **Crear índices estratégicos**:
```sql
-- Índices para optimizar queries comunes
CREATE INDEX rpe_player_club_idx ON rpe(player_id)
  INCLUDE (rpe, session_id, created_at);  -- Covering index

-- Si se permiten NULL, crear índice parcial
CREATE INDEX rpe_high_load_idx ON rpe(player_id)
  WHERE rpe > 7;  -- Partial index para query común
```

2. **Materializar club_id si se necesita**:
```sql
-- Desnormalizar: agregar club_id como computed column
ALTER TABLE rpe ADD COLUMN club_id UUID GENERATED ALWAYS AS (
  (SELECT club_id FROM players WHERE id = rpe.player_id)
) STORED;

-- Crear índice en club_id desnormalizado
CREATE INDEX rpe_club_id_idx ON rpe(club_id);
```

3. **Benchmarking ANTES y DESPUÉS**:
```sql
-- ANTES: Medir query time con schema antiguo
EXPLAIN ANALYZE
SELECT * FROM rpe_sessions WHERE club_id = 'xxx' AND rpe > 7;

-- DESPUÉS: Medir query time con nuevo schema
EXPLAIN ANALYZE
SELECT r.* FROM rpe r
JOIN players p ON r.player_id = p.id
WHERE p.club_id = 'xxx' AND r.rpe > 7;
```

---

### 6. Disponibilidad de Jugadores - availability → players.status

**Problema**:
- Tabla `availability` contiene estado actual de jugadores
- Nuevo schema: estado en `players.status`
- ¿Historial de cambios? ¿Logs de auditoría?
- Posible pérdida de timestamps de cambios

**Impacto**:
- ⚠️ **ALTO**: Pérdida de auditoría de cambios
- No se puede saber cuándo cambió availability
- Datos históricos de disponibilidad perdidos

**Mitigación**:

1. **Backup de tabla availability**:
```sql
CREATE TABLE availability_audit AS
SELECT * FROM availability;
```

2. **Crear tabla de auditoría de cambios**:
```sql
CREATE TABLE players_status_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id),
  old_status TEXT,
  new_status TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID,
  reason TEXT
);

ALTER TABLE players_status_audit ENABLE ROW LEVEL SECURITY;

-- Trigger para auditar cambios futuros
CREATE OR REPLACE FUNCTION audit_player_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO players_status_audit (player_id, old_status, new_status, changed_by)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER player_status_audit_trigger
AFTER UPDATE OF status ON players
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION audit_player_status();
```

---

## ⚠️ RIESGOS MEDIOS

### 7. Datos Huérfanos en gps_reports

**Problema**:
- Si matching falla: `player_id` o `session_id` pueden ser NULL
- Datos quedan en tabla pero sin relación válida
- Violación de FK (si se enforce)

**Impacto**:
- ⚠️ **MEDIO**: Datos inválidos en tabla
- Queries devuelven resultados inconsistentes
- Auditoría complicada

**Mitigación**:

```sql
-- OPCIÓN 1: No permitir NULL (estricto)
ALTER TABLE gps_reports
  ADD CONSTRAINT gps_fk_players FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  ADD CONSTRAINT gps_fk_sessions FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;

-- Si hay NULL, migración falla - esto es intencional para detectar problemas

-- OPCIÓN 2: Permitir NULL pero auditar (permisivo)
CREATE TABLE gps_unmatched (
  id UUID,
  player_name TEXT,
  session_date DATE,
  metrics JSONB,
  reason TEXT,
  migrated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migración: Insert unmatched en tabla de auditoría
INSERT INTO gps_unmatched (id, player_name, session_date, metrics, reason)
SELECT a.id, a.player_name, a.session_date, a.metrics,
  CASE
    WHEN p.id IS NULL THEN 'Player not found'
    WHEN ts.id IS NULL THEN 'Session not found'
    ELSE 'Unknown'
  END as reason
FROM athlete_sessions a
LEFT JOIN players p ON a.player_name ILIKE (p.first_name || ' ' || p.last_name)
LEFT JOIN training_sessions ts ON a.session_date = ts.session_date
WHERE p.id IS NULL OR ts.id IS NULL;
```

---

### 8. Tablas de Chat y Tasks - Datos Perdidos

**Problema**:
- Tablas descontinuadas: `messages`, `message_reads`, `tasks`
- Potencialmente miles de mensajes históricos
- Sin migración a ningún lado

**Impacto**:
- ⚠️ **MEDIO**: Pérdida de chat histórico
- Usuarios no pueden acceder a mensajes viejos
- Posibles issues legales (auditoría/compliance)

**Mitigación**:

```bash
# ANTES de migrations: Exportar todo

psql -h [host] -U [user] -d clavametrics -c \
  "COPY messages TO STDOUT WITH (FORMAT csv, HEADER)" \
  > messages_backup_$(date +%Y%m%d).csv

psql -h [host] -U [user] -d clavametrics -c \
  "COPY tasks TO STDOUT WITH (FORMAT csv, HEADER)" \
  > tasks_backup_$(date +%Y%m%d).csv

# Crear tabla de archivo
CREATE TABLE messages_archive AS SELECT * FROM messages;
CREATE TABLE tasks_archive AS SELECT * FROM tasks;
```

---

## 🟡 RIESGOS BAJOS

### 9. Cambios en Índices

**Problema**:
- Algunos índices antiguos desaparecen (tablas eliminadas)
- Nuevos índices agregados
- Posible impacto en performance por falta de índices

**Impacto**:
- 🟡 **BAJO**: Performance degradada en queries específicas
- Pero sin pérdida de datos

**Mitigación**:

```sql
-- Monitorear queries lentas DESPUÉS de migración
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- Queries que tardan >1s
ORDER BY mean_exec_time DESC;

-- Si hay queries lentas, crear índices adicionales
CREATE INDEX idx_query_optimization ON table_name(column_name);
```

---

## 🔵 RIESGOS BAJOS (Manageable)

### 10. Downtime y Ventana de Migración

**Problema**:
- Migración toma 4-6 horas
- Aplicación debe estar down durante este tiempo
- Usuarios no pueden acceder

**Impacto**:
- 🔵 **BAJO**: Impacto conocido y planificable
- Puede mitigarse con planning

**Mitigación**:

1. **Elegir ventana correcta**:
   - Fuera de temporada activa
   - Fin de semana o madrugada
   - Cuando clubs no están entrenando

2. **Comunicación**:
   - Notificar a clubs con 1 semana anticipación
   - Enviar emails/notificaciones
   - Documentar en status page

3. **Verificación rápida**:
   - Test de smoke después de migración
   - Checks críticos:
     ```sql
     SELECT COUNT(*) FROM players WHERE club_id = 'first_club';
     SELECT COUNT(*) FROM rpe;
     SELECT COUNT(*) FROM wellness WHERE created_at > NOW() - INTERVAL '1 day';
     ```

---

## 📊 MATRIZ DE RIESGOS

| # | Riesgo | Severidad | Probabilidad | Mitigación | Acción |
|---|--------|-----------|-------------|-----------|--------|
| 1 | Pérdida datos nutrición | 🔴 Crítica | Alta | Backup + decisión comercial | Revisar spec |
| 2 | GPS/Analytics JSONB | 🔴 Crítica | Media | Análisis previo + auditoría | Testing exhaustivo |
| 3 | Renombrar columnas | 🔴 Crítica | Alta | Vistas + downtime planificado | Coordinar con dev |
| 4 | Gym tables | ⚠️ Alta | Media | Backup + decisión | Confirmar discontinuidad |
| 5 | RPE performance | ⚠️ Alta | Media | Índices + benchmarking | Testing con datos reales |
| 6 | Availability audit | ⚠️ Alta | Media | Tabla auditoría + triggers | Implementar antes |
| 7 | Datos huérfanos GPS | ⚠️ Media | Baja | Constraints + tabla unmatched | Monitorear |
| 8 | Chat/tasks perdidos | ⚠️ Media | Baja | Backup + archive tables | Export datos |
| 9 | Índices faltantes | 🟡 Baja | Media | Monitoreo + EXPLAIN | Post-migration analysis |
| 10 | Downtime | 🔵 Baja | Alta | Planning + comunicación | Calendarizar |

---

## ✅ CHECKLIST ANTES DE EJECUTAR

- [ ] Backup completo de BD en Supabase
- [ ] Export de todas las tablas críticas (CSV)
- [ ] Análisis JSONB en athlete_sessions completado
- [ ] Decisión comercial sobre nutrition consolidation
- [ ] Decisión sobre gym tables (discontinuar o no)
- [ ] Código de aplicación actualizado (nuevos nombres de columnas)
- [ ] Vistas de compatibilidad creadas si es necesario
- [ ] Ventana de downtime comunicada a clubs
- [ ] Status page actualizada
- [ ] Equipo de soporte notificado
- [ ] Rollback scripts testeados
- [ ] Queries críticas benchmarked (ANTES y DESPUÉS)
- [ ] RLS policies verificadas
- [ ] Índices validados
- [ ] Triggers de auditoría en lugar
- [ ] Monitoring configurado para detectar issues

---

## 📞 PLAN DE COMUNICACIÓN

### 7 días antes:
- Email a todos los clubs
- Documentación sobre cambios
- Link a documentación técnica

### 24 horas antes:
- Confirmación en Slack/canal
- Recordatorio de ventana de downtime

### Durante migración:
- Actualización en status page cada 30 min
- Monitoreo activo
- Equipo on-call disponible

### Después:
- Confirmación de éxito
- Reporte de cualquier issue
- Seguimiento 24h después

---

## 🚀 SIGUIENTE: EJECUCIÓN

1. **Staging First**: Ejecutar migración en clone de producción
2. **Validación**: Todos los tests pasen
3. **Producción**: Ejecutar con procedimiento documentado
4. **Rollback Plan**: Listo en caso de emergency
5. **Monitoreo**: 48 horas intensivo post-migración

