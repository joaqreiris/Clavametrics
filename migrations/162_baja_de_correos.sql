-- 162 — Un enlace para darse de baja, sin trámite.
--
-- Pedir que alguien responda "BAJA" para dejar de recibir correos es ponerle un
-- trámite a lo único que siempre debería ser fácil. Con un token propio por club,
-- el enlace del pie funciona de un clic y sin sesión — y la misma dirección sirve
-- para el botón "Cancelar suscripción" que Gmail y Outlook ponen ellos mismos.

alter table public.clubs
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists clubs_unsubscribe_token_idx on public.clubs (unsubscribe_token);

comment on column public.clubs.unsubscribe_token is
  'Token del enlace "darse de baja" de los correos de la prueba. Lo consume la Edge Function email-unsubscribe, sin sesión.';

create or replace function public.unsubscribe_trial_emails(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_club record;
begin
  select id, name, trial_emails_opt_out into v_club
    from public.clubs where unsubscribe_token = p_token;

  -- Sin detalle en el error: no hay nada que ganar diciéndole "ese token no existe"
  -- a quien esté probando tokens al azar.
  if v_club is null then
    return jsonb_build_object('ok', false, 'error', 'token_desconocido');
  end if;

  update public.clubs set trial_emails_opt_out = true where id = v_club.id;

  -- Idempotente a propósito: si alguien abre el enlace dos veces, la segunda no es
  -- un error. Y el buzón llama a este endpoint por su cuenta al pulsar su botón.
  return jsonb_build_object('ok', true, 'club', v_club.name,
                            'ya_estaba', coalesce(v_club.trial_emails_opt_out, false));
end;
$$;

revoke all on function public.unsubscribe_trial_emails(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_trial_emails(uuid) to service_role;
