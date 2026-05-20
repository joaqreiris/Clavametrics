import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:       './tests/e2e',
  fullyParallel: false,
  retries:       process.env.CI ? 1 : 0,
  reporter:      'html',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',
    trace:   'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command:             'npx serve . -p 5500 --no-clipboard',
    url:                 'http://localhost:5500',
    reuseExistingServer: !process.env.CI,
    timeout:             10_000,
  },
});
