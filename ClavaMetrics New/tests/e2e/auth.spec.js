// @ts-check
import { test, expect } from '@playwright/test';

const SB = 'https://xesrumijvdmqjrufgeka.supabase.co';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function mockAuthSuccess(page, { email = 'test@test.com' } = {}) {
  await page.route(`${SB}/auth/v1/**`, route =>
    route.fulfill({
      json: {
        access_token: 'test-token', token_type: 'bearer',
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'test-refresh',
        user: { id: 'user-1', email, aud: 'authenticated', role: 'authenticated' },
      }
    })
  );
}

async function mockAuthError(page, message = 'Invalid login credentials') {
  await page.route(`${SB}/auth/v1/token**`, route =>
    route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: message } })
  );
}

async function mockProfileAndClub(page) {
  await page.route(`${SB}/rest/v1/profiles**`, route =>
    route.fulfill({ json: [{ id: 'user-1', club_id: 'club-1', first_name: 'Test', last_name: 'User', club_role: 'Coach' }] })
  );
  await page.route(`${SB}/rest/v1/clubs**`, route =>
    route.fulfill({ json: [{ id: 'club-1', name: 'Test FC', primary_color: '#3B82F6', logo_url: null }] })
  );
}

async function mockRegisterSuccess(page) {
  await page.route(`${SB}/auth/v1/signup`, route =>
    route.fulfill({
      status: 200,
      json: {
        access_token: 'test-token', token_type: 'bearer',
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'test-refresh',
        user: { id: 'new-user-1', email: 'new@club.com', aud: 'authenticated', role: 'authenticated' },
        session: {
          access_token: 'test-token',
          user: { id: 'new-user-1', email: 'new@club.com' },
        },
      }
    })
  );
  await page.route(`${SB}/rest/v1/clubs`, route =>
    route.fulfill({ status: 201, json: [{ id: 'club-new', name: 'New FC' }] })
  );
  await page.route(`${SB}/rest/v1/profiles`, route =>
    route.fulfill({ status: 201, json: [{ id: 'new-user-1', club_id: 'club-new' }] })
  );
}

async function mockRegisterEmailConfirmation(page) {
  await page.route(`${SB}/auth/v1/signup`, route =>
    route.fulfill({
      status: 200,
      json: {
        user: { id: 'new-user-1', email: 'new@club.com', aud: 'authenticated' },
        session: null,
      }
    })
  );
}

async function mockRegisterError(page, message = 'User already registered') {
  await page.route(`${SB}/auth/v1/signup`, route =>
    route.fulfill({ status: 422, json: { code: 422, msg: message } })
  );
}

// ── Fill registration form ────────────────────────────────────────────────────

async function fillRegForm(page, overrides = {}) {
  const vals = {
    clubName:  'Test FC',
    firstName: 'John',
    lastName:  'Doe',
    email:     'john@testfc.com',
    password:  'password123',
    ...overrides,
  };
  await page.fill('#club-name',  vals.clubName);
  await page.fill('#first-name', vals.firstName);
  await page.fill('#last-name',  vals.lastName);
  await page.fill('#email',      vals.email);
  await page.fill('#pwd',        vals.password);
  await page.check('#terms');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN.HTML
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Render', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Login.html');
  });

  test('shows email and password inputs', async ({ page }) => {
    await expect(page.locator('#emailInput')).toBeVisible();
    await expect(page.locator('#passInput')).toBeVisible();
  });

  test('shows submit button', async ({ page }) => {
    await expect(page.locator('#loginBtn')).toBeVisible();
  });

  test('shows Google and Apple OAuth buttons', async ({ page }) => {
    await expect(page.locator('#googleBtn')).toBeVisible();
    await expect(page.locator('#appleBtn')).toBeVisible();
  });

  test('error message is hidden by default', async ({ page }) => {
    const err = page.locator('#errorMsg');
    const text = await err.textContent();
    expect(text?.trim()).toBe('');
  });
});

test.describe('Login — Session redirect', () => {
  test('redirects to Hub.html when a session already exists', async ({ page }) => {
    await injectSession(page);
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ json: { user: { id: 'user-1' } } })
    );
    await page.goto('/Login.html');
    await page.waitForURL(/Hub\.html/, { timeout: 8000 });
  });
});

test.describe('Login — Success', () => {
  test('redirects to Hub.html on valid credentials', async ({ page }) => {
    await mockAuthSuccess(page);
    await mockProfileAndClub(page);
    await page.goto('/Login.html');

    await page.fill('#emailInput', 'test@test.com');
    await page.fill('#passInput', 'password123');
    await page.click('#loginBtn');

    await page.waitForURL(/Hub\.html/, { timeout: 10_000 });
  });

  test('button shows loading state while request is in flight', async ({ page }) => {
    let release;
    const gate = new Promise(r => (release = r));

    await page.route(`${SB}/auth/v1/token**`, async route => {
      await gate;
      route.fulfill({ json: { access_token: 'tok', user: { id: 'u1' }, session: { access_token: 'tok', user: { id: 'u1' } } } });
    });

    await page.goto('/Login.html');
    await page.fill('#emailInput', 'test@test.com');
    await page.fill('#passInput', 'password123');
    await page.click('#loginBtn');

    await expect(page.locator('#loginBtn')).toBeDisabled();
    await expect(page.locator('#loginBtn')).toContainText('Signing');
    release();
  });
});

test.describe('Login — Error handling', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthError(page, 'Invalid login credentials');
    await page.goto('/Login.html');
  });

  test('shows error message on failed login', async ({ page }) => {
    await page.fill('#emailInput', 'wrong@test.com');
    await page.fill('#passInput', 'wrongpass');
    await page.click('#loginBtn');
    await expect(page.locator('#errorMsg')).toContainText('Invalid', { timeout: 8000 });
  });

  test('button is re-enabled after failed login', async ({ page }) => {
    await page.fill('#emailInput', 'wrong@test.com');
    await page.fill('#passInput', 'wrongpass');
    await page.click('#loginBtn');
    await page.locator('#errorMsg').waitFor({ state: 'visible', timeout: 8000 });
    await expect(page.locator('#loginBtn')).not.toBeDisabled();
  });

  test('button label restored after failed login', async ({ page }) => {
    await page.fill('#emailInput', 'wrong@test.com');
    await page.fill('#passInput', 'wrongpass');
    await page.click('#loginBtn');
    await page.locator('#errorMsg').waitFor({ state: 'visible', timeout: 8000 });
    await expect(page.locator('#loginBtn')).not.toContainText('Signing');
  });
});

test.describe('Login — Forgot password', () => {
  test('forgot password link is visible', async ({ page }) => {
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Login.html');
    const link = page.locator('a', { hasText: /forgot|reset/i });
    await expect(link.first()).toBeVisible();
  });

  test('reset password request shows confirmation', async ({ page }) => {
    await page.route(`${SB}/auth/v1/recover`, route =>
      route.fulfill({ status: 200, json: {} })
    );
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Login.html');

    const resetLink = page.locator('a', { hasText: /forgot|reset/i }).first();
    const href = await resetLink.getAttribute('href');
    if (href && href !== '#') {
      // External reset page — just verify link is clickable
      await expect(resetLink).toBeEnabled();
    } else {
      await resetLink.click();
      await page.fill('#emailInput', 'test@test.com');
      await page.keyboard.press('Enter');
      await expect(page.locator('#errorMsg, .login-alert')).toBeVisible({ timeout: 6000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER.HTML
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Register — Render', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Register.html');
  });

  test('shows club name, country, org-size fields', async ({ page }) => {
    await expect(page.locator('#club-name')).toBeVisible();
    await expect(page.locator('#country')).toBeVisible();
    await expect(page.locator('#org-size')).toBeVisible();
  });

  test('shows personal info fields', async ({ page }) => {
    await expect(page.locator('#first-name')).toBeVisible();
    await expect(page.locator('#last-name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#pwd')).toBeVisible();
  });

  test('shows terms checkbox', async ({ page }) => {
    await expect(page.locator('#terms')).toBeVisible();
  });

  test('shows Google and Apple OAuth buttons', async ({ page }) => {
    await expect(page.locator('#googleBtn')).toBeVisible();
    await expect(page.locator('#appleBtn')).toBeVisible();
  });

  test('shows step progress rail', async ({ page }) => {
    await expect(page.locator('.reg-steps')).toBeVisible();
    await expect(page.locator('.reg-step')).toHaveCount(4);
  });

  test('step 1 is active by default', async ({ page }) => {
    await expect(page.locator('.reg-step.is-current')).toHaveCount(1);
    await expect(page.locator('.reg-step.is-current').first()).toContainText('1');
  });
});

test.describe('Register — Session redirect', () => {
  test('redirects to Hub.html when a session already exists', async ({ page }) => {
    await injectSession(page);
    await page.route(`${SB}/auth/v1/**`, route =>
      route.fulfill({ json: { user: { id: 'user-1' } } })
    );
    await page.goto('/Register.html');
    await page.waitForURL(/Hub\.html/, { timeout: 8000 });
  });
});

test.describe('Register — Email confirmation flow', () => {
  test('shows check-email message when session is null after signup', async ({ page }) => {
    await mockRegisterEmailConfirmation(page);
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Register.html');

    await fillRegForm(page);
    await page.click('button[type="submit"], .cm-btn.is-primary');

    await expect(page.locator('#reg-error, .reg-form .login-alert')).toContainText(
      /check your email|confirm your account/i,
      { timeout: 10_000 }
    );
  });

  test('does not insert club/profile rows on email-confirmation flow', async ({ page }) => {
    let clubInsertCalled = false;
    await mockRegisterEmailConfirmation(page);
    await page.route(`${SB}/rest/v1/clubs`, route => {
      if (route.request().method() === 'POST') clubInsertCalled = true;
      route.fulfill({ status: 201, json: [] });
    });
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));

    await page.goto('/Register.html');
    await fillRegForm(page);
    await page.click('button[type="submit"], .cm-btn.is-primary');
    await page.locator('#reg-error, .reg-form .login-alert').waitFor({ timeout: 10_000 });

    expect(clubInsertCalled).toBe(false);
  });
});

test.describe('Register — Error handling', () => {
  test('shows error message on registration failure', async ({ page }) => {
    await mockRegisterError(page, 'User already registered');
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Register.html');

    await fillRegForm(page);
    await page.click('button[type="submit"], .cm-btn.is-primary');

    await expect(page.locator('#reg-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#reg-error')).toContainText(/already|registered|failed/i);
  });

  test('button label restored after registration error', async ({ page }) => {
    await mockRegisterError(page);
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Register.html');

    const btn = page.locator('button[type="submit"], .cm-btn.is-primary').first();
    const originalText = await btn.textContent();

    await fillRegForm(page);
    await btn.click();
    await page.locator('#reg-error').waitFor({ timeout: 10_000 });

    await expect(btn).not.toContainText(/creating|loading|wait/i);
  });
});

test.describe('Register — OAuth buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Register.html');
  });

  test('Google button calls oauthRegister', async ({ page }) => {
    let oauthCalled = false;
    await page.route(`${SB}/auth/v1/authorize**`, route => {
      oauthCalled = true;
      route.fulfill({ json: {} });
    });
    await page.click('#googleBtn');
    expect(oauthCalled).toBe(true);
  });

  test('Apple button calls oauthRegister', async ({ page }) => {
    let oauthCalled = false;
    await page.route(`${SB}/auth/v1/authorize**`, route => {
      oauthCalled = true;
      route.fulfill({ json: {} });
    });
    await page.click('#appleBtn');
    expect(oauthCalled).toBe(true);
  });
});

test.describe('Register — Link to Login', () => {
  test('has a link to Login.html', async ({ page }) => {
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Register.html');
    const link = page.locator('a[href="Login.html"]');
    await expect(link.first()).toBeVisible();
  });
});

test.describe('Login — Link to Register', () => {
  test('has a link to Register.html', async ({ page }) => {
    await page.route(`${SB}/**`, route => route.fulfill({ json: {} }));
    await page.goto('/Login.html');
    const link = page.locator('a[href="Register.html"]');
    await expect(link.first()).toBeVisible();
  });
});
