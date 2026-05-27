-- Create lineups table for the Squad Lineup editor
CREATE TABLE IF NOT EXISTS lineups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID REFERENCES clubs(id) ON DELETE CASCADE,
  match_id    UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  formation   TEXT NOT NULL,
  players     JSONB,   -- { slotId: playerId }
  subs        JSONB,   -- [playerId|null, ...] (7 slots)
  title       TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can read lineups"   ON lineups;
DROP POLICY IF EXISTS "Club members can insert lineups" ON lineups;
DROP POLICY IF EXISTS "Club members can update lineups" ON lineups;
DROP POLICY IF EXISTS "Club members can delete lineups" ON lineups;

CREATE POLICY "Club members can read lineups"
  ON lineups FOR SELECT
  USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Club members can insert lineups"
  ON lineups FOR INSERT
  WITH CHECK (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Club members can update lineups"
  ON lineups FOR UPDATE
  USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Club members can delete lineups"
  ON lineups FOR DELETE
  USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- Index for fast history queries
CREATE INDEX IF NOT EXISTS lineups_club_created_idx
  ON lineups (club_id, created_at DESC);
