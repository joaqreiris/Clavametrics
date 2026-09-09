-- =============================================================
-- Migration 142: tres páginas que nunca pasaron por el candado de plan
--
-- Tactical Planning, Sessions History y Clinical Records estaban en
-- CM_SECTIONS con feature:null, o sea always-on: el plan Free las tenía
-- completas, historia clínica incluida. Se cierran con features propias
-- porque ningún plan tenía una key equivalente para reusar.
--
--   tactical_planning → Full
--   clinical_records  → Full
--   sessions_history  → Professional y Full
--
-- Idempotente: sólo agrega la key que falta y respeta el orden existente.
-- Depends on: 055/058 (plans.features)
-- =============================================================

UPDATE public.plans
   SET features = features || to_jsonb(ARRAY(
         SELECT k FROM unnest(ARRAY['tactical_planning','clinical_records','sessions_history']) k
          WHERE NOT features ? k))
 WHERE slug = 'full';

UPDATE public.plans
   SET features = features || to_jsonb(ARRAY(
         SELECT k FROM unnest(ARRAY['sessions_history']) k
          WHERE NOT features ? k))
 WHERE slug = 'professional';
