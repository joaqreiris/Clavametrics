-- Combined migration: create injury_phases (if missing) + add evidence-based columns
-- Replaces both 012 and 013 — safe to run even if table doesn't exist yet.

-- 1. Ensure injuries has the extra columns first (012 dependency)
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS mechanism     TEXT;
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS returned_date DATE;

-- Remove rigid injury_type constraint to allow free-form text
ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_injury_type_check;

-- 2. Create injury_phases with all columns (012 + 013 combined)
CREATE TABLE IF NOT EXISTS injury_phases (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id     UUID        NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
  phase_number  INTEGER     NOT NULL,
  phase_name    TEXT        NOT NULL,
  phase_type    TEXT,
  start_date    DATE,
  end_date      DATE,
  actual_start  DATE,
  actual_end    DATE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','done','skipped')),
  criteria      TEXT,
  criteria_met  BOOLEAN     NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. If the table already existed, add any missing columns gracefully
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS phase_type   TEXT;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS criteria     TEXT;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS criteria_met BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS actual_start DATE;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS actual_end   DATE;

-- Update status check (drop old constraint first, then re-add with skipped)
ALTER TABLE injury_phases DROP CONSTRAINT IF EXISTS injury_phases_status_check;
ALTER TABLE injury_phases ADD CONSTRAINT injury_phases_status_check
  CHECK (status IN ('pending','in_progress','done','skipped'));

-- 4. Index + RLS
CREATE INDEX IF NOT EXISTS injury_phases_injury_id_idx ON injury_phases(injury_id);

ALTER TABLE injury_phases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'injury_phases' AND policyname = 'injury_phases_select'
  ) THEN
    CREATE POLICY "injury_phases_select" ON injury_phases
      FOR SELECT USING (
        injury_id IN (SELECT id FROM injuries WHERE club_id IN (
          SELECT club_id FROM profiles WHERE id = auth.uid()
        ))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'injury_phases' AND policyname = 'injury_phases_insert'
  ) THEN
    CREATE POLICY "injury_phases_insert" ON injury_phases
      FOR INSERT WITH CHECK (
        injury_id IN (SELECT id FROM injuries WHERE club_id IN (
          SELECT club_id FROM profiles WHERE id = auth.uid()
        ))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'injury_phases' AND policyname = 'injury_phases_update'
  ) THEN
    CREATE POLICY "injury_phases_update" ON injury_phases
      FOR UPDATE USING (
        injury_id IN (SELECT id FROM injuries WHERE club_id IN (
          SELECT club_id FROM profiles WHERE id = auth.uid()
        ))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'injury_phases' AND policyname = 'injury_phases_delete'
  ) THEN
    CREATE POLICY "injury_phases_delete" ON injury_phases
      FOR DELETE USING (
        injury_id IN (SELECT id FROM injuries WHERE club_id IN (
          SELECT club_id FROM profiles WHERE id = auth.uid()
        ))
      );
  END IF;
END $$;
