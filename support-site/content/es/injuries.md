---
title: Lesiones
slug: injuries
world: medical
app_page: Injuries.html
order: 1
summary: El registro de lesiones — registra la lesión de un jugador, síguela a través de las fases de rehabilitación, y dale el alta de vuelta a la disponibilidad, con la carga de lesiones del plantel de un vistazo.
---

## Qué es

La pantalla de Lesiones registra y sigue las lesiones de los jugadores desde su aparición, a través de fases estructuradas de rehabilitación, hasta el alta de vuelta al juego —y muestra la carga de lesiones del plantel mediante KPIs y un mapa corporal.

## Cuándo lo usas

Cuando un jugador se lesiona (regístralo), a medida que su rehabilitación progresa (avanza las fases), y cuando está listo para volver (dale el alta). También es el lugar para leer el panorama de lesiones del plantel —quién está fuera, días perdidos, tiempo de vuelta, tasa de recidiva.

## Cómo funciona

**Cambia de pestaña.** Las lesiones se agrupan en **Activas** (fases tempranas), **En retorno** (fases posteriores, de vuelta al entrenamiento) y **Resueltas** (dadas de alta). Un selector de equipo acota la lista.

**Filtra y lee.** Filtra por **severidad** (leve / moderada / grave) y **región corporal**, ordena (por severidad, fecha o días lesionado), y busca por jugador, tipo de lesión o zona. Una franja de KPIs muestra los casos activos, los días perdidos este mes, el tiempo promedio de vuelta, y la tasa de recidiva; un **mapa corporal** del plantel marca las regiones lesionadas.

**Registra una lesión.** El formulario de registro captura los detalles de la lesión —el jugador, el tipo de lesión, la zona corporal, el lado, la severidad, la categoría (muscular, LCA, ligamentosa, tendinosa, ósea, otra) y la subclasificación, la fecha de inicio, un retorno esperado, el mecanismo, y notas. Al guardar se crea la lesión como **activa** y se construyen sus **fases de rehabilitación** para la categoría.

**Sigue las fases.** Cada lesión recorre una línea temporal de fases (las fases dependen de la categoría de la lesión). Abres una fase para registrar sus criterios y fechas reales, la marcas como completa para avanzar a la siguiente, o la reviertes con un motivo registrado.

**Alta.** Cuando el jugador vuelve, **Dar de alta** establece una fecha de retorno y notas opcionales: la lesión pasa a **dada de alta**, sus fases se marcan como hechas, la disponibilidad se devuelve a disponible desde esa fecha, y se notifica al cuerpo técnico.

## Conceptos clave

**Cómo se sigue una lesión.** Una lesión no es una sola marca —es un registro que se mueve a través de **fases de rehabilitación** según su categoría (por ejemplo, las lesiones musculares llevan un grado BAMIC; distintas categorías tienen estructuras de fases diferentes). La app sigue el estado y las fechas de cada fase; el contenido clínico de esas fases es para que lo aplique el cuerpo médico —esta documentación describe la herramienta, no el protocolo.

**Relación con la disponibilidad.** Las lesiones y la [Disponibilidad](/support/availability) se mantienen sincronizadas, y las entradas manuales de disponibilidad se preservan:

- Una lesión activa aparece en la matriz de Disponibilidad como **lesionado** a lo largo de su rango de fechas (la página de Disponibilidad completa esto a partir de las lesiones activas sin sobrescribir ningún estado que hayas establecido a mano).
- A medida que la rehabilitación avanza a las fases de vuelta al entrenamiento, el estado del jugador pasa a **parcial**.
- Al dar el alta, la disponibilidad se restablece a **disponible** desde la fecha de retorno en adelante —pero solo donde estaba **lesionado**, de modo que cualquier otro estado que hayas ingresado manualmente queda intacto.

**Qué significa "dada de alta".** Dar el alta a una lesión registra una fecha de retorno, cambia la lesión a **dada de alta**, cierra sus fases, y devuelve al jugador a la disponibilidad desde esa fecha —además notifica al cuerpo técnico que el jugador está disponible de nuevo. Es el paso de vuelta a la disponibilidad de la herramienta, no un juicio clínico de aptitud (eso es decisión del cuerpo médico).

**Quién puede verlo.** Los registros de lesiones están acotados **por jugador/equipo**: cualquier miembro del cuerpo técnico con acceso al equipo de ese jugador puede ver la lesión —incluidos su tipo, zona y notas— porque las lesiones gobiernan la disponibilidad y la planificación. Esto es distinto del expediente clínico profundo (historia médica, medicaciones, screenings, documentos…), que está restringido a los roles médicos —ver [Expediente Clínico](/support/clinical-record).

## Preguntas frecuentes

**¿Registrar una lesión bloquea automáticamente la disponibilidad del jugador?** La matriz de Disponibilidad completa una lesión activa como **lesionado** a lo largo de su rango sin sobrescribir tus entradas manuales; a medida que la lesión alcanza las fases de retorno el estado pasa a **parcial**, y el alta lo devuelve a **disponible**.

**¿Dar de alta una lesión sobrescribirá la disponibilidad que establecí a mano?** No —el alta solo cambia a disponible los días que estaban marcados como **lesionado**. Otros estados que ingresaste quedan como están.

**¿Puede un entrenador no médico ver los detalles de la lesión?** Sí —las lesiones son visibles para el cuerpo técnico con acceso al equipo del jugador (gobiernan la disponibilidad). El expediente clínico separado y más profundo es solo para médicos.

**¿Qué pasa con las fases de rehabilitación cuando doy el alta?** Se marcan todas como hechas, y la lesión pasa a la pestaña Resueltas.

> TODO — no se pudo confirmar desde el propio código de la página, por favor verificar: la página de Lesiones **no tiene un control de rol del lado del cliente** más allá del guard general del módulo; el acceso se aplica mediante la base de datos (la tabla de lesiones es legible por el cuerpo técnico acotado al equipo del jugador, no restringido a roles médicos). Confirmar que esto coincide con la política prevista para la visibilidad de notas/diagnóstico de lesiones.

## Relacionado

- [Disponibilidad](/support/availability) — donde una lesión aparece como lesionado/parcial/disponible.
- [Fisioterapia](/support/physio) — tratamientos y adaptaciones para un jugador lesionado.
- [Rehabilitación y Preventivos](/support/rehab) — los programas de rehabilitación junto a las fases.
- [Expediente Clínico](/support/clinical-record) — el expediente clínico restringido y más profundo.
