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
      const members = membersOf(state).filter(m => m.resource === resource);
      const owner   = members[0] || me;
      const editors = members.filter(m => m.forced || m.tabId === owner.tabId);
      // La misma persona en otra pestaña no se bloquea a sí misma.
      const isOwner = forced || owner.userId === me.userId;
      const others  = editors.filter(m => m.userId !== me.userId);

      _guardState.blocked = !isOwner;
      if (opts.scope) {
        if (!isOwner && !scopeTouched.length) scopeTouched = lockScope(opts.scope);
        if (isOwner && scopeTouched.length)  { unlockScope(opts.scope, scopeTouched); scopeTouched = []; }
      }
      try { opts.onState && opts.onState({ isOwner, owner, others, forced }); } catch (e) { console.warn('[cmLock]', e); }

      const what = opts.label || tt('lock.this_page', 'this page');
      if (!isOwner) {
        paintBar(
          `${avatarHtml(owner)}<span>${esc(tt('lock.editing_by', `${owner.name} is editing ${what}`,
            { name: owner.name, what }))}</span>` +
          `<button type="button" id="cmLockTakeover" style="border:0;cursor:pointer;padding:5px 11px;border-radius:7px;` +
          `background:var(--cm-bg-soft,#eee);color:var(--cm-fg-strong,#111);font:600 12px/1 var(--cm-font-sans,system-ui)">` +
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
      wasOwner = isOwner;
      everSynced = true;
    }

    function track() {
      if (!chan || !me) return;
      me.resource = resource; me.forced = forced;
      try { chan.track(me); } catch (_) {}
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
      };
      chan = window.sb.channel(`cmlock-${opts.clubId}`, { config: { presence: { key: TAB_ID } } });
      chan.on('presence', { event: 'sync' }, () => apply(chan.presenceState()));
      chan.subscribe(status => { if (status === 'SUBSCRIBED') track(); });
    }
    connect();

    const api = {
      isOwner: () => !_guardState.blocked,
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
