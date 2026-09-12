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

const PLAYERS = [
  { id: 'p-1', club_id: 'club-1', team_id: 'team-1', first_name: 'Vacío',   last_name: 'SINCARGA', number: 5, position: 'CM' },
  { id: 'p-2', club_id: 'club-1', team_id: 'team-1', first_name: 'Difiere', last_name: 'NOCUADRA', number: 9, position: 'FW' },
];
// p-1 sin minutos cargados; p-2 con 90 a mano y 27 medidos (el caso real de SOCHEAVILA).
const AVAIL = [{ player_id: 'p-2', date: DIA, status: 'available', minutes: 90, match_kind: 'official', team_id: null, notes: null }];
const GPS_MIN = [
  { player_id: 'p-1', session_date: DIA, minutes: 64 },
  { player_id: 'p-2', session_date: DIA, minutes: 27 },
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
    if (url.includes('/v_gps_player_minutes')) return route.fulfill({ json: GPS_MIN });
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
});
