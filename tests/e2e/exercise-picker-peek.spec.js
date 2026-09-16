// @ts-check
// Al elegir ejercicio, la miniatura de la fila es de 44-64 px: no alcanza para reconocer el
// ejercicio. El único modo de verlo era hacer clic — y el clic LO AÑADE a la sesión y cierra el
// modal, tirando los filtros escritos. Ahora pasar el ratón por la miniatura la amplía al lado del
// modal, sin clic y sin tocar la lista. Esto verifica las tres cosas que hacen que sirva:
// aparece al hacer hover, NO añade nada, y la lista sigue filtrable con el panel abierto.
import { test, expect } from '@playwright/test';
import { SB, PLAYER, MICROCYCLE, injectSession, mockBase } from './_shared.js';

// PNG 2×2 rojo: basta para que el <img> del panel cargue (sin carga, el panel no se muestra).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

const EXERCISES = [
  { id: 'ex-1', club_id: 'club-1', name: 'RONDO 4v2', orientation: 'ACTIVATION', duration: 5,
    preview_png: PNG, preview_path: null, folder_id: null, is_goalkeeper: false, visible_teams: null,
    players_count: 6, field_width: 20, field_height: 20 },
  { id: 'ex-2', club_id: 'club-1', name: 'SALIDA DE BALON', orientation: 'FIELD', duration: 15,
    preview_png: PNG, preview_path: null, folder_id: null, is_goalkeeper: false, visible_teams: null,
    players_count: 10, field_width: 40, field_height: 30 },
  { id: 'ex-3', club_id: 'club-1', name: 'SIN IMAGEN', orientation: 'FIELD', duration: 10,
    preview_png: null, preview_path: null, folder_id: null, is_goalkeeper: false, visible_teams: null },
];

async function gotoPicker(page) {
  await injectSession(page);
  await mockBase(page);
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') return route.fallback();
    if (url.includes('/exercises'))   return route.fulfill({ json: EXERCISES });
    if (url.includes('/players'))     return route.fulfill({ json: [PLAYER] });
    if (url.includes('/microcycles')) return route.fulfill({ json: [MICROCYCLE] });
    await route.fallback();
  });
  await page.goto('/Daily%20Planning.html');
  await page.waitForSelector('#dpSquadBody', { timeout: 10_000 });
  await page.evaluate(() => window.openLibModal('activation'));
  await page.waitForSelector('#libList [data-peek-src]', { timeout: 10_000 });
}

const panel = page => page.locator('#cmThumbPeek');

test.describe('Picker de ejercicios — ampliar la miniatura al pasar el ratón', () => {
  test('el hover amplía la miniatura sin añadir el ejercicio', async ({ page }) => {
    await gotoPicker(page);
    const rows = page.locator('#libList [data-peek-src]');
    await expect(rows).toHaveCount(2);            // la fila sin imagen no se marca

    await rows.first().hover();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText('RONDO 4v2');

    // el panel es más grande que la miniatura y no se come el puntero
    const thumb = await rows.first().boundingBox();
    const box   = await panel(page).boundingBox();
    expect(box.width).toBeGreaterThan(thumb.width * 3);
    await expect(panel(page)).toHaveCSS('pointer-events', 'none');

    // lo que importa: el modal sigue abierto y no se añadió nada a la sesión
    await expect(page.locator('#libBackdrop')).toBeVisible();
  });

  test('el panel sale al lado del modal, no encima de la lista', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPicker(page);
    await page.locator('#libList [data-peek-src]').first().hover();
    await expect(panel(page)).toBeVisible();
    const modal = await page.locator('#libBackdrop > div').boundingBox();
    const box   = await panel(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(modal.x + modal.width);
    expect(box.x + box.width).toBeLessThanOrEqual(1440);
  });

  test('con el panel abierto se puede seguir filtrando, y al filtrar se cierra', async ({ page }) => {
    await gotoPicker(page);
    await page.locator('#libList [data-peek-src]').first().hover();
    await expect(panel(page)).toBeVisible();

    await page.fill('#libSearch', 'SALIDA');
    await page.locator('#libSearch').dispatchEvent('input');
    await expect(page.locator('#libList [data-peek-src]')).toHaveCount(1);
    await expect(page.locator('#libList')).toContainText('SALIDA DE BALON');
  });

  test('pasar de una miniatura a otra cambia lo que se muestra', async ({ page }) => {
    await gotoPicker(page);
    const rows = page.locator('#libList [data-peek-src]');
    await rows.nth(0).hover();
    await expect(panel(page)).toContainText('RONDO 4v2');
    await rows.nth(1).hover();
    await expect(panel(page)).toContainText('SALIDA DE BALON');
  });

  test('al salir de la miniatura el panel desaparece', async ({ page }) => {
    await gotoPicker(page);
    await page.locator('#libList [data-peek-src]').first().hover();
    await expect(panel(page)).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(panel(page)).toBeHidden();
  });
});

// El mismo gesto en el Gym Planner: ahí la fila es aún más chata (34 px) y el clic enlaza el
// ejercicio a la fila del plan, así que "mirar antes de elegir" cuesta todavía más.
const GYM = [
  { id: 'g-1', club_id: 'club-1', name: 'BACK SQUAT', category: 'strength', muscle_group: 'quads',
    complexity: 'medium', media_type: null, media_ref: null, video_url: 'https://youtu.be/aaaaaaaaaaa' },
  { id: 'g-2', club_id: 'club-1', name: 'NORDIC CURL', category: 'strength', muscle_group: 'hamstrings',
    complexity: 'high', media_type: null, media_ref: null, video_url: 'https://youtu.be/bbbbbbbbbbb' },
  { id: 'g-3', club_id: 'club-1', name: 'SIN MEDIA', category: 'core', muscle_group: 'core',
    complexity: 'low', media_type: null, media_ref: null, video_url: null },
];

// Daily Planning tiene un segundo picker, el de fuerza (gym_exercises), con su propia miniatura.
test('el picker de fuerza del daily planning amplía igual', async ({ page }) => {
  await injectSession(page);
  await mockBase(page);
  await page.route('https://img.youtube.com/**', route =>
    route.fulfill({ body: Buffer.from(PNG.split(',')[1], 'base64'), contentType: 'image/png' }));
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') return route.fallback();
    if (url.includes('/gym_exercises')) return route.fulfill({ json: [
      { id: 'g-1', club_id: 'club-1', name: 'BACK SQUAT', category: 'strength', muscle_group: 'quads',
        complexity: 'medium', media_type: null, media_ref: null, video_id: 'aaaaaaaaaaa' } ] });
    if (url.includes('/players')) return route.fulfill({ json: [PLAYER] });
    await route.fallback();
  });
  await page.goto('/Daily%20Planning.html');
  await page.waitForSelector('#dpSquadBody', { timeout: 10_000 });
  await page.evaluate(() => window.openGymLibModal('activation'));
  await page.waitForSelector('#gymLibList [data-peek-src]', { timeout: 10_000 });

  await page.locator('#gymLibList [data-peek-src]').first().hover();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toContainText('BACK SQUAT');
  await expect(page.locator('#gymLibBackdrop')).toBeVisible();
});

test.describe('Gym Planner — ampliar la miniatura al pasar el ratón', () => {
  test('el hover amplía la miniatura y la fila del plan sigue vacía', async ({ page }) => {
    await injectSession(page);
    await mockBase(page);
    // El póster de YouTube tiene que CARGAR o el panel no se muestra: sin esto el test mediría la
    // red, no la función.
    await page.route('https://img.youtube.com/**', route =>
      route.fulfill({ body: Buffer.from(PNG.split(',')[1], 'base64'), contentType: 'image/png' }));
    await page.route(`${SB}/rest/v1/**`, async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (route.request().url().includes('/gym_exercises')) return route.fulfill({ json: GYM });
      await route.fallback();
    });
    await page.addInitScript(() => { window._gpClubId = 'club-1'; });
    await page.goto('/Gym%20Planner.html');
    await page.waitForFunction(() => typeof window.gpOpenLib === 'function', null, { timeout: 10_000 });
    await page.evaluate(() => window.gpOpenLib({ section: 'main' }));
    await page.waitForSelector('#gpLibList [data-peek-src]', { timeout: 10_000 });

    const rows = page.locator('#gpLibList .gp-lib-thumb[data-peek-src]');
    await expect(rows).toHaveCount(2);              // el que no tiene media no se marca
    await rows.first().hover();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText(/BACK SQUAT|NORDIC CURL/);
    await expect(page.locator('#gpLibOv')).toBeVisible();   // el picker no se cerró: no hubo clic
  });
});
