# ClavaMetrics multideporte — research y plan

> Estado: **documento de planificación**. Nada de esto está implementado todavía.
> Fecha: 2026-08-28.

## 1. En una frase

Hoy la app dice "una plataforma, todos los deportes" en el Login y en el Register te
deja elegir deporte, pero **ese dato ni siquiera se guarda**: `clubs.sport` está en
NULL en 6 de los 7 clubes de la base. Todo lo que hay abajo (posiciones, alineación,
cancha, partido, métricas, microciclo) está escrito en idioma fútbol.

La buena noticia: la mitad de la app ya es agnóstica del deporte, y tres piezas clave
ya tienen el patrón correcto de "config por club". El trabajo no es reescribir, es
**sacar el fútbol de adentro del código y ponerlo en un paquete de deporte**.

---

## 2. Qué encontré en el código (auditoría)

### 2.1 Lo que ya está listo o casi

| Pieza | Estado |
|---|---|
| [assets/field-system.js](../assets/field-system.js) | **Ya dibuja 5 canchas**: fútbol, futsal, básquet, hockey césped, rugby + superficie en blanco. Está bien hecho, es SVG vectorial y extensible. |
| [assessment_test_defs](db/) (`db/schema.sql:61`) | Modelo **global (`club_id NULL`) + override por club**. Este es exactamente el patrón que necesitamos replicar en todo lo demás. |
| [gps_metric_definitions](../db/schema.sql) (`db/schema.sql:779`) | Las métricas GPS **ya son por club**, con categorías genéricas (distance/speed/acceleration/load/time/count/custom). Sirve para IMU de básquet y saltos de vóley casi sin tocar. |
| `club_feature_flags`, `club_modules`, `role_default_modules` | Ya permiten prender/apagar secciones por club. El sidebar puede esconder "Lineup" o "Match Reports" según el deporte sin código nuevo. |
| Gym, Nutrición, Wellness, RPE, Lesiones, Fisio, Rehab, Chat, Disponibilidad, Video, Historial de sesiones, Billing | **Transversales**. No hay nada de fútbol adentro. Sirven igual para básquet o vóley. |

### 2.2 Lo que está atado a fútbol

**A. El deporte no se persiste**
- [Register.html:507-520](../Register.html#L507) muestra las pestañas football / basketball / volleyball / rugby / other.
- [Register.html:707](../Register.html#L707) hace `insert({ name, country })` — **el deporte elegido se pierde**.
- `clubs.sport` (`db/schema.sql:408`) existe pero nadie lo lee ni lo escribe.

**B. Posiciones (dos copias, ambas de fútbol)**
- [assets/positions.js](../assets/positions.js): tabla canónica GK/CB/LB/CDM/LW/ST + ~120 alias en 3 idiomas + roll-up a 6 posiciones básicas.
- [Squad.html:946](../Squad.html#L946) `POS_CFG`: **copia duplicada** con iconos y colores. El propio comentario de `positions.js` dice que hay que converger.
- Impacto en cadena: filtros de plantel, baselines GPS "vs posición", agrupaciones en Evaluations, Dossier, Match Reports, Load Monitor.

**C. Alineación**
- `lineups.formation` es **texto obligatorio** (`db/schema.sql:1352`) — "4-3-3". En básquet no existe formación, en vóley existe pero es rotación P1..P6.
- [assets/sidebar.js:240](../assets/sidebar.js#L240) muestra el contador literal `XI` (once inicial).
- `lineup_staff.role_code` incluye `gk_coach` (entrenador de arqueros) — no aplica a básquet/vóley.
- El poster de alineación asume 11 titulares + banca.

**D. Partido**
- `match_reports` (`db/schema.sql:1407`): `score_ht_*` (medio tiempo → básquet tiene 4 cuartos, vóley sets), `formation_us/them`, `goals`, `cards`, `possession`, `shots_on/off/blocked`, `xg`, `corners`, `offsides`, `fouls`, `pass_accuracy`. Casi todo es fútbol puro.
- `player_match_stats` (`db/schema.sql:1960`): `goals`, `assists`, `yellow_cards`, `red_cards`. Hay un `extra jsonb` que salva la situación.
- `match_shots` (`db/schema.sql:1475`): `outcome` = goal/on_target/off_target/blocked, con coordenadas de cancha. Sirve como base para el shot chart de básquet, pero con otros outcomes.
- `league_configs` (`db/schema.sql:1301`): acumulación de **tarjetas** y partidos de suspensión. En básquet son faltas personales/técnicas, en handball exclusiones de 2 minutos, en vóley casi no aplica.

**E. Planificación semanal (el punto más delicado)**
- El modelo entero gira alrededor de **MD** (match day) con un solo partido por semana:
  [assets/pages/calendar.js:657](../assets/pages/calendar.js#L657) `MD_MENU_OPTIONS = ['Auto','MD','MD-1'…'MD-6','MD+1'…'MD+3','OFF']`,
  [assets/pages/gps-analysis.js:2226](../assets/pages/gps-analysis.js#L2226) `_GP_MD_OPTS`, `microcycles.day_orientations`, `md_overrides`, `exercises.match_day`.
- Básquet, vóley y handball juegan **2-3 partidos por semana**. Un microciclo puede ser MD+1 y MD-1 el mismo día. El código ya tiene el problema en fútbol (dos sesiones/día → ver `project_md_per_session`), acá se vuelve la regla, no la excepción.
- `calendar_events.type` (`db/schema.sql:192`) tiene 23 tipos y ninguno es de fútbol en particular: se salva. Falta `weights`/`shootaround`/`walkthrough` (ya está) y quizá `game_2` para dobles jornadas.

**F. Ejercicios y pizarra**
- [Planner.html:1659](../Planner.html#L1659): *"Sport is fixed to football for now"* — el selector de deporte está escrito pero deshabilitado; solo deja elegir completa/media/en blanco y rotar.
- Objetos del designer ([Planner.html:1304-1327](../Planner.html#L1304)): pelota, cono, pica, arco, poste, maniquí. Faltan aro/tablero, red de vóley, bolsas de tackle, escalera de agilidad.
- `exercises.game_type` = SSG/MSG/LSG (juegos reducidos) — es vocabulario de fútbol/rugby; en básquet sería 3v3/4v4/5v5 y en vóley 6v6/4v4.
- `exercises.field_width/height` en metros: bien, es genérico.
- `exercises.is_goalkeeper` — booleano específico de arquero; en básquet no hay, en vóley el líbero es otra cosa.

**G. Evaluaciones y carga**
- [assets/pages/evaluations.js:1952](../assets/pages/evaluations.js#L1952): las bandas de referencia (Yo-Yo IR1 elite ≥2400 m) son **normas de futbolistas**. Aplicadas a un pivot de básquet o un central de vóley dan lecturas falsas.
- Catálogo de tests fijo: Yo-Yo IR1/IR2, RSA 6×30, Illinois, 505, sprint 30 m. Faltan lane agility (básquet), spike/block reach (vóley), bronco (rugby).
- [assets/topup-calc.js:23](../assets/topup-calc.js#L23): bandas HSR/sprint como % de Vmax con fallback 19.8 / 25.2 km/h. En una cancha de 28 m nadie llega a 25 km/h: el Top-Up tal cual **no tiene sentido en indoor**.
- `players.dominant_foot` (pie hábil) → en básquet/vóley/handball es **mano hábil**.
- Antropometría: falta envergadura y alcance de pie/salto, que en básquet y vóley son datos de ficha básicos.

**H. Táctica**
- `tactical_catalog.category` (`db/schema.sql:2521`): offensive / defensive / transition_off / transition_def / set_pieces / other. Es sorprendentemente universal para deportes de invasión. En vóley habría que cambiarlo por saque / recepción / ataque / bloqueo / defensa / contraataque.

**I. Iconos y vocabulario**
- `ti-soccer-field` en el sidebar, `ti-ball-football` en el Planner, `assets/soccer-ball.svg`, `assets/field.jpg`, "Pitch-green primary" en Load Monitor.
- En i18n: "gol", "partido", "medio tiempo", "arquero", "once inicial" están repartidos en `locales/{en,es,pt}.json`.

---

## 3. Research por deporte

Los deportes viables son los **de equipo con cancha y plantel**. Atletismo y natación quedan
fuera (son individuales: no hay alineación, ni táctica colectiva, ni microciclo colectivo).

### 3.1 Básquetbol
- **Plantel/cancha**: 5 en cancha, 12-15 en lista. Cambios ilimitados. 4 cuartos.
- **Posiciones**: PG / SG / SF / PF / C (o base, escolta, alero, ala-pívot, pívot). Roll-up moderno: guards / wings / bigs.
- **Carga externa**: no hay GPS (es indoor). Se usa **IMU o LPS**: PlayerLoad, IMA de aceleración/desaceleración/cambio de dirección, conteo de saltos, distancia relativa. La literatura confirma que la carga de partido es bastante mayor que la de entrenamiento, y que PlayerLoad y las IMA por encima de 3,5 m/s² son los indicadores de referencia ([Sports 2025](https://doi.org/10.3390/sports13090296), [Sensors 2024](https://doi.org/10.3390/s24196365)).
- **Minutos**: el minuto jugado es la unidad de carga interna número uno (tiempo neto, no corrido). Esto ya lo tenemos vía `availability.minutes`, pero calculado sobre 90'.
- **Estadística de partido**: puntos, T2/T3/TL intentados y convertidos, rebote ofensivo/defensivo, asistencia, robo, tapón, pérdida, falta personal, +/-, valoración.
- **Semana**: 2-3 partidos. El modelo debe ser **GD-x / GD+x con varios GD**, con microdosificación de fuerza entre partidos.
- **Ficha**: altura sin zapatillas, envergadura, alcance de pie. Mano hábil.

### 3.2 Vóleibol
- **Plantel/cancha**: 6 en cancha con rotación obligatoria, líbero aparte. 18×9 m, red, zona de ataque de 3 m. Sets.
- **Posiciones**: armador, opuesto, punta-receptor, central, líbero, especialista defensivo.
- **Carga externa**: el estándar es el **conteo de saltos y la carga de salto**, medido con IMU tipo VERT en la cintura (jump count, altura, impacto de aterrizaje). Los centrales acumulan muchos más saltos altos que puntas u opuestos, y el conteo de saltos de alta intensidad predice fatiga neuromuscular mejor que el conteo total o la duración de la sesión ([PLOS One 2021](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0245299), [J Strength Cond Res 2024](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11669427/)).
- **Distancia y HSR no sirven**: el Top-Up, las bandas de velocidad y el E:P por distancia hay que reemplazarlos por saltos.
- **Estadística de partido**: sets ganados/perdidos, puntos por set, ace, error de saque, % de recepción positiva/perfecta, % de eficacia de ataque (kill %), bloqueos, defensas.
- **Táctica**: el catálogo debe ser saque / recepción / K1 / K2 / bloqueo / defensa, no ofensiva/defensiva.

### 3.3 Handball
- **Plantel/cancha**: 7 en cancha (arquero incluido), 40×20 m, área de 6 m, línea de 9 m, penal de 7 m. Dos tiempos de 30'.
- **Posiciones**: portero, extremo izq/der, lateral izq/der, central, pivote.
- **Carga**: LPS indoor. Distancia, sprints cortos, muchos cambios de dirección, **conteo de lanzamientos** y contactos.
- **Sanciones**: exclusión de 2 minutos, amarilla, roja, azul. `league_configs` necesita generalizarse.

### 3.4 Rugby
- **Plantel/cancha**: 15 (o 7). Cancha ya dibujada.
- **Posiciones**: numeradas 1-15 con nombre propio (pilar, hooker, segunda línea, ala, octavo, medio scrum, apertura, centros, wings, fullback). La partición clave para todo el análisis es **forwards vs backs**.
- **Carga**: GPS sí, pero lo distintivo son las **colisiones e impactos**. Los forwards acumulan muchas más colisiones; los backs, más carrera de alta velocidad y carga metabólica alta. PlayerLoad slow es la métrica que mejor captura la actividad de colisión ([systematic review 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7900280/)).
- **Consecuencia**: los baselines "vs posición" deben separar forwards de backs o los promedios no significan nada.
- **Estadística**: tries, conversiones, penales, drops, tackles hechos/errados, rucks, line-outs, scrums. Amarilla = 10 minutos fuera.
- **Objetos de pizarra**: bolsas de tackle, escudos de ruck, máquina de scrum, escalera.

### 3.5 Futsal
- 5 jugadores, cambios ilimitados y volantes, 2×20' de tiempo neto, **faltas acumuladas** (a la 6ª, doble penal). Cancha ya dibujada.
- Muy cercano al fútbol: es el deporte más barato de soportar y el mejor primer candidato después del fútbol.

### 3.6 Hockey césped
- Cancha ya dibujada. 11 jugadores, 4 cuartos, córner corto, tarjetas verde/amarilla/roja (temporales). Carga muy parecida al fútbol (GPS al aire libre).

---

## 4. Arquitectura propuesta: el "paquete de deporte"

La idea central: **un archivo declarativo por deporte** que la app lee al arrancar, más
overrides por club en la base. Nada de `if (sport === 'basketball')` desparramado.

```
assets/sport-packs/
  football.js      (el actual, extraído del código)
  futsal.js
  basketball.js
  volleyball.js
  handball.js
  rugby.js
  hockey.js
  generic.js       (fallback: cancha en blanco, sin posiciones, sin partido)
assets/sport.js    → window.CMSport: carga el pack activo y expone helpers
```

Cada pack define:

```js
{
  key: 'basketball',
  label: { en:'Basketball', es:'Básquetbol', pt:'Basquetebol' },
  field: { type:'basketball', defaultVariant:'full', orient:'h' },   // → field-system.js
  positions: { codes:{…}, groups:[…], aliases:{…}, rollup:'guards|wings|bigs' },
  roster:  { onCourt:5, benchMax:10, unlimitedSubs:true },
  lineup:  { hasFormation:false, slots:5, label:'Quinteto', staffRoles:[…] },
  match:   { periods:{count:4, minutes:10}, scoring:'points',
             sanctions:'fouls', statSchema:[…], shotChart:{outcomes:[…]} },
  load:    { tracking:'imu', coreMetrics:['player_load','ima_accel','jump_count','minutes'],
             speedBands:null, topUpEnabled:false },
  tests:   ['cmj','sprint20','lane_agility','standing_reach','wingspan','yoyo1'],
  micro:   { anchor:'GD', multiGamePerWeek:true, dayCodes:['GD','GD+1','GD-1','GD-2'] },
  tactics: { categories:['offensive','defensive','transition_off','transition_def','set_plays','other'] },
  drills:  { gameTypes:['3v3','4v4','5v5'], objects:['ball','cone','hoop','chair','ladder'] },
  anthro:  { extra:['wingspan','standing_reach'], dominantSide:'hand' },
  icons:   { ball:'ti-ball-basketball', field:'ti-ball-basketball' },
  vocab:   { match:'game', pitch:'court', goal:'point', gk:null }
}
```

**Dónde vive el deporte**: propongo `teams.sport` (con `clubs.sport` como valor por
defecto), no solo `clubs.sport`. Un club real puede tener sección fútbol y sección
básquet, y ya tenemos la regla de "aislar por equipo siempre". El switcher de equipo del
sidebar pasaría a cambiar también el paquete de deporte activo.

**Overrides por club**: fila en `club_settings` con `module_key='sport_pack'` y el JSON de
diferencias (un club que usa nombres propios de posiciones, o que agrega un test).

---

## 5. Plan por fases

### Fase 0 — Cimientos (sin cambios visibles)
1. Persistir el deporte en el Register (`Register.html:707`) y en el Onboarding.
2. `ALTER TABLE teams ADD COLUMN sport text` + `clubs.sport` con check de valores válidos.
3. Crear `assets/sport.js` + `assets/sport-packs/football.js` con **exactamente lo que
   hoy está hardcodeado**. Objetivo: cero cambio de comportamiento, todo pasa por el pack.
4. Unificar `Squad.html:946` `POS_CFG` con `assets/positions.js` (la deuda que ya está anotada).
5. Helper `cmSport()` global, cargado junto al sidebar, con caché igual que el club activo.

### Fase 1 — Vocabulario e identidad
- Claves i18n por deporte: `sport.<key>.match`, `.pitch`, `.goal`, `.lineup_count`.
- Iconos y color de acento por deporte (sacar el verde césped fijo del Load Monitor).
- Sidebar: esconder módulos que no aplican (Lineup en deportes sin formación fija, Top-Up en indoor) vía `club_modules` sembrado desde el pack.

### Fase 2 — Plantel, alineación y pizarra
- Squad: posiciones desde el pack, grupos y colores; ficha con envergadura/alcance y mano hábil cuando el pack lo pide.
- Lineup: `formation` pasa a nullable; nº de titulares y de banca desde el pack; poster con plantillas por deporte; roles de cuerpo técnico desde el pack.
- Planner: **habilitar el selector de deporte** que ya está escrito (`Planner.html:1659`) y atarlo al pack; agregar los objetos que faltan (aro, red, bolsa de tackle, escalera); reemplazar SSG/MSG/LSG por `drills.gameTypes`.
- Agregar vóley y handball a `field-system.js` (son dos funciones de dibujo, el sistema ya está).

### Fase 3 — Planificación semanal
- Generalizar MD → **ancla de día** configurable (`MD` en fútbol, `GD` en básquet).
- Soportar **varios partidos por microciclo**: el código de día debe resolverse contra el partido más cercano, no contra "el partido de la semana". Esto también arregla el problema que ya tenemos en fútbol con dobles sesiones.
- Calendar: tipos de evento extra por deporte (shootaround, walkthrough ya existe).
- Load Planner: referencias de partido por deporte (distancia en fútbol, PlayerLoad en básquet, saltos en vóley).

### Fase 4 — Rendimiento
- Sembrar `gps_metric_definitions` desde el pack al crear el club (ya es por club: es cambio de datos, no de esquema).
- GPS Analysis: renombrar el módulo a algo neutro ("Tracking" o "Carga externa") y hacer que las bandas de velocidad, el E:P y el Top-Up se apaguen cuando el pack dice `tracking:'imu'`.
- Baselines "vs posición": usar el roll-up del pack (guards/wings/bigs, forwards/backs).
- Evaluations: catálogo de tests y **bandas de referencia por deporte** (hoy son de fútbol y están hardcodeadas). Usar el patrón global+club de `assessment_test_defs`.

### Fase 5 — Partido
- `match_reports`: mover las columnas específicas de fútbol a un `stats jsonb` con esquema declarado por el pack; dejar en columnas solo lo universal (fecha, rival, local/visitante, resultado, competición).
- Periodos flexibles (2 tiempos / 4 cuartos / N sets) en lugar de `score_ht_*`.
- `player_match_stats`: seguir usando `extra jsonb`, con el formulario generado desde el pack.
- `league_configs`: generalizar de "tarjetas" a "sanciones acumulables" (tarjetas, faltas, exclusiones).
- Shot chart de básquet reutilizando `match_shots` con outcomes del pack.

### Fase 6 — Alta y migración
- Onboarding con deporte: al crear el club se siembran posiciones, métricas, tests, catálogo táctico y módulos del pack.
- Cambiar de deporte a posteriori: pantalla de migración que avisa qué datos quedan huérfanos (posiciones guardadas, formaciones, stats de partido) y ofrece mapeo o limpieza. **No permitir el cambio en silencio.**

---

## 6. Decisiones tomadas (2026-08-28)

1. **Alcance de la v1**: fútbol (base) + **futsal**, **básquetbol**, **rugby** y **hockey césped**.
   Vóley y handball quedan fuera de la v1, pero el paquete se diseña para soportarlos sin
   romper nada: por eso el modelo de carga contempla `tracking:'imu'` y saltos desde el
   arranque, aunque todavía ningún pack activo los use.
2. **El deporte vive en el club** (`clubs.sport`), no en el equipo. Más simple. Si más
   adelante aparece un club polideportivo, se agrega `teams.sport` como override sin
   romper nada de lo que se construye ahora.
3. **Se puede cambiar de deporte después**, pero con pantalla de migración explícita (Fase 6).
4. **Los módulos que no aplican se esconden** vía `club_modules`, que ya existe.

### Decisiones que quedan para más adelante
- Cómo se mapean las posiciones guardadas cuando un club cambia de deporte.
- Si el Top-Up se esconde o se reemplaza por un equivalente indoor.

---

## 7. Riesgo principal

El punto más caro **no** es la cancha ni las posiciones: es el **microciclo**. Todo el
sistema (Calendar, Daily Planning, GPS, Load Monitor, Load Planner, Sessions History,
comparación de microciclos) asume un partido por semana y un código MD por día. Los
deportes indoor juegan dos o tres. Si esa generalización no se hace bien en la Fase 3,
las fases 4 y 5 se construyen sobre arena.
