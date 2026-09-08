-- Migration 141: tareas simultáneas en Daily Planning.
--
-- Hasta ahora la lista de tareas de una sesión era estrictamente una secuencia:
-- si el grupo A hacía un rondo mientras el grupo B iba a finalización, la app las
-- veía como dos bloques encadenados y no había forma de decir "estas dos van a la
-- vez". Esta columna es esa marca: las tareas de una misma sesión y una misma fase
-- que comparten parallel_group se dibujan bajo un mismo corchete y la proyección
-- GPS las promedia por jugadores en vez de sumarlas (nadie hizo las dos).
--
-- Es un token opaco generado en el cliente ("pg_<random>"), no una FK: el vínculo
-- sólo tiene sentido dentro de la sesión, y así duplicar una sesión se lo lleva
-- puesto sin tener que remapear ids. NULL = tarea suelta (el caso normal).
-- Idempotente.

alter table public.session_exercises
  add column if not exists parallel_group text;

-- Las consultas siempre filtran por session_id + phase primero (la lista de una
-- sesión son unas pocas filas), así que no hace falta índice propio: agrupar por
-- este valor se hace en memoria sobre ese puñado de filas.
