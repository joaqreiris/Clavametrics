-- Migration 187: pedir un jugador prestado a otra categoría, con aprobación del que lo tiene.
--
-- La migración 185 dejó la llamada directa: el staff del equipo que llama sube al jugador y
-- listo. Funciona cuando el que llama TAMBIÉN tiene la categoría de origen entre las suyas
-- (el caso de MOI, donde casi todo el cuerpo técnico está en los tres equipos). Faltaban dos
-- casos:
--   1. El que solo tiene el primer equipo no veía a nadie a quien llamar — el picker le salía
--      vacío y la pantalla le decía "pedile acceso a un admin". Un callejón sin salida.
--   2. Clubes donde ceder un jugador es decisión del DT que lo tiene, no del que lo quiere.
--
-- Ahora la llamada tiene estado. 'approved' es lo de siempre (llamada directa, sin cambios para
-- quien ya podía). 'pending' es un pedido: queda registrado, el equipo de origen lo ve y decide,
-- y el jugador NO entra a ningún roster hasta que alguien diga que sí. Conviven a propósito:
-- el DT que decide a las 9 para el entrenamiento de las 10 no puede quedar esperando una
-- aprobación, y quien ya tenía acceso a las dos categorías sigue resolviéndolo solo.
--
-- Quién decide: el entrenador de la categoría del jugador (role/club_role = 'coach', el mismo
-- criterio estricto que usa player_teams_headcoach_write: DT, no ayudante ni preparador) o
-- quien tiene acceso pleno de planificación (admin/owner/dirección). Que el físio o el utilero
-- puedan ceder un jugador del plantel no es lo que el club espera.
--
-- Efecto lateral útil: la aprobación la hace alguien que SÍ ve al jugador, así que el marcado de
-- disponibilidad —el que hace que el equipo de origen lo vea como "entrena con otro equipo"— lo
-- escribe quien tiene permiso, y deja de quedar a medias como pasaba con el pedido a ciegas.
--
-- Idempotente: safe to re-run.

alter table public.player_call_ups
  add column if not exists status        text not null default 'approved',
  add column if not exists decided_by    uuid references public.profiles(id) on delete set null,
  add column if not exists decided_at    timestamptz,
  add column if not exists decision_note text;

do $$ begin
  alter table public.player_call_ups
    add constraint player_call_ups_status_check check (status in ('pending','approved','rejected'));
exception when duplicate_object then null; end $$;

comment on column public.player_call_ups.status is
  'approved = el jugador está llamado (llamada directa o pedido aceptado). pending = pedido a la espera del equipo de origen; NO entra a ningún roster. rejected = lo negaron.';

-- La consulta caliente sigue siendo "los llamados APROBADOS de este equipo en este rango":
-- el índice principal la cubre y el estado filtra poco, pero los pendientes se piden aparte
-- (bandeja del equipo de origen) y ahí el filtro por estado es el que manda.
create index if not exists player_call_ups_pending_idx
  on public.player_call_ups (club_id, date) where status = 'pending';

-- ── Quién puede aceptar o negar un pedido sobre ESTE jugador ────────────────────────────────
-- Dirección/admin siempre. Si no, hay que ser el DT de alguna de las categorías del jugador:
-- my_player_ids() ya resuelve "los jugadores de mis equipos" (y es SECURITY DEFINER, así que
-- no re-dispara RLS), y el rol se mira aparte.
create or replace function public.can_decide_call_up(p_player uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select public.has_full_planning_access()
      or (
        p_player in (select public.my_player_ids())
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid()
            and (lower(coalesce(pr.role,'')) = 'coach' or lower(coalesce(pr.club_role,'')) = 'coach')
        )
      );
$function$;

-- ── INSERT ──────────────────────────────────────────────────────────────────────────────────
-- Las funciones sin argumentos van envueltas en (select …) — si no, Postgres las evalúa UNA VEZ
-- POR FILA en vez de una por consulta. Es el mismo arreglo de las migraciones 182/183 de RLS.
-- Para crear cualquier fila hay que ser del equipo que llama (o dirección) y el equipo tiene que
-- ser de tu club. La novedad es la última condición: nacer 'approved' —saltarse la aprobación—
-- solo se puede si el jugador YA es tuyo (lo ves por my_player_ids) o tenés acceso pleno.
-- Cualquier otro caso nace 'pending' y espera.
drop policy if exists player_call_ups_insert on public.player_call_ups;
create policy player_call_ups_insert on public.player_call_ups
  for insert to authenticated
  with check (
    club_id = (select public.get_user_club_id())
    and ((select public.has_full_planning_access()) or team_id in (select public.my_team_ids()))
    and exists (select 1 from public.teams t where t.id = team_id and t.club_id = (select public.get_user_club_id()))
    and status in ('pending','approved')
    and (
      status = 'pending'
      or (select public.has_full_planning_access())
      or player_id in (select public.my_player_ids())
    )
  );

-- ── UPDATE = la decisión ────────────────────────────────────────────────────────────────────
-- Un UPDATE sobre esta tabla es aceptar o negar un pedido, nada más. Por eso lo puede hacer
-- únicamente quien decide sobre ese jugador, y el resultado solo puede ser aprobado o negado
-- (no se puede devolver una fila a 'pending' para borrar el rastro de una decisión).
-- can_decide_call_up(player_id) SÍ se evalúa por fila: depende del jugador, no se puede envolver
-- en un (select …) como el resto. No es problema acá — un UPDATE toca los días de un pedido,
-- no la tabla entera — pero no hay que copiar este patrón a una policy de SELECT.
drop policy if exists player_call_ups_update on public.player_call_ups;
create policy player_call_ups_update on public.player_call_ups
  for update to authenticated
  using (club_id = (select public.get_user_club_id()) and public.can_decide_call_up(player_id))
  with check (
    club_id = (select public.get_user_club_id())
    and public.can_decide_call_up(player_id)
    and status in ('approved','rejected')
  );

-- ── DELETE ──────────────────────────────────────────────────────────────────────────────────
-- Dos vías: el equipo que llamó suelta al jugador o cancela su pedido; y el que decide también
-- puede echar atrás lo que aprobó (si el filial se arrepiente, no tiene que ir a pedirle el
-- favor al otro cuerpo técnico).
drop policy if exists player_call_ups_delete on public.player_call_ups;
create policy player_call_ups_delete on public.player_call_ups
  for delete to authenticated
  using (
    club_id = (select public.get_user_club_id())
    and (
      (select public.has_full_planning_access())
      or team_id in (select public.my_team_ids())
      or public.can_decide_call_up(player_id)
    )
  );

-- ── Candidatos para el picker ───────────────────────────────────────────────────────────────
-- Para PEDIR un jugador hay que poder nombrarlo, y la RLS de players no deja ver los de otras
-- categorías (con razón: ahí cuelgan ficha, lesiones y evaluaciones). Esta función devuelve lo
-- mínimo para elegir a alguien de una lista —nombre, dorsal, puesto y categoría— y nada más:
-- ni fecha de nacimiento, ni estado clínico, ni contrato. `can_call` dice si ese jugador se
-- puede llamar directo o hay que pedirlo, para que la pantalla lo diga antes de apretar.
-- SECURITY DEFINER acotado: exige ser del club y tener el equipo que llama entre los propios.
create or replace function public.call_up_candidates(p_team uuid)
 -- «position» es palabra reservada en la lista de RETURNS TABLE: va entrecomillada para que el
 -- cliente siga recibiendo el campo con el mismo nombre que en players.
 returns table(id uuid, first_name text, last_name text, number integer, "position" text,
               team_id uuid, team_name text, can_call boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select distinct on (p.id)
         p.id, p.first_name, p.last_name, p.number, p.position,
         t.id as team_id, t.name as team_name,
         (p.id in (select public.my_player_ids())) as can_call
  from public.players p
  join public.player_teams pt on pt.player_id = p.id
  join public.teams t on t.id = pt.team_id
  where p.club_id = public.get_user_club_id()
    and p.archived_at is null
    and coalesce(p.status,'') <> 'inactive'
    and pt.team_id <> p_team
    -- Ya es de este plantel por otra membresía → no hay nada que llamar.
    and not exists (select 1 from public.player_teams x where x.player_id = p.id and x.team_id = p_team)
    -- El que pregunta tiene que ser del equipo que llama (o dirección). Sin esto, cualquiera
    -- del club listaría a todos los jugadores de todas las categorías.
    and (public.has_full_planning_access() or p_team in (select public.my_team_ids()))
    and exists (select 1 from public.teams t2 where t2.id = p_team and t2.club_id = public.get_user_club_id())
  -- Con varias membresías, la primaria es la que se muestra como "su categoría".
  order by p.id, pt.is_primary desc, t.name;
$function$;

revoke all on function public.call_up_candidates(uuid) from public;
grant execute on function public.call_up_candidates(uuid) to authenticated;

-- ── El RPE solo cuenta a los llamados APROBADOS ─────────────────────────────────────────────
-- session_rpe_status() empezó a mirar player_call_ups en la migración 186, cuando todas las
-- filas eran llamadas firmes. Con los pedidos, una fila 'pending' NO es un jugador que entrena:
-- sin este filtro se le pediría el RPE de una sesión a la que quizá no va.
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
                 -- Llamado de otra categoría PARA ESE DÍA (migración 185), ya aprobado (187).
                 or exists (select 1 from public.player_call_ups cu
                            where cu.player_id = p.id and cu.team_id = v_team and cu.date = v_date
                              and cu.status = 'approved'))
          )
        )
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end;
$function$;
