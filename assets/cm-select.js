/* Desplegables con criterio propio.
 *
 * El <select> del sistema no deja mostrar más que una línea de texto por opción, así
 * que "Periodización táctica — Frade · morfociclo" entra entero en un renglón y el
 * club tiene que leer con lupa qué escuela está eligiendo. Y en el emparejado de
 * métricas del GPS pasa lo mismo: elegir a qué métrica nuestra corresponde "HSR
 * (60-75%)" es una decisión con contexto, y el contexto no cabe.
 *
 * Esto NO reemplaza al <select>: lo envuelve. El elemento nativo sigue en el DOM con
 * su name y su value, así que todo el código que hace `sel.value` o escucha `change`
 * sigue funcionando igual. Si el script no carga, queda el select de siempre.
 *
 *   CM_SELECT.enhance(el)            un <select>
 *   CM_SELECT.enhanceAll(root)       todos los [data-cm-select] que haya dentro
 *
 * La descripción sale sola de la propia etiqueta: lo que va después de " — " o " · "
 * pasa a ser el subtítulo. Así los selects que ya existen mejoran sin tocarlos. Con
 * data-desc y data-icon en el <option> se puede dar explícita.
 */
(function () {
  'use strict';

  const ABIERTOS = new Set();

  function css() {
    if (document.getElementById('cm-select-css')) return;
    const st = document.createElement('style');
    st.id = 'cm-select-css';
    st.textContent = [
      '.cmsel{position:relative;display:block;width:100%}',
      '.cmsel-btn{display:flex;align-items:center;gap:9px;width:100%;box-sizing:border-box;cursor:pointer;',
      '  padding:8px 11px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3,8px);',
      '  background:var(--cm-surface,#fff);color:var(--cm-fg-strong);text-align:left;font:inherit}',
      '.cmsel-btn:hover{border-color:var(--cm-fg-faint)}',
      '.cmsel.is-open .cmsel-btn{border-color:var(--cm-accent,#111);box-shadow:0 0 0 3px color-mix(in srgb,var(--cm-accent,#111) 16%,transparent)}',
      '.cmsel-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.cmsel-txt{min-width:0;flex:1}',
      '.cmsel-t{display:block;font:600 13px/1.3 var(--cm-font-sans);color:var(--cm-fg-strong);',
      '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cmsel-d{display:block;font:500 11.5px/1.35 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:1px;',
      '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cmsel-caret{flex:none;font-size:15px;color:var(--cm-fg-faint);transition:transform .14s}',
      '.cmsel.is-open .cmsel-caret{transform:rotate(180deg)}',
      '.cmsel-pop{position:absolute;z-index:9999;left:0;right:0;margin-top:5px;padding:5px;',
      '  background:var(--cm-surface,#fff);border:1px solid var(--cm-border);border-radius:var(--cm-r-4,11px);',
      '  box-shadow:0 14px 40px rgba(0,0,0,.16);max-height:320px;overflow:auto}',
      '.cmsel-pop.is-up{top:auto;bottom:100%;margin:0 0 5px}',
      '.cmsel-search{width:100%;box-sizing:border-box;margin-bottom:4px;padding:7px 9px;border-radius:7px;',
      '  border:1px solid var(--cm-border);background:var(--cm-bg-soft,#f7f7f8);color:var(--cm-fg);',
      '  font:500 12.5px/1.3 var(--cm-font-sans)}',
      '.cmsel-grp{padding:8px 9px 3px;font:600 10px/1 var(--cm-font-sans);letter-spacing:.07em;',
      '  text-transform:uppercase;color:var(--cm-fg-faint)}',
      '.cmsel-opt{display:flex;align-items:flex-start;gap:9px;padding:8px 9px;border-radius:7px;cursor:pointer}',
      '.cmsel-opt:hover,.cmsel-opt.is-cursor{background:var(--cm-surface-2,rgba(127,127,127,.07))}',
      '.cmsel-opt.is-sel{background:color-mix(in srgb,var(--cm-accent,#111) 10%,transparent)}',
      '.cmsel-opt[aria-disabled="true"]{opacity:.45;cursor:not-allowed}',
      '.cmsel-ico{flex:none;width:17px;text-align:center;font-size:15px;color:var(--cm-fg-muted);margin-top:1px}',
      '.cmsel-opt.is-sel .cmsel-ico{color:var(--cm-accent,#111)}',
      '.cmsel-ot{display:block;font:600 12.5px/1.35 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.cmsel-od{display:block;font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-top:2px}',
      '.cmsel-check{flex:none;margin-left:auto;font-size:15px;color:var(--cm-accent,#111);visibility:hidden}',
      '.cmsel-opt.is-sel .cmsel-check{visibility:visible}',
      '.cmsel-empty{padding:14px 9px;text-align:center;font:500 12px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted)}',
    ].join('');
    document.head.appendChild(st);
  }

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // "Título — descripción" o "Título · descripción" → { t, d }. El separador tiene que
  // ir rodeado de espacios: así "Sub-17" o "ATR (blocks)" no se parten por la mitad.
  function partir(label) {
    const m = String(label || '').match(/^(.*?)\s+[—–·-]\s+(.+)$/);
    return m ? { t: m[1].trim(), d: m[2].trim() } : { t: String(label || '').trim(), d: '' };
  }

  function datos(sel) {
    return [...sel.options].map((o, i) => {
      const propia = o.dataset.desc;
      const p = propia ? { t: o.textContent.trim(), d: propia } : partir(o.textContent);
      return {
        i, value: o.value, titulo: p.t, desc: p.d,
        icono: o.dataset.icon || '', grupo: o.parentElement?.label || o.dataset.group || '',
        disabled: o.disabled,
      };
    });
  }

  function enhance(sel) {
    if (!sel || sel.tagName !== 'SELECT' || sel.multiple || sel.dataset.cmSelectOn) return null;
    css();
    sel.dataset.cmSelectOn = '1';

    const wrap = document.createElement('div');
    wrap.className = 'cmsel';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmsel-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (sel.disabled) btn.disabled = true;
    wrap.appendChild(btn);

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.style.position = 'absolute';
    sel.style.opacity = '0';
    sel.style.pointerEvents = 'none';
    sel.style.width = '1px';
    sel.style.height = '1px';
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    let pop = null, cursor = -1, filtro = '';

    function pintarBoton() {
      const o = datos(sel).find(d => d.value === sel.value) || datos(sel)[sel.selectedIndex] || null;
      const t = o ? o.titulo : '';
      const d = o ? o.desc : '';
      btn.innerHTML =
        (o && o.icono ? `<i class="ti ${esc(o.icono)} cmsel-ico"></i>` : '') +
        `<span class="cmsel-txt"><span class="cmsel-t">${esc(t)}</span>` +
        (d ? `<span class="cmsel-d">${esc(d)}</span>` : '') + '</span>' +
        '<i class="ti ti-chevron-down cmsel-caret"></i>';
    }

    function visibles() {
      const q = filtro.trim().toLowerCase();
      const all = datos(sel);
      if (!q) return all;
      return all.filter(o => (o.titulo + ' ' + o.desc).toLowerCase().includes(q));
    }

    function pintarLista() {
      const lista = visibles();
      const cuerpo = pop.querySelector('.cmsel-list');
      if (!lista.length) {
        cuerpo.innerHTML = `<div class="cmsel-empty">${esc(sel.dataset.emptyText || 'No matches')}</div>`;
        return;
      }
      let grupoActual = null;
      cuerpo.innerHTML = lista.map(o => {
        let cab = '';
        if (o.grupo && o.grupo !== grupoActual) { grupoActual = o.grupo; cab = `<div class="cmsel-grp">${esc(o.grupo)}</div>`; }
        const sel_ = o.value === sel.value;
        return cab + `<div class="cmsel-opt${sel_ ? ' is-sel' : ''}" role="option" aria-selected="${sel_}"
            ${o.disabled ? 'aria-disabled="true"' : ''} data-i="${o.i}">
          ${o.icono ? `<i class="ti ${esc(o.icono)} cmsel-ico"></i>` : ''}
          <span style="min-width:0;flex:1">
            <span class="cmsel-ot">${esc(o.titulo)}</span>
            ${o.desc ? `<span class="cmsel-od">${esc(o.desc)}</span>` : ''}
          </span>
          <i class="ti ti-check cmsel-check"></i>
        </div>`;
      }).join('');
      marcarCursor();
    }

    function opciones() { return [...pop.querySelectorAll('.cmsel-opt')]; }
    function marcarCursor() {
      opciones().forEach((el, k) => el.classList.toggle('is-cursor', k === cursor));
      const act = opciones()[cursor];
      if (act) act.scrollIntoView({ block: 'nearest' });
    }

    function abrir() {
      if (pop || btn.disabled) return;
      cerrarTodos();
      pop = document.createElement('div');
      pop.className = 'cmsel-pop';
      pop.setAttribute('role', 'listbox');
      // El buscador solo cuando de verdad hace falta: con cinco opciones estorba.
      const conBusqueda = sel.options.length >= 8;
      pop.innerHTML = (conBusqueda
        ? `<input class="cmsel-search" type="text" placeholder="${esc(sel.dataset.searchText || 'Search…')}">` : '')
        + '<div class="cmsel-list"></div>';
      wrap.appendChild(pop);
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      ABIERTOS.add(cerrar);

      // Si no cabe abajo, se abre hacia arriba: en una tabla larga el panel quedaba
      // cortado por el borde de la ventana.
      const r = wrap.getBoundingClientRect();
      if (window.innerHeight - r.bottom < 240 && r.top > 240) pop.classList.add('is-up');

      cursor = Math.max(0, visibles().findIndex(o => o.value === sel.value));
      pintarLista();
      const busc = pop.querySelector('.cmsel-search');
      if (busc) {
        busc.addEventListener('input', () => { filtro = busc.value; cursor = 0; pintarLista(); });
        busc.focus();
      }
      pop.addEventListener('click', e => {
        const op = e.target.closest('.cmsel-opt');
        if (!op || op.getAttribute('aria-disabled') === 'true') return;
        elegir(+op.dataset.i);
      });
    }

    function cerrar() {
      if (!pop) return;
      pop.remove(); pop = null; filtro = '';
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      ABIERTOS.delete(cerrar);
    }

    function elegir(i) {
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        // El `change` lo tiene que ver el código de siempre, que es quien guarda.
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      pintarBoton();
      cerrar();
      btn.focus();
    }

    btn.addEventListener('click', () => (pop ? cerrar() : abrir()));
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
    });
    wrap.addEventListener('keydown', e => {
      if (!pop) return;
      if (e.key === 'Escape')      { e.preventDefault(); cerrar(); btn.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, opciones().length - 1); marcarCursor(); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); cursor = Math.max(cursor - 1, 0); marcarCursor(); }
      else if (e.key === 'Enter')     {
        e.preventDefault();
        const act = opciones()[cursor];
        if (act && act.getAttribute('aria-disabled') !== 'true') elegir(+act.dataset.i);
      }
    });

    // Quien cambie el <select> por código (i18n al repintar, carga de datos) tiene que
    // verse reflejado en el botón.
    sel.addEventListener('change', pintarBoton);
    sel.addEventListener('cm:refresh', pintarBoton);

    pintarBoton();
    return { refresh: pintarBoton, close: cerrar };
  }

  function cerrarTodos() { [...ABIERTOS].forEach(fn => fn()); }
  document.addEventListener('click', e => { if (!e.target.closest('.cmsel')) cerrarTodos(); });

  function enhanceAll(root) {
    (root || document).querySelectorAll('select[data-cm-select]').forEach(enhance);
  }
  document.addEventListener('DOMContentLoaded', () => enhanceAll(document));

  window.CM_SELECT = { enhance, enhanceAll, closeAll: cerrarTodos };
})();
