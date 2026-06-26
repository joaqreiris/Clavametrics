-- =============================================================
-- Migration 058: Billing — limpieza de plans
-- La tabla plans preexistía (borrador 016) y quedó con planes viejos
-- (starter/pro/enterprise) conviviendo con los nuevos, y SIN las
-- columnas provider_price_* que la 055 no llegó a crear (saltó por
-- CREATE TABLE IF NOT EXISTS). Esta migración deja plans en su forma final.
-- Depends on: 055
-- =============================================================

-- 1) Asegurar columnas que la 055 no creó (la tabla ya existía)
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS provider_price_monthly_id text,
  ADD COLUMN IF NOT EXISTS provider_price_yearly_id  text;

-- 2) Borrar los planes obsoletos del borrador 016.
--    Seguro: subscriptions todavía no tiene filas reales (recién creada en 057).
DELETE FROM public.plans WHERE slug IN ('starter','pro','enterprise');

-- 3) Re-asegurar el seed nuevo por si algún valor quedó a medias
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
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  max_players   = EXCLUDED.max_players,
  max_staff     = EXCLUDED.max_staff,
  features      = EXCLUDED.features,
  sort_order    = EXCLUDED.sort_order;
