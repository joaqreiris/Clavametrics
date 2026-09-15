-- Migración 169: la declaración del fundador.
--
-- Ejerce como preparador físico en la Premier League de Camboya, empleado en MOI Kompong
-- DEWA y su U18. Con la 168 aplicada, eso basta: todo club camboyano que NO sea su
-- empleador queda vetado, incluidos los que se den de alta dentro de dos años, y el veto
-- le sigue 12 meses después de irse de la liga.
--
-- Se busca por email y por nombre a propósito: nada de UUIDs clavados, para que la
-- migración sirva igual en otro entorno.
--
-- Cuando cambie de liga, NO se toca esta fila: se cierra con ended_on (el trigger de la
-- 168 no deja borrarla ni reescribirla) y se declara la nueva.

do $$
declare v_admin uuid; v_eng uuid; v_club uuid;
begin
  select pa.user_id into v_admin
  from public.platform_admins pa
  join public.profiles p on p.id = pa.user_id
  where lower(p.email) = 'reiris.joaquin@gmail.com';

  if v_admin is null then
    raise notice 'no existe ese admin de plataforma; no se declara nada';
    return;
  end if;

  if exists (select 1 from public.platform_admin_engagements
             where admin_user_id = v_admin and lower(btrim(country)) = 'cambodia'
               and ended_on is null) then
    raise notice 'ya estaba declarado';
    return;
  end if;

  insert into public.platform_admin_engagements (admin_user_id, country, note, cooloff_months)
  values (v_admin, 'Cambodia',
          'Preparador fisico en la Premier League de Camboya. Declarado por el propio fundador.',
          12)
  returning id into v_eng;

  -- Los clubes donde efectivamente trabaja: son la excepción al veto de su propio país.
  -- El trigger de la 168 deja constancia en el registro que ESE club lee, para que
  -- declararse empleado de alguien no pueda ser una puerta trasera silenciosa.
  for v_club in
    select id from public.clubs
    where lower(btrim(country)) = 'cambodia'
      and name ilike 'MOI%KOMPONG%DEWA%'
  loop
    insert into public.platform_admin_employers (engagement_id, club_id)
    values (v_eng, v_club) on conflict do nothing;
  end loop;
end $$;
