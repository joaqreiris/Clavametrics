-- =====================================================================
-- ClavaMetrics — ESQUEMA COMPLETO de la DB (fuente de verdad unica)
-- Reconstruido por introspeccion en vivo via Supabase Management API
-- (proyecto xesrumijvdmqjrufgeka / Kime-app, PostgreSQL 17.6).
-- Generado: 2026-07-05.  NO editar a mano: regenerar desde la DB.
--
-- 118 tablas | 247 FKs | 5 vistas | 75 funciones
-- | 39 triggers | 273 politicas RLS
-- Incluye: tablas, tipos, PK/UNIQUE/CHECK, FK (con ON DELETE), indices,
--          vistas, funciones (cuerpos reales), triggers, RLS + politicas.
-- No incluye: GRANTs por rol, datos/seeds, objetos de schemas auth/storage.
-- =====================================================================

-- ============================ TABLAS ============================

create table if not exists public.activity_log (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  actor_id uuid,
  actor_label text,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  player_id uuid,
  summary jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint activity_log_pkey primary key (id)
);
CREATE INDEX activity_log_club_created_idx ON public.activity_log USING btree (club_id, created_at DESC);
CREATE INDEX activity_log_team_idx ON public.activity_log USING btree (team_id);
CREATE UNIQUE INDEX activity_log_gps_session_day_uidx ON public.activity_log USING btree (entity_id, (((created_at AT TIME ZONE 'UTC'::text))::date)) WHERE (action = 'gps.imported'::text);

create table if not exists public.ai_card_generations (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  user_id uuid,
  prompt text not null,
  produced jsonb,
  model text,
  valid boolean,
  accepted boolean,
  created_at timestamp with time zone default now(),
  constraint ai_card_generations_pkey primary key (id)
);

create table if not exists public.assessment_column_maps (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  source_label text default 'screening'::text not null,
  source_column_name text not null,
  test_key text not null,
  side text,
  updated_at timestamp with time zone default now() not null,
  constraint assessment_column_maps_pkey primary key (id),
  constraint assessment_column_maps_club_id_source_label_source_column_n_key UNIQUE (club_id, source_label, source_column_name),
  constraint assessment_column_maps_side_check CHECK ((side = ANY (ARRAY['L'::text, 'R'::text])))
);
CREATE INDEX idx_assessment_col_map_club ON public.assessment_column_maps USING btree (club_id);

create table if not exists public.assessment_test_defs (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  family text not null,
  key text not null,
  test_type text not null,
  label text not null,
  i18n_key text,
  metric_key text default 'peak_force'::text not null,
  unit text default 'N'::text not null,
  value_type text default 'numeric'::text not null,
  bilateral boolean default true not null,
  higher_is_better boolean default true not null,
  min_value numeric,
  max_value numeric,
  thresholds jsonb default '{}'::jsonb not null,
  asym_watch_pct numeric,
  asym_alert_pct numeric,
  reference text,
  reference_url text,
  evidence_level text,
  aliases text[] default '{}'::text[] not null,
  sort_order integer default 100 not null,
  active boolean default true not null,
  -- Faceted model: a test = movement (region) + position + angle + method. Lets the practitioner
  -- choose HOW to evaluate (e.g. posterior chain 90:90 on a force plate vs prone 90° with HHD).
  region text,
  position text,
  joint_angle text,
  method text,
  contraction text,
  -- Multiple metrics per test (e.g. a VALD import brings peak force + RFD + impulse). Array of
  -- {key,label,unit,higher_is_better,primary}. Empty → fall back to metric_key/unit (single metric).
  metrics jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint assessment_test_defs_pkey primary key (id),
  constraint assessment_test_defs_family_check CHECK ((family = ANY (ARRAY['isometric'::text, 'mobility'::text]))),
  constraint assessment_test_defs_key_check CHECK ((key ~ '^[a-z][a-z0-9_]*$'::text)),
  constraint assessment_test_defs_value_type_check CHECK ((value_type = ANY (ARRAY['numeric'::text, 'binary'::text, 'score'::text, 'flags'::text]))),
  constraint assessment_test_defs_evidence_level_check CHECK ((evidence_level = ANY (ARRAY['strong'::text, 'moderate'::text, 'practice'::text])))
);
CREATE UNIQUE INDEX assessment_test_defs_global_key_uidx ON public.assessment_test_defs USING btree (key) WHERE (club_id IS NULL);
CREATE UNIQUE INDEX assessment_test_defs_club_key_uidx ON public.assessment_test_defs USING btree (club_id, key) WHERE (club_id IS NOT NULL);
CREATE INDEX assessment_test_defs_family_idx ON public.assessment_test_defs USING btree (family, sort_order);

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  actor_id uuid,
  table_name text not null,
  operation text not null,
  changes jsonb,
  created_at timestamp with time zone default now() not null,
  constraint audit_log_pkey primary key (id),
  constraint audit_log_operation_check CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);
CREATE INDEX audit_log_club_created_idx ON public.audit_log USING btree (club_id, created_at DESC);

create table if not exists public.availability (
  player_id text not null,
  date date not null,
  status text not null,
  minutes integer default 0,
  club_id uuid,
  notes text,
  constraint availability_pkey primary key (player_id, date),
  constraint availability_player_date_unique UNIQUE (player_id, date),
  constraint availability_status_check CHECK ((status = ANY (ARRAY['available'::text, 'partial'::text, 'limited'::text, 'unavailable'::text, 'away'::text, 'injured'::text, 'sick'::text, 'other_team'::text])))
);

create table if not exists public.body_composition (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  measured_date date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  lean_mass_kg numeric,
  method text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  sf_triceps numeric,
  sf_subscapular numeric,
  sf_biceps numeric,
  sf_iliac_crest numeric,
  sf_supraspinal numeric,
  sf_abdominal numeric,
  sf_thigh numeric,
  sf_calf numeric,
  sf_chest numeric,
  sf_midaxillary numeric,
  girth_arm_flexed numeric,
  girth_calf numeric,
  breadth_humerus numeric,
  breadth_femur numeric,
  waist_cm numeric,
  height_cm numeric,
  age_years numeric,
  sex text,
  sf_formula text,
  sum_skinfolds numeric,
  bmi numeric,
  rfm numeric,
  soma_endo numeric,
  soma_meso numeric,
  soma_ecto numeric,
  constraint body_composition_pkey primary key (id),
  constraint body_composition_method_check CHECK ((method = ANY (ARRAY['skinfold'::text, 'bia'::text, 'dexa'::text, 'scale'::text]))),
  constraint body_composition_sex_check CHECK (((sex IS NULL) OR (sex = ANY (ARRAY['male'::text, 'female'::text]))))
);
CREATE INDEX idx_body_composition_club ON public.body_composition USING btree (club_id);
CREATE INDEX idx_body_composition_player_date ON public.body_composition USING btree (player_id, measured_date DESC);

create table if not exists public.calendar_events (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  created_by uuid,
  title text not null,
  type text not null,
  date date not null,
  start_time time without time zone,
  end_time time without time zone,
  duration_minutes integer,
  location text,
  opponent text,
  competition text,
  home_away text,
  notes text,
  published boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  estimated_rpe integer,
  sort_order integer default 0,
  rival_crest_url text,
  recurrence_group_id uuid,
  visible_to text[] default ARRAY['staff'::text],
  team_id uuid,
  competition_id uuid,
  season_id uuid,
  constraint calendar_events_pkey primary key (id),
  constraint calendar_events_competition_check CHECK ((competition = ANY (ARRAY['league'::text, 'cup'::text, 'international'::text, 'friendly'::text]))),
  constraint calendar_events_home_away_check CHECK ((home_away = ANY (ARRAY['home'::text, 'away'::text, 'neutral'::text]))),
  constraint calendar_events_estimated_rpe_check CHECK (((estimated_rpe >= 1) AND (estimated_rpe <= 10))),
  constraint calendar_events_type_check CHECK ((type = ANY (ARRAY['tactical'::text, 'gym'::text, 'recovery'::text, 'other'::text, 'match'::text, 'travel'::text, 'meeting'::text, 'evaluation'::text, 'video_session'::text, 'breakfast'::text, 'lunch'::text, 'dinner'::text, 'hotel_checkin'::text, 'hotel_checkout'::text, 'bus_departure'::text, 'bus_arrival'::text, 'press'::text, 'medical_check'::text, 'walkthrough'::text, 'scouting'::text, 'day_off'::text])))
);
CREATE INDEX idx_calendar_events_recurrence_group ON public.calendar_events USING btree (recurrence_group_id) WHERE (recurrence_group_id IS NOT NULL);
CREATE INDEX idx_calendar_events_competition ON public.calendar_events USING btree (competition_id);
CREATE UNIQUE INDEX calendar_events_match_uniq ON public.calendar_events USING btree (team_id, date, opponent) WHERE (type = 'match'::text);

create table if not exists public.card_accumulations (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  player_id uuid,
  league_config_id uuid,
  yellow_count integer default 0,
  updated_at timestamp with time zone default now(),
  player_uuid uuid,
  constraint card_accumulations_pkey primary key (id),
  constraint card_accumulations_club_id_player_id_league_config_id_key UNIQUE (club_id, player_id, league_config_id)
);
CREATE INDEX card_acc_club_player_idx ON public.card_accumulations USING btree (club_id, player_id);

create table if not exists public.card_templates (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text not null,
  config jsonb not null,
  source text default 'builder'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint card_templates_pkey primary key (id),
  constraint cfg_schema CHECK (((config ->> 'schema'::text) = 'gp.card/v1'::text))
);

create table if not exists public.channel_reads (
  user_id uuid not null,
  channel_key text not null,
  club_id uuid not null,
  last_read_at timestamp with time zone default now() not null,
  team_id uuid,
  constraint channel_reads_pkey primary key (user_id, channel_key, club_id)
);
CREATE INDEX idx_channel_reads_team ON public.channel_reads USING btree (team_id);

create table if not exists public.club_branding (
  club_id uuid not null,
  crest_url text,
  crest_dark_url text,
  primary_color text,
  accent_color text,
  hashtag text default '#Clava'::text,
  updated_at timestamp with time zone default now(),
  constraint club_branding_pkey primary key (club_id)
);

create table if not exists public.club_gps_settings (
  club_id uuid not null,
  baseline_n integer default 5 not null,
  baseline_mode text default 'personal'::text not null,
  active_metrics text[] default ARRAY['total_distance'::text, 'high_speed_distance'::text, 'sprint_distance'::text, 'max_speed'::text, 'accelerations'::text, 'player_load'::text],
  updated_at timestamp with time zone default now(),
  gps_builder_enabled boolean default true not null,
  acwr_model text default 'ewma'::text not null,
  include_archived boolean default false not null,
  constraint club_gps_settings_pkey primary key (club_id),
  constraint club_gps_settings_baseline_n_check CHECK (((baseline_n >= 3) AND (baseline_n <= 10))),
  constraint club_gps_settings_baseline_mode_check CHECK ((baseline_mode = ANY (ARRAY['personal'::text, 'position'::text]))),
  constraint club_gps_settings_acwr_model_check CHECK ((acwr_model = ANY (ARRAY['ra'::text, 'ewma'::text])))
);

create table if not exists public.club_modules (
  club_id uuid not null,
  module_key text not null,
  enabled boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  constraint club_modules_pkey primary key (club_id, module_key)
);

create table if not exists public.club_settings (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  module_key text not null,
  enabled boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  season_start date,
  season_end date,
  season_name text,
  competition text,
  constraint club_settings_pkey primary key (id),
  constraint club_settings_club_id_module_key_key UNIQUE (club_id, module_key)
);

create table if not exists public.clubs (
  id uuid default gen_random_uuid() not null,
  name text not null,
  logo_url text,
  primary_color text default '#000000'::text,
  secondary_color text default '#FFFFFF'::text,
  country text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sport text,
  plan text default 'free'::text,
  stripe_customer_id text,
  billing_amount_cents integer,
  billing_next_date date,
  billing_card_last4 text,
  description text,
  billing_plan text,
  billing_amount numeric(10,2),
  billing_status text,
  billing_stripe_customer_id text,
  billing_provider text,
  billing_provider_customer_id text,
  constraint clubs_pkey primary key (id),
  constraint clubs_billing_status_check CHECK ((billing_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'trialing'::text, 'paused'::text]))),
  constraint clubs_billing_provider_check CHECK ((billing_provider = 'paddle'::text))
);
CREATE INDEX clubs_id_idx ON public.clubs USING btree (id);
CREATE UNIQUE INDEX idx_clubs_provider_customer ON public.clubs USING btree (billing_provider_customer_id) WHERE (billing_provider_customer_id IS NOT NULL);

create table if not exists public.competitions (
  id uuid default gen_random_uuid() not null,
  season_id uuid not null,
  name text not null,
  comp_type text default 'league'::text not null,
  color text default '#534AB7'::text not null,
  created_at timestamp with time zone default now(),
  constraint competitions_pkey primary key (id),
  constraint competitions_comp_type_check CHECK ((comp_type = ANY (ARRAY['league'::text, 'cup'::text, 'international'::text, 'friendly'::text, 'supercup'::text])))
);
CREATE INDEX idx_competitions_season ON public.competitions USING btree (season_id);

create table if not exists public.dashboard_cards (
  id uuid default gen_random_uuid() not null,
  dashboard_id uuid not null,
  config jsonb not null,
  size text default 'md'::text not null,
  position integer default 0 not null,
  source text default 'builder'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint dashboard_cards_pkey primary key (id),
  constraint dashboard_cards_size_check CHECK ((size = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text, 'full'::text]))),
  constraint dashboard_cards_source_check CHECK ((source = ANY (ARRAY['catalog'::text, 'builder'::text, 'ai'::text]))),
  constraint cfg_schema CHECK (((config ->> 'schema'::text) = 'gp.card/v1'::text))
);
CREATE INDEX idx_dashboard_cards_pos ON public.dashboard_cards USING btree (dashboard_id, "position");

create table if not exists public.dashboards (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  owner_id uuid,
  report_type text,
  name text not null,
  scope text default 'player'::text not null,
  sort_order integer default 0 not null,
  is_shared boolean default false not null,
  team_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint dashboards_pkey primary key (id),
  constraint dashboards_team_fk foreign key (team_id) references public.teams(id) on delete set null,
  constraint dashboards_scope_check CHECK ((scope = ANY (ARRAY['player'::text, 'squad'::text])))
);
CREATE INDEX idx_dashboards_club ON public.dashboards USING btree (club_id, sort_order);

create table if not exists public.default_exercises (
  default_key text not null,
  name text not null,
  category text not null,
  muscle_group text,
  complexity text,
  equipment text,
  usable_in text[] not null,
  description text,
  primary_purpose text,
  purposes text[],
  equipment_tags text[],
  muscle_groups text[],
  movement_patterns text[],
  myofascial_chains text[],
  contraction_types text[],
  movement_speeds text[],
  planes text[],
  constraint default_exercises_pkey primary key (default_key),
  constraint default_exercises_complexity_check CHECK ((complexity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text])))
);

create table if not exists public.dossier_templates (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  created_by uuid,
  name text not null,
  config jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint dossier_templates_pkey primary key (id)
);
CREATE INDEX dossier_templates_club_idx ON public.dossier_templates USING btree (club_id);

create table if not exists public.drills (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  session_id uuid,
  name text default 'Untitled drill'::text not null,
  duration integer,
  objects_json jsonb,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint drills_pkey primary key (id)
);
CREATE INDEX drills_club_id_idx ON public.drills USING btree (club_id);
CREATE INDEX drills_session_id_idx ON public.drills USING btree (session_id);

create table if not exists public.evaluations (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  evaluation_type text not null,
  test_date date not null,
  value numeric(10,4) not null,
  unit text not null,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  test_name text,
  test_type text,
  title text,
  constraint evaluations_pkey primary key (id)
);
CREATE INDEX evaluations_player_id_idx ON public.evaluations USING btree (player_id);
CREATE INDEX evaluations_club_id_idx ON public.evaluations USING btree (club_id);
CREATE INDEX evaluations_type_idx ON public.evaluations USING btree (club_id, evaluation_type);
CREATE INDEX evaluations_date_idx ON public.evaluations USING btree (test_date DESC);

create table if not exists public.exercise_drills (
  id uuid default gen_random_uuid() not null,
  exercise_id uuid not null,
  club_id uuid not null,
  name text not null,
  duration integer,
  notes text,
  position integer default 0,
  created_at timestamp with time zone default now(),
  constraint exercise_drills_pkey primary key (id)
);

create table if not exists public.exercises (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text default 'New exercise'::text not null,
  players_count integer default 0,
  field_width numeric(6,1) default 0,
  field_height numeric(6,1) default 0,
  duration integer default 0,
  series integer default 1,
  work_time text default '3:00'::text,
  rest_time text default '1:30'::text,
  dose_mode text default 'interval'::text,
  reps integer,
  orientation text,
  objects_json jsonb,
  created_by uuid,
  created_at timestamp with time zone default now(),
  match_day integer,
  intensity text,
  focus text[],
  game_type_enabled boolean default false,
  game_type text,
  objective text,
  description text,
  visible_teams uuid[],
  preview_svg text,
  preview_png text,
  preview_path text,
  source_type text default 'canvas'::text not null,
  folder_id uuid,
  is_goalkeeper boolean default false not null,
  constraint exercises_pkey primary key (id),
  constraint exercises_orientation_check CHECK ((orientation = ANY (ARRAY['ACTIVATION'::text, 'STRENGTH'::text, 'VELOCITY'::text, 'ENDURANCE'::text]))),
  constraint exercises_intensity_check CHECK ((intensity = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'VERY_HIGH'::text]))),
  constraint exercises_game_type_check CHECK ((game_type = ANY (ARRAY['SSG'::text, 'MSG'::text, 'LSG'::text]))),
  constraint exercises_source_type_check CHECK ((source_type = ANY (ARRAY['canvas'::text, 'image'::text]))),
  constraint exercises_dose_mode_check CHECK ((dose_mode = ANY (ARRAY['interval'::text, 'reps'::text, 'minutes'::text])))
);

-- Folders/subfolders to organize the exercise libraries (field + gym).
-- kind separates the two libraries into distinct trees. parent_id gives free N-level nesting.
-- team_id NULL = folder shared across all categories; a team id = folder private to that team (field only).
create table if not exists public.exercise_folders (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  parent_id uuid,
  kind text default 'field'::text not null,
  name text not null,
  position integer default 0,
  created_at timestamp with time zone default now(),
  constraint exercise_folders_pkey primary key (id),
  constraint exercise_folders_kind_check CHECK ((kind = ANY (ARRAY['field'::text, 'gym'::text]))),
  constraint exercise_folders_parent_fk foreign key (parent_id) references public.exercise_folders(id) on delete cascade,
  constraint exercise_folders_team_fk foreign key (team_id) references public.teams(id) on delete cascade
);
CREATE INDEX IF NOT EXISTS exercise_folders_club_kind_idx ON public.exercise_folders USING btree (club_id, kind);
CREATE INDEX IF NOT EXISTS exercise_folders_parent_idx ON public.exercise_folders USING btree (parent_id);
alter table public.exercises add constraint exercises_folder_fk foreign key (folder_id) references public.exercise_folders(id) on delete set null;

create table if not exists public.foods (
  id uuid default gen_random_uuid() not null,
  name text not null,
  category text,
  kcal numeric not null,
  protein_g numeric default 0 not null,
  carbs_g numeric default 0 not null,
  fats_g numeric default 0 not null,
  fiber_g numeric default 0,
  default_unit text default 'g'::text,
  per_unit_grams numeric,
  source text,
  is_verified boolean default false,
  created_at timestamp with time zone default now(),
  constraint foods_pkey primary key (id),
  constraint foods_category_check CHECK ((category = ANY (ARRAY['protein'::text, 'carb'::text, 'fat'::text, 'vegetable'::text, 'fruit'::text, 'dairy'::text, 'supplement'::text, 'other'::text]))),
  constraint foods_default_unit_check CHECK ((default_unit = ANY (ARRAY['g'::text, 'ml'::text, 'unit'::text])))
);
CREATE INDEX idx_foods_category ON public.foods USING btree (category);
CREATE INDEX idx_foods_name ON public.foods USING btree (lower(name));

create table if not exists public.force_column_mappings (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  source_label text not null,
  source_column_name text not null,
  target_metric_key text not null,
  unit_conversion numeric default 1.0,
  updated_at timestamp with time zone default now() not null,
  constraint force_column_mappings_pkey primary key (id),
  constraint force_column_mappings_club_id_source_label_source_column_na_key UNIQUE (club_id, source_label, source_column_name)
);
CREATE INDEX idx_force_col_map_club ON public.force_column_mappings USING btree (club_id);

create table if not exists public.force_metric_definitions (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  key text not null,
  label text not null,
  unit text,
  category text default 'custom'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint force_metric_definitions_pkey primary key (id),
  constraint force_metric_definitions_key_check CHECK ((key ~ '^[a-z][a-z0-9_]*$'::text)),
  constraint force_metric_definitions_category_check CHECK ((category = ANY (ARRAY['jump'::text, 'force'::text, 'power'::text, 'velocity'::text, 'time'::text, 'asymmetry'::text, 'count'::text, 'custom'::text])))
);
CREATE UNIQUE INDEX uq_force_metric_global ON public.force_metric_definitions USING btree (key) WHERE (club_id IS NULL);
CREATE UNIQUE INDEX uq_force_metric_club ON public.force_metric_definitions USING btree (club_id, key) WHERE (club_id IS NOT NULL);

create table if not exists public.force_test_metrics (
  id uuid default gen_random_uuid() not null,
  test_id uuid not null,
  club_id uuid not null,
  metric_key text not null,
  value numeric,
  side text,
  unit text,
  constraint force_test_metrics_pkey primary key (id),
  constraint force_test_metrics_side_check CHECK ((side = ANY (ARRAY['L'::text, 'R'::text])))
);
CREATE UNIQUE INDEX uq_force_test_metric ON public.force_test_metrics USING btree (test_id, metric_key, COALESCE(side, ''::text));
CREATE INDEX idx_force_test_metrics_key ON public.force_test_metrics USING btree (club_id, metric_key);
CREATE INDEX idx_force_test_metrics_test ON public.force_test_metrics USING btree (test_id);

create table if not exists public.force_tests (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  player_id uuid not null,
  test_type text not null,
  test_date date not null,
  test_time text,
  bodyweight_kg numeric,
  reps integer,
  tags text,
  source text default 'csv'::text not null,
  external_id text,
  notes text,
  uploaded_by uuid not null,
  uploaded_by_name text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint force_tests_pkey primary key (id)
);
CREATE INDEX idx_force_tests_club ON public.force_tests USING btree (club_id);
CREATE INDEX idx_force_tests_team ON public.force_tests USING btree (team_id);
CREATE INDEX idx_force_tests_player ON public.force_tests USING btree (player_id);
CREATE INDEX idx_force_tests_type_date ON public.force_tests USING btree (club_id, test_type, test_date);

create table if not exists public.gps_column_mappings (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  source_label text not null,
  source_column_name text not null,
  target_metric text not null,
  unit_conversion numeric default 1.0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  parse_format text,
  column_type text,
  excluded boolean default false,
  constraint gps_column_mappings_pkey primary key (id),
  constraint gps_column_mappings_club_id_source_label_source_column_name_key UNIQUE (club_id, source_label, source_column_name)
);
CREATE INDEX idx_gps_mappings_club ON public.gps_column_mappings USING btree (club_id);

create table if not exists public.gps_dashboard_layouts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  club_id uuid not null,
  dashboard_id text not null,
  layout jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  locked boolean default false not null,
  constraint gps_dashboard_layouts_pkey primary key (id),
  constraint gps_dashboard_layouts_user_id_club_id_dashboard_id_key UNIQUE (user_id, club_id, dashboard_id)
);

create table if not exists public.gps_drill_map (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  period_name text not null,
  exercise_id uuid,
  ignored boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint gps_drill_map_pkey primary key (id),
  constraint gps_drill_map_club_id_period_name_key UNIQUE (club_id, period_name)
);
CREATE INDEX idx_gps_drill_map_club ON public.gps_drill_map USING btree (club_id);
CREATE INDEX idx_gps_drill_map_exercise ON public.gps_drill_map USING btree (club_id, exercise_id);

create table if not exists public.gps_integration_secrets (
  integration_id uuid not null,
  credential text not null,
  set_at timestamp with time zone default now(),
  constraint gps_integration_secrets_pkey primary key (integration_id)
);

create table if not exists public.gps_integrations (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  provider text not null,
  status text default 'pending'::text not null,
  external_account_id text,
  config jsonb default '{}'::jsonb not null,
  connected_at timestamp with time zone,
  last_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint gps_integrations_pkey primary key (id),
  constraint gps_integrations_club_id_provider_key UNIQUE (club_id, provider),
  constraint gps_integrations_provider_check CHECK ((provider = ANY (ARRAY['catapult'::text, 'statsports'::text]))),
  constraint gps_integrations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'configured'::text, 'connected'::text, 'error'::text, 'disabled'::text])))
);
CREATE INDEX idx_gps_integrations_club ON public.gps_integrations USING btree (club_id);

create table if not exists public.gps_metric_definitions (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  key text not null,
  label text not null,
  unit text,
  category text default 'custom'::text not null,
  description text,
  decimals integer default 2 not null,
  is_core boolean default false not null,
  display_order integer default 100,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  kind text,
  squad_rollup boolean default true not null,
  constraint gps_metric_definitions_pkey primary key (id),
  constraint gps_metric_definitions_club_id_key_key UNIQUE (club_id, key),
  constraint gps_metric_definitions_key_check CHECK ((key ~ '^[a-z][a-z0-9_]*$'::text)),
  constraint gps_metric_definitions_category_check CHECK ((category = ANY (ARRAY['distance'::text, 'speed'::text, 'acceleration'::text, 'load'::text, 'time'::text, 'count'::text, 'custom'::text]))),
  constraint gps_metric_definitions_decimals_check CHECK (((decimals >= 0) AND (decimals <= 4))),
  constraint gps_metric_definitions_kind_check CHECK ((kind = ANY (ARRAY['accum'::text, 'peak'::text])))
);
CREATE INDEX idx_gps_metric_def_club ON public.gps_metric_definitions USING btree (club_id);

create table if not exists public.gps_period_reports (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  session_id uuid not null,
  player_id uuid not null,
  period_id text not null,
  period_name text,
  duration_seconds numeric,
  total_distance numeric,
  high_speed_distance numeric,
  very_high_speed_distance numeric,
  sprint_distance numeric,
  sprint_count numeric,
  accelerations numeric,
  decelerations numeric,
  max_speed numeric,
  avg_speed numeric,
  player_load numeric,
  hmld numeric,
  time_played numeric,
  distance_per_minute numeric,
  extra_metrics jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  is_flagged boolean default false not null,
  flag_reason text,
  constraint gps_period_reports_pkey primary key (id),
  constraint gps_period_reports_club_id_session_id_period_id_player_id_key UNIQUE (club_id, session_id, period_id, player_id)
);
CREATE INDEX idx_gps_period_reports_session ON public.gps_period_reports USING btree (club_id, session_id);
CREATE INDEX idx_gps_period_reports_player ON public.gps_period_reports USING btree (club_id, player_id);
CREATE INDEX idx_gps_period_reports_period ON public.gps_period_reports USING btree (club_id, period_id);

create table if not exists public.gps_report_metrics (
  id uuid default gen_random_uuid() not null,
  report_id uuid not null,
  club_id uuid not null,
  metric_key text not null,
  value numeric,
  created_at timestamp with time zone default now(),
  constraint gps_report_metrics_pkey primary key (id),
  constraint gps_report_metrics_report_id_metric_key_key UNIQUE (report_id, metric_key)
);
CREATE INDEX idx_gps_rm_report ON public.gps_report_metrics USING btree (report_id);
CREATE INDEX idx_gps_rm_club_metric ON public.gps_report_metrics USING btree (club_id, metric_key);
CREATE INDEX idx_gps_rm_club_key_report ON public.gps_report_metrics USING btree (club_id, metric_key, report_id);

create table if not exists public.gps_reports (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  session_id uuid not null,
  club_id uuid not null,
  total_distance numeric(10,2),
  high_speed_distance numeric(10,2),
  sprint_distance numeric(10,2),
  accelerations numeric(10,2),
  decelerations numeric(10,2),
  max_speed numeric(10,2),
  player_load numeric(10,2),
  avg_speed numeric(10,2),
  created_at timestamp with time zone default now(),
  very_high_speed_distance numeric,
  hmld numeric,
  time_played integer,
  sprint_count integer,
  distance_per_minute numeric,
  updated_at timestamp with time zone default now(),
  is_invalid boolean default false not null,
  constraint gps_reports_pkey primary key (id),
  constraint gps_reports_player_id_session_id_key UNIQUE (player_id, session_id)
);
CREATE INDEX gps_reports_player_id_idx ON public.gps_reports USING btree (player_id);
CREATE INDEX gps_reports_session_id_idx ON public.gps_reports USING btree (session_id);
CREATE INDEX gps_reports_club_id_idx ON public.gps_reports USING btree (club_id);
CREATE INDEX gps_reports_created_idx ON public.gps_reports USING btree (created_at DESC);
CREATE INDEX idx_gps_reports_club_session ON public.gps_reports USING btree (club_id, session_id);
CREATE INDEX idx_gps_reports_session ON public.gps_reports USING btree (session_id, player_id);

create table if not exists public.gps_sync_jobs (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  integration_id uuid not null,
  status text default 'queued'::text not null,
  range_from date not null,
  range_to date not null,
  cursor_from date,
  cursor_to date,
  chunks_total integer default 0 not null,
  chunks_done integer default 0 not null,
  totals jsonb default '{}'::jsonb not null,
  error text,
  created_by uuid,
  started_at timestamp with time zone,
  heartbeat_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint gps_sync_jobs_pkey primary key (id),
  constraint gps_sync_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'error'::text, 'cancelled'::text])))
);
CREATE INDEX gps_sync_jobs_club_idx ON public.gps_sync_jobs USING btree (club_id, created_at DESC);
CREATE UNIQUE INDEX gps_sync_jobs_one_active ON public.gps_sync_jobs USING btree (integration_id) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));

create table if not exists public.gym_exercises (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text not null,
  category text,
  muscle_group text,
  description text,
  video_url text,
  created_at timestamp with time zone default now(),
  complexity text,
  equipment text,
  usable_in text[] default ARRAY['gym'::text] not null,
  is_default boolean default false not null,
  default_key text,
  media_type text,
  media_ref text,
  primary_purpose text,
  purposes text[],
  equipment_tags text[],
  muscle_groups text[],
  movement_patterns text[],
  myofascial_chains text[],
  contraction_types text[],
  movement_speeds text[],
  planes text[],
  video_id text,
  source text,
  folder_id uuid,
  constraint gym_exercises_pkey primary key (id),
  constraint gym_exercises_folder_fk foreign key (folder_id) references public.exercise_folders(id) on delete set null,
  constraint gym_exercises_complexity_check CHECK ((complexity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text]))),
  constraint gym_exercises_media_type_check CHECK (((media_type IS NULL) OR (media_type = ANY (ARRAY['image'::text, 'youtube'::text]))))
);
CREATE UNIQUE INDEX gym_exercises_default_uq ON public.gym_exercises USING btree (club_id, default_key) WHERE (default_key IS NOT NULL);
CREATE INDEX gym_exercises_purposes_gin ON public.gym_exercises USING gin (purposes);
CREATE INDEX gym_exercises_equipment_tags_gin ON public.gym_exercises USING gin (equipment_tags);
CREATE INDEX gym_exercises_muscle_groups_gin ON public.gym_exercises USING gin (muscle_groups);
CREATE INDEX gym_exercises_movement_patterns_gin ON public.gym_exercises USING gin (movement_patterns);
CREATE INDEX gym_exercises_myofascial_gin ON public.gym_exercises USING gin (myofascial_chains);
CREATE INDEX gym_exercises_contraction_gin ON public.gym_exercises USING gin (contraction_types);
CREATE INDEX gym_exercises_speeds_gin ON public.gym_exercises USING gin (movement_speeds);
CREATE INDEX gym_exercises_planes_gin ON public.gym_exercises USING gin (planes);
CREATE INDEX gym_exercises_primary_purpose_idx ON public.gym_exercises USING btree (primary_purpose);
CREATE UNIQUE INDEX gym_exercises_club_video_uq ON public.gym_exercises USING btree (club_id, video_id);

create table if not exists public.gym_session_templates (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text not null,
  content jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint gym_session_templates_pkey primary key (id)
);
CREATE INDEX idx_gym_templates_club ON public.gym_session_templates USING btree (club_id);

create table if not exists public.individual_block_completions (
  id uuid default gen_random_uuid() not null,
  block_id uuid not null,
  player_id uuid not null,
  completed_at timestamp with time zone default now(),
  scheduled_date date not null,
  rpe integer,
  notes text,
  constraint individual_block_completions_pkey primary key (id),
  constraint individual_block_completions_block_id_player_id_scheduled_d_key UNIQUE (block_id, player_id, scheduled_date),
  constraint individual_block_completions_rpe_check CHECK (((rpe >= 1) AND (rpe <= 10)))
);
CREATE INDEX idx_ibc_player_date ON public.individual_block_completions USING btree (player_id, scheduled_date DESC);

create table if not exists public.individual_plan_blocks (
  id uuid default gen_random_uuid() not null,
  plan_id uuid not null,
  day_of_week integer,
  week_index integer default 0,
  block_type text not null,
  title text not null,
  description text,
  duration_min integer,
  exercises jsonb default '[]'::jsonb,
  intensity text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint individual_plan_blocks_pkey primary key (id),
  constraint individual_plan_blocks_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
  constraint individual_plan_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['warmup'::text, 'strength'::text, 'power'::text, 'plyo'::text, 'speed'::text, 'mobility'::text, 'cardio'::text, 'cooldown'::text, 'technical'::text]))),
  constraint individual_plan_blocks_intensity_check CHECK ((intensity = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'max'::text])))
);
CREATE INDEX idx_ipb_plan ON public.individual_plan_blocks USING btree (plan_id);
CREATE INDEX idx_ipb_plan_week ON public.individual_plan_blocks USING btree (plan_id, week_index, day_of_week, sort_order);

create table if not exists public.individual_plan_phases (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  plan_id uuid not null,
  name text not null,
  week_start integer default 1 not null,
  week_end integer default 1 not null,
  color text,
  objective text,
  load_level text,
  phase_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint individual_plan_phases_pkey primary key (id)
);
CREATE INDEX idx_ip_phases_club ON public.individual_plan_phases USING btree (club_id);
CREATE INDEX idx_ip_phases_plan ON public.individual_plan_phases USING btree (plan_id);

create table if not exists public.individual_plans (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  name text not null,
  description text,
  focus text,
  start_date date,
  end_date date,
  status text default 'draft'::text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  goal text,
  programme_week integer default 1,
  programme_total_weeks integer default 1,
  content jsonb default '{}'::jsonb not null,
  share_token uuid default gen_random_uuid(),
  shared boolean default false not null,
  constraint individual_plans_pkey primary key (id),
  constraint individual_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text, 'archived'::text])))
);
CREATE INDEX idx_individual_plans_club ON public.individual_plans USING btree (club_id);
CREATE INDEX idx_individual_plans_player ON public.individual_plans USING btree (player_id);
CREATE INDEX idx_individual_plans_status ON public.individual_plans USING btree (status);
CREATE UNIQUE INDEX idx_individual_plans_share_token ON public.individual_plans USING btree (share_token);

create table if not exists public.injuries (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  injury_type text not null,
  body_area text not null,
  severity text not null,
  status text default 'active'::text not null,
  start_date date not null,
  expected_return date,
  returned_date date,
  treatment text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid,
  mechanism text,
  bamic_grade text,
  injury_mechanism text,
  injury_category text,
  sub_classification text,
  constraint injuries_pkey primary key (id),
  constraint injuries_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'severe'::text]))),
  constraint injuries_injury_mechanism_check CHECK ((injury_mechanism = ANY (ARRAY['contact'::text, 'non_contact'::text, 'overuse'::text, 'unknown'::text]))),
  constraint injuries_injury_category_check CHECK ((injury_category = ANY (ARRAY['muscular'::text, 'acl'::text, 'ligament'::text, 'tendon'::text, 'bone'::text, 'other'::text]))),
  constraint injuries_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cleared'::text, 'returning'::text])))
);
CREATE INDEX injuries_player_id_idx ON public.injuries USING btree (player_id);
CREATE INDEX injuries_club_id_idx ON public.injuries USING btree (club_id);
CREATE INDEX injuries_status_idx ON public.injuries USING btree (club_id, status);
CREATE INDEX injuries_date_idx ON public.injuries USING btree (start_date DESC);

create table if not exists public.injury_phases (
  id uuid default gen_random_uuid() not null,
  injury_id uuid not null,
  phase_number integer not null,
  phase_name text not null,
  phase_type text,
  start_date date,
  end_date date,
  actual_start date,
  actual_end date,
  status text default 'pending'::text not null,
  criteria text,
  criteria_met boolean default false not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  criteria_items jsonb,
  criteria_completed jsonb,
  revert_log jsonb,
  completed_by uuid,
  duration_days integer default (end_date - start_date),
  club_id uuid,
  constraint injury_phases_pkey primary key (id),
  constraint injury_phases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'done'::text, 'skipped'::text])))
);
CREATE INDEX injury_phases_injury_id_idx ON public.injury_phases USING btree (injury_id);
CREATE INDEX idx_injury_phases_injury ON public.injury_phases USING btree (injury_id, phase_number);

create table if not exists public.invitations (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  email text not null,
  role text default 'staff'::text not null,
  status text default 'pending'::text not null,
  invited_by uuid,
  created_at timestamp with time zone default now() not null,
  team_ids uuid[],
  constraint invitations_pkey primary key (id),
  constraint invitations_club_id_email_key UNIQUE (club_id, email),
  constraint invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'coach'::text, 'physio'::text, 'analyst'::text, 'nutritionist'::text, 'staff'::text, 'sc_coach'::text, 'fitness_coach'::text, 'gk_coach'::text, 'assistant_coach'::text])))
);

create table if not exists public.invoices (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  subscription_id uuid,
  invoice_number text,
  provider_invoice_id text,
  amount numeric(10,2) not null,
  currency text default 'USD'::text,
  status text default 'pending'::text,
  paid_at timestamp with time zone,
  due_date date,
  invoice_url text,
  pdf_url text,
  created_at timestamp with time zone default now(),
  constraint invoices_pkey primary key (id),
  constraint invoices_provider_invoice_id_key UNIQUE (provider_invoice_id),
  constraint invoices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'void'::text])))
);
CREATE INDEX idx_invoices_club ON public.invoices USING btree (club_id);
CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);
CREATE INDEX idx_invoices_created ON public.invoices USING btree (created_at DESC);

create table if not exists public.league_configs (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  name text not null,
  season text default '2025/26'::text,
  yellow_threshold integer default 5,
  yellow_ban_games integer default 1,
  red_direct_games integer default 2,
  red_serious_games integer default 3,
  reset_date date,
  active boolean default true,
  created_at timestamp with time zone default now(),
  constraint league_configs_pkey primary key (id)
);
CREATE INDEX league_configs_club_idx ON public.league_configs USING btree (club_id);

create table if not exists public.lineup_players (
  id uuid default gen_random_uuid() not null,
  lineup_id uuid not null,
  player_id uuid not null,
  role text default 'starter'::text not null,
  slot_index integer,
  x_pct numeric(5,2),
  y_pct numeric(5,2),
  is_captain boolean default false,
  is_vice_captain boolean default false,
  notes text,
  created_at timestamp with time zone default now(),
  constraint lineup_players_pkey primary key (id),
  constraint lineup_players_lineup_id_player_id_role_key UNIQUE (lineup_id, player_id, role),
  constraint uq_lineup_players_slot UNIQUE (lineup_id, role, slot_index),
  constraint lineup_players_role_check CHECK ((role = ANY (ARRAY['starter'::text, 'substitute'::text, 'reserve'::text, 'injured'::text]))),
  constraint lineup_players_x_pct_check CHECK (((x_pct IS NULL) OR ((x_pct >= (0)::numeric) AND (x_pct <= (100)::numeric)))),
  constraint lineup_players_y_pct_check CHECK (((y_pct IS NULL) OR ((y_pct >= (0)::numeric) AND (y_pct <= (100)::numeric))))
);
CREATE UNIQUE INDEX uq_lineup_players_captain ON public.lineup_players USING btree (lineup_id) WHERE (is_captain = true);
CREATE INDEX idx_lineup_players_role ON public.lineup_players USING btree (lineup_id, role, slot_index);

create table if not exists public.lineup_staff (
  id uuid default gen_random_uuid() not null,
  lineup_id uuid not null,
  profile_id uuid,
  display_name text not null,
  role_code text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint lineup_staff_pkey primary key (id),
  constraint lineup_staff_role_code_check CHECK ((role_code = ANY (ARRAY['head'::text, 'assistant'::text, 'gk_coach'::text, 'fitness'::text, 'physio'::text, 'analyst'::text, 'other'::text])))
);
CREATE INDEX idx_lineup_staff_lineup ON public.lineup_staff USING btree (lineup_id, sort_order);

create table if not exists public.lineups (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  match_id uuid,
  formation text not null,
  players jsonb,
  subs jsonb,
  title text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  rival_crest_url text,
  match_data jsonb,
  microcycle_id text,
  status text default 'draft'::text,
  published_at timestamp with time zone,
  published_by uuid,
  poster_style text default 'editorial'::text,
  language text default 'es'::text,
  style_config jsonb default '{}'::jsonb,
  constraint lineups_pkey primary key (id),
  constraint lineups_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'locked'::text, 'official'::text, 'archived'::text]))),
  constraint lineups_poster_style_check CHECK ((poster_style = ANY (ARRAY['editorial'::text, 'stadium'::text, 'magazine'::text, 'ticket'::text]))),
  constraint lineups_language_check CHECK ((language = ANY (ARRAY['es'::text, 'en'::text, 'pt'::text])))
);
CREATE INDEX lineups_club_created_idx ON public.lineups USING btree (club_id, created_at DESC);
CREATE INDEX idx_lineups_microcycle ON public.lineups USING btree (microcycle_id);
CREATE INDEX idx_lineups_status ON public.lineups USING btree (status);
CREATE INDEX idx_lineups_match_st ON public.lineups USING btree (match_id, status);

create table if not exists public.load_templates (
  id uuid default gen_random_uuid() not null,
  mesocycle_id uuid not null,
  model text,
  distribution jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint load_templates_pkey primary key (id),
  constraint load_templates_mesocycle_id_key UNIQUE (mesocycle_id)
);
CREATE INDEX idx_load_templates_meso ON public.load_templates USING btree (mesocycle_id);

create table if not exists public.macrocycles (
  id uuid default gen_random_uuid() not null,
  season_id uuid not null,
  name text not null,
  objective text,
  start_date date not null,
  end_date date not null,
  color text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint macrocycles_pkey primary key (id)
);
CREATE INDEX idx_macrocycles_season ON public.macrocycles USING btree (season_id);

create table if not exists public.match_reports (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  session_id uuid,
  match_date date not null,
  competition text,
  league_config_id uuid,
  opponent text not null,
  venue text default 'home'::text,
  score_us integer,
  score_them integer,
  score_ht_us integer,
  score_ht_them integer,
  formation_us text,
  formation_them text,
  goals jsonb default '[]'::jsonb,
  cards jsonb default '[]'::jsonb,
  subs jsonb default '[]'::jsonb,
  possession_us integer,
  shots_on integer,
  shots_off integer,
  shots_blocked integer,
  xg numeric(5,2),
  corners integer,
  fouls integer,
  offsides integer,
  ratings jsonb default '{}'::jsonb,
  coach_notes text,
  source text default 'manual'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  venue_capacity integer,
  added_time integer,
  weather text,
  tackles integer,
  pass_accuracy_us integer,
  pass_accuracy_them integer,
  positions jsonb default '[]'::jsonb,
  constraint match_reports_pkey primary key (id),
  constraint match_reports_venue_check CHECK ((venue = ANY (ARRAY['home'::text, 'away'::text, 'neutral'::text]))),
  constraint match_reports_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'wyscout'::text, 'tracab'::text, 'other'::text])))
);
CREATE INDEX match_reports_club_date_idx ON public.match_reports USING btree (club_id, match_date DESC);
CREATE INDEX match_reports_session_idx ON public.match_reports USING btree (session_id);

create table if not exists public.match_results (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  session_id uuid,
  match_date date not null,
  competition text,
  opponent text,
  home_away text,
  score_for integer,
  score_against integer,
  possession numeric,
  formation text,
  venue text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint match_results_pkey primary key (id),
  constraint match_results_home_away_check CHECK ((home_away = ANY (ARRAY['home'::text, 'away'::text])))
);
CREATE UNIQUE INDEX ux_match_results_session ON public.match_results USING btree (session_id) WHERE (session_id IS NOT NULL);
CREATE INDEX idx_match_results_club_team_date ON public.match_results USING btree (club_id, team_id, match_date);

create table if not exists public.match_shots (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  match_id uuid,
  player_id uuid,
  team text not null,
  minute integer,
  outcome text not null,
  x_pct numeric(5,2),
  y_pct numeric(5,2),
  xg numeric(5,3),
  notes text,
  created_at timestamp with time zone default now(),
  constraint match_shots_pkey primary key (id),
  constraint match_shots_team_check CHECK ((team = ANY (ARRAY['us'::text, 'them'::text]))),
  constraint match_shots_outcome_check CHECK ((outcome = ANY (ARRAY['goal'::text, 'on_target'::text, 'off_target'::text, 'blocked'::text])))
);
CREATE INDEX match_shots_match_idx ON public.match_shots USING btree (match_id);
CREATE INDEX match_shots_club_idx ON public.match_shots USING btree (club_id);

create table if not exists public.meal_plan_items (
  id uuid default gen_random_uuid() not null,
  meal_id uuid not null,
  food_id uuid not null,
  quantity_g numeric not null,
  note text,
  constraint meal_plan_items_pkey primary key (id)
);
CREATE INDEX idx_meal_plan_items_meal ON public.meal_plan_items USING btree (meal_id);
CREATE INDEX idx_meal_plan_items_food ON public.meal_plan_items USING btree (food_id);

create table if not exists public.meal_plan_meals (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  meal_order integer default 0 not null,
  name text not null,
  time_hint text,
  constraint meal_plan_meals_pkey primary key (id)
);
CREATE INDEX idx_meal_plan_meals_template ON public.meal_plan_meals USING btree (template_id);

create table if not exists public.meal_plan_templates (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text not null,
  day_type text,
  base_kcal numeric,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint meal_plan_templates_pkey primary key (id),
  constraint meal_plan_templates_day_type_check CHECK ((day_type = ANY (ARRAY['MD'::text, 'MD-1'::text, 'MD-2'::text, 'MD-3'::text, 'MD+1'::text, 'rest'::text, 'custom'::text])))
);
CREATE INDEX idx_meal_plan_templates_club ON public.meal_plan_templates USING btree (club_id);

create table if not exists public.medical_documents (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  type text default 'report'::text not null,
  title text not null,
  file_path text,
  doc_date date,
  uploaded_by uuid,
  notes text,
  created_at timestamp with time zone default now() not null,
  constraint medical_documents_pkey primary key (id),
  constraint medical_documents_type_check CHECK ((type = ANY (ARRAY['report'::text, 'consent'::text, 'certificate'::text, 'insurance'::text, 'other'::text])))
);
CREATE INDEX idx_mdoc_club ON public.medical_documents USING btree (club_id);
CREATE INDEX idx_mdoc_player ON public.medical_documents USING btree (player_id, doc_date DESC);

create table if not exists public.medical_episodes (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  category text default 'illness'::text not null,
  system text,
  diagnosis text not null,
  start_date date not null,
  end_date date,
  days_lost integer,
  status text default 'active'::text not null,
  detail jsonb,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  constraint medical_episodes_pkey primary key (id),
  constraint medical_episodes_category_check CHECK ((category = ANY (ARRAY['illness'::text, 'concussion'::text, 'other'::text]))),
  constraint medical_episodes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'monitoring'::text, 'resolved'::text])))
);
CREATE INDEX idx_mepi_club ON public.medical_episodes USING btree (club_id);
CREATE INDEX idx_mepi_player ON public.medical_episodes USING btree (player_id, start_date DESC);

create table if not exists public.medical_screenings (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  type text not null,
  performed_on date,
  result text,
  status text default 'ok'::text not null,
  next_due date,
  doc_url text,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  constraint medical_screenings_pkey primary key (id),
  constraint medical_screenings_type_check CHECK ((type = ANY (ARRAY['ecg'::text, 'echo'::text, 'stress_test'::text, 'vision'::text, 'dental'::text, 'other'::text]))),
  constraint medical_screenings_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'warning'::text, 'abnormal'::text])))
);
CREATE INDEX idx_mscr_club ON public.medical_screenings USING btree (club_id);
CREATE INDEX idx_mscr_player ON public.medical_screenings USING btree (player_id, type);

create table if not exists public.medical_studies (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  modality text not null,
  study_date date,
  body_area text,
  finding text,
  file_url text,
  related_injury_id uuid,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  constraint medical_studies_pkey primary key (id),
  constraint medical_studies_modality_check CHECK ((modality = ANY (ARRAY['mri'::text, 'ultrasound'::text, 'xray'::text, 'ct'::text, 'lab'::text, 'other'::text])))
);
CREATE INDEX idx_mstu_club ON public.medical_studies USING btree (club_id);
CREATE INDEX idx_mstu_player ON public.medical_studies USING btree (player_id, study_date DESC);

create table if not exists public.member_modules (
  club_id uuid not null,
  profile_id uuid not null,
  module_key text not null,
  constraint member_modules_pkey primary key (profile_id, module_key)
);

create table if not exists public.member_teams (
  profile_id uuid not null,
  team_id uuid not null,
  club_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint member_teams_pkey primary key (profile_id, team_id),
  constraint member_teams_profile_team_uniq UNIQUE (profile_id, team_id)
);
CREATE INDEX idx_member_teams_profile ON public.member_teams USING btree (profile_id);
CREATE INDEX idx_member_teams_team ON public.member_teams USING btree (team_id);

create table if not exists public.mesocycles (
  id uuid default gen_random_uuid() not null,
  macrocycle_id uuid not null,
  name text not null,
  objective text,
  start_date date not null,
  end_date date not null,
  load_model text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint mesocycles_pkey primary key (id),
  constraint mesocycles_load_model_check CHECK ((load_model = ANY (ARRAY['structured'::text, 'tactical'::text, 'verheijen'::text, 'atr'::text, 'integral'::text])))
);
CREATE INDEX idx_mesocycles_macro ON public.mesocycles USING btree (macrocycle_id);

create table if not exists public.messages (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  sender_id uuid not null,
  sender_name text not null,
  content text not null,
  message_type text default 'text'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  recipient_id uuid,
  attachment_url text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  link_preview jsonb,
  team_id uuid,
  constraint messages_pkey primary key (id),
  constraint messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'file'::text, 'task_ref'::text, 'report_share'::text, 'system'::text])))
);
CREATE INDEX messages_club_created_idx ON public.messages USING btree (club_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON public.messages USING btree (club_id, recipient_id) WHERE (recipient_id IS NOT NULL);
CREATE INDEX idx_messages_team ON public.messages USING btree (team_id);

create table if not exists public.microcycles (
  id text not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  day_orientations jsonb default '{}'::jsonb,
  off_days jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  type text,
  match_date date,
  color text,
  notes text,
  club_id uuid,
  rival text,
  home_away text,
  match_time time without time zone,
  stadium text,
  publish_players boolean default false,
  publish_medical boolean default false,
  publish_board boolean default false,
  published_at timestamp with time zone,
  published_by uuid,
  publish_config jsonb default '{}'::jsonb,
  team_id uuid,
  mesocycle_id uuid,
  season_id uuid,
  day_plan jsonb,
  micro_type text,
  md_overrides jsonb default '{}'::jsonb not null,
  constraint microcycles_pkey primary key (id)
);
CREATE INDEX microcycles_club_id_idx ON public.microcycles USING btree (club_id);
CREATE INDEX microcycles_dates_idx ON public.microcycles USING btree (club_id, start_date DESC);
CREATE INDEX idx_microcycles_meso ON public.microcycles USING btree (mesocycle_id);

create table if not exists public.notification_settings (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  alert_type text not null,
  role text not null,
  enabled boolean default true not null,
  scope text default 'team'::text not null,
  created_at timestamp with time zone default now(),
  constraint notification_settings_pkey primary key (id),
  constraint notification_settings_club_id_alert_type_role_key UNIQUE (club_id, alert_type, role)
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  club_id uuid,
  type text not null,
  title text not null,
  body text,
  read boolean default false not null,
  link text,
  created_at timestamp with time zone default now() not null,
  constraint notifications_pkey primary key (id)
);

create table if not exists public.nutrition (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  log_date date default CURRENT_DATE not null,
  calories numeric(10,2),
  protein numeric(10,2),
  carbs numeric(10,2),
  fats numeric(10,2),
  hydration numeric(10,2),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint nutrition_pkey primary key (id)
);
CREATE INDEX nutrition_player_id_idx ON public.nutrition USING btree (player_id);
CREATE INDEX nutrition_club_player_idx ON public.nutrition USING btree (club_id, player_id);
CREATE INDEX nutrition_date_idx ON public.nutrition USING btree (club_id, log_date DESC);

create table if not exists public.nutrition_targets (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  rmr_model text default 'ten_haaf'::text not null,
  rmr_kcal numeric,
  activity_factor numeric default 1.6,
  tdee_kcal numeric,
  kcal_target numeric,
  protein_g numeric,
  carbs_g numeric,
  fats_g numeric,
  hydration_ml numeric,
  body_fat_target_pct numeric,
  target_date date,
  manual_override boolean default false,
  notes text,
  updated_by uuid,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  sex text,
  constraint nutrition_targets_pkey primary key (id),
  constraint nutrition_targets_player_id_key UNIQUE (player_id),
  constraint nutrition_targets_rmr_model_check CHECK ((rmr_model = ANY (ARRAY['ten_haaf'::text, 'cunningham'::text, 'de_lorenzo'::text, 'harris_benedict'::text, 'mifflin'::text]))),
  constraint nutrition_targets_sex_check CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text])))
);
CREATE INDEX idx_nutrition_targets_club ON public.nutrition_targets USING btree (club_id);

create table if not exists public.opponent_branding (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  opponent_name text not null,
  crest_url text,
  primary_color text,
  created_at timestamp with time zone default now(),
  constraint opponent_branding_pkey primary key (id),
  constraint opponent_branding_club_id_opponent_name_key UNIQUE (club_id, opponent_name)
);
CREATE INDEX idx_opp_branding_club ON public.opponent_branding USING btree (club_id, opponent_name);

create table if not exists public.payment_methods (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  provider_payment_method_id text,
  type text default 'card'::text,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  constraint payment_methods_pkey primary key (id),
  constraint payment_methods_provider_payment_method_id_key UNIQUE (provider_payment_method_id),
  constraint payment_methods_type_check CHECK ((type = ANY (ARRAY['card'::text, 'paypal'::text, 'other'::text])))
);
CREATE INDEX idx_payment_methods_club ON public.payment_methods USING btree (club_id);

create table if not exists public.phase_types (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  name text not null,
  color text default '#888780'::text not null,
  default_counts_availability boolean default true not null,
  is_preset boolean default false not null,
  created_at timestamp with time zone default now(),
  constraint phase_types_pkey primary key (id)
);
CREATE INDEX idx_phase_types_club ON public.phase_types USING btree (club_id);

create table if not exists public.pinned_files (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  conv_id text default 'group'::text not null,
  message_id uuid,
  file_url text not null,
  file_name text not null,
  file_type text,
  pinned_by uuid,
  pinned_at timestamp with time zone default now(),
  team_id uuid,
  constraint pinned_files_pkey primary key (id)
);
CREATE INDEX idx_pinned_files_team ON public.pinned_files USING btree (team_id);

create table if not exists public.plans (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  description text,
  price_monthly numeric(10,2) not null,
  price_yearly numeric(10,2),
  max_players integer,
  max_staff integer,
  features jsonb default '[]'::jsonb,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  provider_price_monthly_id text,
  provider_price_yearly_id text,
  constraint plans_pkey primary key (id),
  constraint plans_slug_key UNIQUE (slug)
);
CREATE INDEX idx_plans_active ON public.plans USING btree (is_active) WHERE (is_active = true);

create table if not exists public.platform_admins (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint platform_admins_pkey primary key (user_id)
);

create table if not exists public.player_anthropometrics (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  measurement_date date not null,
  weight numeric(5,2),
  height numeric(5,2),
  body_fat_pct numeric(5,2),
  muscle_mass numeric(5,2),
  notes text,
  created_at timestamp with time zone default now(),
  constraint player_anthropometrics_pkey primary key (id)
);
CREATE INDEX anthropometrics_player_idx ON public.player_anthropometrics USING btree (player_id);
CREATE INDEX anthropometrics_date_idx ON public.player_anthropometrics USING btree (measurement_date DESC);

create table if not exists public.player_individual_assignments (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  plan_id uuid not null,
  assigned_at timestamp with time zone default now(),
  assigned_by uuid,
  unassigned_at timestamp with time zone,
  active boolean default true,
  constraint player_individual_assignments_pkey primary key (id)
);
CREATE INDEX idx_pia_player_active ON public.player_individual_assignments USING btree (player_id) WHERE (active = true);
CREATE INDEX idx_pia_plan ON public.player_individual_assignments USING btree (plan_id);

create table if not exists public.player_match_stats (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  match_id uuid not null,
  player_id uuid not null,
  minutes integer,
  goals integer default 0,
  assists integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  rating numeric,
  position text,
  extra jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now(),
  constraint player_match_stats_pkey primary key (id)
);
CREATE UNIQUE INDEX ux_player_match_stats_match_player ON public.player_match_stats USING btree (match_id, player_id);
CREATE INDEX idx_player_match_stats_club_player ON public.player_match_stats USING btree (club_id, player_id);

create table if not exists public.player_meal_assignments (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  template_id uuid not null,
  assigned_date date,
  day_type text,
  scale_factor numeric default 1.0,
  custom_overrides jsonb,
  created_at timestamp with time zone default now(),
  constraint player_meal_assignments_pkey primary key (id)
);
CREATE INDEX idx_pma_club ON public.player_meal_assignments USING btree (club_id);
CREATE INDEX idx_pma_player ON public.player_meal_assignments USING btree (player_id);
CREATE INDEX idx_pma_template ON public.player_meal_assignments USING btree (template_id);

create table if not exists public.player_medical_profile (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  blood_type text,
  blood_phenotype text,
  allergies jsonb default '[]'::jsonb not null,
  chronic_conditions jsonb default '[]'::jsonb not null,
  family_history text,
  emergency_contact jsonb,
  treating_physician text,
  insurance text,
  last_review_date date,
  next_review_date date,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid,
  sex text,
  constraint player_medical_profile_pkey primary key (id),
  constraint player_medical_profile_player_id_key UNIQUE (player_id),
  constraint player_medical_profile_sex_check CHECK (((sex IS NULL) OR (sex = ANY (ARRAY['male'::text, 'female'::text]))))
);
CREATE INDEX idx_pmp_club ON public.player_medical_profile USING btree (club_id);
CREATE INDEX idx_pmp_player ON public.player_medical_profile USING btree (player_id);

create table if not exists public.player_medications (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  name text not null,
  dose text,
  frequency text,
  reason text,
  is_supplement boolean default false not null,
  tue boolean default false not null,
  start_date date,
  end_date date,
  active boolean default true not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  constraint player_medications_pkey primary key (id)
);
CREATE INDEX idx_pmed_club ON public.player_medications USING btree (club_id);
CREATE INDEX idx_pmed_player ON public.player_medications USING btree (player_id, active);

create table if not exists public.player_preventive_assignments (
  id uuid default gen_random_uuid() not null,
  routine_id uuid not null,
  player_id uuid not null,
  assigned_at timestamp with time zone default now(),
  assigned_by uuid,
  active boolean default true,
  constraint player_preventive_assignments_pkey primary key (id),
  constraint player_preventive_assignments_routine_id_player_id_key UNIQUE (routine_id, player_id)
);
CREATE INDEX idx_ppa_player ON public.player_preventive_assignments USING btree (player_id) WHERE (active = true);

create table if not exists public.player_teams (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  team_id uuid not null,
  is_primary boolean default false not null,
  created_at timestamp with time zone default now(),
  constraint player_teams_pkey primary key (id),
  constraint player_teams_player_id_team_id_key UNIQUE (player_id, team_id)
);
CREATE INDEX player_teams_club_team_idx ON public.player_teams USING btree (club_id, team_id);
CREATE INDEX player_teams_player_idx ON public.player_teams USING btree (player_id);

create table if not exists public.players (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  first_name text not null,
  last_name text not null,
  position text,
  date_of_birth date,
  nationality text,
  height numeric(5,2),
  weight numeric(5,2),
  dominant_foot text,
  status text default 'available'::text,
  photo_url text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  number integer,
  team_id uuid,
  external_gps_id text,
  external_force_id text,
  scouting_summary text,
  positions text[],
  archived_at timestamp with time zone,
  joined_date date,
  constraint players_pkey primary key (id),
  constraint players_dominant_foot_check CHECK ((dominant_foot = ANY (ARRAY['left'::text, 'right'::text, 'both'::text, NULL::text]))),
  constraint players_status_check CHECK ((status = ANY (ARRAY['available'::text, 'injured'::text, 'modified'::text, 'unavailable'::text])))
);
CREATE INDEX players_club_id_idx ON public.players USING btree (club_id);
CREATE INDEX players_status_idx ON public.players USING btree (club_id, status);
CREATE INDEX players_name_idx ON public.players USING btree (club_id, first_name, last_name);
CREATE INDEX players_position_idx ON public.players USING btree (club_id, "position");
CREATE INDEX players_number_idx ON public.players USING btree (club_id, number);
CREATE INDEX players_team_id_idx ON public.players USING btree (team_id);
CREATE INDEX idx_players_ext_gps ON public.players USING btree (club_id, external_gps_id) WHERE (external_gps_id IS NOT NULL);
CREATE INDEX idx_players_external_force ON public.players USING btree (club_id, external_force_id);

create table if not exists public.preventive_routines (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text not null,
  description text,
  focus_area text,
  target_type text default 'individual'::text,
  frequency text default 'weekly'::text,
  exercises jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint preventive_routines_pkey primary key (id),
  constraint preventive_routines_focus_area_check CHECK ((focus_area = ANY (ARRAY['hamstring'::text, 'knee'::text, 'ankle'::text, 'core'::text, 'shoulder'::text, 'hip'::text, 'general'::text]))),
  constraint preventive_routines_target_type_check CHECK ((target_type = ANY (ARRAY['individual'::text, 'position'::text, 'squad'::text]))),
  constraint preventive_routines_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'pre_session'::text, 'post_session'::text])))
);
CREATE INDEX idx_preventive_routines_club ON public.preventive_routines USING btree (club_id);
CREATE INDEX idx_preventive_routines_active ON public.preventive_routines USING btree (is_active) WHERE (is_active = true);

create table if not exists public.profiles (
  id uuid not null,
  club_id uuid not null,
  email text not null,
  full_name text,
  role text default 'staff'::text not null,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  club_role text,
  last_seen_at timestamp with time zone,
  settings jsonb default '{}'::jsonb,
  notification_settings jsonb default '{}'::jsonb,
  first_name text,
  last_name text,
  phone text,
  birth_date date,
  job_title text,
  preferred_lang text,
  onboarded boolean default false not null,
  constraint profiles_pkey primary key (id),
  constraint profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text, 'physio'::text, 'analyst'::text, 'nutritionist'::text, 'staff'::text, 'sc_coach'::text, 'fitness_coach'::text, 'gk_coach'::text, 'assistant_coach'::text]))),
  constraint profiles_club_role_check CHECK (((club_role IS NULL) OR (club_role = ANY (ARRAY['admin'::text, 'coach'::text, 'physio'::text, 'analyst'::text, 'nutritionist'::text, 'staff'::text, 'sc_coach'::text, 'fitness_coach'::text, 'gk_coach'::text, 'assistant_coach'::text])))),
  constraint profiles_preferred_lang_check CHECK (((preferred_lang IS NULL) OR (preferred_lang = ANY (ARRAY['en'::text, 'es'::text, 'pt'::text]))))
);
CREATE INDEX profiles_club_id_idx ON public.profiles USING btree (club_id);
CREATE INDEX profiles_email_idx ON public.profiles USING btree (email);
CREATE INDEX profiles_role_idx ON public.profiles USING btree (club_id, role);

create table if not exists public.programme_phases (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  plan_id uuid not null,
  name text not null,
  week_start integer default 1 not null,
  week_end integer default 1 not null,
  color text,
  objective text,
  load_level text,
  phase_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint programme_phases_pkey primary key (id)
);
CREATE INDEX idx_programme_phases_club ON public.programme_phases USING btree (club_id);
CREATE INDEX idx_programme_phases_plan ON public.programme_phases USING btree (plan_id);

create table if not exists public.protocol_blocks (
  id uuid default gen_random_uuid() not null,
  protocol_id uuid not null,
  phase_id uuid,
  day_index integer not null,
  block_type text not null,
  title text not null,
  description text,
  duration_min integer,
  exercises jsonb default '[]'::jsonb,
  intensity text,
  completed boolean default false,
  completed_at timestamp with time zone,
  notes text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint protocol_blocks_pkey primary key (id),
  constraint protocol_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['warmup'::text, 'strength'::text, 'mobility'::text, 'cardio'::text, 'plyo'::text, 'sport'::text, 'cooldown'::text, 'assessment'::text]))),
  constraint protocol_blocks_intensity_check CHECK ((intensity = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'max'::text])))
);
CREATE INDEX idx_protocol_blocks_protocol ON public.protocol_blocks USING btree (protocol_id);
CREATE INDEX idx_protocol_blocks_phase ON public.protocol_blocks USING btree (phase_id);
CREATE INDEX idx_protocol_blocks_day ON public.protocol_blocks USING btree (protocol_id, day_index, sort_order);

create table if not exists public.rehab_plan_owners (
  id uuid default gen_random_uuid() not null,
  plan_id uuid not null,
  profile_id uuid not null,
  role text not null,
  created_at timestamp with time zone default now(),
  constraint rehab_plan_owners_pkey primary key (id),
  constraint rehab_plan_owners_plan_id_profile_id_key UNIQUE (plan_id, profile_id),
  constraint rehab_plan_owners_role_check CHECK ((role = ANY (ARRAY['physio'::text, 'sc_coach'::text, 'coach'::text])))
);
CREATE INDEX idx_rehab_owners_plan ON public.rehab_plan_owners USING btree (plan_id);

create table if not exists public.rehab_plans (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  injury_id uuid,
  kind text not null,
  name text,
  diagnosis text,
  phase text,
  phase_type text,
  start_date date,
  rtp_estimate date,
  rtp_window_days integer,
  programme_week integer,
  programme_total_weeks integer,
  source text,
  source_label text,
  risk_metric text,
  status text default 'on_track'::text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint rehab_plans_pkey primary key (id),
  constraint rehab_plans_kind_check CHECK ((kind = ANY (ARRAY['rehab'::text, 'preventive'::text]))),
  constraint rehab_plans_phase_type_check CHECK ((phase_type = ANY (ARRAY['acute'::text, 'subacute'::text, 'strength'::text, 'field'::text, 'foundation'::text, 'capacity'::text, 'neuromuscular'::text, 'running'::text, 'training'::text, 'competition'::text]))),
  constraint rehab_plans_source_check CHECK ((source = ANY (ARRAY['injury'::text, 'evaluation'::text, 'gps'::text, 'manual'::text]))),
  constraint rehab_plans_status_check CHECK ((status = ANY (ARRAY['on_track'::text, 'near_rtp'::text, 'blocked'::text, 'cleared'::text, 'archived'::text])))
);
CREATE INDEX idx_rehab_plans_club ON public.rehab_plans USING btree (club_id);
CREATE INDEX idx_rehab_plans_club_status ON public.rehab_plans USING btree (club_id, status);
CREATE INDEX rehab_plans_injury_id_idx ON public.rehab_plans USING btree (injury_id);

create table if not exists public.rehab_protocols (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  injury_id uuid,
  name text not null,
  description text,
  estimated_days integer,
  status text default 'active'::text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint rehab_protocols_pkey primary key (id),
  constraint rehab_protocols_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'archived'::text])))
);
CREATE INDEX idx_rehab_protocols_club ON public.rehab_protocols USING btree (club_id);
CREATE INDEX idx_rehab_protocols_injury ON public.rehab_protocols USING btree (injury_id);
CREATE INDEX idx_rehab_protocols_status ON public.rehab_protocols USING btree (status);

create table if not exists public.rehab_sessions (
  id uuid default gen_random_uuid() not null,
  plan_id uuid not null,
  club_id uuid not null,
  date date not null,
  name text,
  color text,
  start_time time without time zone,
  duration_min integer,
  block_count integer,
  notes text,
  created_at timestamp with time zone default now(),
  phase_number integer,
  block_type text,
  owner text,
  rpe_target numeric,
  volume_sets integer,
  au integer,
  context_note text,
  exercises jsonb,
  constraint rehab_sessions_pkey primary key (id)
);
CREATE INDEX idx_rehab_sessions_plan_date ON public.rehab_sessions USING btree (plan_id, date);
CREATE INDEX idx_rehab_sessions_club_date ON public.rehab_sessions USING btree (club_id, date);

create table if not exists public.role_default_modules (
  club_id uuid not null,
  role text not null,
  module_key text not null,
  constraint role_default_modules_pkey primary key (club_id, role, module_key)
);

create table if not exists public.rpe (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  session_id uuid,
  rpe numeric(5,2) not null,
  duration integer,
  load numeric(10,2),
  created_at timestamp with time zone default now(),
  club_id uuid,
  notes text,
  note text,
  body_areas text[],
  session_date date default CURRENT_DATE,
  constraint rpe_pkey primary key (id),
  constraint rpe_player_id_session_id_key UNIQUE (player_id, session_id),
  constraint rpe_rpe_check CHECK (((rpe >= (0)::numeric) AND (rpe <= (10)::numeric)))
);
CREATE INDEX rpe_player_id_idx ON public.rpe USING btree (player_id);
CREATE INDEX rpe_session_id_idx ON public.rpe USING btree (session_id);
CREATE INDEX rpe_created_idx ON public.rpe USING btree (created_at DESC);
CREATE INDEX rpe_club_id_idx ON public.rpe USING btree (club_id);

create table if not exists public.season_phases (
  id uuid default gen_random_uuid() not null,
  season_id uuid not null,
  phase_type_id uuid,
  name text not null,
  color text default '#888780'::text not null,
  start_date date not null,
  end_date date not null,
  counts_availability boolean default true not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint season_phases_pkey primary key (id)
);
CREATE INDEX idx_season_phases_season ON public.season_phases USING btree (season_id);

create table if not exists public.seasons (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  planning_model text default 'tactical'::text,
  constraint seasons_pkey primary key (id),
  constraint seasons_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);
CREATE INDEX idx_seasons_club ON public.seasons USING btree (club_id);
CREATE INDEX idx_seasons_club_team ON public.seasons USING btree (club_id, team_id);

create table if not exists public.session_exercises (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  session_id uuid not null,
  exercise_id uuid,
  name text,
  phase text default 'main'::text not null,
  duration integer,
  intensity text,
  position integer default 0 not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  planner_exercise_id uuid,
  field_width numeric(6,1),
  field_height numeric(6,1),
  players_count integer,
  m2_per_player integer,
  calc_orientation text,
  series integer,
  work_time text,
  rest_time text,
  dose_mode text,
  reps integer,
  player_groups jsonb,
  constraint session_exercises_pkey primary key (id),
  constraint session_exercises_phase_check CHECK ((phase = ANY (ARRAY['warmup'::text, 'main'::text, 'cooldown'::text, 'activation'::text, 'goalkeepers'::text])))
);
CREATE INDEX idx_session_exercises_session ON public.session_exercises USING btree (session_id);
CREATE INDEX idx_session_exercises_club ON public.session_exercises USING btree (club_id);

create table if not exists public.share_links (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  scope text default 'players'::text not null,
  token text default (gen_random_uuid())::text not null,
  mc_id text,
  week_start date,
  expires_at timestamp with time zone,
  revoked boolean default false not null,
  created_by uuid,
  created_at timestamp with time zone default now(),
  team_id uuid,
  session_id uuid,
  player_id uuid,
  constraint share_links_pkey primary key (id),
  constraint share_links_token_key UNIQUE (token)
);
CREATE UNIQUE INDEX share_links_token_idx ON public.share_links USING btree (token);
CREATE INDEX share_links_club_idx ON public.share_links USING btree (club_id);
CREATE INDEX share_links_player_idx ON public.share_links USING btree (player_id);

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() not null,
  team_id uuid not null,
  club_id uuid not null,
  plan_id uuid not null,
  status text default 'trialing'::text not null,
  billing_cycle text default 'monthly'::text,
  provider_subscription_id text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  trial_end timestamp with time zone,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  is_comp boolean default false not null,
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_provider_subscription_id_key UNIQUE (provider_subscription_id),
  constraint subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'trialing'::text, 'paused'::text]))),
  constraint subscriptions_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])))
);
CREATE UNIQUE INDEX uniq_sub_active_per_team ON public.subscriptions USING btree (team_id) WHERE (status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'paused'::text]));
CREATE INDEX idx_subscriptions_team ON public.subscriptions USING btree (team_id);
CREATE INDEX idx_subscriptions_club ON public.subscriptions USING btree (club_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

create table if not exists public.surgeries (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  procedure text not null,
  surgery_date date,
  laterality text default 'na'::text,
  surgeon text,
  clinic text,
  implants text,
  outcome text,
  related_injury_id uuid,
  notes text,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  constraint surgeries_pkey primary key (id),
  constraint surgeries_laterality_check CHECK ((laterality = ANY (ARRAY['left'::text, 'right'::text, 'bilateral'::text, 'na'::text])))
);
CREATE INDEX idx_surg_club ON public.surgeries USING btree (club_id);
CREATE INDEX idx_surg_player ON public.surgeries USING btree (player_id, surgery_date DESC);

create table if not exists public.task_reminders (
  id uuid default gen_random_uuid() not null,
  task_id uuid not null,
  club_id uuid not null,
  remind_at timestamp with time zone not null,
  sent_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint task_reminders_pkey primary key (id)
);
CREATE INDEX task_reminders_due_idx ON public.task_reminders USING btree (remind_at) WHERE (sent_at IS NULL);

create table if not exists public.tasks (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  created_by uuid,
  created_by_name text not null,
  assigned_to uuid,
  assigned_to_name text,
  title text not null,
  description text,
  due_date date,
  priority text default 'medium'::text not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  category text default 'routine'::text,
  event_id uuid,
  team_id uuid,
  assigned_roles text[],
  constraint tasks_pkey primary key (id),
  constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
  constraint tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]))),
  constraint tasks_category_check CHECK ((category = ANY (ARRAY['general'::text, 'match_day'::text, 'medical'::text, 'routine'::text, 'event'::text]))),
  constraint tasks_assigned_roles_check CHECK (((assigned_roles IS NULL) OR (assigned_roles <@ ARRAY['owner'::text, 'admin'::text, 'coach'::text, 'physio'::text, 'analyst'::text, 'nutritionist'::text, 'staff'::text, 'sc_coach'::text, 'fitness_coach'::text, 'gk_coach'::text, 'assistant_coach'::text])))
);
CREATE INDEX tasks_club_idx ON public.tasks USING btree (club_id);
CREATE INDEX tasks_assigned_idx ON public.tasks USING btree (assigned_to);
CREATE INDEX tasks_status_idx ON public.tasks USING btree (club_id, status);
CREATE INDEX tasks_due_idx ON public.tasks USING btree (due_date);
CREATE INDEX tasks_event_id_idx ON public.tasks USING btree (event_id) WHERE (event_id IS NOT NULL);
CREATE INDEX tasks_club_event_idx ON public.tasks USING btree (club_id, event_id) WHERE (event_id IS NOT NULL);
CREATE INDEX idx_tasks_event_id ON public.tasks USING btree (event_id) WHERE (event_id IS NOT NULL);
CREATE INDEX idx_tasks_club_status ON public.tasks USING btree (club_id, status) WHERE (status = 'pending'::text);
CREATE INDEX idx_tasks_team ON public.tasks USING btree (team_id);
CREATE INDEX idx_tasks_team_id ON public.tasks USING btree (team_id);

create table if not exists public.taxonomy_aliases (
  dimension text not null,
  alias text not null,
  token text not null,
  constraint taxonomy_aliases_pkey primary key (dimension, alias)
);

create table if not exists public.teams (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  name text not null,
  season text,
  created_at timestamp with time zone default now(),
  is_primary boolean default false not null,
  archived_at timestamp with time zone,
  constraint teams_pkey primary key (id),
  constraint teams_club_id_name_key UNIQUE (club_id, name)
);
CREATE INDEX teams_club_id_idx ON public.teams USING btree (club_id);

create table if not exists public.training_sessions (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  title text not null,
  session_date date not null,
  session_time time without time zone,
  duration integer,
  session_type text not null,
  coach_id uuid,
  location text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  rpe_avg numeric(4,1),
  published boolean default false not null,
  estimated_rpe integer,
  sort_order integer default 0,
  orientation character varying(50),
  focus character varying(50),
  match_day_offset character varying(10),
  end_time time without time zone,
  microcycle_id text,
  visible_to text[] default ARRAY['staff'::text],
  is_historical boolean default false not null,
  session_label text,
  session_attributes jsonb default '{}'::jsonb not null,
  team_id uuid,
  gym_content jsonb,
  external_activity_id text,
  gps_targets jsonb default '{}'::jsonb not null,
  recurrence_group_id uuid,
  constraint training_sessions_pkey primary key (id),
  constraint training_sessions_estimated_rpe_check CHECK (((estimated_rpe >= 1) AND (estimated_rpe <= 10))),
  constraint training_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['training'::text, 'match'::text, 'rehab'::text, 'conditioning'::text, 'recovery'::text, 'tactical'::text, 'gym'::text, 'other'::text])))
);
CREATE INDEX training_sessions_club_id_idx ON public.training_sessions USING btree (club_id);
CREATE INDEX training_sessions_type_idx ON public.training_sessions USING btree (club_id, session_type);
CREATE INDEX training_sessions_coach_idx ON public.training_sessions USING btree (coach_id);
CREATE INDEX idx_training_sessions_club_date ON public.training_sessions USING btree (club_id, session_date);
CREATE INDEX idx_training_sessions_historical ON public.training_sessions USING btree (club_id, is_historical, session_date);
CREATE INDEX idx_training_sessions_attributes ON public.training_sessions USING gin (session_attributes);
CREATE INDEX idx_training_sessions_club_microcycle ON public.training_sessions USING btree (club_id, microcycle_id);
CREATE UNIQUE INDEX uq_training_sessions_club_activity ON public.training_sessions USING btree (club_id, external_activity_id) WHERE (external_activity_id IS NOT NULL);
CREATE INDEX training_sessions_recurrence_group_id_idx ON public.training_sessions USING btree (recurrence_group_id) WHERE (recurrence_group_id IS NOT NULL);

create table if not exists public.treatment_templates (
  id uuid default gen_random_uuid() not null,
  club_id uuid,
  title text not null,
  treatment_type text,
  injury_type text,
  modalities jsonb,
  duration_minutes integer,
  notes_template text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint treatment_templates_pkey primary key (id),
  constraint treatment_templates_treatment_type_check CHECK ((treatment_type = ANY (ARRAY['rehab'::text, 'preventive'::text])))
);

create table if not exists public.treatments (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  player_id uuid not null,
  injury_id uuid,
  date date default CURRENT_DATE not null,
  type text,
  notes text,
  performed_by uuid,
  created_at timestamp with time zone default now(),
  duration_min integer,
  time text,
  adaptation text,
  zones text[],
  treatment_type text default 'rehab'::text,
  reason text,
  indicated_by uuid,
  modalities jsonb,
  pain_pre integer,
  pain_post integer,
  player_status text,
  physio_id uuid,
  session_time time without time zone,
  adaptation_notes text,
  adaptation_sent_at timestamp with time zone,
  notify_coaches boolean default false,
  adaptation_applied_at timestamp with time zone,
  adaptation_applied_by uuid,
  constraint treatments_pkey primary key (id),
  constraint treatments_treatment_type_check CHECK ((treatment_type = ANY (ARRAY['rehab'::text, 'preventive'::text]))),
  constraint treatments_pain_pre_check CHECK (((pain_pre >= 0) AND (pain_pre <= 10))),
  constraint treatments_pain_post_check CHECK (((pain_post >= 0) AND (pain_post <= 10))),
  constraint treatments_player_status_check CHECK ((player_status = ANY (ARRAY['improving'::text, 'stable'::text, 'worsening'::text])))
);

create table if not exists public.video_matches (
  video_id uuid not null,
  event_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint video_matches_pkey primary key (video_id, event_id)
);
CREATE INDEX idx_video_matches_event ON public.video_matches USING btree (event_id);

create table if not exists public.video_players (
  video_id uuid not null,
  player_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint video_players_pkey primary key (video_id, player_id)
);
CREATE INDEX idx_video_players_player ON public.video_players USING btree (player_id);

create table if not exists public.video_sessions (
  video_id uuid not null,
  session_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint video_sessions_pkey primary key (video_id, session_id)
);
CREATE INDEX idx_video_sessions_session ON public.video_sessions USING btree (session_id);

create table if not exists public.videos (
  id uuid default gen_random_uuid() not null,
  club_id uuid not null,
  team_id uuid,
  title text not null,
  provider text default 'google_drive'::text not null,
  url text not null,
  external_id text,
  thumbnail_url text,
  duration_seconds integer,
  notes text,
  uploaded_by uuid not null,
  uploaded_by_name text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  kind text default 'video'::text not null,
  constraint videos_pkey primary key (id),
  constraint videos_provider_check CHECK ((provider = ANY (ARRAY['google_drive'::text, 'dropbox'::text, 'other'::text]))),
  constraint videos_kind_check CHECK ((kind = ANY (ARRAY['video'::text, 'folder'::text])))
);
CREATE INDEX idx_videos_club ON public.videos USING btree (club_id);
CREATE INDEX idx_videos_team ON public.videos USING btree (team_id);
CREATE INDEX idx_videos_uploaded_by ON public.videos USING btree (uploaded_by);

create table if not exists public.wellness (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  club_id uuid not null,
  sleep_quality numeric(2,0),
  fatigue numeric(2,0),
  soreness numeric(2,0),
  stress numeric(2,0),
  mood numeric(2,0),
  readiness numeric(2,0),
  notes text,
  submitted_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now(),
  note text,
  body_areas text[],
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  hooper_index numeric,
  constraint wellness_pkey primary key (id),
  constraint wellness_sleep_quality_check CHECK (((sleep_quality >= (1)::numeric) AND (sleep_quality <= (10)::numeric))),
  constraint wellness_fatigue_check CHECK (((fatigue >= (1)::numeric) AND (fatigue <= (10)::numeric))),
  constraint wellness_soreness_check CHECK (((soreness >= (1)::numeric) AND (soreness <= (10)::numeric))),
  constraint wellness_stress_check CHECK (((stress >= (1)::numeric) AND (stress <= (10)::numeric))),
  constraint wellness_mood_check CHECK (((mood >= (1)::numeric) AND (mood <= (10)::numeric))),
  constraint wellness_readiness_check CHECK (((readiness >= (1)::numeric) AND (readiness <= (10)::numeric)))
);
CREATE INDEX wellness_player_id_idx ON public.wellness USING btree (player_id);
CREATE INDEX wellness_club_player_idx ON public.wellness USING btree (club_id, player_id);
CREATE INDEX wellness_date_idx ON public.wellness USING btree (club_id, submitted_at DESC);

-- ======================= FOREIGN KEYS =======================

alter table public.ai_card_generations add constraint ai_card_generations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
alter table public.ai_card_generations add constraint ai_card_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.assessment_column_maps add constraint assessment_column_maps_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.assessment_test_defs add constraint assessment_test_defs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.audit_log add constraint audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.audit_log add constraint audit_log_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.body_composition add constraint body_composition_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.body_composition add constraint body_composition_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.body_composition add constraint body_composition_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.calendar_events add constraint calendar_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.calendar_events add constraint calendar_events_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES competitions(id);
alter table public.calendar_events add constraint calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.calendar_events add constraint calendar_events_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
alter table public.calendar_events add constraint calendar_events_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.card_accumulations add constraint card_accumulations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.card_accumulations add constraint card_accumulations_league_config_id_fkey FOREIGN KEY (league_config_id) REFERENCES league_configs(id) ON DELETE CASCADE;
alter table public.card_accumulations add constraint card_accumulations_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.card_accumulations add constraint card_accumulations_player_uuid_fkey FOREIGN KEY (player_uuid) REFERENCES players(id) ON DELETE CASCADE;
alter table public.card_templates add constraint card_templates_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.card_templates add constraint card_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.channel_reads add constraint channel_reads_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.channel_reads add constraint channel_reads_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.channel_reads add constraint channel_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.club_branding add constraint club_branding_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.club_gps_settings add constraint club_gps_settings_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.club_modules add constraint club_modules_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.club_settings add constraint club_settings_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.competitions add constraint competitions_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
alter table public.dashboard_cards add constraint dashboard_cards_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dashboard_cards add constraint dashboard_cards_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE;
alter table public.dashboards add constraint dashboards_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.dashboards add constraint dashboards_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dashboards add constraint dashboards_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dossier_templates add constraint dossier_templates_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.dossier_templates add constraint dossier_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.drills add constraint drills_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.drills add constraint drills_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.drills add constraint drills_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;
alter table public.evaluations add constraint evaluations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.evaluations add constraint evaluations_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.exercise_drills add constraint exercise_drills_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;
alter table public.exercises add constraint exercises_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.exercises add constraint exercises_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.force_column_mappings add constraint force_column_mappings_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.force_metric_definitions add constraint force_metric_definitions_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.force_test_metrics add constraint force_test_metrics_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.force_test_metrics add constraint force_test_metrics_test_id_fkey FOREIGN KEY (test_id) REFERENCES force_tests(id) ON DELETE CASCADE;
alter table public.force_tests add constraint force_tests_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.force_tests add constraint force_tests_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.force_tests add constraint force_tests_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.gps_column_mappings add constraint gps_column_mappings_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_dashboard_layouts add constraint gps_dashboard_layouts_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_dashboard_layouts add constraint gps_dashboard_layouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.gps_drill_map add constraint gps_drill_map_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_drill_map add constraint gps_drill_map_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
alter table public.gps_integration_secrets add constraint gps_integration_secrets_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES gps_integrations(id) ON DELETE CASCADE;
alter table public.gps_integrations add constraint gps_integrations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_metric_definitions add constraint gps_metric_definitions_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_metric_definitions add constraint gps_metric_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gps_period_reports add constraint gps_period_reports_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_period_reports add constraint gps_period_reports_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.gps_period_reports add constraint gps_period_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;
alter table public.gps_report_metrics add constraint gps_report_metrics_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_report_metrics add constraint gps_report_metrics_report_id_fkey FOREIGN KEY (report_id) REFERENCES gps_reports(id) ON DELETE CASCADE;
alter table public.gps_reports add constraint gps_reports_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_reports add constraint gps_reports_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.gps_reports add constraint gps_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;
alter table public.gps_sync_jobs add constraint gps_sync_jobs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gps_sync_jobs add constraint gps_sync_jobs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES gps_integrations(id) ON DELETE CASCADE;
alter table public.gym_exercises add constraint gym_exercises_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.gym_session_templates add constraint gym_session_templates_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.individual_block_completions add constraint individual_block_completions_block_id_fkey FOREIGN KEY (block_id) REFERENCES individual_plan_blocks(id) ON DELETE CASCADE;
alter table public.individual_block_completions add constraint individual_block_completions_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.individual_plan_blocks add constraint individual_plan_blocks_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES individual_plans(id) ON DELETE CASCADE;
alter table public.individual_plan_phases add constraint individual_plan_phases_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.individual_plan_phases add constraint individual_plan_phases_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES individual_plans(id) ON DELETE CASCADE;
alter table public.individual_plans add constraint individual_plans_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.individual_plans add constraint individual_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.individual_plans add constraint individual_plans_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.injuries add constraint injuries_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.injuries add constraint injuries_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.injuries add constraint injuries_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.injury_phases add constraint injury_phases_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
alter table public.injury_phases add constraint injury_phases_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.injury_phases add constraint injury_phases_injury_id_fkey FOREIGN KEY (injury_id) REFERENCES injuries(id) ON DELETE CASCADE;
alter table public.invitations add constraint invitations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.invitations add constraint invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.invoices add constraint invoices_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.invoices add constraint invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;
alter table public.league_configs add constraint league_configs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.lineup_players add constraint lineup_players_lineup_id_fkey FOREIGN KEY (lineup_id) REFERENCES lineups(id) ON DELETE CASCADE;
alter table public.lineup_players add constraint lineup_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.lineup_staff add constraint lineup_staff_lineup_id_fkey FOREIGN KEY (lineup_id) REFERENCES lineups(id) ON DELETE CASCADE;
alter table public.lineup_staff add constraint lineup_staff_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.lineups add constraint lineups_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.lineups add constraint lineups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.lineups add constraint lineups_match_id_fkey FOREIGN KEY (match_id) REFERENCES calendar_events(id) ON DELETE SET NULL;
alter table public.lineups add constraint lineups_microcycle_id_fkey FOREIGN KEY (microcycle_id) REFERENCES microcycles(id) ON DELETE SET NULL;
alter table public.lineups add constraint lineups_published_by_fkey FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.load_templates add constraint load_templates_mesocycle_id_fkey FOREIGN KEY (mesocycle_id) REFERENCES mesocycles(id) ON DELETE CASCADE;
alter table public.macrocycles add constraint macrocycles_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
alter table public.match_reports add constraint match_reports_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.match_reports add constraint match_reports_league_config_id_fkey FOREIGN KEY (league_config_id) REFERENCES league_configs(id) ON DELETE SET NULL;
alter table public.match_reports add constraint match_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;
alter table public.match_results add constraint match_results_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.match_results add constraint match_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.match_results add constraint match_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;
alter table public.match_results add constraint match_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.match_shots add constraint match_shots_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.match_shots add constraint match_shots_match_id_fkey FOREIGN KEY (match_id) REFERENCES match_reports(id) ON DELETE CASCADE;
alter table public.match_shots add constraint match_shots_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
alter table public.meal_plan_items add constraint meal_plan_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES foods(id);
alter table public.meal_plan_items add constraint meal_plan_items_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES meal_plan_meals(id) ON DELETE CASCADE;
alter table public.meal_plan_meals add constraint meal_plan_meals_template_id_fkey FOREIGN KEY (template_id) REFERENCES meal_plan_templates(id) ON DELETE CASCADE;
alter table public.meal_plan_templates add constraint meal_plan_templates_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.meal_plan_templates add constraint meal_plan_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.medical_documents add constraint medical_documents_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.medical_documents add constraint medical_documents_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.medical_episodes add constraint medical_episodes_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.medical_episodes add constraint medical_episodes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.medical_screenings add constraint medical_screenings_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.medical_screenings add constraint medical_screenings_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.medical_studies add constraint medical_studies_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.medical_studies add constraint medical_studies_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.medical_studies add constraint medical_studies_related_injury_id_fkey FOREIGN KEY (related_injury_id) REFERENCES injuries(id) ON DELETE SET NULL;
alter table public.member_modules add constraint member_modules_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.member_modules add constraint member_modules_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.member_teams add constraint member_teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.member_teams add constraint member_teams_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.member_teams add constraint member_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.mesocycles add constraint mesocycles_macrocycle_id_fkey FOREIGN KEY (macrocycle_id) REFERENCES macrocycles(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.messages add constraint messages_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.microcycles add constraint microcycles_mesocycle_id_fkey FOREIGN KEY (mesocycle_id) REFERENCES mesocycles(id) ON DELETE SET NULL;
alter table public.microcycles add constraint microcycles_published_by_fkey FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.microcycles add constraint microcycles_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL;
alter table public.microcycles add constraint microcycles_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.notification_settings add constraint notification_settings_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.nutrition add constraint nutrition_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.nutrition add constraint nutrition_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.nutrition_targets add constraint nutrition_targets_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.nutrition_targets add constraint nutrition_targets_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.nutrition_targets add constraint nutrition_targets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.opponent_branding add constraint opponent_branding_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.payment_methods add constraint payment_methods_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.phase_types add constraint phase_types_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
alter table public.pinned_files add constraint pinned_files_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.pinned_files add constraint pinned_files_pinned_by_fkey FOREIGN KEY (pinned_by) REFERENCES auth.users(id);
alter table public.pinned_files add constraint pinned_files_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.platform_admins add constraint platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.player_anthropometrics add constraint player_anthropometrics_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.player_anthropometrics add constraint player_anthropometrics_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_individual_assignments add constraint player_individual_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.player_individual_assignments add constraint player_individual_assignments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES individual_plans(id) ON DELETE CASCADE;
alter table public.player_individual_assignments add constraint player_individual_assignments_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_match_stats add constraint player_match_stats_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.player_match_stats add constraint player_match_stats_match_id_fkey FOREIGN KEY (match_id) REFERENCES match_results(id) ON DELETE CASCADE;
alter table public.player_match_stats add constraint player_match_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_meal_assignments add constraint player_meal_assignments_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.player_meal_assignments add constraint player_meal_assignments_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_meal_assignments add constraint player_meal_assignments_template_id_fkey FOREIGN KEY (template_id) REFERENCES meal_plan_templates(id) ON DELETE CASCADE;
alter table public.player_medical_profile add constraint player_medical_profile_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.player_medical_profile add constraint player_medical_profile_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_medications add constraint player_medications_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.player_medications add constraint player_medications_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_preventive_assignments add constraint player_preventive_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.player_preventive_assignments add constraint player_preventive_assignments_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_preventive_assignments add constraint player_preventive_assignments_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES preventive_routines(id) ON DELETE CASCADE;
alter table public.player_teams add constraint player_teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.player_teams add constraint player_teams_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_teams add constraint player_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.players add constraint players_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.players add constraint players_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.preventive_routines add constraint preventive_routines_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.preventive_routines add constraint preventive_routines_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.programme_phases add constraint programme_phases_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.programme_phases add constraint programme_phases_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES rehab_plans(id) ON DELETE CASCADE;
alter table public.protocol_blocks add constraint protocol_blocks_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES injury_phases(id) ON DELETE SET NULL;
alter table public.protocol_blocks add constraint protocol_blocks_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES rehab_protocols(id) ON DELETE CASCADE;
alter table public.rehab_plan_owners add constraint rehab_plan_owners_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES rehab_plans(id) ON DELETE CASCADE;
alter table public.rehab_plan_owners add constraint rehab_plan_owners_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.rehab_plans add constraint rehab_plans_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
alter table public.rehab_plans add constraint rehab_plans_injury_id_fkey FOREIGN KEY (injury_id) REFERENCES injuries(id) ON DELETE SET NULL;
alter table public.rehab_plans add constraint rehab_plans_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id);
alter table public.rehab_protocols add constraint rehab_protocols_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rehab_protocols add constraint rehab_protocols_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.rehab_protocols add constraint rehab_protocols_injury_id_fkey FOREIGN KEY (injury_id) REFERENCES injuries(id) ON DELETE CASCADE;
alter table public.rehab_sessions add constraint rehab_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES rehab_plans(id) ON DELETE CASCADE;
alter table public.role_default_modules add constraint role_default_modules_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rpe add constraint rpe_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.rpe add constraint rpe_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.rpe add constraint rpe_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;
alter table public.season_phases add constraint season_phases_phase_type_id_fkey FOREIGN KEY (phase_type_id) REFERENCES phase_types(id);
alter table public.season_phases add constraint season_phases_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
alter table public.seasons add constraint seasons_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
alter table public.seasons add constraint seasons_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table public.session_exercises add constraint session_exercises_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.session_exercises add constraint session_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES gym_exercises(id) ON DELETE SET NULL;
alter table public.session_exercises add constraint session_exercises_planner_exercise_id_fkey FOREIGN KEY (planner_exercise_id) REFERENCES exercises(id);
alter table public.session_exercises add constraint session_exercises_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;
alter table public.share_links add constraint share_links_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.share_links add constraint share_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.share_links add constraint share_links_mc_id_fkey FOREIGN KEY (mc_id) REFERENCES microcycles(id) ON DELETE SET NULL;
alter table public.share_links add constraint share_links_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.share_links add constraint share_links_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;
alter table public.share_links add constraint share_links_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);
alter table public.subscriptions add constraint subscriptions_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.surgeries add constraint surgeries_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.surgeries add constraint surgeries_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.surgeries add constraint surgeries_related_injury_id_fkey FOREIGN KEY (related_injury_id) REFERENCES injuries(id) ON DELETE SET NULL;
alter table public.task_reminders add constraint task_reminders_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.teams add constraint teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.training_sessions add constraint training_sessions_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.training_sessions add constraint training_sessions_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.training_sessions add constraint training_sessions_microcycle_id_fkey FOREIGN KEY (microcycle_id) REFERENCES microcycles(id) ON DELETE SET NULL;
alter table public.training_sessions add constraint training_sessions_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.treatment_templates add constraint treatment_templates_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.treatment_templates add constraint treatment_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.treatments add constraint treatments_adaptation_applied_by_fkey FOREIGN KEY (adaptation_applied_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.treatments add constraint treatments_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.treatments add constraint treatments_indicated_by_fkey FOREIGN KEY (indicated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.treatments add constraint treatments_injury_id_fkey FOREIGN KEY (injury_id) REFERENCES injuries(id) ON DELETE SET NULL;
alter table public.treatments add constraint treatments_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.treatments add constraint treatments_physio_id_fkey FOREIGN KEY (physio_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.treatments add constraint treatments_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.video_matches add constraint video_matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;
alter table public.video_matches add constraint video_matches_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.video_players add constraint video_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.video_players add constraint video_players_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.video_sessions add constraint video_sessions_session_id_fkey FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;
alter table public.video_sessions add constraint video_sessions_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.videos add constraint videos_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.videos add constraint videos_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.wellness add constraint wellness_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.wellness add constraint wellness_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
alter table public.wellness add constraint wellness_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- ========================= FUNCIONES =========================

CREATE OR REPLACE FUNCTION public.accept_invitation()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inv_id   uuid;
  v_club     uuid;
  v_role     text;
  v_team_ids uuid[];
begin
  -- Primary goal: mark the caller's pending invitation as accepted.
  update public.invitations
     set status = 'accepted'
   where lower(email) = lower((select email from auth.users where id = auth.uid()))
     and status = 'pending'
  returning id, club_id, role, team_ids
       into v_inv_id, v_club, v_role, v_team_ids;

  -- Not an invited user (or already accepted): nothing else to do.
  if v_inv_id is null then
    return;
  end if;

  -- Side-effects below are best-effort: a failure must never revert the
  -- accepted status, so each block swallows its own exceptions.

  -- (b) Assign the chosen teams to the new member.
  begin
    if v_team_ids is not null and array_length(v_team_ids, 1) > 0 then
      insert into public.member_teams (profile_id, team_id, club_id)
      select auth.uid(), unnest(v_team_ids), v_club
      on conflict (profile_id, team_id) do nothing;
    end if;
  exception when others then null;
  end;

  -- (c) Record a club-level "joined" activity entry (team_id null = club event).
  begin
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (v_club, null, auth.uid(), 'member.joined', 'profiles', auth.uid(),
            jsonb_build_object('role', v_role, 'team_ids', v_team_ids,
                               'email', (select email from auth.users where id = auth.uid())));
  exception when others then null;
  end;

  -- (d) Notify the club admins/owners (skip the member who just joined).
  begin
    insert into public.notifications (user_id, club_id, type, title, body, link)
    select p.id, v_club, 'member_joined',
           'New member joined',
           coalesce((select full_name from public.profiles where id = auth.uid()), 'A new member') || ' joined the club',
           '/Admin.html'
    from public.profiles p
    where p.club_id = v_club
      and (p.role in ('admin','owner') or p.club_role in ('admin','owner'))
      and p.id <> auth.uid();
  exception when others then null;
  end;

  -- (e) Copy the role's permission template into the new member's modules.
  begin
    perform public.apply_role_template(v_club, auth.uid(), v_role);
  exception when others then null;
  end;
end; $function$
;

CREATE OR REPLACE FUNCTION public.acknowledge_wellness(p_wellness_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.wellness
     set acknowledged_at = now(),
         acknowledged_by = auth.uid()
   where id = p_wellness_id
     and club_id = public.get_user_club_id();
end; $function$
;

CREATE OR REPLACE FUNCTION public.activity_team_for_player(p_player uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select team_id from public.players where id = p_player $function$
;

CREATE OR REPLACE FUNCTION public.apply_role_template(p_club uuid, p_profile uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.member_modules (club_id, profile_id, module_key)
  select p_club, p_profile, module_key
  from public.role_default_modules
  where club_id = p_club and role = p_role
  on conflict (profile_id, module_key) do nothing;
exception when others then null;
end; $function$
;

CREATE OR REPLACE FUNCTION public.assign_rpe_session(p_rpe_id uuid, p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; s record;
begin
  select * into r from public.rpe where id = p_rpe_id;
  if not found then return jsonb_build_object('error','rpe_not_found'); end if;
  select * into s from public.training_sessions where id = p_session_id;
  if not found then return jsonb_build_object('error','session_not_found'); end if;
  if r.club_id <> s.club_id then return jsonb_build_object('error','club_mismatch'); end if;

  update public.rpe
     set session_id   = s.id,
         session_date = s.session_date,                 -- adopta la fecha de la sesión
         duration     = s.duration,
         load         = r.rpe * coalesce(s.duration, r.duration)
   where id = r.id;

  return jsonb_build_object('ok', true);
end; $function$
;

CREATE OR REPLACE FUNCTION public.assign_user_to_club(p_user_id uuid, p_club_id uuid, p_role text DEFAULT 'staff'::text, p_email text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_club_id UUID;
  caller_role    TEXT;
BEGIN
  SELECT club_id, role
    INTO caller_club_id, caller_role
    FROM public.profiles
   WHERE id = auth.uid();

  -- Allow: platform admin OR club admin assigning to their own club
  IF NOT (
    public.is_platform_admin()
    OR (caller_club_id = p_club_id AND caller_role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: must be platform admin or admin of the target club';
  END IF;

  INSERT INTO public.profiles (id, club_id, role, email)
  VALUES (p_user_id, p_club_id, p_role, p_email)
  ON CONFLICT (id) DO UPDATE
    SET club_id = EXCLUDED.club_id,
        role    = EXCLUDED.role;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_player_load(p_player_id uuid, p_days_acute integer DEFAULT 7, p_days_chronic integer DEFAULT 28)
 RETURNS TABLE(acute_load numeric, chronic_load numeric, acwr numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH acute_load_cte AS (
    SELECT SUM(COALESCE(load, 0)) as total_load
    FROM public.rpe
    WHERE player_id = p_player_id
      AND created_at > NOW() - (p_days_acute || ' days')::INTERVAL
  ),
  chronic_load_cte AS (
    SELECT SUM(COALESCE(load, 0)) as total_load
    FROM public.rpe
    WHERE player_id = p_player_id
      AND created_at > NOW() - (p_days_chronic || ' days')::INTERVAL
  )
  SELECT 
    COALESCE(a.total_load, 0)::NUMERIC,
    COALESCE(c.total_load, 0)::NUMERIC,
    CASE 
      WHEN c.total_load = 0 THEN 0
      ELSE ROUND((COALESCE(a.total_load, 0)::NUMERIC / (c.total_load)::NUMERIC), 2)
    END as acwr
  FROM acute_load_cte a, chronic_load_cte c;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_rpe_load()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.load := NEW.rpe * NEW.duration;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_gps_credential(p_integration_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_club uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;
  if v_club <> public.get_user_club_id() then raise exception 'not authorized'; end if;

  delete from public.gps_integration_secrets where integration_id = p_integration_id;
  update public.gps_integrations
     set status = 'disabled', updated_at = now()
   where id = p_integration_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.club_has_feature(p_club_id uuid, p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.club_id = p_club_id AND public.team_has_feature(t.id, p_key)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.cm_norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(t,'')),
          'áàäâãéèëêíìïîóòöôõúùüûñçº',
          'aaaaaeeeeiiiiooooouuuunco'),
        '[-_/]+', ' ', 'g'),
      '\s+', ' ', 'g')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_single_primary_team()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if NEW.is_primary then
    update public.teams set is_primary = false
    where club_id = NEW.club_id and id <> NEW.id and is_primary = true;
  end if;
  return NEW;
end; $function$
;

CREATE OR REPLACE FUNCTION public.get_club_members(p_club_id uuid)
 RETURNS TABLE(id uuid, email text, name text, role text, club_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, email, name, role, club_id
  FROM   public.profiles
  WHERE  club_id = p_club_id
  ORDER  BY COALESCE(name, email);
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_rpe(p_club_id uuid)
 RETURNS TABLE(id uuid, player_name text, rpe numeric, session_date date, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
    select r.id,
           coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player'),
           r.rpe, r.session_date, r.created_at
    from public.rpe r
    join public.players p on p.id = r.player_id
    where r.club_id = p_club_id and r.session_id is null
    order by r.created_at desc;
end; $function$
;

CREATE OR REPLACE FUNCTION public.get_player_availability(p_club_id uuid)
 RETURNS TABLE(player_id uuid, first_name text, last_name text, status text, current_injuries integer, last_wellness timestamp without time zone, readiness integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.status,
    COUNT(i.id)::INT as current_injuries,
    MAX(w.submitted_at),
    MAX((w.readiness)::INT)
  FROM public.players p
  LEFT JOIN public.injuries i ON i.player_id = p.id AND i.status = 'active'
  LEFT JOIN public.wellness w ON w.player_id = p.id
  WHERE p.club_id = p_club_id
  GROUP BY p.id, p.first_name, p.last_name, p.status
  ORDER BY p.status DESC, p.last_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shared_calendar(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link      share_links;
  v_date_from date;
  v_date_to   date;
  v_events    jsonb;
  v_club      jsonb;
  v_mc        jsonb;
BEGIN
  SELECT * INTO v_link
    FROM share_links
    WHERE token = p_token
      AND revoked = false
      AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- Determine date range
  IF v_link.mc_id IS NOT NULL THEN
    SELECT
      start_date::date,
      end_date::date,
      jsonb_build_object(
        'id', id, 'name', name,
        'start_date', start_date, 'end_date', end_date,
        'match_date', match_date, 'rival', rival, 'home_away', home_away
      )
    INTO v_date_from, v_date_to, v_mc
    FROM microcycles WHERE id = v_link.mc_id;
  ELSIF v_link.week_start IS NOT NULL THEN
    v_date_from := v_link.week_start;
    v_date_to   := v_link.week_start + 6;
  ELSE
    v_date_from := CURRENT_DATE;
    v_date_to   := CURRENT_DATE + 30;
  END IF;

  -- Club info (non-sensitive fields only)
  SELECT jsonb_build_object('name', name, 'logo_url', logo_url)
    INTO v_club FROM clubs WHERE id = v_link.club_id;

  -- Collect events visible to players, from both tables
  SELECT jsonb_agg(row ORDER BY (row->>'event_date'), (row->>'start_time') NULLS LAST)
    INTO v_events
    FROM (
      -- calendar_events
      SELECT jsonb_build_object(
        'id',               e.id::text,
        'title',            e.title,
        'event_type',       e.type,
        'event_date',       e.date::text,
        'start_time',       e.start_time,
        'duration_minutes', e.duration_minutes,
        'location',         e.location,
        'opponent',         e.opponent,
        'home_away',        e.home_away,
        'competition',      e.competition
      ) AS row
      FROM calendar_events e
      WHERE e.club_id = v_link.club_id
        AND 'players' = ANY(COALESCE(e.visible_to, ARRAY['staff']))
        AND e.date >= v_date_from
        AND e.date <= v_date_to
      UNION ALL
      -- training_sessions
      SELECT jsonb_build_object(
        'id',               t.id::text,
        'title',            t.title,
        'event_type',       t.session_type,
        'event_date',       t.session_date::text,
        'start_time',       t.session_time,
        'duration_minutes', t.duration,
        'location',         NULL,
        'opponent',         NULL,
        'home_away',        NULL,
        'competition',      NULL
      ) AS row
      FROM training_sessions t
      WHERE t.club_id = v_link.club_id
        AND 'players' = ANY(COALESCE(t.visible_to, ARRAY['staff']))
        AND t.session_date >= v_date_from
        AND t.session_date <= v_date_to
    ) sub;

  RETURN jsonb_build_object(
    'club',       v_club,
    'mc',         v_mc,
    'date_from',  v_date_from,
    'date_to',    v_date_to,
    'events',     COALESCE(v_events, '[]'::jsonb)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shared_nutrition(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link    public.share_links;
  v_player  public.players;
  v_club    jsonb;
  v_target  jsonb;
  v_asg     record;
  v_meals   jsonb;
begin
  select * into v_link
    from public.share_links
   where token = p_token
     and revoked = false
     and scope = 'nutrition'
     and (expires_at is null or expires_at > now());

  if not found or v_link.player_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_player
    from public.players
   where id = v_link.player_id and club_id = v_link.club_id;
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select jsonb_build_object('name', name, 'logo_url', logo_url, 'primary_color', primary_color)
    into v_club from public.clubs where id = v_link.club_id;

  select jsonb_build_object(
           'kcal_target', kcal_target, 'protein_g', protein_g, 'carbs_g', carbs_g,
           'fats_g', fats_g, 'hydration_ml', hydration_ml, 'body_fat_target_pct', body_fat_target_pct)
    into v_target
    from public.nutrition_targets where player_id = v_link.player_id;

  -- asignación activa: hoy > recurrente por day_type > más reciente
  select a.scale_factor, t.id as template_id, t.name as template_name
    into v_asg
    from public.player_meal_assignments a
    join public.meal_plan_templates t on t.id = a.template_id
   where a.player_id = v_link.player_id and a.club_id = v_link.club_id
   order by (a.assigned_date = current_date) desc,
            (a.day_type is not null) desc,
            a.assigned_date desc nulls last
   limit 1;

  if v_asg.template_id is not null then
    select jsonb_agg(meal order by ord) into v_meals
      from (
        select m.meal_order as ord,
               jsonb_build_object(
                 'name', m.name,
                 'time_hint', m.time_hint,
                 'items', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                       'food_name',  f.name,
                       'quantity_g', round((mi.quantity_g * coalesce(v_asg.scale_factor, 1))::numeric, 0),
                       'kcal',       f.kcal,
                       'protein_g',  f.protein_g,
                       'carbs_g',    f.carbs_g,
                       'fats_g',     f.fats_g)), '[]'::jsonb)
                   from public.meal_plan_items mi
                   join public.foods f on f.id = mi.food_id
                   where mi.meal_id = m.id)
               ) as meal
        from public.meal_plan_meals m
        where m.template_id = v_asg.template_id
      ) s;
  end if;

  return jsonb_build_object(
    'club', v_club,
    'player', jsonb_build_object(
      'name', trim(coalesce(v_player.first_name, '') || ' ' || coalesce(v_player.last_name, '')),
      'position', v_player.position,
      'number', v_player.number),
    'target', v_target,
    'plan', case when v_asg.template_id is not null
              then jsonb_build_object('name', v_asg.template_name,
                                      'scale_factor', v_asg.scale_factor,
                                      'meals', coalesce(v_meals, '[]'::jsonb))
              else null end);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_survey_history(p_token text, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_scope text; v_club uuid; v_hist jsonb;
begin
  select scope, club_id into v_scope, v_club
  from share_links
  where token = p_token and (expires_at is null or expires_at > now())
  limit 1;

  if v_scope is null then return jsonb_build_object('error','invalid_token'); end if;
  if not exists (select 1 from players where id = p_player_id and club_id = v_club) then
    return jsonb_build_object('error','player_not_in_scope');
  end if;

  if v_scope = 'rpe' then
    select coalesce(jsonb_agg(
             jsonb_build_object('d', created_at::date, 'rpe', rpe, 'duration', duration, 'load', load)
             order by created_at), '[]'::jsonb)
      into v_hist
    from rpe where player_id = p_player_id and club_id = v_club
      and created_at >= now() - interval '7 days';
  else
    select coalesce(jsonb_agg(
             jsonb_build_object('d', submitted_at::date, 'readiness', readiness,
                                'hooper_index', hooper_index,
                                'sleep_quality', sleep_quality, 'mood', mood,
                                'fatigue', fatigue, 'stress', stress, 'soreness', soreness)
             order by submitted_at), '[]'::jsonb)
      into v_hist
    from wellness where player_id = p_player_id and club_id = v_club
      and submitted_at >= now() - interval '7 days';
  end if;

  return jsonb_build_object('scope', v_scope, 'history', coalesce(v_hist, '[]'::jsonb));
end; $function$
;

CREATE OR REPLACE FUNCTION public.get_survey_meta(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_link record;
begin
  select scope into v_link from public.share_links
   where token = p_token and revoked = false
     and (expires_at is null or expires_at > now())
     and scope in ('wellness','rpe','survey');
  if not found then return jsonb_build_object('valid', false); end if;
  return jsonb_build_object('valid', true, 'scope', v_link.scope);
end; $function$
;

CREATE OR REPLACE FUNCTION public.get_survey_players(p_token text)
 RETURNS TABLE(id uuid, name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_link record;
begin
  select * into v_link from public.share_links
   where token = p_token and revoked = false
     and (expires_at is null or expires_at > now())
     and scope in ('wellness','rpe','survey');
  if not found then return; end if;

  return query
    select p.id,
           coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), 'Player') as name
    from public.players p
    where p.club_id = v_link.club_id
      and p.archived_at is null
      and (v_link.team_id is null or p.team_id = v_link.team_id)
    order by p.last_name nulls last, p.first_name nulls last;
end; $function$
;

CREATE OR REPLACE FUNCTION public.get_user_club_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT club_id FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.gps_session_agg(p_club_id uuid, p_session_ids uuid[], p_player_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(session_id uuid, n_players integer, total_distance_avg numeric, high_speed_distance_avg numeric, very_high_speed_distance_avg numeric, sprint_distance_avg numeric, sprint_count_avg numeric, max_speed_avg numeric, max_speed_max numeric, avg_speed_avg numeric, accelerations_avg numeric, decelerations_avg numeric, player_load_avg numeric, hmld_avg numeric, time_played_avg numeric, distance_per_minute_avg numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    r.session_id,
    count(*)::int                       as n_players,
    avg(r.total_distance)               as total_distance_avg,
    avg(r.high_speed_distance)          as high_speed_distance_avg,
    avg(r.very_high_speed_distance)     as very_high_speed_distance_avg,
    avg(r.sprint_distance)              as sprint_distance_avg,
    avg(r.sprint_count)                 as sprint_count_avg,
    avg(r.max_speed)                    as max_speed_avg,
    max(r.max_speed)                    as max_speed_max,
    avg(r.avg_speed)                    as avg_speed_avg,
    avg(r.accelerations)                as accelerations_avg,
    avg(r.decelerations)                as decelerations_avg,
    avg(r.player_load)                  as player_load_avg,
    avg(r.hmld)                         as hmld_avg,
    avg(r.time_played)                  as time_played_avg,
    avg(r.distance_per_minute)          as distance_per_minute_avg
  from public.gps_reports r
  where r.club_id = p_club_id
    and r.is_invalid = false
    and r.session_id = any(p_session_ids)
    and (p_player_ids is null or r.player_id = any(p_player_ids))
  group by r.session_id;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_comp_subscription(p_team_id uuid, p_plan_slug text DEFAULT 'full'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_club_id uuid; v_plan_id uuid; v_sub_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede otorgar cortesías';
  END IF;

  SELECT club_id INTO v_club_id FROM public.teams WHERE id = p_team_id;
  IF v_club_id IS NULL THEN RAISE EXCEPTION 'team % no existe', p_team_id; END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan % no existe', p_plan_slug; END IF;

  -- cancelar cualquier sub viva del team (deja rastro en el historial)
  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now()
   WHERE team_id = p_team_id
     AND status IN ('active','trialing','past_due','paused');

  INSERT INTO public.subscriptions
    (team_id, club_id, plan_id, status, billing_cycle, is_comp, current_period_start, current_period_end)
  VALUES
    (p_team_id, v_club_id, v_plan_id, 'active', 'monthly', true, now(), now() + interval '10 years')
  RETURNING id INTO v_sub_id;

  RETURN v_sub_id;
END; $function$
;

CREATE OR REPLACE FUNCTION public.grant_comp_subscription_club(p_club_id uuid, p_plan_slug text DEFAULT 'full'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; r record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede otorgar cortesías';
  END IF;
  FOR r IN SELECT id FROM public.teams WHERE club_id = p_club_id LOOP
    PERFORM public.grant_comp_subscription(r.id, p_plan_slug);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid := (new.raw_user_meta_data ->> 'club_id')::uuid;
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', null);
begin
  if v_club is not null then
    insert into public.profiles (id, club_id, email, full_name, role)
    values (new.id, v_club, new.email,
            coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email,'@',1)),
            coalesce(v_role, 'staff'))
    on conflict (id) do nothing;
  end if;
  return new;
exception when others then return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.has_full_planning_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_super_admin()
      or exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('admin','owner'));
$function$
;

CREATE OR REPLACE FUNCTION public.has_medical_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_super_admin()
      or exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and (lower(coalesce(p.role,'')) in ('admin','owner','physio')
                     or lower(coalesce(p.club_role,'')) in ('admin','owner','physio')));
$function$
;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.link_pending_rpe(p_club_id uuid, p_date date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0;
begin
  for r in
    select id from public.rpe
    where club_id = p_club_id and session_id is null
      and (p_date is null or coalesce(session_date, created_at::date) = p_date)
  loop
    perform public.link_rpe_to_session(r.id);
    n := n + 1;
  end loop;
  return n;
end; $function$
;

CREATE OR REPLACE FUNCTION public.link_rpe_to_session(p_rpe_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; s record; v_team uuid;
begin
  select * into r from public.rpe where id = p_rpe_id;
  if not found or r.session_id is not null then return; end if;

  -- categoría del jugador
  select team_id into v_team from public.players where id = r.player_id;

  -- buscar sesión de la misma fecha Y de la categoría del jugador
  select ts.* into s
  from public.training_sessions ts
  where ts.club_id = r.club_id
    and ts.session_date = coalesce(r.session_date, r.created_at::date)
    and (v_team is null or ts.team_id = v_team)   -- ← ahora matchea por categoría
  order by ts.duration desc nulls last
  limit 1;

  if found then
    update public.rpe
       set session_id = s.id,
           duration   = coalesce(r.duration, s.duration),
           load       = r.rpe * coalesce(s.duration, r.duration)
     where id = r.id;
  end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.log_audit(p_table text, p_op text, p_changes jsonb DEFAULT NULL::jsonb, p_club_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_own uuid; v_club uuid; v_super boolean;
begin
  select club_id into v_own from public.profiles where id = auth.uid();
  v_super := public.is_super_admin();
  -- usar el club pasado solo si sos super-admin o es tu propio club; si no, el tuyo
  if p_club_id is not null and (v_super or p_club_id = v_own) then v_club := p_club_id;
  else v_club := v_own; end if;
  if v_club is null then return; end if;
  set local row_security = off;
  insert into public.audit_log (club_id, actor_id, table_name, operation, changes)
  values (v_club, auth.uid(), p_table, p_op, p_changes);
end; $function$
;

CREATE OR REPLACE FUNCTION public.my_plan_features()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_club uuid := public.get_user_club_id();
  v_feats jsonb;
  v_has_teams boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.teams WHERE club_id = v_club) INTO v_has_teams;

  IF NOT v_has_teams THEN
    SELECT coalesce(features,'[]'::jsonb) INTO v_feats
      FROM public.plans WHERE slug = 'initiation';
    RETURN coalesce(v_feats,'[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(DISTINCT elem), '[]'::jsonb)
    INTO v_feats
    FROM public.teams t
    CROSS JOIN LATERAL jsonb_array_elements_text(public.team_features(t.id)) AS elem
   WHERE t.club_id = v_club;

  RETURN coalesce(v_feats,'[]'::jsonb);
END; $function$
;

CREATE OR REPLACE FUNCTION public.my_player_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id from public.players p
  where public.is_super_admin()   -- super-admin: todos los players (el frontend acota por club activo + equipo)
     or (
      p.club_id = (select club_id from public.profiles where id = auth.uid())
      and (
        exists (select 1 from public.profiles pr where pr.id = auth.uid()
                and (pr.role in ('admin','owner') or pr.club_role in ('admin','owner')))
        or exists (
          select 1 from public.player_teams pt
          where pt.player_id = p.id
            and pt.team_id in (select public.my_team_ids())
        )
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select role from public.profiles where id = auth.uid() limit 1; $function$
;

CREATE OR REPLACE FUNCTION public.my_team_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select team_id from public.member_teams where profile_id = auth.uid();
$function$
;

-- Does this session have a GPS report for one of MY players? SECURITY DEFINER so it reads
-- gps_reports WITHOUT re-triggering RLS — avoids mutual recursion with the training_sessions /
-- gps_reports policies. Used to let staff see the session rows behind GPS data they can already
-- read (e.g. Catapult imports whose team_id is NULL).
CREATE OR REPLACE FUNCTION public.session_has_my_gps(p_session uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.gps_reports r
    where r.session_id = p_session
      and r.player_id in (select public.my_player_ids())
  );
$function$
;

-- Same idea for a microcycle: visible if any of its sessions carries GPS for one of my players.
CREATE OR REPLACE FUNCTION public.microcycle_has_my_gps(p_mc text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.training_sessions ts
    join public.gps_reports r on r.session_id = ts.id
    where ts.microcycle_id = p_mc
      and r.player_id in (select public.my_player_ids())
  );
$function$
;

CREATE OR REPLACE FUNCTION public.primary_team_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.teams
  where club_id = public.get_user_club_id()
  order by is_primary desc, created_at asc
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.process_due_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  for r in
    select tr.id as reminder_id, tr.club_id,
           t.team_id, t.assigned_to, t.assigned_roles, t.title, t.created_by, t.status
    from public.task_reminders tr
    join public.tasks t on t.id = tr.task_id
    where tr.sent_at is null and tr.remind_at <= now()
  loop
    -- Per-reminder isolation: one failure must not abort the rest of the batch.
    begin
      -- Skip closed tasks, but still stamp sent so they aren't re-evaluated forever.
      if r.status not in ('done', 'cancelled') then
        insert into public.notifications (user_id, club_id, type, title, body, link)
        select uid, r.club_id, 'task_reminder',
               'Reminder: ' || r.title, 'This task is due soon.', '/Chat & Tasks.html'
        from (
          select r.assigned_to as uid where r.assigned_to is not null
          union
          select r.created_by where r.created_by is not null
          union
          select p.id
          from public.profiles p
          where r.assigned_roles is not null
            and p.club_id = r.club_id
            and lower(coalesce(p.role, '')) = any (r.assigned_roles)
            and ( r.team_id is null
                  or p.id in (select mt.profile_id from public.member_teams mt
                              where mt.team_id = r.team_id) )
        ) recips
        where uid is not null;
      end if;

      update public.task_reminders set sent_at = now() where id = r.reminder_id;
    exception when others then
      null;  -- leave sent_at null → next run retries this reminder
    end;
  end loop;
end; $function$
;

-- Birthday reminders: one notification per club staff member the day BEFORE and the day OF
-- each active player's birthday. Idempotent (guarded by same-day + same-title) so a daily
-- cron can run it safely. Scheduled via pg_cron (see the cron.schedule setup, run once).
CREATE OR REPLACE FUNCTION public.notify_player_birthdays()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, club_id, type, title, body, link)
  select pr.id, pl.club_id, 'player_birthday', bd.title, bd.body, '/Squad.html'
  from public.players pl
  cross join lateral (
    select case
             when to_char(pl.date_of_birth,'MM-DD') = to_char(current_date,     'MM-DD') then 0
             when to_char(pl.date_of_birth,'MM-DD') = to_char(current_date + 1,  'MM-DD') then 1
           end as d
  ) m
  cross join lateral (
    select nullif(trim(coalesce(pl.first_name,'')||' '||coalesce(pl.last_name,'')), '') as nm
  ) nc
  cross join lateral (
    select
      case when m.d = 0
           then '🎂 ' || nc.nm || '''s birthday is today'
           else '🎂 ' || nc.nm || '''s birthday is tomorrow'
      end as title,
      'Turns ' || (extract(year from (current_date + m.d))::int - extract(year from pl.date_of_birth)::int)
        || ' · born ' || to_char(pl.date_of_birth, 'DD Mon YYYY') as body
  ) bd
  join public.profiles pr on pr.club_id = pl.club_id
  where pl.date_of_birth is not null
    and pl.archived_at is null
    and m.d is not null
    and nc.nm is not null
    and not exists (
      select 1 from public.notifications n
      where n.user_id = pr.id
        and n.type = 'player_birthday'
        and n.created_at::date = current_date
        and n.title = bd.title
    );
end; $function$
;

CREATE OR REPLACE FUNCTION public.recent_sessions(p_club_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, title text, session_date date, duration integer, session_type text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
    select ts.id, ts.title, ts.session_date, ts.duration, ts.session_type
    from public.training_sessions ts
    where ts.club_id = p_club_id
    order by ts.session_date desc
    limit p_limit;
end; $function$
;

CREATE OR REPLACE FUNCTION public.register_new_club(p_club_name text, p_country text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_club_id uuid;
  v_slug    text;
BEGIN
  -- Generate URL-safe slug from club name
  v_slug := lower(regexp_replace(trim(p_club_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  -- Append random suffix if slug already exists
  IF EXISTS (SELECT 1 FROM clubs WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || floor(random() * 9000 + 1000)::text;
  END IF;

  -- Create the club
  INSERT INTO clubs (name, slug, country)
  VALUES (p_club_name, v_slug, p_country)
  RETURNING id INTO v_club_id;

  -- Create admin profile for the registering user (email pulled from auth.users)
  INSERT INTO profiles (id, email, club_id, role)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    v_club_id,
    'admin'
  )
  ON CONFLICT (id) DO UPDATE SET club_id = v_club_id, role = 'admin';

  RETURN v_club_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_comp_subscription(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'solo un platform admin puede revocar cortesías';
  END IF;
  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now()
   WHERE team_id = p_team_id AND is_comp = true AND status = 'active';
END; $function$
;

CREATE OR REPLACE FUNCTION public.role_bucket(p_role text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case lower(coalesce(p_role,''))
    when 'owner' then 'admin'
    when 'admin' then 'admin'
    when 'medical' then 'medical' when 'physio' then 'medical' when 'doctor' then 'medical' when 'nutritionist' then 'medical'
    when 'sc_coach' then 'sc' when 'fitness_coach' then 'sc'
    when 'coach' then 'coach' when 'assistant_coach' then 'coach' when 'gk_coach' then 'coach'
    when 'analyst' then 'analyst'
    else 'staff' end;
$function$
;

-- Who can SEE a dashboard: the owner (personal) · club-wide defaults · a team the
-- user belongs to (team-shared) · admins/owners (all of their club). SECURITY DEFINER
-- so the check itself never re-triggers dashboards RLS (no recursion).
CREATE OR REPLACE FUNCTION public.can_view_dashboard(p_dash uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.dashboards d
    where d.id = p_dash
      and d.club_id = public.get_user_club_id()
      and (
        public.is_super_admin()
        or public.role_bucket((select role from public.profiles where id = auth.uid())) = 'admin'
        or d.owner_id = auth.uid()
        or (d.is_shared and d.team_id is null)
        or (d.is_shared and d.team_id in (select public.my_team_ids()))
      )
  );
$function$
;

-- Who can EDIT a dashboard (add/remove cards, rename, delete): the owner · admins/owners ·
-- performance/coaching staff (S&C, Fitness, Head/Assistant/GK coach — role_bucket 'sc'|'coach')
-- assigned to that team, for a team-shared dashboard. Physio/analyst/etc. can own & edit their
-- OWN dashboards but not others' team boards.
CREATE OR REPLACE FUNCTION public.can_edit_dashboard(p_dash uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.dashboards d
    where d.id = p_dash
      and d.club_id = public.get_user_club_id()
      and (
        public.is_super_admin()
        or public.role_bucket((select role from public.profiles where id = auth.uid())) = 'admin'
        or d.owner_id = auth.uid()
        -- shared boards (club-wide defaults with team_id null, OR a specific team) are edited by
        -- performance/coaching staff; for a team board they must belong to that team.
        or (d.is_shared
            and public.role_bucket((select role from public.profiles where id = auth.uid())) in ('sc','coach')
            and (d.team_id is null or d.team_id in (select public.my_team_ids())))
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.seed_core_metrics_for_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  set local row_security = off;   -- seeding de sistema: saltea la RLS de usuario
  INSERT INTO gps_metric_definitions
    (club_id, key, label, unit, category, decimals, is_core, display_order)
  VALUES
    (NEW.id, 'total_distance',           'Total Distance',  'm',     'distance', 0,  true,  1),
    (NEW.id, 'high_speed_distance',      'HSR',             'm',     'distance', 0,  true,  2),
    (NEW.id, 'very_high_speed_distance', 'VHSR',            'm',     'distance', 0,  true,  3),
    (NEW.id, 'sprint_distance',          'Sprint Distance', 'm',     'distance', 0,  true,  4),
    (NEW.id, 'sprint_count',             'Sprint Count',    'n',     'count',    0,  true,  5),
    (NEW.id, 'max_speed',                'Max Speed',       'km/h',  'speed',    1,  true,  6),
    (NEW.id, 'avg_speed',                'Avg Speed',       'km/h',  'speed',    1,  true,  7),
    (NEW.id, 'accelerations',            'Accelerations',   'n',     'count',    0,  true,  8),
    (NEW.id, 'decelerations',            'Decelerations',   'n',     'count',    0,  true,  9),
    (NEW.id, 'player_load',              'Player Load',     'AU',    'load',     1,  true, 10),
    (NEW.id, 'hmld',                     'HMLD',            'm',     'load',     0,  true, 11),
    (NEW.id, 'time_played',              'Time Played',     'min',   'time',     0,  true, 12),
    (NEW.id, 'distance_per_minute',      'Distance / Min',  'm/min', 'distance', 1,  true, 13)
  ON CONFLICT (club_id, key) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_default_exercises_for_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO gym_exercises
    (club_id, name, category, muscle_group, complexity, equipment,
     usable_in, description, is_default, default_key)
  SELECT NEW.id, d.name, d.category, d.muscle_group, d.complexity, d.equipment,
         d.usable_in, d.description, true, d.default_key
  FROM default_exercises d
  ON CONFLICT (club_id, default_key) WHERE default_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.session_rpe_status(p_session_id uuid)
 RETURNS TABLE(player_id uuid, player_name text, responded boolean, rpe numeric, note text, body_areas text[], duration integer, load numeric, submitted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid;
  v_team uuid;
  v_date date;
  v_dur  integer;
begin
  -- Qualify with the table alias: `duration`/`load` are also OUT columns of this function,
  -- so an unqualified `duration` would be an ambiguous reference and raise at runtime.
  select ts.club_id, ts.team_id, ts.session_date, ts.duration into v_club, v_team, v_date, v_dur
  from public.training_sessions ts
  where ts.id = p_session_id;

  return query
    select q.player_id, q.player_name, q.responded, q.rpe,
           q.note, q.body_areas, q.duration, q.load, q.submitted_at
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (r.id is not null) as responded,
        r.rpe        as rpe,
        r.note       as note,
        r.body_areas as body_areas,
        -- Duration/load follow the session's CURRENT effective duration (from Daily Planning),
        -- so already-submitted RPE updates if the plan's effective time changes.
        coalesce(v_dur, r.duration)             as duration,
        r.rpe * coalesce(v_dur, r.duration)     as load,
        r.created_at as submitted_at,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.rpe r
        on r.player_id = p.id and r.session_id = p_session_id
      where p.club_id = v_club
        and p.archived_at is null
        and p.status <> 'inactive'
        and (v_team is null or p.team_id = v_team)
        -- Not expected to check in that day: sick, unavailable, or national-team (away).
        and not exists (
          select 1 from public.availability a
          where a.player_id = p.id::text and a.date = v_date
            and a.status in ('sick','unavailable','away')
        )
      order by p.id, r.created_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_club_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_drills_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_gps_credential(p_integration_id uuid, p_credential text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_club uuid;
begin
  select club_id into v_club from public.gps_integrations where id = p_integration_id;
  if v_club is null then raise exception 'integration not found'; end if;
  if v_club <> public.get_user_club_id() then raise exception 'not authorized'; end if;

  insert into public.gps_integration_secrets (integration_id, credential, set_at)
       values (p_integration_id, p_credential, now())
  on conflict (integration_id) do update set credential = excluded.credential, set_at = now();

  update public.gps_integrations
     set status = 'configured', connected_at = null, updated_at = now()
   where id = p_integration_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_member_role(target_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_club uuid; caller_is_admin boolean; caller_is_owner boolean; caller_super boolean; target_club uuid;
begin
  select club_id,
         (role in ('admin','owner') or club_role in ('admin','owner')),
         (role = 'owner' or club_role = 'owner')
    into caller_club, caller_is_admin, caller_is_owner
  from public.profiles where id = auth.uid();
  caller_super := public.is_super_admin();

  if not caller_is_admin and not caller_super then raise exception 'Not authorized'; end if;

  select club_id into target_club from public.profiles where id = target_id;
  if target_club is null then raise exception 'Target not found'; end if;
  if not caller_super and target_club <> caller_club then raise exception 'Target not in your club'; end if;

  if new_role not in ('owner','admin','coach','physio','analyst','nutritionist','staff',
                      'sc_coach','fitness_coach','gk_coach','assistant_coach') then
    raise exception 'Invalid role';
  end if;
  if new_role = 'owner' and not (caller_is_owner or caller_super) then
    raise exception 'Only an owner can grant owner';
  end if;

  update public.profiles set role = new_role where id = target_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_member_secondary_role(target_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_club uuid; caller_is_admin boolean; caller_super boolean; target_club uuid; norm text;
begin
  select club_id,
         (role in ('admin','owner') or club_role in ('admin','owner'))
    into caller_club, caller_is_admin
  from public.profiles where id = auth.uid();
  caller_super := public.is_super_admin();

  if not caller_is_admin and not caller_super then raise exception 'Not authorized'; end if;

  select club_id into target_club from public.profiles where id = target_id;
  if target_club is null then raise exception 'Target not found'; end if;
  if not caller_super and target_club <> caller_club then raise exception 'Target not in your club'; end if;

  norm := nullif(trim(coalesce(new_role,'')), '');
  if norm is not null and norm not in ('admin','coach','physio','analyst','nutritionist','staff',
                      'sc_coach','fitness_coach','gk_coach','assistant_coach') then
    raise exception 'Invalid role';
  end if;

  update public.profiles set club_role = norm where id = target_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.stamp_lineup_publish()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'official' AND (OLD.status IS NULL OR OLD.status <> 'official') THEN
    NEW.published_at := now();
    NEW.published_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_survey(p_token text, p_player_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link record; v_ok boolean; v_read int; v_hooper int;
  v_areas text[]; v_note text; v_pname text; v_team uuid; v_rpe_id uuid; v_dur int; v_sdate date;
  v_tz int; v_local_date date;
begin
  select * into v_link from public.share_links
   where token = p_token and revoked = false
     and (expires_at is null or expires_at > now())
     and scope in ('wellness','rpe','survey');
  if not found then return jsonb_build_object('error','invalid_token'); end if;

  -- Client's Date.getTimezoneOffset() (minutes) → derive the submitter's local "today" so the
  -- one-per-day lock resets at local midnight, not UTC midnight.
  v_tz := coalesce((p_payload->>'tzOffset')::int, 0);
  v_local_date := ((now() at time zone 'UTC') - make_interval(mins => v_tz))::date;

  select exists (
    select 1 from public.players p
    where p.id = p_player_id and p.club_id = v_link.club_id
      and (v_link.team_id is null or p.team_id = v_link.team_id)
  ) into v_ok;
  if not v_ok then return jsonb_build_object('error','player_not_in_scope'); end if;

  select array(select jsonb_array_elements_text(coalesce(p_payload->'body','[]'::jsonb))) into v_areas;
  v_note := nullif(trim(coalesce(p_payload->>'note','')), '');

  if v_link.scope = 'rpe' then
    if v_link.session_id is not null then
      -- Candado por sesión: ya respondió esta sesión.
      if exists (select 1 from public.rpe
                 where club_id = v_link.club_id and player_id = p_player_id
                   and session_id = v_link.session_id) then
        return jsonb_build_object('ok', true, 'already', true);
      end if;
      select duration, session_date into v_dur, v_sdate from public.training_sessions where id = v_link.session_id;
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_id, duration, load, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas,
              v_link.session_id, v_dur, (p_payload->>'rpe')::numeric * coalesce(v_dur, 0), coalesce(v_sdate, current_date));
    else
      -- Candado por día (link sin sesión): ya respondió hoy (día local del jugador).
      if exists (select 1 from public.rpe
                 where club_id = v_link.club_id and player_id = p_player_id
                   and coalesce(session_date, ((created_at at time zone 'UTC') - make_interval(mins => v_tz))::date) = v_local_date) then
        return jsonb_build_object('ok', true, 'already', true);
      end if;
      insert into public.rpe (club_id, player_id, rpe, note, body_areas, session_date)
      values (v_link.club_id, p_player_id, (p_payload->>'rpe')::numeric, v_note, v_areas, v_local_date)
      returning id into v_rpe_id;
      perform public.link_rpe_to_session(v_rpe_id);
    end if;
  else
    -- Wellness: uno por día (día local del jugador, no UTC).
    if exists (
      select 1 from public.wellness
      where player_id = p_player_id and club_id = v_link.club_id
        and ((submitted_at at time zone 'UTC') - make_interval(mins => v_tz))::date = v_local_date
    ) then
      return jsonb_build_object('ok', true, 'already', true);
    end if;

    if (p_payload->>'scale') = '7' then
      v_hooper := coalesce((p_payload->>'sleepQ')::int,4) + coalesce((p_payload->>'fatigue')::int,4)
                + coalesce((p_payload->>'stress')::int,4) + coalesce((p_payload->>'soreness')::int,4);
      v_read := round(10 - (v_hooper - 4) / 24.0 * 10)::int;
      insert into public.wellness (club_id, player_id, sleep_quality, mood, fatigue, stress, soreness, hooper_index, readiness, note, body_areas, submitted_at)
      values (v_link.club_id, p_player_id, (p_payload->>'sleepQ')::int, (p_payload->>'mood')::int,
              (p_payload->>'fatigue')::int, (p_payload->>'stress')::int, (p_payload->>'soreness')::int,
              v_hooper, v_read, v_note, v_areas, now());
    else
      v_read := round((
        coalesce((p_payload->>'sleepQ')::int,5) + coalesce((p_payload->>'mood')::int,5) +
        coalesce((p_payload->>'fatigue')::int,5) + (10 - coalesce((p_payload->>'stress')::int,5)) +
        (10 - coalesce((p_payload->>'soreness')::int,5))
      ) / 5.0);
      insert into public.wellness (club_id, player_id, sleep_quality, mood, fatigue, stress, soreness, readiness, note, body_areas, submitted_at)
      values (v_link.club_id, p_player_id, (p_payload->>'sleepQ')::int, (p_payload->>'mood')::int,
              (p_payload->>'fatigue')::int, (p_payload->>'stress')::int, (p_payload->>'soreness')::int,
              v_read, v_note, v_areas, now());
    end if;
  end if;

  -- ALERTA por molestia (sin cambios).
  if array_length(v_areas, 1) > 0 then
    select coalesce(nullif(trim(coalesce(first_name,'')||' '||coalesce(last_name,'')),''),'A player'), team_id
      into v_pname, v_team from public.players where id = p_player_id;
    insert into public.notifications (user_id, club_id, type, title, body, link)
    select pr.id, v_link.club_id, 'wellness_alert',
           v_pname || ' reported discomfort',
           'Areas: ' || array_to_string(v_areas, ', ') || coalesce(' · "'||v_note||'"','') ||
             case when v_link.scope='rpe' then ' (post-RPE)' else '' end,
           '/Load Monitor.html'
    from public.profiles pr
    cross join lateral (select public.role_bucket(pr.role) as bucket) b
    left join public.notification_settings ns
      on ns.club_id = v_link.club_id and ns.alert_type = 'discomfort' and ns.role = b.bucket
    where pr.club_id = v_link.club_id
      and coalesce(ns.enabled, b.bucket in ('medical','admin','sc','coach')) = true
      and (
        coalesce(ns.scope, case when b.bucket in ('medical','admin') then 'club' else 'team' end) = 'club'
        or ( coalesce(ns.scope, 'team') = 'team' and v_team is not null
             and exists (select 1 from public.member_teams mt where mt.profile_id = pr.id and mt.team_id = v_team) )
      );
  end if;

  return jsonb_build_object('ok', true);
end; $function$
;

CREATE OR REPLACE FUNCTION public.sync_player_primary_team()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  affected uuid := coalesce(NEW.player_id, OLD.player_id);
begin
  update public.players p
    set team_id = (
      select pt.team_id
      from public.player_teams pt
      where pt.player_id = affected and pt.is_primary = true
      limit 1
    )
  where p.id = affected;
  return coalesce(NEW, OLD);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.team_features(p_team_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(pl.features, '[]'::jsonb)
    FROM public.plans pl
   WHERE pl.slug = public.team_plan_slug(p_team_id);
$function$
;

CREATE OR REPLACE FUNCTION public.team_has_feature(p_team_id uuid, p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.team_features(p_team_id) ? p_key;
$function$
;

CREATE OR REPLACE FUNCTION public.team_plan_slug(p_team_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT pl.slug
       FROM public.subscriptions s
       JOIN public.plans pl ON pl.id = s.plan_id
      WHERE s.team_id = p_team_id
        AND s.status IN ('active','trialing','past_due')
      ORDER BY pl.sort_order DESC   -- defensivo: si hubiera >1, la más alta
      LIMIT 1),
    'initiation'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.team_player_ids(p_team_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.players where team_id = p_team_id;
$function$
;

CREATE OR REPLACE FUNCTION public.team_player_limit(p_team_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pl.max_players
    FROM public.plans pl
   WHERE pl.slug = public.team_plan_slug(p_team_id);
$function$
;

CREATE OR REPLACE FUNCTION public.toggle_adaptation_applied(p_treatment_id uuid)
 RETURNS TABLE(applied_at timestamp with time zone, applied_by uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_club uuid;
BEGIN
  SELECT club_id INTO v_club FROM public.treatments WHERE id = p_treatment_id;
  IF v_club IS NULL OR v_club <> public.get_user_club_id() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.treatments t
     SET adaptation_applied_at = CASE WHEN t.adaptation_applied_at IS NULL THEN now() ELSE NULL END,
         adaptation_applied_by = CASE WHEN t.adaptation_applied_at IS NULL THEN auth.uid() ELSE NULL END
   WHERE t.id = p_treatment_id
  RETURNING t.adaptation_applied_at, t.adaptation_applied_by
  INTO applied_at, applied_by;

  RETURN NEXT;
END $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id::uuid), auth.uid(),
            'availability.changed', 'availability', null, NEW.player_id::uuid,
            jsonb_build_object('date', NEW.date, 'from', OLD.status, 'to', NEW.status));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_evaluation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id), auth.uid(),
          'evaluation.recorded', TG_TABLE_NAME, NEW.id, NEW.player_id,
          jsonb_build_object('test_date', NEW.test_date, 'kind', TG_TABLE_NAME));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_gps()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, actor_label, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id), 'GPS sync',
          'gps.imported', 'gps_reports', NEW.session_id, NEW.player_id,
          jsonb_build_object('session_id', NEW.session_id))
  on conflict (entity_id, ((created_at at time zone 'UTC')::date))
    where action = 'gps.imported'
    do nothing;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_injury()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id), coalesce(NEW.created_by, auth.uid()),
            'injury.logged', 'injuries', NEW.id, NEW.player_id,
            jsonb_build_object('body_area', NEW.body_area, 'injury_type', NEW.injury_type, 'severity', NEW.severity));
  elsif TG_OP = 'UPDATE'
        and NEW.status = 'cleared' and OLD.status is distinct from 'cleared' then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id), coalesce(NEW.created_by, auth.uid()),
            'injury.cleared', 'injuries', NEW.id, NEW.player_id,
            jsonb_build_object('body_area', NEW.body_area, 'returned_date', NEW.returned_date));
  end if;
  return NEW;
end $function$
;

-- Mirror an ACTIVE injury into availability as 'injured' rows, so a logged injury shows up
-- everywhere that reads availability (Availability grid, Daily Planning day squad, Hub…) without
-- anyone opening the Availability page. One row per day in [start_date, end], where end =
-- returned_date ?? expected_return ?? current_date (open-ended → filled up to today; the
-- Availability client tops it up forward as days pass). ON CONFLICT DO NOTHING so it never
-- overwrites a manual edit or an existing row. availability.player_id is text → cast.
CREATE OR REPLACE FUNCTION public.trg_injury_fill_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_end date;
begin
  if NEW.status <> 'active' then
    return NEW;   -- only an active injury blocks availability; cleared/returning don't auto-fill
  end if;
  v_end := coalesce(NEW.returned_date, NEW.expected_return, current_date);
  if v_end < NEW.start_date then
    return NEW;
  end if;
  insert into public.availability (player_id, date, status, minutes, club_id)
  select NEW.player_id::text, d::date, 'injured', 0, NEW.club_id
  from generate_series(NEW.start_date, v_end, interval '1 day') as d
  on conflict (player_id, date) do nothing;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_lineup_pub()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.published_at is not null
     and (TG_OP = 'INSERT' or OLD.published_at is distinct from NEW.published_at) then
    insert into public.activity_log (club_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, coalesce(NEW.published_by, auth.uid()), 'lineup.published', 'lineups', NEW.id,
            jsonb_build_object('match_id', NEW.match_id));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_match_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, actor_id, action, entity_table, entity_id, summary)
  values (NEW.club_id, auth.uid(), 'match_report.created', 'match_reports', NEW.id,
          jsonb_build_object('match_date', NEW.match_date));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_medical_episode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id), auth.uid(),
          'medical.episode', 'medical_episodes', NEW.id, NEW.player_id,
          jsonb_build_object('start_date', NEW.start_date, 'status', NEW.status));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_microcycle_pub()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.published_at is not null
     and (TG_OP = 'INSERT' or OLD.published_at is distinct from NEW.published_at) then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, coalesce(NEW.published_by, auth.uid()), 'microcycle.published', 'microcycles', NEW.id,
            jsonb_build_object('name', NEW.name, 'start_date', NEW.start_date));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_player()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, NEW.team_id, auth.uid(), 'player.added', 'players', NEW.id, NEW.id,
            jsonb_build_object('name', coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')));
  elsif TG_OP = 'UPDATE' and OLD.archived_at is null and NEW.archived_at is not null then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, NEW.team_id, auth.uid(), 'player.archived', 'players', NEW.id, NEW.id,
            jsonb_build_object('name', coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_rpe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id),
          'rpe.submitted', 'rpe', NEW.id, NEW.player_id,
          jsonb_build_object('rpe', NEW.rpe, 'session_id', NEW.session_id, 'load', NEW.load));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Solo cuando pasa a publicada (insert ya publicada, o update false→true)
  if NEW.published is true
     and (TG_OP = 'INSERT' or OLD.published is distinct from NEW.published) then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, coalesce(NEW.coach_id, auth.uid()), 'session.published', 'training_sessions', NEW.id,
            jsonb_build_object('title', NEW.title, 'session_type', NEW.session_type));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_session_mod()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'UPDATE' and OLD.published is true and NEW.published is true
     and (OLD.title is distinct from NEW.title
          or OLD.session_date is distinct from NEW.session_date
          or OLD.duration is distinct from NEW.duration
          or OLD.session_time is distinct from NEW.session_time) then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, coalesce(NEW.coach_id, auth.uid()), 'session.modified', 'training_sessions', NEW.id,
            jsonb_build_object('title', NEW.title, 'session_type', NEW.session_type));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, NEW.created_by, 'task.created', 'tasks', NEW.id,
            jsonb_build_object(
              'title', NEW.title,
              'mode', case when NEW.assigned_roles is not null and cardinality(NEW.assigned_roles) > 0
                           then 'role' else 'individual' end,
              'assigned_roles', NEW.assigned_roles,
              'assigned_to_name', NEW.assigned_to_name
            ));
  elsif TG_OP = 'UPDATE'
        and NEW.status = 'done' and OLD.status is distinct from 'done' then
    -- actor = quien completó (auth.uid()); si es null (proceso sin usuario), queda null y el insert va igual.
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, auth.uid(), 'task.completed', 'tasks', NEW.id,
            jsonb_build_object('title', NEW.title));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_treatment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_has_adapt boolean := coalesce(nullif(trim(coalesce(NEW.adaptation, NEW.adaptation_notes, '')), ''), null) is not null;
  v_fire boolean := false;
begin
  if NEW.notify_coaches is true and v_has_adapt then
    if TG_OP = 'INSERT' then
      v_fire := true;
    elsif TG_OP = 'UPDATE'
          and NEW.adaptation_sent_at is not null
          and OLD.adaptation_sent_at is distinct from NEW.adaptation_sent_at then
      v_fire := true;
    end if;
  end if;

  if v_fire then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id),
            coalesce(NEW.physio_id, NEW.performed_by, auth.uid()),
            'treatment.adaptation', 'treatments', NEW.id, NEW.player_id,
            jsonb_build_object('adaptation', left(coalesce(NEW.adaptation, NEW.adaptation_notes, ''), 140)));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_wellness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id),
          'wellness.submitted', 'wellness', NEW.id, NEW.player_id,
          jsonb_build_object('hooper_index', NEW.hooper_index, 'readiness', NEW.readiness));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.wellness_status(p_club_id uuid, p_team_id uuid DEFAULT NULL::uuid, p_date date DEFAULT CURRENT_DATE, p_tz_offset integer DEFAULT 0)
 RETURNS TABLE(player_id uuid, player_name text, responded boolean, readiness numeric, hooper_index numeric, sleep_quality numeric, fatigue numeric, stress numeric, soreness numeric, mood numeric, note text, body_areas text[], submitted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- p_tz_offset = client's Date.getTimezoneOffset() (minutes); lets "today" follow the club's
-- local calendar day instead of UTC, so the board resets at local midnight (not UTC midnight).
declare v_date date := coalesce(p_date, current_date);
begin
  return query
    select q.player_id, q.player_name, q.responded, q.readiness, q.hooper_index,
           q.sleep_quality, q.fatigue, q.stress, q.soreness, q.mood,
           q.note, q.body_areas, q.submitted_at
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (w.id is not null) as responded,
        w.readiness      as readiness,
        w.hooper_index   as hooper_index,
        w.sleep_quality  as sleep_quality,
        w.fatigue        as fatigue,
        w.stress         as stress,
        w.soreness       as soreness,
        w.mood           as mood,
        w.note           as note,
        w.body_areas     as body_areas,
        w.submitted_at   as submitted_at,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.wellness w
        on w.player_id = p.id
       and ((w.submitted_at at time zone 'UTC') - make_interval(mins => p_tz_offset))::date = v_date
      where p.club_id = p_club_id
        and p.archived_at is null
        and p.id in (select public.my_player_ids())
        and (p_team_id is null or p.team_id = p_team_id)
        -- Not expected to check in that day: sick, unavailable, or national-team (away).
        and not exists (
          select 1 from public.availability a
          where a.player_id = p.id::text and a.date = v_date
            and a.status in ('sick','unavailable','away')
        )
      order by p.id, w.submitted_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end; $function$
;

-- =========================== VISTAS ===========================

create or replace view public.v_exercise_gps_profile as
 SELECT r.club_id,
    m.exercise_id,
    count(*) AS n_instances,
    sum(r.duration_seconds) / 60.0 AS total_minutes,
    avg(r.total_distance / (r.duration_seconds / 60.0)) AS total_distance_per_min,
    avg(r.high_speed_distance / (r.duration_seconds / 60.0)) AS high_speed_distance_per_min,
    avg(r.very_high_speed_distance / (r.duration_seconds / 60.0)) AS very_high_speed_distance_per_min,
    avg(r.sprint_distance / (r.duration_seconds / 60.0)) AS sprint_distance_per_min,
    avg(r.sprint_count / (r.duration_seconds / 60.0)) AS sprint_count_per_min,
    avg(r.accelerations / (r.duration_seconds / 60.0)) AS accelerations_per_min,
    avg(r.decelerations / (r.duration_seconds / 60.0)) AS decelerations_per_min,
    avg(r.player_load / (r.duration_seconds / 60.0)) AS player_load_per_min,
    avg(r.hmld / (r.duration_seconds / 60.0)) AS hmld_per_min,
    avg(r.total_distance) AS total_distance_avg,
    avg(r.high_speed_distance) AS high_speed_distance_avg,
    avg(r.very_high_speed_distance) AS very_high_speed_distance_avg,
    avg(r.sprint_distance) AS sprint_distance_avg,
    avg(r.sprint_count) AS sprint_count_avg,
    avg(r.accelerations) AS accelerations_avg,
    avg(r.decelerations) AS decelerations_avg,
    avg(r.player_load) AS player_load_avg,
    avg(r.hmld) AS hmld_avg
   FROM gps_period_reports r
     JOIN gps_drill_map m ON m.club_id = r.club_id AND m.period_name = r.period_name
  WHERE m.exercise_id IS NOT NULL AND m.ignored = false AND r.duration_seconds >= 30::numeric AND (r.total_distance IS NULL OR (r.total_distance / r.duration_seconds) <= 13::numeric) AND (r.total_distance IS NULL OR r.high_speed_distance IS NULL OR r.total_distance >= r.high_speed_distance)
  GROUP BY r.club_id, m.exercise_id;

create or replace view public.v_gps_period_names as
 SELECT club_id,
    period_name,
    count(*) AS n_instances,
    avg(duration_seconds) FILTER (WHERE duration_seconds > 0::numeric) / 60.0 AS avg_minutes
   FROM gps_period_reports
  WHERE period_name IS NOT NULL AND period_name <> ''::text
  GROUP BY club_id, period_name;

create or replace view public.v_gps_task_analysis as
 SELECT r.id,
    r.club_id,
    r.session_id,
    ts.session_date,
    ts.team_id,
    m.exercise_id,
    e.name AS exercise_name,
    e.field_width,
    e.field_height,
    e.players_count,
        CASE
            WHEN e.players_count > 0 AND e.field_width > 0::numeric AND e.field_height > 0::numeric THEN round(e.field_width * e.field_height / e.players_count::numeric)
            ELSE NULL::numeric
        END AS m2_per_player,
        CASE
            WHEN e.field_width > 0::numeric AND e.field_height > 0::numeric THEN (round(e.field_width)::integer::text || 'x'::text) || round(e.field_height)::integer::text
            ELSE NULL::text
        END AS field_size,
        CASE
            WHEN e.name ~* '\d+\s*vs\s*\d+'::text THEN lower(regexp_replace(regexp_replace("substring"(e.name, '\d+\s*[Vv][Ss]\s*\d+(?:\s*\+\s*(?:\d+\s*[Vv][Ss]\s*\d+|\d+|[Gg][Kk]))*'::text), '\s*[Vv][Ss]\s*'::text, 'v'::text, 'g'::text), '\s*\+\s*'::text, '+'::text, 'g'::text))
            WHEN e.players_count > 0 THEN e.players_count::text || 'p'::text
            ELSE NULL::text
        END AS players_format,
    r.player_id,
    (p.first_name || ' '::text) || p.last_name AS player_name,
    p."position",
    p.number,
    r.duration_seconds,
    r.duration_seconds / 60.0 AS work_min,
    r.total_distance,
    r.high_speed_distance,
    r.very_high_speed_distance,
    r.sprint_distance,
    r.sprint_count,
    r.accelerations,
    r.decelerations,
    r.player_load,
    r.hmld,
    r.max_speed,
    r.avg_speed,
    r.total_distance / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS distance_per_minute,
    r.total_distance / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS total_distance_per_min,
    r.high_speed_distance / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS high_speed_distance_per_min,
    r.very_high_speed_distance / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS very_high_speed_distance_per_min,
    r.sprint_distance / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS sprint_distance_per_min,
    r.player_load / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS player_load_per_min,
    r.accelerations / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS accelerations_per_min,
    r.decelerations / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS decelerations_per_min,
    r.hmld / NULLIF(r.duration_seconds / 60.0, 0::numeric) AS hmld_per_min
   FROM gps_period_reports r
     JOIN gps_drill_map m ON m.club_id = r.club_id AND m.period_name = r.period_name
     JOIN exercises e ON e.id = m.exercise_id
     JOIN training_sessions ts ON ts.id = r.session_id
     JOIN players p ON p.id = r.player_id
  WHERE m.exercise_id IS NOT NULL AND m.ignored = false AND r.is_flagged = false AND r.duration_seconds >= 30::numeric AND (r.total_distance IS NULL OR (r.total_distance / NULLIF(r.duration_seconds, 0::numeric)) <= 13::numeric);

create or replace view public.v_next_match_lineup as
 SELECT DISTINCT ON (mc.club_id) mc.club_id,
    mc.id AS microcycle_id,
    mc.name AS microcycle_name,
    mc.match_date AS kickoff_date,
    mc.match_time AS kickoff_time,
    mc.rival AS opponent_name,
    mc.home_away,
    mc.stadium AS venue,
    l.id AS lineup_id,
    l.formation,
    l.status AS lineup_status,
    l.poster_style,
    l.language
   FROM microcycles mc
     LEFT JOIN lineups l ON l.microcycle_id = mc.id AND (l.status = ANY (ARRAY['draft'::text, 'locked'::text, 'official'::text]))
  WHERE mc.match_date >= CURRENT_DATE
  ORDER BY mc.club_id, mc.match_date;

create or replace view public.wellness_latest as
 SELECT DISTINCT ON (player_id) id,
    player_id,
    club_id,
    sleep_quality,
    fatigue,
    soreness,
    stress,
    mood,
    readiness,
    submitted_at
   FROM wellness
  ORDER BY player_id, submitted_at DESC;

-- ========================== TRIGGERS ==========================

CREATE TRIGGER act_availability AFTER UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION trg_act_availability();
CREATE TRIGGER club_branding_updated_at BEFORE UPDATE ON public.club_branding FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER club_settings_updated_at BEFORE UPDATE ON public.club_settings FOR EACH ROW EXECUTE FUNCTION set_club_settings_updated_at();
CREATE TRIGGER trg_seed_core_metrics AFTER INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION seed_core_metrics_for_club();
CREATE TRIGGER trg_seed_default_exercises AFTER INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION seed_default_exercises_for_club();
CREATE TRIGGER drills_updated_at BEFORE UPDATE ON public.drills FOR EACH ROW EXECUTE FUNCTION set_drills_updated_at();
CREATE TRIGGER act_evaluation AFTER INSERT ON public.evaluations FOR EACH ROW EXECUTE FUNCTION trg_act_evaluation();
CREATE TRIGGER act_force_test AFTER INSERT ON public.force_tests FOR EACH ROW EXECUTE FUNCTION trg_act_evaluation();
CREATE TRIGGER trg_gps_int_updated BEFORE UPDATE ON public.gps_integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gps_metric_def_updated_at BEFORE UPDATE ON public.gps_metric_definitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gps_period_reports_updated BEFORE UPDATE ON public.gps_period_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER act_gps AFTER INSERT ON public.gps_reports FOR EACH ROW EXECUTE FUNCTION trg_act_gps();
CREATE TRIGGER trg_gym_templates_updated_at BEFORE UPDATE ON public.gym_session_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER individual_plans_updated_at BEFORE UPDATE ON public.individual_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER act_injury AFTER INSERT OR UPDATE ON public.injuries FOR EACH ROW EXECUTE FUNCTION trg_act_injury();
CREATE TRIGGER injury_fill_availability AFTER INSERT OR UPDATE OF status, start_date, expected_return, returned_date ON public.injuries FOR EACH ROW EXECUTE FUNCTION trg_injury_fill_availability();
CREATE TRIGGER act_lineup_pub AFTER INSERT OR UPDATE ON public.lineups FOR EACH ROW EXECUTE FUNCTION trg_act_lineup_pub();
CREATE TRIGGER lineups_stamp_publish BEFORE UPDATE ON public.lineups FOR EACH ROW EXECUTE FUNCTION stamp_lineup_publish();
CREATE TRIGGER load_templates_updated_at BEFORE UPDATE ON public.load_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER act_match_report AFTER INSERT ON public.match_reports FOR EACH ROW EXECUTE FUNCTION trg_act_match_report();
CREATE TRIGGER match_reports_updated_at BEFORE UPDATE ON public.match_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER act_medical_episode AFTER INSERT ON public.medical_episodes FOR EACH ROW EXECUTE FUNCTION trg_act_medical_episode();
CREATE TRIGGER act_microcycle_pub AFTER INSERT OR UPDATE ON public.microcycles FOR EACH ROW EXECUTE FUNCTION trg_act_microcycle_pub();
CREATE TRIGGER trg_nutrition_targets_updated_at BEFORE UPDATE ON public.nutrition_targets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sync_player_primary_team AFTER INSERT OR DELETE OR UPDATE ON public.player_teams FOR EACH ROW EXECUTE FUNCTION sync_player_primary_team();
CREATE TRIGGER act_player AFTER INSERT OR UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION trg_act_player();
CREATE TRIGGER preventive_routines_updated_at BEFORE UPDATE ON public.preventive_routines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER rehab_plans_updated_at BEFORE UPDATE ON public.rehab_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER rehab_protocols_updated_at BEFORE UPDATE ON public.rehab_protocols FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER act_rpe AFTER INSERT ON public.rpe FOR EACH ROW EXECUTE FUNCTION trg_act_rpe();
CREATE TRIGGER rpe_calculate_load_trigger BEFORE INSERT OR UPDATE ON public.rpe FOR EACH ROW EXECUTE FUNCTION calculate_rpe_load();
CREATE TRIGGER seasons_updated_at BEFORE UPDATE ON public.seasons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER act_task AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION trg_act_task();
CREATE TRIGGER trg_single_primary BEFORE INSERT OR UPDATE OF is_primary ON public.teams FOR EACH ROW WHEN (new.is_primary) EXECUTE FUNCTION enforce_single_primary_team();
CREATE TRIGGER act_session AFTER INSERT OR UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION trg_act_session();
CREATE TRIGGER act_session_mod AFTER UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION trg_act_session_mod();
CREATE TRIGGER act_treatment AFTER INSERT OR UPDATE ON public.treatments FOR EACH ROW EXECUTE FUNCTION trg_act_treatment();
CREATE TRIGGER act_wellness AFTER INSERT ON public.wellness FOR EACH ROW EXECUTE FUNCTION trg_act_wellness();

-- ===================== RLS Y POLITICAS =====================

alter table public.activity_log enable row level security;
create policy "activity_log_select" on public.activity_log as permissive for select to authenticated
  using (((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((EXISTS ( SELECT 1
   FROM profiles pr
  WHERE ((pr.id = auth.uid()) AND ((pr.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (pr.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (team_id IS NULL) OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));

alter table public.ai_card_generations enable row level security;
create policy "club members manage ai generations" on public.ai_card_generations as permissive for all to authenticated
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.assessment_column_maps enable row level security;
create policy "assessment_col_map club" on public.assessment_column_maps as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "assessment_col_map super admin" on public.assessment_column_maps as permissive for all to public
  using (is_super_admin())
  with check (is_super_admin());

alter table public.assessment_test_defs enable row level security;
create policy "assessment_test_defs select" on public.assessment_test_defs as permissive for select to public
  using (((club_id IS NULL) OR (club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
create policy "assessment_test_defs super admin" on public.assessment_test_defs as permissive for all to public
  using (is_super_admin())
  with check (is_super_admin());
create policy "assessment_test_defs write club" on public.assessment_test_defs as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.audit_log enable row level security;
create policy "audit_log_insert" on public.audit_log as permissive for insert to public
  with check (((actor_id = auth.uid()) AND (club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
create policy "audit_log_select" on public.audit_log as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "audit_log_super_select" on public.audit_log as permissive for select to public
  using (is_super_admin());

alter table public.availability enable row level security;
create policy "availability_cud" on public.availability as permissive for all to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT (my_player_ids())::text AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT (my_player_ids())::text AS my_player_ids))));
create policy "availability_scoped_select" on public.availability as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT (my_player_ids())::text AS my_player_ids))));

alter table public.body_composition enable row level security;
create policy "body_composition_rw" on public.body_composition as permissive for all to authenticated
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));

alter table public.calendar_events enable row level security;
create policy "calendar_events_super_all" on public.calendar_events as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "ce_scoped_cud" on public.calendar_events as permissive for all to public
  using (((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))))
  with check (((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));
create policy "ce_scoped_select" on public.calendar_events as permissive for select to public
  using (((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));

alter table public.card_accumulations enable row level security;
create policy "club_card_accumulations" on public.card_accumulations as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.card_templates enable row level security;
create policy "club members manage card templates" on public.card_templates as permissive for all to authenticated
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.channel_reads enable row level security;
create policy "Users manage their own reads" on public.channel_reads as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

alter table public.club_branding enable row level security;
create policy "club_branding_modify" on public.club_branding as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'staff'::text]))))));
create policy "club_branding_select" on public.club_branding as permissive for select to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.club_gps_settings enable row level security;
create policy "club members manage gps settings" on public.club_gps_settings as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.club_modules enable row level security;
create policy "club_modules_select" on public.club_modules as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "club_modules_super_all" on public.club_modules as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "club_modules_write" on public.club_modules as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))));

alter table public.club_settings enable row level security;
create policy "club_settings_select" on public.club_settings as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "club_settings_upsert" on public.club_settings as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

alter table public.clubs enable row level security;
create policy "Authenticated users can create clubs" on public.clubs as permissive for insert to public
  with check ((auth.uid() IS NOT NULL));
create policy "Club admins can delete their club" on public.clubs as permissive for delete to public
  using (((id = get_user_club_id()) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text)));
create policy "Users can view their club" on public.clubs as permissive for select to public
  using ((id = get_user_club_id()));
create policy "admin can update own club" on public.clubs as permissive for update to public
  using ((id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "clubs_insert_authenticated" on public.clubs as permissive for insert to authenticated
  with check (true);
create policy "clubs_super_select" on public.clubs as permissive for select to public
  using (is_super_admin());
create policy "clubs_super_update" on public.clubs as permissive for update to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "clubs_superadmin_read" on public.clubs as permissive for select to authenticated
  using (is_super_admin());
create policy "clubs_update_member" on public.clubs as permissive for update to authenticated
  using ((id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.competitions enable row level security;
create policy "competitions_all" on public.competitions as permissive for all to authenticated
  using ((season_id IN ( SELECT seasons.id
   FROM seasons
  WHERE (seasons.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "competitions_super_all" on public.competitions as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.dashboard_cards enable row level security;
-- Cards inherit their dashboard's visibility/editability (personal · team-shared · club default).
create policy "dashboard_cards_select" on public.dashboard_cards as permissive for select to authenticated
  using (public.can_view_dashboard(dashboard_id));
create policy "dashboard_cards_modify" on public.dashboard_cards as permissive for all to authenticated
  using (public.can_edit_dashboard(dashboard_id))
  with check (public.can_edit_dashboard(dashboard_id));

alter table public.dashboards enable row level security;
-- SELECT inline (NOT via can_view_dashboard) to avoid the policy recursing on its own table.
create policy "dashboards_visible_select" on public.dashboards as permissive for select to authenticated
  using ((club_id = ( SELECT profiles.club_id FROM profiles WHERE (profiles.id = auth.uid())))
    AND (
      is_super_admin()
      OR public.role_bucket(( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid()))) = 'admin'
      OR (owner_id = auth.uid())
      OR (is_shared AND team_id IS NULL)
      OR (is_shared AND team_id IN ( SELECT public.my_team_ids() AS my_team_ids))
    ));
create policy "dashboards_insert" on public.dashboards as permissive for insert to authenticated
  with check ((club_id = ( SELECT profiles.club_id FROM profiles WHERE (profiles.id = auth.uid())))
    AND (owner_id IS NULL OR owner_id = auth.uid())
    AND (
      team_id IS NULL
      OR team_id IN ( SELECT public.my_team_ids() AS my_team_ids)
      OR public.role_bucket(( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid()))) = 'admin'
    ));
create policy "dashboards_update" on public.dashboards as permissive for update to authenticated
  using (public.can_edit_dashboard(id))
  with check ((club_id = ( SELECT profiles.club_id FROM profiles WHERE (profiles.id = auth.uid()))));
create policy "dashboards_delete" on public.dashboards as permissive for delete to authenticated
  using (public.can_edit_dashboard(id));

alter table public.default_exercises enable row level security;
create policy "Anyone authenticated can read default_exercises" on public.default_exercises as permissive for select to authenticated
  using (true);

alter table public.dossier_templates enable row level security;
create policy "dossier_templates_delete" on public.dossier_templates as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "dossier_templates_insert" on public.dossier_templates as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "dossier_templates_select" on public.dossier_templates as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "dossier_templates_super_all" on public.dossier_templates as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "dossier_templates_update" on public.dossier_templates as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.drills enable row level security;
create policy "drills_delete" on public.drills as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'coach'::text]))))));
create policy "drills_insert" on public.drills as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "drills_select" on public.drills as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "drills_super_all" on public.drills as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "drills_update" on public.drills as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.evaluations enable row level security;
create policy "evaluations_scoped_delete" on public.evaluations as permissive for delete to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "evaluations_scoped_insert" on public.evaluations as permissive for insert to authenticated
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "evaluations_scoped_select" on public.evaluations as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "evaluations_scoped_update" on public.evaluations as permissive for update to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));

alter table public.exercise_drills enable row level security;
create policy "Club members can manage exercise_drills" on public.exercise_drills as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.exercises enable row level security;
create policy "exercises_cud" on public.exercises as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "exercises_scoped_select" on public.exercises as permissive for select to public
  using (((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (visible_teams IS NULL) OR (cardinality(visible_teams) = 0) OR (visible_teams && ( SELECT ARRAY( SELECT my_team_ids() AS my_team_ids) AS "array")))));
create policy "exercises_super_all" on public.exercises as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.exercise_folders enable row level security;
create policy "exercise_folders_cud" on public.exercise_folders as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "exercise_folders_scoped_select" on public.exercise_folders as permissive for select to public
  using (((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((kind = 'gym'::text) OR has_full_planning_access() OR (team_id IS NULL) OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));
create policy "exercise_folders_super_all" on public.exercise_folders as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.foods enable row level security;
create policy "foods_read" on public.foods as permissive for select to authenticated
  using (true);
create policy "foods_write" on public.foods as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.force_column_mappings enable row level security;
create policy "force_col_map club" on public.force_column_mappings as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.force_metric_definitions enable row level security;
create policy "force_metric_defs select" on public.force_metric_definitions as permissive for select to public
  using (((club_id IS NULL) OR (club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
create policy "force_metric_defs write club" on public.force_metric_definitions as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.force_test_metrics enable row level security;
create policy "force_test_metrics via test" on public.force_test_metrics as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM force_tests t
  WHERE (t.id = force_test_metrics.test_id))))
  with check ((EXISTS ( SELECT 1
   FROM force_tests t
  WHERE (t.id = force_test_metrics.test_id))));

alter table public.force_tests enable row level security;
create policy "force_tests select team-scoped" on public.force_tests as permissive for select to public
  using (((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR (uploaded_by = auth.uid()))));
create policy "force_tests write club" on public.force_tests as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "force_tests_super_all" on public.force_tests as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.gps_column_mappings enable row level security;
create policy "club members can manage their column mappings" on public.gps_column_mappings as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.gps_dashboard_layouts enable row level security;
create policy "Users delete own layouts" on public.gps_dashboard_layouts as permissive for delete to public
  using (((user_id = auth.uid()) AND (club_id = get_user_club_id())));
create policy "Users insert own layouts" on public.gps_dashboard_layouts as permissive for insert to public
  with check (((user_id = auth.uid()) AND (club_id = get_user_club_id())));
create policy "Users read own layouts" on public.gps_dashboard_layouts as permissive for select to public
  using (((user_id = auth.uid()) AND (club_id = get_user_club_id())));
create policy "Users update own layouts" on public.gps_dashboard_layouts as permissive for update to public
  using (((user_id = auth.uid()) AND (club_id = get_user_club_id())))
  with check (((user_id = auth.uid()) AND (club_id = get_user_club_id())));

alter table public.gps_drill_map enable row level security;
create policy "gps_drill_map_select" on public.gps_drill_map as permissive for select to authenticated
  using ((club_id = get_user_club_id()));
create policy "gps_drill_map_write" on public.gps_drill_map as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_full_planning_access()))
  with check (((club_id = get_user_club_id()) AND has_full_planning_access()));

alter table public.gps_integration_secrets enable row level security;

alter table public.gps_integrations enable row level security;
create policy "gps_int_club_all" on public.gps_integrations as permissive for all to authenticated
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));

alter table public.gps_metric_definitions enable row level security;
create policy "club members can manage metric definitions" on public.gps_metric_definitions as permissive for all to authenticated
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.gps_period_reports enable row level security;
create policy "gps_period_reports_club_all" on public.gps_period_reports as permissive for all to public
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));
create policy "gps_period_reports_super_all" on public.gps_period_reports as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.gps_report_metrics enable row level security;
create policy "gps_report_metrics_del" on public.gps_report_metrics as permissive for delete to authenticated
  using (((club_id = get_user_club_id()) OR is_super_admin()));
create policy "gps_report_metrics_ins" on public.gps_report_metrics as permissive for insert to authenticated
  with check (((club_id = get_user_club_id()) OR is_super_admin()));
-- Inherit visibility from gps_reports (the subquery is filtered by gps_reports' own RLS),
-- so any broadening there (e.g. session-team access) applies to the metrics too.
create policy "gps_report_metrics_scoped_select" on public.gps_report_metrics as permissive for select to public
  using ((is_super_admin() OR (report_id IN ( SELECT gps_reports.id FROM gps_reports))));
create policy "gps_report_metrics_upd" on public.gps_report_metrics as permissive for update to authenticated
  using (((club_id = get_user_club_id()) OR is_super_admin()));

alter table public.gps_reports enable row level security;
create policy "gps_reports_scoped_insert" on public.gps_reports as permissive for insert to authenticated
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
-- Visible if: super admin · the player is on one of my teams (player_teams) · OR the report's
-- SESSION belongs to one of my teams (training_sessions.team_id — set by the Catapult sync).
-- The session branch covers athletes synced from Catapult that were never assigned to a team
-- in player_teams, so a team's staff still see that team's session data.
create policy "gps_reports_scoped_select" on public.gps_reports as permissive for select to public
  using ((is_super_admin()
    OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))
    OR (EXISTS ( SELECT 1 FROM training_sessions ts
                 WHERE ((ts.id = gps_reports.session_id)
                   AND (ts.team_id IN ( SELECT my_team_ids() AS my_team_ids)))))));
create policy "gps_reports_scoped_update" on public.gps_reports as permissive for update to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));

alter table public.gps_sync_jobs enable row level security;
create policy "gps_sync_jobs_admin_insert" on public.gps_sync_jobs as permissive for insert to authenticated
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "gps_sync_jobs_club_select" on public.gps_sync_jobs as permissive for select to public
  using ((club_id = get_user_club_id()));
create policy "gps_sync_jobs_super_all" on public.gps_sync_jobs as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.gym_exercises enable row level security;
create policy "Club members can manage gym_exercises" on public.gym_exercises as permissive for all to public
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));
create policy "gym_exercises_super_all" on public.gym_exercises as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.gym_session_templates enable row level security;
create policy "gym_session_templates_rw" on public.gym_session_templates as permissive for all to authenticated
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));

alter table public.individual_block_completions enable row level security;
create policy "individual_block_completions_all" on public.individual_block_completions as permissive for all to authenticated
  using ((player_id IN ( SELECT players.id
   FROM players
  WHERE (players.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.individual_plan_blocks enable row level security;
create policy "individual_plan_blocks_all" on public.individual_plan_blocks as permissive for all to authenticated
  using ((plan_id IN ( SELECT individual_plans.id
   FROM individual_plans
  WHERE (individual_plans.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.individual_plan_phases enable row level security;
create policy "ipp_delete" on public.individual_plan_phases as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "ipp_insert" on public.individual_plan_phases as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "ipp_select" on public.individual_plan_phases as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "ipp_update" on public.individual_plan_phases as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.individual_plans enable row level security;
create policy "individual_plans_all" on public.individual_plans as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "individual_plans_super_all" on public.individual_plans as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "ip_delete" on public.individual_plans as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "ip_insert" on public.individual_plans as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "ip_select" on public.individual_plans as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "ip_update" on public.individual_plans as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.injuries enable row level security;
create policy "injuries_scoped_delete" on public.injuries as permissive for delete to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "injuries_scoped_insert" on public.injuries as permissive for insert to authenticated
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "injuries_scoped_select" on public.injuries as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "injuries_scoped_update" on public.injuries as permissive for update to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));

alter table public.injury_phases enable row level security;
create policy "injury_phases_delete" on public.injury_phases as permissive for delete to public
  using ((injury_id IN ( SELECT injuries.id
   FROM injuries
  WHERE (injuries.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "injury_phases_insert" on public.injury_phases as permissive for insert to public
  with check ((injury_id IN ( SELECT injuries.id
   FROM injuries
  WHERE (injuries.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "injury_phases_rw" on public.injury_phases as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM injuries i
  WHERE ((i.id = injury_phases.injury_id) AND (i.club_id = ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))))
  with check ((EXISTS ( SELECT 1
   FROM injuries i
  WHERE ((i.id = injury_phases.injury_id) AND (i.club_id = ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));
create policy "injury_phases_select" on public.injury_phases as permissive for select to public
  using ((injury_id IN ( SELECT injuries.id
   FROM injuries
  WHERE (injuries.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "injury_phases_update" on public.injury_phases as permissive for update to public
  using ((injury_id IN ( SELECT injuries.id
   FROM injuries
  WHERE (injuries.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.invitations enable row level security;
create policy "invitations_select" on public.invitations as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "invitations_super_all" on public.invitations as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "invitations_write" on public.invitations as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))));

alter table public.invoices enable row level security;
create policy "invoices_select" on public.invoices as permissive for select to authenticated
  using ((club_id = get_user_club_id()));

alter table public.league_configs enable row level security;
create policy "club_league_configs" on public.league_configs as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.lineup_players enable row level security;
create policy "lineup_players_all" on public.lineup_players as permissive for all to authenticated
  using ((lineup_id IN ( SELECT lineups.id
   FROM lineups
  WHERE (lineups.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.lineup_staff enable row level security;
create policy "lineup_staff_all" on public.lineup_staff as permissive for all to authenticated
  using ((lineup_id IN ( SELECT lineups.id
   FROM lineups
  WHERE (lineups.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.lineups enable row level security;
create policy "Club members can delete lineups" on public.lineups as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can insert lineups" on public.lineups as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can read lineups" on public.lineups as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can update lineups" on public.lineups as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.load_templates enable row level security;
create policy "load_templates_all" on public.load_templates as permissive for all to authenticated
  using ((mesocycle_id IN ( SELECT m.id
   FROM ((mesocycles m
     JOIN macrocycles mc ON ((mc.id = m.macrocycle_id)))
     JOIN seasons s ON ((s.id = mc.season_id)))
  WHERE (s.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.macrocycles enable row level security;
create policy "macrocycles_all" on public.macrocycles as permissive for all to authenticated
  using ((season_id IN ( SELECT seasons.id
   FROM seasons
  WHERE (seasons.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.match_reports enable row level security;
create policy "club_match_reports" on public.match_reports as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.match_results enable row level security;
create policy "match_results_delete" on public.match_results as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "match_results_insert" on public.match_results as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "match_results_select" on public.match_results as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "match_results_update" on public.match_results as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.match_shots enable row level security;
create policy "club_match_shots" on public.match_shots as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.meal_plan_items enable row level security;
create policy "meal_plan_items_rw" on public.meal_plan_items as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM (meal_plan_meals m
     JOIN meal_plan_templates t ON ((t.id = m.template_id)))
  WHERE ((m.id = meal_plan_items.meal_id) AND (t.club_id = get_user_club_id())))))
  with check ((EXISTS ( SELECT 1
   FROM (meal_plan_meals m
     JOIN meal_plan_templates t ON ((t.id = m.template_id)))
  WHERE ((m.id = meal_plan_items.meal_id) AND (t.club_id = get_user_club_id())))));

alter table public.meal_plan_meals enable row level security;
create policy "meal_plan_meals_rw" on public.meal_plan_meals as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM meal_plan_templates t
  WHERE ((t.id = meal_plan_meals.template_id) AND (t.club_id = get_user_club_id())))))
  with check ((EXISTS ( SELECT 1
   FROM meal_plan_templates t
  WHERE ((t.id = meal_plan_meals.template_id) AND (t.club_id = get_user_club_id())))));

alter table public.meal_plan_templates enable row level security;
create policy "meal_plan_templates_rw" on public.meal_plan_templates as permissive for all to authenticated
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));

alter table public.medical_documents enable row level security;
create policy "mdoc_select" on public.medical_documents as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "mdoc_write" on public.medical_documents as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.medical_episodes enable row level security;
create policy "mepi_select" on public.medical_episodes as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "mepi_write" on public.medical_episodes as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.medical_screenings enable row level security;
create policy "mscr_select" on public.medical_screenings as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "mscr_write" on public.medical_screenings as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.medical_studies enable row level security;
create policy "mstu_select" on public.medical_studies as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "mstu_write" on public.medical_studies as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.member_modules enable row level security;
create policy "member_modules_select" on public.member_modules as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "member_modules_super_all" on public.member_modules as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "member_modules_write" on public.member_modules as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))));

alter table public.member_teams enable row level security;
create policy "member_teams_member_all" on public.member_teams as permissive for all to authenticated
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "member_teams_super_all" on public.member_teams as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.mesocycles enable row level security;
create policy "mesocycles_all" on public.mesocycles as permissive for all to authenticated
  using ((macrocycle_id IN ( SELECT mc.id
   FROM (macrocycles mc
     JOIN seasons s ON ((s.id = mc.season_id)))
  WHERE (s.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "mesocycles_super_all" on public.mesocycles as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.messages enable row level security;
create policy "messages_insert" on public.messages as permissive for insert to public
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "messages_select" on public.messages as permissive for select to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "messages_update" on public.messages as permissive for update to public
  using ((sender_id = auth.uid()));

alter table public.microcycles enable row level security;
create policy "mc_scoped_cud" on public.microcycles as permissive for all to public
  using (((club_id = get_user_club_id()) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))))
  with check (((club_id = get_user_club_id()) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));
create policy "mc_scoped_select" on public.microcycles as permissive for select to public
  using (((club_id = get_user_club_id()) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR microcycle_has_my_gps(id))));
create policy "microcycles_super_all" on public.microcycles as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.notification_settings enable row level security;
create policy "notif_settings_staff" on public.notification_settings as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "notif_settings_super" on public.notification_settings as permissive for all to public
  using (is_super_admin())
  with check (is_super_admin());

alter table public.notifications enable row level security;
create policy "notifications_insert_club" on public.notifications as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = notifications.user_id) AND (p.club_id = get_user_club_id())))));
create policy "notifications_select_own" on public.notifications as permissive for select to public
  using ((user_id = auth.uid()));
create policy "notifications_update_own" on public.notifications as permissive for update to public
  using ((user_id = auth.uid()));

alter table public.nutrition enable row level security;
create policy "Club members can insert nutrition" on public.nutrition as permissive for insert to public
  with check ((club_id = get_user_club_id()));
create policy "Club members can update nutrition" on public.nutrition as permissive for update to public
  using ((club_id = get_user_club_id()));
create policy "Club members can view nutrition from their club" on public.nutrition as permissive for select to public
  using ((club_id = get_user_club_id()));

alter table public.nutrition_targets enable row level security;
create policy "nutrition_targets_rw" on public.nutrition_targets as permissive for all to authenticated
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));

alter table public.opponent_branding enable row level security;
create policy "opponent_branding_all" on public.opponent_branding as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.payment_methods enable row level security;
create policy "payment_methods_select" on public.payment_methods as permissive for select to authenticated
  using ((club_id = get_user_club_id()));

alter table public.phase_types enable row level security;
create policy "phase_types_read" on public.phase_types as permissive for select to authenticated
  using (((club_id IS NULL) OR (club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
create policy "phase_types_write" on public.phase_types as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.pinned_files enable row level security;
create policy "Club members can pin files" on public.pinned_files as permissive for insert to authenticated
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can unpin files" on public.pinned_files as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can view pinned files" on public.pinned_files as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.plans enable row level security;
create policy "plans_select" on public.plans as permissive for select to anon, authenticated
  using (true);
create policy "plans_write_platform" on public.plans as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

alter table public.platform_admins enable row level security;
create policy "platform_admins_self_select" on public.platform_admins as permissive for select to public
  using ((user_id = auth.uid()));

alter table public.player_anthropometrics enable row level security;
create policy "Club members can insert anthropometrics" on public.player_anthropometrics as permissive for insert to public
  with check ((club_id = get_user_club_id()));
create policy "Club members can view anthropometrics" on public.player_anthropometrics as permissive for select to public
  using ((club_id = get_user_club_id()));

alter table public.player_individual_assignments enable row level security;
create policy "player_individual_assignments_all" on public.player_individual_assignments as permissive for all to authenticated
  using ((player_id IN ( SELECT players.id
   FROM players
  WHERE (players.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.player_match_stats enable row level security;
create policy "player_match_stats_delete" on public.player_match_stats as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "player_match_stats_insert" on public.player_match_stats as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "player_match_stats_select" on public.player_match_stats as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "player_match_stats_update" on public.player_match_stats as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.player_meal_assignments enable row level security;
create policy "player_meal_assignments_rw" on public.player_meal_assignments as permissive for all to authenticated
  using ((club_id = get_user_club_id()))
  with check ((club_id = get_user_club_id()));

alter table public.player_medical_profile enable row level security;
create policy "pmp_select" on public.player_medical_profile as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "pmp_write" on public.player_medical_profile as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.player_medications enable row level security;
create policy "pmed_select" on public.player_medications as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "pmed_write" on public.player_medications as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.player_preventive_assignments enable row level security;
create policy "player_preventive_assignments_all" on public.player_preventive_assignments as permissive for all to authenticated
  using ((player_id IN ( SELECT players.id
   FROM players
  WHERE (players.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.player_teams enable row level security;
create policy "player_teams_member_write" on public.player_teams as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND (team_id IN ( SELECT my_team_ids() AS my_team_ids))))
  with check (((club_id = get_user_club_id()) AND (team_id IN ( SELECT my_team_ids() AS my_team_ids))));
create policy "player_teams_select" on public.player_teams as permissive for select to authenticated
  using ((club_id = get_user_club_id()));
create policy "player_teams_super_all" on public.player_teams as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "player_teams_write" on public.player_teams as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_full_planning_access()))
  with check (((club_id = get_user_club_id()) AND has_full_planning_access()));
-- Head coach (role 'coach') may assign players to ANY team in their own club, even
-- teams they don't belong to (assistant coaches / other roles stay team-scoped).
create policy "player_teams_headcoach_write" on public.player_teams as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((lower(COALESCE(p.role, '')) = 'coach') OR (lower(COALESCE(p.club_role, '')) = 'coach')))))))
  with check (((club_id = get_user_club_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((lower(COALESCE(p.role, '')) = 'coach') OR (lower(COALESCE(p.club_role, '')) = 'coach')))))));

alter table public.players enable row level security;
create policy "players_scoped_delete" on public.players as permissive for delete to public
  using (((club_id = get_user_club_id()) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (p.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (EXISTS ( SELECT 1
   FROM player_teams pt
  WHERE ((pt.player_id = players.id) AND (pt.team_id IN ( SELECT my_team_ids() AS my_team_ids))))))));
create policy "players_scoped_insert" on public.players as permissive for insert to authenticated
  with check (((club_id = get_user_club_id()) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (p.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));
create policy "players_scoped_select" on public.players as permissive for select to public
  using (((club_id = get_user_club_id()) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (p.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR (EXISTS ( SELECT 1
   FROM player_teams pt
  WHERE ((pt.player_id = players.id) AND (pt.team_id IN ( SELECT my_team_ids() AS my_team_ids))))))));
create policy "players_scoped_update" on public.players as permissive for update to public
  using (((club_id = get_user_club_id()) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (p.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR (EXISTS ( SELECT 1
   FROM player_teams pt
  WHERE ((pt.player_id = players.id) AND (pt.team_id IN ( SELECT my_team_ids() AS my_team_ids))))))))
  with check (((club_id = get_user_club_id()) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (p.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR (EXISTS ( SELECT 1
   FROM player_teams pt
  WHERE ((pt.player_id = players.id) AND (pt.team_id IN ( SELECT my_team_ids() AS my_team_ids))))))));
create policy "players_super_select" on public.players as permissive for select to public
  using (is_super_admin());
create policy "players_super_write" on public.players as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.preventive_routines enable row level security;
create policy "preventive_routines_all" on public.preventive_routines as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.profiles enable row level security;
create policy "Club admins can update club profiles" on public.profiles as permissive for update to public
  using (((club_id = get_user_club_id()) AND (( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'admin'::text)));
create policy "Users can insert own profile" on public.profiles as permissive for insert to public
  with check ((id = auth.uid()));
create policy "Users can update own profile" on public.profiles as permissive for update to public
  using ((id = auth.uid()));
create policy "Users can update own profile (self)" on public.profiles as permissive for update to public
  using ((id = auth.uid()))
  with check ((id = auth.uid()));
create policy "Users can view profiles from their club" on public.profiles as permissive for select to public
  using ((club_id = get_user_club_id()));
create policy "profiles_insert_self" on public.profiles as permissive for insert to authenticated
  with check ((id = auth.uid()));
create policy "profiles_super_select" on public.profiles as permissive for select to public
  using (is_super_admin());

alter table public.programme_phases enable row level security;
create policy "programme_phases delete club" on public.programme_phases as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "programme_phases insert club" on public.programme_phases as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "programme_phases select club" on public.programme_phases as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "programme_phases update club" on public.programme_phases as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.protocol_blocks enable row level security;
create policy "protocol_blocks_all" on public.protocol_blocks as permissive for all to authenticated
  using ((protocol_id IN ( SELECT rehab_protocols.id
   FROM rehab_protocols
  WHERE (rehab_protocols.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.rehab_plan_owners enable row level security;
create policy "rehab_plan_owners_all" on public.rehab_plan_owners as permissive for all to authenticated
  using ((plan_id IN ( SELECT rehab_plans.id
   FROM rehab_plans
  WHERE (rehab_plans.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));

alter table public.rehab_plans enable row level security;
create policy "rehab_plans_cud" on public.rehab_plans as permissive for all to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "rehab_plans_scoped_select" on public.rehab_plans as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));

alter table public.rehab_protocols enable row level security;
create policy "rehab_protocols_all" on public.rehab_protocols as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.rehab_sessions enable row level security;
create policy "rehab_sessions_all" on public.rehab_sessions as permissive for all to authenticated
  using ((plan_id IN ( SELECT rehab_plans.id
   FROM rehab_plans
  WHERE (rehab_plans.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "rehab_sessions_rw" on public.rehab_sessions as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.role_default_modules enable row level security;
create policy "role_default_modules_select" on public.role_default_modules as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "role_default_modules_super_all" on public.role_default_modules as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "role_default_modules_write" on public.role_default_modules as permissive for all to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])) OR (profiles.club_role = ANY (ARRAY['admin'::text, 'owner'::text])))))));

alter table public.rpe enable row level security;
create policy "rpe_scoped_insert" on public.rpe as permissive for insert to authenticated
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "rpe_scoped_select" on public.rpe as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));

alter table public.season_phases enable row level security;
create policy "season_phases_all" on public.season_phases as permissive for all to authenticated
  using ((season_id IN ( SELECT seasons.id
   FROM seasons
  WHERE (seasons.club_id IN ( SELECT profiles.club_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))));
create policy "season_phases_super_all" on public.season_phases as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.seasons enable row level security;
create policy "seasons_all" on public.seasons as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "seasons_super_all" on public.seasons as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.session_exercises enable row level security;
create policy "club_members_manage_session_exercises" on public.session_exercises as permissive for all to public
  using ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id = ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "session_exercises_super_all" on public.session_exercises as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.share_links enable row level security;
create policy "share_links_anon_read" on public.share_links as permissive for select to anon
  using (((revoked = false) AND ((expires_at IS NULL) OR (expires_at > now()))));
create policy "share_links_staff" on public.share_links as permissive for all to authenticated
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

alter table public.subscriptions enable row level security;
create policy "subs_superadmin_read" on public.subscriptions as permissive for select to authenticated
  using (is_super_admin());
create policy "subscriptions_select" on public.subscriptions as permissive for select to authenticated
  using ((club_id = get_user_club_id()));

alter table public.surgeries enable row level security;
create policy "surg_select" on public.surgeries as permissive for select to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()));
create policy "surg_write" on public.surgeries as permissive for all to authenticated
  using (((club_id = get_user_club_id()) AND has_medical_access()))
  with check (((club_id = get_user_club_id()) AND has_medical_access()));

alter table public.task_reminders enable row level security;
create policy "Club members can delete task_reminders" on public.task_reminders as permissive for delete to public
  using ((club_id = get_user_club_id()));
create policy "Club members can insert task_reminders" on public.task_reminders as permissive for insert to public
  with check ((club_id = get_user_club_id()));
create policy "Club members can update task_reminders" on public.task_reminders as permissive for update to public
  using ((club_id = get_user_club_id()));
create policy "Club members can view task_reminders" on public.task_reminders as permissive for select to public
  using ((club_id = get_user_club_id()));

alter table public.tasks enable row level security;
create policy "Club members can create tasks" on public.tasks as permissive for insert to authenticated
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can delete tasks" on public.tasks as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Club members can insert tasks" on public.tasks as permissive for insert to public
  with check ((club_id = get_user_club_id()));
create policy "Club members can update tasks" on public.tasks as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "Team-scoped task visibility" on public.tasks as permissive for select to public
  using (((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR (created_by = auth.uid()) OR (assigned_to = auth.uid()) OR ((assigned_roles IS NOT NULL) AND (my_role() = ANY (assigned_roles)) AND (team_id IN ( SELECT my_team_ids() AS my_team_ids))))));
create policy "tasks_super_all" on public.tasks as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.taxonomy_aliases enable row level security;
create policy "Anyone authenticated can read taxonomy_aliases" on public.taxonomy_aliases as permissive for select to authenticated
  using (true);

alter table public.teams enable row level security;
create policy "Club members can delete teams" on public.teams as permissive for delete to public
  using ((club_id = get_user_club_id()));
create policy "Club members can insert teams" on public.teams as permissive for insert to public
  with check ((club_id = get_user_club_id()));
create policy "Club members can update teams" on public.teams as permissive for update to public
  using ((club_id = get_user_club_id()));
create policy "Club members can view teams" on public.teams as permissive for select to public
  using ((club_id = get_user_club_id()));
create policy "teams_super_all" on public.teams as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.training_sessions enable row level security;
create policy "training_sessions_super_all" on public.training_sessions as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
create policy "ts_scoped_cud" on public.training_sessions as permissive for all to public
  using (((club_id = get_user_club_id()) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))))
  with check (((club_id = get_user_club_id()) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)))));
-- SELECT also allows a session behind GPS data the caller can already read (session_has_my_gps),
-- so team staff see Catapult-imported sessions whose team_id is NULL. Editing (ts_scoped_cud)
-- stays team/admin-scoped — this only widens VISIBILITY.
create policy "ts_scoped_select" on public.training_sessions as permissive for select to public
  using (((club_id = get_user_club_id()) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR session_has_my_gps(id))));

alter table public.treatment_templates enable row level security;
create policy "treatment_templates_club_delete" on public.treatment_templates as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "treatment_templates_club_insert" on public.treatment_templates as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "treatment_templates_club_select" on public.treatment_templates as permissive for select to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "treatment_templates_super_all" on public.treatment_templates as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.treatments enable row level security;
create policy "treatments_cud" on public.treatments as permissive for all to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "treatments_scoped_select" on public.treatments as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));

alter table public.video_matches enable row level security;
create policy "video_matches rw via video" on public.video_matches as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM videos v
  WHERE (v.id = video_matches.video_id))))
  with check ((EXISTS ( SELECT 1
   FROM videos v
  WHERE (v.id = video_matches.video_id))));

alter table public.video_players enable row level security;
create policy "video_players rw via video" on public.video_players as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM videos v
  WHERE (v.id = video_players.video_id))))
  with check ((EXISTS ( SELECT 1
   FROM videos v
  WHERE (v.id = video_players.video_id))));

alter table public.video_sessions enable row level security;
create policy "video_sessions rw via video" on public.video_sessions as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM videos v
  WHERE (v.id = video_sessions.video_id))))
  with check ((EXISTS ( SELECT 1
   FROM videos v
  WHERE (v.id = video_sessions.video_id))));

alter table public.videos enable row level security;
create policy "videos delete club" on public.videos as permissive for delete to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "videos insert club" on public.videos as permissive for insert to public
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "videos select team-scoped" on public.videos as permissive for select to public
  using (((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_full_planning_access() OR (team_id IN ( SELECT my_team_ids() AS my_team_ids)) OR (uploaded_by = auth.uid()))));
create policy "videos update club" on public.videos as permissive for update to public
  using ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  with check ((club_id IN ( SELECT profiles.club_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
create policy "videos_super_all" on public.videos as permissive for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

alter table public.wellness enable row level security;
create policy "wellness_scoped_insert" on public.wellness as permissive for insert to authenticated
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "wellness_scoped_select" on public.wellness as permissive for select to public
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
create policy "wellness_scoped_update" on public.wellness as permissive for update to authenticated
  using ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))))
  with check ((is_super_admin() OR (player_id IN ( SELECT my_player_ids() AS my_player_ids))));
