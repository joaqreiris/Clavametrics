-- Migration 136: helpers de pertenencia al club.
--
-- Motivo: 17 funciones SECURITY DEFINER reciben `p_club_id` / `p_team_id` y devuelven los
-- datos de ESE club sin comprobar que quien llama pertenezca. La 134 les cerró el acceso
-- sin sesión, pero un usuario autenticado del club A seguía pudiendo pedir datos del club B
-- pasando su uuid (verificado: `club_staff_count(<club ajeno>)` devolvía el número).
--
-- El guard va en un helper y no copiado 17 veces, para no repetir también el bug de NULL
-- de la migración 132.
--
-- ⚠️ TRAMPA IMPORTANTE, encontrada probando: **`current_user` NO sirve para saber quién
-- llama**. Dentro de una función SECURITY DEFINER, `current_user` es el OWNER de la función
-- (postgres), no el rol del que la invoca. Un primer intento usó
-- `current_user in ('service_role','postgres')` como salvaguarda para el backend, y el
-- resultado fue que TODOS los guards devolvían true y ninguno cortaba. Lo que sí identifica
-- al llamador es el claim `role` del JWT, o sea `auth.role()`:
--     'authenticated' → validar el club
--     'anon'          → validar (sin uid, corta)
--     'service_role'  → backend, pasa
--     sin JWT         → no viene por la API (jobs, funciones DEFINER internas), pasa
-- Esa salvaguarda hace falta: las Edge Functions usan la service_role key, donde auth.uid()
-- y get_user_club_id() son NULL, y sin ella se romperían.

-- Versión booleana: para usar DENTRO de policies RLS, donde un `raise` haría fallar la
-- query entera en vez de filtrar.
create or replace function public.is_my_club(p_club uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_role text; v_club uuid;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  -- Backend (service_role) o ejecución sin JWT (jobs, funciones DEFINER internas).
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return true;
  end if;

  if coalesce(public.is_super_admin(), false) then return true; end if;

  v_club := public.get_user_club_id();
  return v_club is not null and p_club is not distinct from v_club;
end;
$$;

-- Versión que corta: para las funciones que se llaman por RPC desde el frontend.
create or replace function public.assert_my_club(p_club uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_my_club(p_club) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

-- Idem para un equipo: se resuelve su club y se compara con el de quien llama.
create or replace function public.assert_my_team(p_team uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_team_club uuid;
begin
  select club_id into v_team_club from public.teams where id = p_team;
  if v_team_club is null or not public.is_my_club(v_team_club) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.is_my_club(uuid)     from public, anon;
revoke all on function public.assert_my_club(uuid) from public, anon;
revoke all on function public.assert_my_team(uuid) from public, anon;
grant execute on function public.is_my_club(uuid)     to authenticated, service_role;
grant execute on function public.assert_my_club(uuid) to authenticated, service_role;
grant execute on function public.assert_my_team(uuid) to authenticated, service_role;
