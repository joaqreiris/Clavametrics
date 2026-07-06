-- Migration 115: back-fill session_type='match' for days that already have a rival.
--
-- Motivación: al asignar un rival, la app hoy mergeaba session_attributes.rival pero dejaba
-- session_type='training'. getMatchBaseline() filtra por session_type='match', así que esos
-- días quedaban invisibles para el baseline "vs Match" (0 partidos → baseline vacío → el radar
-- caía a un fallback inventado). A partir de ahora la app setea session_type='match' al asignar
-- rival; esta migración corrige los días YA taggeados en la base.
--
-- Regla: un día con rival (session_attributes.rival u opponent, no vacío) que está en 'training'
-- ES un partido → session_type='match'. Guardamos el type original en _rivalPrevType para que
-- "Remove rival" pueda revertirlo (coherente con el flujo nuevo de assign/remove).
--
-- NO toca is_historical (los contenedores de migración ya son 'match', excluidos por el WHERE).
-- NO toca gps_reports ni ningún otro dato del día. Idempotente: sólo filas 'training' con rival
-- y sin _rivalPrevType previo; correrla dos veces no cambia nada.
--
-- Rollback (si hiciera falta): revertir sólo lo que tocó esta migración —
--   update public.training_sessions
--     set session_type = coalesce(session_attributes->>'_rivalPrevType','training'),
--         session_attributes = session_attributes - '_rivalPrevType'
--   where session_type = 'match' and (session_attributes ? '_rivalPrevType');

update public.training_sessions
set session_type = 'match',
    session_attributes = jsonb_set(
      coalesce(session_attributes, '{}'::jsonb),
      '{_rivalPrevType}', to_jsonb(session_type), true)
where session_type = 'training'
  and ( nullif(session_attributes ->> 'rival',    '') is not null
     or nullif(session_attributes ->> 'opponent', '') is not null )
  and (session_attributes ->> '_rivalPrevType') is null;
