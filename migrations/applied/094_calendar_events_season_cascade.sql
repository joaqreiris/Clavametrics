-- Migration 094: calendar_events.season_id → ON DELETE CASCADE, so deleting a
-- season in Annual Planner removes its events cleanly (it was NO ACTION, which
-- blocked the delete). seasons + its FKs were created untracked in the DB; this
-- formalizes the rule. Idempotent: safe to re-run.
DO $$
DECLARE fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.calendar_events'::regclass
    AND confrelid = 'public.seasons'::regclass
    AND contype = 'f'
  LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.calendar_events DROP CONSTRAINT %I', fk_name);
  END IF;
  ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_season_id_fkey
    FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;
END $$;
