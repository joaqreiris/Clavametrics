/* ─────────────────────────────────────────────────────────────────────────
   gps-export.js — informe PDF / impresión de GPS Analysis.

   Exporta LAS CARDS del dashboard activo, no la página: sin sidebar, sin barra
   de filtros, sin botones. El layout es el que armó el usuario en su dashboard
   (mismas posiciones y tamaños), porque ese orden ES la lectura que quiso darle.

   Motor: html2canvas + jsPDF, el mismo camino ya probado en Daily Planning
   (assets/pages/daily-planning.js · dpExportPDF): se captura una hoja armada
   aparte y se corta en páginas por límites seguros, de modo que una card nunca
   queda partida al medio.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const T = (k, f, v) => (typeof window.tt === 'function' ? window.tt(k, f, v)
    : (window.CM_I18N && CM_I18N.t ? (CM_I18N.t(k, v) !== k ? CM_I18N.t(k, v) : f) : f));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SHEET_ID = 'gpPrintSheet';
  // Ancho de la hoja = el del grid en pantalla, acotado. Igualarlo mantiene los canvas de Chart.js
  // en escala 1:1 (son bitmaps: estirarlos los deja borrosos) y conserva la proporción de las cards.
  const SHEET_MIN = 900, SHEET_MAX = 1600;
  const SHEET_PAD = 24;   // padding lateral de la hoja (coincide con .gps-sheet en el CSS)
  // Fuera de pantalla pero POR ENCIMA de todo: con z-index negativo la hoja queda detrás del fondo
  // del body y la captura sale lavada (se fotografía ese fondo encima). pointer-events:none para
  // que jamás intercepte un clic mientras se genera.
  const OFFSCREEN = 'display:block;position:fixed;left:-10000px;top:0;z-index:2147483000;pointer-events:none';

  // ── Contexto del informe ────────────────────────────────────────────────
  const DASH_NAMES = { ind: 'Player Week Report', grp: 'Session Control',
    mind: 'Match Performance', mgrp: 'Load Monitoring', mc: 'Microcycle Compare' };

  function activeView() { return document.querySelector('.gp-view.is-on'); }
  function activeGrid()  { return document.querySelector('.gp-view.is-on .gp-grid'); }
  function dashName() {
    const v = activeView()?.dataset.view || '';
    // Dashboard propio del club (viewKey "db-<uuid>") → su pestaña lleva el nombre real.
    const tab = document.querySelector(`.gp-sec[data-view="${v}"] .t, .gp-sec[data-view="${v}"]`);
    return DASH_NAMES[v] || (tab ? tab.textContent.trim() : v);
  }
  function teamName() {
    const sel = document.getElementById('gpsTeamSelect');
    const raw = (sel && sel.selectedOptions?.[0]) ? sel.selectedOptions[0].textContent
      : document.querySelector('.cm-team-switch .t')?.textContent;
    const t = (raw || '').trim();
    // El switcher puede estar todavía en su estado de carga: «Loading…» no es un nombre de equipo
    // y quedaría impreso en el título del informe.
    const loading = String(T('common.loading', 'Loading…')).trim();
    return (!t || t === loading || /^(loading|cargando|a carregar)…?$/i.test(t)) ? '' : t;
  }

  /** Cards visibles del dashboard activo, en el ORDEN en que están dibujadas (fila, luego columna). */
  function cardsOf(grid) {
    if (!grid) return [];
    return [...grid.querySelectorAll('.gp-c')]
      .filter(c => c.offsetParent !== null)                      // ignora las ocultas
      .map(c => {
        const r = c.getBoundingClientRect();
        // Una card que sigue cargando o que no tiene datos para los filtros actuales no aporta
        // nada al informe: se lista igual, pero desmarcada, para no imprimir un spinner.
        const empty = !!c.querySelector('.cb2-state.load, .cb2-state.empty, .cb2-state.error');
        return { el: c, top: r.top, left: r.left, title: cardTitle(c), empty };
      })
      .sort((a, b) => (Math.abs(a.top - b.top) > 8 ? a.top - b.top : a.left - b.left));
  }
  function cardTitle(c) {
    const t = c.querySelector('.gp-c-h .ttl');
    if (t && t.textContent.trim()) return t.textContent.trim();
    if (c.dataset.cardTitle) return c.dataset.cardTitle;
    const kpi = c.querySelector('.gp-kpi .l, .gp-kpi .k');
    return (kpi && kpi.textContent.trim()) || T('gps_analysis.export_card_untitled', 'Card');
  }

  /** Filtros aplicados, en texto legible: lo que explica QUÉ se está mirando en el informe. */
  function filterLines() {
    const fb = window.gpFilterBar;
    if (!fb || typeof fb.describeActive !== 'function') return [];
    try { return fb.describeActive(); } catch (_) { return []; }
  }

  // ── Hoja imprimible ─────────────────────────────────────────────────────
  function sheetHost() {
    let host = document.getElementById(SHEET_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = SHEET_ID;
      document.body.appendChild(host);
    }
    return host;
  }

  /**
   * Arma la hoja: encabezado + filtros + resumen + clon del grid con las cards elegidas.
   * Los <canvas> se copian como imágenes (un clone() los deja en blanco) y todo lo interactivo
   * (botones, chips de orden, selectores) se descarta.
   */
  function buildSheet(opts) {
    const host = sheetHost();
    const grid = activeGrid();
    const width = Math.max(SHEET_MIN, Math.min(SHEET_MAX, Math.round(grid?.getBoundingClientRect().width || 1200)));

    const fl = opts.showFilters ? filterLines() : [];
    const filtersHTML = fl.length
      ? `<div class="gps-filters"><span class="k">${esc(T('gps_analysis.export_filters', 'Filters applied'))}</span>`
        + fl.map(f => `<span class="gps-fchip"><b>${esc(f.name)}:</b> ${esc(f.values)}</span>`).join('')
        + `</div>`
      : '';

    host.innerHTML =
      `<div class="gps-sheet" style="width:${width + SHEET_PAD * 2}px">
         <div class="gps-hd">
           <div class="gps-hd-l">${opts.crest ? `<img class="gps-crest" src="${esc(opts.crest)}" alt="">` : ''}
             <span class="gps-club">${esc(opts.clubName || '')}</span></div>
           <div class="gps-hd-c">
             <h1>${esc(opts.title || '')}</h1>
             <div class="gps-sub">${esc(opts.subtitle || '')}</div>
           </div>
           <div class="gps-hd-r"><span class="gps-dl">${esc(T('gps_analysis.export_date', 'Report date'))}</span>
             <span class="gps-dv">${esc(opts.dateLabel || '')}</span></div>
         </div>
         ${filtersHTML}
         ${opts.intro ? `<div class="gps-intro">${esc(opts.intro).replace(/\n/g, '<br>')}</div>` : ''}
         <div class="gps-cards"></div>
       </div>`;

    // Las cards se agrupan en BANDAS (las filas del dashboard: una card sola, o dos lado a lado).
    // Cada banda es un bloque independiente — así el PDF se arma bloque por bloque en vez de una
    // sola imagen gigantesca, que en dashboards largos revienta el límite de tamaño del canvas
    // (era el «Could not build the PDF»), y de paso ningún corte cae dentro de una card.
    const cardsHost = host.querySelector('.gps-cards');
    const items = opts.cards.map(c => {
      const el = c.el;
      const num = k => parseFloat(getComputedStyle(el).getPropertyValue(k));
      return { c, x: num('--gp-x'), y: num('--gp-y'), w: num('--gp-w'), h: el.getBoundingClientRect().height };
    });
    const free = items.every(i => isFinite(i.x) && isFinite(i.y) && isFinite(i.w));
    if (free) items.sort((a, b) => a.y - b.y || a.x - b.x);

    const bands = [];
    items.forEach(it => {
      const last = bands[bands.length - 1];
      // Entra en la banda abierta si arranca antes de que esa banda termine (están lado a lado).
      if (free && last && it.y < last.end - 0.5) { last.items.push(it); last.end = Math.max(last.end, it.y + (parseFloat(getComputedStyle(it.c.el).getPropertyValue('--gp-h')) || 1)); }
      else bands.push({ items: [it], end: free ? it.y + (parseFloat(getComputedStyle(it.c.el).getPropertyValue('--gp-h')) || 1) : 0 });
    });

    bands.forEach(band => {
      const row = document.createElement('div');
      row.className = 'gps-band';
      band.items.forEach(it => {
        const clone = it.c.el.cloneNode(true);
        bakeStyles(it.c.el, clone);      // primero: scrub borra nodos y desalinearía el recorrido
        copyCanvases(it.c.el, clone);
        scrub(clone);
        // Ancho proporcional a las columnas que ocupaba (flex-grow) y su alto real del dashboard.
        clone.style.flex = `${free ? it.w : 12} 1 0`;
        clone.style.maxWidth = 'none';
        clone.style.height = Math.round(it.h) + 'px';
        if (it.c.note) {
          const n = document.createElement('div');
          n.className = 'gps-note';
          n.textContent = it.c.note;
          clone.style.height = 'auto';        // la nota necesita su lugar bajo el gráfico
          clone.style.minHeight = Math.round(it.h) + 'px';
          clone.appendChild(n);
        }
        row.appendChild(clone);
      });
      cardsHost.appendChild(row);
    });
    const sheet = host.querySelector('.gps-sheet');
    inlineThemeVars(sheet);
    return sheet;
  }

  // html2canvas clona el documento en un iframe y ahí las custom properties del :root (los tokens
  // --cm-*) NO llegan: todo lo que la app pinta con var(--cm-fg-strong) o var(--cm-border) sale
  // fantasma y los acentos caen a su valor por defecto (las cards salían lavadas con borde verde).
  // Se copian sobre la hoja, y los tokens de superficie se fijan CLAROS para que el informe sea
  // imprimible aunque se esté trabajando en tema oscuro.
  const LIGHT = {
    '--cm-bg': '#FFFFFF', '--cm-bg-soft': '#FAFAF9', '--cm-bg-sunk': '#F4F4F2',
    '--cm-surface': '#FFFFFF', '--cm-surface-2': '#FAFAF9',
    '--cm-fg': '#0A0A0A', '--cm-fg-strong': '#000000', '--cm-fg-muted': '#6B7280', '--cm-fg-faint': '#9CA3AF',
    '--cm-border': '#E5E7EB', '--cm-border-soft': '#EFEFED', '--cm-border-strong': '#D4D4D2',
  };
  function inlineThemeVars(sheet) {
    const cs = getComputedStyle(document.documentElement);
    try {
      for (const name of cs) {
        if (name.startsWith('--cm-')) {
          const v = cs.getPropertyValue(name);
          if (v) sheet.style.setProperty(name, v.trim());
        }
      }
    } catch (_) { /* navegador que no itera custom props → quedan los del bloque claro */ }
    Object.entries(LIGHT).forEach(([k, v]) => sheet.style.setProperty(k, v));
  }

  // html2canvas re-resuelve el CSS en un iframe propio y ahí las clases + tokens de la app no
  // llegan igual: las cards salían fantasma (títulos casi invisibles, bordes verdes) mientras el
  // encabezado —escrito con colores fijos— salía perfecto. En vez de pelear con eso, el clon se
  // vuelve AUTOSUFICIENTE: se copian a estilo inline los valores ya computados del elemento real,
  // que es lo que se ve en pantalla. Deja de importar qué CSS entienda el capturador.
  const SAFE_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const SAFE_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const BAKE = ['color', 'background-color', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'border-top-width', 'border-right-width',
    'border-bottom-width', 'border-left-width', 'border-style', 'border-radius',
    'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'text-align', 'text-transform', 'text-decoration-line', 'opacity'];
  function bakeStyles(src, dst) {
    const a = document.createTreeWalker(src, NodeFilter.SHOW_ELEMENT);
    const b = document.createTreeWalker(dst, NodeFilter.SHOW_ELEMENT);
    const pair = (o, c) => {
      if (!o || !c) return;
      const cs = getComputedStyle(o);
      BAKE.forEach(k => { const v = cs.getPropertyValue(k); if (v) c.style.setProperty(k, v); });
      // La fuente NO se copia: html2canvas re-carga las webfonts dentro de su propio iframe y
      // mientras tanto dibuja el texto INVISIBLE (font-display: block). Con Geist las cards salían
      // fantasma; con la pila del sistema el texto se dibuja siempre. Se respeta si es monoespaciada.
      c.style.setProperty('font-family', /mono/i.test(cs.fontFamily) ? SAFE_MONO : SAFE_SANS);
      // Los degradados y sombras no aportan al informe impreso y son la otra fuente de artefactos.
      c.style.setProperty('background-image', 'none');
      c.style.setProperty('box-shadow', 'none');
    };
    pair(src, dst);
    let o = a.nextNode(), c = b.nextNode();
    while (o && c) { pair(o, c); o = a.nextNode(); c = b.nextNode(); }
  }

  /** Pasa el contenido pintado de cada <canvas> del original a un <img> en el clon (mismo orden). */
  function copyCanvases(src, dst) {
    const a = [...src.querySelectorAll('canvas')], b = [...dst.querySelectorAll('canvas')];
    b.forEach((cv, i) => {
      const orig = a[i];
      if (!orig) return;
      let url = '';
      try { url = orig.toDataURL('image/png'); } catch (_) { return; }
      const img = document.createElement('img');
      img.src = url;
      const r = orig.getBoundingClientRect();
      img.style.cssText = `width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;display:block`;
      cv.replaceWith(img);
    });
  }

  /** Saca del clon todo lo que es interfaz y no informe. */
  function scrub(el) {
    el.removeAttribute('id');
    el.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    el.querySelectorAll(
      'button, .gp-kpi-actions, .gp-c-actions, .size-toggle, .gp-sort-chip, .gp-zoom-chip,' +
      '.gp-c-picks, .gp-c-menu, .gp-add, [data-del], [contenteditable]'
    ).forEach(n => n.remove());
    el.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
  }

  // ── Exportar ────────────────────────────────────────────────────────────
  async function inlineImages(root) {
    const imgs = [...root.querySelectorAll('img')].filter(im => {
      const s = im.getAttribute('src') || '';
      return s && !s.startsWith('data:');
    });
    await Promise.all(imgs.map(async im => {
      try {
        const resp = await fetch(im.src, { mode: 'cors', cache: 'force-cache' });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
        });
        await new Promise(res => { im.onload = im.onerror = res; im.src = dataUrl; });
      } catch (_) { /* se queda con el src original */ }
    }));
  }

  /** Carga una librería por <script> si el CDN no la dejó lista al abrir la página. */
  function loadLib(src, check) {
    if (check()) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = src; sc.onload = () => (check() ? res() : rej(new Error('lib no disponible: ' + src)));
      sc.onerror = () => rej(new Error('no se pudo cargar ' + src));
      document.head.appendChild(sc);
    });
  }

  // ── Composición del PDF ─────────────────────────────────────────────────
  // NO se captura HTML: html2canvas re-resuelve el CSS de la app en un iframe propio y ahí los
  // textos chicos salen fantasma (medido: el título de una card se dibujaba en gris 240 sobre
  // blanco, mientras un texto de control salía negro). Se compone el informe directamente:
  // los textos con pdf.text —vectoriales, nítidos a cualquier zoom y seleccionables— y cada
  // gráfico con la imagen de SU canvas de Chart.js, que ya está pintado y no pasa por ningún
  // intermediario. Sale más fiel, más liviano y sin depender de un capturador.
  const PDF = {
    M: 10, FOOT: 12, GAP: 4, PAD: 3,            // mm
    fg: [15, 23, 42], muted: [100, 116, 139], faint: [148, 163, 184], line: [226, 232, 240],
  };
  const mmOf = (px, k) => px * k;

  function setFont(pdf, size, weight, color) {
    pdf.setFont('helvetica', weight || 'normal');
    pdf.setFontSize(size);
    const c = color || PDF.fg;
    pdf.setTextColor(c[0], c[1], c[2]);
  }
  /** Texto recortado a un ancho, con «…» — evita que un título largo pise al vecino. */
  function clip(pdf, txt, wmm) {
    let t = String(txt == null ? '' : txt).trim();
    if (!t) return '';
    if (pdf.getTextWidth(t) <= wmm) return t;
    while (t.length > 1 && pdf.getTextWidth(t + '…') > wmm) t = t.slice(0, -1);
    return t + '…';
  }

  /** Encabezado del informe. Devuelve el y (mm) donde sigue el contenido. */
  function drawHeader(pdf, opts, x, y, w) {
    const right = x + w;
    let textLeft = x;
    if (opts.crestData) {
      try { pdf.addImage(opts.crestData, 'PNG', x, y - 1, 11, 11); textLeft = x + 13; } catch (_) { /* sin escudo */ }
    }
    setFont(pdf, 9, 'bold');
    pdf.text(clip(pdf, opts.clubName, w * 0.28), textLeft, y + 5.5);

    setFont(pdf, 14, 'bold');
    pdf.text(clip(pdf, opts.title, w * 0.46), x + w / 2, y + 4, { align: 'center' });
    if (opts.subtitle) {
      setFont(pdf, 8.5, 'normal', PDF.muted);
      pdf.text(clip(pdf, opts.subtitle, w * 0.46), x + w / 2, y + 8.5, { align: 'center' });
    }
    setFont(pdf, 6, 'normal', PDF.faint);
    pdf.text(String(T('gps_analysis.export_date', 'Report date')).toUpperCase(), right, y + 1.5, { align: 'right' });
    setFont(pdf, 9, 'bold');
    pdf.text(opts.dateLabel || '', right, y + 6, { align: 'right' });

    let yy = y + 12;
    pdf.setDrawColor(15, 23, 42); pdf.setLineWidth(0.4);
    pdf.line(x, yy, right, yy);
    return yy + 5;
  }

  /** Bloque de filtros aplicados. Devuelve el nuevo y. */
  function drawFilters(pdf, lines, x, y, w) {
    if (!lines.length) return y;
    const parts = lines.map(f => `${f.name}: ${f.values}`);
    setFont(pdf, 7.5, 'normal', PDF.muted);
    const wrapped = pdf.splitTextToSize(parts.join('   ·   '), w - PDF.PAD * 2 - 20);
    const h = wrapped.length * 3.6 + 5;
    pdf.setFillColor(248, 250, 252); pdf.setDrawColor(...PDF.line); pdf.setLineWidth(0.2);
    pdf.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
    setFont(pdf, 5.8, 'bold', PDF.faint);
    pdf.text(String(T('gps_analysis.export_filters', 'Filters applied')).toUpperCase(), x + PDF.PAD, y + 4);
    setFont(pdf, 7.5, 'normal', PDF.muted);
    pdf.text(wrapped, x + PDF.PAD + 19, y + 4);
    return y + h + PDF.GAP;
  }

  /** Qué hay adentro de una card, para saber cómo dibujarla. */
  function cardKind(el) {
    if (el.querySelector('canvas')) return 'chart';
    if (el.querySelector('table')) return 'table';
    if (el.querySelector('.gp-kpi')) return 'kpi';
    return 'other';
  }

  /** Dibuja una card completa en (x,y) con ancho w; devuelve el alto usado en mm. */
  async function drawCard(pdf, card, x, y, w, k) {
    const el = card.el;
    const hpx = el.getBoundingClientRect().height;
    let h = Math.max(18, mmOf(hpx, k));

    const ttl = el.querySelector('.gp-c-h .ttl');
    const sub = el.querySelector('.gp-c-h .sub');
    const headH = ttl ? 7 : 0;

    // Marco
    pdf.setDrawColor(...PDF.line); pdf.setLineWidth(0.2); pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

    if (ttl) {
      setFont(pdf, 9, 'bold');
      const tw = pdf.getTextWidth(clip(pdf, ttl.textContent, w * 0.6));
      pdf.text(clip(pdf, ttl.textContent, w * 0.6), x + PDF.PAD, y + 5);
      if (sub && sub.textContent.trim()) {
        setFont(pdf, 7, 'normal', PDF.muted);
        pdf.text(clip(pdf, sub.textContent, w - tw - PDF.PAD * 3), x + PDF.PAD + tw + 2, y + 5);
      }
      pdf.setDrawColor(238, 242, 247);
      pdf.line(x, y + headH, x + w, y + headH);
    }

    const bodyY = y + headH + 1.5;
    const bodyH = h - headH - 3 - (card.note ? 6 : 0);
    const kind = cardKind(el);

    if (kind === 'chart') {
      const cv = el.querySelector('canvas');
      try {
        const url = cv.toDataURL('image/png');
        const r = cv.getBoundingClientRect();
        // Encaja el gráfico en la caja libre respetando su proporción.
        const boxW = w - PDF.PAD * 2, boxH = Math.max(8, bodyH);
        const ar = (r.height || 1) / (r.width || 1);
        let iw = boxW, ih = iw * ar;
        if (ih > boxH) { ih = boxH; iw = ih / ar; }
        pdf.addImage(url, 'PNG', x + (w - iw) / 2, bodyY, iw, ih);
      } catch (e) { console.warn('[gps export] gráfico omitido:', e); }
    } else if (kind === 'kpi') {
      drawKpi(pdf, el, x, bodyY, w, bodyH);
    } else if (kind === 'table') {
      drawTable(pdf, el.querySelector('table'), x, bodyY, w, bodyH);
    } else {
      // Texto suelto (estados «elegí un jugador», leyendas): al menos se lee.
      setFont(pdf, 8, 'normal', PDF.muted);
      const txt = (el.querySelector('.gp-c-b')?.innerText || '').trim().split('\n').filter(Boolean).slice(0, 6).join(' · ');
      if (txt) pdf.text(pdf.splitTextToSize(txt, w - PDF.PAD * 2), x + PDF.PAD, bodyY + 4);
    }

    if (card.note) {
      const ny = y + h - 3.5;
      pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5);
      pdf.line(x + PDF.PAD, ny - 3, x + PDF.PAD, ny + 0.5);
      setFont(pdf, 7.5, 'normal', PDF.muted);
      pdf.text(clip(pdf, card.note, w - PDF.PAD * 2 - 2), x + PDF.PAD + 1.5, ny);
    }
    return h;
  }

  /** KPI: el número grande y su etiqueta, tal como se leen en pantalla. */
  function drawKpi(pdf, el, x, y, w, h) {
    const tiles = [...el.querySelectorAll('.gp-kpi')];
    const list = tiles.length ? tiles : [el];
    const cw = w / list.length;
    list.forEach((t, i) => {
      const v = (t.querySelector('.v')?.textContent || t.querySelector('.value')?.textContent || '').trim();
      const l = (t.querySelector('.l')?.textContent || t.querySelector('.k')?.textContent || '').trim();
      const cx = x + cw * i + cw / 2;
      setFont(pdf, Math.min(18, Math.max(10, h * 0.42)), 'bold');
      if (v) pdf.text(clip(pdf, v, cw - 4), cx, y + h / 2 + 1, { align: 'center' });
      if (l) { setFont(pdf, 7, 'normal', PDF.muted); pdf.text(clip(pdf, l, cw - 4), cx, y + h / 2 + 6, { align: 'center' }); }
    });
  }

  /** Tabla: se redibuja fila por fila (texto real, no una foto). */
  function drawTable(pdf, table, x, y, w, h) {
    if (!table) return;
    const head = [...table.querySelectorAll('thead th')].map(t => t.innerText.trim());
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.innerText.trim()));
    if (!head.length && !rows.length) return;
    const cols = Math.max(head.length, rows[0]?.length || 0);
    if (!cols) return;
    const rowH = 4.2, avail = Math.max(0, h - 2);
    const maxRows = Math.max(0, Math.floor(avail / rowH) - 1);
    const cw = (w - PDF.PAD * 2) / cols;
    let yy = y + 3.5;
    if (head.length) {
      setFont(pdf, 6.2, 'bold', PDF.muted);
      head.forEach((t, i) => pdf.text(clip(pdf, t.toUpperCase(), cw - 1), x + PDF.PAD + cw * i, yy));
      pdf.setDrawColor(...PDF.line); pdf.setLineWidth(0.2);
      pdf.line(x + PDF.PAD, yy + 1.2, x + w - PDF.PAD, yy + 1.2);
      yy += rowH;
    }
    rows.slice(0, maxRows).forEach((r, ri) => {
      if (ri % 2) { pdf.setFillColor(250, 250, 249); pdf.rect(x + PDF.PAD - 0.5, yy - 3, w - PDF.PAD * 2 + 1, rowH, 'F'); }
      setFont(pdf, 6.6, 'normal');
      r.slice(0, cols).forEach((t, i) => pdf.text(clip(pdf, t, cw - 1), x + PDF.PAD + cw * i, yy));
      yy += rowH;
    });
    if (rows.length > maxRows) {
      setFont(pdf, 6.2, 'normal', PDF.faint);
      pdf.text(T('gps_analysis.export_rows_more', '+{n} more rows', { n: rows.length - maxRows }), x + PDF.PAD, yy);
    }
  }

  /** Escudo del club → data URI (jsPDF no acepta una URL remota). */
  async function crestData(url) {
    if (!url) return '';
    try {
      const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!resp.ok) return '';
      const blob = await resp.blob();
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(blob); });
    } catch (_) { return ''; }
  }

  async function exportPdf(opts) {
    await loadLib('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => !!(window.jspdf && window.jspdf.jsPDF));
    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF({ orientation: opts.orientation, unit: 'mm', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const x0 = PDF.M, contentW = pageW - PDF.M * 2, bottom = pageH - PDF.FOOT;

    opts.crestData = await crestData(opts.crest);
    let y = drawHeader(pdf, opts, x0, PDF.M + 2, contentW);
    if (opts.showFilters) y = drawFilters(pdf, filterLines(), x0, y, contentW);
    if (opts.intro) {
      setFont(pdf, 8.5, 'normal', [51, 65, 85]);
      const lines = pdf.splitTextToSize(opts.intro, contentW);
      pdf.text(lines, x0, y + 3);
      y += lines.length * 4 + PDF.GAP;
    }

    // Escala px→mm tomada del ancho del grid, para que las cards guarden su proporción real.
    const gridW = activeGrid()?.getBoundingClientRect().width || 1200;
    const k = contentW / gridW;

    for (const band of bandsOf(opts.cards)) {
      const hs = band.map(c => Math.max(18, mmOf(c.el.getBoundingClientRect().height, k)));
      const bandH = Math.max(...hs);
      if (y + bandH > bottom && y > PDF.M + 2) { pdf.addPage(); y = PDF.M + 2; }
      let cx = x0;
      const totalW = band.reduce((n, c) => n + (isFinite(c.w) ? c.w : 12), 0);
      for (const c of band) {
        const cwCols = isFinite(c.w) ? c.w : 12;
        const cw = (contentW - PDF.GAP * (band.length - 1)) * (cwCols / Math.max(totalW, cwCols));
        await drawCard(pdf, c, cx, y, cw, k);
        cx += cw + PDF.GAP;
      }
      y += bandH + PDF.GAP;
    }

    const total = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) { pdf.setPage(p); drawFooter(pdf, pageW, pageH, p, total, opts); }
    // Resumen de lo que se dibujó — lo leen los tests y sirve para diagnosticar un informe raro.
    window.__gxLast = { pages: total, cards: opts.cards.length,
      kinds: opts.cards.reduce((a, c) => { const k = cardKind(c.el); a[k] = (a[k] || 0) + 1; return a; }, {}) };
    pdf.save(fileName(opts));
  }

  /** Agrupa las cards elegidas en filas del dashboard (una sola, o dos lado a lado). */
  function bandsOf(cards) {
    const num = (el, key) => parseFloat(getComputedStyle(el).getPropertyValue(key));
    const items = cards.map(c => ({ ...c, x: num(c.el, '--gp-x'), y: num(c.el, '--gp-y'),
      w: num(c.el, '--gp-w'), h: num(c.el, '--gp-h') }));
    const free = items.every(i => isFinite(i.x) && isFinite(i.y) && isFinite(i.w) && isFinite(i.h));
    if (!free) return items.map(i => [i]);
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const out = [];
    let end = -1;
    items.forEach(it => {
      if (out.length && it.y < end - 0.5) { out[out.length - 1].push(it); end = Math.max(end, it.y + it.h); }
      else { out.push([it]); end = it.y + it.h; }
    });
    return out;
  }

  /** Pie de página VECTORIAL (no se pixela): marca a la izquierda, título al centro, página a la derecha. */
  function drawFooter(pdf, pageW, pageH, page, total, opts) {
    const y = pageH - 5;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(8, y - 4.5, pageW - 8, y - 4.5);
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 130, 145);
    pdf.text('ClavaMetrics · clavametrics.app', 8, y);
    const mid = [opts.title, opts.dateLabel].filter(Boolean).join(' · ');
    if (mid) pdf.text(mid, pageW / 2, y, { align: 'center', maxWidth: pageW - 70 });
    pdf.text(`${page}/${total}`, pageW - 8, y, { align: 'right' });
  }

  function fileName(opts) {
    const slug = String(opts.title || 'gps-report').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'gps-report';
    return `${opts.dateISO || ''}_${slug}.pdf`.replace(/^_/, '');
  }

  /** Impresión nativa: la misma hoja, visible, con todo lo demás oculto por CSS. */
  function printSheet(opts) {
    const host = sheetHost();
    buildSheet(opts);
    host.style.cssText = 'display:block';
    document.body.classList.add('gps-printing');
    const done = () => {
      document.body.classList.remove('gps-printing');
      host.style.cssText = ''; host.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 120);
  }

  // ── Modal ───────────────────────────────────────────────────────────────
  function todayISO() {
    return (window.cmToday ? window.cmToday() : new Date().toISOString().slice(0, 10));
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    const loc = (window.CM_I18N && CM_I18N.lang) ? CM_I18N.lang : (document.documentElement.lang || 'es');
    try { return dt.toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch (_) { return iso; }
  }

  async function openExportModal() {
    const grid = activeGrid();
    const cards = cardsOf(grid);
    if (!cards.length) {
      window.showToast?.(T('gps_analysis.export_no_cards', 'This dashboard has no cards to export yet.'), true);
      return;
    }
    let club = null;
    try { club = await window.getClub?.(); } catch (_) { /* sin club → informe sin escudo */ }

    // Título por defecto = el dashboard; el equipo y el rango van al subtítulo (repetirlos arriba
    // no agrega nada y el título centrado se estira).
    const defTitle = dashName();
    const dateRange = (filterLines().find(f => f.key === 'date') || {}).values || '';
    const subtitle = [teamName(), dateRange].filter(Boolean).join(' · ');
    const fl = filterLines();
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    const ov = window.makeModal(T('gps_analysis.export_title', 'Export report'),
      `<div id="gxBody" style="min-width:0">
         <div class="gx-row">
           <label class="gx-f" style="flex:1 1 260px"><span class="gx-l">${T('gps_analysis.export_rep_title', 'Report title')}</span>
             <input type="text" id="gxTitle" class="gx-in" value="${esc(defTitle)}"></label>
           <label class="gx-f" style="flex:0 0 160px"><span class="gx-l">${T('gps_analysis.export_date', 'Report date')}</span>
             <input type="date" id="gxDate" class="gx-in" value="${todayISO()}"></label>
         </div>
         <label class="gx-f"><span class="gx-l">${T('gps_analysis.export_intro', 'Summary (optional)')}</span>
           <textarea id="gxIntro" class="gx-in" rows="2" placeholder="${esc(T('gps_analysis.export_intro_ph', 'e.g. Comparison between microcycle 3 and 4 — volume down, intensity held.'))}"></textarea></label>
         <div class="gx-l" style="margin-top:14px">${T('gps_analysis.export_cards', 'Cards in the report')}
           <span class="gx-hint">${T('gps_analysis.export_cards_hint', 'in the order of your dashboard · a note under each one is optional')}</span></div>
         <div class="gx-cards" id="gxCards">
           ${cards.map((c, i) => `<div class="gx-card">
             <label class="gx-ck"><input type="checkbox" data-gx-on="${i}"${c.empty ? '' : ' checked'}><span>${esc(c.title)}${c.empty ? ` <i class="gx-nod">${esc(T('gps_analysis.export_no_data', '· no data'))}</i>` : ''}</span></label>
             <input type="text" class="gx-in sm" data-gx-note="${i}" placeholder="${esc(T('gps_analysis.export_note_ph', 'Note under this chart…'))}">
           </div>`).join('')}
         </div>
         <div class="gx-l" style="margin-top:14px">${T('gps_analysis.export_options', 'Options')}</div>
         <div class="gx-row">
           <label class="gx-ck"><input type="checkbox" id="gxCrest" checked><span>${T('gps_analysis.export_crest', 'Club crest')}</span></label>
           <label class="gx-ck"><input type="checkbox" id="gxFilters" ${fl.length ? 'checked' : 'disabled'}><span>${T('gps_analysis.export_filters_opt', 'Filters applied')}${fl.length ? '' : ' —'}</span></label>
           <div class="mgp-seg" id="gxOrient" style="margin-left:auto">
             <button type="button" data-o="portrait" class="is-on">${T('gps_analysis.export_portrait', 'Portrait')}</button>
             <button type="button" data-o="landscape">${T('gps_analysis.export_landscape', 'Landscape')}</button>
           </div>
         </div>
         ${dark ? `<div class="gx-warn"><i class="ti ti-alert-triangle"></i>${T('gps_analysis.export_dark_warn', 'You are on the dark theme: the charts export with their dark colours. Switch to the light theme for a printable report.')}</div>` : ''}
         <div class="gx-foot">
           <button class="cm-btn is-ghost is-sm" id="gxCancel">${T('common.cancel', 'Cancel')}</button>
           <button class="cm-btn is-outline is-sm" id="gxPrint"><i class="ti ti-printer"></i>${T('common.print', 'Print')}</button>
           <button class="cm-btn is-primary is-sm" id="gxPdf"><i class="ti ti-file-type-pdf"></i>${T('gps_analysis.export_pdf', 'Export PDF')}</button>
         </div>
       </div>`);

    const body = ov.querySelector('#gxBody');
    // .gp-modal mide 560 px fijos y este contenido (dos columnas de cards + notas) no entra:
    // los controles de la derecha quedaban cortados.
    const shell = ov.querySelector('.gp-modal');
    if (shell) { shell.style.width = '720px'; shell.style.maxWidth = '95vw'; }
    let orientation = 'portrait';
    body.querySelectorAll('#gxOrient button').forEach(b => b.addEventListener('click', () => {
      orientation = b.dataset.o;
      body.querySelectorAll('#gxOrient button').forEach(x => x.classList.toggle('is-on', x === b));
    }));

    const collect = () => ({
      title: body.querySelector('#gxTitle').value.trim() || defTitle,
      dateISO: body.querySelector('#gxDate').value,
      dateLabel: fmtDate(body.querySelector('#gxDate').value),
      intro: body.querySelector('#gxIntro').value.trim(),
      crest: body.querySelector('#gxCrest').checked ? (club?.logo_url || '') : '',
      clubName: club?.name || '',
      subtitle,
      showFilters: body.querySelector('#gxFilters').checked,
      orientation,
      cards: cards.map((c, i) => ({ ...c, note: (body.querySelector(`[data-gx-note="${i}"]`)?.value || '').trim() }))
        .filter((_, i) => body.querySelector(`[data-gx-on="${i}"]`)?.checked),
    });

    body.querySelector('#gxCancel').addEventListener('click', () => ov.remove());
    body.querySelector('#gxPrint').addEventListener('click', () => {
      const o = collect();
      if (!o.cards.length) { window.showToast?.(T('gps_analysis.export_pick_one', 'Pick at least one card.'), true); return; }
      ov.remove();
      printSheet(o);
    });
    body.querySelector('#gxPdf').addEventListener('click', async (e) => {
      const o = collect();
      if (!o.cards.length) { window.showToast?.(T('gps_analysis.export_pick_one', 'Pick at least one card.'), true); return; }
      const btn = e.currentTarget;
      const old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="ti ti-loader-2"></i>${T('gps_analysis.export_generating', 'Generating…')}`;
      try {
        await exportPdf(o);
        ov.remove();
      } catch (err) {
        console.error('[gps export]', err);
        window.showToast?.(T('gps_analysis.export_failed', 'Could not build the PDF. Try Print → Save as PDF.')
          + ' [' + ((err && err.message) ? err.message : err) + ']', true);
        btn.disabled = false; btn.innerHTML = old;
      }
    });
  }

  window.gpOpenExportModal = openExportModal;
  window.__gxBuild = buildSheet;      // expuesto para los tests (arma la hoja sin generar el PDF)
  document.getElementById('gpExportBtn')?.addEventListener('click', openExportModal);
})();
