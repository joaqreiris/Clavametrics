-- Migración 165: el permiso de un club abre SOLO ese club.
--
-- Tras la 164, is_super_admin() ya exige una sesión de soporte viva. Pero las
-- políticas dicen "es super admin" sin mirar de qué club es la fila: con una
-- ventana abierta por MOI se veían igual los 149 jugadores de los 6 clubes.
--
-- Aquí se cambia is_super_admin() por support_access(club_id) en las políticas
-- PERMISIVAS (las que abren puertas). Las 46 RESTRICTIVAS (*_plan_gate) se dejan
-- como están: son rejas de plan, no puertas de datos, y ya cuelgan del guard
-- cerrado de la 164.

-- ------------------------- 1. las 67 mecánicas: tabla con club_id propio

do $$
declare r record; ddl text;
begin
  for r in
    select p.tablename, p.policyname, p.cmd,
           array_to_string(p.roles, ', ') as roles, p.qual, p.with_check
    from pg_policies p
    where p.schemaname = 'public'
      and p.permissive = 'PERMISSIVE'
      and (p.qual ilike '%is_super_admin%' or p.with_check ilike '%is_super_admin%')
      -- solo tablas que saben de qué club es cada fila
      and exists (select 1 from information_schema.columns c
                  where c.table_schema='public' and c.table_name=p.tablename
                    and c.column_name='club_id')
      -- dashboards se arregla a mano más abajo: su qual anida el club
      and p.policyname <> 'dashboards_visible_select'
  loop
    ddl := format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    execute ddl;

    ddl := format('create policy %I on public.%I as permissive for %s to %s',
                  r.policyname, r.tablename,
                  case r.cmd when 'ALL' then 'all' else lower(r.cmd) end,
                  r.roles);
    if r.qual is not null then
      ddl := ddl || format(' using (%s)',
               replace(r.qual, 'is_super_admin()', 'public.support_access(club_id)'));
    end if;
    if r.with_check is not null then
      ddl := ddl || format(' with check (%s)',
               replace(r.with_check, 'is_super_admin()', 'public.support_access(club_id)'));
    end if;
    execute ddl;
    raise notice 'reescrita %.%', r.tablename, r.policyname;
  end loop;
end $$;

-- ------------------------------------------- 2. dashboards: el club por fuera

-- El original era  club_id = (mi club) AND (is_super_admin() OR ...):  sustituir
-- dentro del AND dejaba a soporte sin dashboards nunca. Se saca la rama fuera.
drop policy if exists dashboards_visible_select on public.dashboards;
create policy dashboards_visible_select on public.dashboards
  for select to authenticated
  using (
    public.support_access(club_id)
    or (
      club_id = (select p.club_id from public.profiles p where p.id = auth.uid())
      and (
        public.role_bucket((select p.role from public.profiles p where p.id = auth.uid())) = 'admin'
        or owner_id = auth.uid()
        or (is_shared and team_id is null)
        or (is_shared and team_id in (select public.my_team_ids()))
      )
    )
  );

-- ------------------------- 3. las 4 sin club_id: se cuelgan de su padre

-- mesocycles -> macrocycles -> seasons.club_id
drop policy if exists mesocycles_super_all on public.mesocycles;
create policy mesocycles_super_all on public.mesocycles
  for all to authenticated
  using (public.support_access((
    select s.club_id from public.macrocycles m
    join public.seasons s on s.id = m.season_id
    where m.id = mesocycles.macrocycle_id)))
  with check (public.support_access((
    select s.club_id from public.macrocycles m
    join public.seasons s on s.id = m.season_id
    where m.id = mesocycles.macrocycle_id)));

-- season_phases -> seasons.club_id
drop policy if exists season_phases_super_all on public.season_phases;
create policy season_phases_super_all on public.season_phases
  for all to authenticated
  using (public.support_access((
    select s.club_id from public.seasons s where s.id = season_phases.season_id)))
  with check (public.support_access((
    select s.club_id from public.seasons s where s.id = season_phases.season_id)));

-- video_share_items -> video_shares.club_id
drop policy if exists video_share_items_super_all on public.video_share_items;
create policy video_share_items_super_all on public.video_share_items
  for all to authenticated
  using (public.support_access((
    select v.club_id from public.video_shares v where v.id = video_share_items.share_id)))
  with check (public.support_access((
    select v.club_id from public.video_shares v where v.id = video_share_items.share_id)));

-- video_share_views -> video_shares.club_id
drop policy if exists video_share_views_super_all on public.video_share_views;
create policy video_share_views_super_all on public.video_share_views
  for all to authenticated
  using (public.support_access((
    select v.club_id from public.video_shares v where v.id = video_share_views.share_id)))
  with check (public.support_access((
    select v.club_id from public.video_shares v where v.id = video_share_views.share_id)));

-- ------------------------------------------------------ 4. red de seguridad

-- Si alguna política permisiva quedó colgando de is_super_admin() sin acotar por
-- club, que la migración falle en vez de dejar una puerta abierta en silencio.
do $$
declare v_quedan int;
begin
  select count(*) into v_quedan
  from pg_policies p
  where p.schemaname='public' and p.permissive='PERMISSIVE'
    and (p.qual ilike '%is_super_admin%' or p.with_check ilike '%is_super_admin%');
  if v_quedan > 0 then
    raise exception 'quedan % politicas permisivas con is_super_admin() sin acotar por club', v_quedan;
  end if;
end $$;
