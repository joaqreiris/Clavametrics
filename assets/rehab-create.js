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

  window.RehabCreate = { injuryLabel, loadActiveInjuries, seedProgrammePhasesFromInjury, openOrCreateForInjury };
})();
