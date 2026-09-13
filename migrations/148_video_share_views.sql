-- Control de visionado de los cortes que se le mandan a un jugador.
--
-- Hasta ahora el cuerpo técnico sabía tres cosas de un envío: si el link se abrió
-- (video_shares.opened_at / open_count) y si el jugador pulsó "marcar como visto"
-- (seen_at). Las dos son de grano grueso: un envío con cinco cortes se abre una
-- vez y se marca una vez, así que "vio los cinco" y "abrió, miró diez segundos del
-- primero y cerró" quedaban idénticos. Esta tabla agrega el grano que faltaba: UNA
-- FILA POR (envío, corte), con cuánto se reprodujo y hasta dónde se llegó.
--
-- ── Qué se puede medir de verdad ───────────────────────────────────────────────
-- Los cortes se reproducen dentro de video-share.html, pero el archivo vive en el
-- Dropbox / Drive / YouTube del club, así que la precisión depende del reproductor:
--
--   tracking = 'player'    Dropbox y cualquier archivo directo (<video> propio),
--                          YouTube (IFrame API) y Vimeo (Player SDK). Tiempo de
--                          reproducción real, posición máxima y fin del video.
--   tracking = 'viewport'  Google Drive (su /preview no expone ninguna API) y todo
--                          lo que caiga en el fallback. Sólo se puede medir cuánto
--                          tiempo estuvo ese corte a la vista con la pestaña activa
--                          (visible_seconds). NO prueba que se haya reproducido.
--
-- La columna `tracking` existe justamente para que la UI no mezcle las dos cosas:
-- "vio el 95%" (medido) y "estuvo 40 s en pantalla" (estimado) no son el mismo dato
-- y presentarlos igual sería mentir en un reporte que puede terminar en una charla
-- con el jugador.
--
-- ── Por qué el dato es indicativo y no prueba ─────────────────────────────────
-- Todo esto lo reporta el navegador del jugador: con las herramientas de desarrollo
-- se puede falsear, y dejar el video corriendo en una pestaña no es haber prestado
-- atención. Sirve para separar al que no abrió del que miró todo, no para sancionar
-- a alguien por un 85%.
--
-- ── Idempotencia (last_session_*) ─────────────────────────────────────────────
-- La página manda un heartbeat cada pocos segundos con el ACUMULADO de la apertura
-- en curso, no con incrementos: un beat perdido o repetido no descuadra la cuenta.
-- Para poder sumarlo a lo de aperturas anteriores, la fila recuerda cuánto aportó la
-- última sesión (last_session_id + sus contadores) y la función descuenta ese aporte
-- antes de sumar el nuevo valor. Cuando llega una sesión distinta, lo de la anterior
-- ya quedó consolidado y el contador de sesión vuelve a cero.
--
-- Aditiva: no toca video_shares ni video_share_items, y nada de lo que ya existe
-- cambia de comportamiento.

create table if not exists public.video_share_views (
  share_id              uuid not null references public.video_shares(id) on delete cascade,
  video_id              uuid not null references public.videos(id)       on delete cascade,

  first_played_at       timestamptz,          -- primera reproducción (NULL si nunca se reprodujo)
  last_played_at        timestamptz,
  play_count            integer not null default 0,

  watched_seconds       integer not null default 0,   -- reproducción REAL acumulada (los saltos no suman)
  max_position_seconds  integer not null default 0,   -- hasta qué segundo del video llegó
  duration_seconds      integer,                      -- la que reporta el reproductor
  completed             boolean not null default false, -- evento 'ended' o >= 90% del video

  visible_seconds       integer not null default 0,   -- fallback: tiempo en pantalla con la pestaña activa
  tracking              text not null default 'viewport'
                          check (tracking in ('player', 'viewport')),

  -- Aporte de la apertura en curso, para que el heartbeat sea idempotente (ver arriba).
  last_session_id       text,
  last_session_watched  integer not null default 0,
  last_session_visible  integer not null default 0,
  last_session_plays    integer not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint video_share_views_pkey primary key (share_id, video_id)
);

comment on table public.video_share_views is
  'Visionado por corte de un envío a un jugador (grano: envío × video). La escribe la Edge Function share-video con service role; el jugador no tiene cuenta. Ver tracking para saber si el dato es medido o estimado.';
comment on column public.video_share_views.tracking is
  '''player'' = tiempo de reproducción real (Dropbox/archivo, YouTube, Vimeo). ''viewport'' = sólo tiempo en pantalla (Google Drive y fallbacks): NO prueba reproducción.';
comment on column public.video_share_views.watched_seconds is
  'Segundos de reproducción efectiva acumulados. Los saltos de posición no suman, así que arrastrar la barra hasta el final no infla el número.';

-- El panel de Enviados trae los visionados de todos los envíos de un batch a la vez.
create index if not exists idx_video_share_views_share on public.video_share_views(share_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Herencia pura del envío padre: el EXISTS respeta la RLS de video_shares, así que
-- quien puede ver el envío puede ver su visionado y nadie más. Sólo SELECT: las
-- escrituras entran por la Edge Function (service role), nunca desde el navegador
-- del staff, y el jugador ni siquiera tiene sesión.
alter table public.video_share_views enable row level security;

drop policy if exists "video_share_views select via share" on public.video_share_views;
create policy "video_share_views select via share"
  on public.video_share_views for select
  using (exists (select 1 from public.video_shares s where s.id = video_share_views.share_id));

drop policy if exists "video_share_views_super_all" on public.video_share_views;
create policy "video_share_views_super_all"
  on public.video_share_views for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Upsert idempotente ────────────────────────────────────────────────────────
-- La Edge Function podría hacer read-modify-write, pero son dos viajes por corte y
-- por heartbeat, y con dos pestañas abiertas se pisan. Acá es una sola sentencia
-- atómica: el ON CONFLICT hace toda la aritmética contra la fila existente.
--
-- p_session: identificador de la apertura en curso (lo genera la página). Si coincide
-- con last_session_id, se descuenta lo que esa misma sesión ya había aportado; si es
-- otro, lo anterior queda consolidado.
--
-- Los valores llegan del navegador: el caller (la Edge Function) ya los acota contra
-- la duración del video. Acá se protege lo estructural — nada negativo, y los
-- máximos nunca retroceden.
create or replace function public.record_video_share_view(
  p_share_id  uuid,
  p_video_id  uuid,
  p_session   text,
  p_watched   integer,
  p_position  integer,
  p_duration  integer,
  p_completed boolean,
  p_visible   integer,
  p_plays     integer,
  p_tracking  text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.video_share_views as v (
    share_id, video_id,
    first_played_at, last_played_at, play_count,
    watched_seconds, max_position_seconds, duration_seconds, completed,
    visible_seconds, tracking,
    last_session_id, last_session_watched, last_session_visible, last_session_plays,
    updated_at
  )
  values (
    p_share_id, p_video_id,
    case when coalesce(p_plays, 0) > 0 then now() end,
    case when coalesce(p_plays, 0) > 0 then now() end,
    greatest(coalesce(p_plays, 0), 0),
    greatest(coalesce(p_watched, 0), 0),
    greatest(coalesce(p_position, 0), 0),
    nullif(greatest(coalesce(p_duration, 0), 0), 0),
    coalesce(p_completed, false),
    greatest(coalesce(p_visible, 0), 0),
    case when p_tracking = 'player' then 'player' else 'viewport' end,
    p_session,
    greatest(coalesce(p_watched, 0), 0),
    greatest(coalesce(p_visible, 0), 0),
    greatest(coalesce(p_plays, 0), 0),
    now()
  )
  on conflict (share_id, video_id) do update set
    -- Lo aportado por esta misma sesión se descuenta antes de volver a sumarlo.
    watched_seconds = greatest(
      v.watched_seconds
        - (case when v.last_session_id is not distinct from p_session then v.last_session_watched else 0 end)
        + greatest(coalesce(p_watched, 0), 0), 0),
    visible_seconds = greatest(
      v.visible_seconds
        - (case when v.last_session_id is not distinct from p_session then v.last_session_visible else 0 end)
        + greatest(coalesce(p_visible, 0), 0), 0),
    play_count = greatest(
      v.play_count
        - (case when v.last_session_id is not distinct from p_session then v.last_session_plays else 0 end)
        + greatest(coalesce(p_plays, 0), 0), 0),

    -- Los máximos y el "llegó al final" no retroceden nunca.
    max_position_seconds = greatest(v.max_position_seconds, greatest(coalesce(p_position, 0), 0)),
    completed            = v.completed or coalesce(p_completed, false),
    duration_seconds     = coalesce(nullif(greatest(coalesce(p_duration, 0), 0), 0), v.duration_seconds),

    -- Una vez que un corte se midió con reproductor, no vuelve a bajar a estimado
    -- (el mismo jugador puede reabrir el link en un navegador donde el SDK no cargue).
    tracking = case when v.tracking = 'player' or p_tracking = 'player' then 'player' else 'viewport' end,

    first_played_at = case
      when v.first_played_at is not null then v.first_played_at
      when coalesce(p_plays, 0) > 0      then now()
    end,
    last_played_at = case when coalesce(p_plays, 0) > 0 then now() else v.last_played_at end,

    last_session_id      = p_session,
    last_session_watched = greatest(coalesce(p_watched, 0), 0),
    last_session_visible = greatest(coalesce(p_visible, 0), 0),
    last_session_plays   = greatest(coalesce(p_plays, 0), 0),
    updated_at           = now();
$$;

comment on function public.record_video_share_view is
  'Upsert idempotente de un heartbeat de visionado. p_watched/p_visible/p_plays son el ACUMULADO de la apertura en curso (p_session), no incrementos. La llama la Edge Function share-video con service role.';

-- La función es SECURITY DEFINER y la llama sólo el service role: nadie con sesión
-- de navegador (ni el staff, ni un anónimo con el token) puede ejecutarla.
revoke all on function public.record_video_share_view(uuid, uuid, text, integer, integer, integer, boolean, integer, integer, text) from public;
revoke all on function public.record_video_share_view(uuid, uuid, text, integer, integer, integer, boolean, integer, integer, text) from anon;
revoke all on function public.record_video_share_view(uuid, uuid, text, integer, integer, integer, boolean, integer, integer, text) from authenticated;
