---
title: Evaluations
slug: evaluations
world: performance
app_page: Evaluations.html
order: 5
summary: The physical-testing module — record jumps, sprints, endurance, strength and force-plate tests, benchmark against the squad, and track each player's evolution.
---

## What it is

Evaluations is the physical- and performance-testing module: you record measured tests (jumps, sprints, endurance, strength, force-plate metrics) and subjective field assessments (technical, tactical, mental), benchmark players against the squad, and track how each one evolves over time.

## When you use it

Whenever you test: after a jump/sprint/endurance session, when importing force-plate exports, when computing a guided test (30-15 IFT, VBT, F-V profile, body composition), or when rating players on the pitch. Then you review results — a player's trend, or the squad ranking on a metric — and the results feed the [Player Profile](/support/player) and the load groups in the [Gym Planner](/support/gym-planner).

## How it works

**Choose the branch.** A top segment splits **Measured** (objective tests with numeric results) from **Field assessment** (subjective ratings on technical/tactical/mental dimensions, 1–10).

**Browse the test catalog.** Measured tests are grouped into categories — Jumps & power, Speed & agility, Endurance / VO₂max, Strength / VBT, Mobility & screening, and Anthropometrics — each holding several tests (CMJ, sprint splits, 30-15 IFT, Nordic hamstring, FMS, body composition, and more). Pick a test to open its results.

**View results.** For a test you can see the **Team** view (the squad's values, ranked and classified against the team average) or the **Individual** view for one player — their latest value, their personal average, a trend chart across dates, and a table of recent results with the delta versus the previous test (and left/right asymmetry where the test is bilateral).

**Upload results.** Enter data by hand — a single player, or a whole-roster **bulk** grid for a date — or **import a CSV** (a player+value list for evaluations, or a device export such as force-plate CSV for force tests). Some tests open a **calculator** that takes guided inputs and computes the result for you (e.g. 30-15 IFT, VBT load–velocity, F-V profile, FMS, skinfold body composition, 1RM).

## Key concepts

**Evaluations vs force tests.** The module stores two different shapes of data:

- An **evaluation** is a **single value** per test instance — one player, one test type, one date, one result (with its unit and optional note). Broad jump 2.15 m, a sprint split, a Yo-Yo distance.
- A **force test** is **multi-metric** — one force-plate session that produces many metrics at once (jump height, peak power, RSI, left/right asymmetry, …), stored as a parent test with its child metrics.

So a jump entered by hand is one evaluation value; the same jump captured on a force plate is a force test carrying a whole set of metrics, including limb symmetry.

**Percentiles and the squad cohort.** A player's result is benchmarked against the **team cohort** — the other players' values for that same test/metric — not a club-wide or external norm. Crucially, a percentile is only shown when the cohort has **at least four peers** with a value; below that the page says there aren't enough peers to compare. This keeps a "percentile" from being computed off one or two data points, where it would be meaningless. Within the team view, each result is also classified simply as at/above average, below, or well below.

**Evolution over time.** For each test the module tracks a player's history: the latest value against their **personal average**, the percentage change, and a chart across all test dates. It surfaces recent change rather than a single snapshot — so you read a test as a trajectory, not a one-off number.

**Field assessment.** Separate from the measured tests, the field-assessment branch rates players on technical, tactical and mental dimensions on a 1–10 scale, averaged into an overall picture — a subjective complement to the objective numbers.

## FAQ

**What's the difference between an evaluation and a force test?** An evaluation is one value per test (one player, one date, one result). A force test is a force-plate session that records many metrics at once, including left/right asymmetry.

**Why don't I see a percentile for a player?** Because fewer than four teammates have a value for that test — below that minimum the comparison isn't shown, since a percentile off so few peers wouldn't be reliable.

**Is the percentile against other clubs?** No — it's against the player's own team cohort.

**How do I get data in?** Enter it by hand (single or bulk roster grid), import a CSV, or use a test's built-in calculator for guided tests (30-15 IFT, VBT, F-V profile, FMS, body composition, 1RM).

**Where do test results show up elsewhere?** On the [Player Profile](/support/player) (latest snapshot and evolution) and as the basis for the [Gym Planner](/support/gym-planner)'s load groups.

## Related

- [Player Profile](/support/player) — where a player's tests appear as a snapshot and evolution.
- [Gym Planner](/support/gym-planner) — load groups are built from strength-test results.
- [Squad](/support/squad) — the roster and team cohort the benchmarks use.
