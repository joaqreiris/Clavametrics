-- Migration: club_settings
-- Fase 7 — Admin Module Toggles
-- 2026-05-22

CREATE TABLE IF NOT EXISTS public.club_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  module_key  text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, module_key)
);

ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;

-- Members of the club can read their own settings
CREATE POLICY "club_settings_select" ON public.club_settings
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only admin/owner can modify module settings
CREATE POLICY "club_settings_upsert" ON public.club_settings
  FOR ALL USING (
    club_id IN (
      SELECT club_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_club_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER club_settings_updated_at
  BEFORE UPDATE ON public.club_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_club_settings_updated_at();
