-- Migration 104: protect v_exercise_gps_profile from junk instances that blow up
-- the per-minute averages (root cause of e.g. 2383 m/min on T-2VS1+1).
-- Two guards added to the existing row filter; everything else is identical to
-- migration 100 (per-min intensity + avg totals). Idempotent: drop+recreate.
--   1) Duration floor: drop periods under 30s — too short for m/min to be meaningful
--      (a few metres in 2s → thousands of m/min).
--   2) Defensive speed cap: drop periods whose AVERAGE speed exceeds 13 m/s
--      (~46.8 km/h) — physically impossible over a whole period, so the row is
--      corrupt. total_distance is stored in KM → ×1000 for metres.

drop view if exists public.v_exercise_gps_profile;
create view public.v_exercise_gps_profile
  with (security_invoker = true) as
select
  r.club_id,
  m.exercise_id,
  count(*)                                                  as n_instances,
  sum(r.duration_seconds) / 60.0                            as total_minutes,

  -- ── PER MINUTE (intensity) ──────────────────────────────────────────────
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
  and r.duration_seconds >= 30                                          -- (1) duration floor
  and (r.total_distance is null
       or (r.total_distance * 1000.0) / r.duration_seconds <= 13)       -- (2) speed sanity cap (m/s)
group by r.club_id, m.exercise_id;
