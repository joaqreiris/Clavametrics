# ClavaMetrics — Checklist de pendientes (GPS Analysis y alrededores)

> Lista viva de los "luego lo vemos" que fueron surgiendo. Marcá `[x]` cuando esté
> hecho. Prioridad: 🔴 bloquea / corrompe datos · 🟡 funcional, molesto · 🟢 mejora.

---

## ⏭️ PRÓXIMO — en lo que estoy ahora (no perder el hilo)

- [ ] **Barra de filtros del dashboard (multi-select):** MD code / fecha / jugador /
  posición, enlazada con los datos. Es lo ÚLTIMO para cerrar el Chart builder.
- [ ] **Pushear/commitear seguido (mayor riesgo):** hay trabajo que vive solo en local.
  Prueba de fuego: `git status` limpio al cerrar la sesión.

---

## 🔴 Session Control — base de datos / acoplamiento (retomar acá)

> Los 3 prompts "EN VUELO" (Z-score/Outliers, default mínimo, persistencia) ya están
> resueltos → ver "Hecho ✅". Lo de abajo sigue pendiente.

- [ ] **`availability.player_id` es `text`, no `uuid`** y sin FK a `players`.
  Riesgo: filas huérfanas (no cascadea al borrar jugadores) y joins inconsistentes.
  Fix: migración `ALTER COLUMN ... TYPE uuid USING ...` + agregar FK. Atacar aparte,
  puede fallar si hay basura. (Por ahora el seed la maneja como text.)

- [ ] **Vocabulario de `session_type` en 3 lugares.** El canónico es
  `training, match, rehab, conditioning, recovery, tactical, gym, other`. Vive en:
  (a) array JS `SESSION_TYPES`, (b) CHECK constraint de `training_sessions`,
  (c) validaciones en Calendar / Sessions History / Daily Planning. Mantener
  sincronizados; documentar la lista canónica en `database_schema.md`.

- [ ] **`microcycle` desacoplado.** El filtro de MC usa `getISOWeek(session_date)`,
  pero la etiqueta real del club vive en `session_attributes->>'microcycle'` y/o
  `training_sessions.microcycle_id`. Para dashboard 05 y Weekly volume, preferir la
  etiqueta real sobre la semana ISO. (Decisión futura: ¿migrar a columna
  `training_sessions.microcycle` first-class? Hoy es atributo.)

- [ ] **`database_schema.md` desactualizado** (Prompt 5 nunca confirmado). Debe
  reflejar: `gps_metric_definitions`, `gps_report_metrics`, `club_gps_settings`,
  `is_historical`, `session_attributes`, `session_label`, `gps_dashboard_layouts`,
  y la lista canónica de session_type.

## 🔴 Migración de usuarios reales (Carril B — feature de producto, pendiente)

- [ ] **Definir la visión:** ¿un club migra su historia y se INTEGRA (microciclos,
  calendar, players reales), o la data importada es siempre "histórica/análisis"
  y la operación real arranca de cero? Define todo el resto.
- [ ] Cuando un usuario elige **"Real sessions — full integration"** en el import:
  ¿se crean filas en `microcycles`? ¿aparecen en Calendar y Sessions History?
  ¿`md_code` se vincula a la entidad microciclo o queda en JSONB? Verificar y, si
  falta, construir la integración real.

## 🟡 GPS Analysis — cards y dashboards

- [ ] **Principio: dashboard por defecto MÍNIMO.** Cada dashboard arranca con pocas
  cards esenciales; el usuario suma el resto desde "Add card". Evita el volcado de
  datos. El estado (qué cards visibles) persiste por usuario. Aplicar a TODOS los
  dashboards (Session Control, Load Monitoring, Match Performance, Microcycle Compare).
- [ ] **No meter comparación entre sesiones dentro de tablas por-jugador** (duplica
  filas, ilegible). La comparación temporal va en card de z-score resumen aparte.

- [ ] **Player Week Report = solo jugador.** Todo el dashboard responde "la semana de
  ESTE jugador". Adaptar a jugador las cards que hoy son de plantel/temporada:
  - [ ] ACWR → ACWR del jugador (no squad avg).
  - [ ] Fitness·Fatigue·Form (CTL/ATL/TSB) → del jugador.
  - [ ] Velocity zones → del jugador (su última sesión / su semana).
  - [ ] Revisar si High Intensity Actions repite lo de KPIs+tabla; si sí, quitar.
- [ ] **Dashboard de equipo (Load Monitoring/03):** versión PLANTEL de ACWR /
  CTL-ATL-TSB / Velocity zones (como están hoy). Ideal: misma card con parámetro
  scope (player|squad), no duplicar código. Pragmático: reusar lógica al construirlo.
- [ ] **Set canónico → Add card:** una vez definidas las cards válidas del week
  report, que queden disponibles en "Add card" (GP_CATALOG) para que el usuario
  arme su vista. Conecta con "cards eliminables y recuperables".

- [ ] **Regla de diseño — "Change metric" según tipo de card:** el "Change metric"
  del menú "..." va SOLO en cards de métrica única (KPI, barras, Weekly volume).
  En cards de métricas múltiples (tabla, radar) NO aplica: ahí se usa el gestor de
  columnas / ejes. No duplicar ambos en la misma card. Aplicar esta regla al armar
  los dashboards 01/03/04/05.
- [ ] **Panel "Table columns": UX.** No debe cortarse fuera del viewport ni cerrarse
  al agregar/quitar cada métrica (que quede abierto para gestionar varias seguidas).

- [ ] **Selector de métrica: "algunas no se pueden colocar".** Verificar que TODAS
  las métricas del catálogo (core + custom) sean seleccionables en las KPI.
  Probable causa: custom sin datos para el jugador, o card que no lee del EAV.
- [ ] **Weekly volume · wk-on-wk**: hardcodeado a player load, no carga. Engancharlo
  al selector de métrica (elegir sprint / HSR / etc.) y arreglar a qué MC/fechas
  apunta (hoy "MC 14 vs MC 13" sobre fechas sin data → vacío).
- [ ] **Replicar "Change metric"** a todas las cards de métrica una vez validado en
  las KPI (HSR, Sprints, rankings, scatters, y Weekly volume).
- [ ] **Cards eliminables y recuperables** (Nivel 3): si el usuario saca una card,
  que pueda volver desde "Add card" y no se pierda nunca. Verificar que el
  catálogo (`GP_CATALOG`) liste todas, incluidas las eliminadas.
- [ ] **Deprecar el sistema viejo de `localStorage`** ("Saved views" / `cm_gps_layouts`)
  una vez que `gps_dashboard_layouts` + `loadLayout` funcione del todo. No deben
  convivir dos sistemas de persistencia.
- [ ] **Aislamiento de cards — Nivel 2 (refactor real, DESPUÉS de completar cards):**
  cada card como módulo con estado propio, sin estructuras globales compartidas
  (BL_MAP, funciones de carga, canvas). Es un proyecto en sí mismo, alto riesgo —
  hacerlo cuando el set de cards esté estable, NO mientras todavía cambian de forma.
- [ ] **Separar el estado por card** (ya listado): subsumido en Nivel 2.

## 🟡 Otros dashboards del rediseño (Fase 2, en curso)

- [ ] Dashboard 01 Session Control · 03 Load Monitoring · 04 Match Performance ·
  05 Microcycle Compare — implementar/validar con el preámbulo aditivo, card por card.
- [ ] Verificar tras cada prompt: `GP_CATALOG` solo crece (nada borrado), render de
  gráficas (~líneas 374-447 y ~1679-2222) intacto.

## 🟢 Visión de producto — futuro (NO ahora)

- [ ] **Info bibliográfica por gráfico (icono "?"):** cada card con un icono de ayuda
  que abra un popup explicando qué representa el gráfico, con cita bibliográfica,
  autor y explicación (ej. ACWR → Gabbett; CTL/ATL/TSB → modelo Banister). Para que
  un usuario que no conoce el indicador entienda qué está viendo. Conecta con la idea
  de "charts avanzados con referencia científica / árbol de decisión".

## 🟢 Seed / entorno

- [ ] Cargar `availability` con `fix_availability.py` (quedó pendiente del seed).
- [ ] En el seed, `CUSTOM_METRIC_KEY = 'pct_vmax'`: crear su definición en
  `gps_metric_definitions` para que tenga label lindo, o cambiar la key.
- [ ] El bloque 7 dejó **sin commitear** el `GPS Analysis.html` con todo el trabajo.
  Pushear y mantener commits frecuentes (mucho trabajo vive solo en local).

---

## 🚀 En producción (construido y andando — no es futuro)

- [x] **Constructor de charts a gusto del usuario (manual, estilo Power BI):** chart
  builder con dimensiones/medidas; todos los tipos de gráfico (KPI, bars, line,
  scatter, radar, ranking, table) reproducidos con Chart.js; formato condicional de
  tablas. La escalera catálogo sólido → constructor manual → constructor por IA, armada.
- [x] **Generador de cards por IA:** compone configs validadas (tipo de card +
  métricas reales del catálogo + baseline + filtros), el usuario previsualiza e
  inserta. COMPONE entre piezas validadas, no genera código libre ni inventa métricas.

---

# 🧠 Lluvia de ideas / Roadmap (sin pulir, para priorizar después)

## Corto plazo — import / onboarding
- [ ] **Cargar más de un CSV/Excel** en el import (multi-archivo).
- [ ] **Manejo de esquemas distintos entre archivos:** ¿qué pasa si un CSV trae
  ciertas métricas y otro trae más o menos? Definir comportamiento: ¿se unen por
  unión de columnas?, ¿las faltantes quedan null?, ¿se avisa al usuario? (clave
  para que el catálogo custom no se rompa entre imports).
- [ ] **Onboarding primer login:** slider/carrusel de bienvenida explicando
  brevemente cada página.
- [ ] **Tour del hub inicial:** explicación rápida de los elementos principales
  (barra lateral, KPIs, barra de búsqueda, tareas). Elegir los esenciales.

## Mediano plazo — integraciones y features
- [ ] **API con proveedores GPS** (pedir acceso a StatSports, Catapult) para
  importar sin CSV manual.
- [ ] **Gestión de vídeos** desde la aplicación.
- [ ] **Manual de uso** de la app con capturas.

## Largo plazo — GPS Analysis avanzado
- [ ] **Constructor de charts tipo Power BI:** el usuario crea charts a gusto con
  las métricas que quiera, barra lateral, cambiar colores, definir agregación
  (max/min/avg). (Conecta con el generador IA de la sección 🟢.)
- [ ] **Charts avanzados con referencia científica** (ej. "× veces match"), guía
  interactiva tipo árbol de decisión: el usuario navega qué quiere ver, con
  info para profundizar en la literatura.

## Largo plazo — IA / machine learning
- [ ] **ML de contexto pre-lesión:** leer toda la info previa a cada lesión para,
  a futuro, alertar cuando un patrón de riesgo se repite. (Requiere histórico
  grande y bien etiquetado — el seed/datos reales son la base.)
- [ ] **IA de sugerencias de trabajo complementario** por jugador (compensar en
  campo y gimnasio).

## Largo plazo — negocio / go-to-market
- [ ] **Plan de ventas:** beneficios y soluciones para clubes y holdings.
  Argumento central: centralización de la información; facilidad para
  coordinadores y encargados del proceso de entrenamiento.
- [ ] **Justificar la venta ante staff cambiante:** ¿cómo asegurar continuidad de
  uso del sistema cuando el cuerpo técnico rota? (objeción clave de venta).
- [ ] **Calculadora de planes para holdings** (nº de usuarios, categorías, clubes).
- [ ] **Plan de marketing:** publicidad, organización y planning de contenido para
  redes. Probar **Claude Design** para las publicaciones.

## Largo plazo — app de jugadores
- [ ] **App para jugadores:** entrenamientos diarios, rutinas individualizadas de
  prevención y trabajo complementario, wellness + RPE con notificación móvil,
  métricas y evolución de rendimiento (GPS, composición corporal, salto, fuerza,
  movilidad, etc.).
- [ ] **Gestión del club fuera del staff** (dirigentes/coordinación).

---

### Hecho ✅ (para no re-tocar)
- [x] Import robusto: decimal europeo (Prompt A), tipo por fila (Prompt B), microcycle (Prompt C).
- [x] Policy UPDATE en `gps_reports` (faltaba; reimport fallaba por RLS).
- [x] CHECK de `session_type` ampliado con `training`/`rehab`.
- [x] Seed de temporada completa cargado (24 jugadores, 447 sesiones, 7571 GPS, 46 MCs, 9 lesiones).
- [x] **Player Week Report — 100% TERMINADO.** Todas las cards a nivel jugador:
  - [x] 3 cards núcleo (KPIs/table/High Intensity) cableadas.
  - [x] "Change metric" en KPI + persistencia vía loadLayout/gps_dashboard_layouts.
  - [x] ACWR adaptado a jugador.
  - [x] Fitness·Fatigue·Form (CTL/ATL/TSB) adaptado a jugador.
  - [x] Velocity zones adaptado a jugador.
  - [x] High Intensity Actions: SE QUEDA (no redundante, muestra periodización semanal).
  - [x] × match max redefinido: "partidos equivalentes" (suma semanal / baseline; pico vs acumulable). Métricas editables.
  - [x] Barra de filtros unificada (jugador/MC/rango temporal + acciones a la derecha). Label sincronizado con selector. Sin duplicados.
  - [x] Aislamiento Nivel 1 (try/catch por card + chart.destroy() — resolvió "canvas already in use").
  - [x] Sistema Add card completo: catálogo lista cards reales, agregar las conecta a datos, eliminar→stash recuperable, persiste. Diagnóstico: 10 cards con render real, 2 cáscaras (Accel/Decel asym, Personal baseline trend = "coming soon").
- [x] Tamaños S/M/L proporcionados (no "chorizo largo"). Tablas: Medium ocupa full width.
- [x] KPIs chicas comparativas de partido MOVIDAS de Player Week a Session Control.
- [x] **Session Control — EN CURSO (muy avanzado):**
  - [x] Filtros unificados (MC + fecha + "Compare with" + jugador opcional).
  - [x] Session KPI row con agregación seleccionable (avg/total/mediana/max/min, label refleja agregación, respeta pico vs acumulable).
  - [x] Session table editable (gestor de columnas) + color group z-score (espacial: vs grupo hoy).
  - [x] Desacople comparación de la tabla (no duplica filas 24→48).
  - [x] Card "Variación vs equivalentes": z-score temporal vs N sesiones del MISMO MD code (sin selector de 1 sesión).
  - [x] Card "vs sesión" porcentual 1-a-1 (acá vive el Compare with).
  - [x] "sesiones equivalentes" filtradas por mismo MD code (no mezcla MD-5 con MD+1).
  - [x] Outliers como heatmap jugador × métrica (reemplazó la lista).
- [x] **Session Control — los 3 prompts "EN VUELO" resueltos:**
  - [x] PROMPT 1 (BUG): Z-score/Outliers — al quitar la Z-score matrix se rompieron "Outliers" y "Variación vs equivalentes" (acoplamiento de la sesión seleccionada / MD code). Diagnosticado y corregido; las cards vuelven a mostrar datos.
  - [x] PROMPT 2 (default mínimo): solo núcleo visible (Session KPI row + Session table + Variación + Outliers); el resto a "Add card".
  - [x] PROMPT 3 (PERSISTENCIA): guarda/restaura por usuario y dashboard_id (cards visibles/quitadas, tamaño S/M/L/Full, métricas, agregación, orden). loadLayout aplica el estado antes de renderizar; sin estado guardado → default mínimo. Verificado: quitar card + Large + cambiar métrica → recargar → sigue igual.
