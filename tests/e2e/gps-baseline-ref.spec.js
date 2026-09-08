// @ts-check
// La REFERENCIA DE PARTIDO (gps-baseline.js) es el 100% de media app: gauges, top-up y la card
// «% del partido». No la cubría ningún test, y el criterio se había separado entre pantallas.
// Acá se ejercita el motor directo, sin pasar por ninguna card.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'T', last_name: 'U', full_name: 'T U', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };

// Cinco partidos, de más nuevo a más viejo. El más alto es también en el que entró 15 minutos:
// así se ve si los minutos mínimos lo sacan (y el mejor pasa a ser otro).
const MATCHES = [
  { date: '2026-05-10', td: 6000,  min: 90 },
  { date: '2026-04-10', td: 7000,  min: 90 },
  { date: '2026-03-10', td: 8000,  min: 90 },
  { date: '2026-02-10', td: 9000,  min: 90 },
  { date: '2026-01-10', td: 10000, min: 15 },
];
const SESSIONS = MATCHES.map((m, i) => ({ id: 's' + i, club_id: CLUB_ID, session_date: m.date, session_type: 'match', team_id: null, microcycle_id: null, is_historical: false }));
const REPORTS  = MATCHES.map((m, i) => ({
  id: 'r' + i, session_id: 's' + i, player_id: 'p1', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: m.td, time_played: m.min,
  training_sessions: { session_date: m.date },
}));

/** Abre la página y deja el motor listo, con los ajustes de club que se le pasen. */
async function open(page, settings = {}, { topupDay = null } = {}) {
  const cfg = Object.assign({ club_id: CLUB_ID, baseline_n: 3, baseline_mode: 'personal', active_metrics: null,
    acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true,
    ref_min_minutes: 0, ref_from_date: null }, settings);
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', user: { id: 'user-1', email: 't@t.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [cfg] }));
  await page.route(`${SB}/rest/v1/calendar_events**`, r => r.fulfill({ json: [] }));
  // Períodos: por defecto no hay ninguno etiquetado. Con `topupDay`, ese partido fue para el
  // jugador SÓLO top-up — no tiene ni un período con el equipo.
  await page.route(`${SB}/rest/v1/gps_period_reports**`, r => {
    if (!topupDay) return r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } });
    const url = new URL(r.request().url());
    const sel = url.searchParams.get('select') || '';
    // 1) «¿hay períodos fuera del equipo?» → sí (head + count).
    if (r.request().method() === 'HEAD' || sel === 'id') {
      // Content-Range lleva el conteo, y sin exponerlo el navegador no deja leerlo: la llamada
      // devolvería «no hay períodos» y el recorte no se probaría nunca.
      return r.fulfill({ status: 200, body: '[]', headers: {
        'Content-Range': '0-0/1', 'Content-Type': 'application/json',
        'Access-Control-Expose-Headers': 'Content-Range, content-range',
        'Access-Control-Allow-Origin': '*',
      } });
    }
    // 2) qué pares (sesión, jugador) están tocados por un contexto que no se pidió.
    if (sel === 'session_id,player_id') {
      return r.fulfill({ json: [{ session_id: topupDay, player_id: 'p1' }] });
    }
    // 3) sus períodos DEL EQUIPO: ninguno ⇒ ese día no fue partido suyo y la fila se cae.
    return r.fulfill({ json: [] });
  });
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  // El mock filtra por fecha como lo haría el servidor: si devolviera siempre las cinco filas,
  // el test no podría distinguir un motor que respeta la fecha de corte de uno que la ignora.
  await page.route(`${SB}/rest/v1/gps_reports**`, r => {
    const url = new URL(r.request().url());
    const inArg = url.searchParams.get('training_sessions.session_date') || '';
    const m = inArg.match(/^in\.\((.*)\)$/);
    const rows = m
      ? REPORTS.filter(x => m[1].split(',').map(d => d.replace(/^"|"$/g, '')).includes(x.training_sessions.session_date))
      : REPORTS;
    return r.fulfill({ json: rows });
  });
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForFunction(() => typeof window.getMatchBaselineBatch === 'function', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
}

/** Referencia de p1 para total_distance con las opciones dadas. */
const ref = (page, opts = {}) => page.evaluate(async ([cid, o]) => {
  window.invalidateBaselineCache?.();
  window.invalidateSettingsCache?.();
  window.invalidateMatchDatesCache?.();
  const r = await window.getMatchBaselineBatch(['p1'], 'total_distance', cid, o);
  return r.p1 || null;
}, [CLUB_ID, opts]);

test.describe('GPS · referencia de partido', () => {
  test.describe.configure({ timeout: 60_000 });

  test('por defecto: media de los N mejores, con el N del club', async ({ page }) => {
    await open(page);                       // baseline_n = 3
    const r = await ref(page);
    expect(r.baseline).toBe(9000);          // (10000 + 9000 + 8000) / 3
    expect(r.count).toBe(3);
  });

  test('media móvil: los N más recientes, no los más altos', async ({ page }) => {
    await open(page);
    const r = await ref(page, { mode: 'recent' });
    expect(r.baseline).toBe(7000);          // (6000 + 7000 + 8000) / 3 — los tres últimos por fecha
  });

  test('partido típico: entran todos los partidos', async ({ page }) => {
    await open(page);
    const r = await ref(page, { mode: 'avg' });
    expect(r.baseline).toBe(8000);          // (6+7+8+9+10) mil / 5
    expect(r.count).toBe(5);
  });

  test('minutos mínimos del club: un partido de 15 minutos no es referencia', async ({ page }) => {
    await open(page, { ref_min_minutes: 30 });
    const r = await ref(page);
    // Sin el de 10.000 (jugó 15'), los tres mejores son 9.000, 8.000 y 7.000.
    expect(r.baseline).toBe(8000);
  });

  test('fecha de corte del club: antes de ella no cuenta', async ({ page }) => {
    await open(page, { ref_from_date: '2026-03-01' });
    const r = await ref(page);
    // Quedan 8.000, 7.000 y 6.000.
    expect(r.baseline).toBe(7000);
    expect(r.count).toBe(3);
  });

  test('sin partidos suficientes no inventa una referencia', async ({ page }) => {
    await open(page, { ref_from_date: '2026-05-01' });   // queda uno solo
    const r = await ref(page);
    expect(r.baseline).toBeNull();
    expect(r.source).toBe('insufficient_data');
  });

  // Lo que pidió el usuario: los extras no cuentan como partido. El día más alto del jugador fue
  // en realidad sólo top-up (entró al banco y corrió aparte): no es una referencia de partido.
  test('un día de sólo top-up no cuenta como partido', async ({ page }) => {
    await open(page, {}, { topupDay: 's4' });   // s4 = el partido de 10.000
    const r = await ref(page);
    // Sin ese día, los tres mejores son 9.000, 8.000 y 7.000.
    expect(r.baseline).toBe(8000);
    expect(r.count).toBe(3);
  });
});
