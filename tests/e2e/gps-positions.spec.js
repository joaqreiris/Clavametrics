// @ts-check
// El filtro de POSICIÓN tiene tres niveles: detallado (LB, CM, LW…), básico (FB, MF, WG…) y
// grupo (Defensas, Medios…). Cada jugador tiene guardada UNA posición, la detallada, así que
// para filtrar en básico hay que proyectarla primero. Dos cosas fallaban:
//
//   1) La selección se comparaba contra la posición CRUDA. Elegías «MF» y se buscaba una fila
//      que dijera «MF», pero la fila dice «CM»: no matcheaba nada. Como la barra poda sola las
//      selecciones que quedaron imposibles, se borraban los OTROS filtros — el síntoma que se
//      veía en pantalla. CB y ST se escriben igual en los dos niveles, así que ésos andaban de
//      casualidad y el resto no: de ahí que pareciera caprichoso.
//   2) Al recargar, el nivel se restauraba pero no se APLICABA: el estado decía «básico» y los
//      botones lo marcaban, pero las filas seguían proyectadas al nivel anterior.
//
// Y una tercera, que apareció escribiendo estos tests: setPosGranularity() pintaba la lista de
// opciones ANTES de recalcular la cascada, así que las filtraba contra el cache del nivel viejo
// y de las nuevas sólo sobrevivían CB y ST. Ése era el «elijo Basic y me desaparecen posiciones».
//
// Cada test dice qué arreglo cubre. Se verificaron reintroduciendo los bugs de a uno: el de la
// comparación y el del orden hacen fallar su test; el del restore NO (ver el aviso más abajo).
// La versión anterior de este spec no cubría ninguno: sondeaba getState() sobre una barra que se
// quedaba sin filas —el club se resolvía por un camino que el test no alimentaba— así que la
// cascada nunca corría y los cuatro tests pasaban en verde con el bug puesto.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 90_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training',
  team_id: null, microcycle_id: null, is_historical: false, match_day_offset: -3 }];

// Uno por caso: dos que CAMBIAN de nombre al subir a básico (LB→FB, CM→MF) y dos que se
// escriben igual en los dos niveles (CB, ST) — los que funcionaban de casualidad.
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Luis',   last_name: 'Lateral', number: 2, position: 'LB', positions: ['LB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Mario',  last_name: 'Medio',   number: 5, position: 'CM', positions: ['CM'], status: 'active' },
  { id: 'p3', club_id: CLUB_ID, first_name: 'Carlos', last_name: 'Central', number: 4, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p4', club_id: CLUB_ID, first_name: 'Tomas',  last_name: 'Punta',   number: 9, position: 'ST', positions: ['ST'], status: 'active' },
];
const REPORTS = PLAYERS.map(p => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000, high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
  sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
  player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null,
    team_id: null, session_type: 'training', match_day_offset: -3, season_id: null },
}));

const CARD = [{ id: 'card-pos', position: 0, source: 'builder', size: 'lg', config: {
  schema: 'gp.card/v1', title: 'Distancia por jugador', viz: 'bars', scope: { level: 'squad' },
  metrics: [{ id: 'total_distance', agg: 'avg' }], dimensions: [{ id: 'player' }],
  range: { type: 'season' }, style: { color: '#15803D' } } }];

async function open(page, { granGuardada = null } = {}) {
  // El club ANTES de que cargue nada. Inyectarlo después del boot deja a la barra arrancando
  // con club_id=undefined: nunca pide sus filas, se queda vacía y la cascada no corre.
  await page.addInitScript(([cid, gran]) => {
    window._gpClubId = cid; window._gpUserId = 'user-1';
    if (!gran) return;
    // Un guardado previo con el nivel elegido: así se ejercita el camino de RESTAURAR.
    const saved = JSON.stringify({ visibleFilters: ['date', 'position'], posGranularity: gran });
    for (const u of ['?', 'user-1']) for (const d of ['default', 'ind', 'grp', 'dash-1']) {
      try { localStorage.setItem(`cm_gpfilters_${u}_${d}`, saved); } catch { /* sin storage */ }
    }
  }, [CLUB_ID, granGuardada]);

  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => {
    const acc = r.request().headers()['accept'] || '';
    const one = acc.includes('object') || /[?&]limit=1(&|$)/.test(r.request().url());
    return r.fulfill({ json: one ? SESSIONS[0] : SESSIONS });
  });
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  // La barra pide sus filas por este RPC. Sin él se queda sin datos y no filtra nada.
  await page.route(`${SB}/rest/v1/rpc/gps_filter_rows`, r => r.fulfill({ json: PLAYERS.map(p => ({
    player_id: p.id, work_context: 'team', session_id: 's-a', session_date: SESSIONS[0].session_date,
    session_attributes: null, match_day_offset: -3, microcycle_id: null, team_id: null,
    session_type: 'training', season_id: null,
    first_name: p.first_name, last_name: p.last_name, number: p.number, player_position: p.position,
  })) }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: CARD }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-sections', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  // La barra saca su club de getClubId(), no de _gpClubId, y en el test esa resolución no llega:
  // se queda con clubId null, nunca pide sus filas y la cascada no corre. Se lo fijamos y se
  // fuerza la recarga; sin esto el test le pide filtrar a una barra vacía y pasa en verde con
  // el bug puesto — que es exactamente lo que hacía la versión anterior de este spec.
  // Primero la card: si se recarga la barra antes de que monte, compite con el render y la card
  // se queda sin dibujar.
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll('.gp-view.is-on .gp-c[data-card-id="card-pos"] canvas').length
  ), { timeout: 30_000 }).toBeGreaterThan(0);

  // Y después las filas de la barra. La barra saca su club de getClubId(), no de _gpClubId, y en
  // el test esa resolución no llega: se queda con clubId null y nunca pide sus filas. Sin filas
  // la cascada sale por la primera línea y NINGÚN filtro recorta nada — que es por lo que la
  // versión anterior de este spec pasaba en verde con el bug reintroducido.
  // El reload va SIN await: si la carga en curso quedó esperando un equipo que nunca llega,
  // esperarla bloquearía el test entero.
  let _filas = 0;
  for (let i = 0; i < 25 && !_filas; i++) {
    _filas = await page.evaluate((cid) => {
      window.getClubId = async () => cid;
      if (!window.gpFilterBar) return 0;
      try { window.gpFilterBar.reload(); } catch (_e) { /* lo reintenta el bucle */ }
      return window.gpFilterBar.getState().rowCount || 0;
    }, CLUB_ID);
    if (!_filas) await page.waitForTimeout(600);
  }
  expect(_filas, 'la barra se quedó sin filas: así la cascada no corre y el test no probaría nada').toBeGreaterThan(0);
}

/** Las posiciones que ofrece el desplegable, en el nivel activo. Se abre el panel primero:
 *  la lista se pinta al abrirlo, no en el boot. */
const opciones = async (page) => {
  await page.evaluate(() => {
    const t = document.querySelector('.fb-drop[data-key="position"] .fb-trigger');
    if (t && !t.closest('.fb-drop').classList.contains('is-open')) t.click();
  });
  await page.waitForTimeout(350);
  return page.evaluate(() =>
    [...document.querySelectorAll('.fb-drop[data-key="position"] .fb-opt input')].map(i => i.value));
};

/** Los jugadores que quedaron en la card — lo que el usuario ve después de filtrar. */
const enLaCard = (page) => page.evaluate(() => {
  const cv = document.querySelector('.gp-view.is-on .gp-c[data-card-id="card-pos"] canvas');
  const ch = cv && window.Chart.getChart(cv);
  return ch ? ch.data.labels.map(String) : [];
});

/** Elige nivel + posición y espera a que las cards se rehagan. */
async function filtrar(page, gran, pos) {
  await page.evaluate(async ([g, p]) => {
    window.gpFilterBar.setPosGranularity(g);
    await new Promise(r => setTimeout(r, 300));
    window.gpFilterBar.setValue('position', [p]);
  }, [gran, pos]);
  await page.waitForTimeout(2200);
}

test.describe('GPS · filtro de posiciones por nivel', () => {
  test('sin filtro están los cuatro', async ({ page }) => {
    await open(page);
    expect(await enLaCard(page)).toHaveLength(4);
  });

  test('en «básico», MF deja sólo al mediocampista (que está cargado como CM)', async ({ page }) => {
    await open(page);
    await filtrar(page, 'basic', 'MF');
    const vistos = await enLaCard(page);
    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toContain('Medio');
  });

  test('en «básico», FB deja sólo al lateral (cargado como LB)', async ({ page }) => {
    await open(page);
    await filtrar(page, 'basic', 'FB');
    const vistos = await enLaCard(page);
    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toContain('Lateral');
  });

  test('los códigos que se escriben igual en los dos niveles siguen andando', async ({ page }) => {
    await open(page);
    await filtrar(page, 'basic', 'CB');
    const vistos = await enLaCard(page);
    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toContain('Central');
  });

  test('en «grupo», Defensas alcanza al lateral Y al central', async ({ page }) => {
    await open(page);
    await filtrar(page, 'group', 'Defenders');
    const vistos = await enLaCard(page);
    expect(vistos).toHaveLength(2);
    expect(vistos.join(' ')).toContain('Lateral');
    expect(vistos.join(' ')).toContain('Central');
  });

  test('el desplegable ofrece los códigos del nivel activo, no los del anterior', async ({ page }) => {
    await open(page);
    expect(await opciones(page)).toContain('LB');          // detallado: el crudo
    await page.evaluate(() => window.gpFilterBar.setPosGranularity('basic'));
    await page.waitForTimeout(800);
    const basicas = await opciones(page);
    expect(basicas).toContain('FB');                       // proyectado
    expect(basicas).not.toContain('LB');
  });

  // El síntoma que se veía en pantalla: la barra poda sola las selecciones que, según los otros
  // filtros, quedaron imposibles. Comparando «MF» contra la posición CRUDA de la fila («CM») no
  // matcheaba ninguna, así que el jugador elegido se borraba solo — «elijo Basic y se me van los
  // filtros». Este caso es el que ejercita esa comparación; el efecto en la card no sirve para
  // detectarlo, porque las cards filtran por su propio camino (el resolver), no por la cascada.
  test('con un jugador ya elegido, filtrar por su posición en «básico» no lo borra', async ({ page }) => {
    await open(page);
    await page.evaluate(async () => {
      window.gpFilterBar.setPosGranularity('basic');
      await new Promise(r => setTimeout(r, 300));
      window.gpFilterBar.setValue('player', ['p2']);      // el mediocampista, cargado como CM
      await new Promise(r => setTimeout(r, 400));
      window.gpFilterBar.setValue('position', ['MF']);
    });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => window.gpFilterBar.getState());
    expect(st.playerIds).toEqual(['p2']);                 // sigue elegido
    expect(st.positions).toEqual(['MF']);
  });

  // El tercer arreglo: al recargar, el nivel guardado se restauraba pero no se APLICABA — el
  // estado y los botones decían «básico» y la lista seguía ofreciendo los detallados.
  //
  // AVISO: este test comprueba el resultado correcto, pero NO cubre ese arreglo. Comprobado
  // quitando las dos llamadas del restore: sigue pasando en verde. La razón es el arnés — para
  // que la barra tenga datos hay que forzarle un reload(), y esa recarga re-proyecta todo por su
  // cuenta, así que tapa justo el síntoma. En producción el bug se ve en la ventana entre que se
  // restaura el filtro y llegan los datos. Si se toca esa parte, hay que probarla a mano.
  test('un nivel guardado se aplica al recargar, no sólo se recuerda', async ({ page }) => {
    await open(page, { granGuardada: 'basic' });
    const ops = await opciones(page);
    expect(ops).toContain('FB');
    expect(ops).not.toContain('LB');
    const marcado = await page.evaluate(() =>
      document.querySelector('.fb-drop[data-key="position"] [data-gran].is-on')?.dataset.gran || null);
    expect(marcado).toBe('basic');
  });
});
