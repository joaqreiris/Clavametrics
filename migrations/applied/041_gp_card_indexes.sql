-- ============================================================
-- 041 — GPS Builder · índices de soporte para el resolver
-- Aditivo puro. Las queries de resolveCard leen:
--   gps_reports     filtrado por (club_id, session_id)
--   gps_report_metrics  filtrado por (club_id, metric_key)
--   training_sessions   filtrado por (club_id, microcycle_id) y
--                       (club_id, session_date) para rolling ranges
-- ============================================================

-- Acelera el filtrado de sesiones por rango de fecha (w7 / w30 / season)
CREATE INDEX IF NOT EXISTS idx_training_sessions_club_date
  ON training_sessions (club_id, session_date DESC);

-- Acelera el join gps_reports → sessions con filtro por fecha
CREATE INDEX IF NOT EXISTS idx_gps_reports_session
  ON gps_reports (session_id, player_id);

-- Acelera la lectura de métricas EAV por sesión + clave
CREATE INDEX IF NOT EXISTS idx_gps_rm_club_key_report
  ON gps_report_metrics (club_id, metric_key, report_id);
