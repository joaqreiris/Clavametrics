// @ts-check
// El panel de estilo ofrecía «Ejes», «Leyenda» y «Valores sobre el gráfico» para TODOS los tipos,
// pero cada renderer sólo lee los que le sirven: un KPI no tiene ejes, una tabla ya muestra los
// valores en sus celdas. Eran botones que no hacían nada. Esto fija qué ve cada tipo.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 60_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };

async function open(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.locator('#gpbOpenBtn').first().click();
  await page.waitForTimeout(600);
}

/** Interruptores del panel de estilo visibles para el tipo elegido. */
async function togglesDe(page, tipo) {
  await page.locator(`[data-type="${tipo}"]`).first().click();
  await page.waitForTimeout(250);
  await page.locator('[data-tab="style"]').first().click();
  await page.waitForTimeout(250);
  return page.evaluate(() => [...document.querySelectorAll('[data-toggle]')]
    .filter(b => b.offsetParent !== null)
    .map(b => b.dataset.toggle));
}

test.describe('GPS · el panel de estilo no ofrece botones muertos', () => {
  test('un KPI no ofrece ejes, leyenda ni valores sobre el gráfico', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'kpi');
    expect(t).not.toContain('axes');
    expect(t).not.toContain('legend');
    expect(t).not.toContain('labels');
  });

  test('una tabla tampoco: sus valores ya son las celdas', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'table');
    expect(t).not.toContain('axes');
    expect(t).not.toContain('legend');
    expect(t).not.toContain('labels');
  });

  test('las barras sí ofrecen los tres, que es donde hacen algo', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'bars');
    expect(t).toContain('axes');
    expect(t).toContain('legend');
    expect(t).toContain('labels');
  });

  test('la caja ofrece ejes pero no leyenda: dibuja una sola métrica', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'box');
    expect(t).toContain('axes');
    expect(t).not.toContain('legend');
  });
});
