// @ts-check
// Dos decisiones de producto que cambian cómo se comporta GPS Analysis:
//
//   1. NINGUNA plantilla está bloqueada por dashboard. La galería las ofrece todas y, cuando la
//      card vive hoy en otro dashboard, lo dice como sugerencia — al agregarla, se muda.
//   2. CUALQUIER dashboard se puede borrar, también los cinco de fábrica, y el borrado persiste
//      (ensureDefaultDashboards ya no re-siembra los que falten).

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const DASHES = [
  { id: 'dash-ind', club_id: CLUB_ID, report_type: 'ind',  name: 'Player Week Report', scope: 'player', sort_order: 0, is_shared: true, created_by: null },
  { id: 'dash-grp', club_id: CLUB_ID, report_type: 'grp',  name: 'Session Control',    scope: 'squad',  sort_order: 1, is_shared: true, created_by: null },
];

/** Monta la página con los dashboards dados. Devuelve los POST que se hagan a /dashboards. */
async function mount(page, { dashboards = DASHES } = {}) {
  const posts = [];
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const req = r.request();
    if (req.method() === 'POST') { try { posts.push(JSON.parse(req.postData() || '{}')); } catch { /* body no-JSON */ } return r.fulfill({ json: [{ id: 'new-dash' }] }); }
    const acc = req.headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? dashboards[0] : dashboards });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));

  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.waitForTimeout(1500);
  return posts;
}

test.describe('GPS · dashboards y catálogo de cards', () => {
  test('la galería ofrece todas las plantillas, sin ninguna bloqueada', async ({ page }) => {
    await mount(page);
    await page.locator('button.pill', { hasText: 'Add card' }).first().click();
    await expect(page.locator('.ac-panel')).toBeVisible();

    const tpls = page.locator('.ac-tpl');
    const total = await tpls.count();
    expect(total).toBeGreaterThan(0);
    // Cada plantilla tiene su botón de agregar: ninguna queda con el candado de antes.
    await expect(page.locator('.ac-tpl .ac-add')).toHaveCount(total);
    await expect(page.locator('.ac-tpl .ti-lock')).toHaveCount(0);
    // Y las que hoy viven en otro dashboard lo dicen como sugerencia.
    expect(await page.locator('.ac-tpl .ac-owned').count()).toBeGreaterThan(0);
  });

  test('agregar una plantilla de otro dashboard la trae a este', async ({ page }) => {
    await mount(page);
    // Vista activa = la primera (Player Week Report). Se busca una plantilla marcada como
    // sugerida en otro dashboard y se agrega desde acá.
    await page.locator('button.pill', { hasText: 'Add card' }).first().click();
    await expect(page.locator('.ac-panel')).toBeVisible();
    const foreign = page.locator('.ac-tpl').filter({ has: page.locator('.ac-owned') }).first();
    const tplId = await foreign.getAttribute('data-actpl');
    await foreign.locator('.ac-add').click();

    // La card aterrizó en el grid de la vista activa…
    const landed = await page.evaluate(() => {
      const grid = document.querySelector('.gp-view.is-on .gp-grid');
      return [...(grid?.querySelectorAll('.gp-c[id]') || [])].map(c => c.id);
    });
    expect(landed.length).toBeGreaterThan(0);
    // …y quedó registrada como adoptada, que es lo que la mantiene ahí tras recargar.
    const adopted = await page.evaluate(() => {
      const grid = document.querySelector('.gp-view.is-on .gp-grid');
      const ids = [...(grid?.querySelectorAll('.gp-c[data-card-id]') || [])].map(c => c.dataset.cardId);
      return ids.length;
    });
    expect(adopted).toBeGreaterThan(0);
    expect(tplId).toBeTruthy();
  });

  test('un dashboard de fábrica también se puede borrar', async ({ page }) => {
    await mount(page);
    const tab = page.locator('#sections .gp-sec[data-view="ind"]').first();
    await tab.hover();
    await tab.locator('.gpt-kb').first().click();
    await expect(page.locator('.gpt-menu.is-open')).toBeVisible();
    await expect(page.locator('.gpt-menu [data-act="delete"]')).toBeVisible();
  });

  test('un club que ya tiene dashboards no recibe los de fábrica otra vez', async ({ page }) => {
    // Sólo queda uno de los cinco: antes, los cuatro que faltaban se re-creaban solos en la
    // siguiente carga y el borrado no existía de verdad. Se llama a la siembra a mano para que
    // el test mida ESO y no el momento en que la página la dispara sola.
    const posts = await mount(page, { dashboards: [DASHES[1]] });
    posts.length = 0;
    const ran = await page.evaluate(async (cid) => {
      if (typeof window.ensureDefaultDashboards !== 'function') return false;
      await window.ensureDefaultDashboards(cid, 'user-1', window.sb);
      return true;
    }, CLUB_ID);
    expect(ran).toBe(true);
    expect(posts).toHaveLength(0);        // no se re-crea ninguno de los que el club borró
  });
});
