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
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
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
  const deleted = [];
  const avail   = [];          // lo que se escribe en availability (pintar estados)
  await mockBase(page);

  await page.route(`${SB}/rest/v1/**`, async route => {
    const url    = route.request().url();
    const method = route.request().method();

    // Las RPC entran por acá: este route se registra DESPUÉS y le gana a cualquier
    // `/rest/v1/rpc/**` propio, que quedaría muerto y devolviendo la lista vacía del final.
    // Y son dos distintas: my_team_ids devuelve ids sueltos, call_up_candidates fichas.
    if (url.includes('/rpc/')) {
      if (url.includes('call_up_candidates')) {
        // Foto como data: URI — la app acepta tanto una ruta del bucket privado (que hay que
        // firmar contra Storage) como un enlace directo, y acá interesa el comportamiento de la
        // pantalla, no el de Storage: firmar exigiría emular esa API para nada.
        const base = { team_id: 'team-2', team_name: 'Second Team', can_call: canCall,
                       photo_url: opts.photo === undefined ? PIXEL : opts.photo };
        const many = Array.from({ length: opts.extraCandidates || 0 }, (_, i) => ({
          ...base, id: `x-${i}`, first_name: 'Extra', last_name: `Player ${String(i).padStart(2, '0')}`,
          number: 40 + i, position: 'MF',
        }));
        return route.fulfill({ json: [{
          id: 'p-9', first_name: GUEST.first_name, last_name: GUEST.last_name,
          number: GUEST.number, position: GUEST.position, ...base,
        }, ...many] });
      }
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
      if (method === 'DELETE') { deleted.push(url); return route.fulfill({ status: 204, body: '' }); }
      // La pantalla pide por separado los aprobados (los que entran a la grilla) y los
      // pendientes (la bandeja de decisión): el mock respeta ese filtro.
      if (/status=eq\.pending/.test(url)) return route.fulfill({ json: pending });
      return route.fulfill({ json: callUps });
    }
    if (url.includes('/notifications')) {
      if (method === 'GET') return route.fulfill({ json: opts.notifs || [] });
      return route.fulfill({ status: 201, json: [] });
    }
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
      avail.push(...[].concat(JSON.parse(route.request().postData() || '[]')));
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ json: [] });
  });
  return { posted, patched, deleted, avail };
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
    const panel = page.locator('#cmCuPanel');
    await expect(panel).toHaveClass(/is-open/);
    // Agrupado por la categoría de origen, para que se vea de dónde sale el jugador.
    await expect(panel.locator('.cm-cu-list')).toContainText('Second Team');
    const opt = panel.locator('.cm-cu-opt input[value="p-9"]');
    await expect(opt).toHaveCount(1);

    await opt.check();
    // Los días se eligen en la tira del panel. Sin ninguno marcado el botón no habilita: la
    // llamada sin fecha no existe.
    const btn = page.locator('#cmCuAct-days');
    await expect(btn).toBeDisabled();
    await page.locator('#cmCuDays button.all').click();
    await expect(btn).toBeEnabled();
    await btn.click();

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
    const panel = page.locator('#cmCuPanel');
    // El aviso va en el grupo, antes de elegir a nadie.
    await expect(panel.locator('.cm-cu-list .grp .ask')).toHaveCount(1);

    await panel.locator('.cm-cu-opt input[value="p-9"]').check();
    await page.locator('#cmCuDays button.all').click();
    // El botón cambia de verbo: pedir y llamar no son lo mismo.
    await expect(page.locator('#cmCuAct-days')).toContainText(/Request|Pedir/i);
    await expect(page.locator('#cmCuWhen')).toContainText(/approve|aprob/i);

    page.on('dialog', d => d.accept());
    await page.locator('#cmCuAct-days').click();
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

// ── El panel tiene que entrar en la pantalla ─────────────────────────────────
// Se posicionaba al abrirlo, cuando todavía estaba vacío: medía poco, se anclaba debajo del
// botón y después el contenido lo estiraba fuera del viewport. Los botones de confirmar
// quedaban abajo de todo, invisibles, y la lista no scrolleaba hasta ellos.
test.describe('Availability — el panel de llamada entra en la pantalla', () => {
  test('con muchos candidatos y poca altura, el pie sigue visible y la lista scrollea', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await mockAvail(page, { callUps: [], extraCandidates: 40 });
    await gotoGrid(page);

    await page.click('#avCallUpBtn');
    const panel = page.locator('#cmCuPanel');
    await expect(panel).toHaveClass(/is-open/);

    // El panel completo, dentro del viewport.
    const caja = await panel.boundingBox();
    const alto = await page.evaluate(() => window.innerHeight);
    expect(caja).not.toBeNull();
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.y + caja.height).toBeLessThanOrEqual(alto + 1);

    // Y el pie —donde están la tira de días y el botón que cierra la acción— alcanzable.
    await expect(page.locator('#cmCuAct-days')).toBeInViewport();
    await expect(page.locator('#cmCuDays')).toBeInViewport();

    // La lista se hace cargo del sobrante con su propio scroll.
    const scrollea = await page.locator('.cm-cu-list').evaluate(el => el.scrollHeight > el.clientHeight + 2);
    expect(scrollea).toBe(true);
  });
});

// ── Resolver el pedido desde la campana ──────────────────────────────────────
// El DT del filial recibe el aviso mientras hace otra cosa. Mandarlo a abrir Availability para
// apretar un botón es fricción sobre alguien que no pidió nada: se resuelve desde el aviso.
test.describe('Campana — aceptar el pedido sin salir de donde estás', () => {
  const NOTIF = {
    id: 'n-1', user_id: 'user-1', club_id: 'club-1', type: 'call_up_request',
    title: 'First Team is asking for Nico Zeta', body: '1 day(s) · 2026-05-18',
    read: false, link: '/Availability.html', created_at: new Date().toISOString(),
    data: { kind: 'call_up', player_id: 'p-9', player: 'Nico Zeta', team_id: 'team-1',
            team: 'First Team', from: CALL_DAY, to: CALL_DAY, count: 1 },
  };

  test('el aviso trae botones y aceptar manda la decisión', async ({ page }) => {
    const { patched } = await mockAvail(page, {
      callUps: [],
      notifs: [NOTIF],
      pending: [{ id: 'cu-9', player_id: 'p-9', team_id: 'team-1', date: CALL_DAY, created_by: 'user-9' }],
    });
    await gotoGrid(page);

    // El botón de la campana es el que lleva el icono: hay varios .cm-icon-btn en la barra.
    await page.locator('.cm-icon-btn:has(.ti-bell)').first().click();
    const item = page.locator('.cm-ni[data-nid="n-1"]');
    await expect(item).toBeVisible();
    // El texto se compone en el cliente desde `data`, no se usa el title inglés de la base.
    await expect(item).toContainText('Nico Zeta');
    await expect(item.locator('[data-cu-act="yes"]')).toHaveCount(1);

    await item.locator('[data-cu-act="yes"]').click();
    await expect.poll(() => patched.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(patched[0].body.status).toBe('approved');
    expect(patched[0].url).toContain('cu-9');
    // Y el aviso queda resuelto en el lugar, sin botones para apretar dos veces.
    await expect(item.locator('.cm-ni-done')).toHaveCount(1);
    await expect(item.locator('[data-cu-act="yes"]')).toHaveCount(0);
  });

  test('un aviso de llamada DIRECTA no trae botones: es solo para enterarse', async ({ page }) => {
    await mockAvail(page, {
      callUps: [],
      notifs: [{ ...NOTIF, id: 'n-2', type: 'call_up_direct', title: 'First Team called up Nico Zeta' }],
    });
    await gotoGrid(page);
    await page.locator('.cm-icon-btn:has(.ti-bell)').first().click();
    const item = page.locator('.cm-ni[data-nid="n-2"]');
    await expect(item).toBeVisible();
    await expect(item).toContainText('Nico Zeta');
    await expect(item.locator('[data-cu-act]')).toHaveCount(0);
  });
});

// ── Ir para atrás: cancelar un pedido propio ─────────────────────────────────
// Un pedido pendiente NO pone al jugador en la grilla, así que no hay fila con una × donde
// soltarlo: sin este bloque, mandarlo era irreversible hasta que el otro contestara.
test.describe('Availability — cancelar un pedido enviado', () => {
  const MIO = { id: 'cu-5', player_id: 'p-9', team_id: 'team-1', date: CALL_DAY, created_by: 'user-1' };

  test('el pedido propio se ve y se puede cancelar', async ({ page }) => {
    const { deleted } = await mockAvail(page, { callUps: [], canCall: false, pending: [MIO] });
    await gotoGrid(page);

    const inbox = page.locator('#avCallUpInbox');
    await expect(inbox).toBeVisible();
    await expect(inbox).toContainText('ZETA');
    const btn = inbox.locator('.av-callup-req.is-sent button');
    await expect(btn).toHaveCount(1);

    page.on('dialog', d => d.accept());
    await btn.click();
    await expect.poll(() => deleted.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(deleted.some(u => u.includes('player_call_ups'))).toBe(true);
  });

  test('el pedido que mandó OTRA categoría no se cancela desde acá', async ({ page }) => {
    // Mismo jugador y mismo día, pero lo pidió team-2: no es mío, no aparece como enviado.
    await mockAvail(page, { callUps: [], canCall: false, pending: [{ ...MIO, team_id: 'team-2' }] });
    await gotoGrid(page);
    await expect(page.locator('.av-callup-req.is-sent')).toHaveCount(0);
  });
});

// ── La cara del jugador en el picker ─────────────────────────────────────────
// "A veces los entrenadores no conocen bien al jugador": el picker lista gente de otras
// categorías, que es justamente a la que no le ven la cara.
test.describe('Availability — foto en el picker', () => {
  test('cada fila trae su avatar y el zoom se abre al pasar el mouse, sin click', async ({ page }) => {
    await mockAvail(page, { callUps: [] });
    await gotoGrid(page);
    await page.click('#avCallUpBtn');

    const face = page.locator('.cm-cu-opt .cm-cu-face').first();
    await expect(face).toHaveCount(1);
    await expect(face).toHaveClass(/has-face/);

    const zoom = page.locator('#cmCuZoom');
    await expect(zoom).toBeHidden();
    await face.hover();
    await expect(zoom).toBeVisible({ timeout: 5_000 });
    // El casillero NO se marcó: el avatar vive dentro del <label> y un click ahí lo tildaría.
    await expect(page.locator('.cm-cu-opt input[value="p-9"]')).not.toBeChecked();
    // Y muestra de quién es la cara.
    await expect(zoom).toContainText('Zeta');
  });

  test('sin foto cargada no hay zoom: agrandar unas iniciales no dice nada', async ({ page }) => {
    await mockAvail(page, { callUps: [], photo: null });
    await gotoGrid(page);
    await page.click('#avCallUpBtn');
    const face = page.locator('.cm-cu-opt .cm-cu-face').first();
    await expect(face).not.toHaveClass(/has-face/);
    await face.hover();
    await page.waitForTimeout(400);
    await expect(page.locator('#cmCuZoom')).toBeHidden();
  });
});


// ── Elegir el día sin pelearse con la grilla ─────────────────────────────────
// Dos gestos que antes no existían y que comparten el mock de arriba (por eso viven acá):
// el encabezado del día selecciona su columna entera, y el panel de llamada trae su propia
// tira de días en vez de leer las celdas que marcaste en la fila de otro jugador.
test.describe('Availability — el día se elige desde el encabezado', () => {
  test('click en el encabezado marca la columna, y la letra la pinta entera', async ({ page }) => {
    const { avail } = await mockAvail(page, { callUps: [] });
    await gotoGrid(page);

    await page.locator(`#avHead th.day[data-date="${CALL_DAY}"]`).click();

    // Toda la columna del día, y nada del día de al lado.
    await expect(page.locator(`#avBody td.cell[data-date="${CALL_DAY}"].is-selected`)).toHaveCount(2);
    await expect(page.locator('#avBody td.cell[data-date="2026-05-19"].is-selected')).toHaveCount(0);
    await expect(page.locator(`#avHead th.day[data-date="${CALL_DAY}"]`)).toHaveClass(/is-colsel/);
    await expect(page.locator('#bulkBar')).toHaveClass(/is-on/);

    // Y de ahí, el atajo de siempre: A = todos disponibles ESE día.
    await page.keyboard.press('a');
    // Una escritura POR JUGADOR: hay que esperar las dos. Con `> 0` el test leía la primera
    // y comparaba contra una lista a medio llegar.
    await expect.poll(() => avail.length, { timeout: 10_000 }).toBe(2);
    expect(avail.every(r => r.date === CALL_DAY && r.status === 'available')).toBe(true);
    expect(avail.map(r => r.player_id).sort()).toEqual(['p-1', 'p-2']);
  });

  test('volver a clickear el mismo día lo suelta', async ({ page }) => {
    await mockAvail(page, { callUps: [] });
    await gotoGrid(page);
    const th = page.locator(`#avHead th.day[data-date="${CALL_DAY}"]`);
    await th.click();
    await expect(page.locator('#avBody td.cell.is-selected')).toHaveCount(2);
    await th.click();
    await expect(page.locator('#avBody td.cell.is-selected')).toHaveCount(0);
  });

  test('shift+click toma de un día al otro', async ({ page }) => {
    await mockAvail(page, { callUps: [] });
    await gotoGrid(page);
    await page.locator(`#avHead th.day[data-date="${CALL_DAY}"]`).click();
    await page.locator('#avHead th.day[data-date="2026-05-21"]').click({ modifiers: ['Shift'] });
    // 18, 19 y 21 por dos jugadores. El 20 no tiene nada planificado: sus celdas no son
    // editables y quedan afuera, como con cualquier otra selección.
    await expect(page.locator('#avBody td.cell.is-selected')).toHaveCount(6);
  });

  test('el panel de llamada trae su tira de días, y respeta lo que ya marcaste en la grilla', async ({ page }) => {
    const { posted } = await mockAvail(page, { callUps: [] });
    await gotoGrid(page);

    // Marcado previo en la grilla → el panel abre con ese día puesto.
    await page.locator(`#avHead th.day[data-date="${CALL_DAY}"]`).click();
    await page.click('#avCallUpBtn');
    await expect(page.locator(`#cmCuDays button.d[data-date="${CALL_DAY}"]`)).toHaveClass(/on/);
    // Los días sin sesión ni partido no se pueden elegir: llamar a alguien ahí no significa nada.
    await expect(page.locator('#cmCuDays button.d[data-date="2026-05-20"]')).toBeDisabled();

    await page.locator('.cm-cu-opt input[value="p-9"]').check();
    // Sumar el partido, sin volver a la grilla.
    await page.locator('#cmCuDays button.d[data-date="2026-05-21"]').click();
    await page.locator('#cmCuAct-days').click();

    await expect.poll(() => posted.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(posted.flat().map(r => r.date).sort()).toEqual([CALL_DAY, '2026-05-21']);
  });
});
