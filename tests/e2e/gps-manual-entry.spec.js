// @ts-check
// «Add GPS data» (modal de carga manual de GPS Analysis).
//
// Cubre las dos reglas de negocio nuevas, que son puro cálculo y no se ven a simple vista:
//   1. Sumar a lo existente + prorrateo por minutos — el caso real: al jugador se le prendió el
//      GPS recién en el 2º tiempo, así que hay que AGREGAR el 1er tiempo sin pisar lo grabado.
//   2. Modelo A de work_context (docs/gps-work-context.md) — el jugador que hizo rehab /
//      individual / top-up en esa sesión queda FUERA de la media, entero y sin restarle nada.
//
// Mock de red al estilo de gps-smoke.spec.js: catch-all vacío primero y rutas específicas encima.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };

// Hoy: el modal descarta sesiones futuras (session_date <= hoy) y usa fechas locales.
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

const SESSIONS = [
  { id: SESSION_ID, club_id: CLUB_ID, session_date: TODAY, session_type: 'match', title: 'vs Rival', team_id: null, season_id: null },
];

// Tres centrales. p1 es el del GPS a medias (2º tiempo); p2 y p3 jugaron el partido entero.
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Mauricio', last_name: 'Alfa',  number: 4, position: 'CB', status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto',     last_name: 'Bravo', number: 5, position: 'CB', status: 'active' },
  { id: 'p3', club_id: CLUB_ID, first_name: 'Caio',     last_name: 'Costa', number: 6, position: 'CB', status: 'active' },
];

const REPORTS = [
  { player_id: 'p1', session_id: SESSION_ID, source: 'catapult', is_invalid: false, work_context: 'team',
    total_distance: 4200, high_speed_distance: 310, very_high_speed_distance: null, sprint_distance: null,
    sprint_count: 3, accelerations: null, decelerations: null, max_speed: 29.1, avg_speed: 5.6,
    player_load: 210, hmld: null, time_played: 45, distance_per_minute: 93.33 },
  { player_id: 'p2', session_id: SESSION_ID, source: 'catapult', is_invalid: false, work_context: 'team',
    total_distance: 9100, high_speed_distance: 640, very_high_speed_distance: null, sprint_distance: null,
    sprint_count: 7, accelerations: null, decelerations: null, max_speed: 31.4, avg_speed: 6.1,
    player_load: 455, hmld: null, time_played: 90, distance_per_minute: 101.11 },
  { player_id: 'p3', session_id: SESSION_ID, source: 'catapult', is_invalid: false, work_context: 'team',
    total_distance: 9100, high_speed_distance: 640, very_high_speed_distance: null, sprint_distance: null,
    sprint_count: 7, accelerations: null, decelerations: null, max_speed: 31.4, avg_speed: 6.1,
    player_load: 455, hmld: null, time_played: 90, distance_per_minute: 101.11 },
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ periods?: object[] }} [opts] periods: filas de gps_period_reports no-team de la sesión.
 * @returns {Promise<object[]>} sink donde caen los upserts a gps_reports (payload del POST).
 */
async function mockGps(page, opts = {}) {
  /** @type {object[]} */
  const saved = [];
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({
    json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' },
  }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false }] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/seasons**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/availability**`, r => r.fulfill({ json: [] }));
  // Dos consultas distintas caen acá: la del modal y la del resolver piden los períodos AJENOS a
  // los contextos mirados (work_context=not.in / neq), y el recorte del resolver pide los del
  // contexto pedido (or=(work_context.in.(team),work_context.is.null)). Devolver la lista entera
  // a las dos haría que el recorte sumara justo los períodos que hay que sacar.
  await page.route(`${SB}/rest/v1/gps_period_reports**`, r => {
    const url = decodeURIComponent(r.request().url());
    const all = opts.periods || [];
    const wantsTeam = url.includes('work_context.in.');
    return r.fulfill({ json: all.filter(p => wantsTeam ? (!p.work_context || p.work_context === 'team')
                                                       : (p.work_context && p.work_context !== 'team')) });
  });
  await page.route(`${SB}/rest/v1/rpc/gps_session_ids_with_data`, r => r.fulfill({ json: [{ session_id: SESSION_ID, n: REPORTS.length }] }));
  // GET = lectura de la sesión; POST = el upsert que estamos verificando.
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    if (r.request().method() === 'POST') {
      saved.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ json: [] });
    }
    return r.fulfill({ json: REPORTS });
  });
  return saved;
}

/** Abre GPS Analysis con los mocks puestos y despliega el modal de carga manual. */
async function openModal(page, opts) {
  const saved = await mockGps(page, opts);
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpTeamId = null; }, CLUB_ID);
  await page.locator('#gpManualBtn').click();
  await expect(page.locator('#mgpPlayerList .mgp-opt').first()).toBeVisible({ timeout: 10_000 });
  return saved;
}

/** Selecciona un jugador de la lista por apellido. */
async function pickPlayer(page, lastName) {
  await page.locator('#mgpPlayerList .mgp-opt', { hasText: lastName }).first().click();
}

test.describe('GPS · carga manual', () => {
  test('suma el tramo que falta prorrateado a los minutos, sin pisar lo grabado', async ({ page }) => {
    const saved = await openModal(page);

    await pickPlayer(page, 'Alfa');                                   // 4.200 m en 45 min
    await page.locator('#mgpMode button[data-mode="avgpos"]').click(); // media de los otros dos CB
    await page.locator('#mgpApplyMode button[data-apply="add"]').click();
    await page.locator('#mgpAddMins').fill('45');

    // La media de los otros dos CB (9.100 m / 90 min) prorrateada a 45 min = 4.550 m…
    await expect(page.locator('#mgpFields .mgp-grid').first()).toContainText('4550');
    // …y el resultado final es 4.200 + 4.550 = 8.750 m en 90 min.
    await expect(page.locator('#mgpPreview')).toContainText('8750');

    await page.locator('#mgpSave').click();
    await expect.poll(() => saved.length, { timeout: 10_000 }).toBe(1);

    const row = saved[0];
    expect(row.total_distance).toBe(8750);
    expect(row.time_played).toBe(90);
    expect(row.high_speed_distance).toBe(630);        // 310 + 320
    expect(row.sprint_count).toBe(7);                 // 3 + 3,5 → redondeado
    expect(row.max_speed).toBe(31.4);                 // máximo, no suma
    expect(row.distance_per_minute).toBe(97.22);      // recalculado: 8750 / 90
    expect(row.source).toBe('partial');               // real + estimado
    expect(row.player_id).toBe('p1');
  });

  test('sumar no dispara el aviso de sobrescritura (no pisa nada)', async ({ page }) => {
    const saved = await openModal(page);
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });

    await pickPlayer(page, 'Alfa');
    await page.locator('#mgpApplyMode button[data-apply="add"]').click();
    await page.locator('#mgpSave').click();

    await expect.poll(() => saved.length, { timeout: 10_000 }).toBe(1);
    expect(dialogs).toBe(0);
  });

  test('reemplazar sí pide confirmación cuando el jugador ya tiene datos reales', async ({ page }) => {
    const saved = await openModal(page);
    let msg = '';
    page.on('dialog', d => { msg = d.message(); d.dismiss(); });

    await pickPlayer(page, 'Alfa');
    await page.locator('#mgpSave').click();          // 'replace' es el modo por defecto

    await expect.poll(() => msg, { timeout: 10_000 }).toContain('Overwrite');
    expect(saved).toHaveLength(0);                   // cancelado → no se guardó nada
  });

  test('sin trabajo no-team, la media de posición usa a los tres centrales', async ({ page }) => {
    await openModal(page);
    await pickPlayer(page, 'Alfa');
    await page.locator('#mgpMode button[data-mode="avgpos"]').click();
    await expect(page.locator('#mgpFields .mgp-note').first()).toContainText('3 CB');
  });

  test('el top-up se recorta de la media (Modelo B, igual que el dashboard)', async ({ page }) => {
    // p2 corrió 2.000 m de top-up dentro de la sesión: su fila de sesión (9.100) los incluye, así
    // que en la media tiene que contar solo su trabajo de equipo (7.100), no el total mixto.
    await openModal(page, { periods: [
      { session_id: SESSION_ID, player_id: 'p2', work_context: 'team',
        duration_seconds: 4500, total_distance: 7100, high_speed_distance: 600, time_played: 75, max_speed: 31.4, avg_speed: 6.1 },
      { session_id: SESSION_ID, player_id: 'p2', work_context: 'topup',
        duration_seconds: 900, total_distance: 2000, high_speed_distance: 40, time_played: 15, max_speed: 24.0, avg_speed: 5.2 },
    ] });

    await expect(page.locator('#mgpStatus')).toContainText('Top-up');
    await pickPlayer(page, 'Alfa');
    await page.locator('#mgpMode button[data-mode="avgpos"]').click();
    // Sigue promediando a los 3 CB, pero p2 entra recortado: (4200 + 7100 + 9100) / 3 = 6800.
    await expect(page.locator('#mgpFields .mgp-note').first()).toContainText('3 CB');
    await expect(page.locator('#mgpFields .mgp-grid').first()).toContainText('6800');
  });
});
