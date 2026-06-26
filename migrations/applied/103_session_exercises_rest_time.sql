-- Migration 103: carry rest_time onto session-level field tasks so Daily Planning
-- can compute the TOTAL session time (series × (work + rest)) per block, while the
-- GPS projection keeps using work only. Mirrors public.exercises.rest_time
-- (text "M:SS"). Idempotent.

alter table public.session_exercises
  add column if not exists rest_time text;
