// ══════════════════════════════════════════════════════════════
// VS Session (card en grp) — comparativa contra una sesión de referencia (vsInit).
// Extraído de GPS Analysis.html sin cambios de comportamiento. <script src> PLANO en
// la misma posición → timing idéntico. IIFE autocontenido; usa el registro compartido
// window._gpScEdit/__cmRpcAvail (patrón idempotente || {}) y consumidores window.X?.().
// ══════════════════════════════════════════════════════════════
(function () {
  // Peak metrics: max agg; everything else = avg (acumulable)
  const _VS_PEAK = new Set(['max_speed','avg_speed','peak_speed']);
  const _VS_CORE_COLS = new Set([
    'total_distance','high_speed_distance','very_high_speed_distance',
    'sprint_distance','sprint_count','max_speed',
    'accelerations','decelerations','player_load','time_played',
  ]);
  const _VS_DEFAULTS = [
    'total_distance','high_speed_distance','sprint_count','player_load','max_speed',
  ];

  let _vsMetrics   = [..._VS_DEFAULTS];
  let _vsAllSess   = [];
  let _vsCacheClub = null;

  function _vsMdCode(sess) {
    if (!sess) return null;
    const off = sess.match_day_offset;
    if (off != null) {
      if (typeof off === 'string') return off || null;
      if (off === 0) return 'MD';
      return off < 0 ? `MD${off}` : `MD+${off}`;
    }
    return sess.session_attributes?.md_code || null;
  }

  function _vsLabel(key) {
    const cat = (window._gpCatalog || []).find(d => d.key === key);
    if (cat?.label) return cat.label;
    return { total_distance:'Total Distance', high_speed_distance:'HSR',
             very_high_speed_distance:'VHSR', sprint_distance:'Sprint Dist',
             sprint_count:'Sprints', max_speed:'Max Speed',
             accelerations:'Accelerations', decelerations:'Decelerations',
             player_load:'Player Load', time_played:'Time Played' }[key]
           || key.replace(/_/g,' ');
  }

  function _vsUnit(key) {
    return (window._gpCatalog || []).find(d => d.key === key)?.unit || '';
  }

  function _vsFmt(v, key) {
    if (v == null || isNaN(v)) return '—';
    const dec = (window._gpCatalog || []).find(d => d.key === key)?.decimals
              ?? (key === 'max_speed' ? 1 : 0);
    return Number(v).toFixed(dec);
  }

  function _vsSquadAgg(reports, key) {
    const vals = reports.map(r => r[key]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    return _VS_PEAK.has(key) ? Math.max(...vals)
                             : vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  async function _vsEnsureSessions(clubId) {
    if (_vsCacheClub === clubId && _vsAllSess.length) return;
    const { data } = await window.sb
      .from('training_sessions')
      .select('id,session_date,session_type,title,match_day_offset,session_attributes')
      .eq('club_id', clubId)
      .order('session_date', { ascending: false });
    _vsAllSess   = data || [];
    _vsCacheClub = clubId;
  }

  async function _buildVsOptions() {
    const sel = document.getElementById('sc-vs-compare-sel');
    if (!sel) return;
    const sessionId = window._scState?.sessionId;
    sel.innerHTML = '<option value="">' + tt('gps_analysis.compare_with','Compare with…') + '</option>';
    if (!sessionId || !window.sb) return;

    const clubId = window._gpClubId || await window.getClubId?.();
    if (!clubId) return;

    await _vsEnsureSessions(clubId);

    const current = _vsAllSess.find(s => s.id === sessionId);
    if (!current) return;
    const mdCode = _vsMdCode(current);
    if (!mdCode) {
      sel.innerHTML = '<option value="">Sin MD code definido</option>';
      return;
    }

    const candidates = _vsAllSess.filter(s =>
      s.id !== sessionId && _vsMdCode(s) === mdCode
    ).slice(0, 30);

    if (!candidates.length) {
      sel.innerHTML = `<option value="">No ${mdCode} sessions available</option>`;
      return;
    }
    sel.innerHTML = '<option value="">' + tt('gps_analysis.compare_with','Compare with…') + '</option>';
    candidates.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.session_date} · ${s.title || mdCode}`;
      sel.appendChild(o);
    });
  }

  async function renderVsSession() {
    const body = document.getElementById('sc-vs-body');
    if (!body) return;

    const sessionId = window._scState?.sessionId;
    const sel       = document.getElementById('sc-vs-compare-sel');
    const refId     = sel?.value || null;

    if (!sessionId) {
      body.innerHTML = '<div class="gp-empty" style="padding:16px 0;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Pick a session to see the comparison.</div>';
      return;
    }
    if (!refId) {
      body.innerHTML = '<div class="gp-empty" style="padding:16px 0;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Pick a reference session in the selector above.</div>';
      return;
    }
    if (!window.sb) return;

    body.innerHTML = '<div style="padding:16px 0;color:var(--cm-fg-muted);font:500 12px/1.4 var(--cm-font-sans)">Calculating…</div>';

    try {
      const clubId = window._gpClubId || await window.getClubId?.();
      if (!clubId) return;

      await _vsEnsureSessions(clubId);

      const _ids = [sessionId, refId];
      const _roster = (Array.isArray(window._gpPlayerIds) && window._gpPlayerIds.length) ? window._gpPlayerIds : null;

      // Prefer server-side per-session aggregation (RPC gps_session_agg, migración 114);
      // raw fallback si no está desplegado. Probe una vez por carga (window.__cmRpcAvail).
      window.__cmRpcAvail = window.__cmRpcAvail || {};
      let aggBySession = null;
      if (window.__cmRpcAvail.gps_session_agg !== false) {
        try {
          const { data: aggRows, error: aggErr } = await window.sb.rpc('gps_session_agg', {
            p_club_id: clubId, p_session_ids: _ids, p_player_ids: _roster,
          });
          if (aggErr) throw aggErr;
          window.__cmRpcAvail.gps_session_agg = true;
          if (Array.isArray(aggRows)) { aggBySession = {}; for (const a of aggRows) aggBySession[a.session_id] = a; }
        } catch (aggErr) {
          window.__cmRpcAvail.gps_session_agg = false;
          console.warn('[ref compare] gps_session_agg RPC unavailable — raw fallback:', aggErr?.message || aggErr);
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
            .in('session_id', _ids)), { label: 'ref-compare' });
        } catch (error) { console.error('[ref compare] query failed:', error); throw error; }
      }

      // Squad agg de una sesión+métrica: RPC (columna precalc, max para pico) o crudo (JS).
      const _sessAgg = (sid, key) => {
        if (aggBySession) {
          const a = aggBySession[sid];
          if (!a) return null;
          const v = a[_VS_PEAK.has(key) ? key + '_max' : key + '_avg'];
          return (v == null || isNaN(v)) ? null : Number(v);
        }
        return _vsSquadAgg((reports || []).filter(r => r.session_id === sid), key);
      };

      const refSess  = _vsAllSess.find(s => s.id === refId);
      const refLabel = refSess ? `${refSess.session_date} · ${refSess.title || _vsMdCode(refSess) || '—'}` : refId;
      const mdCode   = refSess ? (_vsMdCode(refSess) || '') : '';

      const rows = _vsMetrics.filter(k => _VS_CORE_COLS.has(k)).map(key => {
        const cur  = _sessAgg(sessionId, key);
        const ref  = _sessAgg(refId, key);
        const unit = _vsUnit(key);

        if (cur == null || ref == null) {
          return `<div class="sc-vs-row">
            <span class="sc-vs-label">${_vsLabel(key)}</span>
            <span class="sc-vs-pct neu">—</span>
            <span class="sc-vs-vals">no data</span>
          </div>`;
        }

        const pct    = ref !== 0 ? (cur - ref) / Math.abs(ref) * 100 : null;
        const pctStr = pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—';
        const cls    = pct == null ? 'neu' : pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'neu';
        const valStr = `${_vsFmt(cur, key)}${unit ? ' '+unit : ''} vs ${_vsFmt(ref, key)}${unit ? ' '+unit : ''}`;

        return `<div class="sc-vs-row">
          <span class="sc-vs-label">${_vsLabel(key)}</span>
          <span class="sc-vs-pct ${cls}">${pctStr}</span>
          <span class="sc-vs-vals">${valStr}</span>
        </div>`;
      });

      body.innerHTML = `
        <div style="font:600 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint);padding:8px 0 4px;text-transform:uppercase;letter-spacing:.04em">
          plantel · ${mdCode} · vs ${refLabel}
        </div>
        ${rows.join('') || '<div style="padding:12px 0;color:var(--cm-fg-muted)">No metrics selected.</div>'}`;

    } catch (e) {
      console.warn('renderVsSession:', e);
      body.innerHTML = '<div style="padding:16px 0;color:var(--cm-fg-muted)">Calculation failed.</div>';
    }
  }

  function openVsMetricsModal() {
    const availKeys = (window._gpCatalog || []).filter(d => _VS_CORE_COLS.has(d.key)).map(d => d.key);
    const keys = availKeys.length ? availKeys : [..._VS_CORE_COLS];

    const items = keys.map(k => {
      const on = _vsMetrics.includes(k);
      return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font:500 12px/1.2 var(--cm-font-sans);color:var(--cm-fg)">
        <input type="checkbox" value="${k}" ${on ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--cm-accent)">
        ${_vsLabel(k)}${_vsUnit(k) ? ` <span style="color:var(--cm-fg-faint);font-size:10.5px">${_vsUnit(k)}</span>` : ''}
      </label>`;
    }).join('');

    const ov = makeModal('Métricas — vs sesión',
      `<div style="max-height:320px;overflow-y:auto;padding:4px 0 12px">${items}</div>
       <div style="display:flex;gap:8px;justify-content:flex-end">
         <button id="_vsCancel" class="cm-btn is-outline" style="font-size:13px">Cancel</button>
         <button id="_vsApply"  class="cm-btn is-filled"  style="font-size:13px">Apply</button>
       </div>`
    );

    ov.querySelector('#_vsCancel')?.addEventListener('click', () => ov.remove());
    ov.querySelector('#_vsApply')?.addEventListener('click', () => {
      const checked = [...ov.querySelectorAll('input[type=checkbox]:checked')].map(el => el.value);
      if (!checked.length) { showToast('Select at least one metric'); return; }
      _vsMetrics = checked;
      const card = document.getElementById('card-sc-vs-session');
      if (card) {
        const cfg = (() => { try { return JSON.parse(card.dataset.config || '{}'); } catch { return {}; } })();
        card.dataset.config = JSON.stringify({ ...cfg, metrics: _vsMetrics });
        saveLayout('grp').catch(e => console.warn('vs saveLayout:', e));
      }
      ov.remove();
      renderVsSession();
    });
  }

  async function vsInit() {
    try {
      const layout = await loadLayout('grp');
      const saved  = layout?.find(c => c.card_id === 'sc-vs-session');
      if (saved?.config?.metrics?.length) _vsMetrics = saved.config.metrics;
    } catch { /* defaults */ }

    (window._gpScEdit = window._gpScEdit || {}).vs = openVsMetricsModal;   // click-to-edit dispatch
    document.getElementById('sc-vs-edit-btn')?.addEventListener('click', openVsMetricsModal);

    // Expose reload hook so _loadSessionData can notify this card on auto-selection
    window._vsReload = async () => {
      _vsCacheClub = null;
      const sel = document.getElementById('sc-vs-compare-sel');
      if (sel) sel.value = '';
      await _buildVsOptions();
      renderVsSession();
    };

    // Session change → rebuild options, clear selection, re-render
    document.getElementById('sc-sess-sel')?.addEventListener('change', () => window._vsReload?.());

    document.getElementById('sc-vs-compare-sel')?.addEventListener('change', () => renderVsSession());

    document.getElementById('sections')?.addEventListener('click', e => {
      if (e.target.closest?.('.gp-sec[data-view="grp"]')) {
        setTimeout(async () => { await _buildVsOptions(); renderVsSession(); }, 300);
      }
    });

    if (document.querySelector('.gp-view[data-view="grp"].is-on')) {
      const poll = () => {
        if (window._scState?.sessionId) { _buildVsOptions().then(renderVsSession); }
        else setTimeout(poll, 500);
      };
      setTimeout(poll, 700);
    }
  }

  vsInit().catch(e => console.warn('vsInit:', e));
})();
