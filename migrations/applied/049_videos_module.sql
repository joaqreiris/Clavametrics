-- ============================================================================
-- 049_videos_module.sql
-- Modelo de datos del módulo "Video Room".
--
-- IMPORTANTE: ClavaMetrics NO almacena los videos. El archivo vive en el
-- Google Drive / Dropbox del club; acá guardamos el VÍNCULO (url + provider) y
-- el CONTEXTO (a qué sesión / jugador(es) / partido está asociado).
--
-- Patrón de seguridad: idéntico al de tasks (046). Aislamiento por club y por
-- equipo vía my_team_ids() + has_full_planning_access(). Las tablas puente
-- heredan la visibilidad del video padre (EXISTS sobre videos -> respeta su RLS).
--
-- CÓMO CORRER: en el SQL Editor, primero DEV. Validá, y después PROD.
-- Numeración: la carpeta migrations/ tiene duplicados (044/045) y va por 048;
-- uso 049 para no chocar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabla principal: videos (link + metadata, NO el archivo)
-- ----------------------------------------------------------------------------
create table if not exists public.videos (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  team_id          uuid references public.teams(id) on delete set null,
  title            text not null,
  provider         text not null default 'google_drive'
                     check (provider in ('google_drive','dropbox','other')),
  url              text not null,                 -- link al archivo en Drive/Dropbox
  external_id      text,                          -- id del archivo en el proveedor (opcional)
  thumbnail_url    text,                          -- miniatura (opcional)
  duration_seconds integer,                       -- duración (opcional)
  notes            text,
  uploaded_by      uuid not null,                 -- auth.uid()
  uploaded_by_name text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_videos_club        on public.videos(club_id);
create index if not exists idx_videos_team         on public.videos(team_id);
create index if not exists idx_videos_uploaded_by  on public.videos(uploaded_by);

alter table public.videos enable row level security;

-- SELECT: club + (acceso total | mi equipo | la subí yo)
drop policy if exists "videos select team-scoped" on public.videos;
create policy "videos select team-scoped"
  on public.videos for select
  using (
    club_id in (select club_id from public.profiles where id = auth.uid())
    and (
      public.has_full_planning_access()
      or team_id in (select public.my_team_ids())
      or uploaded_by = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: scopeadas por club (igual que tasks; las afinamos a
-- equipo más adelante si hace falta). El INSERT exige que el video sea del club
-- del usuario.
drop policy if exists "videos insert club" on public.videos;
create policy "videos insert club"
  on public.videos for insert
  with check (club_id in (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "videos update club" on public.videos;
create policy "videos update club"
  on public.videos for update
  using      (club_id in (select club_id from public.profiles where id = auth.uid()))
  with check (club_id in (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "videos delete club" on public.videos;
create policy "videos delete club"
  on public.videos for delete
  using (club_id in (select club_id from public.profiles where id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 2) Tablas puente (vínculos N:N). Cada una hereda visibilidad del video padre.
--    Targets reales confirmados en el código:
--      sesión  -> training_sessions
--      jugador -> players
--      partido -> calendar_events  (los partidos viven ahí; ver nota al final)
-- ----------------------------------------------------------------------------

-- video <-> sesión de entrenamiento
create table if not exists public.video_sessions (
  video_id   uuid not null references public.videos(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, session_id)
);
create index if not exists idx_video_sessions_session on public.video_sessions(session_id);

-- video <-> jugador
create table if not exists public.video_players (
  video_id   uuid not null references public.videos(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, player_id)
);
create index if not exists idx_video_players_player on public.video_players(player_id);

-- video <-> partido (evento de calendario tipo match)
create table if not exists public.video_matches (
  video_id   uuid not null references public.videos(id) on delete cascade,
  event_id   uuid not null references public.calendar_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, event_id)
);
create index if not exists idx_video_matches_event on public.video_matches(event_id);

-- RLS de las puente: visibles/editables si el usuario puede ver el video padre.
-- (El EXISTS sobre videos respeta la RLS de videos -> herencia automática.)
alter table public.video_sessions enable row level security;
alter table public.video_players  enable row level security;
alter table public.video_matches  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['video_sessions','video_players','video_matches'] loop
    execute format('drop policy if exists "%s rw via video" on public.%I;', t, t);
    execute format($f$
      create policy "%s rw via video" on public.%I
      for all
      using      (exists (select 1 from public.videos v where v.id = video_id))
      with check (exists (select 1 from public.videos v where v.id = video_id));
    $f$, t, t);
  end loop;
end $$;

-- ============================================================================
-- NOTA — "partido" = calendar_events
-- Los partidos en ClavaMetrics viven en calendar_events (la app los consulta
-- 28x; el "vs Crotenlo FC" sale de ahí). Por eso video_matches referencia
-- calendar_events(id). Si preferís anclar al módulo Match reports en su lugar
-- (match_reports), avisá y cambiamos el FK — es un solo cambio.
--
-- VALIDACIÓN (corré aparte):
--   -- insertar un video de prueba y vincularlo
--   -- y confirmar que un usuario de OTRO equipo no lo ve (RLS por team_id).
-- ============================================================================
