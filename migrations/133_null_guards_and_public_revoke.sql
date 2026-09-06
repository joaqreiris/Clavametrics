-- Migration 133: segunda vuelta del mismo defecto que la 132, y cierre del acceso anónimo.
--
-- PARTE A — el guard que no corta, otra variante
-- La 132 arregló los booleanos que salían NULL de un SELECT INTO. Queda la otra forma del
-- mismo error: comparar con `<>` contra algo que puede ser NULL.
--
--     if v_club <> public.get_user_club_id() then raise exception 'not authorized'; end if;
--
-- Para quien llama sin sesión (o con cuenta sin perfil), `get_user_club_id()` es NULL, la
-- comparación da NULL, y el `if` no ejecuta su rama: el guard se saltea y la función sigue
-- hasta el UPDATE. Se arregla con `is distinct from`, que trata NULL como un valor más, y
-- exigiendo explícitamente que el club del que llama no sea NULL.
--
-- Nota: `acknowledge_wellness` tiene el mismo NULL pero es segura, porque filtra en el
-- WHERE del UPDATE (`club_id = get_user_club_id()`) en vez de en un IF. Un WHERE con NULL
-- no selecciona filas; un IF con NULL no corta. Esa es toda la diferencia.
--
-- PARTE B — B1, cerrar el acceso anónimo
-- Hay que revocar de PUBLIC **y** de anon, porque el permiso puede venir por dos vías y
-- basta una para que la función quede abierta:
--   · Postgres concede EXECUTE a PUBLIC al crear cada función, y anon hereda de PUBLIC
--     (en la ACL se ve como `=X/postgres`). Un `revoke ... from anon` no toca esa vía.
--   · Supabase además concede EXECUTE a anon explícitamente en varias (`anon=X/postgres`).
--     Un `revoke ... from public` no toca esta otra.
-- Verificado en vivo: revocando sólo de PUBLIC, 5 de estas 9 seguían abiertas a anon.
-- Se revocan las dos vías y se concede explícitamente a authenticated + service_role.
--
-- Se deja abierto a anon SOLO lo que las páginas públicas necesitan de verdad:
--   get_shared_calendar, get_shared_nutrition          (links de calendario / nutrición)
--   get_survey_meta/_players/_sessions/_history,
--   submit_survey                                       (encuestas por token)
--   accept_invitation                                   (ver abajo)
--   paddle_env                                          (inocua, lee una constante)
--
-- accept_invitation se deja abierta a propósito: opera enteramente sobre auth.uid(), así
-- que sin sesión no encuentra invitación y devuelve sin hacer nada. Es inofensiva, y
-- cerrarla arriesgaría romper el alta de invitados si el flujo la llama antes de que la
-- sesión esté lista.

-- ── PARTE A ─────────────────────────────────────────────────────────────────

create or replace function public.set_gps_credential(p_integration_id uuid, p_credential text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club   uuid;
  v_caller uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;

  v_caller := public.get_user_club_id();
  if v_caller is null or v_club is distinct from v_caller then
    raise exception 'not authorized';
  end if;

  insert into public.gps_integration_secrets (integration_id, credential, set_at)
       values (p_integration_id, p_credential, now())
  on conflict (integration_id) do update set credential = excluded.credential, set_at = now();

  update public.gps_integrations
     set status = 'configured', connected_at = null, updated_at = now()
   where id = p_integration_id;
end;
$$;

create or replace function public.clear_gps_credential(p_integration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club   uuid;
  v_caller uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;

  v_caller := public.get_user_club_id();
  if v_caller is null or v_club is distinct from v_caller then
    raise exception 'not authorized';
  end if;

  delete from public.gps_integration_secrets where integration_id = p_integration_id;
  update public.gps_integrations
     set status = 'disabled', updated_at = now()
   where id = p_integration_id;
end;
$$;

create or replace function public.toggle_adaptation_applied(p_treatment_id uuid)
returns table(applied_at timestamp with time zone, applied_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club   uuid;
  v_caller uuid;
begin
  select club_id into v_club from public.treatments where id = p_treatment_id;
  v_caller := public.get_user_club_id();

  if v_club is null or v_caller is null or v_club is distinct from v_caller then
    raise exception 'not authorized';
  end if;

  update public.treatments t
     set adaptation_applied_at = case when t.adaptation_applied_at is null then now() else null end,
         adaptation_applied_by = case when t.adaptation_applied_at is null then auth.uid() else null end
   where t.id = p_treatment_id
  returning t.adaptation_applied_at, t.adaptation_applied_by
    into applied_at, applied_by;

  return next;
end;
$$;

-- ── PARTE B ─────────────────────────────────────────────────────────────────
-- Las que mutan y no tienen por qué ser invocables sin sesión.
revoke execute on function public.acknowledge_wellness(uuid)                     from public;
revoke execute on function public.ensure_match_session(uuid)                     from public;
revoke execute on function public.gps_set_club_default_layout(text, jsonb)       from public;
revoke execute on function public.log_audit(text, text, jsonb, uuid)             from public;
revoke execute on function public.register_new_club(text, text)                  from public;
revoke execute on function public.set_match_minutes(uuid, date, integer, text, uuid) from public;
revoke execute on function public.toggle_adaptation_applied(uuid)                from public;
revoke execute on function public.set_gps_credential(uuid, text)                 from public;
revoke execute on function public.clear_gps_credential(uuid)                     from public;

grant execute on function public.acknowledge_wellness(uuid)                     to authenticated, service_role;
grant execute on function public.ensure_match_session(uuid)                     to authenticated, service_role;
grant execute on function public.gps_set_club_default_layout(text, jsonb)       to authenticated, service_role;
grant execute on function public.log_audit(text, text, jsonb, uuid)             to authenticated, service_role;
grant execute on function public.register_new_club(text, text)                  to authenticated, service_role;
grant execute on function public.set_match_minutes(uuid, date, integer, text, uuid) to authenticated, service_role;
grant execute on function public.toggle_adaptation_applied(uuid)                to authenticated, service_role;
grant execute on function public.set_gps_credential(uuid, text)                 to authenticated, service_role;
grant execute on function public.clear_gps_credential(uuid)                     to authenticated, service_role;

-- La segunda vía: estas cinco tenían además un GRANT explícito a anon.
revoke execute on function public.acknowledge_wellness(uuid)                     from anon;
revoke execute on function public.ensure_match_session(uuid)                     from anon;
revoke execute on function public.log_audit(text, text, jsonb, uuid)             from anon;
revoke execute on function public.set_match_minutes(uuid, date, integer, text, uuid) from anon;
revoke execute on function public.toggle_adaptation_applied(uuid)                from anon;
