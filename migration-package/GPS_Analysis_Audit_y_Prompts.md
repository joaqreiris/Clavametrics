# GPS Analysis — Audit + Prompts para Claude Code

Documento de trabajo para la pestaña **GPS Analysis** de ClavaMetrics.
Generado en base a: `GPS Analysis.html`, `CLAUDE_RULES.md`, `database_schema.md`, papers de sport science (Gabbett, Halson, Akenhead, Buchheit) y referencias de Catapult / StatSports / Lumin Sports.

---

## 1 · AUDIT EXHAUSTIVO

### 1.1 · Lo que ya funciona

- Tab switching (Individual / Group / Match·ind / Match·grp).
- Toggle Edit layout (visual outline en cards).
- Size toggle S/M/L/FULL en cada card (cambia `data-size`).
- Drawer Data sources (abrir/cerrar).
- Carga real desde Supabase: `players`, `training_sessions`, `gps_reports`.
- Cálculo de Z-scores y radar Chart.js.
- Update dinámico de KPIs Individual + tabla Group + totales.

### 1.2 · Botones / controles **sin funcionalidad**

| # | Selector / texto | View | Estado | Qué debería hacer |
|---|---|---|---|---|
| B1 | `.gp-bar .right .gp-src-btn` "Data sources · 4 connected" | Topbar | ✅ Abre drawer | OK |
| B2 | `.gp-bar .right .cm-btn` **Export** | Topbar | ❌ Muerto | Modal con export: PDF report, CSV (filas = jugador × métrica), PNG dashboard, link compartible. Respeta filtros activos. |
| B3 | `.gp-dash-bar .pill` **MC 14** | Filter bar (4 views) | ❌ Muerto | Popover con lista de microciclos disponibles (`training_sessions` agrupados por semana ISO). Selecciona → re-fetch + recálculo. |
| B4 | `.gp-dash-bar .pill` **F. Domínguez** | Filter bar | ❌ Muerto | Popover con search + lista de jugadores activos del club. Selecciona → filtra Individual / Match·ind. |
| B5 | `.gp-dash-bar .pill` **vs Role** | Filter bar | ❌ Muerto | Toggle: vs Role baseline / vs Squad average / vs Player's own history / vs Match peak. Recalcula z-scores. |
| B6 | `.gp-dash-bar .pill` **Saved views** | Filter bar | ❌ Muerto | Dropdown: "Save current layout", lista de layouts guardados (localStorage o tabla `gps_layouts`). |
| B7 | `.gp-dash-bar .pill` **Add card** | Filter bar | ❌ Muerto | Mismo flow que `.gp-add`. Abre catálogo de cards. |
| B8 | `.gp-add` "Add card" (4 instancias, una por view) | Cada view | ❌ Muerto | Modal con catálogo de cards disponibles por view, agrupado por familia (KPI / Chart / Spatial / Comparison). |
| B9 | `.gp-c-h .right > button` con `ti-dots` (en cada card, ~20) | Todas | ❌ Muerto | Menú contextual: Duplicate, Configure metric, Change chart type, Export this card, Remove. |
| B10 | `.gp-c-h .right > button` con `ti-arrows-sort` (Z-score matrix) | Group | ❌ Muerto | Sort por columna ascendente/descendente al click en headers. |
| B11 | `.gp-c-pick` (todos los chips con chevron, ~10) | Varias cards | ❌ Muerto | Popover con opciones (metric selector, microcycle selector, viz mode S/M/L/FULL). Cambia configuración de esa card. |
| B12 | `.gp-src-btn` "4 connected" counter | Topbar | ⚠️ Hardcoded | Debe contar `gp-conn-status.ok` reales del drawer (4 fijos hoy → dejarlo como provider count cuando esté integrado). |
| B13 | `.cm-btn is-outline` **Browse files** (drawer) | Drawer | ❌ Muerto | Input file hidden, on change → preview de columnas + mapping a campos `gps_reports`. |
| B14 | `.cm-btn is-ghost` **Download template** (drawer) | Drawer | ❌ Muerto | Genera y descarga `.csv` con headers correctos para mapping. |
| B15 | `.cm-btn is-outline` **Sync now** (drawer) | Drawer | ❌ Muerto | Loading state + simula refetch (futuro: hit webhook endpoint). |
| B16 | `.cm-btn is-ghost` **Webhook settings** (drawer) | Drawer | ❌ Muerto | Modal con URL del webhook + secret + provider selector. |
| B17 | `.gp-conn` cards de providers (StatSports, Catapult, Polar, WIMU, GPSports, CSV) | Drawer | ❌ Muerto | Click → modal de connect / reconnect / configure. |
| B18 | `.hub-search input` | Topbar | ❌ Muerto | Search global ya tiene `global-search.js` — verificar si funciona; si no, conectar. |
| B19 | `.cm-icon-btn` `ti-bell` | Topbar | ❌ Muerto | Notificaciones (probable que sea global, no de esta pestaña). |
| B20 | `.gp-sec .sub` subtítulos en tabs | Tabs | ⚠️ Estáticos | Deberían reflejar selección actual (ej: "MC 14 · 22 players") al cambiar filtros. |

### 1.3 · Lo que falta a nivel de **datos**

- No hay tabla / columna para **microciclos**. Los training_sessions existen pero no están agrupados por microciclo.
- Faltan datos ficticios suficientes para comparar microciclos (necesitamos ~6–8 MCs × 22 jugadores × ~5 sesiones).
- No hay `gps_reports.session_phase` (MD-4/MD-3/MD-2/MD-1/MD/MD+1) — necesario para todo el análisis de microciclo.
- No hay distinción entre training_session y match dentro de `gps_reports` (se infiere por `session_type` pero no está validado en queries).
- No existe seed script para poblar la DB.

### 1.4 · Lo que falta a nivel de **visualizaciones** (gaps vs. sport science profesional)

Cards que **deberían existir** pero no están (referencias: Gabbett 2016, Halson 2014, Akenhead & Nassis 2016, Buchheit, Catapult Vector, StatSports Sonra):

**Individual:**
- ACWR chart (Acute:Chronic Workload Ratio) con sweet spot 0.8–1.3, danger >1.5.
- Banister / Calvert fitness-fatigue model (TSB = CTL − ATL).
- Weekly progression vs personal baseline (no solo vs role).
- Velocity zones distribution (5 zonas standard).
- Accel/Decel asymmetry (carga mecánica).
- Sprint count by speed band (>21, >24, >27 km/h).

**Group:**
- Microcycle calendar heatmap (filas = jugadores, columnas = días, color = % vs match).
- Box plot por posición.
- Outlier detection card (z >|2|).
- Position comparison radar (CB vs MF vs WG vs ST).
- Squad readiness score (combina GPS + wellness + RPE).

**Match · individual:**
- Velocity profile (line chart de speed a lo largo del partido).
- Sprint heatmap zonal (no solo blobs, sino grid 6×4).
- 1st half vs 2nd half drop-off (% caída por métrica).
- Recovery time between high-intensity efforts.

**Match · group:**
- Match demands vs training delivered (% de gap).
- Distance covered by phase of play (in/out of possession).
- Team formation heatmap superpuesto al campo.

---

## 2 · PROMPT 1 — Reparar botones muertos

**Cuándo usarlo**: como primera intervención. Activa todo lo que ya existe en HTML pero no tiene listeners.

```
Tarea: dar funcionalidad a botones muertos en GPS Analysis.html del repo Clavametrics.

LEE PRIMERO Y RESPETA: CLAUDE_RULES.md. Reglas críticas que aplican:
- Modificación quirúrgica, no reescribir el archivo.
- No tocar CSS existente.
- Reutilizar window.sb / requireAuth / getClubId.
- JS vanilla, sin frameworks nuevos.
- Respuesta corta al final: qué cambió, archivos tocados, problemas.

ARCHIVO ÚNICO A MODIFICAR: GPS Analysis.html

CONTEXTO YA CONOCIDO (no releer):
- Body usa class="cm", data-theme="hybrid".
- Cards = .gp-c con [data-size="sm|md|lg|full"].
- Views = .gp-view[data-view="ind|grp|mind|mgrp"]. Solo una con .is-on.
- Section switching y size-toggle YA funcionan (líneas 765-793). No tocar.
- Drawer Data sources YA funciona (líneas 794-801). No tocar.
- Supabase: tablas players, training_sessions, gps_reports, rpe, wellness. Todas filtradas por club_id.

BOTONES A ACTIVAR (TODOS dentro del mismo <script> existente al final):

1) Topbar Export button (.gp-bar .cm-btn con texto "Export"):
   - Al click: abrir popover anclado debajo con 4 opciones:
     · "PDF report" (placeholder console.log por ahora)
     · "CSV · current view" → genera CSV con datos cargados de la view activa
     · "PNG snapshot" (placeholder)
     · "Share link" (placeholder, copy a clipboard del location.href)
   - Estilos: usa .gp-c-pick existentes para items, fondo var(--cm-surface), border var(--cm-border), box-shadow var(--cm-shadow-2).

2) Dashboard bar pills (.gp-dash-bar .pill que NO sean #editToggle):
   - Pill "MC 14" → popover con lista de microciclos. Query: training_sessions WHERE club_id agrupado por week de session_date, mostrar últimos 10. Estado: guardar microciclo seleccionado en window.gpState.microcycle.
   - Pill con nombre jugador → popover con search + lista. Query: players WHERE club_id AND status != 'inactive' ORDER BY last_name. Guardar en window.gpState.playerId. Al cambiar, re-renderizar Individual y Match·ind.
   - Pill "vs Role" → toggle entre 4 modos: "vs Role" | "vs Squad" | "vs Self (28d)" | "vs Match peak". Guardar en window.gpState.baseline.
   - Pill "Saved views" → popover con "Save current layout..." (prompt + guarda en localStorage key cm_gps_layouts) + lista de layouts guardados. Al click en uno, restaura tamaños de cards.
   - Pill "Add card" → abre el mismo modal del punto 3.

3) .gp-add buttons (4 instancias, una en cada view):
   - Al click: abrir modal centrado con catálogo de cards. Catálogo hardcoded por view:
     · ind: ["Distance KPI","HSR KPI","Sprints KPI","Radar profile","x match max","Weekly bars","ACWR chart","Speed zones","Accel/Decel asym","Personal baseline trend"]
     · grp: ["Z-score matrix","Squad ranking","Load vs HSR scatter","Team heatmap","Position box plot","Outliers card","Position radar","Squad readiness"]
     · mind: ["Match heatmap","Distance per min","Velocity profile","Sprint zonal grid","Halves drop-off","Recovery between sprints"]
     · mgrp: ["Total distance","HSR squad","Sprints","Us vs opponent","Team heatmap","Match vs training delivered"]
   - Al seleccionar un item: inserta un <div class="gp-c" data-size="md"> con header genérico (título = item) + cuerpo placeholder "Configure metric →" + size-toggle + dots button. Insertar ANTES del propio .gp-add (que siempre queda al final).
   - El size-toggle del nuevo card debe quedar enganchado al listener existente — reusar el código de líneas 787-793, hacerlo idempotente o exportar a función init() y llamarla tras agregar.

4) .gp-c-h .right > button con icono ti-dots (~20 instancias):
   - Delegar evento desde document.querySelector('.gp-page') con e.target.closest('[data-action="card-menu"]') si agregás data-action, o detecta via icon ti-dots.
   - Al click: popover anclado al botón con: "Duplicate", "Change metric", "Change viz", "Export CSV", "Remove".
   - "Duplicate" → clona el .gp-c y lo inserta después.
   - "Remove" → eliminá el .gp-c.
   - Resto: console.log por ahora con TODO comment.

5) Z-score matrix sort button (.gp-c en Group con icon ti-arrows-sort):
   - Al click: rota entre sort por columna activa (default = Player asc → Player desc → Distance desc → HSR desc → ... → vuelta).
   - Implementá orderBy en JS sobre el array `reports` que ya existe en el script async, y re-renderizá el tbody.

6) .gp-c-pick chips con chevron (todos):
   - Delegar click. Al click: popover con opciones según el contexto del chip.
   - Para "Role/Squad/Self" chips → mismo set que pill "vs Role" del punto 2.
   - Para "MC 14 vs MC 13" → selector de comparación MC actual + MC anterior.
   - Para "Bars/Lines" → toggle de viz mode.
   - Para "Player load/HSR/Distance" → metric selector.
   - Al cambiar: actualizá el texto visible y disparar event 'gp:cardconfig' (no es necesario re-render real todavía si los datos no existen — dejar comment TODO).

7) Drawer Data sources buttons:
   - "Browse files" → crea input type="file" hidden, click(), on change → console.table con primeras 3 filas parseadas (papaparse NO, usar split simple). Mostrar nombre del archivo en el drawer.
   - "Download template" → genera blob CSV con headers: player_name,session_date,total_distance,high_speed_distance,sprint_distance,accelerations,decelerations,max_speed,player_load. Download como gps_template.csv.
   - "Sync now" → toggle clase .is-loading en el botón 1.5s (simulación). Toast al final.
   - "Webhook settings" → modal placeholder con un input readonly mostrando "https://api.clavametrics.app/webhooks/gps/{club_id}".

8) .gp-conn cards (providers en drawer):
   - Click en cualquier .gp-conn → toast / log "Connect flow → coming soon". Wrappear en function para extender después.

UTILIDADES A CREAR (al inicio del bloque script existente):

- function makePopover(anchor, items, onSelect): crea div absoluto debajo de anchor, agrega items como botones, gestiona outside-click para cerrar, devuelve handle.
- function makeModal(title, content): crea modal centrado con overlay, gestiona close.
- function showToast(msg): div bottom-right, fade out 2.5s.
- window.gpState = { microcycle, playerId, baseline, view }: estado global. Default a valores actuales de UI.

ESTILOS PERMITIDOS:
- Solo agregar al <style> existente lo MÍNIMO necesario para popover/modal/toast.
- Reutilizar var(--cm-*) tokens. No introducir colores nuevos.
- Clases nuevas deben ir con prefijo .gp- consistente con el resto.

NO HAGAS:
- No agregar dependencias.
- No modificar CSS de cards/grid/tabs existente.
- No reescribir el async IIFE de datos — extendelo si necesitás.
- No tocar otros HTML files.

AL TERMINAR responde solo:
- Líneas modificadas (rango).
- Funciones agregadas (lista).
- Botones que quedaron con TODO y razón.
- 1 frase con el siguiente paso sugerido.
```

---

## 3 · PROMPT 2 — Sport scientist features + datos ficticios

**Cuándo usarlo**: después del Prompt 1, cuando los botones ya respondan. Este prompt agrega lógica científica y datos para testear.

```
Tarea: convertir GPS Analysis en una herramienta de sport scientist profesional, con datos ficticios para testing y nuevas visualizaciones basadas en literatura científica.

LEE PRIMERO: CLAUDE_RULES.md, database_schema.md. Aplican todas las reglas de modificación quirúrgica.

ARCHIVOS A TOCAR:
- GPS Analysis.html (extensión del script existente, nuevas cards)
- assets/gps-seed.sql (NUEVO, script de seed)
- assets/gps-science.js (NUEVO, módulo de cálculos científicos)

═══════════════════════════════════════════
PARTE A — SEED ADAPTATIVO (NO HARDCODED)
═══════════════════════════════════════════

CRÍTICO: NO inventar jugadores, posiciones, ni club_ids. El seed debe LEER la DB real primero
y adaptarse a lo que ya existe. Si la DB está vacía o incompleta, el seed debe avisar y abortar
limpiamente, NO crear datos genéricos.

ENFOQUE: NO es un archivo .sql estático. Es un script Node.js (assets/gps-seed.mjs) que:
  1) Lee la DB real vía @supabase/supabase-js con SERVICE_ROLE_KEY (pedirla por env var).
  2) Calcula qué hace falta.
  3) Inserta sólo lo necesario, idempotente.

PASO 1 — Inspección de la DB (el script debe correr esto y mostrar al usuario):

```js
// Inspección obligatoria antes de cualquier insert
const { data: clubs } = await sb.from('clubs').select('id, name');
const { data: players } = await sb.from('players')
  .select('id, first_name, last_name, position, status, club_id')
  .neq('status', 'inactive');
const { data: sessions } = await sb.from('training_sessions')
  .select('id, club_id, title, session_date, session_type')
  .order('session_date', { ascending: false });
const { data: gpsReports } = await sb.from('gps_reports')
  .select('id, club_id, player_id, session_id', { count: 'exact' });

// Imprimir reporte
console.log(`Clubs: ${clubs.length}`);
console.log(`Players por club: ...`);
console.log(`Sessions existentes: ${sessions.length}`);
console.log(`GPS reports existentes: ${gpsReports.length}`);
console.log(`Posiciones encontradas: ${[...new Set(players.map(p=>p.position))]}`);
```

Pedirle al usuario CONFIRMACIÓN (CLI prompt) antes de seguir, con un resumen tipo:
```
Club: Clava FC (uuid: ...)
Players activos: 24
  - GK: 3, CB: 5, FB: 4, MF: 6, WG: 3, ST: 3
Training sessions actuales: 12 (más reciente: 2025-...)
GPS reports actuales: 47

Voy a generar: 8 microciclos retroactivos × ~6 sesiones cada uno (48 nuevas sessions).
GPS reports nuevos estimados: 48 sesiones × ~22 players = ~1056 filas.

¿Continuar? (y/N)
```

PASO 2 — Mapeo dinámico de posiciones:

El script debe descubrir las posiciones REALES en la DB (pueden ser "GK"/"CB"/"MID"/"DEL" o
"Goalkeeper"/"Defender"/..., depende de cómo las haya cargado el usuario). Implementar
normalización:

```js
function normalizePosition(rawPos) {
  const p = (rawPos || '').toLowerCase();
  if (/gk|goal|arq|portero/.test(p)) return 'GK';
  if (/cb|centre.back|central|def central/.test(p)) return 'CB';
  if (/fb|wb|full.back|wing.back|lateral/.test(p)) return 'FB';
  if (/mf|mid|volante|centrocamp/.test(p)) return 'MF';
  if (/wg|wing|extremo|winger/.test(p)) return 'WG';
  if (/st|cf|striker|forward|delantero|9/.test(p)) return 'ST';
  return 'MF'; // fallback si no reconoce
}
```

Mostrar el mapeo al usuario antes de seguir.

PASO 3 — Estructura de microciclos (sólo si confirma):

- 1 MC = 7 días: Sun(MD+1 recovery), Mon(off — no se inserta), Tue(MD-4), Wed(MD-3), Thu(MD-2), Fri(MD-1), Sat(MD/match).
- Generar 8 MCs retroactivos desde la fecha actual (o desde la última session existente + 1 día,
  lo que sea más reciente). Esto evita pisar datos reales del usuario.
- session_type valores: "Recovery"|"Conditioning"|"Tactical"|"Activation"|"Match" (verificar
  contra los valores que ya usa la DB; si la tabla tiene CHECK constraint distinto, abortar
  con instrucción de qué valores aceptar).
- title: "MC{N} · {phase}" donde phase = MD+1 / MD-4 / MD-3 / MD-2 / MD-1 / Match.
- Marcar todas las sessions seed con notes = "[SEED] MC{N}" para poder borrarlas con un
  DELETE WHERE notes LIKE '[SEED]%' si el usuario quiere revertir.

PASO 4 — Perfiles de carga por posición (referencia científica):

Valores ABSOLUTOS de match-day por posición (mediana, basados en Akenhead/Owen/Martín-García;
±15% noise gaussiano por sesión):

| Pos | Dist(m) | HSR(m) | Sprint(m) | Accel(n) | Decel(n) | TopSpd(km/h) | Load(AU) |
|-----|---------|--------|-----------|----------|----------|--------------|----------|
| GK  | 4500    | 100    | 30        | 18       | 16       | 22.0         | 280      |
| CB  | 9800    | 380    | 110       | 32       | 30       | 28.5         | 540      |
| FB  | 10800   | 720    | 240       | 42       | 38       | 31.0         | 620      |
| MF  | 11400   | 580    | 180       | 48       | 44       | 29.5         | 680      |
| WG  | 11000   | 920    | 380       | 38       | 35       | 32.0         | 640      |
| ST  | 10200   | 760    | 320       | 36       | 33       | 32.5         | 580      |

Multiplicadores por fase del microciclo (% del MD):

| Phase | Dist | HSR  | Sprint | Accel | Decel | TopSpd | Load |
|-------|------|------|--------|-------|-------|--------|------|
| MD+1  | 0.35 | 0.15 | 0.10   | 0.25  | 0.22  | 0.70   | 0.30 |
| MD-4  | 0.75 | 0.60 | 0.55   | 0.80  | 0.78  | 0.85   | 0.70 |
| MD-3  | 0.90 | 0.80 | 0.75   | 0.90  | 0.88  | 0.92   | 0.85 |
| MD-2  | 0.55 | 0.70 | 0.80   | 0.65  | 0.62  | 0.95   | 0.60 |
| MD-1  | 0.40 | 0.25 | 0.20   | 0.40  | 0.38  | 0.80   | 0.35 |
| MD    | 1.00 | 1.00 | 1.00   | 1.00  | 1.00  | 1.00   | 1.00 |

PASO 5 — Inserción:

- Por cada session generada, insertar 1 fila en gps_reports por cada player ACTIVO del club.
- Excepción: MD+1 → sólo insertar para 50% random de jugadores (los que jugaron el match).
- Excepción: Recovery (si existe esa fase) → sólo titulares.
- IDs nunca hardcodear: usar los uuid reales de players y de las sessions recién creadas.
- club_id: tomar del player.club_id, NO inventar.

PASO 6 — Anomalías deliberadas (para testing del dashboard):

Después del insert normal, aplicar 2 modificaciones específicas en jugadores reales:
- Tomar 1 player random de posición MF o WG → en MC 6 (penúltimo), aumentar su HSR y sprint
  un 80% extra → genera ACWR >1.5 detectable.
- Tomar 1 player random de posición FB o WG → en MC 3, REDUCIR su HSR un 40% en los MD-4 y
  MD-3 → simula caída pre-injury.

El script debe imprimir al final QUIÉN es cada anomalía (nombre + MC + métrica) para que el
usuario sepa qué buscar en el dashboard.

PASO 7 — Validación y rollback:

Al final, ejecutar:
```js
const { count: newSessionsCount } = await sb.from('training_sessions')
  .select('id', { count: 'exact', head: true })
  .like('notes', '[SEED]%');
const { count: newReportsCount } = await sb.from('gps_reports')
  .select('id', { count: 'exact', head: true })
  .gte('created_at', startTime);
console.log(`✓ Insertadas ${newSessionsCount} sessions y ${newReportsCount} gps_reports.`);
console.log(`Para revertir: DELETE FROM training_sessions WHERE notes LIKE '[SEED]%' CASCADE;`);
```

EJECUCIÓN POR EL USUARIO:

El script se corre desde terminal, no desde el browser. Generar también un README mini con:
```bash
cd Clavametrics
export SUPABASE_URL="https://xesrumijvdmqjrufgeka.supabase.co"
export SUPABASE_SERVICE_KEY="<service_role_key del dashboard de Supabase>"
node assets/gps-seed.mjs
```

NOTA SOBRE SERVICE KEY: el script DEBE usar service_role (no la publishable). Avisar al
usuario que la service key NO va al repo, sólo a su shell local.

SI NO HAY DATOS SUFICIENTES:
- Si players activos < 11: abortar con mensaje "Necesitás al menos 11 jugadores activos.
  Ejecutá primero el seed de Squad o cargá jugadores desde la UI."
- NO crear jugadores ficticios desde este script.

═══════════════════════════════════════════
PARTE B — MÓDULO DE CÁLCULOS (gps-science.js)
═══════════════════════════════════════════

Exportar en window.gpScience (vanilla, sin imports):

1) acwr(playerReports, weeks={acute:1, chronic:4}, method='rolling'):
   - acute = suma o avg últimos 7d.
   - chronic = avg últimos 28d (rolling) o EWMA con lambda=2/(N+1).
   - return { acwr, acute, chronic, flag: 'safe'|'sweet'|'danger' } con cortes 0.8 / 1.5.

2) ewma(values, lambda):
   - exponentially weighted moving average. Devuelve array.

3) zScore(value, populationArr):
   - return (value - mean) / stddev.

4) trainingStressBalance(ctl, atl): TSB = CTL − ATL. Banister fitness-fatigue.

5) velocityZones(speedSeriesKmh): clasifica en 5 zonas (Z1<6, Z2 6-12, Z3 12-15.5, Z4 15.5-19.8, Z5>19.8). Devuelve {z1_dist, z2_dist, ..., z5_dist} en metros.

6) microcycleProfile(playerReports, byPhase):
   - agrupa reports por phase (MD+1, MD-4, ..., MD) y devuelve avg de cada métrica.

7) baselineByRole(allReports, position, metric):
   - devuelve mean + stddev del rol/posición sobre la ventana provista.

8) outliers(allReports, metric, threshold=2):
   - devuelve players con |z| > threshold.

NO usar librerías nuevas. Math nativo.

═══════════════════════════════════════════
PARTE C — NUEVAS CARDS POR VIEW
═══════════════════════════════════════════

REGLAS DE DISEÑO (mantener consistencia):
- Cards = .gp-c con .gp-c-h + .gp-c-b.
- Reusar SVG inline cuando sea posible (estilo gp-ts / gp-scatter ya existentes).
- Chart.js permitido (ya está cargado).
- Colores: solo var(--cm-accent), var(--cm-warning), var(--cm-danger), var(--cm-info), var(--cm-success). Nada hardcoded.
- Tipografía: Geist (body), Geist Mono (números).
- Todo card respeta gp-c-h con título + sub + right{ size-toggle + ti-dots }.

NUEVAS CARDS:

▸ INDIVIDUAL view (agregar 3):

A) "ACWR · Acute:Chronic" (Gabbett 2016):
   - Line chart Chart.js. X = últimas 12 semanas. Y = ACWR.
   - Bandas de fondo: 0-0.8 (subloading, gris), 0.8-1.3 (sweet spot, verde semi-translúcido), 1.3-1.5 (caution, amarillo), >1.5 (danger, rojo).
   - Línea del jugador con dots. Última semana resaltada.
   - KPI inline arriba: "Current ACWR · {valor} · {flag label}".
   - data-size="md".

B) "Fitness · Fatigue · Form" (Banister-style):
   - Triple line chart: CTL (fitness, 42d EWMA, blue), ATL (fatigue, 7d EWMA, red), TSB (form = CTL-ATL, green/red bars al pie).
   - X = últimos 42 días.
   - data-size="md".

C) "Velocity zones distribution":
   - Stacked horizontal bar chart. Una barra horizontal por sesión de la MC actual.
   - Segmentos Z1/Z2/Z3/Z4/Z5 con gradiente accent→warning→danger.
   - Tooltip muestra metros por zona.
   - data-size="lg".

▸ GROUP view (agregar 3):

D) "Microcycle calendar heatmap":
   - Grid: filas = players (top 12 starters), columnas = días de la MC seleccionada (Sun..Sat).
   - Color = % vs match peak (gradiente verde→amarillo→rojo igual que .gp-xm-t existente).
   - Click en celda → log player+día (futuro: drill-down).
   - data-size="full".

E) "Position comparison · radar":
   - Radar Chart.js con 6 ejes (Dist, HSR, Sprint, Top spd, Accel, Load).
   - Una serie por posición (CB, FB, MF, WG, ST) — colores accent, accent-soft con border distinto.
   - Datos = avg de la MC seleccionada.
   - data-size="md".

F) "Outliers · z > |2|":
   - Lista (reusar .gp-rank con badges z-score). Solo jugadores con |z|>=2 en cualquier métrica.
   - Cada row: avatar + nombre + métrica afectada + valor z.
   - Color del badge: rojo si z>2 (sobrecarga), azul si z<-2 (sublóad).
   - data-size="md".

▸ MATCH · INDIVIDUAL view (agregar 2):

G) "Half drop-off":
   - 6 mini-bars (una por métrica): Dist, HSR, Sprints, Accel, Top spd, Load.
   - Cada bar muestra valor 1H y 2H, label arriba con %drop (rojo si >15%).
   - data-size="md".

H) "Velocity profile":
   - Line chart sintético: speed (km/h) vs minuto del partido. Smooth con bandas de zonas.
   - Marcadores en sprints (>25.2 km/h).
   - data-size="lg".

▸ MATCH · GROUP view (agregar 1):

I) "Match demands vs training delivered":
   - Bar chart agrupado por métrica. 2 barras por métrica: "Match avg (last 5)" y "Training peak this MC".
   - % delivered debajo de cada par.
   - data-size="full".

═══════════════════════════════════════════
PARTE D — FILTROS REALMENTE FUNCIONALES
═══════════════════════════════════════════

Cuando el usuario cambia microcycle / player / baseline en los pills:
1) Re-fetchear sólo lo necesario (no toda la página).
2) Recalcular z-scores con gpScience.zScore vs el baseline seleccionado.
3) Actualizar:
   - KPIs Individual (3 cards top)
   - Radar profile (z scores recalculados)
   - x match max
   - Weekly volume bars
   - Z-score matrix Group
   - Squad ranking
   - Todas las cards nuevas A–I.

Implementar como:
```
async function renderView() {
  const state = window.gpState;
  const reports = await fetchReports(state);
  window.gpData = { reports, computed: {} };
  renderIndividual();
  renderGroup();
  renderMatchInd();
  renderMatchGrp();
}
```
Cada renderXxx solo toca los DOM nodes de su view.

═══════════════════════════════════════════
ENTREGA
═══════════════════════════════════════════

- GPS Analysis.html: cards nuevas insertadas en cada .gp-grid antes de .gp-add. Script extendido. <30% del archivo total.
- assets/gps-seed.mjs: script Node ejecutable. NO es .sql estático. Lee DB primero, pide confirmación, adapta a posiciones reales.
- assets/gps-science.js: cargado vía <script src=> tras chart.js en el <head>.
- assets/SEED_README.md: 5-10 líneas con cómo correrlo y cómo revertir.

AL TERMINAR responde:
- Resultado de la inspección de la DB (clubs/players/sessions reales detectados).
- Mapeo de posiciones (raw → normalized).
- Cards nuevas: count por view.
- Cálculos científicos implementados: lista.
- Anomalías inyectadas (nombre real del jugador + métrica + MC).
- Cómo revertir el seed (1 línea).
- 1 frase con siguiente paso.
```

---

## 4 · Recomendaciones de uso

1. **Ejecutá Prompt 1 primero**. Es chico, mejora la usabilidad y deja el terreno preparado.
2. **Probá manualmente** que los botones respondan antes de seguir.
3. **Antes del Prompt 2**: asegurate de tener jugadores cargados en Supabase (mínimo 11 activos, distribuidos por posición). El seed va a leer eso, no inventa jugadores.
4. **Conseguí tu Supabase service_role key** (Dashboard → Project Settings → API → service_role). El seed la necesita para escribir; nunca subas esa key al repo.
5. **El Prompt 2 podés cortarlo en sub-prompts** si sentís que es mucho:
   - Sub 2.1 = solo Parte A (seed adaptativo Node.js).
   - Sub 2.2 = Parte B (science.js).
   - Sub 2.3 = Parte C (cards nuevas por view).
   - Sub 2.4 = Parte D (filtros funcionales).

Esto encaja con la regla 6.2 del CLAUDE_RULES (trabajar por módulos).

---

## 5 · Referencias científicas usadas

- Gabbett TJ (2016). *The training-injury prevention paradox*. Br J Sports Med.
- Halson SL (2014). *Monitoring Training Load to Understand Fatigue*. Sports Med.
- Akenhead R, Nassis GP (2016). *Training load and player monitoring in high-level football*. Int J Sports Physiol Perform.
- Owen AL et al. (2017). *Quantification of a professional football team's external load*. J Strength Cond Res.
- Martín-García A et al. (2018). External load comparison MD-4/MD-3/MD-2/MD-1.
- Catapult — PlayerLoad fundamentals.
- Lumin Sports — Training Stress Balance (CTL/ATL/TSB).
- StatSports — Injury prevention thresholds.
