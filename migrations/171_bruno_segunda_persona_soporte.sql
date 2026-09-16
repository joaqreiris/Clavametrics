-- Migración 171: Bruno Ilaria como segunda persona de soporte.
--
-- La cláusula 12.4 del contrato promete que a un club vetado lo atiende alguien distinto del
-- declarante. Hasta ahora había un solo admin de plataforma, así que esa cláusula prometía
-- algo imposible de cumplir. Bruno lo resuelve — pero sólo en parte, y conviene que quede
-- escrito por qué:
--
--   Bruno figura como sc_coach / head_performance en MOI Kompong DEWA, es decir, ejerce en
--   fútbol camboyano igual que Joaquín. Darlo de alta SIN declarar eso le abriría todos los
--   clubes de Camboya y reabriría exactamente el agujero que cerraron las migraciones 163-168.
--
-- Por eso las dos cosas van en la misma migración y son inseparables: el alta como admin de
-- plataforma y su propia declaración de conflicto. Resultado:
--   · España, Uruguay y el resto  -> Bruno puede dar soporte; Joaquín también.
--   · MOI y su U18 (su empleador) -> los dos pueden, por la excepción de empleador.
--   · Resto de Camboya           -> NINGUNO de los dos. Sigue faltando una tercera persona
--                                   ajena al fútbol camboyano, o reescribir la cláusula 12.4.
--
-- Se busca por email, no por UUID.

do $$
declare v_bruno uuid; v_eng uuid; v_club uuid; v_n int;
begin
  select id into v_bruno from public.profiles
  where lower(email) = 'brunoilaria1993@gmail.com';

  if v_bruno is null then
    raise exception 'no existe el perfil de Bruno; no se da de alta nada';
  end if;

  -- 1. Alta como admin de plataforma.
  insert into public.platform_admins (user_id) values (v_bruno)
  on conflict (user_id) do nothing;

  -- 2. Su declaración de conflicto. Sin esto, el alta de arriba es un agujero.
  if not exists (
    select 1 from public.platform_admin_engagements
    where admin_user_id = v_bruno and lower(btrim(country)) = 'cambodia' and ended_on is null
  ) then
    insert into public.platform_admin_engagements (admin_user_id, country, note, cooloff_months)
    values (v_bruno, 'Cambodia',
            'Preparador fisico (head of performance) en la Premier League de Camboya. Socio de ClavaMetrics.',
            12)
    returning id into v_eng;

    for v_club in
      select id from public.clubs
      where lower(btrim(country)) = 'cambodia' and name ilike 'MOI%KOMPONG%DEWA%'
    loop
      insert into public.platform_admin_employers (engagement_id, club_id)
      values (v_eng, v_club) on conflict do nothing;
    end loop;
  end if;

  -- 3. Comprobación: que no haya quedado ningún club camboyano ajeno abierto para Bruno.
  select count(*) into v_n
  from public.clubs c
  where lower(btrim(c.country)) = 'cambodia'
    and not public.support_conflict(v_bruno, c.id)
    and not exists (
      select 1 from public.platform_admin_employers em
      join public.platform_admin_engagements e on e.id = em.engagement_id
      where e.admin_user_id = v_bruno and em.club_id = c.id
    );
  if v_n > 0 then
    raise exception 'quedaron % clubes camboyanos accesibles para Bruno sin ser su empleador', v_n;
  end if;
end $$;
