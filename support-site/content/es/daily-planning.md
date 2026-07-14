---
title: Planificación Diaria
slug: daily-planning
world: planning
app_page: Daily Planning.html
order: 2
summary: El constructor de sesiones — diseña todo el contenido de un día de entrenamiento: fases, ejercicios, duraciones, intensidad, el plantel del día y la carga GPS proyectada.
---

## Qué es

Planificación Diaria es donde construyes el **contenido de una sola sesión de entrenamiento** para una fecha dada — sus fases y ejercicios, sus duraciones e intensidad, el plantel del día y las adaptaciones, y la carga planificada. El [Calendario](/support/calendar) programa *cuándo* ocurre una sesión; Planificación Diaria define *qué* es.

## Cuándo se usa

Aterrizas aquí desde el [Calendario](/support/calendar) abriendo una sesión de entrenamiento, luego diseñas el día: confirma la hora de la sesión, el contexto de [microciclo](glossary#microcycle) y [MD-](glossary#md-matchday-offset), define el plantel y cualquier adaptación de fisioterapia, añade los ejercicios de activación y de campo, y revisa los totales y la carga GPS proyectada antes de imprimir o publicar la hoja de sesión para el campo.

## Cómo funciona

**Confirmar el encabezado de la sesión.** La tarjeta superior contiene el nombre de la sesión, la fecha, la hora de inicio/fin, el microciclo, la **orientación** (introductoria, activación, tensión muscular, velocidad, duración, recuperación), el **enfoque** (táctico, individual, físico, sectorial), un **RPE esperado** (1–10), el desfase de **día de partido** (MD-5 … MD, … MD+2), y un campo de notas para el clima, la indumentaria y el contexto. Los campos heredados del Calendario se marcan como provenientes del calendario. La sesión se crea y se guarda automáticamente a medida que editas.

**Leer la barra de totales.** Cifras en vivo se actualizan a medida que construyes: minutos de **Activación**, minutos de **Trabajo de campo**, **Total**, **Duración de la sesión** y **AU planificados** — la carga planificada, calculada como RPE esperado × duración total (ver Conceptos clave).

**Definir el plantel del día.** La tarjeta de plantel agrupa a los jugadores por posición y te permite filtrar por estado con píldoras — **Todos, Disponible, Parcial, No disponible, Lesionado, Enfermo, Ausente** — cada una mostrando un recuento en vivo. Haz clic en un jugador para cambiar su estado para esa fecha (se guarda en disponibilidad). Los jugadores no disponibles, lesionados y enfermos se listan por separado con su motivo. **Imprimir Roster** abre una lista de jugadores imprimible.

**Revisar las adaptaciones de fisioterapia.** Una tarjeta muestra los jugadores que tienen una adaptación activa para hoy (traída de Fisioterapia) — la nota y las modalidades de tratamiento — para que la sesión respete los límites de rehabilitación y preventivos.

**Construir las dos fases.** Los ejercicios viven en dos cuadrículas:

- **Activación** — la fase de calentamiento / preparación.
- **Ejercicios de campo** — la fase principal.

En cada una, añade un ejercicio **desde la Biblioteca de Ejercicios** (ejercicios construidos en el planificador/Diseñador de Ejercicios, con su diagrama, dimensiones y jugadores) o añade una entrada **Manual** (nombre, duración, intensidad, notas). Cada tarjeta de ejercicio muestra su miniatura, etiquetas, duración y metadatos. Define la duración como un número plano de minutos o como una **estructura de intervalos** — series × tiempo de trabajo + descanso — que la tarjeta te totaliza. Añade notas por sesión, reordena o elimina ejercicios, y abre un ejercicio de la biblioteca en el Diseñador de Ejercicios.

**Revisar la carga GPS proyectada.** Una tarjeta colapsable proyecta la carga externa de la sesión a partir de los ejercicios que tienen un perfil GPS: para cada métrica multiplica el perfil por minuto del ejercicio por sus minutos de trabajo y suma a lo largo de la sesión. Puedes elegir qué métricas mostrar y definir un **objetivo** por métrica; la barra se lee gris (por debajo), verde (en objetivo ±10%) o ámbar (por encima). Una nota te indica cuántos ejercicios están cubiertos (los ejercicios sin perfil GPS no contribuyen).

**Imprimir o publicar.** Exporta la sesión como una hoja PDF de una página (membrete, metadatos, totales, plantel y los diagramas de ejercicios de activación y campo), o publícala para notificar al personal.

## Conceptos clave

**Sesión ↔ microciclo ↔ MD-.** Cada sesión de entrenamiento pertenece a un **microciclo** (la semana de entrenamiento construida en torno a un partido) y lleva un desfase de **día-de-partido-menos** — MD-5, MD-4, … MD-1, MD, MD+1, MD+2 — medido desde la fecha del partido del microciclo. Ese desfase es la lógica de planificación de la semana: señala el rol previsto del día (p. ej. MD-1 una activación, MD+1 una recuperación), lo que a su vez da forma a la orientación, el enfoque y la carga que defines aquí. Ver [Calendario](/support/calendar) para cómo se definen el microciclo y las etiquetas MD-.

**Fases (activación vs principal).** Una sesión se divide en una fase de **activación** y una fase **principal / de campo**. Ambas cuadrículas alimentan los totales de la sesión y la proyección GPS, pero mantenerlas separadas refleja cómo la sesión realmente se ejecuta e imprime.

**Carga planificada (AU).** La carga planificada en unidades arbitrarias es **RPE esperado × duración total de la sesión (minutos)** — una estimación subjetiva, basada en la intención, de cuán exigente debería ser la sesión. Es la contraparte del lado de la planificación de la carga [s-RPE](glossary#s-rpe) entregada reportada después de la sesión (ver [RPE](/support/rpe)) y de la carga GPS externa (ver [Análisis GPS](/support/gps-analysis)).

**Estructura de intervalos (series / trabajo / descanso).** La duración de un ejercicio puede ser un número plano de minutos o una estructura de intervalos — series × tiempo de trabajo, más descanso entre ellas. Los minutos de **trabajo** impulsan la proyección GPS (tiempo realmente dedicado a trabajar); los minutos **totales** (trabajo + descanso) impulsan los totales de tiempo de la sesión.

**Proyectado vs entregado.** La proyección GPS aquí es a lo que *planificas* exponer a los jugadores; el informe GPS real después del entrenamiento es lo que fue *entregado*. Comparar ambos es el bucle de retroalimentación que afina el próximo microciclo.

## FAQ

**¿De dónde vienen los ejercicios?** De la Biblioteca de Ejercicios (ejercicios diseñados en el planificador/Diseñador de Ejercicios, con diagramas y dimensiones) o de una entrada Manual que escribes. Los ejercicios de la biblioteca llevan sus metadatos y, cuando está disponible, un perfil GPS que alimenta la proyección.

**¿Por qué algunos ejercicios no afectan la carga GPS proyectada?** Solo los ejercicios que tienen un perfil GPS contribuyen. La nota de la proyección muestra cuántos de los ejercicios de la sesión están cubiertos; el resto necesitan un perfil antes de contar.

**¿Cómo se calcula la cifra de AU planificados?** RPE esperado (1–10) × duración total de la sesión en minutos. Define el RPE esperado en el encabezado de la sesión.

**¿Cómo defino el estado de un jugador para el día?** Haz clic en el jugador en la tarjeta de plantel y elige un estado; se guarda en disponibilidad para esa fecha y actualiza los recuentos del plantel.

> TODO — no se pudo confirmar desde el código, por favor verificar: (1) el botón **"Cargar plantilla"** en el encabezado de la sesión no tiene un manejador visible — no está claro si las plantillas de sesión son una función operativa. (2) La acción **"✓ Aplicado"** en una adaptación de fisioterapia solo atenúa la tarjeta en la UI sin persistencia encontrada — no está claro si registra algo o es solo un acuse visual.

## Relacionado

- [Calendario](/support/calendar) — programa la sesión y define su microciclo y etiqueta MD-.
- [RPE](/support/rpe) — la carga s-RPE entregada, frente a los AU planificados que defines aquí.
- [Análisis GPS](/support/gps-analysis) — carga externa planificada versus entregada.
- [Disponibilidad](/support/availability) — los estados de jugador mostrados en la tarjeta de plantel.
