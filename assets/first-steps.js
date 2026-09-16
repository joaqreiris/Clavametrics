/* Primeros pasos: qué le falta a un club recién creado para que la app le sirva.
 *
 * El motivo, con números: de los cuatro clubes creados con el asistente actual, los
 * CUATRO se quedaron sin temporada y sin un solo evento de calendario, y los cuatro
 * tienen un único usuario — nadie invitó a nadie. Dos ni siquiera llegaron a cargar un
 * jugador. El asistente termina bien; lo que faltaba era el paso siguiente.
 *
 * Por qué una lista y no un tour con globitos: los globitos se anclan a un layout
 * concreto, y acá hay cuarenta páginas HTML sueltas y tres idiomas. Un tour se rompe en
 * el primer rediseño y nadie se entera. Una lista que se calcula desde los datos no
 * miente nunca: si el club creó la temporada, el paso se tacha solo, lo haya hecho desde
 * donde lo haya hecho.
 *
 * El orden NO es caprichoso, sigue las dependencias reales del producto:
 *   jugadores → temporada → calendario → staff → check-in → sesión
 * Sin jugadores no hay nada que planificar; sin temporada (fecha de inicio y fin) no
 * tienen marco ni el calendario, ni disponibilidad, ni la carga, ni el GPS.
 */
(function () {
  'use strict';

  var LS_HIDDEN = 'cm_first_steps_hidden';

  // done(c) recibe los contadores. El corte de cada paso es "¿ya pasó algo?", salvo
  // staff: el club nace con su propio usuario, así que uno solo significa "nadie más".
  // `help` es el slug del artículo en support/ (los mismos de support/help-map.json):
  // el club no tiene que salir a buscar el manual, el paso lo trae al lado.
  var STEPS = [
    { id: 'players',  href: 'Squad.html',          icon: 'ti-users',          help: 'squad',           done: function (c) { return c.players  > 0; } },
    { id: 'season',   href: 'Annual Planner.html', icon: 'ti-calendar-stats', help: 'annual-planner',  done: function (c) { return c.seasons  > 0; } },
    { id: 'calendar', href: 'Calendar.html',       icon: 'ti-calendar-event', help: 'calendar',        done: function (c) { return c.events   > 0; } },
    { id: 'staff',    href: 'Admin.html',          icon: 'ti-mail-plus',      help: 'admin',           done: function (c) { return c.staff    > 1; } },
    { id: 'checkin',  href: 'Wellness.html',       icon: 'ti-heartbeat',      help: 'wellness',        done: function (c) { return c.checkins > 0; } },
    { id: 'session',  href: 'Planner.html',        icon: 'ti-clipboard-list', help: 'drill-designer',  done: function (c) { return c.sessions > 0; } },
  ];

  // El artículo del centro de ayuda, en el idioma activo. El inglés vive en la raíz.
  function helpUrl(slug) {
    var l = (window.CM_I18N && window.CM_I18N.current) || 'en';
    return 'support/' + (l === 'en' ? '' : l + '/') + slug + '.html';
  }

  var FALLBACK = {
    'first_steps.title':     'First steps',
    'first_steps.progress':  '{done} of {total}',
    'first_steps.hide':      'Hide',
    'first_steps.start':     'Start',
    'first_steps.how':       'How it works',
    'first_steps.reopen':    'First steps · {done}/{total}',
    'first_steps.players.t': 'Add your players',
    'first_steps.players.d': 'Import a CSV or Excel file, or add them one by one. Everything else hangs off the squad.',
    'first_steps.season.t':  'Create the season',
    'first_steps.season.d':  'Its start and end dates are the frame for the calendar, availability, load and GPS.',
    'first_steps.calendar.t':'Put the calendar to work',
    'first_steps.calendar.d':'Sessions, matches and travel — the week everyone sees.',
    'first_steps.staff.t':   'Invite your staff',
    'first_steps.staff.d':   'Coaches, physios, S&C. One person alone cannot keep this running.',
    'first_steps.checkin.t': 'Get the first check-in',
    'first_steps.checkin.d': 'Wellness and RPE come in from the players’ phones — the first data that arrives on its own.',
    'first_steps.session.t': 'Build a session',
    'first_steps.session.d': 'Drills from the library, in the planner. This is the daily use.',
  };

  function tt(key, vars) {
    var v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(key, vars) : null;
    var out = (v && v !== key) ? v : (FALLBACK[key] != null ? FALLBACK[key] : key);
    if (vars) for (var k in vars) out = out.split('{' + k + '}').join(vars[k]);
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('cm-first-steps-css')) return;
    var css = document.createElement('style');
    css.id = 'cm-first-steps-css';
    // Todo con variables del tema: el bloque tiene que verse igual en claro y oscuro sin
    // saber nada del acento que tenga puesto el club.
    css.textContent = [
      '.cm-fs{border:1px solid var(--cm-border);border-radius:14px;background:var(--cm-surface);',
      '  padding:16px 18px;margin:0 0 18px}',
      '.cm-fs-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
      '.cm-fs-title{font:600 14px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.cm-fs-count{font:500 12px/1 var(--cm-font-mono);color:var(--cm-fg-muted);',
      '  border:1px solid var(--cm-border);border-radius:99px;padding:4px 8px}',
      '.cm-fs-hide{margin-left:auto;background:none;border:0;cursor:pointer;padding:4px 6px;',
      '  font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted);border-radius:6px}',
      '.cm-fs-hide:hover{color:var(--cm-fg-strong);background:var(--cm-surface-2,transparent)}',
      '.cm-fs-list{display:flex;flex-direction:column;gap:2px}',
      '.cm-fs-item{display:flex;align-items:flex-start;gap:11px;padding:9px 10px;border-radius:10px;',
      '  text-decoration:none;color:inherit}',
      'a.cm-fs-item:hover{background:var(--cm-surface-2,rgba(127,127,127,.07))}',
      '.cm-fs-dot{flex:none;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--cm-border);',
      '  display:grid;place-items:center;margin-top:1px;font-size:12px;color:var(--cm-fg-faint)}',
      '.cm-fs-item.is-done .cm-fs-dot{background:var(--cm-success,#1a9c5b);border-color:transparent;color:#fff}',
      '.cm-fs-body{min-width:0}',
      '.cm-fs-t{display:block;font:600 13px/1.35 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.cm-fs-item.is-done .cm-fs-t{color:var(--cm-fg-muted);text-decoration:line-through}',
      '.cm-fs-d{display:block;font:var(--cm-body-sm);color:var(--cm-fg-muted);line-height:1.5;margin-top:3px}',
      '.cm-fs-item.is-done .cm-fs-d{display:none}',
      '.cm-fs-arw{margin-left:auto;flex:none;color:var(--cm-fg-faint);font-size:15px;align-self:center}',
      '.cm-fs-item.is-next{background:var(--cm-surface-2,rgba(127,127,127,.06));',
      '  border:1px solid var(--cm-border);padding:13px 14px;margin:2px 0}',
      '.cm-fs-item.is-next .cm-fs-dot{border-color:var(--cm-accent,currentColor);color:var(--cm-accent,inherit)}',
      // Los que todavía no tocan: legibles, pero claramente no son la tarea de ahora.
      '.cm-fs-item:not(.is-next):not(.is-done) .cm-fs-t{color:var(--cm-fg-muted);font-weight:500}',
      '.cm-fs-item:not(.is-next){cursor:default}',
      '.cm-fs-actions{display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap}',
      '.cm-fs-go{display:inline-flex;align-items:center;gap:6px;background:var(--cm-accent,#111);',
      '  color:var(--cm-accent-fg,#fff);border-radius:8px;padding:7px 12px;text-decoration:none;',
      '  font:600 12.5px/1 var(--cm-font-sans)}',
      '.cm-fs-go:hover{filter:brightness(1.08)}',
      '.cm-fs-help{display:inline-flex;align-items:center;gap:5px;color:var(--cm-fg-muted);',
      '  text-decoration:none;font:500 12.5px/1 var(--cm-font-sans)}',
      '.cm-fs-help:hover{color:var(--cm-fg-strong);text-decoration:underline}',
      '.cm-fs-reopen{background:none;border:1px solid var(--cm-border);border-radius:99px;cursor:pointer;',
      '  padding:6px 12px;margin:0 0 18px;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted)}',
      '.cm-fs-reopen:hover{color:var(--cm-fg-strong)}',
    ].join('');
    document.head.appendChild(css);
  }

  function hiddenKey(clubId) { return LS_HIDDEN + ':' + (clubId || 'x'); }
  function isHidden(clubId) {
    try { return localStorage.getItem(hiddenKey(clubId)) === '1'; } catch (_e) { return false; }
  }
  function setHidden(clubId, v) {
    try { v ? localStorage.setItem(hiddenKey(clubId), '1') : localStorage.removeItem(hiddenKey(clubId)); }
    catch (_e) {}
  }

  function render(host, counts, clubId) {
    var done = STEPS.filter(function (s) { return s.done(counts); });
    var total = STEPS.length;

    // Todo hecho: el bloque se va solo y se limpia la marca de oculto, para que si el
    // club abre una categoría nueva el año que viene vuelva a aparecer si hace falta.
    if (done.length === total) { host.innerHTML = ''; setHidden(clubId, false); return false; }

    injectStyles();

    // Oculto: queda una línea mínima que lo devuelve. Ocultarlo no puede ser una puerta
    // de un solo sentido — un clic distraído no debería costarle el arranque al club.
    if (isHidden(clubId)) {
      host.innerHTML = '<button type="button" class="cm-fs-reopen">' +
        esc(tt('first_steps.reopen', { done: done.length, total: total })) + '</button>';
      host.querySelector('.cm-fs-reopen').addEventListener('click', function () {
        setHidden(clubId, false); render(host, counts, clubId);
      });
      return true;
    }

    // UN SOLO siguiente paso. Enseñar seis tareas a la vez no es orientar: es la misma
    // parálisis de la pantalla en blanco, repartida en seis. Solo el primer pendiente
    // lleva explicación y botón; los de más abajo quedan como un índice de lo que viene,
    // para que se vea que hay un camino y cuánto falta, sin pedir que se elija.
    var nextId = null;
    for (var i = 0; i < STEPS.length; i++) {
      if (!STEPS[i].done(counts)) { nextId = STEPS[i].id; break; }
    }

    var items = STEPS.map(function (s) {
      var isDone = s.done(counts);
      var isNext = s.id === nextId;
      var cls = 'cm-fs-item' + (isDone ? ' is-done' : '') + (isNext ? ' is-next' : '');
      // Siempre un <div>, nunca un <a> envolviendo la tarjeta: el paso actual lleva
      // DENTRO dos enlaces (ir al sitio, y el artículo de ayuda), y un <a> dentro de otro
      // <a> es HTML inválido — el navegador desanida el de dentro y lo escupe fuera de la
      // tarjeta. Los pasos futuros no llevan enlace a propósito: que no se pueda saltar a
      // "invitar staff" antes de tener un jugador cargado.
      return '<div class="' + cls + '">' +
          '<span class="cm-fs-dot">' + (isDone ? '<i class="ti ti-check"></i>' : '<i class="ti ' + esc(s.icon) + '"></i>') + '</span>' +
          '<span class="cm-fs-body">' +
            '<span class="cm-fs-t">' + esc(tt('first_steps.' + s.id + '.t')) + '</span>' +
            (isNext
              ? '<span class="cm-fs-d">' + esc(tt('first_steps.' + s.id + '.d')) + '</span>' +
                '<span class="cm-fs-actions">' +
                  '<a class="cm-fs-go" href="' + esc(s.href) + '">' + esc(tt('first_steps.start')) +
                    '<i class="ti ti-arrow-right" style="font-size:14px"></i></a>' +
                  '<a class="cm-fs-help" href="' + esc(helpUrl(s.help)) + '" target="_blank" rel="noopener">' +
                    '<i class="ti ti-help-circle" style="font-size:13px"></i>' + esc(tt('first_steps.how')) + '</a>' +
                '</span>'
              : '') +
          '</span>' +
        '</div>';
    }).join('');

    host.innerHTML =
      '<section class="cm-fs">' +
        '<div class="cm-fs-head">' +
          '<span class="cm-fs-title">' + esc(tt('first_steps.title')) + '</span>' +
          '<span class="cm-fs-count">' + esc(tt('first_steps.progress', { done: done.length, total: total })) + '</span>' +
          '<button type="button" class="cm-fs-hide">' + esc(tt('first_steps.hide')) + '</button>' +
        '</div>' +
        '<div class="cm-fs-list">' + items + '</div>' +
      '</section>';

    host.querySelector('.cm-fs-hide').addEventListener('click', function () {
      setHidden(clubId, true); render(host, counts, clubId);
    });
    return true;
  }

  /* Pinta el bloque en `host`. Devuelve true si quedó algo visible — el Hub lo usa para
     no decirle "All clear · no alerts today" a un club que todavía no cargó nada.
     Ante cualquier fallo devuelve false y no pinta: esto acompaña, no puede estorbar. */
  async function mount(host, clubId) {
    if (!host || !window.sb) return false;
    try {
      var res = await window.sb.rpc('club_first_steps');
      if (res.error) throw res.error;
      // Sin filas: no es admin/owner, o no hay club. No le corresponde esta lista.
      var c = (res.data && res.data[0]) || null;
      if (!c) { host.innerHTML = ''; return false; }
      return render(host, c, clubId);
    } catch (err) {
      console.error('[first-steps]', err);
      host.innerHTML = '';
      return false;
    }
  }

  window.CM_FIRST_STEPS = { mount: mount, STEPS: STEPS };
})();
