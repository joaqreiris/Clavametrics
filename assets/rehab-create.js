/* ============================================================
   Rehab plan creation — shared helper (window.RehabCreate)
   Used by Rehab & Preventives.html (create modal, Entry A) and
   Injuries.html ("Create rehab plan", Entry B).

   A rehab plan links to an injury (rehab_plans.injury_id) and, at
   creation, COPIES the injury's clinical phases (injury_phases) into
   the plan's editable programme_phases. Editing programme_phases later
   never touches injury_phases. Preventive plans have no injury.
   ============================================================ */

(function () {
  'use strict';

  const WEEK_MS = 7 * 86400000;

  function tt(key, en, vars) {
    if (window.CM_I18N && CM_I18N.t) { const v = CM_I18N.t(key, vars); if (v && v !== key) return v; }
    let s = en;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : '{' + k + '}'));
    return s;
  }
  function fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString((window.CM_I18N && CM_I18N.current) || 'en', { month: 'short', day: 'numeric' }); }
    catch (_) { return String(d); }
  }

  // "Hamstring · BFlh · grade II · May 03"
  function injuryLabel(inj) {
    if (!inj) return '—';
    const bits = [];
    if (inj.injury_type) bits.push(inj.injury_type);
    if (inj.body_area) bits.push(inj.body_area);
    if (inj.bamic_grade) bits.push('grade ' + inj.bamic_grade);
    else if (inj.severity) bits.push(inj.severity);
    if (inj.start_date) bits.push(fmtDate(inj.start_date));
    return bits.join(' · ') || '—';
  }

  // A player's active injuries (not cleared), club-scoped.
  async function loadActiveInjuries(playerId, clubId) {
    if (!playerId || !clubId) return [];
    const { data, error } = await window.sb.from('injuries')
      .select('id, player_id, injury_type, body_area, severity, bamic_grade, status, start_date')
      .eq('club_id', clubId).eq('player_id', playerId)
      .in('status', ['active', 'returning'])
      .order('start_date', { ascending: false });
    if (error) { console.error('[rehab-create] active injuries fetch failed:', error); return []; }
    return data || [];
  }

  // COPY injury_phases → programme_phases for a freshly created plan (editable base).
  // Returns { count } or { error }. No-op (count 0) when the injury has no phases.
  async function seedProgrammePhasesFromInjury(planId, injuryId, clubId, planStartDate) {
    if (!planId || !injuryId || !clubId) return { count: 0 };
    const { data: phases, error } = await window.sb.from('injury_phases')
      .select('phase_number, phase_name, start_date, end_date, notes')
      .eq('injury_id', injuryId)
      .order('phase_number', { ascending: true });
    if (error) { console.error('[rehab-create] injury_phases fetch failed:', error); return { error }; }
    if (!phases || !phases.length) return { count: 0 };

    const planStart = planStartDate ? new Date(planStartDate) : null;
    let cursor = 1; // sequential week fallback / continuation
    const rows = phases.map((p, i) => {
      let ws, we;
      if (planStart && p.start_date) {
        ws = Math.max(1, Math.floor((new Date(p.start_date) - planStart) / WEEK_MS) + 1);
        we = p.end_date ? Math.max(ws, Math.floor((new Date(p.end_date) - planStart) / WEEK_MS) + 1) : ws;
      } else {
        ws = cursor; we = cursor;
      }
      cursor = we + 1;
      return {
        club_id: clubId,
        plan_id: planId,
        name: p.phase_name || (tt('rehab_planner.phase', 'Phase') + ' ' + (p.phase_number != null ? p.phase_number : i + 1)),
        week_start: ws,
        week_end: we,
        color: null,
        objective: p.notes || null,
        load_level: null,
        phase_order: (p.phase_number != null ? p.phase_number : i)
      };
    });

    const { error: insErr } = await window.sb.from('programme_phases').insert(rows);
    if (insErr) { console.error('[rehab-create] programme_phases insert failed:', insErr); return { error: insErr }; }
    return { count: rows.length };
  }

  // Entry B: open the injury's rehab plan if one exists, else create + seed, then navigate.
  async function openOrCreateForInjury(injury, clubId) {
    if (!injury || !injury.id || !clubId) return;
    // One rehab plan per injury → open the existing one.
    const { data: existing, error: exErr } = await window.sb.from('rehab_plans')
      .select('id').eq('injury_id', injury.id).eq('club_id', clubId).limit(1).maybeSingle();
    if (exErr) { console.error('[rehab-create] existing plan lookup failed:', exErr); }
    if (existing && existing.id) { location.href = 'Rehab Planner.html?plan=' + existing.id; return; }

    const today = cmToday();
    const { data, error } = await window.sb.from('rehab_plans').insert({
      club_id: clubId, player_id: injury.player_id, kind: 'rehab', injury_id: injury.id,
      status: 'on_track', programme_week: 1, programme_total_weeks: 8, start_date: today,
      name: injuryLabel(injury)
    }).select('id').single();
    if (error || !data) {
      console.error('[rehab-create] create plan from injury failed:', error);
      alert(tt('rehab_planner.np_err_create', 'Could not create plan') + (error ? ': ' + (error.message || error.code || '') : ''));
      return;
    }
    await seedProgrammePhasesFromInjury(data.id, injury.id, clubId, today);
    location.href = 'Rehab Planner.html?plan=' + data.id;
  }

  // ── Injury-history risk context (preventive plans) ─────────────────────────
  // Shared by the create modal (Rehab & Preventives.html) and the planner
  // (Rehab Planner.html): fetch a player's injuries (all statuses, club-scoped),
  // group by body_area into a frequency-sorted zone summary, and keep the full
  // list (most recent first) for the detail. Read-only; never throws.
  const _esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const _cap = s => { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  const _SEV_RANK  = { minor: 1, moderate: 2, severe: 3 };
  const _SEV_COLOR = { minor: '#EA580C', moderate: 'var(--cm-warning)', severe: 'var(--cm-danger)' };

  async function buildInjuryRiskContext(playerId, clubId) {
    const empty = { zones: [], injuries: [] };
    if (!playerId || !clubId) return empty;
    const { data, error } = await window.sb.from('injuries')
      .select('injury_type, body_area, severity, status, start_date')
      .eq('club_id', clubId).eq('player_id', playerId)
      .order('start_date', { ascending: false });
    if (error) { console.error('[rehab-create] injury risk fetch failed:', error); return empty; }
    const injuries = data || [];
    const byZone = {};
    injuries.forEach(inj => {
      const zone = (inj.body_area || '').trim();
      if (!zone) return;
      const key = zone.toLowerCase();
      const g = byZone[key] || (byZone[key] = { zone, count: 0, lastDate: null, maxSeverity: null });
      g.count++;
      if (inj.start_date && (!g.lastDate || inj.start_date > g.lastDate)) g.lastDate = inj.start_date;
      const sev = (inj.severity || '').toLowerCase();
      if (_SEV_RANK[sev] && (!g.maxSeverity || _SEV_RANK[sev] > _SEV_RANK[g.maxSeverity])) g.maxSeverity = sev;
    });
    const zones = Object.values(byZone).sort((a, b) =>
      b.count - a.count || String(b.lastDate || '').localeCompare(String(a.lastDate || '')));
    return { zones, injuries };
  }

  // ── Mobility / screening alerts (preventive) ───────────────────────────────
  // Punctual red-flag signals from evaluations (latest value per test), NOT the
  // full evaluations table. Conservative, evidence-based thresholds; tune here.
  // NOTE: evaluations stores one value per test (no side column), so ankle is the
  // worst-side WBLT cm and asymmetry alerts only fire when the value itself is a %.
  const MOBILITY_CFG = {
    fms:   { match: 'FMS',                 composite_max: 14   },  // score /21 · Kiesel et al. 2007
    ankle: { match: 'Ankle dorsiflexion',  min_cm: 7           },  // worst-side WBLT · Searle et al.
    hq:    { match: 'Isokinetic',          min_ratio: 0.55     },  // conventional H:Q ratio
    hip:   { match: 'Hip ER/IR',           asym_pct: 15        },  // only if the stored value is a %
    asym_pct: 15
  };
  const _round1 = x => Math.round(x * 10) / 10;
  const _isPct  = u => /%|percent|asym/i.test(String(u || ''));

  async function buildMobilityAlerts(playerId, clubId) {
    if (!playerId || !clubId) return [];
    const { data, error } = await window.sb.from('evaluations')
      .select('evaluation_type, test_date, value, unit')
      .eq('club_id', clubId).eq('player_id', playerId)
      .order('test_date', { ascending: false });
    if (error) { console.error('[rehab-create] mobility alerts fetch failed:', error); return []; }
    const rows = data || [];
    if (!rows.length) return [];
    // latest value for a test (rows are newest-first → first substring match wins)
    const latest = (match) => {
      const m = String(match).toLowerCase();
      const r = rows.find(x => String(x.evaluation_type || '').toLowerCase().includes(m) && x.value != null);
      return r ? { value: Number(r.value), unit: r.unit } : null;
    };
    const alerts = [];

    const fms = latest(MOBILITY_CFG.fms.match);
    if (fms && isFinite(fms.value) && fms.value < MOBILITY_CFG.fms.composite_max) {
      alerts.push({ test: 'fms', severity: 'high',
        message: tt('preventive.alert_fms', 'FMS {v}/21 — elevated injury risk', { v: fms.value }) });
    }
    const ank = latest(MOBILITY_CFG.ankle.match);
    if (ank && isFinite(ank.value)) {
      if (_isPct(ank.unit)) {
        if (ank.value >= MOBILITY_CFG.asym_pct) alerts.push({ test: 'ankle', severity: 'moderate',
          message: tt('preventive.alert_ankle_asym', 'Ankle dorsiflexion: {v}% L/R asymmetry', { v: Math.round(ank.value) }) });
      } else if (ank.value < MOBILITY_CFG.ankle.min_cm) {
        alerts.push({ test: 'ankle', severity: 'moderate',
          message: tt('preventive.alert_ankle_low', 'Ankle dorsiflexion {v} cm — limited (worth attention)', { v: _round1(ank.value) }) });
      }
    }
    const hq = latest(MOBILITY_CFG.hq.match);
    if (hq && isFinite(hq.value)) {
      let ratio = hq.value; if (ratio > 2) ratio = ratio / 100;   // stored as a percentage
      if (ratio > 0 && ratio < MOBILITY_CFG.hq.min_ratio) alerts.push({ test: 'hq', severity: 'moderate',
        message: tt('preventive.alert_hq', 'H:Q ratio {v} — low (worth attention)', { v: ratio.toFixed(2) }) });
    }
    const hip = latest(MOBILITY_CFG.hip.match);
    if (hip && isFinite(hip.value) && _isPct(hip.unit) && hip.value >= MOBILITY_CFG.hip.asym_pct) {
      alerts.push({ test: 'hip', severity: 'moderate',
        message: tt('preventive.alert_hip_asym', 'Hip ER/IR: {v}% L/R asymmetry', { v: Math.round(hip.value) }) });
    }
    return alerts;
  }

  const _ALERT_COLOR = { high: 'var(--cm-danger,#DC2626)', moderate: '#B45309', low: 'var(--cm-fg-muted)' };
  function mobilityAlertsHTML(alerts) {
    if (!alerts || !alerts.length) return '';
    const items = alerts.map(a => {
      const col = _ALERT_COLOR[a.severity] || _ALERT_COLOR.moderate;
      return '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;font:var(--cm-body-sm);color:var(--cm-fg)">'
        + '<span style="color:' + col + ';flex:none;font-weight:700">⚠</span><span>' + _esc(a.message) + '</span></div>';
    }).join('');
    return '<div style="margin:2px 0 12px">'
      + '<div style="font:600 11px/1 var(--cm-font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);margin-bottom:5px">'
      + _esc(tt('preventive.screening_alerts', 'Screening alerts')) + '</div>' + items + '</div>';
  }

  // Render the risk-context block (zone chips on top, screening alerts, injury detail below).
  // Returns an HTML string; caller injects it into its own container.
  function injuryRiskHTML(ctx, alerts) {
    const zones = (ctx && ctx.zones) || [];
    const injuries = (ctx && ctx.injuries) || [];
    const alertsBlock = mobilityAlertsHTML(alerts);
    const title = _esc(tt('preventive.risk_history', 'Risk history'));
    const head = '<div style="font:600 12px/1 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:2px">' + title + '</div>';
    if (!injuries.length) {
      return head + '<div style="font:var(--cm-body-sm);color:var(--cm-fg-muted);margin-bottom:' + (alertsBlock ? '10px' : '0') + '">'
        + _esc(tt('preventive.no_injury_history', 'No injury history — general prevention.')) + '</div>'
        + alertsBlock;
    }
    const chips = zones.map(z => {
      const col = _SEV_COLOR[z.maxSeverity] || 'var(--cm-fg-muted)';
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;'
        + 'background:color-mix(in srgb,' + col + ' 14%,transparent);color:' + col + ';'
        + 'border:1px solid color-mix(in srgb,' + col + ' 40%,transparent);font:600 11.5px/1 var(--cm-font-sans)">'
        + _esc(_cap(z.zone)) + ' ×' + z.count + '</span>';
    }).join('');
    const sepDot = '<span style="color:var(--cm-fg-faint)">·</span>';
    const list = injuries.map(inj => {
      const sev = (inj.severity || '').toLowerCase();
      const col = _SEV_COLOR[sev] || 'var(--cm-fg-muted)';
      const parts = [];
      if (inj.start_date) parts.push('<span style="font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-fg-muted)">' + _esc(fmtDate(inj.start_date)) + '</span>');
      if (inj.injury_type) parts.push('<span style="color:var(--cm-fg-strong)">' + _esc(inj.injury_type) + '</span>');
      if (inj.body_area)   parts.push('<span style="color:var(--cm-fg-muted)">' + _esc(_cap(inj.body_area)) + '</span>');
      if (sev)             parts.push('<span style="color:' + col + ';font-weight:600">' + _esc(tt('rehab_planner.sev_' + sev, _cap(sev))) + '</span>');
      return '<div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:6px 0;border-top:1px solid var(--cm-border-soft);font:var(--cm-body-sm)">' + parts.join(sepDot) + '</div>';
    }).join('');
    return head
      + '<div style="font:var(--cm-body-sm);color:var(--cm-fg-muted);margin-bottom:8px">' + _esc(tt('preventive.where_to_focus', 'Where to focus — most frequent injury zones')) + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + chips + '</div>'
      + alertsBlock
      + '<div>' + list + '</div>';
  }

  window.RehabCreate = { injuryLabel, loadActiveInjuries, seedProgrammePhasesFromInjury, openOrCreateForInjury, buildInjuryRiskContext, buildMobilityAlerts, injuryRiskHTML };
})();
