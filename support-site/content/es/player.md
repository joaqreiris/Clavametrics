---
title: Perfil del jugador
slug: player
world: squad
app_page: Player.html
order: 3
summary: Los datos de un atleta en una sola vista de solo lectura — identidad, KPIs y pestañas para tests físicos, carga y bienestar, y disponibilidad y lesiones, cada una extraída de su propio módulo.
---

## Qué es

El Perfil del jugador es un **agregador de solo lectura**: los datos clave de un atleta de toda la app en una sola vista — identidad y KPIs de temporada arriba, luego pestañas para tests físicos, carga y bienestar, y disponibilidad y lesiones. Cada bloque es una ventana a un módulo dedicado.

## Cuándo lo usas

Para una lectura rápida y todo en uno de un jugador — un briefing previo a la sesión o al partido (disponibilidad, zona de [ACWR](glossary#acwr), readiness), un control de progreso (evolución de tests, tendencia de bienestar) o una revisión del historial de lesiones — sin saltar entre páginas. Llegas a él desde la [Plantilla](/support/squad) abriendo un jugador.

## Cómo funciona

**Ficha de identidad.** Foto, nombre, posición, estado, categoría y lo básico — edad, nacionalidad, altura, peso, pie dominante.

**Barra de KPIs (temporada).** Seis cifras principales: **Minutos jugados**, **Entrenamientos realizados**, **% de disponibilidad**, **Días de baja**, **ACWR** (ratio de carga del jugador con su zona) y **Readiness** (media de bienestar de 7 días).

**Cuatro pestañas.**

- **Resumen** — un radar técnico y puntuaciones tácticas/mentales (de evaluaciones valoradas sobre /10), una valoración física actual (últimos tests objetivos más una instantánea de plataforma de fuerza) y un resumen de lesiones.
- **Físico y tests** — elige un tipo de test para ver su gráfico de evolución (con la banda de la plantilla cuando hay suficientes pares) y una tabla de registros con deltas respecto al resultado anterior.
- **Carga y bienestar** — un indicador de ACWR, la tendencia de forma/fatiga/estado (CTL · ATL · TSB), la carga semanal de s-RPE con monotonía y strain, y una tendencia de bienestar de 14 días.
- **Disponibilidad y lesiones** — un mapa de calor de disponibilidad de temporada, la línea temporal del historial de lesiones y un desglose de días de baja por causa.

Las pestañas se cargan al hacer clic por primera vez. La página es de solo lectura — cambias de pestaña, cambias la métrica de ACWR o filtras tipos de test, pero no editas datos aquí.

## Conceptos clave

**Un agregador, no una fuente.** Nada se origina en esta página. Cada bloque refleja un módulo dedicado y lee sus datos en vivo: las tarjetas de carga y bienestar reflejan el [Monitor de carga](/support/load-monitor) y [Bienestar](/support/wellness); los tests reflejan [Evaluaciones](/support/evaluations); la disponibilidad y las lesiones reflejan [Disponibilidad](/support/availability). Para cambiar algo, ve a ese módulo — el perfil solo lo refleja.

**Ventana de temporada.** Los KPIs y el Resumen usan la ventana de temporada del club, de modo que las cifras comparten un rango de fechas consistente.

**Benchmarking.** En los tests físicos, el resultado de un jugador se sitúa frente al **cohorte del equipo** — pero solo cuando hay suficientes pares (al menos cuatro) para que la comparación sea significativa; de lo contrario, el perfil lo indica. Es la misma regla de cohorte que usa la página de [Evaluaciones](/support/evaluations).

**Lo que NO muestra.** El perfil es un resumen, así que varias cosas están en otro lugar: **métricas de GPS** detalladas (distancia, velocidad, aceleraciones — aquí solo obtienes ACWR; el detalle completo está en [Análisis GPS](/support/gps-analysis)); detalle de **sesión/microciclo** ([Historial de sesiones](/support/sessions-history), [Calendario](/support/calendar)); **estadísticas de eventos de partido** (goles, asistencias); **nutrición** y **vídeo**; y el **expediente** médico completo (aquí solo aparecen estadísticas de resumen).

## FAQ

**¿Puedo editar al jugador aquí?** No — es de solo lectura. Edita al jugador en la [Plantilla](/support/squad); cambia la disponibilidad, los tests, el bienestar o las lesiones en sus propios módulos, y el perfil lo refleja.

**¿Por qué a veces no se muestra un percentil?** Porque el cohorte del equipo tiene menos pares que el mínimo necesario para una comparación válida.

**¿Dónde está el desglose completo de GPS?** Aquí no — el perfil muestra solo ACWR. Abre [Análisis GPS](/support/gps-analysis) para distancia, velocidad y aceleraciones.

**¿Cómo llego al perfil de un jugador?** Desde la [Plantilla](/support/squad), abre al jugador (el perfil es por jugador, indexado por el jugador).

## Relacionado

- [Plantilla](/support/squad) — el roster desde el que abres el perfil.
- [Monitor de carga](/support/load-monitor) — la vista completa de carga que reflejan las tarjetas de ACWR/CTL/ATL.
- [Bienestar](/support/wellness) — el historial completo de check-ins detrás de la tendencia de 14 días.
- [Evaluaciones](/support/evaluations) — el módulo de tests detrás de las pestañas físicas.
- [Disponibilidad](/support/availability) — donde se fijan los datos del mapa de calor de disponibilidad.
