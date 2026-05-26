-- Add estimated_rpe to training_sessions (AU = duration × estimated_rpe)
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS estimated_rpe INTEGER CHECK (estimated_rpe BETWEEN 1 AND 10);

-- Add estimated_rpe to calendar_events (gym/match events)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS estimated_rpe INTEGER CHECK (estimated_rpe BETWEEN 1 AND 10);

-- Add sort_order for drag-and-drop reordering within same day
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
