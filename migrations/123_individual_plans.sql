-- 123_individual_plans.sql
-- Extend the existing individual_plans (block-based S&C model) with rehab-style
-- programme fields (multi-week + content jsonb + shareable link) and add phases.
-- Idempotent. individual_plans / individual_plan_blocks / individual_block_completions
-- already exist; we only ADD columns + a new phases table.

-- 1) New columns on the existing plan
alter table public.individual_plans add column if not exists goal                  text;
alter table public.individual_plans add column if not exists programme_week         integer default 1;
alter table public.individual_plans add column if not exists programme_total_weeks  integer default 1;
alter table public.individual_plans add column if not exists content                jsonb not null default '{}'::jsonb;  -- blocks/exercises per day (same shape rehab uses)
alter table public.individual_plans add column if not exists share_token            uuid default gen_random_uuid();      -- for the shareable player link
alter table public.individual_plans add column if not exists shared                 boolean not null default false;

-- unique share_token (idempotent via unique index)
create unique index if not exists idx_individual_plans_share_token
  on public.individual_plans(share_token);

-- 2) The phases (mirror programme_phases)
create table if not exists public.individual_plan_phases (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  plan_id     uuid not null references public.individual_plans(id) on delete cascade,
  name        text not null,
  week_start  integer not null default 1,
  week_end    integer not null default 1,
  color       text,
  objective   text,
  load_level  text,                                 -- low / moderate / high
  phase_order integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_ip_phases_club on public.individual_plan_phases(club_id);
create index if not exists idx_ip_phases_plan on public.individual_plan_phases(plan_id);

-- 3) RLS (club-scoped, same pattern as the rest of the app)
alter table public.individual_plan_phases enable row level security;

drop policy if exists ipp_select on public.individual_plan_phases;
create policy ipp_select on public.individual_plan_phases for select
  using (club_id in (select club_id from public.profiles where id = auth.uid()));
drop policy if exists ipp_insert on public.individual_plan_phases;
create policy ipp_insert on public.individual_plan_phases for insert
  with check (club_id in (select club_id from public.profiles where id = auth.uid()));
drop policy if exists ipp_update on public.individual_plan_phases;
create policy ipp_update on public.individual_plan_phases for update
  using (club_id in (select club_id from public.profiles where id = auth.uid()));
drop policy if exists ipp_delete on public.individual_plan_phases;
create policy ipp_delete on public.individual_plan_phases for delete
  using (club_id in (select club_id from public.profiles where id = auth.uid()));

-- 4) keep updated_at fresh on phases (reuse existing trigger fn)
drop trigger if exists individual_plan_phases_updated_at on public.individual_plan_phases;
create trigger individual_plan_phases_updated_at before update on public.individual_plan_phases
  for each row execute function set_updated_at();
