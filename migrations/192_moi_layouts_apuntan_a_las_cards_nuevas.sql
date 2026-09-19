-- Reescribe los layouts de MOI: donde decía 'mc-table' ahora dice el uuid de la card del builder
-- equivalente. Se conserva TODO lo demás de cada entrada (x, y, w, h, size, position), que es lo
-- que hace que el dashboard se vea igual que antes.
--
-- De paso se limpian tres ids que apuntan a cards que ya no existen ('ACWR gauges' e 'Indicadores
-- ACWR', borradas hace días, y 'gen-weekly-load', que no está en el HTML): hoy son entradas
-- muertas que el cargador saltea en silencio.
update gps_dashboard_layouts l
set layout = coalesce((
      select jsonb_agg(
               case when m.card_nueva is not null
                    then jsonb_set(t.e, '{card_id}', to_jsonb(m.card_nueva::text))
                    else t.e end
               order by t.ord)
      from jsonb_array_elements(l.layout) with ordinality as t(e, ord)
      left join gps_migracion_cards_191 m
        on m.club_id = l.club_id
       and m.card_clasica = t.e ->> 'card_id'
      where coalesce(t.e ->> 'card_id', '') not in ('ACWR gauges', 'Indicadores ACWR', 'gen-weekly-load')
    ), '[]'::jsonb),
    updated_at = now()
where l.club_id = '54ea81f9-9371-4588-9518-55cfdd63f43e'
  and jsonb_typeof(l.layout) = 'array';
