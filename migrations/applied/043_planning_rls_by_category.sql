-- =========================================================
-- 043 — FASE 4: RLS por categoría en microcycles, training_sessions, calendar_events
-- Modelo: super/admin/owner ven todo el club; staff ve solo sus categorías (my_team_ids).
-- =========================================================

-- helper: ¿el usuario tiene acceso total al club? (admin/owner/super)
create or replace function public.has_full_planning_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('admin','owner'));
$$;

-- ───────────── MICROCYCLES ─────────────
-- limpiar TODO lo viejo (incluido el agujero 'public access')
drop policy if exists "public access" on public.microcycles;
drop policy if exists "microcycles_all" on public.microcycles;
drop policy if exists "Club members can view microcycles" on public.microcycles;
drop policy if exists "Club members can insert microcycles" on public.microcycles;
drop policy if exists "Club members can update microcycles" on public.microcycles;
drop policy if exists "Club members can delete microcycles" on public.microcycles;
drop policy if exists mc_scoped_select on public.microcycles;
drop policy if exists mc_scoped_cud on public.microcycles;

create policy mc_scoped_select on public.microcycles for select using (
  club_id = public.get_user_club_id()
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
);
create policy mc_scoped_cud on public.microcycles for all using (
  club_id = public.get_user_club_id()
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
) with check (
  club_id = public.get_user_club_id()
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
);

-- ───────────── TRAINING_SESSIONS ─────────────
drop policy if exists "Club members can view their sessions" on public.training_sessions;
drop policy if exists "Club members can insert sessions" on public.training_sessions;
drop policy if exists "Club members can update sessions" on public.training_sessions;
drop policy if exists "Club members can delete sessions" on public.training_sessions;
drop policy if exists ts_scoped_select on public.training_sessions;
drop policy if exists ts_scoped_cud on public.training_sessions;

create policy ts_scoped_select on public.training_sessions for select using (
  club_id = public.get_user_club_id()
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
);
create policy ts_scoped_cud on public.training_sessions for all using (
  club_id = public.get_user_club_id()
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
) with check (
  club_id = public.get_user_club_id()
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
);

-- ───────────── CALENDAR_EVENTS ─────────────
drop policy if exists "club members can read" on public.calendar_events;
drop policy if exists "club members can insert" on public.calendar_events;
drop policy if exists "club members can update" on public.calendar_events;
drop policy if exists "club members can delete" on public.calendar_events;
drop policy if exists ce_scoped_select on public.calendar_events;
drop policy if exists ce_scoped_cud on public.calendar_events;

create policy ce_scoped_select on public.calendar_events for select using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
);
create policy ce_scoped_cud on public.calendar_events for all using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
) with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and ( public.has_full_planning_access()
        or team_id in (select public.my_team_ids()) )
);
