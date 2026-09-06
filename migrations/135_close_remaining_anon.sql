-- Migration 135: las 7 que se escaparon de la clasificación de la 134.
--
-- La 134 clasificó por patrones sobre el cuerpo de cada función, y siete no encajaron en
-- ninguna categoría. Al revisarlas a mano apareció una grave:
--
-- **apply_role_template(p_club, p_profile, p_role)** — NO TIENE NINGÚN CONTROL. Inserta en
-- `member_modules` los módulos por defecto de un rol para un perfil, y además se traga
-- cualquier excepción (`exception when others then null`). Sin sesión, con un club_id y un
-- profile_id, se le podían dar a un perfil los módulos del rol que se quisiera: escalada de
-- privilegios. Nadie la llama desde el frontend; la usan `accept_invitation` y
-- `set_member_secondary_role`, que son SECURITY DEFINER y corren como el owner, así que no
-- necesitan este GRANT. Por eso se cierra también para `authenticated`, no sólo para anon.
-- Verificado: `accept_invitation` sigue corriendo bien, y la llamada directa a
-- `apply_role_template` como authenticated devuelve `permission denied`.
--
-- Las otras seis se cierran sólo para quien no tiene sesión:
--   set_paddle_env      — tiene guard `is_super_admin()` y ese SÍ corta (usa EXISTS, que
--                         devuelve false y no NULL). Se cierra igual, por higiene.
--                         La usa Platform.html, que necesita `authenticated`.
--   assign_rpe_session  — sin guard de autorización; la usa RPE.html.
--   link_rpe_to_session — sin guard; nadie la llama desde el frontend.
--   notify_player_birthdays / notify_staff_birthdays / process_due_reminders — tareas
--                         programadas; sin sesión no tienen nada que hacer.

revoke execute on function public.apply_role_template(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.apply_role_template(uuid, uuid, text) to service_role;

revoke execute on function public.set_paddle_env(text)                              from public, anon;
revoke execute on function public.assign_rpe_session(uuid, uuid)                    from public, anon;
revoke execute on function public.link_rpe_to_session(uuid, time without time zone) from public, anon;
revoke execute on function public.notify_player_birthdays()                         from public, anon;
revoke execute on function public.notify_staff_birthdays()                          from public, anon;
revoke execute on function public.process_due_reminders()                           from public, anon;

grant execute on function public.set_paddle_env(text)                              to authenticated, service_role;
grant execute on function public.assign_rpe_session(uuid, uuid)                    to authenticated, service_role;
grant execute on function public.link_rpe_to_session(uuid, time without time zone) to authenticated, service_role;
grant execute on function public.notify_player_birthdays()                         to authenticated, service_role;
grant execute on function public.notify_staff_birthdays()                          to authenticated, service_role;
grant execute on function public.process_due_reminders()                           to authenticated, service_role;
