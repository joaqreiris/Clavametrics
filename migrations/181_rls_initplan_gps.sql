-- Migración 181: que las reglas de seguridad se evalúen UNA VEZ y no por fila.
--
-- Las policies llamaban funciones sueltas —get_user_club_id(), is_super_admin(),
-- has_full_planning_access(), club_has_feature()— y Postgres las evaluaba UNA VEZ POR FILA.
-- Ninguna depende de la fila: devuelven lo mismo para toda la consulta. Envueltas en (SELECT …)
-- pasan a ser InitPlan y se calculan una sola vez.
--
-- Medido sobre gps_reports (4.537 filas, usuario real, club MOI):
--     antes   6.283 ms
--     después   136 ms
-- La misma consulta con el rol de servicio (que saltea la RLS) tardaba 24 ms — por eso medir con
-- el rol de servicio escondía el problema entero.
--
-- Lo que NO se toca a propósito: support_access(club_id) y session_in_my_teams(session_id), que sí
-- reciben columnas de la fila. Envolverlas cambiaría el significado.
--
-- Verificado antes y después, con tres usuarios de dos clubes (physio y team_manager de MOI, admin
-- de Bigúa): las filas visibles por tabla son IDÉNTICAS, y Bigúa sigue sin ver ni una fila de MOI.

ALTER POLICY gps_reports_plan_gate ON public.gps_reports
  USING ((SELECT is_super_admin()) OR (SELECT club_has_feature((SELECT get_user_club_id()), 'gps_analysis')));

ALTER POLICY gps_period_reports_club_all ON public.gps_period_reports
  USING (club_id = (SELECT get_user_club_id()))
  WITH CHECK (club_id = (SELECT get_user_club_id()));

ALTER POLICY gps_report_metrics_plan_gate ON public.gps_report_metrics
  USING ((SELECT is_super_admin()) OR (SELECT club_has_feature((SELECT get_user_club_id()), 'gps_analysis')))
  WITH CHECK ((SELECT is_super_admin()) OR (SELECT club_has_feature((SELECT get_user_club_id()), 'gps_analysis')));
ALTER POLICY gps_report_metrics_del ON public.gps_report_metrics
  USING ((club_id = (SELECT get_user_club_id())) OR support_access(club_id));
ALTER POLICY gps_report_metrics_ins ON public.gps_report_metrics
  WITH CHECK ((club_id = (SELECT get_user_club_id())) OR support_access(club_id));
ALTER POLICY gps_report_metrics_upd ON public.gps_report_metrics
  USING ((club_id = (SELECT get_user_club_id())) OR support_access(club_id));

ALTER POLICY ts_scoped_select ON public.training_sessions
  USING ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access())
              OR (team_id IN (SELECT my_team_ids()))
              OR (id IN (SELECT my_gps_session_ids()))));
ALTER POLICY ts_scoped_cud ON public.training_sessions
  USING ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))))
  WITH CHECK ((club_id = (SELECT get_user_club_id()))
         AND ((SELECT has_full_planning_access()) OR (team_id IN (SELECT my_team_ids()))));

ALTER POLICY rpe_scoped_select ON public.rpe
  USING (support_access(club_id)
         OR ((club_id = (SELECT get_user_club_id())) AND (SELECT has_full_planning_access()))
         OR (player_id IN (SELECT my_player_ids())));
