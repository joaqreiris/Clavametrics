// @ts-check
// Franja de outliers: el mismo z-score de la matriz, con otra lectura. En vez de dar todos los
// números, dibuja la distribución del plantel (un punto gris por jugador) y señala sólo a quien
// se pasa del umbral. Lo que hay que blindar es que señale a QUIEN corresponde, que el umbral
// mande de verdad, y que sin dispersión no invente una banda.

import { test, expect } from '@playwright/test';
import { SB, injectSession, seedGpIds } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'grp', name: 'Session control', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
const SES = [{ id: 's-a', club_id: CLUB_ID, session_date: d(2), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false }];

// Ocho jugadores juntos y uno muy alto: media 1.244 y σ muestral 733, así que el de 3.200 queda
// a +2,67 σ y los ocho restantes a −0,33 — ni cerca del umbral.
const VALORES = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 3200];
// Un plantel repartido de verdad: z entre −1,16 y +2,22. Con 2σ se marca uno; con 1σ, dos.
const DISPERSOS = [600, 750, 900, 1000, 1050, 1100, 1250, 1500, 2200];
const mk = (vals) => vals.map((v, i) => ({
  id: `0000000${i}-1111-4111-8111-111111111111`, club_id: CLUB_ID,
  first_name: 'Jug', last_name: 'Ape' + i, number: 10 + i,
  position: 'CB', positions: ['CB'], status: 'active', _v: v,
}));
const repDe = (players) => players.map(p => ({
  id: 'r-' + p.id, player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: p._v, high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
  sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
  player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: 'CB', positions: ['CB'] },
  training_sessions: { session_date: SES[0].session_date, session_attributes: null, microcycle_id: 'mc-a', team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

const card = (style = {}) => ([{ id: 'card-ol', position: 0, source: 'builder', size: 'full', config: {
  schema: 'gp.card/v1', title: 'Outliers', viz: 'outliers', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player_name' }],
  range: { type: 'last30' }, comparison: null, style: { size: 'full', color: '#15803D', ...style } } }]);

async function open(page, { style = {}, players = mk(VALORES) } = {}) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  const uno = (o) => (r) => r.fulfill({ json: (r.request().headers()['accept'] || '').includes('object') ? o : [o] });
  await page.route(`${SB}/rest/v1/profiles**`, uno(PROFILE));
  await page.route(`${SB}/rest/v1/clubs**`, uno(CLUB));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 3, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = (r.request().headers()['accept'] || '').includes('object');
    return r.fulfill({ json: acc ? SES[0] : SES });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: players }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 01', start_date: d(8), end_date: d(1), match_date: d(1), rival: 'R', home_away: 'home' }] }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    const rep = repDe(players);
    const sp = new URL(r.request().url()).searchParams;
    const off = +(sp.get('offset') || 0);
    const lim = +(sp.get('limit') || rep.length);
    const trozo = rep.slice(off, off + lim);
    return r.fulfill({ json: trozo, headers: {
      'Content-Range': `${off}-${off + trozo.length - 1}/${rep.length}`,
      'Content-Type': 'application/json',
      'Access-Control-Expose-Headers': 'Content-Range, content-range' } });
  });
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = (r.request().headers()['accept'] || '').includes('object');
    return r.fulfill({ json: acc ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: card(style) }));
  await injectSession(page);
  await seedGpIds(page, CLUB_ID, 'user-1');
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 20_000 });
  await page.evaluate((c) => { window._gpClubId = c; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-ol"]');
    if (!c) return 'sin-card';
    return c.querySelector('.cb2-state.load') ? 'cargando' : 'resuelto';
  }), { timeout: 30_000 }).toBe('resuelto');
}

const leer = (page) => page.evaluate(() => {
  const c = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-ol"]');
  if (!c) return null;
  return {
    grises: c.querySelectorAll('.gp-ol-dot').length,
    marcados: c.querySelectorAll('.gp-ol-out').length,
    etiquetas: [...c.querySelectorAll('.gp-ol-tag')].map(e => e.textContent.trim()),
    resumen: c.querySelector('.gp-ol-top')?.textContent?.trim() || '',
    banda: !!c.querySelector('.gp-ol-band'),
    eje: [...c.querySelectorAll('.gp-ol-axis span')].map(e => e.textContent.trim()),
  };
});

test.describe('GPS · franja de outliers', () => {
  test('marca al que se salió y deja al resto como fondo', async ({ page }) => {
    await open(page);
    const r = await leer(page);
    expect(r).not.toBeNull();
    // Nueve jugadores: ocho de fondo y uno señalado. Si marcara a todos, el color no diría nada.
    expect(r.marcados).toBe(1);
    expect(r.grises).toBe(8);
    expect(r.etiquetas.join(' ')).toContain('+2.7');
    expect(r.resumen).toMatch(/1/);
    expect(r.banda).toBe(true);
  });

  test('el umbral manda: con 3,5σ ese mismo jugador ya no es raro', async ({ page }) => {
    // Mismo dato, otra vara. Es lo que pidió Joaquín: un plantel ruidoso sube el umbral para que
    // la card no termine señalando a media plantilla.
    await open(page, { style: { zUmbral: 3.5 } });
    const r = await leer(page);
    expect(r.marcados).toBe(0);
    expect(r.grises).toBe(9);
    expect(r.eje.join(' ')).toContain('3.5σ');
  });

  test('bajando el umbral a 1σ aparecen los que antes pasaban desapercibidos', async ({ page }) => {
    // Con el plantel repartido, a 2σ se señala uno solo; a 1σ entra también el más bajo.
    await open(page, { style: { zUmbral: 2 }, players: mk(DISPERSOS) });
    expect((await leer(page)).marcados).toBe(1);
    await open(page, { style: { zUmbral: 1 }, players: mk(DISPERSOS) });
    expect((await leer(page)).marcados).toBe(2);
  });

  test('sin dispersión no dibuja banda ni señala a nadie', async ({ page }) => {
    // Todos iguales: la σ es 0 y cualquier z sería infinito. La franja lo dice en vez de inventar.
    await open(page, { players: mk([900, 900, 900, 900, 900]) });
    const r = await leer(page);
    expect(r.marcados).toBe(0);
    expect(r.banda).toBe(false);
  });
});
