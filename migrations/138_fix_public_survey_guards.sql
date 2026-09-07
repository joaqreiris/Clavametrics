-- Migration 138: el guard de club no puede correr en el camino del survey público.
--
-- Síntoma: cualquier jugador que enviaba el wellness (o el RPE) desde el link público veía
-- "Could not send: not authorized". Roto para TODOS los clubes.
--
-- Causa: la 137 metió `assert_my_club()` dentro de dos helpers que NO se llaman por RPC —
-- se llaman desde adentro:
--   · activity_team_for_player()  ← triggers act_wellness / act_rpe / act_injury / …
--   · rpe_effective_duration()    ← submit_survey() y el trigger de duración de sesión
-- El survey llega con la publishable key, o sea auth.role() = 'anon' y sin uid. is_my_club()
-- corta ahí a propósito (es lo que evita que un anónimo lea datos de un club), así que el
-- INSERT del wellness explotaba en el trigger y el del RPE antes todavía, al calcular la
-- duración. submit_survey es SECURITY DEFINER pero eso cambia el OWNER, no el JWT: adentro
-- auth.role() sigue siendo 'anon'.
--
-- Arreglo: sacarles el assert y cerrarles la puerta por grants, que es donde corresponde.
-- Ninguna de las dos se llama desde el frontend (verificado en el repo) ni desde una policy
-- RLS, así que quedan sólo para service_role: un usuario autenticado ya no puede pedirlas
-- con el uuid de otro club — que era justo el agujero que buscaba tapar la 137 — y los
-- triggers, que corren como owner y no pasan por el chequeo de EXECUTE, siguen andando.

create or replace function public.activity_team_for_player(p_player uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_team uuid;
begin
  -- Sin guard de club a propósito: la llaman los triggers de actividad, que también corren
  -- en el alta anónima del survey. El acceso se controla por GRANT (ver abajo).
  select team_id into v_team from public.players where id = p_player;
  return v_team;
end;
$$;

create or replace function public.rpe_effective_duration(p_session_id uuid, p_player_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare n integer;
begin
  -- Idem: la llama submit_survey() con el jugador anónimo del link. Acceso por GRANT.
  select case when ts.session_type = 'match'
              then coalesce(nullif(a.minutes, 0), ts.duration)
              else ts.duration end
    into n
  from public.training_sessions ts
  left join public.availability a
    on a.player_id = p_player_id::text and a.date = ts.session_date
  where ts.id = p_session_id;
  return n;
end;
$$;

revoke execute on function public.activity_team_for_player(uuid)      from public, anon, authenticated;
revoke execute on function public.rpe_effective_duration(uuid, uuid)  from public, anon, authenticated;
grant  execute on function public.activity_team_for_player(uuid)      to service_role;
grant  execute on function public.rpe_effective_duration(uuid, uuid)  to service_role;
