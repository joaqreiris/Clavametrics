---
title: Diseñador de Ejercicios
slug: drill-designer
world: planning
app_page: Planner.html
order: 5
summary: El editor de campo para construir un ejercicio — coloca jugadores y objetos, dibuja movimientos y zonas, define el formato y las etiquetas, y guárdalo en la Biblioteca de Ejercicios.
---

## Qué es

El Diseñador de Ejercicios es el editor de campo donde construyes un ejercicio de entrenamiento: dibuja la disposición en un campo de fútbol — jugadores, objetos, movimientos y zonas — define su formato, dimensiones y etiquetas, y guárdalo en la [Biblioteca de Ejercicios](/support/exercises-library) para reutilizarlo.

## Cuándo se usa

Cuando creas un nuevo ejercicio o editas uno existente. Llegas a él desde la Biblioteca de Ejercicios ("Nuevo ejercicio", o "Abrir en Planner" en un ejercicio) y, una vez guardado, el ejercicio queda disponible para añadirse a sesiones en [Planificación Diaria](/support/daily-planning).

## Cómo funciona

**Dibujar el ejercicio.** En el lienzo del campo colocas y organizas:

- **Jugadores** para hasta cuatro equipos (numerados automáticamente, cada equipo con su propio color), y **objetos** — balón, conos, picas, barreras, porterías, postes de portería, maniquíes, o tu propio objeto subido.
- **Movimientos** — flechas que pueden ser rectas o curvas, sólidas o discontinuas.
- **Zonas** — rectángulos, círculos, triángulos, rombos, polígonos y formas libres, con color de relleno y opacidad.
- **Etiquetas de texto** y **escudos** de equipo.

Las herramientas del lienzo incluyen seleccionar, mover/desplazar, dibujo a mano alzada, selección con lazo, deshacer/rehacer y zoom/ajustar; puedes elegir la variante de campo (completo, medio, en blanco) y rotar su orientación. Como alternativa al dibujo, puedes construir un ejercicio **basado en imagen** subiendo una imagen.

**Configurar el ejercicio.** Rellena el nombre (que auto-parsea un formato como "5v5+2" y el tamaño del campo), un objetivo y una descripción, la visibilidad por categoría, y los parámetros de entrenamiento: **series**, **tiempo de trabajo** y **tiempo de descanso** (que auto-calculan la **duración**), **día de partido**, **intensidad**, **enfoque**, **tipo de juego**, **orientación física**, **jugadores**, y **ancho × alto** del campo.

**Revisar el espacio y la orientación.** El editor muestra los **m² por jugador** y una insignia de **orientación** derivada de ello, con recuadros de referencia para los umbrales — para que veas de un vistazo si el formato cae en territorio de Activación, Fuerza, Velocidad o Resistencia.

**Ver el perfil GPS.** Si el ejercicio ha sido mapeado a datos GPS, un panel de solo lectura muestra su carga externa típica (por sesión y por minuto).

**Guardar y compartir.** Guardar escribe el ejercicio en la biblioteca (con una imagen de vista previa autogenerada); también puedes imprimir una hoja o compartir el ejercicio como un PNG.

## Conceptos clave

**Las dimensiones de etiquetado.** Un ejercicio se etiqueta a lo largo de cuatro dimensiones, más su ajuste de día de partido y su visibilidad:

| Dimensión | Valores |
| --- | --- |
| Orientación física | Activación, Fuerza, Velocidad, Resistencia |
| Intensidad | Baja, Media, Alta, Muy alta |
| Enfoque (multi-selección) | Táctico, Individual, Físico, Sectorial |
| Tipo de juego | Reducido (SSG), Medio (MSG), Amplio (LSG) |

Estas son las mismas etiquetas por las que luego filtras en la [Biblioteca de Ejercicios](/support/exercises-library).

**Formato de juego y densidad (m²/jugador).** El **formato** es el número de jugadores y la forma reducida/media/amplia; la **densidad** es el espacio por jugador — área del campo ÷ jugadores. La densidad determina la **orientación**: por debajo de 40 m²/jugador → **Activación**, 40–80 → **Fuerza**, 80–160 → **Velocidad**, 160 y más → **Resistencia**. Más espacio por jugador significa más carrera y velocidades más altas; menos espacio significa más contactos y trabajo técnico. Puedes dejar que la orientación siga a la densidad o definirla manualmente.

**Duración y tiempo de trabajo.** La duración se calcula a partir de **series × (trabajo + descanso)**. Por separado, la porción de **trabajo** (series × tiempo de trabajo) es el tiempo que los jugadores están realmente activos — y eso es lo que alimenta la carga GPS proyectada cuando el ejercicio se usa en [Planificación Diaria](/support/daily-planning).

**Ejercicios de lienzo vs de imagen.** Un ejercicio puede ser **basado en lienzo** (dibujado en el campo, totalmente editable) o **basado en imagen** (una imagen subida con las mismas etiquetas y parámetros) — útil para importar diagramas existentes.

## FAQ

**¿Tengo que dibujar todo a mano?** No — puedes subir un ejercicio basado en imagen y aun así etiquetarlo y definir sus parámetros. Los ejercicios de lienzo son los totalmente editables, dibujados como diagrama.

**¿Cómo se decide la orientación?** A partir de la densidad (m² por jugador): <40 Activación, 40–80 Fuerza, 80–160 Velocidad, ≥160 Resistencia. Puedes anularla manualmente.

**¿Cómo se calcula la duración?** Series × (tiempo de trabajo + tiempo de descanso). Es de solo lectura — define las series y los tiempos de trabajo/descanso y la sigue.

**¿A dónde va el ejercicio después de guardarlo?** A la [Biblioteca de Ejercicios](/support/exercises-library), desde donde puede reutilizarse en sesiones y mapearse a datos GPS.

> TODO — por favor tener en cuenta y confirmar: el brief esperaba una taxonomía de **8 dimensiones**, pero el Diseñador de Ejercicios implementa **4** dimensiones de etiquetado (Orientación, Intensidad, Enfoque, Tipo de juego) junto con los campos de día de partido y formato — no dimensiones de principio / sub-principio / concepto táctico. Documenté lo que el editor realmente tiene. Además, las funciones de **compartir al chat** y **subida de objeto personalizado** están presentes pero su comportamiento completo vive en módulos externos que no pude confirmar del todo aquí.

## Relacionado

- [Biblioteca de Ejercicios](/support/exercises-library) — donde los ejercicios guardados se catalogan y filtran.
- [Planificación Diaria](/support/daily-planning) — añade un ejercicio a una sesión; su tiempo de trabajo alimenta la proyección GPS.
