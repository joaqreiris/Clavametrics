-- Migration 073: estado honesto "configured" (credencial guardada ≠ verificada)
-- 'connected' se reserva para cuando un handler valide el token contra la API real.

-- 1. permitir 'configured' en el CHECK
alter table public.gps_integrations drop constraint if exists gps_integrations_status_check;
alter table public.gps_integrations add constraint gps_integrations_status_check
  check (status in ('pending','configured','connected','error','disabled'));

-- 2. set_gps_credential ahora marca 'configured', no 'connected'
create or replace function public.set_gps_credential(p_integration_id uuid, p_credential text)
returns void language plpgsql security definer set search_path = public as $$
declare v_club uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;
  if v_club <> public.get_user_club_id() then raise exception 'not authorized'; end if;

  insert into public.gps_integration_secrets (integration_id, credential, set_at)
       values (p_integration_id, p_credential, now())
  on conflict (integration_id) do update set credential = excluded.credential, set_at = now();

  update public.gps_integrations
     set status = 'configured', connected_at = null, updated_at = now()
   where id = p_integration_id;
end; $$;

-- 3. corregir el registro de prueba que quedó como 'connected'
update public.gps_integrations set status = 'configured' where status = 'connected';
