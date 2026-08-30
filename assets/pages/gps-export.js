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
    return host.querySelector('.gps-sheet');
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

  async function exportPdf(opts) {
    // Si el CDN falló al cargar la página (red lenta, bloqueo), se reintenta acá antes de rendirse.
    await loadLib('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => !!window.html2canvas);
    await loadLib('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => !!(window.jspdf && window.jspdf.jsPDF));
    const html2canvas = window.html2canvas;
    const jsPDF = window.jspdf.jsPDF;

    const host = sheetHost();
    const sheet = buildSheet(opts);
    host.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;z-index:-1';
    try {
      await inlineImages(sheet);
      await new Promise(r => setTimeout(r, 60));                 // deja asentar las imágenes recién puestas

      const pdf = new jsPDF({ orientation: opts.orientation, unit: 'mm', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const M = 8, FOOT = 11, GAP = 3;                           // mm
      const contentW = pageW - M * 2;
      const usableH = pageH - M - FOOT;

      // BLOQUE POR BLOQUE (encabezado, filtros, resumen y cada banda de cards) en vez de una única
      // captura de toda la hoja: un dashboard largo genera un canvas que supera el máximo del
      // navegador y html2canvas devuelve una imagen vacía o falla — ese era el error al exportar.
      const blocks = [...sheet.children].filter(n => n.offsetHeight > 0);
      const parts = [];
      for (const b of blocks) {
        if (b.classList.contains('gps-cards')) {
          for (const band of b.children) if (band.offsetHeight > 0) parts.push(band);
        } else parts.push(b);
      }

      let y = M, page = 1, drawn = 0;
      for (const el of parts) {
        let img;
        try {
          const c = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
          img = { url: c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height };
        } catch (e) {
          console.warn('[gps export] bloque omitido:', e);        // una card rota no tira el informe
          continue;
        }
        let hmm = (img.h / img.w) * contentW;
        let wmm = contentW;
        if (hmm > usableH - M) {                                  // bloque más alto que la hoja → se achica
          const k = (usableH - M) / hmm;
          hmm *= k; wmm *= k;
        }
        if (drawn && y + hmm > pageH - FOOT) { pdf.addPage(); page++; y = M; }
        pdf.addImage(img.url, 'JPEG', M + (contentW - wmm) / 2, y, wmm, hmm);
        y += hmm + GAP;
        drawn++;
      }
      if (!drawn) throw new Error('no se pudo capturar ninguna card');

      const total = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) { pdf.setPage(p); drawFooter(pdf, pageW, pageH, p, total, opts); }
      pdf.save(fileName(opts));
    } finally {
      host.style.cssText = '';
      host.innerHTML = '';
    }
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
