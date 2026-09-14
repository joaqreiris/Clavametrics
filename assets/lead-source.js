/* lead-source.js — de dónde vino el club.
 *
 * Se carga en las páginas públicas (Home, Pricing, Contact, Login, Register) y
 * guarda el origen de la PRIMERA visita en localStorage. Register.html y
 * auth-callback.html lo leen al crear el club y lo escriben en clubs.utm_*.
 *
 * First-touch, no last-touch: si alguien llega por un anuncio, se va a pensarlo
 * y vuelve tres días después escribiendo la URL a mano, el que trajo ese club
 * fue el anuncio. Sobrescribir en cada visita le regalaría la venta al canal
 * "directo" y haría imposible saber qué campaña conviene pagar.
 *
 * Sin cookies ni terceros: es localStorage del propio dominio y lo único que
 * guarda es de qué enlace vino la persona.
 */
(function () {
  'use strict';

  var KEY = 'cm_lead_source';
  var CAMPOS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  // Un valor de UTM largo es basura o un intento de inyección: se recorta.
  function limpiar(v) {
    if (v == null) return null;
    var s = String(v).trim().slice(0, 120);
    return s || null;
  }

  function leer() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }

  function capturar() {
    var params = new URLSearchParams(location.search);
    var datos = {};
    var tieneUtm = false;

    CAMPOS.forEach(function (k) {
      var v = limpiar(params.get(k));
      if (v) { datos[k] = v; tieneUtm = true; }
    });

    // gclid/fbclid llegan sin utm_source cuando el anuncio se armó sin etiquetar.
    // Sin esto, media campaña de Google o Meta cae en "directo".
    if (!datos.utm_source) {
      if (params.get('gclid')) { datos.utm_source = 'google'; datos.utm_medium = datos.utm_medium || 'cpc'; tieneUtm = true; }
      else if (params.get('fbclid')) { datos.utm_source = 'facebook'; datos.utm_medium = datos.utm_medium || 'social'; tieneUtm = true; }
    }

    var ref = '';
    try { ref = document.referrer || ''; } catch (_e) {}
    // Un referrer de nuestro propio dominio es navegación interna, no un origen.
    var externo = ref && ref.indexOf(location.origin) !== 0;

    if (!tieneUtm && !externo) return;   // visita directa sin nada que contar

    datos.referrer = externo ? limpiar(ref) : null;
    datos.landing_page = limpiar(location.pathname + location.search);
    datos.first_seen_at = new Date().toISOString();

    try { localStorage.setItem(KEY, JSON.stringify(datos)); } catch (_e) {}
  }

  // Lo que Register/auth-callback escriben en la fila de clubs. Devuelve un objeto
  // vacío si no hay nada: el insert no debe fallar por no tener atribución.
  window.cmLeadSource = function () {
    var d = leer();
    if (!d) return {};
    var out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landing_page']
      .forEach(function (k) { if (d[k]) out[k] = d[k]; });
    return out;
  };

  // El origen ya cumplió su función al crear el club; no hace falta conservarlo.
  window.cmClearLeadSource = function () {
    try { localStorage.removeItem(KEY); } catch (_e) {}
  };

  if (!leer()) capturar();
})();
