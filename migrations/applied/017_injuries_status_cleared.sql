-- Normalize injuries.status to canonical values:
--   'active'   = injury in progress (covers old 'recovery')
--   'cleared'  = discharged / return to play (covers old 'resolved')
--   'returning' = reserved for future phase-based status
--
-- Safe to run whether or not 016_injuries_status_resolved was executed.

UPDATE injuries SET status = 'active'  WHERE status = 'recovery';
UPDATE injuries SET status = 'cleared' WHERE status = 'resolved';

ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_status_check;
ALTER TABLE injuries ADD CONSTRAINT injuries_status_check
  CHECK (status IN ('active', 'cleared', 'returning'));
