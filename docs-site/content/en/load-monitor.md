---
title: Load Monitor
slug: load-monitor
world: performance
app_page: Load Monitor.html
order: 2
summary: A squad-level workload-risk dashboard built on the acute:chronic workload ratio (ACWR) — who is underloaded, in the sweet spot, overreaching or in the danger zone.
---

## What it is

The Load Monitor is a squad-wide readiness dashboard centered on the **acute:chronic workload ratio (ACWR)**. It reads each player's recent load against their own rolling baseline and sorts the squad into workload zones — underloaded, sweet spot, overreach, or high risk — so the staff can see at a glance who needs pulling back and who has room to push.

## When you use it

Use it in the daily planning routine — typically before or after a session — to check the squad's risk picture, spot players trending into the danger zone, and cross-read ACWR against today's wellness and session-RPE. It complements the [Calendar](/docs/calendar) (which creates the sessions the load is calculated from) and [GPS Analysis](/docs/gps-analysis) (which offers the same engine with deeper per-metric drilldowns).

## How it works

**Pick the squad and the period.** The team selector scopes all data to one category. A segmented control switches the time window: **7d**, **28d** (default), **Microcycle**, or **Season**. Changing it re-scopes the chart, the distribution and every card.

**Read the KPI strip.** Four cards summarize the squad: average ACWR (with a mini zone bar), number of players in the danger zone, wellness average for today, and average session-RPE over the last seven days.

**Read the chart.** The main chart plots the squad-average ACWR over time as a line, with daily load drawn as bars behind it, and dashed reference lines at the zone thresholds. Importantly, the squad line is the **mean of each player's ACWR**, not a single pooled squad ratio — averaging ratios rather than raw loads keeps high-volume players from dominating the number.

**Read the distribution and wellness.** A donut breaks the squad into sweet-spot / overreach / danger / no-data slices (toggle it to a table if you prefer names and values). A wellness panel shows today's check-in dimensions (Sleep, Mood, Fatigue, Stress, Soreness — or the Hooper index if the club uses it), colored by how favorable each is.

**Work the player table.** Every player appears with jersey number, position, an ACWR value and bar, session-RPE, wellness, their acute/chronic figures, and a zone pill. You can:

- **Filter by zone** — All, Danger, Overreach, Sweet-spot, Underloaded.
- **Group by** Position, Status or Age, and **sort** by any column (ACWR sorts high-first by default; players with no data always sort last).
- **Act on a wellness flag** — a flagged row (reported sore area or wellness note) opens a modal where you can **Mark as seen** or **Create a follow-up in Injuries**.

**Tune the model.** Two controls change how ACWR is computed (see Key concepts): a **metric** selector chooses which load stream feeds the ratio (session-RPE load by default, or a GPS metric), and a **model** popover toggles **EWMA vs Rolling average** and **Uncoupled vs Coupled** chronic windows.

**Export.** Export the table to CSV (player, position, ACWR, acute and chronic load, zone, last RPE, sessions), and save the chart or distribution as a PNG.

## Key concepts

**ACWR (acute:chronic workload ratio).** A dimensionless ratio of recent load (the **acute** window, last 7 days) to the player's rolling baseline (the **chronic** window, last 28 days). It is a flag for how fast load is changing, not a verdict — read it alongside wellness, RPE and medical judgment.

**The zones.** The Load Monitor uses these boundaries (from the shared ACWR engine):

| Zone | ACWR | Reading |
| --- | --- | --- |
| Underloaded | below 0.8 | Recent load is under baseline — sub-optimal stimulus, detraining risk. |
| Sweet spot | 0.8 – 1.3 | Load is progressing in step with the baseline — the target range. |
| Overreach | 1.3 – 1.5 | Elevated, tolerable short-term (e.g. a loading block or taper) — watch closely. |
| High risk | 1.5 and above | An acute spike — the danger zone; combine with wellness before deciding. |

A player needs at least **4 sessions** in the chronic window to get an ACWR; below that they show as "no data" and are left out of the squad average.

**EWMA vs Rolling average.** The **EWMA** (exponentially weighted moving average) model is the evidence-based default: it weights recent days more and avoids the artificial "spike" a plain rolling average produces when old sessions drop off the 7-day edge. The **Rolling** model is the simple mean of the window. The active model is a **club-wide setting**, so every page that shows ACWR (Load Monitor, GPS Analysis, player dossiers) reads the same number.

**Coupled vs uncoupled.** By default the windows are **uncoupled**: the chronic window is days 8–28, excluding the acute 7 days. This stops the recent spike you are trying to detect from also inflating the baseline it is measured against (the methodologically preferred approach). **Coupled** includes all 28 days in the chronic window.

**s-RPE (session RPE) load.** The default load stream. For each session, load = **RPE (0–10) × duration (minutes)**, in arbitrary units — an internal, perception-based measure of how hard the session was. The metric selector can swap this for a GPS stream (player load, total distance, high-speed distance, sprint distance, sprints, or accelerations+decelerations) when GPS data is available.

**Acute vs chronic load.** Acute is the sum of load over the last 7 days — the recent stress. Chronic is the player's rolling baseline over 28 days — the load they are conditioned for. ACWR is simply acute relative to chronic.

## FAQ

**What ACWR is "good"?** The 0.8–1.3 sweet spot is the target. 1.3–1.5 is overreach — acceptable briefly but worth watching. 1.5 and above is the high-risk spike zone. Below 0.8 is underloading.

**Why does a player show no ACWR?** They have fewer than 4 sessions in the last 28 days, so there isn't enough history for a reliable baseline. They're excluded from the squad average until they cross that threshold.

**Which load does ACWR use?** Session-RPE load by default (RPE × minutes). Use the metric selector to base it on a GPS stream instead, where GPS data exists.

**Why is the squad line an average of ratios?** Because averaging each player's ACWR (rather than pooling raw squad load) prevents high-minute players from skewing the team-level picture — it reflects team risk more faithfully.

**Where does the load data come from?** From training sessions and their RPE entries (and, for GPS metrics, from imported/synced GPS reports). The [Calendar](/docs/calendar) creates the sessions; wellness flags link through to Injuries.

## Related

- [GPS Analysis](/docs/gps-analysis) — the same ACWR engine, plus per-metric and per-player analysis.
- [Calendar](/docs/calendar) — where the sessions and planned load originate.
