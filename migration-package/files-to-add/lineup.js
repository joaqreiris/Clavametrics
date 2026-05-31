// ─────────────────────────────────────────────────────────────
// lineup.js — wires the composer to the poster.
// All position math + data is here. The HTML is the editable
// source-of-truth; this script reads/updates it.
// ─────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Formations: positions are (x%, y%) on the poster pitch.
  //    Pitch is rendered with our team attacking UP (so y=92 = own goal,
  //    y=8 = opponent goal). GK sits at the bottom.
  const FORMATIONS = {
    '4-3-3': [
      { role: 'GK', x: 50, y: 90 },
      { role: 'FB', x: 14, y: 70 }, // LB
      { role: 'CB', x: 36, y: 73 }, // LCB
      { role: 'CB', x: 64, y: 73 }, // RCB
      { role: 'FB', x: 86, y: 70 }, // RB
      { role: 'MF', x: 28, y: 50 }, // LCM
      { role: 'MF', x: 50, y: 56 }, // DM
      { role: 'MF', x: 72, y: 50 }, // RCM
      { role: 'WG', x: 14, y: 24 }, // LW
      { role: 'ST', x: 50, y: 18 }, // CF
      { role: 'WG', x: 86, y: 24 }, // RW
    ],
    '4-4-2': [
      { role: 'GK', x: 50, y: 90 },
      { role: 'FB', x: 14, y: 70 },
      { role: 'CB', x: 36, y: 73 },
      { role: 'CB', x: 64, y: 73 },
      { role: 'FB', x: 86, y: 70 },
      { role: 'WG', x: 14, y: 45 },
      { role: 'MF', x: 38, y: 50 },
      { role: 'MF', x: 62, y: 50 },
      { role: 'WG', x: 86, y: 45 },
      { role: 'ST', x: 36, y: 20 },
      { role: 'ST', x: 64, y: 20 },
    ],
    '4-2-3-1': [
      { role: 'GK', x: 50, y: 90 },
      { role: 'FB', x: 14, y: 70 },
      { role: 'CB', x: 36, y: 73 },
      { role: 'CB', x: 64, y: 73 },
      { role: 'FB', x: 86, y: 70 },
      { role: 'MF', x: 36, y: 55 },
      { role: 'MF', x: 64, y: 55 },
      { role: 'WG', x: 16, y: 32 },
      { role: 'MF', x: 50, y: 36 }, // 10
      { role: 'WG', x: 84, y: 32 },
      { role: 'ST', x: 50, y: 16 },
    ],
    '3-5-2': [
      { role: 'GK', x: 50, y: 90 },
      { role: 'CB', x: 24, y: 74 },
      { role: 'CB', x: 50, y: 76 },
      { role: 'CB', x: 76, y: 74 },
      { role: 'FB', x: 10, y: 50 }, // LWB
      { role: 'MF', x: 32, y: 54 },
      { role: 'MF', x: 50, y: 50 },
      { role: 'MF', x: 68, y: 54 },
      { role: 'FB', x: 90, y: 50 }, // RWB
      { role: 'ST', x: 38, y: 20 },
      { role: 'ST', x: 62, y: 20 },
    ],
    '5-3-2': [
      { role: 'GK', x: 50, y: 90 },
      { role: 'FB', x: 12, y: 64 },
      { role: 'CB', x: 30, y: 74 },
      { role: 'CB', x: 50, y: 76 },
      { role: 'CB', x: 70, y: 74 },
      { role: 'FB', x: 88, y: 64 },
      { role: 'MF', x: 30, y: 46 },
      { role: 'MF', x: 50, y: 50 },
      { role: 'MF', x: 70, y: 46 },
      { role: 'ST', x: 38, y: 20 },
      { role: 'ST', x: 62, y: 20 },
    ],
    '3-4-3': [
      { role: 'GK', x: 50, y: 90 },
      { role: 'CB', x: 24, y: 74 },
      { role: 'CB', x: 50, y: 76 },
      { role: 'CB', x: 76, y: 74 },
      { role: 'FB', x: 12, y: 50 },
      { role: 'MF', x: 38, y: 54 },
      { role: 'MF', x: 62, y: 54 },
      { role: 'FB', x: 88, y: 50 },
      { role: 'WG', x: 18, y: 22 },
      { role: 'ST', x: 50, y: 18 },
      { role: 'WG', x: 82, y: 22 },
    ],
  };

  // ── Players: the 11 starters chosen + 7 subs. Position priority
  //    matches the default 4-3-3 above. Captain is Esteban Galarza.
  const STARTERS = [
    { num: 1,  last: 'Galarza',    first: 'E.', role: 'GK', captain: true,  flag: 'ar' },
    { num: 22, last: 'Ferreyra',   first: 'N.', role: 'FB', flag: 'ar' },
    { num: 4,  last: 'Bocanegra',  first: 'J.', role: 'CB', vice: true,    flag: 'ar' },
    { num: 6,  last: 'Sosa',       first: 'R.', role: 'CB', flag: 'br' },
    { num: 15, last: 'Carrasco',   first: 'L.', role: 'FB', flag: 'cl' },
    { num: 8,  last: 'Paredes',    first: 'M.', role: 'MF', flag: 'ar' },
    { num: 14, last: 'Villalba',   first: 'D.', role: 'MF', flag: 'pe' },
    { num: 10, last: 'Domínguez',  first: 'F.', role: 'MF', flag: 'co' },
    { num: 11, last: 'López',      first: 'T.', role: 'WG', flag: 'fr' },
    { num: 9,  last: 'Rivas',      first: 'S.', role: 'ST', flag: 'es' },
    { num: 7,  last: 'Vega',       first: 'R.', role: 'WG', flag: 'ar' },
  ];

  const SUBSTITUTES = [
    { num: 12, last: 'Mora',       first: 'S.', role: 'GK', flag: 'uy' },
    { num: 25, last: 'Tévez',      first: 'A.', role: 'GK', flag: 'ar' },
    { num: 17, last: 'Gimenez',    first: 'P.', role: 'MF', flag: 'ar' },
    { num: 19, last: 'Cardozo',    first: 'I.', role: 'ST', flag: 'ar' },
    { num: 5,  last: 'Quiroga',    first: 'M.', role: 'MF', flag: 'ar' },
    { num: 20, last: 'Aguirre',    first: 'B.', role: 'FB', flag: 'uy' },
    { num: 23, last: 'Salazar',    first: 'E.', role: 'WG', flag: 'ar' },
  ];

  const STAFF = {
    head:    'Sebastián Beccacece',
    asst:    'M. Insúa',
    gk:      'F. Migliore',
    fitness: 'J. Reiris',
  };

  // ── Flag colors (kept in sync w/ squad's CSS classes)
  const FLAG_CSS = {
    ar: 'linear-gradient(180deg,#74acdf 33%,#fff 33% 66%,#74acdf 66%)',
    br: '#22A040',
    uy: 'linear-gradient(180deg,#fff 50%, #0038A8 50%)',
    cl: 'linear-gradient(180deg,#fff 50%, #D52B1E 50%)',
    es: 'linear-gradient(180deg,#AA151B 25%,#F1BF00 25% 75%,#AA151B 75%)',
    fr: 'linear-gradient(90deg,#002395 33%,#fff 33% 66%,#ED2939 66%)',
    co: 'linear-gradient(180deg,#FCD116 50%,#003893 50% 75%,#CE1126 75%)',
    pe: 'linear-gradient(90deg,#D91023 33%,#fff 33% 66%,#D91023 66%)',
  };

  // ── State
  let state = {
    formation: '4-3-3',
    style: 'editorial', // editorial | stadium | magazine | ticket
    starters: STARTERS.slice(),
    subs: SUBSTITUTES.slice(),
    showNumbers: true,
    showCaptainBadge: true,
    language: 'es', // es | en
  };

  // ── Strings
  const T = {
    es: {
      lineup: 'Convocatoria',
      lineupHilite: 'Oficial',
      starting: 'XI Inicial',
      substitutes: 'Suplentes',
      coach: 'DT',
      assistant: 'AYUDANTE',
      gkCoach: 'ENT. ARQUEROS',
      fitness: 'PREPARADOR FÍSICO',
      matchday: 'Fecha',
      kickoff: 'Hora',
      venue: 'Estadio',
      competition: 'Competición',
      vs: 'vs',
      home: 'Local',
      away: 'Visitante',
      tagline: '#VamosClava',
      official: 'Oficial · MC 14',
    },
    en: {
      lineup: 'Lineup',
      lineupHilite: 'Starting XI',
      starting: 'Starting XI',
      substitutes: 'Substitutes',
      coach: 'HEAD COACH',
      assistant: 'ASSISTANT',
      gkCoach: 'GK COACH',
      fitness: 'PERFORMANCE',
      matchday: 'Matchday',
      kickoff: 'Kick-off',
      venue: 'Venue',
      competition: 'Competition',
      vs: 'vs',
      home: 'Home',
      away: 'Away',
      tagline: '#VamosClava',
      official: 'Official · MC 14',
    },
  };

  // ── Render the poster spots (player circles on the pitch)
  function renderPitch () {
    const stage = document.querySelector('.pst-pitch');
    if (!stage) return;

    // Remove existing spots
    stage.querySelectorAll('.pst-spot').forEach(n => n.remove());

    const positions = FORMATIONS[state.formation];
    state.starters.forEach((p, i) => {
      const pos = positions[i] || { x: 50, y: 50 };
      const spot = document.createElement('div');
      spot.className = 'pst-spot' + (p.captain && state.showCaptainBadge ? ' is-captain' : '');
      spot.style.left = pos.x + '%';
      spot.style.top = pos.y + '%';
      spot.innerHTML = `
        <div class="badge">${state.showNumbers ? p.num : (p.last[0] + (p.first[0]||''))}</div>
        <div class="name">${p.last}</div>
      `;
      stage.appendChild(spot);
    });
  }

  // ── Render starting XI list in composer
  function renderComposer () {
    const xi = document.querySelector('[data-list="xi"]');
    const sub = document.querySelector('[data-list="subs"]');
    if (!xi || !sub) return;

    const flagBg = (code) => FLAG_CSS[code] ? `style="background:${FLAG_CSS[code]}"` : '';
    const row = (p, idx, kind) => `
      <div class="lu-row" data-kind="${kind}" data-idx="${idx}" data-pos="${p.role.toLowerCase()}">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num">${p.num}</span>
        <div class="body">
          <div class="name">${p.last}, ${p.first}<span class="flag" ${flagBg(p.flag)}></span>${p.captain ? '<span class="role-tag" style="background:rgba(217,119,6,0.12);color:#B45309">CAP</span>' : ''}${p.vice ? '<span class="role-tag" style="background:rgba(37,99,235,0.12);color:#1D4ED8">VC</span>' : ''}</div>
          <div class="meta">${p.role}</div>
        </div>
        <span class="role-tag ${p.role.toLowerCase()}">${p.role}</span>
      </div>
    `;

    xi.innerHTML = state.starters.map((p, i) => row(p, i, 'xi')).join('');
    sub.innerHTML = state.subs.map((p, i) => row(p, i, 'sub')).join('');

    // Wire row clicks → bench/sub action could go here.
  }

  // ── Render the subs band on the poster
  function renderSubsBand () {
    const band = document.querySelector('[data-poster-subs]');
    if (!band) return;
    band.innerHTML = state.subs.map(p => `
      <div class="pst-sub"><span class="n">${p.num}</span><span class="nm">${p.last}</span></div>
    `).join('');
    const ct = document.querySelector('[data-poster-subs-count]');
    if (ct) ct.textContent = state.subs.length;
  }

  // ── Render the match meta cells on the poster
  function renderPosterMeta () {
    const lang = T[state.language];
    const set = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };
    set('[data-meta="matchday-l"]', lang.matchday);
    set('[data-meta="kickoff-l"]',  lang.kickoff);
    set('[data-meta="venue-l"]',    lang.venue);
    set('[data-meta="comp-l"]',     lang.competition);
    set('[data-poster-tag]',        lang.tagline);
    set('[data-poster-stamp]',      lang.official);
    set('[data-poster-title]',      lang.lineup);
    set('[data-poster-title-em]',   lang.lineupHilite);
    set('[data-band-starters]',     lang.starting);
    set('[data-band-subs]',         lang.substitutes);
    set('[data-coach-l]',           lang.coach);

    const cap = state.starters.find(p => p.captain);
    set('[data-meta-captain]',      cap ? cap.last : '—');
  }

  // ── Style switcher
  function applyStyle () {
    const p = document.querySelector('.lu-poster');
    if (!p) return;
    p.className = 'lu-poster is-' + state.style;
    document.querySelectorAll('.style-tab').forEach(b => {
      b.classList.toggle('is-on', b.dataset.style === state.style);
    });
    // Stamp only on ticket style — toggle by hiding via CSS already.
    const stamp = document.querySelector('.pst-stamp');
    if (stamp) stamp.style.display = state.style === 'ticket' ? 'block' : 'none';
  }

  // ── Formation switcher
  function applyFormation () {
    document.querySelectorAll('.lu-form-btn').forEach(b => {
      b.classList.toggle('is-on', b.dataset.form === state.formation);
    });
    const sys = document.querySelector('[data-form-system]');
    if (sys) sys.textContent = state.formation;
    renderPitch();
  }

  // ── Pitch SVG lines (drawn once)
  function injectPitchLines () {
    const stage = document.querySelector('.pst-pitch');
    if (!stage || stage.querySelector('.pst-pitch-lines')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'pst-pitch-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `
      <!-- Outer touchlines -->
      <rect x="3" y="3" width="94" height="94" rx="0"/>
      <!-- Halfway line -->
      <line x1="3" y1="50" x2="97" y2="50"/>
      <!-- Centre circle -->
      <circle cx="50" cy="50" r="9"/>
      <circle cx="50" cy="50" r="0.6" fill="currentColor" stroke="none"/>
      <!-- Top penalty area (opponent) -->
      <rect x="22" y="3" width="56" height="14"/>
      <rect x="36" y="3" width="28" height="6"/>
      <!-- Top penalty spot -->
      <circle cx="50" cy="13" r="0.6" fill="currentColor" stroke="none"/>
      <!-- Bottom penalty area (us) -->
      <rect x="22" y="83" width="56" height="14"/>
      <rect x="36" y="91" width="28" height="6"/>
      <!-- Bottom penalty spot -->
      <circle cx="50" cy="87" r="0.6" fill="currentColor" stroke="none"/>
    `;
    stage.appendChild(svg);
  }

  // ── Match countdown ticker (just visual)
  function updateCountdown () {
    const el = document.querySelector('[data-countdown]');
    if (!el) return;
    // Match kickoff: Sun May 18 2026, 17:00 ART (we live "today" = May 27 demo, so we'll fix to 2 days for demo)
    el.textContent = '2';
  }

  // ── Tabs (XI / Subs / Staff)
  function wireTabs () {
    document.querySelectorAll('.lu-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.lu-tab').forEach(o => o.classList.remove('is-on'));
        t.classList.add('is-on');
        const target = t.dataset.tab;
        document.querySelectorAll('[data-pane]').forEach(p => {
          p.style.display = p.dataset.pane === target ? '' : 'none';
        });
      });
    });
  }

  // ── Formation buttons
  function wireFormations () {
    document.querySelectorAll('.lu-form-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.formation = b.dataset.form;
        applyFormation();
      });
    });
  }

  // ── Style buttons
  function wireStyles () {
    document.querySelectorAll('.style-tab').forEach(b => {
      b.addEventListener('click', () => {
        state.style = b.dataset.style;
        applyStyle();
      });
    });
  }

  // ── Language toggle (es/en) — exposed via tweaks
  function setLanguage (lang) {
    state.language = lang;
    renderPosterMeta();
  }

  // ── Public hook for the Tweaks panel
  window.LineupAPI = {
    setStyle: (s)      => { state.style = s; applyStyle(); },
    setFormation: (f)  => { state.formation = f; applyFormation(); },
    setLanguage: (l)   => setLanguage(l),
    setShowNumbers: (v)=> { state.showNumbers = !!v; renderPitch(); },
    setCaptainBadge:(v)=> { state.showCaptainBadge = !!v; renderPitch(); },
  };

  // ── Export-as-image (lazy load html-to-image; fallback to print)
  function wireExport () {
    const btnImg = document.querySelector('[data-export="image"]');
    const btnPdf = document.querySelector('[data-export="pdf"]');
    const btnShr = document.querySelector('[data-export="share"]');

    if (btnPdf) btnPdf.addEventListener('click', () => window.print());
    if (btnImg) btnImg.addEventListener('click', async () => {
      const poster = document.querySelector('.lu-poster');
      if (!poster) return;
      btnImg.disabled = true; btnImg.dataset.label = btnImg.innerText;
      btnImg.innerHTML = '<i class="ti ti-loader-2" style="font-size:14px"></i>Generando…';
      try {
        await ensureH2C();
        // eslint-disable-next-line no-undef
        const canvas = await html2canvas(poster, { backgroundColor: null, scale: 2, useCORS: true });
        canvas.toBlob((blob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `Convocatoria_MC14_vs_Atletico.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }, 'image/png');
      } catch (e) {
        console.warn('export failed', e);
        alert('No se pudo exportar la imagen. Probá con Imprimir → Guardar como PDF.');
      } finally {
        btnImg.disabled = false;
        btnImg.innerHTML = '<i class="ti ti-photo-down" style="font-size:14px"></i>Descargar PNG';
      }
    });

    if (btnShr) btnShr.addEventListener('click', () => {
      // Simulated "Share to internal chat" — toast.
      const toast = document.createElement('div');
      toast.textContent = '✓ Compartido en #match-day';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:10px 16px;border-radius:8px;font:500 13px/1 var(--cm-font-sans);box-shadow:0 8px 24px rgba(0,0,0,0.25);z-index:9999;opacity:0;transition:opacity .25s ease';
      document.body.appendChild(toast);
      requestAnimationFrame(() => { toast.style.opacity = '1'; });
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 250); }, 1800);
    });
  }

  let _h2cPromise;
  function ensureH2C () {
    if (window.html2canvas) return Promise.resolve();
    if (_h2cPromise) return _h2cPromise;
    _h2cPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return _h2cPromise;
  }

  // ── Init
  document.addEventListener('DOMContentLoaded', () => {
    injectPitchLines();
    wireTabs();
    wireFormations();
    wireStyles();
    wireExport();
    renderComposer();
    applyFormation();
    applyStyle();
    renderSubsBand();
    renderPosterMeta();
    updateCountdown();
  });
})();
