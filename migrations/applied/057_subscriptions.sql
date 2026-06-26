-- =============================================================
-- Migration 057: Billing — subscriptions (per team / categoría)
-- Una subscription por team. El team elige su plan. Factura
-- consolidada a nivel club (club_id denormalizado para RLS/agrupado).
-- Depends on: 004 (teams), 055 (plans), 056 (clubs billing cols)
-- =============================================================

-- La tabla vieja (borrador migration-package/016: per-club, stripe_*) se descarta.
-- CASCADE también suelta el FK invoices.subscription_id -> subscriptions(id) (la
-- columna y la tabla invoices quedan; solo se elimina esa constraint).
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                  uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  club_id                  uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  plan_id                  uuid NOT NULL REFERENCES public.plans(id),
  status                   text NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('active','past_due','canceled','trialing','paused')),
  billing_cycle            text DEFAULT 'monthly'
                           CHECK (billing_cycle IN ('monthly','yearly')),
  provider_subscription_id text UNIQUE,            -- ID en Paddle (agnostic)
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_end                timestamptz,
  canceled_at              timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- Una sola subscription "viva" por team (no dos planes a la vez en la misma categoría)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sub_active_per_team
  ON public.subscriptions(team_id)
  WHERE status IN ('active','trialing','past_due','paused');

CREATE INDEX IF NOT EXISTS idx_subscriptions_team   ON public.subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_club   ON public.subscriptions(club_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del club ve las subs de su club.
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (club_id = get_user_club_id());

-- Escritura: SOLO service-role (webhook de Paddle). Sin policy de write para authenticated
-- = nadie crea/edita subs desde el cliente. El upgrade dispara checkout de Paddle, y el
-- webhook escribe acá.

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
