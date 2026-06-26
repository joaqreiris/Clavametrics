-- Migration 028: GPS import infrastructure
-- gps_column_mappings, players.external_gps_id, gps_reports missing columns

-- ── gps_reports: add missing columns ──────────────────────────
ALTER TABLE gps_reports
  ADD COLUMN IF NOT EXISTS very_high_speed_distance numeric,
  ADD COLUMN IF NOT EXISTS hmld                     numeric,
  ADD COLUMN IF NOT EXISTS time_played              numeric;

-- ── players: external GPS device ID ───────────────────────────
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS external_gps_id text;

CREATE INDEX IF NOT EXISTS idx_players_ext_gps
  ON players(club_id, external_gps_id)
  WHERE external_gps_id IS NOT NULL;

-- ── gps_column_mappings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gps_column_mappings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  source_label      text        NOT NULL,
  source_column_name text       NOT NULL,
  target_metric     text        NOT NULL,
  unit_conversion   numeric     DEFAULT 1.0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (club_id, source_label, source_column_name)
);

CREATE INDEX IF NOT EXISTS idx_gps_mappings_club
  ON gps_column_mappings(club_id);

-- RLS
ALTER TABLE gps_column_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members can manage their column mappings"
  ON gps_column_mappings
  FOR ALL
  USING (
    club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    )
  );
