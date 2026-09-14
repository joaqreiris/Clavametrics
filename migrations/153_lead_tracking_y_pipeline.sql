-- 153 — Seguimiento comercial de los clubes en prueba.
--
-- Tres cosas que hoy no existen y que la campaña necesita desde el día uno:
--   1. de dónde vino el club (atribución de la campaña),
--   2. si el que se registró aceptó que lo contactemos,
--   3. una lectura única del estado de cada prueba para el equipo de ventas.
--
-- El teléfono ya vive en profiles.phone; lo que falta es pedirlo en el registro
-- (eso va en Register.html) y el consentimiento explícito, que es un dato propio:
-- aceptar los Términos no es aceptar que te llamen.

/* ── 1. Atribución del club ───────────────────────────────────────────────
   Columnas sueltas y no un jsonb: la pregunta que se hace todos los días es
   "¿cuántos clubes trajo cada canal?", y eso es un group by, no un ->>.
   First-touch: se escriben al crear el club y no se vuelven a tocar.        */
alter table public.clubs
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists utm_term     text,
  add column if not exists referrer     text,
  add column if not exists landing_page text;

comment on column public.clubs.utm_source is
  'Atribución first-touch de la campaña, capturada en la primera visita (assets/lead-source.js) y persistida al crear el club. No se sobrescribe.';

/* ── 2. Consentimiento comercial ──────────────────────────────────────────
   Separado del checkbox de Términos a propósito: hay clubes en España, y el
   RGPD pide que el consentimiento de marketing sea una acción aparte. Sin la
   fecha no se puede demostrar cuándo se dio, así que va junto.              */
alter table public.profiles
  add column if not exists marketing_opt_in    boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz;

comment on column public.profiles.marketing_opt_in is
  'Consentimiento explícito para contacto comercial, pedido aparte de los Términos. Si es false, ventas puede dar soporte pero no prospectar.';

/* ── 3. La lectura que usa ventas ─────────────────────────────────────────
   Una fila por club con contacto, origen, estado de la prueba y uso real.

   Dos decisiones que importan:
   · trial_ends_at puede ser NULL (los clubes anteriores al default de 15 días).
     Un club sin fecha NO desaparece de la lista: sale con stage 'no_trial' y
     days_left NULL. Filtrar por fecha acá sería esconder cuentas reales.
   · health mide uso, no calendario. Un club sin jugadores cargados está muerto
     aunque le queden 14 días, y ese es justamente el que hay que llamar hoy.  */
-- Con OUT params cambiando entre versiones, `create or replace` falla (42P13).
drop function if exists public.sales_pipeline();
create function public.sales_pipeline()
returns table (
  club_id           uuid,
  club_name         text,
  country           text,
  sport             text,
  created_at        timestamptz,
  trial_ends_at     timestamptz,
  days_left         integer,
  stage             text,
  health            text,
  plan              text,
  is_comp           boolean,
  onboarded_at      timestamptz,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  referrer          text,
  landing_page      text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  contact_job       text,
  marketing_opt_in  boolean,
  users             integer,
  players           integer,
  teams             integer,
  sessions          integer,
  wellness_entries  integer,
  gps_reports       integer,
  events_7d         integer,
  active_users_7d   integer,
  last_activity_at  timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- Guard explícito: sin esto, un usuario cualquiera recibiría una lista vacía y
  -- "no hay clubes" se confunde con "no tenés permiso".
  if not public.is_platform_admin() then
    raise exception 'sales_pipeline: solo platform admins' using errcode = '42501';
  end if;

  return query
  with contacto as (
    -- El dueño de la cuenta: owner si existe, si no el admin, si no el más antiguo.
    select distinct on (p.club_id)
           p.club_id,
           coalesce(nullif(trim(p.full_name), ''),
                    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')) as nombre,
           p.email, p.phone, p.job_title, p.marketing_opt_in
      from public.profiles p
     order by p.club_id,
              case p.role when 'owner' then 0 when 'admin' then 1 else 2 end,
              p.created_at asc nulls last
  ),
  uso as (
    select c.id as club_id,
           (select count(*) from public.profiles          x where x.club_id = c.id)                             as users,
           -- Uso de la última semana desde activity_log. profiles.last_seen_at existe
           -- pero está NULL en las 25 filas de la tabla: nadie la escribe, así que
           -- contarla daría 0 para todos, incluidos los clubes que entran a diario.
           (select count(*) from public.activity_log x where x.club_id = c.id
                                                       and x.created_at > now() - interval '7 days')            as events_7d,
           -- Cuántas personas distintas, para separar "el club lo usa" de "lo usa uno solo".
           -- Subestima: activity_log sólo trae actor_id en parte de sus filas.
           (select count(distinct x.actor_id) from public.activity_log x where x.club_id = c.id
                                                       and x.actor_id is not null
                                                       and x.created_at > now() - interval '7 days')            as active_users_7d,
           (select count(*) from public.players           x where x.club_id = c.id and x.archived_at is null)   as players,
           (select count(*) from public.teams             x where x.club_id = c.id and x.archived_at is null)   as teams,
           (select count(*) from public.training_sessions x where x.club_id = c.id)                             as sessions,
           (select count(*) from public.wellness          x where x.club_id = c.id)                             as wellness_entries,
           (select count(*) from public.gps_reports       x where x.club_id = c.id)                             as gps_reports,
           (select max(x.created_at) from public.activity_log x where x.club_id = c.id)                         as last_activity_at
      from public.clubs c
  ),
  sub as (
    -- Una suscripción viva en cualquier equipo del club alcanza para que sea cliente.
    select distinct on (s.club_id) s.club_id, s.is_comp
      from public.subscriptions s
     where s.status = 'active'
     order by s.club_id, s.is_comp asc   -- una paga manda sobre una de cortesía
  )
  select c.id,
         c.name,
         c.country,
         c.sport,
         c.created_at,
         c.trial_ends_at,
         case when c.trial_ends_at is null then null
              else (c.trial_ends_at::date - current_date) end                    as days_left,
         case when sub.club_id is not null                     then 'customer'
              when c.trial_ends_at is null                     then 'no_trial'
              when c.trial_ends_at >= now()                    then 'trial'
              else                                                  'expired'
         end                                                                     as stage,
         case when u.players = 0                                          then 'cold'
              when u.sessions = 0                                         then 'warm'
              when u.last_activity_at is null
                or u.last_activity_at < now() - interval '7 days'          then 'warm'
              else                                                             'active'
         end                                                                     as health,
         c.plan,
         coalesce(sub.is_comp, false),
         c.onboarded_at,
         c.utm_source, c.utm_medium, c.utm_campaign, c.referrer, c.landing_page,
         k.nombre, k.email, k.phone, k.job_title,
         coalesce(k.marketing_opt_in, false),
         u.users::int, u.players::int, u.teams::int, u.sessions::int,
         u.wellness_entries::int, u.gps_reports::int, u.events_7d::int, u.active_users_7d::int,
         u.last_activity_at
    from public.clubs c
    join uso            u   on u.club_id   = c.id
    left join contacto  k   on k.club_id   = c.id
    left join sub           on sub.club_id = c.id
   order by c.created_at desc;
end;
$$;

comment on function public.sales_pipeline() is
  'Una fila por club para el seguimiento comercial: contacto, origen de campaña, estado de la prueba y uso real. Solo platform admins.';

revoke all on function public.sales_pipeline() from public, anon;
grant execute on function public.sales_pipeline() to authenticated;
