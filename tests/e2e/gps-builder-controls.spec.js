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

// ── Orden del panel ────────────────────────────────────────────────────────────
// El panel seguía el orden en que se fue construyendo: las opciones de scatter caían en cuatro
// posiciones salteadas, con las de box plot en el medio, y el tamaño de la card entre los colores
// y los ejes. Ahora va por grupos. Lo que estos tests cuidan es lo que se rompe al mover bloques:
// que no quede un título de grupo sin nada debajo, y que las de un tipo no vuelvan a dispersarse.

/** Títulos de grupo VISIBLES del panel de estilo, en orden. */
const gruposDe = async (page, tipo) => {
  await page.locator(`[data-type="${tipo}"]`).first().click();
  await page.waitForTimeout(250);
  await page.locator('[data-tab="style"]').first().click();
  await page.waitForTimeout(250);
  return page.evaluate(() => [...document.querySelectorAll('.pane[data-pane="style"] .es-sec')]
    .filter(sec => sec.offsetParent !== null)
    .map(sec => sec.querySelector('.lab')?.textContent?.trim() || '')
    .filter(Boolean));
};

test.describe('GPS · el panel de estilo va por grupos', () => {
  test('de los colores a la card, en ese orden', async ({ page }) => {
    await open(page);
    const g = await gruposDe(page, 'bars');
    const i = (re) => g.findIndex(x => re.test(x));
    const colores = i(/colors|colores/i), lee = i(/what the chart|qué se lee/i),
          tipo = i(/this chart type|de este tipo/i), card = i(/the card|la card/i);
    expect(colores, 'falta el grupo de colores').toBeGreaterThanOrEqual(0);
    expect(colores).toBeLessThan(lee);
    expect(lee).toBeLessThan(tipo);
    expect(tipo).toBeLessThan(card);
  });

  test('las de scatter quedan juntas en un solo bloque', async ({ page }) => {
    await open(page);
    await gruposDe(page, 'scatter');
    const n = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('.pane[data-pane="style"] .es-sec')]
        .find(s => /this chart type|de este tipo/i.test(s.querySelector('.lab')?.textContent || ''));
      return sec ? [...sec.querySelectorAll('.es-toggle')].filter(t => t.offsetParent !== null).length : -1;
    });
    // contenido de etiqueta, fotos, tooltip y cuadrantes: las cuatro, sin nada de otro tipo en medio
    expect(n).toBe(4);
  });

  test('un tipo sin opciones propias no muestra el grupo vacío', async ({ page }) => {
    await open(page);
    const g = await gruposDe(page, 'radar');   // radar no tiene ninguna opción suya
    expect(g.some(t => /this chart type|de este tipo/i.test(t))).toBe(false);
  });
});

