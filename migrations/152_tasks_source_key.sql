-- Migración 152: de dónde salió una tarea, para que la cola de decisiones no duplique.
--
-- La cola de decisiones de Load Monitor deriva sus ítems del análisis (ACWR en zona de riesgo,
-- mitigación por calor o viaje, progresión de rehab) y hasta ahora sólo los dibujaba: los que
-- agregaba el usuario a mano vivían en localStorage, así que se perdían al cambiar de
-- navegador y nadie más los veía. Ahora un ítem se convierte en una tarea de verdad.
--
-- `source_key` es la identidad del ítem que la originó, y existe para que convertir dos veces
-- no cree dos tareas. La clave la arma el cliente e incluye el equipo y la fecha de referencia
-- (assets/load-monitor.js, dqSourceKey), así que:
--   · apretar dos veces el mismo botón, o que lo aprieten dos personas del staff a la vez,
--     deja UNA tarea — el índice único lo garantiza en la base, no en la UI;
--   · la semana siguiente la clave es otra, así que el mismo riesgo vuelve a proponerse en
--     vez de quedar tapado por una tarea vieja ya cerrada.
--
-- Es nullable y sin default a propósito: las tareas que se crean a mano en Chat & Tasks no
-- tienen origen y no deben competir por la unicidad. Por eso el índice es PARCIAL.
--
-- No hace falta tocar RLS: las policies de `tasks` son por club y esta columna viaja con la
-- fila. Tampoco cambia nada de lo que ya existe — es aditiva.

alter table public.tasks add column if not exists source_key text;

comment on column public.tasks.source_key is
  'Identidad del ítem que originó la tarea, cuando no se creó a mano. Formato '
  '"<modulo>:<item>:<team_id>:<fecha_ref>" (lo arma dqSourceKey en assets/load-monitor.js). '
  'Único por club vía tasks_source_key_uniq para que convertir dos veces no duplique; NULL en '
  'las tareas creadas a mano desde Chat & Tasks.';

create unique index if not exists tasks_source_key_uniq
  on public.tasks (club_id, source_key)
  where source_key is not null;
