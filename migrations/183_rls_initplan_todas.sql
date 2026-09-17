-- Migración 183: el mismo arreglo de las 181/182, aplicado a TODAS las policies que quedaban.
--
-- Las policies llamaban funciones sueltas y Postgres las evaluaba UNA VEZ POR FILA. Ninguna de
-- estas depende de la fila —auth.uid(), get_user_club_id(), is_super_admin(),
-- has_full_planning_access(), is_platform_admin(), has_medical_access(), my_role() y
-- club_has_feature() con argumentos constantes—, así que envolverlas en (SELECT …) las convierte
-- en InitPlan: se calculan una sola vez por consulta.
--
-- Se hace con un recorrido sobre pg_policy en vez de 152 ALTER a mano, y todo en una transacción:
-- si alguna quedara mal formada, falla el conjunto y no queda nada a medias. Las funciones que SÍ
-- reciben columnas de la fila (support_access(club_id), session_in_my_teams(session_id),
-- microcycle_has_my_gps(id), los EXISTS correlacionados) no coinciden con ningún patrón de abajo y
-- quedan intactas — que es exactamente lo que se busca: envolverlas cambiaría el significado.
--
-- Resultado: 152 reglas reescritas en 101 tablas; después no queda ninguna llamada suelta.
--
-- Verificado antes y después con tres usuarios de dos clubes (physio y team_manager de MOI, admin
-- de Bigúa), contando filas visibles en 24 tablas: IDÉNTICAS, y Bigúa sigue sin ver una sola fila
-- de MOI. Las únicas diferencias entre usuarios son las esperables (tareas asignadas y
-- notificaciones propias de cada uno).

CREATE OR REPLACE FUNCTION public._rls_envolver(txt text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT regexp_replace(
           regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
             $1,
             '(?<!SELECT )auth\.uid\(\)',                    '(SELECT auth.uid())',                 'g'),
             '(?<!SELECT )\mget_user_club_id\(\)',           '(SELECT get_user_club_id())',         'g'),
             '(?<!SELECT )\mis_super_admin\(\)',             '(SELECT is_super_admin())',           'g'),
             '(?<!SELECT )\mhas_full_planning_access\(\)',   '(SELECT has_full_planning_access())', 'g'),
             '(?<!SELECT )\mis_platform_admin\(\)',          '(SELECT is_platform_admin())',        'g'),
             '(?<!SELECT )\mhas_medical_access\(\)',         '(SELECT has_medical_access())',       'g'),
             '(?<!SELECT )\mmy_role\(\)',                    '(SELECT my_role())',                  'g'),
           '(?<!SELECT )\mclub_has_feature\(\(SELECT get_user_club_id\(\)\), (''[^'']*''::text)\)',
           '(SELECT club_has_feature((SELECT get_user_club_id()), \1))', 'g');
$fn$;

DO $mig$
DECLARE r record; q text; w text; s text; n int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tabla, p.polname AS regla,
           pg_get_expr(p.polqual, p.polrelid)      AS q_old,
           pg_get_expr(p.polwithcheck, p.polrelid) AS w_old
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace nn ON nn.oid = c.relnamespace
    WHERE nn.nspname = 'public'
  LOOP
    q := CASE WHEN r.q_old IS NULL THEN NULL ELSE public._rls_envolver(r.q_old) END;
    w := CASE WHEN r.w_old IS NULL THEN NULL ELSE public._rls_envolver(r.w_old) END;
    CONTINUE WHEN (q IS NOT DISTINCT FROM r.q_old) AND (w IS NOT DISTINCT FROM r.w_old);

    s := format('ALTER POLICY %I ON public.%I', r.regla, r.tabla);
    IF q IS NOT NULL THEN s := s || format(' USING (%s)', q); END IF;
    IF w IS NOT NULL THEN s := s || format(' WITH CHECK (%s)', w); END IF;
    EXECUTE s;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'policies reescritas: %', n;
END $mig$;

DROP FUNCTION public._rls_envolver(text);
