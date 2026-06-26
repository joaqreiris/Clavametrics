-- Fix: drop constraint FIRST, then migrate data, then re-add.
-- (017 failed because it updated rows before dropping the old constraint)

ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_status_check;

UPDATE injuries SET status = 'active'  WHERE status = 'recovery';
UPDATE injuries SET status = 'cleared' WHERE status = 'resolved';

ALTER TABLE injuries ADD CONSTRAINT injuries_status_check
  CHECK (status IN ('active', 'cleared', 'returning'));
