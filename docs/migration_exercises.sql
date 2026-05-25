-- ============================================================
-- MIGRATION: Planner Exercise Library
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. exercises — field exercise library (created in Planner)
CREATE TABLE IF NOT EXISTS exercises (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id           uuid    NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name              text    NOT NULL DEFAULT 'New exercise',
  players_count     integer DEFAULT 0,
  field_width       numeric(6,1) DEFAULT 0,
  field_height      numeric(6,1) DEFAULT 0,
  duration          integer DEFAULT 0,            -- total minutes
  series            integer DEFAULT 1,
  work_time         text    DEFAULT '3:00',        -- mm:ss
  rest_time         text    DEFAULT '1:30',
  orientation       text    CHECK (orientation IN ('ACTIVATION','STRENGTH','VELOCITY','ENDURANCE')),
  objects_json      jsonb,                         -- Fabric.js canvas state
  created_by        uuid    REFERENCES profiles(id),
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can manage exercises"
  ON exercises FOR ALL
  USING (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- 2. exercise_drills — sub-drills within each exercise
CREATE TABLE IF NOT EXISTS exercise_drills (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id uuid    NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  club_id     uuid    NOT NULL,
  name        text    NOT NULL,
  duration    integer,    -- minutes
  notes       text,
  position    integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE exercise_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can manage exercise_drills"
  ON exercise_drills FOR ALL
  USING (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- 3. Extend session_exercises to support Planner exercises
ALTER TABLE session_exercises
  ADD COLUMN IF NOT EXISTS planner_exercise_id  uuid    REFERENCES exercises(id),
  ADD COLUMN IF NOT EXISTS field_width          numeric(6,1),
  ADD COLUMN IF NOT EXISTS field_height         numeric(6,1),
  ADD COLUMN IF NOT EXISTS players_count        integer,
  ADD COLUMN IF NOT EXISTS m2_per_player        integer,
  ADD COLUMN IF NOT EXISTS calc_orientation     text;
