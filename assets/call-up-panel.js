/* ── Panel «Llamar jugadores» ─────────────────────────────────────────────────
   Llamar a un jugador de otra categoría por días sueltos, sin pasarlo de plantel
   (player_call_ups, migraciones 185/187). Vive acá y no en una pantalla porque lo usan
   Availability —donde se eligen días de la grilla o toda la semana— y Daily Planning —donde
   el día ya está decidido: es el que estás planificando—. El mismo panel, la misma escritura
   y el mismo aviso; lo único que cambia es de dónde salen las fechas.

   Uso:
     window.cmCallUpPanel.open({
       anchor,                    // el botón que lo abre (el panel se ancla ahí)
       clubId, teamId, teamName,  // equipo que LLAMA
       excludeIds,                // ids que ya son de este plantel (no se ofrecen)
       calledUpIds,               // ids ya llamados (se ofrecen, marcados: sirve para sumar días)
       actions: [                 // uno o más botones de confirmación
         { key:'day', kind:'day', primary:true, dates: () => ['2026-05-18'] },
       ],
       onDone: (res) => {}        // después de escribir, para que la pantalla se refresque
     });

   `kind` decide el texto del botón ('selection' | 'range' | 'day') y si el verbo es "llamar"
   o "pedir" lo resuelve el panel según a quién hayas marcado.
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.cmCallUpPanel) return;

  function tt(key, fallback, vars) {
    var v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(key, vars) : null;
    var out = (v && v !== key) ? v : (fallback != null ? fallback : key);
    if (vars) Object.keys(vars).forEach(function (k) { out = String(out).split('{' + k + '}').join(vars[k]); });
    return out;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }

  // ── CSS (una vez) ──
  if (!document.getElementById('cm-cu-css')) {
    var st = document.createElement('style');
    st.id = 'cm-cu-css';
    st.textContent = `
.cm-cu-panel{position:fixed;z-index:60;width:340px;max-height:min(70vh,520px);display:none;flex-direction:column;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:12px;box-shadow:var(--cm-shadow-lg,0 18px 40px rgba(15,23,42,.18));overflow:hidden}
.cm-cu-panel.is-open{display:flex}
.cm-cu-panel .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--cm-border);font:600 12.5px/1 var(--cm-font-sans);color:var(--cm-fg-strong)}
.cm-cu-panel .hd .x{margin-left:auto;border:0;background:transparent;color:var(--cm-fg-faint);cursor:pointer;font-size:15px}
.cm-cu-panel .sub{padding:8px 12px 0;color:var(--cm-fg-muted);font:500 11.5px/1.45 var(--cm-font-sans)}
.cm-cu-panel .srch{padding:8px 12px}
.cm-cu-panel .srch input{width:100%;height:30px;padding:0 9px;border:1px solid var(--cm-border);border-radius:7px;background:var(--cm-bg-soft);color:var(--cm-fg-strong);font:500 12px var(--cm-font-sans)}
/* min-height:0 — sin eso el flex item no se deja encoger y el scroll interno no aparece:
   la lista empuja el pie (los botones de confirmar) fuera del panel. */
.cm-cu-list{flex:1;min-height:0;overflow-y:auto;padding:0 6px 6px}
.cm-cu-list .grp{padding:8px 6px 4px;color:var(--cm-fg-faint);font:600 9.5px/1 var(--cm-font-mono);letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;gap:6px}
.cm-cu-list .grp .ask{color:#C2410C;background:rgba(234,88,12,0.12);border-radius:3px;padding:2px 5px;letter-spacing:.02em}
.cm-cu-list .empty{padding:14px 12px;color:var(--cm-fg-muted);font:500 11.5px/1.5 var(--cm-font-sans)}
.cm-cu-opt{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;font:500 12px var(--cm-font-sans);color:var(--cm-fg-strong)}
.cm-cu-opt:hover{background:var(--cm-bg-soft)}
.cm-cu-opt .num{width:20px;text-align:center;color:var(--cm-fg-faint);font:600 11px var(--cm-font-mono)}
.cm-cu-opt .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-cu-opt .already{color:var(--cm-fg-faint);font:600 9.5px var(--cm-font-mono)}
/* Cara del jugador: el panel lista gente de OTRAS categorías, que es justamente a la que el
   entrenador no le ve la cara. Sin foto queda en las iniciales, como el resto de la app. */
.cm-cu-face{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--cm-bg-sunk);border:1px solid var(--cm-border);color:var(--cm-fg-muted);font:600 9.5px/1 var(--cm-font-sans);background-size:cover;background-position:center;overflow:hidden}
.cm-cu-face[data-cm-photo-src-done]{color:transparent;border-color:transparent}
.cm-cu-face.has-face{cursor:zoom-in}
.cm-cu-panel .ft{border-top:1px solid var(--cm-border);padding:9px 12px;display:flex;flex-direction:column;gap:7px}
.cm-cu-panel .ft .when{color:var(--cm-fg-muted);font:500 11px/1.4 var(--cm-font-sans)}
.cm-cu-panel .ft .row{display:flex;gap:6px}
.cm-cu-panel .ft button{flex:1;height:30px;border-radius:7px;border:1px solid var(--cm-border);background:var(--cm-bg-soft);color:var(--cm-fg-strong);font:600 11.5px var(--cm-font-sans);cursor:pointer}
.cm-cu-panel .ft button.primary{background:var(--cm-accent);border-color:var(--cm-accent);color:#fff}
.cm-cu-panel .ft button:disabled{opacity:.5;cursor:not-allowed}
/* La ampliación de la foto va en un nodo suelto y position:fixed: dentro de la lista la
   recortaría el overflow del scroll. */
.cm-cu-zoom{position:fixed;z-index:80;width:190px;border-radius:12px;overflow:hidden;display:none;background:var(--cm-surface);border:1px solid var(--cm-border);box-shadow:0 18px 44px rgba(15,23,42,.24);pointer-events:none}
.cm-cu-zoom.is-on{display:block}
.cm-cu-zoom .img{width:190px;height:190px;background-size:cover;background-position:center top;background-color:var(--cm-bg-sunk)}
.cm-cu-zoom .cap{padding:7px 10px}
.cm-cu-zoom .cap .n{font:600 12.5px/1.25 var(--cm-font-sans);color:var(--cm-fg-strong)}
.cm-cu-zoom .cap .s{margin-top:2px;font:500 11px/1.2 var(--cm-font-sans);color:var(--cm-fg-muted)}`;
    document.head.appendChild(st);
  }

  var _panel = null, _zoom = null;
  var _cfg = null;                 // configuración de la apertura en curso
  var _pool = null, _poolKey = '', _pick = new Set(), _anchor = null, _zoomTimer = null;

  function _dom() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.className = 'cm-cu-panel';
    _panel.id = 'cmCuPanel';
    _panel.innerHTML =
      '<div class="hd"><i class="ti ti-user-plus" style="font-size:14px"></i><span class="ttl"></span><button class="x" type="button"><i class="ti ti-x"></i></button></div>' +
      '<div class="sub"></div>' +
      '<div class="srch"><input id="cmCuSearch" type="search"></div>' +
      '<div class="cm-cu-list" id="cmCuList"></div>' +
      '<div class="ft"><div class="when" id="cmCuWhen"></div><div class="row" id="cmCuActions"></div></div>';
    document.body.appendChild(_panel);
    _zoom = document.createElement('div');
    _zoom.className = 'cm-cu-zoom';
    _zoom.id = 'cmCuZoom';
    _zoom.innerHTML = '<div class="img"></div><div class="cap"><div class="n"></div><div class="s"></div></div>';
    document.body.appendChild(_zoom);

    _panel.querySelector('.x').addEventListener('click', close);
    _panel.querySelector('#cmCuSearch').addEventListener('input', renderList);
    document.addEventListener('click', function (e) {
      if (!_panel.classList.contains('is-open')) return;
      if (_panel.contains(e.target) || (_anchor && _anchor.contains(e.target))) return;
      close();
    });
    // El panel está anclado a un botón de la página: si scrollea o cambia el tamaño, hay que
    // reubicarlo o queda flotando lejos de su origen.
    window.addEventListener('resize', function () { place(); });
    window.addEventListener('scroll', function () { place(); }, { passive: true });
    // Ampliar la cara con el mouse encima, sin click: clickear ahí tildaría el casillero,
    // porque el avatar vive dentro del <label> de la fila.
    document.addEventListener('mouseover', function (e) {
      var face = e.target.closest && e.target.closest('.cm-cu-face.has-face');
      clearTimeout(_zoomTimer);
      if (!face) { hideFace(); return; }
      _zoomTimer = setTimeout(function () { showFace(face); }, 180);   // un respiro: sin esto se prende y apaga por cada fila
    });
  }

  // Colocar el panel. Se llama DESPUÉS de dibujar la lista, no solo al abrir: con el panel
  // vacío la medición da una altura chica, y cuando entra el contenido crece hacia abajo y se
  // va de la pantalla, con el pie (los botones) fuera del viewport y sin forma de llegar.
  function place(anchor) {
    var a = anchor || _anchor;
    if (!_panel || !a || !_panel.classList.contains('is-open')) return;
    _anchor = a;
    var r = a.getBoundingClientRect(), margen = 10;
    var abajo = window.innerHeight - r.bottom - margen, arriba = r.top - margen;
    var haciaArriba = abajo < 280 && arriba > abajo;
    _panel.style.maxHeight = Math.max(200, Math.min(520, (haciaArriba ? arriba : abajo) - 6)) + 'px';
    if (haciaArriba) { _panel.style.top = 'auto'; _panel.style.bottom = (window.innerHeight - r.top + 6) + 'px'; }
    else             { _panel.style.bottom = 'auto'; _panel.style.top = (r.bottom + 6) + 'px'; }
    // Alineado por el borde DERECHO del botón: el panel es más ancho y así no se va de costado.
    var w = _panel.offsetWidth || 340;
    _panel.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  }

  // Candidatos: TODAS las categorías del club, no solo las que veo. Las que no veo no se
  // pueden llamar directo — se piden, y decide el entrenador que tiene al jugador. Por eso no
  // sirve la tabla players (su RLS, con razón, tapa a los de otras categorías: ahí cuelgan
  // ficha, lesiones y evaluaciones): call_up_candidates() devuelve lo mínimo para elegir de
  // una lista — nombre, dorsal, puesto, categoría y foto — más el flag can_call.
  async function candidates(clubId, teamId, opts) {
    var key = String(clubId) + '|' + String(teamId);
    if (_pool && _poolKey === key && !(opts && opts.force)) return _pool;
    _poolKey = key;
    if (!teamId || !window.sb) { _pool = []; return _pool; }
    try {
      var r = await window.sb.rpc('call_up_candidates', { p_team: teamId });
      if (r.error) throw r.error;
      _pool = (r.data || [])
        .map(function (p) { return Object.assign({}, p, { _srcTeam: p.team_id, _srcName: p.team_name, _needsOk: !p.can_call }); })
        .sort(function (a, b) { return String(a.last_name || '').localeCompare(String(b.last_name || '')); });
    } catch (e) {
      console.warn('[call-up panel] candidates:', e && e.message);
      _pool = [];
    }
    return _pool;
  }

  function visible() {
    var skip = _cfg && _cfg.excludeIds instanceof Set ? _cfg.excludeIds : new Set(_cfg && _cfg.excludeIds || []);
    return (_pool || []).filter(function (p) { return !skip.has(p.id); });
  }

  function renderList() {
    var box = _panel && _panel.querySelector('#cmCuList');
    if (!box) return;
    var pool = visible();
    if (!pool.length) {
      // No depende de a qué categorías tengas acceso: la lista cubre todo el club. Vacía
      // significa que no hay nadie más, no que te falten permisos.
      box.innerHTML = '<div class="empty">' + esc(tt('availability.callUpNoPlayers', 'No players available in other squads.')) + '</div>';
      return updateFooter();
    }
    var q = (_panel.querySelector('#cmCuSearch').value || '').trim().toLowerCase();
    var byTeam = new Map();
    pool.filter(function (p) { return !q || (String(p.first_name || '') + ' ' + String(p.last_name || '') + ' ' + (p.number == null ? '' : p.number)).toLowerCase().indexOf(q) >= 0; })
        .forEach(function (p) {
          var k = p._srcTeam || '';
          if (!byTeam.has(k)) byTeam.set(k, []);
          byTeam.get(k).push(p);
        });
    if (!byTeam.size) {
      box.innerHTML = '<div class="empty">' + esc(tt('availability.callUpNoMatch', 'No player matches that search.')) + '</div>';
      return updateFooter();
    }
    var called = _cfg && _cfg.calledUpIds instanceof Set ? _cfg.calledUpIds : new Set(_cfg && _cfg.calledUpIds || []);
    var html = '';
    byTeam.forEach(function (list, tid) {
      // Categoría que no manejo → sus jugadores se piden, no se llaman. Se avisa en el título
      // del grupo, antes de elegir a nadie: enterarse después de apretar el botón es peor.
      var needsOk = list.length && list.every(function (p) { return p._needsOk; });
      html += '<div class="grp">' + esc(list[0] && list[0]._srcName || '') +
        (needsOk ? '<span class="ask">' + esc(tt('availability.callUpNeedsOk', 'needs approval')) + '</span>' : '') + '</div>';
      list.forEach(function (p) {
        var nm = [String(p.last_name || '').toUpperCase(), p.first_name || ''].filter(Boolean).join(' ');
        var ini = [String(p.last_name || '')[0], String(p.first_name || '')[0]].filter(Boolean).join('').toUpperCase() || '?';
        var face = '<span class="cm-cu-face' + (p.photo_url ? ' has-face" data-cm-photo-src="' + esc(p.photo_url) + '" data-face-id="' + esc(p.id) + '"' : '"') + '>' + esc(ini) + '</span>';
        html += '<label class="cm-cu-opt"><input type="checkbox" value="' + esc(p.id) + '"' + (_pick.has(p.id) ? ' checked' : '') + '>' +
          face + '<span class="num">' + esc(p.number == null ? '—' : p.number) + '</span><span class="nm">' + esc(nm) + '</span>' +
          (called.has(p.id) ? '<span class="already">' + esc(tt('availability.callUpAlready', 'already called')) + '</span>' : '') +
          '</label>';
      });
    });
    box.innerHTML = html;
    box.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) _pick.add(cb.value); else _pick.delete(cb.value);
        updateFooter();
      });
    });
    try { window.cmPaintPhotoSrcs && window.cmPaintPhotoSrcs(box); } catch (_) {}
    updateFooter();
    place();   // filtrar cambia el alto del contenido
  }

  function askCount() {
    return visible().filter(function (p) { return _pick.has(p.id) && p._needsOk; }).length;
  }

  function actionLabel(a, dates, soloPedidos) {
    var n = dates.length;
    if (a.kind === 'selection') return soloPedidos
      ? tt('availability.callUpAskForSelection', 'Request · selected days (' + n + ')', { count: n })
      : tt('availability.callUpForSelection', 'Selected days (' + n + ')', { count: n });
    if (a.kind === 'range') return soloPedidos
      ? tt('availability.callUpAskForRange', 'Request · whole range (' + n + ')', { count: n })
      : tt('availability.callUpForRange', 'Whole range (' + n + ')', { count: n });
    // `dateLabel` deja poner la fecha como la escribe la pantalla ("jue 24 sep") en vez del
    // 2026-09-24 crudo: el botón lo lee un entrenador, no un sistema.
    var d = a.dateLabel || dates[0] || '';
    return soloPedidos
      ? tt('availability.callUpAskForDay', 'Request for {date}', { date: d })
      : tt('availability.callUpForDay', 'Call up for {date}', { date: d });
  }

  function updateFooter() {
    if (!_panel || !_cfg) return;
    var n = _pick.size, nAsk = askCount();
    var row = _panel.querySelector('#cmCuActions');
    row.innerHTML = '';
    (_cfg.actions || []).forEach(function (a) {
      var dates = a.dates() || [];
      var b = document.createElement('button');
      b.type = 'button';
      b.id = 'cmCuAct-' + a.key;
      b.dataset.cuKey = a.key;
      if (a.primary) b.className = 'primary';
      b.textContent = actionLabel(a, dates, n > 0 && nAsk === n);
      b.disabled = !n || !dates.length;
      b.addEventListener('click', function () { submit(a, b); });
      row.appendChild(b);
    });
    var when = _panel.querySelector('#cmCuWhen');
    if (!n) { when.textContent = tt('availability.callUpPickSomeone', 'Pick at least one player.'); return; }
    // Aviso explícito cuando la selección mezcla: se llama a unos y se pide por otros.
    if (nAsk) {
      when.textContent = nAsk === n
        ? tt('availability.callUpWhenAsk', nAsk + ' player(s) need their coach to approve', { count: nAsk })
        : tt('availability.callUpWhenMixed', (n - nAsk) + ' called up now · ' + nAsk + ' need approval', { direct: n - nAsk, ask: nAsk });
      return;
    }
    // El pie lo termina de escribir la pantalla: en Availability depende de qué celdas marcaste,
    // en Daily Planning el día ya está decidido y basta con nombrarlo.
    when.textContent = (typeof _cfg.hint === 'function' ? _cfg.hint(n) : _cfg.hint) || '';
  }

  async function submit(action, btn) {
    var dates = action.dates() || [];
    var pids = Array.from(_pick);
    if (!pids.length || !dates.length) return;
    var pool = visible();
    // Los de una categoría que NO manejo se PIDEN: quedan a la espera y no entran a ningún
    // roster. La base impone lo mismo (RLS); esto es para mandar el estado correcto y poder
    // avisar a quien tiene que decidir.
    var ask = new Set(pool.filter(function (p) { return _pick.has(p.id) && p._needsOk; }).map(function (p) { return p.id; }));
    btn.disabled = true;
    btn.textContent = tt('common.saving', 'Saving…');
    var res = await window.cmCallUpAdd(_cfg.clubId, _cfg.teamId, pids, dates, ask);
    close();
    if (!res.ok) { alert(tt('availability.callUpFailed', 'Could not call the players up: {err}', { err: res.error || '' })); return; }

    // Avisos. Van después de guardar: si se grabó y el aviso falla, lo guardado sigue estando —
    // al revés sería avisar de algo que no pasó. UNA notificación POR JUGADOR, no una por tanda:
    // la del pedido se resuelve con un botón desde la campana y tiene que hablar de alguien.
    var cuando = dates.length > 1 ? (dates[0] + ' → ' + dates[dates.length - 1]) : dates[0];
    async function avisar(ids, tipo) {
      var lista = pool.filter(function (p) { return ids.has(p.id); });
      if (!lista.length) return;
      var teams = Array.from(new Set(lista.map(function (p) { return p._srcTeam; })));
      var who = await window.cmCallUpDeciders(_cfg.clubId, teams);
      if (!who.length) return;
      for (var i = 0; i < lista.length; i++) {
        var p = lista[i];
        var nm = (String(p.first_name || '') + ' ' + String(p.last_name || '')).trim();
        await window.cmNotifyCallUp(_cfg.clubId, who,
          (tipo === 'call_up_request' ? _cfg.teamName + ' is asking for ' : _cfg.teamName + ' called up ') + nm,
          dates.length + ' day(s) · ' + cuando, tipo,
          { kind: 'call_up', player_id: p.id, player: nm, team_id: _cfg.teamId, team: _cfg.teamName,
            from: dates[0], to: dates[dates.length - 1], count: dates.length });
      }
    }
    try {
      if (ask.size) await avisar(ask, 'call_up_request');
      // El llamado directo no se decide, pero el que tiene al jugador se tiene que enterar:
      // mañana lo busca para su sesión y no está.
      var direct = new Set(pids.filter(function (id) { return !ask.has(id); }));
      if (direct.size) await avisar(direct, 'call_up_direct');
    } catch (e) { console.warn('[call-up panel] notify:', e && e.message); }

    if (ask.size) {
      alert(res.called
        ? tt('availability.callUpMixedDone', res.called + ' called up · ' + res.requested + ' request(s) sent, waiting for their coach', { direct: res.called, ask: res.requested })
        : tt('availability.callUpAskDone', res.requested + " request(s) sent. They won't show up here until their coach approves.", { count: res.requested }));
    }
    // La llamada quedó, pero marcar su disponibilidad requiere ver también SU categoría. Si eso
    // falló, el jugador aparece igual en la lista: lo que no pasa es que su equipo lo vea como
    // "con otro equipo" ese día. Hay que decirlo — si no, los dos cuerpos técnicos lo cuentan.
    if (res.availError) alert(tt('availability.callUpPartial', 'Called up, but their own squad was not updated ({err}). Ask an admin to check your access to that category.', { err: res.availError }));
    _pool = null;
    if (_cfg && typeof _cfg.onDone === 'function') _cfg.onDone(res);
  }

  function showFace(el) {
    if (!_zoom) return;
    var src = el.getAttribute('data-cm-photo-src');
    if (!src) return;
    var pid = el.getAttribute('data-face-id');
    var p = (_pool || []).find(function (x) { return String(x.id) === String(pid); });
    (async function () {
      var url = '';
      try { url = await window.cmPlayerPhotoUrlAsync({ id: pid, photo_url: src }); } catch (_) {}
      if (!url || !el.isConnected || !el.matches(':hover')) return;   // se fue el mouse mientras firmaba
      _zoom.querySelector('.img').style.backgroundImage = "url('" + String(url).replace(/'/g, '%27') + "')";
      _zoom.querySelector('.cap .n').textContent = p ? (String(p.first_name || '') + ' ' + String(p.last_name || '')).trim() : '';
      _zoom.querySelector('.cap .s').textContent = p
        ? [p.number != null ? '#' + p.number : '', p.position || '', p.team_name || ''].filter(Boolean).join(' · ')
        : '';
      _zoom.classList.add('is-on');
      // Al costado del panel, del lado donde entre.
      var r = el.getBoundingClientRect();
      var w = _zoom.offsetWidth || 190, h = _zoom.offsetHeight || 250;
      var pr = _panel ? _panel.getBoundingClientRect() : r;
      var left = pr.left - w - 10;
      if (left < 8) left = Math.min(pr.right + 10, window.innerWidth - w - 8);
      _zoom.style.left = Math.max(8, left) + 'px';
      _zoom.style.top = Math.max(8, Math.min(r.top - 20, window.innerHeight - h - 8)) + 'px';
    })();
  }
  function hideFace() { _zoom && _zoom.classList.remove('is-on'); }

  function close() {
    if (!_panel) return;
    _panel.classList.remove('is-open');
    _anchor = null;
    clearTimeout(_zoomTimer);
    hideFace();
  }

  async function open(cfg) {
    _dom();
    if (_panel.classList.contains('is-open')) { close(); return; }
    _cfg = cfg || {};
    _pick = new Set();
    _anchor = _cfg.anchor || null;
    _panel.querySelector('.hd .ttl').textContent = tt('availability.callUpTitle', 'Call up players');
    _panel.querySelector('.sub').textContent = _cfg.sub || tt('availability.callUpSub', "From other squads, for the days you choose only. They don't join this squad.");
    var sr = _panel.querySelector('#cmCuSearch');
    sr.value = '';
    sr.placeholder = tt('availability.callUpSearch', 'Search player…');
    _panel.querySelector('#cmCuList').innerHTML = '<div class="empty">' + esc(tt('common.loading', 'Loading…')) + '</div>';
    _panel.classList.add('is-open');
    place(_cfg.anchor);
    await candidates(_cfg.clubId, _cfg.teamId);
    renderList();
    place(_cfg.anchor);            // ya con la lista dentro: acá se decide el alto real
    setTimeout(function () { sr.focus(); }, 30);
  }

  window.cmCallUpPanel = {
    open: open,
    close: close,
    candidates: candidates,
    invalidate: function () { _pool = null; },
    place: place,
  };
})();
