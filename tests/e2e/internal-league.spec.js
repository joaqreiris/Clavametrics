// @ts-check
// Liga interna — la página de la tabla (Internal League.html).
//
// Lo que se verifica desde afuera: que la página solo exista si el club tiene el
// flag, que la tabla ordene por puntos POR TAREA, que la línea de corte separe a
// los que comen de los que pagan sin solaparse, y que el que no llegó al mínimo
// de participación quede fuera del ranking en vez de hundido al fondo.
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB as CLUB_ROW, injectSession } from './_shared.js';

const CLUB = 'club-1', TEAM = 'team-1', SEASON = 'season-1';

// PostgREST devuelve un OBJETO (no un array) cuando la consulta usa .single() /
// .maybeSingle(): lo pide con el Accept `application/vnd.pgrst.object+json`. Sin
// respetar eso, `profile.club_id` queda undefined, la página se queda sin club y
// termina en el asistente de alta en vez de en la tabla.
function reply(route, rows) {
  const accept = route.request().headers()['accept'] || '';
  const one = accept.includes('vnd.pgrst.object');
  return route.fulfill({ json: one ? (rows[0] || null) : rows });
}

// 12 jugadores. p1..p10 juegan las 10 tareas; p11 juega 10 pero flojo; p12 se
// lesionó y jugó 2 (no debería clasificar aunque las ganó todas).
const PLAYERS = Array.from({ length: 12 }, (_, i) => ({
  id: 'p' + (i + 1), club_id: CLUB, first_name: 'Jug', last_name: 'Ador' + (i + 1),
  number: i + 1, position: i === 0 ? 'GK' : 'CM', status: 'active',
}));

const EVENTS = Array.from({ length: 10 }, (_, i) => ({
  id: 'e' + (i + 1), season_id: SEASON,
  event_date: `2026-08-${String(i + 1).padStart(2, '0')}`,
  session_exercise_id: 'se' + (i + 1), title: 'Tarea ' + (i + 1), groups: [],
}));

// Cada jugador gana tantas tareas como su índice inverso: p1 el mejor, p11 el peor.
const RESULTS = [];
EVENTS.forEach((ev, ei) => {
  for (let i = 1; i <= 11; i++) {
    const wins = 11 - i;                       // p1 gana 10, p2 gana 9, … p11 gana 0
    const outcome = ei < wins ? 'win' : 'loss';
    RESULTS.push({
      event_id: ev.id, player_id: 'p' + i, group_id: 'g1', outcome,
      points: outcome === 'win' ? 3 : 0, goals_against: null,
      is_keeper: i === 1, is_manual: false, season_id: SEASON,
    });
  }
  if (ei < 2) RESULTS.push({                    // p12: solo 2 tareas, ganadas
    event_id: ev.id, player_id: 'p12', group_id: 'g1', outcome: 'win',
    points: 3, goals_against: null, is_keeper: false, is_manual: false, season_id: SEASON,
  });
});

const SEASON_ROW = {
  id: SEASON, club_id: CLUB, team_id: TEAM, name: 'Agosto 2026',
  start_date: '2026-08-01', end_date: '2026-08-31', status: 'open',
  min_participation: 0.60, cut_size: 3, points_win: 3, points_draw: 1, points_loss: 0,
  share_token: 'tok', shared: false, closed_at: null,
};

async function mockLeague(page, opts = {}) {
  const {
    flagOn = true,
    seasons = [SEASON_ROW],
    events = EVENTS,
    results = RESULTS,
  } = opts;
  await page.route(`${SB}/auth/v1/**`, route =>
    route.fulfill({ json: { id: 'user-1', email: 'test@test.com', aud: 'authenticated', role: 'authenticated' } }));
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') return route.fulfill({ json: {} });
    if (url.includes('/profiles'))                 return reply(route, [{ ...PROFILE, onboarded: true, timezone: 'Europe/Madrid' }]);
    if (url.includes('/clubs'))                    return reply(route, [{ ...CLUB_ROW, onboarded_at: '2026-01-01T00:00:00Z' }]);
    if (url.includes('/club_feature_flags')) {
      return reply(route, flagOn
        ? [{ flag_key: 'internal_league', enabled: true, config: { points: { win: 3, draw: 1, loss: 0 }, min_participation: 0.6 } }]
        : []);
    }
    if (url.includes('/teams'))                    return reply(route, [{ id: TEAM, name: 'Primer equipo', club_id: CLUB }]);
    if (url.includes('/players'))                  return reply(route, PLAYERS);
    if (url.includes('/internal_league_seasons'))  return reply(route, seasons);
    if (url.includes('/internal_league_events'))   return reply(route, events);
    if (url.includes('/internal_league_results'))  return reply(route, results);
    return reply(route, []);
  });
}

async function goto(page, opts = {}) {
  await injectSession(page);
  await mockLeague(page, opts);
  await page.goto('/Internal%20League.html');
}

test.describe('Liga interna — la tabla', () => {
  test('la tabla se dibuja con una fila por jugador con puntos', async ({ page }) => {
    await goto(page);
    await page.waitForSelector('#lgTable .lg-t tbody tr', { timeout: 10_000 });
    // 11 clasificados (p1..p11 jugaron las 10) + las filas de corte.
    await expect(page.locator('#lgTable .lg-t tbody tr:not(.cut)').first()).toBeVisible();
    const names = await page.locator('#lgTable .lg-t tbody tr:not(.cut) .nm').allTextContents();
    expect(names.length).toBe(11);
    expect(names[0]).toContain('Ador1');          // el que más ganó, primero
    expect(names[names.length - 1]).toContain('Ador11');
  });

  test('marca a los que comen y a los que pagan sin que nadie quede en los dos lados', async ({ page }) => {
    await goto(page);
    await page.waitForSelector('#lgTable .lg-t tbody tr', { timeout: 10_000 });
    const eat = await page.locator('#lgTable tr.eat .nm').allTextContents();
    const pay = await page.locator('#lgTable tr.pay .nm').allTextContents();
    expect(eat.length).toBe(3);                   // cut_size = 3
    expect(pay.length).toBe(3);
    expect(eat.some(n => pay.includes(n))).toBe(false);
    expect(eat[0]).toContain('Ador1');
    expect(pay[pay.length - 1]).toContain('Ador11');
  });

  test('el lesionado que ganó todo queda sin clasificar, no último', async ({ page }) => {
    await goto(page);
    await page.waitForSelector('#lgTable .lg-t tbody tr', { timeout: 10_000 });
    // No está en la tabla principal…
    const ranked = await page.locator('#lgTable .lg-t tbody tr:not(.cut) .nm').allTextContents();
    expect(ranked.some(n => n.includes('Ador12'))).toBe(false);
    // …sino en el bloque aparte, y sin marca de que paga.
    await expect(page.locator('#lgUnrankedCard')).toBeVisible();
    const un = await page.locator('#lgUnranked .nm').allTextContents();
    expect(un.some(n => n.includes('Ador12'))).toBe(true);
  });

  test('el arquero se ve marcado como tal', async ({ page }) => {
    await goto(page);
    await page.waitForSelector('#lgTable .lg-t tbody tr', { timeout: 10_000 });
    await expect(page.locator('#lgTable .lg-t tbody tr').first().locator('.gk')).toBeVisible();
  });

  test('sin resultados en el mes muestra el vacío, no una tabla rota', async ({ page }) => {
    await goto(page, { results: [], events: [] });
    await page.waitForSelector('.lg-empty', { timeout: 10_000 });
    await expect(page.locator('.lg-empty')).toBeVisible();
    await expect(page.locator('#lgTable .lg-t')).toHaveCount(0);
  });

  test('el mes cerrado se muestra como cerrado y esconde el botón de cerrar', async ({ page }) => {
    await goto(page, { seasons: [{ ...SEASON_ROW, status: 'closed', closed_at: '2026-09-01T10:00:00Z' }] });
    await page.waitForSelector('#lgState', { timeout: 10_000 });
    await expect(page.locator('#lgState')).toHaveClass(/closed/);
    await expect(page.locator('#lgCloseBtn')).toBeHidden();
  });
});

test.describe('Liga interna — el flag', () => {
  test('sin el flag del club la página no se abre', async ({ page }) => {
    await goto(page, { flagOn: false });
    await page.waitForURL(/\/Hub(\.html)?$/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/Hub(\.html)?$/);
  });
});
