// @ts-check
// Título de las cards del builder — cobertura del bug real «no se puede cambiar el
// título de la tabla»: el draft conservaba sus ids (gpbDraftTitle/gpbDraftBody) al
// guardarse, y al armar la SIGUIENTE card los getElementById apuntaban a la card
// ANTERIOR (título y preview se escribían en la equivocada). Además cubre el título
// editable inline (contenteditable en el header del draft) y el flujo de renombrado.
import { test, expect } from '@playwright/test';
import { SB, MICROCYCLE, injectSession } from './_shared.js';

const METRICS = [
  { key: 'total_distance', label: 'Total Distance', unit: 'm',    kind: 'accum', category: 'distance', is_core: true, display_order: 1, squad_rollup: true },
  { key: 'max_speed',      label: 'Max Speed',      unit: 'km/h', kind: 'peak',  category: 'speed',    is_core: true, display_order: 6, squad_rollup: true },
];

async function gotoGps(page) {
  await page.route(`${SB}/rest/v1/**`, route => route.fulfill({
    json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' },
  }));
  await page.route(`${SB}/auth/v1/**`, route => route.fulfill({
    json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } },
  }));
  await page.route(`${SB}/rest/v1/profiles**`, route => route.fulfill({
    json: [{ id: 'user-1', club_id: 'club-1', role: 'admin', full_name: 'Test Admin' }],
  }));
  await page.route(`${SB}/rest/v1/clubs**`, route => route.fulfill({
    json: [{ id: 'club-1', name: 'Test Club' }],
  }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, route => route.fulfill({
    json: [{ club_id: 'club-1', baseline_n: 5, baseline_mode: 'personal', active_metrics: null, gps_builder_enabled: true }],
  }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, route => route.fulfill({ json: METRICS }));
  await page.route(`${SB}/rest/v1/microcycles**`, route => route.fulfill({ json: [MICROCYCLE] }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForLoadState('networkidle');
  // el builder espera window._gpClubId (lo setea el boot real de la página) → forzarlo
  await page.evaluate(() => { window._gpClubId = 'club-1'; });
  await page.waitForFunction(() => document.getElementById('gpbPanel'), null, { timeout: 8000 });
}

async function openWith(page, viz) {
  await page.evaluate((v) => {
    const keys = [...window.GpBuilder.catalogMap.keys()];
    window.openBuilderWithConfig({
      schema: 'gp.card/v1',
      viz: v,
      scope: { level: 'squad' },
      metrics: keys.slice(0, 2).map((id, i) => ({ id, agg: i ? 'avg' : 'total' })),
      dimensions: v === 'table' ? [{ id: 'player_name' }] : [],
      range: { type: 'season' },
      comparison: { baseline: 'none' },
      style: { size: 'md', color: '#15803D' },
      title: 'Auto title',
    });
  }, viz);
  await expect(page.locator('#gpbDDTitle')).toBeVisible({ timeout: 5000 });
}

for (const viz of ['table', 'bars', 'kpi']) {
  test(`título editable en ${viz}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await gotoGps(page);
    await openWith(page, viz);

    const inp = page.locator('#gpbDDTitle');
    await inp.click();
    await inp.fill('MI TITULO CUSTOM');

    // 1) el header del draft refleja el título tipeado
    await expect(page.locator('#gpbDraftTitle')).toHaveText('MI TITULO CUSTOM', { timeout: 3000 });

    // 2) el config que se guardaría lo lleva
    const cfg = await page.evaluate(() => window.GpBuilder.currentConfig());
    expect(cfg.title).toBe('MI TITULO CUSTOM');
    expect(cfg.titleCustom).toBe(true);

    // 3) guardar → la card guardada muestra el título custom
    const save = page.locator('#gpbSave');
    await expect(save).toBeEnabled();
    await save.click();
    const ttl = page.locator('.gp-view.is-on .gp-c[data-card="chart"] .ttl').last();
    if (viz !== 'kpi') await expect(ttl).toHaveText('MI TITULO CUSTOM');

    expect(errors, errors.join('\n')).toHaveLength(0);
  });
}

test('SEGUNDA card: el título no debe escribirse en la card anterior', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await gotoGps(page);

  // Card A: guardarla con nombre propio
  await openWith(page, 'bars');
  await page.locator('#gpbDDTitle').fill('CARD A');
  await page.locator('#gpbSave').click();
  const cards = page.locator('.gp-view.is-on .gp-c[data-card="chart"]');
  await expect(cards.last().locator('.ttl')).toHaveText('CARD A');
  const idxA = await cards.count() - 1;
  const cardA = cards.nth(idxA);   // índice fijo: .last() es vivo y luego apuntaría a B

  // Card B: nueva tabla; tipear el título en el input del panel
  await openWith(page, 'table');
  await page.locator('#gpbDDTitle').fill('CARD B');

  // el título de A NO debe cambiar; el draft de B SÍ
  await expect(cardA.locator('.ttl')).toHaveText('CARD A');
  const draftB = page.locator('.gp-view.is-on .gp-c.is-editing .ttl, .gp-view.is-on .gp-c:not([data-card]) .ttl').last();
  await expect(draftB).toHaveText('CARD B');

  await page.locator('#gpbSave').click();
  await expect(cardA.locator('.ttl')).toHaveText('CARD A');
  const cardB = page.locator('.gp-view.is-on .gp-c[data-card="chart"]').last();
  await expect(cardB.locator('.ttl')).toHaveText('CARD B');

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('renombrar INLINE clickeando el título del draft (tabla)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await gotoGps(page);
  await openWith(page, 'table');

  const ttl = page.locator('#gpbDraftTitle');
  await expect(ttl).toHaveAttribute('contenteditable', /plaintext-only|true/);
  await ttl.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('RENOMBRADA INLINE');
  await page.keyboard.press('Enter');

  // sincroniza el input del panel y el config
  await expect(page.locator('#gpbDDTitle')).toHaveValue('RENOMBRADA INLINE');
  const cfg = await page.evaluate(() => window.GpBuilder.currentConfig());
  expect(cfg.title).toBe('RENOMBRADA INLINE');
  expect(cfg.titleCustom).toBe(true);

  // guardar → la card queda con el nombre y SIN contenteditable
  await page.locator('#gpbSave').click();
  const saved = page.locator('.gp-view.is-on .gp-c[data-card="chart"] .ttl').last();
  await expect(saved).toHaveText('RENOMBRADA INLINE');
  await expect(saved).not.toHaveAttribute('contenteditable', /.+/);

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('renombrar una TABLA ya guardada (flujo editar)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await gotoGps(page);
  await openWith(page, 'table');

  // guardar con título custom inicial
  await page.locator('#gpbDDTitle').fill('ALL VALUES');
  await page.locator('#gpbSave').click();
  const card = page.locator('.gp-view.is-on .gp-c[data-card="chart"]').last();
  await expect(card.locator('.ttl')).toHaveText('ALL VALUES');

  // reabrir en modo edición y renombrar
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.gp-view.is-on .gp-c[data-card="chart"]');
    window.GpBuilder.openForEdit(cards[cards.length - 1]);
  });
  const inp = page.locator('#gpbDDTitle');
  await expect(inp).toBeVisible();
  await expect(inp).toHaveValue('ALL VALUES');   // el título custom debe venir seedeado
  await inp.fill('TITULO NUEVO');
  await expect(page.locator('.gp-view.is-on .gp-c.is-editing .ttl, #gpbDraftTitle').first()).toHaveText('TITULO NUEVO');
  await page.locator('#gpbSave').click();
  await expect(card.locator('.ttl')).toHaveText('TITULO NUEVO');

  expect(errors, errors.join('\n')).toHaveLength(0);
});
