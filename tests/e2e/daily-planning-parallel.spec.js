// @ts-check
// Tareas simultáneas: dos tareas que se hacen a la vez (grupo A en una, grupo B en
// la otra) comparten parallel_group y tienen que llegar a la pantalla bajo un mismo
// corchete, no como dos bloques encadenados.
import { test, expect } from '@playwright/test';
import { SB, PLAYER, SESSION, injectSession, mockBase } from './_shared.js';

const DATE = SESSION.session_date;

const ex = (id, name, extra = {}) => ({
  id, club_id: 'club-1', session_id: 'sess-1', name,
  phase: 'main', duration: 10, position: 0, player_groups: null,
  parallel_group: null, intensity: null, notes: '',
  exercise_id: null, planner_exercise_id: null,
  field_width: null, field_height: null, players_count: null,
  m2_per_player: null, calc_orientation: null,
  series: null, work_time: null, rest_time: null, dose_mode: null, reps: null,
  dosing_overrides: [], gym_exercises: null,
  ...extra,
});

async function gotoDP(page, exercises) {
  await injectSession(page);
  await mockBase(page);
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') return route.fulfill({ json: [] });
    if (url.includes('/players'))            return route.fulfill({ json: [PLAYER] });
    if (url.includes('/training_sessions'))  return route.fulfill({ json: [SESSION] });
    if (url.includes('/session_exercises')) {
      const main = url.includes('phase=eq.main');
      return route.fulfill({ json: main ? exercises : [] });
    }
    if (url.includes('/availability') || url.includes('/injuries') || url.includes('/treatments')
        || url.includes('/microcycles')) return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/Daily%20Planning.html?date=${DATE}`);
  await page.waitForSelector('#dpSquadBody', { timeout: 10_000 });
  await page.waitForSelector('#dpExGrid .dp-ex', { timeout: 10_000 });
}

test('dos tareas enlazadas se dibujan dentro de un mismo corchete', async ({ page }) => {
  await gotoDP(page, [
    ex('se-1', 'Rondo 4v2',    { position: 0, parallel_group: 'pg1' }),
    ex('se-2', 'Finalización', { position: 1, parallel_group: 'pg1', duration: 12 }),
    ex('se-3', 'Partido',      { position: 2 }),
  ]);
  const block = page.locator('#dpExGrid .dp-par');
  await expect(block).toHaveCount(1);
  await expect(block.locator('.dp-ex')).toHaveCount(2);
  await expect(block.locator('.dp-ex-name').first()).toHaveText('Rondo 4v2');
  // La tarea suelta queda fuera del corchete.
  await expect(page.locator('#dpExGrid > .dp-ex')).toHaveCount(1);
  // La cabecera del corchete cuenta las dos y sus minutos (10 + 12).
  await expect(block.locator('.dp-par-h .ct')).toContainText('2');
  await expect(block.locator('.dp-par-h .ct')).toContainText('22');
});

test('sin vínculo no aparece ningún corchete', async ({ page }) => {
  await gotoDP(page, [ex('se-1', 'Rondo 4v2'), ex('se-2', 'Finalización', { position: 1 })]);
  await expect(page.locator('#dpExGrid .dp-par')).toHaveCount(0);
  await expect(page.locator('#dpExGrid > .dp-ex')).toHaveCount(2);
});

test('un vínculo huérfano (quedó una sola tarea) se dibuja suelto', async ({ page }) => {
  await gotoDP(page, [ex('se-1', 'Rondo 4v2', { parallel_group: 'pg1' })]);
  await expect(page.locator('#dpExGrid .dp-par')).toHaveCount(0);
  await expect(page.locator('#dpExGrid > .dp-ex')).toHaveCount(1);
});

test('el menú del botón de cadena ofrece la otra tarea de la sección', async ({ page }) => {
  await gotoDP(page, [ex('se-1', 'Rondo 4v2'), ex('se-2', 'Finalización', { position: 1 })]);
  await page.locator('.dp-ex[data-seid="se-1"] .dp-par-btn').click();
  const menu = page.locator('#dpExPlayersMenu');
  await expect(menu).toHaveClass(/is-open/);
  await expect(menu).toContainText('Finalización');
  await expect(menu).not.toContainText('Rondo 4v2');
});
