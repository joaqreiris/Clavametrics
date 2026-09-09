// @ts-check
// Match Reports · las dos cards que llena el export de equipo de Wyscout.
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, injectSession, mockBase } from './_shared.js';

/* El calendario guarda el tipo en minúscula. El mock respeta ese filtro a propósito:
   si alguien vuelve a consultar 'Match', esta sesión no se devuelve y los tests caen. */
const SESSION_M = {
  id: 'sess-m1', club_id: 'club-1', title: 'Angkor Tiger (A)',
  session_type: 'match', session_date: '2026-09-05', duration: 93, notes: '',
};

const RESULT = {
  id: 'mres-3', club_id: 'club-1', team_id: null, session_id: 'sess-m1',
  match_date: '2026-09-05', competition: 'Cambodian Premier League',
  opponent: 'Angkor Tiger', home_away: 'away',
  score_for: 0, score_against: 0, possession: 62, formation: '4-3-3',
  venue: '', notes: '', created_by: 'user-1', created_at: '2026-09-05T00:00:00Z',
};

/* Los números son los del archivo real de Kompong Dewa; ni uno inventado. */
const US = {
  possession_pct: 62.14, xg: 0.54, shots: 12, shots_on_target: 6,
  passes: 361, passes_accurate: 293, passes_pct: 81.16,
  progressive_passes: 70, progressive_passes_accurate: 49, progressive_passes_pct: 70,
  passes_to_final_third: 53, passes_to_final_third_accurate: 31,
  penalty_area_entries: 21, penalty_area_entries_runs: 9, penalty_area_entries_crosses: 4,
  touches_in_penalty_area: 14, average_passes_per_possession: 3.54,
  recoveries: 65, recoveries_low: 36, recoveries_medium: 21, recoveries_high: 8,
  losses: 107, losses_low: 21, losses_medium: 34, losses_high: 52,
  duels: 194, duels_won: 100, duels_pct: 51.55,
  positional_attacks: 27, positional_attacks_with_shots: 9,
  ppda: 5.88, match_tempo: 14.78, yellow_cards: 2,
};
const THEM = {
  possession_pct: 37.86, xg: 0.81, shots: 14, shots_on_target: 3,
  passes: 194, passes_accurate: 134, passes_pct: 69.07,
  progressive_passes: 57, progressive_passes_accurate: 43, progressive_passes_pct: 75.44,
  passes_to_final_third: 39, passes_to_final_third_accurate: 21,
  penalty_area_entries: 18, penalty_area_entries_runs: 3, penalty_area_entries_crosses: 4,
  touches_in_penalty_area: 15, average_passes_per_possession: 2.04,
  recoveries: 68, recoveries_low: 35, recoveries_medium: 26, recoveries_high: 7,
  losses: 104, losses_low: 16, losses_medium: 37, losses_high: 51,
  duels: 194, duels_won: 84, duels_pct: 43.3,
  positional_attacks: 24, positional_attacks_with_shots: 9,
  ppda: 10.07, match_tempo: 13.04, yellow_cards: 2,
};

/** Dos jornadas anteriores, para que haya evolución que mirar. */
function priorMatch(id, date, opponent, over) {
  return {
    side: 'us', team_name: 'Kompong Dewa', formation: '4-3-3',
    match_id: id, stats: { ...US, ...over },
    match_results: { id, match_date: date, opponent, team_id: null, score_for: 1, score_against: 1 },
  };
}

const TEAM_ROWS = [
  priorMatch('mres-1', '2026-08-22', 'Boeung Ket', { ppda: 8.94, progressive_passes_accurate: 33, recoveries_high: 14, possession_pct: 48.2 }),
  priorMatch('mres-2', '2026-08-29', 'Visakha',    { ppda: 7.21, progressive_passes_accurate: 40, recoveries_high: 11, possession_pct: 54.6 }),
  { side: 'us',   team_name: 'Kompong Dewa', formation: '4-3-3', match_id: 'mres-3', stats: US,
    match_results: { id: 'mres-3', match_date: '2026-09-05', opponent: 'Angkor Tiger', team_id: null, score_for: 0, score_against: 0 } },
  { side: 'them', team_name: 'Angkor Tiger', formation: '5-3-2', match_id: 'mres-3', stats: THEM,
    match_results: { id: 'mres-3', match_date: '2026-09-05', opponent: 'Angkor Tiger', team_id: null, score_for: 0, score_against: 0 } },
];

/* GPS del partido: dos titulares, un cambio, y un suplente que sólo calentó — sin
   minutos y con la distancia de un calentamiento. */
const GPS = [
  { player_id: 'p1', time_played: 97, total_distance: 9392, high_speed_distance: 612,
    sprint_distance: 0, max_speed: 28.52, distance_per_minute: 880, accelerations: 29,
    decelerations: 29, player_load: 96, is_invalid: false,
    players: { first_name: 'IN KHIN', last_name: 'DARO', position: 'RB' } },
  { player_id: 'p2', time_played: 83, total_distance: 8333, high_speed_distance: 610,
    sprint_distance: 47, max_speed: 31.33, distance_per_minute: 822, accelerations: 28,
    decelerations: 28, player_load: 88, is_invalid: false,
    players: { first_name: 'KIM', last_name: 'HYEONSU', position: 'ST' } },
  { player_id: 'p3', time_played: 14, total_distance: 2004, high_speed_distance: 90,
    sprint_distance: 16, max_speed: 27.65, distance_per_minute: 580, accelerations: 6,
    decelerations: 6, player_load: 22, is_invalid: false,
    players: { first_name: 'Pedro', last_name: 'NUNES', position: 'CB' } },
  { player_id: 'p4', time_played: null, total_distance: 473, high_speed_distance: 5,
    sprint_distance: 0, max_speed: 28.42, distance_per_minute: null, accelerations: 1,
    decelerations: 0, player_load: 5, is_invalid: false,
    players: { first_name: 'SAN', last_name: 'BORA', position: 'GK' } },
  // Descartado en la revisión del GPS: no es un dato, no debe contarse ni mostrarse.
  { player_id: 'p5', time_played: 90, total_distance: 99999, high_speed_distance: 0,
    sprint_distance: 0, max_speed: 99, distance_per_minute: 0, accelerations: 0,
    decelerations: 0, player_load: 0, is_invalid: true,
    players: { first_name: 'GPS', last_name: 'ROTO', position: 'CM' } },
];

async function gotoMatch(page, { teamRows = TEAM_ROWS, gps = GPS } = {}) {
  await injectSession(page);
  // Lo que se prueba acá son las cards, no el candado del plan. El getter ignora la
  // asignación que hace supabase-init.js al cargar, así que el módulo abre siempre.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'guardModule', {
      get: () => async () => true, set: () => {}, configurable: true,
    });
    Object.defineProperty(window, 'CM_PLAN_GATING_ENABLED', {
      get: () => false, set: () => {}, configurable: true,
    });
  });
  await mockBase(page);
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (url.includes('/team_match_stats'))  return route.fulfill({ json: teamRows });
    if (url.includes('/training_sessions')) {
      // Sólo responde si se pidió el tipo tal como lo escribe el calendario.
      const ok = /session_type=eq\.match(&|$)/.test(url);
      return route.fulfill({ json: ok ? [SESSION_M] : [] });
    }
    if (url.includes('/match_results'))     return route.fulfill({ json: [RESULT] });
    if (url.includes('/gps_reports'))       return route.fulfill({ json: gps });
    // Este handler corre antes que el de mockBase y `continue()` saltaría a la red, así
    // que el perfil y el club se sirven acá: sin club_id el boot corta y no consulta nada.
    // `.single()` pide un objeto, no un array — devolverle una lista deja el club en
    // undefined y la página entera se queda vacía.
    const one = (route.request().headers()['accept'] || '').includes('pgrst.object');
    if (url.includes('/profiles')) return route.fulfill({ json: one ? PROFILE : [PROFILE] });
    if (url.includes('/clubs'))    return route.fulfill({ json: one ? CLUB : [CLUB] });
    return route.fulfill({ json: one ? {} : [] });
  });
  await page.goto('/Match%20Reports.html');
  // El contenedor arranca vacío y sin alto propio: se espera a que tenga algo dentro.
  await page.waitForSelector('#mrTeamStatsBody > *', { timeout: 15_000 });
}

test.describe('Match Reports · estadísticas de equipo', () => {
  test('compara el partido contra el rival con los valores del archivo', async ({ page }) => {
    await gotoMatch(page);
    const card = page.locator('#mrTeamStatsCard');
    await expect(card.locator('.ts-head .nm').first()).toContainText('Kompong Dewa');
    await expect(card.locator('.ts-head .nm.r')).toContainText('Angkor Tiger');
    // Posesión, con el formato del sistema (coma decimal y signo).
    await expect(card.locator('.ts-row').first()).toContainText('62,1 %');
    await expect(card.locator('.ts-row').first()).toContainText('37,9 %');
    await expect(card).toContainText('5,88');    // PPDA nuestro
    await expect(card).toContainText('10,07');   // PPDA del rival
  });

  test('dibuja las zonas del campo con las recuperaciones y pérdidas de cada tercio', async ({ page }) => {
    await gotoMatch(page);
    const thirds = page.locator('#mrTeamStatsCard .ts-third');
    await expect(thirds).toHaveCount(3);
    await expect(thirds.nth(0)).toContainText('36');   // recuperaciones en campo propio
    await expect(thirds.nth(0)).toContainText('21');   // pérdidas en campo propio
    await expect(thirds.nth(2)).toContainText('8');    // recuperaciones en campo rival
    await expect(thirds.nth(2)).toContainText('52');   // pérdidas en campo rival
  });

  test('la card de evolución traza una línea con un punto por partido', async ({ page }) => {
    await gotoMatch(page);
    const trend = page.locator('#mrTrendCard');
    await expect(trend).toBeVisible();
    await expect(trend.locator('svg')).toHaveCount(1);
    await expect(trend.locator('svg .tr-pt')).toHaveCount(3);
    await expect(trend.locator('#mrTrendSub')).toContainText('3');
  });

  test('al cambiar de métrica redibuja con los valores de esa métrica', async ({ page }) => {
    await gotoMatch(page);
    const trend = page.locator('#mrTrendCard');
    await trend.locator('#mrTrendMetric').selectOption('ppda');
    // PPDA baja de 8.94 a 5.88: bajar es mejorar, así que tiene que decir que mejora.
    await expect(trend.locator('.tr-kpi').first()).toContainText('5,88');
    await expect(trend.locator('.tr-kpi').first().locator('.kd')).toHaveClass(/up/);
  });

  test('en una métrica donde subir es mejor, bajar se marca como empeora', async ({ page }) => {
    await gotoMatch(page);
    const trend = page.locator('#mrTrendCard');
    // Los pases progresivos acertados suben 40 → 49: mejora.
    await trend.locator('#mrTrendMetric').selectOption('progressive_passes_accurate');
    await expect(trend.locator('.tr-kpi').first().locator('.kd')).toHaveClass(/up/);
    // Las recuperaciones en campo rival bajan 11 → 8: empeora.
    await trend.locator('#mrTrendMetric').selectOption('recoveries_high');
    await expect(trend.locator('.tr-kpi').first().locator('.kd')).toHaveClass(/down/);
  });

  test('encuentra la sesión de partido del calendario, que se guarda en minúscula', async ({ page }) => {
    await gotoMatch(page);
    // Si la consulta volviera a pedir 'Match', el mock devuelve [] y no hay partido
    // que mostrar: la fecha del encabezado se queda en el guion.
    await expect(page.locator('#mrDate')).not.toHaveText('—');
    await expect(page.locator('#mrPlayerBody')).not.toContainText('No match sessions');
  });

  test('sin nada importado invita a importar en vez de mostrar una card vacía', async ({ page }) => {
    await gotoMatch(page, { teamRows: [] });
    await expect(page.locator('#mrTeamStatsBody')).toContainText('Wyscout');
    await expect(page.locator('#mrTrendCard')).toBeHidden();
  });

  test('con un solo partido esconde la evolución: no hay con qué comparar', async ({ page }) => {
    await gotoMatch(page, { teamRows: TEAM_ROWS.slice(2) });
    await expect(page.locator('#mrTeamStatsCard')).toContainText('62,1 %');
    await expect(page.locator('#mrTrendCard')).toBeHidden();
  });


  // ── Los cinco números de arriba ────────────────────────────────────────────
  test('resume el partido en cinco números, cada uno con su contraste', async ({ page }) => {
    await gotoMatch(page);
    const kpis = page.locator('.kpi-strip .kpi');
    await expect(kpis).toHaveCount(5);
    // xG primero: es lo que habla de la calidad de lo generado.
    await expect(kpis.first()).toContainText('0,54');
    // Y al lado el del rival, que es el xG en contra — sale de su fila del mismo archivo.
    await expect(kpis.first()).toContainText('0,81');
    await expect(page.locator('.kpi-strip')).toContainText('5,88');   // PPDA
  });

  test('un número solo no alcanza: cada KPI se compara contra el promedio', async ({ page }) => {
    await gotoMatch(page);
    // La posesión de este partido (62,1) está por encima del promedio de la serie.
    const poss = page.locator('.kpi').filter({ hasText: '62,1' });
    await expect(poss.locator('.kpi-d')).toHaveClass(/up/);
  });

  test('sin nada importado la tira de KPIs no se inventa nada', async ({ page }) => {
    await gotoMatch(page, { teamRows: [] });
    await expect(page.locator('.kpi-strip')).toHaveCount(0);
    await expect(page.locator('#mrKpiBody')).toContainText('not available yet');
  });

  // ── Tabla partido a partido ────────────────────────────────────────────────
  test('lista cada partido con su resultado y marca lo que está sobre el promedio', async ({ page }) => {
    await gotoMatch(page);
    const tt = page.locator('.mr-table.tt');
    await expect(tt).toBeVisible();
    await expect(tt.locator('tbody tr')).toHaveCount(3);
    // El partido abierto va primero y queda destacado.
    const first = tt.locator('tbody tr').first();
    await expect(first).toHaveClass(/is-now/);
    await expect(first).toContainText('Angkor Tiger');
    await expect(tt.locator('tfoot')).toContainText('55');   // promedio de posesión
  });

  test('en PPDA bajar cuenta como mejorar, y subir como empeorar', async ({ page }) => {
    await gotoMatch(page);
    const tt = page.locator('.mr-table.tt');
    const head = await tt.locator('thead th').allTextContents();
    const i = head.findIndex(h => h.trim() === 'PPDA');
    expect(i).toBeGreaterThan(-1);
    // Angkor Tiger: 5,88 contra un promedio más alto → mejor, en verde.
    await expect(tt.locator('tbody tr').first().locator('td').nth(i).locator('.tt-v')).toHaveClass(/up/);
    // Boeung Ket: 8,94, el peor de la serie → en rojo.
    await expect(tt.locator('tbody tr').last().locator('td').nth(i).locator('.tt-v')).toHaveClass(/down/);
  });

  // ── Tabla de jugadores ─────────────────────────────────────────────────────
  test('deja fuera a quien no jugó y lo dice, en vez de mezclarlo con los titulares', async ({ page }) => {
    await gotoMatch(page);
    await expect(page.locator('#mrPlayerBody tr')).toHaveCount(3);   // 4 con GPS, 1 sin minutos
    await expect(page.locator('#mrPlayerBody')).not.toContainText('BORA');
    await expect(page.locator('#mrPlayerSub')).toContainText('1');
  });

  test('ignora los registros de GPS marcados como inválidos', async ({ page }) => {
    await gotoMatch(page);
    await expect(page.locator('#mrPlayerBody')).not.toContainText('ROTO');
  });

  test('toma los minutos del GPS cuando nadie los cargó a mano', async ({ page }) => {
    await gotoMatch(page);
    const head = await page.locator('#mrPlayerHead th').allTextContents();
    expect(head.some(h => h.trim() === 'Min')).toBe(true);
    await expect(page.locator('#mrPlayerBody tr').first()).toContainText('97');
  });

  test('no dibuja las columnas que este partido no tiene', async ({ page }) => {
    await gotoMatch(page);
    const head = (await page.locator('#mrPlayerHead th').allTextContents()).map(h => h.trim());
    // Sin player_match_stats no hay valoración, goles ni tarjetas: esas columnas no van.
    expect(head).not.toContain('Rating');
    expect(head).not.toContain('Goals');
    expect(head).not.toContain('Cards');
    // Las de GPS sí, porque tienen datos. El encabezado lleva la unidad al lado.
    expect(head.some(h => h.startsWith('Dist'))).toBe(true);
    expect(head.some(h => h.startsWith('Top spd'))).toBe(true);
    expect(head.some(h => h.includes('km/h'))).toBe(true);
  });
});

/* ── El importador, de punta a punta ────────────────────────────────────────────
   Se sube un .xlsx de verdad con la forma del export de Wyscout (encabezados que
   abarcan varias columnas incluidos) y se mira qué termina viajando a la base. */
test.describe('Match Reports · importar el export de equipo', () => {
  const FIXTURE = 'tests/fixtures/wyscout-team-stats.xlsx';

  async function openImporter(page, captured) {
    await injectSession(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'guardModule', { get: () => async () => true, set: () => {}, configurable: true });
      Object.defineProperty(window, 'CM_PLAN_GATING_ENABLED', { get: () => false, set: () => {}, configurable: true });
    });
    await mockBase(page);
    await page.route(`${SB}/rest/v1/**`, async route => {
      const url = route.request().url(), method = route.request().method();
      const one = (route.request().headers()['accept'] || '').includes('pgrst.object');
      if (url.includes('/team_match_stats')) {
        if (method === 'POST') { captured.upsert = JSON.parse(route.request().postData() || '[]'); return route.fulfill({ json: [] }); }
        return route.fulfill({ json: [] });
      }
      if (url.includes('/match_results')) {
        if (method === 'PATCH') { captured.patch = JSON.parse(route.request().postData() || '{}'); return route.fulfill({ json: [] }); }
        // El partido está guardado pero sin marcador ni posesión: los huecos que el
        // archivo tiene que completar.
        const row = { id: 'mres-3', club_id: 'club-1', session_id: 'sess-m1', opponent: 'Angkor Tiger',
                      match_date: '2026-09-05', score_for: null, score_against: null, possession: null, competition: 'CPL' };
        return route.fulfill({ json: one ? row : [row] });
      }
      if (url.includes('/training_sessions')) return route.fulfill({ json: /session_type=eq\.match(&|$)/.test(url) ? [SESSION_M] : [] });
      if (url.includes('/gps_reports')) return route.fulfill({ json: [] });
      if (url.includes('/profiles')) return route.fulfill({ json: one ? PROFILE : [PROFILE] });
      if (url.includes('/clubs')) return route.fulfill({ json: one ? CLUB : [CLUB] });
      return route.fulfill({ json: one ? {} : [] });
    });
    await page.goto('/Match%20Reports.html');
    await page.waitForSelector('#impOpen', { timeout: 15_000 });
    await page.click('#impOpen');
    // Elegir la sesión es lo que carga el partido: sin match_id el importador no tiene
    // dónde colgar las estadísticas y deja el campo de archivo bloqueado.
    await page.waitForSelector('#miSession', { timeout: 15_000 });
    await page.selectOption('#miSession', 'sess-m1');
    await page.waitForSelector('#miFile:not([disabled])', { timeout: 15_000 });
  }

  test('reconoce el archivo, dice quién es quién y guarda las 27 métricas de cada lado', async ({ page }) => {
    const captured = {};
    await openImporter(page, captured);
    await page.setInputFiles('#miFile', FIXTURE);
    await page.waitForSelector('.mi-ts', { timeout: 15_000 });

    // Lo detectó sin que nadie eligiera un formato, y ubicó los dos equipos.
    await expect(page.locator('.mi-ts')).toContainText('Kompong Dewa');
    await expect(page.locator('.mi-ts')).toContainText('Angkor Tiger');
    await expect(page.locator('.mi-ts-tag.is-us')).toHaveCount(1);
    // Sin aviso de "no pude identificar": el rival del partido alcanzó para resolverlo.
    await expect(page.locator('.mi-ts-warn')).toHaveCount(0);
    // Y muestra números antes de guardar nada.
    await expect(page.locator('.mi-ts-peeks')).toContainText('62,1 %');

    // Esperar a que el upsert llegue, no un tiempo fijo: con la máquina cargada un
    // sleep se queda corto y el test falla sin que nada esté roto.
    const upsertDone = page.waitForRequest(r =>
      r.url().includes('/team_match_stats') && r.method() === 'POST', { timeout: 15_000 });
    await page.click('#miImportTS');
    await upsertDone;
    await expect.poll(() => captured.upsert, { timeout: 10_000 }).toBeTruthy();

    expect(Array.isArray(captured.upsert)).toBe(true);
    expect(captured.upsert).toHaveLength(2);
    const us = captured.upsert.find(r => r.side === 'us');
    const them = captured.upsert.find(r => r.side === 'them');
    expect(us.team_name).toBe('Kompong Dewa');
    expect(them.team_name).toBe('Angkor Tiger');
    expect(us.formation).toBe('4-3-3');
    expect(us.source).toBe('wyscout_xlsx');
    // Los encabezados que abarcan varias columnas llegaron expandidos y en su lugar.
    expect(us.stats.possession_pct).toBeCloseTo(62.14, 2);
    expect(us.stats.recoveries_high).toBe(8);
    expect(us.stats.losses_low).toBe(21);
    expect(us.stats.progressive_passes_accurate).toBe(49);
    expect(us.stats.penalty_area_entries_runs).toBe(9);
    expect(us.stats.ppda).toBeCloseTo(5.88, 2);
    expect(them.stats.ppda).toBeCloseTo(10.07, 2);
  });

  test('completa el marcador y la posesión del partido, que estaban vacíos', async ({ page }) => {
    const captured = {};
    await openImporter(page, captured);
    await page.setInputFiles('#miFile', FIXTURE);
    await page.waitForSelector('.mi-ts', { timeout: 15_000 });
    const patchDone = page.waitForRequest(r =>
      r.url().includes('/match_results') && r.method() === 'PATCH', { timeout: 15_000 });
    await page.click('#miImportTS');
    await patchDone;
    await expect.poll(() => captured.patch, { timeout: 10_000 }).toBeTruthy();

    // El archivo dice 2:1 y 62,14 % de posesión.
    expect(captured.patch).toBeTruthy();
    expect(captured.patch.score_for).toBe(2);
    expect(captured.patch.score_against).toBe(1);
    expect(captured.patch.possession).toBe(62);
  });
});
