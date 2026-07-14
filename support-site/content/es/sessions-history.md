---
title: Historial de sesiones
slug: sessions-history
world: performance
app_page: Sessions History.html
order: 6
summary: El archivo de sesiones de entrenamiento pasadas — filtra, revisa y compara sesiones completadas, y muestra importaciones históricas rellenadas que llevan carga real y datos de GPS.
---

## Qué es

Historial de sesiones es el archivo de sesiones de entrenamiento pasadas: cada sesión completada, filtrable y comparable, con su carga, asistencia y contexto de día de partido — más las importaciones **históricas** rellenadas que llevan datos reales pero nunca se planificaron en la app.

## Cuándo lo usas

Para mirar atrás — auditar lo que realmente se hizo, revisar la progresión de carga a lo largo de un bloque, encontrar y copiar una sesión pasada, o comparar unas cuantas sesiones lado a lado. Es también donde muestras las sesiones históricas importadas que construyen la línea base de carga de un jugador.

## Cómo funciona

**Elige una vista.** El mismo conjunto filtrado de sesiones se renderiza de tres formas: **Lista** (una tabla paginada), **Cuadrícula** (tarjetas con fecha, foco, duración, carga y asistencia) y **Calendario** (una cuadrícula mensual, codificada por color según el foco).

**Filtra.** Un rango de fechas (7d / 30d / 90d / Temporada, por defecto los últimos 30 días), un selector de equipo, e interruptores para **orientación** (Introductoria, Activación, Tensión muscular, Velocidad, Duración, Recuperación), **foco** (Táctico, Individual, Físico, Sectorial), **banda de carga** (Baja 0–299, Moderada 300–599, Alta 600–899, Pico 900+ AU) y **posición MD** (MD-5 … MD … MD+2). Un cuadro de **búsqueda** coincide con el título y las notas, y una casilla **"Mostrar importaciones históricas de GPS"** revela las sesiones históricas (ocultas por defecto).

**Lee una fila.** La tabla muestra fecha, posición MD, título de sesión, foco, orientación, duración, **carga** (AU, con una barra) y asistencia. Las acciones de fila la **Abren** en [Planificación diaria](/support/daily-planning) o la **Copian** a una nueva sesión.

**Abre el detalle.** Al hacer clic en una sesión se despliega un panel con sus metadatos (fecha, MD, tipo/orientación, duración, carga y banda de carga, RPE estimado, asistencia), notas y sus ejercicios. Desde ahí puedes editar lo básico en línea, saltar a [Planificación diaria](/support/daily-planning) para una edición completa, o abrir una sesión de gimnasio en el [Planificador de gimnasio](/support/gym-planner).

**Trabaja entre sesiones.** **Nueva sesión** crea una para hoy, **Exportar CSV** descarga la lista filtrada, y **Comparar sesiones** pone dos o tres lado a lado (fecha, MD, tipo, duración, orientación, carga, entradas de RPE, notas).

## Conceptos clave

**Sesiones históricas (`is_historical`).** Una sesión histórica es una **rellenada o importada** en lugar de planificada en la app — por ejemplo, sesiones recuperadas de exportaciones de GPS o introducidas a posteriori. Llevan carga, asistencia y datos de GPS reales, pero no se programaron a través del planificador. Están **ocultas por defecto** aquí y excluidas de las vistas de planificación anticipada (Calendario, Planificación diaria); el interruptor "Mostrar importaciones históricas de GPS" las trae al archivo.

**Planificada vs histórica.** Una sesión **planificada** se crea en [Planificación diaria](/support/daily-planning) para la programación anticipada y puede no tener aún datos de carga. Una sesión **histórica** ya lleva sus datos entregados. El archivo contiene ambas; la planificación muestra solo las planificadas.

**Por qué importa el archivo.** El lado crónico del [ACWR](glossary#acwr) necesita semanas de historial de carga. Las importaciones históricas te permiten rellenar ese historial, de modo que el [Monitor de carga](/support/load-monitor) pueda calcular un ratio aguda:crónica significativo desde el primer día y puedas analizar la carga retrospectivamente — sin que esas sesiones rellenadas atesten el calendario de planificación.

**Carga (AU).** La carga de cada sesión en unidades arbitrarias se deriva de RPE × duración (por jugador donde existe RPE de sesión, si no a partir del RPE estimado), que es sobre lo que se construyen las bandas de carga y el Monitor de carga.

**Posición MD.** Cada sesión se sitúa relativa al partido de su microciclo — MD es el partido, MD-n los días anteriores, MD+n los días posteriores — de modo que puedes filtrar el archivo por dónde se situaron las sesiones en la semana.

## FAQ

**¿Por qué no veo todas mis sesiones?** Por defecto el archivo muestra solo las sesiones planificadas en el rango de fechas seleccionado. Marca **Mostrar importaciones históricas de GPS** para incluir las rellenadas/importadas, y amplía el rango de fechas si es necesario.

**¿Qué hace que una sesión sea "histórica"?** Fue importada o rellenada (`is_historical`) en lugar de planificada en la app — lleva datos reales pero nunca pasó por el planificador, así que está oculta de las vistas de planificación.

**¿Cómo reutilizo una sesión pasada?** Usa **Copiar** en la fila para crear una nueva sesión a partir de ella, o ábrela y edítala en Planificación diaria.

**¿Puedo comparar sesiones?** Sí — **Comparar sesiones** muestra dos o tres lado a lado.

> TODO — no se pudo confirmar desde el código, por favor verificar: un KPI de **Cumplimiento** (carga planificada vs entregada) aparece en esta vista pero se renderiza como "—%", así que parece incompleto/sin conectar. Confirmar si está implementado.

## Relacionado

- [Planificación diaria](/support/daily-planning) — donde se construyen y editan las sesiones.
- [Calendario](/support/calendar) — la vista de planificación anticipada de las mismas sesiones.
- [Monitor de carga](/support/load-monitor) — el historial de carga del archivo alimenta la ventana crónica del ACWR.
- [Análisis GPS](/support/gps-analysis) — donde se analizan las sesiones de GPS importadas.
