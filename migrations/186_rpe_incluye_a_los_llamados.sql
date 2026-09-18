-- Migration 186: el jugador LLAMADO de otra categoría también tiene que responder el RPE.
--
-- session_rpe_status() decide a quién se le pide el RPE de una sesión. Con convocatoria armada
-- (session_participants) toma a los anotados, sean del equipo que sean — ahí el llamado ya entra.
-- El problema es el caso habitual: SIN convocatoria armada ("entrenan todos los disponibles"),
-- la función cae al roster por player_teams, y el llamado no tiene membresía a propósito
-- (migración 185). Resultado: el chico entrena con el primer equipo, aparece en Daily Planning,
-- y su sesión no le pide RPE — la carga de ese entrenamiento se pierde justo para el jugador
-- que más control necesita, porque está haciendo una carga que no es la de su categoría.
--
-- Cambio quirúrgico: se agrega UNA condición a la rama "sin convocatoria". Todo lo demás
-- (exenciones, minutos de partido, día libre, orden) queda igual.
--
-- Verificación esperada:
--   * jugador del plantel                  -> igual que antes (entra por player_teams).
--   * llamado ese día, sin convocatoria    -> ahora aparece en el board del RPE.
--   * llamado OTRO día                     -> no aparece (la llamada es por fecha).
--   * llamado marcado enfermo/día libre    -> sigue excluido (el not exists de arriba manda).

CREATE OR REPLACE FUNCTION public.session_rpe_status(p_session_id uuid)
 RETURNS TABLE(player_id uuid, player_name text, responded boolean, rpe numeric, note text, body_areas text[], duration integer, load numeric, submitted_at timestamp with time zone, av_status text, exempt_kind text, exempt_reason text, exempt_note text, entered_by uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid;
  v_team uuid;
  v_date date;
  v_dur  integer;
  v_type text;
begin
  select ts.club_id, ts.team_id, ts.session_date, ts.duration, ts.session_type
    into v_club, v_team, v_date, v_dur, v_type
  from public.training_sessions ts
  where ts.id = p_session_id;

  if v_club is null then return; end if;
  perform public.assert_my_club(v_club);

  return query
    select q.player_id, q.player_name, q.responded, q.rpe,
           q.note, q.body_areas, q.duration, q.load, q.submitted_at, q.av_status,
           q.exempt_kind, q.exempt_reason, q.exempt_note, q.entered_by
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (r.id is not null) as responded,
        r.rpe        as rpe,
        r.note       as note,
        r.body_areas as body_areas,
        case when v_type = 'match'
             then coalesce(nullif(am.minutes, 0), v_dur, r.duration)
             else coalesce(v_dur, r.duration) end           as duration,
        r.rpe * case when v_type = 'match'
                     then coalesce(nullif(am.minutes, 0), v_dur, r.duration)
                     else coalesce(v_dur, r.duration) end   as load,
        r.created_at as submitted_at,
        am.status    as av_status,
        x.kind       as exempt_kind,
        x.reason     as exempt_reason,
        x.note       as exempt_note,
        r.entered_by as entered_by,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.rpe r
        on r.player_id = p.id and r.session_id = p_session_id
      left join public.rpe_exemptions x
        on x.session_id = p_session_id and x.player_id = p.id
      left join lateral (
        select a2.status, a2.minutes
        from public.availability a2
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
            and (
              a.status in ('sick','unavailable','away')
              or (a.status = 'day_off'
                  and (a.team_id is null or v_team is null or a.team_id = v_team))
            )
        )
        and (
          exists (select 1 from public.session_participants sp
                  where sp.session_id = p_session_id and sp.player_id = p.id)
          or (
            not exists (select 1 from public.session_participants sp where sp.session_id = p_session_id)
            and (v_team is null
                 or p.team_id = v_team
                 or exists (select 1 from public.player_teams pt
                            where pt.player_id = p.id and pt.team_id = v_team)
                 -- Llamado de otra categoría PARA ESE DÍA (migración 185): entrena acá hoy, así
                 -- que su RPE es de esta sesión. No tiene membresía y no debe tenerla.
                 or exists (select 1 from public.player_call_ups cu
                            where cu.player_id = p.id and cu.team_id = v_team and cu.date = v_date))
          )
        )
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end;
$function$;
