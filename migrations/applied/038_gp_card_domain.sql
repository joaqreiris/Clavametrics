-- ============================================================
-- 038 — GPS Builder · Fase 0: dominio gp.card/v1
--
-- Aditivo puro:
--   • Extiende gps_metric_definitions con kind + squad_rollup
--   • Crea las 4 tablas nuevas del builder (usadas en Fase 2+)
--   • No toca tablas existentes de forma destructiva
-- ============================================================

-- ── 1. Extender gps_metric_definitions ──────────────────────────────────────

ALTER TABLE gps_metric_definitions
  ADD COLUMN IF NOT EXISTS kind        text CHECK (kind IN ('accum','peak')),
  ADD COLUMN IF NOT EXISTS squad_rollup boolean NOT NULL DEFAULT true;

-- Rellenar kind para las métricas core existentes
-- peak  = valor instantáneo máximo (velocidad, ratio, índice)
-- accum = magnitud que se puede sumar / acumular (distancias, conteos, carga)
UPDATE gps_metric_definitions SET kind = 'peak'
WHERE is_core = true
  AND key IN ('max_speed', 'avg_speed', 'meters_per_min', 'distance_per_minute');

UPDATE gps_metric_definitions SET kind = 'accum'
WHERE is_core = true
  AND key IN (
    'total_distance', 'high_speed_distance', 'very_high_speed_distance',
    'sprint_distance', 'sprint_count', 'accelerations', 'decelerations',
    'player_load', 'hmld', 'time_played'
  );

-- Métricas custom sin kind quedan NULL (heredan 'accum' por defecto en el dominio)

-- ── 2. Tablas nuevas del builder (Fase 2+; aditivas, sin RLS bloqueante aún) ─

-- 2.1 Dashboards (las "tabs" del usuario)
CREATE TABLE IF NOT EXISTS dashboards (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  owner_id     uuid        REFERENCES auth.users(id),
  report_type  text,
  name         text        NOT NULL,
  scope        text        NOT NULL DEFAULT 'player' CHECK (scope IN ('player','squad')),
  sort_order   int         NOT NULL DEFAULT 0,
  is_shared    boolean     NOT NULL DEFAULT false,
  created_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboards_club ON dashboards(club_id, sort_order);

-- 2.2 Cards del dashboard (config = objeto gp.card/v1)
CREATE TABLE IF NOT EXISTS dashboard_cards (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  uuid        NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  config        jsonb       NOT NULL,
  size          text        NOT NULL DEFAULT 'md' CHECK (size IN ('sm','md','lg','full')),
  position      int         NOT NULL DEFAULT 0,
  source        text        NOT NULL DEFAULT 'builder' CHECK (source IN ('catalog','builder','ai')),
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT cfg_schema CHECK (config->>'schema' = 'gp.card/v1')
);
CREATE INDEX IF NOT EXISTS idx_dashboard_cards_pos ON dashboard_cards(dashboard_id, position);

-- 2.3 Plantillas reutilizables ("Add card → catálogo")
CREATE TABLE IF NOT EXISTS card_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  config      jsonb       NOT NULL,
  source      text        NOT NULL DEFAULT 'builder',
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT cfg_schema CHECK (config->>'schema' = 'gp.card/v1')
);

-- 2.4 Auditoría de generaciones IA
CREATE TABLE IF NOT EXISTS ai_card_generations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        REFERENCES clubs(id),
  user_id     uuid        REFERENCES auth.users(id),
  prompt      text        NOT NULL,
  produced    jsonb,
  model       text,
  valid       boolean,
  accepted    boolean,
  created_at  timestamptz DEFAULT now()
);

-- ── 3. RLS para las tablas nuevas ──────────────────────────────────────────

ALTER TABLE dashboards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_card_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members manage dashboards"
  ON dashboards FOR ALL TO authenticated
  USING  (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "club members manage dashboard cards"
  ON dashboard_cards FOR ALL TO authenticated
  USING  (dashboard_id IN (
    SELECT id FROM dashboards
    WHERE club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "club members manage card templates"
  ON card_templates FOR ALL TO authenticated
  USING  (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "club members manage ai generations"
  ON ai_card_generations FOR ALL TO authenticated
  USING  (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));
