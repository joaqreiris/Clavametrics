-- 112_v_gps_task_analysis_players_format_wildcards.sql
-- FIX players_format: capture the FULL game format including wildcards/extras.
--   Today we parse only "<n>VS<n>" → "5VS5+2" becomes "5v5" (the "+2" is dropped).
--   A drill with wildcards is a DIFFERENT task (changes the dynamic/demand), so we want
--   the complete format: "5v5+2", "4v4+3", "3v2+2+3v2", "5v5+gk".
--
-- Extend the captured substring to match the base "<n>VS<n>" PLUS any chain of "+<tail>"
-- where <tail> is another "<n>VS<n>", a bare number, or "GK". Then normalize:
--   VS → v   ·   strip spaces around "+"   ·   lowercase.
--
-- IMPORTANT (Postgres gotcha): substring(x from 'pat') returns the FIRST PARENTHESIZED
--   group when one exists, not the whole match. So every added group is NON-CAPTURING
--   (?:...) — otherwise substring would return just the "+tail" part.
--
-- Examples:
--   "RONDO - 3VS2+2+3VS2 (10X5X10 HEX)" → "3v2+2+3v2"
--   "4VS4+3 (18X15M)"                   → "4v4+3"
--   "GAME 5VS5+GK (32X20M)"             → "5v5+gk"
--   "7VS7VS7"                           → "7v7"  (no "+", chain stops at first NvN)
--   "T - 2VS1"                          → "2v1"
--   drills with no VS pattern           → "{players_count}p"
--
-- Same definition as 111 + the extended players_format expression. Idempotent: drop + recreate.

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
