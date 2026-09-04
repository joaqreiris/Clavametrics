/* ─────────────────────────────────────────────────────────────────────────
   calendar.js — primera mitad de la página Calendar.

   Estaba escrito dentro de Calendar.html. Entre este archivo y su pareja eran
   296 KB de los 426 KB de la página, y viajaban enteros en cada visita porque
   el HTML no se cachea. En un archivo aparte el navegador los guarda.

   Va con defer. Comprobado antes de moverlo: los 28 elementos que engancha sin
   protección están todos por encima de donde estaba escrito, y el único
   elemento nuevo que vería el querySelectorAll de .cm-btn.is-primary es el
   botón "Save settings", que no pasa su filtro (exige la palabra "event").
   ──────────────────────────────────────────────────────────────────────── */
// ── i18n helpers ───────────────────────────────────────────────
function tt(key, fallbackEN, vars){ const v=(window.CM_I18N&&CM_I18N.t)?CM_I18N.t(key,vars):null; return (v&&v!==key)?v:(fallbackEN!=null?fallbackEN:key); }
function ttLocale(){ return (window.CM_I18N && window.CM_I18N.current) || 'en-GB'; }
// ── State ──────────────────────────────────────────────────────
let _allMCs = [], _mcIdx = 0, _sessions = [], _weekOffset = 0, _filterType = 'all', _clubId = null, _editEvtId = null, _editEvtSource = null, _editMcId = null;
let _activeTeamId = null, _myTeams = [];
let _currentUserId = null, _currentUserName = null;
let _calView = 'microcycle', _monthY = new Date().getFullYear(), _monthM = new Date().getMonth();
let _ribbonV2Meta = null;    // { ribbonStart, ribbonEnd } — set by renderSeasonRibbonV2 for px-engine controls
let _ribbonV2Centered = false; // V2 initial auto-scroll to today done once (don't yank scroll on re-render)
let _calComps = [];          // competitions of the active season (from Annual Planner)
let _calSeasonId = null;     // id of the active/most-recent season for this team
let _calPlanModel = 'tactical';   // seasons.planning_model of the active season (gates micro_type)
let _calSeason = null;       // full active/most-recent season row
let _calPhases = [];         // season_phases of the active season → riel de etapas del ribbon
let _matchSessions = [];     // calendar_events with type='match'
let _ribbonViewRange = null; // { from, to } when sub-range active; null = full season
let _ribbonZoomIdx = 2;           // índice en RIBBON_ZOOM
const RIBBON_ZOOM = [10, 13, 16, 20, 25];  // px por día
const RIBBON_GUTTER = 28;         // padding lateral del track, px
const RIBBON_GAP = 5;             // separación entre chips, px
let _monthEvts = []; // full session objects for month view click handlers
// training_sessions ids that already carry a plan (have exercises) → "planned" badge, so an
// empty session shell is distinguishable from a real planned one at a glance.
let _plannedIds = new Set();
let _pendingCrestUrl = null; // staged crest URL after Storage upload, written to DB on save
let _pubMedCount = 0, _pubBoardCount = 0; // profile counts by role
let _activeShareLink = null; // active share_link row for current MC (players scope)
const TODAY = cmToday();

const EVT_ICONS = {
  training:'ti-soccer-field', beach:'ti-beach', outdoor:'ti-run', gym:'ti-barbell', match:'ti-ball-football',
  recovery:'ti-heart-rate-monitor', travel:'ti-plane',
  meeting:'ti-users', evaluation:'ti-clipboard-list', video:'ti-device-desktop',
  breakfast:'ti-coffee', lunch:'ti-soup', dinner:'ti-tools-kitchen', snack:'ti-apple',
  hotel:'ti-bed', bus:'ti-bus',
  press:'ti-microphone', medical:'ti-stethoscope', physio:'ti-physotherapist',
  prevention:'ti-shield-check',
  walkthrough:'ti-walk', scouting:'ti-binoculars',
  'day-off':'ti-beach',
};
function focusToClass(focus) {
  if (!focus) return 'training';
  const f = focus.toLowerCase();
  if (f === 'match')                                         return 'match';
  if (f === 'gym')                                           return 'gym';
  if (f === 'recovery')                                      return 'recovery';
  if (f === 'travel')                                        return 'travel';
  if (f === 'meeting')                                       return 'meeting';
  if (f === 'evaluation')                                    return 'evaluation';
  if (f === 'video' || f === 'video-session' || f === 'video_session') return 'video';
  if (f === 'breakfast')                                     return 'breakfast';
  if (f === 'lunch')                                         return 'lunch';
  if (f === 'dinner')                                        return 'dinner';
  if (f === 'snack')                                         return 'snack';
  if (f === 'hotel_checkin' || f === 'hotel_checkout')       return 'hotel';
  if (f === 'bus_departure' || f === 'bus_arrival')          return 'bus';
  if (f === 'press')                                         return 'press';
  if (f === 'medical_check')                                 return 'medical';
  if (f === 'physio')                                        return 'physio';
  if (f === 'prevention')                                    return 'prevention';
  if (f === 'walkthrough')                                   return 'walkthrough';
  if (f === 'scouting')                                      return 'scouting';
  if (f === 'day_off')                                       return 'day-off';
  return 'training'; // tactical, conditioning, other, training
}

// ── Day off: total vs parcial ─────────────────────────────────
// player_ids NULL/[] = day off de TODO el equipo (bloquea el día). Con ids = day off
// PARCIAL: solo esos jugadores libres, el día sigue abierto para entrenar al resto.
function _isFullDayOff(s)    { return s.session_type === 'day_off' && !(Array.isArray(s.player_ids) && s.player_ids.length); }
function _isPartialDayOff(s) { return s.session_type === 'day_off' && Array.isArray(s.player_ids) && s.player_ids.length > 0; }

// URL de planificación de un evento (doble click / popover). null = no navegable.
function _evtPlanUrl(s) {
  if (!s || _calView === 'player' || !s.session_date) return null;
  const cat = focusToClass(s.session_type);
  if (cat === 'gym')      return `Gym Planner.html?date=${s.session_date}`;
  if (cat === 'training') return `Daily Planning.html?date=${s.session_date}${s.source === 'session' && s.id ? `&session=${s.id}` : ''}`;
  return null;
}

// Plantel del equipo activo (cache por equipo) — para el picker del day off parcial y el popover.
let _calSquadCache = null, _calSquadTeam = null;
async function calGetSquad() {
  if (_calSquadCache && _calSquadTeam === _activeTeamId) return _calSquadCache;
  try {
    const { data } = await window.sb.from('players')
      .select('id,first_name,last_name,number,position, player_teams!inner(team_id)')
      .eq('club_id', _clubId).eq('player_teams.team_id', _activeTeamId).is('archived_at', null);
    _calSquadCache = (data || []).sort((a, b) => (a.number || 999) - (b.number || 999) || `${a.last_name||''}`.localeCompare(`${b.last_name||''}`));
    _calSquadTeam  = _activeTeamId;
  } catch (_) { _calSquadCache = []; _calSquadTeam = _activeTeamId; }
  return _calSquadCache;
}

// Sincroniza availability con el day off parcial: los destildados/borrados vuelven a quedar
// sin registro; los tildados se guardan con status='day_off' (relativo al equipo). El tilde
// es intención explícita del staff: pisa cualquier estado previo del día, incluso los globales
// (lesión/enfermedad/selección) — un lesionado con day off se muestra como day off. La lesión
// en sí no se pierde (vive en injuries): al quitar el day off vuelve a verse como lesionado.
async function calSyncDayOffAvail(prev, next) {
  try {
    const clubId = _clubId || await window.getClubId();
    if (prev && prev.ids && prev.ids.length) {
      const keep = new Set((next && next.date === prev.date ? next.ids : []).map(String));
      const gone = prev.ids.filter(id => !keep.has(String(id)));
      if (gone.length) {
        await window.sb.from('availability').delete()
          .eq('club_id', clubId).eq('date', prev.date).eq('status', 'day_off').in('player_id', gone);
      }
    }
    if (next && next.ids && next.ids.length) {
      const rows = next.ids.map(pid => ({
        player_id: pid, date: next.date, status: 'day_off', minutes: 0,
        club_id: clubId, team_id: _activeTeamId, notes: null
      }));
      await window.sb.from('availability').upsert(rows, { onConflict: 'player_id,date' });
    }
  } catch (e) { console.warn('day-off availability sync:', e); }
}
// Intl-based day/month names (localized via CM_I18N.current). No hardcoded EN arrays.
function dayShort(d) { return new Date(2021, 7, 1 + (d instanceof Date ? d.getDay() : d)).toLocaleDateString(ttLocale(), { weekday:'short' }); }
function monthShort(m) { return new Date(2021, (m instanceof Date ? m.getMonth() : m), 1).toLocaleDateString(ttLocale(), { month:'short' }); }

function fmtShort(d) { return `${dayShort(d)} ${d.getDate()} ${monthShort(d)}`; }
function addDays(dateStr, n) { const [y,mo,d] = dateStr.split('-').map(Number); const r = new Date(y, mo-1, d+n); return r.getFullYear()+'-'+String(r.getMonth()+1).padStart(2,'0')+'-'+String(r.getDate()).padStart(2,'0'); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function showCalToast(msg) {
  const t = document.getElementById('calToast');
  t.textContent = msg; t.classList.add('is-show');
  setTimeout(() => t.classList.remove('is-show'), 2800);
}

// ── Visible-to audience defaults per event type ─────────────────
// Values returned here are the NON-staff audiences (staff is always included)
const VISIBLE_TO_DEFAULTS = {
  match:         ['players','medical'],
  training:      ['players','medical'],
  beach:         ['players','medical'],
  outdoor:       ['players','medical'],
  tactical:      ['players','medical'],
  gym:           ['players','medical'],
  recovery:      ['players','medical'],
  conditioning:  ['players','medical'],
  travel:        ['players','medical'],
  walkthrough:   ['players','medical'],
  breakfast:     ['players','medical'],
  lunch:         ['players','medical'],
  dinner:        ['players','medical'],
  snack:         ['players','medical'],
  hotel_checkin: ['players','medical'],
  hotel_checkout:['players','medical'],
  bus_departure: ['players','medical'],
  bus_arrival:   ['players','medical'],
  day_off:       ['players','medical'],
  press:         ['players','medical'],
  other:         ['players','medical'],
  meeting:       [],
  scouting:      [],
  evaluation:    [],
  video_session: [],
  medical_check: ['medical'],
  physio:        ['players','medical'],
  prevention:    ['players','medical'],
};

function getVisibleToFromChips() {
  const on = Array.from(document.querySelectorAll('#calEvtVisChips .cal-vis-chip[data-vis].is-on'))
    .map(c => c.dataset.vis);
  return ['staff', ...on];
}

function setVisibleToChips(visibleTo) {
  const arr = Array.isArray(visibleTo) ? visibleTo : ['staff'];
  document.querySelectorAll('#calEvtVisChips .cal-vis-chip[data-vis]').forEach(chip => {
    chip.classList.toggle('is-on', arr.includes(chip.dataset.vis));
  });
}

function setVisibleToDefaults(type) {
  const extras = VISIBLE_TO_DEFAULTS[type] || [];
  document.querySelectorAll('#calEvtVisChips .cal-vis-chip[data-vis]').forEach(chip => {
    chip.classList.toggle('is-on', extras.includes(chip.dataset.vis));
  });
}

// Wire chip clicks
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#calEvtVisChips .cal-vis-chip[data-vis]').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('is-on'));
  });
});

// Microcycle select fields — module-level so accessible from all listeners
const MC_BASE_SELECT = 'id,name,start_date,end_date,match_date,rival,home_away,color,match_time,stadium,md_overrides,micro_type';
const MC_FULL_SELECT = MC_BASE_SELECT + ',publish_players,publish_medical,publish_board,published_at,publish_config';

// Micro type (Seirul·lo typed micros) — mirror Annual Planner's model gating so we don't
// offer a concept the season's periodization model doesn't use. Same keys as PLAN_MODELS/MICRO_TYPES.
const CAL_PLAN_USES_MICROTYPE = { tactical:false, structured:true, atr:false, verheijen:false };
const CAL_MICRO_TYPES = ['adjustment','load','impact','competitive'];
const CAL_MICROTYPE_FB = { adjustment:'Adjustment', load:'Load', impact:'Impact', competitive:'Competitive' };
function calModelUsesMicroType(){ return !!CAL_PLAN_USES_MICROTYPE[_calPlanModel || 'tactical']; }
function calMicroTypeLabel(k){ return tt('annual_planner.microtype_' + k, CAL_MICROTYPE_FB[k] || k); }

// ── Publish state ────────────────────────────────────────────────
function _pubBadgeEl(group) { return document.getElementById('calPubBadge' + group.charAt(0).toUpperCase() + group.slice(1)); }
function _pubLabelEl(group) { return document.getElementById('calPubLabel' + group.charAt(0).toUpperCase() + group.slice(1)); }

function renderPublishState() {
  const mc = _allMCs[_mcIdx];
  if (!mc) return;

  // Players badge: driven by active share link (not publish_players flag)
  const playersBadge = _pubBadgeEl('players');
  const playersLabel = _pubLabelEl('players');
  if (playersBadge && playersLabel) {
    if (_activeShareLink) {
      playersBadge.className = 'cm-pill is-success';
      const msAgo = Date.now() - new Date(_activeShareLink.created_at).getTime();
      const daysAgo = Math.round(msAgo / 86400000);
      playersLabel.textContent = daysAgo === 0 ? tt('calendar.published_today','Published today') : tt('calendar.published_days_ago','Published · {n}d ago',{n:daysAgo});
    } else {
      playersBadge.className = 'cm-pill is-warning';
      playersLabel.textContent = tt('calendar.draft','Draft');
    }
    playersBadge.style.cursor = 'pointer';
  }

  // Medical and Board: toggle-based (unchanged)
  for (const { key, field } of [
    { key: 'medical', field: 'publish_medical' },
    { key: 'board',   field: 'publish_board'   },
  ]) {
    const published = !!mc[field];
    const badge = _pubBadgeEl(key);
    const label = _pubLabelEl(key);
    if (!badge || !label) continue;
    badge.className = 'cm-pill ' + (published ? 'is-success' : 'is-warning');
    badge.style.cursor = 'pointer';
    label.textContent = published ? tt('calendar.published','Published') : tt('calendar.draft','Draft');
  }
}

async function togglePublishGroup(group) {
  const mc = _allMCs[_mcIdx];
  if (!mc) return;
  const field = { players: 'publish_players', medical: 'publish_medical', board: 'publish_board' }[group];
  if (!field) return;
  const next = !mc[field];
  const patch = { [field]: next };
  if (next && !mc.published_at) patch.published_at = new Date().toISOString();
  const { error } = await window.sb.from('microcycles').update(patch).eq('id', mc.id);
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  mc[field] = next;
  if (patch.published_at) mc.published_at = patch.published_at;
  renderPublishState();
  const _gLabel = tt('calendar.grp_'+group, group.charAt(0).toUpperCase() + group.slice(1));
  showCalToast(next ? tt('calendar.group_published','{group} published.',{group:_gLabel}) : tt('calendar.group_draft','{group} set to draft.',{group:_gLabel}));
}

// Badge click handlers
document.getElementById('calPubBadgePlayers').addEventListener('click', () => openShareModal());
document.getElementById('calHeadExportBtn')?.addEventListener('click', () => exportPDF());
document.getElementById('calDaySheetBtn')?.addEventListener('click', () => openDaySheet());
document.getElementById('calPubBadgeMedical').addEventListener('click', () => togglePublishGroup('medical'));
document.getElementById('calPubBadgeBoard').addEventListener('click', () => togglePublishGroup('board'));

// ── Manage modal ─────────────────────────────────────────────────
const _PUB_CFG_DEFAULTS = {
  players_type: true, players_time: true, players_duration: true, players_location: true,
  medical_physio: true, medical_injury_status: true, medical_load: true,
  board_sessions: true, board_load: true, board_match: true,
};
const _PUB_CFG_KEYS = Object.keys(_PUB_CFG_DEFAULTS);

function openPubManageModal() {
  const mc = _allMCs[_mcIdx];
  const cfg = Object.assign({}, _PUB_CFG_DEFAULTS, mc?.publish_config || {});
  for (const k of _PUB_CFG_KEYS) {
    const el = document.getElementById('calPubCfg_' + k);
    if (el && !el.disabled) el.checked = !!cfg[k];
  }
  document.getElementById('calPubManageBackdrop').classList.add('is-open');
}

async function savePubManageModal() {
  const mc = _allMCs[_mcIdx];
  if (!mc) return;
  const cfg = {};
  for (const k of _PUB_CFG_KEYS) {
    const el = document.getElementById('calPubCfg_' + k);
    cfg[k] = el && !el.disabled ? el.checked : false;
  }
  const { error } = await window.sb.from('microcycles').update({ publish_config: cfg }).eq('id', mc.id);
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  mc.publish_config = cfg;
  document.getElementById('calPubManageBackdrop').classList.remove('is-open');
  showCalToast(tt('calendar.visibility_settings_saved','Visibility settings saved.'));
}

document.getElementById('calPubManageBtn')?.addEventListener('click', openPubManageModal);
// Modal elements rendered after the script tag — bind via delegation at DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('calPubManageClose')?.addEventListener('click', () => document.getElementById('calPubManageBackdrop')?.classList.remove('is-open'));
  document.getElementById('calPubManageCancel')?.addEventListener('click', () => document.getElementById('calPubManageBackdrop')?.classList.remove('is-open'));
  document.getElementById('calPubManageSave')?.addEventListener('click', savePubManageModal);
  document.getElementById('calPubManageBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('is-open'); });
});

// ── Render grid (continuous view — all MC days in one scrollable row) ──────────────
let _dragId = null, _dragDate = null, _dragHasTime = false, _dropTargetId = null, _dropTargetDate = null;
// Copy/paste clipboard for events (right-click / Ctrl+click). Holds the merged session object.
let _clipEvt = null;

// Cancel drag with ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _dragId) {
    _dragId = null; _dragDate = null; _dragHasTime = false;
    _dropTargetId = null; _dropTargetDate = null;
    document.body.classList.remove('is-dragging');
    document.querySelectorAll('.mc-evt.is-dragging').forEach(x => x.classList.remove('is-dragging'));
    document.querySelectorAll('.mc-evt.drag-over').forEach(x => x.classList.remove('drag-over'));
    document.querySelectorAll('.mc-day.drag-target,.mc-day.drag-target-warn').forEach(x => x.classList.remove('drag-target','drag-target-warn'));
  }
});

function renderGrid() {
  closeEvtPopover();
  closeMatchPopover();
  const mc = _allMCs[_mcIdx];
  const grid = document.getElementById('calDaysGrid');
  if (!mc || !grid) return;

  const start = mc.start_date, end = mc.end_date;
  const totalDays = daysBetween(start, end) + 1;

  // Header
  document.getElementById('calMcTitle').textContent = (mc.name || tt('calendar.mc_word','Microcycle')) + ' · ' + tt('calendar.daily_plan_suffix','daily plan');
  document.getElementById('calMcSub').textContent =
    `${fmtShort(new Date(start))} → ${fmtShort(new Date(end))} · ${_sessions.length} ${tt('calendar.sessions_word','sessions')}`;

  // Pager: hide prev/next, show total days only
  const prevBtn = document.getElementById('calWeekPrev');
  const nextBtn = document.getElementById('calWeekNext');
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';
  document.getElementById('calWeekLabel').innerHTML =
    `<i class="ti ti-calendar-event"></i>${totalDays}<span class="yr" style="margin-left:4px">${tt('calendar.days_word','days')}</span>`;

  // Summary row — rival: resolve the MC's match from calendar_events
  const _mcMatch = mcMatch(mc);
  const _targetRival = _mcMatch ? (_mcMatch.opponent || (_mcMatch.title||'').replace(/^vs\s*/i,'')) : null;
  const _targetHa    = _mcMatch?.home_away || '';
  const _calMcTargetEl = document.getElementById('calMcTarget');
  if (_calMcTargetEl) _calMcTargetEl.innerHTML = _targetRival ? `${_targetRival}<small>${_targetHa ? ' · '+_targetHa : ''}</small>` : '—';
  const trainCt = _sessions.filter(s => focusToClass(s.session_type) === 'training').length;
  const gymCt   = _sessions.filter(s => focusToClass(s.session_type) === 'gym').length;
  document.getElementById('calMcSessions').innerHTML = `${trainCt}<small>${tt('calendar.field_plus_gym','field + {n} gym',{n:gymCt})}</small>`;
  const totalMin = _sessions.reduce((a, s) => a + (s.duration || 0), 0);
  document.getElementById('calMcDuration').innerHTML = totalMin ? `${Math.round(totalMin/60)}h <small>${totalMin % 60 ? (totalMin % 60) + 'min' : ''}</small>` : '—';
  document.getElementById('calMcLength').innerHTML = `${totalDays}<small>${tt('calendar.days_word','days')}</small>`;

  // Publish state panel
  renderPublishState();

  // Top bar MC heading
  const mcName = mc.name || tt('calendar.mc_word','Microcycle');
  let headMdLabel = '';
  if (_mcMatch) {
    const diff = daysBetween(TODAY, _mcMatch.session_date);
    headMdLabel = diff === 0 ? ' · MD' : diff > 0 ? ` · MD−${diff}` : ` · MD+${Math.abs(diff)}`;
  }
  const headTarget = _mcMatch ? ` · <strong>${_targetRival}</strong>` : '';
  const headEl = document.getElementById('calHeadCtx');
  if (headEl) headEl.innerHTML = `<strong>${mcName}</strong>${headMdLabel}${headTarget}`;

  const isPlayerView = _calView === 'player';
  grid.className = 'mc-days' + (isPlayerView ? ' is-player-view' : '');

  // Update player banner
  const banner = document.getElementById('calPlayerBanner');
  if (banner) {
    if (isPlayerView) {
      const playerEvtCount = _sessions.filter(s => Array.isArray(s.visible_to) && s.visible_to.includes('players')).length;
      document.getElementById('calPlayerBannerCount').textContent = playerEvtCount;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }

  // Build all day columns
  // Fechas de partido del MC (TODAS, no solo la última): en semanas con doble partido el MD
  // «Auto» cuenta contra el partido MÁS CERCANO, igual que Club overview / GPS / Load Planner.
  const _mDates = [...new Set((_matchSessions || [])
    .filter(s => s.session_date >= start && s.session_date <= end)
    .map(s => s.session_date))].sort();
  let html = '';
  for (let i = 0; i < totalDays; i++) {
    const dateStr = addDays(start, i);
    const d = new Date(dateStr + 'T12:00:00');
    const isToday = dateStr === TODAY;
    const allDaySessions = _sessions.filter(s => s.session_date === dateStr);
    // Solo el day off de equipo entero bloquea el día; el parcial se muestra como card normal
    const hasDayOff = allDaySessions.some(_isFullDayOff);
    // In player view: only show events visible to players
    const daySessions = isPlayerView
      ? allDaySessions.filter(s => Array.isArray(s.visible_to) && s.visible_to.includes('players'))
      : allDaySessions;
    const isOff = daySessions.length === 0;

    // Nearest-match label, now via the shared engine (lib/day-context.js) so the grid, the
    // printed sheets, Daily Planning and the Gym Planner all answer the same thing. The
    // override is read separately below because this grid renders it with its own styling.
    const _md = window.cmMdForDate(dateStr, _mDates, { display: true });
    const mdLabel = _md.label;
    // Equidistant from a match before and a match after: there is no right answer, so the
    // chip says so and the day plan settles it (the MD of the session wins over the derived one).
    const mdAmbiguous = _md.ambiguous;
    // Override viejo del microciclo: ya no se puede crear desde acá (el chip es de solo
    // lectura), pero se sigue respetando como último recurso para no cambiar semanas ya
    // armadas. Se limpia con «MD automático» del menú contextual del día.
    const dayOverride = (mc.md_overrides && mc.md_overrides[dateStr]) || null;
    // MD de las sesiones del día (Daily Planning / Gym Planner), en forma canónica (cmMdNorm:
    // el tag derivado puede venir en U+2212 y la columna en ASCII/'MD0').
    const _mdN = window.cmMdNorm || (v => String(v || ''));
    // Todo trabajo pesa igual: una dinámica de recuperación puede hacerse en gimnasio, en
    // campo o como activación — el dónde no cambia que sea una dinámica con su propio MD.
    // Por eso cuentan las dos fuentes: training_sessions y calendar_events.
    const sessMds = [...new Set(
      daySessions.filter(s => s.match_day_offset)
        .map(s => _mdN(s.match_day_offset)).filter(Boolean)
    )];
    // Prioridad del chip del día: día libre → DÍA DE PARTIDO (siempre 'MD': una sesión de la
    // mañana no lo destrona) → lo planificado en las sesiones (el chip lleva el de la primera
    // del día; una segunda dinámica sale como chip punteado aparte) → override viejo →
    // derivado del partido más cercano. El chip NO se edita acá: el MD se cambia en la
    // planificación del día (Daily Planning / Gym Planner).
    const tagText  = hasDayOff ? 'OFF'
                   : mdLabel === 'MD' ? 'MD'
                   : (sessMds[0] || dayOverride || mdLabel);
    const isMatchTag = tagText === 'MD';
    const tagStyle = (!hasDayOff && isMatchTag) ? 'background:var(--cm-danger-bg);color:var(--cm-danger);border-color:var(--cm-danger-bd)' : '';
    const _fromOverride = !hasDayOff && !sessMds.length && !!dayOverride && mdLabel !== 'MD';
    const _showAmbiguous = mdAmbiguous && !sessMds.length && !dayOverride && !hasDayOff && mdLabel !== 'MD';
    const groupChips = hasDayOff ? '' : sessMds.slice(1)
      .map(v => `<span class="mc-day-md2" title="${tt('calendar.group_md_hint','Group MD — set per session in Daily Planning')}">${_esc(v)}</span>`).join('');
    const mdTip = _showAmbiguous
      ? tt('calendar.md_tie_hint','Same distance to the match before and the match after — set it in the day plan')
      : tt('calendar.md_readonly_hint','Day type — set it in the day plan (Daily Planning / Gym Planner)');

    const eventsHtml = hasDayOff ? '' : isOff
      ? `<div class="mc-evt day-off">${tt('calendar.rest_day','Rest day')}</div>`
      : daySessions.filter(s => (_filterType === 'all' || focusToClass(s.session_type) === _filterType) && !_isFullDayOff(s)).map(s => {
          const cat = focusToClass(s.session_type);
          // Outdoor/beach are training-class substitutes: keep training routing/filters but give them
          // their own icon, label and colour (modifier class) so they read as distinct events.
          const isOutdoorTrain = s.session_type === 'beach' || s.session_type === 'outdoor';
          const icon = cat === 'travel' ? ({ bus:'ti-bus', flight:'ti-plane', train:'ti-train' }[s.travel_mode] || 'ti-plane')
                     : isOutdoorTrain ? EVT_ICONS[s.session_type] : (EVT_ICONS[cat] || 'ti-calendar');
          const dur = s.duration ? ` ${s.duration}′` : '';
          const timeStr = s.start_time ? s.start_time.slice(0, 5) : '';
          // Training: show the custom title if the user renamed it, else the generic "Training"
          // label. No minutes (MD tag already lives in the day header).
          const evtName   = isOutdoorTrain ? evtTypeLabel(s.session_type)
                          : cat === 'training' ? (s.title || tt('calendar.filter_training','Training'))
                          : _isPartialDayOff(s) ? `${s.title || evtTypeLabel('day_off')} · ${s.player_ids.length}`
                          : (s.title || s.session_type || cat);
          const durSuffix = cat === 'training' ? '' : dur;
          // AU hidden in player view (staff-only metric)
          const au = (!isPlayerView && s.duration && s.estimated_rpe)
            ? `<span class="mc-evt-au" style="font:600 10px/1 var(--cm-font-mono);color:var(--cm-fg-faint);margin-left:auto">${s.duration * s.estimated_rpe} AU</span>`
            : '';
          const leadEl = (cat === 'match' && s.rival_crest_url)
            ? `<img src="${_esc(s.rival_crest_url)}" style="width:14px;height:14px;border-radius:50%;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="">`
            : `<i class="ti ${icon}"></i>`;
          // Preventivo obligatorio: se marca en rojo y arrastra su nota debajo, porque
          // "obligatorio" sin decir qué hay que hacer no le sirve a nadie.
          const isMandatory = cat === 'prevention' && s.is_mandatory;
          const sub = (isMandatory && s.notes)
            ? `<span class="sub">${_esc(s.notes)}</span>` : '';
          return `<div class="mc-evt ${cat}${isOutdoorTrain ? ' st-' + _esc(s.session_type) : ''}${isMandatory ? ' is-mandatory' : ''}" data-id="${s.id}" data-date="${dateStr}" data-has-time="${s.start_time ? '1' : '0'}" draggable="true">
            ${leadEl}
            ${timeStr ? `<span class="time">${timeStr}</span>` : ''}
            <span class="name" title="${_esc(evtName + durSuffix)}">${_esc(evtName)}${_esc(durSuffix)}</span>${au}${sub}
          </div>`;
        }).join('') || `<div class="mc-evt day-off" style="font-style:italic;opacity:0.6">${tt('calendar.hidden_by_filter','Hidden by filter')}</div>`;

    // In player view hide the + Add button
    const addBtn = (isPlayerView || hasDayOff) ? '' : `<button class="mc-evt" style="border-style:dashed;color:var(--cm-fg-faint);justify-content:center;font-size:11px" data-add-date="${dateStr}">${tt('calendar.add','+ Add')}</button>`;

    // Chip de video: cuántos hay de ese día y atajo al Video Room parado ahí.
    const _vidN = _videoDays[dateStr] || 0;
    const _vidChip = (!isPlayerView && _vidN)
      ? `<a class="mc-day-vid" href="Video Room.html?date=${dateStr}" title="${_esc(tt('calendar.videos_n','{n} videos',{n:_vidN}))}"><i class="ti ti-movie"></i>${_vidN}</a>`
      : '';

    html += `<div class="mc-day${isToday ? ' is-today' : ''}${isOff ? ' is-off' : ''}${hasDayOff ? ' is-dayoff' : ''}" data-date="${dateStr}">
      <div class="mc-day-head">
        <span class="mc-day-dow">${dayShort(d)}</span>
        <span class="mc-day-num">${d.getDate()}</span>
        ${tagText ? `<span class="mc-day-md${_fromOverride ? ' is-manual' : ''}${_showAmbiguous ? ' is-ambiguous' : ''}" style="${tagStyle}" title="${_esc(mdTip)}">${tagText}</span>` : ''}${groupChips}${_vidChip}
      </div>
      <div class="mc-day-events" data-date="${dateStr}">
        ${eventsHtml}
        ${addBtn}
      </div>
    </div>`;
  }
  grid.innerHTML = html;
  ensureCtxMenu(grid);

  // Wire event clicks — un click abre el popover; doble click sobre un entrenamiento/gym
  // salta directo a su planificación (Daily Planning / Gym Planner). El click simple se
  // difiere ~250ms SOLO en cards navegables, para que no se pise con el doble.
  grid.querySelectorAll('.mc-evt[data-id]').forEach(el => {
    let clickTimer = null;
    el.addEventListener('click', e => {
      e.stopPropagation();
      const s = _sessions.find(x => x.id === el.dataset.id);
      if (!s) return;
      if (!_evtPlanUrl(s)) { showEvtPopover(el, s); return; }
      if (clickTimer) return;   // segundo click de un doble → lo maneja dblclick
      clickTimer = setTimeout(() => { clickTimer = null; showEvtPopover(el, s); }, 250);
    });
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      e.preventDefault();
      const s = _sessions.find(x => x.id === el.dataset.id);
      const url = s && _evtPlanUrl(s);
      if (!url) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      window.location.href = url;
    });
  });
  grid.querySelectorAll('[data-add-date]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEvtModal(null, btn.dataset.addDate); });
  });

  // Drag & drop:
  //   Events WITH start_time  → cross-day move only (time defines same-day order)
  //   Events WITHOUT start_time → same-day reorder + cross-day move (sort_order persisted)
  grid.querySelectorAll('.mc-evt[data-id]').forEach(el => {
    el.addEventListener('dragstart', e => {
      _dragId         = el.dataset.id;
      _dragDate       = el.dataset.date;
      _dragHasTime    = el.dataset.hasTime === '1';
      _dropTargetId   = null;
      _dropTargetDate = null;
      el.classList.add('is-dragging');
      document.body.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _dragId);
    });

    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (el.dataset.id === _dragId) return;
      // Allow same-day reorder highlight only for no-time events over same-day targets
      if (!_dragHasTime && el.dataset.date === _dragDate) {
        _dropTargetId = el.dataset.id;
        el.classList.add('drag-over');
      }
    });

    el.addEventListener('dragleave', e => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over');
        if (_dropTargetId === el.dataset.id) _dropTargetId = null;
      }
    });

    el.addEventListener('drop', e => e.preventDefault());

    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging');
      grid.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
      grid.querySelectorAll('.mc-day.drag-target,.mc-day.drag-target-warn').forEach(x => x.classList.remove('drag-target','drag-target-warn'));

      const srcId = _dragId, srcDate = _dragDate, hasTime = _dragHasTime;
      const tgtId = _dropTargetId, tgtDate = _dropTargetDate;
      _dragId = null; _dragDate = null; _dragHasTime = false;
      _dropTargetId = null; _dropTargetDate = null;

      if (!srcId) return;
      const draggedSess = _sessions.find(s => s.id === srcId);
      if (!draggedSess) return;

      // Cross-day move — applies to all event types
      if (tgtDate && tgtDate !== srcDate) {
        handleCrossDayMove(draggedSess, tgtDate);
        return;
      }

      // Same-day reorder — only for no-time events
      if (!hasTime && tgtId && tgtId !== srcId) {
        const targetSess = _sessions.find(s => s.id === tgtId);
        if (!targetSess || targetSess.session_date !== srcDate) return;

        const noTimeEvts = _sessions.filter(s => s.session_date === srcDate && !s.start_time);
        const snapshot   = noTimeEvts.map(s => ({ id: s.id, sort_order: s.sort_order }));

        const dragIdx = noTimeEvts.findIndex(s => s.id === srcId);
        const dropIdx = noTimeEvts.findIndex(s => s.id === tgtId);
        if (dragIdx === -1 || dropIdx === -1 || dragIdx === dropIdx) return;

        noTimeEvts.splice(dragIdx, 1);
        noTimeEvts.splice(dropIdx, 0, draggedSess);
        noTimeEvts.forEach((s, idx) => { s.sort_order = idx; });

        _sessions = _sessions.map(s => noTimeEvts.find(x => x.id === s.id) || s).sort(sortSessions);
        renderGrid();

        updateSortOrders(srcDate).catch(() => {
          snapshot.forEach(({ id, sort_order }) => {
            const s = _sessions.find(x => x.id === id);
            if (s) s.sort_order = sort_order;
          });
          _sessions.sort(sortSessions);
          renderGrid();
        });
      }
      // Events with start_time dropped on same day: no-op (order by time preserved)
    });
  });

  // Cross-day drop zones — highlight target day column during drag
  grid.querySelectorAll('.mc-day-events').forEach(col => {
    col.addEventListener('dragover', e => {
      if (!_dragId) return;
      e.preventDefault();
      const date = col.dataset.date;
      if (date === _dropTargetDate) return;
      _dropTargetDate = date;
      grid.querySelectorAll('.mc-day.drag-target,.mc-day.drag-target-warn').forEach(x => x.classList.remove('drag-target','drag-target-warn'));
      const dayEl = col.closest('.mc-day');
      if (dayEl) {
        dayEl.classList.add('drag-target');
        if (_sessions.some(s => s.session_date === date && _isFullDayOff(s)))
          dayEl.classList.add('drag-target-warn');
      }
    });
    col.addEventListener('dragleave', e => {
      if (col.contains(e.relatedTarget)) return;
      const dayEl = col.closest('.mc-day');
      if (dayEl) dayEl.classList.remove('drag-target','drag-target-warn');
      if (_dropTargetDate === col.dataset.date) _dropTargetDate = null;
    });
    col.addEventListener('drop', e => e.preventDefault());
  });

  // Async: paint task-dot badges (non-blocking)
  if (_calView !== 'player') loadTaskBadges();
}

// El chip MD del día es de SOLO LECTURA: el día se etiqueta desde la planificación
// (Daily Planning / Gym Planner / la sesión de partido), nunca desde acá, para que el
// calendario no tape lo que se planificó. Marcar día libre y limpiar un override viejo
// viven ahora en el menú contextual del día (click derecho).

// ── Copy/paste context menu (right-click on Windows / Ctrl+click on Mac) ────────
// The `contextmenu` DOM event fires for both a Windows right-click and a macOS
// Ctrl+click, so a single handler covers both. Right-clicking an event offers
// «Copy»; right-clicking a day column offers «Paste here» when something's copied.
let _ctxMenu = null, _ctxMenuWired = false;

function ensureCtxMenu(grid) {
  if (_ctxMenuWired) return;
  _ctxMenuWired = true;
  _ctxMenu = document.createElement('div');
  _ctxMenu.className = 'cal-ctxmenu';
  _ctxMenu.style.display = 'none';
  document.body.appendChild(_ctxMenu);

  // Delegated on the stable grid (innerHTML is rebuilt each render).
  grid.addEventListener('contextmenu', e => {
    if (_calView === 'player') return;   // players can't edit the plan
    const evtEl = e.target.closest('.mc-evt[data-id]');
    const dayEl = e.target.closest('.mc-day');
    if (!evtEl && !dayEl) return;
    e.preventDefault();

    const items = [];
    if (evtEl) {
      const s = _sessions.find(x => x.id === evtEl.dataset.id);
      if (s) items.push({ icon: 'ti-copy', label: tt('calendar.ctx_copy','Copy event'),
        onClick: () => { _clipEvt = s; showCalToast(tt('calendar.ctx_copied','Event copied — right-click a day to paste.')); } });
    }
    const targetDate = (dayEl || evtEl?.closest('.mc-day'))?.dataset.date;
    if (targetDate) {
      if (items.length) items.push({ sep: true });
      const clipName = _clipEvt ? (_clipEvt.title || evtTypeLabel(_clipEvt.session_type) || tt('calendar.filter_training','Training')) : '';
      items.push({ icon: 'ti-clipboard-plus',
        label: _clipEvt ? tt('calendar.ctx_paste_named','Paste «{name}» here',{name:clipName}) : tt('calendar.ctx_paste_empty','Paste here'),
        sub: _clipEvt ? '' : tt('calendar.ctx_nothing_copied','nothing copied'),
        disabled: !_clipEvt,
        onClick: () => { if (_clipEvt) pasteEvtToDate(_clipEvt, targetDate); } });
      // Día libre y limpieza de overrides viejos: antes vivían en el menú del chip MD, que
      // ahora es de solo lectura (el MD se define en la planificación del día).
      const _dayOff = _sessions.some(s => s.session_date === targetDate && _isFullDayOff(s));
      const _mcNow  = _allMCs[_mcIdx];
      items.push({ sep: true });
      items.push(_dayOff
        ? { icon: 'ti-calendar-plus', label: tt('calendar.ctx_undo_day_off','Undo day off'),
            onClick: async () => { try { await removeDayOffOnDate(targetDate); await loadSessions(); }
                                   catch (err) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:err.message||err})); } } }
        : { icon: 'ti-beach', label: tt('calendar.ctx_set_day_off','Set day off'),
            onClick: () => setDayOffOnDate(targetDate) });
      if (_mcNow && _mcNow.md_overrides && _mcNow.md_overrides[targetDate]) {
        items.push({ icon: 'ti-refresh', label: tt('calendar.ctx_md_auto','Use automatic MD'),
          sub: _mcNow.md_overrides[targetDate],
          onClick: () => clearMdOverrideOnDate(targetDate) });
      }
    }
    if (!items.length) return;
    openCtxMenu(e.pageX, e.pageY, items);
  });

  document.addEventListener('click', e => {
    if (_ctxMenu.style.display !== 'none' && !_ctxMenu.contains(e.target)) closeCtxMenu();
  });
  document.addEventListener('scroll', () => closeCtxMenu(), true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtxMenu(); });
}

function openCtxMenu(pageX, pageY, items) {
  _ctxMenu.innerHTML = items.map((it, i) => it.sep
    ? '<div class="cal-ctx-sep"></div>'
    : `<button type="button" class="cal-ctx-opt" data-i="${i}"${it.disabled ? ' disabled' : ''}>
        <i class="ti ${it.icon}"></i><span>${_esc(it.label)}</span>${it.sub ? `<span class="ctx-sub">${_esc(it.sub)}</span>` : ''}
      </button>`
  ).join('');
  _ctxMenu.querySelectorAll('.cal-ctx-opt').forEach(b => {
    const it = items[parseInt(b.dataset.i, 10)];
    if (it && !it.disabled) b.addEventListener('click', ev => { ev.stopPropagation(); closeCtxMenu(); it.onClick(); });
  });
  _ctxMenu.style.display = 'block';
  const mw = _ctxMenu.offsetWidth, mh = _ctxMenu.offsetHeight;
  let left = pageX, top = pageY;
  if (left + mw > window.scrollX + window.innerWidth)  left = window.scrollX + window.innerWidth - mw - 8;
  if (top + mh > window.scrollY + window.innerHeight)  top  = window.scrollY + window.innerHeight - mh - 8;
  _ctxMenu.style.left = Math.max(window.scrollX + 4, left) + 'px';
  _ctxMenu.style.top  = Math.max(window.scrollY + 4, top) + 'px';
}

function closeCtxMenu() { if (_ctxMenu) _ctxMenu.style.display = 'none'; }

// Paste = insert a standalone copy of the source row on `newDate`. Re-fetches the
// full row so every column carries over faithfully; strips identity/link/feedback
// columns and detaches from any recurrence series.
async function pasteEvtToDate(clip, newDate) {
  if (!clip || !newDate) return;
  const clubId = _clubId || await window.getClubId();
  try {
    if (clip.source === 'event') {
      const { data: row, error: fe } = await window.sb.from('calendar_events').select('*').eq('id', clip.id).single();
      if (fe || !row) throw new Error(fe?.message || 'Source not found.');
      const payload = { ...row };
      delete payload.id; delete payload.created_at; delete payload.updated_at;
      payload.date = newDate;
      payload.recurrence_group_id = null;
      payload.published = false;
      // El MD era el del día viejo: se vuelve a poner en el evento si corresponde.
      if ('match_day_offset' in payload && payload.type !== 'match') payload.match_day_offset = null;
      payload.club_id = clubId;
      payload.team_id = _activeTeamId;
      payload.sort_order = payload.start_time ? null : _sessions.filter(s => s.session_date === newDate && !s.start_time).length;
      const { error } = await window.sb.from('calendar_events').insert(payload);
      if (error) throw error;
      // Day off parcial pegado en otra fecha → marcar libres también ahí
      if (payload.type === 'day_off' && Array.isArray(payload.player_ids) && payload.player_ids.length) {
        await calSyncDayOffAvail(null, { date: newDate, ids: payload.player_ids });
      }
    } else {
      const { data: row, error: fe } = await window.sb.from('training_sessions').select('*').eq('id', clip.id).single();
      if (fe || !row) throw new Error(fe?.message || 'Source not found.');
      const payload = { ...row };
      delete payload.id; delete payload.created_at; delete payload.updated_at;
      delete payload.external_activity_id;  // GPS link is 1:1 (unique) — never copy it
      delete payload.rpe_avg;               // real feedback belongs to the original session
      // El MD es del día, no de la sesión: pegada en otra fecha se recalcula (la planificación
      // del día la vuelve a completar). Si no, el MD viejo viaja y el calendario muestra una
      // segunda dinámica que no existe. El partido sí conserva su 'MD'.
      if (payload.session_type !== 'match') payload.match_day_offset = null;
      payload.session_date = newDate;
      payload.recurrence_group_id = null;
      payload.published = false;
      payload.club_id = clubId;
      payload.team_id = _activeTeamId;
      payload.sort_order = payload.session_time ? null : _sessions.filter(s => s.session_date === newDate && !s.start_time).length;
      const { error } = await window.sb.from('training_sessions').insert(payload);
      if (error) throw error;
    }
    showCalToast(tt('calendar.ctx_pasted','Event pasted.'));
    await loadSessions();
    await refreshRibbonMatches();
  } catch (e) {
    showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:e.message || e}));
  }
}

// Remove a day_off marker on a date (calendar_events or training_sessions, by source)
async function removeDayOffOnDate(dateStr) {
  const off = _sessions.find(s => s.session_date === dateStr && _isFullDayOff(s));
  if (!off) return;
  const table = off.source === 'session' ? 'training_sessions' : 'calendar_events';
  const { error } = await window.sb.from(table).delete().eq('id', off.id);
  if (error) throw new Error(error.message);
}

// Marcar el día entero como libre (menú contextual del día). Limpia el override viejo del
// microciclo para esa fecha: el día pasa a mostrar OFF y no hay MD que sostener.
async function setDayOffOnDate(dateStr) {
  const mc = _allMCs[_mcIdx];
  if (!mc) return;
  try {
    const others = _sessions.filter(s => s.session_date === dateStr && s.session_type !== 'day_off');
    if (others.length && !confirm(tt('calendar.other_events_set_dayoff','There are {n} other event(s) on {date}. Set day off anyway?',{n:others.length,date:dateStr}))) return;
    if (mc.md_overrides && mc.md_overrides[dateStr]) {
      const next = { ...mc.md_overrides };
      delete next[dateStr];
      const { error: uerr } = await window.sb.from('microcycles').update({ md_overrides: next }).eq('id', mc.id);
      if (uerr) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:uerr.message})); return; }
      mc.md_overrides = next;
    }
    if (!_sessions.some(s => s.session_date === dateStr && _isFullDayOff(s))) {
      const clubId = _clubId || await window.getClubId();
      const { error: ierr } = await window.sb.from('calendar_events').insert({
        title: 'Day off', type: 'day_off', date: dateStr,
        club_id: clubId, team_id: _activeTeamId, visible_to: ['players','medical']
      });
      if (ierr) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:ierr.message})); return; }
    }
    await loadSessions();
  } catch (e) {
    showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:(e?.message||e)}));
  }
}

// Sacar el MD fijado a mano en un día (overrides que quedaron de la versión anterior del
// chip): el día vuelve a mostrar lo que digan las sesiones o el partido más cercano.
async function clearMdOverrideOnDate(dateStr) {
  const mc = _allMCs[_mcIdx];
  if (!mc || !mc.md_overrides || !mc.md_overrides[dateStr]) return;
  const next = { ...mc.md_overrides };
  delete next[dateStr];
  const { error } = await window.sb.from('microcycles').update({ md_overrides: next }).eq('id', mc.id);
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  mc.md_overrides = next;
  await loadSessions();
}

// Canonical sort: timed events first (by start_time ASC), then no-time (by sort_order ASC), tiebreaker created_at ASC
function sortSessions(a, b) {
  if (a.session_date !== b.session_date) return a.session_date > b.session_date ? 1 : -1;
  const aTime = a.start_time || null;
  const bTime = b.start_time || null;
  if (aTime && bTime) return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  if (aTime) return -1;
  if (bTime) return 1;
  const aOrd = a.sort_order ?? Infinity;
  const bOrd = b.sort_order ?? Infinity;
  if (aOrd !== bOrd) return aOrd - bOrd;
  return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
}

// Single-query batch update via RPC (UPDATE FROM unnest — not N requests)
async function updateSortOrders(dateStr) {
  const noTimeEvts = _sessions.filter(s => s.session_date === dateStr && !s.start_time);
  if (!noTimeEvts.length) return;
  const calIds = [], calOrds = [], sessIds = [], sessOrds = [];
  noTimeEvts.forEach((s, idx) => {
    if (s.source === 'event') { calIds.push(s.id); calOrds.push(idx); }
    else                      { sessIds.push(s.id); sessOrds.push(idx); }
  });
  const { error } = await window.sb.rpc('batch_update_sort_orders', {
    p_calendar_ids:    calIds,
    p_calendar_orders: calOrds,
    p_session_ids:     sessIds,
    p_session_orders:  sessOrds,
    p_club_id:         _clubId
  });
  if (error) throw error;
}

// Cross-day move: persists date change + sort_order for no-time events
async function handleCrossDayMove(evt, newDate) {
  if (evt.recurrence_group_id && evt.source === 'event') {
    const moveAll = confirm(tt('calendar.event_repeats_move','This event repeats. Move the whole series?\n\nOK = Move all in series\nCancel = Move only this occurrence'));
    if (moveAll) {
      const { error } = await window.sb.from('calendar_events')
        .update({ date: newDate })
        .eq('recurrence_group_id', evt.recurrence_group_id)
        .eq('club_id', _clubId)
        .eq('team_id', _activeTeamId);
      if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
      // Day offs parciales de la serie: mover sus filas de availability a la nueva fecha
      const _movedOffs = _sessions.filter(s => s.recurrence_group_id === evt.recurrence_group_id && _isPartialDayOff(s));
      for (const off of _movedOffs) {
        await calSyncDayOffAvail({ date: off.session_date, ids: off.player_ids }, { date: newDate, ids: off.player_ids });
      }
      showCalToast(tt('calendar.series_moved','Series moved.'));
      await loadSessions();
      return;
    }
  }

  const table   = evt.source === 'event' ? 'calendar_events' : 'training_sessions';
  const dateCol = evt.source === 'event' ? 'date' : 'session_date';
  const patch   = { [dateCol]: newDate };
  // Mover de día invalida el MD guardado (era el del día viejo): se recalcula solo. El
  // partido conserva el suyo.
  if (evt.session_type !== 'match' && evt.match_day_offset) patch.match_day_offset = null;

  // No-time events get placed at the end of the target day
  if (!evt.start_time) {
    const targetNoTime = _sessions.filter(s => s.session_date === newDate && !s.start_time);
    patch.sort_order = targetNoTime.length;
  }

  const { error } = await window.sb.from(table).update(patch).eq('id', evt.id).eq('club_id', _clubId);
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  // Day off parcial movido de día → mover también los libres en availability
  if (_isPartialDayOff(evt)) {
    await calSyncDayOffAvail({ date: evt.session_date, ids: evt.player_ids }, { date: newDate, ids: evt.player_ids });
  }
  showCalToast(tt('calendar.event_moved','Event moved.'));
  await loadSessions();
}

// ── Fetch + merge training_sessions and calendar_events ────────
async function fetchAllEvents(dateFrom, dateTo) {
  const _evtQ = cols => window.sb.from('calendar_events')
    .select(cols)
    .eq('club_id', _clubId).eq('team_id', _activeTeamId)
    .gte('date', dateFrom).lte('date', dateTo).order('date');
  const EVT_COLS = 'id,title,type,duration_minutes,date,notes,opponent,competition,home_away,start_time,location,sort_order,estimated_rpe,rival_crest_url,recurrence_group_id,visible_to,created_at';
  let [sessRes, evtRes] = await Promise.all([
    window.sb.from('training_sessions')
      .select('id,title,session_type,duration,session_date,notes,sort_order,estimated_rpe,session_time,orientation,visible_to,recurrence_group_id,created_at,match_day_offset')
      .eq('club_id', _clubId).eq('team_id', _activeTeamId).eq('is_historical', false)
      .gte('session_date', dateFrom).lte('session_date', dateTo).order('session_date'),
    _evtQ(EVT_COLS + ',player_ids,travel_mode,match_day_offset,is_mandatory')
  ]);
  // Fallbacks: si is_mandatory / match_day_offset / travel_mode / player_ids todavía no
  // existen en la DB, reintentar sin ellas
  if (evtRes.error && /is_mandatory/.test(evtRes.error.message || '')) evtRes = await _evtQ(EVT_COLS + ',player_ids,travel_mode,match_day_offset');
  if (evtRes.error && /match_day_offset/.test(evtRes.error.message || '')) evtRes = await _evtQ(EVT_COLS + ',player_ids,travel_mode');
  if (evtRes.error && /travel_mode/.test(evtRes.error.message || '')) evtRes = await _evtQ(EVT_COLS + ',player_ids');
  if (evtRes.error && /player_ids/.test(evtRes.error.message || '')) evtRes = await _evtQ(EVT_COLS);
  if (sessRes.error) return { error: sessRes.error.message };
  const norm = (sessRes.data || []).map(s => ({
    ...s, session_date: (s.session_date || '').split('T')[0],
    start_time: s.session_time || null,
    visible_to: s.visible_to || ['staff'],
    recurrence_group_id: s.recurrence_group_id || null,
    source: 'session'
  }));
  const evts = evtRes.error ? [] : (evtRes.data || []).map(e => ({
    id: e.id, title: e.title, session_type: e.type,
    session_date: (e.date || '').split('T')[0],
    duration: e.duration_minutes, notes: e.notes,
    opponent: e.opponent, competition: e.competition,
    home_away: e.home_away, start_time: e.start_time, location: e.location,
    sort_order: e.sort_order, estimated_rpe: e.estimated_rpe,
    rival_crest_url: e.rival_crest_url || null,
    recurrence_group_id: e.recurrence_group_id || null,
    visible_to: e.visible_to || ['staff'],
    created_at: e.created_at || null,
    player_ids: e.player_ids || null,
    travel_mode: e.travel_mode || null,
    match_day_offset: e.match_day_offset || null,
    is_mandatory: !!e.is_mandatory,
    source: 'event'
  }));
  // Dedup matches: a match can exist both as a calendar_events event and as a
  // training_sessions row. Keep the calendar_events one (canonical: time, competition,
  // crest) and drop any training_sessions 'match' on the same date.
  const eventMatchDates = new Set(evts.filter(e => e.session_type === 'match').map(e => e.session_date));
  const merged = [...norm, ...evts].filter(s =>
    !(s.source === 'session' && s.session_type === 'match' && eventMatchDates.has(s.session_date))
  );
  return { data: merged.sort(sortSessions) };
}

// ── Load sessions for current MC ──────────────────────────────
// opts.silent: recarga sin pintar el "Loading…" — para el refresco en vivo, que
// no debe hacer parpadear la grilla mientras el usuario la está mirando.
// ── Videos por día (Video Room) ────────────────────────────────
// Cuántos videos hay de cada fecha del microciclo, para el chip de la cabecera del
// día y el popover del evento. Se cuenta por videos.event_date (la fecha de lo
// filmado). Silencioso si algo falla: es un adorno, no puede romper el calendario.
let _videoDays = {};
async function loadVideoDays(from, to) {
  _videoDays = {};
  try {
    let q = window.sb.from('videos').select('event_date')
      .eq('club_id', _clubId).gte('event_date', from).lte('event_date', to);
    if (_activeTeamId) q = q.eq('team_id', _activeTeamId);
    const { data, error } = await q;
    if (error) return;
    (data || []).forEach(r => { if (r.event_date) _videoDays[r.event_date] = (_videoDays[r.event_date] || 0) + 1; });
  } catch (_) {}
}

async function loadSessions(opts) {
  const mc = _allMCs[_mcIdx];
  if (!mc) return;
  const grid = document.getElementById('calDaysGrid');
  if (grid && !(opts && opts.silent)) grid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--cm-fg-muted)">${tt('common.loading','Loading…')}</div>`;
  const { data, error } = await fetchAllEvents(mc.start_date, mc.end_date);
  if (error) {
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--cm-fg-muted)">${tt('calendar.error_loading_sessions','Error loading sessions: {msg}',{msg:error})}</div>`;
    return;
  }
  _sessions = data;
  _weekOffset = 0;
  await loadVideoDays(mc.start_date, mc.end_date);

  // Travel Days KPI
  const travelEvts = _sessions.filter(s => s.session_type === 'travel');
  const travelCt = travelEvts.length;
  const elTV = document.getElementById('calTravelV');
  const elTT = document.getElementById('calTravelT');
  if (elTV) elTV.innerHTML = `${travelCt} <sub>${tt('calendar.this_mc','this MC')}</sub>`;
  // Horas de trayecto = suma de Duration de los eventos travel, desglosadas por medio
  const _fmtHM = mins => { const h = Math.floor(mins / 60), m = mins % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
  const _tmLabel = k => tt('calendar.travel_' + k, ({ bus:'Bus', flight:'Flight', train:'Train', other:'Other' })[k] || k);
  const _byMode = {};
  travelEvts.forEach(s => { if (s.duration) { const k = s.travel_mode || 'other'; _byMode[k] = (_byMode[k] || 0) + s.duration; } });
  const _travelMin = Object.values(_byMode).reduce((a, b) => a + b, 0);
  if (elTT) {
    if (!travelCt) elTT.textContent = tt('calendar.no_travel_planned','No travel planned');
    else if (_travelMin > 0) {
      const parts = Object.entries(_byMode).map(([k, v]) => `${_fmtHM(v)} ${_tmLabel(k).toLowerCase()}`);
      elTT.textContent = tt('calendar.travel_hours_line','{t} travel time',{t:_fmtHM(_travelMin)}) + (parts.length > 1 ? ' · ' + parts.join(' · ') : '');
    }
    else elTT.textContent = tt('calendar.travel_line','{n} travel session this MC|{n} travel sessions this MC',{n:travelCt,count:travelCt});
  }

  renderGrid();
  renderWorkload();
  renderUpcoming();   // re-anchor "Upcoming" to the now-viewed microcycle
}

// ── Planned Workload widget ────────────────────────────────────
async function renderWorkload() {
  const chartEl = document.querySelector('.wk-chart');
  if (!chartEl) return;
  const clubId = _clubId || await window.getClubId();
  if (!clubId) return;
  if (!_allMCs.length) {
    chartEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--cm-fg-muted);font:500 12.5px/1.4 var(--cm-font-sans);text-align:center;padding:20px">${tt('calendar.no_plan_loaded','No plan loaded for this team yet.')}</div>`;
    return;
  }

  const sorted = [..._allMCs].sort((a, b) => a.start_date > b.start_date ? 1 : -1);
  const ci = sorted.findIndex(m => m.start_date <= TODAY && m.end_date >= TODAY);
  const cur = ci >= 0 ? ci : sorted.length - 1;
  const from = Math.max(0, cur - 5);
  const to   = Math.min(sorted.length - 1, cur + 2);
  const mcs  = sorted.slice(from, to + 1);
  if (!mcs.length) {
    chartEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--cm-fg-muted);font:500 12.5px/1.4 var(--cm-font-sans);text-align:center;padding:20px">${tt('calendar.no_plan_loaded','No plan loaded for this team yet.')}</div>`;
    const lbls = document.querySelector('.wk-labels'); if (lbls) lbls.innerHTML = '';
    return;
  }

  const dateFrom = mcs[0].start_date;
  const dateTo   = mcs[mcs.length - 1].end_date;

  const [sessRes, evtRes] = await Promise.all([
    window.sb.from('training_sessions')
      .select('session_date,duration,estimated_rpe,session_type')
      .eq('club_id', clubId).eq('team_id', _activeTeamId).eq('is_historical', false).gte('session_date', dateFrom).lte('session_date', dateTo),
    window.sb.from('calendar_events')
      .select('date,duration_minutes,estimated_rpe,type')
      .eq('club_id', clubId).eq('team_id', _activeTeamId).gte('date', dateFrom).lte('date', dateTo)
  ]);

  const allSessions = [
    ...(sessRes.data || []).map(s => ({ date: (s.session_date||'').split('T')[0], duration: s.duration, rpe: s.estimated_rpe, type: focusToClass(s.session_type) })),
    ...(evtRes.data  || []).map(e => ({ date: (e.date||'').split('T')[0], duration: e.duration_minutes, rpe: e.estimated_rpe, type: focusToClass(e.type) }))
  ];

  const mcData = mcs.map(mc => {
    const sessions = allSessions.filter(s => s.date >= mc.start_date && s.date <= mc.end_date);
    const withRpe  = sessions.filter(s => s.rpe && s.duration);
    const pending  = sessions.filter(s => !s.rpe || !s.duration).length;
    const trAu  = withRpe.filter(s => s.type === 'training').reduce((sum, s) => sum + s.duration * s.rpe, 0);
    const gymAu = withRpe.filter(s => s.type === 'gym').reduce((sum, s) => sum + s.duration * s.rpe, 0);
    const mtAu  = withRpe.filter(s => s.type === 'match').reduce((sum, s) => sum + s.duration * s.rpe, 0);
    return { mc, au: trAu + gymAu + mtAu, trAu, gymAu, mtAu, pending, total: sessions.length };
  });

  const maxAu = Math.max(...mcData.map(d => d.au), 1);
  const currentMcId = _allMCs[_mcIdx]?.id;

  const barsHtml = mcData.map(d => {
    const trH  = d.trAu  ? `${Math.round((d.trAu  / maxAu) * 95)}%` : '0';
    const gymH = d.gymAu ? `${Math.round((d.gymAu / maxAu) * 95)}%` : '0';
    const mtH  = d.mtAu  ? `${Math.round((d.mtAu  / maxAu) * 95)}%` : '0';
    const _mcNm = d.mc.name || 'MC';
    const tooltip = d.au > 0
      ? (d.pending ? tt('calendar.wk_tooltip_au_no_est_rpe','{name}: {au} AU · {p} without estimated RPE',{name:_mcNm,au:d.au,p:d.pending}) : tt('calendar.wk_tooltip_au','{name}: {au} AU',{name:_mcNm,au:d.au}))
      : tt('calendar.wk_tooltip_no_rpe','{name}: no RPE data',{name:_mcNm});
    return `<div class="wk-bar-grp" title="${tooltip}">
      <div class="wk-bar tr"  style="height:${trH}"></div>
      <div class="wk-bar gym" style="height:${gymH}"></div>
      <div class="wk-bar mt"  style="height:${mtH}"></div>
    </div>`;
  }).join('');

  const labelsHtml = mcData.map(d => {
    const isCurrent = d.mc.id === currentMcId;
    return `<span${isCurrent ? ' class="is-current"' : ''}>${_esc(d.mc.name || 'MC')}</span>`;
  }).join('');

  const curPending = mcData.find(d => d.mc.id === currentMcId)?.pending || 0;
  const pendingNote = curPending > 0 ? `<div style="font:500 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:6px">${tt('calendar.no_est_rpe_current','{n} session without estimated RPE in current MC|{n} sessions without estimated RPE in current MC',{n:curPending,count:curPending})}</div>` : '';

  chartEl.innerHTML = `
    <div class="wk-rows">${barsHtml || '<div style="width:100%;text-align:center;padding:20px 0;color:var(--cm-fg-faint);font:var(--cm-meta)">—</div>'}</div>
    <div class="wk-labels">${labelsHtml}</div>
    ${pendingNote}
    <div class="wk-legend">
      <span class="it"><span class="sw" style="background:var(--cm-info)"></span>${tt('calendar.legend_training','Training')}</span>
      <span class="it"><span class="sw" style="background:var(--cm-violet)"></span>${tt('calendar.legend_gym','Gym')}</span>
      <span class="it"><span class="sw" style="background:var(--cm-danger)"></span>${tt('calendar.legend_match','Match')}</span>
    </div>`;
}

// ── Event modal ───────────────────────────────────────────────
const CAL_EVT_TYPES = [
  'match','recovery','travel','meeting','evaluation','video_session',
  'breakfast','lunch','dinner','snack',
  'hotel_checkin','hotel_checkout','bus_departure','bus_arrival',
  'press','medical_check','physio','prevention','walkthrough','scouting','day_off',
];

// Tipos que pueden llevar MD propio: todo lo que es trabajo. El partido no está porque ya
// es MD por definición, y la logística/obligaciones no son una dinámica.
const MD_EVT_TYPES = ['training','tactical','beach','outdoor','gym','recovery','walkthrough'];

// Opciones del selector de MD: las del deporte activo (fútbol MD−6…MD+3, básquet GD−3…GD+2).
// El value queda ASCII (forma canónica de cmMdNorm) y solo la etiqueta lleva el menos
// tipográfico, igual que en el Gym Planner.
function calFillMdSelect(sel) {
  if (!sel) return;
  const keep = window.cmMdNorm ? window.cmMdNorm(sel.value) : sel.value;
  const opts = window.cmMdOptions ? window.cmMdOptions() : [];
  sel.innerHTML = `<option value="">${tt('calendar.md_auto','— Auto (from the day) —')}</option>`
    + opts.map(v => `<option value="${v}">${v.replace('-', '−')}</option>`).join('');
  if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
}

// Muestra la fila del MD solo para los tipos de trabajo y la deja lista para editar.
function calSyncMdRow(type) {
  const row = document.getElementById('calEvtMdRow');
  if (row) row.style.display = MD_EVT_TYPES.includes(type) ? '' : 'none';
}

// «Asistencia obligatoria» solo tiene sentido en los preventivos: el resto de los eventos
// o son de todo el plantel o son opcionales por naturaleza.
function calSyncMandatoryRow(type) {
  const row = document.getElementById('calEvtMandatoryRow');
  if (!row) return;
  const on = type === 'prevention';
  row.style.display = on ? '' : 'none';
  if (!on) { const cb = document.getElementById('calEvtF_mandatory'); if (cb) cb.checked = false; }
}

// Valor a persistir: convención de Daily Planning / Gym Planner (ASCII, 'MD0' para el día
// de partido), para que cmMdNorm lo lea igual venga de donde venga.
function calMdFieldValue(type) {
  if (!MD_EVT_TYPES.includes(type)) return null;
  const v = document.getElementById('calEvtF_md')?.value || '';
  if (!v) return null;
  const n = window.cmMdNorm ? window.cmMdNorm(v) : v.replace(/−/g, '-');
  return n === 'MD' ? 'MD0' : n;
}

const DURATION_DEFAULTS = {
  training:90, tactical:90, beach:75, outdoor:75, gym:60, recovery:60, match:90, video_session:60, meeting:60, evaluation:60, travel:null, other:null,
  breakfast:45, lunch:60, dinner:60, snack:20,
  hotel_checkin:30, hotel_checkout:30, bus_departure:15, bus_arrival:15,
  press:30, medical_check:30, physio:60, prevention:20, walkthrough:30, scouting:60,
  day_off:null,
};

// ── "Pick days in microcycle" recurrence UI ───────────────────
function _mcRangeLabel(m){
  const f = ds => new Date(ds + 'T12:00:00').toLocaleDateString(ttLocale(), { day:'numeric', month:'short' });
  return (m.name || tt('calendar.microcycle','Microcycle')) + ' · ' + f(m.start_date) + '–' + f(m.end_date);
}
function calRenderMcPick(){
  const sel   = document.getElementById('calEvtF_mcPick');
  const chips = document.getElementById('calEvtF_mcChips');
  if (!sel || !chips) return;
  const evtDate = document.getElementById('calEvtF_date').value || TODAY;
  const mcs = (_allMCs || []).filter(m => m.start_date && m.end_date)
    .slice().sort((a, b) => a.start_date < b.start_date ? -1 : 1);
  if (!mcs.length){
    sel.innerHTML = '';
    chips.innerHTML = `<div style="font:500 11.5px/1 var(--cm-font-sans);color:var(--cm-fg-faint)">${_esc(tt('calendar.no_matches_yet','—'))}</div>`;
    calUpdateMcCount();
    return;
  }
  // Preselect the MC that contains the event date; otherwise the nearest one.
  let pick = mcs.find(m => m.start_date <= evtDate && evtDate <= m.end_date);
  if (!pick){
    const dist = m => evtDate < m.start_date
      ? (new Date(m.start_date) - new Date(evtDate))
      : (new Date(evtDate) - new Date(m.end_date));
    pick = mcs.slice().sort((a, b) => Math.abs(dist(a)) - Math.abs(dist(b)))[0];
  }
  sel.innerHTML = mcs.map(m => `<option value="${_esc(m.id)}"${m.id === pick.id ? ' selected' : ''}>${_esc(_mcRangeLabel(m))}</option>`).join('');
  calRenderMcChips();
}
function calRenderMcChips(){
  const sel   = document.getElementById('calEvtF_mcPick');
  const chips = document.getElementById('calEvtF_mcChips');
  if (!sel || !chips) return;
  const mc = (_allMCs || []).find(m => m.id === sel.value);
  if (!mc){ chips.innerHTML = ''; calUpdateMcCount(); return; }
  const evtDate = document.getElementById('calEvtF_date').value || '';
  let html = '', cur = new Date(mc.start_date + 'T12:00:00');
  const end = new Date(mc.end_date + 'T12:00:00'), guard = 400;
  let i = 0;
  while (cur <= end && i++ < guard){
    const ds = cur.toISOString().slice(0, 10);
    const on = ds === evtDate;   // preselect the event's own day
    const wd = cur.toLocaleDateString(ttLocale(), { weekday:'short' });
    html += `<button type="button" class="cal-mcchip${on ? ' on' : ''}" data-date="${ds}" onclick="calToggleMcChip(this)"
      style="cursor:pointer;padding:4px 8px;border-radius:6px;font:600 10.5px/1.15 var(--cm-font-sans);text-align:center;border:1px solid ${on ? 'var(--cm-accent)' : 'var(--cm-border)'};background:${on ? 'var(--cm-accent)' : 'var(--cm-surface)'};color:${on ? '#fff' : 'var(--cm-fg-strong)'}">${_esc(wd)} ${cur.getDate()}</button>`;
    cur = new Date(cur.getTime() + 86400000);
  }
  chips.innerHTML = html;
  calUpdateMcCount();
}
function calToggleMcChip(el){
  const on = el.classList.toggle('on');
  el.style.border     = '1px solid ' + (on ? 'var(--cm-accent)' : 'var(--cm-border)');
  el.style.background = on ? 'var(--cm-accent)' : 'var(--cm-surface)';
  el.style.color      = on ? '#fff' : 'var(--cm-fg-strong)';
  calUpdateMcCount();
}
function calUpdateMcCount(){
  const el = document.getElementById('calEvtF_mcCount');
  if (!el) return;
  const n = document.querySelectorAll('#calEvtF_mcChips .cal-mcchip.on').length;
  el.textContent = tt('calendar.mc_days_count', `${n} days selected`, { n });
}

function generateRecurrenceDates(startDate, pattern, until, customDatesText) {
  if (pattern === 'mc_days') {
    return [...document.querySelectorAll('#calEvtF_mcChips .cal-mcchip.on')]
      .map(el => el.dataset.date)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  }
  if (pattern === 'custom') {
    return (customDatesText || '').split('\n').map(l => l.trim()).filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l));
  }
  if (!until) return [startDate];
  const dates = [];
  let cur = new Date(startDate + 'T12:00:00');
  const end = new Date(until + 'T12:00:00');
  while (cur <= end) {
    const dow = cur.getDay();
    if (pattern === 'daily' || (pattern === 'weekdays' && dow >= 1 && dow <= 5)) {
      dates.push(cur.toISOString().slice(0, 10));
    }
    cur = new Date(cur.getTime() + 86400000);
  }
  return dates;
}

function toggleMatchFields(type) {
  const el = document.getElementById('calEvtMatchFields');
  if (el) el.style.display = type === 'match' ? '' : 'none';
  const lbl = document.getElementById('calEvtStarttimeLabel');
  if (lbl) lbl.textContent = type === 'match' ? tt('calendar.kickoff_time','Kick-off time') : tt('calendar.start_time','Start time');
}

function toggleRpeRow(type) {
  const el = document.getElementById('calEvtRpeRow');
  if (el) el.style.display = (type === 'training' || type === 'tactical' || type === 'beach' || type === 'outdoor' || type === 'gym' || type === 'conditioning' || type === 'match') ? '' : 'none';
}

function updateAuPreview() {
  const dur = parseInt(document.getElementById('calEvtF_duration')?.value) || 0;
  const rpe = parseInt(document.getElementById('calEvtF_rpe')?.value) || 0;
  const el  = document.getElementById('calEvtAuPreview');
  if (el) el.textContent = (dur && rpe) ? String(dur * rpe) : '—';
}

// ── Rival crest preview helpers ───────────────────────────────
function calCrestShowImg(url) {
  const img = document.getElementById('calEvtCrestImg');
  const ini = document.getElementById('calEvtCrestInitials');
  const rem = document.getElementById('calEvtCrestRemove');
  if (!img || !ini) return;
  if (url) {
    img.src = url;
    img.style.display = '';
    ini.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; ini.style.display = ''; };
  } else {
    img.src = '';
    img.style.display = 'none';
    ini.style.display = '';
  }
  if (rem) rem.style.display = url ? '' : 'none';
}
function calCrestSetInitials(name) {
  const el = document.getElementById('calEvtCrestInitials');
  if (el) el.textContent = window.rivalInitials ? window.rivalInitials(name) : ((name || '?').split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || '?');
}

// ── Rival picker: choose an existing opponent (opponent_branding, with crest) or type a new one.
// UI-only over the free-text #calEvtF_opponent — the save/read path is unchanged, so downstream
// (Hub "next match", Lineup, planner…) that reads calendar_events.opponent + rival_crest_url is intact.
let _calOppCatalog = null;   // [{ name, crest }] — club opponent catalog, reloaded on each modal open
async function _calLoadOpponents() {
  if (_calOppCatalog) return _calOppCatalog;
  try {
    const { data } = await window.sb.from('opponent_branding')
      .select('opponent_name, crest_url').eq('club_id', _clubId).order('opponent_name');
    _calOppCatalog = (data || []).map(o => ({ name: o.opponent_name, crest: o.crest_url || null }));
  } catch (e) { _calOppCatalog = []; }
  return _calOppCatalog;
}
function _calOppMenuHtml(input) {
  const q = (input.value || '').trim(), ql = q.toLowerCase();
  const list = (_calOppCatalog || []).filter(o => !ql || o.name.toLowerCase().includes(ql));
  const exact = (_calOppCatalog || []).some(o => o.name.toLowerCase() === ql);
  // "New rival" row ALWAYS on top (shows "Create '<typed>'" once you type a name that isn't an exact match).
  const createLbl = (q && !exact) ? `${tt('calendar.create_rival','Create')} "${calEsc(q)}"` : tt('calendar.new_rival','New rival…');
  let html = `<button type="button" class="cal-opp-item cal-opp-new" data-new="1"><i class="ti ti-plus" style="font-size:14px"></i><span>${createLbl}</span></button>`;
  if (list.length) html += `<div style="height:1px;background:var(--cm-border-soft);margin:4px 2px"></div>`;
  html += list.map(o => {
    const ic = o.crest
      ? `<img src="${calEsc(o.crest)}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:contain;flex-shrink:0" onerror="this.style.visibility='hidden'">`
      : `<span style="width:20px;height:20px;border-radius:50%;background:var(--cm-bg-soft);display:inline-flex;align-items:center;justify-content:center;font:700 9px/1 var(--cm-font-sans);color:var(--cm-fg-faint);flex-shrink:0">${calEsc(window.rivalInitials ? window.rivalInitials(o.name) : ((o.name||'?')[0]||'?'))}</span>`;
    return `<button type="button" class="cal-opp-item" data-name="${calEsc(o.name)}" data-crest="${o.crest ? calEsc(o.crest) : ''}">${ic}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${calEsc(o.name)}</span></button>`;
  }).join('');
  return html;
}
function _calWireOpponentPicker() {
  const input = document.getElementById('calEvtF_opponent');
  if (!input || input._calWired) return;
  input._calWired = true;
  if (!document.getElementById('cal-opp-style')) {
    const st = document.createElement('style'); st.id = 'cal-opp-style';
    st.textContent = '.cal-opp-menu{position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:60;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:var(--cm-r-3);box-shadow:var(--cm-shadow-3);max-height:240px;overflow-y:auto;padding:4px}'
      + '.cal-opp-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:7px 8px;border:0;background:none;border-radius:6px;cursor:pointer;font:500 13px/1.2 var(--cm-font-sans);color:var(--cm-fg)}'
      + '.cal-opp-item:hover{background:var(--cm-bg-soft)}.cal-opp-new{color:var(--cm-accent);font-weight:600}';
    document.head.appendChild(st);
  }
  const field = input.closest('.sq-modal-field') || input.parentElement;
  field.style.position = 'relative';
  const menu = document.createElement('div');
  menu.className = 'cal-opp-menu'; menu.style.display = 'none';
  field.appendChild(menu);
  const show = async () => { await _calLoadOpponents(); menu.innerHTML = _calOppMenuHtml(input); menu.style.display = 'block'; };
  input.addEventListener('focus', show);
  input.addEventListener('input', () => { if (_calOppCatalog) { menu.innerHTML = _calOppMenuHtml(input); menu.style.display = 'block'; } else show(); });
  menu.addEventListener('mousedown', e => {           // mousedown fires BEFORE blur → the pick registers
    const it = e.target.closest('.cal-opp-item'); if (!it) return;
    e.preventDefault();
    menu.style.display = 'none';
    if (it.dataset.new) {                             // "New rival…": keep the typed name; show its initials in the crest preview (upload a crest below if you want)
      calCrestSetInitials(input.value.trim());
      calCrestShowImg(null);
      return;
    }
    input.value = it.dataset.name;
    calCrestSetInitials(it.dataset.name);
    const crest = it.dataset.crest || null;
    _pendingCrestUrl = crest;                          // event gets this crest; save's find-or-create won't dup
    calCrestShowImg(crest);
  });
  input.addEventListener('blur', () => setTimeout(() => { menu.style.display = 'none'; }, 150));
}

// ── Day off scope UI (modal) ──────────────────────────────────
let _dayOffScope = 'team';        // 'team' | 'players'
let _dayOffSel   = new Set();     // player ids (string) del day off parcial
function calSetDayOffScope(scope) {
  _dayOffScope = scope;
  const whole = document.getElementById('calDayOffWhole');
  const part  = document.getElementById('calDayOffPartial');
  const pick  = document.getElementById('calDayOffPicker');
  const hint  = document.getElementById('calDayOffHint');
  if (whole) whole.className = 'cm-btn is-sm' + (scope === 'team' ? ' is-primary' : ' is-ghost');
  if (part)  part.className  = 'cm-btn is-sm' + (scope === 'players' ? ' is-primary' : ' is-ghost');
  if (hint)  hint.textContent = scope === 'team'
    ? tt('calendar.dayoff_whole_hint','Blocks the whole day for this team.')
    : tt('calendar.dayoff_partial_hint','Only the selected players get the day off — the rest can still train.');
  if (pick)  pick.style.display = scope === 'players' ? '' : 'none';
  if (scope === 'players') calRenderDayOffChips();
}
function calSyncDayOffRow(type) {
  const row = document.getElementById('calEvtDayOffRow');
  if (row) row.style.display = type === 'day_off' ? '' : 'none';
  if (type === 'day_off') calSetDayOffScope(_dayOffScope);
}
async function calRenderDayOffChips() {
  const wrap = document.getElementById('calDayOffChips');
  const ct   = document.getElementById('calDayOffCount');
  if (!wrap) return;
  wrap.innerHTML = `<span style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-faint)">${tt('common.loading','Loading…')}</span>`;
  const squad = await calGetSquad();
  if (!squad.length) { wrap.innerHTML = `<span style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-faint)">${tt('calendar.dayoff_no_squad','No players in this team.')}</span>`; return; }
  wrap.innerHTML = squad.map(p => {
    const on = _dayOffSel.has(String(p.id));
    const lastName = (`${p.first_name||''} ${p.last_name||''}`.trim()).split(' ').pop();
    return `<button type="button" class="cal-dayoff-chip" data-pid="${p.id}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:99px;cursor:pointer;font:600 11px/1 var(--cm-font-sans);border:1px solid ${on ? 'var(--cm-accent)' : 'var(--cm-border)'};background:${on ? 'color-mix(in srgb, var(--cm-accent) 14%, var(--cm-surface))' : 'var(--cm-surface)'};color:${on ? 'var(--cm-accent)' : 'var(--cm-fg-muted)'}"><span style="font:600 10px/1 var(--cm-font-mono)">${p.number ?? '—'}</span>${_esc(lastName)}</button>`;
  }).join('');
  wrap.querySelectorAll('.cal-dayoff-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = String(chip.dataset.pid);
      _dayOffSel.has(id) ? _dayOffSel.delete(id) : _dayOffSel.add(id);
      calRenderDayOffChips();
    });
  });
  if (ct) ct.textContent = tt('calendar.dayoff_n_selected','{n} selected',{n:_dayOffSel.size});
}
document.getElementById('calDayOffWhole')?.addEventListener('click', () => calSetDayOffScope('team'));
document.getElementById('calDayOffPartial')?.addEventListener('click', () => calSetDayOffScope('players'));

function openEvtModal(session, defaultDate, focusTasks) {
  if (!session && _sessions.some(s => s.session_date === defaultDate && _isFullDayOff(s))) {
    showCalToast(tt('calendar.day_marked_off','This day is marked OFF. Remove the day off to add events.'));
    return;
  }
  _editEvtId     = session?.id     || null;
  _editEvtSource = session?.source || null;
  document.getElementById('calEvtTitle').textContent = session ? tt('calendar.edit_event','Edit event') : tt('calendar.new_event','New event');
  document.getElementById('calEvtId').value = session?.id || '';
  document.getElementById('calEvtF_title').value = session?.title || '';
  const evtType = session?.session_type || 'training';
  const typeSel = document.getElementById('calEvtF_type');
  // Drop any temp option injected on a previous open (avoid accumulation)
  typeSel.querySelectorAll('option[data-temp="1"]').forEach(o => o.remove());
  typeSel.value = evtType;
  // If the real type isn't a static option, inject a temp one so it's preserved on re-save
  if (typeSel.selectedIndex === -1) {
    const opt = document.createElement('option');
    opt.value = evtType;
    opt.dataset.temp = '1';
    opt.textContent = evtType.charAt(0).toUpperCase() + evtType.slice(1);
    typeSel.appendChild(opt);
    typeSel.value = evtType;
  }
  calSyncTypeTrigger();
  document.getElementById('calEvtF_date').value  = session?.session_date || defaultDate || TODAY;

  // Duration: use saved value, or apply default for new events
  const savedDur = session?.duration;
  document.getElementById('calEvtF_duration').value = savedDur != null ? savedDur : (DURATION_DEFAULTS[evtType] ?? '');

  // day_off: hide duration field
  const durWrap = document.getElementById('calEvtDurationWrap');
  if (durWrap) durWrap.style.display = (evtType === 'day_off' || evtType === 'match') ? 'none' : '';

  // travel: medio de transporte
  const travelRow = document.getElementById('calEvtTravelRow');
  if (travelRow) travelRow.style.display = evtType === 'travel' ? '' : 'none';
  const travelSel = document.getElementById('calEvtF_travelMode');
  if (travelSel) travelSel.value = session?.travel_mode || '';

  // MD del trabajo (activación, recuperación, gimnasio…): lo guardado manda; vacío = lo
  // resuelve el día. Es EL lugar donde se cambia — el chip del calendario solo muestra.
  const mdSel = document.getElementById('calEvtF_md');
  if (mdSel) {
    const saved = session?.match_day_offset ? (window.cmMdNorm ? window.cmMdNorm(session.match_day_offset) : session.match_day_offset) : '';
    mdSel.value = '';
    calFillMdSelect(mdSel);
    mdSel.value = [...mdSel.options].some(o => o.value === saved) ? saved : '';
  }
  calSyncMdRow(evtType);

  const mandCb = document.getElementById('calEvtF_mandatory');
  if (mandCb) mandCb.checked = !!session?.is_mandatory;
  calSyncMandatoryRow(evtType);

  // Day off scope: restaurar del evento (parcial si tiene player_ids) o default equipo entero
  _dayOffSel   = new Set((session?.player_ids || []).map(String));
  _dayOffScope = (evtType === 'day_off' && _dayOffSel.size) ? 'players' : 'team';
  calSyncDayOffRow(evtType);

  document.getElementById('calEvtF_notes').value = session?.notes || '';
  document.getElementById('calEvtDelete').style.display = session ? 'inline-flex' : 'none';
  document.getElementById('calEvtSaving').style.display = 'none';

  // Delete series button: show only when editing a recurring event
  const delSeriesBtn = document.getElementById('calEvtDeleteSeries');
  if (delSeriesBtn) delSeriesBtn.style.display = (session?.recurrence_group_id) ? 'inline-flex' : 'none';

  // Recurrence: only show toggle for new events; reset state
  const repeatRow = document.getElementById('calEvtRepeatRow');
  if (repeatRow) repeatRow.style.display = session ? 'none' : '';
  const repeatChk = document.getElementById('calEvtF_repeat');
  if (repeatChk) { repeatChk.checked = false; document.getElementById('calEvtRecurBlock').style.display = 'none'; }

  // Match extra fields
  document.getElementById('calEvtF_opponent').value    = session?.opponent    || '';
  _calOppCatalog = null; _calWireOpponentPicker();     // rival picker (existing opponents + create-new); reload catalog per open
  document.getElementById('calEvtF_homeaway').value    = session?.home_away   || '';
  const compSel = document.getElementById('calEvtF_competition');
  compSel.innerHTML = `<option value="">${tt('calendar.no_competition','— No competition')}</option>` +
    _calComps.map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`).join('') +
    `<option value="friendly">${tt('calendar.comp_friendly','Friendly')}</option>`;
  compSel.value = session?.competition_id || (session?.competition === 'friendly' ? 'friendly' : '');
  document.getElementById('calEvtF_starttime').value   = session?.start_time  ? session.start_time.slice(0,5) : '';
  document.getElementById('calEvtF_location').value    = session?.location    || '';
  document.getElementById('calEvtF_rpe').value = session?.estimated_rpe || '';

  // Crest (match type only) — reset then populate
  _pendingCrestUrl = null;
  const _crestInp = document.getElementById('calEvtCrestInput');
  if (_crestInp) _crestInp.value = '';
  const _crestOnly = document.getElementById('calEvtCrestMatchOnly');
  if (_crestOnly) _crestOnly.checked = false;
  const _opName = session?.opponent || '';
  calCrestSetInitials(_opName);
  if (session?.rival_crest_url) {
    calCrestShowImg(session.rival_crest_url);
  } else if (_opName && evtType === 'match' && _clubId) {
    calCrestShowImg(null);
    window.sb.from('opponent_branding').select('crest_url')
      .eq('club_id', _clubId).ilike('opponent_name', _opName).maybeSingle()
      .then(({ data }) => { if (data?.crest_url) calCrestShowImg(data.crest_url); });
  } else {
    calCrestShowImg(null);
  }

  toggleMatchFields(evtType);
  toggleRpeRow(evtType);
  updateAuPreview();

  // Visible-to chips: restore saved value or apply type default
  if (session?.visible_to?.length) {
    setVisibleToChips(session.visible_to);
  } else {
    setVisibleToDefaults(evtType);
  }

  // Planning link (only for training/gym)
  const planLink  = document.getElementById('calEvtPlanLink');
  const planLabel = document.getElementById('calEvtPlanLinkLabel');
  if (session && planLink) {
    const date = session.session_date;
    const cls  = focusToClass(session.session_type);
    if (cls === 'gym') {
      planLink.href = `Gym Planner.html?date=${date}`;
      planLabel.textContent = tt('calendar.open_in_gym_planner','Open in Gym Planner');
      planLink.style.display = 'inline-flex';
    } else if (!CAL_EVT_TYPES.includes(session.session_type)) {
      // Pass the session id: a day can hold more than one training session and the planner
      // must open THIS one (otherwise it falls back to the oldest of the day).
      planLink.href = `Daily Planning.html?date=${date}${session.source === 'session' && session.id ? `&session=${session.id}` : ''}`;
      planLabel.textContent = tt('calendar.open_in_daily_planning','Open in Daily Planning');
      planLink.style.display = 'inline-flex';
    } else {
      planLink.style.display = 'none';
    }
  } else if (planLink) {
    planLink.style.display = 'none';
  }

  // Tasks section: only for editing existing calendar_events
  const isCalEvtEdit = !!(session && session.source === 'event');
  loadModalTasks(isCalEvtEdit ? session.id : null);
  _wireModalTaskForm(isCalEvtEdit ? session.id : null);
  // Hide form on open
  const taskForm = document.getElementById('calEvtTaskForm');
  if (taskForm) { taskForm.style.display = 'none'; _clearModalTaskForm(); }

  document.getElementById('calEvtBackdrop').classList.add('is-open');
  if (focusTasks) {
    setTimeout(() => document.getElementById('calEvtTasksSection')?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 200);
  } else {
    document.getElementById('calEvtF_title').focus();
  }
}
function closeEvtModal() { document.getElementById('calEvtBackdrop').classList.remove('is-open'); _editEvtId = null; _editEvtSource = null; }

// ── Unified event popover ─────────────────────────────────────
// Session orientation values — must mirror Daily Planning's #dpOrientation options.
const CAL_ORIENTATIONS = ['introductory','activation','muscle_tension','speed','duration','recovery'];
let _evtPop = null;

function closeEvtPopover() {
  if (_evtPop) { _evtPop.remove(); _evtPop = null; }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeEvtPopover(); closeMatchPopover(); }
});

function _positionPop(pop, anchor, width) {
  requestAnimationFrame(() => {
    const popH = pop.offsetHeight;
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 6;
    if (top + popH > window.innerHeight - 10) top = rect.top - popH - 6;
    let left = rect.left - width / 2 + anchor.offsetWidth / 2;
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    pop.style.top  = top  + 'px';
    pop.style.left = left + 'px';
  });
  setTimeout(() => {
    // Use mousedown, not click: a native <select> menu (e.g. the inline orientation editor)
    // dispatches a stray click outside the popover when it closes, which would wrongly dismiss it.
    document.addEventListener('mousedown', function _cp(e) {
      if (!pop.contains(e.target)) { closeEvtPopover(); closeMatchPopover(); document.removeEventListener('mousedown', _cp); }
    });
  }, 0);
}

const EVT_TYPE_LABELS_EN = {
  training:'Training', tactical:'Training', gym:'Gym', match:'Match', recovery:'Recovery', travel:'Travel',
  meeting:'Meeting', evaluation:'Evaluation', video_session:'Video session',
  breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snack:'Snack',
  hotel_checkin:'Hotel check-in', hotel_checkout:'Hotel check-out',
  bus_departure:'Bus departure', bus_arrival:'Bus arrival',
  press:'Press conference', medical_check:'Medical check', physio:'Physio treatment',
  prevention:'Prevention work',
  walkthrough:'Walkthrough', scouting:'Scouting', day_off:'Day off', other:'Other',
  conditioning:'Training', beach:'Beach session', outdoor:'Outdoor endurance',
};
const EVT_TYPE_KEY = {
  training:'calendar.filter_training', tactical:'calendar.filter_training', gym:'calendar.type_gym', match:'calendar.type_match', recovery:'calendar.type_recovery', travel:'calendar.type_travel',
  meeting:'calendar.type_meeting', evaluation:'calendar.type_evaluation', video_session:'calendar.type_video_session',
  breakfast:'calendar.type_breakfast', lunch:'calendar.type_lunch', dinner:'calendar.type_dinner', snack:'calendar.type_snack',
  hotel_checkin:'calendar.type_hotel_checkin', hotel_checkout:'calendar.type_hotel_checkout',
  bus_departure:'calendar.type_bus_departure', bus_arrival:'calendar.type_bus_arrival',
  press:'calendar.type_press', medical_check:'calendar.type_medical_check', physio:'calendar.type_physio',
  prevention:'calendar.type_prevention',
  walkthrough:'calendar.type_walkthrough_short', scouting:'calendar.type_scouting', day_off:'calendar.type_day_off', other:'calendar.type_other',
  conditioning:'calendar.filter_training', beach:'calendar.type_beach', outdoor:'calendar.type_outdoor',
};
function evtTypeLabel(type) {
  const key = EVT_TYPE_KEY[type];
  return key ? tt(key, EVT_TYPE_LABELS_EN[type] || type) : (EVT_TYPE_LABELS_EN[type] || type);
}

function _fmtDateStr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(ttLocale(), { weekday:'short', day:'numeric', month:'short' });
}
function _fmtTime(timeStr) { return timeStr ? timeStr.slice(0,5) : ''; }

function showEvtPopover(anchor, session) {
  closeEvtPopover();
  const isPlayerView = _calView === 'player';
  const cat    = focusToClass(session.session_type);
  const icon   = (session.session_type === 'beach' || session.session_type === 'outdoor') ? EVT_ICONS[session.session_type] : (EVT_ICONS[cat] || 'ti-calendar');
  const typeLabel = evtTypeLabel(session.session_type) || session.session_type || '';
  const title  = session.title || typeLabel;
  const date   = session.session_date;
  const timeStr = _fmtTime(session.start_time);
  const dur    = session.duration ? `${session.duration}′` : '';
  const isCalEvt = session.source === 'event';

  // Header: crest for match, icon otherwise
  let headVisual;
  if (cat === 'match' && session.rival_crest_url) {
    headVisual = `<img class="ep-crest" src="${_esc(session.rival_crest_url)}" onerror="this.style.display='none'" alt="">`;
  } else {
    headVisual = `<span class="ep-icon"><i class="ti ${icon}"></i></span>`;
  }

  // Notes preview (first 2 lines)
  let notesHtml = '';
  if (session.notes) {
    const lines = session.notes.split('\n').filter(l => l.trim());
    const preview = lines.slice(0,2).join('\n');
    const more    = lines.length > 2 ? `<div style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint);margin-top:3px">${tt('calendar.more_lines','+{n} more lines',{n:lines.length-2})}</div>` : '';
    notesHtml = `<div class="cal-epop-notes">${_esc(preview)}${more}</div>`;
  }

  // Body rows (type-specific)
  const rows = [];
  if (timeStr || dur) {
    const pieces = [timeStr, dur].filter(Boolean);
    rows.push(`<div class="cal-epop-row"><i class="ti ti-clock"></i><span>${pieces.join(' · ')}</span></div>`);
  }
  if (cat === 'match') {
    if (session.competition) rows.push(`<div class="cal-epop-row"><i class="ti ${compIcon(compClass(session.competition))}"></i><span>${compLabel(compClass(session.competition))}</span></div>`);
    if (session.home_away)   rows.push(`<div class="cal-epop-row"><i class="ti ${session.home_away==='away'?'ti-plane':'ti-home'}"></i><span>${session.home_away==='away'?tt('calendar.away','Away'):tt('calendar.home','Home')}</span></div>`);
    if (session.location)    rows.push(`<div class="cal-epop-row"><i class="ti ti-map-pin"></i><span>${_esc(session.location)}</span></div>`);
  } else if (cat === 'training' || cat === 'gym') {
    if (session.location)     rows.push(`<div class="cal-epop-row"><i class="ti ti-map-pin"></i><span>${_esc(session.location)}</span></div>`);
    if (session.estimated_rpe) rows.push(`<div class="cal-epop-row"><i class="ti ti-activity"></i><span>${tt('calendar.rpe_prefix','RPE {n}',{n:session.estimated_rpe})}</span></div>`);
  } else if (cat === 'travel') {
    if (session.travel_mode) rows.push(`<div class="cal-epop-row"><i class="ti ${({ bus:'ti-bus', flight:'ti-plane', train:'ti-train' })[session.travel_mode] || 'ti-plane'}"></i><span>${tt('calendar.travel_' + session.travel_mode, ({ bus:'Bus', flight:'Flight', train:'Train', other:'Other' })[session.travel_mode] || session.travel_mode)}</span></div>`);
    if (session.location)   rows.push(`<div class="cal-epop-row"><i class="ti ti-route"></i><span>${_esc(session.location)}</span></div>`);
  } else {
    if (session.location)   rows.push(`<div class="cal-epop-row"><i class="ti ti-map-pin"></i><span>${_esc(session.location)}</span></div>`);
  }
  // Day off parcial: cuántos (y quiénes) están libres — los nombres se completan async
  if (_isPartialDayOff(session)) {
    rows.push(`<div class="cal-epop-row"><i class="ti ti-bed"></i><span id="epDayOffNames">${tt('calendar.dayoff_n_players','{n} players off',{n:session.player_ids.length})}</span></div>`);
  }

  // Planning link
  let planBtn = '';
  if (!isPlayerView) {
    if (cat === 'gym' && date) {
      planBtn = `<a class="cm-btn is-ghost is-sm" href="Gym Planner.html?date=${date}" style="height:26px;text-decoration:none;font-size:11.5px"><i class="ti ti-barbell" style="font-size:11px"></i>${tt('calendar.gym_planner','Gym Planner')}</a>`;
    } else if (cat === 'training' && date) {
      planBtn = `<a class="cm-btn is-ghost is-sm" href="Daily Planning.html?date=${date}${session.source === 'session' && session.id ? `&session=${session.id}` : ''}" style="height:26px;text-decoration:none;font-size:11.5px"><i class="ti ti-clipboard-list" style="font-size:11px"></i>${tt('calendar.daily_planning','Daily Planning')}</a>`;
    } else if (cat === 'match' && isCalEvt) {
      planBtn = `<a class="cm-btn is-ghost is-sm" href="Lineup.html?match=${session.id}" style="height:26px;text-decoration:none;font-size:11.5px"><i class="ti ti-users" style="font-size:11px"></i>${tt('calendar.lineup','Lineup')}</a>`;
    }
    // Videos de ese día: atajo al Video Room ya parado en la fecha.
    const _vidN = _videoDays[date] || 0;
    if (_vidN) {
      planBtn += `<a class="cm-btn is-ghost is-sm" href="Video Room.html?date=${date}" style="height:26px;text-decoration:none;font-size:11.5px"><i class="ti ti-movie" style="font-size:11px"></i>${tt('calendar.videos_n','{n} videos',{n:_vidN})}</a>`;
    }
  }

  // Delete with recurrence check
  let delBtn = '';
  if (!isPlayerView) {
    if (session.recurrence_group_id) {
      delBtn = `<button class="cm-btn is-danger is-sm" id="epDelBtn" data-recur="1" style="height:26px;font-size:11.5px"><i class="ti ti-trash" style="font-size:11px"></i>${tt('calendar.pop_delete','Delete')}</button>`;
    } else {
      delBtn = `<button class="cm-btn is-danger is-sm" id="epDelBtn" style="height:26px;font-size:11.5px"><i class="ti ti-trash" style="font-size:11px"></i>${tt('calendar.pop_delete','Delete')}</button>`;
    }
  }

  // Inline orientation editor — field training sessions only (matches Daily Planning's
  // per-session orientation; both write training_sessions.orientation, so edits reflect on both sides).
  const showOrient = !isPlayerView && cat === 'training' && session.source === 'session';
  const orientSection = showOrient
    ? `<div class="cal-epop-orient">
         <i class="ti ti-compass"></i>
         <span class="cal-epop-orient-lbl">${tt('daily_planning.orientation','Orientation')}</span>
         <select class="cal-epop-orient-sel" id="epOrientSel">
           <option value="">${tt('calendar.orientation_none','— None')}</option>
           ${CAL_ORIENTATIONS.map(o => `<option value="${o}"${session.orientation === o ? ' selected' : ''}>${tt('daily_planning.'+o, o)}</option>`).join('')}
         </select>
         <i class="ti ti-check cal-epop-orient-saved" id="epOrientSaved" style="display:none"></i>
       </div>`
    : '';

  const tasksSection = (!isPlayerView)
    ? `<div class="cal-epop-tasks" id="epTasksWrap">
         <div class="cal-epop-tasks-head" id="epTasksHead">
           <i class="ti ti-checkbox"></i>${tt('calendar.tasks_label','Tasks')}
           <span class="ep-task-ctr" id="epTaskCtr" style="display:none"></span>
           <i class="ti ti-chevron-down" id="epTasksChevron" style="margin-left:auto"></i>
         </div>
         <div class="cal-epop-tasks-body" id="epTasksBody" style="display:none">
           <div style="padding:6px 0;font:var(--cm-body-sm);color:var(--cm-fg-faint)">${tt('common.loading','Loading…')}</div>
         </div>
       </div>`
    : '';

  const pop = document.createElement('div');
  pop.className = 'cal-epop';
  pop.innerHTML = `
    <div class="cal-epop-head">
      ${headVisual}
      <div style="min-width:0;flex:1">
        <div class="cal-epop-title">${_esc(title)}</div>
        <div class="cal-epop-type">${_fmtDateStr(date)}${typeLabel ? ' · ' + typeLabel : ''}</div>
      </div>
    </div>
    ${rows.length || notesHtml ? `<div class="cal-epop-body">${rows.join('')}${notesHtml}</div>` : ''}
    ${orientSection}
    ${tasksSection}
    ${(!isPlayerView) ? `<div class="cal-epop-foot">
      ${planBtn}
      <div class="ep-grow"></div>
      ${delBtn}
      <button class="cm-btn is-primary is-sm" id="epEditBtn" style="height:26px;font-size:11.5px"><i class="ti ti-edit" style="font-size:11px"></i>${tt('calendar.edit_event_btn','Edit event')}</button>
    </div>` : ''}
  `;

  document.body.appendChild(pop);
  _evtPop = pop;
  _positionPop(pop, anchor, 320);

  // Day off parcial: completar los nombres de los jugadores libres (async, plantel cacheado)
  if (_isPartialDayOff(session)) {
    calGetSquad().then(sq => {
      const el = pop.querySelector('#epDayOffNames');
      if (!el || !sq.length) return;
      const names = session.player_ids
        .map(id => sq.find(p => String(p.id) === String(id)))
        .filter(Boolean)
        .map(p => (`${p.first_name||''} ${p.last_name||''}`.trim()).split(' ').pop());
      if (names.length) el.textContent = `${tt('calendar.dayoff_n_players','{n} players off',{n:names.length})}: ${names.join(', ')}`;
      _positionPop(pop, anchor, 320);
    });
  }

  // Wire edit button
  const editBtn = pop.querySelector('#epEditBtn');
  if (editBtn) editBtn.addEventListener('click', () => { closeEvtPopover(); openEvtModal(session); });

  // Wire inline orientation editor — persists straight to training_sessions.orientation,
  // the same column Daily Planning reads/writes (edits reflect on both sides).
  const orientSel = pop.querySelector('#epOrientSel');
  if (orientSel) orientSel.addEventListener('change', async () => {
    const val = orientSel.value || null;
    orientSel.disabled = true;
    const { error } = await window.sb.from('training_sessions').update({ orientation: val }).eq('id', session.id);
    orientSel.disabled = false;
    if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
    session.orientation = val;
    const cached = _sessions.find(s => s.id === session.id && s.source === 'session');
    if (cached) cached.orientation = val;
    const saved = pop.querySelector('#epOrientSaved');
    if (saved) { saved.style.display = ''; setTimeout(() => { if (saved) saved.style.display = 'none'; }, 1400); }
  });

  // Wire delete button
  const delBtnEl = pop.querySelector('#epDelBtn');
  if (delBtnEl) delBtnEl.addEventListener('click', async () => {
    if (delBtnEl.dataset.recur) {
      closeEvtPopover();
      showRecurDeleteDialog(session);
    } else {
      if (!confirm(tt('calendar.delete_this_event','Delete this event?'))) return;
      closeEvtPopover();
      await deleteEvt(session.id, session.source);
    }
  });

  // Tasks collapsible
  if (!isPlayerView) {
    const tasksHead = pop.querySelector('#epTasksHead');
    const tasksBody = pop.querySelector('#epTasksBody');
    const chevron   = pop.querySelector('#epTasksChevron');
    let _tasksOpen  = false;
    let _tasksLoaded = false;

    tasksHead.addEventListener('click', () => {
      _tasksOpen = !_tasksOpen;
      tasksBody.style.display = _tasksOpen ? '' : 'none';
      chevron.className = _tasksOpen ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
      if (_tasksOpen && !_tasksLoaded) { _tasksLoaded = true; loadPopTasks(pop, session.id, session.source); }
      _positionPop(pop, anchor, 320);
    });
  }
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Delete helpers used by popover ────────────────────────────
// Explicit two-action dialog for deleting an occurrence of a recurring series.
function showRecurDeleteDialog(session) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:var(--cm-r-4);box-shadow:var(--cm-shadow-2);max-width:360px;width:100%;padding:20px">
      <div style="font:600 15px/1.3 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:6px">${_esc(tt('calendar.delete_recurring_title','Delete recurring event'))}</div>
      <div style="font:500 13px/1.4 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:16px">${_esc(tt('calendar.delete_recurring_body','This event is part of a series.'))}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="cm-btn is-primary is-sm" data-act="one">${_esc(tt('calendar.delete_only_this','Delete only this one'))}</button>
        <button class="cm-btn is-danger is-sm" data-act="all">${_esc(tt('calendar.delete_all_series','Delete the whole series'))}</button>
        <button class="cm-btn is-ghost is-sm" data-act="cancel">${_esc(tt('common.cancel','Cancel'))}</button>
      </div>
    </div>`;
  const panel = ov.firstElementChild;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  // Buttons wired on the PANEL (delegated) — the overlay click never sees them if the panel stops the bubble.
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) { e.stopPropagation(); return; }   // click inside the panel but not on a button: keep open
    const act = btn.dataset.act;
    close();
    if (act === 'one')      await deleteEvt(session.id, session.source);
    else if (act === 'all') await deleteEvtSeries(session.recurrence_group_id, session.source);
    // 'cancel' → just close()
  });
  // Backdrop click (on the overlay itself) closes without deleting.
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
}

async function deleteEvt(id, source) {
  const prev = _sessions.find(s => s.id === id);   // para limpiar availability si era day off parcial
  const table = (source === 'session') ? 'training_sessions' : 'calendar_events';
  const { data: del, error } = await window.sb.from(table).delete().eq('id', id).select('id');
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  if (!del || !del.length) { showCalToast(tt('calendar.delete_no_rows','Nothing was deleted.')); return; }
  if (prev && _isPartialDayOff(prev)) await calSyncDayOffAvail({ date: prev.session_date, ids: prev.player_ids }, null);
  showCalToast(tt('calendar.event_deleted','Event deleted.'));
  await loadSessions();
  await refreshRibbonMatches();
}

async function deleteEvtSeries(recurrenceGroupId, source) {
  const prevOffs = _sessions.filter(s => s.recurrence_group_id === recurrenceGroupId && _isPartialDayOff(s));
  const table = (source === 'session') ? 'training_sessions' : 'calendar_events';
  const { data: del, error } = await window.sb.from(table).delete().eq('recurrence_group_id', recurrenceGroupId).select('id');
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
  if (!del || !del.length) { showCalToast(tt('calendar.delete_no_rows','Nothing was deleted.')); return; }
  for (const off of prevOffs) await calSyncDayOffAvail({ date: off.session_date, ids: off.player_ids }, null);
  showCalToast(tt('calendar.series_deleted','Series deleted.'));
  await loadSessions();
  await refreshRibbonMatches();
}

// ── Tasks shared helpers ──────────────────────────────────────
let _clubProfiles = null; // cached profiles for assigned_to dropdown

async function _getClubProfiles() {
  if (_clubProfiles) return _clubProfiles;
  const { data } = await window.sb.from('profiles')
    .select('id,full_name,role')
    .eq('club_id', _clubId)
    .order('full_name');
  _clubProfiles = data || [];
  return _clubProfiles;
}

const PRIO_ORDER = { urgent:0, high:1, medium:2, low:3 };

function _sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aD = (a.status === 'done' || a.status === 'cancelled') ? 1 : 0;
    const bD = (b.status === 'done' || b.status === 'cancelled') ? 1 : 0;
    if (aD !== bD) return aD - bD;
    const pA = PRIO_ORDER[a.priority] ?? 2, pB = PRIO_ORDER[b.priority] ?? 2;
    if (pA !== pB) return pA - pB;
    return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
  });
}

function _taskInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function _fmtDue(dueDateStr, isPending) {
  if (!dueDateStr) return '';
  const d   = new Date(dueDateStr + 'T12:00:00');
  const now = new Date(TODAY + 'T12:00:00');
  const over = isPending && d < now;
  const label = d.toLocaleDateString(ttLocale(), { month:'short', day:'numeric' });
  return `<span class="ep-due${over ? ' overdue' : ''}">${label}</span>`;
}

function _prioDot(priority) {
  if (priority === 'high')   return `<span class="ep-prio-dot high" title="${tt('calendar.high_priority','High priority')}"></span>`;
  if (priority === 'urgent') return `<span class="ep-prio-dot urgent" title="${tt('calendar.urgent','Urgent')}"></span>`;
  return '';
}

function _renderTaskRow(t, compact = true) {
  const isDone = t.status === 'done' || t.status === 'cancelled';
  const isPending = !isDone;
  const initials = _taskInitials(t.assigned_to_name);
  const avatarHtml = initials
    ? `<span class="ep-avatar" title="${_esc(t.assigned_to_name)}">${_esc(initials)}</span>`
    : '';
  const dueHtml   = _fmtDue(t.due_date, isPending);
  const prioHtml  = _prioDot(t.priority);
  return `<div class="cal-epop-task" data-task-id="${t.id}">
    <input type="checkbox" ${isDone ? 'checked' : ''} data-task-toggle="${t.id}">
    ${prioHtml}
    <span class="ep-task-title${isDone ? ' is-done' : ''}">${_esc(t.title)}</span>
    ${dueHtml}
    ${avatarHtml}
  </div>`;
}

function _updatePopCtr(ctr, tasks) {
  if (!ctr) return;
  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const done    = tasks.filter(t => t.status === 'done' || t.status === 'cancelled').length;
  if (!tasks.length) { ctr.style.display = 'none'; return; }
  ctr.style.display = '';
  if (pending) {
    ctr.textContent = tt('calendar.tasks_pending_done','{p} pending · {d} done',{p:pending,d:done});
    ctr.className   = 'ep-task-ctr';
  } else {
    ctr.textContent = tt('calendar.all_done','All done');
    ctr.className   = 'ep-task-ctr is-done';
  }
}

// ── Tasks in popover ─────────────────────────────────────────
async function loadPopTasks(pop, eventId, sessionSource) {
  const body = pop.querySelector('#epTasksBody');
  const ctr  = pop.querySelector('#epTaskCtr');
  if (!body) return;

  if (sessionSource === 'session') {
    body.innerHTML = `<div style="padding:4px 0;font:var(--cm-body-sm);color:var(--cm-fg-faint)">${tt('calendar.resave_enable_tasks','Re-save this event via the New Event modal to enable tasks.')}</div>`;
    return;
  }

  const { data: raw, error } = await window.sb.from('tasks')
    .select('id,title,status,priority,due_date,assigned_to,assigned_to_name,created_at')
    .eq('event_id', eventId)
    .eq('club_id', _clubId);

  if (error) {
    body.innerHTML = `<div style="padding:4px 0;font:var(--cm-body-sm);color:var(--cm-danger)">${tt('calendar.could_not_load_tasks','Could not load tasks.')}</div>`;
    return;
  }

  const tasks = _sortTasks(raw || []);
  _updatePopCtr(ctr, tasks);

  const visible  = tasks.slice(0, 5);
  const overflow = tasks.length > 5 ? tasks.length - 5 : 0;

  let html = '';
  if (!tasks.length) {
    html = `<div style="padding:3px 0;font:var(--cm-body-sm);color:var(--cm-fg-faint)">${tt('calendar.no_tasks_yet','No tasks yet')}</div>`;
  } else {
    html = visible.map(t => _renderTaskRow(t)).join('');
  }
  if (overflow) {
    html += `<div style="font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);padding:3px 0;cursor:pointer" id="epTaskViewAll">${tt('calendar.more_view_all','+{n} more — view all',{n:overflow})}</div>`;
  }

  // Profiles for assigned_to dropdown
  const profiles = await _getClubProfiles();
  const profOpts = profiles.map(p => `<option value="${p.id}" data-name="${_esc(p.full_name)}">${_esc(p.full_name)}</option>`).join('');

  html += `<div class="cal-epop-task-add" id="epTaskAddRow">
    <input type="text" id="epTaskInput" placeholder="${tt('calendar.add_task_ph','Add task…')}" maxlength="200">
    <button id="epTaskSave" title="${tt('calendar.save_task_title','Save task')}"><i class="ti ti-check" style="font-size:11px"></i></button>
  </div>
  <div id="epTaskAssignRow" style="display:none;padding:3px 0 2px">
    <select id="epTaskAssignee" style="width:100%;height:26px;font:var(--cm-body-sm);border:1px solid var(--cm-border);border-radius:4px;background:var(--cm-bg-soft);color:var(--cm-fg);padding:0 6px">
      <option value="">${tt('calendar.unassigned','— Unassigned —')}</option>${profOpts}
    </select>
  </div>`;

  body.innerHTML = html;

  // Toggle task status
  body.querySelectorAll('[data-task-toggle]').forEach(chk => {
    chk.addEventListener('change', async () => {
      const tid    = chk.dataset.taskToggle;
      const isDone = chk.checked;
      const row    = chk.closest('.cal-epop-task');
      row.querySelector('.ep-task-title').classList.toggle('is-done', isDone);
      await window.sb.from('tasks').update({ status: isDone ? 'done' : 'pending', updated_at: new Date().toISOString() }).eq('id', tid);
      // Update cached tasks status
      const cached = tasks.find(t => t.id === tid);
      if (cached) cached.status = isDone ? 'done' : 'pending';
      _updatePopCtr(ctr, tasks);
      refreshTaskBadge(eventId);
    });
  });

  // "View all" opens modal
  const viewAll = body.querySelector('#epTaskViewAll');
  if (viewAll) {
    viewAll.addEventListener('click', () => {
      const s = _sessions.find(x => x.id === eventId);
      if (s) { closeEvtPopover(); openEvtModal(s, null, true); }
    });
  }

  // Show assigned_to dropdown when typing
  const inp  = body.querySelector('#epTaskInput');
  const save = body.querySelector('#epTaskSave');
  const assignRow = body.querySelector('#epTaskAssignRow');
  inp.addEventListener('input', () => {
    if (assignRow) assignRow.style.display = inp.value.trim() ? '' : 'none';
  });

  const doSave = async () => {
    const title = inp.value.trim();
    if (!title) return;
    save.disabled = true;

    const assignSel  = body.querySelector('#epTaskAssignee');
    const assignedTo = assignSel?.value || null;
    const assignedName = assignSel?.options[assignSel.selectedIndex]?.dataset.name || null;

    const { data: inserted, error: ie } = await window.sb.from('tasks').insert({
      club_id: _clubId, event_id: eventId, title,
      status: 'pending', priority: 'medium', category: 'event',
      created_by: _currentUserId || null,
      created_by_name: _currentUserName || null,
      assigned_to: assignedTo || null,
      assigned_to_name: assignedName || null,
    }).select('id,title,status,priority,due_date,assigned_to,assigned_to_name,created_at').single();

    save.disabled = false;
    if (ie) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:ie.message})); return; }

    inp.value = '';
    if (assignRow) { assignRow.style.display = 'none'; if (assignSel) assignSel.value = ''; }
    tasks.push(inserted);
    _updatePopCtr(ctr, tasks);

    // Insert new row before add row
    const addRow = body.querySelector('#epTaskAddRow');
    const rowEl  = document.createElement('div');
    rowEl.outerHTML; // force
    addRow.insertAdjacentHTML('beforebegin', _renderTaskRow(inserted));
    const newRow = addRow.previousElementSibling;
    const newChk = newRow?.querySelector('[data-task-toggle]');
    if (newChk) {
      newChk.addEventListener('change', async () => {
        const isDone = newChk.checked;
        newRow.querySelector('.ep-task-title').classList.toggle('is-done', isDone);
        await window.sb.from('tasks').update({ status: isDone ? 'done' : 'pending', updated_at: new Date().toISOString() }).eq('id', inserted.id);
        inserted.status = isDone ? 'done' : 'pending';
        _updatePopCtr(ctr, tasks);
        refreshTaskBadge(eventId);
      });
    }
    refreshTaskBadge(eventId);
  };
  save.addEventListener('click', doSave);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
}

// ── Tasks in event modal ──────────────────────────────────────
let _modalTasksEventId = null;
let _modalTasks        = [];

async function loadModalTasks(eventId) {
  _modalTasksEventId = eventId;
  const section  = document.getElementById('calEvtTasksSection');
  const list     = document.getElementById('calEvtTasksList');
  const ctrEl    = document.getElementById('calEvtTasksCtr');
  if (!section || !list) return;

  // Only for calendar_events
  section.style.display = eventId ? '' : 'none';
  if (!eventId) return;

  list.innerHTML = `<div style="padding:4px 0;font:var(--cm-body-sm);color:var(--cm-fg-faint)">${tt('common.loading','Loading…')}</div>`;

  const { data: raw, error } = await window.sb.from('tasks')
    .select('id,title,status,priority,due_date,assigned_to,assigned_to_name,created_at')
    .eq('event_id', eventId)
    .eq('club_id', _clubId);

  if (error) {
    list.innerHTML = `<div style="font:var(--cm-body-sm);color:var(--cm-danger)">${tt('calendar.error_loading_tasks','Error loading tasks.')}</div>`;
    return;
  }
  _modalTasks = _sortTasks(raw || []);
  _renderModalTaskList(ctrEl);
}

function _renderModalTaskList(ctrEl) {
  const list = document.getElementById('calEvtTasksList');
  if (!list) return;
  const eventId = _modalTasksEventId;
  if (ctrEl) {
    const pending = _modalTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    ctrEl.textContent = _modalTasks.length
      ? tt('calendar.tasks_pending_done','{p} pending · {d} done',{p:pending,d:_modalTasks.filter(t=>t.status==='done'||t.status==='cancelled').length})
      : '';
  }
  if (!_modalTasks.length) {
    list.innerHTML = `<div style="padding:4px 0;font:var(--cm-body-sm);color:var(--cm-fg-faint)">${tt('calendar.no_tasks_yet_hint','No tasks yet — use Add task to create one.')}</div>`;
    return;
  }
  list.innerHTML = _modalTasks.map(t => {
    const isDone = t.status === 'done' || t.status === 'cancelled';
    const isPending = !isDone;
    const prioLabel = { urgent:tt('calendar.prio_urgent_abbr','URGENT'), high:tt('calendar.prio_high_abbr','HIGH'), low:tt('calendar.prio_low_abbr','LOW') }[t.priority] || '';
    const prioColor = { urgent:'var(--cm-danger)', high:'color-mix(in srgb,var(--cm-danger) 70%,var(--cm-warning))', low:'var(--cm-fg-faint)' }[t.priority] || '';
    const dueHtml   = _fmtDue(t.due_date, isPending);
    const assignee  = t.assigned_to_name ? `<span style="font:500 11px/1 var(--cm-font-mono);color:var(--cm-fg-faint)">${_esc(t.assigned_to_name)}</span>` : '';
    return `<div class="cal-modal-task-row" data-task-id="${t.id}">
      <input type="checkbox" ${isDone ? 'checked' : ''} data-modal-task-toggle="${t.id}">
      <div class="cal-modal-task-body">
        <div class="cal-modal-task-title${isDone ? ' is-done' : ''}">${_esc(t.title)}</div>
        <div class="cal-modal-task-meta">
          ${prioLabel ? `<span style="font:600 9px/1 var(--cm-font-mono);color:${prioColor}">${prioLabel}</span>` : ''}
          ${dueHtml}
          ${assignee}
        </div>
      </div>
      <button class="cm-btn is-ghost is-sm" style="height:22px;padding:0 6px;font-size:11px" data-modal-task-del="${t.id}" title="${tt('calendar.delete_task_title','Delete task')}"><i class="ti ti-x" style="font-size:10px"></i></button>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-modal-task-toggle]').forEach(chk => {
    chk.addEventListener('change', async () => {
      const tid = chk.dataset.modalTaskToggle;
      const isDone = chk.checked;
      const row = chk.closest('.cal-modal-task-row');
      row.querySelector('.cal-modal-task-title').classList.toggle('is-done', isDone);
      await window.sb.from('tasks').update({ status: isDone ? 'done' : 'pending', updated_at: new Date().toISOString() }).eq('id', tid);
      const t = _modalTasks.find(x => x.id === tid);
      if (t) t.status = isDone ? 'done' : 'pending';
      if (ctrEl) {
        const pending = _modalTasks.filter(x => x.status === 'pending' || x.status === 'in_progress').length;
        const done    = _modalTasks.filter(x => x.status === 'done' || x.status === 'cancelled').length;
        ctrEl.textContent = tt('calendar.tasks_pending_done','{p} pending · {d} done',{p:pending,d:done});
      }
      refreshTaskBadge(eventId);
    });
  });

  list.querySelectorAll('[data-modal-task-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = btn.dataset.modalTaskDel;
      if (!confirm(tt('calendar.delete_this_task','Delete this task?'))) return;
      await window.sb.from('tasks').delete().eq('id', tid);
      _modalTasks = _modalTasks.filter(t => t.id !== tid);
      _renderModalTaskList(ctrEl);
      refreshTaskBadge(eventId);
    });
  });
}

function _wireModalTaskForm(eventId) {
  const addBtn    = document.getElementById('calEvtTaskAdd');
  const form      = document.getElementById('calEvtTaskForm');
  const cancelBtn = document.getElementById('calEvtTaskFormCancel');
  const saveBtn   = document.getElementById('calEvtTaskFormSave');
  const assignSel = document.getElementById('calEvtTaskF_assignee');
  if (!addBtn || !form) return;

  // Populate assigned_to dropdown
  _getClubProfiles().then(profiles => {
    if (!assignSel) return;
    assignSel.innerHTML = `<option value="">${tt('calendar.unassigned','— Unassigned —')}</option>` +
      profiles.map(p => `<option value="${p.id}" data-name="${_esc(p.full_name)}">${_esc(p.full_name)}</option>`).join('');
  });

  addBtn.addEventListener('click', () => {
    form.style.display = form.style.display === 'none' ? '' : 'none';
    if (form.style.display !== 'none') document.getElementById('calEvtTaskF_title')?.focus();
  });
  cancelBtn.addEventListener('click', () => { form.style.display = 'none'; _clearModalTaskForm(); });

  saveBtn.addEventListener('click', async () => {
    const title = document.getElementById('calEvtTaskF_title')?.value.trim();
    if (!title) { showCalToast(tt('calendar.task_title_required','Task title is required.')); return; }
    const priority  = document.getElementById('calEvtTaskF_priority')?.value || 'medium';
    const dueDate   = document.getElementById('calEvtTaskF_due')?.value || null;
    const sel       = document.getElementById('calEvtTaskF_assignee');
    const assignedTo   = sel?.value || null;
    const assignedName = sel ? (sel.options[sel.selectedIndex]?.dataset.name || null) : null;

    saveBtn.disabled = true;
    const { data: inserted, error } = await window.sb.from('tasks').insert({
      club_id: _clubId, event_id: eventId, title, priority,
      due_date: dueDate || null, status: 'pending', category: 'event',
      created_by: _currentUserId || null,
      created_by_name: _currentUserName || null,
      assigned_to: assignedTo || null,
      assigned_to_name: assignedName || null,
    }).select('id,title,status,priority,due_date,assigned_to,assigned_to_name,created_at').single();
    saveBtn.disabled = false;
    if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
    _modalTasks.unshift(inserted);
    _modalTasks = _sortTasks(_modalTasks);
    const ctrEl = document.getElementById('calEvtTasksCtr');
    _renderModalTaskList(ctrEl);
    _clearModalTaskForm();
    form.style.display = 'none';
    refreshTaskBadge(eventId);
    showCalToast(tt('calendar.task_added','Task added.'));
  });
}

function _clearModalTaskForm() {
  const f = id => document.getElementById(id);
  if (f('calEvtTaskF_title'))    f('calEvtTaskF_title').value = '';
  if (f('calEvtTaskF_priority')) f('calEvtTaskF_priority').value = 'medium';
  if (f('calEvtTaskF_due'))      f('calEvtTaskF_due').value = '';
  if (f('calEvtTaskF_assignee')) f('calEvtTaskF_assignee').value = '';
}

// Refresh the task-dot badge on a specific mc-evt after task changes
async function refreshTaskBadge(eventId) {
  if (!eventId || !_clubId) return;
  const { data } = await window.sb.from('tasks')
    .select('status')
    .eq('event_id', eventId)
    .eq('club_id', _clubId)
    .in('status', ['pending','in_progress']);
  const hasPending = (data || []).length > 0;
  _applyTaskDot(`[data-id="${eventId}"]`, '.mc-evt-task-dot', hasPending);
  _applyTaskDot(`.match-marker[data-evt-id="${eventId}"]`, '.mc-evt-task-dot', hasPending);
}

function _applyTaskDot(selector, dotClass, show) {
  document.querySelectorAll(selector).forEach(el => {
    let dot = el.querySelector(dotClass);
    if (show && !dot) {
      dot = document.createElement('span');
      dot.className = dotClass.replace('.','');
      el.appendChild(dot);
    } else if (!show && dot) {
      dot.remove();
    }
  });
}

// Load task badges for all visible events (mc-evt grid + upcoming rail + match-markers)
async function loadTaskBadges() {
  if (!_clubId) return;
  const eventIds = _sessions.filter(s => s.source === 'event').map(s => s.id);
  if (!eventIds.length) return;

  const { data } = await window.sb.from('tasks')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('club_id', _clubId)
    .in('status', ['pending','in_progress']);
  if (!data) return;

  const pendingSet = new Set(data.map(t => t.event_id));

  // mc-evt grid dots
  document.querySelectorAll('.mc-evt[data-id]').forEach(el => {
    const s = _sessions.find(x => x.id === el.dataset.id);
    if (!s || s.source !== 'event') return;
    if (pendingSet.has(s.id) && !el.querySelector('.mc-evt-task-dot')) {
      const dot = document.createElement('span'); dot.className = 'mc-evt-task-dot'; el.appendChild(dot);
    }
  });

  // Upcoming rail dots
  document.querySelectorAll('.upcoming-row[data-evt-id]').forEach(el => {
    if (pendingSet.has(el.dataset.evtId) && !el.querySelector('.upcoming-task-dot')) {
      const dot = document.createElement('span'); dot.className = 'upcoming-task-dot'; el.appendChild(dot);
    }
  });

  // Season Ribbon match-marker dots
  document.querySelectorAll('.match-marker[data-evt-date]').forEach(el => {
    const s = _sessions.find(x => x.session_date === el.dataset.evtDate && x.session_type === 'match' && x.source === 'event');
    if (s && pendingSet.has(s.id) && !el.querySelector('.mc-evt-task-dot')) {
      const dot = document.createElement('span'); dot.className = 'mc-evt-task-dot'; el.appendChild(dot);
    }
  });
}

async function saveEvt() {
  const saving = document.getElementById('calEvtSaving');
  const saveBtn = document.getElementById('calEvtSave');
  saving.style.display = 'inline'; saveBtn.disabled = true;

  const type        = document.getElementById('calEvtF_type').value;
  const title       = document.getElementById('calEvtF_title').value.trim();
  const date        = document.getElementById('calEvtF_date').value;
  const duration    = type === 'day_off' ? null
                    : type === 'match'   ? 90
                    : (parseInt(document.getElementById('calEvtF_duration').value) || null);
  const notes       = document.getElementById('calEvtF_notes').value.trim() || null;
  const estimatedRpe = parseInt(document.getElementById('calEvtF_rpe').value) || null;
  const startTimeVal = document.getElementById('calEvtF_starttime').value || null;

  if (!type) { showCalToast(tt('calendar.pick_event_type','Pick an event type')); saving.style.display='none'; saveBtn.disabled=false; return; }
  if (!title) { showCalToast(tt('calendar.title_required','Title is required.')); saving.style.display='none'; saveBtn.disabled=false; return; }
  // Field (load) sessions require a start time: dedup + double-session (AM/PM) key on it.
  if ((type === 'training' || type === 'beach' || type === 'outdoor') && !startTimeVal) { showCalToast(tt('calendar.field_time_required','A start time is required for field training sessions.')); saving.style.display='none'; saveBtn.disabled=false; return; }

  // Day off parcial: necesita al menos un jugador tildado
  const isPartialSave = type === 'day_off' && _dayOffScope === 'players';
  if (isPartialSave && !_dayOffSel.size) {
    showCalToast(tt('calendar.dayoff_pick_one','Select at least one player for the day off.'));
    saving.style.display='none'; saveBtn.disabled=false; return;
  }

  // Validation: day_off conflict (soft) — solo el day off de equipo entero bloquea el día
  if (type === 'day_off' && !isPartialSave && !_editEvtId) {
    const dayEvts = _sessions.filter(s => s.session_date === date && s.session_type !== 'day_off');
    if (dayEvts.length > 0 && !confirm(tt('calendar.other_events_save_dayoff','There are {n} other event(s) on {date}. Save day off anyway?',{n:dayEvts.length,date}))) {
      saving.style.display='none'; saveBtn.disabled=false; return;
    }
  }

  // Validation: duplicate meal time (soft)
  if (['breakfast','lunch','dinner','snack'].includes(type) && startTimeVal && !_editEvtId) {
    const clash = _sessions.find(s => s.session_date === date && s.session_type === type && s.start_time && s.start_time.slice(0,5) === startTimeVal.slice(0,5));
    if (clash && !confirm(tt('calendar.meal_exists_confirm','A {type} at {time} already exists on {date}. Save anyway?',{type:evtTypeLabel(type),time:startTimeVal.slice(0,5),date}))) {
      saving.style.display='none'; saveBtn.disabled=false; return;
    }
  }

  // Type-change cleanup: if editing and was 'match', clear match-only fields
  const prevEvt  = _editEvtId ? _sessions.find(s => s.id === _editEvtId) : null;
  const prevType = prevEvt?.session_type;
  const matchFieldsToClear = (prevType === 'match' && type !== 'match')
    ? { opponent: null, home_away: null, competition: null, location: null, rival_crest_url: null }
    : {};

  // sort_order transition when start_time changes between null and a value:
  //   null → value: clear sort_order (event enters timed section, time defines order)
  //   value → null: assign to end of no-time events for that day
  let sortOrderPatch = {};
  if (_editEvtId) {
    const existingEvt  = _sessions.find(s => s.id === _editEvtId);
    const prevStartTime = existingEvt?.start_time || null;
    if (!prevStartTime && startTimeVal) {
      sortOrderPatch = { sort_order: null };
    } else if (prevStartTime && !startTimeVal) {
      const dayNoTime = _sessions.filter(s => s.session_date === date && !s.start_time && s.id !== _editEvtId);
      sortOrderPatch = { sort_order: dayNoTime.length };
    }
  }

  const visibleTo = getVisibleToFromChips();
  const clubId = _clubId || await window.getClubId();
  const isCalEvt = CAL_EVT_TYPES.includes(type);
  let error;

  // Recurrence (new events only)
  const repeatChecked = !_editEvtId && document.getElementById('calEvtF_repeat')?.checked;
  if (repeatChecked) {
    const pattern     = document.getElementById('calEvtF_pattern').value;
    const until       = document.getElementById('calEvtF_until').value;
    const customDates = document.getElementById('calEvtF_customDates').value;
    const dates = generateRecurrenceDates(date, pattern, until, customDates);
    if (!dates.length) { showCalToast(tt('calendar.no_dates_generated','No dates generated — check recurrence settings.')); saving.style.display='none'; saveBtn.disabled=false; return; }
    const groupId = crypto.randomUUID();
    let rows, table;
    if (isCalEvt) {
      const basePayload = { title, type, duration_minutes: duration, notes, estimated_rpe: estimatedRpe, start_time: startTimeVal, club_id: clubId, team_id: _activeTeamId, recurrence_group_id: groupId, visible_to: visibleTo, match_day_offset: calMdFieldValue(type) };
      if (type === 'travel') basePayload.travel_mode = document.getElementById('calEvtF_travelMode')?.value || null;
      if (type === 'prevention') basePayload.is_mandatory = !!document.getElementById('calEvtF_mandatory')?.checked;
      if (type === 'day_off') basePayload.player_ids = isPartialSave ? [..._dayOffSel] : null;
      if (type === 'match') {
        basePayload.opponent    = document.getElementById('calEvtF_opponent').value.trim() || null;
        basePayload.home_away   = document.getElementById('calEvtF_homeaway').value || null;
        const compVal = document.getElementById('calEvtF_competition').value || null;
        const compId  = compVal === 'friendly' ? null : compVal;
        const comp    = _calComps.find(c => c.id === compId);
        basePayload.competition_id = compId;
        // «— No competition» = sin tipo; «Friendly» es una elección explícita.
        basePayload.competition    = comp ? comp.comp_type : (compVal === 'friendly' ? 'friendly' : null);
        basePayload.season_id      = _calSeasonId;
        basePayload.location    = document.getElementById('calEvtF_location').value.trim() || null;
      }
      rows  = dates.map(d => ({ ...basePayload, date: d }));
      table = 'calendar_events';
    } else {
      // Session types (tactical/gym/other) must route to training_sessions, same as the non-recurrent branch.
      // recurrence_group_id ties the occurrences into a series (column added by migration).
      const basePayload = { title, session_type: type, duration, notes, estimated_rpe: estimatedRpe, session_time: startTimeVal, visible_to: visibleTo, club_id: clubId, team_id: _activeTeamId, recurrence_group_id: groupId, match_day_offset: calMdFieldValue(type) };
      rows  = dates.map(d => ({ ...basePayload, session_date: d }));
      table = 'training_sessions';
    }
    ({ error } = await window.sb.from(table).insert(rows));
    // Fallback: calendar_events.match_day_offset / is_mandatory todavía no existen en la DB
    if (error && /match_day_offset|is_mandatory/i.test(error.message || '')) {
      const drop = /is_mandatory/i.test(error.message || '') ? 'is_mandatory' : 'match_day_offset';
      rows = rows.map(r => { const rest = { ...r }; delete rest[drop]; return rest; });
      ({ error } = await window.sb.from(table).insert(rows));
    }
    saving.style.display = 'none'; saveBtn.disabled = false;
    if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }
    // Day off parcial recurrente → marcar libres en availability en cada fecha
    if (isPartialSave) {
      for (const d of dates) await calSyncDayOffAvail(null, { date: d, ids: [..._dayOffSel] });
    }
    closeEvtModal();
    showCalToast(tt('calendar.events_created','{n} events created.',{n:rows.length}));
    await loadSessions();
    await refreshRibbonMatches();
    return;
  }

  if (isCalEvt) {
    const payload = { title, type, date, duration_minutes: duration, notes, estimated_rpe: estimatedRpe, start_time: startTimeVal, visible_to: visibleTo, match_day_offset: calMdFieldValue(type), ...matchFieldsToClear };
    payload.travel_mode = type === 'travel' ? (document.getElementById('calEvtF_travelMode')?.value || null) : null;
    // Solo los preventivos pueden ser obligatorios; si el evento cambió de tipo, se limpia.
    payload.is_mandatory = type === 'prevention' && !!document.getElementById('calEvtF_mandatory')?.checked;
    if (type === 'day_off') payload.player_ids = isPartialSave ? [..._dayOffSel] : null;
    else if (prevType === 'day_off') payload.player_ids = null;   // dejó de ser day off
    if (type === 'match') {
      payload.opponent    = document.getElementById('calEvtF_opponent').value.trim() || null;
      payload.home_away   = document.getElementById('calEvtF_homeaway').value || null;
      const compVal = document.getElementById('calEvtF_competition').value || null;
      const compId  = compVal === 'friendly' ? null : compVal;
      const comp    = _calComps.find(c => c.id === compId);
      payload.competition_id = compId;
      // «— No competition» = sin tipo; «Friendly» es una elección explícita.
      payload.competition    = comp ? comp.comp_type : (compVal === 'friendly' ? 'friendly' : null);
      payload.season_id      = _calSeasonId;
      payload.location    = document.getElementById('calEvtF_location').value.trim() || null;
      if (_pendingCrestUrl) payload.rival_crest_url = _pendingCrestUrl;
    }
    if (_editEvtId && _editEvtSource === 'event') {
      Object.assign(payload, sortOrderPatch);
      ({ error } = await window.sb.from('calendar_events').update(payload).eq('id', _editEvtId));
    } else if (_editEvtId && _editEvtSource === 'session') {
      // Type changed from training to calendar event: migrate
      await window.sb.from('training_sessions').delete().eq('id', _editEvtId);
      payload.club_id = clubId;
      payload.team_id = _activeTeamId;
      ({ error } = await window.sb.from('calendar_events').insert(payload));
    } else {
      payload.club_id = clubId;
      payload.team_id = _activeTeamId;
      ({ error } = await window.sb.from('calendar_events').insert(payload));
    }
    // Fallback: la columna todavía no existe en la DB → reintentar sin ella
    if (error && /travel_mode|match_day_offset|is_mandatory/i.test(error.message || '')) {
      if (/travel_mode/i.test(error.message || '')) delete payload.travel_mode;
      if (/match_day_offset/i.test(error.message || '')) delete payload.match_day_offset;
      if (/is_mandatory/i.test(error.message || '')) delete payload.is_mandatory;
      if (_editEvtId && _editEvtSource === 'event') ({ error } = await window.sb.from('calendar_events').update(payload).eq('id', _editEvtId));
      else ({ error } = await window.sb.from('calendar_events').insert(payload));
    }
  } else {
    const payload = { title, session_type: type, session_date: date, duration, notes, estimated_rpe: estimatedRpe, session_time: startTimeVal, visible_to: visibleTo, match_day_offset: calMdFieldValue(type) };
    if (_editEvtId && _editEvtSource === 'session') {
      Object.assign(payload, sortOrderPatch);
      ({ error } = await window.sb.from('training_sessions').update(payload).eq('id', _editEvtId));
    } else if (_editEvtId && _editEvtSource === 'event') {
      // Type changed from calendar event to training: migrate
      await window.sb.from('calendar_events').delete().eq('id', _editEvtId);
      payload.club_id = clubId;
      payload.team_id = _activeTeamId;
      ({ error } = await window.sb.from('training_sessions').insert(payload));
    } else {
      payload.club_id = clubId;
      payload.team_id = _activeTeamId;
      ({ error } = await window.sb.from('training_sessions').insert(payload));
    }
  }

  saving.style.display = 'none'; saveBtn.disabled = false;
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }

  // Day off parcial ⇄ availability: alta/baja/edición de jugadores libres (y limpieza si el
  // evento cambió de tipo o de fecha).
  const _prevOff = prevEvt && _isPartialDayOff(prevEvt) ? { date: prevEvt.session_date, ids: prevEvt.player_ids } : null;
  const _nextOff = isPartialSave ? { date, ids: [..._dayOffSel] } : null;
  if (_prevOff || _nextOff) await calSyncDayOffAvail(_prevOff, _nextOff);

  // Keep the materialized match-session (linked via GPS/RPE) in sync with the edited event:
  //  · duration → su sRPE sigue los minutos reales del partido.
  //  · title + session_attributes.rival/home_away/crest → propaga el RENAME del rival. Sin esto la
  //    sesión-espejo quedaba con el nombre viejo (ej. "Shada FC") aunque el evento se renombrara a
  //    "DG & BASIC FC" (session_attributes.rival es la fuente de verdad del rival en GPS Analysis).
  // No-op cuando no existe la sesión.
  if (type === 'match' && date) {
    const _opp = document.getElementById('calEvtF_opponent').value.trim() || null;
    const _ha  = document.getElementById('calEvtF_homeaway').value || null;
    let _sq = window.sb.from('training_sessions').select('id, session_attributes')
      .eq('club_id', clubId).eq('session_date', date).eq('session_type', 'match');
    _sq = _activeTeamId ? _sq.eq('team_id', _activeTeamId) : _sq.is('team_id', null);
    try {
      const { data: _msess } = await _sq;
      for (const _ms of (_msess || [])) {
        const _attrs = { ...(_ms.session_attributes || {}) };
        if (_opp) _attrs.rival = _opp;
        if (_ha)  _attrs.home_away = _ha;
        if (_pendingCrestUrl) _attrs.rival_crest_url = _pendingCrestUrl;
        await window.sb.from('training_sessions')
          .update({ duration, title, session_attributes: _attrs }).eq('id', _ms.id);
      }
    } catch (e) { console.warn('match-session rival/title sync:', e); }
  }

  // Ensure the rival is in the club's opponent catalog (opponent_branding). Case-insensitive lookup +
  // preserve the REAL casing, so it never duplicates the GPS-imported (proper-case) entries. Runs for
  // EVERY match rival (not only when a crest was uploaded) so a newly-typed rival becomes selectable
  // next time. "Use for this match only" skips the catalog write. Downstream is untouched — the event
  // already saved calendar_events.opponent (text) + rival_crest_url above.
  if (type === 'match') {
    const _matchOnly = document.getElementById('calEvtCrestMatchOnly')?.checked;
    const _opponent  = document.getElementById('calEvtF_opponent').value.trim();
    const _crest     = _pendingCrestUrl;
    if (!_matchOnly && _opponent && clubId) {
      (async () => {
        try {
          const { data: _ex } = await window.sb.from('opponent_branding')
            .select('id, crest_url').eq('club_id', clubId).ilike('opponent_name', _opponent).maybeSingle();
          if (_ex) {
            if (_crest && _crest !== _ex.crest_url)
              await window.sb.from('opponent_branding').update({ crest_url: _crest }).eq('id', _ex.id);
          } else {
            await window.sb.from('opponent_branding')
              .insert({ club_id: clubId, opponent_name: _opponent, crest_url: _crest || null });
          }
        } catch (e) { console.warn('opponent_branding catalog upsert:', e); }
      })();
    }
    if (window.invalidateCrestCache) window.invalidateCrestCache(clubId, _opponent, _editEvtId);
    _pendingCrestUrl = null;
  }

  closeEvtModal();
  showCalToast(_editEvtId ? tt('calendar.event_updated','Event updated.') : tt('calendar.event_added','Event added.'));
  await loadSessions();
  await refreshRibbonMatches();
}

document.getElementById('calEvtClose').addEventListener('click', closeEvtModal);
document.getElementById('calEvtCancel').addEventListener('click', closeEvtModal);
document.getElementById('calEvtSave').addEventListener('click', saveEvt);
document.getElementById('calEvtDelete').addEventListener('click', () => {
  if (!_editEvtId) return;
  if (!confirm(tt('calendar.delete_this_event','Delete this event?'))) return;
  const id = _editEvtId, src = _editEvtSource;
  closeEvtModal();
  deleteEvt(id, src);
});
document.getElementById('calEvtDeleteSeries').addEventListener('click', () => {
  const s = _sessions.find(x => x.id === _editEvtId);
  if (!s?.recurrence_group_id) return;
  if (!confirm(tt('calendar.delete_all_series_confirm','Delete all events in this series?'))) return;
  closeEvtModal();
  deleteEvtSeries(s.recurrence_group_id, s.source);
});
document.getElementById('calEvtBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeEvtModal(); });
document.getElementById('calEvtF_type').addEventListener('change', function() {
  const t = this.value;
  toggleMatchFields(t);
  toggleRpeRow(t);
  updateAuPreview();
  // Duration default on type change (only when field is blank or user hasn't typed)
  const durEl = document.getElementById('calEvtF_duration');
  if (durEl && !_editEvtId) { durEl.value = DURATION_DEFAULTS[t] ?? ''; }
  // day_off: hide duration
  const durWrap = document.getElementById('calEvtDurationWrap');
  if (durWrap) durWrap.style.display = (t === 'day_off' || t === 'match') ? 'none' : '';
  // travel: medio de transporte
  const travelRow = document.getElementById('calEvtTravelRow');
  if (travelRow) travelRow.style.display = t === 'travel' ? '' : 'none';
  // MD: solo para tipos de trabajo
  calSyncMdRow(t);
  // prevention: fila de «asistencia obligatoria»
  calSyncMandatoryRow(t);
  // day_off: show scope row (whole team vs selected players)
  calSyncDayOffRow(t);
  // Update visible-to defaults to match new type (only on new events)
  if (!_editEvtId) setVisibleToDefaults(t);
  calSyncTypeTrigger();
});

// ── Event-type picker (visual card grid) ──────────────────────────
// The <select id="calEvtF_type"> stays as the functional source of truth; this only skins it.
const TYPE_ICONS = {
  training:'ti-soccer-field', beach:'ti-beach', outdoor:'ti-run', gym:'ti-barbell',
  recovery:'ti-heart-rate-monitor', walkthrough:'ti-walk',
  match:'ti-ball-football', scouting:'ti-binoculars',
  breakfast:'ti-coffee', lunch:'ti-soup', dinner:'ti-tools-kitchen', snack:'ti-apple',
  hotel_checkin:'ti-login', hotel_checkout:'ti-logout',
  bus_departure:'ti-bus', bus_arrival:'ti-bus', travel:'ti-plane',
  press:'ti-microphone', medical_check:'ti-stethoscope', physio:'ti-physotherapist',
  prevention:'ti-shield-check', meeting:'ti-users',
  evaluation:'ti-clipboard-list', video_session:'ti-device-desktop',
  day_off:'ti-bed', other:'ti-dots',
};
function calSyncTypeTrigger() {
  const sel = document.getElementById('calEvtF_type');
  const icoEl = document.getElementById('calEvtTypeTrigIcon');
  const lblEl = document.getElementById('calEvtTypeTrigLabel');
  if (!sel || !lblEl) return;
  const val = sel.value;
  const opt = sel.options[sel.selectedIndex];
  if (icoEl) icoEl.className = 'ti ' + (TYPE_ICONS[val] || 'ti-calendar');
  lblEl.removeAttribute('data-i18n');   // stop i18n from re-overwriting the dynamic label
  lblEl.textContent = opt ? opt.textContent : (evtTypeLabel(val) || val);
}
function calBuildTypePop() {
  const sel  = document.getElementById('calEvtF_type');
  const body = document.getElementById('calTypePopBody');
  if (!sel || !body) return;
  let html = '';
  sel.querySelectorAll('optgroup').forEach(og => {
    const cards = Array.from(og.querySelectorAll('option')).map(o => {
      const v = o.value;
      return `<button type="button" class="cal-typecard" data-val="${v}">
        <i class="ti ${TYPE_ICONS[v] || 'ti-calendar'}"></i>
        <span>${_esc(o.textContent)}</span>
      </button>`;
    }).join('');
    html += `<div class="cal-typegroup">
      <div class="cal-typegroup-label">${_esc(og.label)}</div>
      <div class="cal-typegrid">${cards}</div>
    </div>`;
  });
  body.innerHTML = html;
  body.querySelectorAll('.cal-typecard').forEach(card => {
    card.addEventListener('click', () => {
      const v = card.dataset.val;
      if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change')); }
      else { calSyncTypeTrigger(); }
      calCloseTypePop();
    });
  });
}
function calOpenTypePop() {
  const sel = document.getElementById('calEvtF_type');
  calBuildTypePop();
  const cur = sel ? sel.value : '';
  document.querySelectorAll('#calTypePopBody .cal-typecard').forEach(c =>
    c.classList.toggle('is-selected', c.dataset.val === cur));
  const bd = document.getElementById('calTypePopBackdrop');
  bd.classList.add('is-open');
  document.getElementById('calEvtTypeTrigger')?.setAttribute('aria-expanded', 'true');
  const selCard = bd.querySelector('.cal-typecard.is-selected') || bd.querySelector('.cal-typecard');
  setTimeout(() => selCard?.focus(), 30);
}
function calCloseTypePop() {
  document.getElementById('calTypePopBackdrop')?.classList.remove('is-open');
  document.getElementById('calEvtTypeTrigger')?.setAttribute('aria-expanded', 'false');
}
document.getElementById('calEvtTypeTrigger')?.addEventListener('click', calOpenTypePop);
document.getElementById('calTypePopClose')?.addEventListener('click', calCloseTypePop);
document.getElementById('calTypePopBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) calCloseTypePop(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('calTypePopBackdrop')?.classList.contains('is-open')) {
    e.stopPropagation(); calCloseTypePop();
  }
}, true);

document.getElementById('calEvtF_duration').addEventListener('input', updateAuPreview);
document.getElementById('calEvtF_rpe').addEventListener('change', updateAuPreview);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEvtModal(); });

// Recurrence toggle wiring
document.getElementById('calEvtF_repeat').addEventListener('change', function() {
  document.getElementById('calEvtRecurBlock').style.display = this.checked ? '' : 'none';
});
document.getElementById('calEvtF_pattern').addEventListener('change', function() {
  const isCustom = this.value === 'custom';
  const isMcDays = this.value === 'mc_days';
  // "Until" only applies to daily/weekdays; custom & mc_days pick explicit dates.
  document.getElementById('calEvtRecurUntilWrap').style.display  = (isCustom || isMcDays) ? 'none' : '';
  document.getElementById('calEvtCustomDatesWrap').style.display = isCustom ? '' : 'none';
  document.getElementById('calEvtMcDaysWrap').style.display      = isMcDays ? '' : 'none';
  if (isMcDays) calRenderMcPick();
});
document.getElementById('calEvtF_mcPick').addEventListener('change', calRenderMcChips);

// Reload sessions when user returns to this tab (sync changes from Daily/Gym Planning)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && typeof loadSessions === 'function') loadSessions();
});

// ── New Microcycle modal ──────────────────────────────────────
function openMcModal(existingMc) {
  _editMcId = existingMc?.id || null;
  document.getElementById('calMcModalTitle').textContent = existingMc ? tt('calendar.edit_microcycle','Edit microcycle') : tt('calendar.new_microcycle','New microcycle');
  document.getElementById('calMcSave').textContent       = existingMc ? tt('calendar.save_changes','Save changes') : tt('common.create','Create');
  document.getElementById('calMcDelete').style.display   = existingMc ? 'inline-flex'     : 'none';
  document.getElementById('calMcF_name').value     = existingMc?.name       || '';
  document.getElementById('calMcF_start').value    = existingMc?.start_date || '';
  document.getElementById('calMcF_end').value      = existingMc?.end_date   || '';
  document.getElementById('calMcF_comp').value     = existingMc?.color       || '';
  // Micro type — only for periodization models that use it (mirror Annual Planner).
  const typeWrap = document.getElementById('calMcTypeWrap');
  const typeSel  = document.getElementById('calMcF_type');
  if (calModelUsesMicroType()){
    const cur = existingMc?.micro_type || '';
    typeSel.innerHTML = `<option value="">${tt('annual_planner.type_opt','— Type')}</option>` +
      CAL_MICRO_TYPES.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${calMicroTypeLabel(k)}</option>`).join('');
    typeWrap.style.display = '';
  } else {
    typeSel.innerHTML = '';
    typeWrap.style.display = 'none';
  }
  document.getElementById('calMcSaving').style.display = 'none';
  document.getElementById('calMcSave').disabled = false;
  document.getElementById('calMcBackdrop').classList.add('is-open');
  document.getElementById('calMcF_name').focus();
}
function closeMcModal() { document.getElementById('calMcBackdrop').classList.remove('is-open'); _editMcId = null; }

document.getElementById('calNewMcBtn').addEventListener('click', () => openMcModal());
document.getElementById('calMcEditBtn').addEventListener('click', () => {
  const mc = _allMCs[_mcIdx];
  if (mc) openMcModal(mc);
});
document.getElementById('calMcClose').addEventListener('click', closeMcModal);
document.getElementById('calMcCancel').addEventListener('click', closeMcModal);
document.getElementById('calMcBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeMcModal(); });

document.getElementById('calMcSave').addEventListener('click', async () => {
  const name  = document.getElementById('calMcF_name').value.trim();
  const start = document.getElementById('calMcF_start').value;
  const end   = document.getElementById('calMcF_end').value;
  if (!name || !start || !end) { showCalToast(tt('calendar.mc_fields_required','Name, start date and end date are required.')); return; }
  if (end < start) { showCalToast(tt('calendar.end_after_start','End date must be after start date.')); return; }

  const saving = document.getElementById('calMcSaving');
  const saveBtn = document.getElementById('calMcSave');
  saving.style.display = 'inline'; saveBtn.disabled = true;

  const payload = {
    club_id:    _clubId,
    name,
    start_date: start,
    end_date:   end,
    color:      document.getElementById('calMcF_comp').value     || null,
  };
  if (calModelUsesMicroType()) payload.micro_type = document.getElementById('calMcF_type').value || null;

  let error;
  if (_editMcId) {
    const { data: upd, error: e1 } = await window.sb.from('microcycles').update(payload).eq('id', _editMcId).select('id');
    error = e1;
    if (!error && (!upd || !upd.length)) { saving.style.display = 'none'; saveBtn.disabled = false; showCalToast(tt('annual_planner.save_no_rows','Nothing was saved (no matching microcycle).')); return; }
  } else {
    payload.id = crypto.randomUUID();
    payload.team_id = _activeTeamId;
    ({ error } = await window.sb.from('microcycles').insert(payload));
  }
  saving.style.display = 'none'; saveBtn.disabled = false;
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }

  const wasEdit = !!_editMcId;
  closeMcModal();
  showCalToast(wasEdit ? tt('calendar.mc_updated','Microcycle updated.') : tt('calendar.mc_created','Microcycle created.'));

  let { data: mcs, error: mcRefetchErr } = await window.sb.from('microcycles')
    .select(MC_FULL_SELECT).eq('club_id', _clubId).eq('team_id', _activeTeamId).order('start_date', { ascending: false });
  if (mcRefetchErr) {
    const { data: mcsBase } = await window.sb.from('microcycles')
      .select(MC_BASE_SELECT).eq('club_id', _clubId).eq('team_id', _activeTeamId).order('start_date', { ascending: false });
    mcs = mcsBase;
  }
  _allMCs = mcs || [];
  renderSeasonRibbon(_allMCs);
  renderCalKPIs(_allMCs);
  if (!wasEdit) {
    const newIdx = _allMCs.findIndex(m => m.start_date === start && m.name === name);
    if (newIdx >= 0) { _mcIdx = newIdx; _weekOffset = 0; }
    await loadSessions();
  }
});

document.getElementById('calMcDelete').addEventListener('click', async () => {
  if (!_editMcId) return;
  if (!confirm(tt('calendar.delete_mc_confirm','Delete this microcycle? Sessions in its dates are kept.'))) return;
  const delBtn = document.getElementById('calMcDelete');
  delBtn.disabled = true;
  const { error } = await window.sb.from('microcycles').delete().eq('id', _editMcId);
  delBtn.disabled = false;
  if (error) { showCalToast(tt('calendar.error_prefix','Error: {msg}',{msg:error.message})); return; }

  closeMcModal();
  showCalToast(tt('calendar.mc_deleted','Microcycle deleted.'));

  let { data: mcs, error: mcRefetchErr } = await window.sb.from('microcycles')
    .select(MC_FULL_SELECT).eq('club_id', _clubId).eq('team_id', _activeTeamId).order('start_date', { ascending: false });
  if (mcRefetchErr) {
    const { data: mcsBase } = await window.sb.from('microcycles')
      .select(MC_BASE_SELECT).eq('club_id', _clubId).eq('team_id', _activeTeamId).order('start_date', { ascending: false });
    mcs = mcsBase;
  }
  _allMCs = mcs || [];
  if (_mcIdx >= _allMCs.length) _mcIdx = Math.max(0, _allMCs.length - 1);
  renderSeasonRibbon(_allMCs);
  renderCalKPIs(_allMCs);
  await loadSessions();
});

// ── Week navigation ───────────────────────────────────────────
document.getElementById('calWeekPrev').addEventListener('click', () => { _weekOffset--; renderGrid(); });
document.getElementById('calWeekNext').addEventListener('click', () => { _weekOffset++; renderGrid(); });

// ── MC switcher dropdown ──────────────────────────────────────
document.getElementById('calMcNav').addEventListener('click', function(e) {
  e.stopPropagation();
  const existing = document.getElementById('calMcPopover');
  if (existing) { existing.remove(); return; }

  const rect = this.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.id = 'calMcPopover';
  pop.setAttribute('style', `position:fixed;top:${rect.bottom+6}px;right:${window.innerWidth-rect.right}px;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:var(--cm-r-4);box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:150;min-width:240px;max-height:300px;overflow-y:auto;padding:4px`);

  _allMCs.forEach((mc, idx) => {
    const item = document.createElement('button');
    item.setAttribute('style', `display:block;width:100%;padding:8px 12px;border:0;background:${idx===_mcIdx?'var(--cm-accent-soft)':'transparent'};cursor:pointer;border-radius:6px;text-align:left;transition:background 100ms`);
    item.onmouseenter = () => { if (idx !== _mcIdx) item.style.background = 'var(--cm-bg-soft)'; };
    item.onmouseleave = () => { item.style.background = idx===_mcIdx?'var(--cm-accent-soft)':'transparent'; };
    const name = mc.name || `MC ${idx + 1}`;
    const dates = `${mc.start_date} → ${mc.end_date}`;
    item.innerHTML = `<div style="font:600 13px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong)">${name}</div><div style="font:500 11px/1.3 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:2px">${dates}</div>`;
    item.addEventListener('click', async () => {
      _mcIdx = idx;
      _weekOffset = 0;
      pop.remove();
      await loadSessions();
      await loadShareLink();
    });
    pop.appendChild(item);
  });

  document.body.appendChild(pop);
  setTimeout(() => {
    document.addEventListener('click', function close(ev) {
      if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', close); }
    });
  }, 0);
});

// ── Season ribbon V2 controls (px engine, only when RIBBON_V2) ──
(function() {
  const vp = document.getElementById('calRibbonV2');
  if (!vp) return;

  const ppd = () => RIBBON_ZOOM[_ribbonZoomIdx];
  const dayOffset = d => Math.round((new Date(d + 'T00:00:00') - _ribbonV2Meta.ribbonStart) / 86400000);

  function centerToday() {
    if (!_ribbonV2Meta) return;
    const target = dayOffset(TODAY) * ppd() + RIBBON_GUTTER - vp.clientWidth / 2;
    vp.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }
  function rerender(recentre) {
    renderSeasonRibbonV2(_allMCs, _matchSessions);
    if (recentre) requestAnimationFrame(centerToday);
  }

  // Zoom (px-per-day steps via _ribbonZoomIdx)
  document.getElementById('calRibbonZoomIn')?.addEventListener('click', () => {
    if (_ribbonZoomIdx < RIBBON_ZOOM.length - 1) { _ribbonZoomIdx++; rerender(true); }
  });
  document.getElementById('calRibbonZoomOut')?.addEventListener('click', () => {
    if (_ribbonZoomIdx > 0) { _ribbonZoomIdx--; rerender(true); }
  });

  // Today → re-centre
  document.getElementById('calRibbonToday')?.addEventListener('click', centerToday);

  // Pager ±~3 months (scroll, or shift sub-range when active)
  document.querySelectorAll('.cal-ribbon-h .cal-pager button').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const dir = i === 0 ? -1 : 1; // -1 = back, +1 = forward
      if (_ribbonViewRange) {
        const shiftMs = 91 * 86400000 * dir;
        const newFrom = new Date(new Date(_ribbonViewRange.from + 'T00:00:00').getTime() + shiftMs);
        const newTo   = new Date(new Date(_ribbonViewRange.to   + 'T00:00:00').getTime() + shiftMs);
        _ribbonViewRange = { from: newFrom.toISOString().slice(0, 10), to: newTo.toISOString().slice(0, 10) };
        rerender(false);
      } else {
        vp.scrollBy({ left: dir * 91 * ppd(), behavior: 'smooth' });
      }
    });
  });

  // Live pager label on scroll
  let _scrollTimer;
  vp.addEventListener('scroll', () => {
    if (!_ribbonV2Meta) return;
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(() => {
      const p = ppd();
      const base = _ribbonV2Meta.ribbonStart.getTime();
      const visStart = new Date(base + ((vp.scrollLeft - RIBBON_GUTTER) / p) * 86400000);
      const visEnd   = new Date(base + ((vp.scrollLeft + vp.clientWidth - RIBBON_GUTTER) / p) * 86400000);
      const sy = visStart.getFullYear(), ey = visEnd.getFullYear();
      const yr = sy === ey ? String(sy) : `${sy}/${String(ey).slice(2)}`;
      const pagerLabel = document.getElementById('calRibbonPagerLabel');
      if (pagerLabel) pagerLabel.innerHTML = `${yr}<span class="yr">${monthShort(visStart)} → ${monthShort(visEnd)}</span>`;
    }, 40);
  });

  // Drag-pan (reused as-is; works on any scrollable viewport)
  let _drag = null, _moved = false;
  vp.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    _drag = { x: e.clientX, sl: vp.scrollLeft }; _moved = false;
    vp.classList.add('is-grabbing');
  });
  window.addEventListener('pointermove', e => {
    if (!_drag) return;
    const dx = e.clientX - _drag.x;
    if (Math.abs(dx) > 4) _moved = true;
    vp.scrollLeft = _drag.sl - dx;
  });
  window.addEventListener('pointerup', () => { if (_drag){ _drag = null; vp.classList.remove('is-grabbing'); } });
  vp.addEventListener('click', e => { if (_moved){ e.stopPropagation(); e.preventDefault(); _moved = false; } }, true);
})();

// ── Ribbon pager label → date range jump ─────────────────────
(function() {
  let _rangePop = null;
  const closeRangePop = () => { if (_rangePop) { _rangePop.remove(); _rangePop = null; } };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRangePop(); });

  document.getElementById('calRibbonPagerLabel').addEventListener('click', function(e) {
    e.stopPropagation();
    if (_rangePop) { closeRangePop(); return; }

    const rect = this.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.style.cssText = `position:fixed;top:${rect.bottom+6}px;left:${rect.left}px;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:var(--cm-r-4);box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:200;padding:14px 16px;width:280px`;
    pop.innerHTML = `
      <div style="font:600 12px/1 var(--cm-font-sans);color:var(--cm-fg-strong);margin-bottom:10px">${tt('calendar.jump_to_date_range','Jump to date range')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div>
          <label style="display:block;font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:4px">${tt('calendar.from','From')}</label>
          <input id="calRangeFrom" type="date" style="width:100%;height:30px;padding:0 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:var(--cm-body-sm);outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font:500 11px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:4px">${tt('calendar.to','To')}</label>
          <input id="calRangeTo" type="date" style="width:100%;height:30px;padding:0 8px;border:1px solid var(--cm-border);border-radius:var(--cm-r-3);background:var(--cm-bg-soft);color:var(--cm-fg);font:var(--cm-body-sm);outline:none;box-sizing:border-box">
        </div>
      </div>
      <button id="calRangeJump" class="cm-btn is-primary is-sm" style="width:100%">${tt('calendar.show_this_range','Show this range')}</button>
    `;
    document.body.appendChild(pop);
    _rangePop = pop;

    // Pre-fill with current sub-range if active
    if (_ribbonViewRange) {
      pop.querySelector('#calRangeFrom').value = _ribbonViewRange.from;
      pop.querySelector('#calRangeTo').value   = _ribbonViewRange.to;
    }

    pop.querySelector('#calRangeJump').addEventListener('click', () => {
      const from = pop.querySelector('#calRangeFrom').value;
      const to   = pop.querySelector('#calRangeTo').value;
      if (!from || !to || to < from) { showCalToast(tt('calendar.select_valid_range','Select a valid date range.')); return; }
      _ribbonViewRange = { from, to };
      renderSeasonRibbon(_allMCs, _matchSessions);
      closeRangePop();
    });

    setTimeout(() => {
      document.addEventListener('click', function closer(ev) {
        if (!pop.contains(ev.target)) { closeRangePop(); document.removeEventListener('click', closer); }
      });
    }, 0);
  });
})();

// ── Modal rival crest upload ──────────────────────────────────
(function() {
  const input  = document.getElementById('calEvtCrestInput');
  const remBtn = document.getElementById('calEvtCrestRemove');
  if (!input) return;

  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    // Show immediately via data URL
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = ev => res(ev.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    calCrestShowImg(dataUrl);
    _pendingCrestUrl = dataUrl;

    // Upload to Storage (opponent-crests/{club_id}/{slug}.{ext})
    const opName = document.getElementById('calEvtF_opponent')?.value.trim() || tt('calendar.rival_fallback','rival');
    const clubId = _clubId || await window.getClubId();
    const slug   = window.slugifyOpponent ? window.slugifyOpponent(opName) : 'rival';
    const small  = await window.cmShrinkImage(file, { maxDim: 256, maxBytes: 60 * 1024 });
    const ext    = (small.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path   = `opponent-crests/${clubId}/${slug}.${ext}`;

    const { error } = await window.sb.storage.from('club-assets').upload(path, small, { upsert: true, contentType: small.type, cacheControl: window.CM_CACHE_IMMUTABLE });
    if (error) { showCalToast(tt('calendar.upload_failed','Upload failed: {msg}',{msg:error.message})); calCrestShowImg(null); _pendingCrestUrl = null; return; }

    // Canonical path → same URL on re-upload; version it so the new crest wins the cache.
    const { data: { publicUrl: _rawUrl } } = window.sb.storage.from('club-assets').getPublicUrl(path);
    const publicUrl = _rawUrl + '?v=' + Date.now();
    _pendingCrestUrl = publicUrl;
    calCrestShowImg(publicUrl);
  });

  if (remBtn) {
    remBtn.addEventListener('click', () => {
      _pendingCrestUrl = null;
      calCrestShowImg(null);
      input.value = '';
      calCrestSetInitials(document.getElementById('calEvtF_opponent')?.value.trim() || '');
    });
  }
})();

// ── Ribbon Reset button ───────────────────────────────────────
document.getElementById('calRibbonReset')?.addEventListener('click', () => {
  _ribbonViewRange = null;
  renderSeasonRibbon(_allMCs, _matchSessions);
});

// ── Filter pills ──────────────────────────────────────────────
document.querySelectorAll('.cal-filters').forEach(bar => {
  bar.querySelectorAll('.cal-filter-pill').forEach(p => {
    p.addEventListener('click', () => {
      bar.querySelectorAll('.cal-filter-pill').forEach(o => o.classList.remove('is-on'));
      p.classList.add('is-on');
      const txt = p.dataset.filter || 'all';
      _filterType = txt === 'all' ? 'all' : txt;
      renderGrid();
    });
  });
});

// ── View switching ────────────────────────────────────────────
function switchView(view) {
  _calView = view;
  const mcGrid = document.querySelector('.cal-grid');
  // Microcycle and Player view share the same grid
  if (mcGrid) mcGrid.style.display = (view === 'microcycle' || view === 'player') ? '' : 'none';
  document.getElementById('calViewMonth').style.display = view === 'month' ? '' : 'none';
  document.getElementById('calViewList').style.display  = view === 'list'  ? '' : 'none';
  if (view === 'month') renderMonthView();
  if (view === 'list')  renderListView();
  if (view === 'microcycle' || view === 'player') renderGrid(); // re-render to apply/remove player filter
}

// Player banner "Back to staff view" button
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('calPlayerBannerBack')?.addEventListener('click', () => {
    document.querySelectorAll('.cal-segs .cal-seg').forEach(s => {
      s.classList.toggle('is-on', s.dataset.view === 'microcycle');
    });
    switchView('microcycle');
  });
});

document.querySelectorAll('.cal-segs').forEach(g => g.querySelectorAll('.cal-seg').forEach(s => s.addEventListener('click', () => {
  g.querySelectorAll('.cal-seg').forEach(o => o.classList.remove('is-on'));
  s.classList.add('is-on');
  switchView(s.dataset.view || 'microcycle');
})));

// ── Month view ────────────────────────────────────────────────
const EVT_BG = {
  training:'var(--cm-info-bg)', gym:'var(--cm-violet-bg)', match:'var(--cm-danger-bg)', recovery:'var(--cm-success-bg)',
  travel:'#ECFEFF', meeting:'var(--cm-bg-soft)', evaluation:'var(--cm-warning-bg)', video:'var(--cm-info-bg)',
  breakfast:'var(--cm-warning-bg)', lunch:'var(--cm-warning-bg)', dinner:'var(--cm-warning-bg)', snack:'#F7FEE7',
  hotel:'var(--cm-bg-soft)', bus:'var(--cm-bg-soft)',
  press:'var(--cm-info-bg)', medical:'var(--cm-danger-bg)',
  walkthrough:'var(--cm-info-bg)', scouting:'var(--cm-bg-soft)',
  'day-off':'transparent',
};
const EVT_CLR = {
  training:'var(--cm-info)', gym:'var(--cm-violet)', match:'var(--cm-danger)', recovery:'var(--cm-success)',
  travel:'#06B6D4', meeting:'var(--cm-fg-muted)', evaluation:'var(--cm-warning)', video:'var(--cm-info)',
  breakfast:'var(--cm-warning)', lunch:'var(--cm-warning)', dinner:'var(--cm-warning)', snack:'#65A30D',
  hotel:'var(--cm-fg-muted)', bus:'var(--cm-fg-muted)',
  press:'var(--cm-info)', medical:'var(--cm-danger)',
  walkthrough:'var(--cm-info)', scouting:'var(--cm-fg-muted)',
  'day-off':'var(--cm-fg-faint)',
};

async function renderMonthView() {
  const y = _monthY, m = _monthM;
  const label = new Date(y, m, 1).toLocaleDateString(ttLocale(), { month: 'long', year: 'numeric' });
  document.getElementById('calMonthLabel').textContent = label;
  document.getElementById('calMonthTitle').textContent = label;

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthStart  = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const monthEnd    = `${y}-${String(m+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
  document.getElementById('calMonthGrid').innerHTML = `<div style="padding:32px;text-align:center;color:var(--cm-fg-muted)">${tt('common.loading','Loading…')}</div>`;

  const { data: sessions } = await fetchAllEvents(monthStart, monthEnd);

  _monthEvts = [];
  const sessMap = {};
  (sessions || []).forEach(s => {
    const d = (s.session_date || '').split('T')[0];
    if (!sessMap[d]) sessMap[d] = [];
    sessMap[d].push(s);
    _monthEvts.push(s);
  });

  // One extra query per month: which of this month's sessions actually have a plan.
  _plannedIds = new Set();
  const _sessIds = _monthEvts.filter(s => s.source === 'session').map(s => s.id);
  if (_sessIds.length) {
    const { data: _ex } = await window.sb.from('session_exercises').select('session_id').in('session_id', _sessIds);
    (_ex || []).forEach(r => _plannedIds.add(r.session_id));
  }

  const firstDay = new Date(y, m, 1).getDay();
  const DOW = [0,1,2,3,4,5,6].map(dayShort);
  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid var(--cm-border-soft)">`;
  DOW.forEach(d => {
    html += `<div style="padding:6px 8px;font:600 10.5px/1 var(--cm-font-mono);letter-spacing:0.08em;text-transform:uppercase;color:var(--cm-fg-muted);border-right:1px solid var(--cm-border-soft);border-bottom:1px solid var(--cm-border-soft)">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++)
    html += `<div style="min-width:0;min-height:80px;border-right:1px solid var(--cm-border-soft);border-bottom:1px solid var(--cm-border-soft);background:var(--cm-bg-sunk);opacity:0.4"></div>`;

  // MC highlighting palette (only existing --cm-* variables, no new colors)
  const MC_PAL = [
    { bg:'color-mix(in srgb,var(--cm-accent) 7%,var(--cm-surface))',   pillBg:'color-mix(in srgb,var(--cm-accent) 15%,var(--cm-surface))',   pillClr:'var(--cm-accent)' },
    { bg:'color-mix(in srgb,var(--cm-success) 6%,var(--cm-surface))',  pillBg:'color-mix(in srgb,var(--cm-success) 14%,var(--cm-surface))',  pillClr:'var(--cm-success)' },
    { bg:'color-mix(in srgb,var(--cm-warning) 6%,var(--cm-surface))',  pillBg:'color-mix(in srgb,var(--cm-warning) 14%,var(--cm-surface))',  pillClr:'var(--cm-warning)' },
    { bg:'color-mix(in srgb,var(--cm-info) 5%,var(--cm-surface))',     pillBg:'color-mix(in srgb,var(--cm-info) 13%,var(--cm-surface))',     pillClr:'var(--cm-info)' },
    { bg:'color-mix(in srgb,var(--cm-violet) 5%,var(--cm-surface))',   pillBg:'color-mix(in srgb,var(--cm-violet) 12%,var(--cm-surface))',   pillClr:'var(--cm-violet)' },
  ];
  const mcInMonth  = _allMCs.filter(mc => mc.start_date <= monthEnd && mc.end_date >= monthStart);
  const mcPalMap   = {};
  mcInMonth.forEach((mc, i) => { mcPalMap[mc.id] = MC_PAL[i % MC_PAL.length]; });
  const mcFirstDay = {};
  mcInMonth.forEach(mc => { mcFirstDay[mc.id] = mc.start_date >= monthStart ? mc.start_date : monthStart; });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = dateStr === TODAY;
    const col = (day + firstDay - 1) % 7;
    const noBR = col === 6 ? ';border-right:0' : '';
    const daySess = sessMap[dateStr] || [];
    const dayMc  = mcInMonth.find(mc => mc.start_date <= dateStr && mc.end_date >= dateStr) || null;
    const mcPal  = dayMc ? mcPalMap[dayMc.id] : null;
    const mcAttr = dayMc ? ` data-mc-id="${dayMc.id}"` : '';
    const bgClr  = isToday ? 'color-mix(in srgb,var(--cm-accent) 5%,var(--cm-surface))' : (mcPal ? mcPal.bg : 'var(--cm-surface)');
    let mcPillHtml = '';
    if (dayMc && mcFirstDay[dayMc.id] === dateStr) {
      const isCont   = dayMc.start_date < monthStart;
      const pillLbl  = (isCont ? '← ' : '') + (dayMc.name || 'MC ' + dayMc.id) + (isCont ? ' ' + tt('calendar.mc_cont','cont.') : '');
      mcPillHtml = `<div style="font:600 9px/1 var(--cm-font-mono);letter-spacing:0.05em;text-transform:uppercase;padding:2px 5px;border-radius:3px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:${mcPal.pillBg};color:${mcPal.pillClr}">${_esc(pillLbl)}</div>`;
    }
    html += `<div data-date="${dateStr}" style="min-width:0;min-height:80px;padding:6px 8px;cursor:pointer;border-right:1px solid var(--cm-border-soft);border-bottom:1px solid var(--cm-border-soft)${noBR};background:${bgClr}"${mcAttr}>
      <div style="font:600 14px/1 var(--cm-font-sans);color:${isToday?'var(--cm-accent)':'var(--cm-fg-strong)'};margin-bottom:4px">${day}</div>
      ${mcPillHtml}
      ${daySess.map(s => {
        const cat = focusToClass(s.session_type);
        // Matches: show opponent + home/away with crest and a distinct colour (home = green, away = blue).
        if (cat === 'match') {
          const away = s.home_away === 'away';
          const mBg = away ? 'var(--cm-info-bg)' : 'var(--cm-success-bg)';
          const mCl = away ? 'var(--cm-info)'    : 'var(--cm-success)';
          const rivalRaw = s.opponent || (s.title || '').replace(/^vs\s+/i, '') || tt('calendar.match_word', 'Match');
          const ha = away ? 'A' : 'H';
          const crest = s.rival_crest_url
            ? `<img src="${_esc(s.rival_crest_url)}" style="width:13px;height:13px;border-radius:50%;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="">`
            : '';
          const timeStr = s.start_time ? String(s.start_time).slice(0, 5) : '';
          const mTip = _esc(`${away ? tt('calendar.away', 'Away') : tt('calendar.home', 'Home')} · ${rivalRaw}${timeStr ? ' · ' + timeStr : ''}`);
          return `<div title="${mTip}" style="min-width:0;pointer-events:none;display:flex;align-items:center;gap:4px;margin-bottom:2px;padding:2px 5px;border-radius:3px;background:${mBg};color:${mCl};font:600 10.5px/1.3 var(--cm-font-sans);overflow:hidden">${crest}<span style="flex-shrink:0;font:800 8.5px/1 var(--cm-font-mono);padding:1px 3px;border-radius:2px;background:${mCl};color:var(--cm-surface)">${ha}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(rivalRaw)}</span></div>`;
        }
        const bg2 = EVT_BG[cat]  || EVT_BG.training;
        const cl2 = EVT_CLR[cat] || EVT_CLR.training;
        // Filled dot = this training session already has a plan; hollow = empty shell.
        const dot = s.source === 'session'
          ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:4px;vertical-align:1px;${_plannedIds.has(s.id) ? `background:${cl2}` : `background:transparent;border:1px solid ${cl2};opacity:.6`}"></span>`
          : '';
        const tip = _esc(s.title||s.session_type) + (s.source === 'session' ? ' · ' + _esc(_plannedIds.has(s.id) ? tt('calendar.planned','Planned') : tt('calendar.not_planned','No plan yet')) : '');
        return `<div title="${tip}" style="min-width:0;pointer-events:none;margin-bottom:2px;padding:2px 5px;border-radius:3px;background:${bg2};color:${cl2};font:600 10.5px/1.3 var(--cm-font-sans);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dot}${_esc(s.title||s.session_type)}</div>`;
      }).join('')}
    </div>`;
  }
  html += '</div>';
  document.getElementById('calMonthGrid').innerHTML = html;

  // Day click → in-place day summary popover (stays in month view).
  const monthGrid = document.getElementById('calMonthGrid');
  monthGrid.querySelectorAll('[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openDaySummary(cell.dataset.date));
  });

  // MC hover-highlight: mousing over any day highlights all days of the same MC
  monthGrid.querySelectorAll('[data-mc-id]').forEach(cell => {
    const mcId = cell.dataset.mcId;
    const pal  = mcPalMap[mcId];
    if (!pal) return;
    cell.addEventListener('mouseover', () => {
      monthGrid.querySelectorAll('[data-mc-id]').forEach(c => {
        if (c.dataset.mcId === mcId) { c.style.outline = `1.5px solid ${pal.pillClr}`; c.style.outlineOffset = '-1.5px'; }
      });
    });
    cell.addEventListener('mouseout', () => {
      monthGrid.querySelectorAll('[data-mc-id]').forEach(c => {
        if (c.dataset.mcId === mcId) { c.style.outline = ''; c.style.outlineOffset = ''; }
      });
    });
  });

  renderUpcoming();   // re-anchor "Upcoming" to the now-viewed month
}

function handleMonthEvtClick(sid) {
  const s = _monthEvts.find(e => e.id === sid);
  if (!s) return;
  const cls = focusToClass(s.session_type);
  if (cls === 'gym') { window.location.href = `Gym Planner.html?date=${s.session_date}`; return; }
  if (cls !== 'match' && cls !== 'recovery' && cls !== 'travel' && cls !== 'meeting' && cls !== 'evaluation' && cls !== 'video') {
    window.location.href = `Daily Planning.html?date=${s.session_date}${s.source === 'session' && s.id ? `&session=${s.id}` : ''}`; return;
  }
  if (s._mc) { openMcModal(s._mc); return; }
  openEvtModal(s);
}

// ── Month view · day summary popover ──────────────────────────
// Clicking a day in month view opens an in-place summary (stays in month view) listing
// that day's events, with a button to jump to that day's microcycle.
function _calDayPopEsc(e){ if (e.key === 'Escape') closeDaySummary(); }
function closeDaySummary(){
  const ov = document.getElementById('calDayPop');
  if (ov) ov.classList.remove('is-open');
  document.removeEventListener('keydown', _calDayPopEsc);
}
async function goToMicrocycleForDate(dateStr){
  const idx = _allMCs.findIndex(mc => mc.start_date <= dateStr && mc.end_date >= dateStr);
  document.querySelectorAll('.cal-segs .cal-seg').forEach(s => s.classList.toggle('is-on', s.dataset.view === 'microcycle'));
  if (idx >= 0) { _mcIdx = idx; _weekOffset = 0; }
  switchView('microcycle');
  if (idx < 0) return;
  await loadSessions();   // fetch + render the target microcycle
  // Land ON the clicked day: scroll the day strip to it and highlight it briefly.
  const grid = document.getElementById('calDaysGrid');
  const cell = grid && grid.querySelector(`.mc-day[data-date="${dateStr}"]`);
  if (cell) {
    try { cell.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (_) { cell.scrollIntoView(); }
    cell.classList.add('is-focus-day');
    setTimeout(() => cell.classList.remove('is-focus-day'), 2400);
  }
}
function openDaySummary(dateStr){
  if (!dateStr) return;
  const evts = (_monthEvts || [])
    .filter(e => (e.session_date || '').split('T')[0] === dateStr)
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const mc = _allMCs.find(m => m.start_date <= dateStr && m.end_date >= dateStr) || null;

  let ov = document.getElementById('calDayPop');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'calDayPop';
    ov.className = 'cal-daypop-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeDaySummary(); });
  }

  const dObj      = new Date(dateStr + 'T12:00:00');
  const dateLabel = dObj.toLocaleDateString(ttLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const mcLabel   = mc ? (mc.name || ('MC ' + mc.id)) : null;

  const rows = evts.length ? evts.map(s => {
    const cat  = focusToClass(s.session_type);
    const bg   = EVT_BG[cat]  || EVT_BG.training;
    const cl   = EVT_CLR[cat] || EVT_CLR.training;
    const time = s.start_time ? s.start_time.slice(0, 5) : '—';
    const label = upcomingTypeLabel(s.session_type);
    // Planned vs empty shell — only meaningful for training_sessions.
    const planTag = s.source !== 'session' ? ''
      : _plannedIds.has(s.id)
        ? `<span class="cal-daypop-plan is-on" title="${_esc(tt('calendar.planned','Planned'))}"><i class="ti ti-clipboard-check"></i></span>`
        : `<span class="cal-daypop-plan" title="${_esc(tt('calendar.not_planned','No plan yet'))}"><i class="ti ti-clipboard"></i></span>`;
    // Only training_sessions carry a plan; calendar_events have nothing to delete here.
    const del = s.source === 'session'
      ? `<button class="cal-daypop-del" data-del-plan="${_esc(s.id)}" title="${_esc(tt('plan_delete.cta','Delete plan'))}" aria-label="${_esc(tt('plan_delete.cta','Delete plan'))}"><i class="ti ti-trash"></i></button>`
      : '';
    return `<div class="cal-daypop-evt" data-evt="${_esc(s.id)}">
      <span class="t">${_esc(time)}</span>
      <span class="nm">${_esc(s.title || s.session_type)}</span>
      <span style="flex-shrink:0;font:600 9.5px/1 var(--cm-font-sans);text-transform:uppercase;letter-spacing:0.04em;padding:3px 7px;border-radius:999px;background:${bg};color:${cl}">${_esc(label)}</span>
      ${planTag}
      ${del}
    </div>`;
  }).join('') : `<div class="cal-daypop-empty">${_esc(tt('calendar.day_no_events','No events this day'))}</div>`;

  ov.innerHTML = `
    <div class="cal-daypop" role="dialog" aria-modal="true">
      <div class="cal-daypop-h">
        <div style="flex:1;min-width:0">
          <h3>${_esc(dateLabel)}</h3>
          ${mcLabel ? `<div class="sub">${_esc(mcLabel)}</div>` : ''}
        </div>
        <button class="cal-daypop-x" data-close aria-label="${_esc(tt('common.close','Close'))}"><i class="ti ti-x"></i></button>
      </div>
      <div class="cal-daypop-body">${rows}</div>
      <div class="cal-daypop-foot">
        <button class="cm-btn is-ghost is-sm" data-close>${_esc(tt('common.close','Close'))}</button>
        <button class="cm-btn is-primary is-sm" data-goto-mc><i class="ti ti-calendar-stats"></i> ${_esc(tt('calendar.go_to_microcycle','Go to microcycle'))}</button>
      </div>
    </div>`;

  ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeDaySummary));
  ov.querySelector('[data-goto-mc]')?.addEventListener('click', () => { closeDaySummary(); goToMicrocycleForDate(dateStr); });
  ov.querySelectorAll('.cal-daypop-evt').forEach(row => row.addEventListener('click', () => { const id = row.dataset.evt; closeDaySummary(); handleMonthEvtClick(id); }));
  // Delete plan — stopPropagation so it never falls through to the row's "open planner" click.
  ov.querySelectorAll('[data-del-plan]').forEach(btn => btn.addEventListener('click', async e => {
    e.stopPropagation();
    try {
      const done = await window.cmDeletePlan({ sessionId: btn.dataset.delPlan, clubId: _clubId, dateLabel });
      if (!done) return;
      closeDaySummary();
      showCalToast(tt('plan_delete.done', 'Plan deleted'));
      await renderMonthView();   // refetches via fetchAllEvents; no need to touch microcycle state
    } catch (err) {
      showCalToast(tt('plan_delete.error', 'Could not delete: {msg}', { msg: err.message }));
    }
  }));

  ov.classList.add('is-open');
  document.addEventListener('keydown', _calDayPopEsc);
}

document.getElementById('calMonthPrev').addEventListener('click', () => {
  _monthM--; if (_monthM < 0) { _monthM = 11; _monthY--; }
  renderMonthView();
});
document.getElementById('calMonthNext').addEventListener('click', () => {
  _monthM++; if (_monthM > 11) { _monthM = 0; _monthY++; }
  renderMonthView();
});

// ── List view ─────────────────────────────────────────────────
async function renderListView() {
  const container = document.getElementById('calListBody');
  if (!container) return;
  container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--cm-fg-muted)">${tt('common.loading','Loading…')}</div>`;

  const in6mo = cmYMD(new Date(Date.now() + 183 * 86400000));
  const { data: sessions } = await fetchAllEvents(TODAY, in6mo);

  const items = (sessions || []).map(s => ({
    date: s.session_date, title: s.title, type: s.session_type, duration: s.duration
  }));
  items.sort((a, b) => a.date > b.date ? 1 : -1);

  const sub = document.getElementById('calListSub');
  if (sub) sub.textContent = tt('calendar.upcoming_sessions_count','{n} upcoming session|{n} upcoming sessions',{n:items.length,count:items.length});

  if (!items.length) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--cm-fg-muted)">${tt('calendar.no_upcoming_sessions','No upcoming sessions found')}</div>`;
    return;
  }

  let html = '';
  let lastDate = '';
  items.forEach(item => {
    const d = new Date(item.date + 'T12:00:00');
    if (item.date !== lastDate) {
      const dlabel = d.toLocaleDateString(ttLocale(), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
      html += `<div style="padding:6px 16px 4px;font:600 11px/1 var(--cm-font-mono);letter-spacing:0.08em;text-transform:uppercase;color:var(--cm-fg-muted);border-top:1px solid var(--cm-border-soft);background:var(--cm-bg-soft)">${dlabel}</div>`;
      lastDate = item.date;
    }
    const cat   = focusToClass(item.type);
    const bg2   = EVT_BG[cat]  || EVT_BG.training;
    const cl2   = EVT_CLR[cat] || EVT_CLR.training;
    const tlabel = upcomingTypeLabel(item.type);
    html += `<div class="upcoming-row">
      <div class="upcoming-date"><div class="m">${d.toLocaleString(ttLocale(),{month:'short'}).toUpperCase()}</div><div class="d">${d.getDate()}</div></div>
      <div class="upcoming-body">
        <div class="upcoming-title">${_esc(item.title||'—')}</div>
        <div class="upcoming-meta"><span class="badge" style="background:${bg2};color:${cl2}">${tlabel}</span>${item.duration ? ' '+item.duration+'min' : ''}</div>
      </div>
      <div></div>
    </div>`;
  });
  container.innerHTML = html;
}

// ── New event button ─────────────────────────────────────────
document.querySelectorAll('.cm-btn.is-primary, [id="calNewEvt"]').forEach(btn => {
  if (btn.querySelector('[data-i18n="calendar.new_event"]') || btn.textContent.includes('New event') || btn.textContent.includes('event')) {
    btn.addEventListener('click', () => openEvtModal(null));
  }
});
