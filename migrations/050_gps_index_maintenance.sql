-- ============================================================
-- 050 — GPS · mantenimiento de índices
-- Aditivo + limpieza de duplicados exactos. Sin pérdida de datos.
-- ============================================================

-- (1) Falta índice de microciclo: las cards del dashboard de microciclo
--     filtran training_sessions por (club_id, microcycle_id) y hoy van sin índice.
CREATE INDEX IF NOT EXISTS idx_training_sessions_club_microcycle
  ON training_sessions (club_id, microcycle_id);

-- (2) Índices duplicados EXACTOS (cada uno ya cubierto por otro idéntico) → se sacan.
--     idx_gps_reports_player_session == unique gps_reports_player_id_session_id_key (player_id, session_id)
DROP INDEX IF EXISTS idx_gps_reports_player_session;

--     training_sessions_date_idx (club_id, session_date DESC) == idx_training_sessions_club_date (club_id, session_date)
--     (Postgres escanea el índice en cualquier dirección, no necesita el DESC aparte)
DROP INDEX IF EXISTS training_sessions_date_idx;
