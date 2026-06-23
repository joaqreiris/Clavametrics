// ClavaMetrics — shared fixtures-import logic (vanilla, no deps, no build).
// Exposes window.CMFixtures so Calendar.html and Annual Planner.html share ONE
// implementation. Ported from Annual Planner's apParseDelimited / apImportParse /
// apImportConfirm (the parser/dedup logic lived inline and was duplicated).
(function () {
  'use strict';

  // ── Internal parsing helpers ──────────────────────────────────
  function parseDate(s) {
    s = (s || '').trim();
    let m;
    if (m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }
  function normHA(s) {
    s = (s || '').trim().toLowerCase();
    return ['away', 'a', 'visitante', 'v', 'fuera'].includes(s) ? 'away' : 'home';
  }
  function normTime(s) {
    const m = (s || '').trim().match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  }

  // ── 1) parseDelimited(text) → array of rows ───────────────────
  // Each row: { raw, rawDate, date, opponent, home_away, competition, time, valid }
  function parseDelimited(text) {
    const lines = (text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delim = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const head = lines[0].split(delim).map(s => s.trim().toLowerCase());
    const KNOWN = ['date', 'opponent', 'rival', 'home_away', 'home/away', 'h/a', 'ha', 'competition', 'comp', 'time', 'kickoff'];
    const hasHeader = head.some(h => KNOWN.includes(h));
    let cols = { date: 0, opp: 1, ha: 2, comp: 3, time: 4 }, start = 0;
    if (hasHeader) {
      cols = {};
      head.forEach((h, i) => {
        if (h === 'date') cols.date = i;
        else if (h === 'opponent' || h === 'rival') cols.opp = i;
        else if (h === 'home_away' || h === 'home/away' || h === 'h/a' || h === 'ha') cols.ha = i;
        else if (h === 'competition' || h === 'comp') cols.comp = i;
        else if (h === 'time' || h === 'kickoff') cols.time = i;
      });
      start = 1;
    }
    const rows = [];
    for (let i = start; i < lines.length; i++) {
      const p = lines[i].split(delim).map(s => s.trim());
      const date = parseDate(p[cols.date] ?? '');
      const opponent = (cols.opp != null ? (p[cols.opp] ?? '') : '').trim();
      rows.push({
        raw: lines[i],
        rawDate: (p[cols.date] ?? '').trim(),
        date, opponent,
        home_away: normHA(cols.ha != null ? p[cols.ha] : ''),
        competition: (cols.comp != null ? (p[cols.comp] ?? '') : '').trim(),
        time: (cols.time != null ? normTime(p[cols.time] ?? '') : ''),
        valid: !!date && !!opponent
      });
    }
    return rows;
  }

  // ── 2) detectNewCompetitions(rows, existingComps) → string[] ──
  // Competition names present in rows that aren't in existingComps (match by lower name).
  function detectNewCompetitions(rows, existingComps) {
    const existing = new Set((existingComps || []).map(c => (c.name || '').toLowerCase()));
    return [...new Set(
      (rows || []).filter(r => r.competition).map(r => r.competition)
        .filter(n => !existing.has(n.toLowerCase()))
    )];
  }

  // ── 3) confirmImport(opts) → { inserted, skipped, newComps, error } ──
  async function confirmImport({ sb, clubId, teamId, seasonId, existingComps, rows, newCompNames, overwrite, newCompColor }) {
    newCompNames = newCompNames || [];
    const valid = (rows || []).filter(r => r.valid);
    if (!valid.length) return { inserted: 0, skipped: 0, newComps: newCompNames.length, error: null };

    // Map name → id / comp_type from existing competitions
    const compByName = {}, compTypeByName = {};
    (existingComps || []).forEach(c => {
      compByName[(c.name || '').toLowerCase()] = c.id;
      compTypeByName[(c.name || '').toLowerCase()] = c.comp_type;
    });

    // Create new competitions only when we have a season to attach them to
    if (seasonId) {
      for (const name of newCompNames) {
        const { data, error } = await sb.from('competitions')
          .insert({ season_id: seasonId, name, comp_type: 'league', color: newCompColor || '#64748b' })
          .select('id').single();
        if (error) return { inserted: 0, skipped: 0, newComps: newCompNames.length, error };
        compByName[name.toLowerCase()] = data.id;
        compTypeByName[name.toLowerCase()] = 'league';
      }
    }

    // calendar_events.competition is a constrained CLASS (league/cup/international/friendly),
    // not the name. The real competition (name + color) lives in competition_id.
    const LEGACY_COMP = { league: 'league', cup: 'cup', international: 'international', friendly: 'friendly', supercup: 'cup' };
    const legacyComp = (f) => {
      const ct = f.competition ? compTypeByName[f.competition.toLowerCase()] : null;
      return ct ? (LEGACY_COMP[ct] || null) : null;
    };

    // Dedup — scoped by team (not club). Check existing matches on the same dates.
    const dates = [...new Set(valid.map(r => r.date))];
    const { data: existRows } = await sb.from('calendar_events')
      .select('date,opponent')
      .eq('club_id', clubId).eq('team_id', teamId).eq('type', 'match')
      .in('date', dates);
    const existKey = new Set((existRows || []).map(m => `${(m.date || '').split('T')[0]}__${(m.opponent || '').toLowerCase()}`));

    let toInsert;
    if (overwrite) {
      // Replace: drop this team's matches on those dates before inserting all valid rows
      const { error: delErr } = await sb.from('calendar_events').delete()
        .eq('club_id', clubId).eq('team_id', teamId).eq('type', 'match')
        .in('date', dates);
      if (delErr) return { inserted: 0, skipped: 0, newComps: newCompNames.length, error: delErr };
      toInsert = valid;
    } else {
      // Skip rows that already exist (same date + opponent for this team)
      toInsert = valid.filter(r => !existKey.has(`${r.date}__${(r.opponent || '').toLowerCase()}`));
    }

    const insertRows = toInsert.map(f => ({
      id: crypto.randomUUID(),
      club_id: clubId, team_id: teamId, season_id: seasonId,
      competition_id: f.competition ? (compByName[f.competition.toLowerCase()] || null) : null,
      title: `vs ${f.opponent}`, type: 'match', date: f.date,
      opponent: f.opponent, home_away: f.home_away,
      competition: legacyComp(f), start_time: f.time || null,
      duration_minutes: 90
    }));

    if (!insertRows.length) {
      return { inserted: 0, skipped: valid.length, newComps: newCompNames.length, error: null };
    }

    // calendar_events_match_uniq is the backstop against races.
    const { error } = await sb.from('calendar_events').insert(insertRows);
    if (error) return { inserted: 0, skipped: valid.length, newComps: newCompNames.length, error };

    return {
      inserted: insertRows.length,
      skipped: valid.length - insertRows.length,
      newComps: newCompNames.length,
      error: null
    };
  }

  window.CMFixtures = { parseDelimited, detectNewCompetitions, confirmImport };
})();
