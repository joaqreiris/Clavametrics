-- ============================================================================
-- 051_programme_phases.sql
-- Fases de programa para planes preventivos del Rehab Planner.
-- Organizadas por semanas. Scoped por club_id (mismo patrón club-scoped que
-- videos/tasks: FK a clubs, RLS vía profiles). Idempotente.
--
-- CÓMO CORRER: en el SQL Editor, primero DEV. Validá, y después PROD.
-- ============================================================================

create table if not exists public.programme_phases (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  name          text not null,
  description   text,
  start_week    integer not null default 1,        -- semana de inicio (1-based)
  duration_weeks integer not null default 1,        -- cuántas semanas dura la fase
  display_order integer not null default 0,         -- orden de la fase en el programa
  color         text,                               -- color opcional para la phasebar
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_programme_phases_club on public.programme_phases(club_id);

alter table public.programme_phases enable row level security;

drop policy if exists "programme_phases select club" on public.programme_phases;
create policy "programme_phases select club"
  on public.programme_phases for select
  using (club_id in (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "programme_phases insert club" on public.programme_phases;
create policy "programme_phases insert club"
  on public.programme_phases for insert
  with check (club_id in (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "programme_phases update club" on public.programme_phases;
create policy "programme_phases update club"
  on public.programme_phases for update
  using      (club_id in (select club_id from public.profiles where id = auth.uid()))
  with check (club_id in (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "programme_phases delete club" on public.programme_phases;
create policy "programme_phases delete club"
  on public.programme_phases for delete
  using (club_id in (select club_id from public.profiles where id = auth.uid()));
