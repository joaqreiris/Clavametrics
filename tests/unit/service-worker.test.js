/**
 * service-worker.js — lo que llega a respondWith().
 *
 * El bug que motivó estos tests: `fetch().catch(() => caches.match(req))` con la
 * red caída y sin copia guardada resolvía a `undefined`, y el navegador cortaba
 * con "Failed to convert value to 'Response'" — la navegación fallaba entera en
 * vez de degradar.
 *
 * El SW no exporta nada (registra listeners sobre `self`), así que se evalúa el
 * archivo con stubs y se captura el handler de fetch.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SW = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../service-worker.js'), 'utf8');

function cargarSW({ red, enCache }) {
  let onFetch = null;
  const self = {
    addEventListener: (evt, cb) => { if (evt === 'fetch') onFetch = cb; },
    skipWaiting() {}, clients: { claim() {} },
    location: { origin: 'https://clavametrics.app' },
  };
  const caches = {
    match: async () => enCache,
    open: async () => ({ put: async () => {} }),
    keys: async () => [],
    delete: async () => {},
  };
  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', 'Response', 'URL', SW)(self, caches, red, Response, URL);
  return onFetch;
}

const pedido = (url, accept = 'text/html') => ({
  url, method: 'GET',
  mode: accept.includes('html') ? 'navigate' : 'cors',
  headers: { get: () => accept },
});

function responder(onFetch, req) {
  let out;
  onFetch({ request: req, respondWith: p => { out = p; } });
  return out;
}

describe('service worker · respondWith siempre recibe una Response', () => {
  const caida = async () => { throw new Error('offline'); };

  it('HTML con la red caída y sin copia guardada devuelve la página offline, no undefined', async () => {
    const onFetch = cargarSW({ red: caida, enCache: undefined });
    const r = await responder(onFetch, pedido('https://clavametrics.app/Daily%20Planning.html'));
    expect(r).toBeInstanceOf(Response);          // ← esto era `undefined` y rompía la navegación
    expect(r.status).toBe(503);
    expect(await r.text()).toContain('No connection');
  });

  it('un .js con la red caída y sin copia guardada tampoco devuelve undefined', async () => {
    const onFetch = cargarSW({ red: caida, enCache: undefined });
    const r = await responder(onFetch, pedido('https://clavametrics.app/assets/cm-lock.js', 'application/javascript'));
    expect(r).toBeInstanceOf(Response);
    expect(r.status).toBe(503);
  });

  it('una traducción con la red caída y sin copia guardada tampoco', async () => {
    const onFetch = cargarSW({ red: caida, enCache: undefined });
    const r = await responder(onFetch, pedido('https://clavametrics.app/locales/es.json', 'application/json'));
    expect(r).toBeInstanceOf(Response);
    expect(r.status).toBe(503);
  });

  it('con copia guardada se sirve la copia, no el fallback', async () => {
    const guardada = new Response('contenido viejo', { status: 200 });
    const onFetch = cargarSW({ red: caida, enCache: guardada });
    const r = await responder(onFetch, pedido('https://clavametrics.app/assets/cm-lock.js', 'application/javascript'));
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('contenido viejo');
  });

  it('con red sana gana la red', async () => {
    const onFetch = cargarSW({ red: async () => new Response('fresco', { status: 200 }), enCache: undefined });
    const r = await responder(onFetch, pedido('https://clavametrics.app/Calendar.html'));
    expect(await r.text()).toBe('fresco');
  });

  it('no intercepta las llamadas a Supabase', async () => {
    const onFetch = cargarSW({ red: caida, enCache: undefined });
    const r = responder(onFetch, pedido('https://xesrumijvdmqjrufgeka.supabase.co/rest/v1/players', 'application/json'));
    expect(r).toBeUndefined();   // no llamó a respondWith: la petición va directa a la red
  });
});
