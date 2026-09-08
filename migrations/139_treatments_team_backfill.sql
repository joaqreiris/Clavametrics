-- 139 · Tratamientos: rellenar el team_id que falta
--
-- Los tratamientos guardados antes de que Physio tuviera selector de equipo
-- quedaron con team_id NULL, así que en un club con varias categorías el
-- historial de «First team» mostraba también los del filial y el juvenil.
-- La pantalla ya filtra por team_id; esto le da equipo a los registros viejos:
--   1) jugador con una sola membresía → esa;
--   2) jugador multi-categoría → su equipo primario (player_teams.is_primary,
--      y si no hay marcado, players.team_id).
-- Lo que no se pueda resolver queda en NULL: la pantalla lo acota por el roster.
--
-- Reversible acotando a los ids que tenían team_id NULL antes de correr esto.

update public.treatments tr
set team_id = sub.team_id
from (
  select t.id,
         coalesce(
           case when (select count(distinct pt.team_id) from public.player_teams pt
                       where pt.player_id = t.player_id) = 1
                then (select pt.team_id from public.player_teams pt
                       where pt.player_id = t.player_id limit 1)
           end,
           (select pt.team_id from public.player_teams pt
             where pt.player_id = t.player_id and pt.is_primary limit 1),
           (select p.team_id from public.players p where p.id = t.player_id)
         ) as team_id
  from public.treatments t
  where t.team_id is null
) sub
where tr.id = sub.id
  and tr.team_id is null
  and sub.team_id is not null
  -- nunca atribuir un tratamiento a un equipo de otro club
  and exists (select 1 from public.teams te where te.id = sub.team_id and te.club_id = tr.club_id);
