-- migrations/079_activity_log_schema.sql
-- Camino de fondo: auditoría real. SOLO crea tabla, índices, RLS y helper.
-- NO engancha triggers → cero cambio de comportamiento.

create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null,
  team_id      uuid,                       -- null = evento de club / sin categoría
  actor_id     uuid,                       -- profiles.id del staff; null = jugador/integración
  actor_label  text,                       -- fallback sin actor_id (ej. 'GPS sync')
  action       text not null,              -- 'session.published','injury.logged', etc.
  entity_table text not null,
  entity_id    uuid,
  player_id    uuid,                       -- jugador sujeto del evento, si aplica
  summary      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists activity_log_club_created_idx on public.activity_log (club_id, created_at desc);
create index if not exists activity_log_team_idx          on public.activity_log (team_id);
-- GPS: una fila por sesión por día (no un archivo por jugador)
create unique index if not exists activity_log_gps_session_day_uidx
  on public.activity_log (entity_id, ((created_at at time zone 'UTC')::date))
  where action = 'gps.imported';

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (
    club_id = (select club_id from public.profiles where id = auth.uid())
    and (
      exists (select 1 from public.profiles pr where pr.id = auth.uid()
              and (pr.role in ('admin','owner') or pr.club_role in ('admin','owner')))
      or team_id is null
      or team_id in (select public.my_team_ids())
    )
  );
-- Sin policies de insert/update/delete: el front no escribe. Solo los triggers (definer).

create or replace function public.activity_team_for_player(p_player uuid)
returns uuid language sql stable security definer set search_path to 'public'
as $$ select team_id from public.players where id = p_player $$;
