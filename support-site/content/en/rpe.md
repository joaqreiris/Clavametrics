---
title: RPE
slug: rpe
world: performance
app_page: RPE.html
order: 3
summary: The session-RPE monitor — collect each player's perceived exertion after a session, turn it into s-RPE load (RPE × minutes), and feed the ACWR.
---

## What it is

The RPE page is the session-RPE monitor: it collects each player's **rate of perceived exertion** after a session, computes the session load (**[s-RPE](glossary#s-rpe) = RPE × duration**), and shows who has responded, who's missing, and how hard the squad found the session.

## When you use it

Right after a session. Players submit their RPE from a phone (no login needed) while it's fresh; staff watch the responses come in, chase the ones still missing, and review the squad's internal load. Those s-RPE values are what the [Load Monitor](/support/load-monitor) turns into [ACWR](glossary#acwr).

## How it works

**Pick the session.** Choose a session from the selector (it defaults to today's session when there's exactly one). If there's no session today it says so; if there are several, you pick which one.

**Read the summary.** Four figures sit at the top: **RPE submitted** (responded / squad), **Avg s-RPE**, **High RPE (≥8)** count, and **Late / unlinked** submissions.

**Work the two tabs.** **Responded** lists players who submitted, sorted highest-RPE first; **Pending** lists those who haven't, with a one-tap **Remind missing** action over WhatsApp. Each player card can be shown as a **Numeric** row or a **Gauge** (a 0–10 dial with green/amber/red zones), and shows the RPE value, the session load (s-RPE, in au), the duration, this player versus the squad average, any reported sore areas, a comment and the submission time.

**Collect from players.** Generate a **tokenized share link** (pick the team, optionally attach it to a session), then copy it or send it over WhatsApp. Players open it, rate the session and submit — no account required.

**Handle late / unlinked submissions.** RPE submitted without a session attached appears in a **Late — needs a session** group; assign each to the right session so its load can be computed, or use **Auto-link** to attach today's loose submissions to today's sessions. The page also refreshes on its own so new responses appear without reloading.

## Key concepts

**RPE (rate of perceived exertion).** A player's subjective rating of how hard the session felt, on a **1–10** scale — the internal-load counterpart to external GPS load. It's best captured soon after the session while the impression is fresh.

**s-RPE (session load).** The core number: **s-RPE = RPE × session duration in minutes**, in arbitrary units (au). A 60-minute session rated 7 is 420 au. It combines *how hard* with *how long* into one internal-load figure per player per session.

**Intensity bands.** RPE is color-coded: green for a light session (≤ 4), amber for moderate (5–7), and red for hard (≥ 8). The **High RPE (≥8)** count surfaces the players who found the session hardest.

**Internal vs external load.** RPE is *internal* load — the athlete's perception. GPS (see [GPS Analysis](/support/gps-analysis)) is *external* load — distance, speed, accelerations. Reading both together gives the fuller picture; one can be high while the other isn't.

**How it feeds ACWR.** Each session's s-RPE is a daily internal-load value. The [Load Monitor](/support/load-monitor) sums those into acute and chronic windows and computes the acute:chronic ratio — so complete, timely RPE collection here is what makes the ACWR meaningful.

## FAQ

**What scale do players use?** 1–10. The load is then RPE × the session's duration in minutes.

**How is session load calculated?** s-RPE = RPE × duration (minutes), shown in arbitrary units (au) on each player card.

**How do players submit without an account?** Through a tokenized share link you generate and send (copy or WhatsApp); they rate the session and submit — no login.

**A submission isn't counting toward load — why?** It's probably unlinked (no session attached). Assign it to a session from the "Late — needs a session" group, or use Auto-link.

**Why does complete RPE matter?** Because the Load Monitor builds ACWR from these s-RPE values — missing responses leave gaps in a player's load history.

> TODO — could not confirm from the code, please verify: (1) a per-player **load trend / history** control appears on the card but is labeled coming-soon. (2) No dedicated **export** button was found on this page (collection and review are the focus; weekly totals and ACWR live in the Load Monitor).

## Related

- [Load Monitor](/support/load-monitor) — turns these s-RPE values into ACWR.
- [GPS Analysis](/support/gps-analysis) — external load, alongside this internal load.
- [Daily Planning](/support/daily-planning) — the Planned AU you set before the session, versus the s-RPE reported after.
