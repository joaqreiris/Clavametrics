-- ──────────────────────────────────────────────────────────────────
-- 023 — visible_to audience field + share_links + player RPC
-- Run in Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────────

-- 1. Add visible_to to calendar_events
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS visible_to text[] DEFAULT ARRAY['staff'];

-- Set defaults per type for existing rows
UPDATE calendar_events
  SET visible_to = ARRAY['staff','players','medical']
  WHERE type IN ('match','recovery','travel');
-- meeting, evaluation, video_session, other → stay as ['staff'] (default)

-- 2. Add visible_to to training_sessions
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS visible_to text[] DEFAULT ARRAY['staff'];

-- Field-based sessions are visible to players and medical by default
UPDATE training_sessions
  SET visible_to = ARRAY['staff','players','medical']
  WHERE session_type IN ('tactical','conditioning','gym','recovery','other');

-- 3. Create share_links table
CREATE TABLE IF NOT EXISTS share_links (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid    NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  scope       text    NOT NULL DEFAULT 'players',
  token       text    UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  mc_id       text    REFERENCES microcycles(id) ON DELETE SET NULL,
  week_start  date,
  expires_at  timestamp with time zone,
  revoked     boolean NOT NULL DEFAULT false,
  created_by  uuid    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS share_links_token_idx ON share_links (token);
CREATE        INDEX IF NOT EXISTS share_links_club_idx  ON share_links (club_id);

-- 4. RLS on share_links
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Authenticated staff: full access restricted to their club
DROP POLICY IF EXISTS "share_links_staff" ON share_links;
CREATE POLICY "share_links_staff" ON share_links
  FOR ALL TO authenticated
  USING  (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- Anon: can SELECT active (non-revoked, non-expired) links by token
DROP POLICY IF EXISTS "share_links_anon_read" ON share_links;
CREATE POLICY "share_links_anon_read" ON share_links
  FOR SELECT TO anon
  USING (revoked = false AND (expires_at IS NULL OR expires_at > now()));

-- 5. RPC: get_shared_calendar(token) — SECURITY DEFINER so anon bypasses RLS on events
CREATE OR REPLACE FUNCTION get_shared_calendar(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link      share_links;
  v_date_from date;
  v_date_to   date;
  v_events    jsonb;
  v_club      jsonb;
  v_mc        jsonb;
BEGIN
  SELECT * INTO v_link
    FROM share_links
    WHERE token = p_token
      AND revoked = false
      AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- Determine date range
  IF v_link.mc_id IS NOT NULL THEN
    SELECT
      start_date::date,
      end_date::date,
      jsonb_build_object(
        'id', id, 'name', name,
        'start_date', start_date, 'end_date', end_date,
        'match_date', match_date, 'rival', rival, 'home_away', home_away
      )
    INTO v_date_from, v_date_to, v_mc
    FROM microcycles WHERE id = v_link.mc_id;
  ELSIF v_link.week_start IS NOT NULL THEN
    v_date_from := v_link.week_start;
    v_date_to   := v_link.week_start + 6;
  ELSE
    v_date_from := CURRENT_DATE;
    v_date_to   := CURRENT_DATE + 30;
  END IF;

  -- Club info (non-sensitive fields only)
  SELECT jsonb_build_object('name', name, 'logo_url', logo_url)
    INTO v_club FROM clubs WHERE id = v_link.club_id;

  -- Collect events visible to players, from both tables
  SELECT jsonb_agg(row ORDER BY (row->>'event_date'), (row->>'start_time') NULLS LAST)
    INTO v_events
    FROM (
      -- calendar_events
      SELECT jsonb_build_object(
        'id',               e.id::text,
        'title',            e.title,
        'event_type',       e.type,
        'event_date',       e.date::text,
        'start_time',       e.start_time,
        'duration_minutes', e.duration_minutes,
        'location',         e.location,
        'opponent',         e.opponent,
        'home_away',        e.home_away,
        'competition',      e.competition
      ) AS row
      FROM calendar_events e
      WHERE e.club_id = v_link.club_id
        AND 'players' = ANY(COALESCE(e.visible_to, ARRAY['staff']))
        AND e.date >= v_date_from
        AND e.date <= v_date_to
      UNION ALL
      -- training_sessions
      SELECT jsonb_build_object(
        'id',               t.id::text,
        'title',            t.title,
        'event_type',       t.session_type,
        'event_date',       t.session_date::text,
        'start_time',       t.session_time,
        'duration_minutes', t.duration,
        'location',         NULL,
        'opponent',         NULL,
        'home_away',        NULL,
        'competition',      NULL
      ) AS row
      FROM training_sessions t
      WHERE t.club_id = v_link.club_id
        AND 'players' = ANY(COALESCE(t.visible_to, ARRAY['staff']))
        AND t.session_date >= v_date_from
        AND t.session_date <= v_date_to
    ) sub;

  RETURN jsonb_build_object(
    'club',       v_club,
    'mc',         v_mc,
    'date_from',  v_date_from,
    'date_to',    v_date_to,
    'events',     COALESCE(v_events, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_calendar(text) TO anon;
GRANT EXECUTE ON FUNCTION get_shared_calendar(text) TO authenticated;
