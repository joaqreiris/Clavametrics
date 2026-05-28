-- Migration 021: UNIQUE constraint on lineup_players (lineup_id, role, slot_index)
-- Needed for upsert-by-slot: replaces a player in a slot without DELETE+INSERT.
-- Depends on: 019_lineups_v2.sql

ALTER TABLE lineup_players
  ADD CONSTRAINT uq_lineup_players_slot
  UNIQUE (lineup_id, role, slot_index);
