-- =============================================================
-- Migration 066: Lectura pública de plans (para Pricing.html)
-- La página de precios es pública (sin login) y necesita leer los
-- precios reales. Se abre el SELECT a anon además de authenticated.
-- La escritura sigue restringida a platform admin (061). Los precios
-- no son secretos: justamente se muestran en la web.
-- Depends on: 055 (plans), 061 (write policy)
-- =============================================================

DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans
  FOR SELECT TO anon, authenticated
  USING (true);
