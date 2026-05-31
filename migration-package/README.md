# Migration Package — ClavaMetrics

Paquete de migración para integrar las pantallas nuevas + componentes de soporte al repo `joaqreiris/Clavametrics`.

Generado el: 2026-05-27 · actualizado 2026-05-27 (Fase 4: Lineup)
Origen: proyecto de diseño ClavaMetrics Design System

---

## 📦 Contenido

```
migration-package/
├── README.md                       ← este archivo
├── MIGRATION_PLAN.md               ← plan ejecutivo completo (leer primero)
├── claude-code-prompts/            ← prompts copy-paste para Claude Code
│   ├── 00-prep.md
│   ├── 01-billing.md
│   ├── 02-rehab.md
│   ├── 03-individual-planner.md
│   └── 04-lineup.md                ← NUEVO
├── files-to-add/                   ← archivos nuevos para copiar al repo (sin tocar)
│   ├── Billing.html
│   ├── Pricing.html
│   ├── Plan Picker.html
│   ├── Individual Planner.html
│   ├── Individual Plans.html
│   ├── Rehab & Preventives.html
│   ├── Rehab Planner.html
│   ├── Lineup.html                 ← NUEVO
│   ├── block-drawer.{js,css}
│   ├── individual-planner.{js,css,jsx}
│   ├── rehab-planner.{js,css,jsx}
│   ├── lineup.{js,css,jsx}         ← NUEVO
│   ├── image-slot.js               ← NUEVO
│   ├── plans-overview.css
│   └── tweaks-panel.jsx
└── sql-migrations/                 ← migraciones SQL para Supabase
    ├── 016_billing_plans.sql
    ├── 017_rehab_protocols.sql
    ├── 018_individual_plans.sql
    └── 019_lineups_v2.sql          ← NUEVO (extiende 008/009)
```

---

## 🚀 Cómo usar este paquete

### Opción A — Desde Claude Code (recomendado)

1. Descargar este paquete y descomprimir.
2. Mover la carpeta `migration-package/` adentro del repo local de Clavametrics.
3. Abrir el repo en VSCode con Claude Code.
4. Pegar el contenido de `claude-code-prompts/00-prep.md` como primer prompt.
5. Seguir secuencialmente: `01-billing.md` → `02-rehab.md` → `03-individual-planner.md` → `04-lineup.md`.

### Opción B — Manual

1. Leer `MIGRATION_PLAN.md`.
2. Copiar archivos de `files-to-add/` a la raíz del repo (sólo los que no existan).
3. Ejecutar las migraciones SQL en Supabase en orden.
4. Actualizar `assets/sidebar.js` agregando las entradas nuevas (ver MIGRATION_PLAN.md §4).
5. Hacer commit por feature, en branches separados.

---

## ⚠️ Reglas críticas

- **NO sobreescribir** los archivos compartidos del repo (`clavametrics.css`, `settings-drawer.jsx`, etc). El repo está **más adelantado** que este paquete en esos archivos.
- **NO** tocar pantallas existentes (`Hub.html`, `Calendar.html`, etc.) salvo el `sidebar.js` para agregar links.
- Cada feature en un branch separado y un PR independiente.
- Las 7 pantallas usan **mock data** — Claude Code debe wirearlas con Supabase usando `requireAuth()`, `getClubId()`, etc. (ver `Arquitecture.md` del repo).
