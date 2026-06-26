-- =============================================================
-- Migration 056: Billing — provider columns on clubs (agnostic)
-- El club = un customer del PSP (Paddle). Factura consolidada por club.
-- Monto/fecha NO se denormalizan acá: se derivan de subscriptions (mig 57).
-- Depends on: 001 (clubs)
-- =============================================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS billing_provider             text
    CHECK (billing_provider IN ('paddle')),            -- por ahora solo paddle; ampliable
  ADD COLUMN IF NOT EXISTS billing_provider_customer_id text,
  ADD COLUMN IF NOT EXISTS billing_status               text DEFAULT 'none'
    CHECK (billing_status IN ('none','active','past_due','canceled','trialing','paused'));

-- Lookup rápido del club por su customer del proveedor (lo usa el webhook de Paddle)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_provider_customer
  ON public.clubs(billing_provider_customer_id)
  WHERE billing_provider_customer_id IS NOT NULL;
