---
title: Informes de partido
slug: match-reports
world: performance
app_page: Match Reports.html
order: 7
summary: El informe posterior al partido — resultado, formación y minutos por jugador, valoraciones, goles, tarjetas y GPS, vinculado al partido del calendario.
---

## Qué es

Informes de partido es el registro posterior al partido: el resultado y los detalles del encuentro más el rendimiento por jugador — minutos, valoración, goles y asistencias, tarjetas y datos de GPS — para un partido del calendario.

## Cuándo lo usas

Después de un partido, para registrar el resultado e introducir (o importar) las estadísticas de los jugadores, y más adelante para revisar los números por jugador de un partido y sus tendencias.

## Cómo funciona

**Elige el partido.** Un selector lista tus sesiones de **partido** (las más recientes primero). Al seleccionar una se carga su informe o se inicia uno nuevo.

**Introduce los detalles del partido.** El informe recoge el resultado (a favor/en contra), la competición, la sede, local/visitante, el rival, la formación, la posesión y las notas.

**Añade las estadísticas de los jugadores.** Por jugador registras minutos, valoración, goles, asistencias, tarjetas amarillas/rojas y posición — a mano o **importando** un archivo CSV/Excel (por ejemplo, una exportación de Wyscout o genérica), mapeando sus columnas y emparejando las filas con tus jugadores por nombre o número. Los datos de GPS (distancia, sprint, velocidad máxima) se muestran al lado a partir de los datos de GPS de la sesión. Las valoraciones se codifican por color según su banda.

## Conceptos clave

**Qué captura un informe de partido.** Dos capas: el **resultado del partido** (marcador, rival, competición, sede, local/visitante, formación, posesión, notas) y las **estadísticas por jugador** (minutos, valoración, goles, asistencias, tarjetas, posición), con las métricas de GPS superpuestas desde la sesión.

**Vínculo con el partido del calendario.** Un informe está vinculado a una **sesión de partido** del calendario — un informe por sesión de partido, indexado por esa sesión. Al seleccionar la sesión se rellena automáticamente su fecha. Ten en cuenta que el rival y la competición se introducen en el informe (no se extraen automáticamente del partido — ver el TODO).

**Minutos y valoraciones.** Los minutos y las valoraciones se introducen o importan en el informe. Las valoraciones se muestran en una escala de color (a grandes rasgos: verde para altas, neutro en el medio, rojo para bajas). Ver el TODO sobre si los minutos/valoraciones fluyen hacia la disponibilidad o el perfil de temporada del jugador.

## FAQ

**¿Cómo creo un informe para un partido?** Selecciona la sesión de partido; se crea un informe asociado a ella (uno por sesión de partido). Rellena el resultado y añade las estadísticas de los jugadores.

**¿Puedo importar estadísticas en lugar de escribirlas?** Sí — importa una exportación CSV/Excel, mapea las columnas y empareja las filas con los jugadores por nombre o número.

**¿De dónde vienen los datos de GPS del informe?** De los datos de GPS de la sesión, mostrados por jugador junto a las estadísticas del partido (el análisis completo está en [Análisis GPS](/support/gps-analysis)).

> TODO — no se pudo confirmar desde el código, por favor verificar: (1) si los **minutos** de un jugador alimentan los "minutos jugados" de la disponibilidad (match:N) o el perfil de temporada, y si las **valoraciones** persisten en el perfil — ninguna de las dos transferencias era visible aquí. (2) Cómo se usan los **informes independientes** (sin sesión vinculada). (3) No se encontró ninguna función de **compartir en el chat** un informe. (4) Un campo de GPS de **carga del jugador** seleccionado no se renderiza, y algunas vistas más ricas (mapa de tiros, mapa de calor, línea temporal) parecen ser futuras/ausentes.

## Relacionado

- [Calendario](/support/calendar) — donde se programa la sesión de partido a la que se asocia el informe.
- [Alineación](/support/lineup) — el once construido para el mismo partido.
- [Análisis GPS](/support/gps-analysis) — el desglose completo de GPS detrás de las métricas del informe.
- [Perfil del jugador](/support/player) — donde aparecen los minutos y la producción de un jugador.
