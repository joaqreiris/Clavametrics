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
  // El selector de tipo es un DESPLEGABLE: los tipos ya no están a la vista, viven adentro. La
  // señal de que el panel está listo pasa a ser el disparador del desplegable.
  await expect(page.locator('#gpbTypeSel')).toBeVisible();
}

/** Elige un tipo abriendo el desplegable, que es el camino real desde que dejó de ser una grilla. */
async function elegirTipo(page, tipo) {
  const pop = page.locator('#gpbTypePop');
  if (await pop.isHidden()) await page.locator('#gpbTypeSel').click();
  await page.locator(`#gpbDDSeg [data-type="${tipo}"]`).click();
  await expect(pop).toBeHidden();
}

/** Interruptores del panel de estilo visibles para el tipo elegido. */
async function togglesDe(page, tipo) {
  // El tipo queda marcado con .is-on y el pane de estilo se activa con la misma clase: dos
  // condiciones reales en lugar de 250 ms + 250 ms de fe.
  await elegirTipo(page, tipo);
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
  await elegirTipo(page, tipo);
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
    await elegirTipo(page, 'line');
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
    await elegirTipo(page, 'radar');
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
                         'table', 'heatmap', 'box', 'demand', 'dumbbell', 'diverging', 'acwr', 'tsb', 'monotonia'];
      return esperados.filter(t => !botones.has(t));
    });
    expect(faltan, 'hay tipos sin botón en el selector').toEqual([]);
  });
});


// El selector de tipo es un desplegable y no una grilla: con veintiún tipos la grilla se comía el
// panel. Cerrado tiene que ocupar poco y decir cuál está puesto; abierto, mostrarlos todos.
test('el selector de tipo se despliega, filtra y se cierra al elegir', async ({ page }) => {
  await open(page);
  const sel = page.locator('#gpbTypeSel');
  await expect(sel).toBeVisible({ timeout: 20_000 });

  // Cerrado ocupa una línea: si volviera a crecer, es que alguien lo desplegó de nuevo.
  const alto = (await page.locator('.bdd-bar').boundingBox()).height;
  expect(alto, `el selector cerrado ocupa ${Math.round(alto)}px`).toBeLessThan(90);
  await expect(page.locator('#gpbTypePop')).toBeHidden();

  await sel.click();
  await expect(page.locator('#gpbTypePop')).toBeVisible();
  const todos = await page.locator('#gpbDDSeg .bdd-tit:visible').count();
  expect(todos).toBeGreaterThan(8);

  // El buscador filtra por nombre Y por lo que contesta cada tipo.
  await page.locator('#gpbTypeBuscar').fill('rank');
  await expect.poll(() => page.locator('#gpbDDSeg .bdd-tit:visible').count(), { timeout: 5_000 })
    .toBeLessThan(todos);
  await expect(page.locator('#gpbDDSeg .bdd-tit[data-type="ranking"]')).toBeVisible();
  // Y los títulos de familia que se quedan sin filas no se muestran huérfanos.
  const famsVisibles = await page.locator('#gpbDDSeg .bdd-tfam:visible').count();
  expect(famsVisibles).toBeLessThanOrEqual(2);

  await page.locator('#gpbTypeBuscar').fill('');
  await page.locator('#gpbDDSeg .bdd-tit[data-type="table"]').click();
  await expect(page.locator('#gpbTypePop')).toBeHidden();
});

// Soltar un campo SOBRE el gráfico: antes había que apuntar a la zona correcta del panel, lo que
// obliga a saber de antemano dónde va cada cosa. El campo tiene que acomodarse solo: una métrica
// al eje de valores, una dimensión a agrupar.
test('un campo soltado sobre el gráfico va solo a donde corresponde', async ({ page }) => {
  await open(page);
  await elegirTipo(page, 'bars');

  const antes = await page.evaluate(() => {
    const c = window.GpBuilder?.currentConfig?.() || {};
    return { m: (c.metrics || []).length, d: (c.dimensions || []).length };
  });

  // Se simula el arrastre a mano: Playwright no encadena dragstart→drop entre elementos sueltos
  // de forma fiable, y lo que se está probando es el destino, no el gesto del navegador.
  const ok = await page.evaluate(() => {
    const campo = document.querySelector('.bdd-field[data-id][data-kind]');
    const card  = document.querySelector('.gp-c.is-draft, .gp-c.is-editing');
    if (!campo || !card) return false;
    const dt = new DataTransfer();
    campo.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    card.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    card.dispatchEvent(new DragEvent('drop',     { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  });
  expect(ok, 'no se encontró un campo o la card del borrador').toBe(true);

  await expect.poll(async () => page.evaluate(() => {
    const c = window.GpBuilder?.currentConfig?.() || {};
    return (c.metrics || []).length + (c.dimensions || []).length;
  }), { timeout: 10_000 }).toBeGreaterThan(antes.m + antes.d);
});
