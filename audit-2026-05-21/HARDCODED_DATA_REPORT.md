# HARDCODED DATA REPORT — ClavaMetrics
**Fecha:** 2026-05-21  

Todos los elementos de datos hardcodeados ordenados por impacto real en producción.

---

## TIER 1 — CRÍTICO: Datos hardcodeados visibles como reales

Estos son los más peligrosos: el usuario ve datos falsos sin saber que son fake.

| ID | Archivo | Línea | Dato hardcodeado | Impacto |
|----|---------|-------|------------------|---------|
| HC-01 | Calendar.html | 504–517 | 14 microciclos fake (nombres, posiciones CSS) | Usuario ve su temporada como fake |
| HC-02 | Calendar.html | 525–538 | 9 equipos rivales inventados (River, Boca, Atlético...) | Partidos que no existen |
| HC-03 | Calendar.html | 627–676 | 6 eventos próximos fake (fechas, tipos, nombres) | Agenda fake |
| HC-04 | Daily Planning.html | 339–377 | 27 jugadores completos con nombres/posiciones/disponibilidad | Squad falso |
| HC-05 | Daily Planning.html | 422–520 | 3 drill cards completas con SVG diagrams | Ejercicios inexistentes |
| HC-06 | Planner.html | 596–616 | Todos los objetos del campo táctico con posiciones fijas | Táctica que no se puede editar |
| HC-07 | Hub.html | 722–763 | 6 actividades de staff fake (Pablo Fierro, Dr. Acosta, etc.) | Feed de actividad ficticio |
| HC-08 | Hub.html | 778–817 | 5 tareas con asignados ficticios y prioridades inventadas | Task list falsa |
| HC-09 | Admin.html | 344–462 | 6 club cards con stats inventados (players, storage, billing) | Panel de admin fake |
| HC-10 | Admin.html | 319–329 | "Clava Group · 5 clubs · 148 members · $485/mo" | Org info completamente falsa |
| HC-11 | Gym Library.html | 168–343 | 12 exercise cards con datos inventados | Librería de ejercicios falsa |
| HC-12 | Gym Planner.html | 252–436 | 14 exercise rows en 3 secciones | Plan de gym falso |

---

## TIER 2 — ALTO: Datos numéricos hardcodeados en KPIs/métricas

| ID | Archivo | Línea | Dato | Debería ser |
|----|---------|-------|------|-------------|
| HC-13 | Hub.html | 441–443 | "22 available · 3 partial · 2 out" | Query availability table |
| HC-14 | Hub.html | 506–701 | 12 badges de módulos (counts, tiempos, trends) | renderBadgesAndStats() desde DB |
| HC-15 | Calendar.html | 449–467 | "Sun May 18 · 5 in 21d · 4 this MC · 3,420 AU" | Calcular desde microciclos + sessions |
| HC-16 | Calendar.html | 728–752 | "Players · 27 · Medical · 4 · Club board · 6" | Query profiles por role |
| HC-17 | Injuries.html | 320–352 | "2 active · 1 expected · 42 days · 8%" (inicial HTML) | Skeleton en HTML |
| HC-18 | Injuries.html | 448–450 | "Bocanegra 2 · Carrasco 1" en body map | Calcular desde injuries GROUP BY body_zone |
| HC-19 | Injuries.html | 463–468 | "Muscle strain 62% · Ligament 23%" | injuries GROUP BY type |
| HC-20 | Load Monitor.html | 291–292 | Nombres específicos de jugadores en ACWR alert | Query players WHERE acwr > 1.5 |
| HC-21 | Load Monitor.html | 274 | "Microcycle 14 · MD-3 · last sync 8 min ago" | Calcular desde DB |
| HC-22 | Admin.html | 494–511 | "14 active · 2 pending · Pro plan · 8.4/50 GB" | Query en tiempo real |
| HC-23 | Admin.html | 686, 696 | 2 emails de invitaciones pendientes | Query pending_invites |
| HC-24 | Gym Library.html | 106 | "148 exercises · 92 with video" | COUNT desde gym_exercises |
| HC-25 | Gym Library.html | 161–163 | Counts por músculo (Quad:18, Ham:14...) | Calcular con GROUP BY |
| HC-26 | Squad.html | 370, 387 | "27 players · First team 2025/26" | Contar players cargados |
| HC-27 | Squad.html | 395–401 | Position counts (GK:3, CB:4...) | Filter players por position |
| HC-28 | Evaluations.html | 407–427 | "Tactical: 7.8 · Technical: 8.2..." | Query evaluations table |

---

## TIER 3 — MEDIO: Datos de visualización hardcodeados

| ID | Archivo | Línea | Elemento | Debería ser |
|----|---------|-------|----------|-------------|
| HC-29 | Calendar.html | 690–715 | Bar heights del workload chart (42%, 58%...) | Calcular desde training_sessions por MC |
| HC-30 | Load Monitor.html | 377–545 | ACWR chart entero como SVG estático | Chart.js con datos reales |
| HC-31 | Load Monitor.html | 592–597 | Barras de wellness (%s fijos por jugador) | Calcular desde wellness submissions |
| HC-32 | GPS Analysis.html | 285–318 | Radar polygon SVG con z-scores fake | Calcular desde gps_reports vs team avg |
| HC-33 | GPS Analysis.html | 382–392 | Z-score matrix con nombres hardcodeados | Renderizar desde gps_reports |
| HC-34 | GPS Analysis.html | 324–333 | "0.86× 1.07×" multiplicadores vs match-max | Calcular desde historical GPS peaks |
| HC-35 | GPS Analysis.html | 347–363 | Weekly volume bars con alturas hardcodeadas | gps_reports por semana |
| HC-36 | GPS Analysis.html | 407–416 | Squad ranking hardcodeado | Ordenar desde gps_reports |
| HC-37 | GPS Analysis.html | 436–443 | Scatter plot con iniciales hardcodeadas | Generar desde métricas GPS reales |
| HC-38 | Match Reports.html | 622–647 | Shot positions con left/top% fijos | Calcular desde events WHERE type='shot' |
| HC-39 | Nutrition.html | 518 | Donut ring `stroke-dasharray: "207 264"` | Calcular desde calorías reales |
| HC-40 | Availability.html | 364–388 | "22 · 2 · 1 · 1" KPI counts | renderKPIs() desde DB |
| HC-41 | Availability.html | 434–447 | Fechas del header de la matriz (May 11-24) | renderHeader() desde MC_DATES |

---

## TIER 4 — BAJO: Valores por defecto y placeholders

| ID | Archivo | Línea | Elemento |
|----|---------|-------|----------|
| HC-42 | Hub.html | 437 | "Good morning, Joaquín" con nombre real hardcodeado |
| HC-43 | Wellness.html | 694 | "7h 30m" sleep + scores 8/8/6/3/4 como defaults |
| HC-44 | Onboarding.html | 349–382 | "Clava FC", "CLA", "Rosario" pre-rellenados |
| HC-45 | Onboarding.html | 399–438 | 3 categorías pre-marcadas como selected |
| HC-46 | RPE.html | 360–371 | "Quadriceps, Calves" chips marcados como .is-on |
| HC-47 | Physio.html | 273, 281 | "Tight L quad post Wed session..." en textarea |
| HC-48 | ios-frame.jsx | 9 | Tiempo "9:41" estático en status bar |
| HC-49 | GPS Analysis.html | 599–604 | "Token expired" / "Connected" hardcodeados en connectors |
| HC-50 | Planner.html | 811–816 | 5 rivales fake con el mismo asset de escudo |

---

## TOTALES

| Tier | Issues | % |
|------|--------|---|
| CRÍTICO (fake visible) | 12 | 24% |
| ALTO (métricas/KPIs) | 16 | 32% |
| MEDIO (visualizaciones) | 13 | 26% |
| BAJO (defaults) | 9 | 18% |
| **TOTAL** | **50** | 100% |
