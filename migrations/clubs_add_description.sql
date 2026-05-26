-- Add description field to clubs for the Chat "About" section
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS description TEXT;
