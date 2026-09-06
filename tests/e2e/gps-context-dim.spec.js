// @ts-check
// Agrupar por CONTEXTO (equipo · rehab · individual · top-up). Hasta ahora el contexto sólo se
// podía filtrar: al sumar rehab al filtro, esas filas entraban MEZCLADAS con las del equipo en la
// misma barra o la misma caja. Como dimensión, cada contexto es su propio grupo.

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
const PLAYERS = [0, 1, 2, 3].map(i => ({ id: 'p' + i, club_id: CLUB_ID, first_name: 'N' + i, last_name: 'Ape' + i, number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));

// Dos jugadores con el equipo, uno en rehab y uno en top-up, con volúmenes bien distintos.
const CTX = { p0: 'team', p1: 'team', p2: 'rehab', p3: 'topup' };
const TD  = { p0: 8000, p1: 9000, p2: 2500, p3: 4000 };
const REPORTS = PLAYERS.map(p => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: CTX[p.id],
  total_distance: TD[p.id], high_speed_distance: 300, very_high_speed_distance: 90, sprint_distance: 12,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const card = (cfg) => ([{ id: 'card-ctx', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Por contexto', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'total' }], range: { type: 'last30' },
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
  // La consulta trae sólo los contextos pedidos: se respeta el filtro de la URL, como la base.
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    const url = r.request().url();
    const m = url.match(/work_context=(?:in\.\(([^)]*)\)|eq\.([^&]+))/);
    const want = m ? (m[1] ? m[1].split(',').map(x => decodeURIComponent(x.replace(/"/g, ''))) : [decodeURIComponent(m[2])]) : null;
    return r.fulfill({ json: want ? REPORTS.filter(x => want.includes(x.work_context)) : REPORTS });
  });
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
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-ctx"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
}

/** Categorías y valores ya dibujados. */
const drawn = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-ctx"] canvas');
  const ch = window.Chart.getChart(cv);
  return { labels: ch.data.labels, data: ch.data.datasets[0].data };
});

test.describe('GPS · agrupar por contexto', () => {
  test('cada contexto es su propio grupo, no una mezcla', async ({ page }) => {
    await open(page, card({ dimensions: [{ id: 'work_context' }] }));
    const { labels, data } = await drawn(page);
    // Los cuatro jugadores caen en tres contextos: equipo (8000+9000), rehab (2500), top-up (4000).
    expect(labels.length).toBe(3);
    const by = Object.fromEntries(labels.map((l, i) => [String(l), data[i]]));
    expect(by['Team']).toBe(17000);
    expect(by['Rehab']).toBe(2500);
    expect(by['Top-up']).toBe(4000);
  });

  test('sin agrupar por contexto, sigue entrando sólo el trabajo con el equipo', async ({ page }) => {
    await open(page, card({ dimensions: [{ id: 'position' }] }));
    const { data } = await drawn(page);
    // Una sola posición (CB): el total es el de los dos que entrenaron con el grupo.
    expect(data.reduce((a, b) => a + b, 0)).toBe(17000);
  });
});
