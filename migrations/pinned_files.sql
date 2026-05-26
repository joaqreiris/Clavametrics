-- Pinned files per conversation (group channel or DM)
-- Uses conv_id TEXT ('group' or user UUID) since there is no channels table
CREATE TABLE IF NOT EXISTS pinned_files (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  conv_id    TEXT        NOT NULL DEFAULT 'group',
  message_id UUID,
  file_url   TEXT        NOT NULL,
  file_name  TEXT        NOT NULL,
  file_type  TEXT,
  pinned_by  UUID        REFERENCES auth.users(id),
  pinned_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pinned_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view pinned files" ON pinned_files;
CREATE POLICY "Club members can view pinned files"
  ON pinned_files FOR SELECT
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Club members can pin files" ON pinned_files;
CREATE POLICY "Club members can pin files"
  ON pinned_files FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Club members can unpin files" ON pinned_files;
CREATE POLICY "Club members can unpin files"
  ON pinned_files FOR DELETE
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));
