// @ts-check
// Combo de barras + línea (una métrica marcada con `line:true`). Dos cosas que sólo se ven en
// el canvas y no leyendo el código:
//   1. La línea se dibuja POR DELANTE de las barras. Chart.js pinta los datasets del último al
//      primero según `order`, así que el orden del array no alcanzaba: la línea quedaba tapada.
//   2. style.comboLine:false = «sólo los puntos» (estilo Power BI): sin trazo, y la leyenda
//      muestra un punto en vez de una raya.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'MOI Kompong DEWA', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(4), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
const MCS = [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(9), end_date: daysAgo(3), match_date: daysAgo(3), rival: 'A', home_away: 'home' }];
const NAMES = [['Pharann','Dara'],['Rado','Mendes'],['Alisher','Mirzo'],['Daro','Ith'],['Narong','Kim'],['Mauricio','Barros']];
const PLAYERS = NAMES.map((n, i) => ({ id: 'p' + i, club_id: CLUB_ID, first_name: n[0], last_name: n[1], number: i + 2, position: 'CB', positions: ['CB'], status: 'active' }));
// total_distance baja monótona y player_load sube: la línea CRUZA las barras → se ve quién tapa a quién.
const REPORTS = PLAYERS.map((p, i) => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 10000 - i * 1200, high_speed_distance: 300, very_high_speed_distance: 90, sprint_distance: 10,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 120 + i * 90, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const cardWith = (style) => ([{ id: 'card-combo', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Total Distance +1', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }, { id: 'player_load', agg: 'avg', line: true }],
  dimensions: [{ id: 'player' }], range: { type: 'last30' },
  style: { color: '#2563EB', ...style } } }]);

async function open(page, cards) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'player_load', label: 'Intensity', unit: 'AU', kind: 'accum', category: 'load', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
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
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-combo"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1800);
}

/** Datasets y muestras de la leyenda ya resueltos por Chart.js. */
const info = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-combo"] canvas');
  const ch = window.Chart.getChart(cv);
  return { ds: ch.data.datasets.map(d => ({ label: d.label, type: d.type, order: d.order, showLine: d.showLine })),
           legend: (ch.legend?.legendItems || []).map(i => ({ text: i.text, lineWidth: i.lineWidth, pointStyle: i.pointStyle })) };
});

test.describe('GPS · combo barras + línea', () => {
  test('por defecto la línea va unida y por DELANTE de las barras', async ({ page }) => {
    await open(page, cardWith({}));
    const { ds, legend } = await info(page);
    const bar  = ds.find(d => d.type === 'bar');
    const line = ds.find(d => d.type === 'line');
    expect(line.showLine).toBe(true);
    // order más bajo = dibujado al final = encima. Si esto se invierte, la línea vuelve a
    // quedar detrás de las barras (el síntoma que se reportó).
    expect(line.order).toBeLessThan(bar.order);
    expect(legend.find(l => /Intensity/.test(l.text)).pointStyle).toBe('line');
  });

  test('con comboLine apagado quedan sólo los puntos, y la leyenda los acompaña', async ({ page }) => {
    await open(page, cardWith({ comboLine: false }));
    const { ds, legend } = await info(page);
    const bar  = ds.find(d => d.type === 'bar');
    const line = ds.find(d => d.type === 'line');
    expect(line.showLine).toBe(false);
    expect(line.order).toBeLessThan(bar.order);      // los puntos siguen por delante
    const li = legend.find(l => /Intensity/.test(l.text));
    expect(li.pointStyle).toBe('circle');
    expect(li.lineWidth).toBe(0);                    // sin raya en la muestra
  });

  test('el editor ofrece el interruptor para las cards de barras', async ({ page }) => {
    await open(page, cardWith({}));
    await page.locator('#gpbOpenBtn').first().click();
    await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible();
    await page.locator('#gpbPanel .es-tabs button[data-tab="style"]').first().click();   // el interruptor vive en Style
    const sw = page.locator('[data-toggle="comboLine"]').first();
    await expect(sw).toBeVisible();                  // el tipo por defecto del builder es bars
    await expect(sw).toHaveClass(/is-on/);           // y arranca encendido (línea unida)
    await sw.click();
    await expect(sw).not.toHaveClass(/is-on/);
  });
});
