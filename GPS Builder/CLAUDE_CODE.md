# Guía para Claude Code — integrar GPS Builder a la app existente

> **Leé esto primero, Claude Code.** Esta carpeta contiene el **diseño de referencia** (un prototipo en HTML/CSS/JS) y la **especificación de migración** de una sección nueva para *GPS analysis*. NO copies el HTML tal cual a producción: **recreá el diseño y la lógica dentro del codebase existente**, usando sus patrones, su framework y sus componentes de charts ya hechos. Trabajá **de forma aditiva y por fases**, sin romper lo que ya corre.

---

## Qué es cada cosa en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `GPS Analysis Builder.html` + `*.css` + `gps-dash.js`, `gp-core.js` | **Prototipo de referencia.** Muestra el look & feel y el comportamiento exactos: tabs = dashboards, panel Setup/Style, drag&drop de métricas, estados, generador IA. Leé `gps-dash.js` y `gp-core.js` para entender la lógica (catálogo, tipos, regla pico, render, CONFIG). |
| `MIGRATION.md` | **Plan de integración** completo: tablas nuevas, endpoints, resolver, rollout por fases con feature flags. |
| `handoff/gp.card.schema.json` | **Contrato** del objeto CONFIG (`gp.card/v1`). Validar con Ajv en cliente y servidor. |
| `handoff/config-to-query.ts` | **Resolver** (stub): traduce un CONFIG en una query y normaliza el dataset. Adaptar a las tablas reales. |
| `handoff/ai-generate-card.md` | **System prompt** + orquestación del generador IA (con fallback al parser heurístico que está en `gps-dash.js` → función `parsePrompt`). |

**El concepto central:** todo (catálogo, constructor manual, IA) produce **el mismo objeto `gp.card/v1`**. Esa es la columna vertebral. Construí alrededor del contrato.

---

## Reglas de seguridad (no romper lo existente)

1. **Migraciones de base de datos solo ADITIVAS**: `CREATE TABLE` / columnas nuevas nullable. Nunca `DROP` ni `ALTER` destructivo en tablas existentes.
2. **Feature flag**: toda la UI nueva detrás de un flag por club/usuario. El camino viejo queda intacto. Rollback = apagar el flag.
3. **Commit de git al final de cada fase** (idealmente en una branch nueva). Probar antes de avanzar a la siguiente fase.
4. **Validación en el servidor** siempre autoritativa (schema + reglas de negocio).
5. **No reescribir** la página `GPS analysis` existente: **agregar** el builder como componentes nuevos, reutilizando los componentes de chart que ya existen.

---

## Plan por fases (implementar en este orden, probando entre cada una)

### Fase 0 — Contrato + dominio (sin UI)
- Copiar `handoff/gp.card.schema.json` al repo. Instalar `ajv`. Crear `validateCard(config)`.
- Portar de `gp-core.js`: catálogo de métricas, tipos de viz, agregaciones, **regla pico/acumulable** y validación de conteo por tipo → a `lib/gp-card/`.
- El catálogo de métricas debe salir de la **base de datos**, no hardcodeado (crear `metric_catalog` si hace falta, con columna `kind` = peak/accum).

### Fase 1 — Builder aislado (detrás de flag)
- Recrear el **panel Setup/Style** (ver `gps-dash.js` + `builder-studio.css`) como componente del framework del proyecto.
- Montarlo dentro de *GPS analysis* detrás del feature flag. Las cards predefinidas siguen igual.

### Fase 2 — Persistencia
- Crear tablas `dashboards` y `dashboard_cards (config jsonb)` (ver `MIGRATION.md` §2).
- Endpoints CRUD (ver `MIGRATION.md` §3).
- Implementar el **resolver** (`handoff/config-to-query.ts`) contra las tablas reales del warehouse → las cards dejan de ser mock.
- **Backfill**: convertir las cards predefinidas actuales a `gp.card/v1` y sembrar los dashboards por defecto (dual-read durante la transición).

### Fase 3 — Gestión de dashboards
- Tabs como dashboards: crear (`+`), renombrar, duplicar, eliminar, reordenar. Editar layout: reordenar/borrar cards + drag&drop de métricas (ver `gps-dash.js`).

### Fase 4 — Generador IA
- Endpoint `POST /api/ai/generate-card` con `handoff/ai-generate-card.md` (inyectar catálogo, validar salida, revisión humana en el editor). Fallback: `parsePrompt`.

### Fase 5 — GA
- Quitar el flag por club a medida que hay paridad. Rollback siempre disponible.

---

## Cómo arrancar (para el usuario)

Abrí Claude Code en la raíz de tu proyecto y pegale **un mensaje por fase**, probando entre cada uno. Empezá con este:

> **Prompt Fase 0:**
> "Leé `GPS Builder/CLAUDE_CODE.md`, `GPS Builder/MIGRATION.md` y `GPS Builder/handoff/`. Implementá **solo la Fase 0** (contrato + capa de dominio), sin tocar UI ni nada existente. Antes de escribir código, decime qué stack detectaste en mi repo (frontend, backend, base de datos) y cómo vas a encarar la Fase 0. Hacé las migraciones solo aditivas y dejá todo en una branch nueva con un commit al final."

Cuando termine y pruebes, seguís con *"ahora la Fase 1"*, y así.
