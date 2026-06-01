-- channel_reads: tracks last-read position per user per conversation
-- channel_key = 'group' for the club-wide channel, or another user's UUID for DMs
CREATE TABLE IF NOT EXISTS channel_reads (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_key TEXT        NOT NULL,
  club_id     UUID        NOT NULL REFERENCES clubs(id)      ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_key, club_id)
);

ALTER TABLE channel_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reads"
  ON channel_reads FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
