# DEAD CODE REPORT — ClavaMetrics
**Fecha:** 2026-05-21  

Código, archivos y elementos que no tienen función real en el estado actual del proyecto.

---

## SECCIÓN 1 — ARCHIVOS COMPLETAMENTE LEGACY/DUPLICADOS

| Archivo/Directorio | Tamaño | Motivo de eliminación |
|--------------------|--------|----------------------|
| `Clavametrics old/` | ~63 archivos | Versión anterior completa del proyecto, reemplazada por los HTML actuales |
| `ClavaMetrics New/` | ~20 archivos | Duplicado del directorio raíz actual, sin diferencias funcionales |
| `index.html` (raíz) | 61KB | Versión antigua del Hub.html. El Hub.html actual (54KB) es la versión activa. index.html tiene estructura completamente diferente. |

**Acción: Eliminar o mover a `/archive/`**

---

## SECCIÓN 2 — ARCHIVOS FUERA DE LUGAR EN ROOT

Estos archivos no son parte del código de la app y contaminan el directorio raíz:

| Archivo | Tipo | Mover a |
|---------|------|---------|
| `DATOS_EJEMPLO.sql` | SQL seed data | `docs/db/` o eliminar |
| `MIGRATION_FORWARD.sql` | Migration script | `docs/migrations/` |
| `MIGRATION_ROLLBACK.sql` | Migration script | `docs/migrations/` |
| `MIGRATION_RISKS.md` | Documentación | `docs/` |
| `ORDEN_MIGRACION.md` | Documentación | `docs/` |
| `PLAN_MIGRACION_EJECUTIVO.md` | Documentación | `docs/` |
| `GUIA_IMPLEMENTACION.md` | Documentación | `docs/` |
| `INDICE_MIGRACION.md` | Documentación | `docs/` |
| `SCHEMA_COMPARISON.md` | Documentación | `docs/` |
| `SCHEMA_NUEVO_DESDE_CERO.sql` | SQL schema | `docs/db/` |
| `AdobeStock_213595107.ai` | Asset de diseño (1MB) | Fuera del repo o `design/` |
| `AdobeStock_858843878.ai` | Asset de diseño (5.7MB) | Fuera del repo o `design/` |
| `Captura de pantalla 2026-05-17*.png` | Screenshot personal (84KB) | Eliminar del repo |

---

## SECCIÓN 3 — FUNCIONES DEFINIDAS PERO VACÍAS O INÚTILES

| Archivo | Función | Línea | Estado |
|---------|---------|-------|--------|
| Sessions History.html | `dupSess(e)` | 442 | Solo llama `e.stopPropagation()`, no hace nada más |
| Planner.html | Canvas drag handlers | — | Sin implementar — no hay `mousedown`/`mousemove`/`mouseup` en objetos del campo |
| Planner.html | `save()` para drills | — | No existe — datos del canvas nunca se persisten |
| Chat & Tasks.html | Filter pills handlers | 403–407 | Togglean clase CSS, no conectan a query |

---

## SECCIÓN 4 — CÓDIGO DE DEMOSTRACIÓN QUE NUNCA SE CONECTARÁ

| Archivo | Elemento | Línea | Descripción |
|---------|----------|-------|-------------|
| Planner.html | Rival picker (hue rotation) | 811–836 | Cicla por 5 equipos fake rotando el hue del mismo asset. Demo permanente. |
| ios-frame.jsx | Keyboard JSX | 296–338 | Teclado iOS decorativo. No conecta a ningún input. |
| ios-frame.jsx | Autocorrect chips | 296–305 | `['"The"', 'the', 'to']` — placeholders hardcodeados sin función. |
| Gym Planner.html | "Pull from VITRUVE" | 306 | Botón de integración hardware. No hay API conectada. |
| GPS Analysis.html | Connector status display | 599–604 | "Token expired" / "Connected" — no verifica estado real de OAuth. |

---

## SECCIÓN 5 — ELEMENTOS HTML SIN USO FUNCIONAL

| Archivo | Elemento | Línea | Descripción |
|---------|----------|-------|-------------|
| settings-drawer.jsx | Tabs Notifications/Account/Billing | 148–153 | 3 de 4 tabs no tienen contenido renderizado |
| Hub.html | Hardcoded activity items | 722–763 | HTML de demo reemplazado por JS — el fallback nunca debería verse |
| Hub.html | Hardcoded task items | 778–817 | Idem — HTML de demo |
| Calendar.html | 14 MC bars hardcodeadas | 504–517 | HTML de demo en producción |
| Calendar.html | 9 match markers | 525–538 | HTML de demo en producción |
| Calendar.html | 6 upcoming events | 627–676 | HTML de demo en producción |
| Daily Planning.html | 27 player rows | 339–377 | HTML de demo — nunca debería estar en producción |
| Daily Planning.html | 3 drill cards con SVG | 422–520 | HTML de demo |
| Planner.html | 4 drill cards | 479–513 | HTML de demo |
| Admin.html | 6 club cards | 344–462 | HTML de demo |
| Gym Library.html | 12 exercise cards | 168–343 | HTML de demo |
| Gym Planner.html | 14 exercise rows | 252–436 | HTML de demo |

---

## SECCIÓN 6 — PROVEEDORES Y CONTEXTOS SIN CONSUMIDORES

En este proyecto basado en HTML plano no hay React Context, pero hay patrones equivalentes:

| Patrón | Archivo | Descripción |
|--------|---------|-------------|
| `window.__WELLNESS_CTX` | Wellness.html | Context object inicializado con valores placeholder |
| `window.sb` | Todos los HTML | Global Supabase client — correcto, pero algunos archivos lo definen localmente también |
| `window.__SESS` | Daily Planning.html | Sesión global que podría no estar sincronizada |

---

## SECCIÓN 7 — DOBLE DEFINICIÓN DE SUPABASE CLIENT

El cliente de Supabase se inicializa en `assets/supabase-init.js` pero varios HTML pueden tener su propia inicialización inline. Verificar duplicación en:
- Hub.html
- Calendar.html  
- Admin.html
- Planner.html

**Regla:** Un solo `window.sb = supabase.createClient(URL, KEY)` en `supabase-init.js`. Ningún HTML debe inicializar su propio cliente.

---

## RESUMEN

| Categoría | Items a eliminar/mover |
|-----------|----------------------|
| Archivos legacy/duplicados | 3 |
| Archivos mal ubicados en root | 13 |
| Funciones vacías | 4 |
| Código demo permanente | 5 |
| HTML demo en producción | 12 |
| Tabs/sections sin contenido | 4 |
| **TOTAL** | **41** |
