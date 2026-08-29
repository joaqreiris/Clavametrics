/* ─────────────────────────────────────────────────────────────────────────
   daily-planning.js — el código de la página Daily Planning.

   Estaba escrito dentro de Daily Planning.html: 213 KB de los 276 KB de la
   página, viajando enteros en cada visita porque el HTML no se cachea.

   Va con defer. Comprobado antes de mover nada:
     · Los 15 elementos que usa sin protección están todos por encima.
     · No hay un solo querySelectorAll de nivel superior, así que los 26
       elementos de markup que quedan por debajo no cambian nada.
     · El document.write que aparece escribe en OTRA ventana (la de
       impresión, abierta con window.open), no en esta página.
     · El bloque que queda suelto más abajo (los filtros del plantel y el menú
       de estado) sigue inline y ahora corre ANTES que este archivo: se
       verificó que los tres elementos que necesita —dpSquadBody,
       dpStatusMenu y las 7 píldoras— están en el markup por encima suyo, y
       que dpChangeStatus lo llama dentro del callback del clic, no al
       cargarse.
   ──────────────────────────────────────────────────────────────────────── */
let _dpClubId = null, _dpProfile = null, _dpPlayers = [], _dpInjMap = {}, _dpRehabMap = {}, _dpAdaptMap = {}, _dpDayAdaptMap = {}, _dpCurrentDate = null, _dpCurrentSessionId = null;
// A day can hold more than one training session (double session). We load them ALL and let the
// user switch; _dpPreferredSessionId is the one to open (from ?session= or the switcher).
// It self-corrects on date change: an id that isn't in the new day falls back to the first.
let _dpDaySessions = [], _dpPreferredSessionId = null, _dpDayOff = false, _dpDayOffIds = new Set();
let _dpTeamId = null, _dpTeams = [];
let _dpGpsTargets = {};        // metric_key → session target (display units), persisted in training_sessions.gps_targets
let _dpGpsProfiles = {};       // exercise_id → v_exercise_gps_profile row (null = fetched, no GPS profile)
let _dpGpsProfIn = {};         // exercise_id → in-flight fetch promise (dedupe badges vs projection)
let _libExercises = [], _libFolders = [], _libOrient = '', _dpMicrocycles = [], _dpPublished = false;
let _dpGpsExSet = null;         // Set of exercise_ids with a GPS profile (library picker tick), or null until loaded
let _dpCalFields = new Set();
let _dpAvMap = {}, _dpActTotalMin = 0, _dpGkTotalMin = 0, _dpFieldExercises = [], _libMode = 'main', _dpSaveTimer = null;
const _dpPngCache = {};   // planner_exercise_id -> preview <img src> (signed URL or base64), or null when known-absent
const _dpDescCache = {};  // planner_exercise_id -> { objective, description } from the Drill Designer exercise (null when absent)

// i18n helpers
function tt(key, fallbackEN, vars){ const v=(window.CM_I18N&&CM_I18N.t)?CM_I18N.t(key,vars):null; return (v&&v!==key)?v:(fallbackEN!=null?fallbackEN:key); }
function ttLocale(){ return (window.CM_I18N && window.CM_I18N.current) || 'en-GB'; }

// Resolve preview images for a set of exercise ids → fills _dpPngCache[id] with a usable <img src> (signed URL or base64) or null.
async function dpResolvePreviews(ids) {
  const need = [...new Set((ids||[]).filter(id => id && !(id in _dpPngCache)))];
  if (!need.length) return;
  try {
    const { data: rows } = await window.sb.from('exercises')
      .select('id, preview_path, preview_png, objective, description, video_url').eq('club_id', _dpClubId).in('id', need);
    const paths = (rows||[]).filter(r => r.preview_path).map(r => r.preview_path);
    let signed = {};
    if (paths.length) {
      const { data: urls } = await window.sb.storage.from('drill-previews').createSignedUrls(paths, 3600);
      (urls||[]).forEach(u => { if (u && u.path && u.signedUrl) signed[u.path] = u.signedUrl; });
    }
    (rows||[]).forEach(r => {
      _dpPngCache[r.id] = r.preview_path ? (signed[r.preview_path] || null) : (r.preview_png || null);
      _dpDescCache[r.id] = { objective: r.objective || '', description: r.description || '', video_url: r.video_url || '' };
    });
  } catch(_) {}
  need.forEach(id => { if (!(id in _dpPngCache)) _dpPngCache[id] = null; if (!(id in _dpDescCache)) _dpDescCache[id] = null; });  // remember misses, don't refetch
}

// Orientation helpers for Planner exercises
function _dpCalcOrientFromM2(m2) {
  if (!m2 || m2 <= 0) return null;
  if (m2 < 40)  return 'ACTIVATION';
  if (m2 < 80)  return 'STRENGTH';
  if (m2 < 160) return 'VELOCITY';
  return 'ENDURANCE';
}
const _DP_ORIENT = {
  ACTIVATION: { short:'ACT', tagCls:'orient-act', label:'Activation' },
  STRENGTH:   { short:'STR', tagCls:'orient-str', label:'Strength' },
  VELOCITY:   { short:'VEL', tagCls:'orient-vel', label:'Velocity' },
  ENDURANCE:  { short:'END', tagCls:'orient-end', label:'Endurance' },
};

function _dpFmt(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(ttLocale(), { weekday:'short', day:'numeric', month:'short' });
}
function _dpAddDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// Broad position buckets: GK · Defenders · Midfielders · Wingers · Strikers.
// Every canonical Squad position (and legacy codes) maps here so nothing falls
// through to a one-off group like CAM/CDM/LW/RW.
const _DP_POS_GROUP = {
  GK:{l:'GK',o:0},
  // Defenders
  CB:{l:'DEF',o:1}, LB:{l:'DEF',o:1}, RB:{l:'DEF',o:1}, LWB:{l:'DEF',o:1}, RWB:{l:'DEF',o:1}, FB:{l:'DEF',o:1}, WB:{l:'DEF',o:1}, DEF:{l:'DEF',o:1},
  // Midfielders (defensive / central / attacking)
  CDM:{l:'MID',o:2}, DM:{l:'MID',o:2}, CM:{l:'MID',o:2}, MF:{l:'MID',o:2}, CAM:{l:'MID',o:2}, AM:{l:'MID',o:2}, MID:{l:'MID',o:2},
  // Wingers / wide
  LM:{l:'WNG',o:3}, RM:{l:'WNG',o:3}, LW:{l:'WNG',o:3}, RW:{l:'WNG',o:3}, WG:{l:'WNG',o:3},
  // Strikers / forwards
  SS:{l:'FWD',o:4}, CF:{l:'FWD',o:4}, ST:{l:'FWD',o:4}, ATT:{l:'FWD',o:4}, FW:{l:'FWD',o:4}
};
const _DP_POS_DISP = { GK:'GK', CB:'CB', LB:'LB', RB:'RB', FB:'FB', DM:'DM', CM:'MF', MF:'MF', WG:'WG', ST:'ST', CF:'CF' };

function dpRenderSquad(avMap) {
  window._dpAvMap = avMap;
  function statusOf(p) {
    const av = avMap[p.id], inj = _dpInjMap[p.id];
    let cls = '', reason = '';
    if (inj) { cls = 'partial'; reason = inj.body_area || inj.injury_type || 'inj'; }
    if      (av?.status === 'away')      { cls = 'away';      reason = av.notes || 'away'; }
    else if (av?.status === 'other_team'){ cls = 'unavailable'; reason = tt('daily_planning.with_other_team','With another team'); }
    else if (av?.status === 'unavailable'){ cls = 'unavailable'; reason = av.notes || 'out'; }
    else if (av?.status === 'day_off')   { cls = 'dayoff';    reason = av.notes || tt('daily_planning.day_off','Day off'); }
    else if (av?.status === 'rehab')     { cls = 'rehab';     reason = av.notes || tt('daily_planning.rehab','Rehab'); }
    else if (av?.status === 'injured')   { cls = 'injured';   reason = av.notes || 'inj'; }
    else if (av?.status === 'sick')      { cls = 'sick';      reason = av.notes || 'sick'; }
    else if (av?.status === 'partial' || av?.status === 'limited') {
      if (!cls) { cls = 'partial'; reason = av.notes || reason || 'partial'; }
    }
    return { cls, reason };
  }
  function chip(p) {
    const { cls, reason } = statusOf(p);
    const lastName = (`${p.first_name} ${p.last_name}`.trim()).split(' ').pop();
    const num = p.number ?? '—';
    const isTrainee = (cls === '' || cls === 'partial');
    const adaptEntry = _dpDayAdaptMap[p.id];
    const amber = (cls === 'partial' || !!adaptEntry);
    const note  = adaptEntry ? (adaptEntry.adaptation_notes || '') : '';
    const tooltip = note || reason;
    return `<span class="dp-player${amber && isTrainee ? ' is-adapt' : ''}${cls ? ' '+cls : ''}" data-status="${cls||'available'}" data-pid="${p.id}" ${tooltip ? `title="${tooltip.replace(/"/g,"'")}"` : ''}><span class="num">${num}</span>${_dpEsc(lastName)}${amber && isTrainee ? '<span class="adapt-dot">●</span>' : ''}</span>` +
      (note && isTrainee ? `<span class="dp-c-note">${_dpEsc(note)}</span>` : '');
  }
  function outChip(p) {
    const { cls, reason } = statusOf(p);
    const lastName = (`${p.first_name} ${p.last_name}`.trim()).split(' ').pop();
    const num = p.number ?? '—';
    return `<span class="dp-player o-pl${cls ? ' '+cls : ''}" data-status="${cls||'available'}" data-pid="${p.id}"${reason ? ` title="${reason.replace(/"/g,"'")}"` : ''}>${num} ${_dpEsc(lastName)}${reason ? ` · ${_dpEsc(reason)}` : ''}</span>`;
  }
  function rehabChip(p) {
    const plan = _dpRehabMap[p.id], inj = _dpInjMap[p.id];
    const lastName = (`${p.first_name} ${p.last_name}`.trim()).split(' ').pop();
    const num = p.number ?? '—';
    const phase = plan?.phase || plan?.phase_type || '';
    const title = [tt('daily_planning.rehab','Rehab'), phase, inj?.body_area || inj?.injury_type || ''].filter(Boolean).join(' · ');
    return `<span class="dp-player o-pl rehab" data-status="injured" data-pid="${p.id}" title="${title.replace(/"/g,"'")}">${num} ${_dpEsc(lastName)} · ${_dpEsc(tt('daily_planning.rehab','Rehab'))}</span>`;
  }

  const trainees = [], outs = [];
  _dpPlayers.forEach(p => { (['','partial'].includes(statusOf(p).cls) ? trainees : outs).push(p); });

  // Grupo «Rehab»: ese día trabajan aparte (sesión de rehab), no están simplemente «Out».
  // Tres vías, en cascada: plan activo en Rehab Planner, tratamiento del fisio registrado
  // para el día, o marcado a mano con el estado 'rehab' desde el menú del jugador.
  const _dpIsRehab = p => {
    const cls = statusOf(p).cls;
    if (cls === 'rehab') return true;
    return cls === 'injured' && (!!_dpRehabMap[p.id] || (window._dpDayTreatIds && window._dpDayTreatIds.has(String(p.id))));
  };
  const rehabs = [];
  for (let i = outs.length - 1; i >= 0; i--) {
    if (_dpIsRehab(outs[i])) rehabs.unshift(outs.splice(i, 1)[0]);
  }

  // Convocatoria por sesión: con grupo definido, los disponibles que no están en él se
  // muestran aparte ("Other session") y no cuentan en el grupo de ESTA sesión.
  const _parts = window._dpSessParts;
  const otherSess = [];
  if (_parts) {
    for (let i = trainees.length - 1; i >= 0; i--) {
      if (!_parts.has(String(trainees[i].id))) otherSess.unshift(trainees.splice(i, 1)[0]);
    }
  }

  // Diferenciado: el lesionado/rehab que SÍ fue anotado en la convocatoria porque ese día
  // hizo trabajo aparte. Sale de «Out»/«Rehab» y se muestra dentro de la sesión, en su
  // propio bloque — no suma al grupo ni a la media (igual que en el RPE).
  const diffIn = [];
  if (_parts) {
    const pull = arr => { for (let i = arr.length - 1; i >= 0; i--) {
      const cls = statusOf(arr[i]).cls;
      if (_parts.has(String(arr[i].id)) && (cls === 'injured' || cls === 'rehab')) diffIn.unshift(arr.splice(i, 1)[0]);
    } };
    pull(outs); pull(rehabs);
  }

  const groups = {};
  trainees.forEach(p => {
    const g = _DP_POS_GROUP[(p.position||'').toUpperCase()] || { l:(p.position||'?').toUpperCase(), o:9 };
    if (!groups[g.l]) groups[g.l] = { o: g.o, list: [] };
    groups[g.l].list.push(p);
  });
  let _dpSquadHtml = Object.entries(groups)
    .sort((a,b) => a[1].o - b[1].o)
    .map(([lbl, {list}]) =>
      `<div class="dp-pl-group"><span class="l">${lbl} · ${list.length}</span><div class="dp-players">${list.map(chip).join('')}</div></div>`
    ).join('');
  if (diffIn.length) {
    _dpSquadHtml += `<div class="dp-squad-out is-diff"><span class="o-lbl">${tt('daily_planning.diff_count', `Modified work · ${diffIn.length}`, {count: diffIn.length})}</span>${diffIn.map(outChip).join('')}</div>`;
  }
  if (otherSess.length) {
    _dpSquadHtml += `<div class="dp-squad-out"><span class="o-lbl">${tt('daily_planning.other_session_count', `Other session · ${otherSess.length}`, {count: otherSess.length})}</span>${otherSess.map(outChip).join('')}</div>`;
  }
  if (rehabs.length) {
    _dpSquadHtml += `<div class="dp-squad-out is-rehab"><span class="o-lbl">${tt('daily_planning.rehab_count', `Rehab · ${rehabs.length}`, {count: rehabs.length})}</span>${rehabs.map(rehabChip).join('')}</div>`;
  }
  if (outs.length) {
    _dpSquadHtml += `<div class="dp-squad-out"><span class="o-lbl">${tt('daily_planning.out_count', `Out · ${outs.length}`, {count: outs.length})}</span>${outs.map(outChip).join('')}</div>`;
  }
  document.getElementById('dpSquadBody').innerHTML = _dpSquadHtml;

  let avCt = 0, partCt = 0, unCt = 0, awayCt = 0, injCt = 0, sickCt = 0, dayOffCt = 0, rehabCt = 0;
  _dpPlayers.forEach(p => {
    const av = avMap[p.id], inj = _dpInjMap[p.id];
    if      (av?.status === 'away')       awayCt++;
    else if (av?.status === 'other_team') unCt++;
    else if (av?.status === 'unavailable') unCt++;
    else if (av?.status === 'day_off')     dayOffCt++;
    else if (av?.status === 'rehab')       rehabCt++;
    else if (av?.status === 'injured')   { (_dpRehabMap[p.id] || (window._dpDayTreatIds && window._dpDayTreatIds.has(String(p.id)))) ? rehabCt++ : injCt++; }
    else if (av?.status === 'sick')        sickCt++;
    else if (inj || av?.status === 'partial' || av?.status === 'limited') partCt++;
    else avCt++;
  });
  const total = _dpPlayers.length;

  // Con convocatoria definida, el contador refleja el grupo de ESTA sesión — los de
  // diferenciado incluidos, para que coincida con el total del board de RPE.
  const _inSessCt = _parts ? trainees.length + diffIn.length : avCt + partCt;
  document.getElementById('dpSquadCt').textContent = tt('daily_planning.of_total', `${_inSessCt} of ${total}`, {avail: _inSessCt, total});

  const awayNotes = _dpPlayers.filter(p => avMap[p.id]?.status === 'away' && avMap[p.id]?.notes).map(p => avMap[p.id].notes);
  const awayDesc  = awayNotes.length ? ` (${[...new Set(awayNotes)].join(' + ')})` : '';
  const _mk = (val, txt, color) => `<span>${color ? `<strong style="color:${color}">${val}</strong> ` : `<strong>${val}</strong> `}${txt}</span>`;
  document.getElementById('dpSquadSummary').innerHTML =
    (_parts ? `<span>${tt('daily_planning.n_in_session', `<strong>${_inSessCt}</strong> in this session`, {count:`<strong>${_inSessCt}</strong>`})}</span><span class="sep"></span>` : '') +
    (diffIn.length ? `<span>${tt('daily_planning.n_diff_work', `<strong style="color:#dc2626">${diffIn.length}</strong> modified work`, {count:`<strong style="color:#dc2626">${diffIn.length}</strong>`})}</span><span class="sep"></span>` : '') +
    `<span>${tt('daily_planning.n_of_m_available', `<strong>${avCt + partCt}</strong> of ${total} available`, {avail:`<strong>${avCt + partCt}</strong>`, total})}</span>` +
    `<span class="sep"></span><span>${tt('daily_planning.n_partial', `<strong style="color:var(--cm-warning)">${partCt}</strong> partial`, {count:`<strong style="color:var(--cm-warning)">${partCt}</strong>`})}</span>` +
    `<span class="sep"></span><span>${tt('daily_planning.n_out', `<strong style="color:var(--cm-danger)">${unCt}</strong> out`, {count:`<strong style="color:var(--cm-danger)">${unCt}</strong>`})}</span>` +
    (dayOffCt ? `<span class="sep"></span><span>${tt('daily_planning.n_day_off', `<strong style="color:#14b8a6">${dayOffCt}</strong> day off`, {count:`<strong style="color:#14b8a6">${dayOffCt}</strong>`})}</span>` : '') +
    (injCt  ? `<span class="sep"></span><span>${tt('daily_planning.n_injured', `<strong style="color:#dc2626">${injCt}</strong> injured`, {count:`<strong style="color:#dc2626">${injCt}</strong>`})}</span>` : '') +
    (rehabCt ? `<span class="sep"></span><span>${tt('daily_planning.n_rehab', `<strong style="color:#f97316">${rehabCt}</strong> in rehab`, {count:`<strong style="color:#f97316">${rehabCt}</strong>`})}</span>` : '') +
    (sickCt ? `<span class="sep"></span><span>${tt('daily_planning.n_sick', `<strong style="color:#a855f7">${sickCt}</strong> sick`, {count:`<strong style="color:#a855f7">${sickCt}</strong>`})}</span>` : '') +
    `<span class="sep"></span><span>${tt('daily_planning.n_away', `<strong style="color:var(--cm-info,#3b82f6)">${awayCt}</strong> away`, {count:`<strong style="color:var(--cm-info,#3b82f6)">${awayCt}</strong>`})}${awayDesc}</span>`;

  document.querySelectorAll('.dp-squad-pill').forEach(p => {
    const f = p.dataset.filter;
    if      (f === 'all')        p.innerHTML = `${tt('common.all','All')} <span class="ct">${total}</span>`;
    else if (f === 'available')  p.innerHTML = `<span class="dot" style="background:var(--cm-success)"></span>${tt('daily_planning.available','Available')} <span class="ct">${avCt}</span>`;
    else if (f === 'partial')    p.innerHTML = `<span class="dot" style="background:var(--cm-warning)"></span>${tt('daily_planning.partial','Partial')} <span class="ct">${partCt}</span>`;
    else if (f === 'unavailable')p.innerHTML = `<span class="dot" style="background:var(--cm-danger)"></span>${tt('daily_planning.unavailable','Unavailable')} <span class="ct">${unCt}</span>`;
    else if (f === 'injured')    p.innerHTML = `<span class="dot" style="background:#dc2626"></span>${tt('daily_planning.injured','Injured')} <span class="ct">${injCt + rehabCt}</span>`;
    else if (f === 'sick')       p.innerHTML = `<span class="dot" style="background:#a855f7"></span>${tt('daily_planning.sick','Sick')} <span class="ct">${sickCt}</span>`;
    else if (f === 'away')       p.innerHTML = `<span class="dot" style="background:var(--cm-info,#3b82f6)"></span>${tt('daily_planning.away','Away')} <span class="ct">${awayCt}</span>`;
  });

  // Re-apply active filter after re-render
  const activeFilter = document.querySelector('.dp-squad-pill.is-on')?.dataset.filter || 'all';
  if (activeFilter !== 'all') {
    document.querySelectorAll('#dpSquadBody .dp-player').forEach(el => {
      el.style.display = (el.dataset.status === activeFilter) ? '' : 'none';
    });
  }
}

// ── Per-exercise player assignment (multi-select) ───────────────────────────
// Named groups of available players per exercise — stored in session_exercises.player_groups.
function _dpStatusCls(p){
  const av = (window._dpAvMap||{})[p.id], inj = _dpInjMap[p.id];
  let cls = inj ? 'partial' : '';
  if      (av?.status === 'away')        cls = 'away';
  else if (av?.status === 'unavailable') cls = 'unavailable';
  else if (av?.status === 'day_off')     cls = 'dayoff';
  else if (av?.status === 'rehab')       cls = 'rehab';
  else if (av?.status === 'injured')     cls = 'injured';
  else if (av?.status === 'sick')        cls = 'sick';
  else if ((av?.status === 'partial' || av?.status === 'limited') && !cls) cls = 'partial';
  return cls;
}
function _dpTrainees(){ return _dpPlayers.filter(p => ['','partial'].includes(_dpStatusCls(p))); }
// Trabajo diferenciado: lesionado o en rehab. No entra al grupo por defecto, pero se puede
// tildar en la convocatoria si ese día hizo algo — y entonces aparece aparte en el RPE.
function _dpIsDiffWork(p){ return ['injured','rehab'].includes(_dpStatusCls(p)); }
// Candidatos de la convocatoria: el grupo que entrena + los de diferenciado (tildables).
function _dpGroupCandidates(){ return _dpPlayers.filter(p => ['','partial','injured','rehab'].includes(_dpStatusCls(p))); }
function _dpPlayerById(id){ return _dpPlayers.find(p => String(p.id) === String(id)) || null; }
function _dpPlayerShort(p){ return (`${p.first_name||''} ${p.last_name||''}`.trim()).split(' ').pop() || '—'; }
const _DP_EXG_COLORS = ['#2563EB','#16A34A','#D97706','#7C3AED','#DC2626','#0891B2'];
function _dpExGroups(e){ return Array.isArray(e?.player_groups) ? e.player_groups : []; }
function _dpEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _dpSafeUrl(u){ const s=String(u==null?'':u).trim(); return /^(https?:\/\/|\/|\.\/|#)/i.test(s) ? s : '#'; }

// Inline groups row inside an exercise card: several named groups, each a multi-select.
function dpExGroupsRow(e){
  const rows = _dpExGroups(e).map(g => {
    const chips = (g.players||[]).map(id => { const p=_dpPlayerById(id); return p
      ? `<span class="dp-exp-chip"><span class="num">${p.number ?? '—'}</span>${_dpPlayerShort(p)}</span>` : ''; }).join('');
    return `<div class="dp-exg" data-gid="${g.id}">
      <div class="dp-exg-h">
        <span class="dp-exg-dot" style="background:${g.color||'#888'}"></span>
        <input class="dp-exg-name" value="${_dpEsc(g.name)}" placeholder="${tt('daily_planning.group','Group')}" oninput="dpExRenameGroup('${e.id}','${g.id}',this.value)">
        <span class="dp-exg-ct">${(g.players||[]).length}</span>
        <button class="dp-exp-add" onclick="dpOpenExGroup('${e.id}','${g.id}',this)">${tt('daily_planning.edit_players','Edit')}</button>
        <button class="dp-exg-del" title="${tt('daily_planning.delete_group','Delete group')}" onclick="dpExDelGroup('${e.id}','${g.id}')">×</button>
      </div>
      <div class="dp-exg-chips">${chips || `<span class="dp-exg-empty">${tt('daily_planning.no_players_yet','no players')}</span>`}</div>
    </div>`;
  }).join('');
  const canCopy = _dpTasksWithGroups(e.id).length > 0;
  const actions = `<div class="dp-exg-actions"><button class="dp-exp-add" onclick="dpExAddGroup('${e.id}')">＋ ${tt('daily_planning.add_group','Add group')}</button>${canCopy ? `<button class="dp-exp-add" onclick="dpOpenCopyGroups('${e.id}',this)"><i class="ti ti-copy" style="font-size:12px;vertical-align:-1px"></i> ${tt('daily_planning.copy_groups','Copy from…')}</button>` : ''}</div>`;
  return `<div class="dp-ex-players no-print" data-exp="${e.id}"><span class="lbl">${tt('daily_planning.groups_label','Groups')}</span>${rows}${actions}</div>`;
}
// Other tasks in this session that already have at least one non-empty group.
function _dpAllTasks(){ return [ ...(_dpFieldExercises||[]), ...((window._dpActItems)||[]) ]; }

// ── Video preview (same providers the Exercise Library recognises) ───────────
// Build an embeddable, muted-autoplay URL from a pasted link. Returns null for
// unknown providers (the modal then shows an "Open video" link instead).
function dpVideoEmbed(url){
  const u = String(url || '').trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&rel=0&playsinline=1`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=1`;
  m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  if (/dropbox\.com/.test(u)) return u.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '');
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) return u;   // direct file → <iframe> plays it
  return null;
}
// Find a session_exercise (field / activation / goalkeeper) by its id.
function dpFindTask(seid){
  return [ ...(_dpFieldExercises||[]), ...((window._dpActItems)||[]), ...((window._dpGkItems)||[]) ]
    .find(x => String(x.id) === String(seid)) || null;
}
// Resolve a task's linked video → { url, embed, name } or null.
function dpTaskVideo(e){
  if (!e) return null;
  if (e.planner_exercise_id){
    const url = (_dpDescCache[e.planner_exercise_id] || {}).video_url || '';
    return url ? { url, embed: dpVideoEmbed(url), name: e.name || '' } : null;
  }
  const gx = e.gym_exercises || null;
  if (gx && gx.video_id && !(gx.media_type === 'image' && gx.media_ref)){
    return { url: `https://www.youtube.com/watch?v=${gx.video_id}`,
             embed: `https://www.youtube.com/embed/${gx.video_id}?autoplay=1&mute=1&rel=0&playsinline=1`,
             name: gx.name || e.name || '' };
  }
  return null;
}
function dpOpenVideo(ev, seid){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const v = dpTaskVideo(dpFindTask(seid));
  if (!v) return;
  document.getElementById('dpVidTitle').textContent = v.name || tt('daily_planning.exercise_video','Exercise video');
  document.getElementById('dpVidBody').innerHTML = v.embed
    ? `<div class="dp-vid-frame"><iframe src="${_dpEsc(_dpSafeUrl(v.embed))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : `<a class="cm-btn is-outline is-sm" href="${_dpEsc(_dpSafeUrl(v.url))}" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:14px"></i>${tt('daily_planning.open_video','Open video')}</a>`;
  document.getElementById('dpVidBackdrop').style.display = 'flex';
}
function dpCloseVideo(){
  document.getElementById('dpVidBody').innerHTML = '';   // unload iframe → stops playback
  document.getElementById('dpVidBackdrop').style.display = 'none';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('dpVidBackdrop')?.style.display === 'flex') dpCloseVideo(); });
function _dpTasksWithGroups(excludeSeid){
  return _dpAllTasks().filter(x => x.id !== excludeSeid && _dpExGroups(x).some(g => (g.players||[]).length));
}
// Refresh just one card's groups row (no full re-render → keeps the popover open).
function dpRefreshExPlayers(seid){
  const e = _dpFindTask(seid); if (!e) return;
  const row = document.querySelector(`.dp-ex-players[data-exp="${seid}"]`);
  if (row) row.outerHTML = dpExGroupsRow(e);
}
function _dpExNextGid(e){ return 'g' + (_dpExGroups(e).reduce((m,g)=>Math.max(m, parseInt(String(g.id).replace(/\D/g,''))||0),0) + 1); }
function dpExAddGroup(seid){
  const e = _dpFindTask(seid); if (!e) return;
  const gs = _dpExGroups(e).slice();
  gs.push({ id:_dpExNextGid(e), name: tt('daily_planning.group_n', `Group ${gs.length+1}`, {n:gs.length+1}), color:_DP_EXG_COLORS[gs.length % _DP_EXG_COLORS.length], players:[] });
  e.player_groups = gs; dpRefreshExPlayers(seid); _dpEditSave(seid, { player_groups: gs });
}
function dpExDelGroup(seid, gid){
  const e = _dpFindTask(seid); if (!e) return;
  e.player_groups = _dpExGroups(e).filter(g => g.id !== gid);
  dpRefreshExPlayers(seid); _dpEditSave(seid, { player_groups: e.player_groups });
}
function dpExRenameGroup(seid, gid, name){
  const e = _dpFindTask(seid); if (!e) return;
  const g = _dpExGroups(e).find(x => x.id === gid); if (!g) return;
  g.name = name; _dpEditSave(seid, { player_groups: e.player_groups });
}
let _dpExgTarget = null;   // { seid, gid }
function dpOpenExGroup(seid, gid, btn){
  const e = _dpFindTask(seid); if (!e) return;
  const g = _dpExGroups(e).find(x => x.id === gid); if (!g) return;
  _dpExgTarget = { seid, gid };
  const menu = document.getElementById('dpExPlayersMenu');
  const sel = new Set((g.players||[]).map(String));
  // Hide players already taken by ANOTHER group of this exercise (a player is in one group only).
  const takenElsewhere = new Set(_dpExGroups(e).filter(x => x.id !== gid).flatMap(x => (x.players||[]).map(String)));
  // Con convocatoria definida (Session group), el picker solo ofrece a los que están
  // en ESTA sesión; los ya asignados al grupo se muestran igual para poder sacarlos.
  const sessParts = window._dpSessParts;
  const avail = _dpTrainees().filter(p => !takenElsewhere.has(String(p.id))
    && (!sessParts || sessParts.has(String(p.id)) || sel.has(String(p.id))));
  // Bucket available players by position (GK/DEF/MID/WNG/FWD) → one column each, so the
  // picker reads horizontally and needs far less vertical scrolling.
  const buckets = {};
  avail.forEach(p => {
    const g2 = _DP_POS_GROUP[(p.position||'').toUpperCase()] || { l:(p.position||'?').toUpperCase(), o:9 };
    if (!buckets[g2.l]) buckets[g2.l] = { o:g2.o, list:[] };
    buckets[g2.l].list.push(p);
  });
  const optRow = p => `<label class="dp-exp-opt"><input type="checkbox" value="${p.id}" ${sel.has(String(p.id))?'checked':''} onchange="dpToggleExGroupPlayer('${p.id}',this.checked)"><span class="num">${p.number ?? '—'}</span><span>${_dpPlayerShort(p)}</span></label>`;
  const cols = Object.entries(buckets)
    .sort((a,b) => a[1].o - b[1].o)
    .map(([lbl, { list }]) =>
      `<div class="dp-exp-col"><div class="dp-exp-col-h">${lbl} · ${list.length}</div>${list.map(optRow).join('')}</div>`
    ).join('');
  const body = cols
    ? `<div class="dp-exp-cols">${cols}</div>`
    : `<div style="padding:8px;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_available_players','No available players.')}</div>`;
  menu.innerHTML = `<div class="hd"><span>${_dpEsc(g.name)}</span><button onclick="dpClearExGroup()">${tt('daily_planning.clear','Clear')}</button></div>${body}`;
  // Measure after render so a wide multi-column menu is clamped inside the viewport.
  menu.classList.remove('is-tall');
  menu.classList.add('is-open');
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.top  = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - mh - 8)) + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + 'px';
}
function dpToggleExGroupPlayer(pid, on){
  if (!_dpExgTarget) return; const { seid, gid } = _dpExgTarget;
  const e = _dpFindTask(seid); if (!e) return;
  const gs = _dpExGroups(e);
  if (on) gs.forEach(g => { g.players = (g.players||[]).filter(x => String(x)!==String(pid)); });  // one group per player within the exercise
  const g = gs.find(x => x.id === gid); if (!g) return;
  if (on) g.players.push(String(pid)); else g.players = (g.players||[]).filter(x => String(x)!==String(pid));
  e.player_groups = gs; dpRefreshExPlayers(seid); _dpEditSave(seid, { player_groups: gs });
}
function dpClearExGroup(){
  if (!_dpExgTarget) return; const { seid, gid } = _dpExgTarget;
  const e = _dpFindTask(seid); if (!e) return;
  const g = _dpExGroups(e).find(x => x.id === gid); if (!g) return;
  g.players = [];
  document.querySelectorAll('#dpExPlayersMenu input[type=checkbox]').forEach(cb => cb.checked = false);
  dpRefreshExPlayers(seid); _dpEditSave(seid, { player_groups: e.player_groups });
}
// Copy a whole group set from another task into this one (replaces its groups).
function dpOpenCopyGroups(seid, btn){
  const sources = _dpTasksWithGroups(seid);
  const menu = document.getElementById('dpExPlayersMenu');
  const opts = sources.map(x => {
    const ng = _dpExGroups(x).filter(g => (g.players||[]).length).length;
    const nm = x.name || tt('daily_planning.untitled','Untitled');
    return `<div class="dp-exp-opt" onclick="dpCopyGroupsFrom('${seid}','${x.id}')"><i class="ti ti-copy" style="font-size:15px;color:var(--cm-fg-muted)"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${_dpEsc(nm)}</span><span class="num">${tt('daily_planning.n_groups', `${ng} groups`, {count: ng})}</span></div>`;
  }).join('') || `<div style="padding:8px;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_groups_to_copy','No other task has groups.')}</div>`;
  menu.innerHTML = `<div class="hd"><span>${tt('daily_planning.copy_groups_from','Copy groups from')}</span></div>${opts}`;
  const r = btn.getBoundingClientRect();
  menu.style.top  = Math.min(r.bottom + 6, window.innerHeight - 340) + 'px';
  menu.style.left = Math.min(r.left, window.innerWidth - 230) + 'px';
  menu.classList.remove('is-tall');
  menu.classList.add('is-open');
}
function dpCopyGroupsFrom(targetSeid, sourceSeid){
  const t = _dpFindTask(targetSeid), s = _dpFindTask(sourceSeid); if (!t || !s) return;
  const src = _dpExGroups(s).filter(g => (g.players||[]).length);
  t.player_groups = src.map((g, i) => ({ id:'g'+(i+1), name:g.name, color:g.color, players:(g.players||[]).slice() }));
  document.getElementById('dpExPlayersMenu').classList.remove('is-open');
  dpRefreshExPlayers(targetSeid);
  _dpEditSave(targetSeid, { player_groups: t.player_groups });
}
document.addEventListener('click', e => {
  const menu = document.getElementById('dpExPlayersMenu');
  if (menu && menu.classList.contains('is-open') && !menu.contains(e.target) && !e.target.closest('.dp-exp-add')) {
    menu.classList.remove('is-open');
  }
});

async function dpChangeStatus(playerId, newStatus) {
  // Estados globales (lesión/enfermedad/selección/rehab) → team_id NULL; los relativos al
  // equipo (available/partial/unavailable/day_off) llevan el team_id de ESTE equipo (misma
  // semántica que Availability.saveAvailability — antes no se seteaba y quedaban «globales»).
  const _teamId = ['injured','sick','away','rehab'].includes(newStatus) ? null : (_dpTeamId || null);
  const { error } = await window.sb.from('availability').upsert({
    player_id: playerId,
    date:      _dpCurrentDate,
    status:    newStatus,
    club_id:   _dpClubId,
    team_id:   _teamId
  }, { onConflict: 'player_id,date' });
  if (error) { console.error('availability upsert:', error); dpToast(tt('daily_planning.status_save_error','Could not save the status: {msg}',{msg:error.message})); return; }
  if (!_dpAvMap[playerId]) _dpAvMap[playerId] = { player_id: playerId, date: _dpCurrentDate, club_id: _dpClubId };
  _dpAvMap[playerId].status = newStatus;
  _dpAvMap[playerId].team_id = _teamId;
  dpRenderSquad(_dpAvMap);
}

// ── Convocatoria por sesión (session_participants) ──────────────────────────
// Sin filas = sin grupo definido → entrenan todos los disponibles del día. Al primer
// cambio se materializa el grupo con todos los disponibles y recién ahí se aplica el
// toggle, así destildar a uno no "borra" al resto. El popover tiene su propio switch
// de sesión (incluye los partidos, que NO tienen pestaña de planificación): la
// convocatoria del partido se define desde acá sin abrir su "plan".
let _dpGroupTarget = null;   // sesión cuyo grupo se está editando en el popover
let _dpGroupParts  = null;   // Set|null de esa sesión (null = sin grupo definido)
function _dpGroupableSessions(){ return (_dpDaySessions || []).filter(s => (s.session_type || '') !== 'gym'); }
// Invitado de otra categoría: su membresía en ESTE equipo (player_teams filtrado por el
// inner join) no es la primaria → su equipo principal es otro (p. ej. Second team).
function _dpIsGuest(p){ const rows = p.player_teams || []; return rows.length ? rows.every(r => !r.is_primary) : false; }
async function _dpFetchSessParts(sessionId){
  try {
    const { data, error } = await window.sb.from('session_participants').select('player_id').eq('session_id', sessionId);
    if (!error && data && data.length) return new Set(data.map(r => String(r.player_id)));
  } catch (_) {}
  return null;
}
function dpOpenSessGroup(btn){
  const list = _dpGroupableSessions();
  if (!list.length) return;
  _dpGroupTarget = (_dpCurrentSessionId && list.some(s => s.id === _dpCurrentSessionId)) ? _dpCurrentSessionId : list[0].id;
  _dpGroupParts  = (_dpGroupTarget === _dpCurrentSessionId) ? window._dpSessParts : null;
  _dpRenderSessGroupMenu();
  const menu = document.getElementById('dpExPlayersMenu');
  menu.classList.add('is-tall');
  menu.classList.add('is-open');
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.top  = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - mh - 8)) + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + 'px';
  // El grupo de una sesión no activa se trae async; el menú se re-renderiza al llegar.
  if (_dpGroupTarget !== _dpCurrentSessionId) dpSessGroupPick(_dpGroupTarget);
}
function _dpSessLabel(s){
  const time = s.session_time ? String(s.session_time).slice(0,5) : '';
  const name = s.title || ((s.session_type || '') === 'match' ? tt('daily_planning.match','Match') : tt('daily_planning.session','Session'));
  return `${time ? time + ' · ' : ''}${name}`;
}
function _dpRenderSessGroupMenu(){
  const menu = document.getElementById('dpExPlayersMenu');
  const list = _dpGroupableSessions();
  const parts = _dpGroupParts;
  // stopPropagation en pills y "Everyone": el re-render saca el nodo clickeado del DOM antes
  // de que el handler global de cierre corra menu.contains(e.target) → cerraría el popover.
  const pills = list.length >= 2
    ? `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:0 6px 6px">` + list.map(s => {
        const on = s.id === _dpGroupTarget;
        return `<button type="button" onclick="event.stopPropagation();dpSessGroupPick('${_dpEsc(s.id)}')" style="border:1px solid ${on?'var(--cm-accent)':'var(--cm-border)'};background:${on?'var(--cm-accent-soft,rgba(22,163,74,.12))':'var(--cm-bg-soft)'};color:${on?'var(--cm-accent)':'var(--cm-fg-muted)'};border-radius:6px;padding:3px 8px;font:600 11px var(--cm-font-sans);cursor:pointer">${_dpEsc(_dpSessLabel(s))}</button>`;
      }).join('') + `</div>`
    : '';
  const buckets = {};
  _dpGroupCandidates().forEach(p => {
    const g = _DP_POS_GROUP[(p.position||'').toUpperCase()] || { l:(p.position||'?').toUpperCase(), o:9 };
    if (!buckets[g.l]) buckets[g.l] = { o:g.o, list:[] };
    buckets[g.l].list.push(p);
  });
  const guestTag = p => _dpIsGuest(p) ? `<span style="font:600 8px/1 var(--cm-font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--cm-fg-faint);border:1px solid var(--cm-border);border-radius:4px;padding:2px 4px;margin-left:auto">${tt('daily_planning.guest_tag','guest')}</span>` : '';
  // El lesionado se puede tildar: si hizo diferenciado, entra a la convocatoria (y al RPE,
  // aparte). Va marcado para que nadie lo confunda con uno más del grupo.
  const injTag = p => _dpIsDiffWork(p) ? `<span style="font:600 8px/1 var(--cm-font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--cm-danger,#dc2626);border:1px solid var(--cm-danger,#dc2626);border-radius:4px;padding:2px 4px;margin-left:auto">${tt('daily_planning.injured_tag','inj')}</span>` : '';
  // Sin convocatoria armada, el lesionado arranca destildado: no está en la sesión hasta
  // que alguien lo ponga (si arrancara tildado, el primer clic lo haría desaparecer).
  const optRow = p => `<label class="dp-exp-opt"><input type="checkbox" value="${p.id}" ${(parts ? parts.has(String(p.id)) : !_dpIsDiffWork(p))?'checked':''} onchange="dpToggleSessPart('${p.id}',this.checked)"><span class="num">${p.number ?? '—'}</span><span>${_dpPlayerShort(p)}</span>${injTag(p)}${guestTag(p)}</label>`;
  const cols = Object.entries(buckets).sort((a,b)=>a[1].o-b[1].o)
    .map(([lbl,{list:ps}]) => `<div class="dp-exp-col"><div class="dp-exp-col-h">${lbl} · ${ps.length}</div>${ps.map(optRow).join('')}</div>`).join('');
  const body = cols ? `<div class="dp-exp-cols">${cols}</div>`
    : `<div style="padding:8px;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_available_players','No available players.')}</div>`;
  const hint = parts
    ? tt('daily_planning.group_only_selected','Only ticked players are in this session')
    : tt('daily_planning.group_not_set','No group set — everyone available is in');
  menu.innerHTML = `<div class="hd"><span>${tt('daily_planning.session_group','Session group')}</span><button onclick="event.stopPropagation();dpClearSessGroup()">${tt('daily_planning.group_everyone','Everyone')}</button></div>`
    + pills
    + `<div style="padding:2px 10px 6px;color:var(--cm-fg-muted);font:500 11px var(--cm-font-sans)">${hint}</div>${body}`;
}
async function dpSessGroupPick(sessionId){
  _dpGroupTarget = sessionId;
  _dpGroupParts = (sessionId === _dpCurrentSessionId) ? window._dpSessParts : await _dpFetchSessParts(sessionId);
  _dpRenderSessGroupMenu();
}
function _dpSyncActiveGroup(){
  if (_dpGroupTarget === _dpCurrentSessionId) { window._dpSessParts = _dpGroupParts; dpRenderSquad(_dpAvMap); }
}
async function dpToggleSessPart(pid, on){
  if (!_dpGroupTarget) return;
  try {
    let parts = _dpGroupParts;
    if (!parts) {
      parts = new Set(_dpTrainees().map(p => String(p.id)));
      _dpGroupParts = parts;
      const rows = [...parts].map(id => ({ session_id: _dpGroupTarget, player_id: id, club_id: _dpClubId }));
      const { error } = await window.sb.from('session_participants').upsert(rows, { onConflict: 'session_id,player_id' });
      if (error) throw error;
    }
    if (on) {
      parts.add(String(pid));
      const { error } = await window.sb.from('session_participants').upsert({ session_id: _dpGroupTarget, player_id: pid, club_id: _dpClubId }, { onConflict: 'session_id,player_id' });
      if (error) throw error;
    } else {
      parts.delete(String(pid));
      const { error } = await window.sb.from('session_participants').delete().eq('session_id', _dpGroupTarget).eq('player_id', pid);
      if (error) throw error;
    }
    _dpSyncActiveGroup();
  } catch(e){ console.warn('[DP] session group:', e && e.message); }
}
async function dpClearSessGroup(){
  if (!_dpGroupTarget) return;
  try {
    const { error } = await window.sb.from('session_participants').delete().eq('session_id', _dpGroupTarget);
    if (error) throw error;
    _dpGroupParts = null;
    _dpRenderSessGroupMenu();
    _dpSyncActiveGroup();
  } catch(e){ console.warn('[DP] session group clear:', e && e.message); }
}

// ── Objetivos tácticos del día (fuente: Tactical Planning, keyed por club+equipo+fecha) ──
async function dpLoadTactical(dateStr) {
  const card = document.getElementById('dpTacticalCard');
  if (!card) return;
  // Visible para todos los que ven Daily Planning; editable (toggle + link) solo
  // para técnico/PF/dirección/admin — mismo criterio que el modo solo lectura.
  const canEditTac = !window._dpReadOnly;
  try {
    const { data, error } = await window.sb.from('tactical_objectives')
      .select('id,category,title,done')
      .eq('club_id', _dpClubId).eq('team_id', _dpTeamId).eq('date', dateStr)
      .order('position').order('created_at');
    if (error) throw error;
    if (dateStr !== _dpCurrentDate) return;   // el usuario ya cambió de día
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const link = document.getElementById('dpTacticalLink');
    if (link) { link.href = 'Tactical Planning.html?date=' + dateStr; link.style.display = canEditTac ? '' : 'none'; }
    const box = document.getElementById('dpTacticalChips');
    const rows = data || [];
    if (!rows.length) {
      box.innerHTML = '<span style="font:500 12px var(--cm-font-sans);color:var(--cm-fg-muted)" data-i18n="daily_planning.no_tactical">No tactical objectives for this day.</span>';
      if (window.CM_I18N && CM_I18N.applyTo) CM_I18N.applyTo(box);
    } else {
      box.innerHTML = rows.map(o => `<button type="button" class="dp-tacchip${o.done ? ' done' : ''}${canEditTac ? '' : ' is-ro'}" data-id="${esc(o.id)}" title="${esc(o.title)}"><span class="dot" style="background:var(--dpt-${esc(o.category)})"></span><span class="t">${esc(o.title)}</span><i class="ti ti-check"></i></button>`).join('');
      if (canEditTac) box.querySelectorAll('.dp-tacchip').forEach(b => b.addEventListener('click', async () => {
        const row = rows.find(r => r.id === b.getAttribute('data-id')); if (!row) return;
        row.done = !row.done;
        b.classList.toggle('done', row.done);
        const { error: e2 } = await window.sb.from('tactical_objectives').update({ done: row.done, updated_at: new Date().toISOString() }).eq('id', row.id);
        if (e2) { row.done = !row.done; b.classList.toggle('done', row.done); }
      }));
    }
    card.style.display = '';
  } catch (_) { card.style.display = 'none'; }   // tabla aún no aplicada en la DB → ocultar el bloque
}

// ── Match day (MD) ───────────────────────────────────────────────────────────
// Every match date around the day currently on screen, refreshed by loadDay. Kept in a
// variable so the language-change repaint can rebuild the label without another fetch.
let _dpMatchDates = [];

// Options for the per-session MD picker, from the active sport pack. The match-day value
// stays 'MD0' (not 'MD') because that is what this screen has always persisted in
// training_sessions.match_day_offset; cmMdNorm collapses the two on read.
function dpFillMdSelect() {
  const sel = document.getElementById('dpMatchDay');
  if (!sel || !window.cmMdOptions) return;
  const keep = sel.value;
  const anchor = (window.cmMdWindow ? window.cmMdWindow().anchor : 'MD');
  const ph = sel.querySelector('option[value=""]');
  const opts = window.cmMdOptions().map(code => {
    const value = code === anchor ? anchor + '0' : code;
    return `<option value="${value}">${code.replace('-', '\u2212')}</option>`;
  }).join('');
  sel.innerHTML = (ph ? ph.outerHTML : `<option value="">${tt('daily_planning.not_a_match_day','— Not a match day —')}</option>`) + opts;
  if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
}

// Label + i18n for a date, through the shared engine (lib/day-context.js). This screen
// used to diff against mc.match_date with no window at all: on a cup week it disagreed
// with the Calendar, and far from a match it happily printed things like MD−14.
function dpMdLabel(dateStr, mc) {
  if (!window.cmMdForDate) return '';
  const r = window.cmMdForDate(dateStr, _dpMatchDates, { overrides: mc && mc.md_overrides });
  if (!r.label) return '';
  if (r.source === 'override') return ' · ' + r.label;
  if (r.offset === 0)  return ' · ' + tt('daily_planning.md_label', 'MD');
  if (r.offset  <  0)  { const n = Math.abs(r.offset); return ' · ' + tt('daily_planning.md_minus', `MD−${n}`, { n }); }
  return ' · ' + tt('daily_planning.md_plus', `MD+${r.offset}`, { n: r.offset });
}

async function loadDay(dateStr) {
  dpFlushTargets();   // persist any pending gps_targets to the OLD day before switching
  dpFlushEdits();     // persist any pending per-task edits (notes/series/work/rest) to the OLD day
  _dpCurrentDate = dateStr;
  const fmt = _dpFmt(dateStr);
  const today = cmToday();
  const subLabel = dateStr === today ? tt('daily_planning.today', 'today') : '';
  document.getElementById('dpDateInput').value = dateStr;

  // Match microcycle for this date
  const mc = _dpMicrocycles.find(m => m.start_date <= dateStr && dateStr <= m.end_date);
  const mcSel = document.getElementById('dpMicrocycle');
  if (mcSel) {
    mcSel.innerHTML = _dpMicrocycles.length
      ? _dpMicrocycles.map(m => `<option value="${_dpEsc(m.id)}"${m.id === mc?.id ? ' selected' : ''}>${_dpEsc(m.name)}${m.rival ? ` · ${_dpEsc(tt('daily_planning.vs_rival', `vs ${m.rival}`, {rival: m.rival}))}` : ''}</option>`).join('')
      : `<option value="">${tt('daily_planning.no_microcycles', '— No microcycles —')}</option>`;
  }
  const _mdRange = window.cmMdRangeFor(dateStr);
  _dpMatchDates = await window.cmMatchDates(_dpClubId, _dpTeamId, _mdRange.from, _mdRange.to);
  const mcMdLabel = dpMdLabel(dateStr, mc);
  const mcRivalLabel = mc?.rival ? ` · ${tt('daily_planning.vs_rival', `vs ${mc.rival}`, {rival: mc.rival})}` : '';
  const mcLabel = mc ? (mc.name + mcMdLabel + mcRivalLabel) : '';
  document.getElementById('dpCrumbDate').textContent = fmt + (mcMdLabel || '');
  document.getElementById('dpPagerLabel').innerHTML = `<i class="ti ti-calendar-event"></i>${_dpEsc(fmt)}${mcLabel ? `<span class="sub">${_dpEsc(mcLabel)}</span>` : subLabel ? `<span class="sub">${_dpEsc(subLabel)}</span>` : ''}`;

  const [avResult, adaptResult, sessResult] = await Promise.all([
    window.sb.from('availability').select('player_id,status,notes,team_id').eq('club_id', _dpClubId).eq('date', dateStr),
    window.sb.from('treatments').select('id,player_id,team_id,date,adaptation_date,type,treatment_type,modalities,notes,adaptation_notes,adaptation_sent_at,adaptation_applied_at,adaptation_applied_by,notify_coaches,players(first_name,last_name,number,position)').eq('club_id', _dpClubId).or(`adaptation_date.eq.${dateStr},and(adaptation_date.is.null,date.eq.${dateStr})`),
    window.sb.from('training_sessions').select('id,title,session_time,end_time,duration,session_type,notes,published,estimated_rpe,orientation,focus,match_day_offset,microcycle_id,gps_targets,gym_content,updated_at,coach_id,club_id,session_date').eq('club_id', _dpClubId).eq('team_id', _dpTeamId).eq('session_date', dateStr).eq('is_historical', false).order('session_time', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true })
  ]);
  if (sessResult.error) console.warn('Session query error:', sessResult.error.message);
  _dpDaySessions = sessResult.data || [];
  const _dpIsGym = s => !!s && (s.session_type || '') === 'gym';
  // A gym session has its own planner — never open it here in the field-planning layout.
  // (Reached via a ?session=<gymId> link; the switcher redirects before we get here.)
  let _reqSess = _dpDaySessions.find(s => s.id === _dpPreferredSessionId) || null;
  if (_dpIsGym(_reqSess)) { window.location.replace(`Gym Planner.html?date=${dateStr}`); return; }
  // Un ?session= que apunta a un partido (URLs guardadas de cuando el partido era pestaña)
  // se ignora: el partido no tiene hoja de plan — se abre la sesión de campo del día.
  if (_reqSess && (_reqSess.session_type || '') === 'match') {
    _reqSess = null; _dpPreferredSessionId = null;
    try { const u = new URL(window.location.href); u.searchParams.delete('session'); history.replaceState(null, '', u); } catch (_) {}
  }
  // Default to the day's first FIELD (non-gym, non-match) training session; honour an explicit
  // request (?session= / switcher). A gym/match-only day starts empty, ready to create one —
  // a match is a load unit (RPE/GPS), never a plan sheet to open by default.
  const sess = _reqSess || _dpDaySessions.find(s => !_dpIsGym(s) && (s.session_type || '') !== 'match') || null;
  _dpPreferredSessionId = sess?.id || null;
  _dpCurrentSessionId = sess?.id || null;
  _dpRenderSessionSwitch();   // after _dpCurrentSessionId, which marks the active tab
  // Foto de lo que hay en la base: contra esto se compara para mandar SOLO lo
  // que cambió, y `updated_at` es el testigo de que nadie la tocó mientras
  // tanto. Ver assets/cm-save.js.
  _dpSaved = sess ? dpRowToPayload(sess) : null;
  _dpSince = sess?.updated_at || null;
  _dpPublished = sess?.published || false;
  _dpGpsTargets = (sess && sess.gps_targets && typeof sess.gps_targets === 'object') ? sess.gps_targets : {};
  const titleInput = document.getElementById('dpSessionTitle');
  if (sess) {
    if (titleInput) titleInput.value = sess.title || '';
    const st = document.getElementById('dpStartTime'); if (st) st.value = sess.session_time || '';
    const et = document.getElementById('dpEndTime'); if (et) et.value = sess.end_time || '';
    const sn = document.getElementById('dpNotes'); if (sn) sn.value = sess.notes || '';
    const sr = document.getElementById('dpEstRpe'); if (sr) sr.value = sess.estimated_rpe || '';
    const so = document.getElementById('dpOrientation'); if (so) so.value = sess.orientation || '';
    const sf = document.getElementById('dpFocus'); if (sf) sf.value = sess.focus || '';
    const sm = document.getElementById('dpMatchDay'); if (sm) sm.value = sess.match_day_offset || '';
    const mcSel2 = document.getElementById('dpMicrocycle'); if (mcSel2 && sess.microcycle_id) mcSel2.value = sess.microcycle_id;
  } else {
    if (titleInput) titleInput.value = '';
    const st = document.getElementById('dpStartTime'); if (st) st.value = '';
    const et = document.getElementById('dpEndTime'); if (et) et.value = '';
    const sn = document.getElementById('dpNotes'); if (sn) sn.value = '';
    const sr = document.getElementById('dpEstRpe'); if (sr) sr.value = '';
    const so = document.getElementById('dpOrientation'); if (so) so.value = '';
    const sf = document.getElementById('dpFocus'); if (sf) sf.value = '';
    const sm = document.getElementById('dpMatchDay'); if (sm) sm.value = '';
  }

  // Calendar overlays: microcycle / match-day / RPE only. Start time comes from the
  // session itself (see note below) — never from an ancillary calendar_events row.
  try {
    const ctx = await window.cmResolveDayContext(dateStr, _dpTeamId, _dpClubId);
    _dpDayOff = !!ctx.dayOff;
    _dpDayOffIds = new Set((ctx.dayOffPlayerIds || []).map(String));
    _dpCalFields = new Set();
    const mdMap = m => { const n = window.cmMdNorm ? window.cmMdNorm(m) : (m || '').replace('−','-'); return n === 'MD' ? 'MD0' : n; };   // resolver label → option value
    const mcSelN = document.getElementById('dpMicrocycle');
    if (ctx.microcycle && mcSelN && [...mcSelN.options].some(o => o.value === String(ctx.microcycle.id))) { mcSelN.value = String(ctx.microcycle.id); _dpCalFields.add('dpMicrocycle'); }
    // MD: SOLO relleno cuando la sesión no tiene match_day_offset propio. El MD guardado por
    // sesión manda (dos dinámicas el mismo día: grupo en MD+1 y grupo en MD-2); si el microciclo
    // lo pisara acá, el autosave re-persistiría el valor derivado y mataría el MD del grupo.
    dpFillMdSelect();
    const mdSel = document.getElementById('dpMatchDay');
    const mdVal = ctx.md ? mdMap(ctx.md) : '';
    if (mdVal && mdSel && !(sess && sess.match_day_offset) && [...mdSel.options].some(o => o.value === mdVal)) { mdSel.value = mdVal; _dpCalFields.add('dpMatchDay'); }
    // NOTE: start time is NOT overlaid from calendar_events. The training block on
    // the Calendar IS this training_sessions row (source='session'), so session_time
    // is the single source of truth for both — overlaying an unrelated ancillary
    // event's time (a meal/recovery/medical row) would wrongly clobber it.
    if (ctx.hasEvent) {
      const sr = document.getElementById('dpEstRpe');   if (ctx.estimated_rpe && sr) { sr.value = ctx.estimated_rpe; _dpCalFields.add('dpEstRpe'); }
    }
    dpMarkCalFields();
  } catch(_) {}

  _dpUpdatePublishBtn();
  dpLoadTactical(dateStr);   // no bloquea la carga del día

  await Promise.all([loadSessionExercises(_dpCurrentSessionId), loadActivationActivities(_dpCurrentSessionId), loadGoalkeeperActivities(_dpCurrentSessionId)]);

  const avMap = {};
  // Estados relativos al equipo (available/partial/etc) guardados para OTRO equipo → ese día el
  // jugador está con otra categoría: acá se muestra como 'other_team' (fuera de esta sesión).
  // Los estados globales (lesión/enfermedad/selección, team_id NULL) valen igual acá.
  const _DP_TEAM_REL = new Set(['available','partial','limited','unavailable','absent','day_off']);
  (avResult.data || []).forEach(a => {
    if (_DP_TEAM_REL.has(a.status) && a.team_id && _dpTeamId && a.team_id !== _dpTeamId) {
      avMap[a.player_id] = { ...a, status: 'other_team' };
    } else {
      avMap[a.player_id] = a;
    }
  });
  // El evento Day off del Calendar MANDA: si el jugador está en su lista de libres, ese día
  // se muestra como day off aunque su fila de availability haya quedado vieja (p. ej. un
  // 'injured' guardado antes de que el sync del evento lo pisara).
  _dpDayOffIds.forEach(pid => {
    avMap[pid] = { ...(avMap[pid] || { player_id: pid, date: dateStr, club_id: _dpClubId }), status: 'day_off', team_id: _dpTeamId || null };
  });
  _dpAvMap = avMap;

  // Tratamientos del día (fisio): un lesionado con tratamiento registrado hoy cuenta como
  // «en rehab» aunque no tenga plan creado en el Rehab Planner.
  window._dpDayTreatIds = new Set((adaptResult.data || []).map(t => String(t.player_id)));

  // Team scope: show adaptations for THIS team only (legacy rows have no team_id → keep showing).
  const _dpAdaptRows = (adaptResult.data || []).filter(t => t.team_id == null || t.team_id === _dpTeamId);

  _dpDayAdaptMap = {};
  _dpAdaptRows.forEach(t => {
    if (t.adaptation_notes && !_dpDayAdaptMap[t.player_id]) _dpDayAdaptMap[t.player_id] = t;
  });

  // Convocatoria de ESTA sesión (session_participants). Sin filas (o tabla aún no aplicada
  // en la DB) → sin grupo definido: entrenan todos los disponibles del día.
  window._dpSessParts = null;
  if (_dpCurrentSessionId) {
    try {
      const { data: spData, error: spErr } = await window.sb.from('session_participants')
        .select('player_id').eq('session_id', _dpCurrentSessionId);
      if (!spErr && spData && spData.length) window._dpSessParts = new Set(spData.map(r => String(r.player_id)));
    } catch (_) {}
  }
  const gb = document.getElementById('dpGroupBtn');
  if (gb) {
    // Siempre disponible con una sesión activa (antes pedía ≥2 sesiones de campo y en
    // días de sesión única desaparecía): sin grupo definido entrenan todos, pero el
    // staff puede acotarlo cuando quiera.
    gb.style.display = (!window._dpReadOnly && _dpCurrentSessionId && _dpGroupableSessions().length) ? '' : 'none';
  }

  dpRenderSquad(avMap);

  _dpPhysioRows = _dpAdaptRows.filter(t => t.adaptation_notes);
  dpRenderPhysioList();

  await dpRenderPrintSheet();

  // El candado es por día: al cambiar de fecha se suelta el anterior y se pide
  // el nuevo. Y si quedamos en modo lectura, se re-aplica: loadDay repintó los
  // campos y volvieron a quedar habilitados.
  if (_dpLock) _dpLock.setResource(`dp:${_dpTeamId}:${dateStr}`);
  if (window._dpReadOnly) dpApplyReadOnly();
}

// Physio adaptation alerts — visual state derives ONLY from adaptation_applied_at so a
// reload reflects what is persisted (never a local opacity flip).
let _dpPhysioRows = [];
function dpRenderPhysioList() {
  const rows = _dpPhysioRows || [];
  const physioCard = document.querySelector('.dp-physio-card');
  if (physioCard) physioCard.classList.toggle('is-empty', rows.length === 0);
  const ctEl = document.getElementById('dpPhysioCt');
  const listEl = document.getElementById('dpPhysioList');
  if (!rows.length) {
    if (ctEl) ctEl.textContent = '0';
    if (listEl) listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_physio_adaptations','No physio adaptations for this session.')}</div>`;
    window._dpAdaptPids = new Set();
    return;
  }
  if (ctEl) ctEl.textContent = rows.length;
  if (listEl) listEl.innerHTML = rows.map(t => {
    const pl = t.players || {};
    const av2 = (`${pl.first_name||''} ${pl.last_name||''}`.trim()).split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase() || '?';
    const adaptText = t.adaptation_notes || '';
    const ttype = t.treatment_type || 'rehab';
    const ttDot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${ttype==='preventive'?'#16A34A':'#DC2626'};margin-right:4px;vertical-align:middle;flex-shrink:0"></span>`;
    const mods = Array.isArray(t.modalities) ? t.modalities : (t.type ? (Array.isArray(t.type) ? t.type : [t.type]) : []);
    const applied = !!t.adaptation_applied_at;
    const name = ((pl.first_name||'')+' '+(pl.last_name||'')).trim() || tt('daily_planning.unknown','Unknown');
    let actHtml;
    if (applied) {
      const dateStr = new Date(t.adaptation_applied_at).toLocaleDateString(ttLocale(), { day:'2-digit', month:'short' });
      actHtml = `<div class="act"><span class="dp-adapt-applied">✓ ${tt('daily_planning.applied_on','Applied · {date}',{date:dateStr})}</span>`
        + `<button class="dp-adapt-undo" data-treatment-id="${t.id}">${tt('daily_planning.undo','Undo')}</button></div>`;
    } else {
      actHtml = `<div class="act"><button class="dp-adapt-apply" data-treatment-id="${t.id}">${tt('daily_planning.applied','✓ Applied')}</button></div>`;
    }
    return `<div class="dp-physio-alert${applied ? ' is-applied' : ''}">
        <div class="av">${_dpEsc(av2)}</div>
        <div class="body">
          <div class="name">${ttDot}${_dpEsc(name)} · #${pl.number??'—'} · ${_dpEsc(pl.position||'')}</div>
          <div class="note">${_dpEsc(adaptText)}</div>
          ${mods.length ? `<div class="zones">${mods.map(m=>`<span class="z">${_dpEsc(m)}</span>`).join('')}</div>` : ''}
        </div>
        ${actHtml}
      </div>`;
  }).join('');
  // Squad badge overlay: amber stays on while an adaptation exists but is not yet applied.
  window._dpAdaptPids = new Set(rows.filter(t => !t.adaptation_applied_at).map(t => t.player_id));
}

// Persist the Applied/Undo decision via the reversible RPC; on success the row's
// adaptation_applied_at is updated in memory and the card re-renders from that state.
async function dpToggleAdapt(id) {
  const { data, error } = await window.sb.rpc('toggle_adaptation_applied', { p_treatment_id: id });
  if (error) { dpToast(tt('daily_planning.adapt_toggle_error','Could not update. Try again.')); return; }
  const newApplied = (data && typeof data === 'object')
    ? (Array.isArray(data) ? (data[0]?.adaptation_applied_at ?? data[0] ?? null) : (data.adaptation_applied_at ?? null))
    : (data ?? null);
  const row = _dpPhysioRows.find(t => String(t.id) === String(id));
  if (row) row.adaptation_applied_at = newApplied;
  const mapRow = Object.values(_dpDayAdaptMap).find(t => String(t.id) === String(id));
  if (mapRow) mapRow.adaptation_applied_at = newApplied;
  dpRenderPhysioList();
  dpToast(newApplied ? tt('daily_planning.applied','✓ Applied') : tt('daily_planning.undo','Undo'));
}
document.getElementById('dpPhysioList')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-treatment-id]');
  if (btn) dpToggleAdapt(btn.dataset.treatmentId);
});

function dpMarkCalFields() {
  ['dpMicrocycle','dpMatchDay','dpStartTime','dpEstRpe'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.toggle('is-cal-sourced', _dpCalFields.has(id));
    if (_dpCalFields.has(id) && !el.dataset.calWarn) {
      el.dataset.calWarn = '1';
      el.addEventListener('change', () => {
        if (!_dpCalFields.has(id)) return;
        // El MD ahora es por sesión (dos dinámicas/día): cambiarlo acá es legítimo y persiste.
        // Se des-marca como cal-sourced en vez de avisar "cambialo en Calendar".
        if (id === 'dpMatchDay') { _dpCalFields.delete(id); el.classList.remove('is-cal-sourced'); return; }
        dpToast(tt('daily_planning.cal_synced_warn','This value comes from the Calendar — change it there to keep things in sync.'));
      });
    }
  });
}
function dpToast(msg) {
  let t = document.getElementById('dpToast');
  if (!t) { t = document.createElement('div'); t.id = 'dpToast';
    t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1200;background:#15181D;color:#fff;font:500 13px/1.4 var(--cm-font-sans);padding:10px 16px;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;max-width:80vw;text-align:center';
    document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._timer); t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3200);
}
window.addEventListener('beforeprint', dpRenderPrintSheet);
// Persist any pending edits/targets if the tab is closed or reloaded before the debounce fires.
window.addEventListener('beforeunload', () => { dpFlushEdits(); dpFlushTargets(); });
// Flush as soon as a task input/textarea loses focus (belt-and-suspenders over the debounce).
['dpExGrid','dpActStrip'].forEach(id => document.getElementById(id)?.addEventListener('focusout', dpFlushEdits));

// ── Session exercises ──
const CAT_CLS = { physical:'fis', tactical:'tac', technical:'tec', strength:'str', mobility:'mob', other:'oth' };
const CAT_LABEL_EN = { physical:'Physical', tactical:'Tactical', technical:'Technical', strength:'Strength', mobility:'Mobility', other:'Other' };
const CAT_LABEL_KEY = { physical:'daily_planning.physical', tactical:'daily_planning.tactical', technical:'daily_planning.technical_focus', strength:'daily_planning.strength', mobility:'daily_planning.mobility', other:'daily_planning.other' };
function dpCatLabel(cat){ return tt(CAT_LABEL_KEY[cat] || 'daily_planning.other', CAT_LABEL_EN[cat] || 'Other'); }

async function loadSessionExercises(sessionId) {
  const grid = document.getElementById('dpExGrid');
  if (!sessionId) {
    grid.innerHTML = _dpDayOff
      ? `<div style="padding:32px 20px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">
      <i class="ti ti-bed" style="font-size:24px;display:block;margin-bottom:8px;color:var(--cm-fg-faint)"></i>
      ${tt('daily_planning.rest_day','Rest day — no training planned.')}
      <div style="margin-top:12px"><button class="cm-btn is-ghost is-sm no-print" onclick="dpRemoveDayOff()"><i class="ti ti-x" style="font-size:13px"></i>${tt('daily_planning.remove_day_off','Remove day off')}</button></div>
    </div>`
      : `<div style="padding:32px 20px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">
      <i class="ti ti-calendar-off" style="font-size:24px;display:block;margin-bottom:8px;color:var(--cm-fg-faint)"></i>
      ${tt('daily_planning.no_session_for_date','No session for this date.')}
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="cm-btn is-primary is-sm" onclick="dpCreateSession()"><i class="ti ti-plus" style="font-size:13px"></i>${tt('daily_planning.create_session_for_date','Create training session for this date')}</button>${_dpDaySessions.length ? '' : `<button class="cm-btn is-ghost is-sm no-print" onclick="dpMarkDayOff()"><i class="ti ti-bed" style="font-size:13px"></i>${tt('daily_planning.mark_day_off','Mark as day off')}</button>`}</div>
    </div>`;
    const _strEl = document.getElementById('dpExStrength');
    if (_strEl) _strEl.innerHTML = '';
    _dpFieldExercises = [];
    recalcTotals();
    return;
  }
  const { data } = await window.sb.from('session_exercises')
    .select('id,name,phase,duration,series,work_time,rest_time,dose_mode,reps,dosing_overrides,position,player_groups,intensity,notes,exercise_id,planner_exercise_id,field_width,field_height,players_count,m2_per_player,calc_orientation,gym_exercises(name,category,description,media_type,media_ref,video_id)')
    .eq('club_id', _dpClubId).eq('session_id', sessionId).eq('phase','main')
    .order('position');
  _dpFieldExercises = data || [];
  dpResolveGymImgs(_dpFieldExercises, sessionId, () => renderExerciseList(_dpFieldExercises));   // fill strength photos, then repaint
  // instant paint using whatever previews are already cached (others fall back to the generic pitch)
  _dpFieldExercises.forEach(e => {
    e._previewPng = (e.planner_exercise_id && (e.planner_exercise_id in _dpPngCache)) ? _dpPngCache[e.planner_exercise_id] : null;
  });
  renderExerciseList(_dpFieldExercises);

  // Re-sync each card's definition from its live Planner exercise (source of truth) so an
  // exercise edited later in the Drill Designer doesn't stay stale here. Runs in the
  // background; does NOT await. (Session-specific dosing/notes are left untouched.)
  dpSyncPlannerFields(_dpFieldExercises, sessionId);

  // fetch ONLY the uncached previews in the background (do NOT await — keeps day load fast)
  const _reqSession = sessionId;
  const need = [...new Set(_dpFieldExercises.map(e => e.planner_exercise_id).filter(id => id && !(id in _dpPngCache)))];
  if (need.length) {
    dpResolvePreviews(need).then(() => {
      if (_dpCurrentSessionId !== _reqSession) return;   // user navigated away — don't paint stale
      _dpFieldExercises.forEach(e => { if (e.planner_exercise_id in _dpPngCache) e._previewPng = _dpPngCache[e.planner_exercise_id]; });
      renderExerciseList(_dpFieldExercises);             // second paint: inject the diagrams
    });
  }
  recalcTotals();
}

// Planner exercises own their definition. session_exercises snapshots name/players/field/area AND
// dosing at insert time, so an exercise edited afterwards in the Drill Designer would render stale.
// Refresh from the live exercise: display/identity fields always, plus dosing (series/duration/
// work·rest/reps/mode) — but a dosing field the coach tuned on THIS day's card wins (that's what was
// planned for the day), tracked in session_exercises.dosing_overrides. Never touch notes or groups.
// Then repaint and persist so print/PDF/GPS stay in sync.
const DP_DOSE_SYNC = ['series','duration','work_time','rest_time','reps'];   // per-card editable → honour override
async function dpSyncPlannerFields(list, reqSession) {
  const ids = [...new Set((list || []).map(e => e.planner_exercise_id).filter(Boolean))];
  if (!ids.length) return;
  const { data: rows } = await window.sb.from('exercises')
    .select('id,name,field_width,field_height,players_count,orientation,dose_mode,series,duration,work_time,rest_time,reps')
    .eq('club_id', _dpClubId).in('id', ids);
  if (!rows || _dpCurrentSessionId !== reqSession) return;   // navigated away — don't clobber
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  const updates = [];
  list.forEach(e => {
    const src = byId[e.planner_exercise_id]; if (!src) return;   // exercise deleted → keep snapshot
    const area = (src.field_width && src.field_height) ? src.field_width * src.field_height : null;
    const m2   = (area && src.players_count > 0) ? Math.round(area / src.players_count) : null;
    const next = {
      name:             src.name ?? null,
      field_width:      src.field_width ?? null,
      field_height:     src.field_height ?? null,
      players_count:    src.players_count ?? null,
      m2_per_player:    m2,
      calc_orientation: _dpCalcOrientFromM2(m2) || src.orientation || null,
      dose_mode:        src.dose_mode ?? null,   // no per-card control → always follows the drill
    };
    const ov = new Set(Array.isArray(e.dosing_overrides) ? e.dosing_overrides : []);
    DP_DOSE_SYNC.forEach(f => { if (!ov.has(f)) next[f] = src[f] ?? null; });   // day-level override wins
    if (!Object.keys(next).some(k => (e[k] ?? null) !== (next[k] ?? null))) return;   // unchanged
    Object.assign(e, next);
    updates.push({ id: e.id, patch: next });
  });
  if (!updates.length) return;
  renderExerciseList(list);   // repaint with the fresh definition
  recalcTotals();
  await Promise.all(updates.map(u =>
    window.sb.from('session_exercises').update(u.patch).eq('id', u.id).eq('club_id', _dpClubId)));
}

function renderExerciseList(exercises) {
  const grid  = document.getElementById('dpExGrid');
  const strEl = document.getElementById('dpExStrength');
  const ct    = document.getElementById('dpExCt');
  const { field, strength } = dpSplitByKind(exercises);
  const fieldAdd = `<button class="dp-ex-add no-print" onclick="openLibModal()"><i class="ti ti-plus" style="font-size:14px"></i>${tt('daily_planning.add_exercise','Add exercise')}</button>`;
  grid.innerHTML = field.map(dpExerciseCardHTML).join('') + fieldAdd;
  if (strEl) strEl.innerHTML = dpStrengthSectionHTML(strength, 'main', false);   // no add button in Field — strength is added from Activation only
  if (ct) {
    const totalMin = Math.round(exercises.reduce((s, e) => s + dpBlockMins(e).total_min, 0));
    ct.textContent = exercises.length ? `${exercises.length} · ${tt('daily_planning.min_count', `${totalMin} min`, {count: totalMin})}` : '0';
  }
  dpInitReorder();
  dpPaintGpsBadges();
}

// Next position = end of the list (max existing position + 1) so new cards always
// append to the right, never land mid-list when positions aren't contiguous.
function dpNextPosition(phase){
  const list = phase === 'activation' ? (window._dpActItems || [])
             : phase === 'goalkeepers' ? (window._dpGkItems || [])
             : _dpFieldExercises;
  const ps = list.map((x, i) => (x.position != null ? x.position : i));
  return (ps.length ? Math.max(...ps) : -1) + 1;
}

// ── Drag-and-drop reorder of exercise cards (field grid + activation strip) ──
let _dpDragSeid = null;
function dpInitReorder(){
  dpWireReorder(document.getElementById('dpExGrid'),  'field');
  dpWireReorder(document.getElementById('dpActStrip'), 'activation');
  dpWireReorder(document.getElementById('dpGkStrip'), 'goalkeepers');
}
function dpWireReorder(grid, kind){
  if (!grid || grid._reorderWired) return;   // delegation survives innerHTML repaints
  grid._reorderWired = true;
  const clearMarks = () => grid.querySelectorAll('.dp-drop-before,.dp-drop-after')
    .forEach(el => el.classList.remove('dp-drop-before','dp-drop-after'));
  const dropAfter = (card, e) => { const r = card.getBoundingClientRect(); return (e.clientX - r.left) > r.width/2; };
  grid.addEventListener('dragstart', e => {
    const card = e.target.closest('.dp-ex'); if (!card) return;
    // Never hijack text editing / control interaction inside a card.
    if (e.target.closest('input,textarea,select,button,a')) { e.preventDefault(); return; }
    _dpDragSeid = card.dataset.seid;
    card.classList.add('dp-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', _dpDragSeid); } catch(_){}
  });
  grid.addEventListener('dragend', () => {
    grid.querySelectorAll('.dp-dragging').forEach(el => el.classList.remove('dp-dragging'));
    clearMarks(); _dpDragSeid = null;
  });
  grid.addEventListener('dragover', e => {
    if (!_dpDragSeid) return;
    const card = e.target.closest('.dp-ex'); if (!card || card.dataset.seid === _dpDragSeid) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    clearMarks();
    card.classList.add(dropAfter(card, e) ? 'dp-drop-after' : 'dp-drop-before');
  });
  grid.addEventListener('drop', e => {
    if (!_dpDragSeid) return;
    const card = e.target.closest('.dp-ex'); if (!card || card.dataset.seid === _dpDragSeid) return;
    e.preventDefault();
    const seid = _dpDragSeid, after = dropAfter(card, e);
    clearMarks(); _dpDragSeid = null;
    dpReorderExercise(seid, card.dataset.seid, after, kind);
  });
}
// Repaint the activation area from window._dpActItems: field cards on the pitch grid, strength cards in their own sub-section.
function dpPaintActStrip(){
  const strip = document.getElementById('dpActStrip'); if (!strip) return;
  const { field, strength } = dpSplitByKind(window._dpActItems || []);
  const addBtn = `<button class="dp-ex-add no-print" onclick="openLibModal('activation')"><i class="ti ti-plus" style="font-size:14px"></i>${tt('daily_planning.activity','Activity')}</button>`;
  strip.innerHTML = field.map(dpExerciseCardHTML).join('') + addBtn;
  const strEl = document.getElementById('dpActStrength');
  if (strEl) strEl.innerHTML = dpStrengthSectionHTML(strength, 'activation');
  dpPaintGpsBadges();
}
// Repaint the goalkeeper strip from window._dpGkItems (mirrors loadGoalkeeperActivities).
function dpPaintGkStrip(){
  const strip = document.getElementById('dpGkStrip'); if (!strip) return;
  const gks = window._dpGkItems || [];
  const addBtn = `<button class="dp-ex-add no-print" onclick="openLibModal('goalkeepers')"><i class="ti ti-plus" style="font-size:14px"></i>${tt('daily_planning.activity','Activity')}</button>`;
  strip.innerHTML = gks.map(dpExerciseCardHTML).join('') + addBtn;
  dpPaintGpsBadges();
}
// Load the FULL profile row for these exercises into the shared cache. Always select('*'):
// badges only need n_instances, but the projection reads the *_per_min columns off the same
// cached object — a partial row would poison it and project zeros. In-flight promises are
// deduped so badges + projection racing on boot fire one query, not two.
async function dpEnsureGpsProfiles(ids){
  const need = [...new Set(ids.filter(id => id && !(id in _dpGpsProfiles) && !_dpGpsProfIn[id]))];
  if (need.length) {
    const p = window.sb.from('v_exercise_gps_profile').select('*').in('exercise_id', need).then(({ data, error }) => {
      if (error) { console.warn('[dp-gps-profile] fetch failed:', error.message); need.forEach(id => { delete _dpGpsProfIn[id]; }); return; }   // don't cache a failure as "no profile"
      const found = {}; (data||[]).forEach(r => { found[r.exercise_id] = r; });
      need.forEach(id => { _dpGpsProfiles[id] = found[id] || null; delete _dpGpsProfIn[id]; });   // null = fetched, no profile
    });
    need.forEach(id => { _dpGpsProfIn[id] = p; });
  }
  const waits = [...new Set(ids.map(id => _dpGpsProfIn[id]).filter(Boolean))];
  if (waits.length) await Promise.all(waits);
}
// Green tick on field cards whose exercise has associated GPS data (v_exercise_gps_profile).
// DOM-patched (not baked into the card HTML) so it survives async profile loading without
// re-rendering cards mid-drag. Helps the coach see which blocks feed the GPS projection.
async function dpPaintGpsBadges(){
  const blocks = [...(_dpFieldExercises||[]), ...((window._dpActItems)||[]), ...((window._dpGkItems)||[])];
  const bySeid = new Map();
  blocks.forEach(e => { if (e.planner_exercise_id) bySeid.set(String(e.id), e.planner_exercise_id); });
  await dpEnsureGpsProfiles([...bySeid.values()]);
  document.querySelectorAll('.dp-ex[data-seid]').forEach(card => {
    const pid  = bySeid.get(card.dataset.seid);
    const prof = pid ? _dpGpsProfiles[pid] : null;
    let badge = card.querySelector('.dp-ex-gps');
    if (prof) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dp-ex-gps';
        badge.innerHTML = '<i class="ti ti-check"></i>';
        (card.querySelector('.dp-ex-thumb') || card).appendChild(badge);
      }
      const n = prof.n_instances || 0;
      badge.title = tt('daily_planning.has_gps', `Has GPS data · ${n} sessions`, { count: n });
    } else if (badge) {
      badge.remove();
    }
  });
}
async function dpReorderExercise(dragSeid, targetSeid, after, kind){
  const arr = kind === 'activation' ? (window._dpActItems || [])
            : kind === 'goalkeepers' ? (window._dpGkItems || [])
            : _dpFieldExercises;
  const from = arr.findIndex(x => x.id === dragSeid);
  if (from < 0) return;
  const [moved] = arr.splice(from, 1);
  let to = arr.findIndex(x => x.id === targetSeid);
  if (to < 0) { arr.splice(from, 0, moved); return; }   // target vanished — undo
  arr.splice(after ? to + 1 : to, 0, moved);
  arr.forEach((x, i) => { x.position = i; });
  if (kind === 'activation') dpPaintActStrip(); else if (kind === 'goalkeepers') dpPaintGkStrip(); else renderExerciseList(arr);   // optimistic repaint
  // Persist every row's position (list is small); log but don't block on errors.
  const results = await Promise.all(arr.map(x =>
    window.sb.from('session_exercises').update({ position: x.position }).eq('id', x.id).eq('club_id', _dpClubId)));
  const failed = results.find(r => r.error);
  if (failed) { console.warn('[dp-reorder] save failed:', failed.error.message); dpToast(tt('daily_planning.reorder_failed','Could not save the new order.')); }
}

// Thumbnail source for a strength (gym) card: signed photo if cached, else YouTube frame, else none.
function dpGymImg(e) {
  const gx = e.gym_exercises; if (!gx) return null;
  if (gx.media_type === 'image' && gx.media_ref) return _dpGymImgCache[gx.media_ref] || null;
  if (gx.video_id) return `https://img.youtube.com/vi/${gx.video_id}/mqdefault.jpg`;
  return null;
}
// Resolve signed URLs for any strength cards whose photos aren't cached yet, then repaint.
async function dpResolveGymImgs(list, reqSession, repaint) {
  const need = [...new Set((list || [])
    .map(e => e.gym_exercises)
    .filter(g => g && g.media_type === 'image' && g.media_ref && !(g.media_ref in _dpGymImgCache))
    .map(g => g.media_ref))];
  if (!need.length) return;
  const { data: urls } = await window.sb.storage.from('gym-exercise-media').createSignedUrls(need, 3600);
  (urls || []).forEach(u => { if (u && u.path) _dpGymImgCache[u.path] = u.signedUrl; });
  if (reqSession != null && _dpCurrentSessionId !== reqSession) return;
  if (repaint) repaint();
}

// Strength (gym) items live in their own sub-section; everything else (planner / manual) stays on the pitch grid.
function dpSplitByKind(items) {
  const field = [], strength = [];
  (items || []).forEach(e => (e.exercise_id ? strength : field).push(e));
  return { field, strength };
}
// A strength card: compact square tile — photo/video thumb (or neutral barbell tile), name + series×reps below. Never a pitch.
function dpStrengthCardHTML(e) {
  const gx  = e.gym_exercises || null;
  const nm  = gx?.name || e.name || '—';
  const cat = (gx?.category || 'strength').toLowerCase();
  const cls = CAT_CLS[cat] || 'oth';
  const lbl = dpCatLabel(cat);
  const desc = (gx?.description || '').replace(/"/g, '&quot;');
  const img  = dpGymImg(e);
  const isVideo = !!(gx && gx.video_id && !(gx.media_type === 'image' && gx.media_ref));
  const isTime = !!e.work_time || e.dose_mode === 'interval' || e.dose_mode === 'minutes';
  const thumb = img
    ? `<img src="${_dpEsc(img)}" alt="">${isVideo ? '<span class="dp-str-play"><i class="ti ti-player-play-filled"></i></span>' : ''}`
    : `<i class="ti ti-barbell" style="font-size:30px;color:var(--cm-fg-faint)"></i>`;
  const valueInput = isTime
    ? `<input type="text" class="t" value="${_dpEsc(e.work_time ?? '')}" placeholder="0:30" oninput="dpEditWork('${e.id}',this.value)" title="${tt('daily_planning.work_time_mmss','Work time (mm:ss)')}">`
    : `<input type="number" min="1" value="${e.reps ?? ''}" placeholder="10" oninput="dpEditReps('${e.id}',this.value)" title="${tt('daily_planning.reps','Reps')}">`;
  return `<div class="dp-str" data-seid="${e.id}" title="${desc || nm.replace(/"/g,'&quot;')}">
    <div class="dp-str-thumb">
      <span class="dp-ex-tag ${cls}" style="top:6px;left:6px">${lbl}</span>
      ${thumb}
      <button class="dp-str-del no-print" onclick="deleteExercise('${e.id}')" title="${tt('daily_planning.remove','Remove')}"><i class="ti ti-x"></i></button>
    </div>
    <div class="dp-str-b">
      <div class="dp-str-name">${nm}</div>
      <div class="dp-str-dose no-print">
        <input type="number" min="1" value="${e.series ?? ''}" oninput="dpEditSeries('${e.id}',this.value)" title="${tt('daily_planning.series','Series')}">
        <span>×</span>
        ${valueInput}
        <select onchange="dpStrSetUnit('${e.id}',this.value)" title="${tt('daily_planning.reps_or_time','Reps or time')}">
          <option value="reps" ${!isTime ? 'selected' : ''}>${tt('daily_planning.reps_short','reps')}</option>
          <option value="time" ${isTime ? 'selected' : ''}>${tt('daily_planning.time_unit','time')}</option>
        </select>
      </div>
    </div>
  </div>`;
}
// Toggle a strength tile between reps (series × reps) and time (series × work_time). Series always stays.
async function dpStrSetUnit(seid, unit) {
  const e = _dpFindTask(seid); if (!e) return;
  if (unit === 'time') {
    e.dose_mode = 'interval'; e.reps = null;
    if (!e.work_time) e.work_time = '0:30';
  } else {
    e.dose_mode = 'reps'; e.work_time = null; e.rest_time = null;
    if (e.reps == null) e.reps = 10;
  }
  ['dose_mode','reps','work_time','rest_time'].forEach(f => _dpMarkDoseOverride(e, f));
  if ((e.phase || '') === 'activation') dpPaintActStrip(); else renderExerciseList(_dpFieldExercises || []);
  dpRecomputeSectionTotals(); recalcTotals();
  const { error } = await window.sb.from('session_exercises')
    .update({ dose_mode: e.dose_mode, reps: e.reps, work_time: e.work_time, rest_time: e.rest_time, dosing_overrides: e.dosing_overrides })
    .eq('id', seid).eq('club_id', _dpClubId);
  if (error) console.warn('[dp-str-unit] save failed:', error.message);
}
// Build the strength sub-section (header + list + add button) for a phase.
// showAdd=false (e.g. Field exercises) omits the "add" entry point — strength is only added from Activation.
function dpStrengthSectionHTML(items, phase, showAdd = true) {
  const mode = phase === 'goalkeepers' ? 'goalkeepers' : phase === 'activation' ? 'activation' : 'main';
  const addBtn = showAdd ? `<button class="dp-str-add no-print" onclick="openGymLibModal('${mode}')"><i class="ti ti-barbell"></i>${tt('daily_planning.add_strength_exercise','Add strength exercise')}</button>` : '';
  if (!items.length) return addBtn;
  return `<div class="dp-str-head"><i class="ti ti-barbell"></i><span>${tt('daily_planning.strength','Strength')}</span><span class="ct">${items.length}</span></div>`
    + `<div class="dp-str-list">${items.map(dpStrengthCardHTML).join('')}</div>`
    + addBtn;
}

function dpExerciseCardHTML(e) {
    const _eff = Math.round(dpBlockMins(e).total_min);
    const dur = _eff ? `${_eff}′` : '—';
    if (e.planner_exercise_id) {
      // Planner (field) exercise
      const orient  = e.calc_orientation || null;
      const meta    = orient ? _DP_ORIENT[orient] : null;
      const tagCls  = meta ? meta.tagCls : 'tac';
      const tagLbl  = meta ? meta.short  : tt('daily_planning.field','FIELD');
      const m2      = e.m2_per_player;
      const players = e.players_count;
      const w = e.field_width, h = e.field_height;
      const fieldStr = (w && h) ? `${w}×${h}m` : null;
      const _resolved = (e.planner_exercise_id in _dpPngCache);     // preview lookup finished (may be null)
      const _loading  = !!e.planner_exercise_id && !_resolved && !e._previewPng;
      const _vurl     = (_dpDescCache[e.planner_exercise_id] || {}).video_url || '';
      const _playBadge = _vurl ? `<button type="button" class="dp-ex-play no-print" onclick="dpOpenVideo(event,'${e.id}')" title="${tt('daily_planning.preview_video','Preview video')}"><i class="ti ti-player-play-filled"></i></button>` : '';
      return `<div class="dp-ex" data-seid="${e.id}" draggable="true">
        ${e._previewPng ? `<div class="dp-ex-thumb has-img">
          <span class="dp-ex-tag ${tagCls}">${tagLbl}</span>
          <span class="dp-ex-dur"><i class="ti ti-clock"></i>${dur}</span>
          <img class="dp-ex-img" src="${e._previewPng}" alt="">
          ${_playBadge}
        </div>` : _loading ? `<div class="dp-ex-thumb is-loading">
          <span class="dp-ex-tag ${tagCls}">${tagLbl}</span>
          <span class="dp-ex-dur"><i class="ti ti-clock"></i>${dur}</span>
          <div class="dp-ex-skel"></div>
        </div>` : `<div class="dp-ex-thumb">
          <span class="dp-ex-tag ${tagCls}">${tagLbl}</span>
          <span class="dp-ex-dur"><i class="ti ti-clock"></i>${dur}</span>
          <div class="dp-ex-thumb-content" style="display:flex;align-items:center;justify-content:center">
            <i class="ti ti-soccer-field" style="font-size:28px;opacity:.35;color:#fff"></i>
          </div>
          ${_playBadge}
        </div>`}
        <div class="dp-ex-b">
          <div class="dp-ex-name">${_dpEsc(e.name || '—')}</div>
          <div class="dp-ex-meta">
            ${players ? `<span class="it"><i class="ti ti-users"></i>${players} ${tt('daily_planning.pl','pl')}</span>` : ''}
            ${m2 ? `<span class="it"><i class="ti ti-layout-navbar"></i>${m2} ${tt('daily_planning.m2_p','m²/p')}</span>` : ''}
            ${fieldStr ? `<span class="it"><i class="ti ti-rectangle"></i>${fieldStr}</span>` : ''}
          </div>
          ${(() => {
            // Inline time editor for every phase (main / activation / goalkeepers).
            const EI = 'padding:4px 6px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;font-size:11.5px';
            const seriesMode = !!(e.series && e.work_time);   // interval — structure decides, not absence of a legacy duration
            const repsMode   = !seriesMode && (e.dose_mode === 'reps' || (!!e.series && e.reps != null && e.reps !== ''));
            let inner;
            if (seriesMode) {
              inner = `<input type="number" min="1" value="${e.series ?? ''}" oninput="dpEditSeries('${e.id}',this.value)" title="${tt('daily_planning.series','Series')}" style="${EI};width:40px">
                   <span>×</span>
                   <input type="text" value="${_dpEsc(e.work_time ?? '')}" placeholder="3:00" oninput="dpEditWork('${e.id}',this.value)" title="${tt('daily_planning.work_time_mmss','Work time (mm:ss)')}" style="${EI};width:52px">
                   <span>${tt('daily_planning.work','work')}</span>
                   <span>+</span>
                   <input type="text" value="${_dpEsc(e.rest_time ?? '')}" placeholder="1:30" oninput="dpEditRest('${e.id}',this.value)" title="${tt('daily_planning.rest_time_mmss','Rest time (mm:ss)')}" style="${EI};width:52px">
                   <span>${tt('daily_planning.rest','rest')}</span>
                   <span data-eff="${e.id}" title="${tt('daily_planning.total_series_work_rest','Total = series × (work + rest)')}" style="margin-left:auto;font-weight:600;color:var(--cm-fg-strong)">= ${Math.round(dpBlockMins(e).total_min)}′ ${tt('daily_planning.total_suffix','total')}</span>`;
            } else if (repsMode) {
              inner = `<input type="number" min="1" value="${e.series ?? ''}" oninput="dpEditSeries('${e.id}',this.value)" title="${tt('daily_planning.series','Series')}" style="${EI};width:40px">
                   <span>×</span>
                   <input type="number" min="1" value="${e.reps ?? ''}" placeholder="10" oninput="dpEditReps('${e.id}',this.value)" title="${tt('daily_planning.reps','Reps')}" style="${EI};width:46px">
                   <span>${tt('daily_planning.reps_short','reps')}</span>
                   <span>·</span>
                   <input type="number" min="0" value="${e.duration != null ? e.duration : ''}" placeholder="${tt('daily_planning.min_ph','min')}" oninput="dpEditDur('${e.id}',this.value)" title="${tt('daily_planning.duration_min_attr','Duration (min)')}" style="${EI};width:54px"><span>${tt('daily_planning.min_short','min')}</span>
                   <span data-eff="${e.id}" style="margin-left:auto;font-weight:600;color:var(--cm-fg-strong)">= ${Math.round(dpBlockMins(e).total_min)}′ ${tt('daily_planning.total_suffix','total')}</span>`;
            } else {
              inner = `<input type="number" min="0" value="${e.duration != null ? e.duration : ''}" placeholder="${tt('daily_planning.min_ph','min')}" oninput="dpEditDur('${e.id}',this.value)" title="${tt('daily_planning.duration_min_attr','Duration (min)')}" style="${EI};width:54px"><span>${tt('daily_planning.min_short','min')}</span>`;
            }
            return `<div class="dp-ex-edit no-print" style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:6px;font:500 11px var(--cm-font-sans);color:var(--cm-fg-muted)">${inner}</div>`;
          })()}
          ${(() => {
            const dn = _dpDescCache[e.planner_exercise_id] || null;
            const obj = dn && dn.objective ? dn.objective : '';
            const dsc = dn && dn.description ? dn.description : '';
            let h = '';
            if (obj) h += `<div class="dp-ex-desc" title="${tt('daily_planning.objective_drill_designer','Objective (Drill Designer)')}"><b>${tt('daily_planning.objective_label','Objective')}:</b> ${_dpEsc(obj)}</div>`;
            if (dsc) h += `<div class="dp-ex-desc" title="${tt('daily_planning.description_drill_designer','Description (Drill Designer)')}">${_dpEsc(dsc)}</div>`;
            return h;
          })()}
          <textarea class="no-print" placeholder="${tt('daily_planning.session_notes_ph','Session notes…')}" oninput="dpEditNotes('${e.id}',this.value)" title="${tt('daily_planning.notes_for_this_session_only','Notes for this session only (not saved to the Drill Designer exercise)')}" style="width:100%;margin-top:6px;padding:4px 6px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;font-size:11.5px;resize:vertical;min-height:30px">${(e.notes ?? '').replace(/</g,'&lt;')}</textarea>
          ${dpExGroupsRow(e)}
          <div class="dp-ex-foot">
            <span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint)">${tt('daily_planning.planner','PLANNER')}</span>
            <span class="grow"></span>
            <a class="no-print" href="Planner.html?exercise=${e.planner_exercise_id}" title="${tt('daily_planning.open_in_drill_designer','Open in Drill Designer')}" style="width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:var(--cm-fg-muted);text-decoration:none" onmouseover="this.style.background='var(--cm-bg-soft)'" onmouseout="this.style.background=''"><i class="ti ti-external-link" style="font-size:13px"></i></a>
            <button class="no-print" onclick="deleteExercise('${e.id}')" title="${tt('daily_planning.remove','Remove')}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`;
    } else {
      // Gym (strength library) / manual exercise
      const gx  = e.gym_exercises || null;
      const isGym = !!e.exercise_id;
      const nm  = gx?.name || e.name || '—';
      const cat = (gx?.category || (isGym ? 'strength' : 'other')).toLowerCase();
      const cls = CAT_CLS[cat] || 'oth';
      const lbl = dpCatLabel(cat);
      const desc      = gx?.description || '';
      const intensity = e.intensity || '';
      const img       = dpGymImg(e);
      const isVideo   = !!(gx && gx.video_id && !(gx.media_type === 'image' && gx.media_ref));
      const EI = 'padding:4px 6px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;font-size:11.5px';
      const _gymPlay = isVideo ? `<button type="button" class="dp-ex-play no-print" onclick="dpOpenVideo(event,'${e.id}')" title="${tt('daily_planning.preview_video','Preview video')}"><i class="ti ti-player-play-filled"></i></button>` : '';
      const thumb = img
        ? `<div class="dp-ex-thumb has-img">
            <span class="dp-ex-tag ${cls}">${lbl}</span>
            <span class="dp-ex-dur"><i class="ti ti-clock"></i>${dur}</span>
            <img class="dp-ex-img" src="${img}" alt="">
            ${_gymPlay}
          </div>`
        : `<div class="dp-ex-thumb">
            <span class="dp-ex-tag ${cls}">${lbl}</span>
            <span class="dp-ex-dur"><i class="ti ti-clock"></i>${dur}</span>
            <div class="dp-ex-thumb-content" style="display:flex;align-items:center;justify-content:center">
              <i class="ti ti-barbell" style="font-size:28px;opacity:.35;color:#fff"></i>
            </div>
            ${_gymPlay}
          </div>`;
      // Strength cards dose by series × reps (with optional minutes); manual keeps the simple duration field.
      const editRow = isGym
        ? `<div class="dp-ex-edit no-print" style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:6px;font:500 11px var(--cm-font-sans);color:var(--cm-fg-muted)">
            <input type="number" min="1" value="${e.series ?? ''}" oninput="dpEditSeries('${e.id}',this.value)" title="${tt('daily_planning.series','Series')}" style="${EI};width:40px">
            <span>×</span>
            <input type="number" min="1" value="${e.reps ?? ''}" placeholder="10" oninput="dpEditReps('${e.id}',this.value)" title="${tt('daily_planning.reps','Reps')}" style="${EI};width:46px">
            <span>${tt('daily_planning.reps_short','reps')}</span>
            <span>·</span>
            <input type="number" min="0" value="${e.duration != null ? e.duration : ''}" placeholder="${tt('daily_planning.min_ph','min')}" oninput="dpEditDur('${e.id}',this.value)" title="${tt('daily_planning.duration_min_attr','Duration (min)')}" style="${EI};width:54px"><span>${tt('daily_planning.min_short','min')}</span>
          </div>`
        : `<div class="dp-ex-edit no-print" style="display:flex;align-items:center;gap:5px;margin-top:6px;font:500 11px var(--cm-font-sans);color:var(--cm-fg-muted)">
            <input type="number" min="0" value="${e.duration != null ? e.duration : ''}" placeholder="${tt('daily_planning.min_ph','min')}" oninput="dpEditDur('${e.id}',this.value)" title="${tt('daily_planning.duration_min_attr','Duration (min)')}" style="${EI};width:54px"><span>${tt('daily_planning.min_short','min')}</span>
          </div>`;
      return `<div class="dp-ex" data-seid="${e.id}" draggable="true">
        ${thumb}
        <div class="dp-ex-b">
          <div class="dp-ex-name">${nm}</div>
          <div class="dp-ex-meta">${intensity ? `<span class="it"><i class="ti ti-flame"></i>${intensity}</span>` : ''}</div>
          ${desc ? `<div class="dp-ex-desc" title="${tt('daily_planning.strength_library','Strength Library')}">${desc}</div>` : ''}
          ${editRow}
          <textarea class="no-print" placeholder="${tt('daily_planning.session_notes_ph','Session notes…')}" oninput="dpEditNotes('${e.id}',this.value)" style="width:100%;margin-top:6px;padding:4px 6px;border:1px solid var(--cm-border);border-radius:6px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;font-size:11.5px;resize:vertical;min-height:30px">${(e.notes ?? '').replace(/</g,'&lt;')}</textarea>
          ${dpExGroupsRow(e)}
          <div class="dp-ex-foot">
            <span style="font:500 10.5px/1 var(--cm-font-mono);color:var(--cm-fg-faint)">${gx ? tt('daily_planning.library','LIBRARY') : tt('daily_planning.manual_tag','MANUAL')}</span>
            <span class="grow"></span>
            <button class="no-print" onclick="deleteExercise('${e.id}')" title="${tt('daily_planning.remove','Remove')}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`;
    }
}

let _dpSessionTotalMin = 0;

// work_time is text, usually "M:SS" (UI placeholder "3:00"); may also be a plain
// number (seconds if ≥20, else minutes). Returns minutes.
function dpWorkMin(wt) {
  if (wt == null || wt === '') return 0;
  const s = String(wt).trim();
  if (s.includes(':')) { const [m, sec] = s.split(':'); return (Number(m) || 0) + (Number(sec) || 0) / 60; }
  const n = Number(s); if (!isFinite(n)) return 0;
  return n >= 20 ? n / 60 : n;
}
// Single source of truth for a block's minutes — shared by totals AND projection.
//   work_min  = series × work_time         → GPS load (drives the projection)
//   total_min = series × (work + rest)      → session time (drives the totals)
// Blocks without series/work fall back to the flat duration for both.
function dpBlockMins(e) {
  const series = Number(e && e.series) || 0;
  const wMin = dpWorkMin(e && e.work_time);
  const rMin = dpWorkMin(e && e.rest_time);
  if (series && wMin) return { work_min: series * wMin, total_min: series * (wMin + rMin) };
  const d = (e && e.duration != null && e.duration !== '') ? (Number(e.duration) || 0) : 0;
  return { work_min: d, total_min: d };
}

// ── Per-task duration / series×work_time editing (BUG C) ──────────────────
let _dpEditTimers = {};
let _dpEditPending = {};   // seid -> accumulated patch not yet written (merge, don't clobber)
function _dpEditSave(seid, patch){
  _dpEditPending[seid] = { ...(_dpEditPending[seid] || {}), ...patch };   // merge so editing several fields fast doesn't lose any
  clearTimeout(_dpEditTimers[seid]);
  _dpEditTimers[seid] = setTimeout(() => { _dpEditFlushOne(seid); }, 500);
}
async function _dpEditFlushOne(seid){
  clearTimeout(_dpEditTimers[seid]); delete _dpEditTimers[seid];
  const patch = _dpEditPending[seid];
  if (!patch) return;
  delete _dpEditPending[seid];
  const { error } = await window.sb.from('session_exercises').update(patch).eq('id', seid).eq('club_id', _dpClubId);
  if (error) console.warn('[dp-edit] save failed:', error.message);
}
// Flush ALL pending task edits NOW (call before switching day / on unload / on blur).
function dpFlushEdits(){ Object.keys(_dpEditPending).forEach(seid => _dpEditFlushOne(seid)); }
// A task may live in field exercises, activation activities OR goalkeeper training.
function _dpFindTask(seid){
  return _dpFieldExercises.find(x => x.id === seid)
      || (window._dpActItems||[]).find(x => x.id === seid)
      || (window._dpGkItems||[]).find(x => x.id === seid)
      || null;
}
// Recompute the activation / goalkeeper section totals from their item lists (dpBlockMins,
// so interval blocks count as series×(work+rest)), and refresh their header displays.
function dpRecomputeSectionTotals(){
  const act = Math.round((window._dpActItems||[]).reduce((s,e)=>s+dpBlockMins(e).total_min,0));
  _dpActTotalMin = act;
  const aCt = document.getElementById('dpActCt'), aDur = document.getElementById('dpActDuration');
  if (aCt)  aCt.textContent = act ? tt('daily_planning.min_count', `${act} min`, {count: act}) : '—';
  if (aDur) aDur.value = act || '';
  const gks = (window._dpGkItems||[]);
  const gk = Math.round(gks.reduce((s,e)=>s+dpBlockMins(e).total_min,0));
  _dpGkTotalMin = gk;
  const gCt = document.getElementById('dpGkCt'), gDur = document.getElementById('dpGkDuration');
  if (gCt)  gCt.textContent = gk ? tt('daily_planning.min_count', `${gk} min`, {count: gk}) : (gks.length ? String(gks.length) : '—');
  if (gDur) gDur.value = gk || '';
}
function _dpEffLabel(seid){
  const e = _dpFindTask(seid);
  if (!e) return;
  const mins = Math.round(dpBlockMins(e).total_min);
  const el = document.querySelector(`[data-eff="${seid}"]`);
  if (el) el.textContent = '= ' + mins + '′';
  // Keep the card's top-right clock badge in sync with manual time edits.
  const badge = document.querySelector(`.dp-ex[data-seid="${seid}"] .dp-ex-dur`);
  if (badge) badge.innerHTML = `<i class="ti ti-clock"></i>${mins ? mins + '′' : '—'}`;
}
// A dosing field edited on the card is what was PLANNED for this day → pin it so a later Drill
// Designer edit won't overwrite it (dpSyncPlannerFields skips fields listed in dosing_overrides).
function _dpMarkDoseOverride(e, field){
  const set = new Set(Array.isArray(e.dosing_overrides) ? e.dosing_overrides : []);
  set.add(field);
  e.dosing_overrides = [...set];
  return e.dosing_overrides;
}
function dpEditDur(seid, val){
  const e = _dpFindTask(seid); if (!e) return;   // field / activation / goalkeeper task
  e.duration = val === '' ? null : (parseInt(val) || 0);
  _dpEffLabel(seid);                    // per-card badge + inline total
  dpRecomputeSectionTotals();           // activation / GK header totals
  recalcTotals();                       // live day totals + GPS projection
  _dpEditSave(seid, { duration: e.duration, dosing_overrides: _dpMarkDoseOverride(e, 'duration') });
}
function dpEditSeries(seid, val){
  const e = _dpFindTask(seid); if (!e) return;
  e.series = val === '' ? null : (parseInt(val) || null);
  _dpEffLabel(seid); dpRecomputeSectionTotals(); recalcTotals();
  _dpEditSave(seid, { series: e.series, dosing_overrides: _dpMarkDoseOverride(e, 'series') });
}
function dpEditReps(seid, val){
  const e = _dpFindTask(seid); if (!e) return;
  e.reps = val === '' ? null : (parseInt(val) || null);
  _dpEditSave(seid, { reps: e.reps, dosing_overrides: _dpMarkDoseOverride(e, 'reps') });   // reps don't change session minutes (duration drives the total)
}
function dpEditWork(seid, val){
  const e = _dpFindTask(seid); if (!e) return;
  e.work_time = val === '' ? null : val;
  _dpEffLabel(seid); dpRecomputeSectionTotals(); recalcTotals();
  _dpEditSave(seid, { work_time: e.work_time, dosing_overrides: _dpMarkDoseOverride(e, 'work_time') });
}
function dpEditRest(seid, val){
  const e = _dpFindTask(seid); if (!e) return;
  e.rest_time = val === '' ? null : val;
  _dpEffLabel(seid); dpRecomputeSectionTotals(); recalcTotals();   // total uses rest; projection (work_min) unaffected
  _dpEditSave(seid, { rest_time: e.rest_time, dosing_overrides: _dpMarkDoseOverride(e, 'rest_time') });
}
function dpEditNotes(seid, val){
  const e = _dpFindTask(seid); if (!e) return;   // field OR activation task
  e.notes = val === '' ? null : val;       // per-session only — never written to the Designer exercise
  _dpEditSave(seid, { notes: e.notes });
}

function recalcTotals() {
  const actMin   = _dpActTotalMin;
  const fieldMin = Math.round(_dpFieldExercises.reduce((s, e) => s + dpBlockMins(e).total_min, 0));
  const fieldCt  = _dpFieldExercises.length;
  const total    = actMin + fieldMin;
  _dpSessionTotalMin = total;
  const _minSub = `<sub>${tt('daily_planning.min_suffix','min')}</sub>`;
  const elAV = document.getElementById('dpTotAct');        if (elAV) elAV.innerHTML = actMin   ? `${actMin}${_minSub}`   : `—${_minSub}`;
  const elFV = document.getElementById('dpTotField');      if (elFV) elFV.innerHTML = fieldMin ? `${fieldMin}${_minSub}` : `—${_minSub}`;
  const elFC = document.getElementById('dpTotFieldCt');    if (elFC) elFC.textContent = fieldCt ? tt('daily_planning.n_exercises', `${fieldCt} exercises`, {count: fieldCt}) : '';
  const elTV = document.getElementById('dpTotTotal');      if (elTV) elTV.innerHTML = total    ? `${total}${_minSub}`   : `—${_minSub}`;
  const elTB = document.getElementById('dpTotBlocks');     if (elTB) elTB.textContent = fieldCt ? tt('daily_planning.n_blocks', `${fieldCt} blocks`, {count: fieldCt}) : '';
  const elSD = document.getElementById('dpTotSession');    if (elSD) elSD.innerHTML = total    ? `${total}${_minSub}`   : `—${_minSub}`;
  const elSN = document.getElementById('dpTotSessionNote');
  if (elSN) elSN.textContent = (actMin && fieldMin) ? tt('daily_planning.activation_field_split', `${actMin}′ activation + ${fieldMin}′ field`, {act: actMin, field: fieldMin}) : '';
  // Exercises header count "N · X min" — keep live with manual per-card time edits.
  const elCt = document.getElementById('dpExCt');
  if (elCt && fieldCt) elCt.textContent = `${fieldCt} · ${tt('daily_planning.min_count', `${fieldMin} min`, {count: fieldMin})}`;
  dpUpdateAu();
  renderGpsProjection();   // live: re-project whenever blocks/durations change
}

// ── Projected GPS load (2d) ────────────────────────────────────────────────
// projected(metric) = Σ over field blocks with a GPS profile:
//   profile[ex].<metric>_per_min × block.duration(min)  × display mult.
// Blocks without exercise_id or without a profile row are excluded (honest).
const _DP_PROJ_DEFAULT = ['total_distance_per_min','high_speed_distance_per_min','sprint_distance_per_min','player_load_per_min','accelerations_per_min','decelerations_per_min'];
const _DP_PROJ_LS = 'cm_dp_proj_metrics';
function dpProjMetricKeys(){
  try { const v = JSON.parse(localStorage.getItem(_DP_PROJ_LS)); if (Array.isArray(v) && v.length) return (window.CM_GPS_METRICS||[]).map(m=>m.key).filter(k=>v.includes(k)); } catch(_){}
  return _DP_PROJ_DEFAULT.slice();
}
let _dpProjSaveTimer = null;
let _dpProjPending = null;   // { sid, snap } captured when a save is scheduled
function _dpWriteTargets(sid, snap){
  if (!sid) return Promise.resolve();
  // gps_targets es un mapa métrica→valor, así que SÍ se puede fusionar: si otro
  // tocó la sesión mientras tanto, se reintenta con las métricas de él más las
  // que cambié yo encima, en vez de devolverle el objeto entero como estaba en
  // mi pantalla. Ver assets/cm-save.js.
  const prevTargets = (_dpSaved && _dpSaved.gps_targets) || {};
  return window.cmSave.patch({
    table: 'training_sessions', id: sid, clubId: _dpClubId,
    prev: { gps_targets: prevTargets }, next: { gps_targets: snap }, since: _dpSince,
    onRemote: (fila) => {
      const mias = window.cmSave.diff(prevTargets, snap);
      return { gps_targets: { ...(fila.gps_targets || {}), ...mias } };
    },
  }).then(r => {
    if (r.status === 'error') { console.warn('[gps_targets] save failed:', r.error && r.error.message); return; }
    if (r.status === 'noop') return;
    _dpSince = r.updatedAt || _dpSince;
    if (_dpSaved) _dpSaved.gps_targets = r.sent.gps_targets;
  });
}
// Capture session id + a SNAPSHOT of targets NOW (not at fire time) so navigating
// to another day before the debounce can't write to the wrong/empty session.
async function dpSaveTargets(){
  clearTimeout(_dpProjSaveTimer);
  const snap = { ..._dpGpsTargets };
  const day = _dpCurrentDate;
  let sid = _dpCurrentSessionId;
  if (!sid) {
    try { await dpEnsureSession(); } catch(_){}
    if (_dpCurrentDate !== day) return;  // navigated during ensure → don't write to the new day
    sid = _dpCurrentSessionId;
  }
  if (!sid) return;                      // still no session → nothing to write
  _dpProjPending = { sid, snap };
  _dpProjSaveTimer = setTimeout(() => { _dpProjPending = null; _dpWriteTargets(sid, snap); }, 500);
}
// Write any pending save immediately (call before navigating days).
function dpFlushTargets(){
  if (!_dpProjPending) return;
  clearTimeout(_dpProjSaveTimer);
  const { sid, snap } = _dpProjPending;
  _dpProjPending = null;
  _dpWriteTargets(sid, snap);
}
async function renderGpsProjection(){
  const card = document.getElementById('dpGpsProj'); if (!card) return;
  const blocks = [ ...(_dpFieldExercises||[]), ...((window._dpActItems)||[]) ];  // field + activation; phase no longer gates the projection
  const withId = blocks.filter(e => e.planner_exercise_id && dpBlockMins(e).work_min > 0);
  // Fetch any profiles we don't have cached yet. planner_exercise_id IS exercises.id (= the view key).
  await dpEnsureGpsProfiles(withId.map(e => e.planner_exercise_id));
  const covered = withId.filter(e => _dpGpsProfiles[e.planner_exercise_id]);
  // Visible whenever a day session is loaded (same criterion as the totals strip).
  // No static display:none — only hide on an empty day with no session at all.
  if (!_dpCurrentSessionId && !blocks.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  const keys = dpProjMetricKeys();
  const num = x => (x == null || x === '') ? 0 : Number(x);
  const projVals = {};   // metric_key → projected value (display units)
  // Bar zone: <90% under (neutral), ±10% on (green), >110% over (amber).
  const barFor = (proj, tgt) => {
    if (!tgt || tgt <= 0) return { w: 0, c: 'var(--cm-fg-faint)' };
    const ratio = proj / tgt;
    return { w: ratio > 1.1 ? 100 : Math.min(ratio, 1) * 100,
             c: ratio < 0.9 ? 'var(--cm-fg-muted)' : ratio <= 1.1 ? 'var(--cm-success,#16a34a)' : 'var(--cm-warning,#d97706)' };
  };
  const body = document.getElementById('dpProjBody');
  body.innerHTML = keys.map(k => {
    const m = (window.CM_GPS_METRICS||[]).find(x => x.key === k); if (!m) return '';
    // Σ per_min × minutes, then to display unit (TD km→m ×1000); totals shown as integers.
    let proj = 0;
    covered.forEach(e => { proj += num(_dpGpsProfiles[e.planner_exercise_id][k]) * dpBlockMins(e).work_min; });
    proj = Math.round(proj * m.mult);
    projVals[k] = proj;
    const unit = m.avgUnit || '';
    const tgt = _dpGpsTargets[k] != null && _dpGpsTargets[k] !== '' ? Number(_dpGpsTargets[k]) : null;
    const bar = barFor(proj, tgt);
    return `<div style="display:grid;grid-template-columns:108px 1fr 92px;gap:10px;align-items:center;padding:6px 2px">
      <div style="font:600 12px var(--cm-font-sans);color:var(--cm-fg)">${_dpEsc(m.label)}</div>
      <div>
        <div style="display:flex;justify-content:space-between;font:500 11px var(--cm-font-mono);color:var(--cm-fg-muted);margin-bottom:3px">
          <span style="color:var(--cm-fg-strong);font-weight:600">${proj.toLocaleString()} ${unit}</span>
          <span data-tgtlabel="${k}">${tgt ? tt('daily_planning.target_value', `target ${tgt.toLocaleString()} ${unit}`, {value: tgt.toLocaleString(), unit}) : tt('daily_planning.no_target','no target')}</span>
        </div>
        <div style="height:6px;border-radius:999px;background:var(--cm-bg-soft);overflow:hidden"><div data-bar="${k}" style="height:100%;width:${bar.w}%;background:${bar.c};border-radius:999px"></div></div>
      </div>
      <input type="number" step="any" min="0" data-proj-target="${k}" value="${tgt != null ? tgt : ''}" placeholder="${tt('daily_planning.target','Target')}" style="padding:6px 8px;border:1px solid var(--cm-border);border-radius:7px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit;width:100%">
    </div>`;
  }).join('');
  window._dpProjVals = { ...projVals };   // expose for the print sheet's GPS strip
  // Update only the bar/label on target edits (no full re-render → input keeps focus).
  body.querySelectorAll('[data-proj-target]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.projTarget;
    if (inp.value === '') delete _dpGpsTargets[k]; else _dpGpsTargets[k] = Number(inp.value);
    dpSaveTargets();
    const m = (window.CM_GPS_METRICS||[]).find(x => x.key === k); const unit = m?.avgUnit || '';
    const tgt = inp.value === '' ? null : Number(inp.value);
    const bar = barFor(projVals[k] || 0, tgt);
    const barEl = body.querySelector(`[data-bar="${k}"]`); if (barEl) { barEl.style.width = bar.w + '%'; barEl.style.background = bar.c; }
    const lblEl = body.querySelector(`[data-tgtlabel="${k}"]`); if (lblEl) lblEl.textContent = tgt ? tt('daily_planning.target_value', `target ${tgt.toLocaleString()} ${unit}`, {value: tgt.toLocaleString(), unit}) : tt('daily_planning.no_target','no target');
  }));
  // Save on blur too (not only on the debounce).
  body.querySelectorAll('[data-proj-target]').forEach(inp => inp.addEventListener('change', async () => { await dpSaveTargets(); dpFlushTargets(); }));

  const Y = withId.length, X = covered.length, Z = Y - X;
  const note = document.getElementById('dpProjNote');
  if (note) note.textContent = Y
    ? tt('daily_planning.projection_covers', `Projection covers ${X} of ${Y} drill${Y!==1?'s':''}${Z ? ` (${Z} have no GPS profile yet)` : ''}.`, {covered: X, total: Y, extra: Z ? ' ' + tt('daily_planning.projection_no_profile', `(${Z} have no GPS profile yet)`, {count: Z}) : ''})
    : tt('daily_planning.no_mapped_drills','No mapped drills with a GPS profile yet.');
}

// Collapse/expand the panel (Evaluations dropdown pattern). Gear stops
// propagation so opening the metric picker never toggles the panel.
document.getElementById('dpProjHead')?.addEventListener('click', () => {
  document.getElementById('dpGpsProj')?.classList.toggle('is-collapsed');
});
document.getElementById('dpProjGear')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const sel = new Set(dpProjMetricKeys());
  document.getElementById('dpProjPickerPop')?.remove();
  const pop = document.createElement('div');
  pop.id = 'dpProjPickerPop';
  pop.style.cssText = 'position:fixed;z-index:10000;background:var(--cm-bg);border:1px solid var(--cm-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);padding:6px;min-width:200px;max-height:320px;overflow:auto';
  pop.innerHTML = `<div style="font:600 9px/1 var(--cm-font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cm-fg-muted);padding:6px 9px 7px">${tt('daily_planning.metrics_to_project','Metrics to project')}</div>` +
    (window.CM_GPS_METRICS||[]).map(m => `<label style="display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;cursor:pointer;font:500 12px var(--cm-font-sans);color:var(--cm-fg)"><input type="checkbox" value="${m.key}" ${sel.has(m.key)?'checked':''} style="width:15px;height:15px;accent-color:var(--cm-accent)"><span>${_dpEsc(m.label)}</span></label>`).join('');
  document.body.appendChild(pop);
  const r = e.currentTarget.getBoundingClientRect();
  pop.style.top = Math.min(r.bottom + 4, window.innerHeight - pop.offsetHeight - 8) + 'px';
  pop.style.left = Math.max(8, r.right - pop.offsetWidth) + 'px';
  pop.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) sel.add(cb.value); else sel.delete(cb.value);
    try { localStorage.setItem(_DP_PROJ_LS, JSON.stringify((window.CM_GPS_METRICS||[]).map(m=>m.key).filter(k=>sel.has(k)))); } catch(_){}
    renderGpsProjection();
  }));
  setTimeout(() => { const close = ev => { if (!pop.contains(ev.target) && ev.target !== e.currentTarget) { pop.remove(); document.removeEventListener('mousedown', close); } }; document.addEventListener('mousedown', close); }, 0);
});

function dpUpdateAu() {
  const rpe = parseInt(document.getElementById('dpEstRpe')?.value) || 0;
  const dur = _dpSessionTotalMin;
  const au  = (rpe && dur) ? rpe * dur : null;
  const elV = document.getElementById('dpTotAu');
  const elN = document.getElementById('dpTotAuNote');
  const _auSub = `<sub>${tt('daily_planning.au','AU')}</sub>`;
  if (elV) elV.innerHTML = au ? `${au}${_auSub}` : `—${_auSub}`;
  if (elN) elN.textContent = (rpe && !dur) ? tt('daily_planning.add_exercises_first','add exercises first') : (dur && !rpe) ? tt('daily_planning.set_rpe_above','set RPE above') : '';
}

// ── Dedicated print sheet (ClavaMetrics "Daily Session Plan") — built from live data; physio = one thin line under the squad ──
async function dpRenderPrintSheet() {
  const host = document.getElementById('dpPrintSheet');
  if (!host) return;
  try {
    // Resolve signed-URL previews (base64 fallback) for field + activation before building the sheet.
    const _allIds = [
      ...(_dpFieldExercises||[]).map(e=>e.planner_exercise_id),
      ...((window._dpActItems)||[]).map(e=>e.planner_exercise_id),
      ...((window._dpGkItems)||[]).map(e=>e.planner_exercise_id)
    ].filter(Boolean);
    try { await dpResolvePreviews(_allIds); } catch(_) {}
    try { await dpResolveGymImgs([...(_dpFieldExercises||[]), ...((window._dpActItems)||[])], null, null); } catch(_) {}
    const _img = e => (e.planner_exercise_id && (e.planner_exercise_id in _dpPngCache)) ? _dpPngCache[e.planner_exercise_id]
                      : (e._previewImg || e._previewPng || dpGymImg(e) || null);
    const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const mono = n => { const w=(n||'').trim().split(/\s+/).filter(Boolean); return ((((w[0]||'')[0]||'')+((w[1]||'')[0]||''))||(n||'?').slice(0,2)).toUpperCase(); };
    const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
    const val = id => (document.getElementById(id)?.value || '').trim();
    const FONT = "'Geist',system-ui,sans-serif", MONO = "'Geist Mono',ui-monospace,monospace";

    const club = window._dpClub || {};
    let accent = club.primary_color || club.accent_color || '';
    accent = /^#?[0-9a-fA-F]{6}$/.test(accent) ? (accent[0]==='#'?accent:'#'+accent) : '#15803D';
    const clubName = club.name || 'Club';
    const teamName = (_dpTeams||[]).find(t=>t.id===_dpTeamId)?.name || '';
    const today = cmToday();
    const dateLabel = _dpFmt(_dpCurrentDate || today);

    // microcycle + next match
    const mcSel = document.getElementById('dpMicrocycle');
    const mcTxt = mcSel && mcSel.value ? (mcSel.options[mcSel.selectedIndex]?.text || '') : '';
    const mc = (_dpMicrocycles||[]).find(m => m.id === (mcSel && mcSel.value));
    const md  = val('dpMatchDay');

    // 1) Letterhead
    const crest = club.logo_url
      ? `<img src="${esc(club.logo_url)}" alt="" crossorigin="anonymous" style="width:46px;height:46px;border-radius:50%;object-fit:cover;display:block">`
      : `<div style="width:46px;height:46px;border-radius:50%;background:var(--club-accent);color:#fff;display:flex;align-items:center;justify-content:center;font:700 17px ${FONT}">${esc(mono(clubName))}</div>`;
    const head = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div style="display:flex;align-items:center;gap:12px">${crest}
        <div><div style="font:700 17px ${FONT};color:#15181D">${esc(clubName)}</div>
        ${teamName?`<div style="font:500 11px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#8A93A0;margin-top:2px">${esc(teamName)}</div>`:''}</div>
      </div>
      <div style="text-align:right">
        <div style="font:800 13px ${FONT};letter-spacing:.1em;text-transform:uppercase;color:var(--club-accent)">${esc(tt('daily_planning.sheet_daily_session','Daily session'))}</div>
        <div style="font:500 12px ${MONO};color:#5B6470;margin-top:3px">${esc(dateLabel)}</div>
      </div>
    </div><div style="height:2px;background:#15181D;margin:12px 0 14px"></div>`;

    // 2) Session line + meta grid
    const title = val('dpSessionTitle'), rpe = val('dpEstRpe');
    const sessionLine = (title || rpe) ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:${title?'10px':'0'}">
      <div>${title?`<span style="font:700 16px ${FONT};color:#15181D">${esc(title)}</span>`:''}</div>
      ${rpe?`<div style="font:700 11px ${MONO};color:var(--club-accent);border:1px solid var(--club-accent);padding:3px 9px;border-radius:999px;white-space:nowrap">RPE ${esc(rpe)}</div>`:''}
    </div>` : '';

    const mdBadge = md ? `<span style="display:inline-block;font:700 9px ${MONO};color:#fff;background:var(--club-accent);padding:2px 6px;border-radius:4px">MD ${esc(md)}</span>` : '';
    const cells = [];
    const t1 = val('dpStartTime'), t2 = val('dpEndTime');
    if (t1||t2) cells.push({l:tt('daily_planning.sheet_time','Time'), v:`${esc(t1||'—')}–${esc(t2||'—')}`});
    if (mcTxt)  cells.push({l:tt('daily_planning.sheet_microcycle','Microcycle'), v:esc(mcTxt)});
    if (md || mc?.rival) cells.push({l:tt('daily_planning.sheet_next_match','Next match'), v:`${mc?.rival?esc(mc.rival)+' ':''}${mdBadge}`});
    const _orMap = {introductory:'daily_planning.introductory',activation:'daily_planning.activation',muscle_tension:'daily_planning.muscle_tension',speed:'daily_planning.speed',duration:'daily_planning.duration',recovery:'daily_planning.recovery'};
    const _foMap = {tactical:'daily_planning.tactical',individual:'daily_planning.individual',physical:'daily_planning.physical',sectorial:'daily_planning.sectorial'};
    const or = val('dpOrientation'); if (or) cells.push({l:tt('daily_planning.sheet_orientation','Orientation'), v:esc(_orMap[or]?tt(_orMap[or],cap(or)):cap(or))});
    const fo = val('dpFocus');       if (fo) cells.push({l:tt('daily_planning.sheet_focus','Focus'), v:esc(_foMap[fo]?tt(_foMap[fo],cap(fo)):cap(fo))});
    // El fondo gris del grid ES la línea divisoria, así que toda columna sin celda se
    // imprime como un bloque gris vacío (pasaba con 5 datos: 4 arriba y Focus solo abajo).
    // Por eso las filas se completan siempre: la última reparte las columnas sobrantes
    // entre sus celdas, y con menos de 4 datos el grid usa exactamente esas columnas.
    const _mgCols = Math.min(cells.length, 4) || 1;
    const _mgLast = (cells.length % _mgCols) || _mgCols;   // cuántas celdas quedan en la última fila
    const _mgFrom = cells.length - _mgLast;                // índice donde arranca esa última fila
    const _mgSpan = i => {
      if (i < _mgFrom) return 1;
      const k = i - _mgFrom;
      return Math.floor(_mgCols / _mgLast) + (k < (_mgCols % _mgLast) ? 1 : 0);
    };
    const metaGrid = cells.length ? `<div class="dsp-brk" style="display:grid;grid-template-columns:repeat(${_mgCols},1fr);gap:1px;background:#E7E7E4;border:1px solid #E7E7E4;border-radius:10px;overflow:hidden;margin-bottom:14px">
      ${cells.map((c,i)=>`<div style="grid-column:span ${_mgSpan(i)};background:#fff;padding:8px 11px">
        <div style="font:600 8.5px ${MONO};letter-spacing:.07em;text-transform:uppercase;color:#9CA3AF">${esc(c.l)}</div>
        <div style="font:${c.muted?'500 11.5px':'600 13px'} ${FONT};color:${c.muted?'#5B6470':'#15181D'};margin-top:3px">${c.v}</div>
      </div>`).join('')}
    </div>` : '';

    // Notes band — between meta grid and KPI strip, only when notes exist
    const _notes = (document.getElementById('dpNotes')?.value || '').trim();
    const notesBand = _notes ? `
      <div class="dsp-brk" style="border:1px solid #E7E7E4; border-radius:10px; background:#FBFBFA; padding:9px 13px; margin-top:8px;">
        <div style="font:600 8.5px/1.2 'Geist Mono',monospace; letter-spacing:0.08em; text-transform:uppercase; color:#9CA3AF; margin-bottom:3px;">${esc(tt('daily_planning.sheet_notes','Notes'))}</div>
        <div style="font:500 11.5px/1.45 'Geist',sans-serif; color:#3C4149;">${_notes.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/\n/g,'<br>')}</div>
      </div>` : '';

    // 3) KPI strip
    const actMin = _dpActTotalMin || 0;
    const fieldMin = Math.round((_dpFieldExercises||[]).reduce((s,e)=>s+dpBlockMins(e).total_min,0));
    const total = actMin + fieldMin;
    const au = (parseInt(rpe)||0) * total || 0;
    const kpis = [[tt('daily_planning.sheet_activation','Activation'), actMin?actMin+'′':'—'], [tt('daily_planning.sheet_field','Field'), fieldMin?fieldMin+'′':'—'], [tt('daily_planning.sheet_total','Total'), total?total+'′':'—'], [tt('daily_planning.sheet_duration','Duration'), total?total+'′':'—'], [tt('daily_planning.sheet_planned_au','Planned AU'), au?String(au):'—', true]];
    const kpiStrip = `<div class="dsp-brk" style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#E7E7E4;border:1px solid #E7E7E4;border-radius:10px;overflow:hidden;margin-bottom:16px">
      ${kpis.map(([l,v,acc])=>`<div style="background:#fff;padding:10px 8px;text-align:center">
        <div style="font:700 19px ${MONO};color:${acc?'var(--club-accent)':'#15181D'}">${esc(v)}</div>
        <div style="font:600 8.5px ${MONO};letter-spacing:.07em;text-transform:uppercase;color:#9CA3AF;margin-top:3px">${esc(l)}</div>
      </div>`).join('')}
    </div>`;

    // section title helper
    // break-after:avoid keeps the heading from being orphaned at the foot of a page
    // when its cards flow onto the next one.
    const sectionTitle = (txt, keep) => `<div class="${keep?'dsp-brk-keep':''}" style="display:flex;align-items:center;gap:10px;margin:0 0 9px;break-after:avoid;page-break-after:avoid"><span style="font:700 11px ${FONT};letter-spacing:.07em;text-transform:uppercase;color:#15181D">${esc(txt)}</span><span style="flex:1;height:1px;background:#E7E7E4"></span></div>`;

    // Conditional load (GPS) — print-only strip: projected value + target per active metric (interactive panel stays no-print)
    const _gpsKeys = (typeof dpProjMetricKeys === 'function') ? dpProjMetricKeys() : [];
    const _gpsVals = window._dpProjVals || {};
    const _gpsCells = _gpsKeys.map(k => {
      const m = (window.CM_GPS_METRICS||[]).find(x => x.key === k); if (!m) return '';
      const proj = _gpsVals[k]; const tgtRaw = _dpGpsTargets[k];
      const tgt = (tgtRaw != null && tgtRaw !== '') ? Number(tgtRaw) : null;
      if ((proj == null || proj === 0) && tgt == null) return '';   // skip empty metrics
      const unit = m.avgUnit || '';
      return `<div style="border:1px solid #E7E7E4;border-radius:8px;padding:6px 9px">
        <div style="font:600 8px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">${esc(m.label)}</div>
        <div style="font:700 12px ${MONO};color:#15181D;margin-top:2px">${(proj||0).toLocaleString()}${tgt!=null?` <span style="color:#9CA3AF;font-weight:500">/ ${tgt.toLocaleString()}</span>`:''}${unit?` <span style="font-size:8.5px;color:#8A93A0;font-weight:500">${esc(unit)}</span>`:''}</div>
      </div>`;
    }).filter(Boolean);
    const gpsStrip = _gpsCells.length ? `<div class="dsp-brk" style="margin-bottom:16px">
      ${sectionTitle(tt('daily_planning.sheet_gps_load','Conditional load · GPS'))}
      <div style="display:grid;grid-template-columns:repeat(${Math.min(_gpsCells.length,6)},1fr);gap:8px">${_gpsCells.join('')}</div>
    </div>` : '';

    // 4) Squad — recompute status like dpRenderSquad (same status chain: other_team/day_off/rehab included)
    const avMap = window._dpAvMap || {};
    const statusOf = p => {
      const av=avMap[p.id], inj=_dpInjMap[p.id]; let cls='', reason='';
      if (inj){ cls='partial'; reason=inj.body_area||inj.injury_type||'inj'; }
      if (av?.status==='away'){ cls='away'; reason=av.notes||'away'; }
      else if (av?.status==='other_team'){ cls='unavailable'; reason=tt('daily_planning.with_other_team','With another team'); }
      else if (av?.status==='unavailable'){ cls='unavailable'; reason=av.notes||'out'; }
      else if (av?.status==='day_off'){ cls='dayoff'; reason=av.notes||tt('daily_planning.day_off','Day off'); }
      else if (av?.status==='rehab'){ cls='rehab'; reason=av.notes||tt('daily_planning.rehab','Rehab'); }
      else if (av?.status==='injured'){ cls='injured'; reason=av.notes||'inj'; }
      else if (av?.status==='sick'){ cls='sick'; reason=av.notes||'sick'; }
      else if (av?.status==='partial'||av?.status==='limited'){ if(!cls){ cls='partial'; reason=av.notes||reason||'partial'; } }
      return { cls, reason };
    };
    const lastName = p => (`${p.first_name||''} ${p.last_name||''}`.trim()).split(' ').pop() || '';
    const trainees=[], outs=[];
    (_dpPlayers||[]).forEach(p => { (['','partial'].includes(statusOf(p).cls) ? trainees : outs).push(p); });
    // Grupo «Rehab» aparte, igual que en pantalla: estado manual 'rehab', o injured con plan activo / tratamiento del día.
    const _isRehabP = p => {
      const cls = statusOf(p).cls;
      if (cls === 'rehab') return true;
      return cls === 'injured' && (!!_dpRehabMap[p.id] || (window._dpDayTreatIds && window._dpDayTreatIds.has(String(p.id))));
    };
    const rehabs = [];
    for (let i = outs.length - 1; i >= 0; i--) { if (_isRehabP(outs[i])) rehabs.unshift(outs.splice(i, 1)[0]); }
    // Convocatoria por sesión (igual que dpRenderSquad): con grupo definido, los
    // disponibles fuera del grupo se imprimen aparte como "Other session".
    const _pParts = window._dpSessParts;
    const otherSess = [];
    if (_pParts) {
      for (let i = trainees.length - 1; i >= 0; i--) {
        if (!_pParts.has(String(trainees[i].id))) otherSess.unshift(trainees.splice(i, 1)[0]);
      }
    }
    const groups = {};
    trainees.forEach(p => { const g=_DP_POS_GROUP[(p.position||'').toUpperCase()]||{l:(p.position||'?').toUpperCase(),o:9}; (groups[g.l]=groups[g.l]||{o:g.o,list:[]}).list.push(p); });
    const posBadge = lbl => `<span style="display:inline-block;font:700 9px ${MONO};letter-spacing:.04em;color:#fff;background:var(--club-accent);border-radius:4px;padding:2px 6px;margin-right:8px;white-space:nowrap">${esc(lbl)}</span>`;
    const _dpAdaptMap = (typeof _dpDayAdaptMap !== 'undefined') ? _dpDayAdaptMap : {};
    const isAmber = p => statusOf(p).cls === 'partial' || !!_dpAdaptMap[p.id];
    const traineeRows = Object.entries(groups).sort((a,b)=>a[1].o-b[1].o).map(([lbl,{list}])=>
      `<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:5px;flex-wrap:wrap">${posBadge(`${lbl} · ${list.length}`)}
        <span style="font:400 12px ${FONT}">${list.map(p=>{ const amber=isAmber(p); const numClr=amber?'#8a5e12':'#9CA3AF'; const nameClr=amber?'#7C2D12':'#15181D'; return `<span style="white-space:nowrap;margin-right:10px"><span style="color:${numClr};font-family:${MONO};font-size:10.5px">${esc(p.number??'—')}</span> <b style="font-weight:600;color:${nameClr}">${esc(lastName(p))}</b>${amber?' <span style="font-size:8px;color:#b5851f">●</span>':''}</span>`;}).join('')}</span>
      </div>`).join('');
    const otherRow = otherSess.length ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E7E7E4">
      <span style="font:700 9px ${MONO};color:#8A93A0;margin-right:8px;text-transform:uppercase">${esc(tt('daily_planning.other_session_count', `Other session · ${otherSess.length}`, {count: otherSess.length}))}</span>
      <span style="font:400 11.5px ${FONT};color:#8A93A0">${otherSess.map(p=>`<span style="margin-right:10px"><span style="font-family:${MONO};font-size:10px">${esc(p.number??'—')}</span> ${esc(lastName(p))}</span>`).join('')}</span>
    </div>` : '';
    const rehabRow = rehabs.length ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E7E7E4">
      <span style="font:700 9px ${MONO};color:#EA7A28;margin-right:8px;text-transform:uppercase">${esc(tt('daily_planning.rehab_count', `Rehab · ${rehabs.length}`, {count: rehabs.length}))}</span>
      <span style="font:400 11.5px ${FONT};color:#8A93A0">${rehabs.map(p=>{const inj=_dpInjMap[p.id]; const r=inj?.body_area||inj?.injury_type||''; return `<span style="margin-right:10px"><span style="font-family:${MONO};font-size:10px">${esc(p.number??'—')}</span> ${esc(lastName(p))}${r?` · ${esc(r)}`:''}</span>`;}).join('')}</span>
    </div>` : '';
    const outRow = outs.length ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E7E7E4">
      <span style="font:700 9px ${MONO};color:#C0392B;margin-right:8px;text-transform:uppercase">${esc(tt('daily_planning.sheet_out', `Out · ${outs.length}`, {count: outs.length}))}</span>
      <span style="font:400 11.5px ${FONT};color:#8A93A0">${outs.map(p=>{const r=statusOf(p).reason; return `<span style="margin-right:10px;text-decoration:line-through;text-decoration-color:#C9CDD3"><span style="font-family:${MONO};font-size:10px">${esc(p.number??'—')}</span> ${esc(lastName(p))}${r?` · ${esc(r)}`:''}</span>`;}).join('')}</span>
    </div>` : '';
    let avCt=0,partCt=0,awayCt=0,dayOffCt=0,rehabCt=0;
    (_dpPlayers||[]).forEach(p => { const av=avMap[p.id], inj=_dpInjMap[p.id];
      if (av?.status==='away') awayCt++;
      else if (av?.status==='day_off') dayOffCt++;
      else if (av?.status==='rehab') rehabCt++;
      else if (av?.status==='injured') { if (_dpRehabMap[p.id] || (window._dpDayTreatIds && window._dpDayTreatIds.has(String(p.id)))) rehabCt++; }
      else if (['other_team','unavailable','sick'].includes(av?.status)) { /* out */ }
      else if (inj || av?.status==='partial' || av?.status==='limited') partCt++;
      else avCt++;
    });
    const availN = avCt + partCt;
    // Physio adaptations — one thin line each, just below the squad. Amber dot ties them to the ● in the roster.
    const physioLines = (_dpPhysioRows || []).length ? `<div style="margin-top:7px;padding-top:6px;border-top:1px solid #E7E7E4;display:flex;flex-direction:column;gap:3px">
      ${(_dpPhysioRows||[]).map(t => { const pl=t.players||{}; const nm=lastName(pl)||(pl.last_name||pl.first_name||'—'); const note=(t.adaptation_notes||'').trim(); return `<div style="font:400 10px/1.4 ${FONT};color:#5B6470"><span style="font-size:7px;color:#b5851f;vertical-align:middle">●</span> <span style="font-family:${MONO};font-size:9px;color:#9CA3AF">${esc(pl.number??'—')}</span> <b style="font-weight:600;color:#7C2D12">${esc(nm)}</b> <span style="color:#C9CDD3">—</span> ${esc(note)}</div>`; }).join('')}
    </div>` : '';
    const summaryParts = [tt('daily_planning.sheet_squad_summary', `${availN} available · ${partCt} partial · ${awayCt} away`, {avail: availN, partial: partCt, away: awayCt})];
    if (dayOffCt) summaryParts.push(tt('daily_planning.n_day_off', `${dayOffCt} day off`, {count: dayOffCt}));
    if (rehabCt)  summaryParts.push(tt('daily_planning.n_rehab', `${rehabCt} in rehab`, {count: rehabCt}));
    const squadBlock = (_dpPlayers||[]).length ? `<div style="margin-bottom:16px">
      ${sectionTitle(tt('daily_planning.sheet_squad_available', `Squad · ${availN} available`, {count: availN}))}
      ${traineeRows}${otherRow}${rehabRow}${outRow}
      <div style="font:500 10.5px ${MONO};color:#8A93A0;margin-top:6px">${esc(summaryParts.join(' · '))}</div>
      ${physioLines}
    </div>` : '';

    // Shared diagram-card renderer for both Field and Activation
    const orientShort = e => { const o=(e.calc_orientation||'').toUpperCase(); const m=_DP_ORIENT[o]; return m?m.short:(o?o.slice(0,3):''); };
    const printExCard = e => {
      const tag = e.exercise_id ? dpCatLabel((e.gym_exercises?.category || 'strength').toLowerCase()) : orientShort(e);
      const meta = [];
      if (e.players_count) meta.push(`${e.players_count} pl`);
      if (e.m2_per_player) meta.push(`${e.m2_per_player} m²/p`);
      if (e.field_width && e.field_height) meta.push(`${e.field_width}×${e.field_height} m`);
      const seriesMode = !!(e.series && e.work_time);
      const totalMin = seriesMode ? Math.round(dpBlockMins(e).total_min) : (e.duration || null);
      const repsMode = !seriesMode && !!e.exercise_id && e.series != null && e.reps != null;
      const workLine = seriesMode
        ? (e.rest_time
            ? tt('daily_planning.sheet_work_rest_line', `${e.series} × ${esc(e.work_time)} work + ${esc(e.rest_time)} rest`, {series: e.series, work: esc(e.work_time), rest: esc(e.rest_time)})
            : tt('daily_planning.sheet_work_line', `${e.series} × ${esc(e.work_time)} work`, {series: e.series, work: esc(e.work_time)}))
        : repsMode
        ? `${e.series} × ${e.reps} ${tt('daily_planning.reps_short','reps')}`
        : '';
      // Same info the on-screen card shows: Drill Designer objective + description, plus per-session notes (all, not one-or-the-other).
      const dn  = _dpDescCache[e.planner_exercise_id] || null;
      const obj = (dn?.objective || '').trim();
      const dsc = (dn?.description || e.gym_exercises?.description || '').trim();
      const note = (e.notes || '').trim();
      const grps = _dpExGroups(e).filter(g => (g.players||[]).length);
      const playersLine = grps.length
        ? `<div style="margin-top:5px;display:flex;flex-direction:column;gap:3px">${grps.map(g => {
            const ps = (g.players||[]).map(id => _dpPlayerById(id)).filter(Boolean);
            return `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
              <span style="display:inline-flex;align-items:center;gap:4px;font:700 9px ${MONO};color:#15181D"><span style="width:8px;height:8px;border-radius:50%;background:${g.color||'#888'};flex-shrink:0"></span>${esc(g.name||'')}</span>
              ${ps.map(p => `<span style="display:inline-flex;align-items:center;gap:3px;background:#F3F4F6;border:1px solid #E7E7E4;border-radius:4px;padding:1px 5px;font:500 9.5px ${FONT};color:#15181D"><b style="font:600 8px ${MONO};color:#6B7280">${p.number ?? '—'}</b> ${esc(_dpPlayerShort(p))}</span>`).join('')}
            </div>`;
          }).join('')}</div>`
        : '';
      const dur = totalMin ? totalMin + '′' : '';
      const src = _img(e);
      const phBg = e.exercise_id ? '#2B3038' : '#1F7A43';   // strength → neutral slate, field → pitch green
      const thumb = src ? `<img src="${esc(src)}" crossorigin="anonymous" style="display:block;width:100%;height:auto">`
                        : `<div style="width:100%;height:124px;background:${phBg}"></div>`;
      return `<div class="dsp-brk" style="border:1px solid #E7E7E4;border-radius:10px;overflow:hidden;break-inside:avoid">
        <div style="position:relative;background:${phBg};line-height:0">${thumb}
          ${tag?`<span style="position:absolute;top:6px;left:6px;background:var(--club-accent);color:#fff;font:700 8.5px ${MONO};letter-spacing:.05em;padding:2px 6px;border-radius:4px;line-height:1.2">${esc(tag)}</span>`:''}
          ${dur?`<span style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55);color:#fff;font:600 9px ${MONO};padding:2px 6px;border-radius:4px;line-height:1.2">${esc(dur)}</span>`:''}
        </div>
        <div style="padding:8px 10px 9px">
          <div style="font:600 12.5px ${FONT};color:#15181D">${esc(e.name||'—')}</div>
          ${meta.length?`<div style="font:400 10px ${MONO};color:#8A93A0;margin-top:3px">${esc(meta.join(' · '))}</div>`:''}
          ${workLine ? `<div style="font:500 10.5px ${MONO};color:#15803D;margin-top:4px">${esc(workLine)}</div>` : ''}
          ${obj ? `<div style="font:400 10.5px/1.4 ${FONT};color:#5B6470;margin-top:4px"><b style="font-weight:600;color:#3C4149">${esc(tt('daily_planning.objective_label','Objective'))}:</b> ${esc(obj)}</div>` : ''}
          ${dsc ? `<div style="font:400 10.5px/1.4 ${FONT};color:#5B6470;margin-top:${obj?'2px':'4px'}">${esc(dsc)}</div>` : ''}
          ${note ? `<div style="font:400 10.5px/1.4 ${FONT};color:#7C5A12;margin-top:4px;padding:4px 7px;background:#FBF6E9;border-radius:6px">${esc(note)}</div>` : ''}
          ${playersLine}
        </div>
      </div>`;
    };

    // Compact strength (gym) tile for the sheet — square thumb + name + series×reps, kept small so several fit per row.
    const printStrCard = e => {
      const gx  = e.gym_exercises || null;
      const nm  = e.name || gx?.name || '—';
      const cat = (gx?.category || 'strength').toLowerCase();
      const lbl = dpCatLabel(cat);
      const reps = (e.series && e.work_time) ? `${e.series} × ${esc(e.work_time)}`
                 : (e.series != null && e.reps != null && e.reps !== '') ? `${e.series} × ${e.reps} ${tt('daily_planning.reps_short','reps')}` : '';
      const desc = (gx?.description || '').trim();
      const noteS = (e.notes || '').trim();
      const src  = _img(e);
      const thumb = src
        ? `<img src="${esc(src)}" crossorigin="anonymous" style="width:100%;height:auto;display:block">`
        : `<div style="width:100%;height:88px;background:#2B3038;color:#C7CDD4;display:flex;align-items:center;justify-content:center;font:700 20px ${MONO}">${esc(mono(nm))}</div>`;
      return `<div class="dsp-brk" style="border:1px solid #E7E7E4;border-radius:9px;overflow:hidden;break-inside:avoid">
        <div style="position:relative;height:88px;overflow:hidden;background:#EEF0F2;line-height:0">${thumb}
          ${lbl?`<span style="position:absolute;top:5px;left:5px;background:var(--club-accent);color:#fff;font:700 8px ${MONO};letter-spacing:.04em;padding:2px 5px;border-radius:4px;line-height:1.2">${esc(lbl)}</span>`:''}
        </div>
        <div style="padding:6px 8px 8px">
          <div style="font:600 11px/1.25 ${FONT};color:#15181D">${esc(nm)}</div>
          ${reps?`<div style="font:600 10px ${MONO};color:#15803D;margin-top:3px">${esc(reps)}</div>`:''}
          ${desc?`<div style="font:400 9.5px/1.35 ${FONT};color:#5B6470;margin-top:3px">${esc(desc)}</div>`:''}
          ${noteS?`<div style="font:400 9.5px/1.35 ${FONT};color:#7C5A12;margin-top:3px;padding:3px 6px;background:#FBF6E9;border-radius:5px">${esc(noteS)}</div>`:''}
        </div>
      </div>`;
    };
    // Sub-section label inside a section (e.g. "Strength").
    const subTitle = t => `<div style="display:flex;align-items:center;gap:6px;margin:2px 0 8px;font:700 9.5px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#8A93A0"><span style="width:14px;height:2px;background:var(--club-accent);border-radius:2px"></span>${esc(t)}</div>`;
    const strGrid = items => items.length ? `${subTitle(tt('daily_planning.strength','Strength'))}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${items.map(printStrCard).join('')}</div>` : '';

    // 5) Activation — strength tiles first (compact), then field-activation diagram cards
    const acts = window._dpActItems || [];
    const { field: actField, strength: actStr } = dpSplitByKind(acts);
    const actBlock = acts.length ? `<div style="margin-bottom:16px">
      ${sectionTitle(tt('daily_planning.sheet_activation_hdr', `Activation · ${acts.length} · ${actMin} min`, {count: acts.length, min: actMin}), true)}
      ${strGrid(actStr)}
      ${actField.length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:${actStr.length?'12px':'0'}">${actField.map(printExCard).join('')}</div>` : ''}
    </div>` : '';

    // 6) Field exercises — field diagram cards, then a separate strength sub-section
    const fx = _dpFieldExercises || [];
    const { field: fxField, strength: fxStr } = dpSplitByKind(fx);
    const fieldBlock = fx.length ? `<div style="margin-bottom:16px">
      ${sectionTitle(tt('daily_planning.sheet_field_hdr', `Field exercises · ${fx.length} · ${fieldMin} min`, {count: fx.length, min: fieldMin}), true)}
      ${fxField.length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${fxField.map(printExCard).join('')}</div>` : ''}
      ${fxStr.length ? `<div style="margin-top:${fxField.length?'12px':'0'}">${strGrid(fxStr)}</div>` : ''}
    </div>` : '';

    // 6b) Goalkeeper training — starts on its own page (.dsp-page). Skipped when empty or hidden by the user.
    const gks = window._dpGkItems || [];
    const gkMin = gks.reduce((s, a) => s + (a.duration || 0), 0);
    const gkBlock = (gks.length && !window._dpGkHidden) ? `<div class="dsp-page" style="break-before:page;page-break-before:always;margin-bottom:16px">
      ${sectionTitle(tt('daily_planning.sheet_goalkeepers_hdr', `Goalkeeper training · ${gks.length} · ${gkMin} min`, {count: gks.length, min: gkMin}), true)}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${gks.map(printExCard).join('')}</div>
    </div>` : '';

    // 7) Footer
    const midParts = [];
    if (mc?.name) midParts.push(mc.name);
    if (md) midParts.push(`${tt('daily_planning.md_label','MD')} ${md}`);
    if (mc?.rival) midParts.push(tt('daily_planning.vs_rival', `vs ${mc.rival}`, {rival: mc.rival}));
    const footer = `<div style="margin-top:auto;display:flex;justify-content:space-between;gap:10px;padding-top:9px;border-top:1px solid #E7E7E4;font:500 9.5px ${MONO};color:#A3AAB3">
      <span>${esc(tt('daily_planning.sheet_footer','ClavaMetrics · Daily Session Plan'))}</span>
      <span>${esc(midParts.join(' · '))}</span>
      <span>${esc(clubName)}${teamName?' · '+esc(teamName):''}</span>
    </div>`;

    // The sheet lives inside a table whose empty thead/tfoot repeat on every printed
    // page: browsers reserve their height per page, giving a top+bottom margin that
    // survives even the print dialog's "None" margins option (which zeroes @page).
    // html2canvas (Export PDF) still targets .dsp-sheet directly and adds its own inset.
    // Natural order on page 1: club header, session data, THEN the squad availability band.
    // In Export PDF, #dspSquadBand is captured and re-drawn at the top of pages 2+ (before
    // the exercises) as a repeated reference header. Native print just flows it once.
    const squadBand = squadBlock ? `<div id="dspSquadBand" class="dsp-brk">${squadBlock}</div>` : '';
    host.innerHTML = `<table style="width:794px; border-collapse:collapse; margin:0 auto; background:#fff">
      <thead><tr><td style="padding:0"><div style="height:11mm"></div></td></tr></thead>
      <tbody><tr><td style="padding:0; vertical-align:top">
        <div class="dsp-sheet" style="--club-accent:${accent}; width:794px; min-height:1035px; background:#fff; padding:0 42px; box-sizing:border-box; font:400 13px/1.5 ${FONT}; color:#15181D; display:flex; flex-direction:column; margin:0 auto">
          ${head}${sessionLine}${metaGrid}${notesBand}${kpiStrip}${gpsStrip}${squadBand}${actBlock}${fieldBlock}${gkBlock}${footer}
        </div>
      </td></tr></tbody>
      <tfoot><tr><td style="padding:0"><div style="height:11mm"></div></td></tr></tfoot>
    </table>`;
  } catch (e) {
    console.warn('dpRenderPrintSheet failed', e);
  }
}

async function deleteExercise(seid) {
  const { error } = await window.sb.from('session_exercises').delete().eq('id', seid).eq('club_id', _dpClubId);
  if (!error) { await loadSessionExercises(_dpCurrentSessionId); await loadActivationActivities(_dpCurrentSessionId); await loadGoalkeeperActivities(_dpCurrentSessionId); }
}

// ── From library (Planner exercises) ──
async function openLibModal(mode) {
  _libMode = mode || 'main';
  const title = _libMode === 'activation' ? tt('daily_planning.activation_exercises','Activation exercises') : _libMode === 'goalkeepers' ? tt('daily_planning.goalkeeper_exercises','Goalkeeper exercises') : tt('daily_planning.exercises_library','Exercises Library');
  document.querySelector('#libBackdrop [style*="font:600 14px"]').textContent = title;
  document.getElementById('libBackdrop').style.display = 'flex';
  document.getElementById('libSearch').value = '';
  dpLibSetOrient(_libMode === 'goalkeepers' ? 'GK' : '');   // default the type filter (GK section → goalkeeper exercises)
  document.getElementById('libFooter').textContent = tt('common.loading','Loading…');
  _libExercises = [];
  let q = window.sb.from('exercises')
    .select('id,name,players_count,field_width,field_height,duration,orientation,series,work_time,rest_time,dose_mode,reps,folder_id,is_goalkeeper,preview_png,preview_path,source_type,visible_teams,origin_team_id')
    .eq('club_id', _dpClubId).order('name');
  const { data, error } = await q;
  _libFolders = window.CMFolders ? await window.CMFolders.load('field') : [];
  (function () {
    const fsel = document.getElementById('libFolder');
    if (!fsel) return;
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const list = window.CMFolders ? window.CMFolders.flatten(_libFolders) : [];
    fsel.innerHTML = `<option value="">${esc(tt('folders.all_folders','All folders'))}</option>`
      + `<option value="__none__">${esc(window.CMFolders ? window.CMFolders.noneLabel() : 'No folder')}</option>`
      + list.map(f => `<option value="${f.id}">${(f.depth?'  '.repeat(f.depth):'')}${esc(f.name)}</option>`).join('');
    fsel.style.display = _libFolders.length ? '' : 'none';
  })();
  if (error?.code === '42P01') {
    document.getElementById('libList').innerHTML = `<div style="padding:24px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.run_sql_migration','Run the SQL migration to enable the Planner library.')}</div>`;
    document.getElementById('libFooter').textContent = '—';
    return;
  }
  // Team policy: the picker only lists exercises visible to this page's team
  // (its own + shared with it; visible_teams NULL/[] = whole club).
  _libExercises = (data || []).filter(ex => window.cmExVisibleForTeam(ex, _dpTeamId));
  // Which library exercises have associated GPS data → green tick in the picker.
  // One batch query over the club's exercises; cached for the session.
  if (_dpGpsExSet === null) {
    try {
      const ids = _libExercises.map(e => e.id);
      const { data: gps } = ids.length
        ? await window.sb.from('v_exercise_gps_profile').select('exercise_id').in('exercise_id', ids)
        : { data: [] };
      _dpGpsExSet = new Set((gps||[]).map(r => r.exercise_id));
    } catch(_) { _dpGpsExSet = new Set(); }
  }
  // Resolve a display image per exercise: signed Storage URL (1h) with base64 fallback (mirrors Drill Designer).
  try {
    const paths = _libExercises.filter(e => e.preview_path).map(e => e.preview_path);
    if (paths.length) {
      const { data: urls } = await window.sb.storage.from('drill-previews').createSignedUrls(paths, 3600);
      const signed = {};
      (urls||[]).forEach(u => { if (u && u.path && u.signedUrl) signed[u.path] = u.signedUrl; });
      _libExercises.forEach(e => { e._previewImg = e.preview_path ? (signed[e.preview_path] || e.preview_png || null) : (e.preview_png || null); });
    } else {
      _libExercises.forEach(e => { e._previewImg = e.preview_png || null; });
    }
  } catch(_) { _libExercises.forEach(e => { e._previewImg = e.preview_png || null; }); }
  if (_libMode === 'activation') {
    const isAct = e => (e.orientation || '').toUpperCase() === 'ACTIVATION';
    _libExercises = [..._libExercises].sort((a,b) => (isAct(b)?1:0) - (isAct(a)?1:0));  // activation first, order otherwise preserved
  }
  filterLib();
}
function closeLibModal() { document.getElementById('libBackdrop').style.display = 'none'; }
// Filter the library picker by exercise type (orientation). '' = all.
function dpLibSetOrient(val) {
  _libOrient = val || '';
  document.querySelectorAll('#libTypeBar .dp-lib-chip').forEach(b =>
    b.classList.toggle('is-on', (b.dataset.orient || '') === _libOrient));
  filterLib();
}
// Effective type of a library exercise: stored orientation, else derived from m²/player (matches the card).
function _dpLibOrient(e) {
  const area = (e.field_width && e.field_height) ? e.field_width * e.field_height : null;
  const m2   = (area && e.players_count > 0) ? Math.round(area / e.players_count) : null;
  return (e.orientation || _dpCalcOrientFromM2(m2) || '').toUpperCase();
}
function filterLib() {
  const q   = (document.getElementById('libSearch').value || '').toLowerCase();
  const fsel = (document.getElementById('libFolder')?.value) || '';
  let fil = q ? _libExercises.filter(e => (e.name||'').toLowerCase().includes(q)) : _libExercises.slice();
  if (fsel === '__none__') fil = fil.filter(e => !e.folder_id);
  else if (fsel) fil = fil.filter(e => e.folder_id === fsel);
  if (_libOrient === 'GK') fil = fil.filter(e => e.is_goalkeeper);
  else if (_libOrient) fil = fil.filter(e => _dpLibOrient(e) === _libOrient);
  const list = document.getElementById('libList');
  document.getElementById('libFooter').textContent = tt('daily_planning.n_in_library', `${fil.length} exercise${fil.length !== 1 ? 's' : ''} in library`, {count: fil.length});
  if (!fil.length) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_exercises_found','No exercises found. Create some in <a href="Planner.html" style="color:var(--cm-accent);text-decoration:none">Drill Designer</a>.')}</div>`;
    return;
  }
  const _libCard = e => {
    const area    = (e.field_width && e.field_height) ? e.field_width * e.field_height : null;
    const m2      = (area && e.players_count > 0) ? Math.round(area / e.players_count) : null;
    const calcO   = _dpCalcOrientFromM2(m2);
    const dispO   = e.orientation || calcO;
    const meta    = dispO ? _DP_ORIENT[dispO] : null;
    const tagCls  = meta ? meta.tagCls : 'tac';
    const tagLbl  = meta ? meta.short  : 'FIELD';
    const dur     = e.duration ? `${e.duration}′` : null;
    const blocks  = (e.series && e.work_time) ? `${e.series}×${e.work_time}` : null;
    const players = e.players_count || null;
    const fieldStr = (e.field_width && e.field_height) ? `${e.field_width}×${e.field_height}m` : null;
    const meta2   = [players ? tt('daily_planning.players_meta', `${players} players`, {count: players}) : null, m2 ? `${m2} ${tt('daily_planning.m2_p','m²/p')}` : null, fieldStr].filter(Boolean).join(' · ');
    const img = e._previewImg || e.preview_png || null;
    return `<div onclick="addPlannerExercise('${e.id}')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:background .12s" onmouseover="this.style.background='var(--cm-bg-soft)'" onmouseout="this.style.background=''">
      <div style="flex-shrink:0;width:64px;height:64px;border-radius:8px;overflow:hidden;background:#2f7d4c;border:1px solid var(--cm-border-soft);display:flex;align-items:center;justify-content:center">
        ${img ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">` : `<i class="ti ti-vector-triangle" style="font-size:22px;color:rgba(255,255,255,.55)"></i>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font:500 13.5px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);display:flex;align-items:center;gap:6px">${_dpEsc(e.name || tt('daily_planning.untitled','Untitled'))}${(_dpGpsExSet && _dpGpsExSet.has(e.id)) ? `<i class="ti ti-circle-check-filled" title="${tt('daily_planning.has_gps_short','Has GPS data')}" style="font-size:14px;color:var(--cm-success,#16a34a);flex-shrink:0"></i>` : ''}</div>
        <div style="font:500 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="dp-ex-tag ${tagCls}" style="position:static;transform:none;font-size:9.5px">${tagLbl}</span>
          ${dur    ? `<span><i class="ti ti-clock" style="font-size:10px"></i> ${dur}</span>` : ''}
          ${blocks ? `<span>${blocks}</span>` : ''}
          ${meta2  ? `<span style="color:var(--cm-fg-faint)">${meta2}</span>` : ''}
        </div>
      </div>
      <i class="ti ti-plus" style="font-size:16px;color:var(--cm-accent);flex-shrink:0"></i>
    </div>`;
  };
  // Group by folder ("No folder" first, then folders in tree order). Flat when 0/1 group or a folder is already selected.
  const _f = _libFolders || [];
  if (!_f.length || fsel) { list.innerHTML = fil.map(_libCard).join(''); return; }
  const order = window.CMFolders ? window.CMFolders.flatten(_f) : _f.map(x => ({ ...x, depth: 0 }));
  const known = new Set(order.map(x => x.id));
  const buckets = new Map();
  fil.forEach(e => { const k = (e.folder_id && known.has(e.folder_id)) ? e.folder_id : ''; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(e); });
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const head = (lbl, n, depth) => `<div style="display:flex;align-items:center;gap:6px;margin:${depth?8:2}px 0 2px;padding:2px 12px 2px ${12+(depth||0)*12}px;font:700 10px/1 var(--cm-font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cm-fg-muted)"><i class="ti ti-folder" style="font-size:12px"></i>${esc(lbl)}<span style="font-weight:500;opacity:.7">${n}</span></div>`;
  const groups = [];
  const none = buckets.get('');
  if (none && none.length) groups.push({ label: window.CMFolders.noneLabel(), depth: 0, items: none });
  order.forEach(x => { const items = buckets.get(x.id); if (items && items.length) groups.push({ label: x.name, depth: x.depth || 0, items }); });
  list.innerHTML = groups.length <= 1
    ? fil.map(_libCard).join('')
    : groups.map(g => head(g.label, g.items.length, g.depth) + g.items.map(_libCard).join('')).join('');
}
async function addPlannerExercise(exerciseId) {
  if (!await dpEnsureSession()) return;
  const ex  = _libExercises.find(e => e.id === exerciseId);
  const phase = _libMode === 'activation' ? 'activation' : _libMode === 'goalkeepers' ? 'goalkeepers' : 'main';
  const pos = dpNextPosition(phase);   // always append to the end of its own phase
  const area = (ex?.field_width && ex?.field_height) ? ex.field_width * ex.field_height : null;
  const m2   = (area && ex?.players_count > 0) ? Math.round(area / ex.players_count) : null;
  const { error } = await window.sb.from('session_exercises').insert({
    club_id:             _dpClubId,
    session_id:          _dpCurrentSessionId,
    planner_exercise_id: exerciseId,
    name:                ex?.name        || null,
    phase,
    duration:            ex?.duration    || null,
    series:              ex?.series      || null,
    work_time:           ex?.work_time   || null,
    rest_time:           ex?.rest_time   || null,
    dose_mode:           ex?.dose_mode   || null,
    reps:                ex?.reps        || null,
    position:            pos,
    field_width:         ex?.field_width  || null,
    field_height:        ex?.field_height || null,
    players_count:       ex?.players_count || null,
    m2_per_player:       m2,
    calc_orientation:    _dpCalcOrientFromM2(m2) || ex?.orientation || null
  });
  if (error) {
    console.error('addPlannerExercise insert error:', error);
    alert(tt('daily_planning.add_exercise_failed','Add exercise failed:') + '\n' + (error.message||'') + '\n' + (error.details||'') + '\n' + (error.hint||'') + '\ncode: ' + (error.code||''));
    return;
  }
  closeLibModal();
  if (phase === 'activation') await loadActivationActivities(_dpCurrentSessionId);
  else if (phase === 'goalkeepers') await loadGoalkeeperActivities(_dpCurrentSessionId);
  else await loadSessionExercises(_dpCurrentSessionId);
}

// ── Strength (gym) library picker ──────────────────────────────────────────
// Reuses the club's Gym Library (gym_exercises). Adds picks to session_exercises
// via the exercise_id FK (phase = current strip), so a strength drill can live
// inside Activation or Field exercises. Cards render the exercise photo/video when
// present, otherwise a linear name + series×reps + description.
let _gymLibMode = 'activation', _gymLibCat = '', _gymLibExercises = [];
const _dpGymImgCache = {};   // media_ref -> signed URL (shared with the card renderer)
const GYM_CAT_ORDER = ['strength','power','plyo','speed','mobility','core','prehab','other'];

async function openGymLibModal(mode) {
  _gymLibMode = mode || 'activation';
  _gymLibCat = '';
  document.getElementById('gymLibBackdrop').style.display = 'flex';
  document.getElementById('gymLibSearch').value = '';
  document.getElementById('gymLibFooter').textContent = tt('common.loading','Loading…');
  document.getElementById('gymLibList').innerHTML = '';
  _gymLibExercises = [];
  const { data, error } = await window.sb.from('gym_exercises')
    .select('id,name,category,muscle_group,description,complexity,media_type,media_ref,video_id')
    .eq('club_id', _dpClubId).order('name');
  if (error) {
    document.getElementById('gymLibList').innerHTML = `<div style="padding:24px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_strength_found','No strength exercises found.')}</div>`;
    document.getElementById('gymLibFooter').textContent = '—';
    return;
  }
  _gymLibExercises = data || [];
  // resolve signed URLs for image thumbnails (cheap; keeps the picker visual)
  const paths = [...new Set(_gymLibExercises.filter(e => e.media_type === 'image' && e.media_ref).map(e => e.media_ref))]
    .filter(p => !(p in _dpGymImgCache));
  if (paths.length) {
    const { data: urls } = await window.sb.storage.from('gym-exercise-media').createSignedUrls(paths, 3600);
    (urls || []).forEach(u => { if (u && u.path) _dpGymImgCache[u.path] = u.signedUrl; });
  }
  dpBuildGymCatBar();
  filterGymLib();
}
function closeGymLibModal() { document.getElementById('gymLibBackdrop').style.display = 'none'; }
function gymLibSetCat(val) {
  _gymLibCat = val || '';
  document.querySelectorAll('#gymLibTypeBar .dp-lib-chip').forEach(b =>
    b.classList.toggle('is-on', (b.dataset.cat || '') === _gymLibCat));
  filterGymLib();
}
function dpBuildGymCatBar() {
  const bar = document.getElementById('gymLibTypeBar');
  const present = new Set(_gymLibExercises.map(e => (e.category || 'other').toLowerCase()));
  const cats = [...GYM_CAT_ORDER.filter(c => present.has(c)), ...[...present].filter(c => !GYM_CAT_ORDER.includes(c)).sort()];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  let html = `<button type="button" class="dp-lib-chip is-on" data-cat="" onclick="gymLibSetCat('')" data-i18n="common.all">All</button>`;
  html += cats.map(c => `<button type="button" class="dp-lib-chip" data-cat="${c}" onclick="gymLibSetCat('${c}')">${cap(c)}</button>`).join('');
  bar.innerHTML = html;
  if (window.CM_I18N && CM_I18N.applyTo) CM_I18N.applyTo(bar);
}
function _gymThumbSrc(e) {
  if (e.media_type === 'image' && e.media_ref && _dpGymImgCache[e.media_ref]) return _dpGymImgCache[e.media_ref];
  if (e.video_id) return `https://img.youtube.com/vi/${e.video_id}/mqdefault.jpg`;
  return null;
}
function filterGymLib() {
  const q = (document.getElementById('gymLibSearch').value || '').toLowerCase();
  let fil = _gymLibExercises.slice();
  if (q) fil = fil.filter(e => (e.name||'').toLowerCase().includes(q) || (e.muscle_group||'').toLowerCase().includes(q));
  if (_gymLibCat) fil = fil.filter(e => (e.category || 'other').toLowerCase() === _gymLibCat);
  const list = document.getElementById('gymLibList');
  document.getElementById('gymLibFooter').textContent = tt('daily_planning.n_in_library', `${fil.length} exercises in library`, {count: fil.length});
  if (!fil.length) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--cm-fg-muted);font:var(--cm-body-sm)">${tt('daily_planning.no_strength_found','No strength exercises found.')}</div>`;
    return;
  }
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const card = e => {
    const cat = (e.category || 'other').toLowerCase();
    const cls = CAT_CLS[cat] || 'oth';
    const lbl = dpCatLabel(cat);
    const thumb = _gymThumbSrc(e);
    const meta2 = [e.muscle_group ? esc(e.muscle_group) : null, e.complexity ? esc(e.complexity) : null].filter(Boolean).join(' · ');
    return `<div onclick="addGymExercise('${e.id}')" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .12s" onmouseover="this.style.background='var(--cm-bg-soft)'" onmouseout="this.style.background=''">
      <div style="flex-shrink:0;width:44px;height:44px;border-radius:7px;overflow:hidden;background:var(--cm-bg-soft);display:flex;align-items:center;justify-content:center;position:relative">
        ${thumb ? `<img src="${esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover">${e.video_id && !( e.media_type==='image' ) ? '<i class="ti ti-player-play-filled" style="position:absolute;font-size:14px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)"></i>' : ''}` : `<i class="ti ti-barbell" style="font-size:18px;color:var(--cm-fg-faint)"></i>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font:500 13.5px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong)">${esc(e.name || tt('daily_planning.untitled','Untitled'))}</div>
        <div style="font:500 11px/1 var(--cm-font-mono);color:var(--cm-fg-muted);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="dp-ex-tag ${cls}" style="position:static;transform:none;font-size:10px">${lbl}</span>
          ${meta2 ? `<span style="color:var(--cm-fg-faint)">${meta2}</span>` : ''}
        </div>
      </div>
      <i class="ti ti-plus" style="font-size:16px;color:var(--cm-accent);flex-shrink:0"></i>
    </div>`;
  };
  list.innerHTML = fil.map(card).join('');
}
async function addGymExercise(gymId) {
  if (!await dpEnsureSession()) return;
  const ex = _gymLibExercises.find(e => e.id === gymId);
  const phase = _gymLibMode === 'activation' ? 'activation' : _gymLibMode === 'goalkeepers' ? 'goalkeepers' : 'main';
  const pos = dpNextPosition(phase);
  const { error } = await window.sb.from('session_exercises').insert({
    club_id:     _dpClubId,
    session_id:  _dpCurrentSessionId,
    exercise_id: gymId,               // FK → gym_exercises
    name:        ex?.name || null,
    phase,
    dose_mode:   'reps',              // strength drills dose by series × reps
    series:      3,
    reps:        10,
    duration:    null,
    position:    pos
  });
  if (error) {
    console.error('addGymExercise insert error:', error);
    alert(tt('daily_planning.add_exercise_failed','Add exercise failed:') + '\n' + (error.message||'') + '\ncode: ' + (error.code||''));
    return;
  }
  closeGymLibModal();
  if (phase === 'activation') await loadActivationActivities(_dpCurrentSessionId);
  else if (phase === 'goalkeepers') await loadGoalkeeperActivities(_dpCurrentSessionId);
  else await loadSessionExercises(_dpCurrentSessionId);
}

// ── Manual exercise ──
async function openManualExModal() {
  if (!await dpEnsureSession()) return;
  document.getElementById('manExName').value = '';
  document.getElementById('manExDur').value = '';
  document.getElementById('manExIntensity').value = '';
  document.getElementById('manExNotes').value = '';
  document.getElementById('manualExBackdrop').style.display = 'flex';
}
function closeManualExModal() { document.getElementById('manualExBackdrop').style.display = 'none'; }
async function saveManualExercise() {
  const name = document.getElementById('manExName').value.trim();
  if (!name) { document.getElementById('manExName').focus(); return; }
  const pos = dpNextPosition();   // always append to the end
  const { error } = await window.sb.from('session_exercises').insert({
    club_id: _dpClubId, session_id: _dpCurrentSessionId,
    name, phase: 'main',
    duration:  parseInt(document.getElementById('manExDur').value) || null,
    intensity: document.getElementById('manExIntensity').value || null,
    notes:     document.getElementById('manExNotes').value.trim() || null,
    position:  pos
  });
  if (!error) { closeManualExModal(); await loadSessionExercises(_dpCurrentSessionId); }
}

// ── Session info autosave ──
// Lo último que sabemos que hay en la base (en el mismo formato que el payload,
// para poder compararlos campo a campo) y su updated_at.
let _dpSaved = null, _dpSince = null;
const _dpHM = t => t ? String(t).slice(0, 5) : null;   // '08:30:00' (base) → '08:30' (input)
function dpRowToPayload(f) {
  return {
    title:            f.title || 'Training',
    session_date:     f.session_date,
    session_type:     f.session_type,
    session_time:     _dpHM(f.session_time),
    end_time:         _dpHM(f.end_time),
    duration:         f.duration ?? null,
    orientation:      f.orientation || null,
    focus:            f.focus || null,
    match_day_offset: f.match_day_offset || null,
    notes:            f.notes || null,
    estimated_rpe:    f.estimated_rpe || null,
    microcycle_id:    f.microcycle_id || null,
    coach_id:         f.coach_id || null,
    club_id:          f.club_id,
    // No va en el payload del autosave (los targets se guardan aparte), pero se
    // guarda acá para poder fusionarlos métrica por métrica ante un conflicto.
    gps_targets:      (f.gps_targets && typeof f.gps_targets === 'object') ? f.gps_targets : {},
  };
}
// Alguien guardó la sesión entre que la abrimos y que fuimos a escribir. Se
// refresca en pantalla lo que el usuario NO está tocando (así ve lo del otro
// sin perder lo suyo) y se reintenta el guardado sobre la versión nueva.
const DP_REMOTE_FIELDS = {
  title: 'dpSessionTitle', session_time: 'dpStartTime', end_time: 'dpEndTime',
  notes: 'dpNotes', estimated_rpe: 'dpEstRpe', orientation: 'dpOrientation',
  focus: 'dpFocus', match_day_offset: 'dpMatchDay', microcycle_id: 'dpMicrocycle',
};
function dpApplyRemoteSession(fila, mios) {
  const remoto = dpRowToPayload(fila);
  const foco = document.activeElement && document.activeElement.id;
  let tocados = 0;
  Object.entries(DP_REMOTE_FIELDS).forEach(([col, id]) => {
    if (mios && col in mios) return;        // ese campo lo está cambiando el usuario
    const el = document.getElementById(id);
    if (!el || el.id === foco) return;      // nunca pisar el campo donde está el cursor
    const v = remoto[col] == null ? '' : String(remoto[col]);
    if (el.tagName === 'SELECT' && v && ![...el.options].some(o => o.value === v)) return;
    if (String(el.value == null ? '' : el.value) !== v) { el.value = v; tocados++; }
  });
  _dpSaved = remoto;
  _dpSince = fila.updated_at || _dpSince;
  if (tocados) dpToast(tt('daily_planning.remote_fields_updated',
    'Someone else changed this session — the fields you were not editing were refreshed.'));
}

async function dpAutoSaveSession() {
  const date = _dpCurrentDate;
  const dotEl  = document.getElementById('dpSaveDot');
  const statEl = document.getElementById('dpSaveStatus');
  if (dotEl)  dotEl.style.background = 'var(--cm-warning)';
  if (statEl) statEl.textContent = tt('daily_planning.saving','Saving…');

  // Preserve the existing session_type when editing (beach / outdoor / tactical …); only new
  // sessions created from here default to 'training'. Never re-tag a non-field session as 'training'.
  const _curSess = (_dpDaySessions || []).find(s => s.id === _dpCurrentSessionId);
  const typeVal = (_curSess && _curSess.session_type && _curSess.session_type !== 'gym') ? _curSess.session_type : 'training';
  const nameVal = document.getElementById('dpSessionTitle')?.value?.trim();
  const title   = nameVal || 'Training';
  const startVal = document.getElementById('dpStartTime')?.value || null;
  const endVal   = document.getElementById('dpEndTime')?.value   || null;
  // duration = total PLANNED span (start→end wall clock) — this is what drives sRPE load.
  // Fall back to the effective drill time (activation + field drills) only when start/end
  // aren't both set.
  let duration = null;
  if (startVal && endVal) {
    const [sh, sm] = startVal.split(':').map(Number);
    const [eh, em] = endVal.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff > 0) duration = diff;
  }
  if (!duration && _dpSessionTotalMin > 0) duration = _dpSessionTotalMin;

  const mcId = document.getElementById('dpMicrocycle')?.value || null;
  const payload = {
    title,
    session_date:     date,
    session_type:     typeVal,
    session_time:     startVal,
    end_time:         endVal,
    duration,
    orientation:      document.getElementById('dpOrientation')?.value || null,
    focus:            document.getElementById('dpFocus')?.value || null,
    match_day_offset: document.getElementById('dpMatchDay')?.value || null,
    notes:            document.getElementById('dpNotes')?.value?.trim() || null,
    estimated_rpe:    parseInt(document.getElementById('dpEstRpe')?.value) || null,
    microcycle_id:    mcId || null,
    coach_id:         _dpProfile?.id || null,
    club_id:          _dpClubId
  };

  let saveError = null;
  if (_dpCurrentSessionId) {
    const r = await window.cmSave.patch({
      table: 'training_sessions', id: _dpCurrentSessionId, clubId: _dpClubId,
      prev: _dpSaved, next: payload, since: _dpSince,
      onRemote: dpApplyRemoteSession,
    });
    if (r.status === 'error') saveError = r.error;
    else if (r.status !== 'noop') { _dpSince = r.updatedAt || _dpSince; _dpSaved = { ...(_dpSaved || {}), ...r.sent }; }
    if (r.status === 'conflict') dpToast(tt('daily_planning.save_conflict',
      'Someone else is saving this session right now — try again in a moment.'));
  } else {
    // Anti-duplicate guard: a session for this day/team may already exist (e.g. created from
    // Calendar) even if loadDay didn't set _dpCurrentSessionId. Re-check before inserting a second one.
    // Exclude gym (separate module); when a start time is set, match the session AT that time so
    // AM/PM double sessions don't collide.
    let existQ = window.sb.from('training_sessions')
      .select('id').eq('club_id', _dpClubId).eq('team_id', _dpTeamId)
      .eq('session_date', date).eq('is_historical', false).neq('session_type', 'gym');
    if (startVal) existQ = existQ.eq('session_time', startVal);
    const { data: existing } = await existQ.order('created_at', { ascending: true }).limit(1);
    const existingId = existing?.[0]?.id || null;
    if (existingId) {
      _dpCurrentSessionId = existingId;
      // Sesión creada en otra pantalla (típico: Calendar). Se escribe entera una
      // vez —es la primera vez que la vemos— y a partir de ahí va por diff.
      const { data: _upd, error } = await window.sb.from('training_sessions')
        .update(payload).eq('id', existingId).eq('club_id', _dpClubId).select('updated_at');
      saveError = error;
      if (!error) { _dpSaved = { ...payload }; _dpSince = _upd && _upd[0] ? _upd[0].updated_at : null; }
      if (!error) {
        await Promise.all([loadSessionExercises(_dpCurrentSessionId), loadActivationActivities(_dpCurrentSessionId), loadGoalkeeperActivities(_dpCurrentSessionId)]);
        _dpUpdatePublishBtn();
      }
    } else {
      // Field (load) sessions require a start time (dedup + AM/PM). Hold the autosave — don't create
      // a timeless session — until the coach sets one.
      if (!startVal) {
        if (dotEl)  dotEl.style.background = 'var(--cm-fg-muted)';
        if (statEl) statEl.textContent = tt('daily_planning.need_start_time','Set a start time to save the session');
        return;
      }
      payload.team_id = _dpTeamId;
      const { data, error } = await window.sb.from('training_sessions').insert(payload).select('id,updated_at').single();
      saveError = error;
      if (!error && data?.id) {
        _dpCurrentSessionId = data.id;
        _dpSaved = { ...payload };            // recién creada: la base y la pantalla coinciden
        _dpSince = data.updated_at || null;
        _dpPreferredSessionId = data.id;
        // Add the freshly-created session to the day list so its tab appears immediately
        // (double-session AM/PM) without a full reload.
        _dpDaySessions = [...(_dpDaySessions || []), { id: data.id, title: payload.title, session_time: payload.session_time, session_type: payload.session_type }]
          .sort((a, b) => String(a.session_time || '').localeCompare(String(b.session_time || '')));
        _dpRenderSessionSwitch();
        await Promise.all([loadSessionExercises(_dpCurrentSessionId), loadActivationActivities(_dpCurrentSessionId), loadGoalkeeperActivities(_dpCurrentSessionId)]);
        _dpUpdatePublishBtn();
      }
    }
  }

  if (saveError) {
    console.error('Session save error:', saveError.message);
    if (dotEl)  dotEl.style.background = 'var(--cm-danger)';
    if (statEl) statEl.textContent = tt('daily_planning.error_saving','Error saving');
    return;
  }

  // Propagación GPS: las sesiones de GPS importadas quedan como filas SUELTAS (team_id NULL, sin
  // microcycle_id ni match_day_offset), separadas de la sesión planificada. Al fijar el MD/microciclo
  // del día acá, se los estampamos (y adoptamos el equipo) a esas filas del MISMO día, para que GPS
  // Analysis muestre el microciclo y el MD correctos. Scope conservador: solo filas team-null (las
  // importadas; las de otros equipos tienen su team_id), sin microciclo aún, no-gym, no-históricas,
  // y distintas de la que acabamos de guardar. Fill-only (no pisa valores existentes).
  if (_dpCurrentSessionId && _dpTeamId && (mcId || payload.match_day_offset)) {
    try {
      const patch = { team_id: _dpTeamId };
      if (mcId)                     patch.microcycle_id    = mcId;
      // Con dos dinámicas MD el mismo día (otra sesión del día con un MD distinto), la fila
      // importada es ambigua: no se sabe a qué grupo pertenece → no estampar MD.
      const _norm = v => window.cmMdNorm ? window.cmMdNorm(v) : String(v || '');
      const _mdAmbiguous = (_dpDaySessions || []).some(s => s.id !== _dpCurrentSessionId && s.match_day_offset && _norm(s.match_day_offset) !== _norm(payload.match_day_offset));
      if (payload.match_day_offset && !_mdAmbiguous) patch.match_day_offset = payload.match_day_offset;
      await window.sb.from('training_sessions').update(patch)
        .eq('club_id', _dpClubId).eq('session_date', date)
        .is('team_id', null).is('microcycle_id', null)
        .eq('is_historical', false).neq('session_type', 'gym')
        .neq('id', _dpCurrentSessionId);
    } catch (e) { console.warn('dp GPS MD/MC propagation:', e); }
  }

  if (dotEl)  dotEl.style.background = 'var(--cm-success)';
  if (statEl) { const _sv = tt('daily_planning.saved_just_now','Saved · just now'); statEl.textContent = _sv; setTimeout(() => { if (statEl.textContent === _sv) statEl.textContent = tt('daily_planning.autosaved','Autosaved'); }, 3000); }
  // No separate calendar write needed: the Calendar training block IS this
  // training_sessions row, so saving session_time already moves it there.
}

function dpQueueSave() {
  clearTimeout(_dpSaveTimer);
  _dpSaveTimer = setTimeout(dpAutoSaveSession, 1500);
}

async function dpCreateSession() {
  await dpAutoSaveSession();
}

async function dpEnsureSession() {
  if (_dpCurrentSessionId) return true;
  await dpAutoSaveSession();
  return !!_dpCurrentSessionId;
}

// ── Day off ── stored in calendar_events (type='day_off'), the same store the Calendar uses,
// so a day marked off here shows as a rest day there too (and vice-versa).
async function dpMarkDayOff() {
  if (!_dpTeamId || !_dpClubId || !_dpCurrentDate) return;
  await window.sb.from('calendar_events').delete()
    .eq('club_id', _dpClubId).eq('team_id', _dpTeamId).eq('date', _dpCurrentDate).eq('type', 'day_off');
  const { error } = await window.sb.from('calendar_events').insert({
    title: 'Day off', type: 'day_off', date: _dpCurrentDate,
    club_id: _dpClubId, team_id: _dpTeamId, visible_to: ['players','medical'] });
  if (error) { dpToast(tt('daily_planning.day_off_error','Could not update the day. Try again.')); return; }
  _dpDayOff = true;
  await loadDay(_dpCurrentDate);
}

async function dpRemoveDayOff() {
  if (!_dpTeamId || !_dpClubId || !_dpCurrentDate) return;
  const { error } = await window.sb.from('calendar_events').delete()
    .eq('club_id', _dpClubId).eq('team_id', _dpTeamId).eq('date', _dpCurrentDate).eq('type', 'day_off');
  if (error) { dpToast(tt('daily_planning.day_off_error','Could not update the day. Try again.')); return; }
  _dpDayOff = false;
  await loadDay(_dpCurrentDate);
}

// ── Print Roster ──
function dpPrintRoster() {
  const POS_DISP = { GK:'GK', CB:'CB', LB:'LB', RB:'RB', FB:'FB', DM:'DM', CM:'MF', MF:'MF', WG:'WG', ST:'ST', CF:'CF' };
  const L_AVAIL = tt('daily_planning.st_available','Available'), L_PARTIAL = tt('daily_planning.st_partial','Partial'), L_OUT = tt('daily_planning.st_out','Out'), L_AWAY = tt('daily_planning.st_away','Away');
  const rows = _dpPlayers.map(p => {
    const av  = _dpAvMap[p.id];
    const inj = _dpInjMap[p.id];
    let status = L_AVAIL;
    if (av?.status === 'away') status = L_AWAY;
    else if (av?.status === 'unavailable') status = L_OUT;
    else if (inj || av?.status === 'partial' || av?.status === 'limited') status = L_PARTIAL;
    const pos = POS_DISP[(p.position||'').toUpperCase()] || (p.position||'—').toUpperCase();
    return `<tr><td>${p.number ?? '—'}</td><td>${_dpEsc(p.first_name || '')} ${_dpEsc(p.last_name || '')}</td><td>${pos}</td><td>${status}</td></tr>`;
  }).join('');
  const _rosterTitle = tt('daily_planning.roster', `Roster · ${_dpCurrentDate}`, {date: _dpCurrentDate});
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${_rosterTitle}</title>
    <style>body{font-family:sans-serif;padding:20px}h2{margin:0 0 4px}p{margin:0 0 14px;color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:6px 10px;background:#f0f0f0;border-bottom:2px solid #ccc;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
    td{padding:5px 10px;border-bottom:1px solid #eee}@media print{@page{margin:14mm 12mm}}</style>
    </head><body><h2>${_rosterTitle}</h2><p>${tt('daily_planning.roster_players', `${_dpPlayers.length} players`, {count: _dpPlayers.length})}</p>
    <table><thead><tr><th>#</th><th>${tt('daily_planning.col_name','Name')}</th><th>${tt('common.position','Position')}</th><th>${tt('daily_planning.col_status','Status')}</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank', 'width=700,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Activation activities ──
async function loadActivationActivities(sessionId) {
  const strip = document.getElementById('dpActStrip');
  const ctEl  = document.getElementById('dpActCt');
  const durEl = document.getElementById('dpActDuration');
  if (!sessionId) {
    window._dpActItems = [];
    dpPaintActStrip();
    if (ctEl) ctEl.textContent = '—';
    if (durEl) durEl.value = '';
    _dpActTotalMin = 0;
    recalcTotals();
    return;
  }
  const { data } = await window.sb.from('session_exercises')
    .select('id,name,duration,series,work_time,rest_time,dose_mode,reps,notes,intensity,exercise_id,planner_exercise_id,calc_orientation,m2_per_player,players_count,field_width,field_height,phase,position,player_groups,gym_exercises(name,category,description,media_type,media_ref,video_id)')
    .eq('club_id', _dpClubId).eq('session_id', sessionId).eq('phase','activation').order('position');
  const acts = data || [];
  window._dpActItems = acts;
  dpResolveGymImgs(acts, sessionId, () => dpPaintActStrip());   // fill strength photos, then repaint the strip
  // instant paint using whatever previews are already cached
  acts.forEach(e => {
    e._previewPng = (e.planner_exercise_id && (e.planner_exercise_id in _dpPngCache)) ? _dpPngCache[e.planner_exercise_id] : null;
  });
  const total = Math.round(acts.reduce((s, a) => s + dpBlockMins(a).total_min, 0));
  _dpActTotalMin = total;
  if (ctEl) ctEl.textContent = total ? tt('daily_planning.min_count', `${total} min`, {count: total}) : '—';
  if (durEl) durEl.value = total || '';
  dpPaintActStrip();
  dpInitReorder();   // wire drag-reorder on the activation strip (idempotent)

  // fetch ONLY the uncached previews in the background (do NOT await)
  const _reqSession = sessionId;
  const need = [...new Set(acts.map(e => e.planner_exercise_id).filter(id => id && !(id in _dpPngCache)))];
  if (need.length) {
    dpResolvePreviews(need).then(() => {
      if (_dpCurrentSessionId !== _reqSession) return;
      acts.forEach(e => { if (e.planner_exercise_id in _dpPngCache) e._previewPng = _dpPngCache[e.planner_exercise_id]; });
      dpPaintActStrip();
    });
  }
  recalcTotals();
}

async function dpActAdd() {
  if (!await dpEnsureSession()) return;
  const pos = dpNextPosition('activation');   // append to the end of the activation strip
  const { error } = await window.sb.from('session_exercises').insert({
    club_id: _dpClubId, session_id: _dpCurrentSessionId,
    name: tt('daily_planning.new_activity','New activity'), phase: 'activation', duration: 5, position: pos
  });
  if (error) {
    console.error('dpActAdd insert error:', error);
    alert(tt('daily_planning.add_activity_failed','Add activity failed:') + '\n' + (error.message||'') + '\n' + (error.details||'') + '\n' + (error.hint||'') + '\ncode: ' + (error.code||''));
    return;
  }
  await loadActivationActivities(_dpCurrentSessionId);
}

async function dpActSave(id, name) {
  await window.sb.from('session_exercises').update({ name }).eq('id', id).eq('club_id', _dpClubId);
}

async function dpActDelete(id) {
  const { error } = await window.sb.from('session_exercises').delete().eq('id', id).eq('club_id', _dpClubId);
  if (!error) await loadActivationActivities(_dpCurrentSessionId);
}

// ── Goalkeeper training (phase='goalkeepers') — mirrors the activation section ──
async function loadGoalkeeperActivities(sessionId) {
  const strip = document.getElementById('dpGkStrip');
  const ctEl  = document.getElementById('dpGkCt');
  const durEl = document.getElementById('dpGkDuration');
  if (!strip) return;
  const addBtn = `<button class="dp-ex-add no-print" onclick="openLibModal('goalkeepers')"><i class="ti ti-plus" style="font-size:14px"></i>${tt('daily_planning.activity','Activity')}</button>`;
  if (!sessionId) {
    strip.innerHTML = addBtn;
    if (ctEl) ctEl.textContent = '—';
    if (durEl) durEl.value = '';
    _dpGkTotalMin = 0;
    window._dpGkItems = [];
    return;
  }
  const { data } = await window.sb.from('session_exercises')
    .select('id,name,duration,series,work_time,rest_time,dose_mode,reps,notes,planner_exercise_id,calc_orientation,m2_per_player,players_count,field_width,field_height,phase,position,player_groups')
    .eq('club_id', _dpClubId).eq('session_id', sessionId).eq('phase','goalkeepers').order('position');
  const gks = data || [];
  window._dpGkItems = gks;
  gks.forEach(e => {
    e._previewPng = (e.planner_exercise_id && (e.planner_exercise_id in _dpPngCache)) ? _dpPngCache[e.planner_exercise_id] : null;
  });
  const total = Math.round(gks.reduce((s, a) => s + dpBlockMins(a).total_min, 0));
  _dpGkTotalMin = total;
  if (ctEl) ctEl.textContent = total ? tt('daily_planning.min_count', `${total} min`, {count: total}) : (gks.length ? String(gks.length) : '—');
  if (durEl) durEl.value = total || '';
  strip.innerHTML = gks.map(dpExerciseCardHTML).join('') + addBtn;
  dpInitReorder();

  const _reqSession = sessionId;
  const need = [...new Set(gks.map(e => e.planner_exercise_id).filter(id => id && !(id in _dpPngCache)))];
  if (need.length) {
    dpResolvePreviews(need).then(() => {
      if (_dpCurrentSessionId !== _reqSession) return;
      gks.forEach(e => { if (e.planner_exercise_id in _dpPngCache) e._previewPng = _dpPngCache[e.planner_exercise_id]; });
      strip.innerHTML = gks.map(dpExerciseCardHTML).join('') + addBtn;
    });
  }
}

async function dpGkAdd() {
  if (!await dpEnsureSession()) return;
  const pos = dpNextPosition('goalkeepers');
  const { error } = await window.sb.from('session_exercises').insert({
    club_id: _dpClubId, session_id: _dpCurrentSessionId,
    name: tt('daily_planning.new_activity','New activity'), phase: 'goalkeepers', duration: 5, position: pos
  });
  if (error) {
    console.error('dpGkAdd insert error:', error);
    alert(tt('daily_planning.add_activity_failed','Add activity failed:') + '\n' + (error.message||'') + '\n' + (error.details||'') + '\n' + (error.hint||'') + '\ncode: ' + (error.code||''));
    return;
  }
  await loadGoalkeeperActivities(_dpCurrentSessionId);
}

async function dpGkSave(id, name) {
  await window.sb.from('session_exercises').update({ name }).eq('id', id).eq('club_id', _dpClubId);
}

async function dpGkDelete(id) {
  const { error } = await window.sb.from('session_exercises').delete().eq('id', id).eq('club_id', _dpClubId);
  if (!error) await loadGoalkeeperActivities(_dpCurrentSessionId);
}

// Collapse toggle (chevron) + per-user hide preference (localStorage), shown by default.
document.getElementById('dpGkHead')?.addEventListener('click', () => {
  document.getElementById('dpGkCard')?.classList.toggle('is-collapsed');
});
function dpGkToggleHidden(hidden) {
  try { localStorage.setItem('dp_gk_hidden', hidden ? '1' : ''); } catch (_) {}
  dpApplyGkHidden();
}
function dpApplyGkHidden() {
  let hidden = false;
  try { hidden = localStorage.getItem('dp_gk_hidden') === '1'; } catch (_) {}
  window._dpGkHidden = hidden;
  const card = document.getElementById('dpGkCard');
  const chip = document.getElementById('dpGkRestore');
  if (card) card.style.display = hidden ? 'none' : '';
  if (chip) chip.style.display = hidden ? 'flex' : 'none';
}
dpApplyGkHidden();

// ── Publish ──
function _dpUpdatePublishBtn() {
  const btn = document.getElementById('dpPublishBtn');
  if (!btn) return;
  if (_dpPublished) {
    btn.innerHTML = `<i class="ti ti-circle-check" style="font-size:14px"></i><span data-i18n="daily_planning.published">${tt('daily_planning.published','Published')}</span>`;
    btn.classList.remove('is-primary'); btn.classList.add('is-success');
  } else {
    btn.innerHTML = `<i class="ti ti-share-2" style="font-size:14px"></i><span data-i18n="daily_planning.publish">${tt('daily_planning.publish','Publish')}</span>`;
    btn.classList.remove('is-success'); btn.classList.add('is-primary');
  }
  // Delete / Duplicate only make sense once a session row exists for this date.
  const del = document.getElementById('dpDeleteBtn');
  if (del) del.style.display = _dpCurrentSessionId ? '' : 'none';
  const dup = document.getElementById('dpDuplicateBtn');
  if (dup) dup.style.display = _dpCurrentSessionId ? '' : 'none';
}

// ── Multi-session day switcher ──
// Before this, loadDay used .limit(1) and always opened the OLDEST session of the day, so a
// second session (double session) was visible in the calendar but impossible to plan.
// A gym row with no real plan (no exercises, roster, adaptations, load groups or notes) is a
// phantom — it must NOT surface a "GYM SESSION" tab for a day that has no gym plan.
function _dpGymSessionEmpty(s) {
  const c = s?.gym_content || {};
  // warm-up may be the new typed-sub-blocks shape (warmup.blocks) or the legacy flat shape (warmup.rows).
  const wuRows = Array.isArray(c.warmup?.blocks)
    ? c.warmup.blocks.reduce((n, b) => n + ((b.rows || []).length), 0)
    : (c.warmup?.rows?.length || 0);
  const rows = wuRows + (c.plyo?.rows?.length || 0) + (c.main?.rows?.length || 0);
  const roster = Array.isArray(c.roster) ? c.roster.length : 0;
  const groups = c.loadGroups ? (Array.isArray(c.loadGroups) ? c.loadGroups.length : Object.keys(c.loadGroups).length) : 0;
  // Physio-seeded adaptations auto-populate; only coach-authored content (a replacement/reason,
  // or a manually added row) counts as a real gym plan.
  const adaptReal = Array.isArray(c.adaptations) && c.adaptations.some(a =>
    (a.replacement || '').trim() || (a.reason || '').trim() || (!a.seeded && (a.player || '').trim()));
  const notes = (s?.notes || '').trim();
  return rows === 0 && roster === 0 && groups === 0 && !adaptReal && !notes;
}
function _dpRenderSessionSwitch() {
  const host = document.getElementById('dpSessionSwitch');
  if (!host) return;
  // Los partidos no tienen pestaña: son unidades de carga (RPE/GPS), no planificaciones.
  // Su convocatoria se define desde el popover "Session group" del card Squad.
  const list = (_dpDaySessions || []).filter(s => (s.session_type || '') !== 'match' && ((s.session_type || '') !== 'gym' || !_dpGymSessionEmpty(s)));
  const creating = !_dpCurrentSessionId;   // in "new session" mode (no row loaded)
  // Show the switch whenever there is at least one field session (so the "+ New session" affordance
  // for AM/PM double sessions is reachable) or while creating a new one.
  if (list.length < 1 && !creating) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  // Render a tab per existing session when there are ≥2, or while creating on top of ≥1 existing.
  const showTabs = list.length >= 2 || (list.length >= 1 && creating);
  const dupTitle = tt('daily_planning.duplicate', 'Duplicate');
  const tabs = showTabs ? list.map((s, i) => {
    const time = s.session_time ? String(s.session_time).slice(0, 5) : '';
    const name = s.title || tt('daily_planning.session_n', 'Session {n}', { n: i + 1 });
    const on   = s.id === _dpCurrentSessionId ? ' is-on' : '';
    // Gym sessions are planned in the Gym Planner, not here — don't offer to duplicate them.
    const isGym = (s.session_type || '') === 'gym';
    return `<span style="display:inline-flex;align-items:stretch;gap:2px">`
      + `<button type="button" class="dp-sess-tab${on}" data-sess="${_dpEsc(s.id)}" title="${_dpEsc(name)}">`
      + (time ? `<span class="tm">${_dpEsc(time)}</span>` : '')
      + `<span class="nm">${_dpEsc(name)}</span></button>`
      + (isGym ? '' : `<button type="button" class="dp-sess-tab" data-dup="${_dpEsc(s.id)}" title="${_dpEsc(dupTitle)}" style="padding-inline:7px;color:var(--cm-fg-muted)"><i class="ti ti-copy" style="font-size:12px"></i></button>`)
      + `</span>`;
  }).join('') : '';
  const newLabel = tt('daily_planning.new_session', 'New session');
  const newBtn = `<button type="button" class="dp-sess-tab dp-sess-new${creating ? ' is-on' : ''}" data-new="1" title="${_dpEsc(newLabel)}"><i class="ti ti-plus"></i><span class="nm">${_dpEsc(newLabel)}</span></button>`;
  host.innerHTML = tabs + newBtn;
  host.querySelectorAll('[data-sess]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.sess;
    if (id === _dpCurrentSessionId) return;
    // Gym sessions have their own planner — jump there instead of loading in the field layout.
    const _s = _dpDaySessions.find(x => x.id === id);
    if (_s && (_s.session_type || '') === 'gym') { window.location.href = `Gym Planner.html?date=${_dpCurrentDate}`; return; }
    _dpPreferredSessionId = id;
    // Keep the URL shareable/reloadable on the session you're actually looking at.
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('date', _dpCurrentDate);
      u.searchParams.set('session', id);
      history.replaceState(null, '', u);
    } catch (_) {}
    loadDay(_dpCurrentDate);
  }));
  host.querySelectorAll('[data-dup]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    dpOpenDuplicate(b.dataset.dup);
  }));
  const nb = host.querySelector('[data-new]');
  if (nb) nb.addEventListener('click', () => { if (!creating) _dpNewSession(); });
}

// Reset the editor to create a brand-new (second) field session for the current day, without
// touching the existing one. The row is created by the autosave once a start time is entered
// (dpAutoSaveSession holds until then), so double sessions get their required session_time.
function _dpNewSession() {
  dpFlushTargets(); dpFlushEdits();
  _dpCurrentSessionId = null;
  _dpPreferredSessionId = null;
  _dpPublished = false;
  _dpGpsTargets = {};
  ['dpSessionTitle','dpStartTime','dpEndTime','dpNotes','dpEstRpe','dpOrientation','dpFocus','dpMatchDay']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  _dpCalFields = new Set();
  if (typeof dpMarkCalFields === 'function') dpMarkCalFields();
  loadSessionExercises(null);
  loadActivationActivities(null);
  loadGoalkeeperActivities(null);
  _dpUpdatePublishBtn();
  _dpRenderSessionSwitch();
  const statEl = document.getElementById('dpSaveStatus');
  if (statEl) statEl.textContent = tt('daily_planning.need_start_time', 'Set a start time to save the session');
  const st = document.getElementById('dpStartTime'); if (st) st.focus();
}
function _dpEsc(s) { return String(s == null ? '' : s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

// ── Delete plan ──
// Delegates to the shared flow (assets/plan-delete.js): it confirms, and never destroys the
// session's own GPS / RPE / video records — those are independent of the plan sheet.
// ── Duplicate session ──────────────────────────────────────────────────────
// Copies a session (its planning fields + every session_exercises row across all
// phases) to another date. A training_sessions row IS the Calendar training block,
// so inserting the copy also creates the Calendar event on the target date — no
// separate calendar_events write is needed. The coach can instead pick a session
// already created on that date, which OVERWRITES its plan (confirmed first).
let _dpDupSourceId = null;

function _dpAddMin(hhmm, min) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  let tot = ((h * 60 + m + (min || 0)) % 1440 + 1440) % 1440;
  return String(Math.floor(tot / 60)).padStart(2, '0') + ':' + String(tot % 60).padStart(2, '0');
}

async function dpOpenDuplicate(sessionId) {
  const srcId = sessionId || _dpCurrentSessionId;
  if (!srcId) { dpToast(tt('daily_planning.dup_no_session', 'No session to duplicate yet.')); return; }
  _dpDupSourceId = srcId;
  const src = (_dpDaySessions || []).find(s => s.id === srcId) || {};
  const srcName = src.title || tt('daily_planning.session', 'Session');
  const srcTime = src.session_time ? String(src.session_time).slice(0, 5) : '';
  // Default target = same session one week later (the common "reuse next week" case).
  const defDate = (() => { try { const d = new Date(_dpCurrentDate + 'T12:00:00'); d.setDate(d.getDate() + 7); return cmYMD(d); } catch (_) { return _dpCurrentDate; } })();

  document.getElementById('dpDupModal')?.remove();
  const fieldCss = 'width:100%;padding:8px 10px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg,#fff);color:var(--cm-fg);font:var(--cm-body-sm)';
  const labCss = 'display:block;font:600 11px/1 var(--cm-font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--cm-fg-muted);margin-bottom:5px';
  const ov = document.createElement('div');
  ov.id = 'dpDupModal';
  ov.className = 'no-print';
  ov.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:var(--cm-surface,#fff);color:var(--cm-fg,#15181D);border:1px solid var(--cm-border);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.3);width:min(460px,94vw);max-height:90vh;overflow:auto;font:var(--cm-body-sm)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--cm-border)">
        <h3 style="margin:0;font:700 15px/1.2 var(--cm-font-sans)"><i class="ti ti-copy" style="font-size:16px;vertical-align:-2px;margin-right:6px"></i>${_dpEsc(tt('daily_planning.dup_title', 'Duplicate session'))}</h3>
        <button type="button" onclick="dpCloseDuplicate()" style="background:none;border:none;cursor:pointer;color:var(--cm-fg-muted);font-size:18px;line-height:1"><i class="ti ti-x"></i></button>
      </div>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
        <div style="color:var(--cm-fg-muted)">${_dpEsc(tt('daily_planning.dup_copying', 'Copying'))}: <strong style="color:var(--cm-fg)">${_dpEsc(srcName)}${srcTime ? ` · ${_dpEsc(srcTime)}` : ''}</strong></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <label style="flex:1;min-width:150px"><span style="${labCss}">${_dpEsc(tt('daily_planning.dup_target_date', 'Target date'))}</span>
            <input type="date" id="dpDupDate" value="${defDate}" onchange="dpDupLoadTargets()" style="${fieldCss}"></label>
          <label style="flex:1;min-width:120px"><span style="${labCss}">${_dpEsc(tt('daily_planning.start_time', 'Start time'))}</span>
            <input type="time" id="dpDupTime" value="${srcTime}" style="${fieldCss}"></label>
        </div>
        <div>
          <span style="${labCss}">${_dpEsc(tt('daily_planning.dup_destination', 'Destination'))}</span>
          <div id="dpDupTargets" style="display:flex;flex-direction:column;gap:6px"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid var(--cm-border)">
        <button type="button" class="cm-btn is-ghost is-sm" onclick="dpCloseDuplicate()">${_dpEsc(tt('common.cancel', 'Cancel'))}</button>
        <button type="button" class="cm-btn is-primary is-sm" id="dpDupConfirm" onclick="dpConfirmDuplicate()"><i class="ti ti-copy" style="font-size:14px"></i>${_dpEsc(tt('daily_planning.dup_cta', 'Duplicate'))}</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) dpCloseDuplicate(); });
  document.body.appendChild(ov);
  await dpDupLoadTargets();
}

function dpCloseDuplicate() { document.getElementById('dpDupModal')?.remove(); }

async function dpDupLoadTargets() {
  const host = document.getElementById('dpDupTargets');
  if (!host) return;
  const dateStr = document.getElementById('dpDupDate')?.value;
  let existing = [];
  if (dateStr) {
    const { data } = await window.sb.from('training_sessions')
      .select('id,title,session_time,session_type')
      .eq('club_id', _dpClubId).eq('team_id', _dpTeamId)
      .eq('session_date', dateStr).eq('is_historical', false).neq('session_type', 'gym')
      .order('session_time', { ascending: true, nullsFirst: true });
    existing = (data || []).filter(s => s.id !== _dpDupSourceId);
  }
  const row = (val, checked, main, sub) => `<label style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border:1px solid var(--cm-border);border-radius:8px;cursor:pointer">
      <input type="radio" name="dpDupTarget" value="${_dpEsc(val)}"${checked ? ' checked' : ''} style="margin-top:2px">
      <span style="flex:1;min-width:0"><span style="display:block;font:600 13px/1.3 var(--cm-font-sans);color:var(--cm-fg)">${_dpEsc(main)}</span>${sub ? `<span style="display:block;font:400 11px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)">${_dpEsc(sub)}</span>` : ''}</span>
    </label>`;
  let html = row('new', true, tt('daily_planning.dup_new_session', 'Create a new session'), tt('daily_planning.dup_new_hint', 'Adds a new training block to the calendar on that date.'));
  existing.forEach(s => {
    const tm = s.session_time ? String(s.session_time).slice(0, 5) : '';
    const nm = s.title || tt('daily_planning.session', 'Session');
    html += row(s.id, false, (tm ? `${tm} · ` : '') + nm, tt('daily_planning.dup_overwrite_hint', "Overwrites this session's plan."));
  });
  host.innerHTML = html;
}

async function dpConfirmDuplicate() {
  const btn = document.getElementById('dpDupConfirm');
  const dateStr = document.getElementById('dpDupDate')?.value;
  const startVal = document.getElementById('dpDupTime')?.value || null;
  const mode = document.querySelector('input[name="dpDupTarget"]:checked')?.value || 'new';
  if (!dateStr) { dpToast(tt('daily_planning.dup_need_date', 'Pick a target date.')); return; }
  if (mode === 'new' && !startVal) { dpToast(tt('daily_planning.need_start_time', 'Set a start time to save the session')); return; }
  if (mode !== 'new' && !confirm(tt('daily_planning.dup_confirm_overwrite', 'This replaces the whole plan of the selected session. Continue?'))) return;
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
  const fail = () => { dpToast(tt('daily_planning.dup_error', 'Could not duplicate. Try again.')); if (btn) { btn.disabled = false; btn.style.opacity = ''; } };

  // 1. Read the source session's planning fields.
  const { data: srcRows, error: e1 } = await window.sb.from('training_sessions')
    .select('title,session_type,session_time,end_time,duration,orientation,focus,match_day_offset,notes,estimated_rpe,microcycle_id,gps_targets,gym_content')
    .eq('id', _dpDupSourceId).eq('club_id', _dpClubId).limit(1);
  const src = srcRows?.[0];
  if (e1 || !src) return fail();

  // 2. Resolve the target session row (new insert, or overwrite an existing one).
  let targetId = null;
  if (mode === 'new') {
    const endVal = (startVal && src.duration) ? _dpAddMin(startVal, src.duration) : src.end_time;
    const payload = {
      title: src.title,
      session_type: (src.session_type && src.session_type !== 'gym') ? src.session_type : 'training',
      session_date: dateStr, session_time: startVal, end_time: endVal, duration: src.duration,
      orientation: src.orientation, focus: src.focus, match_day_offset: src.match_day_offset,
      notes: src.notes, estimated_rpe: src.estimated_rpe, microcycle_id: src.microcycle_id,
      gps_targets: src.gps_targets, gym_content: src.gym_content,
      published: false, is_historical: false,
      club_id: _dpClubId, team_id: _dpTeamId, coach_id: _dpProfile?.id || null
    };
    const { data, error } = await window.sb.from('training_sessions').insert(payload).select('id').single();
    if (error || !data?.id) return fail();
    targetId = data.id;
  } else {
    targetId = mode;
    // Overwrite the plan but keep the target's own date/time/type so it stays put on the calendar.
    const upd = {
      title: src.title, orientation: src.orientation, focus: src.focus, match_day_offset: src.match_day_offset,
      notes: src.notes, estimated_rpe: src.estimated_rpe, microcycle_id: src.microcycle_id,
      gps_targets: src.gps_targets, gym_content: src.gym_content
    };
    const { error: eU } = await window.sb.from('training_sessions').update(upd).eq('id', targetId).eq('club_id', _dpClubId);
    if (eU) return fail();
    await window.sb.from('session_exercises').delete().eq('session_id', targetId).eq('club_id', _dpClubId);
  }

  // 3. Copy every exercise/activity (all phases: main / activation / goalkeepers).
  const { data: exRows } = await window.sb.from('session_exercises')
    .select('name,phase,duration,series,work_time,rest_time,dose_mode,reps,dosing_overrides,position,player_groups,intensity,notes,exercise_id,planner_exercise_id,field_width,field_height,players_count,m2_per_player,calc_orientation')
    .eq('session_id', _dpDupSourceId).eq('club_id', _dpClubId).order('position');
  if (exRows && exRows.length) {
    const copies = exRows.map(r => ({ ...r, session_id: targetId, club_id: _dpClubId }));
    const { error: eE } = await window.sb.from('session_exercises').insert(copies);
    if (eE) console.warn('Duplicate exercises error:', eE.message);
  }

  dpCloseDuplicate();
  dpToast(tt('daily_planning.dup_done', 'Session duplicated ✓'));
  _dpPreferredSessionId = targetId;
  await loadDay(dateStr);
}

async function dpDeletePlan() {
  if (!_dpCurrentSessionId) return;
  const dateLabel = (() => {
    try { return new Date(_dpCurrentDate + 'T12:00:00').toLocaleDateString(
      (window.CM_I18N && CM_I18N.current) || 'en', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (_) { return _dpCurrentDate; }
  })();
  try {
    const done = await window.cmDeletePlan({ sessionId: _dpCurrentSessionId, clubId: _dpClubId, dateLabel });
    if (!done) return;
    // Reload the day: the session is either gone or now an empty shell.
    await loadDay(_dpCurrentDate);
  } catch (err) {
    alert(tt('plan_delete.error', 'Could not delete: {msg}', { msg: err.message }));
  }
}

async function dpPublish() {
  if (!_dpCurrentSessionId) { alert(tt('daily_planning.no_session_alert','No training session for this date.')); return; }
  const next = !_dpPublished;
  const { error } = await window.sb.from('training_sessions')
    .update({ published: next }).eq('id', _dpCurrentSessionId).eq('club_id', _dpClubId);
  if (error) { console.warn('Publish error (column may not exist yet):', error.message); return; }
  _dpPublished = next;
  _dpUpdatePublishBtn();

  // When publishing, also update the microcycle publish state
  if (next) {
    const mc = _dpMicrocycles.find(m => m.start_date <= _dpCurrentDate && _dpCurrentDate <= m.end_date);
    if (mc) {
      const profile = await window.getProfile();
      const mcPatch = { publish_players: true, publish_medical: true };
      if (!mc.published_at) mcPatch.published_at = new Date().toISOString();
      if (profile?.id) mcPatch.published_by = profile.id;
      const { error: mcErr } = await window.sb.from('microcycles').update(mcPatch).eq('id', mc.id);
      if (!mcErr) {
        mc.publish_players = true;
        mc.publish_medical = true;
        if (mcPatch.published_at) mc.published_at = mcPatch.published_at;
      }

      // Notify all players in the club
      const dateFmt = new Date(_dpCurrentDate + 'T12:00:00').toLocaleDateString(ttLocale(), { weekday:'short', day:'numeric', month:'short' });
      // Notify club staff (players have no login yet).
      // TODO: when players get login, also notify player profiles.
      const recips = await window.cmStaffByBuckets(_dpClubId, ['admin', 'coach', 'sc', 'analyst']);
      if (recips.length) {
        const notifications = recips.map(p => ({
          user_id: p.id,
          club_id: _dpClubId,
          type:    'training_plan_published',
          title:   tt('daily_planning.notif_published_title', `Training plan published — ${dateFmt}`, {date: dateFmt}),
          body:    tt('daily_planning.notif_published_body','The training plan for this day has been published.'),
          link:    'Calendar.html',
        }));
        const { error: nErr } = await window.sb.from('notifications').insert(notifications);
        if (nErr) console.warn('[notif] training_plan_published insert failed:', nErr.message);
      }
    }
  }
}

// ── Print ──
function dpPrint() { window.print(); }

// Inline every cross-origin <img> as a data: URI so the html2canvas capture can never be
// tainted (a tainted canvas makes toDataURL throw → "PDF export failed"). Best-effort per
// image: if a fetch fails, the original src is left for html2canvas' useCORS to try.
async function _dpInlineImages(root) {
  const imgs = [...root.querySelectorAll('img')].filter(im => { const s = im.getAttribute('src') || ''; return s && !s.startsWith('data:'); });
  await Promise.all(imgs.map(async im => {
    try {
      const resp = await fetch(im.src, { mode: 'cors', cache: 'force-cache' });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      await new Promise(res => { im.onload = im.onerror = res; im.src = dataUrl; });
    } catch (_) { /* leave original src */ }
  }));
}

// ── Export PDF ──
async function dpExportPDF() {
  const btn = document.querySelector('[onclick="dpExportPDF()"]');
  if (btn) { btn.disabled = true; btn.textContent = tt('daily_planning.generating','Generating…'); }
  const host = document.getElementById('dpPrintSheet');
  try {
    const html2canvas = window.html2canvas;
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!html2canvas || !jsPDF) throw new Error('PDF libraries not loaded');
    // Build + temporarily reveal the dedicated print sheet off-screen so html2canvas can capture it
    await dpRenderPrintSheet();
    if (host) { host.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;z-index:-1'; }
    const el = document.querySelector('#dpPrintSheet .dsp-sheet') || host;
    const squadEl = el.querySelector('#dspSquadBand');
    await _dpInlineImages(el);   // convert crest + drill thumbnails to data URIs → never taints the canvas
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const JPEG_Q = 0.92;   // high-quality JPEG keeps text crisp but is ~5-10× lighter than lossless PNG
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const MARGIN = 8;                                  // mm, top + bottom
    const pxPerMm = canvas.width / pageW;              // image px per printed mm (full-bleed width)
    const scale = canvas.width / el.offsetWidth;       // css px → canvas px
    // Capture the squad-availability band (in its natural page-1 position) so it can be
    // re-drawn at the top of pages 2+ before the exercises — a repeated reference header.
    let squadImg = null, squadHmm = 0;
    if (squadEl) {
      const sheetTop = el.getBoundingClientRect().top;
      const r = squadEl.getBoundingClientRect();
      const topPx = Math.max(0, Math.round((r.top - sheetTop) * scale));
      const hPx = Math.round(r.height * scale);
      squadHmm = hPx / pxPerMm;
      const sc = document.createElement('canvas');
      sc.width = canvas.width; sc.height = hPx;
      const sctx = sc.getContext('2d');
      sctx.fillStyle = '#ffffff'; sctx.fillRect(0, 0, sc.width, sc.height);   // JPEG has no alpha
      sctx.drawImage(canvas, 0, topPx, canvas.width, hPx, 0, 0, canvas.width, hPx);
      squadImg = sc.toDataURL('image/jpeg', JPEG_Q);
    }
    // Break-safe boxes (cards + atomic blocks) in canvas px, so a page never cuts through one.
    // A .dsp-brk-keep title is merged with the card row right after it, so headings never orphan.
    const sheetTop0 = el.getBoundingClientRect().top;
    const toPx = n => { const r = n.getBoundingClientRect(); return { top: (r.top - sheetTop0) * scale, bottom: (r.bottom - sheetTop0) * scale }; };
    const boxes = [...el.querySelectorAll('.dsp-brk')].map(toPx);
    [...el.querySelectorAll('.dsp-brk-keep')].forEach(t => {
      const tb = toPx(t);
      const next = boxes.filter(b => b.top >= tb.bottom - 2).sort((a, b) => a.top - b.top)[0];
      boxes.push({ top: tb.top, bottom: next ? next.bottom : tb.bottom });   // glue heading to its first row
    });
    // Forced page breaks: any .dsp-page element starts on a fresh page (e.g. goalkeeper block).
    const forcedBreaks = [...el.querySelectorAll('.dsp-page')].map(n => toPx(n).top).filter(y => y > 1);
    const straddles = y => boxes.some(b => y > b.top + 1 && y < b.bottom - 1);
    // Given a hard max end, pull the cut up to the nearest safe boundary that clears every box.
    const safeCut = (start, maxEnd) => {
      if (maxEnd >= canvas.height) return canvas.height;
      const cands = boxes.map(b => Math.ceil(b.bottom)).filter(y => y > start + 10 && y <= maxEnd && !straddles(y));
      if (cands.length) return Math.max(...cands);
      const hit = boxes.find(b => maxEnd > b.top + 1 && maxEnd < b.bottom - 1);   // maxEnd lands inside a box
      if (hit && hit.top > start + 10) return Math.floor(hit.top);                 // push whole box to next page
      return maxEnd;                                                               // single box taller than a page
    };

    const GAP = 5;                                     // mm between repeated squad band and content
    let sy = 0, page = 0;
    while (sy < canvas.height) {
      if (page > 0) pdf.addPage();
      // Page 1 flows naturally (squad sits under the session data); pages 2+ repeat the squad on top.
      const repeat = page > 0 && squadImg;
      let contentTop = MARGIN;
      if (repeat) { pdf.addImage(squadImg, 'JPEG', 0, MARGIN, pageW, squadHmm); contentTop = MARGIN + squadHmm + GAP; }
      const maxSlice = Math.max(1, Math.floor((pageH - contentTop - MARGIN) * pxPerMm));
      // A forced break inside this slice ends the page exactly at that boundary (new page for the block).
      const fb = forcedBreaks.filter(y => y > sy + 10 && y <= sy + maxSlice).sort((a, b) => a - b)[0];
      const cut = fb != null ? Math.round(fb) : safeCut(sy, sy + maxSlice);
      const h = Math.max(1, cut - sy);
      const slice = document.createElement('canvas');
      slice.width = canvas.width; slice.height = h;
      const slctx = slice.getContext('2d');
      slctx.fillStyle = '#ffffff'; slctx.fillRect(0, 0, slice.width, slice.height);   // JPEG has no alpha
      slctx.drawImage(canvas, 0, sy, canvas.width, h, 0, 0, canvas.width, h);
      pdf.addImage(slice.toDataURL('image/jpeg', JPEG_Q), 'JPEG', 0, contentTop, pageW, h / pxPerMm);
      sy += h; page++;
    }
    pdf.save(`${_dpCurrentDate}_daily-plan.pdf`);
  } catch (e) {
    console.error('PDF error:', e);
    alert(tt('daily_planning.pdf_export_failed','PDF export failed. Try using Print → Save as PDF instead.') + '\n\n[' + ((e && e.message) ? e.message : e) + ']');
  } finally {
    if (host) host.style.cssText = '';   // restore (CSS hides it again via #dpPrintSheet{display:none})
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="ti ti-file-type-pdf" style="font-size:14px"></i><span data-i18n="daily_planning.export_pdf">${tt('daily_planning.export_pdf','Export PDF')}</span>`; }
  }
}

// ── MODO SOLO LECTURA ────────────────────────────────────────────────────────
// Roles fuera de técnico/PF/dirección/admin (mismos buckets que Tactical Planning,
// vía cmTacticalAccess) ven la planificación pero no pueden editar nada.
// Doble capa: CSS body.dp-ro esconde los controles de edición, y las funciones
// que escriben quedan envueltas con un guard (las automáticas en silencio, las
// interactivas con toast). Super admin queda exento en el boot.
const DP_RO_FIELDS = ['dpSessionTitle','dpStartTime','dpEndTime','dpMicrocycle','dpOrientation','dpFocus','dpEstRpe','dpMatchDay','dpNotes'];
function dpApplyReadOnly() {
  document.body.classList.add('dp-ro');
  DP_RO_FIELDS.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
}
// Inverso, para el candado por presencia: el de al lado cerró la pestaña y esto
// vuelve a ser editable. Nunca libera el solo-lectura por ROL — ese lo decide el
// boot y no se toca (_dpRoByRole).
function dpReleaseReadOnly() {
  if (_dpRoByRole) return;
  document.body.classList.remove('dp-ro');
  DP_RO_FIELDS.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
}
let _dpRoByRole = false, _dpLock = null;
(function () {
  const wrap = (name, silent) => {
    const orig = window[name];
    if (typeof orig !== 'function') { console.warn('dp-ro: no existe', name); return; }
    window[name] = function () {
      if (window._dpReadOnly) {
        if (!silent) dpToast(tt('daily_planning.readonly_toast', "View only — you can't edit this planning."));
        return;
      }
      return orig.apply(this, arguments);
    };
  };
  // Automáticas (autosave/flush al navegar): silenciosas.
  ['dpAutoSaveSession','dpQueueSave','dpEnsureSession','_dpEditSave','_dpEditFlushOne','dpFlushTargets','dpSaveTargets']
    .forEach(n => wrap(n, true));
  // Interactivas: avisan con toast.
  ['dpChangeStatus','dpToggleAdapt','dpReorderExercise','dpStrSetUnit','deleteExercise',
   'openLibModal','openGymLibModal','openManualExModal','addPlannerExercise','addGymExercise','saveManualExercise',
   'dpCreateSession','dpMarkDayOff','dpRemoveDayOff','dpActAdd','dpActSave','dpActDelete','dpGkAdd','dpGkSave','dpGkDelete',
   'dpOpenDuplicate','dpConfirmDuplicate','dpDeletePlan','dpPublish',
   'dpOpenExGroup','dpExAddGroup','dpExDelGroup','dpExRenameGroup','dpToggleExGroupPlayer','dpCopyGroupsFrom']
    .forEach(n => wrap(n, false));
})();

(async () => {
  if (!(await window.guardModule())) return;
  const clubId = await window.getClubId();
  _dpClubId = clubId;
  const [profile, club] = await Promise.all([window.getProfile(), window.getClub()]);
  window._dpClub = club;

  if (club) await window.applyClubTheme();

  _dpProfile = profile;
  window._dpReadOnly = !!(window.cmTacticalAccess && profile && !window.cmTacticalAccess(profile));
  if (window._dpReadOnly) { try { if (await window.isSuperAdmin()) window._dpReadOnly = false; } catch (_) {} }
  _dpRoByRole = window._dpReadOnly;   // el candado no puede levantar un bloqueo de rol
  if (window._dpReadOnly) dpApplyReadOnly();
  await dpInitTeamSwitch();

  const nameEl = document.getElementById('dpUserName');
  if (nameEl && profile?.full_name) nameEl.textContent = profile.full_name;

  const _dpQS   = new URLSearchParams(window.location.search);
  const urlDate = _dpQS.get('date');
  const today   = cmToday();
  let   initDate = (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) ? urlDate : today;
  // ?session=<id> → open exactly that session (the calendar links carry it, so clicking the
  // second training of a double session lands on THAT one, not the day's first).
  _dpPreferredSessionId = _dpQS.get('session') || null;

  // If today's session is already over, open tomorrow's plan by default (so you edit next day's
  // without a manual day-change). Only when no explicit date/session was requested via URL.
  if (!urlDate && !_dpPreferredSessionId) {
    try {
      const { data: _todaySess } = await window.sb.from('training_sessions')
        .select('session_time,end_time')
        .eq('club_id', clubId).eq('team_id', _dpTeamId)
        .eq('session_date', today).eq('is_historical', false);
      // Last end (or start, if no end) among today's sessions, as local HH:MM.
      const _endHM = (_todaySess || [])
        .map(s => String(s.end_time || s.session_time || '').slice(0, 5))
        .filter(Boolean).sort().pop();
      const _now = new Date();
      const _nowHM = String(_now.getHours()).padStart(2, '0') + ':' + String(_now.getMinutes()).padStart(2, '0');
      if (_endHM && _nowHM > _endHM) initDate = _dpAddDays(today, 1);
    } catch (_) { /* stay on today if the pre-check fails */ }
  }

  const yesterday7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday  = cmYMD(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000));

  const [playersRes, injuriesRes, mcRes, adaptRes, rehabRes] = await Promise.all([
    window.sb.from('players').select('id,first_name,last_name,number,position, player_teams!inner(team_id,is_primary)').eq('club_id', clubId).eq('player_teams.team_id', _dpTeamId).neq('status','inactive').is('archived_at', null).order('number'),
    window.sb.from('injuries').select('player_id,body_area,injury_type').eq('club_id', clubId).eq('status','active'),
    window.sb.from('microcycles').select('id,name,start_date,end_date,rival,home_away,publish_players,publish_medical,published_at').eq('club_id', clubId).eq('team_id', _dpTeamId).order('start_date'),
    window.sb.from('treatments')
      .select('player_id, adaptation_notes, adaptation_sent_at, date')
      .eq('club_id', clubId)
      .eq('notify_coaches', true)
      .gte('adaptation_sent_at', yesterday7)
      .gte('date', yesterday)
      .order('adaptation_sent_at', { ascending: false }),
    // Planes de rehab activos: un lesionado CON plan trabaja aparte (grupo «Rehab»), no está «Out»
    window.sb.from('rehab_plans')
      .select('player_id,phase,phase_type,status')
      .eq('club_id', clubId).eq('kind', 'rehab')
      .in('status', ['on_track','near_rtp','blocked']),
  ]);

  const _seenDp = new Set();
  _dpPlayers = (playersRes.data || []).filter(p => _seenDp.has(p.id) ? false : (_seenDp.add(p.id), true));
  _dpMicrocycles = mcRes.data || [];
  (injuriesRes.data || []).forEach(i => { _dpInjMap[i.player_id] = i; });
  (rehabRes.data || []).forEach(r => { if (!_dpRehabMap[r.player_id]) _dpRehabMap[r.player_id] = r; });
  // Keep most recent active adaptation per player
  (adaptRes.data || []).forEach(t => { if (!_dpAdaptMap[t.player_id]) _dpAdaptMap[t.player_id] = t; });

  await loadDay(initDate);

  // ── Candado suave ─────────────────────────────────────────────
  // El primero que abre el día lo edita; el que llega después queda en modo
  // lectura con un cartel arriba y un botón para forzar. Evita que dos
  // autosaves se pisen la sesión entera sin que nadie se entere.
  // Ver assets/cm-lock.js.
  if (window.cmLock && _dpClubId && !_dpRoByRole) {
    _dpLock = window.cmLock.claim({
      resource: `dp:${_dpTeamId}:${_dpCurrentDate}`,
      clubId:   _dpClubId,
      label:    tt('daily_planning.lock_label', 'this session'),
      // Marca en vivo el campo donde está parado el otro (como la celda
      // seleccionada en una planilla compartida). Sirve igual en modo lectura:
      // ves qué está tocando el que tiene el candado.
      fields:   'input[id^="dp"], textarea[id^="dp"], select[id^="dp"]',
      // Se corre ANTES de que el candado bloquee: si había algo a medio guardar
      // (el debounce del autosave, ediciones de tareas, targets de GPS), se
      // persiste ahora. Después de esto los guardados quedan frenados.
      onLosing: () => {
        try { dpFlushEdits(); dpFlushTargets(); } catch (_) {}
        if (_dpSaveTimer) { clearTimeout(_dpSaveTimer); _dpSaveTimer = null; dpAutoSaveSession(); }
      },
      onState: ({ isOwner }) => {
        window._dpReadOnly = !isOwner;
        if (isOwner) dpReleaseReadOnly(); else dpApplyReadOnly();
      },
    });
  }

  // ── Refresco en vivo ──────────────────────────────────────────
  // Otro miembro del staff toca la sesión del día (ejercicios, horario,
  // convocatoria, disponibilidad, adaptaciones del físio) y esta pantalla se
  // pone al día sola. Nunca mientras se está escribiendo o hay autosave en
  // vuelo: ahí aparece el chip «hay cambios» y se aplica al soltar.
  // Ver assets/cm-realtime.js.
  if (window.cmLive && _dpClubId) {
    window.cmLive.watch({
      name: 'daily-planning',
      tables: [
        { table: 'training_sessions',    filter: `club_id=eq.${_dpClubId}` },
        { table: 'session_exercises',    filter: `club_id=eq.${_dpClubId}` },
        { table: 'session_participants', filter: `club_id=eq.${_dpClubId}` },
        { table: 'availability',         filter: `club_id=eq.${_dpClubId}` },
        { table: 'treatments',           filter: `club_id=eq.${_dpClubId}` },
      ],
      relevant: (row, p) => {
        if (p.table === 'training_sessions')
          return row.session_date === _dpCurrentDate && (!row.team_id || row.team_id === _dpTeamId);
        if (p.table === 'session_exercises' || p.table === 'session_participants')
          return (_dpDaySessions || []).some(s => s.id === row.session_id);
        if (p.table === 'availability') return row.date === _dpCurrentDate;
        if (p.table === 'treatments')   return (row.adaptation_date || row.date) === _dpCurrentDate;
        return true;
      },
      busy: () => !!_dpSaveTimer || !!_dpProjSaveTimer || !!_dpDragSeid
                  || Object.keys(_dpEditPending || {}).length > 0,
      onRefresh: async () => { if (_dpCurrentDate) await loadDay(_dpCurrentDate); },
    });
  }

  // Update save indicator after initial load
  const initDot  = document.getElementById('dpSaveDot');
  const initStat = document.getElementById('dpSaveStatus');
  if (_dpCurrentSessionId) {
    if (initDot)  initDot.style.background = 'var(--cm-success)';
    if (initStat) initStat.textContent = tt('daily_planning.autosaved','Autosaved');
  } else {
    if (initDot)  initDot.style.background = 'var(--cm-fg-faint)';
    if (initStat) initStat.textContent = tt('daily_planning.not_saved','Not saved');
  }

  if (new URLSearchParams(window.location.search).get('openCreate') === '1') {
    await dpAutoSaveSession();
  }

  document.getElementById('dpNavPrev').addEventListener('click', () => loadDay(_dpAddDays(_dpCurrentDate, -1)));
  document.getElementById('dpNavNext').addEventListener('click', () => loadDay(_dpAddDays(_dpCurrentDate, 1)));
  document.getElementById('dpDateInput').addEventListener('change', e => { if (e.target.value) loadDay(e.target.value); });

  // Autosave session info with debounce on field changes
  ['dpSessionTitle','dpStartTime','dpEndTime','dpOrientation','dpFocus','dpMatchDay','dpNotes','dpEstRpe'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', dpQueueSave);
    el.addEventListener('input', dpQueueSave);
  });
})().catch(console.error);

  async function dpInitTeamSwitch() {
    _dpClubId = _dpClubId || await window.getClubId();
    const profile = _dpProfile || await window.getProfile();
    const bucket = (profile?.role || profile?.club_role || '').toLowerCase();
    let fullAccess = bucket === 'admin' || bucket === 'owner';
    if (!fullAccess && window.isSuperAdmin) { try { fullAccess = await window.isSuperAdmin(); } catch {} }
    let teams = await window.getTeams(_dpClubId);
    if (!fullAccess) {
      let mine = []; try { mine = (await window.sb.rpc('my_team_ids')).data || []; } catch {}
      const s = new Set(mine); teams = teams.filter(t => s.has(t.id));
    }
    _dpTeams = teams;
    const sel = document.getElementById('dpTeamSelect');
    if (!teams.length) { sel.innerHTML = `<option value="">${tt('daily_planning.no_teams','No teams')}</option>`; return; }
    const saved = sessionStorage.getItem('cal_active_team');
    _dpTeamId = (saved && teams.some(t => t.id === saved)) ? saved : teams[0].id;
    sel.innerHTML = teams.map(t => `<option value="${t.id}" ${t.id===_dpTeamId?'selected':''}>${_dpEsc(t.name)}</option>`).join('');
  }
  function dpOnTeamChange() {
    _dpTeamId = document.getElementById('dpTeamSelect').value;
    sessionStorage.setItem('cal_active_team', _dpTeamId);
    location.reload();
  }
  window.dpOnTeamChange = dpOnTeamChange;

  // Re-render everything the JS builds when the language changes (static nodes are
  // re-applied by sidebar.js). Uses in-memory data — no refetch.
  document.addEventListener('cm:langchanged', () => {
    try {
      if (_dpCurrentDate) {
        const _fmt = _dpFmt(_dpCurrentDate);
        const _crumb = document.getElementById('dpCrumbDate');
        // Rebuild crumb/pager labels (microcycle + MD) from current data.
        const mc = _dpMicrocycles.find(m => m.start_date <= _dpCurrentDate && _dpCurrentDate <= m.end_date);
        const mcMdLabel = dpMdLabel(_dpCurrentDate, mc);
        const mcRivalLabel = mc?.rival ? ` · ${tt('daily_planning.vs_rival', `vs ${mc.rival}`, {rival: mc.rival})}` : '';
        const today = cmToday();
        const subLabel = _dpCurrentDate === today ? tt('daily_planning.today','today') : '';
        const mcLabel = mc ? ((mc.name||'') + mcMdLabel + mcRivalLabel) : '';
        if (_crumb) _crumb.textContent = _fmt + (mcMdLabel || '');
        const _pager = document.getElementById('dpPagerLabel');
        if (_pager) _pager.innerHTML = `<i class="ti ti-calendar-event"></i>${_fmt}${mcLabel ? `<span class="sub">${mcLabel}</span>` : subLabel ? `<span class="sub">${subLabel}</span>` : ''}`;
      }
      _dpUpdatePublishBtn();
      if (window._dpAvMap) dpRenderSquad(window._dpAvMap);
      renderExerciseList(_dpFieldExercises || []);
      if (window._dpActItems) dpPaintActStrip();
      recalcTotals();   // totals + AU + GPS projection
      dpRenderPrintSheet();
    } catch (e) { console.warn('dp langchanged re-render failed', e); }
  });
