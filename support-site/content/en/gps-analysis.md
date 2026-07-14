---
title: GPS Analysis
slug: gps-analysis
world: performance
app_page: GPS Analysis.html
order: 1
summary: A multi-view GPS dashboard — distance, speed zones, accelerations and player load across sessions, weeks and matches, with baselines, ACWR and fitness-fatigue trends.
---

## What it is

GPS Analysis is the workspace for external-load data. It turns per-player GPS metrics — distance, speed zones, accelerations, [player load](glossary#player-load) — into session reviews, weekly reports, match profiles and load-monitoring trends, compared against team baselines and injury-risk thresholds.

## When you use it

Use it after each session or match to review what athletes actually did, and across the week to compare planned versus delivered load, spot outliers, and track fitness and fatigue. It shares its [ACWR](glossary#acwr) engine with the [Load Monitor](/support/load-monitor); GPS Analysis is where you go for the deeper, per-metric and per-player drilldown.

## How it works

**Choose a view.** Five views cover different questions, switched from the sections bar:

- **Player Week Report** — one player's week: volume day by day, week-vs-match comparison, ACWR, and the fitness/fatigue/form trend.
- **Session Control** — the squad's last session: a full metrics table, a z-score matrix, a microcycle heatmap, and variation versus equivalent past sessions.
- **Match Performance** — a player's matches across the season: distance per match and velocity-zone distribution.
- **Load Monitoring** — team injury-risk: ACWR gauges, risk alerts, and match demands versus training delivered.
- **Microcycle Compare** — one training week against another: diff table, load shape, monotony/strain, and the biggest movers.

**Filter globally.** A single filter bar drives every view: a **date range** (default last 30 days), a **microcycle** selector, a **player** selector, and a **historical** toggle that brings imported past data into baselines and comparisons. Cards can also be pinned to a specific player independent of the global filter.

**Import the data.** Bring GPS in by drag-and-drop or file browse (`.csv`, `.xlsx`, `.tsv`), one file per session or a season-long export; columns are auto-detected and mapped to players, and a template is available to match the expected format. During import, speed outliers are flagged for review.

**Customize the dashboard.** Each view is a set of cards you can resize (S / M / L / Full), reorder, add and remove. **Add card** opens a gallery of evidence-based templates (ACWR, monotony/strain, CTL/ATL/TSB, speed zones, outliers…) or a custom chart builder. **Save layout** and **Saved views** persist arrangements per view.

**Export.** Export the current view's table to CSV. (A PDF report and direct provider sync are surfaced in the UI but not yet active — see the TODO below.)

## Key concepts

**Core GPS metrics.** The page works from these per-session values: **total distance**, **high-speed distance (HSR)**, **very-high-speed distance (VHSR)**, **sprint distance**, **sprint count**, **accelerations** and **decelerations**, **max** and **average speed**, **player load**, **distance per minute**, and **time played**.

**Speed zones.** Distance is split into speed bands (walk/jog → HSR → VHSR → sprint) to show how much of a session was high-intensity. The velocity-zone charts break each session or match into those bands.

**Player load.** A cumulative measure of external load in arbitrary units, derived from movement (acceleration/velocity exposure). It's the default base metric for ACWR and the fitness-fatigue model.

**ACWR.** The acute:chronic workload ratio — recent load (roughly 7 days) over the rolling baseline (roughly 28 days). GPS Analysis uses the same shared, club-configured ACWR engine as the [Load Monitor](/support/load-monitor); you can base it on player load, total distance, HSR, sprint distance or accelerations.

**Fitness · Fatigue · Form (CTL / ATL / TSB).** The Banister model: **CTL** (chronic training load, ~28-day EWMA) reads as fitness, **ATL** (acute training load, ~7-day EWMA) as fatigue, and **TSB** (training stress balance, CTL − ATL) as form — positive is fresh, negative is fatigued.

**Monotony & strain (Foster).** **Monotony** is mean daily load divided by its standard deviation — high monotony means flat, repetitive loading. **Strain** is weekly load times monotony. Both are flags for staleness/illness risk and appear in the Microcycle Compare view.

**Z-scores & outliers.** Metrics are standardized to flag anomalies. A **temporal** z-score compares a session to equivalent past sessions (same day-of-week/MD); a **positional** z-score compares a player to their role baseline. Values beyond a chosen threshold (2, 2.5 or 3) are flagged as outliers.

**Session versus match.** The "× match avg" reading expresses a training metric as a multiple of match demand (e.g. 0.6× distance = 60% of a match), helping dose weekly exposure against the demand players are actually preparing for.

## FAQ

**How do I get data in?** Upload a `.csv`, `.xlsx` or `.tsv` — one file per session or a season export. Columns auto-map to players; use the downloadable template if you want the exact expected format.

**Does it connect directly to Catapult / StatSports?** Direct provider sync is presented in the UI as a roadmap item — see the TODO below. Today the reliable path is file import.

**What's the difference from the Load Monitor?** They share the same ACWR engine. The Load Monitor is the squad-level risk board; GPS Analysis is the deep dive — per metric, per player, per session, with baselines and the fitness-fatigue model.

**Can I compare two weeks?** Yes — the Microcycle Compare view diffs a current week against a reference week, with per-player deltas, load shape, monotony/strain and the biggest movers.

> TODO — verify before documenting as shipped. The GPS agent flagged these as **stubs or "coming soon"** in the current page: **PDF export**, **provider sync** (Catapult / StatSports / Polar / WIMU / GPSports), a dedicated **GPS settings** panel, chart-type switching, and several catalog cards (accel/decel asymmetry, personal-baseline trend, position box plot, squad readiness, halves drop-off, us-vs-opponent). Also, exact **speed-zone thresholds** (HSR / VHSR / sprint m·s⁻¹ cut-offs) are not exposed in the page and appear to be club-configured — confirm the real values before publishing them.

## Related

- [Load Monitor](/support/load-monitor) — the squad-level ACWR view built on the same engine.
- [Calendar](/support/calendar) — where sessions are scheduled and planned load is set.
