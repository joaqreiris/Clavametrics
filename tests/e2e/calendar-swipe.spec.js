// @ts-check
// Deslizar sobre la tira de días cambia de microciclo (sin pasar por el ribbon).
import { test, expect } from '@playwright/test';

const SB = 'https://xesrumijvdmqjrufgeka.supabase.co';

// Dos micros consecutivos, lejos de hoy para que el arranque caiga en el índice 0.
// La app los pide ordenados por start_date DESC, así que el mock los devuelve así.
const MC_NEW = {
  id: 'mc-2', name: 'MC 02', start_date: '2026-05-22', end_date: '2026-05-28',
  match_date: '2026-05-27', rival: 'Racing', home_away: 'away', color: '#3B82F6',
};
const MC_OLD = {
  id: 'mc-1', name: 'MC 01', start_date: '2026-05-14', end_date: '2026-05-21',
  match_date: '2026-05-20', rival: 'Atlético', home_away: 'home', color: '#C9A84C',
};

async function injectSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-xesrumijvdmqjrufgeka-auth-token',
      JSON.stringify({
        access_token: 'test-token', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test-refresh',
        user: { id: 'user-1', email: 'test@test.com', aud: 'authenticated', role: 'authenticated' },
      })
    );
  });
}

async function mockSupabase(page) {
  await page.route(`${SB}/auth/v1/**`, route =>
    route.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (url.includes('/profiles'))
      return route.fulfill({ json: [{ id: 'user-1', club_id: 'club-1', name: 'Test User', role: 'coach', club_role: 'Head Coach' }] });
    if (url.includes('/clubs'))
      return route.fulfill({ json: [{ id: 'club-1', name: 'Test FC', accent_color: '#3B82F6' }] });
    if (url.includes('/microcycles'))
      return route.fulfill({ json: [MC_NEW, MC_OLD] });
    if (url.includes('/players'))
      return route.fulfill({ json: [], headers: { 'content-range': '*/5' } });
    if (url.includes('/injuries'))
      return route.fulfill({ json: [], headers: { 'content-range': '*/2' } });
    if (url.includes('/training_sessions'))
      return route.fulfill({ json: [] });
    await route.fallback();   // al mock de abajo, no a la red real
  });
}

async function gotoCalendar(page) {
  await injectSession(page);
  await mockSupabase(page);
  await page.goto('/Calendar.html');
  await page.waitForSelector('.mc-day', { timeout: 10_000 });
  await expect(page.locator('#calMcTitle')).toContainText('MC 02');
}

/** Un gesto horizontal de trackpad sobre la tira de días. */
async function wheelOverGrid(page, deltaX) {
  // hover() ya hace el scroll y busca un punto realmente alcanzable dentro de la tira
  await page.locator('#calDaysGrid .mc-day').first().hover();
  await page.mouse.wheel(deltaX, 0);
}

/** Un swipe de dedo sobre la tira de días. */
async function swipeGrid(page, dx) {
  await page.evaluate(dx => {
    const grid = document.getElementById('calDaysGrid');
    const mk = (type, x) => {
      const t = new Touch({ identifier: 1, target: grid, clientX: x, clientY: 300 });
      return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
    };
    grid.dispatchEvent(mk('touchstart', 400));
    grid.dispatchEvent(mk('touchmove',  400 + dx));
    grid.dispatchEvent(mk('touchend',   400 + dx));
  }, dx);
}

test.describe('Swipe entre microciclos', () => {
  test('el gesto horizontal del trackpad retrocede un microciclo', async ({ page }) => {
    await gotoCalendar(page);
    await wheelOverGrid(page, -200);   // hacia atrás en el tiempo
    await expect(page.locator('#calMcTitle')).toContainText('MC 01');
    // y la tira arranca por el primer día del micro al que saltó
    await expect(page.locator('#calDaysGrid .mc-day').first()).toHaveAttribute('data-date', MC_OLD.start_date);
  });

  test('vuelve hacia adelante con el gesto contrario', async ({ page }) => {
    await gotoCalendar(page);
    await wheelOverGrid(page, -200);
    await expect(page.locator('#calMcTitle')).toContainText('MC 01');
    await page.waitForTimeout(400);    // dejar morir el momentum del gesto anterior
    await wheelOverGrid(page, 200);
    await expect(page.locator('#calMcTitle')).toContainText('MC 02');
  });

  test('en el último microciclo el gesto no salta al vacío', async ({ page }) => {
    await gotoCalendar(page);
    await wheelOverGrid(page, 200);    // MC 02 es el más nuevo: no hay siguiente
    await page.waitForTimeout(500);
    await expect(page.locator('#calMcTitle')).toContainText('MC 02');
  });

  test('un gesto corto no cambia de microciclo', async ({ page }) => {
    await gotoCalendar(page);
    await wheelOverGrid(page, -40);
    await page.waitForTimeout(500);
    await expect(page.locator('#calMcTitle')).toContainText('MC 02');
  });

  test('el swipe con el dedo retrocede un microciclo', async ({ page }) => {
    await gotoCalendar(page);
    await swipeGrid(page, 140);        // dedo hacia la derecha = atrás en el tiempo
    await expect(page.locator('#calMcTitle')).toContainText('MC 01');
  });

  test('el swipe corto con el dedo no cambia nada', async ({ page }) => {
    await gotoCalendar(page);
    await swipeGrid(page, 30);
    await page.waitForTimeout(500);
    await expect(page.locator('#calMcTitle')).toContainText('MC 02');
  });

  test('el chip activo del ribbon sigue al microciclo mostrado', async ({ page }) => {
    await gotoCalendar(page);
    await wheelOverGrid(page, -200);
    await expect(page.locator('#calMcTitle')).toContainText('MC 01');
    await expect(page.locator('#calV2Cycles .mc-chip--active')).toHaveCount(1);
    await expect(page.locator('#calV2Cycles .mc-chip--active')).toHaveAttribute('data-mc-id', 'mc-1');
  });
});
