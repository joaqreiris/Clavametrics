/* ────────────────────────────────────────────────────────────────────────
   sprint-splits-calc.js — manual sprint-splits metrics (no biomechanical model).
   Pure arithmetic, no external library. Mirror of hfvp-calc.js in spirit, but
   this test just derives segment velocities from cumulative split times.

   Exposes window.sprintSplitsMetrics(splits) where
     splits = [{ distance_m, time_s }, ...]  cumulative from the start (t at each
     split is measured from the 0 m start line). Order/duplicates are normalised.

   Returns null when there are fewer than 2 valid splits, otherwise:
     {
       segments: [{ from_m, to_m, v_ms, v_kmh }, ...],   // between consecutive splits
       vmax:   { from_m, to_m, v_ms, v_kmh },            // fastest segment
       flying: { from_m, to_m, v_ms, v_kmh } | null,     // last segment (penult→last); null if <3 splits
       accel:  { from_m:0, to_m, v_ms, v_kmh, time_s },  // 0 → first split
     }
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function sprintSplitsMetrics(splits) {
    // normalise: numeric, positive, sorted by distance, deduped by distance
    var pts = (splits || [])
      .map(function (s) { return { d: Number(s && s.distance_m), t: Number(s && s.time_s) }; })
      .filter(function (p) { return isFinite(p.d) && isFinite(p.t) && p.d > 0 && p.t > 0; })
      .sort(function (a, b) { return a.d - b.d; });

    var seen = {}, clean = [];
    pts.forEach(function (p) { if (!(p.d in seen)) { seen[p.d] = 1; clean.push(p); } });
    pts = clean;

    if (pts.length < 2) return null;

    // segment velocities between consecutive splits (guard against non-monotonic time)
    var segments = [];
    for (var i = 1; i < pts.length; i++) {
      var dd = pts[i].d - pts[i - 1].d;
      var dt = pts[i].t - pts[i - 1].t;
      if (dd <= 0 || dt <= 0) continue;
      var v = dd / dt;
      segments.push({ from_m: pts[i - 1].d, to_m: pts[i].d, v_ms: +v.toFixed(3), v_kmh: +(v * 3.6).toFixed(2) });
    }
    if (!segments.length) return null;

    // Vmax = fastest between-splits segment
    var vmax = segments.reduce(function (a, b) { return b.v_ms > a.v_ms ? b : a; });

    // Acceleration phase = 0 → first split (start line to first gate)
    var a0 = pts[0].d / pts[0].t;
    var accel = {
      from_m: 0, to_m: pts[0].d,
      v_ms: +a0.toFixed(3), v_kmh: +(a0 * 3.6).toFixed(2), time_s: +pts[0].t.toFixed(3),
    };

    // Flying split = last segment (penultimate → last split); needs ≥2 segments (≥3 splits)
    var flying = segments.length >= 2 ? segments[segments.length - 1] : null;

    return { segments: segments, vmax: vmax, flying: flying, accel: accel };
  }

  window.sprintSplitsMetrics = sprintSplitsMetrics;
})();
