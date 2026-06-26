-- 053_gym_session_content.sql
-- Persistencia del contenido del Gym Planner.
-- Hasta ahora training_sessions guardaba solo el "sobre" de la sesión de gym
-- (título, hora, duración, ubicación, notas, RPE). Las filas de ejercicios
-- (warm-up / plyo / main) eran hardcoded y se perdían.
-- gym_content (JSONB) guarda el contenido real:
--   { warmup:{min, rows:[...]}, plyo:{min, rows:[...]}, main:{min, rows:[...]}, adaptations:[...] }
-- Idempotente. training_sessions ya tiene RLS, no hace falta tocarla.

alter table public.training_sessions
  add column if not exists gym_content jsonb;
