-- Migration 092: gps_period_reports — PERIOD-level GPS (Ladrillo 2b-ii).
-- One row per (session, period, athlete). Mirrors gps_reports core columns and
-- adds period identity + raw duration_seconds (the per-minute denominator).
-- We store TOTALS + duration only; per-minute / period↔drill link is Ladrillo 2c.
-- Idempotent: safe to re-run.

create table if not exists public.gps_period_reports (
  id                       uuid primary key default gen_random_uuid(),
  club_id                  uuid not null references public.clubs(id)             on delete cascade,
  session_id               uuid not null references public.training_sessions(id) on delete cascade,
  player_id                uuid not null references public.players(id)           on delete cascade,

  -- Period identity (provider-owned)
  period_id                text not null,
  period_name              text,
  duration_seconds         numeric,          -- raw seconds; denominator for per-minute (derived in 2c)

  -- Core metrics — same columns/units as gps_reports
  total_distance           numeric,
  high_speed_distance      numeric,
  very_high_speed_distance numeric,
  sprint_distance          numeric,
  sprint_count             numeric,
  accelerations            numeric,
  decelerations            numeric,
  max_speed                numeric,
  avg_speed                numeric,
  player_load              numeric,
  hmld                     numeric,
  time_played              numeric,
  distance_per_minute      numeric,

  -- Non-core metrics at the period grain (key = target_metric → value)
  extra_metrics            jsonb not null default '{}'::jsonb,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (club_id, session_id, period_id, player_id)   -- upsert key (idempotent)
);

create index if not exists idx_gps_period_reports_session on public.gps_period_reports (club_id, session_id);
create index if not exists idx_gps_period_reports_player  on public.gps_period_reports (club_id, player_id);
create index if not exists idx_gps_period_reports_period  on public.gps_period_reports (club_id, period_id);

-- keep updated_at fresh (same convention as the other GPS tables)
drop trigger if exists trg_gps_period_reports_updated on public.gps_period_reports;
create trigger trg_gps_period_reports_updated
  before update on public.gps_period_reports
  for each row execute function public.set_updated_at();

-- RLS — mirror gps_reports: club-scoped via get_user_club_id().
alter table public.gps_period_reports enable row level security;
drop policy if exists gps_period_reports_club_all on public.gps_period_reports;
create policy gps_period_reports_club_all on public.gps_period_reports
  for all
  using      (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());
