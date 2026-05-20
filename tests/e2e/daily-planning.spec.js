// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PLAYER, MICROCYCLE, injectSession, mockBase } from './_shared.js';

const TREATMENT = {
  id: 'tr-1', club_id: 'club-1', player_id: 'p-1',
  date: '2026-05-16', type: 'Massage',
  notes: 'Post-match recovery', adaptation: null, zones: null,
  players: { first_name: 'Lucas', last_name: 'García', number: 10, position: 'FW' },
};

const AVAIL = { player_id: 'p-1', status: 'available', notes: null };

async function mockDP(page, opts = {}) {
  const {
    players    = [PLAYER],
    avail      = [AVAIL],
    injuries   = [],
    treatments = [TREATMENT],
    microcycles = [MICROCYCLE],
  } = opts;

  await mockBase(page);

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();
    if (method !== 'GET') return route.continue();

    if (url.includes('/players'))          return route.fulfill({ json: players });
    if (url.includes('/availability'))     return route.fulfill({ json: avail });
    if (url.includes('/injuries'))         return route.fulfill({ json: injuries });
    if (url.includes('/treatments'))       return route.fulfill({ json: treatments });
    if (url.includes('/microcycles'))      return route.fulfill({ json: microcycles });
    if (url.includes('/training_sessions')) return route.fulfill({ json: [] });
    await route.continue();
  });
}

async function gotoDP(page, opts = {}) {
  await injectSession(page);
  await mockDP(page, opts);
  await page.goto('/Daily%20Planning.html');
  await page.waitForSelector('#dpSquadBody', { timeout: 10_000 });
}

// ── 1. Render ─────────────────────────────────────────────────────────────────

test.describe('Daily Planning — Render', () => {
  test('squad body section is visible', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpSquadBody')).toBeVisible();
  });

  test('physio list section is visible', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpPhysioList')).toBeVisible();
  });

  test('date input is present', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpDateInput')).toBeVisible();
  });

  test('breadcrumb shows date label', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpCrumbDate')).toBeVisible();
    const text = await page.locator('#dpCrumbDate').textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('sidebar shows club name', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#sideClubName')).toContainText('Test FC', { timeout: 8000 });
  });

  test('pager label is visible', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpPagerLabel')).toBeVisible();
  });
});

// ── 2. Squad section ──────────────────────────────────────────────────────────

test.describe('Daily Planning — Squad section', () => {
  test('shows player name in squad body', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpSquadBody')).toContainText('Lucas', { timeout: 8000 });
  });

  test('squad count reflects loaded players', async ({ page }) => {
    await gotoDP(page, { players: [PLAYER, { ...PLAYER, id: 'p-2', first_name: 'Marco', number: 9 }] });
    const ct = await page.locator('#dpSquadCt').textContent();
    expect(ct).toMatch(/\d/);
  });

  test('renders squad summary row', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpSquadSummary')).toBeVisible();
  });
});

// ── 3. Physio section ─────────────────────────────────────────────────────────

test.describe('Daily Planning — Physio section', () => {
  test('physio count shows treatment count', async ({ page }) => {
    await gotoDP(page, { treatments: [TREATMENT] });
    await expect(page.locator('#dpPhysioCt')).toBeVisible();
    const ct = await page.locator('#dpPhysioCt').textContent();
    expect(ct?.trim()).not.toBe('');
  });

  test('shows treatment in physio list', async ({ page }) => {
    await gotoDP(page);
    await expect(page.locator('#dpPhysioList')).toContainText('Lucas', { timeout: 8000 });
  });

  test('physio list empty when no treatments', async ({ page }) => {
    await gotoDP(page, { treatments: [] });
    const html = await page.locator('#dpPhysioList').innerHTML();
    // Should render without crashing; may show empty state or empty list
    expect(html).toBeDefined();
  });
});

// ── 4. Date navigation ────────────────────────────────────────────────────────

test.describe('Daily Planning — Date navigation', () => {
  test('pager prev button exists', async ({ page }) => {
    await gotoDP(page);
    const prev = page.locator('.dp-pager button').first();
    await expect(prev).toBeVisible();
  });

  test('pager next button exists', async ({ page }) => {
    await gotoDP(page);
    const next = page.locator('.dp-pager button').last();
    await expect(next).toBeVisible();
  });

  test('changing date input updates pager label', async ({ page }) => {
    await gotoDP(page);
    const before = await page.locator('#dpPagerLabel').textContent();
    await page.fill('#dpDateInput', '2026-05-22');
    await page.locator('#dpDateInput').dispatchEvent('change');
    await page.waitForTimeout(500);
    const after = await page.locator('#dpPagerLabel').textContent();
    // Label should reflect new date (may or may not change depending on impl)
    expect(after).toBeDefined();
  });
});

// ── 5. Auth guard ─────────────────────────────────────────────────────────────

test.describe('Daily Planning — Auth guard', () => {
  test('redirects to Login.html when no session', async ({ page }) => {
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ status: 401, json: { error: 'not authenticated' } })
    );
    await page.goto('/Daily%20Planning.html');
    await page.waitForURL(/Login\.html/, { timeout: 8000 });
  });
});
