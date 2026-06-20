-- =============================================================
-- Migration 070: Renombrar display de planes a nombres en inglés
-- Decisión de producto: los nombres de plan pasan a ser fijos en inglés
-- (como ya lo era 'Full'). Solo cambia plans.name (display); los slugs
-- (initiation/basic/professional/full) NO se tocan.
--   Iniciación  -> Free
--   Básico      -> Basic
--   Profesional -> Professional
--   Full        -> Full (sin cambios)
-- Idempotente.
-- Depends on: 055/058 (plans seed)
-- =============================================================

UPDATE public.plans SET name = 'Free'         WHERE slug = 'initiation'   AND name <> 'Free';
UPDATE public.plans SET name = 'Basic'        WHERE slug = 'basic'        AND name <> 'Basic';
UPDATE public.plans SET name = 'Professional' WHERE slug = 'professional' AND name <> 'Professional';
