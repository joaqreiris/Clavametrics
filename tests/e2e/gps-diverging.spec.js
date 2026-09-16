// @ts-check
// Barras enfrentadas a los lados de un eje central: aceleraciones a un lado, desaceleraciones al
// otro. El desbalance entre acelerar y frenar es una señal de carga mecánica, y con las dos
// métricas en columnas separadas hay que dividir a ojo para verla — acá es una barra más larga
// que su par.
//
// Los números son los del caso que se pidió: PHARANN 15·26 frena casi el doble de lo que acelera.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(2), session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false }];

// acc · dec — PHARANN es el desparejo (26/15 = 1,7×)
const GENTE = [
  { id: 'p1', last: 'Narong',  acc: 43, dec: 37 },
  { id: 'p2', last: 'Daro',    acc: 28, dec: 23 },
  { id: 'p3', last: 'Pharann', acc: 15, dec: 26 },
  { id: 'p4', last: 'Vanda',   acc: 5,  dec: 7  },
];
const PLAYERS = GENTE.map((g, i) => ({ id: g.id, club_id: CLUB_ID, first_name: 'N' + i, last_name: g.last,
  number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));
const REPORTS = GENTE.map((g, i) => ({
  player_id: g.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000, high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
  sprint_count: 3, accelerations: g.acc, decelerations: g.dec, max_speed: 27, avg_speed: 6,
  player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: g.id, first_name: 'N' + i, last_name: g.last, number: 2 + i, position: 'CB', positions: ['CB'] },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));

const CARD = [{ id: 'card-dv', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Acelerar contra frenar', viz: 'diverging', scope: { level: 'squad' },
  metrics: [{ id: 'accelerations', agg: 'total' }, { id: 'decelerations', agg: 'total' }],
  dimensions: [{ id: 'player_name' }], range: { type: 'season' }, style: { color: '#B45309' } } }];

async function abrir(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'accelerations', label: 'Accelerations', unit: '', kind: 'accum', category: 'mech', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'decelerations', label: 'Decelerations', unit: '', kind: 'accum', category: 'mech', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
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
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-dv"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(700);
}

const grafico = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-dv"] canvas');
  const ch = window.Chart.getChart(cv);
  const [izq, der] = ch.data.datasets;
  return { filas: ch.data.labels.map(String), izq: izq.data.map(Number), der: der.data.map(Number),
           colDer: Array.isArray(der.backgroundColor) ? der.backgroundColor : [der.backgroundColor],
           apilado: !!ch.options.scales.x.stacked };
});

test.describe('GPS · barras enfrentadas', () => {
  test('un lado va negativo: es lo que crea el eje en el cero', async ({ page }) => {
    await abrir(page);
    const g = await grafico(page);
    expect(g.apilado).toBe(true);
    expect(g.izq.every(v => v <= 0), 'el lado izquierdo tiene que ir negativo').toBe(true);
    expect(g.der.every(v => v >= 0)).toBe(true);
  });

  test('cada fila muestra sus dos valores enfrentados', async ({ page }) => {
    await abrir(page);
    const g = await grafico(page);
    const i = g.filas.findIndex(l => /Pharann/i.test(l));
    expect(i, 'no está Pharann').toBeGreaterThanOrEqual(0);
    expect(Math.abs(g.izq[i])).toBe(15);
    expect(g.der[i]).toBe(26);
  });

  test('el desparejo queda marcado y los parejos no', async ({ page }) => {
    await abrir(page);
    const g = await grafico(page);
    const col = (ap) => g.colDer[g.filas.findIndex(l => new RegExp(ap, 'i').test(l))];
    // Pharann frena 1,7× lo que acelera; Narong está en 1,16×.
    expect(col('Pharann')).not.toBe(col('Narong'));
    expect(col('Daro')).toBe(col('Narong'));   // los dos parejos, mismo color
  });

  test('avisa al pie cuántos están desparejos', async ({ page }) => {
    await abrir(page);
    const nota = await page.evaluate(() =>
      document.querySelector('.gp-c[data-card-id="card-dv"] .gp-diverging-note')?.textContent?.trim() || '');
    expect(nota).not.toBe('');
    // Sólo Pharann: 26/15 = 1,7× pasa el umbral de 1,5. Vanda queda en 1,4× y NO se marca, que es
    // justo lo que el umbral tiene que hacer — si marcara a todos no serviría de señal.
    expect(nota).toMatch(/\b1\b/);
  });
});
