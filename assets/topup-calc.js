// assets/topup-calc.js
// Post-match top-up (compensatory) training engine for non-starters / partial minutes.
// ---------------------------------------------------------------------------
// Turns a player's match-load DEFICIT into a prescription of field tasks:
//   • an intermittent HIIT block anchored to the 30-15 IFT (VIFT), and
//   • a change-of-direction / neuromuscular block dosed by deficit band.
//
// Evidence anchors (see chat for links):
//   - Non-starters' true deficit is high-intensity (HSR / sprint / acc-dec),
//     not total volume → target those metrics (Balancing the load, 2024).
//   - VIFT individualises interval speed; %VIFT → running velocity (Buchheit).
//   - Combine running-based HIIT (HSR) + COD drills (acc/dec) — Díaz-Serradilla 2023.
//
// Depends on: window.sb, window.getMatchBaseline (assets/gps-baseline.js).
// Pure logic — no DOM. Exposes window.TopUp.
(function () {
  'use strict';

  // Speed bands are INDIVIDUALISED as a % of each player's maximal velocity
  // (matches the Catapult import config used by this club):
  //   HSR 60-75% Vmax · VHSR 75-90% Vmax · sprint > 90% Vmax.
  // So the HSR/sprint thresholds are per-player = pct × Vmax (km/h).
  const BAND_PCT = { hsr: 0.60, vhsr: 0.75, sprint: 0.90 };
  // Fallback absolute thresholds (km/h) only when a player's Vmax is unknown.
  let HSR_FALLBACK    = 19.8;
  let SPRINT_FALLBACK = 25.2;

  // Metrics we know how to prescribe against. `kind` drives which block fills it.
  //   volume → informational (total work) · hsr → HIIT block · sprint → HIIT (supra)
  //   accel  → COD/neuromuscular block · load → informational
  const METRIC_DEFS = {
    total_distance:           { label: 'Distancia total', unit: 'm',  kind: 'volume' },
    high_speed_distance:      { label: 'HSR',             unit: 'm',  kind: 'hsr'    },
    very_high_speed_distance: { label: 'Muy alta vel.',   unit: 'm',  kind: 'hsr'    },
    hmld:                     { label: 'HMLD',            unit: 'm',  kind: 'hsr'    },
    sprint_distance:          { label: 'Sprint',          unit: 'm',  kind: 'sprint' },
    sprint_count:             { label: 'Nº sprints',      unit: 'n',  kind: 'sprint' },
    accelerations:            { label: 'Aceleraciones',   unit: 'n',  kind: 'accel'  },
    decelerations:            { label: 'Desaceleraciones', unit: 'n', kind: 'accel'  },
    player_load:              { label: 'Player load',     unit: 'ua', kind: 'load'   },
  };

  // Interval presets. pct = % of VIFT · run/rest in seconds. Default = 15-15 @ 100%.
  const PRESETS = [
    { id: '15-15-100', label: '15-15 · 100% VIFT', run: 15, rest: 15, pct: 100 },
    { id: '15-15-95',  label: '15-15 · 95% VIFT',  run: 15, rest: 15, pct: 95  },
    { id: '10-20-105', label: '10-20 · 105% VIFT', run: 10, rest: 20, pct: 105 },
    { id: '12-24-110', label: '12-24 · 110% VIFT', run: 12, rest: 24, pct: 110 },
    { id: '30-30-90',  label: '30-30 · 90% VIFT',  run: 30, rest: 30, pct: 90  },
  ];
  const DEFAULT_PRESET = PRESETS[0];

  // Change-of-direction dose bands, keyed by total (acc+dec) deficit count.
  const COD_BANDS = [
    { id: 'low',  max: 12, label: 'Baja',  reps: '2 × (5-10-5) shuttle',
      detail: '2 series · descanso 45 s' },
    { id: 'mid',  max: 28, label: 'Media', reps: '3 × (5-10-5) + 1 × T-drill',
      detail: '3–4 series · descanso 60 s' },
    { id: 'high', max: Infinity, label: 'Alta', reps: '4 × (5-10-5) + zig-zag + T-drill',
      detail: '4–5 series · descanso 75 s' },
  ];

  const kmhToMs = (kmh) => kmh / 3.6;
  const clamp0  = (x) => (x > 0 ? x : 0);

  // ── Latest VIFT (30-15 IFT) for a player ───────────────────────────────
  // evaluations.value IS the VIFT in km/h for 30-15 IFT rows. Match the type by
  // case-insensitive PREFIX (ilike '30-15 IFT%'), the SAME way Evaluations.html
  // reads it (startsWithCI) — the data has variants (suffixes/case/whitespace),
  // so an exact eq() silently misses them.
  async function getLatestVift(playerId, clubId) {
    if (!playerId || !clubId) return null;
    try {
      // Broad match: the type string has legacy variants — leading space, reordered
      // ('IFT 30-15'), 'VIFT', or an en-dash ('30–15'). `%ift%` catches anything with
      // IFT/VIFT; `%30%15%` catches both dash styles of "30-15". Pick the latest with a value.
      const { data } = await window.sb
        .from('evaluations')
        .select('value, test_date, evaluation_type')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .or('evaluation_type.ilike.%ift%,evaluation_type.ilike.%30%15%')
        .not('value', 'is', null)
        .order('test_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { vift: +data.value, date: data.test_date } : null;
    } catch { return null; }
  }

  // ── Fallback reference across ALL of a player's GPS sessions (any type) ──
  // Used when <3 sessions are tagged as matches (common: GPS imports land as
  // session_type='training' and are never promoted to 'match'). Matches are
  // usually a player's highest-load sessions, so best-N over all GPS is a sound
  // proxy. source:'gps' so the UI can label it as not-match-tagged.
  async function getAllGpsReference(playerId, clubId, metrics, mode) {
    const out = {}; metrics.forEach(m => out[m] = { baseline: null, count: 0, source: 'gps' });
    const core = Array.from(new Set(metrics.filter(m => METRIC_DEFS[m])));
    if (!playerId || !clubId || !core.length) return out;
    try {
      const { data } = await window.sb
        .from('gps_reports')
        .select(core.join(',') + ',is_invalid')
        .eq('player_id', playerId)
        .eq('club_id', clubId);
      const rows = (data || []).filter(r => !r.is_invalid);
      const n = 5, MIN = 3;
      core.forEach(m => {
        let vals = rows.map(r => r[m]).filter(v => v != null).map(Number);
        if (vals.length < MIN) { out[m] = { baseline: null, count: vals.length, source: 'gps' }; return; }
        const used = mode === 'avg' ? vals : vals.slice().sort((a, b) => b - a).slice(0, n);
        const mean = used.reduce((s, v) => s + v, 0) / used.length;
        out[m] = { baseline: +mean.toFixed(1), count: used.length, source: 'gps' };
      });
    } catch { /* degrade to nulls */ }
    return out;
  }

  // ── Player maximal velocity (km/h) — peak max_speed across all sessions ─
  // Used to individualise the HSR/sprint thresholds (% of Vmax). Peak, not mean,
  // because "maximal velocity" is the best sprint the player has hit on record.
  async function getPlayerVmax(playerId, clubId) {
    if (!playerId || !clubId) return null;
    try {
      const { data } = await window.sb
        .from('gps_reports')
        .select('max_speed')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .not('max_speed', 'is', null)
        .order('max_speed', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data && data.max_speed ? +data.max_speed : null;
    } catch { return null; }
  }

  // ── Reference load per metric (best-5 or typical-match average) ────────
  // metrics: array of metric keys. mode: 'best' | 'avg'.
  async function getReference(playerId, clubId, metrics, mode) {
    const out = {};
    await Promise.all(metrics.map(async (m) => {
      const r = await window.getMatchBaseline(playerId, m, clubId, { mode: mode === 'avg' ? 'avg' : 'best' });
      out[m] = r; // { baseline, count, confidence, source, warning }
    }));
    return out;
  }

  // ── Positional reference (fallback when a player lacks personal match data) ─
  // Mean of the same-position teammates' personal baselines, per metric.
  // playerIds = same-position squad members (with data). Respects best/avg mode.
  async function getPositionReference(playerIds, clubId, metrics, mode) {
    if (!playerIds || !playerIds.length) { const o = {}; metrics.forEach(m => o[m] = { baseline: null, count: 0, source: 'position' }); return o; }
    const rows = await Promise.all(playerIds.map(pid => getReference(pid, clubId, metrics, mode)));
    const out = {};
    metrics.forEach(m => {
      const vals = rows.map(r => r[m] && r[m].baseline).filter(v => v != null);
      out[m] = vals.length
        ? { baseline: +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1), count: vals.length, source: 'position' }
        : { baseline: null, count: 0, source: 'position' };
    });
    return out;
  }

  // ── Latest match the player actually played (for a MEASURED deficit) ───
  // Returns { sessionDate, minutes, metrics:{key:value} } or null.
  async function getLatestMatchActual(playerId, clubId) {
    if (!playerId || !clubId) return null;
    try {
      const matchDates = await window.gpsGetMatchDates(clubId);
      if (!matchDates || !matchDates.size) return null;
      const cols = Object.keys(METRIC_DEFS).join(', ');
      const { data } = await window.sb
        .from('gps_reports')
        .select(`${cols}, time_played, training_sessions!inner(session_date)`)
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', [...matchDates]);
      // Pick the most recent match client-side (ordering on an embedded column is
      // brittle across supabase-js versions; match-day rows per player are few).
      const rows = (data || []).slice().sort((a, b) =>
        String(b.training_sessions?.session_date || '').localeCompare(String(a.training_sessions?.session_date || '')));
      const row = rows[0];
      if (!row) return null;
      const metrics = {};
      Object.keys(METRIC_DEFS).forEach((k) => { if (row[k] != null) metrics[k] = +row[k]; });
      return {
        sessionDate: row.training_sessions?.session_date || null,
        minutes: row.time_played != null ? +row.time_played : null,
        metrics,
      };
    } catch { return null; }
  }

  // ── Deficit per metric ─────────────────────────────────────────────────
  // ref: { metric: {baseline} }.  opts:
  //   { source:'estimate', minutes, duration }       → ref × (1 − min/dur)
  //   { source:'measured'|'manual', actual:{metric:value} } → ref − actual
  function computeDeficit(ref, opts) {
    const o = opts || {};
    const out = {};
    Object.keys(ref).forEach((m) => {
      const base = ref[m] && ref[m].baseline;
      if (base == null) { out[m] = { reference: null, actual: null, deficit: null, pct: null }; return; }
      let actual;
      if (o.source === 'estimate') {
        const dur = +o.duration > 0 ? +o.duration : 90;
        const min = clamp0(+o.minutes || 0);
        const played = Math.min(min / dur, 1);
        actual = base * played;
      } else {
        actual = (o.actual && o.actual[m] != null) ? +o.actual[m] : 0;
      }
      const deficit = clamp0(base - actual);
      out[m] = {
        reference: +base.toFixed(1),
        actual: +actual.toFixed(1),
        deficit: +deficit.toFixed(1),
        pct: base > 0 ? Math.round((deficit / base) * 100) : 0,
      };
    });
    return out;
  }

  // ── HIIT block from an HSR deficit + VIFT ──────────────────────────────
  // vmaxKmh (optional) individualises the HSR/sprint thresholds (% of Vmax).
  // Returns null if no VIFT. Otherwise a prescription object.
  function prescribeHIIT(viftKmh, hsrDeficitM, preset, vmaxKmh) {
    if (!viftKmh || viftKmh <= 0) return null;
    const p = preset || DEFAULT_PRESET;
    const speedKmh   = +(viftKmh * p.pct / 100).toFixed(1);
    const mPerRep    = Math.round(kmhToMs(speedKmh) * p.run);
    const hsrThreshold    = vmaxKmh > 0 ? +(vmaxKmh * BAND_PCT.hsr).toFixed(1)    : HSR_FALLBACK;
    const sprintThreshold = vmaxKmh > 0 ? +(vmaxKmh * BAND_PCT.sprint).toFixed(1) : SPRINT_FALLBACK;
    const countsAsHSR    = speedKmh >= hsrThreshold;
    const countsAsSprint = speedKmh >= sprintThreshold;

    let reps = 0, sets = 0, repsPerSet = 0, totalRunM = 0, timeMin = 0;
    if (hsrDeficitM > 0 && mPerRep > 0) {
      reps = Math.max(1, Math.ceil(hsrDeficitM / mPerRep));
      repsPerSet = Math.min(reps, p.run <= 12 ? 10 : 8);   // shorter reps → longer sets
      sets = Math.max(1, Math.ceil(reps / repsPerSet));
      totalRunM = reps * mPerRep;
      timeMin = +(reps * (p.run + p.rest) / 60).toFixed(1);
    }
    return {
      preset: p, speedKmh, mPerRep, reps, sets, repsPerSet, totalRunM, timeMin,
      countsAsHSR, countsAsSprint, hsrThreshold, sprintThreshold, vmax: vmaxKmh || null,
    };
  }

  // ── Change-of-direction / neuromuscular block from acc+dec deficit ─────
  function prescribeCOD(accDeficit, decDeficit) {
    const total = clamp0(accDeficit || 0) + clamp0(decDeficit || 0);
    const band = COD_BANDS.find((b) => total <= b.max) || COD_BANDS[COD_BANDS.length - 1];
    return { total: Math.round(total), band };
  }

  window.TopUp = {
    METRIC_DEFS, PRESETS, DEFAULT_PRESET, COD_BANDS, BAND_PCT,
    getLatestVift, getPlayerVmax, getReference, getAllGpsReference, getPositionReference, getLatestMatchActual,
    computeDeficit, prescribeHIIT, prescribeCOD,
    // Override the fallback km/h thresholds used only when a player's Vmax is unknown.
    setFallbackThresholds(hsr, sprint) {
      if (hsr > 0) HSR_FALLBACK = +hsr;
      if (sprint > 0) SPRINT_FALLBACK = +sprint;
    },
  };
})();
