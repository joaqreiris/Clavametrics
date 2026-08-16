// ══════════════════════════════════════════════════════════════
// Session Control (vista grp) — control de sesión + comparativas por card.
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en la
// misma posición → timing idéntico. IIFE: expone window._scInit/_scState/_scAllSessions.
// OJO cross-block: _scState y _scAllSessions los LEEN bloques posteriores (z-table,
// vs-session) en runtime; la carga plano-misma-posición preserva ese contrato.
// ══════════════════════════════════════════════════════════════
(function () {
  // ── helpers ──────────────────────────────────────────────────
  const fmt = (v, dec = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en', { maximumFractionDigits: dec });

  function calcZScores(values) {
    const valid = values.filter(v => v != null && !isNaN(v));
    if (valid.length < 2) return values.map(() => null);
    const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
    const std  = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length) || 1;
    return values.map(v => (v == null || isNaN(v)) ? null : (v - mean) / std);
  }

  function zClass(z) {
    if (z == null) return 'neu';
    if (z > 2)    return 'high';
    if (z > 1)    return 'mhigh';
    if (z > 0.5)  return 'warn';
    if (z > -0.5) return 'neu';
    if (z > -1)   return 'low';
    if (z > -2)   return 'mlow';
    return 'vlow';
  }

  // ── state ────────────────────────────────────────────────────
  const _st = { mc: '', date: '', sessionId: null, compareSessionId: null, compareMdCode: null, sortKey: 'player_name', sortDir: 1, highlightedRow: null };
  let _allSessions = [];
  let _lastReports = [];
  let _initialized  = false;
  let _scCurrentClubId = null;
  window._scState = _st; // expose for cards to read compareSessionId etc.

  // ── KPI chip state ────────────────────────────────────────────
  // _scKpiOverride[idx] = { key: metricKey, agg: 'avg'|'total'|'median'|'max'|'min' }
  const _scKpiOverride = {};

  // Peak metrics: sum/median make no sport sense → only avg/max/min offered
  const _SC_PEAK_KEYS = new Set(['max_speed','avg_speed','max_acceleration','max_deceleration','peak_speed']);

  const _SC_DEFAULT_CHIPS = [
    { key: 'total_distance',           unit: 'm',    dec: 0, agg: 'avg' },
    { key: 'high_speed_distance',      unit: 'm',    dec: 0, agg: 'avg' },
    { key: 'very_high_speed_distance', unit: 'm',    dec: 0, agg: 'avg' },
    { key: 'sprint_count',             unit: '',     dec: 1, agg: 'avg' },
    { key: 'acc_dec',                  unit: '',     dec: 1, agg: 'avg' },
    { key: 'player_load',              unit: 'AU',   dec: 1, agg: 'avg' },
    { key: 'max_speed',                unit: 'km/h', dec: 1, agg: 'max' },
  ];

  // Short names used in chip labels
  const _SC_METRIC_NAMES = {
    total_distance: 'Distance', high_speed_distance: 'HSR',
    very_high_speed_distance: 'VHSR', sprint_count: 'Sprints',
    sprint_distance: 'Sprints (m)', acc_dec: 'Acc+Dec',
    player_load: 'Load', max_speed: 'Speed', accelerations: 'Accels',
    decelerations: 'Decels', time_played: 'Time', avg_speed: 'Avg Speed', hmld: 'HMLD',
  };
  const _SC_AGG_LABELS = { avg: 'Avg', total: 'Total', median: 'Median', max: 'Max', min: 'Min' };

  function _scChipLabel(metricKey, agg) {
    const cat      = (window._gpCatalog || []).find(d => d.key === metricKey);
    const baseName = _SC_METRIC_NAMES[metricKey] || cat?.label || metricKey.replace(/_/g,' ');
    return `${_SC_AGG_LABELS[agg] || 'Avg'} ${baseName}`;
  }

  // Aggregations allowed for a given metric key
  function _scAllowedAggs(metricKey) {
    if (_SC_PEAK_KEYS.has(metricKey)) return ['avg','max','min'];
    return ['avg','total','median','max','min'];
  }

  // Sensible default aggregation for a metric
  function _scDefaultAgg(metricKey) {
    return _SC_PEAK_KEYS.has(metricKey) ? 'max' : 'avg';
  }

  function _scResolveChipDef(idx) {
    const ov = _scKpiOverride[idx];
    const base = _SC_DEFAULT_CHIPS[idx] || _SC_DEFAULT_CHIPS[0];
    if (!ov) return { ...base, label: _scChipLabel(base.key, base.agg) };
    // ov can be {key, agg} or legacy plain string
    const key = typeof ov === 'string' ? ov : ov.key;
    const agg = typeof ov === 'string' ? _scDefaultAgg(key) : (ov.agg || _scDefaultAgg(key));
    const cat = (window._gpCatalog || []).find(d => d.key === key);
    return {
      key,
      agg,
      label: _scChipLabel(key, agg),
      unit:  key === 'acc_dec' ? '' : (cat?.unit || ''),
      dec:   cat?.decimals ?? 0,
    };
  }

  function _scAggVal(reports, def) {
    if (!reports.length) return null;
    const vals = def.key === 'acc_dec'
      ? reports.map(r => (r.accelerations || 0) + (r.decelerations || 0))
      : reports.map(r => r[def.key]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    switch (def.agg) {
      case 'total':  return vals.reduce((s, v) => s + v, 0);
      case 'max':    return Math.max(...vals);
      case 'min':    return Math.min(...vals);
      case 'median': {
        const s = [...vals].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
      }
      default:       return vals.reduce((s, v) => s + v, 0) / vals.length; // avg
    }
  }

  // ── Table column state ────────────────────────────────────────
  const _SC_FIXED_COL = { key: 'player_name', label: 'Player' };
  const _SC_DEFAULT_METRIC_COLS = [
    { key: 'total_distance',           label: 'TD (m)',    dec: 0 },
    { key: 'high_speed_distance',      label: 'HSR (m)',   dec: 0 },
    { key: 'very_high_speed_distance', label: 'VHSR (m)',  dec: 0 },
    { key: 'sprint_count',             label: 'SPR',       dec: 0 },
    { key: 'accdec',                   label: 'Acc+Dec',   dec: 0, computed: r => (r.accelerations || 0) + (r.decelerations || 0) },
    { key: 'max_speed',                label: 'Max Spd',   dec: 1 },
    { key: 'player_load',              label: 'Load (AU)', dec: 1 },
    { key: 'time_played',              label: 'Min',       dec: 0 },
  ];
  let _scTableMetricCols = _SC_DEFAULT_METRIC_COLS.map(c => ({ ...c }));

  // ── DOM refs ─────────────────────────────────────────────────
  const sessSel   = document.getElementById('sc-sess-sel');
  const playerSel  = document.getElementById('sc-player-sel');
  const scInfo    = document.getElementById('sc-info');
  const kpiBody   = document.getElementById('sc-kpi-body');
  const tblBody   = document.getElementById('sc-table-body');
  const colorSel  = document.getElementById('sc-color-mode');

  if (!sessSel) return; // guard if grp view not present

  // ── init (called on first switch to grp tab) ──────────────────
  async function scInit() {
    if (_initialized) return;
    _initialized = true;
    try {
      const clubId = await window.getClubId?.();
      if (!clubId || !window.sb) { scInfo.textContent = tt('gps_analysis.not_connected','Not connected.'); return; }

      // Load persisted layout (KPI slots + table cols)
      await Promise.all([_scInitKpiSlots(), _scInitTableCols()]);

      // Load all sessions
      const { data: sessions } = await window.sb
        .from('training_sessions')
        .select('id, session_date, title, session_type, match_day_offset, session_attributes')
        .eq('club_id', clubId)
        .neq('session_type', 'rehab')
        .order('session_date', { ascending: false });

      _allSessions = sessions || [];
      window._scAllSessions = _allSessions;
      if (!_allSessions.length) { scInfo.textContent = tt('gps_analysis.no_sessions_found','No sessions found.'); return; }

      // Diagnóstico de datos MD
      const withMd = _allSessions.filter(s => _getMdCode(s) !== null).length;
      if (withMd === 0) console.warn('[SC] Todas las sesiones tienen match_day_offset y md_code en null — el indicador y la comparación saldrán vacíos por DATOS, no por UI.');
      else console.info(`[SC] ${withMd}/${_allSessions.length} sesiones con MD code.`);

      _scLoadCompareState();
      _buildAllSessionOptions();
      _buildMcOptions();

      const firstOpt = Array.from(sessSel.options).find(o => o.value);
      const firstSessId = firstOpt?.value || null;

      _buildCompareMdOptions(firstSessId);

      if (firstOpt) {
        sessSel.value = firstOpt.value;
        _st.sessionId = firstOpt.value;
        // Default compareMdCode to first session's MD if not persisted
        if (!_st.compareMdCode) {
          const sess = _allSessions.find(s => s.id === _st.sessionId);
          _st.compareMdCode = _getMdCode(sess) || null;
          const mdSel = document.getElementById('sc-compare-md-sel');
          if (mdSel && _st.compareMdCode) mdSel.value = _st.compareMdCode;
        }
        _buildCompareDateOptions();
        await _loadSessionData(_st.sessionId);
      }
    } catch (e) { console.error('scInit:', e); scInfo.textContent = tt('gps_analysis.error_loading_sessions','Error loading sessions.'); }
  }

  // List all sessions grouped by MC in a single <select>, ordered latest-first
  function _buildAllSessionOptions() {
    sessSel.innerHTML = '<option value="">Session...</option>';
    const mcGroups = new Map(); // MC label → sessions[]
    const noMc = [];
    for (const s of _allSessions) {
      const mc = s.title?.match?.(/MC\s*\d+/i)?.[0] || null;
      if (mc) {
        if (!mcGroups.has(mc)) mcGroups.set(mc, []);
        mcGroups.get(mc).push(s);
      } else {
        noMc.push(s);
      }
    }
    const addOpt = (s, parent) => {
      const o = document.createElement('option');
      o.value = s.id;
      const dateShort = s.session_date ? s.session_date.slice(5) : '??'; // MM-DD
      const mdCode = _getMdCode(s);
      o.textContent = mdCode ? `${dateShort} · ${mdCode}` : `${dateShort} · ${s.title || s.session_type || s.id.slice(0,8)}`;
      parent.appendChild(o);
    };
    for (const [mc, sessions] of mcGroups) {
      const grp = document.createElement('optgroup');
      grp.label = mc;
      sessions.forEach(s => addOpt(s, grp));
      sessSel.appendChild(grp);
    }
    if (noMc.length) {
      const grp = document.createElement('optgroup');
      grp.label = tt('gps_analysis.optgroup_other','Other');
      noMc.forEach(s => addOpt(s, grp));
      sessSel.appendChild(grp);
    }
  }

  // Extract MD code from a session object (match_day_offset has priority)
  function _getMdCode(s) {
    const off = s?.match_day_offset;
    if (off != null) {
      if (typeof off === 'string') return off || null;
      if (off === 0) return 'MD';
      return off < 0 ? `MD${off}` : `MD+${off}`;
    }
    return s?.session_attributes?.md_code || null;
  }


  // ── Compare state persistence ─────────────────────────────────
  const _SC_COMPARE_LS = 'sc_compare_state_v1';
  function _scSaveCompareState() {
    try { localStorage.setItem(_SC_COMPARE_LS, JSON.stringify({ compareMdCode: _st.compareMdCode, compareSessionId: _st.compareSessionId })); } catch {}
  }
  function _scLoadCompareState() {
    try {
      const s = JSON.parse(localStorage.getItem(_SC_COMPARE_LS) || '{}');
      if (s.compareMdCode)    _st.compareMdCode    = s.compareMdCode;
      if (s.compareSessionId) _st.compareSessionId = s.compareSessionId;
    } catch {}
  }

  // ── Microcycle filter ─────────────────────────────────────────
  function _buildMcOptions() {
    const mcSel = document.getElementById('sc-mc-sel');
    if (!mcSel) return;
    const mcs = [...new Set(_allSessions.map(s => s.title?.match?.(/MC\s*\d+/i)?.[0] || null).filter(Boolean))].sort();
    mcSel.innerHTML = '<option value="">Microcycle...</option>';
    mcs.forEach(mc => {
      const o = document.createElement('option');
      o.value = mc; o.textContent = mc;
      mcSel.appendChild(o);
    });
  }

  // Rebuild sessSel options filtered by MC ('' = all)
  function _buildSessionOptionsByMc(mc) {
    sessSel.innerHTML = '<option value="">Session...</option>';
    const source = (mc && mc !== '') ? _allSessions.filter(s => (s.title?.match?.(/MC\s*\d+/i)?.[0] || '') === mc) : _allSessions;
    const mcGroups = new Map(); const noMc = [];
    for (const s of source) {
      const label = s.title?.match?.(/MC\s*\d+/i)?.[0] || null;
      if (label) { if (!mcGroups.has(label)) mcGroups.set(label, []); mcGroups.get(label).push(s); }
      else noMc.push(s);
    }
    const addOpt = (s, parent) => {
      const o = document.createElement('option');
      o.value = s.id;
      const ds = s.session_date ? s.session_date.slice(5) : '??';
      const md = _getMdCode(s);
      o.textContent = md ? `${ds} · ${md}` : `${ds} · ${s.title || s.session_type || s.id.slice(0,8)}`;
      parent.appendChild(o);
    };
    for (const [mcLabel, sessions] of mcGroups) {
      const grp = document.createElement('optgroup'); grp.label = mcLabel;
      sessions.forEach(s => addOpt(s, grp)); sessSel.appendChild(grp);
    }
    if (noMc.length) {
      const grp = document.createElement('optgroup'); grp.label = 'Other';
      noMc.forEach(s => addOpt(s, grp)); sessSel.appendChild(grp);
    }
    if (_st.sessionId && sessSel.querySelector(`option[value="${_st.sessionId}"]`)) {
      sessSel.value = _st.sessionId;
    }
  }

  // ── Compare MD & date filters ─────────────────────────────────
  function _buildCompareMdOptions(sessionId) {
    const mdSel = document.getElementById('sc-compare-md-sel');
    if (!mdSel) return;
    const mds = [...new Set(_allSessions.map(s => _getMdCode(s)).filter(Boolean))].sort();
    mdSel.innerHTML = '<option value="">MD...</option>';
    mds.forEach(md => {
      const o = document.createElement('option');
      o.value = md; o.textContent = md;
      mdSel.appendChild(o);
    });
    // Default to session's MD if compareMdCode not set
    if (!_st.compareMdCode && sessionId) {
      const sess = _allSessions.find(s => s.id === sessionId);
      _st.compareMdCode = _getMdCode(sess) || null;
    }
    if (_st.compareMdCode) mdSel.value = _st.compareMdCode;
  }

  function _buildCompareDateOptions() {
    const dateSel = document.getElementById('sc-compare-date-sel');
    if (!dateSel) return;
    dateSel.innerHTML = '<option value="">Fecha...</option>';
    const mdCode = _st.compareMdCode;
    if (!mdCode) { _st.compareSessionId = null; return; }
    const currentSess = _st.sessionId ? _allSessions.find(s => s.id === _st.sessionId) : null;
    const candidates = _allSessions.filter(s =>
      s.id !== _st.sessionId &&
      _getMdCode(s) === mdCode &&
      (!currentSess || s.session_date < currentSess.session_date)
    );
    candidates.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.session_date || '—'} · ${s.title || mdCode}`;
      dateSel.appendChild(o);
    });
    if (_st.compareSessionId && dateSel.querySelector(`option[value="${_st.compareSessionId}"]`)) {
      dateSel.value = _st.compareSessionId;
    } else {
      _st.compareSessionId = null;
    }
  }

  // Render context indicator above the grid
  function _renderScIndicator(sessionId) {
    const indicator = document.getElementById('sc-indicator');
    const leftEl    = document.getElementById('sc-ind-left');
    const rightEl   = document.getElementById('sc-ind-right');
    if (!indicator || !leftEl || !rightEl) return;
    if (!sessionId) { indicator.style.display = 'none'; return; }
    const sess = _allSessions.find(s => s.id === sessionId);
    if (!sess) { indicator.style.display = 'none'; return; }
    const mdCode = _getMdCode(sess) || '—';
    const fecha  = sess.session_date || '—';
    const title  = sess.title || mdCode;
    leftEl.innerHTML = `Viendo: <b>${title}</b> · <b>${mdCode}</b> · ${fecha}`;
    if (_st.compareSessionId) {
      const cmpSess = _allSessions.find(s => s.id === _st.compareSessionId);
      const cmpDate = cmpSess?.session_date || _st.compareSessionId.slice(0,10);
      const cmpMd   = _getMdCode(cmpSess) || '';
      rightEl.innerHTML = `Comparando contra: <b>${cmpDate}${cmpMd ? ' · ' + cmpMd : ''}</b>`;
    } else {
      rightEl.innerHTML = '';
    }
    indicator.style.display = '';
  }

  function _buildCompareOptions(sessionId) {}

  // ── Fase 2b: restar períodos no-team del total de la sesión (top-up/rehab en la misma
  //    actividad), in-place, solo volumen. Una sola sesión → clave por player_id.
  const _SC_ADD_COLS = ['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','sprint_count','accelerations','decelerations','player_load','hmld','time_played'];
  async function _scSubtractNonTeamPeriods(rows, clubId, sessionId) {
    try {
      if (!rows || !rows.length || !sessionId) return;
      const { data: np } = await window.sb.from('gps_period_reports')
        .select('player_id,' + _SC_ADD_COLS.join(','))
        .eq('club_id', clubId).neq('work_context', 'team').eq('session_id', sessionId);
      if (!np || !np.length) return;
      const m = new Map();
      for (const p of np) { let a = m.get(p.player_id); if (!a) { a = {}; m.set(p.player_id, a); } for (const c of _SC_ADD_COLS) a[c] = (a[c] || 0) + (Number(p[c]) || 0); }
      for (const r of rows) { const s = m.get(r.player_id); if (!s) continue; for (const c of _SC_ADD_COLS) { if (r[c] == null) continue; const adj = Number(r[c]) - (s[c] || 0); r[c] = adj > 0 ? adj : 0; } }
    } catch (_e) { /* no romper la card por la resta */ }
  }

  // ── load session data ─────────────────────────────────────────
  async function _loadSessionData(sessionId) {
    if (!sessionId) return;
    scInfo.textContent = 'Loading...';
    if (kpiBody) kpiBody.innerHTML = '<div style="padding:20px;color:var(--cm-fg-muted)">Loading...</div>';
    if (tblBody) tblBody.innerHTML = '';

    try {
      const clubId = await window.getClubId?.();
      _scCurrentClubId = clubId;
      // Training context: default 'team' only (rehab/individual/top-up no ensucian la media de
      // la sesión de equipo); el filtro "Context" del bar lo puede ensanchar.
      const _wcSc = window.gpFilterBar?.getState?.().workContexts || [];
      const reports = await window.cmFetchAll(() => {
        let q = _scopeTeam(window.sb
          .from('gps_reports')
          .select('id, player_id, total_distance, high_speed_distance, very_high_speed_distance, sprint_distance, sprint_count, max_speed, accelerations, decelerations, player_load, time_played')
          .eq('club_id', clubId)
          .eq('is_invalid', false)
          .eq('session_id', sessionId));
        return _wcSc.length ? q.in('work_context', _wcSc) : q.eq('work_context', 'team');
      }, { label: 'session-report' })
        .catch(e => { console.error('[session report] query failed:', e); return []; });

      // Fase 2b: restar los períodos no-team (top-up/rehab en la misma actividad) del total de
      // esta sesión, para que no ensucien la media de equipo. Solo volumen (aditivas).
      await _scSubtractNonTeamPeriods(reports, clubId, sessionId);

      const { data: players } = await _gpRoster(clubId, window._gpTeamId);

      const playerMap = Object.fromEntries((players || []).map(p => [p.id, p]));
      _lastReports = (reports || []).map(r => ({ ...r, player: playerMap[r.player_id] || {} }));

      const sess = _allSessions.find(s => s.id === sessionId);
      scInfo.textContent = `${sess?.session_date || ''} · ${_lastReports.length} players`;

      // populate player selector
      const prevPlayerId = playerSel?.value;
      if (playerSel) {
        playerSel.innerHTML = '<option value="">Player...</option>';
        [..._lastReports]
          .sort((a, b) => {
            const an = `${a.player.last_name || ''} ${a.player.first_name || ''}`;
            const bn = `${b.player.last_name || ''} ${b.player.first_name || ''}`;
            return an.localeCompare(bn);
          })
          .forEach(r => {
            const p = r.player;
            const name = (p.first_name || p.last_name) ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : r.player_id.slice(0, 8);
            const o = document.createElement('option');
            o.value = r.player_id;
            o.textContent = `${name}${p.number ? ' #' + p.number : ''}`;
            playerSel.appendChild(o);
          });
        // keep previous selection if still present, else auto-select first
        if (prevPlayerId && playerSel.querySelector(`option[value="${prevPlayerId}"]`)) {
          playerSel.value = prevPlayerId;
        } else if (_lastReports.length > 0) {
          playerSel.selectedIndex = 1;
        }
      }

      _buildCompareOptions(sessionId);
      _renderKPIs(_lastReports);
      _renderTable(_lastReports);
      _renderScIndicator(sessionId);
      await annotateScKpiCards();
      // Notify dependent cards that a session has loaded (works for both manual and auto-selection)
      window._ztRender?.();
      window._scOutliersRender?.();
      window._vsReload?.();
    } catch (e) { console.error('_loadSessionData:', e); scInfo.textContent = tt('gps_analysis.error_loading_data','Error loading data.'); }
  }

  // ── render KPIs (chip-based, metric-swappable) ───────────────
  function _renderKPIs(reports) {
    if (!kpiBody) return;   // card eliminada (genérica) → no-op
    if (!reports.length) { kpiBody.innerHTML = '<div style="padding:20px;color:var(--cm-fg-muted)">No data for this session.</div>'; return; }
    try {
      const chips = _SC_DEFAULT_CHIPS.map((_, idx) => {
        const def = _scResolveChipDef(idx);
        const val = _scAggVal(reports, def);
        const txt = val != null ? fmt(val, def.dec) : '—';
        return `<div class="pw-kpi" data-kpi-idx="${idx}" data-metric-key="${def.key}">
          <span class="k-label">${def.label}</span>
          <span class="k-val">${txt}${def.unit ? `<sub>${def.unit}</sub>` : ''}</span>
          <button class="pw-kpi-menu-btn" title="Change metric"><i class="ti ti-dots-vertical"></i></button>
        </div>`;
      });
      kpiBody.innerHTML = `<div class="pw-kpis">${chips.join('')}</div>`;
    } catch (e) { console.error('_renderKPIs (SC):', e); }
  }

  // ── render table (dynamic columns) ──────────────────────────
  function _renderTable(reports) {
    if (!tblBody) return;   // card eliminada (genérica) → no-op
    if (!reports.length) { tblBody.innerHTML = '<div style="padding:20px;color:var(--cm-fg-muted)">No player data.</div>'; return; }
    try {
    const colorMode  = colorSel?.value || 'zscore';
    const activeCols = [_SC_FIXED_COL, ..._scTableMetricCols];

    // z-scores per metric column
    const colZScores = {};
    _scTableMetricCols.forEach(col => {
      const vals = reports.map(r => col.computed ? col.computed(r) : r[col.key]);
      colZScores[col.key] = calcZScores(vals);
    });

    // sort
    const sorted = [...reports].sort((a, b) => {
      if (_st.sortKey === 'player_name') {
        const an = `${a.player.last_name || ''} ${a.player.first_name || ''}`;
        const bn = `${b.player.last_name || ''} ${b.player.first_name || ''}`;
        return an.localeCompare(bn) * _st.sortDir;
      }
      const col = _scTableMetricCols.find(c => c.key === _st.sortKey);
      const av  = col?.computed ? col.computed(a) : a[_st.sortKey];
      const bv  = col?.computed ? col.computed(b) : b[_st.sortKey];
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * _st.sortDir;
    });

    const rows = sorted.map(r => {
      const origIdx = reports.indexOf(r);
      const p = r.player;
      const name     = p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '—';
      const initials = `${(p.first_name || '')[0] || ''}${(p.last_name || '')[0] || ''}`.toUpperCase();
      const pos = p.position || '';
      const num = p.number ? `#${p.number}` : '';
      const isHL = r.player_id === _st.highlightedRow;

      const cells = _scTableMetricCols.map(col => {
        const rawVal = col.computed ? col.computed(r) : r[col.key];
        const z      = colZScores[col.key]?.[origIdx];
        const zCls   = colorMode === 'zscore' ? zClass(z) : 'neu';
        const txt    = rawVal != null ? fmt(rawVal, col.dec ?? 0) : '—';
        return `<td><span class="sc-zc ${zCls}">${txt}</span></td>`;
      }).join('');

      return `<tr data-player-id="${r.player_id}" class="${isHL ? 'is-highlighted' : ''}" style="cursor:pointer">
        <td><div class="sc-player-cell"><div class="gp-mav">${initials}</div><div><div style="font-weight:600">${name}</div><div style="font-size:10.5px;color:var(--cm-fg-muted)">${pos}${pos && num ? ' · ' : ''}${num}</div></div></div></td>
        ${cells}
      </tr>`;
    }).join('');

    const headers = activeCols.map(c => {
      const isSorted = _st.sortKey === c.key;
      return `<th class="${isSorted ? 'is-sort' : ''}" data-key="${c.key}">${c.label}${isSorted ? (_st.sortDir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
    }).join('');

    tblBody.innerHTML = `<table class="sc-tbl"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;

    tblBody.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        if (_st.sortKey === k) _st.sortDir *= -1; else { _st.sortKey = k; _st.sortDir = -1; }
        _renderTable(_lastReports);
      });
    });

    tblBody.querySelectorAll('tr[data-player-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        _st.highlightedRow = _st.highlightedRow === tr.dataset.playerId ? null : tr.dataset.playerId;
        _renderTable(_lastReports);
      });
    });
    } catch (e) { console.error('_renderTable (SC):', e); }
  }

  // ── SC KPI: change-metric + agg popup (reuses pw-km-popup CSS) ─
  let _scKmPopup = null;
  let _scKmTargetIdx = -1;

  function _scShowKmPopup(idx, anchorEl) {
    _scCloseKmPopup();
    _scKmTargetIdx = idx;
    const catalog = window._gpCatalog || [];
    if (!catalog.length) { showToast('Catalog not loaded yet'); return; }

    const def        = _scResolveChipDef(idx);
    const currentKey = def.key;
    const currentAgg = def.agg;
    const allowed    = _scAllowedAggs(currentKey);

    const popup = document.createElement('div');
    popup.className = 'pw-km-popup';
    popup.style.minWidth = '220px';

    // Section 1 — Aggregation
    const aggHTML = `<div class="pw-km-popup-hd">Aggregation</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;padding:4px 6px 8px">
        ${allowed.map(a =>
          `<button class="sc-agg-btn${a === currentAgg ? ' is-on' : ''}" data-agg="${a}"
            style="flex:1;min-width:52px;height:24px;border-radius:4px;border:1px solid var(--cm-border);
            background:${a === currentAgg ? 'var(--cm-accent-soft)' : 'transparent'};
            color:${a === currentAgg ? 'var(--cm-fg-strong)' : 'var(--cm-fg-muted)'};
            font:600 11px/1 var(--cm-font-mono);cursor:pointer;padding:0 4px">
            ${_SC_AGG_LABELS[a]}
          </button>`
        ).join('')}
      </div>`;

    // Section 2 — Metric
    const metricHTML = `<div class="pw-km-popup-hd" style="border-top:1px solid var(--cm-border-soft);padding-top:8px;margin-top:2px">Metric</div>` +
      catalog.map(d =>
        `<div class="pw-km-item${d.key === currentKey ? ' is-on' : ''}" data-key="${d.key}">
          ${d.label}<span class="km-tag">${d.unit || ''}</span>
        </div>`
      ).join('');

    popup.innerHTML = aggHTML + metricHTML;
    document.body.appendChild(popup);
    _scKmPopup = popup;

    const rect = anchorEl.getBoundingClientRect();
    popup.style.top  = `${rect.bottom + 4}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 230)}px`;

    popup.addEventListener('click', async e => {
      const aggBtn = e.target.closest('[data-agg]');
      if (aggBtn) { await _scSelectAgg(_scKmTargetIdx, aggBtn.dataset.agg); _scCloseKmPopup(); return; }
      const item = e.target.closest('.pw-km-item[data-key]');
      if (item) { await _scSelectMetric(_scKmTargetIdx, item.dataset.key); _scCloseKmPopup(); }
    });

    setTimeout(() => document.addEventListener('click', _scKmOutside, { once: true }), 0);
  }

  function _scKmOutside(e) { if (_scKmPopup && !_scKmPopup.contains(e.target)) _scCloseKmPopup(); }
  function _scCloseKmPopup() {
    _scKmPopup?.remove(); _scKmPopup = null;
    document.removeEventListener('click', _scKmOutside);
  }

  // Change aggregation only, keep current metric
  async function _scSelectAgg(idx, agg) {
    const prev = _scKpiOverride[idx];
    const key  = typeof prev === 'object' ? prev.key
               : typeof prev === 'string' ? prev
               : _SC_DEFAULT_CHIPS[idx]?.key;
    _scKpiOverride[idx] = { key, agg };
    await _scRefreshChip(idx);
    _scSaveKpiSlots();
  }

  // Change metric, pick sensible default agg
  async function _scSelectMetric(idx, metricKey) {
    const prev = _scKpiOverride[idx];
    const oldAgg = typeof prev === 'object' ? prev.agg : _scDefaultAgg(metricKey);
    // If prev agg is still valid for new metric, keep it; otherwise reset to sensible default
    const agg = _scAllowedAggs(metricKey).includes(oldAgg) ? oldAgg : _scDefaultAgg(metricKey);
    _scKpiOverride[idx] = { key: metricKey, agg };
    await _scRefreshChip(idx);
    _scSaveKpiSlots();
  }

  // Recompute + update a single chip DOM element
  async function _scRefreshChip(idx) {
    const chip = kpiBody.querySelector(`[data-kpi-idx="${idx}"]`);
    if (!chip) return;
    const def = _scResolveChipDef(idx);
    let val = null;
    const cat    = (window._gpCatalog || []).find(d => d.key === def.key);
    const isCore = !cat || cat.is_core || def.key === 'acc_dec';
    if (isCore) {
      val = _scAggVal(_lastReports, def);
    } else {
      const reportIds = _lastReports.map(r => r.id).filter(Boolean);
      if (reportIds.length && _scCurrentClubId) {
        try {
          const { data: eav } = await window.sb
            .from('gps_report_metrics').select('value')
            .in('report_id', reportIds).eq('metric_key', def.key).eq('club_id', _scCurrentClubId);
          const vals = (eav || []).map(r => +r.value || 0).filter(v => !isNaN(v));
          if (vals.length) {
            // use same aggregation logic on raw vals array
            const fakeReports = vals.map(v => ({ [def.key]: v }));
            val = _scAggVal(fakeReports, def);
          }
        } catch { val = null; }
      }
    }
    chip.dataset.metricKey = def.key;
    chip.querySelector('.k-label').textContent = def.label;
    chip.querySelector('.k-val').innerHTML = `${val != null ? fmt(val, def.dec) : '—'}${def.unit ? `<sub>${def.unit}</sub>` : ''}`;
  }

  kpiBody?.addEventListener('click', e => {
    const btn = e.target.closest('.pw-kpi-menu-btn');
    if (!btn) return;
    e.stopPropagation();
    const chip = btn.closest('[data-kpi-idx]');
    if (chip) _scShowKmPopup(+chip.dataset.kpiIdx, btn);
  });

  // ── SC table: column panel ─────────────────────────────────────
  let _scColPanel  = null;
  let _scColDragSrc = null;

  function _scOpenColPanel() {
    if (_scColPanel) { _scCloseColPanel(); return; }
    document.getElementById('sc-col-btn')?.classList.add('is-open');
    const catalog    = window._gpCatalog || [];
    const activeKeys = new Set(_scTableMetricCols.map(c => c.key));

    const available = [
      { key: 'accdec', label: 'Acc+Dec', group: 'core' },
      ...catalog.map(d => ({
        key: d.key, label: `${d.label}${d.unit ? ' ('+d.unit+')' : ''}`, group: d.is_core ? 'core' : 'custom',
      })),
    ].filter(d => !activeKeys.has(d.key));

    const byGroup = g => available.filter(d => d.group === g);

    const renderActive = () => [
      `<div class="pw-col-item is-fixed">
        <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
        <span class="col-lbl">Player</span><span class="col-tag">fixed</span>
      </div>`,
      ..._scTableMetricCols.map((c, i) =>
        `<div class="pw-col-item" draggable="true" data-col-idx="${i}">
          <i class="ti ti-grip-vertical drag-h"></i>
          <span class="col-lbl">${c.label}</span>
          <span class="col-tag"></span>
          <button class="col-rm" data-rm-idx="${i}" title="Remove"><i class="ti ti-x" style="font-size:10px"></i></button>
        </div>`),
    ].join('');

    const renderAvailGroup = (items, title) => !items.length ? '' : `
      <div class="pw-col-sect">${title}</div>
      ${items.map(d =>
        `<div class="pw-col-item" data-add-key="${d.key}" data-add-label="${d.label}">
          <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
          <span class="col-lbl">${d.label}</span>
          <button class="col-add" title="Add column"><i class="ti ti-plus" style="font-size:10px"></i></button>
        </div>`).join('')}`;

    const panel = document.createElement('div');
    panel.className = 'pw-col-panel';
    panel.id = 'sc-col-panel-el';
    panel.innerHTML = `
      <div class="pw-col-ph">
        <span class="ttl">Table columns</span>
        <button class="x-btn" id="sc-col-x"><i class="ti ti-x"></i></button>
      </div>
      <div class="pw-col-body" id="sc-col-body">
        <div class="pw-col-sect">Active columns</div>
        <div id="sc-col-active">${renderActive()}</div>
        <div class="pw-col-sect" style="margin-top:10px">Add column</div>
        ${renderAvailGroup(byGroup('core'),   'Core metrics')}
        ${renderAvailGroup(byGroup('custom'), 'Custom metrics')}
      </div>
      <div class="pw-col-footer">
        <button class="btn-reset" id="sc-col-reset">Reset</button>
        <button class="btn-save"  id="sc-col-save">Save &amp; apply</button>
      </div>`;

    document.body.appendChild(panel);
    _scColPanel = panel;

    const btn  = document.getElementById('sc-col-btn');
    const rect = btn?.getBoundingClientRect();
    if (rect) {
      const panelW = 272, vw = window.innerWidth, margin = 8;
      const left = Math.max(margin, Math.min(rect.right - panelW, vw - panelW - margin));
      const maxH = Math.max(200, window.innerHeight - rect.bottom - 12);
      panel.style.top       = `${rect.bottom + 6}px`;
      panel.style.left      = `${left}px`;
      panel.style.maxHeight = `min(80vh, ${maxH}px)`;
    }

    _scBindColPanel(panel);
    setTimeout(() => document.addEventListener('click', _scColOutside, { once: true }), 0);
  }

  function _scBindColPanel(panel) {
    panel.addEventListener('click', e => {
      const rmBtn = e.target.closest('[data-rm-idx]');
      if (rmBtn) {
        e.stopPropagation();
        _scTableMetricCols.splice(+rmBtn.dataset.rmIdx, 1);
        _scRefreshColPanel(); return;
      }
      const addEl = e.target.closest('[data-add-key]');
      if (addEl) {
        e.stopPropagation();
        _scTableMetricCols.push({ key: addEl.dataset.addKey, label: addEl.dataset.addLabel, dec: 0 });
        _scRefreshColPanel(); return;
      }
      if (e.target.closest('#sc-col-x')) { _scCloseColPanel(); return; }
      if (e.target.closest('#sc-col-save')) {
        _scSaveTableCols();
        if (_lastReports.length) _renderTable(_lastReports);
        _scCloseColPanel(); return;
      }
      if (e.target.closest('#sc-col-reset')) {
        e.stopPropagation();
        _scTableMetricCols = _SC_DEFAULT_METRIC_COLS.map(c => ({ ...c }));
        _scRefreshColPanel(); return;
      }
    });

    panel.addEventListener('dragstart', e => {
      const item = e.target.closest('[draggable][data-col-idx]');
      if (!item) return;
      _scColDragSrc = +item.dataset.colIdx;
      item.classList.add('dragging');
    });
    panel.addEventListener('dragend', e => {
      e.target.closest('[draggable]')?.classList.remove('dragging');
      panel.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    panel.addEventListener('dragover', e => {
      e.preventDefault();
      const item = e.target.closest('[draggable][data-col-idx]');
      if (!item || +item.dataset.colIdx === _scColDragSrc) return;
      panel.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    panel.addEventListener('drop', e => {
      e.preventDefault();
      const item = e.target.closest('[draggable][data-col-idx]');
      if (!item) return;
      const dst = +item.dataset.colIdx;
      if (_scColDragSrc === dst) return;
      const moved = _scTableMetricCols.splice(_scColDragSrc, 1)[0];
      _scTableMetricCols.splice(dst, 0, moved);
      _scColDragSrc = null;
      _scRefreshColPanel();
    });
  }

  function _scRefreshColPanel() {
    if (!_scColPanel) return;
    const catalog    = window._gpCatalog || [];
    const activeKeys = new Set(_scTableMetricCols.map(c => c.key));
    const available  = [
      { key: 'accdec', label: 'Acc+Dec', group: 'core' },
      ...catalog.map(d => ({ key: d.key, label: `${d.label}${d.unit ? ' ('+d.unit+')' : ''}`, group: d.is_core ? 'core' : 'custom' })),
    ].filter(d => !activeKeys.has(d.key));
    const byGroup = g => available.filter(d => d.group === g);

    const activeEl = _scColPanel.querySelector('#sc-col-active');
    if (activeEl) activeEl.innerHTML = [
      `<div class="pw-col-item is-fixed"><i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i><span class="col-lbl">Player</span><span class="col-tag">fixed</span></div>`,
      ..._scTableMetricCols.map((c, i) =>
        `<div class="pw-col-item" draggable="true" data-col-idx="${i}">
          <i class="ti ti-grip-vertical drag-h"></i>
          <span class="col-lbl">${c.label}</span><span class="col-tag"></span>
          <button class="col-rm" data-rm-idx="${i}" title="Remove"><i class="ti ti-x" style="font-size:10px"></i></button>
        </div>`),
    ].join('');

    const renderAvailGroup = (items, title) => !items.length ? '' : `
      <div class="pw-col-sect">${title}</div>
      ${items.map(d =>
        `<div class="pw-col-item" data-add-key="${d.key}" data-add-label="${d.label}">
          <i class="ti ti-grip-vertical drag-h" style="visibility:hidden"></i>
          <span class="col-lbl">${d.label}</span>
          <button class="col-add" title="Add"><i class="ti ti-plus" style="font-size:10px"></i></button>
        </div>`).join('')}`;

    const body = _scColPanel.querySelector('#sc-col-body');
    const activeNode = body.querySelector('#sc-col-active');
    while (activeNode.nextSibling) activeNode.nextSibling.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = `<div class="pw-col-sect" style="margin-top:10px">Add column</div>
      ${renderAvailGroup(byGroup('core'), 'Core metrics')}
      ${renderAvailGroup(byGroup('custom'), 'Custom metrics')}`;
    while (tmp.firstChild) body.appendChild(tmp.firstChild);
  }

  function _scCloseColPanel() {
    _scColPanel?.remove(); _scColPanel = null;
    document.getElementById('sc-col-btn')?.classList.remove('is-open');
    document.removeEventListener('click', _scColOutside);
  }

  function _scColOutside(e) {
    if (_scColPanel && !_scColPanel.contains(e.target) && !e.target.closest('#sc-col-btn')) _scCloseColPanel();
  }

  document.getElementById('sc-col-btn')?.addEventListener('click', e => {
    e.stopPropagation(); _scOpenColPanel();
  });

  // ── SC layout load / save ─────────────────────────────────────
  async function _scInitKpiSlots() {
    try {
      const layout = await loadLayout('grp');
      const card = layout?.find(c => c.card_id === 'session-kpi');
      if (card?.config?.kpi_overrides) Object.assign(_scKpiOverride, card.config.kpi_overrides);
    } catch (e) { console.warn('_scInitKpiSlots:', e); }
  }

  function _scSaveKpiSlots() {
    const cardEl = document.getElementById('card-session-kpi');
    if (cardEl) cardEl.dataset.config = JSON.stringify({ kpi_overrides: _scKpiOverride });
    saveLayout('grp');
  }

  async function _scInitTableCols() {
    try {
      const layout = await loadLayout('grp');
      const card = layout?.find(c => c.card_id === 'session-table');
      if (card?.config?.columns?.length) { _scTableMetricCols = card.config.columns; return; }
    } catch (e) { console.warn('_scInitTableCols:', e); }
    _scTableMetricCols = _SC_DEFAULT_METRIC_COLS.map(c => ({ ...c }));
  }

  function _scSaveTableCols() {
    const cardEl = document.getElementById('card-session-table');
    if (cardEl) cardEl.dataset.config = JSON.stringify({ columns: _scTableMetricCols });
    saveLayout('grp');
  }

  // ── filter event listeners ────────────────────────────────────
  sessSel.addEventListener('change', () => {
    _st.sessionId = sessSel.value || null;
    if (_st.sessionId) {
      // When session changes, reset compare MD to the new session's MD (spec default)
      const sess = _allSessions.find(s => s.id === _st.sessionId);
      const mdCode = sess ? _getMdCode(sess) : null;
      _st.compareMdCode    = mdCode;
      _st.compareSessionId = null;
      const mdSel = document.getElementById('sc-compare-md-sel');
      if (mdSel) mdSel.value = mdCode || '';
      _buildCompareDateOptions();
      _scSaveCompareState();
      _loadSessionData(_st.sessionId);
    }
  });

  document.getElementById('sc-mc-sel')?.addEventListener('change', () => {
    const mc = document.getElementById('sc-mc-sel')?.value || '';
    _buildSessionOptionsByMc(mc);
  });

  document.getElementById('sc-compare-md-sel')?.addEventListener('change', () => {
    _st.compareMdCode    = document.getElementById('sc-compare-md-sel')?.value || null;
    _st.compareSessionId = null;
    _buildCompareDateOptions();
    _scSaveCompareState();
    _renderScIndicator(_st.sessionId);
    window._scOutliersRender?.();
  });

  document.getElementById('sc-compare-date-sel')?.addEventListener('change', () => {
    _st.compareSessionId = document.getElementById('sc-compare-date-sel')?.value || null;
    _scSaveCompareState();
    _renderScIndicator(_st.sessionId);
    window._scOutliersRender?.();
  });

  colorSel?.addEventListener('change', () => { if (_lastReports.length) _renderTable(_lastReports); });

  playerSel?.addEventListener('change', () => { annotateScKpiCards(); });

  // ── annotate player vs baseline KPI cards ─────────────────────
  async function annotateScKpiCards() {
    const SC_KPI_MAP = [
      { cardId: 'sc-kpi-distance', metric: 'total_distance',     icon: 'ti-route', unit: 'm',  decimals: 0, divisor: 1 },
      { cardId: 'sc-kpi-hsr',     metric: 'high_speed_distance',  icon: 'ti-bolt',  unit: 'm',  decimals: 0, divisor: 1 },
      { cardId: 'sc-kpi-sprints', metric: 'sprint_distance',      icon: 'ti-flame', unit: 'm',  decimals: 0, divisor: 1 },
    ];

    const playerId = playerSel?.value;
    if (!playerId || !_lastReports.length) {
      SC_KPI_MAP.forEach(({ cardId }) => {
        const kpi = document.querySelector(`.gp-view[data-view="grp"] .gp-c[data-card-id="${cardId}"] .gp-kpi`);
        if (!kpi) return;
        const vEl = kpi.querySelector('.v'); if (vEl) vEl.innerHTML = '—';
        const tEl = kpi.querySelector('.t'); if (tEl) tEl.innerHTML = '';
        const bl = kpi.querySelector('.gp-bl-line'); if (bl) bl.innerHTML = '';
      });
      return;
    }

    const rpt = _lastReports.find(r => r.player_id === playerId);
    if (!rpt) return;

    const clubId = await window.getClubId?.();
    if (!clubId || typeof window.getMatchBaseline !== 'function') return;

    for (const { cardId, metric, unit, decimals, divisor } of SC_KPI_MAP) {
      const card = document.querySelector(`.gp-view[data-view="grp"] .gp-c[data-card-id="${cardId}"]`);
      if (!card) continue;
      const kpi = card.querySelector('.gp-kpi');
      if (!kpi) continue;

      const rawVal  = rpt[metric] ?? null;
      const dispVal = rawVal != null ? rawVal / divisor : null;

      const vEl = kpi.querySelector('.v');
      if (vEl) {
        if (dispVal == null) {
          vEl.innerHTML = '—';
        } else {
          const formatted = decimals === 0 ? Math.round(dispVal).toLocaleString('en') : dispVal.toFixed(decimals);
          vEl.innerHTML = `${formatted} <sub>${unit}</sub>`;
        }
      }

      const bl = await window.getMatchBaseline(playerId, metric, clubId);

      const tEl = kpi.querySelector('.t');
      if (tEl && rawVal != null && bl?.baseline) {
        const pct   = (rawVal - bl.baseline) / bl.baseline * 100;
        const sqVals = _lastReports.map(r => +(r[metric] || 0)).filter(v => v > 0);
        const mu    = sqVals.length ? sqVals.reduce((a, b) => a + b, 0) / sqVals.length : rawVal;
        const sig   = sqVals.length > 1
          ? Math.sqrt(sqVals.map(v => (v - mu) ** 2).reduce((a, b) => a + b, 0) / sqVals.length) || 1
          : 1;
        const z     = (rawVal - mu) / sig;
        const pSign = pct >= 0 ? '+' : '';
        const zSign = z   >= 0 ? '+' : '';
        const cls   = Math.abs(z) > 1.5 ? 'warn' : pct >= 0 ? 'up' : 'down';
        const arrow = pct >= 0 ? 'ti-arrow-up-right' : 'ti-arrow-down-right';
        const flag  = Math.abs(z) >= 2 ? ` <span style="color:var(--cm-danger);font-weight:600">flag</span>` : '';
        tEl.innerHTML = `<span class="d ${cls}"><i class="ti ${arrow}"></i>${pSign}${Math.round(pct)}%</span> · z = ${zSign}${z.toFixed(1)}${flag}`;
      } else if (tEl) {
        tEl.innerHTML = '';
      }

      let blLine = kpi.querySelector('.gp-bl-line');
      if (!blLine) {
        blLine = document.createElement('div');
        blLine.className = 'gp-bl-line';
        blLine.style.cssText = 'font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:5px;display:flex;align-items:center;gap:4px';
        kpi.querySelector('.t')?.after(blLine);
      }
      if (bl?.baseline) {
        const blRaw  = divisor === 1000 ? bl.baseline / 1000 : bl.baseline;
        const blDisp = decimals === 0 ? Math.round(blRaw) : blRaw.toFixed(decimals);
        const conf   = bl.confidence === 'high' ? '✓' : '~';
        blLine.title = 'Baseline: avg of best matches · Miguel et al. 2022';
        blLine.innerHTML = `<i class="ti ti-target" style="font-size:10px"></i>Baseline ${blDisp}${unit ? ' ' + unit : ''} ${conf} (${bl.count} matches)`;
      } else if (bl?.warning) {
        blLine.innerHTML = `<i class="ti ti-info-circle" style="font-size:10px;color:var(--cm-warning)"></i>${bl.warning}`;
      } else {
        blLine.innerHTML = '';
      }
    }
  }

  // ── hook into tab switch ──────────────────────────────────────
  window._scInit = scInit;

  document.getElementById('sections')?.addEventListener('click', e => {
    const b = e.target.closest('.gp-sec[data-view="grp"]');
    if (b) setTimeout(scInit, 0);
  });

  // also auto-init if grp is the active view on load
  if (document.querySelector('.gp-view[data-view="grp"].is-on')) scInit();
})();
