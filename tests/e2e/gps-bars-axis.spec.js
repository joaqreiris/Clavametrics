// @ts-check
// Eje jerárquico de la card de barras (jugador × microciclo) — las dos cosas que no se ven
// leyendo el código y sí en el canvas:
//   1. Línea de referencia «por grupo» (split): en vez de UNA media que mezcla los dos
//      microciclos, una por microciclo, con el Δ% entre ambas en la etiqueta de la segunda.
//   2. Los nombres del piso de grupo se inclinan cuando no entran derechos (antes: «TAKAR…»).
//
// Se monta una card de builder REAL desde dashboard_cards (mock de red) y se leen los valores
// ya resueltos del chart: chart.options.plugins.gpbRefLines.lines y chart.scales.x.$gpTier.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };

const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// Dos microciclos, una sesión cada uno.
const MCS = [
  { id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(14), end_date: daysAgo(8),  match_date: daysAgo(8),  rival: 'A', home_away: 'home' },
  { id: 'mc-b', club_id: CLUB_ID, name: 'MC 04', start_date: daysAgo(7),  end_date: daysAgo(1),  match_date: daysAgo(1),  rival: 'B', home_away: 'away' },
];
const SESSIONS = [
  { id: 's-a', club_id: CLUB_ID, session_date: daysAgo(9), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false },
  { id: 's-b', club_id: CLUB_ID, session_date: daysAgo(2), session_type: 'training', team_id: null, microcycle_id: 'mc-b', is_historical: false },
];

// Cada jugador corre 1.000 m más que el anterior y sube un 20% exacto de un microciclo al otro:
// con 3 jugadores → MC 03 media 5.000 · MC 04 media 6.000 ⇒ variación media del plantel = +20%.
const _td = (i, si) => Math.round((4000 + i * 1000) * (si === 0 ? 1 : 1.2));

function buildPlayers(names) {
  return names.map((n, i) => ({
    id: 'p' + (i + 1), club_id: CLUB_ID, first_name: n.first, last_name: n.last,
    number: 10 + i, position: 'CB', positions: ['CB'], status: 'active',
  }));
}
function buildReports(players) {
  return SESSIONS.flatMap((s, si) => players.map((p, pi) => ({
    player_id: p.id, session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
    total_distance: _td(pi, si), high_speed_distance: Math.round(_td(pi, si) * 0.1),
    very_high_speed_distance: null, sprint_distance: null, sprint_count: 5,
    accelerations: 20, decelerations: 18, max_speed: 30, avg_speed: 6,
    player_load: Math.round(_td(pi, si) * 0.05), hmld: null, time_played: 90,
    distance_per_minute: +(_td(pi, si) / 90).toFixed(1),
    players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
    training_sessions: { session_date: s.session_date, session_attributes: null, microcycle_id: s.microcycle_id, team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
  })));
}

const CARD_CONFIG = {
  schema: 'gp.card/v1', title: 'INTENSITY', viz: 'bars',
  scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }],
  dimensions: [{ id: 'player' }, { id: 'microcycle' }],
  range: { type: 'last30' },
  style: { color: '#7C3AED' },
  referenceLines: [{ id: 'rl_1', value: 'mean', split: true, label: 'AVG', showValue: true, color: '#DC2626', style: 'dashed', opacity: 1 }],
};

async function mount(page, { names, split = true }) {
  const players = buildPlayers(names);
  const reports = buildReports(players);
  const cfg = { ...CARD_CONFIG, referenceLines: [{ ...CARD_CONFIG.referenceLines[0], split }] };

  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: players }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: reports }));
  // maybeSingle() pide un objeto (Accept: …pgrst.object+json); el resto de la página lee un array.
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({
    json: [{ id: 'card-1', config: cfg, size: 'lg', position: 0, source: 'builder' }],
  }));

  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  // La card montada trae su propio canvas; esperamos a que Chart.js lo tenga vivo con datos.
  await expect.poll(async () => page.evaluate(() => {
    const cv = document.querySelector('.gp-c[data-card-id="card-1"] canvas');
    const ch = cv && window.Chart && window.Chart.getChart(cv);
    return ch ? (ch.data?.labels?.length || 0) : 0;
  }), { timeout: 30_000, message: 'la card nunca terminó de dibujarse' }).toBeGreaterThan(0);
}

/** Estado resuelto del chart: líneas de referencia ya calculadas + la tira de nombres. */
function readChart(page) {
  return page.evaluate(() => {
    const cv = document.querySelector('.gp-c[data-card-id="card-1"] canvas');
    const ch = window.Chart.getChart(cv);
    const dims = ch.options.plugins.gpbBarGroupAxis?.dims || [];
    return {
      lines: (ch.options.plugins.gpbRefLines?.lines || []).map(l => ({ label: l.label, value: l.value, suffix: l.suffix, grpKey: l.grpKey })),
      tier:  ch.scales.x?.$gpTier || null,
      // Valores del 2º nivel del eje (microciclo) en orden de aparición: es contra esto que
      // tienen que corresponderse las líneas por grupo. El NOMBRE del microciclo lo resuelve la
      // filter bar (window._gpMcLabelById), que bajo mock no está poblada → acá llegan los ids.
      lvl2: [...new Set(dims.map(d => String(d[1] ?? '')).filter(Boolean))],
    };
  });
}

const SHORT = [{ first: 'A', last: 'Ba' }, { first: 'B', last: 'Ce' }, { first: 'C', last: 'Di' }];
// Plantel entero con apellidos largos: el caso real (29 jugadores en una card) donde los nombres
// no entran derechos bajo su corchete y terminaban en «TAKAR…».
const LONG = Array.from({ length: 8 }, (_, i) =>
  ({ first: 'Jugador' + i, last: 'Villalobos Etcheverry ' + i }));

test.describe('GPS · eje jerárquico de barras', () => {
  test('la media se parte en una línea por microciclo, con el Δ% entre ambas', async ({ page }) => {
    await mount(page, { names: SHORT, split: true });
    const { lines, lvl2 } = await readChart(page);

    expect(lvl2).toHaveLength(2);                        // dos microciclos en el eje
    expect(lines).toHaveLength(2);                       // → una línea cada uno
    expect(lines.map(l => l.grpKey)).toEqual(lvl2);      // y en el mismo orden
    expect(lines[0].value).toBeCloseTo(5000, 0);
    expect(lines[1].value).toBeCloseTo(6000, 0);
    expect(lines[0].label).toBe('AVG ' + lvl2[0]);       // la etiqueta nombra su grupo
    expect(lines[1].label).toBe('AVG ' + lvl2[1]);
    expect(lines[0].suffix || '').toBe('');              // la primera es la referencia
    expect(lines[1].suffix).toBe('+20%');                // 5000 → 6000
  });

  test('sin split queda una sola media, la de todos los datos juntos', async ({ page }) => {
    await mount(page, { names: SHORT, split: false });
    const { lines } = await readChart(page);

    expect(lines).toHaveLength(1);
    expect(lines[0].value).toBeCloseTo(5500, 0);  // media de los 6 valores
    expect(lines[0].grpKey).toBeNull();
  });

  test('nombres cortos: la tira de grupo los deja derechos', async ({ page }) => {
    await mount(page, { names: SHORT, split: false });
    const { tier } = await readChart(page);
    expect(tier).not.toBeNull();
    expect(tier.rot).toBe(0);
    expect(tier.h).toBe(26);
  });

  test('nombres largos: se inclinan y la tira crece para que entren', async ({ page }) => {
    await mount(page, { names: LONG, split: false });
    const { tier } = await readChart(page);
    expect(tier).not.toBeNull();
    expect(tier.rot).toBeLessThan(0);            // inclinados
    expect(tier.h).toBeGreaterThan(26);          // con su alto reservado
    expect(tier.h).toBeLessThanOrEqual(96);      // y con techo
  });
});



test('la X de borrar la línea de referencia se ve sin scrollear y la borra', async ({ page }) => {
  await mount(page, { names: SHORT, split: true });
  await page.evaluate(() => window.GpBuilder.openForEdit(document.querySelector('.gp-c[data-card-id="card-1"]')));
  await page.locator('#gpbPanel [data-tab="style"]').first().click();

  const del = page.locator('#gpbRefLines [data-rl-del]').first();
  await expect(del).toBeVisible();
  // Arriba del todo de su fila: la X vive en el encabezado, no al final de cinco renglones.
  const gap = await page.evaluate(() => {
    const row = document.querySelector('#gpbRefLines [data-rl-idx]');
    const d = row.querySelector('[data-rl-del]');
    return d.getBoundingClientRect().top - row.getBoundingClientRect().top;
  });
  expect(gap).toBeLessThan(30);

  await del.click();
  await expect(page.locator('#gpbRefLines [data-rl-idx]')).toHaveCount(0);
  expect(await page.evaluate(() => (window.GpBuilder.currentConfig()?.referenceLines || []).length)).toBe(0);
});
