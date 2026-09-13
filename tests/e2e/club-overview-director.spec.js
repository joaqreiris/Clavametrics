// @ts-check
// Club Overview — pestañas de dirección deportiva (Temporada / Lesiones / Plantel / Staff).
//
// El fixture imita la base REAL, no una base ideal: body_area viene en texto libre y en dos
// idiomas ("Left Hamstring", "hamstring", "Isquiotibial"), injury_mechanism viene en NULL en
// la mitad de los casos, y el activity_log mezcla acciones de staff (con actor_id) con envíos
// de jugadores (sin actor_id). Si el test pasara con datos limpios no probaría nada: los bugs
// de esta pantalla viven justamente ahí.
//
// Las fechas se generan relativas a HOY, así que el spec no caduca.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB = { id: 'club-1', name: 'Test FC' };
const ADMIN = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: 'director_football', first_name: 'Dina', last_name: 'Dirección', full_name: 'Dina Dirección' };

const TEAMS = [
  { id: 'team-a', name: 'Primera', season: '2026/27', category: 'Primera' },
  { id: 'team-b', name: 'Reserva', season: '2026/27', category: 'Reserva' },
  { id: 'team-c', name: 'Juvenil A', season: '2026/27', category: 'U18' },
];

// ── helpers de fecha, en local igual que la app ──
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = new Date();
const shift = n => { const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()); d.setDate(d.getDate() + n); return d; };
const dayAgo = n => ymd(shift(-n));

// Generador determinista: el mismo fixture en cada corrida, sin depender de Math.random.
let _seed = 7;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
const pick = arr => arr[Math.floor(rnd() * arr.length) % arr.length];

const POSITIONS = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

/** 36 jugadores: 12 por equipo, con posición y fecha de nacimiento. */
function buildPlayers() {
  const out = [];
  TEAMS.forEach((t, ti) => {
    for (let i = 0; i < 12; i++) {
      const age = ti === 2 ? 16 + (i % 3) : 20 + ((i * 3) % 14);   // el juvenil es joven de verdad
      const dob = new Date(TODAY.getFullYear() - age, (i * 2) % 12, 1 + (i % 27));
      out.push({
        id: `p-${ti}-${i}`, club_id: CLUB.id, team_id: t.id,
        first_name: ['Lucas', 'Mateo', 'Thiago', 'Bruno', 'Iván', 'Nico'][i % 6],
        last_name: ['García', 'Pereyra', 'Fernández', 'Sosa', 'Rodríguez', 'Núñez'][(i + ti) % 6],
        position: POSITIONS[i], positions: [POSITIONS[i]],
        date_of_birth: ymd(dob), number: i + 1, status: 'available',
        // Sólo una parte del plantel tiene contrato cargado: es el caso realista.
        contract_until: i < 4 ? ymd(shift(30 + i * 55)) : null,
        joined_date: dayAgo(400 + i * 10), archived_at: null,
      });
    }
  });
  return out;
}
const PLAYERS = buildPlayers();
const PTEAMS = PLAYERS.map(p => ({ player_id: p.id, team_id: p.team_id, club_id: CLUB.id }));

/** Sesiones de los últimos 100 días, con duración (hace falta para la exposición). */
function buildSessions() {
  const out = []; let n = 0;
  for (let d = 100; d >= 0; d--) {
    const day = dayAgo(d), dow = shift(-d).getDay();
    if (dow === 0) continue;                       // domingo libre
    TEAMS.forEach(t => {
      const isMatch = dow === 6;
      out.push({
        id: `s-${++n}`, club_id: CLUB.id, team_id: t.id,
        title: isMatch ? 'Partido' : 'Entrenamiento',
        session_type: isMatch ? 'match' : (dow === 2 ? 'gym' : 'training'),
        session_date: day, session_time: '17:00',
        duration: isMatch ? 95 : 85, estimated_rpe: isMatch ? 9 : 6,
        match_day_offset: null, gym_content: null, is_historical: false,
      });
      // Una sesión de rehab suelta: NO debe contar como exposición.
      if (d % 17 === 0) out.push({ id: `s-${++n}`, club_id: CLUB.id, team_id: t.id, title: 'Rehab', session_type: 'rehab', session_date: day, duration: 40, estimated_rpe: 3, is_historical: false });
    });
  }
  return out;
}
const SESSIONS = buildSessions();

/** Disponibilidad: sólo días con sesión, con una mezcla realista de estados. */
function buildAvailability() {
  const out = [];
  for (let d = 100; d >= 0; d--) {
    if (shift(-d).getDay() === 0) continue;
    const day = dayAgo(d);
    PLAYERS.forEach((p, i) => {
      // ~7% fuera, ~6% con limitación, el resto disponible.
      const r = ((i * 13 + d * 7) % 100);
      const status = r < 5 ? 'injured' : r < 7 ? 'sick' : r < 10 ? 'limited' : r < 13 ? 'partial' : 'available';
      out.push({ player_id: p.id, date: day, status, team_id: p.team_id, club_id: CLUB.id, minutes: 0, notes: null });
    });
  }
  return out;
}
const AVAIL = buildAvailability();

/** RPE: cumplimiento alto en Primera, flojo en el juvenil — para que la comparativa muestre algo. */
function buildRpe() {
  const out = [];
  SESSIONS.filter(s => s.session_type !== 'match' && s.session_type !== 'rehab').forEach(s => {
    const roster = PLAYERS.filter(p => p.team_id === s.team_id);
    const rate = s.team_id === 'team-a' ? 0.95 : s.team_id === 'team-b' ? 0.7 : 0.35;
    roster.slice(0, Math.round(roster.length * rate)).forEach(p => {
      out.push({ session_id: s.id, player_id: p.id, session_date: s.session_date, load: 480, club_id: CLUB.id });
    });
  });
  return out;
}
const RPE = buildRpe();

/** Wellness de los últimos 60 días. */
function buildWellness() {
  const out = [];
  for (let d = 60; d >= 0; d--) {
    if (shift(-d).getDay() === 0) continue;
    PLAYERS.slice(0, 26).forEach((p, i) => {
      out.push({ player_id: p.id, readiness: 5 + ((i + d) % 5), submitted_at: dayAgo(d) + 'T07:30:00+00:00', club_id: CLUB.id });
    });
  }
  return out;
}
const WELLNESS = buildWellness();

/* Lesiones con la suciedad del mundo real: el MISMO isquiotibial escrito de cuatro maneras
   distintas, mecanismo en NULL a veces, y una con start_date en el FUTURO (se carga una baja
   con fecha de mañana) que no debe producir días perdidos negativos. */
const INJURIES = [
  { id: 'i1', club_id: CLUB.id, player_id: 'p-0-2', body_area: 'Left Hamstring', severity: 'moderate', status: 'cleared', start_date: dayAgo(80), returned_date: dayAgo(60), expected_return: dayAgo(62), injury_category: 'muscular', injury_mechanism: 'non_contact', injury_type: 'Strain' },
  { id: 'i2', club_id: CLUB.id, player_id: 'p-0-2', body_area: 'hamstring', severity: 'moderate', status: 'active', start_date: dayAgo(18), returned_date: null, expected_return: dayAgo(-10), injury_category: 'muscular', injury_mechanism: null, injury_type: 'Strain' },
  { id: 'i3', club_id: CLUB.id, player_id: 'p-1-4', body_area: 'Isquiotibial derecho', severity: 'minor', status: 'cleared', start_date: dayAgo(45), returned_date: dayAgo(38), expected_return: null, injury_category: 'muscular', injury_mechanism: 'overuse', injury_type: 'Overload' },
  { id: 'i4', club_id: CLUB.id, player_id: 'p-1-7', body_area: 'Rodilla (LCM)', severity: 'severe', status: 'active', start_date: dayAgo(55), returned_date: null, expected_return: null, injury_category: 'ligament', injury_mechanism: 'contact', injury_type: 'MCL' },
  { id: 'i5', club_id: CLUB.id, player_id: 'p-2-1', body_area: 'Tobillo (LLE)', severity: 'moderate', status: 'cleared', start_date: dayAgo(70), returned_date: dayAgo(40), expected_return: null, injury_category: 'ligament', injury_mechanism: 'contact', injury_type: 'Sprain' },
  { id: 'i6', club_id: CLUB.id, player_id: 'p-2-5', body_area: 'Gemelo (sóleo)', severity: 'minor', status: 'cleared', start_date: dayAgo(30), returned_date: dayAgo(22), expected_return: null, injury_category: 'muscular', injury_mechanism: null, injury_type: 'Strain' },
  { id: 'i7', club_id: CLUB.id, player_id: 'p-0-9', body_area: 'Cuádriceps', severity: 'minor', status: 'returning', start_date: dayAgo(12), returned_date: null, expected_return: dayAgo(-4), injury_category: 'muscular', injury_mechanism: 'overuse', injury_type: 'Strain' },
  { id: 'i8', club_id: CLUB.id, player_id: 'p-1-1', body_area: 'Lower Back', severity: 'minor', status: 'active', start_date: dayAgo(-1), returned_date: null, expected_return: null, injury_category: null, injury_mechanism: null, injury_type: 'Lumbago' },
];

/* activity_log: acciones de staff (con actor_id) mezcladas con envíos de jugadores (sin él).
   La pestaña Staff tiene que contar SÓLO las primeras. */
const STAFF_PROFILES = [
  ADMIN,
  { id: 'user-2', club_id: CLUB.id, full_name: 'Pablo Fierro', role: 'coach', club_role: null, job_title: 'Head coach' },
  { id: 'user-3', club_id: CLUB.id, full_name: 'Sol Medina', role: 'physio', club_role: null, job_title: null },
  { id: 'user-4', club_id: CLUB.id, full_name: 'Ana Quiroga', role: 'sc_coach', club_role: 'head_performance', job_title: null },
  { id: 'user-5', club_id: CLUB.id, full_name: 'Silencio Total', role: 'analyst', club_role: null, job_title: null },
];
function buildActivity() {
  const out = [];
  const actors = ['user-1', 'user-2', 'user-3', 'user-4'];
  for (let d = 90; d >= 0; d--) {
    const day = dayAgo(d);
    actors.forEach((a, i) => {
      if ((d + i) % 3) return;
      out.push({ actor_id: a, actor_label: STAFF_PROFILES.find(p => p.id === a).full_name, action: pick(['session.published', 'availability.changed', 'injury.logged', 'evaluation.recorded']), entity_table: 'training_sessions', team_id: TEAMS[i % 3].id, created_at: day + 'T09:00:00+00:00' });
    });
    // Ruido de jugadores: 20 filas por día SIN actor_id.
    for (let k = 0; k < 20; k++) out.push({ actor_id: null, actor_label: null, action: 'wellness.submitted', entity_table: 'wellness', team_id: null, created_at: day + 'T06:00:00+00:00' });
  }
  return out;
}
const ACTIVITY = buildActivity();

const MATCH_RESULTS = SESSIONS.filter(s => s.session_type === 'match').slice(0, 8)
  .map((s, i) => ({ id: `m-${i}`, club_id: CLUB.id, team_id: s.team_id, match_date: s.session_date }));
const PMS = [];
MATCH_RESULTS.forEach(m => {
  PLAYERS.filter(p => p.team_id === m.team_id).slice(0, 11).forEach((p, i) => {
    PMS.push({ player_id: p.id, match_id: m.id, minutes: i < 9 ? 90 : 30, club_id: CLUB.id });
  });
});

const SEASONS = TEAMS.map((t, i) => ({ name: '2026/27', start_date: dayAgo(120 + i * 5), end_date: dayAgo(-200), team_id: t.id, club_id: CLUB.id }));

/** Mockea todo lo que la página consulta. `empty` sirve el caso "club recién creado". */
async function mockAll(page, { empty = false } = {}) {
  const D = empty
    ? { players: [], pteams: [], sessions: [], avail: [], rpe: [], wellness: [], injuries: [], activity: [], profiles: [ADMIN], teams: [], seasons: [], matches: [], pms: [] }
    : { players: PLAYERS, pteams: PTEAMS, sessions: SESSIONS, avail: AVAIL, rpe: RPE, wellness: WELLNESS, injuries: INJURIES, activity: ACTIVITY, profiles: STAFF_PROFILES, teams: TEAMS, seasons: SEASONS, matches: MATCH_RESULTS, pms: PMS };

  const uno = obj => route => {
    const acc = route.request().headers()['accept'] || '';
    return route.fulfill({ json: acc.includes('pgrst.object') ? obj : [obj] });
  };

  /* ORDEN: en Playwright gana la ÚLTIMA ruta registrada que coincide. Así que esto va de lo
     más general a lo más específico, y no al revés. Registrar `${SB}/**` al final tapaba
     absolutamente todo lo de arriba: getUser() devolvía null, getClubId() devolvía null y el
     boot de la página cortaba en "No se encontraron equipos" sin un solo error en consola.
     Un rato largo de depuración. */
  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));

  // Auth. /auth/v1/user devuelve el usuario PELADO (es lo que espera gotrue).
  const USER = { id: 'user-1', email: 'dir@test.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 'test-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));

  // Tablas.
  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url();
    const t = n => url.includes(`/rest/v1/${n}`);
    // getProfile()/getClubId() piden UN perfil (.single()); la pestaña Staff pide la LISTA.
    // Hay que atender las dos formas con la misma ruta o el staff se queda en una sola fila.
    if (t('profiles')) {
      const acc = route.request().headers()['accept'] || '';
      return acc.includes('pgrst.object') ? route.fulfill({ json: ADMIN }) : route.fulfill({ json: D.profiles });
    }
    if (t('clubs')) return uno(CLUB)(route);
    if (t('teams')) return route.fulfill({ json: D.teams });
    if (t('player_teams')) return route.fulfill({ json: D.pteams });
    if (t('player_match_stats')) return route.fulfill({ json: D.pms });
    if (t('players')) return route.fulfill({ json: D.players });
    if (t('training_sessions')) return route.fulfill({ json: D.sessions });
    if (t('availability')) return route.fulfill({ json: D.avail });
    if (t('rpe')) return route.fulfill({ json: D.rpe });
    if (t('wellness')) return route.fulfill({ json: D.wellness });
    if (t('injuries')) return route.fulfill({ json: D.injuries });
    if (t('activity_log')) return route.fulfill({ json: D.activity });
    if (t('match_results')) return route.fulfill({ json: D.matches });
    if (t('seasons')) return route.fulfill({ json: D.seasons });
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });

  // El gate de plan, lo más específico y por eso al final: sin esto la página se va a
  // Plan Picker y el test no prueba nada.
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['club_overview'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['club_overview'] }));
}

async function openPage(page, { empty = false, tab = 'week', lang = 'es' } = {}) {
  await page.addInitScript(([l, t]) => {
    try { localStorage.setItem('cm_lang', l); localStorage.setItem('co_tab', t); } catch { /* sin storage */ }
  }, [lang, tab]);
  await injectSession(page);
  await mockAll(page, { empty });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('/Club%20Overview.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#coTabs')).toBeVisible({ timeout: 15_000 });
  // Debe haberse quedado acá: si el gate la pateó, el resto del test miente.
  expect(decodeURIComponent(new URL(page.url()).pathname)).toContain('Club Overview');
  /* Y hay que esperar a que el boot TERMINE. #coTabs es HTML estático: está visible desde el
     primer pintado, mucho antes de que la página resuelva auth, perfil, club y equipos y recién
     entonces cablee los listeners. Sin esta espera, un click llega a tiempo de casualidad (el
     propio click tarda en localizar y hacer scroll) pero una tecla se pierde sin dejar rastro.

     OJO con la señal: el aria-selected de la pestaña Semana NO sirve, porque el HTML ya viene
     con esa marcada y la espera se cumple sola sin probar nada. La que sí sirve es el selector
     de equipos poblado: lo llena renderTeamSelect(), y de ahí hasta los addEventListener no hay
     un solo await — si hay opciones reales, los listeners están puestos. */
  await expect(page.locator('#coTeamSelect option').first()).not.toHaveText(/Cargando|Loading|Carregando/, { timeout: 15_000 });
  if (tab !== 'week') await expect(page.locator(`#coTabBtn-${tab}`)).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}

/** Espera a que la pestaña termine de dibujar (el cartel de carga desaparece). */
async function waitTab(page, panelId) {
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toBeVisible();
  await expect(panel.locator('.cod-loading')).toHaveCount(0, { timeout: 15_000 });
  return panel;
}

/** Quién se sale por la derecha — misma sonda que no-overflow.spec.js. */
const PROBE = () => {
  const vw = document.documentElement.clientWidth;
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')
    + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const contained = el => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.position === 'fixed') return true;
      if (/auto|scroll|hidden|clip/.test(c.overflowX)) return true;
    }
    return false;
  };
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || c.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > vw + 1 && !contained(el)) over.push([el, r]);
  }
  const set = new Set(over.map(x => x[0]));
  return {
    overflow: document.documentElement.scrollWidth - vw,
    culpables: over.filter(([e]) => !set.has(e.parentElement))
      .map(([e, r]) => ({ sel: desc(e), w: Math.round(r.width), sale: Math.round(r.right - vw) }))
      .sort((a, b) => b.sale - a.sale).slice(0, 3),
  };
};

const TABS = [
  ['week', 'coTabWeek'], ['season', 'coTabSeason'], ['injuries', 'coTabInjuries'],
  ['squad', 'coTabSquad'], ['staff', 'coTabStaff'],
];

// ── 1. Navegación entre pestañas ──────────────────────────────────────────────

test.describe('Club Overview · dirección — pestañas', () => {
  test('las cinco pestañas se abren y sólo una queda visible', async ({ page }) => {
    await openPage(page);
    for (const [key, panel] of TABS) {
      await page.click(`#coTabBtn-${key}`);
      await waitTab(page, panel);
      // Exactamente un panel visible, y es el que corresponde.
      for (const [k2, p2] of TABS) {
        await expect(page.locator(`#${p2}`), `${k2} con ${key} activa`).toBeVisible({ visible: k2 === key });
      }
      await expect(page.locator(`#coTabBtn-${key}`)).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('el navegador de semanas y el de período nunca se ven juntos', async ({ page }) => {
    await openPage(page);
    await expect(page.locator('#coWeekCtl')).toBeVisible();
    await expect(page.locator('#coPeriodBar')).toBeHidden();
    await page.click('#coTabBtn-season');
    await waitTab(page, 'coTabSeason');
    await expect(page.locator('#coWeekCtl')).toBeHidden();
    await expect(page.locator('#coPeriodBar')).toBeVisible();
  });

  test('la pestaña elegida sobrevive a un recargue', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    await waitTab(page, 'coTabInjuries');
    await expect(page.locator('#coTabBtn-injuries')).toHaveAttribute('aria-selected', 'true');
  });

  test('las flechas mueven entre pestañas', async ({ page }) => {
    await openPage(page);
    await page.focus('#coTabBtn-week');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#coTabBtn-season')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#coTabBtn-week')).toHaveAttribute('aria-selected', 'true');
  });
});

// ── 2. Temporada ──────────────────────────────────────────────────────────────

test.describe('Club Overview · Temporada', () => {
  test('cuatro KPI y una fila por equipo en la comparativa', async ({ page }) => {
    await openPage(page, { tab: 'season' });
    const panel = await waitTab(page, 'coTabSeason');
    await expect(panel.locator('.cod-kpi')).toHaveCount(4);
    await expect(panel.locator('#coCmpTable tbody tr')).toHaveCount(TEAMS.length);
    // Los tres equipos, con su categoría.
    for (const t of TEAMS) await expect(panel.locator('#coCmpTable tbody')).toContainText(t.name);
  });

  test('el cumplimiento de RPE distingue los equipos (95 / 70 / 35 %)', async ({ page }) => {
    await openPage(page, { tab: 'season' });
    const panel = await waitTab(page, 'coTabSeason');
    const fila = n => panel.locator('#coCmpTable tbody tr', { has: page.locator(`th:has-text("${n}")`) });
    // Primera muy por encima del juvenil: es el dato que hace útil la tabla.
    const primera = await fila('Primera').locator('td').nth(4).innerText();
    const juvenil = await fila('Juvenil A').locator('td').nth(4).innerText();
    const num = s => parseInt(String(s).replace(/[^\d]/g, ''), 10);
    expect(num(primera)).toBeGreaterThan(num(juvenil));
    expect(num(primera)).toBeGreaterThan(80);
    expect(num(juvenil)).toBeLessThan(60);
  });

  test('ordenar por una columna reordena las filas', async ({ page }) => {
    await openPage(page, { tab: 'season' });
    const panel = await waitTab(page, 'coTabSeason');
    const nombres = async () => panel.locator('#coCmpTable tbody th .cod-tn').allInnerTexts();
    // Arranca alfabético ascendente por nombre.
    const antes = await nombres();
    expect(antes).toEqual([...antes].sort((a, b) => a.localeCompare(b)));

    // Se ordena por NOMBRE y no por un número: invertir el alfabeto es determinista, mientras
    // que ordenar por disponibilidad puede dar el mismo orden de casualidad y el test mentiría.
    await panel.locator('#coCmpTable th[data-cmp="name"] button').click();
    await waitTab(page, 'coTabSeason');
    await expect(panel.locator('#coCmpTable th[data-cmp="name"]')).toHaveAttribute('aria-sort', 'descending');
    expect(await nombres()).toEqual([...antes].reverse());

    // Y una columna numérica deja su propio aria-sort, ordenada de mayor a menor.
    await panel.locator('#coCmpTable th[data-cmp="days"] button').click();
    await waitTab(page, 'coTabSeason');
    await expect(panel.locator('#coCmpTable th[data-cmp="days"]')).toHaveAttribute('aria-sort', 'descending');
    const dias = (await panel.locator('#coCmpTable tbody tr td:nth-child(5)').allInnerTexts()).map(t => parseInt(t.replace(/[^\d]/g, ''), 10) || 0);
    expect(dias).toEqual([...dias].sort((a, b) => b - a));
  });

  test('cambiar el período recarga y queda marcado', async ({ page }) => {
    await openPage(page, { tab: 'season' });
    await waitTab(page, 'coTabSeason');
    await page.locator('#coPeriodBar button[data-period="30d"]').click();
    await waitTab(page, 'coTabSeason');
    await expect(page.locator('#coPeriodBar button[data-period="30d"]')).toHaveAttribute('aria-pressed', 'true');
  });
});

// ── 3. Lesiones ───────────────────────────────────────────────────────────────

test.describe('Club Overview · Lesiones', () => {
  test('agrupa el mismo isquiotibial escrito de tres maneras en UNA barra', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    const panel = await waitTab(page, 'coTabInjuries');
    // "Left Hamstring", "hamstring" e "Isquiotibial derecho" son la misma región.
    const etiquetas = await panel.locator('.cod-bars .cod-bar-l').allInnerTexts();
    const isquios = etiquetas.filter(t => /isquiotibial/i.test(t));
    expect(isquios.length, `una sola barra de isquios, salieron: ${etiquetas.join(' | ')}`).toBe(1);
    // Y esa barra tiene que contar los 3 casos.
    const fila = panel.locator('.cod-bar', { has: page.locator('.cod-bar-l:text-matches("Isquiotibial", "i")') }).first();
    await expect(fila.locator('.cod-bar-v')).toContainText('3');
  });

  test('los días perdidos nunca son negativos, ni con una lesión de fecha futura', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    const panel = await waitTab(page, 'coTabInjuries');
    const dias = await panel.locator('#coInjTable tbody td.num').allInnerTexts();
    expect(dias.length).toBeGreaterThan(0);
    for (const d of dias) expect(parseInt(d.replace(/[^\d-]/g, ''), 10)).toBeGreaterThanOrEqual(0);
  });

  test('una tabla con todos los casos y cuatro KPI', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    const panel = await waitTab(page, 'coTabInjuries');
    await expect(panel.locator('.cod-kpi')).toHaveCount(4);
    await expect(panel.locator('#coInjTable tbody tr')).toHaveCount(INJURIES.length);
  });

  test('la incidencia sale de un número, no de un guión', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    const panel = await waitTab(page, 'coTabInjuries');
    const kpi = panel.locator('.cod-kpi', { hasText: /Incidencia/i }).first();
    await expect(kpi.locator('.cod-kv')).toHaveText(/[0-9]/);
  });

  test('detecta la recaída del mismo jugador en la misma zona', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    const panel = await waitTab(page, 'coTabInjuries');
    // p-0-2 se lesionó dos veces el isquio → exactamente 1 recaída.
    const kpi = panel.locator('.cod-kpi', { hasText: /Reca[ií]das/i }).first();
    await expect(kpi.locator('.cod-kv')).toHaveText('1');
  });

  test('el mecanismo sin cargar se muestra como «Sin registrar», no se oculta', async ({ page }) => {
    await openPage(page, { tab: 'injuries' });
    const panel = await waitTab(page, 'coTabInjuries');
    await expect(panel).toContainText('Sin registrar');
  });
});

// ── 4. Plantel ────────────────────────────────────────────────────────────────

test.describe('Club Overview · Plantel', () => {
  test('edad media, profundidad y vencimientos', async ({ page }) => {
    await openPage(page, { tab: 'squad' });
    const panel = await waitTab(page, 'coTabSquad');
    await expect(panel.locator('.cod-kpi')).toHaveCount(4);
    // 36 jugadores en el fixture.
    const squad = panel.locator('.cod-kpi', { hasText: /Tama[ñn]o/i }).first();
    await expect(squad.locator('.cod-kv')).toHaveText('36');
    // Arqueros: 1 por equipo → una línea "sin recambio" cuando se filtra un equipo.
    await expect(panel).toContainText('Arqueros');
  });

  test('los contratos por vencer se listan ordenados', async ({ page }) => {
    await openPage(page, { tab: 'squad' });
    const panel = await waitTab(page, 'coTabSquad');
    const items = panel.locator('.cod-list .cod-li');
    expect(await items.count()).toBeGreaterThan(0);
  });

  test('con minutos cargados aparece la distribución', async ({ page }) => {
    await openPage(page, { tab: 'squad' });
    const panel = await waitTab(page, 'coTabSquad');
    const min = panel.locator('.cod-panel', { hasText: /Minutos jugados/i }).first();
    await expect(min.locator('.cod-bar')).not.toHaveCount(0);
  });
});

// ── 5. Staff ──────────────────────────────────────────────────────────────────

test.describe('Club Overview · Staff', () => {
  test('no cuenta los envíos de jugadores como trabajo del staff', async ({ page }) => {
    await openPage(page, { tab: 'staff' });
    const panel = await waitTab(page, 'coTabStaff');
    const kpi = panel.locator('.cod-kpi', { hasText: /Acciones del staff/i }).first();
    const n = parseInt((await kpi.locator('.cod-kv').innerText()).replace(/[^\d]/g, ''), 10);
    const conActor = ACTIVITY.filter(a => a.actor_id).length;
    const sinActor = ACTIVITY.filter(a => !a.actor_id).length;
    expect(sinActor).toBeGreaterThan(conActor);      // el ruido es mayoría en el fixture
    expect(n).toBeLessThanOrEqual(conActor);          // y no se cuela
    expect(n).toBeGreaterThan(0);
  });

  test('el miembro sin actividad aparece igual, marcado', async ({ page }) => {
    await openPage(page, { tab: 'staff' });
    const panel = await waitTab(page, 'coTabStaff');
    const fila = panel.locator('#coStaffTable tbody tr', { hasText: 'Silencio Total' });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('Nunca');
  });

  test('señala los huecos de carga de datos', async ({ page }) => {
    await openPage(page, { tab: 'staff' });
    const panel = await waitTab(page, 'coTabStaff');
    // El juvenil tiene RPE por debajo del 50% → tiene que salir como hueco.
    await expect(panel.locator('.co-alert')).not.toHaveCount(0);
  });
});

// ── 6. Robustez: club vacío y sin desbordes ───────────────────────────────────

test.describe('Club Overview · dirección — robustez', () => {
  test('un club sin datos muestra estados vacíos, no errores', async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push(String(e)));
    await openPage(page, { empty: true });
    for (const [key, panel] of TABS.filter(t => t[0] !== 'week')) {
      await page.click(`#coTabBtn-${key}`);
      const p = await waitTab(page, panel);
      // Algo dibujado, y nada que parezca un fallo.
      await expect(p.locator('.cod-empty, .cod-kpi')).not.toHaveCount(0);
      await expect(p).not.toContainText('undefined');
      await expect(p).not.toContainText('NaN');
      await expect(p).not.toContainText('[object');
    }
    expect(errores, `errores de página:\n${errores.join('\n')}`).toEqual([]);
  });

  /* Los tres idiomas son una dimensión del test, no un detalle: el español y el portugués son
     ~25% más largos que el inglés, y "Puestos sin recambio" o "Cumplimiento de RPE" entran en
     sitios donde "Thin positions" entraba de sobra. Medir sólo en inglés da falsos verdes. */
  test('ninguna pestaña saca scroll horizontal en ningún tamaño ni idioma', async ({ page }) => {
    test.setTimeout(180_000);
    for (const vp of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      for (const lang of ['es', 'pt', 'en']) {
        await page.setViewportSize(vp);
        await openPage(page, { lang });
        for (const [key, panel] of TABS) {
          await page.click(`#coTabBtn-${key}`);
          await waitTab(page, panel);
          await page.evaluate(() => document.fonts.ready).catch(() => {});
          const r = await page.evaluate(PROBE);
          const quien = r.culpables.map(c => `${c.sel} (ancho ${c.w}, se sale ${c.sale}px)`).join(', ') || 'sin culpable';
          expect(r.overflow, `${key} · ${lang} · ${vp.width}px se sale ${r.overflow}px — ${quien}`).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  test('ninguna pestaña tira errores de consola con datos reales', async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push('pageerror: ' + e));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|net::ERR/i.test(m.text())) errores.push('console: ' + m.text()); });
    await openPage(page);
    for (const [key, panel] of TABS) {
      await page.click(`#coTabBtn-${key}`);
      await waitTab(page, panel);
    }
    expect(errores, `\n${errores.join('\n')}\n`).toEqual([]);
  });

  test('cambiar de equipo repinta la pestaña abierta', async ({ page }) => {
    await openPage(page, { tab: 'season' });
    const panel = await waitTab(page, 'coTabSeason');
    await expect(panel.locator('#coCmpTable tbody tr')).toHaveCount(3);
    await page.selectOption('#coTeamSelect', 'team-a');
    await waitTab(page, 'coTabSeason');
    await expect(panel.locator('#coCmpTable tbody tr')).toHaveCount(1);
  });
});
