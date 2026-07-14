-- ClavaMetrics — Match Reports Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Idempotent: safe to re-run on both fresh DBs and existing ones.
-- Date: 2026-05-20

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. league_configs
--    May already exist from old migration — only fix the policy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_configs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id           UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  season            TEXT DEFAULT '2025/26',
  yellow_threshold  INTEGER DEFAULT 5,
  yellow_ban_games  INTEGER DEFAULT 1,
  red_direct_games  INTEGER DEFAULT 2,
  red_serious_games INTEGER DEFAULT 3,
  reset_date        DATE,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.league_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_league_configs" ON public.league_configs;
CREATE POLICY "club_league_configs" ON public.league_configs FOR ALL
  USING (club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS league_configs_club_idx ON public.league_configs (club_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. match_reports
--    May already exist from old migration (without session_id and new stat cols).
--    CREATE TABLE handles fresh installs; ALTER TABLE handles existing ones.
--
--    goals: [{minute, team, player_name, player_id, type, assist_name, is_own_goal}]
--    cards: [{minute, team, player_name, player_id, type, reason}]  team='us'|'them'
--    subs:  [{minute, out_name, out_id, in_name, in_id, reason}]
--    positions: [{player_id, name, avg_x, avg_y}]  for heatmap
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_reports (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id          UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  session_id       UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  match_date       DATE NOT NULL,
  competition      TEXT,
  league_config_id UUID REFERENCES public.league_configs(id) ON DELETE SET NULL,
  opponent         TEXT NOT NULL,
  venue            TEXT DEFAULT 'home' CHECK (venue IN ('home','away','neutral')),
  score_us         INTEGER,
  score_them       INTEGER,
  score_ht_us      INTEGER,
  score_ht_them    INTEGER,
  formation_us     TEXT,
  formation_them   TEXT,
  goals            JSONB DEFAULT '[]',
  cards            JSONB DEFAULT '[]',
  subs             JSONB DEFAULT '[]',
  venue_capacity   INTEGER,
  added_time       INTEGER,
  weather          TEXT,
  possession_us    INTEGER,
  shots_on         INTEGER,
  shots_off        INTEGER,
  shots_blocked    INTEGER,
  xg               NUMERIC(5,2),
  corners          INTEGER,
  fouls            INTEGER,
  offsides         INTEGER,
  tackles          INTEGER,
  pass_accuracy_us   INTEGER,
  pass_accuracy_them INTEGER,
  positions        JSONB DEFAULT '[]',
  ratings          JSONB DEFAULT '{}',
  coach_notes      TEXT,
  source           TEXT DEFAULT 'manual' CHECK (source IN ('manual','wyscout','tracab','other')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Columns added in this migration (no-ops if already present)
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS session_id       UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS venue_capacity   INTEGER;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS added_time       INTEGER;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS weather          TEXT;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS tackles          INTEGER;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS pass_accuracy_us   INTEGER;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS pass_accuracy_them INTEGER;
ALTER TABLE public.match_reports ADD COLUMN IF NOT EXISTS positions        JSONB DEFAULT '[]';

ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_match_reports" ON public.match_reports;
CREATE POLICY "club_match_reports" ON public.match_reports FOR ALL
  USING (club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS match_reports_club_date_idx ON public.match_reports (club_id, match_date DESC);
CREATE INDEX IF NOT EXISTS match_reports_session_idx   ON public.match_reports (session_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS match_reports_updated_at ON public.match_reports;
CREATE TRIGGER match_reports_updated_at
  BEFORE UPDATE ON public.match_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. match_shots  (new table — no old version exists)
--    One row per shot. x_pct / y_pct are 0–100 relative to pitch dimensions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_shots (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id    UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id   UUID REFERENCES public.match_reports(id) ON DELETE CASCADE,
  player_id  UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team       TEXT NOT NULL CHECK (team IN ('us','them')),
  minute     INTEGER,
  outcome    TEXT NOT NULL CHECK (outcome IN ('goal','on_target','off_target','blocked')),
  x_pct      NUMERIC(5,2),
  y_pct      NUMERIC(5,2),
  xg         NUMERIC(5,3),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.match_shots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_match_shots" ON public.match_shots;
CREATE POLICY "club_match_shots" ON public.match_shots FOR ALL
  USING (club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS match_shots_match_idx ON public.match_shots (match_id);
CREATE INDEX IF NOT EXISTS match_shots_club_idx  ON public.match_shots (club_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. card_accumulations
--    Old version used player_name TEXT + player_id TEXT.
--    New column player_uuid added for FK link to players; old columns kept intact.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.card_accumulations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id          UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id        UUID REFERENCES public.players(id) ON DELETE CASCADE,
  league_config_id UUID REFERENCES public.league_configs(id) ON DELETE CASCADE,
  yellow_count     INTEGER DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, player_id, league_config_id)
);

-- If table existed with old TEXT player_id, add the UUID column under a new name
ALTER TABLE public.card_accumulations ADD COLUMN IF NOT EXISTS player_uuid UUID REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.card_accumulations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_card_accumulations" ON public.card_accumulations;
CREATE POLICY "club_card_accumulations" ON public.card_accumulations FOR ALL
  USING (club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS card_acc_club_player_idx ON public.card_accumulations (club_id);
