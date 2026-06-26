-- Migration 004: teams table + data cleanup
-- 1. Limpieza de datos con club_id falso
-- 2. Tabla teams (clubs → teams → players)
-- 3. team_id en players
-- 4. RLS en teams
-- 5. Equipos por defecto para clubs existentes
-- ─────────────────────────────────────────────────────────────────

-- ── 0. Diagnostico previo (ejecutar primero para verificar) ──────
-- SELECT DISTINCT club_id, count(*) FROM players GROUP BY club_id;
-- SELECT DISTINCT club_id, count(*) FROM availability GROUP BY club_id;
-- SELECT id, name FROM clubs;

-- ── 1. Limpieza de datos de prueba ───────────────────────────────
DO $$
DECLARE
  real_club UUID;
  fake_club UUID := 'c3740000-0000-0000-0000-000000000001';
  v_count   INT;
BEGIN
  -- El club real es el que tiene profiles (usuarios reales)
  SELECT DISTINCT p.club_id INTO real_club
  FROM public.profiles p
  INNER JOIN public.clubs c ON c.id = p.club_id
  LIMIT 1;

  IF real_club IS NULL THEN
    RAISE EXCEPTION 'No se encontró club real. Verifica la tabla clubs y profiles.';
  END IF;

  RAISE NOTICE 'Club real detectado: %', real_club;

  -- 1a. Migrar jugadores del club falso al real
  UPDATE public.players
  SET club_id = real_club
  WHERE club_id = fake_club;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Jugadores migrados: %', v_count;

  -- 1b. Migrar availability del club falso al real
  UPDATE public.availability
  SET club_id = real_club
  WHERE club_id = fake_club;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Availability migrados: %', v_count;

  -- 1c. Eliminar availability huérfanos (club_id no existe en clubs)
  DELETE FROM public.availability
  WHERE club_id NOT IN (SELECT id FROM public.clubs);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Availability huérfanos eliminados: %', v_count;

  -- 1d. Eliminar availability de jugadores que no pertenecen al club correcto
  -- (availability.player_id es TEXT, players.id es UUID — se castea)
  DELETE FROM public.availability a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = a.player_id::uuid
      AND p.club_id = a.club_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Availability cross-club eliminados: %', v_count;

END $$;

-- ── 2. Tabla teams ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  season     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, name)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view teams" ON public.teams
  FOR SELECT USING (club_id = get_user_club_id());

CREATE POLICY "Club members can insert teams" ON public.teams
  FOR INSERT WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "Club members can update teams" ON public.teams
  FOR UPDATE USING (club_id = get_user_club_id());

CREATE POLICY "Club members can delete teams" ON public.teams
  FOR DELETE USING (club_id = get_user_club_id());

CREATE INDEX IF NOT EXISTS teams_club_id_idx ON public.teams(club_id);

-- ── 3. Equipos por defecto para cada club existente ───────────────
INSERT INTO public.teams (club_id, name, season)
SELECT
  c.id,
  t.name,
  to_char(now(), 'YYYY') || '/' || to_char(now() + interval '1 year', 'YY')
FROM public.clubs c
CROSS JOIN (VALUES ('First Team'), ('U-19'), ('U-17')) AS t(name)
ON CONFLICT (club_id, name) DO NOTHING;

-- ── 4. Agregar team_id a players ──────────────────────────────────
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS players_team_id_idx ON public.players(team_id);

-- Asignar todos los jugadores existentes al equipo "First Team" de su club
UPDATE public.players p
SET team_id = (
  SELECT t.id FROM public.teams t
  WHERE t.club_id = p.club_id
    AND t.name = 'First Team'
  LIMIT 1
)
WHERE p.team_id IS NULL;

-- ── 5. RLS en availability — asegurar club_id correcto ────────────
-- Verificar si ya tiene RLS habilitado
DO $$
BEGIN
  -- Eliminar políticas antiguas si existen con nombres distintos
  -- y recrear con la función helper estándar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'availability'
      AND policyname = 'Club members can view availability'
  ) THEN
    ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Club members can view availability" ON public.availability
      FOR SELECT USING (club_id = get_user_club_id());

    CREATE POLICY "Club members can insert availability" ON public.availability
      FOR INSERT WITH CHECK (club_id = get_user_club_id());

    CREATE POLICY "Club members can update availability" ON public.availability
      FOR UPDATE USING (club_id = get_user_club_id());

    CREATE POLICY "Club members can delete availability" ON public.availability
      FOR DELETE USING (club_id = get_user_club_id());

    RAISE NOTICE 'RLS policies creadas para availability';
  ELSE
    RAISE NOTICE 'RLS policies de availability ya existen, sin cambios';
  END IF;
END $$;
