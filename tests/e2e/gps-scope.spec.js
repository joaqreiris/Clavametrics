// @ts-check
// El alcance (jugador / plantel) de una card era un botón que podía dejarla muda: una card de
// nivel jugador sin jugador elegido decía «no hay datos para esta selección» —el mismo texto que
// cuando de verdad no hay GPS— y no había forma de saber qué le faltaba.

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
  total_distance: 6000 + i * 500, high_speed_distance: 300, very_high_speed_distance: 90, sprint_distance: 12,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const CARD_PLAYER = [{ id: 'card-p', position: 0, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Del jugador', viz: 'kpi', scope: { level: 'player' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: { color: '#15803D' } } }];

async function open(page, cards) {
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
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: cards }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  // Esperar a que la card termine de resolver: leer mientras gira el spinner no prueba nada.
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id] .cb2-state.load').length
      + document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id]').length ? 
      (document.querySelector('.gp-view.is-on .gp-c[data-card-id] .cb2-state.load') ? 0 : 1) : 1
  ), { timeout: 30_000 }).toBe(1);
  await page.waitForTimeout(400);
}

test.describe('GPS · alcance de una card', () => {
  test('una card de jugador sin jugador dice qué le falta, no «no hay datos»', async ({ page }) => {
    await open(page, CARD_PLAYER);
    const txt = await page.evaluate(() =>
      document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-p"] .gp-c-b')?.innerText || '');
    expect(txt.toLowerCase()).toMatch(/jugador|player/);
    expect(txt.toLowerCase()).toMatch(/plantel|squad|filtro|filter/);
  });

  test('una card nueva nace hablando del plantel', async ({ page }) => {
    await open(page, []);
    await page.locator('#gpbOpenBtn').first().click();
    await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible();
    // Sin jugador en la barra, «de un jugador» no tiene a quién mostrar: la card nace de plantel.
    await expect.poll(async () => page.evaluate(() => window.GpBuilder?.currentConfig?.()?.scope?.level),
      { timeout: 10_000 }).toBe('squad');
  });
});
