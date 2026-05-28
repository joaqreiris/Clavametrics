-- 024_calendar_recurrence.sql
-- Adds recurrence_group_id to calendar_events for recurring event series.
-- Also documents that calendar_events now accepts 11 new event types
-- (breakfast, lunch, dinner, hotel_checkin, hotel_checkout, bus_departure,
--  bus_arrival, press, medical_check, walkthrough, scouting, day_off).
-- No DB constraint on type — enforced at application level.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_group
  ON calendar_events(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
