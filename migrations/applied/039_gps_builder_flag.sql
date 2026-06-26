-- ============================================================
-- 039 — GPS Builder · feature flag por club
-- Aditivo: agrega columna nullable a club_gps_settings.
-- Rollback = UPDATE club_gps_settings SET gps_builder_enabled = false.
-- ============================================================

ALTER TABLE club_gps_settings
  ADD COLUMN IF NOT EXISTS gps_builder_enabled boolean NOT NULL DEFAULT false;
