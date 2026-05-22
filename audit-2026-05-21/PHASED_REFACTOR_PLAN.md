# PHASED REFACTOR PLAN — ClavaMetrics
**Fecha:** 2026-05-21  
**Basado en:** AUDIT_REPORT.md · HARDCODED_DATA_REPORT.md · BACKEND_CONNECTION_REPORT.md · UI_FAKE_INTERACTIONS_REPORT.md  

---

## PRINCIPIOS DE ESTE PLAN

1. **No parches** — cada fix conecta al backend real o elimina el elemento
2. **Orden de dependencias** — los fixes de autenticación antes que los de datos, los de datos antes que los de UI
3. **No más hardcode** — si la tabla no existe en DB, indicar qué migración se necesita
4. **Funcional > completo** — mejor 8 features que funcionan que 20 que mienten

---

## FASE 0 — LIMPIEZA DE REPOSITORIO (1-2 días)
*Sin riesgo. Sin dependencias. Sin posibilidad de romper producción.*

### 0.1 — Eliminar archivos legacy y duplicados
- Eliminar `Clavametrics old/` (versión anterior)
- Evaluar `ClavaMetrics New/` — si es idéntico al raíz, eliminar
- Evaluar `index.html` en raíz — si es versión antigua, eliminar (Hub.html es el activo)
- Eliminar `Captura de pantalla 2026-05-17*.png` del repositorio

### 0.2 — Reorganizar documentación al directorio correcto
```
docs/
  db/
    DATOS_EJEMPLO.sql
    SCHEMA_NUEVO_DESDE_CERO.sql
    SCHEMA_COMPARISON.md
  migrations/
    MIGRATION_FORWARD.sql
    MIGRATION_ROLLBACK.sql
    MIGRATION_RISKS.md
    ORDEN_MIGRACION.md
    PLAN_MIGRACION_EJECUTIVO.md
    GUIA_IMPLEMENTACION.md
    INDICE_MIGRACION.md
  ARQUITECTURE.md  (ya en raíz, ok)
  README.md        (ya en raíz, ok)
design/
  AdobeStock_213595107.ai
  AdobeStock_858843878.ai
```

### 0.3 — Eliminar HTML de demo de los archivos de producción
Para cada archivo que tenga HTML hardcodeado que JS ya reemplaza con datos reales:
- Vaciar el contenedor `innerHTML` en el HTML estático
- Dejar solo el contenedor vacío con su ID
- El JS ya renderiza el contenido correcto

**Archivos afectados:** Hub.html (activity, tasks), Calendar.html (season ribbon, match markers, upcoming), Daily Planning.html (squad, exercises), Planner.html (drills, field objects), Admin.html (clubs grid), Gym Library.html, Gym Planner.html

**Riesgo:** BAJO — el JS ya reemplaza. Eliminar el fallback solo mejora honestidad.

---

## FASE 1 — AUTH (Semana 1)
*Bloquea todo lo demás. Sin auth funcional no hay producto.*

### 1.1 — Google OAuth (CRÍTICO) ✅ DONE 2026-05-21
**Archivos:** `auth-callback.html`, `Login.html`, `Register.html`

**Diagnóstico previo requerido:**
```
1. Ir a Supabase Dashboard > Auth > URL Configuration
2. Verificar que el Site URL y Redirect URLs incluyen la URL exacta del proyecto
3. Revisar auth-callback.html: confirmar que llama supabase.auth.exchangeCodeForSession(code)
4. Verificar que el redirect_to en signInWithOAuth apunta a auth-callback.html
```

**Fix:**
```javascript
// auth-callback.html — debe hacer esto:
const { data, error } = await supabase.auth.exchangeCodeForSession(
  new URLSearchParams(location.search).get('code')
)
if (!error) {
  // Redirigir a Hub o Onboarding si es nuevo usuario
  const isNew = data.user.created_at === data.user.updated_at
  location.href = isNew ? 'Onboarding.html' : 'Hub.html'
}
```

**Requiere:** Configuración correcta en Supabase Dashboard (no código)

### 1.2 — Register "Database error saving new user" (CRÍTICO) ✅ DONE 2026-05-21
**Archivos:** `Register.html`, Supabase RLS policies — migración: `audit-2026-05-21/MIGRATION_AUTH_RLS.sql`

**Diagnóstico:**
```sql
-- Verificar en Supabase SQL Editor:
SELECT * FROM pg_policies WHERE tablename = 'profiles';
SELECT * FROM pg_policies WHERE tablename = 'clubs';
```

**Fix probable:**
```sql
-- Si no existe trigger para crear profile en registro:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, club_id)
  VALUES (new.id, new.email, 'coach', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Requiere:** Migración DB (trigger + RLS update)

### 1.3 — Sport selection en Register
**Archivo:** `Register.html` líneas 513-527, handler de submit ~693

No requiere cambio si el valor se lee correctamente del DOM al submit. Verificar que:
1. El DOM tiene el sport seleccionado cuando llega al submit handler
2. El campo `sport` existe en la tabla `clubs` o `profiles`

---

## FASE 2 — ELIMINAR HARDCODE CRÍTICO EN HTML (Semana 1-2)
*Más impactante visualmente. Requiere que los queries ya existan (la mayoría sí existen).*

### 2.1 — Calendar Season Ribbon (CRÍTICO)
**Archivo:** `Calendar.html` líneas 504-538

**Acción:** Eliminar todo el HTML hardcodeado del ribbon. Crear función `renderSeasonRibbon(microcycles, seasonStart, seasonEnd)`:

```javascript
function renderSeasonRibbon(microcycles, seasonStart, seasonEnd) {
  const totalDays = (seasonEnd - seasonStart) / 86400000
  const container = document.querySelector('.ribbon-mcs')
  container.innerHTML = ''
  
  microcycles.forEach(mc => {
    const mcStart = new Date(mc.start_date)
    const mcEnd = new Date(mc.end_date)
    const left = ((mcStart - seasonStart) / 86400000 / totalDays) * 100
    const width = ((mcEnd - mcStart) / 86400000 / totalDays) * 100
    
    const el = document.createElement('div')
    el.className = 'ribbon-mc' + (mc.has_match ? ' is-match' : '')
    el.style.cssText = `left:${left}%;width:${width}%`
    el.title = mc.name
    container.appendChild(el)
    
    if (mc.match_date) {
      const matchLeft = ((new Date(mc.match_date) - seasonStart) / 86400000 / totalDays) * 100
      const marker = document.createElement('div')
      marker.className = 'ribbon-match'
      marker.style.left = matchLeft + '%'
      marker.title = mc.opponent || 'Match'
      container.appendChild(marker)
    }
  })
}
```

**Requiere:** Verificar que `microcycles` tiene los campos `start_date, end_date, match_date, opponent, name`. Si `opponent` no existe, agregar a la tabla.

### 2.2 — Calendar Upcoming Events
**Archivo:** `Calendar.html` líneas 627-676

```javascript
async function renderUpcomingEvents() {
  const today = new Date().toISOString().split('T')[0]
  const in14d = new Date(Date.now() + 14*86400000).toISOString().split('T')[0]
  
  const { data: sessions } = await window.sb
    .from('training_sessions')
    .select('id, date, name, session_type, start_time')
    .gte('date', today)
    .lte('date', in14d)
    .order('date')
    .limit(8)
  
  const container = document.querySelector('.upcoming-list')
  container.innerHTML = (sessions || []).map(s => `
    <div class="upcoming-item">
      <div class="upcoming-date">${formatDate(s.date)}</div>
      <div class="upcoming-name">${s.name}</div>
      <div class="upcoming-type">${s.session_type} · ${s.start_time}</div>
    </div>
  `).join('') || '<p class="empty">No hay eventos próximos</p>'
}
```

### 2.3 — Hub Activity Feed y Task List
**Archivo:** `Hub.html` líneas 722-817

Simplemente vaciar el HTML estático dentro de `#activityFeed` y `#taskList`. Los renderers ya existen y funcionan.

### 2.4 — Admin Org Bar y Clubs Grid ✅ DONE 2026-05-21
**Archivo:** `Admin.html` líneas 319-462

Crear queries reales:
```javascript
async function loadOrgData() {
  const { data: org } = await window.sb
    .from('organizations')
    .select('name, clubs(count)')
    .eq('id', currentOrgId)
    .single()
  
  const { data: members } = await window.sb
    .from('profiles')
    .select('id', { count: 'exact' })
    .eq('org_id', currentOrgId)
  
  document.querySelector('.org-name').textContent = org.name
  document.querySelector('.org-clubs').textContent = `${org.clubs.length} clubs`
  document.querySelector('.org-members').textContent = `${members.length} members`
}

async function loadClubs() {
  const { data: clubs } = await window.sb
    .from('clubs')
    .select('*')
    .eq('org_id', currentOrgId)
  
  const container = document.querySelector('.clubs-grid')
  container.innerHTML = clubs.map(renderClubCard).join('')
}
```

**Requiere:** Verificar que la tabla `organizations` existe con los campos correctos.

---

## FASE 3 — PHYSIO SAVE (Semana 2)
*Feature completamente rota — los tratamientos no se guardan en ningún caso.*

### 3.1 — Implementar saveTreatment()
**Archivo:** `Physio.html` líneas 286-290, 452-468

```javascript
async function saveTreatment() {
  const player_id = document.getElementById('treatmentPlayer').value
  const date = document.getElementById('treatmentDate').value
  const type = document.getElementById('treatmentType').value
  const notes = document.getElementById('treatmentNotes').value
  const adaptation = document.getElementById('treatmentAdaptation').value
  const zones = Array.from(selectedZones) // el Set ya existe
  
  const { error } = await window.sb
    .from('treatments')
    .insert({ player_id, date, type, notes, adaptation, body_zones: zones, club_id: currentClubId })
  
  if (error) return showError(error.message)
  closeModal()
  loadTreatments() // refrescar lista
}

document.getElementById('saveTreatmentBtn').onclick = saveTreatment
```

---

## FASE 4 — ONBOARDING SAVE COMPLETO (Semana 2)
*Pérdida de datos silenciosa en el onboarding.*

### 4.1 — Extender saveAndContinue()
**Archivo:** `Onboarding.html` líneas 515-531

```javascript
async function saveAndContinue() {
  const payload = {
    name: document.getElementById('clubName').value,
    short_name: document.getElementById('clubShortName').value,
    city: document.getElementById('clubCity').value,
    timezone: document.getElementById('clubTimezone').value,
    categories: Array.from(document.querySelectorAll('.cat-chip.is-selected'))
                     .map(el => el.dataset.category),
    plan: document.querySelector('.plan-card.is-selected')?.dataset.plan
  }
  
  const { error } = await window.sb
    .from('clubs')
    .update(payload)
    .eq('id', currentClubId)
  
  if (error) return showError('Error guardando datos del club')
  goToNextStep()
}
```

---

## FASE 5 — FILTERS FUNCIONALES (Semana 2-3)
*Baja complejidad, alto impacto en usabilidad.*

### 5.1 — Sessions History filters ✅ DONE 2026-05-21
**Archivo:** `Sessions History.html` líneas 455-459

```javascript
function applyFilters() {
  const activeFilters = {}
  document.querySelectorAll('.sh-opt.is-on').forEach(el => {
    const key = el.dataset.filterKey
    const val = el.dataset.filterVal
    activeFilters[key] = val
  })
  
  let query = window.sb.from('training_sessions').select('*').eq('club_id', currentClubId)
  if (activeFilters.microcycle) query = query.eq('microcycle_id', activeFilters.microcycle)
  if (activeFilters.orientation) query = query.eq('orientation', activeFilters.orientation)
  if (activeFilters.type) query = query.eq('session_type', activeFilters.type)
  
  query.order('date', { ascending: false }).then(({ data }) => renderSessionList(data))
}

document.querySelectorAll('.sh-opt').forEach(el => 
  el.addEventListener('click', () => { el.classList.toggle('is-on'); applyFilters() })
)
```

### 5.2 — Task filters (Chat & Tasks) ✅ DONE 2026-05-21
**Archivo:** `Chat & Tasks.html` líneas 403-407

```javascript
document.querySelectorAll('.task-filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.task-filter-pill').forEach(p => p.classList.remove('is-on'))
    pill.classList.add('is-on')
    const category = pill.dataset.category // 'all', 'mine', 'match-day', etc.
    loadTasks(category)
  })
})

async function loadTasks(category = 'all') {
  let query = window.sb.from('tasks').select('*').eq('club_id', currentClubId)
  if (category === 'mine') query = query.eq('assigned_to', currentUserId)
  else if (category !== 'all') query = query.eq('category', category)
  
  const { data } = await query.order('created_at', { ascending: false })
  renderKanban(data)
}
```

### 5.3 — Evaluations tabs ✅ DONE 2026-05-21
**Archivo:** `Evaluations.html` línea 455

```javascript
function switchEvalTab(tabId) {
  document.querySelectorAll('.eval-tab').forEach(t => t.classList.remove('is-on'))
  document.querySelectorAll('.eval-view').forEach(v => v.classList.remove('is-on'))
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('is-on')
  document.querySelector(`#evalView-${tabId}`).classList.add('is-on')
  loadEvalData(tabId) // cargar datos específicos de cada tab
}
```

---

## FASE 6 — DAILY PLANNING CONECTADO ✅ DONE 2026-05-22
*Alta complejidad. Requiere que `session_exercises` y `availability` estén pobladas.*

### 6.1 — Load squad + availability desde DB
**Archivo:** `Daily Planning.html` líneas 339-377

```javascript
async function loadSquad(sessionDate) {
  const { data: players } = await window.sb
    .from('players')
    .select(`
      id, name, number, position,
      availability!inner(status, notes)
    `)
    .eq('club_id', currentClubId)
    .eq('availability.date', sessionDate)
  
  const container = document.querySelector('.squad-list')
  container.innerHTML = players.map(p => renderPlayerRow(p)).join('')
}
```

**Requiere:** Verificar que `availability` tiene registros para las fechas correctas.

### 6.2 — Load session exercises desde DB
```javascript
async function loadSessionExercises(sessionId) {
  const { data } = await window.sb
    .from('session_exercises')
    .select('*, exercises(*)')
    .eq('session_id', sessionId)
    .order('position')
  
  renderExerciseList(data)
  updateTotalsBar(data)
}
```

**Requiere:** Tabla `session_exercises` existente con campos `session_id, exercise_id, position, duration, notes`.

---

## FASE 7 — ADMIN MODULE TOGGLES ✅ DONE 2026-05-22
*Requiere tabla `club_settings` — migración: `audit-2026-05-21/MIGRATION_CLUB_SETTINGS.sql`*

```javascript
async function toggleModule(moduleKey, enabled) {
  const { error } = await window.sb
    .from('club_settings')
    .upsert({ club_id: currentClubId, module_key: moduleKey, enabled })
  
  if (error) {
    // revertir toggle si falla
    const toggle = document.querySelector(`[data-module="${moduleKey}"] .toggle`)
    toggle.classList.toggle('is-on')
  }
}

document.querySelectorAll('.module-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('is-on')
    toggleModule(toggle.closest('[data-module]').dataset.module, toggle.classList.contains('is-on'))
  })
})
```

**Requiere:** Tabla `club_settings` con `club_id, module_key, enabled`.

---

## FASE 8 — GPS Y LOAD MONITOR: CHARTS REALES ✅ DONE 2026-05-22
*Complejidad técnica alta. Requiere Chart.js o similar.*

### 8.1 — ACWR Chart (Load Monitor)
Reemplazar SVG estático con Chart.js:

```javascript
async function renderACWRChart(playerId) {
  // Calcular ACWR: carga_7d / carga_28d
  const { data } = await window.sb
    .from('wellness_submissions')
    .select('submitted_at, session_load')
    .eq('player_id', playerId)
    .order('submitted_at', { ascending: false })
    .limit(28)
  
  const acwrValues = calculateACWR(data)
  
  new Chart(document.getElementById('acwrChart'), {
    type: 'line',
    data: { labels: acwrValues.map(d => d.date), datasets: [{ data: acwrValues.map(d => d.acwr) }] },
    options: { plugins: { annotation: { lines: [{ value: 1.5, color: 'red' }] } } }
  })
}
```

### 8.2 — GPS Radar Chart
```javascript
function renderRadarChart(playerMetrics, teamAvg) {
  const canvas = document.getElementById('gpsRadar')
  // Calcular z-scores: (player - mean) / stdDev para cada métrica
  const zScores = ['distance', 'hsr', 'sprints', 'max_speed', 'accel'].map(metric => ({
    metric,
    z: (playerMetrics[metric] - teamAvg[metric].mean) / teamAvg[metric].std
  }))
  drawRadarPolygon(canvas, zScores)
}
```

---

## FASE 9 — PLANNER EDITOR (Semana 5+)
*La tarea más compleja. Requiere decisión arquitectónica.*

### Opción A — Fabric.js (Recomendada)
- Integrar Fabric.js para canvas manipulation
- Persistir `canvas.toJSON()` en Supabase como campo `drill.objects_json`
- Cargar con `canvas.loadFromJSON(drill.objects_json)`
- **Esfuerzo:** 2-3 semanas
- **Riesgo:** BAJO — Fabric.js es maduro

### Opción B — Konva.js
- Más moderno, mejor performance con muchos objetos
- **Esfuerzo:** similar a Fabric.js
- **Riesgo:** BAJO

### Opción C — Rediseño completo del Planner
- Si el planner es core del producto, considerar migrar a React/Svelte para este módulo
- **Esfuerzo:** 4-6 semanas
- **Riesgo:** ALTO — rompe compatibilidad con el resto del proyecto HTML

**Recomendación:** Opción A. Fabric.js resuelve el 90% de lo que el planner necesita sin rediseño.

---

## DEPENDENCIAS ENTRE FASES

```
Fase 0 (limpieza) → sin dependencias → hacer primero
Fase 1 (auth) → sin dependencias → bloquea todo en producción
Fase 2 (hardcode removal) → no requiere fase 1, pero depende de queries existentes
Fase 3 (physio save) → requiere tabla treatments correcta
Fase 4 (onboarding) → requiere clubs table con campos correctos
Fase 5 (filters) → requiere queries base funcionando
Fase 6 (daily planning) → requiere session_exercises table
Fase 7 (admin toggles) → requiere club_settings table
Fase 8 (charts) → requiere wellness_submissions y gps_reports con datos reales
Fase 9 (planner) → requiere drills y session_drills tables
```

---

## MIGRACIONES DB REQUERIDAS

| Tabla | Acción | Fase |
|-------|--------|------|
| `auth.users` trigger | Crear trigger para auto-crear profile en registro | 1 |
| `profiles` RLS | Revisar/corregir políticas para INSERT en registro | 1 |
| `microcycles` | Verificar campos: start_date, end_date, match_date, opponent, name | 2 |
| `organizations` | Verificar existencia de tabla | 2 |
| `session_exercises` | Verificar/crear tabla | 6 |
| `club_settings` | Crear tabla si no existe | 7 |
| `drills` / `session_drills` | Verificar/crear con campo objects_json | 9 |
| `drill_versions` | Crear para historial de versiones | 9 |

---

## ESTIMACIÓN DE ESFUERZO

| Fase | Complejidad | Días estimados | Puede romper prod |
|------|-------------|----------------|-------------------|
| 0 — Limpieza | Muy baja | 1-2 | NO |
| 1 — Auth | Alta | 3-5 | SÍ — necesita QA completo |
| 2 — Hardcode removal | Baja | 3-4 | Riesgo bajo |
| 3 — Physio save | Baja-Media | 1-2 | NO |
| 4 — Onboarding | Baja | 1 | NO |
| 5 — Filters | Media | 3-4 | NO |
| 6 — Daily Planning | Alta | 5-7 | Posible si session_exercises no existe |
| 7 — Admin toggles | Media | 2-3 | NO |
| 8 — Charts reales | Alta | 5-7 | NO (reemplaza SVG estático) |
| 9 — Planner editor | Muy alta | 15-20 | Reescritura parcial |
| **TOTAL** | | **~40-55 días** | |

---

## QUICK WINS (< 4 horas cada uno)

1. ~~Vaciar HTML de demo en Hub.html (activity + tasks) → honestidad inmediata~~ ✅ **DONE 2026-05-21**
2. ~~Vaciar HTML de demo en Calendar.html (season ribbon, upcoming) → misma razón~~ ✅ **DONE 2026-05-21**
3. ~~Agregar `renderSeasonRibbon()` y `renderUpcoming()` al Calendar~~ ✅ **DONE 2026-05-21**
4. ~~Implementar `saveTreatment()` en Physio → feature rota, fix simple~~ ✅ **DONE 2026-05-21**
5. ~~Extender `saveAndContinue()` en Onboarding → pérdida de datos silenciosa, fix simple~~ ✅ **DONE 2026-05-21** (name+country guardados; city/timezone/categories pendientes de migración DB)
6. ~~Agregar `new Date().toLocaleTimeString()` en ios-frame.jsx → trivial~~ ✅ **DONE 2026-05-21** (live clock con `React.useState`/`React.useEffect`, interval de 10s)
7. ~~Conectar `dupSess()` en Sessions History → función vacía, fix trivial~~ ✅ **DONE 2026-05-21** (INSERT a `training_sessions` con copia de campos, title prefijado "Copy of…")
8. ~~Agregar redirect correcto a "+ Add task" en Hub → botón que hace lo contrario de lo esperado~~ ✅ **DONE 2026-05-21** (reemplazado redirect por modal real con INSERT a `tasks`)
9. ~~Implementar `settings-drawer.jsx` tab de Notifications con contenido básico~~ ✅ **DONE 2026-05-21** (tab switching real, panel Notifications con toggles persistidos en localStorage, panel Account con email/signout desde Supabase)
10. ~~Agregar confirmación antes de Reset en settings-drawer~~ ✅ **DONE 2026-05-21** (inline confirm "Yes, reset" / "Cancel" — no más reset accidental)
