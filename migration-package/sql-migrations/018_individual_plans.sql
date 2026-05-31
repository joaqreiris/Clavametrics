-- =============================================================
-- Migration 018: Individual S&C Plans
-- Created: 2026-05-27
-- Depends on: 001 (players), gym_exercises
--
-- NOTAS:
-- - Validá ANTES si Planner / Gym Planner ya cubren plans
--   individuales. Si sí, EXTENDÉ esas tablas en vez de duplicar.
-- - "Individual S&C" = strength & conditioning personalizado por jugador.
-- =============================================================

-- ─── Planes individuales ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS individual_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  focus           text CHECK (focus IN ('strength','power','speed','endurance','mobility','return_to_play','general')),
  start_date      date,
  end_date        date,
  status          text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_individual_plans_club    ON individual_plans(club_id);
CREATE INDEX IF NOT EXISTS idx_individual_plans_player  ON individual_plans(player_id);
CREATE INDEX IF NOT EXISTS idx_individual_plans_status  ON individual_plans(status);

-- ─── Bloques del plan individual ──────────────────────────────
CREATE TABLE IF NOT EXISTS individual_plan_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES individual_plans(id) ON DELETE CASCADE,
  day_of_week     integer CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon, 6=Sun
  week_index      integer DEFAULT 0,                            -- semana relativa al start_date
  block_type      text NOT NULL CHECK (block_type IN ('warmup','strength','power','plyo','speed','mobility','cardio','cooldown','technical')),
  title           text NOT NULL,
  description     text,
  duration_min    integer,
  exercises       jsonb DEFAULT '[]'::jsonb,
  -- exercises: [{exercise_id (uuid REF gym_exercises), sets, reps, load, tempo, rest, notes}]
  intensity       text CHECK (intensity IN ('low','moderate','high','max')),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ipb_plan        ON individual_plan_blocks(plan_id);
CREATE INDEX IF NOT EXISTS idx_ipb_plan_week   ON individual_plan_blocks(plan_id, week_index, day_of_week, sort_order);

-- ─── Asignaciones de plan individual (histórico) ──────────────
-- Para tracking de qué planes tuvo el jugador en el tiempo.
CREATE TABLE IF NOT EXISTS player_individual_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES individual_plans(id) ON DELETE CASCADE,
  assigned_at     timestamptz DEFAULT now(),
  assigned_by     uuid REFERENCES profiles(id),
  unassigned_at   timestamptz,
  active          boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pia_player_active ON player_individual_assignments(player_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_pia_plan          ON player_individual_assignments(plan_id);

-- ─── Tracking de cumplimiento ────────────────────────────────
CREATE TABLE IF NOT EXISTS individual_block_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        uuid NOT NULL REFERENCES individual_plan_blocks(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  completed_at    timestamptz DEFAULT now(),
  scheduled_date  date NOT NULL,
  rpe             integer CHECK (rpe BETWEEN 1 AND 10),
  notes           text,
  UNIQUE (block_id, player_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_ibc_player_date ON individual_block_completions(player_id, scheduled_date DESC);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE individual_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_plan_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_individual_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_block_completions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY individual_plans_all ON individual_plans
  FOR ALL TO authenticated USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY individual_plan_blocks_all ON individual_plan_blocks
  FOR ALL TO authenticated USING (
    plan_id IN (
      SELECT id FROM individual_plans
      WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY player_individual_assignments_all ON player_individual_assignments
  FOR ALL TO authenticated USING (
    player_id IN (
      SELECT id FROM players
      WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY individual_block_completions_all ON individual_block_completions
  FOR ALL TO authenticated USING (
    player_id IN (
      SELECT id FROM players
      WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ─── Triggers ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS individual_plans_updated_at ON individual_plans;
CREATE TRIGGER individual_plans_updated_at BEFORE UPDATE ON individual_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
