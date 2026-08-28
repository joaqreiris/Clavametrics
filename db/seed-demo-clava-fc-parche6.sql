-- ═══════════════════════════════════════════════════════════════════════════
--  Clava FC — parche 6: los clubes reales que quedaban en las SESIONES
--
--  El rival de un partido se guarda en DOS sitios distintos:
--    · calendar_events.opponent            → renombrado en el seed
--    · training_sessions.session_attributes.rival  → NO se tocó
--
--  El segundo es el que lee GPS Analysis para su filtro de rival y para las
--  tablas por jugador, así que ahí seguían apareciendo Polvorín FC, Silva SD,
--  Bergantiños, Céltiga, Compostela B, Racing Ferrol B… los 20 clubes reales.
--
--  Se copia el rival del evento de partido del mismo día, que ya está
--  renombrado, de modo que los dos campos digan siempre lo mismo.
--
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_club uuid := 'c3740000-0000-0000-0000-000000000001';
  v_n    int;
begin

update training_sessions s
   set session_attributes = coalesce(s.session_attributes, '{}'::jsonb)
                            || jsonb_build_object('rival', e.opponent)
  from calendar_events e
 where s.club_id = v_club and e.club_id = v_club
   and e.type ilike '%match%'
   and e.date = s.session_date
   and e.opponent is not null
   and s.session_attributes->>'rival' is distinct from e.opponent;
get diagnostics v_n = row_count;
raise notice 'Sesiones con el rival corregido: %', v_n;

-- Si quedó alguna sesión de partido con un rival que no está en ningún evento
-- (por los partidos que borró el parche 2), se le quita el campo en vez de
-- dejar el nombre viejo.
update training_sessions
   set session_attributes = session_attributes - 'rival'
 where club_id = v_club
   and session_attributes ? 'rival'
   and session_attributes->>'rival' ~* '(polvorín|bergantiños|céltiga|celtiga|compostela|ferrol|pontevedra|ourense|silva sd|boiro|alondras|estradense|ribadumia|villalbés|cerceda|lalín|as pontes|gran peña|choco|arosa|cd miño|crotenlo|visakha|celta)';
get diagnostics v_n = row_count;
raise notice 'Sesiones huérfanas a las que se les quitó el rival viejo: %', v_n;

raise notice '── Parche 6 aplicado ──';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verificación
-- ═══════════════════════════════════════════════════════════════════════════
with c as (select 'c3740000-0000-0000-0000-000000000001'::uuid id)
select 'rivales en sesiones' k,
       (select string_agg(distinct s.session_attributes->>'rival', ' · ')
          from training_sessions s, c where s.club_id=c.id and s.session_attributes ? 'rival') v
union all
select 'clubes reales que quedan',
       (select count(*)::text from training_sessions s, c
         where s.club_id=c.id
           and s.session_attributes->>'rival' ~* '(polvorín|bergantiños|céltiga|compostela|ferrol|pontevedra|ourense|silva sd|boiro|alondras|estradense|ribadumia|villalbés|cerceda|lalín|as pontes|gran peña|choco|arosa|cd miño|crotenlo|visakha|celta)')
union all
select 'sesiones de partido sin rival',
       (select count(*)::text from training_sessions s, c
         where s.club_id=c.id and s.session_type='match' and not (s.session_attributes ? 'rival'))
union all
select 'sesión y evento coinciden',
       (select count(*)::text || ' de ' ||
               (select count(*)::text from training_sessions s2, c c3 where s2.club_id=c3.id and s2.session_type='match')
          from training_sessions s
          join calendar_events e on e.date = s.session_date and e.type ilike '%match%'
             and e.club_id = s.club_id, c c2
         where s.club_id=c2.id and s.session_type='match'
           and s.session_attributes->>'rival' = e.opponent);
