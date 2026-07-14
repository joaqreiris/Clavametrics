---
title: Fisioterapia
slug: physio
world: medical
app_page: Physio.html
order: 4
summary: El registro de tratamientos de fisioterapia — registra sesiones de rehabilitación y preventivas, y envía adaptaciones del entrenamiento al plan diario del cuerpo técnico.
---

## Qué es

La pantalla de Fisioterapia registra sesiones de fisioterapia — tratamientos de rehabilitación y preventivos — con sus modalidades, zonas corporales, dolor y estado del jugador, y permite al fisioterapeuta enviar una **adaptación del entrenamiento** al cuerpo técnico para la siguiente sesión.

## Cuándo lo usas

Después de trabajar con un jugador lesionado o en riesgo: registra la sesión y, cuando haya que modificar el entrenamiento, adjunta una adaptación para que llegue al plan diario. Es también donde revisas el historial de tratamientos de un jugador y le das el alta cuando sus lesiones se resuelven.

## Cómo funciona

**Registrar un tratamiento.** El formulario captura el jugador, la fecha/hora y la duración, y el **tipo de tratamiento** — **Rehabilitación** (vinculado a una de las lesiones activas del jugador) o **Preventivo** (con un motivo: petición del jugador, indicación del preparador físico, protocolo de prevención o mantenimiento/recuperación). Marcas las **zonas corporales** en un esquema, eliges **modalidades** (terapia manual, ejercicio, electroterapia, hidroterapia, masaje, vendaje, punción, otra), registras el **dolor** antes y después (0–10) y el **estado del jugador** (mejorando, estable, empeorando), y añades notas clínicas.

**Enviar una adaptación del entrenamiento.** Marca **Notificar a los entrenadores** y escribe la adaptación (por ejemplo, qué modificar en la siguiente sesión). Al guardar, esto notifica al cuerpo técnico y se publica en el chat del club, y la adaptación aparece en el plan de los entrenadores (ver Conceptos clave).

**Revisar y gestionar.** El panel de historial lista los tratamientos con filtros (todos / rehabilitación / preventivos / adaptaciones). Una vista de **Historial del paciente** muestra las sesiones de un jugador agrupadas por lesión con una tendencia de dolor, y una biblioteca de **Protocolos** te permite aplicar una plantilla en el formulario. Puedes editar, duplicar o eliminar un tratamiento, exportar la semana y **Dar de alta** a un jugador (lo que marca sus lesiones activas como dadas de alta).

## Conceptos clave

**Qué es una adaptación del entrenamiento.** Una adaptación es una instrucción del fisioterapeuta para modificar el siguiente entrenamiento de un jugador (por ejemplo, una restricción o una reducción de carga). Técnicamente es un tratamiento guardado con **Notificar a los entrenadores** activado y las notas de adaptación rellenadas: eso genera una notificación al cuerpo técnico y muestra la adaptación en la tarjeta de **adaptaciones de fisioterapia** en [Planificación diaria](/support/daily-planning) (y en el bloque de adaptaciones individuales del [Planificador de gimnasio](/support/gym-planner)), de modo que la sesión del día la respete. La app registra cuándo se **envió** la adaptación, pero ver la limitación más abajo sobre la acción "Aplicado" del entrenador.

**Rehabilitación vs preventivo.** Un tratamiento de rehabilitación se asocia a una lesión activa y sigue su recuperación; un tratamiento preventivo es reducción de riesgo sin vínculo a lesión. Ambos se registran de la misma forma.

**Quién puede verlo.** Los **tratamientos de fisioterapia se delimitan por equipo**, no se restringen a los roles médicos a nivel de base de datos — que es precisamente por lo que una adaptación puede llegar al plan de un entrenador (no médico). Esto es distinto del expediente clínico profundo (historial médico, medicaciones, documentos), que es solo para personal médico — ver [Historia clínica](/support/clinical-record). Ver el TODO sobre el control de acceso de la propia página.

## FAQ

**¿Cómo llega una adaptación al entrenador?** Guarda el tratamiento con **Notificar a los entrenadores** activado y las notas de adaptación rellenadas. El cuerpo técnico recibe una notificación y la adaptación aparece en la tarjeta de adaptaciones de fisioterapia de Planificación diaria.

**¿Cuál es la diferencia entre un tratamiento de rehabilitación y uno preventivo?** El de rehabilitación se vincula a una lesión activa y sigue su recuperación; el preventivo es reducción de riesgo sin lesión asociada y lleva un motivo en su lugar.

**¿Qué hace dar de alta a un jugador aquí?** Marca las lesiones activas del jugador como dadas de alta (con la fecha de retorno de hoy) y notifica al cuerpo técnico — el mismo concepto de alta que en la página de [Lesiones](/support/injuries).

> TODO — limitación conocida, confirmada en el código: cuando un entrenador hace clic en **"✓ Aplicado"** sobre una adaptación en Planificación diaria, ese estado **no se persiste** — no existe un campo "aplicado/confirmado" en el tratamiento (solo `adaptation_sent_at`, que registra cuándo se envió la notificación, no si se actuó sobre ella). Así que "Aplicado" es actualmente un descarte solo visual. Además — **TODO de control de acceso**: la página de Historia clínica redirige a los roles no médicos, pero no se confirmó que la página de Fisioterapia tenga una restricción equivalente solo para personal médico, y los registros de tratamiento (incluidas las notas clínicas) están delimitados por equipo a nivel de BD — confirmar si el personal no médico debería ver las notas de tratamiento de fisioterapia, no solo la adaptación.

## Relacionado

- [Planificación diaria](/support/daily-planning) — donde aparece una adaptación de fisioterapia para el entrenador.
- [Lesiones](/support/injuries) — las lesiones a las que se asocia un tratamiento de rehabilitación.
- [Rehabilitación y preventivos](/support/rehab) — los programas estructurados junto a los tratamientos.
- [Historia clínica](/support/clinical-record) — el expediente clínico restringido y más profundo.
