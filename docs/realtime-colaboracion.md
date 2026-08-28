# Colaboración en vivo — Nivel 1 (hecho) y Nivel 2 (plan)

Dos cosas distintas que se suelen mezclar bajo "tipo Google Docs":

| | Qué se ve | Estado |
|---|---|---|
| **Nivel 1 — refresco en vivo** | Otro toca algo y tu pantalla se pone al día sola, sin recargar | **Hecho** (Calendar + Daily Planning) |
| **Nivel 2 — edición concurrente** | Dos personas escriben lo mismo al mismo tiempo sin pisarse, con cursores/presencia | Paso 1 (candado) hecho; pasos 2 y 3 abajo |

---

## Nivel 1 — cómo quedó

Motor: [assets/cm-realtime.js](../assets/cm-realtime.js). Una sola API para toda la app:

```js
window.cmLive.watch({
  name: 'calendar',
  tables: [{ table: 'training_sessions', filter: `club_id=eq.${clubId}` }],
  relevant: row => row.team_id === teamId,   // ignorar lo que no está en pantalla
  busy: () => hayEdicionEnCurso(),           // no pisar al usuario
  onRefresh: async () => { await loadSessions({ silent: true }); },
});
```

Las cuatro reglas que hacen que no moleste:

1. **Coalescing.** Una ráfaga de cambios (mover 8 ejercicios) provoca **una** recarga, no ocho.
2. **Supresión de eco.** Si el cambio lo hizo esta misma pestaña no se recarga al toque. Se detecta interceptando `fetch`: todo `POST/PATCH/DELETE` a `/rest/v1/<tabla>` marca esa tabla como "escrita por mí" durante 4 s. Pasada la ventana igual se refresca una vez, por si el de al lado guardó en el mismo momento.
3. **Nunca encima de la edición.** Si `busy()` es true (autosave en cola, drag, foco en un campo, modal abierto) no se repinta: aparece un chip **«Hay cambios nuevos · Actualizar»** y se aplica cuando el usuario suelta o hace clic.
4. **Pestaña de fondo y reconexión.** Con la pestaña oculta se posterga; al volver, se aplica. Si se cayó el socket, al reconectar se hace un refresh para recuperar lo perdido.

### Cableado actual

**Se actualizan solas** (tienen una función de recarga que se puede volver a llamar):

| Pantalla | Tablas que escucha | Qué recarga |
|---|---|---|
| Calendar | `training_sessions`, `calendar_events`, `microcycles` | `loadSessions({silent:true})` + ribbon, o la vista mes/lista según corresponda |
| Daily Planning | `training_sessions`, `session_exercises`, `session_participants`, `availability`, `treatments` | `loadDay(fecha actual)` |
| Gym Planner | `training_sessions`, `session_participants`, `availability`, `treatments` | `gpLoadDay(fecha actual)` |
| Tactical Planning | `tactical_objectives`, `tactical_catalog` | `tpLoadMonth()` + `tpLoadCatalog()` + `tpLoadStats()` |
| Injuries | `injuries`, `injury_phases`, `availability` | `loadAll()` |
| RPE | `rpe`, `training_sessions` | `loadRpe()` + `loadOrphans()` |
| Wellness | `wellness` | `loadWellness()` |

**Solo avisan** (`manual: true`): su carga vive inline dentro del boot, así que no hay función que llamar. Muestran el chip y, con el clic, recargan la página. Partirlas en funciones para que se refresquen solas es trabajo aparte, pantalla por pantalla.

| Pantalla | Tablas que escucha |
|---|---|
| Squad | `players`, `player_teams` |
| Physio | `treatments`, `injuries` |
| Rehab & Preventives | `rehab_plans` |

En RPE y Wellness había un poll cada 60 s; con realtime pasó a 5 minutos y queda solo como red de seguridad por si se cae el socket sin avisar.

Sin cablear todavía: Load Monitor y Club Overview (cargan desde `assets/load-monitor.js` y `assets/club-overview.js`; son vistas analíticas, el vivo aporta menos), Hub (ya escucha `treatments` e `injuries` por su cuenta) y Availability (tiene su propio realtime, más fino: actualiza la celda sin recargar la matriz).

### Requisito de base de datos

El bloque está al final de [db/schema.sql](../db/schema.sql). Sin correrlo el código no falla, simplemente **no llega nada**: agrega las tablas a la publicación `supabase_realtime` y les pone `REPLICA IDENTITY FULL` (si no, un DELETE viaja solo con el id y el filtro `club_id` lo descarta: los borrados no se verían).

Verificación: `select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1;`

### Para sumar otra pantalla

1. `<script src="assets/cm-realtime.js"></script>` después de `supabase-init.js`.
2. `cmLive.watch({...})` al final del boot, apuntando `onRefresh` a la función de carga que ya existe.
3. Si la tabla es nueva, agregarla a la publicación (mismo patrón que el bloque de `db/schema.sql`).

Si la pantalla no tiene función de recarga, `manual: true` + `onRefresh: () => location.reload()` es la salida honesta y sin riesgo.

---

## Nivel 2 — plan

### El problema real que falta resolver

Hoy el autosave de Daily Planning (`dpAutoSaveSession`) escribe **la fila entera** de `training_sessions`, incluidos los jsonb `gps_targets` y `gym_content`. Si dos personas tienen la sesión abierta, la última en guardar pisa el objeto completo de la otra. No hay conflicto visible: el trabajo simplemente desaparece. Lo mismo en el Planner (pizarra) y en Lineup, que guardan un objeto de estado completo.

El Nivel 1 lo hace **visible** (ves el cambio del otro), pero no lo **evita**.

### Tres caminos, de barato a caro

**A · Candado suave por presencia — HECHO**
Motor en [assets/cm-lock.js](../assets/cm-lock.js), cableado en Daily Planning y Gym Planner:

```js
const lock = window.cmLock.claim({
  resource: `dp:${teamId}:${date}`,   // qué se está editando
  clubId,
  label: 'esta sesión',
  scope: '.gp-card-b',                // opcional: qué apagar en modo lectura
  guard: { silent: ['gpAutoSave'], toast: ['gpPublish'] },
  onState: ({ isOwner }) => { window._dpReadOnly = !isOwner; },
});
lock.setResource(`dp:${teamId}:${otroDia}`);   // al cambiar de día, sin recargar
```

Cómo se decide quién manda: todos publican su presencia (`tabId`, `userId`, `since`, `resource`) en el canal `cmlock-<clubId>`; el dueño es el de `since` más viejo, con desempate por `tabId` para que todas las pestañas coincidan. La misma persona con dos pestañas no se bloquea a sí misma (se compara por `userId`), y quien está en otro día ni cuenta (se filtra por `resource`).

El que no tiene el candado ve el cartel arriba con el avatar del que está editando y un botón **«Editar igual»**. Si lo pulsa, los dos quedan como editores y ambos ven una advertencia amarilla — no hay bloqueo duro, es un candado social. Cuando el dueño cierra la pestaña, el candado cae solo en el que estaba mirando y se le avisa en verde que ya puede editar.

Tres capas de bloqueo, según lo que tenga cada pantalla:
- **Daily Planning** reusa su modo solo-lectura por rol, que ya existía (`window._dpReadOnly` + `body.dp-ro` + funciones envueltas). El candado solo mueve el flag; nunca levanta un bloqueo que venga del rol.
- **Gym Planner** usa `scope`: se apagan los cuerpos de las tarjetas y las acciones de sus encabezados, y quedan vivos el pager de días, el print y el PDF. Solo se revierte lo que apagó el helper — un campo que ya venía deshabilitado sigue así.
- **`guard`** envuelve funciones globales (autosaves con timer ya lanzados, atajos) como red de seguridad para lo que no pasa por el DOM.

Tres modos según cómo guarde la pantalla:

| Pantalla | Recurso | Modo |
|---|---|---|
| Daily Planning | `dp:<equipo>:<fecha>` | bloquea (reusa `_dpReadOnly`) |
| Gym Planner | `gym:<equipo>:<fecha>` | bloquea (`scope`) |
| Planner | `exercise:<id>` | **solo avisa** (`warnOnly`) |

**`warnOnly`** es para las pantallas que guardan con un botón explícito. En Planner bloquear sería peor que el problema: te dejaría con un dibujo a medio hacer que no podés guardar. Entonces avisa quién más lo tiene abierto y, al pulsar Save, pregunta antes de reemplazar la versión del otro (`lock.otherEditor()`). Con un borrador que todavía no existe en la base el recurso va vacío y no compite con nadie.

### Campos ocupados, en vivo

`fields: '<selector>'` marca el campo donde está parado el otro: borde de su color y su nombre encima, como la celda seleccionada en una planilla compartida. Va sobre el mismo canal de presencia del candado — el meta lleva un campo `field` más — así que no agrega ni una conexión.

- Se anuncia con `focusin` y se suelta con `focusout`, con 250 ms de respiro: saltar de un campo a otro no manda un "salí" intermedio, o la marca parpadearía en cada tabulación. Al ocultarse la pestaña también se suelta.
- Los campos deben tener `id` — es lo que viaja por el canal.
- Se dibuja en un overlay `position:fixed` aparte, nunca tocando el input: no hay forma de ensuciar el formulario ni de robarle el foco a nadie. Se reposiciona en scroll y resize, más un repaso cada 700 ms para los paneles que se abren sin ninguno de los dos eventos.
- Sirve igual en modo lectura: el que mira ve qué está tocando el que tiene el candado.

Activo en Daily Planning (`dp*`), Gym Planner (`gp*`) y Planner (`plEx*`).

Lo que esto **no** es: ver las letras aparecer mientras el otro escribe, ni dos personas en el mismo campo a la vez. Eso es el paso 3 (CRDT).

Falta: Lineup.

**B · Guardado por campo en vez de por objeto** — 1 a 2 semanas
Dejar de mandar la fila entera. Cada cambio escribe solo lo suyo:
- los ejercicios ya viven en `session_exercises` (una fila por ejercicio) → ahí alcanza con no reescribir hermanos;
- los jsonb (`gps_targets`, `gym_content`) pasan a `jsonb_set` por clave, o a tabla propia;
- agregar `updated_at` + chequeo optimista: si la fila cambió desde que la leí, no piso, recargo y reaplico.

Con esto dos personas pueden trabajar en la misma sesión mientras toquen cosas distintas (uno los ejercicios, otro los targets de GPS). Sigue habiendo conflicto si tocan **el mismo** campo, resuelto como "gana el último", pero acotado a ese campo y no a la sesión entera.

**C · CRDT (Yjs) para texto y pizarra** — 3 a 5 semanas
Solo donde hace falta escribir *dentro del mismo texto o lienzo* a la vez: el campo de notas y el Planner (pizarra táctica). Yjs sobre `broadcast` de Supabase Realtime para el vivo, más un snapshot binario en la DB cada X segundos y al cerrar. Trae cursores ajenos y merge sin conflicto.
Es el único que da la sensación literal de Google Docs, y el único que obliga a repensar cómo persiste esa pantalla. **No hacerlo antes de A y B.**

### Orden recomendado

1. ~~**A**, sobre Daily Planning y Gym Planner.~~ Hecho. Queda extenderlo a Planner y Lineup.
2. **B** sobre `training_sessions` (los dos jsonb) y `session_exercises`. Es el arreglo de fondo. Recién vale la pena si alguien pide editar en paralelo de verdad: con el candado puesto, la pérdida silenciosa ya no ocurre.
3. **C** solo si aparece el pedido concreto de escribir juntos en la pizarra o en las notas.

### Cosas a tener en cuenta

- **Presencia y RLS.** El canal del candado es por club (`cmlock-<club_id>`) y lleva nombre y avatar: nunca debe abrirse a más de un club. Realtime no aplica RLS sobre presencia, así que el aislamiento lo da el nombre del canal.
- **Escalado.** `REPLICA IDENTITY FULL` engorda el WAL en cada update. Con jsonb grandes y muchos clubes hay que medirlo; si molesta, sacar el `FULL` de `training_sessions` y filtrar los DELETE en el cliente.
- **Límites de Realtime.** Lo que se cuenta como *conexión* es el cliente (la pestaña), no el canal: hasta 100 canales viajan por el mismo WebSocket. Como `assets/sidebar.js` ya abría canales (notificaciones, chat, presencia) en todas las páginas, el Nivel 1 **no agregó conexiones** — agregó canales sobre las que ya estaban. Lo que sí crece es el conteo de **mensajes**: cada cambio en la DB cuenta uno por cada cliente que lo escucha. Cuotas: conexiones 200 (Free) / 500 (Pro, 10.000 sin spend cap); mensajes 2 M (Free) / 5 M (Pro) por mes, después USD 2,50 el millón; mensajes por segundo 100 (Free) / 500 (Pro) — este último es el que puede morder en un pico, por ejemplo 25 jugadores mandando el RPE juntos con 8 del staff mirando el tablero. Se mira en Dashboard → Reports → Realtime.
- **Offline.** Nada de esto funciona sin conexión. El chip y el refresh al reconectar son la red de seguridad; el service worker no cachea escrituras.

---

## Cuándo hay que pagarle más a Supabase

Medido el 2026-08-28: 7 clubes (2 con actividad en 30 días), 21 cuentas de staff, 125 jugadores, base de 85 MB, storage de 108 MB, ~2.800 filas nuevas por mes en tablas publicadas.

Escalando esos números por club activo (≈3 del staff, ≈5 conexiones pico, ≈15.000 mensajes al mes):

| Límite | Free | Se toca cerca de | Pro |
|---|---|---|---|
| Conexiones pico | 200 | ~40 clubes activos a la vez | 500 (10.000 sin spend cap) |
| Mensajes/mes | 2 M | ~130 clubes activos | 5 M |
| Tamaño de base | 500 MB | ~40 clubes | 8 GB |
| Storage | 1 GB | ~65 clubes | 100 GB |

**Realtime no es lo que va a obligar a pagar.** El Free Plan no tiene backups automáticos ni point-in-time recovery: con clubes pagando por el producto, eso es el motivo real para estar en Pro (USD 25/mes, que ya cubre un proyecto Micro con los USD 10 de compute credits), mucho antes que cualquier cuota de Realtime.

Pasado Pro, el orden es: apagar el spend cap (sube a 10.000 conexiones y 2.500 mensajes/segundo) y pagar el excedente — USD 10 por cada 1.000 conexiones pico y USD 2,50 por millón de mensajes. El salto a Team (USD 599/mes) es por cumplimiento y soporte, no por estos límites.
