/* ────────────────────────────────────────────────────────────────────────
   player-load.js — "Load & wellness" tab of the read-only Player profile.
   Exposes: window.playerLoad.render({ playerId, clubId, seasonStart,
                                       seasonEnd, mount }) -> Promise<void>

   2×2 card grid:
     A) ACWR gauge (base-metric switchable)
     B) CTL / ATL / TSB
     C) Weekly load (s-RPE) + Foster monotony / strain
     D) Wellness — 7/14-day trend sparklines

   Self-contained. Reuses window.sb, window.gpsACWR, window.gpScience.
   Multi-tenant: every query .eq('club_id'). Resilient: "…" then graceful
   empty/insufficient states; never throws. SVG is viewBox-responsive.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const sb = () => window.sb;

  // Zone cls → token color for the gauge bands / badge.
  const ZONE_COLOR = {
    under:   'var(--cm-neutral)',
    sweet:   'var(--cm-success)',
    caution: 'var(--cm-warning)',
    risk:    'var(--cm-danger)',
  };
  const C_CTL = 'var(--cm-accent)';
  const C_ATL = 'var(--cm-warning)';
  const C_TSB = 'var(--cm-fg-muted)';

  // ── utils ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function iso(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function parseDay(s) {
    if (!s) return null;
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? null : d;
  }
  function fmtNum(v, dp) {
    const n = Number(v);
    if (!isFinite(n)) return '—';
    if (dp != null) return n.toFixed(dp);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }
  function enumerateDays(startStr, endStr) {
    const out = [];
    const s = parseDay(startStr), e = parseDay(endStr);
    if (!s || !e || e < s) return out;
    const cur = new Date(s);
    let guard = 0;
    while (cur <= e && guard++ < 1000) { out.push(iso(cur)); cur.setDate(cur.getDate() + 1); }
    return out;
  }
  function mondayOf(dateStr) {
    const d = parseDay(dateStr);
    if (!d) return null;
    const dow = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - dow);
    return iso(d);
  }
  function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
  function stdev(a) { // population SD (Foster)
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length);
  }

  function styleInject() {
    if (document.getElementById('pp-ld-styles')) return;
    const css = `
    .pp-ld-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
    @media (max-width:900px){ .pp-ld-grid { grid-template-columns:1fr; } }
    .pp-ld-card {
      background:var(--cm-surface); border:1px solid var(--cm-border);
      border-radius:var(--cm-r-4); box-shadow:var(--cm-shadow-1); padding:16px 18px;
    }
    .pp-ld-head { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
    .pp-ld-head .ti { font-size:16px; color:var(--cm-fg-muted); }
    .pp-ld-head h3 { font:600 14px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-ld-head .right { margin-left:auto; display:flex; align-items:center; gap:8px; }
    .pp-ld-head .sub { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .pp-ld-card svg { width:100%; height:auto; display:block; }
    .pp-ld-loading { display:flex; align-items:center; gap:8px; color:var(--cm-fg-faint); font:var(--cm-body-sm); padding:8px 0; }
    .pp-ld-empty { display:flex; flex-direction:column; gap:4px; padding:24px 8px; text-align:center; }
    .pp-ld-empty .t { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-ld-empty .h { font:var(--cm-body-sm); color:var(--cm-fg-faint); }

    .pp-ld-select { height:28px; padding:0 8px; border:1px solid var(--cm-border); border-radius:var(--cm-r-3);
      background:var(--cm-bg-soft); color:var(--cm-fg); font:500 12px/1 var(--cm-font-sans); }

    .pp-badge { display:inline-flex; align-items:center; gap:5px; height:22px; padding:0 9px; border-radius:999px; font:600 11.5px/1 var(--cm-font-sans); }
    .pp-badge .dot { width:7px; height:7px; border-radius:50%; }

    .pp-gauge-val { text-align:center; margin-top:2px; }
    .pp-gauge-val .n { font:700 30px/1 var(--cm-font-sans); color:var(--cm-fg-strong); letter-spacing:-0.02em; }
    .pp-gauge-val .b { display:block; margin-top:8px; }

    .pp-legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:10px; }
    .pp-legend .it { display:flex; align-items:center; gap:6px; font:var(--cm-body-sm); color:var(--cm-fg-muted); }
    .pp-legend .sw { width:14px; height:3px; border-radius:2px; }
    .pp-legend .vv { font:600 12px/1 var(--cm-font-mono); color:var(--cm-fg-strong); margin-left:2px; }

    .pp-spark { display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--cm-border-soft); }
    .pp-spark:last-child { border-bottom:0; }
    .pp-spark .lab { flex:0 0 132px; }
    .pp-spark .lab .nm { font:var(--cm-body-sm); color:var(--cm-fg); }
    .pp-spark .lab .hint { font:500 10px/1.3 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .pp-spark .sk { flex:1; min-width:0; }
    .pp-spark .cur { flex:0 0 auto; font:600 14px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }
    `;
    const el = document.createElement('style');
    el.id = 'pp-ld-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function loadingHTML() { return `<div class="pp-ld-loading"><i class="ti ti-loader-2"></i> …</div>`; }
  function miniEmpty(t, h) {
    return `<div class="pp-ld-empty"><span class="t">${esc(t)}</span>${h ? `<span class="h">${esc(h)}</span>` : ''}</div>`;
  }

  // ── Daily load series (shared by B and C) ─────────────────────────────────
  // Per calendar day, sum (load ?? rpe*duration). Zero-fill every day in range
  // so EMA/rolling have a continuous series. (ASSUMPTION: zero-fill flagged.)
  async function buildDaily(playerId, clubId, rangeStart, rangeEnd) {
    const { data } = await sb()
      .from('rpe')
      .select('rpe, duration, load, training_sessions(session_date)')
      .eq('club_id', clubId)
      .eq('player_id', playerId);
    const byDay = {};
    for (const r of (data || [])) {
      const ts = r.training_sessions;
      const sd = Array.isArray(ts) ? (ts[0] && ts[0].session_date) : (ts && ts.session_date);
      const day = sd ? String(sd).slice(0, 10) : null;
      if (!day) continue;
      let load = (r.load != null) ? Number(r.load) : ((r.rpe != null && r.duration != null) ? Number(r.rpe) * Number(r.duration) : null);
      if (load == null || !isFinite(load)) continue;
      byDay[day] = (byDay[day] || 0) + load;
    }
    return enumerateDays(rangeStart, rangeEnd).map(d => ({ date: d, load: byDay[d] || 0 }));
  }

  // ── Generic responsive multi-line chart ───────────────────────────────────
  // series: [{values:[{x:index,y}], color, dashed}], xLabels by index.
  function lineChart(rows, lines, opts) {
    opts = opts || {};
    const W = 640, H = 220, padL = 44, padR = 14, padT = 14, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = rows.length;
    if (!n) return `<div class="pp-ld-empty"><span class="h">No data.</span></div>`;

    let yMin = Infinity, yMax = -Infinity;
    lines.forEach(l => l.values.forEach(v => { if (v.y < yMin) yMin = v.y; if (v.y > yMax) yMax = v.y; }));
    if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.08; yMin -= pad; yMax += pad;
    if (opts.includeZero) { if (yMin > 0) yMin = 0; if (yMax < 0) yMax = 0; }

    const xAt = i => n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
    const yAt = y => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    let grid = '';
    const LINES = 5;
    for (let g = 0; g < LINES; g++) {
      const t = g / (LINES - 1), y = padT + t * plotH, v = yMax - t * (yMax - yMin);
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="var(--cm-border-soft)" stroke-width="1"/>`;
      grid += `<text x="${padL - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-family="var(--cm-font-mono)" font-size="9.5" fill="var(--cm-fg-faint)">${esc(fmtNum(v, 0))}</text>`;
    }
    // zero baseline
    let zero = '';
    if (opts.markZero && yMin < 0 && yMax > 0) {
      const yz = yAt(0);
      zero = `<line x1="${padL}" y1="${yz.toFixed(1)}" x2="${padL + plotW}" y2="${yz.toFixed(1)}" stroke="var(--cm-border-strong)" stroke-width="1" stroke-dasharray="2 2"/>`;
    }
    // x labels (thinned)
    let xl = '';
    const step = Math.max(1, Math.ceil(n / 8));
    rows.forEach((r, i) => {
      if (i % step === 0 || i === n - 1) {
        xl += `<text x="${xAt(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-family="var(--cm-font-sans)" font-size="9" fill="var(--cm-fg-faint)">${esc(r.label || '')}</text>`;
      }
    });
    let paths = '';
    lines.forEach(l => {
      if (l.values.length < 2) return;
      const pts = l.values.map(v => `${xAt(v.x).toFixed(1)},${yAt(v.y).toFixed(1)}`).join(' ');
      paths += `<polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"${l.dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(opts.aria || 'chart')}">${grid}${zero}${paths}${xl}</svg>`;
  }

  // ── Card A: ACWR gauge ────────────────────────────────────────────────────
  function gaugePoint(cx, cy, R, frac) { // frac 0..1 across the 180° dial
    const ang = Math.PI - frac * Math.PI; // 180° (left) → 0° (right)
    return [cx + R * Math.cos(ang), cy - R * Math.sin(ang)];
  }
  function gaugeArc(cx, cy, R, f0, f1) {
    const [x0, y0] = gaugePoint(cx, cy, R, f0);
    const [x1, y1] = gaugePoint(cx, cy, R, f1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  function renderGauge(ratio, zone) {
    const W = 260, H = 150, cx = W / 2, cy = 130, R = 100, MAXR = 2;
    const ZONES = (window.gpsACWR && window.gpsACWR.ACWR_ZONES) || [];
    let bands = '';
    ZONES.forEach(z => {
      const f0 = Math.min(1, z.from / MAXR);
      const f1 = Math.min(1, z.to / MAXR);
      if (f1 <= f0) return;
      bands += `<path d="${gaugeArc(cx, cy, R, f0, f1)}" fill="none" stroke="${ZONE_COLOR[z.cls] || 'var(--cm-border)'}" stroke-width="16" stroke-linecap="butt"/>`;
    });
    let needle = '';
    if (ratio != null && isFinite(ratio)) {
      const frac = Math.max(0, Math.min(1, ratio / MAXR));
      const [nx, ny] = gaugePoint(cx, cy, R - 22, frac);
      needle = `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--cm-fg-strong)" stroke-width="3" stroke-linecap="round"/>
                <circle cx="${cx}" cy="${cy}" r="5" fill="var(--cm-fg-strong)"/>`;
    }
    const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="ACWR gauge">${bands}${needle}</svg>`;
    const zc = zone ? (ZONE_COLOR[zone.cls] || 'var(--cm-neutral)') : 'var(--cm-neutral)';
    const valBlock = `<div class="pp-gauge-val">
      <span class="n">${ratio != null && isFinite(ratio) ? ratio.toFixed(2) : '—'}</span>
      ${zone ? `<span class="pp-badge b" style="background:color-mix(in srgb,${zc} 14%,transparent);color:${zc}"><span class="dot" style="background:${zc}"></span>${esc(zone.label)}</span>` : ''}
    </div>`;
    return svg + valBlock;
  }

  function fillAcwr(bodyEl, pdata) {
    const METRICS = (window.gpsACWR && window.gpsACWR.ACWR_METRICS) || [{ key: 'player_load', label: 'Player Load' }];
    let selected = 'player_load';

    const sel = document.createElement('select');
    sel.className = 'pp-ld-select';
    sel.innerHTML = METRICS.map(m => `<option value="${esc(m.key)}">${esc(m.label)}</option>`).join('');
    sel.value = selected;

    const chartHost = document.createElement('div');

    function paint() {
      if (!pdata || pdata.insufficient) {
        chartHost.innerHTML = miniEmpty('Not enough data', 'At least 4 sessions are needed for ACWR.');
        return;
      }
      const ratio = pdata[selected];
      const zone = (ratio != null && window.gpsACWR && window.gpsACWR.getZone) ? window.gpsACWR.getZone(ratio) : null;
      chartHost.innerHTML = renderGauge(ratio != null ? Number(ratio) : null, zone);
    }
    sel.addEventListener('change', () => { selected = sel.value; paint(); });

    // header select goes to the card head's right slot
    const head = bodyEl.closest('.pp-ld-card').querySelector('.pp-ld-head .right');
    if (head) head.appendChild(sel);
    bodyEl.innerHTML = '';
    bodyEl.appendChild(chartHost);
    paint();
  }

  // ── Card B: CTL / ATL / TSB ───────────────────────────────────────────────
  function fillTsb(bodyEl, daily) {
    if (!daily.length) { bodyEl.innerHTML = miniEmpty('No load data', ''); return; }
    const series = window.gpScience.trainingStressBalance(daily);
    const rows = series.map((s, i) => ({ label: s.date.slice(5), idx: i }));
    const lines = [
      { color: C_CTL, values: series.map((s, i) => ({ x: i, y: s.ctl })) },
      { color: C_ATL, values: series.map((s, i) => ({ x: i, y: s.atl })) },
      { color: C_TSB, dashed: true, values: series.map((s, i) => ({ x: i, y: s.tsb })) },
    ];
    const last = series[series.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
    const chart = lineChart(rows, lines, { markZero: true, includeZero: false, aria: 'CTL ATL TSB' });
    bodyEl.innerHTML = chart + `<div class="pp-legend">
      <span class="it"><span class="sw" style="background:${C_CTL}"></span>CTL <span class="vv">${fmtNum(last.ctl, 1)}</span></span>
      <span class="it"><span class="sw" style="background:${C_ATL}"></span>ATL <span class="vv">${fmtNum(last.atl, 1)}</span></span>
      <span class="it"><span class="sw" style="background:${C_TSB}"></span>TSB <span class="vv">${fmtNum(last.tsb, 1)}</span></span>
    </div>`;
  }

  // ── Card C: Weekly load (s-RPE) + Foster monotony/strain ───────────────────
  function fillWeekly(bodyEl, subEl, daily) {
    if (!daily.length) { bodyEl.innerHTML = miniEmpty('No load data', ''); return; }
    // group by Monday-of-week
    const weeks = {};
    daily.forEach(d => {
      const wk = mondayOf(d.date);
      if (!wk) return;
      (weeks[wk] = weeks[wk] || []).push(d.load);
    });
    const keys = Object.keys(weeks).sort();
    const all = keys.map(k => {
      const loads = weeks[k];
      const total = loads.reduce((a, b) => a + b, 0);
      const sd = stdev(loads);
      // Foster: monotony = weekMean / weekSD ; strain = weeklyLoad * monotony.
      const monotony = sd > 0 ? mean(loads) / sd : null;
      const strain = monotony != null ? total * monotony : null;
      return { week: k, total, monotony, strain };
    });
    const shown = all.slice(-8);
    if (!shown.length) { bodyEl.innerHTML = miniEmpty('No weekly load', ''); return; }

    const totals = shown.map(w => w.total);
    const thr = mean(totals) + stdev(totals);
    const cur = shown[shown.length - 1];

    // header: current week monotony + strain
    if (subEl) {
      subEl.textContent = `Monotony ${cur.monotony != null ? fmtNum(cur.monotony, 2) : '—'} · Strain ${cur.strain != null ? fmtNum(cur.strain, 0) : '—'}`;
    }

    // bar chart
    const W = 640, H = 220, padL = 44, padR = 14, padT = 14, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxV = Math.max(...totals, 1);
    const bw = plotW / shown.length;
    let grid = '';
    for (let g = 0; g < 5; g++) {
      const t = g / 4, y = padT + t * plotH, v = maxV - t * maxV;
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="var(--cm-border-soft)" stroke-width="1"/>`;
      grid += `<text x="${padL - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-family="var(--cm-font-mono)" font-size="9.5" fill="var(--cm-fg-faint)">${esc(fmtNum(v, 0))}</text>`;
    }
    let bars = '';
    shown.forEach((w, i) => {
      const h = (w.total / maxV) * plotH;
      const x = padL + i * bw + bw * 0.15;
      const y = padT + plotH - h;
      const isCur = i === shown.length - 1;
      // Flag amber if weeklyLoad > mean+1SD of shown weeks.
      const hot = w.total > thr;
      const fill = hot ? 'var(--cm-warning)' : (isCur ? 'var(--cm-accent)' : 'color-mix(in srgb,var(--cm-accent) 55%,transparent)');
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${fill}"/>`;
      bars += `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-family="var(--cm-font-sans)" font-size="9" fill="var(--cm-fg-faint)">${esc(w.week.slice(5))}</text>`;
    });
    bodyEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly load">${grid}${bars}</svg>`;
  }

  // ── Card D: Wellness sparklines ────────────────────────────────────────────
  function sparkline(points) { // points: [{y}]
    const W = 150, H = 32, pad = 3;
    const vals = points.map(p => p.y);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const n = points.length;
    const xAt = i => n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad);
    const yAt = y => pad + (H - 2 * pad) - ((y - mn) / (mx - mn)) * (H - 2 * pad);
    let line = '';
    if (n > 1) {
      line = `<polyline points="${points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--cm-accent)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    const lx = xAt(n - 1), ly = yAt(points[n - 1].y);
    const dot = `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.4" fill="var(--cm-accent)"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="32" role="img">${line}${dot}</svg>`;
  }
  function fillWellness(bodyEl, rows) {
    if (!rows.length) { bodyEl.innerHTML = miniEmpty('No wellness check-ins', 'Last 14 days have no entries.'); return; }
    const METRICS = [
      { key: 'readiness', label: 'Readiness', hint: 'higher is better' },
      { key: 'fatigue', label: 'Fatigue', hint: 'lower is better' },
      { key: 'sleep_quality', label: 'Sleep quality', hint: 'higher is better' },
    ];
    const html = METRICS.map(m => {
      const pts = rows.filter(r => r[m.key] != null).map(r => ({ y: Number(r[m.key]) }));
      const cur = pts.length ? fmtNum(pts[pts.length - 1].y, 0) : '—';
      return `<div class="pp-spark">
        <div class="lab"><div class="nm">${esc(m.label)}</div><div class="hint">${esc(m.hint)}</div></div>
        <div class="sk">${pts.length ? sparkline(pts) : '<span class="hint" style="color:var(--cm-fg-faint)">—</span>'}</div>
        <div class="cur">${cur}</div>
      </div>`;
    }).join('');
    bodyEl.innerHTML = html;
  }

  // ── Public entry ────────────────────────────────────────────────────────
  async function render({ playerId, clubId, seasonStart, seasonEnd, mount }) {
    if (!mount) return;
    styleInject();
    mount.innerHTML = loadingHTML();

    // Resolve range: season window, else last 120 days.
    let rangeStart = seasonStart, rangeEnd = seasonEnd;
    if (!rangeStart || !rangeEnd) {
      const today = new Date();
      const past = new Date(today); past.setDate(past.getDate() - 120);
      rangeStart = iso(past); rangeEnd = iso(today);
    }

    mount.innerHTML = `
      <div class="pp-ld-grid">
        <div class="pp-ld-card" data-ld="acwr">
          <div class="pp-ld-head"><i class="ti ti-gauge"></i><h3>ACWR</h3><span class="right"></span></div>
          <div data-ld-body="acwr">${loadingHTML()}</div>
        </div>
        <div class="pp-ld-card" data-ld="tsb">
          <div class="pp-ld-head"><i class="ti ti-chart-line"></i><h3>Fitness / Fatigue (CTL · ATL · TSB)</h3></div>
          <div data-ld-body="tsb">${loadingHTML()}</div>
        </div>
        <div class="pp-ld-card" data-ld="weekly">
          <div class="pp-ld-head"><i class="ti ti-chart-bar"></i><h3>Weekly load (s-RPE)</h3><div class="right"><span class="sub" data-ld-sub></span></div></div>
          <div data-ld-body="weekly">${loadingHTML()}</div>
        </div>
        <div class="pp-ld-card" data-ld="wellness">
          <div class="pp-ld-head"><i class="ti ti-heart-rate-monitor"></i><h3>Wellness — 14-day trend</h3></div>
          <div data-ld-body="wellness">${loadingHTML()}</div>
        </div>
      </div>`;

    const acwrBody = mount.querySelector('[data-ld-body="acwr"]');
    const tsbBody = mount.querySelector('[data-ld-body="tsb"]');
    const weeklyBody = mount.querySelector('[data-ld-body="weekly"]');
    const weeklySub = mount.querySelector('[data-ld-sub]');
    const wellBody = mount.querySelector('[data-ld-body="wellness"]');

    // Card A — ACWR (independent of daily series)
    (async () => {
      try {
        const m = await window.gpsACWR.calculatePlayerACWR({ clubId });
        fillAcwr(acwrBody, m ? m[playerId] : null);
      } catch (_) { acwrBody.innerHTML = miniEmpty('Not enough data', ''); }
    })();

    // Shared daily series → B + C
    (async () => {
      let daily = [];
      try { daily = await buildDaily(playerId, clubId, rangeStart, rangeEnd); } catch (_) { daily = []; }
      try { fillTsb(tsbBody, daily); } catch (_) { tsbBody.innerHTML = miniEmpty('No load data', ''); }
      try { fillWeekly(weeklyBody, weeklySub, daily); } catch (_) { weeklyBody.innerHTML = miniEmpty('No load data', ''); }
    })();

    // Card D — wellness (last 14 days)
    (async () => {
      try {
        const since = new Date(); since.setDate(since.getDate() - 14);
        const { data } = await sb()
          .from('wellness')
          .select('submitted_at, readiness, sleep_quality, fatigue, soreness, stress, mood')
          .eq('club_id', clubId)
          .eq('player_id', playerId)
          .gte('submitted_at', iso(since) + 'T00:00:00')
          .order('submitted_at', { ascending: true });
        fillWellness(wellBody, data || []);
      } catch (_) { wellBody.innerHTML = miniEmpty('No wellness check-ins', ''); }
    })();
  }

  window.playerLoad = { render };
})();
