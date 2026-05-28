-- =============================================================
-- Migration 019: Lineups v2 — Official lineup builder
-- Created: 2026-05-27
-- Depends on:
--   - 001 (players, clubs, profiles)
--   - 008_lineups.sql   (creates `lineups` table, JSONB-based)
--   - 009_lineups_extras.sql
--   - 014_microcycle_publish_state.sql (microcycles table)
--
-- NOTE: 008 stores players as JSONB blobs in `lineups.players`.
-- This migration creates the normalized `lineup_players` table
-- alongside the old structure. Both can coexist.
--
-- NOTE: There is no `matches` table in this schema — match data
-- lives in `microcycles` (rival, match_date, match_time, stadium,
-- home_away) and `calendar_events` (type='match'). Views below
-- query microcycles directly.
--
-- All ADD COLUMN IF NOT EXISTS = idempotent, safe to re-run.
-- =============================================================

-- ─── A. lineups: add status + microcycle_id + poster fields ──
ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS microcycle_id uuid
    REFERENCES microcycles(id) ON DELETE SET NULL;

ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'
    CHECK (status IN ('draft','locked','official','archived'));

ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES profiles(id);

ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS poster_style text DEFAULT 'editorial'
    CHECK (poster_style IN ('editorial','stadium','magazine','ticket'));

ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'es'
    CHECK (language IN ('es','en','pt'));

-- formation already exists as TEXT (no constraint) — leave it; lineup.js validates client-side

CREATE INDEX IF NOT EXISTS idx_lineups_microcycle ON lineups(microcycle_id);
CREATE INDEX IF NOT EXISTS idx_lineups_status     ON lineups(status);
CREATE INDEX IF NOT EXISTS idx_lineups_match_st   ON lineups(match_id, status);

-- ─── B. lineup_players (new normalized table) ────────────────
-- Replaces the JSONB `players` / `subs` blobs for new lineups.
-- Old rows keep their JSONB intact; new lineups use this table.
CREATE TABLE IF NOT EXISTS lineup_players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id        uuid NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  player_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'starter'
                     CHECK (role IN ('starter','substitute','reserve','injured')),
  slot_index       integer,       -- 0..10 starters, 0..n subs (display order)
  x_pct            numeric(5,2)   CHECK (x_pct IS NULL OR x_pct BETWEEN 0 AND 100),
  y_pct            numeric(5,2)   CHECK (y_pct IS NULL OR y_pct BETWEEN 0 AND 100),
  is_captain       boolean DEFAULT false,
  is_vice_captain  boolean DEFAULT false,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (lineup_id, player_id, role)
);

-- Only one captain per lineup
CREATE UNIQUE INDEX IF NOT EXISTS uq_lineup_players_captain
  ON lineup_players(lineup_id)
  WHERE is_captain = true;

CREATE INDEX IF NOT EXISTS idx_lineup_players_role
  ON lineup_players(lineup_id, role, slot_index);

ALTER TABLE lineup_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY lineup_players_all ON lineup_players
  FOR ALL TO authenticated USING (
    lineup_id IN (
      SELECT id FROM lineups
      WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ─── C. lineup_staff (cuerpo técnico por partido) ────────────
CREATE TABLE IF NOT EXISTS lineup_staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id     uuid NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  profile_id    uuid REFERENCES profiles(id),
  display_name  text NOT NULL,
  role_code     text NOT NULL CHECK (role_code IN ('head','assistant','gk_coach','fitness','physio','analyst','other')),
  sort_order    integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineup_staff_lineup ON lineup_staff(lineup_id, sort_order);

ALTER TABLE lineup_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY lineup_staff_all ON lineup_staff
  FOR ALL TO authenticated USING (
    lineup_id IN (
      SELECT id FROM lineups
      WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ─── D. club_branding ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_branding (
  club_id        uuid PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  crest_url      text,
  crest_dark_url text,
  primary_color  text,
  accent_color   text,
  hashtag        text DEFAULT '#Clava',
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE club_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY club_branding_select ON club_branding
  FOR SELECT TO authenticated USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY club_branding_modify ON club_branding
  FOR ALL TO authenticated USING (
    club_id IN (
      SELECT club_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff')
    )
  );

-- ─── E. opponent_branding ────────────────────────────────────
CREATE TABLE IF NOT EXISTS opponent_branding (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  opponent_name  text NOT NULL,
  crest_url      text,
  primary_color  text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (club_id, opponent_name)
);

CREATE INDEX IF NOT EXISTS idx_opp_branding_club ON opponent_branding(club_id, opponent_name);

ALTER TABLE opponent_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY opponent_branding_all ON opponent_branding
  FOR ALL TO authenticated USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- ─── F. Triggers ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS club_branding_updated_at ON club_branding;
CREATE TRIGGER club_branding_updated_at BEFORE UPDATE ON club_branding
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION stamp_lineup_publish() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'official' AND (OLD.status IS NULL OR OLD.status <> 'official') THEN
    NEW.published_at := now();
    NEW.published_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lineups_stamp_publish ON lineups;
CREATE TRIGGER lineups_stamp_publish BEFORE UPDATE ON lineups
  FOR EACH ROW EXECUTE FUNCTION stamp_lineup_publish();

-- ─── G. View: próximo partido con lineup ─────────────────────
-- Uses microcycles (which already carries rival, match_date, etc.)
-- No `matches` table exists; match data lives in microcycles.
CREATE OR REPLACE VIEW v_next_match_lineup AS
  SELECT DISTINCT ON (mc.club_id)
    mc.club_id,
    mc.id           AS microcycle_id,
    mc.name         AS microcycle_name,
    mc.match_date   AS kickoff_date,
    mc.match_time   AS kickoff_time,
    mc.rival        AS opponent_name,
    mc.home_away,
    mc.stadium      AS venue,
    l.id            AS lineup_id,
    l.formation,
    l.status        AS lineup_status,
    l.poster_style,
    l.language
  FROM microcycles mc
  LEFT JOIN lineups l
    ON l.microcycle_id = mc.id
    AND l.status IN ('draft','locked','official')
  WHERE mc.match_date >= CURRENT_DATE
  ORDER BY mc.club_id, mc.match_date ASC;
