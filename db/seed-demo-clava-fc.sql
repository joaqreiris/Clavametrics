-- ═══════════════════════════════════════════════════════════════════════════
--  Clava FC — kit de datos de demostración
--  (antes "RC Celta Testing" — se renombra para no usar marcas reales)
--
--  Qué hace:
--    1. Renombra el club, los equipos, las sedes y los 22 rivales del
--       calendario, que eran clubes reales de la liga gallega.
--    2. Limpia el jugador de prueba con nombre real y ordena el plantel.
--    3. Corre TODO el calendario 98 días (14 semanas exactas) hacia adelante,
--       para que la última semana cargada sea la semana en curso. Al ser
--       múltiplo de 7, cada sesión conserva su día de la semana.
--    4. Rellena los microciclos: orientación por día, rival y fecha de partido,
--       con el partido el sábado, que es donde están los partidos cargados.
--    5. Regenera wellness y availability, que estaban inservibles.
--    6. Deja las lesiones con fechas coherentes.
--
--  Es idempotente salvo el paso 3 (el desplazamiento), que se saltea solo si
--  detecta que ya hay actividad en la semana en curso.
--
--  Ejecutar entero en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_club       uuid := 'c3740000-0000-0000-0000-000000000001';
  v_first      uuid;
  v_reserves   uuid;
  v_u23        uuid;
  v_season     uuid;
  v_shift      int  := 98;          -- 14 semanas
  v_ya_corrido boolean;
  v_hoy        date := current_date;
  v_lun        date := current_date - ((extract(isodow from current_date)::int) - 1);
  -- Rivales inventados. Reemplazan a los clubes reales que había cargados.
  v_rivales    text[] := array[
    'Costa Verde CF','Atlético Fontela','CD Val Real','Ribeira Nova FC','UD Pontelas',
    'Sporting Areal','CF Monteseiro','Deportivo Lourás','CD Aguiar','Unión Brañas',
    'CF Xesteira','Atlético Nogal','CD Portomar','Real Sarela','UD Carballal',
    'CF Illa Grande','Sporting Tambre','CD Rebordelo','Atlético Verdial','CF Anduriña',
    'UD Fervenza','CD Marnela'];
  r            record;
  v_n          int;
begin

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Club, equipos, sedes
-- ─────────────────────────────────────────────────────────────────────────
update clubs set name = 'Clava FC' where id = v_club;

select id into v_first    from teams where club_id = v_club and name ilike 'First%'          limit 1;
select id into v_reserves from teams where club_id = v_club and name in ('U-17','Reserves')  limit 1;
select id into v_u23      from teams where club_id = v_club and name in ('U-19','U-23')      limit 1;

-- Las categorías no cerraban con las edades (había jugadores del 95 en el U-17).
update teams set name = 'Reserves' where id = v_reserves;
update teams set name = 'U-23'     where id = v_u23;

update calendar_events
   set location = case
         when location ilike '%celta%' then 'Estadio Clava'
         when location is null or location = '' then location
         else 'Ciudad Deportiva Clava' end
 where club_id = v_club;

update training_sessions
   set location = 'Ciudad Deportiva Clava'
 where club_id = v_club and location ilike '%celta%';

-- 1b. Rivales: eran clubes reales. Se sustituyen por inventados, con un mapeo
--     estable para que el mismo rival real siempre caiga en el mismo ficticio.
for r in
  select opponent, row_number() over (order by opponent) rn
    from (select distinct opponent from calendar_events
           where club_id = v_club and opponent is not null and opponent <> '') x
loop
  update calendar_events
     set opponent = v_rivales[1 + ((r.rn - 1)::int % array_length(v_rivales,1))]
   where club_id = v_club and opponent = r.opponent;
end loop;

raise notice 'Club, equipos, sedes y rivales renombrados.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Plantel
-- ─────────────────────────────────────────────────────────────────────────

-- 2a. El jugador de prueba que llevaba el nombre real del dueño de la cuenta.
update players
   set first_name = 'Xoán', last_name = 'Vilariño',
       number = 12, nationality = 'ESP', position = 'RW'
 where club_id = v_club and upper(last_name) = 'REIRE';

-- 2b. Nacionalidades: había "Uruguay" escrito a mano entre códigos ISO.
update players set nationality = 'URY' where club_id = v_club and nationality ilike 'uruguay';
update players set nationality = 'ESP' where club_id = v_club and coalesce(nationality,'') = '';

-- 2c. Posiciones vacías (4 jugadores no tenían).
update players
   set position = case
         when number in (1,13,25) then 'GK'
         when number % 4 = 0      then 'DEF'
         when number % 4 in (1,2) then 'MID'
         else 'ATT' end
 where club_id = v_club and coalesce(position,'') = '';

-- 2d. Suscripción de cortesía para el First Team.
--     Hace falta ANTES de asignar jugadores: sin ella el equipo queda en plan
--     Free, que topa en 15 jugadores, y el trigger enforce_player_limit corta
--     el alta del jugador 16 con PLAYER_LIMIT_REACHED.
--     Reserves y U-23 se dejan A PROPÓSITO sin suscripción: quedan en Free, y
--     así cambiando de equipo en el selector se ven los candados y los
--     previews difuminados de los módulos pagos.
insert into subscriptions (team_id, club_id, plan_id, status, billing_cycle,
                           current_period_start, current_period_end, is_comp)
select v_first, v_club, (select id from plans where slug = 'full'),
       'active', 'yearly', now(), now() + interval '10 years', true   -- ojo: 'monthly' | 'yearly'
 where not exists (select 1 from subscriptions
                    where team_id = v_first and status in ('active','trialing'));

-- 2e. Equipos. 16 de 25 jugadores no estaban en ninguno, así que el plantel
--     aparecía vacío al filtrar. Todos al First Team (donde vive el histórico
--     de GPS y RPE) y los nacidos desde 2003 además al U-23, para que se vea
--     el caso de jugador en dos categorías.
update players set team_id = v_first where club_id = v_club;

insert into player_teams (club_id, player_id, team_id, is_primary)
select v_club, p.id, v_first, true
  from players p
 where p.club_id = v_club
   and not exists (select 1 from player_teams pt
                    where pt.player_id = p.id and pt.team_id = v_first);

update player_teams set is_primary = true
 where team_id = v_first and player_id in (select id from players where club_id = v_club);

update player_teams set is_primary = false
 where team_id <> v_first and player_id in (select id from players where club_id = v_club);

delete from player_teams pt
 using players p
 where pt.player_id = p.id and p.club_id = v_club
   and pt.team_id in (v_u23, v_reserves)
   and p.date_of_birth < date '2003-01-01';

insert into player_teams (club_id, player_id, team_id, is_primary)
select v_club, p.id, v_u23, false
  from players p
 where p.club_id = v_club
   and p.date_of_birth >= date '2003-01-01'
   and not exists (select 1 from player_teams pt
                    where pt.player_id = p.id and pt.team_id = v_u23);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Desplazamiento temporal (+98 días = 14 semanas exactas)
-- ─────────────────────────────────────────────────────────────────────────
select exists (
  select 1 from training_sessions
   where club_id = v_club and session_date between v_lun - 7 and v_lun + 13
) into v_ya_corrido;

if v_ya_corrido then
  raise notice 'Desplazamiento SALTEADO: ya hay actividad en la semana en curso.';
else
  update microcycles      set start_date   = start_date + v_shift,
                              end_date     = end_date   + v_shift,
                              match_date   = match_date + v_shift,
                              published_at = published_at + (v_shift || ' days')::interval
                          where club_id = v_club;
  update training_sessions set session_date = session_date + v_shift where club_id = v_club;
  update calendar_events   set date         = date         + v_shift where club_id = v_club;
  update injuries          set start_date      = start_date      + v_shift,
                               expected_return = expected_return + v_shift,
                               returned_date   = returned_date   + v_shift
                           where club_id = v_club;
  update evaluations       set test_date  = test_date  + v_shift where club_id = v_club;
  update treatments        set date       = date       + v_shift where club_id = v_club;
  update rehab_plans       set start_date   = start_date   + v_shift,
                               rtp_estimate = rtp_estimate + v_shift where club_id = v_club;
  update rehab_sessions    set date       = date       + v_shift where club_id = v_club;
  update force_tests       set test_date  = test_date  + v_shift where club_id = v_club;
  update tasks             set due_date   = due_date   + v_shift where club_id = v_club;
  update share_links       set week_start = week_start + v_shift where club_id = v_club;
  update lineups           set published_at = published_at + (v_shift || ' days')::interval
                           where club_id = v_club;

  raise notice 'Calendario desplazado % días.', v_shift;
end if;

-- La temporada tiene que cubrir la ventana desplazada, si no el Annual Planner
-- muestra semanas fuera de rango.
update seasons
   set start_date = date '2025-10-01', end_date = date '2026-10-31', name = '2025/26'
 where club_id = v_club;

select id into v_season from seasons where club_id = v_club and team_id = v_first limit 1;
if v_season is null then select id into v_season from seasons where club_id = v_club limit 1; end if;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPE: session_date decía 2026-06-09 en las 7.220 filas. El dato bueno
--    está en la sesión vinculada, así que se copia de ahí.
-- ─────────────────────────────────────────────────────────────────────────
-- ojo: el alias NO puede ser "r" — choca con la variable r record de arriba
-- y plpgsql resuelve r.session_id contra la variable, no contra la tabla.
update rpe rp
   set session_date = s.session_date
  from training_sessions s
 where s.id = rp.session_id and rp.club_id = v_club
   and rp.session_date is distinct from s.session_date;
get diagnostics v_n = row_count;
raise notice 'RPE: % fechas corregidas.', v_n;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Microciclos. Estaban vacíos por dentro: sin orientación de día, sin
--    rival, sin publicar. Patrón semanal con partido el SÁBADO, que es donde
--    están los 46 partidos cargados:
--      lun recuperación · mar MD-4 · mié MD-3 · jue MD-2 · vie MD-1 ·
--      sáb partido · dom recuperación
-- ─────────────────────────────────────────────────────────────────────────

-- Microciclos para las semanas que tienen sesiones pero quedaron sin uno.
insert into microcycles (club_id, team_id, name, start_date, end_date, type, season_id)
select v_club, v_first,
       'MC ' || (46 + row_number() over (order by w))::text,
       w::date, (w + interval '6 days')::date, 'competitive', v_season
  from generate_series(
         (select date_trunc('week', max(m.end_date))::date + 7
            from microcycles m where m.club_id = v_club),
         (select date_trunc('week', max(s.session_date))::date
            from training_sessions s where s.club_id = v_club),
         '7 days'::interval) w
 where not exists (select 1 from microcycles m2
                    where m2.club_id = v_club and m2.start_date = w::date);

-- Relleno de todos los microciclos del club.
for r in
  select m.id, m.start_date, m.end_date, row_number() over (order by m.start_date) rn
    from microcycles m where m.club_id = v_club order by m.start_date
loop
  update microcycles
     set day_plan = (
           select jsonb_object_agg(d::date::text,
                    case extract(isodow from d)::int
                      when 1 then 'recovery'
                      when 2 then 'muscle_tension'
                      when 3 then 'duration'
                      when 4 then 'speed'
                      when 5 then 'activation'
                      when 6 then 'match'
                      else 'recovery' end)
             from generate_series(r.start_date, r.end_date, '1 day'::interval) d),
         match_date = r.end_date - 1,                       -- sábado
         -- el rival sale del partido de esa semana si existe; si no, de la lista
         rival = coalesce(
                   (select e.opponent from calendar_events e
                     where e.club_id = v_club and e.type ilike '%match%'
                       and e.date between r.start_date and r.end_date
                     order by e.date limit 1),
                   v_rivales[1 + (r.rn::int % array_length(v_rivales,1))]),
         home_away = coalesce(
                   (select e.home_away from calendar_events e
                     where e.club_id = v_club and e.type ilike '%match%'
                       and e.date between r.start_date and r.end_date
                     order by e.date limit 1),
                   case when r.rn::int % 2 = 0 then 'home' else 'away' end),
         match_time = time '17:00'
   where id = r.id;
end loop;

-- Se publican los ya jugados y el de esta semana; los futuros quedan sin
-- publicar, que es el estado natural del que se está armando.
update microcycles
   set published_at = coalesce(published_at, (start_date + time '09:00') at time zone 'UTC')
 where club_id = v_club and start_date <= v_lun;

-- Sesiones huérfanas → al microciclo que cubre su fecha.
update training_sessions s
   set microcycle_id = m.id
  from microcycles m
 where m.club_id = v_club and s.club_id = v_club
   and s.microcycle_id is null
   and s.session_date between m.start_date and m.end_date;

-- Orientación y MD de cada sesión (Daily Planning y el Planner las leen).
update training_sessions
   set orientation = case extract(isodow from session_date)::int
                       when 1 then 'recovery' when 2 then 'muscle_tension'
                       when 3 then 'duration' when 4 then 'speed'
                       when 5 then 'activation' when 7 then 'recovery'
                       else orientation end,
       match_day_offset = case extract(isodow from session_date)::int
                       when 1 then -5 when 2 then -4 when 3 then -3
                       when 4 then -2 when 5 then -1 when 6 then 0
                       else 1 end
 where club_id = v_club and coalesce(session_type,'') not in ('match','rehab','gym');

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Lesiones: 3 de las 4 activas tenían la fecha de retorno ya vencida.
-- ─────────────────────────────────────────────────────────────────────────
update injuries
   set expected_return = v_hoy + (7 + (random()*21)::int)
 where club_id = v_club and status = 'active'
   and (expected_return is null or expected_return < v_hoy);

update injuries
   set returned_date = coalesce(returned_date, expected_return, start_date + 21)
 where club_id = v_club and status = 'cleared' and returned_date is null;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Wellness — se borra y se regenera.
--    Tenía 7.225 de 7.233 filas con la MISMA fecha (300 check-ins por jugador
--    en un solo día). Se generan 28 días, solo en días con sesión, con la
--    escala que usa hoy el formulario del jugador (1 a 7, donde 1 = mejor) y
--    el Hooper y la readiness calculados igual que submit_survey().
-- ─────────────────────────────────────────────────────────────────────────
delete from wellness where club_id = v_club;

insert into wellness (club_id, player_id, sleep_quality, mood, fatigue, stress,
                      soreness, hooper_index, readiness, submitted_at)
select v_club, x.player_id, x.sleep, x.mood, x.fatigue, x.stress, x.soreness,
       x.sleep + x.fatigue + x.stress + x.soreness as hooper,
       -- misma fórmula que submit_survey(), pero con piso en 1: la tabla tiene
       -- CHECK (readiness between 1 and 10) y la fórmula da 0 cuando el Hooper
       -- llega a 27 o más.
       greatest(1, round(10 - ((x.sleep + x.fatigue + x.stress + x.soreness) - 4) / 24.0 * 10)::int),
       (x.dia + time '08:15' + (random() * interval '90 minutes')) at time zone 'UTC'
  from (
    select p.id as player_id, d.dia,
           least(7, greatest(1, 2 + (random()*2)::int + d.dureza)) as sleep,
           least(7, greatest(1, 2 + (random()*2)::int))            as mood,
           least(7, greatest(1, 2 + (random()*2)::int + d.dureza)) as fatigue,
           least(7, greatest(1, 1 + (random()*3)::int))            as stress,
           least(7, greatest(1, 2 + (random()*2)::int + d.dureza)) as soreness
      from players p
      cross join (
        -- días con sesión de las últimas 4 semanas. "dureza" +1 el domingo y el
        -- lunes, que es cuando el plantel amanece peor tras el partido del sábado.
        select distinct s.session_date as dia,
               case when extract(isodow from s.session_date)::int in (1,7) then 1 else 0 end as dureza
          from training_sessions s
         where s.club_id = v_club
           and s.session_date between v_hoy - 27 and v_hoy
      ) d
     where p.club_id = v_club
       and random() < 0.88          -- ~12% no completa el check-in, como en la vida real
  ) x;
get diagnostics v_n = row_count;
raise notice 'Wellness: % check-ins generados.', v_n;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Availability — se borra y se regenera.
--    Tenía 768 "lesionado" contra 90 "disponible", y 173 lesionados marcados
--    en el futuro hasta febrero de 2027. Se genera una ventana de 4 semanas
--    atrás y 2 adelante. Los estados globales (lesión, enfermedad) van con
--    team_id NULL y los relativos con el equipo, que es como los lee la app.
-- ─────────────────────────────────────────────────────────────────────────
delete from availability where club_id = v_club;

-- ojo: availability.player_id es TEXT, no uuid
insert into availability (club_id, player_id, date, status, minutes, team_id)
select v_club, s.player_id::text, s.dia, s.estado,
       case when s.estado in ('injured','sick') then 0 else null end,
       case when s.estado in ('injured','sick') then null else v_first end
  from (
    select p.id as player_id, d.dia,
           case
             when exists (select 1 from injuries i
                           where i.player_id = p.id and i.status = 'active'
                             and d.dia between i.start_date
                                          and coalesce(i.expected_return, d.dia))
                  then 'injured'
             when random() < 0.04 then 'limited'
             when random() < 0.02 then 'sick'
             else 'available'
           end as estado
      from players p
      cross join (select generate_series(v_hoy - 27, v_hoy + 13, '1 day'::interval)::date as dia) d
     where p.club_id = v_club
  ) s;
get diagnostics v_n = row_count;
raise notice 'Availability: % filas generadas.', v_n;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Registro de actividad. Cada alta de wellness y de availability dispara
--    un trigger que escribe en activity_log, así que esta carga deja ~1.500
--    entradas de golpe y el feed del Hub queda ilegible. Se conservan solo
--    las de los últimos 3 días, que es lo que el Hub muestra.
-- ─────────────────────────────────────────────────────────────────────────
delete from activity_log
 where club_id = v_club and created_at < now() - interval '3 days';

raise notice '── Listo. Club demo: Clava FC ──';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verificación — correr después y revisar que todo dé razonable
-- ═══════════════════════════════════════════════════════════════════════════
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select 'club' k, (select name from clubs x, c where x.id=c.id) v
union all select 'equipos',        (select string_agg(name,' · ' order by name) from teams x, c where x.club_id=c.id)
union all select 'jugadores',      (select count(*)::text from players x, c where x.club_id=c.id)
union all select 'sin equipo',     (select count(*)::text from players p, c where p.club_id=c.id
                                     and not exists (select 1 from player_teams pt where pt.player_id=p.id))
union all select 'sesiones ±30d',  (select count(*)::text from training_sessions s, c where s.club_id=c.id
                                     and s.session_date between current_date-30 and current_date+30)
union all select 'micro de hoy',   (select coalesce(string_agg(m.name||' ('||m.start_date||'→'||m.end_date
                                       ||', vs '||coalesce(m.rival,'?')||')',', '),'NINGUNO')
                                     from microcycles m, c where m.club_id=c.id
                                     and current_date between m.start_date and m.end_date)
union all select 'próximo partido',(select coalesce(min(e.date)::text||' vs '||
                                       (select e2.opponent from calendar_events e2, c c2 where e2.club_id=c2.id
                                         and e2.type ilike '%match%' and e2.date>=current_date order by e2.date limit 1),'NINGUNO')
                                     from calendar_events e, c where e.club_id=c.id
                                     and e.type ilike '%match%' and e.date>=current_date)
union all select 'wellness 7d',    (select count(*)::text from wellness w, c where w.club_id=c.id
                                     and w.submitted_at >= current_date-7)
union all select 'hooper medio',   (select round(avg(w.hooper_index),1)::text from wellness w, c where w.club_id=c.id)
union all select 'disponibles hoy',(select count(*) filter (where a.status='available')::text||' de '||count(*)::text
                                     from availability a, c where a.club_id=c.id and a.date=current_date)
union all select 'lesionados hoy', (select count(*)::text from availability a, c where a.club_id=c.id
                                     and a.date=current_date and a.status='injured')
union all select 'rpe fecha mal',  (select count(*)::text from rpe r join training_sessions s on s.id=r.session_id, c
                                     where r.club_id=c.id and r.session_date is distinct from s.session_date)
union all select 'rivales',        (select count(distinct e.opponent)::text from calendar_events e, c
                                     where e.club_id=c.id and e.opponent is not null)
-- ojo: cross join, no coma: con coma el LEFT JOIN se cuelga de "c" y no ve "t"
union all select 'planes por equipo',(select string_agg(t.name||'='||coalesce(pl.name,'Free'),' · ' order by t.name)
                                     from c
                                     cross join teams t
                                     left join subscriptions s on s.team_id=t.id and s.status in ('active','trialing')
                                     left join plans pl on pl.id=s.plan_id
                                     where t.club_id=c.id);
