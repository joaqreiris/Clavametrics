// @ts-check
// El menú de Settings tenía dos entradas que se leían como repetidas —«Rehab / individual /
// top-up» y «Tag periods»— y que en realidad son el mismo trabajo a dos niveles: la sesión
// entera de un jugador, o cada tramo de la sesión. Ahora es una sola entrada con dos pestañas,
// abriendo en «por período», que es la que se usa a diario.
//
// Y «Manual data» pasó de la barra de acciones al menú: es configuración, no algo de cada visita.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// Dos días con períodos: uno viejo y el último. El panel tiene que abrir en el último.
const VIEJO = daysAgo(40), ULTIMO = daysAgo(2);
const SESSIONS = [
  { id: 's-old', club_id: CLUB_ID, session_date: VIEJO,  session_type: 'training', team_id: null, microcycle_id: null, is_historical: false },
  { id: 's-new', club_id: CLUB_ID, session_date: ULTIMO, session_type: 'training', team_id: null, microcycle_id: null, is_historical: false },
];
const PLAYERS = [{ id: 'p1', club_id: CLUB_ID, first_name: 'Ana', last_name: 'Alfa', number: 5, position: 'CB', positions: ['CB'], status: 'active' }];

async function abrir(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true }] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    const ord = [...SESSIONS].sort((a, b) => b.session_date.localeCompare(a.session_date));
    return r.fulfill({ json: one ? ord[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  // Sólo la sesión más reciente tiene períodos: es la fecha en la que el panel debe abrir.
  await page.route(`${SB}/rest/v1/gps_period_reports**`, r =>
    r.fulfill({ json: [{ session_id: 's-new' }] }));
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.waitForTimeout(900);
}

const menu = async (page) => {
  await page.click('#gpGearBtn');
  await page.waitForTimeout(400);
  return page.evaluate(() => [...document.querySelectorAll('.gp-popover .gp-popover-item')]
    .map(b => (b.textContent || '').trim()).filter(Boolean));
};

test.describe('GPS · menú de Settings', () => {
  test('una sola entrada para etiquetar, no dos que parecen lo mismo', async ({ page }) => {
    await abrir(page);
    const items = await menu(page);
    const etiquetar = items.filter(t => /rehab/i.test(t) || /tag periods/i.test(t));
    expect(etiquetar).toHaveLength(1);
  });

  test('«Manual data» vive en el menú, no en la barra de acciones', async ({ page }) => {
    await abrir(page);
    // Sigue en el DOM (el menú lo dispara por id) pero no se ve arriba.
    expect(await page.locator('#gpManualBtn').isVisible()).toBe(false);
    expect((await menu(page)).some(t => /manual data|datos manuales/i.test(t))).toBe(true);
  });

  test('el panel abre en «por período» y en el último día con datos, no dos meses atrás', async ({ page }) => {
    await abrir(page);
    await page.click('#gpGearBtn');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.gp-popover .gp-popover-item')]
        .find(x => /rehab/i.test(x.textContent || ''));
      b?.click();
    });
    await page.waitForSelector('#tagBody', { timeout: 10_000 });
    await page.waitForTimeout(1200);
    // Las dos pestañas están, y arranca en la de períodos.
    expect(await page.locator('#tagTabPeriod').isVisible()).toBe(true);
    expect(await page.locator('#tagTabSession').isVisible()).toBe(true);
    const fechas = await page.evaluate(() =>
      [...document.querySelectorAll('#tagBody input[type="date"]')].map(i => i.value));
    expect(fechas.length).toBeGreaterThan(0);
    // Ninguna arranca dos meses atrás: todas en el último día con datos.
    for (const f of fechas) expect(f).toBe(ULTIMO);
  });
});
