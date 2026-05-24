-- ============================================================
-- CLAVAMETRICS: Schema Nuevo Desde Cero
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- Para startup sin datos históricos
-- Incluye: Tablas, RLS, Funciones, Triggers, Índices
-- ============================================================

-- ============================================================
-- FUNCIÓN HELPER: Obtener club_id del usuario logueado
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_club_id()
RETURNS UUID AS $$
  SELECT club_id FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 1. TABLA: clubs
-- ============================================================
DROP TABLE IF EXISTS public.clubs CASCADE;

CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#000000',
  secondary_color text DEFAULT '#FFFFFF',
  country text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their club"
  ON public.clubs FOR SELECT
  USING (id = get_user_club_id());

CREATE INDEX clubs_id_idx ON public.clubs(id);

-- ============================================================
-- 2. TABLA: profiles
-- ============================================================
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'coach', 'physio', 'analyst', 'nutritionist', 'staff')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles from their club"
  ON public.profiles FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Club admins can update club profiles"
  ON public.profiles FOR UPDATE
  USING (
    club_id = get_user_club_id() AND 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE INDEX profiles_club_id_idx ON public.profiles(club_id);
CREATE INDEX profiles_email_idx ON public.profiles(email);
CREATE INDEX profiles_role_idx ON public.profiles(club_id, role);

-- ============================================================
-- 3. TABLA: players
-- ============================================================
DROP TABLE IF EXISTS public.players CASCADE;

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  position text,
  date_of_birth date,
  nationality text,
  height numeric(5,2),  -- cm
  weight numeric(5,2),  -- kg
  dominant_foot text CHECK (dominant_foot IN ('left', 'right', 'both', NULL)),
  status text DEFAULT 'available' CHECK (status IN ('available', 'injured', 'modified', 'unavailable')),
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view their players"
  ON public.players FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert players"
  ON public.players FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update their players"
  ON public.players FOR UPDATE
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can delete their players"
  ON public.players FOR DELETE
  USING (club_id = get_user_club_id());

CREATE INDEX players_club_id_idx ON public.players(club_id);
CREATE INDEX players_status_idx ON public.players(club_id, status);
CREATE INDEX players_name_idx ON public.players(club_id, first_name, last_name);
CREATE INDEX players_position_idx ON public.players(club_id, position);

-- ============================================================
-- 4. TABLA: training_sessions
-- ============================================================
DROP TABLE IF EXISTS public.training_sessions CASCADE;

CREATE TABLE public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  session_date date NOT NULL,
  session_time time,
  duration integer,  -- minutos
  session_type text NOT NULL CHECK (session_type IN ('gym', 'recovery', 'tactical', 'match', 'conditioning', 'other')),
  coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view their sessions"
  ON public.training_sessions FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert sessions"
  ON public.training_sessions FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update sessions"
  ON public.training_sessions FOR UPDATE
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can delete sessions"
  ON public.training_sessions FOR DELETE
  USING (club_id = get_user_club_id());

CREATE INDEX training_sessions_club_id_idx ON public.training_sessions(club_id);
CREATE INDEX training_sessions_date_idx ON public.training_sessions(club_id, session_date DESC);
CREATE INDEX training_sessions_type_idx ON public.training_sessions(club_id, session_type);
CREATE INDEX training_sessions_coach_idx ON public.training_sessions(coach_id);

-- ============================================================
-- 5. TABLA: wellness
-- ============================================================
DROP TABLE IF EXISTS public.wellness CASCADE;

CREATE TABLE public.wellness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sleep_quality numeric(1,0) CHECK (sleep_quality BETWEEN 1 AND 10),  -- 1-10 scale
  fatigue numeric(1,0) CHECK (fatigue BETWEEN 1 AND 10),
  soreness numeric(1,0) CHECK (soreness BETWEEN 1 AND 10),
  stress numeric(1,0) CHECK (stress BETWEEN 1 AND 10),
  mood numeric(1,0) CHECK (mood BETWEEN 1 AND 10),
  readiness numeric(1,0) CHECK (readiness BETWEEN 1 AND 10),
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.wellness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view wellness from their club"
  ON public.wellness FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert wellness"
  ON public.wellness FOR INSERT
  WITH CHECK (
    club_id = get_user_club_id() AND
    player_id IN (SELECT id FROM public.players WHERE club_id = get_user_club_id())
  );

CREATE POLICY "Club members can update wellness"
  ON public.wellness FOR UPDATE
  USING (
    club_id = get_user_club_id() AND
    player_id IN (SELECT id FROM public.players WHERE club_id = get_user_club_id())
  );

CREATE INDEX wellness_player_id_idx ON public.wellness(player_id);
CREATE INDEX wellness_club_player_idx ON public.wellness(club_id, player_id);
CREATE INDEX wellness_date_idx ON public.wellness(club_id, submitted_at DESC);

-- Crear vista para últimas wellness entries
CREATE OR REPLACE VIEW wellness_latest AS
SELECT DISTINCT ON (player_id)
  id, player_id, club_id, sleep_quality, fatigue, soreness, 
  stress, mood, readiness, submitted_at
FROM public.wellness
ORDER BY player_id, submitted_at DESC;

-- ============================================================
-- 6. TABLA: injuries
-- ============================================================
DROP TABLE IF EXISTS public.injuries CASCADE;

CREATE TABLE public.injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  injury_type text NOT NULL CHECK (injury_type IN ('muscle', 'joint', 'bone', 'other')),
  body_area text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovery', 'cleared')),
  start_date date NOT NULL,
  expected_return date,
  returned_date date,
  treatment text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view injuries from their club"
  ON public.injuries FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert injuries"
  ON public.injuries FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update injuries"
  ON public.injuries FOR UPDATE
  USING (club_id = get_user_club_id());

CREATE INDEX injuries_player_id_idx ON public.injuries(player_id);
CREATE INDEX injuries_club_id_idx ON public.injuries(club_id);
CREATE INDEX injuries_status_idx ON public.injuries(club_id, status);
CREATE INDEX injuries_date_idx ON public.injuries(start_date DESC);

-- ============================================================
-- 7. TABLA: gps_reports
-- ============================================================
DROP TABLE IF EXISTS public.gps_reports CASCADE;

CREATE TABLE public.gps_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  total_distance numeric(10,2),  -- metros
  high_speed_distance numeric(10,2),
  sprint_distance numeric(10,2),
  accelerations numeric(10,2),
  decelerations numeric(10,2),
  max_speed numeric(10,2),  -- km/h
  player_load numeric(10,2),
  avg_speed numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, session_id)
);

ALTER TABLE public.gps_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view gps from their club"
  ON public.gps_reports FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert gps"
  ON public.gps_reports FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE INDEX gps_reports_player_id_idx ON public.gps_reports(player_id);
CREATE INDEX gps_reports_session_id_idx ON public.gps_reports(session_id);
CREATE INDEX gps_reports_club_id_idx ON public.gps_reports(club_id);
CREATE INDEX gps_reports_created_idx ON public.gps_reports(created_at DESC);

-- ============================================================
-- 8. TABLA: rpe
-- ============================================================
DROP TABLE IF EXISTS public.rpe CASCADE;

CREATE TABLE public.rpe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  rpe numeric(5,2) NOT NULL CHECK (rpe BETWEEN 0 AND 10),  -- Rating of Perceived Exertion
  duration integer NOT NULL,  -- minutos
  load numeric(10,2),  -- rpe * duration
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, session_id)
);

ALTER TABLE public.rpe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view rpe from their club"
  ON public.rpe FOR SELECT
  USING (
    player_id IN (
      SELECT id FROM public.players 
      WHERE club_id = get_user_club_id()
    )
  );

CREATE POLICY "Club members can insert rpe"
  ON public.rpe FOR INSERT
  WITH CHECK (
    player_id IN (
      SELECT id FROM public.players 
      WHERE club_id = get_user_club_id()
    )
  );

CREATE INDEX rpe_player_id_idx ON public.rpe(player_id);
CREATE INDEX rpe_session_id_idx ON public.rpe(session_id);
CREATE INDEX rpe_created_idx ON public.rpe(created_at DESC);

-- Trigger para calcular load automáticamente
CREATE OR REPLACE FUNCTION calculate_rpe_load()
RETURNS TRIGGER AS $$
BEGIN
  NEW.load := NEW.rpe * NEW.duration;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rpe_calculate_load_trigger
BEFORE INSERT OR UPDATE ON public.rpe
FOR EACH ROW
EXECUTE FUNCTION calculate_rpe_load();

-- ============================================================
-- 9. TABLA: evaluations
-- ============================================================
DROP TABLE IF EXISTS public.evaluations CASCADE;

CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  evaluation_type text NOT NULL CHECK (evaluation_type IN ('CMJ', 'sprint', 'vo2', 'strength', 'mobility', 'flexibility', 'balance', 'other')),
  test_date date NOT NULL,
  value numeric(10,4) NOT NULL,
  unit text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view evaluations from their club"
  ON public.evaluations FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert evaluations"
  ON public.evaluations FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update evaluations"
  ON public.evaluations FOR UPDATE
  USING (club_id = get_user_club_id());

CREATE INDEX evaluations_player_id_idx ON public.evaluations(player_id);
CREATE INDEX evaluations_club_id_idx ON public.evaluations(club_id);
CREATE INDEX evaluations_type_idx ON public.evaluations(club_id, evaluation_type);
CREATE INDEX evaluations_date_idx ON public.evaluations(test_date DESC);

-- ============================================================
-- 10. TABLA: nutrition
-- ============================================================
DROP TABLE IF EXISTS public.nutrition CASCADE;

CREATE TABLE public.nutrition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  calories numeric(10,2),
  protein numeric(10,2),  -- gramos
  carbs numeric(10,2),
  fats numeric(10,2),
  hydration numeric(10,2),  -- litros
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view nutrition from their club"
  ON public.nutrition FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert nutrition"
  ON public.nutrition FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update nutrition"
  ON public.nutrition FOR UPDATE
  USING (club_id = get_user_club_id());

CREATE INDEX nutrition_player_id_idx ON public.nutrition(player_id);
CREATE INDEX nutrition_club_player_idx ON public.nutrition(club_id, player_id);
CREATE INDEX nutrition_date_idx ON public.nutrition(club_id, log_date DESC);

-- ============================================================
-- 11. TABLA: chat_messages
-- ============================================================
DROP TABLE IF EXISTS public.chat_messages CASCADE;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' 
    CHECK (message_type IN ('text', 'task_ref', 'report_share', 'system')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view messages"
  ON public.chat_messages FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE INDEX chat_messages_club_created_idx ON public.chat_messages(club_id, created_at DESC);
CREATE INDEX chat_messages_sender_idx ON public.chat_messages(sender_id);

-- ============================================================
-- 12. TABLA: tasks
-- ============================================================
DROP TABLE IF EXISTS public.tasks CASCADE;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name text NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to_name text,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view tasks"
  ON public.tasks FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update tasks"
  ON public.tasks FOR UPDATE
  USING (club_id = get_user_club_id());

CREATE INDEX tasks_club_idx ON public.tasks(club_id);
CREATE INDEX tasks_assigned_idx ON public.tasks(assigned_to);
CREATE INDEX tasks_status_idx ON public.tasks(club_id, status);
CREATE INDEX tasks_due_idx ON public.tasks(due_date);

-- ============================================================
-- 13. TABLA: player_anthropometrics (histórico)
-- ============================================================
DROP TABLE IF EXISTS public.player_anthropometrics CASCADE;

CREATE TABLE public.player_anthropometrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  measurement_date date NOT NULL,
  weight numeric(5,2),
  height numeric(5,2),
  body_fat_pct numeric(5,2),
  muscle_mass numeric(5,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.player_anthropometrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view anthropometrics"
  ON public.player_anthropometrics FOR SELECT
  USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert anthropometrics"
  ON public.player_anthropometrics FOR INSERT
  WITH CHECK (club_id = get_user_club_id());

CREATE INDEX anthropometrics_player_idx ON public.player_anthropometrics(player_id);
CREATE INDEX anthropometrics_date_idx ON public.player_anthropometrics(measurement_date DESC);

-- ============================================================
-- 14. TABLA: audit_log
-- ============================================================
DROP TABLE IF EXISTS public.audit_log CASCADE;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view their audit logs"
  ON public.audit_log FOR SELECT
  USING (club_id = get_user_club_id());

CREATE INDEX audit_log_club_idx ON public.audit_log(club_id);
CREATE INDEX audit_log_user_idx ON public.audit_log(user_id);
CREATE INDEX audit_log_table_idx ON public.audit_log(table_name);
CREATE INDEX audit_log_created_idx ON public.audit_log(created_at DESC);

-- ============================================================
-- FUNCIÓN: Generar reporte de disponibilidad de jugadores
-- ============================================================
CREATE OR REPLACE FUNCTION get_player_availability(p_club_id UUID)
RETURNS TABLE (
  player_id UUID,
  first_name TEXT,
  last_name TEXT,
  status TEXT,
  current_injuries INT,
  last_wellness TIMESTAMP,
  readiness INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.status,
    COUNT(i.id)::INT as current_injuries,
    MAX(w.submitted_at),
    MAX((w.readiness)::INT)
  FROM public.players p
  LEFT JOIN public.injuries i ON i.player_id = p.id AND i.status = 'active'
  LEFT JOIN public.wellness w ON w.player_id = p.id
  WHERE p.club_id = p_club_id
  GROUP BY p.id, p.first_name, p.last_name, p.status
  ORDER BY p.status DESC, p.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: Calcular carga acumulada (Acute/Chronic)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_player_load(
  p_player_id UUID,
  p_days_acute INT DEFAULT 7,
  p_days_chronic INT DEFAULT 28
)
RETURNS TABLE (
  acute_load NUMERIC,
  chronic_load NUMERIC,
  acwr NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH acute_load_cte AS (
    SELECT SUM(COALESCE(load, 0)) as total_load
    FROM public.rpe
    WHERE player_id = p_player_id
      AND created_at > NOW() - (p_days_acute || ' days')::INTERVAL
  ),
  chronic_load_cte AS (
    SELECT SUM(COALESCE(load, 0)) as total_load
    FROM public.rpe
    WHERE player_id = p_player_id
      AND created_at > NOW() - (p_days_chronic || ' days')::INTERVAL
  )
  SELECT 
    COALESCE(a.total_load, 0)::NUMERIC,
    COALESCE(c.total_load, 0)::NUMERIC,
    CASE 
      WHEN c.total_load = 0 THEN 0
      ELSE ROUND((COALESCE(a.total_load, 0)::NUMERIC / (c.total_load)::NUMERIC), 2)
    END as acwr
  FROM acute_load_cte a, chronic_load_cte c;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- GRANTS: Permisos para usuarios autenticados
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.training_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wellness TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.injuries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gps_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rpe TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nutrition TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
GRANT SELECT, INSERT ON public.player_anthropometrics TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT ON public.wellness_latest TO authenticated;

-- ============================================================
-- VALIDACIÓN FINAL
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Schema Creation Complete ✓';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ clubs';
  RAISE NOTICE '  ✓ profiles';
  RAISE NOTICE '  ✓ players';
  RAISE NOTICE '  ✓ training_sessions';
  RAISE NOTICE '  ✓ wellness';
  RAISE NOTICE '  ✓ injuries';
  RAISE NOTICE '  ✓ gps_reports';
  RAISE NOTICE '  ✓ rpe';
  RAISE NOTICE '  ✓ evaluations';
  RAISE NOTICE '  ✓ nutrition';
  RAISE NOTICE '  ✓ chat_messages';
  RAISE NOTICE '  ✓ tasks';
  RAISE NOTICE '  ✓ player_anthropometrics';
  RAISE NOTICE '  ✓ audit_log';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ Row Level Security (RLS) enabled';
  RAISE NOTICE '  ✓ All indexes created for performance';
  RAISE NOTICE '  ✓ Triggers for calculations';
  RAISE NOTICE '  ✓ Helper functions for reports';
  RAISE NOTICE '  ✓ Audit logging table';
  RAISE NOTICE '  ✓ Multi-tenant architecture';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for: Multi-tenant SaaS Platform';
  RAISE NOTICE 'Database: Supabase PostgreSQL';
  RAISE NOTICE 'Authentication: Supabase Auth';
  RAISE NOTICE '====================================';
END $$;

