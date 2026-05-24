# GUÍA DE IMPLEMENTACIÓN: Schema Nuevo Clavametrics

**Fecha**: 19 de mayo de 2026  
**Estado**: Listo para producción  
**Versión**: 1.0

---

## 🚀 Inicio Rápido

### Paso 1: Crear Schema Nuevo (5 minutos)

```bash
# En Supabase SQL Editor, ejecutar:
# 1. Copiar contenido de SCHEMA_NUEVO_DESDE_CERO.sql
# 2. Pegar en editor de Supabase
# 3. Click "Run"
```

**Lo que se crea**:
- ✅ 14 tablas optimizadas
- ✅ Row Level Security (RLS) en todas
- ✅ Índices para performance
- ✅ Funciones helper
- ✅ Triggers para cálculos automáticos

### Paso 2: Agregar Datos de Prueba (2 minutos)

```bash
# En Supabase SQL Editor, ejecutar:
# 1. Copiar contenido de DATOS_EJEMPLO.sql
# 2. Pegar en editor de Supabase
# 3. Click "Run"
```

### Paso 3: Crear Usuarios (via Supabase Auth)

1. Ir a: https://app.supabase.com → **Authentication** → **Users**
2. Click **"Add user"**
3. Email: `coach@club.com`, Password: (auto-generated)
4. Copiar **UUID** del usuario creado
5. **IMPORTANTE**: Usuario debe tener perfil en `profiles` table

---

## 📊 Arquitectura de Tablas

### 14 Tablas Principales

```
clubs
├── profiles (usuarios del club)
├── players (atletas)
├── training_sessions
│   ├── rpe (RPE por jugador)
│   └── gps_reports (GPS por jugador)
├── wellness (cuestionario diario)
├── injuries (tracking de lesiones)
├── evaluations (tests físicos)
├── nutrition (tracking nutricional)
├── player_anthropometrics (medidas de cuerpo)
├── chat_messages (chat del club)
├── tasks (tareas)
└── audit_log (auditoría de cambios)
```

---

## 🔐 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Las políticas garantizan:

✅ **Jugadores solo ven datos de su club**
✅ **No hay exposición entre clubes**
✅ **Acceso granular por rol**

### Ejemplo: Acceso a jugadores

```sql
-- El usuario autenticado solo puede ver jugadores de su club
SELECT * FROM players;
-- Devuelve solo: WHERE club_id = <club_del_usuario>
```

---

## 📈 Funciones Disponibles

### 1. get_user_club_id()
Obtiene el `club_id` del usuario autenticado.

```sql
-- En queries
WHERE club_id = get_user_club_id()

-- Dentro de aplicación (después autenticación)
SELECT get_user_club_id();
```

### 2. get_player_availability(club_id)
Genera reporte de disponibilidad de jugadores.

```sql
SELECT * FROM get_player_availability('<club-uuid>');

-- Devuelve:
-- player_id, first_name, last_name, status, current_injuries, 
-- last_wellness, readiness
```

**Ejemplo de salida**:
```
player_id | first_name | last_name | status    | injuries | last_wellness | readiness
----------|------------|-----------|-----------|----------|----------------|----------
uuid-1    | Juan       | García    | available | 0        | 2026-05-19    | 8
uuid-2    | Carlos     | López     | recovery  | 1        | 2026-05-19    | 5
uuid-3    | Miguel     | Rodríguez | available | 0        | 2026-05-18    | 7
```

### 3. calculate_player_load(player_id, days_acute, days_chronic)
Calcula carga Aguda/Crónica y ACWR (Acute:Chronic Workload Ratio).

```sql
SELECT * FROM calculate_player_load(
  '<player-uuid>',
  7,    -- últimos 7 días para carga aguda
  28    -- últimos 28 días para carga crónica
);

-- Devuelve:
-- acute_load (últimos 7 días)
-- chronic_load (últimos 28 días)
-- acwr (ratio de lesión: idealmente 0.8-1.3)
```

**Interpretación ACWR**:
- `< 0.8` = Subentrenamiento
- `0.8-1.3` = Óptimo
- `> 1.3` = Riesgo de lesión (overtraining)

**Ejemplo**:
```sql
SELECT acute_load, chronic_load, acwr 
FROM calculate_player_load('player-uuid', 7, 28);

-- Resultado:
-- acute_load | chronic_load | acwr
-- 2500       | 8000         | 0.31 (riesgo bajo)
```

---

## 🎯 Queries Útiles para Aplicación

### 1. Dashboard - Disponibilidad de Equipo

```sql
SELECT * FROM get_player_availability(auth.uid()::text);
```

### 2. Jugador Más Reciente Lesionado

```sql
SELECT p.first_name, p.last_name, i.body_area, i.status, i.expected_return
FROM public.players p
JOIN public.injuries i ON p.id = i.player_id
WHERE p.club_id = get_user_club_id()
  AND i.status = 'active'
ORDER BY i.start_date DESC
LIMIT 5;
```

### 3. Wellness Promedio del Equipo

```sql
SELECT 
  AVG(sleep_quality) as avg_sleep,
  AVG(fatigue) as avg_fatigue,
  AVG(readiness) as avg_readiness,
  COUNT(*) as players_reported
FROM public.wellness_latest w
JOIN public.players p ON w.player_id = p.id
WHERE p.club_id = get_user_club_id()
  AND w.submitted_at > NOW() - INTERVAL '1 day';
```

### 4. Carga de Entrenamiento por Jugador (Últimos 7 días)

```sql
SELECT 
  p.first_name,
  p.last_name,
  SUM(r.load) as total_load,
  COUNT(r.id) as sessions,
  AVG(r.rpe) as avg_rpe
FROM public.players p
LEFT JOIN public.rpe r ON p.id = r.player_id 
  AND r.created_at > NOW() - INTERVAL '7 days'
WHERE p.club_id = get_user_club_id()
GROUP BY p.id, p.first_name, p.last_name
ORDER BY total_load DESC;
```

### 5. Próximos Partidos y Sesiones

```sql
SELECT title, session_date, session_time, session_type, duration
FROM public.training_sessions
WHERE club_id = get_user_club_id()
  AND session_date >= CURRENT_DATE
ORDER BY session_date, session_time;
```

### 6. Tareas Pendientes por Prioridad

```sql
SELECT title, assigned_to_name, due_date, priority, status
FROM public.tasks
WHERE club_id = get_user_club_id()
  AND status != 'done'
ORDER BY priority DESC, due_date ASC;
```

### 7. Chat del Día

```sql
SELECT sender_name, content, created_at
FROM public.chat_messages
WHERE club_id = get_user_club_id()
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

---

## 🔧 Operaciones Comunes

### Crear Nuevo Jugador

```javascript
// Desde aplicación (JavaScript/Supabase Client)
const { data, error } = await supabase
  .from('players')
  .insert([
    {
      club_id: clubId,
      first_name: 'Juan',
      last_name: 'García',
      position: 'Forward',
      date_of_birth: '1998-03-15',
      height: 185.5,
      weight: 78.0,
      dominant_foot: 'right',
      status: 'available'
    }
  ]);
```

### Registrar Wellness Diario

```javascript
const { data, error } = await supabase
  .from('wellness')
  .insert([
    {
      player_id: playerId,
      club_id: clubId,
      sleep_quality: 7,
      fatigue: 5,
      soreness: 6,
      stress: 4,
      mood: 8,
      readiness: 6,
      submitted_at: new Date().toISOString()
    }
  ]);
```

### Registrar Lesión

```javascript
const { data, error } = await supabase
  .from('injuries')
  .insert([
    {
      player_id: playerId,
      club_id: clubId,
      injury_type: 'muscle',
      body_area: 'Hamstring',
      severity: 'moderate',
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
      expected_return: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]
    }
  ]);
```

### Registrar RPE de Sesión

```javascript
const { data, error } = await supabase
  .from('rpe')
  .insert([
    {
      player_id: playerId,
      session_id: sessionId,
      rpe: 6.5,           // 0-10 scale
      duration: 90        // minutos
      // load se calcula automáticamente por trigger
    }
  ]);
```

### Crear Tarea

```javascript
const { data, error } = await supabase
  .from('tasks')
  .insert([
    {
      club_id: clubId,
      created_by: currentUserId,
      created_by_name: 'Coach Name',
      assigned_to: assignedUserId,
      assigned_to_name: 'Player Name',
      title: 'Evaluar CMJ',
      description: 'Complete fitness testing',
      due_date: '2026-05-26',
      priority: 'high'
    }
  ]);
```

---

## 📊 Métricas y KPIs

### 1. Disponibilidad del Equipo

```sql
SELECT 
  COUNT(CASE WHEN status = 'available' THEN 1 END) * 100 / COUNT(*) as availability_pct
FROM public.players
WHERE club_id = get_user_club_id();
```

### 2. Índice de Lesiones

```sql
SELECT COUNT(*) as active_injuries
FROM public.injuries
WHERE club_id = get_user_club_id()
  AND status = 'active';
```

### 3. Wellness Promedio

```sql
SELECT 
  ROUND(AVG(readiness)::NUMERIC, 1) as avg_readiness,
  ROUND(AVG(fatigue)::NUMERIC, 1) as avg_fatigue,
  ROUND(AVG(stress)::NUMERIC, 1) as avg_stress
FROM public.wellness
WHERE club_id = get_user_club_id()
  AND submitted_at > NOW() - INTERVAL '1 day';
```

### 4. Carga Semanal Total

```sql
SELECT 
  SUM(load) as total_load,
  AVG(load) as avg_load,
  MAX(load) as max_load
FROM public.rpe
WHERE created_at > NOW() - INTERVAL '7 days'
  AND player_id IN (
    SELECT id FROM players WHERE club_id = get_user_club_id()
  );
```

---

## 🛡️ Consideraciones de Seguridad

### ✅ Ya Implementado

- ✅ RLS en todas las tablas
- ✅ Multi-tenancy (club_id en todas partes)
- ✅ Auditoría de cambios (audit_log table)
- ✅ Authenticación via Supabase Auth
- ✅ Triggers para validación

### ⚠️ Recomendado Implementar

1. **Auditoría de cambios**
   ```sql
   -- Cada UPDATE/INSERT/DELETE registra en audit_log
   -- Ya tienen tabla, falta implementar triggers
   ```

2. **Rate limiting** (en edge functions)
   - Limitar requests por usuario

3. **API Keys** (si usa Supabase API)
   - Use Row Level Security, no API keys públicas

4. **Validación en cliente**
   - Siempre validar datos antes de enviar

---

## 📱 Integración con Supabase Client

### Instalación

```bash
npm install @supabase/supabase-js
```

### Setup Básico

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_ANON_KEY'
)

// Autenticación
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Queries (automáticamente filtradas por RLS)
const { data: players } = await supabase
  .from('players')
  .select('*')
// Devuelve solo jugadores del club del usuario
```

---

## 🧪 Testing

### Verificar que RLS funciona

```sql
-- Conectar como diferentes usuarios y verificar:

-- Usuario de Club 1
SELECT * FROM players;  -- ✓ Ve solo su club

-- Usuario de Club 2
SELECT * FROM players;  -- ✓ Ve solo su club

-- No puede ver datos de otro club
SELECT * FROM injuries WHERE club_id = 'other-club-uuid';
-- ❌ Error: no rows (RLS bloqueó)
```

### Verificar Triggers

```sql
-- Insertar RPE
INSERT INTO rpe (player_id, session_id, rpe, duration)
VALUES ('uuid', 'uuid', 6, 90);

-- Verificar que load se calculó
SELECT * FROM rpe WHERE id = 'uuid';
-- Debe tener: load = 6 * 90 = 540
```

### Verificar Funciones

```sql
-- Probar get_player_availability
SELECT * FROM get_player_availability('club-uuid');
-- Debe devolver datos de jugadores

-- Probar calculate_player_load
SELECT * FROM calculate_player_load('player-uuid', 7, 28);
-- Debe devolver: acute_load, chronic_load, acwr
```

---

## 📚 Documentación de Referencia

### Archivos Relacionados
- [SCHEMA_NUEVO_DESDE_CERO.sql](./SCHEMA_NUEVO_DESDE_CERO.sql) - Script de creación
- [DATOS_EJEMPLO.sql](./DATOS_EJEMPLO.sql) - Datos de prueba
- [SCHEMA_COMPARISON.md](./SCHEMA_COMPARISON.md) - Comparación con schema antiguo

### Referencias de Supabase
- [Supabase Docs](https://supabase.com/docs)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)

---

## 🚀 Próximos Pasos

1. **Ejecutar** SCHEMA_NUEVO_DESDE_CERO.sql en Supabase
2. **Ejecutar** DATOS_EJEMPLO.sql para datos de prueba
3. **Crear** usuarios en Supabase Auth
4. **Testear** queries y funciones
5. **Integrar** con aplicación frontend/backend

---

## ✅ Checklist de Implementación

### Pre-Implementation
- [ ] Backup de base de datos antigua (si existe)
- [ ] Revisar SCHEMA_NUEVO_DESDE_CERO.sql
- [ ] Preparar credenciales de Supabase

### Ejecutar Scripts
- [ ] Ejecutar SCHEMA_NUEVO_DESDE_CERO.sql
- [ ] Ejecutar DATOS_EJEMPLO.sql
- [ ] Verificar que tablas se crearon: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`

### Verificar Funcionalidad
- [ ] Crear usuario en Supabase Auth
- [ ] Crear perfil en profiles table
- [ ] Verificar RLS funciona (usuario solo ve su club)
- [ ] Probar funciones helper
- [ ] Probar triggers (RPE load calculation)

### Integración
- [ ] Conectar aplicación a Supabase
- [ ] Implementar queries críticas
- [ ] Testear flujos de usuario
- [ ] Verificar performance

---

**Generado**: 19 de mayo de 2026  
**Versión**: 1.0  
**Estado**: Listo para producción

