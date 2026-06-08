/* =============================================================
   GPS Analysis — Filter bar section (Section 6) renderer.
   Visual reference: closed (empty / active) + open multi-select
   states for the dashboard filter bar. No data logic.
   ============================================================= */
(function () {
  'use strict';

  /* ---------- closed select pill ---------- */
  // opts: { icon, cap, val, count, active, open, clearable }
  function pill(o) {
    const cls = 'fsel' + (o.active ? ' is-active' : '') + (o.open ? ' is-open' : '');
    let inner = o.icon ? `<i class="ti ${o.icon} lead"></i>` : '';
    if (o.cap && o.active) inner += `<span class="cap">${o.cap}:</span>`;
    inner += `<span class="${o.active ? 'val' : 'cap'}">${o.val}</span>`;
    if (o.count) inner += `<span class="cnt">${o.count}</span>`;
    if (o.active && o.clearable !== false) inner += `<span class="x" title="Limpiar"><i class="ti ti-x"></i></span>`;
    inner += `<i class="ti ti-chevron-down chev"></i>`;
    return `<button class="${cls}">${inner}</button>`;
  }

  /* ---------- open dropdown: search + checkbox list ---------- */
  // o: { search, query, focus, tools, options:[{lab,sub,sel,swatch,radio}], foot, selN, totalN }
  function dropMulti(o) {
    const search = o.search === false ? '' :
      `<div class="fdrop-search${o.focus ? ' is-focus' : ''}"><i class="ti ti-search"></i>`
      + `<input type="text" placeholder="${o.placeholder || 'Buscar…'}"${o.query ? ` value="${o.query}"` : ''}></div>`;
    const tools = o.tools === false ? '' :
      `<div class="fdrop-tools"><button>Seleccionar todo</button><span class="sep">·</span><button>Limpiar</button>`
      + `<span class="selinfo">${o.selN}/${o.totalN}</span></div>`;
    const list = `<div class="fdrop-list">` + o.options.map(op => {
      const box = `<span class="box${op.radio ? ' radio' : ''}">${op.sel ? '<i class="ti ti-check"></i>' : ''}</span>`;
      const sw = op.swatch ? `<span class="swatch" style="background:${op.swatch}"></span>` : '';
      const sub = op.sub ? `<span class="sub">${op.sub}</span>` : '';
      return `<div class="fopt${op.sel ? ' is-sel' : ''}">${box}${sw}<span class="lab">${op.lab}</span>${sub}</div>`;
    }).join('') + `</div>`;
    const foot = o.foot === false ? '' :
      `<div class="fdrop-foot"><span class="cnt"><b>${o.selN}</b> de ${o.totalN}</span>`
      + `<button class="apply"><i class="ti ti-check"></i>Aplicar</button></div>`;
    return `<div class="fdrop">${search}${tools}${list}${foot}</div>`;
  }

  /* ---------- open dropdown: date range + presets ---------- */
  function dropDate(o) {
    const presets = [
      { lab: 'Últimos 7 días', sel: false },
      { lab: 'Últimos 14 días', sel: true },
      { lab: 'Últimos 28 días', sel: false },
      { lab: 'Microciclo actual', sel: false },
      { lab: 'Rango personalizado', sel: false },
    ];
    const range = `<div class="fdate-range">`
      + `<span class="fdate-field is-focus"><i class="ti ti-calendar"></i>01 May</span>`
      + `<span class="fdate-dash">→</span>`
      + `<span class="fdate-field"><i class="ti ti-calendar"></i>14 May</span></div>`;
    const ph = `<div class="fdate-presets-h">Presets</div>`;
    const list = `<div class="fdrop-list" style="padding-top:0">` + presets.map(p =>
      `<div class="fopt${p.sel ? ' is-sel' : ''}"><span class="box radio">${p.sel ? '<i class="ti ti-check"></i>' : ''}</span><span class="lab">${p.lab}</span></div>`
    ).join('') + `</div>`;
    const foot = `<div class="fdrop-foot"><span class="cnt">14 días · <b>MC 46</b></span><button class="apply"><i class="ti ti-check"></i>Aplicar</button></div>`;
    return `<div class="fdrop" style="width:264px">${range}${ph}${list}${foot}</div>`;
  }

  /* ---------- data (illustrative) ---------- */
  const MD_OPTS = [
    { lab: 'MD-4', sub: 'recovery' }, { lab: 'MD-3', sub: 'load' }, { lab: 'MD-2', sub: 'speed' },
    { lab: 'MD-1', sub: 'activation' }, { lab: 'MD', sub: 'match' }, { lab: 'MD+1', sub: 'regen' }, { lab: 'MD+2', sub: 'off' },
  ];
  const POS_OPTS = [
    { lab: 'Goalkeeper', sub: 'GK', swatch: 'var(--cm-danger)' },
    { lab: 'Centre-back', sub: 'CB', swatch: 'var(--cm-info)' },
    { lab: 'Full-back', sub: 'LB/RB', swatch: 'var(--cm-info)' },
    { lab: 'Defensive mid', sub: 'DM', swatch: 'var(--cm-accent)' },
    { lab: 'Central mid', sub: 'CM', swatch: 'var(--cm-accent)' },
    { lab: 'Winger', sub: 'LW/RW', swatch: 'var(--cm-warning)' },
    { lab: 'Striker', sub: 'ST', swatch: 'var(--cm-warning)' },
  ];
  const PLAYER_OPTS = [
    { lab: 'R. Vega', sub: '#7' }, { lab: 'S. Rivas', sub: '#9' }, { lab: 'T. López', sub: '#11' },
    { lab: 'F. Domínguez', sub: '#10' }, { lab: 'J. Cardozo', sub: '#8' }, { lab: 'M. Paredes', sub: '#6' },
    { lab: 'I. Barreiro', sub: '#18' }, { lab: 'G. Ríos', sub: '#3' },
  ];
  const sel = (arr, idxs) => arr.map((o, i) => Object.assign({}, o, { sel: idxs.includes(i) }));

  /* ---------- full bar (active state) ---------- */
  function fullBar(active) {
    if (active) {
      return `<div class="fbar">`
        + `<span class="fbar-lead"><i class="ti ti-filter"></i>Filtros</span>`
        + pill({ icon: 'ti-calendar-event', cap: 'MD', val: 'MD-3', count: 2, active: true })
        + pill({ icon: 'ti-calendar', cap: 'Fecha', val: '14 días', active: true })
        + pill({ icon: 'ti-user', val: 'Todos los jugadores' })
        + pill({ icon: 'ti-shirt-sport', cap: 'Posición', val: 'CB', count: 2, active: true })
        + `<span class="fbar-count"><span class="dot"></span>3 activos</span>`
        + `<button class="fbar-clear"><i class="ti ti-filter-off"></i>Limpiar</button>`
        + `</div>`;
    }
    return `<div class="fbar">`
      + `<span class="fbar-lead"><i class="ti ti-filter"></i>Filtros</span>`
      + `<span class="fbar-sep"></span>`
      + pill({ icon: 'ti-calendar-event', val: 'Todos los MD' })
      + pill({ icon: 'ti-calendar', val: 'Cualquier fecha' })
      + pill({ icon: 'ti-user', val: 'Todos los jugadores' })
      + pill({ icon: 'ti-shirt-sport', val: 'Todas las posiciones' })
      + `<span class="fbar-count is-zero"><span class="dot"></span>Sin filtros</span>`
      + `<button class="fbar-clear is-off"><i class="ti ti-filter-off"></i>Limpiar</button>`
      + `</div>`;
  }

  /* ---------- build section ---------- */
  function build(root) {
    // Block A — full bar
    const blockA = `<div class="ref-block">
        <div class="ref-block-h"><span class="t">Barra completa</span><span class="d">sobre el dashboard · estado activo</span>
          <span class="note"><i class="ti ti-filter-cog"></i>4 desplegables + contador global + limpiar</span></div>
        ${fullBar(true)}
      </div>`;

    // Block B — states
    const closedEmpty = `<div class="frow-pills">`
      + pill({ icon: 'ti-calendar-event', val: 'Todos los MD' })
      + pill({ icon: 'ti-calendar', val: 'Cualquier fecha' })
      + pill({ icon: 'ti-user', val: 'Todos los jugadores' })
      + pill({ icon: 'ti-shirt-sport', val: 'Todas las posiciones' })
      + `</div>`;
    const closedActive = `<div class="frow-pills">`
      + pill({ icon: 'ti-calendar-event', cap: 'MD', val: 'MD-3', count: 2, active: true })
      + pill({ icon: 'ti-calendar', cap: 'Fecha', val: 'Últimos 14 días', active: true })
      + pill({ icon: 'ti-user', cap: 'Jugador', val: 'R. Vega', active: true })
      + pill({ icon: 'ti-shirt-sport', cap: 'Posición', val: 'Centre-back', count: 2, active: true })
      + `</div>`;

    const openShelf = `<div class="fopen-shelf">`
      + `<div class="fopen-item"><span class="fopen-cap">MD code · multi</span>`
        + `<div class="fsel-wrap">${pill({ icon: 'ti-calendar-event', cap: 'MD', val: 'MD-3', count: 2, active: true, open: true })}`
        + dropMulti({ placeholder: 'Buscar MD…', selN: 2, totalN: 7, options: sel(MD_OPTS, [1, 2]) }) + `</div></div>`
      + `<div class="fopen-item"><span class="fopen-cap">Fecha · rango</span>`
        + `<div class="fsel-wrap">${pill({ icon: 'ti-calendar', cap: 'Fecha', val: 'Últimos 14 días', active: true, open: true })}`
        + dropDate({}) + `</div></div>`
      + `<div class="fopen-item"><span class="fopen-cap">Jugador · multi + buscador</span>`
        + `<div class="fsel-wrap">${pill({ icon: 'ti-user', cap: 'Jugador', val: 'R. Vega', active: true, open: true })}`
        + dropMulti({ placeholder: 'Buscar jugador…', query: 'ríos', focus: true, selN: 1, totalN: 24, options: sel(PLAYER_OPTS, [0]) }) + `</div></div>`
      + `<div class="fopen-item"><span class="fopen-cap">Posición · multi (Power BI)</span>`
        + `<div class="fsel-wrap">${pill({ icon: 'ti-shirt-sport', cap: 'Posición', val: 'Centre-back', count: 2, active: true, open: true })}`
        + dropMulti({ placeholder: 'Buscar posición…', selN: 2, totalN: 7, options: sel(POS_OPTS, [1, 2]) }) + `</div></div>`
      + `</div>`;

    const blockB = `<div class="ref-block">
        <div class="ref-block-h"><span class="t">Estados de cada desplegable</span><span class="d">cerrado vacío · cerrado activo · abierto</span>
          <span class="note"><i class="ti ti-checkbox"></i>Abierto = buscador + checkbox multi-selección</span></div>
        <div class="fstate-row">
          <span class="fstate-tag"><span class="n">1</span>Cerrado · sin filtro<span class="d">— placeholder "Todos / Cualquiera"</span></span>
          ${closedEmpty}
        </div>
        <div class="fstate-row" style="margin-top:18px">
          <span class="fstate-tag"><span class="n">2</span>Cerrado · con filtro activo<span class="d">— selección + contador + ✕ para limpiar</span></span>
          ${closedActive}
        </div>
        <div class="fstate-row" style="margin-top:18px">
          <span class="fstate-tag"><span class="n">3</span>Abierto<span class="d">— buscador arriba · checkbox · Seleccionar todo / Limpiar · Aplicar</span></span>
          ${openShelf}
        </div>
      </div>`;

    // Block C — two widths
    const blockC = `<div class="ref-block">
        <div class="ref-block-h"><span class="t">Dos anchos</span><span class="d">desktop ancho · angosto</span>
          <span class="note"><i class="ti ti-arrow-autofit-width"></i>Los desplegables hacen wrap; el contador y limpiar bajan de fila</span></div>
        <div class="fbar-frame">
          <div class="cap"><span class="w">ANCHO</span>desktop · una fila</div>
          <div class="fbar-hold">${fullBar(true)}</div>
        </div>
        <div class="fbar-frame" style="max-width:560px; margin-top:18px">
          <div class="cap"><span class="w">ANGOSTO</span>560px · wrap a varias filas</div>
          <div class="fbar-hold">${fullBar(true)}</div>
        </div>
      </div>`;

    root.innerHTML = blockA + blockB + blockC;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('filterSection');
    if (root) build(root);
  });
})();
