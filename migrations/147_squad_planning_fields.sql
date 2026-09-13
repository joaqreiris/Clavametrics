-- Planificación de plantel para el director deportivo (Club Overview → pestaña Plantel).
--
-- Dos datos de ficha que la app pedía a gritos y no tenía. Los dos son NULLABLE a propósito:
-- ningún club queda obligado a cargarlos y nada de lo que ya existe cambia de comportamiento.
-- No llevan policies nuevas: las columnas heredan la RLS de su tabla (players y teams ya la
-- tienen por club_id), así que no se abre ninguna puerta.
--
-- 1) players.contract_until
--    La agenda de un director deportivo es, en buena medida, una lista de vencimientos. Sin esta
--    fecha la app podía decir "tengo 3 centrales" pero no "dos de ellos quedan libres en junio",
--    que es la mitad de la decisión. Se eligió DATE y no un modelo de contratos completo (salario,
--    agente, cláusulas, renovaciones) a propósito: eso es otro dominio, con su propia privacidad y
--    sus propios permisos, y meterlo acá lo dejaría a la vista de todo el staff que hoy lee
--    players. Con la fecha sola ya se resuelve el panel de vencimientos, y el día que haga falta
--    el resto vive en su tabla aparte.
--
-- 2) teams.category
--    Hoy la única forma de saber que "U18" es formativa y "Primera" no es parsear teams.name, que
--    es texto libre que cada club escribe como quiere. Cualquier agregado de academia ("todas las
--    formativas contra el primer equipo") dependía de adivinar. Es texto libre y no un enum porque
--    la taxonomía cambia por país y por deporte (U18/Juvenil A/Sub-18/Cadete son el mismo nivel con
--    cuatro nombres), y un CHECK acá se convertiría en una migración por cada club nuevo.
alter table public.players
  add column if not exists contract_until date;

comment on column public.players.contract_until is
  'Fecha de fin de contrato/vinculación del jugador. Alimenta el panel de vencimientos de Club Overview. NULL = sin dato (no implica "sin contrato").';

alter table public.teams
  add column if not exists category text;

comment on column public.teams.category is
  'Categoría o nivel del equipo (Primera, Reserva, U18, Juvenil…). Texto libre: la taxonomía cambia por país y deporte. Permite agrupar formativas vs primer equipo sin parsear teams.name. NULL = sin clasificar.';

-- Vencimientos: el panel filtra por club y ordena por fecha, y se consulta en cada carga de la
-- pestaña. El índice parcial deja fuera el NULL, que hoy es la enorme mayoría de las filas.
create index if not exists idx_players_contract_until
  on public.players (club_id, contract_until)
  where contract_until is not null and archived_at is null;
