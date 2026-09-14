-- 155 — El pipeline, también para la sincronización con el CRM.
--
-- sales_pipeline() exige platform admin: mira auth.uid(). La Edge Function que
-- empuja los datos a HubSpot corre con service role, donde auth.uid() es NULL, así
-- que la misma función que usa la pantalla le contestaría "42501: solo platform
-- admins".
--
-- En vez de duplicar el cálculo (que es justo la parte que no se puede permitir
-- divergir: si la pantalla dice "frenado" y el CRM dice "lo usa", no hay forma de
-- saber cuál mirar), se parte en dos:
--   · sales_pipeline_rows() — el cálculo, sin guard, y SOLO para service_role.
--   · sales_pipeline()      — el guard de platform admin y nada más.

drop function if exists public.sales_pipeline_rows();

create function public.sales_pipeline_rows()
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
language sql
stable
security definer
set search_path to 'public'
as $$
  with contacto as (
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
           (select count(*) from public.activity_log x where x.club_id = c.id
                                                       and x.created_at > now() - interval '7 days')            as events_7d,
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
    select distinct on (s.club_id) s.club_id, s.is_comp
      from public.subscriptions s
     where s.status = 'active'
     order by s.club_id, s.is_comp asc
  )
  select c.id,
         c.name,
         c.country,
         c.sport,
         c.created_at,
         c.trial_ends_at,
         case when c.trial_ends_at is null then null
              else (c.trial_ends_at::date - current_date) end,
         case when sub.club_id is not null  then 'customer'
              when c.trial_ends_at is null  then 'no_trial'
              when c.trial_ends_at >= now() then 'trial'
              else                               'expired'
         end,
         case when u.players = 0                                   then 'cold'
              when u.sessions = 0                                  then 'warm'
              when u.last_activity_at is null
                or u.last_activity_at < now() - interval '7 days'   then 'warm'
              else                                                      'active'
         end,
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
$$;

comment on function public.sales_pipeline_rows() is
  'El cálculo del pipeline comercial, sin control de acceso. Solo service_role: la llama la Edge Function hubspot-sync. Para la app está sales_pipeline(), que es esta con el guard de platform admin.';

-- Nadie más que el service role. Sin esto sería un agujero: cualquier usuario
-- autenticado vería los datos de contacto de todos los clubes de la plataforma.
revoke all on function public.sales_pipeline_rows() from public, anon, authenticated;
grant execute on function public.sales_pipeline_rows() to service_role;

-- La función de la app pasa a ser el guard y nada más.
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
  if not public.is_platform_admin() then
    raise exception 'sales_pipeline: solo platform admins' using errcode = '42501';
  end if;
  return query select * from public.sales_pipeline_rows();
end;
$$;
