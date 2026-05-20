---
name: clavametrics-design
description: Use this skill to generate well-branded interfaces and assets for ClavaMetrics — a Performance OS for sport (football, basketball, volleyball, swimming, athletics, tennis, rugby and more). Contains essential design guidelines, colors, type, fonts, the Tabler icon system, the three production-ready theme directions (light · dark · hybrid), and high-fidelity prototype templates for Login, Onboarding, and the Staff Hub.
user-invocable: true
---

Read the `README.md` file within this skill, then explore the other available files. In particular:

- `clavametrics.css` is the single source of truth for tokens (colors, type, radii, spacing, motion) and components (`.cm-btn`, `.cm-card`, `.cm-pill`, `.cm-input`, etc.). It defines three theme directions via `data-theme="light|dark|hybrid"` on `<html>`.
- `theme-tweaks.jsx` is the per-page theme switcher used by every prototype. To pin a starting direction for a new screen, set `window.__CM_TWEAK_DEFAULTS = { theme, accent, radius, density, sidebarHue }` **before** the script loads.
- `Login.html`, `Onboarding.html`, `Hub.html` are working high-fidelity templates. Copy `Hub.html` when starting a new authenticated screen — it has the full app shell.
- `preview/` contains bite-sized cards showcasing each token group.
- `assets/` holds logos, the field background and training props from the legacy app.

If creating **visual artifacts** (slides, mocks, throwaway prototypes), copy the assets you need out, write static HTML files, and load `clavametrics.css` from a relative path.

If working on **production code**, you can copy assets into the codebase and read the rules in `README.md` to become an expert in designing with this brand — but always verify against the live Tabler icon catalogue (<https://tabler.io/icons>) and Geist's licensing terms (<https://vercel.com/font>) before shipping.

When the user invokes this skill without other guidance:
1. Ask what surface they want to design (Login, Onboarding, Hub, Squad, Availability, Load Monitor, Wellness, Chat, Match Reports, etc.).
2. Ask which theme direction they want as the starting point (`light` / `dark` / `hybrid`) and which accent (`neutral` / `green` / `blue` / `violet` / `gold`).
3. Ask whether they want it as an HTML artifact, a Figma-style canvas with multiple variations, or production-ready code.
4. Act as an expert designer who outputs HTML using the existing tokens and components rather than reinventing them.

**Hard rules:**
- Never introduce a new color outside the documented palette without flagging it.
- Use Tabler icons for every glyph. No emoji.
- Geist for everything UI; Geist Mono for numbers, timestamps, and keyboard hints.
- Respect the three theme directions — don't hard-code dark colors into a `light` view, etc.
- Default density is `balanced` — tables stay dense, cards stay airy.
