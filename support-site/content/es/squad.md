---
title: Plantilla
slug: squad
world: squad
app_page: Squad.html
order: 1
summary: El centro del roster de un equipo o categoría — jugadores agrupados por posición, con perfiles, acciones masivas, importación/exportación CSV y un constructor de alineaciones.
---

## Qué es

Plantilla es el centro del roster de un equipo o categoría: cada jugador, agrupado por posición, con sus detalles clave, enlaces de perfil y las herramientas para añadir, editar, importar, organizar y construir alineaciones a partir de ellos.

## Cuándo lo usas

Úsalo para configurar y mantener el roster — añadir o importar jugadores, mantener las posiciones y los detalles actualizados, mover jugadores entre categorías — y para preparar un partido con el constructor de alineaciones. Desde aquí abres el perfil completo o el expediente de cualquier jugador.

## Cómo funciona

**Encuentra jugadores.** Busca por nombre, dorsal o nacionalidad; acota por posición con las pastillas — **Todos, GK, CB, FB, MF, WG, ST** (cada una con un recuento en vivo) — y delimita a una categoría con el selector de equipo. En la lista puedes ordenar por jugador, edad o fecha de incorporación.

**Cambia de vista.** Cuatro vistas presentan el mismo roster de forma distinta:

- **Lista** — una tabla ordenable: número, jugador (foto, nombre, fecha de nacimiento), posición, edad, pie, altura/peso, rol (equipo) y un menú de acciones. Las filas se agrupan por posición.
- **Tarjetas** — una cuadrícula de fotos con número de camiseta, nombre, posición, edad y pie.
- **Organigrama de posiciones** — jugadores apilados bajo su grupo de posición.
- **Alineación** — un campo con un selector de formación (4-3-3, 4-4-2, 4-2-3-1, 3-5-2 y más), un selector de partido y escudo rival, que puedes guardar, exportar e imprimir.

**Gestiona un jugador.** Añade un jugador con **Añadir jugador**, o abre el menú de un jugador para **Editar** (foto, nombre, dorsal, posiciones primaria y secundarias, fecha de nacimiento, nacionalidad, altura, peso, pie dominante, pertenencias a equipos), **Ver perfil** (abre la página del jugador) o **Exportar expediente** (abre el expediente imprimible).

**Trabaja en masa.** Selecciona jugadores con sus casillas para revelar las acciones masivas: **Archivar** (ocultar de forma reversible), **Exportar** (CSV de la selección), **Mover a equipo** — con dos modos, *Añadir al equipo* (mantiene las pertenencias existentes) o *Mover aquí* (las reemplaza) — y **Cambiar posición/estado** en toda la selección.

**Importar / exportar.** **Importar CSV** previsualiza las filas antes de crear los jugadores (columnas: nombre, apellido, número, posición, fecha de nacimiento, nacionalidad, altura, peso, pie dominante, con los alias de posición normalizados). **Exportar CSV** descarga el roster (o la selección actual).

## Conceptos clave

**Posiciones y grupos.** La app normaliza muchos códigos de posición (y alias en español como PORTERO, DEFENSA, EXTREMO, DELANTERO) en códigos canónicos y los agrupa para su visualización y filtrado:

| Grupo | Pastilla de filtro | Códigos de ejemplo |
| --- | --- | --- |
| Porteros | GK | GK |
| Defensas | CB / FB | CB, LB, RB, WB, LWB, RWB |
| Centrocampistas | MF | CDM, CM, CAM, DM, AM |
| Extremos | WG | LM, RM, LW, RW |
| Delanteros | ST | SS, CF, ST, "9" |

Un jugador tiene una posición **primaria** (usada para la agrupación y la insignia de color) y posiciones **secundarias** opcionales ("también juega de").

**Pertenencia a equipo / categoría.** Un jugador pertenece a un **equipo primario** (mostrado en la columna Rol) y puede tener pertenencias adicionales — de modo que un atleta puede aparecer, por ejemplo, tanto en el Sub-23 como en el primer equipo. Los modos de *Mover a equipo* deciden si un cambio añade una pertenencia o las reemplaza todas.

**Estado del jugador.** A nivel de plantilla un jugador lleva un estado — disponible, lesionado, modificado o no disponible. La aptitud para entrenar del día a día se gestiona en [Disponibilidad](/support/availability); el estado a nivel de plantilla es la marca a nivel de roster.

**Archivado.** Retirar un jugador lo archiva (borrado suave) en lugar de eliminarlo — desaparece de las vistas normales pero puede restaurarse desde el filtro de archivados.

## FAQ

**¿Cómo añado un roster entero de una vez?** Usa Importar CSV — previsualiza las filas analizadas (nombre, número, posición, fecha de nacimiento, nacionalidad, altura, peso, pie) antes de crear los jugadores, y normaliza los alias de posición.

**¿Puede un jugador estar en dos categorías?** Sí. Los jugadores admiten múltiples pertenencias a equipos con una marcada como primaria; usa *Mover a equipo → Añadir al equipo* para añadir una categoría sin quitar las demás.

**¿Cuál es la diferencia entre archivar y eliminar?** Archivar oculta al jugador pero es reversible; no hay eliminación definitiva en el flujo normal — los jugadores archivados pueden restaurarse.

**¿Dónde veo el historial completo de un jugador?** Abre **Ver perfil** para la página del jugador, o **Exportar expediente** para el resumen imprimible.

> TODO — no se pudo confirmar desde el código, por favor verificar: (1) la columna **Incorporación** está presente pero actualmente renderiza "—" para todos, así que puede que aún no esté conectada a una fecha. (2) El estado de jugador **"modificado"** aparece en el formulario pero está deshabilitado ahí — su significado exacto y cómo se establece no queda claro solo desde la página.

## Relacionado

- [Disponibilidad](/support/availability) — la aptitud para entrenar día a día de estos jugadores.
- [Monitor de carga](/support/load-monitor) — el ACWR de toda la plantilla construido a partir del mismo roster.
- [Calendario](/support/calendar) — los partidos que prepara el constructor de alineaciones.
