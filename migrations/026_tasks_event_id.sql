-- Migration 026: add event_id FK to tasks table
-- Tasks with event_id are scoped to a specific calendar_event (logistics, match prep, etc.)
-- Tasks without event_id remain general club tasks.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_event_id_idx ON tasks(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_club_event_idx ON tasks(club_id, event_id) WHERE event_id IS NOT NULL;

-- DROP policy is idempotent; re-create so it includes DELETE
DROP POLICY IF EXISTS "Club members can delete tasks" ON tasks;
CREATE POLICY "Club members can delete tasks"
  ON tasks FOR DELETE
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
