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
    // 10 s no alcanzaban: `npx serve` tarda más cuando la máquina está cargada, y si el servidor
    // no llega a tiempo NO falla un test — fallan TODOS a la vez, rápido y con errores que
    // parecen del producto («no encuentro el elemento»). Eso mandó a perseguir fantasmas más de
    // una vez. Con 60 s el arranque nunca es el motivo de un rojo.
    timeout:             60_000,
  },
});
