// @ts-check
// Carta de control: la serie del jugador con su propia media y una banda de ±2 desviaciones.
// Responde lo mismo que el z-score de la matriz —«¿esta sesión se salió de lo normal para él?»—
// pero sin pedirle a nadie que sepa qué es una desviación típica: se ve el punto fuera.
//
// Lo que hay que blindar no es que dibuje, sino que la banda signifique algo: que el punto raro
// quede marcado, que los normales no, y que con pocas sesiones NO se dibuje una banda inventada.

import { test, expect } from '@playwright/test';
import { SB, injectSession, seedGpIds } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PID = '00000000-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'ind', name: 'Player Week', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };

const PL = [{ id: PID, club_id: CLUB_ID, first_name: 'Jug', last_name: 'Uno', number: 7, position: 'CB', positions: ['CB'], status: 'active' }];

/** `vals` = un valor por sesión, de la más vieja a la más nueva. */
function fixture(vals) {
  const ses = vals.map((_, i) => ({
    id: 's' + i, club_id: CLUB_ID, session_date: d((vals.length - i) * 2),
    session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false, match_day_offset: -3,
  }));
  const rep = ses.map((s, i) => ({
    id: 'r-' + s.id, player_id: PID, session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
    total_distance: vals[i], high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
    sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
    player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
    players: { id: PID, first_name: 'Jug', last_name: 'Uno', number: 7, position: 'CB', positions: ['CB'] },
    training_sessions: { session_date: s.session_date, session_attributes: null, microcycle_id: 'mc-a',
      team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
  }));
  return { ses, rep };
}

const CARD = { id: 'card-ctrl', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Control', viz: 'control', scope: { level: 'player', playerId: PID },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: { color: '#2563EB' } } };

// Misma referencia que usa la carta, pero pedida desde el selector: «vs Sí mismo» existía en la
// lista desde hacía tiempo y NADIE la implementaba — la card dibujaba los valores crudos y no
// avisaba. Esto fija que ahora compara de verdad.
const CARD_SELF = { id: 'card-self', position: 1, source: 'builder', size: 'md', config: {
  schema: 'gp.card/v1', title: 'vs si mismo', viz: 'kpi', scope: { level: 'player', playerId: PID },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [],
  range: { type: 'last30' }, style: {}, comparison: { baseline: 'self', method: 'avg' } } };

async function open(page, vals) {
  const { ses, rep } = fixture(vals);
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
    const ord = [...ses].sort((a, b) => b.session_date.localeCompare(a.session_date));
    return r.fulfill({ json: acc ? ord[0] : ses });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PL }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: [{ id: 'mc-a', club_id: CLUB_ID, name: 'MC 01', start_date: d(30), end_date: d(0), match_date: d(1), rival: 'R', home_away: 'home' }] }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
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
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [CARD, CARD_SELF] }));
  await injectSession(page);
  await seedGpIds(page, CLUB_ID, 'user-1');
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 20_000 });
  await page.evaluate((c) => { window._gpClubId = c; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-ctrl"]');
    if (!c) return 'sin-card';
    return c.querySelector('.cb2-state.load') ? 'cargando' : 'resuelto';
  }), { timeout: 30_000 }).toBe('resuelto');
}

/** Lo que la carta terminó dibujando, leído del propio Chart.js. */
const leer = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-c[data-card-id="card-ctrl"] canvas');
  if (!cv || !window.Chart?.getChart) return null;
  const ch = window.Chart.getChart(cv);
  if (!ch) return null;
  const ds = ch.data.datasets;
  const serie = ds.find(x => !String(x.label || '').startsWith('__'));
  const media = ds.find(x => x.label === '__media');
  const lsc = ds.find(x => x.label === '__lsc');
  const rojos = (serie?.pointBackgroundColor || []).filter(c => String(c).toUpperCase() === '#EF4444').length;
  return {
    puntos: serie?.data?.length || 0,
    tieneMedia: !!media, tieneBanda: !!lsc,
    media: media?.data?.[0] ?? null, lsc: lsc?.data?.[0] ?? null,
    rojos,
    nota: document.querySelector('.gp-c[data-card-id="card-ctrl"] .gp-ctrl-note')?.textContent?.trim() || '',
  };
});

test.describe('GPS · carta de control', () => {
  test('marca la sesión que se salió y deja dentro a las normales', async ({ page }) => {
    // Ocho sesiones apretadas y una muy alta: la de 3000 tiene que quedar fuera de la banda.
    await open(page, [1000, 1050, 980, 1020, 1010, 990, 1030, 1000, 3000]);
    const r = await leer(page);
    expect(r).not.toBeNull();
    expect(r.puntos).toBe(9);
    expect(r.tieneMedia).toBe(true);
    expect(r.tieneBanda).toBe(true);
    // Exactamente UNA marcada: si marcara todas, el color no distinguiría nada.
    expect(r.rojos).toBe(1);
    // El límite superior está por encima de las normales y por debajo de la rara: si no, la
    // banda no separa nada.
    expect(r.lsc).toBeGreaterThan(1050);
    expect(r.lsc).toBeLessThan(3000);
  });

  test('sin nada raro, ningún punto queda marcado', async ({ page }) => {
    await open(page, [1000, 1050, 980, 1020, 1010, 990, 1030]);
    const r = await leer(page);
    expect(r.puntos).toBe(7);
    expect(r.rojos).toBe(0);
    expect(r.nota).toMatch(/7/);
  });

  test('con pocas sesiones NO dibuja una banda inventada, y lo dice', async ({ page }) => {
    // Con tres puntos, media y banda se mueven tanto que «estar fuera» no significaría nada.
    await open(page, [1000, 2000, 1500]);
    const r = await leer(page);
    expect(r.puntos).toBe(3);
    expect(r.tieneBanda).toBe(false);
    expect(r.tieneMedia).toBe(false);
    expect(r.rojos).toBe(0);
    expect(r.nota.length).toBeGreaterThan(0);
  });

  test('«vs Sí mismo» compara contra su propia media, en vez de no hacer nada', async ({ page }) => {
    // Ocho sesiones ~1000 y una de 3000: su media queda en ~1222, así que la card tiene que
    // mostrar una diferencia REAL contra ella, no quedarse sin delta como hasta ahora.
    await open(page, [1000, 1050, 980, 1020, 1010, 990, 1030, 1000, 3000]);
    const delta = await page.evaluate(() => {
      const c = document.querySelector('.gp-c[data-card-id="card-self"]');
      const d = c && c.querySelector('.d, .kd');
      return d ? d.textContent.trim() : '';
    });
    expect(delta, 'la card no mostró ninguna comparación').not.toBe('');
    expect(delta).toMatch(/[+−-]\s*\d/);
  });
});
