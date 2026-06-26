-- Add created_by to injuries for tracking who logged the injury
-- Enables real user names in Staff Hub Recent Activity feed
ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
