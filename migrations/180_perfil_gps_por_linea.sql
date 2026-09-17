-- Migración 180: el perfil GPS de un ejercicio, por línea — y la demanda de partido de cada línea.
--
-- POR QUÉ
-- La proyección de Daily Planning ("Projected GPS load") sale de v_exercise_gps_profile, que
-- promedia a TODOS los jugadores que alguna vez hicieron el drill. En un rondo eso da igual.
-- En un drill posicional no: medido sobre los datos de MOI, en «PFB 7v5 + 3v2» una línea corre
-- 82 m/min y otra 39 — más del doble. El número único que ve el coach no le pasa a ningún
-- jugador real. Lo mismo en PATTERN 10v0 (+80%) y FINISHING 10v0 (+78%).
--
-- LOS PORTEROS QUEDAN FUERA, a propósito: en toda la base hay 2 filas de GPS de porteros
-- mapeadas a un solo ejercicio. No entrenan con el grupo en las tareas mapeadas y su demanda
-- no es comparable con la de un jugador de campo. cm_pos_group() SÍ los devuelve como 'GK'
-- (es su línea, y otra pantalla puede quererla); son estas dos vistas las que los excluyen.
--
-- LOS FILTROS SON LA UNIÓN DE LOS DE LAS DOS VISTAS QUE YA EXISTEN, porque cada una se dejó
-- algo: v_exercise_gps_profile tiene el piso de 30 s y las guardas anti-basura (más de 13 m/s
-- es imposible; HSR mayor que la distancia total es un dato roto) pero no mira is_flagged; y
-- v_gps_task_analysis sí mira is_flagged pero no compara HSR contra el total. Ninguna de las
-- dos filtra work_context ni gps_valid_from.
-- Aquí están todos. Hoy en MOI no cambian un número (de las 2310 filas mapeadas, todas son
-- 'team', ninguna está marcada, ninguna baja de 30 s y ninguna viola las guardas), pero en un
-- club con jugadores en rehab la proyección se contaminaría, y el club que cambió de
-- metodología de medición no quiere su histórico viejo dentro de la referencia.
--
-- Idempotente: create or replace.

-- ── 1. Posición → línea ────────────────────────────────────────────────────────────────────
-- Es la MISMA agrupación que ya usa la pantalla (_DP_POS_GROUP en assets/pages/daily-planning.js):
-- GK · DEF · MID · WNG · FWD. Se duplica aquí porque el SQL no puede leer el JS, pero la
-- definición canónica es una sola y las dos tienen que moverse juntas.
-- Devuelve NULL para una posición vacía o desconocida: ese jugador no cuenta para ninguna
-- línea, pero SÍ entra en el total del equipo (la fila 'ALL' de las vistas de abajo).
create or replace function public.cm_pos_group(pos text)
returns text language sql immutable strict parallel safe as $$
  select case upper(trim(pos))
    when 'GK'  then 'GK'
    when 'CB'  then 'DEF' when 'LB'  then 'DEF' when 'RB' then 'DEF' when 'LWB' then 'DEF'
    when 'RWB' then 'DEF' when 'FB'  then 'DEF' when 'WB' then 'DEF' when 'DEF' then 'DEF'
    when 'CDM' then 'MID' when 'DM'  then 'MID' when 'CM' then 'MID' when 'MF'  then 'MID'
    when 'CAM' then 'MID' when 'AM'  then 'MID' when 'MID' then 'MID'
    when 'LM'  then 'WNG' when 'RM'  then 'WNG' when 'LW' then 'WNG' when 'RW'  then 'WNG'
    when 'WG'  then 'WNG'
    when 'SS'  then 'FWD' when 'CF'  then 'FWD' when 'ST' then 'FWD' when 'ATT' then 'FWD'
    when 'FW'  then 'FWD'
  end;
$$;
comment on function public.cm_pos_group(text) is
  'Posición de plantilla → línea (GK/DEF/MID/WNG/FWD). NULL si está vacía o no se reconoce. Espejo de _DP_POS_GROUP en daily-planning.js.';

-- ── 2. El perfil por minuto de cada ejercicio, por línea ────────────────────────────────────
-- Una fila por (ejercicio, línea) MÁS una fila 'ALL' con todos los jugadores de campo juntos
-- —incluidos los de posición desconocida—, que es la que alimenta el modo equipo de la card.
-- Así los dos modos salen de la misma fuente y no pueden contradecirse.
-- n_instances y n_players viajan con cada fila: son el permiso para mostrarla. Con muestra
-- fina la línea no se dibuja y se cae al 'ALL' (la UI marca cuándo lo hace). Hace falta:
-- en MOI las filas por ejercicio son DEF 11.5, MID 9.3, WNG 5.6 y FWD 2.3.
create or replace view public.v_exercise_gps_profile_pos with (security_invoker = on) as
with base as (
  select r.club_id, m.exercise_id, r.player_id,
         public.cm_pos_group(p.position)               as pos_group,
         r.duration_seconds / 60.0                     as mins,
         r.total_distance, r.high_speed_distance, r.very_high_speed_distance,
         r.sprint_distance, r.sprint_count, r.accelerations, r.decelerations,
         r.player_load, r.hmld
  from public.gps_period_reports r
  join public.gps_drill_map m
    on m.club_id = r.club_id
   and m.period_name = r.period_name
  join public.players p          on p.id = r.player_id
  join public.training_sessions ts on ts.id = r.session_id
  left join public.club_gps_settings s on s.club_id = r.club_id
  where m.exercise_id is not null
    and m.ignored = false
    and r.duration_seconds >= 30
    and r.is_flagged = false
    and r.work_context = 'team'
    and (r.total_distance is null or r.total_distance / nullif(r.duration_seconds, 0) <= 13)
    and (r.total_distance is null or r.high_speed_distance is null or r.total_distance >= r.high_speed_distance)
    and (s.gps_valid_from is null or ts.session_date >= s.gps_valid_from)
    and public.cm_pos_group(p.position) is distinct from 'GK'
)
select b.club_id, b.exercise_id, g.pos_group,
       count(*)                                      as n_instances,
       count(distinct b.player_id)                   as n_players,
       avg(b.total_distance           / b.mins)      as total_distance_per_min,
       avg(b.high_speed_distance      / b.mins)      as high_speed_distance_per_min,
       avg(b.very_high_speed_distance / b.mins)      as very_high_speed_distance_per_min,
       avg(b.sprint_distance          / b.mins)      as sprint_distance_per_min,
       avg(b.sprint_count             / b.mins)      as sprint_count_per_min,
       avg(b.accelerations            / b.mins)      as accelerations_per_min,
       avg(b.decelerations            / b.mins)      as decelerations_per_min,
       avg(b.player_load              / b.mins)      as player_load_per_min,
       avg(b.hmld                     / b.mins)      as hmld_per_min
from base b
cross join lateral (values (b.pos_group), ('ALL')) as g(pos_group)
where g.pos_group is not null
group by b.club_id, b.exercise_id, g.pos_group;

comment on view public.v_exercise_gps_profile_pos is
  'Perfil GPS por minuto de cada ejercicio, abierto por línea (DEF/MID/WNG/FWD) + fila ALL (todo el campo). Porteros excluidos. Filtros: sin filas marcadas, sólo work_context team, mínimo 30 s, guardas anti-basura (13 m/s, HSR<=total) y gps_valid_from del club.';

-- ── 3. Lo que corre cada línea en un partido ───────────────────────────────────────────────
-- Es la referencia que hace legible la proyección: «5060 m» no dice nada, «el 51% de lo que
-- corre un mediocampista en un partido» sí. Hoy los targets de la card se escriben a mano,
-- métrica por métrica y sesión por sesión, y por eso están todos vacíos.
--
-- Sólo cuentan los partidos jugados de titular o casi (60'): la referencia es lo que corre
-- quien juega el partido, no el promedio de cualquiera que pisó el campo — con el default
-- ref_min_minutes = 0 un suplente de 10' hundiría la media y el porcentaje mentiría. Si el
-- club subió su propio mínimo, manda el suyo. ref_from_date y gps_valid_from son la otra regla
-- del club: antes de esa fecha las bandas de velocidad estaban definidas de otra forma, así que
-- el HSR viejo no es comparable. Mismas reglas que lee assets/gps-baseline.js.
create or replace view public.v_match_demand_pos with (security_invoker = on) as
with base as (
  select gr.club_id, gr.player_id,
         public.cm_pos_group(p.position) as pos_group,
         gr.total_distance, gr.high_speed_distance, gr.very_high_speed_distance,
         gr.sprint_distance, gr.sprint_count, gr.accelerations, gr.decelerations,
         gr.player_load, gr.hmld, gr.time_played
  from public.gps_reports gr
  join public.training_sessions ts on ts.id = gr.session_id
  join public.players p            on p.id  = gr.player_id
  left join public.club_gps_settings s on s.club_id = gr.club_id
  where ts.session_type = 'match'
    and coalesce(gr.is_invalid, false) = false
    and gr.work_context = 'team'
    and coalesce(gr.time_played, 0) >= greatest(coalesce(s.ref_min_minutes, 0), 60)
    and (s.ref_from_date  is null or ts.session_date >= s.ref_from_date)
    and (s.gps_valid_from is null or ts.session_date >= s.gps_valid_from)
    and public.cm_pos_group(p.position) is distinct from 'GK'
)
select b.club_id, g.pos_group,
       count(*)                            as n_matches,
       count(distinct b.player_id)         as n_players,
       avg(b.time_played)                  as time_played_avg,
       avg(b.total_distance)               as total_distance,
       avg(b.high_speed_distance)          as high_speed_distance,
       avg(b.very_high_speed_distance)     as very_high_speed_distance,
       avg(b.sprint_distance)              as sprint_distance,
       avg(b.sprint_count)                 as sprint_count,
       avg(b.accelerations)                as accelerations,
       avg(b.decelerations)                as decelerations,
       avg(b.player_load)                  as player_load,
       avg(b.hmld)                         as hmld
from base b
cross join lateral (values (b.pos_group), ('ALL')) as g(pos_group)
where g.pos_group is not null
group by b.club_id, g.pos_group;

comment on view public.v_match_demand_pos is
  'Demanda media de partido por línea (jugadores de 60 minutos o más), para expresar la carga proyectada como % de un partido. Porteros excluidos. Respeta ref_min_minutes, ref_from_date y gps_valid_from del club.';
