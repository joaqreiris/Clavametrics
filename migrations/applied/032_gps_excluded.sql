-- Migration 032: GPS column exclusion flag
-- Persists per-column excluded state chosen by the user during import preview.
-- Enables automatic pre-exclusion on subsequent imports from the same provider.

ALTER TABLE gps_column_mappings ADD COLUMN IF NOT EXISTS excluded boolean DEFAULT false;
