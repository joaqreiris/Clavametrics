// @ts-check
// Cuadrantes del scatter: la cruz de referencia (media o mediana) con una etiqueta por esquina,
// para que un punto se clasifique sin leer los ejes. 'off' la apaga; las cards viejas, sin la
// propiedad, siguen viendo la cruz de medias de siempre.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(4), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
const MCS = [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(9), end_date: daysAgo(3), match_date: daysAgo(3), rival: 'A', home_away: 'home' }];
const NAMES = [['Pharann','Dara'],['Rado','Mendes'],['Alisher','Mirzo'],['Daro','Ith'],['Narong','Kim'],['Mauricio','Barros'],['Takara','Su']];
const PLAYERS = NAMES.map((n, i) => ({ id: 'p' + i, club_id: CLUB_ID, first_name: n[0], last_name: n[1], number: i + 2, position: 'CB', positions: ['CB'], status: 'active' }));
// Un valor claramente extremo: con media y con mediana la cruz NO cae en el mismo sitio.
const TD = [7000, 7400, 7800, 8200, 8600, 9000, 16000];
const REPORTS = PLAYERS.map((p, i) => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: TD[i], high_speed_distance: 200 + i * 60, very_high_speed_distance: 80, sprint_distance: 12,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 55 + i * 4,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const cardWith = (style) => ([{ id: 'card-sc', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Volumen vs intensidad', viz: 'scatter', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg', role: 'x' }, { id: 'distance_per_minute', agg: 'avg', role: 'y' }],
  dimensions: [{ id: 'player' }], range: { type: 'last30' }, style: { color: '#15803D', ...style } } }]);

async function open(page, cards) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'distance_per_minute', label: 'Distance / Min', unit: 'm/min', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: cards }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-sc"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
}

/** Lo que el plugin de la cruz recibió ya resuelto. */
const cross = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-sc"] canvas');
  const o = window.Chart.getChart(cv).options.plugins.gpbScatterAvg;
  return { x: o.avgX, y: o.avgY, labels: o.labels };
});

test.describe('GPS · cuadrantes del scatter', () => {
  test('por defecto: cruz en la media y una etiqueta por esquina', async ({ page }) => {
    await open(page, cardWith({}));
    const c = await cross(page);
    expect(c.x).toBeCloseTo(9142.86, 0);        // media de las 7 distancias, con el extremo dentro
    expect(c.labels).toEqual({ x: 'Total Distance', y: 'Distance / Min' });
  });

  test('mediana: la cruz deja de irse detrás del valor extremo', async ({ page }) => {
    await open(page, cardWith({ quadrants: 'median' }));
    const c = await cross(page);
    expect(c.x).toBe(8200);                     // mediana de las 7, ajena al 16.000
    expect(c.labels).toBeTruthy();
  });

  test('«ninguno» apaga la cruz y sus etiquetas', async ({ page }) => {
    await open(page, cardWith({ quadrants: 'off' }));
    const c = await cross(page);
    expect(c.x).toBeNull();
    expect(c.labels).toBeNull();
  });

  test('el editor ofrece el selector para las cards de scatter', async ({ page }) => {
    await open(page, cardWith({}));
    await page.locator('#gpbOpenBtn').first().click();
    await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible();
    await page.locator('#gpbPanel .es-tabs button[data-tab="style"]').first().click();
    await expect(page.locator('#gpbQuadMode')).toHaveCount(1);
    await expect(page.locator('#gpbQuadMode button[data-qmode="median"]')).toHaveCount(1);
  });
});
