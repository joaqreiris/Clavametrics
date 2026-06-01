-- Add 'away' to availability status constraint
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_status_check;
ALTER TABLE availability ADD CONSTRAINT availability_status_check
  CHECK (status IN ('available', 'partial', 'limited', 'unavailable', 'away'));
