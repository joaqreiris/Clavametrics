-- 161 — La cadencia de mails corre sola, a media mañana.
--
-- Igual que el sync del CRM: la clave de servicio se lee de Vault, no va en el
-- archivo. Ver 158 para el comando que la guarda.

create or replace function public.cron_trial_emails()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text;
  v_id  bigint;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_key is null then
    raise warning 'cron_trial_emails: falta el secreto service_role_key en Vault; no se manda nada';
    return null;
  end if;

  select net.http_post(
    url     := 'https://xesrumijvdmqjrufgeka.supabase.co/functions/v1/trial-emails',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object('action', 'send')
  ) into v_id;

  return v_id;
end;
$$;

comment on function public.cron_trial_emails() is
  'Dispara la cadencia de mails de la prueba. La Edge Function decide a quién le toca y no repite: el unique (club_id, kind) de trial_emails lo impide.';

revoke all on function public.cron_trial_emails() from public, anon, authenticated;

select cron.unschedule('trial-emails-diario')
 where exists (select 1 from cron.job where jobname = 'trial-emails-diario');

-- 13:00 UTC: media mañana en Uruguay, primera hora de la tarde en España. Un mail
-- que llega de madrugada queda sepultado bajo el resto del día.
select cron.schedule('trial-emails-diario', '0 13 * * *', $cron$select public.cron_trial_emails()$cron$);
