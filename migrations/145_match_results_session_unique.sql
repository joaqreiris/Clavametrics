-- 145 · Match Reports · un informe por sesión de partido
-- ---------------------------------------------------------------------------
-- Al guardar los detalles, el importador hace un upsert por `session_id` para que
-- volver a guardar el mismo partido actualice su fila en vez de crear otra. Pero
-- `match_results` nunca tuvo un único sobre esa columna, así que Postgres rechazaba
-- la operación entera:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- El error estaba latente desde siempre y no se veía porque la pantalla buscaba las
-- sesiones con el tipo equivocado ('Match' en vez de 'match', arreglado en el commit
-- anterior): sin sesión que elegir nunca se tomaba la rama del upsert. En cuanto el
-- selector empezó a listar partidos de verdad, guardar dejó de funcionar.
--
-- La unicidad YA estaba, pero en un índice PARCIAL: `ux_match_results_session`, con
-- WHERE session_id IS NOT NULL. Ahí está la trampa — Postgres sólo infiere un índice
-- parcial cuando la sentencia repite su predicado (ON CONFLICT (session_id) WHERE
-- session_id IS NOT NULL), y PostgREST manda la cláusula pelada. El índice existía,
-- hacía su trabajo, y aun así el upsert fallaba.
--
-- Por eso el de acá va SIN predicado. Postgres trata cada NULL como distinto, así que
-- sigue habiendo varios informes sueltos —los que no cuelgan de ninguna sesión— sin
-- pisarse entre ellos: exactamente la garantía del parcial, pero inferible.
--
-- Con el nuevo, el parcial no aporta nada y cobra escrituras de más, así que se va.
--
-- Idempotente.

create unique index if not exists match_results_session_id_key
  on public.match_results (session_id);

drop index if exists public.ux_match_results_session;

comment on index public.match_results_session_id_key is
  'Un informe por sesión de partido. Habilita el upsert onConflict=session_id; los informes sueltos (session_id NULL) no se ven afectados.';
