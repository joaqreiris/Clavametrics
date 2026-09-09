// @ts-check
// El filtro de POSICIÓN tiene tres niveles: detallado (LB, CM, LW…), básico (FB, MF, WG…) y
// grupo (Defensas, Medios…). La selección se guarda en el nivel ACTIVO, así que compararla contra
// la posición cruda de cada fila sólo funciona para los códigos que se escriben igual en los dos
// niveles — CB y ST. Con «Basic» puesto, el resto no matcheaba ninguna fila: la cascada se
// quedaba sin datos y los demás desplegables se vaciaban.

import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

test.describe.configure({ timeout: 60_000 });

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const DASH = { id: 'dash-1', club_id: CLUB_ID, report_type: 'mgrp', name: 'Load Monitoring', scope: 'squad', is_shared: true, created_by: null };
const PROFILE = { id: 'user-1', club_id: CLUB_ID, first_name: 'Test', last_name: 'User', full_name: 'Test User', role: 'admin', club_role: 'admin' };
const CLUB = { id: CLUB_ID, name: 'Test FC', primary_color: '#3B82F6', logo_url: null };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SESSIONS = [{ id: 's-a', club_id: CLUB_ID, session_date: daysAgo(3), session_type: 'training', team_id: null, microcycle_id: null, is_historical: false }];

// Uno por cada caso: dos que cambian de nombre al subir a básico (LB→FB, CM→MF) y dos que se
// escriben igual en los dos niveles (CB, ST) — que son los que hoy funcionan de casualidad.
const PLAYERS = [
  { id: 'p1', club_id: CLUB_ID, first_name: 'Luis', last_name: 'Lateral', number: 2, position: 'LB', positions: ['LB'], status: 'active' },
  { id: 'p2', club_id: CLUB_ID, first_name: 'Mario', last_name: 'Medio',   number: 5, position: 'CM', positions: ['CM'], status: 'active' },
  { id: 'p3', club_id: CLUB_ID, first_name: 'Carlos', last_name: 'Central', number: 4, position: 'CB', positions: ['CB'], status: 'active' },
  { id: 'p4', club_id: CLUB_ID, first_name: 'Sergio', last_name: 'Punta',   number: 9, position: 'ST', positions: ['ST'], status: 'active' },
];
const REPORTS = PLAYERS.map(p => ({
  player_id: p.id, session_id: 's-a', club_id: CLUB_ID, is_invalid: false, work_context: 'team',
  total_distance: 5000, high_speed_distance: 300, very_high_speed_distance: 100, sprint_distance: 40,
  sprint_count: 3, accelerations: 15, decelerations: 12, max_speed: 27, avg_speed: 6,
  player_load: 250, hmld: 350, time_played: 90, distance_per_minute: 55,
  players: { id: p.id, first_name: p.first_name, last_name: p.last_name, number: p.number, position: p.position, positions: p.positions },
  training_sessions: { session_date: SESSIONS[0].session_date, session_attributes: null, microcycle_id: null, team_id: null, session_type: 'training', match_day_offset: null, season_id: null },
}));

async function open(page) {
  await page.route(`${SB}/rest/v1/**`, r => r.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } }));
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } }));
  await page.route(`${SB}/rest/v1/profiles**`, r => r.fulfill({ json: [PROFILE] }));
  await page.route(`${SB}/rest/v1/clubs**`, r => r.fulfill({ json: [CLUB] }));
  await page.route(`${SB}/rest/v1/club_gps_settings**`, r => r.fulfill({ json: [{ club_id: CLUB_ID, baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false, gps_builder_enabled: true }] }));
  await page.route(`${SB}/rest/v1/gps_metric_definitions**`, r => r.fulfill({ json: [
    { key: 'total_distance', label: 'Total Distance', unit: 'm', kind: 'accum', category: 'distance', is_core: true, decimals: 0, display_order: 1, squad_rollup: true },
  ] }));
  await page.route(`${SB}/rest/v1/training_sessions**`, r => r.fulfill({ json: SESSIONS }));
  await page.route(`${SB}/rest/v1/players**`, r => r.fulfill({ json: PLAYERS }));
  await page.route(`${SB}/rest/v1/gps_reports**`, r => r.fulfill({ json: REPORTS }));
  // La barra pide sus filas por RPC (gps_filter_rows) y sólo cae a gps_reports si el RPC falla:
  // sin este mock se queda sin datos y no ofrece ninguna posición.
  await page.route(`${SB}/rest/v1/rpc/gps_filter_rows`, r => r.fulfill({ json: PLAYERS.map(p => ({
    player_id: p.id, work_context: 'team', session_id: 's-a', session_date: SESSIONS[0].session_date,
    session_attributes: null, match_day_offset: null, microcycle_id: null, team_id: null,
    session_type: 'training', season_id: null,
    first_name: p.first_name, last_name: p.last_name, number: p.number, player_position: p.position,
  })) }));
  await page.route(`${SB}/rest/v1/dashboards**`, r => {
    const acc = r.request().headers()['accept'] || '';
    return r.fulfill({ json: acc.includes('object') ? DASH : [DASH] });
  });
  await page.route(`${SB}/rest/v1/dashboard_cards**`, r => r.fulfill({ json: [] }));
  await injectSession(page);
  await page.goto('/GPS Analysis.html');
  await page.waitForSelector('.gp-fbar-drops', { timeout: 15_000 });
  await page.evaluate((cid) => { window._gpClubId = cid; window._gpUserId = 'user-1'; }, CLUB_ID);
  await page.waitForTimeout(1800);
}

/**
 * Pone jugador + posición (en el nivel dado) y devuelve lo que SOBREVIVE en el estado.
 * La barra poda toda selección que, según los demás filtros, sea imposible: si la posición no
 * matchea ninguna fila, el jugador elegido desaparece del filtro sin que nadie lo toque — que es
 * el síntoma que se ve en pantalla («elijo Basic y se me borran filtros»).
 */
async function pickConJugador(page, gran, pos, playerId) {
  return page.evaluate(async ([g, p, pid]) => {
    window.gpFilterBar.setPosGranularity(g);
    await new Promise(r => setTimeout(r, 400));
    window.gpFilterBar.setValue('player', [pid]);
    await new Promise(r => setTimeout(r, 400));
    window.gpFilterBar.setValue('position', [p]);
    await new Promise(r => setTimeout(r, 800));
    const st = window.gpFilterBar.getState();
    return { positions: st.positions, players: st.playerIds, gran: st.posGranularity };
  }, [gran, pos, playerId]);
}

test.describe('GPS · filtro de posiciones por nivel', () => {
  test('en «básico», MF matchea al mediocampista (CM) y no borra su filtro', async ({ page }) => {
    await open(page);
    const st = await pickConJugador(page, 'basic', 'MF', 'p2');   // p2 juega de CM
    expect(st.gran).toBe('basic');
    expect(st.positions).toEqual(['MF']);
    expect(st.players).toEqual(['p2']);
  });

  test('en «básico», FB matchea al lateral (LB)', async ({ page }) => {
    await open(page);
    const st = await pickConJugador(page, 'basic', 'FB', 'p1');   // p1 juega de LB
    expect(st.positions).toEqual(['FB']);
    expect(st.players).toEqual(['p1']);
  });

  test('los códigos que se escriben igual en los dos niveles siguen funcionando', async ({ page }) => {
    await open(page);
    const st = await pickConJugador(page, 'basic', 'CB', 'p3');
    expect(st.players).toEqual(['p3']);
  });

  test('en «grupo», Defensas alcanza al lateral', async ({ page }) => {
    await open(page);
    const st = await pickConJugador(page, 'group', 'Defenders', 'p1');
    expect(st.gran).toBe('group');
    expect(st.players).toEqual(['p1']);
  });
});
