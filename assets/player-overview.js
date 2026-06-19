/* ────────────────────────────────────────────────────────────────────────
   player-overview.js — Overview tab of the read-only Player profile.
   Exposes: window.playerOverview.render({ playerId, clubId, seasonStart,
                                           seasonEnd, mount }) -> Promise<void>

   Builds three cards into `mount`:
     A) Technical profile (6-axis radar from subjective /10 evaluations)
     B) Current physical assessment (latest objective tests + delta)
     C) Injury summary (status, spells, days out, last injury, area)

   Self-contained. Reuses window.sb. Multi-tenant: every query .eq('club_id').
   Resilient: each card renders its own loading "…" then empty/error state;
   never throws.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const sb = () => window.sb;

  // CANONICAL contract — the 6 attributes the future technical evaluation form
  // MUST write to `evaluations` (as evaluation_type, unit='/10'). Order = radar axes.
  const TECH_ATTRS = ['Technique', 'Passing', 'Vision', '1v1', 'Defending', 'Duels'];
  const TACTICAL_ATTRS = ['Positioning', 'Game reading', 'Pressing', 'Marking', 'Off-ball movement'];
  const MENTAL_ATTRS   = ['Concentration', 'Composure', 'Decision-making', 'Leadership'];

  // ── tiny utils ──────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function dayDate(s) {
    if (!s) return null;
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? null : d;
  }
  function todayDate() {
    const t = new Date();
    return new Date(t.getFullYear() + '-' +
      String(t.getMonth() + 1).padStart(2, '0') + '-' +
      String(t.getDate()).padStart(2, '0') + 'T00:00:00');
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function fmtNum(v) {
    const n = Number(v);
    if (!isFinite(n)) return esc(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }
  function styleInject() {
    if (document.getElementById('pp-ov-styles')) return;
    const css = `
    .pp-ov-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
    .pp-ov-col { display:flex; flex-direction:column; gap:16px; }
    @media (max-width:900px){ .pp-ov-grid { grid-template-columns:1fr; } }
    .pp-card {
      background:var(--cm-surface); border:1px solid var(--cm-border);
      border-radius:var(--cm-r-4); box-shadow:var(--cm-shadow-1); padding:16px 18px;
    }
    .pp-card-head { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
    .pp-card-head h3 { font:600 14px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-card-head .ti { font-size:16px; color:var(--cm-fg-muted); }
    .pp-card-head .pp-badge { margin-left:auto; }
    .pp-ov-loading { display:flex; align-items:center; gap:8px; color:var(--cm-fg-faint); font:var(--cm-body-sm); padding:6px 0; }
    .pp-ov-mini-empty { display:flex; flex-direction:column; gap:4px; padding:14px 4px; text-align:center; }
    .pp-ov-mini-empty .t { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-ov-mini-empty .h { font:var(--cm-body-sm); color:var(--cm-fg-faint); }

    .pp-badge { display:inline-flex; align-items:center; gap:5px; height:22px; padding:0 9px; border-radius:999px; font:600 11.5px/1 var(--cm-font-sans); }
    .pp-badge .dot { width:7px; height:7px; border-radius:50%; }

    /* Radar */
    .pp-radar-wrap { display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
    .pp-radar-wrap svg { flex:0 0 auto; }
    .pp-radar-list { flex:1; min-width:150px; display:flex; flex-direction:column; gap:7px; }
    .pp-radar-li { display:flex; align-items:center; gap:8px; }
    .pp-radar-li .nm { font:var(--cm-body-sm); color:var(--cm-fg); flex:1; }
    .pp-radar-li .sc { font:600 13px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }
    .pp-radar-li .sc.na { color:var(--cm-fg-faint); font-weight:500; }

    /* Physical rows */
    .pp-prow { display:flex; align-items:baseline; gap:10px; padding:9px 0; border-bottom:1px solid var(--cm-border-soft); }
    .pp-prow:last-child { border-bottom:0; }
    .pp-prow .nm { font:var(--cm-body-sm); color:var(--cm-fg); flex:1; min-width:0; }
    .pp-prow .vl { font:600 14px/1 var(--cm-font-mono); color:var(--cm-fg-strong); white-space:nowrap; }
    .pp-prow .un { font:500 11px/1 var(--cm-font-mono); color:var(--cm-fg-muted); margin-left:2px; }
    .pp-prow .dl { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); min-width:48px; text-align:right; }
    .pp-prow .dl.dl-pos{color:var(--cm-success)} .pp-prow .dl.dl-neg{color:var(--cm-danger)}

    /* Injury stats */
    .pp-istats { display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; }
    .pp-istat .l { font:500 10.5px/1 var(--cm-font-sans); letter-spacing:0.05em; text-transform:uppercase; color:var(--cm-fg-faint); }
    .pp-istat .v { font:600 16px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); margin-top:3px; }
    .pp-istat .v small { font:500 11px/1 var(--cm-font-mono); color:var(--cm-fg-muted); }

    /* Score bars (tactical & mental) */
    .pp-sbar-group { margin-bottom:14px; } .pp-sbar-group:last-child { margin-bottom:0; }
    .pp-sbar-h { display:flex; align-items:center; font:600 11px/1 var(--cm-font-sans); letter-spacing:.06em; text-transform:uppercase; color:var(--cm-fg-muted); margin-bottom:9px; }
    .pp-sbar-h .avg { margin-left:auto; font:600 11px/1 var(--cm-font-mono); color:var(--cm-fg-faint); text-transform:none; letter-spacing:0; }
    .pp-sbar-row { display:flex; align-items:center; gap:10px; padding:5px 0; }
    .pp-sbar-row .nm { font:var(--cm-body-sm); color:var(--cm-fg); flex:0 0 132px; }
    .pp-sbar-row .track { flex:1; height:7px; border-radius:999px; background:var(--cm-bg-sunk); overflow:hidden; }
    .pp-sbar-row .fill { display:block; height:100%; border-radius:999px; background:var(--cm-accent); }
    .pp-sbar-row .sc { flex:0 0 28px; text-align:right; font:600 13px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }
    .pp-sbar-row .sc.na { color:var(--cm-fg-faint); font-weight:500; }
    `;
    const el = document.createElement('style');
    el.id = 'pp-ov-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function loadingHTML() {
    return `<div class="pp-ov-loading"><i class="ti ti-loader-2"></i> …</div>`;
  }
  function miniEmpty(title, hint) {
    return `<div class="pp-ov-mini-empty">
      <span class="t">${esc(title)}</span>
      ${hint ? `<span class="h">${esc(hint)}</span>` : ''}
    </div>`;
  }

  // ── Radar geometry ────────────────────────────────────────────────────────
  // Given N values, return polygon "x,y x,y …" points around (cx,cy) with the
  // given outer radius R, mapping value/maxVal → radius. Axis 0 points up.
  function polygonPoints(values, cx, cy, R, maxVal) {
    const n = values.length;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const v = values[i] == null ? 0 : Math.max(0, Math.min(maxVal, values[i]));
      const r = (v / maxVal) * R;
      pts.push((cx + r * Math.cos(ang)).toFixed(1) + ',' + (cy + r * Math.sin(ang)).toFixed(1));
    }
    return pts.join(' ');
  }
  function axisVertex(i, n, cx, cy, R) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + R * Math.cos(ang), cy + R * Math.sin(ang)];
  }

  function renderRadar(scores) {
    // scores: array aligned to TECH_ATTRS, each number|null
    const n = TECH_ATTRS.length;
    const size = 180, cx = size / 2, cy = size / 2, R = 72, maxVal = 10;

    // rings
    let rings = '';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const ringPts = [];
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        ringPts.push((cx + R * f * Math.cos(ang)).toFixed(1) + ',' + (cy + R * f * Math.sin(ang)).toFixed(1));
      }
      rings += `<polygon points="${ringPts.join(' ')}" fill="none" stroke="var(--cm-border)" stroke-width="1"/>`;
    });
    // axes
    let axes = '';
    for (let i = 0; i < n; i++) {
      const [x, y] = axisVertex(i, n, cx, cy, R);
      axes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--cm-border)" stroke-width="1"/>`;
    }
    // data polygon (only if at least one score present)
    const present = scores.some(s => s != null);
    let poly = '';
    if (present) {
      const pts = polygonPoints(scores.map(s => s == null ? 0 : s), cx, cy, R, maxVal);
      poly = `<polygon points="${pts}" fill="var(--cm-accent)" fill-opacity="0.18"
                stroke="var(--cm-accent)" stroke-width="1.5"/>`;
      // vertex dots for present values
      for (let i = 0; i < n; i++) {
        if (scores[i] == null) continue;
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = (scores[i] / maxVal) * R;
        poly += `<circle cx="${(cx + r * Math.cos(ang)).toFixed(1)}" cy="${(cy + r * Math.sin(ang)).toFixed(1)}" r="2.5" fill="var(--cm-accent)"/>`;
      }
    }

    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Technical radar">
      ${rings}${axes}${poly}
    </svg>`;

    const list = TECH_ATTRS.map((a, i) => {
      const s = scores[i];
      return `<div class="pp-radar-li">
        <span class="nm">${esc(a)}</span>
        <span class="sc ${s == null ? 'na' : ''}">${s == null ? '—' : fmtNum(s) + '/10'}</span>
      </div>`;
    }).join('');

    return `<div class="pp-radar-wrap">${svg}<div class="pp-radar-list">${list}</div></div>`;
  }

  // ── Card A: Technical profile ─────────────────────────────────────────────
  async function fillTechnical(el, playerId, clubId) {
    try {
      const { data } = await sb()
        .from('evaluations')
        .select('evaluation_type, test_date, value, unit')
        .eq('club_id', clubId)
        .eq('player_id', playerId)
        .eq('unit', '/10')
        .in('evaluation_type', TECH_ATTRS)
        .order('test_date', { ascending: false });
      const rows = data || [];
      if (!rows.length) {
        el.innerHTML = miniEmpty('No technical evaluation yet', 'Add one from Evaluations');
        return;
      }
      // latest row per attribute (first occurrence after desc sort)
      const latest = {};
      for (const r of rows) {
        if (!(r.evaluation_type in latest)) latest[r.evaluation_type] = r.value;
      }
      const scores = TECH_ATTRS.map(a => (a in latest && latest[a] != null) ? Number(latest[a]) : null);
      el.innerHTML = renderRadar(scores);
    } catch (_) {
      el.innerHTML = miniEmpty('No technical evaluation yet', 'Add one from Evaluations');
    }
  }

  // ── Card A2: Tactical & mental score bars ─────────────────────────────────
  function sbarGroup(title, attrs, latest){
    const rows = attrs.map(a=>{
      const v = (a in latest && latest[a]!=null) ? Number(latest[a]) : null;
      const pct = v==null ? 0 : Math.max(0, Math.min(100, v*10));
      return `<div class="pp-sbar-row"><span class="nm">${esc(a)}</span>`
           + `<span class="track"><span class="fill" style="width:${pct}%"></span></span>`
           + `<span class="sc${v==null?' na':''}">${v==null?'—':fmtNum(v)}</span></div>`;
    }).join('');
    const present = attrs.filter(a=> a in latest && latest[a]!=null).map(a=>Number(latest[a]));
    const avg = present.length ? (present.reduce((s,n)=>s+n,0)/present.length) : null;
    return `<div class="pp-sbar-group"><div class="pp-sbar-h">${esc(title)}`
         + `${avg==null?'':`<span class="avg">avg ${fmtNum(avg)}</span>`}</div>${rows}</div>`;
  }
  async function fillTacticalMental(el, playerId, clubId){
    try {
      const all = TACTICAL_ATTRS.concat(MENTAL_ATTRS);
      const { data } = await sb().from('evaluations')
        .select('evaluation_type, test_date, value, unit')
        .eq('club_id', clubId).eq('player_id', playerId).eq('unit','/10')
        .in('evaluation_type', all).order('test_date',{ascending:false});
      const rows = data || [];
      if (!rows.length){ el.innerHTML = miniEmpty('No tactical/mental evaluation yet','Add one from Evaluations'); return; }
      const latest = {};
      for (const r of rows){ if(!(r.evaluation_type in latest)) latest[r.evaluation_type]=r.value; }
      el.innerHTML = sbarGroup('Tactical', TACTICAL_ATTRS, latest) + sbarGroup('Mental', MENTAL_ATTRS, latest);
    } catch(_) { el.innerHTML = miniEmpty('No tactical/mental evaluation yet','Add one from Evaluations'); }
  }

  // ── Card B: Current physical assessment ───────────────────────────────────
  async function fillPhysical(el, playerId, clubId) {
    try {
      const { data } = await sb()
        .from('evaluations')
        .select('evaluation_type, test_date, value, unit')
        .eq('club_id', clubId)
        .eq('player_id', playerId)
        .neq('unit', '/10')
        .order('test_date', { ascending: false });
      const rows = data || [];
      if (!rows.length) {
        el.innerHTML = miniEmpty('No physical tests recorded', '');
        return;
      }
      // group by type (rows already desc by test_date)
      const groups = {};
      for (const r of rows) {
        (groups[r.evaluation_type] = groups[r.evaluation_type] || []).push(r);
      }
      // each group: latest = [0], previous = [1]; order groups by latest test_date desc
      const list = Object.keys(groups).map(type => {
        const g = groups[type];
        const latest = g[0];
        const prev = g[1];
        // delta vs PREVIOUS measurement (signed); colored by direction-of-better
        // (lower-is-better tests handled via window.evalDir).
        let delta = null;
        if (prev && latest.value != null && prev.value != null) {
          delta = Number(latest.value) - Number(prev.value);
        }
        return { type, value: latest.value, unit: latest.unit, date: latest.test_date, delta };
      }).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);

      el.innerHTML = list.map(it => {
        let dl = '—';
        if (it.delta != null) {
          const sign = it.delta > 0 ? '+' : (it.delta < 0 ? '−' : '');
          dl = sign + fmtNum(Math.abs(it.delta));
        }
        const dir = window.evalDir ? window.evalDir.deltaDir(it.delta, it.type, it.unit) : 'flat';
        return `<div class="pp-prow">
          <span class="nm">${esc(it.type)}</span>
          <span class="vl">${it.value == null ? '—' : fmtNum(it.value)}<span class="un">${esc(it.unit || '')}</span></span>
          <span class="dl${dir==='flat'?'':' dl-'+dir}">${esc(dl)}</span>
        </div>`;
      }).join('');
    } catch (_) {
      el.innerHTML = miniEmpty('No physical tests recorded', '');
    }
  }

  // ── Card C: Injury summary ────────────────────────────────────────────────
  function injuryBadge(active, type) {
    if (active) {
      return `<span class="pp-badge" style="background:color-mix(in srgb,var(--cm-danger) 14%,transparent);color:var(--cm-danger)">
        <span class="dot" style="background:var(--cm-danger)"></span>Injured${type ? ' · ' + esc(type) : ''}</span>`;
    }
    return `<span class="pp-badge" style="background:color-mix(in srgb,var(--cm-success) 14%,transparent);color:var(--cm-success)">
      <span class="dot" style="background:var(--cm-success)"></span>Fit</span>`;
  }

  async function fillInjuries(headBadgeEl, bodyEl, playerId, clubId, seasonStart, seasonEnd) {
    try {
      const { data } = await sb()
        .from('injuries')
        .select('injury_type, body_area, severity, status, start_date, expected_return, notes')
        .eq('club_id', clubId)
        .eq('player_id', playerId)
        .order('start_date', { ascending: false });
      const rows = data || [];

      if (!rows.length) {
        headBadgeEl.innerHTML = injuryBadge(false, null);
        bodyEl.innerHTML = miniEmpty('No injuries recorded', '');
        return;
      }

      const active = rows.find(r => (r.status || '').toLowerCase() === 'active');
      headBadgeEl.innerHTML = injuryBadge(!!active, active ? active.injury_type : null);

      const winStart = dayDate(seasonStart);
      const winEnd = dayDate(seasonEnd);
      const today = todayDate();

      // Spells this season (start_date in window)
      let spells = 0;
      let daysOut = 0;
      for (const r of rows) {
        const s = dayDate(r.start_date);
        if (!s) continue;
        if (winStart && winEnd && s >= winStart && s <= winEnd) spells++;
        // Total days out (clamped to window). ASSUMPTION: spell end =
        // COALESCE(expected_return, today) — no explicit cleared-date column used.
        if (winStart && winEnd) {
          const end = dayDate(r.expected_return) || today;
          const cStart = s < winStart ? winStart : s;
          const cEnd = end > winEnd ? winEnd : end;
          if (cEnd >= cStart) daysOut += daysBetween(cStart, cEnd) + 1;
        }
      }

      // Days since last injury (latest start_date)
      const lastStart = dayDate(rows[0].start_date);
      const daysSince = lastStart ? Math.max(0, daysBetween(lastStart, today)) : null;

      // Most affected area
      const areaCount = {};
      for (const r of rows) {
        const a = (r.body_area || '').trim();
        if (a) areaCount[a] = (areaCount[a] || 0) + 1;
      }
      let topArea = null, topN = 0;
      for (const a in areaCount) if (areaCount[a] > topN) { topN = areaCount[a]; topArea = a; }

      bodyEl.innerHTML = `<div class="pp-istats">
        <div class="pp-istat"><div class="l">Spells this season</div><div class="v">${spells}</div></div>
        <div class="pp-istat"><div class="l">Days out (season)</div><div class="v">${daysOut}</div></div>
        <div class="pp-istat"><div class="l">Days since last injury</div><div class="v">${daysSince == null ? '—' : daysSince}</div></div>
        <div class="pp-istat"><div class="l">Most affected area</div><div class="v">${topArea ? esc(topArea) : '—'}</div></div>
      </div>`;
    } catch (_) {
      headBadgeEl.innerHTML = injuryBadge(false, null);
      bodyEl.innerHTML = miniEmpty('No injuries recorded', '');
    }
  }

  // ── Public entry ──────────────────────────────────────────────────────────
  async function render({ playerId, clubId, seasonStart, seasonEnd, mount }) {
    if (!mount) return;
    styleInject();

    mount.innerHTML = `
      <div class="pp-ov-grid">
        <div class="pp-ov-col">
          <div class="pp-card" data-ov="technical">
            <div class="pp-card-head"><i class="ti ti-chart-radar"></i><h3>Technical profile</h3></div>
            <div data-ov-body="technical">${loadingHTML()}</div>
          </div>
          <div class="pp-card" data-ov="tacmental">
            <div class="pp-card-head"><i class="ti ti-chart-bar"></i><h3>Tactical &amp; mental</h3></div>
            <div data-ov-body="tacmental">${loadingHTML()}</div>
          </div>
        </div>
        <div class="pp-ov-col">
          <div class="pp-card" data-ov="physical">
            <div class="pp-card-head"><i class="ti ti-activity"></i><h3>Current physical assessment</h3></div>
            <div data-ov-body="physical">${loadingHTML()}</div>
          </div>
          <div class="pp-card" data-ov="injuries">
            <div class="pp-card-head"><i class="ti ti-bandage"></i><h3>Injury summary</h3><span data-ov-badge="injuries"></span></div>
            <div data-ov-body="injuries">${loadingHTML()}</div>
          </div>
        </div>
      </div>`;

    const techEl = mount.querySelector('[data-ov-body="technical"]');
    const tacEl = mount.querySelector('[data-ov-body="tacmental"]');
    const physEl = mount.querySelector('[data-ov-body="physical"]');
    const injBadge = mount.querySelector('[data-ov-badge="injuries"]');
    const injBody = mount.querySelector('[data-ov-body="injuries"]');

    await Promise.all([
      fillTechnical(techEl, playerId, clubId),
      fillTacticalMental(tacEl, playerId, clubId),
      fillPhysical(physEl, playerId, clubId),
      fillInjuries(injBadge, injBody, playerId, clubId, seasonStart, seasonEnd),
    ]);
  }

  window.playerOverview = { render };
})();
