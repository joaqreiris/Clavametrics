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
  function renderChart(rows) {
    // rows: chronological [{test_date, value, unit}], value coerced to number
    const W = 640, H = 240;
    const padL = 46, padR = 18, padT = 16, padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const vals = rows.map(r => Number(r.value)).filter(v => isFinite(v));
    if (!vals.length) {
      return `<div class="pp-ts-note">No numeric values to plot.</div>`;
    }

    let yMin = Math.min(...vals), yMax = Math.max(...vals);
    if (yMin === yMax) { const pad = Math.abs(yMin) * 0.1 || 1; yMin -= pad; yMax += pad; }
    else { const pad = (yMax - yMin) * 0.08; yMin -= pad; yMax += pad; }

    const n = rows.length;
    const xAt = i => n === 1 ? (padL + plotW / 2) : (padL + (i / (n - 1)) * plotW);
    const yAt = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // TODO (deferred): squad-average band + per-test "PB" marker — both need
    // team aggregation and per-test direction-of-better; not drawn in this step.

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
        ${grid}${line}${dots}${xlabels}
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
      let dl = '—';
      if (prev && r.value != null && prev.value != null) {
        const d = Number(r.value) - Number(prev.value);
        // TODO (deferred): direction-of-better coloring (lower-is-better tests).
        const sign = d > 0 ? '+' : (d < 0 ? '−' : '');
        dl = sign + fmtNum(Math.abs(d));
      }
      return `<tr>
        <td class="col-date">${esc(shortDate(r.test_date))}</td>
        <td class="col-val"><span class="vl">${r.value == null ? '—' : esc(fmtNum(r.value))}<span class="un">${esc(r.unit || '')}</span></span></td>
        <td class="col-delta"><span class="dl">${esc(dl)}</span></td>
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
  async function render({ playerId, clubId, mount }) {
    if (!mount) return;
    styleInject();
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
      mount.innerHTML = `<div class="pp-ts-empty"><span class="t">No physical tests recorded yet</span></div>`;
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

    function paint() {
      const g = groups[selected] || [];
      // active pill
      pillsEl.querySelectorAll('.pp-tpill').forEach(p =>
        p.classList.toggle('is-on', p.dataset.type === selected));
      const unit = (g.find(r => r.unit) || {}).unit || '';
      subEl.textContent = `${selected}${unit ? ' · ' + unit : ''} · ${g.length} record${g.length === 1 ? '' : 's'}`;
      chartEl.innerHTML = renderChart(g);
      tableEl.innerHTML = renderTable(g);
    }

    pillsEl.innerHTML = types.map(t =>
      `<button class="pp-tpill" data-type="${esc(t)}">${esc(t)}<span class="ct">${groups[t].length}</span></button>`).join('');
    pillsEl.querySelectorAll('.pp-tpill').forEach(btn => {
      btn.addEventListener('click', () => { selected = btn.dataset.type; paint(); });
    });

    paint();
  }

  window.playerTests = { render };
})();
