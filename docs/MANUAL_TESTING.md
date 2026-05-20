# Manual Testing Checklist — ClavaMetrics

> Run with a real Supabase session. Mark ✅ pass / ❌ fail / ⚠ partial.
> Prerequisite: `001_stabilization.sql` applied ✅ (verified 2026-05-20)

---

## Setup

- [ ] `npm install && npx serve . -p 5500` running
- [ ] Test club created (via Register.html) with ≥1 player in Squad
- [ ] At least 1 active injury, 1 training session, 1 microcycle in DB

---

## AUTH

### Login.html
- [ ] Empty form → browser validation fires (no submit)
- [ ] Wrong credentials → error message visible, button re-enabled
- [ ] Valid credentials → redirect to Hub.html
- [ ] Already logged in → direct to Hub.html (no flash of login form)
- [ ] Google OAuth button → redirects to Google (or shows error if not configured)

### Register.html
- [ ] Already logged in → direct to Hub.html
- [ ] Empty required fields → browser validation fires
- [ ] Valid form → check-email message OR redirect to Onboarding.html
- [ ] Duplicate email → error message visible in `#reg-error`
- [ ] Terms checkbox unchecked → form doesn't submit

### Logout
- [ ] Sidebar logout link → clears session, redirects to Login.html
- [ ] After logout, pressing Back → stays on Login.html (no re-entry)

---

## CORE NAVIGATION

### Sidebar (all pages)
- [ ] Club logo + name show correctly (not placeholder)
- [ ] User name + role show correctly (not hardcoded)
- [ ] Active page is highlighted in nav
- [ ] All 28 nav links are clickable and reach the correct page
- [ ] Sidebar renders on every page (no page shows raw content without sidebar)

### Hub.html
- [ ] Page loads without JS errors in console
- [ ] Greeting changes by time of day (Good morning / afternoon / evening)
- [ ] `greetSub` shows microcycle + MD-X + today's session (if exists)
- [ ] Squad KPI shows real player count
- [ ] Wellness KPI shows real average readiness
- [ ] Injuries KPI shows active injury count
- [ ] ACWR KPI shows a value (or `—` if no RPE data)
- [ ] Availability pills show real player availability for today
- [ ] Recent Activity feed shows real events (not hardcoded)
- [ ] Search bar: type a player name → results appear within 1s
- [ ] Search bar: ⌘K focuses input
- [ ] Search bar: Escape closes dropdown
- [ ] "Add task" button → navigates to Chat & Tasks.html or opens task form
- [ ] "View all activity" button → navigable
- [ ] Module foot stats (Squad, Wellness, Injuries, Load, Planning) show real counts

---

## PLAYERS

### Squad.html
- [ ] Table loads and shows real players
- [ ] Player number, name, position, status visible
- [ ] "Add player" → modal opens with empty form
- [ ] Save without first name → toast error, modal stays open
- [ ] Save valid player → new row appears in table, toast confirmation
- [ ] Edit player → modal pre-fills all fields
- [ ] Update player → row reflects change
- [ ] Delete player → confirm dialog → row removed, toast confirmation
- [ ] Cancel delete → modal stays open

---

## PERFORMANCE

### Calendar.html
- [ ] Current microcycle loads and 7-day grid renders
- [ ] Today's column is highlighted
- [ ] Existing sessions appear in correct day columns
- [ ] Filter pills (All / Training / Match / Gym / Recovery) work
- [ ] "+ Add" button on a day opens modal with pre-filled date
- [ ] "New event" header button opens modal
- [ ] Save new event → appears in grid
- [ ] Edit event → form pre-fills all fields
- [ ] Delete event → confirm → event removed
- [ ] MC switcher dropdown lists all microcycles
- [ ] Week navigation (prev/next) works for multi-week MCs

### RPE.html
- [ ] Page loads (has back link to Hub.html)
- [ ] Auth guard works (no session → Login.html)

### Load Monitor.html
- [ ] Player list loads
- [ ] ACWR values render per player
- [ ] No JS console errors

---

## MEDICAL

### Injuries.html
- [ ] Active injuries count in KPI matches cards rendered
- [ ] Each card shows: player name, injury type, body area, severity, days out
- [ ] "Log injury" → modal opens, player select populated
- [ ] Save injury (all fields) → new card appears
- [ ] Discharge button visible on active cards
- [ ] Discharge modal: set return date → confirm → card moves to discharged section

### Physio.html
- [ ] Treatment list loads with player names
- [ ] Treatment cards show: type, notes, body zones (if set)
- [ ] No `treatment_type` errors in console (should use `type`)

### Wellness.html (canvas)
- [ ] Phone 1 (form) renders without blank white box
- [ ] Phone 2 (success/streak) renders
- [ ] Dark mode toggle switches theme on both phones

---

## TECHNICAL

### Daily Planning.html
- [ ] Date defaults to today
- [ ] Squad section shows available/unavailable/injured players
- [ ] Physio section shows today's treatments
- [ ] Prev/Next date navigation changes the date
- [ ] Squad count updates on date change

### GPS Analysis.html
- [ ] Player count KPI loads
- [ ] GPS data table renders (or shows empty state)
- [ ] Columns: total_distance, sprint_distance, high_speed_distance, accelerations, max_speed

### Evaluations.html
- [ ] Page loads without error (table may be empty — that's OK)
- [ ] No console errors about missing columns (test_name, test_type, title)

### Sessions History.html
- [ ] Session list loads
- [ ] Columns: title, session_type, session_date, duration

---

## FITNESS

### Gym Planner.html
- [ ] Exercise list loads from `gym_exercises`
- [ ] No console errors

### Gym Library.html
- [ ] Exercise cards render with `muscle_group` (not `muscles`)
- [ ] Category badge shows (not `complexity`)
- [ ] No broken card renders

### Nutrition.html
- [ ] Player list loads
- [ ] Weight shown from `players.weight` (not `weight_kg`)
- [ ] Nutrition data renders or shows empty state

---

## PLANNING

### Planner.html
- [ ] Page loads, read-only session data renders
- [ ] No console errors

### Sessions Library.html
- [ ] Session templates list loads
- [ ] No console errors

### Match Reports.html
- [ ] Page loads
- [ ] GPS queries don't error

---

## COMMUNICATION

### Chat & Tasks.html
- [ ] Messages load for current club
- [ ] Tasks list loads for current user
- [ ] Send message → appears in chat
- [ ] Create task → appears in task list
- [ ] No encoding errors in URL navigation

---

## ADMIN

### Admin.html
- [ ] Profiles list loads with `club_role` and `last_seen_at` (post-migration)
- [ ] No 400 errors from Supabase in console

### Availability.html
- [ ] Today's availability list loads
- [ ] Status pills show correct colors
- [ ] `applyClubTheme()` applies club color (not default blue)

---

## REGRESSION CHECKS

- [ ] No page shows "undefined undefined" (name display bug)
- [ ] No page shows hardcoded "Joaquín" or "FC Barcelona"
- [ ] No page has a blank sidebar (broken sidebar.js injection)
- [ ] No 500 errors from Supabase in browser network tab
- [ ] No `column does not exist` errors (all migrations applied)
- [ ] No `platform_admins` errors in messages queries

---

## Sign-off

| Tester | Date | Environment | Result |
|---|---|---|---|
| | | localhost:5500 | |
| | | Production | |
