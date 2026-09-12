// @ts-check
// Los minutos de partido los mide el GPS (gps_reports.time_played, vía v_gps_player_minutes).
// Cargarlos a mano sale mal: en MOI Kompong DEWA, de 122 partidos-jugador con los dos datos, 77
// no coincidían — casi siempre porque el número escrito es una convención redonda (90, 60, 15)
// y el medido es otro. La celda vacía se completa sola; la que ya tiene un número distinto NO se
// pisa (es el historial de minutos del club): se marca para que el staff lo revise.

import { test, expect } from '@playwright/test';
import { SB, PROFILE, CLUB, MICROCYCLE, injectSession, mockBase } from './_shared.js';

const ADMIN = { ...PROFILE, role: 'admin', club_role: 'Owner' };
const TEAM  = { id: 'team-1', club_id: 'club-1', name: 'First Team' };
const DIA   = '2026-05-16';   // dentro del microciclo del fixture compartido

const OTRO  = '2026-05-15';   // segunda sesión del microciclo, un día antes

const PLAYERS = [
  { id: 'p-1', club_id: 'club-1', team_id: 'team-1', first_name: 'Vacío',   last_name: 'SINCARGA', number: 5, position: 'CM' },
  { id: 'p-2', club_id: 'club-1', team_id: 'team-1', first_name: 'Difiere', last_name: 'NOCUADRA', number: 9, position: 'FW' },
  { id: 'p-3', club_id: 'club-1', team_id: 'team-1', first_name: 'Sin',     last_name: 'PULSERA',  number: 1, position: 'GK' },
  { id: 'p-4', club_id: 'club-1', team_id: 'team-1', first_name: 'Parcial', last_name: 'CORTITO',  number: 7, position: 'RW' },
];
// p-1 sin minutos cargados; p-2 con 90 a mano y 27 medidos (el caso real de SOCHEAVILA).
// p-3 es el arquero: nunca lleva GPS. El 15 estuvo disponible (le toca la mediana de esa sesión),
// el 16 estaba lesionado (no le toca nada).
const AVAIL = [
  { player_id: 'p-2', date: DIA,  status: 'available', minutes: 90, match_kind: 'official', team_id: null, notes: null },
  { player_id: 'p-3', date: OTRO, status: 'available', minutes: 0,  match_kind: null, team_id: null, notes: null },
  { player_id: 'p-3', date: DIA,  status: 'injured',   minutes: 0,  match_kind: null, team_id: null, notes: null },
];
const GPS_MIN = [
  { player_id: 'p-1', session_date: DIA, minutes: 64 },
  { player_id: 'p-2', session_date: DIA, minutes: 27 },
];
// Los de ENTRENAMIENTO se piden aparte (session_type='training') y NO tocan Availability.
// Dos sesiones: el 15 midió [20, 70, 70] → mediana 70; el 16 midió [55, 60, 60] → mediana 60.
// p-4 es el que se fue antes: arrastra la MEDIA (53) pero no la mediana, que es el punto.
const GPS_TRAIN = [
  { player_id: 'p-1', session_id: 's-a', session_date: OTRO, minutes: 70 },
  { player_id: 'p-2', session_id: 's-a', session_date: OTRO, minutes: 70 },
  { player_id: 'p-4', session_id: 's-a', session_date: OTRO, minutes: 20 },
  { player_id: 'p-1', session_id: 's-b', session_date: DIA,  minutes: 55 },
  { player_id: 'p-2', session_id: 's-b', session_date: DIA,  minutes: 60 },
  { player_id: 'p-4', session_id: 's-b', session_date: DIA,  minutes: 60 },
];

async function abrir(page) {
  const upserts = [];
  await mockBase(page);
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: ['team-1'] }));
  await page.route(`${SB}/rest/v1/**`, async route => {
    const url = route.request().url(), method = route.request().method();
    if (url.includes('/profiles'))        return route.fulfill({ json: ADMIN });
    if (url.includes('/clubs'))           return route.fulfill({ json: CLUB });
    if (url.includes('/teams'))           return route.fulfill({ json: [TEAM] });
    if (url.includes('/microcycles'))     return route.fulfill({ json: [MICROCYCLE] });
    if (url.includes('/players'))         return route.fulfill({ json: PLAYERS });
    if (url.includes('/v_gps_player_minutes')) {
      return route.fulfill({ json: url.includes('training') ? GPS_TRAIN : GPS_MIN });
    }
    if (url.includes('/availability')) {
      if (method === 'GET') return route.fulfill({ json: AVAIL });
      try { upserts.push(...JSON.parse(route.request().postData() || '[]')); } catch { /* patch */ }
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ json: [] });
  });
  await injectSession(page);
  await page.goto('/Availability.html');
  await page.waitForSelector('#avBody tr', { timeout: 15_000 });
  await page.waitForTimeout(1500);
  return upserts;
}

async function abrirStats(page) {
  if (!page.url().includes('Availability')) await abrir(page);
  await page.locator('[data-view="stats"]').click();
  await page.waitForSelector('#viewStats table', { timeout: 15_000 });
  await page.waitForTimeout(1200);
}

test.describe('Availability · minutos que trae el GPS', () => {
  test.describe.configure({ timeout: 60_000 });

  test('la celda vacía se completa con lo que midió el GPS', async ({ page }) => {
    const upserts = await abrir(page);
    const guardado = upserts.find(r => r.player_id === 'p-1' && r.date === DIA);
    expect(guardado, 'tiene que guardar los minutos del que no tenía nada cargado').toBeTruthy();
    expect(guardado.minutes).toBe(64);
  });

  test('la que ya tiene un número distinto NO se pisa, se marca', async ({ page }) => {
    const upserts = await abrir(page);
    const pisado = upserts.find(r => r.player_id === 'p-2' && r.date === DIA && r.minutes === 27);
    expect(pisado, 'el 90 cargado a mano no se sobrescribe solo').toBeFalsy();
    const marcada = page.locator('td.av-cell-match.is-gps-check');
    await expect(marcada).toHaveCount(1);
    await expect(marcada).toHaveAttribute('title', /27/);
    await expect(marcada).toHaveAttribute('title', /90/);
  });

  test('los minutos ENTRENADOS salen en Stats, no en la grilla', async ({ page }) => {
    await abrir(page);
    // La grilla de disponibilidad no muestra minutos de entrenamiento en ninguna celda.
    await abrirStats(page);
    const fila = page.locator('#viewStats table tbody tr', { hasText: 'SINCARGA' }).first();
    // 70 + 55 = 125 minutos entrenados, todos medidos: sin marca de estimación.
    await expect(fila).toContainText("125'");
    await expect(fila.locator('td span[title]')).toHaveCount(0);
  });

  // El arquero no lleva GPS. Contar sólo lo medido lo deja en 0' y el ranking miente: en MOI había
  // tres arqueros en 0' contra ~1.300' del resto. Se le imputa la mediana de cada sesión en la que
  // estuvo, y nada en las que no estuvo.
  test('al que entrenó sin GPS se le imputa la mediana de la sesión', async ({ page }) => {
    await abrirStats(page);
    const fila = page.locator('#viewStats table tbody tr', { hasText: 'PULSERA' }).first();
    // Sólo el 15, que estuvo disponible: mediana 70. El 16 estaba lesionado → no suma.
    // Con la MEDIA hubieran sido 53', que es justo el error que se quiere evitar.
    await expect(fila).toContainText("70'");
    await expect(fila).not.toContainText("130'");
  });

  test('lo estimado se marca y el tooltip abre el desglose', async ({ page }) => {
    await abrirStats(page);
    const celda = page.locator('#viewStats table tbody tr', { hasText: 'PULSERA' }).first().locator('td span[title]');
    await expect(celda).toHaveCount(1);
    await expect(celda).toHaveAttribute('title', /70/);   // los 70' estimados
    await expect(celda).toHaveAttribute('title', /\b1\b/); // en 1 sesión sin registro
  });

  test('el lesionado que no entrenó sigue en cero, no se le regala la mediana', async ({ page }) => {
    await abrirStats(page);
    // p-4 midió las dos sesiones (20 + 60 = 80): lo medido manda, no se le imputa nada.
    const fila = page.locator('#viewStats table tbody tr', { hasText: 'CORTITO' }).first();
    await expect(fila).toContainText("80'");
    await expect(fila.locator('td span[title]')).toHaveCount(0);
  });
});
