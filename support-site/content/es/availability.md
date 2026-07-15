---
title: Disponibilidad
slug: availability
world: squad
app_page: Availability.html
order: 2
summary: Una matriz de jugadores por día de quién puede entrenar — disponible, parcial, lesionado, enfermo o ausente — que alimenta los recuentos de salud del plantel que lee el resto de la plataforma.
---

## Qué es

Disponibilidad es una **matriz de jugadores × días** que rastrea el estado de cada miembro del plantel — disponible, parcial, lesionado, enfermo o ausente — para cada día en un rango de fechas. Es el único lugar que responde "¿quién puede entrenar hoy?" y alimenta los recuentos de salud del plantel (p. ej. "22 disponibles, 3 parciales, 2 fuera") que se muestran en otras partes.

## Cuándo se usa

Actualízala como parte de la rutina diaria — antes de cada sesión o partido — para que la imagen del plantel esté al día: marca quién entrena completo, quién está en trabajo modificado, quién está fuera por lesión o enfermedad, y quién está ausente por convocatoria de selección nacional. Después de un partido puedes registrar los minutos jugados; a lo largo de la semana la vista de Estadísticas muestra las tendencias de disponibilidad.

## Cómo funciona

**Elegir una vista.** Un control segmentado alterna entre **Matriz** (la cuadrícula por defecto de jugadores × días) y **Estadísticas** (una línea de tendencia, un mapa de calor de calendario, un ranking de jugadores y un desglose por equipo).

**Definir la ventana de fechas.** El rango por defecto es el microciclo activo (o el lunes–domingo actual) y puede cambiarse con preajustes — MC actual, Últimos 7 / 14 / 30 días, o un rango personalizado — y avanzarse/retroceder paso a paso. Cada columna muestra su etiqueta **MD-** (p. ej. MD-2, Partido, Descanso); hoy se resalta, los días de partido se marcan en rojo, y los días de descanso planificados se rayan y son de solo lectura.

**Filtrar las filas.** Píldoras de posición — **Todos, GK, CB, FB, MF, WG, ST** — reducen la matriz a un grupo de posición, cada una mostrando su recuento.

**Editar estados.** Selecciona una o varias celdas — clic, arrastra para seleccionar un rango, o Cmd/Ctrl+A para seleccionar todas las celdas editables — y aparece una barra de edición en masa. Define la selección como **Disponible, Parcial, Lesión, Enfermedad** o **Selección nac.**, usa **Partido · 90′** para registrar un partido completo, o **Limpiar** para eliminar los registros. Las fechas futuras, los días de descanso y las fases que no cuentan están bloqueados. Los cambios se guardan de inmediato y se actualizan en vivo para todos mediante sincronización en tiempo real.

**Exportar.** La matriz puede exportarse a CSV.

## Conceptos clave

**El conjunto de estados.** Disponibilidad usa un conjunto fijo de estados, cada uno con su propio color:

| Estado | Etiqueta | Color | Significado |
| --- | --- | --- | --- |
| available | Disponible | verde | Totalmente disponible — capacidad completa de entrenamiento/partido. |
| partial / limited | Parcial / adaptado | ámbar | Disponible pero en trabajo modificado (intensidad reducida, algunos ejercicios o acciones restringidos). |
| injured / unavailable | Lesión | rojo | No puede participar debido a una lesión activa. |
| sick | Enfermedad | violeta | No disponible por enfermedad. |
| away | Selección nac. | azul | Ausente por convocatoria internacional / de selección nacional. |
| absent | Ausente | gris | Usado en registros de partido — presente pero con cero minutos jugados. |

Una celda de partido también puede llevar **minutos jugados** (p. ej. "90′"), almacenada como disponible con un valor de minutos.

**De dónde viene el estado.** La entrada manual del personal es la fuente de verdad, pero dos rellenos automáticos la siembran sin sobrescribir nunca una entrada manual:

- **Desde Lesiones** — los jugadores con una lesión activa se rellenan automáticamente como **lesionados** a lo largo del rango de fechas de la lesión (el módulo de Lesiones es donde se registran las lesiones).
- **Valor por defecto de hoy** — cualquier jugador sin registro para hoy pasa por defecto a **disponible** (o **lesionado** si tiene una lesión activa).

Así que la prioridad es: entrada manual primero, luego el relleno automático por lesión, luego el valor por defecto de hoy.

**Disponibilidad vs lesión vs carga.** La disponibilidad es una decisión *diaria de aptitud para entrenar*. Una **lesión** es la condición médica subyacente con un inicio y un retorno esperado — la disponibilidad es en efecto la proyección día a día de eso. La **carga** y el **bienestar** (ver [Monitor de Carga](/support/load-monitor) y RPE/Bienestar) son insumos de readiness que informan la decisión pero se rastrean por separado.

**Parcial / adaptado.** "Parcial" significa que el jugador entrena pero en un programa modificado — intensidad más ligera o restricciones específicas. Sigue contando dentro del plantel entrenable, por lo que el resumen del plantel distingue entre "disponible", "parcial" y "fuera".

**Días contabilizables.** Los KPI de salud del plantel solo aplican a los días contabilizables — un día con una sesión o partido planificado, no un día de descanso, y dentro de una fase de temporada activa. En un día que no cuenta, la franja de KPI se reemplaza por un estado vacío.

## FAQ

**¿Tengo que definir cada jugador cada día?** No. Los jugadores pasan por defecto a disponible para hoy, y las lesiones activas se rellenan automáticamente como lesionadas a lo largo de su rango. Principalmente anulas las excepciones — parcial, enfermo, ausente — y esas entradas manuales nunca son sobrescritas por los rellenos automáticos.

**¿Cuál es la diferencia entre "parcial" y "lesionado"?** Parcial significa disponible en entrenamiento modificado (cuenta dentro del plantel entrenable); lesionado significa fuera. Son ámbar y rojo respectivamente.

**¿Cómo obtienen sus números los recuentos "22 disponibles / 3 parciales / 2 fuera" de otras partes?** De estos estados en el día dado — disponible y parcial cuentan como entrenables; lesionado, enfermo y ausente cuentan como fuera.

**¿Pueden dos miembros del personal editar a la vez?** Sí — las actualizaciones se difunden en vivo, así que todos ven los cambios sin refrescar.

## Relacionado

- [Plantel](/support/squad) — el roster que puebla las filas de la matriz.
- [Calendario](/support/calendar) — los días de partido y días de descanso que se muestran en el encabezado.
- [Planificación Diaria](/support/daily-planning) — los mismos estados impulsan la tarjeta de plantel de la sesión.
