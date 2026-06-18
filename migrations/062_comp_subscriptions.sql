-- =============================================================
-- Migration 062: Suscripciones de cortesía (comp)
-- Permite a un platform admin otorgar un plan sin pasar por el pago.
-- Un comp = sub real, sin provider_subscription_id, is_comp=true.
-- El resolver la lee como activa; el webhook de Paddle la ignora.
-- Depends on: 057 (subscriptions), 061 (is_super_admin canónica)
-- =============================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_comp boolean NOT NULL DEFAULT false;

-- ── Otorgar comp a UN team ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_comp_subscription(p_team_id uuid, p_plan_slug text DEFAULT 'full')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_club_id uuid; v_plan_id uuid; v_sub_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede otorgar cortesías';
  END IF;

  SELECT club_id INTO v_club_id FROM public.teams WHERE id = p_team_id;
  IF v_club_id IS NULL THEN RAISE EXCEPTION 'team % no existe', p_team_id; END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan % no existe', p_plan_slug; END IF;

  -- cancelar cualquier sub viva del team (deja rastro en el historial)
  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now()
   WHERE team_id = p_team_id
     AND status IN ('active','trialing','past_due','paused');

  INSERT INTO public.subscriptions
    (team_id, club_id, plan_id, status, billing_cycle, is_comp, current_period_start, current_period_end)
  VALUES
    (p_team_id, v_club_id, v_plan_id, 'active', 'monthly', true, now(), now() + interval '10 years')
  RETURNING id INTO v_sub_id;

  RETURN v_sub_id;
END; $$;

-- ── Otorgar comp a TODO un club (todos sus teams) ─────────────
CREATE OR REPLACE FUNCTION public.grant_comp_subscription_club(p_club_id uuid, p_plan_slug text DEFAULT 'full')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0; r record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede otorgar cortesías';
  END IF;
  FOR r IN SELECT id FROM public.teams WHERE club_id = p_club_id LOOP
    PERFORM public.grant_comp_subscription(r.id, p_plan_slug);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- ── Revocar la cortesía de un team ────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_comp_subscription(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede revocar cortesías';
  END IF;
  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now()
   WHERE team_id = p_team_id AND is_comp = true AND status = 'active';
END; $$;

REVOKE ALL ON FUNCTION public.grant_comp_subscription(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.grant_comp_subscription_club(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.revoke_comp_subscription(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_comp_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_comp_subscription_club(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_comp_subscription(uuid) TO authenticated;
