# CLAVAMETRICS DATABASE SCHEMA

> ⚠️ **OBSOLETO (desde 2026-06-26).** Este doc es narrativo, parcial y desactualizado.
> Fuente de verdad del esquema:
> - Estructura completa (104 tablas reales): [`db/schema.sql`](db/schema.sql)
> - Diagrama por dominio: [`internal-docs/schema-diagram.md`](internal-docs/schema-diagram.md)
> - Auditoría de migraciones: [`internal-docs/migrations-audit.md`](internal-docs/migrations-audit.md)

# DATABASE OVERVIEW

Database provider:
- Supabase PostgreSQL

Architecture:
- Multi-tenant
- Every major table uses club_id
- All queries must be filtered by club_id

Authentication:
- Supabase Auth

Main entity relationships:
Club -> Users -> Players -> Sessions -> Metrics

---

# TABLE: clubs

Purpose:
Stores club/team information.

Important columns:
- id (uuid)
- name
- logo_url
- primary_color
- secondary_color
- created_at

Used for:
- branding
- theme
- multi-tenant separation

---

# TABLE: profiles

Purpose:
Stores authenticated user profiles.

Important columns:
- id (uuid)
- club_id (uuid)
- email
- full_name
- role
- avatar_url
- created_at

Relationships:
- profiles.club_id -> clubs.id

Roles examples:
- admin
- coach
- physio
- analyst
- nutritionist

Rules:
- Every authenticated user has one profile
- Permissions depend on role

---

# TABLE: players

Purpose:
Stores athlete information.

Important columns:
- id (uuid)
- club_id (uuid)
- first_name
- last_name
- position
- date_of_birth
- nationality
- height
- weight
- dominant_foot
- status
- photo_url
- external_gps_id (text, nullable) — stable GPS device player ID (migration 028); auto-match on next import without fuzzy search. INDEX: idx_players_ext_gps(club_id, external_gps_id) WHERE external_gps_id IS NOT NULL

Relationships:
- players.club_id -> clubs.id

Common statuses:
- available
- injured
- modified
- unavailable

---

# TABLE: wellness

Purpose:
Daily wellness questionnaire.

Important columns:
- id (uuid)
- player_id (uuid)
- club_id (uuid)
- sleep_quality
- fatigue
- soreness
- stress
- mood
- readiness
- submitted_at

Relationships:
- wellness.player_id -> players.id

Rules:
- Usually one entry per player per day

---

# TABLE: injuries

Purpose:
Medical injury tracking.

Important columns:
- id (uuid)
- player_id (uuid)
- club_id (uuid)
- injury_type
- body_area
- severity
- status
- start_date
- expected_return
- notes

Relationships:
- injuries.player_id -> players.id

Statuses:
- active
- recovery
- cleared

---

# TABLE: gps_reports

Purpose:
Stores GPS performance metrics.

Important columns:
- id (uuid)
- player_id (uuid)
- session_id (uuid)
- club_id (uuid)
- total_distance (numeric)
- high_speed_distance (numeric)
- sprint_distance (numeric)
- accelerations (integer)
- decelerations (integer)
- max_speed (numeric)
- player_load (numeric)
- avg_speed (numeric)
- very_high_speed_distance (numeric, nullable) — migration 028
- hmld (numeric, nullable) — High Metabolic Load Distance, migration 028
- time_played (numeric, nullable) — minutes played, migration 028
- sprint_count (integer, nullable) — migration 028
- distance_per_minute (numeric, nullable) — migration 028
- created_at

Constraints:
- UNIQUE(player_id, session_id)

Relationships:
- gps_reports.player_id -> players.id
- gps_reports.session_id -> training_sessions.id

Note: Only core metrics (13 columns) live here. Custom/extensible metrics
go to gps_report_metrics (EAV). See bloque-7 for hybrid model.

---

# TABLE: gps_metric_definitions

Purpose:
Catalog of GPS metrics per club — both core (13 universal columns) and
custom (club-defined, stored in gps_report_metrics EAV).
Reference: migrations 034, 035 (bloque 7).

Important columns:
- id (uuid)
- club_id (uuid, FK clubs)
- key (text) — snake_case identifier, regex /^[a-z][a-z0-9_]*$/
- label (text) — human-readable name shown in UI
- unit (text, nullable) — e.g. "m", "km/h", "AU"
- category (text) — distance|speed|acceleration|load|time|count|custom
- decimals (integer 0-4, default 2) — display precision
- is_core (boolean) — true = column in gps_reports; false = EAV in gps_report_metrics
- display_order (integer, default 100) — order in selectors and catalog table
- description (text, nullable)
- created_by (uuid, FK auth.users)
- created_at, updated_at

Constraints:
- UNIQUE(club_id, key)
- CHECK key ~ /^[a-z][a-z0-9_]*/
- CHECK category IN (distance, speed, acceleration, load, time, count, custom)
- CHECK decimals BETWEEN 0 AND 4

Indexes:
- idx_gps_metric_def_club(club_id)

Seeded automatically:
- 13 core metrics inserted with is_core=true for existing clubs (migration 035)
- trigger seed_core_metrics_for_club fires AFTER INSERT ON clubs for new clubs

---

# TABLE: gps_report_metrics

Purpose:
EAV (Entity-Attribute-Value) store for custom GPS metrics not covered by
gps_reports columns. One row per report+metric_key combination.
Reference: migrations 034 (bloque 7).

Important columns:
- id (uuid)
- report_id (uuid, FK gps_reports ON DELETE CASCADE) — links to the core report row
- club_id (uuid, FK clubs)
- metric_key (text) — must match a key in gps_metric_definitions for the club
- value (numeric, nullable)
- created_at

Constraints:
- UNIQUE(report_id, metric_key) — one value per metric per report

Indexes:
- idx_gps_rm_report(report_id)
- idx_gps_rm_club_metric(club_id, metric_key)

Usage:
- Written by the import pipeline when a mapped column is not in GPS_REPORT_COLS
- Read by getReportsForSession() in assets/gps-reader.js, merged into metrics dict
- Baseline for custom metrics computed by getMatchBaseline() via 2-step query

---

# TABLE: gps_column_mappings

Purpose:
Persists per-club, per-provider column-name → canonical metric mapping.
Enables automatic column matching on subsequent imports from the same source.
Reference: migration 028.

Important columns:
- id (uuid)
- club_id (uuid, FK clubs)
- source_label (text) — free-form provider name, e.g. "Catapult Vector", "StatSports CSV"
- source_column_name (text) — exact column header from the file
- target_metric (text) — key in gps_metric_definitions (core or custom). Special value "__ignore__" = skip column.
- unit_conversion (numeric, default 1.0) — multiply raw value before storing (e.g. 1000 for km → m)
- parse_format (text, nullable) — format hint for date/duration columns
- column_type (text, nullable) — manual type override (date|duration|number|text|ignore)
- excluded (boolean, default false) — column excluded in preview step
- created_at, updated_at

Constraints:
- UNIQUE(club_id, source_label, source_column_name)

Indexes:
- idx_gps_mappings_club(club_id)

---

# TABLE: club_gps_settings

Purpose:
Per-club configuration for GPS baseline calculation and active metrics display.
Reference: migration 029.

Important columns:
- club_id (uuid PK → clubs.id)
- baseline_n (integer, 3-10, default 5) — number of best match sessions for personal reference
- baseline_mode (text: 'personal'|'position', default 'personal') — personal (Miguel et al. 2022) or positional avg
- active_metrics (text[]) — GPS metrics visible in Z-score matrix / ranking picker
- updated_at (timestamptz)

Rules:
- baseline_n BETWEEN 3 AND 10 (CHECK constraint)
- baseline_mode IN ('personal','position') (CHECK constraint)
- One row per club; UPSERT on save

---

# TABLE: training_sessions

Purpose:
Stores team training sessions.

Important columns:
- id (uuid)
- club_id (uuid)
- title
- session_date
- duration
- session_type
- coach_id
- notes
- is_historical (boolean, default false) — migration 033: sessions imported from
  past periods. Excluded from Calendar, Sessions History, and Daily Planning but
  fully available for GPS charts, baselines, and comparisons.
- session_attributes (jsonb, default '{}') — migration 036: extensible per-session
  metadata. Conventional keys: rival (text), md_code (text, e.g. "MD-1"/"MD+2"),
  competition (text), venue (text "home"/"away"), microcycle (text, e.g. "MC 08" —
  label from GPS CSV; NOT the microcycle_id FK). Not a constraint — clubs can
  store any key. GIN index idx_training_sessions_attributes enables @> filtering.
  Written by the import pipeline when columns are mapped to "Session attribute".
- microcycle_id (text, FK → microcycles.id ON DELETE SET NULL) — links to the
  microcycles planning entity (rival, match_date, stadium). Distinct from the
  "MC 08" label stored in session_attributes; set by Daily Planning, not import.

Session resolve key (used by import pipeline):
  UNIQUE by (club_id, session_date, session_type, is_historical)

Examples of session_type:
- training
- match
- gym
- recovery
- tactical
- conditioning

Note: session_type = 'match' is required for a session to feed match baselines
(getMatchBaseline / getMatchBaselineBatch in assets/gps-baseline.js).

---

# TABLE: rpe

Purpose:
Stores session RPE data.

Important columns:
- id (uuid)
- player_id (uuid)
- session_id (uuid)
- rpe
- duration
- load
- created_at

Formula:
load = rpe * duration

Relationships:
- rpe.player_id -> players.id
- rpe.session_id -> training_sessions.id

---

# TABLE: evaluations

Purpose:
Physical performance tests.

Important columns:
- id (uuid)
- player_id (uuid)
- club_id (uuid)
- evaluation_type
- test_date
- value
- unit
- notes

Examples:
- CMJ
- Sprint
- VO2
- Strength
- Mobility

---

# TABLE: nutrition

Purpose:
Nutrition tracking and planning.

Important columns:
- id (uuid)
- player_id (uuid)
- club_id (uuid)
- calories
- protein
- carbs
- fats
- hydration
- notes
- created_at

---

# TABLE: microcycles

Purpose:
Weekly training blocks with match reference.

Important columns:
- id (uuid)
- club_id (uuid)
- name
- start_date
- end_date
- match_date
- match_time
- rival
- home_away (home/away/neutral)
- stadium
- color
- type
- notes
- publish_players, publish_medical, published_at
- created_at

---

# TABLE: calendar_events

Purpose:
Non-training events: matches, travel, meetings, evaluations, video sessions, recovery.

Important columns:
- id (uuid)
- club_id (uuid)
- created_by (uuid)
- title
- type (travel/meeting/evaluation/video_session/match/recovery)
- date (DATE)
- start_time (TIME)
- end_time (TIME)
- duration_minutes
- location
- opponent
- competition (league/cup/international/friendly)
- home_away (home/away/neutral)
- notes
- published (boolean)
- rival_crest_url — added by migration 020/022
- created_at, updated_at

Used by:
- Lineup (loadNextMatch)
- Calendar
- Global Search

---

# TABLE: lineups

Purpose:
Official lineup / poster for a match.

Important columns:
- id (uuid)
- club_id (uuid)
- match_id (uuid → calendar_events.id)
- microcycle_id (uuid → microcycles.id)
- formation (text, e.g. '4-3-3')
- status (draft/locked/official/archived)
- poster_style (editorial/stadium/magazine/ticket)
- language (es/en/pt)
- style_config (jsonb) — { title_color, accent_color } — added by migration 020/022
- players (jsonb, legacy)
- subs (jsonb, legacy)
- published_at, published_by
- created_by, created_at

---

# TABLE: lineup_players

Purpose:
Normalized player slots for a lineup (replaces JSONB blobs in lineups.players).

Important columns:
- id (uuid)
- lineup_id (uuid → lineups.id)
- player_id (uuid → players.id)
- role (starter/substitute/reserve/injured)
- slot_index (integer, 0..10 starters / 0..n subs)
- x_pct, y_pct (position on pitch, 0–100)
- is_captain (boolean)
- is_vice_captain (boolean)
- notes
- created_at

Constraints:
- UNIQUE (lineup_id, role, slot_index) — migration 021/022

---

# TABLE: lineup_staff

Purpose:
Technical staff included in a lineup poster.

Important columns:
- id (uuid)
- lineup_id (uuid → lineups.id)
- profile_id (uuid → profiles.id)
- display_name (text)
- role_code (head/assistant/gk_coach/fitness/physio/analyst/other)
- sort_order
- created_at

---

# TABLE: club_branding

Purpose:
Override branding for lineup poster (custom crest, hashtag, colors).

Important columns:
- club_id (uuid PK → clubs.id)
- crest_url
- crest_dark_url
- primary_color
- accent_color
- hashtag
- updated_at

---

# TABLE: opponent_branding

Purpose:
Persists rival club crests across matches (keyed by club_id + opponent_name).

Important columns:
- id (uuid)
- club_id (uuid → clubs.id)
- opponent_name (text)
- crest_url
- primary_color
- created_at

Constraints:
- UNIQUE (club_id, opponent_name)

---

# TABLE: club_settings

Purpose:
Per-club configuration (season info, preferences).

Important columns:
- club_id (uuid PK → clubs.id)
- season_name (text)
- season_start (date)
- season_end (date)
- competition (text)

---

# TABLE: notifications

Purpose:
In-app realtime notifications for users.

Important columns:
- id (uuid)
- user_id (uuid → auth.users)
- club_id (uuid → clubs.id)
- type (text: physio/task/injury/session/…)
- title (text)
- body (text)
- read (boolean)
- link (text)
- created_at

RLS: user can read/update own rows; service role inserts.
Realtime enabled.

---

# TABLE: messages

Purpose:
Chat messages — direct messages (recipient_id set) or club-wide (recipient_id null).

Important columns:
- id (uuid)
- club_id (uuid → clubs.id)
- sender_id (uuid → auth.users)
- recipient_id (uuid → auth.users, null = group/club channel)
- sender_name (text)
- content (text)
- created_at

---

# TABLE: channel_reads

Purpose:
Tracks last-read position per user per chat channel, for unread badge calculation.

Important columns:
- user_id (uuid → auth.users) PK part
- channel_key (text) PK part — 'group' or a user UUID for DMs
- club_id (uuid → clubs.id) PK part
- last_read_at (timestamptz)

Note: created by migration 022 (was missing before).

---

# TABLE: treatments

Purpose:
Physio treatment sessions linked to an injury (or standalone).

Important columns:
- id (uuid)
- club_id (uuid)
- player_id (uuid → players.id)
- injury_id (uuid → injuries.id, nullable)
- date (date)
- type (text)
- treatment_type (text)
- modalities (text)
- notes, adaptation_notes
- adaptation_sent_at (timestamptz)
- notify_coaches (boolean)
- performed_by (text)
- created_at

---

# TABLE: availability

Purpose:
Daily availability status override per player.

Important columns:
- id (uuid)
- club_id (uuid)
- player_id (uuid → players.id)
- date (date)
- status (available/modified/unavailable/injured/sick/away)
- notes
- created_at

---

# TABLE: tasks

Purpose:
Club task management (assignable to staff members).

Important columns:
- id (uuid)
- club_id (uuid)
- title, description
- status (pending/in_progress/done/cancelled)
- priority (low/medium/high/urgent)
- due_date (date)
- category (text)
- created_by (uuid), created_by_name
- assigned_to (uuid), assigned_to_name
- created_at, updated_at

---

# TABLE: gym_exercises

Purpose:
Exercise library for gym planning.

Important columns:
- id (uuid)
- club_id (uuid)
- name
- category
- muscle_group
- description
- video_url
- created_at

---

# GLOBAL DATABASE RULES

## Multi-tenant

Every major query MUST filter by:
- club_id

Never expose data across clubs.

---

# QUERY RULES

Always:
- use existing Supabase helpers
- validate authenticated user
- validate club_id

Avoid:
- SELECT *
- duplicated queries
- unnecessary nested fetches

---

# IMPORTANT BUSINESS LOGIC

## Availability logic

Player availability depends on:
- injury state
- wellness readiness
- modified training flags

---

## GPS hybrid model (core columns + EAV)

GPS data uses a hybrid model introduced in bloque 7 (migrations 034, 035):

- **Core metrics (13):** stored as typed columns in `gps_reports`.
  Keys: total_distance, high_speed_distance, very_high_speed_distance,
  sprint_distance, sprint_count, max_speed, avg_speed, accelerations,
  decelerations, player_load, hmld, time_played, distance_per_minute.
  UNIQUE constraint: (player_id, session_id).

- **Custom metrics:** stored as rows in `gps_report_metrics` (EAV).
  Defined per-club in `gps_metric_definitions` (is_core = false).
  UNIQUE constraint: (report_id, metric_key).

Reading: `getReportsForSession()` in assets/gps-reader.js merges both
sources into a flat `metrics` dict — callers use `report.metrics[key]`
regardless of where the metric lives.

## Match baseline (Miguel et al. 2022)

`getMatchBaseline(player_id, metric, clubId)` in assets/gps-baseline.js:
- Fetches the player's values for that metric across sessions where
  training_sessions.session_type = 'match'.
- Takes the mean of the top-N values (N from club_gps_settings.baseline_n,
  default 5; minimum 3 matches required for any result).
- For core metrics: queries gps_reports column directly.
- For custom metrics: two-step via gps_reports → gps_report_metrics EAV.
- is_historical sessions ARE included (historical match data is valid for
  baseline calculation).

## Load monitoring

Load calculations use:
- GPS metrics
- RPE
- training duration

---

## Dashboard KPIs

Main dashboard metrics include:
- player availability
- injury count
- acute/chronic load
- wellness averages
- session completion

---

# TABLE: gps_dashboard_layouts

Purpose:
Persists per-user, per-club, per-dashboard card layouts for GPS Analysis dashboards.

Important columns:
- id (uuid, PK)
- user_id (uuid, FK auth.users ON DELETE CASCADE)
- club_id (uuid, FK clubs ON DELETE CASCADE)
- dashboard_id (text) — 'player_week' | 'session_control' | 'match_performance' | 'load_monitoring' | 'microcycle_compare'
- layout (jsonb) — array of { card_id, size, position, config }
- updated_at (timestamptz)

UNIQUE constraint: (user_id, club_id, dashboard_id)

View key → dashboard_id mapping:
- ind  → player_week
- grp  → session_control
- mind → match_performance
- mgrp → load_monitoring
- mc   → microcycle_compare

Migration: migration-package/sql-migrations/020_gps_dashboard_layouts.sql

---

# DEVELOPMENT RULES

NEVER:
- create duplicate tables
- rename existing columns without migration
- hardcode club IDs
- bypass auth validation

ALWAYS:
- reuse schema
- respect relationships
- preserve multi-tenant logic