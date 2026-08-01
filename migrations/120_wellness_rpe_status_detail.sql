-- Migration 120: extend wellness_status + session_rpe_status with per-player detail
--
-- Purpose: let the redesigned Wellness Monitor and Session RPE Monitor render
-- per-player detail in a single call:
--   * wellness_status  -> wellness sub-items (sleep/fatigue/soreness/stress/mood),
--                         pain zones (body_areas), note, submit time
--   * session_rpe_status -> sRPE load, duration, pain zones (body_areas), note
--
-- Purely additive: existing return columns keep their names and positions, the
-- new columns are appended at the end. Current callers (Load Monitor, checklists)
-- select by column name and are unaffected.
--
-- DROP + CREATE is required because RETURNS TABLE signatures change (Postgres
-- will not let CREATE OR REPLACE alter the OUT-parameter list of a function).
--
-- Access scope (my_player_ids / team_id) and ordering are preserved verbatim.

-- =========================== wellness_status ===========================

drop function if exists public.wellness_status(uuid, uuid, date);

create function public.wellness_status(
  p_club_id uuid,
  p_team_id uuid default null::uuid,
  p_date    date default current_date
)
returns table (
  player_id     uuid,
  player_name   text,
  responded     boolean,
  readiness     numeric,
  hooper_index  numeric,
  sleep_quality numeric,
  fatigue       numeric,
  soreness      numeric,
  stress        numeric,
  mood          numeric,
  note          text,
  body_areas    text[],
  submitted_at  timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare v_date date := coalesce(p_date, current_date);
begin
  return query
    select q.player_id, q.player_name, q.responded, q.readiness, q.hooper_index,
           q.sleep_quality, q.fatigue, q.soreness, q.stress, q.mood,
           q.note, q.body_areas, q.submitted_at
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (w.id is not null) as responded,
        w.readiness as readiness,
        w.hooper_index as hooper_index,
        w.sleep_quality as sleep_quality,
        w.fatigue as fatigue,
        w.soreness as soreness,
        w.stress as stress,
        w.mood as mood,
        w.note as note,
        w.body_areas as body_areas,
        w.submitted_at as submitted_at,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.wellness w
        on w.player_id = p.id and w.submitted_at::date = v_date
      where p.club_id = p_club_id
        and p.archived_at is null
        and p.id in (select public.my_player_ids())
        and (p_team_id is null or p.team_id = p_team_id)
      order by p.id, w.submitted_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end; $function$;

-- ========================= session_rpe_status ==========================

drop function if exists public.session_rpe_status(uuid);

create function public.session_rpe_status(p_session_id uuid)
returns table (
  player_id   uuid,
  player_name text,
  responded   boolean,
  rpe         numeric,
  srpe_load   numeric,
  duration    integer,
  body_areas  text[],
  note        text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_club uuid;
  v_team uuid;
begin
  select club_id, team_id into v_club, v_team
  from public.training_sessions
  where id = p_session_id;

  return query
    select q.player_id, q.player_name, q.responded, q.rpe,
           q.srpe_load, q.duration, q.body_areas, q.note
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (r.id is not null) as responded,
        r.rpe as rpe,
        r.load as srpe_load,
        r.duration as duration,
        r.body_areas as body_areas,
        r.note as note,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.rpe r
        on r.player_id = p.id and r.session_id = p_session_id
      where p.club_id = v_club
        and p.archived_at is null
        and p.status <> 'inactive'
        and (v_team is null or p.team_id = v_team)
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end; $function$;
