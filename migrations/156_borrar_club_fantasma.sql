-- 156 — Borrar un club fantasma desde Platform Admin.
--
-- Después de una campaña quedan altas que nunca fueron nada: alguien probó el
-- registro, quedó el club con su usuario y ahí murió. Ensucian el pipeline (un
-- "cold" que no es un lead frío, es basura) y el email queda ocupado, así que esa
-- misma persona no puede volver a registrarse bien más adelante.
--
-- Esto BORRA, no archiva. Por eso el freno de mano es doble:
--   1. Sólo clubes sin nada adentro. Con un jugador cargado ya no se puede: si el
--      club llegó a usarse, borrarlo es perder trabajo de alguien.
--   2. Hay que escribir el nombre exacto del club. Un click no alcanza.

create or replace function public.delete_ghost_club(p_club_id uuid, p_club_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_club        record;
  v_jugadores   int;
  v_sesiones    int;
  v_gps         int;
  v_wellness    int;
  v_rpe         int;
  v_usuarios    uuid[];
  v_tabla       text;
  v_pasada      int;
  v_borradas    int := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'delete_ghost_club: solo platform admins' using errcode = '42501';
  end if;

  select * into v_club from public.clubs where id = p_club_id;
  if v_club is null then
    raise exception 'Ese club no existe' using errcode = 'P0002';
  end if;

  -- El nombre tipeado tiene que coincidir. Es la diferencia entre borrar el club
  -- que se quería y el de la fila de al lado.
  if btrim(coalesce(p_club_name, '')) is distinct from btrim(v_club.name) then
    raise exception 'El nombre no coincide con el del club' using errcode = '22023';
  end if;

  -- Nadie borra el club en el que está parado: se quedaría sin sesión a mitad de camino.
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.club_id = p_club_id) then
    raise exception 'Ese es tu propio club' using errcode = '22023';
  end if;

  if exists (select 1 from public.subscriptions s where s.club_id = p_club_id and s.status = 'active') then
    raise exception 'El club tiene una suscripción activa' using errcode = '22023';
  end if;

  select count(*) into v_jugadores from public.players           where club_id = p_club_id;
  select count(*) into v_sesiones  from public.training_sessions where club_id = p_club_id;
  select count(*) into v_gps       from public.gps_reports       where club_id = p_club_id;
  select count(*) into v_wellness  from public.wellness          where club_id = p_club_id;
  select count(*) into v_rpe       from public.rpe               where club_id = p_club_id;

  if v_jugadores + v_sesiones + v_gps + v_wellness + v_rpe > 0 then
    raise exception 'El club tiene datos cargados (% jugadores, % sesiones, % GPS, % wellness, % RPE). No es un club fantasma.',
      v_jugadores, v_sesiones, v_gps, v_wellness, v_rpe using errcode = '22023';
  end if;

  select coalesce(array_agg(p.id), '{}') into v_usuarios
    from public.profiles p where p.club_id = p_club_id;

  -- Hay 125 tablas con club_id y no todas tienen ON DELETE CASCADE. En vez de
  -- mantener a mano una lista que envejece con cada tabla nueva, se recorren todas
  -- y se repite la pasada: en la primera vuelta algunas fallan porque otra tabla
  -- todavía las referencia, y en la siguiente ya salen. Tres vueltas alcanzan de
  -- sobra para un club vacío; los errores intermedios se ignoran a propósito.
  for v_pasada in 1..3 loop
    for v_tabla in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'club_id'
         and t.table_type = 'BASE TABLE' and c.table_name <> 'clubs'
    loop
      begin
        execute format('delete from public.%I where club_id = $1', v_tabla) using p_club_id;
        get diagnostics v_borradas = row_count;
      exception when others then
        null;   -- lo intenta de nuevo en la pasada siguiente
      end;
    end loop;
  end loop;

  delete from public.clubs where id = p_club_id;

  -- Las cuentas que quedaron sin ningún perfil: si no se borran, ese email queda
  -- tomado y la persona no puede volver a registrarse. Nunca la del que ejecuta.
  delete from auth.users u
   where u.id = any(v_usuarios)
     and u.id <> auth.uid()
     and not exists (select 1 from public.profiles p where p.id = u.id);

  return jsonb_build_object(
    'ok', true,
    'club', v_club.name,
    'usuarios_borrados', coalesce(array_length(v_usuarios, 1), 0)
  );
end;
$$;

comment on function public.delete_ghost_club(uuid, text) is
  'Borra definitivamente un club sin datos (altas de prueba que nunca arrancaron) y las cuentas que quedan huérfanas. Sólo platform admins, sólo clubes vacíos, y exige escribir el nombre exacto.';

revoke all on function public.delete_ghost_club(uuid, text) from public, anon;
grant execute on function public.delete_ghost_club(uuid, text) to authenticated;
