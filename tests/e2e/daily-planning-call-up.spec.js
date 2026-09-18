// @ts-check
// El llamado de otra categoría tiene que entrar al día que fue llamado — y solo a ese.
// La llamada es por fecha (player_call_ups, migración 185): el roster se recompone en cada
// cambio de día, así que cambiar de día es parte de lo que hay que probar.
import { test, expect } from '@playwright/test';
import { SB, PLAYER, MICROCYCLE, injectSession, mockBase } from './_shared.js';

const GUEST = { id: 'p-9', club_id: 'club-1', first_name: 'Nico', last_name: 'Zeta', number: 30, position: 'CM' };

/** YYYY-MM-DD local (el mismo criterio que usa la página para "hoy"). */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function mockDP(page, callDay) {
  await mockBase(page);
  // Sin equipo activo no hay llamadas que pedir (la llamada es a UN equipo): hay que mockear
  // /teams y my_team_ids o la página se queda con _dpTeamId null y el spec culpa al roster.
  await page.route(`${SB}/rest/v1/rpc/**`, route => route.fulfill({ json: ['team-1'] }));
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') return route.fallback();

    if (url.includes('/player_call_ups')) {
      // La llamada existe SOLO para callDay: el mock respeta el filtro de fecha porque es
      // justamente lo que se está probando (si contestara siempre lo mismo, el test pasaría
      // incluso con el roster recompuesto mal).
      const m = url.match(/date=(?:eq|gte)\.(\d{4}-\d{2}-\d{2})/);
      const d = m ? m[1] : null;
      return route.fulfill({ json: d === callDay ? [{ player_id: 'p-9', date: callDay }] : [] });
    }
    // Fichas de los llamados: por id, sin join de membresía.
    if (url.includes('/players') && /id=in\./.test(url)) return route.fulfill({ json: [GUEST] });
    if (url.includes('/players'))           return route.fulfill({ json: [PLAYER] });
    if (url.includes('/availability'))      return route.fulfill({ json: [{ player_id: 'p-1', status: 'available', notes: null }] });
    if (url.includes('/injuries'))          return route.fulfill({ json: [] });
    if (url.includes('/treatments'))        return route.fulfill({ json: [] });
    if (url.includes('/microcycles'))       return route.fulfill({ json: [MICROCYCLE] });
    if (url.includes('/teams'))             return route.fulfill({ json: [{ id: 'team-1', club_id: 'club-1', name: 'First Team' }] });
    if (url.includes('/training_sessions')) return route.fulfill({ json: [] });
    await route.fallback();
  });
}

test.describe('Daily Planning — llamados de otra categoría', () => {
  test('el llamado entra al día de la llamada, marcado, y no está al día siguiente', async ({ page }) => {
    const today = ymd(new Date());
    await injectSession(page);
    await mockDP(page, today);
    await page.goto('/Daily%20Planning.html');
    await page.waitForSelector('#dpSquadBody', { timeout: 15_000 });

    const guest = page.locator('#dpSquadBody .dp-player[data-pid="p-9"]');
    await expect(guest).toHaveCount(1);
    await expect(guest).toHaveClass(/is-calledup/);          // se distingue del plantel
    // El del plantel sigue ahí y sin la marca.
    await expect(page.locator('#dpSquadBody .dp-player[data-pid="p-1"]')).toHaveCount(1);
    await expect(page.locator('#dpSquadBody .dp-player[data-pid="p-1"]')).not.toHaveClass(/is-calledup/);

    // Al día siguiente no hay llamada: el plantel vuelve a ser el de siempre.
    const tomorrow = ymd(new Date(Date.now() + 86400000));
    await page.fill('#dpDateInput', tomorrow);
    await page.dispatchEvent('#dpDateInput', 'change');
    await expect(page.locator('#dpSquadBody .dp-player[data-pid="p-9"]')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('#dpSquadBody .dp-player[data-pid="p-1"]')).toHaveCount(1);
  });
});
