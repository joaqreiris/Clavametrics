/* =============================================================
   GPS Analysis — Chart reference · "Editar layout" section
   Renders the target look of the dashboard's edit-layout mode:
   drag-to-reorder + draggable resize that snaps to the 12-col grid.
   Static reference render — the real interaction is wired by the app.
   ============================================================= */
(function () {
  const mount = document.getElementById('layoutEditSection');
  if (!mount) return;

  /* ---- faux card bodies (lightweight, sober) ---- */
  const bodyBars = (on = 4) => {
    const hs = [46, 64, 38, 78, 54, 70, 42];
    return `<div class="le-mini">
      <div class="mlab"><span>Total distance</span><span>m</span></div>
      <div class="le-bars">${hs.map((h, i) =>
        `<i class="${i === on ? 'on' : ''}" style="height:${h}%"></i>`).join('')}</div>
    </div>`;
  };
  const bodyKpi = () => `<div class="le-mini">
      <div class="mlab"><span>High-speed running</span><span>MD-1</span></div>
      <div class="le-kpi"><div class="v">612<span class="u">m</span></div>
        <div class="d"><i class="ti ti-arrow-up-right"></i>8%</div></div>
      <div class="le-spark"><svg viewBox="0 0 100 30" preserveAspectRatio="none">
        <polyline points="0,22 16,18 33,24 50,12 66,16 83,7 100,9"/></svg></div>
    </div>`;
  const bodyRank = () => {
    const rows = [['F. López', 92, '11.4'], ['M. Soto', 74, '9.8'], ['A. Ruiz', 58, '8.1']];
    return `<div class="le-mini">
      <div class="mlab"><span>Sprint distance</span><span>m</span></div>
      ${rows.map(r => `<div class="le-rkrow"><span class="n">${r[0]}</span>
        <span class="tr"><i style="width:${r[1]}%"></i></span><span class="vv">${r[2]}</span></div>`).join('')}
    </div>`;
  };

  /* ---- card chrome (mirror of .gp-c) ---- */
  function card(opts) {
    const { title, sub, body, span = 'le-c4', cls = '' } = opts;
    return `<div class="gp-c ${span} ${cls}" data-size="${span.replace('le-c4', 'sm').replace('le-c6', 'md').replace('le-c8', 'lg').replace('le-c12', 'full')}">
      <div class="gp-c-h">
        <span class="ga-grip" title="Arrastrar"><i class="ti ti-grip-vertical"></i></span>
        <span class="ttl">${title}</span><span class="sub">· ${sub}</span>
        <span class="right"><span class="le-cta">
          <button class="edit" title="Editar"><i class="ti ti-pencil"></i></button>
          <button class="del" title="Borrar"><i class="ti ti-x"></i></button>
        </span></span>
      </div>
      <div class="gp-c-b">${body}</div>
      <span class="le-rh" title="Estirar para redimensionar"></span>
    </div>`;
  }

  const arrowSvg = `<svg width="22" height="24" viewBox="0 0 22 24" fill="var(--cm-bg)" stroke="var(--cm-fg-strong)" stroke-width="1.4" stroke-linejoin="round"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14 21 L10.5 13.5 L17 13 Z"/></svg>`;

  mount.innerHTML = `
  <!-- ============ BLOCK 1 · normal vs edición ============ -->
  <div class="ref-block">
    <div class="ref-block-h">
      <span class="t">Estado normal vs. edición</span>
      <span class="d">.gp-grid &nbsp;·&nbsp; .gp-grid.is-layout</span>
      <span class="note"><i class="ti ti-columns-3"></i>Mismo grid de 12 columnas</span>
    </div>
    <div class="le-twin">

      <div>
        <div class="le-stage">
          <div class="le-bar">
            <span class="le-tag normal"><i class="ti ti-eye"></i>NORMAL</span>
            <span class="ttl">Microciclo · MD</span>
            <span class="sp"></span>
            <span class="le-toggle"><span class="dot"></span><i class="ti ti-layout-board"></i>Editar layout</span>
          </div>
          <div class="le-canvas">
            <div class="le-grid">
              ${card({ title: 'Distancia total', sub: 'barras · squad', span: 'le-c6', body: bodyBars(3) })}
              ${card({ title: 'HSR', sub: 'kpi · MD-1', span: 'le-c6', body: bodyKpi() })}
              ${card({ title: 'Sprint ranking', sub: 'ranking', span: 'le-c12', body: bodyRank() })}
            </div>
          </div>
        </div>
        <div class="le-cap"><i class="ti ti-pointer-off"></i>Cards firmes, sin bordes. Lápiz y X aparecen al pasar el mouse. No se mueven ni se redimensionan.</div>
      </div>

      <div>
        <div class="le-stage">
          <div class="le-bar">
            <span class="le-tag edit"><i class="ti ti-layout-board"></i>EDITAR LAYOUT</span>
            <span class="ttl">Microciclo · MD</span>
            <span class="sp"></span>
            <span class="le-toggle is-on"><span class="dot"></span><i class="ti ti-check"></i>Editando</span>
          </div>
          <div class="le-canvas">
            <div class="le-grid is-layout">
              ${card({ title: 'Distancia total', sub: 'barras · squad', span: 'le-c6', body: bodyBars(3) })}
              ${card({ title: 'HSR', sub: 'kpi · MD-1', span: 'le-c6', body: bodyKpi() })}
              ${card({ title: 'Sprint ranking', sub: 'ranking', span: 'le-c12', body: bodyRank() })}
            </div>
          </div>
        </div>
        <div class="le-cap"><i class="ti ti-border-corners"></i>Borde punteado + handle de agarre + cursor <kbd>grab</kbd>. Esquina inferior derecha estirable.</div>
      </div>

    </div>
  </div>

  <!-- ============ BLOCK 2 · anatomía de la card ============ -->
  <div class="ref-block">
    <div class="ref-block-h">
      <span class="t">Anatomía · card en edición</span>
      <span class="d">qué controles quedan en el header</span>
      <span class="note"><i class="ti ti-circle-x"></i>Sin S / M / L / FULL</span>
    </div>
    <div class="le-anat">
      <div class="le-anat-stage">
        ${card({ title: 'Distancia total', sub: 'barras · squad', span: '', body: bodyBars(3) })}
        <span class="le-pin" style="top:22px; left:24px">1</span>
        <span class="le-pin" style="top:42px; left:42px">2</span>
        <span class="le-pin" style="top:42px; right:42px">3</span>
        <span class="le-pin" style="bottom:24px; right:24px">4</span>
      </div>
      <div class="le-legend">
        <div class="le-li"><span class="nm">1</span><div class="tx"><div class="t">Borde punteado</div><div class="d">Marca la card como editable. <code>outline:1.5px dashed</code> — vira a accent en hover.</div></div></div>
        <div class="le-li"><span class="nm">2</span><div class="tx"><div class="t">Handle de agarre · cursor grab</div><div class="d">Arrastrá desde el handle <i class="ti ti-grip-vertical"></i> o desde cualquier parte del header para reordenar.</div></div></div>
        <div class="le-li"><span class="nm">3</span><div class="tx"><div class="t">Acciones del header</div><div class="d">Lápiz <i class="ti ti-pencil"></i> = editar la card · X <i class="ti ti-x"></i> = borrarla. Es lo único que queda en el header.</div></div></div>
        <div class="le-li"><span class="nm">4</span><div class="tx"><div class="t">Handle de resize</div><div class="d">Esquina inferior derecha, cursor <code>nwse-resize</code>. Estirá libre; al soltar imanta al grid de 12.</div></div></div>
      </div>
    </div>

    <div class="ref-block-h" style="margin-top:26px"><span class="t" style="font-size:13.5px">Header — normal vs. edición</span><span class="d">el toggle S/M/L/FULL desaparece</span></div>
    <div class="le-headcmp">
      <div class="le-hc">
        <div class="cap"><i class="ti ti-eye"></i>Modo normal</div>
        <div class="body">
          <div class="le-hrow">
            <span class="ttl">Distancia total</span><span class="sub">· barras</span>
            <span class="right">
              <button title="Editar"><i class="ti ti-pencil"></i></button>
              <button title="Borrar"><i class="ti ti-x"></i></button>
            </span>
          </div>
        </div>
      </div>
      <div class="le-hc">
        <div class="cap"><i class="ti ti-layout-board"></i>Modo edición</div>
        <div class="body">
          <div class="le-hrow">
            <span class="ga-grip"><i class="ti ti-grip-vertical"></i></span>
            <span class="ttl">Distancia total</span><span class="sub">· barras</span>
            <span class="right">
              <button title="Editar"><i class="ti ti-pencil"></i></button>
              <button title="Borrar"><i class="ti ti-x"></i></button>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="le-removed-note"><i class="ti ti-trash-x"></i>Se elimina el toggle de tamaño <span class="le-killed"><span>S</span><span>M</span><span>L</span><span>FULL</span></span> — el tamaño ahora se cambia <b>solo arrastrando</b> la esquina.</div>
  </div>

  <!-- ============ BLOCK 3 · drag para reordenar ============ -->
  <div class="ref-block">
    <div class="ref-block-h">
      <span class="t">Drag · reordenar</span>
      <span class="d">card elevada + indicador de destino (drop)</span>
      <span class="note"><i class="ti ti-arrows-move"></i>Arrastrar al hueco</span>
    </div>
    <div class="le-stage le-drag-stage">
      <div class="le-bar">
        <span class="le-tag edit"><i class="ti ti-layout-board"></i>EDITAR LAYOUT</span>
        <span class="ttl">Reordenando “HSR”</span>
      </div>
      <div class="le-canvas">
        <div class="le-grid is-layout">
          ${card({ title: 'Distancia total', sub: 'barras', span: 'le-c4', body: bodyBars(3) })}
          <div class="le-dropline"></div>
          ${card({ title: 'Sprint ranking', sub: 'ranking', span: 'le-c4', body: bodyRank() })}
          <div class="le-slot"><span>hueco original</span></div>
          ${card({ title: 'HSR', sub: 'kpi · arrastrando', span: 'le-c4', cls: 'is-ghost', body: bodyKpi() })}
        </div>
      </div>
      <div class="le-cursor" style="top:150px; left:300px">${arrowSvg}<span class="grab-chip"><i class="ti ti-grip-vertical"></i>HSR</span></div>
    </div>
    <div class="le-cap"><i class="ti ti-info-circle"></i>La card arrastrada se eleva (fantasma con sombra, leve inclinación). La <b>barra vertical accent</b> entre cards muestra dónde va a caer; el hueco original queda punteado.</div>
  </div>

  <!-- ============ BLOCK 4 · resize con snap ============ -->
  <div class="ref-block">
    <div class="ref-block-h">
      <span class="t">Resize · snap al grid de 12</span>
      <span class="d">estira libre → imanta a la columna más cercana</span>
      <span class="note"><i class="ti ti-magnet"></i>Reemplaza S / M / L</span>
    </div>
    <div class="le-resize-stage">
      <div class="le-rt">
        <div class="le-colguides">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
        <div class="le-fracs">
          <div class="le-frac" style="left:25%"><span class="lab">¼</span><span class="tick"></span></div>
          <div class="le-frac" style="left:33.33%"><span class="lab">⅓</span><span class="tick"></span></div>
          <div class="le-frac is-target" style="left:50%"><span class="lab">½</span><span class="tick"></span></div>
          <div class="le-frac" style="left:75%"><span class="lab">¾</span><span class="tick"></span></div>
          <div class="le-frac" style="left:100%"><span class="lab">full</span><span class="tick"></span></div>
        </div>
        <!-- phantom: snapped landing (½ = span 6) -->
        <div class="le-snapghost" style="left:0; width:50%"><span class="lab"><i class="ti ti-magnet"></i>½ · span 6</span></div>
        <!-- card mid-drag, stretched a bit past ½ -->
        <div class="gp-c" style="width:58%">
          <div class="gp-c-h">
            <span class="ga-grip"><i class="ti ti-grip-vertical"></i></span>
            <span class="ttl">Distancia total</span><span class="sub">· redimensionando</span>
            <span class="right"><span class="le-cta">
              <button class="edit"><i class="ti ti-pencil"></i></button>
              <button class="del"><i class="ti ti-x"></i></button>
            </span></span>
          </div>
          <div class="gp-c-b">${bodyBars(3)}</div>
          <span class="le-rh"></span>
        </div>
        <span class="le-magnet" style="left:50%; top:50%; transform:translate(-50%,-50%)"><i class="ti ti-arrow-bar-to-left"></i>imanta a ½</span>
        <div class="le-resize-cursor" style="left:58%; top:150px; margin-left:-8px"><i class="ti ti-arrows-diagonal-2"></i></div>
      </div>
      <div class="le-cap"><i class="ti ti-pointer"></i>Mientras arrastrás ves las marcas <b>¼ · ⅓ · ½ · ¾ · full</b>. Soltás en 58% → <b>imanta a ½</b> (la columna más cercana del grid de 12).</div>
    </div>

    <div class="le-results">
      <div class="le-res">
        <div class="top"><span class="sw" style="width:30px"></span><span class="nm">Chica</span><span class="sp">span 4 · ⅓</span></div>
        <div class="was">Reemplaza a <s>S</s></div>
      </div>
      <div class="le-res">
        <div class="top"><span class="sw" style="width:46px"></span><span class="nm">Media</span><span class="sp">span 6 · ½</span></div>
        <div class="was">Reemplaza a <s>M</s></div>
      </div>
      <div class="le-res">
        <div class="top"><span class="sw" style="width:80px"></span><span class="nm">Full</span><span class="sp">span 12 · full</span></div>
        <div class="was">Reemplaza a <s>L</s> / <s>FULL</s></div>
      </div>
    </div>
  </div>
  `;
})();
