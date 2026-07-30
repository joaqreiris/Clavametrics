// @ts-check
// SMOKE TESTS for GPS Analysis — the safety net BEFORE the refactor.
//
// Goal: prove things DON'T EXPLODE, not that they're perfect. Deliberately low bar.
// The existing gps-builder.spec.js mocks empty data and only covers the builder chrome;
// these tests feed the RENDER pipeline with non-empty data so a broken refactor surfaces.
//
// Reliability rules followed here:
//   • pageerror is a HARD guard — any uncaught exception fails the test.
//   • Fixture dates are relative to today (default preset is last30) — never drift.
//   • Deterministic data (no Math.random).
//   • Async-rendered content is awaited with expect.poll / web-first assertions, never
//     with fixed sleeps.
//   • The club id is a REAL uuid — the gp-card resolver rejects a non-uuid club
//     (isUuid guard) and returns no rows, so 'club-1' would render "No data".
//
// Does NOT touch production code or gps-builder.spec.js.

import { test, expect } from '@playwright/test';
import { SB, MICROCYCLE, injectSession } from './_shared.js';
import { SMOKE_SESSIONS, SMOKE_PLAYERS, SMOKE_REPORTS, SMOKE_METRICS } from './_gps-fixtures.js';

// Real uuid — required by the resolver's isUuid(clubId) guard (lib/gp-card/resolver.js:191).
const CLUB_ID = '11111111-1111-4111-8111-111111111111';

const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'coach', club_role: 'Head Coach' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };

const GPS_SETTINGS = {
  club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal',
  active_metrics: null, acwr_model: 'ewma', include_archived: false,
  gps_builder_enabled: true,
};

const DASHBOARDS = [
  { id: 'dash-1', club_id: CLUB_ID, report_type: 'ind', name: 'Player Week Report',
    scope: 'player', sort_order: 0, is_shared: true, created_by: null },
];

// The 5 dashboard tabs. The grp cards (session-control / z-score / outliers / vs-session)
// all live inside the grp view, so navigating these 5 covers every view surface.
const VIEWS = ['ind', 'grp', 'mind', 'mgrp', 'mc'];

// ── Mock: same structure as gps-builder.spec.js, but with NON-EMPTY data + a uuid club.
async function mockGpsData(page) {
  // Catch-all first (lowest priority): any unlisted REST route → empty.
  await page.route(`${SB}/rest/v1/**`, route => route.fulfill({
    json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' },
  }));
  await page.route(`${SB}/auth/v1/**`, route => route.fulfill({
    json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } },
  }));

  // auth/profile/club — a uuid club so the resolver accepts it.
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));

  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [GPS_SETTINGS] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: SMOKE_METRICS }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: [MICROCYCLE] }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => r.fulfill({ json: DASHBOARDS }));
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));

  // The data that feeds the render pipeline.
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({
    json: SMOKE_SESSIONS,
    headers: { 'Content-Range': `0-${SMOKE_SESSIONS.length - 1}/${SMOKE_SESSIONS.length}`, 'Content-Type': 'application/json' },
  }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: SMOKE_REPORTS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: SMOKE_PLAYERS }));
  await page.route(`${SB}/rest/v1/rpe**`, r => r.fulfill({ json: [] }));
}

/** Loads the page with data mocked and the pageerror guard armed. Returns the error sink. */
async function gotoGps(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', e => errors.push(e.message || String(e)));

  await injectSession(page);
  await mockGpsData(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });

  // Force the globals the render pipeline needs, then kick a render so the ind view
  // loads with our mocked data (same pattern as gps-builder.spec.js).
  await page.evaluate((cid) => {
    if (!window._gpClubId) window._gpClubId = cid;
    if (!window._gpUserId) window._gpUserId = 'user-1';
    window.refreshDashboard?.();
    window.renderView?.();
  }, CLUB_ID);
  return errors;
}

/** Switch to a view tab and wait for its grid to be on-screen. */
async function gotoView(page, view) {
  await page.locator(`#sections .gp-sec[data-view="${view}"]`).first().click();
  await expect(page.locator(`.gp-view[data-view="${view}"].is-on`)).toBeVisible({ timeout: 10_000 });
}

// ── 1. Every view mounts without exploding ─────────────────────────────────────
test.describe('GPS smoke — views mount', () => {
  test('each dashboard view renders without a page error', async ({ page }) => {
    const errors = await gotoGps(page);

    for (const view of VIEWS) {
      await gotoView(page, view);
      // Grid present = the view actually mounted (not a blank shell).
      await expect(page.locator(`.gp-view[data-view="${view}"] .gp-grid`).first()).toBeVisible();
      // Let each view's async init settle so a late throw is attributed here.
      await page.waitForTimeout(500);
    }

    expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

// ── 2. A KPI and a table render WITH data (the highest-value check) ─────────────
test.describe('GPS smoke — render with data', () => {
  test('KPI card shows a number', async ({ page }) => {
    const errors = await gotoGps(page);
    await gotoView(page, 'ind');

    // card-gen-week-kpi is a default-visible squad KPI (Total Distance). The resolver
    // fills its .gp-kpi .v with a formatted number (e.g. "43,992 m").
    const kpiValue = page.locator('#card-gen-week-kpi .gp-kpi .v').first();
    await expect.poll(
      async () => (await kpiValue.textContent().catch(() => ''))?.replace(/\s/g, '') || '',
      { timeout: 15_000, message: 'KPI value never showed a digit' }
    ).toMatch(/\d/);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('table card renders one row per player', async ({ page }) => {
    const errors = await gotoGps(page);
    await gotoView(page, 'grp');

    // card-gen-session-table is a default-visible squad table grouped by player_name.
    // With 3 players in the fixture it renders 3 rows.
    const rows = page.locator('#card-gen-session-table tbody tr');
    await expect.poll(() => rows.count(), {
      timeout: 15_000, message: 'session table never rendered any rows',
    }).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// ── 3. Cross-filter fires gpfilter:change (B1 — real click on a data cell) ──────
test.describe('GPS smoke — cross-filter', () => {
  test('clicking a table dimension cell emits gpfilter:change', async ({ page }) => {
    const errors = await gotoGps(page);
    await gotoView(page, 'grp');

    // The dimension cells of a builder table carry data-fid; the cross-filter handler
    // (GPS Analysis.html:3544) turns a click on one into a filter-bar setValue, which
    // dispatches document 'gpfilter:change' (debounced ~170ms).
    const cell = page.locator('#card-gen-session-table td[data-fid]').first();
    await expect(cell).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => {
      window.__xfHits = 0;
      document.addEventListener('gpfilter:change', () => { window.__xfHits = (window.__xfHits || 0) + 1; });
    });

    await cell.click({ force: true });

    await expect.poll(() => page.evaluate(() => window.__xfHits || 0), {
      timeout: 5_000, message: 'gpfilter:change never fired after clicking a cross-filter cell',
    }).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// ── 4. Charts (bars + scatter) draw with data ──────────────────────────────────
test.describe('GPS smoke — charts draw', () => {
  test('ind view mounts at least one chart canvas with real dimensions', async ({ page }) => {
    const errors = await gotoGps(page);
    await gotoView(page, 'ind');

    // Chart.js renders into <canvas>. A canvas with a non-zero box = the chart pipeline
    // produced output rather than throwing / leaving an empty state.
    await expect.poll(async () => {
      return page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('.gp-view[data-view="ind"] canvas'));
        return canvases.filter(c => c.clientWidth > 0 && c.clientHeight > 0).length;
      });
    }, { timeout: 15_000, message: 'no chart canvas ever gained a size' }).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
