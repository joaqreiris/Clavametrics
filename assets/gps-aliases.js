// GPS column alias dictionary + player field definitions
// Loaded by GPS Analysis.html before the import wizard IIFE.
// Exposes globals: GPS_BUILTIN_ALIASES, normalizeAlias, GPS_PLAYER_FIELD_KEYS

(function () {
  'use strict';

  // Normalise a column header for comparison: lowercase, no accents, spaces only.
  function normalizeAlias(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[_\-.]+/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Player fields first so the exact-match loop hits them before metric aliases.
  const BUILTIN_ALIASES = [
    // ── Player fields ───────────────────────────────────────────
    {
      metric_key: 'player_name',
      category: 'player_field',
      aliases: [
        'name', 'player name', 'player', 'full name', 'athlete', 'athlete name',
        'nombre', 'nombre jugador', 'jugador', 'atleta',
      ],
    },
    {
      metric_key: 'player_first_name',
      category: 'player_field',
      aliases: ['first name', 'firstname', 'given name'],
    },
    {
      metric_key: 'player_last_name',
      category: 'player_field',
      aliases: ['last name', 'lastname', 'surname', 'family name', 'apellido'],
    },
    {
      metric_key: 'jersey_number',
      category: 'player_field',
      aliases: [
        'number', 'jersey', 'jersey number', 'shirt number', 'dorsal',
        'numero', 'shirt', 'no.', 'no', '#',
      ],
    },
    {
      metric_key: 'position',
      category: 'player_field',
      aliases: [
        'position', 'position name', 'pos', 'role', 'player position',
        'posicion', 'puesto', 'playing position',
      ],
    },
    {
      metric_key: 'player_external_gps_id',
      category: 'player_field',
      aliases: [
        'player id', 'athlete id', 'external id', 'gps id', 'device id',
        'unit id', 'pod id',
      ],
    },
    // ── Session ─────────────────────────────────────────────────
    {
      metric_key: 'session_date',
      category: 'date',
      aliases: ['session date', 'date', 'fecha', 'fecha sesion', 'training date', 'match date'],
    },
    // ── Distance ────────────────────────────────────────────────
    {
      metric_key: 'total_distance',
      category: 'distance',
      aliases: [
        'total distance', 'total dist', 'td', 'distance total', 'distancia total',
        'dist total', 'total m', 'distancia (m)', 'distance (m)', 'distance',
        'distancia', 'td (m)', 'distance (km)',
      ],
    },
    {
      metric_key: 'high_speed_distance',
      category: 'distance',
      aliases: [
        'hsr', 'high speed running', 'high speed distance', 'high-speed dist',
        'hsr (m)', 'hsr distance', 'hsr 60-75', 'hsr (60-75%)', 'hsr (60-75)',
        'hsr 19.8', 'distance >19.8', 'distance hsr', 'dist hsr',
        'distance >19.8km/h', 'distance >5.5m/s', 'zone 4+5', 'z4+z5',
        'high-speed distance',
      ],
    },
    {
      metric_key: 'very_high_speed_distance',
      category: 'distance',
      aliases: [
        'vhsr', 'vhsr dist', 'vhsr distance', 'vhsr (m)', 'very high speed',
        'vhsr 75-90', 'vhsr (75-90%)', 'distance >21', 'sprint distance vhsr',
        'very high speed distance', 'very high speed running',
        'zone 5', 'z5', 'distance >25km/h',
      ],
    },
    {
      metric_key: 'sprint_distance',
      category: 'distance',
      aliases: [
        'sprint distance', 'sprint dist', 'sprint (>90%) (m)', 'sprint >90',
        'sprint m', 'distance sprint', 'dist sprint', 'sprint distance (m)',
        'sprint (m)', 'distance >25.2km/h', 'distance >7m/s',
      ],
    },
    {
      metric_key: 'hmld',
      category: 'distance',
      aliases: [
        'hmld', 'high metabolic load distance', 'hmld (m)', 'metabolic distance',
        'high metabolic', 'hml distance',
      ],
    },
    // ── Speed ────────────────────────────────────────────────────
    {
      metric_key: 'max_speed',
      category: 'speed',
      aliases: [
        'max speed', 'maximum velocity', 'maximum velocity (km/h)', 'max vel',
        'top speed', 'peak speed', 'velocity peak', 'velocidad maxima',
        'max speed (km/h)', 'peak velocity', 'maximum speed', 'vel max',
        'max velocity', 'peak speed (km/h)', 'max_speed (km/h)',
      ],
    },
    {
      metric_key: 'avg_speed',
      category: 'speed',
      aliases: ['avg speed', 'average speed', 'mean speed', 'velocidad promedio'],
    },
    {
      metric_key: 'distance_per_minute',
      category: 'speed',
      aliases: [
        'm/min', 'meters per minute', 'distance per minute', 'm per min',
        'mts/min', 'metros por minuto', 'intensity m/min', 'm/min (average)',
      ],
    },
    // ── Acceleration / deceleration ──────────────────────────────
    {
      metric_key: 'accelerations',
      category: 'acceleration',
      aliases: [
        'accelerations', 'acc', 'accels', 'acc +3 m/s2', 'acc +3', 'high accel',
        'aceleraciones', 'n acc', 'num accelerations', 'total accelerations',
        'accel', 'no. of accelerations',
      ],
    },
    {
      metric_key: 'decelerations',
      category: 'acceleration',
      aliases: [
        'decelerations', 'dec', 'decels', 'dec -3 m/s2', 'dec -3', 'high decel',
        'desaceleraciones', 'n dec', 'num decelerations', 'total decelerations',
        'decel',
      ],
    },
    // ── Count ────────────────────────────────────────────────────
    {
      metric_key: 'sprint_count',
      category: 'count',
      aliases: [
        'sprint count', 'sprints', 'n sprints', 'sprint efforts', 'sprint efforts (>90%)',
        'sprints number', 'num sprints', 'sprint events', 'no. of sprints',
      ],
    },
    // ── Load ─────────────────────────────────────────────────────
    {
      metric_key: 'player_load',
      category: 'load',
      aliases: [
        'player load', 'playerload', 'pl', 'load', 'training load',
        'session load', 'carga', 'carga jugador', 'total load',
      ],
    },
    // ── Time ─────────────────────────────────────────────────────
    {
      metric_key: 'time_played',
      category: 'time',
      aliases: [
        'duration', 'total duration', 'time played', 'minutes played', 'minutes',
        'time (min)', 'minutos jugados', 'tiempo total', 'session duration',
        'playing time', 'playing minutes', 'mins', 'min played',
      ],
    },
  ];

  const GPS_PLAYER_FIELD_KEYS = new Set([
    'player_name', 'player_first_name', 'player_last_name',
    'jersey_number', 'position', 'player_external_gps_id',
  ]);

  window.GPS_BUILTIN_ALIASES   = BUILTIN_ALIASES;
  window.normalizeAlias        = normalizeAlias;
  window.GPS_PLAYER_FIELD_KEYS = GPS_PLAYER_FIELD_KEYS;
})();
