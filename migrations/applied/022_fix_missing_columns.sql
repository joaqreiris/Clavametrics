-- Migration 022: Fix missing columns + channel_reads table
-- Created: 2026-05-28
-- Fixes:
--   (a) calendar_events.rival_crest_url  — causa 400 en loadNextMatch() de Lineup
--   (b) lineups.style_config             — causa 400 en getOrCreateLineup() y scheduleSave()
--   (c) lineup_players UNIQUE constraint  — necesario para upsert-by-slot
--   (d) channel_reads table              — causa 404 en _initChatNotif() de sidebar.js
--
-- Idempotent: todas las sentencias usan IF NOT EXISTS / IF NOT EXISTS equivalente.
-- Ejecutar en Supabase SQL Editor (requiere service_role o postgres role).

-- ─── A. calendar_events.rival_crest_url ─────────────────────────────────────
-- Set by the Lineup builder when the coach uploads the opponent crest.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS rival_crest_url text;

-- ─── B. lineups.style_config ─────────────────────────────────────────────────
-- Stores custom poster color overrides: { "title_color": "#ffffff", "accent_color": "#4ADE80" }
ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS style_config jsonb DEFAULT '{}'::jsonb;

-- ─── C. lineup_players: UNIQUE (lineup_id, role, slot_index) ─────────────────
-- Needed for deterministic per-slot selection without double entries.
-- Using DO block to skip gracefully if constraint already exists.
DO $$
BEGIN
  ALTER TABLE lineup_players
    ADD CONSTRAINT uq_lineup_players_slot
    UNIQUE (lineup_id, role, slot_index);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END;
$$;

-- ─── D. channel_reads ────────────────────────────────────────────────────────
-- Tracks last-read position per user per conversation channel.
-- channel_key = 'group' for club-wide channel, or a user UUID for DMs.
CREATE TABLE IF NOT EXISTS channel_reads (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_key  text        NOT NULL,
  club_id      uuid        NOT NULL REFERENCES clubs(id)      ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_key, club_id)
);

ALTER TABLE channel_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own reads" ON channel_reads;
CREATE POLICY "Users manage their own reads"
  ON channel_reads FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
