# Prompt 03 — Fase 3: Individual Planner

```
Fase 3 — la más delicada. Individual Planner toca el módulo Planner
(132KB) que es core del producto.

Verificá ANTES:
- Fase 1 y 2 mergeadas a main.
- main actualizado.
- npm test verde.

PASO 1 — Branch:
- Crear `feature/individual-planner` desde main.

PASO 2 — Auditoría de acoplamiento (NO copies archivos todavía):
Leé y devolveme un resumen de:
- `Planner.html` (estructura, qué tablas usa)
- `Daily Planning.html`
- `Gym Planner.html`
- `migrations/008_lineups.sql` y `009_lineups_extras.sql`
- `migrations/014_microcycle_publish_state.sql`

Pregunta clave: ¿el "individual planner" se solapa con el "planner"
general o es realmente para sesiones 1-on-1?

Una vez tengamos el mapa claro, seguimos.

PASO 3 — Copiar archivos desde `migration-package/files-to-add/`:
- Individual Planner.html
- Individual Plans.html
- individual-planner.js
- individual-planner.css
- individual-planner-tweaks.jsx

(block-drawer.* y tweaks-panel.jsx ya están en main por la Fase 2.)
(rehab-planner.css ya está en main por la Fase 2 — sí, Individual
Planner depende de él, mirá el <link> en el HTML.)

PASO 4 — Migración SQL:
- Revisá `migration-package/sql-migrations/018_individual_plans.sql`.
- Ajustar según auditoría (paso 2).
- Aplicar en Supabase dev.
- Copiar a `migrations/018_individual_plans.sql`.

PASO 5 — Wirear con Supabase:
(a) Individual Plans.html (overview):
- Lista de jugadores con plan individual asignado.
- Usar `players` JOIN `player_individual_assignments`.

(b) Individual Planner.html (editor):
- Cargar plan por player_id (param URL).
- Render de bloques desde `individual_plan_blocks`.
- Drag & drop usa block-drawer.js — wirear "save".

PASO 6 — Sidebar:
En `assets/sidebar.js`, en el grupo "Performance", agregar:

```javascript
{ href: 'Individual Plans.html', icon: 'ti-user-cog', label: 'Individual S&C' },
```

después de Gym planner.

PASO 7 — Tests:
`tests/e2e/individual-planner.spec.js`:
- login → /Individual Plans.html → seleccionar un jugador
- llegar a /Individual Planner.html
- agregar un bloque, guardar, recargar, ver que persiste

PASO 8 — Validación CRÍTICA:
- Verificar que Planner.html, Daily Planning.html, Gym Planner.html NO
  se rompieron.
- Crear/editar microciclo en Planner — debe funcionar igual que antes.
- npm test verde.

PASO 9 — PR:
Título: "feat(individual-planner): add individual S&C planner + plans
overview + migration 018"

Si en el paso 2 detectás que el Individual Planner duplica >50% del
Planner general, FRENÁ. Conviene refactorizar como extensión del
Planner en vez de pantalla aparte.

PASO 10 — Hardening final (post-merge):
- Actualizar `Arquitecture.md` con las 7 pantallas nuevas
- Actualizar `docs/COMPONENT_MAP.md` (block-drawer, tweaks-panel)
- Tag de release: `v1.x.0-rebrand-pages` (o el versionado que uses)
- Generar audit folder `audit-2026-XX-XX/` con resumen post-migración
```
