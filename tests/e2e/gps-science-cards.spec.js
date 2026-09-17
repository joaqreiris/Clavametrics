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
  team_id: null, microcycle_id: null, is_historical: false, match_day_offset: -3, notes: null,
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
  training_sessions: { session_date: s.session_date, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: s.session_type, match_day_offset: -3, season_id: null },
})));

/** Monta el dashboard y devuelve un contador de consultas por etiqueta de cmFetchAll. */
async function montar(page) {
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
    if (did !== 'player_week') return r.fulfill({ json: acc ? null : [] });
    const fila = { user_id: 'user-1', club_id: CLUB_ID, dashboard_id: did, layout: [
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
  // Margen para que, si el pedido fuera a hacerse igual, dé tiempo a aparecer.
  await page.waitForTimeout(3_000);
  expect(pidioHistorico(pedidos)).toBe(false);

  // Y al llegar a la card, se pide: el ahorro no puede ser "no cargar nunca".
  await page.locator('#card-acwr').scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect.poll(() => pidioHistorico(pedidos), { timeout: 30_000 }).toBe(true);
});
