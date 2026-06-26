-- migrations/077_rpe_one_per_session.sql
-- Candado anti-duplicado para RPE: si el jugador ya respondió esta sesión (o este día,
-- si el link no tiene sesión), no inserta de nuevo y devuelve {ok:true, already:true}.
-- Wellness (uno por día) y todo lo demás queda igual que en la 074.

create or replace function public.submit_survey(p_token text, p_player_id uuid, p_payload jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_link record; v_ok boolean; v_read int; v_hooper int;
  v_areas text[]; v_note text; v_pname text; v_team uuid; v_rpe_id uuid; v_dur int; v_sdate date;
begin
  select * into v_link from public.share_links
   where token = p_token and revoked = false
     and (expires_at is null or expires_at > now())
     and scope in ('wellness','rpe','survey');
  if not found then return jsonb_build_object('error','invalid_token'); end if;

  select exists (
    select 1 from public.players p
    where p.id = p_player_id and p.club_id = v_link.club_id
      and (v_link.team_id is null or p.team_id = v_link.team_id)
  ) into v_ok;
  if not v_ok then return jsonb_build_object('error','player_not_in_scope'); end if;

  select array(select jsonb_array_elements_text(coalesce(p_payload->'body','[]'::jsonb))) into v_areas;
  v_note := nullif(trim(coalesce(p_payload->>'note','')), '');

  if v_link.scope = 'rpe' then
    if v_link.session_id is not null then
      -- Candado por sesión: ya respondió esta sesión.
      if exists (select 1 from public.rpe
                 where club_id = v_link.club_id and player_id = p_player_id
                   and session_id = v_link.session_id) then
        return jsonb_build_object('ok', true, 'already', true);
      end if;
      select duration, session_date into v_dur, v_sdate from public.training_sessions where id = v_link.session_id;
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_id, duration, load, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas,
              v_link.session_id, v_dur, (p_payload->>'rpe')::numeric * coalesce(v_dur, 0), coalesce(v_sdate, current_date));
    else
      -- Candado por día (link sin sesión): ya respondió hoy.
      if exists (select 1 from public.rpe
                 where club_id = v_link.club_id and player_id = p_player_id
                   and coalesce(session_date, created_at::date) = current_date) then
        return jsonb_build_object('ok', true, 'already', true);
      end if;
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas, current_date)
      returning id into v_rpe_id;
      perform public.link_rpe_to_session(v_rpe_id);
    end if;
  else
    -- Wellness: uno por día (sin cambios respecto a la 074).
    if exists (
      select 1 from public.wellness
      where player_id = p_player_id and club_id = v_link.club_id
        and submitted_at::date = current_date
    ) then
      return jsonb_build_object('ok', true, 'already', true);
    end if;

    if (p_payload->>'scale') = '7' then
      v_hooper := coalesce((p_payload->>'sleepQ')::int,4) + coalesce((p_payload->>'fatigue')::int,4)
                + coalesce((p_payload->>'stress')::int,4) + coalesce((p_payload->>'soreness')::int,4);
      v_read := round(10 - (v_hooper - 4) / 24.0 * 10)::int;
      insert into public.wellness (club_id, player_id, sleep_quality, mood, fatigue, stress, soreness, hooper_index, readiness, note, body_areas, submitted_at)
      values (v_link.club_id, p_player_id, (p_payload->>'sleepQ')::int, (p_payload->>'mood')::int,
              (p_payload->>'fatigue')::int, (p_payload->>'stress')::int, (p_payload->>'soreness')::int,
              v_hooper, v_read, v_note, v_areas, now());
    else
      v_read := round((
        coalesce((p_payload->>'sleepQ')::int,5) + coalesce((p_payload->>'mood')::int,5) +
        coalesce((p_payload->>'fatigue')::int,5) + (10 - coalesce((p_payload->>'stress')::int,5)) +
        (10 - coalesce((p_payload->>'soreness')::int,5))
      ) / 5.0);
      insert into public.wellness (club_id, player_id, sleep_quality, mood, fatigue, stress, soreness, readiness, note, body_areas, submitted_at)
      values (v_link.club_id, p_player_id, (p_payload->>'sleepQ')::int, (p_payload->>'mood')::int,
              (p_payload->>'fatigue')::int, (p_payload->>'stress')::int, (p_payload->>'soreness')::int,
              v_read, v_note, v_areas, now());
    end if;
  end if;

  -- ALERTA por molestia (sin cambios).
  if array_length(v_areas, 1) > 0 then
    select coalesce(nullif(trim(coalesce(first_name,'')||' '||coalesce(last_name,'')),''),'A player'), team_id
      into v_pname, v_team from public.players where id = p_player_id;
    insert into public.notifications (user_id, club_id, type, title, body, link)
    select pr.id, v_link.club_id, 'wellness_alert',
           v_pname || ' reported discomfort',
           'Areas: ' || array_to_string(v_areas, ', ') || coalesce(' · "'||v_note||'"','') ||
             case when v_link.scope='rpe' then ' (post-RPE)' else '' end,
           '/Load Monitor.html'
    from public.profiles pr
    cross join lateral (select public.role_bucket(pr.role) as bucket) b
    left join public.notification_settings ns
      on ns.club_id = v_link.club_id and ns.alert_type = 'discomfort' and ns.role = b.bucket
    where pr.club_id = v_link.club_id
      and coalesce(ns.enabled, b.bucket in ('medical','admin','sc','coach')) = true
      and (
        coalesce(ns.scope, case when b.bucket in ('medical','admin') then 'club' else 'team' end) = 'club'
        or ( coalesce(ns.scope, 'team') = 'team' and v_team is not null
             and exists (select 1 from public.member_teams mt where mt.profile_id = pr.id and mt.team_id = v_team) )
      );
  end if;

  return jsonb_build_object('ok', true);
end; $function$;
