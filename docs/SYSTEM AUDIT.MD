# SYSTEM AUDIT

## Project Overview

Project Name: ClavaMetrics  
Status: In Stabilization Phase  
Architecture State: Mixed / Needs Refactor

---

# Global Status

| Area | Status | Notes |
|---|---|---|
| Auth | ⚠ Partial | Login works but session refresh unstable |
| Routing | ⚠ Partial | Some routes broken |
| Dashboard | ✅ Stable | Mostly functional |
| GPS Module | ❌ Broken | No DB connection |
| Wellness | ⚠ Partial | UI works, save broken |
| Injuries | ❌ Broken | Missing API |
| Gym | ⚠ Partial | Old hooks still connected |
| Notifications | ❌ Broken | No backend |
| Reports | ⚠ Partial | Data mismatch |

---

# Main Problems Detected

## Frontend
- Duplicate components
- Mixed old/new hooks
- Broken navigation
- Dead buttons
- Unused providers

## Backend
- Duplicate APIs
- Inconsistent naming
- Old endpoints still referenced

## Database
- Legacy tables still active
- Duplicated schemas
- Broken foreign keys
- Missing RLS policies

---

# Architecture Problems

## Current Problems
- UI tightly coupled to DB
- Business logic inside components
- Repeated queries
- No service layer

## Desired Architecture
- UI layer
- Service layer
- Repository layer
- Database layer

---

# Priority Order

1. Auth
2. Routing
3. Database cleanup
4. Shared hooks
5. Shared services
6. Dashboard stabilization
7. Module migration

---

# Current Tech Stack

- Next.js
- TypeScript
- Supabase
- Tailwind
- Shadcn/UI

---

# Critical Risks

| Risk | Severity |
|---|---|
| Data inconsistency | HIGH |
| Broken player relations | HIGH |
| Duplicate tables | HIGH |
| Invalid queries | MEDIUM |
| UI instability | MEDIUM |

---

# Recovery Strategy

1. Audit
2. Stabilization
3. Refactor
4. Migration
5. Testing
6. Optimization

---

# Hub.html — Audit (2026-05-19)

## Crítico

- [x] Colisión de listeners: Customize / View all / Add task apuntaban al mismo selector — corregido con IDs `btnCustomizeModules`, `btnViewAllActivity`, `btnAddTask`

## Alto

- [x] Tasks panel hardcodeado — conectado a tabla `tasks` (query por `assigned_to = userId`, ordenado por `due_date`, excluyendo canceladas)
- [x] Availability pills hardcodeadas — conectado a tabla `availability` (hoy), fallback a `players.status`
- [x] ACWR hardcodeado — calculado desde `training_sessions + rpe` (últimos 28 días), promedio de ACWR por jugador
- [x] Recent Activity completamente fabricada — conectado a `training_sessions` + `injuries` + `gps_reports` + `wellness` (feed sintético ordenado por timestamp)
- [x] Greeting subtitle hardcodeado — conectado a `microcycles` (microciclo activo + cálculo MD-X) y `training_sessions` (sesión de hoy, hora y lugar)

## Medio

- [x] Search bar sin funcionalidad — implementada búsqueda con debounce (280ms) sobre `players`, `training_sessions`, `microcycles`; shortcut ⌘K; dropdown con escape XSS
- [x] Race condition en `supabase-init.js` — `getClubId()` y `getClub()` ahora cachean la promesa en vuelo (`_clubIdPromise`, `_clubPromise`); llamadas concurrentes comparten la misma promesa
- [x] Timezone bug en wellness query — reemplazado `today` (string date) por `todayStartISO` (medianoche local como ISO timestamp); evita desfase en clubes fuera de UTC
- [x] `applyClubTheme()` llamado sin `await` — corregido

## Bajo

- [x] Sidebar badge counts — Availability (no disponibles), Load (⚠ si ACWR > 1.5), Injuries (activas) actualizados desde datos reales
- [x] KPI trend deltas hardcodeados — spans blanqueados (no hay datos históricos sin queries adicionales); squad/wellness/injuries deltas removidos
- [x] Module foot stats — Squad, Wellness, Injuries, Load red zone, Daily planning session time actualizados desde datos ya cargados
- [x] `applyClubTheme` fallback a `accent_color` inexistente — eliminado, usa solo `primary_color`


# STABILIZATION PLAN

## PHASE 1 — CORE SYSTEM

### Auth — Login.html + Register.html

#### Crítico
- [x] Register.html:588-604 — OAuth buttons corregidos: IDs + `onclick="oauthRegister()"` + función `oauthRegister()` + `showRegError()` helper
- [x] Register.html:649-697 — inserts con cleanup: `clubId` y `userId` trackeados; catch elimina club huérfano y hace `signOut()` si auth user creado
- [x] Register.html:671-674 — `country` confirmada en DB (Phase 2): añadida al insert. `sport` pendiente migration

#### Alto
- [x] Register.html — redirect a Hub.html si ya hay sesión activa añadido al inicio del script
- [x] Register.html:665-687 — si `authData.session` es null (email confirmation requerido): muestra mensaje, no inserta club/profile
- [x] Register.html:689-690 — corregido: `btn.innerHTML` con ícono restaurado en catch
- [x] Login.html:404 — `redirectTo` corregido: solo usa `window.location.origin` si el protocolo es `http/https`

#### Bajo
- [x] Login.html:399-412 — OAuth buttons: `disabled + opacity:0.6` al inicio, restaurado en error
- [x] Register.html:581 — corregido: `btn.innerHTML` con ícono restaurado en catch

### Routing

#### Crítico
- [x] **RPE.html y Wellness.html sin sidebar** — RPE: back link cambiado a Hub.html. Wellness ya tenía back a Hub. Ambas: `requireAuth()` con early return añadido
- [x] **Chat & Tasks link encoding inconsistente** — corregido en 8 archivos: `Admin.html`, `Daily Planning.html`, `Gym Planner.html`, `Nutrition.html`, `Physio.html`, `Sessions History.html`, `Evaluations.html`, `Gym Library.html`

#### Alto
- [x] **Sidebar drift** — resuelto: sidebar.js tiene nav canónico de 28 items en todas las páginas
- [x] **RPE.html linkado desde solo 2 páginas** — resuelto: RPE en nav de sidebar.js (Performance group)
- [x] **Evaluations.html linkado desde solo 6 páginas** — resuelto: Evaluations en nav de sidebar.js (Technical group)

#### Bajo
- [x] **Onboarding.html linkado desde 1 sola página** — back link a Login.html añadido en ob-rail

### Providers — supabase-init.js

#### Resuelto (sesión anterior)
- [x] Race condition en `getClubId()` + `getClub()` — promise cache implementado
- [x] `applyClubTheme()` fallback a `accent_color` inexistente — eliminado
- [x] `await applyClubTheme()` faltante en Hub.html — corregido

#### Medio
- [x] `getClub()` usa `select('*')` internamente — corregido: `select('id, name, primary_color, logo_url')`
- [x] `select('*')` corregido en 4 páginas: injuries (9 cols), wellness/Load Monitor (8 cols), messages + tasks/Chat & Tasks (cols explícitas), profiles/Admin (8 cols)
- [x] Sin helper `logout()` en supabase-init.js — `logout()` añadido: limpia cache + `signOut()` + redirect

#### Bajo
- [x] `calendar-utils.js` — tiene `tests/unit/calendar-utils.test.js`, no es huérfano real. Conservado
- [x] `getProfile()` — promise cache propio `_profilePromise` añadido; limpiado en `logout()`


### Session handling

#### Crítico
- [x] **Sin logout en ninguna página** — `logout()` helper añadido a `supabase-init.js`: limpia cache + `signOut()` + redirect
- [x] **Daily Planning.html:604** — corregido: `requireAuth()` → `getClubId()` + `getProfile()` + `getClub()` con patrón correcto

#### Alto
- [x] **RPE.html y Wellness.html** — `requireAuth()` con `if (!await ...) return` en ambas páginas
- [x] **Sin `onAuthStateChange` handler** — `onAuthStateChange` global añadido en `supabase-init.js`: redirige a Login en `SIGNED_OUT`

#### Bajo
- [x] 4 páginas sin early return (`Evaluations`, `Sessions History`, `Match Reports`, `Onboarding`) — corregidas con `if (!await window.requireAuth()) return`

### Layout

#### Crítico
- [x] **Sidebar HTML duplicado en ~19 páginas** — extraído a `assets/sidebar.js`: inyecta HTML, detecta página activa por URL, carga profile/club desde supabase-init.js. 19 páginas reemplazadas con `<div id="hub-side-root"></div>`
- [x] **Sidebar CSS duplicado inline en cada página** — ~25-32 reglas hub-* eliminadas de las 19 páginas via script. CSS de topbar/crumb/search preservado. Fuente única: `assets/sidebar.js`
- [x] **7 páginas con usuario hardcodeado en sidebar footer** — resuelto: sidebar.js carga `getProfile()` + `getClub()` dinámicamente en todas las páginas

#### Alto
- [x] **RPE.html y Wellness.html sin sidebar** — back link a Hub.html añadido en ambas (canvas layout preservado)
- [x] **Sidebar drift es estructural** — resuelto: sidebar.js es fuente única, nuevo módulo = `<div id="hub-side-root"></div>` + script

#### Bajo
- [x] `Evaluations.html` sidebar outlier — resuelto: sidebar reemplazado por `hub-side-root` como el resto

## PHASE 2 — DATABASE

### Tablas activas confirmadas (16)
`clubs` `profiles` `players` `training_sessions` `wellness` `injuries` `availability` `tasks` `microcycles` `messages` `gps_reports` `treatments` `rpe` `evaluations` `nutrition` `gym_exercises`

- [x] **Detect active tables** — 16 tablas consultadas via REST API, todas devuelven 200

### Tablas legacy
- [x] **Detect legacy tables** — ninguna tabla legacy detectada. Todas las tablas en DB están referenciadas en código

### Column mismatches — código usa nombres incorrectos

#### Crítico (queries rotas en producción)
- [x] `players.full_name` → corregido a `first_name,last_name` en select + display en Injuries.html, Daily Planning.html, Gym Planner.html (Hub/Load Monitor ya usaban nombres correctos)
- [x] `players.jersey_number` → corregido a `number` en Injuries.html, Daily Planning.html, Gym Planner.html
- [x] `training_sessions.date` → Calendar.html ya usaba `session_date` ✅ (no requirió fix)
- [x] `training_sessions.duration_min` → Calendar.html ya usaba `duration` ✅ (no requirió fix)
- [x] `rpe.score` → RPE.html ya usaba `rpe` ✅ (no requirió fix)
- [x] `rpe.submitted_at` → RPE.html ya usaba `created_at` ✅ (no requirió fix)
- [x] `gps_reports.distance_total` → real: `total_distance` — GPS Analysis.html ya usaba `total_distance` ✅
- [x] `evaluations.score` → real: `value`; `evaluations.date` → real: `test_date` — Evaluations.html ya usaba `e.value` y `e.test_date` ✅
- [x] `nutrition.fat` → real: `fats` — Nutrition.html ya usaba `fats` ✅

#### Columnas faltantes en DB — script generado: `docs/migrations/001_stabilization.sql`
- [x] `rpe.club_id` — migration incluida + backfill desde training_sessions + índice
- [x] `rpe.notes` — migration incluida
- [x] `profiles.club_role` — migration incluida
- [x] `profiles.last_seen_at` — migration incluida
- [x] `evaluations.test_name`, `test_type`, `title` — migration incluida
- [x] `clubs.sport`, `clubs.plan` — migration incluida; Register.html actualizado para insertar `sport`
- [x] `availability.notes` — migration incluida
- [x] `training_sessions.rpe_avg` — migration incluida
- [x] `treatments.duration_min`, `time`, `adaptation`, `zones` — migration incluida (treatment_type omitido: usar columna existente `type`)

#### Columnas confirmadas que el schema doc tenía incorrectas
- [x] `clubs.country` — ✅ EXISTE (Register.html puede insertar)
- [x] `training_sessions.session_date` (no `date`), `duration` (no `duration_min`)
- [x] `nutrition.fats` (no `fat`)
- [x] `training_sessions.session_time` — ✅ EXISTE (Hub.html query correcta)

### RLS
- [x] **messages RLS rota** — políticas dropeadas y reescritas sin `platform_admins`; nuevas: `messages_select`, `messages_insert`, `messages_update` basadas en `profiles.club_id`
- [x] **rpe sin club_id** — RLS habilitado con `rpe_select` + `rpe_insert` post-migration

### Relaciones
- [x] `rpe.session_id → training_sessions.id` — columna existe ✅ (FK a verificar en DB)
- [x] `gps_reports.session_id → training_sessions.id` — columna existe ✅ (FK a verificar en DB)

### Duplicados
- [x] Sin tablas duplicadas detectadas

## PHASE 3 — SHARED SYSTEMS

### Shared services
- [x] `getActivePlayers(clubId)` — añadido a `supabase-init.js`: select id,first_name,last_name,number,position,status, neq inactive, order number
- [x] `formatPlayerName(player)` — añadido a `supabase-init.js`: `${first_name} ${last_name}`.trim()

### API standardization
- [x] `Daily Planning.html:623` — `players(full_name)` corregido a `players(first_name,last_name)` + display `pl.full_name` corregido
- [x] `Sessions History.html:336` — `select('*')` corregido a columnas explícitas: `id,club_id,session_date,title,notes,session_type,duration`
- [x] `Physio.html:482` — select explícito: `id,player_id,injury_id,date,type,notes,duration_min,time,adaptation,zones,players(...)` — columnas disponibles post-migration
- [x] `Daily Planning.html` — select treatments explícito: `id,player_id,date,type,notes,adaptation,zones,players(...)`

### Shared hooks
- [ ] Backlog: migrar páginas a usar `getActivePlayers()` — 4 páginas con queries inline funcionando correctamente (Availability, Daily Planning, Injuries, Load Monitor)

### Shared components
- [x] Sidebar — `assets/sidebar.js` (completado en Phase 1)
- [ ] Backlog: Toast/notification utility — solo 2 páginas con toasts locales (Calendar, Squad); no es problema real

## PHASE 4 — CORE MODULES

### Dashboard (Hub.html)
- [x] Redundant sidebar init eliminado — conservado solo `#greetMsg` + `applyClubTheme()`
- [x] `select('*', count:exact head:true)` → `select('id', ...)`
- [x] `training_sessions.profiles(full_name, role)` join — FK confirmada: `training_sessions.coach_id → profiles` ✅

### Players (Squad.html)
- [x] Columnas correctas: `first_name, last_name, number, position` ✅
- [x] CRUD (insert/update/delete) correcto ✅
- [x] Redundant sidebar init eliminado — conservado solo `applyClubTheme()`

### Teams
- [ ] Backlog: página no existe — feature pendiente, fuera del scope de estabilización

## PHASE 5 — SPORTS MODULES

### GPS Analysis
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] `select('*', count:exact)` → `select('id', count:exact)` para players count
- [x] Columnas GPS correctas: `total_distance`, `sprint_distance`, `high_speed_distance`, `accelerations`, `max_speed` ✅

### Wellness
- [x] Sin sidebar redundante (canvas layout) ✅
- [x] Insert columns correctas: `player_id,club_id,sleep_quality,mood,fatigue,stress,soreness,readiness,submitted_at` ✅

### Injuries
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] Columns correctas en insert/update ✅

### Gym Planner
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] Queries read-only, columnas correctas ✅

### Gym Library
- [x] Sidebar init con IDs incorrectos eliminado — conservado `applyClubTheme()`
- [x] `muscles` → `muscle_group`, `complexity` → `category`, `image_url` removido del select
- [x] Card rendering actualizado: `e.muscles[]` → `e.muscle_group` (string), `e.complexity` → `e.category`

### Nutrition
- [x] Bloque `if (club)` corrompido reconstruido
- [x] Sidebar init redundante eliminado
- [x] `players.weight_kg` → `players.weight` en select y display

### Physio
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] `t.treatment_type` → `t.type` en card rendering
- [x] `t.duration_min`, `t.time`, `t.adaptation`, `t.zones` — cubiertos en migration ✅; `t.coach_adaptation`, `t.has_adaptation` → degradación graceful con `||` fallback

### Daily Planning
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] `t.adaptation`, `t.zones` — cubiertos en migration; `withAdapt` filter funciona post-migration ✅

### Load Monitor
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] Queries correctas: players + wellness con columnas explícitas ✅

## PÁGINAS ADICIONALES (auditadas fuera del plan original)

### Admin.html
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] `profiles.select(club_role, last_seen_at)` — disponibles post-migration ✅
- [x] `m.full_name` desde profiles — columna existe ✅

### Availability.html
- [x] Auth pattern correcto (`requireAuth → getClubId`) ✅
- [x] `availability.minutes` columna existe ✅
- [x] `applyClubTheme()` añadido (faltaba — sidebar.js ya cargado pero sin tema)
- [x] Columnas de queries correctas ✅

### Calendar.html
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()` + badge counts
- [x] Write payload training_sessions correcto: `title, session_type, session_date, duration, notes` ✅

### Chat & Tasks.html
- [x] Sidebar setters con IDs incorrectos eliminados (`sideUserAv`, `sideUserName`, `sideUserRole`)
- [x] `currentUser` object conservado (necesario para send message / create task)
- [x] Todas las columnas de messages e tasks verificadas ✅

### Evaluations.html
- [x] Sidebar init con IDs incorrectos eliminado — conservado `applyClubTheme()`
- [x] `evaluations.evaluation_type` — existe ✅ (tabla vacía, no error)

### Match Reports.html
- [x] Sidebar init con IDs incorrectos eliminado — conservado `applyClubTheme()`
- [x] GPS queries correctas ✅

### Planner.html
- [x] Sidebar init redundante eliminado — conservado `applyClubTheme()`
- [x] Queries read-only correctas ✅

### Sessions Library.html
- [x] Sidebar init con IDs incorrectos eliminado — conservado `applyClubTheme()`
- [x] `training_sessions` select correcto ✅

## PHASE 6 — QA

### E2E Testing

#### Auth (Login.html + Register.html) — `tests/e2e/auth.spec.js`
- [x] Login — Render: form elements, error hidden by default
- [x] Login — Session redirect: Hub.html si sesión activa
- [x] Login — Success: redirect Hub.html + loading state en botón
- [x] Login — Error: mensaje de error, botón re-enabled, label restaurado
- [x] Login — Forgot password: link visible
- [x] Register — Render: todos los campos, OAuth buttons, 4 steps, step 1 active
- [x] Register — Session redirect: Hub.html si sesión activa
- [x] Register — Email confirmation: mensaje check-email, no inserta club/profile
- [x] Register — Error handling: mensaje de error, label del botón restaurado
- [x] Register — OAuth buttons: Google + Apple llaman oauthRegister
- [x] Cross-links: Login ↔ Register links visibles

#### Módulos críticos — `tests/e2e/hub.spec.js` / `squad.spec.js` / `injuries.spec.js` / `daily-planning.spec.js`
- [x] Hub.html — render (KPIs, sidebar, greeting, module stats), search bar (typing/Cmd+K/empty state), buttons, auth guard
- [x] Squad.html — render (table/rows/empty), modal open/close/edit, form validation, save new, saving indicator, delete, auth guard
- [x] Injuries.html — render (KPI count, cards, injury type), log modal (open/fields/player select/close), save, discharge modal, auth guard
- [x] Daily Planning.html — render (squad body, physio list, date input, breadcrumb, pager), squad section (player name, count, summary), physio section (count, treatment, empty), date navigation, auth guard
- [x] Wellness.html — canvas/mockup: render, phone frames, dark mode toggle — `tests/e2e/wellness.spec.js`

### Manual testing
- [x] Checklist completo — `docs/MANUAL_TESTING.md` (Auth, Nav, Squad, Calendar, RPE, Load Monitor, Injuries, Physio, Wellness, Daily Planning, GPS, Evaluations, Sessions History, Gym, Nutrition, Planner, Match Reports, Chat & Tasks, Admin, Availability + regression checks)

### Responsive testing
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1440px)

### Accessibility
- [ ] ARIA roles + labels
- [ ] Keyboard navigation
- [ ] Focus traps en modales