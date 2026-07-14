---
title: Bienestar
slug: wellness
world: performance
app_page: Wellness.html
order: 4
summary: El monitor del check-in matinal de bienestar — sueño, fatiga, estrés y molestias en una escala Hooper 1–7, más alertas de dolor, leído junto a la carga de entrenamiento.
---

## Qué es

La página de Bienestar recoge y revisa los check-ins subjetivos diarios de los jugadores — sueño, fatiga, estrés y molestias (los ítems Hooper) más el ánimo y cualquier zona dolorida — y señala quién está en riesgo antes del entrenamiento.

## Cuándo lo usas

Por la mañana, antes del entrenamiento: los jugadores envían su check-in, y el cuerpo técnico lee la plantilla para detectar quién durmió mal, quién arrastra fatiga o molestias, y quién reportó dolor — y luego ajusta la sesión en consecuencia. Se lee junto con la carga del día, nunca por sí solo.

## Cómo funciona

**Elige la plantilla.** Un selector de equipo delimita los check-ins a una categoría (o a todo el club para los administradores). La página se autoactualiza para que los envíos aparezcan a medida que llegan.

**Trabaja las dos pestañas.** **Respondidos** muestra a los jugadores que enviaron, ordenados de peor primero por Índice Hooper; **Pendientes** muestra quién sigue faltando, con una acción de **Recordar a los que faltan** por WhatsApp. Cada jugador se renderiza como una tarjeta **Numérica** (la puntuación más cada ítem) o un **Indicador** (un dial de bueno a en riesgo).

**Lee el resumen.** Las cifras superiores muestran cuántos jugadores están señalados, cuántos reportaron dolor (una zona dolorida) y cuántos siguen faltando.

**Recoge de los jugadores.** Genera un **enlace de compartición con token** (delimitado por equipo, sin inicio de sesión) que los jugadores abren para enviar; o **Recordar a los que faltan** para avisar a los pendientes. También puedes escribir a un jugador directamente.

## Conceptos clave

**Los ítems y la escala.** Los jugadores valoran cuatro ítems Hooper y el ánimo, cada uno en una escala **1–7**:

| Ítem | 1 significa | 7 significa |
| --- | --- | --- |
| Calidad del sueño | muy buena | muy mala |
| Fatiga | ninguna | extrema |
| Estrés | muy bajo | muy alto |
| Molestias | ninguna | severa |
| Ánimo (registrado por separado) | bajo | excelente |

Para los cuatro ítems Hooper, **más alto es peor**. El ánimo se muestra pero no se suma al Índice Hooper.

**El Índice Hooper.** La puntuación global es la suma de los cuatro ítems Hooper — **sueño + fatiga + estrés + molestias** — con un rango de **4 a 28**, donde **más alto significa más en riesgo**. La tarjeta se colorea por banda: **por debajo de 12 verde** (Bueno), **12–17 ámbar** (Vigilar), **18 y superior rojo** (Alerta). Cada ítem también muestra su propia mini-banda (1–3 ok, 4 vigilar, 5–7 malo). Los check-ins más antiguos que preceden a la escala Hooper recurren a un valor de readiness 1–10 (ahí, más alto es mejor).

**Alertas de dolor.** Un check-in puede señalar zonas corporales doloridas (isquiotibiales, cuádriceps, gemelos, aductores, rodilla, tobillo, hombro, espalda) más una nota libre. Reportar una zona genera una alerta al cuerpo médico/técnico — separada del Índice Hooper (el dolor no se suma a él).

**Por qué se lee con la carga, nunca solo.** El bienestar subjetivo es una entrada de alerta temprana, no un veredicto. Un Índice Hooper alto por sí solo significa poco; un Índice Hooper alto **sobre una carga de entrenamiento alta** es la combinación que señala un riesgo elevado. Por eso se lee junto al [s-RPE](glossary#s-rpe) del día (ver [RPE](/support/rpe)) y al ratio aguda:crónica (ver [Monitor de carga](/support/load-monitor)) en lugar de de forma aislada.

## FAQ

**¿Qué escala usan los jugadores?** 1–7 para cada ítem. Para los cuatro ítems Hooper, 1 es bueno y 7 es malo; el ánimo es 1 (bajo) a 7 (excelente) y se registra por separado.

**¿Cómo se calcula la puntuación global?** Índice Hooper = sueño + fatiga + estrés + molestias (rango 4–28). Más alto es peor — por debajo de 12 es verde, 12–17 ámbar, 18+ rojo.

**¿Cómo envían los jugadores?** A través de un enlace con token que compartes (sin inicio de sesión). El cuerpo técnico revisa los resultados aquí; una zona dolorida reportada alerta al personal médico.

**¿Una mala puntuación de bienestar significa retirar al jugador?** No por sí sola — léela junto a la carga del jugador y el cuadro médico. Es una señal para mirar más de cerca, no una instrucción.

> TODO — no se pudo confirmar desde el código, por favor verificar: (1) no hay una vía visible para que el **cuerpo técnico envíe en nombre de un jugador** (el envío es del lado del jugador vía el enlace). (2) Una vista de **historial de 7 días** aparece como "próximamente". (3) No se encontró ninguna **exportación** en esta página. (4) Una acción de **confirmar** para las alertas de bienestar existe en el backend pero no parece estar conectada a la interfaz de esta página.

## Relacionado

- [Monitor de carga](/support/load-monitor) — lee el bienestar junto a la carga aguda:crónica.
- [RPE](/support/rpe) — la mitad de carga interna del cuadro, el mismo día.
- [Disponibilidad](/support/availability) — donde se establece el estado de un jugador dolorido/enfermo.
