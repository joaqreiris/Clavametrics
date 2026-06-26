-- =============================================================
-- Migration 067: Ajustar features del tier free (Iniciación)
-- Decisión de producto: el free incluye Availability y Treatments
-- (registro de tratamientos del fisio). Antes estaban en Básico/Pro.
-- 'physio' = módulo Treatments (CM_SECTIONS key 'treatments').
-- Idempotente.
-- Depends on: 055/058 (plans seed)
-- =============================================================

-- availability: estaba en basic+ → ahora también en free
UPDATE public.plans
   SET features = features || '["availability"]'::jsonb
 WHERE slug = 'initiation'
   AND NOT (features ? 'availability');

-- physio (Treatments): estaba en professional+ → ahora desde free (initiation + basic)
UPDATE public.plans
   SET features = features || '["physio"]'::jsonb
 WHERE slug IN ('initiation','basic')
   AND NOT (features ? 'physio');
