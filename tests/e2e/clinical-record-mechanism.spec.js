// @ts-check
// La ficha clínica y la taxonomía del mecanismo de lesión.
//
// Existe por la migración 149, que dejó UNA sola columna (injuries.mechanism) y borró el enum
// injury_mechanism. Dos cosas se pueden romper en silencio y ninguna da error visible:
//
//   · que alguien vuelva a pedir la columna borrada en un select — PostgREST devuelve 400 y la
//     pantalla se dibuja vacía, sin excepción en consola;
//   · que se caiga el <script> de assets/injury-mechanism.js de esta página — mechLabel deja de
//     resolver y todas las lesiones muestran «—».
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test('Clinical Record carga y resuelve el mecanismo', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|net::ERR/i.test(m.text())) errs.push('console: ' + m.text()); });

  const ADMIN = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: 'Owner', full_name: 'T' };
  const USER = { id: 'user-1', email: 'a@b.c', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', token_type: 'bearer', expires_in: 3600, refresh_token: 'rt', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));
  const pedidas = [];
  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url(), acc = route.request().headers()['accept'] || '';
    pedidas.push(url);
    if (url.includes('/profiles')) return route.fulfill({ json: acc.includes('pgrst.object') ? ADMIN : [ADMIN] });
    if (url.includes('/clubs')) return route.fulfill({ json: acc.includes('pgrst.object') ? { id: 'club-1', name: 'T' } : [{ id: 'club-1', name: 'T' }] });
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));
  // Sin esto la página se va a Plan Picker y no se prueba nada.
  const FEATS = ['clinical_records', 'injuries', 'treatments', 'rehab'];
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: FEATS }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: FEATS }));

  await injectSession(page);
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('/Clinical%20Record.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  expect(decodeURIComponent(new URL(page.url()).pathname), 'la página redirigió: el resto del test mentiría').toContain('Clinical Record');

  // 1 · La taxonomía compartida está disponible en la página.
  const ok = await page.evaluate(() => typeof window.cmInjuryMechanism === 'function'
    && window.cmInjuryMechanism({ mechanism: 'non-contact' }) === 'non_contact');
  expect(ok, 'cmInjuryMechanism no está cargada en Clinical Record').toBe(true);

  // 2 · Nadie pide ya la columna borrada: un select con ella devuelve 400 y vacía la página.
  const pideBorrada = pedidas.filter(u => /injury_mechanism/.test(decodeURIComponent(u)));
  expect(pideBorrada, `consultas que aún piden injury_mechanism:\n${pideBorrada.join('\n')}`).toEqual([]);

  expect(errs, `\n${errs.join('\n')}\n`).toEqual([]);
});
