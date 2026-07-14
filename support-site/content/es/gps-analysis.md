---
title: Análisis GPS
slug: gps-analysis
world: performance
app_page: GPS Analysis.html
order: 1
summary: Un dashboard de GPS multivista — distancia, zonas de velocidad, aceleraciones y player load a lo largo de sesiones, semanas y partidos, con líneas base, ACWR y tendencias de fitness-fatiga.
---

## Qué es

Análisis GPS es el espacio de trabajo para los datos de carga externa. Convierte las métricas GPS por jugador —distancia, zonas de velocidad, aceleraciones, [player load](glossary#player-load)— en revisiones de sesión, informes semanales, perfiles de partido y tendencias de monitoreo de carga, comparados contra líneas base del equipo y umbrales de riesgo de lesión.

## Cuándo lo usas

Úsalo tras cada sesión o partido para revisar lo que los atletas realmente hicieron, y a lo largo de la semana para comparar la carga planificada versus la entregada, detectar valores atípicos, y seguir el fitness y la fatiga. Comparte su motor de [ACWR](glossary#acwr) con el [Monitor de Carga](/support/load-monitor); Análisis GPS es a donde vas para el desglose más profundo, por métrica y por jugador.

## Cómo funciona

**Elige una vista.** Cinco vistas cubren distintas preguntas, se cambian desde la barra de secciones:

- **Informe Semanal del Jugador** — la semana de un jugador: volumen día a día, comparación semana-vs-partido, ACWR, y la tendencia de fitness/fatiga/forma.
- **Control de Sesión** — la última sesión del plantel: una tabla completa de métricas, una matriz de z-scores, un heatmap del microciclo, y la variación respecto a sesiones pasadas equivalentes.
- **Rendimiento en Partido** — los partidos de un jugador a lo largo de la temporada: distancia por partido y distribución de zonas de velocidad.
- **Monitoreo de Carga** — riesgo de lesión del equipo: gauges de ACWR, alertas de riesgo, y demandas de partido versus lo entregado en entrenamiento.
- **Comparar Microciclos** — una semana de entrenamiento contra otra: tabla de diferencias, forma de la carga, monotonía/strain, y los mayores cambios.

**Filtra globalmente.** Una única barra de filtros gobierna cada vista: un **rango de fechas** (últimos 30 días por defecto), un selector de **microciclo**, un selector de **jugador**, y un toggle **histórico** que trae datos pasados importados a las líneas base y comparaciones. Las tarjetas también pueden fijarse a un jugador específico, independientemente del filtro global.

**Importa los datos.** Trae GPS por arrastrar y soltar o explorando archivos (`.csv`, `.xlsx`, `.tsv`), un archivo por sesión o una exportación de toda la temporada; las columnas se autodetectan y se mapean a jugadores, y hay una plantilla disponible para ajustar el formato esperado. Durante la importación, los valores atípicos de velocidad se marcan para revisión.

**Personaliza el dashboard.** Cada vista es un conjunto de tarjetas que puedes redimensionar (S / M / L / Full), reordenar, agregar y quitar. **Agregar tarjeta** abre una galería de plantillas basadas en evidencia (ACWR, monotonía/strain, CTL/ATL/TSB, zonas de velocidad, valores atípicos…) o un constructor de gráficos personalizado. **Guardar diseño** y **Vistas guardadas** persisten las disposiciones por vista.

**Exporta.** Exporta la tabla de la vista actual a CSV. (Un informe en PDF y la sincronización directa con el proveedor aparecen en la UI pero aún no están activos —ver el TODO más abajo.)

## Conceptos clave

**Métricas GPS principales.** La página trabaja a partir de estos valores por sesión: **distancia total**, **distancia de alta velocidad (HSR)**, **distancia de muy alta velocidad (VHSR)**, **distancia de sprint**, **conteo de sprints**, **aceleraciones** y **desaceleraciones**, velocidad **máxima** y **promedio**, **player load**, **distancia por minuto**, y **tiempo jugado**.

**Zonas de velocidad.** La distancia se divide en bandas de velocidad (caminar/trotar → HSR → VHSR → sprint) para mostrar cuánto de una sesión fue de alta intensidad. Los gráficos de zonas de velocidad descomponen cada sesión o partido en esas bandas.

**Player load.** Una medida acumulativa de carga externa en unidades arbitrarias, derivada del movimiento (exposición a aceleración/velocidad). Es la métrica base por defecto para el ACWR y el modelo de fitness-fatiga.

**ACWR.** El ratio de carga aguda:crónica —carga reciente (aproximadamente 7 días) sobre la línea base móvil (aproximadamente 28 días). Análisis GPS usa el mismo motor de ACWR compartido y configurado por el club que el [Monitor de Carga](/support/load-monitor); puedes basarlo en player load, distancia total, HSR, distancia de sprint o aceleraciones.

**Fitness · Fatiga · Forma (CTL / ATL / TSB).** El modelo de Banister: **CTL** (carga de entrenamiento crónica, EWMA ~28 días) se lee como fitness, **ATL** (carga de entrenamiento aguda, EWMA ~7 días) como fatiga, y **TSB** (balance de estrés de entrenamiento, CTL − ATL) como forma —positivo es fresco, negativo es fatigado.

**Monotonía y strain (Foster).** La **monotonía** es la carga diaria media dividida por su desviación estándar —una monotonía alta significa una carga plana y repetitiva. El **strain** es la carga semanal por la monotonía. Ambos son señales de riesgo de estancamiento/enfermedad y aparecen en la vista Comparar Microciclos.

**Z-scores y valores atípicos.** Las métricas se estandarizan para señalar anomalías. Un z-score **temporal** compara una sesión con sesiones pasadas equivalentes (mismo día de la semana/MD); un z-score **posicional** compara a un jugador con la línea base de su rol. Los valores más allá de un umbral elegido (2, 2.5 o 3) se marcan como atípicos.

**Sesión versus partido.** La lectura "× media de partido" expresa una métrica de entrenamiento como un múltiplo de la demanda de partido (p. ej. 0.6× distancia = 60% de un partido), ayudando a dosificar la exposición semanal contra la demanda para la que los jugadores realmente se preparan.

## Preguntas frecuentes

**¿Cómo ingreso datos?** Sube un `.csv`, `.xlsx` o `.tsv` —un archivo por sesión o una exportación de temporada. Las columnas se automapean a los jugadores; usa la plantilla descargable si quieres el formato exacto esperado.

**¿Se conecta directamente a Catapult / StatSports?** La sincronización directa con el proveedor se presenta en la UI como un elemento de roadmap —ver el TODO más abajo. Hoy la vía confiable es la importación de archivos.

**¿Cuál es la diferencia con el Monitor de Carga?** Comparten el mismo motor de ACWR. El Monitor de Carga es el tablero de riesgo a nivel de plantel; Análisis GPS es el análisis profundo —por métrica, por jugador, por sesión, con líneas base y el modelo de fitness-fatiga.

**¿Puedo comparar dos semanas?** Sí —la vista Comparar Microciclos contrasta una semana actual contra una semana de referencia, con deltas por jugador, forma de la carga, monotonía/strain y los mayores cambios.

> TODO — verificar antes de documentar como implementado. El agente de GPS marcó estos como **stubs o "próximamente"** en la página actual: **exportación en PDF**, **sincronización con proveedor** (Catapult / StatSports / Polar / WIMU / GPSports), un panel dedicado de **configuración de GPS**, el cambio de tipo de gráfico, y varias tarjetas del catálogo (asimetría de acel/desacel, tendencia de línea base personal, box plot posicional, readiness del plantel, caída entre tiempos, nosotros-vs-rival). Además, los **umbrales exactos de zonas de velocidad** (cortes de HSR / VHSR / sprint en m·s⁻¹) no se exponen en la página y parecen configurados por el club —confirmar los valores reales antes de publicarlos.

## Relacionado

- [Monitor de Carga](/support/load-monitor) — la vista de ACWR a nivel de plantel construida sobre el mismo motor.
- [Calendario](/support/calendar) — donde se programan las sesiones y se establece la carga planificada.
