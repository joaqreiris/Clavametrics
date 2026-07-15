---
title: Monitor de Carga
slug: load-monitor
world: performance
app_page: Load Monitor.html
order: 2
summary: Un dashboard de riesgo de carga a nivel de plantel construido sobre el ratio de carga aguda:crónica (ACWR) — quién está en infracarga, en la zona óptima, en sobrecarga o en la zona de peligro.
---

## Qué es

El Monitor de Carga es un dashboard de readiness a nivel de plantel centrado en el **[ratio de carga aguda:crónica (ACWR)](glossary#acwr)**. Lee la carga reciente de cada jugador contra su propia línea base móvil y ordena el plantel en zonas de carga —infracarga, zona óptima, sobrecarga, o riesgo alto— para que el cuerpo técnico vea de un vistazo quién necesita frenar y quién tiene margen para empujar.

## Cuándo lo usas

Úsalo en la rutina de planificación diaria —típicamente antes o después de una sesión— para revisar el panorama de riesgo del plantel, detectar jugadores que tienden hacia la zona de peligro, y cruzar el ACWR contra el bienestar y el session-RPE de hoy. Complementa al [Calendario](/support/calendar) (que crea las sesiones de las que se calcula la carga) y al [Análisis GPS](/support/gps-analysis) (que ofrece el mismo motor con desgloses más profundos por métrica).

## Cómo funciona

**Elige el plantel y el periodo.** El selector de equipo acota todos los datos a una categoría. Un control segmentado cambia la ventana temporal: **7d**, **28d** (por defecto), **Microciclo**, o **Temporada**. Cambiarlo reacota el gráfico, la distribución y cada tarjeta.

**Lee la franja de KPIs.** Cuatro tarjetas resumen el plantel: ACWR promedio (con una mini barra de zonas), número de jugadores en la zona de peligro, bienestar promedio de hoy, y session-RPE promedio de los últimos siete días.

**Lee el gráfico.** El gráfico principal traza el ACWR promedio del plantel a lo largo del tiempo como una línea, con la carga diaria dibujada como barras detrás de ella, y líneas de referencia punteadas en los umbrales de zona. Es importante que la línea del plantel es la **media del ACWR de cada jugador**, no un único ratio agregado del plantel —promediar ratios en lugar de cargas brutas evita que los jugadores de alto volumen dominen el número.

**Lee la distribución y el bienestar.** Un donut desglosa el plantel en porciones de zona óptima / sobrecarga / peligro / sin datos (alterna a una tabla si prefieres nombres y valores). Un panel de bienestar muestra las dimensiones del check-in de hoy (Sueño, Ánimo, Fatiga, Estrés, Dolor muscular —o el índice de Hooper si el club lo usa), coloreadas según cuán favorable es cada una.

**Trabaja la tabla de jugadores.** Cada jugador aparece con dorsal, posición, un valor y barra de ACWR, session-RPE, bienestar, sus cifras agudo/crónico, y una píldora de zona. Puedes:

- **Filtrar por zona** — Todos, Peligro, Sobrecarga, Zona óptima, Infracarga.
- **Agrupar por** Posición, Estado o Edad, y **ordenar** por cualquier columna (ACWR ordena de mayor a menor por defecto; los jugadores sin datos siempre se ordenan al final).
- **Actuar sobre una alerta de bienestar** — una fila marcada (zona de dolor reportada o nota de bienestar) abre un modal donde puedes **Marcar como visto** o **Crear un seguimiento en Lesiones**.

**Ajusta el modelo.** Dos controles cambian cómo se calcula el ACWR (ver Conceptos clave): un selector de **métrica** elige qué flujo de carga alimenta el ratio (carga de session-RPE por defecto, o una métrica GPS), y un popover de **modelo** alterna **EWMA vs Media móvil** y ventanas crónicas **Desacoplada vs Acoplada**.

**Exporta.** Exporta la tabla a CSV (jugador, posición, ACWR, carga aguda y crónica, zona, último RPE, sesiones), y guarda el gráfico o la distribución como PNG.

## Conceptos clave

**ACWR (ratio de carga aguda:crónica).** Un ratio adimensional de la carga reciente (la ventana **aguda**, últimos 7 días) respecto a la línea base móvil del jugador (la ventana **crónica**, últimos 28 días). Es una señal de cuán rápido está cambiando la carga, no un veredicto —léelo junto al bienestar, el RPE y el criterio médico.

**Las zonas.** El Monitor de Carga usa estos límites (del motor de ACWR compartido):

| Zona | ACWR | Lectura |
| --- | --- | --- |
| Infracarga | menos de 0.8 | La carga reciente está por debajo de la línea base — estímulo subóptimo, riesgo de desentrenamiento. |
| Zona óptima | 0.8 – 1.3 | La carga progresa al ritmo de la línea base — el rango objetivo. |
| Sobrecarga | 1.3 – 1.5 | Elevada, tolerable a corto plazo (p. ej. un bloque de carga o taper) — vigilar de cerca. |
| Riesgo alto | 1.5 y más | Un pico agudo — la zona de peligro; combinar con el bienestar antes de decidir. |

Un jugador necesita al menos **4 sesiones** en la ventana crónica para obtener un ACWR; por debajo de eso aparece como "sin datos" y se deja fuera del promedio del plantel.

**EWMA vs Media móvil.** El modelo **EWMA** (media móvil exponencialmente ponderada) es el valor por defecto basado en evidencia: pondera más los días recientes y evita el "pico" artificial que produce una media móvil simple cuando las sesiones antiguas caen fuera del borde de 7 días. El modelo **Media móvil** es la media simple de la ventana. El modelo activo es una **configuración a nivel de club**, de modo que cada página que muestra ACWR (Monitor de Carga, Análisis GPS, dosieres de jugador) lee el mismo número.

**Acoplado vs desacoplado.** Por defecto las ventanas están **desacopladas**: la ventana crónica son los días 8–28, excluyendo los 7 días agudos. Esto impide que el pico reciente que intentas detectar también infle la línea base contra la que se mide (el enfoque metodológicamente preferido). El modo **Acoplado** incluye los 28 días completos en la ventana crónica.

**Carga de s-RPE (RPE de sesión).** El flujo de carga por defecto. Para cada sesión, carga = **RPE (0–10) × duración (minutos)**, en unidades arbitrarias —una medida interna, basada en la percepción, de cuán dura fue la sesión. El selector de métrica puede cambiar esto por un flujo GPS (player load, distancia total, distancia de alta velocidad, distancia de sprint, sprints, o aceleraciones+desaceleraciones) cuando hay datos GPS disponibles.

**Carga aguda vs crónica.** La aguda es la suma de la carga de los últimos 7 días —el estrés reciente. La crónica es la línea base móvil del jugador a lo largo de 28 días —la carga para la que está acondicionado. El ACWR es simplemente lo agudo en relación con lo crónico.

## Preguntas frecuentes

**¿Qué ACWR es "bueno"?** La zona óptima de 0.8–1.3 es el objetivo. 1.3–1.5 es sobrecarga —aceptable brevemente pero digna de vigilar. 1.5 y más es la zona de pico de riesgo alto. Por debajo de 0.8 es infracarga.

**¿Por qué un jugador muestra sin ACWR?** Tiene menos de 4 sesiones en los últimos 28 días, así que no hay suficiente historial para una línea base fiable. Se excluye del promedio del plantel hasta que cruce ese umbral.

**¿Qué carga usa el ACWR?** Carga de session-RPE por defecto (RPE × minutos). Usa el selector de métrica para basarlo en un flujo GPS en su lugar, donde existan datos GPS.

**¿Por qué la línea del plantel es un promedio de ratios?** Porque promediar el ACWR de cada jugador (en lugar de agregar la carga bruta del plantel) evita que los jugadores de muchos minutos sesguen el panorama a nivel de equipo —refleja el riesgo del equipo con más fidelidad.

**¿De dónde vienen los datos de carga?** De las sesiones de entrenamiento y sus entradas de RPE (y, para las métricas GPS, de los informes GPS importados/sincronizados). El [Calendario](/support/calendar) crea las sesiones; las alertas de bienestar enlazan hacia Lesiones.

## Relacionado

- [Análisis GPS](/support/gps-analysis) — el mismo motor de ACWR, más análisis por métrica y por jugador.
- [Calendario](/support/calendar) — donde se originan las sesiones y la carga planificada.
