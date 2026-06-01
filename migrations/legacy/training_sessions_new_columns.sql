-- Migration: Add missing columns to training_sessions for Daily Planning
-- Run in Supabase SQL Editor

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS end_time       time,
  ADD COLUMN IF NOT EXISTS estimated_rpe  smallint CHECK (estimated_rpe >= 1 AND estimated_rpe <= 10),
  ADD COLUMN IF NOT EXISTS orientation    text,
  ADD COLUMN IF NOT EXISTS focus          text,
  ADD COLUMN IF NOT EXISTS match_day_offset text,
  ADD COLUMN IF NOT EXISTS published      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS microcycle_id  text REFERENCES microcycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order     integer NOT NULL DEFAULT 0;

-- Index for fast date queries (Calendar + Daily Planning both filter by session_date)
CREATE INDEX IF NOT EXISTS idx_training_sessions_club_date
  ON training_sessions (club_id, session_date);
