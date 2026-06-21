-- Migration 078: el super admin puede LISTAR todos los clubes y suscripciones
-- (necesario para el panel de cortesías). Políticas permisivas: se SUMAN a las
-- existentes, no quitan acceso a nadie.

drop policy if exists clubs_superadmin_read on public.clubs;
create policy clubs_superadmin_read on public.clubs
  for select to authenticated using (public.is_super_admin());

drop policy if exists subs_superadmin_read on public.subscriptions;
create policy subs_superadmin_read on public.subscriptions
  for select to authenticated using (public.is_super_admin());
