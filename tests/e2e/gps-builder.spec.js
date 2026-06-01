// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, MICROCYCLE, injectSession, mockBase } from './_shared.js';

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

  await mockBase(page);

  // club_gps_settings
  await page.route(`${SB}/rest/v1/club_gps_settings**`, route =>
    route.fulfill({ json: [{ ...GPS_SETTINGS, gps_builder_enabled: builderEnabled }] })
  );

  // gps_metric_definitions
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
    if (method === 'GET')  return route.fulfill({ json: dashboards });
    if (method === 'POST') return route.fulfill({ status: 201, json: [{ id: 'dash-new', name: 'New dashboard', sort_order: 99 }] });
    if (method === 'PATCH') return route.fulfill({ json: [dashboards[0]] });
    if (method === 'DELETE') return route.fulfill({ json: [] });
    await route.continue();
  });

  // dashboard_cards
  await page.route(`${SB}/rest/v1/dashboard_cards**`, async route => {
    const method = route.request().method();
    if (method === 'GET')  return route.fulfill({ json: cards });
    if (method === 'POST') return route.fulfill({ status: 201, json: [{ id: 'card-new', position: 0 }] });
    if (method === 'PATCH') return route.fulfill({ json: [] });
    if (method === 'DELETE') return route.fulfill({ json: [] });
    await route.continue();
  });

  // gps_reports (empty — resolver returns no-data)
  await page.route(`${SB}/rest/v1/gps_reports**`, route =>
    route.fulfill({ json: [] })
  );
  await page.route(`${SB}/rest/v1/training_sessions**`, route =>
    route.fulfill({ json: [] })
  );
  await page.route(`${SB}/rest/v1/players**`, route =>
    route.fulfill({ json: [] })
  );
}

async function gotoGpsBuilder(page, opts = {}) {
  await injectSession(page);
  await mockGpsBuilder(page, opts);
  await page.goto('/GPS Analysis.html');
  // wait for the builder button (signals builder init complete)
  await page.waitForSelector('#gpbOpenBtn', { timeout: 15_000 });
}

// ── 1. Initialisation ─────────────────────────────────────────────────────────

test.describe('GPS Builder — Init', () => {
  test('Chart builder button appears when flag is enabled', async ({ page }) => {
    await gotoGpsBuilder(page);
    await expect(page.locator('#gpbOpenBtn')).toBeVisible();
  });

  test('Ask AI button appears', async ({ page }) => {
    await gotoGpsBuilder(page);
    await expect(page.locator('#gpaiOpenBtn')).toBeVisible();
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

test.describe('GPS Builder — Panel', () => {
  test('panel opens when clicking Chart builder', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await expect(page.locator('#gpbPanel')).toBeVisible();
  });

  test('Add card button is disabled before selecting a metric', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await expect(page.locator('#gpbSave')).toBeDisabled();
  });

  test('"← add a metric first" hint is visible before selecting a metric', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await expect(page.locator('#gpbSaveHint')).toBeVisible();
  });

  test('Add metric button pulses when no metrics selected', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await expect(page.locator('#gpbAddMetric')).toHaveClass(/gpb-pulse/);
  });

  test('Cancel closes the panel', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbCancel');
    await expect(page.locator('#gpbPanel')).not.toBeVisible();
  });
});

// ── 3. Flyout + metric selection ──────────────────────────────────────────────

test.describe('GPS Builder — Metrics flyout', () => {
  test('flyout opens on Add metric click', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await expect(page.locator('#gpbFly')).toBeVisible();
  });

  test('flyout lists catalog metrics', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await expect(page.locator('#gpbFlyBody')).toContainText('Total Distance');
    await expect(page.locator('#gpbFlyBody')).toContainText('Max Speed');
  });

  test('PEAK badge shown for peak metrics', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    // max_speed is kind=peak
    const maxSpeedRow = page.locator('#gpbFlyBody [data-mid="max_speed"]');
    await expect(maxSpeedRow.locator('.kind.peak')).toContainText('PEAK');
  });

  test('selecting a metric adds it to the panel and enables Add card', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await page.click('#gpbFlyBody [data-mid="total_distance"]');

    // metric appears in the well
    await expect(page.locator('#gpbMetrics')).toContainText('Total Distance');
    // Add card button enabled
    await expect(page.locator('#gpbSave')).toBeEnabled();
    // hint hidden
    await expect(page.locator('#gpbSaveHint')).toBeHidden();
  });

  test('Add metric pulse stops once a metric is selected', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await page.click('#gpbFlyBody [data-mid="total_distance"]');
    await expect(page.locator('#gpbAddMetric')).not.toHaveClass(/gpb-pulse/);
  });

  test('search filters flyout results', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await page.fill('#gpbFlySearch', 'speed');
    await expect(page.locator('#gpbFlyBody')).toContainText('Max Speed');
    await expect(page.locator('#gpbFlyBody')).not.toContainText('Player Load');
  });
});

// ── 4. Save card ──────────────────────────────────────────────────────────────

test.describe('GPS Builder — Save card', () => {
  async function openAndAddMetric(page) {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await page.click('#gpbFlyBody [data-mid="total_distance"]');
  }

  test('saved card appears in the grid', async ({ page }) => {
    await openAndAddMetric(page);
    await page.click('#gpbSave');
    // draft card should become a real chart card
    await expect(page.locator('.gp-c[data-card="chart"]').first()).toBeVisible();
  });

  test('panel closes after save', async ({ page }) => {
    await openAndAddMetric(page);
    await page.click('#gpbSave');
    await expect(page.locator('#gpbPanel')).not.toBeVisible();
  });

  test('title input flows to card header', async ({ page }) => {
    await openAndAddMetric(page);
    await page.fill('#gpbTitle', 'My custom chart');
    await page.click('#gpbSave');
    await expect(page.locator('.gp-c[data-card="chart"] .ttl').first()).toContainText('My custom chart');
  });
});

// ── 5. Config drawer ──────────────────────────────────────────────────────────

test.describe('GPS Builder — Config drawer', () => {
  test('config drawer shows gp.card/v1 JSON', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpbOpenBtn');
    await page.click('#gpbAddMetric');
    await page.click('#gpbFlyBody [data-mid="total_distance"]');
    await page.click('#gpbConfigBtn');
    await expect(page.locator('#gpbCfgDrawer')).toBeVisible();
    await expect(page.locator('#gpbCfgJson')).toContainText('gp.card/v1');
    await expect(page.locator('#gpbCfgJson')).toContainText('total_distance');
  });
});

// ── 6. AI modal ───────────────────────────────────────────────────────────────

test.describe('GPS Builder — AI modal', () => {
  test('Ask AI modal opens', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpaiOpenBtn');
    await expect(page.locator('#gpaiModal')).toBeVisible();
  });

  test('example chips are visible', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpaiOpenBtn');
    await expect(page.locator('.gpai-chip').first()).toBeVisible();
  });

  test('clicking a chip fills the prompt textarea', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpaiOpenBtn');
    await page.locator('.gpai-chip').first().click();
    const value = await page.inputValue('#gpaiPrompt');
    expect(value.length).toBeGreaterThan(0);
  });

  test('Generate opens the builder panel with a config (heuristic)', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpaiOpenBtn');
    await page.fill('#gpaiPrompt', 'top sprinters this microcycle');
    await page.click('#gpaiGen');
    // builder panel should open with the generated config
    await expect(page.locator('#gpbPanel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#gpbMetrics')).not.toBeEmpty();
  });

  test('Cancel closes the AI modal', async ({ page }) => {
    await gotoGpsBuilder(page);
    await page.click('#gpaiOpenBtn');
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
    await expect(tab.locator('.gpt-kb')).toBeVisible();
  });

  test('+ New tab button is visible', async ({ page }) => {
    await gotoGpsBuilder(page);
    await expect(page.locator('#sections .gpt-addtab')).toBeVisible();
  });
});
