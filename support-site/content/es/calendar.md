---
title: Calendario
slug: calendar
world: planning
app_page: Calendar.html
order: 1
summary: El lienzo de planificación del equipo — microciclos, sesiones de entrenamiento, partidos y logística dispuestos día a día en torno al marco de día-de-partido-menos.
---

## Qué es

El Calendario es donde el cuerpo técnico dispone el calendario del equipo: sesiones de entrenamiento, partidos, recuperación y logística (viajes, comidas, reuniones, prensa) organizados en **[microciclos](glossary#microcycle)** y estructurados en torno al marco de **[día-de-partido-menos (MD-)](glossary#md-matchday-offset)**.

## Cuándo se usa

Usa el Calendario como punto de partida de cada semana de planificación. Primero construyes el microciclo aquí — defines la fecha del partido, colocas sesiones, ajustas las etiquetas MD- — y luego profundizas en cada sesión desde el Calendario hacia **Planificación Diaria** (campo) o **Planificador de Gimnasio** (gimnasio) para diseñar el contenido real. También es donde importas los partidos de la temporada y publicas el calendario a los jugadores.

## Cómo funciona

**Cambiar de vista.** Cuatro vistas cubren diferentes horizontes de planificación:

- **Microciclo** (por defecto) — la semana de entrenamiento actual de 7 días, dispuesta como una cuadrícula de días con sus etiquetas MD-.
- **Mes** — una cuadrícula de mes completo; las sesiones se codifican por color según el tipo y cada microciclo se tinta para que los bloques sean fáciles de ver.
- **Lista** — una lista cronológica de próximas sesiones (título, insignia de tipo, duración).
- **Vista de jugador** — una vista previa solo para el personal de exactamente lo que ven los jugadores, mostrando únicamente los eventos compartidos con ellos.

Navega con el botón **Hoy**, las flechas anterior/siguiente (avanza por semana en la vista Microciclo, por mes en la vista Mes), y los controles de **zoom** que comprimen o expanden cuántos días muestra el microciclo.

**Filtrar lo que ves.** Píldoras de filtro rápido reducen el calendario a un solo tipo: **Todo**, **Entrenamiento**, **Gimnasio**, **Partido**, **Recuperación** o **Viaje**. El **selector de equipo** en la parte superior izquierda acota todo a un plantel/categoría.

**Leer un día.** Cada sesión aparece como una píldora de color que lleva su hora de inicio y duración. Las sesiones de entrenamiento y gimnasio también muestran una pequeña cifra **AU** en la vista del personal — la carga planificada de la sesión (ver Conceptos clave). Los recuadros de partido muestran el escudo del rival cuando se ha subido uno. Un día marcado como día de descanso colapsa sus sesiones y muestra una etiqueta **OFF** en su lugar.

**Trabajar con sesiones.**

1. **Haz clic** en una sesión para abrir su popover — hora, ubicación, duración, RPE planificado, notas y audiencia. Desde ahí, **Edítala** o **Elimínala**, o salta directamente a **Planificación Diaria** (entrenamiento), **Planificador de Gimnasio** (gimnasio) o **Alineación** (partido).
2. **Arrastra** una sesión a otro día para moverla (esto actualiza su fecha). Dentro de un día, las sesiones sin una hora de inicio fija pueden arrastrarse unas sobre otras para reordenarlas; las sesiones que tienen una hora de inicio se ordenan por esa hora.
3. Haz clic en el **+** en una columna de día para crear un nuevo evento en esa fecha. El formulario del evento cubre título, tipo, fecha, repetición opcional, duración, hora de inicio, notas, audiencia y — para partidos — rival, local/visitante, competición, estadio y escudo.

**Definir el ritmo MD-.** Cada día lleva una etiqueta MD- derivada de la fecha del partido del microciclo. Haz clic en una etiqueta para anularla manualmente — **Auto**, **MD**, **MD-1** a **MD-6**, **MD+1** a **MD+3**, o **OFF**. Las anulaciones manuales se marcan como tales para que puedas distinguirlas de las calculadas automáticamente.

**Crear un microciclo.** Usa **Nuevo microciclo** para abrir un bloque con un nombre, fecha de inicio y fecha de fin. El nuevo bloque puebla la cinta y vuelve a renderizar la cuadrícula.

**Importar partidos.** **Importar partidos** abre un diálogo con dos pestañas — pegar texto (un partido por línea) o subir un CSV — analizado en fecha, rival, local/visitante y competición. Una vista previa señala conflictos antes de confirmar, y una opción de "sobrescribir conflictos" te permite reemplazar entradas existentes. Los partidos confirmados se crean como eventos de partido.

**Publicar a los jugadores.** Los eventos llevan una **audiencia**: el Personal siempre ve todo; adicionalmente puedes compartir un evento con Jugadores, Médico o Directiva. Un enlace público para compartir permite a los jugadores abrir un calendario de solo lectura únicamente de los eventos compartidos con ellos — sin necesidad de iniciar sesión. El panel de la derecha muestra el estado de publicación actual (Publicado / Borrador) y permite generar o revocar ese enlace.

## Conceptos clave

**Microciclo.** Un bloque de entrenamiento — normalmente una semana — delimitado por una fecha de inicio y fin y construido en torno a un partido objetivo. En la vista Mes un microciclo se muestra como una banda tintada; el encabezado resume dónde estás (por ejemplo, "Microciclo 14 · MD-2").

**Día de partido menos (MD-) / morfociclo.** Los días de la semana se etiquetan en relación con el partido: **MD** es el partido, **MD-1 … MD-6** cuentan hacia atrás desde él, y **MD+1 … MD+3** son los días de recuperación posteriores. Esta es la lógica del morfociclo usada para distribuir la carga de entrenamiento a lo largo de la semana — el trabajo de alta intensidad se coloca lejos del partido, disminuyendo a medida que se acerca MD. Las etiquetas se calculan automáticamente a partir de la fecha del partido pero pueden anularse por día.

**Tipos de sesión.** Más allá de entrenamiento, gimnasio, recuperación y partido, el Calendario maneja toda la semana: viajes, check-in/out de hotel, salida/llegada del autobús, reuniones, prensa, controles médicos, comidas, sesiones de video y evaluaciones. Cada uno tiene su propio icono y color para que la semana se lea de un vistazo.

**Carga planificada (AU).** Para las sesiones de entrenamiento y gimnasio, el Calendario muestra una carga planificada en unidades arbitrarias, calculada como **duración (min) × RPE planificado**. Las sesiones que aún carecen de un RPE se señalan para que la carga planificada de la semana se mantenga completa.

**Audiencia y publicación.** La audiencia de un evento decide quién lo ve — Personal, Jugadores, Médico o Directiva. Publicar genera el calendario de solo lectura para el jugador; la Vista de jugador te permite previsualizarlo antes de compartirlo.

## FAQ

**¿Cómo se definen las etiquetas MD-?** Automáticamente, a partir de la fecha del partido del microciclo. Haz clic en la etiqueta de cualquier día para anularla manualmente (Auto, MD, MD-1…MD-6, MD+1…MD+3, OFF); las anulaciones manuales se marcan para que puedas distinguirlas.

**¿Puedo mover una sesión a otro día?** Sí — arrástrala a la columna del día objetivo. Para reordenar sesiones dentro del mismo día, arrastra las que no tienen una hora de inicio fija unas sobre otras; las sesiones con hora se ordenan por su hora de inicio.

**¿Cómo obtienen los jugadores el calendario?** Comparte eventos con la audiencia de Jugadores y publica el enlace público del microciclo. Los jugadores abren una vista de solo lectura de únicamente esos eventos; usa la **Vista de jugador** para previsualizarla primero.

**¿Dónde construyo realmente el contenido de la sesión?** El Calendario programa las sesiones; abre una y usa **Abrir en Planificación Diaria** (campo) o **Abrir en Planificador de Gimnasio** (gimnasio) para diseñar los ejercicios y bloques.

> TODO — confirmar antes de confiar en esto: las sesiones pueden llevar una lista de tareas de **Tareas** (aparece una sección de Tareas en el popover del evento), y la **exportación a PDF** produce una hoja imprimible de semana/mes. Ambas están presentes en la página pero su comportamiento exacto no se verificó del todo al escribir esto. También existe una cinta alternativa de línea de tiempo de temporada en la página pero parece estar oculta/aún no activa.

## Relacionado

- [Monitor de Carga](/support/load-monitor) — la carga que planificas aquí alimenta las ratios aguda:crónica de allí.
- [Análisis GPS](/support/gps-analysis) — compara lo que planificaste contra lo que los atletas realmente hicieron.
