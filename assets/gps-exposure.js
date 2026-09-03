/* ────────────────────────────────────────────────────────────────────────
   gps-exposure.js — "GPS Exposure" card. External-load exposure per week vs a
   trailing 4-week baseline, at squad OR per-player level (toggle).

   Exposes: window.gpsExposure.render({ clubId, players?, mount, refDate? })

   Why: ACWR gives ONE risk number; exposure tells you WHICH external-load
   dimension moved (e.g. HSR +29% → soft-tissue flag) — actionable for
   progressive overload and return-to-play. Data: public.gps_reports.

   Self-contained. Reuses window.sb (+ window.cmFetchAll if present). Never
   throws: shows loading "…" then graceful empty state. SVG sparklines are
   viewBox-responsive. Multi-tenant: every query .eq('club_id').
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Metrics mirror the GPS units' external-load streams.
  // agg: how a week is aggregated for one player ('sum' volume, 'mean' rate).
  const METRICS = [
    { key: 'total_distance',      label: 'Distance',    unit: 'm',     agg: 'sum',  fmt: 'dist' },
    { key: 'high_speed_distance', label: 'HSR',         unit: 'm',     agg: 'sum',  fmt: 'dist' },
    { key: 'sprint_distance',     label: 'Sprint Dist', unit: 'm',     agg: 'sum',  fmt: 'dist' },
    { key: 'accelerations',       label: 'High Accel',  unit: '',      agg: 'sum',  fmt: 'int'  },
    { key: 'decelerations',       label: 'High Decel',  unit: '',      agg: 'sum',  fmt: 'int'  },
    { key: 'player_load',         label: 'Player Load', unit: 'AU',    agg: 'sum',  fmt: 'int'  },
    { key: 'distance_per_minute', label: 'Metrage/min', unit: 'm/min', agg: 'mean', fmt: 'dec1' },
    { key: 'max_speed',           label: 'Max Speed',   unit: 'km/h',  agg: 'mean', fmt: 'dec1' },
  ];

  /** Append whatever else the club measures, keeping the eight above exactly as they are.
   *
   *  Deliberately additive: those eight carry curated labels and aggregations (Max Speed
   *  is shown as the WEEK'S MEAN peak, not the peak of peaks) and changing them would move
   *  numbers a coach is already reading. Anything the club adds simply shows up too.
   *
   *  Only gps_reports columns: line 119 builds a SELECT out of these keys. */
  let _catalogMerged = false;
  function mergeCatalogMetrics() {
    const C = window.cmGpsCatalog;
    if (!C || !C.isLoaded() || _catalogMerged) return METRICS;
    const known = new Set(METRICS.map(m => m.key));
    C.list().forEach(d => {
      if (known.has(d.key) || d.source !== 'column') return;
      const dec = C.decimals(d.key);
      METRICS.push({
        key: d.key, label: d.label, unit: d.unit || '',
        agg: d.agg === 'sum' ? 'sum' : 'mean',        // this module says 'mean', not 'avg'
        fmt: d.category === 'distance' ? 'dist' : (dec > 0 ? 'dec1' : 'int'),
      });
      known.add(d.key);
    });
    _catalogMerged = true;
    return METRICS;
  }
  const WEEKS_SHOWN   = 6;   // sparkline length
  const BASELINE_WEEKS = 4;  // trailing weeks used as baseline
  const MIN_BASELINE_WEEKS = 2;   // need this many complete in-season weeks before a % is trustworthy

  // ── utils ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function offset(refStr, days) {
    const d = new Date(refStr + 'T00:00:00'); d.setDate(d.getDate() + days); return iso(d);
  }
  function fmtVal(v, kind) {
    if (v == null || !isFinite(v)) return '—';
    if (kind === 'dist') return v >= 1000 ? (v / 1000).toFixed(1) + ' km' : Math.round(v) + ' m';
    if (kind === 'dec1') return v.toFixed(1);
    if (kind === 'int')  return v >= 10000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toLocaleString();
    return String(Math.round(v));
  }

  function styleInject() {
    if (document.getElementById('gpx-styles')) return;
    const css = `
    .gpx-card { background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:var(--cm-r-4);
      box-shadow:var(--cm-shadow-1); padding:16px 18px; }
    .gpx-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
    .gpx-head .ti { font-size:16px; color:var(--cm-fg-muted); }
    .gpx-head h3 { font:600 15px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .gpx-head .sub { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .gpx-head .right { margin-left:auto; display:flex; align-items:center; gap:8px; }
    .gpx-seg { display:inline-flex; border:1px solid var(--cm-border); border-radius:var(--cm-r-3); overflow:hidden; }
    .gpx-seg button { padding:5px 11px; font:600 11.5px/1 var(--cm-font-sans); background:var(--cm-bg-soft);
      color:var(--cm-fg-muted); border:0; cursor:pointer; }
    .gpx-seg button.is-on { background:var(--cm-accent); color:#fff; }
    .gpx-select { height:28px; padding:0 8px; border:1px solid var(--cm-border); border-radius:var(--cm-r-3);
      background:var(--cm-bg-soft); color:var(--cm-fg); font:600 12px/1 var(--cm-font-sans); }
    .gpx-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media (max-width:1100px){ .gpx-grid { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:560px){ .gpx-grid { grid-template-columns:1fr; } }
    .gpx-tile { border:1px solid var(--cm-border-soft); border-radius:var(--cm-r-3); padding:11px 12px;
      background:var(--cm-bg-soft); display:flex; flex-direction:column; gap:6px; }
    .gpx-tile .lab { display:flex; align-items:center; justify-content:space-between; }
    .gpx-tile .lab .nm { font:600 11.5px/1 var(--cm-font-sans); color:var(--cm-fg-muted); }
    .gpx-delta { font:700 11px/1 var(--cm-font-mono); padding:2px 6px; border-radius:999px; }
    .gpx-delta.up   { color:var(--cm-success); background:color-mix(in srgb, var(--cm-success) 12%, transparent); }
    .gpx-delta.hot  { color:var(--cm-warning); background:color-mix(in srgb, var(--cm-warning) 14%, transparent); }
    .gpx-delta.down { color:var(--cm-fg-muted); background:var(--cm-bg-sunk); }
    .gpx-delta.flat { color:var(--cm-fg-faint); background:var(--cm-bg-sunk); }
    .gpx-tile .val { font:700 20px/1 var(--cm-font-sans); color:var(--cm-fg-strong); letter-spacing:-0.01em; }
    .gpx-tile .val sub { font:500 10px/1 var(--cm-font-mono); color:var(--cm-fg-faint); margin-left:3px; }
    .gpx-tile svg { width:100%; height:26px; display:block; overflow:visible; }
    .gpx-tile .base { font:500 10px/1.3 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .gpx-loading, .gpx-empty { display:flex; align-items:center; gap:8px; color:var(--cm-fg-faint);
      font:var(--cm-body-sm); padding:14px 4px; }
    .gpx-empty { flex-direction:column; text-align:center; gap:4px; padding:24px 8px; }
    .gpx-empty .t { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }`;
    const el = document.createElement('style'); el.id = 'gpx-styles'; el.textContent = css;
    document.head.appendChild(el);
  }

  function sparkline(vals, accent) {
    const pts = vals.filter(v => v != null && isFinite(v));
    if (pts.length < 2) return '<svg viewBox="0 0 100 26" preserveAspectRatio="none"></svg>';
    const min = Math.min(...pts), max = Math.max(...pts), span = (max - min) || 1;
    const n = vals.length;
    const coords = vals.map((v, i) => {
      const x = (i / (n - 1)) * 100;
      const y = v == null ? null : 24 - ((v - min) / span) * 22;
      return y == null ? null : `${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean);
    const last = coords[coords.length - 1].split(',');
    return `<svg viewBox="0 0 100 26" preserveAspectRatio="none">
      <polyline points="${coords.join(' ')}" fill="none" stroke="${accent}" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="2" fill="${accent}"/></svg>`;
  }

  // ── data ──────────────────────────────────────────────────────────────────
  async function fetchRows(clubId, from, to, playerIds) {
    const { data: sessions } = await window.sb.from('training_sessions')
      .select('id, session_date').eq('club_id', clubId)
      .gte('session_date', from).lte('session_date', to);
    if (!sessions?.length) return [];
    const sessDate = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));
    const ids = sessions.map(s => s.id);
    const cols = ['player_id', 'session_id'].concat(METRICS.map(m => m.key)).join(',');

    let rows;
    if (window.cmFetchAll) {
      rows = await window.cmFetchAll(() => window.sb.from('gps_reports')
        .select(cols).eq('club_id', clubId).in('session_id', ids), { label: 'gpx.rows' });
    } else {
      rows = (await window.sb.from('gps_reports').select(cols).eq('club_id', clubId).in('session_id', ids)).data || [];
    }
    const allow = playerIds && playerIds.size ? playerIds : null;
    return (rows || []).map(r => ({ ...r, date: sessDate[r.session_id] }))
      .filter(r => r.date && (!allow || allow.has(r.player_id)));
  }

  // Aggregate one player's rows for a week window [start,end] for a metric.
  function weekAgg(rows, metric) {
    const vals = rows.map(r => Number(r[metric.key])).filter(v => isFinite(v));
    if (!vals.length) return null;
    return metric.agg === 'mean'
      ? vals.reduce((s, v) => s + v, 0) / vals.length
      : vals.reduce((s, v) => s + v, 0);
  }

  // Squad rollup across players for a week: 'sum' → total; 'mean' → mean of means.
  function squadRollup(perPlayerWeek, metric) {
    const vals = perPlayerWeek.filter(v => v != null && isFinite(v));
    if (!vals.length) return null;
    return metric.agg === 'mean'
      ? vals.reduce((s, v) => s + v, 0) / vals.length
      : vals.reduce((s, v) => s + v, 0);
  }

  // Build weekly series (index 0 = current week … WEEKS_SHOWN-1 = oldest) for a
  // metric, either squad-wide (playerId null) or one player.
  function weeklySeries(rowsByPlayer, weeks, metric, playerId) {
    return weeks.map(w => {
      const inWin = rs => rs.filter(r => r.date >= w.start && r.date <= w.end);
      if (playerId) return weekAgg(inWin(rowsByPlayer[playerId] || []), metric);
      const perPlayer = Object.values(rowsByPlayer).map(rs => weekAgg(inWin(rs), metric));
      return squadRollup(perPlayer, metric);
    });
  }

  // Baseline anchored to the season start. Only *complete* weeks that begin on or
  // after seasonStart count — a week straddling the season boundary (or before it)
  // is dropped, so a fresh season can't inflate deltas off one stray day. weeks[i]
  // aligns with series[i]; index 0 = current, 1..BASELINE_WEEKS = the baseline.
  function baselineStats(series, weeks, seasonStart) {
    const vals = [];
    for (let i = 1; i <= BASELINE_WEEKS && i < weeks.length; i++) {
      if (seasonStart && weeks[i] && weeks[i].start < seasonStart) continue;   // pre-season week
      const v = series[i];
      if (v != null && isFinite(v)) vals.push(v);
    }
    const baseline = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    // With a known season, readiness = enough complete in-season weeks. Without one,
    // fall back to "any baseline week has data" (legacy behaviour).
    const ready = seasonStart ? vals.length >= MIN_BASELINE_WEEKS : vals.length > 0;
    return { baseline, weeksUsed: vals.length, ready };
  }

  // ── compute (reusable; no DOM) ──────────────────────────────────────────────
  // Returns { ok, athletes, sessions, tiles:[{key,label,unit,fmt,current,baseline,
  //           delta,spark[]}] } for the squad (level 'squad') or one player.
  async function compute({ clubId, players, refDate, level, playerId, seasonStart }) {
    const ref = refDate || iso(new Date());
    const from = offset(ref, -(7 * WEEKS_SHOWN + 1));
    const playerIds = new Set((players || []).map(p => p.id));
    let rows = [];
    try { rows = await fetchRows(clubId, from, ref, playerIds); } catch { rows = []; }
    if (!rows.length) return { ok: false, athletes: 0, sessions: 0, tiles: [] };

    const rowsByPlayer = {};
    rows.forEach(r => (rowsByPlayer[r.player_id] || (rowsByPlayer[r.player_id] = [])).push(r));
    const weeks = [];
    for (let w = 0; w < WEEKS_SHOWN; w++)
      weeks.push({ start: offset(ref, -(7 * w + 6)), end: offset(ref, -(7 * w)) });

    // Distinct sessions per week window (0=current … oldest) — feeds baseline
    // confidence when there's no season anchor to lean on.
    const weekSessions = weeks.map(w =>
      new Set(rows.filter(r => r.date >= w.start && r.date <= w.end).map(r => r.session_id)).size);
    const baseSess = weekSessions.slice(1, 1 + BASELINE_WEEKS);

    // How many complete baseline weeks actually fall inside the season.
    let baseWeeksInSeason = 0;
    for (let i = 1; i <= BASELINE_WEEKS && i < weeks.length; i++)
      if ((!seasonStart || weeks[i].start >= seasonStart) && weekSessions[i] > 0) baseWeeksInSeason++;

    const pid = level === 'player' ? playerId : null;
    const tiles = METRICS.map(m => {
      const series = weeklySeries(rowsByPlayer, weeks, m, pid);   // 0=current … oldest
      const current = series[0];
      const { baseline, weeksUsed, ready } = baselineStats(series, weeks, seasonStart);
      const delta = (ready && current != null && baseline) ? (current - baseline) / baseline * 100 : null;
      return { key: m.key, label: m.label, unit: m.unit, fmt: m.fmt, agg: m.agg, current, baseline, delta,
        baseWeeks: weeksUsed, ready, spark: [...series].reverse() };   // oldest → newest
    });
    const sessions = new Set(rows.map(r => r.session_id)).size;
    const baselineReady = seasonStart ? baseWeeksInSeason >= MIN_BASELINE_WEEKS : tiles.some(t => t.ready);
    return { ok: true, athletes: Object.keys(rowsByPlayer).length, sessions, tiles, fmtVal,
      weekSessions, curSessions: weekSessions[0],
      baseSessionsAvg: baseSess.length ? baseSess.reduce((s, v) => s + v, 0) / baseSess.length : 0,
      seasonStart: seasonStart || null, baseWeeksInSeason, minBaselineWeeks: MIN_BASELINE_WEEKS, baselineReady };
  }

  // ── metric detail (per-player breakdown for one metric) ─────────────────────
  // Powers the drill-in modal: reveals WHO drives a squad delta and whether the
  // baseline is thin. Reuses the same fetch/aggregation as compute().
  async function metricDetail({ clubId, players, refDate, metricKey, seasonStart }) {
    const metric = METRICS.find(m => m.key === metricKey);
    if (!metric) return { ok: false };
    const ref = refDate || iso(new Date());
    const from = offset(ref, -(7 * WEEKS_SHOWN + 1));
    const playerIds = new Set((players || []).map(p => p.id));
    let rows = [];
    try { rows = await fetchRows(clubId, from, ref, playerIds); } catch { rows = []; }
    if (!rows.length) return { ok: false, metric };

    const rowsByPlayer = {};
    rows.forEach(r => (rowsByPlayer[r.player_id] || (rowsByPlayer[r.player_id] = [])).push(r));
    const weeks = [];
    for (let w = 0; w < WEEKS_SHOWN; w++)
      weeks.push({ start: offset(ref, -(7 * w + 6)), end: offset(ref, -(7 * w)) });

    const squadSeries = weeklySeries(rowsByPlayer, weeks, metric, null);        // 0=current … oldest
    const weekSessions = weeks.map(w =>
      new Set(rows.filter(r => r.date >= w.start && r.date <= w.end).map(r => r.session_id)).size);

    const nameById = {};
    (players || []).forEach(p => { nameById[p.id] = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Player'; });

    const per = Object.keys(rowsByPlayer)
      .filter(id => !players || playerIds.has(id))
      .map(id => {
        const s = weeklySeries(rowsByPlayer, weeks, metric, id);
        const current = s[0], b = baselineStats(s, weeks, seasonStart);
        const delta = (b.ready && current != null && b.baseline) ? (current - b.baseline) / b.baseline * 100 : null;
        return { id, name: nameById[id] || 'Player', current, baseline: b.baseline, delta, spark: [...s].reverse() };
      })
      .sort((a, b) => (b.current || 0) - (a.current || 0));   // top contributors first

    const sb = baselineStats(squadSeries, weeks, seasonStart);
    const current = squadSeries[0];
    const delta = (sb.ready && current != null && sb.baseline) ? (current - sb.baseline) / sb.baseline * 100 : null;
    // First season week that anchors the baseline (for the chart marker).
    const seasonWeekIdx = seasonStart ? weeks.findIndex(w => w.start >= seasonStart) : -1;
    const baseSess = weekSessions.slice(1, 1 + BASELINE_WEEKS);
    return { ok: true, metric,
      series: [...squadSeries].reverse(), weekSessions: [...weekSessions].reverse(),   // oldest → newest
      current, baseline: sb.baseline, delta, baseWeeks: sb.weeksUsed, ready: sb.ready, per, fmtVal,
      curSessions: weekSessions[0],
      baseSessionsAvg: baseSess.length ? baseSess.reduce((s, v) => s + v, 0) / baseSess.length : 0,
      seasonStart: seasonStart || null,
      seasonWeekIdxFromNewest: seasonWeekIdx >= 0 ? (WEEKS_SHOWN - 1 - seasonWeekIdx) : -1,
      minBaselineWeeks: MIN_BASELINE_WEEKS };
  }

  // ── render (standalone card; used when NOT embedding in a custom layout) ─────
  async function render({ clubId, players, mount, refDate }) {
    if (!mount) return;
    styleInject();
    // Pull in the club's own metrics before the tiles are built.
    try { await window.cmGpsCatalog?.ready(); mergeCatalogMetrics(); } catch (_e) {}
    const ref = refDate || iso(new Date());
    mount.innerHTML = `<div class="gpx-card"><div class="gpx-loading"><i class="ti ti-loader-2"></i> Loading GPS exposure…</div></div>`;

    const from = offset(ref, -(7 * WEEKS_SHOWN + 1));
    const playerIds = new Set((players || []).map(p => p.id));
    let rows;
    try { rows = await fetchRows(clubId, from, ref, playerIds); }
    catch (e) { rows = []; }

    if (!rows.length) {
      mount.innerHTML = `<div class="gpx-card"><div class="gpx-empty">
        <i class="ti ti-satellite" style="font-size:22px"></i>
        <span class="t">No GPS data yet</span>
        <span>Import GPS/wearable sessions to see squad exposure trends.</span></div></div>`;
      return;
    }

    const rowsByPlayer = {};
    rows.forEach(r => (rowsByPlayer[r.player_id] || (rowsByPlayer[r.player_id] = [])).push(r));

    // Contiguous 7-day windows anchored at ref.  weeks[0] = last 7 days.
    const weeks = [];
    for (let w = 0; w < WEEKS_SHOWN; w++)
      weeks.push({ start: offset(ref, -(7 * w + 6)), end: offset(ref, -(7 * w)) });

    const nameById = {};
    (players || []).forEach(p => { nameById[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player'; });
    const availableIds = Object.keys(rowsByPlayer).filter(id => !players || playerIds.has(id));

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--cm-accent').trim() || '#22c55e';
    let level = 'squad';                 // 'squad' | 'player'
    let selPlayer = availableIds[0] || null;

    function tiles() {
      const pid = level === 'player' ? selPlayer : null;
      return METRICS.map(m => {
        const series = weeklySeries(rowsByPlayer, weeks, m, pid);   // 0=current … oldest
        const current  = series[0];
        const baseVals = series.slice(1, 1 + BASELINE_WEEKS).filter(v => v != null && isFinite(v));
        const baseline = baseVals.length ? baseVals.reduce((s, v) => s + v, 0) / baseVals.length : null;
        const delta = (current != null && baseline) ? (current - baseline) / baseline * 100 : null;
        const dCls = delta == null ? 'flat'
          : delta >= 25 ? 'hot' : delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat';
        const dTxt = delta == null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(0) + '%';
        const spark = [...series].reverse();   // oldest → newest for the sparkline
        return `<div class="gpx-tile">
          <div class="lab"><span class="nm">${esc(m.label)}</span><span class="gpx-delta ${dCls}">${dTxt}</span></div>
          <div class="val">${fmtVal(current, m.fmt)}${m.unit ? `<sub>${esc(m.unit)}</sub>` : ''}</div>
          ${sparkline(spark, accent)}
          <div class="base">baseline ${fmtVal(baseline, m.fmt)} · ${BASELINE_WEEKS}-wk avg</div>
        </div>`;
      }).join('');
    }

    function paint() {
      const scope = level === 'squad'
        ? `${availableIds.length} athletes`
        : esc(nameById[selPlayer] || 'Player');
      mount.querySelector('.gpx-sub').textContent = `last 7 days vs ${BASELINE_WEEKS}-wk baseline · ${scope}`;
      mount.querySelector('.gpx-grid').innerHTML = tiles();
      const psel = mount.querySelector('.gpx-player');
      if (psel) psel.style.display = level === 'player' ? '' : 'none';
    }

    mount.innerHTML = `<div class="gpx-card">
      <div class="gpx-head">
        <i class="ti ti-satellite"></i>
        <h3>GPS Exposure</h3>
        <span class="sub gpx-sub"></span>
        <div class="right">
          <select class="gpx-select gpx-player" title="Player">
            ${availableIds.map(id => `<option value="${esc(id)}">${esc(nameById[id] || 'Player')}</option>`).join('')}
          </select>
          <div class="gpx-seg gpx-level">
            <button data-lvl="squad" class="is-on">Squad</button>
            <button data-lvl="player">Per player</button>
          </div>
        </div>
      </div>
      <div class="gpx-grid"></div>
    </div>`;

    mount.querySelectorAll('.gpx-level button').forEach(b => b.addEventListener('click', () => {
      level = b.dataset.lvl;
      mount.querySelectorAll('.gpx-level button').forEach(x => x.classList.toggle('is-on', x === b));
      paint();
    }));
    const psel = mount.querySelector('.gpx-player');
    psel?.addEventListener('change', () => { selPlayer = psel.value; paint(); });

    paint();
  }

  window.gpsExposure = { render, compute, metricDetail, METRICS, fmtVal, sparkline, mergeCatalogMetrics };
})();
