-- Migración 163: infraestructura de acceso de soporte.
--
-- Hoy is_super_admin() es una llave maestra permanente: abre RPE, wellness, GPS,
-- lesiones e historia clínica de los 6 clubes, y las lecturas no dejan rastro.
-- Esta migración NO cierra nada todavía (eso es la 164). Solo construye:
--   1. support_grants        -> la ventana de acceso que abre y cierra el CLUB
--   2. support_restrictions  -> clubes vedados a un admin concreto (muralla china)
--   3. support_sessions      -> qué club está mirando ahora mismo cada admin
--   4. platform_access_log   -> libro de visitas append-only que el club lee
--
-- Aplicarla sola es seguro: nadie pierde acceso.

-- ---------------------------------------------------------------- 1. tablas

create table if not exists public.support_grants (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  granted_by  uuid references public.profiles(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  revoked_by  uuid references public.profiles(id) on delete set null,
  constraint support_grants_window_check check (expires_at > created_at)
);
create index if not exists support_grants_club_idx
  on public.support_grants (club_id, expires_at desc);

comment on table public.support_grants is
  'Ventana de acceso de soporte que abre el club. Sin una fila viva aquí, ningún '
  'admin de plataforma ve datos de este club. Caduca sola; el club puede revocarla.';

-- La muralla china: el club veta a un admin concreto. Solo el club puede levantarlo.
create table if not exists public.support_restrictions (
  club_id       uuid not null references public.clubs(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  reason        text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  primary key (club_id, admin_user_id)
);

comment on table public.support_restrictions is
  'Veto permanente: este admin no accede a este club ni con grant activo. '
  'Pensado para conflicto de interés (mismo torneo). Solo el club lo puede borrar.';

-- Qué club está soportando ahora mismo cada admin. Uno solo a la vez (PK).
create table if not exists public.support_sessions (
  admin_user_id uuid primary key references public.profiles(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  grant_id      uuid not null references public.support_grants(id) on delete cascade,
  reason        text,
  opened_at     timestamptz not null default now(),
  expires_at    timestamptz not null
);

-- Libro de visitas. Sin FK a clubs a propósito: borrar un club no borra su historial.
create table if not exists public.platform_access_log (
  id          bigint generated always as identity primary key,
  club_id     uuid not null,
  actor_id    uuid,
  actor_email text,
  event       text not null,
  resource    text,
  detail      jsonb,
  created_at  timestamptz not null default now(),
  constraint platform_access_log_event_check check (event in (
    'grant_opened','grant_revoked','session_opened','session_closed','resource_viewed'
  ))
);
create index if not exists platform_access_log_club_idx
  on public.platform_access_log (club_id, created_at desc);

comment on table public.platform_access_log is
  'Append-only. Cada entrada de soporte a un club queda aquí y el club la ve. '
  'Un trigger impide UPDATE y DELETE para cualquier rol, incluido service_role.';

-- ------------------------------------------------- 2. append-only de verdad

create or replace function public.platform_access_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'platform_access_log es append-only: no se puede % ninguna fila', tg_op;
end;
$$;

drop trigger if exists platform_access_log_no_update on public.platform_access_log;
create trigger platform_access_log_no_update
  before update or delete on public.platform_access_log
  for each row execute function public.platform_access_log_immutable();

-- ------------------------------------------------------------- 3. funciones

-- ¿Quién del club puede abrir/cerrar la ventana? admin u owner de ESE club.
create or replace function public.is_club_manager(p_club_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.club_id = p_club_id
      and (lower(coalesce(p.role,''))      in ('admin','owner')
        or lower(coalesce(p.club_role,'')) in ('admin','owner'))
  );
$$;

-- El club que este admin está soportando ahora mismo, o NULL.
-- Devuelve NULL (no false) si falta cualquiera de las condiciones: es la pieza
-- de la que cuelga todo lo demás, así que se escribe a prueba de NULL.
create or replace function public.support_club_id()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select s.club_id
  from public.support_sessions s
  join public.support_grants  g on g.id = s.grant_id
  where s.admin_user_id = auth.uid()
    and s.expires_at > now()
    and g.expires_at > now()
    and g.revoked_at is null
    and g.club_id = s.club_id
    and exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
    and not exists (
      select 1 from public.support_restrictions r
      where r.club_id = s.club_id and r.admin_user_id = auth.uid()
    )
  limit 1;
$$;

-- ¿Puedo tocar los datos de ESTE club? Versión precisa, para políticas con club_id.
-- Nunca devuelve NULL: coalesce explícito para que un guard no "no sepa" y deje pasar.
create or replace function public.support_access(p_club_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(p_club_id is not null and p_club_id = public.support_club_id(), false);
$$;

-- Escribir en el libro de visitas. Solo desde funciones DEFINER de aquí dentro.
create or replace function public.support_log(
  p_club_id uuid, p_event text, p_resource text default null, p_detail jsonb default null
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_club_id is null then return; end if;
  insert into public.platform_access_log (club_id, actor_id, actor_email, event, resource, detail)
  values (
    p_club_id,
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    p_event, p_resource, p_detail
  );
end;
$$;

-- ------------------------------------------------------------------ 4. RPCs

-- El club abre la ventana.
create or replace function public.support_grant_open(
  p_club_id uuid, p_hours integer default 24, p_reason text default null
) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_hours integer;
begin
  if not public.is_club_manager(p_club_id) then
    raise exception 'solo un admin u owner del club puede autorizar soporte';
  end if;
  v_hours := least(greatest(coalesce(p_hours, 24), 1), 168);  -- entre 1 h y 7 días

  insert into public.support_grants (club_id, granted_by, reason, expires_at)
  values (p_club_id, auth.uid(), p_reason, now() + make_interval(hours => v_hours))
  returning id into v_id;

  perform public.support_log(p_club_id, 'grant_opened', null,
    jsonb_build_object('grant_id', v_id, 'hours', v_hours, 'reason', p_reason));
  return v_id;
end;
$$;

-- El club la cierra antes de tiempo. Mata la sesión abierta en el acto.
create or replace function public.support_grant_revoke(p_grant_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_club uuid;
begin
  select club_id into v_club from public.support_grants where id = p_grant_id;
  if v_club is null then raise exception 'ese permiso no existe'; end if;
  if not public.is_club_manager(v_club) then
    raise exception 'solo un admin u owner del club puede revocar el soporte';
  end if;

  update public.support_grants
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_grant_id and revoked_at is null;

  delete from public.support_sessions where grant_id = p_grant_id;
  perform public.support_log(v_club, 'grant_revoked', null,
    jsonb_build_object('grant_id', p_grant_id));
end;
$$;

-- El admin de plataforma entra a un club. Falla si no hay ventana o si está vetado.
create or replace function public.support_session_open(p_club_id uuid, p_reason text)
returns timestamptz
language plpgsql security definer set search_path to 'public'
as $$
declare v_grant uuid; v_grant_exp timestamptz; v_exp timestamptz;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'no sos admin de plataforma';
  end if;
  if coalesce(p_reason, '') = '' then
    raise exception 'hay que declarar un motivo para entrar a un club';
  end if;
  if exists (select 1 from public.support_restrictions
             where club_id = p_club_id and admin_user_id = auth.uid()) then
    raise exception 'tenés acceso vetado a este club por conflicto de interés';
  end if;

  select id, expires_at into v_grant, v_grant_exp
  from public.support_grants
  where club_id = p_club_id and revoked_at is null and expires_at > now()
  order by expires_at desc limit 1;

  if v_grant is null then
    raise exception 'este club no tiene una ventana de soporte abierta';
  end if;

  -- la sesión dura como mucho 2 h, y nunca más que la ventana del club
  v_exp := least(v_grant_exp, now() + interval '2 hours');

  insert into public.support_sessions (admin_user_id, club_id, grant_id, reason, opened_at, expires_at)
  values (auth.uid(), p_club_id, v_grant, p_reason, now(), v_exp)
  on conflict (admin_user_id) do update
    set club_id = excluded.club_id, grant_id = excluded.grant_id,
        reason = excluded.reason, opened_at = now(), expires_at = excluded.expires_at;

  perform public.support_log(p_club_id, 'session_opened', null,
    jsonb_build_object('reason', p_reason, 'expires_at', v_exp));
  return v_exp;
end;
$$;

create or replace function public.support_session_close()
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_club uuid;
begin
  select club_id into v_club from public.support_sessions where admin_user_id = auth.uid();
  delete from public.support_sessions where admin_user_id = auth.uid();
  if v_club is not null then perform public.support_log(v_club, 'session_closed'); end if;
end;
$$;

-- El panel de admin llama a esto al abrir cada pantalla de un club.
create or replace function public.support_log_view(p_resource text, p_detail jsonb default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_club uuid;
begin
  v_club := public.support_club_id();
  if v_club is null then return; end if;
  perform public.support_log(v_club, 'resource_viewed', p_resource, p_detail);
end;
$$;

-- Estado actual, para la UI del admin.
create or replace function public.support_status()
returns table (club_id uuid, club_name text, reason text, opened_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path to 'public'
as $$
  select s.club_id, c.name, s.reason, s.opened_at, s.expires_at
  from public.support_sessions s
  left join public.clubs c on c.id = s.club_id
  where s.admin_user_id = auth.uid() and s.expires_at > now();
$$;

-- ----------------------------------------------------------------- 5. RLS

alter table public.support_grants       enable row level security;
alter table public.support_restrictions enable row level security;
alter table public.support_sessions     enable row level security;
alter table public.platform_access_log  enable row level security;

-- grants: el club ve y gestiona los suyos (vía RPC); el admin solo puede LEER.
drop policy if exists support_grants_club_read on public.support_grants;
create policy support_grants_club_read on public.support_grants
  for select to authenticated
  using (club_id = public.get_user_club_id()
      or exists (select 1 from public.platform_admins where user_id = auth.uid()));

-- restricciones: las ve el club afectado y el admin afectado.
-- Insertar puede cualquiera de los dos; BORRAR solo el club. Esa asimetría es el punto:
-- el admin puede vetarse a sí mismo pero no puede levantarse el veto.
drop policy if exists support_restrictions_read on public.support_restrictions;
create policy support_restrictions_read on public.support_restrictions
  for select to authenticated
  using (club_id = public.get_user_club_id() or admin_user_id = auth.uid());

drop policy if exists support_restrictions_insert on public.support_restrictions;
create policy support_restrictions_insert on public.support_restrictions
  for insert to authenticated
  with check (public.is_club_manager(club_id) or admin_user_id = auth.uid());

drop policy if exists support_restrictions_delete on public.support_restrictions;
create policy support_restrictions_delete on public.support_restrictions
  for delete to authenticated
  using (public.is_club_manager(club_id));

-- sesiones: el club ve quién está dentro de su casa ahora mismo.
drop policy if exists support_sessions_read on public.support_sessions;
create policy support_sessions_read on public.support_sessions
  for select to authenticated
  using (club_id = public.get_user_club_id() or admin_user_id = auth.uid());

-- libro de visitas: lo lee el club y el admin. Nadie escribe ni borra desde la API.
drop policy if exists platform_access_log_read on public.platform_access_log;
create policy platform_access_log_read on public.platform_access_log
  for select to authenticated
  using (club_id = public.get_user_club_id()
      or exists (select 1 from public.platform_admins where user_id = auth.uid()));

-- ------------------------------------------------------------- 6. permisos

revoke all on public.support_grants,
              public.support_restrictions,
              public.support_sessions,
              public.platform_access_log
  from anon, authenticated;

grant select on public.support_grants, public.support_sessions, public.platform_access_log to authenticated;
grant select, insert, delete on public.support_restrictions to authenticated;

-- support_log es interna: nadie la llama desde fuera.
revoke all on function public.support_log(uuid, text, text, jsonb) from anon, authenticated;

grant execute on function public.support_grant_open(uuid, integer, text)  to authenticated;
grant execute on function public.support_grant_revoke(uuid)               to authenticated;
grant execute on function public.support_session_open(uuid, text)         to authenticated;
grant execute on function public.support_session_close()                  to authenticated;
grant execute on function public.support_log_view(text, jsonb)            to authenticated;
grant execute on function public.support_status()                         to authenticated;
grant execute on function public.support_club_id()                        to authenticated;
grant execute on function public.support_access(uuid)                     to authenticated;
grant execute on function public.is_club_manager(uuid)                    to authenticated;
