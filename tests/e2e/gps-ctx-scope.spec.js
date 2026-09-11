// @ts-check
// Con el filtro de Contexto en «Equipo», un jugador que ese día hizo casi todo rehab NO puede
// figurar con su distancia completa: sus metros de rehab no son trabajo de equipo y le inflan la
// media al plantel entero.
//
// El caso es real (MOI, 11/09/2026): TAKARA hizo 43' de rehab (3.540 m) y 15' con el equipo
// (266 m). La fila de la SESIÓN dice 3.806 m y work_context 'team' —la etiqueta de rehab vive en
// los PERÍODOS, no en la sesión—, así que mirar sólo la fila de sesión no alcanza.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const FECHA = daysAgo(2);
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: FECHA, session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false }];

const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Ana',  last_name: 'Entera', number: 5, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto', last_name: 'Mixto',  number: 8, position: 'MF', positions: ['MF'], status: 'active' },
];
// Las dos filas de SESIÓN dicen 'team': es lo que pasa en la base real.
const TD_SESION = { p1: 4000, p2: 3806 };
const REPORTS = PLAYERS.map(p => ({
  id: 'r-' + p.id, player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: TD_SESION[p.id], high_speed_distance: 300, very_high_speed_distance: 100,
  sprint_distance: 40, sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27,
  avg_speed: 6, player_load: 250, hmld: 350, time_played: 60, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: FECHA, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));

// p1 entrenó entero con el equipo. p2 es el caso TAKARA.
const PERIODOS = [
  { session_id: 's-a', player_id: 'p1', period_name: 'SESSION', work_context: 'team',
    duration_seconds: 3600, total_distance: 4000, high_speed_distance: 300, very_high_speed_distance: 100,
    sprint_distance: 40, sprint_count: 3, accelerations: 15, decelerations: 12, player_load: 250, hmld: 350, max_speed: 27, avg_speed: 6 },
  { session_id: 's-a', player_id: 'p2', period_name: 'REHAB BETO', work_context: 'rehab',
    duration_seconds: 2592, total_distance: 3540, high_speed_distance: 280, very_high_speed_distance: 95,
    sprint_distance: 38, sprint_count: 3, accelerations: 14, decelerations: 11, player_load: 235, hmld: 330, max_speed: 26, avg_speed: 6 },
  { session_id: 's-a', player_id: 'p2', period_name: 'SET PIECES', work_context: 'team',
    duration_seconds: 906, total_distance: 266, high_speed_distance: 20, very_high_speed_distance: 5,
    sprint_distance: 2, sprint_count: 0, accelerations: 1, decelerations: 1, player_load: 15, hmld: 20, max_speed: 21, avg_speed: 4 },
];

const CARD = [{ id: 'card-ctx', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Distancia por jugador', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
  range: { type: 'season' }, style: { color: '#15803D' } } }];

async function abrir(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true }] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    return r.fulfill({ json: one ? SESSIONS[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));

  // Los períodos son el corazón del caso: se responde según lo que pida cada consulta.
  await page.route(`${SB}/rest/v1/gps_period_reports**`, r => {
    const req = r.request();
    const url = new URL(req.url());
    const sel = url.searchParams.get('select') || '';
    // 1) «¿hay períodos fuera del equipo?» — head + count.
    if (req.method() === 'HEAD' || sel === 'id') {
      return r.fulfill({ status: 200, body: '[]', headers: {
        'Content-Range': '0-0/1', 'Content-Type': 'application/json',
        'Access-Control-Expose-Headers': 'Content-Range, content-range', 'Access-Control-Allow-Origin': '*' } });
    }
    // 2) qué pares (sesión, jugador) tienen trabajo de OTRO contexto.
    if (sel === 'session_id,player_id') {
      const not = url.searchParams.get('work_context') || '';
      const pedidos = (not.match(/not\.in\.\(([^)]*)\)/) || [])[1];
      const fuera = pedidos ? pedidos.split(',') : ['team'];
      const sucios = PERIODOS.filter(p => !fuera.includes(p.work_context))
        .map(p => ({ session_id: p.session_id, player_id: p.player_id }));
      return r.fulfill({ json: sucios });
    }
    // 3) los períodos a sumar, ya acotados a los contextos pedidos.
    const or = url.searchParams.get('or') || '';
    const inW = url.searchParams.get('work_context') || '';
    const lista = ((or.match(/work_context\.in\.\(([^)]*)\)/) || [])[1]
                || (inW.match(/^in\.\(([^)]*)\)$/) || [])[1] || 'team').split(',');
    return r.fulfill({ json: PERIODOS.filter(p => lista.includes(p.work_context)) });
  });

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
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-ctx"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
}

/** Metros que muestra la card, por jugador. */
const valores = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-ctx"] canvas');
  const ch = window.Chart.getChart(cv);
  const ds = ch.data.datasets.find(d => d.type === 'bar') || ch.data.datasets[0];
  return Object.fromEntries(ch.data.labels.map((l, i) => [String(l), Math.round(Number(ds.data[i]))]));
});

test.describe('GPS · el filtro de contexto recorta de verdad', () => {
  test('con «Equipo», el que hizo rehab cuenta SOLO sus minutos con el equipo', async ({ page }) => {
    await abrir(page);
    const v = await valores(page);
    const de = (ap) => v[Object.keys(v).find(k => k.includes(ap))];
    expect(de('Entera')).toBe(4000);   // entrenó todo con el equipo
    expect(de('Mixto'), 'le está contando los metros del rehab').toBe(266);
  });

  test('y por eso la media del plantel no queda inflada', async ({ page }) => {
    await abrir(page);
    const v = await valores(page);
    const media = Object.values(v).reduce((a, b) => a + b, 0) / Object.values(v).length;
    expect(Math.round(media)).toBe(2133);   // (4000 + 266) / 2, no (4000 + 3806) / 2
  });

  test('con «Rehab» se ve sólo el rehab, y el que no hizo desaparece', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => window.gpFilterBar.setValue('work_context', ['rehab']));
    await page.waitForTimeout(2500);
    const v = await valores(page);
    const de = (ap) => v[Object.keys(v).find(k => k.includes(ap)) || ''];
    expect(de('Mixto')).toBe(3540);                    // sus 43' de rehab
    expect(de('Entera')).toBeUndefined();              // no hizo rehab: no tiene por qué figurar
  });

  test('con «Equipo» y «Rehab» juntos, se suman los dos', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => {
      window.gpFilterBar.setValue('work_context', ['team']);
      window.gpFilterBar.setValue('work_context', ['rehab'], { additive: true });
    });
    await page.waitForTimeout(2500);
    const v = await valores(page);
    const de = (ap) => v[Object.keys(v).find(k => k.includes(ap)) || ''];
    expect(de('Mixto')).toBe(3806);                    // 3540 + 266, el día entero
    expect(de('Entera')).toBe(4000);
  });
});

