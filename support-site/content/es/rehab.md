---
title: Rehabilitación y preventivos
slug: rehab
world: medical
app_page: Rehab & Preventives.html
order: 5
summary: El centro de planes de rehabilitación y programas preventivos — sigue la fase de cada jugador, los responsables, la estimación de retorno al juego y la sesión de hoy.
---

## Qué es

Rehabilitación y preventivos es el centro de seguimiento de **planes de rehabilitación** (programas de retorno al juego tras lesión) y **programas preventivos** (reducción del riesgo de lesión), que muestra la fase de cada plan, los responsables, la estimación de retorno al juego y la sesión de hoy a lo largo de la plantilla.

## Cuándo lo usas

Para supervisar quién está en rehabilitación y quién en un programa preventivo — monitorizar el progreso, detectar quién está cerca del retorno o bloqueado, y abrir un plan para editar sus fases, sesiones y criterios de progresión. Aquí creas los planes (a partir de una lesión, una evaluación, una alerta de GPS o desde cero) y los gestionas hasta el alta.

## Cómo funciona

**Lee las dos secciones.** **Rehabilitación y retorno al juego** lista los planes vinculados a una lesión (atleta, plan, diagnóstico y fase, estimación de RTP, responsables, sesión de hoy, estado); **Preventivo** lista los programas de reducción de riesgo (con una métrica de riesgo y semana del programa en lugar de un diagnóstico y RTP). Los filtros — Todos, Rehabilitación, Preventivo, Cerca de RTP (≤7 días), Bloqueado — se aplican a ambos. Una franja de KPIs muestra el número de jugadores en rehabilitación, cerca de RTP, bloqueados hoy y dados de alta este mes.

**Crea un plan.** **Nuevo plan** → elige Rehabilitación o Preventivo → se abre el Planificador de rehabilitación: asigna un jugador, vincula una lesión (rehabilitación), fija la fase, elige ejercicios de la biblioteca, fija fechas y estado, y asigna responsables (fisioterapeuta, preparador físico, entrenador).

**Constrúyelo y sígelo.** Dentro de un plan dispones las sesiones día a día a partir de bloques (calentamiento, movilidad, activación, fuerza, pliometría, en campo, acondicionamiento, valoración, …), cada uno con su duración, ejercicios y carga. Las fases de rehabilitación llevan **criterios de progresión** — las puertas que hay que superar antes de avanzar. El estado se mueve entre **en curso → cerca de RTP → alta**, o **bloqueado**.

**Gestiona.** Cambia el estado, vincula una lesión, asigna responsables, exporta a CSV y consulta el **historial** de planes dados de alta y archivados.

## Conceptos clave

**Fases, puertas y estado.** Un plan de rehabilitación se basa en fases: cada fase tiene criterios (puertas) que cumplir antes de avanzar, y el plan lleva un estado (en curso, cerca de RTP, bloqueado, alta, archivado). El contenido clínico de esas fases y puertas lo define el cuerpo médico/de rendimiento — esta documentación describe la herramienta de seguimiento, no los criterios a aplicar.

**Relación con el plan individual.** Los planes de rehabilitación y preventivos y el plan de entrenamiento individual del jugador **comparten la misma biblioteca de ejercicios y sistema de bloques**, pero se gestionan como **planes separados** — la app no copia automáticamente un plan de rehabilitación en un plan individual (no se encontró vínculo automático en el código). En la práctica, el cuerpo técnico los mantiene en paralelo; existe un enfoque de retorno al juego en el lado del plan individual, pero los dos no se sincronizan automáticamente.

**Retorno a la disponibilidad — qué hace y qué no hace.** Completar un plan de rehabilitación es **solo seguimiento**: marcar un plan como **alta** lo retira de las listas activas y lo archiva en el historial. **No** cambia por sí mismo el estado de la lesión vinculada ni la disponibilidad del jugador. Devolver al jugador a la disponibilidad se hace en la página de [Lesiones](/support/injuries) (alta médica) y se refleja en [Disponibilidad](/support/availability) — el plan de rehabilitación y esos pasos son independientes. (Ver el TODO.)

**De dónde vienen los planes.** Un plan puede crearse a partir de una lesión activa, de un hallazgo de evaluación, de una alerta de carga/asimetría de GPS, o manualmente — la fuente se registra en el plan.

## FAQ

**¿Dar de alta un plan de rehabilitación deja al jugador disponible de nuevo?** No — solo archiva el plan. Dar de alta la **lesión** (en la página de Lesiones) es lo que devuelve la disponibilidad; el plan de rehabilitación se sigue por separado.

**¿Es un plan de rehabilitación lo mismo que el plan individual del jugador?** No. Comparten la biblioteca de ejercicios y el constructor de bloques pero son planes separados sin vínculo de datos automático — gestionas cada uno por su cuenta.

**¿Quién es responsable de un plan?** Cada plan tiene uno o más responsables con un rol — fisioterapeuta, preparador físico o entrenador.

**¿Cómo inicio un plan a partir de una lesión?** Crea un plan de tipo Rehabilitación y vincula la lesión activa; a partir de ahí construyes sus fases y sesiones.

> TODO — por favor confirmar (comportamiento y acceso): (1) dar de alta un plan de rehabilitación **no** se propaga a la lesión ni al estado de disponibilidad — eso es un paso manual en las páginas de Lesiones/Disponibilidad; confirmar que es intencionado. (2) **No hay vínculo automático** entre un plan de rehabilitación y el plan de entrenamiento individual (solo biblioteca compartida) — confirmar si se espera un autorrelleno. (3) El acceso es a través del guard general del módulo + alcance por equipo + RLS del club; a diferencia de la Historia clínica, **no se confirmó una restricción explícita solo para personal médico** en esta página, y los planes de rehabilitación están delimitados por equipo (no restringidos a roles médicos) — confirmar la visibilidad prevista.

## Relacionado

- [Lesiones](/support/injuries) — la lesión en torno a la que se construye un plan de rehabilitación, y donde ocurren el alta/disponibilidad.
- [Fisioterapia](/support/physio) — tratamientos registrados junto a un programa de rehabilitación.
- [Disponibilidad](/support/availability) — donde se refleja el retorno del jugador al entrenamiento.
- [Perfil del jugador](/support/player) — el resumen de lesiones/disponibilidad del jugador.
