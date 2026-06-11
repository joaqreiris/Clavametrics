-- =========================================================
-- 044 — Nutrition Module · Fase A (tablas + RLS)
-- 7 tablas nuevas + la `nutrition` existente (intacta).
-- Reutiliza helpers ya en DB: public.get_user_club_id(),
-- public.is_super_admin(), public.set_updated_at().
-- Patrón multi-tenant: todo scoped por club_id (salvo `foods`, global).
-- =========================================================

-- ───────────── 1. foods — catálogo GLOBAL (sin club_id) ─────────────
create table if not exists public.foods (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text check (category in
                   ('protein','carb','fat','vegetable','fruit','dairy','supplement','other')),
  -- valores por 100 g (estándar de referencia)
  kcal           numeric not null,
  protein_g      numeric not null default 0,
  carbs_g        numeric not null default 0,
  fats_g         numeric not null default 0,
  fiber_g        numeric default 0,
  -- presentación
  default_unit   text default 'g' check (default_unit in ('g','ml','unit')),
  per_unit_grams numeric,                 -- si default_unit='unit', gramos que pesa 1 unidad
  source         text,                    -- 'USDA' | 'manual' | 'ai'
  is_verified    boolean default false,
  created_at     timestamptz default now()
);
create index if not exists idx_foods_category on public.foods(category);
create index if not exists idx_foods_name on public.foods(lower(name));

alter table public.foods enable row level security;
-- lectura: cualquier usuario autenticado. escritura: solo super-admin.
drop policy if exists foods_read  on public.foods;
drop policy if exists foods_write on public.foods;
create policy foods_read on public.foods
  for select to authenticated using (true);
create policy foods_write on public.foods
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ───────────── 2. nutrition_targets — objetivos por jugador ─────────────
create table if not exists public.nutrition_targets (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.players(id) on delete cascade,
  club_id             uuid not null references public.clubs(id) on delete cascade,
  rmr_model           text not null default 'ten_haaf'
                        check (rmr_model in
                          ('ten_haaf','cunningham','de_lorenzo','harris_benedict','mifflin')),
  rmr_kcal            numeric,
  activity_factor     numeric default 1.6,
  tdee_kcal           numeric,
  kcal_target         numeric,
  protein_g           numeric,
  carbs_g             numeric,
  fats_g              numeric,
  hydration_ml        numeric,
  body_fat_target_pct numeric,
  target_date         date,
  manual_override     boolean default false,
  notes               text,
  updated_by          uuid references public.profiles(id),
  updated_at          timestamptz default now(),
  created_at          timestamptz default now(),
  unique (player_id)                     -- un target activo por jugador
);
create index if not exists idx_nutrition_targets_club on public.nutrition_targets(club_id);

alter table public.nutrition_targets enable row level security;
drop policy if exists nutrition_targets_rw on public.nutrition_targets;
create policy nutrition_targets_rw on public.nutrition_targets
  for all to authenticated
  using (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());

create trigger trg_nutrition_targets_updated_at
  before update on public.nutrition_targets
  for each row execute function public.set_updated_at();

-- ───────────── 3. meal_plan_templates — plantilla por tipo de día ─────────────
create table if not exists public.meal_plan_templates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  day_type    text check (day_type in
                ('MD','MD-1','MD-2','MD-3','MD+1','rest','custom')),
  base_kcal   numeric,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);
create index if not exists idx_meal_plan_templates_club on public.meal_plan_templates(club_id);

alter table public.meal_plan_templates enable row level security;
drop policy if exists meal_plan_templates_rw on public.meal_plan_templates;
create policy meal_plan_templates_rw on public.meal_plan_templates
  for all to authenticated
  using (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());

-- ───────────── 4. meal_plan_meals — comidas de un template ─────────────
-- Sin club_id propio: scope vía template_id → meal_plan_templates.club_id.
create table if not exists public.meal_plan_meals (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meal_plan_templates(id) on delete cascade,
  meal_order  int not null default 0,
  name        text not null,
  time_hint   text
);
create index if not exists idx_meal_plan_meals_template on public.meal_plan_meals(template_id);

alter table public.meal_plan_meals enable row level security;
drop policy if exists meal_plan_meals_rw on public.meal_plan_meals;
create policy meal_plan_meals_rw on public.meal_plan_meals
  for all to authenticated
  using (exists (
    select 1 from public.meal_plan_templates t
    where t.id = meal_plan_meals.template_id
      and t.club_id = public.get_user_club_id()))
  with check (exists (
    select 1 from public.meal_plan_templates t
    where t.id = meal_plan_meals.template_id
      and t.club_id = public.get_user_club_id()));

-- ───────────── 5. meal_plan_items — alimentos de cada comida ─────────────
-- Sin club_id propio: scope vía meal_id → meal_plan_meals → template.
create table if not exists public.meal_plan_items (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meal_plan_meals(id) on delete cascade,
  food_id    uuid not null references public.foods(id),
  quantity_g numeric not null,
  note       text
);
create index if not exists idx_meal_plan_items_meal on public.meal_plan_items(meal_id);
create index if not exists idx_meal_plan_items_food on public.meal_plan_items(food_id);

alter table public.meal_plan_items enable row level security;
drop policy if exists meal_plan_items_rw on public.meal_plan_items;
create policy meal_plan_items_rw on public.meal_plan_items
  for all to authenticated
  using (exists (
    select 1 from public.meal_plan_meals m
    join public.meal_plan_templates t on t.id = m.template_id
    where m.id = meal_plan_items.meal_id
      and t.club_id = public.get_user_club_id()))
  with check (exists (
    select 1 from public.meal_plan_meals m
    join public.meal_plan_templates t on t.id = m.template_id
    where m.id = meal_plan_items.meal_id
      and t.club_id = public.get_user_club_id()));

-- ───────────── 6. player_meal_assignments — template asignado a jugador ─────────────
create table if not exists public.player_meal_assignments (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.players(id) on delete cascade,
  club_id          uuid not null references public.clubs(id) on delete cascade,
  template_id      uuid not null references public.meal_plan_templates(id) on delete cascade,
  assigned_date    date,
  day_type         text,
  scale_factor     numeric default 1.0,
  custom_overrides jsonb,
  created_at       timestamptz default now()
);
create index if not exists idx_pma_club on public.player_meal_assignments(club_id);
create index if not exists idx_pma_player on public.player_meal_assignments(player_id);
create index if not exists idx_pma_template on public.player_meal_assignments(template_id);

alter table public.player_meal_assignments enable row level security;
drop policy if exists player_meal_assignments_rw on public.player_meal_assignments;
create policy player_meal_assignments_rw on public.player_meal_assignments
  for all to authenticated
  using (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());

-- ───────────── 7. body_composition — weigh-ins / evolución ─────────────
create table if not exists public.body_composition (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  measured_date date not null,
  weight_kg     numeric,
  body_fat_pct  numeric,
  lean_mass_kg  numeric,
  method        text check (method in ('skinfold','bia','dexa','scale')),
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);
create index if not exists idx_body_composition_club on public.body_composition(club_id);
create index if not exists idx_body_composition_player_date
  on public.body_composition(player_id, measured_date desc);

alter table public.body_composition enable row level security;
drop policy if exists body_composition_rw on public.body_composition;
create policy body_composition_rw on public.body_composition
  for all to authenticated
  using (club_id = public.get_user_club_id())
  with check (club_id = public.get_user_club_id());
