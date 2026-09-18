// @ts-check
// El RPE tiene que poder mirarse JUNTO a la carga externa: una barra de distancia y encima la
// línea del s-RPE, en la misma card. No vive en gps_reports —está en su propia tabla— pero el
// resolver lo trae y lo mezcla como una métrica más, así que para el builder no debería haber
// diferencia.

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

const GENTE = [
  { id: 'aaaaaaaa-1111-4111-8111-111111111111', last: 'Alfa', td: 5200, rpe: 7, load: 630 },
  { id: 'bbbbbbbb-2222-4222-8222-222222222222', last: 'Beta', td: 4100, rpe: 5, load: 450 },
];
const PLAYERS = GENTE.map((g, i) => ({ id: g.id, club_id: CLUB_ID, first_name: 'N' + i, last_name: g.last,
  number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));
const REPORTS = GENTE.map((g, i) => ({
  id: 'r-' + g.id, player_id: g.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: g.td, high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
  sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
  player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: g.id, first_name: 'N' + i, last_name: g.last, number: 2 + i, position: 'CB', positions: ['CB'] },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));
// La tabla propia del RPE: una fila por jugador y sesión. Los ids son UUID porque
// fetchRpeMetrics descarta los que no lo son —una guarda para no mandar 'null' a una columna
// uuid— y con ids inventados la consulta ni se hace.
const RPE = GENTE.map(g => ({ player_id: g.id, session_id: 's-a', rpe: g.rpe, load: g.load }));

const CARD = [{ id: 'card-rpe', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Carga externa e interna', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }, { id: 'srpe', agg: 'avg', line: true }],
  dimensions: [{ id: 'player' }], range: { type: 'season' }, style: { color: '#15803D' } } }];

async function abrir(page, cards = CARD) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'rpe',  label: 'RPE', unit: 'AU', kind: 'peak', category: 'load', is_core: true, decimals: 0, display_order: 14, squad_rollup: true },
    { key: 'srpe', label: 'Session Load (s-RPE)', unit: 'AU', kind: 'accum', category: 'load', is_core: true, decimals: 0, display_order: 15, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    return r.fulfill({ json: one ? SESSIONS[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/rpe**`, r => r.fulfill({ json: RPE }));
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
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-rpe"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(700);
}

const datos = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-rpe"] canvas');
  const ch = window.Chart.getChart(cv);
  return { filas: ch.data.labels.map(String),
           series: ch.data.datasets.map(d => ({ nombre: d.label, tipo: d.type, datos: d.data.map(Number) })) };
});

test.describe('GPS · el RPE como una métrica más', () => {
  test('la carga interna y la externa conviven en la misma card', async ({ page }) => {
    await abrir(page);
    const d = await datos(page);
    expect(d.filas).toHaveLength(2);
    const dist = d.series.find(s => /distance/i.test(s.nombre));
    const carga = d.series.find(s => /s-rpe|session load/i.test(s.nombre));
    expect(dist, 'falta la distancia').toBeTruthy();
    expect(carga, 'el s-RPE no llegó al gráfico').toBeTruthy();
    // Los valores del RPE salen de SU tabla, no de gps_reports.
    const i = d.filas.findIndex(l => /Alfa/i.test(l));
    expect(dist.datos[i]).toBe(5200);
    expect(carga.datos[i]).toBe(630);
  });

  test('el s-RPE se puede dibujar como línea sobre las barras', async ({ page }) => {
    await abrir(page);
    const d = await datos(page);
    const carga = d.series.find(s => /s-rpe|session load/i.test(s.nombre));
    expect(carga.tipo).toBe('line');
  });

  test('el RPE crudo también sirve como métrica', async ({ page }) => {
    await abrir(page, [{ ...CARD[0], config: { ...CARD[0].config,
      metrics: [{ id: 'rpe', agg: 'avg' }] } }]);
    const d = await datos(page);
    const rpe = d.series.find(s => /rpe/i.test(s.nombre));
    expect(rpe).toBeTruthy();
    const i = d.filas.findIndex(l => /Alfa/i.test(l));
    expect(rpe.datos[i]).toBe(7);
  });
});

// El RPE conviviendo con una métrica de otra escala: 7 puntos de RPE contra 10.000 metros. Sin eje
// propio la línea queda pegada al piso y no se ve — reportado desde el producto.
// Ojo con el emparejamiento: isLine se resolvía por ÍNDICE entre series y métricas, y cuando una
// métrica tiene el modo % activo se agrega una serie extra («…__relmc»), así que el índice se corre
// y la marca de línea cae en la métrica equivocada. Ahora se empareja por id.
test('el RPE se dibuja como línea, con su propio eje a la derecha', async ({ page }) => {
  await abrir(page, [{ id: 'card-rpe', position: 0, source: 'builder', size: 'lg', config: {
    schema: 'gp.card/v1', title: 'Distancia + RPE', viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'sum' }, { id: 'rpe', agg: 'avg', line: true }],
    dimensions: [{ id: 'player' }], range: { type: 'last30' }, style: { color: '#2563EB' } } }]);

  const info = await page.evaluate(() => {
    const c = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-rpe"] canvas');
    const ch = window.Chart.getChart(c);
    return {
      ds: ch.data.datasets.map(d => ({ l: d.label, t: d.type || ch.config.type, eje: d.yAxisID || 'y' })),
      hayY1: !!ch.scales.y1,
      y1max: ch.scales.y1 ? ch.scales.y1.max : null,
      ymax: ch.scales.y ? ch.scales.y.max : null,
    };
  });
  const linea = info.ds.find(d => d.l === 'RPE');
  expect(linea, 'no hay serie de RPE').toBeTruthy();
  expect(linea.t, 'el RPE tiene que dibujarse como línea').toBe('line');
  expect(linea.eje, 'el RPE tiene que ir al eje secundario').toBe('y1');
  expect(info.hayY1, 'no se creó el eje derecho').toBe(true);
  // Y con ESCALA PROPIA, ajustada al RPE: es una escala de 0 a 10, así que su eje no puede
  // quedar con el tope de otra métrica. (No se compara contra el eje de los metros porque en las
  // fixturas los metros son chicos; en el producto son 10.000 y ahí la diferencia salta sola.)
  expect(info.y1max, `el eje del RPE quedó con un tope ajeno: ${info.y1max}`).toBeLessThanOrEqual(20);
});
