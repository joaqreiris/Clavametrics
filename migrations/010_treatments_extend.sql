-- Extend treatments table with rehab/preventive workflow fields
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS treatment_type TEXT DEFAULT 'rehab'
    CHECK (treatment_type IN ('rehab','preventive')),
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS indicated_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS modalities JSONB,
  ADD COLUMN IF NOT EXISTS pain_pre INTEGER CHECK (pain_pre BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS pain_post INTEGER CHECK (pain_post BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS player_status TEXT CHECK (player_status IN ('improving','stable','worsening')),
  ADD COLUMN IF NOT EXISTS physio_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS session_time TIME,
  ADD COLUMN IF NOT EXISTS adaptation_notes TEXT,
  ADD COLUMN IF NOT EXISTS adaptation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_coaches BOOLEAN DEFAULT false;

-- Treatment templates
CREATE TABLE IF NOT EXISTS treatment_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          UUID        REFERENCES clubs(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  treatment_type   TEXT        CHECK (treatment_type IN ('rehab','preventive')),
  injury_type      TEXT,
  modalities       JSONB,
  duration_minutes INTEGER,
  notes_template   TEXT,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE treatment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_templates_club_select" ON treatment_templates
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "treatment_templates_club_insert" ON treatment_templates
  FOR INSERT WITH CHECK (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "treatment_templates_club_delete" ON treatment_templates
  FOR DELETE USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );
