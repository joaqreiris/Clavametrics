// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, MICROCYCLE, injectSession, mockBase } from './_shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// QUARANTINED (test.fixme): the "Add metric → flyout → save" flow these cover was
// removed when the builder was redesigned into a drag-and-drop pantry. The classic
// #gpbAddMetric button and #gpbFly flyout are gone (see gp-builder.js:6089-6091 —
// "the D&D fields pantry replaces it"); metrics are now dragged from .bdd-field into
// a .bdd-zone inside #gpbDDPane. These tests target removed UI and fail on the current
// build. They are skipped (not deleted) so they document intent and flag the debt.
//
// Rewriting them faithfully is non-trivial: the pantry's metric fields load from the
// builder's internal catalogMap (not the mocked catalog), and Playwright's native
// dragTo crashes the page here — so a reliable rewrite needs a synthetic-DnD harness.
// Best done by whoever owns the pantry redesign, alongside it. Not blocking: the GPS
// Analysis render safety net lives in gps-smoke.spec.js and is green.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock data ─────────────────────────────────────────────────────────────────

const GPS_SETTINGS = {
  club_id: 'club-1',
  baseline_n: 5,
  baseline_mode: 'personal',
  active_metrics: null,
  gps_builder_enabled: true,
};

const METRICS = [
  { key: 'total_distance', label: 'Total Distance', unit: 'm',    kind: 'accum', category: 'distance', is_core: true, display_order: 1, squad_rollup: true },
  { key: 'max_speed',      label: 'Max Speed',      unit: 'km/h', kind: 'peak',  category: 'speed',    is_core: true, display_order: 6, squad_rollup: true },
  { key: 'player_load',    label: 'Player Load',    unit: 'AU',   kind: 'accum', category: 'load',     is_core: true, display_order: 10, squad_rollup: true },
];

const DASHBOARDS = [
  { id: 'dash-1', club_id: 'club-1', report_type: 'ind', name: 'Player Week Report',
    scope: 'player', sort_order: 0, is_shared: true, created_by: null },
];

const DASHBOARD_CARDS = [];

// ── Mock helpers ──────────────────────────────────────────────────────────────

async function mockGpsBuilder(page, opts = {}) {
  const {
    builderEnabled = true,
    metrics        = METRICS,
    dashboards     = DASHBOARDS,
    cards          = DASHBOARD_CARDS,
  } = opts;

  // ── Catch-all (registered first = lowest priority in Playwright LIFO stack) ──
  // Returns empty arrays for any Supabase REST route not specifically mocked below.
  await page.route(`${SB}/rest/v1/**`, route => route.fulfill({
    json: [],
    headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' },
  }));
  await page.route(`${SB}/auth/v1/**`, route => route.fulfill({
    json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } },
  }));

  // ── Base mocks (auth + profile + club) ────────────────────────────────────
  await mockBase(page);

  // ── Specific mocks (registered last = highest priority) ──────────────────

  // club_gps_settings
  await page.route(`${SB}/rest/v1/club_gps_settings**`, route =>
    route.fulfill({ json: [{ ...GPS_SETTINGS, gps_builder_enabled: builderEnabled }] })
  );

  // gps_metric_definitions (catalog)
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, route =>
    route.fulfill({ json: metrics })
  );

  // microcycles
  await page.route(`${SB}/rest/v1/microcycles**`, route =>
    route.fulfill({ json: [MICROCYCLE] })
  );

  // dashboards
  await page.route(`${SB}/rest/v1/dashboards**`, async route => {
    const method = route.request().method();
    if (method === 'GET')    return route.fulfill({ json: dashboards });
    if (method === 'POST')   return route.fulfill({ status: 201, json: [{ id: 'dash-new', name: 'New dashboard', sort_order: 99 }] });
    if (method === 'PATCH')  return route.fulfill({ json: [dashboards[0]] });
    if (method === 'DELETE') return route.fulfill({ json: [] });
    await route.continue();
  });

  // dashboard_cards
  await page.route(`${SB}/rest/v1/dashboard_cards**`, async route => {
    const method = route.request().method();
    if (method === 'GET')    return route.fulfill({ json: cards });
    if (method === 'POST')   return route.fulfill({ status: 201, json: [{ id: 'card-new', position: 0 }] });
    if (method === 'PATCH')  return route.fulfill({ json: [] });
    if (method === 'DELETE') return route.fulfill({ json: [] });
    await route.continue();
  });

  // training_sessions, gps_reports, players — empty (resolver returns no-data)
  await page.route(`${SB}/rest/v1/training_sessions**`, route => route.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/gps_reports**`,       route => route.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/players**`,           route => route.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpe**`,               route => route.fulfill({ json: [] }));
}

async function gotoGpsBuilder(page, opts = {}) {
  await injectSession(page);

  // Pre-inject globals so waitForClubId() resolves immediately
  // without depending on the full async GPS Analysis init chain.
  await page.addInitScript(() => {
    // Patch requireAuth to always return true (skip login redirect)
    Object.defineProperty(window, '__gpbTestReady', { value: true, writable: true });
  });

  await mockGpsBuilder(page, opts);
  await page.goto('/GPS Analysis.html');

  // Wait for the page structure, then force the globals the builder needs.
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });

  await page.evaluate(() => {
    if (!window._gpClubId) window._gpClubId = 'club-1';
    if (!window._gpUserId) window._gpUserId = 'user-1';
  });

  // Wait for the builder button (gp-builder.js init completes after _gpClubId is set)
  await page.waitForSelector('#gpbOpenBtn', { timeout: 15_000 });
}

// ── 1. Initialisation ─────────────────────────────────────────────────────────

test.describe('GPS Builder — Init', () => {
  test('Chart builder button appears when flag is enabled', async ({ page }) => {
    await gotoGpsBuilder(page);
    await expect(page.locator('#gpbOpenBtn').first()).toBeVisible();
  });

  test('Ask AI button appears', async ({ page }) => {
    await gotoGpsBuilder(page);
    await expect(page.locator('#gpaiOpenBtn').first()).toBeVisible();
  });

  test('builder button is absent when flag is disabled', async ({ page }) => {
    await injectSession(page);
    await mockGpsBuilder(page, { builderEnabled: false });
    await page.goto('/GPS Analysis.html');
    // give time for init to run
    await page.waitForTimeout(3000);
    await expect(page.locator('#gpbOpenBtn')).toHaveCount(0);
  });
});

// ── 2. Panel ──────────────────────────────────────────────────────────────────

// Helper: click the first visible instance of an element (handles hidden duplicates)
const clickFirst = (page, sel) => page.locator(sel).first().click();

test.describe('GPS Builder — Panel', () => {
  test('panel opens when clicking Chart builder', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible();
  });

  test('Add card button is disabled before selecting a metric', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await expect(page.locator('#gpbSave').first()).toBeDisabled();
  });

  test('"← add a metric first" hint is visible before selecting a metric', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await expect(page.locator('#gpbSaveHint').first()).toBeVisible();
  });

  test.fixme('Add metric button pulses when no metrics selected', async ({ page }) => {  // stale: #gpbAddMetric removed (pantry redesign)
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await expect(page.locator('#gpbAddMetric').first()).toHaveClass(/gpb-pulse/);
  });

  test('Cancel closes the panel', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbCancel');
    await expect(page.locator('#gpbPanel.is-open')).toHaveCount(0);
  });
});

// ── 3. Flyout + metric selection ──────────────────────────────────────────────

test.describe.fixme('GPS Builder — Metrics flyout', () => {  // stale: flyout replaced by D&D pantry
  test('flyout opens on Add metric click', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await expect(page.locator('#gpbFly').first()).toBeVisible();
  });

  test('flyout lists catalog metrics', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await expect(page.locator('#gpbFlyBody').first()).toContainText('Total Distance');
    await expect(page.locator('#gpbFlyBody').first()).toContainText('Max Speed');
  });

  test('PEAK badge shown for peak metrics', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    const maxSpeedRow = page.locator('#gpbFly.is-open [data-mid="max_speed"]');
    await expect(maxSpeedRow.locator('.kind.peak')).toContainText('PEAK');
  });

  test('selecting a metric adds it to the panel and enables Add card', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await page.locator('#gpbFly.is-open [data-mid="total_distance"]').click();

    await expect(page.locator('#gpbMetrics').first()).toContainText('Total Distance');
    await expect(page.locator('#gpbSave').first()).toBeEnabled();
    await expect(page.locator('#gpbSaveHint').first()).toBeHidden();
  });

  test('Add metric pulse stops once a metric is selected', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await page.locator('#gpbFly.is-open [data-mid="total_distance"]').click();
    await expect(page.locator('#gpbAddMetric').first()).not.toHaveClass(/gpb-pulse/);
  });

  test('search filters flyout results', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await page.locator('#gpbFly.is-open #gpbFlySearch').fill('speed');
    await expect(page.locator('#gpbFly.is-open #gpbFlyBody')).toContainText('Max Speed');
    await expect(page.locator('#gpbFly.is-open #gpbFlyBody')).not.toContainText('Player Load');
  });
});

// ── 4. Save card ──────────────────────────────────────────────────────────────

test.describe.fixme('GPS Builder — Save card', () => {  // stale: depends on the removed flyout add-metric flow
  async function openAndAddMetric(page) {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await page.locator('#gpbFly.is-open [data-mid="total_distance"]').click();
    // close flyout with Escape so it doesn't intercept future clicks
    await page.keyboard.press('Escape');
  }

  test('saved card appears in the grid', async ({ page }) => {
    await openAndAddMetric(page);
    await page.locator('#gpbSave').first().click();
    await expect(page.locator('.gp-c[data-card="chart"]').first()).toBeVisible();
  });

  test('panel closes after save', async ({ page }) => {
    await openAndAddMetric(page);
    await page.locator('#gpbSave').first().click();
    await expect(page.locator('#gpbPanel.is-open')).toHaveCount(0);
  });

  test('title input flows to card header', async ({ page }) => {
    await openAndAddMetric(page);
    await page.locator('#gpbTitle').first().fill('My custom chart');
    await page.locator('#gpbSave').first().click();
    await expect(page.locator('.gp-c[data-card="chart"] .ttl').first()).toContainText('My custom chart');
  });
});

// ── 5. Config drawer ──────────────────────────────────────────────────────────

test.describe.fixme('GPS Builder — Config drawer', () => {  // stale: depends on the removed flyout add-metric flow
  test('config drawer shows gp.card/v1 JSON', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpbOpenBtn');
    await clickFirst(page, '#gpbAddMetric');
    await page.locator('#gpbFly.is-open [data-mid="total_distance"]').click();
    await page.keyboard.press('Escape');  // close flyout
    await page.locator('#gpbConfigBtn').first().click();
    await expect(page.locator('#gpbCfgDrawer').first()).toBeVisible();
    await expect(page.locator('#gpbCfgJson').first()).toContainText('gp.card/v1');
    await expect(page.locator('#gpbCfgJson').first()).toContainText('total_distance');
  });
});

// ── 6. AI modal ───────────────────────────────────────────────────────────────

test.describe('GPS Builder — AI modal', () => {
  test('Ask AI modal opens', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpaiOpenBtn');
    await expect(page.locator('#gpaiModal')).toBeVisible();
  });

  test('example chips are visible', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpaiOpenBtn');
    await expect(page.locator('.gpai-chip').first()).toBeVisible();
  });

  test('clicking a chip fills the prompt textarea', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpaiOpenBtn');
    await page.locator('.gpai-chip').first().click();
    const value = await page.inputValue('#gpaiPrompt');
    expect(value.length).toBeGreaterThan(0);
  });

  test.fixme('Generate opens the builder panel with a config (heuristic)', async ({ page }) => {  // stale: asserts #gpbMetrics well (removed by pantry redesign)
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpaiOpenBtn');
    await page.fill('#gpaiPrompt', 'top sprinters this microcycle');
    await page.click('#gpaiGen');
    // heuristic has 900ms delay; panel should open shortly after
    await expect(page.locator('#gpbPanel.is-open').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#gpbMetrics').first()).not.toBeEmpty();
  });

  test('Cancel closes the AI modal', async ({ page }) => {
    await gotoGpsBuilder(page);
    await clickFirst(page, '#gpaiOpenBtn');
    await page.click('#gpaiCancel');
    await expect(page.locator('#gpaiModal')).toBeHidden();
  });
});

// ── 7. Tab management ─────────────────────────────────────────────────────────

test.describe('GPS Builder — Tab management', () => {
  test('kebab button visible on tab hover', async ({ page }) => {
    await gotoGpsBuilder(page);
    const tab = page.locator('#sections .gp-sec[data-view="ind"]');
    await tab.hover();
    // give CSS transition time to show the button
    await expect(tab.locator('.gpt-kb').first()).toBeVisible({ timeout: 3000 });
  });

  test('+ New tab button is visible', async ({ page }) => {
    await gotoGpsBuilder(page);
    await expect(page.locator('#sections .gpt-addtab')).toBeVisible();
  });
});
