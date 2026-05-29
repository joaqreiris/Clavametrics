-- Migration 027: calendar_events.sort_order + batch RPC
-- Purpose: persistent manual ordering for events without start_time.
-- Idempotent.

-- ─── A. sort_order column ────────────────────────────────────────────────────
-- Only used for events where start_time IS NULL.
-- Events with a time are ordered by start_time; sort_order stays NULL for them.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- ─── B. Index optimised for the combined ORDER BY used by renderGrid ─────────
--   WHERE club_id = X AND date BETWEEN Y AND Z
--   ORDER BY date ASC, start_time ASC NULLS LAST, sort_order ASC NULLS LAST, created_at ASC
CREATE INDEX IF NOT EXISTS idx_calendar_events_day_sort
  ON calendar_events (club_id, date, start_time NULLS LAST, sort_order NULLS LAST);

-- ─── C. RPC: batch_update_sort_orders ────────────────────────────────────────
-- Updates sort_order for no-time events across both tables in a single call.
-- p_calendar_ids / p_calendar_orders: parallel arrays for calendar_events rows.
-- p_session_ids  / p_session_orders:  parallel arrays for training_sessions rows.
-- Multi-tenant safety: WHERE clause always includes p_club_id.
CREATE OR REPLACE FUNCTION batch_update_sort_orders(
  p_calendar_ids    uuid[],
  p_calendar_orders integer[],
  p_session_ids     uuid[],
  p_session_orders  integer[],
  p_club_id         uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_calendar_ids IS NOT NULL AND array_length(p_calendar_ids, 1) > 0 THEN
    UPDATE calendar_events ce
    SET sort_order = v.ord
    FROM unnest(p_calendar_ids, p_calendar_orders) AS v(id uuid, ord integer)
    WHERE ce.id = v.id AND ce.club_id = p_club_id;
  END IF;

  IF p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN
    UPDATE training_sessions ts
    SET sort_order = v.ord
    FROM unnest(p_session_ids, p_session_orders) AS v(id uuid, ord integer)
    WHERE ts.id = v.id AND ts.club_id = p_club_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_sort_orders TO authenticated;
