-- =============================================================
-- Migration 019: Lineups v2 — Official lineup builder
-- Created: 2026-05-27
-- Depends on:
--   - 001 (players, clubs, profiles)
--   - 008_lineups.sql       (creates `lineups` and `lineup_players`)
--   - 009_lineups_extras.sql
--   - 014_microcycle_publish_state.sql (microcycles table)
--
-- IMPORTANTE — leer antes de aplicar:
-- Esta migración asume que `lineups` y `lineup_players` YA existen
-- desde 008/009. Sólo agrega columnas faltantes (idempotente).
-- Si las tablas no existen, crear primero corriendo 008/009.
--
-- Si tu schema actual YA tiene todo lo que está abajo, NO apliques
-- esta migración — agregá nota en el PR explicando por qué.
-- =============================================================

-- ─── A. lineups: agregar status + microcycle_id + formation ──
ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS microcycle_id uuid
    REFERENCES microcycles(id) ON DELETE SET NULL;

ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS formation text DEFAULT '4-3-3'
    CHECK (formation IN ('4-3-3','4-4-2','4-2-3-1','3-5-2','5-3-2','3-4-3','4-3-2-1','4-1-4-1'));

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

CREATE INDEX IF NOT EXISTS idx_lineups_microcycle ON lineups(microcycle_id);
CREATE INDEX IF NOT EXISTS idx_lineups_status     ON lineups(status);
CREATE INDEX IF NOT EXISTS idx_lineups_match_st   ON lineups(match_id, status);

-- ─── B. lineup_players: role, position coords, captain, vice ─
ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'starter'
    CHECK (role IN ('starter','substitute','reserve','injured'));

ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS slot_index integer;
  -- 0..10 for starters (order in formation array)
  -- 0..n for substitutes (display order)

ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS x_pct numeric(5,2)
    CHECK (x_pct IS NULL OR (x_pct BETWEEN 0 AND 100));

ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS y_pct numeric(5,2)
    CHECK (y_pct IS NULL OR (y_pct BETWEEN 0 AND 100));

ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS is_captain boolean DEFAULT false;

ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS is_vice_captain boolean DEFAULT false;

ALTER TABLE lineup_players
  ADD COLUMN IF NOT EXISTS notes text;

-- Only ONE captain per lineup (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lineup_players_captain
  ON lineup_players(lineup_id)
  WHERE is_captain = true;

CREATE INDEX IF NOT EXISTS idx_lineup_players_role
  ON lineup_players(lineup_id, role, slot_index);

-- ─── C. lineup_staff (nueva tabla) ───────────────────────────
-- Cuerpo técnico que aparece en el póster (DT, ayudante, etc).
-- Independiente del cuerpo técnico general del club — por si en un
-- partido específico hay un cambio (ej. el DT está suspendido).
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

-- ─── D. club_branding (crest + colors per club) ──────────────
-- Para que el póster pueda mostrar el escudo real del club, no
-- el placeholder sample-club-crest.png.
CREATE TABLE IF NOT EXISTS club_branding (
  club_id        uuid PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  crest_url      text,
  crest_dark_url text,                    -- opcional: variante para fondos oscuros
  primary_color  text,                    -- hex
  accent_color   text,                    -- hex
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
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- ─── E. opponent_branding (crest del rival) ──────────────────
-- Cache de crests de rivales — opcional, para mostrar el escudo del
-- opponent en el banner sin que el usuario lo cargue cada vez.
CREATE TABLE IF NOT EXISTS opponent_branding (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  opponent_name  text NOT NULL,           -- normalizar lowercase en queries
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
DROP TRIGGER IF EXISTS lineups_updated_at_v2 ON lineups;
CREATE TRIGGER lineups_updated_at_v2 BEFORE UPDATE ON lineups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS club_branding_updated_at ON club_branding;
CREATE TRIGGER club_branding_updated_at BEFORE UPDATE ON club_branding
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Publicar lineup: stamp published_at + published_by automáticamente
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

-- ─── G. View útil: lineup actual de cada próximo partido ────
CREATE OR REPLACE VIEW v_next_match_lineup AS
  SELECT DISTINCT ON (m.club_id)
    m.club_id,
    m.id            AS match_id,
    m.kickoff_at,
    m.opponent_name,
    m.venue,
    m.is_home,
    mc.id           AS microcycle_id,
    mc.number       AS microcycle_number,
    l.id            AS lineup_id,
    l.formation,
    l.status        AS lineup_status,
    l.poster_style,
    l.language
  FROM matches m
  LEFT JOIN microcycles mc ON mc.id = m.microcycle_id
  LEFT JOIN lineups l      ON l.match_id = m.id AND l.status IN ('draft','locked','official')
  WHERE m.kickoff_at > now()
  ORDER BY m.club_id, m.kickoff_at ASC;

-- ─── H. Seed opcional para dev ───────────────────────────────
-- Insertá manualmente un branding para Clava FC + Atlético si querés
-- ver datos reales en dev:
--
-- INSERT INTO club_branding (club_id, crest_url, primary_color, accent_color, hashtag)
-- SELECT id, '/assets/clava-crest.png', '#15803D', '#4ADE80', '#VamosClava'
-- FROM clubs WHERE slug = 'clava-fc';
--
-- INSERT INTO opponent_branding (club_id, opponent_name, crest_url, primary_color)
-- SELECT c.id, 'Atlético', '/assets/atletico-crest.png', '#CB1F1F'
-- FROM clubs c WHERE c.slug = 'clava-fc';
