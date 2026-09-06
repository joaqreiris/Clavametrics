// @ts-check
// Non-empty GPS fixtures for the smoke tests. The existing gps-builder.spec.js mocks
// training_sessions / gps_reports / players as EMPTY on purpose (it tests the builder
// chrome). These fixtures feed the RENDER pipeline so the smoke tests can prove cards
// actually draw with data — the case the empty mock can never catch.
//
// RELIABILITY: session dates are RELATIVE to today (default preset is `last30`, and
// getDateRange() uses the real clock), so the data always falls inside the active window.
// Hard-coded dates would drift out of range and make the suite flaky over time.
// All values are DETERMINISTIC (no Math.random) — a stable fixture is part of not-flaky.

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const SMOKE_SESSIONS = [
  { id: 's1', club_id: 'club-1', session_date: daysAgo(2),  is_historical: false },
  { id: 's2', club_id: 'club-1', session_date: daysAgo(6),  is_historical: false },
  { id: 's3', club_id: 'club-1', session_date: daysAgo(11), is_historical: false },
];

export const SMOKE_PLAYERS = [
  { id: 'p1', club_id: 'club-1', first_name: 'Lucas', last_name: 'García',  number: 10, position: 'FW', positions: ['FW'], status: 'active' },
  { id: 'p2', club_id: 'club-1', first_name: 'Marco', last_name: 'Rossi',   number: 6,  position: 'MF', positions: ['MF'], status: 'active' },
  { id: 'p3', club_id: 'club-1', first_name: 'Ivan',  last_name: 'Petrov',  number: 4,  position: 'DF', positions: ['DF'], status: 'active' },
];

// Catalog — canonical units (m, km/h, AU). Enough for labels/units to resolve.
export const SMOKE_METRICS = [
  { key: 'total_distance',          label: 'Total Distance',      unit: 'm',     kind: 'accum', category: 'distance',     is_core: true, decimals: 0, display_order: 1,  squad_rollup: true },
  { key: 'high_speed_distance',     label: 'High Speed Distance', unit: 'm',     kind: 'accum', category: 'distance',     is_core: true, decimals: 0, display_order: 2,  squad_rollup: true },
  { key: 'very_high_speed_distance',label: 'Very High Speed Dist',unit: 'm',     kind: 'accum', category: 'distance',     is_core: true, decimals: 0, display_order: 3,  squad_rollup: true },
  { key: 'sprint_distance',         label: 'Sprint Distance',     unit: 'm',     kind: 'accum', category: 'distance',     is_core: true, decimals: 0, display_order: 4,  squad_rollup: true },
  { key: 'sprint_count',            label: 'Sprints',             unit: '',      kind: 'accum', category: 'count',        is_core: true, decimals: 0, display_order: 5,  squad_rollup: true },
  { key: 'accelerations',           label: 'Accelerations',       unit: '',      kind: 'accum', category: 'acceleration', is_core: true, decimals: 0, display_order: 6,  squad_rollup: true },
  { key: 'decelerations',           label: 'Decelerations',       unit: '',      kind: 'accum', category: 'acceleration', is_core: true, decimals: 0, display_order: 7,  squad_rollup: true },
  { key: 'max_speed',               label: 'Max Speed',           unit: 'km/h',  kind: 'peak',  category: 'speed',        is_core: true, decimals: 1, display_order: 8,  squad_rollup: true },
  { key: 'avg_speed',               label: 'Avg Speed',           unit: 'km/h',  kind: 'peak',  category: 'speed',        is_core: true, decimals: 1, display_order: 9,  squad_rollup: true },
  { key: 'player_load',             label: 'Player Load',         unit: 'AU',    kind: 'accum', category: 'load',         is_core: true, decimals: 0, display_order: 10, squad_rollup: true },
];

// Deterministic per (player, session). Order of the tuple:
// [total_distance, high_speed_distance, sprint_distance, sprint_count,
//  accelerations, decelerations, player_load, max_speed, avg_speed]
const BASE = {
  p1: [5200, 720, 240, 15, 32, 28, 7100, 29.8, 7.2],
  p2: [6100, 540, 150, 9,  41, 37, 8300, 27.1, 7.6],
  p3: [4300, 380, 90,  5,  22, 19, 5600, 25.4, 6.9],
};

export const SMOKE_REPORTS = SMOKE_SESSIONS.flatMap((s, si) =>
  SMOKE_PLAYERS.map((p) => {
    const [td, hsd, sd, sc, ac, dc, pl, ms, as] = BASE[p.id];
    const k = 1 - si * 0.06; // slight, deterministic session-to-session variation
    return {
      player_id: p.id,
      session_id: s.id,
      club_id: 'club-1',
      total_distance: Math.round(td * k),
      high_speed_distance: Math.round(hsd * k),
      very_high_speed_distance: Math.round(hsd * k * 0.4),
      sprint_distance: Math.round(sd * k),
      sprint_count: sc,
      accelerations: ac,
      decelerations: dc,
      max_speed: ms,
      avg_speed: as,
      player_load: Math.round(pl * k),
      hmld: Math.round(td * k * 0.18),
      time_played: 90,
      distance_per_minute: +((td * k) / 90).toFixed(1),
      // Two different consumers read the same gps_reports mock:
      //  • _fetchReports (renderView) embeds players(...)
      //  • the gp-card resolver embeds training_sessions!inner(session_date, session_attributes, microcycle_id)
      // Supplying BOTH embeds keeps both happy (extra fields are harmless).
      players: {
        first_name: p.first_name,
        last_name: p.last_name,
        number: p.number,
        position: p.position,
        positions: p.positions,
      },
      training_sessions: {
        session_date: s.session_date,
        session_attributes: null,
        microcycle_id: 'mc-1',
      },
    };
  })
);

// ── El fast-path por RPC ────────────────────────────────────────────────────────
// Desde b72b326 ("RPC fast-path ON por defecto") una card de plantel no lee gps_reports: pide
// gps_player_agg, que devuelve UNA fila por jugador con los bloques ya sumados. El mock de la
// tabla dejó de alcanzar y las cards se quedaron en "No data" — con los tests del smoke en rojo
// desde entonces, sin cubrir nada.
//
// Esto reproduce el contrato del RPC a partir de los MISMOS reports de arriba, así que el
// fast-path y el camino crudo dicen exactamente lo mismo (que es justamente lo que el RPC promete).
const AGG_KEYS = [
  'total_distance', 'high_speed_distance', 'very_high_speed_distance', 'sprint_distance',
  'sprint_count', 'accelerations', 'decelerations', 'max_speed', 'avg_speed',
  'player_load', 'hmld', 'time_played', 'distance_per_minute',
];

/** Filas de gps_player_agg para las sesiones dadas (todas, si no se pasa ninguna). */
export function smokePlayerAgg(sessionIds) {
  const want = Array.isArray(sessionIds) && sessionIds.length ? new Set(sessionIds) : null;
  const byPlayer = new Map();
  for (const r of SMOKE_REPORTS) {
    if (want && !want.has(r.session_id)) continue;
    let a = byPlayer.get(r.player_id);
    if (!a) {
      const p = SMOKE_PLAYERS.find(x => x.id === r.player_id) || {};
      a = { player_id: r.player_id, first_name: p.first_name || '', last_name: p.last_name || '',
        n_rows: 0, n_sessions: 0, w_sum: 0, _sessions: new Set() };
      byPlayer.set(r.player_id, a);
    }
    a.n_rows += 1;
    a._sessions.add(r.session_id);
    const w = Number(r.time_played) || 0;
    a.w_sum += w;
    for (const k of AGG_KEYS) {
      const v = r[k];
      if (v == null) continue;
      const n = Number(v);
      a[`${k}_sum`] = (a[`${k}_sum`] || 0) + n;
      a[`${k}_swv`] = (a[`${k}_swv`] || 0) + n * w;
      a[`${k}_max`] = a[`${k}_max`] == null ? n : Math.max(a[`${k}_max`], n);
      a[`${k}_min`] = a[`${k}_min`] == null ? n : Math.min(a[`${k}_min`], n);
    }
  }
  return [...byPlayer.values()].map(({ _sessions, ...row }) => ({ ...row, n_sessions: _sessions.size }));
}
