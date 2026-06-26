-- Profile appearance + notification settings columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS settings              JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;

-- Notifications table for realtime in-app alerts
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id    UUID        REFERENCES clubs(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT,
  read       BOOLEAN     NOT NULL DEFAULT false,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Service role / backend can insert for any user
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);

-- Enable realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
