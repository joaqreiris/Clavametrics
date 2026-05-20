// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PLAYER, CLUB, PROFILE, MICROCYCLE, SESSION, injectSession, mockBase } from './_shared.js';

async function mockHub(page, overrides = {}) {
  const {
    players     = [PLAYER],
    injuries    = [{ status: 'active' }, { status: 'active' }],
    wellness    = [{ readiness: 8 }, { readiness: 7 }],
    tasks       = [],
    avail       = [{ status: 'available' }, { status: 'unavailable' }],
    sessions    = [SESSION],
    microcycles = [MICROCYCLE],
    gpsReports  = [],
  } = overrides;

  await mockBase(page);

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();
    if (method !== 'GET') return route.continue();

    if (url.includes('/players'))        return route.fulfill({ json: players, headers: { 'content-range': `*/${players.length}` } });
    if (url.includes('/injuries'))       return route.fulfill({ json: injuries });
    if (url.includes('/wellness'))       return route.fulfill({ json: wellness });
    if (url.includes('/tasks'))          return route.fulfill({ json: tasks });
    if (url.includes('/availability'))   return route.fulfill({ json: avail });
    if (url.includes('/gps_reports'))    return route.fulfill({ json: gpsReports });
    if (url.includes('/microcycles'))    return route.fulfill({ json: microcycles });
    if (url.includes('/training_sessions')) return route.fulfill({ json: sessions });
    await route.continue();
  });
}

async function gotoHub(page, overrides = {}) {
  await injectSession(page);
  await mockHub(page, overrides);
  await page.goto('/Hub.html');
  await page.waitForSelector('#kpiSquad', { timeout: 10_000 });
}

// ── 1. Render ─────────────────────────────────────────────────────────────────

test.describe('Hub — Render', () => {
  test('page loads and KPI grid is visible', async ({ page }) => {
    await gotoHub(page);
    await expect(page.locator('#kpiSquad')).toBeVisible();
    await expect(page.locator('#kpiAcwr')).toBeVisible();
    await expect(page.locator('#kpiWellness')).toBeVisible();
    await expect(page.locator('#kpiInjuries')).toBeVisible();
  });

  test('sidebar shows club name', async ({ page }) => {
    await gotoHub(page);
    await expect(page.locator('#sideClubName')).toContainText('Test FC', { timeout: 8000 });
  });

  test('sidebar shows user name', async ({ page }) => {
    await gotoHub(page);
    await expect(page.locator('#userName')).toContainText('Test User', { timeout: 8000 });
  });

  test('greeting message is rendered', async ({ page }) => {
    await gotoHub(page);
    await expect(page.locator('#greetMsg')).toBeVisible();
    const text = await page.locator('#greetMsg').textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('module foot stats are visible', async ({ page }) => {
    await gotoHub(page);
    await expect(page.locator('#modFootSquad')).toBeVisible();
    await expect(page.locator('#modFootWellness')).toBeVisible();
    await expect(page.locator('#modFootInjuries')).toBeVisible();
  });
});

// ── 2. KPIs ───────────────────────────────────────────────────────────────────

test.describe('Hub — KPIs', () => {
  test('squad KPI shows player count', async ({ page }) => {
    await gotoHub(page, { players: [PLAYER, { ...PLAYER, id: 'p-2' }] });
    await expect(page.locator('#kpiSquad')).not.toContainText('—', { timeout: 8000 });
  });

  test('injuries KPI shows active count', async ({ page }) => {
    await gotoHub(page, { injuries: [{ status: 'active' }, { status: 'active' }] });
    await expect(page.locator('#kpiInjuries')).not.toContainText('—', { timeout: 8000 });
  });

  test('wellness KPI shows a value', async ({ page }) => {
    await gotoHub(page, { wellness: [{ readiness: 8 }, { readiness: 6 }] });
    await expect(page.locator('#kpiWellness')).not.toContainText('—', { timeout: 8000 });
  });

  test('KPIs show placeholder when data is empty', async ({ page }) => {
    await gotoHub(page, { players: [], injuries: [], wellness: [] });
    // KPIs should still render (not crash) — value may be — or 0
    await expect(page.locator('#kpiSquad')).toBeVisible();
    await expect(page.locator('#kpiInjuries')).toBeVisible();
  });
});

// ── 3. Search bar ─────────────────────────────────────────────────────────────

test.describe('Hub — Search', () => {
  test('search input is visible', async ({ page }) => {
    await gotoHub(page);
    await expect(page.locator('.hub-search input')).toBeVisible();
  });

  test('Cmd+K focuses the search input', async ({ page }) => {
    await gotoHub(page);
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.hub-search input')).toBeFocused();
  });

  test('typing shows search results dropdown', async ({ page }) => {
    await gotoHub(page);
    await page.locator('.hub-search input').fill('Lu');
    await expect(page.locator('.hub-search-results')).toBeVisible({ timeout: 5000 });
  });

  test('clearing search hides dropdown', async ({ page }) => {
    await gotoHub(page);
    await page.locator('.hub-search input').fill('Lu');
    await page.locator('.hub-search-results').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.hub-search input').fill('');
    await expect(page.locator('.hub-search-results')).toHaveCount(0);
  });

  test('no results shows empty state message', async ({ page }) => {
    await gotoHub(page, { players: [], sessions: [], microcycles: [] });
    await page.locator('.hub-search input').fill('xyznotfound');
    await expect(page.locator('.hub-search-results')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.hub-search-empty')).toBeVisible();
  });
});

// ── 4. Navigation buttons ─────────────────────────────────────────────────────

test.describe('Hub — Buttons', () => {
  test.beforeEach(async ({ page }) => { await gotoHub(page); });

  test('"View all activity" button is visible', async ({ page }) => {
    await expect(page.locator('#btnViewAllActivity')).toBeVisible();
  });

  test('"Add task" button is visible', async ({ page }) => {
    await expect(page.locator('#btnAddTask')).toBeVisible();
  });

  test('"Customize modules" button is visible', async ({ page }) => {
    await expect(page.locator('#btnCustomizeModules')).toBeVisible();
  });
});

// ── 5. Auth guard ─────────────────────────────────────────────────────────────

test.describe('Hub — Auth guard', () => {
  test('redirects to Login.html when no session', async ({ page }) => {
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ status: 401, json: { error: 'not authenticated' } })
    );
    await page.goto('/Hub.html');
    await page.waitForURL(/Login\.html/, { timeout: 8000 });
  });
});
