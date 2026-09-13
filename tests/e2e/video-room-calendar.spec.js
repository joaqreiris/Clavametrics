// @ts-check
import { test, expect } from '@playwright/test';
import { SB, injectSession, mockBase } from './_shared.js';

// Un día con DOS entrenamientos y material repartido: es el caso que distingue
// "los videos de este entrenamiento" de "los videos de este día".
const DAY = '2026-05-18';

const SESSIONS = [
  { id: 'sess-1', club_id: 'club-1', team_id: null, title: 'MD-3 Tactical', session_type: 'tactical', session_date: DAY, match_day_offset: -3, session_time: '17:00' },
  { id: 'sess-2', club_id: 'club-1', team_id: null, title: 'Gym', session_type: 'gym', session_date: DAY, match_day_offset: -3, session_time: '10:00' },
];

const FOLDERS = [
  { id: 'f-1', club_id: 'club-1', team_id: null, name: 'MD-3 Tactical — 18 may', created_by: 'user-1', created_by_name: 'Test User', event_date: DAY, event_id: null, session_id: 'sess-1' },
];

const VIDEOS = [
  { id: 'v-1', club_id: 'club-1', team_id: null, title: 'Rondo 4v2', provider: 'google_drive', url: 'https://drive.google.com/file/d/1', kind: 'video', folder_id: 'f-1', event_date: DAY, uploaded_by: 'user-1' },
  { id: 'v-2', club_id: 'club-1', team_id: null, title: 'Sentadilla búlgara', provider: 'google_drive', url: 'https://drive.google.com/file/d/2', kind: 'video', folder_id: null, event_date: DAY, uploaded_by: 'user-1' },
  { id: 'v-3', club_id: 'club-1', team_id: null, title: 'Suelto sin vínculo', provider: 'other', url: 'https://example.com/3', kind: 'video', folder_id: null, event_date: DAY, uploaded_by: 'user-1' },
];

const VIDEO_SESSIONS = [
  { video_id: 'v-1', session_id: 'sess-1' },
  { video_id: 'v-2', session_id: 'sess-2' },
];

async function mockRoom(page) {
  await mockBase(page);
  await page.route(`${SB}/rest/v1/videos**`, r => r.fulfill({ json: VIDEOS }));
  await page.route(`${SB}/rest/v1/video_folders**`, r => r.fulfill({ json: FOLDERS }));
  await page.route(`${SB}/rest/v1/video_sessions**`, r => r.fulfill({ json: VIDEO_SESSIONS }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  // El gate de plan va al final: sin esto la página se va al teaser y no dibuja nada.
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['video-room'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['video-room'] }));
}

const cell = page => page.locator(`.vc-cell[data-day="${DAY}"]`);
const dayRows = page => page.locator('#vcDay .vc-row .nm');

test.describe('Video Room · calendario → videos del entrenamiento', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockRoom(page);
    await page.goto(`/Video%20Room?date=${DAY}`);
    await expect(cell(page)).toBeVisible();
  });

  test('el chip del entrenamiento abre sólo su carpeta y sus videos', async ({ page }) => {
    await cell(page).locator('[data-evt-id="sess-1"]').click();

    await expect(dayRows(page)).toHaveText(['MD-3 Tactical — 18 may', 'Rondo 4v2']);
    // Lo del otro entrenamiento del mismo día no se cuela.
    await expect(page.locator('#vcDay')).not.toContainText('Sentadilla búlgara');
    await expect(page.locator('#vcDay')).not.toContainText('Suelto sin vínculo');
  });

  test('el chip cuenta el material del entrenamiento', async ({ page }) => {
    await expect(cell(page).locator('[data-evt-id="sess-1"] .n')).toHaveText('2');  // carpeta + video
    await expect(cell(page).locator('[data-evt-id="sess-2"] .n')).toHaveText('1');
  });

  test('el contador de videos del día lista los tres', async ({ page }) => {
    await cell(page).locator('[data-jump="videos"]').click();
    await expect(dayRows(page)).toHaveText([
      'MD-3 Tactical — 18 may', 'Rondo 4v2', 'Sentadilla búlgara', 'Suelto sin vínculo',
    ]);
  });

  test('desde la carpeta del día se entra a la biblioteca y se vuelve al calendario', async ({ page }) => {
    await cell(page).locator('[data-evt-id="sess-1"]').click();
    await page.locator('#vcDay .vc-row[data-open-folder="f-1"]').click();

    await expect(page.locator('#vrCrumbName')).toContainText('MD-3 Tactical — 18 may');
    await expect(page.locator('#vrGrid .vr-card')).toHaveCount(1);

    await page.locator('#vrBackBtn').click();
    // Vuelve al día y al entrenamiento donde estaba, no a la raíz de la biblioteca.
    await expect(page.locator('#vrCal')).toBeVisible();
    await expect(dayRows(page)).toHaveText(['MD-3 Tactical — 18 may', 'Rondo 4v2']);
  });
});
