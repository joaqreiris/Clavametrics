-- Fix: convert any remaining non-canonical status values before re-applying constraint.
-- Run this if availability_normalize_status_values.sql failed on the ADD CONSTRAINT step.

-- Step 1: explicit known abbreviations (in case normalize didn't run or was partial)
UPDATE availability SET status = 'available'  WHERE status = 'av';
UPDATE availability SET status = 'partial'    WHERE status = 'pa';
UPDATE availability SET status = 'unavailable' WHERE status IN ('in', 'si', 'na');

-- Step 2: catch-all — any other non-canonical value (e.g. 'ab', '', unknown) → 'unavailable'
UPDATE availability
SET status = 'unavailable'
WHERE status NOT IN ('available', 'partial', 'limited', 'unavailable', 'away');

-- Step 3: apply clean constraint
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_status_check;
ALTER TABLE availability ADD CONSTRAINT availability_status_check
  CHECK (status IN ('available', 'partial', 'limited', 'unavailable', 'away'));
