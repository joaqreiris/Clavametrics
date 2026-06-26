-- Migration 098: trigger que mantiene players.team_id = la membresía is_primary de player_teams.
-- Blinda el invariante sin importar desde qué pantalla/flujo se toquen las membresías.
-- Idempotente: safe to re-run.

create or replace function public.sync_player_primary_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid := coalesce(NEW.player_id, OLD.player_id);
begin
  update public.players p
    set team_id = (
      select pt.team_id
      from public.player_teams pt
      where pt.player_id = affected and pt.is_primary = true
      limit 1
    )
  where p.id = affected;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_player_primary_team on public.player_teams;
create trigger trg_sync_player_primary_team
  after insert or update or delete on public.player_teams
  for each row execute function public.sync_player_primary_team();
