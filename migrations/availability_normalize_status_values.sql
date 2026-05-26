-- Normalize abbreviated availability.status values to full names
-- Run BEFORE tightening the CHECK constraint.

UPDATE availability SET status = 'available'   WHERE status = 'av';
UPDATE availability SET status = 'partial'      WHERE status = 'pa';
UPDATE availability SET status = 'unavailable'  WHERE status IN ('in', 'si', 'na');

-- Verify no abbreviated values remain before tightening constraint
-- SELECT DISTINCT status FROM availability;

-- Drop and recreate constraint to only allow full canonical values
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_status_check;
ALTER TABLE availability ADD CONSTRAINT availability_status_check
  CHECK (status IN ('available', 'partial', 'limited', 'unavailable', 'away'));
