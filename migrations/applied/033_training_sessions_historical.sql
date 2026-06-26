-- Migration 033 — training_sessions: historical flag + session_label
-- Purpose: allow GPS imports to be marked as "historical data" so they
-- don't contaminate Calendar, Sessions History, and Daily Planning.
-- Historical sessions are still visible in GPS Analysis charts and baselines.

-- 1. Add is_historical flag (default false — all existing rows are treated as real)
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;

-- 2. Add optional session_label to disambiguate AM/PM or multi-session days
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS session_label text;

-- 3. Index for the common filter pattern (WHERE club_id=X AND is_historical=false)
CREATE INDEX IF NOT EXISTS idx_training_sessions_historical
  ON training_sessions(club_id, is_historical, session_date);

-- 4. Partial unique constraint: no two historical sessions with the same
--    (club_id, session_date, session_label) — prevents duplicate imports.
--    NULLS NOT DISTINCT requires PostgreSQL 15+. If on an older version,
--    replace with a conditional unique expression index instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_sessions_hist_unique'
  ) THEN
    ALTER TABLE training_sessions
      ADD CONSTRAINT training_sessions_hist_unique
      UNIQUE NULLS NOT DISTINCT (club_id, session_date, session_label, is_historical);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add UNIQUE constraint (may require PG15+): %', SQLERRM;
END $$;
