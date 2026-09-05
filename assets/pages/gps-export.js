/* ─────────────────────────────────────────────────────────────────────────
   gps-export.js — informe PDF / impresión de GPS Analysis.

   Exporta LAS CARDS del dashboard activo, no la página: sin sidebar, sin barra
   de filtros, sin botones. El layout es el que armó el usuario en su dashboard
   (mismas posiciones y tamaños), porque ese orden ES la lectura que quiso darle.

   El informe se COMPONE con jsPDF: los textos con pdf.text (vectoriales, nítidos
   y seleccionables), cada gráfico con la imagen de su canvas de Chart.js, y lo que no es
   canvas —una tabla con formato condicional, un gauge— redibujado con sus propios colores
   leídos del DOM, para que la hoja diga lo mismo que la pantalla. NO se
   captura la pantalla — clonar las cards a una hoja HTML da textos fantasma
   (probado a fondo: ver la memoria del proyecto), así que Imprimir y Exportar
   usan el MISMO camino: uno abre el visor con el diálogo listo, el otro descarga.
   jsPDF se baja recién al pulsar el botón, para no cargar nada en el arranque.
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

  /** Carga jsPDF por <script> la primera vez que se exporta (nada pesa en el arranque). */
  function loadLib(src, check) {
    if (check()) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = () => (check() ? res() : rej(new Error('lib no disponible: ' + src)));
      sc.onerror = () => rej(new Error('no se pudo cargar ' + src));
      document.head.appendChild(sc);
    });
  }

  // ── Color ───────────────────────────────────────────────────────────────
  // getComputedStyle YA resuelve var(), color-mix() y demás, pero devuelve formatos que jsPDF
  // no entiende (oklab(), color(srgb …)). El canvas sí los entiende: se pinta un píxel y se lee.
  // Así el informe hereda EXACTAMENTE el color que el usuario ve en la tabla o en el gauge.
  let _cx2d = null;
  function rgbOf(css, fb) {
    const def = fb || null;
    const v = String(css == null ? '' : css).trim();
    if (!v || v === 'none' || v === 'transparent') return def;
    try {
      if (!_cx2d) {
        const c = document.createElement('canvas'); c.width = c.height = 1;
        _cx2d = c.getContext('2d', { willReadFrequently: true });
      }
      _cx2d.fillStyle = '#010203';                       // centinela: un color inválido no lo pisa
      _cx2d.fillStyle = v;
      if (_cx2d.fillStyle === '#010203' && !/010203/i.test(v)) return def;
      _cx2d.clearRect(0, 0, 1, 1);
      _cx2d.fillRect(0, 0, 1, 1);
      const d = _cx2d.getImageData(0, 0, 1, 1).data;
      if (!d[3]) return def;
      const a = d[3] / 255;                              // compuesto sobre el blanco de la hoja
      return [0, 1, 2].map(i => Math.round(d[i] * a + 255 * (1 - a)));
    } catch (_) { return def; }
  }
  /** Color de una propiedad de un elemento, con su opacity ya aplicada sobre blanco. */
  function elColor(el, prop, fb) {
    if (!el) return fb || null;
    const cs = getComputedStyle(el);
    const c = rgbOf(cs[prop], null);
    if (!c) return fb || null;
    const op = parseFloat(cs.opacity);
    return (isFinite(op) && op < 1) ? c.map(v => Math.round(v * op + 255 * (1 - op))) : c;
  }
  const isWhite = c => !!c && c[0] > 250 && c[1] > 250 && c[2] > 250;
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  /** Un color pensado para fondo oscuro no se lee sobre la hoja blanca: en tema oscuro
   *  los textos vienen casi blancos, así que ahí se cae al color del informe. */
  const onWhite = (c, fb) => (c && lum(c) < 205) ? c : (fb || PDF.fg);

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
    // El gauge va primero: es un SVG, no un canvas, y antes caía en «texto suelto».
    if (el.querySelector('.gp-gauges-row svg, .gp-gauge svg')) return 'gauge';
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
    } else if (kind === 'gauge') {
      drawGauge(pdf, el, x, bodyY, w, bodyH, k);
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

  /**
   * Lee UNA celda como se VE en pantalla: su texto, su alineación y el color que lleva encima.
   * Los formatos condicionales de la tabla (heat / bar / pct / icon) y las celdas del heatmap
   * son parte de la lectura, no decoración: sin ellos el informe pierde la mitad del mensaje.
   */
  function cellInfo(td) {
    const cs = getComputedStyle(td);
    const out = { text: (td.innerText || '').trim(), align: cs.textAlign || 'left',
      fg: elColor(td, 'color', null), bg: null, bar: null, dot: null, shape: 'dot' };
    const chip = td.querySelector('.tf-c, .gp-zc');
    if (!chip) return out;
    const val = chip.querySelector('.tf-val');
    out.text = ((val ? val.innerText : chip.innerText) || '').trim();
    out.fg = elColor(val || chip, 'color', out.fg);
    const cls = chip.classList;
    if (cls.contains('bar') || cls.contains('pct')) {
      const fill = chip.querySelector('.tf-fill, .tf-track > span');
      const pct = fill ? parseFloat(fill.style.width) : NaN;
      out.bar = {
        pct: isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0,
        color: elColor(fill, 'backgroundColor', [148, 163, 184]),
        track: rgbOf(getComputedStyle(cls.contains('pct') ? (chip.querySelector('.tf-track') || chip) : chip).backgroundColor, null),
        thin: cls.contains('pct'),      // pct = riel fino al lado del número; bar = barra de fondo
      };
      return out;
    }
    const dot = chip.querySelector('.tf-dot');
    const ico = chip.querySelector('.ti');
    if (dot || ico) {
      out.dot = elColor(dot || ico, dot ? 'backgroundColor' : 'color', null);
      // El formato «icono» viene como punto o como flecha de tendencia: se dibuja la misma
      // figura, porque la forma es parte de la lectura (sube / se mantiene / baja).
      const ic = ico ? ico.className : '';
      out.shape = dot ? 'dot'
        : /trending-up|arrow-up/.test(ic) ? 'up'
        : /trending-down|arrow-down/.test(ic) ? 'down'
        : /minus/.test(ic) ? 'flat'
        : /alert-triangle/.test(ic) ? 'warn' : 'dot';
    }
    const bg = rgbOf(getComputedStyle(chip).backgroundColor, null);
    if (bg && !isWhite(bg)) out.bg = bg;
    return out;
  }

  /** Punto / flecha de tendencia del formato «icono», centrado en (x, y). */
  function drawStatus(pdf, shape, color, x, y) {
    const c = color || [148, 163, 184];
    if (shape === 'dot' || shape === 'warn') {
      pdf.setFillColor(c[0], c[1], c[2]);
      pdf.circle(x + 0.7, y, 0.6, 'F');
      return;
    }
    pdf.setDrawColor(c[0], c[1], c[2]);
    pdf.setLineWidth(0.35); pdf.setLineCap('round');
    if (shape === 'flat') pdf.line(x, y, x + 1.6, y);
    else {
      const dy = shape === 'up' ? -0.8 : 0.8;
      pdf.line(x, y - dy / 2, x + 1.6, y + dy / 2);
      pdf.line(x + 1.6, y + dy / 2, x + 1.0, y + dy / 2);     // puntita de la flecha
      pdf.line(x + 1.6, y + dy / 2, x + 1.6, y - dy / 2 + dy * 0.6);
    }
    pdf.setLineCap('butt'); pdf.setLineWidth(0.2);
  }

  /** Tabla: se redibuja fila por fila (texto real, no una foto) CON sus colores. */
  function drawTable(pdf, table, x, y, w, h) {
    if (!table) return;
    const ths  = [...table.querySelectorAll('thead th')];
    const head = ths.map(t => t.innerText.trim());
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(cellInfo));
    if (!head.length && !rows.length) return;
    const cols = Math.max(head.length, rows[0]?.length || 0);
    if (!cols) return;

    const inner = w - PDF.PAD * 2;
    // Anchos PROPORCIONALES a los de pantalla: ahí la columna del jugador es ancha y las de
    // enteros angostas. Repartir en partes iguales recortaba los nombres («PHARAN…») para
    // regalarle espacio a una columna de tres cifras.
    const px  = Array.from({ length: cols }, (_, i) => (ths[i] ? ths[i].getBoundingClientRect().width : 0));
    const tot = px.reduce((a, b) => a + b, 0);
    let cw = tot > 0 ? px.map(v => Math.max(inner * 0.045, inner * v / tot)) : Array(cols).fill(inner / cols);
    const sum = cw.reduce((a, b) => a + b, 0);
    if (sum > 0 && sum !== inner) cw = cw.map(v => v * inner / sum);
    const cx = []; let acc = x + PDF.PAD;
    for (let i = 0; i < cols; i++) { cx.push(acc); acc += cw[i]; }

    const PADC = 0.8;
    const put = (txt, i, yy, al) => {
      const t = clip(pdf, txt, cw[i] - PADC * 2);
      if (!t) return;
      if (al === 'right')       pdf.text(t, cx[i] + cw[i] - PADC, yy, { align: 'right' });
      else if (al === 'center') pdf.text(t, cx[i] + cw[i] / 2, yy, { align: 'center' });
      else                      pdf.text(t, cx[i] + PADC, yy);
    };

    const rowH = 4.2, avail = Math.max(0, h - 2);
    const maxRows = Math.max(0, Math.floor(avail / rowH) - 1);
    let yy = y + 3.5;
    if (head.length) {
      setFont(pdf, 6.2, 'bold', PDF.muted);
      head.forEach((t, i) => put(t.toUpperCase(), i, yy, (ths[i] && getComputedStyle(ths[i]).textAlign) || 'left'));
      pdf.setDrawColor(...PDF.line); pdf.setLineWidth(0.2);
      pdf.line(x + PDF.PAD, yy + 1.2, x + w - PDF.PAD, yy + 1.2);
      yy += rowH;
    }
    rows.slice(0, maxRows).forEach((r, ri) => {
      if (ri % 2) { pdf.setFillColor(250, 250, 249); pdf.rect(x + PDF.PAD - 0.5, yy - 3, w - PDF.PAD * 2 + 1, rowH, 'F'); }
      r.slice(0, cols).forEach((c, i) => {
        const bx = cx[i] + 0.4, bw = Math.max(1, cw[i] - 0.8), top = yy - 2.8, bh = 3.5;
        // Sobre un chip de color el texto va con SU color (el blanco de un heatmap saturado
        // es intencional); suelto sobre la hoja, sólo si se lee.
        setFont(pdf, 6.6, 'normal', c.bg ? (c.fg || PDF.fg) : onWhite(c.fg, PDF.fg));
        const txt = clip(pdf, c.text, cw[i] - (c.dot ? 3 : PADC * 2));
        const tw  = pdf.getTextWidth(txt);
        if (c.bar) {
          if (c.bar.thin) {                    // riel fino + número a la derecha, como en pantalla
            const rw = Math.max(3, bw - tw - 1.2);
            if (c.bar.track) { pdf.setFillColor(...c.bar.track); pdf.roundedRect(bx, yy - 1.9, rw, 1.3, 0.65, 0.65, 'F'); }
            if (c.bar.pct > 0) { pdf.setFillColor(...c.bar.color); pdf.roundedRect(bx, yy - 1.9, Math.max(0.7, rw * c.bar.pct / 100), 1.3, 0.65, 0.65, 'F'); }
          } else {
            if (c.bar.track) { pdf.setFillColor(...c.bar.track); pdf.roundedRect(bx, top, bw, bh, 0.8, 0.8, 'F'); }
            if (c.bar.pct > 0) { pdf.setFillColor(...c.bar.color); pdf.roundedRect(bx, top, Math.max(0.8, bw * c.bar.pct / 100), bh, 0.8, 0.8, 'F'); }
          }
        } else if (c.bg) {
          pdf.setFillColor(...c.bg);
          pdf.roundedRect(bx, top, bw, bh, 0.8, 0.8, 'F');
        }
        if (c.dot) {                                          // punto/flecha de estado + número
          const sx = cx[i] + cw[i] / 2 - (tw + 2.6) / 2;
          drawStatus(pdf, c.shape, c.dot, sx, yy - 0.9);
          pdf.text(txt, sx + 2.6, yy);
        } else {
          put(c.text, i, yy, c.bar ? 'right' : c.bg ? 'center' : c.align);
        }
      });
      yy += rowH;
    });
    if (rows.length > maxRows) {
      setFont(pdf, 6.2, 'normal', PDF.faint);
      pdf.text(T('gps_analysis.export_rows_more', '+{n} more rows', { n: rows.length - maxRows }), x + PDF.PAD, yy);
    }
  }

  // ── Gauges ──────────────────────────────────────────────────────────────
  // El gauge del dashboard es un SVG (arcos + aguja + textos), no un canvas de Chart.js: no hay
  // bitmap que copiar. Se REDIBUJA vectorial leyendo el propio SVG del DOM — la geometría la
  // muestrea el navegador (getPointAtLength) y los colores salen de getComputedStyle, así que
  // el informe muestra el mismo arco, la misma aguja y el mismo número que la pantalla.

  /** Muestrea un <path> en puntos del viewBox. */
  function samplePath(p, step) {
    let len = 0;
    try { len = p.getTotalLength(); } catch (_) { return []; }
    if (!(len > 0)) return [];
    const n = Math.max(2, Math.min(400, Math.ceil(len / (step || 2))));
    const out = [];
    for (let i = 0; i <= n; i++) { const pt = p.getPointAtLength(len * i / n); out.push([pt.x, pt.y]); }
    return out;
  }

  /** Stops de un <linearGradient> referenciado con url(#id) → [{off, c:[r,g,b]}]. */
  function gradStops(svg, ref) {
    const id = (String(ref).match(/url\(["']?#([^"')]+)/) || [])[1];
    if (!id) return null;
    let g = null;
    try { g = svg.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(id) : id)); } catch (_) { return null; }
    if (!g) return null;
    const st = [...g.querySelectorAll('stop')].map(n => {
      const raw = String(n.getAttribute('offset') || '0');
      const num = parseFloat(raw) || 0;
      return { off: raw.includes('%') ? num / 100 : num,
        c: rgbOf(getComputedStyle(n).stopColor || n.getAttribute('stop-color'), [148, 163, 184]) };
    });
    return st.length ? st : null;
  }
  function stopAt(stops, t) {
    t = Math.max(0, Math.min(1, t));
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].off && t <= stops[i + 1].off) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const d = (b.off - a.off) || 1, k = (t - a.off) / d;
    return [0, 1, 2].map(i => Math.round(a.c[i] + (b.c[i] - a.c[i]) * k));
  }

  /** Dibuja un SVG (arcos, aguja, textos) dentro de la caja dada. Devuelve el alto usado en mm. */
  function drawSvg(pdf, svg, x, y, w, h) {
    const vb = String(svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(v => !isFinite(v))) return 0;
    const [vx, vy, vw, vh] = vb;
    const s = Math.min(w / vw, h / vh);
    if (!(s > 0) || !(vw > 0) || !(vh > 0)) return 0;
    const ox = x + (w - vw * s) / 2, oy = y;
    const X = px => ox + (px - vx) * s, Y = py => oy + (py - vy) * s;
    const at = (el, k, d) => { const v = parseFloat(el.getAttribute(k)); return isFinite(v) ? v : (d || 0); };

    [...svg.querySelectorAll('path, line, circle, text')].forEach(el => {
      const cs = getComputedStyle(el);
      const tag = el.tagName.toLowerCase();
      if (tag === 'text') {
        const t = (el.textContent || '').trim();
        if (!t) return;
        const fs = parseFloat(cs.fontSize) || 10;
        const bold = (parseInt(cs.fontWeight, 10) || 400) >= 600;
        setFont(pdf, fs * s / 0.3528, bold ? 'bold' : 'normal', onWhite(elColor(el, 'fill', PDF.fg), PDF.fg));
        const an = cs.textAnchor || el.getAttribute('text-anchor') || 'start';
        pdf.text(t, X(at(el, 'x')), Y(at(el, 'y')),
          { align: an === 'middle' ? 'center' : an === 'end' ? 'right' : 'left' });
        return;
      }
      if (tag === 'circle') {
        const f0 = elColor(el, 'fill', null);
        if (!f0) return;
        const f = onWhite(f0, PDF.fg);
        pdf.setFillColor(f[0], f[1], f[2]);
        pdf.circle(X(at(el, 'cx')), Y(at(el, 'cy')), at(el, 'r') * s, 'F');
        return;
      }
      pdf.setLineWidth((parseFloat(cs.strokeWidth) || 1) * s);
      pdf.setLineJoin('round');
      if (tag === 'line') {
        const c = onWhite(elColor(el, 'stroke', PDF.fg), PDF.fg);
        pdf.setLineCap('round');
        pdf.setDrawColor(c[0], c[1], c[2]);
        pdf.line(X(at(el, 'x1')), Y(at(el, 'y1')), X(at(el, 'x2')), Y(at(el, 'y2')));
        return;
      }
      const pts = samplePath(el, 1.4);
      if (pts.length < 2) return;
      const raw = cs.stroke || el.getAttribute('stroke') || '';
      const stops = /url\(/.test(raw) ? gradStops(svg, raw) : null;
      if (stops) {
        // Degradado: tramo a tramo con su color interpolado (jsPDF no tiene gradientes de trazo).
        let bb = null;
        try { bb = el.getBBox(); } catch (_) { bb = null; }
        // Cap PLANO como en pantalla (un cap redondo alargaría el arco medio trazo en cada
        // punta); los tramos se solapan un poco entre sí para que no queden costuras.
        pdf.setLineCap('butt');
        for (let i = 0; i < pts.length - 1; i++) {
          const mid = (pts[i][0] + pts[i + 1][0]) / 2;
          const c = stopAt(stops, (bb && bb.width) ? (mid - bb.x) / bb.width : 0.5);
          pdf.setDrawColor(c[0], c[1], c[2]);
          const x1 = X(pts[i][0]), y1 = Y(pts[i][1]);
          const x2 = X(pts[i + 1][0]), y2 = Y(pts[i + 1][1]);
          const over = i < pts.length - 2 ? 1.6 : 1;      // el último tramo no se pasa del arco
          pdf.line(x1, y1, x1 + (x2 - x1) * over, y1 + (y2 - y1) * over);
        }
      } else {
        const c = elColor(el, 'stroke', PDF.line);
        pdf.setDrawColor(c[0], c[1], c[2]);
        pdf.setLineCap('butt');
        const d = [];
        for (let i = 1; i < pts.length; i++) {
          d.push([X(pts[i][0]) - X(pts[i - 1][0]), Y(pts[i][1]) - Y(pts[i - 1][1])]);
        }
        pdf.lines(d, X(pts[0][0]), Y(pts[0][1]), [1, 1], 'S');
      }
    });
    pdf.setLineCap('butt');
    pdf.setLineWidth(0.2);
    return vh * s;
  }

  /** Card de gauge(s): el título propio del cuerpo, la fila de gauges y su línea de comparación.
   *  `k` = mm por píxel de pantalla: el gauge se dibuja del MISMO tamaño que se ve (en la app
   *  nunca pasa de ~180 px de ancho); estirarlo a la columna entera agrandaba las etiquetas. */
  function drawGauge(pdf, el, x, y, w, h, k) {
    const body = el.querySelector('.gp-c-b') || el;
    let top = y;
    const l  = body.querySelector(':scope > .l');
    const sb = body.querySelector(':scope > .sb');
    // El gauge de una sola métrica lleva su título DENTRO del cuerpo (la cabecera se le quita,
    // como al KPI): sin esto la card salía sin nombre.
    const head = (el, size, weight, color, dy) => {
      const t = el && el.innerText.trim();
      if (!t) return 0;
      setFont(pdf, size, weight, color);
      const al = getComputedStyle(el).textAlign;
      const txt = clip(pdf, t, w - PDF.PAD * 2);
      if (al === 'center')     pdf.text(txt, x + w / 2, top + dy, { align: 'center' });
      else if (al === 'right') pdf.text(txt, x + w - PDF.PAD, top + dy, { align: 'right' });
      else                     pdf.text(txt, x + PDF.PAD, top + dy);
      return 1;
    };
    if (head(l, 9, 'bold', PDF.fg, 4)) top += 5.4;
    if (head(sb, 7, 'normal', PDF.muted, 2.8)) top += 4.2;
    let wraps = [...el.querySelectorAll('.gp-gauge-wrap')];
    if (!wraps.length) wraps = [...el.querySelectorAll('svg')];
    if (!wraps.length) return;
    const cw = (w - PDF.PAD * 2) / wraps.length;
    const avail = Math.max(8, y + h - top);
    wraps.forEach((wrap, i) => {
      const svg = wrap.tagName.toLowerCase() === 'svg' ? wrap : wrap.querySelector('svg');
      if (!svg) return;
      const gx = x + PDF.PAD + cw * i;
      const dl = [...wrap.children].find(n => n.tagName.toLowerCase() === 'div');
      const box = Math.max(4, cw - 2), boxH = Math.max(6, avail - (dl ? 4.5 : 0));
      const r = svg.getBoundingClientRect();
      const gw = (k > 0 && r.width)  ? Math.min(box,  r.width  * k) : box;
      const gh = (k > 0 && r.height) ? Math.min(boxH, r.height * k) : boxH;
      const used = drawSvg(pdf, svg, gx + (cw - gw) / 2, top, gw, gh);
      if (dl && dl.innerText.trim()) {
        setFont(pdf, 7, 'normal', PDF.muted);
        pdf.text(clip(pdf, dl.innerText.trim().replace(/\s+/g, ' '), cw - 2), gx + cw / 2, top + used + 3.2, { align: 'center' });
      }
    });
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

  async function exportPdf(opts, mode) {
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
    window.__gxLast = { pages: total, cards: opts.cards.length, mode: mode || 'save',
      kinds: opts.cards.reduce((a, c) => { const k = cardKind(c.el); a[k] = (a[k] || 0) + 1; return a; }, {}) };
    if (mode === 'print') {
      // Imprimir = EL MISMO informe, abierto en el visor de PDF con el diálogo de impresión listo.
      // Antes se imprimía un clon HTML del dashboard y salía lavado; con un solo camino de render
      // lo que se imprime es exactamente lo que se descarga.
      pdf.autoPrint();
      const url = pdf.output('bloburl');
      const w = window.open(url, '_blank');
      if (!w) { pdf.save(fileName(opts)); return 'saved'; }   // bloqueador de popups → se descarga
      return 'printed';
    }
    pdf.save(fileName(opts));
    return 'saved';
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
    // Imprimir y Exportar arman EL MISMO informe; solo cambia el final (visor con el diálogo de
    // impresión, o descarga). Un único camino de render = lo que se imprime es lo que se descarga.
    const run = async (e, mode) => {
      const o = collect();
      if (!o.cards.length) { window.showToast?.(T('gps_analysis.export_pick_one', 'Pick at least one card.'), true); return; }
      const btn = e.currentTarget;
      const old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="ti ti-loader-2"></i>${T('gps_analysis.export_generating', 'Generating…')}`;
      try {
        await exportPdf(o, mode);
        ov.remove();
      } catch (err) {
        console.error('[gps export]', err);
        window.showToast?.(T('gps_analysis.export_failed', 'Could not build the report.')
          + ' [' + ((err && err.message) ? err.message : err) + ']', true);
        btn.disabled = false; btn.innerHTML = old;
      }
    };
    body.querySelector('#gxPrint').addEventListener('click', e => run(e, 'print'));
    body.querySelector('#gxPdf').addEventListener('click', e => run(e, 'save'));
  }

  window.gpOpenExportModal = openExportModal;
  window.__gxExport = exportPdf;      // expuesto para los tests
  document.getElementById('gpExportBtn')?.addEventListener('click', openExportModal);
})();
