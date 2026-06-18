/* ────────────────────────────────────────────────────────────────────────
   player-availability.js — "Availability & injuries" tab of the Player profile.
   Exposes: window.playerAvailability.render({ playerId, clubId, seasonStart,
                                               seasonEnd, mount }) -> Promise<void>

   Builds:
     A) Season availability strip (weekday × week calendar heat)
     B) Injury history timeline
     C) Days-out breakdown (this season)

   Self-contained. Reuses window.sb. Multi-tenant: every query .eq('club_id').
   Resilient: "…" loading then graceful empty states; never throws.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const sb = () => window.sb;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // availability.status → color token
  const STATUS_COLOR = {
    available: 'var(--cm-success)',
    modified: 'var(--cm-warning)',
    injured: 'var(--cm-danger)',
    illness: 'var(--cm-violet)',
    sick: 'var(--cm-violet)',
    away: 'var(--cm-info)',
    unavailable: 'var(--cm-neutral)',
  };
  const NO_RECORD = 'var(--cm-bg-sunk)';

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
  function longDate(s) {
    const d = parseDay(s);
    if (!d) return '—';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
  function daysInclusive(a, b) { return Math.round((b - a) / 86400000) + 1; }

  function styleInject() {
    if (document.getElementById('pp-av-styles')) return;
    const css = `
    .pp-av { display:flex; flex-direction:column; gap:16px; }
    .pp-av-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
    @media (max-width:900px){ .pp-av-row { grid-template-columns:1fr; } }
    .pp-av-card {
      background:var(--cm-surface); border:1px solid var(--cm-border);
      border-radius:var(--cm-r-4); box-shadow:var(--cm-shadow-1); padding:16px 18px;
    }
    .pp-av-head { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
    .pp-av-head .ti { font-size:16px; color:var(--cm-fg-muted); }
    .pp-av-head h3 { font:600 14px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-av-head .right { margin-left:auto; }
    .pp-av-loading { display:flex; align-items:center; gap:8px; color:var(--cm-fg-faint); font:var(--cm-body-sm); padding:8px 0; }
    .pp-av-empty { display:flex; flex-direction:column; gap:4px; padding:24px 8px; text-align:center; }
    .pp-av-empty .t { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-av-empty .h { font:var(--cm-body-sm); color:var(--cm-fg-faint); }

    .pp-badge { display:inline-flex; align-items:center; gap:5px; height:22px; padding:0 9px; border-radius:999px; font:600 11.5px/1 var(--cm-font-sans); }
    .pp-badge .dot { width:7px; height:7px; border-radius:50%; }

    /* Heat strip */
    .pp-heat-scroll { overflow-x:auto; padding-bottom:4px; }
    .pp-heat { display:flex; gap:3px; align-items:flex-start; }
    .pp-heat-wdays { display:flex; flex-direction:column; gap:3px; margin-right:6px; }
    .pp-heat-wdays span { height:13px; line-height:13px; font:500 9px/13px var(--cm-font-mono); color:var(--cm-fg-faint); }
    .pp-heat-weeks { display:flex; gap:3px; }
    .pp-heat-col { display:flex; flex-direction:column; gap:3px; }
    .pp-heat-cell { width:13px; height:13px; border-radius:3px; }
    .pp-heat-mlabels { display:flex; gap:3px; margin:0 0 5px 31px; }
    .pp-heat-mlabels span { font:500 9.5px/1 var(--cm-font-sans); color:var(--cm-fg-faint); }
    .pp-legend { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; }
    .pp-legend .it { display:flex; align-items:center; gap:5px; font:500 11.5px/1 var(--cm-font-sans); color:var(--cm-fg-muted); }
    .pp-legend .sw { width:11px; height:11px; border-radius:3px; }

    /* Injury timeline */
    .pp-inj { display:flex; flex-direction:column; gap:10px; }
    .pp-inj-item { position:relative; padding:10px 12px 10px 16px; background:var(--cm-bg-soft); border:1px solid var(--cm-border-soft); border-radius:var(--cm-r-3); overflow:hidden; }
    .pp-inj-item .bar { position:absolute; left:0; top:0; bottom:0; width:4px; }
    .pp-inj-top { display:flex; align-items:center; gap:8px; }
    .pp-inj-top .ttl { font:600 13px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .pp-inj-top .pp-badge { margin-left:auto; }
    .pp-inj-meta { margin-top:4px; font:500 11.5px/1.4 var(--cm-font-mono); color:var(--cm-fg-muted); }
    .pp-inj-notes { margin-top:5px; font:var(--cm-body-sm); color:var(--cm-fg-muted); }

    /* Days-out breakdown */
    .pp-dob { display:flex; flex-direction:column; }
    .pp-dob-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--cm-border-soft); }
    .pp-dob-row:last-child { border-bottom:0; }
    .pp-dob-row .sw { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
    .pp-dob-row .nm { flex:1; font:var(--cm-body-sm); color:var(--cm-fg); }
    .pp-dob-row .ct { font:600 15px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }
    .pp-dob-row .ct small { font:500 10px/1 var(--cm-font-mono); color:var(--cm-fg-faint); margin-left:3px; }
    `;
    const el = document.createElement('style');
    el.id = 'pp-av-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function loadingHTML() { return `<div class="pp-av-loading"><i class="ti ti-loader-2"></i> …</div>`; }
  function miniEmpty(t, h) {
    return `<div class="pp-av-empty"><span class="t">${esc(t)}</span>${h ? `<span class="h">${esc(h)}</span>` : ''}</div>`;
  }

  // ── Card A: availability heat strip ───────────────────────────────────────
  function renderHeat(rows, seasonStart, seasonEnd) {
    if (!rows.length) { return miniEmpty('No availability recorded', 'Nothing logged in this window.'); }

    const byDate = {};
    rows.forEach(r => { if (r.date) byDate[String(r.date).slice(0, 10)] = (r.status || '').toLowerCase(); });

    // Window aligned to whole weeks (Mon start). Use season window if present,
    // else span the recorded dates.
    let start = parseDay(seasonStart), end = parseDay(seasonEnd);
    const dates = rows.map(r => parseDay(r.date)).filter(Boolean).sort((a, b) => a - b);
    if (!start && dates.length) start = dates[0];
    if (!end && dates.length) end = dates[dates.length - 1];
    if (!start || !end || end < start) return miniEmpty('No availability recorded', '');

    // back up to Monday
    const colStart = new Date(start);
    colStart.setDate(colStart.getDate() - ((colStart.getDay() + 6) % 7));

    const weeks = [];
    let cur = new Date(colStart), guard = 0;
    while (cur <= end && guard++ < 800) {
      const col = [];
      let monthLabel = '';
      for (let d = 0; d < 7; d++) {
        const ds = iso(cur);
        const inWindow = cur >= start && cur <= end;
        const st = inWindow ? byDate[ds] : undefined;
        if (d === 0) monthLabel = cur.getDate() <= 7 ? MONTHS[cur.getMonth()] : '';
        col.push({ ds, status: st, inWindow });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push({ col, monthLabel });
    }

    const wdayCol = `<div class="pp-heat-wdays">${WDAYS.map(w => `<span>${w[0]}</span>`).join('')}</div>`;
    const monthRow = `<div class="pp-heat-mlabels">${weeks.map(w => `<span style="width:13px">${esc(w.monthLabel)}</span>`).join('')}</div>`;
    const weekCols = weeks.map(w => `<div class="pp-heat-col">${w.col.map(cell => {
      const color = cell.status ? (STATUS_COLOR[cell.status] || NO_RECORD) : NO_RECORD;
      const title = cell.inWindow ? `${cell.ds}${cell.status ? ' · ' + cap(cell.status) : ' · no record'}` : '';
      return `<div class="pp-heat-cell" style="background:${color}" title="${esc(title)}"></div>`;
    }).join('')}</div>`).join('');

    const legendItems = [
      ['available', 'Available'], ['modified', 'Modified'], ['injured', 'Injured'],
      ['illness', 'Illness'], ['away', 'Away'], ['unavailable', 'Unavailable'],
    ].map(([k, lbl]) => `<span class="it"><span class="sw" style="background:${STATUS_COLOR[k]}"></span>${lbl}</span>`).join('')
      + `<span class="it"><span class="sw" style="background:${NO_RECORD};border:1px solid var(--cm-border)"></span>No record</span>`;

    return `${monthRow}
      <div class="pp-heat-scroll"><div class="pp-heat">${wdayCol}<div class="pp-heat-weeks">${weekCols}</div></div></div>
      <div class="pp-legend">${legendItems}</div>`;
  }

  // ── Card B: injury timeline ───────────────────────────────────────────────
  function injStatusMeta(status) {
    const s = (status || '').toLowerCase();
    if (s === 'active') return { label: 'Active', color: 'var(--cm-danger)' };
    if (s === 'cleared' || s === 'resolved') return { label: cap(s), color: 'var(--cm-success)' };
    return { label: status ? cap(status) : '—', color: 'var(--cm-neutral)' };
  }
  function renderInjuries(rows) {
    if (!rows.length) {
      return `<div class="pp-av-head" style="margin:0 0 8px"><span class="pp-badge" style="background:color-mix(in srgb,var(--cm-success) 14%,transparent);color:var(--cm-success)"><span class="dot" style="background:var(--cm-success)"></span>Fit</span></div>` +
        miniEmpty('No injuries recorded', '');
    }
    const today = parseDay(iso(new Date()));
    const active = rows.some(r => (r.status || '').toLowerCase() === 'active');
    const summaryColor = active ? 'var(--cm-danger)' : 'var(--cm-success)';
    const summary = `<div style="margin-bottom:10px"><span class="pp-badge" style="background:color-mix(in srgb,${summaryColor} 14%,transparent);color:${summaryColor}"><span class="dot" style="background:${summaryColor}"></span>${active ? 'Injured' : 'Fit'}</span></div>`;

    const items = rows.map(r => {
      const meta = injStatusMeta(r.status);
      const isActive = (r.status || '').toLowerCase() === 'active';
      const s = parseDay(r.start_date);
      const end = isActive ? today : (parseDay(r.expected_return) || today);
      const nDays = (s && end && end >= s) ? daysInclusive(s, end) : null;
      const title = [r.injury_type || 'Injury', r.body_area].filter(Boolean).join(' · ');
      const metaLine = [
        `${longDate(r.start_date)} → ${isActive ? 'today' : (r.expected_return ? longDate(r.expected_return) : 'today')}`,
        nDays != null ? `${nDays} days` : null,
        r.severity ? `severity: ${esc(r.severity)}` : null,
      ].filter(Boolean).join(' · ');
      return `<div class="pp-inj-item">
        <span class="bar" style="background:${meta.color}"></span>
        <div class="pp-inj-top">
          <span class="ttl">${esc(title)}</span>
          <span class="pp-badge" style="background:color-mix(in srgb,${meta.color} 14%,transparent);color:${meta.color}"><span class="dot" style="background:${meta.color}"></span>${esc(meta.label)}</span>
        </div>
        <div class="pp-inj-meta">${esc(metaLine)}</div>
        ${r.notes ? `<div class="pp-inj-notes">${esc(r.notes)}</div>` : ''}
      </div>`;
    }).join('');

    return summary + `<div class="pp-inj">${items}</div>`;
  }

  // ── Card C: days-out breakdown ─────────────────────────────────────────────
  function renderBreakdown(rows) {
    // DISTINCT dates per category within the window.
    const sets = { injury: new Set(), illness: new Set(), modified: new Set(), away: new Set(), unavailable: new Set() };
    rows.forEach(r => {
      const st = (r.status || '').toLowerCase();
      const d = r.date ? String(r.date).slice(0, 10) : null;
      if (!d) return;
      if (st === 'injured') sets.injury.add(d);
      else if (st === 'illness' || st === 'sick') sets.illness.add(d);
      else if (st === 'modified') sets.modified.add(d);
      else if (st === 'away') sets.away.add(d);
      else if (st === 'unavailable') sets.unavailable.add(d);
    });
    const cats = [
      ['injury', 'Injury', STATUS_COLOR.injured],
      ['illness', 'Illness', STATUS_COLOR.illness],
      ['modified', 'Modified', STATUS_COLOR.modified],
      ['away', 'National team / away', STATUS_COLOR.away],
      ['unavailable', 'Unavailable / other', STATUS_COLOR.unavailable],
    ];
    const total = Object.values(sets).reduce((a, s) => a + s.size, 0);
    if (!rows.length) return miniEmpty('No availability recorded', '');
    const list = cats.map(([k, lbl, color]) => `<div class="pp-dob-row">
      <span class="sw" style="background:${color}"></span>
      <span class="nm">${lbl}</span>
      <span class="ct">${sets[k].size}<small>d</small></span>
    </div>`).join('');
    return `<div class="pp-dob">${list}
      <div class="pp-dob-row"><span class="sw" style="background:var(--cm-fg-strong)"></span><span class="nm" style="font-weight:600">Total days out</span><span class="ct">${total}<small>d</small></span></div>
    </div>`;
  }

  // ── Public entry ────────────────────────────────────────────────────────
  async function render({ playerId, clubId, seasonStart, seasonEnd, mount }) {
    if (!mount) return;
    styleInject();
    mount.innerHTML = loadingHTML();

    let range = { start: seasonStart, end: seasonEnd };
    if (!range.start || !range.end) {
      const today = new Date(), past = new Date();
      past.setDate(past.getDate() - 365);
      range = { start: iso(past), end: iso(today) };
    }

    mount.innerHTML = `
      <div class="pp-av">
        <div class="pp-av-card" data-av="heat">
          <div class="pp-av-head"><i class="ti ti-calendar-stats"></i><h3>Availability (season)</h3></div>
          <div data-av-body="heat">${loadingHTML()}</div>
        </div>
        <div class="pp-av-row">
          <div class="pp-av-card" data-av="inj">
            <div class="pp-av-head"><i class="ti ti-bandage"></i><h3>Injury history</h3></div>
            <div data-av-body="inj">${loadingHTML()}</div>
          </div>
          <div class="pp-av-card" data-av="dob">
            <div class="pp-av-head"><i class="ti ti-clock-pause"></i><h3>Days out (this season)</h3></div>
            <div data-av-body="dob">${loadingHTML()}</div>
          </div>
        </div>
      </div>`;

    const heatBody = mount.querySelector('[data-av-body="heat"]');
    const injBody = mount.querySelector('[data-av-body="inj"]');
    const dobBody = mount.querySelector('[data-av-body="dob"]');

    // Availability rows → Cards A + C
    (async () => {
      let rows = [];
      try {
        const { data } = await sb()
          .from('availability')
          .select('date, status, minutes')
          .eq('club_id', clubId)
          .eq('player_id', playerId)
          .gte('date', range.start).lte('date', range.end)
          .order('date', { ascending: true });
        rows = data || [];
      } catch (_) { rows = []; }
      try { heatBody.innerHTML = renderHeat(rows, range.start, range.end); } catch (_) { heatBody.innerHTML = miniEmpty('No availability recorded', ''); }
      try { dobBody.innerHTML = renderBreakdown(rows); } catch (_) { dobBody.innerHTML = miniEmpty('No availability recorded', ''); }
    })();

    // Injuries → Card B
    (async () => {
      let rows = [];
      try {
        const { data } = await sb()
          .from('injuries')
          .select('injury_type, body_area, severity, status, start_date, expected_return, notes')
          .eq('club_id', clubId)
          .eq('player_id', playerId)
          .order('start_date', { ascending: false });
        rows = data || [];
      } catch (_) { rows = []; }
      try { injBody.innerHTML = renderInjuries(rows); } catch (_) { injBody.innerHTML = miniEmpty('No injuries recorded', ''); }
    })();
  }

  window.playerAvailability = { render };
})();
