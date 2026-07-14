---
title: Injuries
slug: injuries
world: medical
app_page: Injuries.html
order: 1
summary: The injury log — record a player's injury, track it through rehabilitation phases, and clear it back to availability, with the squad's injury burden at a glance.
---

## What it is

The Injuries screen logs and tracks player injuries from onset, through structured rehabilitation phases, to return-to-play clearance — and shows the squad's injury burden through KPIs and a body map.

## When you use it

When a player gets injured (log it), as their rehab progresses (advance the phases), and when they're ready to return (clear/discharge it). It's also the place to read the squad's injury picture — who's out, days lost, time to return, re-injury rate.

## How it works

**Switch tabs.** Injuries are grouped into **Active** (early phases), **Returning** (later, return-to-training phases) and **Resolved** (cleared). A team selector scopes the list.

**Filter and read.** Filter by **severity** (minor / moderate / severe) and **body region**, sort (by severity, date or days injured), and search by player, injury type or area. A KPI strip shows active cases, days lost this month, average time to return, and re-injury rate; a squad **body map** marks injured regions.

**Log an injury.** The log form captures the injury's details — the player, the injury type, the body area, side, severity, category (muscular, ACL, ligament, tendon, bone, other) and sub-classification, the start date, an expected return, the mechanism, and notes. Saving creates the injury as **active** and builds its **rehabilitation phases** for the category.

**Track the phases.** Each injury runs through a phase timeline (the phases depend on the injury category). You open a phase to record its criteria and actual dates, mark it complete to advance to the next, or revert it with a logged reason.

**Clear/discharge.** When the player returns, **Discharge** sets a return date and optional notes: the injury becomes **cleared**, its phases are marked done, availability is returned to available from that date, and the staff are notified.

## Key concepts

**How an injury is tracked.** An injury isn't a single flag — it's a record that moves through **rehabilitation phases** based on its category (for example, muscular injuries carry a BAMIC grade; different categories have different phase structures). The app tracks each phase's status and dates; the clinical content of those phases is for the medical staff to apply — this documentation describes the tool, not the protocol.

**Relation to availability.** Injuries and [Availability](/support/availability) stay in sync, and manual availability entries are preserved:

- An active injury surfaces on the Availability matrix as **injured** across its date range (the Availability page fills this from active injuries without overwriting any status you set by hand).
- As rehab advances into the return-to-training phases, the player's status moves to **partial**.
- On discharge, availability is set back to **available** from the return date onward — but only where it was **injured**, so any other status you entered manually is left untouched.

**What "cleared" means.** Clearing (discharging) an injury records a return date, flips the injury to **cleared**, closes its phases, and returns the player to availability from that date — plus it notifies the staff that the player is available again. It's the tool's return-to-availability step, not a clinical fitness judgment (that's the medical staff's call).

**Who can see it.** Injury records are scoped **by player/team**: any staff member with access to that player's team can see the injury — including its type, area and notes — because injuries drive availability and planning. This is different from the deep clinical file (medical history, medications, screenings, documents…), which is restricted to medical roles — see [Clinical Record](/support/clinical-record).

## FAQ

**Does logging an injury automatically block the player's availability?** The Availability matrix fills an active injury as **injured** across its range without overwriting your manual entries; as the injury reaches the return phases the status becomes **partial**, and discharge returns it to **available**.

**Will clearing an injury overwrite availability I set by hand?** No — discharge only changes days that were marked **injured** back to available. Other statuses you entered stay as they are.

**Can a non-medical coach see the injury details?** Yes — injuries are visible to staff with access to the player's team (they drive availability). The separate, deeper clinical file is medical-only.

**What happens to the rehab phases when I discharge?** They're all marked done, and the injury moves to the Resolved tab.

> TODO — could not confirm from the page's own code, please verify: the Injuries page has **no client-side role gate** beyond the general module guard; access is enforced by the database (the injuries table is readable by staff scoped to the player's team, not gated to medical roles). Confirm this matches the intended policy for injury notes/diagnosis visibility.

## Related

- [Availability](/support/availability) — where an injury shows as injured/partial/available.
- [Physio](/support/physio) — treatments and adaptations for an injured player.
- [Rehab & Preventives](/support/rehab) — the rehab programs alongside the phases.
- [Clinical Record](/support/clinical-record) — the restricted, deeper clinical file.
