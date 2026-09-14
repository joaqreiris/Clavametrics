-- 159 — Registro de los mails que acompañan una prueba.
--
-- La clave única es (club_id, kind): si mañana el cron vuelve a encontrar al mismo
-- club en la misma situación, el insert choca y no se manda de nuevo. Un
-- recordatorio repetido no molesta: quema la cuenta.

create table if not exists public.trial_emails (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  kind       text not null check (kind in ('d2_sin_plantel','d7_frenado','d12_propuesta','d15_vence')),
  email      text not null,
  lang       text,
  resend_id  text,
  status     text not null default 'sent',
  error      text,
  created_at timestamptz not null default now(),
  unique (club_id, kind)
);

comment on table public.trial_emails is
  'Un renglón por mail de acompañamiento enviado. El unique (club_id, kind) es el que garantiza que nadie reciba dos veces el mismo aviso.';

alter table public.trial_emails enable row level security;

drop policy if exists trial_emails_admin_select on public.trial_emails;
create policy trial_emails_admin_select on public.trial_emails
  for select to authenticated using (public.is_platform_admin());

-- Quien pide que no le escribamos más deja de recibir, aunque sean avisos de
-- servicio. Se marca a mano: con este volumen, una baja es una conversación.
alter table public.clubs
  add column if not exists trial_emails_opt_out boolean not null default false;

comment on column public.clubs.trial_emails_opt_out is
  'Si es true, el club no recibe los mails de acompañamiento de la prueba. Se marca cuando alguien pide la baja.';
