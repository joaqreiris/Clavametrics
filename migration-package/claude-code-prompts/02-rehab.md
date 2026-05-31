# Prompt 02 — Fase 2: Rehab Planner

```
Fase 2: Rehab & Preventives + Rehab Planner. Riesgo MEDIO porque se
acopla con el módulo Injuries existente.

Verificá ANTES de empezar:
- La Fase 1 (Billing) fue mergeada a main.
- main está actualizado en tu local.
- npm test pasa en main.

PASO 1 — Branch:
- Crear `feature/rehab-planner` desde main.

PASO 2 — Copiar archivos desde `migration-package/files-to-add/`:
- Rehab & Preventives.html
- Rehab Planner.html
- rehab-planner.js
- rehab-planner.css
- rehab-planner-tweaks.jsx
- block-drawer.js
- block-drawer.css
- plans-overview.css

PASO 3 — Auditoría de acoplamiento con Injuries:
Antes de wirear, leé:
- `migrations/012_injury_phases.sql`
- `migrations/013_injury_phases_evidence_based.sql`
- `Injuries.html` (las partes que tocan injury_phases)
- `Physio.html`

Devolveme un resumen de QUÉ TABLAS ya existen relacionadas a rehab y qué
falta crear. Esto evita duplicar.

PASO 4 — Migración SQL:
- Revisá `migration-package/sql-migrations/017_rehab_protocols.sql`.
- AJUSTÁ las tablas según el resumen del paso 3 (no dupliques lo que ya
  existe en injury_phases).
- Aplicar en Supabase dev.
- Copiar a `migrations/017_rehab_protocols.sql` ajustada.

PASO 5 — Wirear con Supabase:
(a) Rehab & Preventives.html (overview):
- Listar lesiones activas (`injuries` WHERE status='active') con su
  protocolo asignado.
- Listar rutinas preventivas del club.

(b) Rehab Planner.html (planificador detallado):
- Cargar protocolo por injury_id (parámetro URL).
- Render de bloques desde `protocol_blocks`.
- block-drawer.js maneja el drawer de bloques — wirear "save" para
  persistir en Supabase.

Usar SIEMPRE: `requireAuth()`, `getClubId()`, `window.sb`, filtrar
por club_id.

PASO 6 — Sidebar:
En `assets/sidebar.js`, en el grupo "Medical", agregar QUIRÚRGICAMENTE
(no reescribir el archivo):

```javascript
{ href: 'Rehab & Preventives.html', icon: 'ti-activity-heartbeat', label: 'Rehab & preventives', count: 0 },
```

después de la entrada de Physio.

PASO 7 — Test e2e:
`tests/e2e/rehab.spec.js`:
- login → /Rehab & Preventives.html → ver lista
- click una lesión → llega a /Rehab Planner.html con su protocolo

PASO 8 — Validación CRÍTICA:
- Abrir Injuries.html en dev y verificar que NADA se rompió.
- Probar crear/editar una lesión existente.
- npm test verde.

PASO 9 — PR:
Título: "feat(rehab): add rehab planner + preventives pages + migration 017"
Mencionar en la descripción cualquier ajuste hecho a la migración 017
respecto del stub original.

Si la auditoría del paso 3 revela que el módulo Injuries ya cubre 80%
de la funcionalidad de Rehab, FRENÁ y consultame — quizá no necesitamos
las 2 pantallas nuevas y conviene extender Injuries.
```
