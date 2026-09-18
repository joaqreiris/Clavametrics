-- Migration 189: la adaptación del fisio deja de ser un solo día.
--
-- El fisio trata a un jugador HOY, después del entrenamiento, y escribe la adaptación para el
-- cuerpo técnico. Hasta ahora `adaptation_date` arrancaba en el día del tratamiento, así que la
-- recomendación caía en la sesión que YA se hizo: nadie la podía aplicar. El campo dice
-- "adaptación para la próxima sesión" pero apuntaba a la anterior.
--
-- Dos cambios: el default pasa al día siguiente (eso es cliente, en Physio.html) y la adaptación
-- puede cubrir un rango — "los próximos tres entrenamientos" es el caso normal en una vuelta de
-- lesión, y hasta hoy había que cargar un tratamiento falso por día.
--
-- `adaptation_until` es opcional y NULL significa "solo el día de adaptation_date", que es como
-- se comportaba antes: las filas viejas no cambian de significado.

alter table public.treatments add column if not exists adaptation_until date;

comment on column public.treatments.adaptation_until is
  'Último día (inclusive) al que aplica la adaptación. NULL = solo adaptation_date.';

-- Los consumidores (Daily Planning, Gym Planner) preguntan "¿qué adaptaciones tocan este día?":
-- adaptation_date <= D <= coalesce(adaptation_until, adaptation_date). El índice por
-- adaptation_date ya existe (idx_treatments_adapt_date); este cubre el otro extremo del rango.
create index if not exists idx_treatments_adapt_until
  on public.treatments using btree (adaptation_until);

-- Un rango al revés no es un dato posible. NOT VALID para no fallar si alguna fila vieja quedó
-- rara; las filas nuevas sí se validan.
alter table public.treatments drop constraint if exists treatments_adaptation_range_check;
alter table public.treatments add constraint treatments_adaptation_range_check
  CHECK (adaptation_until is null or adaptation_date is null or adaptation_until >= adaptation_date)
  NOT VALID;
