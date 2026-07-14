---
title: Calendar
slug: calendar
world: planning
app_page: Calendar.html
order: 1
summary: The team's planning canvas — microcycles, training sessions, matches and logistics laid out day by day around the match-day-minus framework.
---

## What it is

The Calendar is where the technical staff lays out the team's schedule: training sessions, matches, recovery, and logistics (travel, meals, meetings, press) organized into **[microcycles](glossary#microcycle)** and structured around the **[match-day-minus (MD-)](glossary#md-matchday-offset)** framework.

## When you use it

Use the Calendar as the starting point of every planning week. You build the microcycle here first — set the match date, drop in sessions, adjust the MD- labels — and then drill into each session from the Calendar into **Daily Planning** (field) or **Gym Planner** (gym) to design the actual content. It is also where you import the season's fixtures and publish the schedule to players.

## How it works

**Switch views.** Four views cover different planning horizons:

- **Microcycle** (default) — the current 7-day training week, laid out as a grid of days with their MD- labels.
- **Month** — a full month grid; sessions are color-coded by type and each microcycle is tinted so blocks are easy to see.
- **List** — a chronological list of upcoming sessions (title, type badge, duration).
- **Player view** — a staff-only preview of exactly what players see, showing only events shared with them.

Navigate with the **Today** button, the previous/next arrows (step by week in Microcycle view, by month in Month view), and the **zoom** controls that compress or expand how many days the microcycle shows.

**Filter what you see.** Quick-filter pills narrow the calendar to a single type: **All**, **Training**, **Gym**, **Match**, **Recovery**, or **Travel**. The **team switcher** at the top-left scopes everything to one squad/category.

**Read a day.** Each session appears as a colored pill carrying its start time and duration. Training and gym sessions also show a small **AU** figure in staff view — the planned session load (see Key concepts). Match tiles show the opponent crest when one is uploaded. A day marked as a day off collapses its sessions and shows an **OFF** tag instead.

**Work with sessions.**

1. **Click** a session to open its popover — time, location, duration, planned RPE, notes and audience. From there, **Edit** or **Delete** it, or jump straight into **Daily Planning** (training), **Gym Planner** (gym) or **Lineup** (match).
2. **Drag** a session to another day to move it (this updates its date). Within a day, sessions without a fixed start time can be dragged over each other to reorder them; sessions that have a start time are ordered by that time.
3. Click the **+** in a day column to create a new event on that date. The event form covers title, type, date, optional repeat, duration, start time, notes, audience, and — for matches — opponent, home/away, competition, stadium and crest.

**Set the MD- rhythm.** Each day carries an MD- tag derived from the microcycle's match date. Click a tag to override it manually — **Auto**, **MD**, **MD-1** through **MD-6**, **MD+1** through **MD+3**, or **OFF**. Manual overrides are marked as such so you can tell them apart from the auto-calculated ones.

**Create a microcycle.** Use **New microcycle** to open a block with a name, start date and end date. The new block populates the ribbon and re-renders the grid.

**Import fixtures.** **Import fixtures** opens a dialog with two tabs — paste text (one fixture per line) or upload a CSV — parsed into date, opponent, home/away and competition. A preview flags conflicts before you confirm, and an "overwrite conflicts" option lets you replace existing entries. Confirmed fixtures are created as match events.

**Publish to players.** Events carry an **audience**: Staff always see everything; you can additionally share an event with Players, Medical or Board. A public share link lets players open a read-only schedule of just the events shared with them — no login required. The right-hand panel shows the current publish state (Published / Draft) and lets you generate or revoke that link.

## Key concepts

**Microcycle.** A training block — usually a week — bounded by a start and end date and built around one target match. In Month view a microcycle shows as a tinted band; the header summarizes where you are (for example, "Microcycle 14 · MD-2").

**Match day minus (MD-) / morphocycle.** The days of the week are labeled relative to the match: **MD** is the game, **MD-1 … MD-6** count backwards from it, and **MD+1 … MD+3** are the recovery days after it. This is the morphocycle logic used to distribute training load across the week — high-intensity work is placed far from the match, tapering as MD approaches. Labels are computed automatically from the match date but can be overridden per day.

**Session types.** Beyond training, gym, recovery and match, the Calendar handles the full week: travel, hotel check-in/out, bus departure/arrival, meetings, press, medical checks, meals, video sessions and evaluations. Each has its own icon and color so the week reads at a glance.

**Planned load (AU).** For training and gym sessions, the Calendar shows a planned load in arbitrary units, computed as **duration (min) × planned RPE**. Sessions still missing an RPE are flagged so the week's planned load stays complete.

**Audience & publishing.** An event's audience decides who sees it — Staff, Players, Medical or Board. Publishing generates the read-only player schedule; the Player view lets you preview it before you share.

## FAQ

**How do MD- labels get set?** Automatically, from the microcycle's match date. Click any day's tag to override it manually (Auto, MD, MD-1…MD-6, MD+1…MD+3, OFF); manual overrides are marked so you can distinguish them.

**Can I move a session to another day?** Yes — drag it to the target day's column. To reorder sessions within the same day, drag ones without a fixed start time over each other; timed sessions order themselves by their start time.

**How do players get the schedule?** Share events with the Players audience and publish the microcycle's public link. Players open a read-only view of just those events; use **Player view** to preview it first.

**Where do I actually build the session content?** The Calendar schedules sessions; open one and use **Open in Daily Planning** (field) or **Open in Gym Planner** (gym) to design the drills and blocks.

> TODO — confirm before relying on these: sessions can carry a **Tasks** checklist (a Tasks section appears in the event popover), and **PDF export** produces a printable week/month sheet. Both are present in the page but their exact behavior was not fully verified while writing this. An alternate season-timeline ribbon also exists in the page but appears to be hidden/not yet active.

## Related

- [Load Monitor](/support/load-monitor) — the load you plan here feeds the acute:chronic ratios there.
- [GPS Analysis](/support/gps-analysis) — compare what you planned against what athletes actually did.
