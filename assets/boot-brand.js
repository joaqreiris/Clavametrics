/* ─────────────────────────────────────────────────────────────────────────
   boot-brand.js — pinta la marca del club ANTES del primer frame.

   El problema que resuelve: el color de acento, el nombre y el escudo del
   club salen de la base. Hasta que llegaba esa respuesta, la página ya se
   había pintado con el acento por defecto del tema, el nombre vacío y un
   cuadrado en lugar del escudo — y después todo cambiaba de golpe delante
   del usuario.

   Este script se carga SÍNCRONO en el <head>, antes de cualquier CSS de
   página, y aplica lo último que se supo del club (guardado por getClub()
   en localStorage). Cuando la respuesta real llega, casi siempre coincide y
   no se ve ningún salto; si cambió, se corrige sin que nadie lo note.

   No hace peticiones, no depende de nada y falla en silencio: si no hay
   cache, la página arranca como antes.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var c;
  try { c = JSON.parse(localStorage.getItem('cm_brand_cache') || 'null'); } catch (e) { return; }
  if (!c) return;

  // 1. Acento — mismo cálculo que applyClubTheme(), pero sin esperar a la red.
  var hex = c.primary_color;
  if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    var s = document.documentElement.style;
    s.setProperty('--cm-accent', hex);
    s.setProperty('--cm-accent-rgb', r + ',' + g + ',' + b);
  }

  // 2. Nombre y escudo — el sidebar se inyecta después, así que se dejan a
  //    mano en window para que los pinte ya rellenos en vez de vacíos.
  window.__cmBrandBoot = { name: c.name || '', logo_url: c.logo_url || '' };
})();
