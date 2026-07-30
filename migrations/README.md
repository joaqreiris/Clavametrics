# Migraciones — ClavaMetrics

## ⚠️ Fuente de verdad del esquema: [`../db/schema.sql`](../db/schema.sql)

El esquema **vivo y completo** de la base (112 tablas, 238 FKs, 5 vistas, 71 funciones,
39 triggers, 227 políticas RLS) está reconstruido por introspección en vivo en
**[`db/schema.sql`](../db/schema.sql)** — regenerado por última vez el **2026-07-05**;
parcheado a mano (introspección puntual) para las migraciones **120–121** el **2026-07-13**.
Ese es el archivo único que describe la DB. El diagrama por dominio está en
[`docs/schema-diagram.md`](../docs/schema-diagram.md) y la auditoría en
[`docs/migrations-audit.md`](../docs/migrations-audit.md).

## Estructura

```
migrations/
├── README.md          ← este archivo
├── applied/           ← histórico: 122 migraciones YA aplicadas a prod (read-only)
└── legacy/            ← predecesores sin numerar del esquema base (read-only)
```

- **`applied/`** — todas las migraciones que ya corrieron en la DB de producción
  (004→121, con algunos números duplicados y headers con número equivocado, fruto de
  aplicarlas a mano sin runner). Se conservan como **registro histórico**. NO re-aplicar,
  NO renumerar: ya están reflejadas en `db/schema.sql`. Las 106→119 (antes sueltas en la
  raíz de `migrations/`) se archivaron aquí el 2026-07-05 tras regenerar `schema.sql`;
  su propósito está documentado en la tabla de abajo.
- **`legacy/`** — SQL viejos sin numerar que crearon parte del esquema base.

## Qué hace cada migración 106→121

Referencia rápida de las últimas migraciones (ya en `db/schema.sql`). El archivo de cada
una en `applied/` tiene el rationale completo en su header.

| # | Archivo | Qué hace |
|---|---------|----------|
| 106 | `v_gps_task_analysis` | Vista fuente del análisis GPS por TAREA. Grano: 1 fila por período × jugador (cada drill que hizo cada jugador) para períodos mapeados a un ejercicio vía `gps_drill_map`. Aditiva. |
| 107 | `normalize_gps_period_reports_metres` | ⚠️ Fix de DATOS manual, one-time, por club (no es cambio de esquema): normaliza a metros valores mal escalados en `gps_period_reports`. Correr a mano en el SQL editor. |
| 108 | `v_gps_task_analysis_exclude_flagged` | Redefine la vista 106 para excluir períodos con `is_flagged` (outliers de velocidad / revisión manual). Las filas flaggeadas siguen en la tabla, solo no se grafican. |
| 109 | `v_gps_task_analysis_id` | Expone el PK del period report como `id` en la vista para paginación determinística (`cmFetchAll` ordena por id). Aditiva sobre 108. |
| 110 | `v_gps_task_analysis_players_format` | Fix `players_format`: el "formato de juego" (4v4, 7v7) es la ESTRUCTURA, no el total de jugadores. Lo parsea del NOMBRE del drill. |
| 111 | `v_gps_task_analysis_distance_per_minute` | Fix Distance/Min = 0: expone la métrica `distance_per_minute` calculada (`total_distance / (duration/60)`); el builder la pedía con ese id y no existía. |
| 112 | `v_gps_task_analysis_players_format_wildcards` | Fix `players_format`: captura el formato completo con comodines/extras ("5VS5+2" ya no se recorta a "5v5"). |
| 113 | `clinical_record_schema` | Historia clínica del jugador: 7 tablas nuevas (`player_medical_profile`, `medical_episodes`, `medical_screenings`, `medical_studies`, `medical_documents`, `player_medications`, `surgeries`) + fn `has_medical_access()` + RLS. Capa clínica separada de lo operativo; LEE de `injuries`/`injury_phases`. |
| 114 | `gps_session_agg` | Fn `gps_session_agg(club, session_ids, player_ids)`: agregación server-side de `gps_reports` por sesión (perf P1a). Reemplaza traer filas crudas en varias cards. |
| 115 | `rival_days_to_match` | Fix de DATOS (no esquema): back-fill `session_type='match'` para días que ya tenían rival pero quedaron en `'training'` (invisibles para el baseline "vs Match"). Guarda `_rivalPrevType` para revertir. Idempotente. |
| 116 | `invitations_role_check` | Endurece `invitations.role`: sanea datos, fija default válido y agrega CHECK contra el enum real de roles (antes default `'viewer'`, que no existe en `profiles_role_check`). |
| 117 | `my_player_ids_player_teams` | `my_player_ids()` resuelve equipos contra `player_teams` (M:N) en vez de `players.team_id` (solo el equipo primario). Habilita jugadores multi-equipo. |
| 118 | `players_rls_player_teams` | RLS de `players`: el staff de CUALQUIER equipo del jugador ve/edita su ficha (M:N vía `player_teams`), no solo el equipo primario. |
| 119 | `tasks_assigned_roles` | Columna `tasks.assigned_roles text[]` (asignar tareas por ROL del staff, visible dentro del equipo) + fn reusable `get_user_role()` + una rama a la policy SELECT `Team-scoped task visibility`. |
| 120 | `training_sessions_recurrence_group` | Columna `training_sessions.recurrence_group_id uuid` + índice parcial. Da paridad con `calendar_events.recurrence_group_id` (024): tras el ruteo por tipo, las sesiones recurrentes viven en `training_sessions` y necesitan agruparse para borrar/gestionar la serie completa. Aditiva. |
| 121 | `activity_log_more_events` | 8 triggers nuevos que alimentan "Recent activity": `availability.changed` (solo UPDATE con cambio de status, para no inundar con el autofill diario), `session.modified`, `match_report.created`, `evaluation.recorded` (evaluations + force_tests), `medical.episode`, `microcycle.published`, `lineup.published`, `player.added`/`archived`. SECURITY DEFINER, escriben a `activity_log`. |
| 126 | `assessment_tests` | Catálogo de tests de assessment como DATO: `assessment_test_defs` (semillas globales `club_id null` + custom por club: family iso/mobility, key, test_type, umbrales `jsonb`, `aliases[]` para el importador, referencia científica + `evidence_level`) + `assessment_column_maps` (memoria de mapeo columna CSV → test+lado, calca `force_column_mappings`). RLS calcada de `force_metric_definitions`. 12 semillas (6 iso + 6 movilidad). Los RESULTADOS siguen en `force_tests`/`force_test_metrics`. |

## Cómo hacer cambios de esquema de ahora en más

No agregar archivos sueltos a mano. Usar el runner de Supabase, que numera por timestamp
y evita los duplicados/olvidos del pasado:

```bash
supabase migration new <nombre_descriptivo>   # crea supabase/migrations/<ts>_<nombre>.sql
# editar el SQL...
supabase db push                              # aplica a la DB linkeada
```

Tras aplicar, **regenerar `db/schema.sql`** para que la fuente de verdad quede al día:

```bash
python3 db/build_schema.py db/schema.sql
```

El script hace introspección en vivo vía Supabase Management API (usa el access token del
keychain: `security find-generic-password -s "Supabase CLI" -w`) y reconstruye el `.sql`
completo — tablas, PK/UNIQUE/CHECK, FKs, índices, funciones, vistas, triggers y RLS.
No necesita Docker ni psql.
