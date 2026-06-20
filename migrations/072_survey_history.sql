-- migrations/072_survey_history.sql
-- Read-only RPC para el survey público del jugador: devuelve sus últimos 7 días
-- para que survey.html muestre la vista "últimos 7 días / readiness" al enviar.
-- SECURITY DEFINER + validación de token = seguro para la key anon/publishable.

create or replace function public.get_survey_history(p_token text, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_club  uuid;
  v_hist  jsonb;
begin
  -- Validá el token IGUAL que get_survey_players (mirrorá su WHERE si difiere).
  select scope, club_id
    into v_scope, v_club
  from share_links
  where token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_scope is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- El jugador tiene que pertenecer a este club (el player_id viene de la lista del token).
  if not exists (select 1 from players where id = p_player_id and club_id = v_club) then
    return jsonb_build_object('error', 'player_not_in_scope');
  end if;

  if v_scope = 'rpe' then
    select coalesce(jsonb_agg(
             jsonb_build_object('d', created_at::date, 'rpe', rpe,
                                'duration', duration, 'load', load)
             order by created_at), '[]'::jsonb)
      into v_hist
    from rpe
    where player_id = p_player_id and club_id = v_club
      and created_at >= now() - interval '7 days';
  else
    select coalesce(jsonb_agg(
             jsonb_build_object('d', submitted_at::date, 'readiness', readiness,
                                'sleep_quality', sleep_quality, 'mood', mood,
                                'fatigue', fatigue, 'stress', stress, 'soreness', soreness)
             order by submitted_at), '[]'::jsonb)
      into v_hist
    from wellness
    where player_id = p_player_id and club_id = v_club
      and submitted_at >= now() - interval '7 days';
  end if;

  return jsonb_build_object('scope', v_scope, 'history', coalesce(v_hist, '[]'::jsonb));
end;
$$;

grant execute on function public.get_survey_history(text, uuid) to anon, authenticated;
