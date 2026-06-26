-- Migration 020: Lineup additions
-- Created: 2026-05-28
-- Depends on: calendar_events.sql, 008_lineups.sql, 019_lineups_v2.sql

-- A. Add rival crest URL to calendar_events (set by lineup builder upload)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS rival_crest_url text;

-- B. Add style_config JSONB to lineups for custom poster colors
--    Shape: { "title_color": "#ffffff", "accent_color": "#4ADE80" }
ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS style_config jsonb DEFAULT '{}'::jsonb;
