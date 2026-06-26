-- 068_player_scouting_summary.sql
-- Free-text scouting/sales note per player, shown in the player dossier.
alter table public.players add column if not exists scouting_summary text;
comment on column public.players.scouting_summary is 'Free-text scouting/sales note shown in the player dossier.';
-- No RLS/grants changes: inherits existing players policies.
