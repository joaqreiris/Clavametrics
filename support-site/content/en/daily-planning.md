---
title: Daily Planning
slug: daily-planning
world: planning
app_page: Daily Planning.html
order: 2
summary: The session builder — design the full content of one training day: phases, drills, durations, intensity, the day's squad and the projected GPS load.
---

## What it is

Daily Planning is where you build the **content of a single training session** for a given date — its phases and drills, their durations and intensity, the day's squad and adaptations, and the planned load. The [Calendar](/support/calendar) schedules *when* a session happens; Daily Planning defines *what* it is.

## When you use it

You land here from the [Calendar](/support/calendar) by opening a training session, then design the day: confirm the session's time, [microcycle](glossary#microcycle) and [MD-](glossary#md-matchday-offset) context, set the squad and any physio adaptations, add the activation and field drills, and check the totals and projected GPS load before printing or publishing the session sheet for the field.

## How it works

**Confirm the session header.** The top card holds the session name, date, start/end time, microcycle, **orientation** (introductory, activation, muscle tension, speed, duration, recovery), **focus** (tactical, individual, physical, sectorial), an **expected RPE** (1–10), the **match day** offset (MD-5 … MD, … MD+2), and a notes field for weather, kit and context. Fields inherited from the Calendar are marked as calendar-sourced. The session is created and auto-saved as you edit.

**Read the totals bar.** Live figures update as you build: **Activation** minutes, **Field work** minutes, **Total**, **Session duration**, and **Planned AU** — the planned load, computed as expected RPE × total duration (see Key concepts).

**Set the day's squad.** The squad card groups players by position and lets you filter by status with pills — **All, Available, Partial, Unavailable, Injured, Sick, Away** — each showing a live count. Click a player to change their status for that date (it saves to availability). Unavailable, injured and sick players are listed separately with their reason. **Print Roster** opens a printable player list.

**Review physio adaptations.** A card surfaces players who have an active adaptation for today (pulled from Physio) — the note and the treatment modalities — so the session respects rehab and preventive limits. Once you've accounted for an adaptation you can mark it **applied**, and that acknowledgement is saved.

**Build the two phases.** Drills live in two grids:

- **Activation** — the warm-up / preparation phase.
- **Field exercises** — the main phase.

In each, add a drill **from the Exercises Library** (drills built in the planner/Drill Designer, with their diagram, dimensions and players) or add a **Manual** entry (name, duration, intensity, notes). Each drill card shows its thumbnail, tags, duration and metadata. Set the duration either as a flat number of minutes or as an **interval structure** — series × work time + rest — which the card totals for you. Add per-session notes, reorder or delete drills, and open a library drill in the Drill Designer.

**Check the projected GPS load.** A collapsible card projects the session's external load from the drills that have a GPS profile: for each metric it multiplies the drill's per-minute profile by its work minutes and sums across the session. You can pick which metrics to show and set a **target** per metric; the bar reads gray (under), green (on target ±10%) or amber (over). A note tells you how many drills are covered (drills without a GPS profile don't contribute).

**Print or publish.** Export the session as a one-page PDF sheet (letterhead, metadata, totals, squad, and the drill diagrams for activation and field), or publish it to notify staff.

## Key concepts

**Session ↔ microcycle ↔ MD-.** Every training session belongs to one **microcycle** (the training week built around a match) and carries a **match-day-minus** offset — MD-5, MD-4, … MD-1, MD, MD+1, MD+2 — measured from the microcycle's match date. That offset is the planning logic of the week: it signals the intended role of the day (e.g. MD-1 an activation, MD+1 a recovery), which in turn shapes the orientation, focus and load you set here. See [Calendar](/support/calendar) for how the microcycle and MD- labels are defined.

**Phases (activation vs main).** A session is split into an **activation** phase and a **main / field** phase. Both grids feed the session totals and the GPS projection, but keeping them separate mirrors how the session actually runs and prints.

**Planned load (AU).** The planned load in arbitrary units is **expected RPE × total session duration (minutes)** — a subjective, intent-based estimate of how demanding the session should be. It's the planning-side counterpart to the delivered [s-RPE](glossary#s-rpe) load reported after the session (see [RPE](/support/rpe)) and the external GPS load (see [GPS Analysis](/support/gps-analysis)).

**Interval structure (series / work / rest).** A drill's duration can be a flat number of minutes or an interval structure — series × work time, plus rest between them. The **work** minutes drive the GPS projection (time actually spent working); the **total** minutes (work + rest) drive the session time totals.

**Projected vs delivered.** The GPS projection here is what you *plan* to expose players to; the actual GPS report after training is what was *delivered*. Comparing the two is the feedback loop that tunes the next microcycle.

## FAQ

**Where do the drills come from?** From the Exercises Library (drills designed in the planner/Drill Designer, with diagrams and dimensions) or from a Manual entry you type in. Library drills carry their metadata and, when available, a GPS profile that feeds the projection.

**Why do some drills not affect the projected GPS load?** Only drills that have a GPS profile contribute. The projection note shows how many of the session's drills are covered; the rest need a profile before they count.

**How is the Planned AU figure calculated?** Expected RPE (1–10) × total session duration in minutes. Set the expected RPE in the session header.

**How do I set a player's status for the day?** Click the player in the squad card and choose a status; it saves to availability for that date and updates the squad counts.

## Related

- [Calendar](/support/calendar) — schedules the session and defines its microcycle and MD- label.
- [RPE](/support/rpe) — the delivered s-RPE load, versus the Planned AU you set here.
- [GPS Analysis](/support/gps-analysis) — planned versus delivered external load.
- [Availability](/support/availability) — the player statuses shown in the squad card.
