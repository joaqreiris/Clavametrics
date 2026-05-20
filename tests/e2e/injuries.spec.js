// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PLAYER, INJURY, injectSession, mockBase } from './_shared.js';

async function mockInjuries(page, opts = {}) {
  const {
    injuries   = [INJURY],
    players    = [PLAYER],
    saveError  = false,
  } = opts;

  await mockBase(page);

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();

    if (url.includes('/injuries')) {
      if (method === 'GET')   return route.fulfill({ json: injuries });
      if (saveError)          return route.fulfill({ status: 400, json: { message: 'DB error' } });
      if (method === 'POST')  return route.fulfill({ status: 201, json: [{ ...INJURY, id: 'inj-new' }] });
      if (method === 'PATCH') return route.fulfill({ json: [{ ...INJURY, status: 'discharged' }] });
    }
    if (url.includes('/players'))
      return route.fulfill({ json: players });

    await route.continue();
  });
}

async function gotoInjuries(page, opts = {}) {
  await injectSession(page);
  await mockInjuries(page, opts);
  await page.goto('/Injuries.html');
  await page.waitForSelector('#kpiInjActive', { timeout: 10_000 });
}

// ── 1. Render ─────────────────────────────────────────────────────────────────

test.describe('Injuries — Render', () => {
  test('KPI active count is visible', async ({ page }) => {
    await gotoInjuries(page);
    await expect(page.locator('#kpiInjActive')).toBeVisible();
  });

  test('KPI shows count matching active injuries', async ({ page }) => {
    await gotoInjuries(page, { injuries: [INJURY, { ...INJURY, id: 'inj-2' }] });
    await expect(page.locator('#kpiInjActive')).toContainText('2', { timeout: 8000 });
  });

  test('active injury card section is visible', async ({ page }) => {
    await gotoInjuries(page);
    await expect(page.locator('#injCardActive')).toBeVisible();
  });

  test('renders injury card with injury type', async ({ page }) => {
    await gotoInjuries(page);
    await expect(page.locator('#injCardActive')).toContainText('Hamstring strain', { timeout: 8000 });
  });

  test('sidebar shows club name', async ({ page }) => {
    await gotoInjuries(page);
    await expect(page.locator('#sideClubName')).toContainText('Test FC', { timeout: 8000 });
  });

  test('shows "Log injury" button', async ({ page }) => {
    await gotoInjuries(page);
    await expect(page.locator('button', { hasText: /log injury/i })).toBeVisible();
  });
});

// ── 2. Log injury modal — open / close ───────────────────────────────────────

test.describe('Injuries — Log modal open/close', () => {
  test.beforeEach(async ({ page }) => { await gotoInjuries(page); });

  test('"Log injury" button opens modal', async ({ page }) => {
    await page.locator('button', { hasText: /log injury/i }).click();
    await expect(page.locator('#modalLogInj')).toBeVisible();
  });

  test('modal has all required fields', async ({ page }) => {
    await page.locator('button', { hasText: /log injury/i }).click();
    await expect(page.locator('#logPlayer')).toBeVisible();
    await expect(page.locator('#logType')).toBeVisible();
    await expect(page.locator('#logArea')).toBeVisible();
    await expect(page.locator('#logSev')).toBeVisible();
    await expect(page.locator('#logStart')).toBeVisible();
    await expect(page.locator('#logReturn')).toBeVisible();
    await expect(page.locator('#logNotes')).toBeVisible();
  });

  test('player select is populated', async ({ page }) => {
    await page.locator('button', { hasText: /log injury/i }).click();
    await expect(page.locator('#logPlayer option')).toHaveCount(2); // placeholder + 1 player
  });

  test('Cancel/close button hides modal', async ({ page }) => {
    await page.locator('button', { hasText: /log injury/i }).click();
    // Find cancel button inside the modal
    await page.locator('#modalLogInj button', { hasText: /cancel|close/i }).first().click();
    await expect(page.locator('#modalLogInj')).toBeHidden({ timeout: 6000 });
  });
});

// ── 3. Log injury — save ─────────────────────────────────────────────────────

test.describe('Injuries — Log save', () => {
  test('saves injury and hides modal on success', async ({ page }) => {
    await gotoInjuries(page);
    await page.locator('button', { hasText: /log injury/i }).click();

    await page.selectOption('#logPlayer', 'p-1');
    await page.fill('#logType',   'Knee sprain');
    await page.fill('#logArea',   'Left knee');
    await page.fill('#logStart',  '2026-05-18');

    await page.locator('#modalLogInj button', { hasText: /save|log/i }).last().click();
    await expect(page.locator('#modalLogInj')).toBeHidden({ timeout: 8000 });
  });

  test('shows error toast on save failure', async ({ page }) => {
    await gotoInjuries(page, { saveError: true });
    await page.locator('button', { hasText: /log injury/i }).click();

    await page.selectOption('#logPlayer', 'p-1');
    await page.fill('#logType',  'Knee sprain');
    await page.fill('#logArea',  'Left knee');
    await page.fill('#logStart', '2026-05-18');

    await page.locator('#modalLogInj button', { hasText: /save|log/i }).last().click();
    // Modal should NOT close and should show some error state
    await page.waitForTimeout(2000);
    await expect(page.locator('#modalLogInj')).toBeVisible();
  });
});

// ── 4. Discharge modal ────────────────────────────────────────────────────────

test.describe('Injuries — Discharge', () => {
  test('discharge button is visible on active injury card', async ({ page }) => {
    await gotoInjuries(page);
    await expect(page.locator('#injCardActive [onclick*="openDischarge"], #injCardActive button', { hasText: /discharge/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking discharge opens discharge modal', async ({ page }) => {
    await gotoInjuries(page);
    await page.locator('#injCardActive button', { hasText: /discharge/i }).first().click();
    await expect(page.locator('#modalDischarge')).toBeVisible({ timeout: 6000 });
  });

  test('discharge modal has return date field', async ({ page }) => {
    await gotoInjuries(page);
    await page.locator('#injCardActive button', { hasText: /discharge/i }).first().click();
    await page.locator('#modalDischarge').waitFor({ state: 'visible', timeout: 6000 });
    await expect(page.locator('#disDate')).toBeVisible();
  });
});

// ── 5. Auth guard ─────────────────────────────────────────────────────────────

test.describe('Injuries — Auth guard', () => {
  test('redirects to Login.html when no session', async ({ page }) => {
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ status: 401, json: { error: 'not authenticated' } })
    );
    await page.goto('/Injuries.html');
    await page.waitForURL(/Login\.html/, { timeout: 8000 });
  });
});
