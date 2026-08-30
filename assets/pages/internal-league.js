/* ============================================================================
 * Internal League — la tabla del mes
 * ----------------------------------------------------------------------------
 * Lee lo que se marcó en Daily Planning y lo ordena. Dos decisiones de fondo,
 * heredadas del motor (assets/league.js):
 *
 *  · Se ordena por PUNTOS POR TAREA, no por total. Con un mínimo de participación
 *    para entrar: el que se perdió una semana por una sobrecarga no puede caer al
 *    fondo por ausente — eso sería premiar entrenar tocado.
 *  · La línea de corte se traza solo entre los clasificados, y nunca se solapa:
 *    con 16 jugadores y un corte de 10, comen 8 y pagan 8.
 *
 * Prototipo gateado por el flag de club `internal_league` (fail-closed).
 * ========================================================================== */

let _lgClubId = null, _lgTeamId = null, _lgProfile = null;
let _lgRefDate = null;                 // cualquier día del mes en pantalla
let _lgSeason = null, _lgEvents = [], _lgResults = [], _lgPlayers = [];
let _lgRows = [], _lgCuts = null, _lgScored = 0, _lgPending = 0, _lgMinPlayed = 0;
let _lgSeasons = [];
let _lgCanEdit = false;
let _lgBusy = false;

function tt(key, fallbackEN, vars) {
  const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
  return (v && v !== key) ? v : (fallbackEN != null ? fallbackEN : key);
}
function lgEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function lgName(p) {
  if (!p) return '—';
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—';
}
function lgNum(n, d) { return (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d == null ? 2 : d); }
function lgToast(msg) {
  let el = document.getElementById('lgToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lgToast';
    el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1200;padding:10px 16px;border-radius:10px;background:var(--cm-fg-strong,#111);color:var(--cm-bg,#fff);font:500 12.5px/1 var(--cm-font-sans);box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;transition:opacity .18s ease';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

// ── Carga ──────────────────────────────────────────────────────────────────
async function lgLoadPlayers() {
  const { data } = await window.sb.from('players')
    .select('id,first_name,last_name,number,position, player_teams!inner(team_id)')
    .eq('club_id', _lgClubId).eq('player_teams.team_id', _lgTeamId)
    .neq('status', 'inactive').is('archived_at', null).order('number');
  _lgPlayers = data || [];
}

async function lgLoad() {
  const L = window.CMLeague;
  const season = await L.seasonFor(_lgTeamId, _lgRefDate);
  _lgSeason = season;
  if (!season) { _lgEvents = []; _lgResults = []; }
  else {
    const d = await L.loadSeason(season.id);
    _lgSeason = d.season || season;
    _lgEvents = d.events;
    _lgResults = d.results;
  }
  // Denominador: solo las tareas que efectivamente repartieron puntos. Una tarea
  // marcada y sin resultado no puede contar como "jugada" para nadie — si contara,
  // bajaría el porcentaje de participación de todo el plantel por un olvido.
  const scoredIds = new Set(_lgResults.map(r => r.event_id));
  _lgScored = scoredIds.size;
  _lgPending = _lgEvents.length - _lgScored;

  const st = L.standings(_lgSeason, _lgResults, _lgScored, _lgPlayers);
  _lgRows = st.rows;
  _lgMinPlayed = st.min_played;
  _lgCuts = L.cuts(_lgRows, _lgSeason ? (_lgSeason.cut_size != null ? _lgSeason.cut_size : 10) : 10);
  lgRender();
}

// ── Render ─────────────────────────────────────────────────────────────────
function lgRender() {
  const L = window.CMLeague;
  document.getElementById('lgMonthLabel').textContent = L.monthLabel(_lgRefDate);
  document.getElementById('lgMonthTitle').textContent =
    (_lgSeason && _lgSeason.name) || L.monthLabel(_lgRefDate) || tt('league.table_title', 'Table');

  const stEl = document.getElementById('lgState');
  const closed = !!(_lgSeason && _lgSeason.status === 'closed');
  stEl.style.display = _lgSeason ? '' : 'none';
  stEl.className = 'lg-state ' + (closed ? 'closed' : 'open');
  stEl.textContent = closed ? tt('league.closed', 'Closed') : tt('league.open', 'Open');

  const closeBtn = document.getElementById('lgCloseBtn');
  closeBtn.style.display = (_lgSeason && !closed && _lgCanEdit && _lgScored > 0) ? '' : 'none';
  document.getElementById('lgCfgBtn').style.display = (_lgSeason && _lgCanEdit) ? '' : 'none';

  lgRenderKpis();
  lgRenderTable();
  lgRenderUnranked();
  lgRenderNote();
}

function lgRenderKpis() {
  const host = document.getElementById('lgKpis');
  if (!_lgSeason || !_lgScored) { host.innerHTML = ''; return; }
  const ranked = _lgRows.filter(r => r.ranked);
  const leader = ranked[0] || null;
  const best = _lgRows.slice().sort((a, b) => b.best_streak - a.best_streak)[0] || null;
  const topWins = _lgRows.slice().sort((a, b) => b.win - a.win || b.avg - a.avg)[0] || null;
  const kpi = (k, v, n) => `<div class="lg-kpi"><div class="k">${lgEsc(k)}</div><div class="v">${lgEsc(v)}</div>${n ? `<div class="n">${lgEsc(n)}</div>` : ''}</div>`;
  host.innerHTML =
      kpi(tt('league.kpi_tasks', 'League tasks'), String(_lgScored),
          tt('league.kpi_min_played', `${_lgMinPlayed} to classify`, { count: _lgMinPlayed }))
    + kpi(tt('league.kpi_ranked', 'Classified'), `${ranked.length}/${_lgRows.length}`,
          tt('league.kpi_ranked_note', 'of the players with points'))
    + kpi(tt('league.kpi_leader', 'Leader'), leader ? lgNum(leader.avg) : '—',
          leader ? lgName(leader.player) : '')
    + kpi(tt('league.kpi_mvp', 'Most wins'), topWins ? String(topWins.win) : '—',
          topWins ? lgName(topWins.player) : '')
    + kpi(tt('league.kpi_streak', 'Best streak'), best && best.best_streak ? String(best.best_streak) : '—',
          best && best.best_streak ? lgName(best.player) : '');
}

function lgRowHtml(r, cls) {
  const p = r.player;
  return `<tr class="${cls}">
    <td class="pos">${r.position != null ? r.position : '—'}</td>
    <td class="l"><div class="who">
      <span class="num">${lgEsc(p && p.number != null ? p.number : '—')}</span>
      <span class="nm">${lgEsc(lgName(p))}</span>
      ${r.is_keeper ? `<span class="gk">${lgEsc(tt('league.gk_short', 'GK'))}</span>` : ''}
    </div></td>
    <td class="mut">${r.played}</td>
    <td>${r.win}</td>
    <td>${r.draw}</td>
    <td>${r.loss}</td>
    <td class="pts">${r.points}</td>
    <td class="avg">${lgNum(r.avg)}</td>
    <td class="streak">${r.streak ? '×' + r.streak : '<span class="mut">—</span>'}</td>
  </tr>`;
}

function lgHead() {
  const h = (k, f, cls) => `<th${cls ? ` class="${cls}"` : ''}>${lgEsc(tt(k, f))}</th>`;
  return `<thead><tr>
    <th class="l">#</th>
    ${h('league.col_player', 'Player', 'l')}
    ${h('league.col_played', 'P')}
    ${h('league.col_win', 'W')}
    ${h('league.col_draw', 'D')}
    ${h('league.col_loss', 'L')}
    ${h('league.col_points', 'Pts')}
    ${h('league.col_avg', 'Pts/task')}
    ${h('league.col_streak', 'Streak')}
  </tr></thead>`;
}

function lgRenderTable() {
  const host = document.getElementById('lgTable');
  if (!_lgSeason || !_lgScored) {
    host.innerHTML = `<div class="lg-empty"><i class="ti ti-trophy-off"></i>
      ${lgEsc(tt('league.empty', 'No results this month yet. Mark a task in the daily planning and load who won.'))}</div>`;
    return;
  }
  const ranked = _lgRows.filter(r => r.ranked);
  if (!ranked.length) {
    host.innerHTML = `<div class="lg-empty"><i class="ti ti-user-off"></i>
      ${lgEsc(tt('league.none_ranked', 'Nobody reached the minimum participation yet.'))}</div>`;
    return;
  }
  const n = ranked.length, size = _lgCuts.size;
  const cutRow = txt => `<tr class="cut"><td colspan="9"><div class="lg-cut">${lgEsc(txt)}</div></td></tr>`;
  let body = '';
  ranked.forEach((r, i) => {
    // La línea que separa a los que comen de los que pagan. Cuando el corte parte
    // la tabla justo al medio, una sola línea dice las dos cosas.
    if (size > 0 && i === size && n - size === size) body += cutRow(tt('league.cut_both', 'They eat ↑ · they pay ↓'));
    else {
      if (size > 0 && i === size) body += cutRow(tt('league.cut_eat', 'They eat ↑'));
      if (size > 0 && i === n - size && n - size !== size) body += cutRow(tt('league.cut_pay', 'They pay ↓'));
    }
    const cls = _lgCuts.topIds.has(r.player_id) ? 'eat' : (_lgCuts.bottomIds.has(r.player_id) ? 'pay' : '');
    body += lgRowHtml(r, cls);
  });
  host.innerHTML = `<table class="lg-t">${lgHead()}<tbody>${body}</tbody></table>`;
}

function lgRenderUnranked() {
  const card = document.getElementById('lgUnrankedCard');
  const host = document.getElementById('lgUnranked');
  const rows = _lgRows.filter(r => !r.ranked);
  if (!rows.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  document.getElementById('lgUnrankedCt').textContent =
    tt('league.unranked_ct', `${rows.length} players`, { count: rows.length });
  const body = rows.map(r => {
    const missing = Math.max(0, _lgMinPlayed - r.played);
    const p = r.player;
    return `<tr>
      <td class="pos">—</td>
      <td class="l"><div class="who">
        <span class="num">${lgEsc(p && p.number != null ? p.number : '—')}</span>
        <span class="nm">${lgEsc(lgName(p))}</span>
        ${r.is_keeper ? `<span class="gk">${lgEsc(tt('league.gk_short', 'GK'))}</span>` : ''}
      </div></td>
      <td class="mut">${r.played}</td>
      <td>${r.win}</td>
      <td>${r.draw}</td>
      <td>${r.loss}</td>
      <td class="pts">${r.points}</td>
      <td class="avg">${lgNum(r.avg)}</td>
      <td class="mut">${lgEsc(tt('league.missing_n', `${missing} to go`, { count: missing }))}</td>
    </tr>`;
  }).join('');
  host.innerHTML = `<table class="lg-t">${lgHead()}<tbody>${body}</tbody></table>`;
}

// Avisos que cambian cómo se lee la tabla: resultados sin cargar y empates
// justo en la línea de corte (ahí el orden lo decide el desempate, y conviene
// que se sepa antes de que alguien pague una comida).
function lgRenderNote() {
  const box = document.getElementById('lgNote');
  const txt = document.getElementById('lgNoteTxt');
  const parts = [];
  if (_lgPending > 0) parts.push(tt('league.note_pending', `${_lgPending} marked tasks have no result loaded, so they give out no points.`, { count: _lgPending }));
  const ranked = _lgRows.filter(r => r.ranked);
  const size = _lgCuts ? _lgCuts.size : 0;
  if (size > 0 && ranked.length > size) {
    const a = ranked[size - 1], b = ranked[size];
    if (a && b && a.avg === b.avg) {
      parts.push(tt('league.note_tie', `${lgName(a.player)} and ${lgName(b.player)} are level right on the cut line — the tiebreak (tasks won) decides.`,
        { a: lgName(a.player), b: lgName(b.player) }));
    }
  }
  if (!parts.length) { box.style.display = 'none'; return; }
  box.style.display = '';
  txt.textContent = parts.join(' ');
}

// ── Historial ──────────────────────────────────────────────────────────────
async function lgLoadHistory() {
  _lgSeasons = await window.CMLeague.listSeasons(_lgClubId, _lgTeamId);
  const card = document.getElementById('lgHistCard');
  const host = document.getElementById('lgHist');
  const done = _lgSeasons.filter(s => s.status === 'closed');
  if (!done.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  host.innerHTML = done.map(s => {
    const on = _lgSeason && s.id === _lgSeason.id;
    return `<button class="${on ? 'on' : ''}" onclick="lgGoTo('${s.start_date}')">
      <i class="ti ti-lock"></i>${lgEsc(s.name || s.start_date)}</button>`;
  }).join('');
}
window.lgGoTo = function (startDate) {
  _lgRefDate = startDate;
  lgLoad().then(lgLoadHistory);
};

// ── Cerrar / reabrir el mes ────────────────────────────────────────────────
async function lgCloseMonth() {
  if (!_lgSeason || _lgBusy) return;
  const ranked = _lgRows.filter(r => r.ranked);
  const eat = ranked.slice(0, _lgCuts.size).map(r => lgName(r.player));
  const pay = _lgCuts.size ? ranked.slice(ranked.length - _lgCuts.size).map(r => lgName(r.player)) : [];
  let msg = tt('league.close_confirm', 'Closing freezes this table: no more results can be loaded for this month.');
  if (_lgPending > 0) msg += '\n\n' + tt('league.close_pending', `Careful: ${_lgPending} marked tasks still have no result.`, { count: _lgPending });
  if (pay.length) msg += '\n\n' + tt('league.close_pay', 'They pay:') + ' ' + pay.join(', ');
  if (eat.length) msg += '\n' + tt('league.close_eat', 'They eat:') + ' ' + eat.join(', ');
  if (!confirm(msg)) return;
  _lgBusy = true;
  try {
    const s = await window.CMLeague.closeSeason(_lgSeason.id);
    if (!s) { lgToast(tt('league.save_error', "Couldn't save the result.")); return; }
    lgToast(tt('league.closed_ok', 'Month closed.'));
    await lgLoad();
    await lgLoadHistory();
  } finally { _lgBusy = false; }
}

// ── Ajustes ────────────────────────────────────────────────────────────────
function lgOpenCfg() {
  if (!_lgSeason) return;
  document.getElementById('lgCfgName').value = _lgSeason.name || '';
  document.getElementById('lgCfgCut').value = _lgSeason.cut_size != null ? _lgSeason.cut_size : 10;
  document.getElementById('lgCfgMin').value = Math.round((Number(_lgSeason.min_participation) || 0) * 100);
  document.getElementById('lgCfgReopen').style.display = (_lgSeason.status === 'closed') ? '' : 'none';
  document.getElementById('lgCfgBack').classList.add('is-open');
}
function lgCloseCfg() { document.getElementById('lgCfgBack').classList.remove('is-open'); }

async function lgSaveCfg() {
  if (!_lgSeason || _lgBusy) return;
  const name = document.getElementById('lgCfgName').value.trim();
  const cut = Math.max(0, Math.min(30, parseInt(document.getElementById('lgCfgCut').value, 10) || 0));
  const min = Math.max(0, Math.min(100, parseInt(document.getElementById('lgCfgMin').value, 10) || 0));
  _lgBusy = true;
  try {
    const patch = { name: name || _lgSeason.name, cut_size: cut, min_participation: min / 100 };
    const s = await window.CMLeague.updateSeason(_lgSeason.id, patch);
    if (!s) { lgToast(tt('league.cfg_error', "Couldn't save the settings. Is the cut_size column applied?")); return; }
    lgCloseCfg();
    await lgLoad();
    await lgLoadHistory();
  } finally { _lgBusy = false; }
}

async function lgReopen() {
  if (!_lgSeason) return;
  if (!confirm(tt('league.reopen_confirm', 'Reopen this month so results can be loaded again?'))) return;
  const s = await window.CMLeague.reopenSeason(_lgSeason.id);
  if (!s) { lgToast(tt('league.save_error', "Couldn't save the result.")); return; }
  lgCloseCfg();
  await lgLoad();
  await lgLoadHistory();
}

// ── Navegación de meses ────────────────────────────────────────────────────
function lgShiftMonth(delta) {
  const b = window.CMLeague.monthBounds(_lgRefDate);
  if (!b) return;
  const d = new Date(b.year, b.month - 1 + delta, 1);
  _lgRefDate = window.cmYMD(d);
  lgLoad().then(lgLoadHistory);
}

// ── Equipos ────────────────────────────────────────────────────────────────
async function lgInitTeams() {
  const teams = await window.getTeams(_lgClubId);
  const sel = document.getElementById('lgTeamSelect');
  if (!teams || !teams.length) { sel.innerHTML = '<option>—</option>'; return false; }
  const saved = sessionStorage.getItem('cal_active_team');
  _lgTeamId = (saved && teams.some(t => t.id === saved)) ? saved : teams[0].id;
  sel.innerHTML = teams.map(t => `<option value="${t.id}"${t.id === _lgTeamId ? ' selected' : ''}>${lgEsc(t.name)}</option>`).join('');
  sel.addEventListener('change', async () => {
    _lgTeamId = sel.value;
    sessionStorage.setItem('cal_active_team', _lgTeamId);
    await lgLoadPlayers();
    await lgLoad();
    await lgLoadHistory();
  });
  return true;
}

// ── Boot ───────────────────────────────────────────────────────────────────
(async () => {
  if (!(await window.guardModule())) return;
  _lgClubId = await window.getClubId();
  const [club, profile] = await Promise.all([window.getClub(), window.getProfile()]);
  _lgProfile = profile;
  if (club) window.applyClubTheme();

  // El flag manda: sin él esta página no existe para el club (fail-closed).
  if (!window.CMLeague || !(await window.CMLeague.init())) { location.replace('Hub.html'); return; }

  _lgCanEdit = window.cmTacticalAccess ? window.cmTacticalAccess(profile) : true;
  if (!_lgCanEdit) { try { _lgCanEdit = await window.isSuperAdmin(); } catch (_) {} }

  if (!(await lgInitTeams())) return;
  _lgRefDate = window.cmToday();
  await lgLoadPlayers();
  await lgLoad();
  await lgLoadHistory();

  document.getElementById('lgPrevBtn').addEventListener('click', () => lgShiftMonth(-1));
  document.getElementById('lgNextBtn').addEventListener('click', () => lgShiftMonth(1));
  document.getElementById('lgTodayBtn').addEventListener('click', () => {
    _lgRefDate = window.cmToday();
    lgLoad().then(lgLoadHistory);
  });
  document.getElementById('lgCloseBtn').addEventListener('click', lgCloseMonth);
  document.getElementById('lgCfgBtn').addEventListener('click', lgOpenCfg);
  document.getElementById('lgCfgClose').addEventListener('click', lgCloseCfg);
  document.getElementById('lgCfgCancel').addEventListener('click', lgCloseCfg);
  document.getElementById('lgCfgSave').addEventListener('click', lgSaveCfg);
  document.getElementById('lgCfgReopen').addEventListener('click', lgReopen);
  document.getElementById('lgCfgBack').addEventListener('click', e => { if (e.target === e.currentTarget) lgCloseCfg(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lgCloseCfg(); });
})();
