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

/** ¿Ya se pidió el bloque de datos históricos (el select con player_load + position)? */
const pidioHistorico = (pedidos) =>
  pedidos.some(u => u.includes('gps_reports') && u.includes('player_load') && u.includes('players%21inner'));

// Vigilar el DIBUJO de estas cards resultó no servir: el canvas con datos aparece igual con el
// bloque histórico anulado (comprobado por mutación), así que un test sobre el canvas da verde
// cuando debería dar rojo. Lo que sí discrimina es la CONSULTA: el bloque histórico es un select
// reconocible (player_load + el join a players) y o se pide o no se pide.
test('al llegar a la card, los datos históricos se piden', async ({ page }) => {
  const { pedidos } = await montar(page);
  const card = page.locator('#card-acwr');
  await expect(card).toHaveCount(1, { timeout: 20_000 });
  await card.scrollIntoViewIfNeeded({ timeout: 20_000 });
  // Si el pedido se difiere hasta que la card esté a la vista, el scroll de arriba lo dispara;
  // si no se difiere, ya se hizo. En los dos casos, al llegar acá tiene que estar hecho.
  await expect.poll(() => pidioHistorico(pedidos), { timeout: 30_000 }).toBe(true);
});

test('si la card nace fuera de pantalla, sus datos no se piden hasta llegar a ella', async ({ page }) => {
  const { pedidos } = await montar(page);
  await expect(page.locator('#card-acwr')).toHaveCount(1, { timeout: 20_000 });
  // Esperar a que estén fuera de alcance TODAS las cards que el observador vigila, no sólo la
  // del ACWR: el bloque histórico es uno solo para las cuatro, así que basta que cualquiera
  // asome para que el pedido salga — y eso sería correcto. Mirando una sola, el test fallaba
  // de a ratos por culpa de la de al lado (el layout del fixture monta también la de TSB).
  await expect.poll(() => page.evaluate(() => {
    const ids = ['card-acwr', 'card-tsb', 'card-mc-heat', 'card-match-vs-train'];
    const els = ids.map(i => document.getElementById(i)).filter(Boolean);
    if (!els.length) return null;
    return els.every(c => c.getBoundingClientRect().top > window.innerHeight + 900);
  }), { timeout: 20_000 }).toBe(true);
  // Y recién ahí, margen para que el pedido llegue si fuera a llegar.
  await page.waitForTimeout(3_000);
  expect(pidioHistorico(pedidos)).toBe(false);

  // Y al llegar a la card, se pide: el ahorro no puede ser "no cargar nunca".
  await page.locator('#card-acwr').scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect.poll(() => pidioHistorico(pedidos), { timeout: 30_000 }).toBe(true);
});

test('si esas cards no están en el dashboard, sus datos no se piden nunca', async ({ page }) => {
  // Un dashboard donde el usuario se quedó con OTRA card: las del bloque histórico no están.
  // Es el caso real y el más común — y era el peor, porque se pedían sus ~1.270 filas igual.
  const { pedidos } = await montar(page, [{ card_id: 'vzones', size: 'md', config: {}, x: 0, y: 0, w: 6, h: 7 }]);
  await expect(page.locator('#card-acwr')).toHaveCount(0, { timeout: 20_000 });
  // Margen amplio: lo que se afirma es que NO llega, así que hay que darle tiempo a llegar.
  await page.waitForTimeout(5_000);
  expect(pidioHistorico(pedidos)).toBe(false);
});

test('si la vista Microcycle Compare no tiene cards, no pide sus datos al entrar', async ({ page }) => {
  // El layout de esta vista queda vacío (el mock sólo devuelve fila para player_week), así que
  // sus cards se retiran del grid. Entrar a la pestaña no puede disparar su consulta.
  await montar(page);
  await page.locator('[data-view="mc"]').first().click();
  await expect(page.locator('.gp-view[data-view="mc"].is-on')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#card-mc-table')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(5_000);   // margen para que la consulta llegue, si fuera a llegar
  // El contador de viajes del propio producto, por etiqueta: es exactamente lo que se quiere cero.
  const viajes = await page.evaluate(() => window.__cmFetchStats?.['mc-heatmap']?.calls || 0);
  expect(viajes).toBe(0);
});

// ── El pedido base del dashboard clásico ────────────────────────────────────────────────────
// _fetchReports trae TODOS los datos GPS del rango y alimenta sólo cards clásicas (KPI, tabla
// z-score vieja, ranking, scatter, científicas). Las del builder no lo tocan.
const viajesBase = (page) =>
  page.evaluate(() => window.__cmFetchStats?.['_fetchReports.chunk']?.calls || 0);

test('con cards clásicas en el dashboard, el pedido base se hace', async ({ page }) => {
  await montar(page);   // layout por defecto del helper: trae card-acwr y card-tsb
  await expect(page.locator('#card-acwr')).toHaveCount(1, { timeout: 20_000 });
  await expect.poll(() => viajesBase(page), { timeout: 30_000 }).toBeGreaterThan(0);
});

test('sin ninguna card clásica, el pedido base no se hace', async ({ page }) => {
  // Layout vacío = el usuario se quedó sólo con cards del builder. Es el caso real que motivó
  // esto: 10 cards, todas del builder, y el pedido base viajaba igual.
  await montar(page, []);
  await expect(page.locator('.gp-view.is-on .gp-c[id]')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(5_000);   // margen para que llegue, si fuera a llegar
  expect(await viajesBase(page)).toBe(0);
});

test('al cambiar a una pestaña que SÍ tiene cards clásicas, los datos se piden', async ({ page }) => {
  // La vista de arranque queda sin cards clásicas (no se pide nada) pero Session Control conserva
  // una. Es el caso que la guarda no puede romper: si no pidiera al llegar, la card queda muda.
  await montar(page, [], [{ card_id: 'outliers', size: 'md', config: {}, x: 0, y: 0, w: 6, h: 7 }]);
  await page.waitForTimeout(3_000);
  expect(await viajesBase(page)).toBe(0);            // en la vista de arranque, nada

  await page.locator('[data-view="grp"]').first().click();
  await expect(page.locator('.gp-view[data-view="grp"].is-on')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#card-outliers')).toHaveCount(1, { timeout: 15_000 });
  await expect.poll(() => viajesBase(page), { timeout: 30_000 }).toBeGreaterThan(0);
});

// Las cards CLÁSICAS de ACWR y Forma leen lo mismo —la carga diaria del jugador— pero cada una
// pedía su propio par training_sessions + gps_reports: cuatro consultas para dos gráficos. En el
// dashboard real se veía como «player-load-series: 2 llamadas, 0 filas, 1.238 ms», segundo y
// pico esperando dos veces la misma respuesta. Ahora comparten una sola, con la ventana más
// ancha que alguna necesita (84 días) y cada una recortando la suya.
test('las cards clásicas de ACWR y Forma comparten una sola consulta de carga', async ({ page }) => {
  const { pedidos } = await montar(page);
  const esCarga = (u) => u.includes('gps_reports') && /select=session_id(%2C|,)player_load/.test(u);

  // Esperar a que la vista haya pedido la carga al menos una vez…
  await expect.poll(() => pedidos.filter(esCarga).length, { timeout: 30_000 }).toBeGreaterThan(0);
  // …y dar margen a que apareciera la segunda, si se siguiera pidiendo dos veces.
  await page.waitForTimeout(2_000);
  expect(pedidos.filter(esCarga).length).toBe(1);
});
