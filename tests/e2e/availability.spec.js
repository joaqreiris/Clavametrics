// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, MICROCYCLE, injectSession, mockBase } from './_shared.js';

// Admin profile → acceso a todas las categorías (evita el filtro my_team_ids)
const ADMIN = { ...PROFILE, role: 'admin', club_role: 'Owner' };
const TEAM  = { id: 'team-1', club_id: 'club-1', name: 'First Team' };

const PLAYERS = [
  { id: 'p-1', club_id: 'club-1', team_id: 'team-1', first_name: 'Lucas',  last_name: 'García',  number: 10, position: 'FW' },
  { id: 'p-2', club_id: 'club-1', team_id: 'team-1', first_name: 'Diego',  last_name: 'Pérez',   number: 4,  position: 'CB' },
  { id: 'p-3', club_id: 'club-1', team_id: 'team-1', first_name: 'Martín', last_name: 'Sosa',    number: 8,  position: 'CM' },
];

// Algunas filas dentro del rango del microciclo (14→21 may 2026)
const AVAIL = [
  { player_id: 'p-1', date: '2026-05-15', status: 'injured',  minutes: 0 },
  { player_id: 'p-2', date: '2026-05-16', status: 'partial',  minutes: 0 },
  { player_id: 'p-3', date: '2026-05-17', status: 'sick',     minutes: 0 },
  { player_id: 'p-1', date: '2026-05-18', status: 'away',     minutes: 0 },
];

async function mockAvailability(page) {
  await mockBase(page);

  // RPC my_team_ids (por si se invoca)
  await page.route(`${SB}/rest/v1/rpc/**`, route => route.fulfill({ json: ['team-1'] }));

  // Catch-all REST: registrado DESPUÉS de mockBase → mayor prioridad.
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();

    // profiles y clubs se consultan con .single() → objeto bare, no array
    if (url.includes('/profiles'))        return route.fulfill({ json: ADMIN });
    if (url.includes('/clubs'))           return route.fulfill({ json: CLUB });
    if (url.includes('/teams'))           return route.fulfill({ json: [TEAM] });
    if (url.includes('/microcycles'))     return route.fulfill({ json: [MICROCYCLE] });
    if (url.includes('/calendar_events')) return route.fulfill({ json: [] });
    if (url.includes('/injuries'))        return route.fulfill({ json: [] });
    if (url.includes('/players'))         return route.fulfill({ json: PLAYERS });
    if (url.includes('/availability')) {
      if (method === 'GET') return route.fulfill({ json: AVAIL });
      // autofill upserts (POST) / updates (PATCH)
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ json: [] });
  });
}

async function gotoStats(page) {
  await injectSession(page);
  await mockAvailability(page);
  await page.goto('/Availability.html');
  await page.waitForSelector('#avBody tr', { timeout: 10_000 });
  await page.click('.av-seg[data-view="stats"]');
  await page.waitForSelector('#aev-b-body svg', { timeout: 10_000 });
}

test.describe('Availability — Stats · evolución', () => {
  test('renderiza la línea SVG y el heatmap calendario', async ({ page }) => {
    await gotoStats(page);

    // Variante B — línea: al menos 1 <svg> con contenido (paths de la curva)
    const svgs = page.locator('#aev-b-body svg.aev-svg');
    await expect(svgs).toHaveCount(1);
    await expect(page.locator('#aev-b-body svg .pct-line')).toHaveCount(1);

    // Variante C — heatmap: al menos 1 celda con día (no las vacías de lead)
    const cells = page.locator('#aev-c-grid .hm-cell:not(.empty)');
    expect(await cells.count()).toBeGreaterThan(0);

    // Leyenda de estados poblada (6 ítems)
    await expect(page.locator('#aev-legend .it')).toHaveCount(6);
  });

  test('NO queda el área-chart Chart.js de evolución (lo reemplazamos)', async ({ page }) => {
    await gotoStats(page);
    // El canvas del trend fue removido; el donut sigue.
    await expect(page.locator('#avStatsTrend')).toHaveCount(0);
    await expect(page.locator('#avStatsDonut')).toHaveCount(1);
  });

  test('el donut y el ranking ordenable siguen presentes', async ({ page }) => {
    await gotoStats(page);
    await expect(page.locator('#avStatsTable')).toHaveCount(1);
    expect(await page.locator('#avStatsTbody tr').count()).toBeGreaterThan(0);
  });

  test('cambiar el rango de la página cambia la cantidad de días', async ({ page }) => {
    await gotoStats(page);

    // Microciclo = 14→21 may 2026 = 8 días
    const cells = page.locator('#aev-c-grid .hm-cell:not(.empty)');
    await expect(cells).toHaveCount(8);

    // Cambiar el rango de la página a "Última semana" (7 días) vía su propio
    // control. avSetPreset llama init(), que recalcula la serie y re-renderiza
    // Stats (sigue visible).
    await page.evaluate(() => window.avSetPreset('7'));
    await expect(cells).toHaveCount(7);
  });

  test('el filtro de fecha dentro de Stats adapta la serie', async ({ page }) => {
    await gotoStats(page);

    const cells = page.locator('#aev-c-grid .hm-cell:not(.empty)');
    const segs  = page.locator('#aevRangeSegs .aev-seg');

    // Microciclo activo por defecto (8 días)
    await expect(segs.filter({ hasText: 'Microciclo' })).toHaveClass(/is-on/);
    await expect(cells).toHaveCount(8);

    // Click en "1 semana" desde la propia barra de Stats → 7 días + resaltado
    await page.click('#aevRangeSegs .aev-seg[data-range="7"]');
    await expect(cells).toHaveCount(7);
    await expect(page.locator('#aevRangeSegs .aev-seg[data-range="7"]')).toHaveClass(/is-on/);
  });
});
