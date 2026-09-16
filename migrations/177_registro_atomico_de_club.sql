-- Migración 177: el alta de un club vuelve a funcionar, y en un solo paso.
--
-- ── El bug ──
--
-- Desde hace días NADIE podía registrarse. El alta devolvía:
--     new row violates row-level security policy for table "clubs"
--
-- Y la policy de INSERT no tenía nada que ver: el insert PASA. Lo que fallaba era
-- devolver la fila. Register.html hacía `.insert(...).select('id')`, y ese RETURNING
-- obliga a pasar también la policy de SELECT, que es:
--
--     Users can view their club  →  id = get_user_club_id()
--
-- En ese instante el usuario todavía NO tiene perfil —el perfil se creaba en el paso
-- siguiente, con el club_id recién obtenido—, así que get_user_club_id() devuelve NULL
-- y no puede leer el club que acaba de crear. El huevo y la gallina. PostgREST lo
-- reporta como violación de RLS y el alta entera se cae.
--
-- Se comprobó aislando el request: el mismo INSERT sin `?select=id` devuelve 201.
--
-- ── Por qué una función y no una policy más ──
--
-- Se podría abrir el SELECT para el club recién creado, pero eso pide una marca de
-- "lo creé yo" que hoy no existe, y deja el alta repartida en dos escrituras sin
-- transacción. Que es el segundo problema: si la primera funciona y la segunda falla,
-- queda basura. Hoy mismo quedó un usuario en auth.users sin club ni perfil, huérfano,
-- y su correo ya no se puede volver a usar para registrarse.
--
-- Acá el club y el perfil se crean JUNTOS o no se crea ninguno, y como es security
-- definer no depende de poder leerse a sí mismo a mitad de camino.
--
-- ── Una cuenta, una organización ──
--
-- La función rechaza a quien ya tiene perfil. No es una restricción nueva: es el
-- modelo (profiles.id es la clave y club_id es NOT NULL). Antes eso no se decía en
-- ningún lado y el segundo intento fallaba de formas raras; ahora falla con un motivo.

-- La firma vieja (text, text) queda obsoleta: referenciaba `clubs.slug`, una columna
-- que ya no existe, así que llamarla reventaba con 'column "slug" does not exist'.
drop function if exists public.register_new_club(text, text);

create or replace function public.register_new_club(
  p_club_name  text,
  p_country    text    default null,
  p_sport      text    default 'football',
  p_first_name text    default null,
  p_last_name  text    default null,
  p_phone      text    default null,
  p_marketing  boolean default false,
  p_lead       jsonb   default '{}'::jsonb
) returns uuid
language plpgsql
security definer set search_path to 'public'
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_club  uuid;
  v_name  text := btrim(coalesce(p_club_name, ''));
  v_full  text;
begin
  if v_user is null then
    raise exception 'no hay sesión' using errcode = '28000';
  end if;
  if v_name = '' then
    raise exception 'el club necesita un nombre' using errcode = '22023';
  end if;

  -- Una cuenta pertenece a una sola organización. Sin esto, cualquiera con sesión
  -- podría crear clubes en bucle llamando a la función.
  if exists (select 1 from public.profiles p where p.id = v_user) then
    raise exception 'esta cuenta ya pertenece a una organización'
      using errcode = '23505',
            hint = 'Para abrir otra, registrate con un correo distinto.';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into public.clubs (
    name, country, sport,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page
  ) values (
    v_name,
    nullif(btrim(coalesce(p_country,'')),''),
    coalesce(nullif(btrim(coalesce(p_sport,'')),''), 'football'),
    p_lead->>'utm_source', p_lead->>'utm_medium', p_lead->>'utm_campaign',
    p_lead->>'utm_content', p_lead->>'utm_term', p_lead->>'referrer', p_lead->>'landing_page'
  )
  returning id into v_club;

  v_full := btrim(concat_ws(' ', nullif(btrim(coalesce(p_first_name,'')),''),
                                 nullif(btrim(coalesce(p_last_name,'')),'')));

  insert into public.profiles (
    id, club_id, email, full_name, first_name, last_name, role, phone,
    marketing_opt_in, marketing_opt_in_at
  ) values (
    v_user, v_club, v_email,
    nullif(v_full,''),
    nullif(btrim(coalesce(p_first_name,'')),''),
    nullif(btrim(coalesce(p_last_name,'')),''),
    'admin',
    nullif(btrim(coalesce(p_phone,'')),''),
    coalesce(p_marketing, false),
    case when p_marketing then now() else null end
  );

  return v_club;
end $$;

comment on function public.register_new_club(text,text,text,text,text,text,boolean,jsonb) is
  'Alta de club: crea el club y el perfil admin de quien llama, juntos o ninguno. '
  'Security definer porque en ese momento el usuario todavía no puede leer el club que '
  'está creando (la policy de SELECT exige ser miembro). Rechaza a quien ya tiene perfil.';

grant execute on function public.register_new_club(text,text,text,text,text,text,boolean,jsonb) to authenticated;
