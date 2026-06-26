-- Migration 097: link período↔drill (Ladrillo 2c-i) + perfil GPS por-minuto (SSOT).
-- gps_period_reports.period_name es texto crudo de Catapult (muchas variantes del mismo drill).
-- gps_drill_map mapea cada period_name → exercises.id (entidad canónica de drill) o ignored.
-- v_exercise_gps_profile deriva el perfil por-minuto promediando TODAS las instancias mapeadas
-- de cada exercise → vista viva, refleja cada sync nuevo sin recomputar nada.
-- Idempotente: safe to re-run.

-- ── 1. Tabla de mapeo período→drill ───────────────────────────────────────────
create table if not exists public.gps_drill_map (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id)     on delete cascade,
  period_name text not null,
  exercise_id uuid references public.exercises(id)          on delete set null,
  ignored     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (club_id, period_name)
);

create index if not exists idx_gps_drill_map_club     on public.gps_drill_map (club_id);
create index if not exists idx_gps_drill_map_exercise on public.gps_drill_map (club_id, exercise_id);

alter table public.gps_drill_map enable row level security;

-- SELECT: cualquier miembro del club ve los mapeos de su club.
drop policy if exists gps_drill_map_select on public.gps_drill_map;
create policy gps_drill_map_select on public.gps_drill_map
  for select to authenticated
  using (club_id = public.get_user_club_id());

-- INSERT/UPDATE/DELETE: solo admin/owner/super-admin (mismo criterio que player_teams:
-- has_full_planning_access() = is_super_admin() OR profiles.role IN ('admin','owner')).
drop policy if exists gps_drill_map_write on public.gps_drill_map;
create policy gps_drill_map_write on public.gps_drill_map
  for all to authenticated
  using      (club_id = public.get_user_club_id() and public.has_full_planning_access())
  with check (club_id = public.get_user_club_id() and public.has_full_planning_access());

-- ── 2. Vista de perfil GPS por-minuto, por exercise ───────────────────────────
-- Perfil = promedio de cada instancia (period report) mapeada a ese exercise.
-- Solo métricas ADITIVAS de volumen/conteo se llevan a por-minuto (dividir una
-- intensidad como max_speed/avg_speed por minutos no tiene sentido; distance_per_minute
-- ya es una tasa). security_invoker → respeta la RLS club-scoped de las tablas base.
drop view if exists public.v_exercise_gps_profile;
create view public.v_exercise_gps_profile
  with (security_invoker = true) as
select
  r.club_id,
  m.exercise_id,
  count(*)                                                  as n_instances,
  sum(r.duration_seconds) / 60.0                            as total_minutes,
  avg(r.total_distance           / (r.duration_seconds/60.0)) as total_distance_per_min,
  avg(r.high_speed_distance      / (r.duration_seconds/60.0)) as high_speed_distance_per_min,
  avg(r.very_high_speed_distance / (r.duration_seconds/60.0)) as very_high_speed_distance_per_min,
  avg(r.sprint_distance          / (r.duration_seconds/60.0)) as sprint_distance_per_min,
  avg(r.sprint_count             / (r.duration_seconds/60.0)) as sprint_count_per_min,
  avg(r.accelerations            / (r.duration_seconds/60.0)) as accelerations_per_min,
  avg(r.decelerations            / (r.duration_seconds/60.0)) as decelerations_per_min,
  avg(r.player_load              / (r.duration_seconds/60.0)) as player_load_per_min,
  avg(r.hmld                     / (r.duration_seconds/60.0)) as hmld_per_min
from public.gps_period_reports r
join public.gps_drill_map m
  on m.club_id = r.club_id
 and m.period_name = r.period_name
where m.exercise_id is not null
  and m.ignored = false
  and r.duration_seconds > 0
group by r.club_id, m.exercise_id;

-- ── 3. Vista auxiliar: period_names DISTINTOS con conteo y minutos promedio ────
-- Alimenta el wizard "Map drills" (evita traer miles de filas crudas / tope de 1000
-- filas de PostgREST). n_instances = filas (athlete-período), igual que el promedio
-- del perfil. security_invoker → RLS club-scoped de la tabla base.
drop view if exists public.v_gps_period_names;
create view public.v_gps_period_names
  with (security_invoker = true) as
select
  club_id,
  period_name,
  count(*)                                                        as n_instances,
  avg(duration_seconds) filter (where duration_seconds > 0) / 60.0 as avg_minutes
from public.gps_period_reports
where period_name is not null and period_name <> ''
group by club_id, period_name;
