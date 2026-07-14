---
title: Administración
slug: admin
world: admin
app_page: Admin.html
order: 1
summary: El centro de control del club — miembros, roles y permisos por sección, integraciones GPS (pull de Catapult / push de StatSports), notificaciones, suscripción y registro de auditoría.
---

## Qué es

Administración es el centro de control del club: gestiona los miembros del cuerpo técnico y sus roles, otorga acceso por sección, conecta proveedores de GPS, enruta notificaciones y muestra la suscripción y el registro de auditoría. Solo los **propietarios y administradores** del club pueden abrirlo; el resto es redirigido al hub.

## Cuándo se usa

En la configuración inicial y cada vez que el club cambia: invitar o quitar personal, cambiar el rol de un miembro, otorgar o revocar acceso a módulos, asignar miembros a equipos y conectar o remapear una integración de GPS.

## Cómo funciona

**Moverse entre secciones.** Las pestañas cubren **Miembros**, **Roles**, **Secciones**, **Suscripción**, **Notificaciones**, **Integraciones**, **Seguridad y SSO** y **Registro de auditoría**. (Secciones y Seguridad y SSO están marcadas como próximamente.)

**Gestionar miembros.** La tabla de Miembros lista al personal con su rol, secciones otorgadas, última actividad y estado. Desde la fila de un miembro puedes **cambiar su rol**, **editar sus secciones** (otorgar/revocar módulos), asignarlo a **equipos** o copiar su correo. **Invita** a un nuevo miembro por correo con un rol (y equipos opcionales); recibe una invitación y, al aceptarla, se le aplican los permisos por defecto de su rol.

**Definir roles y plantillas.** En Roles editas el **conjunto de módulos por defecto** de cada rol (su plantilla) y puedes aplicar en masa una plantilla a todos los que tengan ese rol.

**Conectar GPS.** En Integraciones conectas **Catapult** o **StatSports** (ver Conceptos clave), mapeas sus atletas a tus jugadores y sus parámetros a tus métricas, y verificas/sincronizas.

**Enrutar notificaciones, revisar facturación, auditar.** Notificaciones enruta alertas (p. ej. una molestia reportada) por rol y alcance; Suscripción muestra el plan y enlaza a la facturación; el Registro de auditoría lista las acciones recientes del club.

## Conceptos clave

**Roles.** El rol de un miembro es uno de: **propietario, administrador, entrenador** (y variantes de entrenador — asistente, GK), **preparador físico (S&C), preparador físico, analista, fisioterapeuta** (jefe médico), **nutricionista, personal**, además de **jugador**. El propietario y el administrador tienen acceso total y sin restricciones a cada módulo.

**El modelo de permisos de dos niveles.** El acceso a cada sección de la app se controla en dos capas:

1. **Plantillas de rol** — cada rol tiene un conjunto de módulos por defecto para el club (su plantilla). Cuando alguien se une con un rol, esa plantilla se aplica automáticamente.
2. **Concesiones por miembro** — un administrador puede anular el acceso de un miembro individual, otorgando o revocando módulos específicos.

Los módulos otorgados a un miembro se almacenan como filas indexadas por módulo. Un marcador especial **`__managed__`** significa que el miembro está en modo *restringido*: solo ve los módulos explícitamente otorgados. Si un miembro **no** tiene ninguna fila de módulo, obtiene **acceso total** (el modelo falla en abierto) — por lo que restringir a un miembro significa pasarlo a modo gestionado con una lista explícita. Los propietarios y administradores siempre obtienen todo, sin importar nada.

**Secciones de módulos.** Las secciones que pueden otorgarse incluyen planificación (planificador, planificación diaria, planificador anual, biblioteca/historial de sesiones), plantel (plantel, alineación, disponibilidad, evaluaciones, informes de partido), rendimiento (bienestar, RPE, monitor de carga, GPS), S&C (planificador de gimnasio, S&C individual, biblioteca de gimnasio, nutrición) y médico (clínico, lesiones, tratamientos, rehabilitación, sala de video). Por eso, por ejemplo, los módulos médicos pueden retenerse a los roles no médicos.

**Integraciones GPS — pull vs push.** Los dos proveedores se conectan de forma diferente:

- **Catapult** es una integración **pull**: pegas un **token de API del club** (de OpenField) y eliges una región; ClavaMetrics entonces extrae tus actividades bajo demanda o en una sincronización. El token se almacena como secreto (nunca se muestra de vuelta), y mapeas los atletas y parámetros de Catapult a tus jugadores y métricas.
- **StatSports** es una integración **push**: coordinas con tu **gestor de cuenta de StatSports** para habilitar la API de terceros, e ingresas la clave; los datos se entregan a ClavaMetrics en lugar de extraerse. (Ver el TODO sobre el cableado exacto del push.)

**Alcance de club.** Todo aquí está acotado a tu club (miembros, permisos, integraciones). Los superadministradores de plataforma (una lista separada de administradores de plataforma) pueden operar entre clubes.

## FAQ

**¿Quién puede abrir Administración?** Solo propietarios y administradores; los demás roles son redirigidos al hub.

**¿Cómo evito que un entrenador vea datos médicos?** Pon al miembro en modo gestionado y otorga solo los módulos que debe tener, dejando fuera las secciones clínico/lesiones/tratamientos/rehabilitación. (El archivo clínico también tiene su propia puerta médica a nivel de base de datos — ver [Registro Clínico](/support/clinical-record).)

**¿Cuál es la diferencia entre una plantilla de rol y las secciones de un miembro?** La plantilla es el valor por defecto para todos los que tienen ese rol; las secciones de un miembro son sus concesiones individuales, que pueden anular la plantilla.

**¿En qué se diferencia Catapult de StatSports?** Catapult se extrae con un token de API del club que ingresas; StatSports se envía (push) a ClavaMetrics después de que tu gestor de cuenta de StatSports habilite la API.

> TODO — no se pudo confirmar del todo desde el código, por favor verificar: (1) si **cambiar el rol de un miembro** re-aplica automáticamente la plantilla de módulos de ese rol, o si la plantilla debe re-aplicarse manualmente. (2) El **cableado exacto del push de StatSports** del lado de ClavaMetrics (webhook/endpoint) — la página de Administración muestra la configuración con el gestor de cuenta y un estado de "verificación pendiente", pero el mecanismo receptor no era visible aquí. (3) Las pestañas **Secciones** y **Seguridad y SSO** están marcadas como próximamente, y el webhook de **facturación de Stripe** que rellena los datos de la suscripción se indica como pendiente.

## Relacionado

- [Análisis GPS](/support/gps-analysis) — donde se analizan los datos GPS sincronizados.
- [Monitor de Carga](/support/load-monitor) — el modelo ACWR configurado por el club se aplica a todo el club.
- [Registro Clínico](/support/clinical-record) — los módulos médicos controlados aquí, más su propia puerta de base de datos.
- [Hub del Cuerpo Técnico](/support/hub) — el inicio en el que aterrizan los roles no administradores.
