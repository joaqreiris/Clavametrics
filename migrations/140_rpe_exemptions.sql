-- 140 · RPE: excusar a un jugador de una sesión (y cargarle el RPE a mano)
--
-- En Session RPE, un jugador que no hizo la sesión (solo gimnasio, trabajo
-- diferenciado, permiso) quedaba para siempre en «Pending» y entraba en el
-- «Remind missing». No había forma de sacarlo sin inventarle un RPE.
--
--   kind='not_required' → no le correspondía: sale del total de la sesión.
--   kind='ignored'      → sí le correspondía, pero no se insiste: sigue
--                         contando como no respondido (queda el incumplimiento).
--
-- Es por sesión, no por día: en un día de gym + campo se puede excusar una sola.
-- rpe.entered_by marca el RPE que cargó el staff de palabra (NULL = lo mandó
-- el jugador), y habilita corregirlo o borrarlo después.

-- ── 1 · Exenciones ────────────────────────────────────────────────────────
create table if not exists public.rpe_exemptions (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id  uuid not null references public.players(id)           on delete cascade,
  club_id    uuid not null references public.clubs(id)             on delete cascade,
  kind       text not null check (kind in ('not_required','ignored')),
  -- solo para not_required: gym_only | differentiated | permission | rehab | other
  reason     text,
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

create index if not exists rpe_exemptions_club_idx on public.rpe_exemptions (club_id);

alter table public.rpe_exemptions enable row level security;

-- Mismo alcance que session_participants: el club propio, y dentro de él o bien
-- acceso pleno de planificación o bien la sesión es de un equipo del staff.
drop policy if exists rpe_exemptions_scoped on public.rpe_exemptions;
create policy rpe_exemptions_scoped on public.rpe_exemptions
  for all
  using (
    club_id = public.get_user_club_id()
    and (
      public.has_full_planning_access()
      or exists (
        select 1 from public.training_sessions ts
        where ts.id = rpe_exemptions.session_id
          and (ts.team_id is null or ts.team_id in (select public.my_team_ids()))
      )
    )
  )
  with check (
    club_id = public.get_user_club_id()
    and (
      public.has_full_planning_access()
      or exists (
        select 1 from public.training_sessions ts
        where ts.id = rpe_exemptions.session_id
          and (ts.team_id is null or ts.team_id in (select public.my_team_ids()))
      )
    )
  );

drop policy if exists rpe_exemptions_super_all on public.rpe_exemptions;
create policy rpe_exemptions_super_all on public.rpe_exemptions
  for all using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on public.rpe_exemptions from public, anon;
grant select, insert, update, delete on public.rpe_exemptions to authenticated;
grant all on public.rpe_exemptions to service_role;

-- ── 2 · RPE cargado por el staff ──────────────────────────────────────────
alter table public.rpe
  add column if not exists entered_by uuid references public.profiles(id) on delete set null;

comment on column public.rpe.entered_by is
  'Staff que cargó este RPE a mano en Session RPE. NULL = lo mandó el jugador.';

-- La tabla solo tenía select/insert: sin update ni delete no se podía corregir
-- un valor mal tipeado. Mismo alcance que el resto (jugadores accesibles).
drop policy if exists rpe_staff_manage on public.rpe;
create policy rpe_staff_manage on public.rpe
  for update
  using (public.is_super_admin() or (player_id in (select public.my_player_ids())))
  with check (public.is_super_admin() or (player_id in (select public.my_player_ids())));

drop policy if exists rpe_staff_delete on public.rpe;
create policy rpe_staff_delete on public.rpe
  for delete
  using (public.is_super_admin() or (player_id in (select public.my_player_ids())));

-- ── 3 · El board de la sesión devuelve la marca ───────────────────────────
-- Cambia la firma (cuatro columnas nuevas) → drop + create. El cuerpo es el de
-- la 137 más el left join a rpe_exemptions; el filtrado lo hace la pantalla,
-- que necesita listar los excusados aparte para poder deshacerlos.
drop function if exists public.session_rpe_status(uuid);

create function public.session_rpe_status(p_session_id uuid)
returns table(
  player_id uuid, player_name text, responded boolean, rpe numeric, note text,
  body_areas text[], duration integer, load numeric, submitted_at timestamptz,
  av_status text, exempt_kind text, exempt_reason text, exempt_note text, entered_by uuid
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
                            where pt.player_id = p.id and pt.team_id = v_team))
          )
        )
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end;
$function$;

-- El drop se llevó los permisos de la 134: se rehacen igual.
revoke execute on function public.session_rpe_status(uuid) from public, anon;
grant execute on function public.session_rpe_status(uuid) to authenticated, service_role;
