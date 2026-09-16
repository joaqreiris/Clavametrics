-- Migración 176: en qué punto del arranque está un club, en una sola consulta.
--
-- El dato que motiva esto: de los cuatro clubes creados con el asistente actual, CUATRO
-- no tienen temporada ni un solo evento de calendario, y los cuatro tienen un único
-- usuario — nadie invitó a nadie. Dos ni siquiera cargaron un jugador. El asistente
-- termina bien y a partir de ahí el club se queda solo: el Hub le dice "All clear · no
-- alerts today", que para alguien que no cargó nada es el peor mensaje posible.
--
-- ── Decisiones ──
--
-- 1. UNA SOLA LLAMADA. Seis contadores desde el Hub serían seis consultas con RLS en el
--    camino crítico de la primera pantalla. Acá es un round-trip.
--
-- 2. SOLO QUIEN PUEDE HACER ALGO AL RESPECTO. Un fisio no crea temporadas ni invita
--    staff: enseñarle una lista de tareas que no puede completar es ruido. Devuelve cero
--    filas si el rol no es admin/owner — fail closed, como is_my_club().
--
-- 3. CONTADORES, NO BOOLEANOS. "3 jugadores" permite decir "seguí cargando"; un `true`
--    pelado, no. La pantalla decide el corte.
--
-- El paso 'checkin' suma wellness y RPE a propósito: son la misma pregunta desde el punto
-- de vista del arranque —¿hay algún dato entrando desde los jugadores?— y da igual por
-- cuál de las dos empiece el club.

create or replace function public.club_first_steps()
returns table (
  players   integer,
  seasons   integer,
  events    integer,
  staff     integer,
  checkins  integer,
  sessions  integer
)
language sql
stable
security definer set search_path to 'public'
as $$
  with me as (
    select public.get_user_club_id() as club_id, public.my_role() as role
  )
  select
    (select count(*) from public.players           p  where p.club_id  = me.club_id)::integer,
    (select count(*) from public.seasons           s  where s.club_id  = me.club_id)::integer,
    (select count(*) from public.calendar_events   e  where e.club_id  = me.club_id)::integer,
    (select count(*) from public.profiles          pr where pr.club_id = me.club_id)::integer,
    ((select count(*) from public.wellness         w  where w.club_id  = me.club_id)
     + (select count(*) from public.rpe            r  where r.club_id  = me.club_id))::integer,
    (select count(*) from public.training_sessions t  where t.club_id  = me.club_id)::integer
  from me
  where me.club_id is not null
    and me.role in ('admin','owner');
$$;

comment on function public.club_first_steps() is
  'Contadores de arranque del club del usuario (jugadores, temporadas, eventos, staff, '
  'check-ins, sesiones). Cero filas si no hay club o el rol no es admin/owner.';

grant execute on function public.club_first_steps() to authenticated;
