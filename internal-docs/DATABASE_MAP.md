# DATABASE MAP

---

# Database Overview

Provider: Supabase

---

# Active Tables

| Table | Purpose | Used By |
|---|---|---|
| players | Player profiles | Dashboard, GPS, Wellness |
| gps_sessions | GPS session data | GPS Module |
| wellness_entries | Wellness forms | Wellness |
| injuries | Injury management | Medical |
| gym_sessions | Gym planning | Gym |

---

# Legacy Tables

| Table | Problem |
|---|---|
| player_data_old | Duplicate of players |
| gps_uploads_backup | Unused |
| training_load_v1 | Legacy schema |

---

# Relationships

## players
- id → gps_sessions.player_id
- id → wellness_entries.player_id
- id → injuries.player_id

---

# Missing Relationships

| Table | Missing FK |
|---|---|
| injuries | player_id |
| gym_sessions | session_id |

---

# Naming Inconsistencies

| Old Name | New Name |
|---|---|
| athlete_id | player_id |
| squad_id | team_id |
| session_data | gps_sessions |

---

# Tables To Review

- training_reports
- readiness_scores
- old_notifications

---

# RLS Status

| Table | Status |
|---|---|
| players | ✅ |
| gps_sessions | ⚠ |
| wellness_entries | ❌ |

---

# Migration Candidates

## Safe To Delete
- gps_uploads_backup

## Needs Migration
- player_data_old

## Needs Refactor
- training_load_v1