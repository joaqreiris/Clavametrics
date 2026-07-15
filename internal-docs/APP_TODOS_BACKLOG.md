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

---

## 6. CONTROL DE ACCESO A REVISAR (mundo médico — PRIORIDAD)

> Datos de salud. Estos puntos NO son cosméticos: afectan confianza y potencial cumplimiento
> normativo. Lo que está **confirmado** en el código se anota como referencia; lo que queda en
> duda se marca para revisar antes de asumir nada.

### 6.0 Modelo de acceso — CONFIRMADO (referencia, no es un TODO)
- **`has_medical_access()`** (`db/schema.sql:3193`) = super-admin **o** `profiles.role ∈ (admin, owner, physio)`.
- **7 tablas de ficha clínica** (`player_medical_profile`, `player_medications`, `medical_screenings`, `medical_episodes`, `surgeries`, `medical_studies`, `medical_documents`) → RLS `club + has_medical_access()`. Médico-only.
- **Bucket `medical-documents`** (`migrations/applied/113_clinical_record_schema.sql:296`) → `public=false` (privado); RLS en `storage.objects` = carpeta de club + `has_medical_access()`; se sirve con signed URLs (1h, `clinical-record.js:1735`). ✔ Documentos NO públicos.
- **Clinical Record (página)** → `guardModule('clinical')` redirige no-médicos al Hub.
- **Injuries / treatments / rehab_plans** → RLS `player_id ∈ my_player_ids()` (por equipo), **NO** gated a médicos → visibles a staff del equipo.

### 6.1 Clinical Records (índice) — ¿qué ve un no-médico? (REVISAR)
- **Qué:** un comentario del código dice que coach/S&C ven una vista reducida (status, disponibilidad, RTP), pero **el índice NO oculta columnas por rol**. La protección real es el *module gate* (`member_modules`) + RLS (campos médico-only vuelven vacíos). La columna **"active issue"** expone el titular de la lesión (tipo + zona).
- **Duda:** si un rol no-médico puede **abrir** el índice depende de la config de `member_modules` (no confirmable en el código).
- **Acción:** confirmar qué puede abrir y ver realmente un no-médico; decidir si "active issue" debe mostrarse a no-médicos.

### 6.2 Physio (página) — ¿gate médico? ¿notas visibles? (REVISAR)
- **Qué:** a diferencia de Clinical Record, **no se confirmó** un gate médico-only en `Physio.html` (solo `guardModule()` genérico). Los `treatments` (incluidas **notas clínicas**) son team-scoped a nivel DB (`treatments_scoped_select` a `public`).
- **Acción:** confirmar si un no-médico debe ver las **notas** del tratamiento, o solo la adaptación. Si no debe, falta gate/mascarado.

### 6.3 Injuries / Rehab (páginas) — visibilidad de notas (REVISAR)
- **Qué:** ninguna tiene gate médico-only propio más allá del guard general; ambas team-scoped (no médico-gated). Un no-médico ve el registro de lesión (tipo/zona/**notas**) y los planes de rehab.
- **Acción:** confirmar visibilidad intencionada de notas/diagnóstico de lesión a roles no-médicos.

---

## 7. Otras limitaciones confirmadas en la Tanda 4 (no-acceso)

### Physio (`Physio.html`)
- **7.1 "✓ Applied" no persiste — CONFIRMADO** — no existe columna `applied`/`acknowledged` en `treatments`; solo `adaptation_sent_at` (momento del envío de la notificación, no de la aplicación). El "✓ Applied" del coach en Daily Planning es visual, no se guarda. (Confirma el item detectado en Daily Planning, 2.2.) → agregar campo de acknowledge si se quiere persistir.

### Rehab & Preventives (`Rehab & Preventives.html`)
- **7.2 Clear no cascada a injury/availability** — marcar un plan como `cleared` solo lo archiva; **no** cambia `injuries.status` ni `availability`. El retorno a disponibilidad es paso manual en Injuries (discharge) + Availability. → confirmar si es intencional o falta el cascade.
- **7.3 Sin link automático rehab ↔ plan individual** — comparten librería de ejercicios y sistema de bloques (`block-drawer.js`, `usable_in`) pero **no hay FK ni auto-populado** entre `rehab_plans` e `individual_plans`. → confirmar si se espera auto-populado.

### Injuries (`Injuries.html`)
- **7.4 Sync de disponibilidad** — al **crear** una lesión no hay sync automático de `availability` (el autofill 'injured' lo hace la página Availability leyendo lesiones activas). El sync desde Injuries ocurre en avance de fase (fases 4+ → 'partial') y en discharge (→ 'available' desde returned_date, solo pisando filas 'injured'). → sin issue conocido; anotado para claridad del modelo.

---

## 8. Discrepancias brief-vs-código en la Tanda 5 (documenté lo que el código HACE)

> Casos donde el brief asumía una feature que el código **no** implementa como se esperaba.
> La doc refleja el comportamiento real y lo dejé marcado como TODO.

### 8.1 Video Room ≠ "clips / tagging / share" — REVISAR wording de la app
- **Qué:** el brief (y la descripción de la card en el Hub: "Clips · tagging · share") sugiere extracción de clips, tagging con timestamps y compartir. El código hace una **biblioteca de enlaces**: guarda el link a Google Drive/Dropbox + metadata + linkeo a nivel **video** con sesiones/jugadores/partidos (`video_sessions`/`video_players`/`video_matches`). **No** hay clip-level tagging, ni markers temporales, ni share-a-chat.
- **Dónde:** `Video Room.html`, `Video Detail.html`, `migrations/applied/049_videos_module.sql`.
- **Acción:** confirmar si clips/tagging/chat-share son roadmap; reformular el texto "Clips · tagging" del Hub para no prometer lo que no existe.

### 8.2 Hub — Recent activity: GPS NO agrupado
- **Qué:** el brief decía "el GPS viene agrupado". El feed registra un evento **`gps.imported` por import** (con el título de la sesión anexado), no un ítem agregado tipo "N sesiones".
- **Dónde:** `Hub.html:1495-1498` (case `gps.imported`).
- **Acción:** confirmar si un import masivo colapsa a una fila o genera varias; ajustar doc/comportamiento según se quiera.

### 8.3 Hub — "pending RPE" es en realidad "submitted today"
- **Qué:** en el Hub no hay concepto de "pending RPE". La card de RPE muestra **cuántos se enviaron hoy** (`hub.n_submitted_today`), no cuántos faltan. El "pending" del Hub es de la card **GPS** (sesiones recientes sin import). Nada de esto es wellness.
- **Dónde:** `Hub.html:2097` (RPE submitted), `:2008` (GPS pending count).
- **Acción:** aclarar naming si confunde.

---

## 9. Otros TODO de la Tanda 5 (Hub, Admin, Lineup, Match Reports, Dossier, Chat & Tasks)

### Hub (`Hub.html`)
- **9.1 "Customize" de módulos sin handler** — el botón existe pero no tiene listener (los KPIs sí se customizan y persisten en `profiles.settings.hub_kpis`). → implementar o quitar.

### Admin (`Admin.html`) — permisos e integraciones
- **9.2 ¿Cambiar rol re-aplica plantilla?** — `set_member_role` cambia `profiles.role` pero no se vio que re-aplique `role_default_modules` a `member_modules`. → confirmar; si no, el acceso puede quedar desalineado tras cambiar rol.
- **9.3 StatSports PUSH — wiring app-side** — el setup es vía account manager (habilita Third-Party API) + se pega API key; el **endpoint/webhook receptor** en ClavaMetrics no se vio en el código de Admin. → confirmar cómo entra la data.
- **9.4 Tabs coming-soon** — "Sections" (matriz de acceso) y "Security & SSO" marcadas coming-soon. → estado real.
- **9.5 Stripe billing webhook pendiente** — la subscription no se rellena hasta que el webhook de Stripe esté vivo (liga con [[project_stripe_webhook]]).
> Referencia confirmada (no TODO): modelo de permisos de 2 niveles (`role_default_modules` + `member_modules` + centinela `__managed__`, fail-open sin filas; owner/admin = todo). Solo owner/admin abren Admin.

### Lineup (`Lineup.html`)
- **9.6 Publicación a jugadores sin confirmar** — "Send to #match-day" marca `status='official'` (+`published_at`/`published_by`), pero no se confirmó que postee a un canal de chat ni que el link `?lineup=` sea **visible por jugadores** (no hay vista pública/anon confirmada). → definir el camino de publicación a jugadores.
- **9.7 Status "locked"** — enum válido pero sin código que lo dispare. → definir uso.
- **9.8 Botones Templates / Reset sin handler** — presentes en el HTML, sin listener visible. → implementar/quitar.

### Match Reports (`Match Reports.html`)
- **9.9 Minutos/ratings no propagan** — no se vio que `player_match_stats.minutes` alimente availability (match:N) ni que `rating` persista al perfil de temporada. → confirmar si deberían.
- **9.10 Otros** — reports "standalone" sin `session_id` (uso poco claro); sin share-a-chat; `player_load` se selecciona pero no se renderiza; vistas ricas (shot map/heatmap/timeline) parecen ausentes/futuras.

### Dossier (`Dossier.html`)
- **9.11 Detalles menores** — el scouting summary se guarda a `players.scouting_summary` **solo al click** (no auto-save); filename del PDF es el default del browser; el accent color no persiste entre sesiones. → confirmar si es intencional.
> Referencia confirmada (no TODO): percentiles vs cohorte del equipo con **mínimo 4 pares** (si no, barra neutral); plantillas en `dossier_templates`.

### Chat & Tasks (`Chat & Tasks.html`)
- **9.12 Message types sin cablear** — `task_ref`, `report_share`, `system` declarados pero no se ven usados en la UI (solo `text` y `file`). → implementar o limpiar.
- **9.13 Entrega de reminders** — `task_reminders` guarda `remind_at`/`sent_at`; el proceso que efectivamente envía (push/email/in-app) corre **fuera** de esta página. → documentar/confirmar el job.
- **9.14 Link task ↔ entidad** — no hay campo explícito task→player/session/injury (se infiere por category). → confirmar si se quiere link duro.
- **9.15 Share-a-chat** — compartir un reporte/video a un mensaje no está cableado (relacionado con 8.1). → confirmar.

---

## 10. Glosario — huecos bibliográficos a revisar

> Al escribir el glosario (`support-site/content/en/glossary.md`) se verificó cada cita
> contra PubMed/DOI. Las siguientes quedaron sin fuente primaria verificada.

- **10.1 Seirul·lo "Microciclo Estructurado"** — no hay **fuente primaria peer-reviewed** confirmable. Se citó como proxy **Martín-García et al. 2018** (JSCR 32(12):3511–3518) y se menciona el libro *El microciclo estructurado* (Morales, 2020) como libro, no como paper. → conseguir la referencia preferida si se quiere citar a Seirul·lo directo.
- **10.2 Morphocycle / Tactical Periodization (Frade)** — nombrada como metodología; **sin cita primaria verificada**. → definir fuente citable (libros de Frade/Tamarit, o revisiones).
- **10.3 ATR (Issurin) y Verheijen** — nombradas como modelos de periodización; **sin cita primaria verificada** en el glosario. → agregar fuentes cuando se confirmen (p.ej. Issurin, *Block Periodization*).
- Nota: correcciones aplicadas vs. la lista original — Impellizzeri "Part 2" es **2020** (no 2021); Impellizzeri IJSPP 2020 autores = Tenan/Kempton/Novak/Coutts (no Woodcock); Windt & Gabbett 2019 título real "Is it all for naught?…". Literatura nueva citada: Qin 2025 (meta-análisis), Carbone 2022 (Bayesian), Soligard 2016 (consenso IOC).

---

## 11. Bugs de comportamiento confirmados en la limpieza final de /support (batch B-bug)

> Al resolver los bloques `> TODO` de las páginas públicas se confirmaron **contra el código**
> cuatro comportamientos rotos/limitantes. NO se documentan en la web pública (se sacaron del
> `.md`); quedan acá para el backlog de la app. Consolidan/actualizan los items previos citados.

### 11.1 Availability — atajos A/P/I anunciados pero sin cablear  ·  prioridad media
- **Qué:** la leyenda del Matrix muestra atajos de teclado `A` (available) / `P` (partial) / `I` (injury), pero no existe handler de teclado para esas teclas.
- **Dónde:** `Availability.html` — leyenda del Matrix; los únicos listeners de teclado son Enter (~línea 1310) y Escape (~línea 1320).
- **Evidencia:** grep de `e.key` en la página → solo Enter/Escape; ninguna rama para A/P/I.
- **Acción:** cablear los atajos o quitarlos de la leyenda para no anunciar teclas muertas. (Consolida [2.7].)

### 11.2 Dossier — el color de acento no persiste entre sesiones  ·  prioridad media
- **Qué:** el acento elegido no se guarda; vuelve al valor por defecto al recargar.
- **Dónde:** `Dossier.html` — `--accent` hardcodeado (~línea 28), sin `localStorage`/persistencia ni columna en DB.
- **Evidencia:** no hay lectura/escritura de storage para el acento; el valor es fijo en CSS inline.
- **Acción:** persistir el acento (perfil o storage) o quitar el selector. (Consolida [9.11].)

### 11.3 Gym Planner — el draft de IA se pierde si se cierra antes de guardar  ·  **PRIORIDAD ALTA (riesgo de pérdida de datos)**
- **Qué:** "Generate draft" **sobrescribe la sesión actual** con el borrador de IA en memoria; no hay persistencia separada del draft. Si el coach cierra la pestaña antes de **Guardar**, el contenido generado se pierde (y puede haber pisado la sesión previa sin guardar).
- **Dónde:** `Gym Planner.html` — confirmación "Replace the current session with the AI draft?" (~línea 786); `gpCollectContent()`/save sin capa de draft.
- **Evidencia:** no se encontró autosave ni almacén de draft; el draft vive solo en el estado de la página hasta el save explícito.
- **Acción (alta):** persistir el draft (autosave a borrador o guardar antes de reemplazar) y/o pedir confirmación al cerrar con cambios sin guardar. (Eleva la prioridad de [4.6].)

### 11.4 Glossary — huecos bibliográficos (decisión editorial)  ·  prioridad baja
- **Qué:** varias metodologías citadas por nombre sin fuente primaria peer-reviewed verificada (Seirul·lo "Microciclo Estructurado", morfociclo/Tactical Periodization de Frade, ATR de Issurin, Verheijen).
- **Dónde:** `support-site/content/*/glossary.md`.
- **Evidencia:** ver detalle y proxies en la sección [10] de este backlog.
- **Acción:** decidir fuentes citables antes de afirmar respaldo bibliográfico. (Consolida [10.1]–[10.3].)
