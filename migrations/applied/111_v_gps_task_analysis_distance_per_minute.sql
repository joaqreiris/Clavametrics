-- 111_v_gps_task_analysis_distance_per_minute.sql
-- FIX (1) Distance/Min = 0: the builder catalog metric is 'distance_per_minute', but the
--   view only exposed 'total_distance_per_min' → the requested column didn't exist → 0.
--   Expose 'distance_per_minute' COMPUTED from total_distance / (duration/60). We do NOT
--   trust the raw gps_period_reports.distance_per_minute column (null/0 in migrated data).
--   total_distance_per_min is kept too (back-compat with the Task catalog labels).
-- FIX (2) field_size with decimals: field_width/height are numeric(6,1) → "50.0x70.0".
--   Round to int before concatenating → "50x70". (m2_per_player is already integer.)
--
-- Same definition as 110 + those two changes. Idempotent: drop + recreate.

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

  -- (2) integer dims → "50x70", not "50.0x70.0"
  case when e.field_width > 0 and e.field_height > 0
       then (round(e.field_width)::int::text || 'x' || round(e.field_height)::int::text)
       else null end                                          as field_size,

  -- Game format parsed from the drill name ("7VS7VS7"→"7v7", "PG - 10VS5"→"10v5"); else "{players_count}p".
  case
    when e.name ~* '\d+\s*vs\s*\d+'
      then lower(regexp_replace(substring(e.name from '\d+\s*[Vv][Ss]\s*\d+'), '\s*[Vv][Ss]\s*', 'v', 'g'))
    when e.players_count > 0 then (e.players_count::text || 'p')
    else null
  end                                                         as players_format,

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

  -- per-minute (computed from totals / minutes; NEVER the raw distance_per_minute column).
  -- (1) 'distance_per_minute' matches the builder catalog name so Distance/Min works in task.
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
