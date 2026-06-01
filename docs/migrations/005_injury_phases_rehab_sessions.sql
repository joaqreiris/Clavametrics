-- Migration 005: injury_phases + rehab_sessions
-- Fixes: Rehab Planner phase sync (reads real ACL protocol instead of 5-phase mock)
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ─── injury_phases ────────────────────────────────────────────────────────────
create table if not exists injury_phases (
  id               uuid primary key default gen_random_uuid(),
  injury_id        uuid not null references injuries(id) on delete cascade,
  club_id          uuid references clubs(id),          -- nullable: Injuries.html insert doesn't set it
  phase_number     int not null,
  phase_name       text,
  phase_type       text,
  criteria         text,
  criteria_items   jsonb,
  start_date       date,
  end_date         date,
  duration_days    int generated always as (end_date - start_date) stored,
  status           text not null default 'pending' check (status in ('pending','in_progress','done')),
  actual_start     date,
  actual_end       date,
  completed_by     uuid references profiles(id),
  criteria_completed jsonb,
  revert_log       jsonb,
  notes            text,
  created_at       timestamptz default now()
);

create index if not exists idx_injury_phases_injury on injury_phases(injury_id, phase_number);

alter table injury_phases enable row level security;

drop policy if exists "injury_phases_rw" on injury_phases;
create policy "injury_phases_rw" on injury_phases for all
  using (
    exists (
      select 1 from injuries i
      where i.id = injury_phases.injury_id
        and i.club_id = (select club_id from profiles where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from injuries i
      where i.id = injury_phases.injury_id
        and i.club_id = (select club_id from profiles where id = auth.uid())
    )
  );


-- ─── rehab_sessions ───────────────────────────────────────────────────────────
create table if not exists rehab_sessions (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references rehab_plans(id) on delete cascade,
  club_id      uuid references clubs(id),
  date         date not null,
  name         text,
  color        text,
  duration_min int,
  block_count  int,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_rehab_sessions_plan_date on rehab_sessions(plan_id, date);

alter table rehab_sessions enable row level security;

drop policy if exists "rehab_sessions_rw" on rehab_sessions;
create policy "rehab_sessions_rw" on rehab_sessions for all
  using      (club_id = (select club_id from profiles where id = auth.uid()))
  with check (club_id = (select club_id from profiles where id = auth.uid()));
