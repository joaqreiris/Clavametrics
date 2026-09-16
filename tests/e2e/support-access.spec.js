// @ts-check
// Admin → Seguridad y accesos: el panel con el que el club abre y cierra la puerta.
//
// Existe porque esto NO es una pantalla más: es la parte visible de la promesa que se le hace
// al club ("nadie de ClavaMetrics ve tus datos sin que vos abras, y vas a saber quién entró").
// La base ya la cumple y hay un test SQL que lo prueba (tests/sql/support-access.test.sql).
// Lo que se comprueba aquí es lo otro: que el club lo pueda VER y USAR. Una garantía que no
// se ve no sirve para vender, y un botón que no llama al RPC correcto es peor que no tenerlo
// porque promete algo que no pasa.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const ADMIN = { id:'user-1', club_id:'club-1', role:'admin', club_role:'Owner', full_name:'Test Admin', first_name:'Test', last_name:'Admin' };
const CLUB  = { id:'club-1', name:'Test FC' };

const EN_UNA_HORA = new Date(Date.now() + 3600_000).toISOString();

const LOG = [
  { id:3, event:'resource_viewed', resource:'GPS Analysis.html', actor_id:'pa-1', actor_email:'soporte@clavametrics.com', detail:null, created_at:new Date(Date.now()-120_000).toISOString() },
  { id:2, event:'session_opened',  resource:null, actor_id:'pa-1', actor_email:'soporte@clavametrics.com', detail:null, created_at:new Date(Date.now()-180_000).toISOString() },
  { id:1, event:'grant_opened',    resource:null, actor_id:'user-1', actor_email:'admin@testfc.com',       detail:null, created_at:new Date(Date.now()-240_000).toISOString() },
];

/**
 * Monta Admin.html con el club en el estado que se le pida y abre la pestaña de seguridad.
 * `grants` vacío = puerta cerrada. Devuelve los POST a RPC que hizo la página.
 */
async function montar(page, { grants = [], log = [], restricciones = [], sesiones = [], conflictos = [] } = {}) {
  const rpcs = [];
  const USER = { id:'user-1', email:'admin@testfc.com', aud:'authenticated', role:'authenticated', app_metadata:{}, user_metadata:{} };

  // De lo general a lo específico: en Playwright gana la ÚLTIMA ruta registrada.
  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json:{ access_token:'t', token_type:'bearer', expires_in:3600, refresh_token:'rt', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));
  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url();
    const acc = route.request().headers()['accept'] || '';
    const uno = acc.includes('pgrst.object');
    if (url.includes('/rest/v1/profiles')) return route.fulfill({ json: uno ? ADMIN : [ADMIN] });
    if (url.includes('/rest/v1/clubs'))    return route.fulfill({ json: uno ? CLUB  : [CLUB]  });
    if (url.includes('/rest/v1/support_grants'))       return route.fulfill({ json: grants });
    if (url.includes('/rest/v1/platform_access_log'))  return route.fulfill({ json: log });
    if (url.includes('/rest/v1/support_restrictions')) return route.fulfill({ json: restricciones });
    if (url.includes('/rest/v1/support_sessions'))     return route.fulfill({ json: sesiones });
    return route.fulfill({ json: [], headers:{ 'Content-Range':'0-0/0' } });
  });
  await page.route(`${SB}/rest/v1/rpc/**`, route => {
    const nombre = route.request().url().split('/rpc/')[1].split('?')[0];
    rpcs.push({ nombre, body: route.request().postDataJSON() });
    if (nombre === 'support_conflict_notice') return route.fulfill({ json: conflictos });
    return route.fulfill({ json: [] });
  });

  await page.addInitScript(() => { try { localStorage.setItem('cm_lang','es'); } catch { /* sin storage */ } });
  await injectSession(page);
  await page.goto('/Admin.html', { waitUntil:'domcontentloaded' });

  // El HTML de la pestaña está visible desde el primer pintado; la señal de que el boot
  // terminó es que loadSupportPanel exista, que se define dentro del IIFE con await.
  await page.waitForFunction(() => typeof window.loadSupportPanel === 'function', null, { timeout: 20_000 });
  await page.locator('.ad-tab[data-panel="security"]').click();
  return rpcs;
}

test.describe('Admin — acceso de soporte', () => {

  test('sin ventana abierta dice que la puerta está cerrada y ofrece abrirla', async ({ page }) => {
    await montar(page);
    await expect(page.locator('#supState')).toContainText('La puerta está cerrada', { timeout: 15_000 });
    await expect(page.locator('#supState [data-sup-open="24"]')).toBeVisible();
    await expect(page.locator('#supState [data-sup-open="72"]')).toBeVisible();
    // Y deja claro qué es lo que nadie puede ver.
    await expect(page.locator('#supState')).toContainText('historia clínica');
  });

  test('abrir la puerta manda el club, las horas y el motivo escrito', async ({ page }) => {
    const rpcs = await montar(page);
    await expect(page.locator('#supState')).toContainText('La puerta está cerrada', { timeout: 15_000 });
    await page.locator('#supReason').fill('no me sincroniza el GPS');
    await page.locator('#supState [data-sup-open="24"]').click();

    await expect.poll(() => rpcs.some(r => r.nombre === 'support_grant_open'), { timeout: 10_000 }).toBe(true);
    const llamada = rpcs.find(r => r.nombre === 'support_grant_open');
    expect(llamada.body).toMatchObject({ p_club_id:'club-1', p_hours:24, p_reason:'no me sincroniza el GPS' });
  });

  test('con la ventana abierta se ve hasta cuándo, quién está dentro y cómo cerrarla', async ({ page }) => {
    await montar(page, {
      grants:   [{ id:'g-1', reason:'revisar el GPS', created_at:new Date().toISOString(), expires_at: EN_UNA_HORA, granted_by:'user-1' }],
      sesiones: [{ admin_user_id:'pa-1', reason:'revisar sync', opened_at:new Date().toISOString(), expires_at: EN_UNA_HORA }],
      log: LOG,
    });
    const estado = page.locator('#supState');
    await expect(estado).toContainText('La puerta está abierta', { timeout: 15_000 });
    // Quién está dentro AHORA: se resuelve por el email que guardó el log, no por profiles
    // (un admin de plataforma no está en la tabla de perfiles del club).
    await expect(estado).toContainText('soporte@clavametrics.com');
    await expect(page.locator('#supRevoke')).toBeVisible();
  });

  test('cerrar la puerta revoca ESE permiso', async ({ page }) => {
    const rpcs = await montar(page, {
      grants: [{ id:'g-1', reason:null, created_at:new Date().toISOString(), expires_at: EN_UNA_HORA, granted_by:'user-1' }],
      log: LOG,
    });
    await page.locator('#supRevoke').click({ timeout: 15_000 });
    await expect.poll(() => rpcs.some(r => r.nombre === 'support_grant_revoke'), { timeout: 10_000 }).toBe(true);
    expect(rpcs.find(r => r.nombre === 'support_grant_revoke').body).toMatchObject({ p_grant_id:'g-1' });
  });

  test('el registro dice quién entró y qué abrió, en cristiano', async ({ page }) => {
    await montar(page, { log: LOG });
    const registro = page.locator('#supLog');
    await expect(registro).toContainText('soporte@clavametrics.com', { timeout: 15_000 });
    await expect(registro).toContainText('entró al club');
    await expect(registro).toContainText('abrió una pantalla');
    await expect(registro).toContainText('GPS Analysis.html');
    await expect(registro.locator('.ad-log-row')).toHaveCount(3);
  });

  test('sin accesos previos lo dice en vez de dejar el hueco vacío', async ({ page }) => {
    await montar(page, { log: [] });
    await expect(page.locator('#supLog')).toContainText('Nadie de ClavaMetrics entró nunca', { timeout: 15_000 });
  });

  test('el conflicto declarado se avisa aunque no haya ninguna fila de veto', async ({ page }) => {
    // Esto es lo que de verdad contesta "¿el dueño puede ver mis datos?". No sale de una
    // lista que alguien cargó a mano: sale de que la persona declaró dónde ejerce y este
    // club está en ese país. Un club camboyano que se dé de alta mañana ya lo ve.
    await montar(page, { log: LOG, restricciones: [], conflictos: [
      { admin_email:'reiris.joaquin@gmail.com', country:'Cambodia', started_on:'2026-09-16', ended_on:null, cooloff_months:12, blocked_until:null, note:null },
    ]});
    const vetos = page.locator('#supVetos');
    // Registro formal: es una manifestación con efectos jurídicos, no copy de producto.
    await expect(vetos).toContainText('Declaración de conflicto de interés', { timeout: 15_000 });
    await expect(vetos).toContainText('queda inhabilitado para acceder');
    await expect(vetos).toContainText('aun mediando autorización expresa');
    await expect(vetos).toContainText('irrevocable');
    // Y NO puede decir "no hay nadie vetado" justo debajo: se contradice y le quita
    // credibilidad a lo único que de verdad importa de esta tarjeta.
    await expect(vetos).not.toContainText('No hay nadie vetado');
  });

  test('si esa persona ya se fue, se dice que el veto sigue en enfriamiento', async ({ page }) => {
    await montar(page, { log: LOG, conflictos: [
      { admin_email:'reiris.joaquin@gmail.com', country:'Cambodia', started_on:'2024-01-01', ended_on:'2026-06-30', cooloff_months:12, blocked_until:'2027-06-30', note:null },
    ]});
    const v = page.locator('#supVetos');
    // Fecha CIERTA, no "un período": si no es oponible, no sirve para lo que está puesto.
    await expect(v).toContainText('permanece vigente hasta el', { timeout: 15_000 });
    await expect(v).toContainText('30 de junio de 2027');
    await expect(v).toContainText('período de carencia de 12 meses');
  });

  test('un vetado se puede quitar, y el veto se ofrece sobre quien ya entró', async ({ page }) => {
    await montar(page, { log: LOG, restricciones: [{ admin_user_id:'pa-9', admin_email:'joaquin@clavametrics.com', reason:'trabaja en un rival', created_at:new Date().toISOString() }] });
    const vetos = page.locator('#supVetos');
    await expect(vetos).toContainText('trabaja en un rival', { timeout: 15_000 });
    // Se pinta el email congelado en la fila (migración 167) y NO el uuid: el club no puede
    // resolver el id de un admin de plataforma, así que sin esto la lista era ilegible.
    await expect(vetos).toContainText('joaquin@clavametrics.com');
    await expect(vetos).not.toContainText('pa-9');
    await expect(vetos.locator('[data-sup-unveto="pa-9"]')).toBeVisible();
    // Los candidatos a vetar salen del registro: son los únicos que el club puede identificar.
    await expect(vetos.locator('#supVetoPick option')).toHaveCount(2); // pa-1 y user-1
  });
});
