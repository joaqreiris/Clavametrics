-- 083_session_rpe_status_team_scope.sql
-- session_rpe_status listaba el roster del club entero (no escopeaba por la
-- categoría de la sesión). Fix: derivar club_id + team_id de la sesión y filtrar
-- jugadores por team_id, igual que wellness_status. DROP+CREATE por si cambia la firma.

drop function if exists public.session_rpe_status(uuid);

create function public.session_rpe_status(p_session_id uuid)
 returns table(player_id uuid, player_name text, responded boolean, rpe numeric)
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_club uuid;
  v_team uuid;
begin
  select club_id, team_id into v_club, v_team
  from public.training_sessions
  where id = p_session_id;

  return query
    select q.player_id, q.player_name, q.responded, q.rpe
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (r.id is not null) as responded,
        r.rpe as rpe,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.rpe r
        on r.player_id = p.id and r.session_id = p_session_id
      where p.club_id = v_club
        and p.status <> 'inactive'
        and (v_team is null or p.team_id = v_team)
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end; $function$;

grant execute on function public.session_rpe_status(uuid) to authenticated;
