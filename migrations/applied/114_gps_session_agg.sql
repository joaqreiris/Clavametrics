-- Migration 114: gps_session_agg(p_club_id, p_session_ids, p_player_ids)
-- PERF (P1a): server-side per-session squad aggregation of gps_reports.
--
-- Motivación: varias cards (squad-vs, ref-compare, ACWR daily, weekly-bars…) traen
-- squad × N sesiones de filas CRUDAS sólo para calcular UN agregado por sesión
-- (avg del plantel por métrica; max para métricas pico). Eso son miles de filas por
-- la red para producir decenas. Esta función hace el group-by en Postgres y devuelve
-- ~1 fila por sesión.
--
-- SECURITY INVOKER (default): corre con los permisos del que llama, así la RLS de
-- gps_reports (gps_reports_scoped_select → player_id IN my_player_ids()) aplica IGUAL
-- que en el fetch crudo → los agregados coinciden exactamente con el path cliente.
-- p_player_ids replica el filtro de roster (_scopeTeam .in('player_id', _gpPlayerIds));
-- pasar NULL = sin filtro de roster (todos los jugadores visibles por RLS).
--
-- Aditiva: no toca datos ni tablas. Rollback: drop function.
-- Idempotente: create or replace.

create or replace function public.gps_session_agg(
  p_club_id     uuid,
  p_session_ids uuid[],
  p_player_ids  uuid[] default null
)
returns table (
  session_id                    uuid,
  n_players                     integer,
  total_distance_avg            numeric,
  high_speed_distance_avg       numeric,
  very_high_speed_distance_avg  numeric,
  sprint_distance_avg           numeric,
  sprint_count_avg              numeric,
  max_speed_avg                 numeric,
  max_speed_max                 numeric,
  avg_speed_avg                 numeric,
  accelerations_avg             numeric,
  decelerations_avg             numeric,
  player_load_avg               numeric,
  hmld_avg                      numeric,
  time_played_avg               numeric,
  distance_per_minute_avg       numeric
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    r.session_id,
    count(*)::int                       as n_players,
    avg(r.total_distance)               as total_distance_avg,
    avg(r.high_speed_distance)          as high_speed_distance_avg,
    avg(r.very_high_speed_distance)     as very_high_speed_distance_avg,
    avg(r.sprint_distance)              as sprint_distance_avg,
    avg(r.sprint_count)                 as sprint_count_avg,
    avg(r.max_speed)                    as max_speed_avg,
    max(r.max_speed)                    as max_speed_max,
    avg(r.avg_speed)                    as avg_speed_avg,
    avg(r.accelerations)                as accelerations_avg,
    avg(r.decelerations)                as decelerations_avg,
    avg(r.player_load)                  as player_load_avg,
    avg(r.hmld)                         as hmld_avg,
    avg(r.time_played)                  as time_played_avg,
    avg(r.distance_per_minute)          as distance_per_minute_avg
  from public.gps_reports r
  where r.club_id = p_club_id
    and r.is_invalid = false
    and r.session_id = any(p_session_ids)
    and (p_player_ids is null or r.player_id = any(p_player_ids))
  group by r.session_id;
$$;
