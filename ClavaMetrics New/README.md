# ClavaMetrics — Design System

> **Performance OS for sport.** A centralized application for clubs of every size — football, basketball, volleyball, swimming, athletics, tennis, rugby and more — to run every category from one place.

This system is a **ground-up redesign** away from the legacy gold-on-near-black look of the original codebase (internally tracked as `Kime` / `ClavaMetrics v1`). It targets the visual language of Linear · Hudl · Kitman Labs · Notion · Stripe — quiet chrome, generous data density, one accent reserved for the primary action, and three production-ready theme directions.

---

## Index

```
.
├── README.md                  ← you are here
├── clavametrics.css           ← core tokens + components (light / dark / hybrid)
├── colors_and_type.css        ← legacy v1 tokens, kept for reference
├── theme-tweaks.jsx           ← per-page theme switcher (used by every prototype)
├── tweaks-panel.jsx           ← starter UI shell for the Tweaks panel
├── Login.html                 ← Sign-in prototype  (hybrid + pitch-green default)
├── Onboarding.html            ← Setup wizard       (light  + pitch-green default)
├── Hub.html                   ← Staff dashboard    (hybrid + pitch-green default)
├── preview/                   ← Design System tab cards
└── assets/                    ← Logos, field background, training props, gym icons
```

**Run:** open any of the three `*.html` files. The Tweaks toggle in the toolbar exposes a panel that lets you switch theme direction (light / dark / hybrid), pick one of five curated accents, change corner radii, density, and sidebar tone.

---

## Sources used to build this system

| Source                                          | Notes                                                                                                                                               |
|-------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Local codebase — `ClavaMetrics/`                | The legacy v1 app (every HTML view + strategy docs). Read to understand the **product map** and **content patterns**; the visual language was intentionally not preserved. |
| GitHub — `joaqreiris/players_availability`      | Same Players Availability module ships inside the local codebase. Explore at <https://github.com/joaqreiris/players_availability>.                  |
| **Design references** (visual targets, not copied)| [linear.app](https://linear.app), [stripe.com/dashboard](https://stripe.com/), [hudl.com](https://hudl.com), [kitmanlabs.com](https://kitmanlabs.com), [vercel.com](https://vercel.com), [geist-ui.dev](https://geist-ui.dev) |

The reader is encouraged to keep the original ClavaMetrics codebase mounted while iterating on this system — every screen you might want to redesign next has a real, working implementation there.

---

## VISUAL FOUNDATIONS

### Three theme directions
The system ships three first-class directions, switchable via the Tweaks panel and via the `data-theme` attribute on `<html>`:

1. **`light`** — Notion / Stripe / Vercel. Warm-white surfaces (`#FBFBFA`), near-black ink (`#0A0A0A`), thin neutral borders, no atmospheric gradients. The most minimal of the three.
2. **`dark`** — Linear / Hudl / Vercel. Pure-black canvas (`#0A0A0A`), bright off-white ink (`#EDEDED`), low-opacity hairlines, a single subtle radial atmosphere wash.
3. **`hybrid`** — Stripe Dashboard split. **Dark sidebar** (`#0E1116`) + **light canvas** (`#FBFBFA`). This is the prototype default for the in-app screens — it gives the chrome personality without making the data-dense canvas hard to read.

### Accent system
Five accents are curated per direction (`neutral · green · blue · violet · gold`). The Login / Onboarding / Hub all ship with **`green` (pitch-green `#15803D`)** as the default — it's the only color that carries the sport-context vocabulary forward from the legacy app.

### Typography
- **Geist** for everything UI (body, headings, labels, buttons). Weights 300–700.
- **Geist Mono** for numbers, timestamps, ACWR / wellness values, keyboard hints, and anywhere we want a mechanical feel.
- Type scale (Display 40 → H1 28 → H2 22 → H3 18 → Body 14 → Meta 12).
- **Negative letter-spacing** (`-0.02em` on display, `-0.01em` on H1) is what gives Geist its modern feel — don't lose it.

### Spacing & radii
4-px grid. Radii start tight (4 px for tags, 8 px for buttons, 12 px for panels, 16 px for hero surfaces). The Tweaks panel exposes a global radius dial (`tight` / `regular` / `soft`) for users that want to push the system more Stripe (regular) vs more Vercel/Notion (tight) vs more friendly-consumer (soft).

### Shadows
Stripe-style **layered low-opacity** shadows: `shadow-1` for resting cards, `shadow-2` for hover-lifted cards, `shadow-3` for drawers, `shadow-pop` for modals. No glows. No inner shadows.

### Backgrounds
- `light` & `hybrid` ship **no atmospheric gradients** — the surface is the surface.
- `dark` adds a single low-opacity radial wash at top-center (≈4% white). Restrained.
- Imagery is **never decorative**. The field photograph from v1 is preserved in `assets/` and is used only inside the tactical Planner canvas (not yet redesigned).

### Motion
- 120 ms for hover transitions (`var(--cm-dur-1)`).
- 200 ms for state changes (`var(--cm-dur-2)`).
- 320 ms for the rare large transition (`var(--cm-dur-3)`).
- Easing is `cubic-bezier(.2,.7,.2,1)` — confident, fast at the start, decelerated end.
- **No bounce / spring / parallax** anywhere. Performance staff don't want their data jumping.

### Hover / press
- **Hover**: borders go from neutral → strong neutral (one step warmer), fills go bg → bg-soft → surface-2, ghost buttons fill with `accent-soft`.
- **Press**: 0.5 px Y nudge on primary buttons. Cards don't shrink — they just brighten their border.
- **Focus**: always a 3 px ring in the accent-tinted focus color (`--cm-focus-ring`).
- **Disabled**: 45% opacity, no pointer events, no transform.

### Borders
- **Hairline** (`--cm-border-soft`) — separates rows inside the same card.
- **Default** (`--cm-border`) — separates cards from canvas.
- **Strong** (`--cm-border-strong`) — interactive emphasis (input focus pre-ring, hovered outline button).
- Never gold-tinted, never dashed except on intentional drop zones.

### Corner radii
Per the standard scale: `4 / 6 / 8 / 10 / 12 / 16 / 999`. The full-pill (`999`) is reserved for status pills and avatars.

### Cards
- Default = `1px solid var(--cm-border) + var(--cm-r-4) + var(--cm-shadow-1)`.
- Hover lifts the card 1 px in `translateY` and switches to `shadow-2`.
- No left-border accent stripes. No tinted backgrounds. Hierarchy comes from typography, not decoration.

### Layout rules
- **Sticky topbars** in every authenticated view. `backdrop-filter: blur(10px) saturate(160%)` over the canvas.
- App shell is always **240–280 px sidebar + flex main**. Sidebar is sticky-full-height.
- Page padding: `28 / 32 / 40 px` depending on density.

### Transparency & blur
Reserved for the topbar + popovers. The body never uses opacity-tinted surfaces.

### Imagery vibe
Warm, sunlit pitch palette for the few photographs we use. No grain, no B&W, no duotone overlays.

---

## CONTENT FUNDAMENTALS

The voice carries over from the legacy app — **operator-grade, terse, no marketing fluff** — but loses the all-caps shouting that came from Bebas Neue. Geist 600 with tight tracking is the new authority.

### Tone
- **Operator-grade.** Module names stay short: "Planner", "Squad", "Availability", "Load monitor".
- **Sentence case** for body and headings. Eyebrows and meta-labels are still uppercased via `text-transform: uppercase` on Geist with `0.08em` tracking — they look like Geist Mono labels even when they're not.
- **Bilingual** (EN / ES). UI strings live in dictionaries on each page. Spanish stays Rioplatense ("Plantel", "Microciclo").
- **No emoji** in the new design. Tabler icons replace every emoji that was load-bearing in v1 (🌙 → `ti-moon`, 🔓 → `ti-lock`, ⚽ → `ti-ball-football`, …).

### Examples
- Login: **"Sign in to your team"** / "New here? Create your organization"
- Login hero: **"One platform. Every sport. Every category."**
- Hub greeting: **"Good morning, Joaquín — here's what needs you today."**
- Module: **"Availability"** / "Daily presence · session min." / "3 need status"
- Activity feed: **"Pablo Fierro · Published MC 14 — Day 3 session · 12 min ago"**
- Empty state: still **"No changes"** — keep it tight.

### Punctuation & glyphs
- Mid-dots `·` separate descriptor clauses (kept from v1).
- Em-dashes `—` for parenthetical clarifications.
- `→` `↗` (Tabler icons) for forward navigation arrows. No raw `›` anymore.
- ⌘ / ↵ inside `.cm-kbd` chips for keyboard hints — a Linear/Notion-style affordance.

---

## ICONOGRAPHY

### System
The redesign uses **[Tabler Icons](https://tabler.io/icons)** loaded as a webfont — `@tabler/icons-webfont` from jsDelivr, imported at the top of `clavametrics.css`. Tabler is a Lucide-cousin with a **technical, slightly-thicker stroke** that reads cleanly in tables and dense lists — ideal for sports analytics.

Usage:
```html
<i class="ti ti-soccer-field"></i>
<i class="ti ti-heartbeat"></i>
<i class="ti ti-radar-2"></i>
```

Default size is `16–18 px`, color is `currentColor`. We never recolor a Tabler icon outside its containing component.

### Substitution flag
The user-attached codebase shipped Tabler-style inline SVGs hand-drawn per-page. We swap those out for the webfont — the visual gap is ~zero because the source SVGs were already in that family. **Flag**: if you need an icon Tabler doesn't have, fall back to inline SVG with `stroke-width: 1.75` and `stroke-linecap: round` to match.

### Emoji
**Banned in the new system**, except in the optional 🌙/☀ theme toggle button (which is itself optional and can be replaced with `ti-moon` / `ti-sun`).

### Legacy PNG illustrations
The flat-line training-prop PNGs (`assets/ball.png`, `cone.png`, `gate.png`, `stake.png`, `barrier.png`, `line-solid.png`, `line-dashed.png`) are preserved for the tactical Planner canvas. The gym icon PNGs (`icon-dumbbell.png`, `icon-barbell.png`, …) are also preserved but their use is **discouraged** in new screens — prefer Tabler.

### Brand mark
The new brand mark is a **rising-bars glyph** drawn inline as a 3-stroke SVG inside a `8 px` rounded square (`clavametrics.css → .cm-logo-mark`). It signals "analytics" without spelling it out. Sized 28 px in topbars, 32 px on rails, 48 px on the login hero, 72 px reserved for marketing surfaces. The legacy gold **K** mark from v1 lives in `assets/kime-logo.svg` and is kept for backward compatibility only.

---

## Font substitution note

`clavametrics.css` loads **Geist + Geist Mono** from Google Fonts (`fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600`). No local `.ttf` / `.woff2` files are bundled. If you intend to ship offline or use these in a print PPTX export, attach the official Vercel font files and we'll wire them into a `fonts/` folder + `@font-face` rules. Geist is openly licensed (MIT) — see <https://vercel.com/font>.

---

## How to use this system

1. **CSS only**: drop `clavametrics.css` into a page, add `class="cm"` to `<body>`, choose a `data-theme="light|dark|hybrid"` on `<html>`. You now have the full vocabulary (`.cm-btn`, `.cm-card`, `.cm-pill`, `.cm-input`, `.ti ti-*`).
2. **CSS + per-page theming**: also include `theme-tweaks.jsx` (with React + Babel) and a `<div id="tweaks-root"></div>`. Override defaults with `window.__CM_TWEAK_DEFAULTS = { theme, accent, radius, density, sidebarHue }` before the tweaks script loads.
3. **Build a new screen**: copy `Hub.html` as a template (it's the most complete layout), trim/replace, and you're 70% of the way to a finished surface.
