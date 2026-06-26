-- Injury rehabilitation phases
CREATE TABLE IF NOT EXISTS injury_phases (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id    UUID        NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
  phase_number INTEGER     NOT NULL,
  phase_name   TEXT        NOT NULL,
  start_date   DATE,
  end_date     DATE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','in_progress','done')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS injury_phases_injury_id_idx ON injury_phases(injury_id);

ALTER TABLE injury_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "injury_phases_select" ON injury_phases
  FOR SELECT USING (
    injury_id IN (SELECT id FROM injuries WHERE club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "injury_phases_insert" ON injury_phases
  FOR INSERT WITH CHECK (
    injury_id IN (SELECT id FROM injuries WHERE club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "injury_phases_update" ON injury_phases
  FOR UPDATE USING (
    injury_id IN (SELECT id FROM injuries WHERE club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "injury_phases_delete" ON injury_phases
  FOR DELETE USING (
    injury_id IN (SELECT id FROM injuries WHERE club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid()
    ))
  );

-- Add mechanism + returned_date if not already present
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS mechanism    TEXT;
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS returned_date DATE;
