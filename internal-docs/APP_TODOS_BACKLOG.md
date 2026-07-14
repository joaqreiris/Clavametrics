# Backlog — cosas sin funcionar / a corregir

Registro vivo de items detectados que hay que arreglar más adelante. Se va
apendeando. No se sirve público (vive en `internal-docs/`, excluido en `.vercelignore`).

Formato por item: **qué** · dónde · evidencia · estado · acción.

---

## 1. Limpieza de código pendiente

### 1.1 console.log de diagnóstico ACWR sin quitar
- **Qué:** quedan 4 `console.warn('[ACWR DIAG] …')` de diagnóstico temporal.
- **Dónde:** `GPS Analysis.html` — 2 en `gpRenderScienceCards` (`enter`, `histSessions`) + el bloque `// TEMP DIAG (ACWR blank card)` con su `try/catch`.
- **Evidencia:** `grep -c "ACWR DIAG" "GPS Analysis.html"` → 4 en `lm-redesign-BADBASE`. Los introdujeron los commits `diag(temp)` (en `main`: `009af89`, `6fd1c37`; equivalentes a `f57ba21`, `f7ff78e`).
- **Estado:** el bug que investigaban ya está resuelto (`d32ce18` + `10c8ab3`). Los quité una vez, pero quedó **sin commitear** porque el árbol estaba en medio de un merge en `main` (se pidió "no more changes"). En esta rama siguen presentes.
- **Acción:** eliminar las 4 líneas `[ACWR DIAG]` (no tocar `console.error` de catch). Verificar que ACWR sigue renderizando.

---

## 2. Features de la app marcadas como TODO al documentar el centro de soporte (batch 2)

> Detectadas leyendo el código para escribir las páginas de `/support`. Son
> features que aparecen en la UI pero **no se pudo confirmar** que funcionen, o
> que están explícitamente "coming soon". Cada una quedó como bloque `> TODO`
> en el `.md` correspondiente.

### Daily Planning (`Daily Planning.html`)
- **2.1 Botón "Load template"** — está en el header de la sesión pero **sin handler visible**. No se pudo confirmar que existan/carguen plantillas de sesión. → verificar si la feature está implementada o es un stub.
- **2.2 "✓ Applied" en adaptación de fisio** — al clickear solo baja la opacidad de la card en la UI; **no se encontró persistencia**. → confirmar si registra algo (dismiss/ack) o es puro visual.

### Squad (`Squad.html`)
- **2.3 Columna "Joined"** — el header existe pero renderiza "—" para todos. → confirmar si falta cablear el campo de fecha o es feature pendiente.
- **2.4 Estado "modified"** — aparece como opción de status pero el campo está `disabled` en el modal. Uso/trigger poco claro. → definir qué significa y cómo se setea.

### Availability (`Availability.html`)
- **2.5 Vista "Today"** — el segmented control la muestra pero parece marcada "coming soon". → definir qué muestra vs. Matrix e implementar.
- **2.6 Botones "Filters" y "Group by"** — placeholders en el toolbar, sin handler activo. → implementar o quitar.
- **2.7 Atajos de teclado (A / P / I)** — mencionados en la leyenda; los listeners no parecen del todo cableados. → verificar/implementar.
- **2.8 Estado "Absent"** — solo aparece en el contexto de minutos de partido (0'). Su uso más amplio (p.ej. DNP) no está claro. → definir caso de uso.

### RPE (`RPE.html`)
- **2.9 Tendencia / histórico de carga por jugador** — hay un control en la card pero está como "coming soon". → implementar el trend por jugador.
- **2.10 Sin botón de export** — no se encontró export en esta página (los totales semanales / ACWR viven en Load Monitor). → confirmar si debería exportar o queda a propósito en Load Monitor.

---

## 3. Features marcadas como TODO al documentar las páginas piloto (batch 1)

### Calendar (`Calendar.html`)
- **3.1 Checklist "Tasks" en sesiones** — aparece una sección Tasks en el popover del evento, pero el comportamiento (CRUD, due dates) no se verificó. → confirmar si funciona.
- **3.2 Export PDF (hoja semana/mes)** — presente en la página pero el comportamiento/formato exacto no se verificó. → confirmar salida.
- **3.3 Ribbon de temporada alternativo** — existe en la página (`calRibbonV2`) pero parece oculto / no activo. → definir si es feature pendiente o muerto.

### GPS Analysis (`GPS Analysis.html`) — stubs / "coming soon"
- **3.4 Export PDF** — botón presente, handler muestra "coming soon".
- **3.5 Provider sync** — Catapult / StatSports / Polar / WIMU / GPSports; placeholder "coming soon". Hoy la vía real es import de archivo.
- **3.6 Panel "GPS settings" dedicado** — botón presente, "coming soon".
- **3.7 Cambio de tipo de gráfico** — `TODO: switch chart type` en el código.
- **3.8 Cards del catálogo en stub** — accel/decel asymmetry, personal-baseline trend, position box plot, squad readiness, halves drop-off, us-vs-opponent (aparecen deshabilitadas/`stub:true`).
- **3.9 Umbrales de zonas de velocidad (HSR / VHSR / sprint)** — no expuestos en la UI; parecen configurables por club. → confirmar los valores reales antes de publicarlos en la doc.

### Load Monitor (`Load Monitor.html`)
- Sin bloque TODO en la doc: la página se verificó contra el código (`gps-acwr.js`) y las zonas/modelo son fiables. Dudas menores del agente, **sin confirmar, baja prioridad:** límites del período "Microcycle"; si el flag de wellness reaparece tras una nueva entrada del jugador; group-by "Age" (¿implementado o solo sort?); jugadores multi-categoría (¿aparecen en ambos equipos?); si "Chronic" en el CSV export es media diaria o suma 28d.

---

## 4. Features marcadas como TODO al documentar la Tanda 2 (Annual Planner, Gym Planner, Drill Designer, Exercises Library)

### 4.0 Discrepancia de taxonomía (8 vs. real) — REVISAR
- **Qué:** el brief asumía una **taxonomía de 8 dimensiones** para drills, pero el código expone menos. **Exercises Library** filtra por **6** (Orientation, Intensity, Match Day, Game type, Focus, Team). **Drill Designer** (`Planner.html`) tiene **4** dimensiones de tag (Orientation, Intensity, Focus, Game type) + Match Day y formato.
- **Evidencia:** `filters = {orientation, intensity, matchday, gametype, focus, team}` en `Exercises Library.html`; `ORIENT_META` / `INT_LABEL` / focus multi / game_type en `Planner.html`.
- **Estado:** documenté las dimensiones reales (6 / 4). No aparecen principle / sub-principle / tactical-concept como dimensiones.
- **Acción:** confirmar si el modelo real es de 6/4 o si esas 8 dimensiones viven en otra parte (¿otra tabla / otra pantalla?). Ajustar la doc según respuesta.

> Nota: "Drill Designer.html" **no existe**; la página real es `Planner.html` (su `<title>` es "Drill Designer"). La doc usa `app_page: Planner.html`.

### Annual Planner (`Annual Planner.html`)
- **4.1 Presets de "phase types"** — se cargan de una tabla aparte (`phase_types`); los tipos de fase preset y si el staff los administra no son visibles en esta página. → confirmar.
- **4.2 Match embebido en microciclo vs. eventos del Calendar** — un microciclo puede tener su propio match (`match_date`, `rival`…) independiente de los `calendar_events`; la lógica de de-duplicación entre ambos no se confirmó del todo. → verificar que no dupliquen/choquen.
- **4.3 "Match time" del microciclo** — no está claro si se usa aguas abajo (Daily Planning) o es solo de referencia en el Planner. → confirmar.

### Gym Planner (`Gym Planner.html`)
- **4.4 Sin supersets / circuits** — no hay UI para agrupar ejercicios como superserie/circuito; cada fila es standalone. → definir si es feature pendiente.
- **4.5 Sin reordenar filas** — no se encontró drag-para-reordenar ejercicios. → confirmar/implementar.
- **4.6 Draft de IA sin persistencia** — si el coach cierra la pestaña antes de guardar, el draft generado se pierde (no se encontró autosave del draft). → definir si debería persistir.
- **4.7 Templates no guardan adaptaciones** — al guardar un template se guardan warm-up/plyo/main pero **no** las adaptaciones individuales. → confirmar si es intencional.

### Drill Designer (`Planner.html`)
- **4.8 Share-to-chat** — la función de compartir a chat existe pero el handler vive en un módulo externo no verificado. → confirmar comportamiento.
- **4.9 Subida de objetos custom** — botón "Upload object…" presente; la serialización/deserialización no se ve completa en el archivo. → confirmar que funciona end-to-end.

### Exercises Library (`Exercises Library.html`)
- (Cubierto por 4.0.) Además: el **GPS profile** por drill es derivado del mapeo `gps_drill_map` → `v_exercise_gps_profile`; el flujo de mapeo GPS (wizard "Map drills") es solo admin. → sin issue conocido, anotado como dependencia.

---

## 5. Features marcadas como TODO al documentar la Tanda 3 (Wellness, Evaluations, Sessions History, Player)

> Nota: se documentó **Evaluations.html** (la v2 viva), no `Evaluations-old.html`.

### Wellness (`Wellness.html`)
- **5.1 Carga por parte del staff** — no se encontró path para que el staff cargue el check-in por el jugador (la submission es del lado del jugador vía link tokenizado). → confirmar si es intencional.
- **5.2 Historial 7 días "coming soon"** — botón/vista de historial de 7 días aparece deshabilitado; el backend (`get_survey_history`) lo soporta pero no está cableado. → implementar/cablear.
- **5.3 Sin export** — no se encontró export en la página. → confirmar si debería.
- **5.4 `acknowledge_wellness` sin UI** — existe la función backend (marca `acknowledged_at`/`acknowledged_by`) pero no aparece cableada en el UI de Wellness. → cablear el "marcar como visto" de flags.

### Evaluations (`Evaluations.html` v2)
- **5.5 Sin "personal best"** — solo se trackea último valor + media personal; no hay campo/flag de mejor marca. → definir si se quiere.
- **5.6 Sin edit/delete de resultados** — no se encontró UI para editar o borrar un resultado ya cargado. → confirmar dónde se gestiona (¿backend/Dossier?).
- **5.7 "Export report"** — botón presente; formato/scope exacto sin confirmar. → verificar salida.
- **5.8 Detalles sin confirmar** — umbrales de color de asimetría L/R; hand-off exacto de resultados de tests a los **load groups** del Gym Planner (ligado a item 4.x); integración con Dossier.

### Sessions History (`Sessions History.html`)
- **5.9 KPI "Compliance"** — renderiza "—%"; parece incompleto/no cableado (intención: carga planificada vs entregada). → confirmar si se implementa.

### Player (`Player.html`)
- **5.10 Campo "Joined"** — placeholder "—" (mismo caso que Squad, item 2.3). → cablear fecha.
- **5.11 Acciones edit/export dossier/print** — referenciadas pero no cableadas en la página; la navegación se limita a tabs + breadcrumb a Squad. → definir/implementar.
