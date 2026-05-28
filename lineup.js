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
    language: 'es',
  };

  // ── Module-level lineup context (set in init)
  let _lineupId   = null;
  let _clubId     = null;
  let _mcName     = null;
  let _saveTimer  = null;
  let _allPlayers = [];
  let _picker     = null;

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
      official: _mcName ? 'Oficial · ' + _mcName : 'Oficial',
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

    const flagBg = code => FLAG_CSS[code] ? `style="background:${FLAG_CSS[code]}"` : '';

    const filledRow = (p, idx, kind) => `
      <div class="lu-row" data-kind="${kind}" data-idx="${idx}" data-pos="${p.role.toLowerCase()}" title="Click para cambiar">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num">${p.num}</span>
        <div class="body">
          <div class="name">${p.last}, ${p.first}<span class="flag" ${flagBg(p.flag)}></span>${p.captain ? '<span class="role-tag" style="background:rgba(217,119,6,0.12);color:#B45309">CAP</span>' : ''}${p.vice ? '<span class="role-tag" style="background:rgba(37,99,235,0.12);color:#1D4ED8">VC</span>' : ''}</div>
          <div class="meta">${p.role}</div>
        </div>
        <span class="role-tag ${p.role.toLowerCase()}">${p.role}</span>
      </div>`;

    const emptyRow = (posHint, idx, kind) => `
      <div class="lu-row is-empty" data-kind="${kind}" data-idx="${idx}" data-pos="${posHint.toLowerCase()}" title="Click para agregar jugador">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num"><i class="ti ti-user-plus" style="font-size:13px"></i></span>
        <div class="body">
          <div class="name lu-empty-label">Seleccionar jugador…</div>
          <div class="meta">${posHint}</div>
        </div>
        <span class="role-tag ${posHint.toLowerCase()}">${posHint}</span>
      </div>`;

    const positions = FORMATIONS[state.formation];
    xi.innerHTML = positions.map((pos, i) => {
      const p = state.starters[i];
      return p ? filledRow(p, i, 'xi') : emptyRow(pos.role, i, 'xi');
    }).join('');

    const SUB_SLOTS = 7;
    sub.innerHTML = Array.from({ length: SUB_SLOTS }, (_, i) => {
      const p = state.subs[i];
      return p ? filledRow(p, i, 'sub') : emptyRow('SUB', i, 'sub');
    }).join('');

    xi.querySelectorAll('.lu-row').forEach(row => {
      row.addEventListener('click', () => openPicker(+row.dataset.idx, 'xi', row));
    });
    sub.querySelectorAll('.lu-row').forEach(row => {
      row.addEventListener('click', () => openPicker(+row.dataset.idx, 'sub', row));
    });

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

    if (btnShr) btnShr.addEventListener('click', async () => {
      if (!_lineupId) { showToast('No hay convocatoria activa'); return; }
      btnShr.disabled = true;
      const { error } = await window.sb
        .from('lineups')
        .update({ status: 'official' })
        .eq('id', _lineupId);
      btnShr.disabled = false;
      if (error) { showToast('Error: ' + error.message); return; }
      showToast('✓ Convocatoria oficial publicada en #match-day');
      renderPosterMeta();
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
        <input class="lu-picker-input" placeholder="Buscar jugador…">
      </div>
      <div class="lu-picker-list"></div>`;

    document.body.appendChild(panel);
    _picker = panel;

    const input = panel.querySelector('.lu-picker-input');
    const list  = panel.querySelector('.lu-picker-list');

    const renderList = q => {
      const ql = (q || '').toLowerCase();
      let players = _allPlayers.filter(p =>
        !ql || `${p.last_name} ${p.first_name} ${p.number}`.toLowerCase().includes(ql)
      ).slice().sort((a, b) => {
        const am = mapPosition(a.position) === posHint;
        const bm = mapPosition(b.position) === posHint;
        if (am !== bm) return am ? -1 : 1;
        return (a.last_name || '').localeCompare(b.last_name || '');
      });

      if (!players.length) {
        list.innerHTML = '<div class="lu-picker-empty">Sin jugadores</div>';
        return;
      }
      list.innerHTML = players.map(p => {
        const pos = mapPosition(p.position);
        return `<div class="lu-picker-row${pos === posHint ? ' is-match' : ''}" data-id="${p.id}">
          <span class="lu-pr-num">${p.number || '?'}</span>
          <span class="lu-pr-name">${p.last_name}, ${(p.first_name || '')[0] || ''}.</span>
          <span class="role-tag ${pos.toLowerCase()}">${pos}</span>
        </div>`;
      }).join('');

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
    input.addEventListener('input', e => renderList(e.target.value));
    requestAnimationFrame(() => input.focus());

    const onOutside = e => { if (!panel.contains(e.target)) closePicker(); };
    setTimeout(() => document.addEventListener('click', onOutside, { once: true }), 0);
  }

  function closePicker () {
    if (_picker) { _picker.remove(); _picker = null; }
  }

  async function selectPlayer (squadPlayer, slotIdx, kind) {
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

    renderComposer();
    renderPitch();
    renderSubsBand();

    if (_lineupId && squadPlayer.id) {
      const role = kind === 'xi' ? 'starter' : 'substitute';
      await window.sb.from('lineup_players')
        .delete()
        .eq('lineup_id', _lineupId)
        .eq('role', role)
        .eq('slot_index', slotIdx);
      await window.sb.from('lineup_players')
        .insert({ lineup_id: _lineupId, player_id: squadPlayer.id, role, slot_index: slotIdx });
    }
  }

  function updateTabCounts () {
    const xiTab  = document.querySelector('[data-tab="xi"] .ct');
    const subTab = document.querySelector('[data-tab="subs"] .ct');
    if (xiTab)  xiTab.textContent  = state.starters.filter(Boolean).length;
    if (subTab) subTab.textContent = state.subs.filter(Boolean).length;
  }

  // ── Supabase: load next match from microcycles
  async function loadNextMatch (clubId) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await window.sb
      .from('microcycles')
      .select('id,name,rival,home_away,match_date,match_time,stadium,start_date,end_date')
      .eq('club_id', clubId)
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data;
  }

  // ── Supabase: get existing draft/locked lineup or create a new draft
  async function getOrCreateLineup (clubId, mcId) {
    const { data: existing } = await window.sb
      .from('lineups')
      .select('id,formation,status,poster_style,language')
      .eq('club_id', clubId)
      .eq('microcycle_id', mcId)
      .in('status', ['draft','locked','official'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
    const { data: created } = await window.sb
      .from('lineups')
      .insert({ club_id: clubId, microcycle_id: mcId, formation: '4-3-3', status: 'draft' })
      .select('id,formation,status,poster_style,language')
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

  // ── Supabase: debounced save of lineup metadata (formation, style, language)
  function scheduleSave () {
    if (!_lineupId) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      await window.sb.from('lineups').update({
        formation:    state.formation,
        poster_style: state.style,
        language:     state.language,
      }).eq('id', _lineupId);
      const saved = document.querySelector('.lu-comp-foot .saved');
      if (saved) saved.textContent = 'Guardado · ahora mismo';
    }, 500);
  }

  // ── Banner: update the .lu-mc block with live microcycle data
  function updateBanner (mc) {
    const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
    const setHtml = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    const setAttr = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };

    const fmtDate = d => d ? new Date(d).toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : '—';
    const startFmt = mc.start_date ? new Date(mc.start_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' }) : '';
    const endFmt   = mc.end_date   ? new Date(mc.end_date).toLocaleDateString('es-AR',   { day:'numeric', month:'short' }) : '';

    set('.lu-mc-cycle', `${mc.name || 'Microciclo'} · ${startFmt} → ${endFmt}`);
    document.querySelectorAll('.lu-mc-title .opp-crest').forEach(img => { img.alt = mc.rival || ''; });

    const homeSpan = document.querySelector('.lu-mc-title .home');
    if (homeSpan) homeSpan.innerHTML = mc.home_away === 'home'
      ? '<i class="ti ti-home" style="font-size:11px"></i>Local'
      : '<i class="ti ti-plane" style="font-size:11px"></i>Visitante';

    const rival = document.querySelector('.lu-mc-title');
    if (rival) {
      const oppCrest = rival.querySelector('.opp-crest');
      rival.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent = ''; });
      const rivalSpan = rival.querySelector('.rival-name');
      if (rivalSpan) rivalSpan.textContent = mc.rival || '—';
    }

    const items = document.querySelectorAll('.lu-mc-meta .item');
    if (items[0]) items[0].innerHTML = `<i class="ti ti-calendar-event"></i>${fmtDate(mc.match_date)}`;
    if (items[1]) items[1].innerHTML = mc.match_time
      ? `<i class="ti ti-clock"></i><strong>${mc.match_time.slice(0,5)}</strong> ART`
      : `<i class="ti ti-clock"></i>—`;
    if (items[2]) items[2].innerHTML = mc.stadium
      ? `<i class="ti ti-building-stadium"></i><strong>${mc.stadium}</strong>`
      : `<i class="ti ti-building-stadium"></i>—`;

    const resync = document.querySelector('.lu-mc-actions button');
    if (resync) resync.innerHTML = `<i class="ti ti-refresh" style="font-size:14px"></i>Re-sync ${mc.name || ''}`;

    updateCountdown(mc.match_date);
  }

  // ── Branding: load club crest + opponent crest
  async function loadBranding (clubId, opponentName) {
    const [cbResult, obResult] = await Promise.all([
      window.sb.from('club_branding').select('crest_url,hashtag').eq('club_id', clubId).maybeSingle(),
      opponentName
        ? window.sb.from('opponent_branding').select('crest_url')
            .eq('club_id', clubId)
            .ilike('opponent_name', opponentName)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const clubCrest = cbResult.data?.crest_url;
    const oppCrest  = obResult.data?.crest_url;
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

    // Sync render before Supabase data arrives so page isn't blank
    applyFormation();
    applyStyle();
    renderPosterMeta();

    if (!window.requireAuth || !window.sb) return;

    const ok = await window.requireAuth();
    if (!ok) return;
    _clubId = await window.getClubId();

    // Load squad players for the picker (non-blocking alongside match load)
    await loadSquadPlayers(_clubId);

    // Load next match from microcycles
    const mc = await loadNextMatch(_clubId);
    if (mc) {
      _mcName = mc.name;
      updateBanner(mc);

      // Get or create draft lineup tied to this microcycle
      const lineup = await getOrCreateLineup(_clubId, mc.id);
      if (lineup) {
        _lineupId = lineup.id;
        state.formation = lineup.formation || '4-3-3';
        if (lineup.poster_style) state.style = lineup.poster_style;
        if (lineup.language)     state.language = lineup.language;

        const [starters, subs] = await Promise.all([
          loadLineupPlayers(lineup.id, 'starter'),
          loadLineupPlayers(lineup.id, 'substitute'),
        ]);
        if (starters.length) state.starters = starters;
        if (subs.length)     state.subs = subs;
      }
    }

    // Wire formation save debounce
    document.querySelectorAll('.lu-form-btn').forEach(b => {
      b.addEventListener('click', () => scheduleSave());
    });
    document.querySelectorAll('.style-tab').forEach(b => {
      b.addEventListener('click', () => scheduleSave());
    });

    // Load crests
    await loadBranding(_clubId, mc?.rival || '');

    // Re-render with real data
    renderComposer();
    applyFormation();
    applyStyle();
    renderSubsBand();
    renderPosterMeta();

    // Update opponent name in title
    if (mc?.rival) {
      const rivalSpan = document.querySelector('.lu-mc-title .rival-name');
      if (!rivalSpan) {
        const titleEl = document.querySelector('.lu-mc-title');
        if (titleEl) {
          const txt = [...titleEl.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
          if (txt) txt.textContent = mc.rival;
        }
      }
    }
  });
})();
