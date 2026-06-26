-- Add rival crest URL and match data to lineups table
ALTER TABLE lineups ADD COLUMN IF NOT EXISTS rival_crest_url TEXT;
ALTER TABLE lineups ADD COLUMN IF NOT EXISTS match_data JSONB;
-- match_data stores inline-edited match header fields:
-- { opponent, homeAway, date, time, location, competition, matchId }
