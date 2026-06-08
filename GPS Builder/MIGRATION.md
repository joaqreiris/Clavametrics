# Migración a producción — GPS Chart Builder + Dashboards + IA

> Plan para insertar esta sección en la app de ClavaMetrics que ya corre (DB, estructuras y código en producción) **sin romper lo existente**.
> Supuestos de stack (ajustá a lo tuyo): **Postgres** como base, backend **Node/TypeScript** (o similar) y frontend **React**. Si usás otro stack, los conceptos (contrato, tablas, resolver, flags) se trasladan igual.

---

## 0. Principio rector: el contrato `gp.card/v1` es la columna vertebral

Todo lo que construimos emite **el mismo objeto CONFIG**. No migres "el builder"; migrá **el contrato** y conectá las tres fuentes a él:

```
catálogo (GP_CATALOG)  ─┐
constructor manual      ├──►  CONFIG gp.card/v1  ──►  validación  ──►  resolver datos  ──►  componente de chart
generador IA           ─┘                                        (mismo pipeline para los 3)
```

Forma del objeto (la que ya produce el prototipo):

```jsonc
{
  "schema": "gp.card/v1",
  "title": "High-speed running",
  "viz": "bars",                         // kpi|bars|line|scatter|radar|ranking|table|heatmap
  "scope": { "level": "player" },        // player|squad
  "metrics": [
    { "id": "high_speed_distance", "agg": "total", "kind": "accum", "unit": "m", "custom": false }
  ],
  "range": { "type": "mc" },             // mc|w7|w30|season  (o un rango de fechas explícito)
  "comparison": { "baseline": "role" },  // role|match|md | null
  "style": { "size": "md", "color": "#15803D", "palette": "pitch",
             "axes": true, "legend": true, "dataLabels": false }
}
```

**Regla de oro:** ese objeto se **valida contra un JSON Schema** al escribir y al leer. El `schema` versionado (`gp.card/v1`) te permite evolucionar sin romper cards viejas.

---

## 1. Mapa: artefactos del prototipo → módulos de producción

| Prototipo (este proyecto) | Producción | Qué es |
|---|---|---|
| `gp-core.js` (`window.GP`) | `lib/gp-card/` (catalog, types, rules, validate, buildConfig) | **Capa de dominio compartida.** Catálogo, tipos de viz, reglas pico/acumulable, validación. Sin UI. |
| `renderType()` en `gp-core.js` | **Reusá tus componentes de chart existentes** | En prod NO uses el SVG del prototipo: mapeá CONFIG → tus 8 visualizaciones ya hechas. |
| Panel Setup/Style + flyout + popovers (`gps-dash.js`, `builder-studio.css`) | `<ChartBuilderPanel/>` (React) | El editor lateral. |
| Tabs = dashboards + grid + add/edit/delete/reorder | `<DashboardTabs/>`, `<CardGrid/>`, `<Card/>` | Gestión de dashboards y cards. |
| Modal IA + `parsePrompt()` | `<AiGenerateModal/>` + endpoint `/ai/generate-card` | El parser local pasa a ser **fallback**; producción usa el modelo. |
| Estados loading/empty/error/no-data | mismos estados, alimentados por el resolver real | El "sin datos" deja de ser mock y sale de la query. |

---

## 2. Base de datos — qué crear (todo **aditivo**, no rompe nada)

Migraciones nuevas, columnas nullable, cero cambios destructivos sobre tablas existentes.

### 2.1 Registro de métricas (si aún no existe como tabla)
La **regla pico/acumulable** debe ser *data-driven*, no hardcodeada. Si hoy las métricas core viven en código, creá un registro:

```sql
CREATE TABLE metric_catalog (
  id            text PRIMARY KEY,           -- 'high_speed_distance'
  name          text NOT NULL,
  unit          text NOT NULL,              -- 'm', 'km', '#', 'km/h'
  kind          text NOT NULL CHECK (kind IN ('accum','peak')),
  group_name    text,                       -- 'High intensity'
  is_custom     boolean NOT NULL DEFAULT false,
  club_id       uuid REFERENCES clubs(id),  -- null = core/global; set = custom EAV del club
  created_at    timestamptz DEFAULT now()
);
```
> Las **custom (EAV)** que ya tenés se exponen acá con `is_custom=true` y su `club_id`. El builder lee core + custom desde este endpoint.

### 2.2 Dashboards
```sql
CREATE TABLE dashboards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES clubs(id),
  owner_id     uuid REFERENCES users(id),     -- null = compartido/club
  report_type  text,                          -- 'player_week' | 'session_control' | ... (las "tabs")
  name         text NOT NULL,
  scope        text NOT NULL DEFAULT 'player', -- player|squad
  sort_order   int  NOT NULL DEFAULT 0,
  is_shared    boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
```

### 2.3 Cards del dashboard
```sql
CREATE TABLE dashboard_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  config        jsonb NOT NULL,                -- el objeto gp.card/v1
  size          text NOT NULL DEFAULT 'md',    -- sm|md|lg|full (también en config.style)
  position      int  NOT NULL DEFAULT 0,       -- orden en la grilla
  source        text NOT NULL DEFAULT 'builder' CHECK (source IN ('catalog','builder','ai')),
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX ON dashboard_cards (dashboard_id, position);
-- valida la forma del config a nivel DB (defensa en profundidad):
-- ALTER TABLE dashboard_cards ADD CONSTRAINT cfg_schema CHECK (config->>'schema' = 'gp.card/v1');
```

### 2.4 Plantillas de cards reutilizables (el "queda en Add card → catálogo")
Para que una card construida se pueda re-agregar como en el catálogo:
```sql
CREATE TABLE card_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id),
  name        text NOT NULL,
  config      jsonb NOT NULL,
  source      text NOT NULL DEFAULT 'builder',
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);
```
> Si tu `GP_CATALOG` actual ya es una tabla, podés simplemente **agregarle** estas filas (con `source` y `config`) en vez de crear `card_templates`.

### 2.5 Auditoría de IA (necesaria para el escalón IA)
```sql
CREATE TABLE ai_card_generations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid REFERENCES clubs(id),
  user_id       uuid REFERENCES users(id),
  prompt        text NOT NULL,
  produced      jsonb,           -- el CONFIG sugerido
  model         text,            -- 'claude-...'
  valid         boolean,         -- pasó validación de schema+reglas
  accepted      boolean,         -- el usuario lo guardó
  created_at    timestamptz DEFAULT now()
);
```

**Lo que NO se toca:** tus tablas de sesiones GPS, hechos/medidas, jugadores, etc. El builder solo **lee** de ahí vía el resolver (sección 4).

---

## 3. API — endpoints nuevos

```
# catálogo de métricas (core + custom del club) — alimenta el flyout y el validador
GET   /api/metrics/catalog?clubId=...        -> [{id,name,unit,kind,group,custom}]

# dashboards (las tabs)
GET   /api/dashboards?clubId=&scope=&playerId=
POST  /api/dashboards                         { name, reportType, scope }
PATCH /api/dashboards/:id                      { name? , sortOrder? }
POST  /api/dashboards/:id/duplicate
DELETE/api/dashboards/:id

# cards
GET   /api/dashboards/:id/cards
POST  /api/dashboards/:id/cards                { config, size, position, source }
PATCH /api/cards/:id                           { config?, size?, position? }
DELETE/api/cards/:id
PATCH /api/dashboards/:id/cards/reorder        [{id, position}, ...]

# resolución de datos de una card (lo que el prototipo mockea)
POST  /api/cards/resolve                       { config }  -> { series | rows | value, meta }

# IA
POST  /api/ai/generate-card                    { prompt, context } -> { config, rationale }
```

Validá **siempre en el servidor** el `config` contra el JSON Schema + reglas de negocio (existencia de métricas, `min/max` de métricas por tipo, **regla pico**). El cliente valida para UX; el servidor es la autoridad.

---

## 4. El resolver de datos (el corazón de "llenar la card con datos reales")

Es la pieza que en el prototipo está mockeada. Una función pura **`configToQuery(config) → SQL/agg`**:

1. **Valida** métricas y que `agg` sea válida para el `kind` (pico ⇒ solo avg/max/min).
2. Arma la agregación sobre tus **hechos GPS** según `scope` (jugador vs plantel), `range` (MC/fechas) y `comparison` (baseline rol / match / MD code).
3. Devuelve `series`/`rows`/`value` + `meta` (unidades, baseline, z-scores).
4. **Caso sin datos** (p. ej. métrica custom EAV a nivel plantel) ⇒ devolvé vacío + `reasonCode`; el front muestra el estado *No data* que ya diseñamos.

```
CONFIG ─► validate() ─► configToQuery() ─► warehouse ─► normalize() ─► dataset ─► <ChartType dataset/>
```

> Reutilizá tus **componentes de chart existentes** de GPS analysis para el render final; el builder solo cambia *qué dataset* les llega.

---

## 5. Cómo emplear el modelo de IA (de forma segura)

La IA es segura **porque solo puede emitir un CONFIG** — nunca SQL ni acceso directo a datos.

1. **Salida estructurada**: pedile al modelo que devuelva exactamente `gp.card/v1` (response JSON Schema / tool-use / function calling). 
2. **Contexto inyectado** en el system prompt: el **catálogo de métricas** del club (id, unidad, kind), los **tipos de viz** con su `min/max` de métricas, las **agregaciones** y la **regla pico**, y los enums de scope/compare/range. Así no inventa métricas ni agregaciones inválidas.
3. **Validación post-modelo** (idéntica a la del builder): schema + reglas. Si falla, *auto-repair* (un reintento con el error) o caés al *parser heurístico* (el que ya tenemos como fallback offline).
4. **Human-in-the-loop**: el CONFIG generado **abre en el mismo editor** para revisar y recién ahí *Guardar*. Igual que en el prototipo. La IA propone, el usuario confirma.
5. **Operación**: registrar en `ai_card_generations` (prompt, config, válido, aceptado) para evaluación y mejora; **rate-limit**; **no enviar PII** del atleta al modelo, solo metadatos del catálogo + el prompt.

Sketch del contrato del endpoint:
```
POST /api/ai/generate-card
body:  { prompt: "top sprinters this microcycle", context: { clubId, playerId, reportType } }
->     { config: { schema:"gp.card/v1", ... }, rationale: "Ranking por sprint_distance, scope plantel, MC actual" }
```

---

## 6. Plan de rollout — incremental y sin romper

| Fase | Qué entra | Riesgo | Cómo se protege |
|---|---|---|---|
| **0 · Dominio** | `lib/gp-card` (catálogo, validación, JSON Schema). Sin UI. | Nulo | Solo código nuevo, no referenciado aún. |
| **1 · Builder aislado** | `<ChartBuilderPanel/>` detrás de **feature flag**, dentro de GPS analysis. Cards predefinidas siguen igual. | Bajo | Flag por club/usuario; el path viejo intacto. |
| **2 · Persistencia** | Tablas `dashboards`/`dashboard_cards` + endpoints. **Backfill**: convertir layouts/predefinidas actuales a filas `gp.card/v1` (sección 7). | Medio | Migración aditiva; *dual-read* (si no hay fila, caé al layout viejo). |
| **3 · Gestión dashboards** | Tabs crear/renombrar/duplicar/eliminar + reorder + DnD. | Bajo | Detrás del mismo flag. |
| **4 · IA** | `/ai/generate-card` + modal, con validación y auditoría. | Medio | Flag aparte; fallback al parser heurístico; revisión humana obligatoria. |
| **5 · GA** | Quitar flags por club a medida que hay paridad; retirar path viejo. | — | Rollback = apagar flag. |

**Reglas para no romper:**
- Migraciones **solo aditivas** (tablas/columnas nuevas, nullable). Nada de `DROP`/`ALTER` destructivo en esta fase.
- **Feature flags** por club; rollback = apagar flag.
- **Validación server-side** autoritativa del CONFIG.
- **CONFIG versionado** (`gp.card/v1`) + migrador de versión cuando saques `v2`.
- Reutilizar componentes de chart existentes ⇒ consistencia visual y menos superficie nueva.

---

## 7. Backfill de lo existente (que nada cambie a la vista)

1. Mapear cada card **predefinida** del `GP_CATALOG` actual a un `config` `gp.card/v1` (script de migración idempotente).
2. Crear, por club/usuario, los **dashboards por defecto** (las tabs actuales: Player Week Report, Session Control, …) con sus cards en `dashboard_cards` y `source='catalog'`.
3. *Dual-read* durante la transición: si un usuario no tiene filas nuevas, renderizar el layout viejo; si las tiene, el nuevo.
4. Cuando hay paridad, el path viejo se retira.

---

## 8. Checklist de calidad antes de GA

- [ ] JSON Schema `gp.card/v1` publicado y usado en cliente **y** servidor.
- [ ] **Contract test**: salida del builder manual ≡ forma de salida de la IA ≡ catálogo.
- [ ] Tests del `resolver` (snapshots por tipo de viz + caso *no-data*).
- [ ] Regla **pico/acumulable** verificada en validación server-side.
- [ ] RBAC: quién edita/borra dashboards compartidos vs propios.
- [ ] Autosave + UI optimista + manejo de error de red.
- [ ] e2e: add / edit / delete / reorder / switch tab / crear-eliminar dashboard / generar IA.
- [ ] Auditoría IA + rate limit + sin PII al modelo.

---

### TL;DR
1. **Portá el contrato `gp.card/v1`** (validación incluida) como capa de dominio: es lo único que las 3 fuentes comparten.
2. **Tablas nuevas aditivas**: `dashboards`, `dashboard_cards (config jsonb)`, `card_templates`, `ai_card_generations`, y `metric_catalog` si la regla pico no está ya en datos. No tocás tus tablas de datos GPS.
3. **Resolver `configToQuery`** = lo único "nuevo de verdad": traduce CONFIG → query sobre tu warehouse y alimenta tus charts existentes.
4. **IA = solo emite CONFIG**, validado y revisado por humano; reusa todo el pipeline. Parser heurístico como fallback.
5. **Rollout por fases detrás de feature flags**, migraciones aditivas, validación server-side, backfill con dual-read. Rollback = apagar flag.
