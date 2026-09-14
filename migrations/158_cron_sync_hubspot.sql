-- 158 — El pipeline se sincroniza solo, de madrugada.
--
-- Hasta acá el CRM se actualizaba apretando un botón. Un dato que depende de que
-- alguien se acuerde envejece igual que el CSV que vinimos a reemplazar.
--
-- La clave de servicio NO va en este archivo (va al repositorio): se guarda en
-- Vault y se lee en tiempo de ejecución. Para dejarlo andando, una sola vez:
--
--   select vault.create_secret('<service_role_key>', 'service_role_key',
--                              'Para que cron_sync_hubspot llame a la Edge Function');

create or replace function public.cron_sync_hubspot()
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
    raise warning 'cron_sync_hubspot: falta el secreto service_role_key en Vault; no se sincroniza';
    return null;
  end if;

  -- Asíncrono: pg_net encola la petición y devuelve un id. El cron no espera a
  -- HubSpot, así que una demora de su lado no deja una transacción abierta.
  select net.http_post(
    url     := 'https://xesrumijvdmqjrufgeka.supabase.co/functions/v1/hubspot-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object('action', 'sync')
  ) into v_id;

  return v_id;
end;
$$;

comment on function public.cron_sync_hubspot() is
  'Dispara hubspot-sync desde pg_cron. Lee la service role key de Vault (secreto service_role_key). Si el secreto no está, avisa y no hace nada.';

revoke all on function public.cron_sync_hubspot() from public, anon, authenticated;

select cron.unschedule('sync-hubspot-nocturno')
 where exists (select 1 from cron.job where jobname = 'sync-hubspot-nocturno');

-- 05:00 UTC: de madrugada en América y temprano en España, así el CRM ya está al
-- día cuando alguien abre la lista a la mañana.
select cron.schedule('sync-hubspot-nocturno', '0 5 * * *', $cron$select public.cron_sync_hubspot()$cron$);
