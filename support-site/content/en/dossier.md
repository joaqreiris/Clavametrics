---
title: Dossier
slug: dossier
world: squad
app_page: Dossier.html
order: 5
summary: The configurable player-dossier generator — toggle blocks, pick which tests appear, benchmark against the squad, save templates, and export a branded PDF.
---

## What it is

The Dossier is a configurable per-player report generator: you choose which blocks and tests appear, it benchmarks the player against the squad, and it renders a branded one-page dossier you can print or export to PDF.

## When you use it

When you need a shareable snapshot of a player — for a review, a scouting note, or a printed profile. You reach it from the [Squad](/support/squad) or [Player Profile](/support/player) via "Export dossier".

## How it works

**Pick the player and configure.** Open a player's dossier and turn blocks on or off, choose which tests to show, and pick which metrics to trend. The preview re-renders live as you change the configuration.

**Export.** Print or **Export PDF** produces the branded sheet (club crest, player identity, KPIs and the enabled blocks). The dossier can render in English, Spanish or Portuguese.

## Key concepts

**Configurable blocks.** The dossier is built from toggleable blocks: **Technical** (a radar of subjective /10 attributes), **Athletic** (percentile bars for the selected tests), **Production** (season goals, assists, ratings), **Scouting** (an editable free-text summary), and **Evolution** (trend sparklines for the metrics you pick). Each block can be shown or hidden.

**Selectable tests.** In the Athletic block you choose exactly which physical tests appear, from a catalog grouped as Jumps & power (CMJ, squat jump, drop jump, broad jump), Speed & agility (sprint, 505 change-of-direction, Illinois) and Endurance (30-15 IFT, Yo-Yo IR1, Cooper). Each shows the player's latest value and, when possible, a percentile.

**Percentiles vs the squad cohort.** A test's percentile is computed against the player's **team cohort** — the other players on the same team with a value for that test. It requires **at least four peers** to be shown; below that the bar falls back to a neutral fill rather than a percentile, because a percentile off fewer than four peers isn't meaningful. This is the same cohort/min-peers rule the [Evaluations](/support/evaluations) module uses.

**Saved templates.** A dossier configuration — which blocks, which tests, which trends — can be **saved as a template** (club-wide) and reloaded, so you can keep, say, a "Physical dossier" and a "Scouting dossier" preset and apply either in one click.

**The scouting summary.** The scouting block is free text you edit inline; it prints with whatever you write and is only stored to the player when you explicitly save it.

## FAQ

**Can I choose what goes in the dossier?** Yes — toggle the blocks, pick which tests appear in the Athletic block, and choose the trend metrics. The preview updates live.

**Why does a test show a plain bar instead of a percentile?** Because the team cohort has fewer than four peers with that test — not enough to compute a valid percentile.

**Can I reuse a configuration?** Yes — save it as a template and apply it to any player.

**How do I export it?** Print or Export PDF; the output is a branded one-page sheet.

## Related

- [Player Profile](/support/player) — the on-screen aggregator this dossier prints from.
- [Evaluations](/support/evaluations) — the tests and the same cohort/min-peers benchmarking.
- [Squad](/support/squad) — where you open a player's dossier.
