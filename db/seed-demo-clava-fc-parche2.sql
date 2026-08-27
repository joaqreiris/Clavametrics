-- ═══════════════════════════════════════════════════════════════════════════
--  Clava FC — parche 2 (correr DESPUÉS de seed-demo-clava-fc.sql)
--
--  Dos cosas que quedaron flojas al revisar el resultado:
--
--  A. Cuatro partidos del histórico no caían en sábado (uno el lunes, otro el
--     miércoles, otro el jueves y otro el domingo). Con el desplazamiento, el
--     del jueves cayó justo hoy, y como el microciclo tomaba el rival del
--     PRIMER partido de la semana, anunciaba "vs CD Marnela" mientras el
--     sábado se juega contra CD Portomar. Tres de esos cuatro caen en semanas
--     que YA tienen su partido del sábado, así que se borran (moverlos dejaría
--     dos partidos el mismo día); el cuarto se mueve al sábado.
--
--  B. De la semana que viene en adelante no había sesiones: el histórico se
--     cortaba justo el domingo. Para el video hace falta ver semana planificada
--     hacia adelante, así que se clona la estructura de la semana en curso a
--     las dos siguientes — sin RPE ni GPS, que es exactamente como se ve una
--     semana planificada pero todavía no entrenada — con rival distinto cada
--     una.
--
--  Idempotente: si ya lo corriste, no duplica sesiones ni eventos.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_club  uuid := 'c3740000-0000-0000-0000-000000000001';
  v_first uuid;
  v_lun   date := current_date - ((extract(isodow from current_date)::int) - 1);
  v_rivales text[] := array['Ribeira Nova FC','Atlético Fontela','CF Monteseiro',
                            'UD Pontelas','Real Sarela','CD Aguiar'];
  r       record;
  v_n     int;
begin

select id into v_first from teams where club_id = v_club and name ilike 'First%' limit 1;

-- ── A. Partidos que no caen en sábado ─────────────────────────────────────
delete from calendar_events e
 where e.club_id = v_club
   and e.type ilike '%match%'
   and extract(isodow from e.date)::int <> 6
   and exists (select 1 from calendar_events e2
                where e2.club_id = v_club and e2.type ilike '%match%'
                  and e2.date = date_trunc('week', e.date)::date + 5);
get diagnostics v_n = row_count;
raise notice 'Partidos que duplicaban la jornada, borrados: %', v_n;

update calendar_events
   set date = (date_trunc('week', date)::date + 5)
 where club_id = v_club
   and type ilike '%match%'
   and extract(isodow from date)::int <> 6;
get diagnostics v_n = row_count;
raise notice 'Partidos movidos al sábado: %', v_n;

update training_sessions
   set session_date = (date_trunc('week', session_date)::date + 5)
 where club_id = v_club
   and session_type = 'match'
   and extract(isodow from session_date)::int <> 6;

-- ── B. Clonar la semana en curso a las dos siguientes ─────────────────────
for r in select 7 as salto, 1 as idx union all select 14, 2 loop

  -- se saltea si esa semana ya tiene sesiones (idempotencia)
  if exists (select 1 from training_sessions
              where club_id = v_club
                and session_date between v_lun + r.salto and v_lun + r.salto + 6) then
    raise notice 'Semana +% ya tenía sesiones, se saltea.', r.salto;
    continue;
  end if;

  insert into training_sessions (
    id, club_id, team_id, title, session_date, session_time, end_time, duration,
    session_type, coach_id, location, notes, orientation, focus, match_day_offset,
    microcycle_id, visible_to, session_label, session_attributes, gym_content,
    gps_targets, estimated_rpe, sort_order, season_id, published)
  select gen_random_uuid(), s.club_id, s.team_id, s.title,
         s.session_date + r.salto, s.session_time, s.end_time, s.duration,
         s.session_type, s.coach_id, s.location, s.notes, s.orientation, s.focus,
         s.match_day_offset,
         (select m.id from microcycles m
           where m.club_id = v_club
             and (s.session_date + r.salto) between m.start_date and m.end_date
           limit 1),
         s.visible_to, s.session_label, s.session_attributes, s.gym_content,
         s.gps_targets, s.estimated_rpe, s.sort_order, s.season_id, s.published
    from training_sessions s
   where s.club_id = v_club
     and s.session_date between v_lun and v_lun + 6;
  get diagnostics v_n = row_count;
  raise notice 'Semana +%: % sesiones clonadas.', r.salto, v_n;

  -- Los eventos de la semana (desayunos, charlas, chequeo médico, partido) se
  -- clonan igual, para que el Calendar no quede pelado hacia adelante.
  insert into calendar_events (
    club_id, team_id, created_by, title, type, date, start_time, end_time,
    duration_minutes, location, opponent, competition, home_away, notes,
    published, estimated_rpe, sort_order, visible_to, season_id, travel_mode)
  select e.club_id, e.team_id, e.created_by, e.title, e.type, e.date + r.salto,
         e.start_time, e.end_time, e.duration_minutes, e.location,
         -- rival distinto cada semana; si no, las tres jornadas serían contra el mismo
         case when e.type ilike '%match%' then v_rivales[r.idx] else e.opponent end,
         e.competition,
         case when e.type ilike '%match%'
              then case when r.idx % 2 = 0 then 'away' else 'home' end
              else e.home_away end,
         e.notes, e.published, e.estimated_rpe, e.sort_order, e.visible_to,
         e.season_id, e.travel_mode
    from calendar_events e
   where e.club_id = v_club
     and e.date between v_lun and v_lun + 6;
  get diagnostics v_n = row_count;
  raise notice 'Semana +%: % eventos clonados.', r.salto, v_n;

end loop;

-- ── C. Rival del microciclo, desde el partido de SU fecha de partido ───────
--     (va al final, para que tome también los partidos recién clonados)
update microcycles m
   set rival = e.opponent,
       home_away = coalesce(e.home_away, m.home_away)
  from calendar_events e
 where m.club_id = v_club and e.club_id = v_club
   and e.type ilike '%match%'
   and e.date = m.match_date
   and e.opponent is not null;

-- ── D. Disponibilidad para los días nuevos ────────────────────────────────
insert into availability (club_id, player_id, date, status, minutes, team_id)
select v_club, p.id::text, d.dia, 'available', null, v_first
  from players p
  cross join (select generate_series(current_date, v_lun + 20, '1 day'::interval)::date dia) d
 where p.club_id = v_club
   and not exists (select 1 from availability a
                    where a.player_id = p.id::text and a.date = d.dia)
   and not exists (select 1 from injuries i
                    where i.player_id = p.id and i.status = 'active'
                      and d.dia between i.start_date and coalesce(i.expected_return, d.dia));
get diagnostics v_n = row_count;
raise notice 'Disponibilidad: % filas nuevas.', v_n;

raise notice '── Parche 2 aplicado ──';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verificación: semanas seguidas con contenido y rivales coherentes
-- ═══════════════════════════════════════════════════════════════════════════
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select m.name,
       m.start_date || ' → ' || m.end_date as semana,
       to_char(m.match_date,'YYYY-MM-DD (Dy)') as partido,
       coalesce(m.rival,'—') || ' · ' || coalesce(m.home_away,'—') as rival_microciclo,
       (select coalesce(e.opponent,'SIN PARTIDO') from calendar_events e, c c3
         where e.club_id=c3.id and e.type ilike '%match%' and e.date = m.match_date limit 1) as rival_calendario,
       (select count(*) from training_sessions s, c c2
         where s.club_id=c2.id and s.session_date between m.start_date and m.end_date) as sesiones
  from microcycles m, c
 where m.club_id = c.id and m.end_date >= current_date - 7
 order by m.start_date
 limit 6;
