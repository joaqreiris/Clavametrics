# GPS — Handoff de sesión (2026-08-16)

Resumen de todo lo que se hizo en esta sesión, qué está aplicado vs pendiente, y qué falta.
**Objetivo del handoff:** que la otra sesión siga sin pisar cambios ni romper nada.

> ⚠️ **Coordinación:** las dos sesiones estuvieron editando los MISMOS archivos GPS
> (`assets/gp-builder/gp-filterbar.js`, `lib/gp-card/resolver.js`, `assets/gp-builder/gp-builder.js`,
> `db/schema.sql`). Ya rompió una vez (ver "Bug del filtro"). **No editar estos archivos desde dos
> sesiones a la vez.**

---

## 1) Performance de GPS Analysis (HECHO, deployado)

Objetivo: que cargue rápido para cualquier club/usuario, de fábrica.

### RPCs creados (SECURITY DEFINER, aislados por club+equipo)
Todos en `db/schema.sql` (funciones globales, param por `p_club_id`). **Ya corridos en Supabase.**
- **`gps_player_agg`** — agrega por jugador (tabla/gauges/scatter/ranking/kpi plantel).
- **`gps_player_mc_agg`** — agrega por jugador×microciclo (tabla ALL VALUES con columna MC). El cliente
  pasa el mapa session→mc (window._gpMcOfSession).
- **`gps_filter_rows`** — filas planas para los DROPDOWNS del filterbar. **Devuelve `jsonb`** (no `RETURNS
  TABLE`) porque una TABLE queda capada a 1000 filas por PostgREST → truncaba dropdowns en clubes con
  >1000 gps_reports. **Gotcha clave.**
- **`session_in_my_teams(sid)`** — helper DEFINER usado en la policy `gps_reports_scoped_select` para
  cortar la RLS anidada (evita el timeout 57014).

### Fast-path (cliente, `lib/gp-card/resolver.js` + `gp-builder.js`)
- `canUsePlayerAgg` / `canUsePlayerMcAgg` deciden si una card puede resolverse por RPC.
- Cubre: scope **plantel**, viz `table/bars/ranking/kpi/gauge/scatter`, dims player-only o player×mc o
  none, métricas **core / derivadas (acc_dec) / calculadas-suma-pura (intensity) / count**.
- NO cubre (→ path crudo): line/heatmap/radar, comparaciones (vs mc/role/match), scope player, dims
  rival/posición, EAV, calculadas no-lineales (ratios).
- **Prendido por defecto** (`_gpPlayerAggOn()` → true). Opt-out: `localStorage.cm_gp_player_agg='0'` o
  `window.__gpPlayerAgg=false`. Modo auditoría: `window.__gpPlayerAggAudit=true` + `rerenderActiveCards()`
  → compara RPC vs crudo (0 mismatches = idéntico).
- Los números coinciden porque el RPC replica `applyAgg`+`rowVal` (NULL→0 vía coalesce, n=count(*),
  w=time_played>0). Verificado con auditoría: 0 mismatches en tabla/gauges/scatter/bars.

### RLS + índices (aplicados en Supabase)
- `gps_reports_scoped_select` usa `session_in_my_teams()` (cortó el timeout 57014).
- `alter role authenticated/anon set statement_timeout='20s'` (stopgap).
- Índices: `idx_gps_reports_club_player_valid` (parcial is_invalid=false), `idx_gps_reports_player_session`,
  `uq_seasons_club_team_name` / `uq_seasons_club_name_global`.

### Default de fecha automático (`gp-filterbar.js`)
- El filterbar arranca en la **temporada actual** (o **90 días** si no hay) — NO en "All time".
  Acota volumen → todo rápido, cubierto o no por RPC. `_dateUserSet` respeta la elección del usuario;
  el default NO se persiste (recalcula la temporada actual cada carga).

### Anti-parpadeo del boot
- `rerenderActiveCards` con debounce 90ms; `reload()` del filterbar solo re-dispara si recargó;
  `loadData` single-flight. (NO acoplar cards a la query lenta del filterbar — un gate causó 27s de
  spinner, revertido.)

### Bugs de criterio corregidos
- Temporada «2026/27» triplicada → dedup + índices únicos.
- Microciclo descuadrado (gráfico vs filtro) → criterio unificado + `season_id ∪ ventana`.

---

## 2) GPS NO auto-crea sesiones (Opción A) — EN PROGRESO

**Problema:** la sync (Catapult) y el wizard creaban sesiones "Training · fecha" fantasma → duplicaban
la sesión planificada y ensuciaban el Calendar.

**Criterio acordado (IMPORTANTE):**
- **Actual** (`is_historical=false`, temporada en curso): el GPS debe **engancharse** a la sesión
  planificada; si no existe → **pendiente/sugerir**, NO crear evento fantasma.
- **Histórico/importado** (`is_historical=true`, temporada pasada): NO hay planificación ni la va a
  haber → la sesión GPS-only ES correcta → **se sigue creando**.

### Etapa 1 — HECHA (commit e0acfa5)
`gps-import-wizard.js` `_gpResolveSessionId`: matchea en 2 pasos tolerante (exacto por tipo ignorando
is_historical → si no, adopta la planificada del día no-gym/no-match) en vez de exigir tipo+is_historical
exactos. Ya no duplica cuando la sesión existe.

### Etapa 2 — HECHA en código (commits 2763f01, 98aac82), **falta aplicar/deployar**
- Tabla **`gps_pending_activities`** (en `db/schema.sql`). **⚠️ CORRER EL SQL** en Supabase (ver abajo).
- `supabase/functions/gps-sync/index.ts` (Edge Function): si no adopta sesión:
  - `is_historical=true` → crea GPS-only (como antes).
  - `is_historical=false` → **upsert en `gps_pending_activities`** (no crea) + limpia el pendiente
    cuando 2a/2b sí resuelven sesión. Nuevo contador `pending_activities`.
- **⚠️ NO deployar la Edge Function todavía** — sin la bandeja (Etapa 3), los datos actuales sin sesión
  quedan invisibles en pending.

### Limpieza de fantasmas existentes — HECHA (el usuario corrió el merge)
- Merge SQL (transaccional): fantasmas duplicados de la temporada actual (First team) + pares ene-may
  → mergeados a la sesión real (partidos → sesión del partido, training → training). Mueve
  `gps_period_reports` (CASCADE por session_id) + `gps_reports` (CASCADE borra metrics) deduplicando por
  jugador; **borra el fantasma ANTES** de pasarle `external_activity_id` al keeper (unique
  `uq_training_sessions_club_activity`).
- Quedaron **~170 GPS-only históricos team-NULL** (temporada pasada) → **CORRECTOS, no tocar**.

### Etapa 3 — PENDIENTE (lo que falta)
Bandeja en **GPS Analysis** ("N días con GPS sin sesión") → por cada día "Crear sesión + asignar MD"
→ crea el `training_session` (is_historical=false) → **re-sync dirigido** de esa actividad → baja los
gps_reports → borra el pendiente. Decisiones ya tomadas: bandeja en GPS Analysis, re-sync dirigido.

---

## 3) Bug del filtro (parallel session) — ARREGLADO (commit 8f1045b)

La otra sesión agregó el filtro **«Contexto»** (`work_context`) a `_FIELD` del filterbar pero **olvidó
su `Set` en `_computeValidSets`** → `out['work_context'].add()` sobre undefined → TypeError → reventaba
`applyChaining` → **NINGÚN filtro andaba**. Fix: `work_context: new Set()` en `out` (línea ~242 de
`gp-filterbar.js`) + sumarlo a la lista de poda de stale. **Hard reload y anda.**

---

## SQL PENDIENTE de correr en Supabase

Solo esto queda (lo demás ya se corrió):

```sql
-- Etapa 2: tabla de pendientes
create table if not exists public.gps_pending_activities (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  session_date date not null,
  external_activity_id text,
  source text default 'catapult'::text not null,
  n_athletes integer,
  activity_name text,
  created_at timestamp with time zone default now() not null,
  constraint gps_pending_activities_pkey primary key (id),
  constraint gps_pending_activities_uq UNIQUE (club_id, external_activity_id)
);
CREATE INDEX IF NOT EXISTS idx_gps_pending_club ON public.gps_pending_activities (club_id, session_date);
alter table public.gps_pending_activities enable row level security;
create policy "gps_pending_club_select" on public.gps_pending_activities as permissive for select to public
  using ((club_id = public.get_user_club_id()) or public.is_super_admin());
create policy "gps_pending_staff_write" on public.gps_pending_activities as permissive for all to authenticated
  using (((club_id = public.get_user_club_id()) and public.has_full_planning_access()) or public.is_super_admin())
  with check (((club_id = public.get_user_club_id()) and public.has_full_planning_access()) or public.is_super_admin());
```

Y cuando uses contextos (rehab/individual/topup) en el filtro, si solo muestra 'team', re-correr
`CREATE OR REPLACE FUNCTION public.gps_filter_rows(...)` (la versión en `db/schema.sql` ya incluye
`'work_context', r.work_context` en el jsonb).

## DEPLOY pendiente
- **`supabase functions deploy gps-sync`** — SOLO después de tener la Etapa 3 (la bandeja).

## Verificaciones útiles (consola de GPS Analysis)
```js
cmFetchStatsDump();                    // perf por query
console.log(window.__cmRpcAvail);      // qué RPC se usó
window.__gpPlayerAggAudit = true; window.GpBuilder.rerenderActiveCards();  // 0 mismatches
```

## Commits de esta sesión (main)
Perf/criterio: 4a3f334, seasons/índices, 95c5961, 1fc1e9d, 00c0932, gps_filter_rows (jsonb),
default fecha (ba223b0), agg default-on (b72b326), gauge/scatter/intensity, anti-parpadeo.
No-auto-create: e0acfa5 (Etapa 1), 2763f01 + 98aac82 (Etapa 2). Fix filtro: 8f1045b.

> Memoria del proyecto actualizada: `project_gps_perf_optimizations`, `project_session_creation_and_gps_sync`.
