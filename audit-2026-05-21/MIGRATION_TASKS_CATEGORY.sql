-- Migration: Add category column to tasks
-- Run this in Supabase SQL Editor
-- Required for Match-day / Medical / Routine filters in Chat & Tasks

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('match_day','medical','routine','general'))
    DEFAULT 'general';

-- Backfill existing tasks
UPDATE tasks SET category = 'general' WHERE category IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE tasks ALTER COLUMN category SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN category SET DEFAULT 'general';
