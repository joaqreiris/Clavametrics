-- 143_v_gps_task_analysis_orientation.sql
-- Suma al análisis de ejercicios cómo están CATALOGADOS en la biblioteca: orientación
-- (ACTIVATION / ENDURANCE / STRENGTH / VELOCITY) e intensidad planificada (LOW…VERY_HIGH).
--
-- El dato ya existía y la vista YA hace join con `exercises`: sólo faltaba traerse las dos
-- columnas. Con esto se puede agrupar y filtrar por familia de trabajo, en vez de comparar
-- drill por drill contra una lista de sesenta nombres.
--
-- `intensity` sale como planned_intensity para dejar claro que es lo PLANIFICADO en la
-- biblioteca, no lo que midió el GPS — que es justo lo interesante de cruzar.
--
-- Los ejercicios sin catalogar quedan en NULL y el análisis los agrupa como «—»: no se
-- inventa una familia para ellos.
--
-- Misma definición que 112 + las dos columnas. Idempotente: drop + recreate.

drop view if exists public.v_gps_task_analysis;
create view public.v_gps_task_analysis
  with (security_invoker = true) as
select
  r.id,
  r.club_id,
  r.session_id,
  ts.session_date,
  ts.team_id,
  m.exercise_id,
  e.name                                                      as exercise_name,
  e.field_width,
  e.field_height,
  e.players_count,

  case when e.players_count > 0 and e.field_width > 0 and e.field_height > 0
       then round((e.field_width * e.field_height) / e.players_count)
       else null end                                          as m2_per_player,

  case when e.field_width > 0 and e.field_height > 0
       then (round(e.field_width)::int::text || 'x' || round(e.field_height)::int::text)
       else null end                                          as field_size,

  -- Game format parsed from the drill name, WITH wildcards/extras.
  -- Base "<n>VS<n>" followed by an optional chain of "+<n>VS<n>" / "+<n>" / "+GK".
  -- All inner parens are NON-CAPTURING so substring() returns the whole match.
  case
    when e.name ~* '\d+\s*vs\s*\d+'
      then lower(
             regexp_replace(
               regexp_replace(
                 substring(e.name from '\d+\s*[Vv][Ss]\s*\d+(?:\s*\+\s*(?:\d+\s*[Vv][Ss]\s*\d+|\d+|[Gg][Kk]))*'),
                 '\s*[Vv][Ss]\s*', 'v', 'g'),
               '\s*\+\s*', '+', 'g'))
    when e.players_count > 0 then (e.players_count::text || 'p')
    else null
  end                                                         as players_format,

  -- Cómo está CATALOGADO el ejercicio en la biblioteca. Es la lectura que el cuerpo técnico ya
  -- tiene en la cabeza («los de fuerza», «los de velocidad») y hasta ahora no llegaba al
  -- análisis: se podía comparar drill contra drill, pero no una familia contra otra.
  -- Vienen del mismo join a exercises que ya usa la vista: sin coste de consulta.
  e.orientation                                               as orientation,
  e.intensity                                                 as planned_intensity,

  r.player_id,
  (p.first_name || ' ' || p.last_name)                        as player_name,
  p.position,
  p.number,

  r.duration_seconds,
  (r.duration_seconds / 60.0)                                 as work_min,

  r.total_distance,
  r.high_speed_distance,
  r.very_high_speed_distance,
  r.sprint_distance,
  r.sprint_count,
  r.accelerations,
  r.decelerations,
  r.player_load,
  r.hmld,
  r.max_speed,
  r.avg_speed,

  (r.total_distance           / nullif(r.duration_seconds/60.0, 0)) as distance_per_minute,
  (r.total_distance           / nullif(r.duration_seconds/60.0, 0)) as total_distance_per_min,
  (r.high_speed_distance      / nullif(r.duration_seconds/60.0, 0)) as high_speed_distance_per_min,
  (r.very_high_speed_distance / nullif(r.duration_seconds/60.0, 0)) as very_high_speed_distance_per_min,
  (r.sprint_distance          / nullif(r.duration_seconds/60.0, 0)) as sprint_distance_per_min,
  (r.player_load              / nullif(r.duration_seconds/60.0, 0)) as player_load_per_min,
  (r.accelerations            / nullif(r.duration_seconds/60.0, 0)) as accelerations_per_min,
  (r.decelerations            / nullif(r.duration_seconds/60.0, 0)) as decelerations_per_min,
  (r.hmld                     / nullif(r.duration_seconds/60.0, 0)) as hmld_per_min
from public.gps_period_reports   r
join public.gps_drill_map        m  on m.club_id = r.club_id and m.period_name = r.period_name
join public.exercises            e  on e.id = m.exercise_id
join public.training_sessions    ts on ts.id = r.session_id
join public.players              p  on p.id = r.player_id
where m.exercise_id is not null
  and m.ignored = false
  and r.is_flagged = false
  and r.duration_seconds >= 30
  and (r.total_distance is null or (r.total_distance / nullif(r.duration_seconds, 0)) <= 13);
