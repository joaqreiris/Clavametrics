// lib/day-context.js
(function () {
  function daysBetween(a, b) {
    const d1 = new Date(a + 'T12:00:00'), d2 = new Date(b + 'T12:00:00');
    return Math.round((d2 - d1) / 86400000);   // (b − a), same as Calendar
  }
  function mdLabel(dateStr, mc) {
    if (mc && mc.md_overrides && mc.md_overrides[dateStr]) return mc.md_overrides[dateStr];
    if (mc && mc.match_date) {
      const diff = daysBetween(dateStr, mc.match_date);
      if (diff === 0) return 'MD';
      if (diff > 0 && diff <= 10) return 'MD−' + diff;
      if (diff < 0 && diff >= -3) return 'MD+' + Math.abs(diff);
    }
    return '';
  }
  // Returns { microcycle:{id,name}|null, md, start_time, duration, estimated_rpe, opponent, rival, home_away, hasEvent }
  window.cmResolveDayContext = async function (dateStr, teamId, clubId) {
    const out = { microcycle:null, md:'', start_time:null, duration:null, estimated_rpe:null, opponent:null, rival:null, home_away:null, hasEvent:false, dayOff:false };
    if (!dateStr || !clubId) return out;
    try {
      // microcycle covering the date
      let mq = window.sb.from('microcycles')
        .select('id,name,start_date,end_date,match_date,rival,home_away,md_overrides')
        .eq('club_id', clubId).lte('start_date', dateStr).gte('end_date', dateStr);
      if (teamId) mq = mq.eq('team_id', teamId);
      const { data: mcs } = await mq.limit(1);
      const mc = (mcs && mcs[0]) || null;
      if (mc) { out.microcycle = { id: mc.id, name: mc.name }; out.md = mdLabel(dateStr, mc); out.rival = mc.rival||null; out.home_away = mc.home_away||null; }
      // calendar event for the date (prefer training)
      let eq = window.sb.from('calendar_events')
        .select('type,start_time,duration_minutes,estimated_rpe,opponent,title,location')
        .eq('club_id', clubId).eq('date', dateStr);
      if (teamId) eq = eq.eq('team_id', teamId);
      const { data: evs } = await eq;
      const list = evs || [];
      out.dayOff = list.some(e => (e.type||e.session_type) === 'day_off');
      const ev = list.find(e => (e.type||e.session_type) === 'training') || list.find(e => (e.type||e.session_type) !== 'match') || list[0] || null;
      if (ev) { out.hasEvent = true; out.start_time = ev.start_time||null; out.duration = ev.duration_minutes||null; out.estimated_rpe = ev.estimated_rpe||null; out.opponent = ev.opponent||out.rival; }
    } catch (e) { console.error('cmResolveDayContext', e); }
    return out;
  };
})();
