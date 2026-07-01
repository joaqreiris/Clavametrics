# ClavaMetrics — Páginas para editar

Paquete autocontenido con las 4 páginas marcadas para editar, listas para abrir en VS Code.

## Páginas

| Archivo | Descripción | Estilos que usa |
|---|---|---|
| `Home.html` | Landing de marketing | `clavametrics.css`, `marketing.css`, `home.css` + JS |
| `Pricing.html` | Tarifas por categoría | `clavametrics.css` (resto en `<style>` interno) |
| `Contact.html` | Reservar demo / formulario | `clavametrics.css`, `marketing.css`, `contact.css` |
| `Plan Picker.html` | Selector de plan (dentro de la app) | `clavametrics.css` (resto en `<style>` interno) |

## Archivos de soporte

- **`clavametrics.css`** — Design system base (tokens, botones, inputs, temas). Lo usan las 4 páginas. Carga las fuentes **Geist / Geist Mono** y los iconos **Tabler** desde CDN (`@import` al inicio del archivo), así que **necesitas conexión a internet** para ver fuentes e iconos correctamente. No hace falta instalar nada.
- `marketing.css` — Nav, footer y secciones compartidas de marketing (Home + Contact).
- `home.css` — Estilos propios de la landing.
- `contact.css` — Estilos del formulario de contacto.
- `image-slot.js` — Componente para los huecos de imagen de la Home (arrastrar y soltar).
- `tweaks-panel.jsx` + `home-tweaks.jsx` — Panel de "Tweaks" opcional de la Home (React vía CDN). Si no lo necesitas puedes borrar esos 2 archivos y las etiquetas `<script ...tweaks...>` al final de `Home.html`.

## Cómo trabajar

1. Abre la carpeta `clavametrics-pages/` en VS Code.
2. Abre cualquier `.html` con **Live Server** (o ábrelo directo en el navegador).
3. Edita el HTML de cada página o los `.css` correspondientes.

> **Nota sobre enlaces internos:** las páginas enlazan entre sí (`Home → Pricing → Contact`, etc.) y también a otras pantallas del producto (`Product.html`, `Login.html`, `Register.html`, `Admin.html`, `Hub.html`…) que **no** están incluidas en este paquete. Esos enlaces darán 404 hasta que copies también esas páginas. Los enlaces entre las 4 páginas de aquí sí funcionan.

## Editar colores / tipografía globales

Casi todo se controla con variables `--cm-*` en `:root` dentro de `clavametrics.css`. Cambia ahí el acento, radios, fuentes o sombras y se aplica a las 4 páginas a la vez.
