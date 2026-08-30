// @ts-check
// Informe PDF de GPS Analysis (assets/pages/gps-export.js).
//
// Lo que importa verificar es la HOJA que se captura, no el binario del PDF: que lleve el
// encabezado (escudo · título · fecha), los filtros en texto, el resumen, y SOLO las cards
// elegidas — con sus gráficos convertidos a imagen y sin un solo botón de la interfaz.
//
// Reusa el andamiaje de gps-bars-axis.spec.js: una card de builder real montada desde
// dashboard_cards mockeado.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'MOI Kompong DEWA', primary_color: '#3B82F6', logo_url: null };

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const SESSIONS = [
  { id: 's-a', club_id: CLUB_ID, session_date: daysAgo(9), session_type: 'training', team_id: null, microcycle_id: 'mc-a', is_historical: false },
  { id: 's-b', club_id: CLUB_ID, session_date: daysAgo(2), session_type: 'training', team_id: null, microcycle_id: 'mc-b', is_historical: false },
];
const MCS = [
  { id: 'mc-a', club_id: CLUB_ID, name: 'MC 03', start_date: daysAgo(14), end_date: daysAgo(8), match_date: daysAgo(8), rival: 'A', home_away: 'home' },
  { id: 'mc-b', club_id: CLUB_ID, name: 'MC 04', start_date: daysAgo(7), end_date: daysAgo(1), match_date: daysAgo(1), rival: 'B', home_away: 'away' },
];
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Ana',  last_name: 'Alfa',  number: 4, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Beto', last_name: 'Bravo', number: 5, position: 'CB', positions: ['CB'], status: 'active' },
];
const REPORTS = SESSIONS.flatMap((s, si) => PLAYERS.map((p, pi) => ({
  player_id: p.id, session_id: s.id, club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000 + pi * 1000 + si * 500, high_speed_distance: 500, very_high_speed_distance: null,
  sprint_distance: null, sprint_count: 5, accelerations: 20, decelerations: 18, max_speed: 30, avg_speed: 6,
  player_load: 300, hmld: null, time_played: 90, distance_per_minute: 60,
  players: { first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: s.session_date, session_attributes: null, microcycle_id: s.microcycle_id, team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
})));

const CARDS = [
  { id: 'card-1', position: 0, source: 'builder', size: 'lg', config: {
    schema: 'gp.card/v1', title: 'Total Distance', viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
    range: { type: 'last30' }, style: { color: '#7C3AED' } } },
  { id: 'card-2', position: 1, source: 'builder', size: 'md', config: {
    schema: 'gp.card/v1', title: 'Player Load', viz: 'bars', scope: { level: 'squad' },
    metrics: [{ id: 'player_load', agg: 'avg' }], dimensions: [{ id: 'player' }],
    range: { type: 'last30' }, style: { color: '#2563EB' } } },
];

async function openDashboard(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
    { key: 'player_load', label: 'Player Load', unit: 'AU', kind: 'accum', category: 'load', is_core: true, decimals: 0, display_order: 2, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/microcycles**`, r => r.fulfill({ json: MCS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: CARDS }));

  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id] canvas').length
  ), { timeout: 30_000, message: 'las cards nunca se dibujaron' }).toBeGreaterThan(0);
}

/** Abre el modal y arma la hoja con las opciones dadas, sin llegar a generar el PDF. */
async function buildSheet(page, { uncheckFirst = false, note = '', intro = '' } = {}) {
  await page.locator('#gpExportBtn').click();
  await expect(page.locator('#gxBody')).toBeVisible();
  if (intro) await page.locator('#gxIntro').fill(intro);
  if (note)  await page.locator('[data-gx-note="1"]').fill(note);
  if (uncheckFirst) await page.locator('[data-gx-on="0"]').uncheck();
  // Se arma la hoja con las mismas opciones que usaría el PDF, sin invocar html2canvas.
  return page.evaluate(() => {
    const b = document.getElementById('gxBody');
    const cards = [...document.querySelectorAll('.gp-view.is-on .gp-c')].filter(c => c.offsetParent !== null);
    const opts = {
      title: b.querySelector('#gxTitle').value, dateISO: b.querySelector('#gxDate').value,
      dateLabel: '30 de agosto de 2026', intro: b.querySelector('#gxIntro').value.trim(),
      crest: '', clubName: 'MOI Kompong DEWA', showFilters: true, orientation: 'portrait',
      subtitle: 'First team',
      cards: cards.map((el, i) => ({ el, note: (b.querySelector(`[data-gx-note="${i}"]`) || {}).value || '' }))
        .filter((_, i) => b.querySelector(`[data-gx-on="${i}"]`).checked),
    };
    window.__gxSheet = window.__gxBuild(opts);
    const sheet = window.__gxSheet;
    return {
      title: sheet.querySelector('.gps-hd-c h1').textContent,
      subtitle: sheet.querySelector('.gps-hd-c .gps-sub').textContent,
      date: sheet.querySelector('.gps-hd-r .gps-dv').textContent,
      club: sheet.querySelector('.gps-club').textContent,
      intro: sheet.querySelector('.gps-intro')?.textContent || null,
      cards: sheet.querySelectorAll('.gp-c').length,
      canvases: sheet.querySelectorAll('canvas').length,
      imgs: sheet.querySelectorAll('.gp-c img').length,
      buttons: sheet.querySelectorAll('button').length,
      notes: [...sheet.querySelectorAll('.gps-note')].map(n => n.textContent),
      filters: sheet.querySelector('.gps-filters')?.textContent || null,
      sidebar: sheet.querySelectorAll('aside, .gp-fbar, #gpFilterBar').length,
      onScreen: cards.length,
      checked: b.querySelectorAll('[data-gx-on]:checked').length,
      // Las cards que siguen cargando o no tienen datos se listan pero vienen desmarcadas.
      noData: b.querySelectorAll('.gx-nod').length,
    };
  });
}

test.describe('GPS · informe PDF', () => {
  test('la hoja lleva encabezado, cards y ningún resto de la interfaz', async ({ page }) => {
    await openDashboard(page);
    const s = await buildSheet(page, { intro: 'Comparativa entre microciclo 3 y 4.', note: 'Carga estable.' });

    expect(s.title).toBe('Player Week Report');         // título por defecto = el dashboard
    expect(s.subtitle).toBe('First team');              // equipo (+ rango) van abajo, sin repetir
    expect(s.title).not.toMatch(/loading/i);            // nunca el estado de carga del switcher
    expect(s.date).toBeTruthy();
    expect(s.club).toBe('MOI Kompong DEWA');
    expect(s.intro).toContain('microciclo 3 y 4');
    expect(s.cards).toBe(s.checked);                    // exactamente las cards marcadas
    expect(s.noData).toBeGreaterThan(0);                // hay alguna sin datos…
    expect(s.checked).toBe(s.onScreen - s.noData);      // …y viene desmarcada, para no imprimir un spinner
    expect(s.canvases).toBe(0);                         // los gráficos van como imagen…
    expect(s.imgs).toBeGreaterThan(0);                  // …ya pintada
    expect(s.buttons).toBe(0);                          // sin un solo botón de la interfaz
    expect(s.sidebar).toBe(0);                          // ni barra lateral ni filtros interactivos
    expect(s.notes).toEqual(['Carga estable.']);        // la nota va bajo SU card
  });

  test('se puede dejar una card afuera del informe', async ({ page }) => {
    await openDashboard(page);
    const s = await buildSheet(page, { uncheckFirst: true });
    expect(s.cards).toBe(s.checked);
  });

  test('el botón Exportar PDF genera y descarga el archivo', async ({ page }) => {
    await openDashboard(page);
    await page.locator('#gpExportBtn').click();
    await expect(page.locator('#gxBody')).toBeVisible();
    await page.locator('#gxTitle').fill('Informe de prueba');
    await page.locator('#gxIntro').fill('Comparativa entre microciclo 3 y 4.');

    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.locator('#gxPdf').click(),
    ]);
    // Nombre derivado del título + la fecha del informe, y el modal se cierra al terminar.
    expect(dl.suggestedFilename()).toMatch(/informe-de-prueba\.pdf$/);
    // El informe se compone vectorial (texto + la imagen de cada gráfico), así que pesa poco:
    // lo que hay que verificar es que sea un PDF válido y que haya dibujado TODAS las cards.
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(await dl.path());
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const last = await page.evaluate(() => window.__gxLast);
    expect(last.pages).toBeGreaterThan(0);
    expect(last.cards).toBe(6);                    // las 6 marcadas (la 7ª va sin datos)
    expect(last.kinds.chart).toBeGreaterThan(0);   // y los gráficos entraron como tales
    await expect(page.locator('#gxBody')).toHaveCount(0);
    // La hoja se desmonta: no queda basura en el DOM de la página.
    expect(await page.evaluate(() => document.getElementById('gpPrintSheet')?.innerHTML || '')).toBe('');
  });
});
