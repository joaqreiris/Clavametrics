/* ─────────────────────────────────────────────────────────────────────────
   gps-analysis-2.js — segunda parte de la página GPS Analysis.

   Estaba escrito dentro de GPS Analysis.html: entre los cuatro archivos eran
   418 KB de los 545 KB de la página, y viajaban enteros en cada visita porque
   el HTML no se cachea nunca.

   Va con defer. Comprobado antes de mover nada:
     · No queda NINGÚN elemento del DOM por debajo de donde estaban escritos
       (todo el markup termina en la línea 1443), así que los selectores ven
       exactamente lo mismo.
     · Los 9 scripts sueltos que quedan por debajo (gps-import-wizard,
       gps-player-week, gps-mc-compare, …) no usan al cargarse ninguna de las
       984 variables globales que definen estos bloques.
     · El orden entre los cuatro archivos se conserva: defer respeta el orden
       del documento, y no había scripts intercalados dentro de cada grupo.
   ──────────────────────────────────────────────────────────────────────── */
// ══════════════════════════════════════════════════════════════
// BLOQUE 5+6 — × match avg + weekly bars + baseline settings
// ══════════════════════════════════════════════════════════════

// ── × Match avg (weekly MC total ÷ match avg) ─────────────────
// Metrics that use MAX (not SUM) because they are peak values per session
const _XM_PEAK_METRICS = new Set(['max_speed','avg_speed','distance_per_minute']);

// Core columns available directly in gps_reports
const _XM_CORE_KEYS = new Set([
  'total_distance','high_speed_distance','very_high_speed_distance',
  'sprint_distance','sprint_count','accelerations','decelerations',
  'max_speed','player_load','avg_speed','hmld','time_played','distance_per_minute',
]);

const _XM_DEFAULT_METRICS = [
  { key:'total_distance',      label:'Dist',    icon:'ti-route' },
  { key:'high_speed_distance', label:'HSR',     icon:'ti-bolt' },
  { key:'sprint_distance',     label:'Sprints', icon:'ti-flame' },
  { key:'max_speed',           label:'Top sp',  icon:'ti-gauge' },
  { key:'accelerations',       label:'Accel',   icon:'ti-arrow-up-right' },
  { key:'player_load',         label:'Load',    icon:'ti-activity' },
];

function _xmMetricMeta(key) {
  const ICON = {
    total_distance:'ti-route', high_speed_distance:'ti-bolt',
    very_high_speed_distance:'ti-bolt', sprint_distance:'ti-flame',
    sprint_count:'ti-flame', max_speed:'ti-gauge', avg_speed:'ti-gauge',
    accelerations:'ti-arrow-up-right', decelerations:'ti-arrow-down-right',
    player_load:'ti-activity', hmld:'ti-heart-rate-monitor',
    time_played:'ti-clock', distance_per_minute:'ti-chart-line',
  };
  const LABEL = {
    total_distance:'Dist', high_speed_distance:'HSR',
    very_high_speed_distance:'VHSR', sprint_distance:'Sprints',
    sprint_count:'Sprints #', max_speed:'Top sp', avg_speed:'Avg sp',
    accelerations:'Accel', decelerations:'Decel', player_load:'Load',
    hmld:'HMLD', time_played:'Min', distance_per_minute:'Dist/min',
  };
  const cat = (window._gpCatalog || []).find(d => d.key === key);
  return { icon: ICON[key] || 'ti-chart-bar', label: LABEL[key] || cat?.label || key };
}

let _xmLastReport = null;

async function renderMatchMax(report) {
  _xmLastReport = report;
  const container = document.querySelector('.gp-xm');
  if (!container) return;
  const clubId = window._gpClubId;
  const pid    = report?.player_id;
  if (!pid || !clubId) return;

  // Read metric list from card config
  const card       = document.getElementById('card-xmatch');
  const cfg        = (() => { try { return JSON.parse(card?.dataset.config || '{}'); } catch { return {}; } })();
  const metricKeys = cfg.metrics?.length ? cfg.metrics : _XM_DEFAULT_METRICS.map(m => m.key);

  // Get current MC id (derivado de la barra vía el módulo PW; filtro viejo eliminado)
  const curMcId = window._pwMcKey || (window.gpFilterBar?.getState?.().microcycleIds || [])[0] || null;

  // Aggregate metric values across all sessions in the MC
  const aggregated = {};

  if (curMcId) {
    container.innerHTML = '<div style="padding:8px 0;color:var(--cm-fg-muted);font:500 11px/1 var(--cm-font-sans)">Loading…</div>';

    const { data: mcSess } = await window.sb.from('training_sessions')
      .select('id')
      .eq('club_id', clubId)
      .eq('microcycle_id', curMcId);
    const sids = (mcSess || []).map(s => s.id);

    if (sids.length) {
      // Core metrics: fetch all in one query
      const coreKeys = metricKeys.filter(k => _XM_CORE_KEYS.has(k));
      if (coreKeys.length) {
        const rpts = await window.cmFetchAll(() => window.sb.from('gps_reports')
          .select(`session_id,${coreKeys.join(',')}`)
          .eq('is_invalid', false)
          .in('session_id', sids)
          .eq('club_id', clubId)
          .eq('player_id', pid), { label: 'xmatch.core' }).catch(() => []);
        coreKeys.forEach(k => {
          const vals = (rpts || []).map(r => +(r[k] || 0)).filter(v => v > 0);
          aggregated[k] = _XM_PEAK_METRICS.has(k)
            ? (vals.length ? Math.max(...vals) : 0)   // peak: take max across sessions
            : vals.reduce((s, v) => s + v, 0);        // accumulable: sum across sessions
        });
      }
      // Custom EAV metrics
      const customKeys = metricKeys.filter(k => !_XM_CORE_KEYS.has(k));
      if (customKeys.length) {
        const coreRows = await window.cmFetchAll(() => window.sb.from('gps_reports')
          .select('id,session_id')
          .eq('is_invalid', false)
          .in('session_id', sids)
          .eq('club_id', clubId)
          .eq('player_id', pid), { label: 'xmatch.eav-ids' }).catch(() => []);
        const rptIds = (coreRows || []).map(r => r.id);
        if (rptIds.length) {
          const { data: eav } = await window.sb.from('gps_report_metrics')
            .select('report_id,metric_key,value')
            .in('report_id', rptIds)
            .in('metric_key', customKeys);
          customKeys.forEach(k => {
            const vals = (eav || []).filter(r => r.metric_key === k).map(r => +(r.value) || 0).filter(v => v > 0);
            aggregated[k] = _XM_PEAK_METRICS.has(k)
              ? (vals.length ? Math.max(...vals) : 0)
              : vals.reduce((s, v) => s + v, 0);
          });
        }
      }
    }
  } else {
    // No MC selected — fall back to single report values
    metricKeys.forEach(k => { aggregated[k] = +(report[k] || 0); });
  }

  // Fetch baselines for all metrics in parallel
  const baselineResults = await Promise.all(
    metricKeys.map(k => window.getMatchBaseline(pid, k, clubId))
  );

  // E:P target bands (feature flag gps_ep_ratio) — per-club, only for accumulable metrics.
  // Ensure the per-club flags are loaded so the sync accessor below is authoritative (not the
  // fail-closed code default) on the first render for a club with an override row.
  if (window.getClubFlags) { try { await window.getClubFlags(); } catch (_e) {} }
  const epOn    = window.clubFlagSync ? window.clubFlagSync('gps_ep_ratio') : false;
  const epBands = epOn && window.clubFlagConfigSync ? (window.clubFlagConfigSync('gps_ep_ratio').bands || {}) : {};

  const rows = metricKeys.map((k, i) => {
    const { icon, label } = _xmMetricMeta(k);
    const val     = aggregated[k] || 0;
    const bl      = baselineResults[i];
    const ratio   = bl.baseline ? +(val / bl.baseline).toFixed(2) : null;
    const isPeak  = _XM_PEAK_METRICS.has(k);
    const conf    = bl.confidence === 'high' ? '✓' : bl.confidence === 'medium' ? '~' : '';

    // E:P mode: colour vs the target band and rescale the track so the band sits centred. The
    // legacy scale pins 1.0×=75% and clips >1.33×, which is meaningless for a weekly-accumulated
    // ratio of ~2.5–3.5×. Peaks (max speed…) never get a band and keep the legacy scale.
    const band = (epOn && !isPeak && ratio != null && Array.isArray(epBands[k])) ? epBands[k] : null;
    let pct, statusCls, epLabel = '';
    if (band) {
      const [lo, hi] = band;
      const scaleMax = hi * 1.3;
      pct       = Math.max(0, Math.min(100, Math.round(ratio / scaleMax * 100)));
      statusCls = (ratio >= lo && ratio <= hi) ? 'ok'
                : ratio < lo ? (ratio >= lo * 0.85 ? 'warn' : 'danger')
                :              (ratio <= hi * 1.15 ? 'warn' : 'danger');
      epLabel   = statusCls === 'ok' ? tt('gps_analysis.ep_in','in range')
                : ratio < lo ? tt('gps_analysis.ep_low','below') : tt('gps_analysis.ep_high','above');
    } else {
      // Legacy scale (unchanged): 1.0×=75%, warn>1.1, danger>1.2
      pct       = ratio != null ? Math.min(Math.round(ratio * 75), 100) : 0;
      statusCls = ratio > 1.2 ? 'danger' : ratio > 1.1 ? 'warn' : '';
    }

    const tooltip = bl.warning
      ? bl.warning
      : band
        ? `E:P ${ratio}× (${epLabel}) · ${tt('gps_analysis.ep_target','target')} ${band[0]}–${band[1]}× · ${bl.count} ${tt('gps_analysis.ep_matches','matches')}`
        : `${isPeak ? 'Pico' : 'Total MC'} · Baseline ${conf}: promedio ${bl.count} partidos`;
    return { icon, label, ratio, pct, statusCls, tooltip, hasBaseline: !!bl.baseline, bl, band };
  });

  const allMissing = rows.every(r => !r.hasBaseline);
  if (allMissing) {
    const msg = rows[0]?.bl?.warning || 'Insufficient match data for baseline';
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0;text-align:center">
        <i class="ti ti-info-circle" style="font-size:22px;color:var(--cm-fg-muted)"></i>
        <div style="font:500 12px/1.5 var(--cm-font-sans);color:var(--cm-fg-muted)">${msg}</div>
        <div style="font:500 10.5px/1.4 var(--cm-font-mono);color:var(--cm-fg-faint)">Needs ≥3 official matches</div>
      </div>`;
    return;
  }

  container.innerHTML = rows.map(r => {
    let track;
    if (r.band) {
      const [lo, hi]  = r.band;
      const scaleMax  = hi * 1.3;
      const bandStyle = `left:${(lo / scaleMax * 100).toFixed(1)}%;right:${(100 - hi / scaleMax * 100).toFixed(1)}%`;
      track = `<span class="gp-xm-band" style="${bandStyle}"></span>`;
    } else {
      track = `<span class="th" style="left:50%"></span><span class="th" style="left:75%"></span>`;
    }
    return `
    <div class="gp-xm-row" title="${_gpEsc(r.tooltip)}">
      <span class="gp-xm-l"><i class="ti ${r.icon}"></i>${_gpEsc(r.label)}</span>
      <span class="gp-xm-t${r.band ? ' ep' : ''}">
        ${track}
        ${r.hasBaseline
          ? `<span class="pin ${r.statusCls}" style="left:${r.pct}%"><span class="pd"></span></span>`
          : `<span style="font:500 10px/1 var(--cm-font-mono);color:var(--cm-fg-faint);padding-left:6px">No data</span>`}
      </span>
      <span class="gp-xm-v ${r.statusCls}">${r.hasBaseline ? r.ratio + '×' : '—'}</span>
    </div>`;
  }).join('');
}

// ── Metrics editor popover for × match avg card ───────────────
function _openXmatchMetricsEditor(card, anchor) {
  const cfg    = (() => { try { return JSON.parse(card?.dataset.config || '{}'); } catch { return {}; } })();
  const active = new Set(cfg.metrics || _XM_DEFAULT_METRICS.map(m => m.key));

  const all = [
    ..._XM_DEFAULT_METRICS,
    ...(window._gpCatalog || [])
      .filter(d => !_XM_DEFAULT_METRICS.find(m => m.key === d.key))
      .map(d => { const meta = _xmMetricMeta(d.key); return { key: d.key, label: meta.label, icon: meta.icon }; }),
  ];

  const pop = document.createElement('div');
  pop.className = 'gp-popover';
  pop.style.cssText = 'min-width:190px;max-height:300px;overflow-y:auto;padding:4px 0';

  function buildPop() {
    pop.innerHTML = `<div style="padding:6px 12px 4px;font:600 10.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.4px">Visible metrics</div>`;
    all.forEach(m => {
      const isOn = active.has(m.key);
      const row  = document.createElement('div');
      row.className = 'gp-popover-item';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;user-select:none';
      row.innerHTML = `
        <span style="width:13px;height:13px;border-radius:3px;border:1.5px solid var(--cm-border-soft);background:${isOn ? 'var(--cm-accent)' : 'transparent'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
          ${isOn ? '<i class="ti ti-check" style="font-size:9px;color:#fff"></i>' : ''}
        </span>
        <span>${_gpEsc(m.label)}${_XM_PEAK_METRICS.has(m.key) ? ' <span style="font-size:9.5px;color:var(--cm-fg-muted)">(pico)</span>' : ''}</span>`;
      row.addEventListener('click', e => {
        e.stopPropagation();
        if (isOn) {
          if (active.size <= 1) { showToast('Pick at least one metric'); return; }
          active.delete(m.key);
        } else {
          active.add(m.key);
        }
        const ex = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
        card.dataset.config = JSON.stringify({ ...ex, metrics: [...active] });
        saveLayout('ind');
        if (_xmLastReport) renderMatchMax(_xmLastReport).catch(() => {});
        pop.remove();
        _openXmatchMetricsEditor(card, anchor);
      });
      pop.appendChild(row);
    });
  }
  buildPop();
  _posPopover(pop, anchor);
}

// ── Weekly volume · wk-on-wk (last-5-MC % change) ─────────────
const _WB_CORE_COLS = new Set([
  'total_distance','high_speed_distance','very_high_speed_distance',
  'sprint_distance','accelerations','decelerations','max_speed',
  'player_load','avg_speed','hmld','time_played','sprint_count','distance_per_minute',
]);

async function renderWeeklyBars(state) {
  const container = document.getElementById('wkok-bars');
  const legendEl  = document.getElementById('wkok-legend');
  if (!container) return;
  const clubId = window._gpClubId;
  // La filter bar es la fuente autoritativa de selección: si hay jugador elegido usamos
  // ese; si está en "All players" (sin selección) → pid null → agregado de equipo.
  // (No confiamos en state.playerId: el caller de Player Week Report lo fuerza a list[0].)
  const _fbState = window.gpFilterBar?.getState?.();
  const pid = _fbState ? ((_fbState.playerIds || []).find(Boolean) || null)
                       : (state?.playerId || null);
  // Sin jugador elegido ("All players") → agregado de equipo (promedio del plantel
  // por microciclo). Con jugador elegido → solo ese jugador.
  const rosterIds = (Array.isArray(window._gpPlayerIds) && window._gpPlayerIds.length) ? window._gpPlayerIds : null;
  const scopePlayers = pid ? [pid] : rosterIds;
  const teamMode = !pid;

  if (!clubId || !scopePlayers) {
    container.innerHTML = `<div style="padding:20px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">${tt('gps_analysis.select_player_wkok', 'Select a player to view wk-on-wk load change.')}</div>`;
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  const card = document.getElementById('card-weekly-bars');
  const metricKey    = card?.dataset.metricKey || 'player_load';
  const cfg          = (() => { try { return JSON.parse(card?.dataset.config || '{}'); } catch { return {}; } })();
  const threshYellow = Number(cfg.wkok_yellow ?? 15);
  const threshRed    = Number(cfg.wkok_red    ?? 20);

  container.innerHTML = '<div style="padding:12px;color:var(--cm-fg-muted);font:500 11.5px/1 var(--cm-font-sans)">Loading…</div>';
  if (legendEl) legendEl.innerHTML = '';

  // Candidate MCs — up to 10 newest from global list (newest-first order).
  // GPS-imported sessions carry no microcycle_id (the import wizard never links
  // them), so we bucket sessions into microcycles by date range [start_date,
  // end_date] and only fall back to the FK when it is already set (Daily Planning).
  const mcList     = window._pwMcList || [];
  // Scope a la temporada activa: nunca comparar contra microciclos de temporadas
  // pasadas. Con el pill de temporada activo usamos su [from,to] (y season_id si el
  // microciclo lo tiene); sin temporada activa se cae a "los 10 más recientes".
  const _fbDate = (window.gpFilterBar?.getState?.() || {}).date || {};
  const _seasonActive = !!(_fbDate.seasonId || _fbDate.preset === 'season' || _fbDate.preset === 'currentSeason');
  const _sId = _fbDate.seasonId || null;
  const _sFrom = _seasonActive ? (_fbDate.from || null) : null;
  const _sTo   = _seasonActive ? (_fbDate.to   || null) : null;
  const _inSeason = (mc) => {
    if (!_seasonActive) return true;
    if (_sId && mc.season_id) return mc.season_id === _sId;      // etiquetado explícito
    // Solapamiento con la ventana de temporada (no contención): un microciclo puede
    // empezar días antes del inicio oficial (pretemporada) y pertenecer igual.
    return (!_sFrom || mc.end_date >= _sFrom) && (!_sTo || mc.start_date <= _sTo);
  };
  // Guard al momento de dibujar contra la race de pwInit (si _pwMcList se armó antes
  // de que window._gpTeamId estuviera seteado, podría traer microciclos de otros equipos).
  const _teamId = window._gpTeamId || null;
  const _inTeam = (mc) => !_teamId || !mc.team_id || mc.team_id === _teamId;
  const candidates = mcList
    .filter(mc => mc.start_date && mc.end_date && _inTeam(mc) && _inSeason(mc))
    .slice(0, 10);

  if (!candidates.length) {
    container.innerHTML = `<div style="padding:20px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">${tt('gps_analysis.wkok_no_microcycles', 'No microcycles available.')}</div>`;
    return;
  }

  const candidateMcIds = candidates.map(mc => mc.id);
  const winStart = candidates.reduce((m, mc) => mc.start_date < m ? mc.start_date : m, candidates[0].start_date);
  const winEnd   = candidates.reduce((m, mc) => mc.end_date   > m ? mc.end_date   : m, candidates[0].end_date);
  const _mcForDate = (d) => candidates.find(mc => d >= mc.start_date && d <= mc.end_date)?.id || null;

  // Fetch every session in the covering date window, then assign each to its MC.
  // No filtramos sesiones por team_id: las importadas por GPS suelen tenerlo null.
  // El scope de equipo lo da el player_id (roster) al leer gps_reports más abajo,
  // y los candidateMcIds ya están acotados al equipo activo (window._pwMcList).
  const { data: allSess } = await window.sb.from('training_sessions')
    .select('id,session_date,microcycle_id')
    .eq('club_id', clubId)
    .gte('session_date', winStart)
    .lte('session_date', winEnd);

  const sessionsByMc = {};
  (allSess || []).forEach(s => {
    const mcId = (s.microcycle_id && candidateMcIds.includes(s.microcycle_id))
      ? s.microcycle_id
      : _mcForDate(s.session_date);
    if (!mcId) return;
    (sessionsByMc[mcId] = sessionsByMc[mcId] || []).push(s.id);
  });

  const allSids = Object.values(sessionsByMc).flat();
  if (!allSids.length) {
    container.innerHTML = `<div style="padding:20px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">${tt('gps_analysis.wkok_no_session_data', 'No session data for these microcycles.')}</div>`;
    return;
  }

  // Fetch metric values scoped to the player (or the whole roster in team mode),
  // keyed by player → session so we can aggregate per microcycle either way.
  const loadByPlayerSid = {};   // player_id → { session_id → sum }
  const _add = (playerId, sid, v) => {
    (loadByPlayerSid[playerId] = loadByPlayerSid[playerId] || {});
    loadByPlayerSid[playerId][sid] = (loadByPlayerSid[playerId][sid] || 0) + v;
  };
  if (_WB_CORE_COLS.has(metricKey)) {
    const rpts = await window.cmFetchAll(() => window.sb.from('gps_reports')
      .select(`session_id,player_id,${metricKey}`)
      .eq('is_invalid', false)
      .in('session_id', allSids)
      .eq('club_id', clubId)
      .in('player_id', scopePlayers), { label: 'weeklybars.core' }).catch(() => []);
    (rpts || []).forEach(r => _add(r.player_id, r.session_id, r[metricKey] || 0));
  } else {
    const coreRows = await window.cmFetchAll(() => window.sb.from('gps_reports')
      .select('id,session_id,player_id')
      .eq('is_invalid', false)
      .in('session_id', allSids)
      .eq('club_id', clubId)
      .in('player_id', scopePlayers), { label: 'weeklybars.eav-ids' }).catch(() => []);
    const rptMeta = Object.fromEntries((coreRows || []).map(r => [r.id, { sid: r.session_id, pid: r.player_id }]));
    const rptIds  = (coreRows || []).map(r => r.id);
    if (rptIds.length) {
      const { data: eav } = await window.sb.from('gps_report_metrics')
        .select('report_id,value')
        .in('report_id', rptIds)
        .eq('metric_key', metricKey);
      (eav || []).forEach(r => {
        const m = rptMeta[r.report_id];
        if (m) _add(m.pid, m.sid, +r.value || 0);
      });
    }
  }

  // Compute total per MC. Per-jugador → total del jugador; equipo → promedio del
  // plantel (media de los totales por jugador que tienen datos en ese microciclo).
  const players = Object.keys(loadByPlayerSid);
  const mcTotals = candidateMcIds
    .map(mcId => {
      const sids = sessionsByMc[mcId] || [];
      const perPlayer = players
        .map(p => sids.reduce((sum, sid) => sum + (loadByPlayerSid[p][sid] || 0), 0))
        .filter(v => v > 0);
      const total = teamMode
        ? (perPlayer.length ? perPlayer.reduce((a, b) => a + b, 0) / perPlayer.length : 0)
        : (perPlayer[0] || 0);
      return { mcId, total, hasData: perPlayer.length > 0 };
    })
    .filter(d => d.hasData)
    .slice(0, 5)
    .reverse(); // chronological (oldest → newest)

  if (!mcTotals.length) {
    const _msg = teamMode
      ? tt('gps_analysis.wkok_no_gps_team', 'No GPS data for the team in recent microcycles.')
      : tt('gps_analysis.wkok_no_gps_player', 'No GPS data for this player in recent microcycles.');
    container.innerHTML = `<div style="padding:20px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">${_msg}</div>`;
    return;
  }

  // Compute % change vs previous MC
  const points = mcTotals.map((d, i) => {
    const prev = mcTotals[i - 1];
    const pct  = (prev && prev.total) ? Math.round((d.total - prev.total) / prev.total * 100) : null;
    const mcName = mcList.find(m => m.id === d.mcId)?.name || '—';
    return { mcName, total: d.total, pct };
  });

  // Semaphore color by absolute % vs editable thresholds
  function _wkCol(pct) {
    if (pct === null) return 'var(--cm-fg-muted)';
    const abs = Math.abs(pct);
    if (abs <= threshYellow) return 'var(--cm-success)';
    if (abs <= threshRed)    return 'var(--cm-warning)';
    return 'var(--cm-danger)';
  }

  const cat      = (window._gpCatalog || []).find(d => d.key === metricKey);
  const unit     = metricKey === 'total_distance' ? 'm' : (cat?.unit || 'AU');
  const maxTotal = Math.max(...points.map(p => p.total), 1);
  const BAR_MAX  = 110; // px available for bars (within 150px container minus labels)

  const _fmtVol = (v) => metricKey === 'total_distance' ? window.gpFmtDist(v) : Math.round(v) + ' ' + unit;
  container.innerHTML = points.map(p => {
    const barH   = Math.max(Math.round((p.total / maxTotal) * BAR_MAX), p.total > 0 ? 3 : 0);
    const col    = _wkCol(p.pct);
    // Primer microciclo = base (sin %); del 2º en adelante, aumento porcentual de carga.
    const pctLbl = p.pct !== null ? (p.pct >= 0 ? '+' : '') + p.pct + '%' : tt('gps_analysis.wkok_base', 'base');
    const totalFmt = _fmtVol(p.total);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%">
      <div style="height:16px;display:flex;align-items:center;justify-content:center">
        <span style="font:700 12px/1 var(--cm-font-sans);color:${col}">${pctLbl}</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;width:80%">
        <div style="background:${col};border-radius:3px 3px 0 0;height:${barH}px;transition:height .3s" title="${teamMode ? tt('gps_analysis.wkok_avg_player', 'avg/player') + ': ' : ''}${totalFmt}"></div>
      </div>
      <div style="height:15px;display:flex;align-items:center;justify-content:center">
        <span style="font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg)">${totalFmt}</span>
      </div>
      <div style="height:18px;display:flex;align-items:center;justify-content:center">
        <span style="font:500 10.5px/1.2 var(--cm-font-sans);color:var(--cm-fg-muted);text-align:center;white-space:nowrap;overflow:hidden;max-width:100%">${_gpEsc(p.mcName)}</span>
      </div>
    </div>`;
  }).join('');

  // Metric pick label (+ nota de agregado de equipo cuando corresponde)
  const metricPickEl = document.querySelector('[data-wb-metric-pick]');
  if (metricPickEl) {
    const _teamNote = teamMode ? ` · ${tt('gps_analysis.wkok_squad_avg', 'squad avg')}` : '';
    metricPickEl.innerHTML = `${_gpEsc(cat?.label || metricKey)}${_teamNote} <i class="ti ti-chevron-down"></i>`;
  }

  // Legend: semaphore key + ACWR note
  if (legendEl) {
    legendEl.innerHTML = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--cm-success)"></span>${tt('gps_analysis.wkok_legend_safe', `≤${threshYellow}% (safe)`, { n: threshYellow })}</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--cm-warning)"></span>${tt('gps_analysis.wkok_legend_caution', `${threshYellow + 1}–${threshRed}% (caution)`, { a: threshYellow + 1, b: threshRed })}</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--cm-danger)"></span>${tt('gps_analysis.wkok_legend_spike', `&gt;${threshRed}% (spike)`, { n: threshRed })}</span>
      <span style="flex:1"></span>
      <span style="font-style:italic;font-size:10.5px">${tt('gps_analysis.wkok_footer', 'Load progression / ACWR principle (Gabbett) — thresholds editable in ···')}</span>
    </div>`;
  }
}

// ── Threshold editor popover for wk-on-wk card ────────────────
function _openWkThreshEditor(card, anchor) {
  const cfg    = (() => { try { return JSON.parse(card?.dataset.config || '{}'); } catch { return {}; } })();
  const yellow = cfg.wkok_yellow ?? 15;
  const red    = cfg.wkok_red    ?? 20;

  const pop = document.createElement('div');
  pop.className = 'gp-popover';
  pop.style.cssText = 'min-width:210px;padding:12px 14px';
  pop.innerHTML = `
    <div style="font:600 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg);margin-bottom:10px">Risk thresholds (%)</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <label style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span>🟡 Yellow ≤</span>
        <input id="wkok-thresh-y" type="number" min="1" max="98" value="${yellow}"
          style="width:54px;padding:4px 6px;border:1px solid var(--cm-border-soft);border-radius:4px;background:var(--cm-bg-sunk);color:var(--cm-fg);font:600 12px/1 var(--cm-font-sans);text-align:center;outline:none">
      </label>
      <label style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span>🔴 Red &gt;</span>
        <input id="wkok-thresh-r" type="number" min="2" max="99" value="${red}"
          style="width:54px;padding:4px 6px;border:1px solid var(--cm-border-soft);border-radius:4px;background:var(--cm-bg-sunk);color:var(--cm-fg);font:600 12px/1 var(--cm-font-sans);text-align:center;outline:none">
      </label>
      <button id="wkok-thresh-save"
        style="margin-top:2px;padding:5px 12px;background:var(--cm-accent);color:#fff;border:none;border-radius:5px;font:600 11.5px/1 var(--cm-font-sans);cursor:pointer">
        Save
      </button>
    </div>`;
  _posPopover(pop, anchor);

  pop.querySelector('#wkok-thresh-save')?.addEventListener('click', () => {
    const y = Math.round(parseFloat(pop.querySelector('#wkok-thresh-y').value));
    const r = Math.round(parseFloat(pop.querySelector('#wkok-thresh-r').value));
    if (!isFinite(y) || !isFinite(r) || y < 1 || r < 2) { showToast('Ingresá valores válidos'); return; }
    if (r <= y) { showToast('Red threshold must be higher than yellow'); return; }
    const existing = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
    card.dataset.config = JSON.stringify({ ...existing, wkok_yellow: y, wkok_red: r });
    saveLayout('ind');
    closePop();
    renderWeeklyBars(window.gpState).catch(e => console.warn('renderWeeklyBars:', e));
    showToast(`Thresholds: ${y}% / ${r}%`);
  });
}

// ── Hook renderView to also update × match max + weekly bars ──
const _origRenderView = window.renderView;
window.renderView = async function () {
  await _origRenderView?.();
  const state   = window.gpState;
  const reports = window._gpReports;
  if (!reports?.length) return;
  const sel = (state.playerId ? reports.find(r => r.player_id === state.playerId) : null) || reports[0];
  if (sel) renderMatchMax(sel);
  renderWeeklyBars(state).catch(e => console.warn('renderWeeklyBars (renderView):', e));
};

// ── Baseline tooltip for KPI cards ────────────────────────────
async function annotateKpiCards() {
  const state   = window.gpState;
  const reports = window._gpReports;
  if (!reports?.length) return;
  const sel = (state.playerId ? reports.find(r => r.player_id === state.playerId) : null) || reports[0];
  if (!sel?.player_id || !window._gpClubId) return;

  const _distCard = document.querySelector('.gp-view[data-view="ind"] .gp-c[data-card-id="kpi-distance"]');
  const BL_MAP = [
    { kpiIdx: 0, metric: _distCard?.dataset.metricKey || 'total_distance' },
    { kpiIdx: 1, metric: 'high_speed_distance' },
    { kpiIdx: 2, metric: 'sprint_distance' },
  ];

  for (const { kpiIdx, metric } of BL_MAP) {
    const bl  = await window.getMatchBaseline(sel.player_id, metric, window._gpClubId);
    const kpi = document.querySelectorAll('.gp-view[data-view="ind"] .gp-kpi')[kpiIdx];
    if (!kpi) continue;

    // Raw value for this player (core metrics only; custom metrics show no variation)
    const val = _KPI_CORE_COLS?.has(metric) ? +(sel[metric] ?? 0) : null;

    // ── Variation indicator (.t): pct vs baseline + z-score vs squad ─
    const tEl = kpi.querySelector('.t');
    if (tEl && val != null && bl.baseline) {
      const pct    = (val - bl.baseline) / bl.baseline * 100;
      const sqVals = (window._gpReports || []).map(r => +(r[metric] || 0)).filter(v => v > 0);
      const mu     = sqVals.length ? sqVals.reduce((a, b) => a + b, 0) / sqVals.length : val;
      const sig    = sqVals.length > 1
        ? Math.sqrt(sqVals.map(v => (v - mu) ** 2).reduce((a, b) => a + b, 0) / sqVals.length) || 1
        : 1;
      const z      = (val - mu) / sig;
      const pSign  = pct >= 0 ? '+' : '';
      const zSign  = z   >= 0 ? '+' : '';
      const cls    = Math.abs(z) > 1.5 ? 'warn' : pct >= 0 ? 'up' : 'down';
      const arrow  = pct >= 0 ? 'ti-arrow-up-right' : 'ti-arrow-down-right';
      const flag   = Math.abs(z) >= 2 ? ` <span style="color:var(--cm-danger);font-weight:600">flag</span>` : '';
      tEl.innerHTML = `<span class="d ${cls}"><i class="ti ${arrow}"></i>${pSign}${Math.round(pct)}%</span> · z = ${zSign}${z.toFixed(1)}${flag}`;
    } else if (tEl) {
      tEl.innerHTML = '';
    }

    // ── Baseline line (.gp-bl-line) ───────────────────────────────────
    let blLine = kpi.querySelector('.gp-bl-line');
    if (!blLine) {
      blLine = document.createElement('div');
      blLine.className = 'gp-bl-line';
      blLine.style.cssText = 'font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:5px;display:flex;align-items:center;gap:4px';
      kpi.querySelector('.t')?.after(blLine);
    }
    if (bl.baseline) {
      const catEntry = (window._gpCatalog || []).find(e => e.key === metric);
      const unit = catEntry?.unit ?? (metric === 'total_distance' ? 'm' : metric.includes('distance') ? 'm' : '');
      const decs = catEntry?.decimals ?? 0;
      const blRaw = bl.baseline;   // total_distance is meters now (no /1000)
      const blDisp = decs === 0 ? Math.round(blRaw) : blRaw.toFixed(decs);
      const conf = bl.confidence === 'high' ? '✓' : '~';
      blLine.title = 'Baseline: avg of best matches · Miguel et al. 2022';
      blLine.innerHTML = `<i class="ti ti-target" style="font-size:10px"></i>Baseline ${blDisp}${unit ? ' ' + _gpEsc(unit) : ''} ${conf} (${bl.count} matches)`;
    } else if (bl.warning) {
      blLine.innerHTML = `<i class="ti ti-info-circle" style="font-size:10px;color:var(--cm-warning)"></i>${_gpEsc(bl.warning)}`;
    }
  }
}

// Trigger on initial load after IIFE completes
const _origScienceCards = window.gpRenderScienceCards;
window.gpRenderScienceCards = async function (reports, clubId) {
  await _origScienceCards?.(reports, clubId);
  const state = window.gpState;
  const sel   = (state.playerId ? reports.find(r => r.player_id === state.playerId) : null) || reports[0];
  if (sel) {
    renderMatchMax(sel);
    renderWeeklyBars(state).catch(e => console.warn('renderWeeklyBars (scienceCards):', e));
    annotateKpiCards();
  }
};

// ══════════════════════════════════════════════════════════════
// GPS Settings — loadGpsSettings + openGpsSettings modal
// ══════════════════════════════════════════════════════════════

const _GPS_METRIC_LABELS = {
  total_distance:           'Total distance',
  high_speed_distance:      'High speed distance',
  very_high_speed_distance: 'Very high speed',
  sprint_distance:          'Sprint distance',
  accelerations:            'Accelerations',
  decelerations:            'Decelerations',
  max_speed:                'Max speed',
  player_load:              'Player load',
  hmld:                     'HMLD',
  time_played:              'Time played',
  avg_speed:                'Avg speed',
};

// ── Manual / estimated GPS entry ──────────────────────────────
// When a Catapult device is off/broken/unrecorded, fill a player's session either with
// the TEAM AVERAGE of that session or by typing values. Rows are tagged source='avg'|'manual'.
const _MANUAL_GPS_METRICS = [
  { k:'total_distance', l:'Total distance', u:'m' },
  { k:'high_speed_distance', l:'HSR', u:'m' },
  { k:'very_high_speed_distance', l:'VHSR', u:'m' },
  { k:'sprint_distance', l:'Sprint distance', u:'m' },
  { k:'sprint_count', l:'Sprint count', u:'' },
  { k:'accelerations', l:'Accelerations', u:'' },
  { k:'decelerations', l:'Decelerations', u:'' },
  { k:'max_speed', l:'Max speed', u:'km/h' },
  { k:'avg_speed', l:'Avg speed', u:'km/h' },
  { k:'player_load', l:'Player load', u:'AU' },
  { k:'hmld', l:'HMLD', u:'m' },
  { k:'time_played', l:'Time played', u:'min' },
  { k:'distance_per_minute', l:'Distance / min', u:'m/min' },
];
async function openManualGpsModal() {
  const _esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clubId = window._gpClubId || (await window.getClubId?.());
  if (!clubId) return;
  // Need a reference team, else the roster is the WHOLE club and nobody can be flagged as an
  // alternate. Try, in order: the resolved GPS team, the switcher value, the saved active team.
  const teamId = window._gpTeamId || document.getElementById('gpsTeamSelect')?.value
    || sessionStorage.getItem('cal_active_team') || null;
  const ov = makeModal(tt('gps_analysis.manual_gps_title','Add GPS data'),
    `<div id="mgpBody"><div class="mgp-empty">${tt('common.loading','Loading…')}</div></div>`);
  const body = ov.querySelector('#mgpBody');

  let sQ = window.sb.from('training_sessions').select('id,session_date,session_type,title,team_id,season_id')
    .eq('club_id', clubId).order('session_date',{ascending:false}).limit(200);
  // DB pre-filter: this team's sessions + untagged ones (Catapult imports land team_id NULL).
  // Sessions tagged to ANOTHER team never come back. RLS still limits what the user can see.
  if (teamId) sQ = sQ.or(`team_id.eq.${teamId},team_id.is.null`);
  const [sessRes, rosterRes, dataRes, primRes, _seasons] = await Promise.all([
    sQ, _gpRoster(clubId, teamId),
    // cmFetchAll: this read easily exceeds PostgREST's 1000-row cap (squad × season of sessions);
    // a raw query silently truncates, so recent sessions counted as "no data" and vanished from
    // the 'With data' view even though their GPS was imported fine.
    window.cmFetchAll(() => window.sb.from('gps_reports').select('session_id')
      .eq('club_id', clubId).eq('is_invalid', false),
      // concurrency: clubs hold thousands of report rows (MKD ≈ 4k → 5 pages); parallel pages keep
      // the modal open in ~2 round trips instead of one slow sequential crawl.
      { label: 'manual-gps.reports', concurrency: 6 }).catch(() => []),
    // Ids of players whose PRIMARY membership is this team (same is_primary filter Top-Up /
    // Evaluations use). Everyone else in the roster is an alternate training up from another team.
    teamId ? window.cmTeamPlayers(teamId, 'id').eq('player_teams.is_primary', true)
           : Promise.resolve({ data: [] }),
    _gpLoadSeasons(clubId, teamId),
  ]);
  const _rawSessions = sessRes.data || [];
  const roster   = rosterRes.data || [];
  // Main squad = primary members of this team. If the set is empty (primaries never configured in
  // Squad) we can't tell alternates apart, so we flag nobody rather than wrongly hide the squad.
  const primaryIds = new Set((primRes?.data || []).map(r => r.id));
  const isGuest = p => !!(teamId && primaryIds.size && !primaryIds.has(p.id));
  const guestLabel = tt('gps_analysis.manual_alt_badge','Alternate');
  const hasGuests = roster.some(isGuest);
  // How many players already have data per session → shown as a badge so the user picks the
  // session that actually holds GPS (the Catapult one), not an empty duplicate.
  const _dataCount = {};
  (dataRes || []).forEach(r => { _dataCount[r.session_id] = (_dataCount[r.session_id] || 0) + 1; });
  // Current season = the one whose range contains today; if today is off-season, fall back to the
  // most recent (seasons come newest-first). Used to hide LAST season's sessions from the picker.
  const _today = (window.cmToday ? window.cmToday() : new Date().toISOString().slice(0,10));
  const _curSeason = (_seasons || []).find(s => String(s.start_date) <= _today && _today <= String(s.end_date))
                  || (_seasons || [])[0] || null;
  // A session is "this season" when tagged with its season_id, or (untagged) when its date falls
  // inside the season range. With no seasons configured we don't over-filter.
  const _inSeason = s => {
    if (!_curSeason) return true;
    if (s.season_id != null) return String(s.season_id) === String(_curSeason.id);
    return s.session_date && String(_curSeason.start_date) <= s.session_date && s.session_date <= String(_curSeason.end_date);
  };
  // Base scope — sessions that CAN receive manual GPS for THIS team: this team's (or an untagged
  // Catapult import), never in the future, current season only. Last season / other teams / future
  // planning placeholders are all dropped here.
  const _base = s => (!s.session_date || s.session_date <= _today)
      && _inSeason(s)
      && (!teamId || String(s.team_id)===String(teamId) || s.team_id==null);
  // Two views over that base: 'data' = only sessions that already hold GPS (clean default, hides
  // empty planning duplicates); 'all' = every base session, including days with no GPS yet so you
  // can still start one from scratch (e.g. a match whose devices failed). Toggle appears only when
  // there actually are empty sessions to reveal.
  const _dataSessions = _rawSessions.filter(s => _base(s) && !!_dataCount[s.id]);
  const _allSessions  = _rawSessions.filter(_base);
  const hasEmptySess  = _allSessions.length > _dataSessions.length;
  let sessScope = _dataSessions.length ? 'data' : 'all';
  const curSessions = () => sessScope==='all' ? _allSessions : _dataSessions;
  if (!_allSessions.length) { body.innerHTML = `<div class="mgp-empty">${tt('gps_analysis.manual_no_sessions','No sessions with GPS found for this team.')}</div>`; return; }

  body.innerHTML = `
    <label class="mgp-lbl">${tt('gps_analysis.manual_session','Session')}</label>
    ${hasEmptySess ? `<div class="mgp-seg mgp-teamf" id="mgpSessScope">
      <button type="button" data-s="data" class="${sessScope==='data'?'is-on':''}">${tt('gps_analysis.manual_sess_with_data','With data')}</button>
      <button type="button" data-s="all" class="${sessScope==='all'?'is-on':''}">${tt('gps_analysis.manual_sess_all','All')}</button>
    </div>` : ''}
    <div class="mgp-pick">
      <button type="button" class="mgp-ses-btn" id="mgpSesBtn" aria-expanded="false"><span class="mgp-ses-cur" id="mgpSesCur"></span><i class="ti ti-chevron-down mgp-ses-chev"></i></button>
      <div class="mgp-list mgp-ses-list" id="mgpSesList" role="listbox" hidden></div>
    </div>
    <input type="hidden" id="mgpSession">
    <div id="mgpStatus" class="mgp-status"></div>
    <label class="mgp-lbl">${tt('gps_analysis.manual_player','Player')}</label>
    ${hasGuests ? `<div class="mgp-seg mgp-teamf" id="mgpTeamFilter">
      <button type="button" data-f="squad" class="is-on">${tt('gps_analysis.manual_filter_squad','This team')}</button>
      <button type="button" data-f="all">${tt('gps_analysis.manual_filter_all','+ Alternates')}</button>
    </div>` : ''}
    <div class="mgp-pick">
      <div class="mgp-search"><i class="ti ti-search"></i><input type="text" id="mgpPlayerSearch" placeholder="${tt('gps_analysis.manual_player_search','Search player…')}"></div>
      <div class="mgp-list" id="mgpPlayerList" role="listbox"></div>
    </div>
    <select id="mgpPlayer" hidden></select>
    <label class="mgp-lbl">${tt('gps_analysis.manual_mode','Fill mode')}</label>
    <div class="mgp-seg" id="mgpMode">
      <button type="button" data-mode="avg" class="is-on">${tt('gps_analysis.manual_mode_avg','Team average')}</button>
      <button type="button" data-mode="avgpos">${tt('gps_analysis.manual_mode_avgpos','Position average')}</button>
      <button type="button" data-mode="manual">${tt('gps_analysis.manual_mode_manual','Manual')}</button>
      <button type="button" data-mode="complete">${tt('gps_analysis.manual_mode_complete','Complement')}</button>
    </div>
    <div id="mgpFields"></div>
    <div class="mgp-foot"><button class="cm-btn is-ghost is-sm" id="mgpCancel">${tt('common.cancel','Cancel')}</button><button class="cm-btn is-primary is-sm" id="mgpSave">${tt('gps_analysis.manual_save','Save data')}</button></div>`;

  let mode = 'avg', sessionReports = [], realReports = [], teamAvg = {};
  const metricKeys = _MANUAL_GPS_METRICS.map(m=>m.k);
  const posByPlayer = {}; roster.forEach(p=>{ posByPlayer[p.id] = p.position || ''; });
  const EST_SOURCES = ['manual','avg','avg_pos','partial'];
  const statusOf = pid => { const r = sessionReports.find(x=>x.player_id===pid); if (!r || r.is_invalid) return 'missing'; return EST_SOURCES.includes(r.source) ? 'est' : 'real'; };
  const _avg = reps => { const out={}; _MANUAL_GPS_METRICS.forEach(m=>{ const vals=reps.map(r=>r[m.k]).filter(v=>v!=null&&isFinite(v)); out[m.k]=vals.length?+(vals.reduce((s,x)=>s+ +x,0)/vals.length).toFixed(2):null; }); return out; };
  const selPid = () => body.querySelector('#mgpPlayer')?.value;
  const selPos = () => posByPlayer[selPid()] || '';
  const posReports = () => { const pos = selPos(); return pos ? realReports.filter(r => (posByPlayer[r.player_id]||'') === pos) : []; };
  const currentAvg = () => mode==='avgpos' ? _avg(posReports()) : teamAvg;

  // ── Availability reasons: WHY a player has no GPS this session (Availability page data) ──
  // availability rows for the session's date, keyed by player. Global statuses (injury/illness/
  // selección) apply anywhere; team-relative ones stored for ANOTHER team read as 'other_team'.
  let availByPid = {};
  const _TEAM_REL_AV = new Set(['available','partial','limited','unavailable','absent']);
  const _AV_REASON = {
    injured:     ['availability.tipInjured',    'injured',            'var(--cm-danger,#DC2626)'],
    sick:        ['availability.tipIllness',    'illness',            'var(--cm-violet,#7C3AED)'],
    away:        ['availability.tipAway',       'away',               'var(--cm-info,#2563EB)'],
    unavailable: ['availability.tipUnavailable','unavailable',        '#475569'],
    absent:      ['availability.tipAbsent',     'absent',             'var(--cm-fg-muted,#64748B)'],
    partial:     ['availability.tipPartial',    'partial',            'var(--cm-warning,#D97706)'],
    limited:     ['availability.tipPartial',    'partial',            'var(--cm-warning,#D97706)'],
    other_team:  ['availability.tipOtherTeam',  'with another team',  '#6366F1'],
  };
  function availReason(pid) {
    const e = availByPid[pid];
    if (!e) return null;
    let s = e.status;
    if (!s || s === 'available') return null;
    if (_TEAM_REL_AV.has(s) && e.team_id && teamId && String(e.team_id) !== String(teamId)) s = 'other_team';
    const d = _AV_REASON[s];
    return d ? { status: s, label: tt(d[0], d[1]), color: d[2] } : null;
  }
  function _reasonPill(rz, prefix) {
    return `<span class="mgp-reason" style="color:${rz.color};background:color-mix(in srgb,${rz.color} 12%,transparent);border-color:color-mix(in srgb,${rz.color} 32%,transparent)">${prefix?_esc(prefix)+' ':''}${_esc(rz.label)}</span>`;
  }

  // ── Session picker (custom dropdown replacing the OS-rendered <select>) ──────
  function _sesRowHTML(s, selId) {
    return `<button type="button" class="mgp-opt${s.id===selId?' is-sel':''}" data-sid="${_esc(s.id)}" role="option">`
      + `<span class="mgp-opt-num">${_esc(s.session_date)}</span>`
      + (s.session_type?`<span class="mgp-opt-pos">${_esc(s.session_type)}</span>`:'')
      + `<span class="mgp-opt-name">${_esc(s.title||'')}</span>`
      + (_dataCount[s.id]?`<span class="mgp-ses-count" title="${tt('gps_analysis.manual_st_real','with data')}">${_dataCount[s.id]}</span>`:'')
      + `</button>`;
  }
  function renderSesBtn() {
    const s = curSessions().find(x => x.id === body.querySelector('#mgpSession').value);
    body.querySelector('#mgpSesCur').innerHTML = s
      ? `<span class="mgp-opt-num">${_esc(s.session_date)}</span>${s.session_type?`<span class="mgp-opt-pos">${_esc(s.session_type)}</span>`:''}<span class="mgp-ses-cur-title">${_esc(s.title||'')}</span>${_dataCount[s.id]?`<span class="mgp-ses-count">${_dataCount[s.id]}</span>`:''}`
      : `<span class="mgp-ses-cur-title" style="color:var(--cm-fg-muted)">${tt('gps_analysis.manual_pick_session','Select a session…')}</span>`;
  }
  function renderSesList() {
    const selId = body.querySelector('#mgpSession').value;
    body.querySelector('#mgpSesList').innerHTML = curSessions().map(s => _sesRowHTML(s, selId)).join('');
    body.querySelectorAll('#mgpSesList .mgp-opt').forEach(el => el.addEventListener('click', () => { setSession(el.dataset.sid); closeSesList(); }));
  }
  function openSesList()  { const l=body.querySelector('#mgpSesList'); renderSesList(); l.hidden=false; body.querySelector('#mgpSesBtn').setAttribute('aria-expanded','true'); }
  function closeSesList() { body.querySelector('#mgpSesList').hidden=true; body.querySelector('#mgpSesBtn').setAttribute('aria-expanded','false'); }
  function setSession(sid) {
    const list = curSessions();
    if (!list.some(s => s.id === sid)) sid = list[0]?.id || '';
    body.querySelector('#mgpSession').value = sid;
    renderSesBtn();
    loadSession();
  }

  // Alternate players (isGuest, defined above) belong primarily to another team. Default view
  // ('squad') hides the ones with no GPS this session — they'd only be noise. Switch the filter
  // to 'all' to also list dataless alternates. Either way, alternates carry a team badge so you
  // can tell them apart from the core squad.
  let teamFilter = 'squad';
  const visibleRoster = () => roster.filter(p => {
    if (!isGuest(p)) return true;                       // own squad → always
    return teamFilter === 'all' || statusOf(p.id) !== 'missing';
  });
  const _sortedVisible = () => {
    const order = { missing:0, est:1, real:2 };
    return visibleRoster().map(p=>({p, st:statusOf(p.id)}))
      .sort((a,b)=> (order[a.st]-order[b.st]) || String(a.p.last_name||'').localeCompare(String(b.p.last_name||'')));
  };
  function renderStatus() {
    const vis  = visibleRoster();
    const miss = vis.filter(p=>statusOf(p.id)==='missing').length;
    const est  = vis.filter(p=>statusOf(p.id)==='est').length;
    // Break the players WITHOUT real data down by their availability reason, so "5 missing" also
    // tells you WHY (2 selección · 1 lesionado · …). Players with no availability record are just
    // missing with no explanation.
    const rzCounts = {};
    vis.forEach(p => {
      if (statusOf(p.id) === 'real') return;
      const rz = availReason(p.id);
      if (!rz) return;
      (rzCounts[rz.status] = rzCounts[rz.status] || { n:0, label:rz.label, color:rz.color }).n++;
    });
    const rzHTML = Object.values(rzCounts).map(r => _reasonPill(r, r.n)).join(' ');
    body.querySelector('#mgpStatus').innerHTML =
      `<span class="mgp-chip real">${vis.length-miss-est} ${tt('gps_analysis.manual_st_real','with data')}</span>`
      + (est?` <span class="mgp-chip est">${est} ${tt('gps_analysis.manual_st_est','estimated')}</span>`:'')
      + (miss?` <span class="mgp-chip miss">${miss} ${tt('gps_analysis.manual_st_missing','missing')}</span>`:'')
      + (rzHTML?`<span class="mgp-status-rz">${rzHTML}</span>`:'');
  }
  function renderPlayerList() {
    const listEl = body.querySelector('#mgpPlayerList'), sel = body.querySelector('#mgpPlayer');
    const term = (body.querySelector('#mgpPlayerSearch')?.value||'').trim().toLowerCase();
    const rows = _sortedVisible().filter(({p})=> !term ||
      `${p.number||''} ${p.position||''} ${p.first_name||''} ${p.last_name||''}`.toLowerCase().includes(term));
    if (!rows.length) { listEl.innerHTML = `<div class="mgp-list-empty">${tt('gps_analysis.manual_no_players','No players match.')}</div>`; return; }
    listEl.innerHTML = rows.map(({p,st})=>{
      const rz = st!=='real' ? availReason(p.id) : null;   // only explain players without real data
      return `<button type="button" class="mgp-opt${p.id===sel.value?' is-sel':''}" data-pid="${_esc(p.id)}" role="option">`
      + `<span class="mgp-dot st-${st}"></span>`
      + `<span class="mgp-opt-num">${p.number?('#'+_esc(p.number)):''}</span>`
      + (p.position?`<span class="mgp-opt-pos">${_esc(p.position)}</span>`:'')
      + `<span class="mgp-opt-name">${_esc((p.last_name||'')+' '+(p.first_name||''))}</span>`
      + (rz?_reasonPill(rz):'')
      + (isGuest(p)?`<span class="mgp-opt-team" title="${_esc(guestLabel)}"><i class="ti ti-arrows-exchange"></i>${_esc(guestLabel)}</span>`:'')
      + `</button>`;
    }).join('');
    listEl.querySelectorAll('.mgp-opt').forEach(el=>el.addEventListener('click',()=>{
      sel.value = el.dataset.pid; sel.dispatchEvent(new Event('change')); renderPlayerList();
    }));
  }
  function renderPlayers() {
    const sel = body.querySelector('#mgpPlayer'), cur = sel.value;
    const rows = _sortedVisible();
    sel.innerHTML = rows.map(({p})=>`<option value="${_esc(p.id)}">${_esc((p.last_name||'')+' '+(p.first_name||''))}</option>`).join('');
    if (cur && rows.some(({p})=>p.id===cur)) sel.value = cur;
    else if (rows.length) sel.value = rows[0].p.id;
    renderPlayerList();
  }
  function renderFields() {
    const wrap = body.querySelector('#mgpFields');
    if (mode==='manual') {
      wrap.innerHTML = `<div class="mgp-grid">${_MANUAL_GPS_METRICS.map(m=>`<label class="mgp-cell"><span class="k">${m.l}${m.u?' ('+m.u+')':''}</span><input type="number" step="any" data-mk="${m.k}" class="mgp-in sm"></label>`).join('')}</div>`;
      return;
    }
    if (mode==='complete') {
      // Top-up mode: the GPS captured part of the session (device died mid-way). Type only the
      // metrics you want to add/fix; blank inputs KEEP the value already stored (merge, not overwrite).
      const cur = sessionReports.find(x=>x.player_id===selPid());
      if (!cur || cur.is_invalid) {
        wrap.innerHTML = `<div class="mgp-empty">${tt('gps_analysis.manual_complete_nodata','This player has no data in this session yet — use Manual mode.')}</div>`;
        return;
      }
      wrap.innerHTML = `<div class="mgp-note">${tt('gps_analysis.manual_complete_note','Type only the metrics to add or fix — blank fields keep the existing value.')}</div>`
        + `<div class="mgp-grid">${_MANUAL_GPS_METRICS.map(m=>{ const ph = (cur[m.k]!=null) ? cur[m.k] : '—'; return `<label class="mgp-cell"><span class="k">${m.l}${m.u?' ('+m.u+')':''}</span><input type="number" step="any" data-mk="${m.k}" class="mgp-in sm" placeholder="${ph}"></label>`; }).join('')}</div>`;
      return;
    }
    const vals = currentAvg(), hasAvg = Object.values(vals).some(v=>v!=null);
    let note, emptyMsg;
    if (mode==='avgpos') {
      const pos = selPos(), n = posReports().length;
      note     = pos ? tt('gps_analysis.manual_avgpos_note','Saves the average of {n} {pos} player(s) with real data in this session:',{n,pos}) : tt('gps_analysis.manual_avgpos_nopos','The selected player has no position set — use Team average or Manual.');
      emptyMsg = pos ? tt('gps_analysis.manual_avgpos_none','No other {pos} player has real data in this session — use Team average or Manual.',{pos}) : tt('gps_analysis.manual_avgpos_nopos','The selected player has no position set — use Team average or Manual.');
    } else {
      note     = tt('gps_analysis.manual_avg_note','Saves this player with the team average of the selected session:');
      emptyMsg = tt('gps_analysis.manual_avg_none','No real data in this session to average — use Manual mode.');
    }
    wrap.innerHTML = hasAvg
      ? `<div class="mgp-note">${note}</div>
         <div class="mgp-grid">${_MANUAL_GPS_METRICS.map(m=>`<div class="mgp-cell"><span class="k">${m.l}</span><span class="v">${vals[m.k]!=null?vals[m.k]:'—'}${(vals[m.k]!=null&&m.u)?' '+m.u:''}</span></div>`).join('')}</div>`
      : `<div class="mgp-empty">${emptyMsg}</div>`;
  }
  async function loadSession() {
    const sid = body.querySelector('#mgpSession').value;
    const sDate = curSessions().find(s => s.id === sid)?.session_date || null;
    const [gpsRes, avRes] = await Promise.all([
      window.sb.from('gps_reports')
        .select('player_id,source,is_invalid,'+metricKeys.join(','))
        .eq('session_id', sid).eq('club_id', clubId),
      // Availability for THIS session's date → drives the "why no GPS" reasons.
      sDate ? window.sb.from('availability').select('player_id,status,team_id')
                .eq('club_id', clubId).eq('date', sDate).in('player_id', roster.map(p=>p.id))
            : Promise.resolve({ data: [] }),
    ]);
    sessionReports = gpsRes.data || [];
    // One row per player/date is the norm; if several exist, keep the one that carries a real reason
    // (a global injury/illness/selección) over a plain 'available'.
    availByPid = {};
    (avRes.data || []).forEach(r => {
      const cur = availByPid[r.player_id];
      if (!cur || (cur.status === 'available' && r.status !== 'available')) availByPid[r.player_id] = r;
    });
    realReports = sessionReports.filter(r=>!r.is_invalid && !EST_SOURCES.includes(r.source));
    teamAvg = _avg(realReports);
    renderStatus(); renderPlayers(); renderFields();
  }

  body.querySelector('#mgpSesBtn').addEventListener('click', () => {
    body.querySelector('#mgpSesList').hidden ? openSesList() : closeSesList();
  });
  // 'With data' (default, clean) ↔ 'All' (also shows sessions with no GPS yet, e.g. a match whose
  // devices failed) — both already scoped to this team + current season + past.
  body.querySelectorAll('#mgpSessScope button').forEach(b => b.addEventListener('click', () => {
    sessScope = b.dataset.s;
    body.querySelectorAll('#mgpSessScope button').forEach(x => x.classList.toggle('is-on', x===b));
    setSession(body.querySelector('#mgpSession').value);   // keep selection if still visible, else first
    if (!body.querySelector('#mgpSesList').hidden) renderSesList();
  }));
  // Close the session list when clicking anywhere outside the picker. Scoped to the overlay so the
  // listener dies with the modal (no leaked document handler that keeps the dropdown feeling stuck).
  ov.addEventListener('mousedown', e => {
    const pick = body.querySelector('#mgpSesBtn')?.parentElement;
    if (pick && !pick.contains(e.target)) closeSesList();
  });
  // Escape closes the open list first, then the whole modal. Self-removes once the modal is gone.
  function _mgpOnKey(e) {
    if (!ov.isConnected) { document.removeEventListener('keydown', _mgpOnKey); return; }
    if (e.key !== 'Escape') return;
    if (!body.querySelector('#mgpSesList').hidden) { closeSesList(); e.stopPropagation(); }
    else ov.remove();
  }
  document.addEventListener('keydown', _mgpOnKey);
  body.querySelector('#mgpPlayerSearch').addEventListener('input', renderPlayerList);
  body.querySelectorAll('#mgpTeamFilter button').forEach(b=>b.addEventListener('click',()=>{
    teamFilter = b.dataset.f;
    body.querySelectorAll('#mgpTeamFilter button').forEach(x=>x.classList.toggle('is-on',x===b));
    renderStatus(); renderPlayers();
  }));
  body.querySelector('#mgpPlayer').addEventListener('change', ()=>{ if (mode==='avgpos' || mode==='complete') renderFields(); });
  body.querySelectorAll('#mgpMode button').forEach(b=>b.addEventListener('click',()=>{ mode=b.dataset.mode; body.querySelectorAll('#mgpMode button').forEach(x=>x.classList.toggle('is-on',x===b)); renderFields(); }));
  body.querySelector('#mgpCancel').addEventListener('click',()=>ov.remove());
  body.querySelector('#mgpSave').addEventListener('click', async () => {
    const sid = body.querySelector('#mgpSession').value, pid = selPid();
    if (!sid || !pid) return;
    // 'complete' merges onto existing data by design, so it skips the overwrite prompt.
    if (mode!=='complete' && statusOf(pid)==='real' && !confirm(tt('gps_analysis.manual_overwrite','This player already has real data for this session. Overwrite it?'))) return;
    const row = { club_id: clubId, session_id: sid, player_id: pid, is_invalid: false, source: mode==='manual'?'manual':(mode==='avgpos'?'avg_pos':(mode==='complete'?'partial':'avg')) };
    if (mode==='manual') {
      _MANUAL_GPS_METRICS.forEach(m=>{ const el=body.querySelector(`[data-mk="${m.k}"]`); const v=el?el.value.trim():''; row[m.k] = (v==='')?null:+v; });
    } else if (mode==='complete') {
      // Upsert replaces the whole row, so seed every metric from the stored one; only typed inputs override.
      const cur = sessionReports.find(x=>x.player_id===pid);
      if (!cur || cur.is_invalid) { showToast(tt('gps_analysis.manual_complete_nodata','This player has no data in this session yet — use Manual mode.'), true); return; }
      _MANUAL_GPS_METRICS.forEach(m=>{ const el=body.querySelector(`[data-mk="${m.k}"]`); const v=el?el.value.trim():''; row[m.k] = (v==='') ? cur[m.k] : +v; });
    } else {
      const vals = currentAvg();
      if (!Object.values(vals).some(v=>v!=null)) {
        showToast(mode==='avgpos' ? tt('gps_analysis.manual_avgpos_none','No other {pos} player has real data in this session — use Team average or Manual.',{pos:selPos()}) : tt('gps_analysis.manual_avg_none','No real data in this session to average — use Manual mode.'), true);
        return;
      }
      _MANUAL_GPS_METRICS.forEach(m=>{ row[m.k] = vals[m.k]; });
    }
    const btn = body.querySelector('#mgpSave'); btn.disabled = true;
    const { error } = await window.sb.from('gps_reports').upsert(row, { onConflict:'player_id,session_id' });
    if (error) { btn.disabled=false; showToast(tt('gps_analysis.manual_save_fail','Save failed: ')+error.message, true); return; }
    ov.remove();
    showToast(tt('gps_analysis.manual_saved','GPS data saved.'));
    window.refreshDashboard?.();
  });

  // Default to the most recent session that actually has GPS data (skip empty duplicates).
  const _default = curSessions().find(s => _dataCount[s.id]) || curSessions()[0];
  setSession(_default?.id);
}
document.getElementById('gpManualBtn')?.addEventListener('click', openManualGpsModal);

async function loadGpsSettings(clubId) {
  if (!clubId) return { baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false };
  try {
    const { data } = await window.sb.from('club_gps_settings')
      .select('baseline_n, baseline_mode, active_metrics, acwr_model, include_archived')
      .eq('club_id', clubId).maybeSingle();
    return data
      ? { ...data, acwr_model: data.acwr_model || 'ewma' }
      : { baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false };
  } catch {
    return { baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false };
  }
}

function openGpsSettings() {
  const s = window._gpSettings || { baseline_n: 5, baseline_mode: 'personal', active_metrics: null, acwr_model: 'ewma', include_archived: false };
  const n    = s.baseline_n ?? 5;
  const mode = s.baseline_mode || 'personal';
  const acwrModel = s.acwr_model || 'ewma';
  const includeArchived = !!s.include_archived;
  const defaultMetrics = ['total_distance','high_speed_distance','sprint_distance','max_speed','accelerations','player_load'];
  const active = s.active_metrics || defaultMetrics;

  const _catalogForSettings = window._gpCatalog?.length
    ? window._gpCatalog
    : Object.entries(_GPS_METRIC_LABELS).map(([k, label]) => ({ key: k, label }));
  const metricsHTML = _catalogForSettings.map(({ key: k, label }) => `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 0">
      <input type="checkbox" name="metric" value="${k}" ${active.includes(k) ? 'checked' : ''}
        style="accent-color:var(--cm-accent);width:13px;height:13px">
      <span style="font:400 12px/1.3 var(--cm-font-sans);color:var(--cm-fg)">${label}</span>
    </label>`).join('');

  const body = `
    <div style="display:flex;flex-direction:column;gap:18px">
      <div>
        <div style="font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Reference matches (N)</div>
        <div style="display:flex;align-items:center;gap:10px">
          <input id="gpsSettingsN" type="number" min="3" max="10" value="${n}"
            style="width:60px;height:28px;padding:0 8px;border-radius:5px;border:1px solid var(--cm-border-soft);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 13px/1 var(--cm-font-sans);text-align:center">
          <span style="font:400 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)">Best N official matches for personal baseline (3–10)</span>
        </div>
      </div>
      <div>
        <div style="font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Baseline mode</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <label style="display:flex;align-items:baseline;gap:8px;cursor:pointer">
            <input type="radio" name="gpsMode" value="personal" ${mode === 'personal' ? 'checked' : ''}
              style="accent-color:var(--cm-accent);margin-top:1px;flex-shrink:0">
            <span>
              <span style="font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg)">Personal</span>
              <span style="font:400 11px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)"> — player's own best matches (Miguel et al. 2022)</span>
            </span>
          </label>
          <label style="display:flex;align-items:baseline;gap:8px;cursor:pointer">
            <input type="radio" name="gpsMode" value="position" ${mode === 'position' ? 'checked' : ''}
              style="accent-color:var(--cm-accent);margin-top:1px;flex-shrink:0">
            <span>
              <span style="font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg)">Position average</span>
              <span style="font:400 11px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)"> — positional mean across squad</span>
            </span>
          </label>
        </div>
      </div>
      <div>
        <div style="font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${tt('gps_analysis.settings_acwr_model','ACWR model')}</div>
        <select id="gpsAcwrModel" style="width:100%;height:30px;padding:0 8px;border-radius:5px;border:1px solid var(--cm-border-soft);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans)">
          <option value="ewma" ${acwrModel === 'ewma' ? 'selected' : ''}>${tt('gps_analysis.settings_acwr_ewma','EWMA (exponentially weighted)')}</option>
          <option value="ra" ${acwrModel === 'ra' ? 'selected' : ''}>${tt('gps_analysis.settings_acwr_ra','Rolling average')}</option>
        </select>
        <div style="font:400 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:6px">${tt('gps_analysis.settings_acwr_help','EWMA weights recent days more heavily. Rolling average treats all days in the window equally.')}</div>
        <div style="font:400 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:3px;font-style:italic">${tt('gps_analysis.settings_acwr_global','Applies to all ACWR displays across the app.')}</div>
      </div>
      <div>
        <div style="font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${tt('gps_analysis.settings_archived','Archived players')}</div>
        <label style="display:flex;align-items:baseline;gap:8px;cursor:pointer">
          <input type="checkbox" id="gpsSettingsArchived" ${includeArchived ? 'checked' : ''}
            style="accent-color:var(--cm-accent);width:13px;height:13px;margin-top:1px;flex-shrink:0">
          <span>
            <span style="font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg)">${tt('gps_analysis.settings_archived_include','Include archived players in cards')}</span>
            <span style="font:400 11px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)"> — ${tt('gps_analysis.settings_archived_help','off: they disappear from squad cards, matching the player selector. On: historical data keeps them.')}</span>
          </span>
        </label>
      </div>
      <div>
        <div style="font:600 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Active metrics in Z-score matrix</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">${metricsHTML}</div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px;border-top:1px solid var(--cm-border-soft)">
        <button class="cm-btn is-outline is-sm" id="gpsSettingsCancel">Cancel</button>
        <button class="cm-btn is-primary is-sm" id="gpsSettingsSave">Save settings</button>
      </div>
    </div>`;

  const ov = makeModal('GPS Settings', body);

  document.getElementById('gpsSettingsCancel').addEventListener('click', () => ov.remove());

  document.getElementById('gpsSettingsSave').addEventListener('click', async () => {
    const rawN       = parseInt(document.getElementById('gpsSettingsN').value, 10);
    const baseline_n = Math.min(10, Math.max(3, isNaN(rawN) ? 5 : rawN));
    const baseline_mode   = document.querySelector('input[name="gpsMode"]:checked')?.value || 'personal';
    const active_metrics  = [...document.querySelectorAll('input[name="metric"]:checked')].map(i => i.value);
    const acwr_model      = document.getElementById('gpsAcwrModel')?.value === 'ra' ? 'ra' : 'ewma';
    const include_archived = !!document.getElementById('gpsSettingsArchived')?.checked;

    const clubId = window._gpClubId;
    if (!clubId) return;

    const btn = document.getElementById('gpsSettingsSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = await window.sb.from('club_gps_settings').upsert(
      { club_id: clubId, baseline_n, baseline_mode, active_metrics, acwr_model, include_archived, updated_at: new Date().toISOString() },
      { onConflict: 'club_id' }
    );

    if (error) {
      showToast('Error saving settings: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Save settings';
      return;
    }

    window._gpSettings = { baseline_n, baseline_mode, active_metrics, acwr_model, include_archived };
    await window.gpsResolveArchivedIds?.();   // recalcula la lista con el ajuste nuevo
    window.invalidateSettingsCache?.(clubId);
    window.invalidateBaselineCache?.();
    ov.remove();
    showToast('GPS settings saved');
    window.renderView?.();
  });
}

document.getElementById('gpSettingsBtn')?.addEventListener('click', openGpsSettings);

// ── GPS Metrics Catalog ────────────────────────────────────────
function _catSlug(s) {
  const slug = (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/, '');
  return /^[a-z]/.test(slug) ? slug : ('m_' + slug) || 'metric';
}

async function openGpsMetricsCatalog() {
  const clubId = window._gpClubId;
  if (!clubId) { showToast('Club not loaded'); return; }

  const { data, error } = await window.sb
    .from('gps_metric_definitions')
    .select('id,key,label,unit,category,decimals,is_core,display_order,description')
    .eq('club_id', clubId)
    .order('display_order', { ascending: true });
  if (error) { showToast('Error loading catalog: ' + error.message); return; }

  let catalog = data || [];

  const ov = document.createElement('div');
  ov.className = 'gp-modal-overlay';
  ov.id = 'gpCatalogModal';
  const modal = document.createElement('div');
  modal.className = 'gp-modal wide';
  modal.style.cssText = 'max-height:88vh;display:flex;flex-direction:column;overflow:hidden';
  ov.appendChild(modal);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);

  function _sync() {
    window._gpCatalog = [...catalog];
    window.dispatchEvent(new CustomEvent('gps:catalog:updated', { detail: { clubId } }));
  }

  const CAT_COL = {
    distance: 'color:var(--cm-accent)', speed: 'color:#8b5cf6',
    acceleration: 'color:#f59e0b', load: 'color:#ef4444',
    time: 'color:#06b6d4', count: 'color:#10b981', custom: 'color:var(--cm-fg-muted)',
  };
  const CATS = ['custom','distance','speed','acceleration','load','time','count'];

  function _formHtml(mode, def) {
    const slug = mode === 'edit' ? def.key : '';
    return `<div style="padding:12px 14px;background:var(--cm-bg-soft);border-bottom:2px solid var(--cm-accent)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Label *</label>
          <input id="mfLabel" type="text" value="${_gpEsc(def?.label||'')}" placeholder="e.g. Player Load Slow"
            style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
          <div style="margin-top:2px;font:400 9.5px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted)">${
            mode === 'add'
              ? `key: <span id="mfKeyPrev"></span>`
              : (def?.is_core
                  // Las del sistema tienen la clave cableada en el código (columnas de gps_reports).
                  ? `key: <strong>${_gpEsc(slug)}</strong> (${tt('gps_analysis.cat_key_locked','system metric — key can\'t change')})`
                  : `<label style="display:block;margin-bottom:2px">${tt('gps_analysis.cat_key_label','key')}</label>
                     <input id="mfKey" type="text" value="${_gpEsc(slug)}" spellcheck="false"
                       style="width:100%;padding:4px 7px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 10.5px/1 var(--cm-font-mono);box-sizing:border-box">
                     <span style="display:block;margin-top:2px;color:var(--cm-fg-faint)">${tt('gps_analysis.cat_key_hint','Renaming it moves the data, the Catapult mapping and the cards that use it.')}</span>`)
          }</div>
        </div>
        <div>
          <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Unit</label>
          <input id="mfUnit" type="text" value="${_gpEsc(def?.unit||'')}" placeholder="m, km/h, AU…"
            style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);box-sizing:border-box">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Category *</label>
          <select id="mfCategory" style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans)">
            ${CATS.map(c=>`<option value="${c}" ${(def?.category||'custom')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px">Decimals (0–4)</label>
          <input id="mfDecimals" type="number" value="${def?.decimals??2}" min="0" max="4"
            style="width:100%;padding:5px 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans)">
        </div>
      </div>
      <div id="mfErr" style="display:none;font:500 10.5px/1.3 var(--cm-font-sans);color:var(--cm-danger);margin-bottom:6px"></div>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="cm-btn is-outline is-sm" id="mfCancel">Cancel</button>
        <button class="cm-btn is-primary is-sm" id="mfSave">${mode==='add'?'Add metric':'Save changes'}</button>
      </div>
    </div>`;
  }

  function _bindForm(container, mode, def) {
    if (mode === 'add') {
      const lbl = container.querySelector('#mfLabel');
      const kp  = container.querySelector('#mfKeyPrev');
      if (lbl && kp) lbl.addEventListener('input', () => { kp.textContent = _catSlug(lbl.value); });
    }
    container.querySelector('#mfCancel')?.addEventListener('click', () => {
      if (mode === 'add') {
        modal.querySelector('#catAddFormWrap').style.display = 'none';
      } else {
        const fr = container.closest('tr');
        if (fr) { fr.style.display = 'none'; fr.querySelector('td').innerHTML = ''; }
      }
    });
    container.querySelector('#mfSave')?.addEventListener('click', async () => {
      const label    = container.querySelector('#mfLabel').value.trim();
      const unit     = container.querySelector('#mfUnit').value.trim() || null;
      const category = container.querySelector('#mfCategory').value;
      const decimals = Math.max(0, Math.min(4, +(container.querySelector('#mfDecimals').value) || 2));
      const errDiv   = container.querySelector('#mfErr');
      if (!label) { errDiv.textContent = 'Label is required.'; errDiv.style.display = ''; return; }
      const btn = container.querySelector('#mfSave');
      btn.disabled = true; btn.textContent = 'Saving…';
      if (mode === 'add') {
        const key = _catSlug(label);
        if (!/^[a-z][a-z0-9_]*$/.test(key)) {
          errDiv.textContent = `Generated key "${key}" is invalid — label must start with a letter.`;
          errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Add metric'; return;
        }
        if (catalog.find(d => d.key === key)) {
          errDiv.textContent = `Key "${key}" already exists.`;
          errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Add metric'; return;
        }
        const newDef = {
          club_id: clubId, key, label, unit, category, decimals, is_core: false,
          display_order: 200 + catalog.filter(d => !d.is_core).length,
        };
        const { data: ins, error: e } = await window.sb.from('gps_metric_definitions').insert(newDef).select().single();
        if (e) { errDiv.textContent = e.message; errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Add metric'; return; }
        catalog = [...catalog, ins];
      } else {
        // Renombrar la CLAVE va por RPC: mueve datos, mapeo y cards en UNA transacción. Si se
        // hiciera con updates sueltos y fallara alguno, la métrica quedaría viva pero vacía.
        const newKey = (container.querySelector('#mfKey')?.value || '').trim();
        const _fail = m => { errDiv.textContent = m; errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Save changes'; };
        if (newKey && newKey !== def.key) {
          if (!/^[a-z][a-z0-9_]*$/.test(newKey)) return _fail(tt('gps_analysis.cat_key_invalid','The key must start with a letter and use only lowercase, numbers and underscore.'));
          if (catalog.some(d => d.key === newKey)) return _fail(tt('gps_analysis.cat_key_taken','A metric with that key already exists.'));
          const { data: moved, error: rErr } = await window.sb.rpc('gps_rename_metric_key',
            { p_club_id: clubId, p_old: def.key, p_new: newKey });
          if (rErr) return _fail(rErr.message);
          showToast(tt('gps_analysis.cat_key_renamed','Key renamed — {n} values moved',{ n: moved?.data_rows ?? 0 }));
          catalog = catalog.map(d => d.key === def.key ? { ...d, key: newKey } : d);
          def = { ...def, key: newKey };
          try { window.invalidateCatalogCache?.(clubId); window.GpBuilder?.refreshCatalog?.(clubId); } catch (_e) {}
        }
        const { data: upd, error: e } = await window.sb.from('gps_metric_definitions')
          .update({ label, unit, category, decimals }).eq('id', def.id).eq('club_id', clubId).select();
        if (e) { errDiv.textContent = e.message; errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Save changes'; return; }
        if (!upd || !upd.length) {   // 0 rows: RLS/permission — surface it instead of a silent no-op
          errDiv.textContent = 'No se pudo guardar (0 filas). Puede ser un permiso: el club activo no coincide con tu perfil.';
          errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Save changes'; return;
        }
        catalog = catalog.map(d => d.key === def.key ? { ...d, label, unit, category, decimals } : d);
      }
      _sync();
      render();
    });
  }

  function _confirmDelete(key) {
    const def = catalog.find(d => d.key === key);
    if (!def || def.is_core) return;
    const dOv = document.createElement('div');
    dOv.className = 'gp-modal-overlay is-nested';   // stacked above the catalog modal (950)
    const dModal = document.createElement('div');
    dModal.className = 'gp-modal'; dModal.style.maxWidth = '420px';
    dModal.innerHTML = `
      <div class="gp-modal-h"><h3>Delete metric</h3></div>
      <div class="gp-modal-body">
        <p style="font:400 12.5px/1.6 var(--cm-font-sans);color:var(--cm-fg);margin:0 0 10px">
          This will remove <strong>${_gpEsc(def.label)}</strong> (<code>${_gpEsc(def.key)}</code>) from the catalog.
          Historical data linked to it will be kept but no longer visible.
        </p>
        <p style="font:500 12px/1.4 var(--cm-font-sans);color:var(--cm-danger);margin:0 0 6px">Type <strong>DELETE</strong> to confirm</p>
        <input id="dConfInput" type="text" placeholder="DELETE"
          style="width:100%;padding:7px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1 var(--cm-font-sans);box-sizing:border-box;margin-bottom:8px">
        <div id="dConfErr" style="display:none;font:500 11px/1.3 var(--cm-font-sans);color:var(--cm-danger);margin-bottom:6px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="cm-btn is-outline is-sm" id="dCancelBtn">Cancel</button>
          <button class="cm-btn is-sm" style="background:var(--cm-danger);color:#fff;border-color:var(--cm-danger)" id="dConfBtn">Delete</button>
        </div>
      </div>`;
    dOv.appendChild(dModal); document.body.appendChild(dOv);
    dModal.querySelector('#dConfInput').focus();
    dModal.querySelector('#dCancelBtn').addEventListener('click', () => dOv.remove());
    dModal.querySelector('#dConfBtn').addEventListener('click', async () => {
      if (dModal.querySelector('#dConfInput').value.trim() !== 'DELETE') {
        dModal.querySelector('#dConfErr').textContent = 'Type DELETE exactly.';
        dModal.querySelector('#dConfErr').style.display = ''; return;
      }
      const btn = dModal.querySelector('#dConfBtn');
      btn.disabled = true; btn.textContent = 'Deleting…';
      const { error: e } = await window.sb.from('gps_metric_definitions')
        .delete().eq('id', def.id).eq('club_id', clubId);
      if (e) { dModal.querySelector('#dConfErr').textContent = e.message; dModal.querySelector('#dConfErr').style.display = ''; btn.disabled = false; btn.textContent = 'Delete'; return; }
      catalog = catalog.filter(d => d.key !== key);
      _sync(); dOv.remove(); render();
    });
  }

  function _showMerge(sourceKey) {
    const src = catalog.find(d => d.key === sourceKey);
    if (!src || src.is_core) return;
    const targets = catalog.filter(d => d.key !== sourceKey);
    if (!targets.length) { showToast('No other metrics to merge into'); return; }
    const mOv = document.createElement('div');
    mOv.className = 'gp-modal-overlay is-nested';   // stacked above the catalog modal (950)
    const mModal = document.createElement('div');
    mModal.className = 'gp-modal'; mModal.style.maxWidth = '440px';
    mModal.innerHTML = `
      <div class="gp-modal-h"><h3>Merge metric</h3></div>
      <div class="gp-modal-body">
        <p style="font:400 12.5px/1.6 var(--cm-font-sans);color:var(--cm-fg);margin:0 0 10px">
          Move all data from <strong>${_gpEsc(src.label)}</strong> into another metric, then delete <strong>${_gpEsc(src.label)}</strong>.
        </p>
        <label style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Merge into</label>
        <select id="mergeTarget" style="width:100%;padding:7px 10px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:500 12px/1.4 var(--cm-font-sans);margin-bottom:10px">
          ${targets.map(t=>`<option value="${_gpEsc(t.key)}">${_gpEsc(t.label)} (${_gpEsc(t.key)})</option>`).join('')}
        </select>
        <div id="mergeErr" style="display:none;font:500 11px/1.3 var(--cm-font-sans);color:var(--cm-danger);margin-bottom:6px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="cm-btn is-outline is-sm" id="mCancelBtn">Cancel</button>
          <button class="cm-btn is-primary is-sm" id="mConfBtn">Merge &amp; delete source</button>
        </div>
      </div>`;
    mOv.appendChild(mModal); document.body.appendChild(mOv);
    mModal.querySelector('#mCancelBtn').addEventListener('click', () => mOv.remove());
    mModal.querySelector('#mConfBtn').addEventListener('click', async () => {
      const targetKey = mModal.querySelector('#mergeTarget').value;
      const btn = mModal.querySelector('#mConfBtn');
      btn.disabled = true; btn.textContent = 'Merging…';
      // Delete source rows that would conflict (report already has targetKey)
      const { data: conflictReports } = await window.sb.from('gps_report_metrics')
        .select('report_id').eq('club_id', clubId).eq('metric_key', targetKey);
      const conflictIds = (conflictReports || []).map(r => r.report_id);
      if (conflictIds.length) {
        await window.sb.from('gps_report_metrics')
          .delete().eq('club_id', clubId).eq('metric_key', sourceKey).in('report_id', conflictIds);
      }
      const { error: e1 } = await window.sb.from('gps_report_metrics')
        .update({ metric_key: targetKey }).eq('club_id', clubId).eq('metric_key', sourceKey);
      if (e1) { mModal.querySelector('#mergeErr').textContent = e1.message; mModal.querySelector('#mergeErr').style.display = ''; btn.disabled = false; btn.textContent = 'Merge & delete source'; return; }
      const { error: e2 } = await window.sb.from('gps_metric_definitions')
        .delete().eq('id', src.id).eq('club_id', clubId);
      if (e2) { mModal.querySelector('#mergeErr').textContent = e2.message; mModal.querySelector('#mergeErr').style.display = ''; btn.disabled = false; btn.textContent = 'Merge & delete source'; return; }
      catalog = catalog.filter(d => d.key !== sourceKey);
      _sync(); mOv.remove(); render();
      showToast(`Merged "${src.label}" into target`);
    });
  }

  async function _reorder(key, dir) {
    const cust = catalog.filter(d => !d.is_core);
    const idx  = cust.findIndex(d => d.key === key);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= cust.length) return;
    const a = cust[idx], b = cust[swapIdx];
    await Promise.all([
      window.sb.from('gps_metric_definitions').update({ display_order: b.display_order }).eq('id', a.id).eq('club_id', clubId),
      window.sb.from('gps_metric_definitions').update({ display_order: a.display_order }).eq('id', b.id).eq('club_id', clubId),
    ]);
    catalog = catalog.map(d => {
      if (d.key === a.key) return { ...d, display_order: b.display_order };
      if (d.key === b.key) return { ...d, display_order: a.display_order };
      return d;
    }).sort((x, y) => x.display_order - y.display_order);
    _sync(); render();
  }

  function render() {
    const cc = catalog.filter(d => d.is_core).length;
    const cu = catalog.filter(d => !d.is_core).length;
    const custOnly = catalog.filter(d => !d.is_core);
    modal.innerHTML = `
      <div class="gp-modal-h">
        <h3>GPS metrics catalog</h3>
        <button class="gp-modal-x" id="catClose"><i class="ti ti-x"></i></button>
      </div>
      <div style="padding:10px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--cm-border-soft);flex-shrink:0">
        <span style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)">${catalog.length} metrics · ${cc} core · ${cu} custom</span>
        <button class="cm-btn is-outline is-sm" id="catAddBtn"><i class="ti ti-plus" style="font-size:13px"></i>Add metric</button>
      </div>
      <div id="catAddFormWrap" style="display:none;border-bottom:1px solid var(--cm-border-soft)"></div>
      <div style="overflow-y:auto;flex:1">
        <table class="gp-map-table" style="font-size:12px">
          <thead><tr>
            <th>Label</th><th>Key</th><th>Unit</th><th>Category</th>
            <th style="text-align:center">Dec</th><th>Source</th><th style="min-width:160px"></th>
          </tr></thead>
          <tbody>${catalog.map(d => {
            const custIdx = custOnly.indexOf(d);
            const isFirst = custIdx === 0;
            const isLast  = custIdx === custOnly.length - 1;
            const src = d.is_core
              ? `<span style="display:inline-flex;height:18px;padding:0 6px;border-radius:3px;background:var(--cm-bg-soft);border:1px solid var(--cm-border);font:600 9.5px/18px var(--cm-font-mono);color:var(--cm-fg-muted)">core</span>`
              : `<span style="display:inline-flex;height:18px;padding:0 6px;border-radius:3px;background:var(--cm-accent-soft);border:1px solid var(--cm-accent);font:600 9.5px/18px var(--cm-font-mono);color:var(--cm-accent)">custom</span>`;
            const actions = d.is_core ? `
              <button class="cm-btn is-ghost cat-edit" data-key="${_gpEsc(d.key)}" style="padding:1px 7px;font-size:11px">Edit</button>` : `
              <button class="cm-btn is-ghost cat-up" data-key="${_gpEsc(d.key)}" style="padding:1px 4px" ${isFirst?'disabled':''} title="Move up"><i class="ti ti-arrow-up" style="font-size:11px"></i></button>
              <button class="cm-btn is-ghost cat-down" data-key="${_gpEsc(d.key)}" style="padding:1px 4px" ${isLast?'disabled':''} title="Move down"><i class="ti ti-arrow-down" style="font-size:11px"></i></button>
              <button class="cm-btn is-ghost cat-edit" data-key="${_gpEsc(d.key)}" style="padding:1px 7px;font-size:11px">Edit</button>
              <button class="cm-btn is-ghost cat-merge" data-key="${_gpEsc(d.key)}" style="padding:1px 7px;font-size:11px">Merge</button>
              <button class="cm-btn is-ghost cat-delete" data-key="${_gpEsc(d.key)}" style="padding:1px 7px;font-size:11px;color:var(--cm-danger)">Delete</button>`;
            return `<tr data-key="${_gpEsc(d.key)}">
              <td style="font:500 12px/1 var(--cm-font-sans)">${_gpEsc(d.label)}</td>
              <td style="font:400 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">${_gpEsc(d.key)}</td>
              <td style="font:400 11px/1 var(--cm-font-mono)">${_gpEsc(d.unit||'—')}</td>
              <td><span style="font:500 11px/1 var(--cm-font-sans);${CAT_COL[d.category]||''}">${_gpEsc(d.category)}</span></td>
              <td style="text-align:center;font:500 11px/1 var(--cm-font-mono)">${d.decimals}</td>
              <td>${src}</td>
              <td style="white-space:nowrap">${actions}</td>
            </tr>
            <tr class="cat-edit-row" data-for="${_gpEsc(d.key)}" style="display:none">
              <td colspan="7" style="padding:0"></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;

    modal.querySelector('#catClose').addEventListener('click', () => ov.remove());

    modal.querySelector('#catAddBtn').addEventListener('click', () => {
      const wrap = modal.querySelector('#catAddFormWrap');
      if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
      wrap.style.display = '';
      wrap.innerHTML = _formHtml('add', null);
      _bindForm(wrap, 'add', null);
      wrap.querySelector('#mfLabel')?.focus();
    });

    modal.querySelectorAll('.cat-edit').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const def = catalog.find(d => d.key === key);
      // Close all open edit rows
      modal.querySelectorAll('.cat-edit-row').forEach(r => { r.style.display = 'none'; r.querySelector('td').innerHTML = ''; });
      const fr = modal.querySelector(`.cat-edit-row[data-for="${key}"]`);
      if (!fr) return;
      fr.style.display = '';
      fr.querySelector('td').innerHTML = _formHtml('edit', def);
      _bindForm(fr.querySelector('td'), 'edit', def);
      fr.scrollIntoView({ block: 'nearest' });
    }));

    modal.querySelectorAll('.cat-delete').forEach(btn => btn.addEventListener('click', () => _confirmDelete(btn.dataset.key)));
    modal.querySelectorAll('.cat-merge').forEach(btn => btn.addEventListener('click', () => _showMerge(btn.dataset.key)));
    modal.querySelectorAll('.cat-up').forEach(btn => btn.addEventListener('click', () => _reorder(btn.dataset.key, -1)));
    modal.querySelectorAll('.cat-down').forEach(btn => btn.addEventListener('click', () => _reorder(btn.dataset.key, 1)));
  }

  render();
}

document.getElementById('gpCatalogBtn')?.addEventListener('click', openGpsMetricsCatalog);
