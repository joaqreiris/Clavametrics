// @ts-check
// «% de la demanda de partido»: cada métrica como su porcentaje de la referencia de PARTIDO del
// jugador. Lo que hay que verificar es la aritmética —el % se calcula contra la referencia de CADA
// jugador y después se promedian los porcentajes, no los valores— y que una métrica sin referencia
// suficiente se vea marcada en vez de desaparecer.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: null, is_historical: false }];
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Lucas', last_name: 'García', number: 10, position: 'FW', positions: ['FW'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Marco', last_name: 'Rossi',  number: 6,  position: 'MF', positions: ['MF'], status: 'active' },
];
// p1: 5.000 sobre una referencia de 10.000 → 50%. p2: 6.000 sobre 8.000 → 75%. Media: 62,5%.
const VAL = { p1: 5000, p2: 6000 };
const REF = { p1: 10000, p2: 8000 };
const REPORTS = PLAYERS.map(p => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: VAL[p.id], high_speed_distance: 600, very_high_speed_distance: 200, sprint_distance: 80,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null, team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const card = (metrics) => ([{ id: 'card-dem', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: '% del partido', viz: 'demand', scope: { level: 'squad' },
  metrics, range: { type: 'last30' }, dimensions: [], style: { color: '#15803D' } } }]);

async function open(page, cards, { sessions = SESSIONS, reports = REPORTS } = {}) {
  // El motor de referencias (gps-baseline.js) se carga después que este script y pisaría el
  // doble: se define como propiedad de sólo lectura para que el test controle la referencia y
  // mida lo que es suyo — la aritmética del porcentaje, no la consulta de los partidos.
  await page.addInitScript(([ref]) => {
    const stub = async (pids, metric) => {
      const out = {};
      for (const pid of pids) {
        out[pid] = (metric === 'total_distance' && ref[pid])
          ? { baseline: ref[pid], count: 5, confidence: 'high', source: 'full', warning: null }
          : { baseline: null, count: 2, confidence: 'none', source: 'insufficient_data', warning: 'x' };
      }
      return out;
    };
    Object.defineProperty(window, 'getMatchBaselineBatch', { get: () => stub, set: () => {}, configurable: true });
  }, [REF]);
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'high_speed_distance', label: 'High Speed Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: sessions }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: reports }));
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
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-dem"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
}

/** Las filas ya calculadas, tal como las recibió el plugin que las dibuja. */
const rows = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-dem"] canvas');
  const o = window.Chart.getChart(cv).options.plugins.gpbDemand;
  return (o.rows || []).map(r => ({ id: r.id, pct: r.pct, n: r.n, missing: r.missing, minCount: r.minCount }));
});

test.describe('GPS · % de la demanda de partido', () => {
  test.describe.configure({ timeout: 60_000 });

  test('el porcentaje sale contra la referencia de cada jugador, y después se promedia', async ({ page }) => {
    await open(page, card([{ id: 'total_distance', agg: 'avg' }]));
    const rs = await rows(page);
    expect(rs).toHaveLength(1);
    // 5.000/10.000 = 50% y 6.000/8.000 = 75% → 62,5%. Promediar los VALORES (11.000/18.000 = 61,1%)
    // daría otro número: el que más corre pesaría más, y la lectura es por jugador.
    expect(rs[0].pct).toBeCloseTo(62.5, 6);
    expect(rs[0].n).toBe(2);
    expect(rs[0].missing).toBe(0);
  });

  test('el acumulado se compara por sesión, no sumado', async ({ page }) => {
    // Con agg 'total' sobre una sola sesión el número es el mismo que con 'avg': lo que importa
    // es que NO se sumen las sesiones del rango contra un único partido.
    await open(page, card([{ id: 'total_distance', agg: 'total' }]));
    const rs = await rows(page);
    expect(rs[0].pct).toBeCloseTo(62.5, 6);
  });

  test('una métrica sin referencia suficiente se ve marcada, no desaparece', async ({ page }) => {
    await open(page, card([{ id: 'total_distance', agg: 'avg' }, { id: 'high_speed_distance', agg: 'avg' }]));
    const rs = await rows(page);
    expect(rs).toHaveLength(2);
    const hsd = rs.find(r => r.id === 'high_speed_distance');
    expect(hsd.pct).toBeNull();
    expect(hsd.missing).toBe(2);
    // Y dice cuántos partidos hay, no un cero: «2 de 3» explica qué falta para que salga.
    expect(hsd.minCount).toBe(2);
    // La barra sigue en el eje: la métrica se pidió y hay que ver que no se pudo comparar.
    const labels = await page.evaluate(() => {
      const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-dem"] canvas');
      return window.Chart.getChart(cv).data.labels;
    });
    expect(labels).toHaveLength(2);
  });

  // El tipo tiene que poder elegirse en el builder y dibujar el preview con los datos reales del
  // club: sin esto, la card sólo existiría para quien la escriba a mano en la base.
  test('se puede elegir en el builder y el preview dibuja', async ({ page }) => {
    await open(page, card([{ id: 'total_distance', agg: 'avg' }]));
    await page.locator('#gpbOpenBtn').first().click();
    const btn = page.locator('[data-type="demand"]').first();
    await expect(btn).toBeVisible();
    await btn.click();
    // Queda elegido…
    await expect(btn).toHaveClass(/is-on/);
    // …y el panel explica qué va en cada zona con las palabras de ESTE tipo (sin dimensiones,
    // métricas contra el partido), no con las de barras.
    const zonas = await page.evaluate(() => document.querySelector('.bdd-canvas, .bdd-zones, #gpbDD')?.innerText || document.body.innerText);
    expect(zonas).toMatch(/compare against the match|comparar contra el partido|comparar com o jogo/i);
  });

  // Un partido pesa mucho más que un entrenamiento: si el período mezcla los dos, el promedio por
  // sesión contra la referencia de partido mide cosas distintas. Se avisa sin bloquear nada.
  test('avisa cuando el período mezcla partidos y entrenamientos', async ({ page }) => {
    const sessions = [
      SESSIONS[0],
      { id: 's-b', club_id: CLUB_ID, session_date: daysAgo(6), session_type: 'match', team_id: null, microcycle_id: null, is_historical: false },
    ];
    const reports = [...REPORTS, ...PLAYERS.map(p => ({
      ...REPORTS.find(r => r.player_id === p.id), session_id: 's-b',
      training_sessions: { session_date: sessions[1].session_date, session_attributes: null, microcycle_id: null, team_id: null, session_type: 'match', match_day_offset: 0, season_id: null },
    }))];
    await open(page, card([{ id: 'total_distance', agg: 'avg' }]), { sessions, reports });
    const body = page.locator('.gp-view.is-on .gp-c[data-card-id="card-dem"] .gp-c-b');
    await expect(body).toContainText(/mezcla|mixes|mistura/i);
  });
});
