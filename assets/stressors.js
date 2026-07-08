/* ────────────────────────────────────────────────────────────────────────
   stressors.js — "Impending Stressors" card. Contextual load modifiers over
   the next N days that shape how ACWR / GPS exposure should be read:
     · Fixture congestion  (short turnarounds, match density) — from calendar
     · Travel              (away matches / travel events, km) — calendar + geo
     · Heat                (apparent temperature at venue)    — weather forecast

   Exposes: window.stressors.render({ clubId, teamId?, mount, refDate?, days? })

   Data sources
     - public.calendar_events (matches, travel) — always available.
     - Open-Meteo (free, no API key, CORS-enabled):
         geocoding  https://geocoding-api.open-meteo.com/v1/search
         forecast   https://api.open-meteo.com/v1/forecast  (daily, ~16-day horizon)
       Heat beyond the forecast horizon is omitted (flagged), not faked.

   Degrades gracefully: if the weather API is unreachable (e.g. CSP blocks the
   domain), congestion + travel presence still render; only heat/km drop out.
   Geocoding results are cached in localStorage (venues rarely move).
   Self-contained. Reuses window.sb. Never throws.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const GEO_URL  = 'https://geocoding-api.open-meteo.com/v1/search';
  const FCAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const FORECAST_HORIZON = 16;                 // Open-Meteo free daily horizon (days)
  const GEO_CACHE_KEY = 'cm_stressors_geo_v1';

  // Thresholds (apparent temperature in °F; travel in km).
  const HEAT   = { watch: 86, high: 95 };
  const TRAVEL = { watch: 500, high: 1500 };
  const TURNAROUND = { high: 2, watch: 3 };    // days between consecutive matches

  // ── utils ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function offset(refStr, days) { const d = new Date(refStr + 'T00:00:00'); d.setDate(d.getDate() + days); return iso(d); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function fmtDate(s) {
    try { return new Date(s + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
    catch { return s; }
  }
  function haversineKm(a, b) {
    if (!a || !b) return null;
    const R = 6371, toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(s)));
  }
  function loadGeoCache() { try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}'); } catch { return {}; } }
  function saveGeoCache(c) { try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch {} }

  function styleInject() {
    if (document.getElementById('cmstr-styles')) return;
    const css = `
    .cmstr-card { background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:var(--cm-r-4);
      box-shadow:var(--cm-shadow-1); padding:16px 18px; }
    .cmstr-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .cmstr-head .ti { font-size:16px; color:var(--cm-fg-muted); }
    .cmstr-head h3 { font:600 15px/1.2 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .cmstr-head .sub { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-faint); }
    .cmstr-head .count { margin-left:auto; font:700 12px/1 var(--cm-font-mono); padding:3px 9px; border-radius:999px;
      background:var(--cm-bg-sunk); color:var(--cm-fg-muted); }
    .cmstr-list { display:flex; flex-direction:column; }
    .cmstr-row { display:flex; align-items:center; gap:12px; padding:11px 2px; border-bottom:1px solid var(--cm-border-soft); }
    .cmstr-row:last-child { border-bottom:0; }
    .cmstr-date { flex:0 0 46px; text-align:center; }
    .cmstr-date .d { font:700 14px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .cmstr-date .m { font:500 10px/1 var(--cm-font-mono); color:var(--cm-fg-faint); text-transform:uppercase; }
    .cmstr-ic { flex:0 0 30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:8px;
      background:var(--cm-bg-soft); }
    .cmstr-ic .ti { font-size:16px; }
    .cmstr-body { flex:1; min-width:0; }
    .cmstr-body .t { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .cmstr-body .h { font:500 11.5px/1.3 var(--cm-font-mono); color:var(--cm-fg-muted); }
    .cmstr-pill { flex:0 0 auto; font:700 10.5px/1 var(--cm-font-sans); letter-spacing:.03em; text-transform:uppercase;
      padding:4px 8px; border-radius:999px; }
    .cmstr-pill.high  { color:var(--cm-danger);  background:color-mix(in srgb, var(--cm-danger) 12%, transparent); }
    .cmstr-pill.watch { color:var(--cm-warning); background:color-mix(in srgb, var(--cm-warning) 14%, transparent); }
    .cmstr-heat  { color:var(--cm-danger); }
    .cmstr-travel{ color:var(--cm-info, #3b82f6); }
    .cmstr-cong  { color:var(--cm-warning); }
    .cmstr-loading, .cmstr-empty { display:flex; align-items:center; gap:8px; color:var(--cm-fg-faint);
      font:var(--cm-body-sm); padding:14px 4px; }
    .cmstr-empty { flex-direction:column; text-align:center; gap:4px; padding:22px 8px; }
    .cmstr-empty .t { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
    .cmstr-note { margin-top:8px; font:500 10px/1.4 var(--cm-font-mono); color:var(--cm-fg-faint); }`;
    const el = document.createElement('style'); el.id = 'cmstr-styles'; el.textContent = css;
    document.head.appendChild(el);
  }

  // ── external data (Open-Meteo) ──────────────────────────────────────────────
  async function geocode(name, cache) {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    if (cache[key] !== undefined) return cache[key];          // includes cached null
    try {
      const r = await fetch(`${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
      const j = await r.json();
      const hit = j?.results?.[0];
      cache[key] = hit ? { lat: hit.latitude, lon: hit.longitude, label: hit.name } : null;
    } catch { cache[key] = null; }
    return cache[key];
  }
  async function forecastFor(coords) {
    try {
      const url = `${FCAST_URL}?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&daily=temperature_2m_max,apparent_temperature_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=${FORECAST_HORIZON}`;
      const r = await fetch(url);
      const j = await r.json();
      const t = j?.daily?.time || [];
      const app = j?.daily?.apparent_temperature_max || [];
      const map = {};
      t.forEach((d, i) => { map[d] = app[i]; });
      return map;                                             // { 'YYYY-MM-DD': apparentF }
    } catch { return {}; }
  }

  // ── core: build stressor list ───────────────────────────────────────────────
  async function build({ clubId, teamId, refStr, days }) {
    const to = offset(refStr, days);

    let q = window.sb.from('calendar_events')
      .select('id,title,type,date,start_time,home_away,opponent,competition,location,estimated_rpe')
      .eq('club_id', clubId).gte('date', refStr).lte('date', to).order('date');
    if (teamId) q = q.eq('team_id', teamId);
    const { data: events } = await q;
    const evs = events || [];

    const matches = evs.filter(e => e.type === 'match');
    const travels = evs.filter(e => ['travel', 'bus_departure'].includes(e.type));

    // Home base = most frequent location of recent home matches (for travel km).
    let homeName = null;
    try {
      const { data: homeM } = await window.sb.from('calendar_events')
        .select('location').eq('club_id', clubId).eq('type', 'match').eq('home_away', 'home')
        .gte('date', offset(refStr, -120)).not('location', 'is', null).limit(50);
      const freq = {};
      (homeM || []).forEach(m => { if (m.location) freq[m.location] = (freq[m.location] || 0) + 1; });
      homeName = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    } catch {}

    const cache = loadGeoCache();
    const homeCoords = homeName ? await geocode(homeName, cache) : null;

    const stressors = [];

    // ── Fixture congestion (short turnarounds + density) ──
    for (let i = 1; i < matches.length; i++) {
      const gap = daysBetween(matches[i - 1].date, matches[i].date);
      if (gap <= TURNAROUND.watch) {
        stressors.push({
          date: matches[i].date, kind: 'cong', icon: 'ti-calendar-stats',
          sev: gap <= TURNAROUND.high ? 'high' : 'watch',
          title: `Short turnaround · ${gap}d since last match`,
          hint: `vs ${esc(matches[i].opponent || matches[i].title || 'match')}`,
        });
      }
    }
    // 3+ matches within any 8-day window → density flag on the 3rd.
    for (let i = 2; i < matches.length; i++) {
      if (daysBetween(matches[i - 2].date, matches[i].date) <= 8) {
        stressors.push({
          date: matches[i].date, kind: 'cong', icon: 'ti-stack-2', sev: 'high',
          title: '3 matches in 8 days', hint: 'fixture congestion',
        });
      }
    }

    // ── Travel (away matches + explicit travel events) ──
    const travelCandidates = matches.filter(m => m.home_away === 'away')
      .map(m => ({ ...m, _label: m.opponent || m.location || m.title }))
      .concat(travels.map(t => ({ ...t, _label: t.location || t.title })));
    for (const ev of travelCandidates) {
      let km = null, dest = ev.location || ev._label;
      if (ev.location) {
        const c = await geocode(ev.location, cache);
        km = (c && homeCoords) ? haversineKm(homeCoords, c) : null;
      }
      const sev = km == null ? 'watch' : km >= TRAVEL.high ? 'high' : km >= TRAVEL.watch ? 'watch' : null;
      if (sev === null) continue;                            // short hop, not noteworthy
      stressors.push({
        date: ev.date, kind: 'travel', icon: 'ti-plane', sev,
        title: km != null ? `Travel · ${km.toLocaleString()} km` : 'Travel / away fixture',
        hint: dest ? `to ${esc(dest)}` : '',
      });
    }

    // ── Heat (apparent temp at venue, within forecast horizon) ──
    let heatTruncated = false;
    const venueEvents = matches.filter(m => m.location);
    const byLoc = {};
    venueEvents.forEach(m => (byLoc[m.location] || (byLoc[m.location] = [])).push(m));
    for (const [loc, ms] of Object.entries(byLoc)) {
      const c = await geocode(loc, cache);
      if (!c) continue;
      const fc = await forecastFor(c);
      for (const m of ms) {
        if (daysBetween(refStr, m.date) > FORECAST_HORIZON) { heatTruncated = true; continue; }
        const app = fc[m.date];
        if (app == null) continue;
        const sev = app >= HEAT.high ? 'high' : app >= HEAT.watch ? 'watch' : null;
        if (!sev) continue;
        stressors.push({
          date: m.date, kind: 'heat', icon: 'ti-flame', sev,
          title: `Heat · ${Math.round(app)}°F apparent`,
          hint: `${esc(c.label || loc)}`,
        });
      }
    }

    saveGeoCache(cache);
    stressors.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.sev === b.sev ? 0 : a.sev === 'high' ? -1 : 1));
    return { stressors, heatTruncated, matchCount: matches.length };
  }

  // ── render ────────────────────────────────────────────────────────────────
  async function render({ clubId, teamId, mount, refDate, days }) {
    if (!mount) return;
    styleInject();
    const refStr = refDate || iso(new Date());
    const win = days || 21;
    mount.innerHTML = `<div class="cmstr-card"><div class="cmstr-loading"><i class="ti ti-loader-2"></i> Scanning next ${win} days…</div></div>`;

    let res;
    try { res = await build({ clubId, teamId, refStr, days: win }); }
    catch (e) { res = { stressors: [], heatTruncated: false, matchCount: 0 }; }

    const kindCls = { heat: 'cmstr-heat', travel: 'cmstr-travel', cong: 'cmstr-cong' };
    const rows = res.stressors.map(s => `
      <div class="cmstr-row">
        <div class="cmstr-date"><div class="d">${new Date(s.date + 'T00:00:00').getDate()}</div><div class="m">${fmtDate(s.date).replace(/\d+\s*/, '')}</div></div>
        <div class="cmstr-ic"><i class="ti ${s.icon} ${kindCls[s.kind] || ''}"></i></div>
        <div class="cmstr-body"><div class="t">${esc(s.title)}</div><div class="h">${s.hint || ''}</div></div>
        <span class="cmstr-pill ${s.sev}">${s.sev}</span>
      </div>`).join('');

    const note = res.heatTruncated
      ? `<div class="cmstr-note">Heat shown for the next ${FORECAST_HORIZON} days (weather forecast horizon).</div>` : '';

    mount.innerHTML = `<div class="cmstr-card">
      <div class="cmstr-head">
        <i class="ti ti-alert-hexagon"></i>
        <h3>Impending Stressors</h3>
        <span class="sub">next ${win} days</span>
        <span class="count">${res.stressors.length}</span>
      </div>
      ${res.stressors.length
        ? `<div class="cmstr-list">${rows}</div>${note}`
        : `<div class="cmstr-empty"><i class="ti ti-circle-check" style="font-size:22px;color:var(--cm-success)"></i>
             <span class="t">No flagged stressors</span>
             <span>No heat, long travel or fixture congestion in the next ${win} days.</span></div>`}
    </div>`;
  }

  window.stressors = { render, build, _internals: { haversineKm, geocode, HEAT, TRAVEL, TURNAROUND } };
})();
