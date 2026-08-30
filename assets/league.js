/* ============================================================================
 * ClavaMetrics — Liga interna (motor)
 * ----------------------------------------------------------------------------
 * Competencia entre jugadores dentro del entrenamiento: cada tarea competitiva
 * reparte 3/1/0 a los integrantes del grupo ganador / empatado / perdedor, y a
 * fin de mes los últimos le pagan una comida a los primeros.
 *
 * Este archivo NO dibuja nada: resuelve la temporada del mes, calcula quién
 * suma qué y persiste. La UI vive en cada página (Daily Planning marca los
 * resultados; la página de la liga muestra la tabla).
 *
 * Modelo:
 *   season  = el mes, uno por equipo (internal_league_seasons)
 *   event   = un enfrentamiento (internal_league_events) — ligado a una tarea del plan
 *             (session_exercise_id) o suelto, para lo que se arma en el campo
 *   results = una fila POR JUGADOR (internal_league_results), materializada a propósito:
 *             corregir a uno solo no toca a los demás
 *
 * Precedencia al calcular el resultado de un jugador:
 *   1. corrección manual   (is_manual — el que entró a mitad, el que cambió de equipo)
 *   2. arquero con goles recibidos cargados (compara contra los OTROS arqueros)
 *   3. el resultado de su grupo
 *
 * Gateado por el flag de club `internal_league` (fail-closed: si no se pudo
 * leer el flag, la liga no existe).
 * ========================================================================== */
(function () {
  'use strict';

  var FLAG = 'internal_league';
  var DEFAULT_POINTS = { win: 3, draw: 1, loss: 0 };

  var _on   = false;    // ¿el club tiene la liga encendida? (sync, tras init())
  var _cfg  = null;     // config del flag { points, min_participation }
  var _init = null;     // promesa de init(), para no pedir el flag dos veces

  // ── Flag ───────────────────────────────────────────────────────────────────
  function init() {
    if (_init) return _init;
    _init = (async function () {
      try {
        _on  = await window.clubHasFlag(FLAG);
        _cfg = await window.clubFlagConfig(FLAG);
      } catch (_e) { _on = false; _cfg = null; }   // fail-closed
      return _on;
    })();
    return _init;
  }
  function isOn() { return _on; }
  function points() {
    var p = (_cfg && _cfg.points) || DEFAULT_POINTS;
    return { win: num(p.win, 3), draw: num(p.draw, 1), loss: num(p.loss, 0) };
  }
  function minParticipation() {
    var v = _cfg && _cfg.min_participation;
    return (v == null || isNaN(Number(v))) ? 0.60 : Number(v);
  }
  function num(v, d) { var n = Number(v); return isNaN(n) ? d : n; }

  // ── El mes ─────────────────────────────────────────────────────────────────
  // Todo en fechas LOCALES (cmYMD): con toISOString un 1° de mes al este de UTC
  // cae en el mes anterior y la tarea se cuenta en la liga equivocada.
  function monthBounds(ymd) {
    var s = String(ymd || (window.cmToday ? window.cmToday() : ''));
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2];
    var last = new Date(y, mo, 0).getDate();          // día 0 del mes siguiente = último de este
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return { start: y + '-' + pad(mo) + '-01', end: y + '-' + pad(mo) + '-' + pad(last), year: y, month: mo };
  }
  // "Agosto 2026" en el idioma activo. Solo etiqueta: el orden lo manda start_date.
  function monthLabel(ymd) {
    var b = monthBounds(ymd);
    if (!b) return '';
    var lang = (window.CM_I18N && window.CM_I18N.current) || document.documentElement.lang || 'es';
    var d = new Date(b.year, b.month - 1, 1);
    var s = d.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Temporada del mes de `ymd` para este equipo; la crea si no existe.
  // El unique (team_id, start_date) absorbe la carrera de dos usuarios marcando
  // el primer resultado del mes a la vez.
  async function ensureSeason(clubId, teamId, ymd) {
    if (!clubId || !teamId) return null;
    var b = monthBounds(ymd);
    if (!b) return null;
    var q = await window.sb.from('internal_league_seasons').select('*')
      .eq('team_id', teamId).eq('start_date', b.start).maybeSingle();
    if (q.data) return q.data;
    var p = points();
    var ins = await window.sb.from('internal_league_seasons').upsert({
      club_id: clubId, team_id: teamId,
      name: monthLabel(ymd),
      start_date: b.start, end_date: b.end,
      status: 'open',
      min_participation: minParticipation(),
      points_win: p.win, points_draw: p.draw, points_loss: p.loss,
    }, { onConflict: 'team_id,start_date' }).select().maybeSingle();
    if (ins.error) { console.warn('[league] ensureSeason:', ins.error.message); return null; }
    return ins.data;
  }

  async function seasonFor(teamId, ymd) {
    var b = monthBounds(ymd);
    if (!teamId || !b) return null;
    var q = await window.sb.from('internal_league_seasons').select('*')
      .eq('team_id', teamId).eq('start_date', b.start).maybeSingle();
    return q.data || null;
  }

  // ── Cálculo ────────────────────────────────────────────────────────────────
  // groups: [{ id, name, color, players:[player_id] }]
  // state : { outcomes:{group_id:'win'|'draw'|'loss'}, ga:{player_id:number},
  //           manual:{player_id:'win'|'draw'|'loss'}, keepers:[player_id] }
  // → [{ player_id, group_id, outcome, points, goals_against, is_keeper, is_manual }]
  function compute(groups, state, pts) {
    var P = pts || points();
    var st = state || {};
    var outcomes = st.outcomes || {}, ga = st.ga || {}, manual = st.manual || {};
    var keepers = new Set((st.keepers || []).map(String));

    // Arqueros: se comparan ENTRE ELLOS por goles recibidos. Con uno solo cargado
    // no hay con quién compararlo, así que puntúa como su grupo.
    var gaOutcome = {};
    var entries = Object.keys(ga)
      .map(function (pid) { return [String(pid), Number(ga[pid])]; })
      .filter(function (e) { return e[1] === e[1]; });   // descarta NaN (input vacío)
    if (entries.length >= 2) {
      var vals = entries.map(function (e) { return e[1]; });
      var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      entries.forEach(function (e) {
        gaOutcome[e[0]] = (min === max) ? 'draw' : (e[1] === min ? 'win' : (e[1] === max ? 'loss' : 'draw'));
      });
    }

    var out = [];
    (groups || []).forEach(function (g) {
      (g.players || []).forEach(function (raw) {
        var pid = String(raw);
        var o = manual[pid] || gaOutcome[pid] || outcomes[g.id] || null;
        if (!o) return;                                  // grupo sin resultado → no puntúa
        var gaVal = (pid in ga && ga[pid] !== '' && ga[pid] != null && !isNaN(Number(ga[pid]))) ? Number(ga[pid]) : null;
        out.push({
          player_id: pid,
          group_id: g.id || null,
          outcome: o,
          points: P[o] != null ? P[o] : 0,
          goals_against: gaVal,
          is_keeper: keepers.has(pid) || gaVal != null,
          is_manual: !!manual[pid],
        });
      });
    });
    return out;
  }

  // ── Persistencia ───────────────────────────────────────────────────────────
  // Eventos de un día, con sus resultados. → { bySeid:{}, loose:[], all:[] }
  async function loadDay(clubId, teamId, ymd) {
    var empty = { bySeid: {}, loose: [], all: [] };
    if (!clubId || !teamId || !ymd) return empty;
    var ev = await window.sb.from('internal_league_events')
      .select('id,season_id,event_date,session_exercise_id,title,groups')
      .eq('club_id', clubId).eq('team_id', teamId).eq('event_date', ymd)
      .order('created_at');
    if (ev.error || !ev.data) return empty;
    var ids = ev.data.map(function (e) { return e.id; });
    var res = ids.length
      ? await window.sb.from('internal_league_results')
          .select('event_id,player_id,group_id,outcome,points,goals_against,is_keeper,is_manual')
          .in('event_id', ids)
      : { data: [] };
    var byEvent = {};
    (res.data || []).forEach(function (r) { (byEvent[r.event_id] = byEvent[r.event_id] || []).push(r); });
    var out = { bySeid: {}, loose: [], all: [] };
    ev.data.forEach(function (e) {
      e.results = byEvent[e.id] || [];
      out.all.push(e);
      if (e.session_exercise_id) out.bySeid[e.session_exercise_id] = e;
      else out.loose.push(e);
    });
    return out;
  }

  // Guarda evento + resultados. Reemplaza los resultados del evento en bloque:
  // son derivados de lo que se ve en el modal, no un histórico.
  async function saveEvent(evt) {
    if (!evt || !evt.club_id || !evt.team_id || !evt.season_id || !evt.event_date) return null;
    var row = {
      club_id: evt.club_id, team_id: evt.team_id, season_id: evt.season_id,
      event_date: evt.event_date,
      session_exercise_id: evt.session_exercise_id || null,
      title: evt.title || null,
      groups: evt.groups || [],
    };
    if (evt.id) row.id = evt.id;
    var up = await window.sb.from('internal_league_events').upsert(row).select().maybeSingle();
    if (up.error || !up.data) { console.warn('[league] saveEvent:', up.error && up.error.message); return null; }
    var eventId = up.data.id;

    var del = await window.sb.from('internal_league_results').delete().eq('event_id', eventId);
    if (del.error) { console.warn('[league] clear results:', del.error.message); return null; }

    var rows = (evt.results || []).map(function (r) {
      return {
        club_id: evt.club_id, team_id: evt.team_id, season_id: evt.season_id,
        event_id: eventId, player_id: r.player_id, group_id: r.group_id || null,
        outcome: r.outcome, points: r.points,
        goals_against: r.goals_against == null ? null : r.goals_against,
        is_keeper: !!r.is_keeper, is_manual: !!r.is_manual,
      };
    });
    if (rows.length) {
      var ins = await window.sb.from('internal_league_results').insert(rows);
      if (ins.error) { console.warn('[league] insert results:', ins.error.message); return null; }
    }
    up.data.results = rows;
    return up.data;
  }

  async function removeEvent(eventId) {
    if (!eventId) return false;
    var d = await window.sb.from('internal_league_events').delete().eq('id', eventId);
    if (d.error) { console.warn('[league] removeEvent:', d.error.message); return false; }
    return true;
  }

  // ── Tabla del mes ──────────────────────────────────────────────────────────
  // Ordena por PUNTOS POR TAREA, no por total: el que se perdió una semana por
  // una sobrecarga no puede caer al fondo por ausente. El que no llega al mínimo
  // de participación queda `ranked:false` (se muestra aparte, sin puesto).
  function standings(season, results, eventCount, players) {
    var total = eventCount || 0;
    var minPlayed = Math.ceil(total * ((season && season.min_participation != null) ? Number(season.min_participation) : minParticipation()));
    var by = {};
    (results || []).forEach(function (r) {
      var pid = String(r.player_id);
      var e = by[pid] || (by[pid] = { player_id: pid, played: 0, win: 0, draw: 0, loss: 0, points: 0, goals_against: 0, keeper_events: 0 });
      e.played++;
      e[r.outcome]++;
      e.points += Number(r.points) || 0;
      if (r.is_keeper) { e.keeper_events++; if (r.goals_against != null) e.goals_against += Number(r.goals_against) || 0; }
    });
    var byId = {};
    (players || []).forEach(function (p) { byId[String(p.id)] = p; });
    var rows = Object.keys(by).map(function (pid) {
      var e = by[pid];
      e.avg = e.played ? e.points / e.played : 0;
      e.ranked = total > 0 && e.played >= minPlayed;
      e.player = byId[pid] || null;
      e.is_keeper = e.keeper_events > 0;
      return e;
    });
    // Desempate: promedio → tareas ganadas → partidos jugados → nombre.
    rows.sort(function (a, b) {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.win !== a.win) return b.win - a.win;
      if (b.played !== a.played) return b.played - a.played;
      var an = a.player ? (a.player.last_name || '') : '', bn = b.player ? (b.player.last_name || '') : '';
      return an.localeCompare(bn);
    });
    var pos = 0;
    rows.forEach(function (r) { r.position = r.ranked ? ++pos : null; });
    return { rows: rows, events: total, min_played: minPlayed };
  }

  window.CMLeague = {
    FLAG: FLAG,
    init: init, isOn: isOn, points: points, minParticipation: minParticipation,
    monthBounds: monthBounds, monthLabel: monthLabel,
    ensureSeason: ensureSeason, seasonFor: seasonFor,
    compute: compute, loadDay: loadDay, saveEvent: saveEvent, removeEvent: removeEvent,
    standings: standings,
  };
})();
