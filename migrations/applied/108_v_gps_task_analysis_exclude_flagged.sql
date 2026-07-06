-- 108_v_gps_task_analysis_exclude_flagged.sql
-- FASE 3 · A — exclude flagged periods from the per-task analysis by default.
-- gps_period_reports.is_flagged is set by the importer (speed_outlier) and by the manual
-- review panel. Flagged rows STAY in the table (not deleted) — they're just not graphed.
-- The in-view speed cap (total_distance/duration <= 13 m/s) is kept as a second line of
-- defense (harmless overlap; covers rows flagged before the importer change shipped).
--
-- Idempotent: drop + recreate. Same definition as migration 106 plus `r.is_flagged = false`.

drop view if exists public.v_gps_task_analysis;
create view public.v_gps_task_analysis
  with (security_invoker = true) as
select
  r.club_id,
  r.session_id,
  ts.session_date,
  ts.team_id,
  m.exercise_id,
  e.name                                                      as exercise_name,
  e.field_width,
  e.field_height,
  e.players_count,

  -- m² per player (only when real dimensions exist)
  case when e.players_count > 0 and e.field_width > 0 and e.field_height > 0
       then round((e.field_width * e.field_height) / e.players_count)
       else null end                                          as m2_per_player,

  -- dims as strings for grouping
  case when e.field_width > 0 and e.field_height > 0
       then (e.field_width::text || 'x' || e.field_height::text)
       else null end                                          as field_size,
  case when e.players_count > 0
       then (e.players_count::text || 'p')
       else null end                                          as players_format,

  r.player_id,
  (p.first_name || ' ' || p.last_name)                        as player_name,
  p.position,
  p.number,

  r.duration_seconds,
  (r.duration_seconds / 60.0)                                 as work_min,

  -- totals (UNIT = METRES, already normalised; NOT multiplied ×1000)
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

  -- per-minute derived (metric / (duration_seconds/60))
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
  and r.is_flagged = false                -- FASE 3: hide review-flagged periods from analysis
  and r.duration_seconds >= 30            -- anti-garbage floor (same as v_exercise_gps_profile)
  -- impossible average speed guard (UNIT = METRES): total_distance/duration <= 13 m/s
  and (r.total_distance is null or (r.total_distance / nullif(r.duration_seconds, 0)) <= 13);
