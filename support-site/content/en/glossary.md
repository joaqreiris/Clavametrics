---
title: Glossary
slug: glossary
world: overview
order: 0
app_page: 
summary: The single source of truth for ClavaMetrics' domain concepts — ACWR, s-RPE, EWMA, MD-, microcycles and more, with the real formulas and cited references.
---

## What it is

This glossary is the single source of truth for the domain concepts used across ClavaMetrics. Each entry gives a short definition, how the app actually computes it (the real formula, taken from the code), how to read it and its limits, and references. Other pages link their first mention of a term here rather than re-defining it.

## ACWR

**Acute:chronic workload ratio** — recent load (the **acute** window) divided by the rolling baseline (the **chronic** window). It's a dimensionless number that flags how fast a player's load is changing relative to what they're conditioned for.

**How ClavaMetrics computes it.** Acute window = **7 days**, chronic window = **28 days**. Daily loads are zero-filled (non-training days count as 0). Two models are available (the active one is a club setting):

- **EWMA** (default) — an exponentially weighted moving average with decay λ = 2/(N+1), so λ_acute = 2/8 and λ_chronic = 2/29; each day's load updates the running average and ACWR = acute ÷ chronic.
- **Rolling average** — ACWR = mean(last 7 days) ÷ mean(chronic window).

The windows are **uncoupled** by default: the chronic window excludes the acute 7 days (days 8–28), so the recent spike being measured doesn't also inflate its own baseline. A player needs at least **4 sessions** in the chronic window to get a value.

**Zones.** ClavaMetrics classifies ACWR as: **under 0.8** underloaded · **0.8–1.3** sweet spot · **1.3–1.5** overreach · **1.5 and above** high risk.

**How to read it — and an honesty note.** ACWR is a *signal of load change*, not a prediction of injury. The "sweet spot" idea and the use of ACWR as an injury predictor are **methodologically contested** in the literature: the ratio has mathematical-coupling and analytical problems, and the protective "sweet spot" has **not replicated consistently** across studies. Treat ACWR as one input — read it alongside wellness, session-RPE and, above all, medical judgment — never as a verdict. **See References 1, 3–9.**

## s-RPE

**Session RPE (session load)** — an internal-load measure combining how hard a session felt with how long it lasted.

**How ClavaMetrics computes it.** **s-RPE = RPE × session duration in minutes**, in arbitrary units (au), with RPE on a **1–10** scale. A 60-minute session rated 7 = 420 au. This is the per-player, per-session load that feeds ACWR when the s-RPE metric is selected. **See Reference 10.**

## Acute and chronic load

**Acute load** is the total (or EWMA-weighted) load over the recent window (**7 days** in ClavaMetrics) — the current stress. **Chronic load** is the rolling baseline over the longer window (**28 days**) — what the player is conditioned to tolerate. [ACWR](glossary#acwr) is acute relative to chronic. In the uncoupled model the chronic window excludes the acute days so the two don't overlap.

## EWMA

**Exponentially weighted moving average** — a way of averaging a time series that gives more weight to recent values. ClavaMetrics uses it as the default [ACWR](glossary#acwr) model because, unlike a plain rolling average, it weights recent load more heavily and avoids the artificial jump a rolling average produces when an old session drops off the edge of the window.

**How ClavaMetrics computes it.** Decay factor **λ = 2/(N+1)** for a window of N days; each day: `value = load·λ + previous·(1−λ)`, applied with N=7 for the acute series and N=28 for the chronic series. **See Reference 2.**

## MD (matchday offset)

**Match-day minus / plus** — each day of a training week is labeled relative to the match. **MD** is the match; **MD-1 … MD-6** count backwards from it; **MD+1, MD+2 …** count forward (recovery). It's the backbone of weekly planning: the offset signals the intended role and load of the day. In ClavaMetrics the offset is derived automatically from the microcycle's match date and can be overridden per day. See [Morphocycle](glossary#morphocycle) for the methodology this comes from.

## Microcycle

A **microcycle** is a training block, usually a week, built around one match. It bounds a set of sessions with a start and end date and (usually) a target match, and carries the [MD](glossary#md-matchday-offset) structure for its days. Microcycles are the atomic unit of the season plan.

## Morphocycle

The **morphocycle** is the weekly structure of Tactical Periodization (Vítor Frade's methodology): the week is organized around the match using the [MD-](glossary#md-matchday-offset) days, with a characteristic distribution of effort (e.g. varying the dominant contraction/tension, duration and speed demands as the match approaches). ClavaMetrics represents it through the MD- day labels and their default day types. (See the References note on methodology sources.)

## Periodization models

The season-planning frameworks ClavaMetrics offers on the [Annual Planner](/support/annual-planner):

- **Tactical Periodization** (Frade) — the [morphocycle](glossary#morphocycle); week organized around the match, no macro/meso blocks.
- **Structured Microcycle** (Seirul·lo) — weeks are *typed* (adjustment, load, impact, competitive).
- **ATR** (Issurin) — block periodization with accumulation/transmutation/realization macro-meso blocks.
- **Verheijen** — football-specific periodization in multi-week blocks.

These are selectable methodologies; the app tracks the structure, not the training prescription. **See Reference 12** and the References note.

## Player load

An accelerometer-derived measure of external load (in arbitrary units) accumulated from a player's movement (acceleration/velocity exposure). In ClavaMetrics it's one of the GPS metrics that can feed [ACWR](glossary#acwr), and it's the default base metric for the load and fitness/fatigue readings. The exact computation is proprietary to the GPS provider (Catapult/StatSports), so ClavaMetrics reads it from the imported data rather than computing it.

## HSR, VHSR and sprint distance

Distance covered above set speed thresholds: **high-speed running (HSR)**, **very-high-speed running (VHSR)** and **sprint distance**, each accumulating the metres run above its threshold. They quantify the high-intensity portion of a session.

**Important:** the speed thresholds are **configurable per club** in ClavaMetrics (and vary by provider and methodology), so this glossary deliberately does **not** publish fixed cut-off values — check your club's configured thresholds.

## Accelerations and decelerations (A+D)

Counts of acceleration and deceleration efforts above a threshold — a proxy for the mechanical, change-of-pace load that distance alone misses. ClavaMetrics' combined **A+D** metric is simply **accelerations + decelerations** summed, available as an [ACWR](glossary#acwr) base metric. As with speed zones, the effort thresholds come from the GPS provider/club configuration.

## Availability status

Each player carries a daily availability status on the [Availability](/support/availability) matrix. The set is: **available** (full), **partial / limited** (modified training), **injured / unavailable** (out), **sick** (illness), **away** (national-team duty), and **absent** (match context, zero minutes). Available and partial count toward the trainable squad; injured, sick and away count as out. Statuses are set manually and auto-filled from active injuries without overwriting manual entries.

## Planned load vs actual load

**Planned load** is what you *intend*: in planning views ClavaMetrics computes it as the **estimated RPE × duration** you set on a session (the same [s-RPE](glossary#s-rpe) formula, but using the staff's *estimated* RPE). **Actual load** is what was *delivered*: the players' reported session-RPE after training, and the external GPS load.

Note on "pending RPE": in the planning/calendar context, "pending RPE" means a session that still has **no estimated RPE** set (so its planned load can't be computed) — it does **not** mean players haven't reported. Player-reported RPE is tracked separately on the [RPE](/support/rpe) page.

## References

All references below were checked against PubMed / the journal of record; the exact citation is given. Where a work is contested or methodological, that's noted in the relevant term above.

1. Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? *British Journal of Sports Medicine.* 2016;50(5):273–280. [doi:10.1136/bjsports-2015-095788](https://doi.org/10.1136/bjsports-2015-095788) — origin of the ACWR "sweet spot" narrative.
2. Williams S, West S, Cross MJ, Stokes KA. Better way to determine the acute:chronic workload ratio? *British Journal of Sports Medicine.* 2017;51(3):209–210. [doi:10.1136/bjsports-2016-096589](https://doi.org/10.1136/bjsports-2016-096589) — proposes the EWMA approach over the rolling average.
3. Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. *British Journal of Sports Medicine.* 2019;53(15):921–922. [doi:10.1136/bjsports-2017-098110](https://doi.org/10.1136/bjsports-2017-098110) — the case for uncoupled windows.
4. Windt J, Gabbett TJ. Is it all for naught? What does mathematical coupling mean for acute:chronic workload ratios? *British Journal of Sports Medicine.* 2019;53(16):988–990. [doi:10.1136/bjsports-2017-098925](https://doi.org/10.1136/bjsports-2017-098925).
5. Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. *International Journal of Sports Physiology and Performance.* 2020;15(6):907–913. [doi:10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864) — central methodological critique.
6. Impellizzeri FM, McCall A, Ward P, Bornn L, Coutts AJ. Training Load and Its Role in Injury Prevention, Part 2: Conceptual and Methodologic Pitfalls. *Journal of Athletic Training.* 2020;55(9):893–901. [doi:10.4085/1062-6050-501-19](https://doi.org/10.4085/1062-6050-501-19).
7. Carbone L, Sampietro M, Cicognini A, et al. Is the Relationship between Acute and Chronic Workload a Valid Predictive Injury Tool? A Bayesian Analysis. *Journal of Clinical Medicine.* 2022;11(19):5945. [doi:10.3390/jcm11195945](https://doi.org/10.3390/jcm11195945) — finds ACWR no better than chance at predicting injury.
8. Qin W, Li R, Chen L. Acute to chronic workload ratio (ACWR) for predicting sports injury risk: a systematic review and meta-analysis. *BMC Sports Science, Medicine and Rehabilitation.* 2025;17(1):285. [doi:10.1186/s13102-025-01332-x](https://doi.org/10.1186/s13102-025-01332-x) — most recent review; cautions on heterogeneity and inconsistent replication.
9. Soligard T, Schwellnus M, Alonso J-M, et al. How much is too much? (Part 1) International Olympic Committee consensus statement on load in sport and risk of injury. *British Journal of Sports Medicine.* 2016;50(17):1030–1041. [doi:10.1136/bjsports-2016-096581](https://doi.org/10.1136/bjsports-2016-096581) — the load-management consensus the later critiques push back against.
10. Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. *Journal of Strength and Conditioning Research.* 2001;15(1):109–115. PMID: 11708692 — foundational session-RPE paper (s-RPE = RPE × duration; no DOI, cite by PMID).
11. Foster C. Monitoring training in athletes with reference to overtraining syndrome. *Medicine & Science in Sports & Exercise.* 1998;30(7):1164–1168. [doi:10.1097/00005768-199807000-00023](https://doi.org/10.1097/00005768-199807000-00023) — monotony and strain.
12. Martín-García A, Gómez Díaz A, Bradley PS, Morera F, Casamichana D. Quantification of a Professional Football Team's External Load Using a Microcycle Structure. *Journal of Strength and Conditioning Research.* 2018;32(12):3511–3518. [doi:10.1519/JSC.0000000000002816](https://doi.org/10.1519/JSC.0000000000002816) — an empirical operationalization of the structured-microcycle approach.

> TODO — bibliographic gaps to review: (1) **Seirul·lo's "Microciclo Estructurado"** has **no peer-reviewed primary source** we could verify; reference 12 (Martín-García et al. 2018) is used as a citable proxy, and the methodology itself is documented in Spanish-language books (cite as a book, not a paper). (2) The **morphocycle / Tactical Periodization** (Frade), **ATR** (Issurin) and **Verheijen** methodologies are named in the app but are **not backed here by a verified peer-reviewed primary citation** — they're described as methodologies only. Confirm preferred sources before adding citations for them.

## Related

- [Load Monitor](/support/load-monitor) — ACWR in practice at squad level.
- [GPS Analysis](/support/gps-analysis) — the external-load metrics defined here.
- [RPE](/support/rpe) — s-RPE collection.
- [Annual Planner](/support/annual-planner) — the periodization models.
