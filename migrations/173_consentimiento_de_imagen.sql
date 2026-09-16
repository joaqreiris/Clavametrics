-- Migración 173: el consentimiento de imagen se registra, con quién lo dio y para qué.
--
-- Hasta hoy la base no tiene NADA de consentimiento: ni tabla, ni columna. Mientras los
-- vídeos vivieran en el Dropbox del club daba igual — el club trataba la imagen, nosotros
-- guardábamos un enlace. En cuanto se aloje vídeo en la plataforma eso cambia de dueño, y
-- sin registro no hay forma de responder a la única pregunta que importa: ¿este corte se
-- puede analizar? ¿se puede publicar?
--
-- Son DOS derechos distintos y se confunden todo el tiempo. El RGPD regula el tratamiento
-- de los datos; el derecho a la propia imagen es un derecho fundamental aparte (en España,
-- LO 1/1982) con su propio régimen. Tener firmado el RGPD no da derechos sobre la cara de
-- nadie. Por eso esto no cuelga de `profiles.marketing_opt_in` ni de los Términos.
--
-- ── Las tres decisiones de diseño ──
--
-- 1. DOS ALCANCES, no uno. Autorizar el análisis interno del cuerpo técnico no autoriza
--    publicar el corte. Con menores el caso habitual va a ser exactamente ese: sí al
--    análisis, no a la difusión. Un permiso único obligaría a pedirlo todo otra vez el día
--    que se quiera separar.
--
-- 2. DECLARATIVO, sin adjuntar documentos. Se registra quién lo otorgó, cuándo y se puede
--    revocar. No se suben PDFs firmados: convertiría a la plataforma en custodia de datos
--    de identidad de los padres, que es más riesgo del que resuelve.
--
-- 3. FAIL CLOSED SOBRE LA EDAD. Sin fecha de nacimiento el estado es 'unknown_age', que NO
--    es consentido. Es el enganche con la 0ec6e0f: la fecha obligatoria no era completitud
--    de datos, era esto. Hoy hay 24 fichas sin fecha, y 5 de ellas en la U18 — o sea casi
--    con certeza menores que el sistema no puede reconocer como tales.
--
-- Quién tiene que otorgarlo, que es lo que implementa image_consent_state():
--    18 o más          -> el propio jugador
--    de 14 a 17        -> ambos progenitores Y el propio menor (art. 156 CC + LO 1/1982)
--    menos de 14       -> ambos progenitores
--
-- El borrado SÍ está permitido (on delete cascade desde players): el derecho de supresión
-- tiene que poder ejercerse. La revocación ordinaria, en cambio, marca `revoked_at` y no
-- borra — hay que poder demostrar hacia atrás que en tal fecha el permiso existía.

-- ------------------------------------------------------------------ 1. tabla

create table if not exists public.player_image_consents (
  player_id          uuid not null references public.players(id) on delete cascade,
  scope              text not null check (scope in ('internal_analysis','public_release')),

  -- Desnormalizado a propósito: la policy filtra por club SIN salir de la tabla. La
  -- e910c5a fue exactamente esto — un guard de rol que no miraba el club. Lo mantiene un
  -- trigger, así que no se puede falsear desde el cliente.
  club_id            uuid not null references public.clubs(id) on delete cascade,

  by_player_at       date,
  by_player_name     text,
  by_guardian1_at    date,
  by_guardian1_name  text,
  by_guardian2_at    date,
  by_guardian2_name  text,

  revoked_at         date,
  revoked_note       text,

  recorded_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  primary key (player_id, scope),

  -- Una fecha de otorgamiento sin nombre no es trazable: no sirve para acreditar nada.
  constraint consent_player_named   check (by_player_at    is null or nullif(btrim(coalesce(by_player_name,''))   ,'') is not null),
  constraint consent_guardian1_named check (by_guardian1_at is null or nullif(btrim(coalesce(by_guardian1_name,'')),'') is not null),
  constraint consent_guardian2_named check (by_guardian2_at is null or nullif(btrim(coalesce(by_guardian2_name,'')),'') is not null),
  -- Dos progenitores distintos. El mismo nombre dos veces es el error de carga más probable.
  constraint consent_guardians_differ check (
    by_guardian1_name is null or by_guardian2_name is null
    or lower(btrim(by_guardian1_name)) <> lower(btrim(by_guardian2_name))
  )
);

create index if not exists player_image_consents_club_idx
  on public.player_image_consents (club_id, scope);

comment on table public.player_image_consents is
  'Consentimiento de derechos de imagen por jugador y alcance (análisis interno / difusión '
  'pública). Declarativo: quién lo otorgó y cuándo, sin documentos adjuntos. La validez la '
  'decide image_consent_state(), que exige más otorgantes cuanto menor es el jugador.';

-- ------------------------------------------- 2. el club sale del jugador, no del cliente

create or replace function public.player_image_consent_sync()
returns trigger
language plpgsql
security definer set search_path to 'public'
as $$
declare v_club uuid;
begin
  select club_id into v_club from public.players where id = new.player_id;
  if v_club is null then
    raise exception 'no existe el jugador %', new.player_id;
  end if;
  new.club_id    := v_club;   -- se ignora lo que mande el cliente
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists player_image_consents_sync on public.player_image_consents;
create trigger player_image_consents_sync
  before insert or update on public.player_image_consents
  for each row execute function public.player_image_consent_sync();

-- ------------------------------------------------------------------ 3. el estado

-- Devuelve: 'ok' | 'partial' | 'missing' | 'revoked' | 'unknown_age'
-- 'partial' existe para que la pantalla pueda decir "falta la madre" en vez de "no hay
-- consentimiento", que es lo que hace que alguien lo vaya a completar.
create or replace function public.image_consent_state(p_player_id uuid, p_scope text)
returns text
language sql
stable
security definer set search_path to 'public'
as $$
  select case
    -- Sin fecha de nacimiento no se sabe qué régimen aplica. No se asume el más laxo.
    when pl.date_of_birth is null then 'unknown_age'
    when c.player_id is null      then 'missing'
    when c.revoked_at is not null then 'revoked'

    -- Mayor de edad: basta con el propio jugador.
    when pl.date_of_birth <= current_date - interval '18 years' then
      case when c.by_player_at is not null then 'ok' else 'missing' end

    -- De 14 a 17: ambos progenitores Y el menor.
    when pl.date_of_birth <= current_date - interval '14 years' then
      case
        when c.by_guardian1_at is not null
         and c.by_guardian2_at is not null
         and c.by_player_at    is not null then 'ok'
        when c.by_guardian1_at is not null
          or c.by_guardian2_at is not null
          or c.by_player_at    is not null then 'partial'
        else 'missing'
      end

    -- Menos de 14: ambos progenitores.
    else
      case
        when c.by_guardian1_at is not null and c.by_guardian2_at is not null then 'ok'
        when c.by_guardian1_at is not null or  c.by_guardian2_at is not null then 'partial'
        else 'missing'
      end
  end
  from public.players pl
  left join public.player_image_consents c
    on c.player_id = pl.id and c.scope = p_scope
  where pl.id = p_player_id;
$$;

-- El booleano que van a consultar el reproductor y la subida de vídeo. Un jugador que no
-- existe devuelve NULL arriba, y aquí eso tiene que ser `false`, no NULL: un guard que se
-- evalúa a NULL no corta nada.
create or replace function public.image_consent_ok(p_player_id uuid, p_scope text)
returns boolean
language sql
stable
security definer set search_path to 'public'
as $$
  select coalesce(public.image_consent_state(p_player_id, p_scope) = 'ok', false);
$$;

comment on function public.image_consent_ok(uuid, text) is
  'Fail closed: sin fecha de nacimiento, sin registro, revocado o jugador inexistente -> false.';

-- ------------------------------------------------------------ 4. resumen para la pantalla

create or replace function public.club_image_consent_summary()
returns table (scope text, ok integer, partial integer, missing integer,
               revoked integer, unknown_age integer, total integer)
language sql
stable
security definer set search_path to 'public'
as $$
  with s as (select unnest(array['internal_analysis','public_release']) as scope),
  pl as (
    select id from public.players
    where club_id = public.get_user_club_id() and archived_at is null
  )
  select s.scope,
         count(*) filter (where st = 'ok')::int,
         count(*) filter (where st = 'partial')::int,
         count(*) filter (where st = 'missing')::int,
         count(*) filter (where st = 'revoked')::int,
         count(*) filter (where st = 'unknown_age')::int,
         count(st)::int
  from s
  -- LEFT: un club sin plantel devuelve los dos alcances en cero, no cero filas. Una
  -- pantalla que no recibe nada no sabe si está todo bien o si falló la consulta.
  left join lateral (
    select public.image_consent_state(pl.id, s.scope) as st from pl
  ) x on true
  group by s.scope;
$$;

grant execute on function public.image_consent_state(uuid, text)  to authenticated;
grant execute on function public.image_consent_ok(uuid, text)     to authenticated;
grant execute on function public.club_image_consent_summary()     to authenticated;

-- ------------------------------------------------------------------ 5. RLS

alter table public.player_image_consents enable row level security;

-- Se ve el consentimiento de los jugadores que ya se pueden ver: el EXISTS pasa por la RLS
-- de players, así que no se duplica aquí la lógica de equipos (y no se desincroniza).
-- El club_id explícito es defensa en profundidad, no la única barrera.
drop policy if exists consents_scoped_select on public.player_image_consents;
create policy consents_scoped_select on public.player_image_consents
for select using (
  club_id = public.get_user_club_id()
  and exists (select 1 from public.players pl where pl.id = player_id)
);

-- Escribe quien gestiona la plantilla. Un consentimiento lo recoge el club, no el analista.
drop policy if exists consents_scoped_write on public.player_image_consents;
create policy consents_scoped_write on public.player_image_consents
for all using (
  club_id = public.get_user_club_id()
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role in ('admin','owner') or p.club_role in ('admin','owner'))
    )
    or public.has_full_planning_access()
  )
) with check (
  club_id = public.get_user_club_id()
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role in ('admin','owner') or p.club_role in ('admin','owner'))
    )
    or public.has_full_planning_access()
  )
);

-- Soporte, por la puerta que el club abre y puede cerrar (163-172).
drop policy if exists consents_support_select on public.player_image_consents;
create policy consents_support_select on public.player_image_consents
for select using (public.support_access(club_id));

drop policy if exists consents_support_write on public.player_image_consents;
create policy consents_support_write on public.player_image_consents
for all using (public.support_access(club_id))
     with check (public.support_access(club_id));

-- ------------------------------------------------------------------ 6. comprobaciones

do $$
declare
  v_player uuid;
  v_club   uuid;
  v_state  text;
begin
  -- Un jugador que no existe no puede dar 'ok'.
  if public.image_consent_ok('00000000-0000-0000-0000-000000000000'::uuid, 'internal_analysis') then
    raise exception 'image_consent_ok() abre la puerta para un jugador inexistente';
  end if;

  -- Y una ficha SIN fecha de nacimiento tampoco, que es el caso de las 24 de hoy.
  select id, club_id into v_player, v_club
  from public.players where date_of_birth is null limit 1;

  if v_player is not null then
    v_state := public.image_consent_state(v_player, 'internal_analysis');
    if v_state is distinct from 'unknown_age' then
      raise exception 'una ficha sin fecha de nacimiento devolvio "%" en vez de unknown_age', v_state;
    end if;
    if public.image_consent_ok(v_player, 'internal_analysis') then
      raise exception 'image_consent_ok() dio true sin saber la edad del jugador';
    end if;
  end if;

  -- El trigger tiene que imponer el club del jugador aunque se mande otro.
  select id, club_id into v_player, v_club
  from public.players where date_of_birth is not null limit 1;

  if v_player is not null then
    insert into public.player_image_consents (player_id, scope, club_id)
    values (v_player, 'internal_analysis', '00000000-0000-0000-0000-000000000000'::uuid);

    if (select club_id from public.player_image_consents
        where player_id = v_player and scope = 'internal_analysis') is distinct from v_club then
      raise exception 'el trigger no forzo el club del jugador';
    end if;

    delete from public.player_image_consents
    where player_id = v_player and scope = 'internal_analysis';
  end if;
end $$;
