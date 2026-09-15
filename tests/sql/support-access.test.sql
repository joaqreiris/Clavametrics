-- Prueba de regresión del acceso de soporte (migraciones 163-165).
--
-- Qué garantiza: que ser dueño de la plataforma NO abre datos deportivos ni
-- clínicos de ningún club, que el permiso de un club abre SOLO ese club, que
-- caduca, que el veto por conflicto de interés no lo puede levantar el vetado,
-- y que el libro de visitas no se puede tocar.
--
-- Cómo correrlo (no escribe nada: termina en rollback):
--   supabase   -> pegarlo entero en el SQL Editor
--   psql       -> psql "$DATABASE_URL" -f tests/sql/support-access.test.sql
--
-- Sale en silencio si todo está bien; levanta excepción con la lista de fallos
-- si algo se aflojó. No usa UUIDs fijos: elige los clubes solo.

begin;

do $$
declare
  v_admin        uuid;
  v_admin_club   uuid;
  v_club         uuid;   -- club ajeno al admin, con datos
  v_otro         uuid;   -- un tercer club, para detectar fugas laterales
  v_mgr          uuid;   -- admin/owner del club ajeno
  v_n            int;
  v_ok           boolean;
  v_fallos       text := '';
begin
  ------------------------------------------------------------------ fixtures

  select pa.user_id, pr.club_id into v_admin, v_admin_club
  from public.platform_admins pa join public.profiles pr on pr.id = pa.user_id
  limit 1;
  if v_admin is null then
    raise notice 'sin platform_admins: no hay nada que probar'; return;
  end if;

  -- un club que no sea el del admin y que tenga jugadores
  select p.club_id into v_club
  from public.players p
  where p.club_id is distinct from v_admin_club
  group by p.club_id having count(*) > 0
  order by count(*) desc limit 1;
  if v_club is null then
    raise notice 'no hay otro club con jugadores: no hay nada que probar'; return;
  end if;

  select pr.id into v_mgr from public.profiles pr
  where pr.club_id = v_club
    and (lower(coalesce(pr.role,'')) in ('admin','owner')
      or lower(coalesce(pr.club_role,'')) in ('admin','owner'))
  limit 1;
  if v_mgr is null then
    raise notice 'el club % no tiene admin/owner: no hay nada que probar', v_club; return;
  end if;

  -- un tercer club, para comprobar que el permiso de uno no abre el de al lado
  select c.id into v_otro from public.clubs c
  where c.id not in (v_club, coalesce(v_admin_club, '00000000-0000-0000-0000-000000000000'::uuid))
  limit 1;

  ------------------------------------------- A. sin permiso no se ve un carajo

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if public.is_super_admin() then
    v_fallos := v_fallos || E'\n  A1: is_super_admin() da true sin sesion de soporte';
  end if;
  if not public.is_platform_admin() then
    v_fallos := v_fallos || E'\n  A2: is_platform_admin() se rompio (el negocio deja de funcionar)';
  end if;

  select count(*) into v_n from public.players  where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  A3: veo %s jugadores de un club ajeno sin permiso', v_n); end if;
  select count(*) into v_n from public.wellness where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  A4: veo %s filas de wellness ajeno sin permiso', v_n); end if;
  select count(*) into v_n from public.injuries where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  A5: veo %s lesiones ajenas sin permiso', v_n); end if;
  select count(*) into v_n from public.rpe      where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  A6: veo %s RPE ajenos sin permiso', v_n); end if;
  select count(*) into v_n from public.availability where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  A6b: veo %s filas de disponibilidad ajena sin permiso', v_n); end if;
  select count(*) into v_n from public.treatments where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  A7: veo %s tratamientos ajenos sin permiso', v_n); end if;

  -- y no puedo forzar la entrada
  begin
    perform public.support_session_open(v_club, 'sin permiso');
    v_fallos := v_fallos || E'\n  A8: me dejo abrir sesion sin que el club autorizara';
  exception when others then null;
  end;

  ------------------------------------- B. con permiso, solo ESE club se abre

  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_mgr, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.support_grant_open(v_club, 24, 'prueba de regresion');

  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.support_session_open(v_club, 'prueba de regresion');

  select count(*) into v_n from public.players where club_id = v_club;
  if v_n = 0 then v_fallos := v_fallos || E'\n  B1: con permiso sigo sin ver nada (el soporte quedo inutil)'; end if;

  if v_otro is not null then
    select count(*) into v_n from public.players where club_id = v_otro;
    if v_n > 0 then v_fallos := v_fallos || format(E'\n  B2: FUGA: el permiso de un club me abrio %s jugadores de otro', v_n); end if;
    select count(*) into v_n from public.wellness where club_id = v_otro;
    if v_n > 0 then v_fallos := v_fallos || format(E'\n  B3: FUGA: wellness de otro club (%s filas)', v_n); end if;
    select count(*) into v_n from public.injuries where club_id = v_otro;
    if v_n > 0 then v_fallos := v_fallos || format(E'\n  B4: FUGA: lesiones de otro club (%s filas)', v_n); end if;
  end if;

  -- la entrada quedo registrada y el club la puede leer
  select count(*) into v_n from public.platform_access_log
   where club_id = v_club and event = 'session_opened';
  if v_n = 0 then v_fallos := v_fallos || E'\n  B5: entre a un club y no quedo registrado'; end if;

  --------------------------------------------------- C. la ventana caduca sola

  execute 'reset role';
  update public.support_sessions set expires_at = now() - interval '1 minute'
   where admin_user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.players where club_id = v_club;
  if v_n > 0 then v_fallos := v_fallos || format(E'\n  C1: la sesion caduco y sigo viendo %s jugadores', v_n); end if;

  ------------------------------------------ D. el veto por conflicto de interes

  insert into public.support_restrictions (club_id, admin_user_id, reason, created_by)
  values (v_club, v_admin, 'prueba: mismo torneo', v_admin);

  -- renovar la ventana para que el unico impedimento sea el veto
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_mgr, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.support_grant_open(v_club, 24, 'prueba veto');

  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_ok := false;
  begin
    perform public.support_session_open(v_club, 'entrar estando vetado');
  exception when others then v_ok := true;
  end;
  if not v_ok then v_fallos := v_fallos || E'\n  D1: entre a un club que me tiene vetado'; end if;

  -- y no me puedo levantar el veto solo
  delete from public.support_restrictions where club_id = v_club and admin_user_id = v_admin;
  if not exists (select 1 from public.support_restrictions
                 where club_id = v_club and admin_user_id = v_admin) then
    v_fallos := v_fallos || E'\n  D2: me levante mi propio veto (solo deberia poder el club)';
  end if;

  ------------------------------------------- E. el libro de visitas es de piedra

  v_ok := false;
  begin
    update public.platform_access_log set resource = 'tocado' where club_id = v_club;
  exception when others then v_ok := true;
  end;
  if not v_ok then v_fallos := v_fallos || E'\n  E1: pude editar el log de accesos'; end if;

  v_ok := false;
  begin
    delete from public.platform_access_log where club_id = v_club;
  exception when others then v_ok := true;
  end;
  if not v_ok then v_fallos := v_fallos || E'\n  E2: pude borrar el log de accesos'; end if;

  ----------------------------------- F. el club no perdio acceso a lo suyo

  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_mgr, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.players where club_id = v_club;
  if v_n = 0 then v_fallos := v_fallos || E'\n  F1: el club dejo de ver sus propios jugadores'; end if;
  select count(*) into v_n from public.rpe where club_id = v_club;
  if v_n = 0 then v_fallos := v_fallos || E'\n  F1b: el club dejo de ver su propio RPE'; end if;
  select count(*) into v_n from public.availability where club_id = v_club;
  if v_n = 0 then v_fallos := v_fallos || E'\n  F1c: el club dejo de ver su propia disponibilidad'; end if;
  select count(*) into v_n from public.assessment_test_defs where club_id is null;
  if v_n = 0 then v_fallos := v_fallos || E'\n  F2: el club dejo de ver el catalogo global de tests'; end if;

  execute 'reset role';

  ------------------------------------------------------------------ veredicto

  if v_fallos <> '' then
    raise exception 'ACCESO DE SOPORTE ROTO:%', v_fallos;
  end if;
  raise notice 'acceso de soporte OK (club probado: %)', v_club;
end $$;

rollback;
