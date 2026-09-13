// @ts-check
import { test, expect } from '@playwright/test';
import { SB } from './_shared.js';

const FN = `${SB}/functions/v1/share-video`;
const TOKEN = '11111111-2222-3333-4444-555555555555';

// Dos cortes que se miden distinto: el de Dropbox va en un <video> nuestro (se
// puede medir la reproducción) y el de Drive en su iframe (sólo tiempo en pantalla).
const SHARE = {
  found: true,
  share: {
    title: 'Salida de balón', message: 'Mirá los dos cortes antes del jueves.',
    from: 'Profe', created_at: '2026-09-10T10:00:00Z', expires_at: null, seen_at: null,
    club: 'Test FC', player: { first_name: 'Lucas', last_name: 'García', number: 10 },
    clips: [
      {
        title: 'Presión tras pérdida', provider: 'dropbox', kind: 'video',
        thumbnail_url: null, duration_seconds: 60, comment: 'Fijate el cuerpo perfilado',
        start_seconds: null,
        embed: 'https://dl.dropboxusercontent.com/s/abc/clip.mp4?raw=1',
        embed_kind: 'file',
        open: 'https://www.dropbox.com/s/abc/clip.mp4?dl=0',
      },
      {
        title: 'Salida desde el arquero', provider: 'google_drive', kind: 'video',
        thumbnail_url: null, duration_seconds: 90, comment: null, start_seconds: null,
        embed: 'https://drive.google.com/file/d/FILEID/preview',
        embed_kind: 'frame',
        open: 'https://drive.google.com/file/d/FILEID/view',
      },
    ],
  },
};

/** Atiende la Edge Function y guarda los beats de progreso que manda la página. */
async function mockShare(page, beats) {
  await page.route(FN, route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.action === 'progress') {
      beats.push(body);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: SHARE });
  });
  // El iframe de Drive no se carga de verdad: no hace falta y evita salir a la red.
  await page.route('https://drive.google.com/**', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  // El mp4 queda pedido y sin responder: así el <video> existe y no dispara 'error'
  // (que es lo que en producción lo reemplaza por "abrilo en Dropbox"). El reloj se
  // le dicta desde el test, que es lo que se quiere medir acá.
  await page.route('https://dl.dropboxusercontent.com/**', () => {});
}

/**
 * Simula lo que reporta un reproductor de verdad: el navegador no puede cargar el
 * mp4 en el test, así que se le dicta el reloj y se disparan sus eventos.
 */
async function playClip(page, { from, to, step = 0.5, duration = 60, andPause = true }) {
  await page.evaluate(({ from, to, step, duration, andPause }) => {
    const el = document.querySelector('video[data-clip="0"]');
    let t = from;
    Object.defineProperty(el, 'duration', { value: duration, configurable: true });
    Object.defineProperty(el, 'currentTime', { get: () => t, set: v => { t = v; }, configurable: true });
    el.dispatchEvent(new Event('loadedmetadata'));
    el.dispatchEvent(new Event('play'));
    for (; t <= to + 1e-9; t += step) el.dispatchEvent(new Event('timeupdate'));
    if (andPause) el.dispatchEvent(new Event('pause'));   // el pause fuerza el envío
  }, { from, to, step, duration, andPause });
}

test.describe('Link del jugador · control de visionado', () => {
  test('el corte de Dropbox se reproduce en un <video> propio, no en un iframe', async ({ page }) => {
    await mockShare(page, []);
    await page.goto(`/video-share?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('video[data-clip="0"]')).toHaveCount(1);
    await expect(page.locator('iframe[data-clip="1"]')).toHaveCount(1);
    // El de Dropbox no ofrece el archivo original ni el botón de descarga del navegador.
    await expect(page.locator('video[data-clip="0"]')).toHaveAttribute('controlslist', /nodownload/);
    await expect(page.locator('.clip-acts')).toHaveCount(0);
  });

  test('la reproducción real viaja medida y el resto, como tiempo en pantalla', async ({ page }) => {
    const beats = [];
    await mockShare(page, beats);
    await page.goto(`/video-share?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('video[data-clip="0"]')).toHaveCount(1);

    await playClip(page, { from: 0, to: 20 });
    await expect.poll(() => beats.length, { timeout: 8000 }).toBeGreaterThan(0);

    const items = beats.at(-1).items;
    const dropbox = items.find(i => i.index === 0);
    expect(dropbox.tracking).toBe('player');
    expect(dropbox.watched).toBe(20);
    expect(dropbox.position).toBe(20);
    expect(dropbox.completed).toBe(false);
    expect(dropbox.plays).toBe(1);

    // El de Drive no reporta reproducción: sólo puede decir que estuvo a la vista.
    const drive = items.find(i => i.index === 1);
    if (drive) {
      expect(drive.tracking).toBe('viewport');
      expect(drive.watched).toBe(0);
      expect(drive.visible).toBeGreaterThan(0);
    }

    // Todos los beats de una misma apertura comparten sesión: el servidor usa eso
    // para no sumar dos veces lo mismo.
    expect(beats.every(b => b.session && b.session === beats[0].session)).toBe(true);
    expect(beats.every(b => b.token === TOKEN)).toBe(true);
  });

  test('llegar al final del corte queda marcado como completo', async ({ page }) => {
    const beats = [];
    await mockShare(page, beats);
    await page.goto(`/video-share?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('video[data-clip="0"]')).toHaveCount(1);

    await playClip(page, { from: 0, to: 30, andPause: false });
    await page.evaluate(() => document.querySelector('video[data-clip="0"]').dispatchEvent(new Event('ended')));
    await expect.poll(() => beats.length, { timeout: 8000 }).toBeGreaterThan(0);

    const dropbox = beats.at(-1).items.find(i => i.index === 0);
    expect(dropbox.completed).toBe(true);
    expect(dropbox.position).toBe(60);      // el fin del video, no donde iba el reloj
    expect(dropbox.watched).toBe(30);       // y sin inflar el tiempo realmente visto
  });

  test('arrastrar la barra hasta el final no cuenta como haberlo mirado', async ({ page }) => {
    const beats = [];
    await mockShare(page, beats);
    await page.goto(`/video-share?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('video[data-clip="0"]')).toHaveCount(1);

    await page.evaluate(() => {
      const el = document.querySelector('video[data-clip="0"]');
      let t = 0;
      Object.defineProperty(el, 'duration', { value: 60, configurable: true });
      Object.defineProperty(el, 'currentTime', { get: () => t, set: v => { t = v; }, configurable: true });
      el.dispatchEvent(new Event('loadedmetadata'));
      el.dispatchEvent(new Event('play'));
      el.dispatchEvent(new Event('timeupdate'));
      t = 58;                                  // salto al final
      el.dispatchEvent(new Event('timeupdate'));
      el.dispatchEvent(new Event('pause'));
    });
    await expect.poll(() => beats.length, { timeout: 8000 }).toBeGreaterThan(0);

    const dropbox = beats.at(-1).items.find(i => i.index === 0);
    expect(dropbox.watched).toBe(0);
    expect(dropbox.position).toBe(58);
  });

  test('la página del jugador no le muestra nada del seguimiento', async ({ page }) => {
    const beats = [];
    await mockShare(page, beats);
    await page.goto(`/video-share?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('video[data-clip="0"]')).toHaveCount(1);
    await playClip(page, { from: 0, to: 5 });
    await expect.poll(() => beats.length, { timeout: 8000 }).toBeGreaterThan(0);

    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/%|seguimiento|tracking|watched \d/i);
    // Lo único que se le ofrece sobre el visionado sigue siendo el botón de siempre.
    await expect(page.locator('#seenBtn')).toBeVisible();
  });
});

test('si el archivo no se puede reproducir, el jugador no queda en negro', async ({ page }) => {
  await page.route(FN, route => route.fulfill({ json: SHARE }));
  await page.route('https://drive.google.com/**', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await page.route('https://dl.dropboxusercontent.com/**', route => route.abort());
  await page.goto(`/video-share?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });

  // El <video> roto se reemplaza por el marco de siempre y el botón del proveedor.
  await expect(page.locator('article.clip').first().locator('.frame.is-fallback')).toBeVisible();
  await expect(page.locator('article.clip').first().locator('.clip-acts a')).toHaveAttribute('href', /dropbox\.com/);
});
