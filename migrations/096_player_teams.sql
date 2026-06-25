-- Migration 096: junction player_teams para relación muchos-a-muchos player↔team.
-- FASE 1: players.team_id SE CONSERVA como "equipo primario" (denormalizado) para no romper
-- los ~35 archivos que filtran por team_id. La junction es la fuente de verdad de las membresías.
-- is_primary marca cuál membresía es la que se refleja en players.team_id.
-- Idempotente: safe to re-run.

create table if not exists public.player_teams (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id)   on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    uuid not null references public.teams(id)   on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz default now(),
  unique (player_id, team_id)
);

create index if not exists player_teams_club_team_idx on public.player_teams (club_id, team_id);
create index if not exists player_teams_player_idx     on public.player_teams (player_id);

alter table public.player_teams enable row level security;

-- SELECT: cualquier miembro del club ve las membresías de su club.
drop policy if exists player_teams_select on public.player_teams;
create policy player_teams_select on public.player_teams
  for select to authenticated
  using (club_id = public.get_user_club_id());

-- INSERT/UPDATE/DELETE: solo admin/owner/super-admin (mismo criterio que el resto de la app:
-- has_full_planning_access() = is_super_admin() OR profiles.role IN ('admin','owner').
drop policy if exists player_teams_write on public.player_teams;
create policy player_teams_write on public.player_teams
  for all to authenticated
  using (club_id = public.get_user_club_id() and public.has_full_planning_access())
  with check (club_id = public.get_user_club_id() and public.has_full_planning_access());

-- BACKFILL idempotente: una membresía primaria por cada player con team_id NOT NULL.
insert into public.player_teams (club_id, player_id, team_id, is_primary)
select p.club_id, p.id, p.team_id, true
from public.players p
where p.team_id is not null
on conflict (player_id, team_id) do nothing;
