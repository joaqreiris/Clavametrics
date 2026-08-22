# GPS — Trabajo no-team (work_context): Modelo A

Regla de negocio estipulada (2026-08). Aplica a todo el módulo GPS.

## El principio

El **trabajo no-team** (`gps_period_reports.work_context` ∈ {`rehab`, `individual`, `topup`})
es **SOLO VOLUMEN**:

- **SUMA en los totales de cada jugador** → el volumen se ve **completo, siempre**, sin depender
  de ningún filtro. Un jugador que hizo partido/entrenamiento + top-up/rehab muestra la suma real.
- **Se EXCLUYE de TODAS las medias cross-player** → la media del equipo, la línea AVG, el rollup
  de plantel y la media del día se calculan **solo con team**.
- La exclusión es **por jugador entero**: si un jugador tuvo un período no-team en una sesión,
  queda **fuera de la media de esa sesión** completo (no se le resta un pedazo). Su volumen igual
  se ve en su fila.
- La **media del equipo es SIEMPRE limpia** — no depende del filtro Context. El filtro Context
  sirve para **aislar/ver** un contexto, no para ensuciar el promedio (Camino A).

## Por qué

Un rehab o un top-up es carrera aparte: no representa lo que hizo el equipo. Si sumara a la media,
rompería la realidad de la sesión. Pero el volumen es real y tiene que verse.

Antes se **restaba** el volumen no-team del total de sesión para limpiar la media — eso limpiaba
la media pero **corrompía el total** (el jugador aparecía con menos volumen del real). Modelo A
separa las dos cosas: no resta (volumen completo) y excluye al jugador de las medias.

## Dónde se implementa

| Capa | Qué hace |
|---|---|
| `lib/gp-card/resolver.js` · `fetchReports` | NO resta. Marca filas `_excludeMean` con `_nonTeamMeanKeys` (una fila `(session, player)` con período no-team). |
| `lib/gp-card/resolver.js` · `aggregateSeries` | Medias (`avg`/`wavg`/`median`) y rollup de plantel excluyen filas/jugadores marcados; `total`/`max`/`min` usan a todos. Cada punto lleva `_nonTeam`. |
| `assets/gp-builder/gp-builder.js` · líneas de referencia | Los `vals` de la línea AVG/mediana excluyen jugadores `_nonTeam`; las barras muestran el volumen completo. |
| `assets/gps-session-control.js` | Mismo modelo: volumen completo + excluir de la media al jugador con período no-team (chip REHAB/TOP-UP/INDIV en la fila). |
| `assets/gps-match-perf.js` | Mismo modelo: `_mpMarkNonTeam` marca `_excludeMean`; `_mpAggVal` excluye de las medias. Los charts TD/HI van por el resolver → ya cubiertos. |

## Detalles de datos

- Los períodos viven en `gps_period_reports` (grano `(session, player, período)`); el total de
  sesión está en `gps_reports` (una fila por `(session, player)`, `work_context` siempre `team` a
  nivel sesión). El total de sesión **ya incluye** el volumen de los períodos no-team.
- El **RPC fast-path** (`gps_player_agg`/`mc_agg`) filtra `team` y no resta; `hasNonTeamPeriods`
  rutea al camino crudo cuando hay períodos no-team, así que el resolver (Modelo A) es la fuente de
  verdad en esos casos. Si en el futuro se quiere que el RPC maneje no-team, hay que devolver el
  volumen completo + una marca por jugador y actualizar la auditoría.
- Los baselines de partido (× match avg, best-N, últimos) usan solo sesiones de PARTIDO, así que el
  trabajo no-team (entrenamiento) queda afuera solo.

## Pendiente

- (Opcional/perf) RPC context-aware para no caer siempre al camino crudo con no-team.
- (Opcional) modo "aislar contexto" real en la tabla principal (hoy el filtro Context filtra a
  nivel sesión, que es todo `team`).
