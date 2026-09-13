-- El día libre no descuenta del parte diario, y el cumplimiento de wellness lo paga.
--
-- `wellness_status` ya saca del denominador a quien ese día está enfermo, no disponible o con
-- la selección, pero NO al que está de día libre. Es la asimetría con RPE, que sí lo descuenta
-- (`session_rpe_status`). El efecto es que un día libre con tres partes cargados cuenta como
-- tres de veinticuatro: el número deja de medir "¿responden mis jugadores?" y pasa a medir
-- "¿cuántos días libres tuvo el equipo?".
--
-- El día libre vive en TRES lados y los tres cuentan — mirar sólo `availability`, como hace el
-- RPE, deja afuera el caso más común:
--
--   · availability.status = 'day_off'  — el día libre individual, o el parcial que Calendar
--     baja a la grilla. Relativo al equipo: un day off cargado para otro equipo no aplica.
--   · calendar_events.type = 'day_off' — el día libre de EQUIPO ENTERO (player_ids vacío) o
--     el parcial (player_ids con los jugadores afectados). Acá no deja fila en availability
--     cuando es de equipo entero, que es justamente el caso que más infla el denominador.
--   · training_sessions.session_type = 'day_off' — la otra forma de anotar el día libre de
--     equipo, la que usa el planificador.
--
-- No se borra al jugador del resultado: se devuelve marcado con `day_off`. Si se lo sacara,
-- un día libre de equipo entero dejaría la pantalla de Wellness y el Hub VACÍOS, sin decir por
-- qué. Con la bandera, cada pantalla decide.
--
-- La regla que aplican los consumidores, y conviene que sea una sola: el jugador de día libre
-- sale del cálculo, SALVO que haya cargado igual — ahí cuenta como respondido, arriba y abajo.
-- Así cargar el parte en un día libre nunca puede empeorar el número (que sería absurdo), y el
-- porcentaje tampoco puede pasar de 100%, que es lo que pasaría si sumara sólo al numerador.
--
-- DROP + CREATE porque cambia el RETURNS TABLE. Se rehacen los grants que tenía.

drop function if exists public.wellness_status(uuid, uuid, date, integer);

create function public.wellness_status(
  p_club_id uuid,
  p_team_id uuid default null,
  p_date date default current_date,
  p_tz_offset integer default 0
)
returns table(
  player_id uuid, player_name text, responded boolean, day_off boolean,
  readiness numeric, hooper_index numeric, sleep_quality numeric, fatigue numeric,
  stress numeric, soreness numeric, mood numeric, note text,
  body_areas text[], submitted_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
-- p_tz_offset = client's Date.getTimezoneOffset() (minutes); lets "today" follow the club's
-- local calendar day instead of UTC, so the board resets at local midnight (not UTC midnight).
declare v_date date := coalesce(p_date, current_date);
begin
  return query
    select q.player_id, q.player_name, q.responded, q.day_off, q.readiness, q.hooper_index,
           q.sleep_quality, q.fatigue, q.stress, q.soreness, q.mood,
           q.note, q.body_areas, q.submitted_at
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (w.id is not null) as responded,
        -- Día libre: individual (availability), o de equipo / parcial (calendar_events,
        -- training_sessions). El de equipo se aplica sólo al equipo del jugador.
        (
          exists (
            select 1 from public.availability a
            where a.player_id = p.id::text and a.date = v_date
              and a.status = 'day_off'
              and (a.team_id is null or p.team_id is null or a.team_id = p.team_id)
          )
          or exists (
            select 1 from public.calendar_events ce
            where ce.club_id = p_club_id and ce.date = v_date and ce.type = 'day_off'
              and (ce.team_id is null or p.team_id is null or ce.team_id = p.team_id)
              and (coalesce(array_length(ce.player_ids, 1), 0) = 0 or p.id = any(ce.player_ids))
          )
          or exists (
            select 1 from public.training_sessions ts
            where ts.club_id = p_club_id and ts.session_date = v_date
              and ts.session_type = 'day_off' and ts.is_historical = false
              and (ts.team_id is null or p.team_id is null or ts.team_id = p.team_id)
          )
        ) as day_off,
        w.readiness      as readiness,
        w.hooper_index   as hooper_index,
        w.sleep_quality  as sleep_quality,
        w.fatigue        as fatigue,
        w.stress         as stress,
        w.soreness       as soreness,
        w.mood           as mood,
        w.note           as note,
        w.body_areas     as body_areas,
        w.submitted_at   as submitted_at,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.wellness w
        on w.player_id = p.id
       and ((w.submitted_at at time zone 'UTC') - make_interval(mins => p_tz_offset))::date = v_date
      where p.club_id = p_club_id
        and p.archived_at is null
        and p.id in (select public.my_player_ids())
        and (p_team_id is null or p.team_id = p_team_id)
        -- Not expected to check in that day: sick, unavailable, or national-team (away).
        and not exists (
          select 1 from public.availability a
          where a.player_id = p.id::text and a.date = v_date
            and a.status in ('sick','unavailable','away')
        )
      order by p.id, w.submitted_at desc nulls last
    ) q
    -- Pendientes reales primero, después los de día libre, al final los que ya cargaron.
    order by q.responded, q.day_off, q.ln nulls last, q.fn nulls last;
end; $function$;

grant execute on function public.wellness_status(uuid, uuid, date, integer) to anon, authenticated, service_role;
