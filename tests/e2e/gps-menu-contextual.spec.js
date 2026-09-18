// @ts-check
// RED DE SEGURIDAD de las cards "científicas" del dashboard clásico (ACWR, Fitness/Fatiga/Forma,
// × match avg). No tenían NI UN test, y todas dependen del mismo bloque de datos históricos:
// una consulta a training_sessions de los últimos 84 días y otra a gps_reports de esas sesiones.
//
// Cualquier trabajo que difiera, reordene o condicione ese bloque (por ejemplo, no pedirlo hasta
// que la card esté a la vista) puede dejarlas mudas para siempre sin que nada avise. Estos tests
// son esa alarma: se scrollea hasta la card y se exige que termine dibujando.

import { test, expect } from '@playwright/test';
import { SB, injectSession, seedGpIds } from './_shared.js';

test.describe.configure({ timeout: 120_000 });

// Card del builder con el tipo ACWR. El cálculo lo hace window.gpsACWR (el mismo motor que usaba
// la card fija); acá sólo se comprueba que la card exista, dibuje y no arrastre el fetch del
// período, que para este tipo no lo mira nadie.
const CARD_ACWR = { id: 'c-acwr', position: 0, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Barras', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [{ id: 'player' }],
  range: { type: 'last30' }, style: { color: '#2563EB' } } };
const _NO_USADA_TSB = { id: 'c-tsb', position: 1, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Forma', viz: 'tsb', scope: { level: 'squad' },
  metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: {} } };
const _NO_USADA_MONO = { id: 'c-mono', position: 2, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Monotonía', viz: 'monotonia', scope: { level: 'squad' },
  metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: {} } };

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };

// 40 sesiones repartidas en los últimos 80 días: el ACWR necesita historia (agudo 7d vs crónico 28d).
const SES = Array.from({ length: 40 }, (_, i) => ({
  id: 's' + i, club_id: CLUB_ID, session_date: d(i * 2), session_type: i % 7 === 0 ? 'match' : 'training',
  team_id: null, microcycle_id: 'mc-' + Math.floor(i / 4), is_historical: false, match_day_offset: -3, notes: null,
}));
const PL = Array.from({ length: 6 }, (_, i) => ({
  id: `0000000${i}-1111-4111-8111-111111111111`, club_id: CLUB_ID, first_name: 'N' + i, last_name: 'Ape' + i,
  number: i + 1, position: 'CB', positions: ['CB'], status: 'active',
}));
const REP = SES.flatMap(s => PL.map(p => ({
  id: `r-${s.id}-${p.id}`, player_id: p.id, session_id: s.id, club_id: CLUB_ID, is_invalid: false,
  work_context: 'team', total_distance: 5000, high_speed_distance: 300, very_high_speed_distance: 100,
  sprint_distance: 40, sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
  player_load: 250 + (s.id.length * 7), hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: 'CB', positions: ['CB'] },
  training_sessions: { session_date: s.session_date, session_attributes: null, microcycle_id: s.microcycle_id,
    team_id: null, session_type: s.session_type, match_day_offset: -3, season_id: null },
})));

// Microciclos: la vista Microcycle Compare necesita AL MENOS DOS con el MD elegido para llegar a
// pedir sus datos. Sin ellos sale antes y un test sobre esa consulta no prueba nada.
const MCS = Array.from({ length: 10 }, (_, i) => ({
  id: 'mc-' + i, club_id: CLUB_ID, name: 'MC 0' + i,
  start_date: d(i * 8 + 7), end_date: d(i * 8), match_date: d(i * 8),
  rival: 'Rival ' + i, home_away: 'home',
}));

/** Monta el dashboard y devuelve un contador de consultas por etiqueta de cmFetchAll. */
async function montar(page, layoutInd, layoutGrp) {
  const pedidos = [];
  page.on('request', r => { const u = r.url(); if (u.includes('/rest/v1/')) pedidos.push(u); });

  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  const uno = (obj) => (r) => r.fulfill({ json: (r.request().headers()['accept'] || '').includes('object') ? obj : [obj] });
  await page.route(`${SB}/rest/v1/profiles**`, uno(PROFILE));
  await page.route(`${SB}/rest/v1/clubs**`, uno(CLUB));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 3, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'player_load', label: 'Player Load', unit: 'au', kind: 'accum', category: 'load', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = (r.request().headers()['accept'] || '').includes('object');
    const ord = [...SES].sort((a, b) => b.session_date.localeCompare(a.session_date));
    return r.fulfill({ json: acc ? ord[0] : SES });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PL }));
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [CARD_ACWR] }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = (r.request().headers()['accept'] || '').includes('object');
    const D = { id: 'd-ind', club_id: CLUB_ID, report_type: 'ind', name: 'Player Week', scope: 'squad', is_shared: true, created_by: null };
    return r.fulfill({ json: acc ? D : [D] });
  });
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    const sp = new URL(r.request().url()).searchParams;
    const off = +(sp.get('offset') || 0);
    const lim = +(sp.get('limit') || REP.length);
    const trozo = REP.slice(off, off + lim);
    return r.fulfill({ json: trozo, headers: {
      'Content-Range': `${off}-${off + trozo.length - 1}/${REP.length}`,
      'Content-Type': 'application/json',
      'Access-Control-Expose-Headers': 'Content-Range, content-range' } });
  });

  // Layout YA guardado con estas cards. Sin él la página cree que es la primera carga y, como el
  // set de defaults de la vista está vacío, RETIRA todas las cards clásicas del grid: el test no
  // encontraría ninguna y el fallo no diría nada sobre el dibujo.
  await page.route(`${SB}/rest/v1/gps_dashboard_layouts**`, r => {
    const req = r.request();
    const acc = (req.headers()['accept'] || '').includes('object');
    if (req.method() !== 'GET') return r.fulfill({ json: acc ? {} : [{}] });
    const did = (new URL(req.url()).searchParams.get('dashboard_id') || '').replace('eq.', '');
    if (did === 'session_control' && layoutGrp) {
      const f = { user_id: 'user-1', club_id: CLUB_ID, dashboard_id: did, layout: layoutGrp };
      return r.fulfill({ json: acc ? f : [f] });
    }
    if (did !== 'player_week') return r.fulfill({ json: acc ? null : [] });
    const fila = { user_id: 'user-1', club_id: CLUB_ID, dashboard_id: did, layout: layoutInd || [
      { card_id: 'acwr', size: 'md', config: {}, x: 0, y: 60, w: 6, h: 7 },
      { card_id: 'tsb',  size: 'md', config: {}, x: 6, y: 60, w: 6, h: 7 },
    ] };
    return r.fulfill({ json: acc ? fila : [fila] });
  });

  await injectSession(page);
  await seedGpIds(page, CLUB_ID, 'user-1');
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 20_000 });
  return { pedidos };
}



/** Abre el menú con click derecho sobre un punto de la pantalla. */
async function ctxSobre(page, loc) {
  const caja = await loc.boundingBox();
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2, { button: 'right' });
  return page.locator('.gp-ctx');
}

/** Click derecho sobre el GRID mismo (el hueco). Se dispara el evento sobre el elemento en vez de
 *  apuntar píxeles: el grid no siempre llega hasta donde uno cree y el click caía afuera. */
async function ctxSobreHueco(page) {
  await page.evaluate(() => {
    const g = document.querySelector('.gp-view.is-on .gp-grid');
    const r = g.getBoundingClientRect();
    g.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: Math.round(r.left + 8), clientY: Math.round(r.top + 8) }));
  });
  return page.locator('.gp-ctx');
}

test('sobre una card, el menú ofrece las acciones de la card', async ({ page }) => {
  await montar(page);
  const card = page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]');
  await expect(card).toHaveCount(1, { timeout: 25_000 });
  const menu = await ctxSobre(page, card);
  await expect(menu).toBeVisible({ timeout: 10_000 });
  const actos = await menu.locator('.gp-ctx-it').evaluateAll(els => els.map(e => e.dataset.act));
  expect(actos).toEqual(['editar', 'duplicar', 'copiar', 'cortar', 'borrar']);
});

test('sobre el hueco, ofrece crear y pegar — y pegar arranca deshabilitado', async ({ page }) => {
  await montar(page);
  await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]')).toHaveCount(1, { timeout: 25_000 });
  const menu = await ctxSobreHueco(page);
  await expect(menu).toBeVisible({ timeout: 10_000 });
  const actos = await menu.locator('.gp-ctx-it').evaluateAll(els => els.map(e => e.dataset.act));
  expect(actos).toEqual(['nueva', 'pegar']);
  // Sin nada copiado, pegar no se puede: ofrecerlo activo sería mentir.
  await expect(menu.locator('.gp-ctx-it[data-act="pegar"]')).toBeDisabled();
});

test('copiar una card habilita pegar', async ({ page }) => {
  await montar(page);
  const card = page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]');
  await expect(card).toHaveCount(1, { timeout: 25_000 });
  const menu = await ctxSobre(page, card);
  await expect(menu).toBeVisible({ timeout: 10_000 });
  await menu.locator('.gp-ctx-it[data-act="copiar"]').click();
  await expect(page.locator('.gp-ctx')).toHaveCount(0);

  await ctxSobreHueco(page);
  await expect(page.locator('.gp-ctx-it[data-act="pegar"]')).toBeEnabled({ timeout: 10_000 });
});

test('Escape cierra el menú', async ({ page }) => {
  await montar(page);
  const card = page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]');
  await expect(card).toHaveCount(1, { timeout: 25_000 });
  await ctxSobre(page, card);
  await expect(page.locator('.gp-ctx')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.gp-ctx')).toHaveCount(0);
});
