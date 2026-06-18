-- =============================================================
-- Migration 055: Billing — plans catalog (provider-agnostic)
-- Reemplaza el borrador migration-package/016_billing_plans.sql
-- Depends on: 001 (clubs)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text UNIQUE NOT NULL,        -- initiation|basic|professional|full
  name                  text NOT NULL,
  description           text,
  price_monthly         numeric(10,2) NOT NULL,
  price_yearly          numeric(10,2),
  max_players           integer,                     -- null = ilimitado
  max_staff             integer,                     -- null = ilimitado
  features              jsonb DEFAULT '[]'::jsonb,
  -- provider-agnostic: IDs del PSP (Paddle) se cargan al conectar billing
  provider_price_monthly_id text,
  provider_price_yearly_id  text,
  is_active             boolean DEFAULT true,
  sort_order            integer DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active) WHERE is_active = true;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Lectura pública para autenticados (el catálogo no es secreto)
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans
  FOR SELECT TO authenticated USING (true);
-- Escritura: solo service-role / platform admin (se define en migración de platform_admins).
-- Por ahora sin policy de INSERT/UPDATE para authenticated = nadie escribe desde el cliente.

-- ── Seed real (precios PROVISORIOS, editables luego por super admin) ──
INSERT INTO public.plans (slug, name, description, price_monthly, price_yearly, max_players, max_staff, features, sort_order)
VALUES
  ('initiation',  'Iniciación',  'PF que prueba / squad chico',     0,   0,    15,  2,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library"]'::jsonb, 1),
  ('basic',       'Básico',      'PF con su GPS / club sin staff',  60,  600,  30,  4,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library","wellness_analysis","gps_analysis","annual_planner","gym","evaluations","injuries","availability"]'::jsonb, 2),
  ('professional','Profesional', 'Club con fisio y staff',          120, 1200, 80,  null,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library","wellness_analysis","gps_analysis","annual_planner","gym","evaluations","injuries","availability","load_monitor","load_wellness_cross","individual_planner","physio","rehab_planner","match_reports","lineup","multi_staff"]'::jsonb, 3),
  ('full',        'Full',        'Departamento completo',           150, 1500, null, null,
    '["squad","wellness_capture","rpe_capture","athlete_app","calendar","daily_planning","sessions_library","wellness_analysis","gps_analysis","annual_planner","gym","evaluations","injuries","availability","load_monitor","load_wellness_cross","individual_planner","physio","rehab_planner","match_reports","lineup","multi_staff","nutrition","video_room"]'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;

-- Trigger updated_at (reusa set_updated_at si ya existe en la DB; si no, créala)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS plans_updated_at ON public.plans;
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
