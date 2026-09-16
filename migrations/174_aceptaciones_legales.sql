-- Migración 174: queda constancia de qué documento aceptó cada club, cuándo y quién.
--
-- Hoy el registro tiene una casilla OBLIGATORIA de Términos y Privacidad (Register.html)
-- y no deja ni un rastro en la base: no hay tabla ni columna. La casilla OPCIONAL, la de
-- marketing, sí se guarda con fecha (profiles.marketing_opt_in_at). O sea que de lo único
-- que hay prueba es de aquello que no hace falta probar. Si mañana un club discute los
-- Términos, no hay nada que enseñar.
--
-- ── Las cuatro decisiones de diseño ──
--
-- 1. HECHOS, NO ESTADO. Una aceptación es algo que pasó en una fecha: no se edita ni se
--    borra, se acumula. Por eso la tabla es append-only (sin policies de update/delete) y
--    la clave incluye la versión: aceptar la v2 no borra que se aceptó la v1.
--
-- 2. VERSIÓN OBLIGATORIA. "Aceptó los Términos" no significa nada sin saber cuáles. Los
--    documentos se van a reescribir; la prueba tiene que apuntar a un texto concreto.
--
-- 3. EL CLIENTE NO ESCRIBE AQUÍ. Todo entra por record_legal_acceptance(), que saca el
--    club del perfil de quien llama y la IP de la cabecera. Si el cliente pudiera elegir
--    club_id o accepted_at, el registro no probaría nada.
--
-- 4. EL DPA SE EXIGE EN LA BASE, NO EN LA PANTALLA. El encargo de tratamiento tiene que
--    estar firmado ANTES de que entre el primer dato personal de un tercero, y el sitio
--    donde eso pasa es `players`. Un guard en el JS de Squad.html se salta con la consola;
--    el trigger no. Es la misma lección de la e910c5a.
--
-- Qué documento se firma cuándo:
--    terms + privacy  -> al crear la cuenta (Register / auth-callback)
--    dpa              -> en el onboarding, antes del primer jugador
--
-- Los clubes que YA existen quedan exentos del gate (ver DPA_GATE_DESDE): no se les puede
-- fabricar una firma hacia atrás. Se les pide desde la app y, hasta entonces, siguen
-- trabajando. El gate muerde solo para los que nacen a partir de hoy.

-- ------------------------------------------------------------------ 1. tabla

create table if not exists public.legal_acceptances (
  id           uuid primary key default gen_random_uuid(),

  -- Desnormalizado a propósito, igual que en player_image_consents: la policy filtra por
  -- club SIN salir de la tabla. Lo pone el trigger, no el cliente.
  club_id      uuid not null references public.clubs(id) on delete cascade,

  -- A auth.users y no a profiles: en el alta con confirmación por correo el usuario existe
  -- antes que su perfil, y el registro no puede depender de ese orden.
  user_id      uuid not null references auth.users(id) on delete cascade,

  document     text not null check (document in ('terms','privacy','dpa')),
  version      text not null check (btrim(version) <> ''),
  accepted_at  timestamptz not null default now(),

  -- Solo para el DPA: quién firma y con qué cargo. Un encargo de tratamiento firmado por
  -- "alguien del club" no acredita representación.
  signer_name  text,
  signer_role  text,

  -- Prueba circunstancial, no identificación. Se guarda como texto: puede venir vacía
  -- (una RPC desde el servidor no trae cabecera) y eso no invalida la aceptación.
  ip           text,
  user_agent   text,

  -- La misma persona no repite la misma versión del mismo documento. Reaceptar la v2 sí
  -- crea fila nueva, que es justo lo que se quiere.
  unique (user_id, document, version),

  -- Un DPA sin firmante no sirve para lo único que tiene que servir.
  constraint legal_dpa_signed check (
    document <> 'dpa'
    or (nullif(btrim(coalesce(signer_name,'')),'') is not null
        and nullif(btrim(coalesce(signer_role,'')),'') is not null)
  )
);

create index if not exists legal_acceptances_club_idx
  on public.legal_acceptances (club_id, document, accepted_at desc);

comment on table public.legal_acceptances is
  'Append-only: qué documento legal aceptó quién, en qué versión y cuándo. No se edita ni '
  'se borra — una aceptación es un hecho histórico. Se escribe solo vía '
  'record_legal_acceptance(); el DPA lo exige players_require_dpa() antes del primer jugador.';

-- ------------------------------------------ 2. el club y la IP salen del servidor

create or replace function public.record_legal_acceptance(
  p_document     text,
  p_version      text,
  p_signer_name  text default null,
  p_signer_role  text default null
) returns uuid
language plpgsql
security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_club uuid;
  v_hdr  json;
  v_ip   text;
  v_ua   text;
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'no hay sesión' using errcode = '28000';
  end if;

  select club_id into v_club from public.profiles where id = v_user;
  if v_club is null then
    raise exception 'el usuario % no pertenece a ningún club', v_user using errcode = '23502';
  end if;

  -- Las cabeceras pueden no estar (llamada fuera de PostgREST) o no ser JSON. Que falte
  -- la IP no puede tumbar una aceptación: es un dato de apoyo, no el hecho.
  begin
    v_hdr := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_hdr := null;
  end;
  v_ip := nullif(btrim(split_part(coalesce(v_hdr->>'x-forwarded-for',''), ',', 1)), '');
  v_ua := left(coalesce(v_hdr->>'user-agent',''), 500);

  insert into public.legal_acceptances
    (club_id, user_id, document, version, signer_name, signer_role, ip, user_agent)
  values
    (v_club, v_user, p_document, btrim(p_version),
     nullif(btrim(coalesce(p_signer_name,'')),''),
     nullif(btrim(coalesce(p_signer_role,'')),''),
     v_ip, nullif(v_ua,''))
  on conflict (user_id, document, version) do nothing
  returning id into v_id;

  -- Ya estaba aceptada esa versión: se devuelve la que hay. Volver a pulsar el botón no
  -- es un error, y sobre todo no debe reescribir la fecha original.
  if v_id is null then
    select id into v_id from public.legal_acceptances
     where user_id = v_user and document = p_document and version = btrim(p_version);
  end if;

  return v_id;
end $$;

comment on function public.record_legal_acceptance(text,text,text,text) is
  'Registra una aceptación legal del usuario actual. El club sale de su perfil y la IP de '
  'la cabecera: el cliente no elige ninguno de los dos. Idempotente por (usuario, documento, versión).';

-- ------------------------------------------------------- 3. qué tiene firmado el club

-- Última aceptación de cada documento en el club. Una sola consulta para la pantalla:
-- devuelve la fila aunque no haya nada firmado, para poder decir "falta el DPA" en vez de
-- no decir nada.
create or replace function public.club_legal_status(p_club_id uuid default null)
returns table (document text, version text, accepted_at timestamptz, signer_name text, signer_role text)
language sql
stable
security definer set search_path to 'public'
as $$
  with target as (
    select coalesce(p_club_id, public.get_user_club_id()) as club_id
  ),
  docs as (select unnest(array['terms','privacy','dpa']) as document)
  select d.document, l.version, l.accepted_at, l.signer_name, l.signer_role
    from docs d
    left join lateral (
      select la.version, la.accepted_at, la.signer_name, la.signer_role
        from public.legal_acceptances la, target t
       where la.club_id = t.club_id and la.document = d.document
       order by la.accepted_at desc
       limit 1
    ) l on true
   -- Sin club no se devuelve nada, ni siquiera las filas vacías: no hay a quién responder.
   where exists (select 1 from target t where t.club_id is not null)
     -- Y solo del propio club: esta función es security definer.
     and exists (select 1 from target t where public.is_my_club(t.club_id));
$$;

comment on function public.club_legal_status(uuid) is
  'Última aceptación de cada documento legal del club (fila con version NULL si falta). '
  'Solo del club propio.';

-- --------------------------------------------- 4. el DPA, antes del primer jugador

-- Clubes nacidos antes de la fecha de entrada en vigor quedan exentos: no se les puede
-- inventar una firma retroactiva. Se les pide desde la app y mientras tanto trabajan.
--
-- ATENCIÓN — HOY LA FECHA ESTÁ EN EL FUTURO, A PROPÓSITO. El mecanismo entero está
-- probado (RPC, registro, trigger sobre players), pero NO HAY TEXTO DE DPA PUBLICADO: el
-- borrador está con la abogada. Bloquear el alta de jugadores sin una página que el club
-- pueda leer y firmar dejaría encerrado a cualquier club nuevo, sin salida.
--
-- PARA ACTIVARLO: publicar el DPA como página (Dpa.html / -en / -pt), darlo de alta en
-- assets/legal.js (PAGES.dpa), añadir la casilla en el onboarding y cambiar esta fecha a
-- la de ese día.
create or replace function public.club_needs_dpa(p_club_id uuid)
returns boolean
language sql
stable
security definer set search_path to 'public'
as $$
  select c.created_at >= timestamptz '2099-01-01 00:00:00+00'
     and not exists (
       select 1 from public.legal_acceptances la
        where la.club_id = c.id and la.document = 'dpa'
     )
    from public.clubs c
   where c.id = p_club_id;
$$;

comment on function public.club_needs_dpa(uuid) is
  'true si al club le falta el DPA y le aplica el gate. HOY SIEMPRE false: la fecha de '
  'entrada en vigor está en el futuro a la espera del texto del DPA. NULL si el club no '
  'existe — el trigger lo trata como "no bloquear", porque ahí falla la FK, no el consentimiento.';

create or replace function public.players_require_dpa()
returns trigger
language plpgsql
security definer set search_path to 'public'
as $$
begin
  -- `is true` y no `= true`: un NULL (club inexistente) NO debe bloquear. Ese caso lo
  -- rechaza la clave foránea con un error que dice la verdad.
  if public.club_needs_dpa(new.club_id) is true then
    raise exception 'el club % no tiene firmado el encargo de tratamiento (DPA)', new.club_id
      using errcode = '42501',
            hint = 'Firmá el DPA en Admin → Legal antes de cargar jugadores.';
  end if;
  return new;
end $$;

drop trigger if exists players_require_dpa on public.players;
create trigger players_require_dpa
  before insert on public.players
  for each row execute function public.players_require_dpa();

-- ------------------------------------------------------------------ 5. RLS

alter table public.legal_acceptances enable row level security;

-- Solo lectura, y solo del propio club. No hay policy de insert/update/delete a propósito:
-- se escribe únicamente por record_legal_acceptance(), que es security definer.
drop policy if exists legal_acceptances_select on public.legal_acceptances;
create policy legal_acceptances_select on public.legal_acceptances
  for select using (public.is_my_club(club_id));

grant select on public.legal_acceptances to authenticated;
grant execute on function public.record_legal_acceptance(text,text,text,text) to authenticated;
grant execute on function public.club_legal_status(uuid) to authenticated;
grant execute on function public.club_needs_dpa(uuid) to authenticated;
