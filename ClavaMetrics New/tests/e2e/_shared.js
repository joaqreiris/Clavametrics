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
  await page.route(`${SB}/rest/v1/profiles**`, route =>
    route.fulfill({ json: [PROFILE] })
  );
  await page.route(`${SB}/rest/v1/clubs**`, route =>
    route.fulfill({ json: [CLUB] })
  );
}
