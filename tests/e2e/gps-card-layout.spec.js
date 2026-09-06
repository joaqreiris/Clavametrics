// @ts-check
// En un dashboard propio del usuario ("db-<uuid>") la POSICIÓN de cada card no vive en
// gps_dashboard_layouts: viaja dentro de su config (style.canvas). buildConfig() lo arma desde el
// estado del editor, que no conoce ese dato, así que guardar una edición borraba style.canvas y la
// card volvía a colocarse sola — encimada sobre las que sí conservaban sus coordenadas.
// Acá se edita una card colocada y se mira lo que REALMENTE se manda a la base.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
// Dashboard PROPIO del usuario: report_type que no mapea a las 5 vistas fijas → viewKey "db-<id>",
// y por eso su layout viaja dentro del config de cada card.
const CUSTOM = { id: 'dash-own', club_id: CLUB_ID, report_type: null, name: 'Session Report', scope: 'squad', sort_order: 5, is_shared: false, created_by: 'user-1' };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(4), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
const MCS = [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(9), end_date: daysAgo(3), match_date: daysAgo(3), rival: 'A', home_away: 'home' }];
const PLAYERS = [0, 1, 2].map(i => ({ id: 'p' + i, club_id: CLUB_ID, first_name: 'N' + i, last_name: 'Ape' + i, number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));
const REPORTS = PLAYERS.map((p, i) => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 6000 + i * 800, high_speed_distance: 300, very_high_speed_distance: 90, sprint_distance: 10,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

// La card ya está COLOCADA en el canvas: éstas son las coordenadas que no se pueden perder.
const CANVAS = { x: 3, y: 2, w: 6, h: 8, size: 'md' };
const CARD = { id: '22222222-2222-4222-8222-222222222222', position: 0, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Colocada', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
  range: { type: 'last30' }, style: { color: '#2563EB', size: 'md', canvas: CANVAS, span: 6 } } };

/** Monta el dashboard propio con las cards dadas y devuelve los PATCH que se manden a la base. */
async function mount(page, cards) {
  const patches = [];
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH, CUSTOM] });
  });
  // La "base": lo que la app manda por PATCH queda guardado y sale en el siguiente GET, para
  // poder recargar la página y ver con qué se encuentra.
  const db = new Map(cards.map(c => [c.id, c]));
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => {
    const req = r.request();
    if (req.method() === 'PATCH') {
      try {
        const body = JSON.parse(req.postData() || '{}');
        patches.push(body);
        const id = (req.url().match(/id=eq\.([^&]+)/) || [])[1];
        const row = id && db.get(id);
        if (row && body.config) db.set(id, { ...row, config: body.config, size: body.size || row.size });
      } catch { /* body no-JSON */ }
      return r.fulfill({ json: [{}] });
    }
    return r.fulfill({ json: [...db.values()] });
  });

  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  // Pasar al dashboard propio: es ahí donde la posición vive en el config de la card.
  await page.locator(`[data-view="db-${CUSTOM.id}"]`).first().click();
  await expect(page.locator(`.gp-view[data-view="db-${CUSTOM.id}"].is-on`)).toBeVisible({ timeout: 15_000 });
  return { patches, db };
}

/** Coordenadas con las que quedó pintada una card. */
const coordsOf = (page, id) => page.evaluate((cid) => {
  const el = document.querySelector(`.gp-view.is-on .gp-c[data-card-id="${cid}"]`);
  return el ? ['x', 'y', 'w', 'h'].map(k => parseInt(el.dataset[k], 10)) : null;
}, id);

test('editar una card no le borra su sitio en el canvas', async ({ page }) => {
  const { patches } = await mount(page, [CARD]);
  const card = page.locator(`.gp-view.is-on .gp-c[data-card-id="${CARD.id}"]`).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await coordsOf(page, CARD.id) || []).join(','),
    { timeout: 30_000 }).toBe('3,2,6,8');                     // se montó en su sitio

  // Editar y guardar sin cambiar nada.
  await card.locator('[data-edit]').first().click();
  await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible();
  await page.locator('#gpbSave').click();
  await expect.poll(() => patches.length, { timeout: 15_000 }).toBeGreaterThan(0);

  const cfg = patches[patches.length - 1].config;
  expect(cfg).toBeTruthy();
  // Lo que se guarda sigue llevando la posición: sin esto la card se recoloca sola al recargar.
  expect(cfg.style.canvas).toMatchObject({ x: 3, y: 2, w: 6, h: 8 });
  expect(cfg.style.span).toBe(6);
});

// Segunda vía al mismo desorden: una card SIN coordenadas (recién creada, o que las perdió) se
// colocaba siguiendo un cursor que saltaba a la posición de la última card colocada — encima de
// las que ya tenían su lugar. Ahora busca el primer hueco libre.
test('una card sin coordenadas no aterriza encima de una ya colocada', async ({ page }) => {
  const FIJA = { ...CARD, config: { ...CARD.config, title: 'Fija',
    style: { ...CARD.config.style, canvas: { x: 0, y: 0, w: 12, h: 10, size: 'full' }, span: 12 } } };
  const SUELTA = { id: '33333333-3333-4333-8333-333333333333', position: 1, source: 'builder', size: 'md',
    config: { ...CARD.config, title: 'Suelta', style: { color: '#DC2626', size: 'md' } } };   // sin canvas
  await mount(page, [FIJA, SUELTA]);
  await expect(page.locator(`.gp-view.is-on .gp-c[data-card-id="${SUELTA.id}"]`).first()).toBeVisible({ timeout: 30_000 });
  // Las dos tienen que estar YA colocadas: medir a mitad del pintado da coordenadas a medio hacer.
  await expect.poll(async () => {
    const [a, b] = await Promise.all([coordsOf(page, FIJA.id), coordsOf(page, SUELTA.id)]);
    return [...(a || []), ...(b || [])].filter(Number.isFinite).length;
  }, { timeout: 20_000 }).toBe(8);
  const a = await coordsOf(page, FIJA.id);
  const b = await coordsOf(page, SUELTA.id);
  expect(a).toEqual([0, 0, 12, 10]);                          // la colocada se queda donde estaba
  const solapan = a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  expect(solapan).toBe(false);
});

// Un tile compacto (KPI, o gauge de una sola métrica) mide 2×3 por CSS —con !important— pero su
// dataset seguía diciendo el bucket con el que nació (6×7), y ESO era lo que se guardaba: el
// layout reservaba un hueco tres veces mayor que la card, y las vecinas se colocaban contra un
// tamaño que nadie ve. Se guarda el tamaño efectivo.
test('el layout guarda el tamaño que la card ocupa de verdad, no el de su bucket', async ({ page }) => {
  const KPI = { id: '44444444-4444-4444-8444-444444444444', position: 0, source: 'builder', size: 'md',
    config: { schema: 'gp.card/v1', title: 'Total Distance', viz: 'kpi', scope: { level: 'squad' },
      metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [],
      range: { type: 'last30' }, style: { color: '#15803D', size: 'md' } } };
  const { patches } = await mount(page, [KPI]);
  const card = page.locator(`.gp-view.is-on .gp-c[data-card-id="${KPI.id}"]`).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200);

  // Lo que se ve: el tile compacto ocupa 2 columnas × 3 filas.
  const painted = await page.evaluate((cid) => {
    const el = document.querySelector(`.gp-view.is-on .gp-c[data-card-id="${cid}"]`);
    const cs = getComputedStyle(el);
    return { w: parseInt(cs.getPropertyValue('--gp-w'), 10), h: parseInt(cs.getPropertyValue('--gp-h'), 10) };
  }, KPI.id);
  expect(painted).toEqual({ w: 2, h: 3 });

  patches.length = 0;
  await page.evaluate(() => window.saveLayout(document.querySelector('.gp-view.is-on').dataset.view));
  await expect.poll(() => patches.length, { timeout: 15_000 }).toBeGreaterThan(0);
  const canvas = patches[patches.length - 1].config?.style?.canvas;
  expect(canvas).toBeTruthy();
  expect({ w: canvas.w, h: canvas.h }).toEqual(painted);    // se guarda lo que ocupa
});

// El ciclo entero, que es lo que el usuario vive: acomodar, guardar, recargar. Si algo del camino
// pierde o falsea coordenadas, las cards vuelven a otro sitio — el desorden que se reportó.
test('acomodar, guardar y recargar deja las cards donde estaban', async ({ page }) => {
  const A = { ...CARD, id: '55555555-5555-4555-8555-555555555555',
    config: { ...CARD.config, title: 'Tabla', viz: 'table',
      metrics: [{ id: 'total_distance', agg: 'avg' }],
      style: { ...CARD.config.style, canvas: { x: 0, y: 0, w: 12, h: 9, size: 'full' }, span: 12 } } };
  const B = { id: '66666666-6666-4666-8666-666666666666', position: 1, source: 'builder', size: 'md',
    config: { schema: 'gp.card/v1', title: 'Total Distance', viz: 'kpi', scope: { level: 'squad' },
      metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [],
      range: { type: 'last30' }, style: { color: '#15803D', size: 'md' } } };

  // La "base": los PATCH que manda la app se guardan y se devuelven en el siguiente GET.
  const { db } = await mount(page, [A, B]);

  const wait = async () => expect.poll(async () => {
    const c = await Promise.all([coordsOf(page, A.id), coordsOf(page, B.id)]);
    return c.flat().filter(Number.isFinite).length;
  }, { timeout: 20_000 }).toBe(8);
  await wait();

  // El usuario mueve el KPI y guarda — con la carga ya terminada, como en el uso real: mientras
  // el layout se está aplicando, el guardado se descarta a propósito (no cementar coords
  // provisionales), así que guardar antes de eso no prueba nada.
  await expect.poll(() => page.evaluate(() => window._gpLayoutReady !== false), { timeout: 20_000 }).toBe(true);
  await page.evaluate((id) => {
    const el = document.querySelector(`.gp-view.is-on .gp-c[data-card-id="${id}"]`);
    window.gpCanvas.applyCoords(el, { x: 4, y: 10, w: 2, h: 3 });
  }, B.id);
  await page.evaluate(() => window.saveLayout(document.querySelector('.gp-view.is-on').dataset.view));
  // Se espera al guardado real, no a un reloj: lo que quedó en la base tiene que decir lo mismo
  // que la pantalla.
  await expect.poll(() => db.get(B.id)?.config?.style?.canvas?.x, { timeout: 15_000 }).toBe(4);
  expect(db.get(B.id)?.config?.style?.canvas).toMatchObject({ x: 4, y: 10, w: 2, h: 3 });

  const before = { a: await coordsOf(page, A.id), b: await coordsOf(page, B.id) };
  expect(before.b).toEqual([4, 10, 2, 3]);

  await page.reload();
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.locator(`[data-view="db-${CUSTOM.id}"]`).first().click();
  await wait();

  expect(await coordsOf(page, A.id)).toEqual(before.a);   // la tabla, donde estaba
  expect(await coordsOf(page, B.id)).toEqual(before.b);   // y el KPI, donde lo dejaron
});
