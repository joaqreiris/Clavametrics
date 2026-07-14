---
title: Annual Planner
slug: annual-planner
world: planning
app_page: Annual Planner.html
order: 3
summary: The season macro-plan — set a periodization model, lay out phases, competitions and fixtures, and break the year into mesocycles and weekly microcycles.
---

## What it is

The Annual Planner is the season-long macro view: you pick a **[periodization model](glossary#periodization-models)**, mark the **phases** of the year, load the **competitions and fixtures**, and break the season into **microcycles** (weeks) — optionally grouped into mesocycles — each anchored to its matches.

## When you use it

At pre-season setup and throughout the year for strategic planning: define the season, its phases and calendar, then generate and shape the weekly structure. From here you jump into the [Calendar](/support/calendar) to detail a given week and into [Daily Planning](/support/daily-planning) to build each session.

## How it works

**Create the season.** Give it a name and start/end dates, and choose a **planning model** (see Key concepts). The model decides what the rest of the screen offers — notably whether you plan in blocks (macrocycles/mesocycles) and whether microcycles are typed.

**Mark the phases.** Add season phases (e.g. pre-season, competitive, transition, off-season) with a color, dates, and a **"counts for availability"** flag — phases that don't count are drawn with a striped pattern and excluded from availability/load tracking.

**Add competitions and matches.** Register the competitions (league, cup, international, friendly, supercup — each with a color), then add matches manually or **import fixtures** by dragging a file (CSV, Excel, PDF) or pasting text; a preview lets you check them before importing.

**Add periodization blocks (block models only).** With a block model, create **macrocycles** and, nested inside them, **mesocycles** — each mesocycle carries a **load model** (Structured, Tactical, Verheijen, ATR or Integral).

**Build the microcycles.** Add a week manually or **Generate weeks from matches** to lay Mon–Sun microcycles across the fixture list, auto-embedding the match in its week. In edit mode, open a microcycle to set its name, dates, color, its mesocycle (block models) or its **micro type** (Structured model), and a **week plan**: for each day, an **MD** label and a **day type**. **Reset to morphocycle** clears a custom day plan back to the auto structure. **Open in Calendar** takes that week to the Calendar.

**Read the timeline.** A big timeline view stacks phases, macro/mesocycles (block models), microcycles and matches on a zoomable track (full season → 6 months → 3 months → 6 weeks), with KPI panels for the current microcycle, next match, season progress and active phase.

## Key concepts

**Periodization models.** The season's model shapes how you plan:

| Model | School | Blocks? | Typed micros? |
| --- | --- | --- | --- |
| Tactical Periodization | Frade — morphocycle | no | no |
| Structured Microcycle | Seirul·lo — typed micros | no | yes |
| ATR (block) | Issurin — 4–6 wk macrocycles | yes | no |
| Verheijen | football — 6-week blocks | yes | no |

- **Tactical Periodization (Frade)** organizes the week as a *morphocycle* around the match — no macro/meso blocks; the day types repeat weekly relative to MD.
- **Structured Microcycle (Seirul·lo)** types each week by its role: **Adjustment**, **Load**, **Impact** or **Competitive**.
- **ATR (Issurin)** and **Verheijen** are block models: the year is built from macrocycles → mesocycles, each mesocycle carrying a load emphasis.

**Season phases.** Phases segment the year (pre-season, competitive, transition, off-season, breaks) with their own color and dates. The "counts for availability" flag decides whether time in the phase feeds availability and load tracking — off-season/break phases are typically set not to count.

**Mesocycle → microcycle.** In block models a **mesocycle** groups several **microcycles** and sets the block's load model; it doesn't define daily structure. The **microcycle** is the atomic unit — a week (usually Mon–Sun) with an optional embedded match, an optional micro type, a color, and a day-by-day plan.

**How MD- is derived.** Each day's **match-day-minus** label comes from the week's match date: the match day is **MD**, the days before it count back **MD-1 … MD-6**, and the days after count up **MD+1 …**. The model maps each MD to a default day type — for example MD-1 → activation, MD-2 → speed, MD-3 → duration, MD-4 → muscle tension, MD-5 → recovery, MD+1/MD+2 → recovery, MD+3 → off. You can override any day, or reset the week back to this morphocycle default. This is the same MD- structure the [Calendar](/support/calendar) and [Daily Planning](/support/daily-planning) show.

## FAQ

**Which model should I pick?** Whichever matches your methodology — Tactical Periodization and Structured Microcycle plan week-by-week (no blocks); ATR and Verheijen add macro/meso blocks. Only the Structured model types each microcycle (Adjustment/Load/Impact/Competitive).

**How do I fill a season quickly?** Import the fixtures (CSV, Excel, PDF or pasted text), then **Generate weeks from matches** to create the microcycles automatically, each with its match embedded.

**Where do the day types on a week come from?** From the MD- structure of the model — each day gets a default type from its match-day label, which you can override per day and reset back with "Reset to morphocycle".

**What's the difference between a phase and a mesocycle?** A phase is a broad season segment (e.g. pre-season) with an availability flag; a mesocycle is a periodization block (block models only) that groups weeks and sets their load model.

> TODO — could not fully confirm from the code, please verify: (1) the **phase types** list is loaded from a separate table — the exact preset phase types (and whether staff can manage them) isn't visible on this page. (2) A microcycle can carry its **own embedded match** independent of the Calendar events — the exact de-duplication between the two wasn't fully confirmed. (3) Whether a microcycle's **match time** set here is used downstream or is reference-only.

## Related

- [Calendar](/support/calendar) — detail a microcycle's week; matches and MD- labels are shared.
- [Daily Planning](/support/daily-planning) — build each session within the week the model shapes.
