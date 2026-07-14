---
title: Evaluaciones
slug: evaluations
world: performance
app_page: Evaluations.html
order: 5
summary: El módulo de tests físicos — registra saltos, sprints, resistencia, fuerza y tests de plataforma de fuerza, compara contra el plantel y sigue la evolución de cada jugador.
---

## Qué es

Evaluaciones es el módulo de tests físicos y de rendimiento: registras tests medidos (saltos, sprints, resistencia, fuerza, métricas de plataforma de fuerza) y valoraciones subjetivas de campo (técnica, táctica, mental), comparas a los jugadores contra el plantel y sigues cómo evoluciona cada uno a lo largo del tiempo.

## Cuándo lo usas

Siempre que testeas: tras una sesión de saltos/sprint/resistencia, al importar exportaciones de plataforma de fuerza, al calcular un test guiado (30-15 IFT, VBT, perfil F-V, composición corporal), o al valorar jugadores en el campo. Luego revisas resultados —la tendencia de un jugador, o el ranking del plantel en una métrica— y los resultados alimentan el [Perfil del Jugador](/support/player) y los grupos de carga del [Gym Planner](/support/gym-planner).

## Cómo funciona

**Elige la rama.** Un segmento superior separa **Medidos** (tests objetivos con resultados numéricos) de **Valoración de campo** (valoraciones subjetivas en dimensiones técnica/táctica/mental, 1–10).

**Recorre el catálogo de tests.** Los tests medidos se agrupan en categorías —Saltos y potencia, Velocidad y agilidad, Resistencia / VO₂max, Fuerza / VBT, Movilidad y screening, y Antropometría— cada una con varios tests (CMJ, parciales de sprint, 30-15 IFT, Nordic de isquiotibiales, FMS, composición corporal, y más). Elige un test para abrir sus resultados.

**Ver resultados.** Para un test puedes ver la vista **Equipo** (los valores del plantel, ordenados y clasificados contra la media del equipo) o la vista **Individual** de un jugador —su último valor, su media personal, un gráfico de tendencia a lo largo de las fechas, y una tabla de resultados recientes con el delta respecto al test anterior (y la asimetría izquierda/derecha cuando el test es bilateral).

**Subir resultados.** Ingresa los datos a mano —un solo jugador, o una grilla **masiva** de todo el plantel para una fecha— o **importa un CSV** (una lista de jugador+valor para evaluaciones, o una exportación de dispositivo como un CSV de plataforma de fuerza para tests de fuerza). Algunos tests abren una **calculadora** que toma entradas guiadas y calcula el resultado por ti (p. ej. 30-15 IFT, carga–velocidad VBT, perfil F-V, FMS, composición corporal por pliegues, 1RM).

## Conceptos clave

**Evaluaciones vs tests de fuerza.** El módulo almacena dos formas distintas de datos:

- Una **evaluación** es un **valor único** por instancia de test —un jugador, un tipo de test, una fecha, un resultado (con su unidad y nota opcional). Salto horizontal 2,15 m, un parcial de sprint, una distancia de Yo-Yo.
- Un **test de fuerza** es **multimétrica** —una sesión de plataforma de fuerza que produce muchas métricas a la vez (altura de salto, potencia pico, RSI, asimetría izquierda/derecha, …), almacenada como un test padre con sus métricas hijas.

Así, un salto ingresado a mano es un valor de evaluación; el mismo salto capturado en una plataforma de fuerza es un test de fuerza que lleva todo un conjunto de métricas, incluida la simetría entre miembros.

**Percentiles y la cohorte del plantel.** El resultado de un jugador se compara contra la **cohorte del equipo** —los valores de los otros jugadores para ese mismo test/métrica— no contra una norma del club ni externa. Es clave que un percentil solo se muestra cuando la cohorte tiene **al menos cuatro pares** con un valor; por debajo de eso la página indica que no hay suficientes pares para comparar. Esto evita que un "percentil" se calcule sobre uno o dos puntos de datos, donde no tendría sentido. Dentro de la vista de equipo, cada resultado también se clasifica simplemente como en/por encima de la media, por debajo, o muy por debajo.

**Evolución a lo largo del tiempo.** Para cada test el módulo sigue el historial de un jugador: el último valor contra su **media personal**, el cambio porcentual, y un gráfico a lo largo de todas las fechas de test. Muestra el cambio reciente en lugar de una única instantánea —así lees un test como una trayectoria, no como un número aislado.

**Valoración de campo.** Aparte de los tests medidos, la rama de valoración de campo puntúa a los jugadores en dimensiones técnica, táctica y mental en una escala 1–10, promediadas en una imagen general —un complemento subjetivo de los números objetivos.

## Preguntas frecuentes

**¿Cuál es la diferencia entre una evaluación y un test de fuerza?** Una evaluación es un valor por test (un jugador, una fecha, un resultado). Un test de fuerza es una sesión de plataforma de fuerza que registra muchas métricas a la vez, incluida la asimetría izquierda/derecha.

**¿Por qué no veo un percentil para un jugador?** Porque menos de cuatro compañeros tienen un valor para ese test —por debajo de ese mínimo la comparación no se muestra, ya que un percentil sobre tan pocos pares no sería fiable.

**¿El percentil es contra otros clubes?** No —es contra la propia cohorte del equipo del jugador.

**¿Cómo ingreso datos?** Ingrésalos a mano (individual o grilla masiva del plantel), importa un CSV, o usa la calculadora integrada de un test para tests guiados (30-15 IFT, VBT, perfil F-V, FMS, composición corporal, 1RM).

**¿Dónde aparecen los resultados de los tests en otras partes?** En el [Perfil del Jugador](/support/player) (instantánea y evolución más recientes) y como base para los grupos de carga del [Gym Planner](/support/gym-planner).

> TODO — no se pudo confirmar desde el código, por favor verificar: (1) no hay un campo explícito de **récord personal** —solo se siguen el último valor y la media personal. (2) No se encontró en la UI la opción de **editar/eliminar** un resultado existente. (3) No está confirmado el formato/alcance exacto del botón **Exportar informe**. (4) No se confirmaron del todo desde esta página los umbrales de color exactos de **asimetría** ni el traspaso preciso al **grupo de carga del Gym Planner**.

## Relacionado

- [Perfil del Jugador](/support/player) — donde los tests de un jugador aparecen como instantánea y evolución.
- [Gym Planner](/support/gym-planner) — los grupos de carga se construyen a partir de los resultados de los tests de fuerza.
- [Plantel](/support/squad) — el roster y la cohorte de equipo que usan las comparaciones.
