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
| `assets/gps-baseline.js` · `_scopeToTeam` | Los baselines de partido (best-N y × match avg) recortan antes de promediar: el que solo hizo top-up ese día no aporta un «partido». |
| `Load Planner.html` · `loadMatchRefs` | Ídem para REF_MAX / REF_AVG. |
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
- Los baselines de partido (× match avg, best-N, últimos) usan solo sesiones de PARTIDO, y desde
  2026-09-05 también **recortadas a `team`**: un suplente que no jugó y solo hizo top-up ya no
  aporta un valor de partido (antes entraba como partido flojo → referencia hundida → top-up
  prescrito de menos, porque `topup-calc.js` mide el déficit contra ese mismo baseline). El top-N
  se elige DESPUÉS del recorte, en cliente. Limitación: las métricas EAV no se recortan, pero la
  fila del que no jugó sí se cae.
- Los patrones de `gps_context_rules` tienen un **fallback built-in** en el trigger (migración
  `130_gps_context_default_patterns.sql`): `top up`, `complementar`, `compensator`, `rehab`,
  `individual`… Solo aplica si NINGUNA regla del club matchea, así un club sin reglas cargadas no
  cuenta un «Complementary» como partido. Para anular un default, el club crea una regla con ese
  nombre y contexto `team`.

## Corte de comparabilidad (`club_gps_settings.gps_valid_from`)

Un club puede cambiar de **forma de medir**, y ahí el histórico deja de ser comparable consigo
mismo. Caso real: MOI Kompong DEWA pasó el **19/10/2025** de umbrales fijos de velocidad a
**% de la Vmax de cada jugador** (bandas 3/4/5 de Catapult = HSR / VHSR / Sprint). Lo medido:

| métrica | antes | desde | factor |
|---|---|---|---|
| HSR | 923 m | 382 m | 2,4× |
| VHSR | 274 m | 103 m | 2,7× |
| Sprint | 57 m | 13 m | 4,4× |
| **distancia total** | 6756 m | 6644 m | **1,02×** |

La distancia total igual es la prueba de que cambió el criterio, no la carga. En un gráfico eso
dibuja un escalón que se lee como una caída de rendimiento y no lo es.

**Por qué no se convierten los valores viejos.** Haría falta la señal cruda, que ya no está: sólo
quedan los agregados. Reconstruirlos desde los tramos guardados da un parámetro de decaída con
media 0,411 y desvío 0,193 (**47 % de variabilidad**; 39 % mirando sólo partidos, rango
0,008–1,18), y las razones entre tramos dentro de una misma sesión van de 0,71 a 1,91 — para el
MISMO jugador entre partidos (PHARANN: 1,87 / 1,91 / 0,96). Cualquier reescritura sería inventada.
El único camino real es recuperar los archivos originales desde la nube de Catapult y reimportar.

**Cómo funciona.** `gps_valid_from` es una fecha por club. **No borra nada**: las filas siguen en
la base y vuelven al análisis el día que se vacíe el campo.

- Las **cards** lo aplican en `getSessionIds` (`lib/gp-card/resolver.js`), que es el único sitio por
  el que pasan todas — cualquier rango, cualquier tipo de gráfico.
- La **referencia de partido** (`assets/gps-baseline.js`, `_refRule`) y **Top-Up**
  (`assets/topup-calc.js`, `effFrom`) lo toman como **piso**: si el club tiene `ref_from_date`
  configurada, gana la más tardía de las dos. Si no, el corte manda igual.
- Se edita en **Top-Up → qué partidos valen como referencia**, campo «Datos comparables desde».
  Es lo único de ese modal que afecta a toda la app y no sólo a la referencia; `ref_from_date`
  sigue siendo un campo aparte y el editor nunca lo pisa con el corte.

Para MOI quedan fuera 38 sesiones (01/09/2025 → 18/10/2025) y adentro 194.

## Historia — Modelo A (2026-08-21 … 2026-08-26)

El trabajo no-team era **solo volumen**: sumaba en los totales del jugador y lo **excluía entero**
de todas las medias cross-player (`_excludeMean` / `_nonTeamMeanKeys` en el resolver, `_mpMarkNonTeam`
en match-perf, chip REHAB/TOP-UP en session-control). Antes de eso (Fase 2b) la media se calculaba
**restando** los períodos no-team del total de sesión, lo que limpiaba la media pero corrompía el
total del jugador. Los tres enfoques quedaron reemplazados por el recorte dinámico de arriba; los
checks de `_excludeMean` que sobreviven en `aggregateSeries` son no-ops.
