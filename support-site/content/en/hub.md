---
title: Staff Hub
slug: hub
world: overview
app_page: Hub.html
order: 1
summary: The app's home — a daily overview of squad KPIs, quick-access module cards, a recent-activity feed and your tasks.
---

## What it is

The Staff Hub is the app's home screen: a daily overview that greets you with today's context, headline squad KPIs, quick-access cards for every module, a recent-activity feed, and your tasks.

## When you use it

Every day, first thing — it's the landing page after sign-in. Use it to read the squad at a glance (availability, load, wellness, injuries), jump into any module, and see what's happened recently and what's assigned to you.

## How it works

**The greeting.** A header names today's context — the current microcycle and match-day, today's session (time and place), and availability pills (available / partial / out).

**KPI cards.** Four headline cards show by default — **Squad size, Avg ACWR, Wellness avg, Active injuries** — each with a trend sparkline. You can **customize** which KPIs show (up to four) from a wider set that includes Weather, Next match, Load this week, Wellness today, Available today, Sessions this week and Return to play; the choice is saved to your profile.

**Module cards.** A grid of cards links to each module (Planner, Exercises Library, Daily Planning, Microcycles, Availability, Squad, Match Reports, Wellness, RPE, Load Monitor, GPS Analysis, Injuries, Nutrition, Video Room), each with a live footer status (e.g. "3 need status", "{n} submitted today", "sessions pending").

**Recent activity and tasks.** A feed lists the latest club activity, and a tasks panel shows your open tasks (see [Chat & Tasks](/support/chat-tasks)).

## Key concepts

**What the KPI cards aggregate.** Each headline card is a squad roll-up from its module's data: **Squad size** counts active players; **Avg ACWR** is the mean of players' acute:chronic ratios (the club-configured model — see [Load Monitor](/support/load-monitor)); **Wellness avg** averages today's check-ins (see [Wellness](/support/wellness)); **Active injuries** counts open injuries (see [Injuries](/support/injuries)). The optional cards pull the same way — next match from the calendar, load-this-week from session RPE load, availability counts from the availability records.

**The recent-activity feed.** The feed shows the latest club events, each with who did it and when. The event types include: a **session published**, an **injury logged** or **cleared**, a **physio adaptation** required, **GPS data imported**, a **wellness** or **RPE** submission, a **task created** or **completed**, and a **member joined**. A GPS import appears as an "Imported GPS data from {session}" item referencing the session it belongs to.

**What "pending" means here.** Two module footers say "pending", and they mean different things — neither is a wellness figure:

- The **GPS** card's "sessions pending" counts recent sessions that don't yet have a GPS import.
- The **RPE** card shows how many RPE were **submitted today** — it's a *submitted* count, not a count of who's still missing. (The "sessions awaiting RPE" idea lives in the [RPE](/support/rpe) and planning views, not on the Hub.)

## FAQ

**Can I choose which KPIs show?** Yes — customize the KPI strip (up to four), and the choice sticks to your profile.

**Does the activity feed show GPS imports one per session?** Each import logs a "GPS data imported" activity referencing its session; in the recent-activity feed, imports on the same day are grouped into one row.

**Is the RPE number on the Hub the players who still owe an RPE?** No — it's how many were submitted today, not who's missing.

**Where does Avg ACWR come from?** It's the squad mean of players' ACWR using the club's configured model — the same engine as the [Load Monitor](/support/load-monitor).

## Related

- [Load Monitor](/support/load-monitor) — the ACWR behind the Avg ACWR card.
- [Wellness](/support/wellness) — the check-ins behind the wellness card.
- [Injuries](/support/injuries) — the active-injury count and injury feed events.
- [Chat & Tasks](/support/chat-tasks) — the tasks shown on the hub.
