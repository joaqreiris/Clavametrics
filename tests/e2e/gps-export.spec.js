// @ts-check
// Informe PDF de GPS Analysis (assets/pages/gps-export.js).
//
// El informe se COMPONE en el PDF (texto vectorial + la imagen de cada gráfico), no se captura
// la pantalla. Lo verificable desde afuera: qué ofrece el modal, que solo entren las cards
// marcadas y que el archivo salga y sea un PDF válido. window.__gxLast lleva el resumen.
//
// Reusa el andamiaje de gps-bars-axis.spec.js: una card de builder real montada desde
// dashboard_cards mockeado.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'MOI Kompong DEWA', primary_color: '#3B82F6', logo_url: null };

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const SESSIONS = [
  { id: 's-a', club_id: CLUB_ID, session_date: daysAgo(9), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false },
  { id: 's-b', club_id: CLUB_ID, session_date: daysAgo(2), session_type: 'training', team_id: null, microcycle_id: 'mc-b', is_historical: false },
];
const MCS = [
  { id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(14), end_date: daysAgo(8), match_date: daysAgo(8), rival: 'A', home_away: 'home' },
  { id: 'mc-b', club_id: CLUB_ID, name: 'MC 04', start_date: daysAgo(7), end_date: daysAgo(1), match_date: daysAgo(1), rival: 'B', home_away: 'away' },
];
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Ana',  last_name: 'Alfa',  number: 4, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto', last_name: 'Bravo', number: 5, position: 'CB', positions: ['CB'], status: 'active' },
];
const REPORTS = SESSIONS.flatMap((s, si) => PLAYERS.map((p, pi) => ({
  player_id: p.id, session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000 + pi * 1000 + si * 500, high_speed_distance: 500, very_high_speed_distance: null,
  sprint_distance: null, sprint_count: 5, accelerations: 20, decelerations: 18, max_speed: 30, avg_speed: 6,
  player_load: 300, hmld: null, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: s.session_date, session_attributes: null, microcycle_id: s.microcycle_id, team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
})));

const CARDS = [
  { id: 'card-1', position: 0, source: 'builder', size: 'lg', config: {
    schema: 'gp.card/v1', title: 'Total Distance', viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
    range: { type: 'last30' }, style: { color: '#7C3AED' } } },
  { id: 'card-2', position: 1, source: 'builder', size: 'md', config: {
    schema: 'gp.card/v1', title: 'Player Load', viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [{ id: 'player' }],
    range: { type: 'last30' }, style: { color: '#2563EB' } } },
];

async function openDashboard(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'player_load', label: 'Player Load', unit: 'AU', kind: 'accum', category: 'load', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: CARDS }));

  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id] canvas').length
  ), { timeout: 30_000, message: 'las cards nunca se dibujaron' }).toBeGreaterThan(0);
}

/** Abre el modal, opcionalmente escribe notas y desmarca la primera card. */
async function openModal(page, { uncheckFirst = false, note = '', intro = '' } = {}) {
  await page.locator('#gpExportBtn').click();
  await expect(page.locator('#gxBody')).toBeVisible();
  if (intro) await page.locator('#gxIntro').fill(intro);
  if (note) await page.locator('[data-gx-note="1"]').fill(note);
  if (uncheckFirst) {
    const first = page.locator('#gxCards [data-gx-on]:checked').first();
    await first.uncheck();
  }
  return page.evaluate(() => ({
    onScreen: [...document.querySelectorAll('.gp-view.is-on .gp-c')].filter(c => c.offsetParent !== null).length,
    checked: document.querySelectorAll('#gxBody [data-gx-on]:checked').length,
    noData: document.querySelectorAll('#gxBody .gx-nod').length,
  }));
}

test.describe('GPS · informe PDF', () => {
  test('el modal lista las cards del dashboard y desmarca las que no tienen datos', async ({ page }) => {
    await openDashboard(page);
    const m = await openModal(page);

    expect(m.onScreen).toBeGreaterThan(0);
    expect(m.noData).toBeGreaterThan(0);              // hay alguna card en blanco…
    expect(m.checked).toBe(m.onScreen - m.noData);    // …y viene desmarcada, para no imprimirla
    // El título por defecto es el dashboard, sin el «Loading…» del switcher de equipo.
    const title = await page.locator('#gxTitle').inputValue();
    expect(title).toBe('Player Week Report');
    expect(title).not.toMatch(/loading/i);
  });

  test('se puede dejar una card afuera del informe', async ({ page }) => {
    await openDashboard(page);
    const m = await openModal(page, { uncheckFirst: true });
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.locator('#gxPdf').click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
    const last = await page.evaluate(() => window.__gxLast);
    expect(last.cards).toBe(m.checked);               // solo las marcadas entraron al informe
  });

  test('el botón Exportar PDF genera y descarga el archivo', async ({ page }) => {
    await openDashboard(page);
    await page.locator('#gpExportBtn').click();
    await expect(page.locator('#gxBody')).toBeVisible();
    await page.locator('#gxTitle').fill('Informe de prueba');
    await page.locator('#gxIntro').fill('Comparativa entre microciclo 3 y 4.');

    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.locator('#gxPdf').click(),
    ]);
    // Nombre derivado del título + la fecha del informe, y el modal se cierra al terminar.
    expect(dl.suggestedFilename()).toMatch(/informe-de-prueba\.pdf$/);
    // El informe se compone vectorial (texto + la imagen de cada gráfico), así que pesa poco:
    // lo que hay que verificar es que sea un PDF válido y que haya dibujado TODAS las cards.
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(await dl.path());
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const last = await page.evaluate(() => window.__gxLast);
    expect(last.pages).toBeGreaterThan(0);
    expect(last.cards).toBeGreaterThan(0);         // las cards marcadas entraron
    expect(last.kinds.chart).toBeGreaterThan(0);   // y los gráficos entraron como tales
    await expect(page.locator('#gxBody')).toHaveCount(0);
    expect(last.mode).toBe('save');
  });
});
