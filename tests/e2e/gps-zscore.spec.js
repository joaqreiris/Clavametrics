// @ts-check
// El z-score deja de ser un botón decorativo. Hasta ahora el método «Z-score» se podía elegir,
// se escribía en el subtítulo de la card… y el cálculo seguía siendo un porcentaje contra la
// media (el propio código lo decía: «STEP 2 wires the heavy logic»). Esto fija las tres cosas
// que importan: que el número sea el z de verdad, que sin dispersión fiable NO se invente uno,
// y que sin pedirlo nada cambie.

import { test, expect } from '@playwright/test';
import { SB, injectSession, seedGpIds } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
// Tres sesiones: con métricas acumuladas ('sum') la celda pasa a ser la SUMA del rango, que es
// donde el z se iba a +20σ porque la referencia venía normalizada por sesión.
const SESIONES_3 = [1, 2, 3].map(n => ({ id: 's-' + n, club_id: CLUB_ID, session_date: daysAgo(n + 2), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }));
const MCS = [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(8), end_date: daysAgo(2), match_date: daysAgo(2), rival: 'A', home_away: 'home' }];

// Cinco jugadores en progresión aritmética: μ = 1400 y σ muestral = 316,23 exactos.
// El más alto queda a (1800−1400)/316,23 = +1,26σ → la card debe decir «+1.3σ».
const VALORES = [1000, 1200, 1400, 1600, 1800];
const mk = (vals) => vals.map((v, i) => ({
  id: 'p' + i, club_id: CLUB_ID, first_name: 'Jug', last_name: 'Uno' + i,
  number: 10 + i, position: 'CB', positions: ['CB'], status: 'active', _v: v,
}));
const repDe = (players, sesiones = SESSIONS) => sesiones.flatMap(ses => players.map(p => ({
  player_id: p.id, session_id: ses.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: p._v, high_speed_distance: 200, very_high_speed_distance: 80, sprint_distance: 10,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: ses.session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
})));

const card = (comparison, agg = 'avg') => ([{ id: 'card-z', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Matriz', viz: 'heatmap', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg }], range: { type: 'last30' },
  style: { color: '#15803D' }, comparison } }]);

async function open(page, comparison, players = mk(VALORES), { agg = 'avg', sesiones = SESSIONS } = {}) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: sesiones }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: players }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: repDe(players, sesiones) }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: card(comparison, agg) }));
  await injectSession(page);
  await seedGpIds(page, CLUB_ID, 'user-1');
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  // La matriz es una tabla, no un canvas: la señal es que las celdas ya tengan texto.
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-z"] .gp-zc')]
      .filter(c => c.textContent.trim() && c.textContent.trim() !== '—').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
}

const celdas = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-z"] .gp-zc')]
    .map(c => c.textContent.trim()));

test.describe('GPS · z-score contra el plantel', () => {
  test('la celda dice a cuántas desviaciones está, no un porcentaje', async ({ page }) => {
    await open(page, { baseline: 'squad', method: 'zscore' });
    const txt = await celdas(page);
    expect(txt.every(t => t.endsWith('σ'))).toBe(true);
    // μ=1400, σ=316,23 → el de 1800 está a +1,26σ y el de 1000 a −1,26σ.
    expect(txt).toContain('+1.3σ');
    expect(txt).toContain('-1.3σ');
    // El jugador que está justo en la media no desaparece: es un 0 real.
    expect(txt).toContain('+0.0σ');
  });

  test('sin pedir z-score, la misma card sigue mostrando el porcentaje de siempre', async ({ page }) => {
    await open(page, { baseline: 'squad', method: 'avg' });
    const txt = await celdas(page);
    expect(txt.some(t => t.endsWith('%'))).toBe(true);
    expect(txt.some(t => t.endsWith('σ'))).toBe(false);
    // 1800 sobre una media de 1400 es +28,6%.
    expect(txt).toContain('+29%');
  });

  test('con dos jugadores no hay dispersión fiable: muestra el %, no un z inventado', async ({ page }) => {
    // σ de dos valores es ruido. La card degrada a porcentaje en vez de dibujar una escala
    // que no significa nada — que es lo que haría cualquier implementación ingenua.
    await open(page, { baseline: 'squad', method: 'zscore' }, mk([1000, 1800]));
    const txt = await celdas(page);
    expect(txt.some(t => t.endsWith('σ'))).toBe(false);
    expect(txt.some(t => t.endsWith('%'))).toBe(true);
  });

  test('con métricas acumuladas el z NO se dispara: los dos lados van a la misma escala', async ({ page }) => {
    // El bug que vio Joaquín en su club: columnas en «sum» sobre 24 sesiones daban +21σ, +22σ,
    // +18σ… todos positivos. La celda era la SUMA del rango y la referencia venía normalizada
    // POR SESIÓN, así que el z medía cuántas sesiones había jugado, no cómo había rendido.
    await open(page, { baseline: 'squad', method: 'zscore' }, mk(VALORES), { agg: 'total', sesiones: SESIONES_3 });
    const txt = await celdas(page);
    const zs = txt.filter(t => t.endsWith('σ')).map(t => parseFloat(t));
    expect(zs.length).toBeGreaterThan(0);
    // Un z real vive en unidades de un dígito. Con el desajuste, el más chico ya pasaba de 10.
    expect(Math.max(...zs.map(Math.abs))).toBeLessThan(4);
    // Y sigue habiendo signo en los dos sentidos: no es que se haya aplanado todo a cero.
    expect(zs.some(z => z > 0)).toBe(true);
    expect(zs.some(z => z < 0)).toBe(true);
  });

  test('el porcentaje sufría el mismo desajuste, y también queda arreglado', async ({ page }) => {
    // No es un problema del z-score: comparar una suma de N sesiones contra una referencia por
    // sesión ya daba porcentajes de varios cientos en heatmap, kpi y gauge. El z sólo lo hizo
    // visible. Con tres sesiones, lo correcto ronda ±30%, no ±300%.
    await open(page, { baseline: 'squad', method: 'avg' }, mk(VALORES), { agg: 'total', sesiones: SESIONES_3 });
    const txt = await celdas(page);
    const pcts = txt.filter(t => t.endsWith('%')).map(t => parseFloat(t));
    expect(pcts.length).toBeGreaterThan(0);
    expect(Math.max(...pcts.map(Math.abs))).toBeLessThan(100);
  });

  test('avisa de que los totales se están leyendo por sesión', async ({ page }) => {
    // El número que ve el usuario cambia (deja de ser la suma del rango): si no se dice, la
    // pregunta siguiente es por qué «sum» muestra un valor mucho más chico del esperado.
    await open(page, { baseline: 'squad', method: 'zscore' }, mk(VALORES), { agg: 'total', sesiones: SESIONES_3 });
    await expect(page.locator('.gp-c[data-card-id="card-z"] .gp-por-sesion-note')).toBeVisible();
  });
});
