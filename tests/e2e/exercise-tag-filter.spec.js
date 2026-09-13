// @ts-check
import { test, expect } from '@playwright/test';
import { SB, injectSession, mockBase } from './_shared.js';

// Biblioteca de prueba: cada ejercicio etiquetado en distintos ejes para poder
// comprobar que se llega a ellos escribiendo la etiqueta, no solo el nombre.
const EJERCICIOS = [
  {
    id: 'ex-copen', club_id: 'club-1', name: 'Copenhagen plank', description: 'Plancha lateral',
    category: 'strength', complexity: 'Low', usable_in: ['gym'],
    primary_purpose: 'activation', purposes: ['activation'],
    muscle_groups: ['adductors'], muscle_group: 'Adductors',
    equipment_tags: ['bench'], movement_patterns: ['anti_lateral_flexion'],
    contraction_types: ['iso_hold'], planes: ['frontal'],
    myofascial_chains: [], movement_speeds: [], video_url: null, media_type: null, media_ref: null,
  },
  {
    id: 'ex-rdl', club_id: 'club-1', name: 'Romanian Deadlift', description: '',
    category: 'strength', complexity: 'Medium', usable_in: ['gym'],
    primary_purpose: 'strength', purposes: ['strength'],
    muscle_groups: ['hamstrings', 'glutes'], muscle_group: 'Hamstrings',
    equipment_tags: ['barbell'], movement_patterns: ['hinge'],
    myofascial_chains: ['superficial_back_line'], planes: ['sagittal'],
    contraction_types: [], movement_speeds: [], video_url: null, media_type: null, media_ref: null,
  },
  {
    id: 'ex-roll', club_id: 'club-1', name: 'Foam roll gemelos', description: '',
    category: 'strength', complexity: 'Low', usable_in: ['gym'],
    primary_purpose: 'release', purposes: ['release'],
    muscle_groups: ['calves'], muscle_group: 'Calves',
    equipment_tags: ['foam_roller'], myofascial_chains: ['superficial_back_line'],
    movement_patterns: [], contraction_types: [], movement_speeds: [], planes: [],
    video_url: null, media_type: null, media_ref: null,
  },
  {
    id: 'ex-band', club_id: 'club-1', name: 'Quad kicks', description: '',
    category: 'strength', complexity: 'Low', usable_in: ['gym'],
    primary_purpose: 'activation', purposes: ['activation'],
    muscle_groups: ['quadriceps'], muscle_group: 'Quadriceps',
    equipment_tags: ['band'], movement_patterns: [], contraction_types: [],
    myofascial_chains: [], movement_speeds: [], planes: [],
    video_url: null, media_type: null, media_ref: null,
  },
];

async function mockLibrary(page) {
  await mockBase(page);
  await page.route(`${SB}/rest/v1/gym_exercises**`, route =>
    route.fulfill({ json: EJERCICIOS }));
  await page.route(`${SB}/rest/v1/club_equipment**`, route => route.fulfill({ json: [] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Gym Library
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Gym Library · búsqueda y filtros por etiqueta', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockLibrary(page);
    await page.goto('/Gym%20Library.html');
    await expect(page.locator('.gl-card').first()).toBeVisible();
  });

  test('encuentra por etiqueta en español aunque no esté en el nombre', async ({ page }) => {
    // Ningún ejercicio se llama "isquios"; el RDL está etiquetado hamstrings.
    await page.fill('#gl-search-input', 'isquios');
    await expect(page.locator('#gl-visible')).toHaveText('1');
    await expect(page.locator('.gl-card')).toContainText('Romanian Deadlift');
  });

  test('sigue encontrando por nombre', async ({ page }) => {
    await page.fill('#gl-search-input', 'copenhagen');
    await expect(page.locator('#gl-visible')).toHaveText('1');
  });

  test('sugiere etiquetas mientras se escribe y las fija como chip', async ({ page }) => {
    await page.fill('#gl-search-input', 'aduc');
    const sug = page.locator('#gl-sug .gl-sugitem').first();
    await expect(sug).toBeVisible();
    await expect(sug).toContainText('1');            // el contador de la sugerencia
    await sug.click();
    await expect(page.locator('.gl-chip')).toHaveCount(1);
    await expect(page.locator('#gl-visible')).toHaveText('1');
    await expect(page.locator('#gl-search-input')).toHaveValue('');
  });

  test('los chips de una misma dimensión suman (OR)', async ({ page }) => {
    const purpose = page.locator('.gl-sel[data-dim="purpose"]');
    await purpose.selectOption('release');
    await expect(page.locator('#gl-visible')).toHaveText('1');
    await purpose.selectOption('strength');
    await expect(page.locator('#gl-visible')).toHaveText('2');
    await expect(page.locator('.gl-chip')).toHaveCount(2);
  });

  test('los chips de dimensiones distintas restringen (AND)', async ({ page }) => {
    await page.locator('.gl-sel[data-dim="purpose"]').selectOption('activation');
    await expect(page.locator('#gl-visible')).toHaveText('2');
    await page.locator('.gl-sel[data-dim="equipment"]').selectOption('band');
    await expect(page.locator('#gl-visible')).toHaveText('1');
  });

  test('las cadenas miofasciales son filtrables detrás de «Más filtros»', async ({ page }) => {
    await expect(page.locator('.gl-sel[data-dim="myofascial_chain"]')).toHaveCount(0);
    await page.locator('.gl-more').click();
    const chain = page.locator('.gl-sel[data-dim="myofascial_chain"]');
    await expect(chain).toBeVisible();
    await chain.selectOption('superficial_back_line');
    await expect(page.locator('#gl-visible')).toHaveText('2');
  });

  test('las opciones muestran cuántos ejercicios traen', async ({ page }) => {
    const opciones = await page.locator('.gl-sel[data-dim="purpose"] option').allTextContents();
    expect(opciones.some(o => /Activaci|Activation/.test(o) && o.includes('· 2'))).toBe(true);
  });

  test('el vacío dice qué lo causó y ofrece deshacerlo', async ({ page }) => {
    // Con un chip puesto, una búsqueda que no cruza deja la lista en cero.
    await page.locator('.gl-sel[data-dim="purpose"]').selectOption('release');
    await page.fill('#gl-search-input', 'barra');
    await expect(page.locator('#gl-visible')).toHaveText('0');
    await expect(page.locator('.gl-empty')).toBeVisible();
    await page.locator('.gl-undo').click();
    await expect(page.locator('#gl-visible')).toHaveText('1');
  });

  // Contar las opciones sobre el conjunto que cumple TODAS las demás dimensiones
  // tiene una consecuencia buena: desde los desplegables ya no se puede llegar a
  // una combinación vacía. Ninguna opción promete más de lo que entrega.
  test('ningún desplegable ofrece una opción que deje la lista vacía', async ({ page }) => {
    await page.locator('.gl-sel[data-dim="purpose"]').selectOption('activation');
    const equipo = page.locator('.gl-sel[data-dim="equipment"]');
    const valores = (await equipo.locator('option').all())
      .slice(1);   // la primera es el título de la dimensión
    expect(valores.length).toBeGreaterThan(0);
    for (const opt of valores) {
      const v = await opt.getAttribute('value');
      await equipo.selectOption(v);
      await expect(page.locator('#gl-visible')).not.toHaveText('0');
      await page.locator('.gl-chip').last().click();   // quita ese chip y sigue
    }
  });

  test('un chip se quita desde el propio chip', async ({ page }) => {
    await page.locator('.gl-sel[data-dim="purpose"]').selectOption('release');
    await expect(page.locator('#gl-visible')).toHaveText('1');
    await page.locator('.gl-chip').first().click();
    await expect(page.locator('.gl-chip')).toHaveCount(0);
    await expect(page.locator('#gl-visible')).toHaveText('4');
  });

  test('«Limpiar filtros» borra chips y búsqueda', async ({ page }) => {
    await page.fill('#gl-search-input', 'isquios');
    await page.locator('.gl-sel[data-dim="complexity"]').selectOption('Medium');
    await page.locator('.gl-count .clear').click();
    await expect(page.locator('.gl-chip')).toHaveCount(0);
    await expect(page.locator('#gl-search-input')).toHaveValue('');
    await expect(page.locator('#gl-visible')).toHaveText('4');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gym Planner · el selector de ejercicios
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Gym Planner · selector de ejercicios', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockLibrary(page);
    await page.addInitScript(() => {
      window._gpClubId = 'club-1';
      localStorage.removeItem('cm.gp.lib.recent');
      localStorage.removeItem('cm.gp.lib.filters');
    });
    await page.goto('/Gym%20Planner.html');
    await page.waitForFunction(() => typeof window.gpOpenLib === 'function');
  });

  const abrir = page => page.evaluate(() => window.gpOpenLib({ section: 'main' }));

  test('busca por etiqueta en español', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#gpLibOv')).toBeVisible();
    await page.fill('#gpLibSearch', 'isquios');
    await expect(page.locator('.gp-lib-item')).toHaveCount(1);
    await expect(page.locator('.gp-lib-item')).toContainText('Romanian Deadlift');
  });

  test('sugiere etiquetas y las fija como chip', async ({ page }) => {
    await abrir(page);
    await page.fill('#gpLibSearch', 'aduc');
    const sug = page.locator('#gpLibSug .gp-lib-sugitem').first();
    await expect(sug).toBeVisible();
    await sug.click();
    await expect(page.locator('.gp-lib-chip')).toHaveCount(1);
    await expect(page.locator('.gp-lib-item')).toHaveCount(1);
  });

  test('expone las cinco dimensiones que antes no se podían filtrar', async ({ page }) => {
    await abrir(page);
    await page.locator('.gp-lib-more').click();
    for (const dim of ['movement_pattern', 'myofascial_chain', 'contraction_type', 'plane']) {
      await expect(page.locator(`.gp-lib-sel[data-dim="${dim}"]`)).toHaveCount(1);
    }
  });

  test('filtra por cadena miofascial', async ({ page }) => {
    await abrir(page);
    await page.locator('.gp-lib-more').click();
    await page.locator('.gp-lib-sel[data-dim="myofascial_chain"]').selectOption('superficial_back_line');
    await expect(page.locator('.gp-lib-item')).toHaveCount(2);
  });

  test('recuerda los filtros de ese contexto al reabrir', async ({ page }) => {
    await abrir(page);
    await page.locator('.gp-lib-sel[data-dim="purpose"]').selectOption('release');
    await expect(page.locator('.gp-lib-item')).toHaveCount(1);
    await page.evaluate(() => window.gpCloseLib());
    await abrir(page);
    await expect(page.locator('.gp-lib-chip')).toHaveCount(1);
    await expect(page.locator('.gp-lib-item')).toHaveCount(1);
  });

  test('abre prefiltrado por el tipo de bloque del que se lo llama', async ({ page }) => {
    // Un bloque «Myofascial release» arranca el selector en la finalidad
    // Release en vez de en los 257 ejercicios del club.
    await page.evaluate(() => {
      const bl = window.gpAddWarmupBlock('myofascial');
      window.gpAddWarmupRow(bl.querySelector('tbody'));
      window.gpOpenLib({ input: bl.querySelector('tbody input') });
    });
    await expect(page.locator('.gp-lib-chip')).toHaveCount(1);
    await expect(page.locator('.gp-lib-chip')).toContainText('Release');
    await expect(page.locator('.gp-lib-item')).toHaveCount(1);
    await expect(page.locator('.gp-lib-item')).toContainText('Foam roll');
  });

  test('el prefiltro del bloque se puede quitar como cualquier otro', async ({ page }) => {
    await page.evaluate(() => {
      const bl = window.gpAddWarmupBlock('myofascial');
      window.gpAddWarmupRow(bl.querySelector('tbody'));
      window.gpOpenLib({ input: bl.querySelector('tbody input') });
    });
    await page.locator('.gp-lib-chip').click();
    await expect(page.locator('.gp-lib-item')).toHaveCount(4);
  });

  test('lo elegido hace poco encabeza la lista al reabrir', async ({ page }) => {
    await abrir(page);
    await page.locator('.gp-lib-item', { hasText: 'Romanian Deadlift' }).click();
    await abrir(page);
    await expect(page.locator('.gp-lib-sechead').first()).toHaveText(/Recent|Recientes/);
    await expect(page.locator('.gp-lib-item').first()).toContainText('Romanian Deadlift');
  });

  test('el vacío explica y deja deshacer', async ({ page }) => {
    await abrir(page);
    await page.locator('.gp-lib-sel[data-dim="purpose"]').selectOption('release');
    await page.fill('#gpLibSearch', 'barra');
    await expect(page.locator('.gp-lib-empty')).toBeVisible();
    await page.locator('.gp-lib-undo').click();
    await expect(page.locator('.gp-lib-item')).toHaveCount(1);
  });
});
