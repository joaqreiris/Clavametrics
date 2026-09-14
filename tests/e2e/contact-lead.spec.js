// @ts-check
// El formulario de demo de Contact.html.
//
// Lo que importa acá es que el pedido no se pierda: que viaje a nuestra función con
// todo lo que ventas necesita, que el bot caiga en el honeypot y que, si la función
// falla, el visitante no se vaya pensando que mandó algo cuando no mandó nada.

import { test, expect } from '@playwright/test';

const LEAD_FN = 'https://xesrumijvdmqjrufgeka.supabase.co/functions/v1/submit-lead';
const FORMSPREE = 'https://formspree.io/f/**';

async function llenar(page, { phone = '+34600123456' } = {}) {
  await page.fill('#f-name',  'Ana Pérez');
  await page.fill('#f-email', 'ana@bigua.uy');
  await page.fill('#f-club',  'Bigúa');
  if (phone !== null) await page.fill('#f-phone', phone);
  await page.fill('#f-msg',   'Tenemos 4 categorías y usamos planillas.');
}

test.describe('Contact — pedido de demo', () => {

  test('el pedido viaja a la función con contacto y campaña', async ({ page }) => {
    let cuerpo = null;
    await page.route(LEAD_FN, route => {
      cuerpo = route.request().postDataJSON();
      route.fulfill({ json: { ok: true } });
    });
    await page.route(FORMSPREE, route => route.fulfill({ json: { ok: true } }));

    // Sin `.html`: el servidor de los tests redirige y pierde la query, que es
    // justo lo que este caso necesita para comprobar la atribución.
    await page.goto('/Contact?utm_source=instagram&utm_medium=cpc&utm_campaign=pretemporada');
    await llenar(page);
    await page.click('#ctForm button[type="submit"]');

    await expect.poll(() => cuerpo, { timeout: 10_000 }).not.toBeNull();
    expect(cuerpo.name).toBe('Ana Pérez');
    expect(cuerpo.email).toBe('ana@bigua.uy');
    expect(cuerpo.phone).toBe('+34600123456');
    expect(cuerpo.club).toBe('Bigúa');
    expect(cuerpo.leadSource.utm_source).toBe('instagram');
    expect(cuerpo.leadSource.utm_campaign).toBe('pretemporada');
    // El idioma en el que vio la página, para saber en cuál contestarle.
    expect(cuerpo.lang).toBeTruthy();

    await expect(page.locator('#ctCard')).toHaveClass(/is-sent/);
  });

  test('sin teléfono no se envía', async ({ page }) => {
    let llamada = false;
    await page.route(LEAD_FN, route => { llamada = true; route.fulfill({ json: { ok: true } }); });
    await page.route(FORMSPREE, route => route.fulfill({ json: { ok: true } }));

    await page.goto('/Contact.html');
    await llenar(page, { phone: null });
    await page.click('#ctForm button[type="submit"]');

    await expect(page.locator('#ctCard')).not.toHaveClass(/is-sent/);
    expect(llamada).toBe(false);
  });

  test('el honeypot está fuera de la pantalla y viaja vacío', async ({ page }) => {
    let cuerpo = null;
    await page.route(LEAD_FN, route => { cuerpo = route.request().postDataJSON(); route.fulfill({ json: { ok: true } }); });
    await page.route(FORMSPREE, route => route.fulfill({ json: { ok: true } }));

    await page.goto('/Contact.html');
    // Una persona no lo ve: está corrido fuera del viewport, no con display:none
    // (hay bots que saltean justamente lo que está oculto así).
    const caja = await page.locator('#f-website').boundingBox();
    expect(caja.x).toBeLessThan(0);

    await llenar(page);
    await page.click('#ctForm button[type="submit"]');
    await expect.poll(() => cuerpo, { timeout: 10_000 }).not.toBeNull();
    expect(cuerpo.website).toBe('');
  });

  test('si la función falla, Formspree salva el pedido', async ({ page }) => {
    await page.route(LEAD_FN, route => route.fulfill({ status: 500, json: { ok: false } }));
    await page.route(FORMSPREE, route => route.fulfill({ json: { ok: true } }));

    await page.goto('/Contact.html');
    await llenar(page);
    await page.click('#ctForm button[type="submit"]');

    // El visitante ve el "gracias" porque el pedido llegó igual por la copia.
    await expect(page.locator('#ctCard')).toHaveClass(/is-sent/, { timeout: 10_000 });
  });

  test('si fallan las dos vías, se avisa en vez de fingir que se envió', async ({ page }) => {
    await page.route(LEAD_FN, route => route.abort());
    await page.route(FORMSPREE, route => route.abort());

    const avisos = [];
    page.on('dialog', d => { avisos.push(d.message()); d.dismiss(); });

    await page.goto('/Contact.html');
    await llenar(page);
    await page.click('#ctForm button[type="submit"]');

    await expect.poll(() => avisos.length, { timeout: 10_000 }).toBe(1);
    await expect(page.locator('#ctCard')).not.toHaveClass(/is-sent/);
    // Y el botón vuelve a estar disponible para reintentar.
    await expect(page.locator('#ctForm button[type="submit"]')).toBeEnabled();
  });
});
