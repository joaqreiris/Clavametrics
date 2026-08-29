# GPS — Trabajo no-team (work_context): Modelo B

Regla de negocio vigente (2026-08-26, commit `da1fbac`). Aplica a todo el módulo GPS.
Reemplaza al Modelo A, que queda al final como historia.

## El principio

El **trabajo no-team** (`gps_period_reports.work_context` ∈ {`rehab`, `individual`, `topup`})
se **aísla por período**, y lo que se ve depende del filtro **Context** del bar (default: `team`):

- Los valores de cada par **(sesión, jugador)** reflejan **exactamente** los contextos
  seleccionados. Un jugador que hizo partido + top-up, mirando `Team`, muestra **solo su parte de
  equipo** — sus valores se **recalculan** sumando únicamente sus períodos de ese contexto
  (`time_played` y m/min salen de la duración real de esos períodos, nunca del total de sesión).
- Si **ningún** período suyo cae en los contextos pedidos, la fila **desaparece** de la vista (con
  `Team`, un jugador que solo hizo rehab no aparece).
- Como las filas llegan **puras** al agregador, las medias ya no necesitan excluir a nadie: el
  jugador con top-up **sigue contando** en la media, con su valor recortado.
- Períodos con `work_context` NULL (data vieja sin etiquetar) cuentan como `team`.

## Por qué

Un rehab o un top-up es carrera aparte: no representa lo que hizo el equipo. El Modelo A lo
resolvía **sacando al jugador entero** de la media, pero eso tiraba también su trabajo de equipo
(y vaciaba la media del propio jugador → el bug de m/min = 0 en la tabla por jugador). El Modelo B
recorta en vez de excluir: cada vista muestra la carga del contexto que se está mirando.

Ojo con el total: la fila de `gps_reports` (grano sesión) **incluye** el volumen de los períodos
no-team — el sync solo le descuenta los **minutos** del top-up, no la distancia. Por eso el recorte
se hace siempre desde los períodos, no restando del total.

## Dónde se implementa

| Capa | Qué hace |
|---|---|
| `lib/gp-card/resolver.js` · `_applyCtxScope` | El motor: detecta pares «dirty» (con períodos fuera de los contextos pedidos) y les recalcula los valores desde sus períodos; sin ninguno, elimina la fila. Marca `_ctxAdj`. |
| `lib/gp-card/resolver.js` · `_ctxPeriodRows` | Sintetiza filas para contextos no-team (un rehab que no tiene fila propia de sesión). |
| `lib/gp-card/resolver.js` · `applyCtxToRows` | Orquestador **exportado** — el punto de entrada para las vistas con fetch propio. |
| `assets/gps-session-control.js`, `assets/gps-match-perf.js`, `assets/gps-mc-compare.js` | Importan `applyCtxToRows` dinámicamente y lo aplican a sus filas. |
| `assets/pages/gps-analysis-2.js` · modal «Add GPS data» | Igual: la media de equipo/posición que ofrece para rellenar sale de filas ya recortadas. |
| Load Monitor / ACWR | A PROPÓSITO con totales completos (carga acumulada = todo lo corrido). |

## Detalles de datos

- Los períodos viven en `gps_period_reports` (grano `(sesión, jugador, período)`); el total de
  sesión está en `gps_reports` (una fila por `(sesión, jugador)`). En clubes con API el
  `work_context` de SESIÓN no es durable (el re-sync diario hace delete+insert), así que la
  etiqueta que manda es la del PERÍODO.
- El **fast-path RPC** (`gps_player_agg`/`mc_agg`) no recorta; `hasNonTeamPeriods` rutea al camino
  crudo cuando hay períodos no-team, así que el resolver es la fuente de verdad en esos casos.
- Limitación conocida: las métricas EAV (`extra_metrics`) siguen mostrando el valor de sesión
  completa en la vista recortada.
- Los baselines de partido (× match avg, best-N, últimos) usan solo sesiones de PARTIDO.

## Historia — Modelo A (2026-08-21 … 2026-08-26)

El trabajo no-team era **solo volumen**: sumaba en los totales del jugador y lo **excluía entero**
de todas las medias cross-player (`_excludeMean` / `_nonTeamMeanKeys` en el resolver, `_mpMarkNonTeam`
en match-perf, chip REHAB/TOP-UP en session-control). Antes de eso (Fase 2b) la media se calculaba
**restando** los períodos no-team del total de sesión, lo que limpiaba la media pero corrompía el
total del jugador. Los tres enfoques quedaron reemplazados por el recorte dinámico de arriba; los
checks de `_excludeMean` que sobreviven en `aggregateSeries` son no-ops.
