---
title: Alineación
slug: lineup
world: squad
app_page: Lineup.html
order: 4
summary: El constructor de alineaciones — elige una formación, ubica el XI titular y el banco para un partido, y produce un póster de alineación compartible.
---

## Qué es

El constructor de Alineación es donde compones el **XI titular, el banco y la formación** de un partido y lo conviertes en un gráfico compartible con estilo de póster.

## Cuándo lo usas

Antes de un partido —lo alcanzas desde el partido del [Calendario](/support/calendar) (o desde el [Plantel](/support/squad)), construyes la alineación para ese encuentro, y publicas o exportas el póster.

## Cómo funciona

**Elige una formación.** Elige entre las formaciones disponibles (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 3-4-3); cada una dispone las once posiciones en el campo.

**Rellena los espacios.** En el compositor, las pestañas cubren el **XI**, los **suplentes** y el **cuerpo técnico**. Haz clic en un espacio para abrir un selector de jugadores (busca por apellido, número o posición) y asigna un jugador; marca al capitán. Los jugadores ya ubicados no vuelven a ofrecerse. Las selecciones se guardan sobre la marcha.

**Estiliza el póster.** La previsualización en vivo del póster ofrece varios estilos visuales, selectores de color, un toggle de números/iniciales, un toggle de insignia de capitán, y un cambio de idioma. El encabezado muestra tu escudo versus el rival, los detalles del partido y una cuenta regresiva.

**Publica y exporta.** Desde Compartir puedes marcar la alineación como **oficial** ("Enviar a #match-day"), **descargar un PNG**, o **copiar un enlace** a ella. También puedes imprimirla.

## Conceptos clave

**Ligada al partido.** Una alineación pertenece a un partido específico en el calendario —**una alineación por partido**. Al abrir el constructor se encuentra el próximo partido y se carga (o crea) la alineación de ese partido, de modo que el XI que construyes queda ligado a ese encuentro. Los titulares y suplentes se almacenan con su espacio y su marca de capitán.

**Publicación.** Una alineación tiene un estado —borrador, luego **oficial** cuando la publicas (lo que sella quién la publicó y cuándo). La publicación se ofrece como "Enviar a #match-day", junto con una descarga en PNG y una copia de enlace. Exactamente cómo llega una alineación publicada a los jugadores (un canal de chat y/o un enlace visualizable) no se confirmó del todo desde el código —ver el TODO.

## Preguntas frecuentes

**¿Se guarda una alineación por partido?** Sí —una alineación por encuentro; el constructor carga la alineación de ese partido cuando lo abres.

**¿Cómo establezco al capitán?** Marca al jugador como capitán en el compositor; el póster muestra la insignia de capitán.

**¿Cómo comparto la alineación?** Publícala como oficial, descarga el PNG, o copia su enlace —desde el diálogo Compartir.

**¿Puedo exportarla como imagen?** Sí —Descargar PNG renderiza el póster a una imagen; también puedes imprimirla.

> TODO — no se pudo confirmar desde el código, por favor verificar: (1) si **"Enviar a #match-day"** realmente publica en un canal de chat y si el **enlace copiado** (`?lineup=…`) es visualizable por los **jugadores** —no se confirmó ninguna vista pública/de cara al jugador. (2) Cuándo se usa el estado **"bloqueado"** (versus borrador/oficial). (3) Los botones **Plantillas** y **Restablecer** están presentes pero sus handlers no se encontraron —confirmar que funcionan.

## Relacionado

- [Calendario](/support/calendar) — el partido para el que se construye una alineación.
- [Plantel](/support/squad) — los jugadores con los que se rellena la alineación.
- [Informes de Partido](/support/match-reports) — el registro posterior al partido del mismo encuentro.
