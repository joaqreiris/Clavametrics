// Subir esta versión en cada despliegue que cambie assets: al activarse borra
// los cachés de versiones anteriores.
const CACHE_VERSION = 'clava-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Lo que usa TODA página autenticada. Se baja en la instalación para que la
// primera navegación ya lo tenga. No se precachean los assets/pages/*.js
// (1,2 MB entre todos): esos entran al caché cuando se visita su página, así
// una instalación no descarga páginas que quizá nadie abra.
const PRECACHE = [
  '/clavametrics.css',
  '/assets/vendor/supabase-js-2.112.4.min.js',
  '/assets/supabase-init.js',
  '/assets/sidebar.js',
  '/assets/boot-brand.js',
  '/assets/clava-app-192.png',
  '/assets/clava-app-512.png',
  '/manifest.json'
];

// Recursos externos con la versión DENTRO de la URL (@1.2.3 o /1.2.3/): el
// contenido no puede cambiar bajo el mismo nombre, así que se sirven del caché
// sin preguntar. Se detecta por patrón en vez de por lista para no tener que
// mantener una: la app pide 16 librerías de tres CDN distintos (tabler, chart,
// react, papaparse, jspdf, xlsx, pdfjs, fabric…) y cualquiera que se agregue
// mañana queda cubierta sola.
//
// Antes NINGUNA se cacheaba, y la fuente de iconos —que se pide en las 39
// páginas— era la que hacía aparecer el menú con cuadrados vacíos.
const CDNS = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'];
const RE_VERSION = /@\d+\.\d+\.\d+|\/\d+\.\d+\.\d+\//;

function esInmutableExterno(url) {
  return CDNS.includes(url.hostname) && RE_VERSION.test(url.pathname);
}

// Cuánto se espera a la red antes de servir la copia guardada. Con conexión
// normal nunca se llega a este límite, así que el comportamiento es el de
// siempre: contenido fresco. Con conexión mala, la app abre igual en vez de
// quedarse en blanco.
const ESPERA_RED_MS = 2500;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c =>
      // addAll aborta entero si UNO falla; con allSettled un 404 en un archivo
      // no deja la instalación sin caché.
      Promise.allSettled(PRECACHE.map(u => c.add(u)))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function guardar(req, resp) {
  // Las respuestas opacas (CDN sin CORS) traen status 0 y son válidas igual.
  if (!resp || (resp.status !== 200 && resp.type !== 'opaque')) return resp;
  const copia = resp.clone();
  caches.open(STATIC_CACHE).then(c => c.put(req, copia)).catch(() => {});
  return resp;
}

// Red primero, pero sin esperar para siempre: si tarda más de ESPERA_RED_MS y
// hay copia guardada, se sirve la copia. La petición de red sigue en marcha y
// actualiza el caché para la próxima vez.
function redPrimeroConLimite(req) {
  return caches.match(req).then(guardada => {
    const red = fetch(req).then(r => guardar(req, r));
    if (!guardada) return red.catch(() => caches.match(req));
    return new Promise(resolve => {
      let resuelto = false;
      const listo = (r) => { if (!resuelto && r) { resuelto = true; resolve(r); } };
      const t = setTimeout(() => listo(guardada), ESPERA_RED_MS);
      red.then(r => { clearTimeout(t); listo(r); })
         .catch(() => { clearTimeout(t); listo(guardada); });
    });
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1) NUNCA tocar Supabase ni APIs: siempre red directa
  if (url.hostname.includes('supabase') || url.hostname.includes('api.') || e.request.method !== 'GET') {
    return;
  }

  // 2) El propio service worker: nunca servirlo del caché, o quedaría
  //    imposible de actualizar.
  if (url.pathname === '/service-worker.js') return;

  // 3) HTML / navegación: siempre la última versión. El caché es sólo la red
  //    de contención para cuando no hay conexión.
  const isHTML = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // 4) Librerías externas con la versión en la URL: del caché directo.
  if (esInmutableExterno(url)) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => guardar(e.request, r)))
    );
    return;
  }

  // 5) Traducciones: red primero SIN límite de espera. Servir un locales/*.json
  //    viejo deja media pantalla en otro idioma, y es preferible esperar.
  if (url.origin === self.location.origin && /^\/locales\/.*\.json$/i.test(url.pathname)) {
    e.respondWith(fetch(e.request).then(r => guardar(e.request, r)).catch(() => caches.match(e.request)));
    return;
  }

  // 6) JS/CSS/JSON propios: red primero con límite de espera. Con conexión
  //    normal se sigue sirviendo lo último —igual que antes—, pero una red
  //    lenta ya no deja la app esperando.
  if (url.origin === self.location.origin && /\.(js|css|json)$/i.test(url.pathname)) {
    e.respondWith(redPrimeroConLimite(e.request));
    return;
  }

  // 7) Resto de assets propios (imágenes, fuentes): caché primero, refresco
  //    por detrás.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(guardada => {
        const red = fetch(e.request).then(r => guardar(e.request, r)).catch(() => guardada);
        return guardada || red;
      })
    );
  }
  // 8) Cualquier otra cosa externa: no interferir.
});
