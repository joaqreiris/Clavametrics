-- Migración 181: support_club_id() sale temprano si quien consulta no es admin de plataforma.
--
-- EL SÍNTOMA
-- Los datos de GPS dejaron de cargar en Daily Planning: statement timeout. Pero medido con
-- RLS puesta, un `select count(*) from gps_period_reports` pelado —sin vistas, sin joins—
-- tardaba 8,5 SEGUNDOS para 16.289 filas. La card nueva por líneas fue el empujón que lo
-- tiró sobre el límite, no la causa.
--
-- LA CAUSA
-- 68 policies en más de 40 tablas (wellness, rpe, injuries, treatments, players,
-- training_sessions, gps_*, videos…) filtran con `support_access(club_id)`. Como recibe una
-- COLUMNA, Postgres no la puede evaluar una sola vez: la llama UNA VEZ POR FILA. Y cada
-- llamada entra a support_club_id(), que hace un join de cuatro tablas más support_conflict().
-- 16.289 filas × ese join = los 8,5 s.
--
-- Lo absurdo es que el 99,99% de esas llamadas las hace alguien que NO es admin de
-- plataforma, y para esa persona la respuesta siempre es NULL. El chequeo que lo resolvería
-- en un índice —`exists (… platform_admins …)`— estaba ahí, pero perdido en el medio de un
-- WHERE, así que el planificador pagaba el join igual antes de llegar a descartarlo.
--
-- EL ARREGLO
-- El mismo cuerpo, pero en plpgsql y con ese chequeo primero, con salida temprana. Medido
-- sobre la misma consulta: 8.512 ms → 610 ms. Catorce veces.
--
-- EQUIVALENCIA VERIFICADA, porque esto es una llave de acceso a datos de otro club. Se probó
-- la función vieja contra la nueva en siete escenarios (transacción con rollback), y las dos
-- devuelven exactamente lo mismo en todos: admin sin sesión abierta, sesión y permiso
-- válidos, permiso revocado, sesión expirada, veto nominal del club, conflicto declarado sin
-- renuncia expresa, y —el que importa— un usuario normal con una sesión de soporte a su
-- nombre, que sigue sin obtener nada.
--
-- LO QUE ESTA MIGRACIÓN NO HACE
-- El arreglo de raíz es que las policies dejen de llamar a la función por fila, envolviéndola
-- en un subselect: `coalesce(club_id = (select support_club_id()), false)` la convierte en un
-- InitPlan y baja la misma consulta a 247 ms (34×). Son 68 policies de seguridad y merecen su
-- propia revisión; esta migración deja el sistema usable mientras tanto.

create or replace function public.support_club_id() returns uuid
 language plpgsql
 stable
 security definer
 set search_path = public
as $function$
declare
  v_club uuid;
begin
  -- La salida temprana: sin esto, cada fila de cada tabla con policy de soporte paga el join.
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    return null;
  end if;

  select s.club_id into v_club
  from public.support_sessions s
  join public.support_grants  g on g.id = s.grant_id
  where s.admin_user_id = auth.uid()
    and s.expires_at > now()
    and g.expires_at > now()
    and g.revoked_at is null
    and g.club_id = s.club_id
    -- el veto nominal del club es absoluto: no admite renuncia por esta via
    and not exists (
      select 1 from public.support_restrictions r
      where r.club_id = s.club_id and r.admin_user_id = auth.uid()
    )
    -- el veto por conflicto declarado cae solo si ESTE permiso lleva renuncia expresa
    and (g.conflict_waived or not public.support_conflict(auth.uid(), s.club_id))
  limit 1;

  return v_club;
end;
$function$;
