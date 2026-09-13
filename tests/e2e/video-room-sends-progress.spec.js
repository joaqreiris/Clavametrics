// @ts-check
import { test, expect } from '@playwright/test';
import { SB, injectSession, mockBase } from './_shared.js';

// Un envío de dos cortes a tres jugadores, con las tres situaciones que el panel
// tiene que saber distinguir: el que vio todo, el que vio a medias y el que abrió
// el link sin que se pueda medir la reproducción.
const VIDEOS = [
  { id: 'v-1', club_id: 'club-1', team_id: null, title: 'Presión tras pérdida', provider: 'dropbox', url: 'https://www.dropbox.com/s/a/1.mp4', kind: 'video', folder_id: null, event_date: '2026-09-10', uploaded_by: 'user-1' },
  { id: 'v-2', club_id: 'club-1', team_id: null, title: 'Salida desde el arquero', provider: 'dropbox', url: 'https://www.dropbox.com/s/b/2.mp4', kind: 'video', folder_id: null, event_date: '2026-09-10', uploaded_by: 'user-1' },
];

const ITEMS = [
  { video_id: 'v-1', position: 0, comment: null, start_seconds: null },
  { video_id: 'v-2', position: 1, comment: null, start_seconds: null },
];

const base = { batch_id: 'b-1', title: 'Cortes del sábado', message: null, created_at: '2026-09-10T10:00:00Z', expires_at: null, revoked: false, created_by_name: 'Profe', video_share_items: ITEMS };

const SHARES = [
  {
    ...base, id: 's-1', token: 't-1', player_id: 'p-1', opened_at: '2026-09-10T12:00:00Z', open_count: 2, seen_at: null,
    players: { first_name: 'Lucas', last_name: 'García', number: 10 },
    // Vio el primero entero y dejó el segundo por la mitad.
    video_share_views: [
      { video_id: 'v-1', play_count: 1, watched_seconds: 58, max_position_seconds: 60, duration_seconds: 60, completed: true,  visible_seconds: 70, tracking: 'player', first_played_at: '2026-09-10T12:00:10Z' },
      { video_id: 'v-2', play_count: 1, watched_seconds: 40, max_position_seconds: 45, duration_seconds: 90, completed: false, visible_seconds: 50, tracking: 'player', first_played_at: '2026-09-10T12:01:00Z' },
    ],
  },
  {
    ...base, id: 's-2', token: 't-2', player_id: 'p-2', opened_at: '2026-09-10T13:00:00Z', open_count: 1, seen_at: '2026-09-10T13:05:00Z',
    players: { first_name: 'Mateo', last_name: 'López', number: 4 },
    // Marcó "visto", pero del primero sólo se sabe que estuvo en pantalla.
    video_share_views: [
      { video_id: 'v-1', play_count: 0, watched_seconds: 0, max_position_seconds: 0, duration_seconds: null, completed: false, visible_seconds: 35, tracking: 'viewport', first_played_at: null },
    ],
  },
  {
    ...base, id: 's-3', token: 't-3', player_id: 'p-3', opened_at: '2026-09-10T14:00:00Z', open_count: 1, seen_at: null,
    players: { first_name: 'Bruno', last_name: 'Pérez', number: 7 },
    video_share_views: [
      { video_id: 'v-1', play_count: 1, watched_seconds: 60, max_position_seconds: 60, duration_seconds: 60, completed: true, visible_seconds: 62, tracking: 'player', first_played_at: '2026-09-10T14:00:20Z' },
      { video_id: 'v-2', play_count: 2, watched_seconds: 95, max_position_seconds: 90, duration_seconds: 90, completed: true, visible_seconds: 99, tracking: 'player', first_played_at: '2026-09-10T14:02:00Z' },
    ],
  },
];

async function mockRoom(page, opts = {}) {
  await mockBase(page);
  await page.route(`${SB}/rest/v1/videos**`, r => r.fulfill({ json: VIDEOS }));
  await page.route(`${SB}/rest/v1/video_folders**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/video_shares**`, r => {
    const wantsViews = /video_share_views/.test(r.request().url());
    // Con la migración sin aplicar, PostgREST rechaza la columna que no existe.
    if (wantsViews && opts.noViewsTable) {
      return r.fulfill({ status: 400, json: { message: "Could not find a relationship between 'video_shares' and 'video_share_views'" } });
    }
    const rows = [...SHARES, ...(opts.extraShares || [])];
    return r.fulfill({ json: wantsViews ? rows : rows.map(({ video_share_views, ...rest }) => rest) });
  });
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['video-room'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['video-room'] }));
}

// Los dos casos de "todavía no hay medición": el que abrió el link antes de que
// existiera (no se puede saber) y el que ni lo abrió (el 0/N sí es verdad).
const SIN_MEDICION = [
  { ...base, id: 's-4', token: 't-4', player_id: 'p-4', opened_at: '2026-09-01T10:00:00Z', open_count: 3, seen_at: '2026-09-01T10:30:00Z',
    players: { first_name: 'Tomás', last_name: 'Silva', number: 2 }, video_share_views: [] },
  { ...base, id: 's-5', token: 't-5', player_id: 'p-5', opened_at: null, open_count: 0, seen_at: null,
    players: { first_name: 'Iván', last_name: 'Rossi', number: 5 }, video_share_views: [] },
];

const recip = (page, name) => page.locator('.vr-recip', { hasText: name });

test.describe('Video Room · Enviados con control de visionado', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockRoom(page);
    await page.goto('/Video%20Room?tab=sends');
    await expect(page.locator('.vr-send')).toHaveCount(1);
  });

  test('cada jugador muestra cuántos cortes abrió y cuántos terminó', async ({ page }) => {
    await expect(recip(page, 'García').locator('.pgsum')).toContainText('2/2');
    await expect(recip(page, 'García').locator('.pgsum')).toContainText('1');    // uno completo
    await expect(recip(page, 'López').locator('.pgsum')).toContainText('1/2');
    await expect(recip(page, 'Pérez').locator('.pgsum')).toContainText('2/2');
    // El que los vio todos es el único en verde.
    await expect(recip(page, 'Pérez').locator('.pgsum')).toHaveClass(/ok/);
    await expect(recip(page, 'García').locator('.pgsum')).toHaveClass(/mid/);
  });

  test('el resumen del envío cuenta a los que reprodujeron todo, no a los que lo marcaron', async ({ page }) => {
    // Marcó "visto" uno solo (López) y vio todo otro distinto (Pérez): los dos datos conviven.
    await expect(page.locator('.vr-send .st').first()).toContainText('1/3');
    await expect(page.locator('.vr-send .st').nth(1)).toContainText('1/3');
    await expect(page.locator('.vr-send .st').nth(1)).toContainText(/saw every clip|vieron todo|viram tudo/);
  });

  test('el detalle se despliega corte por corte', async ({ page }) => {
    const prog = page.locator('[data-prog="s-1"]');
    await expect(prog).toBeHidden();
    await recip(page, 'García').locator('.exp').click();
    await expect(prog).toBeVisible();

    const rows = prog.locator('.vr-pg-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Presión tras pérdida');
    await expect(rows.nth(0)).toContainText(/Watched to the end|Visto hasta el final|Visto até ao fim/);
    await expect(rows.nth(1)).toContainText('50%');           // 45 de 90 segundos
    await expect(rows.nth(1)).toContainText('0:40');          // lo realmente reproducido

    await recip(page, 'García').locator('.exp').click();
    await expect(prog).toBeHidden();
  });

  test('lo que no se pudo medir se muestra como estimado, no como visto', async ({ page }) => {
    await recip(page, 'López').locator('.exp').click();
    const prog = page.locator('[data-prog="s-2"]');
    const rows = prog.locator('.vr-pg-row');

    await expect(rows.nth(0)).toContainText(/on screen \(estimate\)|en pantalla \(estimado\)|no ecrã \(estimado\)/);
    await expect(rows.nth(0)).toContainText('0:35');
    // El corte que ni abrió queda explícitamente sin abrir.
    await expect(rows.nth(1)).toContainText(/Not opened|Sin abrir|Não aberto/);
    // Y la nota aclara por qué de esos cortes no hay reproducción.
    await expect(prog.locator('.pgnote')).toBeVisible();
  });
});

test('sin la tabla de visionado, la pestaña sigue funcionando como antes', async ({ page }) => {
  await injectSession(page);
  await mockRoom(page, { noViewsTable: true });
  await page.goto('/Video%20Room?tab=sends');

  await expect(page.locator('.vr-send')).toHaveCount(1);
  await expect(page.locator('.vr-recip')).toHaveCount(3);
  await expect(page.locator('.vr-recip .pgsum')).toHaveCount(0);   // sin el dato, sin el chip
  await expect(page.locator('.vr-recip', { hasText: 'López' })).toContainText(/Watched|Visto|Visualizado/);
});

test.describe('Video Room · envíos anteriores a la medición', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockRoom(page, { extraShares: SIN_MEDICION });
    await page.goto('/Video%20Room?tab=sends');
    await expect(page.locator('.vr-send')).toHaveCount(1);
  });

  test('el que abrió el link antes de la medición no muestra un 0/N falso', async ({ page }) => {
    // Marcó "visto" y abrió tres veces: decir "0/2 cortes abiertos" sería mentir.
    await expect(recip(page, 'Silva')).toContainText(/Watched|Visto|Visualizado/);
    await expect(recip(page, 'Silva').locator('.pgsum')).toHaveCount(0);
    await expect(recip(page, 'Silva').locator('.exp')).toHaveCount(0);
  });

  test('el que nunca abrió el link sí muestra el cero', async ({ page }) => {
    await expect(recip(page, 'Rossi').locator('.pgsum')).toContainText('0/2');
  });

  test('el resumen del envío cuenta sobre los medidos, no sobre todos', async ({ page }) => {
    // Medibles: García, López, Pérez y Rossi (nunca abrió). Silva queda fuera.
    await expect(page.locator('.vr-send .st').nth(1)).toContainText('1/4');
  });
});
