---
title: Squad
slug: squad
world: squad
app_page: Squad.html
order: 1
summary: The roster hub for a team or category — players grouped by position, with profiles, bulk actions, CSV import/export and a lineup builder.
---

## What it is

Squad is the roster hub for a team or category: every player, grouped by position, with their key details, profile links, and the tools to add, edit, import, organize and build lineups from them.

## When you use it

Use it to set up and maintain the roster — add or import players, keep positions and details current, move players between categories — and to prepare for a match with the lineup builder. From here you open any player's full profile or dossier.

## How it works

**Find players.** Search by name, dorsal number or nationality; narrow by position with the pills — **All, GK, CB, FB, MF, WG, ST** (each with a live count) — and scope to one category with the team selector. In the list you can sort by player, age or joined date.

**Switch views.** Four views present the same roster differently:

- **List** — a sortable table: number, player (photo, name, date of birth), position, age, foot, height/weight, role (team) and an actions menu. Rows are grouped by position.
- **Cards** — a photo grid with jersey number, name, position, age and foot.
- **Depth chart** — players stacked under their position group.
- **Lineup** — a pitch with a formation picker (4-3-3, 4-4-2, 4-2-3-1, 3-5-2 and more), a match selector and rival crest, that you can save, export and print.

**Manage a player.** Add a player with **Add Player**, or open a player's menu to **Edit** (photo, name, dorsal, primary and secondary positions, date of birth, nationality, height, weight, dominant foot, team memberships), **View profile** (opens the player page) or **Export dossier** (opens the printable dossier).

**Work in bulk.** Select players with their checkboxes to reveal bulk actions: **Archive** (soft-hide, reversible), **Export** (CSV of the selection), **Move to team** — with two modes, *Add to team* (keep existing memberships) or *Move here* (replace them) — and **Change position/status** across the selection.

**Import / export.** **Import CSV** previews rows before creating players (columns: first name, last name, number, position, date of birth, nationality, height, weight, dominant foot, with position aliases normalized). **Export CSV** downloads the roster (or the current selection).

## Key concepts

**Positions and groups.** The app normalizes many position codes (and Spanish aliases like PORTERO, DEFENSA, EXTREMO, DELANTERO) into canonical codes and groups them for display and filtering:

| Group | Filter pill | Example codes |
| --- | --- | --- |
| Goalkeepers | GK | GK |
| Defenders | CB / FB | CB, LB, RB, WB, LWB, RWB |
| Midfielders | MF | CDM, CM, CAM, DM, AM |
| Wingers | WG | LM, RM, LW, RW |
| Forwards | ST | SS, CF, ST, "9" |

A player has a **primary** position (used for grouping and the colored badge) and optional **secondary** positions ("also plays").

**Team / category membership.** A player belongs to a **primary team** (shown in the Role column) and can hold additional memberships — so one athlete can appear in, say, both the U-23 and the first team. The *Move to team* modes decide whether a change adds a membership or replaces all of them.

**Player status.** At squad level a player carries a status — available, injured, modified or unavailable. Day-to-day fitness-to-train is managed in [Availability](/support/availability); the squad-level status is the roster-level flag.

**Archiving.** Removing a player archives them (soft-delete) rather than deleting — they drop out of the normal views but can be restored from the archived filter.

## FAQ

**How do I add a whole roster at once?** Use Import CSV — it previews the parsed rows (name, number, position, date of birth, nationality, height, weight, foot) before creating the players, and normalizes position aliases.

**Can a player be in two categories?** Yes. Players support multiple team memberships with one marked primary; use *Move to team → Add to team* to add a category without removing the others.

**What's the difference between archiving and deleting?** Archiving hides the player but is reversible; there is no hard delete in the normal flow — archived players can be restored.

**Where do I see a player's full history?** Open **View profile** for the player page, or **Export dossier** for the printable summary.

## Related

- [Availability](/support/availability) — day-by-day fitness-to-train for these players.
- [Load Monitor](/support/load-monitor) — squad-wide ACWR built from the same roster.
- [Calendar](/support/calendar) — matches the lineup builder prepares for.
