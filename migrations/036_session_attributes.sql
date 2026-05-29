-- ============================================================
-- Session attributes: JSONB extensible en training_sessions
-- ============================================================

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS session_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_training_sessions_attributes
  ON training_sessions USING gin (session_attributes);

-- Claves convencionales esperadas (convención, no constraint):
--   rival       text  — nombre del equipo rival (partidos)
--   md_code     text  — código de matchday relativo, ej. "MD-1", "MD+2"
--   competition text  — nombre de la competición, ej. "Liga", "Copa"
--   venue       text  — localía: "home" | "away"
