// @ts-check
// Shared fixtures and mock helpers for all module specs

export const SB = 'https://xesrumijvdmqjrufgeka.supabase.co';

export const PROFILE = {
  id: 'user-1', club_id: 'club-1',
  first_name: 'Test', last_name: 'User', full_name: 'Test User',
  role: 'coach', club_role: 'Head Coach',
};

export const CLUB = {
  id: 'club-1', name: 'Test FC',
  primary_color: '#3B82F6', logo_url: null,
};

export const PLAYER = {
  id: 'p-1', club_id: 'club-1',
  first_name: 'Lucas', last_name: 'García',
  number: 10, position: 'FW', status: 'active',
  nationality: 'Argentina', date_of_birth: '2000-01-15',
  height: 182, weight: 76, dominant_foot: 'right',
};

export const INJURY = {
  id: 'inj-1', club_id: 'club-1', player_id: 'p-1',
  injury_type: 'Hamstring strain', body_area: 'Right thigh',
  severity: 'moderate', status: 'active',
  start_date: '2026-05-01', expected_return: '2026-05-28', notes: '',
};

export const MICROCYCLE = {
  id: 'mc-1', club_id: 'club-1', name: 'MC 01',
  start_date: '2026-05-14', end_date: '2026-05-21',
  match_date: '2026-05-21', rival: 'Atlético', home_away: 'home',
};

export const SESSION = {
  id: 'sess-1', club_id: 'club-1',
  title: 'MD-3 Training', session_type: 'tactical',
  session_date: '2026-05-18', duration: 90, notes: '',
  session_time: '17:00', location: 'Training Ground',
  rpe_avg: null,
};

/** Injects a fake Supabase session into localStorage before page scripts run. */
export async function injectSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-xesrumijvdmqjrufgeka-auth-token',
      JSON.stringify({
        access_token: 'test-token', token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'test-refresh',
        user: { id: 'user-1', email: 'test@test.com', aud: 'authenticated', role: 'authenticated' },
      })
    );
  });
}

/** Mocks the auth + profile + club endpoints used by supabase-init.js on every page. */
export async function mockBase(page) {
  await page.route(`${SB}/auth/v1/**`, route =>
    route.fulfill({ json: { access_token: 'test-token', user: { id: 'user-1', email: 'test@test.com' } } })
  );
  // Red de contención: lo que la página consulte y el spec no atienda responde vacío en vez de
  // salir a la red real (que contesta 401 y deja secciones enteras sin dibujar). Va PRIMERO: en
  // Playwright gana la última ruta registrada, así que las de abajo —y las del propio spec— la
  // pisan. Sin esto, cada tabla nueva que la app empieza a consultar apaga los specs viejos.
  await page.route(`${SB}/rest/v1/**`, route =>
    route.fulfill({ json: [], headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } })
  );
  await page.route(`${SB}/rpc/**`, route => route.fulfill({ json: [] }));

  // .single() / .maybeSingle() piden el objeto SOLO (Accept: …pgrst.object+json) y devolver un
  // array les da error. getClubId() resuelve el club con .single() sobre profiles, así que con el
  // array quedaba en null — y sin club, media app no consulta nada y se dibuja vacía. Era lo que
  // tenía en rojo a Squad, Hub, Injuries y compañía.
  const uno = (obj) => (route) => {
    const acc = route.request().headers()['accept'] || '';
    return route.fulfill({ json: acc.includes('pgrst.object') ? obj : [obj] });
  };
  await page.route(`${SB}/rest/v1/profiles**`, uno(PROFILE));
  await page.route(`${SB}/rest/v1/clubs**`, uno(CLUB));
}

/**
 * Deja el club (y el usuario) puestos ANTES de que corran los scripts de la página.
 *
 * gp-tabs.js arranca en DOMContentLoaded y lo primero que hace es `await waitForClubId()`, que
 * sondea `window._gpClubId` y a los 12 s SE RINDE: rechaza, el catch lo come con un warning y los
 * dashboards no se cargan nunca. Sin dashboards no se montan las cards del builder, así que el
 * spec se queda esperando un canvas que no va a existir.
 *
 * Los specs de GPS seteaban el club con un page.evaluate DESPUÉS del goto. En una máquina
 * descansada llega a tiempo; con varios workers peleándose la CPU, pasarse de los 12 s es fácil —
 * y ahí el test fallaba por contención con cara de bug del producto. Como cada corrida sorteaba
 * distinto, el grupo de specs en rojo cambiaba solo y parecía aleatorio.
 *
 * Con addInitScript el valor ya está cuando gp-tabs mira, y la carrera desaparece.
 */
export async function seedGpIds(page, clubId, userId = 'user-1') {
  await page.addInitScript(([c, u]) => {
    window._gpClubId = c;
    if (u !== null) window._gpUserId = u;
  }, [clubId, userId]);
}
