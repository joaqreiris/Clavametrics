-- ClavaMetrics — Stabilization Migrations
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Each section is idempotent: safe to re-run.
-- Date: 2026-05-19

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. rpe — CRITICAL: add club_id for multi-tenant isolation
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rpe
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notes   TEXT;

-- Backfill club_id from the related training_session
UPDATE rpe
SET club_id = ts.club_id
FROM training_sessions ts
WHERE rpe.session_id = ts.id
  AND rpe.club_id IS NULL;

-- Index for tenant queries
CREATE INDEX IF NOT EXISTS rpe_club_id_idx ON rpe (club_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles — add club_role and last_seen_at
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS club_role    TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. evaluations — add test metadata columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS test_name TEXT,
  ADD COLUMN IF NOT EXISTS test_type TEXT,
  ADD COLUMN IF NOT EXISTS title     TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. clubs — add sport and plan
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS sport TEXT,
  ADD COLUMN IF NOT EXISTS plan  TEXT DEFAULT 'free';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. availability — add notes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. training_sessions — add rpe_avg (stored, updated via trigger or app)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS rpe_avg NUMERIC(4,1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. treatments — add missing operational columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS duration_min INTEGER,
  ADD COLUMN IF NOT EXISTS time         TEXT,      -- e.g. '09:30'
  ADD COLUMN IF NOT EXISTS adaptation   TEXT,      -- coach adaptation notes
  ADD COLUMN IF NOT EXISTS zones        TEXT[];    -- body zones e.g. ['L Quad', 'R Ham']

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS — fix messages policy (references non-existent platform_admins table)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop all existing policies on messages to start clean
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON messages', pol.policyname);
  END LOOP;
END $$;

-- Re-create sane policies: users can read/write messages in their club
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (
    sender_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS — add rpe policy now that club_id exists
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rpe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rpe_select" ON rpe;
DROP POLICY IF EXISTS "rpe_insert" ON rpe;

CREATE POLICY "rpe_select" ON rpe
  FOR SELECT USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "rpe_insert" ON rpe
  FOR INSERT WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. clubs — add Register.html sport field (was pending migration)
-- ─────────────────────────────────────────────────────────────────────────────
-- clubs.sport already added in section 4 above.
-- Register.html can now insert sport into clubs.
