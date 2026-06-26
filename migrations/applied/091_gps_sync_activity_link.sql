-- Migration 091: link a training_session to the GPS provider activity that
-- created it, so re-syncing the same activity reuses the same session instead
-- of duplicating it. Natural key for idempotent GPS sync (Ladrillo 2b-i).
-- Idempotent: safe to re-run.

alter table public.training_sessions
  add column if not exists external_activity_id text;

-- One session per (club, provider activity). Partial so manually-created
-- sessions (external_activity_id IS NULL) are unaffected.
create unique index if not exists uq_training_sessions_club_activity
  on public.training_sessions (club_id, external_activity_id)
  where external_activity_id is not null;
