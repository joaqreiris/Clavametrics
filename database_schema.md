# CLAVAMETRICS DATABASE SCHEMA

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
- total_distance
- high_speed_distance
- sprint_distance
- accelerations
- decelerations
- max_speed
- player_load
- created_at

Relationships:
- gps_reports.player_id -> players.id
- gps_reports.session_id -> training_sessions.id

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

Examples:
- Gym
- Recovery
- Tactical
- Match
- Conditioning

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