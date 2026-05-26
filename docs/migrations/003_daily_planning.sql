-- Migration 003: Daily Planning — published flag on training_sessions
-- Run in Supabase SQL Editor

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
