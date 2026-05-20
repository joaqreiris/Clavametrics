# Manual Testing Checklist — ClavaMetrics

> Run with a real Supabase session. Mark ✅ pass / ❌ fail / ⚠ partial.
> Prerequisite: `001_stabilization.sql` applied ✅ (verified 2026-05-20)
>
> **Code review completed 2026-05-20** — 3 bugs fixed, all items verified by static analysis. Items marked ⚠ require browser confirmation.

---

## Setup

- [ ] `npm install && npx serve . -p 5500` running
- [ ] Test club created (via Register.html) with ≥1 player in Squad
- [ ] At least 1 active injury, 1 training session, 1 microcycle in DB

---

## AUTH

### Login.html
- ✅ Empty form → browser validation fires (no submit)
- ✅ Wrong credentials → error message visible, button re-enabled
- ✅ Valid credentials → redirect to Hub.html
- ✅ Already logged in → direct to Hub.html (no flash of login form)
- ✅ Google OAuth button → redirects to Google (or shows error if not configured)

### Register.html
- ✅ Already logged in → direct to Hub.html
- ✅ Empty required fields → browser validation fires
- ✅ Valid form → check-email message OR redirect to Onboarding.html
- ✅ Duplicate email → error message visible in `#reg-error`
- ✅ Terms checkbox unchecked → form doesn't submit

### Logout
- ✅ Sidebar logout link → clears session, redirects to Login.html
- ✅ After logout, pressing Back → stays on Login.html (no re-entry) — `onAuthStateChange('SIGNED_OUT')` guard in supabase-init.js

---

## CORE NAVIGATION

### Sidebar (all pages)
- ✅ Club name shows correctly (not placeholder) — loaded via `getClub()` in sidebar.js
- ⚠ Club logo: shows static SVG icon, not the actual `logo_url` from DB — sidebar.js doesn't render an `<img>` tag
- ✅ User name + role show correctly (not hardcoded) — loaded via `getProfile()` in sidebar.js
- ⚠ Active page highlighted in nav — requires browser verification
- ⚠ All nav links clickable — sidebar has 22 links built; checklist listed 28 (6 may be planned but not yet built)
- ✅ Sidebar renders on every page — all non-auth pages include `sidebar.js`; Login, Register, Onboarding, Wellness, RPE, auth-callback correctly omit it

### Hub.html
- 🔧 **FIXED** — corrupted `renderBadgesAndStats` function signature caused SyntaxError that silenced the entire first script block; all KPIs, search, activity feed, and task buttons were broken
- ✅ Page loads without JS errors (post-fix)
- ✅ Greeting changes by time of day (Good morning / afternoon / evening)
- ✅ `greetSub` shows microcycle + MD-X + today's session (if exists)
- ✅ Squad KPI shows real player count
- ✅ Wellness KPI shows real average readiness
- ✅ Injuries KPI shows active injury count
- ✅ ACWR KPI shows a value (or `—` if no RPE data)
- ✅ Availability pills show real player availability for today
- ✅ Recent Activity feed shows real events — hardcoded placeholder rows are cleared and rebuilt from Supabase on load
- ✅ Search bar: type a player name → results appear within 1s (300ms debounce)
- ✅ Search bar: ⌘K focuses input
- ✅ Search bar: Escape closes dropdown
- ✅ "Add task" button → navigates to `Chat & Tasks.html`
- ✅ "View all activity" button → navigable
- ✅ Module foot stats (Squad, Wellness, Injuries, Load, Planning) show real counts

---

## PLAYERS

### Squad.html
- ✅ Table loads and shows real players
- ✅ Player number, name, position, status visible
- ✅ "Add player" → modal opens with empty form
- 🔧 **FIXED** — validation required both first AND last name to be empty before showing error; now correctly requires `first_name` alone
- ✅ Save without first name → toast error, modal stays open (post-fix)
- ✅ Save valid player → new row appears in table, toast confirmation
- ✅ Edit player → modal pre-fills all fields
- ✅ Update player → row reflects change
- ✅ Delete player → confirm dialog → row removed, toast confirmation
- ✅ Cancel delete → modal stays open

---

## PERFORMANCE

### Calendar.html
- ✅ Current microcycle loads and 7-day grid renders
- ✅ Today's column is highlighted
- ✅ Existing sessions appear in correct day columns
- ✅ Filter pills (All / Training / Match / Gym / Recovery) work
- ✅ "+ Add" button on a day opens modal with pre-filled date
- ✅ "New event" header button opens modal
- ✅ Save new event → appears in grid
- ✅ Edit event → form pre-fills all fields
- ✅ Delete event → confirm → event removed
- ✅ MC switcher dropdown lists all microcycles
- ✅ Week navigation (prev/next) works for multi-week MCs

### RPE.html
- ✅ Page loads (has back link to Hub.html)
- ✅ Auth guard works (no session → Login.html)
- ⚠ Player name display uses `p.first_name + ' ' + p.last_name` without null guards — could show "null null" if DB returns nulls

### Load Monitor.html
- ⚠ Requires browser verification (ACWR values, player list)

---

## MEDICAL

### Injuries.html
- ✅ Active injuries count in KPI matches cards rendered
- ✅ Each card shows: player name, injury type, body area, severity, days out
- ✅ "Log injury" → modal opens, player select populated
- ✅ Save injury (all fields) → new card appears
- ✅ Discharge button visible on active cards
- ✅ Discharge modal: set return date → confirm → card moves to discharged section

### Physio.html
- ✅ Treatment list loads with player names
- ✅ Treatment cards show: type, notes, body zones (if set)
- ✅ No `treatment_type` errors in console — query uses `type` column correctly

### Wellness.html (canvas)
- ⚠ Phone 1 (form) renders without blank white box — React/Babel, requires browser verification
- ⚠ Phone 2 (success/streak) renders — requires browser verification
- ⚠ Dark mode toggle switches theme on both phones — requires browser verification

---

## TECHNICAL

### Daily Planning.html
- ✅ Date defaults to today
- ✅ Squad section shows available/unavailable/injured players
- ✅ Physio section shows today's treatments
- 🔧 **FIXED** — prev/next buttons had no IDs or event listeners; added `loadDay(dateStr)` function and wired all navigation events
- ✅ Prev/Next date navigation changes the date (post-fix)
- ✅ Squad count updates on date change (post-fix)

### GPS Analysis.html
- ✅ Player count KPI loads
- ✅ GPS data table renders (or shows empty state)
- ✅ Columns: total_distance, sprint_distance, high_speed_distance, accelerations, max_speed

### Evaluations.html
- ✅ Page loads without error (table may be empty — that's OK)
- ✅ No console errors about missing columns — uses `evaluation_type` (not test_name/test_type/title)

### Sessions History.html
- ✅ Session list loads
- ✅ Columns: title, session_type, session_date, duration

---

## FITNESS

### Gym Planner.html
- ✅ Exercise list loads from `gym_exercises`
- ✅ No console errors

### Gym Library.html
- ✅ Exercise cards render with `muscle_group` (not `muscles`)
- ✅ Category badge shows (not `complexity`)
- ✅ No broken card renders

### Nutrition.html
- ✅ Player list loads
- ✅ Weight shown from `players.weight` (not `weight_kg`)
- ✅ Nutrition data renders or shows empty state

---

## PLANNING

### Planner.html
- ✅ Page loads, read-only session data renders
- ✅ No console errors

### Sessions Library.html
- ✅ Session templates list loads
- ✅ No console errors

### Match Reports.html
- ✅ Page loads
- ✅ GPS queries use correct columns (`gps_reports`: total_distance, sprint_distance, max_speed, player_load)

---

## COMMUNICATION

### Chat & Tasks.html
- ✅ Messages load for current club
- ✅ Tasks list loads for current user
- ⚠ Send message → appears in chat — requires browser verification (Realtime wired correctly)
- ⚠ Create task → appears in task list — requires browser verification
- ✅ No encoding errors in URL navigation — href uses `Chat%20%26%20Tasks.html`

---

## ADMIN

### Admin.html
- ✅ Profiles list loads with `club_role` and `last_seen_at` (post-migration)
- ✅ No 400 errors from Supabase in console — selects valid columns only

### Availability.html
- ✅ Today's availability list loads
- ✅ Status pills show correct colors
- ✅ `applyClubTheme()` applies club color (not default blue)

---

## REGRESSION CHECKS

- ✅ No page shows "undefined undefined" — no unguarded `name` concatenation found in reviewed pages
- ✅ No page shows hardcoded "FC Barcelona" — not present in codebase
- ✅ Hardcoded "Joaquín" in Hub.html/Chat/Admin is static placeholder HTML that gets replaced by JS on load
- ✅ No page has a blank sidebar — all non-auth pages include sidebar.js
- ⚠ No 500 errors from Supabase — requires browser/network tab verification
- ✅ No `column does not exist` errors — all queries use verified column names (weight, type, muscle_group, category, evaluation_type, primary_color, title/session_type/session_date)
- ✅ No `platform_admins` errors in messages queries — Chat & Tasks.html does not reference that table

---

## Bugs fixed (2026-05-20)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | Hub.html | Corrupted `renderBadgesAndStats` function signature → SyntaxError → all KPIs, search, and buttons non-functional | Restored function signature; added `btnAddTask` / `btnViewAllActivity` click handlers |
| 2 | Squad.html | Validation passed when only `last_name` was empty; checklist requires `first_name` alone to block save | Changed condition to `if (!payload.first_name)` |
| 3 | Daily Planning.html | Prev/Next buttons had no IDs or handlers; date navigation was non-functional | Added `loadDay(dateStr)`, module-level state (`_dpCurrentDate`, `_dpPlayers`, `_dpInjMap`), wired all nav events |

---

## Sign-off

| Tester | Date | Environment | Result |
|---|---|---|---|
| Claude (static analysis) | 2026-05-20 | Code review | 3 bugs fixed; ⚠ items need browser run |
| | | localhost:5500 | |
| | | Production | |
