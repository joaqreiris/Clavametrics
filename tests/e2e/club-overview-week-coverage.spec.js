// @ts-check
// Club Overview → pestaña Semana: las dos tarjetas que no distinguían "todo bien" de "sin datos".
//
// Disponibilidad. El modelo de la app es POR EXCEPCIÓN: se carga a quien está fuera y a quien
// no tiene fila se lo da por disponible (avDefaultStatus() en Availability.html). Eso está
// bien, pero hace que un equipo donde NADIE cargó nada se vea igual que uno confirmado sano:
// "38/38 · Todos disponibles". En la base real hay equipos enteros así. El cálculo no cambia
// —sería contradecir a la pantalla de Disponibilidad—; lo que cambia es que la tarjeta ahora
// dice sobre cuántos partes se apoya.
//
// Carga media. El promedio sale de las sesiones que tienen carga (duración × RPE estimado),
// y las que no tienen no entran en el denominador. Sin ese denominador a la vista no se puede
// juzgar el número: es exactamente lo que faltaba para ver los bugs de RPE y de wellness.
// Y sin ninguna sesión con carga mostraba "0 AU", que se lee como una semana suave.
import { test, expect } from '@playwright/test';
import { SB, injectSession } from './_shared.js';

const CLUB = { id: 'club-1', name: 'Test FC' };
const TEAM = { id: 'team-a', name: 'Primera', season: '2026/27', category: 'Primera' };
const ADMIN = { id: 'user-1', club_id: 'club-1', role: 'admin', club_role: null, first_name: 'Ana', last_name: 'Admin', full_name: 'Ana Admin' };

const pad = n => String(n).padStart(2, '0');
const TODAY = new Date();
const HOY = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(TODAY.getDate())}`;

// 12 jugadores en un solo equipo.
const PLAYERS = Array.from({ length: 12 }, (_, i) => ({
  id: `p-${i}`, club_id: CLUB.id, team_id: TEAM.id,
  first_name: 'Juan', last_name: `Pérez ${i}`, position: 'CM', status: 'available', archived_at: null,
}));
const PTEAMS = PLAYERS.map(p => ({ player_id: p.id, team_id: TEAM.id }));

/** Sesiones de HOY (siempre dentro de la semana visible, sea cual sea el día). */
function sessions(conCarga, total) {
  return Array.from({ length: total }, (_, i) => ({
    id: `s-${i}`, club_id: CLUB.id, team_id: TEAM.id, title: `Sesión ${i}`,
    session_type: 'field', session_date: HOY, session_time: '10:00',
    duration: 60,
    // Sin estimated_rpe no hay AU: la sesión existe pero no aporta carga. auOf() en club-overview.js.
    estimated_rpe: i < conCarga ? 7 : null,
    match_day_offset: null, gym_content: null, is_historical: false,
  }));
}

async function mount(page, { avail = [], sess = [], lang = 'es' } = {}) {
  await page.addInitScript(l => { try { localStorage.setItem('cm_lang', l); localStorage.setItem('co_tab', 'week'); } catch { /* sin storage */ } }, lang);
  await injectSession(page);

  // ORDEN: gana la ÚLTIMA ruta que coincide, así que va de lo general a lo específico.
  await page.route(`${SB}/**`, r => r.fulfill({ json: [] }));
  const USER = { id: 'user-1', email: 'a@test.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await page.route(`${SB}/auth/v1/**`, r => r.fulfill({ json: { access_token: 't', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: USER } }));
  await page.route(`${SB}/auth/v1/user**`, r => r.fulfill({ json: USER }));

  await page.route(`${SB}/rest/v1/**`, route => {
    const url = route.request().url();
    const t = n => url.includes(`/rest/v1/${n}`);
    if (t('profiles')) {
      const acc = route.request().headers()['accept'] || '';
      return acc.includes('pgrst.object') ? route.fulfill({ json: ADMIN }) : route.fulfill({ json: [ADMIN] });
    }
    if (t('clubs')) {
      const acc = route.request().headers()['accept'] || '';
      return route.fulfill({ json: acc.includes('pgrst.object') ? CLUB : [CLUB] });
    }
    if (t('teams')) return route.fulfill({ json: [TEAM] });
    if (t('player_teams')) return route.fulfill({ json: PTEAMS });
    if (t('players')) return route.fulfill({ json: PLAYERS });
    if (t('training_sessions')) return route.fulfill({ json: sess });
    if (t('availability')) return route.fulfill({ json: avail });
    return route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0' } });
  });
  await page.route(`${SB}/rest/v1/rpc/**`, r => r.fulfill({ json: [] }));
  await page.route(`${SB}/rest/v1/rpc/my_plan_features**`, r => r.fulfill({ json: ['club_overview'] }));
  await page.route(`${SB}/rest/v1/rpc/team_features**`, r => r.fulfill({ json: ['club_overview'] }));

  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('/Club%20Overview.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#coTabs')).toBeVisible({ timeout: 15_000 });
  expect(decodeURIComponent(new URL(page.url()).pathname)).toContain('Club Overview');
  // El boot terminó cuando el selector de equipos tiene opciones reales (misma señal que el
  // spec de dirección): de ahí a los listeners no hay un solo await.
  await expect(page.locator('#coTeamSelect option').first()).not.toHaveText(/Cargando|Loading|Carregando/, { timeout: 15_000 });
  await expect(page.locator('#coPulse .co-kpi').first()).toBeVisible({ timeout: 15_000 });
}

const card = (page, label) => page.locator('#coPulse .co-kpi').filter({ hasText: label }).first();

test.describe('Semana · disponibilidad', () => {
  test('sin un solo parte no dice "Todos disponibles"', async ({ page }) => {
    await mount(page, { avail: [], sess: sessions(1, 1) });
    const c = card(page, 'Plantel disponible');
    // El número no cambia: sigue siendo la definición por excepción.
    await expect(c.locator('.kv')).toContainText('12');
    await expect(c.locator('.ks')).toContainText('Nada cargado hoy');
    await expect(c.locator('.ks')).not.toContainText('Todos disponibles');
  });

  test('con el plantel entero cargado y nadie fuera, sí lo afirma', async ({ page }) => {
    const avail = PLAYERS.map(p => ({ player_id: p.id, status: 'available', team_id: TEAM.id, notes: null, date: HOY }));
    await mount(page, { avail, sess: sessions(1, 1) });
    const c = card(page, 'Plantel disponible');
    await expect(c.locator('.ks')).toContainText('Todos disponibles');
    await expect(c.locator('.ks')).not.toContainText('sin parte');
  });

  test('con partes parciales cuenta los que faltan sin tocar el número', async ({ page }) => {
    const avail = [
      { player_id: 'p-0', status: 'injured', team_id: null, notes: null, date: HOY },
      { player_id: 'p-1', status: 'available', team_id: TEAM.id, notes: null, date: HOY },
      { player_id: 'p-2', status: 'available', team_id: TEAM.id, notes: null, date: HOY },
    ];
    await mount(page, { avail, sess: sessions(1, 1) });
    const c = card(page, 'Plantel disponible');
    await expect(c.locator('.kv')).toContainText('11');      // 12 − 1 lesionado
    await expect(c.locator('.ks')).toContainText('1 lesionados');
    await expect(c.locator('.ks')).toContainText('9 sin parte');   // 12 − 3 con parte
  });
});

test.describe('Semana · carga media', () => {
  test('muestra sobre cuántas sesiones se promedia', async ({ page }) => {
    await mount(page, { avail: [], sess: sessions(2, 4) });
    const c = card(page, 'Carga media por sesión');
    await expect(c.locator('.kv')).toContainText('420');     // 60 × 7
    await expect(c.locator('.ks')).toContainText('2/4 con carga');
  });

  test('sin ninguna sesión con carga muestra "—" y no "0 AU"', async ({ page }) => {
    await mount(page, { avail: [], sess: sessions(0, 3) });
    const c = card(page, 'Carga media por sesión');
    await expect(c.locator('.kv')).toHaveText('—');
    await expect(c.locator('.kv')).not.toContainText('0');
    await expect(c.locator('.ks')).toContainText('Sin carga registrada');
  });
});

test.describe('Semana · los chips nuevos no rompen la tarjeta', () => {
  /* El peor caso de ancho es la disponibilidad con partes PARCIALES: tres chips seguidos
     (lesionados + otros + sin parte). Y el ancho depende del idioma — es/pt son ~25% más
     largos que en, así que medir sólo en inglés da un verde falso. La barrida de desbordes
     del spec de dirección recorre esta misma pestaña, pero con el plantel cargado: nunca
     llega a dibujar estos chips. */
  test('ni desbordan ni sacan scroll horizontal en los tres idiomas', async ({ page }) => {
    test.setTimeout(180_000);
    const avail = [
      { player_id: 'p-0', status: 'injured', team_id: null, notes: null, date: HOY },
      { player_id: 'p-1', status: 'sick', team_id: null, notes: null, date: HOY },
      { player_id: 'p-2', status: 'away', team_id: TEAM.id, notes: null, date: HOY },
      { player_id: 'p-3', status: 'available', team_id: TEAM.id, notes: null, date: HOY },
    ];
    for (const vp of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      for (const lang of ['es', 'pt', 'en']) {
        await page.setViewportSize(vp);
        await mount(page, { avail, sess: sessions(2, 4), lang });
        await page.evaluate(() => document.fonts.ready).catch(() => {});
        const r = await page.evaluate(() => {
          const doc = document.documentElement;
          let peor = 0;
          document.querySelectorAll('#coPulse .co-kpi').forEach(c => {
            // Contenido más ancho que la propia tarjeta = chips cortados o pisados.
            peor = Math.max(peor, c.scrollWidth - c.clientWidth);
          });
          return { pagina: doc.scrollWidth - doc.clientWidth, tarjeta: peor };
        });
        expect(r.pagina, `página · ${lang} · ${vp.width}px`).toBeLessThanOrEqual(0);
        expect(r.tarjeta, `tarjeta · ${lang} · ${vp.width}px`).toBeLessThanOrEqual(0);
      }
    }
  });
});
