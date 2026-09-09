// @ts-check
// Corte de comparabilidad del club (club_gps_settings.gps_valid_from).
//
// MOI Kompong DEWA cambió el 19/10/2025 de umbrales fijos de velocidad a % de la Vmax de cada
// jugador. El HSR de antes y el de después miden cosas distintas —2,4× de diferencia en el
// promedio, con la distancia total igual— y no se pueden convertir sin la señal cruda, que se
// perdió. Mezclarlos en un gráfico muestra un escalón que parece una caída de rendimiento.
//
// El corte NO borra: las filas siguen en la base, sólo dejan de entrar al análisis.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const CORTE = daysAgo(20);
// Dos sesiones ANTES del corte (metodología vieja, valores inflados) y dos después.
const SES = [
  { id: 'v1', date: daysAgo(40), td: 9000 },
  { id: 'v2', date: daysAgo(30), td: 9000 },
  { id: 'n1', date: daysAgo(10), td: 4000 },
  { id: 'n2', date: daysAgo(5),  td: 4000 },
];
const SESSIONS = SES.map(s => ({ id: s.id, club_id: CLUB_ID, session_date: s.date, session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false }));
const PLAYERS = [{ id: 'p1', club_id: CLUB_ID, first_name: 'A', last_name: 'Uno', number: 5, position: 'CB', positions: ['CB'], status: 'active' }];
const REPORTS = SES.map(s => ({
  player_id: 'p1', session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: s.td, high_speed_distance: 500, very_high_speed_distance: 100, sprint_distance: 50,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: 'A', last_name: 'Uno', number: 5, position: 'CB', positions: ['CB'] },
  training_sessions: { session_date: s.date, session_attributes: null, microcycle_id: null, team_id: null,
    session_type: 'training', match_day_offset: null, season_id: null },
}));

const CARD = [{ id: 'card-vf', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Por día', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'session_date' }],
  range: { type: 'season' }, style: { color: '#15803D' } } }];

async function open(page, validFrom) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => {
    const cfg = { club_id: CLUB_ID, baseline_n: 5, gps_builder_enabled: true, gps_valid_from: validFrom };
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? cfg : [cfg] });
  });
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  // El mock respeta el filtro de fecha, que es justo lo que se está probando.
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const url = new URL(r.request().url());
    const gte = (url.searchParams.get('session_date') || '').match(/^gte\.(.+)$/);
    const acc = r.request().headers()['accept'] || '';
    let rows = SESSIONS;
    for (const [k, v] of url.searchParams.entries()) {
      const m = (k === 'session_date') && String(v).match(/^gte\.(.+)$/);
      if (m) rows = rows.filter(s => s.session_date >= m[1]);
    }
    if (acc.includes('object') || /[?&]limit=1(&|$)/.test(url.href)) {
      const ord = [...rows].sort((a, b) => b.session_date.localeCompare(a.session_date));
      return r.fulfill({ json: ord[0] || null });
    }
    return r.fulfill({ json: rows });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  // Igual que el de sesiones: respeta el `in(session_id)` que arma el resolver, que es
  // por donde el corte llega a las filas.
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    const url = new URL(r.request().url());
    const m = (url.searchParams.get('session_id') || '').match(/^in\.\((.*)\)$/);
    const ok = m ? new Set(m[1].split(',').map(v => v.replace(/^"|"$/g, ''))) : null;
    return r.fulfill({ json: ok ? REPORTS.filter(x => ok.has(x.session_id)) : REPORTS });
  });
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
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-vf"] canvas').length
  ), { timeout: 45_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-vf"] canvas');
    return window.Chart.getChart(cv).data.labels.map(String);
  });
}

test.describe('GPS · corte de comparabilidad', () => {
  test('sin corte, entran todas las sesiones', async ({ page }) => {
    const labels = await open(page, null);
    expect(labels).toHaveLength(4);
  });

  test('con el corte puesto, lo anterior no entra al análisis', async ({ page }) => {
    const labels = await open(page, CORTE);
    expect(labels).toHaveLength(2);                 // sólo las dos posteriores
    expect(labels.every(l => l >= CORTE)).toBe(true);
  });
});
