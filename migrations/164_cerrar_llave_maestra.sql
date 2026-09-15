-- Migración 164: se acabó la llave maestra.
--
-- is_super_admin() pasa a significar "admin de plataforma CON una sesión de soporte
-- viva, autorizada por el club y no vetada". Como las 131 políticas de datos cuelgan
-- de esa función, se cierran todas de golpe.
--
-- Antes del corte, lo que SÍ es del negocio (planes, facturación, módulos, alta de
-- clubes) se mueve a is_platform_admin(), que no cambia. La línea es:
--   la plataforma sabe quién sos, qué plan tenés y qué módulos tenés.
--   la plataforma NUNCA sabe qué hacen tus jugadores.
--
-- Requiere la 163 aplicada.

-- ------------------------------------------- 1. negocio -> is_platform_admin()

drop policy if exists clubs_super_select on public.clubs;
create policy clubs_super_select on public.clubs
  for select to authenticated using (public.is_platform_admin());

drop policy if exists clubs_superadmin_read on public.clubs;
create policy clubs_superadmin_read on public.clubs
  for select to authenticated using (public.is_platform_admin());

drop policy if exists clubs_super_update on public.clubs;
create policy clubs_super_update on public.clubs
  for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists subs_superadmin_read on public.subscriptions;
create policy subs_superadmin_read on public.subscriptions
  for select to authenticated using (public.is_platform_admin());

drop policy if exists billing_alerts_super_all on public.billing_alerts;
create policy billing_alerts_super_all on public.billing_alerts
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists club_feature_flags_super_all on public.club_feature_flags;
create policy club_feature_flags_super_all on public.club_feature_flags
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists club_modules_super_all on public.club_modules;
create policy club_modules_super_all on public.club_modules
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists member_modules_super_all on public.member_modules;
create policy member_modules_super_all on public.member_modules
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists role_default_modules_super_all on public.role_default_modules;
create policy role_default_modules_super_all on public.role_default_modules
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists platform_settings_super_write on public.platform_settings;
create policy platform_settings_super_write on public.platform_settings
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists profiles_super_select on public.profiles;
create policy profiles_super_select on public.profiles
  for select to authenticated using (public.is_platform_admin());

drop policy if exists invitations_super_all on public.invitations;
create policy invitations_super_all on public.invitations
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- catálogos globales: no pertenecen a ningún club
drop policy if exists competitions_super_all on public.competitions;
create policy competitions_super_all on public.competitions
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists foods_write on public.foods;
create policy foods_write on public.foods
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- assessment_test_defs mezcla el catálogo global (club_id null) con defs de club.
-- La plataforma mantiene SOLO las globales.
drop policy if exists assessment_test_defs_platform_global on public.assessment_test_defs;
create policy assessment_test_defs_platform_global on public.assessment_test_defs
  for all to authenticated
  using (public.is_platform_admin() and club_id is null)
  with check (public.is_platform_admin() and club_id is null);

-- el audit_log de un club ES dato del club: se mira con permiso y por club.
drop policy if exists audit_log_super_select on public.audit_log;
create policy audit_log_super_select on public.audit_log
  for select to authenticated using (public.support_access(club_id));

-- ------------------------------------- 2. funciones de negocio -> plataforma

create or replace function public.grant_comp_subscription(p_team_id uuid, p_plan_slug text default 'full'::text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
DECLARE v_club_id uuid; v_plan_id uuid; v_sub_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede otorgar cortesias';
  END IF;
  SELECT club_id INTO v_club_id FROM public.teams WHERE id = p_team_id;
  IF v_club_id IS NULL THEN RAISE EXCEPTION 'team % no existe', p_team_id; END IF;
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan % no existe', p_plan_slug; END IF;
  UPDATE public.subscriptions SET status = 'canceled', canceled_at = now()
   WHERE team_id = p_team_id AND status IN ('active','trialing','past_due','paused');
  INSERT INTO public.subscriptions
    (team_id, club_id, plan_id, status, billing_cycle, is_comp, current_period_start, current_period_end)
  VALUES (p_team_id, v_club_id, v_plan_id, 'active', 'monthly', true, now(), now() + interval '10 years')
  RETURNING id INTO v_sub_id;
  RETURN v_sub_id;
END; $$;

create or replace function public.grant_comp_subscription_club(p_club_id uuid, p_plan_slug text default 'full'::text)
returns integer language plpgsql security definer set search_path to 'public' as $$
DECLARE v_count int := 0; r record;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede otorgar cortesias';
  END IF;
  FOR r IN SELECT id FROM public.teams WHERE club_id = p_club_id LOOP
    PERFORM public.grant_comp_subscription(r.id, p_plan_slug);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

create or replace function public.revoke_comp_subscription(p_team_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede revocar cortesias';
  END IF;
  UPDATE public.subscriptions SET status = 'canceled', canceled_at = now()
   WHERE team_id = p_team_id AND is_comp = true AND status = 'active';
END; $$;

create or replace function public.set_paddle_env(p_env text)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_platform_admin() then raise exception 'not authorized'; end if;
  if p_env not in ('sandbox','production') then raise exception 'invalid env'; end if;
  insert into public.platform_settings(key,value,updated_at) values ('paddle_env',p_env,now())
    on conflict (key) do update set value=excluded.value, updated_at=now();
  return p_env;
end; $$;

-- ------------------------- 3. las dos puertas grandes, cerradas POR CLUB

-- my_player_ids() daba TODOS los jugadores de TODOS los clubes al super admin.
-- Ahora solo los del club que autorizó la sesión.
create or replace function public.my_player_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select p.id from public.players p
  where public.support_access(p.club_id)
     or (
      p.club_id = (select club_id from public.profiles where id = auth.uid())
      and (
        exists (select 1 from public.profiles pr where pr.id = auth.uid()
                and (pr.role in ('admin','owner') or pr.club_role in ('admin','owner')))
        or exists (
          select 1 from public.player_teams pt
          where pt.player_id = p.id and pt.team_id in (select public.my_team_ids())
        )
      )
    );
$$;

-- is_my_club() también pasa a ser por club, no "cualquier club".
create or replace function public.is_my_club(p_club uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v_role text; v_club uuid;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;
  -- Backend (service_role) o ejecucion sin JWT (jobs, funciones DEFINER internas).
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return true;
  end if;
  if public.support_access(p_club) then return true; end if;
  v_club := public.get_user_club_id();
  return coalesce(v_club is not null and p_club is not distinct from v_club, false);
end; $$;

-- Durante una sesión de soporte, lo que escribas se audita contra el club
-- soportado, no contra el tuyo.
create or replace function public.log_audit(p_table text, p_op text, p_changes jsonb default null, p_club_id uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_own uuid; v_club uuid; v_support uuid;
begin
  v_support := public.support_club_id();
  select club_id into v_own from public.profiles where id = auth.uid();
  if v_support is not null then
    v_club := coalesce(p_club_id, v_support);
  elsif p_club_id is not null and p_club_id = v_own then
    v_club := p_club_id;
  else
    v_club := v_own;
  end if;
  if v_club is null then return; end if;
  set local row_security = off;
  insert into public.audit_log (club_id, actor_id, table_name, operation, changes)
  values (v_club, auth.uid(), p_table, p_op, p_changes);
end; $$;

-- ------------------------------------------------------- 4. EL CORTE

-- A partir de aquí, ser dueño de la plataforma no abre ni una fila de datos
-- deportivos. Hace falta que el club abra la ventana, y queda registrado.
-- coalesce explícito: este guard nunca devuelve NULL.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.support_club_id() is not null, false);
$$;

comment on function public.is_super_admin() is
  'NO es "soy el dueno". Es "soy admin de plataforma Y tengo una sesion de soporte '
  'viva, autorizada por el club y registrada en platform_access_log". Para tareas de '
  'negocio (planes, facturacion, modulos, alta de clubes) usar is_platform_admin().';
