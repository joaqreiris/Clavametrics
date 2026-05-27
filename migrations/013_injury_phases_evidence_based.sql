-- Extend injury_phases for evidence-based rehabilitation protocols
-- Adds phase_type, criteria, criteria_met, actual_start/end columns
-- Updates status check to include 'skipped'

ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS phase_type    TEXT;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS criteria      TEXT;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS criteria_met  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS actual_start  DATE;
ALTER TABLE injury_phases ADD COLUMN IF NOT EXISTS actual_end    DATE;

-- Update status check to include 'skipped'
ALTER TABLE injury_phases DROP CONSTRAINT IF EXISTS injury_phases_status_check;
ALTER TABLE injury_phases ADD CONSTRAINT injury_phases_status_check
  CHECK (status IN ('pending','in_progress','done','skipped'));

-- Remove rigid injury_type constraint to allow free-form text
ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_injury_type_check;
