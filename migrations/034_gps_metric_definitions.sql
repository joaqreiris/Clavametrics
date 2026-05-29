-- ============================================================
-- Bloque 7 — Paso 1: Métricas custom por club (modelo híbrido)
-- ============================================================

-- 1. Catálogo de métricas por club
CREATE TABLE IF NOT EXISTS gps_metric_definitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  key             text        NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label           text        NOT NULL,
  unit            text,
  category        text        NOT NULL DEFAULT 'custom'
                              CHECK (category IN ('distance','speed','acceleration','load','time','count','custom')),
  description     text,
  decimals        integer     NOT NULL DEFAULT 2 CHECK (decimals BETWEEN 0 AND 4),
  is_core         boolean     NOT NULL DEFAULT false,
  display_order   integer     DEFAULT 100,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (club_id, key)
);

CREATE INDEX IF NOT EXISTS idx_gps_metric_def_club
  ON gps_metric_definitions(club_id);

-- 2. Valores extras de métricas por reporte (EAV para non-core)
CREATE TABLE IF NOT EXISTS gps_report_metrics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid        NOT NULL REFERENCES gps_reports(id) ON DELETE CASCADE,
  club_id     uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  metric_key  text        NOT NULL,
  value       numeric,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (report_id, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_gps_rm_report
  ON gps_report_metrics(report_id);

CREATE INDEX IF NOT EXISTS idx_gps_rm_club_metric
  ON gps_report_metrics(club_id, metric_key);

-- 3. RLS
ALTER TABLE gps_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_report_metrics     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members can manage metric definitions"
  ON gps_metric_definitions
  FOR ALL
  TO authenticated
  USING  (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "club members can manage report metrics"
  ON gps_report_metrics
  FOR ALL
  TO authenticated
  USING  (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (club_id = (SELECT club_id FROM profiles WHERE id = auth.uid()));

-- 4. Trigger updated_at en gps_metric_definitions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gps_metric_def_updated_at
  BEFORE UPDATE ON gps_metric_definitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
