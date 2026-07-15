---
title: Planificador Anual
slug: annual-planner
world: planning
app_page: Annual Planner.html
order: 3
summary: El macro-plan de la temporada — define un modelo de periodización, dispón las fases, competiciones y partidos, y divide el año en mesociclos y microciclos semanales.
---

## Qué es

El Planificador Anual es la macrovista de toda la temporada: eliges un **[modelo de periodización](glossary#periodization-models)**, marcas las **fases** del año, cargas las **competiciones y partidos**, y divides la temporada en **microciclos** (semanas) — opcionalmente agrupados en mesociclos — cada uno anclado a sus partidos.

## Cuándo se usa

En la configuración de pretemporada y durante todo el año para la planificación estratégica: define la temporada, sus fases y calendario, luego genera y da forma a la estructura semanal. Desde aquí saltas al [Calendario](/support/calendar) para detallar una semana dada y a [Planificación Diaria](/support/daily-planning) para construir cada sesión.

## Cómo funciona

**Crear la temporada.** Dale un nombre y fechas de inicio/fin, y elige un **modelo de planificación** (ver Conceptos clave). El modelo decide qué ofrece el resto de la pantalla — en particular si planificas en bloques (macrociclos/mesociclos) y si los microciclos están tipificados.

**Marcar las fases.** Añade fases de temporada (p. ej. pretemporada, competitiva, transición, fuera de temporada) con un color, fechas y un indicador **"cuenta para disponibilidad"** — las fases que no cuentan se dibujan con un patrón rayado y se excluyen del seguimiento de disponibilidad/carga.

**Añadir competiciones y partidos.** Registra las competiciones (liga, copa, internacional, amistoso, supercopa — cada una con un color), luego añade partidos manualmente o **importa el calendario** arrastrando un archivo (CSV, Excel, PDF) o pegando texto; una vista previa te deja revisarlos antes de importar.

**Añadir bloques de periodización (solo modelos por bloques).** Con un modelo por bloques, crea **macrociclos** y, anidados dentro de ellos, **mesociclos** — cada mesociclo lleva un **modelo de carga** (Estructurado, Táctico, Verheijen, ATR o Integral).

**Construir los microciclos.** Añade una semana manualmente o **Genera semanas a partir de los partidos** para disponer microciclos de lunes a domingo a lo largo de la lista de partidos, incrustando automáticamente el partido en su semana. En modo edición, abre un microciclo para definir su nombre, fechas, color, su mesociclo (modelos por bloques) o su **tipo de micro** (modelo Estructurado), y un **plan semanal**: para cada día, una etiqueta **MD** y un tipo de día. **Restablecer a morfociclo** limpia un plan de día personalizado volviéndolo a la estructura automática. **Abrir en Calendario** lleva esa semana al Calendario.

**Leer la línea de tiempo.** Una gran vista de línea de tiempo apila fases, macro/mesociclos (modelos por bloques), microciclos y partidos en una pista con zoom (temporada completa → 6 meses → 3 meses → 6 semanas), con paneles de KPI para el microciclo actual, el próximo partido, el progreso de la temporada y la fase activa.

## Conceptos clave

**Modelos de periodización.** El modelo de la temporada da forma a cómo planificas:

| Modelo | Escuela | ¿Bloques? | ¿Micros tipificados? |
| --- | --- | --- | --- |
| Periodización Táctica | Frade — morfociclo | no | no |
| Microciclo Estructurado | Seirul·lo — micros tipificados | no | sí |
| ATR (bloques) | Issurin — macrociclos de 4–6 sem | sí | no |
| Verheijen | fútbol — bloques de 6 semanas | sí | no |

- **Periodización Táctica (Frade)** organiza la semana como un *morfociclo* alrededor del partido — sin bloques macro/meso; los tipos de día se repiten semanalmente en relación con MD.
- **Microciclo Estructurado (Seirul·lo)** tipifica cada semana por su rol: **Ajuste**, **Carga**, **Impacto** o **Competitivo**.
- **ATR (Issurin)** y **Verheijen** son modelos por bloques: el año se construye a partir de macrociclos → mesociclos, cada mesociclo con un énfasis de carga.

**Fases de temporada.** Las fases segmentan el año (pretemporada, competitiva, transición, fuera de temporada, descansos) con su propio color y fechas. El indicador "cuenta para disponibilidad" decide si el tiempo en la fase alimenta el seguimiento de disponibilidad y carga — las fases de fuera de temporada/descanso suelen configurarse para no contar.

**Mesociclo → microciclo.** En los modelos por bloques, un **mesociclo** agrupa varios **microciclos** y define el modelo de carga del bloque; no define la estructura diaria. El **microciclo** es la unidad atómica — una semana (normalmente de lunes a domingo) con un partido incrustado opcional, un tipo de micro opcional, un color y un plan día a día.

**Cómo se deriva MD-.** La etiqueta **día-de-partido-menos** de cada día proviene de la fecha del partido de la semana: el día del partido es **MD**, los días previos cuentan hacia atrás **MD-1 … MD-6**, y los días posteriores cuentan hacia arriba **MD+1 …**. El modelo mapea cada MD a un tipo de día por defecto — por ejemplo MD-1 → activación, MD-2 → velocidad, MD-3 → duración, MD-4 → tensión muscular, MD-5 → recuperación, MD+1/MD+2 → recuperación, MD+3 → descanso. Puedes anular cualquier día, o restablecer la semana a este valor por defecto de morfociclo. Esta es la misma estructura MD- que muestran el [Calendario](/support/calendar) y la [Planificación Diaria](/support/daily-planning).

## FAQ

**¿Qué modelo debería elegir?** El que coincida con tu metodología — Periodización Táctica y Microciclo Estructurado planifican semana a semana (sin bloques); ATR y Verheijen añaden bloques macro/meso. Solo el modelo Estructurado tipifica cada microciclo (Ajuste/Carga/Impacto/Competitivo).

**¿Cómo relleno una temporada rápidamente?** Importa los partidos (CSV, Excel, PDF o texto pegado), luego **Genera semanas a partir de los partidos** para crear los microciclos automáticamente, cada uno con su partido incrustado.

**¿De dónde vienen los tipos de día de una semana?** De la estructura MD- del modelo — cada día obtiene un tipo por defecto de su etiqueta de día de partido, que puedes anular por día y restablecer con "Restablecer a morfociclo".

**¿Cuál es la diferencia entre una fase y un mesociclo?** Una fase es un segmento amplio de temporada (p. ej. pretemporada) con un indicador de disponibilidad; un mesociclo es un bloque de periodización (solo modelos por bloques) que agrupa semanas y define su modelo de carga.

## Relacionado

- [Calendario](/support/calendar) — detalla la semana de un microciclo; los partidos y las etiquetas MD- se comparten.
- [Planificación Diaria](/support/daily-planning) — construye cada sesión dentro de la semana que el modelo da forma.
