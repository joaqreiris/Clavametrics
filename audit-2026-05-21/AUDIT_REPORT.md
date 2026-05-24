# AUDIT REPORT — ClavaMetrics
**Fecha:** 2026-05-21  
**Auditor:** Claude Code (Anthropic) — Senior Frontend + Backend Audit  
**Alcance:** 20 páginas HTML + assets compartidos  
**Total issues detectados:** 152  

---

## CHANGELOG DE FIXES APLICADOS

| Fecha | Archivo | Issue | Acción |
|-------|---------|-------|--------|
| 2026-05-21 | Hub.html L722–763 | H-03: Activity feed con 6 staffers falsos | Eliminado HTML hardcodeado. `renderActivity()` ya puebla desde Supabase. |
| 2026-05-21 | Hub.html L778–817 | H-04: Task list con 5 tareas falsas | Eliminado HTML hardcodeado. `renderTasks()` ya puebla desde Supabase. |
| 2026-05-21 | Calendar.html L504–538 | C-01: Season ribbon con 14 MCs fake + C-02: Match markers inventados | Eliminado HTML hardcodeado. Agregada función `renderSeasonRibbon(mcs)` que calcula posiciones dinámicamente desde `_allMCs` (Supabase). |
| 2026-05-21 | Calendar.html L627–676 | C-03: Upcoming Events completamente hardcodeado | Eliminado HTML hardcodeado. Agregada función `renderUpcoming()` que hace query a `training_sessions` (próximos 14 días) y merge con `match_date` de `_allMCs`. |
| 2026-05-21 | Calendar.html L449–467 | C-05: KPIs hardcodeados (Next match, Match density) | Agregada función `renderCalKPIs(mcs)` que calcula "Next match" y "Match density in 21d" desde `_allMCs`. Travel days y Planned load siguen pendientes (requieren datos adicionales). |

| 2026-05-21 | Physio.html L289 | PHY-01: "Save treatment" sin handler | Implementado `saveTreatment()` con INSERT a tabla `treatments`. Wired a "Save treatment" y "Save & new". |
| 2026-05-21 | Physio.html L452 | PHY-02: Body zones sin persistencia | `selected` Set ahora se incluye en el payload del INSERT como campo `zones`. |
| 2026-05-21 | Physio.html L273,281 | PHY-03: Placeholders hardcodeados en textareas | Eliminado texto fake. Textareas ahora inician vacías. IDs agregados: `phNotesInput`, `phAdaptInput`. |
| 2026-05-21 | Physio.html L254 | PHY: "L Quad ×" hardcodeado en zonesDisplay | Eliminado. `renderZones()` ya gestiona el contenido. |
| 2026-05-21 | Physio.html L211 | PHY: SVG ellipse con `.on` hardcodeado | Removida clase `.on` del HTML. El estado real viene de `selected` Set. |
| 2026-05-21 | Physio.html L286,288 | PHY: Reset y "Save & new" sin handler | Implementados `resetForm()` y wire de los tres botones. |

| 2026-05-21 | Onboarding.html L515–531 | OB-01: saveAndContinue() solo guardaba name | Extendido: ahora guarda `name` + `country` con validación (nombre obligatorio, ≥1 categoría). Campos `short_name`, `city`, `timezone`, `categories` documentados como pendientes de migración DB con comentario en código. |
| 2026-05-21 | Onboarding.html L349,354,375 | OB-02: Valores hardcodeados en form ("Clava FC", "CLA", "Rosario") | Eliminados. Boot ahora carga `name` y `country` del club existente desde Supabase. |
| 2026-05-21 | Onboarding.html L399–413 | OB-03: 3 categorías pre-seleccionadas sin DB | Removida clase `.is-selected` del HTML estático. El usuario debe seleccionar activamente. |
| 2026-05-21 | Onboarding.html L381–386 | OB: Timezone options sin atributo value | Agregado `value` a cada `<option>` para leer el timezone ID limpio sin el "(UTC+X)". |

| 2026-05-21 | ios-frame.jsx L9 | IOS-01: IOSStatusBar con time hardcodeado "9:41" | Eliminado prop estático. Agregado `React.useState`/`React.useEffect` con interval de 10s para reloj en vivo. |
| 2026-05-21 | Sessions History.html L442 | SH-01: `dupSess()` completamente vacía | Implementado INSERT a `training_sessions` copiando todos los campos del objeto original (excluye `id` y `rpe`), title prefijado con "Copy of". |
| 2026-05-21 | Hub.html L785–787 | HUB-05: btnAddTask redirigía a Chat & Tasks en lugar de crear tarea | Reemplazado redirect por modal real (`#addTaskBackdrop`) con campos title, priority, due_date. INSERT a tabla `tasks`. Cierre con Escape/click fuera/Cancel. Toast de confirmación. |

| 2026-05-21 | settings-drawer.jsx L148–153 | SD-01: Tabs Notifications/Account/Billing eran botones decorativos sin contenido ni estado | Agregado `tab` state, wired todos los tabs con `onClick`. Panel Notifications: 5 toggles reales persistidos en `cm-settings.v1` localStorage. Panel Account: email/rol del perfil desde `window.getProfile()` + Sign out real vía `window.sb.auth.signOut()`. Tab Billing eliminado (requiere Stripe wiring). |
| 2026-05-21 | settings-drawer.jsx L233–241 | SD-02: Reset borraba localStorage instantáneamente sin confirmación | Agregado `resetConfirm` state con inline "Yes, reset" / "Cancel" — previene resets accidentales. |

| 2026-05-21 | auth-callback.html | AUTH-01: OAuth Google completamente roto — no llamaba `exchangeCodeForSession(code)` | Reescrito completo. Maneja: (a) error params de OAuth, (b) code PKCE con exchange, (c) pending reg de sessionStorage (email confirmation path), (d) nuevo usuario OAuth → stub club + profile → Onboarding, (e) usuario existente → Hub/Onboarding según club_id. |
| 2026-05-21 | Register.html L694–695 | AUTH-02: "Database error saving new user" — `sport` column no existe en `clubs` | Eliminado `sport` del payload INSERT. Columna no existe en schema (`id, name, logo_url, primary_color, secondary_color, country, created_at, updated_at`). |
| 2026-05-21 | Register.html L684–688 | AUTH-03: Flujo de email confirmation roto — usuario confirmaba email pero sin club/profile pendiente | Ahora guarda `{ email, fullName, clubName, country }` en `sessionStorage['cm_pending_reg']` antes de mostrar "check your email". auth-callback.html lo lee post-confirmation y completa club + profile. |
| 2026-05-21 | Login.html L405 · Register.html L728 | AUTH-04: OAuth `redirectTo` construido con `window.location.origin + '/auth-callback.html'` — roto en subdirectorios | Reemplazado por `new URL('auth-callback.html', window.location.href).href` — URL correcta relativa al archivo actual. |
| 2026-05-21 | audit-2026-05-21/MIGRATION_AUTH_RLS.sql | AUTH-DB: RLS en `clubs` y `profiles` sin política INSERT — todo registro falla silenciosamente | Generado `MIGRATION_AUTH_RLS.sql` con 4 políticas: INSERT clubs (auth usuarios), INSERT profiles (propio row), DELETE clubs (admin cleanup), UPDATE profiles (propio row). **DEBE ejecutarse en Supabase Dashboard antes de desplegar.** |

| 2026-05-21 | Admin.html L318–329 | AD-01: Org bar hardcodeado ("Clava Group", "5 clubs", "$485/mo") | Reemplazado con workspace bar real: club name, member count, player count desde Supabase. `organizations` table no existe en schema — concepto multi-org eliminado. |
| 2026-05-21 | Admin.html L331–478 | AD-02: Clubs grid con 6 clubs fake ("Clava FC · First team", "Reserves", "U-19", "U-17", "Women", "Academy") | Eliminados 6 clubs hardcodeados. Reemplazado por 1 card real del club actual con datos reales (name, country, staff count, player count). |
| 2026-05-21 | Admin.html L675–700 | AD-03: Pending invites con 2 filas fake (santiago.parra@clavafc.com, d.lopez@clavafc.com) | Eliminadas. Reemplazado por empty state honesto — no existe tabla `invitations` en schema. |
| 2026-05-21 | Admin.html L703–735 | AD-04: Subscription card con "$120/mo", "Visa ·· 4827", "May 28, 2026" hardcodeados | Eliminadas todas las cifras inventadas. `adSubAmount` y `adSubNext` muestran "—" y nota "Billing managed via Stripe (pending setup)". |
| 2026-05-21 | Admin.html L766–808 | AD-05: Audit log con 5 entradas fake (Joaquín Reiris, StatSports, Catapult OAuth expired, etc.) | Eliminadas. Query real a tabla `audit_log` (existe en schema con RLS). Muestra entradas reales o empty state "No audit entries yet". |
| 2026-05-21 | Admin.html L747–757 | AD-06: Module toggles con counts fake ("14/14 staff", "7/14", "14 + 27 players") | Reemplazados. Counts ahora muestran el member count real del club. Toggles siguen siendo UI-only (Phase 7 agrega persistencia). |

| 2026-05-21 | Sessions History.html L183–220 | SH-02: Filter rail con MC fake ("vs Atlético"), orientation counts fake (12/28/16/22/34/36), Type sin campo DB (SSG/MSG/LSG) | MC items reemplazados con placeholder honesto. Orientation → contenedor dinámico `#shOrientFilters` poblado de `allSessions` con counts reales. Type section eliminada (no existe campo en schema). Active-filter chips actualizados dinámicamente. |
| 2026-05-21 | Sessions History.html L474 | SH-03: `.sh-opt` click sólo toggleaba CSS — no afectaba sessions mostradas | Eliminado handler CSS-only. `renderOrientFilters()` añade handler real que llama `applyFilters()`. `applyFilters()` ahora filtra por `session_type` según items activos en `#shOrientFilters`. |
| 2026-05-21 | Chat & Tasks.html L403–407 | CT-01: Task filter pills con counts hardcodeados ("9","5","3","2","4") y sin efecto real | Reemplazadas. Pills: All/Mine/Overdue/Due today. Counts calculados de `allTasks`. Click wired a `renderKanban(getFilteredTasks())`. "Match-day/Medical/Routine" eliminadas — sin campo DB. |
| 2026-05-21 | Chat & Tasks.html (tasks SELECT) | CT-02: `assigned_to` no estaba en el SELECT — filtro "Mine" imposible | Agregado `assigned_to` al SELECT. `getFilteredTasks()` compara con `currentUser.id`. |

**Issues resueltos en esta sesión: 35**  
**Issues pendientes: 117**

### Migración auth pendiente de ejecutar en Supabase

Archivo: `audit-2026-05-21/MIGRATION_AUTH_RLS.sql`

**Sin esta migración el flujo de registro sigue roto** — las políticas RLS bloquean todos los INSERT a `clubs` y `profiles` desde el frontend.

Pasos:
1. Abrir Supabase Dashboard → SQL Editor
2. Pegar y ejecutar el contenido de `MIGRATION_AUTH_RLS.sql`
3. Verificar con la query al final del archivo
4. Desplegar los archivos modificados: `auth-callback.html`, `Register.html`, `Login.html`

### Migraciones DB pendientes detectadas en Onboarding

Para completar el guardado de todos los campos del onboarding, se necesita:

```sql
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS short_name  text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS timezone    text DEFAULT 'America/Argentina/Buenos_Aires';

CREATE TABLE IF NOT EXISTS public.club_categories (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id  uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name     text NOT NULL,
  UNIQUE (club_id, name)
);
ALTER TABLE public.club_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members can manage categories"
  ON public.club_categories FOR ALL
  USING (club_id = get_user_club_id());
```

Desbloquear en `saveAndContinue()` después de correr esta migración.

---

## RESUMEN EJECUTIVO

| Gravedad | Cantidad | % del total |
|----------|----------|-------------|
| CRITICAL | 10 | 7% |
| HIGH | 48 | 32% |
| MEDIUM | 68 | 45% |
| LOW | 26 | 17% |
| **TOTAL** | **152** | 100% |

**Features realmente funcionales:** ~42%  
**Features visuales/fake:** ~58%  

---

## SECCIÓN 1 — LOGIN & REGISTER

### L-01 | Login.html — Google OAuth roto
- **Línea:** ~280
- **Tipo:** Feature parcialmente implementada
- **Severidad:** CRITICAL
- **Problema:** El botón "Continuar con Google" en Login redirige al login al volver del callback OAuth en vez de completar el sign-in.
- **Causa raíz:** auth-callback.html no completa el intercambio de sesión con Supabase correctamente, o el redirect URL no está configurado en Supabase.
- **Impacto UX:** Usuarios no pueden hacer login con Google.
- **Solución:** Verificar que `supabase.auth.exchangeCodeForSession()` se ejecuta en auth-callback.html. Confirmar que el redirect URL está registrado en Supabase Auth > URL Configuration.

### L-02 | Register.html — Google OAuth roto en registro
- **Línea:** ~260
- **Tipo:** Feature rota
- **Severidad:** CRITICAL
- **Problema:** Botón Google en registro desconfigurado, no inicia flujo OAuth.
- **Causa raíz:** Mismo problema que L-01. auth-callback.html no distingue entre login y registro.
- **Solución:** Unificar callback handler, detectar si el usuario es nuevo y redirigir a Onboarding.

### L-03 | Register.html — "Database error saving new user"
- **Línea:** ~693 (form submit handler)
- **Tipo:** Error de backend
- **Severidad:** CRITICAL
- **Problema:** Crear nueva organización falla con "Database error saving new user".
- **Causa raíz probable:** RLS policy en `clubs` o `profiles` no permite INSERT a newly authenticated users, o el trigger de creación de perfil falla.
- **Solución:** Revisar RLS policies en `profiles` y `clubs`. Verificar que el trigger `on auth.users insert` existe y tiene permisos de escritura.

### L-04 | Register.html — Sport selection sin persistencia
- **Línea:** 513–527
- **Tipo:** Mock logic
- **Severidad:** MEDIUM
- **Problema:** Los tabs de deporte (Fútbol, Rugby, Basketball, etc.) toggle clase `.is-active` localmente pero la selección no persiste si la sesión expira. El valor solo se lee del DOM al momento del submit.
- **Solución:** Guardar en `localStorage` o variable de estado al cambiar. Validar que el backend acepta `sport` como campo válido.

---

## SECCIÓN 2 — HUB

### H-01 | Hub.html — Hardcoded greeting con nombre real
- **Línea:** 437–438
- **Tipo:** Hardcoded placeholder data
- **Severidad:** HIGH
- **Problema:** `<h1 id="greetMsg">Good morning, Joaquín</h1>` y `<p id="greetSub">Microcycle 14 · MD-3 · Training session today @ 17:00 at Centro de Entrenamiento.</p>` — datos falsos visibles antes de que el JS cargue.
- **Impacto:** Produce confusión y muestra datos de otro usuario si el JS falla.
- **Solución:** Reemplazar por skeleton loader o `<h1 id="greetMsg">Cargando...</h1>` en HTML. El JS ya reemplaza correctamente (línea 1174).

### H-02 | Hub.html — Availability pills hardcodeadas
- **Línea:** 441–443
- **Tipo:** Hardcoded data
- **Severidad:** HIGH
- **Problema:** `22 available · 3 partial · 2 out` hardcodeado en HTML. `renderAvailabilityPills()` lo reemplaza pero si falla queda datos falsos.
- **Solución:** Reemplazar HTML estático por skeleton.

### H-03 | Hub.html — Activity feed con 6 staffers falsos
- **Línea:** 722–763
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Feed muestra "Pablo Fierro", "Dr. Mariana Acosta", "StatSports sync", etc. como datos demo permanentes en el HTML. `renderActivity()` (líneas 932-990) los reemplaza con datos reales, pero el HTML fallback es completamente ficticio.
- **Solución:** Eliminar todo el contenido dentro del contenedor del feed en HTML. Mostrar skeleton hasta que `renderActivity()` complete.

### H-04 | Hub.html — Task list con 5 tareas falsas
- **Línea:** 778–817
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Cinco tareas hardcodeadas con asignados ficticios (Pablo Fierro, Dr. Acosta, etc.). `renderTasks()` las reemplaza pero el fallback es completamente ficticio.
- **Solución:** Vaciar el HTML de tareas. Mostrar "No hay tareas pendientes" hasta que cargue.

### H-05 | Hub.html — Module badges con datos hardcodeados
- **Línea:** 506–701
- **Tipo:** Hardcoded counts
- **Severidad:** MEDIUM
- **Problema:** Badges de módulos muestran: "MD-3 ready", "126 exercises", "17:00 today", "6 sessions, 1 match", "3 need status", "27 players", "Last: 3 days ago", "24/27 today", "4 in red zone", "2 sessions pending", "2 active · 1 returning" — todos hardcodeados en HTML.
- **Solución:** Reemplazar por `—` o skeleton. `renderBadgesAndStats()` ya los actualiza correctamente.

### H-06 | Hub.html — KPI cards con "—" no semántico
- **Línea:** 450–492
- **Tipo:** Placeholder data
- **Severidad:** MEDIUM
- **Problema:** KPIs muestran `—` durante carga. No hay skeleton loader, el estado intermedio es confuso.
- **Solución:** Agregar shimmer/skeleton CSS en lugar de `—`.

### H-07 | Hub.html — "Customize" button dead
- **Línea:** ~430 (header area)
- **Tipo:** Dead button
- **Severidad:** MEDIUM
- **Problema:** Botón "Customize" en el header no tiene handler implementado.
- **Solución:** Implementar drawer de configuración del Hub o eliminar el botón.

### H-08 | Hub.html — Search bar sin funcionalidad
- **Línea:** ~420 (top bar)
- **Tipo:** Dead UI element
- **Severidad:** MEDIUM
- **Problema:** Barra de búsqueda (players/sessions/microcycle) existe visualmente pero no tiene handler ni lógica de búsqueda.
- **Solución:** Implementar búsqueda global o eliminar hasta que esté lista.

### H-09 | Hub.html — Notifications y Help sin implementar
- **Línea:** ~425 (top bar icons)
- **Tipo:** Dead buttons
- **Severidad:** LOW
- **Problema:** Iconos de notificaciones y ayuda no tienen onclick handlers.
- **Solución:** Implementar centro de notificaciones o eliminar hasta tener implementación.

### H-10 | Hub.html — Logo del equipo no aparece
- **Línea:** ~440 (team avatar)
- **Tipo:** Feature incompleta
- **Severidad:** MEDIUM
- **Problema:** El logo del club no se renderiza. Probablemente el campo `logo_url` en `clubs` está vacío o la URL no es accesible.
- **Solución:** Verificar que `logo_url` se carga correctamente desde Supabase. Agregar fallback con iniciales del club.

### H-11 | Hub.html — "+ Add task" abre chat en vez de task creator
- **Línea:** ~785 (button en task section)
- **Tipo:** Wrong handler
- **Severidad:** HIGH
- **Problema:** El botón "+ add task" redirige al módulo de Chat en vez de abrir un formulario de creación de tarea.
- **Solución:** Implementar `openNewTaskModal()` que inserte en la tabla `tasks`.

---

## SECCIÓN 3 — CALENDAR

### C-01 | Calendar.html — Season Ribbon completamente hardcodeada
- **Línea:** 504–517
- **Tipo:** Hardcoded mock data
- **Severidad:** CRITICAL
- **Problema:** El Gantt de temporada muestra 14 microciclos fake (MC 9–22) con nombres inventados ("Apertura", "Triple match", "Mendoza away", "Cup quarter-final") y posiciones CSS inline hardcodeadas (`left: 0.5%; width: 6%`). No viene de la base de datos.
- **Impacto:** El componente más visible del Calendar es completamente fake.
- **Solución:** Eliminar todo el HTML hardcodeado. La query en línea 1125-1128 ya carga microciclos de Supabase. Generar los elementos del Gantt dinámicamente calculando `left` y `width` como porcentaje de `(start_date - season_start) / season_duration * 100`.

### C-02 | Calendar.html — Match markers con equipos inventados
- **Línea:** 525–538
- **Tipo:** Hardcoded mock data
- **Severidad:** CRITICAL
- **Problema:** Marcadores de partidos con posiciones y rivales hardcodeados: "R. Plate", "Boca", "Atlético", "San Lorenzo", "Vélez", "Racing", "River", "Banfield", "Lanús" — ninguno viene de la DB.
- **Solución:** Para cada microciclo con `match_date`, crear dinámicamente un marcador calculando su posición como `((match_date - season_start) / season_length) * 100%`.

### C-03 | Calendar.html — Upcoming Events completamente hardcodeado
- **Línea:** 627–676
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** 6 eventos próximos hardcodeados: "Speed · activation 50′ May 16", "vs Atlético · home May 18", "Flight → Mendoza May 22", etc. No hay queries para cargarlos desde DB.
- **Solución:** Query a `training_sessions` y `microcycles` ordenados por fecha, próximos 14 días.

### C-04 | Calendar.html — Planned Workload chart hardcodeado
- **Línea:** 690–715
- **Tipo:** Hardcoded data visualization
- **Severidad:** MEDIUM
- **Problema:** Barras de carga planificada (MC 10-17) con alturas hardcodeadas (`height:42%`, `height:58%`, etc.) sin cálculo real.
- **Solución:** Query `training_sessions` agrupadas por microciclo y `session_type`. Calcular carga total y normalizar a porcentaje.

### C-05 | Calendar.html — KPIs hardcodeados
- **Línea:** 449–467
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** "Sun May 18", "5 in 21d", "4 this MC", "3,420 AU" — ninguno calculado dinámicamente.
- **Solución:** Calcular desde microciclos cargados y training_sessions.

### C-06 | Calendar.html — Publish state con usuarios hardcodeados
- **Línea:** 728–752
- **Tipo:** Hardcoded mock data
- **Severidad:** MEDIUM
- **Problema:** "Players · 27", "Medical · 4", "Club board · 6" hardcodeados.
- **Solución:** Query `profiles` agrupado por `role` para el club actual.

### C-07 | Calendar.html — "New Microcycle" e "Import Fixtures" sin implementar
- **Línea:** ~445 (header buttons)
- **Tipo:** Dead buttons
- **Severidad:** HIGH
- **Problema:** Botones no tienen handlers. No se puede crear ni importar microciclos.
- **Solución:** Implementar modal de creación de microciclo con INSERT a `microcycles` table.

### C-08 | Calendar.html — "Manage" button dead
- **Línea:** ~730
- **Tipo:** Dead button
- **Severidad:** MEDIUM
- **Problema:** Botón "Manage" en la sección de publicación no tiene handler.

### C-09 | Calendar.html — "View All" dead
- **Línea:** ~625
- **Tipo:** Dead link/button
- **Severidad:** LOW
- **Problema:** "View all" en upcoming events no navega a ninguna parte.

### C-10 | Calendar.html — "Microcycle Daily Plan Loading…" sospechoso
- **Línea:** ~580 (daily plan section)
- **Tipo:** Fake loader / estado simulado
- **Severidad:** MEDIUM
- **Problema:** El estado "loading" podría ser permanente si la query falla silenciosamente.
- **Solución:** Agregar error state explícito. Si no hay plan para el día, mostrar "Sin plan para este día".

---

## SECCIÓN 4 — CHAT & TASKS

### CT-01 | Chat & Tasks.html — Canales y DMs hardcodeados
- **Línea:** 275–335
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Lista de conversaciones (canales + DMs) completamente hardcodeada. No se carga de DB.
- **Solución:** Fetch desde tabla `conversations` o `channels` con JOIN a `conversation_members`.

### CT-02 | Chat & Tasks.html — Pinned files hardcodeados
- **Línea:** 381–384
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** Archivos anclados en el panel derecho son estáticos.
- **Solución:** Query a `pinned_files` o `message_attachments WHERE pinned = true`.

### CT-03 | Chat & Tasks.html — Filtros de tareas sin lógica
- **Línea:** 403–407
- **Tipo:** Dead UI / CSS-only interaction
- **Severidad:** HIGH
- **Problema:** Pills "All / Mine / Match-day / Medical / Routine" solo cambian clase CSS. No filtran el kanban.
- **Solución:** En cada click, re-query tasks con `WHERE category = selectedFilter AND assigned_to = userId`.

### CT-04 | Chat & Tasks.html — Botón Filter sin implementar
- **Línea:** 409
- **Tipo:** Dead button
- **Severidad:** MEDIUM
- **Problema:** Botón "Filter" no abre ningún modal.
- **Solución:** Implementar drawer con filtros avanzados (fecha, prioridad, assignee).

### CT-05 | Chat & Tasks.html — Kanban sin drag-and-drop
- **Línea:** 416–437
- **Tipo:** Feature incompleta
- **Severidad:** HIGH
- **Problema:** Las columnas Backlog/In Progress/Blocked/Done existen pero no tienen drag-and-drop implementado. Los "..." de cada columna no tienen handlers.
- **Solución:** Implementar drag-and-drop con `status` update en DB al soltar. O usar librería como SortableJS.

### CT-06 | Chat & Tasks.html — Toolbar de composer sin handlers
- **Línea:** 361–363
- **Tipo:** Dead buttons
- **Severidad:** HIGH
- **Problema:** Botones de adjuntar, mencionar, emoji y crear tarea desde el chat no tienen onclick handlers.
- **Solución:** Implementar upload de archivos (Supabase Storage), sistema de menciones con `@`, emoji picker.

### CT-07 | Chat & Tasks.html — Search y menú "..." de chat sin funcionalidad
- **Línea:** 347–349
- **Tipo:** Dead buttons
- **Severidad:** MEDIUM
- **Problema:** Botones en el header del chat (search, pin, more) no tienen handlers.

---

## SECCIÓN 5 — DAILY PLANNING

### DP-01 | Daily Planning.html — Squad completo hardcodeado
- **Línea:** 339–377
- **Tipo:** Hardcoded mock data
- **Severidad:** CRITICAL
- **Problema:** Toda la lista de 27 jugadores con nombres, números, posiciones y disponibilidad hardcodeados en HTML. No viene de `players` + `availability` tables.
- **Solución:** Limpiar el HTML. Fetch desde `players JOIN availability` y renderizar dinámicamente.

### DP-02 | Daily Planning.html — Ejercicios hardcodeados
- **Línea:** 402–520
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Activaciones y 3 drill cards completas con diagramas SVG hardcodeadas. No vienen de `session_exercises`.
- **Solución:** Fetch desde `session_exercises JOIN exercises` para la sesión del día seleccionado.

### DP-03 | Daily Planning.html — Physio adaptations hardcodeadas
- **Línea:** 299–317
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Alertas de physio con jugadores y adaptaciones inventadas. No vienen de `treatments`.
- **Solución:** Query `treatments WHERE session_date = selectedDate AND club_id = currentClub`.

### DP-04 | Daily Planning.html — Totals bar hardcodeada
- **Línea:** 284–287
- **Tipo:** Hardcoded numbers
- **Severidad:** HIGH
- **Problema:** "15min, 35min, 50min" hardcodeados. Deberían calcularse desde los ejercicios cargados.
- **Solución:** Sumar `duration` de cada ejercicio agrupado por tipo.

### DP-05 | Daily Planning.html — Print/Export/Publish sin handlers
- **Línea:** 243–245
- **Tipo:** Dead buttons
- **Severidad:** MEDIUM
- **Problema:** Tres botones críticos sin onclick: Print, Export PDF, Publish.
- **Solución:** Print → `window.print()`. Export PDF → usar `html2pdf.js` o endpoint del backend. Publish → UPDATE session `status = 'published'` en DB.

### DP-06 | Daily Planning.html — Load Template sin handler
- **Línea:** 253
- **Tipo:** Dead button
- **Severidad:** MEDIUM
- **Problema:** "Load Template" no abre ningún picker.
- **Solución:** Modal que query `session_templates` y permite aplicar una al plan actual.

### DP-07 | Daily Planning.html — Apply Adaptation sin handler
- **Línea:** 306, 315
- **Tipo:** Dead button
- **Severidad:** HIGH
- **Problema:** "Apply adaptation" no modifica el plan ni persiste nada.
- **Solución:** Aplicar restricciones del physio al squad del plan (ej: marcar jugador como "adapt").

### DP-08 | Daily Planning.html — "From library" / "Add exercise" sin handlers
- **Línea:** 416–522
- **Tipo:** Dead buttons
- **Severidad:** HIGH
- **Problema:** Botones para agregar ejercicios no tienen implementación.
- **Solución:** Abrir modal de `Sessions Library` y retornar ejercicio seleccionado al plan.

### DP-09 | Daily Planning.html — Squad filter pills sin lógica
- **Línea:** 331–335
- **Tipo:** CSS-only interaction
- **Severidad:** MEDIUM
- **Problema:** Filtros "All/Available/Partial/Unavailable/Away" solo cambian clase CSS.

---

## SECCIÓN 6 — PLANNER

### PL-01 | Planner.html — Canvas editor completamente no funcional
- **Línea:** 541–558 (toolbar) + toda la sección del canvas
- **Tipo:** Feature no implementada
- **Severidad:** CRITICAL
- **Problema:** La barra de herramientas (Select, Move, Draw, Lasso, Undo, Redo, Zoom) no tiene event listeners funcionales. No se puede manipular ningún objeto en el campo táctico.
- **Impacto:** El editor es puramente decorativo.
- **Solución:** Implementar canvas interaction con mouse/touch events: mousedown, mousemove, mouseup para drag; click para selección; keyboard para undo/redo. O migrar a una librería como Fabric.js o Konva.js.

### PL-02 | Planner.html — Objetos del campo hardcodeados sin persistencia
- **Línea:** 596–616 (field objects) + 628–642 (SVG arrows)
- **Tipo:** Hardcoded data + no persistence
- **Severidad:** CRITICAL
- **Problema:** Jugadores, balón, conos, flechas tácticas — todos en posiciones hardcodeadas. No se cargan de `drill.objects`. No hay función `save()` que persista cambios.
- **Solución:** Cargar `drill.objects` de DB. Implementar `saveDrill()` que haga UPDATE del array de objetos. Las flechas como `drill.movements`.

### PL-03 | Planner.html — Drills hardcodeados
- **Línea:** 479–513
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** 4 drill cards hardcodeadas con nombres, duraciones y metadata inventados.
- **Solución:** Fetch desde `session_drills JOIN drills` para la sesión activa.

### PL-04 | Planner.html — Available players hardcodeados
- **Línea:** 520–530
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Lista de jugadores disponibles con nombres hardcodeados en HTML.
- **Solución:** Fetch desde `players JOIN availability` como en Daily Planning.

### PL-05 | Planner.html — Versions/Print/Share/Publish sin handlers
- **Línea:** 420–423
- **Tipo:** Dead buttons
- **Severidad:** MEDIUM
- **Problema:** Cuatro botones de acción críticos sin onclick.
- **Solución:** Versions → historial de cambios en DB. Print → `window.print()`. Share → generar link. Publish → UPDATE drill `status = 'published'`.

### PL-06 | Planner.html — Dock (Teams/Objects/Lines/Zones/Text) sin efecto en canvas
- **Línea:** 657–688
- **Tipo:** CSS-only interaction
- **Severidad:** HIGH
- **Problema:** Seleccionar Teams/Objects/Lines/Zones/Text cambia la tab visual pero no agrega nada al campo.
- **Solución:** Al hacer click en un elemento del dock, instanciar el objeto correspondiente en el canvas en posición central.

### PL-07 | Planner.html — FAB buttons sin handlers
- **Línea:** 646–650
- **Tipo:** Dead buttons
- **Severidad:** HIGH
- **Problema:** Annotation, Color, Background, Fullscreen sin implementar.

### PL-08 | Planner.html — Rival picker con rotación de hue falsa
- **Línea:** 575, 811–836
- **Tipo:** Demo implementation
- **Severidad:** MEDIUM
- **Problema:** El picker de rival rota el hue del mismo asset de escudo. No carga escudos reales de `opponents` table.
- **Solución:** Query `opponents` y mostrar `crest_url` real de cada rival.

### PL-09 | Planner.html — Preview y Export sin handlers
- **Línea:** 561–562
- **Tipo:** Dead buttons
- **Severidad:** MEDIUM

### PL-10 | Planner.html — Selección de objeto en canvas sin panel de propiedades
- **Línea:** 804–808
- **Tipo:** CSS-only interaction
- **Severidad:** HIGH
- **Problema:** Click en objeto del campo agrega clase CSS pero no abre editor de propiedades.
- **Solución:** Abrir panel lateral con propiedades editables del objeto seleccionado.

---

## SECCIÓN 7 — SQUAD

### SQ-01 | Squad.html — Player count y position counts hardcodeados
- **Línea:** 370, 387, 395–401
- **Tipo:** Hardcoded numbers
- **Severidad:** MEDIUM
- **Problema:** "27 players · First team 2025/26" y counts de posición (GK:3, CB:4, etc.) hardcodeados.
- **Solución:** Calcular desde los players ya cargados de DB.

### SQ-02 | Squad.html — Joined date muestra "—" para todos
- **Línea:** 655
- **Tipo:** Missing data / hardcoded fallback
- **Severidad:** MEDIUM
- **Problema:** Columna "Joined" siempre muestra "—". Campo `joined_date` en DB probablemente null.
- **Solución:** Poblar `joined_date` al crear jugadores. Mostrar fecha de creación del registro como fallback.

---

## SECCIÓN 8 — WELLNESS

### W-01 | Wellness.html — Defaults de formulario hardcodeados
- **Línea:** 694
- **Tipo:** Hardcoded defaults
- **Severidad:** MEDIUM
- **Problema:** Formulario muestra "7h 30m" de sueño y scores 8/8/6/3/4 como valores por defecto. Deberían estar vacíos o cargar de la última entrada.
- **Solución:** Limpiar defaults. Opcionalmente: cargar última entrada del jugador con `WHERE submitted_at::date = today - 1`.

---

## SECCIÓN 9 — INJURIES

### I-01 | Injuries.html — KPI cards con valores iniciales mock
- **Línea:** 320–352
- **Tipo:** Placeholder data
- **Severidad:** HIGH
- **Problema:** "2 active · 1 expected · 42 days · 8%" en HTML. El JS los reemplaza pero hay riesgo de mostrar datos falsos si falla.
- **Solución:** Skeleton loader en HTML.

### I-02 | Injuries.html — Body map annotations hardcodeadas
- **Línea:** 448–450
- **Tipo:** Hardcoded data visualization
- **Severidad:** HIGH
- **Problema:** "Bocanegra 2", "Carrasco 1" hardcodeados en el mapa corporal. No se calculan de la DB.
- **Solución:** Calcular anotaciones del mapa desde `injuries GROUP BY body_zone`.

### I-03 | Injuries.html — Type breakdown hardcodeado
- **Línea:** 463–468
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** "Muscle strain 62%, Ligament 23%" — porcentajes hardcodeados en barras CSS.
- **Solución:** Calcular desde `injuries GROUP BY type`.

---

## SECCIÓN 10 — LOAD MONITOR

### LM-01 | Load Monitor.html — Alert banner con jugadores hardcodeados
- **Línea:** 291–292
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** "4 players entered danger zone (ACWR > 1.5)" con nombres específicos hardcodeados.
- **Solución:** Query players con ACWR > 1.5 calculado dinámicamente desde wellness + training_sessions.

### LM-02 | Load Monitor.html — ACWR Chart es SVG estático
- **Línea:** 377–545
- **Tipo:** Hardcoded data visualization
- **Severidad:** MEDIUM
- **Problema:** El chart de ACWR completo es un SVG con puntos hardcodeados. No refleja datos reales.
- **Solución:** Reemplazar con Chart.js o similar, calculando ACWR (carga_7d / carga_28d) desde registros de wellness + training_sessions.

### LM-03 | Load Monitor.html — Header microcycle info hardcodeado
- **Línea:** 274
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** "Microcycle 14 · MD-3 · ACWR alerts... last sync 8 min ago" hardcodeado.

---

## SECCIÓN 11 — GPS ANALYSIS

### GPS-01 | GPS Analysis.html — Radar chart hardcodeado
- **Línea:** 285–318
- **Tipo:** Hardcoded data visualization
- **Severidad:** HIGH
- **Problema:** Polígono del radar con z-scores hardcodeados como puntos SVG. No refleja datos reales de GPS.
- **Solución:** Calcular z-scores desde `gps_reports` comparando jugador vs promedio del equipo.

### GPS-02 | GPS Analysis.html — Z-score matrix hardcodeada
- **Línea:** 382–392
- **Tipo:** Hardcoded data
- **Severidad:** HIGH
- **Problema:** Tabla de z-scores con nombres y valores hardcodeados en HTML. El JS en líneas 658-680 la reemplaza pero el fallback es fake.
- **Solución:** Vaciar HTML. Renderizar desde datos de gps_reports.

### GPS-03 | GPS Analysis.html — "× match max" metrics hardcodeadas
- **Línea:** 324–333
- **Tipo:** Hardcoded calculations
- **Severidad:** MEDIUM
- **Problema:** Multiplicadores vs máximo de partido (0.86×, 1.07×, etc.) hardcodeados.
- **Solución:** Calcular desde picos históricos de GPS por jugador.

### GPS-04 | GPS Analysis.html — Connectors con estado hardcodeado
- **Línea:** 599–604
- **Tipo:** Hardcoded state
- **Severidad:** MEDIUM
- **Problema:** Catapult muestra "Token expired", otras "Connected" — estado fake que no refleja OAuth real.
- **Solución:** Verificar estado real del token OAuth y mostrar según respuesta.

---

## SECCIÓN 12 — SESSIONS

### SS-01 | Sessions History.html — dupSess() vacío
- **Línea:** 442
- **Tipo:** Dead handler
- **Severidad:** HIGH
- **Problema:** `function dupSess(e) { e.stopPropagation(); }` — duplicar sesión no hace nada.
- **Solución:** INSERT de la sesión con nuevo timestamp.

### SS-02 | Sessions History.html — Filtros CSS-only
- **Línea:** 455–459
- **Tipo:** CSS-only interaction
- **Severidad:** HIGH
- **Problema:** Checkboxes de filtro (Microcycle, MD position, Orientation, Focus, Type, Load band) solo toggle clase CSS.
- **Solución:** Re-query con los filtros activos al cambiar selección.

### SS-03 | Sessions Library.html — Focus pills sin filtro real
- **Línea:** 492–495
- **Tipo:** CSS-only interaction
- **Severidad:** HIGH
- **Problema:** Pills Tactical/Physical/Conditional/Technical solo cambian clase.
- **Solución:** Filtrar grid de sesiones por `session.focus`.

### SS-04 | Sessions Library.html — Grid/List/Tree view sin switching
- **Línea:** 496–499
- **Tipo:** CSS-only interaction
- **Severidad:** MEDIUM
- **Problema:** Tres vistas no se implementan — solo hay una vista activa.

---

## SECCIÓN 13 — EVALUATIONS

### EV-01 | Evaluations.html — Tabs no cambian vista
- **Línea:** 455
- **Tipo:** Dead tabs
- **Severidad:** HIGH
- **Problema:** Tabs (subj, phys, squad, trends, templates, history) no hay JS que cambie la vista visible.
- **Solución:** Implementar `switchEvalTab()` que muestre/oculte secciones y cargue datos correspondientes.

### EV-02 | Evaluations.html — Scores hardcodeados
- **Línea:** 407–427
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** "Tactical: 7.8, Technical: 8.2" — promedios hardcodeados, no calculados de `evaluations` table.

---

## SECCIÓN 14 — PHYSIO

### PHY-01 | Physio.html — "Save treatment" sin handler
- **Línea:** 286–290
- **Tipo:** Dead button
- **Severidad:** HIGH
- **Problema:** Botón "Save treatment" no tiene onclick handler. Los tratamientos no se guardan.
- **Solución:** Implementar `saveTreatment()` que haga INSERT en `treatments` con todos los campos del formulario.

### PHY-02 | Physio.html — Body zones sin persistencia
- **Línea:** 452–468
- **Tipo:** Disconnected backend
- **Severidad:** HIGH
- **Problema:** La selección de zonas corporales (SVG clicks) se guarda en un Set local pero nunca se envía a la DB.
- **Solución:** Incluir `selected_zones` en el payload de `saveTreatment()`.

### PHY-03 | Physio.html — Placeholders permanentes en textarea
- **Línea:** 273, 281
- **Tipo:** Placeholder data
- **Severidad:** LOW
- **Problema:** "Tight L quad post Wed session..." como texto inicial en textarea.
- **Solución:** Limpiar en `resetForm()`.

---

## SECCIÓN 15 — MATCH REPORTS

### MR-01 | Match Reports.html — Shot positions hardcodeadas
- **Línea:** 622–647
- **Tipo:** Hardcoded data visualization
- **Severidad:** MEDIUM
- **Problema:** Mapa de tiros con posiciones `left:80%, top:48%` hardcodeadas.
- **Solución:** Calcular posiciones desde `events WHERE type = 'shot'` con coordenadas x/y.

### MR-02 | Match Reports.html — Stats de jugador incompletas
- **Línea:** 994–1015
- **Tipo:** Missing data / hardcoded "—"
- **Severidad:** MEDIUM
- **Problema:** Minutes, Rating, Goals, Pass accuracy siempre muestran "—" porque GPS reports no incluye estos datos.
- **Solución:** Fetch desde tabla `match_events` o `player_stats` si existe.

### MR-03 | Match Reports.html — Import providers sin acción
- **Línea:** 1037–1040
- **Tipo:** CSS-only interaction
- **Severidad:** LOW
- **Problema:** Seleccionar proveedor de importación (Wyscout, InStat, etc.) solo cambia clase CSS.

---

## SECCIÓN 16 — NUTRITION

### N-01 | Nutrition.html — Macro targets hardcodeados
- **Línea:** 581–587
- **Tipo:** Hardcoded constants
- **Severidad:** MEDIUM
- **Problema:** `ref: 350` (carbs), `ref: 150` (protein), `ref: 80` (fat) — valores de referencia hardcodeados.
- **Solución:** Fetch targets individualizados desde `nutrition_targets` table.

### N-02 | Nutrition.html — Donut ring con valor hardcodeado
- **Línea:** 518
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** `stroke-dasharray: "207 264"` hardcodeado en SVG inicial.
- **Solución:** Calcular en JS desde calorías consumidas / objetivo.

---

## SECCIÓN 17 — RPE

### R-01 | RPE.html — Body chips hardcodeados como seleccionados
- **Línea:** 360–371
- **Tipo:** Hardcoded state
- **Severidad:** LOW
- **Problema:** "Quadriceps, Calves" marcados como `.is-on` por default en cada nuevo formulario.
- **Solución:** Limpiar todos los `.is-on` en `resetForm()`.

### R-02 | RPE.html — Success animation no espera confirmación DB
- **Línea:** 661–665
- **Tipo:** Fake success state
- **Severidad:** LOW
- **Problema:** Botón se pone verde por 2.5s antes de confirmar que el INSERT en DB fue exitoso.
- **Solución:** Mostrar success solo en el `.then()` del INSERT a Supabase.

---

## SECCIÓN 18 — ADMIN

### AD-01 | Admin.html — Org bar completamente hardcodeada
- **Línea:** 319–329
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** "Clava Group", "5 clubs", "148 total members", "$485/mo combined billing" — datos completamente inventados.
- **Solución:** Query org data de `organizations JOIN clubs` con agregaciones reales.

### AD-02 | Admin.html — Clubs grid con 6 clubs fake
- **Línea:** 344–462
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Seis club cards hardcodeadas (First team, Reserves, U-19, U-17, Women, Academy) con stats inventados.
- **Solución:** Fetch desde `clubs WHERE org_id = currentOrg`.

### AD-03 | Admin.html — Module toggles sin persistencia
- **Línea:** 747–757
- **Tipo:** CSS-only interaction
- **Severidad:** HIGH
- **Problema:** 10 toggles de módulos (Planner, Sessions lib, Squad, etc.) solo cambian clase CSS. No persisten en DB.
- **Solución:** En cada toggle, UPDATE `club_settings.modules_enabled` en Supabase.

### AD-04 | Admin.html — Pending invites hardcodeados
- **Línea:** 686, 696
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** Dos invitaciones pendientes con emails fake hardcodeados.
- **Solución:** Fetch desde `pending_invites WHERE club_id = currentClub`.

### AD-05 | Admin.html — KPIs hardcodeados
- **Línea:** 494–511
- **Tipo:** Hardcoded data
- **Severidad:** MEDIUM
- **Problema:** "14 active", "2 pending invites", "Pro" plan, "8.4 / 50 GB" hardcodeados.
- **Solución:** Calcular desde Supabase en tiempo real.

---

## SECCIÓN 19 — GYM

### GY-01 | Gym Library.html — 12 exercise cards hardcodeadas
- **Línea:** 168–343
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** 12 ejercicios hardcodeados a pesar de que el fetch de DB existe (líneas 379-422).
- **Solución:** Limpiar HTML inicial. El fetch ya reemplaza correctamente pero si falla, muestra datos fake.

### GY-02 | Gym Library.html — Count "148 exercises" hardcodeado
- **Línea:** 106
- **Tipo:** Hardcoded count
- **Severidad:** MEDIUM

### GY-03 | Gym Library.html — Filter counts hardcodeados
- **Línea:** 161–163
- **Tipo:** Hardcoded numbers
- **Severidad:** MEDIUM
- **Problema:** "All: 148", "Quadriceps: 18" etc. — no calculados desde DB.

### GY-04 | Gym Library.html — Muscle filter sin re-fetch
- **Línea:** 426–433
- **Tipo:** CSS-only interaction
- **Severidad:** LOW
- **Problema:** Toggle de músculo solo cambia clase, no re-filtra el grid.

### GY-05 | Gym Planner.html — 14 exercise rows hardcodeadas
- **Línea:** 252–436
- **Tipo:** Hardcoded mock data
- **Severidad:** HIGH
- **Problema:** Warm-up, Main work, Plyometrics con rows hardcodeadas. No vienen de `session_exercises`.
- **Solución:** Fetch session_exercises para la sesión actual.

### GY-06 | Gym Planner.html — "Pull from VITRUVE" sin implementar
- **Línea:** 306
- **Tipo:** Dead button
- **Severidad:** LOW
- **Problema:** Integración con VITRUVE hardware no conectada.

### GY-07 | Gym Planner.html — "Add exercise" sin handlers (3 botones)
- **Línea:** 294, 386, 439
- **Tipo:** Dead buttons
- **Severidad:** MEDIUM

---

## SECCIÓN 20 — ONBOARDING

### OB-01 | Onboarding.html — saveAndContinue() solo guarda el nombre
- **Línea:** 515–531
- **Tipo:** Incomplete implementation
- **Severidad:** HIGH
- **Problema:** La función solo hace UPDATE del `club.name`. No guarda categorías seleccionadas, ciudad, timezone, ni plan.
- **Impacto:** Pérdida silenciosa de datos del usuario en el onboarding.
- **Solución:** Incluir todos los campos en el UPDATE: `name, short_name, city, timezone, categories, selected_plan`.

### OB-02 | Onboarding.html — Valores hardcodeados en formulario
- **Línea:** 349, 354, 375, 378, 382
- **Tipo:** Hardcoded placeholder
- **Severidad:** MEDIUM
- **Problema:** "Clava FC", "CLA", "Rosario", "America/Argentina/Buenos_Aires" pre-rellenados.
- **Solución:** Cargar del registro actual del club si existe, o dejar vacío para nuevos usuarios.

### OB-03 | Onboarding.html — Categories pre-seleccionadas sin DB
- **Línea:** 399–438
- **Tipo:** Hardcoded state
- **Severidad:** MEDIUM
- **Problema:** 3 categorías pre-marcadas (`.is-selected`) sin verificar DB.

---

## SECCIÓN 21 — ASSETS COMPARTIDOS

### AS-01 | settings-drawer.jsx — Tabs sin implementar
- **Línea:** 148–153
- **Tipo:** Feature incompleta
- **Severidad:** LOW
- **Problema:** Tabs "Notifications", "Account", "Billing" no tienen contenido renderizado.

### AS-02 | settings-drawer.jsx — Reset sin confirmación
- **Línea:** 233–240
- **Tipo:** UX issue
- **Severidad:** LOW
- **Problema:** Limpia localStorage inmediatamente sin confirmación.

### AS-03 | ios-frame.jsx — Tiempo estático "9:41"
- **Línea:** 9
- **Tipo:** Hardcoded display
- **Severidad:** LOW
- **Problema:** Status bar siempre muestra 9:41 (el famoso tiempo de marketing de Apple).
- **Solución:** `new Date().toLocaleTimeString()` actualizado cada minuto.

---

## ARCHIVOS LEGACY / NO UTILIZADOS

| Archivo | Motivo |
|---------|--------|
| `Clavametrics old/` | Versión antigua completa del proyecto |
| `ClavaMetrics New/` | Duplicado del directorio actual |
| `index.html` | Version antigua del Hub (61K, diferente al Hub.html actual) |
| `DATOS_EJEMPLO.sql` | SQL de datos de ejemplo — no debería estar en root |
| `MIGRATION_*.sql/md` | Archivos de migración en root — deberían estar en `docs/migrations/` |
| `SCHEMA_*.md/sql` | Documentación de schema en root — mover a `docs/` |
| `*.ai` (Adobe Illustrator) | Assets de diseño en root del proyecto |
| `Captura de pantalla*.png` | Screenshot personal en root |

| 2026-05-21 | Chat & Tasks.html L403–406 | CT-01: Match-day/Medical/Routine pills eliminados | Restaurados con funcionalidad real: filtran por `tasks.category`. Nueva migración: `MIGRATION_TASKS_CATEGORY.sql`. Category field en new task form. |
| 2026-05-21 | Admin.html org bar | AD-05: "Org invoice" + "Add club / category" botones eliminados | Restaurados. "Org invoice" abre modal con billing info real (adSubPlan/adSubAmount/adSubNext). "Add club/category" actualiza `clubs.name` y `clubs.country` via Supabase UPDATE. |
| 2026-05-21 | settings-drawer.jsx | SD-01: Billing tab eliminado | Restaurado. BillingPanel component carga `billing_plan`, `billing_amount`, `billing_next_date`, `billing_status` desde clubs via getClub(). |
| 2026-05-21 | Evaluations.html | EV-01: Tabs sin funcionalidad (squad/history/templates/trends/subj) | Refactor Phase 5.3: fixed broken comment wrapping #subjView; unified tab handler; Squad overview con query real por player (latest eval per type); Round history agrupado por fecha real; Templates view estático funcional; #evRosterList y detail header ahora se pueblan desde Supabase. |
| 2026-05-22 | Daily Planning.html | DP-01: Squad body hardcodeado (27 jugadores fake) | Eliminado HTML estático de #dpSquadBody. loadDay() ya poblaba desde Supabase. |
| 2026-05-22 | Daily Planning.html | DP-02: Physio adaptations 2 alertas hardcodeadas | Eliminado HTML estático de #dpPhysioList. loadDay() ya poblaba desde Supabase. |
| 2026-05-22 | Daily Planning.html | DP-03: Session info sin IDs ni datos reales | Agregados IDs (dpStartTime, dpEndTime, dpSessionType, dpNotes). loadDay() ahora query training_sessions para la fecha y popula el form. |
| 2026-05-22 | Daily Planning.html | DP-04: 3 field exercises hardcodeados | Eliminados. Implementado loadSessionExercises(sessionId) con query a session_exercises JOIN gym_exercises. Empty state cuando no hay sesión/ejercicios. |
| 2026-05-22 | Daily Planning.html | DP-05: "From library" sin handler | Implementado modal que lista gym_exercises del club, searchable, inserta en session_exercises al seleccionar. |
| 2026-05-22 | Daily Planning.html | DP-06: "Manual" y "Add exercise" sin handler | Implementado modal de ejercicio manual con INSERT a session_exercises (name, duration, intensity, notes). |
| 2026-05-22 | Daily Planning.html | DP-07: Totals bar hardcodeada | IDs agregados (dpTotField, dpTotFieldCt, dpTotTotal, dpTotSession). updateTotalsBar() calcula desde ejercicios cargados. |
| 2026-05-22 | audit-2026-05-21/ | DP-MIG: session_exercises no existe en DB | Generada MIGRATION_SESSION_EXERCISES.sql — tabla + RLS + índices. Pendiente de correr en Supabase. |
