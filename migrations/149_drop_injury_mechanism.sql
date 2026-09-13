-- Una sola columna para el mecanismo de lesión.
--
-- Había dos, y cada una la llenaba una cosa distinta:
--
--   · injuries.mechanism         — texto libre. Es la que escribe el <select> de
--                                  Injuries.html ('contact', 'non-contact' CON GUION,
--                                  'overuse', 'training', 'other'). 11 filas.
--   · injuries.injury_mechanism  — enum con CHECK, de la migración 014. NINGUNA pantalla
--                                  la escribió nunca: sólo la trajo la data sembrada. 9 filas.
--
-- El resultado era que una pantalla leía una y el formulario llenaba la otra, así que un club
-- que carga sus lesiones a mano veía «Sin registrar» en TODAS. Se queda `mechanism`, que es la
-- que el producto escribe de verdad; el enum no puede ni representar 'training', que es una de
-- las opciones del formulario.
--
-- No se pierde un solo dato: las 9 filas se vuelcan antes de borrar. Están limpias — ninguna
-- fila tiene las dos columnas cargadas (verificado: 0), así que el volcado no pisa nada y no
-- hay que decidir cuál gana.
--
-- El valor se traduce al vocabulario del formulario, no al del enum: 'non_contact' se guarda
-- como 'non-contact' para que el <select> de Injuries.html lo reconozca al reabrir la ficha.
-- Sin eso la lesión se vería bien en los informes pero el formulario mostraría "Select…" y el
-- primer guardado borraría el dato en silencio.
--
-- 'unknown' del enum se vuelca como NULL a propósito: el formulario no tiene esa opción, y
-- "desconocido" y "sin cargar" son lo mismo para quien lee. Hoy no hay ninguna fila así.
update public.injuries
   set mechanism = case injury_mechanism
                     when 'non_contact' then 'non-contact'
                     when 'contact'     then 'contact'
                     when 'overuse'     then 'overuse'
                     else null
                   end
 where mechanism is null
   and injury_mechanism is not null;

-- El CHECK se va con la columna; no hace falta borrarlo aparte.
alter table public.injuries
  drop column if exists injury_mechanism;

comment on column public.injuries.mechanism is
  'Cómo se produjo la lesión. Texto libre escrito por el <select> de Injuries.html: contact | non-contact | overuse | training | other. Se normaliza para agrupar en assets/injury-mechanism.js (cmInjuryMechanism) — no compares contra el texto crudo. NULL = sin registrar.';
