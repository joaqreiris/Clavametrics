# BACKEND CONNECTION REPORT — ClavaMetrics
**Fecha:** 2026-05-21  

Estado real de conexión a Supabase por módulo y funcionalidad.

---

## LEYENDA

- **CONECTADO** — Fetch de datos real desde Supabase funcionando
- **PARCIAL** — Fetch existe pero write/update no, o solo algunos campos
- **DESCONECTADO** — UI existe pero no hay query alguna
- **ROTO** — Query existe pero falla (auth, RLS, schema mismatch)

---

## MAPA DE CONEXIÓN POR MÓDULO

### AUTH / LOGIN / REGISTER

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Email + password login | CONECTADO | `supabase.auth.signInWithPassword()` |
| Email + password register | ROTO | Falla con "Database error saving new user" — RLS issue |
| Google OAuth login | ROTO | Callback no completa el intercambio de sesión |
| Google OAuth register | ROTO | Mismo problema |
| Forgot password | CONECTADO | `supabase.auth.resetPasswordForEmail()` |
| Session persistence | CONECTADO | Usa `supabase.auth.onAuthStateChange()` |
| Sport selection persistence | PARCIAL | Se lee del DOM al submit pero no se valida contra DB |

### HUB

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| User profile load | CONECTADO | Fetch desde `profiles` |
| Greeting personalizada | CONECTADO | JS reemplaza placeholder de HTML |
| Availability pills | CONECTADO | `renderAvailabilityPills()` query a `availability` |
| Activity feed | CONECTADO | `renderActivity()` con JOIN múltiple |
| Task list | CONECTADO | `renderTasks()` desde `tasks WHERE assigned_to` |
| KPI cards | CONECTADO | `renderKPIs()` con queries múltiples |
| Module badges | CONECTADO | `renderBadgesAndStats()` desde múltiples tablas |
| Team logo | PARCIAL | URL se carga pero imagen puede no existir en Storage |
| Search bar | DESCONECTADO | Sin handler |
| Notifications | DESCONECTADO | Sin handler |
| "+ Add task" | ROTO | Handler abre chat en vez de crear tarea |
| "Customize" | DESCONECTADO | Sin handler |

### CALENDAR

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load microcycles | CONECTADO | Query en línea 1125-1128 |
| Season Ribbon render | DESCONECTADO | Query existe pero HTML ignora datos y usa hardcoded |
| Match markers render | DESCONECTADO | No hay función que genere markers desde microcycles |
| Upcoming events | DESCONECTADO | Sin query — todo hardcodeado |
| Workload chart | DESCONECTADO | Sin query — barras hardcodeadas |
| Daily plan load | PARCIAL | Sospechoso — loader puede ser permanente |
| New Microcycle (INSERT) | DESCONECTADO | Botón sin handler |
| Import Fixtures | DESCONECTADO | Botón sin handler |
| Publish state read | DESCONECTADO | Counts hardcodeados |
| Publish state write | DESCONECTADO | Botón sin handler |
| KPI calculation | DESCONECTADO | Todos hardcodeados |

### CHAT & TASKS

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load conversations/channels | DESCONECTADO | Lista hardcodeada |
| Load messages | PARCIAL | Hay indicios de fetch pero canales son mock |
| Send message | CONECTADO | Handler de submit conectado |
| Task load | CONECTADO | Query desde `tasks` table |
| Task create | CONECTADO | Modal con INSERT |
| Task status update (drag) | DESCONECTADO | Sin drag-and-drop implementado |
| Task filter by category | DESCONECTADO | CSS-only |
| Pinned files load | DESCONECTADO | Hardcodeados |
| File attach | DESCONECTADO | Sin handler |
| Mentions | DESCONECTADO | Sin handler |

### DAILY PLANNING

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load session metadata | PARCIAL | Fecha/hora hardcodeada |
| Load squad + availability | DESCONECTADO | Squad completamente hardcodeado |
| Load exercises | DESCONECTADO | 3 drills hardcodeados |
| Load physio adaptations | DESCONECTADO | Alerts hardcodeadas |
| Save session plan | DESCONECTADO | Sin función save() |
| Publish plan | DESCONECTADO | Botón sin handler |
| Print/Export PDF | DESCONECTADO | Botones sin handler |
| Apply physio adaptation | DESCONECTADO | Botón sin handler |
| Add exercise from library | DESCONECTADO | Botón sin handler |

### PLANNER

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load session data | PARCIAL | JS en líneas 708-776 carga jugadores/availability |
| Load drills | DESCONECTADO | 4 drills hardcodeados |
| Load drill objects | DESCONECTADO | Objetos del campo hardcodeados |
| Save drill objects | DESCONECTADO | Sin función save() |
| Canvas manipulation | DESCONECTADO | Sin event listeners |
| Publish drill | DESCONECTADO | Botón sin handler |
| Share drill | DESCONECTADO | Botón sin handler |
| Versions | DESCONECTADO | Botón sin handler |
| Load opponents | DESCONECTADO | 5 rivales fake |

### SQUAD

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load players | CONECTADO | Fetch desde `players` |
| Player filters | PARCIAL | UI togglea, query puede o no refetchear |
| Add player | CONECTADO | Modal con INSERT (verificado) |
| Player counts | DESCONECTADO | Hardcodeados en HTML |
| Joined date | DESCONECTADO | Campo null en DB para todos |

### WELLNESS

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load context | PARCIAL | `window.__WELLNESS_CTX` con placeholders |
| Form submission | CONECTADO | INSERT a `wellness_submissions` |
| History load | CONECTADO | Query de entregas anteriores |
| Body parts selection | CONECTADO | Se incluye en payload |
| Form defaults | HARDCODED | No carga última entrada del jugador |

### INJURIES

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load injuries | CONECTADO | Fetch desde `injuries` |
| KPI cards | PARCIAL | JS reemplaza pero HTML inicial es mock |
| Body map annotations | DESCONECTADO | Hardcodeadas en HTML |
| Type breakdown chart | DESCONECTADO | Barras CSS hardcodeadas |
| Log injury | CONECTADO | Modal con INSERT |
| Update injury status | CONECTADO | Handler existe |

### LOAD MONITOR

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load player load data | PARCIAL | Hay fetch pero ACWR chart es SVG estático |
| ACWR chart | DESCONECTADO | SVG completamente hardcodeado |
| Alert banner | DESCONECTADO | Nombres de jugadores hardcodeados |
| KPI cards | PARCIAL | JS reemplaza pero HTML inicial es mock |
| Wellness bars (right panel) | DESCONECTADO | Porcentajes hardcodeados |
| Player table | CONECTADO | Se carga desde DB |

### GPS ANALYSIS

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load GPS reports | CONECTADO | Fetch desde `gps_reports` (línea 644) |
| Individual KPIs (km, sprints) | CONECTADO | Se cargan desde reports[0] |
| Radar chart | DESCONECTADO | SVG hardcodeado |
| Z-score matrix | PARCIAL | JS la rellena (líneas 658-680) pero HTML inicial es mock |
| "× match max" metrics | DESCONECTADO | Hardcodeadas |
| Weekly volume bars | DESCONECTADO | Hardcodeadas |
| Connector status | DESCONECTADO | Hardcodeado |
| Scatter plot | DESCONECTADO | Puntos hardcodeados |

### SESSIONS

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load sessions list | CONECTADO | Fetch desde `training_sessions` |
| Session filters | DESCONECTADO | CSS-only |
| Session duplicate | DESCONECTADO | dupSess() vacío |
| Library load | CONECTADO | Fetch desde library |
| Library filter | DESCONECTADO | CSS-only |

### EVALUATIONS

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load evaluations | PARCIAL | Query existe pero scores hardcodeados |
| Tab switching | DESCONECTADO | Sin JS que cambie vistas |
| Save evaluation | DESCONECTADO | Sin verificar |
| Category collapse | PARCIAL | CSS toggle, sin lazy-load |

### NUTRITION

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load player nutrition | CONECTADO | `loadPlayerDetail()` funcional |
| Macro targets | DESCONECTADO | Hardcodeados como constantes |
| Donut visualization | DESCONECTADO | stroke-dasharray hardcodeado |
| Save nutrition log | CONECTADO | Hay función de guardado |

### PHYSIO

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load treatments | CONECTADO | Fetch desde `treatments` |
| Save treatment | DESCONECTADO | Botón sin handler onclick |
| Body zone selection → DB | DESCONECTADO | Set local nunca llega a INSERT |

### MATCH REPORTS

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load match reports | CONECTADO | Fetch desde `match_reports` |
| GPS player data | CONECTADO | JOIN con gps_reports |
| Player stats (Rating/Goals/Pass) | DESCONECTADO | Siempre "—" |
| Shot map positions | DESCONECTADO | Hardcodeadas |
| Import providers | DESCONECTADO | CSS-only selection |

### ADMIN

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load members | CONECTADO | Fetch desde `profiles` (línea 829-843) |
| Org info | DESCONECTADO | Completamente hardcodeado |
| Clubs grid | DESCONECTADO | 6 clubs hardcodeados |
| Module toggles | DESCONECTADO | CSS-only |
| Pending invites | DESCONECTADO | Hardcodeados |
| KPI cards | DESCONECTADO | Hardcodeados |

### GYM

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Library load | CONECTADO | Fetch desde `gym_exercises` (líneas 379-422) |
| Library filter | DESCONECTADO | Muscle chips CSS-only |
| Planner session load | DESCONECTADO | 14 rows hardcodeadas |
| Planner exercise save | DESCONECTADO | Sin función save() |
| Add exercise | DESCONECTADO | 3 botones sin handler |

### ONBOARDING

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Load club data | PARCIAL | Valores hardcodeados, no carga de DB |
| Save club name | CONECTADO | `saveAndContinue()` hace UPDATE de name |
| Save categories | DESCONECTADO | `saveAndContinue()` no incluye categories |
| Save city/timezone | DESCONECTADO | No incluido en UPDATE |
| Save selected plan | DESCONECTADO | No incluido en UPDATE |
| Progress tracking | DESCONECTADO | Pasos hardcodeados en HTML |

---

## RESUMEN DE ESTADO DE CONEXIÓN

| Estado | Módulos/Features | % |
|--------|-----------------|---|
| CONECTADO | 41 | 27% |
| PARCIAL | 24 | 16% |
| DESCONECTADO | 78 | 52% |
| ROTO | 7 | 5% |
| **TOTAL** | **150** | 100% |

---

## TABLAS DE SUPABASE REFERENCIADAS

| Tabla | Usado en | Estado |
|-------|----------|--------|
| `profiles` | Hub, Admin, Squad | CONECTADO |
| `clubs` | Onboarding, Hub, Admin | PARCIAL |
| `players` | Squad, Daily Planning, Planner | PARCIAL |
| `training_sessions` | Calendar, Sessions History, Daily Planning | PARCIAL |
| `wellness_submissions` | Wellness, Load Monitor | PARCIAL |
| `injuries` | Injuries | CONECTADO |
| `gps_reports` | GPS Analysis, Match Reports | CONECTADO |
| `tasks` | Chat & Tasks, Hub | CONECTADO |
| `microcycles` | Calendar | PARCIAL (query existe, render no usa data) |
| `availability` | Hub, Planner, Daily Planning | PARCIAL |
| `gym_exercises` | Gym Library | CONECTADO |
| `treatments` | Physio, Daily Planning | PARCIAL |
| `match_reports` | Match Reports | CONECTADO |
| `session_exercises` | Daily Planning, Planner | DESCONECTADO |
| `nutrition_targets` | Nutrition | DESCONECTADO |
| `organizations` | Admin | DESCONECTADO |
| `pending_invites` | Admin | DESCONECTADO |
| `session_templates` | Daily Planning | DESCONECTADO |
| `drills` / `session_drills` | Planner | DESCONECTADO |
| `opponents` | Planner | DESCONECTADO |
| `evaluations` | Evaluations | PARCIAL |
| `match_events` | Match Reports | DESCONECTADO |
