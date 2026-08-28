/* ─────────────────────────────────────────────────────────────────────────
   gps-analysis-cards.js — render diferido de tarjetas y títulos de la página GPS Analysis.

   Estaba escrito dentro de GPS Analysis.html: entre los cuatro archivos eran
   418 KB de los 545 KB de la página, y viajaban enteros en cada visita porque
   el HTML no se cachea nunca.

   Va con defer. Comprobado antes de mover nada:
     · No queda NINGÚN elemento del DOM por debajo de donde estaban escritos
       (todo el markup termina en la línea 1443), así que los selectores ven
       exactamente lo mismo.
     · Los 9 scripts sueltos que quedan por debajo (gps-import-wizard,
       gps-player-week, gps-mc-compare, …) no usan al cargarse ninguna de las
       984 variables globales que definen estos bloques.
     · El orden entre los cuatro archivos se conserva: defer respeta el orden
       del documento, y no había scripts intercalados dentro de cada grupo.
   ──────────────────────────────────────────────────────────────────────── */
/* P3g — Lazy-render de chart cards (config-driven / builder).
   Envuelve UNA sola vez window.GpBuilder.resolveAndRenderCard para que una card sólo
   resuelva (fetch + aggregate + Chart.js) cuando entra —o está por entrar— al viewport.
   Cards arriba del fold se dibujan enseguida (el observer dispara al observar); las de
   más abajo o de otras vistas se difieren hasta el scroll / cambio de vista. Reduce el
   trabajo inicial en dashboards largos sin cambiar datos ni comportamiento: mismo
   entrypoint, los call sites son fire-and-forget, y el cache compartido evita N+1 cuando
   varias cards resuelven el mismo rango.
   Kill switch: setear window.__gpLazyRender = false para volver al render inmediato. */
(function () {
  if (window.__gpLazyRenderInstalled) return;
  window.__gpLazyRenderInstalled = true;
  var PREFETCH_MARGIN = '800px';   // pre-render antes de que la card entre al viewport

  function wrap() {
    var GB = window.GpBuilder;
    if (!GB || typeof GB.resolveAndRenderCard !== 'function') return false;
    if (GB.__lazyWrapped) return true;
    GB.__lazyWrapped = true;
    // Sin soporte de IO o kill switch → dejar el render inmediato original.
    if (window.__gpLazyRender === false || typeof IntersectionObserver === 'undefined') return true;

    var orig = GB.resolveAndRenderCard.bind(GB);
    GB.resolveAndRenderCard = function (el, config) {
      if (!el || !(el instanceof Element)) return orig(el, config);
      // Re-render (edición, cambio de filtro): limpiar observer previo y re-observar con la
      // nueva config. Si la card ya está visible, el observer dispara casi inmediato.
      if (el.__lazyObs) { try { el.__lazyObs.disconnect(); } catch (e) {} el.__lazyObs = null; }
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            if (el.__lazyObs) { try { el.__lazyObs.disconnect(); } catch (e) {} el.__lazyObs = null; }
            orig(el, config);
            return;
          }
        }
      }, { root: null, rootMargin: '0px 0px ' + PREFETCH_MARGIN + ' 0px', threshold: 0 });
      el.__lazyObs = io;
      io.observe(el);
      return undefined;   // fire-and-forget: ningún call site hace await del resultado
    };
    return true;
  }

  // gp-builder.js carga con defer → puede no existir aún. Reintentar hasta que aparezca.
  if (!wrap()) {
    var tries = 0;
    var iv = setInterval(function () { if (wrap() || ++tries > 150) clearInterval(iv); }, 100);
  }
})();

function getSecTitles() {
    return {
      ind:  ['· ' + tt('gps_analysis.sec_ind_title','Player Week Report'),   '— ' + tt('gps_analysis.sec_ind_sub','week vs match reference')],
      grp:  ['· ' + tt('gps_analysis.sec_grp_title','Session Control'),      '— ' + tt('gps_analysis.sec_grp_sub','daily training review · squad-wide')],
      mind: ['· ' + tt('gps_analysis.sec_mind_title','Match Performance'),   '— ' + tt('gps_analysis.sec_mind_sub','player season analysis')],
      mgrp: ['· ' + tt('gps_analysis.sec_mgrp_title','Load Monitoring'),     '— ACWR · ' + tt('gps_analysis.sec_mgrp_sub','acute:chronic workload ratio')],
      mc:   ['· ' + tt('gps_analysis.sec_mc_title','Microcycle Compare'),    '— ' + tt('gps_analysis.sec_mc_sub','MD code comparison vs previous MCs')],
    };
  }
  function _applySecLabels(v) {
    const titles = getSecTitles();
    const secTitleEl = document.getElementById('secTitle');
    if (secTitleEl) secTitleEl.textContent = titles[v]?.[0] || '';
    const subEl = document.getElementById('secSub');
    if (subEl && titles[v]?.[1]) subEl.textContent = titles[v][1];
  }
  // Re-paint section title/sub on language change (uses current view).
  window.addEventListener('cm:langchanged', () => {
    _applySecLabels(window.gpState?.view || 'ind');
  });
  document.getElementById('sections').addEventListener('click', (e) => {
    const b = e.target.closest('.gp-sec'); if (!b) return;
    document.querySelectorAll('#sections .gp-sec').forEach(o => o.classList.remove('is-on'));
    b.classList.add('is-on');
    const v = b.dataset.view;
    document.querySelectorAll('.gp-view').forEach(x => x.classList.toggle('is-on', x.dataset.view === v));
    document.querySelector('.gp-dash-bar').dataset.view = v;
    window.gpState.view = v;
    _applySecLabels(v);
    // Re-render with cached data when switching sections (avoids re-fetch overhead)
    if (window._gpReports?.length) {
      _updateSquadRanking(window._gpReports);
      _renderScatter(window._gpReports);
    } else {
      window.renderView?.();
    }
  });
  // The dashboard is ALWAYS editable by direct interaction: click opens card
  // content (dropdowns, pencil), click+drag (>5px) moves it, hover handles resize.
  // No edit mode, no lock. Moves/resizes autosave on drop; Save layout is a backup.
  document.getElementById('saveLayoutBtn')?.addEventListener('click', async () => {
    const view = document.querySelector('.gp-view.is-on')?.dataset.view;
    if (!view) return;
    await saveLayout(view).catch(e => console.warn('saveLayoutBtn:', e));
    showToast('Layout saved');
  });
  // Assign rivals now lives in the ⚙ Settings menu (act:'rivals' → _gpOpenAssignRivals).
  // Card size is changed by dragging the corner handle (gp-resize.js);
  // the S/M/L/FULL toggle is gone. Make sure every card has its handle + span.
  window.gpInitResize?.(document);
  const srcDrawer = document.getElementById('srcDrawer');
  const srcOverlay = document.getElementById('srcOverlay');
  const srcBtn = document.getElementById('srcBtn');
  const openSrc = () => { srcDrawer.classList.add('is-open'); srcOverlay.classList.add('is-open'); srcBtn.classList.add('is-open'); window._gpSyncLoad?.(); };
  const closeSrc = () => { srcDrawer.classList.remove('is-open'); srcOverlay.classList.remove('is-open'); srcBtn.classList.remove('is-open'); };
  srcBtn.addEventListener('click', openSrc);
  document.getElementById('srcClose').addEventListener('click', closeSrc);
  srcOverlay.addEventListener('click', closeSrc);

// ── Provider integrations panel (SHARED module) — full config in GPS Analysis ─────────
// El panel completo (conectar/verificar/región/mapear métricas/mapear atletas/sync) vive en
// assets/gps-integrations.js (compartido con Admin) y se monta acá en el drawer Data sources.
// canConfig (región/verificar/mapear/sync) = admin + S&C (cmCanImportGps).
// canConnect (token connect/disconnect) = admin/owner solamente.
(function () {
  const host = document.getElementById('gpSyncHost');
  if (!host) return;
  let _mounted = false, _mounting = null;
  async function load() {
    if (_mounted) return;
    if (_mounting) return _mounting;
    if (!window.cmMountGpsIntegrations) return;   // módulo aún no cargó → reintenta al próximo open
    _mounting = (async () => {
      const prof = await window.getProfile?.();
      const buckets = window.cmRoleBuckets ? window.cmRoleBuckets(prof) : new Set();
      const canConfig  = window.cmCanImportGps ? window.cmCanImportGps(prof) : buckets.has('admin');
      const canConnect = buckets.has('admin');   // token/credencial: solo admin/owner
      if (!canConfig) {
        host.innerHTML = `<div class="gp-conn" style="cursor:default"><div class="info"><h5>Catapult</h5><div class="desc">${tt('gps_analysis.sync_admin_managed', 'Provider sync is managed by your admin.')}</div></div></div>`;
        _mounted = true; return;
      }
      host.innerHTML = '';   // saca la card fallback "Coming soon"
      window.cmMountGpsIntegrations(host, { canConfig, canConnect });
      _mounted = true;
    })().finally(() => { _mounting = null; });
    return _mounting;
  }
  window._gpSyncLoad = load;   // el drawer (openSrc) llama esto al abrir
})();
