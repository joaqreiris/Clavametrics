// @ts-check
// La barra mostraba los OCHO filtros siempre, casi todos diciendo «All …»: gastaba su ancho en
// avisar que no había ningún filtro puesto, y el último quedaba fuera de pantalla. Ahora muestra
// lo que está filtrado; el resto vive detrás de «Agregar filtro», agrupado por familia.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 60_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];
const PLAYERS = [0, 1].map(i => ({ id: 'p' + i, club_id: CLUB_ID, first_name: 'N' + i, last_name: 'Ape' + i, number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));

async function open(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-fbar-drops', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.waitForTimeout(1500);
}

/** Filtros que se ven en la barra (los ocultos llevan .fb-hidden). */
const visibles = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.gp-fbar-drops .fb-drop')]
    .filter(d => !d.classList.contains('fb-hidden'))
    .map(d => d.dataset.key));

test.describe('GPS · barra de filtros', () => {
  test('arranca mostrando lo que está filtrado, no los ocho', async ({ page }) => {
    await open(page);
    const v = await visibles(page);
    expect(v).toContain('date');            // la fecha siempre tiene rango
    expect(v.length).toBeLessThan(4);       // antes eran 8, todos en una fila con scroll
  });

  test('la barra envuelve: nunca hay scroll horizontal', async ({ page }) => {
    await open(page);
    const scroll = await page.evaluate(() => {
      const el = document.querySelector('.gp-fbar-drops');
      return { over: el.scrollWidth - el.clientWidth, wrap: getComputedStyle(el).flexWrap };
    });
    expect(scroll.wrap).toBe('wrap');
    expect(scroll.over).toBeLessThanOrEqual(1);
  });

  test('«Agregar filtro» ofrece el resto, agrupado por familia', async ({ page }) => {
    await open(page);
    await page.locator('.fb-addfilter').first().click();
    const menu = page.locator('.fb-addmenu.is-open').first();
    await expect(menu).toBeVisible({ timeout: 5_000 });
    // Las tres familias, y dentro de ellas los filtros que no están en la barra.
    const grupos = await menu.locator('.fb-addgroup').allTextContents();
    expect(grupos.length).toBeGreaterThanOrEqual(2);
    await expect(menu.locator('.fb-additem[data-key="work_context"]')).toHaveCount(1);

    // Al elegirlo, aparece en la barra.
    await menu.locator('.fb-additem[data-key="work_context"]').click();
    await expect.poll(async () => (await visibles(page)).includes('work_context'), { timeout: 5_000 }).toBe(true);
  });

  test('un filtro CON valor no se puede esconder', async ({ page }) => {
    await open(page);
    // Se pone un valor a «tipo de sesión» aunque el filtro no esté en la barra…
    await page.evaluate(() => window.gpFilterBar.setValue('session_type', ['training']));
    await page.waitForTimeout(600);
    // …y la barra lo muestra igual: esconder algo que está filtrando sería mentir.
    await expect.poll(async () => (await visibles(page)).includes('session_type'), { timeout: 6_000 }).toBe(true);
  });

  // Los nombres del menú eran los últimos textos de la barra en inglés. Ahora pasan por i18n,
  // igual que los placeholders — y de paso viajan traducidos al informe PDF (describeActive).
  test('el menú habla el idioma del usuario', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('cm_lang', 'es'); } catch { /* sin storage */ } });
    await open(page);
    await page.locator('.fb-addfilter').first().click();
    const menu = page.locator('.fb-addmenu.is-open').first();
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await expect(menu.locator('.fb-additem[data-key="player"]')).toContainText('Jugadores');
    await expect(menu.locator('.fb-additem[data-key="work_context"]')).toContainText('Contexto');
    await expect(menu.locator('.fb-addgroup').first()).toContainText(/tiempo/i);
  });
});
