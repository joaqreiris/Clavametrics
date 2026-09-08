// assets/gps-baseline.js
// Match-reference baseline per player.
// Reference: Miguel et al. (2022), Frontiers in Sports and Active Living
// — baseline = mean of the N best values recorded in official matches.
// Ammann & Altmann (2023) — player-specific references outperform position-specific
// for individualised load monitoring.
//
// Public API:
//   window.getMatchBaseline(player_id, metric, clubId, opts)
//   window.getMatchBaselineBatch(player_ids, metric, clubId, opts)
//   window.getAllBaselines(player_id, clubId, opts)
//   window.invalidateBaselineCache(player_id?)
//   window.invalidateSettingsCache(clubId?)
//   window.BASELINE_METRICS, window.BASELINE_MIN_MATCHES, window.BASELINE_DEFAULT_N

(function () {
  'use strict';

  const DEFAULT_N    = 5;
  const MIN_MATCHES  = 3;
  const CACHE_TTL_MS = 120_000; // 2 min

  // Whitelist — prevents metric injection into SQL column name
  const BASELINE_METRICS = [
    'total_distance', 'high_speed_distance', 'very_high_speed_distance',
    'sprint_distance', 'accelerations', 'decelerations',
    'max_speed', 'hmld', 'player_load',
    'time_played', 'sprint_count', 'avg_speed', 'distance_per_minute',
  ];

  // Cache: cacheKey → { result, ts }
  const _cache = {};
  // Settings cache: clubId → { baseline_n, baseline_mode, active_metrics }
  const _settingsCache = {};
  // Match-day cache: clubId → { set:Set<'YYYY-MM-DD'>, ts }
  const _matchDatesCache = {};

  function _cacheKey(pid, metric, n) { return `${pid}:${metric}:${n}`; }

  // ── Club settings ──────────────────────────────────────────────
  const _SETTINGS_DEF = { baseline_n: DEFAULT_N, baseline_mode: 'personal', active_metrics: null,
                          ref_min_minutes: 0, ref_from_date: null };
  // ref_min_minutes / ref_from_date son la REGLA DEL CLUB sobre qué partidos valen como
  // referencia (un partido de 15' no lo es; antes de la fecha de corte las bandas de velocidad
  // estaban definidas de otra manera). Las escribe Top-Up y hasta ahora sólo las leía él: dos
  // pantallas daban referencias distintas del mismo jugador. Ahora las lee el motor, que es
  // quien las tiene que aplicar. Si el club no tiene la migración, se cae al select viejo.
  async function _loadClubSettings(clubId) {
    if (_settingsCache[clubId]) return _settingsCache[clubId];
    let settings = null;
    try {
      const { data, error } = await window.sb
        .from('club_gps_settings')
        .select('baseline_n, baseline_mode, active_metrics, ref_min_minutes, ref_from_date')
        .eq('club_id', clubId)
        .maybeSingle();
      if (error) throw error;
      settings = data;
    } catch {
      try {
        const { data } = await window.sb
          .from('club_gps_settings')
          .select('baseline_n, baseline_mode, active_metrics')
          .eq('club_id', clubId)
          .maybeSingle();
        settings = data;
      } catch { /* defaults */ }
    }
    const out = Object.assign({}, _SETTINGS_DEF, settings || {});
    out.ref_min_minutes = +out.ref_min_minutes || 0;
    _settingsCache[clubId] = out;
    return out;
  }
  // Un solo lugar donde se resuelve la regla, para que Top-Up y las cards no se separen.
  window.gpsRefSettings = _loadClubSettings;

  window.invalidateSettingsCache = function (clubId) {
    if (clubId) delete _settingsCache[clubId];
    else Object.keys(_settingsCache).forEach(k => delete _settingsCache[k]);
  };

  // ── Match days — the SINGLE source of truth for "is this day a match?" ──────
  // A day counts as a match if ANY source marks it: a training_sessions row with
  // session_type='match' (Assign rivals, GPS import) OR a calendar_events row with
  // type='match' (the Planner). Baselines, match reports and filters should all read
  // matchness from here so a match is never invisible depending on where it came from.
  async function _loadMatchDates(clubId) {
    const cached = _matchDatesCache[clubId];
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.set;
    const set = new Set();
    try {
      const [ce, ms] = await Promise.all([
        window.sb.from('calendar_events').select('date').eq('club_id', clubId).eq('type', 'match'),
        window.sb.from('training_sessions').select('session_date').eq('club_id', clubId).eq('session_type', 'match'),
      ]);
      (ce.data || []).forEach(r => { if (r.date)          set.add(r.date); });
      (ms.data || []).forEach(r => { if (r.session_date)  set.add(r.session_date); });
    } catch { /* degrade: empty set → treated as "no matches" (insufficient) */ }
    _matchDatesCache[clubId] = { set, ts: Date.now() };
    return set;
  }
  // Public helpers so any consumer resolves matchness the SAME way.
  window.gpsGetMatchDates = _loadMatchDates;                                  // → Promise<Set>
  window.gpsIsMatchDay    = async (date, clubId) => (await _loadMatchDates(clubId)).has(date);
  window.invalidateMatchDatesCache = function (clubId) {
    if (clubId) delete _matchDatesCache[clubId];
    else Object.keys(_matchDatesCache).forEach(k => delete _matchDatesCache[k]);
  };

  // ── Cache invalidation ─────────────────────────────────────────
  window.invalidateBaselineCache = function (player_id) {
    const prefix = player_id ? player_id + ':' : null;
    Object.keys(_cache).forEach(k => {
      if (!prefix || k.startsWith(prefix)) delete _cache[k];
    });
    Object.keys(_nonTeamCache).forEach(k => delete _nonTeamCache[k]);   // pudo llegar un top-up nuevo
  };

  // Listen for import events (fired by GPS import pipeline after UPSERT)
  window.addEventListener('gps:reports:updated', (e) => {
    window.invalidateBaselineCache();
    window.invalidateMatchDatesCache(e.detail?.clubId);   // new sessions/matches may have arrived
    if (e.detail?.clubId) window.invalidateSettingsCache(e.detail.clubId);
  });

  // ── Recorte por contexto de trabajo (Modelo B) ─────────────────
  // Un día de partido puede traer top-up / rehab / individual MEZCLADO en la misma fila de
  // sesión — o ser SOLO top-up, en el caso del suplente que no jugó. Un baseline de PARTIDO
  // tiene que medir el partido: se recalculan los valores desde los períodos 'team' y, si el
  // jugador no tiene ninguno, la fila se cae (para él ese día no hubo partido). Sesiones sin
  // períodos importados (CSV/manual) quedan intactas.
  // Ver docs/gps-work-context.md · lib/gp-card/resolver.js.
  // Fast-path: getAllBaselines pide 13 métricas sobre las MISMAS sesiones. Sin este cache cada
  // una repetiría el sondeo de períodos no-team. Promesa cacheada → una sola query por set.
  const _nonTeamCache = {};   // 'clubId|sids' → { p:Promise<boolean>, ts }
  function _hasNonTeam(clubId, sessionIds) {
    const key = clubId + '|' + sessionIds.join(',');
    const hit = _nonTeamCache[key];
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.p;
    const p = import('../lib/gp-card/resolver.js')
      .then(mod => mod.hasNonTeamPeriods(window.sb, clubId, sessionIds));
    _nonTeamCache[key] = { p, ts: Date.now() };
    return p;
  }

  // Expuesto: Top-Up leía los días de partido por su cuenta y SIN este recorte, así que un día
  // que para el jugador fue sólo top-up le contaba como partido.
  window.gpsScopeMatchRowsToTeam = (rows, clubId, playerIds, select) => _scopeToTeam(rows, clubId, playerIds, select);

  // Regla del club sobre qué partidos valen: fecha de corte (antes de ella las bandas de
  // velocidad estaban definidas de otra manera, el HSR no es comparable) y minutos mínimos (un
  // partido en el que entró 15' no es una referencia). Las filas SIN minutos cargados se
  // aceptan: no hay con qué filtrarlas. Devuelve las fechas recortadas y el predicado.
  function _refRule(settings, matchDates) {
    const minMin = +settings.ref_min_minutes || 0;
    const from   = settings.ref_from_date || null;
    const dates  = from ? [...matchDates].filter(d => d >= from) : [...matchDates];
    return { dates, longEnough: r => !(minMin > 0 && r.time_played != null && +r.time_played < minMin) };
  }
  window.gpsRefRule = _refRule;

  async function _scopeToTeam(rows, clubId, playerIds, select) {
    if (!rows?.length) return rows || [];
    const sessionIds = [...new Set(rows.map(r => r.session_id).filter(Boolean))].sort();
    if (!sessionIds.length) return rows;
    try {
      if (!(await _hasNonTeam(clubId, sessionIds))) return rows;   // nada que recortar
      const mod = await import('../lib/gp-card/resolver.js');
      return await mod.applyCtxToRows(window.sb, { clubId }, sessionIds, ['team'],
        (playerIds && playerIds.length) ? playerIds : null, rows, select);
    } catch (e) {
      console.warn('[baseline] ctx scope no aplicado:', e?.message || e);
      return rows;
    }
  }

  // ── Single player, single metric ──────────────────────────────
  /**
   * Returns match-reference baseline.
   * { baseline: number|null, count: number, source: 'full'|'partial'|'insufficient_data',
   *   confidence: 'high'|'medium'|'none', warning: string|null }
   * baseline_n is read from club_gps_settings; opts.n overrides it.
   * opts.mode: 'best' (default) → mean of the top-N match values;
   *            'avg'            → mean of ALL match values (typical-match reference).
   */
  window.getMatchBaseline = async function (player_id, metric, clubId, opts) {
    if (!player_id || !metric || !clubId) {
      return { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
               warning: 'Missing arguments' };
    }

    const isCore = BASELINE_METRICS.includes(metric);
    const mode   = (opts && opts.mode) === 'avg' ? 'avg' : 'best';

    const settings = await _loadClubSettings(clubId);
    const n   = (opts && opts.n) || settings.baseline_n || DEFAULT_N;
    const key = _cacheKey(player_id, metric, mode === 'avg' ? 'avg' : n);
    const now = Date.now();
    if (_cache[key] && now - _cache[key].ts < CACHE_TTL_MS) return _cache[key].result;

    let vals = [];
    let queryError = null;

    // A report counts as "match" if its session falls on a match DAY (either source).
    const matchDates = await _loadMatchDates(clubId);
    if (!matchDates.size) {
      const result = { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
                       warning: 'No match days on record' };
      _cache[key] = { result, ts: now };
      return result;
    }
    const { dates: _datesArr, longEnough: _longEnough } = _refRule(settings, matchDates);
    if (!_datesArr.length) {
      const result = { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
                       warning: 'No match days after the club cut-off date' };
      _cache[key] = { result, ts: now };
      return result;
    }

    if (isCore) {
      // Core metric — column in gps_reports.
      // Sin order/limit en servidor: el recorte por contexto puede tirar filas (solo top-up) o
      // bajar valores (partido + top-up), así que el top-N se elige DESPUÉS, en cliente.
      const _sel = `session_id, player_id, ${metric}${metric === 'time_played' ? '' : ', time_played'}, training_sessions!inner(session_date)`;
      const { data, error } = await window.sb
        .from('gps_reports')
        .select(_sel)
        .eq('player_id', player_id)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr)
        .not(metric, 'is', null);
      queryError = error;
      const scoped = await _scopeToTeam(data || [], clubId, [player_id], _sel);
      vals = scoped.filter(_longEnough).map(r => r[metric]).filter(v => v != null && isFinite(+v)).map(v => +v);
      // 'best' → top-N by value; 'avg' → every match (typical-match mean)
      if (mode !== 'avg') vals = vals.sort((a, b) => b - a).slice(0, n);
    } else {
      // Custom metric — EAV in gps_report_metrics
      // Step 1: get report IDs for the player's reports on match days
      const _selEav = 'id, session_id, player_id, time_played, training_sessions!inner(session_date)';
      const { data: matchReports, error: e1 } = await window.sb
        .from('gps_reports')
        .select(_selEav)
        .eq('player_id', player_id)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr);
      queryError = e1;
      // Las EAV no se pueden recortar por período (limitación conocida), pero al jugador que no
      // jugó sí se lo saca: su fila no sobrevive al recorte.
      const scopedEav = await _scopeToTeam(matchReports || [], clubId, [player_id], _selEav);
      const reportIds = scopedEav.filter(_longEnough).map(r => r.id);
      if (reportIds.length) {
        let q2 = window.sb
          .from('gps_report_metrics')
          .select('value')
          .in('report_id', reportIds)
          .eq('metric_key', metric)
          .not('value', 'is', null);
        if (mode !== 'avg') q2 = q2.order('value', { ascending: false }).limit(n);
        const { data: eav, error: e2 } = await q2;
        if (!queryError) queryError = e2;
        vals = (eav || []).map(r => +(r.value || 0));
      }
    }

    if (queryError) {
      return { baseline: null, count: 0, confidence: 'none', source: 'insufficient_data',
               warning: queryError.message || 'Query failed' };
    }

    const count = vals.length;
    let result;
    if (count < MIN_MATCHES) {
      result = {
        baseline: null, count, confidence: 'none', source: 'insufficient_data',
        warning: `Insufficient match data (${count} match${count !== 1 ? 'es' : ''} available, need at least ${MIN_MATCHES})`,
      };
    } else {
      const mean       = vals.reduce((s, v) => s + v, 0) / count;
      const confidence = count >= n ? 'high' : 'medium';
      const source     = count >= n ? 'full' : 'partial';
      result = { baseline: +mean.toFixed(2), count, confidence, source,
                 warning: count < n ? `Baseline from ${count} matches (recommended: ${n})` : null };
    }

    _cache[key] = { result, ts: now };
    return result;
  };

  // ── Bulk: multiple players, single metric (one round-trip) ────
  /**
   * Returns { [player_id]: { baseline, count, confidence, source, warning } }
   * Fetches all rows for all player_ids, then computes per-player top-N mean.
   */
  window.getMatchBaselineBatch = async function (player_ids, metric, clubId, opts) {
    if (!player_ids?.length || !metric || !clubId) return {};

    const isCore = BASELINE_METRICS.includes(metric);
    const settings = await _loadClubSettings(clubId);
    const n = (opts && opts.n) || settings.baseline_n || DEFAULT_N;
    // Qué partidos entran en la media. Tres reglas, y cada una responde otra pregunta:
    //   best   → los N MEJORES: «lo que este jugador da cuando el partido lo exige».
    //   recent → los N ÚLTIMOS por fecha (media móvil): sigue su momento actual, así que un
    //            jugador que vuelve de lesión se compara contra cómo está, no contra su pico.
    //   avg    → TODOS los partidos: el partido típico, picos y flojos incluidos.
    // 'best' sigue siendo el default: es el de la literatura (Miguel et al.) y el que ya usaban
    // todas las pantallas, así que nada cambia para quien no elija.
    const mode = (opts && opts.mode) || 'best';

    // Match days = the single source of truth (session_type='match' OR calendar match).
    const matchDates = await _loadMatchDates(clubId);
    if (!matchDates.size) return {};
    const { dates: _datesArr, longEnough: _longEnough } = _refRule(settings, matchDates);
    if (!_datesArr.length) return {};

    /** Elige qué valores entran, según el modo. Recibe [{v, d}] (valor y fecha). */
    function _pick(items) {
      if (mode === 'avg') return items.map(i => i.v);
      if (mode === 'recent') {
        return items.slice().sort((a, b) => String(b.d || '').localeCompare(String(a.d || '')))
                    .slice(0, n).map(i => i.v);
      }
      return items.slice().sort((a, b) => b.v - a.v).slice(0, n).map(i => i.v);
    }

    // byPlayer: player_id → number[] (los valores elegidos por _pick)
    const byPlayer = {};

    if (isCore) {
      // Paginated (server caps at ~1000): a full squad of match rows exceeds that and would
      // truncate some players' baselines. Paging is id-ordered, so do the top-n-by-value
      // selection client-side (same result as the old server .order(metric).slice(n)).
      const _sel = `session_id, player_id, ${metric}${metric === 'time_played' ? '' : ', time_played'}, training_sessions!inner(session_date)`;
      const data = await window.cmFetchAll(() => window.sb
        .from('gps_reports')
        .select(_sel)
        .in('player_id', player_ids)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr)
        .not(metric, 'is', null), { label: 'baseline.squad-core' }).catch(() => null);
      if (!data) return {};
      const scoped = await _scopeToTeam(data, clubId, player_ids, _sel);
      const _vals = {};
      scoped.forEach(r => {
        if (!_longEnough(r)) return;              // entró pocos minutos → ese día no es referencia
        const v = r[metric];
        if (v == null || !isFinite(+v)) return;   // sin parte de equipo ese día → no es un partido suyo
        (_vals[r.player_id] = _vals[r.player_id] || []).push({ v: +v, d: r.training_sessions?.session_date });
      });
      Object.keys(_vals).forEach(pid => { byPlayer[pid] = _pick(_vals[pid]); });
    } else {
      // Custom metric — two-step via gps_report_metrics
      // Paginated: full-squad match reports can exceed the server's ~1000-row cap →
      // truncated report-id set → incomplete custom-metric baselines.
      const _selEav = 'id, session_id, player_id, time_played, training_sessions!inner(session_date)';
      const matchReports = await window.cmFetchAll(() => window.sb
        .from('gps_reports')
        .select(_selEav)
        .in('player_id', player_ids)
        .eq('club_id', clubId)
        .in('training_sessions.session_date', _datesArr), { label: 'baseline.squad-eav' }).catch(() => null);
      if (!matchReports?.length) return {};

      // Ídem single: el valor EAV sigue siendo el de sesión completa, pero el que no jugó se cae.
      const scopedEav = await _scopeToTeam(matchReports, clubId, player_ids, _selEav);
      if (!scopedEav.length) return {};
      const reportToPlayer = {}, reportToDate = {};
      scopedEav.filter(_longEnough).forEach(r => { reportToPlayer[r.id] = r.player_id; reportToDate[r.id] = r.training_sessions?.session_date; });
      const allReportIds = scopedEav.map(r => r.id);

      const { data: eav, error: e2 } = await window.sb
        .from('gps_report_metrics')
        .select('report_id, value')
        .in('report_id', allReportIds)
        .eq('metric_key', metric)
        .not('value', 'is', null)
        .order('value', { ascending: false });
      if (e2 || !eav) return {};

      // Igual que en el camino core: se junta TODO y después elige el modo. (Antes se cortaba
      // en n acá mismo, aprovechando que la query venía ordenada por valor: con 'recent' o 'avg'
      // eso descartaría justo los que hay que mirar.)
      const _eavVals = {};
      eav.forEach(row => {
        const pid = reportToPlayer[row.report_id];
        if (!pid) return;
        (_eavVals[pid] = _eavVals[pid] || []).push({ v: +(row.value || 0), d: reportToDate[row.report_id] });
      });
      Object.keys(_eavVals).forEach(pid => { byPlayer[pid] = _pick(_eavVals[pid]); });
    }

    const out = {};
    player_ids.forEach(pid => {
      const vals  = byPlayer[pid] || [];
      const count = vals.length;
      if (count < MIN_MATCHES) {
        out[pid] = { baseline: null, count, confidence: 'none', source: 'insufficient_data',
          warning: `Insufficient match data (${count}/${MIN_MATCHES} minimum)` };
      } else {
        const mean = vals.reduce((s, v) => s + v, 0) / count;
        // Con 'avg' entran todos los partidos que haya: la confianza la da el número de partidos,
        // no si se llegó a N (N no significa nada en ese modo).
        const confidence = (mode === 'avg' || count >= n) ? 'high' : 'medium';
        out[pid] = {
          baseline: +mean.toFixed(2), count, confidence,
          source: (mode === 'avg' || count >= n) ? 'full' : 'partial',
          warning: (mode !== 'avg' && count < n) ? `Baseline from ${count} matches (recommended: ${n})` : null,
        };
      }
      const key = _cacheKey(pid, metric, mode === 'best' ? n : `${mode}:${n}`);
      if (!_cache[key]) _cache[key] = { result: out[pid], ts: Date.now() };
    });

    return out;
  };

  // ── All metrics for one player ─────────────────────────────────
  window.getAllBaselines = async function (player_id, clubId, opts) {
    const results = {};
    await Promise.all(BASELINE_METRICS.map(async m => {
      results[m] = await window.getMatchBaseline(player_id, m, clubId, opts);
    }));
    return results;
  };

  // ── Expose constants ───────────────────────────────────────────
  window.BASELINE_METRICS     = BASELINE_METRICS;
  window.BASELINE_MIN_MATCHES = MIN_MATCHES;
  window.BASELINE_DEFAULT_N   = DEFAULT_N;
})();
