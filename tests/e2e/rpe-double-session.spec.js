// @ts-check
// RPE — día de doble sesión: las sesiones lado a lado y el recordatorio conjunto.
import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, injectSession } from './_shared.js';

const TODAY = new Date();
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = ymd(TODAY);

const SESSIONS = [
  { id: 's-gym', club_id: 'club-1', team_id: 't-1', session_date: HOY, session_time: '08:15:00', title: 'Activation gym', session_type: 'gym', duration: 40, created_at: HOY + 'T08:00:00Z' },
  { id: 's-fld', club_id: 'club-1', team_id: 't-1', session_date: HOY, session_time: '08:30:00', title: 'Training', session_type: 'training', duration: 90, created_at: HOY + 'T08:05:00Z' },
];

function statusRows(sessionId) {
  // gym: 2 respondieron / 2 faltan · campo: 1 respondió / 3 faltan
  const mk = (i, responded, rpe) => ({
    player_id: `p-${i}`, player_name: `Jugador ${i}`, responded,
    rpe: responded ? rpe : null, duration: responded ? 60 : null,
    load: responded ? rpe * 60 : null, body_areas: [], note: '',
    submitted_at: responded ? new Date().toISOString() : null, av_status: null,
  });
  return sessionId === 's-gym'
    ? [mk(1, true, 7), mk(2, true, 5), mk(3, false, 0), mk(4, false, 0)]
    : [mk(1, true, 9), mk(2, false, 0), mk(3, false, 0), mk(5, false, 0)];
}

test.beforeEach(async ({ page }) => {
  await injectSession(page);
  await page.route(`${SB}/**`, async route => {
    const url = route.request().url();
    const post = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    const j = data => route.fulfill({ json: data });
    if (url.includes('/auth/v1/')) return j({ access_token: 'test-token', user: { id: 'user-1', email: 't@t.com' } });
    if (url.includes('/profiles')) return j([PROFILE]);
    if (url.includes('/clubs')) return j([CLUB]);
    if (url.includes('/rpc/session_rpe_status')) return j(statusRows(post && post.p_session_id));
    if (url.includes('/rpc/')) return j([]);
    if (url.includes('/training_sessions')) return j(SESSIONS);
    if (url.includes('/teams')) return j([{ id: 't-1', club_id: 'club-1', name: 'First team' }]);
    return j([]);
  });
  await page.goto('/RPE.html');
  await page.waitForSelector('.rpe-split', { timeout: 15_000 });
});

test('las dos sesiones se ven lado a lado con su contador', async ({ page }) => {
  const cols = page.locator('.rpe-col');
  await expect(cols).toHaveCount(2);
  await expect(cols.nth(0)).toContainText('Activation gym');
  await expect(cols.nth(0)).toContainText('08:15');
  await expect(cols.nth(0).locator('.nums')).toHaveText('2/4');
  await expect(cols.nth(1).locator('.nums')).toHaveText('1/4');
  // en fila, no apiladas
  const a = await cols.nth(0).boundingBox(), b = await cols.nth(1).boundingBox();
  expect(b.x).toBeGreaterThan(a.x + 100);
  expect(Math.abs(b.y - a.y)).toBeLessThan(10);
});

test('la pestaña Pendientes cambia las dos columnas y ofrece recordar a los 5', async ({ page }) => {
  await expect(page.locator('#remindAllBtn')).toContainText('5');
  await page.locator('[data-tab="pending"]').click();
  await expect(page.locator('.rpe-col').nth(0).locator('.pc.is-pending')).toHaveCount(2);
  await expect(page.locator('.rpe-col').nth(1).locator('.pc.is-pending')).toHaveCount(3);
});

test('el modal agrupa a los que faltan por sesión', async ({ page }) => {
  await page.locator('#remindAllBtn').click();
  const modal = page.locator('#rmRemindModal');
  await expect(modal).toHaveClass(/is-open/);
  await expect(modal.locator('.rm-grp')).toHaveCount(2);
  await expect(modal.locator('.rm-grp').nth(0)).toContainText('Activation gym');
  await expect(modal.locator('input[type=checkbox][data-idx]')).toHaveCount(5);
  await expect(page.locator('#btnRemindSendTxt')).toContainText('5');
});

test('el mensaje nombra las dos sesiones y lleva un link suelto', async ({ page }) => {
  await page.addInitScript(() => { window.open = (u) => { window.__waUrl = u; return null; }; });
  await page.reload();
  await page.waitForSelector('.rpe-split');
  await page.locator('#remindAllBtn').click();
  await page.locator('#btnRemindSend').click();
  await expect.poll(() => page.evaluate(() => window.__waUrl)).toContain('wa.me');
  const msg = decodeURIComponent((await page.evaluate(() => window.__waUrl)).split('text=')[1]);
  // el nombre de cada sesión, en negrita de WhatsApp
  expect(msg).toContain('*Activation gym · 08:15*: Jugador 3, Jugador 4');
  expect(msg).toContain('*Training · 08:30*: Jugador 2, Jugador 3, Jugador 5');
});

test('por Telegram el texto va plano, sin asteriscos', async ({ page }) => {
  await page.addInitScript(() => { window.open = (u) => { window.__waUrl = u; return null; }; });
  await page.reload();
  await page.waitForSelector('.rpe-split');
  await page.locator('#remindAllBtn').click();
  await page.locator('#btnRemindTg').click();
  await expect.poll(() => page.evaluate(() => window.__waUrl)).toContain('t.me');
  const msg = decodeURIComponent((await page.evaluate(() => window.__waUrl)).split('&text=')[1]);
  expect(msg).toContain('Activation gym · 08:15: Jugador 3, Jugador 4');
  expect(msg).not.toContain('*');
});

test('con una sola sesión elegida el mensaje la nombra y ata el link', async ({ page }) => {
  await page.addInitScript(() => { window.open = (u) => { window.__waUrl = u; return null; }; });
  await page.reload();
  await page.waitForSelector('.rpe-split');
  await page.locator('#remindAllBtn').click();
  // destildar a los tres del entrenamiento → queda solo el gimnasio
  for (const i of [2, 3, 4]) await page.locator(`input[data-idx="${i}"]`).uncheck();
  await page.locator('#btnRemindSend').click();
  await expect.poll(() => page.evaluate(() => window.__waUrl)).toContain('wa.me');
  const msg = decodeURIComponent((await page.evaluate(() => window.__waUrl)).split('text=')[1]);
  expect(msg).toContain('*Activation gym · 08:15*');
  expect(msg).not.toContain('Training');
});

test('en español los textos nuevos están traducidos', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('cm_lang', 'es'); window.open = (u) => { window.__waUrl = u; return null; }; });
  await page.reload();
  await page.waitForSelector('.rpe-split');
  await expect(page.locator('#pgSub')).toHaveText('Hoy · 2 sesiones');
  await expect(page.locator('.rpe-remind-all .t')).toContainText('Faltan 5 RPE');
  await expect(page.locator('.rpe-col').first()).toContainText('Abrir sesión');
  await page.locator('#remindAllBtn').click();
  await page.locator('#btnRemindSend').click();
  await expect.poll(() => page.evaluate(() => window.__waUrl)).toContain('wa.me');
  const msg = decodeURIComponent((await page.evaluate(() => window.__waUrl)).split('text=')[1]);
  expect(msg).toContain('Recordatorio de RPE');
});

test('abrir una sesión lleva al board y el botón vuelve a las dos', async ({ page }) => {
  await page.locator('.rpe-col').nth(0).locator('[data-pick]').click();
  await expect(page.locator('#summaryCard')).toBeVisible();
  await expect(page.locator('.rpe-split')).toBeHidden();
  await expect(page.locator('#rmBackChooser')).toBeVisible();
  await page.locator('#rmBackChooser').click();
  await expect(page.locator('.rpe-split')).toBeVisible();
  await expect(page.locator('#summaryCard')).toBeHidden();
});

test('dentro del board, recordar sigue funcionando y nombra la sesión', async ({ page }) => {
  await page.addInitScript(() => { window.open = (u) => { window.__waUrl = u; return null; }; });
  await page.reload();
  await page.waitForSelector('.rpe-split');
  await page.locator('.rpe-col').nth(1).locator('[data-pick]').click();   // Training
  await page.locator('[data-tab="pending"]').click();
  await expect(page.locator('#listPending .pc')).toHaveCount(3);
  await page.locator('#remindBtn').click();
  await expect(page.locator('#rmRemindModal')).toHaveClass(/is-open/);
  await expect(page.locator('#rmRemindSess')).toContainText('Training · 08:30');
  await expect(page.locator('#rmRemindModal .rm-grp')).toHaveCount(0);   // una sola sesión: sin subtítulos
  await page.locator('#btnRemindSend').click();
  await expect.poll(() => page.evaluate(() => window.__waUrl)).toContain('wa.me');
  const msg = decodeURIComponent((await page.evaluate(() => window.__waUrl)).split('text=')[1]);
  expect(msg).toContain('Training · 08:30');
});
