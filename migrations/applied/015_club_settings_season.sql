-- Migration: add season configuration columns to club_settings
-- Calendar — Season Ribbon feature
-- 2026-05-27

ALTER TABLE public.club_settings
  ADD COLUMN IF NOT EXISTS season_start  DATE,
  ADD COLUMN IF NOT EXISTS season_end    DATE,
  ADD COLUMN IF NOT EXISTS season_name   TEXT,
  ADD COLUMN IF NOT EXISTS competition   TEXT;
