-- Migration 117: my_player_ids() resuelve equipos contra player_teams (M:N) en vez de players.team_id.
--
-- Motivación: hoy la rama de equipos de my_player_ids() filtra por p.team_id in (my_team_ids()),
-- es decir SOLO el equipo PRIMARIO del jugador (players.team_id). Un jugador que juega en varios
-- equipos solo es visible para el staff de su equipo primario. Cambiamos esa condición para
-- resolver contra player_teams (todos los equipos del jugador), de modo que el staff de CUALQUIER
-- equipo del jugador lo vea.
--
-- Cambio quirúrgico: se reemplaza SOLO la última condición del OR. Se mantienen intactas la rama
-- admin/owner y is_super_admin (esa rama ya devuelve todos los players del club).
--
-- Alcance de visibilidad (tablas cuyas RLS usan my_player_ids()): availability, evaluations,
-- gps_reports, gps_report_metrics, injuries, rehab_plans, rpe, treatments, wellness, y la función
-- wellness_status(). NO toca la RLS de la tabla players (esa usa my_team_ids() sobre players.team_id;
-- si se quiere ampliar la ficha del jugador al staff secundario, es un cambio aparte).
--
-- Sin recursión: my_player_ids() es SECURITY DEFINER (su cuerpo no evalúa RLS); además las policies
-- de player_teams solo llaman get_user_club_id()/has_full_planning_access()/is_super_admin(), que no
-- consultan players/player_teams/injuries. Performance: usa el índice player_teams_player_idx (player_id).
--
-- Verificación esperada:
--   * jugador con 1 solo equipo (primario)      -> mismo resultado que antes (player_teams tiene esa fila).
--   * jugador en primario + secundario          -> ahora lo ve el staff de AMBOS equipos.
--   * admin/owner                               -> sin cambio (entran por la otra rama del OR).
--
-- Rollback (si hiciera falta): volver a la definición previa reemplazando el EXISTS por
--   or p.team_id in (select public.my_team_ids())

CREATE OR REPLACE FUNCTION public.my_player_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id from public.players p
  where p.club_id = (select club_id from public.profiles where id = auth.uid())
    and (
      exists (select 1 from public.profiles pr where pr.id = auth.uid()
              and (pr.role in ('admin','owner') or pr.club_role in ('admin','owner')))
      or exists (
        select 1 from public.player_teams pt
        where pt.player_id = p.id
          and pt.team_id in (select public.my_team_ids())
      )
    );
$function$;
