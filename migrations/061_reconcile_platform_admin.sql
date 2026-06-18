-- =============================================================
-- Migration 061: Reconciliar helper de platform admin
-- La 060 se construyó sobre un supuesto equivocado: el super admin real
-- de la plataforma NO se modela con una tabla platform_admins, sino con la
-- función preexistente public.is_super_admin() (gateada por profiles.role =
-- 'super_admin'), ya usada por has_full_planning_access() y la RLS (043, 044).
-- Por eso revertimos lo que aportó la 060:
--   - repuntamos la policy de escritura de plans a is_super_admin()
--   - borramos la función duplicada is_platform_admin()
--   - borramos la tabla platform_admins, que queda sin uso (nadie la lee)
-- Depends on: 060
-- =============================================================

-- Repuntar la policy de escritura de plans a la función canónica
DROP POLICY IF EXISTS plans_write_platform ON public.plans;
CREATE POLICY plans_write_platform ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Borrar el duplicado que introdujo la 060
DROP FUNCTION IF EXISTS public.is_platform_admin();

-- Borrar la tabla huérfana de la 060 (is_super_admin lee profiles.role, no esta tabla)
DROP TABLE IF EXISTS public.platform_admins;
