---
title: Exercises Library
slug: exercises-library
world: planning
app_page: Exercises Library.html
order: 4
summary: The catalog of field drills the club has designed — searchable and filterable by orientation, intensity, match day, game type and focus, and reusable in sessions.
---

## What it is

The Exercises Library is the catalog of field drills the club has built in the [Drill Designer](/support/drill-designer). You browse, search and filter them by their training tags, preview their diagram and demands, and reuse them when planning sessions.

## When you use it

Whenever you're planning training: find an existing drill by its orientation, intensity, match-day fit or focus, check its dimensions and demands, then open it in the Drill Designer or add it to a session in [Daily Planning](/support/daily-planning). It's also where GPS "period" data gets mapped to drills so each drill builds a performance profile.

## How it works

**Search and filter.** Search by name, use the quick orientation pills (All / Activation / Strength / Velocity / Endurance), and open the sidebar filters — **Orientation, Intensity, Match Day, Game type, Focus,** and **Team** — which multi-select and show a count per value. **Sort** cycles Recent → A→Z → Longest.

**Browse.** Switch between **Grid** and **List**. Each card shows the drill's diagram, a focus badge (ACT/STR/VEL/END), its duration and match-day badge, and an "Imported" badge for image-sourced drills.

**Preview a drill.** Click a card to open a preview panel with the full detail — players, field width × height, m² per player, duration, match day, series and work/rest, intensity, orientation, game type and focus tags — and **Open in Planner** to view or edit the design in the [Drill Designer](/support/drill-designer).

**Map GPS to drills (admin).** A "Map drills (GPS)" wizard lets an admin match GPS **period names** (e.g. from Catapult) to library drills, so the system aggregates each drill's GPS profile — average distance, distance per minute and player load per minute — from the sessions where it was run.

## Key concepts

**The taxonomy.** Drills are tagged and filtered along these dimensions:

| Dimension | Values |
| --- | --- |
| Orientation | Activation, Strength, Velocity, Endurance |
| Intensity | Low, Medium, High, Very high |
| Match Day | MD-5 … MD … MD+3 |
| Game type | Small-sided (SSG), Medium-sided (MSG), Large-sided (LSG), or none |
| Focus | Tactical, Individual, Physical, Sectorial |
| Team | which categories the drill is visible to |

**Orientation and density (m²/player).** A drill's orientation reflects the **space per player** — the pitch area divided by the number of players. When it isn't set explicitly it's derived from that density: under 40 m²/player → **Activation**, 40–80 → **Strength**, 80–160 → **Velocity**, 160 and above → **Endurance**. More space per player generally means more running and higher speeds; less space means more contacts and technical/activation work. This is the same density logic the [Drill Designer](/support/drill-designer) and the GPS projection in [Daily Planning](/support/daily-planning) use.

**Game format.** Format captures the shape of the game — the player count, the small/medium/large-sided classification, and the field dimensions — which together with density define how demanding the drill is.

**Match-day fit.** The match-day tag says where in the week a drill fits — closer to MD for sharper, lower-volume work; further out for higher-volume days; MD+1/+2 for recovery. It lets you assemble a week that respects the morphocycle.

**GPS profile.** A drill has no GPS numbers of its own until its runs are linked: once an admin maps the GPS period names to a drill, the app derives that drill's typical external load from the actual sessions — and that profile is what powers the projected GPS load when the drill is used in Daily Planning.

## FAQ

**Where do the drills come from?** They're designed in the [Drill Designer](/support/drill-designer); this library is the catalog of what's been built, club-wide, with per-team visibility.

**Why does a drill's orientation look automatic?** If it isn't set explicitly, it's computed from the density (m² per player): <40 Activation, 40–80 Strength, 80–160 Velocity, ≥160 Endurance.

**How do drills get GPS numbers?** An admin maps GPS period names to the drill in the "Map drills (GPS)" wizard; the app then aggregates that drill's profile from the sessions where it ran.

**Can I restrict a drill to one category?** Yes — the Team dimension controls which categories a drill is visible to; leaving it empty shows it to all.

## Related

- [Drill Designer](/support/drill-designer) — where these drills are designed and edited.
- [Daily Planning](/support/daily-planning) — add library drills to a session; their GPS profile feeds the projection.
