// @ts-check
// Cola de decisiones → tareas.
//
// Hasta ahora la cola sólo dibujaba: lo que el usuario agregaba vivía en localStorage, se
// perdía al cambiar de navegador y nadie más lo veía. Ahora cada ítem se puede bajar a una
// tarea de `tasks`, con responsable y estado, que es lo que mira el club en Chat & Tasks.
//
// Lo que este spec vigila es lo que no se ve en pantalla: QUÉ fila se manda. Un rol que no
// esté en el CHECK de assigned_roles, o una prioridad que la tabla no acepte, se rechazan
// enteros y en pantalla sólo se ve "no se pudo crear". Y la source_key es lo único que
// impide duplicar, así que tiene que llevar el equipo y la fecha adentro.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB = { id: 'club-1', name: 'Test FC' };
const TEAM = { id: 'team-a', name: 'Primera', season: '2026/27' };
const ME = { id: 'user-1', club_id: 'club-1', role: 'sc_coach', club_role: null, first_name: 'Sol', last_name: 'Prepa', full_name: 'Sol Prepa', email: 'sol@test.com' };

/**
 * @param {{ tasks?: any[], tasksError?: boolean }} opts
 * Devuelve las filas POSTeadas a /tasks para poder mirarlas.
 */
async function mount(page, { tasks = [], tasksError = false, lang = 'es' } = {}) {
  /** @type {any[]} */
  const posted = [];
  let served = tasks.slice();

  await page.addInitScript(l => { try { localStorage.setItem('cm_lang', l); } catch { /* sin storage */ } }, lang);
  await injectSession(page);

  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  const USER = { id: 'user-1', email: 'sol@test.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));

  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url();
    const met = route.request().method();
    const t = n => url.includes(`/rest/v1/${n}`);
    if (t('profiles')) {
      const acc = route.request().headers()['accept'] || '';
      return acc.includes('pgrst.object') ? route.fulfill({ json: ME }) : route.fulfill({ json: [ME] });
    }
    if (t('clubs')) {
      const acc = route.request().headers()['accept'] || '';
      return route.fulfill({ json: acc.includes('pgrst.object') ? CLUB : [CLUB] });
    }
    if (t('teams')) return route.fulfill({ json: [TEAM] });
    if (t('tasks')) {
      if (met === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const filas = Array.isArray(body) ? body : [body];
        posted.push(...filas);
        // Como haría la base: la fila queda, y el siguiente GET la trae.
        served = served.concat(filas.map((f, i) => ({ ...f, id: `new-${posted.length}-${i}` })));
        return route.fulfill({ status: 201, json: filas });
      }
      // La base sin la migración 152 responde 400 porque la columna no existe.
      if (tasksError) return route.fulfill({ status: 400, json: { code: '42703', message: 'column tasks.source_key does not exist' } });
      return route.fulfill({ json: served });
    }
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpc/my_team_ids**`, r => r.fulfill({ json: [TEAM.id] }));
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['load_monitor', 'gps_analysis'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['load_monitor', 'gps_analysis'] }));

  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('/Load%20Monitor.html', { waitUntil: 'domcontentloaded' });
  // La cola se dibuja al final de loadAll(): su primer ítem es la señal de que el boot terminó.
  await expect(page.locator('#dqList .lm-dq-item').first()).toBeVisible({ timeout: 30_000 });
  return { posted, getServed: () => served };
}

const itemXI = page => page.locator('#dqList .lm-dq-item').filter({ hasText: 'XI titular' }).first();

test('un ítem se convierte en tarea, y la fila que se manda es la que la tabla acepta', async ({ page }) => {
  const { posted } = await mount(page);
  const item = itemXI(page);
  await expect(item.locator('[data-mk]')).toBeVisible();

  await item.locator('[data-mk]').click();
  await expect.poll(() => posted.length, { timeout: 15_000 }).toBe(1);

  const fila = posted[0];
  expect(fila.club_id).toBe(CLUB.id);
  expect(fila.team_id).toBe(TEAM.id);
  expect(fila.created_by).toBe(ME.id);
  expect(fila.created_by_name).toBe('Sol Prepa');
  expect(fila.status).toBe('pending');
  // El XI es del entrenador principal, y 'coach' está en el CHECK de assigned_roles.
  expect(fila.assigned_roles).toEqual(['coach']);
  expect(['low', 'medium', 'high', 'urgent']).toContain(fila.priority);
  expect(['general', 'match_day', 'medical', 'routine', 'event']).toContain(fila.category);
  // La clave lleva el equipo y la fecha: sin eso, dos equipos comparten tarea.
  expect(fila.source_key).toMatch(/^lm:xi:team-a:\d{4}-\d{2}-\d{2}$/);
  // Quien la recibe no vio esta pantalla: la descripción dice de dónde salió.
  expect(fila.description).toContain('Monitor de carga');

  // Y el ítem pasa a mostrar el estado en vez del botón.
  await expect(item.locator('.lm-dq-state')).toHaveText(/Pendiente/, { timeout: 15_000 });
  await expect(item.locator('[data-mk]')).toHaveCount(0);
});

test('un ítem que ya es tarea muestra su estado y no vuelve a ofrecer el botón', async ({ page }) => {
  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const { posted } = await mount(page, { tasks: [{
    id: 'task-1', title: 'Confirmar el XI titular para MD', status: 'in_progress', priority: 'low',
    assigned_to_name: 'Carlos Coach', assigned_roles: ['coach'],
    source_key: `lm:xi:${TEAM.id}:${ymd}`, team_id: TEAM.id, created_at: new Date().toISOString(),
  }] });

  const item = itemXI(page);
  await expect(item.locator('.lm-dq-state')).toHaveText(/En curso/);
  await expect(item.locator('[data-mk]')).toHaveCount(0);
  // Y enlaza a la tarea, no al tablero entero.
  await expect(item.locator('a[href*="task=task-1"]')).toHaveCount(1);
  expect(posted).toHaveLength(0);
});

test('sin la columna en la base no se ofrece convertir, en vez de un botón que falla', async ({ page }) => {
  // Es el modo de fallo silencioso de PostgREST: 400 y la pantalla se dibuja igual.
  const { posted } = await mount(page, { tasksError: true });
  await expect(itemXI(page)).toBeVisible();
  await expect(page.locator('#dqList [data-mk]')).toHaveCount(0);
  expect(posted).toHaveLength(0);
});

test('las acciones viejas del navegador se muestran marcadas y se pueden subir', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('cm_lm_actions_club-1', JSON.stringify([{ t: 'Hablar con el médico por Fulano', prio: 'med' }])); } catch { /* sin storage */ }
  });
  const { posted } = await mount(page);
  const vieja = page.locator('#dqList .lm-dq-item').filter({ hasText: 'Hablar con el médico' }).first();
  await expect(vieja).toBeVisible();
  await expect(vieja).toContainText('Sólo en este navegador');

  await vieja.locator('[data-up]').click();
  await expect.poll(() => posted.length, { timeout: 15_000 }).toBe(1);
  expect(posted[0].title).toBe('Hablar con el médico por Fulano');
  // Manual: sin rol asignado y con su propia clave, que no compite con las derivadas.
  expect(posted[0].assigned_roles).toBeNull();
  expect(posted[0].source_key).toMatch(/^lm:manual:/);

  /* Y se fue del navegador, ahora que está guardada de verdad. Con poll y no con una lectura
     suelta: ver el POST en el route handler no significa que el cliente ya haya recibido la
     respuesta, y el borrado local pasa después de eso. */
  await expect.poll(async () => {
    const v = await page.evaluate(() => localStorage.getItem('cm_lm_actions_club-1'));
    return JSON.parse(v || '[]').length;
  }, { timeout: 15_000 }).toBe(0);
});

test('la fila aguanta el botón en los tres idiomas y en tablet', async ({ page }) => {
  /* La fila es un grid de 34px 1fr auto y ahora la derecha lleva prioridad + estado +
     botón. "Asignar como tarea" y "Atribuir como tarefa" son bastante más largos que
     "Assign as task", así que medir sólo en inglés no prueba nada. */
  test.setTimeout(180_000);
  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  for (const vp of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    for (const lang of ['es', 'pt', 'en']) {
      await page.setViewportSize(vp);
      // Una fila con estado Y otra con botón: los dos casos anchos a la vez.
      await mount(page, { lang, tasks: [{
        id: 'task-1', title: 'x', status: 'in_progress', priority: 'low',
        assigned_to_name: 'Carlos Coach', assigned_roles: ['coach'],
        source_key: `lm:rehab:${TEAM.id}:${ymd}`, team_id: TEAM.id, created_at: new Date().toISOString(),
      }] });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      const r = await page.evaluate(() => {
        const doc = document.documentElement;
        let peor = 0;
        document.querySelectorAll('#dqList .lm-dq-item').forEach(el => {
          peor = Math.max(peor, el.scrollWidth - el.clientWidth);
        });
        return { pagina: doc.scrollWidth - doc.clientWidth, fila: peor };
      });
      expect(r.pagina, `página · ${lang} · ${vp.width}px`).toBeLessThanOrEqual(0);
      expect(r.fila, `fila · ${lang} · ${vp.width}px`).toBeLessThanOrEqual(0);
    }
  }
});
