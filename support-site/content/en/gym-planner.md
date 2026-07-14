---
title: Gym Planner
slug: gym-planner
world: planning
app_page: Gym Planner.html
order: 6
summary: The strength-session builder — warm-up, plyometrics, main work and individual adaptations, with sets × reps × load, tonnage, and an AI draft that only picks from your own exercises.
---

## What it is

The Gym Planner builds a complete strength/gym session, organized into ordered blocks — **Warm-up & mobility, Plyometrics & power, Main work,** and **Individual adaptations** — where each exercise is prescribed with sets × reps, load, rest, tempo and RPE, and each player can get physio-driven replacements.

## When you use it

You open it from the [Calendar](/support/calendar) by clicking a gym session for a date; it loads that date's session (or starts a new one), inheriting the microcycle and MD- context. Use it to prescribe the session, assign the athletes, apply individual adaptations, then print or publish it.

## How it works

**Set the session info.** Date, start time, duration, expected RPE, location, and a title. **Orientation** pills (multi-select) tag the emphasis — Activation, Hypertrophy, Max strength, Power, RSI · reactive, Recovery. Fields inherited from the Calendar (microcycle, match day, time, duration, RPE) are marked as calendar-sourced — change them in the Calendar to keep things in sync.

**Build the four blocks.** Add exercises to each block from the Gym Library ("From library") or as new rows:

- **Warm-up & mobility** — exercise, sets, reps/time, tempo, notes.
- **Plyometrics & power** — exercise, contact type (Intensive / Extensive), sets × reps, contacts, box/height, rest, notes.
- **Main work** — exercise, a per-row **mode** toggle (**SR** sets×reps or **VBT** velocity-based), sets × reps, load (kg or %1RM), rest, tempo and RPE.
- **Individual adaptations** — per-player replacements, seeded from today's Physio treatments and editable, plus any you add: player, affected exercises, replacement, and the reason.

**Watch the totals.** A live bar shows warm-up, plyometrics and main-work counts, total **tonnage** (auto-summed from sets × reps × load), the number of athletes, and **Planned AU** (duration × RPE).

**Assign the athletes.** Pick players from the squad (unavailable players are badged), and use **Load groups** to split the squad into tiers from their strength-test results and prescribe a %RM load range per tier.

**Generate with AI (optional).** Describe the objective (e.g. "hamstring strength, eccentric emphasis, 12 players") and the assistant produces an editable **draft** you review before it's applied — see Key concepts for exactly what it can and can't do.

**Save, template, publish.** The session auto-saves as you edit. You can save it as a **template** (or load one), **Print** / **Export PDF** a session sheet, and **Publish** it to players.

## Key concepts

**The blocks.** A gym session is a fixed sequence: warm-up/mobility → plyometrics/power → main work → individual adaptations. The order mirrors how the session runs and how it prints.

**Prescription (sets × reps × load).** Each main-work row carries sets × reps, a load (kg, bodyweight, relative "+N", or a %1RM), rest, and a tempo (e.g. "2-0-1" — eccentric-pause-concentric). **Tonnage** is the summed sets × reps × load across the valid main-work rows — a simple volume-load figure.

**SR vs VBT.** Each main exercise is prescribed either as **SR** (sets × reps, the default) or **VBT** (velocity-based training, prescribing by bar velocity). The mode is saved per exercise.

**AI-assisted generation.** The assistant **only selects from your club's existing, tagged Gym Library exercises — it never invents exercises.** It reads your objective plus optional context (player count, emphasis, and soft signals like the match day, team ACWR zone and readiness trend) and returns a **draft** — warm-up, plyometrics and main-work rows built from real exercise IDs. You confirm before it replaces the current session, and every field stays fully editable afterward. If nothing in the library is tagged yet, it asks you to tag exercises in the Gym Library first.

**Load groups.** Rather than one prescription for everyone, Load groups clusters the squad into tiers from their strength-test values and shows a per-tier load range for a chosen %RM — so each athlete lifts relative to their own test.

**How it relates to load.** The session's duration × expected RPE gives the **Planned AU** — the planning-side internal-load estimate. The delivered internal load comes from the players' session-RPE afterward (see [RPE](/support/rpe)), which in turn feeds the [Load Monitor](/support/load-monitor).

## FAQ

**Does the AI make up exercises?** No. It picks only from your club's existing Gym Library exercises (the ones tagged with muscle group/purpose) and returns an editable draft you approve — it can't add exercises that aren't already in your library.

**Can I still edit an AI-generated session?** Yes — the draft is fully editable, and it only replaces the current session after you confirm.

**How is tonnage calculated?** It sums sets × reps × load across the main-work rows that have a numeric load; bodyweight and relative loads are skipped.

**Where do the individual adaptations come from?** From today's Physio treatments for the team (pre-filled) plus any you add manually — each names the player, the affected exercises, the replacement and the reason.

**Why are some fields locked?** Fields inherited from the Calendar (microcycle, match day, time, duration, RPE) are edited there to stay in sync across the app.

> TODO — could not confirm from the code, please verify: (1) there's no visible UI to group exercises as **supersets/circuits** — each row is standalone. (2) **Row reordering** (drag to reorder) wasn't found. (3) After an **AI draft**, closing the tab before saving appears to lose it (no separate draft persistence found). (4) **Templates** save the warm-up/plyo/main rows but apparently not the individual adaptations.

## Related

- [Calendar](/support/calendar) — where the gym session is scheduled and its MD- context set.
- [Daily Planning](/support/daily-planning) — the field-session counterpart to this gym session.
- [RPE](/support/rpe) — delivered s-RPE load versus the Planned AU here.
- [Load Monitor](/support/load-monitor) — where that load rolls up into ACWR.
