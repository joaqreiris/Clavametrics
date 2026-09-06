-- Migration 132: arreglar los guards de las funciones que cambian privilegios.
--
-- URGENTE. Las tres funciones que asignan roles y clubes tenían un guard que no cortaba.
--
-- Causa: los booleanos del chequeo salían de expresiones que pueden dar NULL, y en SQL
-- NULL no es false. `if not <null> and not false` evalúa a NULL, y un `if` con NULL no
-- ejecuta su rama: el `raise exception` nunca ocurría y la función seguía de largo hasta
-- el UPDATE. Dos formas de llegar a ese NULL:
--
--   1. Sin fila en profiles  → el SELECT INTO deja todo en NULL. Le pasa a quien llama
--      sin sesión, y también a una cuenta registrada que todavía no completó el perfil.
--   2. Con fila, pero `club_role` NULL → `role in (...) or club_role in (...)` da
--      `false or NULL` = NULL. Hoy 19 de 23 perfiles tienen club_role NULL.
--
-- El arreglo es hacer que cada término sea estrictamente booleano (coalesce a false) y
-- comparar los clubes con `is distinct from`, que trata NULL como un valor más. El
-- comportamiento legítimo no cambia: un admin sigue pudiendo exactamente lo mismo.
--
-- Se acompaña con el REVOKE de anon (B1 del audit): estas tres no tienen ningún motivo
-- para ser invocables sin sesión. Son dos capas independientes a propósito — el REVOKE
-- no alcanza para el caso 2, y el coalesce no vuelve razonable exponerlas a anon.

-- ── set_member_role ─────────────────────────────────────────────────────────
create or replace function public.set_member_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_club      uuid;
  caller_role      text;
  caller_club_role text;
  caller_is_admin  boolean;
  caller_is_owner  boolean;
  caller_super     boolean;
  target_club      uuid;
begin
  select club_id, role, club_role
    into caller_club, caller_role, caller_club_role
    from public.profiles
   where id = auth.uid();

  -- coalesce por término: sin fila, o con club_role NULL, el booleano debe ser FALSE.
  caller_is_admin := coalesce(caller_role      in ('admin','owner'), false)
                  or coalesce(caller_club_role in ('admin','owner'), false);
  caller_is_owner := coalesce(caller_role      = 'owner', false)
                  or coalesce(caller_club_role = 'owner', false);
  caller_super    := coalesce(public.is_super_admin(), false);

  if not caller_is_admin and not caller_super then
    raise exception 'Not authorized';
  end if;

  select club_id into target_club from public.profiles where id = target_id;
  if target_club is null then
    raise exception 'Target not found';
  end if;

  -- is distinct from: sin club propio (NULL) nunca coincide con el del target.
  if not caller_super and (caller_club is null or target_club is distinct from caller_club) then
    raise exception 'Target not in your club';
  end if;

  if new_role not in ('owner','admin','coach','physio','analyst','nutritionist','staff',
                      'sc_coach','fitness_coach','gk_coach','assistant_coach',
                      'director_football','head_performance','methodology_director','team_manager') then
    raise exception 'Invalid role';
  end if;

  if new_role = 'owner' and not (caller_is_owner or caller_super) then
    raise exception 'Only an owner can grant owner';
  end if;

  update public.profiles set role = new_role where id = target_id;
end;
$$;

-- ── set_member_secondary_role ───────────────────────────────────────────────
create or replace function public.set_member_secondary_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_club      uuid;
  caller_role      text;
  caller_club_role text;
  caller_is_admin  boolean;
  caller_super     boolean;
  target_club      uuid;
  norm             text;
begin
  select club_id, role, club_role
    into caller_club, caller_role, caller_club_role
    from public.profiles
   where id = auth.uid();

  caller_is_admin := coalesce(caller_role      in ('admin','owner'), false)
                  or coalesce(caller_club_role in ('admin','owner'), false);
  caller_super    := coalesce(public.is_super_admin(), false);

  if not caller_is_admin and not caller_super then
    raise exception 'Not authorized';
  end if;

  select club_id into target_club from public.profiles where id = target_id;
  if target_club is null then
    raise exception 'Target not found';
  end if;

  if not caller_super and (caller_club is null or target_club is distinct from caller_club) then
    raise exception 'Target not in your club';
  end if;

  norm := nullif(trim(coalesce(new_role, '')), '');
  if norm is not null and norm not in ('admin','coach','physio','analyst','nutritionist','staff',
                                       'sc_coach','fitness_coach','gk_coach','assistant_coach',
                                       'director_football','head_performance','methodology_director','team_manager') then
    raise exception 'Invalid role';
  end if;

  update public.profiles set club_role = norm where id = target_id;

  if norm is not null and exists (
       select 1 from public.member_modules
        where profile_id = target_id and club_id = target_club
     ) then
    perform public.apply_role_template(target_club, target_id, norm);
  end if;
end;
$$;

-- ── assign_user_to_club ─────────────────────────────────────────────────────
create or replace function public.assign_user_to_club(
  p_user_id uuid,
  p_club_id uuid,
  p_role    text default 'staff'::text,
  p_email   text default ''::text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_club_id uuid;
  caller_role    text;
begin
  select club_id, role
    into caller_club_id, caller_role
    from public.profiles
   where id = auth.uid();

  -- Permitido: admin de plataforma, o admin del club destino. Cada término coalesceado:
  -- antes, sin fila en profiles, el OR entero daba NULL y el guard no cortaba.
  if not (
       coalesce(public.is_platform_admin(), false)
    or (
         caller_club_id is not null
         and caller_club_id = p_club_id
         and coalesce(caller_role = 'admin', false)
       )
  ) then
    raise exception 'Unauthorized: must be platform admin or admin of the target club';
  end if;

  insert into public.profiles (id, club_id, role, email)
  values (p_user_id, p_club_id, p_role, p_email)
  on conflict (id) do update
    set club_id = excluded.club_id,
        role    = excluded.role;
end;
$$;

-- ── B1: estas tres no se invocan sin sesión ─────────────────────────────────
-- OJO: hay que revocar de PUBLIC, no de anon. Postgres concede EXECUTE a PUBLIC por
-- defecto al crear una función, y anon es miembro de PUBLIC: un `revoke ... from anon`
-- no cambia nada, porque el permiso se hereda igual (se ve en la ACL como `=X/postgres`).
-- Ese es justamente el motivo por el que el linter lista tantas funciones abiertas.
-- Verificado: antes del revoke a PUBLIC la llamada sin sesión entraba a la función;
-- después devuelve 401 `permission denied for function`.
revoke execute on function public.set_member_role(uuid, text)                 from public;
revoke execute on function public.set_member_secondary_role(uuid, text)       from public;
revoke execute on function public.assign_user_to_club(uuid, uuid, text, text) from public;

grant execute on function public.set_member_role(uuid, text)                 to authenticated, service_role;
grant execute on function public.set_member_secondary_role(uuid, text)       to authenticated, service_role;
grant execute on function public.assign_user_to_club(uuid, uuid, text, text) to authenticated, service_role;
