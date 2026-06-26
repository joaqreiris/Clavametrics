-- ============================================================
-- MIGRATION 089: Video import dedup keys on gym_exercises
-- Adds video_id (external id, e.g. YouTube 11-char) and source (provenance)
-- plus a partial UNIQUE index so re-importing a playlist is idempotent:
-- a video already in the club's library is skipped, only new ones come in.
-- Additive + idempotent. Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS video_id text,   -- external video id (dedup key)
  ADD COLUMN IF NOT EXISTS source   text;   -- 'manual' | 'youtube' | ...

COMMENT ON COLUMN gym_exercises.video_id IS
  'External video id (e.g. YouTube 11-char). Per-club dedup key for imports.';
COMMENT ON COLUMN gym_exercises.source IS
  'Provenance of the row: manual | youtube | ...';

-- One copy of a given video per club. NULL video_id rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS gym_exercises_club_video_uq
  ON gym_exercises (club_id, video_id) WHERE video_id IS NOT NULL;
