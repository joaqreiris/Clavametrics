-- =============================================================
-- Migration 059: Billing — invoices + payment_methods (nivel club)
-- El club = customer de Paddle. Factura consolidada e métodos de pago
-- a nivel club. Provider-agnostic. Espejan lo que manda el webhook.
-- Las tablas viejas (borrador 016: stripe_*) se descartan.
-- Depends on: 001 (clubs), 057 (subscriptions)
-- =============================================================

DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;

-- ── Facturas (consolidadas por club) ─────────────────────────
CREATE TABLE public.invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  subscription_id     uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_number      text,
  provider_invoice_id text UNIQUE,                  -- ID en Paddle
  amount              numeric(10,2) NOT NULL,
  currency            text DEFAULT 'USD',
  status              text DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','failed','refunded','void')),
  paid_at             timestamptz,
  due_date            date,
  invoice_url         text,
  pdf_url             text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_invoices_club    ON public.invoices(club_id);
CREATE INDEX idx_invoices_status  ON public.invoices(status);
CREATE INDEX idx_invoices_created ON public.invoices(created_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT TO authenticated
  USING (club_id = get_user_club_id());
-- Escritura: solo service-role (webhook de Paddle). Sin policy de write para authenticated.

-- ── Métodos de pago (a nivel club; sin PCI, solo espejo) ─────
CREATE TABLE public.payment_methods (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  provider_payment_method_id text UNIQUE,           -- ID en Paddle
  type                       text DEFAULT 'card'
                             CHECK (type IN ('card','paypal','other')),
  brand                      text,                  -- visa, mastercard, amex
  last4                      text,
  exp_month                  integer,
  exp_year                   integer,
  is_default                 boolean DEFAULT false,
  created_at                 timestamptz DEFAULT now()
);

CREATE INDEX idx_payment_methods_club ON public.payment_methods(club_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_methods_select ON public.payment_methods;
CREATE POLICY payment_methods_select ON public.payment_methods
  FOR SELECT TO authenticated
  USING (club_id = get_user_club_id());
-- Escritura: solo service-role (webhook de Paddle).
