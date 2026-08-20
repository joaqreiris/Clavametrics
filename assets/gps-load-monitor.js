// ══════════════════════════════════════════════════════════════
// Load Monitor / ACWR gauges (vista mgrp) — gauges + tabla ACWR (lmLoad).
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en
// la misma posición → timing idéntico. IIFE autocontenido; usa el registro compartido
// window._gpScEdit/__cmRpcAvail (patrón idempotente || {}) y consumidores window.X?.().
// ══════════════════════════════════════════════════════════════
(function () {
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmtAcwr = v => v != null ? v.toFixed(2) : '—';

  // SVG semicircular gauge (value 0–2.0, zones from gpsACWR.ACWR_ZONES)
  function _gaugeSVG(value, label) {
    const cx = 100, cy = 92, r = 68, sw = 12, max = 2.0;
    const zones = window.gpsACWR?.ACWR_ZONES || [];

    function pt(v) {
      const a = Math.PI * (1 - v / max);
      return [+(cx + r * Math.cos(a)).toFixed(1), +(cy - r * Math.sin(a)).toFixed(1)];
    }
    function arc(v1, v2, color) {
      const [x1, y1] = pt(v1), [x2, y2] = pt(Math.min(v2, max));
      const span = (v2 - v1) / max;
      const large = span > 0.5 ? 1 : 0;
      return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="butt"/>`;
    }

    const v   = Math.min(max, Math.max(0, value ?? 0));
    const [nx, ny] = pt(v);
    const zone = window.gpsACWR?.getZone(v) || null;
    const zoneColors = { under:'rgba(139,92,246,.4)', sweet:'rgba(74,222,128,.5)', caution:'rgba(251,191,36,.6)', risk:'rgba(248,113,113,.5)' };

    return `<svg viewBox="0 0 200 110" style="width:100%;max-width:170px;display:block;margin:0 auto">
      ${arc(0,   0.8, zoneColors.under)}
      ${arc(0.8, 1.3, zoneColors.sweet)}
      ${arc(1.3, 1.5, zoneColors.caution)}
      ${arc(1.5, 2.0, zoneColors.risk)}
      ${value != null ? `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="var(--cm-fg)" stroke-width="2.5" stroke-linecap="round"/>` : ''}
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--cm-fg)"/>
      <text x="${cx}" y="${cy-22}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--cm-fg-strong)" font-family="Geist,system-ui">${fmtAcwr(value)}</text>
      <text x="${cx}" y="${cy-7}" text-anchor="middle" font-size="8.5" fill="var(--cm-fg-muted)" font-family="Geist Mono,monospace">${zone?.label || ''}</text>
      <text x="${cx}" y="${cy+9}" text-anchor="middle" font-size="9" fill="var(--cm-fg-muted)" font-family="Geist Mono,monospace">${label}</text>
      <text x="22" y="106" font-size="8" fill="var(--cm-fg-faint)" font-family="Geist Mono,monospace">0</text>
      <text x="178" y="106" text-anchor="end" font-size="8" fill="var(--cm-fg-faint)" font-family="Geist Mono,monospace">2.0</text>
    </svg>`;
  }

  // ── DOM ──────────────────────────────────────────────────────
  // Filtros viejos del dashboard (lm-refdate / lm-custom-date / lm-metric / Refresh /
  // lm-info) eliminados: la barra de desplegables (gpFilterBar) es la ÚNICA fuente de
  // filtrado. lmInfo queda como sink detached para no romper los mensajes de estado.
  const lmInfo      = document.getElementById('lm-info') || document.createElement('span');
  // Risk-alerts and ACWR-by-player cards were removed; keep detached sinks so the shared
  // lmLoad() (which still drives the ACWR gauges) can write to them harmlessly.
  const alertsBody  = document.getElementById('lm-alerts-body') || document.createElement('div');
  const gaugesBody  = document.getElementById('lm-gauges-body');
  const tableBody   = document.getElementById('lm-table-body') || document.createElement('div');
  const zoneFilter  = document.getElementById('lm-zone-filter');
  if (!gaugesBody) return;   // gauges card gone too → nothing to drive here

  let _playerAcwrData = null;
  let _playerMap      = {};
  let _lmSortKey      = 'player_load';
  let _lmSortDir      = -1;

  // ── load ─────────────────────────────────────────────────────
  async function lmLoad() {
    lmInfo.textContent = 'Calculating ACWR...';
    alertsBody.innerHTML = gaugesBody.innerHTML = tableBody.innerHTML =
      '<div style="padding:16px;color:var(--cm-fg-muted)">Calculating...</div>';

    try {
      const clubId = await window.getClubId?.();
      if (!clubId || !window.sb || !window.gpsACWR) { lmInfo.textContent = tt('gps_analysis.not_ready','Not ready.'); return; }

      // Fecha de referencia derivada de la barra (fin del rango elegido); null = hoy.
      const refDate = window.gpFilterBar?.getState?.()?.date?.to || null;

      const [playerAcwr, players] = await Promise.all([
        window.gpsACWR.calculatePlayerACWR({ clubId, refDate }),
        _gpRoster(clubId, window._gpTeamId),
      ]);

      _playerMap = Object.fromEntries((players.data || []).map(p => [p.id, p]));
      // Respect the active player/position filter (same predicate as the science chart) so gauges,
      // table and chart all show the SAME set under the same filter. calculatePlayerACWR is
      // club-wide; we narrow it here and recompute the team average from the filtered players.
      const _pred = _gpAcwrEffective(pid => _playerMap[pid]?.position);
      _playerAcwrData = Object.fromEntries(Object.entries(playerAcwr || {}).filter(([pid]) => _pred(pid)));

      // Team gauges = per-player → mean over the FILTERED set (matches the chart's aggregation).
      const teamAcwr = {};
      for (const m of (window.gpsACWR.ACWR_METRICS || [])) {
        const vals = Object.values(_playerAcwrData).map(p => p[m.key]).filter(v => v != null);
        teamAcwr[m.key] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      }

      const metricKey = 'player_load';   // métrica base ACWR (default); el ACWR no depende de ella
      lmInfo.textContent = `Ref: ${refDate || 'today'} · ${Object.keys(_playerAcwrData).length} players`;

      _renderGauges(teamAcwr);
      // Risk-alerts and ACWR-by-player cards were removed — only the gauges remain here.
    } catch (e) { console.error('lmLoad:', e); lmInfo.textContent = tt('gps_analysis.error_calc_acwr','Error calculating ACWR.'); }
  }

  // ── gauges ───────────────────────────────────────────────────
  function _renderGauges(teamAcwr) {
    if (!teamAcwr) { gaugesBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No training data in the last 28 days.</div>'; return; }
    const metrics = window.gpsACWR.ACWR_METRICS || [];
    gaugesBody.innerHTML = `<div class="gp-gauges-row">${
      metrics.map(m => `<div class="gp-gauge-wrap">${_gaugeSVG(teamAcwr[m.key], m.label)}</div>`).join('')
    }</div>`;
  }


  // ── table ────────────────────────────────────────────────────
  function _renderTable() {
    if (!_playerAcwrData || !Object.keys(_playerAcwrData).length) {
      tableBody.innerHTML = '<div style="padding:16px;color:var(--cm-fg-muted)">No data.</div>'; return;
    }
    const metrics  = window.gpsACWR.ACWR_METRICS || [];
    const getZone  = window.gpsACWR.getZone;
    const filter   = zoneFilter?.value || 'all';

    let entries = Object.entries(_playerAcwrData);

    // Zone filter
    if (filter === 'risk') {
      entries = entries.filter(([, d]) => metrics.some(m => getZone(d[m.key])?.cls === 'risk'));
    } else if (filter === 'caution') {
      entries = entries.filter(([, d]) => metrics.some(m => ['caution','risk'].includes(getZone(d[m.key])?.cls)));
    }

    // Sort
    entries.sort((a, b) => {
      if (_lmSortKey === 'player') {
        const an = (_playerMap[a[0]]?.last_name || '');
        const bn = (_playerMap[b[0]]?.last_name || '');
        return an.localeCompare(bn) * _lmSortDir;
      }
      const av = a[1][_lmSortKey] ?? -1;
      const bv = b[1][_lmSortKey] ?? -1;
      return (av - bv) * _lmSortDir;
    });

    const headers = `<tr>
      <th data-key="player" style="text-align:left">Player</th>
      <th data-key="sessCount" style="text-align:right">Sessions</th>
      ${metrics.map(m => `<th data-key="${m.key}">ACWR ${m.label}</th>`).join('')}
    </tr>`;

    const rows = entries.map(([pid, d]) => {
      const p    = _playerMap[pid] || {};
      const name = `${p.last_name || ''} ${(p.first_name||'')[0]||''}.`.trim();
      const pos  = p.position ? `<span style="font-size:10px;color:var(--cm-fg-muted)"> · ${esc(p.position)}</span>` : '';
      const sessWarn = d.insufficient ? ' <i class="ti ti-alert-triangle" style="color:var(--cm-warning);font-size:11px" title="Insufficient data"></i>' : '';

      const cells = metrics.map(m => {
        const v   = d[m.key];
        const z   = getZone(v);
        const cls = d.insufficient ? 'insuff' : (z?.cls || 'neu');
        return `<td><span class="lm-z ${cls}">${fmtAcwr(v)}</span></td>`;
      }).join('');

      return `<tr>
        <td>${esc(name)}${pos}</td>
        <td style="text-align:right">${d.sessCount}${sessWarn}</td>
        ${cells}
      </tr>`;
    }).join('');

    tableBody.innerHTML = `<table class="lm-tbl"><thead>${headers}</thead><tbody>${rows}</tbody></table>`;

    tableBody.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        if (_lmSortKey === th.dataset.key) _lmSortDir *= -1; else { _lmSortKey = th.dataset.key; _lmSortDir = -1; }
        _renderTable();
      });
    });
  }

  // ── events ───────────────────────────────────────────────────
  // La barra de desplegables es la única fuente: re-cargar ACWR al cambiar un filtro
  // (solo si mgrp está activo — el cálculo ACWR es costoso).
  document.addEventListener('gpfilter:change', () => {
    if (document.querySelector('.gp-view[data-view="mgrp"].is-on')) lmLoad();
  });
  // Filtro de zona dentro de la card (ACWR by player) — per-card, se mantiene.
  zoneFilter?.addEventListener('change', () => { if (_playerAcwrData) _renderTable(); });

  window._lmInit = lmLoad;

  document.getElementById('sections')?.addEventListener('click', e => {
    if (e.target.closest('.gp-sec[data-view="mgrp"]')) setTimeout(() => { if (!_playerAcwrData) lmLoad(); }, 0);
  });
})();
