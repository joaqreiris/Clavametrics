// @ts-check
// RED DE SEGURIDAD del arranque del dashboard GPS.
//
// El arranque monta las CINCO vistas fijas (ind/grp/mind/mgrp/mc) antes de mostrar nada, y las
// coordenadas guardadas de cada card se aplican en ese montaje: gp-tabs.js mete las cards en el
// grid al renderizar la pestaña, pero SIN coords — quien se las pone es _mountSavedBuilderCards.
// Por eso cualquier cambio que difiera, paralelice o reordene ese arranque puede dejar una vista
// con sus cards en el sitio equivocado, o con los filtros de otra pestaña.
//
// Estos dos tests son la línea que ese trabajo no puede cruzar: posiciones guardadas y filtros por
// pestaña, comprobados DESPUÉS de cambiar de vista.

import { test, expect } from '@playwright/test';
import { SB, injectSession, seedGpIds } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// Un dashboard por vista fija, con su report_type: así los busca loadCardsForView.
const DASHES = [
  { id: 'd-ind',  club_id: CLUB_ID, report_type: 'ind',  name: 'Player Week',      scope: 'squad', is_shared: true, created_by: null },
  { id: 'd-grp',  club_id: CLUB_ID, report_type: 'grp',  name: 'Session Control',  scope: 'squad', is_shared: true, created_by: null },
  { id: 'd-mind', club_id: CLUB_ID, report_type: 'mind', name: 'Match Perf',       scope: 'squad', is_shared: true, created_by: null },
  { id: 'd-mgrp', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring',  scope: 'squad', is_shared: true, created_by: null },
  { id: 'd-mc',   club_id: CLUB_ID, report_type: 'mc',   name: 'MC Compare',       scope: 'squad', is_shared: true, created_by: null },
];
// dashboard_id con el que cada vista guarda su layout (_DASHBOARD_IDS en gps-analysis.js).
const LAYOUT_ID = { ind: 'player_week', grp: 'session_control', mind: 'match_performance', mgrp: 'load_monitoring', mc: 'microcycle_compare' };

const cardId = (v) => `${v === 'ind' ? '10000000' : '40000000'}-2222-4222-8222-222222222222`;
const mkCard = (view) => ({
  id: cardId(view), position: 0, source: 'builder', size: 'md',
  config: { schema: 'gp.card/v1', title: 'Card ' + view, viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
    range: { type: 'last30' }, style: { color: '#2563EB', size: 'md' } },
});
// Coordenadas DISTINTAS por vista: si el montaje se cruza de vista, los números no cuadran.
const COORDS = { ind: { x: 0, y: 0, w: 4, h: 6 }, mgrp: { x: 5, y: 3, w: 7, h: 9 } };

const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(4), session_type: 'training', team_id: null, microcycle_id: null, is_historical: false, match_day_offset: -3 }];
const PLAYERS = [0, 1, 2].map(i => ({ id: 'p' + i, club_id: CLUB_ID, first_name: 'N' + i, last_name: 'Ape' + i, number: 2 + i, position: 'CB', positions: ['CB'], status: 'active' }));
const REPORTS = PLAYERS.map((p, i) => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 6000 + i * 800, high_speed_distance: 300, very_high_speed_distance: 90, sprint_distance: 10,
  sprint_count: 4, accelerations: 20, decelerations: 18, max_speed: 28, avg_speed: 6,
  player_load: 300, hmld: 400, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null, team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));

async function montar(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  // .single() pide UN objeto: devolver un array deja el club en null y la página carga a medias.
  const uno = (obj) => (r) => r.fulfill({ json: (r.request().headers()['accept'] || '').includes('object') ? obj : [obj] });
  await page.route(`${SB}/rest/v1/profiles**`, uno(PROFILE));
  await page.route(`${SB}/rest/v1/clubs**`, uno(CLUB));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));

  // Cada vista recibe SU dashboard, según el report_type que pida loadCardsForView.
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const rt = (r.request().url().match(/report_type=eq\.([^&]+)/) || [])[1];
    const sel = rt ? DASHES.filter(d => d.report_type === rt) : DASHES;
    const acc = (r.request().headers()['accept'] || '').includes('object');
    return r.fulfill({ json: acc ? (sel[0] || null) : sel });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => {
    const did = (r.request().url().match(/dashboard_id=eq\.([^&]+)/) || [])[1] || '';
    const view = did.replace('d-', '');
    return r.fulfill({ json: (view === 'ind' || view === 'mgrp') ? [mkCard(view)] : [] });
  });
  // Layouts YA guardados: es lo que el arranque tiene que respetar.
  await page.route(`${SB}/rest/v1/gps_dashboard_layouts**`, r => {
    const req = r.request();
    const acc = (req.headers()['accept'] || '').includes('object');
    if (req.method() !== 'GET') return r.fulfill({ json: acc ? {} : [{}] });
    const did = (new URL(req.url()).searchParams.get('dashboard_id') || '').replace('eq.', '');
    const view = Object.keys(LAYOUT_ID).find(v => LAYOUT_ID[v] === did);
    const fila = (view && COORDS[view])
      ? { user_id: 'user-1', club_id: CLUB_ID, dashboard_id: did, layout: [{ card_id: cardId(view), size: 'md', config: {}, ...COORDS[view] }] }
      : null;
    return r.fulfill({ json: acc ? fila : (fila ? [fila] : []) });
  });

  await injectSession(page);
  await seedGpIds(page, CLUB_ID, 'user-1');
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
}

/** Coordenadas con las que quedó una card, leídas del DOM de SU vista. */
const coordsDe = (page, view, id) => page.evaluate(([v, cid]) => {
  const el = document.querySelector(`.gp-view[data-view="${v}"] .gp-c[data-card-id="${cid}"]`);
  return el ? { x: +el.dataset.x, y: +el.dataset.y, w: +el.dataset.w, h: +el.dataset.h } : null;
}, [view, id]);

test('cambiar de pestaña deja cada card en el sitio que tenía guardado', async ({ page }) => {
  await montar(page);
  // La card de la vista de arranque ya tiene que estar en su sitio.
  await expect.poll(() => coordsDe(page, 'ind', cardId('ind')), { timeout: 20_000 }).toEqual(COORDS.ind);

  // Y la de otra pestaña también, al llegar a ella: son coordenadas distintas a propósito, así que
  // un montaje que se cruce de vista (o que pierda el layout) no puede dar este resultado.
  await page.locator('[data-view="mgrp"]').first().click();
  await expect(page.locator('.gp-view[data-view="mgrp"].is-on')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => coordsDe(page, 'mgrp', cardId('mgrp')), { timeout: 20_000 }).toEqual(COORDS.mgrp);

  // Volver no puede descolocar la primera.
  await page.locator('[data-view="ind"]').first().click();
  await expect(page.locator('.gp-view[data-view="ind"].is-on')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => coordsDe(page, 'ind', cardId('ind')), { timeout: 10_000 }).toEqual(COORDS.ind);
});

test('los filtros aplicados sobreviven al cambio de pestaña', async ({ page }) => {
  await montar(page);
  await page.waitForFunction(() => !!window.gpFilterBar?.getState, null, { timeout: 20_000 });
  // Esperar a que la barra haya cargado y restaurado: antes de eso, persist() no escribe.
  await page.waitForFunction(() => window.gpFilterBar.getState()?.restored === true, null, { timeout: 25_000 });

  const antes = await page.evaluate(() => JSON.stringify(window.gpFilterBar.getState()?.sel || {}));
  await page.locator('[data-view="mgrp"]').first().click();
  await expect(page.locator('.gp-view[data-view="mgrp"].is-on')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-view="ind"]').first().click();
  await expect(page.locator('.gp-view[data-view="ind"].is-on')).toBeVisible({ timeout: 15_000 });

  // El ida y vuelta no puede haber vaciado ni mezclado la selección de la pestaña.
  await expect.poll(
    () => page.evaluate(() => JSON.stringify(window.gpFilterBar.getState()?.sel || {})),
    { timeout: 15_000 },
  ).toBe(antes);
});
