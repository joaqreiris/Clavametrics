---
title: Gym Planner
slug: gym-planner
world: planning
app_page: Gym Planner.html
order: 6
summary: El constructor de sesiones de fuerza — calentamiento, pliometría, trabajo principal y adaptaciones individuales, con series × reps × carga, tonelaje, y un borrador con IA que solo elige entre tus propios ejercicios.
---

## Qué es

El Gym Planner construye una sesión completa de fuerza/gimnasio, organizada en bloques ordenados —**Calentamiento y movilidad, Pliometría y potencia, Trabajo principal,** y **Adaptaciones individuales**— donde cada ejercicio se prescribe con series × reps, carga, descanso, tempo y RPE, y cada jugador puede recibir reemplazos guiados por fisioterapia.

## Cuándo lo usas

Lo abres desde el [Calendario](/support/calendar) haciendo clic en una sesión de gimnasio para una fecha; carga la sesión de esa fecha (o inicia una nueva), heredando el microciclo y el contexto de MD-. Úsalo para prescribir la sesión, asignar a los atletas, aplicar adaptaciones individuales, y luego imprimirla o publicarla.

## Cómo funciona

**Establece la información de la sesión.** Fecha, hora de inicio, duración, RPE esperado, ubicación, y un título. Las píldoras de **Orientación** (multiselección) etiquetan el énfasis —Activación, Hipertrofia, Fuerza máxima, Potencia, RSI · reactivo, Recuperación. Los campos heredados del Calendario (microciclo, día de partido, hora, duración, RPE) están marcados como provenientes del calendario —cámbialos en el Calendario para mantener todo sincronizado.

**Construye los cuatro bloques.** Agrega ejercicios a cada bloque desde la Biblioteca de Gimnasio ("Desde biblioteca") o como filas nuevas:

- **Calentamiento y movilidad** — ejercicio, series, reps/tiempo, tempo, notas.
- **Pliometría y potencia** — ejercicio, tipo de contacto (Intensivo / Extensivo), series × reps, contactos, cajón/altura, descanso, notas.
- **Trabajo principal** — ejercicio, un toggle de **modo** por fila (**SR** series×reps o **VBT** basado en velocidad), series × reps, carga (kg o %1RM), descanso, tempo y RPE.
- **Adaptaciones individuales** — reemplazos por jugador, sembrados a partir de los tratamientos de Fisioterapia de hoy y editables, más los que agregues: jugador, ejercicios afectados, reemplazo, y el motivo.

**Vigila los totales.** Una barra en vivo muestra los conteos de calentamiento, pliometría y trabajo principal, el **tonelaje** total (autosumado a partir de series × reps × carga), el número de atletas, y las **AU planificadas** (duración × RPE).

**Asigna a los atletas.** Elige jugadores del plantel (los jugadores no disponibles llevan insignia), y usa **Grupos de carga** para dividir el plantel en niveles a partir de sus resultados de tests de fuerza y prescribir un rango de carga %RM por nivel.

**Genera con IA (opcional).** Describe el objetivo (p. ej. "fuerza de isquiotibiales, énfasis excéntrico, 12 jugadores") y el asistente produce un **borrador** editable que revisas antes de aplicarlo —ver Conceptos clave para exactamente qué puede y qué no puede hacer.

**Guarda, plantilla, publica.** La sesión se autoguarda mientras editas. Puedes guardarla como **plantilla** (o cargar una), **Imprimir** / **Exportar PDF** una hoja de sesión, y **Publicarla** a los jugadores.

## Conceptos clave

**Los bloques.** Una sesión de gimnasio es una secuencia fija: calentamiento/movilidad → pliometría/potencia → trabajo principal → adaptaciones individuales. El orden refleja cómo se ejecuta la sesión y cómo se imprime.

**Prescripción (series × reps × carga).** Cada fila de trabajo principal lleva series × reps, una carga (kg, peso corporal, relativa "+N", o un %1RM), descanso, y un tempo (p. ej. "2-0-1" —excéntrico-pausa-concéntrico). El **tonelaje** es la suma de series × reps × carga a lo largo de las filas válidas de trabajo principal —una cifra simple de carga de volumen.

**SR vs VBT.** Cada ejercicio principal se prescribe ya sea como **SR** (series × reps, por defecto) o **VBT** (entrenamiento basado en velocidad, prescribiendo por velocidad de barra). El modo se guarda por ejercicio.

**Generación asistida por IA.** El asistente **solo selecciona entre los ejercicios existentes y etiquetados de la Biblioteca de Gimnasio de tu club —nunca inventa ejercicios.** Lee tu objetivo más un contexto opcional (número de jugadores, énfasis, y señales blandas como el día de partido, la zona de [ACWR](glossary#acwr) del equipo y la tendencia de readiness) y devuelve un **borrador** —filas de calentamiento, pliometría y trabajo principal construidas a partir de IDs de ejercicios reales. Confirmas antes de que reemplace la sesión actual, y cada campo queda totalmente editable después. Si nada en la biblioteca está etiquetado aún, te pide que etiquetes ejercicios en la Biblioteca de Gimnasio primero.

**Grupos de carga.** En lugar de una prescripción para todos, Grupos de carga agrupa el plantel en niveles a partir de sus valores de tests de fuerza y muestra un rango de carga por nivel para un %RM elegido —para que cada atleta levante en relación con su propio test.

**Cómo se relaciona con la carga.** La duración × RPE esperado de la sesión da las **AU planificadas** —la estimación de carga interna del lado de la planificación. La carga interna entregada proviene del session-RPE de los jugadores después (ver [RPE](/support/rpe)), que a su vez alimenta el [Monitor de Carga](/support/load-monitor).

## Preguntas frecuentes

**¿La IA inventa ejercicios?** No. Elige solo entre los ejercicios existentes de la Biblioteca de Gimnasio de tu club (los etiquetados con grupo muscular/propósito) y devuelve un borrador editable que apruebas —no puede agregar ejercicios que no estén ya en tu biblioteca.

**¿Puedo aún editar una sesión generada por IA?** Sí —el borrador es totalmente editable, y solo reemplaza la sesión actual después de que confirmes.

**¿Cómo se calcula el tonelaje?** Suma series × reps × carga a lo largo de las filas de trabajo principal que tienen una carga numérica; las cargas de peso corporal y relativas se omiten.

**¿De dónde vienen las adaptaciones individuales?** De los tratamientos de Fisioterapia de hoy para el equipo (precargados) más los que agregues manualmente —cada una nombra al jugador, los ejercicios afectados, el reemplazo y el motivo.

**¿Por qué algunos campos están bloqueados?** Los campos heredados del Calendario (microciclo, día de partido, hora, duración, RPE) se editan allí para mantenerse sincronizados en toda la app.

## Relacionado

- [Calendario](/support/calendar) — donde se programa la sesión de gimnasio y se establece su contexto de MD-.
- [Planificación Diaria](/support/daily-planning) — la contraparte de sesión de campo de esta sesión de gimnasio.
- [RPE](/support/rpe) — la carga s-RPE entregada versus las AU planificadas aquí.
- [Monitor de Carga](/support/load-monitor) — donde esa carga se consolida en el ACWR.
