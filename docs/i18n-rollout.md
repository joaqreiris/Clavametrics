# i18n Rollout — Runbook (page by page)

**Cómo se usa:** decile al agente
> *"Seguí `docs/i18n-rollout.md`: hacé la próxima página pendiente."*
o apuntá una específica:
> *"Seguí `docs/i18n-rollout.md` con `Squad.html`."*

El agente lee este archivo, agarra la próxima sin tachar del tracker (§6), corre el
loop (§2), respeta las convenciones (§3) y las reglas fijas (§1), y **al final tacha
la página acá mismo y commitea**. Una página = un commit.

> El sistema base (runtime, locales, tooling) ya está. `assets/i18n.js` lo inyecta
> `assets/sidebar.js`, así que **las páginas con sidebar NO necesitan `<script>`**.
> Las páginas de auth (sin sidebar) sí — ver §3.

---

## 1. Reglas fijas (no se negocian)

- **Diff-first.** Leé la página entera antes de tocar. Mostrá el diff antes de aplicar.
- **Atómico.** Una página por vez, un commit por página. **Nunca `git add -A`** — solo los archivos nombrados.
- **UI en inglés como base.** El texto en el HTML queda en inglés; el runtime lo pisa.
- **`es` = español neutro (sin voseo).** El `es.json` es español neutro/internacional para todos los mercados (AR, UY, MX, ES…): formas de **tú**, nunca de **vos**. `Crea`/`Elige`/`Revisa`/`Puedes`/`Selecciona`/`Ingresa`, **NO** `Creá`/`Elegí`/`Revisá`/`Podés`/`Seleccioná`/`Ingresá`. Sin regionalismos: `acá`→`aquí`, `vos@…`→`tu@…`. (El tono rioplatense de ESTE runbook da igual; la regla aplica solo a las cadenas de producto en los locales.)
- **Reusá `common.*`** antes de inventar claves nuevas (`common.save`, `common.cancel`, `common.player`, `common.retry`, `common.loading`, etc.).
- **Paridad de idiomas.** Toda clave nueva va en los **tres** archivos: `locales/en.json`, `es.json`, `pt.json`. `node scripts/i18n.mjs check` tiene que pasar.
- **No rompas nada.** Si algo no cierra, pará y avisá antes de commitear.

---

## 2. El loop por página

```bash
# 1) Sacá la lista de strings a traducir (reporter, NO toca el HTML)
node scripts/i18n.mjs scan "PAGE.html"
```

2. **Agregá las claves nuevas** a `locales/en.json`, `es.json`, `pt.json`. Namespace = slug del archivo (`squad.*`, `gps_analysis.*`, …). Reusá `common.*` donde ya exista.

3. **Tagueá el HTML estático:**
   - texto → `data-i18n="key"`
   - placeholder → `data-i18n-ph="key"`
   - atributos (`title`, `aria-label`, `alt`) → `data-i18n-attr="title:key;aria-label:key2"`

4. **Strings dinámicos en JS** → helper `tt()` (§3) + re-render en `cm:langchanged`. Fechas con `toLocaleDateString(CM_I18N.current, {...})`, **nunca** arrays de meses hardcodeadas. Plurales con `|` (§3).

5. **Verificá:**
   ```bash
   node scripts/i18n.mjs check        # es/pt completos, sin missing
   ```
   Si la página tiene scripts inline, chequealos con esbuild/parse. Confirmá que los tags quedaron en el archivo real.

6. **Tachá la página en el tracker (§6)** en este mismo archivo.

7. **Commit + push** (§4).

---

## 3. Convenciones y trampas (aprendidas en Wellness)

**Helper `tt()`** — definilo una vez por página si no está, para los strings que arma el JS:
```js
function tt(key, fallbackEN, vars) {
  const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
  return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
}
// uso: tt("wellness.no_players", "No players yet")
//      tt("wellness.remind_count", "{count} reminders", { count: n })
```

**Re-render en cambio de idioma** — lo estático lo re-aplica `sidebar.js` sobre el `document`; lo que renderiza el JS lo re-hacés vos:
```js
document.addEventListener("cm:langchanged", () => renderTodoLoDinamico());
```

**Botones ícono+texto** — nunca pongas `data-i18n` en un elemento que además tiene un `<i>` u otro hijo: te lo pisa. Envolvé el texto:
```html
<button><i class="ti ti-refresh"></i><span data-i18n="common.refresh">Refresh</span></button>
```

**`<select>` que el JS rearma con datos reales** (equipos, jugadores) → **no** taguees los `<option>` estáticos; traducí las etiquetas fijas (ej. "Whole club") en el JS con `tt()`.

**Fechas y números** → `toLocaleDateString(CM_I18N.current, { month:"long", day:"numeric" })`. Nada de `["Jan","Feb",...]`.

**Plurales** → valor con barra en el JSON: `"{count} player|{count} players"`, y `CM_I18N.t(key, { count })` elige la forma.

**Páginas de auth (sin sidebar)** — Login/Register/Onboarding/set-password **no** cargan el runtime por el sidebar. Agregá el script a mano en el `<head>`:
```html
<script src="assets/i18n.js" defer></script>
```
Ahí la detección cae en navegador/localStorage (todavía no hay perfil ni club — es lo esperado).

**Nota del audit:** una página tagueada que muestra `!` (en vez de `✓`) en `node scripts/i18n.mjs audit` está **bien** si tiene sidebar — el `!` solo dice que no hay un `<script>` literal en el HTML, pero el sidebar lo inyecta. En páginas de auth sí debe ser `✓`.

---

## 4. Commit (plantilla)

```bash
# ejemplo para una página de app (ajustá los archivos que tocaste)
git add "PAGE.html" locales/en.json locales/es.json locales/pt.json docs/i18n-rollout.md
git commit -m "feat(i18n): translate PAGE page"
git push
```
Si además tocaste JS externo de esa página, sumalo al `git add`. **Solo archivos nombrados.**

---

## 5. Marketing (caso especial)

Home/Contact/Pricing ya están tagueadas pero corren el runtime viejo (`i18n.js` raíz).
No hay que taguear nada — solo **cambiar el include** y verificar:
```
<script src="i18n.js">   →   <script src="assets/i18n.js" defer></script>
```
Las claves ya están migradas (probado: 220/220 presentes). Después de switchear las tres,
se puede borrar el `i18n.js` raíz.

---

## 6. Tracker

`✅ hecho · ⬜ pendiente · ⏭️ skip`. Orden = prioridad (de arriba hacia abajo).
El agente hace la **primera ⬜** salvo que se le pida otra.

### Base / shell — hecho
- ✅ Runtime + locales + tooling (`assets/i18n.js`, `locales/*`, `scripts/i18n.mjs`)
- ✅ Sidebar (`assets/sidebar.js`) — nav + inyección del runtime
- ✅ Selector de idioma + detección usuario/club (`settings-drawer.jsx/.js`)

### Fase 1 — Auth (sin sidebar → include manual)
- ✅ Login.html
- ✅ Register.html
- ✅ Onboarding.html
- ✅ set-password.html

### Fase 2 — App de uso diario
- ✅ Wellness.html
- ✅ Hub.html
- ✅ Squad.html
- ✅ Calendar.html
- ✅ Daily Planning.html
- ✅ RPE.html
- ✅ Availability.html
- ✅ Chat & Tasks.html
- ✅ Lineup.html

### Fase 3 — Técnico
- ✅ Planner.html  *(Drill Designer)*
- ✅ Exercises Library.html
- ✅ Daily/Sessions History.html  → `Sessions History.html`
- ✅ Annual Planner.html
- ✅ Match Reports.html
- ✅ Evaluations.html
- ✅ Individual Planner.html
- ✅ Individual Plans.html
- ✅ Video Room.html
- ✅ Video Detail.html

### Fase 4 — Rendimiento
- ✅ Load Monitor.html
- ✅ Gym Planner.html
- ✅ Gym Library.html
- ✅ GPS Analysis.html  *(la más grande — dividí en tandas por sección si hace falta)*
- ✅ Nutrition.html

### Fase 5 — Médico
- ✅ Injuries.html
- ✅ Clinical Records.html
- ⬜ Clinical Record.html
- ⬜ Physio.html  *(Treatments)*
- ⬜ Rehab & Preventives.html
- ⬜ Rehab Planner.html
- ⬜ Dossier.html

### Fase 6 — Admin / workspace
- ⬜ Admin.html
- ⬜ Billing.html
- ⬜ Plan Picker.html
- ⬜ Player.html
- ⬜ Platform.html  *(Platform Admin)*

### Fase 7 — Marketing (switch de runtime, §5)
- ⬜ Home.html  → cambiar include a `assets/i18n.js`
- ⬜ Contact.html
- ⬜ Pricing.html
- ⬜ Borrar `i18n.js` raíz (después de las tres)

### Skip / más adelante
- ⏭️ Evaluations-old.html  *(deprecada)*
- ⏭️ auth-callback.html  *(redirect, UI mínima)*
- ⏭️ seed-calendar.html  *(herramienta dev)*
- ⏭️ shared.html · shared-nutrition.html  *(vistas de compartir — opcional)*
- ⏭️ survey.html  *(encuesta puntual)*

---

## 7. Setup (una sola vez, opcional)

Si querés que los commits salgan con tu identidad real:
```bash
git config user.name  "Joaquín Reiris"
git config user.email "TU-MAIL@dominio.com"
```
