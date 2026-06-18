-- =============================================================
-- Migration 063: Billing — resolver helpers (pura lectura)
-- Resuelven el plan EFECTIVO de un team + features + límite.
-- Regla: team sin subscription entitling = Iniciación (free).
-- No cambian comportamiento: solo leen. El enforcement duro se monta
-- encima MÁS ADELANTE (cuando Paddle esté vivo y la gente pueda pagar).
-- Depends on: 055 (plans), 057 (subscriptions), 062 (is_comp)
-- =============================================================

-- Plan efectivo (slug) de un team. Sin sub entitling → 'initiation'.
CREATE OR REPLACE FUNCTION public.team_plan_slug(p_team_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT pl.slug
       FROM public.subscriptions s
       JOIN public.plans pl ON pl.id = s.plan_id
      WHERE s.team_id = p_team_id
        AND s.status IN ('active','trialing','past_due')
      ORDER BY pl.sort_order DESC   -- defensivo: si hubiera >1, la más alta
      LIMIT 1),
    'initiation'
  );
$$;

-- Features (jsonb array) del plan efectivo.
CREATE OR REPLACE FUNCTION public.team_features(p_team_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(pl.features, '[]'::jsonb)
    FROM public.plans pl
   WHERE pl.slug = public.team_plan_slug(p_team_id);
$$;

-- ¿El team tiene una feature concreta?
CREATE OR REPLACE FUNCTION public.team_has_feature(p_team_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.team_features(p_team_id) ? p_key;
$$;

-- Límite de players del plan efectivo (null = ilimitado).
CREATE OR REPLACE FUNCTION public.team_player_limit(p_team_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pl.max_players
    FROM public.plans pl
   WHERE pl.slug = public.team_plan_slug(p_team_id);
$$;

REVOKE ALL ON FUNCTION public.team_plan_slug(uuid)        FROM public;
REVOKE ALL ON FUNCTION public.team_features(uuid)         FROM public;
REVOKE ALL ON FUNCTION public.team_has_feature(uuid,text) FROM public;
REVOKE ALL ON FUNCTION public.team_player_limit(uuid)     FROM public;
GRANT EXECUTE ON FUNCTION public.team_plan_slug(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_features(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_has_feature(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_player_limit(uuid)     TO authenticated;
