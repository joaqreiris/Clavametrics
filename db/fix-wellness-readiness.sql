-- ═══════════════════════════════════════════════════════════════════════════
--  Fix: el check-in de bienestar fallaba justo con el jugador que peor estaba
--
--  submit_survey() calcula readiness = 10 - (hooper - 4) / 24 * 10, que da 0
--  cuando el Hooper llega a 27, y la tabla tiene CHECK (readiness between 1
--  and 10): el insert se rechaza y el jugador ve un error al enviar.
--
--  Hooper 27 significa responder casi todo con 7 — durmió pésimo, fatiga
--  extrema, mucho estrés y dolor severo. Es decir: el jugador que más
--  interesa que aparezca en el monitor era el único que no podía reportarse.
--
--  Afecta a TODOS los clubes. Aplicar en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_survey(p_token text, p_player_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link record; v_ok boolean; v_read int; v_hooper int;
  v_areas text[]; v_note text; v_pname text; v_team uuid; v_sid uuid; v_dur int; v_sdate date;
  v_tz int; v_local_date date; v_pick uuid; v_plegacy uuid; v_pany boolean;
begin
  select * into v_link from public.share_links
   where token = p_token and revoked = false
     and (expires_at is null or expires_at > now())
     and scope in ('wellness','rpe','survey');
  if not found then return jsonb_build_object('error','invalid_token'); end if;

  -- Client's Date.getTimezoneOffset() (minutes) → derive the submitter's local "today" so the
  -- one-per-day lock resets at local midnight, not UTC midnight.
  v_tz := coalesce((p_payload->>'tzOffset')::int, 0);
  v_local_date := ((now() at time zone 'UTC') - make_interval(mins => v_tz))::date;

  -- Mismo criterio que get_survey_players: convocatoria de la sesión si existe; si no,
  -- roster del equipo vía player_teams (incluye invitados) con fallback a players.team_id.
  select exists (
    select 1 from public.players p
    where p.id = p_player_id and p.club_id = v_link.club_id
      and (
        (v_link.session_id is not null
          and exists (select 1 from public.session_participants sp
                      where sp.session_id = v_link.session_id and sp.player_id = p.id))
        or (
          (v_link.session_id is null
            or not exists (select 1 from public.session_participants sp where sp.session_id = v_link.session_id))
          and (v_link.team_id is null
               or p.team_id = v_link.team_id
               or exists (select 1 from public.player_teams pt
                          where pt.player_id = p.id and pt.team_id = v_link.team_id))
        )
      )
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
      v_dur := public.rpe_effective_duration(v_link.session_id, p_player_id);
      select session_date into v_sdate from public.training_sessions where id = v_link.session_id;
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_id, duration, load, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas,
              v_link.session_id, v_dur, (p_payload->>'rpe')::numeric * coalesce(v_dur, 0), coalesce(v_sdate, current_date));
    else
      -- Link genérico (sin sesión): si el survey mandó la sesión elegida por el jugador
      -- (payload.sessionId), esa manda — validada contra club, día local y equipos del
      -- jugador. Si no vino o no valida, se resuelve por hora local como antes. El candado
      -- es POR SESIÓN, así en días de doble sesión (gym + campo) se cargan ambos RPE.
      begin
        v_pick := nullif(trim(coalesce(p_payload->>'sessionId','')), '')::uuid;
      exception when others then v_pick := null;
      end;
      if v_pick is not null then
        select team_id into v_plegacy from public.players where id = p_player_id;
        v_pany := (v_plegacy is not null)
               or exists (select 1 from public.player_teams pt where pt.player_id = p_player_id);
        select ts.id into v_sid
        from public.training_sessions ts
        where ts.id = v_pick
          and ts.club_id = v_link.club_id
          and ts.session_date = v_local_date
          and (not v_pany
               or ts.team_id = v_plegacy
               or exists (select 1 from public.player_teams pt
                          where pt.player_id = p_player_id and pt.team_id = ts.team_id));
      end if;
      if v_sid is null then
        v_sid := public.resolve_rpe_session(v_link.club_id, p_player_id, v_local_date,
                   ((now() at time zone 'UTC') - make_interval(mins => v_tz))::time);
      end if;
      if v_sid is not null then
        -- Bloquea el duplicado de ESA sesión, y también si quedó un huérfano de hoy sin
        -- asignar (no se puede saber a qué sesión pertenecía; lo resuelve el staff).
        if exists (select 1 from public.rpe
                   where club_id = v_link.club_id and player_id = p_player_id
                     and (session_id = v_sid
                          or (session_id is null
                              and coalesce(session_date, ((created_at at time zone 'UTC') - make_interval(mins => v_tz))::date) = v_local_date))) then
          return jsonb_build_object('ok', true, 'already', true);
        end if;
        v_dur := public.rpe_effective_duration(v_sid, p_player_id);
        insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_id, duration, load, session_date)
        values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas,
                v_sid, v_dur, (p_payload->>'rpe')::numeric * coalesce(v_dur, 0), v_local_date);
      else
        -- Sin sesión ni partido ese día: queda huérfano con candado por día (como antes).
        if exists (select 1 from public.rpe
                   where club_id = v_link.club_id and player_id = p_player_id
                     and coalesce(session_date, ((created_at at time zone 'UTC') - make_interval(mins => v_tz))::date) = v_local_date) then
          return jsonb_build_object('ok', true, 'already', true);
        end if;
        insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_date)
        values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas, v_local_date);
      end if;
    end if;
  else
    -- Wellness: uno por día (día local del jugador, no UTC).
    if exists (
      select 1 from public.wellness
      where player_id = p_player_id and club_id = v_link.club_id
        and ((submitted_at at time zone 'UTC') - make_interval(mins => v_tz))::date = v_local_date
    ) then
      return jsonb_build_object('ok', true, 'already', true);
    end if;

    if (p_payload->>'scale') = '7' then
      v_hooper := coalesce((p_payload->>'sleepQ')::int,4) + coalesce((p_payload->>'fatigue')::int,4)
                + coalesce((p_payload->>'stress')::int,4) + coalesce((p_payload->>'soreness')::int,4);
      -- piso en 1: wellness tiene CHECK (readiness between 1 and 10) y la
      -- fórmula da 0 con Hooper >= 27, así que el jugador que peor está era
      -- justo el que no podía enviar el check-in.
      v_read := greatest(1, round(10 - (v_hooper - 4) / 24.0 * 10)::int);
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
    insert into public.notifications (user_id, club_id, team_id, type, title, body, link)
    select pr.id, v_link.club_id, v_team, 'wellness_alert',
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
end; $function$
;


-- Comprobación: debe decir APLICADO.
select case when pg_get_functiondef(p.oid) like '%greatest(1, round(10 - (v_hooper%'
            then 'APLICADO ✓' else 'sigue pendiente' end as estado
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_survey';
