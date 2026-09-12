import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:       './tests/e2e',
  // 30 s por test. Los 60 s venían de cuando el arranque de la app se pasaba de los 30 s que trae
  // Playwright por defecto; eso lo cubre ahora `webServer.timeout` de abajo, que es el que espera
  // al servidor. Medido el 2026-09-12: un caso cuesta ~4 s y la suite entera pasa con --timeout
  // 15000, así que 30 s dan 7x de margen. El techo alto no daba robustez, daba espera: un
  // selector que ya no existe tardaba 60 s en admitirlo, y cuatro de esos se comían 4 de los
  // 16,6 min de la suite. Si un caso legítimo necesita más, que lo pida él con test.setTimeout().
  timeout:       30_000,
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
