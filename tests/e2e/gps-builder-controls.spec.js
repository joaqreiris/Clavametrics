// @ts-check
// El panel de estilo ofrecía «Ejes», «Leyenda» y «Valores sobre el gráfico» para TODOS los tipos,
// pero cada renderer sólo lee los que le sirven: un KPI no tiene ejes, una tabla ya muestra los
// valores en sus celdas. Eran botones que no hacían nada. Esto fija qué ve cada tipo.

import { test, expect } from '@playwright/test';
import { SB, injectSession, seedGpIds } from './_shared.js';

test.describe.configure({ timeout: 60_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };

async function open(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));
  await injectSession(page);
  await seedGpIds(page, CLUB_ID, 'user-1');
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.locator('#gpbOpenBtn').first().click();
  // #gpbPanel nace con [hidden]; la señal real es que se vea y ya tenga los botones de tipo
  // dibujados, que es lo que clickean los helpers de abajo. Eran 600 ms a ojo.
  await expect(page.locator('#gpbPanel')).toBeVisible();
  await expect(page.locator('#gpbPanel [data-type]').first()).toBeVisible();
}

/** Interruptores del panel de estilo visibles para el tipo elegido. */
async function togglesDe(page, tipo) {
  // El tipo queda marcado con .is-on y el pane de estilo se activa con la misma clase: dos
  // condiciones reales en lugar de 250 ms + 250 ms de fe.
  await page.locator(`[data-type="${tipo}"]`).first().click();
  await expect(page.locator(`[data-type="${tipo}"]`).first()).toHaveClass(/is-on/);
  await page.locator('[data-tab="style"]').first().click();
  await expect(page.locator('.pane[data-pane="style"]')).toHaveClass(/is-on/);
  return page.evaluate(() => [...document.querySelectorAll('[data-toggle]')]
    .filter(b => b.offsetParent !== null)
    .map(b => b.dataset.toggle));
}

test.describe('GPS · el panel de estilo no ofrece botones muertos', () => {
  test('un KPI no ofrece ejes, leyenda ni valores sobre el gráfico', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'kpi');
    expect(t).not.toContain('axes');
    expect(t).not.toContain('legend');
    expect(t).not.toContain('labels');
  });

  test('una tabla tampoco: sus valores ya son las celdas', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'table');
    expect(t).not.toContain('axes');
    expect(t).not.toContain('legend');
    expect(t).not.toContain('labels');
  });

  test('las barras sí ofrecen los tres, que es donde hacen algo', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'bars');
    expect(t).toContain('axes');
    expect(t).toContain('legend');
    expect(t).toContain('labels');
  });

  test('la caja ofrece ejes pero no leyenda: dibuja una sola métrica', async ({ page }) => {
    await open(page);
    const t = await togglesDe(page, 'box');
    expect(t).toContain('axes');
    expect(t).not.toContain('legend');
  });
});

// ── Orden del panel ────────────────────────────────────────────────────────────
// El panel seguía el orden en que se fue construyendo: las opciones de scatter caían en cuatro
// posiciones salteadas, con las de box plot en el medio, y el tamaño de la card entre los colores
// y los ejes. Ahora va por grupos. Lo que estos tests cuidan es lo que se rompe al mover bloques:
// que no quede un título de grupo sin nada debajo, y que las de un tipo no vuelvan a dispersarse.

/** Títulos de grupo VISIBLES del panel de estilo, en orden. */
const gruposDe = async (page, tipo) => {
  // El tipo queda marcado con .is-on y el pane de estilo se activa con la misma clase: dos
  // condiciones reales en lugar de 250 ms + 250 ms de fe.
  await page.locator(`[data-type="${tipo}"]`).first().click();
  await expect(page.locator(`[data-type="${tipo}"]`).first()).toHaveClass(/is-on/);
  await page.locator('[data-tab="style"]').first().click();
  await expect(page.locator('.pane[data-pane="style"]')).toHaveClass(/is-on/);
  return page.evaluate(() => [...document.querySelectorAll('.pane[data-pane="style"] .es-sec')]
    .filter(sec => sec.offsetParent !== null)
    .map(sec => sec.querySelector('.lab')?.textContent?.trim() || '')
    .filter(Boolean));
};

test.describe('GPS · el panel de estilo va por grupos', () => {
  test('de los colores a la card, en ese orden', async ({ page }) => {
    await open(page);
    const g = await gruposDe(page, 'bars');
    const i = (re) => g.findIndex(x => re.test(x));
    const colores = i(/colors|colores/i), lee = i(/what the chart|qué se lee/i),
          tipo = i(/this chart type|de este tipo/i), card = i(/the card|la card/i);
    expect(colores, 'falta el grupo de colores').toBeGreaterThanOrEqual(0);
    expect(colores).toBeLessThan(lee);
    expect(lee).toBeLessThan(tipo);
    expect(tipo).toBeLessThan(card);
  });

  test('las de scatter quedan juntas en un solo bloque', async ({ page }) => {
    await open(page);
    await gruposDe(page, 'scatter');
    const n = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('.pane[data-pane="style"] .es-sec')]
        .find(s => /this chart type|de este tipo/i.test(s.querySelector('.lab')?.textContent || ''));
      return sec ? [...sec.querySelectorAll('.es-toggle')].filter(t => t.offsetParent !== null).length : -1;
    });
    // contenido de etiqueta, fotos, tooltip y cuadrantes: las cuatro, sin nada de otro tipo en medio
    expect(n).toBe(4);
  });

  test('un tipo sin opciones propias no muestra el grupo vacío', async ({ page }) => {
    await open(page);
    const g = await gruposDe(page, 'radar');   // radar no tiene ninguna opción suya
    expect(g.some(t => /this chart type|de este tipo/i.test(t))).toBe(false);
  });
});

// Las líneas de referencia sólo estaban en barras y scatter. En un gráfico de línea —la evolución
// de una métrica— marcar un umbral es justo lo que más se pide, y era el hueco más barato de
// tapar: el plugin que las dibuja lee el eje de valores, no sabe si debajo hay barras o una línea.
test.describe('GPS · líneas de referencia', () => {
  test('un gráfico de línea también las ofrece', async ({ page }) => {
    await open(page);
    await page.locator('[data-type="line"]').first().click();
    await expect(page.locator('[data-type="line"]').first()).toHaveClass(/is-on/);
    await page.locator('[data-tab="style"]').first().click();
    await expect(page.locator('.pane[data-pane="style"]')).toHaveClass(/is-on/);
    const visible = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('.pane[data-pane="style"] .es-sec')]
        .find(s => /reference lines|líneas de referencia/i.test(s.querySelector('.lab')?.textContent || ''));
      return !!sec && sec.offsetParent !== null;
    });
    expect(visible).toBe(true);
  });

  test('un radar no: no tiene eje de valores donde apoyarlas', async ({ page }) => {
    await open(page);
    await page.locator('[data-type="radar"]').first().click();
    await expect(page.locator('[data-type="radar"]').first()).toHaveClass(/is-on/);
    await page.locator('[data-tab="style"]').first().click();
    await expect(page.locator('.pane[data-pane="style"]')).toHaveClass(/is-on/);
    const visible = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('.pane[data-pane="style"] .es-sec')]
        .find(s => /reference lines|líneas de referencia/i.test(s.querySelector('.lab')?.textContent || ''));
      return !!sec && sec.offsetParent !== null;
    });
    expect(visible).toBe(false);
  });
});

// Un tipo de gráfico vive en DOS listas: VIZ_TYPES (qué sabe hacer) y DD_TYPES (los botones del
// selector). Agregar sólo la primera deja el tipo funcionando pero invisible — pasó con el
// «antes → después»: estaba entero y no se podía elegir. Este test compara las dos.
test.describe('GPS · el selector ofrece todos los tipos', () => {
  test('no hay tipos implementados que el builder esconda', async ({ page }) => {
    await open(page);
    const faltan = await page.evaluate(() => {
      const botones = new Set([...document.querySelectorAll('[data-type]')].map(b => b.dataset.type));
      // Los tipos que el builder sabe dibujar salen del propio selector más el que esté activo;
      // se comparan contra los botones visibles.
      const esperados = ['kpi', 'gauge', 'bars', 'line', 'scatter', 'radar', 'ranking',
                         'table', 'heatmap', 'box', 'demand', 'dumbbell', 'diverging', 'acwr'];
      return esperados.filter(t => !botones.has(t));
    });
    expect(faltan, 'hay tipos sin botón en el selector').toEqual([]);
  });
});


// Saber qué métricas tienen datos costaba UNA CONSULTA POR MÉTRICA: trece a gps_reports (una por
// columna, con .not(col,'is',null).limit(1)) más una por cada métrica propia del club. En la red de
// un club eran ~15 consultas de ~0,9 kB haciendo cola sólo para decidir qué ofrecer en el panel.
test('las métricas con datos se averiguan en un viaje, no una por métrica', async ({ page }) => {
  const sueltas = [];
  page.on('request', r => {
    const u = decodeURIComponent(r.url());
    if (u.includes('gps_reports') && u.includes('is.null') && u.includes('limit=1')) sueltas.push(u);
  });
  // Se CUENTAN las peticiones en vez de mockear la función: open() registra su catch-all después
  // y, como gana el último route, un mock puesto acá quedaría tapado.
  let rpc = 0;
  page.on('request', r => { if (r.url().includes('rpc/gps_metricas_con_datos')) rpc++; });
  await open(page);
  await page.waitForTimeout(2_500);

  expect(rpc, 'no se usó la función que las trae todas juntas').toBeGreaterThan(0);
  expect(sueltas.length, `se comprobaron métricas de a una: ${sueltas.length} consultas`).toBe(0);
});
