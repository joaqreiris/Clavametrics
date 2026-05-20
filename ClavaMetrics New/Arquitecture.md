# CLAVAMETRICS ARCHITECTURE

## PROJECT OVERVIEW

ClavaMetrics is a football performance and club management platform.

Main areas:
- Player management
- GPS analysis
- Wellness & readiness
- Injuries & medical
- Session planning
- Gym management
- Nutrition
- RPE / load monitoring
- Dashboards & analytics

Frontend currently uses:
- HTML
- Vanilla JavaScript
- CSS custom design system
- Supabase backend

The visual design must remain untouched unless explicitly requested.

---

# PROJECT STRUCTURE

## Core folders

/assets
Shared assets, utilities, Supabase initialization, CSS system.

/pages
Main application pages.

/components
Reusable UI blocks.

/styles
Design system and variables.

---

# DESIGN SYSTEM

Main CSS file:
- assets/clavametrics.css

Uses CSS variables:
- --cm-*

DO NOT:
- modify spacing
- modify typography
- change color palette
- redesign layouts

unless explicitly requested.

---

# SUPABASE

## Shared Supabase initialization

Main file:
- assets/supabase-init.js

Contains:
- window.sb
- requireAuth()
- getClub()
- getClubId()
- getProfile()
- applyClubTheme()

Reuse existing helpers whenever possible.

---

# AUTH FLOW

Every protected page should:

1. Run requireAuth()
2. Redirect to Login.html if no session
3. Load user profile
4. Load club information
5. Populate sidebar/navbar

DO NOT create new auth systems.

---

# DATABASE STRUCTURE

Main tables:
- profiles
- clubs
- players
- athlete_sessions
- wellness
- injuries
- gps_reports
- evaluations
- nutrition
- training_sessions

All queries should reuse existing club filtering logic.

---

# MULTI-TENANT RULE

Every query must respect:
- club_id
- authenticated user permissions

Never expose cross-club data.

---

# FRONTEND RULES

## Preserve UI

The redesign already exists.
Logic must adapt to the UI, not vice versa.

---

# PAGE PATTERN

Typical page flow:

1. requireAuth()
2. getClubId()
3. fetch Supabase data
4. render cards/tables/charts
5. attach listeners
6. handle save/update/delete

---

# COMPONENT REUSE

Before creating:
- new cards
- tables
- modals
- charts

Check if reusable versions already exist.

---

# NAMING CONVENTIONS

Keep current naming style.

Examples:
- camelCase for JS
- kebab-case for CSS classes
- PascalCase only if React components exist

Do not invent new patterns.

---

# PERFORMANCE RULES

Prefer:
- existing utilities
- lightweight vanilla JS
- reusable helpers

Avoid:
- unnecessary libraries
- duplicated queries
- large frameworks

---

# MIGRATION STRATEGY

Old project:
- contains real Supabase logic

New project:
- contains modern UI but hardcoded data

Migration goal:
- preserve new UI
- connect real Supabase data
- reuse existing auth and DB structure

---

# IMPORTANT DEVELOPMENT RULES

NEVER:
- rewrite entire pages unnecessarily
- modify global CSS
- break existing layouts
- hardcode fake production data

ALWAYS:
- modify surgically
- preserve structure
- reuse helpers
- minimize token usage

---

# CURRENT PRIORITIES

1. Shared infrastructure
2. Auth system
3. Dashboard KPIs
4. Availability
5. Wellness
6. Injuries
7. GPS analysis
8. Planner & sessions
9. Reports & analytics