-- Migración 182: segundo grupo del mismo arreglo que la 181.
--
-- Mismo criterio: envolver en (SELECT …) SOLO lo que no depende de la fila, para que Postgres lo
-- evalúe una vez por consulta en vez de una vez por fila.
--
-- Lo que NO se toca a propósito, porque sí recibe columnas de la fila:
--   · microcycle_has_my_gps(id)
--   · support_access(club_id)
--   · el EXISTS contra player_teams, que filtra por players.id
-- El EXISTS contra profiles SÍ se envuelve: mira quién sos, no la fila.
--
-- Verificado antes y después con tres usuarios de dos clubes (physio y team_manager de MOI, admin
-- de Bigúa): filas visibles idénticas en las doce tablas comprobadas, y Bigúa sigue sin ver ni una
-- fila de MOI. gps_period_reports (16.289 filas) queda en 382 ms.

ALTER POLICY "Club members can view teams"   ON public.teams USING (club_id = (SELECT get_user_club_id()));
ALTER POLICY "Club members can delete teams" ON public.teams USING (club_id = (SELECT get_user_club_id()));
ALTER POLICY "Club members can update teams" ON public.teams USING (club_id = (SELECT get_user_club_id()));
ALTER POLICY "Club members can insert teams" ON public.teams WITH CHECK (club_id = (SELECT get_user_club_id()));

ALTER POLICY gps_dashboard_layouts_plan_gate ON public.gps_dashboard_layouts
  USING ((SELECT is_super_admin()) OR (SELECT club_has_feature((SELECT get_user_club_id()), 'gps_analysis')))
  WITH CHECK ((SELECT is_super_admin()) OR (SELECT club_has_feature((SELECT get_user_club_id()), 'gps_analysis')));
ALTER POLICY "Club members read club-default layouts" ON public.gps_dashboard_layouts
  USING ((dashboard_id LIKE '%~clubdefault') AND (club_id = (SELECT get_user_club_id())));
ALTER POLICY "Users read own layouts"   ON public.gps_dashboard_layouts
  USING ((user_id = (SELECT auth.uid())) AND (club_id = (SELECT get_user_club_id())));
ALTER POLICY "Users delete own layouts" ON public.gps_dashboard_layouts
  USING ((user_id = (SELECT auth.uid())) AND (club_id = (SELECT get_user_club_id())));
ALTER POLICY "Users insert own layouts" ON public.gps_dashboard_layouts
  WITH CHECK ((user_id = (SELECT auth.uid())) AND (club_id = (SELECT get_user_club_id())));
ALTER POLICY "Users update own layouts" ON public.gps_dashboard_layouts
  USING ((user_id = (SELECT auth.uid())) AND (club_id = (SELECT get_user_club_id())))
  WITH CHECK ((user_id = (SELECT auth.uid())) AND (club_id = (SELECT get_user_club_id())));

ALTER POLICY mc_scoped_select ON public.microcycles
  USING ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access())
              OR (team_id IN (SELECT my_team_ids()))
              OR microcycle_has_my_gps(id)));
ALTER POLICY mc_scoped_cud ON public.microcycles
  USING ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))))
  WITH CHECK ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))));

ALTER POLICY ce_scoped_select ON public.calendar_events
  USING ((club_id = (SELECT profiles.club_id FROM profiles WHERE profiles.id = (SELECT auth.uid())))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))));
ALTER POLICY ce_scoped_cud ON public.calendar_events
  USING ((club_id = (SELECT profiles.club_id FROM profiles WHERE profiles.id = (SELECT auth.uid())))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))))
  WITH CHECK ((club_id = (SELECT profiles.club_id FROM profiles WHERE profiles.id = (SELECT auth.uid())))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))));

ALTER POLICY players_scoped_select ON public.players
  USING ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access())
              OR (SELECT EXISTS (SELECT 1 FROM profiles p
                    WHERE p.id = (SELECT auth.uid())
                      AND ((p.role = ANY (ARRAY['admin','owner'])) OR (p.club_role = ANY (ARRAY['admin','owner'])))))
              OR (team_id IN (SELECT my_team_ids()))
              OR (EXISTS (SELECT 1 FROM player_teams pt
                    WHERE pt.player_id = players.id AND pt.team_id IN (SELECT my_team_ids())))));
