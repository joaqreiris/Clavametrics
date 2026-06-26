-- =============================================================
-- Migration 064: Agregar feature 'drill_designer' a Básico+
-- Drill Designer (crear ejercicios custom, Planner.html) pasa de
-- free-implícito a Básico. 'sessions_library' (navegar la librería
-- sembrada) sigue free. Son dos capacidades distintas.
-- Depends on: 055/058 (plans)
-- =============================================================

-- Agregar 'drill_designer' a las features de basic, professional y full
-- (idempotente: solo lo agrega si no está ya en el array)
UPDATE public.plans
   SET features = features || '["drill_designer"]'::jsonb
 WHERE slug IN ('basic','professional','full')
   AND NOT (features ? 'drill_designer');
