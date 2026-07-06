-- Migration 118: RLS de players — el staff de CUALQUIER equipo del jugador ve/edita su ficha (M:N).
--
-- Motivación: las policies players_scoped_{select,update,delete} filtran la rama de equipo por
-- players.team_id IN my_team_ids(), es decir SOLO el equipo PRIMARIO. Un jugador multi-equipo solo
-- es visible/editable para el staff de su primario. Migramos esa rama a player_teams (todos los
-- equipos del jugador), en línea con la migración 117 que ya hizo lo mismo en my_player_ids().
--
-- Qué se cambia (SELECT / UPDATE / DELETE): se reemplaza SOLO la rama de equipo
--     team_id IN (select my_team_ids())
-- por
--     exists (select 1 from public.player_teams pt
--             where pt.player_id = players.id
--               and pt.team_id in (select public.my_team_ids()))
-- Se mantienen intactas: la condición club_id = get_user_club_id() y la rama admin/owner (EXISTS
-- sobre profiles). Las policies separadas players_super_select / players_super_write (is_super_admin)
-- NO se tocan.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- MANEJO DEL INSERT (players_scoped_insert): NO se modifica. Motivos:
--   1. Un jugador recién creado todavía NO tiene filas en player_teams (se crean después en
--      Squad.html → syncPlayerTeams). Si el WITH CHECK del INSERT exigiera un EXISTS contra
--      player_teams, NINGÚN jugador podría crearse (la fila de membership aún no existe). Por eso
--      la rama de equipo del INSERT NO debe depender de player_teams.
--   2. La policy actual ya resuelve esto sin player_teams: su rama de equipo
--      (team_id IN my_team_ids()) evalúa el team_id de la FILA NUEVA que se está insertando —una
--      columna, no una tabla de membership— así que funciona en el momento del INSERT y no bloquea
--      la creación.
--   3. Dejarla igual evita una regresión de permisos: cambiarla a has_full_planning_access()
--      quitaría al staff no-admin de un equipo la posibilidad de crear un jugador que hoy sí puede.
-- Conclusión: el INSERT queda EXACTAMENTE como está (club + admin/owner OR team_id-de-la-fila-nueva),
-- que ya cumple "basado en club + admin/owner, sin player_teams".
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Sin recursión: la RLS de players al evaluar el EXISTS lee player_teams; las policies de
-- player_teams solo llaman get_user_club_id()/has_full_planning_access()/is_super_admin(), que no
-- consultan players → no hay ciclo. Performance: usa el índice player_teams_player_idx (player_id).
--
-- Idempotente: drop policy if exists + create. Postgres no soporta CREATE OR REPLACE POLICY.
--
-- Rollback: recrear las 3 policies con la rama original `team_id IN (select my_team_ids())`.

-- ── SELECT ───────────────────────────────────────────────────────────────────
drop policy if exists "players_scoped_select" on public.players;
create policy "players_scoped_select" on public.players as permissive for select to public
  using (
    (club_id = get_user_club_id())
    AND (
      (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
                 AND (p.role = ANY (ARRAY['admin'::text,'owner'::text])
                      OR p.club_role = ANY (ARRAY['admin'::text,'owner'::text]))))
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 WHERE pt.player_id = players.id
                   AND pt.team_id IN (SELECT public.my_team_ids()))
    )
  );

-- ── UPDATE ───────────────────────────────────────────────────────────────────
drop policy if exists "players_scoped_update" on public.players;
create policy "players_scoped_update" on public.players as permissive for update to public
  using (
    (club_id = get_user_club_id())
    AND (
      (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
                 AND (p.role = ANY (ARRAY['admin'::text,'owner'::text])
                      OR p.club_role = ANY (ARRAY['admin'::text,'owner'::text]))))
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 WHERE pt.player_id = players.id
                   AND pt.team_id IN (SELECT public.my_team_ids()))
    )
  )
  with check (
    (club_id = get_user_club_id())
    AND (
      (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
                 AND (p.role = ANY (ARRAY['admin'::text,'owner'::text])
                      OR p.club_role = ANY (ARRAY['admin'::text,'owner'::text]))))
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 WHERE pt.player_id = players.id
                   AND pt.team_id IN (SELECT public.my_team_ids()))
    )
  );

-- ── DELETE ───────────────────────────────────────────────────────────────────
drop policy if exists "players_scoped_delete" on public.players;
create policy "players_scoped_delete" on public.players as permissive for delete to public
  using (
    (club_id = get_user_club_id())
    AND (
      (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
                 AND (p.role = ANY (ARRAY['admin'::text,'owner'::text])
                      OR p.club_role = ANY (ARRAY['admin'::text,'owner'::text]))))
      OR EXISTS (SELECT 1 FROM public.player_teams pt
                 WHERE pt.player_id = players.id
                   AND pt.team_id IN (SELECT public.my_team_ids()))
    )
  );

-- players_scoped_insert: NO se modifica (ver comentario del INSERT arriba).
-- players_super_select / players_super_write: NO se modifican.
