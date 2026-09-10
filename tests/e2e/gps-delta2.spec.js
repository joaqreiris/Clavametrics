// @ts-check
// «Δ% entre las dos fechas»: elegís dos días en el filtro y cada barra pasa a SER la diferencia
// entre ellos. La alternativa que había —meter la fecha como dimensión— duplicaba las barras:
// 20 jugadores × 2 fechas = 40 barras con el % escrito encima de cada una, ilegible.
// Acá queda una barra por jugador, verde si subió y roja si bajó.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const D1 = daysAgo(14), D2 = daysAgo(7);   // los dos MD-4 a comparar
const D0 = daysAgo(21);                    // un tercer día que NO se elige: no tiene que entrar

// p1 sube (4000→5000, +25%), p2 baja (6000→3000, −50%), p3 sólo tiene el primer día (sin barra).
const TD = {
  p1: { [D0]: 9999, [D1]: 4000, [D2]: 5000 },
  p2: { [D0]: 9999, [D1]: 6000, [D2]: 3000 },
  p3: { [D0]: 9999, [D1]: 7000 },
};
const SES = [{ id: 's0', date: D0 }, { id: 's1', date: D1 }, { id: 's2', date: D2 }];
const SESSIONS = SES.map(s => ({ id: s.id, club_id: CLUB_ID, session_date: s.date, session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false, match_day_offset: -4 }));
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Ana', last_name: 'Alfa', number: 5, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto', last_name: 'Beta', number: 6, position: 'MF', positions: ['MF'], status: 'active' },
  { id: 'p3', club_id: CLUB_ID, first_name: 'Ciro', last_name: 'Gama', number: 7, position: 'ST', positions: ['ST'], status: 'active' },
];
const REPORTS = SES.flatMap(s => PLAYERS.filter(p => TD[p.id][s.date] != null).map(p => ({
  player_id: p.id, session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: TD[p.id][s.date], high_speed_distance: 500, very_high_speed_distance: 100,
  sprint_distance: 50, sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28,
  avg_speed: 6, player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: s.date, session_attributes: null, microcycle_id: null, team_id: null,
    session_type: 'training', match_day_offset: -4, season_id: null },
})));

const card = (rel) => [{ id: 'card-d2', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Distancia por jugador', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg', ...(rel ? { rel } : {}) }],
  dimensions: [{ id: 'player' }], range: { type: 'season' }, style: { color: '#15803D' } } }];

async function open(page, rel = 'delta2') {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    const ord = [...SESSIONS].sort((a, b) => b.session_date.localeCompare(a.session_date));
    return r.fulfill({ json: one ? ord[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  // Respeta el `in(session_id)`: es por donde el filtro de días llega a las filas, y sin esto
  // el test no distinguiría un filtro que anda de uno que no.
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    const url = new URL(r.request().url());
    const m = (url.searchParams.get('session_id') || '').match(/^in\.\((.*)\)$/);
    const ok = m ? new Set(m[1].split(',').map(v => v.replace(/^"|"$/g, ''))) : null;
    return r.fulfill({ json: ok ? REPORTS.filter(x => ok.has(x.session_id)) : REPORTS });
  });
  await page.route(`${SB}/rest/v1/rpc/gps_filter_rows`, r => r.fulfill({ json: REPORTS.map(x => ({
    player_id: x.player_id, work_context: 'team', session_id: x.session_id,
    session_date: x.training_sessions.session_date, session_attributes: null, match_day_offset: -4,
    microcycle_id: null, team_id: null, session_type: 'training', season_id: null,
    first_name: x.players.first_name, last_name: x.players.last_name, number: x.players.number,
    player_position: x.players.position,
  })) }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: card(rel) }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-d2"] canvas').length
  ), { timeout: 45_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(600);
}

/** Elige los dos días en la barra de filtros y espera a que las cards se rehagan. */
async function elegirDosDias(page, dias) {
  await page.evaluate(async (ds) => { window.gpFilterBar.setDateDays(ds); }, dias);
  await page.waitForTimeout(2200);
}

const barras = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-d2"] canvas');
  const ch = window.Chart.getChart(cv);
  const ds = ch.data.datasets.find(d => d.type === 'bar') || ch.data.datasets[0];
  return { labels: ch.data.labels.map(String),
           data: ds.data.map(v => v == null ? null : Math.round(Number(v))),
           colores: Array.isArray(ds.backgroundColor) ? ds.backgroundColor : [ds.backgroundColor] };
});

test.describe('GPS · Δ% entre dos fechas', () => {
  test('una barra por jugador, y la barra ES la diferencia', async ({ page }) => {
    await open(page);
    await elegirDosDias(page, [D1, D2]);
    const b = await barras(page);
    // Una barra por jugador — no dos. Es el punto de todo el modo. Y sólo los dos que se
    // pueden comparar: el tercero no entrenó una de las fechas y sale del eje (ver más abajo).
    expect(b.labels).toHaveLength(2);
    const val = Object.fromEntries(b.labels.map((l, i) => [l, b.data[i]]));
    const de = (ap) => val[Object.keys(val).find(k => k.includes(ap))];
    expect(de('Alfa')).toBe(25);      // 4000 → 5000
    expect(de('Beta')).toBe(-50);     // 6000 → 3000
  });

  // Dejarlo en el eje con la barra vacía llenaba el gráfico de huecos que se leen como un cero;
  // sacarlo sin decir nada haría creer que el jugador no existe. Se saca Y se avisa.
  test('al que le falta una de las dos fechas sale del eje, pero se avisa quién', async ({ page }) => {
    await open(page);
    await elegirDosDias(page, [D1, D2]);
    const b = await barras(page);
    expect(b.labels.some(l => l.includes('Gama'))).toBe(false);
    const nota = await page.evaluate(() =>
      document.querySelector('.gp-c[data-card-id="card-d2"] .gp-delta2-note')?.textContent?.trim() || '');
    expect(nota).toContain('Gama');
    expect(nota).toMatch(/\b1\b/);              // dice cuántos quedaron fuera
  });

  test('el que sube va en verde y el que baja en rojo', async ({ page }) => {
    await open(page);
    await elegirDosDias(page, [D1, D2]);
    const b = await barras(page);
    const i = (ap) => b.labels.findIndex(l => l.includes(ap));
    expect(b.colores[i('Alfa')]).not.toBe(b.colores[i('Beta')]);
  });

  test('el tercer día, que no se eligió, no entra en la cuenta', async ({ page }) => {
    await open(page);
    await elegirDosDias(page, [D1, D2]);           // D0 (9999 m) queda afuera
    const b = await barras(page);
    const de = (ap) => b.data[b.labels.findIndex(l => l.includes(ap))];
    expect(de('Alfa')).toBe(25);                   // si D0 entrara, no daría 25
  });

  test('sin el modo puesto la card sigue mostrando metros, no porcentajes', async ({ page }) => {
    await open(page, null);                        // misma card, sin rel
    await elegirDosDias(page, [D1, D2]);
    const b = await barras(page);
    const de = (ap) => b.data[b.labels.findIndex(l => l.includes(ap))];
    expect(de('Alfa')).toBe(4500);                 // promedio de 4000 y 5000
  });
});
