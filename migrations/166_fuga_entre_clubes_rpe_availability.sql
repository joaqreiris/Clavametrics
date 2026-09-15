-- Migración 166: fuga de datos ENTRE CLUBES en rpe y availability.
--
-- Encontrada por tests/sql/support-access.test.sql al cerrar la llave maestra.
-- No tiene nada que ver con el super admin: cualquier admin de cualquier club
-- podía leer el RPE y la disponibilidad de TODOS los demás clubes.
--
-- Causa: has_full_planning_access() responde "este usuario es admin/dirección"
-- sin mirar DE QUÉ CLUB. En casi todas las políticas está bien porque va dentro
-- de un AND con el club:
--     club_id = get_user_club_id() AND has_full_planning_access()
-- pero en estas dos quedó como rama suelta de un OR:
--     support_access(club_id) OR has_full_planning_access() OR ...
-- y esa rama es verdadera para cualquier fila de cualquier club.
--
-- Medido antes del arreglo, con el admin de un club real:
--   rpe          -> 8049 filas de otros clubes visibles
--   availability -> 1685 filas de otros clubes visibles
-- Ninguna de las dos tablas tiene filas con club_id null, así que meter el
-- club dentro del AND no deja a nadie fuera de lo suyo.

drop policy if exists rpe_scoped_select on public.rpe;
create policy rpe_scoped_select on public.rpe
  for select to public
  using (
    public.support_access(club_id)
    or (club_id = public.get_user_club_id() and public.has_full_planning_access())
    or player_id in (select public.my_player_ids())
  );

drop policy if exists availability_scoped_select on public.availability;
create policy availability_scoped_select on public.availability
  for select to public
  using (
    public.support_access(club_id)
    or (club_id = public.get_user_club_id() and public.has_full_planning_access())
    or player_id in (select (public.my_player_ids())::text)
  );

-- Red de seguridad: que no vuelva a colarse una rama de planning/medical sin club.
-- Si aparece una, la migración falla en vez de dejar la fuga en silencio.
do $$
declare r record; v_malas text := '';
begin
  for r in
    select tablename, policyname, qual
    from pg_policies
    where schemaname='public' and permissive='PERMISSIVE' and qual is not null
      and (qual ilike '%has_full_planning_access%' or qual ilike '%has_medical_access%')
  loop
    -- toda política que use esas funciones tiene que nombrar el club en el mismo qual
    if r.qual !~* 'club_id' then
      v_malas := v_malas || format(E'\n  %s.%s', r.tablename, r.policyname);
    end if;
  end loop;
  if v_malas <> '' then
    raise exception 'politicas de planning/medical sin acotar por club:%', v_malas;
  end if;
end $$;
