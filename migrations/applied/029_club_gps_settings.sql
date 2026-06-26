-- Migration 029: Club GPS settings
-- Stores per-club baseline configuration for GPS analysis
-- baseline_n: number of best match sessions used for personal reference (Miguel et al. 2022)
-- baseline_mode: 'personal' (player-specific) or 'position' (positional avg, Ammann & Altmann 2023)
-- active_metrics: which GPS columns are visible in Z-score matrix / ranking

CREATE TABLE IF NOT EXISTS club_gps_settings (
  club_id        uuid        PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  baseline_n     integer     NOT NULL DEFAULT 5,
  baseline_mode  text        NOT NULL DEFAULT 'personal',
  active_metrics text[]      DEFAULT ARRAY[
    'total_distance','high_speed_distance','sprint_distance',
    'max_speed','accelerations','player_load'
  ],
  updated_at     timestamptz DEFAULT now(),
  CHECK (baseline_n BETWEEN 3 AND 10),
  CHECK (baseline_mode IN ('personal', 'position'))
);

ALTER TABLE club_gps_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members manage gps settings"
  ON club_gps_settings
  FOR ALL
  USING (
    club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    )
  );
