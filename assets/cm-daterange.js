/**
 * cm-daterange.js — dependency-free date-range picker (window.CMDateRange).
 *
 * A tidy monthly calendar with month/year navigation and quick presets that
 * returns { from, to } as ISO 'YYYY-MM-DD' strings (or null = unbounded). One
 * component reused by GPS "Sync now" (Admin) and "Map drills" (Exercises).
 *
 * Usage:
 *   const dr = window.CMDateRange.mount(containerEl, {
 *     from: '2024-01-01', to: '2024-12-31',   // optional initial range (ISO|null)
 *     presets: true,                          // show Last 30 / <real seasons> / All
 *     allLabel: 'All dates',                  // label when range is unbounded
 *     clubId: '…', teamId: '…',               // optional → load real seasons from `seasons` table
 *     seasons: [{name,start_date,end_date}],  // optional → use this pre-loaded list instead of querying
 *     onChange: ({from,to}) => { ... },       // fires when a range is picked
 *   });
 *   dr.getRange();           // → { from, to }  (ISO strings or null)
 *   dr.setRange(from, to);   // programmatic
 *   dr.destroy();
 */
(function () {
  'use strict';

  const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const pad = n => String(n).padStart(2, '0');
  const iso = d => d ? `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` : null;
  const parse = s => { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
  const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const atMid = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Monday-first weekday index (0=Mon … 6=Sun)
  const dowMon = d => (d.getDay() + 6) % 7;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  window.CMDateRange = {
    mount(container, opts = {}) {
      const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
      const showPresets = opts.presets !== false;
      const allLabel = opts.allLabel || 'All dates';
      const today = atMid(new Date());

      let from = parse(opts.from) || null;
      let to   = parse(opts.to)   || null;
      let view = (to || from || today);
      let vY = view.getFullYear(), vM = view.getMonth();
      let open = false;

      // Real seasons (from the `seasons` table) shown as preset chips. Either a
      // pre-loaded array is passed, or we query by club_id (+ optional team_id).
      let seasons = Array.isArray(opts.seasons)
        ? opts.seasons.filter(s => s && s.start_date && s.end_date)
        : [];
      async function loadSeasons() {
        if (seasons.length || !opts.clubId || !window.sb) return;
        try {
          let q = window.sb.from('seasons').select('name,start_date,end_date,status').eq('club_id', opts.clubId);
          if (opts.teamId) q = q.eq('team_id', opts.teamId);
          const { data } = await q.order('start_date', { ascending: false });
          // Keep dated rows; dedupe by name (a club may repeat a season per team).
          const seen = new Set();
          seasons = (data || []).filter(s => {
            if (!s.start_date || !s.end_date || seen.has(s.name)) return false;
            seen.add(s.name); return true;
          });
          if (open) renderCal();
        } catch (_) { /* leave empty → seasons block hidden (never a hardcoded fallback) */ }
      }

      container.classList.add('cmdr');
      container.style.position = 'relative';
      container.style.display = 'inline-block';
      container.innerHTML = `
        <button type="button" data-trigger style="display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;cursor:pointer">
          <i class="ti ti-calendar" style="font-size:15px;color:var(--cm-fg-muted)"></i>
          <span data-label>—</span>
          <i class="ti ti-chevron-down" style="font-size:14px;color:var(--cm-fg-muted)"></i>
        </button>
        <div data-pop hidden style="position:absolute;top:calc(100% + 6px);left:0;z-index:10000;width:284px;background:var(--cm-bg);border:1px solid var(--cm-border);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:12px"></div>`;

      const triggerEl = container.querySelector('[data-trigger]');
      const labelEl   = container.querySelector('[data-label]');
      const popEl     = container.querySelector('[data-pop]');

      function fmtLabel() {
        if (!from && !to) return allLabel;
        if (from && to)   return `${iso(from)} → ${iso(to)}`;
        return iso(from || to);
      }
      function refreshLabel() { labelEl.textContent = fmtLabel(); }

      const yearOpts = () => {
        const cur = today.getFullYear(); let s = '';
        for (let y = cur + 1; y >= cur - 12; y--) s += `<option value="${y}"${y===vY?' selected':''}>${y}</option>`;
        return s;
      };

      function inRange(d) {
        if (!from || !to) return false;
        return d >= from && d <= to;
      }

      function renderCal() {
        const first = new Date(vY, vM, 1);
        const lead = dowMon(first);                       // blanks before day 1
        const days = new Date(vY, vM + 1, 0).getDate();   // days in month
        let cells = '';
        for (let i = 0; i < lead; i++) cells += `<div></div>`;
        for (let d = 1; d <= days; d++) {
          const cur = new Date(vY, vM, d);
          const isFrom = sameDay(cur, from), isTo = sameDay(cur, to);
          const sel = isFrom || isTo, mid = inRange(cur) && !sel;
          const isToday = sameDay(cur, today);
          const bg = sel ? 'var(--cm-accent)' : mid ? 'var(--cm-accent-soft)' : 'transparent';
          const fg = sel ? 'var(--cm-fg-on-accent,#fff)' : mid ? 'var(--cm-accent)' : 'var(--cm-fg)';
          const bd = isToday && !sel ? 'border:1px solid var(--cm-accent)' : 'border:1px solid transparent';
          cells += `<button type="button" data-day="${iso(cur)}" style="padding:6px 0;border-radius:7px;${bd};background:${bg};color:${fg};font:600 11.5px var(--cm-font-sans);cursor:pointer">${d}</button>`;
        }
        popEl.innerHTML = `
          ${showPresets ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
            <button type="button" data-preset="30"  style="${PRESET_CSS}">Last 30 days</button>
            ${seasons.map((s,i) => `<button type="button" data-season="${i}" style="${SEASON_CSS}">${esc(s.name || 'Season')}</button>`).join('')}
            <button type="button" data-preset="all" style="${PRESET_CSS}">All</button>
          </div>` : ''}
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <button type="button" data-nav="-1" style="${NAV_CSS}">‹</button>
            <div style="flex:1;display:flex;gap:6px;justify-content:center;align-items:center">
              <span style="font:600 12.5px var(--cm-font-sans);color:var(--cm-fg-strong)">${MON[vM]}</span>
              <select data-year style="padding:3px 6px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg);color:var(--cm-fg-strong);font:600 12px var(--cm-font-sans)">${yearOpts()}</select>
            </div>
            <button type="button" data-nav="1" style="${NAV_CSS}">›</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
            ${DOW.map(d => `<div style="text-align:center;font:600 9.5px var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase">${d}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cells}</div>
          <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
            <span style="font:500 11px var(--cm-font-sans);color:var(--cm-fg-muted)">${fmtLabel()}</span>
            <button type="button" data-done style="${DONE_CSS}">Done</button>
          </div>`;
        wireCal();
        if (open) positionPop();   // re-anchor after content height changes (month nav, presets)
      }

      // Anchor the popover as position:fixed from the trigger, flipping when it would run off
      // an edge. Using fixed escapes any ancestor overflow:hidden (e.g. a modal card) that
      // would otherwise clip the calendar and make dates unselectable.
      function positionPop() {
        const r = triggerEl.getBoundingClientRect();
        const M = 8;
        const popW = popEl.offsetWidth || 284;
        const popH = popEl.offsetHeight || 320;
        let left = r.left;
        if (left + popW > window.innerWidth - M) left = r.right - popW;   // flip → right-align to trigger
        left = Math.max(M, Math.min(left, window.innerWidth - popW - M));
        let top = r.bottom + 6;
        if (top + popH > window.innerHeight - M) top = Math.max(M, r.top - 6 - popH);   // flip above trigger
        popEl.style.position = 'fixed';
        popEl.style.left = left + 'px';
        popEl.style.top = top + 'px';
        popEl.style.right = 'auto';
        popEl.style.bottom = 'auto';
      }

      function pickDay(isoStr) {
        const d = parse(isoStr);
        if (!from || (from && to)) { from = d; to = null; }    // 1st click → start range
        else if (d < from)         { from = d; to = null; }    // before start → restart from here
        else                       { to = d; }                 // after start → close range
        refreshLabel(); renderCal();
      }

      function applyPreset(kind) {
        if (kind === 'all')  { from = null; to = null; }
        if (kind === '30')   { to = today; from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29); }
        vY = (to || today).getFullYear(); vM = (to || today).getMonth();
        onChange(api.getRange());
        refreshLabel(); renderCal();
      }

      function applySeason(i) {
        const s = seasons[i]; if (!s) return;
        from = parse(s.start_date); to = parse(s.end_date);
        vY = (to || today).getFullYear(); vM = (to || today).getMonth();
        onChange(api.getRange());
        refreshLabel(); renderCal();
      }

      // stopPropagation on every in-popover click: renderCal() rebuilds the DOM,
      // detaching the clicked node, so a bubbling document-click would otherwise
      // see it as "outside" and close the popover (breaking 2nd-day selection).
      function wireCal() {
        popEl.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); pickDay(b.dataset.day); }));
        popEl.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); applyPreset(b.dataset.preset); }));
        popEl.querySelectorAll('[data-season]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); applySeason(+b.dataset.season); }));
        popEl.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', e => {
          e.stopPropagation();
          vM += (+b.dataset.nav); if (vM < 0) { vM = 11; vY--; } if (vM > 11) { vM = 0; vY++; } renderCal();
        }));
        const ys = popEl.querySelector('[data-year]');
        if (ys) { ys.addEventListener('click', e => e.stopPropagation()); ys.addEventListener('change', e => { e.stopPropagation(); vY = +ys.value; renderCal(); }); }
        const done = popEl.querySelector('[data-done]');
        if (done) done.addEventListener('click', e => { e.stopPropagation(); onChange(api.getRange()); setOpen(false); });
      }

      function setOpen(v) {
        open = v; popEl.hidden = !v;
        if (v) {
          vY = (to || from || today).getFullYear(); vM = (to || from || today).getMonth();
          renderCal();
          positionPop();
          window.addEventListener('scroll', positionPop, true);
          window.addEventListener('resize', positionPop);
        } else {
          window.removeEventListener('scroll', positionPop, true);
          window.removeEventListener('resize', positionPop);
        }
      }

      function onDocClick(e) { if (open && !container.contains(e.target)) setOpen(false); }

      triggerEl.addEventListener('click', e => { e.stopPropagation(); setOpen(!open); });
      document.addEventListener('click', onDocClick);
      refreshLabel();
      loadSeasons();   // fire-and-forget; re-renders the popover if open when it lands

      const api = {
        getRange() { return { from: iso(from), to: iso(to) }; },
        setRange(f, t) { from = parse(f); to = parse(t); refreshLabel(); if (open) renderCal(); },
        open() { setOpen(true); },
        close() { setOpen(false); },
        destroy() { document.removeEventListener('click', onDocClick); window.removeEventListener('scroll', positionPop, true); window.removeEventListener('resize', positionPop); container.innerHTML = ''; container.classList.remove('cmdr'); },
      };
      return api;
    },
  };

  const PRESET_CSS = 'padding:4px 9px;border:1px solid var(--cm-border);border-radius:999px;background:var(--cm-bg-soft);color:var(--cm-fg-muted);font:600 10.5px var(--cm-font-sans);cursor:pointer';
  // Real seasons read as actionable chips → accent-tinted to stand apart from generic presets.
  const SEASON_CSS = 'padding:4px 9px;border:1px solid var(--cm-accent);border-radius:999px;background:var(--cm-accent-soft);color:var(--cm-accent);font:600 10.5px var(--cm-font-sans);cursor:pointer';
  const NAV_CSS    = 'width:26px;height:26px;border:1px solid var(--cm-border);border-radius:7px;background:var(--cm-bg);color:var(--cm-fg);font-size:15px;line-height:1;cursor:pointer';
  const DONE_CSS   = 'padding:5px 12px;border:0;border-radius:7px;background:var(--cm-accent);color:var(--cm-fg-on-accent,#fff);font:600 11.5px var(--cm-font-sans);cursor:pointer';
})();
