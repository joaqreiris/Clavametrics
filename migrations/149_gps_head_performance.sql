-- Migración 149: el responsable de rendimiento puede operar la integración GPS.
--
-- El rol 'head_performance' existe y hay usuarios con él, pero no podía sincronizar sus
-- propios datos de GPS ni terminar el mapeo de atletas: entraba a GPS Analysis, veía el
-- panel, y el servidor le devolvía 403. La 131 dejó anotado el motivo — role_bucket()
-- mapea head_performance al bucket 'direction', y el gate pedía 'admin' o 'sc'.
--
-- Se habilita POR SLUG y no moviéndolo al bucket 'sc'. El bucket es de dónde cuelga su
-- acceso al módulo de dirección (sidebar, cmTacticalAccess, policies que miran
-- role_bucket()); cambiarlo para arreglar el GPS le sacaría todo eso. Es un rol que hace
-- las dos cosas, así que se nombra en la puerta del GPS sin tocar su bucket.
--
-- Sigue siendo canConfig y NO canConnect: el token de la API del proveedor continúa
-- reservado a admin/owner en Admin.html. Esto habilita verificar, mapear métricas,
-- mapear atletas y sincronizar — el trabajo diario de quien usa los datos.
--
-- Los otros dos lugares que deciden este mismo permiso se cambian en el mismo commit:
-- cmCanImportGps() en assets/supabase-init.js (UI) y _SYNC_ROLES en
-- supabase/functions/gps-sync/index.ts (el arranque del sync). Si los tres no dicen lo
-- mismo, el rol ve el botón y recibe un 403 al apretarlo.

create or replace function public.can_configure_gps()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (
         public.role_bucket(p.role)      in ('admin', 'sc') or
         public.role_bucket(p.club_role) in ('admin', 'sc') or
         lower(p.role)      = 'head_performance' or
         lower(p.club_role) = 'head_performance'
       )
  );
$$;

comment on function public.can_configure_gps() is
  'true si el usuario puede configurar la integración GPS (verificar, listar atletas y '
  'parámetros). Equivale al canConfig del panel: buckets admin y sc, más el rol '
  'head_performance por slug (su bucket es direction y no se mueve), mirando rol '
  'principal y secundario. La usan las Edge Functions gps-verify / gps-athletes / '
  'gps-parameters. Espejo en JS: cmCanImportGps() en assets/supabase-init.js.';

revoke all on function public.can_configure_gps() from public;
revoke all on function public.can_configure_gps() from anon;
grant execute on function public.can_configure_gps() to authenticated;
