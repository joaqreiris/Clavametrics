-- 110_v_gps_task_analysis_players_format.sql
-- FIX players_format: the useful "game format" (4v4, 7v7, 10v5) is the STRUCTURE, not the
-- total player count. players_count is the TOTAL (→ "12p"), which isn't the format. In the
-- real data (MOI) the structure lives in the drill NAME ("7VS7VS7", "4VS4+3", "T - 2VS1",
-- "PG - 10VS5 PRESSING"). Parse the first "<n>VS<n>" out of the name → "7v7" / "4v4" / "10v5",
-- with a fallback to "{players_count}p" when the name has no VS pattern.
--
-- (Option (b) — a structured exercises.game_format column set in the Drill Designer — is the
--  proper long-term fix; this name-parse gives immediate value over existing data.)
--
-- Same definition as 109 + the new players_format expression. Idempotent: drop + recreate.

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
       then (e.field_width::text || 'x' || e.field_height::text)
       else null end                                          as field_size,

  -- Game format from the drill name (first "<n> VS <n>", any case/spacing) → "7v7"; else
  -- fall back to the total-players label "{players_count}p".
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
