// assets/hfvp-calc.js — Horizontal Force-Velocity Profile (sprint) calculator.
// Pure calculation, no external dependencies. Method: Samozino et al. (2016),
// "A simple method for measuring power, force, velocity properties, and
// mechanical effectiveness in sprint running", Scand J Med Sci Sports.
//
// Exposes hfvpProfile() both on window.hfvpCalc (browser) and module.exports
// (node / vitest). NO UI, NO persistence here — calculation only.
(function (root) {
  'use strict';

  const R_AIR  = 287.058; // specific gas constant of dry air, J/(kg·K)
  const G      = 9.81;    // gravity, m/s²
  const CD     = 0.9;     // drag coefficient (Samozino/Arsac standard)

  // Air density from ambient temperature & pressure (ideal gas law).
  //   ρ = P / (R·T)   with P in Pa, T in K.
  function airDensity(tempC, pressure_kPa) {
    const P = pressure_kPa * 1000;   // kPa → Pa
    const T = tempC + 273.15;        // °C → K
    return P / (R_AIR * T);
  }

  // Frontal area of the runner (Samozino 2016, after Arsac & Locatelli 2002):
  //   Af = 0.2025 · h^0.725 · m^0.425 · 0.266
  // (Du Bois body-surface-area term scaled by the 0.266 frontal fraction).
  function frontalArea(height, mass) {
    return 0.2025 * Math.pow(height, 0.725) * Math.pow(mass, 0.425) * 0.266;
  }

  // ── Step 1: fit v(t) = vmax·(1 − e^(−t/τ)) to the splits ─────────────────
  // Modelled position: x(t) = vmax·(t + τ·e^(−t/τ) − τ).
  //
  // Fitting method (documented):
  //   For a FIXED τ, x(t) is LINEAR in vmax: x_i = vmax·g_i with
  //   g_i = t_i + τ·e^(−t_i/τ) − τ. So the least-squares vmax has a closed
  //   form  vmax = Σ(x_i·g_i) / Σ(g_i²).  We therefore reduce the 2-parameter
  //   fit to a 1-D search over τ: coarse grid scan to bracket the SSE minimum,
  //   then golden-section refinement. Robust, deterministic, no solver needed.
  function fitExpModel(splits) {
    const xs = splits.map(s => Number(s.distance_m));
    const ts = splits.map(s => Number(s.time_s));

    // SSE of the distance residuals for a given τ (with closed-form vmax).
    function evalTau(tau) {
      let sxg = 0, sgg = 0;
      for (let i = 0; i < ts.length; i++) {
        const g = ts[i] + tau * Math.exp(-ts[i] / tau) - tau;
        sxg += xs[i] * g;
        sgg += g * g;
      }
      const vmax = sgg > 0 ? sxg / sgg : 0;
      let sse = 0;
      for (let i = 0; i < ts.length; i++) {
        const g = ts[i] + tau * Math.exp(-ts[i] / tau) - tau;
        const r = xs[i] - vmax * g;
        sse += r * r;
      }
      return { vmax, sse };
    }

    // Coarse scan to bracket the minimum.
    let best = { tau: 0.8, sse: Infinity, vmax: 0 };
    for (let tau = 0.2; tau <= 2.5; tau += 0.005) {
      const e = evalTau(tau);
      if (e.sse < best.sse) best = { tau, sse: e.sse, vmax: e.vmax };
    }

    // Golden-section refinement around the coarse optimum.
    const gr = (Math.sqrt(5) - 1) / 2;
    let a = best.tau - 0.005, b = best.tau + 0.005;
    let c = b - gr * (b - a), d = a + gr * (b - a);
    let fc = evalTau(c).sse, fd = evalTau(d).sse;
    for (let k = 0; k < 60; k++) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = evalTau(c).sse; }
      else         { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = evalTau(d).sse; }
    }
    const tau = (a + b) / 2;
    const { vmax } = evalTau(tau);
    return { vmax, tau };
  }

  // Ordinary least-squares linear fit  y = slope·x + intercept.
  function linreg(xs, ys) {
    const n = xs.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    return { slope, intercept };
  }

  // ── Main entry point ─────────────────────────────────────────────────────
  // splits : [{ distance_m, time_s }, ...]  cumulative from the start (≥4-5).
  // mass   : kg.  height : m.
  // opts   : { tempC=20, pressure_kPa=101.325 }.
  function hfvpProfile(splits, mass, height, opts) {
    const o = opts || {};
    const tempC        = o.tempC        != null ? o.tempC        : 20;
    const pressure_kPa = o.pressure_kPa != null ? o.pressure_kPa : 101.325;

    if (!Array.isArray(splits) || splits.length < 4) {
      throw new Error('hfvpProfile: need at least 4 splits');
    }

    const rho = airDensity(tempC, pressure_kPa);
    const Af  = frontalArea(height, mass);
    const kAero = 0.5 * rho * Af * CD;   // F_aero = kAero · v²

    // Step 1 — fit the exponential velocity model.
    const { vmax, tau } = fitExpModel(splits);

    // Step 2-3 — sample the modelled sprint and build instantaneous F_h & v.
    // Sample uniformly in time over the whole acceleration (0 → last split).
    const tEnd = Math.max(...splits.map(s => Number(s.time_s)));
    const N = 1000;
    const dt = tEnd / N;
    const vArr = [], fhArr = [], rfArr = [];
    for (let i = 0; i <= N; i++) {
      const t = i * dt;
      const v = vmax * (1 - Math.exp(-t / tau));        // velocity
      const a = (vmax / tau) * Math.exp(-t / tau);       // acceleration
      const fAero = kAero * v * v;                       // air resistance
      const fh = mass * a + fAero;                       // net horizontal force
      const fTot = Math.hypot(fh, mass * G);             // resultant (with body weight)
      vArr.push(v);
      fhArr.push(fh);
      rfArr.push(fh / fTot);                             // ratio of force
    }

    // Step 4 — linear F-V relationship: F_h vs v → extrapolate F0, V0.
    const fv = linreg(vArr, fhArr);
    const FVslope = fv.slope;            // N per (m/s), negative
    const F0 = fv.intercept;            // force at v = 0
    const V0 = -F0 / FVslope;           // velocity at F = 0
    const Pmax = F0 * V0 / 4;

    // RF-v relationship (over the valid window t ≥ 0.3 s, per Morin/Samozino):
    //   DRF   = slope of RF vs v (decrease in ratio of force, %/(m/s) as fraction)
    //   RFmax = maximal RF reached in that window.
    const startIdx = Math.ceil(0.3 / dt);
    const vWin = vArr.slice(startIdx);
    const rfWin = rfArr.slice(startIdx);
    const rfFit = linreg(vWin, rfWin);
    const DRF = rfFit.slope;
    const RFmax = Math.max(...rfWin);

    return {
      vmax,                       // m/s
      tau,                        // s
      F0,                         // N
      F0_rel:   F0 / mass,        // N/kg
      V0,                         // m/s
      Pmax,                       // W
      Pmax_rel: Pmax / mass,      // W/kg
      RFmax,                      // dimensionless (max ratio of force)
      DRF,                        // slope of RF-v (1/(m/s))
      FVslope,                    // N/(m/s)
    };
  }

  const api = { hfvpProfile, airDensity, frontalArea };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.hfvpCalc = api; root.hfvpProfile = hfvpProfile; }
})(typeof window !== 'undefined' ? window : null);
