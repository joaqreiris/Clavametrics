import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:       './tests/e2e',
  // 60 s por test, y NO bajarlo. Tienta hacerlo: un spec suelto pasa holgado con 15 s, y el techo
  // alto hace que un selector que ya no existe tarde 60 s en admitirlo. Pero el número no está
  // puesto para el caso aislado, está puesto para la suite entera: con 5 workers peleándose la
  // máquina, estos e2e montan la app COMPLETA por caso y un test que solo tarda 8 s se pasa de
  // los 30. Probado el 2026-09-12: con 30 s, gps-box, gps-builder-controls, gps-builder-title y
  // gps-baseline-ref se cayeron en la suite completa (16 casos) y los cuatro pasan 7/7 corridos
  // solos, a 30 s igual que a 60. Son fallos de contención, no del producto.
  // Lo que hay que atacar para que la suite tarde menos son los tests que esperan a UI que ya no
  // existe, no este techo.
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
