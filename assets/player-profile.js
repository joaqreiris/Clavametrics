/* ────────────────────────────────────────────────────────────────────────
   player-profile.js — KPI aggregation for the read-only Player profile.
   Exposes: window.playerProfile.loadKpis(playerId, clubId) -> Promise<kpis>

   Self-contained. Reuses window.sb (Supabase client) and window.gpsACWR.
   Multi-tenant: every query is filtered by club_id.
   Resilient: every KPI is computed in isolation; on any error the value is
   left null (rendered as "—" by the caller). Never throws.

   Return shape:
   { minutes, matches, trainingsDone, trainingsTotal, availabilityPct,
     daysOut, daysOutSource, acwr, acwrLabel, readiness, seasonStart, seasonEnd }
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const sb = () => window.sb;

  // YYYY-MM-DD from a Date (local)
  function iso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── Season window ───────────────────────────────────────────────────────
  // club_settings holds the season under module_key='season'. If a row with
  // BOTH season_start and season_end exists, use it; otherwise fall back to the
  // last 365 days ending today (flagged as an assumption to confirm).
  async function resolveSeason(clubId) {
    let seasonStart = null, seasonEnd = null;
    try {
      const { data } = await sb()
        .from('club_settings')
        .select('season_start,season_end')
        .eq('club_id', clubId)
        .eq('module_key', 'season')
        .maybeSingle();
      if (data && data.season_start && data.season_end) {
        seasonStart = data.season_start;
        seasonEnd = data.season_end;
      }
    } catch (_) { /* ignore — fall through to default window */ }

    if (!seasonStart || !seasonEnd) {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 365);
      seasonStart = iso(past);
      seasonEnd = iso(today);
    }
    return { seasonStart, seasonEnd };
  }

  // ── minutes ─────────────────────────────────────────────────────────────
  // Sum of gps_reports.time_played on MATCH sessions in the season window.
  // matches = number of match reports with a non-null time_played.
  async function loadMinutes(playerId, clubId, seasonStart, seasonEnd) {
    try {
      const { data } = await sb()
        .from('gps_reports')
        .select('time_played, session:training_sessions!inner(session_type,session_date)')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .eq('session.session_type', 'match')
        .gte('session.session_date', seasonStart)
        .lte('session.session_date', seasonEnd);
      const rows = data || [];
      let minutes = 0, matches = 0;
      for (const r of rows) {
        if (r.time_played != null) { minutes += Number(r.time_played) || 0; matches++; }
      }
      return { minutes: Math.round(minutes), matches };
    } catch (_) {
      return { minutes: null, matches: null };
    }
  }

  // ── trainings ───────────────────────────────────────────────────────────
  // total = training_sessions in window (is_historical=false, type <> 'match').
  // done  = distinct training session_ids in that set where the player has any
  //         presence: a gps_reports row OR an rpe row for that session.
  async function loadTrainings(playerId, clubId, seasonStart, seasonEnd) {
    try {
      const { data: tsRows } = await sb()
        .from('training_sessions')
        .select('id')
        .eq('club_id', clubId)
        .eq('is_historical', false)
        .neq('session_type', 'match')
        .gte('session_date', seasonStart)
        .lte('session_date', seasonEnd);
      const tsIds = new Set((tsRows || []).map(r => r.id));
      const total = tsIds.size;
      if (!total) return { trainingsDone: 0, trainingsTotal: 0 };

      // Player presence comes from two independent signals.
      const [g, r] = await Promise.all([
        sb().from('gps_reports').select('session_id').eq('player_id', playerId).eq('club_id', clubId),
        sb().from('rpe').select('session_id').eq('player_id', playerId).eq('club_id', clubId),
      ]);
      const present = new Set();
      for (const x of (g.data || [])) if (x.session_id && tsIds.has(x.session_id)) present.add(x.session_id);
      for (const x of (r.data || [])) if (x.session_id && tsIds.has(x.session_id)) present.add(x.session_id);

      return { trainingsDone: present.size, trainingsTotal: total };
    } catch (_) {
      return { trainingsDone: null, trainingsTotal: null };
    }
  }

  // ── availability ────────────────────────────────────────────────────────
  // pct = available rows / total tracked rows (rounded). null if untracked.
  // ASSUMPTION: simple available/tracked, not minutes-based participation.
  async function loadAvailability(playerId, clubId, seasonStart, seasonEnd) {
    try {
      const { data } = await sb()
        .from('availability')
        .select('status')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .gte('date', seasonStart)
        .lte('date', seasonEnd);
      const rows = data || [];
      const tracked = rows.length;
      if (!tracked) return null;
      const available = rows.filter(x => (x.status || '').toLowerCase() === 'available').length;
      return Math.round((available / tracked) * 100);
    } catch (_) {
      return null;
    }
  }

  // ── days_out ────────────────────────────────────────────────────────────
  // Primary: distinct availability.date with status in (injured|sick|unavailable).
  // Fallback (when zero such rows): sum injury spell lengths clamped to window.
  // ASSUMPTION on both the status set and the fallback source.
  async function loadDaysOut(playerId, clubId, seasonStart, seasonEnd) {
    try {
      const { data } = await sb()
        .from('availability')
        .select('date,status')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .in('status', ['injured', 'sick', 'unavailable'])
        .gte('date', seasonStart)
        .lte('date', seasonEnd);
      const distinct = new Set((data || []).map(x => x.date));
      if (distinct.size > 0) return { daysOut: distinct.size, daysOutSource: 'availability' };
    } catch (_) { /* fall through to injuries */ }

    // Fallback: injuries table — sum spell lengths clamped to the season window.
    try {
      const { data: inj } = await sb()
        .from('injuries')
        .select('start_date,returned_date,expected_return,status')
        .eq('player_id', playerId)
        .eq('club_id', clubId);
      const winStart = new Date(seasonStart + 'T00:00:00');
      const winEnd = new Date(seasonEnd + 'T00:00:00');
      const todayD = new Date(iso(new Date()) + 'T00:00:00');
      let total = 0;
      for (const s of (inj || [])) {
        if (!s.start_date) continue;
        const start = new Date(s.start_date + 'T00:00:00');
        // Spell end: cleared → returned_date, else expected_return, else today.
        const endStr = ((s.status || '').toLowerCase() === 'cleared' ? s.returned_date : null)
          || s.expected_return || null;
        let end = endStr ? new Date(endStr + 'T00:00:00') : todayD;
        // Clamp to window.
        const cStart = start < winStart ? winStart : start;
        const cEnd = end > winEnd ? winEnd : end;
        if (cEnd >= cStart) {
          total += Math.round((cEnd - cStart) / 86400000) + 1; // inclusive days
        }
      }
      return { daysOut: total, daysOutSource: 'injuries' };
    } catch (_) {
      return { daysOut: null, daysOutSource: null };
    }
  }

  // ── acwr ────────────────────────────────────────────────────────────────
  // Reuse window.gpsACWR (Player Load acute:chronic). null when insufficient.
  async function loadAcwr(playerId, clubId) {
    try {
      if (!window.gpsACWR || typeof window.gpsACWR.calculatePlayerACWR !== 'function') {
        return { acwr: null, acwrLabel: null };
      }
      const m = await window.gpsACWR.calculatePlayerACWR({ clubId });
      const p = m ? m[playerId] : null;
      const value = (p && !p.insufficient) ? p.player_load : null;
      let label = null;
      if (value != null) {
        const z = window.gpsACWR.getZone ? window.gpsACWR.getZone(value) : null;
        label = z ? z.label : null;
      } else if (p && p.insufficient) {
        label = 'Not enough data';
      }
      return { acwr: value != null ? value : null, acwrLabel: label };
    } catch (_) {
      return { acwr: null, acwrLabel: null };
    }
  }

  // ── readiness ───────────────────────────────────────────────────────────
  // Average of wellness.readiness over the last 7 days (by submitted_at);
  // if none in the window, fall back to the latest readiness. null if no rows.
  async function loadReadiness(playerId, clubId) {
    try {
      const { data } = await sb()
        .from('wellness')
        .select('readiness,submitted_at')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .order('submitted_at', { ascending: false });
      const rows = (data || []).filter(w => w.readiness != null);
      if (!rows.length) return null;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const recent = rows.filter(w => w.submitted_at && new Date(w.submitted_at) >= cutoff);
      if (recent.length) {
        const avg = recent.reduce((a, w) => a + Number(w.readiness), 0) / recent.length;
        return avg;
      }
      return Number(rows[0].readiness); // latest (already sorted desc)
    } catch (_) {
      return null;
    }
  }

  // ── Orchestrator ────────────────────────────────────────────────────────
  async function loadKpis(playerId, clubId) {
    if (!playerId || !clubId || !window.sb) {
      return {
        minutes: null, matches: null, trainingsDone: null, trainingsTotal: null,
        availabilityPct: null, daysOut: null, daysOutSource: null,
        acwr: null, acwrLabel: null, readiness: null,
        seasonStart: null, seasonEnd: null,
      };
    }

    const { seasonStart, seasonEnd } = await resolveSeason(clubId);

    const [min, tr, avail, dout, acwr, ready] = await Promise.all([
      loadMinutes(playerId, clubId, seasonStart, seasonEnd),
      loadTrainings(playerId, clubId, seasonStart, seasonEnd),
      loadAvailability(playerId, clubId, seasonStart, seasonEnd),
      loadDaysOut(playerId, clubId, seasonStart, seasonEnd),
      loadAcwr(playerId, clubId),
      loadReadiness(playerId, clubId),
    ]);

    return {
      minutes: min.minutes,
      matches: min.matches,
      trainingsDone: tr.trainingsDone,
      trainingsTotal: tr.trainingsTotal,
      availabilityPct: avail,
      daysOut: dout.daysOut,
      daysOutSource: dout.daysOutSource,
      acwr: acwr.acwr,
      acwrLabel: acwr.acwrLabel,
      readiness: ready,
      seasonStart,
      seasonEnd,
    };
  }

  window.playerProfile = { loadKpis };
})();
