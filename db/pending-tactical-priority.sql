-- Objetivos principales y secundarios en Tactical Planning.
-- Aplicar en Supabase (SQL Editor). Es idempotente: se puede correr dos veces.
--
-- Un día se sostiene sobre uno o varios objetivos PRINCIPALES; los secundarios
-- acompañan. Todo lo ya cargado era "el objetivo del día", así que entra como
-- principal y ninguna planificación vieja cambia de sentido.
alter table public.tactical_objectives
  add column if not exists priority text not null default 'main';

alter table public.tactical_objectives
  drop constraint if exists tactical_objectives_priority_check;
alter table public.tactical_objectives
  add constraint tactical_objectives_priority_check check (priority in ('main','secondary'));

-- El día se lee siempre en el mismo orden: principales primero.
create index if not exists idx_tactical_objectives_club_team_date_priority
  on public.tactical_objectives using btree (club_id, team_id, date, priority);
