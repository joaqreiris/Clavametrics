/* ─────────────────────────────────────────────────────────────────────────
   gps-analysis-filterbar.js — puente de la barra de filtros de la página GPS Analysis.

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
// ── Session Control: puente barra de filtros → sesión actual ───────────────
// La barra nueva (gpFilterBar) es la ÚNICA fuente de filtrado. El módulo SC viejo
// (selectores propios) quedó desactivado: al borrar #sc-sess-sel su IIFE corta en
// `if (!sessSel) return`. Pero las cards session-scoped (Outliers / z-temporal /
// vs sesión) necesitan UNA sesión. Acá la derivamos de la barra: tomamos la sesión
// MÁS RECIENTE que matchee fecha/MD/microciclo. La comparación es POR CARD:
//   · vs sesión → su propio selector (sc-vs-compare-sel)
//   · Outliers  → sesión previa del MISMO MD (contraste, no acotado por la barra)
(function () {
  // Mismo orden de prioridad que _mdRaw() del filter bar (columna primero, md_code después)
  // y misma forma canónica (cmMdNorm), para que el match contra FB.mdCodes no falle por formato.
  const _mdOf = s => {
    const off = s?.match_day_offset;
    if (off != null && off !== '') return window.cmMdNorm(off);
    const md = s?.session_attributes?.md_code;
    return (md != null && md !== '') ? window.cmMdNorm(md) : '';
  };
  function _barFrom(d) {
    if (!d) return null;
    const back = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    switch (d.preset) {
      case '7':  return back(7);
      case '30': return back(30);
      case '90': return back(90);
      case 'season': return null;            // temporada → sin tope inferior simple
    }
    return d.from || null;
  }

  let _busy = false;
  async function _scApplyBar() {
    if (_busy) return; _busy = true;
    try {
      if (!window.sb) return;
      const clubId = window._gpClubId || await window.getClubId?.();
      if (!clubId) return;
      const { data } = await window.sb.from('training_sessions')
        .select('id,session_date,session_attributes,microcycle_id,match_day_offset')
        .eq('club_id', clubId)
        .order('session_date', { ascending: false });
      const all = data || [];
      window._scAllSessions = all;             // labels para Outliers

      const FB   = window.gpFilterBar?.getState?.() || null;
      const from = _barFrom(FB?.date), to = FB?.date?.to || null;
      const md   = FB?.mdCodes?.length      ? new Set(FB.mdCodes.map(v => window.cmMdNorm(v))) : null;
      const mc   = FB?.microcycleIds?.length ? new Set(FB.microcycleIds.map(String)) : null;
      const matches = s =>
        (!from || s.session_date >= from) && (!to || s.session_date <= to) &&
        (!md || md.has(_mdOf(s))) && (!mc || mc.has(String(s.microcycle_id ?? '')));

      const current = all.find(matches) || null;     // más reciente (all viene desc)
      const st = (window._scState = window._scState || {});
      st.sessionId = current?.id || null;
      // Comparación de Outliers: sesión previa del mismo MD code (de todo el historial).
      if (current) {
        const cmd = _mdOf(current);
        const prev = all.find(s => s.id !== current.id && s.session_date < current.session_date && _mdOf(s) === cmd);
        st.compareSessionId = prev?.id || null;
      } else {
        st.compareSessionId = null;
      }

      window._ztRender?.();
      window._scOutliersRender?.();
      window._vsReload?.();
    } catch (e) { console.warn('_scApplyBar:', e); }
    finally { _busy = false; }
  }

  // La barra es la única fuente: re-derivar la sesión en cada cambio de filtro.
  document.addEventListener('gpfilter:change', _scApplyBar);
  // Al entrar al dashboard grp.
  document.getElementById('sections')?.addEventListener('click', e => {
    if (e.target.closest?.('.gp-sec[data-view="grp"]')) setTimeout(_scApplyBar, 200);
  });
  // Carga inicial si grp ya está activo.
  if (document.querySelector('.gp-view[data-view="grp"].is-on')) setTimeout(_scApplyBar, 800);
})();
