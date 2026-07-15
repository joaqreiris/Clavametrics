---
title: Clinical Record
slug: clinical-record
world: medical
app_page: Clinical Record.html
order: 3
summary: One player's full clinical file — medical profile, medications, screenings, episodes, surgeries, studies and documents — restricted to medical roles.
---

## What it is

The Clinical Record is one player's full medical file: their medical profile, medications, screenings, illness/injury episodes, surgeries, imaging studies and clinical documents. It's the most sensitive data in the app and is restricted to medical roles.

## When you use it

When the medical staff need a player's complete clinical picture — reviewing history, recording a screening or episode, logging a surgery or study, or uploading a report. It's the deep file behind the squad-level [Clinical Records](/support/clinical-records) index.

## How it works

**Open a player.** You reach a record from the [Clinical Records](/support/clinical-records) index (per player). The page loads that player's file across several tabs.

**Read the overview.** The overview shows headline KPIs, an injury timeline, and a **body heatmap** (see Key concepts).

**Work the modules.** Tabs cover each part of the file — injury history, illness & episodes (including concussion return-to-play steps), surgical history, treatments (read-only, from Physio), imaging studies, and documents. You add or edit entries in each module, and upload imaging or documents (image/PDF files up to the size limit).

**Baseline profile.** A medical-baseline card holds the player's profile — blood type, allergies, chronic conditions, family history, treating physician, insurance and review dates — editable from its modal.

## Key concepts

**The seven modules.** The record is built from seven medical tables:

| Module | Holds |
| --- | --- |
| Medical profile | Blood type, allergies, chronic conditions, family history, treating physician, insurance, review dates |
| Medications | Name, dose, frequency, reason, supplement flag, therapeutic-use exemption, dates, active |
| Screenings | Cardiac/preventive checks (ECG, echo, stress test, vision, dental…), status, result, dates |
| Episodes | Illness / concussion / other episodes — status, system, diagnosis, dates, days lost |
| Surgeries | Procedure, date, laterality, surgeon, clinic, implants, outcome |
| Studies | Imaging & lab (MRI, ultrasound, X-ray, CT, lab…), body area, finding, file |
| Documents | Reports, consents, certificates, insurance, other — title, file |

Injuries and treatments (from [Injuries](/support/injuries) and [Physio](/support/physio)) are also surfaced here for context. This documentation describes the fields; the clinical content is the medical staff's domain.

**The body heatmap.** The heatmap maps injuries onto body regions: each region shows the number of injuries there and is colored by the worst severity recorded (minor / moderate / severe). Active injuries stand out, and clicking a region filters the injury history to it — a quick read of where a player breaks down.

**Index vs individual file.** The [Clinical Records](/support/clinical-records) page is the **squad index** — a roster-level overview with each player's status and headline issue. This **individual record** is the deep file for one player. You go from the index into the record.

**Access — restricted to medical roles.** This is the strict part, and it's enforced in two places:

- **The page** redirects anyone who isn't a medical role away to the hub (the clinical module gate).
- **The database** enforces medical access on every clinical table: a user only sees this data if they're a **super-admin** or their role is **admin, owner or physio**. A coach or S&C role does not pass.
- **Documents** live in a **private** storage bucket (not public); files are served through short-lived **signed URLs**, and the bucket's own access rules require the same medical access and the same club. So clinical documents are never openly accessible.

## FAQ

**Who can open a player's clinical record?** Only medical roles — super-admin, or a user whose role is admin, owner or physio. Others are redirected away, and the database returns no clinical data to them.

**Are uploaded documents public?** No. They're in a private bucket and opened via short-lived signed URLs, gated to medical roles within the same club.

**What's the difference between this and the Clinical Records page?** Clinical Records is the squad-level index; this is one player's full file. You open a record from the index.

**Does this page give treatment guidance?** No — it stores and displays the player's clinical data. Clinical decisions stay with the medical staff.

## Related

- [Clinical Records](/support/clinical-records) — the squad index you open a record from.
- [Injuries](/support/injuries) — injuries that also feed the heatmap and history.
- [Physio](/support/physio) — treatments shown here read-only.
- [Rehab & Preventives](/support/rehab) — rehab programs for the player.
