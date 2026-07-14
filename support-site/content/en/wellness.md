---
title: Wellness
slug: wellness
world: performance
app_page: Wellness.html
order: 4
summary: The morning wellness check-in monitor — sleep, fatigue, stress and soreness on a 1–7 Hooper scale, plus pain flags, read alongside training load.
---

## What it is

The Wellness page collects and reviews players' daily subjective check-ins — sleep, fatigue, stress and soreness (the Hooper items) plus mood and any sore areas — and flags who is at risk before training.

## When you use it

In the morning, before training: players submit their check-in, and staff read the squad to spot who slept badly, who's carrying fatigue or soreness, and who reported pain — then adjust the session accordingly. It's read together with the day's load, never on its own.

## How it works

**Pick the squad.** A team selector scopes the check-ins to one category (or the whole club for admins). The page auto-refreshes so submissions appear as they come in.

**Work the two tabs.** **Responded** shows players who submitted, sorted worst-first by Hooper Index; **Pending** shows who's still missing, with a **Remind missing** action over WhatsApp. Each player renders as a **Numeric** card (the score plus each item) or a **Gauge** (a dial from good to at-risk).

**Read the summary.** Top figures show how many players are flagged, how many reported pain (a sore area), and how many are still missing.

**Collect from players.** Generate a **tokenized share link** (team-scoped, no login) that players open to submit; or **Remind missing** to nudge the pending ones. You can also message a player directly.

## Key concepts

**The items and scale.** Players rate four Hooper items and mood, each on a **1–7** scale:

| Item | 1 means | 7 means |
| --- | --- | --- |
| Sleep quality | very good | very bad |
| Fatigue | none | extreme |
| Stress | very low | very high |
| Soreness | none | severe |
| Mood (tracked separately) | low | great |

For the four Hooper items, **higher is worse**. Mood is shown but not added into the Hooper score.

**The Hooper Index.** The overall score is the sum of the four Hooper items — **sleep + fatigue + stress + soreness** — ranging **4 to 28**, where **higher means more at-risk**. The card colors by band: **under 12 green** (Good), **12–17 amber** (Watch), **18 and above red** (Alert). Each item also shows its own mini-band (1–3 ok, 4 watch, 5–7 bad). Older check-ins that predate the Hooper scale fall back to a 1–10 readiness value (there, higher is better).

**Pain flags.** A check-in can flag sore body areas (hamstring, quads, calves, groin, knee, ankle, shoulder, back) plus a free note. Reporting an area raises an alert to the medical/coaching staff — separate from the Hooper score (pain isn't summed into it).

**Why it's read with load, never alone.** Subjective wellness is an early-warning input, not a verdict. A high Hooper score on its own means little; a high Hooper score **on top of high training load** is the combination that flags elevated risk. That's why you read it next to the day's s-RPE (see [RPE](/support/rpe)) and the acute:chronic ratio (see [Load Monitor](/support/load-monitor)) rather than in isolation.

## FAQ

**What scale do players use?** 1–7 for each item. For the four Hooper items, 1 is good and 7 is bad; mood is 1 (low) to 7 (great) and is tracked separately.

**How is the overall score calculated?** Hooper Index = sleep + fatigue + stress + soreness (range 4–28). Higher is worse — under 12 is green, 12–17 amber, 18+ red.

**How do players submit?** Through a tokenized link you share (no login). Staff review the results here; a reported sore area alerts the medical staff.

**Does a bad wellness score mean pull the player?** Not by itself — read it alongside the player's load and the medical picture. It's a flag to look closer, not an instruction.

> TODO — could not confirm from the code, please verify: (1) there's no visible path for **staff to submit on a player's behalf** (submission is player-side via the link). (2) A **7-day history** view appears as "coming soon". (3) No **export** was found on this page. (4) An **acknowledge** action for wellness flags exists in the backend but doesn't appear wired into this page's UI.

## Related

- [Load Monitor](/support/load-monitor) — read wellness alongside the acute:chronic load.
- [RPE](/support/rpe) — the internal-load half of the picture, same day.
- [Availability](/support/availability) — where a sore/ill player's status is set.
