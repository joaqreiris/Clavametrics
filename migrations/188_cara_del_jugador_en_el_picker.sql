-- Migration 188: call_up_candidates() devuelve también la foto del jugador.
--
-- "A veces los entrenadores no conocen bien al jugador": el picker de llamadas lista gente de
-- OTRAS categorías, que es justamente a la que no le ven la cara. Un nombre y un dorsal no
-- alcanzan para decidir a quién subís.
--
-- Se devuelve `photo_url` tal como está guardado (una ruta del bucket privado player-photos),
-- no una URL usable: la firma la hace el cliente con cmSignedUrls, igual que en el resto de la
-- app. Y no abre nada nuevo — la policy de storage de ese bucket ya es POR CLUB
-- (player_photos_select), así que cualquiera del club podía firmar esa foto; lo que faltaba era
-- saber qué ruta pedir, porque la RLS de players tapa la fila entera.
--
-- Idempotente: reemplaza la función. Único cambio: la columna nueva al final del RETURNS TABLE.

CREATE OR REPLACE FUNCTION public.call_up_candidates(p_team uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text, number integer, "position" text,
               team_id uuid, team_name text, can_call boolean, photo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (p.id)
         p.id, p.first_name, p.last_name, p.number, p.position,
         t.id as team_id, t.name as team_name,
         (p.id in (select public.my_player_ids())) as can_call,
         p.photo_url
  from public.players p
  join public.player_teams pt on pt.player_id = p.id
  join public.teams t on t.id = pt.team_id
  where p.club_id = public.get_user_club_id()
    and p.archived_at is null
    and coalesce(p.status,'') <> 'inactive'
    and pt.team_id <> p_team
    -- Ya es de este plantel por otra membresía → no hay nada que llamar.
    and not exists (select 1 from public.player_teams x where x.player_id = p.id and x.team_id = p_team)
    -- El que pregunta tiene que ser del equipo que llama (o dirección).
    and (public.has_full_planning_access() or p_team in (select public.my_team_ids()))
    and exists (select 1 from public.teams t2 where t2.id = p_team and t2.club_id = public.get_user_club_id())
  -- Con varias membresías, la primaria es la que se muestra como "su categoría".
  order by p.id, pt.is_primary desc, t.name;
$function$;

revoke all on function public.call_up_candidates(uuid) from public;
grant execute on function public.call_up_candidates(uuid) to authenticated;
