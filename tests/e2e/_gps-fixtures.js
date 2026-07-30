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
