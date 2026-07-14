---
title: Match Reports
slug: match-reports
world: performance
app_page: Match Reports.html
order: 7
summary: The post-match report — score, formation and per-player minutes, ratings, goals, cards and GPS, tied to the match on the calendar.
---

## What it is

Match Reports is the post-match record: the result and match details plus per-player performance — minutes, rating, goals and assists, cards, and GPS output — for a match on the calendar.

## When you use it

After a match, to record the result and enter (or import) the players' stats, and later to review a match's per-player numbers and trends.

## How it works

**Pick the match.** A selector lists your **match** sessions (most recent first). Selecting one loads its report or starts a new one.

**Enter the match details.** The report holds the score (for/against), competition, venue, home/away, opponent, formation, possession and notes.

**Add the player stats.** Per player you record minutes, rating, goals, assists, yellow/red cards and position — by hand or by **importing** a CSV/Excel file (e.g. a Wyscout or generic export), mapping its columns and matching rows to your players by name or number. GPS output (distance, sprint, top speed) is shown alongside from the session's GPS data. Ratings are color-coded by band.

## Key concepts

**What a match report captures.** Two layers: the **match result** (score, opponent, competition, venue, home/away, formation, possession, notes) and the **per-player stats** (minutes, rating, goals, assists, cards, position), with GPS metrics overlaid from the session.

**Link to the calendar fixture.** A report is tied to a **match session** on the calendar — one report per match session, keyed by that session. Selecting the session auto-fills its date. Note that the opponent and competition are entered on the report (they aren't auto-pulled from the fixture — see the TODO).

**Minutes and ratings.** Minutes and ratings are entered or imported into the report. Ratings display on a color scale (roughly: green for high, neutral in the middle, red for low). See the TODO on whether minutes/ratings flow onward into availability or the player's season profile.

## FAQ

**How do I create a report for a match?** Select the match session; a report is created against it (one per match session). Fill in the result and add the player stats.

**Can I import stats instead of typing them?** Yes — import a CSV/Excel export, map the columns, and match rows to players by name or number.

**Where does the GPS in the report come from?** From the session's GPS data, shown per player alongside the match stats (the full analysis lives in [GPS Analysis](/support/gps-analysis)).

> TODO — could not confirm from the code, please verify: (1) whether a player's **minutes** feed the availability "minutes played" (match:N) or the season profile, and whether **ratings** persist to the profile — neither hand-off was visible here. (2) How **standalone reports** (with no linked session) are used. (3) There's **no share-into-chat** of a report found. (4) A selected **player-load** GPS field isn't rendered, and some richer views (shot map, heatmap, timeline) appear to be future/absent.

## Related

- [Calendar](/support/calendar) — where the match session the report attaches to is scheduled.
- [Lineup](/support/lineup) — the XI built for the same match.
- [GPS Analysis](/support/gps-analysis) — the full GPS breakdown behind the report's metrics.
- [Player Profile](/support/player) — where a player's minutes and production surface.
