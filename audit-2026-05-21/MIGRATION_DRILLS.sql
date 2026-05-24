-- Migration: drills + session_drills
-- Fase 9 — Planner Editor (Fabric.js)
-- 2026-05-22

CREATE TABLE IF NOT EXISTS public.drills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  session_id   uuid REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  name         text NOT NULL DEFAULT 'Untitled drill',
  duration     integer,          -- minutes
  objects_json jsonb,            -- Fabric.js canvas.toJSON() output
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drills_select" ON public.drills
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "drills_insert" ON public.drills
  FOR INSERT WITH CHECK (
    club_id IN (SELECT club_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "drills_update" ON public.drills
  FOR UPDATE USING (
    club_id IN (SELECT club_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "drills_delete" ON public.drills
  FOR DELETE USING (
    club_id IN (
      SELECT club_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner', 'coach', 'head_coach')
    )
  );

CREATE OR REPLACE FUNCTION public.set_drills_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER drills_updated_at
  BEFORE UPDATE ON public.drills
  FOR EACH ROW EXECUTE FUNCTION public.set_drills_updated_at();

CREATE INDEX IF NOT EXISTS drills_club_id_idx     ON public.drills(club_id);
CREATE INDEX IF NOT EXISTS drills_session_id_idx  ON public.drills(session_id);
