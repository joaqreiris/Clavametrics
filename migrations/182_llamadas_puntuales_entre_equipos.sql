-- Migration 182: player_call_ups — llamar a un jugador de otra categoría SIN pasarlo de plantel.
--
-- El problema: hoy la única forma de que un jugador del filial aparezca en el primer equipo es
-- darle una membresía en player_teams. Esa membresía es PERMANENTE: a partir de ahí el chico
-- queda en la lista de availability, en la convocatoria, en los KPIs y en el picker del once,
-- todos los días, aunque haya subido una sola tarde. El cuerpo técnico pide lo contrario:
-- "que esté en el segundo equipo, pero que desde el primero podamos añadirlo cuando queramos,
-- solo en el momento que tengamos interés, no un añadido continuo".
--
-- La llamada es entonces una relación (jugador, equipo que llama, DÍA): existe ese día y no otro.
--
-- ¿Por qué tabla propia y no una fila de availability con team_id del equipo que llama?
-- Porque availability tiene PK (player_id, date) — una sola fila por jugador y día — y los
-- estados globales (injured/sick/away/rehab) se guardan con team_id NULL a propósito, para verse
-- en todos sus equipos (ver comentario de la tabla availability). Si la llamada viviera ahí,
-- marcar lesionado al llamado le borraría el team_id y el jugador DESAPARECERÍA de la lista del
-- primer equipo justo el día que hace falta saber que estaba llamado. Con tabla aparte la llamada
-- sobrevive a cualquier estado, y además queda registro de quién la hizo (el entrenador del filial
-- se entera de que le sacaron el jugador el martes, y por orden de quién).
--
-- La llamada NO cambia player_teams ni players.team_id: el jugador sigue siendo del filial a todos
-- los efectos (plantel, ficha, categoría). Solo se suma al roster del equipo que llama, ese día.
--
-- Permisos: llama quien tiene el equipo DESTINO entre los suyos (member_teams) o tiene acceso
-- pleno de planificación (admin/owner/dirección). Deliberadamente NO se toca my_player_ids(): una
-- llamada no debe abrir la historia clínica, las lesiones ni las evaluaciones del jugador al staff
-- que lo llamó. Por eso el picker solo ofrece jugadores de equipos que el usuario YA ve.
--
-- Idempotente: safe to re-run.

create table if not exists public.player_call_ups (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id)   on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    uuid not null references public.teams(id)   on delete cascade,
  date       date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, team_id, date)
);

comment on table  public.player_call_ups is
  'Llamada PUNTUAL de un jugador a un equipo que no es el suyo, válida solo para ese día. No crea membresía: player_teams no se toca.';
comment on column public.player_call_ups.team_id is
  'Equipo que LLAMA (el destino), no el del jugador.';

-- La consulta caliente es "los llamados de ESTE equipo en ESTE rango" (grilla de availability,
-- sesión del día, picker del once): club+equipo+fecha en ese orden.
create index if not exists player_call_ups_team_date_idx on public.player_call_ups (club_id, team_id, date);
-- Y la inversa, para el filial: "a quién me sacaron y cuándo".
create index if not exists player_call_ups_player_date_idx on public.player_call_ups (player_id, date);

alter table public.player_call_ups enable row level security;

-- SELECT: cualquier miembro del club. El equipo de origen tiene que poder ver que le llamaron
-- al jugador; si esto se limitara al equipo que llama, el filial se enteraría por el pasillo.
drop policy if exists player_call_ups_select on public.player_call_ups;
create policy player_call_ups_select on public.player_call_ups
  for select to authenticated
  using (club_id = public.get_user_club_id());

-- INSERT/UPDATE/DELETE: el staff del equipo que llama, o acceso pleno de planificación.
-- El club se verifica en las dos ramas (ver el patrón de guards de rol que no miraban el club,
-- migración 164 y siguientes) y además el equipo tiene que ser DE ese club: sin ese EXISTS, un
-- admin —que entra por has_full_planning_access()— podía escribir una fila con su club_id y el
-- team_id de otro club. No filtra datos (la RLS de players y teams tapa el resto), pero deja
-- basura cruzada. El EXISTS va solo en las ramas de escritura: en el SELECT, que es la consulta
-- caliente (se pide en cada carga de la grilla y de cada día), correría por fila.
drop policy if exists player_call_ups_write on public.player_call_ups;

drop policy if exists player_call_ups_insert on public.player_call_ups;
create policy player_call_ups_insert on public.player_call_ups
  for insert to authenticated
  with check (
    club_id = public.get_user_club_id()
    and (public.has_full_planning_access() or team_id in (select public.my_team_ids()))
    and exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.get_user_club_id())
  );

drop policy if exists player_call_ups_update on public.player_call_ups;
create policy player_call_ups_update on public.player_call_ups
  for update to authenticated
  using (
    club_id = public.get_user_club_id()
    and (public.has_full_planning_access() or team_id in (select public.my_team_ids()))
  )
  with check (
    club_id = public.get_user_club_id()
    and (public.has_full_planning_access() or team_id in (select public.my_team_ids()))
    and exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.get_user_club_id())
  );

drop policy if exists player_call_ups_delete on public.player_call_ups;
create policy player_call_ups_delete on public.player_call_ups
  for delete to authenticated
  using (
    club_id = public.get_user_club_id()
    and (public.has_full_planning_access() or team_id in (select public.my_team_ids()))
  );
