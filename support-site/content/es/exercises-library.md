---
title: Biblioteca de Ejercicios
slug: exercises-library
world: planning
app_page: Exercises Library.html
order: 4
summary: El catálogo de tareas de campo que el club ha diseñado — buscable y filtrable por orientación, intensidad, día de partido, tipo de juego y foco, y reutilizable en sesiones.
---

## Qué es

La Biblioteca de Ejercicios es el catálogo de tareas de campo que el club ha construido en el [Diseñador de Tareas](/support/drill-designer). Las recorres, buscas y filtras por sus etiquetas de entrenamiento, previsualizas su diagrama y demandas, y las reutilizas al planificar sesiones.

## Cuándo lo usas

Siempre que estás planificando entrenamiento: encuentra una tarea existente por su orientación, intensidad, ajuste al día de partido o foco, revisa sus dimensiones y demandas, luego ábrela en el Diseñador de Tareas o agrégala a una sesión en [Planificación Diaria](/support/daily-planning). También es donde los datos de "periodo" de GPS se mapean a las tareas para que cada tarea construya un perfil de rendimiento.

## Cómo funciona

**Buscar y filtrar.** Busca por nombre, usa las píldoras rápidas de orientación (Todas / Activación / Fuerza / Velocidad / Resistencia), y abre los filtros de la barra lateral —**Orientación, Intensidad, Día de partido, Tipo de juego, Foco,** y **Equipo**— que son multiselección y muestran un conteo por valor. **Ordenar** alterna entre Recientes → A→Z → Más largas.

**Recorrer.** Alterna entre **Grilla** y **Lista**. Cada tarjeta muestra el diagrama de la tarea, una insignia de foco (ACT/STR/VEL/END), su duración e insignia de día de partido, y una insignia "Importada" para las tareas provenientes de imagen.

**Previsualizar una tarea.** Haz clic en una tarjeta para abrir un panel de previsualización con el detalle completo —jugadores, ancho × alto del campo, m² por jugador, duración, día de partido, series y trabajo/descanso, intensidad, orientación, tipo de juego y etiquetas de foco— y **Abrir en Planificador** para ver o editar el diseño en el [Diseñador de Tareas](/support/drill-designer).

**Mapear GPS a tareas (admin).** Un asistente "Mapear tareas (GPS)" permite a un admin emparejar **nombres de periodo** de GPS (p. ej. de Catapult) con tareas de la biblioteca, de modo que el sistema agrega el perfil GPS de cada tarea —distancia promedio, distancia por minuto y player load por minuto— a partir de las sesiones donde se ejecutó.

## Conceptos clave

**La taxonomía.** Las tareas se etiquetan y filtran a lo largo de estas dimensiones:

| Dimensión | Valores |
| --- | --- |
| Orientación | Activación, Fuerza, Velocidad, Resistencia |
| Intensidad | Baja, Media, Alta, Muy alta |
| Día de partido | MD-5 … MD … MD+3 |
| Tipo de juego | Reducido (SSG), Mediano (MSG), Amplio (LSG), o ninguno |
| Foco | Táctico, Individual, Físico, Sectorial |
| Equipo | a qué categorías es visible la tarea |

**Orientación y densidad (m²/jugador).** La orientación de una tarea refleja el **espacio por jugador** —el área de campo dividida por el número de jugadores. Cuando no se establece explícitamente se deriva de esa densidad: menos de 40 m²/jugador → **Activación**, 40–80 → **Fuerza**, 80–160 → **Velocidad**, 160 y más → **Resistencia**. Más espacio por jugador generalmente significa más carrera y velocidades más altas; menos espacio significa más contactos y trabajo técnico/de activación. Esta es la misma lógica de densidad que usan el [Diseñador de Tareas](/support/drill-designer) y la proyección GPS en [Planificación Diaria](/support/daily-planning).

**Formato de juego.** El formato captura la forma del juego —el número de jugadores, la clasificación reducido/mediano/amplio, y las dimensiones del campo— que junto con la densidad definen cuán exigente es la tarea.

**Ajuste al día de partido.** La etiqueta de día de partido dice dónde en la semana encaja una tarea —más cerca del MD para trabajo más agudo y de menor volumen; más lejos para días de mayor volumen; MD+1/+2 para recuperación. Te permite armar una semana que respete el microciclo.

**Perfil GPS.** Una tarea no tiene números GPS propios hasta que se enlazan sus ejecuciones: una vez que un admin mapea los nombres de periodo GPS a una tarea, la app deriva la carga externa típica de esa tarea a partir de las sesiones reales —y ese perfil es lo que alimenta la carga GPS proyectada cuando la tarea se usa en Planificación Diaria.

## Preguntas frecuentes

**¿De dónde vienen las tareas?** Se diseñan en el [Diseñador de Tareas](/support/drill-designer); esta biblioteca es el catálogo de lo que se ha construido, a nivel de club, con visibilidad por equipo.

**¿Por qué la orientación de una tarea parece automática?** Si no se establece explícitamente, se calcula a partir de la densidad (m² por jugador): <40 Activación, 40–80 Fuerza, 80–160 Velocidad, ≥160 Resistencia.

**¿Cómo obtienen números GPS las tareas?** Un admin mapea los nombres de periodo GPS a la tarea en el asistente "Mapear tareas (GPS)"; la app luego agrega el perfil de esa tarea a partir de las sesiones donde se ejecutó.

**¿Puedo restringir una tarea a una sola categoría?** Sí —la dimensión Equipo controla a qué categorías es visible una tarea; dejarla vacía la muestra a todas.

## Relacionado

- [Diseñador de Tareas](/support/drill-designer) — donde estas tareas se diseñan y editan.
- [Planificación Diaria](/support/daily-planning) — agrega tareas de la biblioteca a una sesión; su perfil GPS alimenta la proyección.
