-- Migration 020: GPS dashboard layouts + ACWR thresholds
-- Supports the new GPS Analysis dashboard system (5 dashboards with per-user layouts)

-- ── 1. gps_dashboard_layouts ─────────────────────────────────────────────────
-- Stores per-user, per-club, per-dashboard card layout (order, size, metric config).

CREATE TABLE IF NOT EXISTS gps_dashboard_layouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id      uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  dashboard_id text NOT NULL,   -- 'session_control' | 'player_week' | 'load_monitoring' | 'match_performance' | 'microcycle_compare'
  layout       jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, club_id, dashboard_id)
);

CREATE INDEX IF NOT EXISTS idx_gps_dashboard_layouts_user
  ON gps_dashboard_layouts (user_id, club_id);

-- RLS: each user can only read/write their own layouts
ALTER TABLE gps_dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own GPS layouts"
  ON gps_dashboard_layouts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. club_gps_settings — add acwr_thresholds column ────────────────────────
-- Allows each club to configure ACWR risk zones (defaults = Gabbett 2016).

ALTER TABLE club_gps_settings
  ADD COLUMN IF NOT EXISTS acwr_thresholds jsonb DEFAULT
    '{"under": 0.8, "sweet_upper": 1.3, "caution_upper": 1.5}'::jsonb;
