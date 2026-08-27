-- ═══════════════════════════════════════════════════════════════════════════
--  Clava FC — parche 5: la biblioteca de ejercicios, en inglés
--
--  El club de demostración se muestra en inglés, así que los 21 ejercicios
--  (los 16 creados en el parche 4 y los 5 que ya existían) pasan a inglés,
--  nombre y objetivo. Se renombra también la copia que quedó guardada dentro
--  de cada sesión: session_exercises.name es un campo propio, no un reflejo
--  del ejercicio, así que si sólo se cambia la biblioteca el planning sigue
--  mostrando el nombre viejo.
--
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_club uuid := 'c3740000-0000-0000-0000-000000000001';
  r      record;
  v_n    int := 0;
begin

for r in
  select * from (values
    -- viejo                             nuevo                              objetivo en inglés
    ('Circuito de fuerza excéntrica',    'Eccentric strength circuit',      'Muscle tension work with a hamstring focus'),
    ('Rondo 5v2 en cuadrado',            'Rondo 5v2 in a square',           'Quick circulation and oriented first touch'),
    ('Juego de posición 6v6+3',          'Positional game 6v6+3',           'Progression with an overload and switch of play'),
    ('Duelos 1v1 con arrastre',          '1v1 duels with a lead-in run',    'Change of direction under pressure'),
    ('Partido 8v8 campo grande',         'Large-pitch 8v8 game',            'Running volume in a real game context'),
    ('Circuito aeróbico con balón',      'Aerobic circuit with the ball',   'Accumulate metres at moderate intensity with a technical task'),
    ('Transiciones 4v4 continuas',       'Continuous 4v4 transitions',      'Back and forth: repeated sprint ability'),
    ('Sprints con cambio de sentido',    'Sprints with change of direction','Top speed over short distances'),
    ('Salidas y contras 3v2',            'Breakaways and counters 3v2',     'Counter-attack at maximum intensity'),
    ('Finalización tras conducción',     'Finishing after a dribble',       'Finishing under controlled fatigue'),
    ('Activación con balón',             'Activation with the ball',        'Raise temperature without adding fatigue'),
    ('Posesión 7v7 en tres zonas',       'Possession 7v7 in three zones',   'Circulation tempo ahead of the match'),
    ('Balón parado ofensivo',            'Attacking set pieces',            'Rehearse corner and wide free-kick routines'),
    ('Movilidad y descarga',             'Mobility and offload',            'Offload session the day after the match'),
    ('Trabajo específico de porteros',   'Goalkeeper-specific work',        'Handling, coming off the line and distribution'),
    ('Prevención de isquiosurales',      'Hamstring prevention',            'Nordics and preventive eccentric work'),
    -- Los cinco que ya existían
    ('4vs4 con apoyos',                  '4v4 with support players',        'Overload in a small space with outside support'),
    ('4vs4+2',                           '4v4+2',                           'Keep possession with a two-player overload'),
    ('ACTIVATION STRENGTH',              'Strength activation',             'Prime the muscles before the strength block'),
    ('Activación para sprint',           'Sprint activation',               'Prepare the athlete to sprint on MD-3'),
    ('FINISHING',                        'Finishing from a cross',          'Finishing after a wide cross')
  ) as t(viejo, nuevo, obj)
loop
  update exercises
     set name = r.nuevo, objective = r.obj
   where club_id = v_club and name = r.viejo;
  if found then v_n := v_n + 1; end if;

  -- session_exercises.name es una copia propia: sin esto, el planning sigue
  -- mostrando el nombre viejo aunque la biblioteca ya esté en inglés.
  update session_exercises se
     set name = r.nuevo
    from training_sessions s
   where s.id = se.session_id and s.club_id = v_club and se.name = r.viejo;
end loop;

raise notice 'Ejercicios traducidos: %', v_n;
raise notice '── Parche 5 aplicado ──';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verificación: no debe quedar ningún nombre en español
-- ═══════════════════════════════════════════════════════════════════════════
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select 'biblioteca' origen, e.name, coalesce(e.objective,'—') objetivo, e.match_day
  from exercises e, c where e.club_id = c.id
 order by e.match_day nulls last, e.name;

with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select 'con acentos o palabras en español' k,
       count(*)::text v
  from session_exercises se join training_sessions s on s.id = se.session_id, c
 where s.club_id = c.id
   and (se.name ~* '(ción|Activación|Circuito|Duelos|Juego|Partido|Posesión|Prevención|Sprints con|Movilidad|Trabajo|Balón|apoyos|Rondo 5v2 en)');
