-- ═══════════════════════════════════════════════════════════════════════════
--  Clava FC — parche 4: dashboards de GPS con todas las tarjetas + ejercicios
--
--  A. GPS Analysis. Los datos estaban (744 registros en los últimos 30 días,
--     168 esta semana), pero los layouts guardados mostraban muy pocas
--     tarjetas: Load Monitoring tenía 1, Session Control 2, Microcycle
--     Compare 2. El resto quedaba escondido en el cajón lateral. Se
--     reescriben los 5 layouts con TODAS las tarjetas de cada vista, en un
--     orden que se lee bien de arriba abajo.
--
--     Se guardan dos veces: como layout del usuario y como layout por defecto
--     del club (dashboard_id + '~clubdefault'), así también lo ve cualquier
--     otro usuario que entre.
--
--  B. Ejercicios. Había 5 en la biblioteca (con objetivos tipo "REVENTARLOS"
--     y "nada") y 7 asignados entre 454 sesiones, así que Daily Planning se
--     veía vacío. Se crean 16 ejercicios reales y se arman las sesiones de
--     las últimas 2 semanas y las 2 siguientes con bloques coherentes según
--     el día del microciclo.
--
--  Idempotente: los ejercicios se crean sólo si no existen por nombre, y las
--  sesiones se rellenan sólo si están vacías.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_club uuid := 'c3740000-0000-0000-0000-000000000001';
  v_user uuid;
  v_lun  date := current_date - ((extract(isodow from current_date)::int) - 1);
  r      record;
  v_n    int;
  v_pos  int;
begin

select id into v_user from profiles where club_id = v_club order by created_at limit 1;

-- ═════════════════════════════════════════════════════════════════════════
--  A. Layouts de GPS Analysis
-- ═════════════════════════════════════════════════════════════════════════
for r in
  select * from (values
    ('player_week', '[
       {"card_id":"gen-week-kpi","size":"sm","config":{},"position":0},
       {"card_id":"vzones","size":"sm","config":{},"position":1},
       {"card_id":"acwr","size":"md","config":{"metric_key":"player_load"},"position":2},
       {"card_id":"xmatch","size":"md","config":{},"position":3},
       {"card_id":"weekly-bars","size":"full","config":{},"position":4},
       {"card_id":"radar","size":"lg","config":{},"position":5},
       {"card_id":"tsb","size":"md","config":{},"position":6}
     ]'::jsonb),
    ('session_control', '[
       {"card_id":"gen-session-table","size":"full","config":{},"position":0},
       {"card_id":"outliers","size":"md","config":{},"position":1},
       {"card_id":"pos-radar","size":"md","config":{},"position":2},
       {"card_id":"sc-vs-session","size":"md","config":{},"position":3},
       {"card_id":"sc-zscore-temporal","size":"md","config":{},"position":4},
       {"card_id":"zscore-matrix","size":"full","config":{},"position":5},
       {"card_id":"mc-heat","size":"full","config":{},"position":6}
     ]'::jsonb),
    ('match_performance', '[
       {"card_id":"gen-match-kpi","size":"sm","config":{},"position":0},
       {"card_id":"mp-player","size":"sm","config":{},"position":1},
       {"card_id":"mp-td","size":"full","config":{},"position":2},
       {"card_id":"mp-hi","size":"full","config":{},"position":3}
     ]'::jsonb),
    ('load_monitoring', '[
       {"card_id":"lm-gauges","size":"full","config":{},"position":0}
     ]'::jsonb),
    ('microcycle_compare', '[
       {"card_id":"mc-table","size":"full","config":{},"position":0},
       {"card_id":"mc-shape","size":"full","config":{},"position":1},
       {"card_id":"mc-monotony","size":"md","config":{},"position":2},
       {"card_id":"mc-movers","size":"md","config":{},"position":3},
       {"card_id":"mc-exposure","size":"full","config":{},"position":4}
     ]'::jsonb)
  ) as t(did, lay)
loop
  -- layout del usuario
  insert into gps_dashboard_layouts (user_id, club_id, dashboard_id, layout, updated_at)
  values (v_user, v_club, r.did, r.lay, now())
  on conflict (user_id, club_id, dashboard_id)
  do update set layout = excluded.layout, updated_at = now();

  -- layout por defecto del club (lo hereda cualquier otro usuario)
  insert into gps_dashboard_layouts (user_id, club_id, dashboard_id, layout, updated_at)
  values (v_user, v_club, r.did || '~clubdefault', r.lay, now())
  on conflict (user_id, club_id, dashboard_id)
  do update set layout = excluded.layout, updated_at = now();
end loop;
raise notice 'Layouts de GPS reescritos (5 vistas, usuario + default del club).';

-- ═════════════════════════════════════════════════════════════════════════
--  B. Biblioteca de ejercicios
-- ═════════════════════════════════════════════════════════════════════════

-- Los 5 que ya había tenían objetivos impresentables para una demo.
update exercises set objective = 'Activar la musculatura antes del bloque de fuerza'
 where club_id = v_club and objective = 'REVENTARLOS';
update exercises set objective = 'Superioridad en espacio reducido con apoyos exteriores'
 where club_id = v_club and objective = 'nada';
update exercises set objective = 'Finalización tras centro lateral'
 where club_id = v_club and objective = 'finishing in goal';

insert into exercises (club_id, created_by, name, duration, players_count,
                       field_width, field_height, intensity, match_day, focus, objective)
select v_club, v_user, x.name, x.dur, x.pl, x.w, x.h, x.inten, x.md, x.foco, x.obj
from (values
  -- MD-4 · tensión muscular
  ('Circuito de fuerza excéntrica', 20, 24, null::numeric, null::numeric, 'HIGH',      -4, array['Físico'],    'Tensión muscular con énfasis en isquiosurales'),
  ('Rondo 5v2 en cuadrado',         12, 21, 15,   15,   'MEDIUM',   -4, array['Técnico'],   'Circulación rápida y primer control orientado'),
  ('Juego de posición 6v6+3',       22, 15, 45,   35,   'HIGH',     -4, array['Táctico'],   'Progresión con superioridad y cambio de orientación'),
  ('Duelos 1v1 con arrastre',       15, 12, 25,   20,   'HIGH',     -4, array['Sectorial'], 'Cambios de dirección bajo oposición'),
  -- MD-3 · duración
  ('Partido 8v8 campo grande',      25, 16, 70,   50,   'HIGH',     -3, array['Táctico'],   'Volumen de carrera en contexto de juego real'),
  ('Circuito aeróbico con balón',   18, 24, 60,   40,   'MEDIUM',   -3, array['Físico'],    'Acumular metros a intensidad media con tarea técnica'),
  ('Transiciones 4v4 continuas',    20, 16, 40,   30,   'HIGH',     -3, array['Táctico'],   'Ida y vuelta constante: repetir esfuerzos'),
  -- MD-2 · velocidad
  ('Sprints con cambio de sentido', 12, 24, 40,   20,   'VERY_HIGH',-2, array['Físico'],    'Máxima velocidad en distancias cortas'),
  ('Salidas y contras 3v2',         18, 15, 60,   45,   'VERY_HIGH',-2, array['Táctico'],   'Contraataque a máxima intensidad'),
  ('Finalización tras conducción',  15, 20, 50,   40,   'HIGH',     -2, array['Técnico'],   'Definición con fatiga controlada'),
  -- MD-1 · activación
  ('Activación con balón',          12, 24, 30,   30,   'LOW',      -1, array['Físico'],    'Elevar temperatura sin generar fatiga'),
  ('Posesión 7v7 en tres zonas',    15, 16, 50,   35,   'MEDIUM',   -1, array['Táctico'],   'Ritmo de circulación previo al partido'),
  ('Balón parado ofensivo',         12, 22, 40,   35,   'LOW',      -1, array['Táctico'],   'Repasar los ensayos de córner y falta lateral'),
  -- Recuperación y porteros
  ('Movilidad y descarga',          20, 24, null, null, 'LOW',       1, array['Físico'],    'Descarga del día siguiente al partido'),
  ('Trabajo específico de porteros',25,  3, 25,   20,   'MEDIUM',   -3, array['Individual'],'Blocaje, salidas y juego con los pies'),
  ('Prevención de isquiosurales',   15, 24, null, null, 'MEDIUM',   -4, array['Físico'],    'Nórdicos y trabajo excéntrico preventivo')
) as x(name, dur, pl, w, h, inten, md, foco, obj)
where not exists (select 1 from exercises e where e.club_id = v_club and e.name = x.name);
get diagnostics v_n = row_count;
raise notice 'Ejercicios creados: %', v_n;

-- ═════════════════════════════════════════════════════════════════════════
--  C. Armar las sesiones (2 semanas atrás + 2 adelante)
-- ═════════════════════════════════════════════════════════════════════════
for r in
  select s.id, s.session_date, extract(isodow from s.session_date)::int dow
    from training_sessions s
   where s.club_id = v_club
     and s.session_type in ('training','recovery')
     and s.session_date between v_lun - 14 and v_lun + 20
     and not exists (select 1 from session_exercises se where se.session_id = s.id)
   order by s.session_date
loop
  v_pos := 0;

  -- Activación: todos los días de campo abren igual
  insert into session_exercises (club_id, session_id, exercise_id, name, phase,
                                 duration, intensity, position, players_count)
  select v_club, r.id, e.id, e.name, 'activation', e.duration, e.intensity, v_pos, e.players_count
    from exercises e
   where e.club_id = v_club
     and e.name = case when r.dow = 1 then 'Movilidad y descarga' else 'Activación con balón' end
   limit 1;

  -- Bloque principal: según el día del microciclo
  v_pos := 1;
  insert into session_exercises (club_id, session_id, exercise_id, name, phase,
                                 duration, intensity, position, players_count,
                                 field_width, field_height)
  select v_club, r.id, e.id, e.name, 'main', e.duration, e.intensity,
         v_pos + (row_number() over (order by e.name)) - 1,
         e.players_count, e.field_width, e.field_height
    from exercises e
   where e.club_id = v_club
     and e.match_day = case r.dow
                         when 2 then -4   -- martes
                         when 3 then -3   -- miércoles
                         when 4 then -2   -- jueves
                         when 5 then -1   -- viernes
                         else 1 end       -- lunes y domingo: recuperación
     and e.name not in ('Activación con balón','Movilidad y descarga',
                        'Prevención de isquiosurales','Trabajo específico de porteros');

  -- Preventivo al cierre, los días de carga.
  -- ojo: la fase válida es 'cooldown' — session_exercises_phase_check sólo
  -- acepta warmup | main | cooldown | activation | goalkeepers.
  if r.dow in (2,3,4) then
    insert into session_exercises (club_id, session_id, exercise_id, name, phase,
                                   duration, intensity, position, players_count)
    select v_club, r.id, e.id, e.name, 'cooldown', e.duration, e.intensity, 90, e.players_count
      from exercises e
     where e.club_id = v_club and e.name = 'Prevención de isquiosurales' limit 1;
  end if;

  -- Porteros, dos veces por semana
  if r.dow in (3,5) then
    insert into session_exercises (club_id, session_id, exercise_id, name, phase,
                                   duration, intensity, position, players_count)
    select v_club, r.id, e.id, e.name, 'goalkeepers', e.duration, e.intensity, 91, e.players_count
      from exercises e
     where e.club_id = v_club and e.name = 'Trabajo específico de porteros' limit 1;
  end if;

end loop;

select count(*) into v_n
  from session_exercises se join training_sessions s on s.id = se.session_id
 where s.club_id = v_club;
raise notice 'Ejercicios asignados a sesiones (total del club): %', v_n;

raise notice '── Parche 4 aplicado ──';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verificación
-- ═══════════════════════════════════════════════════════════════════════════
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select 'ejercicios en biblioteca' k, count(*)::text v from exercises e, c where e.club_id=c.id
union all select 'sesiones con ejercicios (±2 semanas)',
       (select count(distinct s.id)::text from training_sessions s
          join session_exercises se on se.session_id=s.id, c c2
         where s.club_id=c2.id and s.session_date between current_date-14 and current_date+20)
union all select 'sesiones SIN ejercicios (±2 semanas)',
       (select count(*)::text from training_sessions s, c c3
         where s.club_id=c3.id and s.session_type in ('training','recovery')
           and s.session_date between current_date-14 and current_date+20
           and not exists (select 1 from session_exercises se where se.session_id=s.id))
union all select 'tarjetas por dashboard',
       (select string_agg(l.dashboard_id||'='||jsonb_array_length(l.layout), ' · ' order by l.dashboard_id)
          from gps_dashboard_layouts l, c c4
         where l.club_id=c4.id and l.dashboard_id not like '%~clubdefault'
           and l.dashboard_id not like '%__snap__%')
union all select 'GPS: registros esta semana',
       (select count(*)::text from gps_reports g join training_sessions s on s.id=g.session_id, c c5
         where g.club_id=c5.id
           and s.session_date >= current_date - ((extract(isodow from current_date)::int)-1));

-- Detalle de la sesión de hoy, que es la que se va a mostrar en el video
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select se.phase, se.position, se.name, se.duration||' min' as dur, se.intensity
  from session_exercises se
  join training_sessions s on s.id = se.session_id, c
 where s.club_id = c.id and s.session_date = current_date
 order by case se.phase when 'activation' then 0 when 'main' then 1
                        when 'cooldown' then 2 else 3 end, se.position;
