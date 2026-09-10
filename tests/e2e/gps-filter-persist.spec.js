// @ts-check
// Los filtros se guardan por usuario + dashboard en localStorage, y al recargar tienen que
// volver. No volvían: la clave se armaba con el data-dashboard-id de la pestaña, que llega de la
// base DESPUÉS del primer render. Al guardar ya estaba (clave con el uuid); al restaurar todavía
// no (clave con el data-view, «ind»). Guardaba en un lado y leía en otro, así que en cada F5 se
// perdía todo — el síntoma que se veía en Player Week Report.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// La pestaña «Player Week Report» (data-view="ind") con su fila en dashboards: es el caso que
// falla, porque enhancePredefinedTabs le cuelga un data-dashboard-id después del primer render.
const DASHBOARDS = [
  { id: 'dash-ind', club_id: CLUB_ID, report_type: 'ind',  name: 'Player Week Report', scope: 'player', is_shared: true, created_by: null },
  { id: 'dash-grp', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring',    scope: 'squad',  is_shared: true, created_by: null },
];
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false, match_day_offset: -3 }];
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Ana',  last_name: 'Alfa', number: 5, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto', last_name: 'Beta', number: 6, position: 'MF', positions: ['MF'], status: 'active' },
];
const REPORTS = PLAYERS.map(p => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000, high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
  sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
  player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));

async function rutas(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    return r.fulfill({ json: one ? SESSIONS[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/rpc/gps_filter_rows`, r => r.fulfill({ json: PLAYERS.map(p => ({
    player_id: p.id, work_context: 'team', session_id: 's-a', session_date: SESSIONS[0].session_date,
    session_attributes: null, match_day_offset: -3, microcycle_id: null, team_id: null,
    session_type: 'training', season_id: null, first_name: p.first_name, last_name: p.last_name,
    number: p.number, player_position: p.position })) }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASHBOARDS[0] : DASHBOARDS });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));
}

/** Deja la barra con sus filas cargadas (ver gps-positions.spec.js: el club llega por otra vía). */
async function conFilas(page) {
  let filas = 0;
  for (let i = 0; i < 25 && !filas; i++) {
    filas = await page.evaluate((cid) => {
      window.getClubId = async () => cid;
      if (!window.gpFilterBar) return 0;
      try { window.gpFilterBar.reload(); } catch (_e) { /* lo reintenta el bucle */ }
      return window.gpFilterBar.getState().rowCount || 0;
    }, CLUB_ID);
    if (!filas) await page.waitForTimeout(600);
  }
  expect(filas, 'la barra se quedó sin filas').toBeGreaterThan(0);
}

async function abrir(page) {
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-fbar-drops', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await conFilas(page);
  // Que las pestañas ya tengan su data-dashboard-id: es lo que llega tarde y rompía la clave.
  await expect.poll(async () => page.evaluate(() =>
    document.querySelector('#sections .gp-sec[data-view="ind"]')?.dataset.dashboardId || ''
  ), { timeout: 20_000 }).toBeTruthy();
  // Y que la barra YA haya restaurado: restore() empieza reseteando el estado, así que tocar un
  // filtro antes de que llegue es una carrera que el usuario real no corre (él espera a que la
  // página cargue). Sin esta espera el test mide su propia carrera, no el bug.
  await expect.poll(async () => page.evaluate(() =>
    window.gpFilterBar?.getState?.().restored === true), { timeout: 20_000 }).toBe(true);
}

test.describe('GPS · los filtros sobreviven al reload', () => {
  test('en Player Week Report, el jugador elegido sigue después de recargar', async ({ page }) => {
    await rutas(page);
    await injectSession(page);
    await abrir(page);
    await page.evaluate(() => window.gpFilterBar.setValue('player', ['p2']));
    await page.waitForTimeout(1200);
    expect((await page.evaluate(() => window.gpFilterBar.getState())).playerIds).toEqual(['p2']);

    await page.reload();
    await page.waitForSelector('.gp-fbar-drops', { timeout: 15_000 });
    await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
    await conFilas(page);
    await page.waitForTimeout(1200);
    expect((await page.evaluate(() => window.gpFilterBar.getState())).playerIds).toEqual(['p2']);
  });

  // «Corroborá que todos los dashboards lo hagan»: la clave sale del data-view, que TODAS las
  // pestañas traen del HTML — las predefinidas ('ind', 'grp', 'mgrp'…) y las que crea el usuario
  // ('db-<uuid>'). Acá se comprueba en una segunda pestaña, y que cada una guarde lo suyo sin
  // pisar a la otra.
  test('cada pestaña recuerda sus propios filtros', async ({ page }) => {
    await rutas(page);
    await injectSession(page);
    await abrir(page);
    await page.evaluate(() => window.gpFilterBar.setValue('player', ['p1']));   // en «ind»
    await page.waitForTimeout(1000);

    // A Session Control (data-view="grp"), que es otra pestaña y otro guardado.
    await page.evaluate(() => document.querySelector('#sections .gp-sec[data-view="grp"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.gpFilterBar.setValue('player', ['p2']));
    await page.waitForTimeout(1200);

    const claves = await page.evaluate(() => Object.fromEntries(
      Object.keys(localStorage).filter(k => k.startsWith('cm_gpfilters_'))
        .map(k => [k, JSON.parse(localStorage.getItem(k) || '{}').player])));
    expect(claves['cm_gpfilters_user-1_ind']).toEqual(['p1']);
    expect(claves['cm_gpfilters_user-1_grp']).toEqual(['p2']);
  });

  test('guardar y restaurar usan la MISMA clave, no una con el uuid y otra con la vista', async ({ page }) => {
    await rutas(page);
    await injectSession(page);
    await abrir(page);
    await page.evaluate(() => window.gpFilterBar.setValue('position', ['MF']));
    await page.waitForTimeout(1200);
    const claves = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('cm_gpfilters_') && (localStorage.getItem(k) || '').includes('MF')));
    // Una sola clave con ese filtro, y armada con el data-view estable — no con el uuid, que
    // todavía no existe cuando la barra restaura.
    expect(claves).toEqual(['cm_gpfilters_user-1_ind']);
  });
});
