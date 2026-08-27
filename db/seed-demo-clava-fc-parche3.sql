-- ═══════════════════════════════════════════════════════════════════════════
--  Clava FC — parche 3: los nombres de clubes reales seguían en los TÍTULOS
--
--  El seed renombró calendar_events.opponent, pero el título del evento es un
--  campo aparte, y ahí seguía el nombre real: el evento del sábado mostraba
--  "vs Polvorín FC" en el título mientras el rival ya decía "CD Portomar".
--  Lo mismo en el título de las sesiones de partido.
--
--  Son 94 registros (48 eventos + 46 sesiones). Se reescribe el título a
--  partir del rival ya renombrado, así los dos campos coinciden siempre.
--
--  Barrido hecho sobre notes, location, stadium y nombre de microciclo: ahí
--  no quedaba ninguno.
--
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_club uuid := 'c3740000-0000-0000-0000-000000000001';
  v_n    int;
begin

-- Título del evento de partido = "vs <rival ya renombrado>"
update calendar_events
   set title = 'vs ' || opponent
 where club_id = v_club
   and type ilike '%match%'
   and opponent is not null
   and title is distinct from ('vs ' || opponent);
get diagnostics v_n = row_count;
raise notice 'Títulos de eventos corregidos: %', v_n;

-- Título de la sesión de partido = el del evento de ese día
update training_sessions s
   set title = 'vs ' || e.opponent
  from calendar_events e
 where s.club_id = v_club and e.club_id = v_club
   and e.type ilike '%match%'
   and e.date = s.session_date
   and s.session_type = 'match'
   and e.opponent is not null
   and s.title is distinct from ('vs ' || e.opponent);
get diagnostics v_n = row_count;
raise notice 'Títulos de sesiones de partido corregidos: %', v_n;

-- Las sesiones de partido que quedaron sin evento del mismo día (por los
-- partidos borrados en el parche 2) pasan a un título genérico.
update training_sessions
   set title = 'Partido'
 where club_id = v_club
   and session_type = 'match'
   and title ~* '(polvorín|bergantiños|céltiga|celtiga|compostela|ferrol|pontevedra|ourense|silva sd|boiro|alondras|estradense|ribadumia|villalbés|cerceda|lalín|as pontes|gran peña|choco|arosa|cd miño|crotenlo|visakha|celta)';
get diagnostics v_n = row_count;
raise notice 'Sesiones de partido sin evento, con título genérico: %', v_n;

raise notice '── Parche 3 aplicado ──';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verificación: no debe quedar NINGÚN nombre real en ningún campo de texto
-- ═══════════════════════════════════════════════════════════════════════════
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id),
pat as (select '(polvorín|bergantiños|céltiga|celtiga|compostela|ferrol|pontevedra|ourense|silva sd|boiro|alondras|estradense|ribadumia|villalbés|cerceda|lalín|as pontes|gran peña|choco|arosa|cd miño|crotenlo|visakha|celta)' p)
select 'calendar_events.title' campo, count(*) quedan from calendar_events e, c, pat where e.club_id=c.id and e.title ~* pat.p
union all select 'calendar_events.opponent', count(*) from calendar_events e, c, pat where e.club_id=c.id and e.opponent ~* pat.p
union all select 'training_sessions.title',  count(*) from training_sessions s, c, pat where s.club_id=c.id and s.title ~* pat.p
union all select 'microcycles.rival',        count(*) from microcycles m, c, pat where m.club_id=c.id and m.rival ~* pat.p
union all select 'clubs.name',               count(*) from clubs cl, c, pat where cl.id=c.id and cl.name ~* pat.p
order by 2 desc;
