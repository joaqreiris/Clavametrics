-- Normalize injuries.status values to canonical set used by the app:
--   'active'   = injury in progress (replaces 'recovery')
--   'resolved' = discharged / cleared (replaces 'cleared')

-- Step 1: migrate existing non-canonical values
UPDATE injuries SET status = 'active'   WHERE status = 'recovery';
UPDATE injuries SET status = 'resolved' WHERE status = 'cleared';

-- Step 2: replace constraint
ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_status_check;
ALTER TABLE injuries ADD CONSTRAINT injuries_status_check
  CHECK (status IN ('active', 'resolved'));
