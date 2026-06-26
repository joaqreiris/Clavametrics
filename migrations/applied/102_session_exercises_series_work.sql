-- Migration 102: carry series × work_time onto session-level field tasks so the
-- Daily Planning effective-duration (and GPS projection) works for drills defined
-- by series × work_time instead of a flat duration. Mirrors the columns in
-- public.exercises (series int, work_time text "M:SS"). Idempotent.

alter table public.session_exercises
  add column if not exists series    integer,
  add column if not exists work_time text;
