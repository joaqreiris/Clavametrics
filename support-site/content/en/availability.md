---
title: Availability
slug: availability
world: squad
app_page: Availability.html
order: 2
summary: A players-by-day matrix of who can train — available, partial, injured, ill or away — feeding the squad-health counts the rest of the platform reads.
---

## What it is

Availability is a **players × days matrix** that tracks each squad member's status — available, partial, injured, ill or away — for every day in a date range. It's the single place that answers "who can train today?" and feeds the squad-health counts (e.g. "22 available, 3 partial, 2 out") shown elsewhere.

## When you use it

Update it as part of the daily routine — before each session or match — so the squad picture is current: mark who trains fully, who is on modified work, who is out injured or ill, and who is away on national-team duty. After a match you can log minutes played; across the week the Stats view shows availability trends.

## How it works

**Choose a view.** A segmented control switches between **Matrix** (the default players × days grid), **Today**, and **Stats** (a trend line, calendar heatmap, player ranking and a team breakdown).

**Set the date window.** The range defaults to the active microcycle (or the current Monday–Sunday) and can be changed with presets — Current MC, Last 7 / 14 / 30 days, or a custom range — and stepped forward/back. Each column shows its **MD-** label (e.g. MD-2, Match, Off); today is highlighted, match days are marked in red, and planned days off are striped and read-only.

**Filter the rows.** Position pills — **All, GK, CB, FB, MF, WG, ST** — narrow the matrix to a position group, each showing its count.

**Edit statuses.** Select one or many cells — click, drag to select a range, or Cmd/Ctrl+A to select all editable cells — and a bulk-edit bar appears. Set the selection to **Available, Partial, Injury, Illness** or **Nat. team**, use **Match · 90′** to record a full match, or **Clear** to remove the records. Future dates, days off and non-counting phases are locked. Changes save immediately and update live for everyone via realtime sync.

**Export.** The matrix can be exported to CSV.

## Key concepts

**The status set.** Availability uses a fixed set of statuses, each with its own color:

| Status | Label | Color | Meaning |
| --- | --- | --- | --- |
| available | Available | green | Fully available — full training/match capacity. |
| partial / limited | Partial / adapted | amber | Available but on modified work (reduced intensity, some drills or actions restricted). |
| injured / unavailable | Injury | red | Cannot participate due to an active injury. |
| sick | Illness | violet | Unavailable due to illness. |
| away | Nat. team | blue | Away on international / national-team duty. |
| absent | Absent | gray | Used in match records — present but zero minutes played. |

A match cell can also carry **minutes played** (e.g. "90′"), stored as available with a minutes value.

**Where the status comes from.** Manual staff entry is the source of truth, but two automatic fills seed it without ever overwriting a manual entry:

- **From Injuries** — players with an active injury are auto-filled as **injured** across the injury's date range (the Injuries module is where injuries are logged).
- **Today's default** — any player with no record for today defaults to **available** (or **injured** if they have an active injury).

So the priority is: manual entry first, then the injury auto-fill, then today's default.

**Availability vs injury vs load.** Availability is a *daily fitness-to-train* decision. An **injury** is the underlying medical condition with an onset and expected return — availability is effectively the day-by-day projection of that. **Load** and **wellness** (see [Load Monitor](/support/load-monitor) and RPE/Wellness) are readiness inputs that inform the decision but are tracked separately.

**Partial / adapted.** "Partial" means the player trains but on a modified program — lighter intensity or specific restrictions. They still count toward the trainable squad, which is why the squad summary distinguishes "available" from "partial" from "out".

**Countable days.** Squad-health KPIs only apply to countable days — a day with a planned session or match, not a day off, and inside an active season phase. On a non-counting day the KPI strip is replaced by an empty state.

## FAQ

**Do I have to set every player every day?** No. Players default to available for today, and active injuries auto-fill as injured across their range. You mainly override the exceptions — partial, ill, away — and those manual entries are never overwritten by the auto-fills.

**What's the difference between "partial" and "injured"?** Partial means available on modified training (counts toward the trainable squad); injured means out. They're amber and red respectively.

**How do the "22 available / 3 partial / 2 out" counts elsewhere get their numbers?** From these statuses on the given day — available and partial count as trainable; injured, ill and away count as out.

**Can two staff edit at once?** Yes — updates broadcast live, so everyone sees changes without refreshing.

> TODO — could not fully confirm from the code, please verify: (1) the **Today** view is present but appears marked "coming soon". (2) The toolbar **Filters** and **Group by** buttons look like placeholders without active handlers. (3) Single-key shortcuts (A / P / I) are shown in the legend but may not be fully wired. (4) The **Absent** status only appears in the match-minutes context (0 minutes) — its broader use (e.g. did-not-play) isn't clear.

## Related

- [Squad](/support/squad) — the roster that populates the matrix rows.
- [Calendar](/support/calendar) — match days and days off shown in the header.
- [Daily Planning](/support/daily-planning) — the same statuses drive the session's squad card.
