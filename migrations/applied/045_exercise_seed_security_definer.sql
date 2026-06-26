-- ============================================================
-- MIGRATION 045: Harden exercise seed trigger (SECURITY DEFINER)
-- ------------------------------------------------------------
-- Follows 044_exercise_library_seed.sql.
--
-- WHY: in the real club-creation flow (Onboarding / Register), the club row is
-- inserted BEFORE the user's profile is linked to that club. At that moment the
-- AFTER INSERT trigger runs as role `authenticated`, and the gym_exercises RLS
-- "insert only into your own club_id" policy is not yet satisfied — so the seed
-- would silently insert 0 rows in production (even though it works as `postgres`
-- in the SQL Editor).
--
-- FIX: run the seed function as its owner (SECURITY DEFINER), bypassing RLS
-- during the seeding only. The trigger itself is unchanged — replacing the
-- function is enough, since the trigger points at it by name.
--
-- Idempotent: CREATE OR REPLACE. Safe to re-run. Already applied in dev/prod.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_exercises_for_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO gym_exercises
    (club_id, name, category, muscle_group, complexity, equipment,
     usable_in, description, is_default, default_key)
  SELECT NEW.id, d.name, d.category, d.muscle_group, d.complexity, d.equipment,
         d.usable_in, d.description, true, d.default_key
  FROM default_exercises d
  ON CONFLICT (club_id, default_key) WHERE default_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger already exists from 044 and points at the function above; no change
-- needed. Recreated here only if you want this migration self-contained:
-- DROP TRIGGER IF EXISTS trg_seed_default_exercises ON clubs;
-- CREATE TRIGGER trg_seed_default_exercises
--   AFTER INSERT ON clubs
--   FOR EACH ROW EXECUTE FUNCTION seed_default_exercises_for_club();
