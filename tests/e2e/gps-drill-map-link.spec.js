// @ts-check
// El wizard de importación manda a la biblioteca con ?mapdrills=1 cuando el archivo trajo drills
// que todavía no apuntan a ningún ejercicio. Sin ese enlace el import "salía bien" y el análisis
// por tarea quedaba vacío igual: los period_name sin mapear no entran a v_gps_task_analysis.
//
// Lo que se verifica es que el parámetro dispare la MISMA carga que el botón «Map drills»
// (el panel pide v_gps_period_names al abrirse) y que no quede pegado en la URL.
import { test, expect } from '@playwright/test';
import { SB, injectSession, mockBase } from './_shared.js';

const PERIOD_NAMES = [
  { period_name: 'RONDO 4V4 30X20', n_instances: 12, avg_minutes: 8.4 },
  { period_name: 'PARTIDO 7V7 60X40', n_instances: 9, avg_minutes: 14.2 },
];

// `npx serve` (sólo en los tests) redirige 301 de "/X.html?q" a "/X" y se come el query.
// En producción no hay cleanUrls — vercel.json sólo reescribe "/" y /support — así que el
// link del wizard viaja con el .html. Acá navegamos a la forma limpia para no chocar con eso.
const LIB = '/Exercises Library';

// OJO con el orden: Playwright evalúa las rutas de la última registrada a la primera,
// así que el comodín va PRIMERO y los casos concretos después.
async function mockLibrary(page) {
  const hits = { periodNames: 0 };
  await page.route(`${SB}/rest/v1/**`, route => route.fulfill({ json: [] }));
  await mockBase(page);
  // Admin: el panel de mapeo sólo existe para admin/owner (mismo criterio que la RLS).
  // getClubId() pide el perfil con .maybeSingle() (Accept: …pgrst.object+json) y espera UN objeto:
  // devolverle un array deja clubId en null y el panel sale sin abrir.
  const PROF = { id: 'user-1', club_id: 'club-1', first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
  await page.route(`${SB}/rest/v1/profiles**`, route => {
    const wantsObject = (route.request().headers()['accept'] || '').includes('object');
    return route.fulfill({ json: wantsObject ? PROF : [PROF] });
  });
  // El candado de plan es fail-closed: sin estas features guardModule() saca a la página.
  await page.route(`${SB}/rest/v1/rpc/my_plan_features`, route =>
    route.fulfill({ json: ['sessions_library', 'gps_analysis', 'squad'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features`, route =>
    route.fulfill({ json: ['sessions_library', 'gps_analysis', 'squad'] }));
  // El panel de mapeo es admin-only; con esto el usuario de prueba lo alcanza.
  await page.route(`${SB}/rest/v1/rpc/is_super_admin`, route => route.fulfill({ json: true }));
  await page.route(`${SB}/rest/v1/v_gps_period_names**`, route => {
    hits.periodNames++;
    return route.fulfill({ json: PERIOD_NAMES });
  });
  await page.route(`${SB}/rest/v1/gps_drill_map**`, route => route.fulfill({ json: [] }));
  return hits;
}

test.describe('Exercises Library — enlace del wizard al mapeo de drills', () => {
  test('?mapdrills=1 abre el panel de mapeo solo', async ({ page }) => {
    await injectSession(page);
    const hits = await mockLibrary(page);
    await page.goto(`${LIB}?mapdrills=1`);
    await expect.poll(() => hits.periodNames, { timeout: 15_000 }).toBeGreaterThan(0);
    // [data-list] es la lista de grupos del panel: no depende del idioma ni de cómo el
    // navegador normalice el atributo style.
    const panel = page.locator('[data-list]').first();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toContainText('RONDO 4V4 30X20');
  });

  test('sin el parámetro el panel no se abre', async ({ page }) => {
    await injectSession(page);
    const hits = await mockLibrary(page);
    await page.goto(LIB);
    await page.waitForSelector('#slMapDrillsBtn', { timeout: 15_000 });
    await page.waitForTimeout(2000);
    expect(hits.periodNames).toBe(0);
  });

  test('el parámetro se limpia de la URL para que no reabra al recargar', async ({ page }) => {
    await injectSession(page);
    const hits = await mockLibrary(page);
    await page.goto(`${LIB}?mapdrills=1`);
    await expect.poll(() => hits.periodNames, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(page.url()).not.toContain('mapdrills');
  });
});
