/* ============================================================================
 * Daily Planning — Liga interna (marcado de resultados)
 * ----------------------------------------------------------------------------
 * Se apoya en lo que la página YA tiene: los grupos de cada tarea
 * (session_exercises.player_groups). Marcar quién ganó es un click; el resto
 * (quién estaba en cada lado) ya estaba cargado al armar la tarea.
 *
 * Vive aparte de daily-planning.js a propósito: es un prototipo gateado por el
 * flag `internal_league` y se puede sacar borrando dos <script> y tres llamadas.
 * Toma el contexto de la página por window._dpLgCtx() y reusa sus helpers
 * globales (_dpFindTask, _dpExGroups, _dpPlayerById, _dpPlayerShort, dpToast).
 *
 * Motor de puntos y persistencia: assets/league.js (window.CMLeague).
 * ========================================================================== */
(function () {
  'use strict';

  var L = function () { return window.CMLeague; };
  var _events = { bySeid: {}, loose: [], all: [] };   // eventos del día en pantalla
  var _season = null;                                  // temporada del mes en pantalla
  var _lg = null;                                      // estado del modal abierto
  var _busy = false;

  function ctx() { return (window._dpLgCtx && window._dpLgCtx()) || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function T(k, d, v) { return (window.tt ? window.tt(k, d, v) : d); }
  function toast(m) { if (window.dpToast) window.dpToast(m); }
  function isKeeper(p) { return !!p && String(p.position || '').toUpperCase() === 'GK'; }
  function playerById(id) { return (window._dpPlayerById ? window._dpPlayerById(id) : null); }
  function playerShort(p) { return (window._dpPlayerShort ? window._dpPlayerShort(p) : '—'); }

  var OUT_CLS = { win: 'win', draw: 'draw', loss: 'loss' };
  function outShort(o) {
    return o === 'win'  ? T('league.win_short', 'W')
         : o === 'draw' ? T('league.draw_short', 'D')
         : o === 'loss' ? T('league.loss_short', 'L') : '—';
  }

  // ── Estilos (inyectados: la página no sabe nada de la liga) ────────────────
  function injectCss() {
    if (document.getElementById('dplg-css')) return;
    var s = document.createElement('style');
    s.id = 'dplg-css';
    s.textContent = [
      '.dplg-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;width:100%;margin-top:2px}',
      '.dplg-btn{height:22px;padding:0 8px;border:1px dashed var(--cm-border-strong);border-radius:5px;background:var(--cm-bg);color:var(--cm-fg-muted);font:500 11px/1 var(--cm-font-sans);cursor:pointer;display:inline-flex;align-items:center;gap:4px}',
      '.dplg-btn:hover{border-color:#D97706;color:#D97706}',
      '.dplg-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:5px;border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;font:600 11px/1 var(--cm-font-sans);cursor:pointer}',
      '.dplg-chip .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '@media(prefers-color-scheme:dark){.dplg-chip{background:rgba(217,119,6,.14);border-color:rgba(217,119,6,.4);color:#FCD34D}}',
      ':root[data-theme="dark"] .dplg-chip{background:rgba(217,119,6,.14);border-color:rgba(217,119,6,.4);color:#FCD34D}',
      /* switch «cuenta para la liga» */
      '.dplg-sw{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px;border-radius:999px;border:1px solid var(--cm-border);background:var(--cm-bg);color:var(--cm-fg-muted);font:500 11px/1 var(--cm-font-sans);cursor:pointer;flex-shrink:0}',
      '.dplg-sw .tr{width:20px;height:11px;border-radius:999px;background:var(--cm-border-strong);position:relative;flex-shrink:0;transition:background .15s ease}',
      '.dplg-sw .tr b{position:absolute;top:1px;left:1px;width:9px;height:9px;border-radius:50%;background:#fff;transition:transform .15s ease}',
      '.dplg-sw:hover{border-color:#D97706;color:#D97706}',
      '.dplg-sw.is-on{border-color:#F59E0B;background:#FFFBEB;color:#92400E}',
      '.dplg-sw.is-on .tr{background:#D97706}',
      '.dplg-sw.is-on .tr b{transform:translateX(9px)}',
      '@media(prefers-color-scheme:dark){.dplg-sw.is-on{background:rgba(217,119,6,.14);border-color:rgba(217,119,6,.45);color:#FCD34D}}',
      ':root[data-theme="dark"] .dplg-sw.is-on{background:rgba(217,119,6,.14);border-color:rgba(217,119,6,.45);color:#FCD34D}',
      /* «pendiente de resultado»: la tarea cuenta pero nadie cargó quién ganó */
      '.dplg-pend{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:5px;border:1px dashed #F59E0B;background:transparent;color:#B45309;font:600 11px/1 var(--cm-font-sans);cursor:pointer}',
      '@media(prefers-color-scheme:dark){.dplg-pend{color:#FCD34D;border-color:rgba(245,158,11,.55)}}',
      ':root[data-theme="dark"] .dplg-pend{color:#FCD34D;border-color:rgba(245,158,11,.55)}',
      /* resumen del día */
      '.dplg-day{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0 0 10px;font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-muted)}',
      '.dplg-day .warn{color:#B45309;font-weight:600}',
      '@media(prefers-color-scheme:dark){.dplg-day .warn{color:#FCD34D}}',
      ':root[data-theme="dark"] .dplg-day .warn{color:#FCD34D}',
      /* modal */
      '.dplg-back{position:fixed;inset:0;background:rgba(8,10,12,.62);backdrop-filter:blur(6px);z-index:1100;display:none;align-items:center;justify-content:center;padding:20px}',
      '.dplg-back.is-open{display:flex}',
      '.dplg-modal{width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden}',
      '.dplg-h{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid var(--cm-border-soft)}',
      '.dplg-h h4{margin:0;font:650 14.5px/1.25 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.dplg-h .sub{margin-top:3px;font:500 11px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted);text-transform:uppercase;letter-spacing:.04em}',
      '.dplg-h .x{margin-left:auto;width:28px;height:28px;flex-shrink:0;border:0;background:none;color:var(--cm-fg-muted);font:400 18px/1 var(--cm-font-sans);cursor:pointer;border-radius:6px}',
      '.dplg-h .x:hover{background:var(--cm-bg-soft)}',
      '.dplg-b{padding:14px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}',
      '.dplg-sec-t{font:600 9.5px/1 var(--cm-font-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--cm-fg-faint);margin-bottom:7px}',
      '.dplg-g{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--cm-border-soft);border-radius:8px;background:var(--cm-bg-soft);margin-bottom:6px}',
      '.dplg-g .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}',
      '.dplg-g input.nm{flex:1;min-width:0;border:0;background:none;font:600 12px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);outline:none;padding:2px 3px;border-radius:4px}',
      '.dplg-g input.nm:focus{background:var(--cm-surface)}',
      '.dplg-g .ct{font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-faint);flex-shrink:0}',
      '.dplg-seg{display:inline-flex;flex-shrink:0;border:1px solid var(--cm-border);border-radius:6px;overflow:hidden}',
      '.dplg-seg button{width:28px;height:24px;border:0;border-right:1px solid var(--cm-border);background:var(--cm-bg);color:var(--cm-fg-muted);font:700 11px/1 var(--cm-font-mono);cursor:pointer}',
      '.dplg-seg button:last-child{border-right:0}',
      '.dplg-seg button.on.win{background:#16A34A;color:#fff}',
      '.dplg-seg button.on.draw{background:#D97706;color:#fff}',
      '.dplg-seg button.on.loss{background:#DC2626;color:#fff}',
      '.dplg-mini{height:24px;padding:0 7px;border:1px dashed var(--cm-border-strong);border-radius:5px;background:var(--cm-bg);color:var(--cm-fg-muted);font:500 11px/1 var(--cm-font-sans);cursor:pointer;flex-shrink:0}',
      '.dplg-mini:hover{border-color:var(--cm-accent);color:var(--cm-accent)}',
      '.dplg-pick{display:flex;flex-wrap:wrap;gap:5px;padding:8px 9px;border:1px solid var(--cm-border-soft);border-radius:8px;background:var(--cm-bg);margin:-2px 0 8px}',
      '.dplg-pick label{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border:1px solid var(--cm-border);border-radius:5px;font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg);cursor:pointer;background:var(--cm-surface)}',
      '.dplg-pick label.on{border-color:var(--cm-accent);color:var(--cm-accent)}',
      '.dplg-pick .num{font:600 9px/1 var(--cm-font-mono);color:var(--cm-fg-muted)}',
      '.dplg-gk{display:flex;align-items:center;gap:8px;padding:5px 2px}',
      '.dplg-gk .nm{flex:1;min-width:0;font:500 12px/1.2 var(--cm-font-sans);color:var(--cm-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dplg-gk input{width:52px;height:26px;padding:0 7px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg);color:var(--cm-fg-strong);font:600 12px/1 var(--cm-font-mono);text-align:center;outline:none}',
      '.dplg-hint{font:400 11px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:5px}',
      '.dplg-sync{display:flex;align-items:center;gap:7px;padding:9px 11px;margin-bottom:12px;border:1px solid #FDE68A;background:#FFFBEB;border-radius:8px;color:#92400E;font:500 12px/1.35 var(--cm-font-sans)}',
      '.dplg-pl{display:flex;flex-wrap:wrap;gap:5px}',
      '.dplg-pl button{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;border:1px solid var(--cm-border);background:var(--cm-surface);color:var(--cm-fg);font:500 11.5px/1 var(--cm-font-sans);cursor:pointer}',
      '.dplg-pl button .r{font:700 10px/1 var(--cm-font-mono);padding:2px 4px;border-radius:3px;color:#fff}',
      '.dplg-pl button .r.win{background:#16A34A}.dplg-pl button .r.draw{background:#D97706}.dplg-pl button .r.loss{background:#DC2626}.dplg-pl button .r.none{background:var(--cm-fg-faint)}',
      '.dplg-pl button.man{border-color:#7C3AED;box-shadow:inset 0 0 0 1px rgba(124,58,237,.25)}',
      '.dplg-f{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--cm-border-soft);background:var(--cm-bg-soft)}',
      '.dplg-f .grow{flex:1}',
      '.dplg-del{border:0;background:none;color:var(--cm-danger,#DC2626);font:500 12px/1 var(--cm-font-sans);cursor:pointer;padding:6px 8px;border-radius:6px}',
      '.dplg-del:hover{background:var(--cm-danger-bg,rgba(220,38,38,.1))}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Fila dentro de la card de la tarea ─────────────────────────────────────
  // Dos estados bien separados, para que nunca haya que adivinar qué puntúa:
  //   switch APAGADO → la tarea no existe para la liga
  //   switch ENCENDIDO → cuenta; y mientras no tenga resultado avisa "pendiente"
  // La marca se guarda como un evento sin resultados, así que no hace falta una
  // columna nueva en session_exercises y el olvido queda a la vista.
  // Se muestra en tareas que tienen grupos (o que ya están marcadas): una tarea
  // sin grupos no es un enfrentamiento.
  window.dpLgRow = function (e) {
    if (!L() || !L().isOn() || !e) return '';
    var ev = _events.bySeid[e.id] || null;
    var groups = (window._dpExGroups ? window._dpExGroups(e) : []).filter(function (g) { return (g.players || []).length; });
    if (!ev && !groups.length) return '';

    var on = !!ev;
    var sw = '<button class="dplg-sw' + (on ? ' is-on' : '') + '" onclick="dpLgToggleTask(\'' + e.id + '\')"'
           + ' title="' + esc(T('league.counts_hint', 'Only the tasks you mark give out points.')) + '">'
           + '<span class="tr"><b></b></span><i class="ti ti-trophy" style="font-size:12px"></i>'
           + esc(T('league.counts', 'Counts for the league')) + '</button>';
    if (!on) return '<div class="dplg-row no-print" data-lg="' + e.id + '">' + sw + '</div>';

    var state = eventState(ev);
    var inner = state.hasResult
      ? '<button class="dplg-chip" onclick="dpLgOpen(\'' + e.id + '\')" title="' + esc(T('league.edit_result', 'Edit result')) + '">'
        + '<span class="dot" style="background:' + esc(state.color) + '"></span>' + esc(state.label) + '</button>'
      : '<button class="dplg-pend" onclick="dpLgOpen(\'' + e.id + '\')">'
        + '<i class="ti ti-alert-triangle" style="font-size:12px"></i>' + esc(T('league.pending', 'Result pending')) + '</button>';
    // El grupo de la tarea cambió después de repartir los puntos: sin este aviso el alta
    // queda muda (los puntos sólo se recalculan al volver a guardar el resultado).
    var drift = planDrift(ev, e);
    if (drift) inner += '<button class="dplg-pend" onclick="dpLgOpen(\'' + e.id + '\')">'
      + '<i class="ti ti-user-plus" style="font-size:12px"></i>'
      + esc(T('league.drift', drift + ' without points', { count: drift })) + '</button>';
    return '<div class="dplg-row no-print" data-lg="' + e.id + '">' + sw + inner + '</div>';
  };

  // Badge para la planilla impresa (dpRenderPrintSheet). El sheet se arma con
  // estilos inline y sin las variables de tema de la app, así que va con colores
  // literales. Devuelve '' si la tarea no cuenta para la liga.
  window.dpLgPrintBadge = function (seid, FONT, MONO) {
    if (!L() || !L().isOn()) return '';
    var ev = _events.bySeid[seid];
    if (!ev) return '';
    var st = eventState(ev);
    var txt = st.hasResult ? st.label : T('league.print_tag', 'LEAGUE');
    return '<span style="display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:1px;'
      + 'background:#FFFBEB;border:1px solid #FDE68A;border-radius:4px;padding:1px 6px;'
      + 'font:700 8.5px ' + (MONO || 'monospace') + ';letter-spacing:.04em;color:#92400E;text-transform:uppercase">'
      + '&#9733; ' + esc(txt) + '</span>';
  };

  // Cómo está un evento: ¿ya tiene resultado? ¿quién ganó?
  function eventState(ev) {
    var gs = (ev && ev.groups) || [];
    var hasResult = !!(ev && ev.results && ev.results.length);
    if (!hasResult) return { hasResult: false, label: T('league.pending', 'Result pending'), color: '#D97706' };
    var wins = gs.filter(function (g) { return g.outcome === 'win'; });
    var allDraw = gs.length > 0 && gs.every(function (g) { return g.outcome === 'draw'; });
    return {
      hasResult: true,
      label: allDraw ? T('league.draw', 'Draw')
           : wins.length ? wins.map(function (g) { return g.name || '—'; }).join(' · ')
           : T('league.no_result', 'No result yet'),
      color: wins.length === 1 ? (wins[0].color || '#D97706') : '#D97706',
    };
  }

  // Marcar / desmarcar una tarea como competitiva. Marcar crea el evento sin
  // resultados (queda "pendiente"); desmarcar lo borra — con confirmación si ya
  // había puntos repartidos, porque eso saca puntos de la tabla del mes.
  window.dpLgToggleTask = async function (seid) {
    if (!L() || !L().isOn() || _busy) return;
    var c = ctx();
    if (c.readOnly) { toast(T('daily_planning.readonly_toast', "View only — you can't edit this planning.")); return; }
    if (!c.clubId || !c.teamId || !c.date) return;
    var ev = _events.bySeid[seid] || null;
    _busy = true;
    try {
      if (ev) {
        if (ev.results && ev.results.length && !confirm(T('league.untick_confirm', 'This task already gave out points. Remove it from the league?'))) return;
        if (!(await L().removeEvent(ev.id))) { toast(T('league.save_error', "Couldn't save the result.")); return; }
      } else {
        var task = window._dpFindTask ? window._dpFindTask(seid) : null;
        var season = await L().ensureSeason(c.clubId, c.teamId, c.date);
        if (!season) { toast(T('league.season_error', "Couldn't open this month's league.")); return; }
        if (season.status === 'closed') { toast(T('league.season_closed', 'This month is closed — no more results.')); return; }
        _season = season;
        var groups = (task && window._dpExGroups ? window._dpExGroups(task) : [])
          .filter(function (g) { return (g.players || []).length; })
          .map(function (g) { return { id: g.id, name: g.name, color: g.color, players: (g.players || []).map(String), outcome: null }; });
        var saved = await L().saveEvent({
          club_id: c.clubId, team_id: c.teamId, season_id: season.id, event_date: c.date,
          session_exercise_id: seid, title: (task && task.name) || null, groups: groups, results: [],
        });
        if (!saved) { toast(T('league.save_error', "Couldn't save the result.")); return; }
      }
      await window.dpLgSyncDay();
    } finally { _busy = false; }
  };

  // ── Carga del día ──────────────────────────────────────────────────────────
  window.dpLgSyncDay = async function () {
    if (!L() || !L().isOn()) return;
    var c = ctx();
    if (!c.clubId || !c.teamId || !c.date) return;
    _events = await L().loadDay(c.clubId, c.teamId, c.date);
    _season = await L().seasonFor(c.teamId, c.date);
    dpLgPaintRows();
    dpLgPaintLoose();
  };
  // Repinta solo las filas de liga ya presentes (sin re-render de las cards).
  function dpLgPaintRows() {
    document.querySelectorAll('.dp-ex-players[data-exp]').forEach(function (row) {
      var seid = row.getAttribute('data-exp');
      var task = window._dpFindTask ? window._dpFindTask(seid) : null;
      if (!task) return;
      var html = window.dpLgRow(task);
      var cur = row.querySelector('.dplg-row');
      if (cur) { if (html) cur.outerHTML = html; else cur.remove(); }
      else if (html) row.insertAdjacentHTML('beforeend', html);
    });
  }

  // ── Enfrentamientos sueltos (los que se arman en el campo) ─────────────────
  function dpLgPaintLoose() {
    var host = document.getElementById('dpLgLoose');
    if (!host) return;
    var btn = document.getElementById('dpLgNewBtn');
    if (btn) btn.style.display = (L() && L().isOn()) ? '' : 'none';
    if (!L() || !L().isOn()) { host.innerHTML = ''; return; }

    // Resumen del día: cuántas tareas cuentan y cuántas quedaron sin resultado.
    // El pendiente importa: si nadie carga quién ganó, esa tarea no reparte
    // puntos y el total del mes queda corto sin que nadie se entere.
    var all = _events.all || [];
    var pend = all.filter(function (ev) { return !(ev.results && ev.results.length); }).length;
    var summary = all.length
      ? '<div class="dplg-day"><i class="ti ti-trophy" style="font-size:13px"></i>'
        + '<span>' + esc(T('league.day_count', all.length + ' league tasks', { count: all.length })) + '</span>'
        + (pend ? '<span class="warn">· ' + esc(T('league.day_pending', pend + ' without a result', { count: pend })) + '</span>' : '')
        + '</div>'
      : '';

    var loose = (_events.loose || []).map(function (ev) {
      var st = eventState(ev);
      var n = (ev.groups || []).reduce(function (s, g) { return s + (g.players || []).length; }, 0);
      var cls = st.hasResult ? 'dplg-chip' : 'dplg-pend';
      return '<button class="' + cls + '" style="margin:0 6px 6px 0" onclick="dpLgOpenEvent(\'' + ev.id + '\')">'
           + '<i class="ti ti-trophy" style="font-size:12px"></i>'
           + esc(ev.title || T('league.loose_event', 'Field matchup')) + ' · ' + esc(st.label)
           + ' <span style="opacity:.7">(' + n + ')</span></button>';
    }).join('');
    host.innerHTML = summary + loose;
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  function ensureModal() {
    if (document.getElementById('dpLgBack')) return;
    injectCss();
    var d = document.createElement('div');
    d.id = 'dpLgBack';
    d.className = 'dplg-back no-print';
    d.addEventListener('click', function (e) { if (e.target === d) dpLgClose(); });
    d.innerHTML = '<div class="dplg-modal">'
      + '<div class="dplg-h"><div style="min-width:0"><h4 id="dpLgTitle">—</h4><div class="sub" id="dpLgSub">—</div></div>'
      + '<button class="x" onclick="dpLgClose()">&times;</button></div>'
      + '<div class="dplg-b" id="dpLgBody"></div>'
      + '<div class="dplg-f">'
      + '<button class="dplg-del" id="dpLgDel" style="display:none" onclick="dpLgRemove()">' + esc(T('league.remove', 'Remove from league')) + '</button>'
      + '<span class="grow"></span>'
      + '<button class="cm-btn is-ghost is-sm" onclick="dpLgClose()">' + esc(T('common.cancel', 'Cancel')) + '</button>'
      + '<button class="cm-btn is-primary is-sm" id="dpLgSaveBtn" onclick="dpLgSave()">' + esc(T('common.save', 'Save')) + '</button>'
      + '</div></div>';
    document.body.appendChild(d);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('dpLgBack').classList.contains('is-open')) dpLgClose();
    });
  }

  // Estado del modal desde un evento guardado (o desde los grupos del plan).
  function stateFromEvent(ev, fallbackGroups, title) {
    var groups = (ev && Array.isArray(ev.groups) && ev.groups.length ? ev.groups : fallbackGroups || []).map(function (g, i) {
      return {
        id: g.id || ('g' + (i + 1)),
        name: g.name || (T('league.group', 'Group') + ' ' + (i + 1)),
        color: g.color || ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DC2626', '#0891B2'][i % 6],
        players: (g.players || []).map(String),
        outcome: g.outcome || null,
      };
    });
    var ga = {}, manual = {};
    ((ev && ev.results) || []).forEach(function (r) {
      if (r.goals_against != null) ga[String(r.player_id)] = r.goals_against;
      if (r.is_manual) manual[String(r.player_id)] = r.outcome;
    });
    return {
      eventId: ev ? ev.id : null,
      seid: ev ? ev.session_exercise_id : null,
      title: (ev && ev.title) || title || '',
      groups: groups, ga: ga, manual: manual, editGid: null,
    };
  }

  // Los grupos de la tarea pueden cambiar DESPUÉS de cargar el resultado (el que llegó tarde,
  // el que se sumó desde el diferenciado). El snapshot congelado no se enteraba: el modal
  // seguía mostrando la lista vieja — «lo agregué al grupo y no aparece».
  // Fusión conservadora: se suman los que el plan tiene en un grupo del evento y que no están
  // en NINGUNO de sus grupos. No se saca a nadie (el que ya puntuó conserva sus puntos) ni se
  // toca ningún resultado ya marcado; los puntos de los nuevos recién se reparten al guardar.
  function mergePlanGroups(evGroups, planGroups) {
    var seen = {};
    evGroups.forEach(function (g) { (g.players || []).forEach(function (p) { seen[String(p)] = 1; }); });
    var added = 0;
    var out = evGroups.map(function (g) {
      var src = planGroups.filter(function (x) { return String(x.id) === String(g.id); })[0];
      if (!src) return g;
      var extra = (src.players || []).map(String).filter(function (p) { return !seen[p]; });
      if (!extra.length) return g;
      extra.forEach(function (p) { seen[p] = 1; });
      added += extra.length;
      return { id: g.id, name: g.name, color: g.color, outcome: g.outcome, players: (g.players || []).concat(extra) };
    });
    return { groups: out, added: added };
  }
  // Cuántos jugadores del plan quedaron fuera del evento ya puntuado (para avisar en la card
  // sin tener que abrir el modal). 0 = el resultado está al día.
  function planDrift(ev, task) {
    if (!ev || !ev.results || !ev.results.length) return 0;
    var plan = (window._dpExGroups ? window._dpExGroups(task) : []);
    return mergePlanGroups(ev.groups || [], plan).added;
  }

  window.dpLgOpen = function (seid) {
    if (!L() || !L().isOn()) return;
    var task = window._dpFindTask ? window._dpFindTask(seid) : null;
    if (!task) return;
    var ev = _events.bySeid[seid] || null;
    var planGroups = (window._dpExGroups ? window._dpExGroups(task) : []).filter(function (g) { return (g.players || []).length; });
    // Mientras no haya resultado, el PLAN manda: se marca la tarea el lunes, se
    // reacomodan los grupos el martes y el resultado del miércoles usa los de ese
    // día. Una vez cargado el resultado, gobierna el snapshot — pero con los altas
    // del plan fusionadas encima (mergePlanGroups).
    var pending = !(ev && ev.results && ev.results.length);
    _lg = stateFromEvent(pending ? null : ev, planGroups, task.name || '');
    if (!pending) {
      var m = mergePlanGroups(_lg.groups, planGroups);
      _lg.groups = m.groups;
      _lg.newFromPlan = m.added;
    }
    if (ev) _lg.eventId = ev.id;
    _lg.seid = seid;
    openWith(task.name || T('league.loose_event', 'Field matchup'));
  };

  window.dpLgOpenEvent = function (eventId) {
    var ev = (_events.all || []).find(function (x) { return String(x.id) === String(eventId); });
    if (!ev) return;
    _lg = stateFromEvent(ev, [], ev.title || '');
    openWith(ev.title || T('league.loose_event', 'Field matchup'));
  };

  window.dpLgNewLoose = function () {
    if (!L() || !L().isOn()) return;
    _lg = stateFromEvent(null, [
      { id: 'g1', name: T('league.group_n1', 'Team 1'), color: '#2563EB', players: [] },
      { id: 'g2', name: T('league.group_n2', 'Team 2'), color: '#DC2626', players: [] },
    ], T('league.loose_event', 'Field matchup'));
    openWith(T('league.loose_event', 'Field matchup'));
  };

  function openWith(title) {
    ensureModal();
    var c = ctx();
    document.getElementById('dpLgTitle').textContent = title || '—';
    document.getElementById('dpLgSub').textContent =
      (c.date || '') + ' · ' + T('league.league', 'Internal league') + ' · ' + (L().monthLabel(c.date) || '');
    document.getElementById('dpLgDel').style.display = _lg.eventId ? '' : 'none';
    renderBody();
    document.getElementById('dpLgBack').classList.add('is-open');
  }

  window.dpLgClose = function () {
    var b = document.getElementById('dpLgBack');
    if (b) b.classList.remove('is-open');
    _lg = null;
  };

  // Resultado calculado de cada jugador con el estado actual del modal.
  function currentResults() {
    var outcomes = {};
    _lg.groups.forEach(function (g) { if (g.outcome) outcomes[g.id] = g.outcome; });
    var keepers = [];
    _lg.groups.forEach(function (g) {
      (g.players || []).forEach(function (pid) { if (isKeeper(playerById(pid))) keepers.push(String(pid)); });
    });
    return L().compute(_lg.groups, { outcomes: outcomes, ga: _lg.ga, manual: _lg.manual, keepers: keepers },
                       _season ? { win: _season.points_win, draw: _season.points_draw, loss: _season.points_loss } : null);
  }

  function renderBody() {
    var body = document.getElementById('dpLgBody');
    if (!body || !_lg) return;
    var results = currentResults();
    var byPid = {};
    results.forEach(function (r) { byPid[String(r.player_id)] = r; });

    // 1) Grupos
    var gHtml = _lg.groups.map(function (g, i) {
      var seg = ['win', 'draw', 'loss'].map(function (o) {
        return '<button class="' + o + (g.outcome === o ? ' on' : '') + '" title="' + esc(T('league.' + o, o)) + '"'
             + ' onclick="dpLgSetOutcome(\'' + g.id + '\',\'' + o + '\')">' + esc(outShort(o)) + '</button>';
      }).join('');
      var pick = _lg.editGid === g.id ? renderPicker(g) : '';
      return '<div class="dplg-g">'
        + '<span class="dot" style="background:' + esc(g.color) + '"></span>'
        + '<input class="nm" value="' + esc(g.name) + '" oninput="dpLgRenameGroup(\'' + g.id + '\',this.value)">'
        + '<span class="ct">' + (g.players || []).length + '</span>'
        + '<button class="dplg-mini" onclick="dpLgTogglePicker(\'' + g.id + '\')">' + esc(T('league.edit_players', 'Players')) + '</button>'
        + '<div class="dplg-seg">' + seg + '</div>'
        + '</div>' + pick;
    }).join('');
    var addG = '<button class="dplg-mini" onclick="dpLgAddGroup()">＋ ' + esc(T('league.add_group', 'Add group')) + '</button>';

    // 2) Arqueros — solo si hay más de uno metido en el enfrentamiento.
    var keepers = [];
    _lg.groups.forEach(function (g) {
      (g.players || []).forEach(function (pid) {
        var p = playerById(pid);
        if (isKeeper(p)) keepers.push({ p: p, gid: g.id });
      });
    });
    var gkHtml = '';
    if (keepers.length >= 2) {
      gkHtml = '<div><div class="dplg-sec-t">' + esc(T('league.keepers', 'Goalkeepers')) + '</div>'
        + keepers.map(function (k) {
            var pid = String(k.p.id);
            var v = (_lg.ga[pid] == null ? '' : _lg.ga[pid]);
            return '<div class="dplg-gk"><span class="nm">'
              + '<b style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-right:6px">' + esc(k.p.number == null ? '—' : k.p.number) + '</b>'
              + esc(playerShort(k.p)) + '</span>'
              + '<input type="number" min="0" max="99" value="' + esc(v) + '" placeholder="—" oninput="dpLgSetGa(\'' + pid + '\',this.value)">'
              + '</div>';
          }).join('')
        + '<div class="dplg-hint">' + esc(T('league.keepers_hint', 'With rotation the keeper who concedes the most loses, the one who concedes the least wins. Leave empty to score like their team.')) + '</div></div>';
    }

    // 3) Jugadores — chip por jugador; click corrige a mano (y queda marcado).
    var plHtml = '';
    var all = [];
    _lg.groups.forEach(function (g) { (g.players || []).forEach(function (pid) { all.push({ pid: String(pid), g: g }); }); });
    if (all.length) {
      plHtml = '<div><div class="dplg-sec-t">' + esc(T('league.players', 'Players')) + ' · ' + all.length + '</div><div class="dplg-pl">'
        + all.map(function (x) {
            var p = playerById(x.pid);
            var r = byPid[x.pid];
            var o = r ? r.outcome : null;
            var man = !!_lg.manual[x.pid];
            return '<button class="' + (man ? 'man' : '') + '" onclick="dpLgCyclePlayer(\'' + x.pid + '\')" title="' + esc(T('league.cycle_hint', 'Click to correct this player')) + '">'
              + '<span class="r ' + (o ? OUT_CLS[o] : 'none') + '">' + esc(outShort(o)) + '</span>'
              + esc(p ? playerShort(p) : '—') + '</button>';
          }).join('')
        + '</div><div class="dplg-hint">' + esc(T('league.players_hint', 'A corrected player keeps their result even if the group changes.')) + '</div></div>';
    }

    // 0) Altas traídas del plan al abrir: hay que guardar para que reciban puntos.
    var syncHtml = _lg.newFromPlan
      ? '<div class="dplg-sync"><i class="ti ti-arrow-down-circle" style="font-size:14px"></i><span>'
        + esc(T('league.plan_added', _lg.newFromPlan + ' player(s) added from the task — save to give them points.', { count: _lg.newFromPlan }))
        + '</span></div>'
      : '';

    body.innerHTML = syncHtml
      + '<div><div class="dplg-sec-t">' + esc(T('league.groups', 'Groups')) + '</div>' + gHtml + addG + '</div>'
      + gkHtml + plHtml;
  }

  // ── Acciones del modal ─────────────────────────────────────────────────────
  // Con dos grupos, marcar uno resuelve el otro: un click y listo.
  window.dpLgSetOutcome = function (gid, o) {
    if (!_lg) return;
    var g = _lg.groups.find(function (x) { return x.id === gid; });
    if (!g) return;
    g.outcome = (g.outcome === o) ? null : o;
    if (_lg.groups.length === 2 && g.outcome) {
      var other = _lg.groups.find(function (x) { return x.id !== gid; });
      if (other) other.outcome = g.outcome === 'draw' ? 'draw' : (g.outcome === 'win' ? 'loss' : 'win');
    }
    renderBody();
  };
  window.dpLgRenameGroup = function (gid, name) {
    if (!_lg) return;
    var g = _lg.groups.find(function (x) { return x.id === gid; });
    if (g) g.name = name;                       // sin re-render: no perder el foco del input
  };
  window.dpLgAddGroup = function () {
    if (!_lg) return;
    var n = _lg.groups.length + 1;
    _lg.groups.push({ id: 'g' + n, name: T('league.group', 'Group') + ' ' + n,
      color: ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DC2626', '#0891B2'][(n - 1) % 6], players: [], outcome: null });
    renderBody();
  };
  window.dpLgTogglePicker = function (gid) {
    if (!_lg) return;
    _lg.editGid = (_lg.editGid === gid) ? null : gid;
    renderBody();
  };
  function renderPicker(g) {
    var taken = {};
    _lg.groups.forEach(function (x) { if (x.id !== g.id) (x.players || []).forEach(function (p) { taken[String(p)] = 1; }); });
    var pool = (window._dpTrainees ? window._dpTrainees() : []);
    var sel = {};
    (g.players || []).forEach(function (p) { sel[String(p)] = 1; });
    // Los ya elegidos siguen visibles aunque hoy no estén disponibles: sacarlos tiene que ser posible.
    var extra = (g.players || []).filter(function (p) { return !pool.some(function (q) { return String(q.id) === String(p); }); })
      .map(function (p) { return playerById(p); }).filter(Boolean);
    var list = pool.concat(extra).filter(function (p) { return !taken[String(p.id)]; });
    if (!list.length) return '<div class="dplg-pick">' + esc(T('league.no_players', 'No available players.')) + '</div>';
    return '<div class="dplg-pick">' + list.map(function (p) {
      var on = !!sel[String(p.id)];
      return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" ' + (on ? 'checked' : '')
        + ' onchange="dpLgTogglePlayer(\'' + g.id + '\',\'' + p.id + '\',this.checked)">'
        + '<span class="num">' + esc(p.number == null ? '—' : p.number) + '</span>' + esc(playerShort(p)) + '</label>';
    }).join('') + '</div>';
  }
  window.dpLgTogglePlayer = function (gid, pid, on) {
    if (!_lg) return;
    var g = _lg.groups.find(function (x) { return x.id === gid; });
    if (!g) return;
    g.players = (g.players || []).filter(function (x) { return String(x) !== String(pid); });
    if (on) g.players.push(String(pid));
    else { delete _lg.ga[String(pid)]; delete _lg.manual[String(pid)]; }
    renderBody();
  };
  window.dpLgSetGa = function (pid, v) {
    if (!_lg) return;
    if (v === '' || v == null) delete _lg.ga[String(pid)];
    else _lg.ga[String(pid)] = Math.max(0, parseInt(v, 10) || 0);
    // Sin re-render completo: repintar solo los chips dejaría el input a medias.
    clearTimeout(window._dpLgGaT);
    window._dpLgGaT = setTimeout(function () {
      var el = document.activeElement;
      var keep = el && el.tagName === 'INPUT' ? el.value : null;
      renderBody();
      if (keep != null) {
        var inp = document.querySelector('.dplg-gk input[oninput*="' + pid + '"]');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }
    }, 350);
  };
  // win → draw → loss → automático
  window.dpLgCyclePlayer = function (pid) {
    if (!_lg) return;
    var cur = _lg.manual[String(pid)] || null;
    var next = cur === 'win' ? 'draw' : cur === 'draw' ? 'loss' : cur === 'loss' ? null : 'win';
    if (next) _lg.manual[String(pid)] = next; else delete _lg.manual[String(pid)];
    renderBody();
  };

  window.dpLgSave = async function () {
    if (!_lg || _busy) return;
    var c = ctx();
    if (c.readOnly) { toast(T('daily_planning.readonly_toast', "View only — you can't edit this planning.")); return; }
    if (!c.clubId || !c.teamId || !c.date) return;
    var withPlayers = _lg.groups.filter(function (g) { return (g.players || []).length; });
    if (withPlayers.length < 2) { toast(T('league.needs_two_groups', 'Two groups with players are needed.')); return; }
    if (!withPlayers.some(function (g) { return g.outcome; }) && !Object.keys(_lg.manual).length && Object.keys(_lg.ga).length < 2) {
      toast(T('league.needs_result', 'Mark who won first.')); return;
    }
    _busy = true;
    var btn = document.getElementById('dpLgSaveBtn');
    if (btn) btn.disabled = true;
    try {
      var season = await L().ensureSeason(c.clubId, c.teamId, c.date);
      if (!season) { toast(T('league.season_error', "Couldn't open this month's league.")); return; }
      if (season.status === 'closed') { toast(T('league.season_closed', 'This month is closed — no more results.')); return; }
      _season = season;
      var saved = await L().saveEvent({
        id: _lg.eventId || undefined,
        club_id: c.clubId, team_id: c.teamId, season_id: season.id,
        event_date: c.date,
        session_exercise_id: _lg.seid || null,
        title: _lg.title || null,
        groups: withPlayers.map(function (g) {
          return { id: g.id, name: g.name, color: g.color, players: g.players, outcome: g.outcome || null };
        }),
        results: currentResults(),
      });
      if (!saved) { toast(T('league.save_error', "Couldn't save the result.")); return; }
      toast(T('league.saved', 'Result saved.'));
      dpLgClose();
      await window.dpLgSyncDay();
    } finally {
      _busy = false;
      if (btn) btn.disabled = false;
    }
  };

  window.dpLgRemove = async function () {
    if (!_lg || !_lg.eventId) return;
    if (ctx().readOnly) { toast(T('daily_planning.readonly_toast', "View only — you can't edit this planning.")); return; }
    if (!confirm(T('league.remove_confirm', 'Remove this result from the league?'))) return;
    var ok = await L().removeEvent(_lg.eventId);
    if (!ok) { toast(T('league.save_error', "Couldn't save the result.")); return; }
    dpLgClose();
    await window.dpLgSyncDay();
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  (async function () {
    if (!window.CMLeague) return;
    await window.CMLeague.init();
    if (!window.CMLeague.isOn()) return;
    injectCss();
    var btn = document.getElementById('dpLgNewBtn');
    if (btn) btn.style.display = '';
    // La página ya pintó las cards antes de que el flag resolviera: repintar.
    window.dpLgSyncDay();
  })();
})();
