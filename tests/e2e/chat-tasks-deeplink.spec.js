// @ts-check
// Chat & Tasks: el deep link ?task=<id>.
//
// Existe para la cola de decisiones de Load Monitor, que enlaza a UNA tarea: sin esto el
// enlace deja al usuario en el tablero completo teniendo que buscarla a mano.
//
// Vale un test propio aunque el cambio sea chico, porque sus dos formas de romperse no dan
// error visible: la bandera que evita reabrirlo en cada refresco está declarada con `let`
// arriba del todo (si quedara DEBAJO de la función que la usa, la zona muerta temporal tira
// un ReferenceError que corta la carga de tareas entera), y un id que no está entre las
// cargadas no debe hacer nada en vez de reventar.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB = { id: 'club-1', name: 'Test FC' };
const TEAM = { id: 'team-a', name: 'Primera', season: '2026/27' };
const ME = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: null, first_name: 'Ana', last_name: 'Admin', full_name: 'Ana Admin', email: 'ana@test.com' };

const TAREA = {
  id: 'task-42', club_id: CLUB.id, title: 'Revisar exposición de alta velocidad (3)',
  description: 'Sale de la cola de decisiones del Monitor de carga.',
  status: 'pending', priority: 'high', due_date: null,
  assigned_to: null, assigned_to_name: null, assigned_roles: ['sc_coach'],
  created_by: ME.id, category: 'general', team_id: TEAM.id,
};

async function mount(page, { task = '' } = {}) {
  /** @type {string[]} */
  const errores = [];
  page.on('pageerror', e => errores.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  await page.addInitScript(() => { try { localStorage.setItem('cm_lang', 'es'); } catch { /* sin storage */ } });
  await injectSession(page);

  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  const USER = { id: 'user-1', email: 'ana@test.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));
  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url();
    const t = n => url.includes(`/rest/v1/${n}`);
    const acc = route.request().headers()['accept'] || '';
    if (t('profiles')) return acc.includes('pgrst.object') ? route.fulfill({ json: ME }) : route.fulfill({ json: [ME] });
    if (t('clubs'))    return route.fulfill({ json: acc.includes('pgrst.object') ? CLUB : [CLUB] });
    if (t('teams'))    return route.fulfill({ json: [TEAM] });
    if (t('tasks'))    return route.fulfill({ json: [TAREA] });
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpc/my_team_ids**`, r => r.fulfill({ json: [TEAM.id] }));
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['chat_tasks'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['chat_tasks'] }));

  page.on('dialog', d => d.dismiss().catch(() => {}));
  /* Sin el .html a propósito. `npx serve` (el webServer de estos tests) redirige
     /Chat & Tasks.html?x a /Chat & Tasks y en esa redirección PIERDE la query, así que
     probando la URL con extensión se estaría probando el servidor de desarrollo y no el
     código. La app enlaza con .html, igual que el ?conv= que ya existe. */
  await page.goto(`/Chat%20%26%20Tasks${task ? `?task=${task}` : ''}`, { waitUntil: 'domcontentloaded' });
  return errores;
}

test('con ?task=<id> abre esa tarea, no el tablero', async ({ page }) => {
  await mount(page, { task: TAREA.id });
  await expect(page.locator('#detailPanel')).toHaveClass(/is-open/, { timeout: 20_000 });
  await expect(page.locator('#detailTitleInput')).toHaveValue(TAREA.title);
  // Y deja el tablero detrás, no el chat: al cerrar el detalle hay que caer en Tareas.
  await expect(page.locator('.ct-tab[data-view="tasks"]')).toHaveClass(/is-on/);
});

test('un id que no existe deja el tablero como está, sin romperse', async ({ page }) => {
  const errores = await mount(page, { task: 'no-existe-42' });
  // El tablero tiene que llegar a dibujarse igual (está en su pestaña, que acá no se toca).
  await expect(page.locator('.ct-tab[data-view="tasks"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('.ct-tab[data-view="tasks"]').click();
  await expect(page.locator('#colBacklog')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#detailPanel')).not.toHaveClass(/is-open/);
  expect(errores.filter(e => /ReferenceError|is not defined|Cannot access/.test(e))).toEqual([]);
});

test('sin parámetro no abre nada y queda en el chat, como siempre', async ({ page }) => {
  await mount(page);
  await expect(page.locator('.ct-tab[data-view="chat"]')).toHaveClass(/is-on/, { timeout: 20_000 });
  await expect(page.locator('#detailPanel')).not.toHaveClass(/is-open/);
});
