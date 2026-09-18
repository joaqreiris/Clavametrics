// @ts-check
// Llamadas puntuales entre categorías (player_call_ups, migración 185).
// Lo que se protege acá: que el jugador de otra categoría entre a la grilla SOLO los días que
// fue llamado. El bug que esto evita es el de siempre — resolverlo con una membresía en
// player_teams, que lo deja en la lista para siempre; el entrenador pidió justo lo contrario.
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, MICROCYCLE, injectSession, mockBase } from './_shared.js';

const ADMIN  = { ...PROFILE, role: 'admin', club_role: 'Owner' };
const TEAM_A = { id: 'team-1', club_id: 'club-1', name: 'First Team' };
const TEAM_B = { id: 'team-2', club_id: 'club-1', name: 'Second Team' };

// Plantel del primer equipo (los que devuelve la query con player_teams!inner).
const SQUAD = [
  { id: 'p-1', club_id: 'club-1', team_id: 'team-1', first_name: 'Lucas', last_name: 'García', number: 10, position: 'FW' },
  { id: 'p-2', club_id: 'club-1', team_id: 'team-1', first_name: 'Diego', last_name: 'Pérez',  number: 4,  position: 'CB' },
];
// Del filial: NO tiene membresía en team-1. Solo sube el 2026-05-18.
const GUEST = { id: 'p-9', club_id: 'club-1', team_id: 'team-2', first_name: 'Nico', last_name: 'Zeta', number: 30, position: 'CM' };

const CALL_DAY = '2026-05-18';
const CALL_UPS = [{ player_id: 'p-9', date: CALL_DAY, created_by: 'user-1', created_at: '2026-05-17T10:00:00Z' }];

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ callUps?: any[] }} [opts]
 */
async function mockAvail(page, opts = {}) {
  const callUps = opts.callUps === undefined ? CALL_UPS : opts.callUps;
  const canCall = opts.canCall !== false;        // ¿el jugador se llama directo o hay que pedirlo?
  const pending = opts.pending || [];
  const posted = [];
  const patched = [];
  await mockBase(page);

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();

    // Las RPC entran por acá: este route se registra DESPUÉS y le gana a cualquier
    // `/rest/v1/rpc/**` propio, que quedaría muerto y devolviendo la lista vacía del final.
    // Y son dos distintas: my_team_ids devuelve ids sueltos, call_up_candidates fichas.
    if (url.includes('/rpc/')) {
      if (url.includes('call_up_candidates')) return route.fulfill({ json: [{
        id: 'p-9', first_name: GUEST.first_name, last_name: GUEST.last_name,
        number: GUEST.number, position: GUEST.position,
        team_id: 'team-2', team_name: 'Second Team', can_call: canCall,
      }] });
      return route.fulfill({ json: ['team-1', 'team-2'] });
    }

    if (url.includes('/profiles'))    return route.fulfill({ json: ADMIN });
    // Membresías del club: de acá sale a qué categoría pertenece cada jugador, y con eso la
    // pantalla decide qué pedidos le tocan decidir. Sin esto la bandeja sale siempre vacía.
    if (url.includes('/player_teams')) return route.fulfill({ json: [
      { player_id: 'p-1', team_id: 'team-1' },
      { player_id: 'p-2', team_id: 'team-1' },
      { player_id: 'p-9', team_id: 'team-2' },
    ] });
    if (url.includes('/clubs'))       return route.fulfill({ json: CLUB });
    if (url.includes('/teams'))       return route.fulfill({ json: [TEAM_A, TEAM_B] });
    if (url.includes('/microcycles')) return route.fulfill({ json: [MICROCYCLE] });
    // Días con sesión planificada: sin esto el rango no tiene días "contables" y el botón de
    // llamar para todo el rango queda deshabilitado (es la guarda, no un fallo).
    // La MISMA tabla se consulta dos veces con sentido opuesto — los day off bloquean el día —,
    // así que hay que mirar el filtro: contestar lo mismo a las dos deja el rango entero libre
    // y el spec culpa al producto de un mock mal puesto.
    if (url.includes('/training_sessions')) {
      if (/session_type=eq\.day_off/.test(url)) return route.fulfill({ json: [] });
      return route.fulfill({ json: [{ session_date: '2026-05-18' }, { session_date: '2026-05-19' }] });
    }

    if (url.includes('/player_call_ups')) {
      if (method === 'POST') { posted.push(JSON.parse(route.request().postData() || '[]')); return route.fulfill({ status: 201, json: [] }); }
      if (method === 'PATCH') { patched.push({ url, body: JSON.parse(route.request().postData() || '{}') }); return route.fulfill({ status: 200, json: [] }); }
      if (method === 'DELETE') return route.fulfill({ status: 204, body: '' });
      // La pantalla pide por separado los aprobados (los que entran a la grilla) y los
      // pendientes (la bandeja de decisión): el mock respeta ese filtro.
      if (/status=eq\.pending/.test(url)) return route.fulfill({ json: pending });
      return route.fulfill({ json: callUps });
    }
    if (url.includes('/notifications')) return route.fulfill({ status: 201, json: [] });
    if (url.includes('/member_teams'))  return route.fulfill({ json: [{ profile_id: 'user-1', team_id: 'team-2' }] });

    if (url.includes('/players')) {
      // Dos consultas distintas sobre la misma tabla:
      //  · roster / pool  → filtra por membresía (player_teams.team_id)
      //  · fichas de los llamados → id=in.(…), sin join
      if (/id=in\./.test(url))                  return route.fulfill({ json: [GUEST] });
      if (/player_teams\.team_id=eq\.team-2/.test(url)) return route.fulfill({ json: [{ ...GUEST, player_teams: [{ team_id: 'team-2' }] }] });
      if (/team_id=in\.|player_teams\.team_id=in\./.test(url)) return route.fulfill({ json: [{ ...GUEST, player_teams: [{ team_id: 'team-2' }] }] });
      return route.fulfill({ json: SQUAD });
    }

    if (url.includes('/availability')) {
      if (method === 'GET') return route.fulfill({ json: [] });
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ json: [] });
  });
  return { posted, patched };
}

async function gotoGrid(page) {
  await injectSession(page);
  await page.goto('/Availability.html');
  await page.waitForSelector('#avBody tr[data-player-id]', { timeout: 15_000 });
}

test.describe('Availability — llamar jugadores de otra categoría', () => {
  test('el llamado entra a la grilla y solo su día llamado es editable', async ({ page }) => {
    await mockAvail(page);
    await gotoGrid(page);

    const row = page.locator('#avBody tr[data-player-id="p-9"]');
    await expect(row).toHaveCount(1);                       // está, sin membresía
    await expect(row).toHaveClass(/is-callup/);             // y marcado como llamado
    await expect(row.locator('.av-pl-callup')).toContainText('1');

    // El día llamado se puede tocar; cualquier otro día del rango, no.
    await expect(row.locator(`td.cell[data-date="${CALL_DAY}"]`)).not.toHaveClass(/is-notcalled/);
    await expect(row.locator('td.cell[data-date="2026-05-19"]')).toHaveClass(/is-notcalled/);

    // El del plantel no lleva ninguna de las dos marcas.
    const own = page.locator('#avBody tr[data-player-id="p-1"]');
    await expect(own).not.toHaveClass(/is-callup/);
    await expect(own.locator('td.cell.is-notcalled')).toHaveCount(0);
  });

  test('sin llamada, el jugador del filial NO aparece en la grilla', async ({ page }) => {
    await mockAvail(page, { callUps: [] });
    await gotoGrid(page);
    await expect(page.locator('#avBody tr[data-player-id="p-9"]')).toHaveCount(0);
    await expect(page.locator('#avBody tr[data-player-id="p-1"]')).toHaveCount(1);
  });

  test('el panel ofrece a los de la otra categoría y llamar los manda a player_call_ups', async ({ page }) => {
    const { posted } = await mockAvail(page, { callUps: [] });
    await gotoGrid(page);

    await page.click('#avCallUpBtn');
    const panel = page.locator('#avCallUpPanel');
    await expect(panel).toHaveClass(/is-open/);
    // Agrupado por la categoría de origen, para que se vea de dónde sale el jugador.
    await expect(panel.locator('.av-callup-list')).toContainText('Second Team');
    const opt = panel.locator('.av-callup-opt input[value="p-9"]');
    await expect(opt).toHaveCount(1);

    await opt.check();
    const btnRange = page.locator('#avCallUpAll');
    await expect(btnRange).toBeEnabled();
    await btnRange.click();

    await expect.poll(() => posted.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const rows = posted.flat();
    expect(rows.every(r => r.player_id === 'p-9' && r.team_id === 'team-1')).toBe(true);
    // Solo los días con actividad del rango, no los 8 del microciclo: los dos entrenamientos
    // y el partido del 21 (un partido también es un día al que se llama — de hecho, el motivo
    // más habitual). Los días sin nada planificado quedan fuera.
    expect(rows.map(r => r.date).sort()).toEqual(['2026-05-18', '2026-05-19', '2026-05-21']);
  });
});

// ── Pedido con aprobación (migración 187) ────────────────────────────────────
// El caso que antes era un callejón sin salida: el que solo maneja el primer equipo no veía a
// nadie a quien llamar. Ahora lo pide, y el jugador NO entra hasta que su entrenador acepte.
test.describe('Availability — pedir un jugador a otra categoría', () => {
  test('sin acceso a esa categoría, el botón pide en vez de llamar y la fila nace pendiente', async ({ page }) => {
    const { posted } = await mockAvail(page, { callUps: [], canCall: false });
    await gotoGrid(page);

    await page.click('#avCallUpBtn');
    const panel = page.locator('#avCallUpPanel');
    // El aviso va en el grupo, antes de elegir a nadie.
    await expect(panel.locator('.av-callup-list .grp .ask')).toHaveCount(1);

    await panel.locator('.av-callup-opt input[value="p-9"]').check();
    // El botón cambia de verbo: pedir y llamar no son lo mismo.
    await expect(page.locator('#avCallUpAll')).toContainText(/Request|Pedir/i);
    await expect(page.locator('#avCallUpWhen')).toContainText(/approve|aprob/i);

    page.on('dialog', d => d.accept());
    await page.locator('#avCallUpAll').click();
    await expect.poll(() => posted.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const rows = posted.flat();
    expect(rows.every(r => r.status === 'pending')).toBe(true);
    expect(rows.every(r => r.team_id === 'team-1')).toBe(true);
  });

  test('un pedido pendiente NO mete al jugador en la grilla', async ({ page }) => {
    // callUps = [] porque la pantalla pide solo los aprobados; el pendiente va por su lado.
    await mockAvail(page, { callUps: [], canCall: false, pending: [{ id: 'cu-1', player_id: 'p-9', team_id: 'team-2', date: CALL_DAY, created_by: 'user-9' }] });
    await gotoGrid(page);
    await expect(page.locator('#avBody tr[data-player-id="p-9"]')).toHaveCount(0);
  });

  test('al que tiene al jugador le aparece la bandeja, y aceptar lo resuelve', async ({ page }) => {
    // Pedido de OTRA categoría (team-2) por un jugador del equipo que estoy viendo (p-1).
    const { patched } = await mockAvail(page, {
      callUps: [],
      pending: [{ id: 'cu-7', player_id: 'p-1', team_id: 'team-2', date: CALL_DAY, created_by: 'user-9' }],
    });
    await gotoGrid(page);

    const inbox = page.locator('#avCallUpInbox');
    await expect(inbox).toBeVisible();
    await expect(inbox).toContainText('GARCÍA');          // el jugador que me piden
    await expect(inbox).toContainText('Second Team');     // quién lo pide

    await inbox.locator('button.yes').click();
    await expect.poll(() => patched.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(patched[0].body.status).toBe('approved');
    expect(patched[0].url).toContain('cu-7');
  });

  test('el pedido por un jugador de OTRA categoría no aparece en mi bandeja', async ({ page }) => {
    // p-9 no es de team-1: no me toca decidirlo aunque el pedido exista en el club.
    await mockAvail(page, {
      callUps: [],
      pending: [{ id: 'cu-8', player_id: 'p-9', team_id: 'team-2', date: CALL_DAY, created_by: 'user-9' }],
    });
    await gotoGrid(page);
    await expect(page.locator('#avCallUpInbox')).toBeHidden();
  });
});
