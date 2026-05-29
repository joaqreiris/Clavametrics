-- Migration 031: GPS column type override
-- Persists per-column type manually chosen by the user during import review.
-- Enables automatic type application on subsequent imports from the same provider.

ALTER TABLE gps_column_mappings ADD COLUMN IF NOT EXISTS column_type text;
