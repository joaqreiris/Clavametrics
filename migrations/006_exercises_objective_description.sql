-- Add objective and description text fields to exercises
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS objective   TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;
