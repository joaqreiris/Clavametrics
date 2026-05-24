-- Migration: session_exercises table
-- Required for Daily Planning field exercises
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.session_exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.gym_exercises(id) ON DELETE SET NULL,
  name        text,
  phase       text NOT NULL DEFAULT 'main' CHECK (phase IN ('warmup','main','cooldown')),
  duration    integer,
  intensity   text,
  position    integer NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_members_manage_session_exercises"
  ON public.session_exercises FOR ALL
  USING  (club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON public.session_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_club    ON public.session_exercises(club_id);
