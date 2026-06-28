/**
 * gps-acwr.js — Acute:Chronic Workload Ratio calculation
 * Exposed on window.gpsACWR
 *
 * Zones based on Gabbett 2016 (Br J Sports Med) and Hulin et al. 2014.
 * Acute  = 7-day rolling average
 * Chronic = 28-day rolling average
 * ACWR   = acute / chronic
 */
(function () {
  'use strict';

  const ACWR_METRICS = [
    { key: 'player_load',         label: 'Player Load',    unit: 'AU' },
    { key: 'total_distance',      label: 'Total Distance', unit: 'm'  },
    { key: 'high_speed_distance', label: 'HSR',            unit: 'm'  },
    { key: 'sprint_count',        label: 'Sprints',        unit: ''   },
    { key: 'sprint_distance',     label: 'Sprint Dist',    unit: 'm'  },
  ];

  const ACWR_ZONES = [
    { from: 0,   to: 0.8,  label: 'Under-training', cls: 'under'   },
    { from: 0.8, to: 1.3,  label: 'Sweet spot',     cls: 'sweet'   },
    { from: 1.3, to: 1.5,  label: 'Caution',        cls: 'caution' },
    { from: 1.5, to: 99,   label: 'High risk',      cls: 'risk'    },
  ];

  function getZone(acwr) {
    if (acwr == null || isNaN(acwr)) return null;
    for (const z of ACWR_ZONES) if (acwr >= z.from && acwr < z.to) return z;
    return ACWR_ZONES[ACWR_ZONES.length - 1];
  }

  function _dateStr(d) { return d.toISOString().slice(0, 10); }

  function _offsetDate(refStr, days) {
    const d = new Date(refStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return _dateStr(d);
  }

  // Fetch all gps_reports in a date range, merged with session_date
  async function _fetchReports(clubId, from, to) {
    const { data: sessions } = await window.sb
      .from('training_sessions')
      .select('id, session_date')
      .eq('club_id', clubId)
      .gte('session_date', from)
      .lte('session_date', to);

    if (!sessions?.length) return [];

    const sessDateMap = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));
    const ids         = sessions.map(s => s.id);

    // Paginated: the server caps at ~1000 rows; a 28-day squad window exceeds that and
    // would compute the ACWR on a truncated, wrong dataset.
    const reports = await window.cmFetchAll(() => window.sb
      .from('gps_reports')
      .select('player_id,session_id,player_load,total_distance,high_speed_distance,sprint_count,sprint_distance')
      .eq('club_id', clubId)
      .in('session_id', ids), { label: 'acwr.fetchReports' });

    return (reports || []).map(r => ({ ...r, session_date: sessDateMap[r.session_id] }));
  }

  /**
   * calculateTeamACWR({ clubId, refDate? })
   * Returns { player_load: 1.18, total_distance: 1.03, ... } or null
   */
  async function calculateTeamACWR({ clubId, refDate }) {
    const ref        = refDate || _dateStr(new Date());
    const acuteFrom  = _offsetDate(ref, -7);
    const chronicFrom = _offsetDate(ref, -28);

    const all    = await _fetchReports(clubId, chronicFrom, ref);
    const acute  = all.filter(r => r.session_date >= acuteFrom);

    if (!all.length) return null;

    const avgByMetric = (reports, key) => {
      const byPlayer = {};
      for (const r of reports) {
        if (r[key] == null) continue;
        if (!byPlayer[r.player_id]) byPlayer[r.player_id] = [];
        byPlayer[r.player_id].push(r[key]);
      }
      const avgs = Object.values(byPlayer).map(vals => vals.reduce((s, v) => s + v, 0) / vals.length);
      return avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null;
    };

    const result = {};
    for (const { key } of ACWR_METRICS) {
      const a = avgByMetric(acute, key);
      const c = avgByMetric(all,   key);
      result[key] = (a != null && c && c > 0) ? a / c : null;
    }
    return result;
  }

  /**
   * calculatePlayerACWR({ clubId, refDate? })
   * Returns { [player_id]: { sessCount, insufficient, player_load, total_distance, ... } }
   */
  async function calculatePlayerACWR({ clubId, refDate }) {
    const ref        = refDate || _dateStr(new Date());
    const acuteFrom  = _offsetDate(ref, -7);
    const chronicFrom = _offsetDate(ref, -28);

    const all   = await _fetchReports(clubId, chronicFrom, ref);
    const acute = all.filter(r => r.session_date >= acuteFrom);

    // Count distinct sessions per player (for data-sufficiency check)
    const sessCountMap = {};
    const seen = new Set();
    for (const r of all) {
      const k = `${r.player_id}:${r.session_id}`;
      if (!seen.has(k)) { seen.add(k); sessCountMap[r.player_id] = (sessCountMap[r.player_id] || 0) + 1; }
    }

    const playerIds = [...new Set(all.map(r => r.player_id))];
    const result    = {};

    for (const pid of playerIds) {
      const sessCount    = sessCountMap[pid] || 0;
      const insufficient = sessCount < 4;
      const playerResult = { sessCount, insufficient };

      for (const { key } of ACWR_METRICS) {
        const pAcute   = acute.filter(r => r.player_id === pid && r[key] != null);
        const pChronic = all.filter(r  => r.player_id === pid && r[key] != null);

        if (!pChronic.length || insufficient) { playerResult[key] = null; continue; }

        const acuteAvg   = pAcute.length ? pAcute.reduce((s, r) => s + r[key], 0) / pAcute.length : 0;
        const chronicAvg = pChronic.reduce((s, r) => s + r[key], 0) / pChronic.length;
        playerResult[key] = chronicAvg > 0 ? acuteAvg / chronicAvg : null;
      }
      result[pid] = playerResult;
    }
    return result;
  }

  window.gpsACWR = { calculateTeamACWR, calculatePlayerACWR, ACWR_METRICS, ACWR_ZONES, getZone };
})();
