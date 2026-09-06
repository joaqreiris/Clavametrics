// @ts-check
// Caja y bigotes: la única card que muestra DISPERSIÓN. Lo que hay que verificar no es que
// dibuje, sino que los números sean los correctos — cuartiles, bigotes a 1,5·IQR y qué queda
// fuera — y que la consulta pida los valores individuales en vez de un promedio por grupo.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
const MCS = [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(8), end_date: daysAgo(2), match_date: daysAgo(2), rival: 'A', home_away: 'home' }];

// Defensas con valores 1000..4000 (cuartiles redondos) y un extremo que se sale por arriba;
// mediocampistas con un rango estrecho. Así la caja tiene números comprobables a mano.
const DEF = [1000, 2000, 3000, 4000, 12000];
const MID = [5000, 5200, 5400, 5600];
const PLAYERS = [
  ...DEF.map((_, i) => ({ id: 'd' + i, club_id: CLUB_ID, first_name: 'Def', last_name: 'Uno' + i, number: 10 + i, position: 'CB', positions: ['CB'], status: 'active' })),
  ...MID.map((_, i) => ({ id: 'm' + i, club_id: CLUB_ID, first_name: 'Mid', last_name: 'Dos' + i, number: 20 + i, position: 'CM', positions: ['CM'], status: 'active' })),
];
const VAL = { ...Object.fromEntries(DEF.map((v, i) => ['d' + i, v])), ...Object.fromEntries(MID.map((v, i) => ['m' + i, v])) };
const REPORTS = PLAYERS.map(p => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: VAL[p.id], high_speed_distance: 200, very_high_speed_distance: 80, sprint_distance: 10,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const card = (cfg) => ([{ id: 'card-box', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Distribución', viz: 'box', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], range: { type: 'last30' },
  style: { color: '#15803D' }, ...cfg } }]);

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
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-box"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
}

/** Las cajas ya calculadas, tal como las recibió el plugin que las dibuja. */
const boxes = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-box"] canvas');
  const o = window.Chart.getChart(cv).options.plugins.gpbBox;
  return (o.boxes || []).map(b => ({ label: b.label, q1: b.q1, med: b.med, q3: b.q3,
    lo: b.lo, hi: b.hi, n: b.n, out: b.out.map(x => x.label) }));
});

test.describe('GPS · caja y bigotes', () => {
  test('agrupada por posición: cuartiles, bigotes y el que se sale', async ({ page }) => {
    await open(page, card({ dimensions: [{ id: 'position' }] }));
    const bs = await boxes(page);
    const cb = bs.find(b => b.label === 'CB');
    const cm = bs.find(b => b.label === 'CM');
    expect(bs).toHaveLength(2);

    // CB = 1000, 2000, 3000, 4000 y 12000 → cuartiles sobre los cinco valores.
    expect(cb.n).toBe(5);
    expect(cb.q1).toBe(2000);
    expect(cb.med).toBe(3000);
    expect(cb.q3).toBe(4000);
    // IQR 2000 → tope en 4000 + 3000 = 7000: el bigote llega al último valor por debajo (4000)
    // y el 12.000 queda fuera, con nombre.
    expect(cb.hi).toBe(4000);
    expect(cb.lo).toBe(1000);
    expect(cb.out).toHaveLength(1);
    expect(cb.out[0]).toMatch(/Uno4/);

    // CM es un grupo apretado: nadie se sale.
    expect(cm.n).toBe(4);
    expect(cm.med).toBe(5300);
    expect(cm.out).toHaveLength(0);
  });

  test('sin dimensión: una sola caja con el plantel entero', async ({ page }) => {
    await open(page, card({ dimensions: [] }));
    const bs = await boxes(page);
    expect(bs).toHaveLength(1);
    expect(bs[0].n).toBe(9);                      // los 9 jugadores, no un promedio
  });

  test('el tipo está disponible en el editor', async ({ page }) => {
    await open(page, card({ dimensions: [{ id: 'position' }] }));
    await page.locator('#gpbOpenBtn').first().click();
    await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible();
    await expect(page.locator('#gpbPanel [data-type="box"]')).toHaveCount(1);
  });
});
