const CACHE_VERSION = 'clava-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Solo assets inmutables. NUNCA cachear HTML ni llamadas a Supabase.
const PRECACHE = [
  '/clavametrics.css',
  '/assets/clava-app-192.png',
  '/assets/clava-app-512.png',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // activar la nueva versión enseguida
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1) NUNCA tocar Supabase ni APIs: siempre red directa
  if (url.hostname.includes('supabase') || url.hostname.includes('api.') || e.request.method !== 'GET') {
    return; // deja pasar a la red sin interferir
  }

  // 2) HTML / navegación: network-first (siempre la última versión)
  const isHTML = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // 2b) JS/CSS/JSON del mismo origen: network-first (evita scripts y traducciones
  //     pegados a una versión vieja — locales/*.json DEBE ser siempre el último).
  const isCode = url.origin === self.location.origin && /\.(js|css|json)$/i.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 3) Assets estáticos del mismo origen (png, fuentes): cache-first con refresco en segundo plano
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(STATIC_CACHE).then(c => c.put(e.request, copy));
          }
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
  // 4) Todo lo demás (CDNs externos): no interferir
});
