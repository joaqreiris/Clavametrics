-- Migration 134: cerrar el acceso sin sesión a las funciones de LECTURA que devuelven
-- datos de un club recibido POR PARÁMETRO. Cierra la segunda mitad de B1.
--
-- Inventario de partida: 83 funciones SECURITY DEFINER ejecutables por anon.
--   · 27 son triggers → PostgREST no las expone como RPC (retornan `trigger`). Se dejan.
--   ·  8 mutaban y no eran triggers → cerradas en las migraciones 132 y 133.
--   ·  5 son las de token de los links públicos → deben quedar abiertas.
--   · 22 filtran por la identidad de quien llama (`auth.uid()`, `get_user_club_id()`,
--     `my_player_ids()`…). Para anon devuelven vacío o NULL, no filtran nada, y las usan
--     las policies RLS, así que tocarlas es más riesgoso que el beneficio. Se dejan.
--   · 17 reciben `p_club_id` / `p_team_id` y devuelven datos de ESE club sin comprobar
--     que quien llama pertenezca. Son estas, y son las que se cierran acá.
--
-- Verificado antes del cambio: sin sesión, `club_staff_count('<club real>')` devolvía el
-- número. `get_club_members` y `get_player_availability` no devolvían datos sólo porque
-- están rotas por su cuenta (ver nota abajo) — el control de acceso tampoco existía.
--
-- Se revoca de PUBLIC **y** de anon, por las dos vías de concesión (ver migración 133).
--
-- NOTA aparte, no es de seguridad: `get_club_members(uuid)` está ROTA hoy, falla con
-- `column "name" does not exist` tanto con sesión como sin ella. Es un bug preexistente,
-- anterior a esta migración; queda pendiente de arreglar.
--
-- ⚠️ LO QUE ESTO **NO** ARREGLA: estas 17 siguen sin comprobar pertenencia, así que un
-- usuario AUTENTICADO del club A puede pedir datos del club B pasando su uuid. Verificado:
-- `club_staff_count(<club ajeno>)` devuelve el número. El arreglo de fondo es que cada una
-- valide `p_club_id = get_user_club_id() or is_super_admin()`, y queda pendiente.

revoke execute on function public.activity_team_for_player(uuid)             from public, anon;
revoke execute on function public.club_has_feature(uuid, text)               from public, anon;
revoke execute on function public.club_plan_features(uuid)                   from public, anon;
revoke execute on function public.club_staff_count(uuid)                     from public, anon;
revoke execute on function public.club_staff_limit(uuid)                     from public, anon;
revoke execute on function public.get_club_members(uuid)                     from public, anon;
revoke execute on function public.get_pending_rpe(uuid)                      from public, anon;
revoke execute on function public.get_player_availability(uuid)              from public, anon;
revoke execute on function public.link_pending_rpe(uuid, date)               from public, anon;
revoke execute on function public.recent_sessions(uuid, integer, date)       from public, anon;
revoke execute on function public.rpe_effective_duration(uuid, uuid)         from public, anon;
revoke execute on function public.session_rpe_status(uuid)                   from public, anon;
revoke execute on function public.team_features(uuid)                        from public, anon;
revoke execute on function public.team_has_feature(uuid, text)               from public, anon;
revoke execute on function public.team_plan_slug(uuid)                       from public, anon;
revoke execute on function public.team_player_ids(uuid)                      from public, anon;
revoke execute on function public.team_player_limit(uuid)                    from public, anon;

grant execute on function public.activity_team_for_player(uuid)              to authenticated, service_role;
grant execute on function public.club_has_feature(uuid, text)                to authenticated, service_role;
grant execute on function public.club_plan_features(uuid)                    to authenticated, service_role;
grant execute on function public.club_staff_count(uuid)                      to authenticated, service_role;
grant execute on function public.club_staff_limit(uuid)                      to authenticated, service_role;
grant execute on function public.get_club_members(uuid)                      to authenticated, service_role;
grant execute on function public.get_pending_rpe(uuid)                       to authenticated, service_role;
grant execute on function public.get_player_availability(uuid)               to authenticated, service_role;
grant execute on function public.link_pending_rpe(uuid, date)                to authenticated, service_role;
grant execute on function public.recent_sessions(uuid, integer, date)        to authenticated, service_role;
grant execute on function public.rpe_effective_duration(uuid, uuid)          to authenticated, service_role;
grant execute on function public.session_rpe_status(uuid)                    to authenticated, service_role;
grant execute on function public.team_features(uuid)                         to authenticated, service_role;
grant execute on function public.team_has_feature(uuid, text)                to authenticated, service_role;
grant execute on function public.team_plan_slug(uuid)                        to authenticated, service_role;
grant execute on function public.team_player_ids(uuid)                       to authenticated, service_role;
grant execute on function public.team_player_limit(uuid)                     to authenticated, service_role;

-- Verificado después: las 17 devuelven 401 `permission denied` sin sesión; los links
-- públicos (calendario, nutrición, encuestas) y `paddle_env` siguen respondiendo 200; y
-- con sesión siguen funcionando las tablas cuyas policies invocan `club_has_feature()`
-- (club_gps_settings, club_equipment, assessment_column_maps).
