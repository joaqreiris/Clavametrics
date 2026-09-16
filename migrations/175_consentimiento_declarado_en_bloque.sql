-- Migración 175: el consentimiento también se puede declarar en bloque, por documento.
--
-- La 173 lo modeló nombrando a cada otorgante, y para una ficha suelta está bien. Para un
-- plantel de 92 no sirve: nadie va a tipear el nombre de 92 madres, y obligar a eso empuja
-- a lo mismo que la fecha de nacimiento inventada — a rellenar cualquier cosa con tal de
-- que la pantalla deje seguir.
--
-- El caso real es otro: el club YA tiene el permiso, firmado en la ficha de inscripción
-- cuando el jugador se anotó. No hay que pedir nada nuevo, hay que volcar lo que existe.
--
-- Así que el consentimiento pasa a tener dos formas, y ninguna es mejor que la otra:
--
--   basis='named'    -> se nombra a cada otorgante (la 173). Para el caso suelto, y para
--                       cuando el permiso se pidió expresamente para esto.
--   basis='document' -> el club DECLARA que lo tiene y dice de dónde sale ("Ficha de
--                       inscripción 2026"). No se sube el papel: el club es el responsable
--                       del tratamiento y es quien tiene que poder acreditarlo. Nosotros
--                       somos encargados y registramos qué declaró y cuándo.
--
-- Esa división es la que hace que el modelo declarativo de la 173 siga siendo coherente: no
-- custodiamos pruebas, registramos declaraciones. Lo que cambia es la granularidad.
--
-- OJO con los menores: que la ficha de inscripción cubra a un menor depende de que la
-- firmaran AMBOS progenitores, y eso el sistema no lo puede verificar. No se bloquea —el
-- club es quien responde— pero la pantalla lo advierte antes de declarar en bloque.

alter table public.player_image_consents
  add column if not exists basis       text not null default 'named',
  add column if not exists basis_note  text,
  add column if not exists declared_at date,
  add column if not exists declared_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'consent_basis_check') then
    alter table public.player_image_consents
      add constraint consent_basis_check check (basis in ('named','document'));
  end if;
  -- Una declaración por documento sin decir de qué documento sale no es trazable: es
  -- exactamente el mismo problema que una fecha de otorgamiento sin nombre.
  if not exists (select 1 from pg_constraint where conname = 'consent_document_traceable') then
    alter table public.player_image_consents
      add constraint consent_document_traceable check (
        basis <> 'document'
        or (declared_at is not null and nullif(btrim(coalesce(basis_note,'')),'') is not null)
      );
  end if;
end $$;

comment on column public.player_image_consents.basis is
  'named = se nombró a cada otorgante; document = el club declara que lo tiene y dice de '
  'dónde sale (ficha de inscripción, autorización firmada). El papel nunca se sube aquí.';

-- ------------------------------------------------------------ el estado, con las dos vías

create or replace function public.image_consent_state(p_player_id uuid, p_scope text)
returns text
language sql
stable
security definer set search_path to 'public'
as $$
  select case
    -- Sin fecha de nacimiento no se sabe qué régimen aplica. No se asume el más laxo, ni
    -- siquiera cuando el club declaró por documento: si no se sabe si es menor, no se sabe
    -- si esa ficha alcanzaba.
    when pl.date_of_birth is null then 'unknown_age'
    when c.player_id is null      then 'missing'
    when c.revoked_at is not null then 'revoked'

    -- Declarado por documento: vale para cualquier edad. El club responde por el papel.
    when c.basis = 'document' then
      case when c.declared_at is not null then 'ok' else 'missing' end

    when pl.date_of_birth <= current_date - interval '18 years' then
      case when c.by_player_at is not null then 'ok' else 'missing' end

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

-- ------------------------------------------------------- declarar para muchos de una vez

-- Se hace en una función y no con un upsert desde el cliente por dos razones: el club_id
-- sale de cada jugador (no se manda), y así la declaración no puede alcanzar a jugadores
-- de otro club aunque se manden ids ajenos — la e910c5a fue justamente eso.
create or replace function public.declare_image_consent(
  p_player_ids uuid[],
  p_scopes     text[],
  p_note       text,
  p_date       date default current_date
)
returns integer
language plpgsql
security invoker set search_path to 'public'
as $$
declare
  v_club uuid := public.get_user_club_id();
  v_n    integer := 0;
begin
  if nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'hay que decir de donde sale el consentimiento';
  end if;
  if p_scopes is null or array_length(p_scopes,1) is null then
    raise exception 'hay que decir para que alcance se declara';
  end if;

  -- La RLS de player_image_consents sigue aplicando (security invoker): esto es una
  -- comodidad de escritura, no una puerta lateral.
  insert into public.player_image_consents
    (player_id, scope, club_id, basis, basis_note, declared_at, declared_by)
  select pl.id, s.scope, pl.club_id, 'document', btrim(p_note), p_date, auth.uid()
  from public.players pl
  cross join unnest(p_scopes) as s(scope)
  where pl.id = any(p_player_ids)
    and pl.club_id = v_club          -- ids de otro club se ignoran, no fallan
  on conflict (player_id, scope) do update
    set basis       = 'document',
        basis_note  = excluded.basis_note,
        declared_at = excluded.declared_at,
        declared_by = excluded.declared_by,
        -- Declarar de nuevo levanta una revocación anterior: es una decisión nueva del club.
        revoked_at  = null;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.declare_image_consent(uuid[], text[], text, date) to authenticated;

comment on function public.declare_image_consent(uuid[], text[], text, date) is
  'Declara consentimiento por documento para varios jugadores. Ignora los ids que no sean '
  'del club de quien llama. Devuelve cuántas filas escribió.';

-- ------------------------------------------------------------------ comprobaciones

do $$
declare
  v_sin_fecha uuid;
  v_st text;
begin
  -- Una declaración por documento NO puede saltarse la fecha de nacimiento.
  select id into v_sin_fecha from public.players where date_of_birth is null limit 1;
  if v_sin_fecha is not null then
    insert into public.player_image_consents
      (player_id, scope, club_id, basis, basis_note, declared_at)
    values (v_sin_fecha, 'internal_analysis',
            (select club_id from public.players where id = v_sin_fecha),
            'document', 'Ficha de inscripcion (prueba)', current_date);

    v_st := public.image_consent_state(v_sin_fecha, 'internal_analysis');
    if v_st is distinct from 'unknown_age' then
      raise exception 'una ficha sin fecha declarada por documento dio "%" en vez de unknown_age', v_st;
    end if;
    if public.image_consent_ok(v_sin_fecha, 'internal_analysis') then
      raise exception 'declarar por documento abrio la puerta sin saber la edad';
    end if;

    delete from public.player_image_consents where player_id = v_sin_fecha;
  end if;

  -- Y una declaración sin decir de dónde sale no debe entrar.
  begin
    insert into public.player_image_consents
      (player_id, scope, club_id, basis, declared_at)
    select id, 'internal_analysis', club_id, 'document', current_date
    from public.players where date_of_birth is not null limit 1;
    raise exception 'se acepto una declaracion por documento sin origen';
  exception when check_violation then null;
  end;
end $$;
