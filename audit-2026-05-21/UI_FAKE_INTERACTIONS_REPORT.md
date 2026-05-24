# UI FAKE INTERACTIONS REPORT — ClavaMetrics
**Fecha:** 2026-05-21  

Todos los elementos UI que parecen funcionales pero no tienen implementación real.

---

## CATEGORÍA A — Botones completamente muertos (sin handler alguno)

| ID | Archivo | Elemento | Línea aprox | Prioridad |
|----|---------|----------|-------------|-----------|
| UI-A01 | Login.html | Botón Google OAuth | ~280 | CRÍTICO |
| UI-A02 | Register.html | Botón Google OAuth | ~260 | CRÍTICO |
| UI-A03 | Hub.html | "+ Add task" (abre chat en vez de crear tarea) | ~785 | HIGH |
| UI-A04 | Hub.html | "Customize" (dashboard customization) | ~430 | MEDIUM |
| UI-A05 | Hub.html | Notifications icon | ~425 | LOW |
| UI-A06 | Hub.html | Help icon | ~425 | LOW |
| UI-A07 | Calendar.html | "New Microcycle" | ~445 | HIGH |
| UI-A08 | Calendar.html | "Import Fixtures" | ~445 | HIGH |
| UI-A09 | Calendar.html | "Manage" (publish section) | ~730 | MEDIUM |
| UI-A10 | Calendar.html | "View All" (upcoming events) | ~625 | LOW |
| UI-A11 | Chat & Tasks.html | Bell icon (notifications) | 256 | MEDIUM |
| UI-A12 | Chat & Tasks.html | Chat header: Search, Pin, More | 347–349 | MEDIUM |
| UI-A13 | Chat & Tasks.html | Composer: Attach, Mention, Emoji, Task | 361–363 | HIGH |
| UI-A14 | Chat & Tasks.html | "Filter" button (tasks) | 409 | MEDIUM |
| UI-A15 | Daily Planning.html | "Print" | 243 | MEDIUM |
| UI-A16 | Daily Planning.html | "Export PDF" | 244 | MEDIUM |
| UI-A17 | Daily Planning.html | "Publish" | 245 | HIGH |
| UI-A18 | Daily Planning.html | "Load Template" | 253 | MEDIUM |
| UI-A19 | Daily Planning.html | "Apply adaptation" (x2) | 306, 315 | HIGH |
| UI-A20 | Daily Planning.html | "Print roster" | 327 | LOW |
| UI-A21 | Daily Planning.html | "Manual" / "From library" (add exercise) | 416–417 | HIGH |
| UI-A22 | Daily Planning.html | "Add exercise" | 522 | HIGH |
| UI-A23 | Planner.html | "Versions" | 420 | MEDIUM |
| UI-A24 | Planner.html | "Print" | 421 | MEDIUM |
| UI-A25 | Planner.html | "Share" | 422 | MEDIUM |
| UI-A26 | Planner.html | "Publish" | 423 | HIGH |
| UI-A27 | Planner.html | "Add drill" | 515 | HIGH |
| UI-A28 | Planner.html | Toolbar: Select, Move, Draw, Lasso | 541–545 | CRÍTICO |
| UI-A29 | Planner.html | Toolbar: Undo, Redo, Zoom | 546–558 | CRÍTICO |
| UI-A30 | Planner.html | "Preview" y "Export" | 561–562 | MEDIUM |
| UI-A31 | Planner.html | FAB: Annotation, Color, Background, Fullscreen | 646–650 | HIGH |
| UI-A32 | Physio.html | "Save treatment" | 289 | CRÍTICO |
| UI-A33 | Gym Library.html | "Add new exercise" | 345–349 | LOW |
| UI-A34 | Gym Planner.html | "Pull from VITRUVE" | 306 | LOW |
| UI-A35 | Gym Planner.html | "From library" (x3) | 240, 305, 396 | MEDIUM |
| UI-A36 | Gym Planner.html | "Add exercise" (x3) | 294, 386, 439 | MEDIUM |
| UI-A37 | Sessions History.html | "dupSess()" handler vacío | 442 | HIGH |

**Total botones muertos: 37**

---

## CATEGORÍA B — Filtros y tabs CSS-only (visualmente activos, sin efecto en datos)

| ID | Archivo | Elemento | Línea | Debería hacer |
|----|---------|----------|-------|---------------|
| UI-B01 | Chat & Tasks.html | Task filter pills (All/Mine/Match-day/Medical/Routine) | 403–407 | Re-query tasks con WHERE category |
| UI-B02 | Sessions History.html | Filter checkboxes (Microcycle, MD position, Orientation...) | 455–459 | Re-query sessions con filtros activos |
| UI-B03 | Sessions Library.html | Focus pills (Tactical/Physical/Conditional/Technical) | 492–495 | Filtrar grid por session.focus |
| UI-B04 | Sessions Library.html | Grid/List/By-focus view toggle | 496–499 | Cambiar layout del contenedor |
| UI-B05 | Daily Planning.html | Squad filter pills (All/Available/Partial/Unavailable/Away) | 331–335 | Filtrar lista de jugadores por status |
| UI-B06 | Evaluations.html | Tabs (subj/phys/squad/trends/templates/history) | 455 | Mostrar/ocultar secciones + cargar datos |
| UI-B07 | Gym Library.html | Muscle group chips toggle | 426–433 | Re-query exercises por muscle_group |
| UI-B08 | Admin.html | Module toggles (Planner, Sessions lib, Squad...) | 747–757 | UPDATE club_settings.modules_enabled |
| UI-B09 | Match Reports.html | Import provider selection (Wyscout, InStat...) | 1037–1040 | Iniciar flujo OAuth o upload |
| UI-B10 | GPS Analysis.html | Data source connector status | 599–604 | Verificar OAuth token real |

**Total filtros/tabs CSS-only: 10**

---

## CATEGORÍA C — Interacciones CSS-only en canvas/editor

| ID | Archivo | Elemento | Línea | Problema |
|----|---------|----------|-------|---------|
| UI-C01 | Planner.html | Click en objeto del campo → agrega clase CSS | 804–808 | No abre panel de propiedades |
| UI-C02 | Planner.html | Dock buttons (Teams/Objects/Lines/Zones/Text) | 657–688 | Selección visual pero no inserta objeto en campo |
| UI-C03 | Planner.html | DRAG en cualquier objeto del canvas | Todo el canvas | No hay event listeners de mouse |
| UI-C04 | Planner.html | Arrows/lines en el campo | 628–642 | SVG estático, no se puede mover/editar |
| UI-C05 | Physio.html | SVG body zone click | 452–468 | Actualiza Set local pero nunca llega a DB |

**Total canvas/editor sin implementación: 5**

---

## CATEGORÍA D — Kanban y drag-and-drop no implementados

| ID | Archivo | Elemento | Severidad |
|----|---------|----------|-----------|
| UI-D01 | Chat & Tasks.html | Kanban drag-and-drop entre columnas | HIGH |
| UI-D02 | Chat & Tasks.html | "..." menu en cada columna kanban | MEDIUM |
| UI-D03 | Chat & Tasks.html | "..." menu en cada task card | MEDIUM |

---

## CATEGORÍA E — Fake loaders y success states

| ID | Archivo | Elemento | Línea | Problema |
|----|---------|----------|-------|---------|
| UI-E01 | Calendar.html | "Microcycle Daily Plan Loading…" | ~580 | Puede ser loader permanente si query falla |
| UI-E02 | RPE.html | Success animation 2.5s hardcodeada | 661–665 | No espera confirmación de DB |
| UI-E03 | Planner.html | Rival picker "animación" | 811–836 | Demo con rotación de hue, no datos reales |

---

## RESUMEN

| Categoría | Count | % |
|-----------|-------|---|
| A — Botones muertos | 37 | 64% |
| B — Filtros CSS-only | 10 | 17% |
| C — Canvas sin implementar | 5 | 9% |
| D — Kanban no implementado | 3 | 5% |
| E — Fake loaders/states | 3 | 5% |
| **TOTAL** | **58** | 100% |

---

## IMPACTO POR MÓDULO

| Módulo | Funcionalidad real estimada | Interacciones fake |
|--------|----------------------------|-------------------|
| Planner | 10% | Canvas completo, toolbar, dock, drills, persist |
| Daily Planning | 20% | Squad, ejercicios, todos los action buttons |
| Calendar | 25% | Season ribbon, upcoming events, workload chart |
| Chat & Tasks | 40% | Filtros, drag-drop, toolbar de composer |
| Admin | 35% | Org/clubs grid, module toggles |
| Gym Planner | 25% | Exercise rows, action buttons |
| Physio | 30% | Save treatment, body zones |
| Login/Register | 50% | Google OAuth roto en ambas páginas |
| Evaluations | 45% | Tabs, scores hardcodeados |
| Sessions History | 50% | Filtros, dupSess |
| GPS Analysis | 35% | Charts, radar, z-scores |
| Load Monitor | 50% | ACWR chart, alert banner |
