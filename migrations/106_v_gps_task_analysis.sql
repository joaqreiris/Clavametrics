-- 106_v_gps_task_analysis.sql
-- LADRILLO 1 — source view for per-TASK GPS analysis in GPS Analysis.
-- Grain: one row per PERIOD × PLAYER (every drill each player did), for periods that
-- are mapped to an exercise via gps_drill_map. Pure SQL, additive: it does NOT touch
-- the existing "per session" flow (gps_reports) nor any other view.
--
-- UNITS = METRES. The data in gps_period_reports is already normalised to metres — do
-- NOT multiply ×1000 (unlike the older v_exercise_gps_profile, which assumed km). The
-- impossible-average-speed guard therefore uses total_distance/duration <= 13 m/s.
--
-- RLS: security_invoker = true → the view runs with the CALLER's permissions, so it
-- inherits the club-scoped RLS of the base tables (same pattern as v_exercise_gps_profile).
--
-- Idempotent: drop + recreate.

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
  and r.duration_seconds >= 30            -- anti-garbage floor (same as v_exercise_gps_profile)
  -- impossible average speed guard (UNIT = METRES): total_distance/duration <= 13 m/s
  and (r.total_distance is null or (r.total_distance / nullif(r.duration_seconds, 0)) <= 13);

-- NB on indexes: gps_period_reports already has (club_id, session_id) / (club_id, player_id)
-- / (club_id, period_id) btree indexes, and gps_drill_map has its UNIQUE(club_id, period_name)
-- + (club_id, exercise_id). Those cover the join/filter columns — no new index needed.

-- ── Smoke test (run manually in the SQL editor; not executed by the migration) ──
-- select session_date, exercise_name, field_size, players_format, m2_per_player,
--        player_name, position, work_min,
--        total_distance, total_distance_per_min, player_load, player_load_per_min
-- from public.v_gps_task_analysis
-- order by session_date desc, exercise_name, player_name
-- limit 50;
