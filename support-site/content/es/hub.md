---
title: Hub del Cuerpo Técnico
slug: hub
world: overview
app_page: Hub.html
order: 1
summary: La pantalla de inicio de la app — una vista diaria de los KPIs del plantel, tarjetas de acceso rápido a los módulos, un feed de actividad reciente y tus tareas.
---

## Qué es

El Hub del Cuerpo Técnico es la pantalla de inicio de la app: una vista diaria que te recibe con el contexto de hoy, los KPIs destacados del plantel, tarjetas de acceso rápido a cada módulo, un feed de actividad reciente, y tus tareas.

## Cuándo lo usas

Todos los días, lo primero —es la página de aterrizaje tras iniciar sesión. Úsalo para leer el plantel de un vistazo (disponibilidad, carga, bienestar, lesiones), saltar a cualquier módulo, y ver qué ha ocurrido recientemente y qué tienes asignado.

## Cómo funciona

**El saludo.** Un encabezado nombra el contexto de hoy —el microciclo actual y el día de partido, la sesión de hoy (hora y lugar), y píldoras de disponibilidad (disponible / parcial / fuera).

**Tarjetas de KPI.** Cuatro tarjetas destacadas se muestran por defecto —**Tamaño del plantel, ACWR promedio, Bienestar promedio, Lesiones activas**— cada una con una sparkline de tendencia. Puedes **personalizar** qué KPIs se muestran (hasta cuatro) de un conjunto más amplio que incluye Clima, Próximo partido, Carga esta semana, Bienestar hoy, Disponibles hoy, Sesiones esta semana y Vuelta al juego; la elección se guarda en tu perfil.

**Tarjetas de módulo.** Una grilla de tarjetas enlaza a cada módulo (Planificador, Biblioteca de Ejercicios, Planificación Diaria, Microciclos, Disponibilidad, Plantel, Informes de Partido, Bienestar, RPE, Monitor de Carga, Análisis GPS, Lesiones, Nutrición, Sala de Video), cada una con un estado en vivo en el pie (p. ej. "3 necesitan estado", "{n} enviados hoy", "sesiones pendientes").

**Actividad reciente y tareas.** Un feed lista la última actividad del club, y un panel de tareas muestra tus tareas abiertas (ver [Chat y Tareas](/support/chat-tasks)).

## Conceptos clave

**Qué agregan las tarjetas de KPI.** Cada tarjeta destacada es una consolidación del plantel a partir de los datos de su módulo: **Tamaño del plantel** cuenta los jugadores activos; **ACWR promedio** es la media de los ratios agudo:crónico de los jugadores (el modelo configurado por el club —ver [Monitor de Carga](/support/load-monitor)); **Bienestar promedio** promedia los check-ins de hoy (ver [Bienestar](/support/wellness)); **Lesiones activas** cuenta las lesiones abiertas (ver [Lesiones](/support/injuries)). Las tarjetas opcionales tiran de la misma manera —próximo partido del calendario, carga-esta-semana de la carga de RPE de sesión, conteos de disponibilidad de los registros de disponibilidad.

**El feed de actividad reciente.** El feed muestra los últimos eventos del club, cada uno con quién lo hizo y cuándo. Los tipos de evento incluyen: una **sesión publicada**, una **lesión registrada** o **resuelta**, una **adaptación de fisioterapia** requerida, **datos GPS importados**, un envío de **bienestar** o **RPE**, una **tarea creada** o **completada**, y un **miembro que se unió**. Una importación de GPS aparece como un elemento "Datos GPS importados de {session}" que referencia la sesión a la que pertenece.

**Qué significa "pendiente" aquí.** Dos pies de tarjeta de módulo dicen "pendiente", y significan cosas distintas —ninguno es una cifra de bienestar:

- El "sesiones pendientes" de la tarjeta de **GPS** cuenta las sesiones recientes que aún no tienen una importación de GPS.
- La tarjeta de **RPE** muestra cuántos RPE se **enviaron hoy** —es un conteo de *enviados*, no un conteo de quién todavía falta. (La idea de "sesiones esperando RPE" vive en las vistas de [RPE](/support/rpe) y de planificación, no en el Hub.)

Ver el TODO sobre cómo el brief planteó esto versus lo que la página realmente muestra.

## Preguntas frecuentes

**¿Puedo elegir qué KPIs se muestran?** Sí —personaliza la franja de KPIs (hasta cuatro), y la elección se mantiene en tu perfil. Reordenar/ocultar las tarjetas de módulo, sin embargo, no parece estar conectado aún (ver TODO).

**¿El feed de actividad muestra las importaciones de GPS una por sesión?** Registra una actividad "Datos GPS importados" que referencia una sesión; ver el TODO sobre si las importaciones masivas se agrupan.

**¿El número de RPE en el Hub son los jugadores que todavía deben un RPE?** No —es cuántos se enviaron hoy, no quién falta.

**¿De dónde viene el ACWR promedio?** Es la media del plantel de los ACWR de los jugadores usando el modelo configurado del club —el mismo motor que el [Monitor de Carga](/support/load-monitor).

> TODO — brief vs. código, por favor confirmar: (1) el brief describió la actividad de GPS como **agrupada**, pero el feed parece registrar un **evento gps.imported por importación** (con el título de la sesión anexado), no un elemento agregado de "N sesiones" —confirmar si una importación masiva se colapsa en una sola fila. (2) El brief se refirió a **"RPE pendiente"** en el Hub; la tarjeta de RPE en realidad muestra un conteo de **enviados-hoy** (la tarjeta de GPS es la que muestra "pendiente"). (3) El botón **"Personalizar"** de las tarjetas de módulo está presente pero no tiene un handler conectado —reordenar/ocultar módulos puede no estar implementado aún.

## Relacionado

- [Monitor de Carga](/support/load-monitor) — el ACWR detrás de la tarjeta de ACWR promedio.
- [Bienestar](/support/wellness) — los check-ins detrás de la tarjeta de bienestar.
- [Lesiones](/support/injuries) — el conteo de lesiones activas y los eventos del feed de lesiones.
- [Chat y Tareas](/support/chat-tasks) — las tareas que se muestran en el hub.
