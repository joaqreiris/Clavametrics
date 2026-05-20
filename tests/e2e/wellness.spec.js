// @ts-check
// Wellness.html is a canvas/mockup page (player-facing design preview).
// It renders two React phone frames — no Supabase connection, no auth required.
import { test, expect } from '@playwright/test';
import { SB } from './_shared.js';

test.beforeEach(async ({ page }) => {
  await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
  await page.goto('/Wellness.html');
  // React components render into phone1 / phone2 — wait for the container
  await page.waitForSelector('#phoneRow', { timeout: 10_000 });
});

test.describe('Wellness — Render', () => {
  test('canvas layout is visible', async ({ page }) => {
    await expect(page.locator('.canvas')).toBeVisible();
  });

  test('context aside panel is visible', async ({ page }) => {
    await expect(page.locator('.ctx')).toBeVisible();
  });

  test('phone row section is visible', async ({ page }) => {
    await expect(page.locator('#phoneRow')).toBeVisible();
  });

  test('phone 1 mount point exists', async ({ page }) => {
    await expect(page.locator('#phone1')).toBeAttached();
  });

  test('phone 2 mount point exists', async ({ page }) => {
    await expect(page.locator('#phone2')).toBeAttached();
  });

  test('both canvas legends are visible', async ({ page }) => {
    const legends = page.locator('.canvas-legend');
    await expect(legends).toHaveCount(2);
    await expect(legends.nth(0)).toContainText('Form');
    await expect(legends.nth(1)).toContainText('Submitted');
  });

  test('dark mode toggle button is visible', async ({ page }) => {
    await expect(page.locator('#darkLabel')).toBeVisible();
  });

  test('toggling dark mode changes button label', async ({ page }) => {
    const before = await page.locator('#darkLabel').textContent();
    await page.locator('button', { has: page.locator('#darkLabel') }).click();
    const after = await page.locator('#darkLabel').textContent();
    expect(after).not.toBe(before);
  });
});
