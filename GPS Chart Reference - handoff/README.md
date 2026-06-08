# GPS Chart Reference — Handoff e integración

Paquete de **diseño de referencia** (look objetivo) para el módulo **GPS Analysis**
de ClavaMetrics: tipos de gráfico profesionales, formato condicional de tablas,
barra de filtros del dashboard y el panel "Agregar gráfico" con plantillas
científicas.

> Es **diseño visual de referencia**. La conexión a datos la hace tu código —
> estos archivos definen el *look objetivo* y traen datos ilustrativos para verlo.

---

## 1. Qué hay en este paquete

| Archivo | Sección | Para qué sirve |
|---|---|---|
| `GPS Chart Reference.html` | — | Página contenedora. Abre todas las secciones con tabs. |
| `chart-reference.css` | 1–4 | Estilos: bar, line/temporal, scatter, ranking + KPI. |
| `chart-reference.js` | 1–4 | Render + **datos ilustrativos** de esos gráficos. |
| `table-format.css` | 5 | Estilos: tabla con formato condicional (estilo Power BI). |
| `table-format.js` | 5 | Render de la tabla + panel de reglas por columna. |
| `filter-bar.css` | 6 | Estilos: barra de filtros del dashboard (pills + dropdowns). |
| `filter-bar.js` | 6 | Render de los estados de la barra de filtros. |
| `add-chart.css` | 7 | Estilos: panel "Agregar gráfico" + galería de plantillas. |
| `add-chart.js` | 7 | Render del panel + **array de plantillas científicas**. |
| `ref-icons.js` | — | Fallback de íconos en SVG (ver sección 5). |

**Dependencias que YA están en tu proyecto** (no se incluyen acá):
`clavametrics.css` (tokens + tema `hybrid`) y los íconos **Tabler**.

---

## 2. Integración en VS Code (paso a paso)

1. **Copiá los archivos** a tu proyecto. Recomendado, una carpeta propia:

   ```
   /assets/chart-reference/
     ├─ chart-reference.css
     ├─ chart-reference.js
     ├─ table-format.css
     ├─ table-format.js
     ├─ filter-bar.css
     ├─ filter-bar.js
     ├─ add-chart.css
     ├─ add-chart.js
     └─ ref-icons.js
   ```

   Y `GPS Chart Reference.html` donde tengas el resto de tus páginas.

2. **Verificá los `<link>` y `<script>`** en `GPS Chart Reference.html`.
   Si los moviste a `/assets/chart-reference/`, ajustá las rutas:

   ```html
   <!-- en <head>, DESPUÉS de clavametrics.css -->
   <link rel="stylesheet" href="clavametrics.css">
   <link rel="stylesheet" href="assets/chart-reference/chart-reference.css">
   <link rel="stylesheet" href="assets/chart-reference/table-format.css">
   <link rel="stylesheet" href="assets/chart-reference/filter-bar.css">
   <link rel="stylesheet" href="assets/chart-reference/add-chart.css">

   <!-- al final de <body>, ref-icons.js PRIMERO -->
   <script src="assets/chart-reference/ref-icons.js"></script>
   <script src="assets/chart-reference/chart-reference.js"></script>
   <script src="assets/chart-reference/table-format.js"></script>
   <script src="assets/chart-reference/filter-bar.js"></script>
   <script src="assets/chart-reference/add-chart.js"></script>
   ```

3. **Abrí la página** con Live Server (o tu dev server) para verla.
   Cada sección se monta sola en su `<div id="...Section">`.

> **Orden importa:** `clavametrics.css` va antes que los CSS de referencia
> (heredan sus tokens), y `ref-icons.js` va antes que el resto de los scripts.

---

## 3. Cómo está organizado (data-driven)

Todo el contenido sale de **arrays de datos** al tope de cada `*.js`. El render
es genérico: cambiás los datos, no la lógica.

- **Secciones 1–4** → `chart-reference.js`: `SINGLE`, `MULTI`, `COMBO`,
  `LINE_MULTI`, `LINE_AREA`, `SCATTER`, `RANK`, `KPI`, `KSTRIP`.
- **Sección 5** → `table-format.js`: `COLS` (columnas y su modo de formato) y
  `PLAYERS`.
- **Sección 6** → `filter-bar.js`: `MD_OPTS`, `POS_OPTS`, `PLAYER_OPTS`.
- **Sección 7** → `add-chart.js`: `TPLS` (plantillas científicas).

---

## 4. ➕ Agregar una PLANTILLA científica nueva (lo que vas a hacer más seguido)

Abrí **`add-chart.js`** y buscá el array **`TPLS`** (tiene el esquema documentado
arriba). Copiá este bloque, pegalo dentro de `TPLS` y completá los campos:

```js
{
  id: 'mi-grafico',                       // único, sin espacios
  nm: 'Nombre del gráfico',               // título de la card
  ds: 'Qué muestra, en una línea.',       // descripción corta
  cite: 'Autor AÑO',                      // pill de cita (ej. 'Gabbett 2016')
  type: 'Línea + banda',                  // tipo de gráfico (texto del pie)
  icon: 'ti-chart-line',                  // ícono Tabler (prefijo ti-)
  color: 'var(--cm-info)',                // token --cm-* o cualquier color CSS
  info: 'suele usarse en …',              // etiqueta gris (solo informativa)
  demoOpen: false,                        // true = abre su popover de referencia
  ref: {                                  // contenido del popover científico
    title: 'Título de la referencia',
    author: 'Apellido, X. (AÑO) · Publicación',
    body: 'Explicación breve del método y cómo se lee.',
    doi: '10.xxxx/xxxxx',                 // o '—' si no aplica
  },
},
```

No tenés que tocar nada más: la grilla, la pill de cita, la etiqueta de contexto,
el botón **Agregar** y el popover se arman solos. La grilla es de 3 columnas y
hace wrap, así que entran tantas plantillas como agregues.

**Colores sugeridos** (tokens del design system):
`--cm-accent` (verde) · `--cm-info` (azul) · `--cm-violet` · `--cm-success` ·
`--cm-warning` · `--cm-danger` · `--cm-neutral` (gris).

---

## 5. Íconos: producción vs. esta página de referencia

- **En tu proyecto (producción)** los íconos **Tabler** funcionan normal: usá
  cualquier nombre de https://tabler.io/icons con la clase `ti ti-NOMBRE`.
- **En esta página de referencia abierta sola**, el entorno suele bloquear la
  webfont de Tabler, así que `ref-icons.js` redibuja cada `<i class="ti ti-…">`
  como **SVG inline**. Si usás un ícono que no está en su diccionario, dibuja un
  **punto neutro** como fallback (no se rompe nada).

**¿Querés que un ícono nuevo se vea idéntico también acá?** Abrí `ref-icons.js`,
buscá el objeto `I = { … }` y agregá una entrada con el path del ícono Tabler:

```js
// nombre SIN el prefijo ti-
'mi-icono': ['p:M5 12l5 5l9 -9'],   // 'p:'=path d · 'c:cx,cy,r'=círculo · 'l:x1,y1,x2,y2'=línea
```

> En producción esto es opcional — con Tabler cargando, no hace falta.

---

## 6. ➕ Agregar un TIPO de gráfico nuevo (secciones 1–4)

Si más adelante querés un tipo de gráfico nuevo en el reference (ej. un radar):

1. En **`chart-reference.css`** agregá las clases del gráfico nuevo.
2. En **`chart-reference.js`** agregá su función `render…()` y su array de datos.
3. Sumá un tab al `ref-nav` y un `<div class="ref-sec" data-sec="…">` en el HTML,
   más un `id` contenedor que tu build use (mirá cómo lo hacen las otras
   secciones, el patrón se repite igual).

El switch de tabs ya es genérico (`data-sec`), no hay que tocarlo.

---

## 7. Notas

- **Tokens, no colores sueltos.** Todo usa variables `--cm-*` de
  `clavametrics.css`. Si cambia el design system, estas referencias siguen.
- **Sin librerías externas.** Los gráficos son HTML/CSS/SVG puro. No hay
  Chart.js ni dependencias.
- **Tema.** Hereda `data-theme="hybrid"` del `<html>`. Funciona en los demás
  temas del sistema porque todo sale de tokens.
