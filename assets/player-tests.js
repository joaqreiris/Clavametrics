/* ────────────────────────────────────────────────────────────────────────
   player-tests.js — "Physical & tests" tab of the read-only Player profile.
   Exposes: window.playerTests.render({ playerId, clubId, mount }) -> Promise<void>

   Builds into `mount`:
     • a test-type selector (pills) from the distinct objective evaluation types
     • an evolution line chart (viewBox-responsive SVG) for the selected type
     • a records table for the selected type

   Self-contained. Reuses window.sb. Multi-tenant: every query .eq('club_id').
   Resilient: shows a "…" loading state, then empty states; never throws.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const sb = () => window.sb;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ── utils ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function shortDate(s) {
    if (!s) return '—';
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return esc(String(s).slice(0, 10));
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  function fmtNum(v) {
    const n = Number(v);
    if (!isFinite(n)) return esc(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }
  function fmtNotes(notes){
    if (!notes) return '—';
    let o = null;
    try { o = JSON.parse(notes); } catch (_) { return esc(notes); }   // plain text → as-is
    if (!o || typeof o !== 'object') return esc(notes);
    const parts = [];
    if (o.exercise) parts.push(o.exercise);
    if (o.method)   parts.push(String(o.method));
    if (o.est1RM != null) parts.push('est1RM ' + fmtNum(o.est1RM));
    if (o.R2 != null)     parts.push('R² ' + Number(o.R2).toFixed(2));
    if (parts.length) return esc(parts.join(' · '));
    // unknown JSON shape → compact scalar fields only (never dump arrays/objects)
    const scal = Object.entries(o)
      .filter(([,v]) => v == null || typeof v !== 'object')
      .slice(0, 4).map(([k,v]) => k + ':' + v);
    return scal.length ? esc(scal.join(' · ')) : '—';
  }
  function styleInject() {
    if (document.getElementById('pp-ts-styles')) return;
    const css = `
    .pp-ts { display:flex; flex-direction:column; gap:16px; }
    .pp-ts-pills { display:flex; flex-wrap:wrap; gap:6px; }
    .pp-tpill {
      height:30px; padding:0 12px; display:inline-flex; align-items:center; gap:6px;
      border:1px solid var(--cm-border); background:var(--cm-surface);
      color:var(--cm-fg-muted); font:500 12.5px/1 var(--cm-font-sans);
      border-radius:999px; cursor:pointer;
    }
    .pp-tpill:hover { color:var(--cm-fg); border-color:var(--cm-border-strong); }
    .pp-tpill.is-on { background:var(--cm-fg-strong); color:#fff; border-color:var(--cm-fg-strong); }
    .pp-tpill .ct { font:500 11px/1 var(--cm-font-mono); opacity:0.7; }
    .pp-ts-card {
      background:var(--cm-surface); border:1px solid var(--cm-border);
      border-radius:var(--cm-r-4); box-shadow:var(--cm-shadow-1); padding:16px 18px;
    }
    .pp-ts-card-head { display:flex; align-items:baseline; gap:8px; margin-bottom:12px; }
    .pp-ts-card-head h3 { font:600 14px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-ts-card-head .sub { margin-left:auto; font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .pp-ts-chart svg { width:100%; height:auto; display:block; }
    .pp-ts-note { margin-top:8px; font:var(--cm-body-sm); color:var(--cm-fg-faint); }
    .pp-ts-loading { display:flex; align-items:center; gap:8px; color:var(--cm-fg-faint); font:var(--cm-body-sm); padding:8px 0; }
    .pp-ts-empty { display:flex; flex-direction:column; gap:4px; padding:32px 8px; text-align:center; }
    .pp-ts-empty .t { font:600 14px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }

    .pp-ts-table { width:100%; border-collapse:collapse; }
    .pp-ts-table thead th {
      text-align:left; padding:8px 10px; font:500 11px/1 var(--cm-font-sans);
      letter-spacing:0.06em; text-transform:uppercase; color:var(--cm-fg-muted);
      border-bottom:1px solid var(--cm-border);
    }
    .pp-ts-table tbody td {
      padding:9px 10px; border-bottom:1px solid var(--cm-border-soft);
      font:var(--cm-body-sm); color:var(--cm-fg); vertical-align:top;
    }
    .pp-ts-table tbody tr:last-child td { border-bottom:0; }
    .pp-ts-table .vl { font:600 13px/1 var(--cm-font-mono); color:var(--cm-fg-strong); white-space:nowrap; }
    .pp-ts-table .un { font:500 11px/1 var(--cm-font-mono); color:var(--cm-fg-muted); margin-left:2px; }
    .pp-ts-table .dl { font:500 12px/1 var(--cm-font-mono); color:var(--cm-fg-faint); white-space:nowrap; }
    .pp-ts-table .dl.dl-pos{color:var(--cm-success)} .pp-ts-table .dl.dl-neg{color:var(--cm-danger)}
    .pp-ts-table .nt { color:var(--cm-fg-muted); }
    .pp-ts-table .col-date { width:96px; }
    .pp-ts-table .col-val { width:110px; }
    .pp-ts-table .col-delta { width:80px; }
    `;
    const el = document.createElement('style');
    el.id = 'pp-ts-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── Evolution chart (viewBox-responsive SVG) ──────────────────────────────
  function renderChart(rows, band) {
    // rows: chronological [{test_date, value, unit}], value coerced to number
    const W = 640, H = 240;
    const padL = 46, padR = 18, padT = 16, padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const vals = rows.map(r => Number(r.value)).filter(v => isFinite(v));
    if (!vals.length) {
      return `<div class="pp-ts-note">No numeric values to plot.</div>`;
    }

    // Fold the squad band into the scale so it's visible.
    const scaleVals = vals.slice();
    if (band && band.n >= 4 && band.mean != null) {
      scaleVals.push(band.mean);
      if (band.sd) { scaleVals.push(band.mean - band.sd, band.mean + band.sd); }
    }

    let yMin = Math.min(...scaleVals), yMax = Math.max(...scaleVals);
    if (yMin === yMax) { const pad = Math.abs(yMin) * 0.1 || 1; yMin -= pad; yMax += pad; }
    else { const pad = (yMax - yMin) * 0.08; yMin -= pad; yMax += pad; }

    const n = rows.length;
    const xAt = i => n === 1 ? (padL + plotW / 2) : (padL + (i / (n - 1)) * plotW);
    const yAt = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // TODO (deferred): per-test "PB" marker — needs per-test direction-of-better.

    // Squad mean±SD band (drawn first, behind grid/line/dots).
    let bandSvg = '';
    if (band && band.n >= 4 && band.mean != null) {
      const lo = band.sd ? band.mean - band.sd : band.mean;
      const hi = band.sd ? band.mean + band.sd : band.mean;
      const yA = yAt(Math.max(yMin, Math.min(yMax, lo))), yB = yAt(Math.max(yMin, Math.min(yMax, hi)));
      const yTop = Math.min(yA, yB), yBot = Math.max(yA, yB);
      bandSvg += `<rect x="${padL}" y="${yTop.toFixed(1)}" width="${plotW}" height="${(yBot - yTop).toFixed(1)}" fill="color-mix(in srgb,var(--cm-fg-muted) 8%,transparent)"/>`;
      const yMean = yAt(Math.max(yMin, Math.min(yMax, band.mean)));
      bandSvg += `<line x1="${padL}" y1="${yMean.toFixed(1)}" x2="${padL + plotW}" y2="${yMean.toFixed(1)}" stroke="var(--cm-fg-muted)" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>`;
      bandSvg += `<text x="${padL + plotW}" y="${(yMean - 4).toFixed(1)}" text-anchor="end" font-family="var(--cm-font-sans)" font-size="9.5" fill="var(--cm-fg-faint)">squad avg ${fmtNum(band.mean)}</text>`;
    }

    // gridlines + Y labels (5 lines)
    const LINES = 5;
    let grid = '';
    for (let g = 0; g < LINES; g++) {
      const t = g / (LINES - 1);
      const v = yMax - t * (yMax - yMin);
      const y = padT + t * plotH;
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="var(--cm-border-soft)" stroke-width="1"/>`;
      grid += `<text x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-family="var(--cm-font-mono)" font-size="10" fill="var(--cm-fg-faint)">${esc(fmtNum(v))}</text>`;
    }

    // X labels (date per point)
    let xlabels = '';
    rows.forEach((r, i) => {
      xlabels += `<text x="${xAt(i).toFixed(1)}" y="${H - 12}" text-anchor="middle" font-family="var(--cm-font-sans)" font-size="9.5" fill="var(--cm-fg-faint)">${esc(shortDate(r.test_date))}</text>`;
    });

    // polyline + dots
    let line = '', dots = '';
    if (n > 1) {
      const pts = rows.map((r, i) => `${xAt(i).toFixed(1)},${yAt(Number(r.value)).toFixed(1)}`).join(' ');
      line = `<polyline points="${pts}" fill="none" stroke="var(--cm-accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    rows.forEach((r, i) => {
      const x = xAt(i).toFixed(1), y = yAt(Number(r.value)).toFixed(1);
      const last = i === n - 1;
      if (last) {
        dots += `<circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="var(--cm-accent)" stroke-width="1.5" opacity="0.5"/>`;
        dots += `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--cm-accent)"/>`;
      } else {
        dots += `<circle cx="${x}" cy="${y}" r="3" fill="var(--cm-accent)"/>`;
      }
    });

    return `<div class="pp-ts-chart">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Test evolution chart">
        ${bandSvg}${grid}${line}${dots}${xlabels}
      </svg>
    </div>${n === 1 ? `<div class="pp-ts-note">Only one measurement — no trend yet.</div>` : ''}`;
  }

  // ── Records table ─────────────────────────────────────────────────────────
  function renderTable(rows) {
    // rows chronological asc; table is most-recent-first.
    const desc = rows.slice().reverse();
    const body = desc.map((r, idx) => {
      // previous (chronologically earlier) measurement for the delta
      const prev = desc[idx + 1];
      let dl = '—', d = null;
      if (prev && r.value != null && prev.value != null) {
        d = Number(r.value) - Number(prev.value);
        // delta colored by direction-of-better (lower-is-better via window.evalDir)
        const sign = d > 0 ? '+' : (d < 0 ? '−' : '');
        dl = sign + fmtNum(Math.abs(d));
      }
      const dir = window.evalDir ? window.evalDir.deltaDir(d, r.evaluation_type, r.unit) : 'flat';
      return `<tr>
        <td class="col-date">${esc(shortDate(r.test_date))}</td>
        <td class="col-val"><span class="vl">${r.value == null ? '—' : esc(fmtNum(r.value))}<span class="un">${esc(r.unit || '')}</span></span></td>
        <td class="col-delta"><span class="dl${dir==='flat'?'':' dl-'+dir}">${esc(dl)}</span></td>
        <td class="nt" title="${esc(r.notes || '')}">${fmtNotes(r.notes)}</td>
      </tr>`;
    }).join('');

    return `<table class="pp-ts-table">
      <thead><tr>
        <th class="col-date">Date</th>
        <th class="col-val">Value</th>
        <th class="col-delta">Δ prev</th>
        <th>Notes</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  // ── Public entry ────────────────────────────────────────────────────────
  async function render({ playerId, clubId, teamId, mount }) {
    if (!mount) return;
    styleInject();
    const statsCache = {};
    mount.innerHTML = `<div class="pp-ts-loading"><i class="ti ti-loader-2"></i> …</div>`;

    let rows = [];
    try {
      const { data } = await sb()
        .from('evaluations')
        .select('evaluation_type, test_date, value, unit, notes')
        .eq('club_id', clubId)
        .eq('player_id', playerId)
        .neq('unit', '/10')
        .order('test_date', { ascending: true });
      rows = data || [];
    } catch (_) {
      rows = [];
    }

    if (!rows.length) {
      // No legacy evaluations — DB-driven assessment blocks may still exist.
      mount.innerHTML = '';
      const flags = [];
      const had = await renderAssessmentBlocks({ playerId, clubId, teamId, mount, flags });
      if (!had) { mount.innerHTML = `<div class="pp-ts-empty"><span class="t">No physical tests recorded yet</span></div>`; return; }
      renderPreventionSummary(flags, mount);
      return;
    }

    // group by evaluation_type (rows already chronological asc)
    const groups = {};
    for (const r of rows) (groups[r.evaluation_type] = groups[r.evaluation_type] || []).push(r);

    const types = Object.keys(groups);
    // Default = most records; tie → most recent last test_date.
    let selected = types[0];
    types.forEach(t => {
      const g = groups[t], s = groups[selected];
      if (g.length > s.length) selected = t;
      else if (g.length === s.length) {
        const gd = g[g.length - 1].test_date || '', sd = s[s.length - 1].test_date || '';
        if (gd > sd) selected = t;
      }
    });

    // scaffold
    mount.innerHTML = `
      <div class="pp-ts">
        <div class="pp-ts-pills"></div>
        <div class="pp-ts-card">
          <div class="pp-ts-card-head"><h3>Evolution</h3><span class="sub" data-ts-sub></span></div>
          <div data-ts-chart></div>
        </div>
        <div class="pp-ts-card">
          <div class="pp-ts-card-head"><h3>Records</h3></div>
          <div data-ts-table></div>
        </div>
      </div>`;

    const pillsEl = mount.querySelector('.pp-ts-pills');
    const chartEl = mount.querySelector('[data-ts-chart]');
    const tableEl = mount.querySelector('[data-ts-table]');
    const subEl = mount.querySelector('[data-ts-sub]');

    async function paint() {
      const g = groups[selected] || [];
      pillsEl.querySelectorAll('.pp-tpill').forEach(p => p.classList.toggle('is-on', p.dataset.type === selected));
      const unit = (g.find(r => r.unit) || {}).unit || '';
      let band = null, pctTxt = '';
      if (teamId && window.evalBench) {
        try {
          if (!(selected in statsCache)) {
            const s = await window.evalBench.categoryStats({ clubId, teamId, types:[selected], physicalOnly:true });
            statsCache[selected] = s[selected] || null;
          }
          const st = statsCache[selected];
          if (st && st.n >= 4) {
            band = { mean: st.mean, sd: st.sd, n: st.n };
            const lb = window.evalDir ? window.evalDir.isLowerBetter(selected, unit) : false;
            const latestVal = g.length ? Number(g[g.length - 1].value) : null;
            const pr = window.evalBench.percentile(latestVal, st, lb);
            if (pr != null) pctTxt = ` · Top ${100 - pr}%`;
          }
        } catch (_) {}
      }
      subEl.textContent = `${selected}${unit ? ' · ' + unit : ''} · ${g.length} record${g.length === 1 ? '' : 's'}${pctTxt}`;
      chartEl.innerHTML = renderChart(g, band);
      tableEl.innerHTML = renderTable(g);
    }

    pillsEl.innerHTML = types.map(t =>
      `<button class="pp-tpill" data-type="${esc(t)}">${esc(t)}<span class="ct">${groups[t].length}</span></button>`).join('');
    pillsEl.querySelectorAll('.pp-tpill').forEach(btn => {
      btn.addEventListener('click', () => { selected = btn.dataset.type; paint(); });
    });

    paint();

    // DB-driven isometric strength + mobility blocks, appended below the legacy content.
    const flags = [];
    await renderAssessmentBlocks({ playerId, clubId, teamId, mount, flags });
    renderPreventionSummary(flags, mount);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Isometric strength + Mobility blocks (force_tests + force_test_metrics +
  //  assessment_test_defs). Resilient: any failure → block skipped, never throws.
  // ══════════════════════════════════════════════════════════════════════════
  const T = (k, f) => (window.tt ? window.tt(k, f) : f);
  function statusColor(s){ return s==='alert'?'var(--cm-danger)':s==='watch'?'var(--cm-warning,#B45309)':s==='ok'?'var(--cm-success)':'var(--cm-fg-faint)'; }
  function statusChip(res){
    if (!res || res.status === 'none') return '';
    const c = statusColor(res.status);
    const lbl = T('evaluations.status_'+res.status, res.status);
    const tip = window.assessNorms ? window.assessNorms.explain(res) : '';
    return `<span class="pp-as-chip" title="${esc(tip)}" style="color:${c}"><span class="d" style="background:${c}"></span>${esc(lbl)}</span>`;
  }
  const _rank = { none:0, ok:1, watch:2, alert:3 };
  function worst(list){ let b={status:'none'}; list.forEach(r=>{ if (r && (_rank[r.status]||0) > (_rank[b.status]||0)) b=r; }); return b; }

  // ── Prevention summary banner (rolls up all watch/alert flags at a glance) ──
  function styleInjectPrev(){
    if (document.getElementById('pp-prev-styles')) return;
    const css = `
    .pp-prev-head { display:flex; align-items:center; gap:10px; }
    .pp-prev-head .t { font:600 13px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-prev-head.ok .t { color:var(--cm-fg-muted); font-weight:500; }
    .pp-prev-head .d { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
    .pp-prev-counts { margin-left:auto; display:flex; gap:14px; }
    .pp-prev-count { display:inline-flex; align-items:center; gap:6px; font:600 12px/1 var(--cm-font-sans); }
    .pp-prev-count .d { width:8px; height:8px; border-radius:50%; }
    .pp-prev-count.alert { color:var(--cm-danger); } .pp-prev-count.alert .d { background:var(--cm-danger); }
    .pp-prev-count.watch { color:var(--cm-warning,#B45309); } .pp-prev-count.watch .d { background:var(--cm-warning,#B45309); }
    .pp-prev-list { list-style:none; margin:12px 0 0; padding:0; display:flex; flex-direction:column; gap:9px; }
    .pp-prev-item { display:flex; align-items:center; gap:8px; }
    .pp-prev-item .d { width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
    .pp-prev-item .lbl { font:600 12.5px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-prev-item .sub { font:600 11px/1 var(--cm-font-mono); color:var(--cm-fg-muted); }
    .pp-prev-item .rsn { margin-left:auto; font:500 11.5px/1.3 var(--cm-font-sans); color:var(--cm-fg-muted); text-align:right; max-width:52%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    `;
    const el = document.createElement('style'); el.id = 'pp-prev-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function renderPreventionSummary(flags, mount){
    if (!mount) return;
    styleInjectPrev();
    const alerts  = (flags || []).filter(f => f.status === 'alert');
    const watches = (flags || []).filter(f => f.status === 'watch');
    let inner;
    if (!alerts.length && !watches.length){
      inner = `<div class="pp-prev-head ok"><span class="d" style="background:${statusColor('ok')}"></span>`
        + `<span class="t">${esc(T('player.prev_all_clear','No prevention flags — all evaluations in range'))}</span></div>`;
    } else {
      const counts = [];
      if (alerts.length)  counts.push(`<span class="pp-prev-count alert"><span class="d"></span>${alerts.length} ${esc(T('player.prev_alerts','alerts'))}</span>`);
      if (watches.length) counts.push(`<span class="pp-prev-count watch"><span class="d"></span>${watches.length} ${esc(T('player.prev_watch','to watch'))}</span>`);
      const items = alerts.concat(watches).map(f => `<li class="pp-prev-item">`
        + `<span class="d" style="background:${statusColor(f.status)}"></span>`
        + `<span class="lbl">${esc(f.label)}</span>`
        + (f.sub ? `<span class="sub">${esc(f.sub)}</span>` : '')
        + (f.detail ? `<span class="rsn" title="${esc(f.detail)}">${esc(f.detail)}</span>` : '')
        + `</li>`).join('');
      inner = `<div class="pp-prev-head"><span class="t">${esc(T('player.prev_title','Prevention summary'))}</span>`
        + `<span class="pp-prev-counts">${counts.join('')}</span></div>`
        + `<ul class="pp-prev-list">${items}</ul>`;
    }
    mount.insertAdjacentHTML('afterbegin', `<div class="pp-ts-card pp-prev">${inner}</div>`);
  }

  function styleInjectAssess(){
    if (document.getElementById('pp-as-styles')) return;
    const css = `
    .pp-as-rows { display:flex; flex-direction:column; gap:14px; }
    .pp-as-row { display:flex; flex-direction:column; gap:6px; padding-bottom:12px; border-bottom:1px solid var(--cm-border-soft); }
    .pp-as-row:last-child { border-bottom:0; padding-bottom:0; }
    .pp-as-row-h { display:flex; align-items:center; gap:8px; }
    .pp-as-row-h .nm { font:600 13px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-as-row-h .meta { margin-left:auto; display:flex; align-items:center; gap:10px; }
    .pp-as-chip { display:inline-flex; align-items:center; gap:5px; font:600 11px/1 var(--cm-font-sans); }
    .pp-as-chip .d { width:7px; height:7px; border-radius:50%; }
    .pp-as-dl { font:500 12px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .pp-as-dl.dl-pos{color:var(--cm-success)} .pp-as-dl.dl-neg{color:var(--cm-danger)}
    .pp-as-bar-row { display:grid; grid-template-columns:20px 1fr 96px; gap:8px; align-items:center; }
    .pp-as-bar-lbl { font:600 11px/1 var(--cm-font-mono); color:var(--cm-fg-muted); }
    .pp-as-bar-track { height:8px; border-radius:6px; background:var(--cm-bg-sunk,rgba(0,0,0,.06)); overflow:hidden; }
    .pp-as-bar-fill { display:block; height:100%; border-radius:6px; }
    .pp-as-bar-val { text-align:right; font:600 12px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }
    .pp-as-bar-val .un { font-weight:500; color:var(--cm-fg-muted); margin-left:2px; }
    .pp-as-sec { font:500 11px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .pp-as-ratios { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid var(--cm-border); }
    .pp-as-ratio { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:8px; background:var(--cm-surface); border:1px solid var(--cm-border-soft); font:500 11.5px/1 var(--cm-font-sans); }
    .pp-as-ratio .rv { font-family:var(--cm-font-mono); color:var(--cm-fg-strong); font-weight:600; }
    .pp-as-hist { font:500 10px/1 var(--cm-font-mono); color:var(--cm-fg-faint); padding:1px 5px; border:1px solid var(--cm-border-soft); border-radius:5px; }
    `;
    const el = document.createElement('style'); el.id = 'pp-as-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function repValue(rec, def){
    if (def.bilateral){
      const vs = ['L','R'].map(s => rec.sides[s]).filter(v => v != null);
      if (!vs.length) return null;
      return vs.reduce((a,b)=>a+b,0)/vs.length;
    }
    return rec.sides.NA != null ? rec.sides.NA : (rec.sides.L != null ? rec.sides.L : rec.sides.R);
  }

  async function renderAssessmentBlocks({ playerId, clubId, teamId, mount, flags = [] }){
    if (!mount) return false;
    let defs = [];
    try {
      const { data } = await sb().from('assessment_test_defs').select('*')
        .or(`club_id.is.null,club_id.eq.${clubId}`).eq('active', true);
      defs = data || [];
    } catch (_) { return false; }   // table missing → nothing to show
    if (!defs.length) return false;
    const defByType = {}; defs.forEach(d => { defByType[d.test_type] = d; });

    // one query per table (no N+1)
    let tests = [], metricsByTest = {};
    try {
      const { data: ft } = await sb().from('force_tests')
        .select('id, test_type, test_date, bodyweight_kg')
        .eq('club_id', clubId).eq('player_id', playerId)
        .in('test_type', Object.keys(defByType))
        .order('test_date', { ascending: true });
      tests = ft || [];
      if (tests.length){
        const { data: mt } = await sb().from('force_test_metrics')
          .select('test_id, metric_key, value, side, unit')
          .in('test_id', tests.map(t => t.id));
        (mt || []).forEach(m => { (metricsByTest[m.test_id] = metricsByTest[m.test_id] || []).push(m); });
      }
    } catch (_) { tests = []; metricsByTest = {}; }

    // legacy evaluations fallback (Ankle dorsiflexion, Hip ER/IR) — historic only
    let legacy = {};
    try {
      const { data: ev } = await sb().from('evaluations')
        .select('evaluation_type, test_date, value, unit')
        .eq('club_id', clubId).eq('player_id', playerId)
        .in('evaluation_type', ['Ankle dorsiflexion', 'Hip ER/IR'])
        .order('test_date', { ascending: true });
      (ev || []).forEach(r => {
        const key = r.evaluation_type === 'Ankle dorsiflexion' ? 'mob_ankle_df' : 'mob_hip_ir';
        (legacy[key] = legacy[key] || []).push({ date: r.test_date, value: Number(r.value), unit: r.unit });
      });
    } catch (_) { legacy = {}; }

    // build per-def series: key -> { def, records:[{date, bw, sides:{L,R,NA}}] , historic:bool }
    const seriesByKey = {};
    tests.forEach(t => {
      const def = defByType[t.test_type]; if (!def) return;
      const rec = { date: t.test_date, bw: t.bodyweight_kg, sides: {} };
      (metricsByTest[t.id] || []).forEach(m => { if (m.metric_key === def.metric_key) rec.sides[m.side || 'NA'] = Number(m.value); });
      if (!Object.keys(rec.sides).length) return;
      (seriesByKey[def.key] = seriesByKey[def.key] || { def, records: [], historic: false }).records.push(rec);
    });
    // fill legacy for defs with no force data
    Object.keys(legacy).forEach(key => {
      if (seriesByKey[key]) return;
      const def = defs.find(d => d.key === key); if (!def) return;
      seriesByKey[key] = { def, historic: true, records: legacy[key].map(r => ({ date: r.date, bw: null, sides: { NA: r.value } })) };
    });

    if (!Object.keys(seriesByKey).length) return false;
    styleInjectAssess();

    const FAMILY = [
      { fam: 'isometric', label: T('player.iso_strength_block', 'Isometric strength') },
      { fam: 'mobility',  label: T('player.mobility_block', 'Mobility') },
    ];
    let rendered = false;
    FAMILY.forEach(({ fam, label }) => {
      const keys = Object.keys(seriesByKey).filter(k => seriesByKey[k].def.family === fam)
        .sort((a,b) => (seriesByKey[a].def.sort_order||0) - (seriesByKey[b].def.sort_order||0));
      if (!keys.length) return;
      rendered = true;

      // per-test rows (latest record)
      const rowsHtml = keys.map(k => {
        const s = seriesByKey[k], def = s.def;
        const recs = s.records;
        const rec = recs[recs.length - 1];
        const prev = recs[recs.length - 2];
        const unit = def.unit || '';
        const L = rec.sides.L, R = rec.sides.R, NA = rec.sides.NA;
        const maxV = Math.max(...[L, R, NA].filter(v => v != null), 0) || 1;
        const AN = window.assessNorms;

        let bars = '';
        if (def.bilateral){
          bars += bar('L', L, unit, maxV, 'var(--cm-accent)');
          bars += bar('R', R, unit, maxV, 'var(--cm-accent)');
        } else {
          bars += bar('', NA, unit, maxV, 'var(--cm-accent)');
        }

        // status: worst of per-side absolute + asymmetry
        let statuses = [];
        if (AN){
          [['L',L],['R',R],['NA',NA]].forEach(([sd,v]) => { if (v != null) statuses.push(AN.statusFor(def, { value: v })); });
        }
        let asym = null;
        if (AN && def.bilateral && L != null && R != null){ asym = AN.asymStatus(def, L, R); statuses.push(asym); }
        const st = worst(statuses);

        // collect prevention flags (watch/alert) for the top summary
        if (st.status === 'watch' || st.status === 'alert'){
          flags.push({
            label: T(def.i18n_key, def.label),
            family: fam,
            status: st.status,
            detail: (AN ? (st.detail || st.reason || AN.explain(st) || '') : (st.detail || st.reason || '')),
            sub: (asym && asym.pct != null && (asym.status === 'watch' || asym.status === 'alert'))
              ? `${T('evaluations.asym_pct','Asym')} ${fmtNum(asym.pct)}%` : ''
          });
        }

        // delta vs previous (representative value)
        let dl = '', dir = 'flat';
        if (prev){
          const a = repValue(rec, def), b = repValue(prev, def);
          if (a != null && b != null){
            const d = a - b;
            dir = window.evalDir ? window.evalDir.deltaDir(d, def.test_type, unit) : 'flat';
            dl = (d > 0 ? '+' : d < 0 ? '−' : '') + fmtNum(Math.abs(d));
          }
        }

        // N/kg secondary
        let nkg = '';
        if (AN && rec.bw){
          const rv = repValue(rec, def);
          const norm = AN.normalize(rv, rec.bw);
          if (norm != null) nkg = `<div class="pp-as-sec">${fmtNum(norm)} ${esc(unit)}/kg</div>`;
        }

        const asymTxt = asym && asym.pct != null
          ? `<span class="pp-as-chip" title="${esc(AN ? AN.explain(asym) : '')}" style="color:${statusColor(asym.status)}">${T('evaluations.asym_pct','Asym')} ${fmtNum(asym.pct)}%</span>` : '';

        return `<div class="pp-as-row">
          <div class="pp-as-row-h">
            <span class="nm">${esc(T(def.i18n_key, def.label))}</span>
            ${s.historic ? `<span class="pp-as-hist">${esc(T('player.historic','historic'))}</span>` : ''}
            <span class="meta">${asymTxt}${statusChip(st)}${dl ? `<span class="pp-as-dl${dir==='flat'?'':' dl-'+dir}">${esc(dl)}</span>` : ''}</span>
          </div>
          ${bars}
          ${nkg}
        </div>`;
      }).join('');

      // derived ratios (latest record per def in this family)
      let ratiosHtml = '';
      if (window.assessNorms){
        const byKey = {};
        keys.forEach(k => { const r = seriesByKey[k].records; const rec = r[r.length-1]; byKey[k] = { L: rec.sides.L, R: rec.sides.R }; });
        const rs = window.assessNorms.ratios(byKey);
        rs.forEach(r => {
          if (r.status === 'watch' || r.status === 'alert'){
            flags.push({
              label: String(r.key) + (r.angle ? ' ' + r.angle : '') + (r.side && r.side !== 'NA' ? ' ' + r.side : ''),
              family: fam,
              status: r.status,
              detail: r.reference || '',
              sub: 'ratio ' + fmtNum(Math.round(r.value * 100) / 100)
            });
          }
        });
        if (rs.length){
          ratiosHtml = `<div class="pp-as-ratios"><span class="pp-as-sec">${esc(T('player.derived_ratios','Derived ratios'))}</span>`
            + rs.map(r => `<span class="pp-as-ratio" title="${esc(r.reference||'')}"><span class="d" style="width:7px;height:7px;border-radius:50%;background:${statusColor(r.status)}"></span>${esc(r.key)}${r.angle?' '+esc(r.angle):''}${r.side&&r.side!=='NA'?' '+esc(r.side):''} <span class="rv">${fmtNum(Math.round(r.value*100)/100)}</span></span>`).join('')
            + `</div>`;
        }
      }

      // one evolution chart (representative value) for the test with most records
      let chartKey = keys[0];
      keys.forEach(k => { if (seriesByKey[k].records.length > seriesByKey[chartKey].records.length) chartKey = k; });
      const chartRows = seriesByKey[chartKey].records.map(rec => ({ test_date: rec.date, value: repValue(rec, seriesByKey[chartKey].def), unit: seriesByKey[chartKey].def.unit }));

      const cardId = 'pp-as-' + fam;
      mount.insertAdjacentHTML('beforeend', `
        <div class="pp-ts-card" id="${cardId}">
          <div class="pp-ts-card-head"><h3>${esc(label)}</h3><span class="sub">${keys.length} ${keys.length===1?'test':'tests'}</span></div>
          <div class="pp-as-rows">${rowsHtml}</div>
          ${ratiosHtml}
          <div class="pp-ts-card-head" style="margin-top:16px;margin-bottom:8px"><h3 style="font-size:12.5px">${esc(T(seriesByKey[chartKey].def.i18n_key, seriesByKey[chartKey].def.label))}</h3><span class="sub" data-as-pills-for="${fam}"></span></div>
          <div data-as-chart="${fam}"></div>
        </div>`);

      // pills to switch charted test + initial chart
      const card = document.getElementById(cardId);
      const chartEl = card.querySelector(`[data-as-chart="${fam}"]`);
      const pillsHost = card.querySelector(`[data-as-pills-for="${fam}"]`);
      const drawChart = (k) => { const S = seriesByKey[k]; chartEl.innerHTML = renderChart(S.records.map(rec => ({ test_date: rec.date, value: repValue(rec, S.def), unit: S.def.unit })), null); };
      pillsHost.innerHTML = keys.map(k => `<button class="pp-tpill" style="height:24px;padding:0 9px;font-size:11px" data-k="${esc(k)}">${esc(T(seriesByKey[k].def.i18n_key, seriesByKey[k].def.label))}</button>`).join(' ');
      pillsHost.querySelectorAll('.pp-tpill').forEach(b => b.addEventListener('click', () => {
        pillsHost.querySelectorAll('.pp-tpill').forEach(x => x.classList.remove('is-on'));
        b.classList.add('is-on'); drawChart(b.dataset.k);
      }));
      const firstPill = pillsHost.querySelector(`.pp-tpill[data-k="${chartKey}"]`); if (firstPill) firstPill.classList.add('is-on');
      chartEl.innerHTML = renderChart(chartRows, null);
    });

    return rendered;
  }

  function bar(label, val, unit, maxV, color){
    const w = (maxV > 0 && val != null) ? Math.max(4, Math.round(val / maxV * 100)) : 0;
    return `<div class="pp-as-bar-row"><span class="pp-as-bar-lbl">${esc(label)}</span>
      <span class="pp-as-bar-track"><span class="pp-as-bar-fill" style="width:${w}%;background:${color}"></span></span>
      <span class="pp-as-bar-val">${val==null?'—':esc(fmtNum(val))}<span class="un">${esc(unit||'')}</span></span></div>`;
  }

  window.playerTests = { render };
})();
