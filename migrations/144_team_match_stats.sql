-- 144 · Match Reports · Estadísticas de EQUIPO por partido (y del rival)
-- ---------------------------------------------------------------------------
-- Problema: `player_match_stats` guarda la línea de cada jugador, pero no había dónde
-- poner lo que pasa a nivel equipo. El export "Team Stats" de Wyscout trae 53 métricas
-- —posesión, xG, PPDA, pases progresivos, y recuperaciones/pérdidas partidas por tercio
-- del campo— y trae DOS filas: la nuestra y la del rival. Sin esta tabla, subir ese
-- Excel no tenía destino: las tres cards de Match Reports seguían vacías y no había
-- forma de mirar cómo evoluciona el equipo de una jornada a la otra.
--
-- `match_results` tiene una columna `possession` suelta y nada más. Ampliarla con 109
-- columnas nuevas no escala: Wyscout cambia su set de métricas entre versiones y cada
-- cambio sería una migración. Por eso las métricas van a un jsonb, igual que el `extra`
-- que `player_match_stats` ya usa para los deportes que no son fútbol.
--
-- Una fila por (partido, lado). El rival se guarda igual que el equipo propio, porque
-- la comparación del partido y la evolución de la temporada lo necesitan.
--
-- Idempotente.

-- 1) La tabla.
create table if not exists public.team_match_stats (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id)         on delete cascade,
  match_id   uuid not null references public.match_results(id) on delete cascade,

  -- 'us' es el equipo del club; 'them', el rival de ese partido.
  side       text not null check (side in ('us', 'them')),

  -- Cómo se llamaba el equipo en el archivo, y con qué dibujó. Se guardan aparte del
  -- jsonb porque se muestran como encabezado de la comparación, no como una métrica.
  team_name  text,
  formation  text,

  -- Las métricas, con clave en snake_case: possession, xg, ppda, progressive_passes,
  -- recoveries_high, losses_low… Números, no textos: quien escribe acá ya parseó.
  stats      jsonb not null default '{}'::jsonb,

  -- De dónde salió la fila: 'wyscout_xlsx' hoy, 'manual' si alguien la editó a mano.
  source     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un partido tiene exactamente un 'us' y un 'them'. Volver a subir el mismo Excel
  -- pisa la fila en lugar de duplicarla.
  constraint team_match_stats_match_side_key unique (match_id, side)
);

-- 2) Índices. El unique de arriba ya cubre las búsquedas por partido; falta la que
--    hace la card de evolución: todas las filas nuestras de un club, por fecha.
create index if not exists team_match_stats_club_side_idx
  on public.team_match_stats (club_id, side);

-- El GIN permite filtrar por una métrica sin traerse el jsonb entero de cada partido.
create index if not exists team_match_stats_stats_gin_idx
  on public.team_match_stats using gin (stats);

-- 3) updated_at, con la misma función que el resto del esquema.
drop trigger if exists team_match_stats_set_updated_at on public.team_match_stats;
create trigger team_match_stats_set_updated_at
  before update on public.team_match_stats
  for each row execute function public.set_updated_at();

-- 4) RLS: mismo patrón que player_match_stats — el club del perfil manda, y la página
--    sigue detrás del feature 'match_reports' del plan.
alter table public.team_match_stats enable row level security;

drop policy if exists team_match_stats_select     on public.team_match_stats;
drop policy if exists team_match_stats_insert     on public.team_match_stats;
drop policy if exists team_match_stats_update     on public.team_match_stats;
drop policy if exists team_match_stats_delete     on public.team_match_stats;
drop policy if exists team_match_stats_plan_gate  on public.team_match_stats;

create policy team_match_stats_select on public.team_match_stats
  for select using (
    club_id in (select profiles.club_id from public.profiles where profiles.id = auth.uid())
  );

create policy team_match_stats_insert on public.team_match_stats
  for insert with check (
    club_id in (select profiles.club_id from public.profiles where profiles.id = auth.uid())
  );

create policy team_match_stats_update on public.team_match_stats
  for update using (
    club_id in (select profiles.club_id from public.profiles where profiles.id = auth.uid())
  ) with check (
    club_id in (select profiles.club_id from public.profiles where profiles.id = auth.uid())
  );

create policy team_match_stats_delete on public.team_match_stats
  for delete using (
    club_id in (select profiles.club_id from public.profiles where profiles.id = auth.uid())
  );

create policy team_match_stats_plan_gate on public.team_match_stats
  for all using (
    is_super_admin() or club_has_feature(get_user_club_id(), 'match_reports')
  ) with check (
    is_super_admin() or club_has_feature(get_user_club_id(), 'match_reports')
  );

comment on table  public.team_match_stats is
  'Estadísticas de equipo por partido, una fila por lado (us/them). Origen habitual: el export Team Stats de Wyscout.';
comment on column public.team_match_stats.stats is
  'Métricas en snake_case → número. Claves conocidas en assets/wyscout-team-stats.js.';
