-- Publish state per microcycle: control visibility by role group
ALTER TABLE microcycles
  ADD COLUMN IF NOT EXISTS publish_players BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_medical BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_board   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by    UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS publish_config  JSONB DEFAULT '{}';
