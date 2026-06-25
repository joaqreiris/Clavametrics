-- Migration 099: extend v_exercise_gps_profile with AVG TOTAL per instance.
-- The view already exposes <metric>_per_min (intensity). The drill GPS profile
-- also needs volume: the average TOTAL per mapped instance (not divided by
-- minutes). Same row set as the per-minute columns, so n_instances matches.
-- Units = as stored: total_distance in KM (UI ×1000 → m), other distances in m.
-- Idempotente: drop+recreate.

drop view if exists public.v_exercise_gps_profile;
create view public.v_exercise_gps_profile
  with (security_invoker = true) as
select
  r.club_id,
  m.exercise_id,
  count(*)                                                  as n_instances,
  sum(r.duration_seconds) / 60.0                            as total_minutes,

  -- ── PER MINUTE (intensity) — unchanged ──────────────────────────────────
  avg(r.total_distance           / (r.duration_seconds/60.0)) as total_distance_per_min,
  avg(r.high_speed_distance      / (r.duration_seconds/60.0)) as high_speed_distance_per_min,
  avg(r.very_high_speed_distance / (r.duration_seconds/60.0)) as very_high_speed_distance_per_min,
  avg(r.sprint_distance          / (r.duration_seconds/60.0)) as sprint_distance_per_min,
  avg(r.sprint_count             / (r.duration_seconds/60.0)) as sprint_count_per_min,
  avg(r.accelerations            / (r.duration_seconds/60.0)) as accelerations_per_min,
  avg(r.decelerations            / (r.duration_seconds/60.0)) as decelerations_per_min,
  avg(r.player_load              / (r.duration_seconds/60.0)) as player_load_per_min,
  avg(r.hmld                     / (r.duration_seconds/60.0)) as hmld_per_min,

  -- ── AVG TOTAL (volume) — average of the raw total per instance ──────────
  avg(r.total_distance)           as total_distance_avg,
  avg(r.high_speed_distance)      as high_speed_distance_avg,
  avg(r.very_high_speed_distance) as very_high_speed_distance_avg,
  avg(r.sprint_distance)          as sprint_distance_avg,
  avg(r.sprint_count)             as sprint_count_avg,
  avg(r.accelerations)            as accelerations_avg,
  avg(r.decelerations)            as decelerations_avg,
  avg(r.player_load)              as player_load_avg,
  avg(r.hmld)                     as hmld_avg
from public.gps_period_reports r
join public.gps_drill_map m
  on m.club_id = r.club_id
 and m.period_name = r.period_name
where m.exercise_id is not null
  and m.ignored = false
  and r.duration_seconds > 0
group by r.club_id, m.exercise_id;
