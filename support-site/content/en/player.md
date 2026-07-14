---
title: Player Profile
slug: player
world: squad
app_page: Player.html
order: 3
summary: One athlete's data in a single read-only view — identity, KPIs, and tabs for physical tests, load & wellness, and availability & injuries, each pulled from its own module.
---

## What it is

The Player Profile is a **read-only aggregator**: one athlete's key data from across the app in a single view — identity and season KPIs up top, then tabs for physical tests, load & wellness, and availability & injuries. Each block is a window into a dedicated module.

## When you use it

For a fast, all-in-one read on one player — a pre-session or pre-match briefing (availability, [ACWR](glossary#acwr) zone, readiness), a progress check (test evolution, wellness trend), or a review of injury history — without hopping between pages. You reach it from the [Squad](/support/squad) by opening a player.

## How it works

**Identity card.** Photo, name, position, status, category, and the basics — age, nationality, height, weight, dominant foot.

**KPI rail (season).** Six headline figures: **Minutes played**, **Trainings done**, **Availability %**, **Days out**, **ACWR** (player-load ratio with its zone), and **Readiness** (7-day wellness average).

**Four tabs.**

- **Overview** — a technical radar and tactical/mental scores (from evaluations rated /10), a current physical assessment (latest objective tests plus a force-plate snapshot), and an injury summary.
- **Physical & tests** — pick a test type to see its evolution chart (with the squad band where there are enough peers) and a records table with deltas versus the previous result.
- **Load & wellness** — an ACWR gauge, the fitness/fatigue/form trend (CTL · ATL · TSB), weekly s-RPE load with monotony and strain, and a 14-day wellness trend.
- **Availability & injuries** — a season availability heatmap, the injury history timeline, and a days-out breakdown by cause.

Tabs load on first click. The page is read-only — you switch tabs, change the ACWR metric, or filter test types, but you don't edit data here.

## Key concepts

**An aggregator, not a source.** Nothing originates on this page. Each block mirrors a dedicated module and reads its live data: the load and wellness cards mirror the [Load Monitor](/support/load-monitor) and [Wellness](/support/wellness); the tests mirror [Evaluations](/support/evaluations); availability and injuries mirror [Availability](/support/availability). To change anything, go to that module — the profile just reflects it.

**Season window.** The KPIs and Overview use the club's season window, so the figures share a consistent date range.

**Benchmarking.** In the physical tests, a player's result is placed against the **team cohort** — but only when there are enough peers (at least four) to make the comparison meaningful; otherwise the profile says so. This is the same cohort rule the [Evaluations](/support/evaluations) page uses.

**What it does NOT show.** The profile is a summary, so several things live elsewhere: detailed **GPS metrics** (distance, speed, accelerations — here you only get ACWR; the full detail is in [GPS Analysis](/support/gps-analysis)); **session/microcycle** detail ([Sessions History](/support/sessions-history), [Calendar](/support/calendar)); **match event stats** (goals, assists); **nutrition** and **video**; and the full medical **dossier** (only summary stats appear here). The "Joined" field currently shows a placeholder.

## FAQ

**Can I edit the player here?** No — it's read-only. Edit the player in the [Squad](/support/squad); change availability, tests, wellness or injuries in their own modules, and the profile reflects it.

**Why does a percentile sometimes not show?** Because the team cohort has fewer than the minimum peers needed for a valid comparison.

**Where's the full GPS breakdown?** Not here — the profile shows ACWR only. Open [GPS Analysis](/support/gps-analysis) for distance, speed and accelerations.

**How do I reach a player's profile?** From the [Squad](/support/squad), open the player (the profile is per-player, keyed by the player).

> TODO — could not confirm from the code, please verify: (1) the **"Joined"** field renders a placeholder ("—") — not yet wired to a date. (2) **Edit player / export dossier / print** actions are referenced but don't appear wired into this page (navigation is limited to tabs and the breadcrumb back to Squad).

## Related

- [Squad](/support/squad) — the roster you open the profile from.
- [Load Monitor](/support/load-monitor) — the full load view the ACWR/CTL/ATL cards mirror.
- [Wellness](/support/wellness) — the full check-in history behind the 14-day trend.
- [Evaluations](/support/evaluations) — the testing module behind the physical tabs.
- [Availability](/support/availability) — where the availability heatmap's data is set.
