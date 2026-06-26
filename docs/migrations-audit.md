# Auditoría de migraciones SQL — ClavaMetrics

> Generado el 2026-06-26. Cubre `migrations/*.sql` (004→103) + `migrations/legacy/`.
> Objetivo: entender el estado real del esquema, detectar archivos muertos/duplicados
> y proponer una baseline consolidada + diagrama de tablas.

---

## 1. Resumen ejecutivo (lo que importa)

1. **El esquema base NO está en `migrations/`.** Confirmado por introspección en vivo
   (2026-06-26): la DB tiene **104 tablas**, pero solo **48** tienen `create table` en
   `migrations/`. Las **57** restantes —incluyendo el núcleo `clubs`, `profiles`, `players`,
   `training_sessions` (83 referencias en código), `exercises`, `gym_exercises`,
   `session_exercises`, `microcycles`, `calendar_events`, `gps_reports`, `injuries`,
   `treatments`, `wellness`, `rpe`, etc.— se crearon **fuera** de esta carpeta (directo en
   la DB de Supabase o vía `migrations/legacy/`).
   → El diagrama real (sacado de la DB, no del folder) está en
   [`docs/schema-diagram.md`](schema-diagram.md); la baseline en [`db/schema.sql`](../db/schema.sql).
   Lista completa del drift en §6.

2. **No hay runner de migraciones.** Se aplican a mano (no hay `supabase/migrations`,
   ni tabla `schema_migrations`, ni config). Por eso hay **números duplicados** y
   **headers con número equivocado**: nada valida el orden.

3. **Mucho archivo es ruido histórico.** ~15 migraciones son correcciones de otras
   (cadenas de supersesión, §3) o data-fixes de una sola vez. El esquema final se podría
   describir con bastante menos.

4. **3 tablas creadas por migración nunca se usan en código:** `card_templates`,
   `default_exercises` (tabla semilla, solo backend), `taxonomy_aliases` (solo backend).

5. **No editar migraciones ya aplicadas.** La forma correcta de "simplificar" es generar
   una **baseline consolidada** (snapshot del esquema real) como nueva fuente de verdad y
   archivar las históricas. Ver §7.

---

## 2. Problemas estructurales del folder

### 2.1 Números duplicados (orden de aplicación ambiguo)
| Nº | Archivo A | Archivo B | ¿Conflicto? |
|----|-----------|-----------|-------------|
| 014 | `bamic_and_phase_criteria` (injuries) | `microcycle_publish_state` (microcycles) | No, tablas disjuntas |
| 015 | `club_settings_season` (club_settings) | `injury_category_classification` (injuries) | No, disjuntas |
| 029 | `club_assets_bucket` (storage) | `club_gps_settings` (tabla) | No, disjuntas |
| 044 | `exercise_library_seed` | `nutrition_module` | No, dominios distintos |
| 045 | `exercise_seed_security_definer` | `nutrition_foods_seed` | No, cada uno sigue a su 044 |

Ninguno colisiona en objetos, pero el doble número rompe cualquier ordenamiento por nombre.

### 2.2 Headers con número equivocado (copy-paste)
- `029_club_assets_bucket` → comentario interno dice "Migration 028".
- `087` dice "086", `088` dice "087", `089` dice "088", `090` dice "089", `100` dice "099".
- Cosméticos, pero confunden al consolidar.

### 2.3 `legacy/` sin numerar
15 archivos sin prefijo (`availability_*`, `calendar_events.sql`, `tasks_table.sql`,
`training_sessions_new_columns.sql`, …). Son los predecesores del esquema base. Documentan
historia pero **no forman parte de la secuencia** y no deben re-aplicarse.

---

## 3. Cadenas de supersesión (archivos muertos o subsumidos)

Estas son las correcciones iterativas que pedías detectar. La columna **"Estado final"**
indica qué versión sobrevive; lo demás es ruido que la baseline puede colapsar.

| Cadena | Qué pasó | Estado final / vivo |
|--------|----------|---------------------|
| **012 → 013** `injury_phases` | 013 re-crea la tabla de 012 con columnas extra (phase_type, criteria…) | Solo **013** |
| **016 → 017 → 018** `injuries.status` | Constraint cambiado 3× (resolved → cleared/returning). 017 tenía bug de orden | Solo **018** = `(active, cleared, returning)` |
| **020 + 021 → 022** lineups | 022 re-aplica las mismas columnas/constraint (estaban faltando en prod) | **022** (020/021 redundantes) |
| **024 → 025** calendar type | 024 solo documenta; 025 cambia el CHECK real | Solo **025** |
| **039 → 040** gps_builder flag | 039 default false; 040 lo flipa a true al instante | Solo **040** |
| **038 → 042** dashboards RLS | 042 reemplaza la policy "FOR ALL" por 4 granulares | **042** |
| **051 → 052** programme_phases | 052 `DROP CASCADE` + recrea (la DB tenía schema viejo) | Solo **052** |
| **044exercise → 045** seed fn | 045 agrega SECURITY DEFINER (044 sembraba 0 filas por RLS) | **045** |
| **055 → 058** plans | 055 no-op (tabla preexistía); 058 agrega cols + UPSERT seed | **058** |
| **016draft → 057/059** subs/invoices | DROP+CREATE para descartar tablas stripe viejas | **057/059** |
| **060 → 061** platform_admins | 061 **revierte 060 entero** (tabla + fn dropeadas) | Ninguno: queda solo policy con `is_super_admin()` |
| **055/058 → 064/067/070** plans data | 3 UPDATEs posteriores mutan features/name | features/name finales ≠ seed |
| **071 → 073** gps_integrations | 073 agrega status `configured` + reescribe `set_gps_credential` | **073** |
| **074 → 075 → 076 → 077** survey fns | `submit_survey` reescrita 4×, `wellness_status` 3× | Solo la última de cada una |
| **097 → 100** `v_exercise_gps_profile` | 100 drop+recrea agregando columnas `_avg` (volumen) | **100** (la tabla+otra view de 097 siguen vivas) |
| **096 → 098** player_teams | 098 agrega trigger que mantiene `players.team_id = is_primary` | Ambas (098 complementa) |
| **101 → 102 → 103** daily planning | 3 migraciones de 1 columna c/u sobre session_exercises/training_sessions | Las 3 (fusionables en 1) |

**Funciones reescritas múltiples veces** (solo la última corre): `submit_survey` (074/075/077),
`wellness_status` (074/075/076), `set_gps_credential` (071/073), `seed_default_exercises_for_club`
(044/045), `session_rpe_status` (083), `set_updated_at` (redefinida en 019 y 034).

---

## 4. Artefactos muertos / redundantes

**Columnas duplicadas u obsoletas en tablas core:**
- `injuries.mechanism` (012/013, free-text) vs `injuries.injury_mechanism` (014, con CHECK) — la
  primera quedó legacy, nunca dropeada.
- `exercises.preview_svg` (082) vs `preview_png` (084) vs `preview_path` + bucket (085) — **tres
  estrategias** de preview de drills agregadas en cascada. Si la app estandarizó en el bucket
  (085), las dos inline (082/084) son ruido. ⚠️ Verificar contra `Exercises Library.html` antes de dropear.

**Tablas creadas por migración sin uso en código (candidatas a deprecar):**
| Tabla | Migración | Nota |
|-------|-----------|------|
| `card_templates` | 038 | 0 referencias en todo el repo |
| `default_exercises` | 044 | Tabla semilla; la app lee `exercises`/`gym_exercises`, nunca esta |
| `taxonomy_aliases` | 089 | Solo backend (normalización `cm_norm`), 0 refs cliente |
| `platform_admins` | 060→061 | 061 la dropeó, **pero existe en la DB hoy** (recreada fuera de migraciones). Drift activo. |

> ⚠️ **`platform_admins` CONFIRMADA en la DB** (introspección 2026-06-26) pese a que la migración
> 061 la eliminó: alguien la volvió a crear directo en Supabase. El código (`invite-staff`,
> `Chat & Tasks.html`) la usa. La memoria del proyecto dice que el super admin canónico es
> `is_super_admin()` vía `profiles.role` — hay que decidir cuál es la verdad y alinear código + DB.

**Data-fixes de una sola vez (no son esquema; la baseline puede omitir el cuerpo, conservar el DDL):**
- 088 §2/§3 (valores + propagación taxonomía), 089 (backfill club rows), 096 (backfill memberships),
  099 (`status='inactive'` → `archived_at`), 048/035 (seeds de métricas), 040 (backfill flag).

---

## 5. Inconsistencias de tipos a confirmar antes de consolidar

- ~~`microcycles.id` referenciado como text → posible mismatch~~ **RESUELTO** (introspección 2026-06-26):
  `microcycles.id` **es `text`** (no uuid), así que `lineups.microcycle_id` y `share_links.mc_id` (ambos
  text) son consistentes. No hay mismatch. (`calendar_events.id` sí es uuid.) Único punto: `microcycles`
  usa PK text mientras el resto del esquema usa uuid — inconsistencia de diseño, no un bug.
- `session_exercises`: `series integer` pero `work_time`/`rest_time` son `text` ("M:SS", para espejar
  `exercises`). Sin CHECK — validación en app. (Decisión deliberada, documentada en 103.)
- `gps_targets jsonb NOT NULL DEFAULT '{}'` — sin validación de shape.

---

## 6. Diagrama de tablas (big picture)

> ✅ **Generado desde la DB real** (introspección en vivo, 2026-06-26), no inferido del folder.
> Diagrama completo por dominio (14 dominios, 104 tablas, 205 FKs) en:
>
> ### → [`docs/schema-diagram.md`](schema-diagram.md)
>
> Esquema estructural completo (tablas, tipos, PK/FK/UNIQUE/CHECK, índices, vistas, funciones):
> [`db/schema.sql`](../db/schema.sql) — regenerable con el script de §7.

**Resumen de dominios** (detalle y Mermaid en el doc de arriba):
`Núcleo multi-tenant` · `Equipos y jugadores` · `Planificación/Periodización` · `Ejercicios/Drills` ·
`GPS` · `Chart Builder/Dashboards` · `Force tests` · `Lesiones/Rehab/Físio` · `Wellness/RPE/Evaluaciones` ·
`Nutrición` · `Lineups` · `Partidos/Reportes` · `Video` · `Billing`.

De las 104 tablas, **57 no tienen migración** (drift / esquema base creado en la DB) — lista completa en
el doc del diagrama. Vistas reales: `wellness_latest`, `v_next_match_lineup`, `v_gps_period_names`,
`v_exercise_gps_profile`.
---

## 7. Plan de simplificación propuesto

**Principio:** no tocar migraciones ya aplicadas en prod (re-correrlas rompería). Simplificar
= crear una **fuente de verdad consolidada** y archivar el ruido.

### Paso 1 — Baseline única (mayor impacto) — ✅ HECHO (2026-06-26)
Generada [`db/schema.sql`](../db/schema.sql): las **104 tablas** reales con tipos, PK/FK/UNIQUE/CHECK,
índices, las 4 vistas y las 60 funciones (cuerpos reales, incluido `SECURITY DEFINER`). Es la fuente
de verdad estructural única.

**Método usado** (sin Docker ni contraseña de DB): la `supabase db dump` clásica exige Docker, que no
estaba instalado. En su lugar se introspeccionó la DB vía **Management API** con el access token que la
CLI ya tiene en el keychain de macOS:
```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
REF=xesrumijvdmqjrufgeka
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"<SQL de introspección sobre pg_catalog / information_schema>"}'
```
Para **regenerar** tras cambios en la DB: re-correr la introspección y el reconstructor (scripts de
sesión). Alternativa cuando haya Docker: `supabase db dump --schema public -f db/schema.sql`.

Pendiente menor: `db/schema.sql` aún **no incluye políticas RLS, triggers ni grants** (sí funciones).
Si se quiere baseline 100% completa, agregar `pg_policies` + `pg_trigger` a la introspección.
`database_schema.md` (narrativo, 823 líneas, parcial) queda **obsoleto** → reemplazado por
`db/schema.sql` + [`docs/schema-diagram.md`](schema-diagram.md).

### Paso 2 — Carpeta `migrations/applied/`
Mover las 103 históricas a `migrations/applied/` (read-only, registro histórico). Renumerar NO
—ya corrieron. Solo se documenta que el estado vivo es la baseline del Paso 1.

### Paso 3 — Adoptar el runner de Supabase para lo nuevo
Nuevas migraciones bajo `supabase/migrations/` con timestamp (`supabase migration new`). Mata de
raíz los números duplicados y el "lo apliqué a mano y me olvidé".

### Paso 4 — Limpieza de drift
1. Decidir `exercises.preview_svg`/`preview_png` vs `preview_path` → dropear las 2 muertas.
2. Resolver `platform_admins`: **CONFIRMADO que existe en la DB** (pese a que 061 la borró). Decidir si
   es la fuente canónica o migrar `invite-staff`/`Chat & Tasks.html` a `is_super_admin()`.
3. Dropear `card_templates`, `taxonomy_aliases` si se confirma 0 uso (ver §4).
4. ~~Confirmar tipo de `microcycles.id`~~ ✅ es `text` y los FKs son consistentes (§5). Sin acción.
5. Borrar `injuries.mechanism` legacy tras migrar datos a `injury_mechanism`.

### Paso 5 — Quick wins inmediatos (sin riesgo)
- Fusionar `101+102+103` mentalmente como "daily planning fields" (ya aplicadas; solo doc).
- Corregir los headers con número equivocado **solo si** se conservan los archivos como doc.

---

## 8. Apéndice — fuentes
Auditoría cruzada de los 103 archivos `migrations/*.sql` + `migrations/legacy/` + grep de uso real
en `assets/`, `lib/`, `*.html`, `supabase/functions/`. Detalle por-migración disponible bajo demanda.
</content>
</invoke>
