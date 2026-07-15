---
title: Glosario
slug: glossary
world: overview
order: 0
app_page: 
summary: La única fuente de verdad para los conceptos de dominio de ClavaMetrics — ACWR, s-RPE, EWMA, MD-, microciclos y más, con las fórmulas reales y referencias citadas.
---

## Qué es

Este glosario es la única fuente de verdad para los conceptos de dominio usados a lo largo de ClavaMetrics. Cada entrada da una definición breve, cómo la app realmente lo calcula (la fórmula real, tomada del código), cómo leerlo y sus límites, y referencias. Otras páginas enlazan aquí su primera mención de un término en lugar de redefinirlo.

## ACWR {#acwr}

**Ratio de carga aguda:crónica** — la carga reciente (la ventana **aguda**) dividida por la línea base móvil (la ventana **crónica**). Es un número adimensional que señala cuán rápido está cambiando la carga de un jugador en relación con aquello para lo que está acondicionado.

**Cómo lo calcula ClavaMetrics.** Ventana aguda = **7 días**, ventana crónica = **28 días**. Las cargas diarias se rellenan con ceros (los días sin entrenamiento cuentan como 0). Hay dos modelos disponibles (el activo es una configuración del club):

- **EWMA** (por defecto) — una media móvil exponencialmente ponderada con decaimiento λ = 2/(N+1), de modo que λ_agudo = 2/8 y λ_crónico = 2/29; la carga de cada día actualiza la media móvil y ACWR = agudo ÷ crónico.
- **Media móvil** — ACWR = media(últimos 7 días) ÷ media(ventana crónica).

Las ventanas están **desacopladas** por defecto: la ventana crónica excluye los 7 días agudos (días 8–28), de modo que el pico reciente que se mide no infla también su propia línea base. Un jugador necesita al menos **4 sesiones** en la ventana crónica para obtener un valor.

**Zonas.** ClavaMetrics clasifica el ACWR como: **menos de 0.8** infracarga · **0.8–1.3** zona óptima · **1.3–1.5** sobrecarga (overreach) · **1.5 y más** riesgo alto.

**Cómo leerlo — y una nota de honestidad.** El ACWR es una *señal de cambio de carga*, no una predicción de lesión. La idea de la "zona óptima" y el uso del ACWR como predictor de lesión están **metodológicamente cuestionados** en la literatura: el ratio tiene problemas de acoplamiento matemático y analíticos, y la "zona óptima" protectora **no se ha replicado de forma consistente** entre estudios. Trata el ACWR como un insumo más —léelo junto al bienestar, el session-RPE y, sobre todo, el criterio médico— nunca como un veredicto. **Ver Referencias 1, 3–9.**

## s-RPE {#s-rpe}

**RPE de sesión (carga de sesión)** — una medida de carga interna que combina cuán dura se sintió una sesión con cuánto duró.

**Cómo lo calcula ClavaMetrics.** **s-RPE = RPE × duración de la sesión en minutos**, en unidades arbitrarias (au), con el RPE en una escala **1–10**. Una sesión de 60 minutos valorada en 7 = 420 au. Esta es la carga por jugador y por sesión que alimenta el ACWR cuando se selecciona la métrica s-RPE. **Ver Referencia 10.**

## Carga aguda y crónica {#acute-and-chronic-load}

La **carga aguda** es la carga total (o ponderada por EWMA) a lo largo de la ventana reciente (**7 días** en ClavaMetrics) —el estrés actual. La **carga crónica** es la línea base móvil a lo largo de la ventana más larga (**28 días**) —lo que el jugador está acondicionado a tolerar. El [ACWR](glossary#acwr) es lo agudo en relación con lo crónico. En el modelo desacoplado la ventana crónica excluye los días agudos para que las dos no se solapen.

## EWMA {#ewma}

**Media móvil exponencialmente ponderada** — una forma de promediar una serie temporal que da más peso a los valores recientes. ClavaMetrics la usa como modelo por defecto de [ACWR](glossary#acwr) porque, a diferencia de una media móvil simple, pondera la carga reciente con más fuerza y evita el salto artificial que produce una media móvil cuando una sesión antigua cae fuera del borde de la ventana.

**Cómo lo calcula ClavaMetrics.** Factor de decaimiento **λ = 2/(N+1)** para una ventana de N días; cada día: `value = load·λ + previous·(1−λ)`, aplicado con N=7 para la serie aguda y N=28 para la serie crónica. **Ver Referencia 2.**

## MD (offset de día de partido) {#md-matchday-offset}

**Día de partido menos / más** — cada día de una semana de entrenamiento se etiqueta en relación con el partido. **MD** es el partido; **MD-1 … MD-6** cuentan hacia atrás desde él; **MD+1, MD+2 …** cuentan hacia adelante (recuperación). Es la columna vertebral de la planificación semanal: el offset señala el rol y la carga previstos del día. En ClavaMetrics el offset se deriva automáticamente de la fecha de partido del microciclo y puede sobrescribirse por día. Ver [Morfociclo](glossary#morphocycle) para la metodología de la que proviene.

## Microciclo {#microcycle}

Un **microciclo** es un bloque de entrenamiento, normalmente una semana, construido en torno a un partido. Delimita un conjunto de sesiones con una fecha de inicio y fin y (normalmente) un partido objetivo, y lleva la estructura de [MD](glossary#md-matchday-offset) para sus días. Los microciclos son la unidad atómica del plan de temporada.

## Morfociclo {#morphocycle}

El **morfociclo** es la estructura semanal de la Periodización Táctica (metodología de Vítor Frade): la semana se organiza en torno al partido usando los días [MD-](glossary#md-matchday-offset), con una distribución característica del esfuerzo (p. ej. variando la contracción/tensión dominante, la duración y las demandas de velocidad a medida que se acerca el partido). ClavaMetrics lo representa a través de las etiquetas de día MD- y sus tipos de día por defecto. (Ver la nota de Referencias sobre las fuentes metodológicas.)

## Modelos de periodización {#periodization-models}

Los marcos de planificación de temporada que ClavaMetrics ofrece en el [Planificador Anual](/support/annual-planner):

- **Periodización Táctica** (Frade) — el [morfociclo](glossary#morphocycle); semana organizada en torno al partido, sin bloques macro/meso.
- **Microciclo Estructurado** (Seirul·lo) — las semanas están *tipificadas* (ajuste, carga, impacto, competitiva).
- **ATR** (Issurin) — periodización por bloques con bloques macro-meso de acumulación/transformación/realización.
- **Verheijen** — periodización específica del fútbol en bloques de varias semanas.

Estas son metodologías seleccionables; la app sigue la estructura, no la prescripción de entrenamiento. **Ver Referencia 12** y la nota de Referencias.

## Player load {#player-load}

Una medida de carga externa derivada de acelerómetro (en unidades arbitrarias) acumulada a partir del movimiento de un jugador (exposición a aceleración/velocidad). En ClavaMetrics es una de las métricas GPS que puede alimentar el [ACWR](glossary#acwr), y es la métrica base por defecto para las lecturas de carga y de fitness/fatiga. El cálculo exacto es propietario del proveedor de GPS (Catapult/StatSports), por lo que ClavaMetrics lo lee de los datos importados en lugar de calcularlo.

## HSR, VHSR y distancia de sprint {#hsr-vhsr-and-sprint-distance}

Distancia recorrida por encima de umbrales de velocidad establecidos: **carrera de alta velocidad (HSR)**, **carrera de muy alta velocidad (VHSR)** y **distancia de sprint**, cada una acumulando los metros corridos por encima de su umbral. Cuantifican la porción de alta intensidad de una sesión.

**Importante:** los umbrales de velocidad son **configurables por club** en ClavaMetrics (y varían según el proveedor y la metodología), por lo que este glosario deliberadamente **no** publica valores de corte fijos —revisa los umbrales configurados de tu club.

## Aceleraciones y desaceleraciones (A+D) {#accelerations-and-decelerations-ad}

Conteos de esfuerzos de aceleración y desaceleración por encima de un umbral —un indicador de la carga mecánica, de cambio de ritmo, que la distancia por sí sola pasa por alto. La métrica combinada **A+D** de ClavaMetrics es simplemente la suma de **aceleraciones + desaceleraciones**, disponible como métrica base de [ACWR](glossary#acwr). Al igual que con las zonas de velocidad, los umbrales de esfuerzo provienen de la configuración del proveedor de GPS/club.

## Estado de disponibilidad {#availability-status}

Cada jugador lleva un estado diario de disponibilidad en la matriz de [Disponibilidad](/support/availability). El conjunto es: **disponible** (pleno), **parcial / limitado** (entrenamiento modificado), **lesionado / no disponible** (fuera), **enfermo** (enfermedad), **ausente por selección** (compromiso con la selección), y **ausente** (contexto de partido, cero minutos). Disponible y parcial cuentan para el plantel entrenable; lesionado, enfermo y ausente por selección cuentan como fuera. Los estados se establecen manualmente y se autocompletan a partir de las lesiones activas sin sobrescribir las entradas manuales.

## Carga planificada vs carga real {#planned-load-vs-actual-load}

La **carga planificada** es lo que *pretendes*: en las vistas de planificación ClavaMetrics la calcula como el **RPE estimado × duración** que estableces en una sesión (la misma fórmula de [s-RPE](glossary#s-rpe), pero usando el RPE *estimado* del cuerpo técnico). La **carga real** es lo que se *entregó*: el session-RPE reportado por los jugadores tras entrenar, y la carga externa de GPS.

Nota sobre "RPE pendiente": en el contexto de planificación/calendario, "RPE pendiente" significa una sesión que aún **no tiene RPE estimado** establecido (por lo que su carga planificada no puede calcularse) —**no** significa que los jugadores no hayan reportado. El RPE reportado por el jugador se sigue por separado en la página de [RPE](/support/rpe).

## Referencias

Todas las referencias a continuación se verificaron contra PubMed / la revista de registro; se da la cita exacta. Cuando un trabajo es cuestionado o metodológico, se indica en el término correspondiente arriba.

1. Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? *British Journal of Sports Medicine.* 2016;50(5):273–280. [doi:10.1136/bjsports-2015-095788](https://doi.org/10.1136/bjsports-2015-095788) — origen de la narrativa de la "zona óptima" del ACWR.
2. Williams S, West S, Cross MJ, Stokes KA. Better way to determine the acute:chronic workload ratio? *British Journal of Sports Medicine.* 2017;51(3):209–210. [doi:10.1136/bjsports-2016-096589](https://doi.org/10.1136/bjsports-2016-096589) — propone el enfoque EWMA sobre la media móvil.
3. Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. *British Journal of Sports Medicine.* 2019;53(15):921–922. [doi:10.1136/bjsports-2017-098110](https://doi.org/10.1136/bjsports-2017-098110) — el argumento a favor de ventanas desacopladas.
4. Windt J, Gabbett TJ. Is it all for naught? What does mathematical coupling mean for acute:chronic workload ratios? *British Journal of Sports Medicine.* 2019;53(16):988–990. [doi:10.1136/bjsports-2017-098925](https://doi.org/10.1136/bjsports-2017-098925).
5. Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. *International Journal of Sports Physiology and Performance.* 2020;15(6):907–913. [doi:10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864) — crítica metodológica central.
6. Impellizzeri FM, McCall A, Ward P, Bornn L, Coutts AJ. Training Load and Its Role in Injury Prevention, Part 2: Conceptual and Methodologic Pitfalls. *Journal of Athletic Training.* 2020;55(9):893–901. [doi:10.4085/1062-6050-501-19](https://doi.org/10.4085/1062-6050-501-19).
7. Carbone L, Sampietro M, Cicognini A, et al. Is the Relationship between Acute and Chronic Workload a Valid Predictive Injury Tool? A Bayesian Analysis. *Journal of Clinical Medicine.* 2022;11(19):5945. [doi:10.3390/jcm11195945](https://doi.org/10.3390/jcm11195945) — encuentra que el ACWR no es mejor que el azar para predecir lesiones.
8. Qin W, Li R, Chen L. Acute to chronic workload ratio (ACWR) for predicting sports injury risk: a systematic review and meta-analysis. *BMC Sports Science, Medicine and Rehabilitation.* 2025;17(1):285. [doi:10.1186/s13102-025-01332-x](https://doi.org/10.1186/s13102-025-01332-x) — la revisión más reciente; advierte sobre la heterogeneidad y la replicación inconsistente.
9. Soligard T, Schwellnus M, Alonso J-M, et al. How much is too much? (Part 1) International Olympic Committee consensus statement on load in sport and risk of injury. *British Journal of Sports Medicine.* 2016;50(17):1030–1041. [doi:10.1136/bjsports-2016-096581](https://doi.org/10.1136/bjsports-2016-096581) — el consenso de gestión de carga contra el que las críticas posteriores se posicionan.
10. Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. *Journal of Strength and Conditioning Research.* 2001;15(1):109–115. PMID: 11708692 — artículo fundacional del session-RPE (s-RPE = RPE × duración; sin DOI, citar por PMID).
11. Foster C. Monitoring training in athletes with reference to overtraining syndrome. *Medicine & Science in Sports & Exercise.* 1998;30(7):1164–1168. [doi:10.1097/00005768-199807000-00023](https://doi.org/10.1097/00005768-199807000-00023) — monotonía y strain.
12. Martín-García A, Gómez Díaz A, Bradley PS, Morera F, Casamichana D. Quantification of a Professional Football Team's External Load Using a Microcycle Structure. *Journal of Strength and Conditioning Research.* 2018;32(12):3511–3518. [doi:10.1519/JSC.0000000000002816](https://doi.org/10.1519/JSC.0000000000002816) — una operacionalización empírica del enfoque de microciclo estructurado.

## Relacionado

- [Monitor de Carga](/support/load-monitor) — el ACWR en la práctica a nivel de plantel.
- [Análisis GPS](/support/gps-analysis) — las métricas de carga externa definidas aquí.
- [RPE](/support/rpe) — recolección del s-RPE.
- [Planificador Anual](/support/annual-planner) — los modelos de periodización.
