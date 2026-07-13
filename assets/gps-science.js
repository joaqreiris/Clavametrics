// assets/gps-science.js — GPS science module for ClavaMetrics
// Pure calculation functions, no external dependencies.
// All functions exposed on window.gpScience.
(function () {
  'use strict';

  window.gpScience = {

    // ── z-score ──────────────────────────────────────────────
    zScore(val, mean, std) {
      return std === 0 ? 0 : (val - mean) / std;
    },

    // ── Exponentially weighted moving average ─────────────────
    // lambda: smoothing factor (e.g. 2/(n+1) for n-period EMA)
    ewma(values, lambda = 0.1) {
      if (!values.length) return [];
      const out = [values[0]];
      for (let i = 1; i < values.length; i++) {
        out.push(lambda * values[i] + (1 - lambda) * out[i - 1]);
      }
      return out;
    },

    // ── ACWR (Acute:Chronic Workload Ratio) ───────────────────
    // @deprecated Use window.gpsACWR (assets/gps-acwr.js) — the single unified engine (club-
    // configured model, uncoupled, per-player→mean). This RA/coupled/squad-pooled variant is NO
    // LONGER USED by any surface (kept only for reference / potential ad-hoc callers). Do not add
    // new callers: it will disagree with every other ACWR display in the app.
    // daily: array of { date: 'YYYY-MM-DD', load: number }
    // Returns same array augmented with { acute, chronic, ratio }
    acwr(daily) {
      return daily.map((d, i) => {
        const w7  = daily.slice(Math.max(0, i - 6),  i + 1);
        const w28 = daily.slice(Math.max(0, i - 27), i + 1);
        const acute   = w7.reduce((s, x) => s + x.load, 0) / 7;
        const chronic = w28.reduce((s, x) => s + x.load, 0) / 28;
        return {
          date: d.date,
          load: d.load,
          acute:   +acute.toFixed(1),
          chronic: +chronic.toFixed(1),
          ratio:   chronic > 0 ? +(acute / chronic).toFixed(2) : null,
        };
      });
    },

    // ── Training Stress Balance (CTL / ATL / TSB) ─────────────
    // Uses EMA with standard periods: CTL≈42d, ATL≈7d
    trainingStressBalance(daily) {
      const kCtl = 2 / (42 + 1);
      const kAtl = 2 / (7 + 1);
      let ctl = daily[0]?.load ?? 0;
      let atl = daily[0]?.load ?? 0;
      return daily.map((d, i) => {
        if (i > 0) {
          ctl = d.load * kCtl + ctl * (1 - kCtl);
          atl = d.load * kAtl + atl * (1 - kAtl);
        }
        return {
          date: d.date,
          ctl:  +ctl.toFixed(1),
          atl:  +atl.toFixed(1),
          tsb:  +(ctl - atl).toFixed(1),
        };
      });
    },

    // ── Velocity zones ────────────────────────────────────────
    // Approximates Z1-Z5 from available totals.
    // Thresholds: Z1 <7 km/h, Z2 7-14, Z3 14-20, Z4 20-25, Z5 >25
    velocityZones(report) {
      const total  = report.total_distance        || 0;
      const hsr    = report.high_speed_distance   || 0;
      const sprint = report.sprint_distance       || 0;
      const z45    = Math.max(0, hsr - sprint);
      const sub    = Math.max(0, total - hsr);
      return [
        { label: 'Z1 <7 km/h',  dist: Math.round(sub * 0.25) },
        { label: 'Z2 7-14',     dist: Math.round(sub * 0.42) },
        { label: 'Z3 14-20',    dist: Math.round(sub * 0.33) },
        { label: 'Z4 20-25',    dist: Math.round(z45)        },
        { label: 'Z5 >25',      dist: Math.round(sprint)     },
      ];
    },

    // ── Position baselines (match-day means, Akenhead/Owen) ───
    baselineByRole(role, metric) {
      const P = {
        GK: { total_distance:4500,  high_speed_distance:100,  sprint_distance:30,  accelerations:18, decelerations:16, max_speed:22.0, player_load:280 },
        CB: { total_distance:9800,  high_speed_distance:380,  sprint_distance:110, accelerations:32, decelerations:30, max_speed:28.5, player_load:540 },
        FB: { total_distance:10800, high_speed_distance:720,  sprint_distance:240, accelerations:42, decelerations:38, max_speed:31.0, player_load:620 },
        MF: { total_distance:11400, high_speed_distance:580,  sprint_distance:180, accelerations:48, decelerations:44, max_speed:29.5, player_load:680 },
        WG: { total_distance:11000, high_speed_distance:920,  sprint_distance:380, accelerations:38, decelerations:35, max_speed:32.0, player_load:640 },
        ST: { total_distance:10200, high_speed_distance:760,  sprint_distance:320, accelerations:36, decelerations:33, max_speed:32.5, player_load:580 },
      };
      return (P[role] || P.MF)[metric] ?? null;
    },

    // ── Outliers ──────────────────────────────────────────────
    // Returns players where any metric has |z| >= threshold.
    outliers(reports, metrics, threshold = 2) {
      const flags = [];
      metrics.forEach(m => {
        const vals = reports.map(r => +(r[m] || 0));
        const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        const std  = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (vals.length || 1)) || 1;
        reports.forEach(r => {
          const z = (+(r[m] || 0) - mean) / std;
          if (Math.abs(z) >= threshold) {
            flags.push({ player: r.players, metric: m, value: +(r[m] || 0), z: +z.toFixed(2) });
          }
        });
      });
      return flags;
    },

    // ── Microcycle load profile ───────────────────────────────
    // sessions: [{ session_date, avg_load }]
    // Returns [{ name: 'Mon', avg: 450 }, ...]
    microcycleProfile(sessions) {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const buckets = names.map(n => ({ name: n, loads: [] }));
      sessions.forEach(s => {
        const dow = new Date(s.session_date).getDay();
        if (s.avg_load != null) buckets[dow].loads.push(s.avg_load);
      });
      return buckets.map(b => ({
        name: b.name,
        avg:  b.loads.length
          ? +(b.loads.reduce((a, x) => a + x, 0) / b.loads.length).toFixed(1)
          : 0,
      }));
    },

  };
})();
