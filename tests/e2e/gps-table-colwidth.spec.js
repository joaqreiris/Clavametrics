// @ts-check
// Estirar una columna de la tabla arrastrando el borde derecho de su encabezado. El ancho es del
// usuario, no del editor: se guarda con la card y vuelve al recargar, igual que el ordenamiento.
//
// Lo delicado son los cruces: el mismo encabezado que se arrastra es el que ordena al clickearlo,
// y sin table-layout:fixed el navegador trata el width del th como una sugerencia.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false }];
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Ana',  last_name: 'Alfa', number: 5, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto', last_name: 'Beta', number: 6, position: 'MF', positions: ['MF'], status: 'active' },
];
const REPORTS = PLAYERS.map((p, i) => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000 + i * 900, high_speed_distance: 300, very_high_speed_distance: 100,
  sprint_distance: 40, sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27,
  avg_speed: 6, player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));

const CARD = [{ id: '22222222-2222-4222-8222-222222222222', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Resumen', viz: 'table', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }, { id: 'high_speed_distance', agg: 'avg' }],
  dimensions: [{ id: 'player' }], range: { type: 'season' }, style: { color: '#15803D' } } }];
const CARD_SEL = '.gp-view.is-on .gp-c[data-card-id="22222222-2222-4222-8222-222222222222"]';

/** Guarda lo que la card manda a persistir, para poder revisarlo sin base de verdad. */
async function abrir(page) {
  await page.addInitScript(() => { window.__saved = []; });
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'high_speed_distance', label: 'HSR', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    return r.fulfill({ json: one ? SESSIONS[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: CARD }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.evaluate(() => {
    const real = window.updateDashboardCard;
    window.updateDashboardCard = async (id, cfg, sb) => { window.__saved.push(JSON.parse(JSON.stringify(cfg))); return real ? real(id, cfg, sb) : null; };
  });
  await page.waitForSelector(`${CARD_SEL} .gp-zt th`, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** Arrastra el agarre de una columna `dx` píxeles. */
async function estirar(page, indice, dx) {
  const th = page.locator(`${CARD_SEL} .gp-zt thead th`).nth(indice);
  await th.scrollIntoViewIfNeeded();   // la card vive abajo del todo: sin esto el ratón no le pega
  await page.waitForTimeout(250);
  const grip = th.locator('.tf-rs');
  const box = await grip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const anchoDe = (page, i) => page.locator(`${CARD_SEL} .gp-zt thead th`).nth(i)
  .evaluate(el => Math.round(el.getBoundingClientRect().width));

test.describe('GPS · ancho de columna en la tabla', () => {
  test('arrastrar el borde del encabezado la ensancha', async ({ page }) => {
    await abrir(page);
    const antes = await anchoDe(page, 1);
    await estirar(page, 1, 70);
    const despues = await anchoDe(page, 1);
    expect(despues).toBeGreaterThan(antes + 40);
  });

  test('y también la achica, con un mínimo para que no desaparezca', async ({ page }) => {
    await abrir(page);
    await estirar(page, 1, 60);          // primero se agranda, para tener de dónde recortar
    const ancho = await anchoDe(page, 1);
    await estirar(page, 1, -400);        // y se tira mucho más allá del mínimo
    const final = await anchoDe(page, 1);
    expect(final).toBeLessThan(ancho);
    expect(final).toBeGreaterThanOrEqual(50);   // nunca se colapsa a cero
  });

  test('arrastrar no ordena la tabla: son la misma celda', async ({ page }) => {
    await abrir(page);
    const orden = () => page.evaluate((sel) => document.querySelector(sel).__config?.sort || null, CARD_SEL);
    expect(await orden()).toBeNull();
    await estirar(page, 1, 50);
    expect(await orden()).toBeNull();          // el agarre se llevó el click
    await page.locator(`${CARD_SEL} .gp-zt thead th`).nth(1).click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(400);
    expect(await orden()).not.toBeNull();      // el encabezado sí sigue ordenando
  });

  test('el ancho se guarda con la card', async ({ page }) => {
    await abrir(page);
    await estirar(page, 1, 70);
    const guardado = await page.evaluate(() => window.__saved[window.__saved.length - 1] || null);
    expect(guardado, 'la card no persistió nada').not.toBeNull();
    const anchos = guardado.colWidths || {};
    expect(Object.keys(anchos)).toHaveLength(1);
    expect(Object.values(anchos)[0]).toBeGreaterThan(60);
  });

  test('un ancho ya guardado se aplica al dibujar la tabla', async ({ page }) => {
    CARD[0].config.colWidths = { [await colId(page)]: 300 };
    await abrir(page);
    expect(await anchoDe(page, 1)).toBeGreaterThan(270);
    delete CARD[0].config.colWidths;
  });
});

/** El id con el que se guarda la segunda columna (el mismo que usa el ordenamiento). */
async function colId(page) {
  await abrir(page);
  const id = await page.locator(`${CARD_SEL} .gp-zt thead th`).nth(1).getAttribute('data-sort');
  return id;
}
