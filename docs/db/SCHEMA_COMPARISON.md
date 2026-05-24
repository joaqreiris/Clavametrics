# SCHEMA COMPARISON: Clavametrics Old vs New

**Fecha**: 19 de mayo de 2026  
**Estado**: Análisis Completo  
**Riesgo General**: ALTO - Requiere migración planificada

---

## 1. TABLAS POR ESTADO

### ✅ Tablas Mantiene (con cambios menores)

| Tabla | Estado | Cambios |
|-------|--------|---------|
| `clubs` | Mantiene | Mismo | 
| `profiles` | Mantiene | Mismo |
| `players` | Mantiene | Rediseño de columnas |
| `training_sessions` | Mantiene | Simplificado |
| `wellness` | Mantiene | Mismo |
| `injuries` | Mantiene | Mismo |
| `evaluations` | Mantiene | Simplificado |
| `nutrition` | Reduce | Consolidado (nutrition_profiles + nutrition_plans + weight_log) |

### ❌ Tablas Eliminadas (OBSOLETO)

1. `availability` - Reemplazado por lógica en `players.status`
2. `daily_plans` - Descontinuado
3. `gym_plans` - Descontinuado  
4. `gym_exercises` - Descontinuado
5. `gym_groups` - Descontinuado
6. `gym_sections` - Descontinuado
7. `microcycles` - Descontinuado
8. `rpe_sessions` - Reemplazado por tabla `rpe`
9. `messages` - Descontinuado (chat)
10. `message_reads` - Descontinuado (chat)
11. `tasks` - Descontinuado
12. `nutrition_profiles` - Consolidado
13. `nutrition_plans` - Consolidado
14. `weight_log` - Consolidado
15. `club_data_sources` - Descontinuado
16. `athlete_sessions` - Descontinuado
17. `dashboard_widgets` - Descontinuado

### 🆕 Tablas Nuevas

1. **`gps_reports`** - Consolidada desde analytics
2. **`rpe`** - Rediseñada desde `rpe_sessions`

---

## 2. ANÁLISIS POR TABLA

### 📋 TABLA: players

**Estado**: Rediseño  

#### Columnas Antiguo
```sql
CREATE TABLE players (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  number integer,
  position text,
  nationality text,
  dob date,
  photo_url text,
  created_at timestamptz
);
```

#### Columnas Nuevo
```sql
CREATE TABLE players (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  position text,
  date_of_birth date,          -- RENOMBRADO: dob -> date_of_birth
  nationality text,
  height numeric,              -- NUEVO
  weight numeric,              -- NUEVO
  dominant_foot text,          -- NUEVO
  status text,                 -- NUEVO: reemplaza 'availability'
  photo_url text,
  created_at timestamptz
);
```

#### Diferencias
| Aspecto | Antiguo | Nuevo | Acción |
|--------|--------|-------|--------|
| `number` | ✅ | ❌ | ELIMINAR |
| `dob` | ✅ | ❌ | RENOMBRAR a `date_of_birth` |
| `height` | ❌ | ✅ | CREAR (nullable por defecto) |
| `weight` | ❌ | ✅ | CREAR (nullable por defecto) |
| `dominant_foot` | ❌ | ✅ | CREAR (nullable por defecto) |
| `status` | ❌ | ✅ | CREAR - De `availability` table |

#### Riesgos
⚠️ **ALTO**: Renombramiento de `dob` → `date_of_birth` requiere migración de datos

---

### 📋 TABLA: wellness

**Estado**: Mantiene con cambios menores

#### Comparación
| Columna | Antiguo | Nuevo | Estado |
|---------|--------|-------|--------|
| `id` | ✅ | ✅ | ✓ |
| `player_id` | ✅ | ✅ | ✓ |
| `club_id` | ✅ | ✅ | ✓ |
| `sleep_quality` | ✅ | ✅ | ✓ |
| `fatigue` | ✅ | ✅ | ✓ |
| `soreness` | ✅ | ✅ | ✓ |
| `stress` | ✅ | ✅ | ✓ |
| `mood` | ✅ | ✅ | ✓ |
| `readiness` | ✅ | ✅ | ✓ |
| `submitted_at` | ✅ | ✅ | ✓ |

**Resultado**: Sin cambios estructurales.

---

### 📋 TABLA: injuries

**Estado**: Mantiene con cambios menores

#### Comparación
| Columna | Antiguo | Nuevo | Estado |
|--------|--------|-------|--------|
| `id` | ✅ | ✅ | ✓ |
| `player_id` | ✅ (agregado en migration) | ✅ | ✓ |
| `club_id` | ✅ | ✅ | ✓ |
| `injury_type` | ✅ | ✅ | ✓ |
| `body_area` | ✅ | ✅ | ✓ |
| `severity` | ✅ | ✅ | ✓ |
| `status` | ✅ | ✅ | ✓ |
| `start_date` | ✅ | ✅ | ✓ |
| `expected_return` | ✅ | ✅ | ✓ |
| `notes` | ✅ | ✅ | ✓ |

**Resultado**: Sin cambios estructurales. `player_id` ya fue agregado en migración anterior.

---

### 📋 TABLA: training_sessions

**Estado**: Rediseño simplificado

#### Antiguo
```sql
CREATE TABLE training_sessions (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL,
  title text,
  session_date date,
  duration integer,
  session_type text,
  coach_id uuid,
  notes text,
  created_at timestamptz
);
```

#### Nuevo
```sql
CREATE TABLE training_sessions (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL,
  title text,
  session_date date,
  duration integer,
  session_type text,
  coach_id uuid,
  notes text,
  created_at timestamptz
);
```

**Resultado**: Estructura idéntica - Sin cambios.

---

### 📋 TABLA: rpe (NUEVA)

**Estado**: Nueva tabla - reemplaza `rpe_sessions`

#### Antiguo (rpe_sessions)
```sql
CREATE TABLE rpe_sessions (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  session_id uuid NOT NULL,
  rpe integer,
  duration integer,
  load integer,
  created_at timestamptz
);
```

#### Nuevo (rpe)
```sql
CREATE TABLE rpe (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  session_id uuid NOT NULL,
  rpe integer,
  duration integer,
  load integer,
  created_at timestamptz
);
```

#### Diferencias
| Aspecto | Antiguo | Nuevo | Acción |
|--------|--------|-------|--------|
| `club_id` | ✅ | ❌ | ELIMINAR (innecesario, se deduce de session_id) |
| `player_id` | ✅ | ✅ | ✓ |
| `session_id` | ✅ | ✅ | ✓ |
| Tabla nombre | `rpe_sessions` | `rpe` | RENOMBRAR |

#### Riesgos
⚠️ **MEDIO**: Requiere renombrar tabla y eliminar `club_id`. Impacto: referencias en código.

---

### 📋 TABLA: gps_reports (NUEVA)

**Estado**: Nueva tabla - consolidada desde analytics

#### Estructura
```sql
CREATE TABLE gps_reports (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  session_id uuid NOT NULL,
  club_id uuid NOT NULL,
  total_distance numeric,
  high_speed_distance numeric,
  sprint_distance numeric,
  accelerations numeric,
  decelerations numeric,
  max_speed numeric,
  player_load numeric,
  created_at timestamptz
);
```

#### Migración desde antiguo
- **Fuente**: `athlete_sessions` table (antes)
  - Requiere JOIN con `players` para obtener `player_id`
  - Requiere JOIN con `training_sessions` para obtener `session_id`
  - Está en formato JSONB, requiere parsing

#### Riesgos
⚠️ **ALTO**: Datos dispersos en `athlete_sessions.metrics` (JSONB). Requiere:
1. Parsing de JSONB
2. Mapeo de nombres de jugador a `player_id`
3. Mapeo de fechas a `session_id`

---

### 📋 TABLA: evaluations

**Estado**: Simplificado

#### Antiguo
```sql
CREATE TABLE evaluations (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  date date,
  category text,
  eval_type text,
  eval_subtype text,
  data jsonb,
  notes text,
  created_at timestamptz
);
```

#### Nuevo
```sql
CREATE TABLE evaluations (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  club_id uuid NOT NULL,
  evaluation_type text,
  test_date date,
  value numeric,
  unit text,
  notes text,
  created_at timestamptz
);
```

#### Diferencias
| Columna | Antiguo | Nuevo | Acción |
|--------|--------|-------|--------|
| `date` | ✅ | ❌ | RENOMBRAR a `test_date` |
| `category` | ✅ | ❌ | ELIMINAR (metadata en `evaluation_type`) |
| `eval_type` | ✅ | ❌ | RENOMBRAR a `evaluation_type` |
| `eval_subtype` | ✅ | ❌ | ELIMINAR |
| `data` | ✅ (JSONB) | ❌ | NORMALIZAR en `value` + `unit` |

#### Riesgos
⚠️ **ALTO**: 
1. Transformación de datos complejos (JSONB → columnas normalizadas)
2. Pérdida de `category` y `eval_subtype` metadata
3. Requiere migración inteligente de `data.value` → `value`

---

### 📋 TABLA: nutrition (CONSOLIDADA)

**Estado**: Consolidación de 3 tablas

#### Antiguo
```sql
-- Tres tablas separadas:
nutrition_profiles    -- perfiles de nutrición
nutrition_plans       -- planes por día tipo
weight_log           -- log de peso
```

#### Nuevo
```sql
CREATE TABLE nutrition (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  club_id uuid NOT NULL,
  calories numeric,
  protein numeric,
  carbs numeric,
  fats numeric,
  hydration numeric,
  notes text,
  created_at timestamptz
);
```

#### Riesgos
🔴 **CRÍTICO**: Consolidación destructiva
1. Pierde estructura de `nutrition_profiles` (goals, target_weight)
2. Pierde `nutrition_plans` (meals JSONB)
3. Pierde `weight_log` (histórico de peso, body_fat_pct)
4. Nueva tabla más simple no puede recuperar datos perdidos

---

### ❌ Tablas a Eliminar

#### 1. `availability` 
- **Reemplazado por**: `players.status`
- **Datos**: Necesario migrar estado de disponibilidad a `players`

#### 2. Tablas de Gimnasio (gym_*)
```
gym_plans
gym_exercises  
gym_groups
gym_sections
```
- **Estado**: Completamente descontinuadas
- **Datos**: Requiere archivo/backup antes de drop

#### 3. Tablas de Chat
```
messages
message_reads
tasks
```
- **Estado**: Módulos descontinuados
- **Datos**: Requiere backup

#### 4. Analytics Antiguo
```
club_data_sources
athlete_sessions
dashboard_widgets
```
- **Estado**: Reemplazadas por `gps_reports`
- **Datos**: Migración compleja de JSONB

#### 5. Planificación
```
daily_plans
microcycles
```
- **Estado**: Descontinuadas
- **Datos**: Requiere backup

---

## 3. ANÁLISIS DE RELACIONES

### Integridad Referencial

| Relación | Antiguo | Nuevo | Estado |
|----------|--------|-------|--------|
| `players.club_id` → `clubs.id` | ✅ | ✅ | ✓ Mantiene |
| `wellness.player_id` → `players.id` | ✅ | ✅ | ✓ Mantiene |
| `injuries.player_id` → `players.id` | ✅ | ✅ | ✓ Mantiene |
| `gps_reports.session_id` → `training_sessions.id` | N/A | ✅ | 🆕 Nueva |
| `rpe.session_id` → `training_sessions.id` | ✅ | ✅ | ✓ Mantiene |
| `rpe.player_id` → `players.id` | ✅ | ✅ | ✓ Mantiene |
| `rpe_sessions.club_id` | ✅ | ❌ | ❌ Eliminada |

### Riesgos de Integridad
⚠️ Datos huérfanos potenciales en `rpe` si `player_id` es NULL
⚠️ Datos huérfanos en `gps_reports` si `session_id` no existe

---

## 4. ANÁLISIS DE ÍNDICES

### Índices que se Mantienen

```sql
-- wellness
CREATE INDEX wellness_player_id_idx ON wellness(player_id);
CREATE INDEX wellness_club_player_idx ON wellness(club_id, player_id);

-- injuries  
CREATE INDEX injuries_player_id_idx ON injuries(player_id);
CREATE INDEX injuries_club_idx ON injuries(club_id);

-- training_sessions
CREATE INDEX training_sessions_club_idx ON training_sessions(club_id);
```

### Índices Que Desaparecen

```sql
-- De tablas eliminadas
CREATE INDEX idx_gym_exercises_club ON gym_exercises(club_id);
CREATE INDEX idx_athlete_sessions_club_date ON athlete_sessions(club_id, session_date DESC);
```

### Índices Nuevos Requeridos

```sql
-- gps_reports
CREATE INDEX gps_reports_player_id_idx ON gps_reports(player_id);
CREATE INDEX gps_reports_session_id_idx ON gps_reports(session_id);
CREATE INDEX gps_reports_club_id_idx ON gps_reports(club_id);

-- rpe
CREATE INDEX rpe_player_id_idx ON rpe(player_id);
CREATE INDEX rpe_session_id_idx ON rpe(session_id);

-- evaluations
CREATE INDEX evaluations_player_id_idx ON evaluations(player_id);
CREATE INDEX evaluations_club_id_idx ON evaluations(club_id);
```

---

## 5. ANÁLISIS DE RLS (Row Level Security)

### ✅ RLS Que se Mantiene

```sql
-- All tables mantienen esta estructura:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_all" ON {table}
  USING (club_id = get_user_club_id());
```

Tablas affected:
- `clubs`, `profiles`, `players`, `wellness`, `injuries`
- `training_sessions`, `nutrition`, `evaluations`

### 🆕 RLS Nuevas

```sql
-- gps_reports
CREATE POLICY "gps_reports_all" ON gps_reports
  USING (club_id = get_user_club_id());

-- rpe
CREATE POLICY "rpe_all" ON rpe
  USING (player_id IN (
    SELECT id FROM players WHERE club_id = get_user_club_id()
  ));
```

### ⚠️ RLS Potenciales Vulnerabilidades

- `rpe` no tiene `club_id` directo - requiere JOIN con `players`
- Esto es más lento pero correcto

---

## 6. COLUMNAS INCOMPATIBLES DETECTADAS

### 🔴 CRÍTICAS

| Tabla | Columna | Tipo Antiguo | Tipo Nuevo | Riesgo |
|-------|---------|--------------|-----------|--------|
| `players` | `dob` | `date` | `date_of_birth` | Renombrar requiere UPDATE |
| `rpe_sessions` | - | tabla completa | tabla `rpe` | Renombrar + eliminar `club_id` |
| `evaluations` | `data` | `jsonb` | ❌ (normalizado) | Pérdida de datos, requiere parsing |
| `nutrition` | - | 3 tablas | 1 tabla | Consolidación destructiva |

### ⚠️ MODERADAS

| Tabla | Columna | Antiguo | Nuevo | Acción |
|-------|---------|--------|-------|--------|
| `players` | `number` | `integer` | ❌ | DELETE |
| `rpe_sessions` | `club_id` | `uuid` | ❌ | DELETE |
| `evaluations` | `category` | `text` | ❌ | DELETE |
| `evaluations` | `eval_subtype` | `text` | ❌ | DELETE |

---

## 7. TABLAS FALTANTES EN NUEVO

Análisis de impacto si se eliminan sin backup:

| Tabla | Registros Esperados | Impacto |
|-------|-------------------|--------|
| `gym_plans` | Cientos por club | Pérdida de planes de entrenamiento |
| `gym_exercises` | Cientos por club | Pérdida de librería de ejercicios |
| `messages` | Potencialmente miles | Pérdida de chat histórico |
| `tasks` | Cientos | Pérdida de tareas pendientes |
| `nutrition_profiles` | Cientos | Pérdida de perfiles nutricionales |
| `daily_plans` | Potencialmente miles | Pérdida de planificación diaria |
| `microcycles` | Cientos | Pérdida de microciclos entrenamiento |

---

## 8. RIESGOS POTENCIALES

### 🔴 RIESGOS CRÍTICOS

1. **Pérdida de Datos Nutricionales** (nutrition consolidation)
   - 3 tablas complejas → 1 tabla simple
   - Datos que no caben: goals, meal plans, body fat tracking
   - Impacto: Funcionalidad nutricional severamente degradada

2. **Migración de Evaluaciones Complejas** (JSONB parsing)
   - Datos en formato JSON flexible → columnas rígidas
   - Riesgo: Pérdida de metadata especializada
   - Requiere: Script robusto de parsing

3. **Pérdida de Disponibilidad Antigua** (availability → players.status)
   - Requiere migración sin perder datos históricos
   - Riesgo: Datos inconsistentes durante transición

### ⚠️ RIESGOS ALTOS

4. **Tablas de Gimnasio Completamente Eliminadas**
   - Sin dato de transición en nuevo schema
   - Si hay datos activos: pérdida total

5. **Datos de Analytics Complejos** (athlete_sessions → gps_reports)
   - Formato JSONB desorganizado
   - Requiere mappeo por nombre de jugador (frágil)
   - Riesgo: Registros sin matchear

6. **Renombramiento de Columnas** (dob → date_of_birth, etc.)
   - Requiere UPDATE en todos los registros
   - Riesgo: Queries cacheadas quebradas

### ⚠️ RIESGOS MEDIOS

7. **Eliminación de `club_id` en `rpe`**
   - Requiere JOINs adicionales para RLS
   - Performance: Impacto bajo
   - Seguridad: Mayor complejidad

8. **Datos Huérfanos Potenciales**
   - En `gps_reports`: player_id sin registro en players
   - En `rpe`: player_id sin registro en players
   - Impacto: Datos fantasma, violaciones de integridad

---

## 9. PLAN DE MIGRACIÓN

### Orden Correcto de Ejecución

```
FASE 1: PRE-MIGRACIÓN (Backups y Validación)
├─ 1. Backup completo de base de datos
├─ 2. Backup de tablas críticas (JSON exports)
├─ 3. Validar integridad referencial
└─ 4. Test en clone de producción

FASE 2: PREPARACIÓN (Columnas nuevas)
├─ 1. ALTER TABLE players: ADD COLUMNS (height, weight, dominant_foot, status)
├─ 2. ALTER TABLE rpe_sessions: RENAME to rpe (en etapa, no ejecutar drop aún)
├─ 3. ALTER TABLE evaluations: ADD COLUMNS (test_date, value, unit)
├─ 4. Crear tabla gps_reports (vacía)
└─ 5. Crear tabla nutrition (vacía)

FASE 3: MIGRACIÓN DE DATOS
├─ 1. Migrar availability → players.status
├─ 2. Migrar rpe_sessions → rpe (copiar datos, mantener original)
├─ 3. Migrar athlete_sessions → gps_reports (parsing JSONB)
├─ 4. Migrar evaluations (normalizar JSONB)
├─ 5. Consolidar nutrition (perfiles + planes + weight → nutrition)
└─ 6. Validar integridad referencial

FASE 4: LIMPIEZA (Tablas antiguas)
├─ 1. Crear vistas para backward compatibility (si se necesita)
├─ 2. Renombrar tablas antiguas a {tabla}_deprecated
├─ 3. DROP policies RLS antiguas
├─ 4. Monitorear aplicación por 24 horas
└─ 5. DROP tablas antiguas después de verificación

FASE 5: POST-MIGRACIÓN
├─ 1. Validar índices
├─ 2. Validar RLS policies
├─ 3. Ejecutar VACUUM ANALYZE
├─ 4. Monitorear performance
└─ 5. Documentar cambios
```

### Dependencias Entre Pasos

```
Críticas:
- availability DEBE migrar antes de dropear (datos perdidos si no)
- athlete_sessions DEBE migrar antes de dropear (datos perdidos si no)
- nutrition_profiles/plans DEBE migrar antes de dropear

Secuenciales:
- Crear columnas nuevas ANTES de migrar datos
- Validar referencial ANTES de dropear tablas antiguas
- Crear índices DESPUÉS de cargar datos

Parallelizables:
- Migraciones de tablas independientes pueden ser paralelas
- ALTER TABLE en tablas sin relaciones can be parallel
```

---

## 10. DETALLE MIGRACIÓN POR TABLA

### PLAYERS

```
Orden: Fase 2.1
Requerimientos:
1. ADD COLUMNS antes de datos
2. Migrar availability.status → players.status
3. SET defaults para nuevas columnas

Impacto data existente:
- height: NULL para todos (antropometría no disponible antes)
- weight: NULL para todos
- dominant_foot: NULL para todos
- status: MIGRATE from availability
- dob → date_of_birth: Requiere renaming + UPDATE
```

### RPE (formerly rpe_sessions)

```
Orden: Fase 2.2 → 3.2
Requerimientos:
1. Crear tabla rpe nueva (primero)
2. COPY datos de rpe_sessions
3. Validar count
4. DROP rpe_sessions (fase 4)
5. DROP club_id validation en RLS

Impacto:
- RLS require additional JOIN con players
- Queries deben ser adjusted
```

### GPS_REPORTS (new)

```
Orden: Fase 2.4 → 3.3
Requerimientos:
1. Crear tabla
2. Parsing de athlete_sessions.metrics JSONB
3. Mappear player_name → player_id
4. Mappear session_date → session_id
5. Validar referential integrity

Riesgos:
- player_name may not match EXACTLY
- session_date may have multiple sessions
- metrics JSONB structure may vary
```

---

## 11. RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| **Tablas Que se Mantienen** | 8 (con cambios) |
| **Tablas Nuevas** | 2 |
| **Tablas a Eliminar** | 15 |
| **Columnas a Renombrar** | 4 |
| **Columnas a Agregar** | 6 |
| **Columnas a Eliminar** | 7 |
| **Riesgo General** | 🔴 ALTO |
| **Tiempo Estimado de Migración** | 4-6 horas |
| **Ventana de Downtime Recomendada** | 2-4 horas (peak off) |

### Conclusión

La migración es **viable pero riesgosa**. Se recomenda:

✅ **DO:**
1. Realizar en ambiente de staging primero
2. Backup completo antes de iniciar
3. Ejecutar fase por fase con validación
4. Monitorear performance después
5. Tener rollback plan listo

❌ **DON'T:**
1. No eliminar tablas antiguas de inmediato
2. No hacer todo en paralelo (relaciones complejas)
3. No assumir matching perfecto en consolidaciones
4. No olvidar actualizar índices y RLS
5. No hacer en horarios de pico

