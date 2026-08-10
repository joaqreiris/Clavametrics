// ══════════════════════════════════════════════════════════════
// Z-score table (card en grp) — matriz z por jugador/métrica (ztInit/renderZt).
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en
// la misma posición → timing idéntico. IIFE autocontenido; usa el registro compartido
// window._gpScEdit/__cmRpcAvail (patrón idempotente || {}) y consumidores window.X?.().
// ══════════════════════════════════════════════════════════════
(function () {
  function _ztN() {
    const v = parseInt(document.getElementById('sc-zt-n-sel')?.value || '10', 10);
    return isNaN(v) || v <= 0 ? Infinity : v;
  }
  const _ZT_MIN = 3;

  // Metrics available directly in gps_reports columns
  const _ZT_CORE_COLS = new Set([
    'total_distance','high_speed_distance','very_high_speed_distance',
    'sprint_distance','sprint_count','max_speed',
    'accelerations','decelerations','player_load','time_played',
  ]);

  // max aggregation (pico); everything else = avg (acumulable)
  const _ZT_PEAK = new Set(['max_speed']);

  const _ZT_DEFAULTS = [
    'total_distance','high_speed_distance','sprint_count','player_load','max_speed',
  ];

  let _ztMetrics = [..._ZT_DEFAULTS];

  // ── label / unit / format helpers ────────────────────────────
  function _ztLabel(key) {
    const cat = (window._gpCatalog || []).find(d => d.key === key);
    if (cat?.label) return cat.label;
    return { total_distance:'Total Distance', high_speed_distance:'HSR',
             very_high_speed_distance:'VHSR', sprint_distance:'Sprint Dist',
             sprint_count:'Sprints', max_speed:'Max Speed',
             accelerations:'Accelerations', decelerations:'Decelerations',
             player_load:'Player Load', time_played:'Time Played' }[key]
           || key.replace(/_/g,' ');
  }

  function _ztUnit(key) {
    return (window._gpCatalog || []).find(d => d.key === key)?.unit || '';
  }

  function _ztFmt(v, key) {
    if (v == null || isNaN(v)) return '—';
    const dec = (window._gpCatalog || []).find(d => d.key === key)?.decimals
              ?? (key === 'max_speed' ? 1 : 0);
    return Number(v).toFixed(dec);
  }

  // squad avg (or max for pico metrics) of one session's reports
  function _ztSquadAgg(reports, key) {
    const vals = reports.map(r => r[key]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    return _ZT_PEAK.has(key) ? Math.max(...vals)
                              : vals.reduce((s,v) => s+v, 0) / vals.length;
  }

  // Extract MD code from a session (match_day_offset > session_attributes.md_code)
  function _ztMdCode(sess) {
    if (!sess) return null;
    const off = sess.match_day_offset;
    if (off != null) {
      if (typeof off === 'string') return off || null;
      if (off === 0) return 'MD';
      return off < 0 ? `MD${off}` : `MD+${off}`;
    }
    return sess.session_attributes?.md_code || null;
  }

  function _ztZClass(z) {
    if (z == null) return 'neu';
    const a = Math.abs(z);
    return a < 1 ? 'ok' : a < 2 ? 'warn' : 'high';
  }

  function _ztInterpret(z, mdCode) {
    if (z == null) return 'sin datos suficientes';
    const a   = Math.abs(z);
    const dir = z >= 0 ? 'por encima' : 'por debajo';
    const md  = mdCode ? ` para ${mdCode}` : '';
    if (a < 0.5) return `dentro de lo habitual${md}`;
    if (a < 1)   return `ligeramente ${dir} de lo habitual${md}`;
    if (a < 2)   return `${dir} de lo habitual${md}`;
    return `muy ${dir} de lo habitual${md}`;
  }

  // ── Main render (squad-only summary) ────────────────────────
  async function renderZt() {
    const body = document.getElementById('sc-zt-body');
    const nEl  = document.getElementById('sc-zt-n');
    if (!body) return;

    const st = window._scState;
    const sessionId = st?.sessionId;
    if (!sessionId || !window.sb) {
      body.innerHTML = '<div class="gp-empty" style="padding:16px 0">Select a session to see temporal variation.</div>';
      if (nEl) nEl.textContent = '—';
      return;
    }

    body.innerHTML = '<div style="padding:16px 0;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Calculating…</div>';

    try {
      const clubId = window._gpClubId || await window.getClubId?.();
      if (!clubId) return;

      // Fetch all sessions (lightweight — id, date, type, title + MD code fields)
      const { data: allSess, error: sErr } = await window.sb
        .from('training_sessions')
        .select('id,session_date,session_type,title,match_day_offset,session_attributes')
        .eq('club_id', clubId)
        .order('session_date', { ascending: false });
      if (sErr) throw sErr;

      const current  = (allSess || []).find(s => s.id === sessionId);
      if (!current) { body.innerHTML = '<div style="padding:16px 0;color:var(--cm-fg-muted)">Session not found.</div>'; return; }

      const matchKey = _ztMdCode(current);

      // Last _ZT_N sessions with the exact same MD code, strictly before current date
      const equivalents = (allSess || []).filter(s =>
        s.id !== sessionId &&
        s.session_date < current.session_date &&
        matchKey != null &&
        _ztMdCode(s) === matchKey
      ).slice(0, Number.isFinite(_ztN()) ? _ztN() : undefined);

      if (nEl) nEl.textContent = equivalents.length;

      if (!matchKey) {
        body.innerHTML = `<div style="padding:16px 0;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">
          Sin MD code definido para esta sesión — no se puede calcular variación temporal.
        </div>`;
        return;
      }

      if (equivalents.length < _ZT_MIN) {
        body.innerHTML = `<div style="padding:16px 0;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">
          Not enough equivalent ${matchKey} sessions (found: ${equivalents.length}, minimum: ${_ZT_MIN}).
        </div>`;
        return;
      }

      // Batch per-session squad aggregation. Prefer the server-side RPC (gps_session_agg,
      // migración 114): 1 fila por sesión en vez de squad×N filas crudas. Si el RPC no está
      // desplegado, cae al fetch crudo + agg en JS — números idénticos en ambos caminos.
      const allIds = [sessionId, ...equivalents.map(s => s.id)];
      const _roster = (Array.isArray(window._gpPlayerIds) && window._gpPlayerIds.length) ? window._gpPlayerIds : null;

      // Probe el RPC una sola vez por carga: si no está desplegado, no reintentar en cada
      // render (evita un round-trip fallido + ruido de consola hasta aplicar la migración).
      window.__cmRpcAvail = window.__cmRpcAvail || {};
      let aggBySession = null;   // { [session_id]: { <col>_avg, max_speed_max, … } }
      if (window.__cmRpcAvail.gps_session_agg !== false) {
        try {
          const { data: aggRows, error: aggErr } = await window.sb.rpc('gps_session_agg', {
            p_club_id: clubId, p_session_ids: allIds, p_player_ids: _roster,
          });
          if (aggErr) throw aggErr;
          window.__cmRpcAvail.gps_session_agg = true;
          if (Array.isArray(aggRows)) {
            aggBySession = {};
            for (const a of aggRows) aggBySession[a.session_id] = a;
          }
        } catch (aggErr) {
          window.__cmRpcAvail.gps_session_agg = false;
          console.warn('[squad vs] gps_session_agg RPC unavailable — raw fallback:', aggErr?.message || aggErr);
          aggBySession = null;
        }
      }

      let reports = null;
      if (!aggBySession) {
        try {
          reports = await window.cmFetchAll(() => _scopeTeam(window.sb
            .from('gps_reports')
            .select('session_id,player_id,total_distance,high_speed_distance,very_high_speed_distance,sprint_distance,sprint_count,max_speed,accelerations,decelerations,player_load,time_played')
            .eq('club_id', clubId)
            .eq('is_invalid', false)
            .in('session_id', allIds)), { label: 'squad-vs' });
        } catch (rErr) { console.error('[squad vs] query failed:', rErr); throw rErr; }
      }

      // Unifica ambos caminos: squad agg de una sesión+métrica (avg, o max para métricas pico).
      // RPC → lee la columna precalculada; crudo → pliega las filas de la sesión en JS.
      const _sessAgg = (sid, key) => {
        if (aggBySession) {
          const a = aggBySession[sid];
          if (!a) return null;
          const v = a[_ZT_PEAK.has(key) ? 'max_speed_max' : key + '_avg'];
          return (v == null || isNaN(v)) ? null : Number(v);
        }
        return _ztSquadAgg((reports || []).filter(r => r.session_id === sid), key);
      };

      // Historical series: one squad-avg value per equivalent session
      const histSeries = {};
      for (const key of _ztMetrics) {
        if (!_ZT_CORE_COLS.has(key)) { histSeries[key] = []; continue; }
        histSeries[key] = equivalents
          .map(s => _sessAgg(s.id, key))
          .filter(v => v != null && !isNaN(v));
      }

      // Build metric rows
      const rows = _ztMetrics.map(key => {
        const cur  = _sessAgg(sessionId, key);
        const hist = histSeries[key] || [];

        if (hist.length < _ZT_MIN || cur == null) {
          return `<div class="sc-zt-row">
            <span class="sc-zt-label">${_ztLabel(key)}</span>
            <span class="gp-zc neu" style="width:52px">—</span>
            <span class="sc-zt-text">not enough data</span>
          </div>`;
        }

        const mean  = hist.reduce((s,v) => s+v, 0) / hist.length;
        const variance = hist.reduce((s,v) => s + (v-mean)**2, 0) / hist.length;
        const std   = Math.sqrt(variance);
        const z     = std > 0 ? (cur - mean) / std : null;

        const sign  = z != null ? (z >= 0 ? '+' : '') : '';
        const zTxt  = z != null ? `${sign}${z.toFixed(1)}` : '—';
        const unit  = _ztUnit(key);
        const title = `Actual: ${_ztFmt(cur,key)}${unit?' '+unit:''} · Media equiv.: ${_ztFmt(mean,key)}${unit?' '+unit:''} (n=${hist.length})`;

        return `<div class="sc-zt-row" title="${title}">
          <span class="sc-zt-label">${_ztLabel(key)}</span>
          <span class="gp-zc ${_ztZClass(z)}" style="width:52px">${zTxt}</span>
          <span class="sc-zt-text">${_ztInterpret(z, matchKey)}</span>
        </div>`;
      });

      body.innerHTML = `
        <div style="font:600 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint);padding:8px 0 4px;text-transform:uppercase;letter-spacing:.04em">
          plantel · ${matchKey || 'sesión'} · N = ${equivalents.length}
        </div>
        ${rows.join('')}`;

    } catch (e) {
      console.warn('renderZt:', e);
      body.innerHTML = '<div style="padding:16px 0;color:var(--cm-fg-muted)">Calculation failed.</div>';
    }
  }

  // Expose so the SC IIFE sessSel handler can call it
  window._ztRender = renderZt;

  // ── Metric editor modal ──────────────────────────────────────
  function openZtMetricsModal() {
    const availKeys = (window._gpCatalog || []).filter(d => _ZT_CORE_COLS.has(d.key)).map(d => d.key);
    const keys = availKeys.length ? availKeys : [..._ZT_CORE_COLS];

    const items = keys.map(k => {
      const on = _ztMetrics.includes(k);
      return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font:500 12px/1.2 var(--cm-font-sans);color:var(--cm-fg)">
        <input type="checkbox" value="${k}" ${on ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--cm-accent)">
        ${_ztLabel(k)}${_ztUnit(k) ? ` <span style="color:var(--cm-fg-faint);font-size:10.5px">${_ztUnit(k)}</span>` : ''}
      </label>`;
    }).join('');

    const ov = makeModal('Métricas — Variation vs equivalents',
      `<div style="max-height:320px;overflow-y:auto;padding:4px 0 12px">${items}</div>
       <div style="display:flex;gap:8px;justify-content:flex-end">
         <button id="_ztCancel" class="cm-btn is-outline" style="font-size:13px">Cancel</button>
         <button id="_ztApply"  class="cm-btn is-filled"  style="font-size:13px">Apply</button>
       </div>`
    );

    ov.querySelector('#_ztCancel')?.addEventListener('click', () => ov.remove());
    ov.querySelector('#_ztApply')?.addEventListener('click', () => {
      const checked = [...ov.querySelectorAll('input[type=checkbox]:checked')].map(el => el.value);
      if (!checked.length) { showToast('Select at least one metric'); return; }
      _ztMetrics = checked;
      const card = document.getElementById('card-sc-zscore-temporal');
      if (card) {
        const cfg = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
        card.dataset.config = JSON.stringify({ ...cfg, metrics: _ztMetrics });
        saveLayout('grp').catch(e => console.warn('zt saveLayout:', e));
      }
      ov.remove();
      renderZt();
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  async function ztInit() {
    // Restore persisted metric selection
    try {
      const layout = await loadLayout('grp');
      const saved  = layout?.find(c => c.card_id === 'sc-zscore-temporal');
      if (saved?.config?.metrics?.length) _ztMetrics = saved.config.metrics;
    } catch { /* defaults */ }

    (window._gpScEdit = window._gpScEdit || {}).zt = openZtMetricsModal;   // click-to-edit dispatch
    document.getElementById('sc-zt-edit-btn')?.addEventListener('click', openZtMetricsModal);

    // Session change → re-render (slight delay so _scState.sessionId is updated)
    document.getElementById('sc-sess-sel')?.addEventListener('change', () => setTimeout(renderZt, 80));

    // N selector change → re-render
    document.getElementById('sc-zt-n-sel')?.addEventListener('change', () => renderZt());

    // grp tab activation
    document.getElementById('sections')?.addEventListener('click', e => {
      if (e.target.closest?.('.gp-sec[data-view="grp"]')) setTimeout(renderZt, 300);
    });

    // Auto-render if grp is already active on load
    if (document.querySelector('.gp-view[data-view="grp"].is-on')) {
      const poll = () => window._scState?.sessionId ? renderZt() : setTimeout(poll, 500);
      setTimeout(poll, 600);
    }
  }

  ztInit();
})();
