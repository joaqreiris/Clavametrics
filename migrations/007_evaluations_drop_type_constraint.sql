-- Drop the check constraint on evaluation_type so any text value is accepted.
-- The original constraint only allowed: CMJ/sprint/vo2/strength/mobility/flexibility/balance/other
-- This is too restrictive for the physical test analysis engine which stores
-- specific test names (e.g. "30-15 IFT", "VBT · back squat", "1RM · Bench Press").
ALTER TABLE evaluations
  DROP CONSTRAINT IF EXISTS evaluations_evaluation_type_check;
