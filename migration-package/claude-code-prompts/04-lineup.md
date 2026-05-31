# Prompt 04 — Fase 4: Lineup Builder

```
Fase 4 — agregamos la pantalla Lineup Builder (armado oficial de
convocatorias). Toca el módulo Squad (lo extiende, no lo reemplaza)
y depende de microcycles + players (que ya existen).

Verificá ANTES:
- Fase 1, 2 y 3 mergeadas a main.
- main actualizado.
- npm test verde.

PASO 1 — Branch:
- Crear `feature/lineup-builder` desde main.

PASO 2 — Auditoría de acoplamiento (NO copies archivos todavía):
Leé y devolveme un resumen de:
- `Squad.html` (estructura, sidebar usado)
- `Calendar.html` (cómo lee microcycles y next match)
- `migrations/008_lineups.sql` y `009_lineups_extras.sql` (qué tablas
  ya existen — probablemente `lineups`, `lineup_players` o similar)
- `migrations/014_microcycle_publish_state.sql` (forma de los microciclos)

Pregunta clave: ¿el schema actual de `lineups` (migrations 008/009)
soporta:
  (a) Formaciones nombradas (4-3-3, 4-4-2, etc) + posiciones (x, y)
      por jugador?
  (b) Separación titular / suplente / staff?
  (c) Capitán + vice?
  (d) Vínculo a un `match_id` o `microcycle_id`?
  (e) Estados draft / published / official?

Si la respuesta a CUALQUIERA de esas es "no", aplicamos
`019_lineups_v2.sql` que extiende el schema. Si todo está, NO
apliques 019 y reutilizá lo existente.

PASO 3 — Copiar archivos desde `migration-package/files-to-add/`:
- Lineup.html
- lineup.js
- lineup.css
- lineup-tweaks.jsx
- image-slot.js (si no está ya en main por las fases anteriores)

NO toques nada más. `clavametrics.css`, `tweaks-panel.jsx` y demás
ya están en main desde fases previas.

PASO 4 — Migración SQL (condicional):
- Si la auditoría del paso 2 muestra que el schema actual NO soporta
  el modelo nuevo:
  → Revisá `migration-package/sql-migrations/019_lineups_v2.sql`.
  → Ajustá según lo que ya exista en 008/009 (puede ser sólo ALTER
    TABLE para agregar columnas, no crear todo de cero).
  → Aplicar en Supabase dev.
  → Copiar a `migrations/019_lineups_v2.sql`.

- Si el schema actual ya soporta todo, agregá comentario en el PR
  explicando por qué no hay migración nueva.

PASO 5 — Wirear con Supabase:
Reemplazar todo el contenido hardcoded de `lineup.js` por queries
reales. Específicamente, las 4 constantes del top del archivo:

  const FORMATIONS    → mantenerlas hardcoded (son layout puro, no
                        cambian por club). OK como está.
  const STARTERS      → reemplazar por query a `lineup_players`
                        WHERE lineup_id = current
                        AND role = 'starter'
  const SUBSTITUTES   → idem, role = 'substitute'
  const STAFF         → query a `lineup_staff` (tabla nueva en 019)
                        o a `coaching_staff` si ya existe.

Helpers a usar (vienen de supabase-init.js, ya en el repo):
- `requireAuth()` para gate de auth
- `getClubId()` para filtrar multi-tenant
- `getNextMatch(clubId)` → debería existir o crearla:
    SELECT * FROM matches
    WHERE club_id = $1 AND kickoff_at > now()
    ORDER BY kickoff_at ASC LIMIT 1;
- `getMicrocycleByMatch(matchId)` → para auto-cargar el banner

PASO 6 — Auto-carga del banner desde microciclo:
El bloque `.lu-mc` en `Lineup.html` está hardcoded con datos del
MC 14. Reemplazá los valores por los del próximo `match` del club:

  - .lu-mc-cycle           → MC + número + fechas
  - .lu-mc-title (rival)   → match.opponent_name + crest
  - .lu-mc-meta items      → match.kickoff_at, match.venue,
                             match.competition, match.weather
  - [data-countdown]       → días desde now() a match.kickoff_at

PASO 7 — Persistencia del lineup:
El composer (`.lu-composer`) debe poder:
  (a) Crear un lineup nuevo para un match_id (status='draft').
  (b) Guardar cada drag/drop o cambio de formación con debounce 500ms.
  (c) Publicar (botón "Enviar a #match-day") → status='official'
      y dispara una entrada en `chat_messages` al canal #match-day.

PASO 8 — Sidebar:
En `assets/sidebar.js`, en el grupo "Technical", agregar DESPUÉS de
"Squad":

```javascript
{ href: 'Lineup.html', icon: 'ti-clipboard-check', label: 'Lineup', count: 'XI' },
```

PASO 9 — Export como imagen:
El botón "Descargar PNG" carga `html2canvas` dinámicamente desde
jsDelivr. Validá en producción que el CSP del repo permita
`cdn.jsdelivr.net` para scripts. Si no, alojar `html2canvas` local
en `vendor/html2canvas.min.js` y servir desde ahí.

PASO 10 — Tests:
`tests/e2e/lineup.spec.js`:
- login → /Lineup.html
- ver banner con next match (no MC 14 hardcoded — el del club)
- cambiar formación a 4-4-2 → ver 11 spots reorganizados
- cambiar estilo del póster a "Stadium" → ver background grass
- click "Descargar PNG" → verificar que se descarga un archivo .png

PASO 11 — Validación CRÍTICA:
- Verificar que Squad.html, Calendar.html, Match Reports.html NO se
  rompieron.
- Verificar que los datos de microciclo en Hub / Load Monitor /
  Availability siguen mostrándose igual (no cambiamos la tabla
  `microcycles`).
- npm test verde.

PASO 12 — PR:
Título: "feat(lineup): add official lineup builder + microcycle
auto-sync + migration 019"

PASO 13 — Hardening final (post-merge):
- Agregar Lineup.html en `Arquitecture.md` (grupo Technical).
- Si se creó `lineup_staff`, documentarla en COMPONENT_MAP o
  modelo de datos.
- Tag de release.
```

---

## Qué pasa en el paso 2 si las tablas viejas son insuficientes

Caso típico: `008_lineups.sql` tiene `lineups (id, match_id, formation_text, created_at)` y `lineup_players (lineup_id, player_id, position_text, jersey_number)` — funcional para listar nombres pero sin coordenadas x/y, sin status, sin staff, sin captain flag.

En ese caso, `019_lineups_v2.sql` hace:
- `ALTER TABLE lineups ADD COLUMN status text DEFAULT 'draft'`
- `ALTER TABLE lineups ADD COLUMN microcycle_id uuid REFERENCES microcycles(id)`
- `ALTER TABLE lineup_players ADD COLUMN role text` ('starter' | 'substitute')
- `ALTER TABLE lineup_players ADD COLUMN x_pct numeric, y_pct numeric`
- `ALTER TABLE lineup_players ADD COLUMN is_captain bool DEFAULT false`
- `ALTER TABLE lineup_players ADD COLUMN is_vice bool DEFAULT false`
- `CREATE TABLE lineup_staff (...)` (si no existe coaching_staff genérica)

Adaptá el SQL en función de lo que reportes en el paso 2.
