# GPS Builder — implementación final

Sección nueva de **GPS analysis**: dashboards como pestañas + constructor de charts (Looker-style) + generador IA. Todo produce el mismo CONFIG `gp.card/v1`.

## Cómo correr
1. Abrí esta carpeta en VSCode.
2. Extensión **Live Server** → click derecho en **`GPS Analysis Builder.html`** → *Open with Live Server*.
   (También abre con doble click vía `file://`. Requiere internet para fuentes/íconos por CDN.)

## Archivos
**App (necesarios para correr):**
- `GPS Analysis Builder.html` — la página (único HTML final)
- `clavametrics.css` — tokens/design system del proyecto
- `chart-builder.css`, `builder-inline.css`, `builder-studio.css`, `gps-dash.css` — estilos
- `gp-core.js` — capa de dominio (catálogo, tipos, reglas, render, CONFIG)
- `gps-dash.js` — lógica de la página (tabs, builder, DnD, IA)
- `assets/field.jpg` — imagen de cancha (opcional)

**Documentación para producción:**
- `MIGRATION.md` — plan de integración a tu app real (sin romper nada)
- `handoff/` — `gp.card.schema.json`, `config-to-query.ts` (resolver), `ai-generate-card.md` (prompt IA)

> Nota: los archivos `GPS Chart Builder v1/v2/v3`, `v1 (panel)` y `GPS Chart Builder.html` del proyecto eran **iteraciones intermedias** y NO se incluyen acá. `GPS Analysis.html` es tu página original (tampoco va — no se modifica).
