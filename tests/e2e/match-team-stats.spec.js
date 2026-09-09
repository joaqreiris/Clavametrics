// @ts-check
// Match Reports · las dos cards que llena el export de equipo de Wyscout.
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, injectSession, mockBase } from './_shared.js';

const SESSION_M = {
  id: 'sess-m1', club_id: 'club-1', title: 'Angkor Tiger (A)',
  session_type: 'Match', session_date: '2026-09-05', duration: 93, notes: '',
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

async function gotoMatch(page, { teamRows = TEAM_ROWS } = {}) {
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
    if (url.includes('/training_sessions')) return route.fulfill({ json: [SESSION_M] });
    if (url.includes('/match_results'))     return route.fulfill({ json: [RESULT] });
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
});
