-- 025_calendar_type_constraint.sql
-- Reemplaza el CHECK constraint de calendar_events.type para incluir
-- todos los tipos nuevos agregados en el prompt anterior.
-- REGLA: cualquier adición de tipos al <select> del frontend debe incluir
-- esta migración. Sin esto los INSERT fallan con constraint violation.

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_type_check;

ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_type_check
  CHECK (type IN (
    -- Entrenamiento (escritos en training_sessions, pero algunos pasan por calendar_events)
    'tactical', 'gym', 'recovery', 'other',
    -- Match
    'match',
    -- Logística de viaje
    'travel',
    -- Reuniones / análisis
    'meeting', 'evaluation', 'video_session',
    -- Comidas
    'breakfast', 'lunch', 'dinner',
    -- Hotel / concentración
    'hotel_checkin', 'hotel_checkout',
    -- Transporte
    'bus_departure', 'bus_arrival',
    -- Obligaciones
    'press', 'medical_check',
    -- Match-related
    'walkthrough', 'scouting',
    -- Vida del jugador
    'day_off'
  ));
