# Bloque 7 — Métricas Custom por Club (modelo híbrido core + extensible)

> **Archivos afectados:** `GPS Analysis.html`, modal de import, gráficos del dashboard, nuevos archivos `assets/gps-reader.js` y migración SQL.
> **Stack:** HTML + JS vanilla, Supabase via `window.sb`.
> **Dependencias:** Bloques 1–6 ya deben estar funcionando (upload, mapping, matching, persistence, gráficos, baseline).

---

## 🎯 Objetivo

Implementar un sistema donde cada club puede definir sus propias métricas de GPS además de las core, sin que un programador agregue columnas o código. El usuario sube un archivo con métricas nuevas y las define al vuelo.

### Justificación

Los proveedores de GPS exportan cientos de métricas (Catapult Vector ~400, StatSports ~200, WIMU otras tantas). Hardcodear columnas en `gps_reports` no escala. La solución es un **modelo híbrido**:

- Las 8–10 métricas **core** (universales, usadas en todos los gráficos) se quedan en columnas.
- Las demás se definen por club en un catálogo y se guardan en una tabla **EAV** (Entity-Attribute-Value).

---

## 📦 PASO 1 — Modelo de datos: dos tablas nuevas

### Tabla 1: Catálogo de métricas por club

```sql
CREATE TABLE gps_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  unit text,
  category text NOT NULL DEFAULT 'custom',
  description text,
  decimals integer NOT NULL DEFAULT 2,
  is_core boolean NOT NULL DEFAULT false,
  display_order integer DEFAULT 100,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (club_id, key),
  CHECK (category IN ('distance', 'speed', 'acceleration', 'load', 'time', 'count', 'custom'))
);

CREATE INDEX idx_gps_metric_def_club ON gps_metric_definitions(club_id);
```

### Tabla 2: Valores extras de métricas por reporte

```sql
CREATE TABLE gps_report_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES gps_reports(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  value numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (report_id, metric_key)
);

CREATE INDEX idx_gps_rm_report ON gps_report_metrics(report_id);
CREATE INDEX idx_gps_rm_club_metric ON gps_report_metrics(club_id, metric_key);
```

### ✅ Checklist

- [ ] Migración aplicada en Supabase
- [ ] Las dos tablas existen con sus constraints
- [ ] Los índices están creados
- [ ] `database_schema.md` actualizado con ambas tablas

---

## 🌱 PASO 2 — Sembrar el catálogo con métricas core

Las 13 columnas core de `gps_reports` deben aparecer también en `gps_metric_definitions` con `is_core=true`. Esto unifica el catálogo: el usuario ve TODAS las métricas (core + custom) en un solo lugar.

### Script de seed (one-time para clubs existentes)

```sql
INSERT INTO gps_metric_definitions (club_id, key, label, unit, category, decimals, is_core, display_order)
SELECT id AS club_id, t.key, t.label, t.unit, t.category, t.decimals, true, t.ord
FROM clubs, (VALUES
  ('total_distance',          'Total Distance',  'm',     'distance',     0,  1),
  ('high_speed_distance',     'HSR',             'm',     'distance',     0,  2),
  ('very_high_speed_distance','VHSR',            'm',     'distance',     0,  3),
  ('sprint_distance',         'Sprint Distance', 'm',     'distance',     0,  4),
  ('sprint_count',            'Sprint Count',    'n',     'count',        0,  5),
  ('max_speed',               'Max Speed',       'km/h',  'speed',        1,  6),
  ('avg_speed',               'Avg Speed',       'km/h',  'speed',        1,  7),
  ('accelerations',           'Accelerations',   'n',     'count',        0,  8),
  ('decelerations',           'Decelerations',   'n',     'count',        0,  9),
  ('player_load',             'Player Load',     'AU',    'load',         1, 10),
  ('hmld',                    'HMLD',            'm',     'load',         0, 11),
  ('time_played',             'Time Played',     'min',   'time',         0, 12),
  ('distance_per_minute',     'Distance / Min',  'm/min', 'distance',     1, 13)
) AS t(key, label, unit, category, decimals, ord)
ON CONFLICT (club_id, key) DO NOTHING;
```

### Trigger para clubs nuevos

Crear un trigger o function que ejecute el seed automáticamente al insertar un nuevo club en `clubs`. De esa forma cualquier club nuevo nace con su catálogo core completo.

### ✅ Checklist

- [ ] Script de seed corrido para clubs existentes
- [ ] Verificado en Supabase: cada club tiene 13 entradas con `is_core=true`
- [ ] Trigger o function creada para clubs futuros

---

## 🔄 PASO 3 — Refactor del modal de import

El modal hoy tiene 3 pasos: column mapping, player matching, session info. Modificar **solo el paso 1** (column mapping).

### Orden de matching automático

Al cargar las columnas del archivo, intentar match en este orden:

1. Contra `gps_column_mappings` existentes del mismo club + source_label (memoria de imports anteriores).
2. Contra el catálogo `gps_metric_definitions` del club (matching del label normalizado: lowercase, sin acentos, sin paréntesis ni unidades).
3. Contra un dictionary de aliases built-in para las core (ej. "TD", "Total Dist", "Distancia Total" → `total_distance`).

### UI del select por columna

Para cada columna del archivo, mostrar un `<select>` con tres grupos de opciones:

- **Core metrics** — las `is_core=true` del catálogo del club.
- **Custom metrics** — las `is_core=false` del catálogo del club.
- **Special** — "Ignore this column", "Create new metric...".

### Mini-form "Create new metric..."

Al elegir esa opción, abrir inline un form:

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Label | text | ✅ | El `key` se autogenera como slug del label |
| Unit | text | ❌ | Ej. "m", "km/h", "AU", "%" |
| Category | select | ✅ | distance, speed, acceleration, load, time, count, custom |
| Decimals | number | ✅ | Default 2, rango 0–4 |
| Description | textarea | ❌ | Opcional |

Al guardar: INSERT en `gps_metric_definitions`, queda preseleccionada para esa columna, y aparece inmediatamente en futuras importaciones del mismo club.

### Visual

- Verde → matcheada a core
- Celeste → matcheada a custom
- Violeta o accent → "Create new" disponible
- Gris → "Ignore"

### ✅ Checklist

- [ ] El orden de matching funciona (probar con un archivo conocido)
- [ ] El select muestra las tres categorías agrupadas
- [ ] "Create new metric" abre el form y persiste
- [ ] Los colores visuales son claros

---

## 💾 PASO 4 — Refactor del UPSERT (extiende Bloque 4)

Modificar el insert de `gps_reports` para que **separe core de custom**:

### Pseudocódigo del flujo

```
for each player matched:
  build core_row  = { club_id, player_id, session_id, ...core metrics from mapping }
  build extras    = [{ metric_key, value }] for each non-core mapped column

UPSERT core_rows into gps_reports
  → returns inserted/updated ids (use RETURNING *)

for each row, get its report_id
UPSERT into gps_report_metrics with the extras, linking by report_id
  → ON CONFLICT (report_id, metric_key) DO UPDATE SET value = EXCLUDED.value
```

### Reglas importantes

- Si una métrica del archivo está mapeada a un `metric_key` que **no existe** en `gps_metric_definitions`, abortar y mostrar error.
- Usar **batch** para performance: una sola query de UPSERT por tabla, no una por jugador.
- Los UPSERT usan las constraints únicas existentes: `(player_id, session_id)` en `gps_reports` y `(report_id, metric_key)` en `gps_report_metrics`.

### ✅ Checklist

- [ ] Subir un archivo con métricas mixtas (core + custom)
- [ ] Verificar en Supabase: `gps_reports` tiene las core, `gps_report_metrics` tiene las custom
- [ ] Re-importar el mismo archivo no genera duplicados (UPSERT real)

---

## 📖 PASO 5 — Lectura unificada (Reader API)

Crear archivo **`assets/gps-reader.js`** con una función central que abstrae el modelo híbrido.

### API esperada

```js
async function getReportsForSession({ clubId, sessionId, metricKeys = null }) {
  // metricKeys = null trae todas las métricas del catálogo del club
  // metricKeys = ['total_distance', 'playerload_slow'] trae solo esas

  // 1. Query gps_reports (core columns) + JOIN con players para info display
  // 2. Query gps_report_metrics filtrado por session y metric_keys (si custom)
  // 3. Mergear en una estructura uniforme:
  //    [
  //      {
  //        player_id,
  //        player: { name, number, position, ... },
  //        metrics: {
  //          total_distance: 10500,
  //          playerload_slow: 230,
  //          ...
  //        }
  //      },
  //      ...
  //    ]
}

async function getCatalog(clubId) {
  // Devuelve [{ key, label, unit, category, decimals, is_core, display_order }]
  // ORDER BY display_order, label
  // Cacheable en memoria por sesión del browser
}
```

### Punto clave

La función devuelve un objeto uniforme donde `metrics` es un dict por key, **sin importar si la métrica vive en columna core o en la tabla extras**. Los gráficos solo ven `report.metrics[metric_key]` y listo.

### Cache

- Cachear el catálogo en memoria del browser (cambia poco).
- Invalidar al crear/editar/eliminar definiciones.

### ✅ Checklist

- [ ] `assets/gps-reader.js` creado y exportando las dos funciones
- [ ] Probar: `getReportsForSession` devuelve estructura uniforme
- [ ] Cache del catálogo funciona y se invalida correctamente

---

## 📊 PASO 6 — Refactor de gráficos (Bloque 5) a métricas-agnósticos

Los gráficos hoy referencian columnas específicas hardcodeadas (ej. `report.total_distance`). Refactorizar para que usen `report.metrics[metric_key]` y consulten el catálogo para formato/unidad/decimales.

### Cambios concretos

- **Selectores de métricas** (pills del header, selectores de scatter, ranking, weekly volume, etc.) se pueblan dinámicamente desde `getCatalog(clubId)`. Ya no hay arrays hardcoded de `['Distance', 'HSR', ...]`.
- **Labels mostrados** vienen del catálogo (`label`).
- **Valores formateados** usando `decimals` y `unit` del catálogo.
- **Gráficos genéricos** (KPI card, scatter, ranking bar, radar) aceptan `metric_key` como parámetro y renderizan.

### Caso especial: baseline (Bloque 6)

`getMatchBaseline` ya recibe `metric` como parámetro. Refactorizar para que **también funcione con custom metrics** queryeando `gps_report_metrics` cuando metric no es core:

```js
const def = await getMetricDefinition(clubId, metric);
if (def.is_core) {
  // query gps_reports as before
} else {
  // query gps_report_metrics JOINed with gps_reports + training_sessions
}
```

### Validación

Si un gráfico intenta usar una métrica que no está en el catálogo del club, mostrar **"Metric not available"** en lugar de crashear.

### ✅ Checklist

- [ ] Selectores se llenan desde el catálogo
- [ ] Labels y unidades vienen del catálogo
- [ ] Crear una métrica custom y verla aparecer en los selectores
- [ ] `getMatchBaseline` funciona con métricas custom
- [ ] Estados de error manejados

---

## ⚙️ PASO 7 — UI de gestión del catálogo

Settings panel nuevo (accesible desde el drawer de Data sources, o como sección separada dentro del settings drawer existente).

### Sección "GPS metrics catalog"

Tabla con todas las métricas del club (core + custom):

| Columna | Notas |
|---|---|
| Label | Editable solo para custom |
| Key | Read-only siempre |
| Unit | Editable solo para custom |
| Category | Editable solo para custom |
| Decimals | Editable solo para custom |
| Source | Badge "Core" (gris) o "Custom" (accent) |
| Actions | Edit / Delete (solo custom) |

### Funciones

- **Add metric** — botón arriba de la tabla, mismo form que en el import.
- **Edit** — abre el form con los datos actuales.
- **Delete** — confirmación fuerte: *"This will remove the metric definition. Historical data linked to this metric will be kept but no longer visible. Type DELETE to confirm."*
- **Merge metrics** — si el usuario detecta que creó por error "Distance Total" y "Total Distance" como dos métricas distintas, merge mueve todas las filas de `gps_report_metrics` de una key a la otra y borra la duplicada. Confirmación fuerte.
- **Reordenamiento** — drag de filas o botones arriba/abajo para cambiar `display_order`, que afecta el orden en los selectores de los gráficos.

### ✅ Checklist

- [ ] UI accesible desde settings
- [ ] CRUD completo funcionando para métricas custom
- [ ] Core son read-only y no deletables
- [ ] Merge funciona y mueve datos correctamente
- [ ] Reordenar refleja en los selectores de gráficos

---

## 🔗 PASO 8 — Aliases avanzados y compatibilidad

### Aliases (extender `gps_column_mappings`)

Cuando el usuario mapea "TD (m)" del archivo Catapult al `metric_key` "total_distance", esto ya se guarda en `gps_column_mappings` (Bloque 2). Verificar que sigue funcionando con el modelo extendido.

**Importante:** aliases NO se duplican entre core y custom — `gps_column_mappings.target_metric` apunta al `key` del catálogo, sea core o custom.

### Migración de las core a `is_core` en el código existente

Algunas referencias deben cambiar:

- En el JS IIFE async del final de `GPS Analysis.html`, ya no hardcodear el array de `METRICS` para el radar. Leerlo del catálogo, filtrando por:
  - Categorías relevantes (distance + load + speed por default), o
  - Las métricas marcadas como activas en `club_gps_settings.active_metrics` (del Bloque 6).
- Los gráficos del Bloque 5 que tienen métricas implícitas también deben leer del catálogo.

### ✅ Checklist

- [ ] `gps_column_mappings` apunta correctamente al catálogo
- [ ] El JS IIFE existente lee métricas del catálogo
- [ ] Nada del código viejo está crasheando por columnas hardcoded

---

## 📏 Reglas generales del bloque

- **Multi-tenant:** `club_id` en TODAS las queries de las tres tablas nuevas.
- **Performance:** una sola query con LEFT JOIN trae todo (gps_reports + gps_report_metrics). Postgres lo resuelve bien con los índices propuestos. Probar con dataset realista (30 jugadores × 50 métricas).
- **Compatibilidad:** el código existente que accede a `report.total_distance` debe seguir funcionando. La nueva API `getReportsForSession` devuelve también las core en `report.metrics.total_distance`.
- **Cache:** catálogo cambia poco. Cachear en memoria del browser por session, invalidar al editar/crear/borrar.
- **Validaciones:**
  - `key` del catálogo: regex `/^[a-z][a-z0-9_]*$/`
  - `label` requerido
  - `category` de un set fijo
  - `decimals` entre 0 y 4
- **Design system:** sin emoji, sin colores nuevos.

---

## 🚫 NO hacer

- ❌ No cambiar el comportamiento user-facing del Bloque 5 más allá de que los selectores ahora muestren más opciones. Los gráficos siguen viéndose igual, solo más extensibles.
- ❌ No borrar columnas core de `gps_reports`. El modelo es **HÍBRIDO**, no full-EAV.
- ❌ No implementar todavía: visualización de métricas custom en otras páginas (Daily Planning, Wellness, etc.). Solo GPS Analysis usa el catálogo. La extensión a otras páginas es trabajo futuro.

---

## ✅ Entregables finales del Bloque 7

- [ ] **(a)** Migración aplicada: dos tablas nuevas, índices, seed del catálogo con métricas core para clubs existentes, trigger/function para sembrar al crear club nuevo.
- [ ] **(b)** Modal de import extendido con "Create new metric" inline.
- [ ] **(c)** UPSERT separado: core a `gps_reports`, custom a `gps_report_metrics`.
- [ ] **(d)** `assets/gps-reader.js` con `getReportsForSession` y `getCatalog` cacheado.
- [ ] **(e)** Gráficos del Bloque 5 refactoreados para ser métricas-agnósticos. Selectores poblados dinámicamente desde catálogo.
- [ ] **(f)** `getMatchBaseline` (Bloque 6) extendido para funcionar con custom metrics.
- [ ] **(g)** UI de gestión del catálogo: ver, crear, editar, borrar, merge, reordenar.
- [ ] **(h)** `database_schema.md` actualizado.

---

## 🧪 Test de aceptación

Después de completar el bloque, hacer estas pruebas con datos reales:

1. **Subir archivo con métricas mixtas**
   - Tomar un CSV/XLSX real de algún proveedor de GPS con 30+ columnas
   - Verificar que ~13 caen como core automáticamente
   - Mapear las que falten, creando algunas nuevas al vuelo
   - Confirmar que se guardan en las tablas correctas

2. **Re-importar el mismo archivo**
   - Verificar que NO se duplican datos
   - Los mapeos del proveedor se recuerdan (no preguntan de nuevo)

3. **Gestionar catálogo**
   - Crear una métrica custom desde Settings
   - Editarla
   - Aparece en los selectores de los gráficos
   - Hacer merge de dos métricas duplicadas
   - Borrar una métrica custom (con confirmación)

4. **Verificar gráficos**
   - El radar de Individual View muestra métricas del catálogo
   - El scatter permite seleccionar cualquier par de métricas (core o custom)
   - El ranking funciona con métricas custom
   - El baseline (Bloque 6) calcula correctamente para una métrica custom

5. **Performance**
   - Cargar una sesión con 30 jugadores y 50 métricas
   - El render debe ser < 500ms
   - Sin errores en consola

---

## 📌 Notas finales

- **Tiempo estimado:** este bloque es el más grande. Es razonable correrlo en 2 pasadas si la IA deja algo a medias.
- **Validar entre pasos:** especialmente entre los pasos 1–2 (migración + seed) y 3–4 (modal + UPSERT). Si algo está mal ahí, el resto se rompe.
- **Probar con archivo real:** el bloque brilla cuando subís un export real con 50+ columnas. Sin eso, solo vas a ver una refactorización abstracta.

