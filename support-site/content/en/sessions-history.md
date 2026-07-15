---
title: Sessions History
slug: sessions-history
world: performance
app_page: Sessions History.html
order: 6
summary: The archive of past training sessions — filter, review and compare completed sessions, and surface back-filled historical imports that carry real load and GPS data.
---

## What it is

Sessions History is the archive of past training sessions: every completed session, filterable and comparable, with its load, attendance and match-day context — plus the back-filled **historical** imports that carry real data but were never planned in the app.

## When you use it

To look back — audit what was actually done, review load progression across a block, find and copy a past session, or compare a few sessions side by side. It's also where you surface the imported historical sessions that build a player's load baseline.

## How it works

**Choose a view.** The same filtered set of sessions renders three ways: **List** (a paginated table), **Grid** (cards with date, focus, duration, load and attendance), and **Calendar** (a month grid, color-coded by focus).

**Filter.** A date range (7d / 30d / 90d / Season, default last 30 days), a team selector, and toggles for **orientation** (Introductory, Activation, Muscle tension, Speed, Duration, Recovery), **focus** (Tactical, Individual, Physical, Sectorial), **load band** (Low 0–299, Moderate 300–599, High 600–899, Peak 900+ AU) and **MD position** (MD-5 … MD … MD+2). A **search** box matches title and notes, and a **"Show historical GPS imports"** checkbox reveals the historical sessions (hidden by default).

**Read a row.** The table shows date, MD position, session title, focus, orientation, duration, **load** (AU, with a bar), and attendance. Row actions **Open** it in [Daily Planning](/support/daily-planning) or **Copy** it to a new session.

**Open the detail.** Clicking a session slides out a panel with its metadata (date, MD, type/orientation, duration, load and load band, estimated RPE, attendance), notes, and its exercises. From there you can edit the basics inline, jump to [Daily Planning](/support/daily-planning) for a full edit, or open a gym session in the [Gym Planner](/support/gym-planner).

**Work across sessions.** **New session** creates one for today, **Export CSV** downloads the filtered list, and **Compare sessions** puts two or three side by side (date, MD, type, duration, orientation, load, RPE entries, notes).

## Key concepts

**Historical sessions (`is_historical`).** A historical session is one **back-filled or imported** rather than planned in the app — for example, sessions recovered from GPS exports or entered after the fact. They carry real load, attendance and GPS data, but they weren't scheduled through the planner. They're **hidden by default** here and excluded from the forward-planning views (Calendar, Daily Planning); the "Show historical GPS imports" toggle brings them into the archive.

**Planned vs historical.** A **planned** session is created in [Daily Planning](/support/daily-planning) for forward scheduling and may not have load data yet. A **historical** session already carries its delivered data. The archive holds both; planning surfaces only the planned ones.

**Why the archive matters.** The chronic side of [ACWR](glossary#acwr) needs weeks of load history. Historical imports let you back-fill that history, so the [Load Monitor](/support/load-monitor) can compute a meaningful acute:chronic ratio from day one and you can analyze load retrospectively — without those back-filled sessions cluttering the planning calendar.

**Load (AU).** Each session's load in arbitrary units is derived from RPE × duration (per-player where session-RPE exists, otherwise from the estimated RPE), which is what the load bands and the Load Monitor build on.

**MD position.** Every session is placed relative to its microcycle's match — MD is the match, MD-n the days before, MD+n the days after — so you can filter the archive by where sessions sat in the week.

## FAQ

**Why don't I see all my sessions?** By default the archive shows only planned sessions in the selected date range. Tick **Show historical GPS imports** to include the back-filled/imported ones, and widen the date range if needed.

**What makes a session "historical"?** It was imported or back-filled (`is_historical`) rather than planned in the app — it carries real data but never went through the planner, so it's hidden from planning views.

**How do I reuse a past session?** Use **Copy** on the row to create a new session from it, or open it and edit in Daily Planning.

**Can I compare sessions?** Yes — **Compare sessions** shows two or three side by side.

## Related

- [Daily Planning](/support/daily-planning) — where sessions are built and edited.
- [Calendar](/support/calendar) — the forward-planning view of the same sessions.
- [Load Monitor](/support/load-monitor) — the archive's load history feeds the chronic ACWR window.
- [GPS Analysis](/support/gps-analysis) — where imported GPS sessions are analyzed.
