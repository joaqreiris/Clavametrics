---
title: Admin
slug: admin
world: admin
app_page: Admin.html
order: 1
summary: The club control center — members, roles and per-section permissions, GPS integrations (Catapult pull / StatSports push), notifications, subscription and audit log.
---

## What it is

Admin is the club's control center: manage staff members and their roles, grant per-section access, connect GPS providers, route notifications, and see the subscription and audit log. Only club **owners and admins** can open it — everyone else is redirected to the hub.

## When you use it

At setup and whenever the club changes: invite or remove staff, change a member's role, grant or revoke module access, assign members to teams, and connect or re-map a GPS integration.

## How it works

**Move between sections.** Tabs cover **Members**, **Roles**, **Sections**, **Subscription**, **Notifications**, **Integrations**, **Security & SSO**, and **Audit log**. (Sections and Security & SSO are marked coming-soon.)

**Manage members.** The Members table lists staff with their role, granted sections, last activity and status. From a member's row you **change their role**, **edit their sections** (grant/revoke modules), assign them to **teams**, or copy their email. **Invite** a new member by email with a role (and optional teams) — they get an invitation and, on acceptance, their role's default permissions are applied.

**Set roles and templates.** In Roles you edit each role's **default module set** (its template) and can bulk-apply a template to everyone with that role.

**Connect GPS.** In Integrations you connect **Catapult** or **StatSports** (see Key concepts), map their athletes to your players and their parameters to your metrics, and verify/sync.

**Route notifications, review billing, audit.** Notifications routes alerts (e.g. a reported discomfort) per role and scope; Subscription shows the plan and links to billing; Audit log lists recent club actions.

## Key concepts

**Roles.** A member's role is one of: **owner, admin, coach** (and coach variants — assistant, GK), **S&C coach, fitness coach, analyst, physio** (medical lead), **nutritionist, staff**, plus **player**. Owner and admin have full, unrestricted access to every module.

**The two-level permission model.** Access to each app section is controlled in two layers:

1. **Role templates** — each role has a default set of modules for the club (its template). When someone joins with a role, that template is applied automatically.
2. **Per-member grants** — an admin can override an individual member's access, granting or revoking specific modules.

A member's granted modules are stored as rows keyed by module. A special **`__managed__`** marker means the member is in *restricted* mode: they see only the modules explicitly granted. If a member has **no** module rows at all, they get **full access** (the model fails open) — so restricting a member means switching them into managed mode with an explicit list. Owners and admins always get everything regardless.

**Module sections.** The sections that can be granted include planning (planner, daily planning, annual planner, sessions library/history), squad (squad, lineup, availability, evaluations, match reports), performance (wellness, RPE, load monitor, GPS), S&C (gym planner, individual S&C, gym library, nutrition), and medical (clinical, injuries, treatments, rehab, video room). This is why, for example, the medical modules can be withheld from non-medical roles.

**GPS integrations — pull vs push.** The two providers connect differently:

- **Catapult** is a **pull** integration: you paste a **club API token** (from OpenField) and pick a region; ClavaMetrics then pulls your activities on demand or on a sync. The token is stored as a secret (never shown back), and you map Catapult's athletes and parameters to your players and metrics.
- **StatSports** is a **push** integration: you arrange with your **StatSports account manager** to enable the third-party API, and enter the key; data is delivered to ClavaMetrics rather than pulled. (See the TODO on the exact push wiring.)

**Club-scoped.** Everything here is scoped to your club (members, permissions, integrations). Platform super-admins (a separate platform-admin list) can operate across clubs.

## FAQ

**Who can open Admin?** Only owners and admins — other roles are redirected to the hub.

**How do I stop a coach from seeing medical data?** Put the member in managed mode and grant only the modules they should have — leaving out the clinical/injuries/treatments/rehab sections. (The clinical file also has its own database-level medical gate — see [Clinical Record](/support/clinical-record).)

**What's the difference between a role template and a member's sections?** The template is the default for everyone with that role; a member's sections are their individual grants, which can override the template.

**How is Catapult different from StatSports?** Catapult is pulled with a club API token you enter; StatSports is pushed to ClavaMetrics after your StatSports account manager enables the API.

> TODO — could not fully confirm from the code, please verify: (1) whether **changing a member's role** automatically re-applies that role's module template, or if the template must be re-applied manually. (2) The exact **StatSports push wiring** on ClavaMetrics' side (webhook/endpoint) — the Admin page shows the account-manager setup and a "verification pending" state, but the receiving mechanism wasn't visible here. (3) The **Sections** and **Security & SSO** tabs are marked coming-soon, and the **Stripe billing** webhook that fills subscription data is noted as pending.

## Related

- [GPS Analysis](/support/gps-analysis) — where the synced GPS data is analyzed.
- [Load Monitor](/support/load-monitor) — the club-configured ACWR model applies club-wide.
- [Clinical Record](/support/clinical-record) — the medical modules gated here, plus their own database gate.
- [Staff Hub](/support/hub) — the home the non-admin roles land on.
