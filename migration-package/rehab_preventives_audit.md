# AUDITORÍA — Rehab & Preventives

Archivo auditado: `Rehab & Preventives.html` (502 líneas)
Esquema de referencia: `database_schema.md`
Reglas aplicadas: `CLAUDE_RULES.md` (modificación quirúrgica, no tocar CSS, reutilizar `requireAuth`/`getClubId`/`getProfile`/`getClub`, JS vanilla, sin tablas duplicadas).

Estado general: **la página es un mockup estático**. El 100% de los datos visibles está hardcoded en el HTML. El único bloque de data dinámica (`<script>` líneas 441-491) está roto en cuatro puntos simultáneos, así que nunca reemplaza nada.

---

## 0 · Inventario de la página

Estructura (de arriba a abajo):

- **Topbar** (`.hub-topbar`, líneas 21-30): breadcrumb + 2 acciones (`Export`, `New plan`). **No tiene búsqueda, notificaciones ni settings.**
- **Header** (`.po-head`, 35-46): "Active plans" + contadores `7 active · 4 rehab · 3 preventive · 2 owners on rotation today`. Hardcoded.
- **KPI strip** (`.po-kpis`, 49-70): 4 tarjetas, todas hardcoded.
- **Filtros** (`.po-filters`, 73-88): 5 pills + buscador de atleta + label de orden. Ninguno funciona.
- **Tabla Rehab** (`.po-tbl`, 93-425): 4 filas hardcoded.
- **Tabla Preventive** (`.po-tbl`, 288-425): 3 filas hardcoded.
- **Nota footer** (427-433): links a Injuries / Evaluations / GPS + "history view" (`href="#"` muerto).
- **Script de data** (441-491): intento de poblar desde Supabase. Roto.
- **JSX del final** (494-500): carga `settings-drawer.jsx`, `tweaks-panel.jsx`, `theme-tweaks.jsx` y `#tweaks-root`, pero **no hay botón en el topbar que abra el settings drawer**.

Stack: Supabase JS v2, `assets/supabase-init.js`, `assets/sidebar.js`, React 18 + Babel para los drawers. Body `class="cm"`, `data-theme="hybrid"`.

---

## 1 · Topbar faltante (búsqueda · notificaciones · settings)

El resto de las páginas tiene topbar con buscador global, campana de notificaciones y settings. Acá el `.hub-topbar` solo tiene breadcrumb + Export + New plan.

Lo que ya está disponible para enchufarlo:

- `settings-drawer.jsx` + `#tweaks-root` ya se cargan al final → falta solo el **botón gear** que dispare la apertura del drawer (mismo `data-open-settings` que usan otras páginas).
- Tabla `notifications` ya existe (campos: `type`, `title`, `body`, `read`, `link`, realtime habilitado) → backing de la campana.
- Tabla `messages` + `channel_reads` → badge de no leídos.
- `calendar_events` está documentada como *"Used by: Global Search"* → el buscador global ya tiene fuente de datos.

**Fuente canónica = `Injuries.html`** (topbar idéntico al del resto). Markup a replicar:

```html
<!-- entre .hub-crumb y .actions -->
<div class="hub-search">
  <i class="ti ti-search"></i>
  <input id="rehabGlobalSearch" placeholder="Search player, plan, area…" aria-label="Search">
</div>
<!-- dentro de .actions, junto a Export / New plan -->
<button class="cm-icon-btn" title="Notifications"><i class="ti ti-bell"></i></button>
<button class="cm-icon-btn" title="Settings" data-open-settings><i class="ti ti-settings"></i></button>
```

Acción: insertar `.hub-search` después de `.hub-crumb` y agregar los dos `.cm-icon-btn` dentro del `.actions` existente (conservando `Export` y `New plan`). `data-open-settings` ya dispara el `settings-drawer.jsx` cargado al final. El comportamiento de bell/search se copia tal cual de `Injuries.html` (si allá son placeholders sin handler propio, acá también, para mantener consistencia). **No tocar CSS** — `.hub-search` y `.cm-icon-btn` ya existen en `clavametrics.css`.

> Nota: el `.hub-search` del topbar es la búsqueda **global**; es distinto del `.po-search` "Search athlete…" local de los filtros (§6). Conviven.

---

## 2 · Datos hardcoded (inventario completo)

Todo lo siguiente está fijo en el HTML y debe salir de Supabase:

| Zona | Valor hardcoded | Origen real |
|---|---|---|
| Header ctx | `7 active · 4 rehab · 3 preventive` | count sobre `rehab_plans` |
| Header ctx | `2 owners on rotation today` | distinct owners con sesión hoy |
| KPI 1 | In rehab `4` (1 acute · 2 strength · 1 on-field) | count por `phase_type` |
| KPI 2 | Near RTP `2` (Mella · Fernández) | plans con `rtp_estimate` ≤ 7 d |
| KPI 3 | Blocked today `1` (Bruno Sosa · wellness 5.8) | plan con `status='blocked'` + `wellness` de hoy |
| KPI 4 | Cleared this month `3` · avg 34 d | plans `cleared` del mes + avg días |
| Filtros | counts `7/4/3/2/1` | derivados de la query |
| Tabla Rehab | 4 filas (jugador, dx, fase, RTP, owners, sesión, status) | `rehab_plans` + joins |
| Tabla Preventive | 3 filas | `rehab_plans` (kind=preventive) |

**Filas Rehab hardcoded:**

1. Joaquín Mella · GK #1 · Shoulder dislocation right grade II · Day 32 · On-field · Injury #211 · RTP Jun 03 ±2d · RM+LP · GK return protocol 16:00 · Near RTP
2. Mateo Fernández · RF #18 · Hamstring (BFlh) grade II · Day 24 · Strength · Injury #214 · RTP Jun 18 ±5d · RM+LP+DV · Posterior chain strength 14:30 · On track *(inconsistencia del mock: KPI lo marca Near RTP pero la fila dice "in 22 days")*
3. Tomás Ríos · CM #8 · Ankle sprain lateral grade II · Day 11 · Subacute · Injury #218 · RTP Jun 26 ±7d · RM+LP · Ankle mobility flow 11:00 · On track
4. Bruno Sosa · CB #4 · MCL grade I right knee · Day 5 · Subacute · Injury #220 · RTP Jun 22 ±5d · RM · Quad activation 10:30 · Blocked (wellness 5.8)

**Filas Preventive hardcoded:**

1. Lucas Vega · LB #3 · Hamstring history LSI 14% BFlh · Hypertrophy & control · Risk flag eval May 12 · W4/8 · LP+RM · Posterior chain Nordic 09:00
2. Diego Carmona · RW #11 · High HSR exposure ACWR 1.42 · Foundation · Flagged by GPS May 22 · W2/6 · LP · Movement prep running 08:30
3. Federico Olmos · CB #5 · Quad asymmetry LSI 18% · Strength & power · Risk flag eval Apr 28 · W6/8 · LP+RM · Unilateral squat block 11:30

---

## 3 · Match lesiones / jugadores ↔ BD

La página referencia 7 jugadores y 4 lesiones por número humano (`#211/#214/#218/#220`). **Decisión: se quitan los displays `#1` (camiseta) y `Injury #211` (número humano)** — no son relevantes, así que **no** se agregan columnas a `players`/`injuries`. La posición (`GK`, `CB`…) sí se conserva.

Match a verificar (recreaste las lesiones a mano):

Jugadores que deben existir en `players` (mismo `club_id`):
`Joaquín Mella` (GK), `Mateo Fernández` (RF), `Tomás Ríos` (CM), `Bruno Sosa` (CB), `Lucas Vega` (LB), `Diego Carmona` (RW), `Federico Olmos` (CB).

Owners (iniciales) que deben existir en `profiles` con su `role`:
`RM` (physio), `LP` (sc), `DV` (coach).

**Query de verificación (corré vos en Supabase, reemplazá `<club_id>`):**

```sql
-- ¿Existen los jugadores de la página?
select first_name, last_name, position, status
from players
where club_id = '<club_id>'
  and (last_name in ('Mella','Fernández','Ríos','Sosa','Vega','Carmona','Olmos'));

-- ¿Las lesiones a mano matchean dx y player?
select i.id, i.body_area, i.injury_type, i.severity, i.status,
       i.start_date, i.expected_return, p.last_name
from injuries i
join players p on p.id = i.player_id
where i.club_id = '<club_id>'
order by i.start_date desc;
```

Con ese resultado armamos la correspondencia fila-página ↔ fila-BD y ajustamos los dx/fechas para que coincidan. La página debe renderizar desde esas filas, no al revés.

---

## 4 · Conexiones y bugs del script actual (441-491)

El `<script>` intenta poblar pero falla en cadena:

1. **Tablas inexistentes.** Consulta `rehab_protocols` y `preventive_routines` — ninguna está en `database_schema.md`. Las queries devuelven error; `.data || []` lo traga → `total=0` → no actualiza nada.
2. **Selector incorrecto.** `document.querySelector('.po-table tbody')` → la tabla real es `.po-tbl`. Devuelve `null`, nunca repuebla. Además hay **dos** tablas `.po-tbl`; el script asume una sola.
3. **Template desalineado del CSS.** Las filas dinámicas usan `.po-player / .po-av / .po-name / .po-badge / .po-status.active`, pero el mock (y el CSS) usan `.po-ath / .av / .who / .name / .po-pill / .po-phase-pill / .po-rtp / .po-owners / .po-next / .po-status.{near|ok|blocked}`. Aunque pintara, saldría sin estilo.
4. **Mezcla de secciones.** Concatena rehab + preventive en un solo `tbody`, rompiendo la separación visual Rehab / Preventive.

Lo que **sí** está bien y se conserva: `requireAuth()`, `getClubId()`, `applyClubTheme()`, filtrado por `club_id`.

Fixes (en el mismo `<script>`, sin reescribir el archivo):
- Apuntar a las tablas reales (ver §5).
- Seleccionar cada `tbody` por sección y renderizar por `kind`.
- Reescribir el template con las clases reales del mock para clonar el diseño exacto.
- Loguear errores en vez de tragarlos (`if (rehabRes.error) console.warn(...)`).
- Calcular KPIs y counts de filtros desde la misma data.

---

## 5 · Tablas de BD necesarias (con su función)

El esquema **no tiene** soporte para planes de rehab/preventivos. Hay que crearlo. Recomendación: **una sola tabla `rehab_plans`** con `kind` (rehab|preventive), porque la UI los trata como una lista unificada ("Active plans") y evita tablas duplicadas (regla DB "never create duplicate tables"). El script viejo asumía dos tablas (`rehab_protocols`/`preventive_routines`) — se descartan en favor de `rehab_plans`.

**Reutilizadas, NO se crean:** `players`, `injuries`, `evaluations`, `gps_reports`, `wellness`, `treatments`, `profiles`, `notifications`, `messages`, `calendar_events`.

### TABLE: rehab_plans
Función: plan de rehabilitación o preventivo por jugador. Fuente de verdad de esta página y del Rehab Planner.
- `id` uuid PK
- `club_id` uuid FK clubs — multi-tenant
- `player_id` uuid FK players
- `injury_id` uuid FK injuries (nullable — los preventivos no tienen lesión)
- `kind` text CHECK (rehab|preventive)
- `name` text (nullable) — etiqueta opcional del plan
- `diagnosis` text — "Shoulder dislocation · right · grade II" o el descriptor de riesgo del preventivo
- `phase` text — "On-field" / "Strength" / "Subacute" / "Foundation" / "Hypertrophy & control" / "Strength & power"
- `phase_type` text — clave de color para `.po-phase-pill`: field|strength|subacute|foundation|capacity
- `start_date` date — para derivar "Day N" (rehab)
- `rtp_estimate` date (nullable) — fecha estimada de RTP
- `rtp_window_days` int (nullable) — el ±Nd
- `programme_week` int (nullable) — semana actual del preventivo (W4)
- `programme_total_weeks` int (nullable) — total (W4/**8**)
- `source` text CHECK (injury|evaluation|gps|manual) — de dónde nace el plan
- `source_label` text (nullable) — "Flagged by GPS · May 22", "evaluation May 12"
- `risk_metric` text (nullable) — "ACWR 1.42", "LSI 18%"
- `status` text CHECK (on_track|near_rtp|blocked|cleared|archived)
- `created_at`, `updated_at`
- Relaciones: `player_id → players.id`, `injury_id → injuries.id`, `club_id → clubs.id`
- RLS: por `club_id` (igual que el resto).

### TABLE: rehab_plan_owners
Función: staff responsable de un plan (los avatares RM/LP/DV). Relación N:N plan↔profile.
- `id` uuid PK
- `plan_id` uuid FK rehab_plans ON DELETE CASCADE
- `profile_id` uuid FK profiles
- `role` text CHECK (physio|sc|coach) — mapea a `.av-mini.{physio|sc|coach}`
- `created_at`
- Constraint: UNIQUE(plan_id, profile_id)
- RLS: por `club_id` vía join a `rehab_plans`.

### TABLE: rehab_sessions  *(scope Rehab Planner — definir allá, se documenta acá por la columna "Today's session")*
Función: sesión diaria de un plan (la que la página muestra como "Today's session"). Pertenece al módulo Rehab Planner; acá solo se **lee** la de hoy.
- `id` uuid PK · `plan_id` uuid FK rehab_plans · `club_id` uuid
- `date` date · `name` text · `color` text (el swatch) · `start_time` time · `duration_min` int · `block_count` int
- Dejar preparado el read; **no implementar persistencia ahora** (igual que el patrón del Gym Planner).

### Migraciones a `players` e `injuries`
Ninguna. Por decisión, se quitan los displays `#1` / `Injury #211` de la página (edit de markup en Prompt 2), así que no hacen falta columnas nuevas.

**SQL propuesto (idempotente):**

```sql
-- rehab_plans
create table if not exists rehab_plans (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id),
  player_id uuid not null references players(id),
  injury_id uuid references injuries(id),
  kind text not null check (kind in ('rehab','preventive')),
  name text,
  diagnosis text,
  phase text,
  phase_type text check (phase_type in ('field','strength','subacute','foundation','capacity')),
  start_date date,
  rtp_estimate date,
  rtp_window_days int,
  programme_week int,
  programme_total_weeks int,
  source text check (source in ('injury','evaluation','gps','manual')),
  source_label text,
  risk_metric text,
  status text not null default 'on_track'
    check (status in ('on_track','near_rtp','blocked','cleared','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_rehab_plans_club on rehab_plans(club_id);
create index if not exists idx_rehab_plans_club_status on rehab_plans(club_id, status);

-- rehab_plan_owners
create table if not exists rehab_plan_owners (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references rehab_plans(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  role text not null check (role in ('physio','sc','coach')),
  created_at timestamptz default now(),
  unique (plan_id, profile_id)
);
create index if not exists idx_rehab_owners_plan on rehab_plan_owners(plan_id);

-- RLS (mismo patrón multi-tenant del resto)
alter table rehab_plans enable row level security;
alter table rehab_plan_owners enable row level security;
-- políticas: select/insert/update/delete where club_id = (jwt club) — replicar las de injuries.
```

> `rehab_sessions` no se incluye acá: va en el bloque Rehab Planner.

---

## 6 · Botones muertos, pestañas y elementos sin función

| Elemento | Línea | Estado hoy | Acción propuesta |
|---|---|---|---|
| `Export` (`.cm-btn.is-secondary`) | 27 | Sin listener | Popover: CSV de planes (data actual) + PDF/PNG/Share como placeholder (patrón GPS) |
| `New plan` (`<a>`) | 28 | Navega a Rehab Planner | OK; pasar `?new=1` para abrir alta directa |
| Filter pills ×5 (All/Rehab/Preventive/Near RTP/Blocked) | 75-79 | Solo `is-on` visual | Filtrado client-side sobre las filas; counts desde la data |
| Search atleta + `/` kbd | 81-85 | Sin listener | Filtra por nombre; `/` enfoca el input (¡cuidado con el `/` del buscador global del topbar — desambiguar foco!) |
| "Sorted by: RTP estimate" | 87 | Label estático | Convertir en dropdown real: RTP / Day / Status / Name |
| Filas `<tr onclick=...>` ×7 | 110,153,197,240,304,344,383 | Navegan a `Rehab Planner.html` **sin contexto** | Pasar `?plan=<id>` (o `?player=<id>`) para que el Planner cargue el plan correcto |
| Link "history view" | 432 | `href="#"` muerto | Vista de historial = filtro `status in (cleared,archived)`, o página aparte (marcar "Próximamente" si no existe) |
| Botón settings (gear) | — | **No existe** | Copiar de `Injuries.html`: `.cm-icon-btn[data-open-settings]` → abre `settings-drawer.jsx` ya cargado |
| Campana notificaciones | — | **No existe** | Copiar de `Injuries.html`: `.cm-icon-btn` bell (lee `notifications`, realtime) |
| Buscador global | — | **No existe** | Copiar `.hub-search` de `Injuries.html` (distinto del `.po-search` local) |
| Displays `· #1` y `Injury #211` | 114,126,… | Markup estático | **Quitar** (decisión 3): se borra el `#camiseta` del `.pos` y la línea `Injury #…` del `.line2` |

---

## 7 · Plan de ejecución por módulos

Orden sugerido (cada uno = 1 prompt quirúrgico, respetando `CLAUDE_RULES.md`):

- **Prompt 0 — DB.** Correr el SQL de §5 (tablas + columnas + RLS). Poblar `rehab_plans` + `rehab_plan_owners` con los 7 planes reales que matcheen las lesiones a mano (§3). Sin esto, nada de lo demás tiene de dónde leer.
- **Prompt 1 — Topbar.** Replicar search + notificaciones + settings desde la página canónica (pendiente identificar fuente / revisar `sidebar.js`). No tocar CSS.
- **Prompt 2 — Data wiring.** Arreglar el `<script>`: tablas reales, selectores `.po-tbl` por sección, template con clases reales, render por `kind`, KPIs y counts calculados, header dinámico. Eliminar las filas hardcoded.
- **Prompt 3 — Controles.** Dar función a filter pills, search, sort, Export, history link, y pasar contexto en el `onclick` de filas.
- **Siguiente módulo → Rehab Planner.** "Today's session" / `rehab_sessions` y la persistencia del plan se resuelven ahí.

---

## Decisiones (cerradas)

1. **Una sola tabla `rehab_plans`** (kind rehab|preventive). ✓
2. **Topbar** copiado de `Injuries.html` (search + bell + settings). ✓
3. **Sin** `squad_number`/`injury_number`: se quitan los displays `#1` / `Injury #211`. ✓

Pendiente único para escribir el seed: correr la query de verificación de §3 y pasarme el resultado (jugadores + lesiones a mano), para mapear cada plan a su `player_id`/`injury_id` real.
