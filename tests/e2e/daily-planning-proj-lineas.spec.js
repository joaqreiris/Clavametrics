// @ts-check
// La carga proyectada, leída por línea (migración 180).
//
// La media de un drill sobre todo el plantel no le pasa a ningún jugador: en los datos
// reales hay tareas donde una línea corre 82 m/min y otra 39. Lo que se cuida acá es que
// las cuatro columnas salgan de perfiles DISTINTOS, que la línea sin muestra propia caiga
// al promedio del equipo y lo diga, y que el club que todavía no tiene partidos cargados
// siga viendo exactamente lo que veía antes.
import { test, expect } from '@playwright/test';
import { SB, PLAYER, injectSession, mockBase } from './_shared.js';

const SESS = {
  id: 'sess-1', club_id: 'club-1', title: 'MD-3', session_type: 'tactical',
  session_date: new Date().toISOString().slice(0, 10), duration: 90, session_time: '17:00',
  gps_targets: {}, updated_at: new Date().toISOString(),
};
const EX = (id, name, min) => ({
  id, club_id: 'club-1', session_id: 'sess-1', name, phase: 'main', duration: min,
  position: Number(id.slice(-1)), planner_exercise_id: 'pe-' + id, exercise_id: null,
  series: null, work_time: null, rest_time: null, player_groups: null, parallel_group: null,
  gym_exercises: null,
});
const perfil = (ex, grp, n, td) => ({
  club_id: 'club-1', exercise_id: ex, pos_group: grp, n_instances: n, n_players: n,
  total_distance_per_min: td, high_speed_distance_per_min: td / 26,
  very_high_speed_distance_per_min: td / 80, sprint_distance_per_min: td / 200,
  sprint_count_per_min: 0.05, accelerations_per_min: 0.28, decelerations_per_min: 0.26,
  player_load_per_min: td / 8, hmld_per_min: td / 17,
});
const demanda = (grp, n, td) => ({
  club_id: 'club-1', pos_group: grp, n_matches: n, n_players: 12, time_played_avg: 81,
  total_distance: td, high_speed_distance: td / 13, very_high_speed_distance: td / 40,
  sprint_distance: td / 90, sprint_count: 22, accelerations: 41, decelerations: 39,
  player_load: 780, hmld: 520,
});

// Un drill posicional (los extremos corren mucho más) + un rondo (todos parecidos).
// FWD en el posicional tiene 2 registros: por debajo del mínimo, cae al promedio del equipo.
const PERFILES = [
  perfil('pe-e1','ALL',28,70), perfil('pe-e1','DEF',11,58), perfil('pe-e1','MID',9,74),
  perfil('pe-e1','WNG',6,88), perfil('pe-e1','FWD',2,95),
  perfil('pe-e2','ALL',30,62), perfil('pe-e2','DEF',12,61), perfil('pe-e2','MID',10,63),
  perfil('pe-e2','WNG',5,62), perfil('pe-e2','FWD',4,61),
];
const DEMANDA = [
  demanda('ALL',300,9550), demanda('DEF',180,9434), demanda('MID',200,10190),
  demanda('WNG',74,8424), demanda('FWD',140,8826),
];

async function abrirCard(page, { sinPartidos = false } = {}) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await injectSession(page);
  await mockBase(page);
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') return route.fulfill({ json: [SESS] });
    if (url.includes('/v_exercise_gps_profile_pos')) return route.fulfill({ json: PERFILES });
    if (url.includes('/v_match_demand_pos'))        return route.fulfill({ json: sinPartidos ? [] : DEMANDA });
    if (url.includes('/v_exercise_gps_profile'))    return route.fulfill({ json: [] });
    if (url.includes('/training_sessions'))         return route.fulfill({ json: [SESS] });
    // El mock tiene que respetar la fase: sin esto los mismos bloques vuelven como
    // activación y la proyección los cuenta dos veces.
    if (url.includes('/session_exercises')) return route.fulfill({
      json: url.includes('phase=eq.main') ? [EX('e1','PFB 7v5 + 3v2', 22), EX('e2','Rondo 6v3', 14)] : [] });
    if (url.includes('/players')) return route.fulfill({ json: [PLAYER] });
    await route.fallback();
  });
  await page.goto('/Daily%20Planning.html');
  await page.waitForSelector('#dpSquadBody', { timeout: 15_000 });
  await page.locator('#dpGpsProj').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('#dpGpsProj').evaluate(el => el.classList.remove('is-collapsed'));   // arranca colapsada
  await expect(page.locator('#dpProjNote')).toContainText('2 of 2', { timeout: 10_000 });
}

const valor = (page, línea) => page.locator(`[data-bar="total_distance_per_min:${línea}"]`)
  .locator('xpath=../..').locator('div').first().textContent();

test.describe('Daily Planning · carga proyectada por línea', () => {
  test('cada línea proyecta con su propio perfil', async ({ page }) => {
    await abrirCard(page);
    await page.locator('#dpProjMode [data-mode="lines"]').click();
    // DEF 58×22 + 61×14 = 2130 · WNG 88×22 + 62×14 = 2804. La media de equipo (2384)
    // no describe a ninguna de las dos: ése es el motivo de la vista.
    await expect(page.locator('[data-tgtlabel="total_distance_per_min:DEF"]')).toBeVisible();
    expect(await valor(page, 'DEF')).toContain('2,130');
    expect(await valor(page, 'WNG')).toContain('2,804');
    expect(await valor(page, 'MID')).toContain('2,510');
  });

  test('la línea sin muestra propia cae al promedio del equipo y queda marcada', async ({ page }) => {
    await abrirCard(page);
    await page.locator('#dpProjMode [data-mode="lines"]').click();
    // FWD: el posicional no tiene muestra suficiente (2 registros) → 70×22; el rondo sí → 61×14.
    expect(await valor(page, 'FWD')).toContain('2,394');
    const cab = page.locator('#dpProjBody').locator('div', { hasText: /^FWD/ }).first();
    await expect(cab.locator('span[title]')).toHaveAttribute('title', /team average|media del equipo/i);
  });

  test('sin objetivo, la referencia es el partido de esa línea', async ({ page }) => {
    await abrirCard(page);
    await page.locator('#dpProjMode [data-mode="lines"]').click();
    // 2130/9434 = 23% para DEF; 2804/8424 = 33% para WNG. El mismo trabajo pesa distinto.
    await expect(page.locator('[data-tgtlabel="total_distance_per_min:DEF"]')).toContainText('23%');
    await expect(page.locator('[data-tgtlabel="total_distance_per_min:WNG"]')).toContainText('33%');
  });

  test('un objetivo escrito a mano manda sobre la referencia de partido', async ({ page }) => {
    await abrirCard(page);
    await page.locator('[data-proj-target="total_distance_per_min"]').fill('2400');
    await expect(page.locator('[data-tgtlabel="total_distance_per_min:ALL"]')).toContainText('2,400');
    // Dentro del ±10% del objetivo la barra se pone verde; muy por encima, ámbar.
    const color = () => page.locator('[data-bar="total_distance_per_min:ALL"]').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await color()).toBe('rgb(22, 163, 74)');
    await page.locator('[data-proj-target="total_distance_per_min"]').fill('1200');
    expect(await color()).toBe('rgb(217, 119, 6)');
  });

  test('el club sin partidos cargados ve lo mismo que veía antes', async ({ page }) => {
    await abrirCard(page, { sinPartidos: true });
    await expect(page.locator('[data-tgtlabel="total_distance_per_min:ALL"]')).toContainText(/no target|sin objetivo/i);
    await expect(page.locator('#dpProjNote')).not.toContainText(/60\+|60 minutos/);
  });

  test('el modo elegido sobrevive a recargar la página', async ({ page }) => {
    await abrirCard(page);
    await page.locator('#dpProjMode [data-mode="lines"]').click();
    await page.reload();
    await page.waitForSelector('#dpSquadBody', { timeout: 15_000 });
    await expect(page.locator('#dpProjMode [data-mode="lines"]')).toHaveClass(/is-on/, { timeout: 10_000 });
  });
});
