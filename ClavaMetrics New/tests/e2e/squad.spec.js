// @ts-check
import { test, expect } from '@playwright/test';
import { SB, PLAYER, injectSession, mockBase } from './_shared.js';

async function mockSquad(page, opts = {}) {
  const { players = [PLAYER], saveError = false } = opts;

  await mockBase(page);

  await page.route(`${SB}/rest/v1/players**`, async route => {
    const method = route.request().method();
    if (method === 'GET')    return route.fulfill({ json: players });
    if (saveError)           return route.fulfill({ status: 400, json: { message: 'DB error' } });
    if (method === 'POST')   return route.fulfill({ status: 201, json: [{ ...PLAYER, id: 'p-new' }] });
    if (method === 'PATCH')  return route.fulfill({ json: [PLAYER] });
    if (method === 'DELETE') return route.fulfill({ json: [] });
    await route.continue();
  });
}

async function gotoSquad(page, opts = {}) {
  await injectSession(page);
  await mockSquad(page, opts);
  await page.goto('/Squad.html');
  await page.waitForSelector('#sqTbody', { timeout: 10_000 });
}

// ── 1. Render ─────────────────────────────────────────────────────────────────

test.describe('Squad — Render', () => {
  test('player table is visible', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sqTbody')).toBeVisible();
  });

  test('renders one row per player', async ({ page }) => {
    await gotoSquad(page, { players: [PLAYER, { ...PLAYER, id: 'p-2', first_name: 'Marco', number: 9 }] });
    await expect(page.locator('#sqTbody tr')).toHaveCount(2);
  });

  test('shows player name in row', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sqTbody')).toContainText('Lucas', { timeout: 8000 });
  });

  test('shows player number in row', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sqTbody')).toContainText('10');
  });

  test('empty state when no players', async ({ page }) => {
    await gotoSquad(page, { players: [] });
    await expect(page.locator('#sqTbody tr')).toHaveCount(0);
  });

  test('sidebar shows club name', async ({ page }) => {
    await gotoSquad(page);
    await expect(page.locator('#sideClubName')).toContainText('Test FC', { timeout: 8000 });
  });
});

// ── 2. Modal — open / close ───────────────────────────────────────────────────

test.describe('Squad — Modal open/close', () => {
  test.beforeEach(async ({ page }) => { await gotoSquad(page); });

  test('clicking "Add player" opens modal with "Add player" title', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await expect(page.locator('#sqModalBackdrop')).toBeVisible();
    await expect(page.locator('#sqModalTitle')).toContainText('Add player');
  });

  test('Delete button hidden for new player', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await expect(page.locator('#sqModalDelete')).toBeHidden();
  });

  test('Cancel button closes modal', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.click('#sqModalCancel');
    await expect(page.locator('#sqModalBackdrop')).toBeHidden();
  });

  test('X button closes modal', async ({ page }) => {
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.click('#sqModalClose');
    await expect(page.locator('#sqModalBackdrop')).toBeHidden();
  });
});

// ── 3. Modal — edit ───────────────────────────────────────────────────────────

test.describe('Squad — Edit player', () => {
  test('clicking edit button opens modal with "Edit player" title', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('.sq-edit-btn').first().click();
    await expect(page.locator('#sqModalTitle')).toContainText('Edit');
  });

  test('modal pre-fills first name', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('.sq-edit-btn').first().click();
    await expect(page.locator('#sqF_first_name')).toHaveValue('Lucas');
  });

  test('Delete button visible when editing', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('.sq-edit-btn').first().click();
    await expect(page.locator('#sqModalDelete')).toBeVisible();
  });
});

// ── 4. Form validation ────────────────────────────────────────────────────────

test.describe('Squad — Form validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSquad(page);
    await page.locator('button', { hasText: /add player/i }).first().click();
  });

  test('all main form fields are present', async ({ page }) => {
    await expect(page.locator('#sqF_first_name')).toBeVisible();
    await expect(page.locator('#sqF_last_name')).toBeVisible();
    await expect(page.locator('#sqF_number')).toBeVisible();
    await expect(page.locator('#sqF_dob')).toBeVisible();
    await expect(page.locator('#sqF_nationality')).toBeVisible();
    await expect(page.locator('#sqF_height_cm')).toBeVisible();
    await expect(page.locator('#sqF_weight_kg')).toBeVisible();
  });

  test('shows toast when first name is empty on save', async ({ page }) => {
    await page.click('#sqModalSave');
    await expect(page.locator('#sqToast')).toBeVisible({ timeout: 6000 });
  });

  test('modal stays open after failed validation', async ({ page }) => {
    await page.click('#sqModalSave');
    await expect(page.locator('#sqModalBackdrop')).toBeVisible();
  });
});

// ── 5. Save — new player ──────────────────────────────────────────────────────

test.describe('Squad — Save new player', () => {
  test('closes modal and shows toast on success', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.fill('#sqF_first_name', 'Marco');
    await page.fill('#sqF_last_name',  'Silva');
    await page.fill('#sqF_number',     '9');
    await page.click('#sqModalSave');

    await expect(page.locator('#sqModalBackdrop')).toBeHidden({ timeout: 8000 });
    await expect(page.locator('#sqToast')).toBeVisible();
  });

  test('shows saving indicator while request is in flight', async ({ page }) => {
    let release;
    const gate = new Promise(r => (release = r));

    await injectSession(page);
    await mockBase(page);
    await page.route(`${SB}/rest/v1/players**`, async route => {
      if (route.request().method() === 'POST') { await gate; return route.fulfill({ status: 201, json: [PLAYER] }); }
      route.fulfill({ json: [PLAYER] });
    });

    await page.goto('/Squad.html');
    await page.waitForSelector('#sqTbody');
    await page.locator('button', { hasText: /add player/i }).first().click();
    await page.fill('#sqF_first_name', 'Marco');
    await page.fill('#sqF_last_name',  'Silva');
    await page.click('#sqModalSave');

    await expect(page.locator('#sqModalSaving')).toBeVisible();
    await expect(page.locator('#sqModalSave')).toBeDisabled();
    release();
  });
});

// ── 6. Delete player ──────────────────────────────────────────────────────────

test.describe('Squad — Delete player', () => {
  test('cancel on confirm dialog keeps modal open', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('.sq-edit-btn').first().click();
    page.on('dialog', d => d.dismiss());
    await page.click('#sqModalDelete');
    await expect(page.locator('#sqModalBackdrop')).toBeVisible();
  });

  test('confirming delete closes modal and shows toast', async ({ page }) => {
    await gotoSquad(page);
    await page.locator('.sq-edit-btn').first().click();
    page.on('dialog', d => d.accept());
    await page.click('#sqModalDelete');
    await expect(page.locator('#sqModalBackdrop')).toBeHidden({ timeout: 8000 });
    await expect(page.locator('#sqToast')).toBeVisible();
  });
});

// ── 7. Auth guard ─────────────────────────────────────────────────────────────

test.describe('Squad — Auth guard', () => {
  test('redirects to Login.html when no session', async ({ page }) => {
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ status: 401, json: { error: 'not authenticated' } })
    );
    await page.goto('/Squad.html');
    await page.waitForURL(/Login\.html/, { timeout: 8000 });
  });
});
