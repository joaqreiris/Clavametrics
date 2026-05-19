// @ts-check
import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SB = 'https://xesrumijvdmqjrufgeka.supabase.co';

const MC = {
  id: 'mc-1', name: 'MC 01',
  start_date: '2026-05-14', end_date: '2026-05-21',
  match_date: '2026-05-20', rival: 'Atlético', home_away: 'home',
  color: '#C9A84C',
};

const SESSION = {
  id: 'sess-1', name: '8vs8', date: '2026-05-15',
  focus: 'Technical', duration: 90, notes: 'Test notes',
  microcycle: 'MC 01', club_id: 'club-1',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Injects a fake Supabase session into localStorage before page scripts run. */
async function injectSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-xesrumijvdmqjrufgeka-auth-token',
      JSON.stringify({
        access_token: 'test-token', token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'test-refresh',
        user: { id: 'user-1', email: 'test@test.com', aud: 'authenticated', role: 'authenticated' },
      })
    );
  });
}

/**
 * Mocks all Supabase REST calls.
 * @param {{ sessions?: object[], mcs?: object[], sessionsError?: boolean }} opts
 */
async function mockSupabase(page, opts = {}) {
  const { sessions = [SESSION], mcs = [MC], sessionsError = false } = opts;

  await page.route(`${SB}/auth/v1/**`, route =>
    route.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } })
  );

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();

    if (url.includes('/profiles'))
      return route.fulfill({ json: [{ id: 'user-1', club_id: 'club-1', name: 'Test User', role: 'coach', club_role: 'Head Coach' }] });

    if (url.includes('/clubs'))
      return route.fulfill({ json: [{ id: 'club-1', name: 'Test FC', accent_color: '#3B82F6' }] });

    if (url.includes('/microcycles'))
      return route.fulfill({ json: mcs });

    if (url.includes('/players'))
      return route.fulfill({ json: [], headers: { 'content-range': '*/5' } });

    if (url.includes('/injuries'))
      return route.fulfill({ json: [], headers: { 'content-range': '*/2' } });

    if (url.includes('/training_sessions')) {
      if (sessionsError)
        return route.fulfill({ status: 400, json: { code: '42703', message: 'column does not exist' } });
      if (method === 'GET')    return route.fulfill({ json: sessions });
      if (method === 'POST')   return route.fulfill({ status: 201, json: [{ ...SESSION, id: 'new-1' }] });
      if (method === 'PATCH')  return route.fulfill({ json: [SESSION] });
      if (method === 'DELETE') return route.fulfill({ json: [] });
    }

    await route.continue();
  });
}

/** Opens Calendar page and waits for the grid to be ready. */
async function gotoCalendar(page, opts = {}) {
  await injectSession(page);
  await mockSupabase(page, opts);
  await page.goto('/Calendar.html');
  await page.waitForSelector('.mc-day', { timeout: 10_000 });
}

// ── 1. RENDER ─────────────────────────────────────────────────────────────────

test.describe('Render', () => {
  test('renders 7 day columns', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('.mc-day')).toHaveCount(7);
  });

  test('shows MC name in card header', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('#calMcTitle')).toContainText('MC 01');
  });

  test('shows existing session in its day column', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('.mc-evt.training .name').first()).toContainText('8vs8');
  });

  test('highlights today column when within MC range', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const inRange = today >= MC.start_date && today <= MC.end_date;
    await gotoCalendar(page);
    if (inRange) {
      await expect(page.locator('.mc-day.is-today')).toBeVisible();
    } else {
      await expect(page.locator('.mc-day.is-today')).toHaveCount(0);
    }
  });

  test('populates sidebar club name', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('#sideClubName')).toContainText('Test FC');
  });

  test('populates sidebar user name', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('#userName')).toContainText('Test User');
  });

  test('shows rival in target match cell', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('#calMcTarget')).toContainText('Atlético');
  });

  test('shows MC length in days', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('#calMcLength')).toContainText('8');
  });

  test('shows session count', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('#calMcSessions')).not.toContainText('—');
  });

  test('"+ Add" button exists in every day column', async ({ page }) => {
    await gotoCalendar(page);
    await expect(page.locator('[data-add-date]')).toHaveCount(7);
  });
});

// ── 2. LOADING STATES ─────────────────────────────────────────────────────────

test.describe('Loading states', () => {
  test('shows loading text before sessions resolve', async ({ page }) => {
    await injectSession(page);

    let releaseRequest;
    const gate = new Promise(r => (releaseRequest = r));

    await page.route(`${SB}/rest/v1/training_sessions**`, async route => {
      if (route.request().method() === 'GET') {
        await gate;
        return route.fulfill({ json: [SESSION] });
      }
      await route.continue();
    });

    // Mock remaining routes instantly
    await mockSupabase(page);  // will be overridden by the specific route above for sessions

    await page.goto('/Calendar.html');
    await expect(page.locator('#calDaysGrid')).toContainText('Loading');

    releaseRequest();
    await page.waitForSelector('.mc-day');
  });

  test('shows "No microcycles found" when table is empty', async ({ page }) => {
    await injectSession(page);
    await mockSupabase(page, { mcs: [] });
    await page.goto('/Calendar.html');
    await expect(page.locator('#calDaysGrid')).toContainText('No microcycles found', { timeout: 8000 });
  });
});

// ── 3. NAVIGATION ─────────────────────────────────────────────────────────────

test.describe('Week navigation', () => {
  const LONG_MC = { ...MC, start_date: '2026-05-14', end_date: '2026-05-27' };

  test('prev button disabled on week 1', async ({ page }) => {
    await gotoCalendar(page, { mcs: [LONG_MC] });
    await expect(page.locator('#calWeekPrev')).toBeDisabled();
  });

  test('next button navigates to week 2', async ({ page }) => {
    await gotoCalendar(page, { mcs: [LONG_MC] });
    await page.click('#calWeekNext');
    await expect(page.locator('#calWeekLabel')).toContainText('Week 2');
  });

  test('prev button enabled after navigating to week 2', async ({ page }) => {
    await gotoCalendar(page, { mcs: [LONG_MC] });
    await page.click('#calWeekNext');
    await expect(page.locator('#calWeekPrev')).toBeEnabled();
  });

  test('next button disabled on last week', async ({ page }) => {
    await gotoCalendar(page, { mcs: [LONG_MC] });
    await page.click('#calWeekNext');
    await expect(page.locator('#calWeekNext')).toBeDisabled();
  });

  test('navigating back to week 1 re-disables prev button', async ({ page }) => {
    await gotoCalendar(page, { mcs: [LONG_MC] });
    await page.click('#calWeekNext');
    await page.click('#calWeekPrev');
    await expect(page.locator('#calWeekPrev')).toBeDisabled();
    await expect(page.locator('#calWeekLabel')).toContainText('Week 1');
  });
});

test.describe('MC switcher', () => {
  const MC2 = { ...MC, id: 'mc-2', name: 'MC 02', start_date: '2026-05-28', end_date: '2026-06-04' };

  test('dots button opens dropdown with MC list', async ({ page }) => {
    await gotoCalendar(page, { mcs: [MC, MC2] });
    await page.click('#calMcNav');
    await expect(page.locator('#calMcPopover')).toBeVisible();
    await expect(page.locator('#calMcPopover button').nth(0)).toContainText('MC 01');
    await expect(page.locator('#calMcPopover button').nth(1)).toContainText('MC 02');
  });

  test('clicking same button again closes dropdown', async ({ page }) => {
    await gotoCalendar(page, { mcs: [MC, MC2] });
    await page.click('#calMcNav');
    await page.click('#calMcNav');
    await expect(page.locator('#calMcPopover')).toHaveCount(0);
  });

  test('clicking outside dropdown closes it', async ({ page }) => {
    await gotoCalendar(page, { mcs: [MC, MC2] });
    await page.click('#calMcNav');
    await page.locator('h1').click();
    await expect(page.locator('#calMcPopover')).toHaveCount(0);
  });

  test('selecting a different MC updates the header', async ({ page }) => {
    await gotoCalendar(page, { mcs: [MC, MC2] });
    await page.click('#calMcNav');
    await page.locator('#calMcPopover button', { hasText: 'MC 02' }).click();
    await expect(page.locator('#calMcTitle')).toContainText('MC 02');
  });
});

test.describe('Sidebar navigation', () => {
  test('clicking Squad link navigates to Squad.html', async ({ page }) => {
    await gotoCalendar(page);
    await page.click('a[href="Squad.html"]');
    await expect(page).toHaveURL(/Squad\.html/);
  });

  test('clicking Hub link navigates to Hub.html', async ({ page }) => {
    await gotoCalendar(page);
    await page.click('a[href="Hub.html"]');
    await expect(page).toHaveURL(/Hub\.html/);
  });
});

// ── 4. FILTER PILLS ───────────────────────────────────────────────────────────

test.describe('Filter pills', () => {
  const gymSession = { ...SESSION, id: 'sess-2', focus: 'Gym', name: 'Strength', date: '2026-05-16' };

  test.beforeEach(async ({ page }) => {
    await gotoCalendar(page, { sessions: [SESSION, gymSession] });
  });

  test('"All" is active by default', async ({ page }) => {
    await expect(page.locator('.cal-filter-pill.is-on').first()).toContainText('All');
  });

  test('only one pill is active at a time', async ({ page }) => {
    await page.locator('.cal-filter-pill', { hasText: 'Training' }).click();
    await expect(page.locator('.cal-filter-pill.is-on')).toHaveCount(1);
  });

  test('filtering by Gym hides training events', async ({ page }) => {
    await page.locator('.cal-filter-pill', { hasText: 'Gym' }).click();
    await expect(page.locator('.mc-evt.training')).toHaveCount(0);
    await expect(page.locator('.mc-evt.gym')).toHaveCount(1);
  });

  test('filtering with no matches shows "Hidden by filter"', async ({ page }) => {
    await page.locator('.cal-filter-pill', { hasText: 'Match' }).click();
    await expect(page.locator('text=Hidden by filter').first()).toBeVisible();
  });

  test('switching back to All restores all events', async ({ page }) => {
    await page.locator('.cal-filter-pill', { hasText: 'Gym' }).click();
    await page.locator('.cal-filter-pill', { hasText: 'All' }).click();
    await expect(page.locator('.mc-evt.training')).toHaveCount(1);
    await expect(page.locator('.mc-evt.gym')).toHaveCount(1);
  });
});

// ── 5. MODAL — OPEN / CLOSE ───────────────────────────────────────────────────

test.describe('Modal open/close', () => {
  test.beforeEach(async ({ page }) => { await gotoCalendar(page); });

  test('header "New event" button opens modal', async ({ page }) => {
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await expect(page.locator('#calEvtBackdrop')).toHaveClass(/is-open/);
    await expect(page.locator('#calEvtTitle')).toContainText('New event');
  });

  test('"+ Add" day button opens modal with pre-filled date', async ({ page }) => {
    const btn  = page.locator('[data-add-date]').first();
    const date = await btn.getAttribute('data-add-date');
    await btn.click();
    await expect(page.locator('#calEvtF_date')).toHaveValue(date);
  });

  test('Delete button hidden for new event', async ({ page }) => {
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await expect(page.locator('#calEvtDelete')).toBeHidden();
  });

  test('Cancel button closes modal', async ({ page }) => {
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.click('#calEvtCancel');
    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
  });

  test('X button closes modal', async ({ page }) => {
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.click('#calEvtClose');
    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
  });

  test('backdrop click closes modal', async ({ page }) => {
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.locator('#calEvtBackdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
  });

  test('Escape key closes modal', async ({ page }) => {
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
  });
});

// ── 6. FORM — STRUCTURE ───────────────────────────────────────────────────────

test.describe('Form structure', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCalendar(page);
    await page.locator('.cal-head .cm-btn.is-primary').click();
  });

  test('all required fields are present', async ({ page }) => {
    await expect(page.locator('#calEvtF_title')).toBeVisible();
    await expect(page.locator('#calEvtF_type')).toBeVisible();
    await expect(page.locator('#calEvtF_date')).toBeVisible();
    await expect(page.locator('#calEvtF_duration')).toBeVisible();
    await expect(page.locator('#calEvtF_notes')).toBeVisible();
  });

  test('type select has exactly 5 options', async ({ page }) => {
    await expect(page.locator('#calEvtF_type option')).toHaveCount(5);
  });

  test('notes field is a textarea (not a single-line input)', async ({ page }) => {
    const tag = await page.locator('#calEvtF_notes').evaluate(el => el.tagName.toLowerCase());
    expect(tag).toBe('textarea');
  });

  test('modal has aria-modal and aria-labelledby attributes', async ({ page }) => {
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', 'calEvtTitle');
  });
});

// ── 7. FORM — VALIDATION ─────────────────────────────────────────────────────

test.describe('Form validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCalendar(page);
    await page.locator('.cal-head .cm-btn.is-primary').click();
  });

  test('shows toast when title is empty on save', async ({ page }) => {
    await page.fill('#calEvtF_date', '2026-05-15');
    await page.click('#calEvtSave');
    await expect(page.locator('#calToast')).toHaveClass(/is-show/);
    await expect(page.locator('#calToast')).toContainText('Title is required');
  });

  test('modal stays open after failed validation', async ({ page }) => {
    await page.click('#calEvtSave');
    await expect(page.locator('#calEvtBackdrop')).toHaveClass(/is-open/);
  });
});

// ── 8. FORM — SAVE (NEW) ──────────────────────────────────────────────────────

test.describe('Form save — new event', () => {
  test('closes modal and shows toast on success', async ({ page }) => {
    await gotoCalendar(page);
    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.fill('#calEvtF_title', 'New Training');
    await page.fill('#calEvtF_date', '2026-05-16');
    await page.fill('#calEvtF_duration', '75');
    await page.click('#calEvtSave');

    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
    await expect(page.locator('#calToast')).toContainText('Session added');
  });

  test('shows "Saving…" indicator while request is in flight', async ({ page }) => {
    await injectSession(page);
    let release;
    const gate = new Promise(r => (release = r));

    await mockSupabase(page);
    await page.route(`${SB}/rest/v1/training_sessions`, async route => {
      if (route.request().method() === 'POST') {
        await gate;
        return route.fulfill({ status: 201, json: [{ ...SESSION, id: 'x' }] });
      }
      await route.continue();
    });

    await page.goto('/Calendar.html');
    await page.waitForSelector('.mc-day');

    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.fill('#calEvtF_title', 'Slow save');
    await page.fill('#calEvtF_date', '2026-05-16');
    await page.click('#calEvtSave');

    await expect(page.locator('#calEvtSaving')).toBeVisible();
    await expect(page.locator('#calEvtSave')).toBeDisabled();
    release();
  });
});

// ── 9. MODAL — EDIT EVENT ─────────────────────────────────────────────────────

test.describe('Modal — edit event', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCalendar(page);
    await page.locator('.mc-evt.training').first().click();
  });

  test('opens with "Edit event" title', async ({ page }) => {
    await expect(page.locator('#calEvtTitle')).toContainText('Edit event');
  });

  test('populates all fields from the session', async ({ page }) => {
    await expect(page.locator('#calEvtF_title')).toHaveValue('8vs8');
    await expect(page.locator('#calEvtF_date')).toHaveValue('2026-05-15');
    await expect(page.locator('#calEvtF_duration')).toHaveValue('90');
    await expect(page.locator('#calEvtF_notes')).toHaveValue('Test notes');
  });

  test('Delete button is visible', async ({ page }) => {
    await expect(page.locator('#calEvtDelete')).toBeVisible();
  });

  test('saving update shows toast and closes modal', async ({ page }) => {
    await page.fill('#calEvtF_title', 'Updated 8vs8');
    await page.click('#calEvtSave');
    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
    await expect(page.locator('#calToast')).toContainText('Session updated');
  });
});

// ── 10. DELETE ────────────────────────────────────────────────────────────────

test.describe('Delete event', () => {
  test('cancel on confirm dialog keeps modal open', async ({ page }) => {
    await gotoCalendar(page);
    await page.locator('.mc-evt.training').first().click();
    page.on('dialog', d => d.dismiss());
    await page.click('#calEvtDelete');
    await expect(page.locator('#calEvtBackdrop')).toHaveClass(/is-open/);
  });

  test('confirming delete closes modal and shows toast', async ({ page }) => {
    await gotoCalendar(page);
    await page.locator('.mc-evt.training').first().click();
    page.on('dialog', d => d.accept());
    await page.click('#calEvtDelete');
    await expect(page.locator('#calEvtBackdrop')).not.toHaveClass(/is-open/);
    await expect(page.locator('#calToast')).toContainText('Session deleted');
  });
});

// ── 11. API ERRORS ────────────────────────────────────────────────────────────

test.describe('API errors', () => {
  test('loadSessions error shows message in grid', async ({ page }) => {
    await injectSession(page);
    await mockSupabase(page, { sessionsError: true });
    await page.goto('/Calendar.html');
    await expect(page.locator('#calDaysGrid')).toContainText('Error loading sessions', { timeout: 8000 });
  });

  test('save error shows toast with message', async ({ page }) => {
    await injectSession(page);
    await mockSupabase(page);
    await page.route(`${SB}/rest/v1/training_sessions`, async route => {
      if (route.request().method() === 'POST')
        return route.fulfill({ status: 400, json: { message: 'RLS policy violation' } });
      await route.continue();
    });

    await page.goto('/Calendar.html');
    await page.waitForSelector('.mc-day');

    await page.locator('.cal-head .cm-btn.is-primary').click();
    await page.fill('#calEvtF_title', 'Fail session');
    await page.fill('#calEvtF_date', '2026-05-16');
    await page.click('#calEvtSave');

    await expect(page.locator('#calToast')).toHaveClass(/is-show/);
    await expect(page.locator('#calToast')).toContainText('Error');
  });

  test('delete error shows toast', async ({ page }) => {
    await injectSession(page);
    await mockSupabase(page);
    await page.route(`${SB}/rest/v1/training_sessions**`, async route => {
      if (route.request().method() === 'DELETE')
        return route.fulfill({ status: 500, json: { message: 'Internal server error' } });
      await route.continue();
    });

    await page.goto('/Calendar.html');
    await page.waitForSelector('.mc-evt.training');
    await page.locator('.mc-evt.training').first().click();
    page.on('dialog', d => d.accept());
    await page.click('#calEvtDelete');

    await expect(page.locator('#calToast')).toContainText('Error');
  });

  test('shows "No microcycles found" for empty mcs table', async ({ page }) => {
    await injectSession(page);
    await mockSupabase(page, { mcs: [] });
    await page.goto('/Calendar.html');
    await expect(page.locator('#calDaysGrid')).toContainText('No microcycles found', { timeout: 8000 });
  });
});
