import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:       './tests/e2e',
  // 60 s por test. Estos e2e montan la app ENTERA por caso (GPS Analysis carga catálogo, filtros,
  // dashboards y resuelve cada card), y con la suite completa en un worker el arranque se pasa de
  // los 30 s que trae Playwright por defecto: aparecían fallos que aislados pasaban siempre.
  timeout:       60_000,
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
