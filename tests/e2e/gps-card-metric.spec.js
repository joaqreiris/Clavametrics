// @ts-check
// Cambiar la métrica de una card sin abrir el editor: el chip de la cabecera la cambia en el
// sitio, la card se re-resuelve con la nueva y queda guardada. Es la versión de card de lo que
// Power BI llama field parameters — un selector, no un gemelo del gráfico por cada métrica.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 60_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
const MCS = [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(8), end_date: daysAgo(2), match_date: daysAgo(2), rival: 'A', home_away: 'home' }];
const PLAYERS = [0, 1, 2].map(i => ({ id: 'p' + i, club_id: CLUB_ID, first_name: 'N' + i, last_name: 'Ape' + i, number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));
const REPORTS = PLAYERS.map((p, i) => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 7000 + i * 1000, high_speed_distance: 400 + i * 50, very_high_speed_distance: 90, sprint_distance: 12,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const CARD = { id: '77777777-7777-4777-8777-777777777777', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Total Distance', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
  range: { type: 'last30' }, style: { color: '#15803D' } } };

async function open(page, cards = [CARD]) {
  const patches = [];
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'high_speed_distance', label: 'HSR', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
    { key: 'max_speed', label: 'Max Speed', unit: 'km/h', kind: 'peak', category: 'speed', is_core: true, decimals: 2, display_order: 3, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => {
    const req = r.request();
    if (req.method() === 'PATCH') { try { patches.push(JSON.parse(req.postData() || '{}')); } catch { /* body no-JSON */ } return r.fulfill({ json: [{}] }); }
    return r.fulfill({ json: cards });
  });
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(async () => page.evaluate((id) =>
    document.querySelectorAll(`.gp-view.is-on .gp-c[data-card-id="${id}"] canvas`).length, CARD.id
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  return patches;
}

const chip = (page) => page.locator(`.gp-view.is-on .gp-c[data-card-id="${CARD.id}"] [data-card-metric-pick]`).first();

test.describe('GPS · cambiar la métrica desde la card', () => {
  test('el chip muestra la métrica y el catálogo del club', async ({ page }) => {
    await open(page);
    await expect(chip(page)).toContainText('Total Distance');
    await chip(page).click();
    const pop = page.locator('.gp-pop, .gp-popover, [role="menu"]').first();
    await expect(pop).toBeVisible({ timeout: 5_000 });
    await expect(pop).toContainText('HSR');
    await expect(pop).toContainText('Max Speed');
  });

  test('al elegir otra, la card se redibuja con ella y queda guardada', async ({ page }) => {
    const patches = await open(page);
    await chip(page).click();
    await page.getByText('HSR (m)', { exact: false }).first().click();

    // El gráfico pasa a mostrar HSR: los valores del fixture son 400/450/500.
    await expect.poll(async () => page.evaluate((id) => {
      const cv = document.querySelector(`.gp-view.is-on .gp-c[data-card-id="${id}"] canvas`);
      const ch = cv && window.Chart.getChart(cv);
      return ch ? ch.data.datasets[0].data.slice().sort((a, b) => a - b).join(',') : '';
    }, CARD.id), { timeout: 20_000 }).toBe('400,450,500');

    await expect(chip(page)).toContainText('HSR');
    // Y se guardó, así que sobrevive a la recarga.
    await expect.poll(() => patches.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(patches[patches.length - 1].config.metrics[0].id).toBe('high_speed_distance');
  });

  test('con una métrica de pico, el agregado deja de ser una suma sin sentido', async ({ page }) => {
    const patches = await open(page, [{ ...CARD, config: { ...CARD.config, metrics: [{ id: 'total_distance', agg: 'total' }] } }]);
    await chip(page).click();
    await page.getByText('Max Speed', { exact: false }).first().click();
    await expect.poll(() => patches.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const m = patches[patches.length - 1].config.metrics[0];
    expect(m.id).toBe('max_speed');
    expect(m.agg).not.toBe('total');        // sumar velocidades máximas no significa nada
  });
});
