// @ts-check
// Wellness — el día libre no es un pendiente.
//
// La RPC wellness_status devuelve a TODOS los jugadores esperados, y desde la migración 150
// marca con `day_off` a los que ese día están libres en vez de sacarlos del resultado. Si se
// los sacara, un día libre de equipo entero dejaría el tablero vacío sin decir por qué; si se
// los cuenta como pendientes, el tablero reclama un parte que nadie pidió.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB = { id: 'club-1', name: 'Test FC' };
const ADMIN = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: 'Head Coach', first_name: 'Test', last_name: 'User', full_name: 'Test User' };
const TEAMS = [{ id: 'team-a', name: 'Primera', season: '2026/27' }];

const row = (n, { responded = false, day_off = false } = {}) => ({
  player_id: 'p-' + n, player_name: 'Jugador ' + n, responded, day_off,
  readiness: responded ? 7 : null, hooper_index: responded ? 9 : null,
  sleep_quality: responded ? 7 : null, fatigue: responded ? 7 : null,
  stress: responded ? 7 : null, soreness: responded ? 7 : null, mood: responded ? 7 : null,
  note: null, body_areas: [], submitted_at: responded ? new Date().toISOString() : null,
});

async function mockAll(page, wellRows) {
  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  const USER = { id: 'user-1', email: 'test@test.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));
  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url();
    const t = n => url.includes(`/rest/v1/${n}`);
    if (t('profiles')) {
      const acc = route.request().headers()['accept'] || '';
      return acc.includes('pgrst.object') ? route.fulfill({ json: ADMIN }) : route.fulfill({ json: [ADMIN] });
    }
    if (t('clubs')) return route.fulfill({ json: [CLUB] });
    if (t('teams')) return route.fulfill({ json: TEAMS });
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });
  // Las RPC van al final: en Playwright gana la última ruta registrada que coincide.
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['wellness'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['wellness'] }));
  await page.route(`${SB}/rest/v1/rpc/my_team_ids**`, r => r.fulfill({ json: ['team-a'] }));
  await page.route(`${SB}/rest/v1/rpc/wellness_status**`, r => r.fulfill({ json: wellRows }));
}

async function open(page, wellRows) {
  await page.addInitScript(() => { try { localStorage.setItem('cm_lang', 'es'); } catch { /* sin storage */ } });
  await injectSession(page);
  await mockAll(page, wellRows);
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('/Wellness.html', { waitUntil: 'domcontentloaded' });
  // El boot termina cuando el selector de equipos tiene opciones reales.
  await expect(page.locator('#wmTeamSelect option')).not.toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('#sumDen')).toContainText('/', { timeout: 15_000 });
}

test.describe('Wellness · día libre', () => {
  test('los de día libre no cuentan como pendientes ni en el denominador', async ({ page }) => {
    // 10 jugadores: 6 cargaron, 1 falta de verdad, 3 están de día libre.
    await open(page, [
      ...[1,2,3,4,5,6].map(n => row(n, { responded: true })),
      row(7),
      ...[8,9,10].map(n => row(n, { day_off: true })),
    ]);
    // 6 de 7, no 6 de 10.
    await expect(page.locator('#sumDone')).toHaveText('6');
    await expect(page.locator('#sumDen')).toHaveText('/ 7');
    await expect(page.locator('#sumMiss')).toHaveText('1');
    await expect(page.locator('#pipPend')).toHaveText('1');
  });

  test('pero se ven en su propia lista, no desaparecen', async ({ page }) => {
    await open(page, [
      ...[1,2,3].map(n => row(n, { responded: true })),
      row(7),
      ...[8,9].map(n => row(n, { day_off: true })),
    ]);
    await page.locator('.tr-seg button[data-tab="pending"]').click();
    // Al que falta de verdad se le puede reclamar; al de día libre no.
    await expect(page.locator('#listPending .pc')).toHaveCount(1);
    await expect(page.locator('#dayOffWrap')).toBeVisible();
    await expect(page.locator('#listDayOff .pc')).toHaveCount(2);
    await expect(page.locator('#listDayOff .pc').first()).toContainText(/día libre/i);
    await expect(page.locator('#listDayOff .pc button')).toHaveCount(0);
  });

  test('el que carga su parte en su día libre cuenta como cualquiera', async ({ page }) => {
    await open(page, [
      ...[1,2,3,4].map(n => row(n, { responded: true })),
      row(5, { responded: true, day_off: true }),
      row(6),
    ]);
    // Los cinco partes cuentan arriba y abajo: 5 de 6, nunca más de 100%.
    await expect(page.locator('#sumDone')).toHaveText('5');
    await expect(page.locator('#sumDen')).toHaveText('/ 6');
    await expect(page.locator('#listDayOff .pc')).toHaveCount(0);
  });

  test('día libre de equipo entero: lo dice, no queda una pantalla vacía', async ({ page }) => {
    await open(page, [1,2,3,4,5].map(n => row(n, { day_off: true })));
    const empty = page.locator('#empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/día libre/i);
    // Y no el mensaje de "no hay jugadores", que sería falso.
    await expect(empty).not.toContainText(/no hay jugadores/i);
  });
});
