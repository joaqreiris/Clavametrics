-- =============================================================
-- Migration 069: Match reports model (results + per-player stats)
-- Matches ya existen como training_sessions(session_type='match');
-- esto agrega los HECHOS del partido (marcador, rival, etc.) y las
-- estadísticas por jugador. Reemplaza el mock hardcodeado de Match Reports.
-- RLS espejo EXACTO del patrón club-scoped de gps_reports / gps_column_mappings
-- (028): club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()).
-- Idempotente. Depends on: clubs, teams, training_sessions, players.
-- =============================================================

-- ── Tabla: resultado del partido ──────────────────────────────
-- Un row por partido (opcionalmente ligado a la session GPS del match).
CREATE TABLE IF NOT EXISTS public.match_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id       uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  session_id    uuid REFERENCES public.training_sessions(id) ON DELETE SET NULL, -- link opcional a la session GPS del match
  match_date    date NOT NULL,
  competition   text,
  opponent      text,
  home_away     text CHECK (home_away IN ('home','away')),
  score_for     int,
  score_against int,
  possession    numeric,
  formation     text,
  venue         text,
  notes         text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

-- un solo match_results por session GPS (cuando está ligado)
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_results_session
  ON public.match_results (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_results_club_team_date
  ON public.match_results (club_id, team_id, match_date);

-- ── Tabla: estadísticas por jugador y partido ─────────────────
-- Un row por (match, player). `extra` jsonb para la cola larga de métricas
-- (Wyscout / CSV) sin migrar columnas.
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id      uuid NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
  player_id     uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  minutes       int,
  goals         int DEFAULT 0,
  assists       int DEFAULT 0,
  yellow_cards  int DEFAULT 0,
  red_cards     int DEFAULT 0,
  rating        numeric,
  position      text,
  extra         jsonb NOT NULL DEFAULT '{}'::jsonb,    -- long-tail Wyscout/CSV metrics
  created_at    timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_match_stats_match_player
  ON public.player_match_stats (match_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_club_player
  ON public.player_match_stats (club_id, player_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.match_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

-- match_results: club-scoped (espejo de gps_reports / gps_column_mappings)
DROP POLICY IF EXISTS match_results_select ON public.match_results;
CREATE POLICY match_results_select ON public.match_results
  FOR SELECT USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS match_results_insert ON public.match_results;
CREATE POLICY match_results_insert ON public.match_results
  FOR INSERT WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS match_results_update ON public.match_results;
CREATE POLICY match_results_update ON public.match_results
  FOR UPDATE USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS match_results_delete ON public.match_results;
CREATE POLICY match_results_delete ON public.match_results
  FOR DELETE USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- player_match_stats: club-scoped (mismo predicado)
DROP POLICY IF EXISTS player_match_stats_select ON public.player_match_stats;
CREATE POLICY player_match_stats_select ON public.player_match_stats
  FOR SELECT USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS player_match_stats_insert ON public.player_match_stats;
CREATE POLICY player_match_stats_insert ON public.player_match_stats
  FOR INSERT WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS player_match_stats_update ON public.player_match_stats;
CREATE POLICY player_match_stats_update ON public.player_match_stats
  FOR UPDATE USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS player_match_stats_delete ON public.player_match_stats;
CREATE POLICY player_match_stats_delete ON public.player_match_stats
  FOR DELETE USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- ── Grants (mismas privilegios de tabla que el resto de la app) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_results      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_match_stats TO authenticated;
