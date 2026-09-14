-- 154 — Los pedidos de demo dejan de morir en un mail.
--
-- El formulario de Contact.html postea a Formspree desde mayo: el pedido llega
-- como correo a una casilla y ahí termina. No queda registro, nadie sabe si se
-- contestó, y el dato —quién nos buscó y desde qué campaña— no es nuestro.
--
-- Un lead no es un club: todavía no tiene cuenta, así que no puede colgar de
-- `clubs`. Cuando se registre, el cruce se hace por email.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Lo que escribe la persona
  name          text not null,
  email         text not null,
  phone         text,
  club_name     text,
  role          text,
  sport         text,
  size          text,
  message       text,
  lang          text,          -- idioma en el que vio la página: en qué idioma contestarle

  -- De dónde vino (lo mismo que se guarda en clubs al registrarse)
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  referrer      text,
  landing_page  text,

  -- Gestión
  status        text not null default 'new'
                check (status in ('new','contacted','qualified','discarded')),
  note          text,
  handled_at    timestamptz,
  handled_by    uuid references auth.users(id) on delete set null,

  -- Anti-abuso. Hash con sal, nunca la IP en claro: para frenar a un bot alcanza
  -- con saber que dos envíos vienen del mismo lado, no de dónde exactamente.
  ip_hash       text
);

comment on table public.leads is
  'Pedidos de demo desde la web pública. Los escribe la Edge Function submit-lead con service role; el formulario no toca la tabla directamente.';
comment on column public.leads.ip_hash is
  'SHA-256 de la IP con sal del servidor. Solo para limitar envíos repetidos; no permite recuperar la IP.';

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx  on public.leads (status) where status = 'new';
create index if not exists leads_email_idx   on public.leads (lower(email));

alter table public.leads enable row level security;

-- Lectura y gestión: solo platform admins. El INSERT no tiene policy a propósito —
-- lo hace la Edge Function con service role, que se salta RLS. Una policy de insert
-- para anon convertiría la tabla en un buzón abierto: cualquiera con la clave
-- publicable podría escribir filas sin pasar por la validación ni el límite de envíos.
drop policy if exists leads_admin_select on public.leads;
create policy leads_admin_select on public.leads
  for select to authenticated using (public.is_platform_admin());

drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_update on public.leads
  for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists leads_admin_delete on public.leads;
create policy leads_admin_delete on public.leads
  for delete to authenticated using (public.is_platform_admin());
