-- Migration 026: add event_id FK to tasks table
-- Tasks with event_id are scoped to a specific calendar_event.
-- Tasks without event_id remain general club tasks.
-- ON DELETE CASCADE: if the event is deleted, its tasks are also deleted (they have no meaning without the event).
-- category='event' is a conventional value for popover-created tasks (no CHECK constraint needed, field is text).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE;

-- Fast lookup of tasks for a specific event (used by popover and badge query)
CREATE INDEX IF NOT EXISTS idx_tasks_event_id
  ON tasks(event_id)
  WHERE event_id IS NOT NULL;

-- Fast lookup of pending tasks per club (future Chat & Tasks inbox)
CREATE INDEX IF NOT EXISTS idx_tasks_club_status
  ON tasks(club_id, status)
  WHERE status = 'pending';

-- Ensure DELETE RLS policy exists
DROP POLICY IF EXISTS "Club members can delete tasks" ON tasks;
CREATE POLICY "Club members can delete tasks"
  ON tasks FOR DELETE
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- Conventional values for category field (text, no CHECK constraint):
-- 'routine'  — general recurring staff task
-- 'event'    — task linked to a calendar_event (created from popover)
-- 'training' — training-related task
-- 'admin'    — administrative task
-- 'medical'  — medical/physio task
-- 'other'    — catch-all
