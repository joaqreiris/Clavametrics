/* =============================================================
   gps-units.js — CANONICAL GPS UNITS CONTRACT (single source).

   gps_reports stores EVERY metric in these units. BOTH ingest paths
   normalize to them BEFORE insert:
     · CSV/XLSX wizard (GPS Analysis.html) — unit selector + auto-detect
     · Catapult Edge Function (supabase/functions/gps-sync) — fixed SI map
   Display formatting (window.gpFmtMetric) reads the same metric kinds.

   ⚠️ gps-sync runs on Deno and cannot import this browser file. The SAME
   contract is documented there (SLUG_MAP comments); keep both in sync.

   CANONICAL UNITS
     distance  (total_distance, high_speed_distance, very_high_speed_distance,
                sprint_distance, hmld, distance_per_minute) → METRES   · display 0 dec
     speed     (max_speed, avg_speed)                        → km/h     · display 1 dec
     count     (accelerations, decelerations, sprint_count)  → integer  · display 0 dec, no unit
     load      (player_load)                                 → AU       · display 1 dec
     time      (time_played)                                 → minutes
   ============================================================= */
(function (root) {
  'use strict';

  // metric key → kind
  const KIND = {
    total_distance: 'distance', high_speed_distance: 'distance',
    very_high_speed_distance: 'distance', sprint_distance: 'distance',
    hmld: 'distance', distance_per_minute: 'distance',
    max_speed: 'speed', avg_speed: 'speed',
    accelerations: 'count', decelerations: 'count', sprint_count: 'count',
    player_load: 'load',
    time_played: 'time',
  };

  // SOURCE unit → multiplier to the canonical unit.
  const DISTANCE_UNITS = { meters: 1, kilometers: 1000, yards: 0.9144 };
  const SPEED_UNITS    = { kmh: 1, ms: 3.6 };

  // Friendly labels for the wizard selectors.
  const DISTANCE_UNIT_LABELS = { meters: 'meters (m)', kilometers: 'kilometers (km)', yards: 'yards (yd)' };
  const SPEED_UNIT_LABELS    = { kmh: 'km/h', ms: 'm/s' };

  // Display contract (mirrors window.gpFmtMetric).
  const DISPLAY = {
    distance: { decimals: 0, unit: 'm'     },
    speed:    { decimals: 1, unit: 'km/h'  },
    count:    { decimals: 0, unit: ''      },
    load:     { decimals: 1, unit: ''      },
    time:     { decimals: 0, unit: 'min'   },
  };

  // total_distance > this (canonical metres) in ONE session is physically
  // impossible for football → noise (e.g. a GPS unit left on in the team bus).
  // Such rows are still inserted but flagged is_invalid and excluded from aggregates.
  const OUTLIER_MAX_M = 25000; // 25 km

  function kindOf(key) { return KIND[key] || null; }

  // Factor (× to canonical) for a declared source unit, by metric kind.
  function factorFor(kind, sourceUnit) {
    if (kind === 'distance') return DISTANCE_UNITS[sourceUnit] ?? 1;
    if (kind === 'speed')    return SPEED_UNITS[sourceUnit] ?? 1;
    return 1;
  }
  // Inverse: given a stored conversion factor, which source unit is it?
  function unitForFactor(kind, factor) {
    const f = +factor;
    if (kind === 'distance') {
      if (Math.abs(f - 1000) < 1e-6)   return 'kilometers';
      if (Math.abs(f - 0.9144) < 1e-4) return 'yards';
      return 'meters';
    }
    if (kind === 'speed') return Math.abs(f - 3.6) < 1e-6 ? 'ms' : 'kmh';
    return null;
  }

  // ── Heuristics (suggestion only — the user always confirms) ──────────────
  // A football session is thousands of metres; a median < 50 means the column
  // is almost certainly kilometres.
  function suggestDistanceUnit(median) {
    if (median == null || !isFinite(median)) return 'meters';
    return (median > 0 && median < 50) ? 'kilometers' : 'meters';
  }
  // Top human speed ≈ 10 m/s ≈ 36 km/h. A max < 12 means the column is m/s.
  function suggestSpeedUnit(max) {
    if (max == null || !isFinite(max)) return 'kmh';
    return (max > 0 && max < 12) ? 'ms' : 'kmh';
  }

  const API = {
    KIND, DISTANCE_UNITS, SPEED_UNITS, DISTANCE_UNIT_LABELS, SPEED_UNIT_LABELS,
    DISPLAY, OUTLIER_MAX_M,
    kindOf, factorFor, unitForFactor, suggestDistanceUnit, suggestSpeedUnit,
  };
  root.GpsUnits = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
