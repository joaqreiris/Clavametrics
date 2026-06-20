-- migrations/074_hooper_index.sql
-- Pasa wellness al Hooper Index validado (Hooper & Mackinnon, 1995):
-- 4 ítems (sueño, fatiga, estrés, dolor muscular), cada uno 1–7 donde 7 = peor,
-- sumados → hooper_index (rango 4–28, más alto = peor / más riesgo). Mood queda fuera.
--
-- Regla de cutover:
--   * hooper_index es la métrica canónica de acá en adelante.
--   * Fila "era Hooper" = hooper_index NOT NULL. En esas filas las columnas de ítems
--     (sleep_quality, fatigue, stress, soreness) guardan 1–7 con 7 = peor.
--   * Filas legacy (hooper_index NULL) conservan los 1–10 viejos + readiness casero.
--   * readiness se sigue poblando (derivado del Hooper) para no romper consumidores
--     que todavía lo leen, hasta migrarlos a hooper_index.
--   * El form nuevo manda scale:"7". Sin ese flag, el camino legacy queda intacto,
--     así que esta migración es segura de correr ANTES de tocar el front.

-- 1) Columna
alter table public.wellness
  add column if not exists hooper_index numeric;

comment on column public.wellness.hooper_index is
  'Hooper Index (Hooper & Mackinnon 1995): suma de sueño+fatiga+estrés+dolor, cada uno 1–7 (7=peor). Rango 4–28, más alto=peor. NULL = fila legacy pre-Hooper.';

-- 2) submit_survey: calcula hooper_index para el payload nuevo (scale=7); legacy intacto
CREATE OR REPLACE FUNCTION public.submit_survey(p_token text, p_player_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      select duration, session_date into v_dur, v_sdate from public.training_sessions where id = v_link.session_id;
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_id, duration, load, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas,
              v_link.session_id, v_dur, (p_payload->>'rpe')::numeric * coalesce(v_dur, 0), coalesce(v_sdate, current_date));
    else
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas, current_date)
      returning id into v_rpe_id;
      perform public.link_rpe_to_session(v_rpe_id);
    end if;
  else
    if (p_payload->>'scale') = '7' then
      -- Hooper Index: 4 ítems en 1–7, 7 = peor, sumados (rango 4–28).
      v_hooper := coalesce((p_payload->>'sleepQ')::int,4) + coalesce((p_payload->>'fatigue')::int,4)
                + coalesce((p_payload->>'stress')::int,4) + coalesce((p_payload->>'soreness')::int,4);
      -- readiness derivado (0–10, alto = bueno) para que los consumidores viejos no rompan.
      v_read := round(10 - (v_hooper - 4) / 24.0 * 10)::int;
      insert into public.wellness (club_id, player_id, sleep_quality, mood, fatigue, stress, soreness, hooper_index, readiness, note, body_areas, submitted_at)
      values (v_link.club_id, p_player_id, (p_payload->>'sleepQ')::int, (p_payload->>'mood')::int,
              (p_payload->>'fatigue')::int, (p_payload->>'stress')::int, (p_payload->>'soreness')::int,
              v_hooper, v_read, v_note, v_areas, now());
    else
      -- Camino legacy (form viejo 1–10): sin cambios.
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

  -- ALERTA por molestia (body areas) — SIN CAMBIOS respecto al original.
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
    cross join lateral (
      select public.role_bucket(pr.role) as bucket
    ) b
    left join public.notification_settings ns
      on ns.club_id = v_link.club_id and ns.alert_type = 'discomfort' and ns.role = b.bucket
    where pr.club_id = v_link.club_id
      and coalesce(ns.enabled, b.bucket in ('medical','admin','sc','coach')) = true
      and (
        coalesce(ns.scope, case when b.bucket in ('medical','admin') then 'club' else 'team' end) = 'club'
        or ( coalesce(ns.scope, 'team') = 'team'
             and v_team is not null
             and exists (select 1 from public.member_teams mt where mt.profile_id = pr.id and mt.team_id = v_team) )
      );
  end if;

  return jsonb_build_object('ok', true);
end; $function$;

-- 3) wellness_status: expone hooper_index para la alerta del checklist
CREATE OR REPLACE FUNCTION public.wellness_status(p_club_id uuid, p_team_id uuid DEFAULT NULL::uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(player_id uuid, player_name text, responded boolean, readiness numeric, hooper_index numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
    select p.id,
           coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player'),
           (w.id is not null), w.readiness, w.hooper_index
    from public.players p
    left join public.wellness w
      on w.player_id = p.id
     and w.submitted_at::date = p_date
    where p.club_id = p_club_id
      and p.id in (select public.my_player_ids())
      and (p_team_id is null or p.team_id = p_team_id)
    order by (w.id is not null), p.last_name nulls last, p.first_name nulls last;
end; $function$;

-- 4) get_survey_history: agrega hooper_index a los ítems de wellness
CREATE OR REPLACE FUNCTION public.get_survey_history(p_token text, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_scope text; v_club uuid; v_hist jsonb;
begin
  select scope, club_id into v_scope, v_club
  from share_links
  where token = p_token and (expires_at is null or expires_at > now())
  limit 1;

  if v_scope is null then return jsonb_build_object('error','invalid_token'); end if;
  if not exists (select 1 from players where id = p_player_id and club_id = v_club) then
    return jsonb_build_object('error','player_not_in_scope');
  end if;

  if v_scope = 'rpe' then
    select coalesce(jsonb_agg(
             jsonb_build_object('d', created_at::date, 'rpe', rpe, 'duration', duration, 'load', load)
             order by created_at), '[]'::jsonb)
      into v_hist
    from rpe where player_id = p_player_id and club_id = v_club
      and created_at >= now() - interval '7 days';
  else
    select coalesce(jsonb_agg(
             jsonb_build_object('d', submitted_at::date, 'readiness', readiness,
                                'hooper_index', hooper_index,
                                'sleep_quality', sleep_quality, 'mood', mood,
                                'fatigue', fatigue, 'stress', stress, 'soreness', soreness)
             order by submitted_at), '[]'::jsonb)
      into v_hist
    from wellness where player_id = p_player_id and club_id = v_club
      and submitted_at >= now() - interval '7 days';
  end if;

  return jsonb_build_object('scope', v_scope, 'history', coalesce(v_hist, '[]'::jsonb));
end; $function$;
