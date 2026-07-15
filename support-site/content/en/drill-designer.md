---
title: Drill Designer
slug: drill-designer
world: planning
app_page: Planner.html
order: 5
summary: The pitch editor for building a drill — place players and objects, draw movements and zones, set the format and tags, and save it to the Exercises Library.
---

## What it is

The Drill Designer is the pitch editor where you build a training drill: draw the setup on a football field — players, objects, movements and zones — set its format, dimensions and tags, and save it to the [Exercises Library](/support/exercises-library) for reuse.

## When you use it

When you create a new drill or edit an existing one. You reach it from the Exercises Library ("New exercise", or "Open in Planner" on a drill) and, once saved, the drill becomes available to add to sessions in [Daily Planning](/support/daily-planning).

## How it works

**Draw the drill.** On the pitch canvas you place and arrange:

- **Players** for up to four teams (auto-numbered, each team its own color), and **objects** — ball, cones, poles, barriers, goals, goal posts, mannequins, or your own uploaded object.
- **Movements** — arrows that can be straight or curved, solid or dashed.
- **Zones** — rectangles, circles, triangles, diamonds, polygons and free shapes, with fill color and opacity.
- **Text labels** and team **crests**.

Canvas tools include select, move/pan, freehand draw, lasso select, undo/redo and zoom/fit; you can pick the field variant (full, half, blank) and rotate its orientation. As an alternative to drawing, you can build an **image-based** drill by uploading a picture.

**Configure the drill.** Fill in the name (which auto-parses a format like "5v5+2" and the field size), an objective and description, visibility by category, and the training parameters: **series**, **work time** and **rest time** (which auto-compute the **duration**), **match day**, **intensity**, **focus**, **game type**, **physical orientation**, **players**, and field **width × height**.

**Check space and orientation.** The editor shows the **m² per player** and an **orientation** badge derived from it, with reference tiles for the thresholds — so you can see at a glance whether the format lands in Activation, Strength, Velocity or Endurance territory.

**See the GPS profile.** If the drill has been mapped to GPS data, a read-only panel shows its typical external load (per session and per minute).

**Save and share.** Save writes the drill to the library (with an auto-generated preview image); you can also print a sheet or share the drill as a PNG.

## Key concepts

**The tag dimensions.** A drill is tagged along four dimensions, plus its match-day fit and visibility:

| Dimension | Values |
| --- | --- |
| Physical orientation | Activation, Strength, Velocity, Endurance |
| Intensity | Low, Medium, High, Very high |
| Focus (multi-select) | Tactical, Individual, Physical, Sectorial |
| Game type | Small-sided (SSG), Medium-sided (MSG), Large-sided (LSG) |

These are the same tags you later filter on in the [Exercises Library](/support/exercises-library).

**Game format and density (m²/player).** The **format** is the player count and the small/medium/large-sided shape; the **density** is the space per player — field area ÷ players. Density drives the **orientation**: under 40 m²/player → **Activation**, 40–80 → **Strength**, 80–160 → **Velocity**, 160 and above → **Endurance**. More space per player means more running and higher speeds; less space means more contacts and technical work. You can let orientation follow the density or set it manually.

**Duration and work time.** Duration is computed from **series × (work + rest)**. Separately, the **work** portion (series × work time) is the time players are actually active — and that's what feeds the projected GPS load when the drill is used in [Daily Planning](/support/daily-planning).

**Canvas vs image drills.** A drill can be **canvas**-based (drawn on the pitch, fully editable) or **image**-based (an uploaded picture with the same tags and parameters) — useful for importing existing diagrams.

## FAQ

**Do I have to draw everything by hand?** No — you can upload an image-based drill and still tag it and set its parameters. Canvas drills are the fully editable, diagram-drawn ones.

**How is the orientation decided?** From the density (m² per player): <40 Activation, 40–80 Strength, 80–160 Velocity, ≥160 Endurance. You can override it manually.

**How is duration calculated?** Series × (work time + rest time). It's read-only — set the series and the work/rest times and it follows.

**Where does the drill go after I save it?** Into the [Exercises Library](/support/exercises-library), from where it can be reused in sessions and mapped to GPS data.

## Related

- [Exercises Library](/support/exercises-library) — where saved drills are catalogued and filtered.
- [Daily Planning](/support/daily-planning) — add a drill to a session; its work time feeds the GPS projection.
