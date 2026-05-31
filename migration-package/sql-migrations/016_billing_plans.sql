-- =============================================================
-- Migration 016: Billing & Plans
-- Created: 2026-05-27
-- Depends on: 001 (clubs table)
--
-- NOTAS:
-- - Las columnas billing_* en clubs ya son referenciadas por
--   settings-drawer.jsx (BillingPanel). Verificá antes de aplicar
--   si ya fueron agregadas en una migración anterior.
-- - Usar siempre IF NOT EXISTS para idempotencia.
-- - RLS habilitada al final.
-- =============================================================

-- ─── Asegurar columnas billing en clubs ──────────────────────
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS billing_plan        text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS billing_amount      numeric(10,2);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS billing_next_date   date;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS billing_status      text
  CHECK (billing_status IN ('active','past_due','canceled','trialing','paused'));
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS billing_stripe_customer_id text;

-- ─── Catálogo de planes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,           -- 'starter', 'pro', 'enterprise'
  name            text NOT NULL,
  description     text,
  price_monthly   numeric(10,2) NOT NULL,
  price_yearly    numeric(10,2),
  max_players     integer,                        -- null = unlimited
  max_staff       integer,
  features        jsonb DEFAULT '[]'::jsonb,      -- ['gps','rehab','individual_planner']
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active) WHERE is_active = true;

-- ─── Subscripciones por club ─────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                  uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  plan_id                  uuid NOT NULL REFERENCES plans(id),
  status                   text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','past_due','canceled','trialing','paused')),
  billing_cycle            text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  stripe_subscription_id   text UNIQUE,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_end                timestamptz,
  canceled_at              timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_club_id ON subscriptions(club_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);

-- ─── Facturas / historial ────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id              uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  subscription_id      uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_number       text UNIQUE,
  stripe_invoice_id    text UNIQUE,
  amount               numeric(10,2) NOT NULL,
  currency             text DEFAULT 'USD',
  status               text DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','failed','refunded','void')),
  paid_at              timestamptz,
  due_date             date,
  invoice_url          text,
  pdf_url              text,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_club_id ON invoices(club_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- ─── Métodos de pago ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                  uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  stripe_payment_method_id text UNIQUE,
  type                     text DEFAULT 'card' CHECK (type IN ('card','sepa','ach','other')),
  brand                    text,                         -- visa, mastercard, amex
  last4                    text,
  exp_month                integer,
  exp_year                 integer,
  is_default               boolean DEFAULT false,
  created_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_club ON payment_methods(club_id);

-- ─── RLS: cada club ve solo lo suyo ──────────────────────────
ALTER TABLE plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods  ENABLE ROW LEVEL SECURITY;

-- Plans: todos los autenticados pueden leer
CREATE POLICY plans_select ON plans
  FOR SELECT TO authenticated USING (true);

-- Subscriptions: solo del club del usuario
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT TO authenticated USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- Invoices: solo del club del usuario
CREATE POLICY invoices_select ON invoices
  FOR SELECT TO authenticated USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- Payment methods: solo admin del club
CREATE POLICY payment_methods_select ON payment_methods
  FOR SELECT TO authenticated USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Seed básico de planes ────────────────────────────────────
INSERT INTO plans (slug, name, description, price_monthly, price_yearly, max_players, max_staff, features, sort_order)
VALUES
  ('starter',    'Starter',    'Para clubes amateur o juveniles', 49.00,  490.00, 30,   3,    '["squad","wellness","calendar"]'::jsonb,                                                                  1),
  ('pro',        'Pro',        'Para clubes semi-profesionales',  199.00, 1990.00, 60,  10,   '["squad","wellness","calendar","gps","injuries","planner","nutrition","rehab"]'::jsonb,                  2),
  ('enterprise', 'Enterprise', 'Clubes profesionales',            499.00, 4990.00, null, null,'["squad","wellness","calendar","gps","injuries","planner","nutrition","rehab","individual_planner"]'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;

-- ─── Trigger updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
