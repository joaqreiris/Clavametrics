# Prompt 04 — Lineup Builder (STANDALONE)

> Usá este prompt si **NO** corriste las Fases 1, 2 o 3 todavía.
> La Fase 4 (Lineup) es lo suficientemente aislada como para mergearse sola.
>
> Si sí hiciste las fases previas → usá `04-lineup.md` (la versión normal).

---

Copiá y pegá esto como primer mensaje a Claude Code en VSCode:

```
Hola. Vamos a integrar UNA pantalla nueva al repo Clavametrics:
el "Lineup Builder" (armado oficial de convocatorias). Toda la
preparación + ejecución va en este mismo mensaje.

REGLAS:
- NO reescribir archivos existentes (`clavametrics.css`,
  `settings-drawer.jsx`, etc).
- Modificaciones quirúrgicas: solo `assets/sidebar.js` y los
  archivos nuevos.
- Reutilizar helpers de `supabase-init.js`.
- Multi-tenant: toda query nueva filtra por `club_id`.
- RLS: toda tabla nueva con policies.

PASO 0 — Prep:
1. `git status` — repo limpio.
2. `npm test` — baseline verde antes de tocar nada.
3. Confirmá que estos archivos YA existen en main:
   - `clavametrics.css`
   - `migrations/008_lineups.sql`
   - `migrations/009_lineups_extras.sql`
   - `migrations/014_microcycle_publish_state.sql`
   - `assets/sidebar.js`
   - `supabase-init.js` con `requireAuth()`, `getClubId()`
   Si alguno falta, parar y avisar.

PASO 1 — Branch:
Crear `feature/lineup-builder` desde main.

PASO 2 — Auditoría de acoplamiento (NO copies archivos todavía):
Leé y devolveme un resumen de:
- `Squad.html` (estructura, sidebar usado, sample data)
- `Calendar.html` (cómo lee microcycles y "next match")
- `migrations/008_lineups.sql` y `009_lineups_extras.sql`
  (qué tablas ya existen: probablemente `lineups`, `lineup_players`)
- `migrations/014_microcycle_publish_state.sql`
  (forma de la tabla `microcycles`)
- ¿Existe una tabla `matches` con `kickoff_at`, `opponent_name`,
  `venue`, `is_home`, `competition`, `microcycle_id`?
  Si no, hay que crearla o adaptarla.

Pregunta clave: ¿el schema actual de `lineups` (008/009) soporta:
  (a) Formación nombrada (4-3-3, 4-4-2, etc) + posiciones (x_pct, y_pct)
  (b) Separación titular / suplente
  (c) Capitán + vice
  (d) Vínculo a `match_id` y/o `microcycle_id`
  (e) Estados draft / locked / official / archived

Si la respuesta a CUALQUIERA es "no", aplicamos la migración del
PASO 4. Si todo está, SKIP del PASO 4 y reutilizá lo existente.

PASO 3 — Copiar archivos desde `migration-package/files-to-add/`
hacia la raíz del repo:
- Lineup.html
- lineup.js
- lineup.css
- lineup-tweaks.jsx
- image-slot.js
- tweaks-panel.jsx        ← dependency de lineup-tweaks.jsx
                            (si ya existe en main, NO sobreescribir;
                             diff para confirmar que son compatibles)

NO copies nada más.

PASO 4 — Migración SQL (condicional según PASO 2):
- Revisá `migration-package/sql-migrations/019_lineups_v2.sql`.
- Ajustá según lo que ya exista en 008/009. La migración 019 es
  IDEMPOTENTE (todo `ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF
  NOT EXISTS`) — corre sin romper datos viejos.
- Aplicar en Supabase dev.
- Copiar a `migrations/019_lineups_v2.sql`.

Si el schema ya soporta todo, NO crees la migración. Comentalo en
el PR.

PASO 5 — Wirear con Supabase:
Reemplazar las 3 constantes hardcoded del top de `lineup.js`:

  const STARTERS = [...]      → query a `lineup_players`
                                  WHERE lineup_id = current
                                  AND role = 'starter'
                                  ORDER BY slot_index
  const SUBSTITUTES = [...]   → idem, role = 'substitute'
  const STAFF = {...}         → query a `lineup_staff`
                                  (tabla nueva en 019)

  const FORMATIONS = {...}    → MANTENER hardcoded (es layout puro,
                                  no cambia por club)

Patrón sugerido:
  const { matchId, lineupId } = await getNextLineupContext(clubId);
  const starters = await loadLineupPlayers(lineupId, 'starter');
  const subs     = await loadLineupPlayers(lineupId, 'substitute');
  const staff    = await loadLineupStaff(lineupId);
  state.starters = starters; state.subs = subs; renderAll();

PASO 6 — Auto-carga del banner desde microciclo:
El bloque `.lu-mc` en `Lineup.html` está hardcoded con MC 14 vs
Atlético. Reemplazá los valores por los del próximo match del club:

Query usando la vista creada en 019:
  SELECT * FROM v_next_match_lineup WHERE club_id = $1;

Mapeo:
  .lu-mc-cycle           → "Microciclo {microcycle_number} · {start} → {end}"
  .lu-mc-title (rival)   → opponent_name + opponent_branding.crest_url
                             (fallback al placeholder si no hay crest)
  .lu-mc-meta items      → kickoff_at, venue, is_home, competition
  [data-countdown]       → días entre now() y kickoff_at

PASO 7 — Persistencia del lineup:
El composer debe:
  (a) Crear lineup nuevo si no existe para el match_id (status='draft').
  (b) Guardar con debounce 500ms cada drag/drop o cambio de formación.
  (c) Botón "Enviar a #match-day" → UPDATE lineups SET status='official'
      → trigger `stamp_lineup_publish` setea published_at + published_by
      → opcionalmente INSERT en `chat_messages` (canal #match-day)
        con el lineup link + thumbnail.

PASO 8 — Sidebar:
En `assets/sidebar.js`, en el grupo "Technical", agregar DESPUÉS de
"Squad":

  { href: 'Lineup.html', icon: 'ti-clipboard-check',
    label: 'Lineup', count: 'XI' },

PASO 9 — Crest del club:
Los `<img class="pst-crest" src="assets/sample-club-crest.png">`
deben leer de `club_branding.crest_url` del club logueado. Si no
hay `club_branding` para ese club, mostrar el placeholder.

Para el rival: `opponent_branding.crest_url` matching por
`opponent_name`. Si no hay match, dejar placeholder + permitir
upload via `<image-slot>`.

PASO 10 — Tests (Playwright):
`tests/e2e/lineup.spec.js`:
- login → /Lineup.html
- ver banner con next match del club logueado (NO MC 14 hardcoded)
- cambiar formación a 4-4-2 → ver 11 spots reorganizados en el campo
- cambiar estilo a "Stadium" → background grass aparece
- click "Descargar PNG" → archivo .png descargado
- click "Enviar a #match-day" → lineup.status = 'official' en DB

PASO 11 — Validación CRÍTICA antes de PR:
- Squad.html sigue funcionando (no toqué su archivo).
- Calendar.html sigue funcionando.
- Hub.html y Load Monitor.html siguen leyendo microciclos OK.
- No hay errores de consola en Lineup.html.
- RLS validada: usuario de Club A no ve lineups de Club B.

PASO 12 — PR:
Título: "feat(lineup): add official lineup builder + microcycle
auto-sync + migration 019"

Body del PR:
- Qué se agregó (5 archivos nuevos + 1 migration SQL + 1 línea en
  sidebar.js).
- Resumen de la auditoría del PASO 2.
- Si NO se aplicó 019 porque el schema viejo era suficiente,
  explicarlo.

PASO 13 — Post-merge:
- Agregar Lineup.html en `Arquitecture.md` (grupo Technical).
- Documentar `lineup_staff`, `club_branding`, `opponent_branding`
  en el modelo de datos / COMPONENT_MAP.
```

---

## Qué hace este prompt distinto del normal

- Incluye el PASO 0 de prep adentro (no requiere haber corrido `00-prep.md`).
- Copia `tweaks-panel.jsx` explícitamente (la Fase 1 lo traía).
- Más detalle en el wireado de Supabase, porque no asumimos que las fases previas ya hayan agregado el patrón.
- Más explícito sobre dependencias (verifica `assets/sidebar.js`, `supabase-init.js`, etc).

Si después querés volver a hacer Billing / Rehab / Individual Planner, podés correr las fases 1-3 en cualquier orden — son independientes entre sí.
