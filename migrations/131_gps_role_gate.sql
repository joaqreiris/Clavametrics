-- Migration 131: exigir rol para configurar la integración GPS.
--
-- gps-verify, gps-athletes y gps-parameters validaban dos cosas: que hubiera sesión y que
-- la integración fuera del club de quien llama. Ese segundo control está bien y no cambia
-- (no hay acceso cruzado entre clubes). Lo que faltaba era el rol: alcanzaba con ser
-- miembro del staff, aunque el panel que las usa viva en Admin, reservado a admin/owner.
-- La regla estaba en el botón y no en la puerta.
--
-- La intención ya estaba escrita en assets/gps-integrations.js:
--   canConfig  = región/verificar/mapear métricas/mapear atletas/sync  → admin + S&C
--   canConnect = cargar/borrar el TOKEN de la API                      → admin-only
-- `can_configure_gps()` es ese `canConfig`, ahora del lado del servidor. Se apoya en las
-- piezas que ya existen (`my_role()` y `role_bucket()`), así que no introduce un criterio
-- de roles paralelo: role_bucket ya mapea sc_coach y fitness_coach al bucket 'sc'.
--
-- Se miran los DOS roles (principal y secundario), igual que las policies RLS del proyecto,
-- para no dejar afuera a quien tenga el rol de S&C como rol secundario.
--
-- Vive en la base y no en las Edge Functions a propósito: la lista de roles habilitados se
-- ajusta con un CREATE OR REPLACE, sin redeploy.

create or replace function public.can_configure_gps()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         public.role_bucket(p.role)      in ('admin', 'sc') or
         public.role_bucket(p.club_role) in ('admin', 'sc')
       )
  );
$$;

comment on function public.can_configure_gps() is
  'true si el usuario puede configurar la integración GPS (verificar, listar atletas y '
  'parámetros). Equivale al canConfig del panel: buckets admin y sc, mirando rol principal '
  'y secundario. La usan las Edge Functions gps-verify / gps-athletes / gps-parameters.';

revoke all on function public.can_configure_gps() from public;
revoke all on function public.can_configure_gps() from anon;
grant execute on function public.can_configure_gps() to authenticated;

-- ── Cupo para gps-verify ────────────────────────────────────────────────────
-- Es la única de las tres que ESCRIBE (status/last_error de la integración) y cada llamada
-- consume una petición contra la API del proveedor con el token del club. Entra al mismo
-- contador de la migración 129. Las otras dos son de sólo lectura y se usan varias veces
-- seguidas en el flujo de mapeo, así que quedan cubiertas sólo por rol para no estorbar.
-- Único cambio respecto de la 129: la rama 'gps-verify' en el CASE.
create or replace function public.ai_rate_limit_take(p_fn text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  uuid;
  v_limit int;
  v_used  int;
begin
  v_limit := case p_fn
    when 'generate-card'     then 20
    when 'generate-gym-plan' then 20
    when 'tag-exercise'      then 60
    when 'youtube-import'    then 30
    when 'gps-verify'        then 30
    else null
  end;

  if v_limit is null then
    raise exception 'ai_rate_limit_take: fn desconocida %', p_fn
      using errcode = 'invalid_parameter_value';
  end if;

  select club_id into v_club from public.profiles where id = auth.uid();
  if v_club is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_club', 'used', 0, 'limit', v_limit);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_club::text || ':' || p_fn, 0));

  select count(*) into v_used
    from public.ai_usage_events
   where club_id = v_club
     and fn = p_fn
     and created_at >= now() - interval '24 hours';

  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'used', v_used, 'limit', v_limit);
  end if;

  insert into public.ai_usage_events (club_id, user_id, fn)
  values (v_club, auth.uid(), p_fn);

  return jsonb_build_object('allowed', true, 'used', v_used + 1, 'limit', v_limit);
end;
$$;

revoke all on function public.ai_rate_limit_take(text) from public;
revoke all on function public.ai_rate_limit_take(text) from anon;
grant execute on function public.ai_rate_limit_take(text) to authenticated;
