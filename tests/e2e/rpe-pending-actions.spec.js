// @ts-check
// RPE — resolver un pendiente sin inventarle un RPE: excusar, ignorar, cargarlo
// a mano o marcar al jugador no disponible desde el «⋯» de la tarjeta.
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, injectSession } from './_shared.js';

const TODAY = new Date();
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = ymd(TODAY);

const SESSION = {
  id: 's-fld', club_id: 'club-1', team_id: 't-1', session_date: HOY,
  session_time: '10:00:00', title: 'Training', session_type: 'training',
  duration: 90, created_at: HOY + 'T09:00:00Z',
};

// 4 jugadores: uno respondió, tres no. Las exenciones se guardan en este mapa,
// que es lo que devuelve la RPC en la recarga siguiente — igual que la DB real.
let exemptions = {};
let insertedRpe = [];
let upsertedAvail = [];

function statusRows() {
  const mk = (i, responded, rpe) => {
    const x = exemptions[`p-${i}`];
    const own = insertedRpe.find(r => r.player_id === `p-${i}`);
    const has = responded || !!own;
    return {
      player_id: `p-${i}`, player_name: `Jugador ${i}`, responded: has,
      rpe: has ? (own ? own.rpe : rpe) : null,
      duration: has ? 90 : null, load: has ? (own ? own.rpe : rpe) * 90 : null,
      body_areas: [], note: '', submitted_at: has ? new Date().toISOString() : null,
      av_status: null,
      exempt_kind: x ? x.kind : null,
      exempt_reason: x ? x.reason : null,
      exempt_note: x ? x.note : null,
      entered_by: own ? 'user-1' : null,
    };
  };
  return [mk(1, true, 7), mk(2, false, 0), mk(3, false, 0), mk(4, false, 0)]
    .filter(r => !upsertedAvail.some(a => a.player_id === r.player_id));
}

test.beforeEach(async ({ page }) => {
  exemptions = {}; insertedRpe = []; upsertedAvail = [];
  await injectSession(page);
  await page.route(`${SB}/**`, async route => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const body = ['POST', 'PATCH'].includes(method) ? req.postDataJSON() : null;
    const j = data => route.fulfill({ json: data });
    if (url.includes('/auth/v1/')) return j({ access_token: 'test-token', user: { id: 'user-1', email: 't@t.com' } });
    // .single() → PostgREST responde el objeto suelto (de ahí sale state.me)
    if (url.includes('/profiles')) {
      const single = (req.headers()['accept'] || '').includes('pgrst.object');
      return j(single ? PROFILE : [PROFILE]);
    }
    if (url.includes('/clubs')) return j([CLUB]);
    if (url.includes('/rpc/session_rpe_status')) return j(statusRows());
    if (url.includes('/rpc/')) return j([]);
    if (url.includes('/rpe_exemptions')) {
      if (method === 'POST') {
        const rows = Array.isArray(body) ? body : [body];
        rows.forEach(r => { exemptions[r.player_id] = r; });
        return j(rows);
      }
      if (method === 'DELETE') {
        const m = /player_id=eq\.([^&]+)/.exec(url);
        if (m) delete exemptions[decodeURIComponent(m[1])];
        return j([]);
      }
      return j([]);
    }
    if (url.includes('/rest/v1/rpe') && method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      insertedRpe.push(...rows);
      return j(rows);
    }
    if (url.includes('/availability') && method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      upsertedAvail.push(...rows);
      return j(rows);
    }
    if (url.includes('/training_sessions')) return j([SESSION]);
    if (url.includes('/teams')) return j([{ id: 't-1', club_id: 'club-1', name: 'First team' }]);
    return j([]);
  });
  await page.goto('/RPE.html');
  await page.waitForSelector('#summaryCard', { state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Pending/i }).click();
});

async function openMenu(page, nth = 0) {
  await page.locator('#listPending .pc.is-pending [data-rowmenu]').nth(nth).click();
  await expect(page.locator('#rpeRowMenu.is-open')).toBeVisible();
}

test('el menú del pendiente ofrece las cuatro salidas', async ({ page }) => {
  await expect(page.locator('#listPending .pc.is-pending')).toHaveCount(3);
  await openMenu(page);
  const menu = page.locator('#rpeRowMenu');
  await expect(menu.locator('[data-act="manual"]')).toBeVisible();
  await expect(menu.locator('[data-act="excuse"]')).toBeVisible();
  await expect(menu.locator('[data-act="ignore"]')).toBeVisible();
  await expect(menu.locator('[data-act="avail"]')).toBeVisible();
});

test('«no corresponde» saca al jugador del total de la sesión', async ({ page }) => {
  await expect(page.locator('#sumDen')).toHaveText('/ 4');
  await openMenu(page);
  await page.locator('#rpeRowMenu [data-act="excuse"]').click();
  await expect(page.locator('#rmExcuseModal.is-open')).toBeVisible();
  await page.locator('input[name="rmExcuseReason"][value="gym_only"]').check();
  await page.locator('#btnExcuseSave').click();
  // total 4 → 3, y el excusado baja a su propio grupo con el motivo a la vista
  await expect(page.locator('#sumDen')).toHaveText('/ 3');
  await expect(page.locator('#listPending .pc.is-pending:not(.is-resolved)')).toHaveCount(2);
  const resolved = page.locator('#listPending .pc.is-resolved');
  await expect(resolved).toHaveCount(1);
  await expect(resolved.locator('.pc-why')).toContainText(/gym|gimnasio/i);
  expect(Object.values(exemptions)[0].kind).toBe('not_required');
  expect(Object.values(exemptions)[0].reason).toBe('gym_only');
});

test('«dejar de insistir» lo saca de pendientes pero no del total', async ({ page }) => {
  await openMenu(page);
  await page.locator('#rpeRowMenu [data-act="ignore"]').click();
  await expect(page.locator('#listPending .pc.is-resolved')).toHaveCount(1);
  // sigue contando como faltante: el total no se toca
  await expect(page.locator('#sumDen')).toHaveText('/ 4');
  await expect(page.locator('#pipPend')).toHaveText('2');
  expect(Object.values(exemptions)[0].kind).toBe('ignored');
});

test('deshacer devuelve al jugador a pendientes', async ({ page }) => {
  await openMenu(page);
  await page.locator('#rpeRowMenu [data-act="ignore"]').click();
  await expect(page.locator('#listPending .pc.is-resolved')).toHaveCount(1);
  await page.locator('[data-unexempt]').first().click();
  await expect(page.locator('#listPending .pc.is-resolved')).toHaveCount(0);
  await expect(page.locator('#listPending .pc.is-pending')).toHaveCount(3);
  expect(Object.keys(exemptions)).toHaveLength(0);
});

test('el RPE cargado a mano cuenta como enviado y queda marcado', async ({ page }) => {
  await openMenu(page);
  await page.locator('#rpeRowMenu [data-act="manual"]').click();
  await expect(page.locator('#rmManualModal.is-open')).toBeVisible();
  await expect(page.locator('#btnManualSave')).toBeDisabled();
  await page.locator('#rmManualScale button[data-v="6"]').click();
  await expect(page.locator('#rmManualLoad')).toContainText('540');   // 6 × 90′
  await page.locator('#btnManualSave').click();
  await expect(page.locator('#pipResp')).toHaveText('2');
  expect(insertedRpe[0].rpe).toBe(6);
  expect(insertedRpe[0].entered_by).toBe('user-1');
  // en la pestaña de respondidos lleva el chip de carga del staff
  await page.getByRole('button', { name: /Responded/i }).click();
  await expect(page.locator('.pc-by-staff')).toHaveCount(1);
});

test('marcar no disponible escribe la disponibilidad del día', async ({ page }) => {
  await openMenu(page);
  await page.locator('#rpeRowMenu [data-act="avail"]').click();
  await expect(page.locator('#rmAvailModal.is-open')).toBeVisible();
  await page.locator('input[name="rmAvailStatus"][value="sick"]').check();
  await page.locator('#btnAvailSave').click();
  await expect(page.locator('#sumDen')).toHaveText('/ 3');
  expect(upsertedAvail[0]).toMatchObject({ status: 'sick', date: HOY, team_id: null });
});

test('en español el menú y los grupos están traducidos', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('cm_lang', 'es'));
  await page.reload();
  await page.waitForSelector('#summaryCard', { state: 'visible' });
  await page.getByRole('button', { name: /Pendientes/i }).click();
  await openMenu(page);
  await expect(page.locator('#rpeRowMenu')).toContainText('No corresponde');
  await expect(page.locator('#rpeRowMenu')).toContainText('Dejar de insistir');
  await page.locator('#rpeRowMenu [data-act="excuse"]').click();
  await expect(page.locator('#rmExcuseModal')).toContainText('Solo gimnasio');
  await expect(page.locator('#btnExcuseSave')).toContainText('Marcar como no corresponde');
});
