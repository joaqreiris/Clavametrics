---
title: Dossier
slug: dossier
world: squad
app_page: Dossier.html
order: 5
summary: El generador configurable de dossiers de jugador — activa bloques, elige qué tests aparecen, compara contra el plantel, guarda plantillas y exporta un PDF con la marca del club.
---

## Qué es

El Dossier es un generador de informes por jugador configurable: eliges qué bloques y tests aparecen, compara al jugador contra el plantel, y renderiza un dossier de una página con la marca del club que puedes imprimir o exportar a PDF.

## Cuándo se usa

Cuando necesitas una instantánea compartible de un jugador — para una revisión, una nota de scouting o un perfil impreso. Llegas a él desde el [Plantel](/support/squad) o el [Perfil de Jugador](/support/player) mediante "Exportar dossier".

## Cómo funciona

**Elegir el jugador y configurar.** Abre el dossier de un jugador y activa o desactiva bloques, elige qué tests mostrar y elige qué métricas graficar en tendencia. La vista previa se vuelve a renderizar en vivo a medida que cambias la configuración.

**Exportar.** Imprimir o **Exportar PDF** produce la hoja con la marca del club (escudo del club, identidad del jugador, KPI y los bloques habilitados). El dossier puede renderizarse en inglés, español o portugués.

## Conceptos clave

**Bloques configurables.** El dossier se construye a partir de bloques activables: **Técnico** (un radar de atributos subjetivos /10), **Atlético** (barras de percentiles para los tests seleccionados), **Producción** (goles de temporada, asistencias, valoraciones), **Scouting** (un resumen editable de texto libre) y **Evolución** (sparklines de tendencia para las métricas que elijas). Cada bloque puede mostrarse u ocultarse.

**Tests seleccionables.** En el bloque Atlético eliges exactamente qué tests físicos aparecen, de un catálogo agrupado como Saltos y potencia (CMJ, squat jump, drop jump, broad jump), Velocidad y agilidad (sprint, 505 cambio de dirección, Illinois) y Resistencia (30-15 IFT, Yo-Yo IR1, Cooper). Cada uno muestra el valor más reciente del jugador y, cuando es posible, un percentil.

**Percentiles frente a la cohorte del plantel.** El percentil de un test se calcula contra la **cohorte de equipo** del jugador — los otros jugadores del mismo equipo con un valor para ese test. Requiere **al menos cuatro pares** para mostrarse; por debajo de eso la barra recurre a un relleno neutro en lugar de un percentil, porque un percentil calculado con menos de cuatro pares no es significativo. Esta es la misma regla de cohorte/mínimo de pares que usa el módulo de [Evaluaciones](/support/evaluations).

**Plantillas guardadas.** Una configuración de dossier — qué bloques, qué tests, qué tendencias — puede **guardarse como plantilla** (a nivel de club) y recargarse, para que puedas mantener, digamos, un preajuste "Dossier físico" y un "Dossier de scouting" y aplicar cualquiera con un clic.

**El resumen de scouting.** El bloque de scouting es texto libre que editas en línea; se imprime con lo que escribas y solo se almacena en el jugador cuando lo guardas explícitamente.

## FAQ

**¿Puedo elegir qué va en el dossier?** Sí — activa los bloques, elige qué tests aparecen en el bloque Atlético, y elige las métricas de tendencia. La vista previa se actualiza en vivo.

**¿Por qué un test muestra una barra plana en lugar de un percentil?** Porque la cohorte de equipo tiene menos de cuatro pares con ese test — no suficientes para calcular un percentil válido.

**¿Puedo reutilizar una configuración?** Sí — guárdala como plantilla y aplícala a cualquier jugador.

**¿Cómo lo exporto?** Imprimir o Exportar PDF; la salida es una hoja de una página con la marca del club.

## Relacionado

- [Perfil de Jugador](/support/player) — el agregador en pantalla desde el que este dossier imprime.
- [Evaluaciones](/support/evaluations) — los tests y la misma comparación de cohorte/mínimo de pares.
- [Plantel](/support/squad) — donde abres el dossier de un jugador.
