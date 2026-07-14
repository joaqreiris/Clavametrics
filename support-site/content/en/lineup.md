---
title: Lineup
slug: lineup
world: squad
app_page: Lineup.html
order: 4
summary: The lineup builder — pick a formation, place the starting XI and bench for a match, and produce a shareable lineup poster.
---

## What it is

The Lineup builder is where you compose a match's **starting XI, bench and formation** and turn it into a shareable, poster-style graphic.

## When you use it

Before a match — you reach it from the [Calendar](/support/calendar) match (or the [Squad](/support/squad)), build the lineup for that fixture, and publish or export the poster.

## How it works

**Pick a formation.** Choose from the available formations (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 3-4-3); each lays out the eleven positions on the pitch.

**Fill the slots.** In the composer, tabs cover the **XI**, the **subs** and the **staff**. Click a slot to open a player picker (search by surname, number or position) and assign a player; mark the captain. Players already placed aren't offered again. Selections save as you go.

**Style the poster.** The live poster preview offers several visual styles, color pickers, a numbers/initials toggle, a captain-badge toggle, and a language switch. The header shows your crest versus the opponent, the match details and a countdown.

**Publish and export.** From Share you can mark the lineup **official** ("Send to #match-day"), **download a PNG**, or **copy a link** to it. You can also print it.

## Key concepts

**Tied to the match.** A lineup belongs to a specific match on the calendar — **one lineup per match**. Opening the builder finds the upcoming match and loads (or creates) that match's lineup, so the XI you build is bound to that fixture. Starters and substitutes are stored with their slot and captain flag.

**Publishing.** A lineup has a status — draft, then **official** when you publish (which stamps who published it and when). Publishing is offered as "Send to #match-day", alongside a PNG download and a copy-link. Exactly how a published lineup reaches players (a chat channel and/or a viewable link) wasn't fully confirmed from the code — see the TODO.

## FAQ

**Is a lineup saved per match?** Yes — one lineup per match fixture; the builder loads that match's lineup when you open it.

**How do I set the captain?** Mark the player as captain in the composer; the poster shows the captain badge.

**How do I share the lineup?** Publish it as official, download the PNG, or copy its link — from the Share dialog.

**Can I export it as an image?** Yes — Download PNG renders the poster to an image; you can also print it.

> TODO — could not confirm from the code, please verify: (1) whether **"Send to #match-day"** actually posts to a chat channel and whether the **copy-link** (`?lineup=…`) is viewable by **players** — no public/player-facing view was confirmed. (2) When the **"locked"** status is used (versus draft/official). (3) The **Templates** and **Reset** buttons are present but their handlers weren't found — confirm they work.

## Related

- [Calendar](/support/calendar) — the match a lineup is built for.
- [Squad](/support/squad) — the players the lineup is filled from.
- [Match Reports](/support/match-reports) — the post-match record for the same fixture.
