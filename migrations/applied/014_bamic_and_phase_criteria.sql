-- Migration 014: BAMIC classification + individual phase criteria
-- Adds BAMIC grade + injury mechanism to injuries
-- Adds per-criterion tracking, revert log and completed_by to injury_phases

-- injuries
ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS bamic_grade      TEXT,
  ADD COLUMN IF NOT EXISTS injury_mechanism TEXT
    CHECK (injury_mechanism IN ('contact','non_contact','overuse','unknown'));

-- Drop old mechanism column constraint if it used different values
-- (prior migrations used free-text; we normalise via the new column)

-- injury_phases
ALTER TABLE injury_phases
  ADD COLUMN IF NOT EXISTS criteria_items     JSONB,   -- [{id, label, required}]
  ADD COLUMN IF NOT EXISTS criteria_completed JSONB,   -- {<item_id>: true/false}
  ADD COLUMN IF NOT EXISTS revert_log         JSONB,   -- [{from, to, reason, by, at}]
  ADD COLUMN IF NOT EXISTS completed_by       UUID REFERENCES profiles(id);
