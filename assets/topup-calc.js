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

  // ── Speed bands: which running speed = which locomotor zone ────────────
  // Two models, CONFIGURABLE PER CLUB so the tool never breaks on a club that
  // defines its zones differently:
  //   'pct' → individualised, a % of the player's Vmax (HSR 60-75 · VHSR 75-90 · sprint >90)
  //   'abs' → fixed km/h thresholds (e.g. HSR 19-24 · sprint >24) — what much of the
  //           literature uses. A club may run just HSR+Sprint, or add VHSR, etc.
  // Each band maps to the GPS distance metric it fills. `hi:null` = open-ended (top band).
  const DEFAULT_BANDS_PCT = {
    mode: 'pct', aim: 0.5,   // aim = where inside the band to target (0=low edge, 1=high edge)
    bands: [
      { id: 'hsr',    metric: 'high_speed_distance',      lo: 0.60, hi: 0.75 },
      { id: 'vhsr',   metric: 'very_high_speed_distance', lo: 0.75, hi: 0.90 },
      { id: 'sprint', metric: 'sprint_distance',          lo: 0.90, hi: null },
    ],
  };
  const DEFAULT_BANDS_ABS = {
    mode: 'abs', aim: 0.5,
    bands: [
      { id: 'hsr',    metric: 'high_speed_distance', lo: 19, hi: 24 },
      { id: 'sprint', metric: 'sprint_distance',     lo: 24, hi: null },
    ],
  };

  // Target running speed (km/h) inside a band. pct needs Vmax; abs is absolute.
  function bandTargetSpeed(band, mode, aim, vmax) {
    const a = (aim == null ? 0.5 : aim);
    if (mode === 'pct') {
      if (!vmax || vmax <= 0) return null;
      const hi = band.hi == null ? 1.0 : band.hi;         // open sprint → up to Vmax
      return +(vmax * (band.lo + a * (hi - band.lo))).toFixed(1);
    }
    const hi = band.hi == null ? band.lo * 1.15 : band.hi; // open abs → +15%
    return +(band.lo + a * (hi - band.lo)).toFixed(1);
  }

  // ── Anaerobic Speed Reserve ────────────────────────────────────────────
  // ASR = MSS − MAS. Practical proxy here: Vmax (peak GPS speed ≈ MSS) − VIFT
  // (30-15 ≈ aerobic anchor). Individualises tolerance to supramaximal running
  // and profiles players (speed/endurance/hybrid). Refs: Sandford/Buchheit 2019.
  function anaerobicSpeedReserve(vift, vmax) {
    if (!vift || !vmax || vmax <= vift) return null;
    return +(vmax - vift).toFixed(1);
  }
  // % of a player's ASR that a given running speed represents.
  function pctASR(speed, vift, vmax) {
    if (!vift || !vmax || vmax <= vift) return null;
    return Math.round(((speed - vift) / (vmax - vift)) * 100);
  }
  // Speed/endurance/hybrid profile from the ASR/VIFT ratio (rough, for tagging).
  function speedProfile(vift, vmax) {
    const asr = anaerobicSpeedReserve(vift, vmax);
    if (asr == null || !vift) return null;
    const ratio = asr / vift;              // reserve relative to aerobic speed
    if (ratio >= 1.0) return 'speed';      // big reserve → speed-biased
    if (ratio <= 0.7) return 'endurance';  // small reserve → endurance-biased
    return 'hybrid';
  }

  // ── Run block prescribed to fill a target band's deficit ───────────────
  // opts: { band, mode, aim, vmax, vift, deficitM, runSec, restSec }
  // Speed comes from the BAND (guarantees the metres count in that zone); reps
  // from the deficit; %ASR reports how deep into the player's reserve it sits.
  function prescribeRun(opts) {
    const speed = bandTargetSpeed(opts.band, opts.mode, opts.aim, opts.vmax);
    if (speed == null || speed <= 0) return null;
    const mPerRep = Math.round((speed / 3.6) * opts.runSec);
    let reps = 0, sets = 0, repsPerSet = 0, totalRunM = 0, timeMin = 0;
    if (opts.deficitM > 0 && mPerRep > 0) {
      reps = Math.max(1, Math.ceil(opts.deficitM / mPerRep));
      repsPerSet = Math.min(reps, opts.runSec <= 12 ? 10 : 8);
      sets = Math.max(1, Math.ceil(reps / repsPerSet));
      totalRunM = reps * mPerRep;
      timeMin = +(reps * (opts.runSec + opts.restSec) / 60).toFixed(1);
    }
    const asrPct = pctASR(speed, opts.vift, opts.vmax);
    return {
      speed, mPerRep, reps, sets, repsPerSet, totalRunM, timeMin, asrPct,
      // deep into the reserve with long reps → likely not repeatable; flag it.
      tooHard: asrPct != null && asrPct > 50 && opts.runSec > 12,
    };
  }

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
  // GUARD: GPS imports carry garbage max_speed spikes — either huge (e.g. 16 000 000)
  // or "merely" impossible (45–49 km/h). Taken as the peak they blow up every
  // downstream number. Football GPS peaks top out ~36–38 km/h (fastest ever ≈ 38),
  // so 40 km/h is an "impossible" ceiling: ignore anything at/above it AND anything
  // flagged is_invalid, so the query returns the highest PLAUSIBLE speed and manual
  // flagging (mark a report invalid) is respected. See the diagnostic SQL in chat.
  const MAX_PLAUSIBLE_KMH = 40;
  async function getPlayerVmax(playerId, clubId) {
    if (!playerId || !clubId) return null;
    try {
      const { data } = await window.sb
        .from('gps_reports')
        .select('max_speed')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .eq('is_invalid', false)
        .not('max_speed', 'is', null)
        .lt('max_speed', MAX_PLAUSIBLE_KMH)
        .order('max_speed', { ascending: false })
        .limit(1)
        .maybeSingle();
      const v = data && data.max_speed ? +data.max_speed : null;
      return (v && v > 0 && v < MAX_PLAUSIBLE_KMH) ? v : null;
    } catch { return null; }
  }

  // ── Reference load per metric (best-5 or typical-match average) ────────
  // metrics: array of metric keys. mode: 'best' | 'avg'.
  // PERF: one round-trip for ALL metrics (fetch the player's match-day rows once,
  // reduce every metric client-side) instead of one getMatchBaseline query per
  // metric (~6 round-trips). Same best-5/avg + MIN=3 logic as getAllGpsReference.
  async function getReference(playerId, clubId, metrics, mode) {
    const out = {};
    const core = Array.from(new Set(metrics.filter(m => METRIC_DEFS[m])));
    metrics.forEach(m => out[m] = { baseline: null, count: 0, source: 'personal' });
    if (!playerId || !clubId || !core.length) return out;
    try {
      const matchDates = window.gpsGetMatchDates ? await window.gpsGetMatchDates(clubId) : null;
      if (!matchDates || !matchDates.size) return out;   // no tagged matches → let gps/position fallbacks fill in
      const { data } = await window.sb
        .from('gps_reports')
        .select(core.join(',') + ',is_invalid, training_sessions!inner(session_date)')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', [...matchDates]);
      const rows = (data || []).filter(r => !r.is_invalid);
      const n = 5, MIN = 3;
      core.forEach(m => {
        const vals = rows.map(r => r[m]).filter(v => v != null).map(Number);
        if (vals.length < MIN) { out[m] = { baseline: null, count: vals.length, source: 'personal' }; return; }
        const used = mode === 'avg' ? vals : vals.slice().sort((a, b) => b - a).slice(0, n);
        const mean = used.reduce((s, v) => s + v, 0) / used.length;
        out[m] = { baseline: +mean.toFixed(1), count: used.length, source: 'personal' };
      });
    } catch { /* degrade to nulls → gps/position/manual fallbacks */ }
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

  // ── Continuous (steady-state) running block ────────────────────────────
  // Fills a VOLUME deficit (total distance) with laps of the marked pitch, the
  // aerobic complement to the intermittent HIIT block. Two anchors:
  //   model 'vmax'  → speed = pct × Vmax (km/h): exact lap time, metres & total time.
  //   model 'fcmax' → prescribe a HR ZONE (lo–hi % of HRmax in bpm); the laps are the
  //                   volume container and the athlete self-regulates speed to hold the
  //                   zone, so we DON'T fake a speed/lap-time from heart rate.
  // Continuous aerobic running sits LOW on the Vmax scale (Vmax = peak sprint), hence
  // the low default %. Zones are configurable per club in the UI.
  // Standard 5-zone HR model (todomountainbike.net reference). tone drives the UI
  // colour: z1 gris · z2 celeste · z3 verde · z4 naranja · z5 rojo (rising intensity).
  // fcmax = the canonical %HRmax table; vmax = sane %Vmax defaults for the same named
  // zones (Vmax = peak sprint, so lower %). Both are editable per club in the UI.
  const CONT_DEFAULT_ZONE = 'z3';   // Moderada — aerobic by excellence
  const CONT_ZONES = {
    vmax: [
      { id: 'z1', label: 'Muy suave', lo: 0.45, hi: 0.55, tone: 'z1' },
      { id: 'z2', label: 'Suave',     lo: 0.55, hi: 0.62, tone: 'z2' },
      { id: 'z3', label: 'Moderada',  lo: 0.62, hi: 0.70, tone: 'z3' },
      { id: 'z4', label: 'Intensa',   lo: 0.70, hi: 0.80, tone: 'z4' },
      { id: 'z5', label: 'Máxima',    lo: 0.80, hi: 0.90, tone: 'z5' },
    ],
    fcmax: [
      { id: 'z1', label: 'Muy suave', lo: 0.50, hi: 0.60, tone: 'z1' },
      { id: 'z2', label: 'Suave',     lo: 0.60, hi: 0.70, tone: 'z2' },
      { id: 'z3', label: 'Moderada',  lo: 0.70, hi: 0.80, tone: 'z3' },
      { id: 'z4', label: 'Intensa',   lo: 0.80, hi: 0.90, tone: 'z4' },
      { id: 'z5', label: 'Máxima',    lo: 0.90, hi: 1.00, tone: 'z5' },
    ],
  };

  // Perimeter (one lap) of a rectangular field. Both sides in metres.
  function fieldPerimeter(lengthM, widthM) {
    const L = +lengthM, W = +widthM;
    if (!(L > 0) || !(W > 0)) return null;
    return Math.round(2 * (L + W));
  }

  // opts: { deficitM, lapM, model:'vmax'|'fcmax', blocks, restSec,
  //         vmax, pctVmax(0-1),            // vmax model
  //         hrmax, hrLoPct(0-1), hrHiPct(0-1) }  // fcmax model
  // Returns a prescription, or a { need:'vmax'|'fcmax'|'lap'|'deficit' } stub when a
  // required input is missing so the UI can show a precise hint. null on bad args.
  function prescribeContinuous(opts) {
    const o = opts || {};
    const lapM     = +o.lapM > 0 ? Math.round(+o.lapM) : 0;
    const deficitM = clamp0(+o.deficitM || 0);
    const blocks   = Math.max(1, Math.round(+o.blocks || 1));
    const restSec  = clamp0(+o.restSec || 0);
    if (lapM <= 0)     return { need: 'lap' };
    if (deficitM <= 0) return { need: 'deficit' };

    const laps         = Math.max(1, Math.ceil(deficitM / lapM));
    const totalM       = laps * lapM;
    const lapsPerBlock = Math.ceil(laps / blocks);
    const base = { model: o.model, lapM, deficitM: Math.round(deficitM), laps, totalM, blocks, lapsPerBlock };

    if (o.model === 'fcmax') {
      if (!o.hrmax || o.hrmax <= 0) return { ...base, need: 'fcmax' };
      const loP = o.hrLoPct != null ? o.hrLoPct : 0.70;
      const hiP = o.hrHiPct != null ? o.hrHiPct : 0.80;
      const out = {
        ...base,
        hr: {
          lo: Math.round(o.hrmax * loP), hi: Math.round(o.hrmax * hiP),
          loPct: Math.round(loP * 100), hiPct: Math.round(hiP * 100), hrmax: +o.hrmax,
        },
        speedKmh: null, lapSec: null, mPerMin: null, runMin: null, totalMin: null, pctVmax: null,
      };
      // Reference running pace to SIT IN this HR zone, derived from the aligned %Vmax of
      // the same named zone (HR is the master; the pace is a starting cue the athlete
      // adjusts to hold the zone). Only when Vmax is known.
      const pacePct = o.pacePct != null ? +o.pacePct : null;
      if (o.vmax > 0 && pacePct > 0) {
        const speedKmh = +(o.vmax * pacePct).toFixed(1);
        const ms       = speedKmh / 3.6;
        const runSec   = totalM / ms;
        out.speedKmh = speedKmh;
        out.lapSec   = Math.round(lapM / ms);
        out.mPerMin  = Math.round(ms * 60);
        out.runMin   = +(runSec / 60).toFixed(1);
        out.totalMin = +((runSec + restSec * (blocks - 1)) / 60).toFixed(1);
        out.pctVmax  = Math.round(pacePct * 100);
      }
      return out;
    }
    // vmax model
    if (!o.vmax || o.vmax <= 0) return { ...base, need: 'vmax' };
    const pct      = o.pctVmax != null ? o.pctVmax : 0.55;
    const speedKmh = +(o.vmax * pct).toFixed(1);
    const ms       = speedKmh / 3.6;
    const lapSec   = Math.round(lapM / ms);
    const runSec   = totalM / ms;
    return {
      ...base,
      speedKmh, lapSec,
      mPerMin: Math.round(ms * 60),
      runMin:  +(runSec / 60).toFixed(1),
      totalMin: +((runSec + restSec * (blocks - 1)) / 60).toFixed(1),
      pctVmax: Math.round(pct * 100),
      hr: null,
    };
  }

  // ── HRmax (max heart rate) metric resolver — CONFIGURABLE BY NAME ──────
  // HRmax is not a core column; clubs import it as a CUSTOM metric under any name
  // ('max_hr', 'fc_max', label 'FC Máx' / 'HR Max' / 'Pulso máximo' …). We recognise
  // it by matching the catalog (gps_metric_definitions) label+key: a token that means
  // heart-rate AND a token that means max. The UI can also pin a key explicitly.
  // Substring markers so GLUED names match too ('hrmax','fcmax','maxhr' → hr + max).
  const HRMAX_HR_HINTS  = ['heartrate', 'heart', 'frecuencia', 'cardiaca', 'cardiac', 'latido',
                           'pulso', 'pulse', 'hr', 'fc', 'bpm', 'ppm', 'lpm'];
  const HRMAX_MAX_HINTS = ['maximum', 'maxima', 'maximo', 'maxim', 'maxi', 'max', 'peak', 'pico'];
  const HRMAX_AVG_HINTS = ['avg', 'average', 'mean', 'prom', 'promedio', 'media', 'min', 'minimo', 'minima'];
  function _normTokens(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }
  // Similarity score (0-110) that a metric is the player's MAX heart rate. 100 = both an
  // HR and a MAX marker present; +10 if a single token carries both (hrmax/fcmax); an
  // avg/min marker demotes it (it's not a MAX). Used to auto-pick AND to rank the picker.
  function hrmaxScore(label, key) {
    const toks = _normTokens(label).concat(_normTokens(key));
    if (!toks.length) return 0;
    const hr    = toks.some(t => HRMAX_HR_HINTS.some(m => t === m || t.includes(m)));
    const mx    = toks.some(t => HRMAX_MAX_HINTS.some(m => t === m || t.includes(m)));
    const avg   = toks.some(t => HRMAX_AVG_HINTS.includes(t));
    const glued = toks.some(t => HRMAX_HR_HINTS.some(m => t.includes(m)) && HRMAX_MAX_HINTS.some(m => t.includes(m)));
    let s = 0;
    if (hr && mx) s = 100;
    else if (hr)  s = avg ? 15 : 45;
    else if (mx)  s = 5;
    if (glued) s += 10;
    if (avg && !glued) s = Math.max(0, s - 30);
    return s;
  }
  function looksLikeHRmax(label, key) { return hrmaxScore(label, key) >= 60; }
  // Every GPS metric the club has (catalog + any that only exist in imported data),
  // ranked by hrmaxScore so the likely HRmax metric floats to the top. [{key,label,unit}].
  async function listClubMetrics(clubId) {
    if (!clubId) return [];
    const out = new Map();
    try {
      const { data } = await window.sb.from('gps_metric_definitions')
        .select('key, label, unit').eq('club_id', clubId);
      (data || []).forEach(d => { if (d.key) out.set(d.key, { key: d.key, label: d.label || d.key, unit: d.unit || '' }); });
    } catch {}
    try {   // metrics present in the data but with no catalog row
      const { data } = await window.sb.from('gps_report_metrics')
        .select('metric_key').eq('club_id', clubId).limit(5000);
      (data || []).forEach(r => { if (r.metric_key && !out.has(r.metric_key)) out.set(r.metric_key, { key: r.metric_key, label: r.metric_key, unit: '' }); });
    } catch {}
    return [...out.values()].sort((a, b) =>
      hrmaxScore(b.label, b.key) - hrmaxScore(a.label, a.key) || String(a.label).localeCompare(String(b.label)));
  }
  // Returns { key, label } of the club's best-guess HRmax metric, or null.
  // CHEAP: only the catalog (small), so it can run on the player-load path. The heavy
  // data scan (listClubMetrics) is reserved for the manual picker.
  async function resolveHRmaxMetric(clubId) {
    if (!clubId) return null;
    try {
      const { data } = await window.sb.from('gps_metric_definitions')
        .select('key, label').eq('club_id', clubId);
      const best = (data || [])
        .map(d => ({ key: d.key, label: d.label || d.key, s: hrmaxScore(d.label, d.key) }))
        .sort((a, b) => b.s - a.s)[0];
      return best && best.s >= 60 ? { key: best.key, label: best.label } : null;
    } catch { return null; }
  }
  // Player's HRmax (bpm): peak of the HRmax metric across all their sessions (peak-of-
  // session-peaks ≈ true max). metricKey from resolveHRmaxMetric (or a UI override).
  async function getPlayerHRmax(playerId, clubId, metricKey) {
    if (!playerId || !clubId || !metricKey) return null;
    try {
      // One round-trip: filter metrics by (club, key) — indexed — and inner-join the
      // player's reports, taking the peak. Beats fetching all report ids then a second .in().
      const { data } = await window.sb
        .from('gps_report_metrics')
        .select('value, gps_reports!inner(player_id)')
        .eq('club_id', clubId)
        .eq('metric_key', metricKey)
        .eq('gps_reports.player_id', playerId)
        .not('value', 'is', null)
        .order('value', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data && data.value ? +data.value : null;
    } catch { return null; }
  }

  // Validate/normalise a user-defined interval preset (custom "formato de piques").
  // Returns a clean preset object or null if unusable.
  function normalizePreset(p) {
    if (!p) return null;
    const run  = Math.round(+p.run || 0);
    const rest = Math.round(+p.rest || 0);
    const pct  = Math.round(+p.pct || 0);
    if (run <= 0 || pct <= 0) return null;
    const id = p.id || `c-${run}-${rest}-${pct}`;
    const label = p.label && String(p.label).trim()
      ? String(p.label).trim()
      : `${run}-${rest} · ${pct}% VIFT`;
    return { id, label, run, rest, pct, custom: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLEMENTARY (stand-alone) session builder — NOT match-deficit driven.
  // The coach sets manual targets per session (DT / HSR / VHSR / sprint) and
  // assembles a drag-ordered sequence of work blocks (continuous laps · HSR/VHSR
  // /sprint passes · COD · pauses). Each block is computed PER PLAYER from their
  // Vmax (and VIFT when the %VIFT model is used), so three players sharing the
  // same structure get their own metres/times — exactly the PDF handoff format.
  // Pure logic; the HTML layer localises the display strings.
  // ─────────────────────────────────────────────────────────────────────────

  // Which %Vmax band each pass metric runs in (midpoint = target speed by default).
  const COMPL_BANDS = {
    high_speed_distance:      { id: 'hsr',    lo: 0.60, hi: 0.75 },
    very_high_speed_distance: { id: 'vhsr',   lo: 0.75, hi: 0.90 },
    sprint_distance:          { id: 'sprint', lo: 0.90, hi: 1.00 },
  };

  // Target running speed (km/h) for a pass block. pct model needs Vmax; vift model
  // anchors to the 30-15 IFT; abs is a fixed km/h. Returns null if unresolvable.
  function complPassSpeed(opts) {
    const o = opts || {};
    const model = o.model || 'pct';
    const aim   = o.aim == null ? 0.5 : o.aim;
    if (model === 'vift') {
      if (!o.vift || o.vift <= 0) return null;
      const pct = o.viftPct != null ? o.viftPct : 100;
      return +(o.vift * pct / 100).toFixed(1);
    }
    if (model === 'abs') {
      return o.absKmh > 0 ? +(+o.absKmh).toFixed(1) : null;
    }
    // pct: % of Vmax, midpoint of the band unless a custom aim is given
    const band = o.band || COMPL_BANDS[o.metric] || COMPL_BANDS.high_speed_distance;
    if (!o.vmax || o.vmax <= 0) return null;
    const hi = band.hi == null ? 1.0 : band.hi;
    return +(o.vmax * (band.lo + aim * (hi - band.lo))).toFixed(1);
  }

  // ── Straight-line "passes" block (pasadas) to hit a distance target in a zone.
  // opts: { targetM, passDist, speedKmh, recoverySec }
  // reps = ceil(target/passDist) · pace = passDist / speed · time = reps·(pace+recovery).
  function prescribePasses(opts) {
    const o = opts || {};
    const passDist = +o.passDist > 0 ? +o.passDist : 0;
    const target   = clamp0(+o.targetM || 0);
    const speed    = +o.speedKmh;
    const recovery = clamp0(+o.recoverySec || 0);
    if (!(speed > 0)) return { need: 'speed' };
    if (passDist <= 0) return { need: 'passDist' };
    if (target <= 0)   return { need: 'target' };
    const reps    = Math.max(1, Math.ceil(target / passDist));
    const totalM  = reps * passDist;
    const paceSec = +(passDist / (speed / 3.6)).toFixed(1);
    const timeSec = Math.round(reps * (paceSec + recovery));
    return { reps, passDist, speedKmh: speed, paceSec, recoverySec: recovery, totalM, timeSec };
  }

  // ── Compute one complementary block for one player → structured numbers.
  // block: { id, type:'cont'|'hsr'|'vhsr'|'sprint'|'cod'|'pause', ...fields }
  // cfg:   { lapM, model, aim, viftPct, absBy:{metric:kmh}, passDist(default), recoverySec }
  // pd:    { vmax, vift }
  // Returns { type, metersM, timeSec, ... } where metersM feeds the DT/HSR/... totals.
  const PASS_METRIC = { hsr: 'high_speed_distance', vhsr: 'very_high_speed_distance', sprint: 'sprint_distance' };
  function computeComplBlock(block, pd, cfg) {
    const b = block || {}, c = cfg || {}, p = pd || {};
    if (b.type === 'pause') {
      const sec = +b.seconds > 0 ? +b.seconds : (+b.minutes > 0 ? +b.minutes * 60 : 0);
      return { type: 'pause', metersM: 0, timeSec: Math.round(sec), note: b.note || '' };
    }
    if (b.type === 'cod') {
      const cod = prescribeCOD(+b.accCount || 0, +b.decCount || 0);
      // rough time: series × (~work 20s + rest) — informational only
      const timeSec = Math.round((+b.timeMin || 0) * 60);
      return { type: 'cod', metersM: 0, timeSec, total: cod.total, band: cod.band };
    }
    if (b.type === 'cont') {
      // Lap = manual override → global lap → derived from the pitch perimeter (L×W).
      const lapM  = +b.lapM > 0 ? +b.lapM : (+c.lapM > 0 ? +c.lapM : (fieldPerimeter(c.len, c.wid) || 0));
      const model = b.model === 'fcmax' ? 'fcmax' : 'vmax';
      // Intensity comes from a named 5-zone (z1..z5). The HR band uses the %HRmax table;
      // the lap pace uses the SAME zone's %Vmax so both models talk about the same zone.
      const zoneId = b.zoneId || CONT_DEFAULT_ZONE;
      const hrZones = CONT_ZONES.fcmax, vZones = CONT_ZONES.vmax;
      const hz = hrZones.find(z => z.id === zoneId) || hrZones.find(z => z.id === CONT_DEFAULT_ZONE) || hrZones[0];
      const vz = vZones.find(z => z.id === zoneId) || vZones.find(z => z.id === CONT_DEFAULT_ZONE) || vZones[0];
      const paceMid = (vz.lo + vz.hi) / 2;   // representative %Vmax for the lap pace
      const rx = prescribeContinuous({
        deficitM: +b.metersM || 0, lapM, model,
        blocks: +b.blocks || 1, restSec: +b.restSec || 0,
        vmax: p.vmax, pctVmax: paceMid,
        hrmax: p.hrmax, hrLoPct: hz.lo, hrHiPct: hz.hi, pacePct: paceMid,
      });
      if (!rx || rx.need) return { type: 'cont', need: rx ? rx.need : 'input', metersM: 0, timeSec: 0 };
      return {
        type: 'cont', metersM: rx.totalM, timeSec: Math.round((rx.runMin || 0) * 60),
        laps: rx.laps, lapM: rx.lapM, speedKmh: rx.speedKmh, lapSec: rx.lapSec,
        pctVmax: rx.pctVmax, blocks: rx.blocks, lapsPerBlock: rx.lapsPerBlock,
        model: rx.model, hr: rx.hr, zoneId, zoneLabel: (model === 'fcmax' ? hz : vz).label,
      };
    }
    // passes: hsr / vhsr / sprint
    const metric   = PASS_METRIC[b.type] || 'high_speed_distance';
    const passDist = +b.passDist > 0 ? +b.passDist : (+c.passDist > 0 ? +c.passDist : 30);
    const recovery = +b.recoverySec != null && +b.recoverySec >= 0 ? +b.recoverySec : (c.recoverySec != null ? +c.recoverySec : 25);
    const speedKmh = complPassSpeed({
      metric, band: COMPL_BANDS[metric], model: c.model, aim: c.aim,
      vmax: p.vmax, vift: p.vift, viftPct: c.viftPct,
      absKmh: (c.absBy && c.absBy[metric]) || null,
    });
    const rx = prescribePasses({ targetM: +b.targetM || 0, passDist, speedKmh, recoverySec: recovery });
    if (rx.need) return { type: b.type, metric, need: rx.need, metersM: 0, timeSec: 0, passDist, speedKmh };
    return { type: b.type, metric, ...rx, metersM: rx.totalM };
  }

  // ── Whole session for one player → rows + verification totals ──────────────
  // Returns { rows:[computeComplBlock result...], totals:{ dt, hsr, vhsr, sprint, timeSec } }.
  function buildComplDoc(pd, blocks, cfg) {
    const rows = (blocks || []).map(b => computeComplBlock(b, pd, cfg));
    const totals = { dt: 0, hsr: 0, vhsr: 0, sprint: 0, timeSec: 0 };
    rows.forEach(r => {
      totals.timeSec += r.timeSec || 0;
      if (r.type === 'cont') totals.dt += r.metersM || 0;
      else if (r.type === 'hsr') totals.hsr += r.metersM || 0;
      else if (r.type === 'vhsr') totals.vhsr += r.metersM || 0;
      else if (r.type === 'sprint') totals.sprint += r.metersM || 0;
    });
    return { rows, totals };
  }

  window.TopUp = {
    METRIC_DEFS, PRESETS, DEFAULT_PRESET, COD_BANDS, BAND_PCT,
    COMPL_BANDS, PASS_METRIC, complPassSpeed, prescribePasses, computeComplBlock, buildComplDoc,
    DEFAULT_BANDS_PCT, DEFAULT_BANDS_ABS, CONT_ZONES, CONT_DEFAULT_ZONE,
    getLatestVift, getPlayerVmax, getReference, getAllGpsReference, getPositionReference, getLatestMatchActual,
    computeDeficit, prescribeHIIT, prescribeCOD, prescribeRun,
    prescribeContinuous, fieldPerimeter, normalizePreset,
    resolveHRmaxMetric, getPlayerHRmax, looksLikeHRmax, hrmaxScore, listClubMetrics,
    bandTargetSpeed, anaerobicSpeedReserve, pctASR, speedProfile,
    // Override the fallback km/h thresholds used only when a player's Vmax is unknown.
    setFallbackThresholds(hsr, sprint) {
      if (hsr > 0) HSR_FALLBACK = +hsr;
      if (sprint > 0) SPRINT_FALLBACK = +sprint;
    },
  };
})();
