---
title: Video Room
slug: video-room
world: overview
app_page: Video Room.html
order: 3
summary: A video library that links (not hosts) your Google Drive / Dropbox videos and connects each to sessions, players and matches.
---

## What it is

The Video Room is a video library: it **links** to videos that live in your club's Google Drive or Dropbox (it doesn't host the files) and connects each video to the sessions, players and matches it relates to.

## When you use it

To keep match and training footage organized and in context — add a Drive/Dropbox link, tag which session, players or match it belongs to, and find it later from the library or from those linked pages.

## How it works

**Add a video.** Paste a Google Drive or Dropbox link (a file or a folder) and give it a title; the provider and type are detected automatically, and an optional thumbnail can be set. ClavaMetrics stores the **link and its metadata** — the file stays in your Drive/Dropbox.

**Browse the library.** A grid of cards with search by title and filters by link type (session / player / match / unlinked), date and team.

**Open a video.** The detail view embeds the Drive/Dropbox player, holds staff **notes**, shows the source details, and lets you **link** the video to sessions, players and matches. Those links are two-way — the video then also appears in each linked session, player profile and match.

**Share.** You can **copy the link** (the underlying Drive/Dropbox URL) or **open it** in the provider.

## Key concepts

**A link library, not a host.** The core model is that ClavaMetrics keeps a **link** to each video plus its context, not the video file. Access to the actual footage is governed by your Google Drive / Dropbox sharing; ClavaMetrics manages the organization around it.

**Context linking.** The real organizing power is linking a video to one or more **sessions, players and matches**. Because the links are bidirectional, the same clip surfaces wherever it's relevant — on the session, on the player, on the match — without duplicating anything.

## FAQ

**Does ClavaMetrics store my videos?** No — the file stays in your Google Drive or Dropbox; the Video Room stores the link and the context (which session/players/match it belongs to).

**How do I share a video?** Copy its link (the Drive/Dropbox URL) or open it in the provider. Sharing/permissions are governed by your Drive/Dropbox.

**How do I find a player's videos?** Link videos to the player; they then appear in that player's context. You can also filter the library by link type.

> TODO — important, brief vs. code: the module was described as **"clips · tagging · share"**, but the page does **not** implement clip extraction, timestamped tagging, or event markers within a video — it does **video-level** linking to sessions/players/matches only. There is also **no share-into-chat** or internal share-link flow (only copy the Drive/Dropbox URL or open in provider). Confirm whether clip/tagging and chat-sharing are planned features, and reword any "clips/tagging" wording in the app that implies they exist today.

## Related

- [Player Profile](/support/player) — where a player's linked videos surface.
- [Match Reports](/support/match-reports) — the match a video can be linked to.
- [Chat & Tasks](/support/chat-tasks) — team chat (video sharing into chat isn't wired yet — see TODO).
