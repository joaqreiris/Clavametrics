---
title: RPE
slug: rpe
world: performance
app_page: RPE.html
order: 3
summary: El monitor de RPE de sesión — recoge el esfuerzo percibido de cada jugador tras una sesión, lo convierte en carga s-RPE (RPE × duración) y alimenta el ACWR.
---

## Qué es

La página de RPE es el monitor de RPE de sesión: recoge el **esfuerzo percibido** de cada jugador tras una sesión, calcula la carga de sesión (**[s-RPE](glossary#s-rpe) = RPE × duration**), y muestra quién ha respondido, quién falta y cuán dura le resultó la sesión a la plantilla.

## Cuándo lo usas

Justo después de una sesión. Los jugadores envían su RPE desde el móvil (sin necesidad de inicio de sesión) mientras está reciente; el cuerpo técnico observa las respuestas llegar, reclama las que aún faltan y revisa la carga interna de la plantilla. Esos valores de s-RPE son los que el [Monitor de carga](/support/load-monitor) convierte en [ACWR](glossary#acwr).

## Cómo funciona

**Elige la sesión.** Elige una sesión en el selector (por defecto la sesión de hoy cuando hay exactamente una). Si no hay sesión hoy lo indica; si hay varias, eliges cuál.

**Lee el resumen.** Cuatro cifras se sitúan arriba: **RPE enviados** (respondidos / plantilla), **s-RPE medio**, recuento de **RPE alto (≥8)** y envíos **tardíos / sin vincular**.

**Trabaja las dos pestañas.** **Respondidos** lista a los jugadores que enviaron, ordenados de mayor RPE primero; **Pendientes** lista a los que no lo han hecho, con una acción de **Recordar a los que faltan** con un toque por WhatsApp. Cada tarjeta de jugador puede mostrarse como una fila **Numérica** o un **Indicador** (un dial de 0–10 con zonas verde/ámbar/rojo), y muestra el valor de RPE, la carga de sesión (s-RPE, en au), la duración, este jugador frente a la media de la plantilla, cualquier zona dolorida reportada, un comentario y la hora de envío.

**Recoge de los jugadores.** Genera un **enlace de compartición con token** (elige el equipo, opcionalmente vincúlalo a una sesión), luego cópialo o envíalo por WhatsApp. Los jugadores lo abren, valoran la sesión y envían — sin necesidad de cuenta.

**Gestiona los envíos tardíos / sin vincular.** El RPE enviado sin sesión asociada aparece en un grupo **Tardío — necesita una sesión**; asigna cada uno a la sesión correcta para que su carga pueda calcularse, o usa **Vincular automáticamente** para asociar los envíos sueltos de hoy a las sesiones de hoy. La página también se actualiza por sí sola para que las nuevas respuestas aparezcan sin recargar.

## Conceptos clave

**RPE (esfuerzo percibido).** La valoración subjetiva de un jugador de cuán dura le resultó la sesión, en una escala **1–10** — la contraparte de carga interna a la carga externa de GPS. Se capta mejor poco después de la sesión, mientras la impresión está reciente.

**s-RPE (carga de sesión).** El número central: **s-RPE = RPE × duración de la sesión en minutos**, en unidades arbitrarias (au). Una sesión de 60 minutos valorada en 7 son 420 au. Combina *cuán dura* con *cuánto duró* en una sola cifra de carga interna por jugador y sesión.

**Bandas de intensidad.** El RPE se codifica por color: verde para una sesión ligera (≤ 4), ámbar para moderada (5–7) y rojo para dura (≥ 8). El recuento de **RPE alto (≥8)** destaca a los jugadores que encontraron la sesión más dura.

**Carga interna vs externa.** El RPE es carga *interna* — la percepción del atleta. El GPS (ver [Análisis GPS](/support/gps-analysis)) es carga *externa* — distancia, velocidad, aceleraciones. Leer ambas juntas da la imagen más completa; una puede ser alta mientras la otra no lo es.

**Cómo alimenta el ACWR.** El s-RPE de cada sesión es un valor diario de carga interna. El [Monitor de carga](/support/load-monitor) los suma en ventanas aguda y crónica y calcula el ratio aguda:crónica — así que una recogida de RPE completa y oportuna aquí es lo que hace que el ACWR sea significativo.

## FAQ

**¿Qué escala usan los jugadores?** 1–10. La carga es entonces RPE × la duración de la sesión en minutos.

**¿Cómo se calcula la carga de sesión?** s-RPE = RPE × duración (minutos), mostrado en unidades arbitrarias (au) en cada tarjeta de jugador.

**¿Cómo envían los jugadores sin una cuenta?** A través de un enlace de compartición con token que generas y envías (copiar o WhatsApp); valoran la sesión y envían — sin inicio de sesión.

**Un envío no cuenta para la carga — ¿por qué?** Probablemente esté sin vincular (sin sesión asociada). Asígnalo a una sesión desde el grupo "Tardío — necesita una sesión", o usa Vincular automáticamente.

**¿Por qué importa un RPE completo?** Porque el Monitor de carga construye el ACWR a partir de estos valores de s-RPE — las respuestas que faltan dejan huecos en el historial de carga de un jugador.

## Relacionado

- [Monitor de carga](/support/load-monitor) — convierte estos valores de s-RPE en ACWR.
- [Análisis GPS](/support/gps-analysis) — carga externa, junto a esta carga interna.
- [Planificación diaria](/support/daily-planning) — los AU planificados que fijas antes de la sesión, frente al s-RPE reportado después.
