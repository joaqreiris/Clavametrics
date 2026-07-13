-- 120_training_sessions_recurrence_group.sql
-- Agrupa series de entrenamientos recurrentes (paridad con calendar_events.recurrence_group_id,
-- que venia de 024). Necesario porque el ruteo por tipo manda las sesiones recurrentes a
-- training_sessions; sin esta columna no se podia borrar/gestionar la serie completa.
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid NULL;
CREATE INDEX IF NOT EXISTS training_sessions_recurrence_group_id_idx
  ON public.training_sessions(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
