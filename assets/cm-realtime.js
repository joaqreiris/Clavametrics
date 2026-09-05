/* ────────────────────────────────────────────────────────────────────────────
   cm-realtime.js — Refresco en vivo entre pestañas y usuarios (Nivel 1)

   Qué resuelve: si alguien del cuerpo técnico cambia algo (una sesión, un
   ejercicio, la disponibilidad), la pantalla de los demás se actualiza sola,
   sin recargar. NO es edición colaborativa: dos personas escribiendo el mismo
   campo a la vez siguen pisándose — eso es el Nivel 2.

   Uso:
     const live = window.cmLive.watch({
       name: 'calendar',
       tables: [
         { table: 'training_sessions', filter: `club_id=eq.${clubId}` },
         { table: 'calendar_events',   filter: `club_id=eq.${clubId}` },
       ],
       relevant: row => row.team_id === _activeTeamId,   // opcional
       busy: () => !!document.querySelector('.modal.is-open'), // opcional
       onRefresh: async () => { await loadSessions(); },
     });
     live.stop();   // al desmontar (se hace solo en beforeunload)

   Opción `manual: true` para las pantallas cuya carga vive inline dentro del
   boot (Squad, Physio, Rehab & Preventives): ahí no hay función que recargar,
   así que nunca se refrescan solas — solo muestran el chip y, si el usuario
   hace clic, `onRefresh` recarga la página.

   Reglas de convivencia con el usuario:
   · Si el cambio lo hizo esta misma pestaña (eco), no se refresca al toque —
     se espera a que amaine la ráfaga de guardados.
   · Si el usuario está editando (busy), no se le pisa la pantalla: aparece un
     chip «Hay cambios nuevos · Actualizar» y se refresca cuando suelta.
   · Con la pestaña en segundo plano no se refresca; se hace al volver. Y si
     lleva más de HIDDEN_MS oculta, además se SUELTA el canal: cada suscripción
     viva obliga a Realtime a sondear la base cada 100 ms y a evaluar las RLS
     aunque nadie esté mirando. Al volver se reconecta y se refresca una vez.
   · Al reconectar (caída de red / socket) se refresca una vez para recuperar
     lo que se perdió mientras no había canal.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  if (window.cmLive) return;

  const tt = (k, fb, vars) => {
    const v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(k, vars) : null;
    return (v && v !== k) ? v : (fb != null ? fb : k);
  };

  const ECHO_MS   = 4000;  // ventana en la que un cambio se asume propio
  const QUIET_MS  = 600;   // coalescing de ráfagas ajenas
  const RETRY_MS  = 1500;  // reintento mientras el usuario está ocupado
  const HIDDEN_MS = 60000; // pestaña oculta antes de soltar el canal

  // ── Detección de escrituras propias ───────────────────────────────────────
  // supabase-js habla por fetch: cualquier POST/PATCH/DELETE a /rest/v1/<tabla>
  // es un cambio hecho por ESTA pestaña. Así no hay que instrumentar cada save.
  const _lastWrite = Object.create(null);
  const _origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url    = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && url.indexOf('/rest/v1/') !== -1) {
        const m = url.match(/\/rest\/v1\/([A-Za-z0-9_]+)/);
        if (m) _lastWrite[m[1]] = Date.now();
      }
    } catch (_) { /* nunca romper un fetch por instrumentar */ }
    return _origFetch.apply(this, arguments);
  };
  const wroteRecently = table => (Date.now() - (_lastWrite[table] || 0)) < ECHO_MS;

  // ── Chip «hay cambios nuevos» ─────────────────────────────────────────────
  let _chipEl = null, _chipOwner = null;
  function chipShow(owner) {
    _chipOwner = owner;
    if (!_chipEl) {
      _chipEl = document.createElement('div');
      _chipEl.id = 'cmLiveChip';
      _chipEl.setAttribute('style',
        'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;' +
        'display:none;align-items:center;gap:10px;padding:8px 10px 8px 14px;' +
        'background:var(--cm-surface,#fff);color:var(--cm-fg,#111);' +
        'border:1px solid var(--cm-border,#e2e2e2);border-radius:999px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.16);font-size:13px;font-weight:500');
      document.body.appendChild(_chipEl);
    }
    _chipEl.innerHTML =
      `<span>${tt('live.updates_available', 'New changes')}</span>` +
      `<button type="button" id="cmLiveChipBtn" style="border:0;cursor:pointer;padding:5px 12px;border-radius:999px;` +
      `background:var(--cm-accent,#0a7d3f);color:#fff;font:inherit;font-weight:600">` +
      `${tt('live.refresh', 'Refresh')}</button>`;
    _chipEl.style.display = 'flex';
    _chipEl.querySelector('#cmLiveChipBtn').onclick = () => { if (_chipOwner) _chipOwner.refreshNow(); };
  }
  function chipHide(owner) {
    if (_chipEl && (!owner || _chipOwner === owner)) { _chipEl.style.display = 'none'; _chipOwner = null; }
  }

  // ── Heurística por defecto de «el usuario está trabajando ahora» ──────────
  function defaultBusy() {
    if (document.body && document.body.classList.contains('is-dragging')) return true;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return true;
    // Modal abierto: la app los nombra de varias formas (#calEvtBackdrop, #modalPhase,
    // .cm-modal…), así que se buscan por patrón en id y en clase.
    if (document.querySelector('dialog[open], .is-open[id*="odal"], .is-open[id*="ackdrop"], [class*="modal"].is-open, [class*="Modal"].is-open')) return true;
    return false;
  }

  const _watchers = new Set();
  let _seq = 0;

  function watch(opts) {
    const id      = (opts.name || 'live') + '-' + (++_seq);
    const busy    = typeof opts.busy === 'function' ? opts.busy : () => false;
    const relevant= typeof opts.relevant === 'function' ? opts.relevant : null;
    let chan = null, timer = null, pending = false, stopped = false, sawError = false, running = false;
    let asleep = false, sleepTimer = null;

    function schedule(delay) {
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    }

    async function run() {
      if (stopped || !pending || running) return;
      if (document.hidden) return;                 // se retoma al volver a la pestaña
      // Ráfaga de guardados propios en curso: esperar a que termine. El refresh
      // igual se hace después — así un cambio ajeno simultáneo no se pierde.
      if (opts.tables.some(t => wroteRecently(t.table))) { schedule(RETRY_MS); return; }
      // Pantallas cuya carga vive inline en el boot (onRefresh = recargar la
      // página): nunca se refrescan solas, solo avisan y esperan el clic.
      if (opts.manual) { chipShow(api); return; }
      if (busy() || defaultBusy()) { chipShow(api); schedule(RETRY_MS); return; }
      pending = false; running = true;
      chipHide(api);
      try { await opts.onRefresh(); }
      catch (e) { console.warn('[cmLive]', id, e); }
      finally { running = false; }
    }

    function onEvent(payload) {
      if (stopped) return;
      if (relevant) {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        // Un DELETE sin REPLICA IDENTITY FULL solo trae el id: no se puede
        // filtrar, así que se deja pasar y decide el refetch.
        try { if (row && Object.keys(row).length > 1 && !relevant(row, payload)) return; } catch (_) {}
      }
      const echo = wroteRecently(payload.table);
      // En modo manual el eco se descarta del todo: la pantalla ya muestra lo
      // que acaba de guardar, avisarle «hay cambios» sería mentirle.
      if (echo && opts.manual) return;
      schedule(echo ? ECHO_MS : QUIET_MS);
    }

    function connect() {
      if (chan || stopped) return;
      chan = window.sb.channel('cmlive-' + id);
      opts.tables.forEach(t => {
        chan.on('postgres_changes',
          { event: t.event || '*', schema: 'public', table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
          onEvent);
      });
      chan.subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { sawError = true; return; }
        if (status === 'SUBSCRIBED' && sawError) { sawError = false; schedule(QUIET_MS); }  // recuperar lo perdido
      });
    }

    function disconnect() {
      if (!chan) return;
      try { window.sb.removeChannel(chan); } catch (_) {}
      chan = null;
    }

    connect();

    const api = {
      id,
      refreshNow() { pending = true; clearTimeout(timer); chipHide(api); Promise.resolve().then(async () => {
        if (running) return; running = true; pending = false;
        try { await opts.onRefresh(); } catch (e) { console.warn('[cmLive]', id, e); } finally { running = false; }
      }); },
      wake() { if (pending) schedule(QUIET_MS); },
      // La pestaña se fue a segundo plano: se le da un margen antes de soltar
      // el canal, para no reconectar por un alt-tab de dos segundos.
      armSleep() {
        if (stopped || asleep) return;
        clearTimeout(sleepTimer);
        sleepTimer = setTimeout(() => {
          if (stopped || asleep || !document.hidden) return;
          asleep = true; disconnect();
        }, HIDDEN_MS);
      },
      // Vuelve el usuario: se rehace el canal y se refresca una vez, porque
      // mientras dormía no llegó ningún evento.
      resume() {
        clearTimeout(sleepTimer);
        if (stopped || !asleep) return;
        asleep = false; connect(); schedule(QUIET_MS);
      },
      stop() {
        stopped = true; clearTimeout(timer); clearTimeout(sleepTimer); chipHide(api);
        _watchers.delete(api);
        disconnect();
      },
    };
    _watchers.add(api);
    return api;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { _watchers.forEach(w => w.armSleep()); return; }
    _watchers.forEach(w => { w.resume(); w.wake(); });
  });
  window.addEventListener('online', () => _watchers.forEach(w => w.wake()));
  window.addEventListener('beforeunload', () => _watchers.forEach(w => w.stop()));

  window.cmLive = { watch, defaultBusy, wroteRecently };
})();
