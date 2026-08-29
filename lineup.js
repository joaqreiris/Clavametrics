// ─────────────────────────────────────────────────────────────
// lineup.js — wires the composer to the poster.
// All position math + data is here. The HTML is the editable
// source-of-truth; this script reads/updates it.
// ─────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // XSS: escapa datos de la base antes de inyectarlos en innerHTML/etc.
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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

  // ── Country flags ────────────────────────────────────────────
  // `players.nationality` is FREE TEXT ("Brazil", "Brasil", "Camboya"…). The old code took the
  // first two letters and matched them against 8 hand-drawn CSS gradients — so Brazil rendered
  // as a flat green block, Uruguay ("ur") never matched 'uy', and everyone else got nothing.
  // Instead: resolve the text to an ISO-3166 alpha-2 code and render the flag emoji.
  // The name→code index is built from Intl.DisplayNames over every possible code in en/es/pt,
  // so every country is covered without shipping a lookup table.
  const _normCountry = s => String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '');

  // Informal names Intl doesn't know, plus split-nation cases.
  const COUNTRY_ALIASES = {
    usa: 'US', eeuu: 'US', 'estados unidos': 'US', uk: 'GB', inglaterra: 'GB', england: 'GB',
    scotland: 'GB', wales: 'GB', holanda: 'NL', holland: 'NL', 'corea del sur': 'KR',
    'south korea': 'KR', 'costa de marfil': 'CI', 'ivory coast': 'CI', 'cabo verde': 'CV',
    'republica checa': 'CZ', 'czech republic': 'CZ', rusia: 'RU', turquia: 'TR',
  };

  let _isoIndex = null;
  function _countryIso2 (raw) {
    const key = _normCountry(raw);
    if (!key) return null;
    if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
    // Already an ISO-2 code?
    if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
    if (!_isoIndex) {
      _isoIndex = new Map();
      const dns = ['en', 'es', 'pt'].map(l => {
        try { return new Intl.DisplayNames([l], { type: 'region' }); } catch (_) { return null; }
      }).filter(Boolean);
      for (let i = 0; i < 26; i++) {
        for (let j = 0; j < 26; j++) {
          const code = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
          dns.forEach(d => {
            let name; try { name = d.of(code); } catch (_) { return; }
            if (!name || name === code) return;          // unassigned code
            const k = _normCountry(name);
            if (k && !_isoIndex.has(k)) _isoIndex.set(k, code);
          });
        }
      }
    }
    return _isoIndex.get(key) || null;
  }

  // ISO-2 → regional-indicator pair. Platforms without flag glyphs (Windows) show the
  // two letters instead, which still reads as the country.
  function flagEmoji (iso2) {
    if (!iso2 || iso2.length !== 2) return '';
    return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }

  // ── Bench size: cada competición permite un banco distinto (5, 7, 9, 12…),
  //    así que el nº de slots es configurable por lineup (persistido en style_config).
  const SUB_MIN = 3, SUB_MAX = 15, SUB_DEFAULT = 7;

  // ── State (players populated async from Supabase)
  let state = {
    formation: '4-3-3',
    style: 'editorial',
    starters: [],
    subs: [],
    subSlots: SUB_DEFAULT,
    showNumbers: true,
    showCaptainBadge: true,
    language: 'en',
    titleColor: null,
    accentColor: null,
    bgColor: null,
  };

  // ── Module-level lineup context (set in init)
  let _lineupId   = null;
  let _lock       = null;
  let _clubId     = null;
  let _luTeamId   = null;
  async function luInitTeamSwitch (clubId) {
    const prof = await window.getProfile();
    const bucket = (prof?.role || prof?.club_role || '').toLowerCase();
    let full = bucket === 'admin' || bucket === 'owner';
    if (!full && window.isSuperAdmin) { try { full = await window.isSuperAdmin(); } catch {} }
    let teams = await window.getTeams(clubId);
    if (!full) { let mine=[]; try{mine=(await window.sb.rpc('my_team_ids')).data||[];}catch{} const s=new Set(mine); teams=teams.filter(t=>s.has(t.id)); }
    const sel = document.getElementById('luTeamSelect');
    if (!sel) return;
    if (!teams.length) { sel.innerHTML=`<option value="">${tt('lineup.no_teams', 'No teams')}</option>`; return; }
    const saved = sessionStorage.getItem('cal_active_team');
    _luTeamId = (saved && teams.some(t=>t.id===saved)) ? saved : teams[0].id;
    sel.innerHTML = teams.map(t=>`<option value="${t.id}" ${t.id===_luTeamId?'selected':''}>${esc(t.name)}</option>`).join('');
  }
  window.luOnTeamChange = function(){ _luTeamId=document.getElementById('luTeamSelect').value; sessionStorage.setItem('cal_active_team',_luTeamId); location.reload(); };
  let _saveTimer  = null;
  let _allPlayers    = [];
  let _picker               = null;
  let _pickerOutsideHandler = null;
  let _playersLoading       = true;
  let _currentMatch  = null;

  // ── i18n helper: t(key) with English fallback (already interpolated)
  function tt (key, fallbackEN, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
  }

  // ── Strings — resolved from i18n at render time (English is the fallback).
  //    `tagline` is overridden at runtime by club branding (see loadClubInfo/loadBranding).
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

  // Current UI strings, pulled live from the i18n runtime (falls back to English).
  // `tagline` keeps whatever club branding set on T.en (not translated).
  function uiStrings () {
    return {
      lineup:       tt('lineup.lineup', 'Lineup'),
      lineupHilite: tt('lineup.official', 'Official'),
      starting:     tt('lineup.starting_xi', 'Starting XI'),
      substitutes:  tt('lineup.substitutes', 'Substitutes'),
      coach:        tt('lineup.head_coach', 'HEAD COACH'),
      matchday:     tt('common.date', 'Date'),
      kickoff:      tt('lineup.kick_off', 'Kick-off'),
      venue:        tt('lineup.venue', 'Venue'),
      competition:  tt('lineup.competition', 'Competition'),
      tagline:      T.en.tagline,
      official:     tt('lineup.official', 'Official'),
    };
  }

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
        <div class="badge" data-cm-photo="${p.id}"${state.showNumbers ? ' data-cm-photo-keep-text="1"' : ''}>${esc(state.showNumbers ? p.num : (p.last[0] + (p.first[0]||'')))}</div>
        <div class="name">${esc(p.last)}</div>
      `;
      stage.appendChild(spot);
    });
  }

  // ── Render starting XI list in composer
  function renderComposer () {
    const xi = document.querySelector('[data-list="xi"]');
    const sub = document.querySelector('[data-list="subs"]');
    if (!xi || !sub) return;

    const flagHtml = p => p.flag
      ? `<span class="flag" title="${(p.nat || '').replace(/"/g, '&quot;')}">${flagEmoji(p.flag)}</span>`
      : '';

    const filledRow = (p, idx, kind) => `
      <div class="lu-row" data-kind="${kind}" data-idx="${idx}" data-pos="${p.role.toLowerCase()}" title="Click to change">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num">${esc(p.num)}</span>
        <div class="body">
          <div class="name">${esc(p.last)}, ${esc(p.first)}${flagHtml(p)}${p.captain ? '<span class="role-tag" style="background:rgba(217,119,6,0.12);color:#B45309">CAP</span>' : ''}${p.vice ? '<span class="role-tag" style="background:rgba(37,99,235,0.12);color:#1D4ED8">VC</span>' : ''}</div>
          <div class="meta">${p.role}</div>
        </div>
        <span class="role-tag ${p.role.toLowerCase()}">${p.role}</span>
        <button type="button" class="lu-row-x" title="${tt('lineup.remove_player','Remove player')}" aria-label="${tt('lineup.remove_player','Remove player')}"><i class="ti ti-x"></i></button>
      </div>`;

    const emptyRow = (posHint, idx, kind) => `
      <div class="lu-row is-empty" data-kind="${kind}" data-idx="${idx}" data-pos="${posHint.toLowerCase()}" title="Click to add player">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num"><i class="ti ti-user-plus" style="font-size:13px"></i></span>
        <div class="body">
          <div class="name lu-empty-label">${tt('lineup.select_player', 'Select player…')}</div>
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
      sub.innerHTML = Array.from({ length: state.subSlots }, () => skeletonRow()).join('');
      return;
    }

    xi.innerHTML = positions.map((pos, i) => {
      const p = state.starters[i];
      return p ? filledRow(p, i, 'xi') : emptyRow(pos.role, i, 'xi');
    }).join('');

    // Nunca ocultar un suplente ya cargado en un slot alto
    const subSlots = Math.max(state.subSlots, state.subs.length);
    sub.innerHTML = Array.from({ length: subSlots }, (_, i) => {
      const p = state.subs[i];
      return p ? filledRow(p, i, 'sub') : emptyRow('SUB', i, 'sub');
    }).join('');

    updateTabCounts();
    renderBenchCtl();
  }

  // ── Render the subs band on the poster
  function renderSubsBand () {
    const band = document.querySelector('[data-poster-subs]');
    if (!band) return;
    const filled = state.subs.filter(Boolean);
    band.innerHTML = filled.map(p => `
      <div class="pst-sub"><span class="n">${esc(p.num)}</span><span class="nm">${esc(p.last)}</span></div>
    `).join('');
    const ct = document.querySelector('[data-poster-subs-count]');
    if (ct) ct.textContent = filled.length;
  }

  // ── Render the match meta cells on the poster
  function renderPosterMeta () {
    const lang = uiStrings();
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

    const cap = state.starters.find(p => p && p.captain);
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

  // ── Pitch markings (drawn once) — the SAME engine the exercise planner uses.
  // The old hand-rolled SVG used viewBox "0 0 100 100" with preserveAspectRatio="none",
  // which STRETCHED a square drawing into the pitch box: the centre circle became an
  // ellipse and the boxes had invented proportions. CMField draws a real 105×68 pitch;
  // .pst-pitch carries the matching aspect-ratio so it fills the host exactly and the
  // formation's (x%, y%) coordinates still land where they should.
  function injectPitchLines () {
    const stage = document.querySelector('.pst-pitch');
    if (!stage || stage.querySelector('.pf-lines')) return;
    if (!window.CMField) { console.warn('[lineup] CMField not loaded — pitch markings skipped'); return; }
    window.CMField.renderField(stage, 'football', 'full', 'v');
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
  // Default sheet: a neutral off-white — readable, prints well, and is slightly distinct
  // from pure white so the poster edge still reads on paper. Never pure black.
  const POSTER_BG_DEFAULT = '#F2F2EF';

  // Perceived luminance (sRGB) → decides whether the sheet needs dark or light type.
  function _isLightHex (hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return true;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)) > 0.4;
  }

  function applyColors () {
    const poster = document.querySelector('.lu-poster');
    if (!poster) return;
    if (state.titleColor) poster.style.setProperty('--pst-title-color', state.titleColor);
    else poster.style.removeProperty('--pst-title-color');
    if (state.accentColor) poster.style.setProperty('--pst-em-color', state.accentColor);
    else poster.style.removeProperty('--pst-em-color');
    // Background is user-configurable like the type colours; the sheet flips its whole
    // type/line palette to stay legible on whatever they pick.
    const bg = state.bgColor || POSTER_BG_DEFAULT;
    poster.style.setProperty('--pst-bg', bg);
    poster.classList.toggle('is-light', _isLightHex(bg));
  }

  // Resolved --cm-accent as a #rrggbb hex (or null). <input type="color"> only accepts hex.
  function _clubAccentHex () {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--cm-accent').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    const m = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;
    return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
  }

  function wireColorPickers () {
    const titlePicker  = document.getElementById('luTitleColor');
    const accentPicker = document.getElementById('luAccentColor');
    // With no explicit override the poster inherits the club accent (--cm-accent), so the
    // swatch must show THAT, not the old hardcoded green.
    if (accentPicker && !state.accentColor) {
      const themed = _clubAccentHex();
      if (themed) accentPicker.value = themed;
    }
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
    const bgPicker = document.getElementById('luBgColor');
    if (bgPicker) bgPicker.value = state.bgColor || POSTER_BG_DEFAULT;
    bgPicker?.addEventListener('input', e => {
      state.bgColor = e.target.value;
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
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="ti ti-loader-2" style="font-size:14px"></i>${tt('lineup.generating', 'Generating…')}`; }
    try {
      await ensureH2C();
      const canvas = await html2canvas(poster, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        onclone: (doc) => {
          const accent = state.accentColor || _clubAccentHex() || '#4ADE80';
          const hx = accent.replace('#','');
          const r = parseInt(hx.slice(0,2),16), g = parseInt(hx.slice(2,4),16), b = parseInt(hx.slice(4,6),16);
          // html2canvas can't resolve color-mix(), so compute the SAME blends numerically.
          const mix = (pct, base) => 'rgb(' + base
            .map((c, i) => Math.round([r, g, b][i] * pct + c * (1 - pct)))
            .join(',') + ')';
          const light = doc.querySelector('.lu-poster')?.classList.contains('is-light');
          const sheet = doc.querySelector('.lu-poster');
          if (sheet) sheet.style.background = state.bgColor || POSTER_BG_DEFAULT;
          const p = doc.querySelector('.pst-pitch');
          if (p) {
            p.style.background = light
              ? `linear-gradient(180deg,${mix(0.17, [255, 255, 255])} 0%,${mix(0.09, [243, 245, 243])} 100%)`
              : 'linear-gradient(180deg,rgba(255,255,255,0.02) 0%,transparent 100%),'
                + `linear-gradient(180deg,${mix(0.26, [11, 26, 20])} 0%,${mix(0.10, [6, 14, 10])} 100%)`;
          }
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
      alert(tt('lineup.export_failed', 'Could not export image. Try Print → Save as PDF.'));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="ti ti-photo-down" style="font-size:14px"></i>${tt('lineup.download_png', 'Download PNG')}`; }
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
      if (!_lineupId) { showToast(tt('lineup.no_active_lineup', 'No active lineup')); return; }
      const { error } = await window.sb.from('lineups').update({ status: 'official' }).eq('id', _lineupId);
      if (error) { showToast(tt('lineup.error_prefix', 'Error: {msg}', { msg: error.message })); return; }
      showToast(tt('lineup.published_official', '✓ Official lineup published to #match-day'));
      renderPosterMeta();
    });

    document.getElementById('luShareDownload')?.addEventListener('click', () => {
      closeShareModal();
      downloadPoster();
    });

    document.getElementById('luShareLink')?.addEventListener('click', () => {
      closeShareModal();
      const url = `${location.origin}${location.pathname}?lineup=${_lineupId || ''}`;
      navigator.clipboard.writeText(url).then(() => showToast(tt('lineup.link_copied', '✓ Link copied to clipboard')));
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
    // Con equipo activo filtramos por MEMBRESÍA (player_teams!inner), no por players.team_id
    // (primario), para incluir jugadores multi-categoría en su categoría secundaria.
    const _luSel = 'id,first_name,last_name,number,position,positions,nationality'
      + (_luTeamId ? ', player_teams!inner(team_id)' : '');
    let _luPlQ = window.sb
      .from('players')
      .select(_luSel)
      .eq('club_id', clubId)
      .neq('status', 'inactive')
      .is('archived_at', null);
    if (_luTeamId) _luPlQ = _luPlQ.eq('player_teams.team_id', _luTeamId);
    const { data } = await _luPlQ.order('last_name');
    const _seenLu = new Set();
    _allPlayers = (data || []).filter(p => _seenLu.has(p.id) ? false : (_seenLu.add(p.id), true));
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

    const isFilled = kind === 'xi' ? !!state.starters[slotIdx] : !!state.subs[slotIdx];
    panel.innerHTML = `
      <div class="lu-picker-search">
        <i class="ti ti-search"></i>
        <input class="lu-picker-input" placeholder="${tt('lineup.search_player', 'Search player…')}">
      </div>
      ${isFilled ? `<button type="button" class="lu-picker-clear"><i class="ti ti-user-minus"></i>${tt('lineup.remove_player','Remove player')}</button>` : ''}
      <div class="lu-picker-list"></div>`;

    document.body.appendChild(panel);
    _picker = panel;

    const input = panel.querySelector('.lu-picker-input');
    const list  = panel.querySelector('.lu-picker-list');
    panel.querySelector('.lu-picker-clear')?.addEventListener('mousedown', e => {
      e.preventDefault();
      clearSlot(slotIdx, kind);
      closePicker();
    });

    // Exclude players already assigned to other slots
    const currentSlotId = kind === 'xi' ? state.starters[slotIdx]?.id : state.subs[slotIdx]?.id;
    const assignedIds = new Set([
      ...state.starters.filter(Boolean).map(p => p.id),
      ...state.subs.filter(Boolean).map(p => p.id),
    ].filter(id => id !== currentSlotId));

    // Sort once on open; only filter by text on each keystroke
    const baseList = _allPlayers
      .filter(p => !assignedIds.has(p.id))
      .map(p => ({ ...p, _pos: mapPosition(p.position), _posAll: [p.position, ...(p.positions || [])].filter(Boolean).map(mapPosition) }))
      .sort((a, b) => {
        const am = a._posAll.includes(posHint), bm = b._posAll.includes(posHint);
        if (am !== bm) return am ? -1 : 1;
        return (a.last_name || '').localeCompare(b.last_name || '');
      });

    const renderList = q => {
      const ql = (q || '').toLowerCase();
      const players = ql
        ? baseList.filter(p => `${p.last_name} ${p.first_name} ${p.number}`.toLowerCase().includes(ql))
        : baseList;

      if (!players.length) {
        list.innerHTML = `<div class="lu-picker-empty">${tt('lineup.no_players_found', 'No players found')}</div>`;
        return;
      }
      list.innerHTML = players.map(p => `
        <div class="lu-picker-row${p._posAll.includes(posHint) ? ' is-match' : ''}" data-id="${p.id}">
          <span class="lu-pr-num">${esc(p.number || '?')}</span>
          <span class="lu-pr-name">${esc(p.last_name)}, ${esc((p.first_name || '')[0] || '')}.</span>
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
        // The × clears the slot; it must not fall through to "open picker".
        if (e.target.closest('.lu-row-x')) {
          e.stopPropagation();
          clearSlot(+row.dataset.idx, row.dataset.kind);
          return;
        }
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
    const nat = squadPlayer.nationality || '';
    const p = {
      id:      squadPlayer.id,
      num:     squadPlayer.number || '?',
      last:    squadPlayer.last_name || '—',
      first:   squadPlayer.first_name ? squadPlayer.first_name[0] + '.' : '',
      role:    mapPosition(squadPlayer.position),
      captain: false,
      vice:    false,
      nat,
      flag:    _countryIso2(nat),
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
      .catch(err => showToast(tt('lineup.save_error', 'Save error: {msg}', { msg: err.message })));
  }

  // Empty a slot. Previously a player could only be swapped, never removed.
  function clearSlot (slotIdx, kind) {
    if (kind === 'xi') { if (state.starters[slotIdx]) state.starters[slotIdx] = null; }
    else               { if (state.subs[slotIdx])     state.subs[slotIdx]     = null; }
    renderComposer();
    renderPitch();
    renderSubsBand();
    unpersistSlot(slotIdx, kind)
      .catch(err => showToast(tt('lineup.save_error', 'Save error: {msg}', { msg: err.message })));
  }

  async function unpersistSlot (slotIdx, kind) {
    if (!_lineupId) return;
    const role = kind === 'xi' ? 'starter' : 'substitute';
    const { error } = await window.sb.from('lineup_players')
      .delete()
      .eq('lineup_id', _lineupId).eq('role', role).eq('slot_index', slotIdx);
    if (error) throw error;
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

  // ── Bench-size stepper (± slots de suplentes)
  // No se puede bajar por debajo del último slot ocupado: primero hay que vaciarlo.
  function _benchMinAllowed () {
    let lastFilled = -1;
    state.subs.forEach((p, i) => { if (p) lastFilled = i; });
    return Math.max(SUB_MIN, lastFilled + 1);
  }

  function setSubSlots (n) {
    n = Math.min(SUB_MAX, Math.max(_benchMinAllowed(), n));
    if (n === state.subSlots) return;
    state.subSlots = n;
    // Recorta los slots vacíos que quedaron por encima del nuevo tamaño
    while (state.subs.length > n && !state.subs[state.subs.length - 1]) state.subs.pop();
    renderComposer();
    scheduleSave();
  }

  function renderBenchCtl () {
    const ct = document.getElementById('luBenchCount');
    if (ct) ct.textContent = state.subSlots;
    const minus = document.getElementById('luBenchMinus');
    const plus  = document.getElementById('luBenchPlus');
    if (minus) minus.disabled = state.subSlots <= _benchMinAllowed();
    if (plus)  plus.disabled  = state.subSlots >= SUB_MAX;
  }

  function wireBenchCtl () {
    document.getElementById('luBenchMinus')?.addEventListener('click', () => setSubSlots(state.subSlots - 1));
    document.getElementById('luBenchPlus') ?.addEventListener('click', () => setSubSlots(state.subSlots + 1));
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
    let _luMatchQ = window.sb
      .from('calendar_events')
      .select('id,opponent,date,start_time,location,competition,home_away,title,rival_crest_url')
      .eq('club_id', clubId)
      .eq('type', 'match')
      .gte('date', today);
    if (_luTeamId) _luMatchQ = _luMatchQ.eq('team_id', _luTeamId);
    const { data } = await _luMatchQ
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
    // Coloca cada jugador en SU slot_index (array disperso). Compactar los huecos
    // corría a todos los jugadores de slot y el siguiente guardado los pisaba.
    const arr = [];
    (data || []).forEach(lp => {
      const p = lp.players || {};
      const nat = p.nationality || '';
      const idx = (Number.isInteger(lp.slot_index) && lp.slot_index >= 0 && lp.slot_index < 40)
        ? lp.slot_index : arr.length;
      arr[idx] = {
        id:      p.id,
        num:     p.number || '?',
        last:    p.last_name || '—',
        first:   p.first_name ? p.first_name[0] + '.' : '',
        role:    mapPosition(p.position),
        captain: lp.is_captain || false,
        vice:    lp.is_vice_captain || false,
        nat,
        flag:    _countryIso2(nat),
      };
    });
    return arr;
  }

  // ── Supabase: debounced save of lineup metadata (formation, style, language, colors)
  function scheduleSave () {
    if (!_lineupId) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      const styleConfig = {};
      if (state.titleColor)  styleConfig.title_color  = state.titleColor;
      if (state.accentColor) styleConfig.accent_color = state.accentColor;
      if (state.bgColor)     styleConfig.bg_color     = state.bgColor;
      if (state.subSlots !== SUB_DEFAULT) styleConfig.sub_slots = state.subSlots;
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
      if (saved) saved.textContent = tt('lineup.saved_just_now', 'Saved · just now');
    }, 500);
  }

  // ── Competition label map (calendar_events uses lowercase enum values)
  const COMP_LABELS = { league: 'League', cup: 'Cup', international: 'International', friendly: 'Friendly' };
  const fmtComp = c => {
    if (COMP_LABELS[c]) return tt('lineup.comp_' + c, COMP_LABELS[c]);
    return c ? c.charAt(0).toUpperCase() + c.slice(1) : '—';
  };

  // ── Banner: update .lu-mc + poster meta with calendar_event data
  function updateBanner (match) {
    const rival = match.opponent || match.title || '—';
    const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };

    const loc = (window.CM_I18N && CM_I18N.current) ? CM_I18N.current : 'en-GB';
    const fmtDate = d => {
      if (!d) return '—';
      return new Date(d + 'T12:00:00').toLocaleDateString(loc, { weekday:'short', day:'numeric', month:'short', year:'numeric' });
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
      ? `<i class="ti ti-home" style="font-size:11px"></i>${tt('lineup.home', 'Home')}`
      : `<i class="ti ti-plane" style="font-size:11px"></i>${tt('lineup.away', 'Away')}`;

    // Banner meta strip
    set('[data-banner-date]',  fmtDate(match.date));
    set('[data-banner-time]',  match.start_time ? match.start_time.slice(0,5) : '—');
    set('[data-banner-venue]', match.location || '—');
    set('[data-banner-comp]',  fmtComp(match.competition));

    // Poster meta cells
    const d = match.date ? new Date(match.date + 'T12:00:00') : null;
    const dateStr = d ? d.toLocaleDateString(loc, { weekday:'short', day:'numeric', month:'short' }) : '—';
    const yearStr = d ? d.getFullYear() : '';
    const homeAway = match.home_away === 'home' ? tt('lineup.home', 'Home') : match.home_away === 'away' ? tt('lineup.away', 'Away') : '';

    const setHtml = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    setHtml('[data-match-date]',  d ? `${dateStr}<small>${yearStr}</small>` : '—');
    setHtml('[data-match-time]',  match.start_time ? match.start_time.slice(0,5) : '—');
    setHtml('[data-match-venue]', match.location
      ? `${esc(match.location)}${homeAway ? `<small>${homeAway}</small>` : ''}`
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
    const firstTeam = tt('lineup.first_team', 'First team');
    const teamSub = season ? `${firstTeam} · ${season}` : firstTeam;
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
    const roleLabel = r => ({
      coach: tt('lineup.role_head_coach', 'Head coach'),
      staff: tt('lineup.role_staff', 'Staff'),
      admin: tt('lineup.role_director', 'Director'),
    }[r] || r);
    const roleTag   = r => ({ coach: 'HC', staff: 'AST', admin: 'MGR' }[r] || 'STF');
    list.innerHTML = data.map((p, i) => `
      <div class="lu-row" data-pos="mf">
        <span class="handle"><i class="ti ti-grip-vertical"></i></span>
        <span class="num">${p.role === 'coach' && i === 0 ? '<i class="ti ti-crown" style="font-size:13px;color:var(--cm-warning)"></i>' : '·'}</span>
        <div class="body">
          <div class="name">${esc(p.full_name || '—')}</div>
          <div class="meta">${roleLabel(p.role)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" class="lu-staff-check" data-pid="${p.id}" data-name="${(p.full_name || '').replace(/"/g,'&quot;')}" data-prole="${esc(p.role)}" title="${tt('lineup.include_in_lineup', 'Include in lineup')}">
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
      const small = await window.cmShrinkImage(file, { maxDim: 256, maxBytes: 60 * 1024 });
      const ext   = (small.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path  = `opponent-crests/${_clubId || 'default'}/${slug}.${ext}`;
      const { error } = await window.sb.storage.from('club-assets').upload(path, small, { upsert: true, contentType: small.type, cacheControl: window.CM_CACHE_IMMUTABLE });
      if (error) { showToast(tt('lineup.upload_failed', 'Upload failed: {msg}', { msg: error.message })); return; }
      // The path is canonical per opponent, so re-uploading reuses the URL. Version it so
      // the new crest actually shows instead of whatever the CDN and browser already hold.
      const { data: { publicUrl: _rawUrl } } = window.sb.storage.from('club-assets').getPublicUrl(path);
      const publicUrl = _rawUrl + '?v=' + Date.now();

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
      showToast(tt('lineup.opponent_crest_updated', 'Opponent crest updated'));
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
    wireExport();
    wireColorPickers();
    wireComposerDelegation();
    wireBenchCtl();

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

    if (!(await window.guardModule())) return;
    _clubId = await window.getClubId();
    window.cmLoadPlayerPhotos?.(_clubId);   // ceba caché de fotos por club (fire-and-forget)
    // Must run AFTER the club is resolved: applyClubTheme() reads getClub() and bails out
    // silently when there's no club yet, which left the page on the default green.
    try { await window.applyClubTheme?.(); } catch (_) {}
    const _accentPicker = document.getElementById('luAccentColor');
    if (_accentPicker && !state.accentColor) {
      const themed = _clubAccentHex();
      if (themed) _accentPicker.value = themed;
    }
    await luInitTeamSwitch(_clubId);

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
        // Aviso de edición simultánea: el 11 se arma a cuatro manos (DT y
        // ayudante) y esta fila la escriben los dos. No bloquea —frenar a
        // alguien a mitad del armado es peor— solo avisa quién más está
        // adentro y marca el campo donde está parado. Ver assets/cm-lock.js.
        if (window.cmLock && _clubId) {
          if (_lock) _lock.setResource('lineup:' + _lineupId);
          else _lock = window.cmLock.claim({
            resource: 'lineup:' + _lineupId,
            clubId:   _clubId,
            label:    tt('lineup.lock_label', 'this lineup'),
            warnOnly: true,
            fields:   'input[id^="lu"], select[id^="lu"], textarea[id^="lu"]',
          });
        }
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
        if (lineup.style_config?.bg_color) {
          state.bgColor = lineup.style_config.bg_color;
          const p = document.getElementById('luBgColor');
          if (p) p.value = state.bgColor;
        }
        const savedSlots = parseInt(lineup.style_config?.sub_slots, 10);
        if (savedSlots >= SUB_MIN && savedSlots <= SUB_MAX) state.subSlots = savedSlots;
        applyColors();

        const [starters, subs] = await Promise.all([
          loadLineupPlayers(lineup.id, 'starter'),
          loadLineupPlayers(lineup.id, 'substitute'),
          loadLineupStaff(lineup.id),
        ]);
        if (starters.length) state.starters = starters;
        if (subs.length)     state.subs = subs;
        // Si hay más suplentes guardados que slots configurados, el banco crece
        state.subSlots = Math.max(state.subSlots, state.subs.length);
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

  // ── Re-paint JS-rendered chrome when the language changes.
  // Static [data-i18n] nodes are handled by the i18n runtime; here we only
  // re-run the renderers that build text from JS strings. State (starters,
  // subs, formation, drag) is untouched — we just repaint labels.
  document.addEventListener('cm:langchanged', () => {
    renderComposer();      // "Select player…" empty labels + tab counts
    renderSubsBand();      // poster subs band
    renderPosterMeta();    // poster meta labels (Date / Kick-off / Venue / Competition / titles)
    if (_currentMatch) updateBanner(_currentMatch);  // date/home-away/competition in locale
    if (_clubId) {
      loadClubInfo(_clubId);                                   // "First team · season"
      renderStaff(_clubId).then(() => {                        // staff role labels
        if (_lineupId) loadLineupStaff(_lineupId);             // re-check saved staff
      });
    }
  });
})();
