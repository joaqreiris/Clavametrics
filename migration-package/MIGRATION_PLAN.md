# MIGRATION PLAN — ClavaMetrics
**Integración de 8 pantallas nuevas + componentes de soporte**

Versión: 1.1 · Generado: 2026-05-27 · actualizado 2026-05-27 (Fase 4)
Repo destino: `joaqreiris/Clavametrics` (branch `main`)

---

## 0. Resumen ejecutivo

| Feature | Pantallas | SQL | Riesgo | Branch |
|---|---|---|---|---|
| **Billing** | Billing, Pricing, Plan Picker | `016_billing_plans.sql` | 🟢 Bajo | `feature/billing` |
| **Rehab** | Rehab & Preventives, Rehab Planner | `017_rehab_protocols.sql` | 🟡 Medio | `feature/rehab-planner` |
| **Individual Planner** | Individual Planner, Individual Plans | `018_individual_plans.sql` | 🔴 Alto | `feature/individual-planner` |
| **Lineup Builder** | Lineup | `019_lineups_v2.sql` (extiende 008/009) | 🟡 Medio | `feature/lineup-builder` |

**Tiempo estimado total:** 8-13 horas de Claude Code (2-3h por feature).

---

## 1. Estado de la auditoría de drift (Fase 1 ✓)

Resultados de comparar archivos compartidos entre proyecto y repo:

| Archivo | Δ bytes | Acción |
|---|---|---|
| `clavametrics.css` | +59 (repo más grande) | 🟢 No tocar — repo es fuente de verdad |
| `colors_and_type.css` | +1.120 (repo más grande) | 🟢 No tocar |
| `theme-tweaks.jsx` | +37 (repo más grande) | 🟢 No tocar |
| `settings-drawer.jsx` | **+16.037 (repo más grande)** | 🔴 **No tocar** — repo tiene `BillingPanel`, `NotificationToast`, realtime |
| `ios-frame.jsx` | +1.771 (repo más grande) | 🟢 No tocar |

**Decisión:** el repo es la fuente de verdad para infraestructura compartida. Las pantallas nuevas se agregan SIN modificar archivos existentes.

---

## 2. Inventario de archivos nuevos

### 2.1 Pantallas HTML (7)

| Archivo | Líneas | Dependencias CSS | Dependencias JS | Datos |
|---|---|---|---|---|
| `Billing.html` | 568 | `clavametrics.css` | — | mock |
| `Pricing.html` | 818 | `clavametrics.css` | React + Babel + `tweaks-panel.jsx` + `theme-tweaks.jsx` | mock |
| `Plan Picker.html` | 816 | `clavametrics.css` | — | mock |
| `Individual Planner.html` | 501 | `clavametrics.css`, `rehab-planner.css`, `individual-planner.css`, `block-drawer.css` | React + `tweaks-panel.jsx`, `individual-planner.js`, `block-drawer.js`, `individual-planner-tweaks.jsx` | mock |
| `Individual Plans.html` | 372 | `clavametrics.css`, `rehab-planner.css`, `plans-overview.css` | — | mock |
| `Rehab & Preventives.html` | 499 | `clavametrics.css`, `rehab-planner.css`, `plans-overview.css` | — | mock |
| `Rehab Planner.html` | 590 | `clavametrics.css`, `rehab-planner.css`, `block-drawer.css` | React + `rehab-planner.js`, `block-drawer.js`, `rehab-planner-tweaks.jsx`, `tweaks-panel.jsx` | mock |

### 2.2 Soporte JS/CSS/JSX

| Archivo | Bytes | Usado por |
|---|---|---|
| `block-drawer.js` | 25.457 | Individual Planner, Rehab Planner |
| `block-drawer.css` | 15.370 | Individual Planner, Rehab Planner |
| `individual-planner.js` | 11.610 | Individual Planner |
| `individual-planner.css` | 6.415 | Individual Planner |
| `individual-planner-tweaks.jsx` | 1.713 | Individual Planner |
| `rehab-planner.js` | 22.063 | Rehab Planner |
| `rehab-planner.css` | 38.548 | Rehab Planner, Individual Planner, Rehab & Preventives |
| `rehab-planner-tweaks.jsx` | 2.903 | Rehab Planner |
| `plans-overview.css` | 11.305 | Individual Plans, Rehab & Preventives |
| `tweaks-panel.jsx` | 25.111 | Pricing, Individual Planner, Rehab Planner |

**Total:** 17 archivos nuevos.

---

## 3. Conflictos detectados

### 3.1 ⚠️ Duplicación: `Billing.html` vs `SettingsDrawer > BillingPanel` (en repo)

El repo `settings-drawer.jsx` ya tiene un tab "Billing" que lee:
- `clubs.billing_plan`
- `clubs.billing_amount`
- `clubs.billing_next_date`
- `clubs.billing_status`

`Billing.html` (proyecto) usa los **mismos campos**.

**Decisión propuesta:**
- Mantener AMBOS. `SettingsDrawer > Billing` = vista rápida embebida. `Billing.html` = página dedicada con historial, métodos de pago, etc.
- Agregar link "Ver detalle completo →" en `BillingPanel` que vaya a `Billing.html`.

### 3.2 ⚠️ `tweaks-panel.jsx` no existe en repo

Este componente es un starter genérico. Se necesita para que `theme-tweaks.jsx` (repo) funcione en las pantallas nuevas que tienen Tweaks (Pricing, Individual Planner, Rehab Planner).

**Decisión:** subir `tweaks-panel.jsx` como archivo nuevo en la raíz.

### 3.3 ⚠️ Sidebar nuevo en pantallas nuevas

Las 7 pantallas tienen su sidebar hardcodeado con clases `.hub-shell`, `.hub-side` (no usan el `cm-shell` del design system). Tienen entradas que no están en el sidebar del repo:
- **"Individual S&C"** → `Individual Plans.html` (grupo Performance)
- **"Rehab & preventives"** → `Rehab & Preventives.html` (grupo Medical)

**Decisión:** agregar estas 2 entradas en `assets/sidebar.js` del repo.

---

## 4. Cambios requeridos en archivos del repo

### 4.1 `assets/sidebar.js` — agregar 2 entradas

```javascript
// En grupo "Performance" (después de "Gym planner"):
{ href: 'Individual Plans.html', icon: 'ti-user-cog', label: 'Individual S&C' },

// En grupo "Medical" (después de "Physio"):
{ href: 'Rehab & Preventives.html', icon: 'ti-activity-heartbeat', label: 'Rehab & preventives', count: 0 },
```

### 4.2 `Arquitecture.md` — agregar las 7 pantallas en la lista correspondiente

### 4.3 `docs/COMPONENT_MAP.md` — agregar los componentes nuevos (`block-drawer`, `tweaks-panel`)

### 4.4 `settings-drawer.jsx` — agregar link a `Billing.html` en `BillingPanel`

```jsx
// Después del último <div className="sd-billing-row">
<div className="sd-billing-actions">
  <a href="Billing.html" className="sd-link-detail">
    Ver detalle completo <i className="ti ti-arrow-right"></i>
  </a>
</div>
```

---

## 5. Migraciones SQL necesarias

### 5.1 `migrations/016_billing_plans.sql`
Tablas: `plans`, `subscriptions`, `invoices`, `payment_methods`.
Verifica que las columnas `billing_*` en `clubs` ya existen (referenciadas por `SettingsDrawer`).

### 5.2 `migrations/017_rehab_protocols.sql`
Tablas: `rehab_protocols`, `preventive_routines`, `protocol_blocks`.
Foreign keys a `injuries` y `injury_phases` (que ya existen — `012`, `013`).

### 5.3 `migrations/018_individual_plans.sql`
Tablas: `individual_plans`, `individual_plan_blocks`, `player_individual_assignments`.
Foreign keys a `players`, `gym_exercises`.

Todas con `IF NOT EXISTS`, `club_id` para multi-tenant, RLS habilitado.

---

## 6. Plan de ejecución por fases

### Fase 0 — Prep (30 min)
- [ ] Clonar repo local actualizado.
- [ ] Verificar `npm install` y que `npm test` pasa antes de tocar nada.
- [ ] Crear branch base `feature/migration-base`.

### Fase 1 — Billing (2h, riesgo bajo)
**Branch:** `feature/billing`

- [ ] Copiar `Billing.html`, `Pricing.html`, `Plan Picker.html`, `tweaks-panel.jsx` a raíz del repo.
- [ ] Ejecutar `migrations/016_billing_plans.sql` en Supabase dev.
- [ ] Wirearlos con Supabase (reemplazar mock data por queries reales).
- [ ] Agregar link en `BillingPanel` de `settings-drawer.jsx`.
- [ ] Crear test e2e `tests/e2e/billing.spec.js` (smoke test: login → /Billing.html → ver plan).
- [ ] PR + merge a `main`.

### Fase 2 — Rehab Planner (3h, riesgo medio)
**Branch:** `feature/rehab-planner`

- [ ] Copiar `Rehab & Preventives.html`, `Rehab Planner.html`, `rehab-planner.{js,css,jsx}`, `block-drawer.{js,css}`, `plans-overview.css`.
- [ ] Ejecutar `migrations/017_rehab_protocols.sql`.
- [ ] Validar que NO rompe el módulo Injuries existente (FK compatibles).
- [ ] Wirear con Supabase.
- [ ] Agregar entrada en `assets/sidebar.js` (grupo Medical).
- [ ] Test e2e.
- [ ] PR + merge.

### Fase 3 — Individual Planner (4h, riesgo alto)
**Branch:** `feature/individual-planner`

- [ ] Copiar `Individual Planner.html`, `Individual Plans.html`, `individual-planner.{js,css,jsx}`.
- [ ] Verificar acoplamiento con `Planner.html`, `Daily Planning.html`, `Gym Planner.html`.
- [ ] Ejecutar `migrations/018_individual_plans.sql`.
- [ ] Wirear con Supabase (`players`, `gym_exercises`).
- [ ] Agregar entrada en `assets/sidebar.js` (grupo Performance).
- [ ] Test e2e.
- [ ] PR + merge.

### Fase 4 — Lineup Builder (2-3h, riesgo medio)
**Branch:** `feature/lineup-builder`

- [ ] Auditar el schema actual de `lineups` (`008_lineups.sql`, `009_lineups_extras.sql`) — ¿soporta formación + posiciones xy + status + staff?
- [ ] Copiar `Lineup.html`, `lineup.{js,css}`, `lineup-tweaks.jsx`, `image-slot.js`.
- [ ] Ejecutar `migrations/019_lineups_v2.sql` (solo `ALTER TABLE` + tablas auxiliares — NO recrea las viejas).
- [ ] Wirear con Supabase: reemplazar las 3 constantes hardcoded (`STARTERS`, `SUBSTITUTES`, `STAFF`) en `lineup.js` por queries a `lineup_players` y `lineup_staff`.
- [ ] Auto-cargar banner desde `matches` + `microcycles` (vista `v_next_match_lineup`).
- [ ] Persistir cambios con debounce 500ms; publicar (`status='official'`) postea a `#match-day`.
- [ ] Agregar entrada en `assets/sidebar.js` (grupo Technical, después de Squad).
- [ ] Validar que el botón "Descargar PNG" funciona (CSP debe permitir jsDelivr, o alojar `html2canvas` local).
- [ ] Test e2e.
- [ ] PR + merge.

### Fase 5 — Hardening (1h)
- [ ] Actualizar `Arquitecture.md` con las 8 pantallas.
- [ ] Actualizar `docs/COMPONENT_MAP.md`.
- [ ] Correr `npm test` completo.
- [ ] Smoke test manual de las 8 pantallas en dev.
- [ ] Generar auditoría rápida (estilo `audit-2026-05-21/`).

---

## 7. Reglas de migración (alineadas con CLAUDE_RULES.md del repo)

1. **NO tocar CSS de archivos existentes.** Las pantallas nuevas traen su propio CSS.
2. **NO reescribir archivos.** Modificaciones quirúrgicas en `sidebar.js` y `settings-drawer.jsx` únicamente.
3. **Reusar helpers:** `requireAuth()`, `getClubId()`, `getProfile()`, `getClub()`, `window.sb`.
4. **Multi-tenant:** toda query nueva DEBE filtrar por `club_id`.
5. **RLS:** toda tabla nueva DEBE tener policy de RLS antes de mergear.
6. **Tests:** mínimo un smoke test e2e por feature.

---

## 8. Rollback

Cada feature está en su branch. Si algo rompe:

```bash
git checkout main
git revert <commit-de-merge>
git push
```

Y rollback de SQL:
```sql
-- Cada migración debe tener su pareja:
-- 016_billing_plans_rollback.sql
-- 017_rehab_protocols_rollback.sql
-- 018_individual_plans_rollback.sql
```

(Stubs en `sql-migrations/rollback/`)

---

## 9. Checklist final pre-merge a `main`

Para cada PR:
- [ ] CI verde (Playwright)
- [ ] Login y navegación a la pantalla nueva funciona
- [ ] No hay errores de consola
- [ ] RLS validado (probar con dos clubs distintos)
- [ ] No hay queries sin `club_id`
- [ ] No hay hardcoded data en producción
- [ ] Sidebar muestra la pantalla nueva en el grupo correcto
- [ ] CHANGELOG o nota en el PR sobre qué se agregó

---

## 10. Contacto / notas

- Diseño de las 7 pantallas: completo en proyecto ClavaMetrics Design System.
- Si necesitás revisar visualmente una pantalla antes de migrarla, abrir el HTML correspondiente en `migration-package/files-to-add/` en un browser.
- Las pantallas son self-contained (sidebar hardcoded) — no rompen si el `sidebar.js` global no las contempla todavía.
