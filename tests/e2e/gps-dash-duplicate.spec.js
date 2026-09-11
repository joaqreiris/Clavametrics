// @ts-check
// Duplicar un dashboard tiene que traerse sus cards. Se duplicaba el dashboard pero la copia
// quedaba vacía.
//
// El test captura lo que se manda a la base, así que ve exactamente qué se copia y qué no —que
// era el problema: el insert de las cards no miraba si había fallado.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const SRC = 'aaaaaaaa-1111-4111-8111-111111111111';
const NUEVO = 'bbbbbbbb-2222-4222-8222-222222222222';

const DASH = { id: SRC, club_id: CLUB_ID, report_type: null, name: 'Mi tablero', scope: 'squad',
  is_shared: true, created_by: 'user-1', owner_id: null, sort_order: 3, team_id: null };
const CARDS = [0, 1, 2].map(i => ({
  id: `card-${i}`, dashboard_id: SRC, position: i, source: 'builder', size: 'lg',
  config: { schema: 'gp.card/v1', title: `Card ${i}`, viz: 'bars', scope: { level: 'squad' },
            metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
            range: { type: 'season' }, style: { color: '#15803D' } },
}));

async function abrir(page) {
  await page.addInitScript(() => { window.__insCards = []; window.__insDash = []; });
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true }] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: [] }));

  await page.route(`${SB}/rest/v1/dashboards**`, async (r) => {
    const req = r.request();
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      await page.evaluate((b) => window.__insDash.push(b), body);
      return r.fulfill({ json: { id: NUEVO, name: body.name } });
    }
    const acc = req.headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });

  await page.route(`${SB}/rest/v1/dashboard_cards**`, async (r) => {
    const req = r.request();
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '[]');
      await page.evaluate((b) => window.__insCards.push(...(Array.isArray(b) ? b : [b])), body);
      return r.fulfill({ json: body });
    }
    const url = new URL(req.url());
    const filtro = url.searchParams.get('dashboard_id') || '';
    const id = (filtro.match(/^eq\.(.+)$/) || [])[1];
    return r.fulfill({ json: id === SRC ? CARDS : [] });
  });

  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.waitForTimeout(900);
}

test.describe('GPS · duplicar un dashboard', () => {
  test('la copia se lleva las tres cards del original', async ({ page }) => {
    await abrir(page);
    await page.evaluate(async ([src, club]) =>
      window.duplicateDashboard(src, club, 'user-1', window.sb), [SRC, CLUB_ID]);
    await page.waitForTimeout(600);
    const cards = await page.evaluate(() => window.__insCards);
    expect(cards).toHaveLength(3);
    expect(cards.every(c => c.dashboard_id === NUEVO)).toBe(true);
    expect(cards.map(c => c.config.title).sort()).toEqual(['Card 0', 'Card 1', 'Card 2']);
  });

  test('si la base rechaza las cards, la duplicación avisa en vez de dejar una copia vacía', async ({ page }) => {
    await abrir(page);
    // La base dice que no a las cards: es el caso que quedaba mudo.
    await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.request().method() === 'POST'
      ? r.fulfill({ status: 403, json: { message: 'permission denied for table dashboard_cards' } })
      : r.fulfill({ json: CARDS }));
    const err = await page.evaluate(async ([src, club]) => {
      try { await window.duplicateDashboard(src, club, 'user-1', window.sb); return null; }
      catch (e) { return String(e.message || e); }
    }, [SRC, CLUB_ID]);
    expect(err, 'la copia falló en silencio').not.toBeNull();
    expect(err).toMatch(/card/i);
  });

  test('la copia conserva el tipo del original', async ({ page }) => {
    await abrir(page);
    await page.evaluate(async ([src, club]) =>
      window.duplicateDashboard(src, club, 'user-1', window.sb), [SRC, CLUB_ID]);
    const creado = await page.evaluate(() => window.__insDash[0]);
    expect(creado).toHaveProperty('report_type', DASH.report_type);
  });

  // El de verdad: duplicar desde el menú de la pestaña y mirar lo que queda en pantalla. Los de
  // arriba prueban que la copia llega bien a la base; éste, que además se VE.
  test('la pestaña nueva muestra las cards, no queda vacía', async ({ page }) => {
    await abrir(page);
    // Las cards de la copia ya están en la base cuando la vista nueva las pida.
    await page.route(`${SB}/rest/v1/dashboard_cards**`, async (r) => {
      const req = r.request();
      if (req.method() === 'POST') return r.fulfill({ json: JSON.parse(req.postData() || '[]') });
      const id = ((new URL(req.url()).searchParams.get('dashboard_id') || '').match(/^eq\.(.+)$/) || [])[1];
      const copia = CARDS.map((c, i) => ({ ...c, id: `copia-${i}`, dashboard_id: NUEVO }));
      return r.fulfill({ json: id === SRC ? CARDS : id === NUEVO ? copia : [] });
    });

    await page.evaluate(() => {
      const kb = document.querySelector('#sections .gp-sec[data-custom] .gpt-kb');
      kb?.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-act="duplicate"]')][0];
      b?.click();
    });
    await page.waitForTimeout(2500);

    const vista = await page.evaluate((nuevo) => {
      const v = document.querySelector(`.gp-view[data-view="db-${nuevo}"]`);
      return { existe: !!v, activa: !!v?.classList.contains('is-on'),
               cards: v ? v.querySelectorAll('.gp-c[data-card-id]').length : -1,
               contador: document.querySelector(`#sections .gp-sec[data-view="db-${nuevo}"] .sub`)?.textContent?.trim() || null };
    }, NUEVO);
    expect(vista.existe, 'no se creó la pestaña').toBe(true);
    expect(vista.cards, 'la copia quedó vacía en pantalla').toBe(3);
    expect(vista.contador).toMatch(/3/);
  });

  // «Con filtros y todo incluido»: los filtros no viven con las cards sino aparte, por tablero.
  // Sin copiarlos, la copia quedaba con las mismas cards pero mostrando otra cosa.
  test('la copia se lleva también los filtros del original', async ({ page }) => {
    await page.addInitScript((src) => {
      localStorage.setItem(`cm_gpfilters_user-1_db-${src}`,
        JSON.stringify({ md_code: ['MD-3'], player: ['p9'], position: [], microcycle: [],
                         rival: [], session_type: [], work_context: [], visibleFilters: ['date', 'md_code'] }));
    }, SRC);
    await abrir(page);
    await page.evaluate(() => document.querySelector('#sections .gp-sec[data-custom] .gpt-kb')?.click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-act="duplicate"]')?.click());
    await page.waitForTimeout(2000);

    const copiado = await page.evaluate((nuevo) => {
      const raw = localStorage.getItem(`cm_gpfilters_user-1_db-${nuevo}`);
      return raw ? JSON.parse(raw) : null;
    }, NUEVO);
    expect(copiado, 'la copia arrancó sin filtros').not.toBeNull();
    expect(copiado.md_code).toEqual(['MD-3']);
    expect(copiado.player).toEqual(['p9']);
  });

  test('sin filtros en el original, la copia arranca limpia y no rompe nada', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => document.querySelector('#sections .gp-sec[data-custom] .gpt-kb')?.click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-act="duplicate"]')?.click());
    await page.waitForTimeout(1800);
    const hayPestana = await page.evaluate((nuevo) =>
      !!document.querySelector(`.gp-view[data-view="db-${nuevo}"]`), NUEVO);
    expect(hayPestana).toBe(true);
  });
});

