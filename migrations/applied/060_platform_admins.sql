-- =============================================================
-- Migration 060: Platform admins (dueño de plataforma, cross-club)
-- Concepto SEPARADO de profiles.role (que es scopeado al club).
-- Base del panel super admin: editar plans + calculadora de presupuesto.
-- Depends on: 055 (plans)
-- =============================================================

-- ── Tabla de platform admins ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- Nadie lee/escribe esta tabla desde el cliente. Solo service-role la maneja,
-- y la función de abajo (SECURITY DEFINER) la consulta sin exponerla.
-- (Sin policies = sin acceso para authenticated, que es lo que queremos.)

-- ── Función helper: ¿el usuario actual es platform admin? ─────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ── Ahora SÍ: escritura de plans reservada a platform admin ───
-- (la 055 dejó plans con SELECT abierto y sin write; acá habilitamos
--  el write solo para vos / platform admins)
DROP POLICY IF EXISTS plans_write_platform ON public.plans;
CREATE POLICY plans_write_platform ON public.plans
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
