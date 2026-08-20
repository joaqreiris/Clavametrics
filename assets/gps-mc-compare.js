// ══════════════════════════════════════════════════════════════
// Microcycle Compare (vista mc) — diff table + shape + monotony + exposure + movers.
// Extraído de GPS Analysis.html sin cambios de comportamiento. Cargado como <script src>
// PLANO en la misma posición del documento → mismo timing de ejecución que el inline
// original (auto-wire de gpfilter:change y click en la tab mc sobre #sections, que ya
// existe en esa posición). IIFE autocontenido: solo expone window._mcInit (sin consumidores
// externos); usa GpBuilder/gpsACWR/sb en runtime.
// ══════════════════════════════════════════════════════════════
(function () {
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmtN   = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en', { maximumFractionDigits: d });
  const fmtPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  function diffCls(pct) {
    if (pct == null) return 'd-neu';
    if (pct > 20)   return 'd-vup';
    if (pct > 5)    return 'd-up';
    if (pct > -5)   return 'd-neu';
    if (pct > -20)  return 'd-dn';
    return 'd-vdn';
  }

  function calcDiff(curr, ref) {
    if (curr == null || ref == null || ref === 0) return null;
    return (curr - ref) / ref * 100;
  }


  // ── METRIC definitions ────────────────────────────────────────
  const MC_METRICS = [
    { key: 'total_distance',          label: 'Total Distance', unit: 'm'  },
    { key: 'high_speed_distance',     label: 'HSR',            unit: 'm'  },
    { key: 'sprint_distance',         label: 'Sprint Dist',    unit: 'm'  },
    { key: 'player_load',             label: 'Player Load',    unit: 'AU' },
    { key: 'sprint_count',            label: 'Sprints',        unit: ''   },
  ];

  // ── state & DOM ──────────────────────────────────────────────
  const _mc = { scatterChart: null };
  let _mcInited   = false;
  let _mcSessions = []; // all sessions for club
  let _playerMap  = {};
  let _mcMicros   = {}; // id → microcycle row
  let _mcSortKey  = 'diff_pct'; let _mcSortDir = -1;

  // Filtros viejos del dashboard (mc-md-code / mc-scope / mc-metric / Load / mc-info)
  // eliminados: la barra de desplegables (gpFilterBar) es la ÚNICA fuente de filtrado.
  // mcInfo queda como sink detached para no romper los mensajes de estado de _mcLoad.
  const mcInfo     = document.getElementById('mc-info') || document.createElement('span');
  const metricBody = document.getElementById('mc-metric-body');
  // "MC diff table" la dibuja el motor unificado (builder) en #mc-table-body; este ref
  // queda como sink detached para que los mensajes de loading/error de _mcLoad NO
  // pisen el render de la card del builder.
  const tableBody  = document.createElement('div');
  const scatCanvas = document.getElementById('canvasMCScatter');
  if (!document.querySelector('.gp-view[data-view="mc"] .gp-grid')) return;

  // ── init — build session index once ──────────────────────────
  async function mcInit() {
    if (_mcInited) return;
    _mcInited = true;
    try {
      const clubId = await window.getClubId?.();
      if (!clubId || !window.sb) return;
      // No filtramos sesiones por team_id (las importadas por GPS suelen tenerlo null);
      // el scope de equipo lo dan el roster (_scopeTeam sobre gps_reports) y los
      // microciclos, que sí están acotados por team_id al equipo activo.
      let _mcQ = window.sb.from('microcycles').select('id,name,start_date,end_date,match_date,rival,season_id,team_id')
        .eq('club_id', clubId);
      if (window._gpTeamId) _mcQ = _mcQ.eq('team_id', window._gpTeamId);   // solo microciclos del equipo activo
      const [{ data: sessions }, { data: players }, { data: microcycles }] = await Promise.all([
        window.sb.from('training_sessions')
          .select('id,session_date,session_type,title,match_day_offset,session_attributes,microcycle_id')
          .eq('club_id', clubId).neq('session_type', 'rehab')
          .order('session_date', { ascending: true }),
        _gpRoster(clubId, window._gpTeamId),
        _mcQ.order('start_date', { ascending: true }),
      ]);
      _mcSessions = sessions || [];
      _playerMap  = Object.fromEntries((players || []).map(p => [p.id, p]));
      _mcMicros   = Object.fromEntries((microcycles || []).map(m => [m.id, m]));
      mcInfo.textContent = `${_mcSessions.length} sessions indexed.`;
    } catch (e) { console.error('mcInit:', e); }
  }

  // ── MD code from a session (match_day_offset first, then session_attributes) ──
  function _getMcMdCode(s) {
    const off = s?.match_day_offset;
    if (off != null) {
      if (typeof off === 'string') return off || null;
      if (off === 0) return 'MD';
      return off < 0 ? `MD${off}` : `MD+${off}`;
    }
    return s?.session_attributes?.md_code || null;
  }

  // ── Build index grouped by real microcycle ─────────────────────
  function _buildMcIndex() {
    // GPS-imported sessions carry no microcycle_id (the import wizard never links
    // them), so bucket each session into the microcycle whose [start_date, end_date]
    // contains its session_date. Sessions that already have the FK (Daily Planning)
    // keep it, so linked behaviour is untouched.
    // Scope a la temporada activa (nunca mezclar con temporadas pasadas).
    const _fbDate = (window.gpFilterBar?.getState?.() || {}).date || {};
    const _seasonActive = !!(_fbDate.seasonId || _fbDate.preset === 'season' || _fbDate.preset === 'currentSeason');
    const _sId = _fbDate.seasonId || null, _sFrom = _seasonActive ? (_fbDate.from || null) : null, _sTo = _seasonActive ? (_fbDate.to || null) : null;
    const _inSeason = (m) => {
      if (!_seasonActive) return true;
      if (_sId && m.season_id) return m.season_id === _sId;
      // Solapamiento con la ventana de temporada (no contención): un microciclo puede
      // empezar días antes del inicio oficial (pretemporada) y pertenecer igual.
      return (!_sFrom || m.end_date >= _sFrom) && (!_sTo || m.start_date <= _sTo);
    };
    // Guard contra la race de mcInit (microciclos de otros equipos si _gpTeamId no estaba listo).
    const _teamId = window._gpTeamId || null;
    const _inTeam = (m) => !_teamId || !m.team_id || m.team_id === _teamId;
    const micros = Object.values(_mcMicros)
      .filter(m => m.start_date && m.end_date && _inTeam(m) && _inSeason(m))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const _seasonMcIds = new Set(micros.map(m => m.id));
    const _mcForDate = (d) => micros.find(m => d >= m.start_date && d <= m.end_date)?.id || null;
    const mcs = {};
    for (const s of _mcSessions) {
      // Respetar el FK solo si el microciclo cae en la temporada activa; si no, por fecha.
      const mcId = (s.microcycle_id && _seasonMcIds.has(s.microcycle_id))
        ? s.microcycle_id
        : _mcForDate(s.session_date);
      if (!mcId) continue;
      if (!mcs[mcId]) mcs[mcId] = { id: mcId, sessions: [], mdMap: {} };
      mcs[mcId].sessions.push(s);
      const code = _getMcMdCode(s);
      if (code && !mcs[mcId].mdMap[code]) mcs[mcId].mdMap[code] = s.id;
    }
    return Object.values(mcs).sort((a, b) => {
      const sa = _mcMicros[a.id]?.start_date || '';
      const sb = _mcMicros[b.id]?.start_date || '';
      return sa.localeCompare(sb);
    });
  }

  // ── load & compare ───────────────────────────────────────────
  async function _mcLoad() {
    // Inputs derivados de la barra (única fuente de filtrado). La comparación vs MC
    // es per-card: las cards bespoke comparan contra el MC previo (vs_last) por defecto;
    // mc-table usa su propia config (refMcId en __config).
    const FB = window.gpFilterBar?.getState?.() || null;
    const selectedMD = (FB?.mdCodes && FB.mdCodes[0]) || 'MD-3';
    const scope      = 'vs_last';
    const metricKey  = 'total_distance';
    if (!selectedMD) return;
    if (!_mcInited) await mcInit();

    mcInfo.textContent = 'Loading...';
    if (metricBody) metricBody.innerHTML = tableBody.innerHTML =
      '<div style="padding:16px;color:var(--cm-fg-muted)">Loading...</div>';

    try {
      const clubId = await window.getClubId?.();
      const allMcs = _buildMcIndex();

      // Microcycles that have a session with the selected MD code
      const mcsWithMD = allMcs.filter(mc => mc.mdMap[selectedMD]);
      if (mcsWithMD.length < 2) {
        const msg = mcsWithMD.length === 0
          ? `No microcycles with ${selectedMD}. Need at least 2 to compare.`
          : `Only 1 microcycle has ${selectedMD}. Need at least 2 to compare.`;
        mcInfo.textContent = msg;
        if (metricBody) metricBody.innerHTML = tableBody.innerHTML =
          `<div style="padding:16px;color:var(--cm-fg-muted)">${esc(msg)}</div>`;
        return;
      }

      // Current = last MC with that MD code; reference = N previous
      const currentMc  = mcsWithMD[mcsWithMD.length - 1];
      const refCount   = scope === 'vs_last' ? 1 : scope === 'vs_avg_3' ? 3 : 5;
      const refMcs     = mcsWithMD.slice(-(refCount + 1), -1);

      const currentSessId = currentMc.mdMap[selectedMD];
      const refSessIds    = refMcs.map(mc => mc.mdMap[selectedMD]).filter(Boolean);

      if (!refSessIds.length) {
        const msg = 'Not enough historical microcycles for comparison.';
        mcInfo.textContent = msg;
        if (metricBody) metricBody.innerHTML = tableBody.innerHTML =
          `<div style="padding:16px;color:var(--cm-fg-muted)">${esc(msg)}</div>`;
        return;
      }

      // Last ~8 MCs for trend (includes current + up to 7 before it)
      const trendMcs     = mcsWithMD.slice(-8);
      const trendSessIds = trendMcs.map(mc => mc.mdMap[selectedMD]).filter(Boolean);

      // Shape: ALL sessions of current MC + all sessions of ref MCs (for day-by-day profile)
      const shapeCurrSessIds   = currentMc.sessions.map(s => s.id);
      const shapeRefAllSessIds = refMcs.flatMap(mc => mc.sessions.map(s => s.id));

      // GPS reports — single deduplicated query covering all consumers
      const allSessIds = [...new Set([
        currentSessId, ...refSessIds, ...trendSessIds,
        ...shapeCurrSessIds, ...shapeRefAllSessIds,
      ])];
      const reports = await window.cmFetchAll(() => _scopeTeam(window.sb
        .from('gps_reports')
        .select(`player_id,session_id,${MC_METRICS.map(m => m.key).join(',')}`)
        .eq('club_id', clubId)
        .eq('is_invalid', false)
        .in('session_id', allSessIds)), { label: 'mc-heatmap' })
        .catch(e => { console.error('[MC heatmap] query failed:', e); return []; });

      const allReports = reports || [];

      // Per-player data
      const playerIds  = [...new Set(allReports.map(r => r.player_id))];
      const playerRows = playerIds.map(pid => {
        const currReport = allReports.find(r => r.player_id === pid && r.session_id === currentSessId);
        const refReports = allReports.filter(r => r.player_id === pid && refSessIds.includes(r.session_id));
        const row = { pid, player: _playerMap[pid] || {} };
        for (const m of MC_METRICS) {
          const currVal = currReport?.[m.key] ?? null;
          const refVals = refReports.map(r => r[m.key]).filter(v => v != null);
          const refAvg  = refVals.length ? refVals.reduce((s, v) => s + v, 0) / refVals.length : null;
          row[m.key]            = currVal;
          row[m.key + '_ref']   = refAvg;
          row[m.key + '_diff']  = calcDiff(currVal, refAvg);
        }
        row.diff_pct = row[metricKey + '_diff'];
        return row;
      }).filter(r => r[metricKey] != null || r[metricKey + '_ref'] != null);

      // Trend points: squad avg of selected metric per MC (last ~8)
      const trendPoints = trendMcs.map(mc => {
        const sessId = mc.mdMap[selectedMD];
        if (!sessId) return null;
        const rpts = allReports.filter(r => r.session_id === sessId);
        const vals = rpts.map(r => r[metricKey]).filter(v => v != null);
        if (!vals.length) return null;
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        return { mc, avg, label: _mcLabel(mc), isCurrent: mc === currentMc };
      }).filter(Boolean);

      // Shape: load per MD-code day, current vs reference
      const _MD_ORDER = ['MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1','MD+2'];
      const shapeCurr = {};
      for (const s of currentMc.sessions) {
        const code = _getMcMdCode(s);
        if (!code) continue;
        const vals = allReports.filter(r => r.session_id === s.id)
          .map(r => r[metricKey]).filter(v => v != null);
        if (vals.length) shapeCurr[code] = vals.reduce((a,b)=>a+b,0)/vals.length;
      }
      const shapeRefAccum = {};
      for (const mc of refMcs) {
        for (const s of mc.sessions) {
          const code = _getMcMdCode(s);
          if (!code) continue;
          const vals = allReports.filter(r => r.session_id === s.id)
            .map(r => r[metricKey]).filter(v => v != null);
          if (!vals.length) continue;
          const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
          if (!shapeRefAccum[code]) shapeRefAccum[code] = [];
          shapeRefAccum[code].push(avg);
        }
      }
      const shapeRef = {};
      for (const [code, vals] of Object.entries(shapeRefAccum)) {
        shapeRef[code] = vals.reduce((a,b)=>a+b,0)/vals.length;
      }
      const shapeLabels = _MD_ORDER.filter(c => shapeCurr[c] != null || shapeRef[c] != null);

      // Monotony & Strain (Foster): mean/sd of daily squad-avg loads
      function _foster(byCode) {
        const vals = Object.values(byCode).filter(v => v != null && v > 0);
        if (vals.length < 2) return null;
        const n    = vals.length;
        const mean = vals.reduce((a,b) => a+b, 0) / n;
        const sd   = Math.sqrt(vals.reduce((s,v) => s + (v-mean)**2, 0) / n);
        if (sd === 0) return null;
        const monotony = mean / sd;
        const total    = vals.reduce((a,b) => a+b, 0);
        return { monotony, total, strain: total * monotony };
      }

      // Labels with real microcycle names and rivals
      function _mcLabel(mc) {
        const m = _mcMicros[mc.id];
        if (!m) return mc.id;
        return m.rival ? `${m.name} vs ${m.rival}` : m.name;
      }
      const currLabel = _mcLabel(currentMc);
      const refLabel  = refMcs.length === 1
        ? _mcLabel(refMcs[0])
        : `avg ${refMcs.map(mc => _mcMicros[mc.id]?.name || mc.id).join(', ')}`;

      // monoData must come after currLabel/refLabel are defined
      const monoData = { curr: _foster(shapeCurr), ref: _foster(shapeRef), currLabel, refLabel };

      // Exposure: sessions per player per MC (from allReports — no extra query)
      const _currSessSet = new Set(shapeCurrSessIds);
      const currSessCount = {};
      for (const r of allReports) {
        if (_currSessSet.has(r.session_id))
          currSessCount[r.player_id] = (currSessCount[r.player_id] || 0) + 1;
      }
      const refSessCountByMc = refMcs.map(mc => {
        const ids = new Set(mc.sessions.map(s => s.id));
        const counts = {};
        for (const r of allReports) {
          if (ids.has(r.session_id))
            counts[r.player_id] = (counts[r.player_id] || 0) + 1;
        }
        return { sessTotal: mc.sessions.length, matchCount: mc.sessions.filter(s => _getMcMdCode(s) === 'MD').length, counts };
      });
      const refAvgSessCount = {};
      const _expPids = [...new Set([...Object.keys(currSessCount), ...refSessCountByMc.flatMap(m => Object.keys(m.counts))])];
      for (const pid of _expPids) {
        const vals = refSessCountByMc.map(m => m.counts[pid] || 0);
        refAvgSessCount[pid] = vals.reduce((a,b) => a+b, 0) / vals.length;
      }
      const exposureData = {
        currSessTotal:  currentMc.sessions.length,
        currMatchCount: currentMc.sessions.filter(s => _getMcMdCode(s) === 'MD').length,
        refSessCountByMc, currSessCount, refAvgSessCount, currLabel, refLabel,
      };

      mcInfo.textContent = `${selectedMD} · ${currLabel} ← ref: ${refLabel} · ${playerRows.length} players`;

      _mcRenderMetricDiff(playerRows);
      // "MC diff table" migrada al motor unificado (builder + vs-microciclo): se
      // renderiza vía _mcRenderTableCard() (no acá). El resto sigue bespoke.
      _mcRenderScatter(playerRows, metricKey);
      _mcRenderTrend(trendPoints, metricKey, selectedMD);
      _mcRenderShape({ curr: shapeCurr, ref: shapeRef, labels: shapeLabels, currLabel, refLabel }, metricKey);
      _mcRenderMonotony(monoData, metricKey);
      _mcRenderMovers(playerRows, metricKey);
      _mcRenderExposure(exposureData);
    } catch (e) { console.error('_mcLoad:', e); mcInfo.textContent = tt('gps_analysis.error_loading_data','Error loading data.'); }
  }

  // ── Diff by metric ────────────────────────────────────────────
  function _mcRenderMetricDiff(rows) {
    if (!metricBody) return;   // card mc-diff-metric eliminada (genérica) → no-op
    if (!rows.length) { metricBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No data.</div>'; return; }

    const pills = MC_METRICS.map(m => {
      const diffs = rows.map(r => r[m.key + '_diff']).filter(v => v != null);
      if (!diffs.length) return null;
      const avg   = diffs.reduce((s,v)=>s+v,0)/diffs.length;
      const min   = Math.min(...diffs);
      const max   = Math.max(...diffs);
      return `<div class="mc-metric-pill">
        <span class="mc-mp-label">${m.label}</span>
        <span class="mc-mp-diff ${diffCls(avg)}">${fmtPct(avg)}</span>
        <span class="mc-mp-range">Range: ${fmtPct(min)} to ${fmtPct(max)}</span>
      </div>`;
    }).filter(Boolean);

    metricBody.innerHTML = `<div class="mc-metric-pills">${pills.join('')}</div>`;
  }

  // ── MC diff table ─────────────────────────────────────────────
  function _mcRenderTable(rows, primaryKey) {
    if (!rows.length) { tableBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No data.</div>'; return; }

    const sorted = [...rows].sort((a, b) => {
      const av = a[_mcSortKey === 'player' ? 'pid' : _mcSortKey] ?? (_mcSortDir > 0 ? Infinity : -Infinity);
      const bv = b[_mcSortKey === 'player' ? 'pid' : _mcSortKey] ?? (_mcSortDir > 0 ? Infinity : -Infinity);
      if (_mcSortKey === 'player') {
        return (a.player.last_name||'').localeCompare(b.player.last_name||'') * _mcSortDir;
      }
      return (av - bv) * _mcSortDir;
    });

    const maxVal = Math.max(...rows.map(r => r[primaryKey] || 0));

    const headers = `<tr>
      <th data-key="player" style="text-align:left">Player</th>
      <th data-key="${primaryKey}">Current (m)</th>
      <th data-key="${primaryKey}_ref">Ref (m)</th>
      <th data-key="diff_pct">Diff %</th>
      <th style="min-width:120px;cursor:default">Bar</th>
    </tr>`;

    const bodyRows = sorted.map(r => {
      const p    = r.player;
      const name = `${p.last_name||''} ${(p.first_name||'')[0]||''}.`.trim() || r.pid.slice(0,8);
      const curr = r[primaryKey];
      const ref  = r[primaryKey + '_ref'];
      const diff = r['diff_pct'];
      const barPct = curr != null && maxVal > 0 ? Math.round(curr/maxVal*100) : 0;

      return `<tr>
        <td><strong>${esc(name)}</strong>${p.position ? `<span style="color:var(--cm-fg-muted);font-size:10.5px"> · ${esc(p.position)}</span>` : ''}</td>
        <td>${fmtN(curr, 0)}</td>
        <td style="color:var(--cm-fg-muted)">${fmtN(ref, 0)}</td>
        <td><span class="mc-diff ${diffCls(diff)}">${fmtPct(diff)}</span></td>
        <td><div class="mc-bar-cell"><div class="mc-bar-track"><div class="mc-bar-fill" style="width:${barPct}%"></div></div></div></td>
      </tr>`;
    }).join('');

    tableBody.innerHTML = `<table class="mc-tbl"><thead>${headers}</thead><tbody>${bodyRows}</tbody></table>`;

    tableBody.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        if (_mcSortKey === k) _mcSortDir *= -1; else { _mcSortKey = k; _mcSortDir = -1; }
        _mcRenderTable(rows, primaryKey);
      });
    });
  }

  // ── scatter ───────────────────────────────────────────────────
  function _mcRenderScatter(rows, metricKey) {
    if (!scatCanvas || typeof Chart === 'undefined') return;
    if (_mc.scatterChart) { _mc.scatterChart.destroy(); _mc.scatterChart = null; }
    if (!rows.length) return;

    const validRows = rows.filter(r => r[metricKey] != null && r[metricKey+'_diff'] != null);
    if (!validRows.length) return;

    const avgDiff = validRows.reduce((s,r)=>s+r[metricKey+'_diff'],0)/validRows.length;
    const metricLabel = MC_METRICS.find(m=>m.key===metricKey)?.label || metricKey;
    const unit        = MC_METRICS.find(m=>m.key===metricKey)?.unit || '';

    const points = validRows.map(r => ({
      x: r[metricKey+'_diff'],
      y: r[metricKey],
      label: (r.player.last_name || r.pid.slice(0,6)),
    }));

    _mc.scatterChart = new Chart(scatCanvas, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Players',
          data: points,
          pointRadius: 8,
          pointHoverRadius: 10,
          backgroundColor: points.map(p => p.x > 0 ? 'rgba(74,222,128,.7)' : 'rgba(248,113,113,.65)'),
          borderColor: 'transparent',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: `Diff % vs reference` },
            ticks: { callback: v => `${v>=0?'+':''}${v}%` },
          },
          y: { title: { display: true, text: `${metricLabel}${unit?' ('+unit+')':''}` } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pt = points[ctx.dataIndex];
                return [`${pt.label}`, `${metricLabel}: ${fmtN(ctx.parsed.y, 0)} ${unit}`, `Diff: ${fmtPct(ctx.parsed.x)}`];
              },
            },
          },
          // Average line via afterDraw
        },
      },
      plugins: [{
        id: 'avgLine',
        afterDraw(chart) {
          const { ctx, scales: { x, y } } = chart;
          const xPx = x.getPixelForValue(avgDiff);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(xPx, y.top);
          ctx.lineTo(xPx, y.bottom);
          ctx.strokeStyle = 'rgba(99,102,241,.6)';
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = 'rgba(99,102,241,.8)';
          ctx.font = '10px Geist Mono, monospace';
          ctx.fillText(`AVG ${fmtPct(avgDiff)}`, xPx + 4, y.top + 14);
          ctx.restore();
          // Player labels
          ctx.save();
          ctx.font = '10px Geist, system-ui';
          ctx.fillStyle = 'var(--cm-fg)';
          points.forEach((pt, i) => {
            const px = x.getPixelForValue(pt.x);
            const py = y.getPixelForValue(pt.y);
            ctx.fillText(pt.label, px + 10, py - 4);
          });
          ctx.restore();
        },
      }],
    });
  }

  // ── Exposure context ──────────────────────────────────────────
  const _mcExpBody = document.getElementById('mc-exp-body');
  const _mcExpSub  = document.getElementById('mc-exp-sub');

  function _mcRenderExposure({ currSessTotal, currMatchCount, refSessCountByMc,
                                currSessCount, refAvgSessCount, currLabel, refLabel }) {
    if (!_mcExpBody) return;
    try {
      if (_mcExpSub) _mcExpSub.textContent = tt('gps_analysis.mc_exp_sub','sessions per player · comparability check');

      const allPids = [...new Set([
        ...Object.keys(currSessCount),
        ...refSessCountByMc.flatMap(m => Object.keys(m.counts)),
      ])].sort((a, b) => {
        const pa = _playerMap[a], pb = _playerMap[b];
        return (pa?.last_name || '').localeCompare(pb?.last_name || '');
      });

      if (!allPids.length) {
        _mcExpBody.innerHTML = '<p style="padding:14px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">No data.</p>';
        return;
      }

      // Ref aggregated totals (avg)
      const refSessTotalAvg  = refSessCountByMc.reduce((s,m) => s + m.sessTotal, 0)  / refSessCountByMc.length;
      const refMatchCountAvg = refSessCountByMc.reduce((s,m) => s + m.matchCount, 0) / refSessCountByMc.length;

      function _matchFlag(n) {
        return n >= 2 ? ' <i class="ti ti-alert-triangle" style="color:var(--cm-warning);font-size:11px" title="Double matchweek"></i>' : '';
      }

      function _bar(done, total) {
        if (!total) return '—';
        const pct = Math.round(done / total * 100);
        const col = pct >= 80 ? 'var(--cm-success)' : pct >= 60 ? 'var(--cm-warning)' : 'var(--cm-danger)';
        return `<div style="display:flex;align-items:center;gap:5px">
          <div style="width:52px;height:6px;background:var(--cm-bg-sunk);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div>
          </div>
          <span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${done}/${total}</span>
        </div>`;
      }

      const thS = 'font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;padding:7px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--cm-border)';
      const thL = thS + ';text-align:left';

      const infoRow = (label, curr, refAvg, warn) =>
        `<span style="font:500 11px/1.4 var(--cm-font-sans)">${label}:</span> ` +
        `<strong>${curr}${warn ? _matchFlag(curr) : ''}</strong> ` +
        `<span style="color:var(--cm-fg-muted)">· ref avg ${refAvg % 1 === 0 ? refAvg : refAvg.toFixed(1)}${warn ? _matchFlag(refAvg) : ''}</span>`;

      const headerInfo = `<div style="padding:10px 14px 8px;font:500 11.5px/1.8 var(--cm-font-sans);border-bottom:1px solid var(--cm-border);display:flex;flex-wrap:wrap;gap:16px">
        <span>${infoRow('Sessions', currSessTotal, refSessTotalAvg, false)}</span>
        <span>${infoRow('Matches', currMatchCount, refMatchCountAvg, true)}</span>
        <span style="color:var(--cm-fg-muted);font-size:10.5px">Comparing: <em>${esc(currLabel)}</em> vs <em>${esc(refLabel)}</em></span>
      </div>`;

      const bodyRows = allPids.map(pid => {
        const p    = _playerMap[pid] || {};
        const name = `${p.last_name || ''}${p.first_name ? ' ' + p.first_name[0] + '.' : ''}`.trim() || pid.slice(0,8);
        const pos  = p.position ? `<span style="color:var(--cm-fg-muted);font-size:10px"> · ${esc(p.position)}</span>` : '';
        const curr = currSessCount[pid] || 0;
        const ref  = refAvgSessCount[pid] != null ? refAvgSessCount[pid] : null;
        return `<tr>
          <td style="padding:5px 10px;white-space:nowrap"><strong>${esc(name)}</strong>${pos}</td>
          <td style="padding:5px 10px;text-align:right">${_bar(curr, currSessTotal)}</td>
          <td style="padding:5px 10px;text-align:right">${ref != null ? _bar(Math.round(ref), Math.round(refSessTotalAvg)) : '—'}</td>
        </tr>`;
      }).join('');

      _mcExpBody.innerHTML = headerInfo + `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thL}">Player</th>
            <th style="${thS}">Current (${currSessTotal} sess.)</th>
            <th style="${thS}">Ref avg (${Math.round(refSessTotalAvg)} sess.)</th>
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>`;
    } catch (e) { console.error('_mcRenderExposure:', e); }
  }

  // ── Biggest movers ────────────────────────────────────────────
  const _mcMoversBody = document.getElementById('mc-movers-body');
  const _mcMoversSub  = document.getElementById('mc-movers-sub');

  function _mcRenderMovers(rows, metricKey) {
    if (!_mcMoversBody) return;
    try {
      const metaDef   = MC_METRICS.find(m => m.key === metricKey);
      const metaLabel = metaDef?.label || metricKey;
      const metaUnit  = metaDef?.unit  || '';
      if (_mcMoversSub) _mcMoversSub.textContent =
        tt('gps_analysis.mc_movers_sub','{metric} · top gains & drops vs reference', { metric: metaLabel });

      const valid = rows.filter(r => r.diff_pct != null);
      if (!valid.length) {
        _mcMoversBody.innerHTML =
          '<p style="color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">No data.</p>';
        return;
      }

      const N = 4; // players per section
      const byDiff  = [...valid].sort((a, b) => b.diff_pct - a.diff_pct);
      const gainers = byDiff.slice(0, N);
      const losers  = byDiff.slice(-N).reverse();

      function _playerName(r) {
        const p = r.player;
        return `${p.last_name || ''}${p.first_name ? ' ' + p.first_name[0] + '.' : ''}`.trim() || r.pid.slice(0, 8);
      }

      function _moversRow(r) {
        const name = _playerName(r);
        const diff = r.diff_pct;
        const val  = r[metricKey];
        const cls  = diffCls(diff);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--cm-border-soft)">
          <span style="font:500 12.5px/1.3 var(--cm-font-sans);color:var(--cm-fg)">${esc(name)}</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font:500 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${fmtN(val, 0)}${metaUnit ? ' ' + metaUnit : ''}</span>
            <span class="mc-diff ${cls}" style="min-width:52px;justify-content:flex-end">${fmtPct(diff)}</span>
          </div>
        </div>`;
      }

      const sectionHdr = (label, color) =>
        `<div style="font:600 10px/1 var(--cm-font-mono);color:${color};text-transform:uppercase;padding:8px 0 4px">${label}</div>`;

      _mcMoversBody.innerHTML =
        sectionHdr('↑ Biggest gains', 'var(--cm-success)') +
        gainers.map(_moversRow).join('') +
        sectionHdr('↓ Biggest drops', 'var(--cm-danger)') +
        losers.map(_moversRow).join('');
    } catch (e) { console.error('_mcRenderMovers:', e); }
  }

  // ── Monotonía & strain ────────────────────────────────────────
  const _mcMonoBody = document.getElementById('mc-mono-body');
  const _mcMonoSub  = document.getElementById('mc-mono-sub');

  function _mcRenderMonotony({ curr, ref, currLabel, refLabel }, metricKey) {
    if (!_mcMonoBody) return;
    try {
      const metaDef  = MC_METRICS.find(m => m.key === metricKey);
      const metaUnit = metaDef?.unit || '';
      if (_mcMonoSub) _mcMonoSub.textContent =
        `Foster · ${metaDef?.label || metricKey} · squad avg · current vs reference`;

      if (!curr && !ref) {
        _mcMonoBody.innerHTML =
          '<p style="color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Need ≥ 2 days of data per microcycle.</p>';
        return;
      }

      // Monotony > 2.0 → warning (Foster threshold)
      const MONO_WARN = 2.0;
      function _monoFlag(v) {
        if (v == null) return '';
        return v >= MONO_WARN
          ? '<i class="ti ti-alert-triangle" style="color:var(--cm-warning);margin-left:4px;font-size:12px" title="High monotony (≥2.0) — injury risk elevated"></i>'
          : '';
      }

      function _row(label, currVal, refVal, dec = 0, unit = '') {
        const fmt = v => v == null ? '—' : `${Number(v).toLocaleString('en',{maximumFractionDigits:dec})}${unit ? ' '+unit : ''}`;
        const diffPct = (currVal != null && refVal != null && refVal !== 0)
          ? (currVal - refVal) / refVal * 100 : null;
        const cls = diffPct == null ? '' : diffPct > 10 ? 'd-vup' : diffPct > 3 ? 'd-up'
          : diffPct < -10 ? 'd-vdn' : diffPct < -3 ? 'd-dn' : 'd-neu';
        const diffStr = diffPct == null ? '' :
          `<span class="mc-diff ${cls}" style="font-size:10.5px;margin-left:6px">${diffPct>=0?'+':''}${diffPct.toFixed(1)}%</span>`;
        return `<tr>
          <td style="padding:6px 0;font:500 11.5px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)">${label}</td>
          <td style="padding:6px 8px;text-align:right;font:600 13px/1 var(--cm-font-mono)">${fmt(currVal)}${label==='Monotony'?_monoFlag(currVal):''}</td>
          <td style="padding:6px 8px;text-align:right;font:500 12px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${fmt(refVal)}${label==='Monotony'?_monoFlag(refVal):''}</td>
          <td style="padding:6px 0">${diffStr}</td>
        </tr>`;
      }

      const headerStyle = 'font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;padding:0 8px;text-align:right';
      _mcMonoBody.innerHTML = `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;padding-bottom:8px;text-align:left"></th>
              <th style="${headerStyle}">${esc(currLabel)}</th>
              <th style="${headerStyle}">${esc(refLabel)}</th>
              <th style="${headerStyle}">Diff</th>
            </tr>
          </thead>
          <tbody style="border-top:1px solid var(--cm-border)">
            ${_row('Total load',  curr?.total,    ref?.total,    0, metaUnit)}
            ${_row('Monotony',    curr?.monotony, ref?.monotony, 2)}
            ${_row('Strain',      curr?.strain,   ref?.strain,   0, metaUnit)}
          </tbody>
        </table>
        <p style="margin-top:8px;font:500 10px/1.4 var(--cm-font-mono);color:var(--cm-fg-faint)">
          Monotony = mean/SD of daily squad-avg load · Strain = total × monotony · ⚠️ ≥ 2.0
        </p>`;
    } catch (e) { console.error('_mcRenderMonotony:', e); }
  }

  // ── Microcycle shape ──────────────────────────────────────────
  const _mcShapeCard   = document.getElementById('card-mc-shape');
  const _mcShapeCanvas = document.getElementById('canvasMCShape');
  const _mcShapeSub    = document.getElementById('mc-shape-sub');
  let   _mcShapeChart  = null;

  function _mcRenderShape({ curr, ref, labels, currLabel, refLabel }, metricKey) {
    if (!_mcShapeCard || !_mcShapeCanvas || typeof Chart === 'undefined') return;
    try {
      if (_mcShapeChart) { _mcShapeChart.destroy(); _mcShapeChart = null; }

      if (!labels.length) {
        _mcShapeCanvas.getContext('2d').clearRect(0, 0, _mcShapeCanvas.width, _mcShapeCanvas.height);
        if (_mcShapeSub) _mcShapeSub.textContent = tt('gps_analysis.no_day_level_data','No day-level data available');
        return;
      }

      const metaDef   = MC_METRICS.find(m => m.key === metricKey);
      const metaLabel = metaDef?.label || metricKey;
      const metaUnit  = metaDef?.unit  || '';
      if (_mcShapeSub) _mcShapeSub.textContent =
        `${metaLabel} per day · ${currLabel} vs ${refLabel}`;

      const accent = _accentHex();

      _mcShapeChart = new Chart(_mcShapeCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: currLabel,
              data: labels.map(c => curr[c] ?? null),
              borderColor: accent,
              backgroundColor: `${accent}18`,
              fill: true,
              tension: 0.25,
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: accent,
              spanGaps: false,
            },
            {
              label: refLabel,
              data: labels.map(c => ref[c] ?? null),
              borderColor: 'rgba(99,102,241,0.7)',
              backgroundColor: 'rgba(99,102,241,0.06)',
              fill: true,
              tension: 0.25,
              borderWidth: 2,
              borderDash: [5, 4],
              pointRadius: 4,
              pointBackgroundColor: 'rgba(99,102,241,0.7)',
              spanGaps: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true, position: 'bottom',
              labels: { font: { size: 10 }, boxWidth: 14, padding: 10,
                color: 'rgba(160,160,160,0.9)' },
            },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${fmtN(ctx.parsed.y, 0)}${metaUnit ? ' ' + metaUnit : ''}`,
              },
            },
          },
          scales: {
            x: { ..._chartDefaults.scales?.x },
            y: {
              ..._chartDefaults.scales?.y,
              title: { display: true, text: `${metaLabel}${metaUnit ? ' (' + metaUnit + ')' : ''}`,
                font: { size: 10 } },
            },
          },
        },
      });
    } catch (e) { console.error('_mcRenderShape:', e); }
  }

  // ── MD trend ──────────────────────────────────────────────────
  const _mcTrendCard   = document.getElementById('card-mc-trend');
  const _mcTrendCanvas = document.getElementById('canvasMCTrend');
  const _mcTrendSub    = document.getElementById('mc-trend-sub');
  let   _mcTrendChart  = null;

  function _mcRenderTrend(points, metricKey, mdCode) {
    if (!_mcTrendCard || !_mcTrendCanvas || typeof Chart === 'undefined') return;
    try {
      if (_mcTrendChart) { _mcTrendChart.destroy(); _mcTrendChart = null; }

      if (!points || points.length < 2) {
        _mcTrendCanvas.getContext('2d').clearRect(0, 0, _mcTrendCanvas.width, _mcTrendCanvas.height);
        if (_mcTrendSub) _mcTrendSub.textContent = tt('gps_analysis.not_enough_data_mc','Not enough data — need ≥ 2 microcycles');
        return;
      }

      const metaDef   = MC_METRICS.find(m => m.key === metricKey);
      const metaLabel = metaDef?.label || metricKey;
      const metaUnit  = metaDef?.unit  || '';

      if (_mcTrendSub) _mcTrendSub.textContent =
        `${mdCode} · ${metaLabel} · squad avg · ${points.length} microcycles`;

      const accent    = _accentHex();
      const pointColors = points.map(p => p.isCurrent ? accent : 'rgba(99,102,241,0.75)');
      const pointRadii  = points.map(p => p.isCurrent ? 7 : 4);

      _mcTrendChart = new Chart(_mcTrendCanvas, {
        type: 'line',
        data: {
          labels:   points.map(p => p.label),
          datasets: [{
            label:           metaLabel,
            data:            points.map(p => p.avg),
            borderColor:     'rgba(99,102,241,0.8)',
            backgroundColor: 'rgba(99,102,241,0.08)',
            fill:            true,
            tension:         0.3,
            borderWidth:     2,
            pointRadius:     pointRadii,
            pointBackgroundColor: pointColors,
            pointHoverRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: ctx => points[ctx[0].dataIndex].label,
                label: ctx => ` ${metaLabel}: ${fmtN(ctx.parsed.y, 0)}${metaUnit ? ' ' + metaUnit : ''}`,
                afterLabel: ctx => points[ctx.dataIndex].isCurrent ? '← current' : '',
              },
            },
          },
          scales: {
            x: {
              ..._chartDefaults.scales?.x,
              ticks: { maxRotation: 30, font: { size: 10 } },
            },
            y: {
              ..._chartDefaults.scales?.y,
              title: { display: true, text: `${metaLabel}${metaUnit ? ' (' + metaUnit + ')' : ''}`, font: { size: 10 } },
            },
          },
        },
        plugins: [{
          id: 'currentAnnotation',
          afterDraw(chart) {
            const currentIdx = points.findIndex(p => p.isCurrent);
            if (currentIdx < 0) return;
            const { ctx, scales: { x, y } } = chart;
            const xPx = x.getPixelForValue(currentIdx);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPx, y.top);
            ctx.lineTo(xPx, y.bottom);
            ctx.strokeStyle = `${accent}55`;
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = accent;
            ctx.font = '9px Geist Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NOW', xPx, y.top - 4);
            ctx.restore();
          },
        }],
      });
    } catch (e) { console.error('_mcRenderTrend:', e); }
  }

  // ── "MC diff table" → card editable gp.card/v1 (motor unificado) ───────────
  // ÚNICA card migrada en esta pasada. Tabla, scope squad, una fila por jugador,
  // comparación "vs microciclo" (MC actual = window._gpMcId; ref = el MC anterior por
  // defecto, editable desde el lápiz). Cada celda = diff% vs el MC de referencia, con
  // formato condicional HEATMAP (rojo→ámbar→verde por magnitud del cambio). Mismos
  // números que la tabla vieja para los mismos dos MCs; solo cambia la presentación.
  const _MC_TBL_FMT = { mode: 'heat', dir: 'high', dec: 1, barColor: null, heatScale: 'ryg', iconStyle: 'dot', thr: null };
  function _mcTableConfig(refId) {
    return { schema: 'gp.card/v1', title: 'MC diff table', viz: 'table', scope: { level: 'squad' },
      metrics: MC_METRICS.map(m => ({ id: m.key, agg: 'avg', format: { ..._MC_TBL_FMT } })),
      dimensions: [{ id: 'player_name' }], range: { type: 'mc' },
      comparison: refId ? { baseline: 'mc', refMcId: refId } : null,
      style: { size: 'full', color: '#15803D' } };
  }
  /** MC de referencia por defecto = el inmediatamente anterior al actual (vs Last). */
  function _mcDefaultRefId() {
    const allMcs = _buildMcIndex();                       // oldest → newest
    const curId  = window._gpMcId || (allMcs.length ? allMcs[allMcs.length - 1].id : null);
    const i = allMcs.findIndex(m => String(m.id) === String(curId));
    return i > 0 ? allMcs[i - 1].id : (allMcs.length >= 2 ? allMcs[allMcs.length - 2].id : null);
  }
  function _mcRenderTableCard() {
    if (!window.GpBuilder?.resolveAndRenderCard) return;
    const el = document.getElementById('card-mc-table');
    if (!el) return;
    if (!el.__config) el.__config = _mcTableConfig(_mcDefaultRefId());   // semilla; el builder la reemplaza al editar
    // Botón de la cabecera → abre el Chart builder con la config de la card (lápiz).
    const act = el.querySelector('.gp-c-h .right > button:last-child');
    if (act && !act.__mcBound) {
      act.__mcBound = true; act.title = 'Editar card'; act.innerHTML = '<i class="ti ti-pencil"></i>';
      act.addEventListener('click', () => window.GpBuilder.openForEdit?.(el));
    }
    window.GpBuilder.resolveAndRenderCard(el, el.__config);
  }

  // ── events ───────────────────────────────────────────────────
  function _mcTriggerLoad() {
    const _bothLoads = () => { _mcRenderTableCard(); _mcLoad().catch(e => console.error('mc auto-load:', e)); };
    if (!_mcInited) mcInit().then(_bothLoads).catch(e => console.error('mc auto-load:', e));
    else _bothLoads();
  }

  // La barra de desplegables es la única fuente: re-cargar mc en cada cambio de filtro.
  document.addEventListener('gpfilter:change', _mcTriggerLoad);

  window._mcInit = mcInit;

  document.getElementById('sections')?.addEventListener('click', e => {
    if (!e.target.closest('.gp-sec[data-view="mc"]')) return;
    _mcTriggerLoad();
  });
})();
