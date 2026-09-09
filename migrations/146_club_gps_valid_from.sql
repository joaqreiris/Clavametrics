-- Corte de comparabilidad del club.
--
-- MOI Kompong DEWA cambió el 19/10/2025 la forma de definir las bandas de velocidad en Catapult:
-- de umbrales fijos a % de la Vmax de cada jugador. El HSR de antes y el de después no miden lo
-- mismo —2,4× de diferencia en el promedio del equipo, con la distancia total prácticamente
-- igual (1,02×), que es la prueba de que cambió el criterio y no la carga—. Mezclarlos en un
-- gráfico dibuja un escalón que parece una caída de rendimiento y no lo es.
--
-- Convertir los valores viejos no es posible: el archivo crudo ya no está y el parámetro de
-- decaída entre tramos varía 47% entre jugadores (y para el MISMO jugador entre partidos), así
-- que cualquier reescritura sería inventada.
--
-- Este campo NO borra nada: las filas siguen en la base y vuelven al análisis el día que se
-- vacíe la fecha (por ejemplo si se recuperan los originales desde la nube de Catapult).
-- Distinto de ref_from_date, que sólo decide qué PARTIDOS valen como referencia: esto deja
-- fuera todas las sesiones, de todas las cards. Cuando ambos están puestos, manda el más tardío.
alter table public.club_gps_settings
  add column if not exists gps_valid_from date;

comment on column public.club_gps_settings.gps_valid_from is
  'Fecha desde la que los datos GPS del club son comparables entre sí. Las sesiones anteriores no entran al análisis (cards ni referencias); no se borran. NULL = sin corte.';
