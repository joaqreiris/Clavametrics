-- Migration 093: drop tasks_category_check. The constraint was added directly in
-- the DB (never tracked in a migration) with a stale taxonomy
-- (routine/medical/technical/administrative/other) that had drifted from the app's
-- real task categories (general/match_day/medical/routine/event), so inserting the
-- default category 'general' failed with a check-constraint violation. Migration 026
-- documents category as free text with no CHECK, so this restores the intended design.
-- The app already controls allowed values via the New Task <select> and the
-- calendar popover (category='event').
-- Idempotent: safe to re-run.

alter table public.tasks
  drop constraint if exists tasks_category_check;
