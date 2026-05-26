-- Migration: create calendar_events table for non-training events
-- Separates match/travel/meeting/evaluation/video_session/recovery
-- from training_sessions (which keeps only training + gym).
--
-- Multi-tenant: uses club_id -> clubs(id) to match existing project schema.
-- RLS: any authenticated profile belonging to the club can CRUD.

-- ── 1. Create table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES auth.users(id),
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN (
    'travel','meeting','evaluation','video_session','match','recovery'
  )),
  date             DATE NOT NULL,
  start_time       TIME,
  end_time         TIME,
  duration_minutes INTEGER,
  location         TEXT,
  opponent         TEXT,
  competition      TEXT CHECK (competition IN (
    'league','cup','international','friendly'
  )),
  home_away        TEXT CHECK (home_away IN ('home','away','neutral')),
  notes            TEXT,
  published        BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 2. RLS ──────────────────────────────────────────────────────
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members can read" ON calendar_events
  FOR SELECT USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "club members can insert" ON calendar_events
  FOR INSERT WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "club members can update" ON calendar_events
  FOR UPDATE USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "club members can delete" ON calendar_events
  FOR DELETE USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- ── 3. Migrate existing rows from training_sessions ─────────────
-- Move rows with non-training session_type into calendar_events.
INSERT INTO calendar_events (id, club_id, title, type, date, duration_minutes, notes, created_at)
SELECT
  id,
  club_id,
  COALESCE(title, session_type),
  CASE session_type
    WHEN 'video'        THEN 'video_session'
    WHEN 'video-session' THEN 'video_session'
    ELSE session_type
  END,
  session_date::DATE,
  duration,
  notes,
  created_at
FROM training_sessions
WHERE session_type IN ('travel','meeting','evaluation','video','video-session','video_session','match','recovery')
ON CONFLICT (id) DO NOTHING;

-- Remove migrated rows from training_sessions
DELETE FROM training_sessions
WHERE session_type IN ('travel','meeting','evaluation','video','video-session','video_session','match','recovery');

-- ── 4. (Optional) Restrict training_sessions session_type ───────
-- Run manually after verifying the migration is clean.
-- ALTER TABLE training_sessions
--   ADD CONSTRAINT training_sessions_session_type_check
--   CHECK (session_type IN ('training','tactical','gym','conditioning','other'));
