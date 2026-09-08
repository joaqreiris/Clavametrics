import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// La referencia de partido de Top-Up decide cuántos metros se le prescriben de más o de menos a
// un jugador, y tenía criterio propio: 5 partidos fijos y sin mirar el contexto del trabajo. Esto
// fija el criterio unificado. Se carga el módulo con un `sb` de mentira: es lógica pura, no hace
// falta levantar la página (que además está detrás del guard de planes).

const CLUB = 'club-1';
const MATCHES = [
  { id: 's0', date: '2026-05-10', td: 6000 },
  { id: 's1', date: '2026-04-10', td: 7000 },
  { id: 's2', date: '2026-03-10', td: 8000 },
  { id: 's3', date: '2026-02-10', td: 9000 },
  { id: 's4', date: '2026-01-10', td: 10000 },
];
const ROWS = MATCHES.map((m, i) => ({
  id: 'r' + i, session_id: m.id, player_id: 'p1', club_id: CLUB, is_invalid: false,
  total_distance: m.td, time_played: 90, training_sessions: { session_date: m.date },
}));

/** Constructor encadenable mínimo, al estilo de supabase-js: cada filtro se anota y ya. */
function fakeSb(rows) {
  const q = (table) => {
    const f = { table, filters: {} };
    const api = {
      select: () => api,
      eq: (k, v) => { f.filters[k] = v; return api; },
      in: (k, v) => { f.filters[k] = v; return api; },
      not: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (res) => res({ data: table === 'gps_reports' ? rows(f) : [], error: null }),
    };
    return api;
  };
  return { from: q };
}

beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  window.CM_I18N = null;
  await import('../../assets/topup-calc.js');
});

beforeEach(() => {
  // Por defecto: sin recorte por contexto y con el ajuste del club en 3 partidos.
  window.gpsGetMatchDates = async () => new Set(MATCHES.map(m => m.date));
  window.gpsRefSettings = async () => ({ baseline_n: 3, ref_min_minutes: 0, ref_from_date: null });
  window.gpsScopeMatchRowsToTeam = async (rows) => rows;
  window.sb = fakeSb(() => ROWS.slice());
});

const ref = (mode = 'best') => window.TopUp
  .getReference('p1', CLUB, ['total_distance'], mode, { minMinutes: 0, fromDate: null })
  .then(r => r.total_distance);

describe('Top-Up · referencia de partido', () => {
  it('cuántos partidos entran lo dice el club, no un 5 fijo', async () => {
    const r = await ref();
    expect(r.baseline).toBe(9000);   // (10000 + 9000 + 8000) / 3 — con el 5 fijo daría 8000
    expect(r.count).toBe(3);
  });

  it('«promedio partido» toma todos los partidos', async () => {
    const r = await ref('avg');
    expect(r.baseline).toBe(8000);   // (6+7+8+9+10) mil / 5
    expect(r.count).toBe(5);
  });

  it('un día de sólo top-up no cuenta como partido', async () => {
    // El recorte por contexto se lleva la fila del día más alto: para el jugador no hubo partido.
    window.gpsScopeMatchRowsToTeam = async (rows) => rows.filter(r => r.session_id !== 's4');
    const r = await ref();
    expect(r.baseline).toBe(8000);   // 9000, 8000 y 7000
  });

  it('sin partidos suficientes no inventa una referencia', async () => {
    window.gpsScopeMatchRowsToTeam = async (rows) => rows.slice(0, 2);
    const r = await ref();
    expect(r.baseline).toBeNull();
    expect(r.source).toBe('personal');
  });

  it('si el club no fijó nada, siguen siendo 5', async () => {
    window.gpsRefSettings = async () => ({ baseline_n: null, ref_min_minutes: 0, ref_from_date: null });
    const r = await ref();
    expect(r.baseline).toBe(8000);   // los 5 → (6+7+8+9+10)/5
    expect(r.count).toBe(5);
  });
});
