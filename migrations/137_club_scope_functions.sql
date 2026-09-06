-- Migration 137: aplicar el guard de pertenencia (migración 136) a las 17 funciones que
-- reciben un club, un equipo o una sesión por parámetro. Las que estaban en SQL puro pasan
-- a plpgsql para poder cortar; la consulta que hacen no cambia.
--
-- Dos de ellas estaban ROTAS desde antes, y se arreglan acá:
--   · get_club_members       — seleccionaba `name`, columna que no existe en profiles
--                              (fallaba con 42703). La real es `full_name`.
--   · get_player_availability — la firma declara `timestamp without time zone` en la
--                              columna 6, pero MAX(w.submitted_at) devuelve timestamptz
--                              (fallaba con 42804). Se castea al tipo declarado.
--
-- club_has_feature es la excepción: se usa en las policies de 46 tablas, así que devuelve
-- FALSE en vez de lanzar. Un `raise` ahí haría fallar cualquier query a esas tablas en vez
-- de filtrar sus filas.

-- ── Club ────────────────────────────────────────────────────────────────────

create or replace function public.club_staff_count(p_club_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  perform public.assert_my_club(p_club_id);
  select count(*)::int into n from public.profiles
   where club_id = p_club_id and coalesce(role,'') <> 'player';
  return n;
end;
$$;

create or replace function public.club_staff_limit(p_club_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  perform public.assert_my_club(p_club_id);
  select case
    when count(*) = 0 then (select max_staff from public.plans where slug='initiation')
    when bool_or(pl.max_staff is null) then null
    else max(pl.max_staff)
  end into n
  from public.teams t join public.plans pl on pl.slug = public.team_plan_slug(t.id)
  where t.club_id = p_club_id;
  return n;
end;
$$;

create or replace function public.club_plan_features(p_club_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_feats jsonb; v_has_teams boolean; v_has_paid boolean; v_in_trial boolean;
begin
  if p_club_id is null then return '[]'::jsonb; end if;
  perform public.assert_my_club(p_club_id);
  select exists(select 1 from public.subscriptions s join public.teams t on t.id = s.team_id
                 where t.club_id = p_club_id and s.status in ('active','trialing','past_due')) into v_has_paid;
  select exists(select 1 from public.clubs where id = p_club_id
                 and trial_ends_at is not null and trial_ends_at > now()) into v_in_trial;
  if v_in_trial and not v_has_paid then
    select coalesce(features,'[]'::jsonb) into v_feats from public.plans where slug = 'full';
    return coalesce(v_feats,'[]'::jsonb);
  end if;
  select exists(select 1 from public.teams where club_id = p_club_id) into v_has_teams;
  if not v_has_teams then
    select coalesce(features,'[]'::jsonb) into v_feats from public.plans where slug = 'initiation';
    return coalesce(v_feats,'[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(distinct elem),'[]'::jsonb) into v_feats
    from public.teams t cross join lateral jsonb_array_elements_text(public.team_features(t.id)) as elem
   where t.club_id = p_club_id;
  return coalesce(v_feats,'[]'::jsonb);
end;
$$;

-- Booleana a propósito: la usan las policies de 46 tablas.
create or replace function public.club_has_feature(p_club_id uuid, p_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_my_club(p_club_id) then return false; end if;
  return coalesce(public.club_plan_features(p_club_id) ? p_key, false);
end;
$$;

create or replace function public.get_club_members(p_club_id uuid)
returns table(id uuid, email text, name text, role text, club_id uuid)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_my_club(p_club_id);
  return query
    select pr.id, pr.email,
           coalesce(
             nullif(trim(coalesce(pr.full_name, '')), ''),
             nullif(trim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), '')
           ) as name,
           pr.role, pr.club_id
      from public.profiles pr
     where pr.club_id = p_club_id
     order by coalesce(
       nullif(trim(coalesce(pr.full_name, '')), ''),
       nullif(trim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), ''),
       pr.email);
end;
$$;

create or replace function public.get_pending_rpe(p_club_id uuid)
returns table(id uuid, player_name text, rpe numeric, session_date date, created_at timestamp with time zone)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_my_club(p_club_id);
  return query
    select r.id,
           coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player'),
           r.rpe, r.session_date, r.created_at
    from public.rpe r
    join public.players p on p.id = r.player_id
    where r.club_id = p_club_id and r.session_id is null
    order by r.created_at desc;
end;
$$;

create or replace function public.recent_sessions(p_club_id uuid, p_limit integer default 5, p_today date default null::date)
returns table(id uuid, title text, session_date date, duration integer, session_type text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_my_club(p_club_id);
  return query
    select ts.id, ts.title, ts.session_date, ts.duration, ts.session_type
    from public.training_sessions ts
    where ts.club_id = p_club_id
      and ts.session_date <= coalesce(p_today, current_date)
    order by ts.session_date desc, ts.session_time desc nulls last
    limit p_limit;
end;
$$;

create or replace function public.get_player_availability(p_club_id uuid)
returns table(player_id uuid, first_name text, last_name text, status text,
              current_injuries integer, last_wellness timestamp without time zone, readiness integer)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_my_club(p_club_id);
  return query
  select p.id, p.first_name, p.last_name, p.status,
         count(i.id)::int as current_injuries,
         (max(w.submitted_at) at time zone 'UTC')::timestamp as last_wellness,
         max((w.readiness)::int)
  from public.players p
  left join public.injuries i on i.player_id = p.id and i.status = 'active'
  left join public.wellness w on w.player_id = p.id
  where p.club_id = p_club_id
  group by p.id, p.first_name, p.last_name, p.status
  order by p.status desc, p.last_name;
end;
$$;

create or replace function public.link_pending_rpe(p_club_id uuid, p_date date default null::date)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform public.assert_my_club(p_club_id);
  for r in
    select id from public.rpe
    where club_id = p_club_id and session_id is null
      and (p_date is null or coalesce(session_date, created_at::date) = p_date)
  loop
    perform public.link_rpe_to_session(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ── Equipo ──────────────────────────────────────────────────────────────────

create or replace function public.team_features(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.assert_my_team(p_team_id);
  select coalesce(pl.features, '[]'::jsonb) into v
    from public.plans pl where pl.slug = public.team_plan_slug(p_team_id);
  return coalesce(v, '[]'::jsonb);
end;
$$;

create or replace function public.team_has_feature(p_team_id uuid, p_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_my_team(p_team_id);
  return public.team_features(p_team_id) ? p_key;
end;
$$;

create or replace function public.team_player_ids(p_team_id uuid)
returns setof uuid language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_my_team(p_team_id);
  return query select id from public.players where team_id = p_team_id;
end;
$$;

create or replace function public.team_plan_slug(p_team_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  perform public.assert_my_team(p_team_id);
  select coalesce(
    (select pl.slug
       from public.subscriptions s
       join public.plans pl on pl.id = s.plan_id
      where s.team_id = p_team_id
        and (s.status in ('active','trialing')
             or (s.status = 'past_due' and s.current_period_end > (now() - interval '7 days')))
      order by pl.sort_order desc
      limit 1),
    (select 'full'
       from public.teams t join public.clubs c on c.id = t.club_id
      where t.id = p_team_id and c.trial_ends_at is not null and c.trial_ends_at > now()),
    'initiation') into v;
  return v;
end;
$$;

create or replace function public.team_player_limit(p_team_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  perform public.assert_my_team(p_team_id);
  select pl.max_players into n from public.plans pl
   where pl.slug = public.team_plan_slug(p_team_id);
  return n;
end;
$$;

-- ── Jugador / sesión: se resuelve el club y se valida ese ───────────────────

create or replace function public.activity_team_for_player(p_player uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_club uuid; v_team uuid;
begin
  select club_id, team_id into v_club, v_team from public.players where id = p_player;
  if v_club is null then return null; end if;
  perform public.assert_my_club(v_club);
  return v_team;
end;
$$;

create or replace function public.rpe_effective_duration(p_session_id uuid, p_player_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare v_club uuid; n integer;
begin
  select ts.club_id into v_club from public.training_sessions ts where ts.id = p_session_id;
  if v_club is null then return null; end if;
  perform public.assert_my_club(v_club);
  select case when ts.session_type = 'match'
              then coalesce(nullif(a.minutes, 0), ts.duration)
              else ts.duration end into n
  from public.training_sessions ts
  left join public.availability a
    on a.player_id = p_player_id::text and a.date = ts.session_date
  where ts.id = p_session_id;
  return n;
end;
$$;

-- session_rpe_status: sólo se agregan las dos líneas del guard; el resto del cuerpo es el
-- que ya tenía.
create or replace function public.session_rpe_status(p_session_id uuid)
returns table(player_id uuid, player_name text, responded boolean, rpe numeric, note text,
              body_areas text[], duration integer, load numeric,
              submitted_at timestamp with time zone, av_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_club uuid; v_team uuid; v_date date; v_dur integer; v_type text;
begin
  select ts.club_id, ts.team_id, ts.session_date, ts.duration, ts.session_type
    into v_club, v_team, v_date, v_dur, v_type
  from public.training_sessions ts where ts.id = p_session_id;

  if v_club is null then return; end if;
  perform public.assert_my_club(v_club);

  return query
    select q.player_id, q.player_name, q.responded, q.rpe,
           q.note, q.body_areas, q.duration, q.load, q.submitted_at, q.av_status
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (r.id is not null) as responded,
        r.rpe as rpe, r.note as note, r.body_areas as body_areas,
        case when v_type = 'match'
             then coalesce(nullif(am.minutes, 0), v_dur, r.duration)
             else coalesce(v_dur, r.duration) end as duration,
        r.rpe * case when v_type = 'match'
                     then coalesce(nullif(am.minutes, 0), v_dur, r.duration)
                     else coalesce(v_dur, r.duration) end as load,
        r.created_at as submitted_at, am.status as av_status,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.rpe r on r.player_id = p.id and r.session_id = p_session_id
      left join lateral (
        select a2.status, a2.minutes from public.availability a2
        where a2.player_id = p.id::text and a2.date = v_date
        order by case when a2.team_id = v_team then 0 when a2.team_id is null then 1 else 2 end
        limit 1
      ) am on true
      where p.club_id = v_club
        and p.archived_at is null
        and p.status <> 'inactive'
        and not exists (
          select 1 from public.availability a
          where a.player_id = p.id::text and a.date = v_date
            and (a.status in ('sick','unavailable','away')
                 or (a.status = 'day_off'
                     and (a.team_id is null or v_team is null or a.team_id = v_team))))
        and (
          exists (select 1 from public.session_participants sp
                  where sp.session_id = p_session_id and sp.player_id = p.id)
          or (not exists (select 1 from public.session_participants sp where sp.session_id = p_session_id)
              and (v_team is null or p.team_id = v_team
                   or exists (select 1 from public.player_teams pt
                              where pt.player_id = p.id and pt.team_id = v_team))))
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end;
$$;
