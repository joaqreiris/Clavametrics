-- Migration 101: per-session GPS targets for the Daily Planning projector (2d).
-- gps_targets maps metric_key (e.g. 'total_distance_per_min') → target value in
-- the displayed unit (m, AU, count). Used by the "Projected GPS load" panel to
-- compare projected vs target. Idempotent: safe to re-run.

alter table public.training_sessions
  add column if not exists gps_targets jsonb not null default '{}'::jsonb;
