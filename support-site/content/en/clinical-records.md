---
title: Clinical Records
slug: clinical-records
world: medical
app_page: Clinical Records.html
order: 2
summary: The squad-level medical index — each player's status, active issue, availability and last review at a glance, linking into their individual clinical record.
---

## What it is

Clinical Records is the squad-level index into players' clinical files: a roster showing each player's medical status, active issue, availability and last review date, from which you open any player's full [Clinical Record](/support/clinical-record).

## When you use it

For a whole-squad medical read — who's fit, modified, injured or unavailable, who's overdue a review — and as the jumping-off point into a player's detailed record.

## How it works

**Read the roster.** Each row shows the player, position, a **status** badge (Fit, Modified, Injured, Unavailable), their **active issue** (the current injury's headline), days out, an **availability** percentage for the season, the **last review** date, and an injury **burden** bar.

**Use the KPIs and filters.** A KPI header counts fit / modified / injured / unavailable / overdue players and squad availability; the cards double as filters. A status filter and a **search** (by player name or active issue) narrow the list.

**Open a record.** Click any row to open that player's individual [Clinical Record](/support/clinical-record).

## Key concepts

**Index vs individual record.** This page is the **overview** — one row per player with headline status. The deep, per-module clinical file lives in the individual [Clinical Record](/support/clinical-record). The index links into it; it isn't the file itself.

**Access.** Reaching this page requires the clinical module (the page redirects users without it), and the medical fields it shows are enforced by the database's medical-access rule — the same one that restricts the [Clinical Record](/support/clinical-record) (super-admin, or role admin / owner / physio). Note the review-date field comes from the medical profile, which is medical-only at the database level.

## FAQ

**What does the "active issue" column show?** The headline of the player's current active injury (its type/classification and body area) — not the full clinical detail, which is inside the individual record.

**How do I find players with a given problem?** Use the search — it matches player names and the active-issue text.

**How do I open a player's full file?** Click their row to open their individual [Clinical Record](/support/clinical-record).

## Related

- [Clinical Record](/support/clinical-record) — the individual player file this index opens.
- [Injuries](/support/injuries) — the injuries behind the status and active-issue columns.
- [Availability](/support/availability) — the availability the percentage column summarizes.
