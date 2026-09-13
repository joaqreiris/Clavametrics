// @ts-check
// Admin → Categorías del club: el campo "Nivel" (teams.category).
//
// Existe porque la columna sin editor es una columna muerta: Club overview la muestra y nadie
// la puede cargar. Esto comprueba que se pinta, que guarda lo que se escribe y que vaciarla
// manda NULL y no la cadena vacía — "sin clasificar" y "clasificado como nada" no son lo mismo.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const ADMIN = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: 'Owner', full_name: 'Test Admin', first_name: 'Test', last_name: 'Admin' };
const CLUB = { id: 'club-1', name: 'Test FC' };
const TEAMS = [
  { id: 't-1', name: 'Primera', category: 'Profesional', archived_at: null },
  { id: 't-2', name: 'Juvenil A', category: null, archived_at: null },
  { id: 't-3', name: 'Infantil', category: null, archived_at: '2026-01-01T00:00:00Z' },
];

/** Devuelve los PATCH que la página mandó a /teams. */
async function mount(page) {
  const patches = [];
  const USER = { id: 'user-1', email: 'a@b.c', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };

  // De lo general a lo específico: en Playwright gana la última ruta registrada.
  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', token_type: 'bearer', expires_in: 3600, refresh_token: 'rt', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));
  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url(), acc = route.request().headers()['accept'] || '';
    const method = route.request().method();
    if (url.includes('/rest/v1/teams')) {
      if (method === 'PATCH') {
        patches.push({ url, body: route.request().postDataJSON() });
        return route.fulfill({ json: [] });
      }
      return route.fulfill({ json: TEAMS });
    }
    if (url.includes('/rest/v1/profiles')) return route.fulfill({ json: acc.includes('pgrst.object') ? ADMIN : [ADMIN] });
    if (url.includes('/rest/v1/clubs')) return route.fulfill({ json: acc.includes('pgrst.object') ? CLUB : [CLUB] });
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));

  await page.addInitScript(() => { try { localStorage.setItem('cm_lang', 'es'); } catch { /* sin storage */ } });
  await injectSession(page);
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('/Admin.html', { waitUntil: 'domcontentloaded' });
  // El listado vive dentro del modal de categorías; se abre por su función global.
  await page.waitForFunction(() => typeof window.renderClubCategories === 'function' || !!document.getElementById('catList'), null, { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => {
    const b = document.getElementById('addCategoryBackdrop');
    if (b) b.style.display = 'flex';
    if (typeof window.renderClubCategories === 'function') window.renderClubCategories();
  });
  await expect(page.locator('#catList input[onchange*="saveCategoryLevel"]').first()).toBeVisible({ timeout: 15_000 });
  return patches;
}

test.describe('Admin — nivel de categoría', () => {
  test('se pinta un campo por categoría activa, con su valor', async ({ page }) => {
    await mount(page);
    const inputs = page.locator('#catList input[onchange*="saveCategoryLevel"]');
    // Dos activas; la archivada no lleva campo (no se reclasifica lo que está guardado).
    await expect(inputs).toHaveCount(2);
    await expect(inputs.nth(0)).toHaveValue('Profesional');
    await expect(inputs.nth(1)).toHaveValue('');
  });

  test('escribir un nivel lo guarda', async ({ page }) => {
    const patches = await mount(page);
    const vacio = page.locator('#catList input[onchange*="saveCategoryLevel"]').nth(1);
    await vacio.fill('Formativa');
    await vacio.blur();
    await expect.poll(() => patches.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(patches[patches.length - 1].body).toEqual({ category: 'Formativa' });
  });

  test('vaciarlo manda NULL, no una cadena vacía', async ({ page }) => {
    const patches = await mount(page);
    const lleno = page.locator('#catList input[onchange*="saveCategoryLevel"]').nth(0);
    await lleno.fill('   ');
    await lleno.blur();
    await expect.poll(() => patches.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(patches[patches.length - 1].body).toEqual({ category: null });
  });
});
