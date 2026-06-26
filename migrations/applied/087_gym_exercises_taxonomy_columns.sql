-- ============================================================
-- MIGRATION 086: Canonical taxonomy columns on gym_exercises
-- Adds the 9 canonical-token columns that lib/exercise-taxonomy.js writes to.
-- Additive + idempotent. Does NOT touch the legacy free-text columns
-- (muscle_group, equipment, category) — those stay until the cutover.
-- Validation is APP-LEVEL against window.CMTaxonomy (no DB CHECK by design):
-- the canonical lists live in JS and evolve, plus a future learned-alias loop.
-- Keeping a single source of truth in the lib beats syncing a CHECK by hand.
-- Tokens are stored as-is; arrays are NULL when untagged (NULL = "needs tagging").
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. New canonical columns (additive) ───────────────────────
ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS primary_purpose    text,        -- single: default session bucket
  ADD COLUMN IF NOT EXISTS purposes           text[],      -- all purposes (incl. primary)
  ADD COLUMN IF NOT EXISTS equipment_tags     text[],      -- required dim
  ADD COLUMN IF NOT EXISTS muscle_groups      text[],      -- required dim (atomic muscles)
  ADD COLUMN IF NOT EXISTS movement_patterns  text[],      -- required dim
  ADD COLUMN IF NOT EXISTS myofascial_chains  text[],      -- optional
  ADD COLUMN IF NOT EXISTS contraction_types  text[],      -- optional
  ADD COLUMN IF NOT EXISTS movement_speeds    text[],      -- optional
  ADD COLUMN IF NOT EXISTS planes             text[];      -- optional

-- ── 2. Self-documenting comments (why there is no CHECK) ───────
COMMENT ON COLUMN gym_exercises.primary_purpose IS
  'Canonical purpose token (single). Validated in-app vs CMTaxonomy, not by DB CHECK.';
COMMENT ON COLUMN gym_exercises.purposes IS
  'Canonical purpose tokens (incl. primary_purpose). Validated in-app vs CMTaxonomy.';
COMMENT ON COLUMN gym_exercises.equipment_tags IS
  'Canonical equipment tokens. Validated in-app vs CMTaxonomy.';
COMMENT ON COLUMN gym_exercises.muscle_groups IS
  'Canonical atomic muscle tokens (region shortcuts expanded before write).';
COMMENT ON COLUMN gym_exercises.movement_patterns IS
  'Canonical movement-pattern tokens. Validated in-app vs CMTaxonomy.';
COMMENT ON COLUMN gym_exercises.myofascial_chains IS
  'Optional. Canonical myofascial-line tokens (Anatomy Trains).';
COMMENT ON COLUMN gym_exercises.contraction_types IS
  'Optional. Canonical contraction-type tokens.';
COMMENT ON COLUMN gym_exercises.movement_speeds IS
  'Optional. Canonical force-velocity tokens.';
COMMENT ON COLUMN gym_exercises.planes IS
  'Optional. Canonical anatomical-plane tokens.';

-- ── 3. GIN indexes for array containment/overlap filtering ─────
-- Enables fast filter-bar queries: muscle_groups && '{hamstrings}', etc.
CREATE INDEX IF NOT EXISTS gym_exercises_purposes_gin          ON gym_exercises USING GIN (purposes);
CREATE INDEX IF NOT EXISTS gym_exercises_equipment_tags_gin    ON gym_exercises USING GIN (equipment_tags);
CREATE INDEX IF NOT EXISTS gym_exercises_muscle_groups_gin     ON gym_exercises USING GIN (muscle_groups);
CREATE INDEX IF NOT EXISTS gym_exercises_movement_patterns_gin ON gym_exercises USING GIN (movement_patterns);
CREATE INDEX IF NOT EXISTS gym_exercises_myofascial_gin        ON gym_exercises USING GIN (myofascial_chains);
CREATE INDEX IF NOT EXISTS gym_exercises_contraction_gin       ON gym_exercises USING GIN (contraction_types);
CREATE INDEX IF NOT EXISTS gym_exercises_speeds_gin            ON gym_exercises USING GIN (movement_speeds);
CREATE INDEX IF NOT EXISTS gym_exercises_planes_gin            ON gym_exercises USING GIN (planes);

-- primary_purpose is scalar → plain btree
CREATE INDEX IF NOT EXISTS gym_exercises_primary_purpose_idx   ON gym_exercises (primary_purpose);

-- ── 4. (No data backfill here.) ───────────────────────────────
-- The 120 default rows + per-club free-text normalization happen in the
-- next migration (087), which seeds default_exercises canonically and
-- propagates to gym_exercises by default_key.
