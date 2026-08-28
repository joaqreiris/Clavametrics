/* ────────────────────────────────────────────────────────────────────────────
   cm-lock.js — Candado suave por presencia (Nivel 2, paso 1)

   Qué resuelve: hoy dos personas pueden abrir la misma sesión y guardar encima
   del otro sin enterarse — el que guarda último pisa la fila entera. Esto no lo
   impide a nivel base de datos: avisa antes de que pase. El primero que entra
   edita; el que llega después ve «Martín está editando esta sesión», queda en
   modo lectura y, si igual necesita tocarla, hay un botón para forzar.

   Es un candado SOCIAL, no de seguridad: nada obliga a respetarlo desde el
   servidor. Alcanza porque el problema real no es la mala fe, es no enterarse.

   Uso:
     const lock = window.cmLock.claim({
       resource: `dp:${teamId}:${date}`,   // qué se está editando
       clubId,
       label: 'esta sesión',               // para el texto del cartel
       scope: '.gp-card-b',                // opcional: qué apagar en modo lectura
       guard: {                            // opcional: funciones globales a frenar
         silent: ['gpAutoSave'],           //   automáticas → sin ruido
         toast:  ['gpPublish'],            //   interactivas → avisan
       },
       onState: ({ isOwner, owner }) => {  // opcional: bloqueo propio de la página
         window._dpReadOnly = !isOwner;
       },
     });
     lock.setResource(`dp:${teamId}:${otroDia}`);  // al cambiar de día, sin recargar
     lock.release();

   La presencia es efímera: vive en el canal de Realtime, no en la base. Al
   cerrar la pestaña el candado se suelta solo y pasa al siguiente que esté
   mirando, que se entera en el momento.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  if (window.cmLock) return;

  const tt = (k, fb, vars) => {
    const v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(k, vars) : null;
    return (v && v !== k) ? v : (fb != null ? fb : k);
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Identifica a ESTA pestaña: la misma persona con dos pestañas abiertas no se
  // bloquea a sí misma (se compara por userId), pero el orden de llegada sí
  // necesita distinguirlas.
  const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

  // Un color estable por persona, para reconocerla de un vistazo sin leer el
  // nombre (mismo criterio que los avatares de presencia del sidebar).
  function colorDe(userId) {
    let h = 0;
    String(userId || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 360; });
    return `hsl(${h} 70% 45%)`;
  }

  // ── Campos ocupados ───────────────────────────────────────────────────────
  // Marca en vivo el campo que el otro tiene abierto, como la celda seleccionada
  // en una planilla compartida: un borde de su color y su nombre encima. No se
  // toca el input — todo se dibuja en un overlay aparte, así no hay forma de
  // ensuciar el formulario ni de robarle el foco a nadie.
  const _marcas = new Map();   // fieldId → { caja, meta }
  let _reposProgramado = false;

  function reposicionar() {
    _reposProgramado = false;
    _marcas.forEach(({ caja }, id) => {
      const campo = document.getElementById(id);
      if (!campo) { caja.style.display = 'none'; return; }
      const r = campo.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) { caja.style.display = 'none'; return; }
      caja.style.display = '';
      caja.style.top    = (r.top - 2) + 'px';
      caja.style.left   = (r.left - 2) + 'px';
      caja.style.width  = (r.width + 4) + 'px';
      caja.style.height = (r.height + 4) + 'px';
    });
  }
  function pedirRepos() {
    if (_reposProgramado || !_marcas.size) return;
    _reposProgramado = true;
    requestAnimationFrame(reposicionar);
  }
  addEventListener('scroll', pedirRepos, true);
  addEventListener('resize', pedirRepos);
  // Red de seguridad para layouts que se mueven sin scroll ni resize (paneles
  // que se abren, filas que se agregan).
  setInterval(pedirRepos, 700);

  function marcarCampos(ocupados) {
    // ocupados: [{ field, name, userId }]
    const vivos = new Set();
    ocupados.forEach(o => {
      if (!o.field || !document.getElementById(o.field)) return;
      vivos.add(o.field);
      let m = _marcas.get(o.field);
      const color = colorDe(o.userId);
      if (!m) {
        const caja = document.createElement('div');
        caja.setAttribute('style',
          'position:fixed;z-index:9997;pointer-events:none;border-radius:7px;box-sizing:border-box');
        caja.innerHTML = '<span style="position:absolute;top:-9px;left:6px;padding:1px 6px;border-radius:4px;' +
          'color:#fff;font:600 10px/1.5 var(--cm-font-sans,system-ui);white-space:nowrap"></span>';
        document.body.appendChild(caja);
        m = { caja };
        _marcas.set(o.field, m);
      }
      m.caja.style.border = `2px solid ${color}`;
      const et = m.caja.firstElementChild;
      et.style.background = color;
      et.textContent = String(o.name || '').split(' ')[0];   // solo el nombre de pila: la etiqueta es chica
    });
    _marcas.forEach((m, id) => { if (!vivos.has(id)) { m.caja.remove(); _marcas.delete(id); } });
    reposicionar();
  }

  // ── Cartel ────────────────────────────────────────────────────────────────
  let _barEl = null;
  function bar() {
    if (_barEl) return _barEl;
    _barEl = document.createElement('div');
    _barEl.id = 'cmLockBar';
    _barEl.setAttribute('style',
      'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9998;' +
      'display:none;align-items:center;gap:10px;padding:8px 12px;max-width:min(92vw,560px);' +
      'border-radius:10px;border:1px solid var(--cm-border,#e2e2e2);' +
      'background:var(--cm-surface,#fff);color:var(--cm-fg,#111);' +
      'box-shadow:0 8px 24px rgba(0,0,0,.16);font:500 13px/1.35 var(--cm-font-sans,system-ui)');
    document.body.appendChild(_barEl);
    return _barEl;
  }
  function paintBar(html, tone) {
    const el = bar();
    const border = tone === 'warn' ? 'var(--cm-warning,#c2870a)'
                 : tone === 'ok'   ? 'var(--cm-success,#0a7d3f)'
                 : 'var(--cm-border,#e2e2e2)';
    el.style.borderColor = border;
    el.innerHTML = html;
    el.style.display = 'flex';
  }
  const hideBar = () => { if (_barEl) _barEl.style.display = 'none'; };

  const avatarHtml = p => p.avatar
    ? `<img src="${esc(p.avatar)}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex:0 0 auto">`
    : `<span style="width:24px;height:24px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;` +
      `background:var(--cm-bg-soft,#eee);font:600 10px/1 var(--cm-font-sans,system-ui)">` +
      `${esc((p.name || '?').trim().charAt(0).toUpperCase())}</span>`;

  // ── Modo lectura genérico ─────────────────────────────────────────────────
  // Apaga el contenedor editable y deshabilita sus campos. Solo se revierte lo
  // que apagó este helper: un input que ya venía deshabilitado sigue así.
  function lockScope(sel) {
    if (!sel) return [];
    const touched = [];
    document.querySelectorAll(sel).forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '.55';
      el.style.userSelect = 'none';
      el.querySelectorAll('input,select,textarea,button,[contenteditable="true"]').forEach(f => {
        if (f.isContentEditable) { f.setAttribute('contenteditable', 'false'); touched.push({ f, ce: true }); return; }
        if (!f.disabled) { f.disabled = true; touched.push({ f }); }
      });
    });
    return touched;
  }
  function unlockScope(sel, touched) {
    if (!sel) return;
    document.querySelectorAll(sel).forEach(el => {
      el.style.pointerEvents = '';
      el.style.opacity = '';
      el.style.userSelect = '';
    });
    (touched || []).forEach(({ f, ce }) => { if (ce) f.setAttribute('contenteditable', 'true'); else f.disabled = false; });
  }

  // ── Guard sobre funciones globales ────────────────────────────────────────
  // Red de seguridad para lo que no pasa por el DOM (autosaves con timer ya
  // lanzados, atajos de teclado). El flag lo mueve el candado.
  const _guardState = { blocked: false };
  function installGuards(names, silent) {
    (names || []).forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__cmLockWrapped) return;
      const wrapped = function () {
        if (_guardState.blocked) {
          if (!silent) toast(tt('lock.view_only_toast', 'View only — someone else is editing this.'));
          return;
        }
        return orig.apply(this, arguments);
      };
      wrapped.__cmLockWrapped = true;
      window[name] = wrapped;
    });
  }
  let _toastEl = null;
  function toast(msg) {
    if (!_toastEl) {
      _toastEl = document.createElement('div');
      _toastEl.setAttribute('style',
        'position:fixed;bottom:78px;left:50%;transform:translateX(-50%);z-index:9999;display:none;' +
        'padding:9px 14px;border-radius:8px;background:var(--cm-fg-strong,#111);color:#fff;' +
        'font:500 13px/1 var(--cm-font-sans,system-ui);box-shadow:0 6px 18px rgba(0,0,0,.2)');
      document.body.appendChild(_toastEl);
    }
    _toastEl.textContent = msg;
    _toastEl.style.display = 'block';
    clearTimeout(_toastEl._t);
    _toastEl._t = setTimeout(() => { _toastEl.style.display = 'none'; }, 2600);
  }

  // ── Candado ───────────────────────────────────────────────────────────────
  function claim(opts) {
    let chan = null, resource = opts.resource, forced = false, released = false;
    let me = null, scopeTouched = [], wasOwner = true, everSynced = false;

    installGuards(opts.guard && opts.guard.silent, true);
    installGuards(opts.guard && opts.guard.toast, false);

    function membersOf(state) {
      const list = [];
      Object.values(state || {}).forEach(metas => (metas || []).forEach(m => { if (m && m.tabId) list.push(m); }));
      // Orden de llegada: gana el que entró primero; empate técnico por tabId
      // para que todas las pestañas coincidan en quién manda.
      return list.sort((a, b) => (a.since - b.since) || String(a.tabId).localeCompare(String(b.tabId)));
    }

    function apply(state) {
      if (released || !me) return;
      // Sin recurso no se compite por nada (un borrador que todavía no existe en
      // la base): ni cartel ni bloqueo.
      if (!resource) { _guardState.blocked = false; hideBar(); return; }
      const members = membersOf(state).filter(m => m.resource === resource);
      const owner   = members[0] || me;
      const editors = members.filter(m => m.forced || m.tabId === owner.tabId);
      // La misma persona en otra pestaña no se bloquea a sí misma.
      const isOwner = forced || owner.userId === me.userId;
      const others  = editors.filter(m => m.userId !== me.userId);

      // Estamos por perder la edición. El sync puede llegar segundos después de
      // abrir la pantalla, con el usuario ya escribiendo: si se bloquea sin más,
      // el autosave en vuelo queda frenado y ESO SÍ pierde lo tipeado. Se
      // persiste lo pendiente ANTES de cerrar la puerta.
      if (!isOwner && !_guardState.blocked && opts.onLosing) {
        try { opts.onLosing(); } catch (e) { console.warn('[cmLock] flush', e); }
      }
      // warnOnly: pantallas que guardan con un botón explícito (Planner). Ahí
      // bloquear es peor que el problema — te deja con un dibujo a medio hacer
      // que no podés guardar. Se avisa y la decisión de pisar es consciente.
      _guardState.blocked = !isOwner && !opts.warnOnly;
      if (opts.scope && !opts.warnOnly) {
        if (!isOwner && !scopeTouched.length) scopeTouched = lockScope(opts.scope);
        if (isOwner && scopeTouched.length)  { unlockScope(opts.scope, scopeTouched); scopeTouched = []; }
      }
      try { opts.onState && opts.onState({ isOwner, owner, others, forced }); } catch (e) { console.warn('[cmLock]', e); }

      const what = opts.label || tt('lock.this_page', 'this page');
      if (!isOwner && opts.warnOnly) {
        paintBar(`${avatarHtml(owner)}<span>${esc(tt('lock.editing_by',
          `${owner.name} is editing ${what}`, { name: owner.name, what }))}` +
          `<br><span style="color:var(--cm-fg-muted,#666);font-weight:400">` +
          `${esc(tt('lock.warn_only_hint', 'You can keep working — saving will ask before overwriting'))}</span></span>`, 'warn');
      } else if (!isOwner) {
        // El aviso dice explícitamente que los controles se esconden: sin eso, la
        // pantalla sin botones se lee como «desapareció el planning».
        paintBar(
          `${avatarHtml(owner)}<span>${esc(tt('lock.editing_by', `${owner.name} is editing ${what}`,
            { name: owner.name, what }))}` +
          `<br><span style="color:var(--cm-fg-muted,#666);font-weight:400">` +
          `${esc(tt('lock.view_only_hint', 'View only — nothing was lost, the editing controls are just hidden'))}</span></span>` +
          `<button type="button" id="cmLockTakeover" style="border:0;cursor:pointer;padding:5px 11px;border-radius:7px;` +
          `background:var(--cm-bg-soft,#eee);color:var(--cm-fg-strong,#111);font:600 12px/1 var(--cm-font-sans,system-ui);flex:0 0 auto">` +
          `${esc(tt('lock.edit_anyway', 'Edit anyway'))}</button>`);
        const btn = document.getElementById('cmLockTakeover');
        if (btn) btn.onclick = () => { forced = true; track(); };
      } else if (others.length) {
        // Alguien forzó: los dos escriben. No hay bloqueo, sí advertencia.
        paintBar(`${avatarHtml(others[0])}<span>${esc(tt('lock.both_editing',
          `${others[0].name} is also editing — careful not to overwrite each other`,
          { name: others[0].name }))}</span>`, 'warn');
      } else if (everSynced && !wasOwner) {
        // Se fue el que tenía el candado: avisar que ya se puede editar.
        paintBar(`<span>${esc(tt('lock.now_yours', `You can edit ${what} now`, { what }))}</span>`, 'ok');
        setTimeout(hideBar, 4000);
      } else {
        hideBar();
      }
      // Campos que los demás tienen abiertos ahora mismo (todos los presentes en
      // este recurso, no solo los editores: al que mira en modo lectura también
      // le sirve ver dónde está metido el que edita).
      if (opts.fields) {
        marcarCampos(members.filter(m => m.userId !== me.userId && m.field));
      }
      _owner = owner;
      wasOwner = isOwner;
      everSynced = true;
    }

    function track() {
      if (!chan || !me) return;
      me.resource = resource; me.forced = forced;
      try { chan.track(me); } catch (_) {}
    }

    // Anuncia en qué campo está parado el usuario. Se manda al enfocar y al
    // salir; el salto entre dos campos no manda un "salí" intermedio (se espera
    // un instante), o la marca del otro parpadearía en cada tabulación.
    let _blurTimer = null;
    function seguirFoco() {
      const anunciar = id => {
        if (me.field === id) return;
        me.field = id;
        track();
      };
      document.addEventListener('focusin', e => {
        const el = e.target;
        if (!el || !el.id || !el.matches || !el.matches(opts.fields)) return;
        clearTimeout(_blurTimer);
        anunciar(el.id);
      });
      document.addEventListener('focusout', () => {
        clearTimeout(_blurTimer);
        _blurTimer = setTimeout(() => anunciar(null), 250);
      });
      // Al irse de la pestaña, soltar la marca: si no, queda un campo "ocupado"
      // por alguien que se fue a otra ventana.
      document.addEventListener('visibilitychange', () => { if (document.hidden) anunciar(null); });
    }

    async function connect() {
      const { data: { user } = {} } = await window.sb.auth.getUser();
      if (!user) return;
      let profile = null;
      try { profile = await window.getProfile(); } catch (_) {}
      me = {
        tabId:  TAB_ID,
        userId: user.id,
        name:   (window.cmDisplayName ? window.cmDisplayName(profile) : (profile && profile.full_name)) || tt('lock.someone', 'Someone'),
        avatar: (window.cmAvatarUrl ? window.cmAvatarUrl(profile) : null) || null,
        since:  Date.now(),
        resource,
        forced: false,
        field:  null,
      };
      if (opts.fields) seguirFoco();
      chan = window.sb.channel(`cmlock-${opts.clubId}`, { config: { presence: { key: TAB_ID } } });
      chan.on('presence', { event: 'sync' }, () => apply(chan.presenceState()));
      chan.subscribe(status => { if (status === 'SUBSCRIBED') track(); });
    }
    connect();

    let _owner = null;
    const api = {
      isOwner: () => !_guardState.blocked,
      // Quién está editando esto, o null si soy yo (o no hay nadie más).
      otherEditor: () => (_owner && me && _owner.userId !== me.userId) ? _owner : null,
      // Cambiar de día/sesión sin recargar: se anuncia el nuevo recurso y el
      // candado del anterior queda libre para el que estaba esperando.
      setResource(next) {
        if (released || next === resource) return;
        resource = next; forced = false; wasOwner = true; everSynced = false;
        hideBar();
        track();
        if (chan) apply(chan.presenceState());
      },
      // Tras repintar la pantalla (recarga del día, refresco en vivo) los campos
      // nuevos nacen habilitados: hay que volver a apagarlos.
      reapply() {
        if (released || !opts.scope || !_guardState.blocked) return;
        unlockScope(opts.scope, scopeTouched);
        scopeTouched = lockScope(opts.scope);
      },
      release() {
        released = true;
        marcarCampos([]);
        _guardState.blocked = false;
        if (opts.scope && scopeTouched.length) { unlockScope(opts.scope, scopeTouched); scopeTouched = []; }
        hideBar();
        try { chan && chan.untrack(); window.sb.removeChannel(chan); } catch (_) {}
      },
    };
    window.addEventListener('pagehide', () => api.release());
    return api;
  }

  window.cmLock = { claim, TAB_ID };
})();
