# Handoff: Force Tests — Evaluations (Team view + Player profile)

## Overview
Two screens for the **Evaluations** tab of ClavaMetrics (a performance OS for sports clubs). They present force-platform / jump-test results (VALD ForceDecks-style) for the coaching staff:

1. **Force tests — Team view** — ranked bar chart comparing every player on one chosen test + metric, against the group average. The entry point.
2. **Force tests — Player profile** — opens when a player is selected from the team view. Shows that player's latest results and the **evolution of each metric over time**.

Design intent: *fast, direct analysis* (Coubber-style). Few decisions, the useful number at a glance.

## About the Design Files
The files in this bundle are **design references created in HTML** — working prototypes showing the intended look, data model, and interactions. They are **not** production code to ship as-is.

The task is to **recreate these screens inside the ClavaMetrics codebase** using its existing environment and patterns (the product already ships a `clavametrics.css` `--cm-*` token system and `cm-` component classes — these prototypes are built on a packaged copy of exactly that system). Reuse the real components/tokens in the app rather than copying these standalone files. If you are starting fresh, pick the framework that fits the project (React is the product's direction) and implement against the tokens documented below.

This bundle includes the full design-system CSS (`styles.css` + `tokens/` + `css/`) so the prototypes render standalone and you can read every exact value. Fonts (Geist, Geist Mono) and Tabler icons load remotely via `@import` in `tokens/fonts.css` — no binaries bundled.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, layout, and interactions. Recreate pixel-faithfully using the codebase's existing `cm-` components/tokens. The mock **data** is illustrative and should be replaced by real test data from the force-platform integration.

---

## Screens / Views

### Shared app shell (both screens)
- **Grid:** `grid-template-columns: 248px 1fr; min-height: 100vh`.
- **Sidebar** (`.cm-shell-side`): dark (`--cm-side-bg #0E1116`), sticky full-height. Brand row (rising-bars logo mark in a 30px rounded accent square + "Clava FC" / "First team · 2025/26"), nav groups **Overview** (Staff Hub, Calendar, Squad) and **Performance** (Wellness, GPS analysis, **Evaluations — active**, Injuries · count 3), footer user row (JR · Joaquín R. · Head of performance). Active item uses `--cm-side-item-active-bg rgba(34,197,94,.10)` + `--cm-side-item-active-fg #4ADE80`.
- **Topbar** (`.cm-topbar`): 56px tall, sticky, `backdrop-filter: saturate(160%) blur(10px)` over `--cm-bg`. Left = breadcrumb; center-right = 320px search field with `⌘ K` kbd hints; right = icon button (download) + primary button **New test** (`.cm-btn.is-primary.is-sm`, pitch-green).
- **Page** (`.cm-page`): `padding: 28px 32px 64px; max-width: 1280px; margin: 0 auto`.

---

### Screen 1 — Force tests — Team view
**File:** `Force Tests - Team View.html`
**Purpose:** Coach scans the whole squad on one metric for one test, sees who is below the group average.

**Layout (top → bottom):**
1. **Page header** — eyebrow `FORCE PLATFORM`, H1 "Force tests — team view", sub-line `Session · Jun 12, 2026 · 20 players tested · MC 14 · MD-2`.
2. **Controls card** (`.cm-card`, flex row, 16px 18px padding, gap 18px):
   - **Test** select (`.cm-select`, min-width 188px): Countermovement Jump / Squat Jump / Drop Jump.
   - **Metric** select (min-width 168px): Jump Height / Peak Power / RSI / Contact Time.
   - **Order** segmented toggle (custom `.ft-seg`): `High → Low` / `Low → High`. Active segment = white surface + `--cm-shadow-1`.
3. **Summary card** (`.cm-card`, flex row): left = **group average** — big mono number (`font: 600 52px Geist Mono`, `-0.02em`, `tnum`) + unit + `Range x – y · n = 20`. Right = three stats divided by 1px borders: **Top** (best player + value), **Lowest** (worst + value), **Below avg** (count in `--cm-danger`, "of 20 players").
4. **Chart card** (`.cm-card`):
   - Head: title `<metric> by player · <test>` (+ ` · lower is better` for Contact Time) and a legend (Group avg dashed swatch · At/above · Below · Well below).
   - Plot: 296px tall flex row of bar columns (`align-items: flex-end`). Each column = value label on top (mono 11px) + bar (`width 68%, max-width 30px, radius 5px 5px 2px 2px`). A **dashed horizontal average line** (`1.5px dashed --cm-fg-muted`, z-index 4) overlays at the average's height, with a dark pill tag `avg <value> <unit>` (anchored right for desc order, left for asc).
   - Names row: rotated labels (`rotate(40deg)`, surname only) below a hairline divider.

**Bar color logic** (relative to group average, respecting each metric's better-direction):
- **At / above** average (good side): slate `#475569`.
- **Below** average, within 8% on the worse side: `--cm-warning #D97706` (bar + value + name).
- **Well below**, ≥8% on the worse side: `--cm-danger #DC2626`.
- For **Contact Time** (lower is better) the "worse" side is *above* average — the logic inverts automatically.

---

### Screen 2 — Force tests — Player profile
**File:** `Force Tests - Player Profile.html`
**Purpose:** Inspect one player's latest results and the trend of each metric over the season.

**Layout (top → bottom):**
1. **Back link** (`.ft-back`, ghost): `← Back to team` → navigates to the team view.
2. **Player header** — lg avatar (initials, dark fill) + H1 player name + meta row (`ST` position pill `.cm-pill.is-danger` + `24 yrs · 1.82 m · 82 kg · #9` in mono).
3. **Controls card** — Test + Metric selects (identical to team view; no order control).
4. **Summary cards** — 4-up grid `grid-template-columns: 1.3fr 1fr 1fr 1fr; gap 12px`:
   - **Latest · `<metric>`** — big mono value + unit, delta chip `+x.x%` (green up / red down, quality-aware) "vs personal avg".
   - **Personal avg** — mean value + `<n> tests · this season`.
   - **Asymmetry** — colored dot + `4%` + side (Right/Left), plus two mini L/R bars (`.ft-ab-track`/`.ft-ab-fill`; weaker limb uses `--cm-border-strong`). Dot color by threshold: ≤5% success, ≤10% warning, >10% danger.
   - **Last test** — days-ago number + `<test> · <date>`.
5. **Chart card** — title `<metric> over time · <test>`; legend (metric line swatch + dashed Personal avg). Inline **SVG line chart** (viewBox 960×320, responsive `width:100%`): 4 faint gridlines + left value labels, subtle area fill `rgba(71,85,105,.07)`, line `stroke #475569 width 2.25 round`, white dots `r 3.8` (stroke `#1F2937 2px`), **latest dot** filled `#1F2937 r 5.5` with value label, **personal-average dashed line** `#94A3B8 dasharray 3 4` with `avg <value>` label, x-axis date labels (`d Mon`).
6. **Table card** — head "Recent tests" + `<n> sessions`. Columns: **Date** · **Test** (`.cm-pill`) · **`<metric> (unit)`** (mono, right) · **vs avg** (signed %, green/red, right) · **Asymmetry** (status dot + `x% R`, right). Header `--cm-bg-sunk`, hairline rows, newest-first; the latest row is highlighted (`--cm-accent-soft`) and tagged `Latest` (green chip).

---

## Interactions & Behavior
- **Test select / Metric select** → recompute everything (average, bars/points, summary, table) and re-render. No page reload, no fetch in the prototype.
- **Order toggle** (team view) → re-sorts bars desc/asc by value; moves the average-tag side.
- **Back to team** (profile) → `href` navigation to the team-view file (in-app: route to the team view, ideally preserving the selected test/metric).
- **Row / module / button hovers** follow the system: borders step one notch stronger, fills `bg → soft → surface-2`, ghost buttons fill with `accent-soft`, primary button nudges 0.5px on press.
- **Transitions:** 120ms hover / 200ms state change, easing `cubic-bezier(.2,.7,.2,1)`. Bars animate height (200ms). **No bounce/spring/parallax.**
- **Responsive:** team summary stacks < 1080px; profile cards collapse to 2-up < 1080px; the SVG chart scales with its container.

## State Management
Per screen, minimal client state:
- **Team view:** `{ test: 'cmj'|'sj'|'dj', metric: 'jh'|'pp'|'rsi'|'ct', order: 'desc'|'asc' }`.
- **Player profile:** `{ playerId, test, metric }`.
- Derived per render: per-player/per-session metric values, group/personal **average**, min/max & scale, sorted order, below-average classification, latest value + delta, asymmetry of latest session.
- **Real data:** replace the mock arrays with the force-platform results API. Each session carries: date, test type, the measured metric values, and an L/R asymmetry % + dominant side. Metric semantics: Jump Height (cm), Peak Power (W), RSI / RSI-modified, Contact/contraction Time (ms — **lower is better**). In the prototype Peak Power is derived from jump height + body mass via the Sayers equation and RSI/contact-time from a per-session reactive factor — in production use the platform's measured values directly.

## Design Tokens (exact values — hybrid theme)
**Surfaces:** bg `#FBFBFA` · bg-soft `#F4F4F2` · bg-sunk `#EDEDEA` · surface `#FFFFFF` · surface-2 `#FAFAF9`.
**Text:** fg `#0F1115` · fg-strong `#000000` · fg-muted `#5B6470` · fg-faint `#8A93A0` · on-accent `#FFFFFF`.
**Borders:** border `#E7E7E4` · border-soft `#EFEFED` · border-strong `#D6D6D3` · width 1px. Focus ring `rgba(16,163,74,.25)`.
**Accent (pitch green, primary action only):** accent `#15803D` · hover `#166534` · press `#14532D` · soft `#ECFDF5`.
**Status:** success `#16A34A` · warning `#D97706` · danger `#DC2626` · info `#2563EB` · violet `#7C3AED` · neutral `#4B5563` (each with `-bg`/`-bd`).
**Sidebar (dark):** bg `#0E1116` · fg `#E6E8EB` · fg-muted `#8A93A0` · active-bg `rgba(34,197,94,.10)` · active-fg `#4ADE80` · accent `#4ADE80`.
**Chart-specific (not theme tokens):** bar/line slate `#475569` · emphasis ink `#1F2937` · area fill `rgba(71,85,105,.07)` · avg line `#94A3B8` · gridline `#EDEDEA`.
**Spacing (4px grid):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
**Radius:** 4 (tags) · 6 (inputs/sm btn) · 8 (buttons/chips) · 10 (cards) · 12 (large cards) · 16 (hero) · 999 (pills/avatars).
**Shadows:** shadow-1 `0 1px 0 rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.04)` (resting) · shadow-2 (hover-lift) · shadow-3 (drawers) · shadow-pop (modals). No glows, no inner shadows.
**Type:** Geist (UI) + Geist Mono (numbers/dates/metrics/kbd). Scale Display 40 / H1 28 / H2 22 / H3 18 / Title 15 / Body 14 / Meta 12 / Eyebrow 11. Negative tracking `-0.02em` display, `-0.01em` H1; eyebrows uppercased `0.08em`. Numbers use `font-feature-settings: "tnum"`.

## Assets
- **Fonts:** Geist + Geist Mono via Google Fonts; **Tabler Icons** webfont via jsDelivr — all imported in `tokens/fonts.css`. Icons used: `ti-home, ti-calendar-stats, ti-users, ti-heartbeat, ti-radar-2, ti-clipboard-data, ti-bandage, ti-selector, ti-search, ti-download, ti-plus, ti-sort-descending-2, ti-sort-ascending-2, ti-arrow-up-right, ti-arrow-down-right, ti-alert-triangle, ti-arrow-left, ti-bolt, ti-chart-line, ti-arrows-horizontal, ti-calendar-event, ti-trending-up, ti-trending-down`. No emoji, no hand-drawn SVG icons.
- **Brand mark:** the rising-bars glyph is pure CSS (`.cm-logo-mark`). No image file.
- **Images:** none used by these two screens.

## Files
In this bundle:
- `Force Tests - Team View.html` — Screen 1 (self-contained markup + screen-local CSS + vanilla-JS data/render).
- `Force Tests - Player Profile.html` — Screen 2 (idem; includes the SVG line-chart builder).
- `styles.css` — design-system entry point (`@import` manifest).
- `tokens/` — `fonts.css, typography.css, spacing.css, motion.css, colors.css, themes.css`.
- `css/` — `base.css, components.css, layout.css, app.css`.

Open either HTML file directly in a browser to see the live reference (needs network access for the remote fonts/icons).
