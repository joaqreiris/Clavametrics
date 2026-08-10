// ══════════════════════════════════════════════════════════════
// Outliers (card en grp) — detección de outliers por sesión (olInit).
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en
// la misma posición → timing idéntico. IIFE autocontenido; usa el registro compartido
// window._gpScEdit/__cmRpcAvail (patrón idempotente || {}) y consumidores window.X?.().
// ══════════════════════════════════════════════════════════════
(function () {
  const _OL_MIN  = 3;
  const _OL_ALL  = [
    'total_distance','high_speed_distance','very_high_speed_distance',
    'sprint_distance','sprint_count','max_speed',
    'accelerations','decelerations','player_load',
  ];
  const _OL_LABELS = {
    total_distance:'Dist.', high_speed_distance:'HSR',
    very_high_speed_distance:'VHSR', sprint_distance:'Sprint',
    sprint_count:'N spr.', max_speed:'Vel.máx.',
    accelerations:'Acel.', decelerations:'Desac.', player_load:'P.Load',
  };
  const _OL_PEAK = new Set(['max_speed']);

  function _olMdCode(sess) {
    if (!sess) return null;
    const off = sess.match_day_offset;
    if (off != null) {
      if (typeof off === 'string') return off || null;
      if (off === 0) return 'MD';
      return off < 0 ? `MD${off}` : `MD+${off}`;
    }
    return sess.session_attributes?.md_code || null;
  }

  let _olMetrics = [..._OL_ALL];
  let _olSortCol = null; // null = sort by totalDev, string key = sort by that metric

  // Background color: red for z<0, blue for z>0, intensity ∝ |z|, capped at 3
  function _olBg(z) {
    if (z == null || Math.abs(z) < 0.25) return '';
    const α = (Math.min(Math.abs(z), 3) / 3 * 0.72).toFixed(2);
    return z < 0 ? `rgba(220,38,38,${α})` : `rgba(59,130,246,${α})`;
  }

  // Build and inject the heatmap; reattaches sort listeners
  function _olDraw(matrix, thresh, mdCode, prevCount) {
    const body = document.getElementById('outliersBody');
    if (!body) return;

    const cols = _olMetrics;

    // Sort rows
    const sorted = [...matrix].sort((a, b) => {
      if (_olSortCol) {
        return Math.abs(b.zByMetric[_olSortCol] ?? 0) - Math.abs(a.zByMetric[_olSortCol] ?? 0);
      }
      return b.totalDev - a.totalDev;
    });

    const thCells = cols.map(k => {
      const isSrt = _olSortCol === k;
      return `<th class="ol-hm-th${isSrt ? ' is-sort' : ''}" data-key="${k}">${_OL_LABELS[k] || k}</th>`;
    }).join('');

    const bodyRows = sorted.map(({ player, zByMetric }) => {
      const name = player
        ? `${(player.first_name || '')[0] || '?'}. ${player.last_name || ''}`
        : '—';
      const tdCells = cols.map(k => {
        const z  = zByMetric[k];
        const bg = _olBg(z);
        const over = z != null && Math.abs(z) >= thresh;
        const txt = z == null ? '—' : `${z >= 0 ? '+' : ''}${z.toFixed(1)}`;
        return `<td class="${over ? 'is-thresh' : ''}" style="${bg ? 'background:' + bg : ''}"><div class="ol-hm-cell">${txt}</div></td>`;
      }).join('');
      return `<tr>
        <td class="ol-pc"><div class="ol-hm-cell">${name}</div></td>
        ${tdCells}
      </tr>`;
    }).join('');

    const noSort    = _olSortCol === null;
    const refDetail = prevCount > 0 ? ` · N equiv.=${prevCount}` : '';
    body.innerHTML = `
      <div style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-faint);padding:6px 10px 3px;text-transform:uppercase;letter-spacing:.04em">
        ${mdCode}${refDetail} · umbral |z|≥${thresh}${noSort ? ' · orden: desvío total' : ''}
      </div>
      <div class="ol-hm-wrap">
        <table class="ol-hm">
          <thead><tr>
            <th class="ol-pc ol-hm-th${noSort && !_olSortCol ? '' : ''}" data-key="">Player</th>
            ${thCells}
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;

    // Sort on column header click
    body.querySelectorAll('.ol-hm-th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        _olSortCol = (_olSortCol === k || k === '') ? null : k;
        _olDraw(matrix, thresh, mdCode, prevCount);
      });
    });
  }

  async function renderScOutliers() {
    const body = document.getElementById('outliersBody');
    if (!body) return;

    const st = window._scState;
    const sessionId = st?.sessionId;
    if (!sessionId || !window.sb) {
      body.innerHTML = '<div style="padding:12px 0 12px 10px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Pick a session to see the heatmap.</div>';
      return;
    }

    const compareSessionId = st?.compareSessionId;
    if (!compareSessionId) {
      body.innerHTML = '<div style="padding:12px 0 12px 10px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Pick a comparison date to see the outlier heatmap.</div>';
      return;
    }

    body.innerHTML = '<div style="padding:12px 0 12px 10px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Calculating…</div>';

    try {
      const thresh = parseFloat(document.getElementById('sc-outlier-thresh')?.value || '2');
      const clubId = window._gpClubId || await window.getClubId?.();
      if (!clubId) return;

      const [reports, { data: players }] = await Promise.all([
        window.cmFetchAll(() => _scopeTeam(window.sb.from('gps_reports')
          .select('session_id,player_id,total_distance,high_speed_distance,very_high_speed_distance,sprint_distance,sprint_count,max_speed,accelerations,decelerations,player_load')
          .eq('club_id', clubId)
          .eq('is_invalid', false)
          .in('session_id', [sessionId, compareSessionId])), { label: 'outliers-compare' })
          .catch(e => { console.error('[outliers compare] query failed:', e); return []; }),
        _gpRoster(clubId, window._gpTeamId),
      ]);

      const playerMap = Object.fromEntries((players || []).map(p => [p.id, p]));
      const curRpts   = (reports || []).filter(r => r.session_id === sessionId);
      const refRpts   = (reports || []).filter(r => r.session_id === compareSessionId);

      if (!refRpts.length) {
        body.innerHTML = '<div style="padding:12px 0 12px 10px;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">No GPS data in the comparison session.</div>';
        return;
      }

      // For each metric: compute reference squad mean/std from compare session
      const refStats = {};
      for (const key of _olMetrics) {
        const vals = refRpts.map(r => r[key]).filter(v => v != null && !isNaN(v));
        if (vals.length < 2) { refStats[key] = null; continue; }
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
        refStats[key] = { mean, std };
      }

      // Find compare session label (use _allSessions exposed by SC IIFE)
      const cmpSessObj = (window._scAllSessions || []).find(s => s.id === compareSessionId);
      const cmpLabel     = cmpSessObj?.session_date || compareSessionId.slice(0, 10);
      const cmpMdCode    = cmpSessObj ? _olMdCode(cmpSessObj) : '';

      const matrix = [];
      for (const cur of curRpts) {
        const player    = playerMap[cur.player_id];
        const zByMetric = {};
        let totalDev = 0;
        for (const key of _olMetrics) {
          const curVal = cur[key];
          const ref    = refStats[key];
          if (curVal == null || isNaN(curVal) || !ref || ref.std === 0) { zByMetric[key] = null; continue; }
          const z = (curVal - ref.mean) / ref.std;
          zByMetric[key] = z;
          totalDev += Math.abs(z);
        }
        matrix.push({ player, zByMetric, totalDev });
      }

      const headerLabel = `vs ${cmpLabel}${cmpMdCode ? ' · ' + cmpMdCode : ''}`;
      _olDraw(matrix, thresh, headerLabel, 0);

    } catch (e) {
      console.warn('renderScOutliers:', e);
      const body2 = document.getElementById('outliersBody');
      if (body2) body2.innerHTML = '<div style="padding:12px 0 12px 10px;color:var(--cm-fg-muted)">Calculation failed.</div>';
    }
  }

  // Metric editor modal
  function openOlMetricsModal() {
    const items = _OL_ALL.map(k => {
      const on = _olMetrics.includes(k);
      return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font:500 12px/1.2 var(--cm-font-sans);color:var(--cm-fg)">
        <input type="checkbox" value="${k}" ${on ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--cm-accent)">
        ${_OL_LABELS[k] || k}
      </label>`;
    }).join('');

    const ov = makeModal('Métricas — Outliers heatmap',
      `<div style="max-height:300px;overflow-y:auto;padding:4px 0 12px">${items}</div>
       <div style="display:flex;gap:8px;justify-content:flex-end">
         <button id="_olCancel" class="cm-btn is-outline" style="font-size:13px">Cancel</button>
         <button id="_olApply"  class="cm-btn is-filled"  style="font-size:13px">Apply</button>
       </div>`);

    ov.querySelector('#_olCancel')?.addEventListener('click', () => ov.remove());
    ov.querySelector('#_olApply')?.addEventListener('click', () => {
      const checked = [...ov.querySelectorAll('input[type=checkbox]:checked')].map(el => el.value);
      if (!checked.length) { showToast('Select at least one metric'); return; }
      _olMetrics = checked;
      const card = document.getElementById('card-outliers');
      if (card) {
        const cfg = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
        card.dataset.config = JSON.stringify({ ...cfg, metrics: _olMetrics });
        saveLayout('grp').catch(e => console.warn('ol saveLayout:', e));
      }
      ov.remove();
      renderScOutliers();
    });
  }

  window._scOutliersRender = renderScOutliers;

  async function olInit() {
    try {
      const layout = await loadLayout('grp');
      const saved  = layout?.find(c => c.card_id === 'outliers');
      if (saved?.config?.metrics?.length) _olMetrics = saved.config.metrics;
    } catch { /* defaults */ }

    (window._gpScEdit = window._gpScEdit || {}).outliers = openOlMetricsModal;   // click-to-edit dispatch
    document.getElementById('sc-outlier-edit-btn')?.addEventListener('click', openOlMetricsModal);
    document.getElementById('sc-outlier-thresh')?.addEventListener('change', () => renderScOutliers());
    document.getElementById('sc-compare-date-sel')?.addEventListener('change', () => setTimeout(renderScOutliers, 80));
    document.getElementById('sections')?.addEventListener('click', e => {
      if (e.target.closest?.('.gp-sec[data-view="grp"]')) setTimeout(renderScOutliers, 400);
    });
    if (document.querySelector('.gp-view[data-view="grp"].is-on')) {
      const poll = () => window._scState?.sessionId ? renderScOutliers() : setTimeout(poll, 500);
      setTimeout(poll, 700);
    }
  }

  olInit();
})();
