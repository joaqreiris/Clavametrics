// @ts-check
// Cards de EJERCICIOS (source='task'): leen v_gps_task_analysis, una fila por período×jugador
// mapeado a un drill. Es el único camino del builder que no toca gps_reports, y hasta ahora no
// lo cubría ningún test — el dashboard "DRILL ANALYSIS" aparecía vacío y no había forma de ver
// por qué. Se monta en un dashboard CUSTOM (report_type null), que es donde viven estas cards.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: '22222222-2222-4222-8222-222222222222', club_id: CLUB_ID, report_type: null, name: 'DRILL ANALYSIS', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const SESSIONS = [
  { id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: null, is_historical: false },
  { id: 's-b', club_id: CLUB_ID, session_date: daysAgo(6), session_type: 'training', team_id: null, microcycle_id: null, is_historical: false },
];
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Lucas', last_name: 'García', number: 10, position: 'FW', positions: ['FW'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Marco', last_name: 'Rossi',  number: 6,  position: 'MF', positions: ['MF'], status: 'active' },
];

// Dos ejercicios × dos tamaños de campo, para que la tabla tenga más de una fila por dimensión.
const TASKS = [];
[['Rondo', 'Small', '4v4'], ['Partido reducido', 'Medium', '7v7']].forEach(([drill, size, fmt], i) => {
  SESSIONS.forEach((s, si) => {
    PLAYERS.forEach((p, pi) => {
      TASKS.push({
        id: `t${i}${si}${pi}`, club_id: CLUB_ID, session_id: s.id, session_date: s.session_date,
        team_id: null, exercise_id: `ex${i}`, exercise_name: drill, field_size: size, players_format: fmt,
        field_width: 30, field_height: 20, players_count: 8, m2_per_player: 75,
        player_id: p.id, player_name: `${p.first_name} ${p.last_name}`, position: p.position, number: p.number,
        duration_seconds: i === 0 ? 300 : 1200, work_min: i === 0 ? 5 : 20,
        total_distance: 1000 + i * 100 + pi * 10, high_speed_distance: 100 + i * 10,
        very_high_speed_distance: 40, sprint_distance: 20, sprint_count: 2,
        accelerations: 12, decelerations: 10, player_load: 90, hmld: 150,
        max_speed: 28, avg_speed: 6, distance_per_minute: 100,
        total_distance_per_min: 100, high_speed_distance_per_min: 10,
        very_high_speed_distance_per_min: 4, sprint_distance_per_min: 2,
        player_load_per_min: 9, accelerations_per_min: 1.2, decelerations_per_min: 1,
        hmld_per_min: 15,
      });
    });
  });
});

const CARD = [{ id: 'card-task', position: 0, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Total Distance por ejercicio', viz: 'table', source: 'task',
  scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
  metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' },
            { id: 'high_speed_distance', agg: 'total', kind: 'accum', unit: 'm' }],
  dimensions: [{ id: 'drill' }, { id: 'field_size' }],
  style: { color: '#15803D', size: 'md', span: 12 },
} }];

async function openTask(page, cards = CARD) {
  const seen = [];
  await page.route(`${SB}/rest/v1/**`, r => { seen.push(r.request().url()); return r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }); });
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'high_speed_distance', label: 'High Speed Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/v_gps_task_analysis**`, r => r.fulfill({ json: TASKS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: cards }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  return { seen };
}

test.describe('GPS · cards de ejercicios (source=task)', () => {
  test.describe.configure({ timeout: 60_000 });

  test('el dashboard custom monta la card y la tabla trae los drills', async ({ page }) => {
    await openTask(page);
    // 1) la pestaña custom existe y se puede abrir
    const tab = page.locator('.gp-sec[data-custom]');
    await expect(tab).toHaveCount(1);
    await tab.click();
    // 2) la card se monta
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-task"]')).toHaveCount(1, { timeout: 15_000 });
    // 3) y termina de resolver: sale del estado "Loading…"
    await expect.poll(async () => page.evaluate(() => {
      const el = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-task"] .gp-c-b');
      return el ? el.innerHTML.slice(0, 400) : 'SIN CARD';
    }), { timeout: 30_000 }).not.toContain('cb2-spin');
    // 4) la tabla tiene una fila por ejercicio
    const txt = await page.locator('.gp-view.is-on .gp-c[data-card-id="card-task"] .gp-c-b').innerText();
    expect(txt).toContain('Rondo');
    expect(txt).toContain('Partido reducido');
  });

  // Las dos cards REALES del dashboard "DRILL ANALYSIS": rango de temporada y, en la primera,
  // una colocación guardada (style.canvas). Es la combinación que el usuario ve vacía.
  test('dos cards con rango de temporada y colocación guardada', async ({ page }) => {
    const cards = [
      { id: 'card-a', position: 0, source: 'builder', size: 'md', config: {
        schema: 'gp.card/v1', title: 'Total Distance +2', viz: 'table', source: 'task',
        scope: { level: 'squad' }, range: { type: 'season' }, comparison: null,
        metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' }],
        dimensions: [{ id: 'drill' }, { id: 'field_size' }],
        style: { color: '#15803D', size: 'md', span: 12, canvas: { x: 0, y: 0, w: 12, h: 11, size: 'md' } } } },
      { id: 'card-b', position: 1, source: 'builder', size: 'md', config: {
        schema: 'gp.card/v1', title: 'Total Distance +5', viz: 'table', source: 'task',
        scope: { level: 'squad' }, range: { type: 'season' }, comparison: null,
        metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' }],
        dimensions: [{ id: 'drill' }, { id: 'field_size' }, { id: 'players_format' }],
        style: { color: '#15803D', size: 'md' } } },
    ];
    await openTask(page, cards);
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id]')).toHaveCount(2, { timeout: 15_000 });
    // Ambas tienen que quedar VISIBLES (no basta con estar en el DOM: la colocación libre las
    // puede dejar con altura 0 o fuera del lienzo).
    await page.waitForTimeout(1500);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id]')]
      .map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.cardId, w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top), ds: { x: el.dataset.x, y: el.dataset.y, w: el.dataset.w, h: el.dataset.h }, pos: getComputedStyle(el).position }; }));
    for (const b of boxes) { expect(b.w).toBeGreaterThan(50); expect(b.h).toBeGreaterThan(50); }
    for (const id of ['card-a', 'card-b']) {
      await expect.poll(async () => page.evaluate((cid) => {
        const el = document.querySelector(`.gp-view.is-on .gp-c[data-card-id="${cid}"] .gp-c-b`);
        return el ? el.innerHTML : 'SIN CARD';
      }, id), { timeout: 30_000 }).not.toContain('cb2-spin');
      const txt = await page.locator(`.gp-view.is-on .gp-c[data-card-id="${id}"] .gp-c-b`).innerText();
      expect(txt).toContain('Rondo');
    }
  });

  // El caso que dejaba el dashboard "vacío": estando parado en una pestaña custom, cualquier
  // reconstrucción de las pestañas (renombrar, crear otra, cambiar con quién se comparte) borraba
  // la vista y la volvía a crear SIN marcarla como activa → barra de filtros arriba y nada debajo.
  test('renombrar el dashboard abierto no deja la página en blanco', async ({ page }) => {
    await openTask(page);
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-task"]')).toHaveCount(1, { timeout: 15_000 });

    await page.locator('.gp-sec[data-custom] .gpt-kb').click();
    await page.locator('[data-act="rename"]').click();
    await page.locator('input.gpt-rename').fill('DRILLS');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(600);
    // Sigue habiendo una vista activa, y es la del dashboard renombrado, con su card.
    await expect(page.locator('.gp-view.is-on')).toHaveCount(1);
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-task"]')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.gp-sec[data-custom].is-on')).toHaveCount(1);
  });

  // La LÍNEA agrupa por tiempo, y el rótulo del eje leía la fecha sólo de la forma anidada
  // (join a training_sessions). Las filas de ejercicios la traen plana: sin esto, todas las
  // tareas caían en un único punto llamado «?».
  test('la línea reparte las tareas por fecha, no en un único punto', async ({ page }) => {
    const cards = [{ id: 'card-line', position: 0, source: 'builder', size: 'md', config: {
      schema: 'gp.card/v1', title: 'Distancia por día', viz: 'line', source: 'task',
      scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
      metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' }],
      dimensions: [], style: { color: '#15803D' } } }];
    await openTask(page, cards);
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-line"] canvas')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(600);
    const labels = await page.evaluate(() => {
      const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-line"] canvas');
      return window.Chart.getChart(cv).data.labels;
    });
    // Dos sesiones en el fixture ⇒ dos puntos con su fecha.
    expect(labels).toHaveLength(2);
    expect(labels.every(l => /^\d{4}-\d{2}-\d{2}$/.test(String(l)))).toBe(true);
  });

  // El scatter siempre dibujaba UN PUNTO POR JUGADOR y usaba la dimensión sólo como color. Con
  // ejercicios eso no dice nada: cada jugador hace varios drills, así que el color salía del
  // primero que apareciera y no había forma de comparar ejercicios entre sí — que es justamente
  // para lo que se abre un scatter en un dashboard de drills.
  test('el scatter de ejercicios dibuja un punto por ejercicio', async ({ page }) => {
    const cards = [{ id: 'card-sc', position: 0, source: 'builder', size: 'lg', config: {
      schema: 'gp.card/v1', title: 'HMLD vs intensidad', viz: 'scatter', source: 'task',
      scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
      metrics: [{ id: 'total_distance', agg: 'avg', kind: 'accum', unit: 'm' },
                { id: 'high_speed_distance', agg: 'avg', kind: 'accum', unit: 'm' }],
      dimensions: [{ id: 'drill' }], style: { color: '#15803D' } } }];
    await openTask(page, cards);
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-sc"] canvas')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(600);
    const pts = await page.evaluate(() => {
      const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-sc"] canvas');
      const ch = window.Chart.getChart(cv);
      return ch.data.datasets.flatMap(d => (d.data || []).map(p => p.label || p.name || ''));
    });
    // Dos ejercicios en el fixture ⇒ dos puntos, con el nombre del ejercicio.
    expect(pts).toHaveLength(2);
    expect(pts.sort()).toEqual(['Partido reducido', 'Rondo']);
  });

  // Barrido: con fuente «tarea», ¿qué tipos dibujan algo con sentido y cuáles se quedan mudos?
  // Cada uno con la forma que le corresponde (el radar necesita 3 métricas, la caja una).
  const M = (id, agg = 'avg') => ({ id, agg, kind: 'accum', unit: 'm' });
  const TIPOS = [
    { viz: 'kpi',     metrics: [M('total_distance')],                                   dims: [] },
    { viz: 'gauge',   metrics: [M('total_distance')],                                   dims: [] },
    { viz: 'box',     metrics: [M('total_distance')],                                   dims: [{ id: 'drill' }] },
    { viz: 'radar',   metrics: [M('total_distance'), M('high_speed_distance'), M('sprint_distance')], dims: [] },
    { viz: 'heatmap', metrics: [M('total_distance')],                                   dims: [{ id: 'drill' }] },
    { viz: 'ranking', metrics: [M('total_distance')],                                   dims: [{ id: 'drill' }] },
  ];
  for (const t of TIPOS) {
    test(`«${t.viz}» con ejercicios dibuja algo, no un cartel vacío`, async ({ page }) => {
      const cards = [{ id: 'card-x', position: 0, source: 'builder', size: 'lg', config: {
        schema: 'gp.card/v1', title: t.viz, viz: t.viz, source: 'task',
        scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
        metrics: t.metrics, dimensions: t.dims, style: { color: '#15803D' } } }];
      await openTask(page, cards);
      await page.locator('.gp-sec[data-custom]').click();
      const body = page.locator('.gp-view.is-on .gp-c[data-card-id="card-x"] .gp-c-b');
      await expect(body).toHaveCount(1, { timeout: 20_000 });
      await expect.poll(async () => body.innerHTML(), { timeout: 25_000 }).not.toContain('cb2-spin');
      const html = await body.innerHTML();
      // Ni «sin datos» ni cuerpo vacío: o hay canvas (gráfico) o hay números en el DOM.
      expect(html).not.toMatch(/No GPS data|No rows match|no hay datos/i);
      const pinta = await page.evaluate(() => {
        const b = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-x"] .gp-c-b');
        return !!b.querySelector('canvas') || /\d/.test(b.innerText || '');
      });
      expect(pinta).toBe(true);
    });
  }
});

test.describe('GPS · card en borrador del chart builder', () => {
  test.describe.configure({ timeout: 60_000 });

  // Al abrir el chart builder sobre un dashboard que ya tiene cards, el borrador nacía del
  // tamaño MÍNIMO (2×3): un cuadradito encima de la tabla, con el título cortado y el texto de
  // ayuda desbordado. Y el toggle S/M/L/FULL no lo agrandaba.
  test('el borrador nace con el tamaño de su tipo, no con el mínimo', async ({ page }) => {
    await openTask(page);
    await page.locator('.gp-sec[data-custom]').click();
    await page.locator('#gpbOpenBtn').first().click();
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => {
      const el = document.querySelector('.gp-view.is-on .gp-c.is-draft');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: +el.dataset.w, h: +el.dataset.h, px: Math.round(r.width), py: Math.round(r.height) };
    });
    expect(d).not.toBeNull();
    // 'md' = 6 columnas × 7 filas. Con el mínimo daría 2×3.
    expect(d.w).toBeGreaterThanOrEqual(6);
    expect(d.h).toBeGreaterThanOrEqual(7);
    expect(d.px).toBeGreaterThan(300);
  });

  // El caso real: se abre el builder y se ELIGE scatter. Ahí el borrador se quedaba diminuto y
  // encima de la card que ya estaba, con el texto de ayuda desbordado.
  test('al elegir scatter, el borrador conserva su tamaño y no pisa a la card de al lado', async ({ page }) => {
    await openTask(page);
    await page.locator('.gp-sec[data-custom]').click();
    await page.locator('#gpbOpenBtn').first().click();
    await page.waitForTimeout(800);
    await page.locator('[data-type="scatter"]').first().click();
    await page.waitForTimeout(1000);
    const d = await page.evaluate(() => {
      const el = document.querySelector('.gp-view.is-on .gp-c.is-draft');
      const otras = [...document.querySelectorAll('.gp-view.is-on .gp-c:not(.is-draft)')];
      const box = e => ({ x: +e.dataset.x, y: +e.dataset.y, w: +e.dataset.w, h: +e.dataset.h });
      const b = box(el);
      const pisa = otras.map(box).some(o =>
        b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
      const r = el.getBoundingClientRect();
      return { ...b, px: Math.round(r.width), py: Math.round(r.height), pisa };
    });
    expect(d.w).toBeGreaterThanOrEqual(6);
    expect(d.h).toBeGreaterThanOrEqual(7);
    expect(d.px).toBeGreaterThan(300);
    expect(d.pisa).toBe(false);
  });

  // El caso REAL: el dashboard ya tiene una card con su sitio guardado (una tabla de 12×11).
  // El borrador nace sin coordenadas y tiene que buscarse un hueco — si en cambio nace ENCIMA,
  // el motor de colisiones lo aplasta al mínimo (2×3) y sale el cuadradito.
  test('con una card ya colocada, el borrador no nace encima ni aplastado', async ({ page }) => {
    const cards = [{ id: 'card-big', position: 0, source: 'builder', size: 'md', config: {
      schema: 'gp.card/v1', title: 'Work time +6', viz: 'table', source: 'task',
      scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
      metrics: [{ id: 'total_distance', agg: 'total', kind: 'accum', unit: 'm' }],
      dimensions: [{ id: 'drill' }],
      style: { color: '#15803D', size: 'md', span: 12, canvas: { x: 0, y: 0, w: 12, h: 11, size: 'md' } } } }];
    await openTask(page, cards);
    await page.locator('.gp-sec[data-custom]').click();
    await page.waitForTimeout(1200);            // deja que el lienzo coloque la card guardada
    await page.locator('#gpbOpenBtn').first().click();
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => {
      const el = document.querySelector('.gp-view.is-on .gp-c.is-draft');
      const otras = [...document.querySelectorAll('.gp-view.is-on .gp-c:not(.is-draft)')];
      const box = e => ({ x: +e.dataset.x, y: +e.dataset.y, w: +e.dataset.w, h: +e.dataset.h });
      const b = box(el);
      const pisa = otras.map(box).some(o =>
        b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
      const r = el.getBoundingClientRect();
      // La card que YA estaba no se puede haber movido de su sitio guardado.
      const guardada = otras.length ? box(otras[0]) : null;
      return { ...b, px: Math.round(r.width), py: Math.round(r.height), pisa, guardada };
    });
    expect(d.w).toBeGreaterThanOrEqual(6);
    expect(d.h).toBeGreaterThanOrEqual(7);
    expect(d.pisa).toBe(false);
    // Y la card guardada sigue donde estaba: abrir el builder no puede reacomodar el dashboard.
    expect(d.guardada).toEqual({ x: 0, y: 0, w: 12, h: 11 });
  });
});

test.describe('GPS · comparar ejercicios de distinta duración', () => {
  test.describe.configure({ timeout: 60_000 });

  // Comparar drills por un ACUMULADO cuando uno dura 5 minutos y otro 20 mide sobre todo cuánto
  // duró cada uno. La card lo avisa con los minutos reales en vez de dejar que se descubra.
  const cardCon = (metrics) => ([{ id: 'card-dur', position: 0, source: 'builder', size: 'lg', config: {
    schema: 'gp.card/v1', title: 'Demanda por ejercicio', viz: 'bars', source: 'task',
    scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
    metrics, dimensions: [{ id: 'drill' }], style: { color: '#15803D' } } }]);

  const aviso = (page) => page.locator('.gp-view.is-on .gp-c[data-card-id="card-dur"] .gp-task-dur-note');

  test('avisa cuando las tareas duran cosas muy distintas', async ({ page }) => {
    await openTask(page, cardCon([{ id: 'very_high_speed_distance', agg: 'total', kind: 'accum', unit: 'm' }]));
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-dur"] canvas')).toHaveCount(1, { timeout: 20_000 });
    await expect(aviso(page)).toHaveCount(1, { timeout: 10_000 });
    await expect(aviso(page)).toContainText(/5/);
    await expect(aviso(page)).toContainText(/20/);
  });

  test('con métricas POR MINUTO no molesta: ya están normalizadas', async ({ page }) => {
    await openTask(page, cardCon([{ id: 'very_high_speed_distance_per_min', agg: 'avg', kind: 'avg', unit: 'm/min' }]));
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-dur"] canvas')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(800);
    await expect(aviso(page)).toHaveCount(0);
  });
});

test.describe('GPS · carga mecánica por minuto', () => {
  test.describe.configure({ timeout: 60_000 });

  // accelerations_per_min y decelerations_per_min existían pero estaban escondidas, y su suma
  // (Acc+Dec / min) no existía: la carga mecánica era la única familia que no se podía mirar
  // normalizada por duración, que es justo donde más engaña el acumulado.
  test('Acc+Dec / min suma las dos columnas por minuto', async ({ page }) => {
    const cards = [{ id: 'card-ad', position: 0, source: 'builder', size: 'lg', config: {
      schema: 'gp.card/v1', title: 'Carga mecánica', viz: 'bars', source: 'task',
      scope: { level: 'squad' }, range: { type: 'last30' }, comparison: null,
      metrics: [{ id: 'acc_dec_per_min', agg: 'avg', kind: 'avg', unit: '/min' }],
      dimensions: [{ id: 'drill' }], style: { color: '#15803D' } } }];
    await openTask(page, cards);
    await page.locator('.gp-sec[data-custom]').click();
    await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="card-ad"] canvas')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(700);
    const vals = await page.evaluate(() => {
      const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-ad"] canvas');
      const ch = window.Chart.getChart(cv);
      return ch.data.datasets[0].data.map(Number);
    });
    // El fixture da 1.2 accel/min + 1 decel/min en cada fila ⇒ 2.2 por ejercicio.
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach(v => expect(v).toBeCloseTo(2.2, 5));
  });
});
