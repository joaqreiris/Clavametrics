CREATE TABLE IF NOT EXISTS tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          UUID        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  priority         TEXT        NOT NULL DEFAULT 'medium',
  due_date         DATE,
  category         TEXT        NOT NULL DEFAULT 'general',
  created_by       UUID        REFERENCES auth.users(id),
  created_by_name  TEXT,
  assigned_to      UUID        REFERENCES auth.users(id),
  assigned_to_name TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view tasks" ON tasks;
CREATE POLICY "Club members can view tasks"
  ON tasks FOR SELECT
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Club members can create tasks" ON tasks;
CREATE POLICY "Club members can create tasks"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Club members can update tasks" ON tasks;
CREATE POLICY "Club members can update tasks"
  ON tasks FOR UPDATE
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
