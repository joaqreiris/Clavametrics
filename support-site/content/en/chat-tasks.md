---
title: Chat & Tasks
slug: chat-tasks
world: overview
app_page: Chat & Tasks.html
order: 2
summary: Team chat plus a task board — message in channels and DMs, and manage tasks assigned by person or by role, with due dates and reminders.
---

## What it is

Chat & Tasks combines the staff's team chat (channels and direct messages, with file attachments) and a task board where tasks can be assigned to a person or to a whole role, with due dates, priorities and reminders.

## When you use it

For day-to-day coordination: message the staff, share a file, and track who needs to do what — from match-day jobs to medical follow-ups — on a simple board.

## How it works

**Chat.** A team channel and direct messages, with file attachments and inline link previews; documents can be pinned to a channel. Messages carry a type (plain text or file, among others).

**Tasks.** A board with columns — **Backlog, In Progress, Blocked/Review, Done** — and filters (All, Mine, Overdue, Due today, Match-day, Medical, Routine). Create a task with a title, description, **due date**, **priority** (low/medium/high/urgent) and **category** (general, match-day, medical, routine, event), assign it, add **reminders**, and move it across the board. Completing a task notifies the creator and assignees.

## Key concepts

**By person vs by role.** A task can be assigned two ways:

- **By person** — to one specific member; only they are notified.
- **By role** — to a role (e.g. all physios); **everyone with that role** on the team is the assignee, and all of them are notified.

Role-based assignment is what lets you delegate a job to "the medical staff" or "the coaches" without naming individuals — the app resolves the role to the current members.

**Reminders / alarms.** A task can carry one or more reminders — presets like a day or an hour before, on the due date, or a custom time. Each reminder is stored with its fire time and a sent marker; delivery is handled by a scheduled process (see the TODO on the exact delivery channel).

**Status and notifications.** Tasks move Backlog → In Progress → Blocked/Review → Done. The transition to Done raises a notification to the creator and the assignees. Notifications from other modules (like a physio adaptation) also flow through this system.

## FAQ

**Can I assign a task to a whole role?** Yes — assign by role and everyone with that role on the team gets it (and a notification); or assign by person for a single member.

**How do reminders fire?** You set reminder times on the task; a scheduled process sends them (the exact channel — push/email/in-app — wasn't confirmed from this page).

**Can I attach files in chat?** Yes — attachments and inline link previews are supported, and documents can be pinned to a channel.

> TODO — could not confirm from the code, please verify: (1) message types **`task_ref`**, **`report_share`** and **`system`** are declared but don't appear wired into the UI (only text and file are clearly used). (2) The **reminder delivery mechanism** (which channel actually sends them) runs outside this page and wasn't confirmed. (3) A task's link to a specific **player/session/injury** isn't an explicit field here (category infers context). (4) A **share-into-chat** action (e.g. sharing a report or video into a message) wasn't found wired up.

## Related

- [Staff Hub](/support/hub) — surfaces your open tasks.
- [Physio](/support/physio) — physio adaptations raise notifications into this system.
- [RPE](/support/rpe) — reminders to players are sent from there over WhatsApp, separate from these task reminders.
