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

  // ── State (players populated async from Supabase)
  let state = {
    formation: '4-3-3',
    style: 'editorial',
    starters: [],
    subs: [],
    showNumbers: true,
    showCaptainBadge: true,
    language: 'en',
    titleColor: null,
    accentColor: null,
  };

  // ── Module-level lineup context (set in init)
  let _lineupId   = null;
  let _clubId     = null;
  let _saveTimer  = null;
  let _allPlayers    = [];
  let _picker               = null;
  let _pickerOutsideHandler = null;
  let _playersLoading       = true;
  let _currentMatch  = null;

  // ── Strings (English-only UI)
  const T = {
    en: {
      lineup: 'Lineup',
      lineupHilite: 'Official',
      starting: 'Starting XI',
      substitutes: 'Substitutes',
      coach: 'HEAD COACH',
      assistant: 'ASSISTANT',
      gkCoach: 'GK COACH',
      fitness: 'PERFORMANCE',
      matchday: 'Date',
      kickoff: 'Kick-off',
      venue: 'Venue',
      competition: 'Competition',
      vs: 'vs',
      home: 'Home',
      away: 'Away',
      tagline: '#ClavaMetrics',
      official: 'Official',
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
      if (!p) return;
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

    const flagBg = code => FLAG_CSS[code] ? `style="background:${FLAG_CSS[code]}"` : '';

    const filledRow = (p, idx, kind) => `
      <div class="lu-row" data-kind="${kind}" data-idx="${idx}" data-pos="${p.role.toLowerCase()}" title="Click to change">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num">${p.num}</span>
        <div class="body">
          <div class="name">${p.last}, ${p.first}<span class="flag" ${flagBg(p.flag)}></span>${p.captain ? '<span class="role-tag" style="background:rgba(217,119,6,0.12);color:#B45309">CAP</span>' : ''}${p.vice ? '<span class="role-tag" style="background:rgba(37,99,235,0.12);color:#1D4ED8">VC</span>' : ''}</div>
          <div class="meta">${p.role}</div>
        </div>
        <span class="role-tag ${p.role.toLowerCase()}">${p.role}</span>
      </div>`;

    const emptyRow = (posHint, idx, kind) => `
      <div class="lu-row is-empty" data-kind="${kind}" data-idx="${idx}" data-pos="${posHint.toLowerCase()}" title="Click to add player">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num"><i class="ti ti-user-plus" style="font-size:13px"></i></span>
        <div class="body">
          <div class="name lu-empty-label">Select player…</div>
          <div class="meta">${posHint}</div>
        </div>
        <span class="role-tag ${posHint.toLowerCase()}">${posHint}</span>
      </div>`;

    const skeletonRow = () => `
      <div class="lu-row-skeleton">
        <div class="lu-skeleton sk-num"></div>
        <div class="lu-skeleton sk-name"></div>
        <div class="lu-skeleton sk-tag"></div>
      </div>`;

    const positions = FORMATIONS[state.formation];

    if (_playersLoading && !state.starters.some(Boolean)) {
      xi.innerHTML = positions.map(() => skeletonRow()).join('');
      sub.innerHTML = Array.from({ length: 7 }, () => skeletonRow()).join('');
      return;
    }

    xi.innerHTML = positions.map((pos, i) => {
      const p = state.starters[i];
      return p ? filledRow(p, i, 'xi') : emptyRow(pos.role, i, 'xi');
    }).join('');

    const SUB_SLOTS = 7;
    sub.innerHTML = Array.from({ length: SUB_SLOTS }, (_, i) => {
      const p = state.subs[i];
      return p ? filledRow(p, i, 'sub') : emptyRow('SUB', i, 'sub');
    }).join('');

    updateTabCounts();
  }

  // ── Render the subs band on the poster
  function renderSubsBand () {
    const band = document.querySelector('[data-poster-subs]');
    if (!band) return;
    const filled = state.subs.filter(Boolean);
    band.innerHTML = filled.map(p => `
      <div class="pst-sub"><span class="n">${p.num}</span><span class="nm">${p.last}</span></div>
    `).join('');
    const ct = document.querySelector('[data-poster-subs-count]');
    if (ct) ct.textContent = filled.length;
  }

  // ── Render the match meta cells on the poster
  function renderPosterMeta () {
    const lang = T.en;
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

  // ── Match countdown (days until match_date)
  function updateCountdown (matchDate) {
    const el = document.querySelector('[data-countdown]');
    if (!el) return;
    if (!matchDate) { el.textContent = '—'; return; }
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.ceil((new Date(matchDate) - new Date()) / msPerDay);
    el.textContent = days > 0 ? days : 0;
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

  // ── Poster color overrides (title + accent CSS vars)
  function applyColors () {
    const poster = document.querySelector('.lu-poster');
    if (!poster) return;
    if (state.titleColor) poster.style.setProperty('--pst-title-color', state.titleColor);
    else poster.style.removeProperty('--pst-title-color');
    if (state.accentColor) poster.style.setProperty('--pst-em-color', state.accentColor);
    else poster.style.removeProperty('--pst-em-color');
  }

  function wireColorPickers () {
    const titlePicker  = document.getElementById('luTitleColor');
    const accentPicker = document.getElementById('luAccentColor');
    titlePicker?.addEventListener('input', e => {
      state.titleColor = e.target.value;
      applyColors();
      scheduleSave();
    });
    accentPicker?.addEventListener('input', e => {
      state.accentColor = e.target.value;
      applyColors();
      scheduleSave();
    });
  }

  // ── Export-as-image (lazy load html-to-image; fallback to print)
  function wireExport () {
    const btnImg = document.querySelector('[data-export="image"]');
    const btnPdf = document.querySelector('[data-export="pdf"]');
    const btnShr = document.querySelector('[data-export="share"]');

    if (btnPdf) btnPdf.addEventListener('click', () => window.print());
    if (btnImg) btnImg.addEventListener('click', () => downloadPoster());
    if (btnShr) btnShr.addEventListener('click', () => openShareModal());
  }

  async function downloadPoster (rival) {
    const poster = document.querySelector('.lu-poster');
    if (!poster) return;
    const btn = document.querySelector('[data-export="image"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="font-size:14px"></i>Generating…'; }
    try {
      await ensureH2C();
      const canvas = await html2canvas(poster, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        onclone: (doc) => {
          const p = doc.querySelector('.pst-pitch');
          if (p) {
            const pitchBg = {
              editorial: 'linear-gradient(180deg,rgba(255,255,255,0.02) 0%,transparent 100%),linear-gradient(180deg,#18492a 0%,#0b2312 100%)',
              stadium:   'linear-gradient(180deg,rgba(0,0,0,0.30) 0%,rgba(0,0,0,0.55) 100%),repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 calc(100%/16),rgba(0,0,0,0.04) calc(100%/16) calc(100%/8))',
              magazine:  'linear-gradient(180deg,#E6DFCF 0%,#DCD3BD 100%)',
              ticket:    '#ECE3CC',
            }[state.style] || 'linear-gradient(180deg,#18492a 0%,#0b2312 100%)';
            p.style.background = pitchBg;
          }
          const accent = state.accentColor || '#4ADE80';
          const hx = accent.replace('#','');
          const r = parseInt(hx.slice(0,2),16), g = parseInt(hx.slice(2,4),16), b = parseInt(hx.slice(4,6),16);
          doc.querySelectorAll('.pst-spot.is-captain .badge').forEach(el => {
            el.style.boxShadow = `0 0 0 2px rgba(${r},${g},${b},0.30)`;
          });
        },
      });
      const rivalName = (rival || document.querySelector('[data-rival-name]')?.textContent || 'opponent').replace(/\s+/g, '_');
      const dateStr   = document.querySelector('[data-banner-date]')?.textContent?.replace(/[\s,]+/g, '_') || 'match';
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lineup_vs_${rivalName}_${dateStr}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    } catch (e) {
      console.warn('export failed', e);
      alert('Could not export image. Try Print → Save as PDF.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-photo-down" style="font-size:14px"></i>Download PNG'; }
    }
  }

  function openShareModal () {
    document.getElementById('luShareBackdrop')?.classList.add('is-open');
    document.getElementById('luShareModal')?.classList.add('is-open');
  }

  function closeShareModal () {
    document.getElementById('luShareBackdrop')?.classList.remove('is-open');
    document.getElementById('luShareModal')?.classList.remove('is-open');
  }

  function wireShareModal () {
    document.getElementById('luShareClose')?.addEventListener('click', closeShareModal);
    document.getElementById('luShareBackdrop')?.addEventListener('click', closeShareModal);

    document.getElementById('luShareChat')?.addEventListener('click', async () => {
      closeShareModal();
      if (!_lineupId) { showToast('No active lineup'); return; }
      const { error } = await window.sb.from('lineups').update({ status: 'official' }).eq('id', _lineupId);
      if (error) { showToast('Error: ' + error.message); return; }
      showToast('✓ Official lineup published to #match-day');
      renderPosterMeta();
    });

    document.getElementById('luShareDownload')?.addEventListener('click', () => {
      closeShareModal();
      downloadPoster();
    });

    document.getElementById('luShareLink')?.addEventListener('click', () => {
      closeShareModal();
      const url = `${location.origin}${location.pathname}?lineup=${_lineupId || ''}`;
      navigator.clipboard.writeText(url).then(() => showToast('✓ Link copied to clipboard'));
    });
  }

  function showToast (msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:10px 16px;border-radius:8px;font:500 13px/1 var(--cm-font-sans);box-shadow:0 8px 24px rgba(0,0,0,0.25);z-index:9999;opacity:0;transition:opacity .25s ease';
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 250); }, 2200);
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

  // ── Player picker ─────────────────────────────────────────────

  async function loadSquadPlayers (clubId) {
    const { data } = await window.sb
      .from('players')
      .select('id,first_name,last_name,number,position,nationality')
      .eq('club_id', clubId)
      .neq('status', 'inactive')
      .order('last_name');
    _allPlayers = data || [];
    _playersLoading = false;
  }

  function openPicker (slotIdx, kind, anchor) {
    closePicker();
    const posHint = kind === 'xi'
      ? (FORMATIONS[state.formation][slotIdx]?.role || 'ANY')
      : 'ANY';

    const panel = document.createElement('div');
    panel.className = 'lu-picker';
    const rect = anchor.getBoundingClientRect();
    panel.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    panel.style.left = rect.left + 'px';
    panel.style.width = Math.max(rect.width, 260) + 'px';

    panel.innerHTML = `
      <div class="lu-picker-search">
        <i class="ti ti-search"></i>
        <input class="lu-picker-input" placeholder="Search player…">
      </div>
      <div class="lu-picker-list"></div>`;

    document.body.appendChild(panel);
    _picker = panel;

    const input = panel.querySelector('.lu-picker-input');
    const list  = panel.querySelector('.lu-picker-list');

    // Exclude players already assigned to other slots
    const currentSlotId = kind === 'xi' ? state.starters[slotIdx]?.id : state.subs[slotIdx]?.id;
    const assignedIds = new Set([
      ...state.starters.filter(Boolean).map(p => p.id),
      ...state.subs.filter(Boolean).map(p => p.id),
    ].filter(id => id !== currentSlotId));

    // Sort once on open; only filter by text on each keystroke
    const baseList = _allPlayers
      .filter(p => !assignedIds.has(p.id))
      .map(p => ({ ...p, _pos: mapPosition(p.position) }))
      .sort((a, b) => {
        const am = a._pos === posHint, bm = b._pos === posHint;
        if (am !== bm) return am ? -1 : 1;
        return (a.last_name || '').localeCompare(b.last_name || '');
      });

    const renderList = q => {
      const ql = (q || '').toLowerCase();
      const players = ql
        ? baseList.filter(p => `${p.last_name} ${p.first_name} ${p.number}`.toLowerCase().includes(ql))
        : baseList;

      if (!players.length) {
        list.innerHTML = '<div class="lu-picker-empty">No players found</div>';
        return;
      }
      list.innerHTML = players.map(p => `
        <div class="lu-picker-row${p._pos === posHint ? ' is-match' : ''}" data-id="${p.id}">
          <span class="lu-pr-num">${p.number || '?'}</span>
          <span class="lu-pr-name">${p.last_name}, ${(p.first_name || '')[0] || ''}.</span>
          <span class="role-tag ${p._pos.toLowerCase()}">${p._pos}</span>
        </div>`).join('');

      list.querySelectorAll('.lu-picker-row').forEach(row => {
        row.addEventListener('mousedown', e => {
          e.preventDefault();
          const player = _allPlayers.find(p => p.id === row.dataset.id);
          if (player) selectPlayer(player, slotIdx, kind);
          closePicker();
        });
      });
    };

    renderList('');
    let _inputTimer;
    input.addEventListener('input', e => {
      clearTimeout(_inputTimer);
      _inputTimer = setTimeout(() => renderList(e.target.value), 100);
    });
    requestAnimationFrame(() => input.focus());

    // Store handler in module var so closePicker can always cancel it,
    // even when the pick happens via mousedown (click never reaches document).
    _pickerOutsideHandler = e => { if (_picker && !_picker.contains(e.target)) closePicker(); };
    setTimeout(() => {
      if (_pickerOutsideHandler) document.addEventListener('click', _pickerOutsideHandler);
    }, 0);
  }

  function wireComposerDelegation () {
    const xi  = document.querySelector('[data-list="xi"]');
    const sub = document.querySelector('[data-list="subs"]');
    [xi, sub].forEach(container => {
      if (!container) return;
      container.addEventListener('click', e => {
        const row = e.target.closest('.lu-row');
        if (!row) return;
        openPicker(+row.dataset.idx, row.dataset.kind, row);
      });
    });
  }

  function closePicker () {
    if (_picker) { _picker.remove(); _picker = null; }
    if (_pickerOutsideHandler) {
      document.removeEventListener('click', _pickerOutsideHandler);
      _pickerOutsideHandler = null;
    }
  }

  function selectPlayer (squadPlayer, slotIdx, kind) {
    const nat = (squadPlayer.nationality || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
    const p = {
      id:      squadPlayer.id,
      num:     squadPlayer.number || '?',
      last:    squadPlayer.last_name || '—',
      first:   squadPlayer.first_name ? squadPlayer.first_name[0] + '.' : '',
      role:    mapPosition(squadPlayer.position),
      captain: false,
      vice:    false,
      flag:    FLAG_CSS[nat] ? nat : null,
    };

    if (kind === 'xi') {
      while (state.starters.length <= slotIdx) state.starters.push(null);
      state.starters[slotIdx] = p;
    } else {
      while (state.subs.length <= slotIdx) state.subs.push(null);
      state.subs[slotIdx] = p;
    }

    // Render is synchronous — UI is instant
    renderComposer();
    renderPitch();
    renderSubsBand();

    // Persist in background — never blocks the UI
    persistSlot(slotIdx, kind, squadPlayer.id)
      .catch(err => showToast('Save error: ' + err.message));
  }

  async function persistSlot (slotIdx, kind, playerId) {
    if (!_lineupId || !playerId) return;
    const role = kind === 'xi' ? 'starter' : 'substitute';
    const { error } = await window.sb.from('lineup_players')
      .upsert(
        { lineup_id: _lineupId, player_id: playerId, role, slot_index: slotIdx },
        { onConflict: 'lineup_id,role,slot_index' }
      );
    if (error) throw error;
  }

  function updateTabCounts () {
    const xiCt  = state.starters.filter(Boolean).length;
    const subCt = state.subs.filter(Boolean).length;
    const xiTab  = document.querySelector('[data-tab="xi"] .ct');
    const subTab = document.querySelector('[data-tab="subs"] .ct');
    if (xiTab)  xiTab.textContent  = xiCt;
    if (subTab) subTab.textContent = subCt;
    const compCount = document.getElementById('luCompCount');
    if (compCount) compCount.textContent = `${xiCt} + ${subCt}`;
  }

  // ── Supabase: load next match from calendar_events
  async function loadNextMatch (clubId) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await window.sb
      .from('calendar_events')
      .select('id,opponent,date,start_time,location,competition,home_away,title,rival_crest_url')
      .eq('club_id', clubId)
      .eq('type', 'match')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data;
  }

  // ── Supabase: get existing draft/locked lineup or create a new draft
  async function getOrCreateLineup (clubId, matchId) {
    const baseQ = () => window.sb
      .from('lineups')
      .select('id,formation,status,poster_style,language,style_config')
      .eq('club_id', clubId)
      .eq('match_id', matchId)
      .in('status', ['draft','locked','official'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const baseQFallback = () => window.sb
      .from('lineups')
      .select('id,formation,status,poster_style,language')
      .eq('club_id', clubId)
      .eq('match_id', matchId)
      .in('status', ['draft','locked','official'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let { data: existing, error: e1 } = await baseQ();
    if (e1) ({ data: existing } = await baseQFallback());
    if (existing) return existing;

    const selCols = e1
      ? 'id,formation,status,poster_style,language'
      : 'id,formation,status,poster_style,language,style_config';
    const { data: created } = await window.sb
      .from('lineups')
      .insert({ club_id: clubId, match_id: matchId, formation: '4-3-3', status: 'draft' })
      .select(selCols)
      .single();
    return created;
  }

  // ── Supabase: load players for a given role from lineup_players
  function mapPosition (pos) {
    if (!pos) return 'MF';
    const p = pos.toUpperCase();
    if (p === 'GK' || p === 'GOALKEEPER') return 'GK';
    if (p === 'CB' || p.includes('CENTRAL') || p.includes('CENTER BACK')) return 'CB';
    if (p === 'FB' || p.includes('BACK') || p.includes('LB') || p.includes('RB')) return 'FB';
    if (p === 'WG' || p.includes('WING') || p.includes('LW') || p.includes('RW')) return 'WG';
    if (p === 'ST' || p.includes('STRIKER') || p.includes('FORWARD') || p.includes('CF') || p.includes('FW')) return 'ST';
    return 'MF';
  }

  async function loadLineupPlayers (lineupId, role) {
    const { data } = await window.sb
      .from('lineup_players')
      .select('slot_index,is_captain,is_vice_captain,players(id,first_name,last_name,number,position,nationality)')
      .eq('lineup_id', lineupId)
      .eq('role', role)
      .order('slot_index');
    return (data || []).map(lp => {
      const p = lp.players || {};
      const nat = (p.nationality || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
      return {
        id:      p.id,
        num:     p.number || '?',
        last:    p.last_name || '—',
        first:   p.first_name ? p.first_name[0] + '.' : '',
        role:    mapPosition(p.position),
        captain: lp.is_captain || false,
        vice:    lp.is_vice_captain || false,
        flag:    FLAG_CSS[nat] ? nat : null,
      };
    });
  }

  // ── Supabase: debounced save of lineup metadata (formation, style, language, colors)
  function scheduleSave () {
    if (!_lineupId) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      const styleConfig = {};
      if (state.titleColor)  styleConfig.title_color  = state.titleColor;
      if (state.accentColor) styleConfig.accent_color = state.accentColor;
      const { error } = await window.sb.from('lineups').update({
        formation:    state.formation,
        poster_style: state.style,
        language:     state.language,
        style_config: styleConfig,
      }).eq('id', _lineupId);
      // Fallback: if style_config column not yet added via migration, save without it
      if (error?.code === '42703') {
        await window.sb.from('lineups').update({
          formation:    state.formation,
          poster_style: state.style,
          language:     state.language,
        }).eq('id', _lineupId);
      }
      const saved = document.getElementById('luSaveStatus');
      if (saved) saved.textContent = 'Saved · just now';
    }, 500);
  }

  // ── Competition label map (calendar_events uses lowercase enum values)
  const COMP_LABELS = { league: 'League', cup: 'Cup', international: 'International', friendly: 'Friendly' };
  const fmtComp = c => COMP_LABELS[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : '—');

  // ── Banner: update .lu-mc + poster meta with calendar_event data
  function updateBanner (match) {
    const rival = match.opponent || match.title || '—';
    const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };

    const fmtDate = d => {
      if (!d) return '—';
      return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    };

    // Banner top row
    set('[data-mc-cycle]', '');
    set('[data-rival-name]', rival);
    document.querySelectorAll('.opp-crest').forEach(img => { img.alt = rival; });

    // Show rival crest from calendar_events if already saved
    if (match.rival_crest_url) {
      document.querySelectorAll('.opp-crest').forEach(img => { img.src = match.rival_crest_url; });
    }

    const homeEl = document.querySelector('[data-home-away]');
    if (homeEl) homeEl.innerHTML = match.home_away === 'home'
      ? '<i class="ti ti-home" style="font-size:11px"></i>Home'
      : '<i class="ti ti-plane" style="font-size:11px"></i>Away';

    // Banner meta strip
    set('[data-banner-date]',  fmtDate(match.date));
    set('[data-banner-time]',  match.start_time ? match.start_time.slice(0,5) : '—');
    set('[data-banner-venue]', match.location || '—');
    set('[data-banner-comp]',  fmtComp(match.competition));

    // Poster meta cells
    const d = match.date ? new Date(match.date + 'T12:00:00') : null;
    const dateStr = d ? d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) : '—';
    const yearStr = d ? d.getFullYear() : '';
    const homeAway = match.home_away === 'home' ? 'Home' : match.home_away === 'away' ? 'Away' : '';

    const setHtml = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    setHtml('[data-match-date]',  d ? `${dateStr}<small>${yearStr}</small>` : '—');
    setHtml('[data-match-time]',  match.start_time ? match.start_time.slice(0,5) : '—');
    setHtml('[data-match-venue]', match.location
      ? `${match.location}${homeAway ? `<small>${homeAway}</small>` : ''}`
      : (homeAway || '—'));
    setHtml('[data-match-comp]',  fmtComp(match.competition));

    // Poster right column
    set('[data-poster-comp-label]', fmtComp(match.competition));
    set('[data-poster-matchday]', '');

    // Countdown
    updateCountdown(match.date);
  }

  // ── Club info: logo + name from clubs table, season from club_settings
  async function loadClubInfo (clubId) {
    const [{ data }, { data: settings }] = await Promise.all([
      window.sb.from('clubs').select('logo_url,name').eq('id', clubId).maybeSingle(),
      window.sb.from('club_settings').select('season_name').eq('club_id', clubId).limit(1).maybeSingle(),
    ]);
    if (!data) return;
    if (data.logo_url) {
      document.querySelectorAll('.pst-crest').forEach(img => { img.src = data.logo_url; });
    }
    if (data.name) {
      document.querySelectorAll('[data-club-name], [data-club-name-title], [data-club-name-poster]').forEach(el => {
        el.textContent = data.name;
      });
      // Default hashtag from club name (overridden by loadBranding if club_branding row exists)
      const tag = '#' + data.name.replace(/\s+/g, '').toUpperCase();
      T.en.tagline = tag;
      document.querySelectorAll('[data-poster-tag]').forEach(el => { el.textContent = tag; });
    }
    const season = settings?.season_name;
    const teamSub = season ? `First team · ${season}` : 'First team';
    document.querySelectorAll('[data-club-team-sub]').forEach(el => { el.textContent = teamSub; });
  }

  // ── Coach: load head coach name from profiles → poster footer (admin fallback)
  async function loadCoachInfo (clubId) {
    const { data: rows } = await window.sb
      .from('profiles')
      .select('full_name,role')
      .eq('club_id', clubId)
      .in('role', ['coach', 'admin'])
      .order('created_at');
    const coach = (rows || []).find(r => r.role === 'coach') || rows?.[0];
    if (coach?.full_name) {
      document.querySelectorAll('[data-coach-v]').forEach(el => { el.textContent = coach.full_name; });
    }
  }

  // ── Staff pane: render profiles with checkboxes for lineup inclusion
  async function renderStaff (clubId) {
    const { data } = await window.sb
      .from('profiles')
      .select('id,full_name,role')
      .eq('club_id', clubId)
      .in('role', ['coach', 'staff', 'admin'])
      .order('created_at');
    const list = document.getElementById('staffList');
    if (!list || !data?.length) return;
    const roleLabel = r => ({ coach: 'Head coach', staff: 'Staff', admin: 'Director' }[r] || r);
    const roleTag   = r => ({ coach: 'HC', staff: 'AST', admin: 'MGR' }[r] || 'STF');
    list.innerHTML = data.map((p, i) => `
      <div class="lu-row" data-pos="mf">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num">${p.role === 'coach' && i === 0 ? '<i class="ti ti-crown" style="font-size:13px;color:var(--cm-warning)"></i>' : '·'}</span>
        <div class="body">
          <div class="name">${p.full_name || '—'}</div>
          <div class="meta">${roleLabel(p.role)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" class="lu-staff-check" data-pid="${p.id}" data-name="${(p.full_name || '').replace(/"/g,'&quot;')}" data-prole="${p.role}" title="Include in lineup">
          <span class="role-tag" style="${p.role === 'coach' ? 'background:rgba(217,119,6,0.12);color:#B45309' : ''}">${roleTag(p.role)}</span>
        </div>
      </div>`).join('');

    list.querySelectorAll('.lu-staff-check').forEach(cb => {
      cb.addEventListener('change', () => toggleStaff(cb.dataset.pid, cb.dataset.name, cb.dataset.prole, cb.checked));
    });
  }

  // ── Staff: check boxes for profiles already saved in lineup_staff
  async function loadLineupStaff (lineupId) {
    const { data } = await window.sb
      .from('lineup_staff')
      .select('profile_id')
      .eq('lineup_id', lineupId);
    const checked = new Set((data || []).map(r => r.profile_id).filter(Boolean));
    document.querySelectorAll('.lu-staff-check').forEach(cb => {
      cb.checked = checked.has(cb.dataset.pid);
    });
  }

  // ── Staff: toggle a profile in/out of lineup_staff
  async function toggleStaff (profileId, displayName, profileRole, include) {
    if (!_lineupId) return;
    const roleCodeMap = { coach: 'head', staff: 'assistant', admin: 'other' };
    // Always delete first to avoid duplicates (no UNIQUE constraint on lineup_id+profile_id)
    await window.sb.from('lineup_staff').delete()
      .eq('lineup_id', _lineupId)
      .eq('profile_id', profileId);
    if (include) {
      await window.sb.from('lineup_staff').insert({
        lineup_id:    _lineupId,
        profile_id:   profileId,
        display_name: displayName,
        role_code:    roleCodeMap[profileRole] || 'other',
      });
    }
  }

  // ── Rival crest upload (Lineup poster quick-upload)
  // Primary upload path is the Calendar match event modal; this is a secondary shortcut.
  function wireRivalUpload (matchId, opponentName) {
    const input = document.getElementById('rivalCrestInput');
    if (!input) return;
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file || !window.sb) return;

      // Show immediately as data URL
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = ev => res(ev.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      document.querySelectorAll('.opp-crest').forEach(img => { img.src = dataUrl; });

      // Upload to Storage using canonical path opponent-crests/{club_id}/{slug}.{ext}
      const rival = opponentName || _currentMatch?.opponent || 'rival';
      const slug  = window.slugifyOpponent ? window.slugifyOpponent(rival) : 'rival';
      const ext   = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z]/g, '') || 'png';
      const path  = `opponent-crests/${_clubId || 'default'}/${slug}.${ext}`;
      const { error } = await window.sb.storage.from('club-assets').upload(path, file, { upsert: true });
      if (error) { showToast('Upload failed: ' + error.message); return; }
      const { data: { publicUrl } } = window.sb.storage.from('club-assets').getPublicUrl(path);

      // Persist to calendar_events + opponent_branding
      if (matchId) {
        await window.sb.from('calendar_events').update({ rival_crest_url: publicUrl }).eq('id', matchId);
      }
      if (_clubId && rival) {
        await window.sb.from('opponent_branding').upsert(
          { club_id: _clubId, opponent_name: rival.toLowerCase().trim(), crest_url: publicUrl },
          { onConflict: 'club_id,opponent_name' }
        );
      }
      if (window.invalidateCrestCache) window.invalidateCrestCache(_clubId, rival, matchId);
      document.querySelectorAll('.opp-crest').forEach(img => { img.src = publicUrl; });
      showToast('Opponent crest updated');
    });
  }

  // ── Branding: load club crest + opponent crest
  // existingCrestUrl (from calendar_events.rival_crest_url) wins over opponent_branding
  async function loadBranding (clubId, opponentName, existingCrestUrl) {
    const [cbResult, obResult] = await Promise.all([
      window.sb.from('club_branding').select('crest_url,hashtag').eq('club_id', clubId).maybeSingle(),
      (!existingCrestUrl && opponentName)
        ? window.sb.from('opponent_branding').select('crest_url')
            .eq('club_id', clubId)
            .ilike('opponent_name', opponentName)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const clubCrest = cbResult.data?.crest_url;
    const oppCrest  = existingCrestUrl || obResult.data?.crest_url;
    const hashtag   = cbResult.data?.hashtag;

    if (clubCrest) {
      document.querySelectorAll('.pst-crest').forEach(img => { img.src = clubCrest; });
    }
    if (oppCrest) {
      document.querySelectorAll('.opp-crest').forEach(img => { img.src = oppCrest; });
    }
    if (hashtag) {
      document.querySelectorAll('[data-poster-tag]').forEach(el => { el.textContent = hashtag; });
      if (T.es) T.es.tagline = hashtag;
      if (T.en) T.en.tagline = hashtag;
    }
  }

  // ── Init
  document.addEventListener('DOMContentLoaded', async () => {
    injectPitchLines();
    wireTabs();
    wireFormations();
    wireStyles();
    wireExport();
    wireColorPickers();
    wireComposerDelegation();

    // Wire formation + style save debounce (no Supabase needed, safe to do now)
    document.querySelectorAll('.lu-form-btn').forEach(b => {
      b.addEventListener('click', () => scheduleSave());
    });
    document.querySelectorAll('.style-tab').forEach(b => {
      b.addEventListener('click', () => scheduleSave());
    });

    // Sync render before Supabase data arrives so page isn't blank
    applyFormation();
    applyStyle();
    renderPosterMeta();

    if (!window.requireAuth || !window.sb) return;

    const ok = await window.guardModule();
    if (!ok) return;
    _clubId = await window.getClubId();

    // Load squad, club info, coach, and staff in parallel
    await Promise.all([
      loadSquadPlayers(_clubId),
      loadClubInfo(_clubId),
      loadCoachInfo(_clubId),
      renderStaff(_clubId),
    ]);

    // Players are ready — show clickable slots immediately.
    // Don't wait for the lineup/match sequential chain below.
    renderComposer();
    applyFormation();

    // Load next match from calendar_events
    const match = await loadNextMatch(_clubId);
    _currentMatch = match;
    if (match) {
      updateBanner(match);

      const lineup = await getOrCreateLineup(_clubId, match.id);
      if (lineup) {
        _lineupId = lineup.id;
        state.formation = lineup.formation || '4-3-3';
        if (lineup.poster_style) state.style = lineup.poster_style;
        if (lineup.language)     state.language = lineup.language;

        // Apply saved color overrides
        if (lineup.style_config?.title_color) {
          state.titleColor = lineup.style_config.title_color;
          const p = document.getElementById('luTitleColor');
          if (p) p.value = state.titleColor;
        }
        if (lineup.style_config?.accent_color) {
          state.accentColor = lineup.style_config.accent_color;
          const p = document.getElementById('luAccentColor');
          if (p) p.value = state.accentColor;
        }
        applyColors();

        const [starters, subs] = await Promise.all([
          loadLineupPlayers(lineup.id, 'starter'),
          loadLineupPlayers(lineup.id, 'substitute'),
          loadLineupStaff(lineup.id),
        ]);
        if (starters.length) state.starters = starters;
        if (subs.length)     state.subs = subs;
      }
    }

    // Load crests and wire rival upload (calendar_events.rival_crest_url takes priority)
    await loadBranding(_clubId, match?.opponent || '', match?.rival_crest_url || null);
    wireRivalUpload(match?.id, match?.opponent || '');
    wireShareModal();

    // Re-render with real data
    renderComposer();
    applyFormation();
    applyStyle();
    renderSubsBand();
    renderPosterMeta();
  });
})();
