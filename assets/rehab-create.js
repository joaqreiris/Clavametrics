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

  function tt(key, en) {
    if (window.CM_I18N && CM_I18N.t) { const v = CM_I18N.t(key); if (v && v !== key) return v; }
    return en;
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

    const today = new Date().toISOString().slice(0, 10);
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

  // Render the risk-context block (zone chips on top, injury detail below).
  // Returns an HTML string; caller injects it into its own container.
  function injuryRiskHTML(ctx) {
    const zones = (ctx && ctx.zones) || [];
    const injuries = (ctx && ctx.injuries) || [];
    const title = _esc(tt('preventive.risk_history', 'Risk history'));
    const head = '<div style="font:600 12px/1 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:2px">' + title + '</div>';
    if (!injuries.length) {
      return head + '<div style="font:var(--cm-body-sm);color:var(--cm-fg-muted)">'
        + _esc(tt('preventive.no_injury_history', 'No injury history — general prevention.')) + '</div>';
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
      + '<div>' + list + '</div>';
  }

  window.RehabCreate = { injuryLabel, loadActiveInjuries, seedProgrammePhasesFromInjury, openOrCreateForInjury, buildInjuryRiskContext, injuryRiskHTML };
})();
