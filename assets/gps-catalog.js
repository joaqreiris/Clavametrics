/* =============================================================
   gps-catalog.js — THE club's metric list, in one place.

   THE PROBLEM THIS SOLVES
   Every screen that shows training metrics used to carry its own hand-written list:
   Load Monitor had three (eligible / default / signals), the Load Planner had labels +
   order + bands, gps-player-week, gps-acwr and gps-exposure each had another. The same
   facts — what a metric is called, its unit, its decimals, whether you add it up or take
   the peak — were copied five times, and all five were written for football.

   Meanwhile gps_metric_definitions already holds exactly those facts, PER CLUB, and clubs
   already use it: MOI added "Max HR" and "% Max Vel" there. Nothing showed them, because
   no screen ever read the table.

   So: one list, read from the club's own catalogue, and every screen asks it.

   WHERE A VALUE LIVES
   gps_reports has a fixed column per football metric; anything else goes to the
   gps_report_metrics key/value table. Callers should not care which — ask `source(key)`
   when building a query, and `columns()` for the SELECT list.

   NEVER EMPTY
   A club with no catalogue (or an offline page) still gets the fixed columns with their
   canonical labels, so a football club sees exactly what it saw before this existed.

   USAGE
     <script src="assets/gps-catalog.js"></script>     (after supabase-init.js)
     await window.cmGpsCatalog.ready();                 // before you need it to be exact
     window.cmGpsCatalog.list()                         // sync, safe from the first frame
   ============================================================= */
(function () {
  'use strict';
  if (window.cmGpsCatalog) return;   // idempotent

  // The metrics gps_reports stores as real columns. Everything else is key/value.
  // Order matches the column order in db/schema.sql, which is also the order clubs see.
  const FIXED_COLUMNS = [
    'total_distance', 'high_speed_distance', 'very_high_speed_distance', 'sprint_distance',
    'sprint_count', 'max_speed', 'avg_speed', 'accelerations', 'decelerations',
    'player_load', 'hmld', 'time_played', 'distance_per_minute',
  ];

  // Fallback labels/units for the fixed columns, so a club with an empty catalogue still
  // gets a sane list. Mirrors assets/gps-units.js, which owns the unit contract.
  const FALLBACK = {
    total_distance:           { label: 'Total Distance', unit: 'm',     category: 'distance' },
    high_speed_distance:      { label: 'HSR',            unit: 'm',     category: 'distance' },
    very_high_speed_distance: { label: 'VHSR',           unit: 'm',     category: 'distance' },
    sprint_distance:          { label: 'Sprint Distance',unit: 'm',     category: 'distance' },
    sprint_count:             { label: 'Sprint Count',   unit: 'n',     category: 'count'    },
    max_speed:                { label: 'Max Speed',      unit: 'km/h',  category: 'speed'    },
    avg_speed:                { label: 'Avg Speed',      unit: 'km/h',  category: 'speed'    },
    accelerations:            { label: 'Accelerations',  unit: 'n',     category: 'count'    },
    decelerations:            { label: 'Decelerations',  unit: 'n',     category: 'count'    },
    player_load:              { label: 'Player Load',    unit: 'AU',    category: 'load'     },
    hmld:                     { label: 'HMLD',           unit: 'm',     category: 'distance' },
    time_played:              { label: 'Time Played',    unit: 'min',   category: 'time'     },
    distance_per_minute:      { label: 'Distance / Min', unit: 'm/min', category: 'distance' },
  };

  /* ---- how a metric aggregates ---------------------------------------------
     Adding up max speeds gives a meaningless number, and so does adding metres per
     minute. gps_metric_definitions.kind answers this ('accum' | 'peak') but is NULL on
     every row a club created before that column existed — MOI's whole catalogue is NULL —
     so we infer from the shape of the metric when it is missing. */
  function inferAgg(def) {
    if (def.kind === 'peak')  return 'max';
    if (def.kind === 'accum') return 'sum';
    const k = String(def.key || '');
    if (/^max_/.test(k))                      return 'max';
    if (/^(avg|mean)_/.test(k))               return 'avg';
    if (/_per_/.test(k))                      return 'avg';   // a rate, not a total
    if (def.category === 'speed')             return 'max';
    const u = String(def.unit || '');
    if (u === '%' || u.indexOf('/') >= 0)     return 'avg';
    return 'sum';
  }

  // Decimals: what the club set, else the unit contract, else a sane guess.
  function inferDecimals(def) {
    if (typeof def.decimals === 'number') return def.decimals;
    try {
      const U = window.GpsUnits;                       // assets/gps-units.js
      const kind = (U && U.kindOf) ? U.kindOf(def.key) : null;
      const disp = (kind && U.DISPLAY) ? U.DISPLAY[kind] : null;
      if (disp && typeof disp.decimals === 'number') return disp.decimals;
    } catch (_e) {}
    return def.category === 'speed' || def.category === 'load' ? 1 : 0;
  }

  function normalise(row) {
    const key = String(row.key || '');
    const fb  = FALLBACK[key] || {};
    const def = {
      key,
      label:        row.label || fb.label || key,
      unit:         row.unit != null ? row.unit : (fb.unit || ''),
      category:     row.category || fb.category || 'custom',
      kind:         row.kind || null,
      isCore:       !!row.is_core,
      squadRollup:  row.squad_rollup !== false,
      order:        typeof row.display_order === 'number' ? row.display_order : 100,
      // 'column' → a field on gps_reports; 'custom' → a row in gps_report_metrics.
      source:       FIXED_COLUMNS.indexOf(key) >= 0 ? 'column' : 'custom',
    };
    def.decimals = inferDecimals(Object.assign({}, row, def));
    def.agg      = inferAgg(def);
    return def;
  }

  // The list a club gets before (or instead of) its own catalogue.
  function fallbackList() {
    return FIXED_COLUMNS.map((key, i) =>
      normalise(Object.assign({ key, display_order: i + 1, is_core: true }, FALLBACK[key])));
  }

  let _list    = fallbackList();   // synchronous answer from the very first frame
  let _byKey   = index(_list);
  let _promise = null;
  let _loaded  = false;

  function index(list) {
    const m = Object.create(null);
    list.forEach(d => { m[d.key] = d; });
    return m;
  }

  function load() {
    if (_promise) return _promise;
    _promise = (async () => {
      try {
        const clubId = (typeof window.getClubId === 'function') ? await window.getClubId() : null;
        if (!clubId) { _promise = null; return _list; }   // no session yet — retry next call
        const { data, error } = await window.sb
          .from('gps_metric_definitions')
          .select('key,label,unit,category,kind,decimals,is_core,squad_rollup,display_order')
          .eq('club_id', clubId)
          .order('display_order', { ascending: true });
        if (error || !Array.isArray(data) || !data.length) {
          // An empty catalogue is not an error: the club never customised it. Keep the
          // fallback so the screens look the way they always did.
          _loaded = true;
          return _list;
        }
        _list  = data.map(normalise).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
        _byKey = index(_list);
        _loaded = true;
        try { window.dispatchEvent(new CustomEvent('cm:gps-catalog', { detail: { list: _list } })); }
        catch (_e) {}
        return _list;
      } catch (e) {
        console.error('cmGpsCatalog', e);
        _promise = null;               // let the next caller retry
        return _list;
      }
    })();
    return _promise;
  }

  // Kick off as soon as a session is obtainable, without blocking the page.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { load(); } catch (_e) {} }, { once: true });
  } else {
    try { load(); } catch (_e) {}
  }

  window.cmGpsCatalog = {
    /** Resolves once the club's own catalogue has been read. Use before a write or an
     *  export; `list()` is fine for rendering. */
    ready() { return load(); },

    /** True once the DB answered — i.e. list() is the club's, not the fallback. */
    isLoaded() { return _loaded; },

    /** Every metric this club measures, in the club's own order. Never empty. */
    list() { return _list.slice(); },

    /** Just the keys, in order. */
    keys() { return _list.map(d => d.key); },

    /** One metric's definition, or null. */
    get(key) { return _byKey[key] || null; },
    has(key) { return !!_byKey[key]; },

    label(key)    { const d = _byKey[key]; return d ? d.label : key; },
    unit(key)     { const d = _byKey[key]; return d ? d.unit : ''; },
    decimals(key) { const d = _byKey[key]; return d ? d.decimals : 0; },

    /** 'sum' | 'max' | 'avg' — how to combine this metric across sessions. Adding up max
     *  speeds is the classic way to produce a number that means nothing. */
    agg(key)      { const d = _byKey[key]; return d ? d.agg : 'sum'; },
    isAccum(key)  { return this.agg(key) === 'sum'; },

    /** 'column' (a gps_reports field) | 'custom' (a gps_report_metrics row). */
    source(key)   { const d = _byKey[key]; return d ? d.source : (FIXED_COLUMNS.indexOf(key) >= 0 ? 'column' : 'custom'); },

    /** Keys that are real columns — ready to drop into a SELECT. */
    columns()     { return _list.filter(d => d.source === 'column').map(d => d.key); },
    /** Keys that live in the key/value table. */
    customKeys()  { return _list.filter(d => d.source === 'custom').map(d => d.key); },

    /** Metrics that make sense as a squad average (the club can opt one out). */
    rollupKeys()  { return _list.filter(d => d.squadRollup).map(d => d.key); },

    /** Grouped by category, for pickers. */
    byCategory() {
      const out = {};
      _list.forEach(d => { (out[d.category] = out[d.category] || []).push(d); });
      return out;
    },

    /** The fixed gps_reports columns, regardless of catalogue. */
    FIXED_COLUMNS: FIXED_COLUMNS.slice(),

    /** Re-read after the club edits its metrics. */
    refresh() { _promise = null; _loaded = false; return load(); },
  };
})();
