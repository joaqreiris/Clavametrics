-- Migration 004: Session planning fields for Daily Planning
-- Adds orientation, focus, match_day_offset to training_sessions
-- Run in Supabase SQL Editor

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS orientation     varchar(50),
  ADD COLUMN IF NOT EXISTS focus           varchar(50),
  ADD COLUMN IF NOT EXISTS match_day_offset varchar(10);
