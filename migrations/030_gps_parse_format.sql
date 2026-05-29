-- Migration 030: GPS parse format column
-- Persists per-column parse format chosen by the user during import review.
-- Enables automatic format application on subsequent imports from the same provider.

ALTER TABLE gps_column_mappings ADD COLUMN IF NOT EXISTS parse_format text;
