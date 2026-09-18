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
  schema: 'gp.card/v1', title: 'ACWR', viz: 'acwr', scope: { level: 'squad' },
  metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: { color: '#2563EB' } } };
const CARD_TSB = { id: 'c-tsb', position: 1, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'Forma', viz: 'tsb', scope: { level: 'squad' },
  metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: {} } };
const CARD_MONO = { id: 'c-mono', position: 2, source: 'builder', size: 'md', config: {
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
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [CARD_ACWR, CARD_TSB, CARD_MONO] }));
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


const viajes = (page, etq) =>
  page.evaluate((e) => window.__cmFetchStats?.[e]?.calls || 0, etq);

test('la card ACWR dibuja su serie', async ({ page }) => {
  await montar(page);
  const card = page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]');
  await expect(card).toHaveCount(1, { timeout: 25_000 });
  // Un canvas no alcanza: se exige que el gráfico tenga puntos de ACWR de verdad.
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('.gp-c[data-card-id="c-acwr"] canvas');
    if (!c || !window.Chart?.getChart) return -1;
    const ch = window.Chart.getChart(c);
    if (!ch) return -2;
    const linea = (ch.data?.datasets || []).find(d => d.label === 'ACWR');
    return (linea?.data || []).filter(v => v != null).length;
  }), { timeout: 60_000 }).toBeGreaterThan(0);
});

test('la card ACWR no arrastra el fetch del período', async ({ page }) => {
  await montar(page);
  await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]')).toHaveCount(1, { timeout: 25_000 });
  // Pide lo suyo (sólo la columna de la métrica base, sin joins)…
  await expect.poll(() => viajes(page, 'acwr.gps'), { timeout: 60_000 }).toBeGreaterThan(0);
  // …y NO el bloque del resolver, que para este tipo no se usa para nada.
  expect(await viajes(page, 'resolver.fetchReports')).toBe(0);
});

test('el eje no arranca antes del primer dato', async ({ page }) => {
  // La ventana que se pide es larga a propósito (28 días de crónica antes del primer punto), pero
  // dibujar ese tramo en blanco estira el eje sin decir nada: en un club, datos desde agosto y el
  // eje arrancando en junio.
  await montar(page);
  await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="c-acwr"]')).toHaveCount(1, { timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('.gp-c[data-card-id="c-acwr"] canvas');
    const ch = c && window.Chart?.getChart?.(c);
    const d = ch?.data?.datasets?.[0]?.data;
    if (!d?.length) return null;
    return { primero: d[0], ultimo: d[d.length - 1], total: d.length };
  }), { timeout: 60_000 }).not.toBeNull();
  const s = await page.evaluate(() => {
    const c = document.querySelector('.gp-c[data-card-id="c-acwr"] canvas');
    const d = window.Chart.getChart(c).data.datasets[0].data;
    return { primero: d[0], ultimo: d[d.length - 1] };
  });
  expect(s.primero, 'el primer punto del eje no puede estar vacío').not.toBeNull();
  expect(s.ultimo, 'el último punto del eje no puede estar vacío').not.toBeNull();
});

test('la card Fitness/Fatiga/Forma dibuja sus tres curvas', async ({ page }) => {
  // El cálculo es el de siempre (gpScience.trainingStressBalance); acá se comprueba que la card
  // del builder lo enchufa bien y dibuja las TRES series, no una.
  await montar(page);
  await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="c-tsb"]')).toHaveCount(1, { timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('.gp-c[data-card-id="c-tsb"] canvas');
    const ch = c && window.Chart?.getChart?.(c);
    if (!ch) return -1;
    return (ch.data?.datasets || []).filter(d => (d.data || []).some(v => v != null)).length;
  }), { timeout: 60_000 }).toBe(3);
});

test('la card Monotonía dibuja una barra por semana', async ({ page }) => {
  // Lo que se protege: que agrupe por SEMANA (no por día ni por sesión) y que descarte las semanas
  // sin nada que medir. Con 40 sesiones repartidas en 80 días tienen que salir varias barras, y
  // todas con un valor razonable — la monotonía es media÷desvío, nunca negativa.
  await montar(page);
  await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="c-mono"]')).toHaveCount(1, { timeout: 25_000 });
  const vals = await (async () => {
    await expect.poll(() => page.evaluate(() => {
      const c = document.querySelector('.gp-c[data-card-id="c-mono"] canvas');
      const ch = c && window.Chart?.getChart?.(c);
      return (ch?.data?.datasets?.[0]?.data || []).length;
    }), { timeout: 60_000 }).toBeGreaterThan(1);
    return page.evaluate(() => {
      const c = document.querySelector('.gp-c[data-card-id="c-mono"] canvas');
      const ch = window.Chart.getChart(c);
      return { datos: ch.data.datasets[0].data, etiquetas: ch.data.labels };
    });
  })();
  expect(vals.datos.every(v => v > 0), 'la monotonía no puede ser cero ni negativa').toBe(true);
  // Las etiquetas son lunes: agrupa por semana de verdad.
  const lunes = vals.etiquetas.every(e => new Date(e + 'T00:00:00').getDay() === 1);
  expect(lunes, `las barras no caen todas en lunes: ${vals.etiquetas.join(', ')}`).toBe(true);
});

test('la curva de Forma no arranca con el tramo plano en cero', async ({ page }) => {
  // La ventana que se pide arranca antes a propósito (el fitness usa 42 días), pero dibujar los
  // días previos al primer registro son curvas planas en cero que no dicen nada — en un club se
  // veía un mes entero de línea recta antes de que empezaran los datos.
  await montar(page);
  await expect(page.locator('.gp-view.is-on .gp-c[data-card-id="c-tsb"]')).toHaveCount(1, { timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('.gp-c[data-card-id="c-tsb"] canvas');
    const ch = c && window.Chart?.getChart?.(c);
    return (ch?.data?.datasets || []).length;
  }), { timeout: 60_000 }).toBe(3);
  const primeros = await page.evaluate(() => {
    const c = document.querySelector('.gp-c[data-card-id="c-tsb"] canvas');
    const ch = window.Chart.getChart(c);
    const fit = ch.data.datasets.find(d => /fitness/i.test(d.label || ''));
    return { primero: fit?.data?.[0] ?? null, largo: fit?.data?.length ?? 0 };
  });
  expect(primeros.largo, 'la curva quedó vacía').toBeGreaterThan(5);
  expect(primeros.primero, 'el primer punto de fitness sigue siendo cero').toBeGreaterThan(0);
});

// Las tres cards de carga (ACWR, Forma, Monotonía) usan el MISMO motor y, en este dashboard, la
// MISMA métrica y el mismo rango. Cada una pedía su propio par training_sessions + gps_reports
// del club entero: tres veces exactamente los mismos datos. En el club de Joaquín eso se veía
// como dos consultas de 70 kB casi idénticas tardando 9,1 s y 7,6 s, y una tercera detrás —
// tiempo que es casi todo COLA en el navegador, porque el servidor contesta esa consulta en
// ~180 ms medido con RLS puesta.
test('tres cards de carga con la misma métrica comparten la consulta, no la repiten', async ({ page }) => {
  const { pedidos } = await montar(page);
  // Esperar a que las tres hayan resuelto: la última en dibujar es la que cerraría el ciclo.
  for (const id of ['c-acwr', 'c-tsb', 'c-mono']) {
    await expect(page.locator(`.gp-view.is-on .gp-c[data-card-id="${id}"]`)).toHaveCount(1, { timeout: 25_000 });
  }
  await expect.poll(() => page.evaluate(() =>
    ['c-acwr', 'c-tsb', 'c-mono'].filter(id =>
      document.querySelector(`.gp-c[data-card-id="${id}"] canvas`)).length
  ), { timeout: 60_000 }).toBe(3);
  // Margen para que, si hubiera consultas repetidas en camino, lleguen a aparecer.
  await page.waitForTimeout(1_500);

  // Contar por la ETIQUETA del propio motor ('acwr.gps'), no por el aspecto de la URL: hay otros
  // bloques de la página que piden gps_reports con columnas parecidas, y mezclarlos hacía que
  // este test midiera cosas que no son suyas.
  const viajesMotor = await viajes(page, 'acwr.gps');
  expect(viajesMotor).toBe(1);
  // Y que el ahorro no sea "no pedir nunca": las tres cards tienen que haber dibujado, cosa que
  // ya se exigió arriba.
  expect(pedidos.some(u => u.includes('gps_reports'))).toBe(true);
});
