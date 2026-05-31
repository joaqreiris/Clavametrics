-- =============================================================
-- Migration 017: Rehab Plans & Owners
-- Reemplaza el diseño anterior (rehab_protocols + preventive_routines).
-- Decisión de diseño: una sola tabla rehab_plans con kind (rehab|preventive)
-- porque la UI los trata como lista unificada y evita duplicación de tablas.
-- Depends on: players, injuries, profiles, clubs
-- =============================================================

-- ─── rehab_plans ──────────────────────────────────────────────
create table if not exists rehab_plans (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references clubs(id),
  player_id             uuid not null references players(id),
  injury_id             uuid references injuries(id),           -- null para preventivos
  kind                  text not null check (kind in ('rehab','preventive')),
  name                  text,
  diagnosis             text,
  phase                 text,
  phase_type            text check (phase_type in ('acute','subacute','strength','field','foundation','capacity','neuromuscular','running','training','competition')),
  start_date            date,
  rtp_estimate          date,
  rtp_window_days       int,
  programme_week        int,                                    -- semana actual (preventivos)
  programme_total_weeks int,                                    -- total semanas (preventivos)
  source                text check (source in ('injury','evaluation','gps','manual')),
  source_label          text,                                   -- "Flagged by GPS · May 22"
  risk_metric           text,                                   -- "ACWR 1.42", "LSI 18%"
  status                text not null default 'on_track'
                          check (status in ('on_track','near_rtp','blocked','cleared','archived')),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_rehab_plans_club        on rehab_plans(club_id);
create index if not exists idx_rehab_plans_club_status on rehab_plans(club_id, status);

-- ─── rehab_plan_owners ────────────────────────────────────────
-- Staff responsable de un plan (avatares RM / LP / DV). Relación N:N plan↔profile.
create table if not exists rehab_plan_owners (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references rehab_plans(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  role       text not null check (role in ('physio','sc','coach')),
  created_at timestamptz default now(),
  unique (plan_id, profile_id)
);

create index if not exists idx_rehab_owners_plan on rehab_plan_owners(plan_id);

-- ─── RLS ──────────────────────────────────────────────────────
alter table rehab_plans       enable row level security;
alter table rehab_plan_owners enable row level security;

drop policy if exists rehab_plans_all on rehab_plans;
create policy rehab_plans_all on rehab_plans
  for all to authenticated using (
    club_id in (select club_id from profiles where id = auth.uid())
  );

drop policy if exists rehab_plan_owners_all on rehab_plan_owners;
create policy rehab_plan_owners_all on rehab_plan_owners
  for all to authenticated using (
    plan_id in (
      select id from rehab_plans
      where club_id in (select club_id from profiles where id = auth.uid())
    )
  );

-- ─── Trigger updated_at ───────────────────────────────────────
drop trigger if exists rehab_plans_updated_at on rehab_plans;
create trigger rehab_plans_updated_at before update on rehab_plans
  for each row execute function set_updated_at();

-- ─── rehab_sessions ───────────────────────────────────────────
-- Sesión diaria de un plan. Scope: Rehab Planner.
-- La tabla existe ahora para que la página pueda leer "Today's session".
-- Persistencia (write) se implementa en el módulo Rehab Planner.
create table if not exists rehab_sessions (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references rehab_plans(id) on delete cascade,
  club_id      uuid not null,
  date         date not null,
  name         text,
  color        text,
  start_time   time,
  duration_min int,
  block_count  int,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_rehab_sessions_plan_date on rehab_sessions(plan_id, date);
create index if not exists idx_rehab_sessions_club_date on rehab_sessions(club_id, date);

alter table rehab_sessions enable row level security;

drop policy if exists rehab_sessions_all on rehab_sessions;
create policy rehab_sessions_all on rehab_sessions
  for all to authenticated using (
    plan_id in (
      select id from rehab_plans
      where club_id in (select club_id from profiles where id = auth.uid())
    )
  );

-- =============================================================
-- SEED — datos reales del club c3740000-0000-0000-0000-000000000001
--
-- Rehab (3 lesiones activas):
--   Barreiro  → LCA rodilla izquierda severe  (2026-05-22)
--   Lago      → Hamstring strain moderate     (2026-04-03)
--   Vázquez   → Stress Fracture severe        (2026-02-06)
--
-- Preventive (historial de lesiones, sin activa):
--   Outeiro   → historial LCM rodilla
--   Figueroa  → historial hamstring
--   Quintela  → historial aductor
--
-- Owner único: Joaquín Reiris (a0751669-a476-4d78-adae-8c224784023f)
-- =============================================================

do $$
declare
  v_club    uuid := 'c3740000-0000-0000-0000-000000000001';
  v_owner   uuid := 'a0751669-a476-4d78-adae-8c224784023f';

  -- jugadores rehab
  v_barreiro uuid := '1517629d-7220-4569-a8fa-8bd0ac89117a';
  v_lago     uuid := '4057105c-7146-4107-b514-bed2fbbcabb9';
  v_vazquez  uuid := 'a9a5bef4-01a0-4f82-b56d-1cd4c6bb7434';

  -- jugadores preventive
  v_outeiro  uuid := 'b4ccfbac-6259-4777-ba3b-448c9dc7f747';
  v_figueroa uuid := '1fb53e83-31ed-40a0-951e-7bffdc66d2c2';
  v_quintela uuid := '55a0a576-4ee3-4b3e-8497-a8e4f5286d51';

  -- lesiones activas
  v_inj_barreiro uuid := 'd827eeff-1535-4d5a-b359-16d849f2e779';
  v_inj_lago     uuid := 'b5261890-0d02-4d21-833d-c50375b01a9e';
  v_inj_vazquez  uuid := '8faa8a48-981b-421c-bc32-affc68b1fa49';

  -- ids de planes (para rehab_plan_owners)
  v_plan_barreiro uuid;
  v_plan_lago     uuid;
  v_plan_vazquez  uuid;
  v_plan_outeiro  uuid;
  v_plan_figueroa uuid;
  v_plan_quintela uuid;
  v_existing      int;
begin

  -- Guard: skip if seed already applied
  select count(*) into v_existing from rehab_plans where club_id = v_club;
  if v_existing > 0 then
    raise notice 'Seed already applied (% plans found), skipping.', v_existing;
    return;
  end if;

  -- ── Planes rehab ──────────────────────────────────────────
  -- Barreiro: LCA Day 9 → Phase 1 "Post-op Acute" in_progress (termina 2026-06-05)
  insert into rehab_plans (club_id, player_id, injury_id, kind, diagnosis, phase, phase_type,
                            start_date, rtp_estimate, rtp_window_days, source, status)
  values (v_club, v_barreiro, v_inj_barreiro, 'rehab',
          'Rotura LCA + menisco parcial izquierda', 'Post-op Acute', 'acute',
          '2026-05-22', '2027-03-18', 14, 'injury', 'on_track')
  returning id into v_plan_barreiro;

  -- Lago: Hamstring Day 58 → Phase 3 "Functional" (strength) — fases 1-2 vencidas sin avanzar
  insert into rehab_plans (club_id, player_id, injury_id, kind, diagnosis, phase, phase_type,
                            start_date, rtp_estimate, rtp_window_days, source, status)
  values (v_club, v_lago, v_inj_lago, 'rehab',
          'Hamstring strain izquierdo moderado', 'Functional', 'strength',
          '2026-04-03', '2026-06-10', 7, 'injury', 'near_rtp')
  returning id into v_plan_lago;

  -- Vázquez: Stress Fracture Day 114 → Phase 5 "Return to sport" (última) — fases 1-4 vencidas sin avanzar
  insert into rehab_plans (club_id, player_id, injury_id, kind, diagnosis, phase, phase_type,
                            start_date, rtp_estimate, rtp_window_days, source, status)
  values (v_club, v_vazquez, v_inj_vazquez, 'rehab',
          'Fractura de estrés tibia izquierda', 'Return to sport', 'competition',
          '2026-02-06', '2026-06-14', 5, 'injury', 'near_rtp')
  returning id into v_plan_vazquez;

  -- ── Planes preventive ─────────────────────────────────────
  -- Outeiro: historial LCM → fuerza & potencia unilateral
  insert into rehab_plans (club_id, player_id, injury_id, kind, diagnosis, phase, phase_type,
                            programme_week, programme_total_weeks, source, source_label, risk_metric, status)
  values (v_club, v_outeiro, null, 'preventive',
          'Historial LCM rodilla derecha', 'Strength & power', 'strength',
          3, 8, 'evaluation', 'Risk flag eval · Feb 18', 'LSI 12%', 'on_track')
  returning id into v_plan_outeiro;

  -- Figueroa: historial hamstring → hipertrofia & control
  insert into rehab_plans (club_id, player_id, injury_id, kind, diagnosis, phase, phase_type,
                            programme_week, programme_total_weeks, source, source_label, risk_metric, status)
  values (v_club, v_figueroa, null, 'preventive',
          'Historial isquiotibial recurrente', 'Hypertrophy & control', 'capacity',
          5, 8, 'evaluation', 'Risk flag eval · Oct 01', 'LSI 15%', 'on_track')
  returning id into v_plan_figueroa;

  -- Quintela: historial aductor → foundation
  insert into rehab_plans (club_id, player_id, injury_id, kind, diagnosis, phase, phase_type,
                            programme_week, programme_total_weeks, source, source_label, risk_metric, status)
  values (v_club, v_quintela, null, 'preventive',
          'Historial lesión aductor izquierdo', 'Foundation', 'foundation',
          2, 6, 'evaluation', 'Risk flag eval · Oct 28', 'ACWR 1.38', 'on_track')
  returning id into v_plan_quintela;

  -- ── Owners (único perfil disponible) ──────────────────────
  insert into rehab_plan_owners (plan_id, profile_id, role) values
    (v_plan_barreiro, v_owner, 'physio'),
    (v_plan_lago,     v_owner, 'physio'),
    (v_plan_vazquez,  v_owner, 'physio'),
    (v_plan_outeiro,  v_owner, 'sc'),
    (v_plan_figueroa, v_owner, 'sc'),
    (v_plan_quintela, v_owner, 'sc');

  -- ── Corrección injury_phases (fases stale) ────────────────
  -- Lago: fases 1-2 ya vencidas → done; fase 3 "Functional" → in_progress
  update injury_phases set status = 'done', actual_end = end_date
  where injury_id = v_inj_lago and phase_number in (1, 2);

  update injury_phases set status = 'in_progress', actual_start = '2026-04-11'
  where injury_id = v_inj_lago and phase_number = 3;

  -- Vázquez: fases 1-4 ya vencidas → done; fase 5 "Return to sport" → in_progress
  update injury_phases set status = 'done', actual_end = end_date
  where injury_id = v_inj_vazquez and phase_number in (1, 2, 3, 4);

  update injury_phases set status = 'in_progress', actual_start = '2026-03-23'
  where injury_id = v_inj_vazquez and phase_number = 5;

end $$;
