// @ts-check
// «Δ% vs la anterior»: cada FECHA contra la anterior del MISMO MD. Los otros dos modos comparan
// todo lo seleccionado contra una referencia previa al rango, así que eligiendo dos MD-3 no se
// podía ver el % entre ellos — que es la pregunta de todas las semanas.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 60_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// Escenario A — un jugador, tres MD-3 (subiendo 4000 → 5000 → 6000) y un MD-1 en el medio que NO
// se tiene que mezclar. Escenario B — el de todas las semanas: DOS fechas del mismo MD y el eje
// por jugador, para ver quién subió y quién bajó entre una y la otra.
const ESC = {
  porFecha: {
    ses: [
      { id: 's1', date: daysAgo(21), md: -3, td: { p1: 4000 } },
      { id: 's2', date: daysAgo(14), md: -3, td: { p1: 5000 } },
      { id: 's3', date: daysAgo(10), md: -1, td: { p1: 9000 } },
      { id: 's4', date: daysAgo(7),  md: -3, td: { p1: 6000 } },
    ],
    players: [{ id: 'p1', first: 'A', last: 'Uno', num: 5, pos: 'CB' }],
    dims: [{ id: 'session_date' }],
  },
  porJugador: {
    // p1 sube (4000 → 5000 = +25%), p2 baja (6000 → 3000 = −50%): si comparara contra el total
    // del día en vez de contra el mismo jugador, los dos darían lo mismo.
    ses: [
      { id: 's1', date: daysAgo(14), md: -4, td: { p1: 4000, p2: 6000 } },
      { id: 's2', date: daysAgo(7),  md: -4, td: { p1: 5000, p2: 3000 } },
    ],
    players: [{ id: 'p1', first: 'A', last: 'Uno', num: 5, pos: 'CB' },
              { id: 'p2', first: 'B', last: 'Dos', num: 6, pos: 'MF' }],
    dims: [{ id: 'player' }, { id: 'session_date' }],
  },
};

async function open(page, esc = ESC.porFecha) {
  const SES = esc.ses;
  const SESSIONS = SES.map(s => ({ id: s.id, club_id: CLUB_ID, session_date: s.date, session_type: 'training',
    team_id: null, microcycle_id: null, is_historical: false, match_day_offset: s.md }));
  const PLAYERS = esc.players.map(p => ({ id: p.id, club_id: CLUB_ID, first_name: p.first, last_name: p.last,
    number: p.num, position: p.pos, positions: [p.pos], status: 'active' }));
  const REPORTS = SES.flatMap(s => esc.players.filter(p => s.td[p.id] != null).map(p => ({
    player_id: p.id, session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
    total_distance: s.td[p.id], high_speed_distance: 500, very_high_speed_distance: 100, sprint_distance: 50,
    sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
    player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
    players: { first_name: p.first, last_name: p.last, number: p.num, position: p.pos, positions: [p.pos] },
    training_sessions: { session_date: s.date, session_attributes: null, microcycle_id: null, team_id: null,
      session_type: 'training', match_day_offset: s.md, season_id: null },
  })));
  const CARD = [{ id: 'card-rel', position: 0, source: 'builder', size: 'lg', config: {
    schema: 'gp.card/v1', title: 'Distancia por día', viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'avg', rel: 'prev_occ' }],
    dimensions: esc.dims, range: { type: 'season' }, style: { color: '#15803D' } } }];

  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  // El resolver pregunta por la ÚLTIMA sesión con limit=1 + maybeSingle: eso espera un objeto,
  // no una lista. Sin esto la ventana de temporada sale vacía y no hay histórico que comparar.
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const url = r.request().url();
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(url);
    const ordenadas = [...SESSIONS].sort((a, b) => b.session_date.localeCompare(a.session_date));
    return r.fulfill({ json: one ? ordenadas[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: CARD }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-rel"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(900);
}

/** El Δ% que quedó pegado a cada barra (_relPct del dataset). */
const deltas = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-rel"] canvas');
  const ch = window.Chart.getChart(cv);
  const ds = ch.data.datasets.find(d => d._relPct) || {};
  return { labels: ch.data.labels.map(String), pct: (ds._relPct || []).map(v => v == null ? null : Math.round(v)) };
});

test.describe('GPS · Δ% vs la anterior', () => {
  test('cada fecha se compara con la anterior DEL MISMO MD', async ({ page }) => {
    await open(page, ESC.porFecha);
    const d = await deltas(page);
    expect(d.labels).toHaveLength(4);          // 3 MD-3 + 1 MD-1
    // MD-3: 4000 → 5000 → 6000. El primero no tiene anterior; el 2º +25%; el 3º +20%.
    expect(d.pct[0]).toBeNull();
    expect(d.pct[1]).toBe(25);
    expect(d.pct[3]).toBe(20);
    // El MD-1 del medio (9000) NO se compara con ningún MD-3: es el único de su clase.
    expect(d.pct[2]).toBeNull();
  });

  // El caso de todas las semanas: dos fechas del mismo MD y el eje por jugador, para ver quién
  // subió y quién bajó. Hace falta que la FECHA esté entre las dimensiones — sin ella el botón
  // Δ% ni se ofrece, porque no habría con qué comparar cada barra.
  test('con el eje por jugador, cada uno se compara consigo mismo', async ({ page }) => {
    await open(page, ESC.porJugador);
    const d = await deltas(page);
    expect(d.labels).toHaveLength(4);           // 2 jugadores × 2 fechas
    // El eje va por apellido, así que primero «Dos, B.» (p2) y después «Uno, A.» (p1).
    // Primera fecha de cada jugador: no tiene anterior. Segunda: su propia variación.
    expect(d.pct[0]).toBeNull();
    expect(d.pct[1]).toBe(-50);                 // p2: 6000 → 3000
    expect(d.pct[2]).toBeNull();
    expect(d.pct[3]).toBe(25);                  // p1: 4000 → 5000
  });
});
