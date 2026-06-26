-- =============================================================
-- Migration 065: Helpers de gating a nivel club (Opción A)
-- my_plan_features(): TODAS las features a las que el club del usuario
--   actual tiene derecho (union de los planes de sus teams). El cliente
--   la pide una vez y cachea. Club sin teams → initiation (free).
-- club_has_feature(): helper general por club+key.
-- Pura lectura, montado sobre el resolver de la 063.
-- Depends on: 063 (team_features/team_has_feature), get_user_club_id
-- =============================================================

CREATE OR REPLACE FUNCTION public.my_plan_features()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club uuid := public.get_user_club_id();
  v_feats jsonb;
  v_has_teams boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.teams WHERE club_id = v_club) INTO v_has_teams;

  IF NOT v_has_teams THEN
    SELECT coalesce(features,'[]'::jsonb) INTO v_feats
      FROM public.plans WHERE slug = 'initiation';
    RETURN coalesce(v_feats,'[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(DISTINCT elem), '[]'::jsonb)
    INTO v_feats
    FROM public.teams t
    CROSS JOIN LATERAL jsonb_array_elements_text(public.team_features(t.id)) AS elem
   WHERE t.club_id = v_club;

  RETURN coalesce(v_feats,'[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.club_has_feature(p_club_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.club_id = p_club_id AND public.team_has_feature(t.id, p_key)
  );
$$;

REVOKE ALL ON FUNCTION public.my_plan_features()             FROM public;
REVOKE ALL ON FUNCTION public.club_has_feature(uuid, text)   FROM public;
GRANT EXECUTE ON FUNCTION public.my_plan_features()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_has_feature(uuid, text) TO authenticated;
